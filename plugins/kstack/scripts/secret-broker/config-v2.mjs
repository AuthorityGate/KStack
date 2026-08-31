import { hostCanonicalBytes, parseHostCanonicalJson } from '../kstack-host-contract.mjs';
import { validateOpaqueRef, validateRegistryId } from './public-v1.mjs';

export const SECRET_BROKER_CONFIG_MAX_BYTES = 65_536;
export const SECRET_BROKER_CONFIG_VERSION = 'kstack-secret-broker-public-config-v1';

export const SECRET_BROKER_CONFIG_DEFINITION = deepFreeze({
  keys: [
    'schemaVersion', 'enabled', 'frontEndMode', 'portfolioPolicyId',
    'brokerProfileId', 'inventoryMode', 'desiredDevelopmentBackend',
    'desiredProductionBackend', 'minimumEvidenceByEnvironment',
    'directPathPolicy', 'jiraRoute', 'publicCompatibilityProfileId',
    'publicQualificationRef'
  ],
  frontEndModes: ['EXPLICIT_ONLY'],
  inventoryModes: ['OWNER_SUPPLIED_SAFE_METADATA_ONLY'],
  developmentBackends: ['NONE', 'OS_LOCAL'],
  productionBackends: ['NONE', 'OPENBAO'],
  evidence: {
    development: 'SYNTHETIC_QUALIFIED',
    pilot: 'PILOT_VALIDATED',
    production: 'PRODUCTION_APPROVED'
  },
  directPathPolicies: ['REGISTERED_DENY_V1'],
  jiraRoutes: ['WSL_AUTHORITATIVE_V1']
});

export const DEFAULT_SECRET_BROKER_CONFIG = deepFreeze({
  schemaVersion: SECRET_BROKER_CONFIG_VERSION,
  enabled: false,
  frontEndMode: 'EXPLICIT_ONLY',
  portfolioPolicyId: 'secret-portfolio-disabled',
  brokerProfileId: 'secret-broker-disabled',
  inventoryMode: 'OWNER_SUPPLIED_SAFE_METADATA_ONLY',
  desiredDevelopmentBackend: 'NONE',
  desiredProductionBackend: 'NONE',
  minimumEvidenceByEnvironment: {
    development: 'SYNTHETIC_QUALIFIED',
    pilot: 'PILOT_VALIDATED',
    production: 'PRODUCTION_APPROVED'
  },
  directPathPolicy: 'REGISTERED_DENY_V1',
  jiraRoute: 'WSL_AUTHORITATIVE_V1',
  publicCompatibilityProfileId: 'secret-public-v1',
  publicQualificationRef: 'UNAVAILABLE'
});

export class SecretBrokerConfigError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SecretBrokerConfigError';
    this.code = code;
  }
}

function fail(code) { throw new SecretBrokerConfigError(code); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function deepFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze));
  if (plain(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepFreeze(item)])));
  return value;
}
function copy(value) { return parseHostCanonicalJson(hostCanonicalBytes(value)); }
function oneOf(value, members) { if (typeof value !== 'string' || !members.includes(value)) fail('KSTACK_SECRET_CONFIG_SCHEMA_INVALID'); }

