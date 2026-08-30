import crypto from 'node:crypto';
import { confirmTrustedTimeBinding } from './kstack-domain-time-binding.mjs';

export const D5_SCHEMA_TYPES = Object.freeze([
  'kstack-pack-activation-receipt',
  'kstack-pack-activation-request',
  'kstack-pack-approval-assertion',
  'kstack-pack-bundle-index',
  'kstack-pack-catalog-snapshot',
  'kstack-pack-compatibility-entry',
  'kstack-pack-content',
  'kstack-pack-contract-policy',
  'kstack-pack-evidence-schema',
  'kstack-pack-manifest',
  'kstack-pack-operation-inventory',
  'kstack-pack-quarantine-record',
  'kstack-pack-review-assertion',
  'kstack-pack-source-provenance',
  'kstack-pack-tombstone',
  'kstack-validator-identity'
]);

const PACK_IDS = Object.freeze(['assurance', 'product-experience', 'release-operations', 'research-knowledge']);
const COVERAGE_VALUES = Object.freeze([
  'accessibility', 'citation', 'compliance', 'control-evidence', 'decision-record',
  'developer-experience', 'documentation', 'health-evidence', 'incident-record',
  'privacy', 'product-premise', 'release-ledger', 'release-readiness', 'resilience',
  'rollback-evidence', 'security', 'source-quality', 'synthesis', 'user-journey'
]);
const APPLIES_TO_VALUES = Object.freeze(['design', 'implementation-plan', 'incident', 'objective', 'qc', 'release-observation', 'release-plan']);
export const PACK_ARTIFACT_CLASSES = Object.freeze([
  'design-brief', 'implementation-plan', 'incident-handoff', 'qc-report',
  'release-observation', 'release-plan', 'rollback-plan'
]);
const ANSWER_KINDS = Object.freeze(['list-evidence', 'status-evidence', 'yes-no-evidence']);
const SOURCE_CLASSES = Object.freeze(['github-record', 'health-observation', 'human-attestation', 'jira-record', 'qualified-citation', 'repository-artifact', 'rollback-receipt', 'workflow-receipt']);
const OBSERVATION_KINDS = Object.freeze(['absence', 'asserts', 'refutes', 'unavailable']);
const FRESHNESS_POLICY_IDS = Object.freeze(['release-immediate', 'release-window', 'repository-snapshot', 'timeless-digest']);
const LIMITS = Object.freeze({
  maxPackBytes: 16_384, maxCombinedPackBytes: 32_768, maxSections: 64,
  maxQuestionsPerSection: 64, maxEvidencePerQuestion: 32, maxRequirements: 2_048,
  maxStringUtf8Bytes: 4_096, maxArrayItems: 2_048, maxObjectProperties: 64,
  maxFixtureFiles: 4_096, maxFixtureFileBytes: 1_048_576, maxBundleBytes: 8_388_608
});

export const PACK_CONTRACT_POLICY = deepFreeze({
  artifactType: 'kstack-pack-contract-policy', schemaVersion: 1,
  packIds: PACK_IDS, coverageValues: COVERAGE_VALUES,
  appliesToValues: APPLIES_TO_VALUES, answerKinds: ANSWER_KINDS,
  sourceClasses: SOURCE_CLASSES, observationKinds: OBSERVATION_KINDS,
  freshnessPolicyIds: FRESHNESS_POLICY_IDS, limits: LIMITS
});

const DIGEST = /^[a-f0-9]{64}$/u;
const LOWER_ID = /^[a-z][a-z0-9-]{0,63}$/u;
const GENERAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const SEMVER = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const SAFE_PATH_COMPONENT = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const TEXT_CONTROL_OR_BIDI = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const MAX_DOCUMENT_BYTES = 1024 * 1024;
const MAX_DEPTH = 32;
const VALIDATED_REGISTRIES = new WeakSet();
const VALIDATED_CATALOG_GRAPHS = new WeakSet();

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function deepFreeze(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function exact(value, keys, code) {
  const actual = plain(value) ? Object.keys(value).sort(compareUtf8) : [];
  const expected = [...keys].sort(compareUtf8);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}

function checkedString(value, expression, code, maximumBytes = LIMITS.maxStringUtf8Bytes, text = false) {
  if (typeof value !== 'string' || !value.isWellFormed() || value.normalize('NFC') !== value
      || Buffer.byteLength(value, 'utf8') < 1 || Buffer.byteLength(value, 'utf8') > maximumBytes
      || (text ? TEXT_CONTROL_OR_BIDI : CONTROL_OR_BIDI).test(value) || !expression.test(value)) fail(code);
  return value;
}

function digest(value, code) {
  return checkedString(value, DIGEST, code, 64);
}

function sameDigest(left, right, code) {
  const a = Buffer.from(digest(left, code), 'hex');
  const b = Buffer.from(digest(right, code), 'hex');
  if (!crypto.timingSafeEqual(a, b)) fail(code);
}

function integer(value, minimum, maximum, code) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) fail(code);
  return value;
}

function bool(value, code) {
  if (typeof value !== 'boolean') fail(code);
  return value;
}

function instant(value, code) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail(code);
  try { if (new Date(value).toISOString() !== value) fail(code); } catch { fail(code); }
  return value;
}

function exactArray(value, expected, code) {
  if (!Array.isArray(value) || value.length !== expected.length
      || value.some((entry, index) => entry !== expected[index])) fail(code);
  return [...value];
}

function sortedSubset(values, allowed, code, allowEmpty = false, maximum = allowed.length) {
  if (!Array.isArray(values) || values.length > maximum || (!allowEmpty && values.length === 0)) fail(code);
  if (values.some((entry) => typeof entry !== 'string' || !allowed.includes(entry))) fail(code);
  const sorted = [...values].sort(compareUtf8);
  if (new Set(values).size !== values.length || values.some((entry, index) => entry !== sorted[index])) fail(code);
  return [...values];
}

function encodeString(value) {
  if (typeof value !== 'string' || !value.isWellFormed() || value.normalize('NFC') !== value) fail('PACK_CANONICAL_STRING_INVALID');
  let output = '"';
  for (const scalar of value) {
    const point = scalar.codePointAt(0);
    if (scalar === '"') output += '\\"';
    else if (scalar === '\\') output += '\\\\';
    else if (point === 0x08) output += '\\b';
    else if (point === 0x09) output += '\\t';
    else if (point === 0x0a) output += '\\n';
    else if (point === 0x0c) output += '\\f';
    else if (point === 0x0d) output += '\\r';
    else if (point <= 0x1f) output += `\\u00${point.toString(16).padStart(2, '0')}`;
    else output += scalar;
  }
  return `${output}"`;
}

function encodeValue(value, depth, ancestors) {
  if (depth > MAX_DEPTH) fail('PACK_CANONICAL_DEPTH_EXCEEDED');
  if (value === null) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value === 'string') return encodeString(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) fail('PACK_CANONICAL_INTEGER_INVALID');
    return String(value);
  }
  if (!value || typeof value !== 'object' || ancestors.has(value)) fail('PACK_CANONICAL_VALUE_INVALID');
  ancestors.add(value);
  let output;
  if (Array.isArray(value)) {
    if (value.length > LIMITS.maxArrayItems || Object.keys(value).length !== value.length) fail('PACK_CANONICAL_ARRAY_INVALID');
    output = `[${value.map((entry) => encodeValue(entry, depth + 1, ancestors)).join(',')}]`;
  } else {
    if (!plain(value) || Object.keys(value).length > LIMITS.maxObjectProperties) fail('PACK_CANONICAL_OBJECT_INVALID');
    const keys = Object.keys(value).sort(compareUtf8);
    output = `{${keys.map((key) => `${encodeString(key)}:${encodeValue(value[key], depth + 1, ancestors)}`).join(',')}}`;
  }
  ancestors.delete(value);
  return output;
}

export function packCanonicalBytes(value) {
  const output = Buffer.from(encodeValue(value, 0, new Set()), 'utf8');
  if (output.length > MAX_DOCUMENT_BYTES) fail('PACK_CANONICAL_DOCUMENT_EXCEEDED');
  return output;
}

class PackJsonParser {
  constructor(text) { this.text = text; this.offset = 0; }

  parse() {
    const value = this.value(0);
    if (this.offset !== this.text.length) fail('PACK_CANONICAL_JSON_INVALID');
    return value;
  }

  value(depth) {
    if (depth > MAX_DEPTH) fail('PACK_CANONICAL_DEPTH_EXCEEDED');
    const token = this.text[this.offset];
    if (token === '{') return this.object(depth);
    if (token === '[') return this.array(depth);
    if (token === '"') return this.string();
    if (token === 't') return this.literal('true', true);
    if (token === 'f') return this.literal('false', false);
    if (token === 'n') return this.literal('null', null);
    if (token >= '0' && token <= '9') return this.number();
    fail('PACK_CANONICAL_JSON_INVALID');
  }

  literal(token, value) {
    if (this.text.slice(this.offset, this.offset + token.length) !== token) fail('PACK_CANONICAL_JSON_INVALID');
    this.offset += token.length;
    return value;
  }

  object(depth) {
    this.offset += 1;
    const output = {};
    const keys = new Set();
    if (this.text[this.offset] === '}') { this.offset += 1; return output; }
    while (true) {
      if (keys.size >= LIMITS.maxObjectProperties || this.text[this.offset] !== '"') fail('PACK_CANONICAL_JSON_INVALID');
      const key = this.string();
      if (keys.has(key)) fail('PACK_CANONICAL_DUPLICATE_KEY');
      keys.add(key);
      if (this.text[this.offset++] !== ':') fail('PACK_CANONICAL_JSON_INVALID');
      Object.defineProperty(output, key, { value: this.value(depth + 1), enumerable: true, configurable: true, writable: true });
      const separator = this.text[this.offset++];
      if (separator === '}') return output;
      if (separator !== ',') fail('PACK_CANONICAL_JSON_INVALID');
    }
  }

  array(depth) {
    this.offset += 1;
    const output = [];
    if (this.text[this.offset] === ']') { this.offset += 1; return output; }
    while (true) {
      if (output.length >= LIMITS.maxArrayItems) fail('PACK_CANONICAL_JSON_INVALID');
      output.push(this.value(depth + 1));
      const separator = this.text[this.offset++];
      if (separator === ']') return output;
      if (separator !== ',') fail('PACK_CANONICAL_JSON_INVALID');
    }
  }

