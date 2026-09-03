import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  HOST_ARTIFACT_IDENTITIES,
  HOST_ARTIFACT_SCHEMAS,
  HOST_BOOTSTRAP_SCHEMA_DIGESTS,
  HOST_BOOTSTRAP_SCHEMA_DOCUMENTS,
  HOST_BOOTSTRAP_SCHEMAS,
  HOST_CONTRACT_LIMITS,
  HOST_INVARIANT_APPLICABLE_SCHEMAS,
  HOST_INVARIANT_CLOSURE_EXCLUSIONS,
  HOST_INVARIANT_HASHED_CONSTANTS,
  HOST_INVARIANT_IMPLEMENTATIONS,
  HOST_INVARIANT_IMPLEMENTATION_DIGESTS,
  HOST_INVARIANT_PROGRAMS,
  REQUIRED_INVARIANT_IDS,
  artifactHead,
  buildHostArtifactSchemaSet,
  assertAsciiId,
  assertCollectionOrder,
  assertRegistryId,
  assertTimestamp,
  compileClosedSchemaSet,
  constructHostContractClosure,
  hostAddress,
  hostCanonicalBytes,
  parseHostCanonicalJson,
  resolveHistoricalArtifact,
  validateCollectionDeclaration,
  validateHostArtifact,
  validateHostArtifactContext,
  validateHostBootstrap,
  vocabularyFromRegistry
} from '../plugins/kstack/scripts/kstack-host-contract.mjs';

const digest = (character = 'a') => `sha256:${character.repeat(64)}`;
const pythonOracle = fileURLToPath(new URL('./helpers/host-contract-python-oracle.py', import.meta.url));
const crossRuntimeVectors = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./fixtures/host-contract-cross-runtime-vectors-v1.json', import.meta.url)), 'utf8'));
const rustManifest = fileURLToPath(new URL('../plugins/kstack/native/host-contract-reference/Cargo.toml', import.meta.url));
const hostContractModule = fileURLToPath(new URL('../plugins/kstack/scripts/kstack-host-contract.mjs', import.meta.url));
const vocabulary = Object.freeze({
  mediaTypes: ['application-json'], operationIds: ['inspect'], operationClassIds: ['LOCAL_READ', 'read-only'],
  capabilityIds: ['file-read', 'text-search'], fixtureIds: ['basic'], reasonCodes: ['KSTACK_HOST_CLASS_MISMATCH', 'none'], errorCodes: ['KSTACK_HOST_DENIED', 'denied'],
  operationProfileIds: ['read-safe'], componentRoles: ['runtime'], receiptKinds: ['local'], quarantineSubjectTypes: ['host']
});

function closedSchemaSample(schema) {
  if (Object.hasOwn(schema, 'const')) return structuredClone(schema.const);
  if (schema.enum) return structuredClone(schema.enum[0]);
  if (schema.oneOf) return closedSchemaSample(schema.oneOf[0]);
  if (schema.type === 'null') return null;
  if (schema.type === 'boolean') return false;
  if (schema.type === 'integer') return schema.minimum ?? 0;
  if (schema.type === 'string') {
    if (schema.pattern === '^sha256:[0-9a-f]{64}$') return digest('a');
    if (schema.pattern === '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$') return '2026-08-28T12:00:00.000Z';
    return 'a';
  }
  if (schema.type === 'array') return Array.from({ length: schema.minItems ?? 0 }, () => closedSchemaSample(schema.items));
  if (schema.type === 'object') return Object.fromEntries(Object.entries(schema.properties).map(([key, declaration]) => [key, closedSchemaSample(declaration)]));
  throw new Error('unsupported closed schema sample');
}

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected, expected);
}

function patternProbe(pattern) {
  const compiled = compileClosedSchemaSet([{ schemaId: 'probe', schema: { type: 'string', pattern } }]);
  return (value) => {
    try { compiled.validate('probe', value); return true; }
    catch (error) {
      if (error?.code !== 'KSTACK_HOST_SCHEMA_VALUE_INVALID') throw error;
      return false;
    }
  };
}

function request(changes = {}) {
  return {
    ...artifactHead('OperationRequestV1', digest('f')),
    operationId: 'inspect', operationSchemaDigest: digest('a'), requirementProfileDigest: digest('b'),
    repositoryContextDigest: digest('c'), trustedRequestContextDigest: digest('d'), activeSetDigest: digest('e'), policyDigest: digest('1'),
    inputs: [{ name: 'input', mediaTypeId: 'application-json', artifactRef: { schemaDigest: digest('2'), objectDigest: digest('3'), byteCount: 12 } }],
    limits: { deadlineMs: 1000, maxInputBytes: 1024, maxOutputBytes: 2048 }, authorityEnvelopeDigest: null,
    hostEvidenceSetDigest: digest('4'), nonceDigest: digest('5'), idempotencyKeyDigest: digest('6'),
    createdAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-08-28T12:01:00.000Z',
    ...changes
  };
}

function requirementProfile(schemaSetDigest = digest('f'), changes = {}) {
  return {
    ...artifactHead('OperationRequirementProfileV1', schemaSetDigest), operationId: 'inspect', operationSchemaDigest: digest('a'),
    operationClassId: 'LOCAL_READ', requiredCapabilities: [
      { capabilityId: 'file-read', evidenceProfileDigest: digest('1'), mandatory: true },
      { capabilityId: 'text-search', evidenceProfileDigest: digest('2'), mandatory: false }
    ], negativeFixtureIds: ['basic'], receiptProfileDigest: digest('3'), actionFenceProfileDigest: digest('4'),
    alternateProfiles: [{ profileId: 'read-safe', requirementProfileDigest: digest('5'), maximumStatus: 'DEGRADED_REGISTERED' }],
    ...changes
  };
}

// A DEGRADED_REGISTERED eligibility that exactly partitions `requirementProfile`'s
// required capabilities and names its registered alternate, so every contextual
// guard except the one under test is already satisfied.
function eligibilityFor(requirementProfileDigest, changes = {}) {
  return {
    ...artifactHead('OperationEligibilityV1', digest('f')), operationId: 'inspect', requirementProfileDigest,
    hostEvidenceSetDigest: digest('a'), activeSetDigest: digest('b'), policyDigest: digest('c'), status: 'DEGRADED_REGISTERED',
    alternateProfileId: 'read-safe', provenCapabilityIds: ['file-read'], missingCapabilityIds: ['text-search'], reasonCodes: ['none'],
    evaluatedAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-08-28T12:01:00.000Z', ...changes
  };
}

function metaschemaValue() {
  return {
    schemaId: 'kstack.closed-metaschema.v1', schemaVersion: 1, schemaLanguageVersion: 'kstack-closed-schema-v1',
    permittedKeywords: ['$ref', 'additionalProperties', 'const', 'enum', 'items', 'maxItems', 'maxLength', 'maximum', 'minItems', 'minLength', 'minimum', 'oneOf', 'pattern', 'properties', 'required', 'type', 'x-kstack-collection'],
    regexGrammarDigest: digest('a'), collectionGrammarDigest: digest('b'), resourceLimits: {
      maxDocumentBytes: 1048576, maxDepth: 32, maxObjectProperties: 64, maxArrayItems: 1024, maxStringUtf8Bytes: 16384,
      maxSchemas: 256, maxRefEdges: 2048, maxPatternBytes: 256, maxPatternDfaStates: 4096
    }
  };
}

const pick = (result) => ({ outcome: result.outcome, reasonCode: result.reasonCode });

// `mod` selects which module build mints the closure's bootstrap digests. It
// defaults to the module under test; a mutated build must pass its own
// namespace, because an InvariantRegistryV1 carrying another build's
// implementation digests is rejected as KSTACK_HOST_INVARIANT_IMPLEMENTATION_MISMATCH.
//
// `registryVectorIds` names the vectors the registry claims each invariant is
// covered by. It defaults to the one vector the CrossRuntimeVectorSetV1 below
// actually publishes; naming one it does not is how requireImplementationClosure's
// "declared but unpublished vector" branch is reached.
function historicalFixture(mod = { validateHostBootstrap, HOST_INVARIANT_IMPLEMENTATION_DIGESTS }, registryVectorIds = ['basic']) {
  const store = new Map();
  const putBootstrap = (name, value) => {
    const validated = mod.validateHostBootstrap(name, value);
    store.set(validated.objectDigest, validated.canonicalBytes);
    return validated.objectDigest;
  };
  const keywords = ['$ref', 'additionalProperties', 'const', 'enum', 'items', 'maxItems', 'maxLength', 'maximum', 'minItems', 'minLength', 'minimum', 'oneOf', 'pattern', 'properties', 'required', 'type', 'x-kstack-collection'];
  const metaschemaDigest = putBootstrap('KStackClosedMetaschemaV1', {
    schemaId: 'kstack.closed-metaschema.v1', schemaVersion: 1, schemaLanguageVersion: 'kstack-closed-schema-v1', permittedKeywords: keywords,
    regexGrammarDigest: digest('a'), collectionGrammarDigest: digest('b'), resourceLimits: {
      maxDocumentBytes: 1048576, maxDepth: 32, maxObjectProperties: 64, maxArrayItems: 1024, maxStringUtf8Bytes: 16384,
      maxSchemas: 256, maxRefEdges: 2048, maxPatternBytes: 256, maxPatternDfaStates: 4096
    }
  });
  const canonicalizationProfileDigest = putBootstrap('CanonicalizationProfileV1', {
    schemaId: 'kstack.canonicalization-profile.v1', schemaVersion: 1, profileId: 'rfc8785-kstack-v1', rfc8785SpecDigest: digest('c'),
    unicodePolicy: 'VALID_SCALAR_NFC_REJECT_OTHER', numberPolicy: 'SAFE_INTEGER_CANONICAL_ONLY', timestampPolicy: 'UTC_MILLISECOND_YEAR0001_9999',
    duplicateKeyPolicy: 'REJECT_BEFORE_PARSE', collectionGrammarDigest: digest('b'), regexGrammarDigest: digest('a')
  });
  const vocabularyDigest = putBootstrap('ClosedVocabularyRegistryV1', {
    schemaId: 'kstack.closed-vocabulary-registry.v1', schemaVersion: 1, registryId: 'base',
    collections: [{ collectionId: 'media-types', entries: [{ id: 'application-json' }] }]
  });
  const implementationDigests = Object.values(mod.HOST_INVARIANT_IMPLEMENTATION_DIGESTS);
  const invariantRegistryDigest = putBootstrap('InvariantRegistryV1', {
    schemaId: 'kstack.invariant-registry.v1', schemaVersion: 1, registryId: 'base',
    entries: REQUIRED_INVARIANT_IDS.map((invariantId) => ({
      invariantId, implementationDigest: mod.HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
      applicableSchemaIds: HOST_INVARIANT_APPLICABLE_SCHEMAS[invariantId], vectorIds: registryVectorIds
    }))
  });
  const vectorDigest = putBootstrap('CrossRuntimeVectorSetV1', {
    schemaId: 'kstack.cross-runtime-vector-set.v1', schemaVersion: 1, vectorSetId: 'base', entries: [{
      vectorId: 'basic', operationId: 'inspect', inputBytesDigest: digest('e'), expectedOutcome: 'ACCEPT',
      expectedCanonicalBytesDigest: null, expectedObjectDigest: null
    }]
  });
  const resolverImplementationDigest = digest('f');
  const resolverSetDigest = putBootstrap('HistoricalResolverSetV1', {
    schemaId: 'kstack.historical-resolver-set.v1', schemaVersion: 1, resolverSetId: 'base', entries: [{
      resolverId: 'builtin', schemaLanguageVersion: 'kstack-closed-schema-v1', implementationDigest: resolverImplementationDigest,
      supportedMetaschemaDigests: [metaschemaDigest], supportedCanonicalizationProfileDigests: [canonicalizationProfileDigest],
      invariantRegistryDigests: [invariantRegistryDigest], vectorSetDigest: vectorDigest
    }]
  });
  const leaf = {
    type: 'object', properties: {
      payload: { type: 'integer', minimum: 0, maximum: 10 }, schemaId: { const: 'demo' }, schemaSetDigest: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' }, schemaVersion: { const: 1 }
    }, required: ['payload', 'schemaId', 'schemaSetDigest', 'schemaVersion'], additionalProperties: false
  };
  const leafBytes = hostCanonicalBytes(leaf);
  const leafDigest = `sha256:${crypto.createHash('sha256').update(leafBytes).digest('hex')}`;
  store.set(leafDigest, leafBytes);
  const schemaEntries = [{ schemaId: 'demo', schemaVersion: 1, schemaDigest: leafDigest, artifactDomain: 'KSTACK-DEMO-V1' }];
  const applicableSchemaIds = new Set(Object.values(HOST_INVARIANT_APPLICABLE_SCHEMAS).flat());
  const schemaDigests = {};
  for (const schemaId of applicableSchemaIds) {
    const declaration = {
      type: 'object', properties: {
        schemaId: { const: schemaId }, schemaSetDigest: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' }, schemaVersion: { const: 1 }
      }, required: ['schemaId', 'schemaSetDigest', 'schemaVersion'], additionalProperties: false
    };
    const source = hostCanonicalBytes(declaration);
    const schemaDigest = `sha256:${crypto.createHash('sha256').update(source).digest('hex')}`;
    store.set(schemaDigest, source);
    const identity = Object.values(HOST_ARTIFACT_IDENTITIES).find((entry) => entry.schemaId === schemaId);
    schemaEntries.push({ schemaId, schemaVersion: 1, schemaDigest, artifactDomain: identity.domain });
    schemaDigests[schemaId] = schemaDigest;
  }
  schemaEntries.sort((left, right) => left.schemaId.length - right.schemaId.length || Buffer.compare(Buffer.from(left.schemaId), Buffer.from(right.schemaId)));
  const schemaSet = {
    schemaId: 'kstack.host-contract-schema-set.v1', schemaVersion: 1, metaschemaDigest, schemaLanguageVersion: 'kstack-closed-schema-v1',
    canonicalizationProfileDigest, schemaEntries,
    closedVocabularyRegistryDigest: vocabularyDigest, invariantRegistryDigest, historicalResolverSetDigest: resolverSetDigest, crossRuntimeVectorSetDigest: vectorDigest
  };
  const schemaSetDigest = putBootstrap('HostContractSchemaSetV1', schemaSet);
  const artifact = { payload: 7, schemaId: 'demo', schemaSetDigest, schemaVersion: 1 };
  return {
    artifactBytes: hostCanonicalBytes(artifact), leafDigest, store, implementationDigests, resolverImplementationDigest,
    schemaSetDigest, schemaDigests,
    options: { expectedSchemaDigest: leafDigest, getObject: (key) => store.get(key), installedResolverDigests: [resolverImplementationDigest], installedInvariantDigests: implementationDigests, passingVectorIds: ['basic'] }
  };
}

test('HP-TC01 publishes every frozen operation artifact identity', () => {
  assert.equal(Object.keys(HOST_ARTIFACT_SCHEMAS).length, 17);
  assert.deepEqual(Object.keys(HOST_ARTIFACT_SCHEMAS).sort(), [
    'ActivationRecordV1', 'CompatibilityEntryV1', 'HistoricalResolutionReceiptV1', 'HostConformanceEvidenceBodyV1', 'HostConformanceEvidenceV1',
    'HostEvidenceSetV1', 'HostObservationV1', 'OperationEligibilityV1', 'OperationErrorV1', 'OperationLeaseV1',
    'OperationReceiptV1', 'OperationRequestV1', 'OperationRequirementProfileV1', 'OperationResultV1', 'QuarantineEventV1',
    'SchemaOfferV1', 'SchemaSelectionV1'
  ]);
  assert.equal(new Set(Object.values(HOST_ARTIFACT_IDENTITIES).map((entry) => entry.domain)).size, 17);
});

test('every frozen operation artifact exposes its exact closed field inventory', () => {
  const fields = {
    OperationRequestV1: ['operationId', 'operationSchemaDigest', 'requirementProfileDigest', 'repositoryContextDigest', 'trustedRequestContextDigest', 'activeSetDigest', 'policyDigest', 'inputs', 'limits', 'authorityEnvelopeDigest', 'hostEvidenceSetDigest', 'nonceDigest', 'idempotencyKeyDigest', 'createdAt', 'expiresAt'],
    OperationResultV1: ['requestDigest', 'operationId', 'activeSetDigest', 'status', 'startedAt', 'completedAt', 'outputs', 'errorDigest', 'receiptProfileDigest'],
    OperationErrorV1: ['requestDigest', 'errorCode', 'retryDisposition', 'affectedIds', 'correlationDigest', 'detailArtifactDigest'],
    OperationRequirementProfileV1: ['operationId', 'operationSchemaDigest', 'operationClassId', 'requiredCapabilities', 'negativeFixtureIds', 'receiptProfileDigest', 'actionFenceProfileDigest', 'alternateProfiles'],
    HostObservationV1: ['hostInstanceDigest', 'hostBuildDigest', 'adapterDigest', 'environmentDigest', 'observations', 'limitationsReasonCodes', 'observedAt', 'expiresAt'],
    HostConformanceEvidenceBodyV1: ['hostInstanceDigest', 'hostBuildDigest', 'adapterDigest', 'harnessDigest', 'fixtureSetDigest', 'environmentDigest', 'results', 'issuedAt', 'expiresAt'],
    HostConformanceEvidenceV1: ['hostInstanceDigest', 'hostBuildDigest', 'adapterDigest', 'harnessDigest', 'fixtureSetDigest', 'environmentDigest', 'results', 'issuedAt', 'expiresAt', 'anchorDigest'],
    HostEvidenceSetV1: ['hostInstanceDigest', 'activeSetDigest', 'policyDigest', 'evidenceRefs', 'assembledAt', 'shortestExpiryAt'],
    OperationEligibilityV1: ['operationId', 'requirementProfileDigest', 'hostEvidenceSetDigest', 'activeSetDigest', 'policyDigest', 'status', 'alternateProfileId', 'provenCapabilityIds', 'missingCapabilityIds', 'reasonCodes', 'evaluatedAt', 'expiresAt'],
    CompatibilityEntryV1: ['compatibilityId', 'componentBindings', 'externalHostConstraintDigest', 'compatibleHostContractSchemaSetDigest', 'compatibleResolverSetDigest', 'migrationProfileDigest', 'allowedOperationProfileDigests'],
    ActivationRecordV1: ['candidateActiveSetDigest', 'priorActiveSetDigest', 'compatibilityEntryDigest', 'migrationEvidenceDigest', 'rollbackEvidenceDigest', 'state', 'reasonCodes', 'createdAt', 'decidedAt'],
    OperationLeaseV1: ['requestDigest', 'operationId', 'activeSetDigest', 'policyDigest', 'hostEvidenceSetDigest', 'repositoryContextDigest', 'admissionEpoch', 'issuedAt', 'expiresAt', 'state'],
    OperationReceiptV1: ['requestDigest', 'resultDigest', 'operationId', 'operationClassId', 'activeSetDigest', 'producerId', 'receiptKind', 'producerReceiptDigest', 'localAuditDigest', 'issuedAt'],
    QuarantineEventV1: ['subjectType', 'subjectDigest', 'scopeOperationIds', 'reasonCode', 'sourceEvidenceDigest', 'previousEligibilityDigests', 'effectiveAt', 'expiresAt', 'eventAnchorDigest'],
    SchemaOfferV1: ['hostInstanceDigest', 'schemaSetDigests', 'resolverSetDigests', 'operationProfileDigests', 'offeredAt', 'expiresAt'],
    SchemaSelectionV1: ['offerDigest', 'selectedSchemaSetDigest', 'selectedResolverSetDigest', 'selectedOperationProfileDigests', 'compatibilityEntryDigest', 'selectedAt', 'expiresAt'],
    HistoricalResolutionReceiptV1: ['artifactDigest', 'artifactSchemaSetDigest', 'artifactSchemaDigest', 'resolverSetDigest', 'validationOutcome', 'resolvedAt', 'evidenceDigest']
  };
  for (const [name, expected] of Object.entries(fields)) assert.deepEqual(Object.keys(HOST_ARTIFACT_SCHEMAS[name]), expected, name);
});

