import crypto from 'node:crypto';
// Read once at module evaluation, for HOST_MODULE_SOURCE_DIGEST only: the
// invariant implementation digests attest to this file's own on-disk bytes.
// Imported by name rather than as a default namespace so the binding cannot
// collide with an ordinary `fs` identifier inside a hashed function.
import { readFileSync } from 'node:fs';

export const HOST_CONTRACT_VERSION = 'kstack-host-contract-v1';
export const HOST_CONTRACT_LIMITS = Object.freeze({
  maxDocumentBytes: 1_048_576,
  maxDepth: 32,
  maxObjectProperties: 64,
  maxArrayItems: 1_024,
  maxStringUtf8Bytes: 16_384,
  maxSchemas: 256,
  maxRefEdges: 2_048,
  maxPatternBytes: 256,
  maxPatternDfaStates: 4_096
});

export const HOST_CONTRACT_DOMAINS = Object.freeze({
  'kstack.closed-metaschema.v1': 'KSTACK-CLOSED-METASCHEMA-V1',
  'kstack.canonicalization-profile.v1': 'KSTACK-CANONICALIZATION-PROFILE-V1',
  'kstack.closed-vocabulary-registry.v1': 'KSTACK-CLOSED-VOCABULARY-REGISTRY-V1',
  'kstack.invariant-registry.v1': 'KSTACK-INVARIANT-REGISTRY-V1',
  'kstack.historical-resolver-set.v1': 'KSTACK-HISTORICAL-RESOLVER-SET-V1',
  'kstack.cross-runtime-vector-set.v1': 'KSTACK-CROSS-RUNTIME-VECTOR-SET-V1',
  'kstack.host-contract-schema-set.v1': 'KSTACK-HOST-CONTRACT-SCHEMA-SET-V1'
});

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const ASCII_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const STABLE_CODE_ID = /^[A-Z][A-Z0-9_]{0,127}$/u;
const ARTIFACT_DOMAIN = /^KSTACK-[A-Z0-9-]+-V[0-9]+$/u;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/u;
const COLLECTION_MODES = new Set(['ORDERED', 'SET_BY_VALUE_ASCII', 'SET_BY_VALUE_DIGEST', 'SET_BY_FIELDS']);
const KEY_KINDS = new Set(['ASCII', 'DIGEST', 'ASCII_CANONICAL_UINT']);
const REGISTRY_COLLECTION_IDS = Object.freeze({
  mediaTypes: 'media-types', operationIds: 'operation-ids', operationClassIds: 'operation-class-ids', capabilityIds: 'capability-ids',
  fixtureIds: 'fixture-ids', reasonCodes: 'reason-codes', errorCodes: 'error-codes', operationProfileIds: 'operation-profile-ids',
  componentRoles: 'component-roles', receiptKinds: 'receipt-kinds', quarantineSubjectTypes: 'quarantine-subject-types'
});

export class HostContractError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'HostContractError';
    this.code = code;
  }
}

function fail(code, message) { throw new HostContractError(code, message); }

function bytes(input) {
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array)) fail('KSTACK_HOST_JSON_INPUT_INVALID');
  const output = Buffer.from(input);
  if (output.length > HOST_CONTRACT_LIMITS.maxDocumentBytes) fail('KSTACK_HOST_DOCUMENT_BYTES_EXCEEDED');
  return output;
}

function assertNfcString(value) {
  if (typeof value !== 'string' || !value.isWellFormed()) fail('KSTACK_HOST_STRING_INVALID');
  for (const scalar of value) {
    const codePoint = scalar.codePointAt(0);
    if ((codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xffff) === 0xfffe || (codePoint & 0xffff) === 0xffff) fail('KSTACK_HOST_STRING_NONCHARACTER');
  }
  if (value.normalize('NFC') !== value) fail('KSTACK_HOST_STRING_NOT_NFC');
  if (Buffer.byteLength(value, 'utf8') > HOST_CONTRACT_LIMITS.maxStringUtf8Bytes) fail('KSTACK_HOST_STRING_BYTES_EXCEEDED');
}

function assertTreeBounds(value, depth = 0, ancestors = new Set()) {
  if (depth > HOST_CONTRACT_LIMITS.maxDepth) fail('KSTACK_HOST_DEPTH_EXCEEDED');
  if (typeof value === 'string') { assertNfcString(value); return; }
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail('KSTACK_HOST_INTEGER_INVALID');
    return;
  }
  if (!value || typeof value !== 'object' || ancestors.has(value)) fail('KSTACK_HOST_VALUE_INVALID');
  ancestors.add(value);
  if (Array.isArray(value)) {
    if (value.length > HOST_CONTRACT_LIMITS.maxArrayItems) fail('KSTACK_HOST_ARRAY_ITEMS_EXCEEDED');
    if (Object.keys(value).length !== value.length) fail('KSTACK_HOST_VALUE_INVALID');
    for (const entry of value) assertTreeBounds(entry, depth + 1, ancestors);
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype) fail('KSTACK_HOST_VALUE_INVALID');
    const entries = Object.entries(value);
    if (entries.length > HOST_CONTRACT_LIMITS.maxObjectProperties) fail('KSTACK_HOST_OBJECT_PROPERTIES_EXCEEDED');
    for (const [key, entry] of entries) {
      assertNfcString(key);
      assertTreeBounds(entry, depth + 1, ancestors);
    }
  }
  ancestors.delete(value);
}

class HostJsonParser {
  constructor(text) { this.text = text; this.offset = 0; }

  parse() {
    const value = this.value(0);
    if (this.offset !== this.text.length) fail('KSTACK_HOST_JSON_TRAILING_DATA');
    if (!hostCanonicalBytes(value).equals(Buffer.from(this.text, 'utf8'))) fail('KSTACK_HOST_JSON_NONCANONICAL');
    return value;
  }

  value(depth) {
    if (depth > HOST_CONTRACT_LIMITS.maxDepth) fail('KSTACK_HOST_DEPTH_EXCEEDED');
    const token = this.text[this.offset];
    if (token === '{') return this.object(depth);
    if (token === '[') return this.array(depth);
    if (token === '"') return this.string();
    if (token === 't') return this.literal('true', true);
    if (token === 'f') return this.literal('false', false);
    if (token === 'n') return this.literal('null', null);
    if (token === '-' || token >= '0' && token <= '9') return this.integer();
    fail('KSTACK_HOST_JSON_SYNTAX_INVALID');
  }

  literal(token, value) {
    if (this.text.slice(this.offset, this.offset + token.length) !== token) fail('KSTACK_HOST_JSON_SYNTAX_INVALID');
    this.offset += token.length;
    return value;
  }

  object(depth) {
    this.offset += 1;
    const output = {};
    const keys = new Set();
    if (this.text[this.offset] === '}') { this.offset += 1; return output; }
    while (true) {
      if (keys.size >= HOST_CONTRACT_LIMITS.maxObjectProperties) fail('KSTACK_HOST_OBJECT_PROPERTIES_EXCEEDED');
      if (this.text[this.offset] !== '"') fail('KSTACK_HOST_JSON_SYNTAX_INVALID');
      const key = this.string();
      if (keys.has(key)) fail('KSTACK_HOST_JSON_DUPLICATE_KEY');
      keys.add(key);
      if (this.text[this.offset++] !== ':') fail('KSTACK_HOST_JSON_SYNTAX_INVALID');
      Object.defineProperty(output, key, { value: this.value(depth + 1), enumerable: true, configurable: true, writable: true });
      const separator = this.text[this.offset++];
      if (separator === '}') return output;
      if (separator !== ',') fail('KSTACK_HOST_JSON_SYNTAX_INVALID');
    }
  }

  array(depth) {
    this.offset += 1;
    const output = [];
    if (this.text[this.offset] === ']') { this.offset += 1; return output; }
    while (true) {
      if (output.length >= HOST_CONTRACT_LIMITS.maxArrayItems) fail('KSTACK_HOST_ARRAY_ITEMS_EXCEEDED');
      output.push(this.value(depth + 1));
      const separator = this.text[this.offset++];
      if (separator === ']') return output;
      if (separator !== ',') fail('KSTACK_HOST_JSON_SYNTAX_INVALID');
    }
  }

  string() {
    this.offset += 1;
    let output = '';
    let outputBytes = 0;
    while (this.offset < this.text.length) {
      const character = this.text[this.offset++];
      if (character === '"') { assertNfcString(output); return output; }
      let chunk;
      if (character === '\\') {
        const escaped = this.text[this.offset++];
        if (escaped === '"' || escaped === '\\' || escaped === '/') chunk = escaped;
        else if (escaped === 'u') chunk = this.unicodeEscape();
        else chunk = this.namedEscape(escaped);
      } else {
        if (character.charCodeAt(0) <= 0x1f) fail('KSTACK_HOST_JSON_CONTROL_INVALID');
        chunk = character;
      }
      output += chunk;
      outputBytes += Buffer.byteLength(chunk, 'utf8');
      if (outputBytes > HOST_CONTRACT_LIMITS.maxStringUtf8Bytes) fail('KSTACK_HOST_STRING_BYTES_EXCEEDED');
    }
    fail('KSTACK_HOST_JSON_STRING_UNTERMINATED');
  }

  namedEscape(escaped) {
    if (escaped === 'b') return '\b';
    if (escaped === 'f') return '\f';
    if (escaped === 'n') return '\n';
    if (escaped === 'r') return '\r';
    if (escaped === 't') return '\t';
    fail('KSTACK_HOST_JSON_ESCAPE_INVALID');
  }

  unicodeEscape() {
    const first = this.hexUnit();
    if (first >= 0xdc00 && first <= 0xdfff) fail('KSTACK_HOST_JSON_SURROGATE_INVALID');
    if (first < 0xd800 || first > 0xdbff) return String.fromCharCode(first);
    if (this.text[this.offset] !== '\\' || this.text[this.offset + 1] !== 'u') fail('KSTACK_HOST_JSON_SURROGATE_INVALID');
    this.offset += 2;
    const second = this.hexUnit();
    if (second < 0xdc00 || second > 0xdfff) fail('KSTACK_HOST_JSON_SURROGATE_INVALID');
    return String.fromCodePoint(0x10000 + ((first - 0xd800) << 10) + second - 0xdc00);
  }

  hexUnit() {
    const digits = this.text.slice(this.offset, this.offset + 4);
    if (!/^[0-9a-f]{4}$/i.test(digits)) fail('KSTACK_HOST_JSON_ESCAPE_INVALID');
    this.offset += 4;
    return Number.parseInt(digits, 16);
  }

  integer() {
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u.exec(this.text.slice(this.offset));
    if (!match) fail('KSTACK_HOST_JSON_NUMBER_INVALID');
    const numeral = match[0];
    this.offset += numeral.length;
    if (numeral.includes('.') || /[eE]/u.test(numeral) || numeral === '-0') fail('KSTACK_HOST_JSON_NUMBER_INVALID');
    let integer;
    try { integer = BigInt(numeral); } catch { fail('KSTACK_HOST_JSON_NUMBER_INVALID'); }
    if (integer > BigInt(Number.MAX_SAFE_INTEGER) || integer < BigInt(Number.MIN_SAFE_INTEGER)) fail('KSTACK_HOST_JSON_NUMBER_INVALID');
    return Number(integer);
  }
}

export function parseHostCanonicalJson(input) {
  const source = bytes(input);
  if (source.length >= 3 && source[0] === 0xef && source[1] === 0xbb && source[2] === 0xbf) fail('KSTACK_HOST_JSON_BOM_FORBIDDEN');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(source); }
  catch { fail('KSTACK_HOST_JSON_UTF8_INVALID'); }
  const value = new HostJsonParser(text).parse();
  return value;
}

function encodeHostValue(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(encodeHostValue).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${encodeHostValue(value[key])}`).join(',')}}`;
}

export function hostCanonicalBytes(value) {
  assertTreeBounds(value);
  const output = Buffer.from(encodeHostValue(value), 'utf8');
  if (output.length > HOST_CONTRACT_LIMITS.maxDocumentBytes) fail('KSTACK_HOST_DOCUMENT_BYTES_EXCEEDED');
  return output;
}

export function hostAddress(domain, value) {
  if (typeof domain !== 'string' || !ARTIFACT_DOMAIN.test(domain)) fail('KSTACK_HOST_DOMAIN_INVALID');
  return `sha256:${crypto.createHash('sha256').update(domain, 'ascii').update(Buffer.from([0])).update(hostCanonicalBytes(value)).digest('hex')}`;
}

export function assertDigest(value) {
  if (typeof value !== 'string' || !DIGEST.test(value)) fail('KSTACK_HOST_DIGEST_INVALID');
  return value;
}

export function assertAsciiId(value) {
  if (typeof value !== 'string' || !ASCII_ID.test(value)) fail('KSTACK_HOST_ASCII_ID_INVALID');
  return value;
}

export function assertRegistryId(value) {
  if (typeof value !== 'string' || !ASCII_ID.test(value) && !STABLE_CODE_ID.test(value)) fail('KSTACK_HOST_REGISTRY_ID_INVALID');
  return value;
}

export function assertSafeUInt(value, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) fail('KSTACK_HOST_SAFE_UINT_INVALID');
  return value;
}

export function assertTimestamp(value) {
  if (typeof value !== 'string' || value.length !== 24) fail('KSTACK_HOST_TIMESTAMP_INVALID');
  const match = TIMESTAMP.exec(value);
  if (!match) fail('KSTACK_HOST_TIMESTAMP_INVALID');
  const [, year, month, day, hour, minute, second] = match;
  if (year === '0000' || +month < 1 || +month > 12 || +hour > 23 || +minute > 59 || +second > 59) fail('KSTACK_HOST_TIMESTAMP_INVALID');
  const days = new Date(Date.UTC(+year, +month, 0)).getUTCDate();
  if (+day < 1 || +day > days) fail('KSTACK_HOST_TIMESTAMP_INVALID');
  return value;
}

function scalarKey(value, kind) {
  if (kind === 'ASCII') return Buffer.from(assertAsciiScalar(value), 'ascii');
  if (kind === 'DIGEST') return Buffer.from(assertDigest(value), 'ascii');
  if (kind === 'ASCII_CANONICAL_UINT') return Buffer.from(String(assertSafeUInt(value)), 'ascii');
  fail('KSTACK_HOST_COLLECTION_KEY_KIND_INVALID');
}

function assertAsciiScalar(value) {
  if (typeof value !== 'string' || !/^[\x21-\x7e]+$/u.test(value)) fail('KSTACK_HOST_ASCII_VALUE_INVALID');
  return value;
}

function tupleKey(member, keyFields, keyKinds) {
  if (!member || typeof member !== 'object' || Array.isArray(member)) fail('KSTACK_HOST_COLLECTION_MEMBER_INVALID');
  const parts = keyFields.map((field, index) => {
    if (!Object.hasOwn(member, field)) fail('KSTACK_HOST_COLLECTION_KEY_MISSING');
    const value = scalarKey(member[field], keyKinds[index]);
    return Buffer.concat([Buffer.from(value.length.toString(16).padStart(8, '0'), 'ascii'), value]);
  });
  return Buffer.concat(parts);
}

export function validateCollectionDeclaration(collection) {
  if (!collection || typeof collection !== 'object' || Array.isArray(collection)) fail('KSTACK_HOST_COLLECTION_INVALID');
  const keys = Object.keys(collection).sort();
  if (!COLLECTION_MODES.has(collection.mode)) fail('KSTACK_HOST_COLLECTION_MODE_INVALID');
  if (collection.mode !== 'SET_BY_FIELDS') {
    if (keys.join(',') !== 'mode') fail('KSTACK_HOST_COLLECTION_INVALID');
    return collection;
  }
  if (keys.join(',') !== 'keyFields,keyKinds,mode') fail('KSTACK_HOST_COLLECTION_INVALID');
  if (!Array.isArray(collection.keyFields) || !Array.isArray(collection.keyKinds)
      || collection.keyFields.length < 1 || collection.keyFields.length > 4
      || collection.keyFields.length !== collection.keyKinds.length) fail('KSTACK_HOST_COLLECTION_INVALID');
  if (new Set(collection.keyFields).size !== collection.keyFields.length) fail('KSTACK_HOST_COLLECTION_KEY_DUPLICATE');
  for (const field of collection.keyFields) if (typeof field !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/u.test(field)) fail('KSTACK_HOST_COLLECTION_KEY_FIELD_INVALID');
  for (const kind of collection.keyKinds) if (!KEY_KINDS.has(kind)) fail('KSTACK_HOST_COLLECTION_KEY_KIND_INVALID');
  return collection;
}

