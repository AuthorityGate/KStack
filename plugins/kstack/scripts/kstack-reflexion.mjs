#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateConfig } from './kstack-config.mjs';
import { scanTextForSecrets } from './kstack-memory.mjs';
import { categoricalEncode, isWellFormedScalarString, matchLessons, normalizeMatchValue, renderActorReference, renderEvidenceReport, scalarLength } from './reflexion/retrieval-core.mjs';
import { diagnoseCurrentCorpus, formatLockTimeoutDiagnosis, migrateKstackMode, mutateValidatedCorpus, readValidatedCorpus, repairCorpusFromCandidate, resolveProjectCorpus } from './reflexion/corpus-io.mjs';
import { isPromptReferenceAllowed } from './reflexion/prompt-assembler.mjs';
import { formatUnavailableSentinelError, invalidateRuntimeContract, removeUnavailableSentinel, UnavailableSentinelError } from './reflexion/unavailable-sentinel.mjs';
import { runResolverConformance } from './reflexion-architecture/resolver-client.mjs';

const DENIED_ENVIRONMENT = Object.freeze(['NODE_OPTIONS', 'NODE_PATH', 'NODE_ICU_DATA']);
const CONTRACT_BASENAME = 'reflexion-runtime-contract-v1.txt';
const SENTINEL_BASENAME = 'reflexion-runtime-unavailable-v1';
const CONTRACT_REVISION = 'kstack-reflexion-r11-v1';
const CONDITION_IDENTIFIER = 'node-esm-import-default-v1';
const RESOLVER_PROBE_IDENTIFIER = '3e2a3a2daf77c4c2b16d2919f86995f41188248b553f62c27e4f448b03d31f64';
const UNICODE_PROBE_IDENTIFIER = 'ce0453507f8603f09be1d4b7581d47b8a39f040189e9bf43b193f2c88f4f3f23';
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const DIRECTORY = fs.constants.O_DIRECTORY ?? 0;
const REPAIR_ENDPOINT_EXPECTATIONS = new Set([
  'missing', 'KSTACK_REFLEXION_CURRENT_FINAL_LINK', 'KSTACK_REFLEXION_CURRENT_NON_REGULAR',
  'KSTACK_REFLEXION_CURRENT_OVERSIZED', 'KSTACK_REFLEXION_CURRENT_IO'
]);
const REPAIR_CORPUS_EXPECTATIONS = new Set([
  'KSTACK_REFLEXION_CORPUS_UTF8_INVALID', 'KSTACK_REFLEXION_CORPUS_JSON_SYNTAX',
  'KSTACK_REFLEXION_CORPUS_TOP_LEVEL_SHAPE', 'KSTACK_REFLEXION_CORPUS_LESSON_SHAPE',
  'KSTACK_REFLEXION_CORPUS_UNKNOWN_PROPERTY', 'KSTACK_REFLEXION_CORPUS_MISSING_PROPERTY',
  'KSTACK_REFLEXION_CORPUS_FIELD_TYPE', 'KSTACK_REFLEXION_CORPUS_FIELD_VALUE',
  'KSTACK_REFLEXION_CORPUS_CARDINALITY', 'KSTACK_REFLEXION_CORPUS_SCALAR_SEQUENCE',
  'KSTACK_REFLEXION_CORPUS_SCALAR_LIMIT', 'KSTACK_REFLEXION_CORPUS_NORMALIZED_TOKEN_LIMIT',
  'KSTACK_REFLEXION_CORPUS_NORMALIZED_UTF8_LIMIT', 'KSTACK_REFLEXION_CORPUS_ALIAS_FLOOR',
  'KSTACK_REFLEXION_CORPUS_DUPLICATE_ID'
]);

function fixedError(code, metadata = null) {
  const error = new Error(code);
  error.code = code;
  if (metadata) error.metadata = Object.freeze(metadata);
  return error;
}

export function parseReflexionArgs(argv) {
  const [command = 'lookup', ...rest] = argv;
  const args = { command, approved: new Set(), all: false, 'verbose-evidence': false };
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith('--') || item === '--') throw fixedError('KSTACK_REFLEXION_ARGUMENT_INVALID');
    const key = item.slice(2);
    if (seen.has(key)) throw fixedError('KSTACK_REFLEXION_ARGUMENT_INVALID');
    seen.add(key);
    if (['all', 'verbose-evidence', 'dry-run', 'diagnose-current', 'emit-digest', 'migrate-kstack-mode'].includes(key)) {
      args[key] = true;
      continue;
    }
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) throw fixedError('KSTACK_REFLEXION_ARGUMENT_INVALID');
    args[key] = value;
    index += 1;
  }
  if (typeof args.approved === 'string') args.approved = new Set(args.approved.split(',').map((value) => value.trim()).filter(Boolean));
  return Object.freeze(args);
}

