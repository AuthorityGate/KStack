import crypto from 'node:crypto';
import { hostCanonicalBytes, parseHostCanonicalJson } from './kstack-host-contract.mjs';
import { assertConsumedIdentityActionResult } from './kstack-domain-identity.mjs';

export const REVIEWER_CLASSES = Object.freeze(['automated-validator', 'human-expert', 'independent-agent', 'primary-agent']);
export const APPROVAL_CLASSES = Object.freeze(['human-owner', 'independent-agent']);
export const REVIEW_CHECKS = Object.freeze(['artifact-integrity', 'compatibility', 'policy-conformance', 'security', 'test-evidence']);
export const REVIEW_VERDICTS = Object.freeze(['approve', 'revise']);
export const COMPOSITION_INPUT_ROLES = Object.freeze(['implementation-plan', 'objective', 'qc', 'release-observation']);
export const PACK_APPROVAL_AUTHORITY_SCOPE = 'D2_APPROVAL_IS_QUALITY_METADATA_D1_OWNER_ACCEPTANCE_IS_SOLE_AUTHORITY';

const DIGEST = /^[a-f0-9]{64}$/u;
const ID = /^[a-z][a-z0-9-]{0,63}$/u;
const VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
// These limits must remain jointly reachable through hostCanonicalBytes. In
// particular, inventory payloads are base64 strings and the Host contract caps
// each string at 16 KiB and the complete canonical document at 1 MiB.
const MAX_ARTIFACT_BYTES = 12_000;
const MAX_SELECTION_ENTRIES = 12;
const MAX_INVENTORY_ENTRIES = 60;
const VALIDATED_SELECTIONS = new WeakSet();

const DOMAINS = Object.freeze({
  'kstack-pack-material': 'KSTACK-PACK-MATERIAL-V1\n',
  'kstack-pack-compatibility-tuple': 'KSTACK-PACK-COMPATIBILITY-TUPLE-V1\n',
  'kstack-pack-review-policy': 'KSTACK-PACK-REVIEW-POLICY-V1\n',
  'kstack-pack-approval-policy': 'KSTACK-PACK-APPROVAL-POLICY-V1\n',
  'kstack-pack-review': 'KSTACK-PACK-REVIEW-V1\n',
  'kstack-pack-approval': 'KSTACK-PACK-APPROVAL-V1\n',
  'kstack-pack-snapshot': 'KSTACK-PACK-SNAPSHOT-V1\n',
  'kstack-pack-selection': 'KSTACK-PACK-SELECTION-V1\n'
});

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

function text(value, expression, code, maximum = 256) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !value.isWellFormed()
      || value.normalize('NFC') !== value || CONTROL_OR_BIDI.test(value) || !expression.test(value)) fail(code);
  return value;
}

function digest(value, code = 'PACK_ARTIFACT_INVALID') {
  return text(value, DIGEST, code, 64);
}

function digestEqual(left, right) {
  const a = Buffer.from(digest(left), 'hex');
  const b = Buffer.from(digest(right), 'hex');
  return crypto.timingSafeEqual(a, b);
}

function integer(value, minimum, maximum, code) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code);
  return value;
}

function boolean(value, code) {
  if (typeof value !== 'boolean') fail(code);
  return value;
}

function instant(value, code) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail(code);
  try {
    if (new Date(value).toISOString() !== value) fail(code);
  } catch {
    fail(code);
  }
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

function artifactResult(record) {
  const canonicalBytes = hostCanonicalBytes(record);
  return immutable({ record, canonicalBytes, artifactDigest: domainDigest(DOMAINS[record.artifactType], record) });
}

function validateMaterial(input) {
  const code = 'PACK_MATERIAL_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'packId', 'version', 'bundleDigest'], code);
  if (input.artifactType !== 'kstack-pack-material' || input.schemaVersion !== 1) fail(code);
  return {
    artifactType: input.artifactType,
    schemaVersion: 1,
    packId: text(input.packId, ID, code, 64),
    version: text(input.version, VERSION, code, 128),
    bundleDigest: digest(input.bundleDigest, code)
  };
}