test('canonical parser rejects duplicate keys, noncanonical bytes, non-NFC strings, and invalid numbers', () => {
  code('KSTACK_HOST_JSON_DUPLICATE_KEY', () => parseHostCanonicalJson(Buffer.from('{"a":1,"a":2}')));
  code('KSTACK_HOST_JSON_NONCANONICAL', () => parseHostCanonicalJson(Buffer.from('{"b":1,"a":2}')));
  code('KSTACK_HOST_STRING_NOT_NFC', () => parseHostCanonicalJson(Buffer.from('"é"')));
  code('KSTACK_HOST_STRING_NONCHARACTER', () => parseHostCanonicalJson(Buffer.from('"\ufdd0"')));
  code('KSTACK_HOST_JSON_NUMBER_INVALID', () => parseHostCanonicalJson(Buffer.from('-0')));
  code('KSTACK_HOST_JSON_NUMBER_INVALID', () => parseHostCanonicalJson(Buffer.from('1.0')));
  code('KSTACK_HOST_JSON_UTF8_INVALID', () => parseHostCanonicalJson(Buffer.from([0xff])));
});

test('RFC 8785 uses UTF-16 property order and JSON control escapes', () => {
  assert.equal(hostCanonicalBytes({ '\ue000': 2, '😀': 1 }).toString(), '{"😀":1,"":2}');
  assert.equal(hostCanonicalBytes({ control: '\b' }).toString(), '{"control":"\\b"}');
  assert.deepEqual(parseHostCanonicalJson(Buffer.from('{"control":"\\b"}')), { control: '\b' });
  code('KSTACK_HOST_JSON_NONCANONICAL', () => parseHostCanonicalJson(Buffer.from('{"control":"\\u0008"}')));
});

test('independent Python oracle matches RFC 8785 bytes and domain digests', () => {
  assert.equal(crossRuntimeVectors.schema, 'kstack-host-contract-cross-runtime-vectors-v1');
  for (const vector of crossRuntimeVectors.vectors) {
    const result = spawnSync('python3', [pythonOracle], { input: JSON.stringify({ domain: vector.domain, value: vector.value }), encoding: 'utf8', timeout: 5000, maxBuffer: 65536, shell: false });
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.canonicalHex, vector.canonicalHex);
    assert.equal(hostCanonicalBytes(vector.value).toString('hex'), vector.canonicalHex);
    assert.equal(parsed.objectDigest, vector.objectDigest);
    assert.equal(hostAddress(vector.domain, vector.value), vector.objectDigest);
  }
});

test('lockfile-pinned native Rust oracle matches vectors and rejects hostile JSON', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-host-contract-rust-'));
  try {
    const build = spawnSync('cargo', ['build', '--quiet', '--offline', '--locked', '--manifest-path', rustManifest, '--target-dir', target], {
      encoding: 'utf8', timeout: 120000, maxBuffer: 65536, shell: false
    });
    assert.equal(build.status, 0, build.stderr);
    const binary = path.join(target, 'debug', `kstack-host-contract-reference${process.platform === 'win32' ? '.exe' : ''}`);
    for (const vector of crossRuntimeVectors.vectors) {
      const result = spawnSync(binary, [], { input: JSON.stringify({ domain: vector.domain, value: vector.value }), encoding: 'utf8', timeout: 5000, maxBuffer: 65536, shell: false });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), { canonicalHex: vector.canonicalHex, objectDigest: vector.objectDigest });
    }
    const expanded = buildHostArtifactSchemaSet(vocabulary);
    for (const document of expanded.documents) {
      const value = closedSchemaSample(document.schema);
      const accepted = spawnSync(binary, [], { input: JSON.stringify({ schema: document.schema, value }), encoding: 'utf8', timeout: 5000, maxBuffer: 65536, shell: false });
      assert.equal(accepted.status, 0, `${document.schemaId}: ${accepted.stderr}`);
      assert.deepEqual(JSON.parse(accepted.stdout), { valid: true }, document.schemaId);
      const rejected = spawnSync(binary, [], { input: JSON.stringify({ schema: document.schema, value: { ...value, unexpected: true } }), encoding: 'utf8', timeout: 5000, maxBuffer: 65536, shell: false });
      assert.equal(rejected.status, 0, `${document.schemaId}: ${rejected.stderr}`);
      assert.deepEqual(JSON.parse(rejected.stdout), { valid: false }, document.schemaId);
    }
    const requestSchema = expanded.documents.find((entry) => entry.schemaId === 'kstack.operation-request.v1').schema;
    for (const invalid of [
      request({ operationId: 'delete' }),
      request({ inputs: [request().inputs[0], { ...request().inputs[0], name: 'a' }] })
    ]) {
      const result = spawnSync(binary, [], { input: JSON.stringify({ schema: requestSchema, value: invalid }), encoding: 'utf8', timeout: 5000, maxBuffer: 65536, shell: false });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), { valid: false });
    }
    for (const hostile of [
      '{"domain":"KSTACK-TEST-V1","value":{"a":1,"a":2}}',
      '{"domain":"KSTACK-TEST-V1","value":1.0}',
      '{"domain":"KSTACK-TEST-V1","value":"é"}',
      '{"domain":"KSTACK-TEST-V1","value":9007199254740992}'
    ]) {
      const result = spawnSync(binary, [], { input: hostile, encoding: 'utf8', timeout: 5000, maxBuffer: 65536, shell: false });
      assert.equal(result.status, 2);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, 'INVALID\n');
    }
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('global byte, depth, property, array, and string bounds fail closed', () => {
  code('KSTACK_HOST_DOCUMENT_BYTES_EXCEEDED', () => parseHostCanonicalJson(Buffer.alloc(HOST_CONTRACT_LIMITS.maxDocumentBytes + 1)));
  let nested = null;
  for (let index = 0; index < 33; index += 1) nested = [nested];
  code('KSTACK_HOST_DEPTH_EXCEEDED', () => hostCanonicalBytes(nested));
  code('KSTACK_HOST_OBJECT_PROPERTIES_EXCEEDED', () => hostCanonicalBytes(Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`k${index}`, index]))));
  code('KSTACK_HOST_ARRAY_ITEMS_EXCEEDED', () => hostCanonicalBytes(Array.from({ length: 1025 }, () => null)));
  code('KSTACK_HOST_STRING_BYTES_EXCEEDED', () => hostCanonicalBytes('x'.repeat(16385)));
});

test('collection declarations enforce exact shape, ordering, uniqueness, and tuple encoding', () => {
  assert.deepEqual(validateCollectionDeclaration({ mode: 'ORDERED' }), { mode: 'ORDERED' });
  assertCollectionOrder(['a', 'b'], { mode: 'SET_BY_VALUE_ASCII' });
  code('KSTACK_HOST_COLLECTION_NOT_SORTED', () => assertCollectionOrder(['b', 'a'], { mode: 'SET_BY_VALUE_ASCII' }));
  code('KSTACK_HOST_COLLECTION_DUPLICATE', () => assertCollectionOrder([digest('a'), digest('a')], { mode: 'SET_BY_VALUE_DIGEST' }));
  const tuple = { mode: 'SET_BY_FIELDS', keyFields: ['name', 'version'], keyKinds: ['ASCII', 'ASCII_CANONICAL_UINT'] };
  assertCollectionOrder([{ name: 'a', version: 2 }, { name: 'a', version: 10 }], tuple);
  code('KSTACK_HOST_COLLECTION_NOT_SORTED', () => assertCollectionOrder([{ name: 'a', version: 10 }, { name: 'a', version: 2 }], tuple));
  code('KSTACK_HOST_COLLECTION_INVALID', () => validateCollectionDeclaration({ mode: 'ORDERED', keyFields: [] }));
});

test('domain addressing binds ASCII domain, NUL, and canonical body bytes', () => {
  const body = { a: 1, b: true };
  const expected = `sha256:${crypto.createHash('sha256').update('KSTACK-TEST-V1', 'ascii').update(Buffer.from([0])).update(Buffer.from('{"a":1,"b":true}')).digest('hex')}`;
  assert.equal(hostAddress('KSTACK-TEST-V1', body), expected);
  code('KSTACK_HOST_DOMAIN_INVALID', () => hostAddress('not-a-domain', body));
});

test('exact timestamps reject rollover, offsets, missing milliseconds, and year zero', () => {
  assert.equal(assertTimestamp('2024-02-29T23:59:59.999Z'), '2024-02-29T23:59:59.999Z');
  for (const value of ['2023-02-29T00:00:00.000Z', '0000-01-01T00:00:00.000Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000+00:00']) {
    code('KSTACK_HOST_TIMESTAMP_INVALID', () => assertTimestamp(value));
  }
});

test('registry IDs admit exact stable codes without widening lowercase schema IDs', () => {
  for (const value of ['LOCAL_READ', 'ASK_SIDE_EFFECT', 'KSTACK_HOST_CLASS_MISMATCH', 'read-only']) assert.equal(assertRegistryId(value), value);
  for (const value of ['Local_Read', '_LOCAL_READ', '1LOCAL_READ', 'LOCAL-READ', 'é']) code('KSTACK_HOST_REGISTRY_ID_INVALID', () => assertRegistryId(value));
  code('KSTACK_HOST_ASCII_ID_INVALID', () => assertAsciiId('LOCAL_READ'));
  assert.equal(assertAsciiId('kstack.operation-request.v1'), 'kstack.operation-request.v1');
});

test('operation request validation is closed, vocabulary-bound, ordered, and content-addressed', () => {
  const value = request();
  const validated = validateHostArtifact('OperationRequestV1', value, { vocabulary });
  assert.equal(validated.objectDigest, hostAddress(HOST_ARTIFACT_IDENTITIES.OperationRequestV1.domain, value));
  code('KSTACK_HOST_ADDITIONAL_PROPERTY', () => validateHostArtifact('OperationRequestV1', { ...value, trustMe: true }, { vocabulary }));
  code('KSTACK_HOST_REGISTRY_REFERENCE_INVALID', () => validateHostArtifact('OperationRequestV1', { ...value, operationId: 'delete' }, { vocabulary }));
  code('KSTACK_HOST_INVARIANT_REQUEST_TIME_ORDER_V1', () => validateHostArtifact('OperationRequestV1', request({ expiresAt: value.createdAt }), { vocabulary }));
  code('KSTACK_HOST_COLLECTION_NOT_SORTED', () => validateHostArtifact('OperationRequestV1', request({ inputs: [
    { name: 'z', mediaTypeId: 'application-json', artifactRef: { schemaDigest: digest('1'), objectDigest: digest('2'), byteCount: 1 } },
    { name: 'a', mediaTypeId: 'application-json', artifactRef: { schemaDigest: digest('1'), objectDigest: digest('2'), byteCount: 1 } }
  ] }), { vocabulary }));
});