function ensureAuthority(state, action, approved) {
  const policy = state.config.authority[action];
  if (policy === 'deny') throw fixedError(`KSTACK_REFLEXION_AUTHORITY_${action.toUpperCase()}_DENIED`);
  if (policy === 'ask' && !approved.has(action)) throw fixedError(`KSTACK_REFLEXION_AUTHORITY_${action.toUpperCase()}_APPROVAL_REQUIRED`);
}

function loadState(args, { mutation = false } = {}) {
  const initialCwd = process.cwd();
  const defaulted = typeof args['project-root'] !== 'string';
  const selected = defaulted ? initialCwd : path.resolve(initialCwd, args['project-root']);
  const location = resolveProjectCorpus(selected, { mutation });
  const configPath = typeof args.config === 'string' ? path.resolve(initialCwd, args.config) : path.join(location.rootReal, '.kstack', 'config.json');
  let config;
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { throw fixedError('KSTACK_REFLEXION_CONFIG_INVALID'); }
  if (validateConfig(config).length) throw fixedError('KSTACK_REFLEXION_CONFIG_INVALID');
  return Object.freeze({ config, configPath, projectRoot: location.rootReal, location, projectRootDefaulted: defaulted });
}

function requiredText(value, code) {
  if (typeof value !== 'string' || !value.trim() || !isWellFormedScalarString(value)) throw fixedError(code);
  return value.trim().replace(/\s+/gu, ' ');
}

function detectorPlaceholder(value, field) {
  const findings = scanTextForSecrets(value);
  if (!findings.length) return { value, redacted: false };
  const classes = [...new Set(findings)].sort().join(', ').slice(0, 256);
  return { value: field === 'rule' ? `ALWAYS [REDACTED secret-bearing rule: ${classes}]` : `[REDACTED secret-bearing ${field}: ${classes}]`, redacted: true };
}

function parseLookupKeywords(raw) {
  if (typeof raw !== 'string') throw fixedError('KSTACK_REFLEXION_LOOKUP_KEYWORDS_REQUIRED');
  if (scanTextForSecrets(raw).length) throw fixedError('KSTACK_REFLEXION_LOOKUP_SECRET');
  const positions = raw.split(',');
  if (positions.length > 32) throw fixedError('KSTACK_REFLEXION_LOOKUP_KEYWORD_LIMIT');
  const originals = [];
  const normalizedSeen = new Set();
  for (const position of positions) {
    const value = position.trim();
    if (!value) continue;
    if (!isWellFormedScalarString(value)) throw fixedError('KSTACK_REFLEXION_LOOKUP_SCALAR_SEQUENCE');
    if (scalarLength(value) > 160) throw fixedError('KSTACK_REFLEXION_LOOKUP_SCALAR_LIMIT');
    if (scanTextForSecrets(value).length) throw fixedError('KSTACK_REFLEXION_LOOKUP_SECRET');
    const normalized = normalizeMatchValue(value);
    if (scanTextForSecrets(normalized).length) throw fixedError('KSTACK_REFLEXION_LOOKUP_SECRET');
    if (!normalized) continue;
    if (normalized.split(' ').length > 160 || Buffer.byteLength(normalized) > 10_240) throw fixedError('KSTACK_REFLEXION_LOOKUP_NORMALIZED_LIMIT');
    if (!normalizedSeen.has(normalized)) { normalizedSeen.add(normalized); originals.push(value); }
  }
  if (originals.length === 0) throw fixedError('KSTACK_REFLEXION_LOOKUP_NO_TOKENS');
  return originals;
}

function parseSignature(raw, code = 'KSTACK_REFLEXION_RECORD_SIGNATURE_INVALID') {
  if (typeof raw !== 'string') throw fixedError(code);
  const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
  if (values.length === 0 || values.length > 32) throw fixedError(code);
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (!isWellFormedScalarString(value) || scalarLength(value) > 160) throw fixedError(code);
    const normalized = normalizeMatchValue(value);
    if (!normalized || normalized.split(' ').length > 160 || Buffer.byteLength(normalized) > 10_240) throw fixedError(code);
    if (!seen.has(normalized)) { seen.add(normalized); result.push(value); }
  }
  return result;
}

function projectActorLesson(lesson, redactions) {
  const rule = detectorPlaceholder(lesson.rule, 'rule');
  const why = detectorPlaceholder(lesson.why, 'why');
  if (rule.redacted) redactions.count += 1;
  if (why.redacted) redactions.count += 1;
  if (rule.redacted || why.redacted) redactions.lessons.add(lesson.id);
  return { rule: rule.value, why: why.value, immutable: { rule: rule.redacted, why: why.redacted } };
}

function redactionWarning(redactions) {
  if (redactions.count === 0) return null;
  return Object.freeze({ kind: 'operator-warning-v1', modelContextEligible: false, bytes: `KSTACK_REFLEXION_REDACTION_V1 redactedFieldCount=${redactions.count} affectedLessonCount=${redactions.lessons.size}\n` });
}