export function assertCollectionOrder(value, collection) {
  if (!Array.isArray(value)) fail('KSTACK_HOST_COLLECTION_VALUE_INVALID');
  validateCollectionDeclaration(collection);
  if (collection.mode === 'ORDERED') return value;
  let prior = null;
  for (const member of value) {
    let key;
    if (collection.mode === 'SET_BY_VALUE_ASCII') key = Buffer.from(assertAsciiScalar(member), 'ascii');
    else if (collection.mode === 'SET_BY_VALUE_DIGEST') key = Buffer.from(assertDigest(member), 'ascii');
    else key = tupleKey(member, collection.keyFields, collection.keyKinds);
    if (prior && Buffer.compare(prior, key) >= 0) fail(Buffer.compare(prior, key) === 0
      ? 'KSTACK_HOST_COLLECTION_DUPLICATE'
      : 'KSTACK_HOST_COLLECTION_NOT_SORTED');
    prior = key;
  }
  return value;
}

function exactKeys(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('KSTACK_HOST_RECORD_INVALID');
  const allowed = new Set([...required, ...optional]);
  for (const key of required) if (!Object.hasOwn(value, key)) fail('KSTACK_HOST_REQUIRED_FIELD_MISSING');
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail('KSTACK_HOST_ADDITIONAL_PROPERTY');
}

const primitive = Object.freeze({
  digest: (value) => assertDigest(value),
  ascii: (value) => assertAsciiId(value),
  registryId: (value) => assertRegistryId(value),
  timestamp: (value) => assertTimestamp(value),
  uint: (value) => assertSafeUInt(value),
  positive: (value) => assertSafeUInt(value, true),
  artifactDomain: (value) => { if (typeof value !== 'string' || !ARTIFACT_DOMAIN.test(value)) fail('KSTACK_HOST_DOMAIN_INVALID'); },
  boolean: (value) => { if (typeof value !== 'boolean') fail('KSTACK_HOST_BOOLEAN_INVALID'); },
  null: (value) => { if (value !== null) fail('KSTACK_HOST_NULL_INVALID'); }
});

function validateType(value, type, context) {
  if (typeof type === 'string') return primitive[type](value);
  if (Object.hasOwn(type, 'const')) {
    if (value !== type.const) fail('KSTACK_HOST_CONST_INVALID');
    return value;
  }
  if (type.nullable) return value === null ? value : validateType(value, type.nullable, context);
  if (type.enum) {
    if (!type.enum.includes(value)) fail('KSTACK_HOST_ENUM_INVALID');
    return value;
  }
  if (type.ref) return context.validate(type.ref, value);
  if (type.registry) {
    assertRegistryId(value);
    const collection = context.vocabulary?.[type.registry] || context.vocabulary?.[REGISTRY_COLLECTION_IDS[type.registry]];
    if (!collection?.has(value)) fail('KSTACK_HOST_REGISTRY_REFERENCE_INVALID');
    return value;
  }
  if (type.array) {
    if (!Array.isArray(value) || value.length < type.min || value.length > type.max) fail('KSTACK_HOST_ARRAY_BOUNDS_INVALID');
    for (const member of value) validateType(member, type.array, context);
    assertCollectionOrder(value, type.collection);
    return value;
  }
  fail('KSTACK_HOST_TYPE_INVALID');
}

const arr = (array, min, max, collection = { mode: 'ORDERED' }) => ({ array, min, max, collection });
const nullable = (type) => ({ nullable: type });
const enumeration = (...values) => ({ enum: values });
const constant = (value) => ({ const: value });
const ref = (name) => ({ ref: name });
const registry = (name) => ({ registry: name });

function record(fields) { return Object.freeze(fields); }

const digestSet = (min, max) => arr('digest', min, max, { mode: 'SET_BY_VALUE_DIGEST' });

const NESTED_RECORDS = Object.freeze({
  ArtifactRefV1: record({ schemaDigest: 'digest', objectDigest: 'digest', byteCount: 'uint' }),
  NamedArtifactRefV1: record({ name: 'ascii', mediaTypeId: registry('mediaTypes'), artifactRef: ref('ArtifactRefV1') }),
  LimitSetV1: record({ deadlineMs: 'positive', maxInputBytes: 'positive', maxOutputBytes: 'positive' }),
  CapabilityRequirementV1: record({ capabilityId: registry('capabilityIds'), evidenceProfileDigest: 'digest', mandatory: 'boolean' }),
  AlternateProfileRefV1: record({ profileId: registry('operationProfileIds'), requirementProfileDigest: 'digest', maximumStatus: enumeration('DEGRADED_REGISTERED') }),
  ObservationRowV1: record({ capabilityId: registry('capabilityIds'), state: enumeration('DECLARED', 'OBSERVED', 'UNKNOWN'), observationEvidenceDigest: nullable('digest') }),
  ConformanceResultRowV1: record({ capabilityId: registry('capabilityIds'), fixtureId: registry('fixtureIds'), outcome: enumeration('PASS', 'FAIL', 'NOT_RUN', 'CAPABILITY_UNAVAILABLE', 'HARNESS_ERROR'), evidenceDigest: 'digest' }),
  EvidenceRefV1: record({ evidenceDigest: 'digest', schemaDigest: 'digest', issuedAt: 'timestamp', expiresAt: 'timestamp' }),
  ComponentBindingV1: record({ componentRole: registry('componentRoles'), componentId: 'ascii', componentDigest: 'digest' })
});

const KEYWORDS = Object.freeze([
  '$ref', 'additionalProperties', 'const', 'enum', 'items', 'maxItems', 'maxLength', 'maximum', 'minItems', 'minLength',
  'minimum', 'oneOf', 'pattern', 'properties', 'required', 'type', 'x-kstack-collection'
]);

const BOOTSTRAP_NESTED_RECORDS = Object.freeze({
  ResourceLimitsV1: record({
    maxDocumentBytes: constant(1_048_576), maxDepth: constant(32), maxObjectProperties: constant(64),
    maxArrayItems: constant(1_024), maxStringUtf8Bytes: constant(16_384), maxSchemas: constant(256),
    maxRefEdges: constant(2_048), maxPatternBytes: constant(256), maxPatternDfaStates: constant(4_096)
  }),
  VocabularyEntryV1: record({ id: 'registryId' }),
  VocabularyCollectionV1: record({
    collectionId: 'ascii', entries: arr(ref('VocabularyEntryV1'), 1, 1024, { mode: 'SET_BY_FIELDS', keyFields: ['id'], keyKinds: ['ASCII'] })
  }),
  InvariantEntryV1: record({
    invariantId: 'ascii', implementationDigest: 'digest', applicableSchemaIds: arr('ascii', 1, 64, { mode: 'SET_BY_VALUE_ASCII' }),
    vectorIds: arr('ascii', 1, 256, { mode: 'SET_BY_VALUE_ASCII' })
  }),
  ResolverEntryV1: record({
    resolverId: 'ascii', schemaLanguageVersion: 'ascii', implementationDigest: 'digest',
    supportedMetaschemaDigests: digestSet(1, 32), supportedCanonicalizationProfileDigests: digestSet(1, 32),
    invariantRegistryDigests: digestSet(1, 32), vectorSetDigest: 'digest'
  }),
  VectorEntryV1: record({
    vectorId: 'ascii', operationId: 'ascii', inputBytesDigest: 'digest', expectedOutcome: enumeration('ACCEPT', 'REJECT'),
    expectedCanonicalBytesDigest: nullable('digest'), expectedObjectDigest: nullable('digest')
  }),
  SchemaEntryV1: record({ schemaId: 'ascii', schemaVersion: 'positive', schemaDigest: 'digest', artifactDomain: 'artifactDomain' })
});

export const HOST_BOOTSTRAP_SCHEMAS = Object.freeze({
  KStackClosedMetaschemaV1: record({
    schemaId: constant('kstack.closed-metaschema.v1'), schemaVersion: constant(1), schemaLanguageVersion: constant('kstack-closed-schema-v1'),
    permittedKeywords: arr(enumeration(...KEYWORDS), 1, 32, { mode: 'SET_BY_VALUE_ASCII' }), regexGrammarDigest: 'digest',
    collectionGrammarDigest: 'digest', resourceLimits: ref('ResourceLimitsV1')
  }),
  CanonicalizationProfileV1: record({
    schemaId: constant('kstack.canonicalization-profile.v1'), schemaVersion: constant(1), profileId: constant('rfc8785-kstack-v1'),
    rfc8785SpecDigest: 'digest', unicodePolicy: constant('VALID_SCALAR_NFC_REJECT_OTHER'), numberPolicy: constant('SAFE_INTEGER_CANONICAL_ONLY'),
    timestampPolicy: constant('UTC_MILLISECOND_YEAR0001_9999'), duplicateKeyPolicy: constant('REJECT_BEFORE_PARSE'),
    collectionGrammarDigest: 'digest', regexGrammarDigest: 'digest'
  }),
  ClosedVocabularyRegistryV1: record({
    schemaId: constant('kstack.closed-vocabulary-registry.v1'), schemaVersion: constant(1), registryId: 'ascii',
    collections: arr(ref('VocabularyCollectionV1'), 1, 64, { mode: 'SET_BY_FIELDS', keyFields: ['collectionId'], keyKinds: ['ASCII'] })
  }),
  InvariantRegistryV1: record({
    schemaId: constant('kstack.invariant-registry.v1'), schemaVersion: constant(1), registryId: 'ascii',
    entries: arr(ref('InvariantEntryV1'), 1, 256, { mode: 'SET_BY_FIELDS', keyFields: ['invariantId'], keyKinds: ['ASCII'] })
  }),
  HistoricalResolverSetV1: record({
    schemaId: constant('kstack.historical-resolver-set.v1'), schemaVersion: constant(1), resolverSetId: 'ascii',
    entries: arr(ref('ResolverEntryV1'), 1, 32, { mode: 'SET_BY_FIELDS', keyFields: ['resolverId'], keyKinds: ['ASCII'] })
  }),
  CrossRuntimeVectorSetV1: record({
    schemaId: constant('kstack.cross-runtime-vector-set.v1'), schemaVersion: constant(1), vectorSetId: 'ascii',
    entries: arr(ref('VectorEntryV1'), 1, 2048, { mode: 'SET_BY_FIELDS', keyFields: ['vectorId'], keyKinds: ['ASCII'] })
  }),
  HostContractSchemaSetV1: record({
    schemaId: constant('kstack.host-contract-schema-set.v1'), schemaVersion: constant(1), metaschemaDigest: 'digest',
    schemaLanguageVersion: constant('kstack-closed-schema-v1'), canonicalizationProfileDigest: 'digest',
    schemaEntries: arr(ref('SchemaEntryV1'), 1, 256, { mode: 'SET_BY_FIELDS', keyFields: ['schemaId', 'schemaVersion'], keyKinds: ['ASCII', 'ASCII_CANONICAL_UINT'] }),
    closedVocabularyRegistryDigest: 'digest', invariantRegistryDigest: 'digest', historicalResolverSetDigest: 'digest', crossRuntimeVectorSetDigest: 'digest'
  })
});

export const HOST_BOOTSTRAP_IDENTITIES = Object.freeze({
  KStackClosedMetaschemaV1: { schemaId: 'kstack.closed-metaschema.v1', domain: HOST_CONTRACT_DOMAINS['kstack.closed-metaschema.v1'] },
  CanonicalizationProfileV1: { schemaId: 'kstack.canonicalization-profile.v1', domain: HOST_CONTRACT_DOMAINS['kstack.canonicalization-profile.v1'] },
  ClosedVocabularyRegistryV1: { schemaId: 'kstack.closed-vocabulary-registry.v1', domain: HOST_CONTRACT_DOMAINS['kstack.closed-vocabulary-registry.v1'] },
  InvariantRegistryV1: { schemaId: 'kstack.invariant-registry.v1', domain: HOST_CONTRACT_DOMAINS['kstack.invariant-registry.v1'] },
  HistoricalResolverSetV1: { schemaId: 'kstack.historical-resolver-set.v1', domain: HOST_CONTRACT_DOMAINS['kstack.historical-resolver-set.v1'] },
  CrossRuntimeVectorSetV1: { schemaId: 'kstack.cross-runtime-vector-set.v1', domain: HOST_CONTRACT_DOMAINS['kstack.cross-runtime-vector-set.v1'] },
  HostContractSchemaSetV1: { schemaId: 'kstack.host-contract-schema-set.v1', domain: HOST_CONTRACT_DOMAINS['kstack.host-contract-schema-set.v1'] }
});

const namedArtifacts = arr(ref('NamedArtifactRefV1'), 0, 64, { mode: 'SET_BY_FIELDS', keyFields: ['name'], keyKinds: ['ASCII'] });
const asciiSet = (registryName, max = 256) => arr(registryName ? registry(registryName) : 'ascii', 0, max, { mode: 'SET_BY_VALUE_ASCII' });

