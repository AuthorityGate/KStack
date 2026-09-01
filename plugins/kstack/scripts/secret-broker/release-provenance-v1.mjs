import crypto from 'node:crypto';

import { hostCanonicalBytes, parseHostCanonicalJson } from '../kstack-host-contract.mjs';

export const RELEASE_PUBLICATION_VERSION = 'kstack-release-publication-v1';
export const RELEASE_AUTHORITY_ROOT_VERSION = 'kstack-release-authority-root-v1';
export const RELEASE_ROLES = Object.freeze(['RELEASE_BUILDER', 'RELEASE_PUBLISHER', 'RELEASE_SECURITY_APPROVER']);
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const PUBLICATION_KEYS = Object.freeze([
  'schemaVersion', 'pluginBaseVersion', 'sourceRevisionDigest', 'sourceTreeDigest',
  'buildToolchainDigest', 'releaseManifestDigest', 'sourceAuditManifestDigest',
  'releaseAuthorityPolicyEpoch', 'releaseAuthorityPolicyDigest', 'publishedAt', 'signatures'
]);
const SIGNATURE_KEYS = Object.freeze(['role', 'principalRef', 'signatureBase64']);
const ROOT_KEYS = Object.freeze(['schemaVersion', 'policyEpoch', 'principals']);
const PRINCIPAL_KEYS = Object.freeze(['principalRef', 'role', 'publicKeySpkiBase64']);
const EXPECTED_KEYS = Object.freeze([
  'pluginBaseVersion', 'releaseManifestDigest', 'sourceAuditManifestDigest',
  'authorityRootPinDigest'
]);
const STRICT_SEMVER = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export class ReleaseProvenanceError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ReleaseProvenanceError';
    this.code = code;
  }
}