function chooseProjectionPlaceholder(values) {
  return [...values].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))[0];
}

function buildVerboseEvidenceProjector(matched, redactions) {
  const projectedIds = new Map();
  const projectedValues = new Map();
  const projectedTokens = new Map();
  const countSlot = (lessonId, result) => {
    if (!result.redacted) return;
    redactions.count += 1;
    redactions.lessons.add(lessonId);
  };
  for (const ranked of matched.ranked) {
    const lesson = ranked.lesson;
    const usedTokens = new Set(ranked.evidence.filter((item) => item.tier === 'lexical-token').map((item) => `${item.source}\0${item.token}`));
    const idResult = detectorPlaceholder(lesson.id, 'evidence');
    countSlot(lesson.id, idResult);
    projectedIds.set(lesson.id, idResult.value);
    for (const source of ['applicabilityPhrases', 'taskSignature']) {
      const originalsByCanonical = new Map();
      for (const original of lesson[source]) {
        const result = detectorPlaceholder(original, 'evidence');
        countSlot(lesson.id, result);
        const canonical = normalizeMatchValue(original);
        if (!originalsByCanonical.has(canonical)) originalsByCanonical.set(canonical, []);
        if (result.redacted) originalsByCanonical.get(canonical).push(result.value);
      }
      for (const [canonical, contributingHits] of originalsByCanonical) {
        const own = detectorPlaceholder(canonical, 'evidence');
        const taint = own.redacted || contributingHits.length > 0;
        const candidates = [...contributingHits, ...(own.redacted ? [own.value] : [])];
        const value = taint ? chooseProjectionPlaceholder(candidates) : canonical;
        if (taint) { redactions.count += 1; redactions.lessons.add(lesson.id); }
        projectedValues.set(`${lesson.id}\0${source}\0${canonical}`, value);
        for (const token of canonical.split(' ')) {
          if (!usedTokens.has(`${source}\0${token}`)) continue;
          const key = `${lesson.id}\0${source}\0${token}`;
          const tokenOwn = detectorPlaceholder(token, 'evidence');
          const tokenTaint = tokenOwn.redacted || taint;
          const tokenCandidates = [...(tokenOwn.redacted ? [tokenOwn.value] : []), ...(taint ? [value] : [])];
          const existing = projectedTokens.get(key);
          if (!existing) {
            if (tokenTaint) { redactions.count += 1; redactions.lessons.add(lesson.id); }
            projectedTokens.set(key, { tainted: tokenTaint, value: tokenTaint ? chooseProjectionPlaceholder(tokenCandidates) : token });
          } else if (tokenTaint) {
            if (!existing.tainted) { redactions.count += 1; redactions.lessons.add(lesson.id); }
            existing.tainted = true;
            existing.value = chooseProjectionPlaceholder([existing.value, ...tokenCandidates]);
          }
        }
      }
    }
  }
  return (value, slot = {}) => {
    if (slot.field === 'lessonId') return projectedIds.get(slot.lessonId) ?? value;
    if (slot.field === 'lessonValue') return projectedValues.get(`${slot.lessonId}\0${slot.source}\0${value}`) ?? value;
    if (slot.field === 'token') return projectedTokens.get(`${slot.lessonId}\0${slot.source}\0${value}`)?.value ?? value;
    return value;
  };
}

function lookup(state, args) {
  ensureAuthority(state, 'inspect', args.approved);
  const keywords = parseLookupKeywords(args.keywords);
  const lessons = readValidatedCorpus(state.location, { retry: true });
  const matched = matchLessons(lessons, keywords, { all: args.all });
  const redactions = { count: 0, lessons: new Set() };
  const actor = renderActorReference(matched, (lesson) => projectActorLesson(lesson, redactions));
  if (!isPromptReferenceAllowed(actor)) throw fixedError('KSTACK_INTERNAL_ACTOR_BLOCK_INVARIANT');
  let evidence = null;
  if (args['verbose-evidence']) {
    evidence = renderEvidenceReport(matched, buildVerboseEvidenceProjector(matched, redactions));
  }
  return Object.freeze({ actor, evidence, warning: redactionWarning(redactions), matched });
}

