import crypto from 'node:crypto';

import {
  assertAsciiId,
  assertDigest,
  assertSafeUInt,
  assertTimestamp,
  hostAddress,
  hostCanonicalBytes,
  validateHostArtifact
} from './kstack-host-contract.mjs';

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const PUBLIC_KEY = /^[A-Za-z0-9_-]{56,128}$/u;
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/u;
const SAFE_DIAGNOSTIC_ID = /^[A-Za-z0-9._:-]{1,160}$/u;

export class HostEvidenceError extends Error {
  constructor(code) {
    super(code);
    this.name = 'HostEvidenceError';
    this.code = code;
  }
}

function fail(code) { throw new HostEvidenceError(code); }

function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  }
  return value;
}

function exact(value, keys, code = 'KSTACK_EVIDENCE_SCHEMA_INVALID') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
  return value;
}

function enumeration(value, values, code = 'KSTACK_EVIDENCE_SCHEMA_INVALID') {
  if (!values.includes(value)) fail(code);
  return value;
}

function nonempty(value, code = 'KSTACK_EVIDENCE_SCHEMA_INVALID') {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value || !value.isWellFormed()) fail(code);
  return value;
}

function ascii(value, code = 'KSTACK_EVIDENCE_SCHEMA_INVALID') {
  try { return assertAsciiId(value); } catch { fail(code); }
}

function digest(value, code = 'KSTACK_EVIDENCE_SCHEMA_INVALID') {
  try { return assertDigest(value); } catch { fail(code); }
}

function uint(value, positive = false, code = 'KSTACK_EVIDENCE_SCHEMA_INVALID') {
  try { return assertSafeUInt(value, positive); } catch { fail(code); }
}

function timestamp(value, code = 'KSTACK_EVIDENCE_SCHEMA_INVALID') {
  try { return assertTimestamp(value); } catch { fail(code); }

}

function orderedUnique(values, validator, code = 'KSTACK_EVIDENCE_SCHEMA_INVALID', minimum = 0, maximum = 256) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) fail(code);
  const checked = values.map((value) => validator(value, code));
  const canonical = [...checked].sort();
  if (new Set(checked).size !== checked.length || checked.some((value, index) => value !== canonical[index])) fail(code);
  return checked;
}

function exactHead(value, identity) {
  if (value.schemaId !== identity.schemaId || value.schemaVersion !== 1) fail('KSTACK_EVIDENCE_SCHEMA_HEAD_INVALID');
  digest(value.schemaSetDigest, 'KSTACK_EVIDENCE_SCHEMA_HEAD_INVALID');
}

function toPublicKey(encoded) {
  if (typeof encoded !== 'string' || !PUBLIC_KEY.test(encoded)) fail('KSTACK_EVIDENCE_ROOT_KEY_INVALID');
  try {
    const key = crypto.createPublicKey({ key: Buffer.from(encoded, 'base64url'), format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ed25519' || key.export({ format: 'der', type: 'spki' }).toString('base64url') !== encoded) {
      fail('KSTACK_EVIDENCE_ROOT_KEY_INVALID');
    }
    return key;
  } catch (error) {
    if (error instanceof HostEvidenceError) throw error;
    fail('KSTACK_EVIDENCE_ROOT_KEY_INVALID');
  }
}

function signatureBytes(value) {
  if (typeof value !== 'string' || !SIGNATURE.test(value)) fail('KSTACK_EVIDENCE_SIGNATURE_MALFORMED');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length !== 64 || bytes.toString('base64url') !== value) fail('KSTACK_EVIDENCE_SIGNATURE_MALFORMED');
  return bytes;
}

function signatureTranscript(domain, value, omitted = 'signature') {
  const unsigned = Object.fromEntries(Object.entries(value).filter(([key]) => key !== omitted));
  return Buffer.concat([Buffer.from(domain, 'ascii'), Buffer.from([0]), hostCanonicalBytes(unsigned)]);
}

function verifySignature(publicKey, transcript, signature, code = 'KSTACK_EVIDENCE_SIGNATURE_INVALID') {
  if (!crypto.verify(null, transcript, toPublicKey(publicKey), signatureBytes(signature))) fail(code);
}

function evidenceIdentity(name) {
  const stem = name.replace(/V1$/u, '').replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase();
  return immutable({ schemaId: `kstack.${stem}.v1`, schemaVersion: 1, domain: `KSTACK-${stem.toUpperCase()}-V1` });
}

export const EVIDENCE_IDENTITIES = immutable(Object.fromEntries([
  'EvidenceTrustRootV1',
  'EvidenceRevocationV1',
  'EnvironmentMeasurementProfileV1',
  'EnvironmentSnapshotV1',
  'EvidenceAnchorV1',
  'EvidenceCatalogRowV1',
  'EvidenceSupersessionV1',
  'EvidenceCatalogSnapshotV1',
  'EvidenceAdmissionSnapshotV1',
  'EvidenceEvaluationV1'
].map((name) => [name, evidenceIdentity(name)])));

export const EVIDENCE_OUTCOMES = Object.freeze(['VALID', 'INVALID', 'CONTRADICTORY', 'STALE', 'UNAVAILABLE']);

export const EVIDENCE_REASON_CODES = Object.freeze([
  'KSTACK_EVIDENCE_SCHEMA_INVALID',
  'KSTACK_EVIDENCE_SCHEMA_HEAD_INVALID',
  'KSTACK_EVIDENCE_SCHEMA_CLOSURE_MISSING',
  'KSTACK_EVIDENCE_SIGNATURE_INVALID',
  'KSTACK_EVIDENCE_SIGNATURE_MALFORMED',
  'KSTACK_EVIDENCE_ROOT_INVALID',
  'KSTACK_EVIDENCE_ROOT_KEY_INVALID',
  'KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID',
  'KSTACK_EVIDENCE_ROOT_TRANSITION_INVALID',
  'KSTACK_EVIDENCE_SIGNER_INVALID',
  'KSTACK_EVIDENCE_SIGNER_SCOPE_MISMATCH',
  'KSTACK_EVIDENCE_REVOKED',
  'KSTACK_EVIDENCE_EPOCH_MISMATCH',
  'KSTACK_EVIDENCE_SCOPE_MISMATCH',
  'KSTACK_EVIDENCE_FIXTURE_FAILED',
  'KSTACK_EVIDENCE_FIXTURE_MISSING',
  'KSTACK_EVIDENCE_OBSERVER_UNAVAILABLE',
  'KSTACK_EVIDENCE_CONTRADICTORY',
  'KSTACK_EVIDENCE_STALE',
  'KSTACK_EVIDENCE_UNAVAILABLE',
  'KSTACK_ENVIRONMENT_CHANGED',
  'KSTACK_ENVIRONMENT_SOURCE_AMBIGUOUS',
  'KSTACK_ENVIRONMENT_MEASUREMENT_FAILED'
]);

export function evidenceHead(name, schemaSetDigest) {
  const identity = EVIDENCE_IDENTITIES[name];
  if (!identity) fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  return immutable({ schemaId: identity.schemaId, schemaVersion: 1, schemaSetDigest: digest(schemaSetDigest) });
}

function validateAdminKey(value) {
  exact(value, ['keyId', 'publicKey']);
  ascii(value.keyId);
  toPublicKey(value.publicKey);
  return value;
}

function validateSignerProfile(value) {
  exact(value, [
    'keyId', 'publicKey', 'role', 'producerProfileDigests', 'allowedEvidenceSchemaDigests',
    'maximumEvidenceLifetimeMs', 'issuanceStart', 'issuanceEnd', 'state'
  ]);
  ascii(value.keyId);
  toPublicKey(value.publicKey);
  ascii(value.role);
  orderedUnique(value.producerProfileDigests, digest, undefined, 1, 256);
  orderedUnique(value.allowedEvidenceSchemaDigests, digest, undefined, 1, 256);
  uint(value.maximumEvidenceLifetimeMs, true);
  timestamp(value.issuanceStart);
  timestamp(value.issuanceEnd);
  if (value.issuanceStart >= value.issuanceEnd) fail('KSTACK_EVIDENCE_SIGNER_INVALID');
  enumeration(value.state, ['ISSUING', 'VERIFY_ONLY', 'REVOKED']);
  return value;
}

