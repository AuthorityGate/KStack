import crypto from 'node:crypto';
import { hostCanonicalBytes, parseHostCanonicalJson } from './kstack-host-contract.mjs';
import { parsePackArtifact } from './kstack-domain-selection.mjs';
import { parseD5Artifact } from './kstack-domain-schema.mjs';
import { confirmTrustedTimeBinding } from './kstack-domain-time-binding.mjs';

export const RESULT_DISPOSITIONS = Object.freeze(['contradicted', 'supported', 'unknown']);
export const EVIDENCE_SOURCE_CLASSES = Object.freeze([
  'github-record', 'health-observation', 'human-attestation', 'jira-record',
  'qualified-citation', 'repository-artifact', 'rollback-receipt', 'workflow-receipt'
]);
export const EVIDENCE_OBSERVATION_KINDS = Object.freeze(['absence', 'asserts', 'refutes', 'unavailable']);
const FRESHNESS_POLICY_IDS = Object.freeze(['release-immediate', 'release-window', 'repository-snapshot', 'timeless-digest']);

const DIGEST = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const LOWER_ID = /^[a-z][a-z0-9-]{0,63}$/u;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const NONCE = /^[a-f0-9]{32,64}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const MAX_ARTIFACT_BYTES = 1024 * 1024;
const MAX_BLOB_BYTES = 16 * 1024 * 1024;

const DOMAINS = Object.freeze({
  'kstack-pack-composition-receipt': 'KSTACK-PACK-COMPOSITION-RECEIPT-V1\n',
  'kstack-pack-dispatch-receipt': 'KSTACK-PACK-DISPATCH-RECEIPT-V1\n',
  'kstack-pack-analysis-result': 'KSTACK-PACK-ANALYSIS-RESULT-V1\n',
  'kstack-native-evidence-record': 'KSTACK-NATIVE-EVIDENCE-RECORD-V1\n',
  'kstack-workflow-evidence-descriptor': 'KSTACK-WORKFLOW-EVIDENCE-DESCRIPTOR-V1\n',
  'kstack-producer-policy-snapshot': 'KSTACK-PRODUCER-POLICY-SNAPSHOT-V1\n',
  'kstack-workflow-evidence-attestation': 'KSTACK-WORKFLOW-EVIDENCE-ATTESTATION-V1\n',
  'kstack-validation-decision': 'KSTACK-VALIDATION-DECISION-V1\n'
});
const RAW_TYPES = Object.freeze(new Set([
  'kstack-final-prompt', 'kstack-provider-request-body', 'kstack-provider-response',
  'kstack-observation-bytes', 'kstack-repository-policy', 'kstack-compatibility-matrix',
  'kstack-base-brief', 'kstack-base-lane-contract', 'kstack-tokenizer-receipt',
  'kstack-pack-bundle', 'kstack-provider-configuration',
  'kstack-model-configuration', 'kstack-dispatch-policy', 'kstack-budget-receipt',
  'kstack-freshness-receipt'
]));
const PACK_TYPES = Object.freeze(new Set(['kstack-pack-selection', 'kstack-pack-snapshot']));
const D5_TYPES = Object.freeze(new Set(['kstack-pack-content', 'kstack-pack-evidence-schema']));

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exact(value, keys, code) {
  const actual = plain(value) ? Object.keys(value).sort() : [];
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}

function string(value, expression, code, maximum = 256) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !value.isWellFormed()
      || value.normalize('NFC') !== value || CONTROL_OR_BIDI.test(value) || !expression.test(value)) fail(code);
  return value;
}

function digest(value, code) {
  return string(value, DIGEST, code, 64);
}

function sameDigest(left, right, code) {
  const a = Buffer.from(digest(left, code), 'hex');
  const b = Buffer.from(digest(right, code), 'hex');
  if (!crypto.timingSafeEqual(a, b)) fail(code);
}

function integer(value, minimum, maximum, code) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code);
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

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function sortedUnique(values, allowed, code, allowEmpty = false) {
  if (!Array.isArray(values) || values.length > allowed.length || (!allowEmpty && values.length === 0)) fail(code);
  const output = values.map((value) => {
    if (!allowed.includes(value)) fail(code);
    return value;
  });
  const sorted = [...output].sort(compareUtf8);
  if (new Set(output).size !== output.length || output.some((value, index) => value !== sorted[index])) fail(code);
  return output;
}

function idSet(values, code, allowEmpty = false, maximum = 2048) {
  if (!Array.isArray(values) || values.length > maximum || (!allowEmpty && values.length === 0)) fail(code);
  const output = values.map((value) => string(value, LOWER_ID, code, 64));
  if (new Set(output).size !== output.length) fail(code);
  return output;
}

function immutable(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

function domainDigest(domain, value) {
  return crypto.createHash('sha256').update(Buffer.from(domain, 'utf8')).update(hostCanonicalBytes(value)).digest('hex');
}

function rawDigest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function strictBase64(value, code, maximum = MAX_BLOB_BYTES) {
  if (typeof value !== 'string' || value.length > Math.ceil(maximum / 3) * 4 || value.length % 4 !== 0
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) fail(code);
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length > maximum || bytes.toString('base64') !== value) fail(code);
  return bytes;
}

function artifactResult(record) {
  const canonicalBytes = hostCanonicalBytes(record);
  return immutable({ record, canonicalBytes, artifactDigest: domainDigest(DOMAINS[record.artifactType], record) });
}

function validateOrderedPack(input) {
  const code = 'COMPOSITION_RECEIPT_INVALID';
  exact(input, ['packId', 'version', 'bundleDigest', 'contentDigest', 'evidenceSchemaDigest'], code);
  return {
    packId: string(input.packId, LOWER_ID, code, 64),
    version: string(input.version, /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u, code, 128),
    bundleDigest: digest(input.bundleDigest, code), contentDigest: digest(input.contentDigest, code),
    evidenceSchemaDigest: digest(input.evidenceSchemaDigest, code)
  };
}

function validateRenderedQuestion(input) {
  const code = 'COMPOSITION_RECEIPT_INVALID';
  exact(input, ['packId', 'sectionId', 'questionId', 'orderedEvidenceIds'], code);
  return {
    packId: string(input.packId, LOWER_ID, code, 64),
    sectionId: string(input.sectionId, LOWER_ID, code, 64),
    questionId: string(input.questionId, LOWER_ID, code, 64),
    orderedEvidenceIds: idSet(input.orderedEvidenceIds, code, true, 64)
  };
}