function recordAlias(state, args) {
  ensureAuthority(state, 'edit', args.approved);
  const lessonId = requiredText(args.alias, 'KSTACK_REFLEXION_ALIAS_ID_REQUIRED');
  const phrase = requiredText(args.phrase, 'KSTACK_REFLEXION_ALIAS_PHRASE_INVALID');
  if (scalarLength(phrase) > 160 || scanTextForSecrets(phrase).length) throw fixedError('KSTACK_REFLEXION_ALIAS_PHRASE_INVALID');
  const normalized = normalizeMatchValue(phrase);
  const tokens = normalized ? normalized.split(' ') : [];
  const lmnScalars = [...normalized].filter((scalar) => /[\p{L}\p{M}\p{N}]/u.test(scalar)).length;
  if (!normalized || (tokens.length < 2 && lmnScalars < 6)) throw fixedError('KSTACK_REFLEXION_ALIAS_FLOOR');
  let updated;
  const installed = mutateValidatedCorpus(state.location, (lessons) => {
    const matches = lessons.filter((lesson) => lesson.id === lessonId);
    if (matches.length !== 1) throw fixedError('KSTACK_REFLEXION_ALIAS_NOT_FOUND');
    const lesson = matches[0];
    if (lesson.applicabilityPhrases.length >= 16) throw fixedError('KSTACK_REFLEXION_ALIAS_CARDINALITY');
    const existing = [...lesson.taskSignature, ...lesson.applicabilityPhrases].map(normalizeMatchValue);
    if (existing.includes(normalized)) throw fixedError('KSTACK_REFLEXION_ALIAS_DUPLICATE');
    lesson.applicabilityPhrases.push(phrase);
    updated = lesson;
    return lessons;
  });
  return Object.freeze({ kind: 'record-alias-v1', status: 'added', lessonCount: installed.length, lessonId: updated.id });
}

function ingestIntoMemory(state, lesson) {
  if (!state.config.memory?.enabled) return { status: 'disabled' };
  if (state.config.memory.trust !== 'read-write') return { status: 'skipped', reason: `memory.trust is ${state.config.memory.trust}` };
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-reflexion-'));
  const sourceFile = path.join(temporaryDirectory, 'lesson.json');
  try {
    fs.writeFileSync(sourceFile, `${JSON.stringify(lesson, null, 2)}\n`, { mode: 0o600 });
    const memoryScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'kstack-memory.mjs');
    const environment = { ...process.env };
    for (const name of DENIED_ENVIRONMENT) delete environment[name];
    const result = spawnSync(process.execPath, [memoryScript, 'ingest', '--config', state.configPath, '--source', sourceFile, '--kind', 'reflexion-lesson', '--title', `Reflexion lesson ${lesson.id}`, '--origin', state.location.corpusPath], { cwd: state.projectRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, shell: false, env: environment });
    if (result.status !== 0) return { status: 'failed' };
    return { status: 'ingested', result: JSON.parse(result.stdout) };
  } finally {
    try { fs.unlinkSync(sourceFile); } catch {}
    try { fs.rmdirSync(temporaryDirectory); } catch {}
  }
}

function record(state, args) {
  if (args.alias !== undefined) return recordAlias(state, args);
  ensureAuthority(state, 'edit', args.approved);
  const taskSignature = parseSignature(args['task-signature']);
  const rawRule = requiredText(args.rule, 'KSTACK_REFLEXION_RECORD_RULE_INVALID');
  if (!/^(ALWAYS|NEVER)\b/u.test(rawRule)) throw fixedError('KSTACK_REFLEXION_RECORD_RULE_INVALID');
  const rule = detectorPlaceholder(rawRule, 'rule').value;
  const why = detectorPlaceholder(requiredText(args.why, 'KSTACK_REFLEXION_RECORD_WHY_INVALID'), 'why').value;
  const sourceFailure = detectorPlaceholder(requiredText(args['source-failure'], 'KSTACK_REFLEXION_RECORD_SOURCE_FAILURE_INVALID'), 'source failure').value;
  let lesson;
  let status;
  const installed = mutateValidatedCorpus(state.location, (lessons) => {
    const createdAt = new Date().toISOString();
    const existing = lessons.find((item) => item.rule === rule);
    if (existing) {
      const known = new Set(existing.taskSignature.map(normalizeMatchValue));
      for (const signature of taskSignature) if (!known.has(normalizeMatchValue(signature))) existing.taskSignature.push(signature);
      if (existing.taskSignature.length > 32) throw fixedError('KSTACK_REFLEXION_RECORD_SIGNATURE_LIMIT');
      existing.createdAt = createdAt;
      existing.occurrences += 1;
      lesson = existing;
      status = 'updated';
    } else {
      lesson = { id: crypto.randomUUID(), createdAt, taskSignature, applicabilityPhrases: [], rule, why, sourceFailure, occurrences: 1, promotedToClaudeMd: false };
      lessons.push(lesson);
      status = 'recorded';
    }
    return lessons;
  });
  const memoryIngest = status === 'recorded' ? ingestIntoMemory(state, lesson) : { status: 'not-needed' };
  return Object.freeze({ status, lessonCount: installed.length, lesson, memoryIngest });
}