export function validateEvidenceTrustRoot(value) {
  const identity = EVIDENCE_IDENTITIES.EvidenceTrustRootV1;
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'trustDomainId', 'rootGeneration',
    'previousRootDigest', 'rootAdminPublicKeys', 'threshold', 'onlineSignerProfiles',
    'evidenceEpoch', 'notBefore', 'notAfter', 'trustedTimeProfileDigest', 'transitionProofDigest'
  ], 'KSTACK_EVIDENCE_ROOT_INVALID');
  exactHead(value, identity);
  ascii(value.trustDomainId, 'KSTACK_EVIDENCE_ROOT_INVALID');
  uint(value.rootGeneration, true, 'KSTACK_EVIDENCE_ROOT_INVALID');
  if (value.previousRootDigest !== null) digest(value.previousRootDigest, 'KSTACK_EVIDENCE_ROOT_INVALID');
  if (!Array.isArray(value.rootAdminPublicKeys) || value.rootAdminPublicKeys.length !== 3) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
  value.rootAdminPublicKeys.forEach(validateAdminKey);
  if (value.threshold !== 2) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
  if (!Array.isArray(value.onlineSignerProfiles) || value.onlineSignerProfiles.length < 1 || value.onlineSignerProfiles.length > 64) fail('KSTACK_EVIDENCE_ROOT_INVALID');
  value.onlineSignerProfiles.forEach(validateSignerProfile);
  const adminIds = value.rootAdminPublicKeys.map((entry) => entry.keyId);
  const adminKeys = value.rootAdminPublicKeys.map((entry) => entry.publicKey);
  const signerIds = value.onlineSignerProfiles.map((entry) => entry.keyId);
  const signerKeys = value.onlineSignerProfiles.map((entry) => entry.publicKey);
  if (new Set(adminIds).size !== 3 || new Set(adminKeys).size !== 3
      || new Set(signerIds).size !== signerIds.length || new Set(signerKeys).size !== signerKeys.length
      || signerIds.some((entry) => adminIds.includes(entry)) || signerKeys.some((entry) => adminKeys.includes(entry))) {
    fail('KSTACK_EVIDENCE_ROOT_KEY_INVALID');
  }
  if (adminIds.some((entry, index) => index > 0 && entry <= adminIds[index - 1])
      || signerIds.some((entry, index) => index > 0 && entry <= signerIds[index - 1])) fail('KSTACK_EVIDENCE_ROOT_INVALID');
  uint(value.evidenceEpoch, true, 'KSTACK_EVIDENCE_ROOT_INVALID');
  timestamp(value.notBefore, 'KSTACK_EVIDENCE_ROOT_INVALID');
  timestamp(value.notAfter, 'KSTACK_EVIDENCE_ROOT_INVALID');
  if (value.notBefore >= value.notAfter) fail('KSTACK_EVIDENCE_ROOT_INVALID');
  digest(value.trustedTimeProfileDigest, 'KSTACK_EVIDENCE_ROOT_INVALID');
  if (value.transitionProofDigest !== null) digest(value.transitionProofDigest, 'KSTACK_EVIDENCE_ROOT_INVALID');
  if (value.rootGeneration === 1
    ? value.previousRootDigest !== null || value.transitionProofDigest !== null
    : value.previousRootDigest === null || value.transitionProofDigest === null) {
    fail('KSTACK_EVIDENCE_ROOT_TRANSITION_INVALID');
  }
  return immutable(value);
}

function validateSignatureRow(value) {
  exact(value, ['keyId', 'signature']);
  ascii(value.keyId);
  signatureBytes(value.signature);
  return value;
}

export function validateEvidenceRevocation(value) {
  const identity = EVIDENCE_IDENTITIES.EvidenceRevocationV1;
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'trustRootDigest', 'rootGeneration',
    'revocationSequence', 'revokedKeyDigests', 'revokedRootDigests', 'revokedProducerDigests',
    'revokedProfileDigests', 'invalidFrom', 'reasonCode', 'replacementDigest', 'newEvidenceEpoch',
    'trustedTimeSampleDigest', 'signatures'
  ]);
  exactHead(value, identity);
  digest(value.trustRootDigest);
  uint(value.rootGeneration, true);
  uint(value.revocationSequence, true);
  for (const field of ['revokedKeyDigests', 'revokedRootDigests', 'revokedProducerDigests', 'revokedProfileDigests']) {
    orderedUnique(value[field], digest, undefined, 0, 256);
  }
  if (value.revokedKeyDigests.length + value.revokedRootDigests.length + value.revokedProducerDigests.length + value.revokedProfileDigests.length === 0) {
    fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  }
  timestamp(value.invalidFrom);
  ascii(value.reasonCode);
  if (value.replacementDigest !== null) digest(value.replacementDigest);
  uint(value.newEvidenceEpoch, true);
  digest(value.trustedTimeSampleDigest);
  if (!Array.isArray(value.signatures) || value.signatures.length !== 2) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
  value.signatures.forEach(validateSignatureRow);
  if (value.signatures[0].keyId >= value.signatures[1].keyId) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
  return immutable(value);
}

function rootBodyForTransition(root) {
  return Object.fromEntries(Object.entries(root).filter(([key]) => key !== 'transitionProofDigest'));
}

export function rootTransitionStatementDigest(currentRootInput, candidateRootInput) {
  const currentRoot = validateEvidenceTrustRoot(currentRootInput);
  const candidateRoot = validateEvidenceTrustRoot(candidateRootInput);
  const currentRootDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceTrustRootV1.domain, currentRoot);
  const candidateRootBodyDigest = hostAddress('KSTACK-EVIDENCE-TRUST-ROOT-BODY-V1', rootBodyForTransition(candidateRoot));
  return hostAddress('KSTACK-EVIDENCE-ROOT-TRANSITION-STATEMENT-V1', {
    currentRootDigest,
    candidateRootBodyDigest,
    candidateRootGeneration: candidateRoot.rootGeneration,
    trustDomainId: candidateRoot.trustDomainId
  });
}

function verifyThresholdRows(keys, threshold, transcript, rows) {
  if (!Array.isArray(rows) || rows.length !== threshold) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
  rows.forEach(validateSignatureRow);
  if (rows.some((entry, index) => index > 0 && entry.keyId <= rows[index - 1].keyId)) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
  const used = new Set();
  for (const row of rows) {
    const key = keys.find((entry) => entry.keyId === row.keyId);
    if (!key || used.has(row.keyId)) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
    verifySignature(key.publicKey, transcript, row.signature, 'KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
    used.add(row.keyId);
  }
}

export function verifyEvidenceRootTransition(currentRootInput, candidateRootInput, authorizations) {
  const currentRoot = validateEvidenceTrustRoot(currentRootInput);
  const candidateRoot = validateEvidenceTrustRoot(candidateRootInput);
  exact(authorizations, ['currentAdminSignatures', 'candidateAdminPossessionSignatures']);
  const currentRootDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceTrustRootV1.domain, currentRoot);
  if (candidateRoot.schemaSetDigest !== currentRoot.schemaSetDigest
      || candidateRoot.trustDomainId !== currentRoot.trustDomainId
      || candidateRoot.rootGeneration !== currentRoot.rootGeneration + 1
      || candidateRoot.previousRootDigest !== currentRootDigest
      || candidateRoot.transitionProofDigest !== rootTransitionStatementDigest(currentRoot, candidateRoot)
      || candidateRoot.evidenceEpoch < currentRoot.evidenceEpoch
      || candidateRoot.notBefore < currentRoot.notBefore) fail('KSTACK_EVIDENCE_ROOT_TRANSITION_INVALID');
  const transcript = Buffer.concat([
    Buffer.from('KSTACK-EVIDENCE-ROOT-TRANSITION-SIGNATURE-V1', 'ascii'), Buffer.from([0]), hostCanonicalBytes(candidateRoot)
  ]);
  verifyThresholdRows(currentRoot.rootAdminPublicKeys, currentRoot.threshold, transcript, authorizations.currentAdminSignatures);
  verifyThresholdRows(candidateRoot.rootAdminPublicKeys, candidateRoot.threshold, transcript, authorizations.candidateAdminPossessionSignatures);
  return candidateRoot;
}

function validateSelector(value) {
  exact(value, ['selectorId', 'valueKind', 'mutable', 'mandatory', 'maximumAgeMs', 'maximumBytes', 'sourceIds']);
  ascii(value.selectorId);
  enumeration(value.valueKind, ['PUBLIC', 'SECRET']);
  if (typeof value.mutable !== 'boolean' || typeof value.mandatory !== 'boolean') fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  uint(value.maximumAgeMs, true);
  uint(value.maximumBytes, true);
  orderedUnique(value.sourceIds, ascii, undefined, 1, 16);
  return value;
}

export function validateEnvironmentMeasurementProfile(value) {
  const identity = EVIDENCE_IDENTITIES.EnvironmentMeasurementProfileV1;
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'operationProfileDigest', 'hostPlatformDigest',
    'selectors', 'maximumMeasurementAgeMs', 'observerImplementationDigests', 'activeSetDigest'
  ]);
  exactHead(value, identity);
  digest(value.operationProfileDigest);
  digest(value.hostPlatformDigest);
  if (!Array.isArray(value.selectors) || value.selectors.length < 1 || value.selectors.length > 256) fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  value.selectors.forEach(validateSelector);
  const selectorIds = value.selectors.map((entry) => entry.selectorId);
  if (new Set(selectorIds).size !== selectorIds.length || selectorIds.some((entry, index) => index > 0 && entry <= selectorIds[index - 1])) fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  uint(value.maximumMeasurementAgeMs, true);
  orderedUnique(value.observerImplementationDigests, digest, undefined, 1, 64);
  digest(value.activeSetDigest);
  return immutable(value);
}

export function environmentObserverProfileSetDigest(profileInput) {
  const profile = validateEnvironmentMeasurementProfile(profileInput);
  return hostAddress('KSTACK-EVIDENCE-OBSERVER-PROFILE-SET-V1', {
    observerImplementationDigests: profile.observerImplementationDigests
  });
}

const SNAPSHOT_DIGEST_FIELDS = Object.freeze([
  'measurementProfileDigest', 'hostInstanceDigest', 'runningProcessIdentityDigest', 'onDiskExecutableIdentityDigest',
  'platformKernelDigest', 'adapterDigest', 'nativePermissionModeDigest', 'hostModeDigest', 'hostConfigDigest',
  'pluginSetDigest', 'customToolSetDigest', 'subagentSetDigest', 'mcpEndpointSetDigest', 'toolRegistryDigest',
  'repositoryRootSetDigest', 'worktreeSetDigest', 'mountCaseProfileDigest', 'shellWrapperSetDigest',
  'formatterLspSetDigest', 'backgroundFacilitySetDigest', 'brokerProfileDigest', 'activeSetDigest', 'policyDigest',
  'relevantEnvironmentDigest', 'trustedTimeSampleDigest', 'observerProfileSetDigest'
]);

export function validateEnvironmentSnapshot(value) {
  const identity = EVIDENCE_IDENTITIES.EnvironmentSnapshotV1;
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', ...SNAPSHOT_DIGEST_FIELDS,
    'secretMeasurementKeyGeneration', 'measurementSequence', 'measuredAt', 'expiresAt'
  ]);
  exactHead(value, identity);
  SNAPSHOT_DIGEST_FIELDS.forEach((field) => digest(value[field]));
  uint(value.secretMeasurementKeyGeneration, true);
  uint(value.measurementSequence, true);
  timestamp(value.measuredAt);
  timestamp(value.expiresAt);
  if (value.measuredAt >= value.expiresAt) fail('KSTACK_EVIDENCE_STALE');
  return immutable(value);
}

