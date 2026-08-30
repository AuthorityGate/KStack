import crypto from 'node:crypto';
import { hostCanonicalBytes, parseHostCanonicalJson } from './kstack-host-contract.mjs';

export const IDENTITY_ACTIONS = Object.freeze([
  'pack-selection',
  'required-pack-waiver',
  'policy-weakening',
  'catalog-activation',
  'catalog-downgrade',
  'quarantine-reversal'
]);

export const GITHUB_PROTECTED_REVIEW_ADAPTER = Object.freeze({
  adapterId: 'github-protected-review',
  adapterVersion: '1.0.0',
  providerProtocol: 'github-rest-v3',
  endpointOrigin: 'https://api.github.com'
});

const ACTION_SET = new Set(IDENTITY_ACTIONS);
const DIGEST = /^[a-f0-9]{64}$/u;
const NONCE = /^[a-f0-9]{32,64}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const ADAPTER_ID = /^[a-z][a-z0-9-]{0,127}$/u;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const PRINCIPAL_ID = /^[1-9][0-9]{0,19}$/u;
const OID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const ARTIFACT_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]{1,512}$/u;
const ENDPOINT_ID = /^[a-z][a-z0-9-]{0,63}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const MAX_PROVIDER_RESPONSE_BYTES = 4 * 1024 * 1024;
const VERIFIED_IDENTITY_ACTIONS = new WeakSet();
const CONSUMED_IDENTITY_ACTIONS = new WeakSet();

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

function string(value, expression, code, maximum = 512) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !value.isWellFormed()
      || CONTROL_OR_BIDI.test(value) || !expression.test(value)) fail(code);
  return value;
}

function digest(value, code) {
  return string(value, DIGEST, code, 64);
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

function integer(value, code, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) fail(code);
  return value;
}

function bool(value, code) {
  if (typeof value !== 'boolean') fail(code);
  return value;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function sortedUnique(values, validator, code, maximum = 256) {
  if (!Array.isArray(values) || values.length < 1 || values.length > maximum) fail(code);
  const admitted = values.map((value) => validator(value));
  const sorted = [...admitted].sort(compareUtf8);
  if (new Set(admitted).size !== admitted.length || admitted.some((value, index) => value !== sorted[index])) fail(code);
  return admitted;
}

function domainDigest(domain, value) {
  return crypto.createHash('sha256').update(Buffer.from(domain, 'utf8')).update(hostCanonicalBytes(value)).digest('hex');
}

function bytesSha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function immutable(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

function canonicalClone(value) {
  return parseHostCanonicalJson(hostCanonicalBytes(value));
}

function validateAdapter(input) {
  const code = 'IDENTITY_TRUST_ROOT_UNAVAILABLE';
  exact(input, ['adapterId', 'adapterVersion', 'trustMaterialDigest', 'allowedProviderPrincipalIds', 'allowedActions'], code);
  const adapterId = string(input.adapterId, ADAPTER_ID, code, 128);
  const adapterVersion = string(input.adapterVersion, VERSION, code, 64);
  const trustMaterialDigest = digest(input.trustMaterialDigest, code);
  const allowedProviderPrincipalIds = sortedUnique(
    input.allowedProviderPrincipalIds,
    (value) => string(value, PRINCIPAL_ID, code, 20),
    code
  );
  const allowedActions = sortedUnique(
    input.allowedActions,
    (value) => {
      if (!ACTION_SET.has(value)) fail(code);
      return value;
    },
    code,
    IDENTITY_ACTIONS.length
  );
  return { adapterId, adapterVersion, trustMaterialDigest, allowedProviderPrincipalIds, allowedActions };
}

export function validateIdentityTrustRoot(input, expected = {}) {
  const code = 'IDENTITY_TRUST_ROOT_UNAVAILABLE';
  exact(input, ['artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId', 'adapters', 'policyVersion', 'createdAt'], code);
  if (input.artifactType !== 'kstack-identity-trust-root' || input.schemaVersion !== 1) fail(code);
  const projectId = string(input.projectId, IDENTIFIER, code, 256);
  const repositoryImmutableId = string(input.repositoryImmutableId, IDENTIFIER, code, 256);
  if (expected.projectId !== undefined && projectId !== expected.projectId) fail(code);
  if (expected.repositoryImmutableId !== undefined && repositoryImmutableId !== expected.repositoryImmutableId) fail(code);
  if (!Array.isArray(input.adapters) || input.adapters.length < 1 || input.adapters.length > 16) fail(code);
  const adapters = input.adapters.map(validateAdapter);
  const adapterKeys = adapters.map((adapter) => `${adapter.adapterId}@${adapter.adapterVersion}`);
  const sortedKeys = [...adapterKeys].sort(compareUtf8);
  if (new Set(adapterKeys).size !== adapterKeys.length || adapterKeys.some((key, index) => key !== sortedKeys[index])) fail(code);
  const record = {
    artifactType: 'kstack-identity-trust-root',
    schemaVersion: 1,
    projectId,
    repositoryImmutableId,
    adapters,
    policyVersion: integer(input.policyVersion, code, 1),
    createdAt: instant(input.createdAt, code)
  };
  return immutable({
    record,
    trustRootDigest: domainDigest('KSTACK-IDENTITY-TRUST-ROOT-V1\n', record)
  });
}

export function parseIdentityTrustRoot(bytes, protection, expected = {}) {
  const code = 'IDENTITY_TRUST_ROOT_UNAVAILABLE';
  exact(protection, ['source', 'repositoryResident', 'protected'], code);
  if (protection.source !== 'external-broker' || protection.repositoryResident !== false || protection.protected !== true) fail(code);
  let parsed;
  try { parsed = parseHostCanonicalJson(bytes); } catch { fail(code); }
  return validateIdentityTrustRoot(parsed, expected);
}

function validateActionRequest(input) {
  const code = 'IDENTITY_ACTION_REQUEST_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId', 'action', 'targetDigest', 'policyDigest', 'nonce', 'notBefore', 'expiresAt'], code);
  if (input.artifactType !== 'kstack-identity-action-request' || input.schemaVersion !== 1 || !ACTION_SET.has(input.action)) fail(code);
  const request = {
    artifactType: 'kstack-identity-action-request',
    schemaVersion: 1,
    projectId: string(input.projectId, IDENTIFIER, code, 256),
    repositoryImmutableId: string(input.repositoryImmutableId, IDENTIFIER, code, 256),
    action: input.action,
    targetDigest: digest(input.targetDigest, code),
    policyDigest: digest(input.policyDigest, code),
    nonce: string(input.nonce, NONCE, code, 128),
    notBefore: instant(input.notBefore, code),
    expiresAt: instant(input.expiresAt, code)
  };
  if (Date.parse(request.notBefore) >= Date.parse(request.expiresAt)) fail(code);
  return request;
}