function promoteCheck(state, args) {
  ensureAuthority(state, 'inspect', args.approved);
  const lessons = readValidatedCorpus(state.location, { retry: true });
  const redactions = { count: 0, lessons: new Set() };
  const candidates = lessons.filter((lesson) => lesson.occurrences >= 2 && !lesson.promotedToClaudeMd).map((lesson) => {
    const projected = {};
    const before = redactions.count;
    for (const field of ['id', 'createdAt']) {
      const result = detectorPlaceholder(lesson[field], field); projected[field] = categoricalEncode(result.value); if (result.redacted) redactions.count += 1;
    }
    for (const field of ['taskSignature', 'applicabilityPhrases']) projected[field] = lesson[field].map((value) => { const result = detectorPlaceholder(value, field); if (result.redacted) redactions.count += 1; return categoricalEncode(result.value); });
    for (const field of ['rule', 'why', 'sourceFailure']) { const result = detectorPlaceholder(lesson[field], field); projected[field] = categoricalEncode(result.value); if (result.redacted) redactions.count += 1; }
    if (redactions.count > before) redactions.lessons.add(lesson.id);
    return { ...projected, occurrences: lesson.occurrences, promotedToClaudeMd: lesson.promotedToClaudeMd };
  });
  return Object.freeze({ output: { kind: 'promote-check-v1', candidateCount: candidates.length, candidates }, warning: redactionWarning(redactions) });
}

function markPromoted(state, args) {
  ensureAuthority(state, 'edit', args.approved);
  const id = requiredText(args['lesson-id'], 'KSTACK_REFLEXION_MARK_NOT_FOUND');
  const installed = mutateValidatedCorpus(state.location, (lessons) => {
    const lesson = lessons.find((item) => item.id === id);
    if (!lesson) throw fixedError('KSTACK_REFLEXION_MARK_NOT_FOUND');
    if (lesson.occurrences < 2) throw fixedError('KSTACK_REFLEXION_MARK_NOT_ELIGIBLE');
    if (lesson.promotedToClaudeMd) throw fixedError('KSTACK_REFLEXION_MARK_ALREADY_PROMOTED');
    lesson.promotedToClaudeMd = true;
    return lessons;
  });
  return { kind: 'mark-promoted-v1', status: 'marked', lessonCount: installed.length, promotedLessonCount: installed.filter((lesson) => lesson.promotedToClaudeMd).length };
}

function repair(state, args) {
  if (args['migrate-kstack-mode']) { ensureAuthority(state, 'edit', args.approved); return migrateKstackMode(state.location, { dryRun: args['dry-run'] }); }
  if (args.candidate !== undefined) {
    ensureAuthority(state, 'edit', args.approved);
    if (args['diagnose-current'] || args['emit-digest'] || typeof args['expect-current'] !== 'string') throw fixedError('KSTACK_REFLEXION_REPAIR_GRAMMAR');
    const digestRequired = args['expect-current'] === 'valid' || REPAIR_CORPUS_EXPECTATIONS.has(args['expect-current']);
    if (!digestRequired && !REPAIR_ENDPOINT_EXPECTATIONS.has(args['expect-current'])) throw fixedError('KSTACK_REFLEXION_REPAIR_GRAMMAR');
    const digest = args['expect-sha256'];
    if ((digestRequired && (typeof digest !== 'string' || !/^[0-9A-Fa-f]{64}$/u.test(digest))) || (!digestRequired && digest !== undefined)) throw fixedError('KSTACK_REFLEXION_REPAIR_GRAMMAR');
    const installed = repairCorpusFromCandidate(state.location, { candidatePath: args.candidate, expectCurrent: args['expect-current'], expectSha256: digest?.toLowerCase() });
    return { kind: 'repair-v1', status: 'installed', lessonCount: installed.length, promotedLessonCount: installed.filter((lesson) => lesson.promotedToClaudeMd).length };
  }
  if (!args['diagnose-current']) throw fixedError('KSTACK_REFLEXION_REPAIR_GRAMMAR');
  if (args['emit-digest']) ensureAuthority(state, 'edit', args.approved); else ensureAuthority(state, 'inspect', args.approved);
  const diagnosis = diagnoseCurrentCorpus(state.location);
  const { expectCurrent, bytes } = diagnosis;
  if (!args['emit-digest']) return { kind: 'repair-diagnosis-v1', expectCurrent };
  const output = { kind: 'operator-digest-v1', modelContextEligible: false, statusKind: 'repair-diagnosis-v1', expectCurrent };
  if (bytes && (expectCurrent === 'valid' || expectCurrent.startsWith('KSTACK_REFLEXION_CORPUS_'))) output.expectSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  return { operatorDigest: Object.freeze({ kind: 'operator-digest-v1', modelContextEligible: false, bytes: `${JSON.stringify(output)}\n` }) };
}