export function equivalentEnvironmentSnapshots(leftInput, rightInput) {
  const left = validateEnvironmentSnapshot(leftInput);
  const right = validateEnvironmentSnapshot(rightInput);
  const comparableFields = [
    'schemaSetDigest', ...SNAPSHOT_DIGEST_FIELDS.filter((field) => field !== 'trustedTimeSampleDigest'),
    'secretMeasurementKeyGeneration'
  ];
  return comparableFields.every((field) => left[field] === right[field]);
}

function validateMeasurementBinding(value) {
  const fields = SNAPSHOT_DIGEST_FIELDS.filter((field) => ![
    'measurementProfileDigest', 'relevantEnvironmentDigest', 'trustedTimeSampleDigest'
  ].includes(field));
  exact(value, [...fields, 'secretMeasurementKeyGeneration']);
  fields.forEach((field) => digest(value[field]));
  uint(value.secretMeasurementKeyGeneration, true);
  return value;
}

export async function collectEnvironmentSnapshot(input) {
  exact(input, ['profile', 'binding', 'sources', 'timeSample', 'measurementSequence', 'protectedHmac']);
  const profile = validateEnvironmentMeasurementProfile(input.profile);
  const binding = validateMeasurementBinding(input.binding);
  if (binding.observerProfileSetDigest !== environmentObserverProfileSetDigest(profile)) {
    fail('KSTACK_EVIDENCE_OBSERVER_UNAVAILABLE');
  }
  exact(input.timeSample, ['sampleDigest', 'wallTime']);
  digest(input.timeSample.sampleDigest);
  timestamp(input.timeSample.wallTime);
  uint(input.measurementSequence, true);
  if (!input.sources || typeof input.sources !== 'object' || Array.isArray(input.sources)
      || typeof input.protectedHmac !== 'function') fail('KSTACK_ENVIRONMENT_MEASUREMENT_FAILED');
  const declaredSourceIds = [...new Set(profile.selectors.flatMap((selector) => selector.sourceIds))].sort();
  const suppliedSourceIds = Object.keys(input.sources).sort();
  if (declaredSourceIds.length !== suppliedSourceIds.length
      || declaredSourceIds.some((sourceId, index) => sourceId !== suppliedSourceIds[index])) {
    fail('KSTACK_ENVIRONMENT_SOURCE_AMBIGUOUS');
  }

  const opened = [];
  try {
    for (const selector of profile.selectors) {
      const present = [];
      for (const sourceId of selector.sourceIds) {
        const source = input.sources[sourceId];
        if (!source || typeof source.open !== 'function') fail('KSTACK_ENVIRONMENT_MEASUREMENT_FAILED');
        const handle = await source.open(selector.selectorId);
        if (handle !== null) present.push({ selector, sourceId, handle });
      }
      if (present.length > 1) fail('KSTACK_ENVIRONMENT_SOURCE_AMBIGUOUS');
      if (present.length === 0) {
        if (selector.mandatory) fail('KSTACK_ENVIRONMENT_MEASUREMENT_FAILED');
        opened.push({ selector, sourceId: null, handle: null });
      } else {
        const [{ sourceId, handle }] = present;
        if (!handle || typeof handle.read !== 'function' || typeof handle.revalidate !== 'function'
            || !DIGEST.test(handle.identityDigest)) fail('KSTACK_ENVIRONMENT_MEASUREMENT_FAILED');
        opened.push({ selector, sourceId, handle });
      }
    }

    const rows = [];
    for (const entry of opened) {
      if (entry.handle === null) {
        rows.push({ selectorId: entry.selector.selectorId, sourceId: null, sourceIdentityDigest: null, valueDigest: null });
        continue;
      }
      const value = await entry.handle.read();
      const canonical = hostCanonicalBytes(value);
      if (canonical.length > entry.selector.maximumBytes) fail('KSTACK_ENVIRONMENT_MEASUREMENT_FAILED');
      const valueDigest = entry.selector.valueKind === 'SECRET'
        ? await input.protectedHmac(binding.secretMeasurementKeyGeneration, Buffer.concat([
          Buffer.from('KSTACK-ENVIRONMENT-SECRET-MEASUREMENT-V1\0', 'ascii'),
          Buffer.from(entry.selector.selectorId, 'ascii'), Buffer.from([0]), canonical
        ]))
        : `sha256:${crypto.createHash('sha256').update(Buffer.from('KSTACK-ENVIRONMENT-PUBLIC-MEASUREMENT-V1\0', 'ascii')).update(canonical).digest('hex')}`;
      digest(valueDigest, 'KSTACK_ENVIRONMENT_MEASUREMENT_FAILED');
      rows.push({
        selectorId: entry.selector.selectorId,
        sourceId: entry.sourceId,
        sourceIdentityDigest: entry.handle.identityDigest,
        valueDigest
      });
    }
    for (const entry of opened) {
      if (entry.handle === null) continue;
      const after = await entry.handle.revalidate();
      if (after !== entry.handle.identityDigest) fail('KSTACK_ENVIRONMENT_CHANGED');
    }
    const minimumAge = profile.selectors.reduce((minimum, selector) => Math.min(minimum, selector.maximumAgeMs), profile.maximumMeasurementAgeMs);
    const expiresAt = new Date(Date.parse(input.timeSample.wallTime) + minimumAge).toISOString();
    const relevantEnvironmentDigest = hostAddress('KSTACK-RELEVANT-ENVIRONMENT-V1', { rows });
    const snapshot = {
      ...evidenceHead('EnvironmentSnapshotV1', profile.schemaSetDigest),
      measurementProfileDigest: hostAddress(EVIDENCE_IDENTITIES.EnvironmentMeasurementProfileV1.domain, profile),
      ...binding,
      relevantEnvironmentDigest,
      measurementSequence: input.measurementSequence,
      measuredAt: input.timeSample.wallTime,
      expiresAt,
      trustedTimeSampleDigest: input.timeSample.sampleDigest
    };
    return validateEnvironmentSnapshot(snapshot);
  } catch (error) {
    if (error instanceof HostEvidenceError) throw error;
    fail('KSTACK_ENVIRONMENT_MEASUREMENT_FAILED');
  } finally {
    for (const entry of opened) {
      if (entry.handle && typeof entry.handle.close === 'function') {
        try { await entry.handle.close(); } catch { /* measurement already fails closed before publication */ }
      }
    }
  }
}

export function validateEvidenceAnchor(value) {
  const identity = EVIDENCE_IDENTITIES.EvidenceAnchorV1;
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'payloadDigest', 'payloadSchemaDigest',
    'producerProfileDigest', 'signerKeyId', 'signerRole', 'trustRootDigest', 'rootGeneration',
    'evidenceEpoch', 'environmentSnapshotDigest', 'independentObservationSetDigest', 'issuedAt',
    'expiresAt', 'signature'
  ]);
  exactHead(value, identity);
  for (const field of [
    'payloadDigest', 'payloadSchemaDigest', 'producerProfileDigest', 'trustRootDigest',
    'environmentSnapshotDigest', 'independentObservationSetDigest'
  ]) digest(value[field]);
  ascii(value.signerKeyId);
  ascii(value.signerRole);
  uint(value.rootGeneration, true);
  uint(value.evidenceEpoch, true);
  timestamp(value.issuedAt);
  timestamp(value.expiresAt);
  if (value.issuedAt >= value.expiresAt) fail('KSTACK_EVIDENCE_STALE');
  signatureBytes(value.signature);
  return immutable(value);
}

export function validateEvidenceCatalogRow(value) {
  const identity = EVIDENCE_IDENTITIES.EvidenceCatalogRowV1;
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'payloadDigest', 'anchorDigest', 'payloadSchemaDigest',
    'trustRootDigest', 'evidenceEpoch', 'publicationSequence', 'publishedAt'
  ]);
  exactHead(value, identity);
  for (const field of ['payloadDigest', 'anchorDigest', 'payloadSchemaDigest', 'trustRootDigest']) digest(value[field]);
  uint(value.evidenceEpoch, true);
  uint(value.publicationSequence, true);
  timestamp(value.publishedAt);
  return immutable(value);
}

export function validateEvidenceSupersession(value) {
  const identity = EVIDENCE_IDENTITIES.EvidenceSupersessionV1;
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'trustRootDigest', 'oldEvidenceDigest',
    'newEvidenceDigest', 'requirementScopeDigest', 'fixtureScopeDigest', 'environmentSnapshotDigest',
    'rootCauseReasonCode', 'correctiveChangeDigest', 'newIndependentRunDigest', 'effectiveAt',
    'evidenceEpoch', 'signatures'
  ]);
  exactHead(value, identity);
  for (const field of [
    'trustRootDigest', 'oldEvidenceDigest', 'newEvidenceDigest', 'requirementScopeDigest',
    'fixtureScopeDigest', 'environmentSnapshotDigest', 'correctiveChangeDigest', 'newIndependentRunDigest'
  ]) digest(value[field]);
  if (value.oldEvidenceDigest === value.newEvidenceDigest) fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  ascii(value.rootCauseReasonCode);
  timestamp(value.effectiveAt);
  uint(value.evidenceEpoch, true);
  if (!Array.isArray(value.signatures) || value.signatures.length !== 2) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
  value.signatures.forEach(validateSignatureRow);
  if (value.signatures[0].keyId >= value.signatures[1].keyId) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
  return immutable(value);
}