function validateComposition(input) {
  const code = 'COMPOSITION_RECEIPT_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId', 'subjectDigest',
    'selectionDigest', 'snapshotDigest', 'expectedGeneration', 'repositoryPolicyDigest',
    'compatibilityMatrixDigest', 'baseBriefDigest', 'baseLaneContractDigest',
    'orderedPacks', 'renderedInventory', 'baseUtf8Bytes', 'packUtf8Bytes', 'finalUtf8Bytes',
    'tokenizerReceiptDigest', 'finalPromptDigest', 'composedAt'
  ], code);
  if (input.artifactType !== 'kstack-pack-composition-receipt' || input.schemaVersion !== 1
      || !Array.isArray(input.orderedPacks) || input.orderedPacks.length < 1 || input.orderedPacks.length > 256
      || !Array.isArray(input.renderedInventory) || input.renderedInventory.length < 1 || input.renderedInventory.length > 4096) fail(code);
  const orderedPacks = input.orderedPacks.map(validateOrderedPack);
  const renderedInventory = input.renderedInventory.map(validateRenderedQuestion);
  if (new Set(orderedPacks.map((entry) => entry.packId)).size !== orderedPacks.length
      || new Set(renderedInventory.map((entry) => `${entry.packId}\u0000${entry.sectionId}\u0000${entry.questionId}`)).size !== renderedInventory.length
      || new Set(renderedInventory.map((entry) => `${entry.packId}\u0000${entry.questionId}`)).size !== renderedInventory.length
      || renderedInventory.some((entry) => !orderedPacks.some((pack) => pack.packId === entry.packId))) fail(code);
  const baseUtf8Bytes = integer(input.baseUtf8Bytes, 0, MAX_BLOB_BYTES, code);
  const packUtf8Bytes = integer(input.packUtf8Bytes, 0, MAX_BLOB_BYTES, code);
  const finalUtf8Bytes = integer(input.finalUtf8Bytes, 1, MAX_BLOB_BYTES, code);
  if (baseUtf8Bytes + packUtf8Bytes !== finalUtf8Bytes) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1,
    projectId: string(input.projectId, ID, code), repositoryImmutableId: string(input.repositoryImmutableId, ID, code),
    subjectDigest: digest(input.subjectDigest, code), selectionDigest: digest(input.selectionDigest, code),
    snapshotDigest: digest(input.snapshotDigest, code), expectedGeneration: integer(input.expectedGeneration, 0, Number.MAX_SAFE_INTEGER, code),
    repositoryPolicyDigest: digest(input.repositoryPolicyDigest, code), compatibilityMatrixDigest: digest(input.compatibilityMatrixDigest, code),
    baseBriefDigest: digest(input.baseBriefDigest, code), baseLaneContractDigest: digest(input.baseLaneContractDigest, code),
    orderedPacks, renderedInventory, baseUtf8Bytes, packUtf8Bytes, finalUtf8Bytes,
    tokenizerReceiptDigest: digest(input.tokenizerReceiptDigest, code), finalPromptDigest: digest(input.finalPromptDigest, code),
    composedAt: instant(input.composedAt, code)
  };
}

function validateDispatch(input) {
  const code = 'DISPATCH_RECEIPT_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId', 'subjectDigest',
    'compositionReceiptDigest', 'finalPromptDigest', 'providerRequestBodyDigest',
    'providerConfigurationDigest', 'modelConfigurationDigest', 'dispatchPolicyDigest',
    'budgetReceiptDigest', 'freshnessReceiptDigest', 'catalogGuardCheckpointDigest',
    'invocationId', 'admittedAt'
  ], code);
  if (input.artifactType !== 'kstack-pack-dispatch-receipt' || input.schemaVersion !== 1) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1,
    projectId: string(input.projectId, ID, code), repositoryImmutableId: string(input.repositoryImmutableId, ID, code),
    subjectDigest: digest(input.subjectDigest, code), compositionReceiptDigest: digest(input.compositionReceiptDigest, code),
    finalPromptDigest: digest(input.finalPromptDigest, code), providerRequestBodyDigest: digest(input.providerRequestBodyDigest, code),
    providerConfigurationDigest: digest(input.providerConfigurationDigest, code), modelConfigurationDigest: digest(input.modelConfigurationDigest, code),
    dispatchPolicyDigest: digest(input.dispatchPolicyDigest, code), budgetReceiptDigest: digest(input.budgetReceiptDigest, code),
    freshnessReceiptDigest: digest(input.freshnessReceiptDigest, code), catalogGuardCheckpointDigest: digest(input.catalogGuardCheckpointDigest, code),
    invocationId: string(input.invocationId, ID, code), admittedAt: instant(input.admittedAt, code)
  };
}

function validateAnswer(input) {
  const code = 'RESULT_SCHEMA_INVALID';
  exact(input, ['packId', 'sectionId', 'questionId', 'disposition', 'evidenceIds', 'observationDigest'], code);
  if (!RESULT_DISPOSITIONS.includes(input.disposition)) fail(code);
  return {
    packId: string(input.packId, LOWER_ID, code, 64), sectionId: string(input.sectionId, LOWER_ID, code, 64),
    questionId: string(input.questionId, LOWER_ID, code, 64), disposition: input.disposition,
    evidenceIds: idSet(input.evidenceIds, code, true, 64), observationDigest: digest(input.observationDigest, code)
  };
}

function validateAnalysis(input) {
  const code = 'RESULT_SCHEMA_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'compositionReceiptDigest', 'dispatchReceiptDigest', 'providerResponseDigest', 'subjectDigest', 'answers'], code);
  if (input.artifactType !== 'kstack-pack-analysis-result' || input.schemaVersion !== 1
      || !Array.isArray(input.answers) || input.answers.length < 1 || input.answers.length > 4096) fail(code);
  const answers = input.answers.map(validateAnswer);
  if (new Set(answers.map((entry) => `${entry.packId}\u0000${entry.sectionId}\u0000${entry.questionId}`)).size !== answers.length) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1,
    compositionReceiptDigest: digest(input.compositionReceiptDigest, code), dispatchReceiptDigest: digest(input.dispatchReceiptDigest, code),
    providerResponseDigest: digest(input.providerResponseDigest, code), subjectDigest: digest(input.subjectDigest, code), answers
  };
}

function validateNativeEvidence(input) {
  const code = 'EVIDENCE_SOURCE_DIGEST_MISMATCH';
  exact(input, ['artifactType', 'schemaVersion', 'sourceClass', 'sourceLocatorDigest', 'sourceBytesBase64', 'nativeReceiptDigest'], code);
  if (input.artifactType !== 'kstack-native-evidence-record' || input.schemaVersion !== 1
      || !EVIDENCE_SOURCE_CLASSES.includes(input.sourceClass)) fail(code);
  if (strictBase64(input.sourceBytesBase64, code).length < 1) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1, sourceClass: input.sourceClass,
    sourceLocatorDigest: digest(input.sourceLocatorDigest, code), sourceBytesBase64: input.sourceBytesBase64,
    nativeReceiptDigest: digest(input.nativeReceiptDigest, code)
  };
}