export function runReflexionCommand(args) {
  const mutation = args.command === 'record' || args.command === 'mark-promoted' || (args.command === 'repair' && (args.candidate !== undefined || args['migrate-kstack-mode']));
  const state = loadState(args, { mutation });
  switch (args.command) {
    case 'lookup': return lookup(state, args);
    case 'record': return record(state, args);
    case 'promote-check': return promoteCheck(state, args);
    case 'mark-promoted': return markPromoted(state, args);
    case 'repair': return repair(state, args);
    default: throw fixedError('KSTACK_REFLEXION_COMMAND_INVALID');
  }
}

function runtimeFields() {
  return { node: process.versions.node.match(/^\d+\.\d+/u)?.[0], v8: process.versions.v8.match(/^\d+\.\d+/u)?.[0], icu: process.versions.icu?.match(/^\d+\.\d+/u)?.[0], unicode: process.versions.unicode, icuSmall: process.config.variables.icu_small, v8I18n: process.config.variables.v8_enable_i18n_support, platform: process.platform, arch: process.arch };
}

function assertRuntimeTuple() {
  const fields = runtimeFields();
  if (fields.node !== '24.12' || fields.v8 !== '13.6' || fields.icu !== '77.1' || fields.unicode !== '16.0' || fields.icuSmall !== false || fields.v8I18n !== 1 || fields.platform === 'win32' || process.execArgv.length !== 0 || DENIED_ENVIRONMENT.some((name) => process.env[name] !== undefined) || '\uFDFA'.normalize('NFKC').toLowerCase().length !== 18 || Buffer.byteLength('\uFDFA'.normalize('NFKC').toLowerCase()) !== 33 || '\u0130'.normalize('NFKC').toLowerCase() !== 'i\u0307') throw fixedError('KSTACK_REFLEXION_RUNTIME_MISMATCH');
  return fields;
}

function contractBytes(fields) {
  const lines = ['KSTACK_REFLEXION_RUNTIME_CONTRACT_V1', `revision=${CONTRACT_REVISION}`, `node=${fields.node}`, `v8=${fields.v8}`, `icu=${fields.icu}`, `unicode=${fields.unicode}`, `icuSmall=${fields.icuSmall}`, `v8I18n=${fields.v8I18n}`, `platform=${fields.platform}`, `arch=${fields.arch}`, 'execArgv=[]', `conditions=${CONDITION_IDENTIFIER}`, `resolverProbeSha256=${RESOLVER_PROBE_IDENTIFIER}`, `unicodeProbeSha256=${UNICODE_PROBE_IDENTIFIER}`, 'nfkcLowerFdFA=33:18', 'dottedI=0069-0307'];
  return Buffer.from(`${lines.join('\n')}\n`, 'ascii');
}

function parseContract(bytes) {
  if (bytes.length > 4_096 || bytes.some((byte) => byte > 0x7f) || bytes.at(-1) !== 0x0a) throw fixedError('KSTACK_REFLEXION_CONTRACT_STALE');
  const lines = bytes.toString('ascii').slice(0, -1).split('\n');
  if (lines.shift() !== 'KSTACK_REFLEXION_RUNTIME_CONTRACT_V1') throw fixedError('KSTACK_REFLEXION_CONTRACT_STALE');
  const expectedKeys = ['revision','node','v8','icu','unicode','icuSmall','v8I18n','platform','arch','execArgv','conditions','resolverProbeSha256','unicodeProbeSha256','nfkcLowerFdFA','dottedI'];
  const values = {};
  if (lines.length !== expectedKeys.length) throw fixedError('KSTACK_REFLEXION_CONTRACT_STALE');
  for (let index = 0; index < lines.length; index += 1) { const prefix = `${expectedKeys[index]}=`; if (!lines[index].startsWith(prefix)) throw fixedError('KSTACK_REFLEXION_CONTRACT_STALE'); values[expectedKeys[index]] = lines[index].slice(prefix.length); }
  if (values.revision !== CONTRACT_REVISION || values.conditions !== CONDITION_IDENTIFIER || values.resolverProbeSha256 !== RESOLVER_PROBE_IDENTIFIER || values.unicodeProbeSha256 !== UNICODE_PROBE_IDENTIFIER || values.nfkcLowerFdFA !== '33:18' || values.dottedI !== '0069-0307') throw fixedError('KSTACK_REFLEXION_CONTRACT_STALE');
  return values;
}