function verifyAdminSignatures(root, value, domain, signatures) {
  const transcript = signatureTranscript(domain, value, 'signatures');
  const used = new Set();
  for (const row of signatures) {
    if (used.has(row.keyId)) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
    const admin = root.rootAdminPublicKeys.find((entry) => entry.keyId === row.keyId);
    if (!admin) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
    verifySignature(admin.publicKey, transcript, row.signature, 'KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
    used.add(row.keyId);
  }
  if (used.size !== root.threshold) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
}

export function verifyEvidenceRevocation(rootInput, revocationInput, expectedSequence) {
  const root = validateEvidenceTrustRoot(rootInput);
  const revocation = validateEvidenceRevocation(revocationInput);
  const rootDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceTrustRootV1.domain, root);
  if (revocation.trustRootDigest !== rootDigest || revocation.rootGeneration !== root.rootGeneration
      || revocation.revocationSequence !== expectedSequence || revocation.newEvidenceEpoch <= root.evidenceEpoch) {
    fail('KSTACK_EVIDENCE_ROOT_TRANSITION_INVALID');
  }
  verifyAdminSignatures(root, revocation, 'KSTACK-EVIDENCE-REVOCATION-SIGNATURE-V1', revocation.signatures);
  return revocation;
}

export function verifyEvidenceSupersession(rootInput, supersessionInput, expected) {
  const root = validateEvidenceTrustRoot(rootInput);
  const supersession = validateEvidenceSupersession(supersessionInput);
  exact(expected, ['requirementScopeDigest', 'fixtureScopeDigest', 'environmentSnapshotDigest', 'currentEvidenceEpoch']);
  for (const field of ['requirementScopeDigest', 'fixtureScopeDigest', 'environmentSnapshotDigest']) digest(expected[field]);
  uint(expected.currentEvidenceEpoch, true);
  const rootDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceTrustRootV1.domain, root);
  if (supersession.trustRootDigest !== rootDigest || supersession.evidenceEpoch !== expected.currentEvidenceEpoch
      || ['requirementScopeDigest', 'fixtureScopeDigest', 'environmentSnapshotDigest'].some((field) => supersession[field] !== expected[field])) {
    fail('KSTACK_EVIDENCE_SCOPE_MISMATCH');
  }
  verifyAdminSignatures(root, supersession, 'KSTACK-EVIDENCE-SUPERSESSION-SIGNATURE-V1', supersession.signatures);
  return supersession;
}

export function evidenceAnchorTranscript(value) {
  validateEvidenceAnchor(value);
  return signatureTranscript('KSTACK-EVIDENCE-ANCHOR-SIGNATURE-V1', value);
}

function sameCanonical(left, right) {
  return hostCanonicalBytes(left).equals(hostCanonicalBytes(right));
}

const BODY_FIELDS = Object.freeze([
  'hostInstanceDigest', 'hostBuildDigest', 'adapterDigest', 'harnessDigest', 'fixtureSetDigest',
  'environmentDigest', 'results', 'issuedAt', 'expiresAt'
]);

export function validateHostConformanceEvidenceClosure(input) {
  exact(input, [
    'body', 'anchor', 'wrapper', 'bodySchemaDigest', 'root', 'environmentSnapshot',
    'expectedProducerProfileDigest', 'expectedObserverSetDigest', 'currentEvidenceEpoch', 'vocabulary'
  ]);
  const bodyValidation = validateHostArtifact('HostConformanceEvidenceBodyV1', input.body, { vocabulary: input.vocabulary });
  const wrapperValidation = validateHostArtifact('HostConformanceEvidenceV1', input.wrapper, { vocabulary: input.vocabulary });
  const anchor = validateEvidenceAnchor(input.anchor);
  const root = validateEvidenceTrustRoot(input.root);
  const environment = validateEnvironmentSnapshot(input.environmentSnapshot);
  digest(input.bodySchemaDigest);
  digest(input.expectedProducerProfileDigest);
  digest(input.expectedObserverSetDigest);
  uint(input.currentEvidenceEpoch, true);
  const anchorDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceAnchorV1.domain, anchor);
  const rootDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceTrustRootV1.domain, root);
  const environmentDigest = hostAddress(EVIDENCE_IDENTITIES.EnvironmentSnapshotV1.domain, environment);
  if (anchor.payloadDigest !== bodyValidation.objectDigest || anchor.payloadSchemaDigest !== input.bodySchemaDigest
      || anchor.environmentSnapshotDigest !== environmentDigest || anchor.environmentSnapshotDigest !== input.body.environmentDigest
      || anchor.issuedAt !== input.body.issuedAt || anchor.expiresAt !== input.body.expiresAt
      || input.wrapper.anchorDigest !== anchorDigest || input.wrapper.schemaSetDigest !== input.body.schemaSetDigest
      || anchor.schemaSetDigest !== input.body.schemaSetDigest || environment.schemaSetDigest !== input.body.schemaSetDigest
      || anchor.trustRootDigest !== rootDigest || anchor.rootGeneration !== root.rootGeneration
      || anchor.evidenceEpoch !== input.currentEvidenceEpoch || anchor.producerProfileDigest !== input.expectedProducerProfileDigest
      || anchor.independentObservationSetDigest !== input.expectedObserverSetDigest) fail('KSTACK_EVIDENCE_SCOPE_MISMATCH');
  for (const field of BODY_FIELDS) if (!sameCanonical(input.wrapper[field], input.body[field])) fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  const signer = root.onlineSignerProfiles.find((entry) => entry.keyId === anchor.signerKeyId);
  if (!signer || signer.role !== anchor.signerRole || signer.state === 'REVOKED') fail('KSTACK_EVIDENCE_SIGNER_INVALID');
  if (!signer.producerProfileDigests.includes(anchor.producerProfileDigest)
      || !signer.allowedEvidenceSchemaDigests.includes(input.bodySchemaDigest)) fail('KSTACK_EVIDENCE_SIGNER_SCOPE_MISMATCH');
  if (anchor.issuedAt < signer.issuanceStart || anchor.issuedAt >= signer.issuanceEnd
      || Date.parse(anchor.expiresAt) - Date.parse(anchor.issuedAt) > signer.maximumEvidenceLifetimeMs) fail('KSTACK_EVIDENCE_SIGNER_INVALID');
  verifySignature(signer.publicKey, evidenceAnchorTranscript(anchor), anchor.signature);
  return immutable({ bodyDigest: bodyValidation.objectDigest, anchorDigest, wrapperDigest: wrapperValidation.objectDigest, environmentDigest, rootDigest });
}

export function validateProtectedEvidenceBackend(backend, options = {}) {
  exact(backend, [
    'protectionClass', 'repositoryWritable', 'agentWritable', 'durable', 'atomicPublication',
    'nonExportableKeys', 'appendOnlyAudit'
  ], 'KSTACK_EVIDENCE_UNAVAILABLE');
  const allowed = ['os-keystore', 'hardware-backed', 'qualified-service'];
  if (options.allowTestBackend === true) allowed.push('test-only');
  if (!allowed.includes(backend.protectionClass) || backend.repositoryWritable !== false || backend.agentWritable !== false
      || backend.durable !== true || backend.atomicPublication !== true || backend.nonExportableKeys !== true
      || backend.appendOnlyAudit !== true) fail('KSTACK_EVIDENCE_UNAVAILABLE');
  return immutable(backend);
}

function validateSafeReasonCodes(reasonCodes) {
  return orderedUnique(reasonCodes, (value) => {
    if (!EVIDENCE_REASON_CODES.includes(value)) fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
    return value;
  }, undefined, 0, EVIDENCE_REASON_CODES.length);
}

function precedence(outcomes) {
  for (const candidate of ['INVALID', 'CONTRADICTORY', 'STALE', 'UNAVAILABLE', 'VALID']) {
    if (outcomes.includes(candidate)) return candidate;
  }
  return 'UNAVAILABLE';
}

function evaluation(reasonCodes, selectedEvidenceDigests = []) {
  const codes = [...new Set(reasonCodes)].sort();
  validateSafeReasonCodes(codes);
  const outcomes = codes.map((code) => {
    if (code.includes('CONTRADICTORY')) return 'CONTRADICTORY';
    if (code.includes('STALE') || code === 'KSTACK_ENVIRONMENT_CHANGED') return 'STALE';
    if (code.includes('UNAVAILABLE') || code.includes('MISSING') || code.includes('MEASUREMENT_FAILED')) return 'UNAVAILABLE';
    return 'INVALID';
  });
  const outcome = codes.length === 0 ? 'VALID' : precedence(outcomes);
  return immutable({ outcome, reasonCodes: codes, selectedEvidenceDigests: [...selectedEvidenceDigests].sort() });
}

export function validateEvidenceCatalogSnapshot(value) {
  const identity = EVIDENCE_IDENTITIES.EvidenceCatalogSnapshotV1;
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'trustRootDigest', 'rootGeneration',
    'revocationSetDigest', 'revocationSequence', 'evidenceEpoch', 'activeSetDigest', 'policyDigest',
    'environmentSnapshotDigest', 'producerRegistryDigest', 'schemaResolverSetDigest', 'catalogSequence',
    'previousHeadDigest', 'candidateAnchorDigests', 'supersessionDigests', 'trustedTimeSampleDigest',
    'expiresAt'
  ]);
  exactHead(value, identity);
  for (const field of [
    'trustRootDigest', 'revocationSetDigest', 'activeSetDigest', 'policyDigest', 'environmentSnapshotDigest',
    'producerRegistryDigest', 'schemaResolverSetDigest', 'trustedTimeSampleDigest'
  ]) digest(value[field]);
  if (value.previousHeadDigest !== null) digest(value.previousHeadDigest);
  uint(value.rootGeneration, true);
  uint(value.revocationSequence);
  uint(value.evidenceEpoch, true);
  uint(value.catalogSequence, true);
  orderedUnique(value.candidateAnchorDigests, digest, undefined, 0, 1024);
  orderedUnique(value.supersessionDigests, digest, undefined, 0, 1024);
  timestamp(value.expiresAt);
  return immutable(value);
}