export function createIdentityActionRequest(input) {
  const request = validateActionRequest({ artifactType: 'kstack-identity-action-request', schemaVersion: 1, ...input });
  const canonicalBytes = hostCanonicalBytes(request);
  return immutable({
    request,
    canonicalBytes,
    requestDigest: crypto.createHash('sha256').update(Buffer.from('KSTACK-IDENTITY-ACTION-REQUEST-V1\n', 'utf8')).update(canonicalBytes).digest('hex')
  });
}

export function parseIdentityActionRequest(bytes) {
  let parsed;
  try { parsed = parseHostCanonicalJson(bytes); } catch { fail('IDENTITY_ACTION_REQUEST_INVALID'); }
  const created = createIdentityActionRequest(parsed);
  if (!created.canonicalBytes.equals(Buffer.from(bytes))) fail('IDENTITY_ACTION_REQUEST_INVALID');
  return created;
}

function strictBase64(value, code) {
  if (typeof value !== 'string' || value.length < 4 || value.length > 2 * 1024 * 1024 || value.length % 4 !== 0
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) fail(code);
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) fail(code);
  return bytes;
}

function validateRuleset(input) {
  const code = 'IDENTITY_PROVIDER_EVIDENCE_INVALID';
  exact(input, ['rulesetId', 'targetBaseRef', 'active', 'requiresPullRequestReview', 'requiredApprovals'], code);
  const ruleset = {
    rulesetId: string(input.rulesetId, IDENTIFIER, code, 256),
    targetBaseRef: string(input.targetBaseRef, /^refs\/heads\/[A-Za-z0-9._/-]{1,240}$/u, code, 256),
    active: bool(input.active, code),
    requiresPullRequestReview: bool(input.requiresPullRequestReview, code),
    requiredApprovals: integer(input.requiredApprovals, code, 0)
  };
  if (!ruleset.active || !ruleset.requiresPullRequestReview || ruleset.requiredApprovals < 1) fail('IDENTITY_RULESET_UNQUALIFIED');
  return ruleset;
}