function readRuntimeContract(installedRoot, ignoreSentinel = false) {
  const parent = path.join(installedRoot, '.codex-plugin');
  if (!ignoreSentinel) {
    try { fs.lstatSync(path.join(parent, SENTINEL_BASENAME)); throw fixedError('KSTACK_REFLEXION_CONTRACT_ABSENT'); } catch (error) { if (error.code === 'KSTACK_REFLEXION_CONTRACT_ABSENT') throw error; if (error.code !== 'ENOENT') throw fixedError('KSTACK_REFLEXION_CONTRACT_ABSENT'); }
  }
  const artifact = path.join(parent, CONTRACT_BASENAME);
  let fd;
  let primary;
  try {
    fd = fs.openSync(artifact, fs.constants.O_RDONLY | NOFOLLOW);
    const before = fs.fstatSync(fd, { bigint: true });
    if (!before.isFile() || before.size > 4_096n || before.dev === 0n || before.ino === 0n) throw fixedError('KSTACK_REFLEXION_CONTRACT_IO');
    const bytes = fs.readFileSync(fd);
    if (bytes.length !== Number(before.size)) throw fixedError('KSTACK_REFLEXION_CONTRACT_IO');
    const after = fs.fstatSync(fd, { bigint: true });
    const pathname = fs.lstatSync(artifact, { bigint: true });
    if (after.dev !== before.dev || after.ino !== before.ino || pathname.dev !== before.dev || pathname.ino !== before.ino || !pathname.isFile() || pathname.isSymbolicLink()) throw fixedError('KSTACK_REFLEXION_CONTRACT_IO');
    return parseContract(bytes);
  } catch (error) {
    primary = error;
    if (error.code === 'ENOENT') throw fixedError('KSTACK_REFLEXION_CONTRACT_ABSENT');
    if (error.code?.startsWith?.('KSTACK_REFLEXION_CONTRACT_')) throw error;
    throw fixedError('KSTACK_REFLEXION_CONTRACT_IO');
  } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { if (!primary) throw fixedError('KSTACK_REFLEXION_CONTRACT_IO'); } }
}

function admitRuntimeContract(installedRoot) {
  const values = readRuntimeContract(installedRoot);
  const fields = assertRuntimeTuple();
  const compared = { node: fields.node, v8: fields.v8, icu: fields.icu, unicode: fields.unicode, icuSmall: String(fields.icuSmall), v8I18n: String(fields.v8I18n), platform: fields.platform, arch: fields.arch, execArgv: '[]' };
  if (Object.entries(compared).some(([key, value]) => values[key] !== value)) throw fixedError('KSTACK_REFLEXION_RUNTIME_MISMATCH');
}

function fsyncDirectory(directory) { const fd = fs.openSync(directory, fs.constants.O_RDONLY | DIRECTORY | NOFOLLOW); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }

async function generateRuntimeContract(installedRoot) {
  try { invalidateRuntimeContract(installedRoot); } catch (error) {
    if (error instanceof UnavailableSentinelError) { process.stderr.write(formatUnavailableSentinelError(error)); process.exitCode = 73; return null; }
    throw error;
  }
  const fields = assertRuntimeTuple();
  const conformance = await runResolverConformance(path.join(installedRoot, 'scripts', 'reflexion-architecture', 'resolver-driver.mjs'));
  if (conformance.resolverProbeSha256 !== RESOLVER_PROBE_IDENTIFIER || conformance.unicodeProbeSha256 !== UNICODE_PROBE_IDENTIFIER) throw fixedError('KSTACK_REFLEXION_RUNTIME_MISMATCH');
  const parent = path.join(installedRoot, '.codex-plugin');
  const artifact = path.join(parent, CONTRACT_BASENAME);
  const temporary = path.join(parent, `.${CONTRACT_BASENAME}.${process.pid}.${crypto.randomUUID()}.tmp`);
  let fd;
  try {
    const bytes = contractBytes(fields); parseContract(bytes);
    fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o600);
    fs.fchmodSync(fd, 0o600); fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    fs.renameSync(temporary, artifact); fsyncDirectory(parent);
    if (readRuntimeContract(installedRoot, true).revision !== CONTRACT_REVISION) throw fixedError('KSTACK_REFLEXION_CONTRACT_STALE');
    removeUnavailableSentinel(installedRoot);
    return { kind: 'runtime-contract-v1', status: 'generated' };
  } catch (error) {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
    try { fs.unlinkSync(temporary); } catch {}
    if (error instanceof UnavailableSentinelError) process.stderr.write(formatUnavailableSentinelError(error));
    try { invalidateRuntimeContract(installedRoot); } catch {}
    throw error;
  }
}

function canonicalPathClass(argv1, moduleUrlValue) {
  if (typeof argv1 !== 'string' || !argv1 || typeof moduleUrlValue !== 'string' || !moduleUrlValue.startsWith('file:')) return 'unknown';
  try { const cwd = process.cwd(); return fs.realpathSync.native(fileURLToPath(moduleUrlValue)) === fs.realpathSync.native(path.resolve(cwd, argv1)) ? 'direct' : 'proved-imported'; } catch { return 'unknown'; }
}

export function decideStartup(entryValue, argv1, moduleUrlValue) {
  const pathClass = canonicalPathClass(argv1, moduleUrlValue);
  const entryKind = entryValue === true ? 'boolean-true' : entryValue === false ? 'boolean-false' : 'non-boolean';
  const action = entryValue === true ? (pathClass === 'proved-imported' ? 'entry-mismatch' : 'dispatch') : (pathClass === 'proved-imported' ? 'silent-import' : 'entry-mismatch');
  return Object.freeze({ action, entryKind, pathClass });
}

