import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { hostCanonicalBytes, parseHostCanonicalJson } from '../kstack-host-contract.mjs';

export const SECRET_BROKER_RELEASE_MANIFEST_VERSION = 'kstack-secret-broker-release-manifest-v1';
export const SECRET_BROKER_SOURCE_AUDIT_VERSION = 'kstack-secret-broker-source-audit-v1';
export const SECRET_BROKER_RELEASE_MANIFEST_PATH = 'secret-broker-release-manifest-v1.json';
export const SECRET_BROKER_SOURCE_AUDIT_PATH = 'secret-broker-source-audit-manifest-v1.json';
export const SECRET_BROKER_CONTENT_PATHS = Object.freeze([
  'references/SECRET_BROKER.md',
  'schemas/secret-broker/v1/compatibility.schema.json',
  'schemas/secret-broker/v1/public-config.schema.json',
  'schemas/secret-broker/v1/public-request.schema.json',
  'schemas/secret-broker/v1/public-result.schema.json',
  'scripts/kstack-config.mjs',
  'scripts/kstack-jira-wsl-config.mjs',
  'scripts/kstack-secret-broker.mjs',
  'scripts/kstack-secret-linux.mjs',
  'scripts/secret-broker/compatibility-v1.mjs',
  'scripts/secret-broker/config-document-v2.mjs',
  'scripts/secret-broker/config-migration-v2.mjs',
  'scripts/secret-broker/config-v2.mjs',
  'scripts/secret-broker/public-v1.mjs',
  'scripts/secret-broker/release-manifest-v1.mjs',
  'scripts/secret-broker/release-provenance-v1.mjs',
  'secret-broker-accepted-design-v1.json',
  'skills/kstack-secrets/SKILL.md',
  'workers/kstack-secret-windows.ps1'
]);

const ROLES = Object.freeze({
  '.json': 'SCHEMA', '.md': 'REFERENCE', '.mjs': 'SCRIPT', '.ps1': 'WORKER'
});
const RELEASE_KEYS = Object.freeze([
  'schemaVersion', 'pluginBaseVersion', 'releaseClass', 'contentEntries',
  'contentSetDigest', 'contractDigests', 'publicConfigSchema', 'publicApiSchemas',
  'protectedRecordSchemas', 'workerProtocols', 'adapterProtocols', 'auditProtocol',
  'qualificationProtocol', 'hostCompatibilityProfiles', 'validatorArtifacts',
  'installHealthContractDigest', 'sourceAuditProfileId'
]);
const AUDIT_KEYS = Object.freeze(['schemaVersion', 'profileId', 'entries']);
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const STRICT_SEMVER = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const VALIDATOR_PATHS = Object.freeze([
  'scripts/secret-broker/compatibility-v1.mjs', 'scripts/secret-broker/config-document-v2.mjs',
  'scripts/secret-broker/config-migration-v2.mjs', 'scripts/secret-broker/config-v2.mjs',
  'scripts/secret-broker/public-v1.mjs', 'scripts/secret-broker/release-manifest-v1.mjs',
  'scripts/secret-broker/release-provenance-v1.mjs'
]);

export class SecretBrokerReleaseManifestError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SecretBrokerReleaseManifestError';
    this.code = code;
  }
}