function validateReview(input) {
  const code = 'IDENTITY_PROVIDER_EVIDENCE_INVALID';
  exact(input, ['reviewId', 'state', 'commitOid', 'providerPrincipalId', 'dismissed', 'submittedAt'], code);
  return {
    reviewId: string(input.reviewId, IDENTIFIER, code, 256),
    state: string(input.state, /^(?:APPROVED|CHANGES_REQUESTED|COMMENTED|DISMISSED)$/u, code, 32),
    commitOid: string(input.commitOid, OID, code, 64),
    providerPrincipalId: string(input.providerPrincipalId, PRINCIPAL_ID, code, 20),
    dismissed: bool(input.dismissed, code),
    submittedAt: instant(input.submittedAt, code)
  };
}

function validateGithubEvidence(input) {
  const code = 'IDENTITY_PROVIDER_EVIDENCE_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'providerProtocol', 'endpointOrigin', 'repositoryId',
    'pullRequestNumber', 'headOid', 'artifactPath', 'artifactBlobBase64', 'baseRef',
    'ruleset', 'reviews', 'reviewsPaginationComplete', 'rulesetsPaginationComplete', 'capturedAt'
  ], code);
  if (input.artifactType !== 'kstack-github-protected-review-evidence' || input.schemaVersion !== 1
      || input.providerProtocol !== GITHUB_PROTECTED_REVIEW_ADAPTER.providerProtocol
      || input.endpointOrigin !== GITHUB_PROTECTED_REVIEW_ADAPTER.endpointOrigin) fail(code);
  if (!Array.isArray(input.reviews) || input.reviews.length < 1 || input.reviews.length > 256) fail(code);
  const reviews = input.reviews.map(validateReview);
  if (new Set(reviews.map((review) => review.reviewId)).size !== reviews.length) fail(code);
  return {
    artifactType: input.artifactType,
    schemaVersion: 1,
    providerProtocol: input.providerProtocol,
    endpointOrigin: input.endpointOrigin,
    repositoryId: string(input.repositoryId, IDENTIFIER, code, 256),
    pullRequestNumber: integer(input.pullRequestNumber, code, 1),
    headOid: string(input.headOid, OID, code, 64),
    artifactPath: string(input.artifactPath, ARTIFACT_PATH, code, 512),
    artifactBlobBase64: input.artifactBlobBase64,
    baseRef: string(input.baseRef, /^refs\/heads\/[A-Za-z0-9._/-]{1,240}$/u, code, 256),
    ruleset: validateRuleset(input.ruleset),
    reviews,
    reviewsPaginationComplete: bool(input.reviewsPaginationComplete, code),
    rulesetsPaginationComplete: bool(input.rulesetsPaginationComplete, code),
    capturedAt: instant(input.capturedAt, code)
  };
}

function providerResponseInventory(rawProviderResponses, expectedTrustMaterialDigest) {
  const code = 'IDENTITY_PROVIDER_EVIDENCE_INVALID';
  if (!Array.isArray(rawProviderResponses) || rawProviderResponses.length < 1 || rawProviderResponses.length > 64) fail(code);
  const bodies = new Map();
  const rows = rawProviderResponses.map((entry) => {
    exact(entry, ['endpointId', 'status', 'tlsVerified', 'authenticated', 'complete', 'trustMaterialDigest', 'bodyBytes'], code);
    if (!(entry.bodyBytes instanceof Uint8Array) || entry.bodyBytes.length < 2 || entry.bodyBytes.length > MAX_PROVIDER_RESPONSE_BYTES) fail(code);
    if (entry.status !== 200 || entry.tlsVerified !== true || entry.authenticated !== true || entry.complete !== true
        || digest(entry.trustMaterialDigest, code) !== expectedTrustMaterialDigest) fail('IDENTITY_PROVIDER_UNAVAILABLE');
    let body;
    try { body = parseHostCanonicalJson(entry.bodyBytes); } catch { fail(code); }
    bodies.set(entry.endpointId, body);
    return {
      endpointId: string(entry.endpointId, ENDPOINT_ID, code, 64),
      status: entry.status,
      bodyBytes: entry.bodyBytes.length,
      bodyDigest: bytesSha256(entry.bodyBytes)
    };
  });
  rows.sort((left, right) => compareUtf8(left.endpointId, right.endpointId));
  const expectedEndpoints = ['artifact-blob', 'pull-request', 'repository', 'reviews', 'ruleset'];
  if (new Set(rows.map((row) => row.endpointId)).size !== rows.length
      || rows.some((row, index) => row.endpointId !== expectedEndpoints[index])) fail(code);
  return { rows, bodies };
}

