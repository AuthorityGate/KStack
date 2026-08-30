import crypto from 'node:crypto';

const MODES = Object.freeze(['native-analysis', 'delegated-plan', 'delegated-build']);
const AUTHORITY = Object.freeze(['read-only', 'workspace-mutation']);
const OPERATIONS = Object.freeze([
  'inspect-file', 'search-text', 'run-test', 'edit-file', 'create-file', 'delegate-session'
]);
const EVIDENCE = Object.freeze(['test-result', 'artifact-digest', 'change-summary', 'content-free-receipt']);
const OUTCOMES = Object.freeze(['succeeded', 'no-effect', 'possibly-acted', 'failed']);
const RISKS = Object.freeze(['external-write', 'destructive', 'privileged', 'untrusted-input', 'independent-review']);
const HEX64 = /^[a-f0-9]{64}$/u;
const IDENTIFIER = /^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/u;

function fail(code, detail = '') {
  const error = new Error(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code;
  throw error;
}

function exactKeys(value, expected, code) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(code);
}

function text(value, code, expression = IDENTIFIER) {
  if (typeof value !== 'string' || !expression.test(value)) fail(code);
  return value;
}

function hash(value, code) {
  if (typeof value !== 'string' || !HEX64.test(value)) fail(code);
  return value;
}

function enumSet(value, admitted, code, { empty = false } = {}) {
  if (!Array.isArray(value) || (!empty && value.length === 0)) fail(code);
  const set = new Set();
  for (const entry of value) {
    if (!admitted.includes(entry) || set.has(entry)) fail(code);
    set.add(entry);
  }
  return [...set].sort();
}

function instant(value, code) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) fail(code);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) fail(code);
  return milliseconds;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function positiveInteger(value, maximum, code) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) fail(code);
  return value;
}

