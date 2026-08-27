import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalBytes, sha256 } from './kstack-panel-core.mjs';

const catalogDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'personas');
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const projectRecordKeys = new Set([
  'id', 'version', 'owner', 'purpose', 'methods', 'evidenceNeeds',
  'epistemicLimits', 'highStakes', 'reviewedOn', 'expiresOn', 'revoked',
  'replacesDigest', 'body'
]);

const baseDefinitions = Object.freeze([
  Object.freeze({
    id: 'security-engineer', version: 1, owner: 'KStack',
    purpose: 'Threat-model systems, abuse paths, trust boundaries, and verifiable controls.',
    methods: ['STRIDE', 'abuse-cases', 'attack-trees', 'control-verification'],
    evidenceNeeds: ['system-boundary', 'assets', 'data-flows', 'trust-boundaries', 'deployment-assumptions'],
    epistemicLimits: ['No claim that an untested design is secure.', 'Missing architecture is requested rather than invented.'],
    highStakes: true, reviewedOn: '2026-08-24', expiresOn: '2026-11-22', revoked: false,
    bodyFile: 'security-engineer.md'
  }),
  Object.freeze({
    id: 'resilience-expert', version: 1, owner: 'KStack',
    purpose: 'Analyze failure propagation, graceful degradation, recovery, and operational evidence.',
    methods: ['FMEA', 'fault-trees', 'SLO-RPO-RTO', 'chaos-and-restore-testing'],
    evidenceNeeds: ['critical-journeys', 'dependency-map', 'state-ownership', 'recovery-objectives'],
    epistemicLimits: ['Availability and recoverability claims require test evidence.', 'Unknown dependencies are treated as risks.'],
    highStakes: false, reviewedOn: '2026-08-24', expiresOn: '2027-02-20', revoked: false,
    bodyFile: 'resilience-expert.md'
  }),
  Object.freeze({
    id: 'compliance-auditor', version: 1, owner: 'KStack',
    purpose: 'Trace scoped obligations to controls, evidence, tests, exceptions, and accountable owners.',
    methods: ['requirement-evidence-test-chain', 'scope-and-applicability', 'control-effectiveness'],
    evidenceNeeds: ['authoritative-framework-version', 'scope', 'assessment-period', 'control-evidence'],
    epistemicLimits: ['Not legal advice, certification, attestation, or an audit opinion.', 'Framework applicability is never assumed.'],
    highStakes: true, reviewedOn: '2026-08-24', expiresOn: '2026-11-22', revoked: false,
    bodyFile: 'compliance-auditor.md'
  }),
  Object.freeze({
    id: 'news-article-journalist', version: 1, owner: 'KStack',
    purpose: 'Produce accurate, fair, well-attributed journalism without manufacturing reporting.',
    methods: ['source-ledger', 'fact-checking', 'lede-and-nut-graf', 'right-of-reply'],
    evidenceNeeds: ['audience-and-format', 'reporting-cutoff', 'sources', 'corroboration'],
    epistemicLimits: ['No invented facts, quotations, sources, reactions, or outreach.', 'Publication and browsing authority are never granted.'],
    highStakes: false, reviewedOn: '2026-08-24', expiresOn: '2027-02-20', revoked: false,
    bodyFile: 'news-article-journalist.md'
  })
]);

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  throw error;
}

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('PERSONA_RECORD_INVALID');
  if (Object.keys(value).length !== keys.size || Object.keys(value).some((key) => !keys.has(key))) fail('PERSONA_RECORD_UNKNOWN_OR_MISSING_FIELD');
}

function assertDate(value, key) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) fail('PERSONA_DATE_INVALID', key);
}