function reconstructGithubEvidence(responseBodies) {
  const code = 'IDENTITY_PROVIDER_EVIDENCE_INVALID';
  const repository = responseBodies.get('repository');
  const pullRequest = responseBodies.get('pull-request');
  const artifactBlob = responseBodies.get('artifact-blob');
  const ruleset = responseBodies.get('ruleset');
  const reviews = responseBodies.get('reviews');
  exact(repository, ['repositoryId'], code);
  exact(pullRequest, ['repositoryId', 'pullRequestNumber', 'headOid', 'baseRef', 'capturedAt'], code);
  exact(artifactBlob, ['repositoryId', 'commitOid', 'artifactPath', 'artifactBlobBase64'], code);
  exact(ruleset, ['repositoryId', 'baseRef', 'ruleset', 'rulesetsPaginationComplete'], code);
  exact(reviews, ['repositoryId', 'pullRequestNumber', 'reviews', 'reviewsPaginationComplete'], code);
  if ([pullRequest.repositoryId, artifactBlob.repositoryId, ruleset.repositoryId, reviews.repositoryId]
    .some((value) => value !== repository.repositoryId)
      || reviews.pullRequestNumber !== pullRequest.pullRequestNumber
      || artifactBlob.commitOid !== pullRequest.headOid
      || ruleset.baseRef !== pullRequest.baseRef) fail(code);
  return {
    artifactType: 'kstack-github-protected-review-evidence',
    schemaVersion: 1,
    providerProtocol: GITHUB_PROTECTED_REVIEW_ADAPTER.providerProtocol,
    endpointOrigin: GITHUB_PROTECTED_REVIEW_ADAPTER.endpointOrigin,
    repositoryId: repository.repositoryId,
    pullRequestNumber: pullRequest.pullRequestNumber,
    headOid: pullRequest.headOid,
    artifactPath: artifactBlob.artifactPath,
    artifactBlobBase64: artifactBlob.artifactBlobBase64,
    baseRef: pullRequest.baseRef,
    ruleset: ruleset.ruleset,
    reviews: reviews.reviews,
    reviewsPaginationComplete: reviews.reviewsPaginationComplete,
    rulesetsPaginationComplete: ruleset.rulesetsPaginationComplete,
    capturedAt: pullRequest.capturedAt
  };
}