export const HOST_ARTIFACT_SCHEMAS = Object.freeze({
  OperationRequestV1: record({
    operationId: registry('operationIds'), operationSchemaDigest: 'digest', requirementProfileDigest: 'digest',
    repositoryContextDigest: 'digest', trustedRequestContextDigest: 'digest', activeSetDigest: 'digest', policyDigest: 'digest',
    inputs: namedArtifacts, limits: ref('LimitSetV1'), authorityEnvelopeDigest: nullable('digest'), hostEvidenceSetDigest: 'digest',
    nonceDigest: 'digest', idempotencyKeyDigest: 'digest', createdAt: 'timestamp', expiresAt: 'timestamp'
  }),
  OperationResultV1: record({
    requestDigest: 'digest', operationId: registry('operationIds'), activeSetDigest: 'digest',
    status: enumeration('SUCCEEDED', 'DENIED', 'FAILED', 'AMBIGUOUS', 'CANCELLED'), startedAt: 'timestamp', completedAt: 'timestamp',
    outputs: namedArtifacts, errorDigest: nullable('digest'), receiptProfileDigest: 'digest'
  }),
  OperationErrorV1: record({
    requestDigest: 'digest', errorCode: registry('errorCodes'), retryDisposition: enumeration('NEVER', 'RECORDED_RESULT_ONLY', 'RECONCILIATION_REQUIRED'),
    affectedIds: asciiSet(null, 128), correlationDigest: 'digest', detailArtifactDigest: nullable('digest')
  }),
  OperationRequirementProfileV1: record({
    operationId: registry('operationIds'), operationSchemaDigest: 'digest', operationClassId: registry('operationClassIds'),
    requiredCapabilities: arr(ref('CapabilityRequirementV1'), 0, 256, { mode: 'SET_BY_FIELDS', keyFields: ['capabilityId'], keyKinds: ['ASCII'] }),
    negativeFixtureIds: asciiSet('fixtureIds'), receiptProfileDigest: 'digest', actionFenceProfileDigest: 'digest',
    alternateProfiles: arr(ref('AlternateProfileRefV1'), 0, 32, { mode: 'SET_BY_FIELDS', keyFields: ['profileId'], keyKinds: ['ASCII'] })
  }),
  HostObservationV1: record({
    hostInstanceDigest: 'digest', hostBuildDigest: 'digest', adapterDigest: 'digest', environmentDigest: 'digest',
    observations: arr(ref('ObservationRowV1'), 0, 256, { mode: 'SET_BY_FIELDS', keyFields: ['capabilityId'], keyKinds: ['ASCII'] }),
    limitationsReasonCodes: asciiSet('reasonCodes', 128), observedAt: 'timestamp', expiresAt: 'timestamp'
  }),
  HostConformanceEvidenceBodyV1: record({
    hostInstanceDigest: 'digest', hostBuildDigest: 'digest', adapterDigest: 'digest', harnessDigest: 'digest', fixtureSetDigest: 'digest', environmentDigest: 'digest',
    results: arr(ref('ConformanceResultRowV1'), 1, 1024, { mode: 'SET_BY_FIELDS', keyFields: ['capabilityId', 'fixtureId'], keyKinds: ['ASCII', 'ASCII'] }),
    issuedAt: 'timestamp', expiresAt: 'timestamp'
  }),
  HostConformanceEvidenceV1: record({
    hostInstanceDigest: 'digest', hostBuildDigest: 'digest', adapterDigest: 'digest', harnessDigest: 'digest', fixtureSetDigest: 'digest', environmentDigest: 'digest',
    results: arr(ref('ConformanceResultRowV1'), 1, 1024, { mode: 'SET_BY_FIELDS', keyFields: ['capabilityId', 'fixtureId'], keyKinds: ['ASCII', 'ASCII'] }),
    issuedAt: 'timestamp', expiresAt: 'timestamp', anchorDigest: 'digest'
  }),
  HostEvidenceSetV1: record({
    hostInstanceDigest: 'digest', activeSetDigest: 'digest', policyDigest: 'digest',
    evidenceRefs: arr(ref('EvidenceRefV1'), 1, 256, { mode: 'SET_BY_FIELDS', keyFields: ['evidenceDigest'], keyKinds: ['DIGEST'] }),
    assembledAt: 'timestamp', shortestExpiryAt: 'timestamp'
  }),
  OperationEligibilityV1: record({
    operationId: registry('operationIds'), requirementProfileDigest: 'digest', hostEvidenceSetDigest: 'digest', activeSetDigest: 'digest', policyDigest: 'digest',
    status: enumeration('FULL', 'DEGRADED_REGISTERED', 'UNSUPPORTED', 'QUARANTINED'), alternateProfileId: nullable(registry('operationProfileIds')),
    provenCapabilityIds: asciiSet('capabilityIds'), missingCapabilityIds: asciiSet('capabilityIds'), reasonCodes: asciiSet('reasonCodes', 128),
    evaluatedAt: 'timestamp', expiresAt: 'timestamp'
  }),
  CompatibilityEntryV1: record({
    compatibilityId: 'ascii', componentBindings: arr(ref('ComponentBindingV1'), 1, 64, { mode: 'SET_BY_FIELDS', keyFields: ['componentRole'], keyKinds: ['ASCII'] }),
    externalHostConstraintDigest: 'digest', compatibleHostContractSchemaSetDigest: 'digest', compatibleResolverSetDigest: 'digest',
    migrationProfileDigest: nullable('digest'), allowedOperationProfileDigests: digestSet(1, 256)
  }),
  ActivationRecordV1: record({
    candidateActiveSetDigest: 'digest', priorActiveSetDigest: nullable('digest'), compatibilityEntryDigest: 'digest', migrationEvidenceDigest: nullable('digest'),
    rollbackEvidenceDigest: nullable('digest'), state: enumeration('STAGED', 'VALIDATED', 'ACTIVE', 'REJECTED', 'ROLLED_BACK'),
    reasonCodes: asciiSet('reasonCodes', 128), createdAt: 'timestamp', decidedAt: nullable('timestamp')
  }),
  OperationLeaseV1: record({
    requestDigest: 'digest', operationId: registry('operationIds'), activeSetDigest: 'digest', policyDigest: 'digest', hostEvidenceSetDigest: 'digest',
    repositoryContextDigest: 'digest', admissionEpoch: 'uint', issuedAt: 'timestamp', expiresAt: 'timestamp', state: enumeration('ADMITTED', 'FENCED', 'COMPLETED', 'RECONCILE')
  }),
  OperationReceiptV1: record({
    requestDigest: 'digest', resultDigest: 'digest', operationId: registry('operationIds'), operationClassId: registry('operationClassIds'), activeSetDigest: 'digest',
    producerId: 'ascii', receiptKind: registry('receiptKinds'), producerReceiptDigest: nullable('digest'), localAuditDigest: nullable('digest'), issuedAt: 'timestamp'
  }),
  QuarantineEventV1: record({
    subjectType: registry('quarantineSubjectTypes'), subjectDigest: 'digest', scopeOperationIds: asciiSet('operationIds'), reasonCode: registry('reasonCodes'),
    sourceEvidenceDigest: 'digest', previousEligibilityDigests: digestSet(0, 256), effectiveAt: 'timestamp', expiresAt: nullable('timestamp'), eventAnchorDigest: 'digest'
  }),
  SchemaOfferV1: record({
    hostInstanceDigest: 'digest', schemaSetDigests: digestSet(1, 32), resolverSetDigests: digestSet(1, 32),
    operationProfileDigests: digestSet(0, 256), offeredAt: 'timestamp', expiresAt: 'timestamp'
  }),
  SchemaSelectionV1: record({
    offerDigest: 'digest', selectedSchemaSetDigest: 'digest', selectedResolverSetDigest: 'digest', selectedOperationProfileDigests: digestSet(0, 256),
    compatibilityEntryDigest: 'digest', selectedAt: 'timestamp', expiresAt: 'timestamp'
  }),
  HistoricalResolutionReceiptV1: record({
    artifactDigest: 'digest', artifactSchemaSetDigest: 'digest', artifactSchemaDigest: 'digest', resolverSetDigest: 'digest',
    validationOutcome: enumeration('VALID', 'INVALID', 'UNAVAILABLE'), resolvedAt: 'timestamp', evidenceDigest: 'digest'
  })
});

export const HOST_ARTIFACT_IDENTITIES = Object.freeze(Object.fromEntries(
  Object.keys(HOST_ARTIFACT_SCHEMAS).map((name) => {
    const stem = name.replace(/V1$/u, '').replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase();
    return [name, Object.freeze({ schemaId: `kstack.${stem}.v1`, schemaVersion: 1, domain: `KSTACK-${stem.toUpperCase()}-V1` })];
  })
));

function schemaName(prefix, name) {
  const stem = name.replace(/V1$/u, '').replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase();
  return `kstack.${prefix}.${stem}.v1`;
}