test('locally decidable invariant matrices reject contradictory operation state', () => {
  const head = (name) => artifactHead(name, digest('f'));
  const result = {
    ...head('OperationResultV1'), requestDigest: digest('a'), operationId: 'inspect', activeSetDigest: digest('b'), status: 'SUCCEEDED',
    startedAt: '2026-08-28T12:00:00.000Z', completedAt: '2026-08-28T12:00:01.000Z', outputs: [], errorDigest: null, receiptProfileDigest: digest('c')
  };
  assert.match(validateHostArtifact('OperationResultV1', result, { vocabulary }).objectDigest, /^sha256:/u);
  code('KSTACK_HOST_INVARIANT_RESULT_SHAPE_V1', () => validateHostArtifact('OperationResultV1', { ...result, status: 'DENIED' }, { vocabulary }));
  code('KSTACK_HOST_INVARIANT_RESULT_SHAPE_V1', () => validateHostArtifact('OperationResultV1', { ...result, completedAt: '2026-08-28T11:59:59.000Z' }, { vocabulary }));

  const receipt = {
    ...head('OperationReceiptV1'), requestDigest: digest('a'), resultDigest: digest('b'), operationId: 'inspect', operationClassId: 'read-only',
    activeSetDigest: digest('c'), producerId: 'local', receiptKind: 'local', producerReceiptDigest: null, localAuditDigest: null, issuedAt: '2026-08-28T12:00:00.000Z'
  };
  code('KSTACK_HOST_INVARIANT_RECEIPT_ACYCLIC_V1', () => validateHostArtifact('OperationReceiptV1', receipt, { vocabulary }));

  const activation = {
    ...head('ActivationRecordV1'), candidateActiveSetDigest: digest('a'), priorActiveSetDigest: null, compatibilityEntryDigest: digest('b'),
    migrationEvidenceDigest: null, rollbackEvidenceDigest: null, state: 'STAGED', reasonCodes: [], createdAt: '2026-08-28T12:00:00.000Z',
    decidedAt: '2026-08-28T12:00:01.000Z'
  };
  code('KSTACK_HOST_INVARIANT_ACTIVATION_SHAPE_V1', () => validateHostArtifact('ActivationRecordV1', activation, { vocabulary }));

  const evidenceSet = {
    ...head('HostEvidenceSetV1'), hostInstanceDigest: digest('a'), activeSetDigest: digest('b'), policyDigest: digest('c'),
    evidenceRefs: [
      { evidenceDigest: digest('1'), schemaDigest: digest('2'), issuedAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-08-28T12:10:00.000Z' },
      { evidenceDigest: digest('3'), schemaDigest: digest('4'), issuedAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-08-28T12:20:00.000Z' }
    ],
    assembledAt: '2026-08-28T12:01:00.000Z', shortestExpiryAt: '2026-08-28T12:10:00.000Z'
  };
  assert.match(validateHostArtifact('HostEvidenceSetV1', evidenceSet, { vocabulary }).objectDigest, /^sha256:/u);
  code('KSTACK_HOST_INVARIANT_EVIDENCE_TIME_V1', () => validateHostArtifact('HostEvidenceSetV1', {
    ...evidenceSet, shortestExpiryAt: '2026-08-28T12:20:00.000Z'
  }, { vocabulary }));

  const offer = {
    ...head('SchemaOfferV1'), hostInstanceDigest: digest('a'), schemaSetDigests: [digest('b')], resolverSetDigests: [digest('c')],
    operationProfileDigests: [], offeredAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-08-28T12:10:00.000Z'
  };
  assert.match(validateHostArtifact('SchemaOfferV1', offer, { vocabulary }).objectDigest, /^sha256:/u);
  // evidence-time-v1 is NOT applicable to kstack.schema-offer.v1 (repair-r2 §4;
  // HOST_INVARIANT_APPLICABLE_SCHEMAS['evidence-time-v1']), so an inverted offer
  // window must be ACCEPTED here rather than rejected. Owner-approved as hp-tc01
  // "Fix B" (r4-independent-review, verdict pass); containment is downstream, in
  // selection-exact-v1, which no selection can satisfy against such an offer.
  assert.match(validateHostArtifact('SchemaOfferV1', {
    ...offer, offeredAt: '2026-08-28T12:10:00.000Z', expiresAt: '2026-08-28T12:00:00.000Z'
  }, { vocabulary }).objectDigest, /^sha256:/u);

  const selection = {
    ...head('SchemaSelectionV1'), offerDigest: digest('a'), selectedSchemaSetDigest: digest('b'), selectedResolverSetDigest: digest('c'),
    selectedOperationProfileDigests: [], compatibilityEntryDigest: digest('d'),
    selectedAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-08-28T12:10:00.000Z'
  };
  assert.match(validateHostArtifact('SchemaSelectionV1', selection, { vocabulary }).objectDigest, /^sha256:/u);
  // Same as the offer above: kstack.schema-selection.v1 is not on
  // evidence-time-v1's attested applicability list, so an inverted selection
  // window must be ACCEPTED by this invariant. r4 recorded the resulting
  // self-window gap as an open design question for the owner, explicitly NOT as
  // something evidence-time-v1 should close.
  assert.match(validateHostArtifact('SchemaSelectionV1', {
    ...selection, selectedAt: '2026-08-28T12:10:00.000Z', expiresAt: '2026-08-28T12:00:00.000Z'
  }, { vocabulary }).objectDigest, /^sha256:/u);
});

test('contextual eligibility proves the exact requirement partition and registered alternate', () => {
  const profile = requirementProfile();
  const profileDigest = validateHostArtifact('OperationRequirementProfileV1', profile, { vocabulary }).objectDigest;
  const store = new Map([[profileDigest, profile]]);
  const eligibility = {
    ...artifactHead('OperationEligibilityV1', digest('f')), operationId: 'inspect', requirementProfileDigest: profileDigest,
    hostEvidenceSetDigest: digest('a'), activeSetDigest: digest('b'), policyDigest: digest('c'), status: 'DEGRADED_REGISTERED',
    alternateProfileId: 'read-safe', provenCapabilityIds: ['file-read'], missingCapabilityIds: ['text-search'], reasonCodes: ['none'],
    evaluatedAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-08-28T12:01:00.000Z'
  };
  const options = { vocabulary, resolveArtifact: (key) => store.get(key) };
  assert.match(validateHostArtifactContext('OperationEligibilityV1', eligibility, options).objectDigest, /^sha256:/u);
  code('KSTACK_HOST_INVARIANT_ELIGIBILITY_PARTITION_V1', () => validateHostArtifactContext('OperationEligibilityV1', {
    ...eligibility, provenCapabilityIds: [], missingCapabilityIds: ['text-search']
  }, options));
  code('KSTACK_HOST_INVARIANT_ELIGIBILITY_PARTITION_V1', () => validateHostArtifactContext('OperationEligibilityV1', {
    ...eligibility, alternateProfileId: 'missing'
  }, { ...options, vocabulary: { ...vocabulary, operationProfileIds: ['missing', 'read-safe'] } }));
});

test('contextual request derives profile and approval nullability from protected active-set rules', () => {
  const profile = requirementProfile();
  const profileDigest = validateHostArtifact('OperationRequirementProfileV1', profile, { vocabulary }).objectDigest;
  const store = new Map([[profileDigest, profile]]);
  const operationRequest = request({ requirementProfileDigest: profileDigest });
  const options = {
    vocabulary,
    resolveArtifact: (key) => store.get(key),
    resolveOperationClassRule: (operationClassId, activeSetDigest) => ({ operationClassId, activeSetDigest, approvalRequired: false })
  };
  assert.match(validateHostArtifactContext('OperationRequestV1', operationRequest, options).objectDigest, /^sha256:/u);
  code('KSTACK_HOST_INVARIANT_REQUEST_AUTHORITY_SHAPE_V1', () => validateHostArtifactContext('OperationRequestV1', {
    ...operationRequest, operationSchemaDigest: digest('9')
  }, options));
  code('KSTACK_HOST_INVARIANT_REQUEST_AUTHORITY_SHAPE_V1', () => validateHostArtifactContext('OperationRequestV1', {
    ...operationRequest, authorityEnvelopeDigest: digest('8')
  }, options));
  code('KSTACK_HOST_INVARIANT_REQUEST_AUTHORITY_SHAPE_V1', () => validateHostArtifactContext('OperationRequestV1', operationRequest, {
    ...options,
    resolveOperationClassRule: (operationClassId) => ({ operationClassId, activeSetDigest: digest('0'), approvalRequired: false })
  }));
});

test('contextual receipt binds the addressed request, result, profile, class, operation, and active set', () => {
  const profile = requirementProfile();
  const profileDigest = validateHostArtifact('OperationRequirementProfileV1', profile, { vocabulary }).objectDigest;
  const operationRequest = request({ requirementProfileDigest: profileDigest });
  const requestDigest = validateHostArtifact('OperationRequestV1', operationRequest, { vocabulary }).objectDigest;
  const result = {
    ...artifactHead('OperationResultV1', digest('f')), requestDigest, operationId: 'inspect', activeSetDigest: operationRequest.activeSetDigest,
    status: 'SUCCEEDED', startedAt: '2026-08-28T12:00:00.000Z', completedAt: '2026-08-28T12:00:01.000Z', outputs: [],
    errorDigest: null, receiptProfileDigest: profile.receiptProfileDigest
  };
  const resultDigest = validateHostArtifact('OperationResultV1', result, { vocabulary }).objectDigest;
  const store = new Map([[profileDigest, profile], [requestDigest, operationRequest], [resultDigest, result]]);
  const receipt = {
    ...artifactHead('OperationReceiptV1', digest('f')), requestDigest, resultDigest, operationId: 'inspect', operationClassId: 'LOCAL_READ',
    activeSetDigest: operationRequest.activeSetDigest, producerId: 'local', receiptKind: 'local', producerReceiptDigest: null,
    localAuditDigest: digest('a'), issuedAt: '2026-08-28T12:00:02.000Z'
  };
  const options = { vocabulary, resolveArtifact: (key) => store.get(key) };
  assert.match(validateHostArtifactContext('OperationReceiptV1', receipt, options).objectDigest, /^sha256:/u);
  code('KSTACK_HOST_INVARIANT_RECEIPT_ACYCLIC_V1', () => validateHostArtifactContext('OperationReceiptV1', {
    ...receipt, operationClassId: 'read-only'
  }, options));
});

function conformanceEvidenceFixture(schemaSetDigest = digest('f')) {
  const body = {
    ...artifactHead('HostConformanceEvidenceBodyV1', schemaSetDigest),
    hostInstanceDigest: digest('1'), hostBuildDigest: digest('2'), adapterDigest: digest('3'), harnessDigest: digest('4'),
    fixtureSetDigest: digest('5'), environmentDigest: digest('6'),
    results: [{ capabilityId: 'file-read', fixtureId: 'basic', outcome: 'PASS', evidenceDigest: digest('7') }],
    issuedAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-08-28T12:10:00.000Z'
  };
  const wrapper = {
    ...artifactHead('HostConformanceEvidenceV1', digest('f')),
    ...Object.fromEntries(Object.keys(body).filter((key) => !['schemaId', 'schemaVersion', 'schemaSetDigest'].includes(key)).map((key) => [key, body[key]])),
    anchorDigest: digest('9')
  };
  return { body, wrapper };
}

test('contextual conformance evidence proves wrapper/body field identity and one schema-set generation', () => {
  const { body, wrapper } = conformanceEvidenceFixture();
  const options = { vocabulary, resolveConformanceEvidenceBody: () => body };
  assert.match(validateHostArtifactContext('HostConformanceEvidenceV1', wrapper, options).objectDigest, /^sha256:/u);

  code('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1', () => validateHostArtifactContext('HostConformanceEvidenceV1', {
    ...wrapper, hostBuildDigest: digest('8')
  }, options));
  code('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1', () => validateHostArtifactContext('HostConformanceEvidenceV1', {
    ...wrapper, results: [{ ...wrapper.results[0], outcome: 'FAIL' }]
  }, options));

  const otherGeneration = conformanceEvidenceFixture(digest('e'));
  code('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1', () => validateHostArtifactContext('HostConformanceEvidenceV1', wrapper, {
    vocabulary, resolveConformanceEvidenceBody: () => otherGeneration.body
  }));
});

test('contextual conformance evidence fails closed on an absent, throwing, or malformed body resolver', () => {
  const { body, wrapper } = conformanceEvidenceFixture();
  code('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1', () => validateHostArtifactContext('HostConformanceEvidenceV1', wrapper, { vocabulary }));
  code('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1', () => validateHostArtifactContext('HostConformanceEvidenceV1', wrapper, {
    vocabulary, resolveConformanceEvidenceBody: true
  }));
  code('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1', () => validateHostArtifactContext('HostConformanceEvidenceV1', wrapper, {
    vocabulary, resolveConformanceEvidenceBody: () => { throw new Error('unavailable'); }
  }));
  for (const malformed of [null, undefined, true, 'body', [], {}, { ...body, anchorDigest: digest('9') }, { ...body, issuedAt: body.expiresAt }]) {
    code('KSTACK_HOST_INVARIANT_EVIDENCE_WRAPPER_V1', () => validateHostArtifactContext('HostConformanceEvidenceV1', wrapper, {
      vocabulary, resolveConformanceEvidenceBody: () => malformed
    }));
  }
});

test('contextual selection proves offer membership, compatibility equality, interval, and resolver pair', () => {
  const closure = historicalFixture();
  const artifact = parseHostCanonicalJson(closure.artifactBytes);
  const schemaSetDigest = artifact.schemaSetDigest;
  const schemaSet = parseHostCanonicalJson(closure.store.get(schemaSetDigest));
  const resolverSetDigest = schemaSet.historicalResolverSetDigest;
  const operationProfileDigest = digest('7');
  const offer = {
    ...artifactHead('SchemaOfferV1', schemaSetDigest), hostInstanceDigest: digest('1'), schemaSetDigests: [schemaSetDigest],
    resolverSetDigests: [resolverSetDigest], operationProfileDigests: [operationProfileDigest],
    offeredAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-08-28T12:10:00.000Z'
  };
  const offerDigest = validateHostArtifact('SchemaOfferV1', offer, { vocabulary }).objectDigest;
  const compatibility = {
    ...artifactHead('CompatibilityEntryV1', schemaSetDigest), compatibilityId: 'base',
    componentBindings: [{ componentRole: 'runtime', componentId: 'native', componentDigest: digest('2') }],
    externalHostConstraintDigest: digest('3'), compatibleHostContractSchemaSetDigest: schemaSetDigest,
    compatibleResolverSetDigest: resolverSetDigest, migrationProfileDigest: null, allowedOperationProfileDigests: [operationProfileDigest]
  };
  const compatibilityDigest = validateHostArtifact('CompatibilityEntryV1', compatibility, { vocabulary }).objectDigest;
  const artifacts = new Map([[offerDigest, offer], [compatibilityDigest, compatibility]]);
  const selection = {
    ...artifactHead('SchemaSelectionV1', schemaSetDigest), offerDigest, selectedSchemaSetDigest: schemaSetDigest,
    selectedResolverSetDigest: resolverSetDigest, selectedOperationProfileDigests: [operationProfileDigest], compatibilityEntryDigest: compatibilityDigest,
    selectedAt: '2026-08-28T12:01:00.000Z', expiresAt: '2026-08-28T12:09:00.000Z'
  };
  const options = {
    vocabulary,
    resolveArtifact: (key) => artifacts.get(key),
    resolveBootstrap: (key) => closure.store.has(key) ? parseHostCanonicalJson(closure.store.get(key)) : null
  };
  assert.match(validateHostArtifactContext('SchemaSelectionV1', selection, options).objectDigest, /^sha256:/u);
  code('KSTACK_HOST_INVARIANT_SELECTION_EXACT_V1', () => validateHostArtifactContext('SchemaSelectionV1', {
    ...selection, expiresAt: '2026-08-28T12:11:00.000Z'
  }, options));
  code('KSTACK_HOST_INVARIANT_SELECTION_EXACT_V1', () => validateHostArtifactContext('SchemaSelectionV1', {
    ...selection, selectedOperationProfileDigests: [digest('8')]
  }, options));
});

test('all seven immutable bootstrap families are present and the metaschema constants are exact', () => {
  assert.equal(Object.keys(HOST_BOOTSTRAP_SCHEMAS).length, 7);
  const permittedKeywords = [
    '$ref', 'additionalProperties', 'const', 'enum', 'items', 'maxItems', 'maxLength', 'maximum', 'minItems', 'minLength',
    'minimum', 'oneOf', 'pattern', 'properties', 'required', 'type', 'x-kstack-collection'
  ];
  const value = {
    schemaId: 'kstack.closed-metaschema.v1', schemaVersion: 1, schemaLanguageVersion: 'kstack-closed-schema-v1', permittedKeywords,
    regexGrammarDigest: digest('a'), collectionGrammarDigest: digest('b'), resourceLimits: {
      maxDocumentBytes: 1048576, maxDepth: 32, maxObjectProperties: 64, maxArrayItems: 1024, maxStringUtf8Bytes: 16384,
      maxSchemas: 256, maxRefEdges: 2048, maxPatternBytes: 256, maxPatternDfaStates: 4096
    }
  };
  assert.match(validateHostBootstrap('KStackClosedMetaschemaV1', value).objectDigest, /^sha256:[0-9a-f]{64}$/u);
  code('KSTACK_HOST_METASCHEMA_KEYWORDS_INVALID', () => validateHostBootstrap('KStackClosedMetaschemaV1', { ...value, permittedKeywords: permittedKeywords.slice(1) }));
  code('KSTACK_HOST_CONST_INVALID', () => validateHostBootstrap('KStackClosedMetaschemaV1', {
    ...value, resourceLimits: { ...value.resourceLimits, maxDepth: 33 }
  }));
});

test('expanded bootstrap schemas are canonical, immutable, digest-pinned, and executable', () => {
  assert.equal(HOST_BOOTSTRAP_SCHEMA_DOCUMENTS.length, 14);
  for (const document of HOST_BOOTSTRAP_SCHEMA_DOCUMENTS) {
    assert.equal(Object.isFrozen(document), true);
    assert.equal(Object.isFrozen(document.schema), true);
    assert.equal(hostCanonicalBytes(document.schema).toString(), document.canonicalJson);
    assert.equal(`sha256:${crypto.createHash('sha256').update(document.canonicalJson).digest('hex')}`, document.schemaDigest);
    assert.equal(HOST_BOOTSTRAP_SCHEMA_DIGESTS[document.schemaId], document.schemaDigest);
  }
  code('KSTACK_HOST_SCHEMA_VALUE_INVALID', () => {
    const compiler = compileClosedSchemaSet(HOST_BOOTSTRAP_SCHEMA_DOCUMENTS.map((entry) => ({ schemaId: entry.schemaId, schema: entry.schema })));
    compiler.validate('kstack.bootstrap.canonicalization-profile.v1', { schemaId: 'wrong' });
  });
});

test('closed schema compilation rejects an object declaration without explicit properties', () => {
  code('KSTACK_HOST_SCHEMA_PROPERTIES_INVALID', () => compileClosedSchemaSet([{ schemaId: 'bare-object', schema: { type: 'object' } }]));
});

test('artifact schema expansion pins exact leaf bytes to a closed vocabulary', () => {
  const expanded = buildHostArtifactSchemaSet(vocabulary);
  assert.equal(expanded.documents.length, 17);
  const requestSchema = expanded.documents.find((entry) => entry.schemaId === 'kstack.operation-request.v1');
  assert.ok(requestSchema);
  assert.equal(expanded.schemaDigests[requestSchema.schemaId], requestSchema.schemaDigest);
  assert.deepEqual(expanded.validate(requestSchema.schemaId, request()), request());
  code('KSTACK_HOST_SCHEMA_VALUE_INVALID', () => expanded.validate(requestSchema.schemaId, request({ operationId: 'delete' })));
  const changed = buildHostArtifactSchemaSet({ ...vocabulary, operationIds: ['inspect', 'search'] });
  assert.notEqual(changed.schemaDigests[requestSchema.schemaId], expanded.schemaDigests[requestSchema.schemaId]);
});

test('canonical constructor creates the complete self-addressed 17-leaf closure', () => {
  const keywords = ['$ref', 'additionalProperties', 'const', 'enum', 'items', 'maxItems', 'maxLength', 'maximum', 'minItems', 'minLength', 'minimum', 'oneOf', 'pattern', 'properties', 'required', 'type', 'x-kstack-collection'];
  const metaschema = {
    schemaId: 'kstack.closed-metaschema.v1', schemaVersion: 1, schemaLanguageVersion: 'kstack-closed-schema-v1', permittedKeywords: keywords,
    regexGrammarDigest: digest('a'), collectionGrammarDigest: digest('b'), resourceLimits: {
      maxDocumentBytes: 1048576, maxDepth: 32, maxObjectProperties: 64, maxArrayItems: 1024, maxStringUtf8Bytes: 16384,
      maxSchemas: 256, maxRefEdges: 2048, maxPatternBytes: 256, maxPatternDfaStates: 4096
    }
  };
  const canonicalizationProfile = {
    schemaId: 'kstack.canonicalization-profile.v1', schemaVersion: 1, profileId: 'rfc8785-kstack-v1', rfc8785SpecDigest: digest('c'),
    unicodePolicy: 'VALID_SCALAR_NFC_REJECT_OTHER', numberPolicy: 'SAFE_INTEGER_CANONICAL_ONLY', timestampPolicy: 'UTC_MILLISECOND_YEAR0001_9999',
    duplicateKeyPolicy: 'REJECT_BEFORE_PARSE', collectionGrammarDigest: digest('b'), regexGrammarDigest: digest('a')
  };
  const collectionNames = {
    mediaTypes: 'media-types', operationIds: 'operation-ids', operationClassIds: 'operation-class-ids', capabilityIds: 'capability-ids',
    fixtureIds: 'fixture-ids', reasonCodes: 'reason-codes', errorCodes: 'error-codes', operationProfileIds: 'operation-profile-ids',
    componentRoles: 'component-roles', receiptKinds: 'receipt-kinds', quarantineSubjectTypes: 'quarantine-subject-types'
  };
  const tupleSort = (left, right) => left.length - right.length || Buffer.compare(Buffer.from(left), Buffer.from(right));
  const collections = Object.entries(collectionNames).map(([name, collectionId]) => ({
    collectionId,
    entries: [...vocabulary[name]].sort(tupleSort).map((id) => ({ id }))
  })).sort((left, right) => tupleSort(left.collectionId, right.collectionId));
  const vocabularyRegistry = { schemaId: 'kstack.closed-vocabulary-registry.v1', schemaVersion: 1, registryId: 'base', collections };
  const invariantRegistry = {
    schemaId: 'kstack.invariant-registry.v1', schemaVersion: 1, registryId: 'base', entries: REQUIRED_INVARIANT_IDS.map((invariantId) => ({
      invariantId, implementationDigest: HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
      applicableSchemaIds: HOST_INVARIANT_APPLICABLE_SCHEMAS[invariantId], vectorIds: ['basic']
    }))
  };
  const vectorSet = {
    schemaId: 'kstack.cross-runtime-vector-set.v1', schemaVersion: 1, vectorSetId: 'base', entries: [{
      vectorId: 'basic', operationId: 'inspect', inputBytesDigest: digest('d'), expectedOutcome: 'ACCEPT',
      expectedCanonicalBytesDigest: null, expectedObjectDigest: null
    }]
  };
  const metaschemaDigest = validateHostBootstrap('KStackClosedMetaschemaV1', metaschema).objectDigest;
  const profileDigest = validateHostBootstrap('CanonicalizationProfileV1', canonicalizationProfile).objectDigest;
  const invariantDigest = validateHostBootstrap('InvariantRegistryV1', invariantRegistry).objectDigest;
  const vectorDigest = validateHostBootstrap('CrossRuntimeVectorSetV1', vectorSet).objectDigest;
  const resolverImplementationDigest = digest('e');
  const resolverSet = {
    schemaId: 'kstack.historical-resolver-set.v1', schemaVersion: 1, resolverSetId: 'base', entries: [{
      resolverId: 'builtin', schemaLanguageVersion: 'kstack-closed-schema-v1', implementationDigest: resolverImplementationDigest,
      supportedMetaschemaDigests: [metaschemaDigest], supportedCanonicalizationProfileDigests: [profileDigest],
      invariantRegistryDigests: [invariantDigest], vectorSetDigest: vectorDigest
    }]
  };
  const closure = constructHostContractClosure({ metaschema, canonicalizationProfile, vocabularyRegistry, invariantRegistry, resolverSet, vectorSet });
  assert.equal(closure.schemaSet.schemaEntries.length, 17);
  assert.equal(closure.objectCount, 24);
  assert.deepEqual(parseHostCanonicalJson(closure.getObject(closure.schemaSetDigest)), closure.schemaSet);
  const commonOptions = {
    getObject: closure.getObject,
    installedResolverDigests: [resolverImplementationDigest], installedInvariantDigests: Object.values(HOST_INVARIANT_IMPLEMENTATION_DIGESTS),
    passingVectorIds: ['basic']
  };
  const operationResult = {
    ...artifactHead('OperationResultV1', closure.schemaSetDigest), requestDigest: digest('1'), operationId: 'inspect', activeSetDigest: digest('2'),
    status: 'SUCCEEDED', startedAt: '2026-08-28T12:00:00.000Z', completedAt: '2026-08-28T12:00:01.000Z', outputs: [],
    errorDigest: null, receiptProfileDigest: digest('3')
  };
  const result = resolveHistoricalArtifact(hostCanonicalBytes(operationResult), {
    ...commonOptions, expectedSchemaDigest: closure.schemaDigests['kstack.operation-result.v1']
  });
  assert.equal(result.outcome, 'VALID');
  assert.equal(resolveHistoricalArtifact(hostCanonicalBytes({
    ...operationResult, completedAt: '2026-08-28T11:59:59.000Z'
  }), { ...commonOptions, expectedSchemaDigest: closure.schemaDigests['kstack.operation-result.v1'] }).outcome, 'INVALID');

  const operationProfile = requirementProfile(closure.schemaSetDigest);
  const operationProfileDigest = validateHostArtifact('OperationRequirementProfileV1', operationProfile, { vocabulary }).objectDigest;
  const operationProfileBytes = hostCanonicalBytes(operationProfile);
  const getObject = (key) => key === operationProfileDigest ? operationProfileBytes : closure.getObject(key);
  const operationRequest = request({ schemaSetDigest: closure.schemaSetDigest, requirementProfileDigest: operationProfileDigest });
  const requestOptions = {
    ...commonOptions, getObject, expectedSchemaDigest: closure.schemaDigests['kstack.operation-request.v1'],
    resolveOperationClassRule: (operationClassId, activeSetDigest) => ({ operationClassId, activeSetDigest, approvalRequired: false })
  };
  assert.equal(resolveHistoricalArtifact(hostCanonicalBytes(operationRequest), requestOptions).outcome, 'VALID');
  assert.equal(resolveHistoricalArtifact(hostCanonicalBytes({ ...operationRequest, operationSchemaDigest: digest('9') }), requestOptions).outcome, 'INVALID');
});

test('closed vocabulary registry produces the exact collections used by artifact validation', () => {
  const registry = {
    schemaId: 'kstack.closed-vocabulary-registry.v1', schemaVersion: 1, registryId: 'base',
    collections: [{ collectionId: 'media-types', entries: [{ id: 'application-json' }] }]
  };
  const converted = vocabularyFromRegistry(registry);
  assert.deepEqual(converted, { 'media-types': ['application-json'] });
  const reduced = { ...vocabulary, mediaTypes: undefined, 'media-types': converted['media-types'] };
  delete reduced.mediaTypes;
  assert.match(validateHostArtifact('OperationRequestV1', request(), { vocabulary: reduced }).objectDigest, /^sha256:/u);
});

test('invariant registry is complete and schema-set artifact domains are globally unique', () => {
  const entries = REQUIRED_INVARIANT_IDS.map((invariantId) => ({
    invariantId, implementationDigest: HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
    applicableSchemaIds: HOST_INVARIANT_APPLICABLE_SCHEMAS[invariantId], vectorIds: ['basic']
  }));
  const invariantRegistry = { schemaId: 'kstack.invariant-registry.v1', schemaVersion: 1, registryId: 'base', entries };
  assert.match(validateHostBootstrap('InvariantRegistryV1', invariantRegistry).objectDigest, /^sha256:/u);
  code('KSTACK_HOST_INVARIANT_REGISTRY_INCOMPLETE', () => validateHostBootstrap('InvariantRegistryV1', { ...invariantRegistry, entries: entries.slice(1) }));
  code('KSTACK_HOST_INVARIANT_IMPLEMENTATION_MISMATCH', () => validateHostBootstrap('InvariantRegistryV1', {
    ...invariantRegistry, entries: entries.map((entry, index) => index === 0 ? { ...entry, implementationDigest: digest('0') } : entry)
  }));
  code('KSTACK_HOST_INVARIANT_APPLICABILITY_MISMATCH', () => validateHostBootstrap('InvariantRegistryV1', {
    ...invariantRegistry, entries: entries.map((entry, index) => index === 0 ? { ...entry, applicableSchemaIds: ['kstack.operation-error.v1'] } : entry)
  }));

  const schemaSet = {
    schemaId: 'kstack.host-contract-schema-set.v1', schemaVersion: 1, metaschemaDigest: digest('a'),
    schemaLanguageVersion: 'kstack-closed-schema-v1', canonicalizationProfileDigest: digest('b'),
    schemaEntries: [
      { schemaId: 'one', schemaVersion: 1, schemaDigest: digest('c'), artifactDomain: 'KSTACK-SAME-V1' },
      { schemaId: 'two', schemaVersion: 1, schemaDigest: digest('d'), artifactDomain: 'KSTACK-SAME-V1' }
    ],
    closedVocabularyRegistryDigest: digest('e'), invariantRegistryDigest: digest('f'), historicalResolverSetDigest: digest('1'), crossRuntimeVectorSetDigest: digest('2')
  };
  code('KSTACK_HOST_ARTIFACT_DOMAIN_DUPLICATE', () => validateHostBootstrap('HostContractSchemaSetV1', schemaSet));
});

test('closed-schema compiler validates exact objects, references, patterns, oneOf, and set order', () => {
  const compiled = compileClosedSchemaSet([
    { schemaId: 'ascii', schema: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-z0-9][a-z0-9._-]{0,127}$' } },
    { schemaId: 'item', schema: {
      type: 'object',
      properties: {
        id: { $ref: 'ascii' },
        note: { oneOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 8 }] },
        tags: { type: 'array', items: { $ref: 'ascii' }, minItems: 0, maxItems: 4, 'x-kstack-collection': { mode: 'SET_BY_VALUE_ASCII' } }
      },
      required: ['id', 'note', 'tags'], additionalProperties: false
    } }
  ]);
  assert.deepEqual(compiled.schemaIds, ['ascii', 'item']);
  assert.deepEqual(compiled.validate('item', { id: 'one', note: null, tags: ['a', 'b'] }), { id: 'one', note: null, tags: ['a', 'b'] });
  code('KSTACK_HOST_SCHEMA_VALUE_INVALID', () => compiled.validate('item', { id: 'ONE', note: null, tags: [] }));
  code('KSTACK_HOST_SCHEMA_VALUE_INVALID', () => compiled.validate('item', { id: 'one', note: null, tags: [], extra: true }));
  code('KSTACK_HOST_COLLECTION_NOT_SORTED', () => compiled.validate('item', { id: 'one', note: null, tags: ['b', 'a'] }));
});