function validateCompatibility(input) {
  const code = 'PACK_COMPATIBILITY_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'packId', 'version', 'materialDigest', 'compatible'], code);
  if (input.artifactType !== 'kstack-pack-compatibility-tuple' || input.schemaVersion !== 1) fail(code);
  return {
    artifactType: input.artifactType,
    schemaVersion: 1,
    packId: text(input.packId, ID, code, 64),
    version: text(input.version, VERSION, code, 128),
    materialDigest: digest(input.materialDigest, code),
    compatible: boolean(input.compatible, code)
  };
}

function validateReviewPolicy(input) {
  const code = 'PACK_REVIEW_POLICY_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'policyVersion', 'requiredReviewerClasses', 'minimumConfidence', 'requiredChecks', 'blockOnSecurityFinding', 'blockOnMaterialDissent', 'blockOnUnresolvedQuestion'], code);
  if (input.artifactType !== 'kstack-pack-review-policy' || input.schemaVersion !== 1) fail(code);
  return {
    artifactType: input.artifactType,
    schemaVersion: 1,
    policyVersion: integer(input.policyVersion, 1, 2_147_483_647, code),
    requiredReviewerClasses: sortedUnique(input.requiredReviewerClasses, REVIEWER_CLASSES, code),
    minimumConfidence: integer(input.minimumConfidence, 0, 100, code),
    requiredChecks: sortedUnique(input.requiredChecks, REVIEW_CHECKS, code),
    blockOnSecurityFinding: boolean(input.blockOnSecurityFinding, code),
    blockOnMaterialDissent: boolean(input.blockOnMaterialDissent, code),
    blockOnUnresolvedQuestion: boolean(input.blockOnUnresolvedQuestion, code)
  };
}

function validateApprovalPolicy(input) {
  const code = 'PACK_APPROVAL_POLICY_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'policyVersion', 'acceptedReviewVerdicts', 'requireAllReviewChecks', 'requireIndependentApproval', 'allowedApprovalClasses'], code);
  if (input.artifactType !== 'kstack-pack-approval-policy' || input.schemaVersion !== 1) fail(code);
  return {
    artifactType: input.artifactType,
    schemaVersion: 1,
    policyVersion: integer(input.policyVersion, 1, 2_147_483_647, code),
    acceptedReviewVerdicts: sortedUnique(input.acceptedReviewVerdicts, REVIEW_VERDICTS, code),
    requireAllReviewChecks: boolean(input.requireAllReviewChecks, code),
    requireIndependentApproval: boolean(input.requireIndependentApproval, code),
    allowedApprovalClasses: sortedUnique(input.allowedApprovalClasses, APPROVAL_CLASSES, code)
  };
}

function validateReview(input) {
  const code = 'PACK_REVIEW_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'materialDigest', 'compatibilityTupleDigest', 'reviewPolicyDigest', 'verdict', 'reviewerClass', 'confidence', 'passedChecks', 'securityFindingCount', 'materialDissentCount', 'unresolvedQuestionCount'], code);
  if (input.artifactType !== 'kstack-pack-review' || input.schemaVersion !== 1 || !REVIEW_VERDICTS.includes(input.verdict)
      || !REVIEWER_CLASSES.includes(input.reviewerClass)) fail(code);
  return {
    artifactType: input.artifactType,
    schemaVersion: 1,
    materialDigest: digest(input.materialDigest, code),
    compatibilityTupleDigest: digest(input.compatibilityTupleDigest, code),
    reviewPolicyDigest: digest(input.reviewPolicyDigest, code),
    verdict: input.verdict,
    reviewerClass: input.reviewerClass,
    confidence: integer(input.confidence, 0, 100, code),
    passedChecks: sortedUnique(input.passedChecks, REVIEW_CHECKS, code, true),
    securityFindingCount: integer(input.securityFindingCount, 0, 10_000, code),
    materialDissentCount: integer(input.materialDissentCount, 0, 10_000, code),
    unresolvedQuestionCount: integer(input.unresolvedQuestionCount, 0, 10_000, code)
  };
}