const PRIMITIVE_CLOSED_SCHEMAS = Object.freeze({
  digest: Object.freeze({ type: 'string', minLength: 71, maxLength: 71, pattern: '^sha256:[0-9a-f]{64}$' }),
  ascii: Object.freeze({ type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-z0-9][a-z0-9._-]{0,127}$' }),
  registryId: Object.freeze({ oneOf: [
    { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-z0-9][a-z0-9._-]{0,127}$' },
    { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Z][A-Z0-9_]{0,127}$' }
  ] }),
  timestamp: Object.freeze({ type: 'string', minLength: 24, maxLength: 24, pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$' }),
  uint: Object.freeze({ type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  positive: Object.freeze({ type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
  artifactDomain: Object.freeze({ type: 'string', minLength: 1, maxLength: 128, pattern: '^KSTACK-[A-Z0-9-]+-V[0-9]+$' }),
  boolean: Object.freeze({ type: 'boolean' }),
  null: Object.freeze({ type: 'null' })
});

function expandClosedType(type, nestedPrefix, registryContext) {
  if (typeof type === 'string') return structuredClone(PRIMITIVE_CLOSED_SCHEMAS[type]);
  if (Object.hasOwn(type, 'const')) return { const: type.const };
  if (type.enum) return { enum: [...type.enum] };
  if (type.nullable) return { oneOf: [{ type: 'null' }, expandClosedType(type.nullable, nestedPrefix, registryContext)] };
  if (type.ref) {
    if (registryContext?.inlineNested) return expandClosedRecord(NESTED_RECORDS[type.ref], nestedPrefix, registryContext);
    return { $ref: schemaName(nestedPrefix, type.ref) };
  }
  if (type.registry) {
    const collectionId = REGISTRY_COLLECTION_IDS[type.registry];
    const hasCollection = registryContext?.registryIds?.has(collectionId) || (registryContext instanceof Set && registryContext.has(collectionId));
    if (!collectionId || !hasCollection) fail('KSTACK_HOST_VOCABULARY_REQUIRED');
    if (registryContext?.registryValues) return { enum: [...registryContext.registryValues[collectionId]] };
    return { $ref: `kstack.registry.${collectionId}.v1` };
  }
  if (type.array) {
    return {
      type: 'array', items: expandClosedType(type.array, nestedPrefix, registryContext), minItems: type.min, maxItems: type.max,
      'x-kstack-collection': structuredClone(type.collection)
    };
  }
  fail('KSTACK_HOST_TYPE_INVALID');
}

function expandClosedRecord(fields, nestedPrefix, registryContext, head = null) {
  const properties = {};
  if (head) {
    properties.schemaId = { const: head.schemaId };
    properties.schemaVersion = { const: 1 };
    properties.schemaSetDigest = structuredClone(PRIMITIVE_CLOSED_SCHEMAS.digest);
  }
  for (const [field, type] of Object.entries(fields)) properties[field] = expandClosedType(type, nestedPrefix, registryContext);
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

function freezeSchemaDocuments(entries) {
  const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const member of Object.values(value)) deepFreeze(member);
    return Object.freeze(value);
  };
  return Object.freeze(entries.map((entry) => {
    const canonical = hostCanonicalBytes(entry.schema);
    return Object.freeze({
      schemaId: entry.schemaId,
      schema: deepFreeze(entry.schema),
      canonicalJson: canonical.toString('utf8'),
      schemaDigest: sha256Digest(canonical)
    });
  }));
}

function buildBootstrapSchemaDocuments() {
  const entries = [];
  for (const [name, fields] of Object.entries(BOOTSTRAP_NESTED_RECORDS)) entries.push({
    schemaId: schemaName('bootstrap-type', name), schema: expandClosedRecord(fields, 'bootstrap-type', null)
  });
  for (const [name, fields] of Object.entries(HOST_BOOTSTRAP_SCHEMAS)) entries.push({
    schemaId: schemaName('bootstrap', name), schema: expandClosedRecord(fields, 'bootstrap-type', null)
  });
  return freezeSchemaDocuments(entries);
}

export const HOST_BOOTSTRAP_SCHEMA_DOCUMENTS = buildBootstrapSchemaDocuments();
export const HOST_BOOTSTRAP_SCHEMA_DIGESTS = Object.freeze(Object.fromEntries(
  HOST_BOOTSTRAP_SCHEMA_DOCUMENTS.map((entry) => [entry.schemaId, entry.schemaDigest])
));

let bootstrapSchemaCompiler = null;

export function buildHostArtifactSchemaSet(vocabulary) {
  const normalized = normalizeVocabulary(vocabulary);
  const registryIds = new Set(Object.keys(normalized).map((name) => REGISTRY_COLLECTION_IDS[name] || name));
  const registryValues = {};
  for (const collectionId of registryIds) {
    const symbolic = Object.keys(REGISTRY_COLLECTION_IDS).find((name) => REGISTRY_COLLECTION_IDS[name] === collectionId);
    const values = [...(normalized[collectionId] || normalized[symbolic] || [])].sort();
    if (values.length === 0) fail('KSTACK_HOST_VOCABULARY_INVALID');
    registryValues[collectionId] = values;
  }
  const context = { registryIds, registryValues, inlineNested: true };
  const entries = [];
  for (const [name, fields] of Object.entries(HOST_ARTIFACT_SCHEMAS)) entries.push({
    schemaId: HOST_ARTIFACT_IDENTITIES[name].schemaId,
    schema: expandClosedRecord(fields, 'type', context, HOST_ARTIFACT_IDENTITIES[name])
  });
  const documents = freezeSchemaDocuments(entries);
  const compiler = compileClosedSchemaSet(documents.map((entry) => ({ schemaId: entry.schemaId, schema: entry.schema })));
  return Object.freeze({
    documents,
    schemaDigests: Object.freeze(Object.fromEntries(documents.map((entry) => [entry.schemaId, entry.schemaDigest]))),
    validate(schemaId, value) { return compiler.validate(schemaId, value); }
  });
}

function normalizeVocabulary(vocabulary) {
  if (!vocabulary || typeof vocabulary !== 'object' || Array.isArray(vocabulary)) fail('KSTACK_HOST_VOCABULARY_REQUIRED');
  const output = {};
  for (const [collection, entries] of Object.entries(vocabulary)) {
    if (!/^[A-Za-z][A-Za-z0-9-]{0,63}$/u.test(collection)) fail('KSTACK_HOST_VOCABULARY_INVALID');
    if (!Array.isArray(entries) && !(entries instanceof Set)) fail('KSTACK_HOST_VOCABULARY_INVALID');
    const values = [...entries];
    const set = new Set();
    for (const entry of values) {
      assertRegistryId(entry);
      if (set.has(entry)) fail('KSTACK_HOST_VOCABULARY_DUPLICATE');
      set.add(entry);
    }
    output[collection] = set;
  }
  return output;
}

function validateRecord(name, value, fields, context, artifact = false) {
  const head = artifact ? ['schemaId', 'schemaVersion', 'schemaSetDigest'] : [];
  exactKeys(value, [...head, ...Object.keys(fields)]);
  if (artifact) {
    const identity = HOST_ARTIFACT_IDENTITIES[name];
    if (value.schemaId !== identity.schemaId || value.schemaVersion !== 1) fail('KSTACK_HOST_ARTIFACT_HEAD_INVALID');
    assertDigest(value.schemaSetDigest);
  }
  for (const [field, type] of Object.entries(fields)) validateType(value[field], type, context);
  return value;
}

// Each `check*` function below carries the structural predicate of one
// registered invariant ID; the matching `dispatch*` wrapper below carries the
// artifact-name guard that decides whether that predicate runs at all. Both
// are hashed into that ID's entry in HOST_INVARIANT_IMPLEMENTATION_DIGESTS, so
// a predicate edit and a dispatch-guard edit each move the digest the invariant
// registry must attest to. HOST_INVARIANT_IMPLEMENTATIONS states the exact
// closure every entry hashes and names the primitives deliberately outside it.

function checkRequestTimeOrderV1(value) {
  if (value.createdAt >= value.expiresAt) fail('KSTACK_HOST_INVARIANT_REQUEST_TIME_ORDER_V1');
}

function checkResultShapeV1(value) {
  if (value.startedAt > value.completedAt) fail('KSTACK_HOST_INVARIANT_RESULT_SHAPE_V1');
  const success = value.status === 'SUCCEEDED';
  if ((success && value.errorDigest !== null) || (!success && value.errorDigest === null) || (!success && value.outputs.length !== 0)) fail('KSTACK_HOST_INVARIANT_RESULT_SHAPE_V1');
}

function checkObservationShapeV1(value) {
  for (const row of value.observations) if ((row.state === 'UNKNOWN') !== (row.observationEvidenceDigest === null)) fail('KSTACK_HOST_INVARIANT_OBSERVATION_SHAPE_V1');
}

function checkEvidenceTimeV1(name, value) {
  if (name === 'HostObservationV1' && value.observedAt >= value.expiresAt) fail('KSTACK_HOST_INVARIANT_EVIDENCE_TIME_V1');
  if ((name === 'HostConformanceEvidenceBodyV1' || name === 'HostConformanceEvidenceV1') && value.issuedAt >= value.expiresAt) fail('KSTACK_HOST_INVARIANT_EVIDENCE_TIME_V1');
  if (name === 'HostEvidenceSetV1') {
    if (value.assembledAt >= value.shortestExpiryAt
        || value.evidenceRefs.some((entry) => entry.issuedAt >= entry.expiresAt)
        || value.shortestExpiryAt !== value.evidenceRefs.reduce((minimum, entry) => entry.expiresAt < minimum ? entry.expiresAt : minimum, value.evidenceRefs[0].expiresAt)) {
      fail('KSTACK_HOST_INVARIANT_EVIDENCE_TIME_V1');
    }
  }
  if (name === 'OperationEligibilityV1' && value.evaluatedAt >= value.expiresAt) fail('KSTACK_HOST_INVARIANT_EVIDENCE_TIME_V1');
  if (name === 'OperationLeaseV1' && value.issuedAt >= value.expiresAt) fail('KSTACK_HOST_INVARIANT_EVIDENCE_TIME_V1');
  // SchemaOfferV1.offeredAt and SchemaSelectionV1.selectedAt are deliberately
  // NOT checked here. repair-r2 §4 scopes evidence-time-v1 to issued/observed/
  // assembled/evaluated times, and HOST_INVARIANT_APPLICABLE_SCHEMAS[
  // 'evidence-time-v1'] correspondingly omits kstack.schema-offer.v1 and
  // kstack.schema-selection.v1; enforcing either here would make this predicate
  // reject artifacts the attested applicability list says it never inspects.
  // Selection windows are contained by selection-exact-v1 instead. Removing
  // these two checks is owner-approved (host-portability-2026-09-02-hp-tc01
  // "Fix B", r4-independent-review verdict pass) — do not restore them.
}

function checkEligibilityPartitionV1(value) {
  const degraded = value.status === 'DEGRADED_REGISTERED';
  if (degraded !== (value.alternateProfileId !== null)) fail('KSTACK_HOST_INVARIANT_ELIGIBILITY_PARTITION_V1');
  const proven = new Set(value.provenCapabilityIds);
  if (value.missingCapabilityIds.some((entry) => proven.has(entry))) fail('KSTACK_HOST_INVARIANT_ELIGIBILITY_PARTITION_V1');
}

function checkReceiptAcyclicV1(value) {
  if (value.producerReceiptDigest === null && value.localAuditDigest === null) fail('KSTACK_HOST_INVARIANT_RECEIPT_ACYCLIC_V1');
}

function checkActivationShapeV1(value) {
  if ((value.state === 'STAGED') !== (value.decidedAt === null)) fail('KSTACK_HOST_INVARIANT_ACTIVATION_SHAPE_V1');
}

// One structural dispatch wrapper per registered invariant ID. The wrapper —
// not `localInvariants` — owns the artifact-name guard, so a wrapper is hashed
// into exactly one invariant's digest and neutering one guard moves exactly one
// digest. `localInvariants` itself holds no per-invariant line to delete: it
// iterates the table below, and that same table supplies the wrapper hashed
// into each entry of HOST_INVARIANT_IMPLEMENTATIONS, so deleting a table row
// makes the digest computation fail at module evaluation rather than silently
// disabling an attested invariant. Table key order fixes which invariant's
// error code wins when an artifact violates two of them, and that order is
// itself hashed into all eleven digests through
// HOST_INVARIANT_DISPATCH_TABLE_SHAPE, so a reorder is attested rather than
// free (see HOST_INVARIANT_IMPLEMENTATIONS).

function dispatchRequestTimeOrderV1(name, value) {
  if (name === 'OperationRequestV1') checkRequestTimeOrderV1(value);
}

function dispatchResultShapeV1(name, value) {
  if (name === 'OperationResultV1') checkResultShapeV1(value);
}

function dispatchObservationShapeV1(name, value) {
  if (name === 'HostObservationV1') checkObservationShapeV1(value);
}

function dispatchEvidenceTimeV1(name, value) {
  checkEvidenceTimeV1(name, value);
}

function dispatchEligibilityPartitionV1(name, value) {
  if (name === 'OperationEligibilityV1') checkEligibilityPartitionV1(value);
}

function dispatchReceiptAcyclicV1(name, value) {
  if (name === 'OperationReceiptV1') checkReceiptAcyclicV1(value);
}

function dispatchActivationShapeV1(name, value) {
  if (name === 'ActivationRecordV1') checkActivationShapeV1(value);
}

const STRUCTURAL_INVARIANT_DISPATCH = Object.freeze({
  'request-time-order-v1': dispatchRequestTimeOrderV1,
  'result-shape-v1': dispatchResultShapeV1,
  'observation-shape-v1': dispatchObservationShapeV1,
  'evidence-time-v1': dispatchEvidenceTimeV1,
  'eligibility-partition-v1': dispatchEligibilityPartitionV1,
  'receipt-acyclic-v1': dispatchReceiptAcyclicV1,
  'activation-shape-v1': dispatchActivationShapeV1
});

function localInvariants(name, value) {
  for (const dispatch of Object.values(STRUCTURAL_INVARIANT_DISPATCH)) dispatch(name, value);
}

export function validateHostArtifact(name, value, options = {}) {
  const fields = HOST_ARTIFACT_SCHEMAS[name];
  if (!fields) fail('KSTACK_HOST_SCHEMA_UNKNOWN');
  assertTreeBounds(value);
  const vocabulary = normalizeVocabulary(options.vocabulary);
  const context = {
    vocabulary,
    validate(typeName, member) {
      const nested = NESTED_RECORDS[typeName];
      if (!nested) fail('KSTACK_HOST_SCHEMA_UNKNOWN');
      return validateRecord(typeName, member, nested, context, false);
    }
  };
  validateRecord(name, value, fields, context, true);
  localInvariants(name, value);
  return Object.freeze({
    schemaName: name,
    schemaId: value.schemaId,
    canonicalBytes: hostCanonicalBytes(value),
    objectDigest: hostAddress(HOST_ARTIFACT_IDENTITIES[name].domain, value)
  });
}

function resolveBoundArtifact(options, digest, name, vocabulary, sourceSchemaSetDigest) {
  if (typeof options.resolveArtifact !== 'function') fail('KSTACK_HOST_INVARIANT_CONTEXT_REQUIRED');
  const value = options.resolveArtifact(digest, name);
  if (!value || typeof value !== 'object') fail('KSTACK_HOST_INVARIANT_REFERENCE_UNAVAILABLE');
  const validated = validateHostArtifact(name, value, { vocabulary });
  if (validated.objectDigest !== digest || value.schemaSetDigest !== sourceSchemaSetDigest) fail('KSTACK_HOST_INVARIANT_REFERENCE_MISMATCH');
  return value;
}

function resolveBoundBootstrap(options, digest, name) {
  if (typeof options.resolveBootstrap !== 'function') fail('KSTACK_HOST_INVARIANT_CONTEXT_REQUIRED');
  const value = options.resolveBootstrap(digest, name);
  if (!value || typeof value !== 'object') fail('KSTACK_HOST_INVARIANT_REFERENCE_UNAVAILABLE');
  if (validateHostBootstrap(name, value).objectDigest !== digest) fail('KSTACK_HOST_INVARIANT_REFERENCE_MISMATCH');
  return value;
}

function sameValues(left, right) {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function validateRequestAuthorityContext(value, options, vocabulary) {
  const profile = resolveBoundArtifact(options, value.requirementProfileDigest, 'OperationRequirementProfileV1', vocabulary, value.schemaSetDigest);
  if (profile.operationId !== value.operationId || profile.operationSchemaDigest !== value.operationSchemaDigest) fail('KSTACK_HOST_INVARIANT_REQUEST_AUTHORITY_SHAPE_V1');
  if (typeof options.resolveOperationClassRule !== 'function') fail('KSTACK_HOST_INVARIANT_CONTEXT_REQUIRED');
  const rule = options.resolveOperationClassRule(profile.operationClassId, value.activeSetDigest);
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)
      || Object.keys(rule).sort().join(',') !== 'activeSetDigest,approvalRequired,operationClassId'
      || rule.operationClassId !== profile.operationClassId || rule.activeSetDigest !== value.activeSetDigest
      || typeof rule.approvalRequired !== 'boolean'
      || rule.approvalRequired !== (value.authorityEnvelopeDigest !== null)) fail('KSTACK_HOST_INVARIANT_REQUEST_AUTHORITY_SHAPE_V1');
}

function validateEligibilityContext(value, options, vocabulary) {
  const profile = resolveBoundArtifact(options, value.requirementProfileDigest, 'OperationRequirementProfileV1', vocabulary, value.schemaSetDigest);
  if (profile.operationId !== value.operationId) fail('KSTACK_HOST_INVARIANT_ELIGIBILITY_PARTITION_V1');
  const required = profile.requiredCapabilities.map((entry) => entry.capabilityId).sort();
  const partition = [...value.provenCapabilityIds, ...value.missingCapabilityIds].sort();
  if (!sameValues(required, partition)) fail('KSTACK_HOST_INVARIANT_ELIGIBILITY_PARTITION_V1');
  if (value.status === 'DEGRADED_REGISTERED'
      && !profile.alternateProfiles.some((entry) => entry.profileId === value.alternateProfileId)) fail('KSTACK_HOST_INVARIANT_ELIGIBILITY_PARTITION_V1');
}

function validateReceiptContext(value, options, vocabulary) {
  const result = resolveBoundArtifact(options, value.resultDigest, 'OperationResultV1', vocabulary, value.schemaSetDigest);
  const request = resolveBoundArtifact(options, result.requestDigest, 'OperationRequestV1', vocabulary, value.schemaSetDigest);
  const profile = resolveBoundArtifact(options, request.requirementProfileDigest, 'OperationRequirementProfileV1', vocabulary, value.schemaSetDigest);
  if (value.requestDigest !== result.requestDigest || value.requestDigest !== hostAddress(HOST_ARTIFACT_IDENTITIES.OperationRequestV1.domain, request)
      || value.operationId !== result.operationId || value.operationId !== request.operationId || value.operationId !== profile.operationId
      || value.activeSetDigest !== result.activeSetDigest || value.activeSetDigest !== request.activeSetDigest
      || value.operationClassId !== profile.operationClassId) fail('KSTACK_HOST_INVARIANT_RECEIPT_ACYCLIC_V1');
}

function validateSelectionContext(value, options, vocabulary) {
  const offer = resolveBoundArtifact(options, value.offerDigest, 'SchemaOfferV1', vocabulary, value.schemaSetDigest);
  const compatibility = resolveBoundArtifact(options, value.compatibilityEntryDigest, 'CompatibilityEntryV1', vocabulary, value.schemaSetDigest);
  if (!offer.schemaSetDigests.includes(value.selectedSchemaSetDigest) || !offer.resolverSetDigests.includes(value.selectedResolverSetDigest)
      || value.selectedOperationProfileDigests.some((entry) => !offer.operationProfileDigests.includes(entry))
      || value.selectedAt < offer.offeredAt || value.selectedAt > offer.expiresAt || value.expiresAt > offer.expiresAt
      || compatibility.compatibleHostContractSchemaSetDigest !== value.selectedSchemaSetDigest
      || compatibility.compatibleResolverSetDigest !== value.selectedResolverSetDigest
      || !sameValues(compatibility.allowedOperationProfileDigests, value.selectedOperationProfileDigests)) fail('KSTACK_HOST_INVARIANT_SELECTION_EXACT_V1');
}

const CONFORMANCE_EVIDENCE_SHARED_FIELDS = Object.freeze(Object.keys(HOST_ARTIFACT_SCHEMAS.HostConformanceEvidenceBodyV1));

function conformanceEvidenceSharedProjection(value) {
  const projection = {};
  for (const field of CONFORMANCE_EVIDENCE_SHARED_FIELDS) projection[field] = value[field];
  return projection;
}

function validateConformanceEvidenceWrapperContext(value, options, vocabulary) {
  if (typeof options.resolveConformanceEvidenceBody !== 'function') fail('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1');
  let body;
  try {
    body = options.resolveConformanceEvidenceBody(value);
  } catch {
    fail('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1');
  try {
    validateHostArtifact('HostConformanceEvidenceBodyV1', body, { vocabulary });
  } catch {
    fail('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1');
  }
  if (!hostCanonicalBytes(conformanceEvidenceSharedProjection(value))
    .equals(hostCanonicalBytes(conformanceEvidenceSharedProjection(body)))) fail('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1');
  if (value.schemaSetDigest !== body.schemaSetDigest) fail('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1');
}

// One contextual dispatch wrapper per registered invariant ID that has a
// cross-artifact half. Each wrapper owns its own artifact-name guard and
// reports whether it ran, so neutering one guard moves exactly one digest, and
// `validateHostArtifactContext` holds no per-invariant line to delete. The
// `resolver-pair-v1` wrapper carries the schema-set/resolver-set resolution the
// selection path previously performed inline inside `validateSelectionContext`;
// hoisting it here keeps each of the two SchemaSelectionV1 invariants
// separately attributable. Table key order preserves the previous evaluation
// order (selection-exact before resolver-pair for SchemaSelectionV1) and is
// hashed into all eleven digests through HOST_INVARIANT_DISPATCH_TABLE_SHAPE.

function dispatchRequestAuthorityShapeV1(name, value, options, vocabulary) {
  if (name !== 'OperationRequestV1') return false;
  validateRequestAuthorityContext(value, options, vocabulary);
  return true;
}

function dispatchConformanceEvidenceWrapperV1(name, value, options, vocabulary) {
  if (name !== 'HostConformanceEvidenceV1') return false;
  validateConformanceEvidenceWrapperContext(value, options, vocabulary);
  return true;
}

function dispatchEligibilityPartitionContextV1(name, value, options, vocabulary) {
  if (name !== 'OperationEligibilityV1') return false;
  validateEligibilityContext(value, options, vocabulary);
  return true;
}

function dispatchReceiptAcyclicContextV1(name, value, options, vocabulary) {
  if (name !== 'OperationReceiptV1') return false;
  validateReceiptContext(value, options, vocabulary);
  return true;
}

function dispatchSelectionExactV1(name, value, options, vocabulary) {
  if (name !== 'SchemaSelectionV1') return false;
  validateSelectionContext(value, options, vocabulary);
  return true;
}

function dispatchResolverPairV1(name, value, options) {
  if (name !== 'SchemaSelectionV1') return false;
  const schemaSet = resolveBoundBootstrap(options, value.selectedSchemaSetDigest, 'HostContractSchemaSetV1');
  const resolverSet = resolveBoundBootstrap(options, value.selectedResolverSetDigest, 'HistoricalResolverSetV1');
  exactResolver(schemaSet, resolverSet);
  return true;
}

const CONTEXTUAL_INVARIANT_DISPATCH = Object.freeze({
  'request-authority-shape-v1': dispatchRequestAuthorityShapeV1,
  'host-conformance-evidence-wrapper-v1': dispatchConformanceEvidenceWrapperV1,
  'eligibility-partition-v1': dispatchEligibilityPartitionContextV1,
  'receipt-acyclic-v1': dispatchReceiptAcyclicContextV1,
  'selection-exact-v1': dispatchSelectionExactV1,
  'resolver-pair-v1': dispatchResolverPairV1
});

export function validateHostArtifactContext(name, value, options = {}) {
  const vocabulary = options.vocabulary;
  const structural = validateHostArtifact(name, value, { vocabulary });
  let applicable = false;
  for (const dispatch of Object.values(CONTEXTUAL_INVARIANT_DISPATCH)) {
    if (dispatch(name, value, options, vocabulary)) applicable = true;
  }
  if (!applicable) fail('KSTACK_HOST_INVARIANT_CONTEXT_NOT_APPLICABLE');
  return structural;
}

export function artifactHead(name, schemaSetDigest) {
  const identity = HOST_ARTIFACT_IDENTITIES[name];
  if (!identity) fail('KSTACK_HOST_SCHEMA_UNKNOWN');
  return Object.freeze({ schemaId: identity.schemaId, schemaVersion: 1, schemaSetDigest: assertDigest(schemaSetDigest) });
}

export const REQUIRED_INVARIANT_IDS = Object.freeze([
  'result-shape-v1', 'evidence-time-v1', 'resolver-pair-v1', 'receipt-acyclic-v1', 'selection-exact-v1',
  'activation-shape-v1', 'observation-shape-v1', 'request-time-order-v1', 'eligibility-partition-v1', 'request-authority-shape-v1',
  'host-conformance-evidence-wrapper-v1'
]);

export const HOST_INVARIANT_PROGRAMS = Object.freeze({
  'request-time-order-v1': Object.freeze({ version: 1, operation: 'request-time-order' }),
  'request-authority-shape-v1': Object.freeze({ version: 1, operation: 'request-authority-shape' }),
  'result-shape-v1': Object.freeze({ version: 1, operation: 'result-shape' }),
  'observation-shape-v1': Object.freeze({ version: 1, operation: 'observation-shape' }),
  'evidence-time-v1': Object.freeze({ version: 1, operation: 'evidence-time' }),
  'host-conformance-evidence-wrapper-v1': Object.freeze({ version: 1, operation: 'host-conformance-evidence-wrapper' }),
  'eligibility-partition-v1': Object.freeze({ version: 1, operation: 'eligibility-partition' }),
  'receipt-acyclic-v1': Object.freeze({ version: 1, operation: 'receipt-acyclic' }),
  'activation-shape-v1': Object.freeze({ version: 1, operation: 'activation-shape' }),
  'selection-exact-v1': Object.freeze({ version: 1, operation: 'selection-exact' }),
  'resolver-pair-v1': Object.freeze({ version: 1, operation: 'resolver-pair' })
});

// The installed implementation of every registered invariant ID, as an
// explicitly bounded closure rather than a complete transitive call graph.
//
// WHAT THIS TABLE IS, AND IS NOT, AS OF THE WHOLE-MODULE DIGEST. It is no
// longer the boundary that makes the attestation sound. HOST_MODULE_SOURCE_DIGEST
// hashes every byte of this file into all eleven entries, so nothing this table
// omits is outside the hash any more. It is RETAINED, deliberately, for two
// things it still does:
//   1. documentation — it is the only place that records WHICH functions decide
//      WHICH invariant, which is real design information the whole-file digest
//      cannot express (a file hash says "something changed", never "this is what
//      request-time-order-v1 is made of");
//   2. two live mechanisms that still depend on it — `assertDispatchTableClosure`
//      checks each dispatch-table row against this table's per-ID membership,
//      and `implementationSourceDigest` throws at module evaluation when a
//      dispatch-table row named here has been deleted.
// It is NOT a security boundary, and its completeness is no longer load-bearing:
// an omission from it can no longer hide an edit, because the file digest moves
// on every edit regardless.
//
// INCLUDED in each entry, because each of these decides that invariant's
// accept/reject outcome:
//   - the validation entry point that reaches the dispatch table
//     (`validateHostArtifact` for structural halves, `validateHostArtifactContext`
//     plus `executeHistoricalInvariants` for contextual halves, the latter
//     carrying the `contextualNames` gate that decides whether the contextual
//     half runs at all on the historical-resolution path);
//   - `localInvariants` for structural halves, which is the table loop itself;
//   - that invariant's own dispatch wrapper, taken from
//     STRUCTURAL_INVARIANT_DISPATCH / CONTEXTUAL_INVARIANT_DISPATCH by ID so a
//     deleted table row throws at module evaluation instead of silently
//     disabling an attested invariant;
//   - the predicate function(s) that invariant is defined by;
//   - every shared helper whose body decides that invariant's comparisons —
//     `sameValues`, `resolveBoundArtifact`, `resolveBoundBootstrap`, and `fail`
//     (`fail` is in all eleven because neutering it disables all eleven).
//     A helper appearing under several IDs is expected: it moves every digest
//     whose outcome it can change, which is the correct blast radius.
//   - `resolveHistoricalArtifact`, in all eleven, for the same reason as `fail`.
//     It holds the single top-level gate
//     (`if (knownName) executeHistoricalInvariants(...)`) that decides whether
//     ANY invariant runs on the historical-resolution path — the same path
//     `requireImplementationClosure` attests against. Hashing the whole function
//     rather than an extracted gate helper is deliberate: an extracted helper
//     would leave its own call site inside this function unhashed, reopening the
//     identical gap one level up. Accepted blast radius: any edit anywhere in
//     `resolveHistoricalArtifact` — including its head parsing, closure loading,
//     or result shaping — moves all eleven digests. That is deliberately
//     over-broad rather than under-broad; a re-attestation is cheap, a silently
//     undispatched invariant is not.
//   - for host-conformance-evidence-wrapper-v1 only, the value of the module
//     constant CONFORMANCE_EVIDENCE_SHARED_FIELDS, hashed through
//     HOST_INVARIANT_IMPLEMENTATION_CONSTANTS because it is data, not source.
//   - HOST_INVARIANT_DISPATCH_TABLE_SHAPE, in all eleven, for the same reason
//     as `fail` and `resolveHistoricalArtifact`. It is the two dispatch tables'
//     SHAPE as data — each table's ordered key list plus, per key, the declared
//     name of the function registered under it — hashed through
//     HOST_INVARIANT_IMPLEMENTATION_CONSTANTS. Registering an ID in a table it
//     does not belong in, moving an ID between tables, reordering a table, or
//     swapping which function backs an ID therefore moves all eleven digests as
//     a property of the data itself, whether or not
//     `assertDispatchTableClosure` runs. Deliberately over-broad, same trade as
//     `fail`: a re-attestation is cheap, an undispatched invariant is not.
//   - every remaining byte of this module, through HOST_MODULE_SOURCE_DIGEST,
//     in all eleven. This is what closes the class the four bullets above only
//     narrowed: whatever a hashed function reaches, and whatever it could be
//     refactored into reaching, is inside the hash because the whole file is.
//     See the comment on HOST_MODULE_SOURCE_DIGEST for why per-invariant
//     attribution was given up to get it.
//
// What is DELIBERATELY EXCLUDED from THIS TABLE is recorded in
// HOST_INVARIANT_CLOSURE_EXCLUSIONS below. That list is disclosure — it
// documents which module-scope names a hashed function reaches without being
// named here, and why each is safe to leave out of the per-invariant closure.
// It is no longer a security boundary and its completeness is not relied on:
// a name missing from it is a documentation gap, not a hole, because
// HOST_MODULE_SOURCE_DIGEST hashes that name's definition either way.
//
// The declared functions are hoisted declarations, so the forward references
// here resolve at module evaluation. This table is exported read-only so that
// enumeration test can walk the exact closures the digests are minted from.
export const HOST_INVARIANT_IMPLEMENTATIONS = Object.freeze({
  'request-time-order-v1': Object.freeze([
    validateHostArtifact, localInvariants, STRUCTURAL_INVARIANT_DISPATCH['request-time-order-v1'],
    checkRequestTimeOrderV1, resolveHistoricalArtifact, fail
  ]),
  'request-authority-shape-v1': Object.freeze([
    validateHostArtifactContext, executeHistoricalInvariants, CONTEXTUAL_INVARIANT_DISPATCH['request-authority-shape-v1'],
    validateRequestAuthorityContext, resolveBoundArtifact, resolveHistoricalArtifact, fail
  ]),
  'result-shape-v1': Object.freeze([
    validateHostArtifact, localInvariants, STRUCTURAL_INVARIANT_DISPATCH['result-shape-v1'],
    checkResultShapeV1, resolveHistoricalArtifact, fail
  ]),
  'observation-shape-v1': Object.freeze([
    validateHostArtifact, localInvariants, STRUCTURAL_INVARIANT_DISPATCH['observation-shape-v1'],
    checkObservationShapeV1, resolveHistoricalArtifact, fail
  ]),
  'evidence-time-v1': Object.freeze([
    validateHostArtifact, localInvariants, STRUCTURAL_INVARIANT_DISPATCH['evidence-time-v1'],
    checkEvidenceTimeV1, resolveHistoricalArtifact, fail
  ]),
  'host-conformance-evidence-wrapper-v1': Object.freeze([
    validateHostArtifactContext, executeHistoricalInvariants, CONTEXTUAL_INVARIANT_DISPATCH['host-conformance-evidence-wrapper-v1'],
    validateConformanceEvidenceWrapperContext, conformanceEvidenceSharedProjection, resolveHistoricalArtifact, fail
  ]),
  'eligibility-partition-v1': Object.freeze([
    validateHostArtifact, localInvariants, STRUCTURAL_INVARIANT_DISPATCH['eligibility-partition-v1'], checkEligibilityPartitionV1,
    validateHostArtifactContext, executeHistoricalInvariants, CONTEXTUAL_INVARIANT_DISPATCH['eligibility-partition-v1'],
    validateEligibilityContext, resolveBoundArtifact, sameValues, resolveHistoricalArtifact, fail
  ]),
  'receipt-acyclic-v1': Object.freeze([
    validateHostArtifact, localInvariants, STRUCTURAL_INVARIANT_DISPATCH['receipt-acyclic-v1'], checkReceiptAcyclicV1,
    validateHostArtifactContext, executeHistoricalInvariants, CONTEXTUAL_INVARIANT_DISPATCH['receipt-acyclic-v1'],
    validateReceiptContext, resolveBoundArtifact, resolveHistoricalArtifact, fail
  ]),
  'activation-shape-v1': Object.freeze([
    validateHostArtifact, localInvariants, STRUCTURAL_INVARIANT_DISPATCH['activation-shape-v1'],
    checkActivationShapeV1, resolveHistoricalArtifact, fail
  ]),
  'selection-exact-v1': Object.freeze([
    validateHostArtifactContext, executeHistoricalInvariants, CONTEXTUAL_INVARIANT_DISPATCH['selection-exact-v1'],
    validateSelectionContext, resolveBoundArtifact, sameValues, resolveHistoricalArtifact, fail
  ]),
  'resolver-pair-v1': Object.freeze([
    validateHostArtifactContext, executeHistoricalInvariants, CONTEXTUAL_INVARIANT_DISPATCH['resolver-pair-v1'],
    exactResolver, resolveBoundBootstrap, resolveHistoricalArtifact, fail
  ])
});

// Module-scope constants whose VALUE is hashed into the implementation digests
// (through HOST_INVARIANT_IMPLEMENTATION_CONSTANTS) rather than as source text.
// A hashed function may reference these freely: an edit to any of them already
// moves the digests it can change.
export const HOST_INVARIANT_HASHED_CONSTANTS = Object.freeze([
  'CONFORMANCE_EVIDENCE_SHARED_FIELDS', 'CONTEXTUAL_INVARIANT_DISPATCH',
  'HOST_INVARIANT_DISPATCH_TABLE_SHAPE', 'STRUCTURAL_INVARIANT_DISPATCH'
]);

// DISCLOSURE ONLY. Module-scope names a hashed function reaches that are not
// themselves in that invariant's HOST_INVARIANT_IMPLEMENTATIONS closure.
//
// This list used to be described as "the authority, not a comment", on the
// theory that the enumeration test in tests/host-contract.test.mjs made the
// boundary self-checking. Two independent reviews disproved that: the test can
// only enumerate declaration forms its scanner understands, and both r5 and r6
// found legal JS forms it did not (r5: the second declarator of a
// comma-separated const list; r6: `var` inside a block), each proven as a
// working end-to-end bypass. The claim was withdrawn rather than patched a
// third time. HOST_MODULE_SOURCE_DIGEST closes the class instead, by hashing
// every byte of this file into all eleven digests.
//
// What this list is now: documentation of what the per-invariant closure
// deliberately leaves out and why. The enumeration test is kept because a name
// appearing here that no hashed function reaches, or a reached name absent from
// here, is still worth surfacing as drift — but a miss is a stale document, not
// an exploitable gap, and nothing below depends on the scanner being complete.
//
// The general principle: these are universal primitives, the closure
// content-addressing mechanism, and the attestation machinery itself. None of
// them decides an invariant's accept/reject outcome, and none is self-attesting
// — each is held by a test rather than by a digest. WHICH backstop holds a name
// differs per group, and an earlier revision of this comment overstated it by
// claiming the cross-runtime vector set and the Rust reference oracle held all
// three groups. They do not: the Rust oracle
// (plugins/kstack/native/host-contract-reference) implements canonicalization,
// addressing, and closed-schema validation only, and contains no invariant,
// closure-attestation, or dispatch logic at all. Per group, accurately:
//   - canonicalization/addressing and the schema tables: caught by the
//     cross-runtime vector set and the Rust reference oracle, which independently
//     reproduce RFC 8785 bytes, domain digests, and closed-schema decisions;
//   - closure content-addressing (repair-r2 §5): a mechanism distinct from
//     invariant behavior (repair-r2 §4), with its own KSTACK_HOST_CLOSURE_*
//     error codes that the invariant digests never claimed to cover. NOT held by
//     the vector set or the Rust oracle. Backstop: the direct
//     KSTACK_HOST_CLOSURE_DIGEST_MISMATCH and vocabulary-validation tests in
//     tests/host-contract.test.mjs, plus — added after r5 found five guards in
//     this group deletable with 0/11 digest movement and the suite green — a
//     direct behavioral test per guard: KSTACK_HOST_INVARIANT_VECTOR_UNAVAILABLE
//     (both the unpublished-vector and failing-vector branches),
//     KSTACK_HOST_OBJECT_STORE_REQUIRED and KSTACK_HOST_CLOSURE_UNAVAILABLE in
//     `requireStoredBytes`, and both `validateHostBootstrap` schema-name guards;
//   - the attestation machinery: a bootstrap boundary checkable only from
//     outside this module. NOT held by the vector set or the Rust oracle either;
//     held by the mutated-copy regression tests.
// `schemaName` is a known false positive of the enumeration heuristic (it is
// the property key `schemaName:` in validateHostArtifact's return literal, not
// a reference to the module-scope function of that name); the heuristic errs
// toward over-inclusion by design, so it is disclosed rather than special-cased.
export const HOST_INVARIANT_CLOSURE_EXCLUSIONS = Object.freeze([
  // canonicalization, bounds, and addressing
  'assertAsciiId', 'assertDigest', 'assertSafeUInt', 'assertTreeBounds', 'encodeHostValue',
  'hostAddress', 'hostCanonicalBytes', 'parseHostCanonicalJson', 'sha256Digest',
  // schema tables and the record walker
  'HOST_ARTIFACT_IDENTITIES', 'HOST_ARTIFACT_SCHEMAS', 'NESTED_RECORDS', 'compileClosedSchemaSet',
  'exactKeys', 'normalizeVocabulary', 'schemaName', 'validateRecord', 'validateType',
  // error carrier and resolution-result shaping
  'CLOSURE_FAILURES', 'HostContractError', 'resolutionResult',
  // closure content-addressing (repair-r2 §5), not invariant behavior (§4)
  'loadBootstrap', 'requireImplementationClosure', 'requireInvariantApplicabilityClosure',
  'requireStoredBytes', 'storedValueResolver', 'validateHostBootstrap', 'vocabularyFromRegistry',
  // the attestation machinery, which is not self-attesting
  'CANONICAL_CONTEXTUAL_DISPATCH', 'CANONICAL_STRUCTURAL_DISPATCH',
  'HOST_INVARIANT_IMPLEMENTATION_CONSTANTS', 'HOST_INVARIANT_IMPLEMENTATION_DIGESTS',
  'assertDispatchTableClosure', 'declaredFunctionName', 'dispatchTableRoles',
  'implementationConstants', 'implementationSourceDigest'
]);

// Dispatch-table closure, enforced at module evaluation.
//
// A DELETED table row is caught downstream by `implementationSourceDigest`: the
// entry it feeds becomes `undefined` and hashing throws. An ADDED row is the
// mirror-image hole and moves no digest at all — `localInvariants` and
// `validateHostArtifactContext` iterate `Object.values(...)`, so an injected
// `'x-extra': () => true` row silently turns a
// KSTACK_HOST_INVARIANT_CONTEXT_NOT_APPLICABLE rejection into an acceptance
// while every implementation digest stays byte-identical. Two checks close it:
//
//   1. the two tables' keys together are exactly REQUIRED_INVARIANT_IDS — no
//      unregistered ID may dispatch, and no registered ID may go undispatched;
//   2. every row's function value is one of the functions hashed into
//      HOST_INVARIANT_IMPLEMENTATIONS for that same ID — so a registered ID
//      smuggled into the other table with a fresh, unhashed function is
//      rejected too, which check 1 alone would miss;
//   3. that function is hashed under that ID ALONE. Checks 1-2 test membership,
//      not role, and the hashed closures deliberately share primitives:
//      `resolveHistoricalArtifact`, `fail`, `validateHostArtifact`,
//      `localInvariants`, `validateHostArtifactContext`,
//      `executeHistoricalInvariants`, `resolveBoundArtifact`,
//      `resolveBoundBootstrap` and `sameValues` each appear under two or more
//      IDs. Membership alone therefore admits, for example,
//      `'result-shape-v1': resolveHistoricalArtifact` in the CONTEXTUAL table:
//      the ID is registered and the function is genuinely inside that ID's
//      hashed closure, yet it returns a truthy frozen object, which sets
//      `applicable` for every artifact name and defeats the
//      KSTACK_HOST_INVARIANT_CONTEXT_NOT_APPLICABLE guard. Requiring the row
//      function to be exclusive to its own ID rejects every shared primitive
//      without naming any of them, because exclusivity is read off
//      HOST_INVARIANT_IMPLEMENTATIONS, which is already hashed;
//   4. that function is identically that ID's canonical wrapper for that
//      specific table. This closes the residual check 3 leaves: a function that
//      IS exclusive to one ID but is not its dispatcher — for instance
//      `conformanceEvidenceSharedProjection`, which is exclusive to
//      host-conformance-evidence-wrapper-v1 and also returns a truthy object.
//
// Checks 1-4 all read the tables once, at module evaluation, and both tables are
// read again on every call by `localInvariants` and `validateHostArtifactContext`.
// A fifth check therefore runs first: both tables must be frozen. Without it,
// dropping `Object.freeze` from a table literal and assigning a row AFTER
// `assertDispatchTableClosure()` returns would pass all four checks against the
// pre-mutation table and move no digest, because the hashed shape is likewise
// captured at module evaluation. Frozen at guard time is frozen for the life of
// the module, so the four checks and the hashed shape both describe the table
// that actually dispatches.
//
// The earlier claim that a wrapper copied into the other table under its own ID
// is "inert" was wrong as written: it reasoned only about the seven `dispatch*`
// wrappers, not about the full hashed closure, which contains truthy-returning
// functions. Checks 3 and 4 replace that claim rather than restate it. What
// remains outside these four checks is disclosed in the DELIBERATELY EXCLUDED
// list above: the checks are not themselves attested, so all four are backed by
// HOST_INVARIANT_DISPATCH_TABLE_SHAPE, which moves all eleven digests on any
// table-shape edit whether or not this function is ever called.
//
// Names are parsed out of each function's own source text rather than read from
// `fn.name`, which one unhashed `Object.defineProperty(fn, 'name', ...)` line
// anywhere in this module could otherwise rewrite without moving a digest.
function declaredFunctionName(invariantId, implementation) {
  if (typeof implementation !== 'function') {
    throw new TypeError(`kstack-host-contract: unattested dispatch-table row '${invariantId}' is not a function (deleted dispatch-table row?)`);
  }
  const declared = /^function\s+([^\s(]+)/u.exec(implementation.toString());
  if (!declared) {
    throw new TypeError(`kstack-host-contract: unattested dispatch-table row '${invariantId}' is not a named function declaration`);
  }
  return declared[1];
}

function dispatchTableRoles(table) {
  return Object.freeze(Object.fromEntries(
    Object.entries(table).map(([invariantId, implementation]) => [invariantId, declaredFunctionName(invariantId, implementation)])
  ));
}

// The one canonical dispatcher per (table, invariant ID). Written out rather
// than derived, because deriving it from the live tables would make check 4
// vacuous. It adds no unattested degree of freedom: any divergence from the
// live tables fails check 4 at module evaluation, and any edit applied to both
// this table and the live one changes HOST_INVARIANT_DISPATCH_TABLE_SHAPE and
// so moves all eleven digests.
const CANONICAL_STRUCTURAL_DISPATCH = Object.freeze({
  'request-time-order-v1': dispatchRequestTimeOrderV1,
  'result-shape-v1': dispatchResultShapeV1,
  'observation-shape-v1': dispatchObservationShapeV1,
  'evidence-time-v1': dispatchEvidenceTimeV1,
  'eligibility-partition-v1': dispatchEligibilityPartitionV1,
  'receipt-acyclic-v1': dispatchReceiptAcyclicV1,
  'activation-shape-v1': dispatchActivationShapeV1
});

const CANONICAL_CONTEXTUAL_DISPATCH = Object.freeze({
  'request-authority-shape-v1': dispatchRequestAuthorityShapeV1,
  'host-conformance-evidence-wrapper-v1': dispatchConformanceEvidenceWrapperV1,
  'eligibility-partition-v1': dispatchEligibilityPartitionContextV1,
  'receipt-acyclic-v1': dispatchReceiptAcyclicContextV1,
  'selection-exact-v1': dispatchSelectionExactV1,
  'resolver-pair-v1': dispatchResolverPairV1
});

function assertDispatchTableClosure() {
  for (const [table, dispatch] of [['structural', STRUCTURAL_INVARIANT_DISPATCH], ['contextual', CONTEXTUAL_INVARIANT_DISPATCH]]) {
    if (!Object.isFrozen(dispatch)) {
      throw new TypeError(`kstack-host-contract: unattested dispatch-table row set — the ${table} dispatch table is not frozen (post-load row injection?)`);
    }
  }
  const required = new Set(REQUIRED_INVARIANT_IDS);
  const rows = [
    ...Object.entries(STRUCTURAL_INVARIANT_DISPATCH).map((row) => [...row, CANONICAL_STRUCTURAL_DISPATCH, 'structural']),
    ...Object.entries(CONTEXTUAL_INVARIANT_DISPATCH).map((row) => [...row, CANONICAL_CONTEXTUAL_DISPATCH, 'contextual'])
  ];
  const dispatched = new Set();
  for (const [invariantId, implementation, canonical, table] of rows) {
    if (!required.has(invariantId)) {
      throw new TypeError(`kstack-host-contract: unattested dispatch-table row '${invariantId}' (added dispatch-table row?)`);
    }
    if (!(HOST_INVARIANT_IMPLEMENTATIONS[invariantId] || []).includes(implementation)) {
      throw new TypeError(`kstack-host-contract: unattested dispatch-table row '${invariantId}' dispatches a function absent from its hashed implementation closure`);
    }
    for (const [other, closure] of Object.entries(HOST_INVARIANT_IMPLEMENTATIONS)) {
      if (other !== invariantId && closure.includes(implementation)) {
        throw new TypeError(`kstack-host-contract: unattested dispatch-table row '${invariantId}' dispatches a function shared across invariant closures (also hashed under '${other}')`);
      }
    }
    if (implementation !== canonical[invariantId]) {
      throw new TypeError(`kstack-host-contract: unattested dispatch-table row '${invariantId}' is not the canonical ${table} dispatcher for that invariant`);
    }
    dispatched.add(invariantId);
  }
  for (const invariantId of required) {
    if (!dispatched.has(invariantId)) {
      throw new TypeError(`kstack-host-contract: unattested dispatch-table row set — registered invariant '${invariantId}' has no dispatch-table row`);
    }
  }
}

// The two dispatch tables' SHAPE, as data rather than as source text: each
// table's ordered key list, plus the declared name of the function registered
// under each key. A same-key function swap, an ID registered in the wrong
// table, an ID moved between tables, or a reorder all change these bytes.
//
// Names rather than bodies. The original reason — that pulling bodies in would
// move all eleven digests and destroy per-invariant attribution — no longer
// applies: HOST_MODULE_SOURCE_DIGEST moves all eleven on any edit anyway, so
// there is no attribution left for this choice to protect. It stays as names
// because that is what this value is FOR. It answers "which function backs each
// ID", a question about the table's shape; the bodies are already attested, both
// through their own hashed closures and through the whole-module digest.
const HOST_INVARIANT_DISPATCH_TABLE_SHAPE = Object.freeze({
  structuralDispatchIds: Object.freeze(Object.keys(STRUCTURAL_INVARIANT_DISPATCH)),
  contextualDispatchIds: Object.freeze(Object.keys(CONTEXTUAL_INVARIANT_DISPATCH)),
  structuralDispatchRoles: dispatchTableRoles(STRUCTURAL_INVARIANT_DISPATCH),
  contextualDispatchRoles: dispatchTableRoles(CONTEXTUAL_INVARIANT_DISPATCH)
});

// Module constants whose VALUE (not source text) decides an invariant's
// outcome. Hashed as canonical bytes alongside the source digests. The dispatch
// table shape is mixed into all eleven entries for the same reason `fail` and
// `resolveHistoricalArtifact` are hashed into all eleven closures: any edit to
// it can change whether an invariant dispatches at all.
const HOST_INVARIANT_IMPLEMENTATION_CONSTANTS = Object.freeze(Object.fromEntries(
  REQUIRED_INVARIANT_IDS.map((invariantId) => [invariantId, Object.freeze(
    invariantId === 'host-conformance-evidence-wrapper-v1'
      ? {
        dispatchTableShape: HOST_INVARIANT_DISPATCH_TABLE_SHAPE,
        CONFORMANCE_EVIDENCE_SHARED_FIELDS: [...CONFORMANCE_EVIDENCE_SHARED_FIELDS]
      }
      : { dispatchTableShape: HOST_INVARIANT_DISPATCH_TABLE_SHAPE }
  )])
));

// Function.prototype.toString returns the exact source text of a hoisted
// function declaration, which is what makes this a behavior digest. Line
// endings are normalized to LF first so an LF checkout and a CRLF checkout of
// the identical source mint the identical digest; without that, a CRLF working
// copy silently mints a whole different, self-consistent closure. A non-
// function here means a dispatch-table row was deleted: fail loudly at module
// evaluation rather than attest an invariant that no longer dispatches.
function implementationSourceDigest(implementation) {
  if (typeof implementation !== 'function') {
    throw new TypeError('kstack-host-contract: invariant implementation entry is not a function (deleted dispatch-table row?)');
  }
  return sha256Digest(Buffer.from(implementation.toString().replace(/\r\n/gu, '\n'), 'utf8'));
}

// An ID registered in HOST_INVARIANT_PROGRAMS but absent from
// REQUIRED_INVARIANT_IDS has no hashed constants entry. Silently substituting
// `{}` would mint a digest for it that attests to no dispatch-table shape at
// all; fail at module evaluation instead.
function implementationConstants(invariantId) {
  const constants = HOST_INVARIANT_IMPLEMENTATION_CONSTANTS[invariantId];
  if (!constants) {
    throw new TypeError(`kstack-host-contract: invariant '${invariantId}' has no hashed implementation constants (registered in HOST_INVARIANT_PROGRAMS but absent from REQUIRED_INVARIANT_IDS?)`);
  }
  return constants;
}

// Byte-level CRLF -> LF normalization, used only by HOST_MODULE_SOURCE_DIGEST.
// It rewrites the two-byte sequence 0x0D 0x0A to 0x0A on the raw buffer rather
// than calling String.prototype.replace on a decoded string, because the decode
// is the thing being avoided (see HOST_MODULE_SOURCE_DIGEST below). Neither 0x0D
// nor 0x0A can occur inside a multi-byte UTF-8 sequence, so on any validly
// encoded source this is exactly equivalent to `.replace(/\r\n/gu, '\n')` —
// including its edge cases: a lone CR is preserved, and `\r\r\n` becomes `\r\n`.
function normalizeSourceEolBytes(bytes) {
  const normalized = Buffer.allocUnsafe(bytes.length);
  let length = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 0x0d && bytes[index + 1] === 0x0a) continue;
    normalized[length] = bytes[index];
    length += 1;
  }
  return normalized.subarray(0, length);
}

// This module's own on-disk source BYTES, hashed as bytes and never as a decoded
// string, with only the byte-level CRLF -> LF normalization above so an LF
// checkout and a CRLF checkout of identical source mint the identical digest.
//
// Hashing raw bytes rather than `readFileSync(..., 'utf8')` is deliberate. A
// UTF-8 decode is LOSSY: distinct invalid byte sequences all collapse to the
// same run of U+FFFD replacement characters, so a digest taken over the decoded
// string collides across files whose disk bytes genuinely differ (three such
// sequences were shown to mint one identical digest). That collision was not
// exploitable — V8's own ESM source decoder and Node's Buffer UTF-8 decoder
// agree on replacement-character behavior, so a collision implied an identical
// parsed program — but that is an implicit, unpinned agreement between two
// independent decoders, which is the exact shape of unstated assumption that
// broke this mechanism twice already (r5, r6). Hashing the bytes on disk removes
// the assumption rather than resting on it, at zero cost. Pinned by a regression
// test in tests/host-contract.test.mjs.
//
// Mixed into all eleven entries below, this is the mechanism that makes the
// attestation sound, and it replaces — as a SOUNDNESS mechanism — the
// per-function attribution that used to carry that weight alone. The reason is
// specific and was proven twice: attributing only the functions that implement
// an invariant leaves every other byte of the module outside the hash, so a
// guard could be lifted out of a hashed function into an unhashed module-scope
// helper, re-attested as a "refactor", and then neutered for free. Two
// independent reviews each built a working end-to-end bypass of exactly that
// shape against two different, both reasonable, hand-built scanners meant to
// catch it (r5: the second declarator of a comma-separated const list; r6: a
// `var` declared inside a block, which is module-scoped in JS despite the block
// nesting). Hashing every byte of the file removes the scanner, and with it the
// question of whether any scanner or exclusion list is complete: there is no
// "outside the hash" left to move a guard into.
//
// Accepted cost, stated plainly: per-invariant attribution is GONE. Any edit
// anywhere in this file — a comment, a helper unrelated to any invariant, a
// whitespace change — moves all eleven digests and forces a re-attestation.
// That is the same deliberately-over-broad trade this mechanism already makes
// for `fail`, `resolveHistoricalArtifact`, and HOST_INVARIANT_DISPATCH_TABLE_SHAPE,
// extended to the whole file: a re-attestation is cheap, a silently neutered
// invariant is not.
//
// Bounded by construction to THIS file. It does not attest to `node:crypto` or
// `node:fs`, to a loader that rewrites this source in flight (the disk bytes
// would be unchanged), or to any behavior in another module. Those boundaries
// are unchanged by this constant and are not claimed to be closed by it.
const HOST_MODULE_SOURCE_DIGEST = sha256Digest(
  normalizeSourceEolBytes(readFileSync(new URL(import.meta.url)))
);

export const HOST_INVARIANT_IMPLEMENTATION_DIGESTS = Object.freeze(Object.fromEntries(
  Object.entries(HOST_INVARIANT_PROGRAMS).map(([invariantId, program]) => [
    invariantId, sha256Digest(hostCanonicalBytes({
      invariantId, program,
      implementationConstants: implementationConstants(invariantId),
      // Retained alongside the whole-module digest, not superseded by it. It is
      // what makes a DELETED dispatch-table row throw at module evaluation
      // (`implementationSourceDigest`'s "not a function" guard names the
      // deletion precisely), and `Function.prototype.toString` reflects the
      // source actually EXECUTING, which a disk read does not.
      implementationSourceDigests: HOST_INVARIANT_IMPLEMENTATIONS[invariantId].map(implementationSourceDigest),
      moduleSourceDigest: HOST_MODULE_SOURCE_DIGEST
    }))
  ])
));

// Ordered after the digest computation on purpose: a DELETED table row must keep
// failing through `implementationSourceDigest`'s "not a function" guard, which
// names the deletion precisely. This call adds the ADDED-row half.
assertDispatchTableClosure();

export const HOST_INVARIANT_APPLICABLE_SCHEMAS = Object.freeze({
  'request-time-order-v1': Object.freeze(['kstack.operation-request.v1']),
  'request-authority-shape-v1': Object.freeze(['kstack.operation-request.v1']),
  'result-shape-v1': Object.freeze(['kstack.operation-result.v1']),
  'observation-shape-v1': Object.freeze(['kstack.host-observation.v1']),
  'evidence-time-v1': Object.freeze([
    'kstack.host-conformance-evidence-body.v1', 'kstack.host-conformance-evidence.v1', 'kstack.host-evidence-set.v1', 'kstack.host-observation.v1',
    'kstack.operation-eligibility.v1', 'kstack.operation-lease.v1'
  ]),
  'host-conformance-evidence-wrapper-v1': Object.freeze(['kstack.host-conformance-evidence.v1']),
  'eligibility-partition-v1': Object.freeze(['kstack.operation-eligibility.v1']),
  'receipt-acyclic-v1': Object.freeze(['kstack.operation-receipt.v1', 'kstack.operation-result.v1']),
  'activation-shape-v1': Object.freeze(['kstack.activation-record.v1']),
  'selection-exact-v1': Object.freeze(['kstack.schema-selection.v1']),
  'resolver-pair-v1': Object.freeze(['kstack.schema-selection.v1'])
});

export function validateHostBootstrap(name, value) {
  const fields = HOST_BOOTSTRAP_SCHEMAS[name];
  const identity = HOST_BOOTSTRAP_IDENTITIES[name];
  if (!fields || !identity) fail('KSTACK_HOST_BOOTSTRAP_SCHEMA_UNKNOWN');
  assertTreeBounds(value);
  const context = {
    vocabulary: {},
    validate(typeName, member) {
      const nested = BOOTSTRAP_NESTED_RECORDS[typeName] || NESTED_RECORDS[typeName];
      if (!nested) fail('KSTACK_HOST_SCHEMA_UNKNOWN');
      return validateRecord(typeName, member, nested, context, false);
    }
  };
  validateRecord(name, value, fields, context, false);
  if (name === 'KStackClosedMetaschemaV1' && (value.permittedKeywords.length !== KEYWORDS.length
      || value.permittedKeywords.some((entry, index) => entry !== KEYWORDS[index]))) fail('KSTACK_HOST_METASCHEMA_KEYWORDS_INVALID');
  if (name === 'InvariantRegistryV1') {
    const ids = value.entries.map((entry) => entry.invariantId);
    if (ids.length !== REQUIRED_INVARIANT_IDS.length || ids.some((entry, index) => entry !== REQUIRED_INVARIANT_IDS[index])) fail('KSTACK_HOST_INVARIANT_REGISTRY_INCOMPLETE');
    if (value.entries.some((entry) => entry.implementationDigest !== HOST_INVARIANT_IMPLEMENTATION_DIGESTS[entry.invariantId])) fail('KSTACK_HOST_INVARIANT_IMPLEMENTATION_MISMATCH');
    if (value.entries.some((entry) => !sameValues(entry.applicableSchemaIds, HOST_INVARIANT_APPLICABLE_SCHEMAS[entry.invariantId]))) fail('KSTACK_HOST_INVARIANT_APPLICABILITY_MISMATCH');
  }
  if (name === 'HostContractSchemaSetV1') {
    const domains = value.schemaEntries.map((entry) => entry.artifactDomain);
    if (new Set(domains).size !== domains.length) fail('KSTACK_HOST_ARTIFACT_DOMAIN_DUPLICATE');
  }
  bootstrapSchemaCompiler ??= compileClosedSchemaSet(HOST_BOOTSTRAP_SCHEMA_DOCUMENTS.map((entry) => ({
    schemaId: entry.schemaId, schema: entry.schema
  })));
  bootstrapSchemaCompiler.validate(schemaName('bootstrap', name), value);
  return Object.freeze({
    schemaName: name,
    schemaId: identity.schemaId,
    canonicalBytes: hostCanonicalBytes(value),
    objectDigest: hostAddress(identity.domain, value)
  });
}

export function vocabularyFromRegistry(value) {
  validateHostBootstrap('ClosedVocabularyRegistryV1', value);
  return Object.freeze(Object.fromEntries(value.collections.map((collection) => [
    collection.collectionId,
    Object.freeze(collection.entries.map((entry) => entry.id))
  ])));
}

export function constructHostContractClosure(input) {
  exactKeys(input, ['metaschema', 'canonicalizationProfile', 'vocabularyRegistry', 'invariantRegistry', 'resolverSet', 'vectorSet']);
  const bootstrap = [
    ['KStackClosedMetaschemaV1', input.metaschema],
    ['CanonicalizationProfileV1', input.canonicalizationProfile],
    ['ClosedVocabularyRegistryV1', input.vocabularyRegistry],
    ['InvariantRegistryV1', input.invariantRegistry],
    ['HistoricalResolverSetV1', input.resolverSet],
    ['CrossRuntimeVectorSetV1', input.vectorSet]
  ];
  const validated = Object.fromEntries(bootstrap.map(([name, value]) => [name, validateHostBootstrap(name, value)]));
  const vocabulary = vocabularyFromRegistry(input.vocabularyRegistry);
  const artifacts = buildHostArtifactSchemaSet(vocabulary);
  const schemaEntries = artifacts.documents.map((document) => {
    const name = Object.keys(HOST_ARTIFACT_IDENTITIES).find((candidate) => HOST_ARTIFACT_IDENTITIES[candidate].schemaId === document.schemaId);
    return {
      schemaId: document.schemaId, schemaVersion: 1, schemaDigest: document.schemaDigest,
      artifactDomain: HOST_ARTIFACT_IDENTITIES[name].domain
    };
  }).sort((left, right) => Buffer.compare(
    tupleKey(left, ['schemaId', 'schemaVersion'], ['ASCII', 'ASCII_CANONICAL_UINT']),
    tupleKey(right, ['schemaId', 'schemaVersion'], ['ASCII', 'ASCII_CANONICAL_UINT'])
  ));
  const schemaSet = {
    schemaId: 'kstack.host-contract-schema-set.v1', schemaVersion: 1,
    metaschemaDigest: validated.KStackClosedMetaschemaV1.objectDigest,
    schemaLanguageVersion: 'kstack-closed-schema-v1',
    canonicalizationProfileDigest: validated.CanonicalizationProfileV1.objectDigest,
    schemaEntries,
    closedVocabularyRegistryDigest: validated.ClosedVocabularyRegistryV1.objectDigest,
    invariantRegistryDigest: validated.InvariantRegistryV1.objectDigest,
    historicalResolverSetDigest: validated.HistoricalResolverSetV1.objectDigest,
    crossRuntimeVectorSetDigest: validated.CrossRuntimeVectorSetV1.objectDigest
  };
  const schemaSetValidation = validateHostBootstrap('HostContractSchemaSetV1', schemaSet);
  exactResolver(schemaSet, input.resolverSet);
  const store = new Map();
  const put = (digest, source) => {
    const bytesValue = Buffer.from(source);
    const prior = store.get(digest);
    if (prior && !prior.equals(bytesValue)) fail('KSTACK_HOST_CLOSURE_DIGEST_COLLISION');
    store.set(digest, bytesValue);
  };
  for (const document of artifacts.documents) put(document.schemaDigest, Buffer.from(document.canonicalJson, 'utf8'));
  for (const [name] of bootstrap) {
    put(validated[name].objectDigest, validated[name].canonicalBytes);
  }
  put(schemaSetValidation.objectDigest, schemaSetValidation.canonicalBytes);
  return Object.freeze({
    schemaSet: Object.freeze(schemaSet), schemaSetDigest: schemaSetValidation.objectDigest,
    schemaDigests: artifacts.schemaDigests,
    getObject(digest) { const value = store.get(digest); return value ? Buffer.from(value) : null; },
    objectCount: store.size
  });
}

const CLOSED_KEYWORDS = new Set(KEYWORDS);
const CLOSED_TYPES = new Set(['null', 'boolean', 'integer', 'string', 'array', 'object']);

const PATTERN_TOKEN = /(?:\[[^\]\\]+\]|[A-Za-z0-9_:.-])(?:\{([0-9]+)(?:,([0-9]+))?\}|[+*?])?/uy;

function closedPatternClassMembers(content) {
  if (content.startsWith('^')) fail('KSTACK_HOST_PATTERN_INVALID');
  const members = new Set();
  let index = 0;
  while (index < content.length) {
    const first = content.charCodeAt(index);
    if (content[index + 1] === '-' && index + 2 < content.length) {
      const last = content.charCodeAt(index + 2);
      if (first > last) fail('KSTACK_HOST_PATTERN_INVALID');
      for (let code = first; code <= last; code += 1) members.add(code);
      index += 3;
    } else {
      members.add(first);
      index += 1;
    }
  }
  return members;
}

function parseClosedPatternAtoms(body) {
  const atoms = [];
  let offset = 0;
  // Cheap parse-time guard on NFA size (the sum of quantifier maxima), not a
  // DFA-state count. The declared 4,096-DFA-state bound is enforced only by the
  // subset construction in determinizeClosedPattern.
  let nfaSizeGuard = 1;
  while (offset < body.length) {
    PATTERN_TOKEN.lastIndex = offset;
    const match = PATTERN_TOKEN.exec(body);
    if (!match || match.index !== offset) fail('KSTACK_HOST_PATTERN_INVALID');
    const text = match[0];
    const atomEnd = text[0] === '[' ? text.indexOf(']') + 1 : 1;
    const atomText = text.slice(0, atomEnd);
    const quantifier = text.slice(atomEnd);
    const members = atomText[0] === '['
      ? closedPatternClassMembers(atomText.slice(1, -1))
      : new Set([atomText.charCodeAt(0)]);
    let min = 1;
    let max = 1;
    if (quantifier === '?') { min = 0; max = 1; }
    else if (quantifier === '*') { min = 0; max = Number.POSITIVE_INFINITY; }
    else if (quantifier === '+') { min = 1; max = Number.POSITIVE_INFINITY; }
    else if (quantifier !== '') {
      min = Number(match[1]);
      max = match[2] === undefined ? min : Number(match[2]);
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || min > max) fail('KSTACK_HOST_PATTERN_INVALID');
    }
    nfaSizeGuard += max === Number.POSITIVE_INFINITY ? 2 : max;
    if (nfaSizeGuard > HOST_CONTRACT_LIMITS.maxPatternDfaStates) fail('KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT');
    atoms.push({ members, min, max });
    offset = PATTERN_TOKEN.lastIndex;
  }
  return atoms;
}

function buildClosedPatternNfa(atoms) {
  const states = [];
  const newState = () => { states.push({ eps: [], members: null, next: -1 }); return states.length - 1; };
  const occurrence = (members) => {
    const from = newState();
    const to = newState();
    states[from].members = members;
    states[from].next = to;
    return { in: from, out: to };
  };
  const start = newState();
  let cursor = start;
  for (const atom of atoms) {
    for (let index = 0; index < atom.min; index += 1) {
      const fragment = occurrence(atom.members);
      states[cursor].eps.push(fragment.in);
      cursor = fragment.out;
    }
    if (atom.max === Number.POSITIVE_INFINITY) {
      const loop = newState();
      states[cursor].eps.push(loop);
      const fragment = occurrence(atom.members);
      states[loop].eps.push(fragment.in);
      states[fragment.out].eps.push(loop);
      cursor = loop;
    } else if (atom.max > atom.min) {
      const exit = newState();
      for (let index = atom.min; index < atom.max; index += 1) {
        states[cursor].eps.push(exit);
        const fragment = occurrence(atom.members);
        states[cursor].eps.push(fragment.in);
        cursor = fragment.out;
      }
      states[cursor].eps.push(exit);
      cursor = exit;
    }
  }
  return { states, start, accept: cursor };
}

function closedPatternAlphabet(atoms) {
  const sets = [...new Set(atoms.map((atom) => atom.members))];
  const symbolOf = new Int32Array(128);
  const identifiers = new Map();
  let symbolCount = 1;
  for (let code = 0; code < 128; code += 1) {
    let signature = '';
    for (let index = 0; index < sets.length; index += 1) if (sets[index].has(code)) signature += `${index},`;
    if (signature === '') continue;
    let symbol = identifiers.get(signature);
    if (symbol === undefined) { symbol = symbolCount; symbolCount += 1; identifiers.set(signature, symbol); }
    symbolOf[code] = symbol;
  }
  const admits = new Map();
  for (const set of sets) {
    const mask = new Uint8Array(symbolCount);
    for (let code = 0; code < 128; code += 1) if (set.has(code)) mask[symbolOf[code]] = 1;
    admits.set(set, mask);
  }
  return { symbolOf, symbolCount, admits };
}

function determinizeClosedPattern(nfa, alphabet) {
  const { states, start, accept } = nfa;
  const { symbolCount, admits } = alphabet;
  const words = (states.length + 31) >>> 5;
  const admitted = states.map((state) => (state.members === null ? null : admits.get(state.members)));
  const marks = new Int32Array(states.length);
  let generation = 0;
  const closure = (seeds) => {
    generation += 1;
    const stack = [];
    const bits = new Uint32Array(words);
    for (const seed of seeds) if (marks[seed] !== generation) { marks[seed] = generation; stack.push(seed); }
    while (stack.length) {
      const current = stack.pop();
      bits[current >>> 5] |= 1 << (current & 31);
      for (const target of states[current].eps) if (marks[target] !== generation) { marks[target] = generation; stack.push(target); }
    }
    return bits;
  };
  const identifiers = new Map();
  const subsets = [];
  const accepting = [];
  const transitions = [];
  const intern = (bits) => {
    const key = Buffer.from(bits.buffer, bits.byteOffset, bits.byteLength).toString('latin1');
    const existing = identifiers.get(key);
    if (existing !== undefined) return existing;
    // Sole enforcement point for the declared 4,096-DFA-state bound from the
    // frozen design: this counts real subset-construction states, unlike the
    // cheap NFA-size guard in parseClosedPatternAtoms.
    if (identifiers.size >= HOST_CONTRACT_LIMITS.maxPatternDfaStates) fail('KSTACK_HOST_PATTERN_DFA_LIMIT');
    const identifier = identifiers.size;
    identifiers.set(key, identifier);
    subsets.push(bits);
    accepting.push(((bits[accept >>> 5] >>> (accept & 31)) & 1) === 1);
    transitions.push(new Int32Array(symbolCount).fill(-1));
    return identifier;
  };
  intern(closure([start]));
  const members = [];
  for (let identifier = 0; identifier < subsets.length; identifier += 1) {
    const bits = subsets[identifier];
    members.length = 0;
    for (let word = 0; word < words; word += 1) {
      let remaining = bits[word];
      while (remaining !== 0) {
        const lowest = remaining & -remaining;
        const source = (word << 5) + (31 - Math.clz32(lowest));
        if (admitted[source] !== null) members.push(source);
        remaining ^= lowest;
      }
    }
    for (let symbol = 1; symbol < symbolCount; symbol += 1) {
      const moved = [];
      for (const source of members) if (admitted[source][symbol] === 1) moved.push(states[source].next);
      if (moved.length === 0) continue;
      transitions[identifier][symbol] = intern(closure(moved));
    }
  }
  return { accepting, transitions };
}

function compileClosedPattern(pattern) {
  if (typeof pattern !== 'string' || Buffer.byteLength(pattern, 'ascii') > HOST_CONTRACT_LIMITS.maxPatternBytes
      || !/^[\x20-\x7e]+$/u.test(pattern) || pattern[0] !== '^' || pattern.at(-1) !== '$') fail('KSTACK_HOST_PATTERN_INVALID');
  const atoms = parseClosedPatternAtoms(pattern.slice(1, -1));
  const alphabet = closedPatternAlphabet(atoms);
  const { accepting, transitions } = determinizeClosedPattern(buildClosedPatternNfa(atoms), alphabet);
  const { symbolOf } = alphabet;
  return Object.freeze({
    source: pattern,
    dfaStateCount: accepting.length,
    test(value) {
      if (typeof value !== 'string') return false;
      let current = 0;
      for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code > 127) return false;
        const symbol = symbolOf[code];
        if (symbol === 0) return false;
        current = transitions[current][symbol];
        if (current < 0) return false;
      }
      return accepting[current];
    }
  });
}

function validateClosedDeclaration(schema, state, depth = 0) {
  if (depth > HOST_CONTRACT_LIMITS.maxDepth || !schema || typeof schema !== 'object' || Array.isArray(schema)) fail('KSTACK_HOST_SCHEMA_DECLARATION_INVALID');
  const keys = Object.keys(schema);
  if (keys.length === 0 || keys.length > HOST_CONTRACT_LIMITS.maxObjectProperties) fail('KSTACK_HOST_SCHEMA_DECLARATION_INVALID');
  for (const key of keys) if (!CLOSED_KEYWORDS.has(key)) fail('KSTACK_HOST_SCHEMA_KEYWORD_FORBIDDEN');
  if (Object.hasOwn(schema, '$ref')) {
    if (keys.length !== 1) fail('KSTACK_HOST_SCHEMA_REF_SIBLING');
    assertAsciiId(schema.$ref);
    state.refs.push(schema.$ref);
    if (state.refs.length > HOST_CONTRACT_LIMITS.maxRefEdges) fail('KSTACK_HOST_SCHEMA_REF_LIMIT');
    return;
  }
  if (schema.type !== undefined && !CLOSED_TYPES.has(schema.type)) fail('KSTACK_HOST_SCHEMA_TYPE_INVALID');
  if (schema.properties !== undefined) {
    if (schema.type !== 'object' || !schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties)) fail('KSTACK_HOST_SCHEMA_PROPERTIES_INVALID');
    const propertyKeys = Object.keys(schema.properties);
    if (propertyKeys.length > HOST_CONTRACT_LIMITS.maxObjectProperties) fail('KSTACK_HOST_SCHEMA_PROPERTIES_INVALID');
    for (const key of propertyKeys) { assertNfcString(key); validateClosedDeclaration(schema.properties[key], state, depth + 1); }
    if (!Array.isArray(schema.required) || new Set(schema.required).size !== schema.required.length
        || schema.required.some((key) => !Object.hasOwn(schema.properties, key))) fail('KSTACK_HOST_SCHEMA_REQUIRED_INVALID');
    if (schema.additionalProperties !== false) fail('KSTACK_HOST_SCHEMA_NOT_CLOSED');
  } else if (schema.type === 'object' || schema.required !== undefined || schema.additionalProperties !== undefined) fail('KSTACK_HOST_SCHEMA_PROPERTIES_INVALID');
  if (schema.items !== undefined) {
    if (schema.type !== 'array') fail('KSTACK_HOST_SCHEMA_ITEMS_INVALID');
    validateClosedDeclaration(schema.items, state, depth + 1);
  } else if (schema.type === 'array') fail('KSTACK_HOST_SCHEMA_ITEMS_INVALID');
  for (const pair of [['minItems', 'maxItems'], ['minLength', 'maxLength'], ['minimum', 'maximum']]) {
    for (const key of pair) if (schema[key] !== undefined) assertSafeUInt(schema[key]);
    if (schema[pair[0]] !== undefined && schema[pair[1]] !== undefined && schema[pair[0]] > schema[pair[1]]) fail('KSTACK_HOST_SCHEMA_BOUNDS_INVALID');
  }
  if ((schema.minItems !== undefined || schema.maxItems !== undefined) && schema.type !== 'array') fail('KSTACK_HOST_SCHEMA_BOUNDS_INVALID');
  if ((schema.minLength !== undefined || schema.maxLength !== undefined || schema.pattern !== undefined) && schema.type !== 'string') fail('KSTACK_HOST_SCHEMA_BOUNDS_INVALID');
  if ((schema.minimum !== undefined || schema.maximum !== undefined) && schema.type !== 'integer') fail('KSTACK_HOST_SCHEMA_BOUNDS_INVALID');
  if (schema.pattern !== undefined) {
    // Compile-once-per-distinct-pattern-string within a single schema-set
    // compile. state.patterns stays keyed by schema object so every existing
    // lookup is unchanged; state.patternCache only avoids recompiling an
    // identical pattern string that appears in several schema nodes.
    let compiledPattern = state.patternCache.get(schema.pattern);
    if (compiledPattern === undefined) {
      compiledPattern = compileClosedPattern(schema.pattern);
      state.patternCache.set(schema.pattern, compiledPattern);
    }
    state.patterns.set(schema, compiledPattern);
  }
  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum) || schema.enum.length === 0 || schema.enum.length > 1024) fail('KSTACK_HOST_SCHEMA_ENUM_INVALID');
    if (new Set(schema.enum.map((entry) => hostCanonicalBytes(entry).toString('hex'))).size !== schema.enum.length) fail('KSTACK_HOST_SCHEMA_ENUM_INVALID');
  }
  if (schema.oneOf !== undefined) {
    if (!Array.isArray(schema.oneOf) || schema.oneOf.length < 2 || schema.oneOf.length > 32) fail('KSTACK_HOST_SCHEMA_ONE_OF_INVALID');
    for (const branch of schema.oneOf) validateClosedDeclaration(branch, state, depth + 1);
  }
  if (schema['x-kstack-collection'] !== undefined) {
    if (schema.type !== 'array') fail('KSTACK_HOST_COLLECTION_INVALID');
    validateCollectionDeclaration(schema['x-kstack-collection']);
  }
}