function validateDescriptor(input) {
  const code = 'EVIDENCE_DESCRIPTOR_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId', 'workflowClass',
    'producerContractDigest', 'producerPolicyDigest', 'subjectDigest', 'compositionReceiptDigest',
    'dispatchReceiptDigest', 'packId', 'questionId', 'evidenceId', 'evidenceOrdinal', 'sourceClass',
    'sourceLocatorDigest', 'sourceDigest', 'observationKind', 'observedAt', 'producedAt',
    'expiresAt', 'producerInvocationId'
  ], code);
  if (input.artifactType !== 'kstack-workflow-evidence-descriptor' || input.schemaVersion !== 1
      || !EVIDENCE_SOURCE_CLASSES.includes(input.sourceClass) || !EVIDENCE_OBSERVATION_KINDS.includes(input.observationKind)) fail(code);
  const descriptor = {
    artifactType: input.artifactType, schemaVersion: 1,
    projectId: string(input.projectId, ID, code), repositoryImmutableId: string(input.repositoryImmutableId, ID, code),
    workflowClass: string(input.workflowClass, LOWER_ID, code, 64), producerContractDigest: digest(input.producerContractDigest, code),
    producerPolicyDigest: digest(input.producerPolicyDigest, code), subjectDigest: digest(input.subjectDigest, code),
    compositionReceiptDigest: digest(input.compositionReceiptDigest, code), dispatchReceiptDigest: digest(input.dispatchReceiptDigest, code),
    packId: string(input.packId, LOWER_ID, code, 64), questionId: string(input.questionId, LOWER_ID, code, 64),
    evidenceId: string(input.evidenceId, LOWER_ID, code, 64),
    evidenceOrdinal: integer(input.evidenceOrdinal, 0, 31, code), sourceClass: input.sourceClass,
    sourceLocatorDigest: digest(input.sourceLocatorDigest, code), sourceDigest: digest(input.sourceDigest, code),
    observationKind: input.observationKind, observedAt: instant(input.observedAt, code),
    producedAt: instant(input.producedAt, code), expiresAt: instant(input.expiresAt, code),
    producerInvocationId: string(input.producerInvocationId, ID, code)
  };
  if (Date.parse(descriptor.observedAt) > Date.parse(descriptor.producedAt)
      || Date.parse(descriptor.producedAt) >= Date.parse(descriptor.expiresAt)) fail(code);
  return descriptor;
}

function validateTrustKey(input, code) {
  exact(input, ['keyId', 'algorithm', 'publicKeyBase64', 'status', 'qualified'], code);
  if (input.algorithm !== 'ed25519' || input.status !== 'active' || input.qualified !== true) fail(code);
  const publicKeyBytes = strictBase64(input.publicKeyBase64, code, 1024);
  try {
    const key = crypto.createPublicKey({ key: publicKeyBytes, format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ed25519') fail(code);
  } catch { fail(code); }
  return { keyId: string(input.keyId, KEY_ID, code, 128), algorithm: 'ed25519', publicKeyBase64: input.publicKeyBase64, status: 'active', qualified: true };
}

export function validateProducerTrustRoot(input, expected = {}) {
  const code = 'PRODUCER_TRUST_ROOT_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId', 'keys', 'policyVersion', 'effectiveAt'], code);
  if (input.artifactType !== 'kstack-producer-trust-root' || input.schemaVersion !== 1
      || !Array.isArray(input.keys) || input.keys.length < 1 || input.keys.length > 32) fail(code);
  const projectId = string(input.projectId, ID, code);
  const repositoryImmutableId = string(input.repositoryImmutableId, ID, code);
  if (expected.projectId !== undefined && expected.projectId !== projectId) fail(code);
  if (expected.repositoryImmutableId !== undefined && expected.repositoryImmutableId !== repositoryImmutableId) fail(code);
  const keys = input.keys.map((entry) => validateTrustKey(entry, code));
  if (new Set(keys.map((entry) => entry.keyId)).size !== keys.length
      || keys.some((entry, index) => entry.keyId !== [...keys].sort((a, b) => compareUtf8(a.keyId, b.keyId))[index].keyId)) fail(code);
  const record = {
    artifactType: input.artifactType, schemaVersion: 1, projectId, repositoryImmutableId, keys,
    policyVersion: integer(input.policyVersion, 1, 2_147_483_647, code), effectiveAt: instant(input.effectiveAt, code)
  };
  return immutable({ record, producerTrustRootDigest: domainDigest('KSTACK-PRODUCER-TRUST-ROOT-V1\n', record) });
}

export function parseProducerTrustRoot(bytes, protection, expected = {}) {
  const code = 'PRODUCER_TRUST_ROOT_UNAVAILABLE';
  exact(protection, ['source', 'repositoryResident', 'protected'], code);
  if (protection.source !== 'external-broker' || protection.repositoryResident !== false || protection.protected !== true) fail(code);
  let value;
  try { value = parseHostCanonicalJson(bytes); } catch { fail(code); }
  return validateProducerTrustRoot(value, expected);
}

function validateProducer(input) {
  const code = 'PRODUCER_POLICY_INVALID';
  exact(input, ['workflowClass', 'producerContractDigest', 'producerPolicyDigest', 'workloadIdentityDigest', 'allowedSourceClasses', 'status'], code);
  if (input.status !== 'active') fail(code);
  return {
    workflowClass: string(input.workflowClass, LOWER_ID, code, 64), producerContractDigest: digest(input.producerContractDigest, code),
    producerPolicyDigest: digest(input.producerPolicyDigest, code), workloadIdentityDigest: digest(input.workloadIdentityDigest, code),
    allowedSourceClasses: sortedUnique(input.allowedSourceClasses, EVIDENCE_SOURCE_CLASSES, code), status: 'active'
  };
}

function validatePolicySnapshot(input) {
  const code = 'PRODUCER_POLICY_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId', 'generation',
    'predecessorSnapshotDigest', 'producerTrustRootDigest', 'producers', 'brokerKeys',
    'revokedAttestationNonces', 'issuedAt', 'expiresAt', 'signatureKeyId', 'signatureBase64'
  ], code);
  if (input.artifactType !== 'kstack-producer-policy-snapshot' || input.schemaVersion !== 1
      || !Array.isArray(input.producers) || input.producers.length < 1 || input.producers.length > 512
      || !Array.isArray(input.brokerKeys) || input.brokerKeys.length < 1 || input.brokerKeys.length > 32) fail(code);
  const producers = input.producers.map(validateProducer);
  const producerKeys = producers.map((entry) => `${entry.workflowClass}\u0000${entry.producerContractDigest}`);
  if (new Set(producerKeys).size !== producerKeys.length || producerKeys.some((key, index) => key !== [...producerKeys].sort(compareUtf8)[index])) fail(code);
  const brokerKeys = input.brokerKeys.map((entry) => validateTrustKey(entry, code));
  if (new Set(brokerKeys.map((entry) => entry.keyId)).size !== brokerKeys.length
      || brokerKeys.some((entry, index) => entry.keyId !== [...brokerKeys].sort((a, b) => compareUtf8(a.keyId, b.keyId))[index].keyId)) fail(code);
  const revokedAttestationNonces = Array.isArray(input.revokedAttestationNonces)
    ? input.revokedAttestationNonces.map((entry) => digest(entry, code)) : fail(code);
  const sortedRevoked = [...revokedAttestationNonces].sort(compareUtf8);
  if (new Set(revokedAttestationNonces).size !== revokedAttestationNonces.length
      || revokedAttestationNonces.some((entry, index) => entry !== sortedRevoked[index])) fail(code);
  strictBase64(input.signatureBase64, code, 1024);
  const record = {
    artifactType: input.artifactType, schemaVersion: 1,
    projectId: string(input.projectId, ID, code), repositoryImmutableId: string(input.repositoryImmutableId, ID, code),
    generation: integer(input.generation, 1, Number.MAX_SAFE_INTEGER, code),
    predecessorSnapshotDigest: input.predecessorSnapshotDigest === null ? null : digest(input.predecessorSnapshotDigest, code),
    producerTrustRootDigest: digest(input.producerTrustRootDigest, code), producers, brokerKeys, revokedAttestationNonces,
    issuedAt: instant(input.issuedAt, code), expiresAt: instant(input.expiresAt, code),
    signatureKeyId: string(input.signatureKeyId, KEY_ID, code, 128), signatureBase64: input.signatureBase64
  };
  if (Date.parse(record.issuedAt) >= Date.parse(record.expiresAt)) fail(code);
  return record;
}