export function verifyGithubProtectedReview(input) {
  const code = 'IDENTITY_PROVIDER_EVIDENCE_INVALID';
  exact(input, [
    'requestBytes', 'expectedRequestDigest', 'trustRootBytes', 'trustRootProtection', 'expectedTrustRootDigest', 'adapterId',
    'adapterVersion', 'pullRequestNumber', 'candidateCommitOid', 'artifactPath', 'evidence',
    'rawProviderResponses', 'trustedTime'
  ], code);
  const requestRecord = parseIdentityActionRequest(input.requestBytes);
  if (requestRecord.requestDigest !== digest(input.expectedRequestDigest, code)) fail('IDENTITY_REQUEST_DIGEST_MISMATCH');
  exact(input.trustedTime, ['now', 'sourceProfileDigest', 'attestationDigest', 'qualified', 'rollbackDetected'], 'IDENTITY_TRUSTED_TIME_UNAVAILABLE');
  if (input.trustedTime.qualified !== true || input.trustedTime.rollbackDetected !== false) fail('IDENTITY_TRUSTED_TIME_UNAVAILABLE');
  digest(input.trustedTime.sourceProfileDigest, 'IDENTITY_TRUSTED_TIME_UNAVAILABLE');
  digest(input.trustedTime.attestationDigest, 'IDENTITY_TRUSTED_TIME_UNAVAILABLE');
  const trustedNow = instant(input.trustedTime.now, 'IDENTITY_TRUSTED_TIME_UNAVAILABLE');
  const now = Date.parse(trustedNow);
  if (now < Date.parse(requestRecord.request.notBefore) || now >= Date.parse(requestRecord.request.expiresAt)) fail('IDENTITY_REQUEST_EXPIRED');

  const trustRoot = parseIdentityTrustRoot(input.trustRootBytes, input.trustRootProtection, {
    projectId: requestRecord.request.projectId,
    repositoryImmutableId: requestRecord.request.repositoryImmutableId
  });
  if (trustRoot.trustRootDigest !== digest(input.expectedTrustRootDigest, code)) fail('IDENTITY_TRUST_ROOT_UNAVAILABLE');
  const adapterId = string(input.adapterId, ADAPTER_ID, code, 128);
  const adapterVersion = string(input.adapterVersion, VERSION, code, 64);
  const adapter = trustRoot.record.adapters.find((candidate) => candidate.adapterId === adapterId && candidate.adapterVersion === adapterVersion);
  if (!adapter || adapterId !== GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId
      || adapterVersion !== GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion
      || !adapter.allowedActions.includes(requestRecord.request.action)) fail('IDENTITY_ADAPTER_UNQUALIFIED');

  const providerResponses = providerResponseInventory(input.rawProviderResponses, adapter.trustMaterialDigest);
  const reconstructedEvidence = reconstructGithubEvidence(providerResponses.bodies);
  if (!hostCanonicalBytes(reconstructedEvidence).equals(hostCanonicalBytes(input.evidence))) fail(code);
  const evidence = validateGithubEvidence(reconstructedEvidence);
  const artifactBytes = strictBase64(evidence.artifactBlobBase64, code);
  const candidateCommitOid = string(input.candidateCommitOid, OID, code, 64);
  const artifactPath = string(input.artifactPath, ARTIFACT_PATH, code, 512);
  if (evidence.repositoryId !== requestRecord.request.repositoryImmutableId
      || evidence.pullRequestNumber !== integer(input.pullRequestNumber, code, 1)
      || evidence.headOid !== candidateCommitOid
      || evidence.artifactPath !== artifactPath
      || !artifactBytes.equals(requestRecord.canonicalBytes)
      || evidence.ruleset.targetBaseRef !== evidence.baseRef
      || !evidence.reviewsPaginationComplete || !evidence.rulesetsPaginationComplete
      || Date.parse(evidence.capturedAt) > now) fail(code);

  const qualifying = evidence.reviews.filter((review) => review.state === 'APPROVED' && review.dismissed === false
    && review.commitOid === candidateCommitOid && adapter.allowedProviderPrincipalIds.includes(review.providerPrincipalId)
    && Date.parse(review.submittedAt) <= now);
  if (qualifying.length !== 1) fail('IDENTITY_APPROVAL_UNQUALIFIED');

  const responseInventory = providerResponses.rows;
  const providerEvidenceDigest = domainDigest('KSTACK-IDENTITY-GITHUB-PROVIDER-EVIDENCE-V1\n', {
    admittedEvidence: evidence,
    responseInventory
  });
  const rulesetEvidenceDigest = domainDigest('KSTACK-IDENTITY-GITHUB-RULESET-EVIDENCE-V1\n', evidence.ruleset);
  const result = immutable({
    requestRecord,
    trustRoot,
    admittedEvidence: canonicalClone(evidence),
    responseInventory,
    providerPrincipalId: qualifying[0].providerPrincipalId,
    providerObjectId: qualifying[0].reviewId,
    providerCommitOid: qualifying[0].commitOid,
    providerEvidenceDigest,
    rulesetEvidenceDigest,
    verifiedAt: trustedNow
  });
  VERIFIED_IDENTITY_ACTIONS.add(result);
  return result;
}

function buildReceipt(verification) {
  const { request } = verification.requestRecord;
  const receipt = {
    artifactType: 'kstack-identity-verification-receipt',
    schemaVersion: 1,
    projectId: request.projectId,
    repositoryImmutableId: request.repositoryImmutableId,
    action: request.action,
    requestDigest: verification.requestRecord.requestDigest,
    targetDigest: request.targetDigest,
    policyDigest: request.policyDigest,
    trustRootDigest: verification.trustRoot.trustRootDigest,
    adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId,
    adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
    providerPrincipalId: verification.providerPrincipalId,
    providerRepositoryId: verification.admittedEvidence.repositoryId,
    providerObjectId: verification.providerObjectId,
    providerCommitOid: verification.providerCommitOid,
    providerEvidenceDigest: verification.providerEvidenceDigest,
    rulesetEvidenceDigest: verification.rulesetEvidenceDigest,
    verifiedAt: verification.verifiedAt,
    expiresAt: request.expiresAt,
    nonce: request.nonce
  };
  const receiptDigest = domainDigest('KSTACK-IDENTITY-VERIFICATION-RECEIPT-V1\n', receipt);
  return immutable({ receipt, receiptDigest });
}

export function createIdentityVerificationReceipt(verification) {
  if (!verification || typeof verification !== 'object' || !VERIFIED_IDENTITY_ACTIONS.has(verification)) fail('IDENTITY_VERIFIED_RESULT_INVALID');
  return buildReceipt(verification);
}