  string() {
    this.offset += 1;
    let output = '';
    while (this.offset < this.text.length) {
      const character = this.text[this.offset++];
      if (character === '"') {
        if (!output.isWellFormed() || output.normalize('NFC') !== output
            || Buffer.byteLength(output, 'utf8') > LIMITS.maxStringUtf8Bytes) fail('PACK_CANONICAL_STRING_INVALID');
        return output;
      }
      if (character.charCodeAt(0) <= 0x1f) fail('PACK_CANONICAL_JSON_INVALID');
      if (character !== '\\') { output += character; continue; }
      const escaped = this.text[this.offset++];
      if (escaped === '"' || escaped === '\\') output += escaped;
      else if (escaped === 'b') output += '\b';
      else if (escaped === 't') output += '\t';
      else if (escaped === 'n') output += '\n';
      else if (escaped === 'f') output += '\f';
      else if (escaped === 'r') output += '\r';
      else if (escaped === 'u') output += this.unicodeEscape();
      else fail('PACK_CANONICAL_JSON_INVALID');
    }
    fail('PACK_CANONICAL_JSON_INVALID');
  }

  unicodeEscape() {
    const first = this.hexUnit();
    if (first >= 0xdc00 && first <= 0xdfff) fail('PACK_CANONICAL_JSON_INVALID');
    if (first < 0xd800 || first > 0xdbff) return String.fromCharCode(first);
    if (this.text[this.offset] !== '\\' || this.text[this.offset + 1] !== 'u') fail('PACK_CANONICAL_JSON_INVALID');
    this.offset += 2;
    const second = this.hexUnit();
    if (second < 0xdc00 || second > 0xdfff) fail('PACK_CANONICAL_JSON_INVALID');
    return String.fromCodePoint(0x10000 + ((first - 0xd800) << 10) + second - 0xdc00);
  }

  hexUnit() {
    const token = this.text.slice(this.offset, this.offset + 4);
    if (!/^[0-9a-f]{4}$/u.test(token)) fail('PACK_CANONICAL_JSON_INVALID');
    this.offset += 4;
    return Number.parseInt(token, 16);
  }

  number() {
    const token = /^(?:0|[1-9][0-9]*)/u.exec(this.text.slice(this.offset))?.[0];
    if (!token) fail('PACK_CANONICAL_INTEGER_INVALID');
    this.offset += token.length;
    let value;
    try { value = BigInt(token); } catch { fail('PACK_CANONICAL_INTEGER_INVALID'); }
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail('PACK_CANONICAL_INTEGER_INVALID');
    return Number(value);
  }
}

export function parsePackCanonicalJson(input) {
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array) || input.length > MAX_DOCUMENT_BYTES) fail('PACK_CANONICAL_INPUT_INVALID');
  const bytes = Buffer.from(input);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) fail('PACK_CANONICAL_INPUT_INVALID');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail('PACK_CANONICAL_INPUT_INVALID'); }
  const value = new PackJsonParser(text).parse();
  if (!packCanonicalBytes(value).equals(bytes)) fail('PACK_CANONICAL_NONCANONICAL');
  return value;
}

function domainDigest(domain, value) {
  return crypto.createHash('sha256').update(Buffer.from(domain, 'utf8')).update(packCanonicalBytes(value)).digest('hex');
}

function rawDomainDigest(domain, bytes) {
  return crypto.createHash('sha256').update(Buffer.from(domain, 'utf8')).update(bytes).digest('hex');
}

function rawDigest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function d5DomainPrefix(artifactType) {
  if (!D5_SCHEMA_TYPES.includes(artifactType)) fail('PACK_SCHEMA_TYPE_INVALID');
  return `KSTACK-${artifactType.slice('kstack-'.length).toUpperCase()}-V1\n`;
}

export function packArtifactDigest(record) {
  if (!plain(record) || !D5_SCHEMA_TYPES.includes(record.artifactType)) fail('PACK_SCHEMA_TYPE_INVALID');
  return domainDigest(d5DomainPrefix(record.artifactType), record);
}

function artifactResult(record) {
  return deepFreeze({ record, canonicalBytes: packCanonicalBytes(record), artifactDigest: packArtifactDigest(record) });
}

export function validatePackContractPolicy(input) {
  const code = 'PACK_CONTRACT_POLICY_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'packIds', 'coverageValues', 'appliesToValues', 'answerKinds', 'sourceClasses', 'observationKinds', 'freshnessPolicyIds', 'limits'], code);
  if (input.artifactType !== 'kstack-pack-contract-policy' || input.schemaVersion !== 1) fail(code);
  exact(input.limits, Object.keys(LIMITS), code);
  for (const [key, value] of Object.entries(LIMITS)) if (input.limits[key] !== value) fail(code);
  return deepFreeze({
    artifactType: input.artifactType, schemaVersion: 1,
    packIds: exactArray(input.packIds, PACK_IDS, code),
    coverageValues: exactArray(input.coverageValues, COVERAGE_VALUES, code),
    appliesToValues: exactArray(input.appliesToValues, APPLIES_TO_VALUES, code),
    answerKinds: exactArray(input.answerKinds, ANSWER_KINDS, code),
    sourceClasses: exactArray(input.sourceClasses, SOURCE_CLASSES, code),
    observationKinds: exactArray(input.observationKinds, OBSERVATION_KINDS, code),
    freshnessPolicyIds: exactArray(input.freshnessPolicyIds, FRESHNESS_POLICY_IDS, code),
    limits: { ...LIMITS }
  });
}

export function createPackContractPolicy() {
  return artifactResult(validatePackContractPolicy(PACK_CONTRACT_POLICY));
}

export function validatePackManifest(input) {
  const code = 'PACK_MANIFEST_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'id', 'version', 'title', 'purpose', 'coverage', 'contentDigest', 'evidenceSchemaDigest', 'fixturesDigest', 'maxUtf8Bytes'], code);
  if (input.artifactType !== 'kstack-pack-manifest' || input.schemaVersion !== 1 || !PACK_IDS.includes(input.id)) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1, id: input.id,
    version: checkedString(input.version, SEMVER, code, 128),
    title: checkedString(input.title, /^.{1,}$/u, code, 256, true),
    purpose: checkedString(input.purpose, /^.{1,}$/u, code, LIMITS.maxStringUtf8Bytes, true),
    coverage: sortedSubset(input.coverage, COVERAGE_VALUES, code),
    contentDigest: digest(input.contentDigest, code), evidenceSchemaDigest: digest(input.evidenceSchemaDigest, code),
    fixturesDigest: digest(input.fixturesDigest, code), maxUtf8Bytes: integer(input.maxUtf8Bytes, 1, LIMITS.maxPackBytes, code)
  };
}

function validateQuestion(input, code) {
  exact(input, ['id', 'text', 'answerKind', 'evidenceIds'], code);
  if (!ANSWER_KINDS.includes(input.answerKind) || !Array.isArray(input.evidenceIds)
      || input.evidenceIds.length > LIMITS.maxEvidencePerQuestion) fail(code);
  const evidenceIds = input.evidenceIds.map((entry) => checkedString(entry, LOWER_ID, code, 64));
  if (new Set(evidenceIds).size !== evidenceIds.length) fail(code);
  return {
    id: checkedString(input.id, LOWER_ID, code, 64),
    text: checkedString(input.text, /^.{1,}$/su, code, LIMITS.maxStringUtf8Bytes, true),
    answerKind: input.answerKind, evidenceIds
  };
}

export function validatePackContent(input) {
  const code = 'PACK_CONTENT_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'sections'], code);
  if (input.artifactType !== 'kstack-pack-content' || input.schemaVersion !== 1
      || !Array.isArray(input.sections) || input.sections.length < 1 || input.sections.length > LIMITS.maxSections) fail(code);
  const sections = input.sections.map((section) => {
    exact(section, ['id', 'appliesTo', 'questions'], code);
    if (!Array.isArray(section.questions) || section.questions.length < 1 || section.questions.length > LIMITS.maxQuestionsPerSection) fail(code);
    const questions = section.questions.map((question) => validateQuestion(question, code));
    if (new Set(questions.map((question) => question.id)).size !== questions.length) fail(code);
    return {
      id: checkedString(section.id, LOWER_ID, code, 64),
      appliesTo: sortedSubset(section.appliesTo, APPLIES_TO_VALUES, code), questions
    };
  });
  if (new Set(sections.map((section) => section.id)).size !== sections.length) fail(code);
  return { artifactType: input.artifactType, schemaVersion: 1, sections };
}

export function validatePackEvidenceSchema(input) {
  const code = 'PACK_EVIDENCE_SCHEMA_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'requirements'], code);
  if (input.artifactType !== 'kstack-pack-evidence-schema' || input.schemaVersion !== 1
      || !Array.isArray(input.requirements) || input.requirements.length < 1 || input.requirements.length > LIMITS.maxRequirements) fail(code);
  const requirements = input.requirements.map((requirement) => {
    exact(requirement, ['evidenceId', 'allowedSourceClasses', 'allowedObservationKinds', 'minimumCount', 'maximumCount', 'freshnessPolicyId', 'requiredFor'], code);
    const minimumCount = integer(requirement.minimumCount, 0, LIMITS.maxEvidencePerQuestion, code);
    const maximumCount = integer(requirement.maximumCount, 0, LIMITS.maxEvidencePerQuestion, code);
    if (minimumCount > maximumCount || !FRESHNESS_POLICY_IDS.includes(requirement.freshnessPolicyId)) fail(code);
    return {
      evidenceId: checkedString(requirement.evidenceId, LOWER_ID, code, 64),
      allowedSourceClasses: sortedSubset(requirement.allowedSourceClasses, SOURCE_CLASSES, code),
      allowedObservationKinds: sortedSubset(requirement.allowedObservationKinds, OBSERVATION_KINDS, code),
      minimumCount, maximumCount, freshnessPolicyId: requirement.freshnessPolicyId,
      requiredFor: sortedSubset(requirement.requiredFor, ['contradicted', 'supported'], code)
    };
  });
  if (new Set(requirements.map((entry) => entry.evidenceId)).size !== requirements.length) fail(code);
  return { artifactType: input.artifactType, schemaVersion: 1, requirements };
}