function validateAttestation(input) {
  const code = 'EVIDENCE_ATTESTATION_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'descriptorDigest', 'workloadIdentityDigest',
    'producerPolicySnapshotDigest', 'producerPolicyGeneration', 'brokerKeyId',
    'issuedAt', 'expiresAt', 'nonce', 'signatureBase64'
  ], code);
  if (input.artifactType !== 'kstack-workflow-evidence-attestation' || input.schemaVersion !== 1) fail(code);
  strictBase64(input.signatureBase64, code, 1024);
  const record = {
    artifactType: input.artifactType, schemaVersion: 1, descriptorDigest: digest(input.descriptorDigest, code),
    workloadIdentityDigest: digest(input.workloadIdentityDigest, code), producerPolicySnapshotDigest: digest(input.producerPolicySnapshotDigest, code),
    producerPolicyGeneration: integer(input.producerPolicyGeneration, 1, Number.MAX_SAFE_INTEGER, code),
    brokerKeyId: string(input.brokerKeyId, KEY_ID, code, 128), issuedAt: instant(input.issuedAt, code),
    expiresAt: instant(input.expiresAt, code), nonce: string(input.nonce, NONCE, code, 128), signatureBase64: input.signatureBase64
  };
  if (Date.parse(record.issuedAt) >= Date.parse(record.expiresAt)) fail(code);
  return record;
}

function validateDecision(input) {
  const code = 'VALIDATION_DECISION_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId', 'subjectDigest',
    'compositionReceiptDigest', 'dispatchReceiptDigest', 'analysisResultDigest', 'inputSetDigest',
    'orderedDispositions', 'validatorImplementationDigest', 'validatorSchemaDigest',
    'coordinatorPolicyDigest', 'transactionId', 'decidedAt', 'expiresAt'
  ], code);
  if (input.artifactType !== 'kstack-validation-decision' || input.schemaVersion !== 1
      || !Array.isArray(input.orderedDispositions) || input.orderedDispositions.length < 1) fail(code);
  const orderedDispositions = input.orderedDispositions.map((entry) => {
    exact(entry, ['packId', 'sectionId', 'questionId', 'disposition', 'reasonCodes'], code);
    if (!RESULT_DISPOSITIONS.includes(entry.disposition) || !Array.isArray(entry.reasonCodes) || entry.reasonCodes.length < 1) fail(code);
    const reasonCodes = entry.reasonCodes.map((reason) => string(reason, /^[A-Z][A-Z0-9_]{0,127}$/u, code, 128));
    if (new Set(reasonCodes).size !== reasonCodes.length || reasonCodes.some((reason, index) => reason !== [...reasonCodes].sort(compareUtf8)[index])) fail(code);
    return { packId: string(entry.packId, LOWER_ID, code, 64), sectionId: string(entry.sectionId, LOWER_ID, code, 64), questionId: string(entry.questionId, LOWER_ID, code, 64), disposition: entry.disposition, reasonCodes };
  });
  const record = {
    artifactType: input.artifactType, schemaVersion: 1,
    projectId: string(input.projectId, ID, code), repositoryImmutableId: string(input.repositoryImmutableId, ID, code),
    subjectDigest: digest(input.subjectDigest, code), compositionReceiptDigest: digest(input.compositionReceiptDigest, code),
    dispatchReceiptDigest: digest(input.dispatchReceiptDigest, code), analysisResultDigest: digest(input.analysisResultDigest, code),
    inputSetDigest: digest(input.inputSetDigest, code), orderedDispositions,
    validatorImplementationDigest: digest(input.validatorImplementationDigest, code), validatorSchemaDigest: digest(input.validatorSchemaDigest, code),
    coordinatorPolicyDigest: digest(input.coordinatorPolicyDigest, code), transactionId: string(input.transactionId, ID, code),
    decidedAt: instant(input.decidedAt, code), expiresAt: instant(input.expiresAt, code)
  };
  if (Date.parse(record.decidedAt) >= Date.parse(record.expiresAt)) fail(code);
  return record;
}

const VALIDATORS = Object.freeze({
  'kstack-pack-composition-receipt': validateComposition,
  'kstack-pack-dispatch-receipt': validateDispatch,
  'kstack-pack-analysis-result': validateAnalysis,
  'kstack-native-evidence-record': validateNativeEvidence,
  'kstack-workflow-evidence-descriptor': validateDescriptor,
  'kstack-producer-policy-snapshot': validatePolicySnapshot,
  'kstack-workflow-evidence-attestation': validateAttestation,
  'kstack-validation-decision': validateDecision
});

export function createResultArtifact(input) {
  if (!plain(input) || !VALIDATORS[input.artifactType]) fail('RESULT_ARTIFACT_TYPE_INVALID');
  return artifactResult(VALIDATORS[input.artifactType](input));
}

export function parseResultArtifact(bytes, expectedArtifactType, expectedDigest) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array) || bytes.length > MAX_ARTIFACT_BYTES) fail('RESULT_ARTIFACT_INVALID');
  if (!VALIDATORS[expectedArtifactType]) fail('RESULT_ARTIFACT_TYPE_INVALID');
  let parsed;
  try { parsed = parseHostCanonicalJson(bytes); } catch { fail('RESULT_ARTIFACT_INVALID'); }
  if (parsed.artifactType !== expectedArtifactType) fail('RESULT_ARTIFACT_TYPE_INVALID');
  const result = artifactResult(VALIDATORS[expectedArtifactType](parsed));
  if (!result.canonicalBytes.equals(Buffer.from(bytes))) fail('RESULT_ARTIFACT_INVALID');
  if (expectedDigest !== undefined) sameDigest(result.artifactDigest, expectedDigest, 'RESULT_ARTIFACT_DIGEST_MISMATCH');
  return result;
}