function validateApproval(input) {
  const code = 'PACK_APPROVAL_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'materialDigest', 'reviewArtifactDigest', 'approvalPolicyDigest', 'acceptedVerdict', 'approvalClass', 'independentFromReviewer'], code);
  if (input.artifactType !== 'kstack-pack-approval' || input.schemaVersion !== 1 || !REVIEW_VERDICTS.includes(input.acceptedVerdict)
      || !APPROVAL_CLASSES.includes(input.approvalClass)) fail(code);
  return {
    artifactType: input.artifactType,
    schemaVersion: 1,
    materialDigest: digest(input.materialDigest, code),
    reviewArtifactDigest: digest(input.reviewArtifactDigest, code),
    approvalPolicyDigest: digest(input.approvalPolicyDigest, code),
    acceptedVerdict: input.acceptedVerdict,
    approvalClass: input.approvalClass,
    independentFromReviewer: boolean(input.independentFromReviewer, code)
  };
}

function validateSnapshotEntry(input) {
  const code = 'PACK_SNAPSHOT_INVALID';
  exact(input, ['packId', 'version', 'materialDigest', 'compatibilityTupleDigest', 'reviewArtifactDigest', 'approvalArtifactDigest'], code);
  return {
    packId: text(input.packId, ID, code, 64),
    version: text(input.version, VERSION, code, 128),
    materialDigest: digest(input.materialDigest, code),
    compatibilityTupleDigest: digest(input.compatibilityTupleDigest, code),
    reviewArtifactDigest: digest(input.reviewArtifactDigest, code),
    approvalArtifactDigest: digest(input.approvalArtifactDigest, code)
  };
}

function validateSnapshot(input) {
  const code = 'PACK_SNAPSHOT_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'generation', 'repositoryPolicyDigest', 'entries'], code);
  if (input.artifactType !== 'kstack-pack-snapshot' || input.schemaVersion !== 1
      || !Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > MAX_SELECTION_ENTRIES) fail(code);
  const entries = input.entries.map(validateSnapshotEntry);
  if (new Set(entries.map((entry) => entry.packId)).size !== entries.length) fail(code);
  return {
    artifactType: input.artifactType,
    schemaVersion: 1,
    generation: integer(input.generation, 0, Number.MAX_SAFE_INTEGER, code),
    repositoryPolicyDigest: digest(input.repositoryPolicyDigest, code),
    entries
  };
}

function validateCompositionInput(input) {
  const code = 'PACK_SELECTION_INVALID';
  exact(input, ['role', 'digest'], code);
  if (!COMPOSITION_INPUT_ROLES.includes(input.role)) fail(code);
  return { role: input.role, digest: digest(input.digest, code) };
}

function validateSelection(input) {
  const code = 'PACK_SELECTION_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'subjectDigest', 'repositoryPolicyDigest', 'snapshotDigest', 'expectedGeneration', 'orderedEntries', 'compositionInputs', 'expiresAt'], code);
  if (input.artifactType !== 'kstack-pack-selection' || input.schemaVersion !== 1
      || !Array.isArray(input.orderedEntries) || input.orderedEntries.length < 1 || input.orderedEntries.length > MAX_SELECTION_ENTRIES
      || !Array.isArray(input.compositionInputs) || input.compositionInputs.length < 1
      || input.compositionInputs.length > COMPOSITION_INPUT_ROLES.length) fail(code);
  const orderedEntries = input.orderedEntries.map(validateSnapshotEntry);
  const compositionInputs = input.compositionInputs.map(validateCompositionInput);
  if (new Set(orderedEntries.map((entry) => entry.packId)).size !== orderedEntries.length
      || new Set(compositionInputs.map((entry) => entry.role)).size !== compositionInputs.length
      || compositionInputs.some((entry, index) => entry.role !== [...compositionInputs].sort((a, b) => compareUtf8(a.role, b.role))[index].role)) fail(code);
  return {
    artifactType: input.artifactType,
    schemaVersion: 1,
    subjectDigest: digest(input.subjectDigest, code),
    repositoryPolicyDigest: digest(input.repositoryPolicyDigest, code),
    snapshotDigest: digest(input.snapshotDigest, code),
    expectedGeneration: integer(input.expectedGeneration, 0, Number.MAX_SAFE_INTEGER, code),
    orderedEntries,
    compositionInputs,
    expiresAt: instant(input.expiresAt, code)
  };
}