function validateContentEvidenceGraph(content, evidenceSchema) {
  const code = 'PACK_CONTENT_EVIDENCE_GRAPH_INVALID';
  const requirements = new Set(evidenceSchema.requirements.map((entry) => entry.evidenceId));
  const referenced = new Set();
  for (const section of content.sections) for (const question of section.questions) for (const evidenceId of question.evidenceIds) {
    if (!requirements.has(evidenceId)) fail(code);
    referenced.add(evidenceId);
  }
  if (referenced.size !== requirements.size) fail(code);
}

function safeRelativePath(value, code, fixtureRelative = false) {
  checkedString(value, /^[a-z0-9._/-]+$/u, code, 240);
  const parts = value.split('/');
  if (parts.length < 1 || parts.length > 8 || parts.some((part) => !SAFE_PATH_COMPONENT.test(part)
      || ['con', 'prn', 'aux', 'nul'].includes(part.toLowerCase())
      || /^(?:com|lpt)[1-9](?:\.|$)/iu.test(part) || part.endsWith('.') || part.endsWith(' '))) fail(code);
  if (fixtureRelative && parts[0] === 'fixtures') fail(code);
  return value;
}

function openedFile(input, code, fixtureRelative = false) {
  exact(input, ['relativePath', 'bytes', 'regular', 'linkCount', 'identityStable'], code);
  if ((!Buffer.isBuffer(input.bytes) && !(input.bytes instanceof Uint8Array))
      || input.bytes.length > LIMITS.maxFixtureFileBytes || input.regular !== true
      || input.linkCount !== 1 || input.identityStable !== true) fail(code);
  return { relativePath: safeRelativePath(input.relativePath, code, fixtureRelative), bytes: Buffer.from(input.bytes) };
}

function frameFile(entry) {
  const pathBytes = Buffer.from(entry.relativePath, 'utf8');
  const pathLength = Buffer.alloc(4); pathLength.writeUInt32BE(pathBytes.length);
  const contentLength = Buffer.alloc(8); contentLength.writeBigUInt64BE(BigInt(entry.bytes.length));
  return Buffer.concat([pathLength, pathBytes, contentLength, Buffer.from(rawDigest(entry.bytes), 'hex')]);
}

export function packFileSetDigest(domain, files) {
  const code = 'PACK_FILE_SET_INVALID';
  checkedString(domain, /^[A-Z][A-Z0-9-]{0,127}$/u, code, 128);
  if (!Array.isArray(files) || files.length < 1 || files.length > LIMITS.maxFixtureFiles + 3) fail(code);
  const sorted = files.map((entry) => ({ relativePath: safeRelativePath(entry.relativePath, code), bytes: Buffer.from(entry.bytes) }))
    .sort((a, b) => compareUtf8(a.relativePath, b.relativePath));
  if (new Set(sorted.map((entry) => entry.relativePath)).size !== sorted.length) fail(code);
  const count = Buffer.alloc(4); count.writeUInt32BE(sorted.length);
  return crypto.createHash('sha256').update(Buffer.from(`${domain}\n`, 'utf8')).update(count)
    .update(Buffer.concat(sorted.map(frameFile))).digest('hex');
}

function validateBundleIndex(input) {
  const code = 'PACK_BUNDLE_INDEX_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'packId', 'version', 'manifestDigest', 'contentDigest', 'evidenceSchemaDigest', 'fixturesDigest', 'orderedFiles', 'bundleDigestAlgorithm'], code);
  if (input.artifactType !== 'kstack-pack-bundle-index' || input.schemaVersion !== 1
      || !PACK_IDS.includes(input.packId) || input.bundleDigestAlgorithm !== 'kstack-pack-file-set-v1'
      || !Array.isArray(input.orderedFiles) || input.orderedFiles.length < 4 || input.orderedFiles.length > LIMITS.maxFixtureFiles + 3) fail(code);
  const orderedFiles = input.orderedFiles.map((entry) => {
    exact(entry, ['relativePath', 'byteLength', 'contentSha256'], code);
    return {
      relativePath: safeRelativePath(entry.relativePath, code),
      byteLength: integer(entry.byteLength, 0, LIMITS.maxFixtureFileBytes, code),
      contentSha256: digest(entry.contentSha256, code)
    };
  });
  const sorted = [...orderedFiles].sort((a, b) => compareUtf8(a.relativePath, b.relativePath));
  if (new Set(orderedFiles.map((entry) => entry.relativePath)).size !== orderedFiles.length
      || orderedFiles.some((entry, index) => entry.relativePath !== sorted[index].relativePath)) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1, packId: input.packId,
    version: checkedString(input.version, SEMVER, code, 128), manifestDigest: digest(input.manifestDigest, code),
    contentDigest: digest(input.contentDigest, code), evidenceSchemaDigest: digest(input.evidenceSchemaDigest, code),
    fixturesDigest: digest(input.fixturesDigest, code), orderedFiles, bundleDigestAlgorithm: input.bundleDigestAlgorithm
  };
}

function parseValidated(bytes, validator, expectedType, code) {
  let value;
  try { value = parsePackCanonicalJson(bytes); } catch { fail(code); }
  if (value.artifactType !== expectedType) fail(code);
  const record = validator(value);
  if (!packCanonicalBytes(record).equals(Buffer.from(bytes))) fail(code);
  return artifactResult(record);
}

export function validatePackBundle(input) {
  const code = 'PACK_BUNDLE_INVALID';
  exact(input, ['manifestBytes', 'contentBytes', 'evidenceSchemaBytes', 'fixtureFiles', 'bundleIndexBytes'], code);
  const manifest = parseValidated(input.manifestBytes, validatePackManifest, 'kstack-pack-manifest', code);
  const content = parseValidated(input.contentBytes, validatePackContent, 'kstack-pack-content', code);
  const evidenceSchema = parseValidated(input.evidenceSchemaBytes, validatePackEvidenceSchema, 'kstack-pack-evidence-schema', code);
  const bundleIndex = parseValidated(input.bundleIndexBytes, validateBundleIndex, 'kstack-pack-bundle-index', code);
  validateContentEvidenceGraph(content.record, evidenceSchema.record);
  if (!Array.isArray(input.fixtureFiles) || input.fixtureFiles.length < 1 || input.fixtureFiles.length > LIMITS.maxFixtureFiles) fail(code);
  const fixtures = input.fixtureFiles.map((entry) => openedFile(entry, code, true));
  const fixtureKeys = fixtures.map((entry) => entry.relativePath.toLowerCase());
  if (new Set(fixtureKeys).size !== fixtures.length) fail(code);
  const fixturesDigest = packFileSetDigest('KSTACK-PACK-FIXTURES-V1', fixtures);
  const bundleFiles = [
    { relativePath: 'manifest.json', bytes: manifest.canonicalBytes },
    { relativePath: 'content.json', bytes: content.canonicalBytes },
    { relativePath: 'evidence.schema.json', bytes: evidenceSchema.canonicalBytes },
    ...fixtures.map((entry) => ({ relativePath: `fixtures/${entry.relativePath}`, bytes: entry.bytes }))
  ];
  const totalBytes = bundleFiles.reduce((sum, entry) => sum + entry.bytes.length, 0);
  if (totalBytes > LIMITS.maxBundleBytes || content.canonicalBytes.length > manifest.record.maxUtf8Bytes) fail(code);
  const bundleDigest = packFileSetDigest('KSTACK-PACK-BUNDLE-V1', bundleFiles);
  sameDigest(manifest.record.contentDigest, content.artifactDigest, code);
  sameDigest(manifest.record.evidenceSchemaDigest, evidenceSchema.artifactDigest, code);
  sameDigest(manifest.record.fixturesDigest, fixturesDigest, code);
  if (bundleIndex.record.packId !== manifest.record.id || bundleIndex.record.version !== manifest.record.version) fail(code);
  for (const [actual, expected] of [
    [bundleIndex.record.manifestDigest, manifest.artifactDigest],
    [bundleIndex.record.contentDigest, content.artifactDigest],
    [bundleIndex.record.evidenceSchemaDigest, evidenceSchema.artifactDigest],
    [bundleIndex.record.fixturesDigest, fixturesDigest]
  ]) sameDigest(actual, expected, code);
  const expectedFiles = bundleFiles.sort((a, b) => compareUtf8(a.relativePath, b.relativePath)).map((entry) => ({
    relativePath: entry.relativePath, byteLength: entry.bytes.length, contentSha256: rawDigest(entry.bytes)
  }));
  if (!packCanonicalBytes(bundleIndex.record.orderedFiles).equals(packCanonicalBytes(expectedFiles))) fail(code);
  return deepFreeze({
    manifest, content, evidenceSchema, bundleIndex, fixturesDigest, bundleDigest,
    bundleFiles: expectedFiles, totalBytes
  });
}

function validateValidatorIdentity(input) {
  const code = 'PACK_VALIDATOR_IDENTITY_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'contractVersion', 'canonicalizerVersion',
    'schemaDigest', 'contractPolicyDigest', 'sourceRoot', 'sourceFileSetDigest',
    'dependencyLockPath', 'dependencyLockDigest', 'buildRecipePath',
    'buildRecipeDigest', 'targetPlatform', 'executableArtifactDigest'
  ], code);
  if (input.artifactType !== 'kstack-validator-identity' || input.schemaVersion !== 1
      || input.contractVersion !== 1 || input.canonicalizerVersion !== 1) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1, contractVersion: 1, canonicalizerVersion: 1,
    schemaDigest: digest(input.schemaDigest, code), contractPolicyDigest: digest(input.contractPolicyDigest, code),
    sourceRoot: safeRelativePath(input.sourceRoot, code), sourceFileSetDigest: digest(input.sourceFileSetDigest, code),
    dependencyLockPath: safeRelativePath(input.dependencyLockPath, code), dependencyLockDigest: digest(input.dependencyLockDigest, code),
    buildRecipePath: safeRelativePath(input.buildRecipePath, code), buildRecipeDigest: digest(input.buildRecipeDigest, code),
    targetPlatform: checkedString(input.targetPlatform, /^[a-z0-9][a-z0-9._-]{0,127}$/u, code, 128),
    executableArtifactDigest: digest(input.executableArtifactDigest, code)
  };
}