test('closed-schema compiler rejects remote refs, cycles, open records, and regex extensions', () => {
  code('KSTACK_HOST_ASCII_ID_INVALID', () => compileClosedSchemaSet([{ schemaId: 'one', schema: { $ref: 'https://invalid/schema' } }]));
  code('KSTACK_HOST_SCHEMA_REF_CYCLE', () => compileClosedSchemaSet([
    { schemaId: 'one', schema: { $ref: 'two' } }, { schemaId: 'two', schema: { $ref: 'one' } }
  ]));
  code('KSTACK_HOST_SCHEMA_NOT_CLOSED', () => compileClosedSchemaSet([{ schemaId: 'one', schema: {
    type: 'object', properties: { id: { type: 'integer' } }, required: ['id'], additionalProperties: true
  } }]));
  code('KSTACK_HOST_PATTERN_INVALID', () => compileClosedSchemaSet([{ schemaId: 'one', schema: { type: 'string', pattern: '^(a+)+$' } }]));
  code('KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT', () => compileClosedSchemaSet([{ schemaId: 'one', schema: { type: 'string', pattern: '^a{4096}$' } }]));
  code('KSTACK_HOST_COLLECTION_MEMBER_SCHEMA_INVALID', () => compileClosedSchemaSet([{ schemaId: 'one', schema: {
    type: 'array', items: { type: 'integer' }, 'x-kstack-collection': { mode: 'SET_BY_VALUE_ASCII' }
  } }]));
  code('KSTACK_HOST_COLLECTION_KEY_SCHEMA_INVALID', () => compileClosedSchemaSet([{ schemaId: 'one', schema: {
    type: 'array', items: {
      type: 'object', properties: { id: { oneOf: [{ type: 'null' }, { type: 'string' }] } }, required: ['id'], additionalProperties: false
    }, 'x-kstack-collection': { mode: 'SET_BY_FIELDS', keyFields: ['id'], keyKinds: ['ASCII'] }
  } }]));
});

test('closed pattern evaluation stays linear on catastrophic backtracking constructions', { timeout: 10_000 }, () => {
  for (const [pattern, prefix] of [[`^${'a{0,40}'.repeat(30)}$`, 'a'.repeat(16)], [`^${'[ab]*'.repeat(50)}$`, 'ab'.repeat(18)]]) {
    assert.ok(Buffer.byteLength(pattern, 'ascii') <= HOST_CONTRACT_LIMITS.maxPatternBytes, pattern);
    const started = process.hrtime.bigint();
    const matches = patternProbe(pattern);
    assert.equal(matches(prefix), true, pattern);
    assert.equal(matches(`${prefix}z`), false, pattern);
    assert.equal(matches('a'.repeat(HOST_CONTRACT_LIMITS.maxStringUtf8Bytes - 1) + 'z'), false, pattern);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(elapsedMs < 2000, `${pattern} evaluated in ${elapsedMs.toFixed(1)}ms`);
  }
});

test('closed pattern compilation enforces the real subset-construction state bound', () => {
  const explosive = '^[ab]*a[ab]{20}$';
  assert.ok(Buffer.byteLength(explosive, 'ascii') <= HOST_CONTRACT_LIMITS.maxPatternBytes);
  code('KSTACK_HOST_PATTERN_DFA_LIMIT', () => compileClosedSchemaSet([{ schemaId: 'one', schema: { type: 'string', pattern: explosive } }]));
  const unambiguous = patternProbe('^a[ab]{20}[ab]*$');
  assert.equal(unambiguous(`a${'b'.repeat(20)}`), true);
  assert.equal(unambiguous(`a${'b'.repeat(19)}`), false);
  const nearCap = patternProbe('^[a-z]{0,4000}$');
  assert.equal(nearCap('x'.repeat(4000)), true);
  assert.equal(nearCap('x'.repeat(4001)), false);
  const atCap = patternProbe('^a{4095}$');
  assert.equal(atCap('a'.repeat(4095)), true);
  assert.equal(atCap('a'.repeat(4094)), false);
});

test('built-in closed schema patterns accept exact values and reject near misses', () => {
  const cases = [
    ['^sha256:[0-9a-f]{64}$', [digest('a'), `sha256:${'0'.repeat(64)}`],
      [`sha256:${'g'.repeat(64)}`, `sha256:${'a'.repeat(63)}`, `sha256:${'a'.repeat(65)}`, `sha256:${'A'.repeat(64)}`, `SHA256:${'a'.repeat(64)}`]],
    ['^[a-z0-9][a-z0-9._-]{0,127}$', ['a', '9', 'a9', `a${'b.-_'.repeat(31)}b`],
      ['', 'A', '_a', '.a', 'a b', `a${'b'.repeat(128)}`]],
    ['^[A-Z][A-Z0-9_]{0,127}$', ['K', 'KSTACK_HOST_DENIED', `K${'A9_'.repeat(42)}`],
      ['', 'k', '9K', 'K-9', 'K a', `K${'A'.repeat(128)}`]],
    ['^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$', ['2026-08-28T12:00:00.000Z'],
      ['2026-08-28T12:00:00.00Z', '2026-08-28T12:00:00.0000Z', '2026-08-28T12:00:00X000Z', '2026-08-28T12:00:00.000z', '2026-08-28T12:00:00.000Z ']],
    ['^KSTACK-[A-Z0-9-]+-V[0-9]+$', ['KSTACK-CLOSED-METASCHEMA-V1', 'KSTACK-A-B-V12', 'KSTACK-HOST-CONTRACT-SCHEMA-SET-V1'],
      ['kstack-a-v1', 'KSTACK--V1', 'KSTACK-A-V', 'KSTACK-A-V1x', 'XSTACK-A-V1']]
  ];
  for (const [pattern, accepted, rejected] of cases) {
    const matches = patternProbe(pattern);
    for (const value of accepted) assert.equal(matches(value), true, `${pattern} must accept ${JSON.stringify(value)}`);
    for (const value of rejected) assert.equal(matches(value), false, `${pattern} must reject ${JSON.stringify(value)}`);
  }
});

test('closed pattern grammar admits only the frozen concatenation subset', () => {
  for (const pattern of ['^(a+)+$', '^a|b$', '^a{2,}$', '^[]$', '^[^ab]$', '^[z-a]$', '^[a--]$', '^a{3,2}$', `^a{${'9'.repeat(40)}}$`, '^\\d$', '^a$b$', '^a(?=b)$']) {
    code('KSTACK_HOST_PATTERN_INVALID', () => compileClosedSchemaSet([{ schemaId: 'one', schema: { type: 'string', pattern } }]));
  }
  const empty = patternProbe('^$');
  assert.deepEqual([empty(''), empty('a')], [true, false]);
  const zero = patternProbe('^a{0}b$');
  assert.deepEqual([zero('b'), zero('ab')], [true, false]);
  const padded = patternProbe('^a{007}$');
  assert.deepEqual([padded('a'.repeat(7)), padded('a'.repeat(6))], [true, false]);
  const literalDot = patternProbe('^.$');
  assert.deepEqual([literalDot('.'), literalDot('x')], [true, false]);
  const trailingDash = patternProbe('^[a-]$');
  assert.deepEqual([trailingDash('a'), trailingDash('-'), trailingDash('b')], [true, true, false]);
  const leadingDash = patternProbe('^[-a]$');
  assert.deepEqual([leadingDash('a'), leadingDash('-'), leadingDash('b')], [true, true, false]);
  const dashRange = patternProbe('^[--a]$');
  assert.deepEqual([dashRange('-'), dashRange('A'), dashRange('a'), dashRange('')], [true, true, true, false]);
  const lower = patternProbe('^[a-z]+$');
  assert.deepEqual([lower('abc'), lower('abé'), lower('ab\u{1f600}'), lower('')], [true, false, false, false]);
});

