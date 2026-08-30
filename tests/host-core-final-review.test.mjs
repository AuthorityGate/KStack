import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildHostCoreFinalReviewPayload,
  prepareHostCoreFinalReview
} from '../.kstack/qualifications/prepare-host-core-final-review.mjs';
import { findOutboundSecret } from '../plugins/kstack/scripts/kstack-safety-matchers.mjs';

const expected = {
  'host-portability-identity': 4,
  'host-portability-governance': 4,
  'host-portability-lifecycle': 4,
  'host-breadth-package': 3,
  'host-breadth-facade-conformance': 2
};
const expectedEncodedArtifacts = [
  'plugins/kstack/scripts/kstack-host-package.mjs',
  'plugins/kstack/scripts/kstack-host-replay-store.mjs',
  'plugins/kstack/scripts/kstack-mcp-boundary.mjs',
  'plugins/kstack/scripts/kstack-opencode-adapter.mjs',
  'plugins/kstack/scripts/kstack-opencode-candidate.mjs',
  'tests/host-package.test.mjs',
  'tests/host-replay.test.mjs',
  'tests/mcp-boundary.test.mjs',
  'tests/mcp-facade.test.mjs',
  'tests/opencode-candidate.test.mjs',
  'tests/opencode-protected-conformance.test.mjs'
];

test('all 17 implemented Host core rows have deterministic, bounded, secret-excluding independent-review packets', () => {
  const covered = new Set();
  for (const [groupId, itemCount] of Object.entries(expected)) {
    const first = buildHostCoreFinalReviewPayload(groupId);
    const second = buildHostCoreFinalReviewPayload(groupId);
    assert.deepEqual(first, second);
    assert.equal(first.groupId, groupId);
    assert.equal(first.scope.length, itemCount);
    assert.equal(first.target.rows.length, itemCount);
    for (const row of first.target.rows) {
      assert.equal(covered.has(row.itemId), false);
      covered.add(row.itemId);
    }
    assert.equal(first.primaryReadiness.confidence, 95);
    assert.equal(first.primaryReadiness.readyForIndependentFinalReview, true);
    assert.equal(first.decisionThreshold.minimumConfidence, 81);
    assert.equal(first.decisionThreshold.reviseAtOrAboveMinimumAcceptedForBugFixIntake, true);
    assert.equal(first.destination.provider, 'local-claude-cli');
    assert.equal(first.destination.model, 'opus');
    assert.equal(first.destination.tools, 'none');
    assert.equal(first.target.externalPlatformQualificationExcluded, true);
    assert.equal(first.target.hostAdmissionExcluded, true);
    assert.equal(first.target.ownerAuthorityExcluded, true);
    assert.equal(first.target.jiraClosureExcluded, true);
    assert.equal(first.artifacts.some((entry) => entry.path.startsWith('.kstack/secrets/')), false);
    assert.equal(first.artifacts.some((entry) => entry.path.endsWith('Jira.txt')), false);
    assert.deepEqual(
      first.artifacts.filter((entry) => entry.contentEncoding === 'base64-v1').map((entry) => entry.path).sort(),
      expectedEncodedArtifacts.filter((entry) => first.artifacts.some((artifact) => artifact.path === entry)).sort()
    );
    assert.equal(findOutboundSecret(Buffer.from(JSON.stringify(first)), { byteDomain: true }), null);
    for (const artifact of first.artifacts) {
      const bytes = artifact.contentEncoding === 'base64-v1'
        ? Buffer.from(artifact.contentBase64, 'base64')
        : Buffer.from(artifact.contentUtf8, 'utf8');
      assert.equal(bytes.length, artifact.bytes);
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), artifact.sha256);
    }
    assert.ok(Buffer.byteLength(JSON.stringify(first), 'utf8') < 700_000);
  }
  assert.equal(covered.size, 17);
});

test('Host core packet files are byte-stable and exclusive-create', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-host-core-review-'));
  try {
    for (const groupId of Object.keys(expected)) {
      const firstPath = path.join(directory, `${groupId}-1.json`);
      const secondPath = path.join(directory, `${groupId}-2.json`);
      const first = prepareHostCoreFinalReview(groupId, firstPath);
      const second = prepareHostCoreFinalReview(groupId, secondPath);
      assert.equal(first.sha256, second.sha256);
      assert.deepEqual(fs.readFileSync(firstPath), fs.readFileSync(secondPath));
      assert.throws(() => prepareHostCoreFinalReview(groupId, firstPath), /EEXIST/u);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Host core review preparation rejects unknown groups and relative output paths', () => {
  assert.throws(() => buildHostCoreFinalReviewPayload('host-unknown'), /HOST_CORE_REVIEW_GROUP_INVALID/u);
  assert.throws(
    () => prepareHostCoreFinalReview('host-portability-identity', 'relative.json'),
    /HOST_CORE_REVIEW_OUTPUT_INVALID/u
  );
});