function ledgerHealth(value) {
  const code = 'IDENTITY_CONSUMPTION_LEDGER_UNAVAILABLE';
  exact(value, ['available', 'rollbackDetected', 'generation', 'checkpointDigest'], code);
  if (value.available !== true) fail(code);
  if (value.rollbackDetected !== false) fail('IDENTITY_CONSUMPTION_LEDGER_ROLLBACK');
  return {
    generation: integer(value.generation, code, 0),
    checkpointDigest: digest(value.checkpointDigest, code)
  };
}

export async function verifyAndConsumeIdentityAction(input) {
  const code = 'IDENTITY_BROKER_UNAVAILABLE';
  exact(input, ['verification', 'inventory', 'ledger'], code);
  if (!input.inventory || typeof input.inventory.retain !== 'function'
      || !input.ledger || typeof input.ledger.inspect !== 'function' || typeof input.ledger.consumeOnce !== 'function') fail(code);
  const verification = verifyGithubProtectedReview(input.verification);
  const { receipt, receiptDigest } = buildReceipt(verification);
  const keyDigest = domainDigest('KSTACK-IDENTITY-CONSUMPTION-KEY-V1\n', {
    projectId: receipt.projectId,
    action: receipt.action,
    nonce: receipt.nonce,
    requestDigest: receipt.requestDigest
  });
  const before = ledgerHealth(await input.ledger.inspect());
  const inventoryRecord = immutable({
    receipt,
    receiptDigest,
    admittedEvidence: verification.admittedEvidence,
    responseInventory: verification.responseInventory,
    providerEvidenceDigest: verification.providerEvidenceDigest
  });
  const expectedInventoryDigest = domainDigest('KSTACK-IDENTITY-OPERATION-INVENTORY-V1\n', inventoryRecord);
  const retained = await input.inventory.retain(inventoryRecord);
  exact(retained, ['retained', 'inventoryDigest'], 'IDENTITY_EVIDENCE_RETENTION_FAILED');
  if (retained.retained !== true) fail('IDENTITY_EVIDENCE_RETENTION_FAILED');
  const inventoryDigest = digest(retained.inventoryDigest, 'IDENTITY_EVIDENCE_RETENTION_FAILED');
  if (inventoryDigest !== expectedInventoryDigest) fail('IDENTITY_EVIDENCE_RETENTION_FAILED');
  const consumption = await input.ledger.consumeOnce(immutable({
    keyDigest,
    requestDigest: receipt.requestDigest,
    receiptDigest,
    inventoryDigest,
    priorGeneration: before.generation,
    priorCheckpointDigest: before.checkpointDigest
  }));
  exact(consumption, ['consumed', 'generation', 'previousCheckpointDigest', 'checkpointDigest', 'rollbackWitnessDigest'], 'IDENTITY_CONSUMPTION_LEDGER_UNAVAILABLE');
  if (consumption.consumed !== true) fail('IDENTITY_REPLAY_REFUSED');
  if (consumption.generation !== before.generation + 1
      || consumption.previousCheckpointDigest !== before.checkpointDigest) fail('IDENTITY_CONSUMPTION_LEDGER_ROLLBACK');
  digest(consumption.checkpointDigest, 'IDENTITY_CONSUMPTION_LEDGER_UNAVAILABLE');
  digest(consumption.rollbackWitnessDigest, 'IDENTITY_CONSUMPTION_LEDGER_UNAVAILABLE');
  const result = immutable({
    receipt,
    receiptDigest,
    inventoryDigest,
    consumption: canonicalClone(consumption)
  });
  CONSUMED_IDENTITY_ACTIONS.add(result);
  return result;
}

export function assertConsumedIdentityActionResult(result, expected) {
  const code = 'IDENTITY_CONSUMED_RESULT_INVALID';
  exact(expected, ['action', 'targetDigest', 'policyDigest', 'now'], code);
  if (!result || typeof result !== 'object' || !CONSUMED_IDENTITY_ACTIONS.has(result)) fail(code);
  if (result.receipt.action !== expected.action || result.receipt.targetDigest !== digest(expected.targetDigest, code)
      || result.receipt.policyDigest !== digest(expected.policyDigest, code)) fail(code);
  const now = Date.parse(instant(expected.now, code));
  if (Date.parse(result.receipt.verifiedAt) > now || Date.parse(result.receipt.expiresAt) <= now
      || result.consumption.consumed !== true) fail(code);
  return result;
}