test('historical resolution validates an exact offline closure and returns its domain address', () => {
  const fixture = historicalFixture();
  const result = resolveHistoricalArtifact(fixture.artifactBytes, fixture.options);
  assert.equal(result.outcome, 'VALID');
  assert.equal(result.schemaDigest, fixture.leafDigest);
  assert.match(result.artifactDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(result.resolverImplementationDigest, fixture.resolverImplementationDigest);

  const artifact = parseHostCanonicalJson(fixture.artifactBytes);
  const schemaSet = parseHostCanonicalJson(fixture.store.get(artifact.schemaSetDigest));
  const incompleteSchemaSet = { ...schemaSet, schemaEntries: schemaSet.schemaEntries.filter((entry) => entry.schemaId !== 'kstack.operation-request.v1') };
  const incompleteValidation = validateHostBootstrap('HostContractSchemaSetV1', incompleteSchemaSet);
  const incompleteStore = new Map(fixture.store);
  incompleteStore.set(incompleteValidation.objectDigest, incompleteValidation.canonicalBytes);
  const incompleteArtifact = { ...artifact, schemaSetDigest: incompleteValidation.objectDigest };
  const incomplete = resolveHistoricalArtifact(hostCanonicalBytes(incompleteArtifact), {
    ...fixture.options, getObject: (key) => incompleteStore.get(key)
  });
  assert.deepEqual({ outcome: incomplete.outcome, reasonCode: incomplete.reasonCode }, {
    outcome: 'INVALID', reasonCode: 'KSTACK_HOST_INVARIANT_APPLICABILITY_CLOSURE_INVALID'
  });
});

test('historical resolution distinguishes malformed artifacts from unavailable closure or implementations', () => {
  const fixture = historicalFixture();
  assert.equal(resolveHistoricalArtifact(Buffer.from('{"schemaId":"demo"}'), fixture.options).outcome, 'INVALID');
  assert.equal(resolveHistoricalArtifact(fixture.artifactBytes, { ...fixture.options, expectedSchemaDigest: digest('0') }).outcome, 'INVALID');
  assert.equal(resolveHistoricalArtifact(fixture.artifactBytes, { ...fixture.options, installedResolverDigests: [] }).outcome, 'UNAVAILABLE');
  const missing = new Map(fixture.store);
  missing.delete(fixture.leafDigest);
  assert.equal(resolveHistoricalArtifact(fixture.artifactBytes, { ...fixture.options, getObject: (key) => missing.get(key) }).outcome, 'UNAVAILABLE');
});

const hostContractSource = () => fs.readFileSync(hostContractModule, 'utf8');

async function withMutatedHostContract(source, run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-host-contract-'));
  try {
    const mutatedPath = path.join(directory, 'kstack-host-contract.mjs');
    fs.writeFileSync(mutatedPath, source, 'utf8');
    return await run(mutatedPath);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function replaceUnique(source, original, mutation, label) {
  assert.equal(source.split(original).length - 1, 1, `${label}: anchor text must occur exactly once`);
  return source.replace(original, mutation);
}

// Every registered digest now mixes in HOST_MODULE_SOURCE_DIGEST, so ANY edit to
// the module moves all eleven and no registered digest attributes a change to a
// particular invariant any more. That attribution was real information, so it is
// kept here, computed test-side and DOCUMENTARY ONLY: the per-invariant source of
// the functions HOST_INVARIANT_IMPLEMENTATIONS names for each ID. It attests to
// nothing and no security property rests on it — it is what lets the tests below
// still say "this edit touched request-time-order-v1's implementation and no
// other invariant's", which a whole-file hash cannot express.
function documentedClosureSources(implementations) {
  return Object.fromEntries(Object.entries(implementations).map(([invariantId, closure]) => [
    invariantId,
    closure.map((implementation) => crypto.createHash('sha256')
      .update(implementation.toString().replace(/\r\n/gu, '\n'), 'utf8').digest('hex')).join(' ')
  ]));
}

// Assert the registered digests behave as the whole-module digest requires: an
// edit anywhere in the module moves every one of the eleven.
function assertEveryDigestMoved(mutated, label) {
  for (const invariantId of REQUIRED_INVARIANT_IDS) {
    assert.notEqual(
      mutated.HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
      HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
      `${label}: ${invariantId} must move — every edit to the module re-attests all eleven`
    );
  }
}

// One uniquely-attributed source anchor per registered invariant ID. Each anchor
// lives inside a function that appears in exactly one entry of
// HOST_INVARIANT_IMPLEMENTATIONS, so mutating it must change exactly one entry's
// DOCUMENTED closure source (and, since the whole module is hashed, all eleven
// registered digests).
const INVARIANT_MUTATION_ANCHORS = Object.freeze({
  'request-time-order-v1': "if (value.createdAt >= value.expiresAt) fail('KSTACK_HOST_INVARIANT_REQUEST_TIME_ORDER_V1');",
  'request-authority-shape-v1': 'const rule = options.resolveOperationClassRule(profile.operationClassId, value.activeSetDigest);',
  'result-shape-v1': "if (value.startedAt > value.completedAt) fail('KSTACK_HOST_INVARIANT_RESULT_SHAPE_V1');",
  'observation-shape-v1': "fail('KSTACK_HOST_INVARIANT_OBSERVATION_SHAPE_V1');",
  'evidence-time-v1': "if (name === 'HostObservationV1' && value.observedAt >= value.expiresAt)",
  'host-conformance-evidence-wrapper-v1': 'for (const field of CONFORMANCE_EVIDENCE_SHARED_FIELDS) projection[field] = value[field];',
  'eligibility-partition-v1': 'const proven = new Set(value.provenCapabilityIds);',
  'receipt-acyclic-v1': 'if (value.producerReceiptDigest === null && value.localAuditDigest === null)',
  'activation-shape-v1': "fail('KSTACK_HOST_INVARIANT_ACTIVATION_SHAPE_V1');",
  'selection-exact-v1': "const compatibility = resolveBoundArtifact(options, value.compatibilityEntryDigest, 'CompatibilityEntryV1', vocabulary, value.schemaSetDigest);",
  'resolver-pair-v1': "if (candidates.length !== 1) fail('KSTACK_HOST_RESOLVER_PAIR_INVALID');"
});

test('invariant implementation digests track the installed behavior of each invariant', async () => {
  assert.equal(new Set(Object.values(HOST_INVARIANT_IMPLEMENTATION_DIGESTS)).size, REQUIRED_INVARIANT_IDS.length);
  assert.deepEqual(Object.keys(INVARIANT_MUTATION_ANCHORS).sort(), [...REQUIRED_INVARIANT_IDS].sort());

  const source = hostContractSource();
  const liveClosures = documentedClosureSources(HOST_INVARIANT_IMPLEMENTATIONS);
  for (const [invariantId, anchor] of Object.entries(INVARIANT_MUTATION_ANCHORS)) {
    const mutatedSource = replaceUnique(source, anchor, `${anchor} /* kstack-mutation-${invariantId} */`, invariantId);
    await withMutatedHostContract(mutatedSource, async (mutatedPath) => {
      const mutated = await import(pathToFileURL(mutatedPath).href);
      // The attested property: an edit to this invariant's implementation
      // re-attests every registered digest.
      assertEveryDigestMoved(mutated, invariantId);

      // The documentary property, which the registered digests no longer carry:
      // the edit landed inside exactly this invariant's declared closure.
      const mutatedClosures = documentedClosureSources(mutated.HOST_INVARIANT_IMPLEMENTATIONS);
      assert.notEqual(mutatedClosures[invariantId], liveClosures[invariantId],
        `${invariantId}: the anchor must sit inside its own documented closure`);
      for (const other of REQUIRED_INVARIANT_IDS) {
        if (other === invariantId) continue;
        assert.equal(mutatedClosures[other], liveClosures[other],
          `${invariantId}: must not change ${other}'s documented closure`);
      }
    });
  }
});

test('mutating one invariant predicate re-attests every digest and changes its observable behavior', async () => {
  const original = "if (value.createdAt >= value.expiresAt) fail('KSTACK_HOST_INVARIANT_REQUEST_TIME_ORDER_V1');";
  const mutation = "if (value.createdAt > value.expiresAt) fail('KSTACK_HOST_INVARIANT_REQUEST_TIME_ORDER_V1');";
  const mutatedSource = replaceUnique(hostContractSource(), original, mutation, 'request-time-order-v1');

  await withMutatedHostContract(mutatedSource, async (mutatedPath) => {
    const mutated = await import(pathToFileURL(mutatedPath).href);
    assertEveryDigestMoved(mutated, 'request-time-order-v1 predicate');
    const mutatedClosures = documentedClosureSources(mutated.HOST_INVARIANT_IMPLEMENTATIONS);
    const liveClosures = documentedClosureSources(HOST_INVARIANT_IMPLEMENTATIONS);
    assert.notEqual(mutatedClosures['request-time-order-v1'], liveClosures['request-time-order-v1']);
    for (const invariantId of REQUIRED_INVARIANT_IDS) {
      if (invariantId === 'request-time-order-v1') continue;
      assert.equal(mutatedClosures[invariantId], liveClosures[invariantId], invariantId);
    }

    const boundaryRequest = request({ expiresAt: request().createdAt });
    code('KSTACK_HOST_INVARIANT_REQUEST_TIME_ORDER_V1', () => validateHostArtifact('OperationRequestV1', boundaryRequest, { vocabulary }));
    assert.match(mutated.validateHostArtifact('OperationRequestV1', boundaryRequest, { vocabulary }).objectDigest, /^sha256:/u);
  });
});

test('disabling an invariant dispatch moves that invariant digest instead of passing unnoticed', async () => {
  const source = hostContractSource();
  const lease = {
    ...artifactHead('OperationLeaseV1', digest('f')), requestDigest: digest('a'), operationId: 'inspect', activeSetDigest: digest('b'),
    policyDigest: digest('c'), hostEvidenceSetDigest: digest('d'), repositoryContextDigest: digest('e'), admissionEpoch: 1,
    issuedAt: '2026-08-28T12:10:00.000Z', expiresAt: '2026-08-28T12:00:00.000Z', state: 'ADMITTED'
  };
  code('KSTACK_HOST_INVARIANT_EVIDENCE_TIME_V1', () => validateHostArtifact('OperationLeaseV1', lease, { vocabulary }));

  // Probe 1: neuter the structural dispatch guard for evidence-time-v1. This is
  // the review probe that previously disabled the invariant with 0 of 11
  // digests changed.
  const neutered = replaceUnique(
    source, 'function dispatchEvidenceTimeV1(name, value) {\n  checkEvidenceTimeV1(name, value);\n}',
    'function dispatchEvidenceTimeV1(name, value) {\n  if (name === undefined) checkEvidenceTimeV1(name, value);\n}',
    'evidence-time-v1 dispatch'
  );
  await withMutatedHostContract(neutered, async (mutatedPath) => {
    const mutated = await import(pathToFileURL(mutatedPath).href);
    assert.match(mutated.validateHostArtifact('OperationLeaseV1', lease, { vocabulary }).objectDigest, /^sha256:/u);
    assertEveryDigestMoved(mutated, 'disabled evidence-time dispatch');
    // Documentary: the edit landed inside evidence-time-v1's declared closure.
    const closures = documentedClosureSources(mutated.HOST_INVARIANT_IMPLEMENTATIONS);
    const live = documentedClosureSources(HOST_INVARIANT_IMPLEMENTATIONS);
    assert.notEqual(closures['evidence-time-v1'], live['evidence-time-v1']);
  });

  // Probe 2: neuter the contextual dispatch guard for eligibility-partition-v1.
  const contextual = replaceUnique(
    source, "function dispatchEligibilityPartitionContextV1(name, value, options, vocabulary) {\n  if (name !== 'OperationEligibilityV1') return false;",
    "function dispatchEligibilityPartitionContextV1(name, value, options, vocabulary) {\n  if (name !== 'OperationEligibilityV1') return false;\n  if (name === 'OperationEligibilityV1') return true;",
    'eligibility-partition-v1 contextual dispatch'
  );
  await withMutatedHostContract(contextual, async (mutatedPath) => {
    const mutated = await import(pathToFileURL(mutatedPath).href);
    assertEveryDigestMoved(mutated, 'disabled contextual dispatch');
    const closures = documentedClosureSources(mutated.HOST_INVARIANT_IMPLEMENTATIONS);
    const live = documentedClosureSources(HOST_INVARIANT_IMPLEMENTATIONS);
    assert.notEqual(closures['eligibility-partition-v1'], live['eligibility-partition-v1']);
  });

  // Probe 3: deleting a dispatch-table row must fail closed at module load
  // rather than leave an attested invariant undispatched. The anchor is scoped
  // to the LIVE table by its header: CANONICAL_STRUCTURAL_DISPATCH declares the
  // identical row text, and this probe must delete the row that actually
  // dispatches, not the binding it is checked against.
  const structuralTableHead = "const STRUCTURAL_INVARIANT_DISPATCH = Object.freeze({\n"
    + "  'request-time-order-v1': dispatchRequestTimeOrderV1,\n"
    + "  'result-shape-v1': dispatchResultShapeV1,\n"
    + "  'observation-shape-v1': dispatchObservationShapeV1,\n";
  const deleted = replaceUnique(
    source, `${structuralTableHead}  'evidence-time-v1': dispatchEvidenceTimeV1,\n`, structuralTableHead,
    'evidence-time-v1 dispatch table row'
  );
  await withMutatedHostContract(deleted, async (mutatedPath) => {
    await assert.rejects(() => import(pathToFileURL(mutatedPath).href), /not a function/u);
  });

  // Probe 4: ADDING a dispatch-table row is the mirror image of probe 3 and
  // moves no digest whatsoever, so it must also fail closed at module load. This
  // is the reviewer's exact probe: one extra contextual row makes every artifact
  // name "applicable" and turns the
  // KSTACK_HOST_INVARIANT_CONTEXT_NOT_APPLICABLE rejection into an acceptance.
  const added = replaceUnique(
    source, 'const CONTEXTUAL_INVARIANT_DISPATCH = Object.freeze({\n',
    "const CONTEXTUAL_INVARIANT_DISPATCH = Object.freeze({\n  'x-extra': () => true,\n",
    'contextual dispatch-table row addition'
  );
  await withMutatedHostContract(added, async (mutatedPath) => {
    await assert.rejects(() => import(pathToFileURL(mutatedPath).href), /unattested dispatch-table row/u);
  });

  // Probe 5: the same hole reached with a REGISTERED invariant id instead of a
  // novel one. The combined key set still equals REQUIRED_INVARIANT_IDS exactly,
  // so only the per-row "is this function inside that id's hashed closure" check
  // rejects it.
  const smuggled = replaceUnique(
    source, 'const STRUCTURAL_INVARIANT_DISPATCH = Object.freeze({\n',
    "const STRUCTURAL_INVARIANT_DISPATCH = Object.freeze({\n  'selection-exact-v1': () => true,\n",
    'structural dispatch-table registered-id smuggling'
  );
  await withMutatedHostContract(smuggled, async (mutatedPath) => {
    await assert.rejects(() => import(pathToFileURL(mutatedPath).href), /unattested dispatch-table row/u);
  });
});

// Round-3 review finding: assertDispatchTableClosure's membership check tested
// that a row's function is hashed under that id, not that it is that id's
// DISPATCHER. Several hashed functions are shared across all eleven closures
// and return truthy values, so a registered id could be smuggled into the other
// dispatch table backed by one of them with 0 of 11 digests moved. Each probe
// below keeps one clause of the repaired guard load-bearing, and the last two
// prove the closure holds as a property of the hashed data even when the guard
// itself is deleted.
test('a dispatch-table row may only be its own invariant canonical wrapper', async () => {
  const source = hostContractSource();
  const contextualTableHead = 'const CONTEXTUAL_INVARIANT_DISPATCH = Object.freeze({\n';
  const contextualFirstRow = `${contextualTableHead}  'request-authority-shape-v1': dispatchRequestAuthorityShapeV1,\n`;

  // Probe 1: the exact round-3 bypass. `resolveHistoricalArtifact` is hashed
  // into all eleven closures and always returns a truthy frozen object, so as a
  // contextual row it sets `applicable` for every artifact name and defeats
  // KSTACK_HOST_INVARIANT_CONTEXT_NOT_APPLICABLE for SchemaOfferV1.
  const smuggledShared = replaceUnique(
    source, contextualTableHead, `${contextualTableHead}  'result-shape-v1': resolveHistoricalArtifact,\n`,
    'contextual dispatch-table shared-function smuggling'
  );
  await withMutatedHostContract(smuggledShared, async (mutatedPath) => {
    await assert.rejects(() => import(pathToFileURL(mutatedPath).href), /shared across invariant closures/u);
  });

  // Probe 2: the same row plus a top-level rewrite of the smuggled function's
  // `name`. The exclusivity clause compares function identity, so the spoof
  // cannot reach it. (That the hashed shape is also immune — because declared
  // names are parsed from source rather than read off `fn.name` — is what probe
  // 5's unguarded variant proves.)
  const spoofAnchor = 'function assertDispatchTableClosure() {';
  const spoof = (text, target, alias, label) => replaceUnique(
    text, spoofAnchor, `Object.defineProperty(${target}, 'name', { value: '${alias}' });\n\n${spoofAnchor}`, label
  );
  const spoofed = spoof(smuggledShared, 'resolveHistoricalArtifact', 'dispatchResultShapeV1', 'declared-name spoof');
  await withMutatedHostContract(spoofed, async (mutatedPath) => {
    await assert.rejects(() => import(pathToFileURL(mutatedPath).href), /shared across invariant closures/u);
  });

  // Probe 3: the residual exclusivity alone leaves — a function that IS hashed
  // under exactly one id but is not that id's dispatcher.
  // `conformanceEvidenceSharedProjection` returns a truthy projection object, so
  // it would defeat the same guard. Only the canonical-wrapper identity clause
  // rejects it.
  const wrapperRowHead = `${contextualFirstRow}  'host-conformance-evidence-wrapper-v1': `;
  const misroled = replaceUnique(
    source, `${wrapperRowHead}dispatchConformanceEvidenceWrapperV1,\n`,
    `${wrapperRowHead}conformanceEvidenceSharedProjection,\n`,
    'contextual dispatch-table non-dispatcher swap'
  );
  await withMutatedHostContract(misroled, async (mutatedPath) => {
    await assert.rejects(() => import(pathToFileURL(mutatedPath).href), /not the canonical contextual dispatcher/u);
  });

  // Probe 4: the same round-3 injection with the guard's own call site deleted.
  // The dispatch tables' shape is hashed into all eleven entries as data, so the
  // added row moves every digest with no guard running at all.
  const guardCall = '\nassertDispatchTableClosure();\n';
  const smuggledUnguarded = replaceUnique(smuggledShared, guardCall, '\n', 'guard call site (added row)');
  await withMutatedHostContract(smuggledUnguarded, async (mutatedPath) => {
    const mutated = await import(pathToFileURL(mutatedPath).href);
    for (const invariantId of REQUIRED_INVARIANT_IDS) {
      assert.notEqual(
        mutated.HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
        HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
        `${invariantId}: an added dispatch-table row must move every digest without the guard`
      );
    }
  });

  // Probe 5: a same-key swap — identical key sets, identical per-id table
  // membership, only the function value replaced. HOST_INVARIANT_IMPLEMENTATIONS
  // takes each wrapper FROM the table, so the swapped function is inside the
  // id's closure by construction and the membership clause cannot see it; the
  // exclusivity clause is what rejects. With the guard deleted the hashed per-id
  // declared names still move all eleven.
  const swapped = replaceUnique(
    source, contextualFirstRow, `${contextualTableHead}  'request-authority-shape-v1': dispatchResolverPairV1,\n`,
    'contextual same-key function swap'
  );
  await withMutatedHostContract(swapped, async (mutatedPath) => {
    await assert.rejects(() => import(pathToFileURL(mutatedPath).href), /unattested dispatch-table row 'request-authority-shape-v1'/u);
  });
  // The unguarded variant also renames the swapped-in function to the one it
  // displaced. Had the hashed shape read `fn.name`, the roles map would collapse
  // back to its original bytes and only the one closure that pulls the wrapper
  // out of the table would move; parsing the declared name from source keeps all
  // eleven moving.
  const swappedUnguarded = spoof(
    replaceUnique(swapped, guardCall, '\n', 'guard call site (same-key swap)'),
    'dispatchResolverPairV1', 'dispatchRequestAuthorityShapeV1', 'same-key swap declared-name spoof'
  );
  await withMutatedHostContract(swappedUnguarded, async (mutatedPath) => {
    const mutated = await import(pathToFileURL(mutatedPath).href);
    for (const invariantId of REQUIRED_INVARIANT_IDS) {
      assert.notEqual(
        mutated.HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
        HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
        `${invariantId}: a same-key dispatcher swap must move every digest without the guard`
      );
    }
  });

  // Probe 6: the checks and the hashed shape both read the tables once, at
  // module evaluation, while dispatch re-reads them on every call. Dropping
  // `Object.freeze` from a table literal and assigning the round-3 row AFTER the
  // guard has already returned passes all four row checks against the
  // pre-mutation table and moves no digest — the frozen-table clause is what
  // closes it.
  const thawed = replaceUnique(
    source, contextualTableHead, 'const CONTEXTUAL_INVARIANT_DISPATCH = ({\n', 'contextual dispatch-table thaw'
  );
  const injectedAfterGuard = replaceUnique(
    thawed, guardCall, `${guardCall}CONTEXTUAL_INVARIANT_DISPATCH['result-shape-v1'] = resolveHistoricalArtifact;\n`,
    'post-guard row injection'
  );
  await withMutatedHostContract(injectedAfterGuard, async (mutatedPath) => {
    await assert.rejects(() => import(pathToFileURL(mutatedPath).href), /dispatch table is not frozen/u);
  });

  // Probe 7: dispatch-table key ORDER decides which invariant's error code wins
  // when one artifact violates two, and is hashed through the shape's ordered id
  // lists, so a reorder is attested rather than free. It is a legal table, so it
  // must load and move all eleven digests rather than fail closed.
  const reordered = replaceUnique(
    source, `${contextualFirstRow}  'host-conformance-evidence-wrapper-v1': dispatchConformanceEvidenceWrapperV1,\n`,
    `${contextualTableHead}  'host-conformance-evidence-wrapper-v1': dispatchConformanceEvidenceWrapperV1,\n`
      + "  'request-authority-shape-v1': dispatchRequestAuthorityShapeV1,\n",
    'contextual dispatch-table reorder'
  );
  await withMutatedHostContract(reordered, async (mutatedPath) => {
    const mutated = await import(pathToFileURL(mutatedPath).href);
    for (const invariantId of REQUIRED_INVARIANT_IDS) {
      assert.notEqual(
        mutated.HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
        HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
        `${invariantId}: a dispatch-table reorder must move every digest`
      );
    }
  });
});

test('the historical-resolution dispatch gate is attested by every invariant digest', async () => {
  const fixture = historicalFixture();
  // The closure declares a head-only schema for every applicable schema id, so
  // this artifact clears compileClosedSchemaSet and is rejected by nothing
  // except the invariant dispatch behind resolveHistoricalArtifact's own gate.
  const headOnly = (built) => hostCanonicalBytes({
    schemaId: 'kstack.operation-result.v1', schemaSetDigest: built.schemaSetDigest, schemaVersion: 1
  });
  const options = (built) => ({ ...built.options, expectedSchemaDigest: built.schemaDigests['kstack.operation-result.v1'] });
  assert.equal(resolveHistoricalArtifact(headOnly(fixture), options(fixture)).outcome, 'INVALID');

  // Neutering that single gate disables all eleven invariants on the historical
  // path. Before this gate was hashed, the probe moved 0 of 11 digests.
  const neutered = replaceUnique(
    hostContractSource(),
    'if (knownName) executeHistoricalInvariants(knownName, artifact,',
    'if (knownName === undefined) executeHistoricalInvariants(knownName, artifact,',
    'historical-resolution invariant dispatch gate'
  );
  await withMutatedHostContract(neutered, async (mutatedPath) => {
    const mutated = await import(pathToFileURL(mutatedPath).href);
    for (const invariantId of REQUIRED_INVARIANT_IDS) {
      assert.notEqual(
        mutated.HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
        HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
        `${invariantId}: the historical-resolution gate must sit inside its attested closure`
      );
    }
    const mutatedFixture = historicalFixture(mutated);
    assert.equal(
      mutated.resolveHistoricalArtifact(headOnly(mutatedFixture), options(mutatedFixture)).outcome,
      'VALID',
      'the neutered gate must actually admit an artifact the real gate rejects'
    );
  });
});

test("mutating a shared comparison helper re-attests all eleven and moves exactly its dependents' closures", async () => {
  const dependents = new Set(['eligibility-partition-v1', 'selection-exact-v1']);
  const mutatedSource = replaceUnique(
    hostContractSource(),
    'function sameValues(left, right) {\n  return left.length === right.length && left.every((entry, index) => entry === right[index]);\n}',
    'function sameValues(left, right) {\n  return true;\n}',
    'sameValues'
  );

  await withMutatedHostContract(mutatedSource, async (mutatedPath) => {
    const mutated = await import(pathToFileURL(mutatedPath).href);
    assertEveryDigestMoved(mutated, 'sameValues');

    // Documentary: sameValues is declared in exactly these two closures, and the
    // registered digests can no longer show that. This is the property the
    // whole-module digest traded away, kept visible here rather than lost.
    const closures = documentedClosureSources(mutated.HOST_INVARIANT_IMPLEMENTATIONS);
    const live = documentedClosureSources(HOST_INVARIANT_IMPLEMENTATIONS);
    for (const invariantId of REQUIRED_INVARIANT_IDS) {
      if (dependents.has(invariantId)) {
        assert.notEqual(closures[invariantId], live[invariantId], `${invariantId} depends on sameValues`);
      } else {
        assert.equal(closures[invariantId], live[invariantId], invariantId);
      }
    }
  });
});

test('invariant implementation digests are identical for LF and CRLF checkouts of the same source', async () => {
  const source = hostContractSource();
  const lf = source.replace(/\r\n/gu, '\n');
  const crlf = lf.replace(/\n/gu, '\r\n');
  assert.notEqual(crlf, lf, 'CRLF copy must actually differ byte-for-byte');

  await withMutatedHostContract(crlf, async (mutatedPath) => {
    const converted = await import(pathToFileURL(mutatedPath).href);
    assert.deepEqual(converted.HOST_INVARIANT_IMPLEMENTATION_DIGESTS, { ...HOST_INVARIANT_IMPLEMENTATION_DIGESTS });
  });
});

// Regression test for the lossy-decode collision the closing review found and
// proved: HOST_MODULE_SOURCE_DIGEST used to hash `readFileSync(url, 'utf8')`,
// and a UTF-8 DECODE is lossy — every distinct invalid byte sequence collapses
// to the same run of U+FFFD replacement characters. Three different invalid
// sequences appended to the module therefore minted ONE identical digest across
// three genuinely different files. It was not exploitable (V8's ESM decoder and
// Node's Buffer decoder agree on replacement-character behavior, so a collision
// implied an identical parsed program), but soundness resting on two independent
// decoders happening to agree is the same unstated-assumption shape that broke
// this mechanism at r5 and r6. The constant now hashes the raw disk bytes.
//
// The test pins BOTH halves so a revert cannot pass it: the legacy lossy digest
// is recomputed test-side and asserted still IDENTICAL across the three variants
// (that is the "before", kept permanently), while the registered digests the
// module actually mints are asserted pairwise DISTINCT.
//
// The bytes go into a trailing line comment, so every function's
// `Function.prototype.toString()` — and therefore every
// `implementationSourceDigests` entry — is byte-identical across the variants.
// The only input that moves is the whole-module source digest, which is exactly
// the constant under test.
const LOSSY_DECODE_COLLIDING_BYTES = Object.freeze({
  'overlong-slash': [0xc0, 0xaf],
  'truncated-three-byte': [0xe0, 0x80],
  'non-unicode': [0xfe, 0xff]
});

test('the whole-module source digest hashes raw bytes, so invalid-UTF-8 sequences that decode alike do not collide', async () => {
  const raw = fs.readFileSync(hostContractModule);
  const variants = Object.entries(LOSSY_DECODE_COLLIDING_BYTES).map(([label, bytes]) => ({
    label,
    bytes: Buffer.concat([raw, Buffer.from('\n// '), Buffer.from(bytes), Buffer.from('\n')])
  }));

  // Precondition, without which "the digests differ" would prove nothing: the
  // three files differ as BYTES but are the identical program once decoded.
  for (let index = 1; index < variants.length; index += 1) {
    assert.notDeepEqual(variants[index].bytes, variants[0].bytes,
      `${variants[index].label}: variants must differ byte-for-byte`);
    assert.equal(variants[index].bytes.toString('utf8'), variants[0].bytes.toString('utf8'),
      `${variants[index].label}: variants must decode to the identical source text`);
  }

  // The "before". This is the exact computation the constant used to perform;
  // it still collides, and asserting that it does keeps the regression visible
  // rather than leaving it as prose.
  const lossyDigests = variants.map(({ bytes }) => crypto.createHash('sha256')
    .update(Buffer.from(bytes.toString('utf8').replace(/\r\n/gu, '\n'), 'utf8')).digest('hex'));
  assert.equal(new Set(lossyDigests).size, 1,
    'the superseded lossy-decode computation must still be shown colliding — that is the defect being pinned');

  // The "after". Every registered digest mixes in HOST_MODULE_SOURCE_DIGEST, so
  // each variant must now mint eleven digests distinct from every other's.
  const registered = [];
  for (const { label, bytes } of variants) {
    await withMutatedHostContract(bytes, async (mutatedPath) => {
      const mutated = await import(pathToFileURL(mutatedPath).href);
      const digests = mutated.HOST_INVARIANT_IMPLEMENTATION_DIGESTS;
      assert.deepEqual(Object.keys(digests).sort(), [...REQUIRED_INVARIANT_IDS].sort(),
        `${label}: variant must still be a loadable, complete module`);
      registered.push({ label, digests });
    });
  }
  for (const invariantId of REQUIRED_INVARIANT_IDS) {
    const minted = registered.map((entry) => entry.digests[invariantId]);
    assert.equal(new Set(minted).size, registered.length,
      `${invariantId}: distinct module bytes must mint distinct digests (lossy-decode collision has returned)`);
  }
});

test('implementation closure fails closed when an executing invariant digest is not installed', () => {
  const fixture = historicalFixture();
  const valid = resolveHistoricalArtifact(fixture.artifactBytes, fixture.options);
  assert.equal(valid.outcome, 'VALID');

  const labelDigests = Object.entries(HOST_INVARIANT_PROGRAMS).map(([invariantId, program]) =>
    `sha256:${crypto.createHash('sha256').update(hostCanonicalBytes({ invariantId, program })).digest('hex')}`);
  assert.equal(labelDigests.some((entry) => fixture.implementationDigests.includes(entry)), false);
  const stale = resolveHistoricalArtifact(fixture.artifactBytes, { ...fixture.options, installedInvariantDigests: labelDigests });
  assert.deepEqual({ outcome: stale.outcome, reasonCode: stale.reasonCode }, {
    outcome: 'UNAVAILABLE', reasonCode: 'KSTACK_HOST_INVARIANT_UNAVAILABLE'
  });

  for (const invariantId of REQUIRED_INVARIANT_IDS) {
    const withheld = HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId];
    const partial = resolveHistoricalArtifact(fixture.artifactBytes, {
      ...fixture.options, installedInvariantDigests: fixture.implementationDigests.filter((entry) => entry !== withheld)
    });
    assert.deepEqual({ outcome: partial.outcome, reasonCode: partial.reasonCode }, {
      outcome: 'UNAVAILABLE', reasonCode: 'KSTACK_HOST_INVARIANT_UNAVAILABLE'
    }, invariantId);
  }
});

// --- documented-closure boundary enumeration ---------------------------------
// STATUS: DISCLOSURE, NOT SOUNDNESS. This whole section used to be the thing
// that made the invariant digests trustworthy — the claim was that the boundary
// of what a hashed function may reach is discovered mechanically here rather
// than remembered in prose. That claim is retired. It failed twice, in the same
// way, against two independently written scanners: r5 walked out through the
// second declarator of a comma-separated const list, and r6, against the fixed
// depth-0 scanner below, walked out through `var` inside a block (module-scoped
// in JS despite the nesting). Each was proven end to end — an extracted,
// re-attested, then neutered guard, 0 of 11 digests moved, suite green, a
// malformed artifact ACCEPTED. Any scanner short of a real parser can only
// fence forms someone thought of, and that is precisely the mistake it was
// built to correct one level up.
//
// HOST_MODULE_SOURCE_DIGEST replaced it: the module's whole EOL-normalized
// source is hashed into all eleven registered digests, so no name DECLARED IN
// THAT MODULE can be outside the hash, and no exclusion list's completeness is
// load-bearing any more. It says nothing about node builtins or about a loader
// that rewrites the source in flight; see the constant's own comment.
//
// What remains here is kept because it is useful documentation, not because
// anything depends on it: it shows which module-scope names the hashed closures
// actually reach, and drift between that and HOST_INVARIANT_CLOSURE_EXCLUSIONS
// is worth surfacing. A miss in this scanner is now a stale document. It is no
// longer a hole.
//
// The REFERENCE side is a deliberately conservative heuristic, not a JS parser:
// `enumerateFreeModuleNames` tokenises every identifier in a hashed function's
// source and keeps the ones that happen to be declared at module scope. A local
// or a property key that shadows a module-scope name is therefore a FALSE
// POSITIVE that must be disclosed (`schemaName` is one today). That direction is
// the safe one — the failure this test exists to catch is a silent MISS, and
// over-inclusion cannot produce one.
//
// The DECLARATION side is not a heuristic any more. Round 5 extracted
// module-scope names with a line-anchored regex, and r5 proved that misses at
// least four ordinary, legal declaration forms — the second declarator of a
// comma-separated list, an indented declaration, `function*`, and
// `export default function` — each of which makes every reference to the name
// invisible here. r5 turned the first of those into a live bypass: lifting
// `resolveBoundArtifact`'s reference-binding guard into a comma-list helper and
// neutering it kept the whole suite green while a hostile resolver's
// substituted artifact validated as ACCEPTED. `scanModuleBindings` below
// replaces the regex with a brace/paren/bracket-depth-0 scanner, and the
// three-form blacklist that used to guard the regex with positive accounting:
// every declaration keyword the scanner finds at depth 0 must yield at least
// one binding, so an unhandled form fails loudly instead of passing silently.

function stripSourceComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/(^|[^:])\/\/[^\n]*/gu, '$1 ');
}