export function validateEvidenceAdmissionSnapshot(value) {
  const identity = EVIDENCE_IDENTITIES.EvidenceAdmissionSnapshotV1;
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'environmentSnapshotDigest', 'measurementSequence',
    'activeSetDigest', 'policyDigest', 'rootGeneration', 'revocationSequence', 'evidenceEpoch',
    'catalogHeadDigest', 'catalogSequence', 'requirementProfileDigest', 'selectedEvidenceDigests',
    'evaluationDigest', 'trustedTimeSampleDigest', 'expiresAt'
  ]);
  exactHead(value, identity);
  for (const field of [
    'environmentSnapshotDigest', 'activeSetDigest', 'policyDigest', 'catalogHeadDigest',
    'requirementProfileDigest', 'evaluationDigest', 'trustedTimeSampleDigest'
  ]) digest(value[field]);
  uint(value.measurementSequence, true);
  uint(value.rootGeneration, true);
  uint(value.revocationSequence);
  uint(value.evidenceEpoch, true);
  uint(value.catalogSequence, true);
  orderedUnique(value.selectedEvidenceDigests, digest, undefined, 1, 256);
  timestamp(value.expiresAt);
  return immutable(value);
}

export function assertEvidenceActionHandoff(admissionInput, current) {
  const admission = validateEvidenceAdmissionSnapshot(admissionInput);
  exact(current, [
    'environmentSnapshotDigest', 'measurementSequence', 'activeSetDigest', 'policyDigest',
    'rootGeneration', 'revocationSequence', 'evidenceEpoch', 'catalogHeadDigest', 'catalogSequence', 'trustedNow'
  ]);
  for (const field of ['environmentSnapshotDigest', 'activeSetDigest', 'policyDigest', 'catalogHeadDigest']) digest(current[field]);
  for (const field of ['measurementSequence', 'rootGeneration', 'revocationSequence', 'evidenceEpoch', 'catalogSequence']) {
    uint(current[field], field !== 'revocationSequence');
  }
  timestamp(current.trustedNow);
  for (const field of [
    'environmentSnapshotDigest', 'measurementSequence', 'activeSetDigest', 'policyDigest', 'rootGeneration',
    'revocationSequence', 'evidenceEpoch', 'catalogHeadDigest', 'catalogSequence'
  ]) if (admission[field] !== current[field]) fail('KSTACK_ENVIRONMENT_CHANGED');
  if (current.trustedNow >= admission.expiresAt) fail('KSTACK_EVIDENCE_STALE');
  return true;
}

export function validateEvidenceEvaluation(value) {
  const identity = EVIDENCE_IDENTITIES.EvidenceEvaluationV1;
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'outcome', 'reasonCodes',
    'selectedEvidenceDigests', 'evidenceSetDigest', 'evaluatedAt'
  ]);
  exactHead(value, identity);
  enumeration(value.outcome, EVIDENCE_OUTCOMES);
  validateSafeReasonCodes(value.reasonCodes);
  orderedUnique(value.selectedEvidenceDigests, digest, undefined, 0, 256);
  if (value.evidenceSetDigest !== null) digest(value.evidenceSetDigest);
  if ((value.outcome === 'VALID') !== (value.evidenceSetDigest !== null && value.selectedEvidenceDigests.length > 0)) {
    fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  }
  timestamp(value.evaluatedAt);
  return immutable(value);
}

function isRevoked(anchor, root, revocations) {
  const keyDigest = evidenceKeyDigest({ keyId: anchor.signerKeyId,
    publicKey: root.onlineSignerProfiles.find((entry) => entry.keyId === anchor.signerKeyId)?.publicKey || '' });
  return revocations.some((revocation) => Date.parse(revocation.invalidFrom) <= Date.parse(anchor.expiresAt)
    && (revocation.revokedKeyDigests.includes(keyDigest)
      || revocation.revokedRootDigests.includes(anchor.trustRootDigest)
      || revocation.revokedProducerDigests.includes(anchor.producerProfileDigest)
      || revocation.revokedProfileDigests.includes(anchor.payloadSchemaDigest)));
}

function evidenceKeyDigest(key) {
  return hostAddress('KSTACK-EVIDENCE-SIGNER-KEY-V1', { keyId: key.keyId, publicKey: key.publicKey });
}

export function selectHostEvidence(input) {
  exact(input, [
    'candidates', 'requirement', 'root', 'revocations', 'supersessions', 'liveEnvironmentSnapshot',
    'trustedNow', 'bodySchemaDigest', 'currentEvidenceEpoch', 'vocabulary'
  ]);
  const root = validateEvidenceTrustRoot(input.root);
  const liveEnvironment = validateEnvironmentSnapshot(input.liveEnvironmentSnapshot);
  timestamp(input.trustedNow);
  digest(input.bodySchemaDigest);
  uint(input.currentEvidenceEpoch, true);
  exact(input.requirement, [
    'hostInstanceDigest', 'hostBuildDigest', 'adapterDigest', 'fixtureSetDigest', 'producerProfileDigests',
    'observerProfileSetDigest', 'requiredScopes', 'activeSetDigest', 'policyDigest',
    'requirementScopeDigest', 'fixtureScopeDigest', 'requirementProfileDigest'
  ]);
  for (const field of [
    'hostInstanceDigest', 'hostBuildDigest', 'adapterDigest', 'fixtureSetDigest', 'observerProfileSetDigest',
    'activeSetDigest', 'policyDigest', 'requirementScopeDigest', 'fixtureScopeDigest', 'requirementProfileDigest'
  ]) {
    digest(input.requirement[field]);
  }
  orderedUnique(input.requirement.producerProfileDigests, digest, undefined, 1, 256);
  if (!Array.isArray(input.requirement.requiredScopes) || input.requirement.requiredScopes.length < 1) fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  for (const scope of input.requirement.requiredScopes) {
    exact(scope, ['capabilityId', 'fixtureId']);
    ascii(scope.capabilityId);
    ascii(scope.fixtureId);
  }
  const scopeKeys = input.requirement.requiredScopes.map((entry) => `${entry.capabilityId}\0${entry.fixtureId}`);
  if (new Set(scopeKeys).size !== scopeKeys.length || scopeKeys.some((entry, index) => index > 0 && entry <= scopeKeys[index - 1])) fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  if (!Array.isArray(input.candidates) || !Array.isArray(input.revocations) || !Array.isArray(input.supersessions)) fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  let revocations;
  try { revocations = input.revocations.map(validateEvidenceRevocation); }
  catch (error) { return evaluation([EVIDENCE_REASON_CODES.includes(error?.code) ? error.code : 'KSTACK_EVIDENCE_SCHEMA_INVALID']); }
  const rootDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceTrustRootV1.domain, root);
  let expectedRevocationSequence = 1;
  let expectedEvidenceEpoch = root.evidenceEpoch;
  for (const revocation of revocations) {
    if (revocation.trustRootDigest !== rootDigest || revocation.rootGeneration !== root.rootGeneration
        || revocation.revocationSequence !== expectedRevocationSequence || revocation.newEvidenceEpoch <= expectedEvidenceEpoch) {
      return evaluation(['KSTACK_EVIDENCE_ROOT_TRANSITION_INVALID']);
    }
    try {
      verifyAdminSignatures(root, revocation, 'KSTACK-EVIDENCE-REVOCATION-SIGNATURE-V1', revocation.signatures);
    } catch {
      return evaluation(['KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID']);
    }
    expectedEvidenceEpoch = revocation.newEvidenceEpoch;
    expectedRevocationSequence += 1;
  }
  if (expectedEvidenceEpoch !== input.currentEvidenceEpoch) return evaluation(['KSTACK_EVIDENCE_EPOCH_MISMATCH']);
  const reasons = [];
  const currentEnvironmentDigest = hostAddress(EVIDENCE_IDENTITIES.EnvironmentSnapshotV1.domain, liveEnvironment);
  if (liveEnvironment.activeSetDigest !== input.requirement.activeSetDigest || liveEnvironment.policyDigest !== input.requirement.policyDigest) {
    reasons.push('KSTACK_ENVIRONMENT_CHANGED');
  }
  if (input.trustedNow < liveEnvironment.measuredAt || input.trustedNow >= liveEnvironment.expiresAt) {
    reasons.push('KSTACK_EVIDENCE_STALE');
  }
  const valid = [];
  for (const candidate of input.candidates) {
    let closure;
    try {
      closure = validateHostConformanceEvidenceClosure({
        ...candidate,
        bodySchemaDigest: input.bodySchemaDigest,
        root,
        expectedProducerProfileDigest: candidate.anchor?.producerProfileDigest,
        expectedObserverSetDigest: input.requirement.observerProfileSetDigest,
        currentEvidenceEpoch: input.currentEvidenceEpoch,
        vocabulary: input.vocabulary
      });
    } catch (error) {
      reasons.push(EVIDENCE_REASON_CODES.includes(error?.code) ? error.code : 'KSTACK_EVIDENCE_SCHEMA_INVALID');
      continue;
    }
    if (candidate.body.hostInstanceDigest !== input.requirement.hostInstanceDigest
        || candidate.body.hostBuildDigest !== input.requirement.hostBuildDigest
        || candidate.body.adapterDigest !== input.requirement.adapterDigest
        || candidate.body.fixtureSetDigest !== input.requirement.fixtureSetDigest
        || !input.requirement.producerProfileDigests.includes(candidate.anchor.producerProfileDigest)) {
      reasons.push('KSTACK_EVIDENCE_SCOPE_MISMATCH');
      continue;
    }
    if (!equivalentEnvironmentSnapshots(candidate.environmentSnapshot, liveEnvironment)) {
      reasons.push('KSTACK_EVIDENCE_STALE');
      continue;
    }
    if (input.trustedNow < candidate.body.issuedAt || input.trustedNow >= candidate.body.expiresAt
        || input.trustedNow < root.notBefore || input.trustedNow >= root.notAfter) {
      reasons.push('KSTACK_EVIDENCE_STALE');
      continue;
    }
    if (candidate.anchor.evidenceEpoch !== input.currentEvidenceEpoch || candidate.anchor.rootGeneration !== root.rootGeneration) {
      reasons.push('KSTACK_EVIDENCE_EPOCH_MISMATCH');
      continue;
    }
    if (isRevoked(candidate.anchor, root, revocations)) {
      reasons.push('KSTACK_EVIDENCE_REVOKED');
      continue;
    }
    valid.push({ ...candidate, ...closure });
  }
  if (reasons.some((code) => !['KSTACK_EVIDENCE_STALE', 'KSTACK_ENVIRONMENT_CHANGED'].includes(code))) return evaluation(reasons);
  if (reasons.length > 0) return evaluation(reasons);

  const candidateByDigest = new Map(valid.map((candidate) => [candidate.wrapperDigest, candidate]));
  const superseded = new Set();
  for (const supersessionInput of input.supersessions) {
    try {
      const supersession = verifyEvidenceSupersession(root, supersessionInput, {
        requirementScopeDigest: input.requirement.requirementScopeDigest,
        fixtureScopeDigest: input.requirement.fixtureScopeDigest,
        environmentSnapshotDigest: supersessionInput.environmentSnapshotDigest,
        currentEvidenceEpoch: input.currentEvidenceEpoch
      });
      const oldCandidate = candidateByDigest.get(supersession.oldEvidenceDigest);
      const newCandidate = candidateByDigest.get(supersession.newEvidenceDigest);
      if (!oldCandidate || !newCandidate || supersession.effectiveAt > input.trustedNow
          || oldCandidate.body.hostInstanceDigest !== newCandidate.body.hostInstanceDigest
          || oldCandidate.body.hostBuildDigest !== newCandidate.body.hostBuildDigest
          || oldCandidate.body.adapterDigest !== newCandidate.body.adapterDigest
          || oldCandidate.body.fixtureSetDigest !== newCandidate.body.fixtureSetDigest
          || oldCandidate.body.environmentDigest !== newCandidate.body.environmentDigest
          || supersession.environmentSnapshotDigest !== oldCandidate.body.environmentDigest
          || supersession.newIndependentRunDigest !== newCandidate.anchor.independentObservationSetDigest) {
        return evaluation(['KSTACK_EVIDENCE_SCOPE_MISMATCH']);
      }
      superseded.add(supersession.oldEvidenceDigest);
    } catch (error) {
      return evaluation([EVIDENCE_REASON_CODES.includes(error?.code) ? error.code : 'KSTACK_EVIDENCE_SCHEMA_INVALID']);
    }
  }
  const byScope = new Map(scopeKeys.map((key) => [key, []]));
  for (const candidate of valid) {
    if (superseded.has(candidate.wrapperDigest)) continue;
    for (const row of candidate.body.results) {
      const key = `${row.capabilityId}\0${row.fixtureId}`;
      if (byScope.has(key)) byScope.get(key).push({ candidate, row });
    }
  }
  for (const entries of byScope.values()) {
    if (entries.length === 0) reasons.push('KSTACK_EVIDENCE_FIXTURE_MISSING');
    if (entries.some(({ row }) => ['NOT_RUN', 'CAPABILITY_UNAVAILABLE', 'HARNESS_ERROR'].includes(row.outcome))) reasons.push('KSTACK_EVIDENCE_OBSERVER_UNAVAILABLE');
    const outcomes = new Set(entries.map(({ row }) => row.outcome));
    if (outcomes.has('PASS') && outcomes.has('FAIL')) reasons.push('KSTACK_EVIDENCE_CONTRADICTORY');
    else if (outcomes.has('FAIL')) reasons.push('KSTACK_EVIDENCE_FIXTURE_FAILED');
  }
  if (reasons.length > 0) return evaluation(reasons);
  const selected = valid.sort((left, right) => {
    const leftRow = left.body.results[0];
    const rightRow = right.body.results[0];
    const leftKey = [leftRow.capabilityId, leftRow.fixtureId, left.anchor.producerProfileDigest, left.bodyDigest].join('\0');
    const rightKey = [rightRow.capabilityId, rightRow.fixtureId, right.anchor.producerProfileDigest, right.bodyDigest].join('\0');
    return Buffer.compare(Buffer.from(leftKey), Buffer.from(rightKey));
  });
  return evaluation([], selected.map((entry) => entry.wrapperDigest));
}