function validateCompatibilityEntry(input) {
  const code = 'PACK_COMPATIBILITY_ENTRY_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'packId', 'version', 'bundleDigest',
    'manifestDigest', 'contentDigest', 'evidenceSchemaDigest', 'fixturesDigest',
    'bundleIndexDigest', 'packContractVersion', 'schemaRegistryDigest',
    'contractPolicyDigest', 'composerImplementationDigest',
    'validatorIdentityDigests', 'kernelSchemaDigest', 'baseLaneContractDigest', 'status'
  ], code);
  if (input.artifactType !== 'kstack-pack-compatibility-entry' || input.schemaVersion !== 1
      || !PACK_IDS.includes(input.packId) || input.packContractVersion !== 1
      || !['compatible', 'incompatible'].includes(input.status)) fail(code);
  const validatorIdentityDigests = Array.isArray(input.validatorIdentityDigests)
    ? input.validatorIdentityDigests.map((entry) => {
      exact(entry, ['targetPlatform', 'validatorIdentityDigest'], code);
      return {
        targetPlatform: checkedString(entry.targetPlatform, /^[a-z0-9][a-z0-9._-]{0,127}$/u, code, 128),
        validatorIdentityDigest: digest(entry.validatorIdentityDigest, code)
      };
    }) : fail(code);
  const targets = validatorIdentityDigests.map((entry) => entry.targetPlatform);
  if (targets.length < 1 || new Set(targets).size !== targets.length
      || targets.some((target, index) => target !== [...targets].sort(compareUtf8)[index])) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1, packId: input.packId,
    version: checkedString(input.version, SEMVER, code, 128),
    bundleDigest: digest(input.bundleDigest, code), manifestDigest: digest(input.manifestDigest, code),
    contentDigest: digest(input.contentDigest, code), evidenceSchemaDigest: digest(input.evidenceSchemaDigest, code),
    fixturesDigest: digest(input.fixturesDigest, code), bundleIndexDigest: digest(input.bundleIndexDigest, code),
    packContractVersion: 1, schemaRegistryDigest: digest(input.schemaRegistryDigest, code),
    contractPolicyDigest: digest(input.contractPolicyDigest, code),
    composerImplementationDigest: digest(input.composerImplementationDigest, code),
    validatorIdentityDigests, kernelSchemaDigest: digest(input.kernelSchemaDigest, code),
    baseLaneContractDigest: digest(input.baseLaneContractDigest, code), status: input.status
  };
}

const AVAILABLE_KEYS = Object.freeze([
  'packId', 'state', 'version', 'bundleDigest', 'manifestDigest', 'contentDigest',
  'evidenceSchemaDigest', 'fixturesDigest', 'bundleIndexDigest',
  'sourceProvenanceDigest', 'reviewArtifactDigest', 'approvalArtifactDigest',
  'compatibilityEntryDigest'
]);

function validateCatalogEntry(input) {
  const code = 'PACK_CATALOG_SNAPSHOT_INVALID';
  if (!plain(input) || !PACK_IDS.includes(input.packId)) fail(code);
  if (input.state === 'roadmap-only') {
    exact(input, ['packId', 'state'], code);
    return { packId: input.packId, state: input.state };
  }
  const quarantined = input.state === 'quarantined';
  if (input.state !== 'available' && !quarantined) fail(code);
  exact(input, quarantined ? [...AVAILABLE_KEYS, 'quarantineRecordDigest'] : AVAILABLE_KEYS, code);
  const result = {
    packId: input.packId, state: input.state,
    version: checkedString(input.version, SEMVER, code, 128),
    bundleDigest: digest(input.bundleDigest, code), manifestDigest: digest(input.manifestDigest, code),
    contentDigest: digest(input.contentDigest, code), evidenceSchemaDigest: digest(input.evidenceSchemaDigest, code),
    fixturesDigest: digest(input.fixturesDigest, code), bundleIndexDigest: digest(input.bundleIndexDigest, code),
    sourceProvenanceDigest: digest(input.sourceProvenanceDigest, code),
    reviewArtifactDigest: digest(input.reviewArtifactDigest, code), approvalArtifactDigest: digest(input.approvalArtifactDigest, code),
    compatibilityEntryDigest: digest(input.compatibilityEntryDigest, code)
  };
  if (quarantined) result.quarantineRecordDigest = digest(input.quarantineRecordDigest, code);
  return result;
}

export function validatePackCatalogSnapshot(input) {
  const code = 'PACK_CATALOG_SNAPSHOT_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'contractVersion', 'generation',
    'predecessorSnapshotDigest', 'schemaRegistryDigest', 'contractPolicyDigest',
    'catalogEntries', 'compatibilityEntries', 'applicabilityEntries'
  ], code);
  if (input.artifactType !== 'kstack-pack-catalog-snapshot' || input.schemaVersion !== 1
      || input.contractVersion !== 1 || !Array.isArray(input.catalogEntries)
      || input.catalogEntries.length !== PACK_IDS.length || !Array.isArray(input.compatibilityEntries)
      || !Array.isArray(input.applicabilityEntries) || input.applicabilityEntries.length > LIMITS.maxSections * PACK_IDS.length) fail(code);
  const catalogEntries = input.catalogEntries.map(validateCatalogEntry);
  if (catalogEntries.some((entry, index) => entry.packId !== PACK_IDS[index])) fail(code);
  const compatibilityEntries = input.compatibilityEntries.map(validateCompatibilityEntry);
  const bundleDigests = compatibilityEntries.map((entry) => entry.bundleDigest);
  if (new Set(bundleDigests).size !== bundleDigests.length
      || bundleDigests.some((entry, index) => entry !== [...bundleDigests].sort(compareUtf8)[index])) fail(code);
  const materialEntries = catalogEntries.filter((entry) => entry.state !== 'roadmap-only');
  if (materialEntries.length !== compatibilityEntries.length) fail(code);
  for (const catalog of materialEntries) {
    const compatibility = compatibilityEntries.find((entry) => entry.bundleDigest === catalog.bundleDigest);
    if (!compatibility || compatibility.packId !== catalog.packId || compatibility.version !== catalog.version
        || compatibility.status !== 'compatible') fail(code);
    for (const key of ['manifestDigest', 'contentDigest', 'evidenceSchemaDigest', 'fixturesDigest', 'bundleIndexDigest']) {
      sameDigest(catalog[key], compatibility[key], code);
    }
    sameDigest(catalog.compatibilityEntryDigest, packArtifactDigest(compatibility), code);
  }
  const applicabilityEntries = input.applicabilityEntries.map((entry) => {
    exact(entry, ['packMaterialDigest', 'sectionId', 'artifactClasses'], code);
    return {
      packMaterialDigest: digest(entry.packMaterialDigest, code),
      sectionId: checkedString(entry.sectionId, LOWER_ID, code, 64),
      artifactClasses: sortedSubset(entry.artifactClasses, PACK_ARTIFACT_CLASSES, code)
    };
  });
  const applicabilityKeys = applicabilityEntries.map((entry) => `${entry.packMaterialDigest}\u0000${entry.sectionId}`);
  const sortedApplicabilityKeys = [...applicabilityKeys].sort(compareUtf8);
  if (new Set(applicabilityKeys).size !== applicabilityKeys.length
      || applicabilityKeys.some((entry, index) => entry !== sortedApplicabilityKeys[index])) fail(code);
  const generation = integer(input.generation, 0, Number.MAX_SAFE_INTEGER, code);
  const predecessorSnapshotDigest = input.predecessorSnapshotDigest === null
    ? null : digest(input.predecessorSnapshotDigest, code);
  if (generation === 0 !== (predecessorSnapshotDigest === null)) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1, contractVersion: 1,
    generation, predecessorSnapshotDigest, schemaRegistryDigest: digest(input.schemaRegistryDigest, code),
    contractPolicyDigest: digest(input.contractPolicyDigest, code), catalogEntries,
    compatibilityEntries, applicabilityEntries
  };
}

function validateSourceProvenance(input) {
  const code = 'PACK_SOURCE_PROVENANCE_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId',
    'packId', 'version', 'acquisitionPolicyDigest', 'sourceRepositoryImmutableId',
    'sourceCommitOid', 'sourcePath', 'sourceFileDigests', 'licenseId',
    'licenseNoticeDigest', 'transformationReceiptDigest', 'bundleDigest',
    'manifestDigest', 'contentDigest', 'evidenceSchemaDigest', 'fixturesDigest', 'bundleIndexDigest'
  ], code);
  if (input.artifactType !== 'kstack-pack-source-provenance' || input.schemaVersion !== 1
      || !PACK_IDS.includes(input.packId) || !Array.isArray(input.sourceFileDigests)
      || input.sourceFileDigests.length < 1 || input.sourceFileDigests.length > LIMITS.maxFixtureFiles + 3) fail(code);
  const sourceFileDigests = input.sourceFileDigests.map((entry) => {
    exact(entry, ['relativePath', 'contentSha256'], code);
    return { relativePath: safeRelativePath(entry.relativePath, code), contentSha256: digest(entry.contentSha256, code) };
  });
  if (new Set(sourceFileDigests.map((entry) => entry.relativePath)).size !== sourceFileDigests.length
      || sourceFileDigests.some((entry, index) => entry.relativePath !== [...sourceFileDigests].sort((a, b) => compareUtf8(a.relativePath, b.relativePath))[index].relativePath)) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1,
    projectId: checkedString(input.projectId, GENERAL_ID, code, 256),
    repositoryImmutableId: checkedString(input.repositoryImmutableId, GENERAL_ID, code, 256),
    packId: input.packId, version: checkedString(input.version, SEMVER, code, 128),
    acquisitionPolicyDigest: digest(input.acquisitionPolicyDigest, code),
    sourceRepositoryImmutableId: checkedString(input.sourceRepositoryImmutableId, GENERAL_ID, code, 256),
    sourceCommitOid: checkedString(input.sourceCommitOid, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u, code, 64),
    sourcePath: safeRelativePath(input.sourcePath, code), sourceFileDigests,
    licenseId: checkedString(input.licenseId, /^[A-Za-z0-9][A-Za-z0-9.+-]{0,127}$/u, code, 128),
    licenseNoticeDigest: digest(input.licenseNoticeDigest, code),
    transformationReceiptDigest: digest(input.transformationReceiptDigest, code),
    bundleDigest: digest(input.bundleDigest, code), manifestDigest: digest(input.manifestDigest, code),
    contentDigest: digest(input.contentDigest, code), evidenceSchemaDigest: digest(input.evidenceSchemaDigest, code),
    fixturesDigest: digest(input.fixturesDigest, code), bundleIndexDigest: digest(input.bundleIndexDigest, code)
  };
}