function finalize(record, origin, now) {
  if (typeof record.id !== 'string' || record.id.length > 63 || !idPattern.test(record.id)) fail('PERSONA_ID_INVALID');
  if (!Number.isInteger(record.version) || record.version < 1) fail('PERSONA_VERSION_INVALID');
  for (const key of ['owner', 'purpose', 'body']) if (typeof record[key] !== 'string' || record[key].length === 0 || !record[key].isWellFormed()) fail('PERSONA_TEXT_INVALID', key);
  for (const key of ['methods', 'evidenceNeeds', 'epistemicLimits']) {
    if (!Array.isArray(record[key]) || record[key].length === 0 || !record[key].every((item) => typeof item === 'string' && item.length > 0 && item.isWellFormed())) fail('PERSONA_LIST_INVALID', key);
  }
  if (typeof record.highStakes !== 'boolean' || typeof record.revoked !== 'boolean') fail('PERSONA_STATE_INVALID');
  assertDate(record.reviewedOn, 'reviewedOn');
  assertDate(record.expiresOn, 'expiresOn');
  if (record.revoked) fail('PERSONA_REVOKED', record.id);
  const today = now.toISOString().slice(0, 10);
  if (record.expiresOn < today) fail('PERSONA_EXPIRED', record.id);
  const body = record.body.normalize('NFC');
  const bodyDigest = sha256(Buffer.from(body, 'utf8'));
  const effective = {
    schemaVersion: 'kstack-panel-persona-v1', id: record.id, version: record.version,
    origin, owner: record.owner.normalize('NFC'), purpose: record.purpose.normalize('NFC'),
    methods: record.methods.map((item) => item.normalize('NFC')),
    evidenceNeeds: record.evidenceNeeds.map((item) => item.normalize('NFC')),
    epistemicLimits: record.epistemicLimits.map((item) => item.normalize('NFC')),
    highStakes: record.highStakes, reviewedOn: record.reviewedOn, expiresOn: record.expiresOn,
    revoked: false, replacesDigest: record.replacesDigest ?? null, body, bodyDigest
  };
  return Object.freeze({ ...effective, effectiveDigest: sha256(canonicalBytes(effective)) });
}

function loadBase(now) {
  const result = new Map();
  for (const definition of baseDefinitions) {
    const bodyPath = path.join(catalogDirectory, definition.bodyFile);
    const stat = fs.lstatSync(bodyPath);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('PERSONA_BASE_FILE_INVALID', definition.id);
    const { bodyFile: _bodyFile, ...record } = definition;
    result.set(record.id, finalize({ ...record, replacesDigest: null, body: fs.readFileSync(bodyPath, 'utf8') }, 'kstack-default', now));
  }
  return result;
}

export function loadPersonaCatalog(projectRoot, options = {}) {
  const now = options.now ?? new Date();
  if (!(now instanceof Date) || Number.isNaN(now.valueOf())) fail('PERSONA_NOW_INVALID');
  const catalog = loadBase(now);
  const relativeDirectory = options.projectPersonaDirectory ?? '.kstack/personas';
  if (typeof relativeDirectory !== 'string' || path.isAbsolute(relativeDirectory)) fail('PERSONA_DIRECTORY_INVALID');
  const root = fs.realpathSync(path.resolve(projectRoot));
  const directory = path.resolve(root, relativeDirectory);
  const relative = path.relative(root, directory);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) fail('PERSONA_DIRECTORY_ESCAPE');
  if (!fs.existsSync(directory)) return catalog;
  const directoryStat = fs.lstatSync(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) fail('PERSONA_DIRECTORY_INVALID');
  const files = fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort();
  for (const name of files) {
    const file = path.join(directory, name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) fail('PERSONA_PROJECT_FILE_INVALID', name);
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    exactKeys(record, projectRecordKeys);
    const prior = catalog.get(record.id);
    if (prior) {
      if (record.replacesDigest !== prior.effectiveDigest) fail('PERSONA_REPLACEMENT_DIGEST_MISMATCH', record.id);
    } else if (record.replacesDigest !== null) fail('PERSONA_ADDITION_REPLACEMENT_FORBIDDEN', record.id);
    catalog.set(record.id, finalize(record, 'project', now));
  }
  const folded = new Set();
  for (const id of catalog.keys()) {
    const key = id.toLowerCase();
    if (folded.has(key)) fail('PERSONA_CASE_COLLISION');
    folded.add(key);
  }
  return catalog;
}

export function resolvePanelPersonas(panelDefinition, catalog) {
  const resolved = new Map();
  for (const slot of [...panelDefinition.requiredVoters, ...panelDefinition.advisers]) {
    const persona = catalog.get(slot.personaId);
    if (!persona) fail('PANEL_PERSONA_NOT_FOUND', slot.personaId);
    resolved.set(slot.slotId, persona);
  }
  return resolved;
}

export function defaultPersonaIds() {
  return baseDefinitions.map((item) => item.id);
}