export function safeEvidenceDiagnostic(input) {
  exact(input, ['outcome', 'reasonCodes', 'correlationDigest', 'selectedCount']);
  enumeration(input.outcome, EVIDENCE_OUTCOMES);
  validateSafeReasonCodes(input.reasonCodes);
  digest(input.correlationDigest);
  uint(input.selectedCount);
  const output = {
    outcome: input.outcome,
    reasonCodes: [...input.reasonCodes],
    correlationDigest: input.correlationDigest,
    selectedCount: input.selectedCount
  };
  if (Object.values(output).some((value) => typeof value === 'string' && !DIGEST.test(value) && !SAFE_DIAGNOSTIC_ID.test(value))) {
    fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  }
  return immutable(output);
}

export function exportEd25519PublicKey(publicKey) {
  const key = publicKey instanceof crypto.KeyObject && publicKey.type === 'public'
    ? publicKey
    : crypto.createPublicKey(publicKey);
  if (key.asymmetricKeyType !== 'ed25519') fail('KSTACK_EVIDENCE_ROOT_KEY_INVALID');
  return key.export({ format: 'der', type: 'spki' }).toString('base64url');
}

export function signEvidenceAnchor(unsignedAnchor, privateKey) {
  const candidate = { ...unsignedAnchor, signature: Buffer.alloc(64).toString('base64url') };
  validateEvidenceAnchor(candidate);
  const key = privateKey instanceof crypto.KeyObject && privateKey.type === 'private'
    ? privateKey
    : crypto.createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== 'ed25519') fail('KSTACK_EVIDENCE_SIGNER_INVALID');
  return immutable({ ...unsignedAnchor, signature: crypto.sign(null, evidenceAnchorTranscript(candidate), key).toString('base64url') });
}

export function protectedAdministrationTranscript(domain, value) {
  if (typeof domain !== 'string' || !/^KSTACK-EVIDENCE-[A-Z-]+-SIGNATURE-V1$/u.test(domain)) {
    fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
  }
  return signatureTranscript(domain, value, 'signatures');
}

function validateBackendAdapter(backend, allowTestBackend) {
  exact(backend, [
    'descriptor', 'append', 'hmac', 'verifyTrustedTimeSample', 'measurementBinding', 'measurementSources'
  ], 'KSTACK_EVIDENCE_UNAVAILABLE');
  validateProtectedEvidenceBackend(backend.descriptor, { allowTestBackend });
  if (typeof backend.append !== 'function' || typeof backend.hmac !== 'function'
      || typeof backend.verifyTrustedTimeSample !== 'function' || typeof backend.measurementBinding !== 'function'
      || typeof backend.measurementSources !== 'function') fail('KSTACK_EVIDENCE_UNAVAILABLE');
  return backend;
}

function evidenceObject(name, value) {
  const identity = EVIDENCE_IDENTITIES[name];
  return immutable({
    digest: hostAddress(identity.domain, value),
    bytes: hostCanonicalBytes(value).toString('base64url')
  });
}

export class ProtectedEvidenceKernel {
  #schemaSetDigest;
  #backend;
  #vocabulary;
  #root = null;
  #rootDigest = null;
  #evidenceEpoch = 0;
  #revocations = [];
  #supersessions = [];
  #candidates = [];
  #measurementSequence = 0;
  #catalogSequence = 0;
  #publicationSequence = 0;
  #catalogHeadDigest = null;
  #catalogSnapshot = null;
  #environmentSnapshots = new Map();
  #historicalRoots = new Map();

  constructor(options) {
    exact(options, ['schemaSetDigest', 'backend', 'vocabulary', 'allowTestBackend']);
    this.#schemaSetDigest = digest(options.schemaSetDigest);
    this.#backend = validateBackendAdapter(options.backend, options.allowTestBackend === true);
    this.#vocabulary = options.vocabulary;
  }

  get state() {
    return immutable({
      enrolled: this.#root !== null,
      rootDigest: this.#rootDigest,
      rootGeneration: this.#root?.rootGeneration || 0,
      evidenceEpoch: this.#evidenceEpoch,
      revocationSequence: this.#revocations.length,
      measurementSequence: this.#measurementSequence,
      catalogSequence: this.#catalogSequence,
      publicationSequence: this.#publicationSequence,
      catalogHeadDigest: this.#catalogHeadDigest
    });
  }

