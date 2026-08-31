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