function valueMatches(schema, value, compiled, activeRefs) {
  if (schema.$ref !== undefined) {
    if (activeRefs.has(schema.$ref)) fail('KSTACK_HOST_SCHEMA_REF_CYCLE');
    activeRefs.add(schema.$ref);
    const result = valueMatches(compiled.schemas.get(schema.$ref), value, compiled, activeRefs);
    activeRefs.delete(schema.$ref);
    return result;
  }
  if (schema.type === 'null' && value !== null) return false;
  if (schema.type === 'boolean' && typeof value !== 'boolean') return false;
  if (schema.type === 'integer' && !Number.isSafeInteger(value)) return false;
  if (schema.type === 'string' && typeof value !== 'string') return false;
  if (schema.type === 'array' && !Array.isArray(value)) return false;
  if (schema.type === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))) return false;
  if (Object.hasOwn(schema, 'const') && !hostCanonicalBytes(value).equals(hostCanonicalBytes(schema.const))) return false;
  if (schema.enum && !schema.enum.some((entry) => hostCanonicalBytes(entry).equals(hostCanonicalBytes(value)))) return false;
  if (typeof value === 'string') {
    const length = [...value].length;
    if ((schema.minLength !== undefined && length < schema.minLength) || (schema.maxLength !== undefined && length > schema.maxLength)) return false;
    if (schema.pattern !== undefined && !compiled.patterns.get(schema).test(value)) return false;
  }
  if (typeof value === 'number' && ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum))) return false;
  if (Array.isArray(value)) {
    if ((schema.minItems !== undefined && value.length < schema.minItems) || (schema.maxItems !== undefined && value.length > schema.maxItems)) return false;
    if (!value.every((entry) => valueMatches(schema.items, entry, compiled, activeRefs))) return false;
    if (schema['x-kstack-collection']) assertCollectionOrder(value, schema['x-kstack-collection']);
  }
  if (schema.type === 'object') {
    if (Object.keys(value).some((key) => !Object.hasOwn(schema.properties, key))) return false;
    if (schema.required.some((key) => !Object.hasOwn(value, key))) return false;
    for (const [key, member] of Object.entries(value)) if (!valueMatches(schema.properties[key], member, compiled, activeRefs)) return false;
  }
  if (schema.oneOf) {
    let matches = 0;
    for (const branch of schema.oneOf) if (valueMatches(branch, value, compiled, new Set(activeRefs))) matches += 1;
    if (matches !== 1) return false;
  }
  return true;
}

