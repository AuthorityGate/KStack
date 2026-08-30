import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  HOST_ARTIFACT_IDENTITIES,
  HOST_ARTIFACT_SCHEMAS,
  HOST_BOOTSTRAP_SCHEMA_DIGESTS,
  HOST_BOOTSTRAP_SCHEMA_DOCUMENTS,
  HOST_BOOTSTRAP_SCHEMAS,
  HOST_CONTRACT_LIMITS,
  HOST_INVARIANT_APPLICABLE_SCHEMAS,
  HOST_INVARIANT_IMPLEMENTATION_DIGESTS,
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

function historicalFixture() {
  const store = new Map();
  const putBootstrap = (name, value) => {
    const validated = validateHostBootstrap(name, value);
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
  const implementationDigests = Object.values(HOST_INVARIANT_IMPLEMENTATION_DIGESTS);
  const invariantRegistryDigest = putBootstrap('InvariantRegistryV1', {
    schemaId: 'kstack.invariant-registry.v1', schemaVersion: 1, registryId: 'base',
    entries: REQUIRED_INVARIANT_IDS.map((invariantId) => ({
      invariantId, implementationDigest: HOST_INVARIANT_IMPLEMENTATION_DIGESTS[invariantId],
      applicableSchemaIds: HOST_INVARIANT_APPLICABLE_SCHEMAS[invariantId], vectorIds: ['basic']
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
  code('KSTACK_HOST_PATTERN_DFA_LIMIT', () => compileClosedSchemaSet([{ schemaId: 'one', schema: { type: 'string', pattern: '^a{4096}$' } }]));
  code('KSTACK_HOST_COLLECTION_MEMBER_SCHEMA_INVALID', () => compileClosedSchemaSet([{ schemaId: 'one', schema: {
    type: 'array', items: { type: 'integer' }, 'x-kstack-collection': { mode: 'SET_BY_VALUE_ASCII' }
  } }]));
  code('KSTACK_HOST_COLLECTION_KEY_SCHEMA_INVALID', () => compileClosedSchemaSet([{ schemaId: 'one', schema: {
    type: 'array', items: {
      type: 'object', properties: { id: { oneOf: [{ type: 'null' }, { type: 'string' }] } }, required: ['id'], additionalProperties: false
    }, 'x-kstack-collection': { mode: 'SET_BY_FIELDS', keyFields: ['id'], keyKinds: ['ASCII'] }
  } }]));
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