function validateInventory(input) {
  const code = 'RESULT_INVENTORY_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'operationReceiptDigest', 'entries'], code);
  if (input.artifactType !== 'kstack-result-validation-inventory' || input.schemaVersion !== 1
      || !Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 16_384) fail(code);
  const entries = input.entries.map((entry) => {
    exact(entry, ['artifactType', 'digest', 'bytesBase64'], code);
    const bytes = strictBase64(entry.bytesBase64, code);
    let computed;
    if (RAW_TYPES.has(entry.artifactType)) computed = rawDigest(bytes);
    else if (PACK_TYPES.has(entry.artifactType)) computed = parsePackArtifact(bytes, entry.artifactType).artifactDigest;
    else if (D5_TYPES.has(entry.artifactType)) computed = parseD5Artifact(bytes, entry.artifactType).artifactDigest;
    else if (VALIDATORS[entry.artifactType]) computed = parseResultArtifact(bytes, entry.artifactType).artifactDigest;
    else fail(code);
    sameDigest(computed, entry.digest, code);
    return { artifactType: entry.artifactType, digest: computed, bytesBase64: entry.bytesBase64 };
  });
  const keys = entries.map((entry) => `${entry.artifactType}\u0000${entry.digest}`);
  if (new Set(keys).size !== keys.length || keys.some((key, index) => key !== [...keys].sort(compareUtf8)[index])) fail(code);
  return { artifactType: input.artifactType, schemaVersion: 1, operationReceiptDigest: digest(input.operationReceiptDigest, code), entries };
}

export function createResultValidationInventory(input) {
  const code = 'RESULT_INVENTORY_INVALID';
  exact(input, ['operationReceiptDigest', 'artifacts'], code);
  if (!Array.isArray(input.artifacts) || input.artifacts.length < 1) fail(code);
  const entries = input.artifacts.map((artifact) => {
    exact(artifact, ['artifactType', 'digest', 'bytes'], code);
    if (!Buffer.isBuffer(artifact.bytes) && !(artifact.bytes instanceof Uint8Array)) fail(code);
    let computed;
    if (RAW_TYPES.has(artifact.artifactType)) computed = rawDigest(artifact.bytes);
    else if (PACK_TYPES.has(artifact.artifactType)) computed = parsePackArtifact(artifact.bytes, artifact.artifactType).artifactDigest;
    else if (D5_TYPES.has(artifact.artifactType)) computed = parseD5Artifact(artifact.bytes, artifact.artifactType).artifactDigest;
    else computed = parseResultArtifact(artifact.bytes, artifact.artifactType).artifactDigest;
    sameDigest(computed, artifact.digest, code);
    return { artifactType: artifact.artifactType, digest: computed, bytesBase64: Buffer.from(artifact.bytes).toString('base64') };
  }).sort((a, b) => compareUtf8(`${a.artifactType}\u0000${a.digest}`, `${b.artifactType}\u0000${b.digest}`));
  const record = validateInventory({ artifactType: 'kstack-result-validation-inventory', schemaVersion: 1, operationReceiptDigest: input.operationReceiptDigest, entries });
  const canonicalBytes = hostCanonicalBytes(record);
  return immutable({ record, canonicalBytes, inventoryDigest: domainDigest('KSTACK-RESULT-VALIDATION-INVENTORY-V1\n', record) });
}

function openInventory(bytes, expectedDigest, expectedOperationReceiptDigest) {
  let parsed;
  try { parsed = parseHostCanonicalJson(bytes); } catch { fail('RESULT_INVENTORY_INVALID'); }
  const record = validateInventory(parsed);
  const canonicalBytes = hostCanonicalBytes(record);
  if (!canonicalBytes.equals(Buffer.from(bytes))) fail('RESULT_INVENTORY_INVALID');
  const inventoryDigest = domainDigest('KSTACK-RESULT-VALIDATION-INVENTORY-V1\n', record);
  sameDigest(inventoryDigest, expectedDigest, 'RESULT_INVENTORY_MISMATCH');
  sameDigest(record.operationReceiptDigest, expectedOperationReceiptDigest, 'RESULT_INVENTORY_MISMATCH');
  const used = new Set();
  const key = (type, value) => `${type}\u0000${value}`;
  const entries = new Map(record.entries.map((entry) => [key(entry.artifactType, entry.digest), entry]));
  return {
    record, inventoryDigest,
    resolve(type, value) {
      const entry = entries.get(key(type, digest(value, 'RESULT_INVENTORY_INVALID')));
      if (!entry) fail('RESULT_INVENTORY_MISMATCH');
      used.add(key(type, value));
      const artifactBytes = Buffer.from(entry.bytesBase64, 'base64');
      if (RAW_TYPES.has(type)) return immutable({ bytes: artifactBytes, digest: entry.digest });
      if (PACK_TYPES.has(type)) return parsePackArtifact(artifactBytes, type, entry.digest);
      if (D5_TYPES.has(type)) return parseD5Artifact(artifactBytes, type, entry.digest);
      return parseResultArtifact(artifactBytes, type, entry.digest);
    },
    all(type) {
      const matches = record.entries.filter((entry) => entry.artifactType === type).map((entry) => this.resolve(type, entry.digest));
      return matches;
    },
    assertComplete() {
      if (used.size !== record.entries.length) fail('RESULT_INVENTORY_MISMATCH');
    }
  };
}

function unsigned(record, signatureField = 'signatureBase64') {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== signatureField));
}

function verifyEd25519(publicKeyBase64, domain, record, signatureBase64, code) {
  let key;
  try { key = crypto.createPublicKey({ key: strictBase64(publicKeyBase64, code, 1024), format: 'der', type: 'spki' }); } catch { fail(code); }
  if (key.asymmetricKeyType !== 'ed25519') fail(code);
  const transcript = Buffer.concat([Buffer.from(domain, 'utf8'), hostCanonicalBytes(unsigned(record))]);
  try {
    if (!crypto.verify(null, transcript, key, strictBase64(signatureBase64, code, 1024))) fail(code);
  } catch { fail(code); }
}

function freshnessPolicyProjection(input) {
  const code = 'EVIDENCE_FRESHNESS_POLICY_UNAVAILABLE';
  exact(input, ['policyDigest', 'trustedTimeReceiptDigest', 'qualified', 'rollbackDetected', 'maxFutureSkewMs', 'policies'], code);
  if (input.qualified !== true || input.rollbackDetected !== false || !Array.isArray(input.policies)
      || input.policies.length !== FRESHNESS_POLICY_IDS.length) fail(code);
  const policies = input.policies.map((entry, index) => {
    exact(entry, ['freshnessPolicyId', 'maxAgeMs'], code);
    if (entry.freshnessPolicyId !== FRESHNESS_POLICY_IDS[index]) fail(code);
    const maxAgeMs = entry.maxAgeMs === null ? null : integer(entry.maxAgeMs, 0, Number.MAX_SAFE_INTEGER, code);
    if ((entry.freshnessPolicyId === 'timeless-digest') !== (maxAgeMs === null)) fail(code);
    return { freshnessPolicyId: entry.freshnessPolicyId, maxAgeMs };
  });
  return {
    policyDigest: digest(input.policyDigest, code),
    trustedTimeReceiptDigest: digest(input.trustedTimeReceiptDigest, code),
    qualified: true, rollbackDetected: false,
    maxFutureSkewMs: integer(input.maxFutureSkewMs, 0, Number.MAX_SAFE_INTEGER, code), policies
  };
}

