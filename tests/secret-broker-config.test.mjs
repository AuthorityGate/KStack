import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  SECRET_BROKER_CONFIG_DEFINITION,
  SECRET_BROKER_CONFIG_MAX_BYTES,
  SECRET_BROKER_CONFIG_VERSION,
  DEFAULT_SECRET_BROKER_CONFIG,
  canonicalSecretBrokerConfigBytes,
  parseSecretBrokerConfig,
  projectSecretBrokerConfig,
  validateSecretBrokerConfigValue
} from '../plugins/kstack/scripts/secret-broker/config-v2.mjs';
import {
  canonicalKStackConfigV2Bytes,
  parseKStackConfigDocument
} from '../plugins/kstack/scripts/secret-broker/config-document-v2.mjs';
import { defaultConfig } from '../plugins/kstack/scripts/kstack-config.mjs';

const schemaPath = new URL('../plugins/kstack/schemas/secret-broker/v1/public-config.schema.json', import.meta.url);

test('public config schema, validator, and default share the closed contract', () => {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert.deepEqual(schema.required, SECRET_BROKER_CONFIG_DEFINITION.keys);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schemaVersion.const, SECRET_BROKER_CONFIG_VERSION);
  assert.deepEqual(schema.properties.frontEndMode.enum, SECRET_BROKER_CONFIG_DEFINITION.frontEndModes);
  assert.deepEqual(schema.properties.inventoryMode.enum, SECRET_BROKER_CONFIG_DEFINITION.inventoryModes);
  assert.deepEqual(schema.properties.desiredDevelopmentBackend.enum, SECRET_BROKER_CONFIG_DEFINITION.developmentBackends);
  assert.deepEqual(schema.properties.desiredProductionBackend.enum, SECRET_BROKER_CONFIG_DEFINITION.productionBackends);
  assert.deepEqual(schema.properties.directPathPolicy.enum, SECRET_BROKER_CONFIG_DEFINITION.directPathPolicies);
  assert.deepEqual(schema.properties.jiraRoute.enum, SECRET_BROKER_CONFIG_DEFINITION.jiraRoutes);
  assert.deepEqual(schema.properties.minimumEvidenceByEnvironment.required, Object.keys(SECRET_BROKER_CONFIG_DEFINITION.evidence));
  assert.deepEqual(
    Object.fromEntries(Object.entries(schema.properties.minimumEvidenceByEnvironment.properties).map(([key, value]) => [key, value.const])),
    SECRET_BROKER_CONFIG_DEFINITION.evidence
  );
  assert.deepEqual(validateSecretBrokerConfigValue(DEFAULT_SECRET_BROKER_CONFIG), DEFAULT_SECRET_BROKER_CONFIG);
  assert.equal(DEFAULT_SECRET_BROKER_CONFIG.enabled, false);
  assert.equal(DEFAULT_SECRET_BROKER_CONFIG.desiredDevelopmentBackend, 'NONE');
  assert.equal(DEFAULT_SECRET_BROKER_CONFIG.desiredProductionBackend, 'NONE');
  assert.equal(DEFAULT_SECRET_BROKER_CONFIG.publicQualificationRef, 'UNAVAILABLE');
  assert.equal(DEFAULT_SECRET_BROKER_CONFIG.jiraRoute, 'WSL_AUTHORITATIVE_V1');
});

test('canonical public config round trips and rejects noncanonical or duplicate-key bytes', () => {
  const bytes = canonicalSecretBrokerConfigBytes(DEFAULT_SECRET_BROKER_CONFIG);
  assert.ok(bytes.length < SECRET_BROKER_CONFIG_MAX_BYTES);
  assert.deepEqual(parseSecretBrokerConfig(bytes), DEFAULT_SECRET_BROKER_CONFIG);
  assert.throws(() => parseSecretBrokerConfig(Buffer.from(`${bytes.toString('utf8')}\n`)), (error) => error?.code === 'KSTACK_SECRET_CONFIG_ENCODING_INVALID');
  assert.throws(
    () => parseSecretBrokerConfig(Buffer.from('{"enabled":false,"enabled":true}')),
    (error) => error?.code === 'KSTACK_SECRET_CONFIG_ENCODING_INVALID'
  );
  assert.throws(
    () => parseSecretBrokerConfig(Buffer.alloc(SECRET_BROKER_CONFIG_MAX_BYTES + 1, 0x20)),
    (error) => error?.code === 'KSTACK_SECRET_CONFIG_BYTES_EXCEEDED'
  );
});

