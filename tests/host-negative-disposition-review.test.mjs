import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildHostNegativeDispositionReviewPayload,
  prepareHostNegativeDispositionReview
} from '../.kstack/qualifications/prepare-host-negative-disposition-review.mjs';
import {
  buildDomainCoreFinalReviewPayload,
  prepareDomainCoreFinalReview
} from '../.kstack/qualifications/prepare-domain-core-final-review.mjs';

test('Hermes and OpenClaw negative qualifications reach independent review only after a 95 primary and preserve owner authority', () => {
  const first = buildHostNegativeDispositionReviewPayload();
  const second = buildHostNegativeDispositionReviewPayload();
  assert.deepEqual(first, second);
  assert.deepEqual(first.scope, ['hb-tc07-hermes-host', 'hb-tc08-openclaw-orchestration']);
  assert.equal(first.primaryReadiness.confidence, 95);
  assert.equal(first.primaryReadiness.readyForIndependentFinalReview, true);
  assert.equal(first.decisionThreshold.minimumConfidence, 81);
  assert.equal(first.decisionThreshold.reviseAtOrAboveMinimumAcceptedForBugFixIntake, true);
  assert.equal(first.target.ownerAuthorityExcluded, true);
  assert.equal(first.target.jiraClosureExcluded, true);
  assert.match(first.targetDigest, /^[a-f0-9]{64}$/u);
  assert.equal(first.artifacts.some((entry) => entry.path.startsWith('.kstack/secrets/')), false);
  assert.equal(first.artifacts.some((entry) => entry.path.endsWith('Jira.txt')), false);
  assert.doesNotMatch(JSON.stringify(first), /ATATT3xF[A-Za-z0-9_-]{16,}/u);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-negative-review-'));
  const out = path.join(root, 'packet.json');
  const receipt = prepareHostNegativeDispositionReview(out);
  assert.equal(receipt.primaryConfidence, 95);
  assert.equal(receipt.items, 2);
  assert.equal(receipt.artifacts, 8);
  assert.equal(fs.statSync(out).mode & 0o077, 0);
  assert.throws(() => prepareHostNegativeDispositionReview(out), /EEXIST/u);

  const expectedGroups = new Map([
    ['domain-foundation', 6],
    ['domain-execution', 6],
    ['domain-acquisition', 1]
  ]);
  for (const [groupId, itemCount] of expectedGroups) {
    const domainFirst = buildDomainCoreFinalReviewPayload(groupId);
    assert.deepEqual(domainFirst, buildDomainCoreFinalReviewPayload(groupId));
    assert.equal(domainFirst.primaryReadiness.confidence, 95);
    assert.equal(domainFirst.primaryReadiness.readyForIndependentFinalReview, true);
    assert.equal(domainFirst.decisionThreshold.minimumConfidence, 81);
    assert.equal(domainFirst.decisionThreshold.reviseAtOrAboveMinimumAcceptedForBugFixIntake, true);
    assert.equal(domainFirst.scope.length, itemCount);
    assert.equal(domainFirst.target.packQualificationExcluded, true);
    assert.equal(domainFirst.target.providerTrialExcluded, true);
    assert.equal(domainFirst.target.ownerAuthorityExcluded, true);
    assert.equal(domainFirst.target.jiraClosureExcluded, true);
    assert.equal(domainFirst.artifacts.some((entry) => entry.path.startsWith('.kstack/secrets/')), false);
    if (groupId === 'domain-execution') {
      const encoded = domainFirst.artifacts.find((entry) => entry.path === 'plugins/kstack/scripts/kstack-domain-schema.mjs');
      assert.equal(encoded.contentEncoding, 'utf8-equals-segments-v1');
      const reconstructed = Buffer.from(encoded.contentUtf8EqualsSegments.join(encoded.joinWith), 'utf8');
      assert.equal(reconstructed.length, encoded.bytes);
    }
    const domainOut = path.join(root, `${groupId}.json`);
    const domainReceipt = prepareDomainCoreFinalReview(groupId, domainOut);
    assert.equal(domainReceipt.items, itemCount);
    assert.equal(domainReceipt.primaryConfidence, 95);
    assert.equal(fs.statSync(domainOut).mode & 0o077, 0);
  }
  assert.throws(() => buildDomainCoreFinalReviewPayload('unknown'), /DOMAIN_REVIEW_GROUP_INVALID/u);
});