const DECLARATION_KEYWORDS = new Set(['function', 'class', 'const', 'let', 'var', 'import']);
// After any of these, a `function`/`class` keyword is an operand, not a
// declaration, and a `/` opens a regex literal rather than dividing.
const EXPRESSION_PRECEDING_NAMES = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'yield', 'await'
]);
// Punctuators that demand a right-hand operand, so a `function`/`class` on the
// next line continues the expression instead of starting a declaration. Every
// other punctuator (`)`, `]`, `}`, `;`, `++`, `--`, ...) lets ASI end the
// statement, which makes the next `function` a declaration.
const OPERAND_DEMANDING = new Set([
  '=', ',', '(', '[', ':', '?', '=>', '&&', '||', '??', '!', '+', '-', '*', '/', '%',
  '<', '>', '^', '&', '|', '~', '...', '==', '!=', '===', '!==', '<=', '>=', '**',
  '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**=', '<<=',
  '>>=', '>>>=', '&&=', '||=', '??=', '?.', '.'
]);
const STATEMENT_STARTERS = new Set([
  'const', 'let', 'var', 'function', 'class', 'import', 'export', 'return', 'if', 'for',
  'while', 'do', 'switch', 'try', 'throw', 'break', 'continue'
]);
const PUNCTUATORS = [
  '>>>=', '===', '!==', '**=', '...', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=',
  '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>',
  '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/', '%', '&',
  '|', '^', '!', '~', '?', ':', '=', '.', '#', '@'
];
// Deliberately wider than the reference side's `[A-Za-z_$][\w$]*`: a binding the
// scanner could not name at all would be a silent miss, so it recognises every
// legal ECMAScript identifier and the accounting below rejects any binding the
// reference tokeniser could not match back.
const IDENTIFIER = /[\p{ID_Start}$_][\p{ID_Continue}$\u200c\u200d]*/uy;
const NUMERAL = /[0-9][0-9A-Za-z_$.]*/uy;
const ASCII_IDENTIFIER = /^[A-Za-z_$][\w$]*$/u;

function scanQuoted(source, start, quote) {
  let cursor = start + 1;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === '\\') { cursor += 2; continue; }
    if (character === '\n') break;
    if (character === quote) return cursor + 1;
    cursor += 1;
  }
  throw new Error(`unterminated ${quote} string literal at offset ${start}`);
}

// A regex literal may not contain a raw newline. Returning null on one makes an
// ambiguous `/` fall back to division rather than swallowing the rest of the
// file — the mis-scan that would otherwise hide every later declaration.
function scanRegexLiteral(source, start) {
  let cursor = start + 1;
  let inClass = false;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === '\n') return null;
    if (character === '\\') { cursor += 2; continue; }
    if (character === '[') inClass = true;
    else if (character === ']') inClass = false;
    else if (character === '/' && !inClass) {
      cursor += 1;
      while (cursor < source.length && /[a-z]/u.test(source[cursor])) cursor += 1;
      return cursor;
    }
    cursor += 1;
  }
  return null;
}

function scanTemplateBody(source, from) {
  let cursor = from;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === '\\') { cursor += 2; continue; }
    if (character === '`') return { next: cursor + 1, closed: true };
    if (character === '$' && source[cursor + 1] === '{') return { next: cursor + 2, closed: false };
    cursor += 1;
  }
  throw new Error(`unterminated template literal at offset ${from}`);
}

function regexCanFollow(previous) {
  if (!previous) return true;
  if (previous.kind === 'name') return EXPRESSION_PRECEDING_NAMES.has(previous.value);
  if (previous.kind !== 'punct') return false;
  return previous.value !== ')' && previous.value !== ']' && previous.value !== '++' && previous.value !== '--';
}

// One pass. Comments, strings, template literals (including `${}` expressions,
// which nest arbitrarily) and regex literals are recognised inline rather than
// stripped by successive replaces, because a replace pass cannot tell
// `'// not a comment'` from a comment. Each emitted token carries the
// brace/paren/bracket depth at which it starts; depth 0 is module scope.
function tokenizeModuleSource(source) {
  const tokens = [];
  const templates = [];
  let index = 0;
  let depth = 0;
  let curly = 0;
  let newline = true;
  const previous = () => (tokens.length > 0 ? tokens[tokens.length - 1] : null);
  const push = (kind, value, tokenDepth = depth) => {
    tokens.push({ kind, value, depth: tokenDepth, newlineBefore: newline });
    newline = false;
  };

  while (index < source.length) {
    const character = source[index];
    if (character === '\n' || character === '\r' || character === '\u2028' || character === '\u2029') { newline = true; index += 1; continue; }
    if (character === ' ' || character === '\t' || character === '\f' || character === '\v' || character === '\ufeff' || character === '\u00a0') { index += 1; continue; }
    if (character === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index);
      index = end === -1 ? source.length : end;
      continue;
    }
    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end === -1) throw new Error(`unterminated block comment at offset ${index}`);
      if (source.slice(index, end).includes('\n')) newline = true;
      index = end + 2;
      continue;
    }
    if (character === '"' || character === "'") {
      index = scanQuoted(source, index, character);
      push('string', '');
      continue;
    }
    if (character === '`') {
      const body = scanTemplateBody(source, index + 1);
      index = body.next;
      if (body.closed) { push('string', ''); continue; }
      templates.push(curly);
      curly += 1;
      depth += 1;
      continue;
    }
    if (character === '}' && templates.length > 0 && templates[templates.length - 1] === curly - 1) {
      templates.pop();
      curly -= 1;
      depth -= 1;
      const body = scanTemplateBody(source, index + 1);
      index = body.next;
      if (body.closed) { push('string', ''); continue; }
      templates.push(curly);
      curly += 1;
      depth += 1;
      continue;
    }
    if (character === '/' && regexCanFollow(previous())) {
      const end = scanRegexLiteral(source, index);
      if (end !== null) { index = end; push('regex', ''); continue; }
    }
    IDENTIFIER.lastIndex = index;
    const identifier = IDENTIFIER.exec(source);
    if (identifier !== null && identifier.index === index) {
      index += identifier[0].length;
      push('name', identifier[0]);
      continue;
    }
    NUMERAL.lastIndex = index;
    const numeral = NUMERAL.exec(source);
    if (numeral !== null && numeral.index === index) {
      index += numeral[0].length;
      push('number', numeral[0]);
      continue;
    }
    if (character === '{') { push('punct', '{'); curly += 1; depth += 1; index += 1; continue; }
    if (character === '}') { curly -= 1; depth -= 1; push('punct', '}'); index += 1; continue; }
    if (character === '(' || character === '[') { push('punct', character); depth += 1; index += 1; continue; }
    if (character === ')' || character === ']') { depth -= 1; push('punct', character); index += 1; continue; }
    const punctuator = PUNCTUATORS.find((entry) => source.startsWith(entry, index));
    if (punctuator === undefined) throw new Error(`unrecognised character ${JSON.stringify(character)} at offset ${index}`);
    index += punctuator.length;
    push('punct', punctuator);
  }
  if (depth !== 0 || templates.length > 0) throw new Error(`unbalanced module source: depth ${depth}, ${templates.length} open template expressions`);
  return tokens;
}

// Every name a destructuring target introduces: renames (`a: b` binds `b`),
// defaults (`a = 1` binds `a`, and the default expression binds nothing), rest
// elements, and arbitrary nesting.
function readBindingPattern(tokens, start) {
  const found = [];
  const baseDepth = tokens[start].depth;
  let cursor = start + 1;
  let defaultDepth = null;
  while (cursor < tokens.length) {
    const token = tokens[cursor];
    if (defaultDepth !== null) {
      const closes = token.kind === 'punct' && token.depth <= defaultDepth
        && (token.value === ',' || token.value === '}' || token.value === ']');
      if (!closes) { cursor += 1; continue; }
      defaultDepth = null;
      continue;
    }
    if (token.kind === 'punct' && token.depth === baseDepth && (token.value === '}' || token.value === ']')) return { names: found, next: cursor + 1 };
    if (token.kind === 'punct' && token.value === '=') { defaultDepth = token.depth; cursor += 1; continue; }
    if (token.kind === 'name') {
      const next = tokens[cursor + 1];
      if (next && next.kind === 'punct' && next.value === ':') { cursor += 2; continue; }
      found.push(token.value);
      cursor += 1;
      continue;
    }
    cursor += 1;
  }
  return { names: found, next: cursor };
}

// Skip a declarator's initializer. Only a `,` or `;` still at depth 0 ends it,
// so commas inside an arrow body, object literal or call argument list cannot
// be mistaken for the next declarator; a depth-0 statement keyword ends it too,
// which is what makes an ASI-terminated `const a = 1` release the scanner back
// to the `function b(){}` on the next line.
function skipInitializer(tokens, from) {
  let cursor = from;
  while (cursor < tokens.length) {
    const token = tokens[cursor];
    if (token.depth === 0 && token.kind === 'punct' && token.value === ',') return { next: cursor + 1, more: true };
    if (token.depth === 0 && token.kind === 'punct' && token.value === ';') return { next: cursor + 1, more: false };
    if (token.depth === 0 && token.kind === 'name' && cursor > from && STATEMENT_STARTERS.has(token.value)) return { next: cursor, more: false };
    cursor += 1;
  }
  return { next: cursor, more: false };
}

// `function`/`class` at depth 0 is a declaration unless it sits in expression
// position. A newline immediately before it means ASI has already closed the
// previous statement, so it is a declaration whatever value token preceded it.
// Every remaining ambiguity resolves toward "declaration", which over-includes
// (a false positive merely has to be disclosed) rather than under-includes.
function declarationPosition(tokens, index) {
  let cursor = index - 1;
  while (cursor >= 0 && tokens[cursor].kind === 'name' && tokens[cursor].value === 'async' && !tokens[index].newlineBefore) cursor -= 1;
  const before = cursor >= 0 ? tokens[cursor] : null;
  if (before === null) return true;
  if (tokens[cursor + 1].newlineBefore) return !(before.kind === 'punct' && OPERAND_DEMANDING.has(before.value));
  if (before.kind === 'name') return !EXPRESSION_PRECEDING_NAMES.has(before.value);
  if (before.kind === 'string' || before.kind === 'number' || before.kind === 'regex') return false;
  return before.value === ';' || before.value === '{' || before.value === '}' || before.value === ')' || before.value === ']';
}

// Returns every module-scope binding plus `unattributed`: the positive
// accounting. A declaration keyword found at depth 0 that yields no binding
// name is a form this scanner does not understand, and the enumeration test
// fails on it rather than continuing with an incomplete module scope.
function scanModuleBindings(source) {
  const tokens = tokenizeModuleSource(source);
  const names = new Set();
  const unattributed = [];
  const flag = (reason, at) => unattributed.push(
    `${reason}: ${JSON.stringify(tokens.slice(Math.max(0, at - 2), at + 5).map((entry) => entry.value).join(' '))}`);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind !== 'name' || token.depth !== 0 || !DECLARATION_KEYWORDS.has(token.value)) continue;
    const before = index > 0 ? tokens[index - 1] : null;
    if (before && before.kind === 'punct' && (before.value === '.' || before.value === '?.')) continue;
    const after = tokens[index + 1] || null;

    if (token.value === 'import') {
      // `import.meta`, `import(...)` and a bare side-effect `import 'x'` bind
      // nothing and are legal; every other import form must bind something.
      if (after && after.kind === 'punct' && (after.value === '.' || after.value === '(')) continue;
      if (after && after.kind === 'string') continue;
      let cursor = index + 1;
      let produced = 0;
      let walking = true;
      while (walking && cursor < tokens.length) {
        const entry = tokens[cursor];
        if (entry.kind === 'name') {
          if (entry.value === 'from') break;
          names.add(entry.value); produced += 1; cursor += 1; continue;
        }
        if (entry.kind === 'punct' && entry.value === ',') { cursor += 1; continue; }
        if (entry.kind === 'punct' && entry.value === '*') {
          cursor += 1;
          if (tokens[cursor] && tokens[cursor].value === 'as') cursor += 1;
          if (tokens[cursor] && tokens[cursor].kind === 'name') { names.add(tokens[cursor].value); produced += 1; cursor += 1; }
          continue;
        }
        if (entry.kind === 'punct' && entry.value === '{') {
          cursor += 1;
          while (cursor < tokens.length && !(tokens[cursor].kind === 'punct' && tokens[cursor].value === '}')) {
            if (tokens[cursor].kind === 'name') {
              if (tokens[cursor + 1] && tokens[cursor + 1].value === 'as' && tokens[cursor + 2] && tokens[cursor + 2].kind === 'name') {
                names.add(tokens[cursor + 2].value); produced += 1; cursor += 3; continue;
              }
              names.add(tokens[cursor].value); produced += 1; cursor += 1; continue;
            }
            cursor += 1;
          }
          cursor += 1;
          continue;
        }
        walking = false;
      }
      if (produced === 0) flag('import declaration produced no binding — extend the scanner', index);
      continue;
    }

    if (token.value === 'function' || token.value === 'class') {
      if (!declarationPosition(tokens, index)) continue;
      let cursor = index + 1;
      if (token.value === 'function' && tokens[cursor] && tokens[cursor].kind === 'punct' && tokens[cursor].value === '*') cursor += 1;
      const target = tokens[cursor];
      if (target && target.kind === 'name' && target.value !== 'extends') { names.add(target.value); continue; }
      // `export default function(){}` / `export default class {}` genuinely
      // introduce no module-scope binding, so nothing can reference them.
      const anonymous = (target && target.kind === 'punct' && (target.value === '(' || target.value === '{'))
        || (target && target.kind === 'name' && target.value === 'extends');
      const defaulted = before && before.kind === 'name' && before.value === 'default';
      if (!(anonymous && defaulted)) flag(`${token.value} declaration produced no binding — extend the scanner`, index);
      continue;
    }

    let cursor = index + 1;
    let produced = 0;
    for (;;) {
      const target = tokens[cursor];
      if (!target) break;
      if (target.kind === 'name') { names.add(target.value); produced += 1; cursor += 1; }
      else if (target.kind === 'punct' && (target.value === '{' || target.value === '[')) {
        const pattern = readBindingPattern(tokens, cursor);
        for (const name of pattern.names) { names.add(name); produced += 1; }
        cursor = pattern.next;
      } else break;
      const stop = skipInitializer(tokens, cursor);
      cursor = stop.next;
      if (!stop.more) break;
    }
    if (produced === 0) flag(`${token.value} declaration produced no binding — extend the scanner`, index);
  }

  // A binding the reference-side tokeniser (`[A-Za-z_$][\w$]*`) cannot match
  // back would be invisible to `enumerateFreeModuleNames` even though the
  // scanner sees it, so it is an accounting failure, not a silent pass.
  for (const name of names) {
    if (!ASCII_IDENTIFIER.test(name)) unattributed.push(`module-scope binding '${name}' is not an ASCII identifier the reference tokeniser can match`);
  }
  return { names, unattributed };
}

function moduleScopeNames(source) {
  return scanModuleBindings(source).names;
}