export function validateSecretBrokerConfigValue(value) {
  if (!plain(value)) fail('KSTACK_SECRET_CONFIG_SCHEMA_INVALID');
  const keys = Object.keys(value);
  if (keys.length !== SECRET_BROKER_CONFIG_DEFINITION.keys.length
      || SECRET_BROKER_CONFIG_DEFINITION.keys.some((key) => !Object.hasOwn(value, key))
      || keys.some((key) => !SECRET_BROKER_CONFIG_DEFINITION.keys.includes(key))) fail('KSTACK_SECRET_CONFIG_SCHEMA_INVALID');
  if (value.schemaVersion !== SECRET_BROKER_CONFIG_VERSION) fail('KSTACK_SECRET_CONFIG_VERSION_UNSUPPORTED');
  if (typeof value.enabled !== 'boolean') fail('KSTACK_SECRET_CONFIG_SCHEMA_INVALID');
  oneOf(value.frontEndMode, SECRET_BROKER_CONFIG_DEFINITION.frontEndModes);
  oneOf(value.inventoryMode, SECRET_BROKER_CONFIG_DEFINITION.inventoryModes);
  oneOf(value.desiredDevelopmentBackend, SECRET_BROKER_CONFIG_DEFINITION.developmentBackends);
  oneOf(value.desiredProductionBackend, SECRET_BROKER_CONFIG_DEFINITION.productionBackends);
  oneOf(value.directPathPolicy, SECRET_BROKER_CONFIG_DEFINITION.directPathPolicies);
  oneOf(value.jiraRoute, SECRET_BROKER_CONFIG_DEFINITION.jiraRoutes);
  for (const field of ['portfolioPolicyId', 'brokerProfileId', 'publicCompatibilityProfileId']) {
    try { validateRegistryId(value[field]); } catch { fail('KSTACK_SECRET_CONFIG_SCHEMA_INVALID'); }
  }
  const evidence = value.minimumEvidenceByEnvironment;
  if (!plain(evidence) || Object.keys(evidence).length !== 3
      || Object.entries(SECRET_BROKER_CONFIG_DEFINITION.evidence).some(([key, expected]) => evidence[key] !== expected)
      || Object.keys(evidence).some((key) => !Object.hasOwn(SECRET_BROKER_CONFIG_DEFINITION.evidence, key))) fail('KSTACK_SECRET_CONFIG_SCHEMA_INVALID');
  if (value.publicQualificationRef !== 'UNAVAILABLE') {
    try { validateOpaqueRef(value.publicQualificationRef); } catch { fail('KSTACK_SECRET_CONFIG_SCHEMA_INVALID'); }
  }
  const checked = deepFreeze(copy(value));
  if (hostCanonicalBytes(checked).length > SECRET_BROKER_CONFIG_MAX_BYTES) fail('KSTACK_SECRET_CONFIG_BYTES_EXCEEDED');
  return checked;
}

export function parseSecretBrokerConfig(input) {
  const bytes = Buffer.isBuffer(input) ? input : input instanceof Uint8Array ? Buffer.from(input) : null;
  if (!bytes || bytes.length < 2) fail('KSTACK_SECRET_CONFIG_INPUT_INVALID');
  if (bytes.length > SECRET_BROKER_CONFIG_MAX_BYTES) fail('KSTACK_SECRET_CONFIG_BYTES_EXCEEDED');
  let value;
  try { value = parseHostCanonicalJson(bytes); } catch { fail('KSTACK_SECRET_CONFIG_ENCODING_INVALID'); }
  return validateSecretBrokerConfigValue(value);
}

export function canonicalSecretBrokerConfigBytes(value) {
  const bytes = hostCanonicalBytes(validateSecretBrokerConfigValue(value));
  if (bytes.length > SECRET_BROKER_CONFIG_MAX_BYTES) fail('KSTACK_SECRET_CONFIG_BYTES_EXCEEDED');
  return bytes;
}

export function projectSecretBrokerConfig(config) {
  if (!plain(config)) fail('KSTACK_SECRET_CONFIG_PARENT_INVALID');
  if (config.schemaVersion === 1) {
    if (Object.hasOwn(config, 'secretBroker')) fail('KSTACK_SECRET_CONFIG_LEGACY_EXTENSION_FORBIDDEN');
    return deepFreeze(copy(DEFAULT_SECRET_BROKER_CONFIG));
  }
  if (config.schemaVersion === 2) {
    if (!Object.hasOwn(config, 'secretBroker')) fail('KSTACK_SECRET_CONFIG_SCHEMA_INVALID');
    return validateSecretBrokerConfigValue(config.secretBroker);
  }
  fail('KSTACK_SECRET_CONFIG_PARENT_VERSION_UNSUPPORTED');
}