const VALIDATORS = Object.freeze({
  'kstack-pack-material': validateMaterial,
  'kstack-pack-compatibility-tuple': validateCompatibility,
  'kstack-pack-review-policy': validateReviewPolicy,
  'kstack-pack-approval-policy': validateApprovalPolicy,
  'kstack-pack-review': validateReview,
  'kstack-pack-approval': validateApproval,
  'kstack-pack-snapshot': validateSnapshot,
  'kstack-pack-selection': validateSelection
});

export function createPackArtifact(input) {
  if (!plain(input) || typeof input.artifactType !== 'string' || !VALIDATORS[input.artifactType]) fail('PACK_ARTIFACT_TYPE_INVALID');
  return artifactResult(VALIDATORS[input.artifactType](input));
}

export function parsePackArtifact(bytes, expectedArtifactType, expectedDigest) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array) || bytes.length > MAX_ARTIFACT_BYTES) fail('PACK_ARTIFACT_INVALID');
  if (!VALIDATORS[expectedArtifactType]) fail('PACK_ARTIFACT_TYPE_INVALID');
  let input;
  try { input = parseHostCanonicalJson(bytes); } catch { fail('PACK_ARTIFACT_INVALID'); }
  if (input.artifactType !== expectedArtifactType) fail('PACK_ARTIFACT_TYPE_INVALID');
  const result = artifactResult(VALIDATORS[expectedArtifactType](input));
  if (!result.canonicalBytes.equals(Buffer.from(bytes))) fail('PACK_ARTIFACT_INVALID');
  if (expectedDigest !== undefined && !digestEqual(result.artifactDigest, expectedDigest)) fail('PACK_ARTIFACT_DIGEST_MISMATCH');
  return result;
}

function strictBase64(value, code) {
  if (typeof value !== 'string' || value.length < 4 || value.length > Math.ceil(MAX_ARTIFACT_BYTES / 3) * 4
      || value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) fail(code);
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length > MAX_ARTIFACT_BYTES || bytes.toString('base64') !== value) fail(code);
  return bytes;
}

function validateInventory(input) {
  const code = 'PACK_INVENTORY_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'operationReceiptDigest', 'entries'], code);
  if (input.artifactType !== 'kstack-operation-inventory' || input.schemaVersion !== 1
      || !Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > MAX_INVENTORY_ENTRIES) fail(code);
  const entries = input.entries.map((entry) => {
    exact(entry, ['artifactType', 'digest', 'artifactBytesBase64'], code);
    if (!VALIDATORS[entry.artifactType]) fail(code);
    const bytes = strictBase64(entry.artifactBytesBase64, code);
    const parsed = parsePackArtifact(bytes, entry.artifactType, entry.digest);
    return { artifactType: entry.artifactType, digest: parsed.artifactDigest, artifactBytesBase64: entry.artifactBytesBase64 };
  });
  const keys = entries.map((entry) => `${entry.artifactType}\u0000${entry.digest}`);
  const sorted = [...keys].sort(compareUtf8);
  if (new Set(keys).size !== keys.length || keys.some((key, index) => key !== sorted[index])) fail(code);
  return {
    artifactType: input.artifactType,
    schemaVersion: 1,
    operationReceiptDigest: digest(input.operationReceiptDigest, code),
    entries
  };
}

export function createValidationInventory(input) {
  const code = 'PACK_INVENTORY_INVALID';
  exact(input, ['operationReceiptDigest', 'artifacts'], code);
  if (!Array.isArray(input.artifacts) || input.artifacts.length < 1) fail(code);
  const entries = input.artifacts.map((artifact) => {
    exact(artifact, ['artifactType', 'digest', 'bytes'], code);
    const parsed = parsePackArtifact(artifact.bytes, artifact.artifactType, artifact.digest);
    return { artifactType: artifact.artifactType, digest: parsed.artifactDigest, artifactBytesBase64: parsed.canonicalBytes.toString('base64') };
  }).sort((left, right) => compareUtf8(`${left.artifactType}\u0000${left.digest}`, `${right.artifactType}\u0000${right.digest}`));
  const record = validateInventory({ artifactType: 'kstack-operation-inventory', schemaVersion: 1, operationReceiptDigest: input.operationReceiptDigest, entries });
  let canonicalBytes;
  try { canonicalBytes = hostCanonicalBytes(record); } catch { fail(code); }
  return immutable({ record, canonicalBytes, inventoryDigest: domainDigest('KSTACK-VALIDATION-INVENTORY-V1\n', record) });
}