const ASSERTION_DIGEST_FIELDS = Object.freeze([
  'bundleDigest', 'manifestDigest', 'contentDigest', 'evidenceSchemaDigest',
  'fixturesDigest', 'bundleIndexDigest', 'sourceProvenanceDigest',
  'schemaRegistryDigest', 'contractPolicyDigest', 'compatibilityEntryDigest',
  'composerImplementationDigest', 'kernelSchemaDigest', 'baseLaneContractDigest'
]);

function validateAssertion(input, approval) {
  const code = approval ? 'PACK_APPROVAL_ASSERTION_INVALID' : 'PACK_REVIEW_ASSERTION_INVALID';
  const identityField = approval ? 'd1ApprovalAttestationDigest' : 'reviewerIdentityDigest';
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId',
    'packId', 'version', ...ASSERTION_DIGEST_FIELDS, 'validatorIdentityDigests',
    'decision', identityField, 'issuedAt', 'expiresAt'
  ], code);
  const expectedType = approval ? 'kstack-pack-approval-assertion' : 'kstack-pack-review-assertion';
  if (input.artifactType !== expectedType || input.schemaVersion !== 1 || !PACK_IDS.includes(input.packId)
      || input.decision !== 'approve' || !Array.isArray(input.validatorIdentityDigests)
      || input.validatorIdentityDigests.length < 1) fail(code);
  const validatorIdentityDigests = input.validatorIdentityDigests.map((entry) => digest(entry, code));
  if (new Set(validatorIdentityDigests).size !== validatorIdentityDigests.length
      || validatorIdentityDigests.some((entry, index) => entry !== [...validatorIdentityDigests].sort(compareUtf8)[index])) fail(code);
  const result = {
    artifactType: input.artifactType, schemaVersion: 1,
    projectId: checkedString(input.projectId, GENERAL_ID, code, 256),
    repositoryImmutableId: checkedString(input.repositoryImmutableId, GENERAL_ID, code, 256),
    packId: input.packId, version: checkedString(input.version, SEMVER, code, 128)
  };
  for (const field of ASSERTION_DIGEST_FIELDS) result[field] = digest(input[field], code);
  result.validatorIdentityDigests = validatorIdentityDigests;
  result.decision = 'approve';
  result[identityField] = digest(input[identityField], code);
  result.issuedAt = instant(input.issuedAt, code);
  result.expiresAt = instant(input.expiresAt, code);
  if (Date.parse(result.issuedAt) >= Date.parse(result.expiresAt)) fail(code);
  return result;
}

function validateActivationRequest(input) {
  const code = 'PACK_ACTIVATION_REQUEST_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId',
    'fromSnapshotDigest', 'fromGeneration', 'toSnapshotDigest', 'toGeneration',
    'changedPackIds', 'transitionKind', 'schemaRegistryDigest',
    'compatibilityReviewDigest', 'd1ActivationAttestationDigest',
    'd3WeakeningAuthorizationDigest', 'requestNonce', 'notBefore', 'expiresAt'
  ], code);
  if (input.artifactType !== 'kstack-pack-activation-request' || input.schemaVersion !== 1
      || !Array.isArray(input.changedPackIds) || input.changedPackIds.length !== 1
      || !PACK_IDS.includes(input.changedPackIds[0])
      || !['activate', 'disable', 'downgrade', 'quarantine', 'quarantine-reversal', 'rollback', 'upgrade'].includes(input.transitionKind)) fail(code);
  const fromGeneration = integer(input.fromGeneration, 0, Number.MAX_SAFE_INTEGER - 1, code);
  const toGeneration = integer(input.toGeneration, 1, Number.MAX_SAFE_INTEGER, code);
  if (toGeneration !== fromGeneration + 1) fail(code);
  const result = {
    artifactType: input.artifactType, schemaVersion: 1,
    projectId: checkedString(input.projectId, GENERAL_ID, code, 256),
    repositoryImmutableId: checkedString(input.repositoryImmutableId, GENERAL_ID, code, 256),
    fromSnapshotDigest: digest(input.fromSnapshotDigest, code), fromGeneration,
    toSnapshotDigest: digest(input.toSnapshotDigest, code), toGeneration,
    changedPackIds: [...input.changedPackIds], transitionKind: input.transitionKind,
    schemaRegistryDigest: digest(input.schemaRegistryDigest, code),
    compatibilityReviewDigest: digest(input.compatibilityReviewDigest, code),
    d1ActivationAttestationDigest: digest(input.d1ActivationAttestationDigest, code),
    d3WeakeningAuthorizationDigest: input.d3WeakeningAuthorizationDigest === null ? null : digest(input.d3WeakeningAuthorizationDigest, code),
    requestNonce: checkedString(input.requestNonce, /^[a-f0-9]{64}$/u, code, 64),
    notBefore: instant(input.notBefore, code), expiresAt: instant(input.expiresAt, code)
  };
  if (Date.parse(result.notBefore) >= Date.parse(result.expiresAt)) fail(code);
  return result;
}

function validateActivationReceipt(input) {
  const code = 'PACK_ACTIVATION_RECEIPT_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'requestDigest', 'oldSnapshotDigest',
    'oldGeneration', 'newSnapshotDigest', 'newGeneration',
    'd1ActivationAttestationDigest', 'd3WeakeningAuthorizationDigest',
    'commitTransactionId', 'committedAt', 'priorPointerRecordDigest', 'currentPointerRecordDigest'
  ], code);
  if (input.artifactType !== 'kstack-pack-activation-receipt' || input.schemaVersion !== 1) fail(code);
  const oldGeneration = integer(input.oldGeneration, 0, Number.MAX_SAFE_INTEGER - 1, code);
  const newGeneration = integer(input.newGeneration, 1, Number.MAX_SAFE_INTEGER, code);
  if (newGeneration !== oldGeneration + 1) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1, requestDigest: digest(input.requestDigest, code),
    oldSnapshotDigest: digest(input.oldSnapshotDigest, code), oldGeneration,
    newSnapshotDigest: digest(input.newSnapshotDigest, code), newGeneration,
    d1ActivationAttestationDigest: digest(input.d1ActivationAttestationDigest, code),
    d3WeakeningAuthorizationDigest: input.d3WeakeningAuthorizationDigest === null ? null : digest(input.d3WeakeningAuthorizationDigest, code),
    commitTransactionId: checkedString(input.commitTransactionId, GENERAL_ID, code, 256),
    committedAt: instant(input.committedAt, code), priorPointerRecordDigest: digest(input.priorPointerRecordDigest, code),
    currentPointerRecordDigest: digest(input.currentPointerRecordDigest, code)
  };
}

function validateQuarantineRecord(input) {
  const code = 'PACK_QUARANTINE_RECORD_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId',
    'snapshotDigest', 'bundleDigest', 'packId', 'reason', 'evidenceDigests',
    'd1ActionAttestationDigest', 'quarantinedAt', 'expiresAt', 'nonce'
  ], code);
  if (input.artifactType !== 'kstack-pack-quarantine-record' || input.schemaVersion !== 1
      || !PACK_IDS.includes(input.packId)
      || !['compatibility-failure', 'evidence-fabrication', 'integrity-failure', 'policy-violation', 'security-finding'].includes(input.reason)) fail(code);
  const evidenceDigests = Array.isArray(input.evidenceDigests) ? input.evidenceDigests.map((entry) => digest(entry, code)) : fail(code);
  if (evidenceDigests.length < 1 || new Set(evidenceDigests).size !== evidenceDigests.length
      || evidenceDigests.some((entry, index) => entry !== [...evidenceDigests].sort(compareUtf8)[index])) fail(code);
  const quarantinedAt = instant(input.quarantinedAt, code);
  const expiresAt = input.expiresAt === null ? null : instant(input.expiresAt, code);
  if (expiresAt !== null && Date.parse(quarantinedAt) >= Date.parse(expiresAt)) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1,
    projectId: checkedString(input.projectId, GENERAL_ID, code, 256),
    repositoryImmutableId: checkedString(input.repositoryImmutableId, GENERAL_ID, code, 256),
    snapshotDigest: digest(input.snapshotDigest, code), bundleDigest: digest(input.bundleDigest, code),
    packId: input.packId, reason: input.reason, evidenceDigests,
    d1ActionAttestationDigest: digest(input.d1ActionAttestationDigest, code),
    quarantinedAt, expiresAt, nonce: checkedString(input.nonce, /^[a-f0-9]{64}$/u, code, 64)
  };
}

function validateTombstone(input) {
  const code = 'PACK_TOMBSTONE_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId',
    'packId', 'version', 'bundleDigest', 'manifestDigest', 'contentDigest',
    'evidenceSchemaDigest', 'fixturesDigest', 'bundleIndexDigest',
    'lastSnapshotDigest', 'disposition', 'retainedSafeMetadataDigest',
    'removalAuthorizationDigest', 'removedAt', 'reason'
  ], code);
  if (input.artifactType !== 'kstack-pack-tombstone' || input.schemaVersion !== 1
      || !PACK_IDS.includes(input.packId) || !['disabled-retained', 'physically-removed'].includes(input.disposition)) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1,
    projectId: checkedString(input.projectId, GENERAL_ID, code, 256),
    repositoryImmutableId: checkedString(input.repositoryImmutableId, GENERAL_ID, code, 256),
    packId: input.packId, version: checkedString(input.version, SEMVER, code, 128),
    bundleDigest: digest(input.bundleDigest, code), manifestDigest: digest(input.manifestDigest, code),
    contentDigest: digest(input.contentDigest, code), evidenceSchemaDigest: digest(input.evidenceSchemaDigest, code),
    fixturesDigest: digest(input.fixturesDigest, code), bundleIndexDigest: digest(input.bundleIndexDigest, code),
    lastSnapshotDigest: digest(input.lastSnapshotDigest, code), disposition: input.disposition,
    retainedSafeMetadataDigest: digest(input.retainedSafeMetadataDigest, code),
    removalAuthorizationDigest: digest(input.removalAuthorizationDigest, code),
    removedAt: instant(input.removedAt, code), reason: checkedString(input.reason, /^[A-Z][A-Z0-9_]{0,127}$/u, code, 128)
  };
}