function installedRootForModule(moduleUrlValue) { return path.dirname(path.dirname(fs.realpathSync.native(fileURLToPath(moduleUrlValue)))); }

function bootstrapRoot(argv, moduleUrlValue) {
  if (argv.length !== 3 || argv[0] !== 'runtime-contract-generate' || argv[1] !== '--installed-plugin-root' || !path.isAbsolute(argv[2])) return null;
  if (process.execArgv.length !== 0) return false;
  try {
    const root = fs.realpathSync.native(argv[2]);
    if (root !== path.resolve(argv[2]) || installedRootForModule(moduleUrlValue) !== root) return false;
    for (const relative of ['scripts/kstack-reflexion.mjs', 'scripts/reflexion-architecture/resolver-driver.mjs', 'scripts/reflexion/unavailable-sentinel.mjs']) { const target = fs.realpathSync.native(path.join(root, relative)); const stat = fs.lstatSync(target); if (!stat.isFile() || stat.isSymbolicLink() || path.relative(root, target).startsWith('..')) return false; }
    return root;
  } catch { return false; }
}

export function enactStartupDecision(decision, effects) {
  if (!effects || Object.keys(effects).join(',') !== 'main,writeStderr,setExitCode') throw new TypeError('invalid startup effects');
  if (decision.action === 'silent-import') return;
  if (decision.action === 'entry-mismatch') { effects.writeStderr('KSTACK_REFLEXION_ENTRY_MISMATCH\n'); effects.setExitCode(1); return; }
  if (DENIED_ENVIRONMENT.some((name) => process.env[name] !== undefined)) { effects.writeStderr('KSTACK_REFLEXION_ENVIRONMENT_DENIED\n'); effects.setExitCode(1); return; }
  if (process.platform === 'win32') { effects.writeStderr('KSTACK_REFLEXION_PLATFORM_UNSUPPORTED\n'); effects.setExitCode(1); return; }
  const argv = process.argv.slice(2);
  const bootstrap = bootstrapRoot(argv, moduleUrl);
  if (bootstrap === false) { effects.writeStderr('KSTACK_REFLEXION_BOOTSTRAP_INVALID\n'); effects.setExitCode(1); return; }
  if (bootstrap === null) { try { admitRuntimeContract(installedRootForModule(moduleUrl)); } catch (error) { effects.writeStderr(`${error.code ?? 'KSTACK_REFLEXION_CONTRACT_IO'}\n`); effects.setExitCode(1); return; } }
  effects.main(argv, bootstrap);
}

function writeCommandResult(result, defaultWarning = null) {
  if (result?.actor) { process.stdout.write(`${result.actor.bytes}\n`); if (result.evidence) process.stderr.write(result.evidence.bytes); if (result.warning) process.stderr.write(result.warning.bytes); }
  else if (result?.operatorDigest) process.stderr.write(result.operatorDigest.bytes);
  else if (result?.output) { process.stdout.write(`${JSON.stringify(result.output)}\n`); if (result.warning) process.stderr.write(result.warning.bytes); }
  else process.stdout.write(`${JSON.stringify(result)}\n`);
  if (defaultWarning) process.stderr.write(defaultWarning);
}

async function main(argv, bootstrapRootValue = null) {
  if (bootstrapRootValue) {
    try {
      const generated = await generateRuntimeContract(bootstrapRootValue);
      if (generated) process.stdout.write(`${JSON.stringify(generated)}\n`);
    } catch (error) {
      if (!(error instanceof UnavailableSentinelError)) process.stderr.write(`${error.code ?? 'KSTACK_REFLEXION_CONTRACT_ABSENT'}\n`);
      process.exitCode = process.exitCode || 1;
    }
    return;
  }
  try {
    const args = parseReflexionArgs(argv);
    const result = runReflexionCommand(args);
    writeCommandResult(result, args['project-root'] === undefined ? 'KSTACK_REFLEXION_PROJECT_ROOT_DEFAULTED_V1 migration=explicit-project-root removal=next-major-not-before-2027-02-23\n' : null);
  } catch (error) {
    process.stderr.write(error.code === 'KSTACK_REFLEXION_LOCK_TIMEOUT' ? formatLockTimeoutDiagnosis(error) : `${error.code ?? 'KSTACK_REFLEXION_INTERNAL'}\n`);
    process.exitCode = 2;
  }
}

const entryValue = import.meta.main;
const moduleUrl = import.meta.url;
const argv1 = process.argv[1];
const startupDecision = decideStartup(entryValue, argv1, moduleUrl);
await enactStartupDecision(startupDecision, { main, writeStderr: (bytes) => process.stderr.write(bytes), setExitCode: (code) => { process.exitCode = code; } });