function assertAcyclicRefs(schemas) {
  const visited = new Set();
  const active = new Set();
  function walk(id) {
    if (active.has(id)) fail('KSTACK_HOST_SCHEMA_REF_CYCLE');
    if (visited.has(id)) return;
    active.add(id);
    const stack = [schemas.get(id)];
    while (stack.length) {
      const schema = stack.pop();
      if (schema.$ref !== undefined) {
        if (!schemas.has(schema.$ref)) fail('KSTACK_HOST_SCHEMA_REF_UNRESOLVED');
        walk(schema.$ref);
      }
      if (schema.properties) stack.push(...Object.values(schema.properties));
      if (schema.items) stack.push(schema.items);
      if (schema.oneOf) stack.push(...schema.oneOf);
    }
    active.delete(id);
    visited.add(id);
  }
  for (const id of schemas.keys()) walk(id);
}

function dereferenceDeclaration(schema, schemas) {
  let current = schema;
  const seen = new Set();
  while (current.$ref !== undefined) {
    if (seen.has(current.$ref)) fail('KSTACK_HOST_SCHEMA_REF_CYCLE');
    seen.add(current.$ref);
    current = schemas.get(current.$ref);
    if (!current) fail('KSTACK_HOST_SCHEMA_REF_UNRESOLVED');
  }
  return current;
}