function inputSetDigest(inventory, trustRootDigest, time, freshness, request) {
  return domainDigest('KSTACK-RESULT-VALIDATION-INPUT-SET-V1\n', {
    operationReceiptDigest: inventory.record.operationReceiptDigest,
    entries: inventory.record.entries.map(({ artifactType, digest: entryDigest }) => ({ artifactType, digest: entryDigest })),
    producerTrustRootDigest: trustRootDigest,
    producerTrustRootProtection: request.producerTrustRootProtection,
    expectedCompositionDigest: request.expectedCompositionDigest,
    expectedDispatchDigest: request.expectedDispatchDigest,
    expectedAnalysisResultDigest: request.expectedAnalysisResultDigest,
    trustedTimePolicyDigest: time.policyDigest,
    trustedTimeAnchorDigest: time.anchorDigest,
    trustedTimeUseReceiptDigest: time.useReceiptDigest,
    trustedTimeAuthorityCheckpointDigest: time.checkpointDigest,
    trustedNow: time.now,
    freshnessPolicyProjection: freshness,
    validatorImplementationDigest: request.validatorImplementationDigest,
    validatorSchemaDigest: request.validatorSchemaDigest,
    coordinatorPolicyDigest: request.coordinatorPolicyDigest,
    transactionId: request.transactionId
  });
}