function validatePackOperationInventory(input) {
  const code = 'PACK_OPERATION_INVENTORY_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'operationId', 'entries'], code);
  if (input.artifactType !== 'kstack-pack-operation-inventory' || input.schemaVersion !== 1
      || !Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 16_384) fail(code);
  const entries = input.entries.map((entry) => {
    exact(entry, ['role', 'artifactType', 'artifactDigest', 'byteLength'], code);
    return {
      role: checkedString(entry.role, /^[a-z][a-z0-9-]{0,127}$/u, code, 128),
      artifactType: checkedString(entry.artifactType, /^kstack-[a-z0-9-]{1,127}$/u, code, 128),
      artifactDigest: digest(entry.artifactDigest, code),
      byteLength: integer(entry.byteLength, 0, LIMITS.maxBundleBytes, code)
    };
  });
  const roles = entries.map((entry) => entry.role);
  const typed = entries.map((entry) => `${entry.artifactType}\u0000${entry.artifactDigest}`);
  if (new Set(roles).size !== roles.length || roles.some((entry, index) => entry !== [...roles].sort(compareUtf8)[index])
      || new Set(typed).size !== typed.length || new Set(entries.map((entry) => entry.artifactDigest)).size !== entries.length) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1,
    operationId: checkedString(input.operationId, GENERAL_ID, code, 256), entries
  };
}

const D5_VALIDATORS = Object.freeze({
  'kstack-pack-activation-receipt': validateActivationReceipt,
  'kstack-pack-activation-request': validateActivationRequest,
  'kstack-pack-approval-assertion': (value) => validateAssertion(value, true),
  'kstack-pack-bundle-index': validateBundleIndex,
  'kstack-pack-catalog-snapshot': validatePackCatalogSnapshot,
  'kstack-pack-compatibility-entry': validateCompatibilityEntry,
  'kstack-pack-content': validatePackContent,
  'kstack-pack-contract-policy': validatePackContractPolicy,
  'kstack-pack-evidence-schema': validatePackEvidenceSchema,
  'kstack-pack-manifest': validatePackManifest,
  'kstack-pack-operation-inventory': validatePackOperationInventory,
  'kstack-pack-quarantine-record': validateQuarantineRecord,
  'kstack-pack-review-assertion': (value) => validateAssertion(value, false),
  'kstack-pack-source-provenance': validateSourceProvenance,
  'kstack-pack-tombstone': validateTombstone,
  'kstack-validator-identity': validateValidatorIdentity
});

export function createD5Artifact(input) {
  if (!plain(input) || !D5_VALIDATORS[input.artifactType]) fail('PACK_SCHEMA_TYPE_INVALID');
  return artifactResult(D5_VALIDATORS[input.artifactType](input));
}

export function createPackOperationInventory(input) {
  const code = 'PACK_OPERATION_INVENTORY_INVALID';
  exact(input, ['operationId', 'artifacts'], code);
  if (!Array.isArray(input.artifacts) || input.artifacts.length < 1 || input.artifacts.length > 16_384) fail(code);
  const artifacts = input.artifacts.map((source) => {
    exact(source, ['role', 'artifactType', 'digest', 'bytes'], code);
    const parsed = parseD5Artifact(source.bytes, source.artifactType, source.digest);
    return {
      role: checkedString(source.role, /^[a-z][a-z0-9-]{0,127}$/u, code, 128),
      artifactType: source.artifactType, artifactDigest: parsed.artifactDigest,
      byteLength: parsed.canonicalBytes.length
    };
  }).sort((left, right) => compareUtf8(left.role, right.role));
  return createD5Artifact({
    artifactType: 'kstack-pack-operation-inventory', schemaVersion: 1,
    operationId: checkedString(input.operationId, GENERAL_ID, code, 256), entries: artifacts
  });
}

export function parseD5Artifact(bytes, expectedArtifactType, expectedDigest) {
  if (!D5_VALIDATORS[expectedArtifactType]) fail('PACK_SCHEMA_TYPE_INVALID');
  const result = parseValidated(bytes, D5_VALIDATORS[expectedArtifactType], expectedArtifactType, 'PACK_ARTIFACT_INVALID');
  if (expectedDigest !== undefined) sameDigest(result.artifactDigest, expectedDigest, 'PACK_ARTIFACT_DIGEST_MISMATCH');
  return result;
}

export function activationBodyDigest(request) {
  const record = validateActivationRequest(request);
  const projection = Object.fromEntries(Object.entries(record).filter(([key]) => !['d1ActivationAttestationDigest', 'd3WeakeningAuthorizationDigest'].includes(key)));
  return domainDigest('KSTACK-PACK-ACTIVATION-BODY-V1\n', projection);
}

function assertClosedSchemaDocument(value, targetArtifactType) {
  const code = 'PACK_SCHEMA_DOCUMENT_INVALID';
  const visit = (node, depth = 0) => {
    if (depth > MAX_DEPTH || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const entry of node) visit(entry, depth + 1); return; }
    for (const [key, child] of Object.entries(node)) {
      if (['$ref', '$dynamicRef', '$id', 'format', 'default', 'coerce', 'transform', 'validator', 'code', 'remoteUri'].includes(key)) fail(code);
      visit(child, depth + 1);
    }
    if (node.type === 'object' && node.additionalProperties !== false) fail(code);
  };
  if (!plain(value) || value.type !== 'object' || value.additionalProperties !== false
      || !plain(value.properties) || !Array.isArray(value.required)
      || value.properties.artifactType?.const !== targetArtifactType
      || value.properties.schemaVersion?.const !== 1) fail(code);
  const propertyNames = Object.keys(value.properties).sort(compareUtf8);
  const required = [...value.required].sort(compareUtf8);
  if (new Set(value.required).size !== value.required.length
      || !packCanonicalBytes(propertyNames).equals(packCanonicalBytes(required))) fail(code);
  visit(value);
}

function validateSchemaRegistryEntry(input) {
  const code = 'PACK_SCHEMA_REGISTRY_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'domainPrefix', 'schemaPath', 'schemaDigest',
    'vectorRoot', 'fixtureSetDigest', 'validatorIdentityDigest'
  ], code);
  if (!D5_SCHEMA_TYPES.includes(input.artifactType) || input.schemaVersion !== 1) fail(code);
  const expectedPrefix = d5DomainPrefix(input.artifactType);
  if (input.domainPrefix !== expectedPrefix
      || input.schemaPath !== `schemas/${input.artifactType}.schema.json`
      || input.vectorRoot !== `vectors/${input.artifactType}`) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1, domainPrefix: input.domainPrefix,
    schemaPath: input.schemaPath, schemaDigest: digest(input.schemaDigest, code),
    vectorRoot: input.vectorRoot, fixtureSetDigest: digest(input.fixtureSetDigest, code),
    validatorIdentityDigest: digest(input.validatorIdentityDigest, code)
  };
}

function validateSchemaRegistryRecord(input) {
  const code = 'PACK_SCHEMA_REGISTRY_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'contractVersion', 'canonicalizerVersion',
    'hashAlgorithm', 'contractPolicyDigest', 'schemas'
  ], code);
  if (input.artifactType !== 'kstack-pack-schema-registry' || input.schemaVersion !== 1
      || input.contractVersion !== 1 || input.canonicalizerVersion !== 1
      || input.hashAlgorithm !== 'sha256' || !Array.isArray(input.schemas)
      || input.schemas.length !== D5_SCHEMA_TYPES.length) fail(code);
  const schemas = input.schemas.map(validateSchemaRegistryEntry);
  if (schemas.some((entry, index) => entry.artifactType !== D5_SCHEMA_TYPES[index])
      || new Set(schemas.map((entry) => entry.domainPrefix)).size !== schemas.length) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1, contractVersion: 1,
    canonicalizerVersion: 1, hashAlgorithm: 'sha256',
    contractPolicyDigest: digest(input.contractPolicyDigest, code), schemas
  };
}

function openedReleaseFile(input, code) {
  return openedFile(input, code, false);
}

function validateVectorExpected(input, artifactType, vectorFiles) {
  const code = 'PACK_SCHEMA_VECTOR_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'targetArtifactType', 'entries'], code);
  if (input.artifactType !== 'kstack-pack-schema-vector-expectations' || input.schemaVersion !== 1
      || input.targetArtifactType !== artifactType || !Array.isArray(input.entries)) fail(code);
  const candidates = vectorFiles.filter((file) => file.relativePath !== 'expected.json');
  if (input.entries.length !== candidates.length) fail(code);
  const byPath = new Map(candidates.map((entry) => [entry.relativePath, entry]));
  const entries = input.entries.map((entry) => {
    exact(entry, ['path', 'rawInputDigest', 'accepted', 'acceptedCanonicalBase64', 'acceptedArtifactDigest'], code);
    const path = safeRelativePath(entry.path, code);
    const source = byPath.get(path);
    if (!source) fail(code);
    sameDigest(entry.rawInputDigest, rawDigest(source.bytes), code);
    const accepted = bool(entry.accepted, code);
    if (accepted !== path.startsWith('positive/')) fail(code);
    if (accepted) {
      if (typeof entry.acceptedCanonicalBase64 !== 'string') fail(code);
      const canonical = Buffer.from(entry.acceptedCanonicalBase64, 'base64');
      if (canonical.toString('base64') !== entry.acceptedCanonicalBase64) fail(code);
      const parsed = parseD5Artifact(source.bytes, artifactType);
      if (!parsed.canonicalBytes.equals(canonical)) fail(code);
      sameDigest(entry.acceptedArtifactDigest, parsed.artifactDigest, code);
    } else {
      if (entry.acceptedCanonicalBase64 !== null || entry.acceptedArtifactDigest !== null) fail(code);
      try { parseD5Artifact(source.bytes, artifactType); } catch { return { path, rawInputDigest: entry.rawInputDigest, accepted: false, acceptedCanonicalBase64: null, acceptedArtifactDigest: null }; }
      fail(code);
    }
    return {
      path, rawInputDigest: entry.rawInputDigest, accepted: true,
      acceptedCanonicalBase64: entry.acceptedCanonicalBase64,
      acceptedArtifactDigest: entry.acceptedArtifactDigest
    };
  });
  if (entries.some((entry, index) => entry.path !== [...entries].sort((a, b) => compareUtf8(a.path, b.path))[index].path)) fail(code);
}