function validateCollectionSchemaShapes(schemas) {
  const visited = new Set();
  const stringSchema = (schema) => schema.type === 'string'
    || Array.isArray(schema.enum) && schema.enum.every((entry) => typeof entry === 'string')
    || Array.isArray(schema.oneOf) && schema.oneOf.length > 0 && schema.oneOf.every((entry) => stringSchema(entry));
  function walk(schema) {
    if (visited.has(schema)) return;
    visited.add(schema);
    const declaration = dereferenceDeclaration(schema, schemas);
    const collection = declaration['x-kstack-collection'];
    if (collection) {
      const member = dereferenceDeclaration(declaration.items, schemas);
      if (collection.mode === 'SET_BY_VALUE_ASCII' && !stringSchema(member)) fail('KSTACK_HOST_COLLECTION_MEMBER_SCHEMA_INVALID');
      if (collection.mode === 'SET_BY_VALUE_DIGEST' && (member.type !== 'string' || member.pattern !== '^sha256:[0-9a-f]{64}$')) fail('KSTACK_HOST_COLLECTION_MEMBER_SCHEMA_INVALID');
      if (collection.mode === 'SET_BY_FIELDS') {
        if (member.type !== 'object') fail('KSTACK_HOST_COLLECTION_MEMBER_SCHEMA_INVALID');
        collection.keyFields.forEach((field, index) => {
          if (!member.required.includes(field)) fail('KSTACK_HOST_COLLECTION_KEY_SCHEMA_INVALID');
          const keySchema = dereferenceDeclaration(member.properties[field], schemas);
          if (keySchema.type === 'null' || ['array', 'object'].includes(keySchema.type)
              || keySchema.oneOf?.some((entry) => entry.type === 'null')) fail('KSTACK_HOST_COLLECTION_KEY_SCHEMA_INVALID');
          const kind = collection.keyKinds[index];
          if (kind === 'ASCII' && !stringSchema(keySchema)) fail('KSTACK_HOST_COLLECTION_KEY_SCHEMA_INVALID');
          if (kind === 'DIGEST' && (keySchema.type !== 'string' || keySchema.pattern !== '^sha256:[0-9a-f]{64}$')) fail('KSTACK_HOST_COLLECTION_KEY_SCHEMA_INVALID');
          if (kind === 'ASCII_CANONICAL_UINT' && (keySchema.type !== 'integer' || (keySchema.minimum ?? -1) < 0)) fail('KSTACK_HOST_COLLECTION_KEY_SCHEMA_INVALID');
        });
      }
    }
    if (declaration.properties) for (const child of Object.values(declaration.properties)) walk(child);
    if (declaration.items) walk(declaration.items);
    if (declaration.oneOf) for (const child of declaration.oneOf) walk(child);
  }
  for (const schema of schemas.values()) walk(schema);
}