test('public config rejects unknown fields, forward versions, enums, and unsafe identifiers', () => {
  for (const candidate of [
    { ...DEFAULT_SECRET_BROKER_CONFIG, extra: true },
    { ...DEFAULT_SECRET_BROKER_CONFIG, schemaVersion: 'kstack-secret-broker-public-config-v2' },
    { ...DEFAULT_SECRET_BROKER_CONFIG, frontEndMode: 'AUTOMATIC' },
    { ...DEFAULT_SECRET_BROKER_CONFIG, desiredDevelopmentBackend: 'FILE' },
    { ...DEFAULT_SECRET_BROKER_CONFIG, desiredProductionBackend: 'VAULT' },
    { ...DEFAULT_SECRET_BROKER_CONFIG, jiraRoute: 'WINDOWS_NATIVE_V1' },
    { ...DEFAULT_SECRET_BROKER_CONFIG, brokerProfileId: '/private/path' },
    { ...DEFAULT_SECRET_BROKER_CONFIG, publicQualificationRef: 'sha256:' + 'a'.repeat(64) },
    { ...DEFAULT_SECRET_BROKER_CONFIG, minimumEvidenceByEnvironment: { ...DEFAULT_SECRET_BROKER_CONFIG.minimumEvidenceByEnvironment, production: 'DISCOVERED' } }
  ]) assert.throws(() => validateSecretBrokerConfigValue(candidate));
});

test('legacy projection is disabled and v1 cannot smuggle a broker block', () => {
  const legacy = { schemaVersion: 1, project: { name: 'synthetic' } };
  const projected = projectSecretBrokerConfig(legacy);
  assert.deepEqual(projected, DEFAULT_SECRET_BROKER_CONFIG);
  assert.notEqual(projected, DEFAULT_SECRET_BROKER_CONFIG);
  assert.equal(Object.isFrozen(projected), true);
  assert.throws(
    () => projectSecretBrokerConfig({ ...legacy, secretBroker: DEFAULT_SECRET_BROKER_CONFIG }),
    (error) => error?.code === 'KSTACK_SECRET_CONFIG_LEGACY_EXTENSION_FORBIDDEN'
  );
  assert.deepEqual(projectSecretBrokerConfig({ schemaVersion: 2, secretBroker: DEFAULT_SECRET_BROKER_CONFIG }), DEFAULT_SECRET_BROKER_CONFIG);
  assert.throws(() => projectSecretBrokerConfig({ schemaVersion: 3 }), (error) => error?.code === 'KSTACK_SECRET_CONFIG_PARENT_VERSION_UNSUPPORTED');
});