function openInventory(bytes, expectedDigest, expectedOperationReceiptDigest) {
  let input;
  try { input = parseHostCanonicalJson(bytes); } catch { fail('PACK_INVENTORY_INVALID'); }
  const record = validateInventory(input);
  let canonicalBytes;
  try { canonicalBytes = hostCanonicalBytes(record); } catch { fail('PACK_INVENTORY_INVALID'); }
  if (!canonicalBytes.equals(Buffer.from(bytes))) fail('PACK_INVENTORY_INVALID');
  const inventoryDigest = domainDigest('KSTACK-VALIDATION-INVENTORY-V1\n', record);
  if (!digestEqual(inventoryDigest, expectedDigest) || !digestEqual(record.operationReceiptDigest, expectedOperationReceiptDigest)) fail('PACK_INVENTORY_BINDING_MISMATCH');
  const entries = new Map(record.entries.map((entry) => [`${entry.artifactType}\u0000${entry.digest}`, Buffer.from(entry.artifactBytesBase64, 'base64')]));
  return immutable({ record, inventoryDigest, resolve(artifactType, artifactDigest) {
    const key = `${artifactType}\u0000${digest(artifactDigest, 'PACK_INVENTORY_INVALID')}`;
    const artifactBytes = entries.get(key);
    if (!artifactBytes) fail('PACK_INVENTORY_ARTIFACT_MISSING');
    return parsePackArtifact(artifactBytes, artifactType, artifactDigest);
  } });
}

function requireSame(...values) {
  if (values.length < 2 || values.slice(1).some((value) => !digestEqual(values[0], value))) fail('PACK_GRAPH_BINDING_MISMATCH');
}

function enforceReviewPolicy(review, policy) {
  if (policy.minimumConfidence < 93 || REVIEW_CHECKS.some((check) => !policy.requiredChecks.includes(check))
      || policy.blockOnSecurityFinding !== true || policy.blockOnMaterialDissent !== true
      || policy.blockOnUnresolvedQuestion !== true) fail('PACK_POLICY_WEAKENING_AUTHORIZATION_REQUIRED');
  if (!policy.requiredReviewerClasses.includes(review.reviewerClass) || review.confidence < policy.minimumConfidence
      || policy.requiredChecks.some((check) => !review.passedChecks.includes(check))
      || policy.blockOnSecurityFinding && review.securityFindingCount !== 0
      || policy.blockOnMaterialDissent && review.materialDissentCount !== 0
      || policy.blockOnUnresolvedQuestion && review.unresolvedQuestionCount !== 0) fail('PACK_REVIEW_POLICY_REFUSED');
}

function enforceApprovalPolicy(approval, review, reviewPolicy, policy) {
  if (policy.acceptedReviewVerdicts.length !== 1 || policy.acceptedReviewVerdicts[0] !== 'approve'
      || policy.requireAllReviewChecks !== true || policy.requireIndependentApproval !== true) fail('PACK_POLICY_WEAKENING_AUTHORIZATION_REQUIRED');
  if (!policy.acceptedReviewVerdicts.includes(approval.acceptedVerdict)
      || !policy.allowedApprovalClasses.includes(approval.approvalClass)
      || policy.requireIndependentApproval && !approval.independentFromReviewer
      || policy.requireAllReviewChecks && reviewPolicy.requiredChecks.some((check) => !review.passedChecks.includes(check))) fail('PACK_APPROVAL_POLICY_REFUSED');
}