export function compileClosedSchemaSet(entries) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > HOST_CONTRACT_LIMITS.maxSchemas) fail('KSTACK_HOST_SCHEMA_SET_INVALID');
  const schemas = new Map();
  const state = { refs: [], patterns: new WeakMap(), patternCache: new Map() };
  for (const entry of entries) {
    exactKeys(entry, ['schemaId', 'schema']);
    assertAsciiId(entry.schemaId);
    if (schemas.has(entry.schemaId)) fail('KSTACK_HOST_SCHEMA_DUPLICATE');
    assertTreeBounds(entry.schema);
    validateClosedDeclaration(entry.schema, state);
    schemas.set(entry.schemaId, entry.schema);
  }
  assertAcyclicRefs(schemas);
  validateCollectionSchemaShapes(schemas);
  const compiled = { schemas, patterns: state.patterns };
  return Object.freeze({
    schemaIds: Object.freeze([...schemas.keys()].sort()),
    validate(schemaId, value) {
      assertTreeBounds(value);
      if (!schemas.has(schemaId)) fail('KSTACK_HOST_SCHEMA_UNKNOWN');
      if (!valueMatches(schemas.get(schemaId), value, compiled, new Set([schemaId]))) fail('KSTACK_HOST_SCHEMA_VALUE_INVALID');
      return value;
    }
  });
}

function sha256Digest(source) {
  return `sha256:${crypto.createHash('sha256').update(source).digest('hex')}`;
}

function requireStoredBytes(store, digest) {
  assertDigest(digest);
  if (typeof store !== 'function') fail('KSTACK_HOST_OBJECT_STORE_REQUIRED');
  const value = store(digest);
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail('KSTACK_HOST_CLOSURE_UNAVAILABLE');
  return bytes(value);
}

function loadBootstrap(store, digest, name) {
  const source = requireStoredBytes(store, digest);
  const value = parseHostCanonicalJson(source);
  const validated = validateHostBootstrap(name, value);
  if (validated.objectDigest !== digest) fail('KSTACK_HOST_CLOSURE_DIGEST_MISMATCH');
  return value;
}

function exactResolver(schemaSet, resolverSet) {
  const candidates = resolverSet.entries.filter((entry) => entry.schemaLanguageVersion === schemaSet.schemaLanguageVersion
    && entry.supportedMetaschemaDigests.includes(schemaSet.metaschemaDigest)
    && entry.supportedCanonicalizationProfileDigests.includes(schemaSet.canonicalizationProfileDigest)
    && entry.invariantRegistryDigests.includes(schemaSet.invariantRegistryDigest)
    && entry.vectorSetDigest === schemaSet.crossRuntimeVectorSetDigest);
  if (candidates.length !== 1) fail('KSTACK_HOST_RESOLVER_PAIR_INVALID');
  return candidates[0];
}

function requireImplementationClosure(resolver, invariantRegistry, vectorSet, options) {
  const installedResolvers = options.installedResolverDigests instanceof Set ? options.installedResolverDigests : new Set(options.installedResolverDigests || []);
  const installedInvariants = options.installedInvariantDigests instanceof Set ? options.installedInvariantDigests : new Set(options.installedInvariantDigests || []);
  const passingVectors = options.passingVectorIds instanceof Set ? options.passingVectorIds : new Set(options.passingVectorIds || []);
  if (!installedResolvers.has(resolver.implementationDigest)) fail('KSTACK_HOST_RESOLVER_UNAVAILABLE');
  const vectorIds = new Set(vectorSet.entries.map((entry) => entry.vectorId));
  for (const invariant of invariantRegistry.entries) {
    if (!installedInvariants.has(invariant.implementationDigest)) fail('KSTACK_HOST_INVARIANT_UNAVAILABLE');
    for (const vectorId of invariant.vectorIds) {
      if (!vectorIds.has(vectorId) || !passingVectors.has(vectorId)) fail('KSTACK_HOST_INVARIANT_VECTOR_UNAVAILABLE');
    }
  }
}

function requireInvariantApplicabilityClosure(schemaSet, invariantRegistry) {
  const schemaIds = new Set(schemaSet.schemaEntries.map((entry) => entry.schemaId));
  for (const invariant of invariantRegistry.entries) {
    for (const schemaId of invariant.applicableSchemaIds) {
      if (!schemaIds.has(schemaId)) fail('KSTACK_HOST_INVARIANT_APPLICABILITY_CLOSURE_INVALID');
    }
  }
}

function storedValueResolver(store) {
  return (digest) => parseHostCanonicalJson(requireStoredBytes(store, digest));
}

function executeHistoricalInvariants(name, artifact, vocabulary, invariantRegistry, options) {
  const applicable = invariantRegistry.entries.filter((entry) => entry.applicableSchemaIds.includes(artifact.schemaId));
  if (applicable.length === 0) return validateHostArtifact(name, artifact, { vocabulary });
  const contextualNames = new Set(['OperationRequestV1', 'OperationEligibilityV1', 'OperationReceiptV1', 'SchemaSelectionV1']);
  if (!contextualNames.has(name)) return validateHostArtifact(name, artifact, { vocabulary });
  const fallback = storedValueResolver(options.getObject);
  return validateHostArtifactContext(name, artifact, {
    vocabulary,
    resolveArtifact: options.resolveArtifact || fallback,
    resolveBootstrap: options.resolveBootstrap || fallback,
    resolveOperationClassRule: options.resolveOperationClassRule
  });
}

function resolutionResult(outcome, reasonCode, details = {}) {
  return Object.freeze({ outcome, reasonCode, ...details });
}

const CLOSURE_FAILURES = new Set([
  'KSTACK_HOST_CLOSURE_UNAVAILABLE', 'KSTACK_HOST_CLOSURE_DIGEST_MISMATCH', 'KSTACK_HOST_RESOLVER_UNAVAILABLE',
  'KSTACK_HOST_INVARIANT_UNAVAILABLE', 'KSTACK_HOST_INVARIANT_VECTOR_UNAVAILABLE'
]);

export function resolveHistoricalArtifact(input, options = {}) {
  let artifact;
  try {
    artifact = parseHostCanonicalJson(input);
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) fail('KSTACK_HOST_ARTIFACT_HEAD_INVALID');
    for (const key of ['schemaId', 'schemaVersion', 'schemaSetDigest']) if (!Object.hasOwn(artifact, key)) fail('KSTACK_HOST_ARTIFACT_HEAD_INVALID');
    assertAsciiId(artifact.schemaId);
    assertSafeUInt(artifact.schemaVersion, true);
    assertDigest(artifact.schemaSetDigest);
    assertDigest(options.expectedSchemaDigest);
  } catch (error) {
    return resolutionResult('INVALID', error?.code || 'KSTACK_HOST_ARTIFACT_INVALID');
  }

  try {
    const schemaSet = loadBootstrap(options.getObject, artifact.schemaSetDigest, 'HostContractSchemaSetV1');
    const matches = schemaSet.schemaEntries.filter((entry) => entry.schemaId === artifact.schemaId && entry.schemaVersion === artifact.schemaVersion);
    if (matches.length !== 1 || matches[0].schemaDigest !== options.expectedSchemaDigest) fail('KSTACK_HOST_SCHEMA_BINDING_INVALID');
    const schemaEntry = matches[0];

    loadBootstrap(options.getObject, schemaSet.metaschemaDigest, 'KStackClosedMetaschemaV1');
    loadBootstrap(options.getObject, schemaSet.canonicalizationProfileDigest, 'CanonicalizationProfileV1');
    const vocabularyRegistry = loadBootstrap(options.getObject, schemaSet.closedVocabularyRegistryDigest, 'ClosedVocabularyRegistryV1');
    const invariantRegistry = loadBootstrap(options.getObject, schemaSet.invariantRegistryDigest, 'InvariantRegistryV1');
    const resolverSet = loadBootstrap(options.getObject, schemaSet.historicalResolverSetDigest, 'HistoricalResolverSetV1');
    const vectorSet = loadBootstrap(options.getObject, schemaSet.crossRuntimeVectorSetDigest, 'CrossRuntimeVectorSetV1');
    const resolver = exactResolver(schemaSet, resolverSet);
    requireImplementationClosure(resolver, invariantRegistry, vectorSet, options);
    requireInvariantApplicabilityClosure(schemaSet, invariantRegistry);

    const declarations = [];
    for (const entry of schemaSet.schemaEntries) {
      const source = requireStoredBytes(options.getObject, entry.schemaDigest);
      if (sha256Digest(source) !== entry.schemaDigest) fail('KSTACK_HOST_CLOSURE_DIGEST_MISMATCH');
      declarations.push({ schemaId: entry.schemaId, schema: parseHostCanonicalJson(source) });
    }
    const compiled = compileClosedSchemaSet(declarations);
    compiled.validate(artifact.schemaId, artifact);

    const knownName = Object.keys(HOST_ARTIFACT_IDENTITIES).find((name) => HOST_ARTIFACT_IDENTITIES[name].schemaId === artifact.schemaId);
    if (knownName) executeHistoricalInvariants(knownName, artifact, vocabularyFromRegistry(vocabularyRegistry), invariantRegistry, options);
    return resolutionResult('VALID', 'KSTACK_HOST_ARTIFACT_VALID', {
      artifactDigest: hostAddress(schemaEntry.artifactDomain, artifact),
      schemaDigest: schemaEntry.schemaDigest,
      schemaSetDigest: artifact.schemaSetDigest,
      resolverId: resolver.resolverId,
      resolverImplementationDigest: resolver.implementationDigest
    });
  } catch (error) {
    const reasonCode = error?.code || 'KSTACK_HOST_ARTIFACT_INVALID';
    const unavailable = CLOSURE_FAILURES.has(reasonCode) || reasonCode.endsWith('_UNAVAILABLE');
    return resolutionResult(unavailable ? 'UNAVAILABLE' : 'INVALID', reasonCode);
  }
}