  async enrollGenesis(rootInput, ceremony) {
    if (this.#root !== null) fail('KSTACK_EVIDENCE_ROOT_TRANSITION_INVALID');
    exact(ceremony, ['ownerAdminQuorum', 'protectedAuditReceiptDigest']);
    if (ceremony.ownerAdminQuorum !== true) fail('KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID');
    digest(ceremony.protectedAuditReceiptDigest);
    const root = validateEvidenceTrustRoot(rootInput);
    if (root.schemaSetDigest !== this.#schemaSetDigest || root.rootGeneration !== 1) fail('KSTACK_EVIDENCE_ROOT_INVALID');
    const object = evidenceObject('EvidenceTrustRootV1', root);
    await this.#commit([object], 'KSTACK-EVIDENCE-GENESIS-V1');
    this.#root = root;
    this.#rootDigest = object.digest;
    this.#evidenceEpoch = root.evidenceEpoch;
    this.#historicalRoots.set(object.digest, root);
    return immutable({ rootDigest: object.digest, protectedAuditReceiptDigest: ceremony.protectedAuditReceiptDigest });
  }

  async transitionRoot(candidateRootInput, authorizations) {
    if (!this.#root) fail('KSTACK_EVIDENCE_UNAVAILABLE');
    const candidateRoot = verifyEvidenceRootTransition(this.#root, candidateRootInput, authorizations);
    if (candidateRoot.evidenceEpoch < this.#evidenceEpoch) fail('KSTACK_EVIDENCE_ROOT_TRANSITION_INVALID');
    const candidateDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceTrustRootV1.domain, candidateRoot);
    const revokedKeys = new Set(this.#revocations.flatMap((entry) => entry.revokedKeyDigests));
    const revokedRoots = new Set(this.#revocations.flatMap((entry) => entry.revokedRootDigests));
    const revokedProducers = new Set(this.#revocations.flatMap((entry) => entry.revokedProducerDigests));
    const revokedProfiles = new Set(this.#revocations.flatMap((entry) => entry.revokedProfileDigests));
    const allKeys = [...candidateRoot.rootAdminPublicKeys, ...candidateRoot.onlineSignerProfiles];
    if (revokedRoots.has(candidateDigest) || allKeys.some((key) => revokedKeys.has(evidenceKeyDigest(key)))
        || candidateRoot.onlineSignerProfiles.some((profile) => profile.producerProfileDigests.some((entry) => revokedProducers.has(entry))
          || [...profile.producerProfileDigests, ...profile.allowedEvidenceSchemaDigests].some((entry) => revokedProfiles.has(entry)))) {
      fail('KSTACK_EVIDENCE_REVOKED');
    }
    const authorizationObject = {
      currentRootDigest: this.#rootDigest,
      candidateRootDigest: candidateDigest,
      transitionProofDigest: candidateRoot.transitionProofDigest,
      ...authorizations
    };
    const authorizationDigest = hostAddress('KSTACK-EVIDENCE-ROOT-TRANSITION-PROOF-V1', authorizationObject);
    await this.#commit([
      evidenceObject('EvidenceTrustRootV1', candidateRoot),
      { digest: authorizationDigest, bytes: hostCanonicalBytes(authorizationObject).toString('base64url') }
    ], 'KSTACK-EVIDENCE-ROOT-TRANSITION-V1');
    this.#root = candidateRoot;
    this.#rootDigest = candidateDigest;
    this.#evidenceEpoch = candidateRoot.evidenceEpoch;
    this.#historicalRoots.set(candidateDigest, candidateRoot);
    return immutable({ rootDigest: candidateDigest, transitionAuthorizationDigest: authorizationDigest });
  }

  async commitRevocation(revocationInput) {
    if (!this.#root) fail('KSTACK_EVIDENCE_UNAVAILABLE');
    const revocation = validateEvidenceRevocation(revocationInput);
    if (revocation.trustRootDigest !== this.#rootDigest || revocation.rootGeneration !== this.#root.rootGeneration
        || revocation.revocationSequence !== this.#revocations.length + 1
        || revocation.newEvidenceEpoch <= this.#evidenceEpoch) fail('KSTACK_EVIDENCE_ROOT_TRANSITION_INVALID');
    verifyAdminSignatures(this.#root, revocation, 'KSTACK-EVIDENCE-REVOCATION-SIGNATURE-V1', revocation.signatures);
    const object = evidenceObject('EvidenceRevocationV1', revocation);
    await this.#commit([object], 'KSTACK-EVIDENCE-REVOCATION-V1');
    this.#revocations.push(revocation);
    this.#evidenceEpoch = revocation.newEvidenceEpoch;
    return object.digest;
  }

  async measureEnvironment(profileInput, timeSample) {
    if (!this.#root || await this.#backend.verifyTrustedTimeSample(timeSample) !== true) fail('KSTACK_EVIDENCE_UNAVAILABLE');
    const profile = validateEnvironmentMeasurementProfile(profileInput);
    const binding = await this.#backend.measurementBinding(profile);
    const sources = await this.#backend.measurementSources(profile);
    const nextSequence = this.#measurementSequence + 1;
    const snapshot = await collectEnvironmentSnapshot({
      profile,
      binding,
      sources,
      timeSample,
      measurementSequence: nextSequence,
      protectedHmac: (generation, bytes) => this.#backend.hmac(generation, bytes)
    });
    const object = evidenceObject('EnvironmentSnapshotV1', snapshot);
    await this.#commit([object], 'KSTACK-ENVIRONMENT-SNAPSHOT-PUBLICATION-V1');
    this.#measurementSequence = nextSequence;
    this.#environmentSnapshots.set(object.digest, snapshot);
    return immutable({ snapshot, snapshotDigest: object.digest });
  }

  async publishHostConformance(input, timeSample) {
    if (!this.#root || await this.#backend.verifyTrustedTimeSample(timeSample) !== true) fail('KSTACK_EVIDENCE_UNAVAILABLE');
    exact(timeSample, ['sampleDigest', 'wallTime']);
    digest(timeSample.sampleDigest);
    timestamp(timeSample.wallTime);
    const closure = validateHostConformanceEvidenceClosure({
      ...input, root: this.#root, currentEvidenceEpoch: this.#evidenceEpoch, vocabulary: this.#vocabulary
    });
    if (!this.#environmentSnapshots.has(closure.environmentDigest)) fail('KSTACK_EVIDENCE_UNAVAILABLE');
    if (timeSample.wallTime < input.body.issuedAt || timeSample.wallTime >= input.body.expiresAt) fail('KSTACK_EVIDENCE_STALE');
    const publicationSequence = this.#publicationSequence + 1;
    const row = validateEvidenceCatalogRow({
      ...evidenceHead('EvidenceCatalogRowV1', this.#schemaSetDigest),
      payloadDigest: closure.wrapperDigest,
      anchorDigest: closure.anchorDigest,
      payloadSchemaDigest: input.bodySchemaDigest,
      trustRootDigest: closure.rootDigest,
      evidenceEpoch: this.#evidenceEpoch,
      publicationSequence,
      publishedAt: timeSample.wallTime
    });
    const objects = [
      { digest: closure.bodyDigest, bytes: hostCanonicalBytes(input.body).toString('base64url') },
      { digest: closure.anchorDigest, bytes: hostCanonicalBytes(input.anchor).toString('base64url') },
      { digest: closure.wrapperDigest, bytes: hostCanonicalBytes(input.wrapper).toString('base64url') },
      evidenceObject('EvidenceCatalogRowV1', row)
    ];
    await this.#commit(objects, 'KSTACK-EVIDENCE-CATALOG-PUBLICATION-V1');
    this.#publicationSequence = publicationSequence;
    this.#candidates.push(immutable({
      body: input.body,
      anchor: input.anchor,
      wrapper: input.wrapper,
      bodySchemaDigest: input.bodySchemaDigest,
      environmentSnapshot: input.environmentSnapshot,
      expectedProducerProfileDigest: input.expectedProducerProfileDigest,
      expectedObserverSetDigest: input.expectedObserverSetDigest
    }));
    return immutable({ ...closure, catalogRowDigest: objects[3].digest, publicationSequence });
  }

  async commitSupersession(supersessionInput, expected) {
    if (!this.#root) fail('KSTACK_EVIDENCE_UNAVAILABLE');
    const supersession = verifyEvidenceSupersession(this.#root, supersessionInput, {
      ...expected, currentEvidenceEpoch: this.#evidenceEpoch
    });
    const object = evidenceObject('EvidenceSupersessionV1', supersession);
    await this.#commit([object], 'KSTACK-EVIDENCE-SUPERSESSION-V1');
    this.#supersessions.push(supersession);
    return object.digest;
  }

  async freezeCatalog(input) {
    if (!this.#root) fail('KSTACK_EVIDENCE_UNAVAILABLE');
    exact(input, [
      'environmentSnapshotDigest', 'activeSetDigest', 'policyDigest', 'producerRegistryDigest',
      'schemaResolverSetDigest', 'trustedTimeSampleDigest', 'expiresAt'
    ]);
    for (const field of Object.keys(input).filter((field) => field !== 'expiresAt')) digest(input[field]);
    timestamp(input.expiresAt);
    if (!this.#environmentSnapshots.has(input.environmentSnapshotDigest)) fail('KSTACK_EVIDENCE_UNAVAILABLE');
    const nextSequence = this.#catalogSequence + 1;
    const candidateAnchorDigests = [...new Set(this.#candidates.map((entry) => hostAddress(EVIDENCE_IDENTITIES.EvidenceAnchorV1.domain, entry.anchor)))].sort();
    const supersessionDigests = this.#supersessions.map((entry) => hostAddress(EVIDENCE_IDENTITIES.EvidenceSupersessionV1.domain, entry)).sort();
    const revocationSetDigest = hostAddress('KSTACK-EVIDENCE-REVOCATION-SET-V1', {
      revocationDigests: this.#revocations.map((entry) => hostAddress(EVIDENCE_IDENTITIES.EvidenceRevocationV1.domain, entry)).sort()
    });
    const snapshot = validateEvidenceCatalogSnapshot({
      ...evidenceHead('EvidenceCatalogSnapshotV1', this.#schemaSetDigest),
      trustRootDigest: this.#rootDigest,
      rootGeneration: this.#root.rootGeneration,
      revocationSetDigest,
      revocationSequence: this.#revocations.length,
      evidenceEpoch: this.#evidenceEpoch,
      activeSetDigest: input.activeSetDigest,
      policyDigest: input.policyDigest,
      environmentSnapshotDigest: input.environmentSnapshotDigest,
      producerRegistryDigest: input.producerRegistryDigest,
      schemaResolverSetDigest: input.schemaResolverSetDigest,
      catalogSequence: nextSequence,
      previousHeadDigest: this.#catalogHeadDigest,
      candidateAnchorDigests,
      supersessionDigests,
      trustedTimeSampleDigest: input.trustedTimeSampleDigest,
      expiresAt: input.expiresAt
    });
    const object = evidenceObject('EvidenceCatalogSnapshotV1', snapshot);
    await this.#commit([object], 'KSTACK-EVIDENCE-CATALOG-SNAPSHOT-V1');
    this.#catalogSequence = nextSequence;
    this.#catalogHeadDigest = object.digest;
    this.#catalogSnapshot = snapshot;
    return immutable({ snapshot, snapshotDigest: object.digest });
  }

  select(input) {
    if (!this.#root || !this.#catalogHeadDigest) return evaluation(['KSTACK_EVIDENCE_UNAVAILABLE']);
    exact(input, ['requirement', 'liveEnvironmentSnapshot', 'trustedNow', 'bodySchemaDigest']);
    const liveDigest = hostAddress(EVIDENCE_IDENTITIES.EnvironmentSnapshotV1.domain, validateEnvironmentSnapshot(input.liveEnvironmentSnapshot));
    if (!this.#environmentSnapshots.has(liveDigest)) return evaluation(['KSTACK_EVIDENCE_UNAVAILABLE']);
    return selectHostEvidence({
      candidates: this.#candidates,
      requirement: input.requirement,
      root: this.#root,
      revocations: this.#revocations,
      supersessions: this.#supersessions,
      liveEnvironmentSnapshot: input.liveEnvironmentSnapshot,
      trustedNow: input.trustedNow,
      bodySchemaDigest: input.bodySchemaDigest,
      currentEvidenceEpoch: this.#evidenceEpoch,
      vocabulary: this.#vocabulary
    });
  }

  async admit(input) {
    if (!this.#catalogSnapshot) return immutable({ evaluation: evaluation(['KSTACK_EVIDENCE_UNAVAILABLE']), admissionSnapshot: null });
    exact(input, ['requirement', 'liveEnvironmentSnapshot', 'trustedNow', 'bodySchemaDigest']);
    const selected = this.select(input);
    const evidenceSetDigest = selected.outcome === 'VALID'
      ? hostAddress('KSTACK-EVIDENCE-SELECTED-SET-V1', { evidenceDigests: selected.selectedEvidenceDigests })
      : null;
    const evaluationArtifact = validateEvidenceEvaluation({
      ...evidenceHead('EvidenceEvaluationV1', this.#schemaSetDigest),
      outcome: selected.outcome,
      reasonCodes: selected.reasonCodes,
      selectedEvidenceDigests: selected.selectedEvidenceDigests,
      evidenceSetDigest,
      evaluatedAt: input.trustedNow
    });
    const evaluationObject = evidenceObject('EvidenceEvaluationV1', evaluationArtifact);
    if (selected.outcome !== 'VALID') {
      await this.#commit([evaluationObject], 'KSTACK-EVIDENCE-EVALUATION-V1');
      return immutable({ evaluation: evaluationArtifact, admissionSnapshot: null });
    }
    const liveEnvironment = validateEnvironmentSnapshot(input.liveEnvironmentSnapshot);
    const liveEnvironmentDigest = hostAddress(EVIDENCE_IDENTITIES.EnvironmentSnapshotV1.domain, liveEnvironment);
    const selectedDigestSet = new Set(selected.selectedEvidenceDigests);
    const selectedExpiries = this.#candidates
      .filter((candidate) => selectedDigestSet.has(validateHostArtifact('HostConformanceEvidenceV1', candidate.wrapper, { vocabulary: this.#vocabulary }).objectDigest))
      .map((candidate) => candidate.body.expiresAt);
    if (selectedExpiries.length !== selectedDigestSet.size) fail('KSTACK_EVIDENCE_UNAVAILABLE');
    const expiresAt = [liveEnvironment.expiresAt, this.#catalogSnapshot.expiresAt, ...selectedExpiries]
      .sort()[0];
    const admissionSnapshot = validateEvidenceAdmissionSnapshot({
      ...evidenceHead('EvidenceAdmissionSnapshotV1', this.#schemaSetDigest),
      environmentSnapshotDigest: liveEnvironmentDigest,
      measurementSequence: liveEnvironment.measurementSequence,
      activeSetDigest: input.requirement.activeSetDigest,
      policyDigest: input.requirement.policyDigest,
      rootGeneration: this.#root.rootGeneration,
      revocationSequence: this.#revocations.length,
      evidenceEpoch: this.#evidenceEpoch,
      catalogHeadDigest: this.#catalogHeadDigest,
      catalogSequence: this.#catalogSequence,
      requirementProfileDigest: input.requirement.requirementProfileDigest,
      selectedEvidenceDigests: selected.selectedEvidenceDigests,
      evaluationDigest: evaluationObject.digest,
      trustedTimeSampleDigest: liveEnvironment.trustedTimeSampleDigest,
      expiresAt
    });
    await this.#commit([
      evaluationObject,
      evidenceObject('EvidenceAdmissionSnapshotV1', admissionSnapshot)
    ], 'KSTACK-EVIDENCE-ADMISSION-SNAPSHOT-V1');
    return immutable({ evaluation: evaluationArtifact, admissionSnapshot });
  }

  async remeasureAndAdmit(input) {
    exact(input, ['profile', 'timeSample', 'requirement', 'bodySchemaDigest']);
    if (await this.#backend.verifyTrustedTimeSample(input.timeSample) !== true) fail('KSTACK_EVIDENCE_UNAVAILABLE');
    const measurement = await this.measureEnvironment(input.profile, input.timeSample);
    return this.admit({
      requirement: input.requirement,
      liveEnvironmentSnapshot: measurement.snapshot,
      trustedNow: input.timeSample.wallTime,
      bodySchemaDigest: input.bodySchemaDigest
    });
  }

  async #commit(objects, transactionDomain) {
    const digests = objects.map((entry) => digest(entry.digest)).sort();
    if (new Set(digests).size !== digests.length) fail('KSTACK_EVIDENCE_SCHEMA_INVALID');
    const receipt = await this.#backend.append({ transactionDomain, objects });
    exact(receipt, ['committed', 'rereadDigests', 'auditReceiptDigest'], 'KSTACK_EVIDENCE_UNAVAILABLE');
    if (receipt.committed !== true) fail('KSTACK_EVIDENCE_UNAVAILABLE');
    orderedUnique(receipt.rereadDigests, digest, 'KSTACK_EVIDENCE_UNAVAILABLE', digests.length, digests.length);
    digest(receipt.auditReceiptDigest, 'KSTACK_EVIDENCE_UNAVAILABLE');
    if (digests.some((entry, index) => entry !== receipt.rereadDigests[index])) fail('KSTACK_EVIDENCE_UNAVAILABLE');
  }
}

export function createTestProtectedEvidenceBackend(options = {}) {
  const key = options.hmacKey || crypto.randomBytes(32);
  if (!Buffer.isBuffer(key) && !(key instanceof Uint8Array)) fail('KSTACK_EVIDENCE_UNAVAILABLE');
  const objects = new Map();
  let auditHead = `sha256:${'0'.repeat(64)}`;
  return Object.freeze({
    descriptor: Object.freeze({
      protectionClass: 'test-only', repositoryWritable: false, agentWritable: false, durable: true,
      atomicPublication: true, nonExportableKeys: true, appendOnlyAudit: true
    }),
    async append(transaction) {
      exact(transaction, ['transactionDomain', 'objects'], 'KSTACK_EVIDENCE_UNAVAILABLE');
      nonempty(transaction.transactionDomain, 'KSTACK_EVIDENCE_UNAVAILABLE');
      if (!Array.isArray(transaction.objects) || transaction.objects.length < 1) fail('KSTACK_EVIDENCE_UNAVAILABLE');
      const pending = new Map(objects);
      for (const object of transaction.objects) {
        exact(object, ['digest', 'bytes'], 'KSTACK_EVIDENCE_UNAVAILABLE');
        digest(object.digest, 'KSTACK_EVIDENCE_UNAVAILABLE');
        nonempty(object.bytes, 'KSTACK_EVIDENCE_UNAVAILABLE');
        const prior = pending.get(object.digest);
        if (prior !== undefined && prior !== object.bytes) fail('KSTACK_EVIDENCE_UNAVAILABLE');
        pending.set(object.digest, object.bytes);
      }
      const rereadDigests = transaction.objects.map((entry) => entry.digest).sort();
      auditHead = hostAddress('KSTACK-TEST-PROTECTED-EVIDENCE-AUDIT-V1', {
        priorAuditHead: auditHead, transactionDomain: transaction.transactionDomain, objectDigests: rereadDigests
      });
      objects.clear();
      for (const [objectDigest, bytes] of pending) objects.set(objectDigest, bytes);
      return immutable({ committed: true, rereadDigests, auditReceiptDigest: auditHead });
    },
    async hmac(generation, bytes) {
      uint(generation, true, 'KSTACK_ENVIRONMENT_MEASUREMENT_FAILED');
      if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) fail('KSTACK_ENVIRONMENT_MEASUREMENT_FAILED');
      return `sha256:${crypto.createHmac('sha256', key).update(bytes).digest('hex')}`;
    },
    async verifyTrustedTimeSample(timeSample) {
      try {
        exact(timeSample, ['sampleDigest', 'wallTime']);
        digest(timeSample.sampleDigest);
        timestamp(timeSample.wallTime);
        return true;
      } catch { return false; }
    },
    async measurementBinding(profile) {
      if (typeof options.measurementBinding !== 'function') fail('KSTACK_EVIDENCE_UNAVAILABLE');
      return options.measurementBinding(profile);
    },
    async measurementSources(profile) {
      if (typeof options.measurementSources !== 'function') fail('KSTACK_EVIDENCE_UNAVAILABLE');
      return options.measurementSources(profile);
    }
  });
}