function fail(code) { throw new SecretBrokerReleaseManifestError(code); }
function sha(bytes) { return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`; }
function compare(left, right) { return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8')); }
function exact(value, keys, code = 'KSTACK_SECRET_RELEASE_SCHEMA_INVALID') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail(code);
}
function sortedUnique(entries, selector, code) {
  for (let index = 1; index < entries.length; index += 1) if (compare(selector(entries[index - 1]), selector(entries[index])) >= 0) fail(code);
}
function contained(pluginRoot, relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || path.posix.normalize(relative) !== relative || relative.startsWith('../') || relative.startsWith('/')) fail('KSTACK_SECRET_RELEASE_PATH_INVALID');
  const absolute = path.resolve(pluginRoot, relative);
  if (!absolute.startsWith(`${path.resolve(pluginRoot)}${path.sep}`)) fail('KSTACK_SECRET_RELEASE_PATH_INVALID');
  return absolute;
}
function contentRole(relative) {
  if (relative === SECRET_BROKER_RELEASE_MANIFEST_PATH || relative === 'secret-broker-accepted-design-v1.json') return 'MANIFEST';
  if (relative.startsWith('schemas/')) return 'SCHEMA';
  if (relative.startsWith('skills/')) return 'SKILL';
  if (relative.startsWith('workers/')) return 'WORKER';
  if (relative.startsWith('scripts/')) return 'SCRIPT';
  if (relative.startsWith('references/')) return 'REFERENCE';
  return ROLES[path.extname(relative)] ?? 'MANIFEST';
}
function contentEntry(pluginRoot, relative) {
  const absolute = contained(pluginRoot, relative);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('KSTACK_SECRET_RELEASE_CONTENT_INVALID');
  const bytes = fs.readFileSync(absolute);
  return { path: relative, artifactRole: contentRole(relative), size: bytes.length, sha256: sha(bytes) };
}
function contentSetDigest(entries) {
  return `sha256:${crypto.createHash('sha256').update('KSTACK-SECRET-BROKER-CONTENT-SET-V1', 'ascii').update(Buffer.from([0])).update(hostCanonicalBytes(entries)).digest('hex')}`;
}
function contracts(pluginRoot) {
  const accepted = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'secret-broker-accepted-design-v1.json'), 'utf8'));
  const entries = accepted.acceptedItems.filter((entry) => /^SB-TC(?:0[0-9]|1[01])$/u.test(entry.itemId));
  if (entries.length !== 12) fail('KSTACK_SECRET_RELEASE_CONTRACT_SET_INVALID');
  return Object.fromEntries(entries.map((entry) => [entry.itemId, `sha256:${entry.sha256}`]));
}

export function buildSecretBrokerReleaseManifest(pluginRoot) {
  const entries = SECRET_BROKER_CONTENT_PATHS.map((relative) => contentEntry(pluginRoot, relative));
  sortedUnique(entries, (entry) => entry.path, 'KSTACK_SECRET_RELEASE_CONTENT_ORDER_INVALID');
  const packageRecord = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'package.json'), 'utf8'));
  const validators = entries.filter((entry) => VALIDATOR_PATHS.includes(entry.path)).map((entry) => ({ path: entry.path, sha256: entry.sha256 }));
  const installHealth = fs.readFileSync(path.join(pluginRoot, 'install-health-contract-v1.json'));
  return {
    schemaVersion: SECRET_BROKER_RELEASE_MANIFEST_VERSION,
    pluginBaseVersion: packageRecord.version,
    releaseClass: 'UNSIGNED_DEVELOPMENT',
    contentEntries: entries,
    contentSetDigest: contentSetDigest(entries),
    contractDigests: contracts(pluginRoot),
    publicConfigSchema: 'kstack-secret-broker-public-config-v1',
    publicApiSchemas: ['kstack-secret-broker-public-request-v1', 'kstack-secret-broker-public-result-v1'],
    protectedRecordSchemas: [],
    workerProtocols: ['kstack-secret-worker-windows-v1'],
    adapterProtocols: ['kstack-secret-linux-adapter-v1'],
    auditProtocol: 'UNAVAILABLE',
    qualificationProtocol: 'UNAVAILABLE',
    hostCompatibilityProfiles: ['linux-native', 'windows-native'],
    validatorArtifacts: validators,
    installHealthContractDigest: sha(installHealth),
    sourceAuditProfileId: 'kstack-release-audit-v2'
  };
}

function validateContentEntry(entry) {
  exact(entry, ['path', 'artifactRole', 'size', 'sha256']);
  if (typeof entry.path !== 'string' || ![...SECRET_BROKER_CONTENT_PATHS, SECRET_BROKER_RELEASE_MANIFEST_PATH].includes(entry.path)
      || entry.artifactRole !== contentRole(entry.path)
      || !Number.isSafeInteger(entry.size) || entry.size < 0 || !DIGEST.test(entry.sha256)) fail('KSTACK_SECRET_RELEASE_CONTENT_INVALID');
}

export function validateSecretBrokerReleaseManifest(value, pluginRoot = null) {
  exact(value, RELEASE_KEYS);
  if (value.schemaVersion !== SECRET_BROKER_RELEASE_MANIFEST_VERSION || !STRICT_SEMVER.test(value.pluginBaseVersion)
      || value.releaseClass !== 'UNSIGNED_DEVELOPMENT'
      || value.sourceAuditProfileId !== 'kstack-release-audit-v2' || !Array.isArray(value.contentEntries)
      || value.contentEntries.length !== SECRET_BROKER_CONTENT_PATHS.length) fail('KSTACK_SECRET_RELEASE_SCHEMA_INVALID');
  value.contentEntries.forEach(validateContentEntry);
  sortedUnique(value.contentEntries, (entry) => entry.path, 'KSTACK_SECRET_RELEASE_CONTENT_ORDER_INVALID');
  if (value.contentEntries.some((entry) => [SECRET_BROKER_RELEASE_MANIFEST_PATH, SECRET_BROKER_SOURCE_AUDIT_PATH].includes(entry.path))) fail('KSTACK_SECRET_RELEASE_CYCLE');
  if (value.contentSetDigest !== contentSetDigest(value.contentEntries)) fail('KSTACK_SECRET_RELEASE_CONTENT_DIGEST_INVALID');
  exact(value.contractDigests, Array.from({ length: 12 }, (_, index) => `SB-TC${String(index).padStart(2, '0')}`));
  if (Object.values(value.contractDigests).some((item) => !DIGEST.test(item))) fail('KSTACK_SECRET_RELEASE_CONTRACT_SET_INVALID');
  const exactArray = (actual, expected) => Array.isArray(actual) && hostCanonicalBytes(actual).equals(hostCanonicalBytes(expected));
  if (value.publicConfigSchema !== 'kstack-secret-broker-public-config-v1'
      || !exactArray(value.publicApiSchemas, ['kstack-secret-broker-public-request-v1', 'kstack-secret-broker-public-result-v1'])
      || !exactArray(value.protectedRecordSchemas, [])
      || !exactArray(value.workerProtocols, ['kstack-secret-worker-windows-v1'])
      || !exactArray(value.adapterProtocols, ['kstack-secret-linux-adapter-v1'])
      || value.auditProtocol !== 'UNAVAILABLE' || value.qualificationProtocol !== 'UNAVAILABLE'
      || !exactArray(value.hostCompatibilityProfiles, ['linux-native', 'windows-native'])
      || !DIGEST.test(value.installHealthContractDigest)
      || !Array.isArray(value.validatorArtifacts) || value.validatorArtifacts.length !== VALIDATOR_PATHS.length) {
    fail('KSTACK_SECRET_RELEASE_SEMANTICS_INVALID');
  }
  value.validatorArtifacts.forEach((entry, index) => {
    exact(entry, ['path', 'sha256']);
    const content = value.contentEntries.find((candidate) => candidate.path === entry.path);
    if (entry.path !== VALIDATOR_PATHS[index] || !content || entry.sha256 !== content.sha256) fail('KSTACK_SECRET_RELEASE_VALIDATOR_SET_INVALID');
  });
  if (pluginRoot) {
    const expected = buildSecretBrokerReleaseManifest(pluginRoot);
    if (!hostCanonicalBytes(expected).equals(hostCanonicalBytes(value))) fail('KSTACK_SECRET_RELEASE_SOURCE_DRIFT');
  }
  return value;
}

export function parseSecretBrokerReleaseManifest(input, pluginRoot = null) {
  let value;
  try { value = parseHostCanonicalJson(input); } catch { fail('KSTACK_SECRET_RELEASE_ENCODING_INVALID'); }
  return validateSecretBrokerReleaseManifest(value, pluginRoot);
}

export function buildSecretBrokerSourceAudit(pluginRoot, releaseManifestBytes) {
  const release = parseSecretBrokerReleaseManifest(releaseManifestBytes, pluginRoot);
  const releaseEntry = contentEntry(pluginRoot, SECRET_BROKER_RELEASE_MANIFEST_PATH);
  const entries = [...release.contentEntries, releaseEntry].sort((left, right) => compare(left.path, right.path));
  return { schemaVersion: SECRET_BROKER_SOURCE_AUDIT_VERSION, profileId: 'kstack-release-audit-v2', entries };
}

export function validateSecretBrokerSourceAudit(value, release, pluginRoot = null) {
  validateSecretBrokerReleaseManifest(release);
  exact(value, AUDIT_KEYS, 'KSTACK_SECRET_SOURCE_AUDIT_INVALID');
  if (value.schemaVersion !== SECRET_BROKER_SOURCE_AUDIT_VERSION || value.profileId !== 'kstack-release-audit-v2' || !Array.isArray(value.entries)) fail('KSTACK_SECRET_SOURCE_AUDIT_INVALID');
  value.entries.forEach(validateContentEntry);
  sortedUnique(value.entries, (entry) => entry.path, 'KSTACK_SECRET_SOURCE_AUDIT_INVALID');
  if (value.entries.some((entry) => entry.path === SECRET_BROKER_SOURCE_AUDIT_PATH)) fail('KSTACK_SECRET_RELEASE_CYCLE');
  const releaseEntry = value.entries.find((entry) => entry.path === SECRET_BROKER_RELEASE_MANIFEST_PATH);
  if (!releaseEntry || value.entries.length !== release.contentEntries.length + 1) fail('KSTACK_SECRET_SOURCE_AUDIT_INVALID');
  const releaseBytes = hostCanonicalBytes(release);
  const expectedReleaseEntry = {
    path: SECRET_BROKER_RELEASE_MANIFEST_PATH,
    artifactRole: 'MANIFEST',
    size: releaseBytes.length,
    sha256: sha(releaseBytes)
  };
  if (!hostCanonicalBytes(releaseEntry).equals(hostCanonicalBytes(expectedReleaseEntry))) fail('KSTACK_SECRET_SOURCE_AUDIT_RELEASE_BINDING_INVALID');
  for (const entry of release.contentEntries) {
    const audited = value.entries.find((candidate) => candidate.path === entry.path);
    if (!audited || !hostCanonicalBytes(audited).equals(hostCanonicalBytes(entry))) fail('KSTACK_SECRET_SOURCE_AUDIT_CLOSURE_INVALID');
  }
  if (pluginRoot) for (const entry of value.entries) {
    if (!hostCanonicalBytes(contentEntry(pluginRoot, entry.path)).equals(hostCanonicalBytes(entry))) fail('KSTACK_SECRET_SOURCE_AUDIT_SOURCE_DRIFT');
  }
  return value;
}

export function manifestDigest(value) { return sha(hostCanonicalBytes(value)); }