export function validateResultCandidate(input) {
  const code = 'RESULT_VALIDATION_INPUT_INVALID';
  exact(input, [
    'inventoryBytes', 'expectedInventoryDigest', 'expectedOperationReceiptDigest',
    'expectedCompositionDigest', 'expectedDispatchDigest', 'expectedAnalysisResultDigest',
    'producerTrustRootBytes', 'producerTrustRootProtection', 'expectedProducerTrustRootDigest',
    'trustedTime', 'trustedTimeAuthority', 'freshnessPolicyProjection', 'validatorImplementationDigest', 'validatorSchemaDigest',
    'coordinatorPolicyDigest', 'transactionId'
  ], code);
  const time = confirmTrustedTimeBinding(input.trustedTime, input.trustedTimeAuthority, 'EVIDENCE_TRUSTED_TIME_UNAVAILABLE');
  const freshness = freshnessPolicyProjection(input.freshnessPolicyProjection);
  sameDigest(freshness.trustedTimeReceiptDigest, time.trustedTimeReceiptDigest, 'EVIDENCE_FRESHNESS_POLICY_UNAVAILABLE');
  const nowMs = Date.parse(time.now);
  const inventory = openInventory(input.inventoryBytes, input.expectedInventoryDigest, input.expectedOperationReceiptDigest);
  const compositionResult = inventory.resolve('kstack-pack-composition-receipt', input.expectedCompositionDigest);
  const dispatchResult = inventory.resolve('kstack-pack-dispatch-receipt', input.expectedDispatchDigest);
  const analysisResult = inventory.resolve('kstack-pack-analysis-result', input.expectedAnalysisResultDigest);
  const composition = compositionResult.record;
  const dispatch = dispatchResult.record;
  const analysis = analysisResult.record;
  if (Date.parse(dispatch.admittedAt) < Date.parse(composition.composedAt)) fail('DISPATCH_RECEIPT_INVALID');
  sameDigest(dispatch.compositionReceiptDigest, compositionResult.artifactDigest, 'DISPATCH_NOT_ADMITTED');
  sameDigest(dispatch.finalPromptDigest, composition.finalPromptDigest, 'DISPATCH_NOT_ADMITTED');
  sameDigest(analysis.compositionReceiptDigest, compositionResult.artifactDigest, 'RESULT_INVENTORY_MISMATCH');
  sameDigest(analysis.dispatchReceiptDigest, dispatchResult.artifactDigest, 'RESULT_INVENTORY_MISMATCH');
  sameDigest(analysis.subjectDigest, composition.subjectDigest, 'RESULT_INVENTORY_MISMATCH');
  if (dispatch.projectId !== composition.projectId || dispatch.repositoryImmutableId !== composition.repositoryImmutableId
      || dispatch.subjectDigest !== composition.subjectDigest) fail('DISPATCH_NOT_ADMITTED');
  const prompt = inventory.resolve('kstack-final-prompt', composition.finalPromptDigest);
  if (prompt.bytes.length !== composition.finalUtf8Bytes) fail('COMPOSITION_INPUT_STALE');
  const selection = inventory.resolve('kstack-pack-selection', composition.selectionDigest).record;
  const snapshot = inventory.resolve('kstack-pack-snapshot', composition.snapshotDigest).record;
  if (selection.snapshotDigest !== composition.snapshotDigest || selection.expectedGeneration !== composition.expectedGeneration
      || snapshot.generation !== composition.expectedGeneration
      || selection.repositoryPolicyDigest !== composition.repositoryPolicyDigest
      || snapshot.repositoryPolicyDigest !== composition.repositoryPolicyDigest) fail('COMPOSITION_INPUT_STALE');
  const compositionPairs = composition.orderedPacks.map((entry) => `${entry.packId}\u0000${entry.version}`);
  const selectionPairs = selection.orderedEntries.map((entry) => `${entry.packId}\u0000${entry.version}`);
  if (!hostCanonicalBytes(compositionPairs).equals(hostCanonicalBytes(selectionPairs))) fail('COMPOSITION_INPUT_STALE');
  inventory.resolve('kstack-repository-policy', composition.repositoryPolicyDigest);
  inventory.resolve('kstack-compatibility-matrix', composition.compatibilityMatrixDigest);
  inventory.resolve('kstack-base-brief', composition.baseBriefDigest);
  inventory.resolve('kstack-base-lane-contract', composition.baseLaneContractDigest);
  inventory.resolve('kstack-tokenizer-receipt', composition.tokenizerReceiptDigest);
  const schemaByPack = new Map();
  for (const pack of composition.orderedPacks) {
    inventory.resolve('kstack-pack-bundle', pack.bundleDigest);
    const content = inventory.resolve('kstack-pack-content', pack.contentDigest).record;
    const schema = inventory.resolve('kstack-pack-evidence-schema', pack.evidenceSchemaDigest).record;
    const expectedInventory = content.sections.flatMap((section) => section.questions.map((question) => ({
      packId: pack.packId, sectionId: section.id, questionId: question.id,
      orderedEvidenceIds: question.evidenceIds
    })));
    const renderedInventory = composition.renderedInventory.filter((entry) => entry.packId === pack.packId);
    const referencedEvidence = new Set(expectedInventory.flatMap((entry) => entry.orderedEvidenceIds));
    const schemaEvidence = new Set(schema.requirements.map((entry) => entry.evidenceId));
    if (!hostCanonicalBytes(expectedInventory).equals(hostCanonicalBytes(renderedInventory))
        || referencedEvidence.size !== schemaEvidence.size
        || [...referencedEvidence].some((evidenceId) => !schemaEvidence.has(evidenceId))) fail('EVIDENCE_SCHEMA_INVALID');
    schemaByPack.set(pack.packId, schema);
  }
  inventory.resolve('kstack-provider-request-body', dispatch.providerRequestBodyDigest);
  inventory.resolve('kstack-provider-configuration', dispatch.providerConfigurationDigest);
  inventory.resolve('kstack-model-configuration', dispatch.modelConfigurationDigest);
  inventory.resolve('kstack-dispatch-policy', dispatch.dispatchPolicyDigest);
  inventory.resolve('kstack-budget-receipt', dispatch.budgetReceiptDigest);
  inventory.resolve('kstack-freshness-receipt', dispatch.freshnessReceiptDigest);
  inventory.resolve('kstack-provider-response', analysis.providerResponseDigest);

  if (analysis.answers.length !== composition.renderedInventory.length) fail('RESULT_INVENTORY_MISMATCH');
  for (let index = 0; index < analysis.answers.length; index += 1) {
    const answer = analysis.answers[index];
    const question = composition.renderedInventory[index];
    if (answer.packId !== question.packId || answer.sectionId !== question.sectionId || answer.questionId !== question.questionId) fail('RESULT_INVENTORY_MISMATCH');
    const expectedOrder = question.orderedEvidenceIds.filter((entry) => answer.evidenceIds.includes(entry));
    if (!hostCanonicalBytes(expectedOrder).equals(hostCanonicalBytes(answer.evidenceIds))) fail('RESULT_INVENTORY_MISMATCH');
    inventory.resolve('kstack-observation-bytes', answer.observationDigest);
  }

  const descriptors = inventory.all('kstack-workflow-evidence-descriptor');
  const attestations = inventory.all('kstack-workflow-evidence-attestation');
  if (descriptors.length < 1 || descriptors.length !== attestations.length) fail('EVIDENCE_DESCRIPTOR_MISSING');

  const trustRoot = parseProducerTrustRoot(input.producerTrustRootBytes, input.producerTrustRootProtection, {
    projectId: composition.projectId, repositoryImmutableId: composition.repositoryImmutableId
  });
  sameDigest(trustRoot.producerTrustRootDigest, input.expectedProducerTrustRootDigest, 'PRODUCER_TRUST_ROOT_UNAVAILABLE');
  if (Date.parse(trustRoot.record.effectiveAt) > nowMs) fail('PRODUCER_TRUST_ROOT_UNAVAILABLE');
  const snapshotDigests = new Set(attestations.map((entry) => entry.record.producerPolicySnapshotDigest));
  if (snapshotDigests.size !== 1) fail('PRODUCER_POLICY_STALE');
  const policyResult = inventory.resolve('kstack-producer-policy-snapshot', [...snapshotDigests][0]);
  const policy = policyResult.record;
  sameDigest(policy.producerTrustRootDigest, trustRoot.producerTrustRootDigest, 'PRODUCER_POLICY_STALE');
  if (policy.projectId !== composition.projectId || policy.repositoryImmutableId !== composition.repositoryImmutableId
      || Date.parse(policy.issuedAt) < Date.parse(trustRoot.record.effectiveAt)
      || Date.parse(policy.issuedAt) > nowMs || Date.parse(policy.expiresAt) <= nowMs) fail('PRODUCER_POLICY_STALE');
  const rootKey = trustRoot.record.keys.find((entry) => entry.keyId === policy.signatureKeyId);
  if (!rootKey) fail('PRODUCER_POLICY_STALE');
  verifyEd25519(rootKey.publicKeyBase64, 'KSTACK-PRODUCER-POLICY-SNAPSHOT-SIGNATURE-V1\n', policy, policy.signatureBase64, 'PRODUCER_POLICY_STALE');

  const citedTuples = new Set(analysis.answers.flatMap((answer) => answer.evidenceIds
    .map((evidenceId) => `${answer.packId}\u0000${answer.questionId}\u0000${evidenceId}`)));
  const descriptorGroups = new Map();
  for (const entry of descriptors) {
    const value = entry.record;
    const tuple = `${value.packId}\u0000${value.questionId}\u0000${value.evidenceId}`;
    if (!citedTuples.has(tuple)) fail('RESULT_INVENTORY_MISMATCH');
    const group = descriptorGroups.get(tuple) ?? [];
    group.push(entry);
    descriptorGroups.set(tuple, group);
  }
  for (const group of descriptorGroups.values()) {
    group.sort((left, right) => left.record.evidenceOrdinal - right.record.evidenceOrdinal);
    if (group.some((entry, index) => entry.record.evidenceOrdinal !== index)) fail('EVIDENCE_DESCRIPTOR_MISSING');
  }
  const attestationByDescriptor = new Map(attestations.map((entry) => [entry.record.descriptorDigest, entry]));
  const descriptorDigests = new Set(descriptors.map((entry) => entry.artifactDigest));
  if (attestationByDescriptor.size !== attestations.length
      || [...attestationByDescriptor.keys()].some((entry) => !descriptorDigests.has(entry))) fail('EVIDENCE_ATTESTATION_INVALID');
  const freshnessById = new Map(freshness.policies.map((entry) => [entry.freshnessPolicyId, entry]));
  const nonces = new Set();
  const dispositionRows = [];
  const expiryCandidates = [policy.expiresAt];

  for (const [index, answer] of analysis.answers.entries()) {
    const question = composition.renderedInventory[index];
    const schema = schemaByPack.get(answer.packId);
    const requirements = new Map(schema.requirements.map((entry) => [entry.evidenceId, entry]));
    if (question.orderedEvidenceIds.some((evidenceId) => !requirements.has(evidenceId))) fail('EVIDENCE_SCHEMA_INVALID');
    const cited = new Map();
    for (const evidenceId of answer.evidenceIds) {
      const requirement = requirements.get(evidenceId);
      if (!requirement) fail('RESULT_INVENTORY_MISMATCH');
      const descriptorResults = descriptorGroups.get(`${answer.packId}\u0000${answer.questionId}\u0000${evidenceId}`);
      if (!descriptorResults || descriptorResults.length < requirement.minimumCount
          || descriptorResults.length > requirement.maximumCount) fail('EVIDENCE_DESCRIPTOR_MISSING');
      const freshnessPolicy = freshnessById.get(requirement.freshnessPolicyId);
      if (!freshnessPolicy) fail('EVIDENCE_FRESHNESS_POLICY_UNAVAILABLE');
      const verifiedDescriptors = [];
      for (const descriptorResult of descriptorResults) {
        const descriptor = descriptorResult.record;
        const attestationResult = attestationByDescriptor.get(descriptorResult.artifactDigest);
        if (!attestationResult) fail('EVIDENCE_ATTESTATION_INVALID');
        const attestation = attestationResult.record;
        const nativeEvidence = inventory.resolve('kstack-native-evidence-record', descriptor.sourceDigest).record;
        if (descriptor.projectId !== composition.projectId || descriptor.repositoryImmutableId !== composition.repositoryImmutableId
            || descriptor.subjectDigest !== composition.subjectDigest || descriptor.compositionReceiptDigest !== compositionResult.artifactDigest
            || descriptor.dispatchReceiptDigest !== dispatchResult.artifactDigest || descriptor.sourceClass !== nativeEvidence.sourceClass
            || descriptor.sourceLocatorDigest !== nativeEvidence.sourceLocatorDigest || descriptor.producerInvocationId !== dispatch.invocationId
            || !requirement.allowedSourceClasses.includes(descriptor.sourceClass)
            || !requirement.allowedObservationKinds.includes(descriptor.observationKind)) fail('EVIDENCE_SOURCE_DIGEST_MISMATCH');
        const observedMs = Date.parse(descriptor.observedAt);
        if (Date.parse(descriptor.producedAt) < Date.parse(dispatch.admittedAt)
            || observedMs > nowMs + freshness.maxFutureSkewMs
            || (freshnessPolicy.maxAgeMs !== null && nowMs - observedMs > freshnessPolicy.maxAgeMs)
            || Date.parse(descriptor.expiresAt) <= nowMs) fail('EVIDENCE_STALE');
        if (attestation.descriptorDigest !== descriptorResult.artifactDigest || attestation.producerPolicySnapshotDigest !== policyResult.artifactDigest
            || attestation.producerPolicyGeneration !== policy.generation || Date.parse(attestation.issuedAt) > nowMs
            || Date.parse(attestation.issuedAt) < Date.parse(descriptor.producedAt)
            || Date.parse(attestation.issuedAt) < Date.parse(policy.issuedAt)
            || Date.parse(attestation.expiresAt) <= nowMs) fail('EVIDENCE_ATTESTATION_INVALID');
        const nonceDigest = crypto.createHash('sha256')
          .update(Buffer.from('KSTACK-ATTESTATION-NONCE-V1\n', 'utf8'))
          .update(Buffer.from(attestation.nonce, 'utf8'))
          .digest('hex');
        if (nonces.has(attestation.nonce) || policy.revokedAttestationNonces.includes(nonceDigest)) fail('ATTESTATION_REPLAYED');
        nonces.add(attestation.nonce);
        const producer = policy.producers.find((entry) => entry.workflowClass === descriptor.workflowClass
          && entry.producerContractDigest === descriptor.producerContractDigest);
        if (!producer || producer.producerPolicyDigest !== descriptor.producerPolicyDigest
            || producer.workloadIdentityDigest !== attestation.workloadIdentityDigest
            || !producer.allowedSourceClasses.includes(descriptor.sourceClass)) fail('PRODUCER_UNQUALIFIED');
        const brokerKey = policy.brokerKeys.find((entry) => entry.keyId === attestation.brokerKeyId);
        if (!brokerKey) fail('EVIDENCE_ATTESTATION_INVALID');
        verifyEd25519(brokerKey.publicKeyBase64, 'KSTACK-WORKFLOW-EVIDENCE-ATTESTATION-SIGNATURE-V1\n', attestation, attestation.signatureBase64, 'EVIDENCE_ATTESTATION_INVALID');
        expiryCandidates.push(descriptor.expiresAt, attestation.expiresAt);
        verifiedDescriptors.push(descriptor);
      }
      cited.set(evidenceId, verifiedDescriptors);
    }
    let disposition = answer.disposition;
    const reasons = [];
    const verified = [...cited.values()].flat();
    if (answer.disposition === 'supported') {
      const required = schema.requirements.filter((entry) => entry.requiredFor.includes('supported') && question.orderedEvidenceIds.includes(entry.evidenceId));
      if (required.some((entry) => (cited.get(entry.evidenceId)?.length ?? 0) < entry.minimumCount)
          || !verified.some((entry) => entry.observationKind === 'asserts')
          || verified.some((entry) => entry.observationKind !== 'asserts')) {
        disposition = 'unknown'; reasons.push('SUPPORTED_EVIDENCE_UNSATISFIED');
      } else reasons.push('SUPPORTED_EVIDENCE_AUTHENTICATED');
    } else if (answer.disposition === 'contradicted') {
      const required = schema.requirements.filter((entry) => entry.requiredFor.includes('contradicted') && question.orderedEvidenceIds.includes(entry.evidenceId));
      if (required.some((entry) => (cited.get(entry.evidenceId)?.length ?? 0) < entry.minimumCount)
          || !verified.some((entry) => entry.observationKind === 'refutes')) {
        disposition = 'unknown'; reasons.push('CONTRADICTORY_EVIDENCE_UNSATISFIED');
      } else reasons.push('CONTRADICTORY_EVIDENCE_AUTHENTICATED');
    } else reasons.push('RESULT_REMAINS_UNKNOWN');
    dispositionRows.push({ packId: answer.packId, sectionId: answer.sectionId, questionId: answer.questionId, disposition, reasonCodes: reasons.sort(compareUtf8) });
  }
  inventory.assertComplete();
  const latestDecisionExpiry = new Date(nowMs + 5 * 60 * 1000).toISOString();
  const expiresAt = [...expiryCandidates, latestDecisionExpiry].sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  const decision = validateDecision({
    artifactType: 'kstack-validation-decision', schemaVersion: 1,
    projectId: composition.projectId, repositoryImmutableId: composition.repositoryImmutableId,
    subjectDigest: composition.subjectDigest, compositionReceiptDigest: compositionResult.artifactDigest,
    dispatchReceiptDigest: dispatchResult.artifactDigest, analysisResultDigest: analysisResult.artifactDigest,
    inputSetDigest: inputSetDigest(inventory, trustRoot.producerTrustRootDigest, time, freshness, input), orderedDispositions: dispositionRows,
    validatorImplementationDigest: input.validatorImplementationDigest, validatorSchemaDigest: input.validatorSchemaDigest,
    coordinatorPolicyDigest: input.coordinatorPolicyDigest, transactionId: input.transactionId,
    decidedAt: time.now, expiresAt
  });
  const result = artifactResult(decision);
  return immutable({
    decision: result.record, decisionBytes: result.canonicalBytes, decisionDigest: result.artifactDigest,
    inventoryDigest: inventory.inventoryDigest, producerPolicySnapshotDigest: policyResult.artifactDigest,
    producerPolicyGeneration: policy.generation, attestationNonces: [...nonces].sort(compareUtf8)
  });
}