export function validateWorkEnvelope(input) {
  exactKeys(input, [
    'schemaVersion', 'repositoryNamespace', 'repositoryIdentityDigest', 'authoritySnapshotDigest',
    'objectiveDigest', 'planDigest', 'hostId', 'executionMode', 'authorityClass',
    'allowedOperations', 'riskSignals', 'budgets', 'issuedAt', 'expiresAt', 'nonce',
    'requiredEvidence'
  ], 'KSTACK_WORK_ENVELOPE_INVALID');
  if (input.schemaVersion !== 1) fail('KSTACK_WORK_ENVELOPE_INVALID');
  const repositoryNamespace = text(input.repositoryNamespace, 'KSTACK_WORK_ENVELOPE_INVALID', /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
  const repositoryIdentityDigest = hash(input.repositoryIdentityDigest, 'KSTACK_WORK_ENVELOPE_INVALID');
  const authoritySnapshotDigest = hash(input.authoritySnapshotDigest, 'KSTACK_WORK_ENVELOPE_INVALID');
  const objectiveDigest = hash(input.objectiveDigest, 'KSTACK_WORK_ENVELOPE_INVALID');
  const planDigest = input.planDigest === null ? null : hash(input.planDigest, 'KSTACK_WORK_ENVELOPE_INVALID');
  const hostId = text(input.hostId, 'KSTACK_WORK_ENVELOPE_INVALID');
  if (!MODES.includes(input.executionMode) || !AUTHORITY.includes(input.authorityClass)) fail('KSTACK_WORK_ENVELOPE_INVALID');
  const allowedOperations = enumSet(input.allowedOperations, OPERATIONS, 'KSTACK_WORK_ENVELOPE_INVALID');
  const riskSignals = enumSet(input.riskSignals, RISKS, 'KSTACK_WORK_ENVELOPE_INVALID', { empty: true });
  exactKeys(input.budgets, ['wallClockMs', 'outputBytes', 'files', 'mutations'], 'KSTACK_WORK_ENVELOPE_INVALID');
  const budgets = {
    wallClockMs: positiveInteger(input.budgets.wallClockMs, 86_400_000, 'KSTACK_WORK_ENVELOPE_INVALID'),
    outputBytes: positiveInteger(input.budgets.outputBytes, 16_777_216, 'KSTACK_WORK_ENVELOPE_INVALID'),
    files: positiveInteger(input.budgets.files, 10_000, 'KSTACK_WORK_ENVELOPE_INVALID'),
    mutations: positiveInteger(input.budgets.mutations, 10_000, 'KSTACK_WORK_ENVELOPE_INVALID')
  };
  const issuedAt = instant(input.issuedAt, 'KSTACK_WORK_ENVELOPE_INVALID');
  const expiresAt = instant(input.expiresAt, 'KSTACK_WORK_ENVELOPE_INVALID');
  if (expiresAt <= issuedAt || expiresAt - issuedAt > 86_400_000) fail('KSTACK_WORK_ENVELOPE_INVALID');
  const nonce = text(input.nonce, 'KSTACK_WORK_ENVELOPE_INVALID', /^[a-f0-9]{32}$/u);
  const requiredEvidence = enumSet(input.requiredEvidence, EVIDENCE, 'KSTACK_WORK_ENVELOPE_INVALID');
  if (input.authorityClass === 'read-only' && allowedOperations.some((operation) => ['edit-file', 'create-file'].includes(operation))) {
    fail('KSTACK_WORK_ENVELOPE_AUTHORITY_CONFLICT');
  }
  if (input.executionMode === 'native-analysis' && input.authorityClass !== 'read-only') fail('KSTACK_WORK_ENVELOPE_AUTHORITY_CONFLICT');
  if (input.executionMode === 'delegated-build' && planDigest === null) fail('KSTACK_WORK_ENVELOPE_PLAN_REQUIRED');
  if (allowedOperations.includes('delegate-session') && input.executionMode === 'native-analysis') fail('KSTACK_WORK_ENVELOPE_AUTHORITY_CONFLICT');
  const envelope = {
    schemaVersion: 1, repositoryNamespace, repositoryIdentityDigest, authoritySnapshotDigest,
    objectiveDigest, planDigest, hostId, executionMode: input.executionMode,
    authorityClass: input.authorityClass, allowedOperations, riskSignals, budgets,
    issuedAt: input.issuedAt, expiresAt: input.expiresAt, nonce, requiredEvidence
  };
  return Object.freeze({ ...envelope, envelopeDigest: sha256(envelope) });
}

export function admitEnvelopeUse(envelopeInput, usageRecordsInput, nowInput) {
  const envelope = validateWorkEnvelope(envelopeInput);
  const now = instant(nowInput, 'KSTACK_WORK_ENVELOPE_TIME_INVALID');
  if (now < Date.parse(envelope.issuedAt) || now >= Date.parse(envelope.expiresAt)) fail('KSTACK_WORK_ENVELOPE_EXPIRED');
  if (!Array.isArray(usageRecordsInput)) fail('KSTACK_WORK_ENVELOPE_USAGE_INVALID');
  for (const record of usageRecordsInput) {
    exactKeys(record, ['envelopeDigest', 'nonceDigest', 'terminal'], 'KSTACK_WORK_ENVELOPE_USAGE_INVALID');
    hash(record.envelopeDigest, 'KSTACK_WORK_ENVELOPE_USAGE_INVALID');
    hash(record.nonceDigest, 'KSTACK_WORK_ENVELOPE_USAGE_INVALID');
    if (typeof record.terminal !== 'boolean') fail('KSTACK_WORK_ENVELOPE_USAGE_INVALID');
    if (record.envelopeDigest === envelope.envelopeDigest || record.nonceDigest === sha256(envelope.nonce)) {
      fail('KSTACK_WORK_ENVELOPE_REPLAY');
    }
  }
  return Object.freeze({
    admitted: true,
    envelopeDigest: envelope.envelopeDigest,
    nonceDigest: sha256(envelope.nonce),
    admissionDigest: sha256({ envelopeDigest: envelope.envelopeDigest, admittedAt: nowInput })
  });
}

export function validateWorkReceipt(receiptInput, envelopeInput) {
  exactKeys(receiptInput, [
    'schemaVersion', 'envelopeDigest', 'hostId', 'cellEvidenceDigest', 'outcome',
    'attemptedOperationCounts', 'evidenceDigests', 'startedAt', 'finishedAt'
  ], 'KSTACK_WORK_RECEIPT_INVALID');
  const envelope = validateWorkEnvelope(envelopeInput);
  if (receiptInput.schemaVersion !== 1 || receiptInput.envelopeDigest !== envelope.envelopeDigest) {
    fail('KSTACK_WORK_RECEIPT_BINDING_MISMATCH');
  }
  if (receiptInput.hostId !== envelope.hostId || !OUTCOMES.includes(receiptInput.outcome)) fail('KSTACK_WORK_RECEIPT_INVALID');
  hash(receiptInput.cellEvidenceDigest, 'KSTACK_WORK_RECEIPT_INVALID');
  if (receiptInput.attemptedOperationCounts === null || typeof receiptInput.attemptedOperationCounts !== 'object'
      || Array.isArray(receiptInput.attemptedOperationCounts)) fail('KSTACK_WORK_RECEIPT_INVALID');
  const countKeys = Object.keys(receiptInput.attemptedOperationCounts).sort();
  if (countKeys.length === 0 || countKeys.some((operation) => !envelope.allowedOperations.includes(operation))) {
    fail('KSTACK_WORK_RECEIPT_OPERATION_OUTSIDE_ENVELOPE');
  }
  let mutations = 0;
  for (const operation of countKeys) {
    const count = receiptInput.attemptedOperationCounts[operation];
    if (!Number.isSafeInteger(count) || count < 0 || count > 10_000) fail('KSTACK_WORK_RECEIPT_INVALID');
    if (['edit-file', 'create-file'].includes(operation)) mutations += count;
  }
  if (mutations > envelope.budgets.mutations) fail('KSTACK_WORK_RECEIPT_BUDGET_EXCEEDED');
  if (!Array.isArray(receiptInput.evidenceDigests) || receiptInput.evidenceDigests.length > 128) fail('KSTACK_WORK_RECEIPT_INVALID');
  const evidenceDigests = receiptInput.evidenceDigests.map((value) => hash(value, 'KSTACK_WORK_RECEIPT_INVALID'));
  if (new Set(evidenceDigests).size !== evidenceDigests.length) fail('KSTACK_WORK_RECEIPT_INVALID');
  const startedAt = instant(receiptInput.startedAt, 'KSTACK_WORK_RECEIPT_INVALID');
  const finishedAt = instant(receiptInput.finishedAt, 'KSTACK_WORK_RECEIPT_INVALID');
  if (finishedAt < startedAt || finishedAt - startedAt > envelope.budgets.wallClockMs) fail('KSTACK_WORK_RECEIPT_BUDGET_EXCEEDED');
  if (startedAt < Date.parse(envelope.issuedAt) || finishedAt > Date.parse(envelope.expiresAt)) fail('KSTACK_WORK_RECEIPT_TIME_OUTSIDE_ENVELOPE');
  if (receiptInput.outcome === 'succeeded' && evidenceDigests.length < envelope.requiredEvidence.length) {
    fail('KSTACK_WORK_RECEIPT_EVIDENCE_MISSING');
  }
  const receipt = {
    schemaVersion: 1,
    envelopeDigest: receiptInput.envelopeDigest,
    hostId: receiptInput.hostId,
    cellEvidenceDigest: receiptInput.cellEvidenceDigest,
    outcome: receiptInput.outcome,
    attemptedOperationCounts: Object.fromEntries(countKeys.map((key) => [key, receiptInput.attemptedOperationCounts[key]])),
    evidenceDigests: [...evidenceDigests].sort(),
    startedAt: receiptInput.startedAt,
    finishedAt: receiptInput.finishedAt
  };
  return Object.freeze({ ...receipt, receiptDigest: sha256(receipt) });
}

export function reconciliationDirective(receiptInput, envelopeInput) {
  const receipt = validateWorkReceipt(receiptInput, envelopeInput);
  if (receipt.outcome === 'succeeded') return Object.freeze({ terminal: true, action: 'complete', retryAllowed: false });
  if (receipt.outcome === 'no-effect') return Object.freeze({ terminal: true, action: 'owner-may-issue-new-envelope', retryAllowed: false });
  if (receipt.outcome === 'possibly-acted') return Object.freeze({ terminal: false, action: 'query-only-reconciliation', retryAllowed: false });
  return Object.freeze({ terminal: true, action: 'blocked', retryAllowed: false });
}

export const WORK_ENVELOPE_CONSTANTS = Object.freeze({
  modes: MODES,
  authorityClasses: AUTHORITY,
  operations: OPERATIONS,
  evidenceKinds: EVIDENCE,
  outcomes: OUTCOMES,
  riskSignals: RISKS
});