function validateApprovalGraphFromInventory(inventory, expectedApprovalDigest) {
  const approvalResult = inventory.resolve('kstack-pack-approval', expectedApprovalDigest);
  const approval = approvalResult.record;
  const reviewResult = inventory.resolve('kstack-pack-review', approval.reviewArtifactDigest);
  const review = reviewResult.record;
  const materialResult = inventory.resolve('kstack-pack-material', approval.materialDigest);
  const material = materialResult.record;
  const compatibilityResult = inventory.resolve('kstack-pack-compatibility-tuple', review.compatibilityTupleDigest);
  const compatibility = compatibilityResult.record;
  const reviewPolicyResult = inventory.resolve('kstack-pack-review-policy', review.reviewPolicyDigest);
  const approvalPolicyResult = inventory.resolve('kstack-pack-approval-policy', approval.approvalPolicyDigest);

  requireSame(approval.materialDigest, review.materialDigest, materialResult.artifactDigest, compatibility.materialDigest);
  requireSame(approval.reviewArtifactDigest, reviewResult.artifactDigest);
  requireSame(review.compatibilityTupleDigest, compatibilityResult.artifactDigest);
  requireSame(review.reviewPolicyDigest, reviewPolicyResult.artifactDigest);
  requireSame(approval.approvalPolicyDigest, approvalPolicyResult.artifactDigest);
  if (approval.acceptedVerdict !== review.verdict || material.packId !== compatibility.packId
      || material.version !== compatibility.version || compatibility.compatible !== true) fail('PACK_GRAPH_BINDING_MISMATCH');
  enforceReviewPolicy(review, reviewPolicyResult.record);
  enforceApprovalPolicy(approval, review, reviewPolicyResult.record, approvalPolicyResult.record);

  return immutable({
    packId: material.packId,
    version: material.version,
    bundleDigest: material.bundleDigest,
    materialDigest: materialResult.artifactDigest,
    compatibilityTupleDigest: compatibilityResult.artifactDigest,
    reviewArtifactDigest: reviewResult.artifactDigest,
    approvalArtifactDigest: approvalResult.artifactDigest,
    reviewPolicyDigest: reviewPolicyResult.artifactDigest,
    approvalPolicyDigest: approvalPolicyResult.artifactDigest
  });
}

export function validateApprovalGraph(input) {
  const code = 'PACK_GRAPH_INVALID';
  exact(input, ['inventoryBytes', 'expectedInventoryDigest', 'expectedOperationReceiptDigest', 'expectedApprovalDigest'], code);
  const inventory = openInventory(input.inventoryBytes, input.expectedInventoryDigest, input.expectedOperationReceiptDigest);
  return validateApprovalGraphFromInventory(inventory, digest(input.expectedApprovalDigest, code));
}

export function createPackSelection(input) {
  return artifactResult(validateSelection({ artifactType: 'kstack-pack-selection', schemaVersion: 1, ...input }));
}

function trustedNow(input) {
  const code = 'PACK_TRUSTED_TIME_UNAVAILABLE';
  exact(input, ['now', 'sourceProfileDigest', 'attestationDigest', 'qualified', 'rollbackDetected'], code);
  if (input.qualified !== true || input.rollbackDetected !== false) fail(code);
  digest(input.sourceProfileDigest, code);
  digest(input.attestationDigest, code);
  return instant(input.now, code);
}

function validateOwnerAcceptance(input, selectionDigest, repositoryPolicyDigest, now) {
  let consumed;
  try {
    consumed = assertConsumedIdentityActionResult(input, {
      action: 'pack-selection', targetDigest: selectionDigest, policyDigest: repositoryPolicyDigest, now
    });
  } catch {
    fail('PACK_OWNER_ACCEPTANCE_INVALID');
  }
  return consumed.receiptDigest;
}