function fail(code) { throw new ReleaseProvenanceError(code); }
function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail(code);
}
function compare(left, right) { return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8')); }
function digest(bytes) { return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`; }
function validDigest(value) { return typeof value === 'string' && DIGEST.test(value); }
function validPrincipal(value) { return typeof value === 'string' && /^[a-z][a-z0-9._-]{2,127}$/u.test(value); }
function strictBase64(value) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) fail('KSTACK_RELEASE_PUBLICATION_SIGNATURE_INVALID');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) fail('KSTACK_RELEASE_PUBLICATION_SIGNATURE_INVALID');
  return bytes;
}

export function validateExternalReleaseAuthorityRoot(value) {
  exact(value, ROOT_KEYS, 'KSTACK_RELEASE_AUTHORITY_ROOT_INVALID');
  if (value.schemaVersion !== RELEASE_AUTHORITY_ROOT_VERSION || !Number.isSafeInteger(value.policyEpoch) || value.policyEpoch < 1
      || !Array.isArray(value.principals) || value.principals.length !== RELEASE_ROLES.length) fail('KSTACK_RELEASE_AUTHORITY_ROOT_INVALID');
  const roles = new Set();
  const principals = new Set();
  const publicKeys = new Set();
  for (const [index, principal] of value.principals.entries()) {
    exact(principal, PRINCIPAL_KEYS, 'KSTACK_RELEASE_AUTHORITY_ROOT_INVALID');
    if (!RELEASE_ROLES.includes(principal.role) || roles.has(principal.role) || !validPrincipal(principal.principalRef)
        || principals.has(principal.principalRef) || typeof principal.publicKeySpkiBase64 !== 'string') fail('KSTACK_RELEASE_AUTHORITY_ROOT_INVALID');
    let key;
    try { key = crypto.createPublicKey({ key: strictBase64(principal.publicKeySpkiBase64), format: 'der', type: 'spki' }); }
    catch { fail('KSTACK_RELEASE_AUTHORITY_ROOT_INVALID'); }
    const canonicalKey = key.export({ format: 'der', type: 'spki' }).toString('base64');
    if (key.asymmetricKeyType !== 'ed25519' || canonicalKey !== principal.publicKeySpkiBase64 || publicKeys.has(canonicalKey)) fail('KSTACK_RELEASE_AUTHORITY_ROOT_INVALID');
    roles.add(principal.role);
    principals.add(principal.principalRef);
    publicKeys.add(canonicalKey);
    if (index > 0 && compare(value.principals[index - 1].role, principal.role) >= 0) fail('KSTACK_RELEASE_AUTHORITY_ROOT_INVALID');
  }
  if (RELEASE_ROLES.some((role) => !roles.has(role))) fail('KSTACK_RELEASE_AUTHORITY_ROOT_INVALID');
  return value;
}

export function releaseAuthorityPolicyDigest(root) {
  return digest(hostCanonicalBytes(validateExternalReleaseAuthorityRoot(root)));
}

function publicationBody(value) {
  const { signatures: _signatures, ...body } = value;
  return body;
}

export function releasePublicationSigningBytes(value) {
  return Buffer.concat([
    Buffer.from('KSTACK-RELEASE-PUBLICATION-V1', 'ascii'), Buffer.from([0]),
    hostCanonicalBytes(publicationBody(value))
  ]);
}

function validateExpectedBinding(value, root) {
  exact(value, EXPECTED_KEYS, 'KSTACK_RELEASE_EXPECTED_BINDING_REQUIRED');
  if (typeof value.pluginBaseVersion !== 'string' || !STRICT_SEMVER.test(value.pluginBaseVersion)
      || !validDigest(value.releaseManifestDigest) || !validDigest(value.sourceAuditManifestDigest)
      || !validDigest(value.authorityRootPinDigest)
      || value.authorityRootPinDigest !== releaseAuthorityPolicyDigest(root)) {
    fail('KSTACK_RELEASE_EXPECTED_BINDING_INVALID');
  }
  return value;
}

export function validateReleasePublication(value, externalRoot, expected) {
  exact(value, PUBLICATION_KEYS, 'KSTACK_RELEASE_PUBLICATION_INVALID');
  const root = validateExternalReleaseAuthorityRoot(externalRoot);
  const binding = validateExpectedBinding(expected, root);
  if (value.schemaVersion !== RELEASE_PUBLICATION_VERSION || typeof value.pluginBaseVersion !== 'string'
      || !STRICT_SEMVER.test(value.pluginBaseVersion)
      || !Number.isSafeInteger(value.releaseAuthorityPolicyEpoch) || value.releaseAuthorityPolicyEpoch !== root.policyEpoch
      || value.releaseAuthorityPolicyDigest !== releaseAuthorityPolicyDigest(root)
      || typeof value.publishedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value.publishedAt) || Number.isNaN(Date.parse(value.publishedAt))
      || !Array.isArray(value.signatures) || value.signatures.length !== RELEASE_ROLES.length) fail('KSTACK_RELEASE_PUBLICATION_INVALID');
  for (const field of ['sourceRevisionDigest', 'sourceTreeDigest', 'buildToolchainDigest', 'releaseManifestDigest', 'sourceAuditManifestDigest']) {
    if (!validDigest(value[field])) fail('KSTACK_RELEASE_PUBLICATION_INVALID');
  }
  if (value.pluginBaseVersion !== binding.pluginBaseVersion) fail('KSTACK_RELEASE_VERSION_BINDING_MISMATCH');
  if (value.releaseManifestDigest !== binding.releaseManifestDigest) fail('KSTACK_RELEASE_MANIFEST_BINDING_MISMATCH');
  if (value.sourceAuditManifestDigest !== binding.sourceAuditManifestDigest) fail('KSTACK_RELEASE_SOURCE_AUDIT_BINDING_MISMATCH');
  const message = releasePublicationSigningBytes(value);
  const seenRoles = new Set();
  const seenPrincipals = new Set();
  for (const [index, signature] of value.signatures.entries()) {
    exact(signature, SIGNATURE_KEYS, 'KSTACK_RELEASE_PUBLICATION_SIGNATURE_INVALID');
    const principal = root.principals.find((candidate) => candidate.role === signature.role && candidate.principalRef === signature.principalRef);
    if (!principal || seenRoles.has(signature.role) || seenPrincipals.has(signature.principalRef)) fail('KSTACK_RELEASE_PUBLICATION_SIGNATURE_INVALID');
    const bytes = strictBase64(signature.signatureBase64);
    if (bytes.length !== 64 || !crypto.verify(null, message, {
      key: Buffer.from(principal.publicKeySpkiBase64, 'base64'), format: 'der', type: 'spki'
    }, bytes)) fail('KSTACK_RELEASE_PUBLICATION_SIGNATURE_INVALID');
    seenRoles.add(signature.role);
    seenPrincipals.add(signature.principalRef);
    if (index > 0 && compare(value.signatures[index - 1].role, signature.role) >= 0) fail('KSTACK_RELEASE_PUBLICATION_SIGNATURE_INVALID');
  }
  if (RELEASE_ROLES.some((role) => !seenRoles.has(role))) fail('KSTACK_RELEASE_PUBLICATION_SIGNATURE_INVALID');
  return Object.freeze({ state: 'SIGNED_PUBLICATION_VERIFIED', releaseManifestDigest: value.releaseManifestDigest, sourceAuditManifestDigest: value.sourceAuditManifestDigest });
}

export function parseReleasePublication(input, externalRoot, expected) {
  let value;
  try { value = parseHostCanonicalJson(input); } catch { fail('KSTACK_RELEASE_PUBLICATION_ENCODING_INVALID'); }
  return validateReleasePublication(value, externalRoot, expected);
}

export function classifySourceCheckoutPublication(input = {}) {
  if (!input.publication || !input.externalAuthorityRoot) return Object.freeze({ state: 'UNSIGNED_DEVELOPMENT', pilotEligible: false, productionEligible: false });
  const result = validateReleasePublication(input.publication, input.externalAuthorityRoot, input.expected);
  return Object.freeze({ ...result, state: 'SIGNED_PUBLICATION_CALLER_VERIFIED', pilotEligible: false, productionEligible: false });
}