// A frozen copy of the round-5 line-anchored extractor, kept ONLY as a
// differential oracle: the probe battery below asserts, form by form, which
// declarations it missed and that the depth-0 scanner now sees them. It is not
// used by any assertion about the real module scope.
function roundFiveLineAnchoredNames(source) {
  const names = new Set();
  for (const line of stripSourceComments(source).split('\n')) {
    const declared = /^(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/u.exec(line);
    if (declared) names.add(declared[1]);
    const imported = /^import\s+([A-Za-z_$][\w$]*)\s+from/u.exec(line);
    if (imported) names.add(imported[1]);
  }
  return names;
}

// Read from the source text, exactly as the module's own `declaredFunctionName`
// does, so a single `Object.defineProperty(fn, 'name', ...)` line cannot rename
// a hashed function out from under this test.
function declaredImplementationName(implementation) {
  const declared = /^function\s+([^\s(]+)/u.exec(implementation.toString());
  assert.ok(declared, 'hashed invariant implementation is not a named function declaration');
  return declared[1];
}

function enumerateFreeModuleNames(moduleScope, covered, implementations = HOST_INVARIANT_IMPLEMENTATIONS) {
  const free = new Map();
  for (const closure of Object.values(implementations)) {
    for (const implementation of closure) {
      const owner = declaredImplementationName(implementation);
      for (const token of stripSourceComments(implementation.toString()).match(/[A-Za-z_$][\w$]*/gu) || []) {
        if (token === owner || !moduleScope.has(token) || covered.has(token)) continue;
        if (!free.has(token)) free.set(token, new Set());
        free.get(token).add(owner);
      }
    }
  }
  return free;
}

test('every module-scope name a hashed invariant implementation reaches is hashed or disclosed', () => {
  const source = fs.readFileSync(hostContractModule, 'utf8');
  const scan = scanModuleBindings(source);
  const moduleScope = scan.names;
  assert.ok(moduleScope.size > 100, `module-scope extraction found only ${moduleScope.size} names`);

  // Positive accounting: every `function`/`class`/`const`/`let`/`var`/`import`
  // keyword the scanner finds at depth 0 must yield at least one binding name.
  // This keeps the disclosure honest about what it can see — it does NOT make
  // the enumeration complete, and it is not claimed to. r6 defeated exactly this
  // accounting with `var` inside a block: the keyword is not at depth 0, so
  // nothing is unattributed and nothing is recorded. Soundness comes from
  // HOST_MODULE_SOURCE_DIGEST, not from here.
  assert.deepEqual(scan.unattributed, [],
    `module scope contains a declaration form the scanner cannot attribute a binding to — extend scanModuleBindings() (tokenizeModuleSource/readBindingPattern) before adding one, or its bindings become invisible to this test`);

  const hashed = new Set(HOST_INVARIANT_HASHED_CONSTANTS);
  for (const closure of Object.values(HOST_INVARIANT_IMPLEMENTATIONS)) {
    for (const implementation of closure) hashed.add(declaredImplementationName(implementation));
  }
  const excluded = new Set(HOST_INVARIANT_CLOSURE_EXCLUSIONS);
  assert.equal(excluded.size, HOST_INVARIANT_CLOSURE_EXCLUSIONS.length, 'duplicate name in the disclosure list');
  assert.equal(new Set(HOST_INVARIANT_HASHED_CONSTANTS).size, HOST_INVARIANT_HASHED_CONSTANTS.length);

  // A disclosed name must be a real, currently declared module-scope symbol:
  // this is what stops the list rotting into stale or misspelled entries.
  for (const name of [...HOST_INVARIANT_CLOSURE_EXCLUSIONS, ...HOST_INVARIANT_HASHED_CONSTANTS]) {
    assert.ok(moduleScope.has(name), `disclosed name '${name}' is not declared at module scope`);
  }
  // Nothing may be claimed as hashed and disclosed as outside the hash at once.
  for (const name of HOST_INVARIANT_CLOSURE_EXCLUSIONS) {
    assert.equal(hashed.has(name), false, `'${name}' is both hashed and listed as excluded`);
  }

  const undisclosed = enumerateFreeModuleNames(moduleScope, new Set([...hashed, ...excluded]));
  assert.deepEqual(
    [...undisclosed.keys()].sort(),
    [],
    `module-scope names reachable from a hashed implementation but neither hashed nor disclosed: ${
      [...undisclosed.entries()].map(([name, owners]) => `${name} (from ${[...owners].sort().join(', ')})`).join('; ')
    } — add each to HOST_INVARIANT_CLOSURE_EXCLUSIONS (or into a hashed closure) rather than deleting this assertion`
  );

  // The enumeration is live, not vacuous: with nothing disclosed it still finds
  // the exact six names r4 proved were reachable and undisclosed, plus the rest
  // of the closure frontier.
  const withoutDisclosure = enumerateFreeModuleNames(moduleScope, hashed);
  for (const name of [
    'loadBootstrap', 'requireImplementationClosure', 'requireInvariantApplicabilityClosure',
    'requireStoredBytes', 'storedValueResolver', 'validateHostBootstrap'
  ]) {
    assert.ok(withoutDisclosure.has(name), `enumeration heuristic no longer reaches '${name}'`);
  }
  assert.ok(withoutDisclosure.size >= 20, `enumeration frontier collapsed to ${withoutDisclosure.size} names`);
  assert.ok(withoutDisclosure.get('loadBootstrap').has('resolveHistoricalArtifact'));
});

// --- module-scope scanner probe battery --------------------------------------
// Round 5 proved its extractor correct once, by hand, and shipped no probe that
// would notice when that stopped being true; r5 then broke it with four
// ordinary declaration forms. These probes are that missing regression: each
// appends one declaration to the real module source and asserts the scanner
// records the binding, so a future edit that narrows the scanner fails here
// instead of silently shrinking the attested closure's visible frontier.
//
// `r5` records what the retired line-anchored extractor did with the same
// snippet, so the table doubles as the before/after evidence for this round.
const MODULE_SCOPE_BINDING_PROBES = Object.freeze([
  ['plain top-level function', 'function probeHelper(value) { return value; }', ['probeHelper']],
  ['indented declaration', '  function probeHelper(value) { return value; }', ['probeHelper']],
  ['generator function', 'function* probeHelper(value) { return value; }', ['probeHelper']],
  ['async generator function', 'async function* probeHelper(value) { return value; }', ['probeHelper']],
  ['export default function', 'export default function probeHelper(value) { return value; }', ['probeHelper']],
  ['second declarator in a const list', "const probeFirst = 'x', probeHelper = (value) => value;", ['probeFirst', 'probeHelper']],
  ['third declarator after arrow and object initializers', 'const probeA = (v) => v, probeB = { a: 1, b: 2 }, probeHelper = 3;', ['probeA', 'probeB', 'probeHelper']],
  ['indented, line-wrapped second declarator', "  const probeFirst = 'x',\n    probeHelper = (value) => { return value; };", ['probeFirst', 'probeHelper']],
  ['aliasing const', 'const probeHelper = resolveBoundArtifact;', ['probeHelper']],
  ['module-scope arrow function', 'const probeHelper = (value) => { return value; };', ['probeHelper']],
  ['object destructuring with rename', 'const { freeze: probeHelper } = Object;', ['probeHelper']],
  ['array destructuring with rest', 'const [probeFirst, ...probeHelper] = [1, 2, 3];', ['probeFirst', 'probeHelper']],
  ['nested destructuring with a default', 'const { a: { b: probeHelper = 1 } } = { a: {} };', ['probeHelper']],
  ['named import with alias', "import { createHash as probeHelper } from 'node:crypto';", ['probeHelper']],
  ['namespace import', "import * as probeHelper from 'node:crypto';", ['probeHelper']],
  ['default plus named import', "import probeFirst, { createHash as probeHelper } from 'node:crypto';", ['probeFirst', 'probeHelper']],
  ['class declaration with extends', 'class ProbeHelper extends Error {}', ['ProbeHelper']],
  ['exported class declaration', 'export class ProbeHelper {}', ['ProbeHelper']],
  ['let and var', 'let probeFirst = 1;\nvar probeHelper = 2;', ['probeFirst', 'probeHelper']],
  ['declaration after an ASI-terminated const', 'const probeFirst = 1\nfunction probeHelper() { return probeFirst; }', ['probeFirst', 'probeHelper']],
  ['declaration after a regex-literal initializer', 'const probeFirst = /a\\/b}{/u;\nfunction probeHelper() { return probeFirst; }', ['probeFirst', 'probeHelper']],
  ['declaration after a template literal holding a brace', 'const probeFirst = `${1}}`;\nfunction probeHelper() { return probeFirst; }', ['probeFirst', 'probeHelper']],
  ['declaration after a string holding comment markers', "const probeFirst = '// not a comment */';\nfunction probeHelper() { return probeFirst; }", ['probeFirst', 'probeHelper']],
  ['declaration after a string holding a backtick and a quote', 'const probeFirst = "it\'s `x`";\nfunction probeHelper() { return probeFirst; }', ['probeFirst', 'probeHelper']],
  ['declaration after a division expression', 'const probeFirst = HOST_CONTRACT_LIMITS.maxDepth / 2 / 2;\nfunction probeHelper() { return probeFirst; }', ['probeFirst', 'probeHelper']],
  ['declaration sharing a line with a statement', 'const probeFirst = 1; function probeHelper() { return probeFirst; }', ['probeFirst', 'probeHelper']],
  // Found by probing this scanner rather than by review: ASI after a postfix
  // operator. The first cut treated `++` as continuing the expression and
  // silently missed the declaration on the next line.
  ['declaration after an ASI-terminated postfix increment', 'let probeCount = 0;\nprobeCount++\nfunction probeHelper() { return probeCount; }', ['probeCount', 'probeHelper']],
  ['declaration after a regex whose class holds a slash and a brace', 'const probeFirst = /[/{]/u;\nfunction probeHelper() { return probeFirst; }', ['probeFirst', 'probeHelper']],
  ['declaration after a nested template literal', 'const probeFirst = `${`${"`"}`}`;\nfunction probeHelper() { return probeFirst; }', ['probeFirst', 'probeHelper']],
  ['class with a static block and a private field', 'class ProbeHelper { #probeInner = 1; static { void 0; } }', ['ProbeHelper']]
]);

// Forms that must NOT be recorded: a false positive is only a disclosure cost,
// but these keep the scanner from degenerating into "every identifier".
const MODULE_SCOPE_NON_BINDING_PROBES = Object.freeze([
  ['nested function declaration', 'function probeOuter() { function probeInner() { return 1; } return probeInner; }'],
  ['nested arrow binding', 'const probeOuter = () => { const probeInner = 1; return probeInner; };'],
  ['property shorthand inside an object literal', 'const probeOuter = Object.freeze({ probeInner: 1 });'],
  ['named function expression', 'const probeOuter = function probeInner() { return 1; };'],
  ['identifier inside a string literal', "const probeOuter = 'const probeInner = 1;';"],
  ['identifier inside a block comment', '/* const probeInner = 1; */\nconst probeOuter = 1;'],
  ['identifier inside a line comment', '// const probeInner = 1;\nconst probeOuter = 1;'],
  ['identifier inside a computed member access', "const probeOuter = HOST_ARTIFACT_SCHEMAS['probeInner'];"],
  ['declaration inside a block', 'if (HOST_CONTRACT_LIMITS) { const probeInner = 1; probeInner; }'],
  ['identifier inside a template expression', 'const probeOuter = `${(() => { const probeInner = 1; return probeInner; })()}`;']
]);

test('the module-scope scanner records every legal declaration form the round-5 extractor missed', () => {
  const source = hostContractSource();
  for (const [label, snippet, expected] of MODULE_SCOPE_BINDING_PROBES) {
    const scan = scanModuleBindings(`${source}\n${snippet}\n`);
    assert.deepEqual(scan.unattributed, [], `${label}: accounting flagged a legal form`);
    for (const name of expected) assert.ok(scan.names.has(name), `${label}: scanner does not see module-scope binding '${name}'`);
  }
  for (const [label, snippet] of MODULE_SCOPE_NON_BINDING_PROBES) {
    const scan = scanModuleBindings(`${source}\n${snippet}\n`);
    assert.deepEqual(scan.unattributed, [], `${label}: accounting flagged a legal form`);
    assert.equal(scan.names.has('probeInner'), false, `${label}: scanner treats a non-module-scope name as a module binding`);
  }

  // The four forms r5 named, still missed by the retired extractor. If this
  // stops holding the probe table has drifted away from the defect it records.
  const retired = Object.fromEntries(MODULE_SCOPE_BINDING_PROBES.map(([label, snippet, expected]) =>
    [label, expected.every((name) => roundFiveLineAnchoredNames(`${source}\n${snippet}\n`).has(name))]));
  for (const label of [
    'second declarator in a const list', 'indented declaration', 'generator function', 'export default function'
  ]) assert.equal(retired[label], false, `${label} was supposed to be a round-5 blind spot`);
  assert.equal(retired['plain top-level function'], true, 'round-5 extractor did see a plain declaration');
});

test('the module-scope scanner fails loudly on a declaration form it cannot attribute', () => {
  const source = hostContractSource();
  // Positive accounting, not a blacklist: neither of these is enumerated
  // anywhere, and neither may pass silently.
  for (const [label, snippet] of [
    ['non-ASCII identifier the reference tokeniser cannot match back', 'function hélper(value) { return value; }'],
    ['binding-less declaration form', 'const {} = Object;']
  ]) {
    const scan = scanModuleBindings(`${source}\n${snippet}\n`);
    assert.ok(scan.unattributed.length > 0, `${label}: scanner accepted an unattributable declaration silently`);
  }
  // A `\u`-escaped identifier is legal JS the tokeniser does not decode. It
  // refuses to scan rather than scanning past it, so this test's own module
  // scope can never be quietly incomplete — the loudest available failure.
  assert.throws(() => scanModuleBindings(`${source}\nconst probe\\u0048elper = 1;\n`), /unrecognised character/u);
  // Anonymous default exports bind nothing at all, so nothing can reference
  // them: zero bindings is the right answer, not an accounting failure.
  for (const snippet of ['export default function () { return 1; }', 'export default class extends Error {};']) {
    assert.deepEqual(scanModuleBindings(`${source}\n${snippet}\n`).unattributed, [], snippet);
  }
});

// --- r5 primary finding: the resolveBoundArtifact extraction bypass ----------
// r5's reject rested on this exact construction: lift resolveBoundArtifact's
// reference-binding guard into a module-scope helper declared as the SECOND
// item of a comma-separated const list. The round-5 extractor could not see
// that helper, so the enumeration test passed, and once the (re-attested)
// extraction was in place, neutering the helper moved 0/11 digests while a
// hostile resolver's substituted artifact validated as ACCEPTED.
//
// The test below is retained as a scanner-visibility regression only. What
// actually closes r5 — and r6, which defeated that same scanner a round later —
// is the whole-module digest, asserted directly in the extraction-bypass test
// that follows it.
const REFERENCE_BINDING_GUARD = "  if (validated.objectDigest !== digest || value.schemaSetDigest !== sourceSchemaSetDigest) fail('KSTACK_HOST_INVARIANT_REFERENCE_MISMATCH');";

function extractReferenceBindingGuard(source, body) {
  const called = replaceUnique(source, REFERENCE_BINDING_GUARD,
    '  probeReferenceBinding(validated, value, digest, sourceSchemaSetDigest);', 'reference-binding guard');
  return replaceUnique(called, 'function resolveBoundArtifact(',
    `const PROBE_TAG = 'probe', probeReferenceBinding = ${body};\n\nfunction resolveBoundArtifact(`, 'resolveBoundArtifact declaration');
}

test('a hashed guard extracted into a comma-list helper is reported as undisclosed', async () => {
  const source = hostContractSource();
  const live = extractReferenceBindingGuard(source,
    `(validated, value, digest, sourceSchemaSetDigest) => {\n${REFERENCE_BINDING_GUARD}\n}`);
  const neutered = extractReferenceBindingGuard(source, '() => {}');

  for (const [label, mutated] of [['guard still live', live], ['guard neutered', neutered]]) {
    assert.equal(roundFiveLineAnchoredNames(mutated).has('probeReferenceBinding'), false,
      `${label}: the retired extractor was supposed to miss this helper`);
    assert.equal(moduleScopeNames(mutated).has('probeReferenceBinding'), true,
      `${label}: the depth-0 scanner must see the extracted helper`);
  }

  // End to end: load the mutated build and run the real enumeration against its
  // own hashed closures. The helper must surface as reachable-but-undisclosed,
  // which is the assertion the enumeration test above makes.
  await withMutatedHostContract(live, async (mutatedPath) => {
    const mod = await import(pathToFileURL(mutatedPath).href);
    const hashed = new Set(mod.HOST_INVARIANT_HASHED_CONSTANTS);
    for (const closure of Object.values(mod.HOST_INVARIANT_IMPLEMENTATIONS)) {
      for (const implementation of closure) hashed.add(declaredImplementationName(implementation));
    }
    const covered = new Set([...hashed, ...mod.HOST_INVARIANT_CLOSURE_EXCLUSIONS]);
    const undisclosed = enumerateFreeModuleNames(moduleScopeNames(live), covered, mod.HOST_INVARIANT_IMPLEMENTATIONS);
    assert.deepEqual([...undisclosed.keys()], ['probeReferenceBinding']);
    assert.deepEqual([...undisclosed.get('probeReferenceBinding')], ['resolveBoundArtifact']);
    // And the retired extractor's module scope would have reported nothing.
    assert.deepEqual(
      [...enumerateFreeModuleNames(roundFiveLineAnchoredNames(live), covered, mod.HOST_INVARIANT_IMPLEMENTATIONS).keys()], []);
  });
});

// --- the extraction-bypass class, closed by the whole-module digest ----------
// Both reviews that rejected this mechanism built the same attack in two steps:
// (1) lift a guard out of a hashed function into an unhashed module-scope
// helper and re-attest, which looks like a refactor and changes no behavior;
// (2) neuter the helper, which changes behavior and — before this round — moved
// no digest at all. Step 2 is the bypass, so step 2 is what these assert on,
// measured from the re-attested build rather than from pristine source.
//
// r6's form is deliberately included in a shape the scanner still cannot see
// (`var` inside a block is module-scoped, but the keyword is not at depth 0).
// That it passes anyway is the point: the digest no longer depends on the
// scanner seeing anything.
const EVIDENCE_TIME_ELIGIBILITY_GUARD =
  "  if (name === 'OperationEligibilityV1' && value.evaluatedAt >= value.expiresAt) fail('KSTACK_HOST_INVARIANT_EVIDENCE_TIME_V1');";

function extractEvidenceTimeGuardIntoBlockVar(source, body) {
  const called = replaceUnique(source, EVIDENCE_TIME_ELIGIBILITY_GUARD,
    '  probeEvidenceTime(name, value);', 'evidence-time eligibility guard');
  return replaceUnique(called, 'function checkEvidenceTimeV1(',
    `{ var probeEvidenceTime = ${body}; }\n\nfunction checkEvidenceTimeV1(`, 'checkEvidenceTimeV1 declaration');
}

async function digestsOfBuild(source) {
  return withMutatedHostContract(source, async (mutatedPath) => ({
    ...(await import(pathToFileURL(mutatedPath).href)).HOST_INVARIANT_IMPLEMENTATION_DIGESTS
  }));
}

test('neutering a guard extracted into an unhashed module-scope helper re-attests all eleven digests', async () => {
  const source = hostContractSource();
  const cases = [
    ['r5 comma-list const declarator (resolveBoundArtifact reference binding)',
      extractReferenceBindingGuard(source,
        `(validated, value, digest, sourceSchemaSetDigest) => {\n${REFERENCE_BINDING_GUARD}\n}`),
      extractReferenceBindingGuard(source, '() => {}')],
    ['r6 var inside a block (checkEvidenceTimeV1 OperationEligibilityV1 guard)',
      extractEvidenceTimeGuardIntoBlockVar(source, `(name, value) => {\n${EVIDENCE_TIME_ELIGIBILITY_GUARD}\n}`),
      extractEvidenceTimeGuardIntoBlockVar(source, '(name, value) => {}')]
  ];

  for (const [label, extracted, neutered] of cases) {
    const attested = await digestsOfBuild(extracted);
    const bypassed = await digestsOfBuild(neutered);
    const stayed = REQUIRED_INVARIANT_IDS.filter((invariantId) => attested[invariantId] === bypassed[invariantId]);
    assert.deepEqual(stayed, [],
      `${label}: neutering the extracted helper must re-attest every digest; ${stayed.length} of ${REQUIRED_INVARIANT_IDS.length} did not move`);
  }

  // Honest about the residual: the scanner still cannot see r6's declaration
  // form. That is now a disclosure gap and nothing more — the assertion above
  // holds regardless of what the scanner sees.
  const blockVar = extractEvidenceTimeGuardIntoBlockVar(source, '(name, value) => {}');
  assert.equal(moduleScopeNames(blockVar).has('probeEvidenceTime'), false,
    'if the scanner has learned this form, say so here rather than leaving a stale claim');
  assert.deepEqual(scanModuleBindings(blockVar).unattributed, [],
    'r6 form is silent to the accounting too — this is the gap the whole-module digest makes irrelevant');
});

// --- behavioral coverage for disclosed and hashed guards ---------------------
// r5's second finding: the disclosure comment claimed every excluded name was
// "held by the regression suite", and five guards inside disclosed functions
// were in fact deletable with 0/11 digest movement and the whole suite green.
// r5's `materialFindings` added that 20 of 43 fail() guards inside HASHED
// functions had no behavioral coverage either — protected only by digest
// movement, which is exactly the raw material an extraction attack converts
// into a silent bypass. These tests make each named guard fire for real.

test('the closure gate rejects an invariant whose declared vector is unpublished or failing', () => {
  const fixture = historicalFixture();
  assert.equal(resolveHistoricalArtifact(fixture.artifactBytes, fixture.options).outcome, 'VALID');
  // Branch 1: the vector the registry declares is not in the published set.
  const unpublished = historicalFixture(undefined, ['absent']);
  assert.deepEqual(pick(resolveHistoricalArtifact(unpublished.artifactBytes, { ...unpublished.options, passingVectorIds: ['absent', 'basic'] })), {
    outcome: 'UNAVAILABLE', reasonCode: 'KSTACK_HOST_INVARIANT_VECTOR_UNAVAILABLE'
  });
  // Branch 2: the vector is published but is not among the passing ones.
  assert.deepEqual(pick(resolveHistoricalArtifact(fixture.artifactBytes, { ...fixture.options, passingVectorIds: [] })), {
    outcome: 'UNAVAILABLE', reasonCode: 'KSTACK_HOST_INVARIANT_VECTOR_UNAVAILABLE'
  });
});

test('closure bytes are only read through a real object store returning real bytes', () => {
  const fixture = historicalFixture();
  for (const store of [undefined, null, {}, new Map()]) {
    assert.deepEqual(pick(resolveHistoricalArtifact(fixture.artifactBytes, { ...fixture.options, getObject: store })), {
      outcome: 'INVALID', reasonCode: 'KSTACK_HOST_OBJECT_STORE_REQUIRED'
    }, String(store));
  }
  for (const value of ['not bytes', 42, [1, 2, 3], { byteLength: 3 }, null]) {
    assert.deepEqual(pick(resolveHistoricalArtifact(fixture.artifactBytes, { ...fixture.options, getObject: () => value })), {
      outcome: 'UNAVAILABLE', reasonCode: 'KSTACK_HOST_CLOSURE_UNAVAILABLE'
    }, JSON.stringify(value));
  }
  // A Uint8Array that is not a Buffer is the one non-Buffer form that IS bytes.
  const backing = new Map([...fixture.store].map(([key, value]) => [key, new Uint8Array(value)]));
  assert.equal(resolveHistoricalArtifact(fixture.artifactBytes, { ...fixture.options, getObject: (key) => backing.get(key) }).outcome, 'VALID');
});

test('bootstrap validation rejects an unregistered bootstrap schema name', () => {
  for (const name of ['NotABootstrapSchemaV1', 'OperationRequestV1', '', 'KStackClosedMetaschemaV2']) {
    code('KSTACK_HOST_BOOTSTRAP_SCHEMA_UNKNOWN', () => validateHostBootstrap(name, {}));
  }
  // A name inherited from Object.prototype reads truthy off the frozen schema
  // and identity tables, so it slips past this guard specifically — but it is
  // still rejected downstream rather than validated. Recorded as behavior, not
  // repaired here: the guard fails closed either way, and changing it would
  // move an error code this round is not authorised to change.
  for (const name of ['toString', 'constructor', 'valueOf']) {
    assert.throws(() => validateHostBootstrap(name, {}), (error) => typeof error?.code === 'string' && error.code.startsWith('KSTACK_HOST_'), name);
  }
});

test('bootstrap validation rejects a nested record type that no record table declares', async () => {
  // The nested-type guard in validateHostBootstrap's own validation context is
  // unreachable from any input: `typeName` comes from the frozen bootstrap
  // schema tables, never from the value. It is a build-integrity guard, so a
  // mutated copy whose bootstrap schema references an undeclared record type is
  // the only way to make it fire — and it must fire, not resolve to something.
  const source = replaceUnique(hostContractSource(), "resourceLimits: ref('ResourceLimitsV1')",
    "resourceLimits: ref('ResourceLimitsAbsentV1')", 'metaschema resourceLimits ref');
  await withMutatedHostContract(source, async (mutatedPath) => {
    const mod = await import(pathToFileURL(mutatedPath).href);
    code('KSTACK_HOST_SCHEMA_UNKNOWN', () => mod.validateHostBootstrap('KStackClosedMetaschemaV1', metaschemaValue()));
  });
  // The same value validates on the unmutated build, so the failure above is
  // the nested-type guard and not a malformed fixture.
  assert.match(validateHostBootstrap('KStackClosedMetaschemaV1', metaschemaValue()).objectDigest, /^sha256:/u);
});

test('a bound reference must resolve to the addressed object of the addressing schema set', () => {
  const profile = requirementProfile();
  const profileDigest = validateHostArtifact('OperationRequirementProfileV1', profile, { vocabulary }).objectDigest;
  const eligibility = eligibilityFor(profileDigest);
  const honest = { vocabulary, resolveArtifact: (key) => (key === profileDigest ? profile : undefined) };
  assert.match(validateHostArtifactContext('OperationEligibilityV1', eligibility, honest).objectDigest, /^sha256:/u);

  // Sub-clause 1: a hostile resolver substitutes a DIFFERENTLY ADDRESSED but
  // otherwise entirely valid profile. This is r5's live bypass, as behavior.
  const substituted = requirementProfile(digest('f'), { operationSchemaDigest: digest('9') });
  assert.notEqual(validateHostArtifact('OperationRequirementProfileV1', substituted, { vocabulary }).objectDigest, profileDigest);
  code('KSTACK_HOST_INVARIANT_REFERENCE_MISMATCH', () => validateHostArtifactContext('OperationEligibilityV1', eligibility, {
    ...honest, resolveArtifact: () => substituted
  }));
  // Sub-clause 2: correctly addressed, but minted under a different schema set.
  const foreign = requirementProfile(digest('e'));
  const foreignEligibility = { ...eligibility, requirementProfileDigest: validateHostArtifact('OperationRequirementProfileV1', foreign, { vocabulary }).objectDigest };
  code('KSTACK_HOST_INVARIANT_REFERENCE_MISMATCH', () => validateHostArtifactContext('OperationEligibilityV1', foreignEligibility, {
    ...honest, resolveArtifact: () => foreign
  }));
  // And the two guards that stand in front of the binding check.
  code('KSTACK_HOST_INVARIANT_CONTEXT_REQUIRED', () => validateHostArtifactContext('OperationEligibilityV1', eligibility, { vocabulary }));
  for (const absent of [undefined, null, 'a string', 7]) {
    code('KSTACK_HOST_INVARIANT_REFERENCE_UNAVAILABLE', () => validateHostArtifactContext('OperationEligibilityV1', eligibility, {
      ...honest, resolveArtifact: () => absent
    }));
  }
});

test('contextual eligibility binds the resolved profile to its own operation', () => {
  const wideVocabulary = { ...vocabulary, operationIds: ['inspect', 'other'] };
  const profile = requirementProfile(digest('f'), { operationId: 'other' });
  const profileDigest = validateHostArtifact('OperationRequirementProfileV1', profile, { vocabulary: wideVocabulary }).objectDigest;
  const eligibility = eligibilityFor(profileDigest);
  // The partition still matches exactly, so only the operation binding can be
  // what rejects this — the guard r5 named as uncovered.
  code('KSTACK_HOST_INVARIANT_ELIGIBILITY_PARTITION_V1', () => validateHostArtifactContext('OperationEligibilityV1', eligibility, {
    vocabulary: wideVocabulary, resolveArtifact: () => profile
  }));
  const matching = requirementProfile();
  assert.match(validateHostArtifactContext('OperationEligibilityV1', {
    ...eligibility, requirementProfileDigest: validateHostArtifact('OperationRequirementProfileV1', matching, { vocabulary }).objectDigest
  }, { vocabulary: wideVocabulary, resolveArtifact: () => matching }).objectDigest, /^sha256:/u);
});

test('structural eligibility pairs degraded status with an alternate and keeps the partition disjoint', () => {
  const base = eligibilityFor(digest('7'));
  assert.match(validateHostArtifact('OperationEligibilityV1', base, { vocabulary }).objectDigest, /^sha256:/u);
  // Degraded status and a named alternate profile are one fact, in both
  // directions: neither may appear without the other.
  code('KSTACK_HOST_INVARIANT_ELIGIBILITY_PARTITION_V1', () => validateHostArtifact('OperationEligibilityV1', {
    ...base, status: 'DEGRADED_REGISTERED', alternateProfileId: null
  }, { vocabulary }));
  for (const status of ['FULL', 'UNSUPPORTED', 'QUARANTINED']) {
    code('KSTACK_HOST_INVARIANT_ELIGIBILITY_PARTITION_V1', () => validateHostArtifact('OperationEligibilityV1', {
      ...base, status, alternateProfileId: 'read-safe'
    }, { vocabulary }));
    assert.match(validateHostArtifact('OperationEligibilityV1', {
      ...base, status, alternateProfileId: null
    }, { vocabulary }).objectDigest, /^sha256:/u, status);
  }
  // Proven and missing are a partition, so they may not intersect.
  code('KSTACK_HOST_INVARIANT_ELIGIBILITY_PARTITION_V1', () => validateHostArtifact('OperationEligibilityV1', {
    ...base, provenCapabilityIds: ['file-read', 'text-search'], missingCapabilityIds: ['text-search']
  }, { vocabulary }));
});

test('contextual validation rejects an artifact no registered invariant claims', () => {
  const offer = {
    ...artifactHead('SchemaOfferV1', digest('f')), hostInstanceDigest: digest('a'), schemaSetDigests: [digest('b')],
    resolverSetDigests: [digest('c')], operationProfileDigests: [], offeredAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-08-28T12:10:00.000Z'
  };
  // Structurally valid — so the rejection below is the applicability guard.
  assert.match(validateHostArtifact('SchemaOfferV1', offer, { vocabulary }).objectDigest, /^sha256:/u);
  code('KSTACK_HOST_INVARIANT_CONTEXT_NOT_APPLICABLE', () => validateHostArtifactContext('SchemaOfferV1', offer, { vocabulary }));
  code('KSTACK_HOST_INVARIANT_CONTEXT_NOT_APPLICABLE', () => validateHostArtifactContext('ActivationRecordV1', {
    ...artifactHead('ActivationRecordV1', digest('f')), candidateActiveSetDigest: digest('a'), priorActiveSetDigest: digest('b'),
    compatibilityEntryDigest: digest('c'), migrationEvidenceDigest: digest('d'), rollbackEvidenceDigest: digest('e'),
    state: 'STAGED', reasonCodes: ['none'], createdAt: '2026-08-28T12:00:00.000Z', decidedAt: null
  }, { vocabulary }));
});

// --- closure content-addressing (repair-r2 §5) -------------------------------

// `extraCapabilityIds` widens exactly one vocabulary collection. That is chosen
// deliberately: it changes the schema set as a whole (and so its digest) while
// leaving the kstack.operation-result.v1 leaf schema byte-identical, so a
// substituted schema set still satisfies the caller's expectedSchemaDigest
// binding check and the ONLY thing standing between it and acceptance is
// `loadBootstrap`'s digest-to-content comparison.
function closureFamilies(extraCapabilityIds = []) {
  const keywords = ['$ref', 'additionalProperties', 'const', 'enum', 'items', 'maxItems', 'maxLength', 'maximum', 'minItems', 'minLength', 'minimum', 'oneOf', 'pattern', 'properties', 'required', 'type', 'x-kstack-collection'];
  const metaschema = {
    schemaId: 'kstack.closed-metaschema.v1', schemaVersion: 1, schemaLanguageVersion: 'kstack-closed-schema-v1', permittedKeywords: keywords,
    regexGrammarDigest: digest('a'), collectionGrammarDigest: digest('b'), resourceLimits: {
      maxDocumentBytes: 1048576, maxDepth: 32, maxObjectProperties: 64, maxArrayItems: 1024, maxStringUtf8Bytes: 16384,
      maxSchemas: 256, maxRefEdges: 2048, maxPatternBytes: 256, maxPatternDfaStates: 4096
    }
  };
  const canonicalizationProfile = {
    schemaId: 'kstack.canonicalization-profile.v1', schemaVersion: 1, profileId: 'rfc8785-kstack-v1', rfc8785SpecDigest: digest('c'),
    unicodePolicy: 'VALID_SCALAR_NFC_REJECT_OTHER', numberPolicy: 'SAFE_INTEGER_CANONICAL_ONLY', timestampPolicy: 'UTC_MILLISECOND_YEAR0001_9999',
    duplicateKeyPolicy: 'REJECT_BEFORE_PARSE', collectionGrammarDigest: digest('b'), regexGrammarDigest: digest('a')
  };
  const collectionNames = {
    mediaTypes: 'media-types', operationIds: 'operation-ids', operationClassIds: 'operation-class-ids', capabilityIds: 'capability-ids',
    fixtureIds: 'fixture-ids', reasonCodes: 'reason-codes', errorCodes: 'error-codes', operationProfileIds: 'operation-profile-ids',
    componentRoles: 'component-roles', receiptKinds: 'receipt-kinds', quarantineSubjectTypes: 'quarantine-subject-types'
  };
  const tupleSort = (left, right) => left.length - right.length || Buffer.compare(Buffer.from(left), Buffer.from(right));
  const collections = Object.entries(collectionNames).map(([name, collectionId]) => ({
    collectionId,
    entries: [...vocabulary[name], ...(name === 'capabilityIds' ? extraCapabilityIds : [])].sort(tupleSort).map((id) => ({ id }))
  })).sort((left, right) => tupleSort(left.collectionId, right.collectionId));
  const vocabularyRegistry = { schemaId: 'kstack.closed-vocabulary-registry.v1', schemaVersion: 1, registryId: 'base', collections };
  const invariantRegistry = {
    schemaId: 'kstack.invariant-registry.v1', schemaVersion: 1, registryId: 'base', entries: REQUIRED_INVARIANT_IDS.map((invariantId) => ({
      invariantId, implementationDigest: HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
      applicableSchemaIds: HOST_INVARIANT_APPLICABLE_SCHEMAS[invariantId], vectorIds: ['basic']
    }))
  };
  const vectorSet = {
    schemaId: 'kstack.cross-runtime-vector-set.v1', schemaVersion: 1, vectorSetId: 'base', entries: [{
      vectorId: 'basic', operationId: 'inspect', inputBytesDigest: digest('d'), expectedOutcome: 'ACCEPT',
      expectedCanonicalBytesDigest: null, expectedObjectDigest: null
    }]
  };
  const resolverImplementationDigest = digest('e');
  const resolverSet = {
    schemaId: 'kstack.historical-resolver-set.v1', schemaVersion: 1, resolverSetId: 'base', entries: [{
      resolverId: 'builtin', schemaLanguageVersion: 'kstack-closed-schema-v1', implementationDigest: resolverImplementationDigest,
      supportedMetaschemaDigests: [validateHostBootstrap('KStackClosedMetaschemaV1', metaschema).objectDigest],
      supportedCanonicalizationProfileDigests: [validateHostBootstrap('CanonicalizationProfileV1', canonicalizationProfile).objectDigest],
      invariantRegistryDigests: [validateHostBootstrap('InvariantRegistryV1', invariantRegistry).objectDigest],
      vectorSetDigest: validateHostBootstrap('CrossRuntimeVectorSetV1', vectorSet).objectDigest
    }]
  };
  return {
    bootstrap: { metaschema, canonicalizationProfile, vocabularyRegistry, invariantRegistry, resolverSet, vectorSet },
    resolverImplementationDigest
  };
}

function closureUnderTest(extraCapabilityIds = []) {
  const families = closureFamilies(extraCapabilityIds);
  const closure = constructHostContractClosure(families.bootstrap);
  const operationResult = {
    ...artifactHead('OperationResultV1', closure.schemaSetDigest), requestDigest: digest('1'), operationId: 'inspect', activeSetDigest: digest('2'),
    status: 'SUCCEEDED', startedAt: '2026-08-28T12:00:00.000Z', completedAt: '2026-08-28T12:00:01.000Z', outputs: [],
    errorDigest: null, receiptProfileDigest: digest('3')
  };
  const resolve = (getObject) => resolveHistoricalArtifact(hostCanonicalBytes(operationResult), {
    getObject,
    installedResolverDigests: [families.resolverImplementationDigest],
    installedInvariantDigests: Object.values(HOST_INVARIANT_IMPLEMENTATION_DIGESTS),
    passingVectorIds: ['basic'],
    expectedSchemaDigest: closure.schemaDigests['kstack.operation-result.v1']
  });
  return { families, closure, operationResult, resolve };
}

test('closure content-addressing rejects substituted bootstrap and schema bytes as UNAVAILABLE', () => {
  const genuine = closureUnderTest();
  assert.deepEqual(
    { outcome: genuine.resolve(genuine.closure.getObject).outcome, reasonCode: genuine.resolve(genuine.closure.getObject).reasonCode },
    { outcome: 'VALID', reasonCode: 'KSTACK_HOST_ARTIFACT_VALID' }
  );

  // Raise site 1: `loadBootstrap`'s digest-to-content binding, the only thing
  // that binds a closure address to the closure it actually names. The store is
  // caller-supplied, so model it as hostile: it serves a SECOND, entirely
  // genuine and self-consistent closure — every bootstrap family of it valid on
  // its own — under the FIRST closure's schemaSetDigest. The substitute is built
  // over a widened capability vocabulary, which leaves the operation-result leaf
  // schema byte-identical, so the caller's expectedSchemaDigest binding check at
  // the top of resolveHistoricalArtifact still passes. With the digest
  // comparison in place this is UNAVAILABLE/KSTACK_HOST_CLOSURE_DIGEST_MISMATCH;
  // deleting that one line makes the identical call return
  // VALID/KSTACK_HOST_ARTIFACT_VALID (verified against a scratch mutant), which
  // is the substituted-closure fail-open r4 proved live at HEAD.
  const substitute = closureUnderTest(['zz-extra-capability']);
  assert.notEqual(substitute.closure.schemaSetDigest, genuine.closure.schemaSetDigest);
  assert.equal(
    substitute.closure.schemaDigests['kstack.operation-result.v1'],
    genuine.closure.schemaDigests['kstack.operation-result.v1'],
    'the substituted closure must keep the addressed leaf schema, or a later check rejects it first'
  );
  const substituteSchemaSetBytes = substitute.closure.getObject(substitute.closure.schemaSetDigest);
  assert.equal(
    validateHostBootstrap('HostContractSchemaSetV1', parseHostCanonicalJson(substituteSchemaSetBytes)).objectDigest,
    substitute.closure.schemaSetDigest,
    'the substituted schema set must itself be valid, or the mismatch check is not what rejects it'
  );
  const hostileStore = (key) => key === genuine.closure.schemaSetDigest
    ? substituteSchemaSetBytes
    : substitute.closure.getObject(key) || genuine.closure.getObject(key);
  const substituted = genuine.resolve(hostileStore);
  assert.deepEqual({ outcome: substituted.outcome, reasonCode: substituted.reasonCode }, {
    outcome: 'UNAVAILABLE', reasonCode: 'KSTACK_HOST_CLOSURE_DIGEST_MISMATCH'
  });

  // Raise site 2: the per-leaf schema-source check inside
  // resolveHistoricalArtifact. The store serves one leaf schema the bytes of a
  // DIFFERENT genuine leaf of the same closure — canonical, compilable, and
  // not the schema the artifact under test is validated against, so nothing
  // downstream notices. Deleting this line likewise turns the call VALID.
  const tamperedLeaf = genuine.closure.schemaDigests['kstack.activation-record.v1'];
  const donorLeafBytes = genuine.closure.getObject(genuine.closure.schemaDigests['kstack.host-observation.v1']);
  assert.ok(donorLeafBytes && tamperedLeaf !== genuine.closure.schemaDigests['kstack.host-observation.v1']);
  const tampered = genuine.resolve((key) => key === tamperedLeaf ? donorLeafBytes : genuine.closure.getObject(key));
  assert.deepEqual({ outcome: tampered.outcome, reasonCode: tampered.reasonCode }, {
    outcome: 'UNAVAILABLE', reasonCode: 'KSTACK_HOST_CLOSURE_DIGEST_MISMATCH'
  });

  // The other five `loadBootstrap` call sites are bound by the same one line.
  // The vocabulary registry proves it independently of the schema set: the
  // substitute closure's registry is a genuine ClosedVocabularyRegistryV1 that
  // passes validateHostBootstrap on its own, so only the digest comparison
  // separates it from the registry this closure actually addresses.
  const registryAddress = genuine.closure.schemaSet.closedVocabularyRegistryDigest;
  const substituteRegistryBytes = substitute.closure.getObject(substitute.closure.schemaSet.closedVocabularyRegistryDigest);
  assert.notEqual(substitute.closure.schemaSet.closedVocabularyRegistryDigest, registryAddress);
  assert.match(validateHostBootstrap('ClosedVocabularyRegistryV1', parseHostCanonicalJson(substituteRegistryBytes)).objectDigest, /^sha256:/u);
  const swappedRegistry = genuine.resolve((key) => key === registryAddress ? substituteRegistryBytes : genuine.closure.getObject(key));
  assert.deepEqual({ outcome: swappedRegistry.outcome, reasonCode: swappedRegistry.reasonCode }, {
    outcome: 'UNAVAILABLE', reasonCode: 'KSTACK_HOST_CLOSURE_DIGEST_MISMATCH'
  });
});

test('closed vocabulary registries are validated before they become a validation vocabulary', () => {
  const badRegistry = {
    schemaId: 'kstack.closed-vocabulary-registry.v1', schemaVersion: 1, registryId: 'base',
    collections: [{ collectionId: 'media-types', entries: [{ id: 'Not A Registry Id' }] }]
  };
  // The exported construction primitive itself: this is the only call site where
  // `vocabularyFromRegistry`'s own validateHostBootstrap call is load-bearing.
  code('KSTACK_HOST_REGISTRY_ID_INVALID', () => vocabularyFromRegistry(badRegistry));

  // The construction path rejects it too — belt and braces, though here
  // `constructHostContractClosure` has already validated the registry in its own
  // bootstrap sweep before `vocabularyFromRegistry` is reached.
  const { bootstrap } = closureFamilies();
  assert.throws(
    () => constructHostContractClosure({ ...bootstrap, vocabularyRegistry: badRegistry }),
    (error) => typeof error?.code === 'string' && error.code.startsWith('KSTACK_HOST_'),
    'a caller-supplied vocabulary registry that fails ClosedVocabularyRegistryV1 must not be accepted'
  );
  // ...and a well-formed registry still constructs, so the rejection above is
  // about validity, not about the construction path being broken.
  assert.match(constructHostContractClosure(bootstrap).schemaSetDigest, /^sha256:/u);
});
