import crypto from 'node:crypto';
import { hostCanonicalBytes } from './kstack-host-contract.mjs';
import { assertValidatedPackSelectionResult } from './kstack-domain-selection.mjs';
import { createResultArtifact, parseResultArtifact, validateResultCandidate } from './kstack-domain-result.mjs';
import { parseD5Artifact } from './kstack-domain-schema.mjs';

const DIGEST = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const NONCE = /^[a-f0-9]{32,64}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const MAX_PROMPT_BYTES = 16 * 1024 * 1024;
const COMPOSED_RESULTS = new WeakSet();
const DISPATCH_RESULTS = new WeakSet();

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

function instant(value, code) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail(code);
  try { if (new Date(value).toISOString() !== value) fail(code); } catch { fail(code); }
  return value;
}

function bytes(value, code, maximum = MAX_PROMPT_BYTES) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array) || value.length > maximum) fail(code);
  return Buffer.from(value);
}

function rawDigest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function domainDigest(domain, value) {
  return crypto.createHash('sha256').update(Buffer.from(domain, 'utf8')).update(hostCanonicalBytes(value)).digest('hex');
}

function immutable(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

function strictBase64(value, code) {
  if (typeof value !== 'string' || value.length < 4 || value.length > 4096 || value.length % 4 !== 0
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) fail(code);
  const output = Buffer.from(value, 'base64');
  if (output.toString('base64') !== value) fail(code);
  return output;
}

export function composePackPrompt(input) {
  const code = 'COMPOSITION_INPUT_INVALID';
  exact(input, [
    'selectionAdmission', 'projectId', 'repositoryImmutableId', 'compatibilityMatrixDigest',
    'baseBriefDigest', 'baseLaneContractDigest', 'orderedPacks', 'renderedInventory',
    'basePromptBytes', 'orderedPackPromptBytes', 'tokenizerReceiptDigest',
    'subordinateArtifacts', 'composedAt'
  ], code);
  const selection = assertValidatedPackSelectionResult(input.selectionAdmission).projection;
  if (!Array.isArray(input.orderedPacks) || !Array.isArray(input.renderedInventory)
      || !Array.isArray(input.orderedPackPromptBytes) || input.orderedPackPromptBytes.length !== input.orderedPacks.length) fail(code);
  const selectionPairs = selection.orderedEntries.map((entry) => `${entry.packId}\u0000${entry.version}`);
  const packPairs = input.orderedPacks.map((entry) => `${entry.packId}\u0000${entry.version}`);
  if (!hostCanonicalBytes(selectionPairs).equals(hostCanonicalBytes(packPairs))) fail('COMPOSITION_INPUT_STALE');
  exact(input.subordinateArtifacts, [
    'compatibilityMatrixBytes', 'baseBriefBytes', 'baseLaneContractBytes',
    'tokenizerReceiptBytes', 'orderedPackArtifacts'
  ], code);
  const subordinate = input.subordinateArtifacts;
  for (const [artifactBytes, expectedDigest] of [
    [subordinate.compatibilityMatrixBytes, input.compatibilityMatrixDigest],
    [subordinate.baseBriefBytes, input.baseBriefDigest],
    [subordinate.baseLaneContractBytes, input.baseLaneContractDigest],
    [subordinate.tokenizerReceiptBytes, input.tokenizerReceiptDigest]
  ]) sameDigest(rawDigest(bytes(artifactBytes, code)), expectedDigest, 'COMPOSITION_INPUT_STALE');
  if (!Array.isArray(subordinate.orderedPackArtifacts)
      || subordinate.orderedPackArtifacts.length !== input.orderedPacks.length) fail(code);
  for (const [index, artifact] of subordinate.orderedPackArtifacts.entries()) {
    exact(artifact, ['packId', 'bundleBytes', 'contentBytes', 'evidenceSchemaBytes'], code);
    const pack = input.orderedPacks[index];
    const selectionBinding = selection.approvalPolicyBindings[index];
    if (artifact.packId !== pack.packId || selectionBinding.packId !== pack.packId) fail('COMPOSITION_INPUT_STALE');
    sameDigest(rawDigest(bytes(artifact.bundleBytes, code)), pack.bundleDigest, 'COMPOSITION_INPUT_STALE');
    sameDigest(selectionBinding.bundleDigest, pack.bundleDigest, 'COMPOSITION_INPUT_STALE');
    let content;
    let evidenceSchema;
    try {
      content = parseD5Artifact(
        bytes(artifact.contentBytes, code, 1024 * 1024),
        'kstack-pack-content',
        pack.contentDigest
      );
      evidenceSchema = parseD5Artifact(
        bytes(artifact.evidenceSchemaBytes, code, 1024 * 1024),
        'kstack-pack-evidence-schema',
        pack.evidenceSchemaDigest
      );
    } catch {
      fail('COMPOSITION_INPUT_STALE');
    }
    const allowedEvidenceIds = new Set(evidenceSchema.record.requirements.map((entry) => entry.evidenceId));
    const expectedInventory = content.record.sections.flatMap((section) => section.questions.map((question) => ({
      packId: pack.packId, sectionId: section.id, questionId: question.id,
      orderedEvidenceIds: question.evidenceIds
    })));
    const renderedInventory = input.renderedInventory.filter((entry) => entry.packId === pack.packId);
    if (!hostCanonicalBytes(expectedInventory).equals(hostCanonicalBytes(renderedInventory))
        || renderedInventory.some((entry) => entry.orderedEvidenceIds.some((evidenceId) => !allowedEvidenceIds.has(evidenceId)))) {
      fail('COMPOSITION_INPUT_STALE');
    }
  }
  const base = bytes(input.basePromptBytes, code);
  const packBuffers = input.orderedPackPromptBytes.map((entry) => bytes(entry, code));
  const finalPromptBytes = Buffer.concat([base, ...packBuffers]);
  if (finalPromptBytes.length < 1 || finalPromptBytes.length > MAX_PROMPT_BYTES) fail(code);
  const result = createResultArtifact({
    artifactType: 'kstack-pack-composition-receipt', schemaVersion: 1,
    projectId: string(input.projectId, ID, code), repositoryImmutableId: string(input.repositoryImmutableId, ID, code),
    subjectDigest: selection.subjectDigest, selectionDigest: selection.selectionDigest,
    snapshotDigest: selection.snapshotDigest, expectedGeneration: selection.expectedGeneration,
    repositoryPolicyDigest: selection.repositoryPolicyDigest,
    compatibilityMatrixDigest: digest(input.compatibilityMatrixDigest, code),
    baseBriefDigest: digest(input.baseBriefDigest, code), baseLaneContractDigest: digest(input.baseLaneContractDigest, code),
    orderedPacks: input.orderedPacks, renderedInventory: input.renderedInventory,
    baseUtf8Bytes: base.length, packUtf8Bytes: packBuffers.reduce((sum, entry) => sum + entry.length, 0),
    finalUtf8Bytes: finalPromptBytes.length, tokenizerReceiptDigest: digest(input.tokenizerReceiptDigest, code),
    finalPromptDigest: rawDigest(finalPromptBytes), composedAt: instant(input.composedAt, code)
  });
  const output = immutable({ receipt: result.record, receiptBytes: result.canonicalBytes, receiptDigest: result.artifactDigest, finalPromptBytes });
  COMPOSED_RESULTS.add(output);
  return output;
}

export async function admitPackDispatch(input) {
  const code = 'DISPATCH_ADMISSION_INVALID';
  exact(input, [
    'composition', 'providerRequestBodyBytes', 'providerConfigurationDigest',
    'modelConfigurationDigest', 'dispatchPolicyDigest', 'budgetReceiptDigest',
    'freshnessReceiptDigest', 'invocationId', 'admittedAt', 'catalogAuthority',
    'budgetAuthority', 'freshnessAuthority', 'admissionLedger'
  ], code);
  if (!input.composition || !COMPOSED_RESULTS.has(input.composition)) fail(code);
  if (!input.catalogAuthority || typeof input.catalogAuthority.confirmCurrent !== 'function'
      || !input.budgetAuthority || typeof input.budgetAuthority.confirmCurrent !== 'function'
      || !input.freshnessAuthority || typeof input.freshnessAuthority.confirmCurrent !== 'function'
      || !input.admissionLedger || typeof input.admissionLedger.capabilities !== 'function'
      || typeof input.admissionLedger.recordAdmission !== 'function') fail(code);
  const receipt = input.composition.receipt;
  sameDigest(rawDigest(input.composition.finalPromptBytes), receipt.finalPromptDigest, 'COMPOSITION_INPUT_STALE');
  const guard = await input.catalogAuthority.confirmCurrent({
    snapshotDigest: receipt.snapshotDigest, generation: receipt.expectedGeneration,
    repositoryPolicyDigest: receipt.repositoryPolicyDigest,
    compatibilityMatrixDigest: receipt.compatibilityMatrixDigest
  });
  exact(guard, ['current', 'snapshotDigest', 'generation', 'repositoryPolicyDigest', 'compatibilityMatrixDigest', 'checkpointDigest', 'rollbackDetected'], 'COMPOSITION_INPUT_STALE');
  if (guard.current !== true || guard.rollbackDetected !== false || guard.generation !== receipt.expectedGeneration) fail('COMPOSITION_INPUT_STALE');
  for (const [actual, expected] of [
    [guard.snapshotDigest, receipt.snapshotDigest], [guard.repositoryPolicyDigest, receipt.repositoryPolicyDigest],
    [guard.compatibilityMatrixDigest, receipt.compatibilityMatrixDigest]
  ]) sameDigest(actual, expected, 'COMPOSITION_INPUT_STALE');
  const admittedAt = instant(input.admittedAt, code);
  if (Date.parse(admittedAt) < Date.parse(receipt.composedAt)) fail('DISPATCH_ADMISSION_INVALID');
  const providerRequestBody = bytes(input.providerRequestBodyBytes, code);
  const providerRequestBodyDigest = rawDigest(providerRequestBody);
  const admissionBinding = {
    compositionReceiptDigest: input.composition.receiptDigest,
    finalPromptDigest: receipt.finalPromptDigest,
    providerRequestBodyDigest,
    invocationId: string(input.invocationId, ID, code),
    admittedAt
  };
  const guardedConfirmations = [];
  for (const [authority, receiptDigest, staleCode] of [
    [input.budgetAuthority, digest(input.budgetReceiptDigest, code), 'BUDGET_ADMISSION_STALE'],
    [input.freshnessAuthority, digest(input.freshnessReceiptDigest, code), 'FRESHNESS_ADMISSION_STALE']
  ]) {
    const confirmation = await authority.confirmCurrent({ ...admissionBinding, receiptDigest });
    exact(confirmation, ['admitted', 'current', 'receiptDigest', 'checkpointDigest', 'rollbackDetected'], staleCode);
    if (confirmation.admitted !== true || confirmation.current !== true || confirmation.rollbackDetected !== false) fail(staleCode);
    sameDigest(confirmation.receiptDigest, receiptDigest, staleCode);
    digest(confirmation.checkpointDigest, staleCode);
    guardedConfirmations.push(confirmation);
  }
  const result = createResultArtifact({
    artifactType: 'kstack-pack-dispatch-receipt', schemaVersion: 1,
    projectId: receipt.projectId, repositoryImmutableId: receipt.repositoryImmutableId,
    subjectDigest: receipt.subjectDigest, compositionReceiptDigest: input.composition.receiptDigest,
    finalPromptDigest: receipt.finalPromptDigest, providerRequestBodyDigest,
    providerConfigurationDigest: digest(input.providerConfigurationDigest, code),
    modelConfigurationDigest: digest(input.modelConfigurationDigest, code),
    dispatchPolicyDigest: digest(input.dispatchPolicyDigest, code),
    budgetReceiptDigest: digest(input.budgetReceiptDigest, code), freshnessReceiptDigest: digest(input.freshnessReceiptDigest, code),
    catalogGuardCheckpointDigest: digest(guard.checkpointDigest, code),
    invocationId: admissionBinding.invocationId, admittedAt
  });
  const admissionCapabilities = await input.admissionLedger.capabilities();
  exact(admissionCapabilities, [
    'durableAdmission', 'uniqueInvocation', 'guardedCheckpoints', 'idempotentRecovery'
  ], 'DISPATCH_ADMISSION_CAPABILITY_UNMET');
  if (admissionCapabilities.durableAdmission !== true || admissionCapabilities.uniqueInvocation !== true
      || admissionCapabilities.guardedCheckpoints !== true || admissionCapabilities.idempotentRecovery !== true) {
    fail('DISPATCH_ADMISSION_CAPABILITY_UNMET');
  }
  const admission = await input.admissionLedger.recordAdmission(immutable({
    projectId: result.record.projectId,
    repositoryImmutableId: result.record.repositoryImmutableId,
    subjectDigest: result.record.subjectDigest,
    compositionReceiptDigest: result.record.compositionReceiptDigest,
    dispatchReceiptDigest: result.artifactDigest,
    invocationId: result.record.invocationId,
    catalogCheckpointDigest: guard.checkpointDigest,
    budgetCheckpointDigest: guardedConfirmations[0].checkpointDigest,
    freshnessCheckpointDigest: guardedConfirmations[1].checkpointDigest,
    receipt: result.record,
    receiptDigest: result.artifactDigest
  }));
  exact(admission, [
    'outcome', 'receiptDigest', 'invocationId', 'checkpointDigest', 'generation'
  ], 'DISPATCH_ADMISSION_CONFLICT');
  if (!['recorded', 'recovered'].includes(admission.outcome)
      || admission.invocationId !== result.record.invocationId
      || !Number.isSafeInteger(admission.generation) || admission.generation < 1) fail('DISPATCH_ADMISSION_CONFLICT');
  sameDigest(admission.receiptDigest, result.artifactDigest, 'DISPATCH_ADMISSION_CONFLICT');
  const admissionCheckpointDigest = digest(admission.checkpointDigest, 'DISPATCH_ADMISSION_CONFLICT');
  const output = immutable({
    receipt: result.record, receiptBytes: result.canonicalBytes,
    receiptDigest: result.artifactDigest, providerRequestBody,
    admissionCheckpointDigest, admissionGeneration: admission.generation
  });
  DISPATCH_RESULTS.add(output);
  return output;
}

export async function attestWorkflowEvidence(input) {
  const code = 'EVIDENCE_ATTESTATION_INVALID';
  exact(input, [
    'composition', 'dispatch', 'descriptor', 'nativeEvidence', 'workloadIdentityDigest',
    'expectedProducerPolicySnapshotDigest', 'nonce', 'issuedAt', 'expiresAt',
    'nativeEvidenceAuthority', 'policyAuthority', 'signer'
  ], code);
  if (!input.composition || !COMPOSED_RESULTS.has(input.composition)
      || !input.dispatch || !DISPATCH_RESULTS.has(input.dispatch)
      || input.dispatch.receipt.compositionReceiptDigest !== input.composition.receiptDigest) fail('DISPATCH_NOT_ADMITTED');
  if (!input.policyAuthority || typeof input.policyAuthority.qualifyProducer !== 'function'
      || !input.nativeEvidenceAuthority || typeof input.nativeEvidenceAuthority.verifyEvidence !== 'function'
      || !input.signer || typeof input.signer.sign !== 'function') fail('PRODUCER_UNQUALIFIED');
  const nativeEvidence = createResultArtifact(input.nativeEvidence);
  const descriptor = createResultArtifact(input.descriptor);
  sameDigest(descriptor.record.sourceDigest, nativeEvidence.artifactDigest, 'EVIDENCE_SOURCE_DIGEST_MISMATCH');
  if (descriptor.record.sourceClass !== nativeEvidence.record.sourceClass
      || descriptor.record.sourceLocatorDigest !== nativeEvidence.record.sourceLocatorDigest) fail('EVIDENCE_SOURCE_DIGEST_MISMATCH');
  const composition = input.composition.receipt;
  const dispatch = input.dispatch.receipt;
  const question = composition.renderedInventory.find((entry) => entry.packId === descriptor.record.packId
    && entry.questionId === descriptor.record.questionId);
  if (descriptor.record.projectId !== composition.projectId
      || descriptor.record.repositoryImmutableId !== composition.repositoryImmutableId
      || descriptor.record.subjectDigest !== composition.subjectDigest
      || descriptor.record.compositionReceiptDigest !== input.composition.receiptDigest
      || descriptor.record.dispatchReceiptDigest !== input.dispatch.receiptDigest
      || descriptor.record.producerInvocationId !== dispatch.invocationId
      || !question || !question.orderedEvidenceIds.includes(descriptor.record.evidenceId)) fail('EVIDENCE_SOURCE_DIGEST_MISMATCH');
  const nativeVerification = await input.nativeEvidenceAuthority.verifyEvidence({
    projectId: descriptor.record.projectId,
    repositoryImmutableId: descriptor.record.repositoryImmutableId,
    workflowClass: descriptor.record.workflowClass,
    producerContractDigest: descriptor.record.producerContractDigest,
    producerPolicyDigest: descriptor.record.producerPolicyDigest,
    sourceClass: descriptor.record.sourceClass,
    sourceLocatorDigest: descriptor.record.sourceLocatorDigest,
    sourceDigest: nativeEvidence.artifactDigest,
    nativeReceiptDigest: nativeEvidence.record.nativeReceiptDigest,
    producerInvocationId: descriptor.record.producerInvocationId
  });
  exact(nativeVerification, [
    'verified', 'current', 'sourceDigest', 'nativeReceiptDigest',
    'sourceLocatorDigest', 'checkpointDigest', 'rollbackDetected'
  ], 'EVIDENCE_SOURCE_DIGEST_MISMATCH');
  if (nativeVerification.verified !== true || nativeVerification.current !== true
      || nativeVerification.rollbackDetected !== false) fail('EVIDENCE_SOURCE_DIGEST_MISMATCH');
  sameDigest(nativeVerification.sourceDigest, nativeEvidence.artifactDigest, 'EVIDENCE_SOURCE_DIGEST_MISMATCH');
  sameDigest(nativeVerification.nativeReceiptDigest, nativeEvidence.record.nativeReceiptDigest, 'EVIDENCE_SOURCE_DIGEST_MISMATCH');
  sameDigest(nativeVerification.sourceLocatorDigest, nativeEvidence.record.sourceLocatorDigest, 'EVIDENCE_SOURCE_DIGEST_MISMATCH');
  digest(nativeVerification.checkpointDigest, 'EVIDENCE_SOURCE_DIGEST_MISMATCH');
  const qualification = await input.policyAuthority.qualifyProducer({
    projectId: descriptor.record.projectId, repositoryImmutableId: descriptor.record.repositoryImmutableId,
    workflowClass: descriptor.record.workflowClass, producerContractDigest: descriptor.record.producerContractDigest,
    producerPolicyDigest: descriptor.record.producerPolicyDigest, workloadIdentityDigest: digest(input.workloadIdentityDigest, code),
    sourceClass: descriptor.record.sourceClass,
    subjectDigest: descriptor.record.subjectDigest,
    compositionReceiptDigest: descriptor.record.compositionReceiptDigest,
    dispatchReceiptDigest: descriptor.record.dispatchReceiptDigest,
    producerInvocationId: descriptor.record.producerInvocationId,
    expectedProducerPolicySnapshotDigest: digest(input.expectedProducerPolicySnapshotDigest, code)
  });
  exact(qualification, ['qualified', 'current', 'snapshotDigest', 'generation', 'brokerKeyId', 'policyCheckpointDigest', 'rollbackDetected'], 'PRODUCER_UNQUALIFIED');
  if (qualification.qualified !== true || qualification.current !== true || qualification.rollbackDetected !== false) fail('PRODUCER_UNQUALIFIED');
  sameDigest(qualification.snapshotDigest, input.expectedProducerPolicySnapshotDigest, 'PRODUCER_POLICY_STALE');
  const unsignedAttestation = {
    artifactType: 'kstack-workflow-evidence-attestation', schemaVersion: 1,
    descriptorDigest: descriptor.artifactDigest, workloadIdentityDigest: digest(input.workloadIdentityDigest, code),
    producerPolicySnapshotDigest: qualification.snapshotDigest,
    producerPolicyGeneration: integer(qualification.generation, 1, Number.MAX_SAFE_INTEGER, code),
    brokerKeyId: string(qualification.brokerKeyId, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u, code, 128),
    issuedAt: instant(input.issuedAt, code), expiresAt: instant(input.expiresAt, code),
    nonce: string(input.nonce, NONCE, code, 128)
  };
  if (Date.parse(unsignedAttestation.issuedAt) < Date.parse(descriptor.record.producedAt)
      || Date.parse(unsignedAttestation.issuedAt) >= Date.parse(unsignedAttestation.expiresAt)) fail(code);
  const transcript = Buffer.concat([
    Buffer.from('KSTACK-WORKFLOW-EVIDENCE-ATTESTATION-SIGNATURE-V1\n', 'utf8'),
    hostCanonicalBytes(unsignedAttestation)
  ]);
  const signed = await input.signer.sign({ keyId: unsignedAttestation.brokerKeyId, transcript });
  exact(signed, ['keyId', 'signatureBase64'], code);
  if (signed.keyId !== unsignedAttestation.brokerKeyId) fail(code);
  strictBase64(signed.signatureBase64, code);
  const attestation = createResultArtifact({ ...unsignedAttestation, signatureBase64: signed.signatureBase64 });
  return immutable({
    descriptor, nativeEvidence, attestation,
    producerPolicySnapshotDigest: qualification.snapshotDigest,
    producerPolicyGeneration: qualification.generation,
    policyCheckpointDigest: digest(qualification.policyCheckpointDigest, code)
  });
}

function validateTrustedCommitTime(input, decision) {
  const code = 'EVIDENCE_TRUSTED_TIME_UNAVAILABLE';
  exact(input, ['now', 'sourceProfileDigest', 'attestationDigest', 'qualified', 'rollbackDetected'], code);
  if (input.qualified !== true || input.rollbackDetected !== false) fail(code);
  digest(input.sourceProfileDigest, code);
  digest(input.attestationDigest, code);
  const now = instant(input.now, code);
  if (Date.parse(now) < Date.parse(decision.decidedAt) || Date.parse(now) >= Date.parse(decision.expiresAt)) fail('VALIDATION_DECISION_EXPIRED');
  return now;
}

function validateReceipt(input) {
  const code = 'RESULT_VALIDATION_RECEIPT_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId', 'subjectDigest',
    'decisionDigest', 'inputSetDigest', 'orderedDispositions', 'validatorImplementationDigest',
    'validatorSchemaDigest', 'coordinatorImplementationDigest', 'coordinatorSchemaDigest',
    'coordinatorPolicyDigest', 'producerPolicySnapshotDigest', 'producerPolicyGeneration',
    'consumedNonces', 'trustedCommitTime', 'transactionId'
  ], code);
  if (input.artifactType !== 'kstack-result-validation-receipt' || input.schemaVersion !== 1
      || !Array.isArray(input.orderedDispositions) || !Array.isArray(input.consumedNonces)
      || new Set(input.consumedNonces).size !== input.consumedNonces.length
      || input.consumedNonces.some((value, index) => value !== [...input.consumedNonces].sort()[index])) fail(code);
  for (const value of input.consumedNonces) string(value, NONCE, code, 128);
  for (const row of input.orderedDispositions) {
    exact(row, ['packId', 'sectionId', 'questionId', 'disposition', 'reasonCodes'], code);
  }
  return {
    artifactType: input.artifactType, schemaVersion: 1,
    projectId: string(input.projectId, ID, code), repositoryImmutableId: string(input.repositoryImmutableId, ID, code),
    subjectDigest: digest(input.subjectDigest, code), decisionDigest: digest(input.decisionDigest, code),
    inputSetDigest: digest(input.inputSetDigest, code), orderedDispositions: input.orderedDispositions,
    validatorImplementationDigest: digest(input.validatorImplementationDigest, code), validatorSchemaDigest: digest(input.validatorSchemaDigest, code),
    coordinatorImplementationDigest: digest(input.coordinatorImplementationDigest, code), coordinatorSchemaDigest: digest(input.coordinatorSchemaDigest, code),
    coordinatorPolicyDigest: digest(input.coordinatorPolicyDigest, code), producerPolicySnapshotDigest: digest(input.producerPolicySnapshotDigest, code),
    producerPolicyGeneration: integer(input.producerPolicyGeneration, 1, Number.MAX_SAFE_INTEGER, code),
    consumedNonces: input.consumedNonces, trustedCommitTime: instant(input.trustedCommitTime, code),
    transactionId: string(input.transactionId, ID, code)
  };
}

