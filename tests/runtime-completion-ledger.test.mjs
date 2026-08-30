import assert from 'node:assert/strict';
import test from 'node:test';

import { recordDigest } from '../.kstack/qualifications/host-implementation-inventory.mjs';
import {
  applyRuntimeClosureLedger,
  validateRuntimeClosureLedger
} from '../.kstack/qualifications/runtime-completion-ledger.mjs';

const H = (value) => recordDigest({ value });
const roadmapDigest = H('roadmap');
const baseRow = {
  itemId: 'hb-tc01-canonical-package',
  lane: 'HOST_BREADTH',
  technicalState: 'IMPLEMENTED_VALIDATED',
  completionState: 'INDEPENDENT_FINAL_REVIEW_PENDING',
  evidenceDigests: [H('implementation')],
  remainingRequirements: ['independent-final-review', 'durable-jira-closure']
};

function ledger() {
  const jiraEvidence = H('jira');
  const entryBody = {
    itemId: baseRow.itemId,
    lane: baseRow.lane,
    targetDigest: recordDigest(baseRow),
    requirements: [
      {
        requirementId: 'durable-jira-closure',
        disposition: 'SATISFIED',
        evidenceDigests: [jiraEvidence],
        ownerDecisionDigest: null
      },
      {
        requirementId: 'independent-final-review',
        disposition: 'SATISFIED',
        evidenceDigests: [H('review')],
        ownerDecisionDigest: null
      }
    ],
    jira: { issueKey: 'KSTK-1', statusCategory: 'DONE', resolution: 'DONE', evidenceDigest: jiraEvidence },
    closedAt: '2026-08-30T05:00:00.000Z'
  };
  const entry = { ...entryBody, closureDigest: recordDigest(entryBody) };
  const body = {
    schemaVersion: 1,
    kind: 'kstack-runtime-host-domain-closure-ledger-v1',
    roadmapDigest,
    entries: [entry]
  };
  return { ...body, ledgerDigest: recordDigest(body) };
}

test('a target-bound review and Jira closure can close exactly one audited row', () => {
  const admitted = validateRuntimeClosureLedger(ledger(), { roadmapDigest, baseRows: [baseRow] });
  const [closed] = applyRuntimeClosureLedger([baseRow], admitted);
  assert.equal(closed.completionState, 'FULLY_CLOSED');
  assert.deepEqual(closed.remainingRequirements, []);
  assert.equal(closed.closure.jiraIssueKey, 'KSTK-1');
  assert.equal(closed.closure.targetDigest, recordDigest(baseRow));
});

test('closure fails closed on target, requirement, review, Jira, and digest drift', () => {
  const mutations = [
    (value) => { value.entries[0].targetDigest = H('stale'); },
    (value) => { value.entries[0].requirements.pop(); },
    (value) => { value.entries[0].requirements[1].disposition = 'ACCEPTED_UNSUPPORTED'; },
    (value) => { value.entries[0].jira.statusCategory = 'IN_PROGRESS'; },
    (value) => { value.entries[0].closureDigest = H('forged'); },
    (value) => { value.ledgerDigest = H('forged'); }
  ];
  for (const mutate of mutations) {
    const value = structuredClone(ledger());
    mutate(value);
    assert.throws(
      () => validateRuntimeClosureLedger(value, { roadmapDigest, baseRows: [baseRow] }),
      /KSTACK_RUNTIME_CLOSURE_LEDGER_INVALID/u
    );
  }
});

test('unsupported disposition requires an owner-bound requirement', () => {
  const ownerBase = {
    ...baseRow,
    itemId: 'hb-tc07-hermes-host',
    remainingRequirements: ['durable-jira-closure', 'owner-accept-or-requalify-later-release']
  };
  const jiraEvidence = H('owner-jira');
  const entryBody = {
    itemId: ownerBase.itemId,
    lane: ownerBase.lane,
    targetDigest: recordDigest(ownerBase),
    requirements: [
      { requirementId: 'durable-jira-closure', disposition: 'SATISFIED', evidenceDigests: [jiraEvidence], ownerDecisionDigest: null },
      { requirementId: 'owner-accept-or-requalify-later-release', disposition: 'ACCEPTED_UNSUPPORTED', evidenceDigests: [H('negative-qualification')], ownerDecisionDigest: H('owner-decision') }
    ],
    jira: { issueKey: 'KSTK-7', statusCategory: 'DONE', resolution: 'DONE', evidenceDigest: jiraEvidence },
    closedAt: '2026-08-30T05:00:00.000Z'
  };
  const entry = { ...entryBody, closureDigest: recordDigest(entryBody) };
  const body = { schemaVersion: 1, kind: 'kstack-runtime-host-domain-closure-ledger-v1', roadmapDigest, entries: [entry] };
  const admitted = validateRuntimeClosureLedger(
    { ...body, ledgerDigest: recordDigest(body) },
    { roadmapDigest, baseRows: [ownerBase] }
  );
  assert.equal(admitted.entries[0].requirements[1].disposition, 'ACCEPTED_UNSUPPORTED');
});