export function validatePackSchemaRegistry(input) {
  const code = 'PACK_SCHEMA_REGISTRY_INVALID';
  exact(input, ['registryBytes', 'contractPolicyBytes', 'schemaDocuments', 'vectorSets', 'validatorIdentities'], code);
  let registry;
  let policy;
  try {
    registry = validateSchemaRegistryRecord(parsePackCanonicalJson(input.registryBytes));
    policy = parseD5Artifact(input.contractPolicyBytes, 'kstack-pack-contract-policy');
  } catch { fail(code); }
  const registryBytes = packCanonicalBytes(registry);
  if (!registryBytes.equals(Buffer.from(input.registryBytes))) fail(code);
  sameDigest(registry.contractPolicyDigest, policy.artifactDigest, code);
  if (!Array.isArray(input.schemaDocuments) || !Array.isArray(input.vectorSets)
      || !Array.isArray(input.validatorIdentities)
      || input.schemaDocuments.length !== D5_SCHEMA_TYPES.length
      || input.vectorSets.length !== D5_SCHEMA_TYPES.length
      || input.validatorIdentities.length !== D5_SCHEMA_TYPES.length) fail(code);
  const schemasByPath = new Map(input.schemaDocuments.map((entry) => [entry.path, entry]));
  const vectorsByRoot = new Map(input.vectorSets.map((entry) => [entry.root, entry]));
  const identitiesByDigest = new Map(input.validatorIdentities.map((entry) => [entry.digest, entry]));
  if (schemasByPath.size !== input.schemaDocuments.length || vectorsByRoot.size !== input.vectorSets.length
      || identitiesByDigest.size !== input.validatorIdentities.length) fail(code);
  for (const entry of registry.schemas) {
    const schemaSource = schemasByPath.get(entry.schemaPath);
    if (!schemaSource) fail(code);
    exact(schemaSource, ['path', 'bytes', 'regular', 'linkCount', 'identityStable'], code);
    const openedSchema = openedReleaseFile({
      relativePath: schemaSource.path, bytes: schemaSource.bytes, regular: schemaSource.regular,
      linkCount: schemaSource.linkCount, identityStable: schemaSource.identityStable
    }, code);
    let schemaDocument;
    try { schemaDocument = parsePackCanonicalJson(openedSchema.bytes); } catch { fail(code); }
    assertClosedSchemaDocument(schemaDocument, entry.artifactType);
    sameDigest(entry.schemaDigest, rawDomainDigest('KSTACK-PACK-SCHEMA-DOCUMENT-V1\n', openedSchema.bytes), code);

    const vectorSet = vectorsByRoot.get(entry.vectorRoot);
    if (!vectorSet) fail(code);
    exact(vectorSet, ['root', 'files'], code);
    if (!Array.isArray(vectorSet.files) || vectorSet.files.length < 3) fail(code);
    const vectorFiles = vectorSet.files.map((file) => openedReleaseFile(file, code));
    if (vectorFiles.some((file) => !/^(?:positive|negative)\/[a-z0-9][a-z0-9._-]{0,63}\.json$/u.test(file.relativePath)
        && file.relativePath !== 'expected.json') || !vectorFiles.some((file) => file.relativePath.startsWith('positive/'))
        || !vectorFiles.some((file) => file.relativePath.startsWith('negative/'))
        || vectorFiles.filter((file) => file.relativePath === 'expected.json').length !== 1) fail(code);
    sameDigest(entry.fixtureSetDigest, packFileSetDigest('KSTACK-PACK-SCHEMA-VECTORS-V1', vectorFiles), code);
    const expectedFile = vectorFiles.find((file) => file.relativePath === 'expected.json');
    let expected;
    try { expected = parsePackCanonicalJson(expectedFile.bytes); } catch { fail(code); }
    validateVectorExpected(expected, entry.artifactType, vectorFiles);

    const identitySource = identitiesByDigest.get(entry.validatorIdentityDigest);
    if (!identitySource) fail(code);
    exact(identitySource, ['digest', 'bytes', 'regular', 'linkCount', 'identityStable'], code);
    const openedIdentity = openedReleaseFile({
      relativePath: `validators/${identitySource.digest}`, bytes: identitySource.bytes,
      regular: identitySource.regular, linkCount: identitySource.linkCount,
      identityStable: identitySource.identityStable
    }, code);
    const identity = parseD5Artifact(openedIdentity.bytes, 'kstack-validator-identity', identitySource.digest);
    sameDigest(identity.record.schemaDigest, entry.schemaDigest, code);
    sameDigest(identity.record.contractPolicyDigest, registry.contractPolicyDigest, code);
  }
  const output = deepFreeze({
    record: registry, canonicalBytes: registryBytes,
    schemaRegistryDigest: domainDigest('KSTACK-PACK-SCHEMA-REGISTRY-V1\n', registry),
    contractPolicy: policy,
    revalidationInput: {
      registryBytes: Buffer.from(input.registryBytes), contractPolicyBytes: Buffer.from(input.contractPolicyBytes),
      schemaDocuments: input.schemaDocuments.map((entry) => ({ ...entry, bytes: Buffer.from(entry.bytes) })),
      vectorSets: input.vectorSets.map((entry) => ({
        root: entry.root, files: entry.files.map((file) => ({ ...file, bytes: Buffer.from(file.bytes) }))
      })),
      validatorIdentities: input.validatorIdentities.map((entry) => ({ ...entry, bytes: Buffer.from(entry.bytes) }))
    }
  });
  VALIDATED_REGISTRIES.add(output);
  return output;
}

export function createPackSchemaRegistry(input) {
  const record = validateSchemaRegistryRecord({
    artifactType: 'kstack-pack-schema-registry', schemaVersion: 1,
    contractVersion: 1, canonicalizerVersion: 1, hashAlgorithm: 'sha256', ...input
  });
  return deepFreeze({
    record, canonicalBytes: packCanonicalBytes(record),
    schemaRegistryDigest: domainDigest('KSTACK-PACK-SCHEMA-REGISTRY-V1\n', record)
  });
}

function openPackOperationInventory(input) {
  const code = 'PACK_ACTIVATION_GRAPH_INVALID';
  const inventory = parseD5Artifact(
    input.operationInventoryBytes, 'kstack-pack-operation-inventory', input.expectedOperationInventoryDigest
  );
  if (!Array.isArray(input.artifactSources) || input.artifactSources.length !== inventory.record.entries.length) fail(code);
  const sources = input.artifactSources.map((source) => {
    exact(source, ['role', 'artifactType', 'digest', 'bytes', 'regular', 'linkCount', 'identityStable'], code);
    const role = checkedString(source.role, /^[a-z][a-z0-9-]{0,127}$/u, code, 128);
    const opened = openedReleaseFile({
      relativePath: `inventory/${rawDigest(Buffer.from(role, 'utf8'))}`, bytes: source.bytes,
      regular: source.regular, linkCount: source.linkCount, identityStable: source.identityStable
    }, code);
    const parsed = parseD5Artifact(opened.bytes, source.artifactType, source.digest);
    return { role, artifactType: source.artifactType, digest: parsed.artifactDigest, bytes: opened.bytes, parsed };
  });
  const byRole = new Map(sources.map((source) => [source.role, source]));
  if (byRole.size !== sources.length) fail(code);
  for (const entry of inventory.record.entries) {
    const source = byRole.get(entry.role);
    if (!source || source.artifactType !== entry.artifactType || source.digest !== entry.artifactDigest
        || source.bytes.length !== entry.byteLength) fail(code);
  }
  const used = new Set();
  return {
    inventory,
    resolve(role, artifactType, artifactDigest) {
      const source = byRole.get(role);
      if (!source || source.artifactType !== artifactType || source.digest !== artifactDigest) fail(code);
      used.add(role);
      return source.parsed;
    },
    assertComplete() {
      if (used.size !== sources.length) fail(code);
    },
    retentionObjects() {
      return sources.map((source) => ({
        role: source.role, artifactType: source.artifactType,
        digest: source.digest, bytes: Buffer.from(source.bytes)
      })).sort((left, right) => compareUtf8(left.role, right.role));
    }
  };
}

function equalCanonical(left, right, code = 'PACK_ACTIVATION_GRAPH_INVALID') {
  if (!packCanonicalBytes(left).equals(packCanonicalBytes(right))) fail(code);
}

function assertMaterialTuple(expected, actual, fields, code = 'PACK_ACTIVATION_GRAPH_INVALID') {
  for (const field of fields) {
    if (field === 'packId' || field === 'version') {
      if (expected[field] !== actual[field]) fail(code);
    } else sameDigest(expected[field], actual[field], code);
  }
}

const MATERIAL_DIGEST_FIELDS = Object.freeze([
  'bundleDigest', 'manifestDigest', 'contentDigest', 'evidenceSchemaDigest',
  'fixturesDigest', 'bundleIndexDigest'
]);