test('shared config reader separates human-formatted v1 from canonical v2 before materialization', () => {
  const legacyBytes = Buffer.from(`${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf8');
  assert.equal(parseKStackConfigDocument(legacyBytes).schemaVersion, 1);

  const duplicateLegacy = legacyBytes.toString('utf8').replace(
    '"schemaVersion": 1,',
    '"schemaVersion": 1,\n  "schemaVersion": 1,'
  );
  assert.throws(
    () => parseKStackConfigDocument(Buffer.from(duplicateLegacy)),
    (error) => error?.code === 'KSTACK_CONFIG_DUPLICATE_KEY'
  );
  assert.throws(
    () => parseKStackConfigDocument(Buffer.from(JSON.stringify({ ...defaultConfig, secretBroker: DEFAULT_SECRET_BROKER_CONFIG }))),
    (error) => error?.code === 'KSTACK_SECRET_CONFIG_LEGACY_EXTENSION_FORBIDDEN'
  );

  const v2 = { ...structuredClone(defaultConfig), schemaVersion: 2, secretBroker: structuredClone(DEFAULT_SECRET_BROKER_CONFIG) };
  const canonical = canonicalKStackConfigV2Bytes(v2);
  assert.deepEqual(parseKStackConfigDocument(canonical), v2);
  assert.throws(
    () => parseKStackConfigDocument(Buffer.from(`${JSON.stringify(v2, null, 2)}\n`)),
    (error) => error?.code === 'KSTACK_CONFIG_V2_NONCANONICAL'
  );
  assert.throws(
    () => parseKStackConfigDocument(Buffer.from(canonical.toString('utf8').replace('"schemaVersion":2', '"schemaVersion":2,"schemaVersion":2'))),
    (error) => error?.code === 'KSTACK_CONFIG_DUPLICATE_KEY'
  );
  const nestedUnknown = structuredClone(v2);
  nestedUnknown.workflow.designGate.reviewBudget.unreviewedOverride = true;
  assert.throws(
    () => canonicalKStackConfigV2Bytes(nestedUnknown),
    (error) => error?.code === 'KSTACK_CONFIG_SCHEMA_INVALID'
  );
  assert.throws(
    () => parseKStackConfigDocument(Buffer.alloc(SECRET_BROKER_CONFIG_MAX_BYTES + 1, 0x20)),
    (error) => error?.code === 'KSTACK_CONFIG_BYTES_EXCEEDED'
  );
});

test('shared config lexer rejects every bounded hostile encoding class before use', () => {
  const legacy = Buffer.from(`${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf8');
  assert.throws(
    () => parseKStackConfigDocument(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), legacy])),
    (error) => error?.code === 'KSTACK_CONFIG_BOM_FORBIDDEN'
  );
  assert.throws(
    () => parseKStackConfigDocument(Buffer.from([0x7b, 0x22, 0xc3, 0x28, 0x22, 0x3a, 0x31, 0x7d])),
    (error) => error?.code === 'KSTACK_CONFIG_UTF8_INVALID'
  );
  assert.throws(
    () => parseKStackConfigDocument(Buffer.from(`{"schemaVersion":1,"x":${'['.repeat(34)}0${']'.repeat(34)}}`)),
    (error) => error?.code === 'KSTACK_CONFIG_DEPTH_EXCEEDED'
  );
  assert.throws(
    () => parseKStackConfigDocument(Buffer.from(`{"schemaVersion":1,"x":[${Array.from({ length: 1_025 }, () => '0').join(',')}]}`)),
    (error) => error?.code === 'KSTACK_CONFIG_ARRAY_ITEMS_EXCEEDED'
  );
  assert.throws(
    () => parseKStackConfigDocument(Buffer.from(`{${Array.from({ length: 1_025 }, (_, index) => `"k${index}":0`).join(',')}}`)),
    (error) => error?.code === 'KSTACK_CONFIG_OBJECT_PROPERTIES_EXCEEDED'
  );
  assert.throws(
    () => parseKStackConfigDocument(Buffer.from(`{"schemaVersion":1,"x":"${'a'.repeat(16_385)}"}`)),
    (error) => error?.code === 'KSTACK_CONFIG_STRING_BYTES_EXCEEDED'
  );
  for (const numeral of ['9007199254740992', '-9007199254740992', '-0', '1.0', '1e2']) {
    assert.throws(
      () => parseKStackConfigDocument(Buffer.from(`{"schemaVersion":1,"x":${numeral}}`)),
      (error) => error?.code === 'KSTACK_CONFIG_JSON_NUMBER_INVALID'
    );
  }
  assert.throws(
    () => parseKStackConfigDocument(Buffer.from('{"schemaVersion":1} false')),
    (error) => error?.code === 'KSTACK_CONFIG_TRAILING_DATA'
  );
  for (const escaped of ['\\ud800', '\\udc00', '\\ud800\\u0041']) {
    assert.throws(
      () => parseKStackConfigDocument(Buffer.from(`{"schemaVersion":1,"x":"${escaped}"}`)),
      (error) => error?.code === 'KSTACK_CONFIG_JSON_SURROGATE_INVALID'
    );
  }
  assert.throws(
    () => parseKStackConfigDocument(Buffer.from('{"schemaVersion":1,"x":"é"}')),
    (error) => error?.code === 'KSTACK_CONFIG_STRING_INVALID'
  );
});