export function validatePackSelection(input) {
  const code = 'PACK_SELECTION_ADMISSION_INVALID';
  exact(input, ['selectionBytes', 'expectedSelectionDigest', 'inventoryBytes', 'expectedInventoryDigest', 'expectedOperationReceiptDigest', 'expectedRepositoryPolicyDigest', 'liveGuard', 'ownerAcceptance', 'trustedTime'], code);
  const now = trustedNow(input.trustedTime);
  const inventory = openInventory(input.inventoryBytes, input.expectedInventoryDigest, input.expectedOperationReceiptDigest);
  const selectionResult = inventory.resolve('kstack-pack-selection', digest(input.expectedSelectionDigest, code));
  const selection = selectionResult.record;
  if (!selectionResult.canonicalBytes.equals(Buffer.from(input.selectionBytes))) fail('PACK_SELECTION_BYTES_MISMATCH');
  if (!digestEqual(selection.repositoryPolicyDigest, input.expectedRepositoryPolicyDigest)
      || Date.parse(selection.expiresAt) <= Date.parse(now)) fail('PACK_SELECTION_EXPIRED_OR_POLICY_MISMATCH');
  exact(input.liveGuard, ['snapshotDigest', 'generation'], code);
  const liveSnapshotDigest = digest(input.liveGuard.snapshotDigest, code);
  const liveGeneration = integer(input.liveGuard.generation, 0, Number.MAX_SAFE_INTEGER, code);
  if (!digestEqual(selection.snapshotDigest, liveSnapshotDigest) || selection.expectedGeneration !== liveGeneration) fail('PACK_SELECTION_STALE');
  const snapshotResult = inventory.resolve('kstack-pack-snapshot', selection.snapshotDigest);
  const snapshot = snapshotResult.record;
  if (!digestEqual(snapshot.repositoryPolicyDigest, selection.repositoryPolicyDigest)
      || snapshot.generation !== selection.expectedGeneration
      || !hostCanonicalBytes(snapshot.entries).equals(hostCanonicalBytes(selection.orderedEntries))) fail('PACK_SELECTION_STALE');

  const approvalProjections = selection.orderedEntries.map((entry) => {
    const projection = validateApprovalGraphFromInventory(inventory, entry.approvalArtifactDigest);
    if (projection.packId !== entry.packId || projection.version !== entry.version
        || !digestEqual(projection.materialDigest, entry.materialDigest)
        || !digestEqual(projection.compatibilityTupleDigest, entry.compatibilityTupleDigest)
        || !digestEqual(projection.reviewArtifactDigest, entry.reviewArtifactDigest)
        || !digestEqual(projection.approvalArtifactDigest, entry.approvalArtifactDigest)) fail('PACK_SELECTION_GRAPH_MISMATCH');
    return projection;
  });
  const ownerAcceptanceReceiptDigest = validateOwnerAcceptance(
    input.ownerAcceptance, selectionResult.artifactDigest, selection.repositoryPolicyDigest, now
  );
  const projection = immutable({
    approvalAuthorityScope: PACK_APPROVAL_AUTHORITY_SCOPE,
    subjectDigest: selection.subjectDigest,
    repositoryPolicyDigest: selection.repositoryPolicyDigest,
    snapshotDigest: selection.snapshotDigest,
    expectedGeneration: selection.expectedGeneration,
    selectionDigest: selectionResult.artifactDigest,
    ownerAcceptanceReceiptDigest,
    orderedEntries: selection.orderedEntries,
    compositionInputs: selection.compositionInputs,
    expiresAt: selection.expiresAt,
    approvalPolicyBindings: approvalProjections.map((entry) => ({
      packId: entry.packId,
      bundleDigest: entry.bundleDigest,
      reviewPolicyDigest: entry.reviewPolicyDigest,
      approvalPolicyDigest: entry.approvalPolicyDigest
    }))
  });
  const result = immutable({
    projection,
    compositionReceiptDigest: domainDigest('KSTACK-PACK-SELECTION-COMPOSITION-PROJECTION-V1\n', projection),
    dispatchReceiptDigest: domainDigest('KSTACK-PACK-SELECTION-DISPATCH-PROJECTION-V1\n', projection)
  });
  VALIDATED_SELECTIONS.add(result);
  return result;
}

export function assertValidatedPackSelectionResult(result) {
  if (!result || typeof result !== 'object' || !VALIDATED_SELECTIONS.has(result)) fail('PACK_SELECTION_VALIDATED_RESULT_INVALID');
  return result;
}