export async function commitResultValidation(input) {
  const code = 'RESULT_VALIDATION_COMMIT_INVALID';
  exact(input, [
    'candidateInput', 'expectedDecisionBytes', 'expectedDecisionDigest',
    'coordinatorImplementationDigest', 'coordinatorSchemaDigest',
    'dispatchAdmissionAuthority', 'producerPolicyAuthority', 'trustedTimeAuthority', 'ledger'
  ], code);
  if (!input.dispatchAdmissionAuthority || typeof input.dispatchAdmissionAuthority.confirmAdmitted !== 'function'
      || !input.producerPolicyAuthority || typeof input.producerPolicyAuthority.confirmCurrent !== 'function'
      || !input.trustedTimeAuthority || typeof input.trustedTimeAuthority.current !== 'function'
      || !input.ledger || typeof input.ledger.capabilities !== 'function' || typeof input.ledger.transactValidation !== 'function') fail('VALIDATION_ATOMICITY_CAPABILITY_UNMET');
  const candidate = validateResultCandidate(input.candidateInput);
  sameDigest(candidate.decisionDigest, input.expectedDecisionDigest, 'VALIDATION_TRANSACTION_CONFLICT');
  if (!candidate.decisionBytes.equals(bytes(input.expectedDecisionBytes, code, 1024 * 1024))) fail('VALIDATION_TRANSACTION_CONFLICT');
  const dispatchAdmission = await input.dispatchAdmissionAuthority.confirmAdmitted({
    projectId: candidate.decision.projectId,
    repositoryImmutableId: candidate.decision.repositoryImmutableId,
    subjectDigest: candidate.decision.subjectDigest,
    compositionReceiptDigest: candidate.decision.compositionReceiptDigest,
    dispatchReceiptDigest: candidate.decision.dispatchReceiptDigest,
    transactionId: candidate.decision.transactionId
  });
  exact(dispatchAdmission, [
    'admitted', 'compositionReceiptDigest', 'dispatchReceiptDigest',
    'checkpointDigest', 'generation', 'rollbackDetected'
  ], 'DISPATCH_NOT_ADMITTED');
  if (dispatchAdmission.admitted !== true || dispatchAdmission.rollbackDetected !== false
      || !Number.isSafeInteger(dispatchAdmission.generation) || dispatchAdmission.generation < 1) fail('DISPATCH_NOT_ADMITTED');
  sameDigest(dispatchAdmission.compositionReceiptDigest, candidate.decision.compositionReceiptDigest, 'DISPATCH_NOT_ADMITTED');
  sameDigest(dispatchAdmission.dispatchReceiptDigest, candidate.decision.dispatchReceiptDigest, 'DISPATCH_NOT_ADMITTED');
  const dispatchAdmissionCheckpointDigest = digest(dispatchAdmission.checkpointDigest, 'DISPATCH_NOT_ADMITTED');
  const capabilities = await input.ledger.capabilities();
  exact(capabilities, [
    'atomicNonceSetAndReceipt', 'guardedPolicyCompareAndSwap',
    'serializable', 'idempotentRecovery'
  ], 'VALIDATION_ATOMICITY_CAPABILITY_UNMET');
  if (capabilities.atomicNonceSetAndReceipt !== true || capabilities.guardedPolicyCompareAndSwap !== true
      || capabilities.serializable !== true || capabilities.idempotentRecovery !== true) fail('VALIDATION_ATOMICITY_CAPABILITY_UNMET');
  const policy = await input.producerPolicyAuthority.confirmCurrent({
    snapshotDigest: candidate.producerPolicySnapshotDigest, generation: candidate.producerPolicyGeneration,
    attestationNonces: candidate.attestationNonces, transactionId: candidate.decision.transactionId
  });
  exact(policy, ['current', 'generation', 'snapshotDigest', 'allKeysQualified', 'noneRevoked', 'nonceState', 'checkpointDigest', 'rollbackDetected'], 'PRODUCER_POLICY_STALE');
  if (policy.current !== true || policy.allKeysQualified !== true || policy.noneRevoked !== true
      || policy.rollbackDetected !== false
      || policy.generation !== candidate.producerPolicyGeneration) fail('PRODUCER_POLICY_STALE');
  if (!['unconsumed', 'consumed-by-transaction'].includes(policy.nonceState)) fail('ATTESTATION_REPLAYED');
  sameDigest(policy.snapshotDigest, candidate.producerPolicySnapshotDigest, 'PRODUCER_POLICY_STALE');
  const commitTimeEvidence = await input.trustedTimeAuthority.current();
  const trustedCommitTime = validateTrustedCommitTime(commitTimeEvidence, candidate.decision);
  const receipt = validateReceipt({
    artifactType: 'kstack-result-validation-receipt', schemaVersion: 1,
    projectId: candidate.decision.projectId, repositoryImmutableId: candidate.decision.repositoryImmutableId,
    subjectDigest: candidate.decision.subjectDigest, decisionDigest: candidate.decisionDigest,
    inputSetDigest: candidate.decision.inputSetDigest, orderedDispositions: candidate.decision.orderedDispositions,
    validatorImplementationDigest: candidate.decision.validatorImplementationDigest,
    validatorSchemaDigest: candidate.decision.validatorSchemaDigest,
    coordinatorImplementationDigest: digest(input.coordinatorImplementationDigest, code),
    coordinatorSchemaDigest: digest(input.coordinatorSchemaDigest, code),
    coordinatorPolicyDigest: candidate.decision.coordinatorPolicyDigest,
    producerPolicySnapshotDigest: candidate.producerPolicySnapshotDigest,
    producerPolicyGeneration: candidate.producerPolicyGeneration,
    consumedNonces: candidate.attestationNonces, trustedCommitTime,
    transactionId: candidate.decision.transactionId
  });
  const receiptDigest = domainDigest('KSTACK-RESULT-VALIDATION-RECEIPT-V1\n', receipt);
  const transaction = await input.ledger.transactValidation(immutable({
    projectId: receipt.projectId, transactionId: receipt.transactionId,
    inputSetDigest: receipt.inputSetDigest, decisionDigest: receipt.decisionDigest,
    consumedNonces: receipt.consumedNonces,
    expectedProducerPolicySnapshotDigest: receipt.producerPolicySnapshotDigest,
    expectedProducerPolicyGeneration: receipt.producerPolicyGeneration,
    expectedPolicyCheckpointDigest: digest(policy.checkpointDigest, 'PRODUCER_POLICY_STALE'),
    expectedDispatchAdmissionCheckpointDigest: dispatchAdmissionCheckpointDigest,
    expectedDispatchAdmissionGeneration: dispatchAdmission.generation,
    trustedTimeAttestationDigest: digest(commitTimeEvidence.attestationDigest, 'EVIDENCE_TRUSTED_TIME_UNAVAILABLE'),
    receipt, receiptDigest
  }));
  exact(transaction, [
    'outcome', 'receipt', 'receiptDigest', 'inputSetDigest', 'consumedNonces',
    'producerPolicySnapshotDigest', 'producerPolicyGeneration', 'policyCheckpointDigest',
    'dispatchAdmissionCheckpointDigest', 'dispatchAdmissionGeneration'
  ], 'VALIDATION_TRANSACTION_CONFLICT');
  if (!['committed', 'recovered'].includes(transaction.outcome)
      || !Array.isArray(transaction.consumedNonces)
      || transaction.producerPolicyGeneration !== receipt.producerPolicyGeneration
      || transaction.dispatchAdmissionGeneration !== dispatchAdmission.generation) fail('VALIDATION_TRANSACTION_CONFLICT');
  if (policy.nonceState === 'consumed-by-transaction' && transaction.outcome !== 'recovered') fail('VALIDATION_TRANSACTION_CONFLICT');
  if (!hostCanonicalBytes(transaction.consumedNonces).equals(hostCanonicalBytes(receipt.consumedNonces))) fail('VALIDATION_TRANSACTION_CONFLICT');
  sameDigest(transaction.producerPolicySnapshotDigest, receipt.producerPolicySnapshotDigest, 'VALIDATION_TRANSACTION_CONFLICT');
  sameDigest(transaction.policyCheckpointDigest, policy.checkpointDigest, 'VALIDATION_TRANSACTION_CONFLICT');
  sameDigest(transaction.dispatchAdmissionCheckpointDigest, dispatchAdmissionCheckpointDigest, 'VALIDATION_TRANSACTION_CONFLICT');
  const returnedReceipt = validateReceipt(transaction.receipt);
  const returnedReceiptDigest = domainDigest('KSTACK-RESULT-VALIDATION-RECEIPT-V1\n', returnedReceipt);
  sameDigest(transaction.receiptDigest, returnedReceiptDigest, 'VALIDATION_TRANSACTION_CONFLICT');
  sameDigest(transaction.inputSetDigest, receipt.inputSetDigest, 'VALIDATION_TRANSACTION_CONFLICT');
  sameDigest(returnedReceipt.inputSetDigest, receipt.inputSetDigest, 'VALIDATION_TRANSACTION_CONFLICT');
  sameDigest(returnedReceipt.decisionDigest, receipt.decisionDigest, 'VALIDATION_TRANSACTION_CONFLICT');
  if (returnedReceipt.transactionId !== receipt.transactionId || returnedReceipt.projectId !== receipt.projectId) fail('VALIDATION_TRANSACTION_CONFLICT');
  const recoveryProjection = (value) => Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'trustedCommitTime')
  );
  if (!hostCanonicalBytes(recoveryProjection(returnedReceipt)).equals(hostCanonicalBytes(recoveryProjection(receipt)))) {
    fail('VALIDATION_TRANSACTION_CONFLICT');
  }
  if (transaction.outcome === 'committed') sameDigest(returnedReceiptDigest, receiptDigest, 'VALIDATION_TRANSACTION_CONFLICT');
  return immutable({ receipt: returnedReceipt, receiptDigest: returnedReceiptDigest, outcome: transaction.outcome });
}
