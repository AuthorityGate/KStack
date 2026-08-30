import assert from 'node:assert/strict';
import test from 'node:test';
import {
  admitEnvelopeUse,
  reconciliationDirective,
  validateWorkEnvelope,
  validateWorkReceipt
} from '../plugins/kstack/scripts/kstack-work-envelope.mjs';

const ENVELOPE = Object.freeze({
  schemaVersion: 1,
  repositoryNamespace: 'AuthorityGate/KStack',
  repositoryIdentityDigest: '1'.repeat(64),
  authoritySnapshotDigest: '2'.repeat(64),
  objectiveDigest: '3'.repeat(64),
  planDigest: '4'.repeat(64),
  hostId: 'openclaw',
  executionMode: 'delegated-build',
  authorityClass: 'workspace-mutation',
  allowedOperations: ['inspect-file', 'search-text', 'edit-file', 'run-test'],
  riskSignals: ['untrusted-input'],
  budgets: { wallClockMs: 60_000, outputBytes: 65_536, files: 20, mutations: 5 },
  issuedAt: '2026-08-28T12:00:00.000Z',
  expiresAt: '2026-08-28T12:10:00.000Z',
  nonce: 'a'.repeat(32),
  requiredEvidence: ['artifact-digest', 'test-result']
});

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected);
}

function receipt(changes = {}) {
  const envelope = validateWorkEnvelope(ENVELOPE);
  return {
    schemaVersion: 1,
    envelopeDigest: envelope.envelopeDigest,
    hostId: 'openclaw',
    cellEvidenceDigest: '5'.repeat(64),
    outcome: 'succeeded',
    attemptedOperationCounts: { 'edit-file': 1, 'run-test': 1 },
    evidenceDigests: ['6'.repeat(64), '7'.repeat(64)],
    startedAt: '2026-08-28T12:01:00.000Z',
    finishedAt: '2026-08-28T12:01:30.000Z',
    ...changes
  };
}

test('closed work envelopes are deterministic and reject authority conflicts', () => {
  assert.deepEqual(validateWorkEnvelope(ENVELOPE), validateWorkEnvelope(structuredClone(ENVELOPE)));
  code('KSTACK_WORK_ENVELOPE_INVALID', () => validateWorkEnvelope({ ...ENVELOPE, prompt: 'do more' }));
  code('KSTACK_WORK_ENVELOPE_AUTHORITY_CONFLICT', () => validateWorkEnvelope({
    ...ENVELOPE,
    executionMode: 'native-analysis',
    authorityClass: 'read-only'
  }));
  code('KSTACK_WORK_ENVELOPE_PLAN_REQUIRED', () => validateWorkEnvelope({ ...ENVELOPE, planDigest: null }));
});

test('admission is time-bound and replay closed', () => {
  const admitted = admitEnvelopeUse(ENVELOPE, [], '2026-08-28T12:00:01.000Z');
  assert.equal(admitted.admitted, true);
  code('KSTACK_WORK_ENVELOPE_REPLAY', () => admitEnvelopeUse(ENVELOPE, [{
    envelopeDigest: admitted.envelopeDigest,
    nonceDigest: admitted.nonceDigest,
    terminal: true
  }], '2026-08-28T12:00:02.000Z'));
  code('KSTACK_WORK_ENVELOPE_EXPIRED', () => admitEnvelopeUse(ENVELOPE, [], '2026-08-28T12:10:00.000Z'));
});

test('receipts bind host, envelope, operations, budgets, and evidence', () => {
  const validated = validateWorkReceipt(receipt(), ENVELOPE);
  assert.equal(validated.outcome, 'succeeded');
  code('KSTACK_WORK_RECEIPT_BINDING_MISMATCH', () => validateWorkReceipt(receipt({ envelopeDigest: '9'.repeat(64) }), ENVELOPE));
  code('KSTACK_WORK_RECEIPT_OPERATION_OUTSIDE_ENVELOPE', () => validateWorkReceipt(receipt({
    attemptedOperationCounts: { 'delegate-session': 1 }
  }), ENVELOPE));
  code('KSTACK_WORK_RECEIPT_BUDGET_EXCEEDED', () => validateWorkReceipt(receipt({
    attemptedOperationCounts: { 'edit-file': 6 }
  }), ENVELOPE));
  code('KSTACK_WORK_RECEIPT_EVIDENCE_MISSING', () => validateWorkReceipt(receipt({ evidenceDigests: [] }), ENVELOPE));
});

test('possibly-acted outcomes are query-only and never retryable', () => {
  const unknown = reconciliationDirective(receipt({
    outcome: 'possibly-acted',
    evidenceDigests: []
  }), ENVELOPE);
  assert.deepEqual(unknown, { terminal: false, action: 'query-only-reconciliation', retryAllowed: false });
  assert.equal(reconciliationDirective(receipt({ outcome: 'no-effect', evidenceDigests: [] }), ENVELOPE).retryAllowed, false);
  assert.equal(reconciliationDirective(receipt(), ENVELOPE).action, 'complete');
});