export function validatePackCatalogGraph(input) {
  const code = 'PACK_ACTIVATION_GRAPH_INVALID';
  exact(input, [
    'schemaRegistry', 'operationInventoryBytes', 'expectedOperationInventoryDigest',
    'artifactSources', 'expectedSnapshotDigest', 'projectId', 'repositoryImmutableId',
    'materialGraphs', 'expectedComposerImplementationDigest', 'expectedKernelSchemaDigest',
    'expectedBaseLaneContractDigest', 'requiredValidatorTargets', 'trustedTime', 'trustedTimeAuthority'
  ], code);
  if (!input.schemaRegistry || !VALIDATED_REGISTRIES.has(input.schemaRegistry)) fail(code);
  const schemaRegistry = validatePackSchemaRegistry(input.schemaRegistry.revalidationInput);
  sameDigest(schemaRegistry.schemaRegistryDigest, input.schemaRegistry.schemaRegistryDigest, code);
  const time = confirmTrustedTimeBinding(input.trustedTime, input.trustedTimeAuthority, code);
  const now = Date.parse(time.now);
  const projectId = checkedString(input.projectId, GENERAL_ID, code, 256);
  const repositoryImmutableId = checkedString(input.repositoryImmutableId, GENERAL_ID, code, 256);
  const expectedComposerImplementationDigest = digest(input.expectedComposerImplementationDigest, code);
  const expectedKernelSchemaDigest = digest(input.expectedKernelSchemaDigest, code);
  const expectedBaseLaneContractDigest = digest(input.expectedBaseLaneContractDigest, code);
  const requiredValidatorTargets = Array.isArray(input.requiredValidatorTargets)
    ? input.requiredValidatorTargets.map((entry) => checkedString(entry, /^[a-z0-9][a-z0-9._-]{0,127}$/u, code, 128)) : fail(code);
  if (requiredValidatorTargets.length < 1 || new Set(requiredValidatorTargets).size !== requiredValidatorTargets.length
      || requiredValidatorTargets.some((entry, index) => entry !== [...requiredValidatorTargets].sort(compareUtf8)[index])) fail(code);
  const opened = openPackOperationInventory(input);
  const policy = opened.resolve('contract-policy', 'kstack-pack-contract-policy', schemaRegistry.contractPolicy.artifactDigest);
  if (!policy.canonicalBytes.equals(schemaRegistry.contractPolicy.canonicalBytes)) fail(code);
  const snapshot = opened.resolve('snapshot', 'kstack-pack-catalog-snapshot', input.expectedSnapshotDigest);
  sameDigest(snapshot.record.schemaRegistryDigest, schemaRegistry.schemaRegistryDigest, code);
  sameDigest(snapshot.record.contractPolicyDigest, policy.artifactDigest, code);
  const materialEntries = snapshot.record.catalogEntries.filter((entry) => entry.state !== 'roadmap-only');
  if (!Array.isArray(input.materialGraphs) || input.materialGraphs.length !== materialEntries.length) fail(code);
  const graphByPack = new Map(input.materialGraphs.map((entry) => {
    exact(entry, ['packId', 'fixtureFiles'], code);
    return [entry.packId, entry];
  }));
  if (graphByPack.size !== input.materialGraphs.length
      || materialEntries.some((entry) => !graphByPack.has(entry.packId))) fail(code);
  const approvedRegistryIdentities = new Set(schemaRegistry.record.schemas.map((entry) => entry.validatorIdentityDigest));
  const materialProofs = [];
  const bundleRetention = [];
  for (const catalog of materialEntries) {
    const prefix = catalog.packId;
    const compatibility = opened.resolve(`${prefix}-compatibility`, 'kstack-pack-compatibility-entry', catalog.compatibilityEntryDigest);
    const embeddedCompatibility = snapshot.record.compatibilityEntries.find((entry) => entry.bundleDigest === catalog.bundleDigest);
    if (!embeddedCompatibility) fail(code);
    equalCanonical(compatibility.record, embeddedCompatibility, code);
    const manifest = opened.resolve(`${prefix}-manifest`, 'kstack-pack-manifest', catalog.manifestDigest);
    const content = opened.resolve(`${prefix}-content`, 'kstack-pack-content', catalog.contentDigest);
    const evidenceSchema = opened.resolve(`${prefix}-evidence-schema`, 'kstack-pack-evidence-schema', catalog.evidenceSchemaDigest);
    const bundleIndex = opened.resolve(`${prefix}-bundle-index`, 'kstack-pack-bundle-index', catalog.bundleIndexDigest);
    const graph = graphByPack.get(catalog.packId);
    const bundle = validatePackBundle({
      manifestBytes: manifest.canonicalBytes, contentBytes: content.canonicalBytes,
      evidenceSchemaBytes: evidenceSchema.canonicalBytes, fixtureFiles: graph.fixtureFiles,
      bundleIndexBytes: bundleIndex.canonicalBytes
    });
    const retainedFixtures = graph.fixtureFiles.map((entry) => openedFile(entry, code, true));
    bundleRetention.push({
      packId: catalog.packId, bundleDigest: bundle.bundleDigest,
      files: [
        { relativePath: 'manifest.json', bytes: manifest.canonicalBytes },
        { relativePath: 'content.json', bytes: content.canonicalBytes },
        { relativePath: 'evidence.schema.json', bytes: evidenceSchema.canonicalBytes },
        ...retainedFixtures.map((entry) => ({ relativePath: `fixtures/${entry.relativePath}`, bytes: entry.bytes }))
      ].sort((left, right) => compareUtf8(left.relativePath, right.relativePath))
    });
    assertMaterialTuple(catalog, {
      packId: manifest.record.id, version: manifest.record.version,
      bundleDigest: bundle.bundleDigest, manifestDigest: manifest.artifactDigest,
      contentDigest: content.artifactDigest, evidenceSchemaDigest: evidenceSchema.artifactDigest,
      fixturesDigest: bundle.fixturesDigest, bundleIndexDigest: bundleIndex.artifactDigest
    }, ['packId', 'version', ...MATERIAL_DIGEST_FIELDS], code);
    assertMaterialTuple(catalog, compatibility.record, ['packId', 'version', ...MATERIAL_DIGEST_FIELDS], code);
    sameDigest(compatibility.record.schemaRegistryDigest, schemaRegistry.schemaRegistryDigest, code);
    sameDigest(compatibility.record.contractPolicyDigest, policy.artifactDigest, code);
    sameDigest(compatibility.record.composerImplementationDigest, expectedComposerImplementationDigest, code);
    sameDigest(compatibility.record.kernelSchemaDigest, expectedKernelSchemaDigest, code);
    sameDigest(compatibility.record.baseLaneContractDigest, expectedBaseLaneContractDigest, code);
    const actualTargets = compatibility.record.validatorIdentityDigests.map((entry) => entry.targetPlatform);
    equalCanonical(actualTargets, requiredValidatorTargets, code);
    const validatorIdentityDigests = [];
    for (const validatorBinding of compatibility.record.validatorIdentityDigests) {
      if (!approvedRegistryIdentities.has(validatorBinding.validatorIdentityDigest)) fail(code);
      const identity = opened.resolve(
        `validator-${validatorBinding.validatorIdentityDigest.slice(0, 16)}`,
        'kstack-validator-identity', validatorBinding.validatorIdentityDigest
      );
      if (identity.record.targetPlatform !== validatorBinding.targetPlatform) fail(code);
      sameDigest(identity.record.contractPolicyDigest, policy.artifactDigest, code);
      validatorIdentityDigests.push(identity.artifactDigest);
    }
    validatorIdentityDigests.sort(compareUtf8);
    const provenance = opened.resolve(`${prefix}-source-provenance`, 'kstack-pack-source-provenance', catalog.sourceProvenanceDigest);
    const review = opened.resolve(`${prefix}-review`, 'kstack-pack-review-assertion', catalog.reviewArtifactDigest);
    const approval = opened.resolve(`${prefix}-approval`, 'kstack-pack-approval-assertion', catalog.approvalArtifactDigest);
    for (const record of [provenance.record, review.record, approval.record]) {
      if (record.projectId !== projectId || record.repositoryImmutableId !== repositoryImmutableId) fail(code);
      assertMaterialTuple(catalog, record, ['packId', 'version', ...MATERIAL_DIGEST_FIELDS], code);
    }
    const assertionTuple = {
      sourceProvenanceDigest: provenance.artifactDigest,
      schemaRegistryDigest: schemaRegistry.schemaRegistryDigest,
      contractPolicyDigest: policy.artifactDigest,
      compatibilityEntryDigest: compatibility.artifactDigest,
      composerImplementationDigest: expectedComposerImplementationDigest,
      kernelSchemaDigest: expectedKernelSchemaDigest,
      baseLaneContractDigest: expectedBaseLaneContractDigest
    };
    for (const assertion of [review.record, approval.record]) {
      for (const [field, expected] of Object.entries(assertionTuple)) sameDigest(assertion[field], expected, code);
      equalCanonical(assertion.validatorIdentityDigests, validatorIdentityDigests, code);
      if (Date.parse(assertion.issuedAt) > now || Date.parse(assertion.expiresAt) <= now) fail(code);
    }
    if (catalog.state === 'quarantined') {
      const quarantine = opened.resolve(`${prefix}-quarantine`, 'kstack-pack-quarantine-record', catalog.quarantineRecordDigest);
      if (quarantine.record.projectId !== projectId || quarantine.record.repositoryImmutableId !== repositoryImmutableId
          || quarantine.record.packId !== catalog.packId) fail(code);
      sameDigest(quarantine.record.bundleDigest, catalog.bundleDigest, code);
    }
    materialProofs.push({
      packId: catalog.packId, state: catalog.state, version: catalog.version,
      bundleDigest: catalog.bundleDigest, compatibilityEntryDigest: compatibility.artifactDigest,
      reviewArtifactDigest: review.artifactDigest, approvalArtifactDigest: approval.artifactDigest
    });
  }
  opened.assertComplete();
  const output = deepFreeze({
    snapshot: snapshot.record, snapshotBytes: snapshot.canonicalBytes,
    snapshotDigest: snapshot.artifactDigest, generation: snapshot.record.generation,
    schemaRegistryDigest: schemaRegistry.schemaRegistryDigest,
    contractPolicyDigest: policy.artifactDigest,
    operationInventoryDigest: opened.inventory.artifactDigest,
    projectId, repositoryImmutableId, materialProofs,
    retentionSet: {
      artifacts: [
        ...opened.retentionObjects(),
        {
          role: 'operation-inventory', artifactType: 'kstack-pack-operation-inventory',
          digest: opened.inventory.artifactDigest, bytes: opened.inventory.canonicalBytes
        }
      ].sort((left, right) => compareUtf8(left.role, right.role)),
      bundles: bundleRetention
    },
    revalidationInput: {
      schemaRegistry,
      operationInventoryBytes: Buffer.from(input.operationInventoryBytes),
      expectedOperationInventoryDigest: input.expectedOperationInventoryDigest,
      artifactSources: input.artifactSources.map((entry) => ({ ...entry, bytes: Buffer.from(entry.bytes) })),
      expectedSnapshotDigest: input.expectedSnapshotDigest, projectId: input.projectId,
      repositoryImmutableId: input.repositoryImmutableId,
      materialGraphs: input.materialGraphs.map((entry) => ({
        packId: entry.packId,
        fixtureFiles: entry.fixtureFiles.map((file) => ({ ...file, bytes: Buffer.from(file.bytes) }))
      })),
      expectedComposerImplementationDigest: input.expectedComposerImplementationDigest,
      expectedKernelSchemaDigest: input.expectedKernelSchemaDigest,
      expectedBaseLaneContractDigest: input.expectedBaseLaneContractDigest,
      requiredValidatorTargets: [...input.requiredValidatorTargets], trustedTime: { ...input.trustedTime }
    }
  });
  VALIDATED_CATALOG_GRAPHS.add(output);
  return output;
}

export function assertValidatedPackCatalogGraph(value) {
  if (!value || !VALIDATED_CATALOG_GRAPHS.has(value)) fail('PACK_ACTIVATION_GRAPH_INVALID');
  return value;
}
