import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  admitRuntimeIndependentReviewBatch,
  RUNTIME_REVIEW_PACKET_CONTRACTS
} from '../.kstack/qualifications/runtime-independent-review-batch.mjs';
import { MATCHER_VERSION } from '../plugins/kstack/scripts/kstack-safety-matchers.mjs';

const REVIEWED_AT = '2026-08-30T06:00:00.000Z';
const ADMITTED_AT = '2026-08-30T06:01:00.000Z';
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');

function fixture(root = '/tmp/kstack-review-batch-fixture') {
  const packetBytesById = new Map();
  const resultBytesById = new Map();
  const packets = RUNTIME_REVIEW_PACKET_CONTRACTS.map((contract, index) => {
    const targetDigest = sha256(Buffer.from(`target-${index}`, 'utf8'));
    const packet = {
      schema: contract.packetSchema,
      destination: { provider: 'local-claude-cli', model: 'opus', tools: 'none' },
      ...(contract.groupId === null ? {} : { groupId: contract.groupId }),
      targetDigest,
      scope: contract.id === 'host-integrated' ? 'bounded integrated Host proof' : [...contract.scope]
    };
    const packetBytes = jsonBytes(packet);
    packetBytesById.set(contract.id, packetBytes);
    const review = {
      schema: contract.reviewSchema,
      reviewer: 'claude-opus',
      reviewerFamily: 'claude',
      ...(contract.groupId === null ? {} : { groupId: contract.groupId }),
      targetDigest,
      verdict: contract.verdict,
      confidence: 95,
      failedCriteria: [],
      securityFindings: [],
      materialDissent: [],
      unresolvedQuestions: [],
      recommendation: 'The reviewed target is ready for its next gated step.',
      reviewedAt: REVIEWED_AT
    };
    resultBytesById.set(contract.id, jsonBytes(review));
    return {
      id: contract.id,
      path: path.join(root, 'packets', `${contract.id}.json`),
      bytes: packetBytes.length,
      sha256: sha256(packetBytes),
      targetDigest
    };
  });
  const reviewTarget = {
    schema: 'kstack-independent-review-batch-target-v2',
    destination: { provider: 'local-claude-cli', model: 'opus', tools: 'none', sessionless: true },
    packets,
    exclusions: {
      credentialFiles: true, providerTrials: true, jiraMutation: true,
      ownerDecisions: true, packActivation: true
    },
    secretBoundary: {
      excludedPrefixes: ['.kstack/secrets/'],
      externalCredentialFilesIncluded: false,
      matcher: MATCHER_VERSION
    }
  };
  const batchDigest = sha256(Buffer.from(JSON.stringify(reviewTarget), 'utf8'));
  const manifestBytes = jsonBytes({
    schema: 'kstack-independent-review-batch-manifest-v2',
    batchDigest,
    reviewTarget
  });
  return { manifestBytes, packetBytesById, resultBytesById, packets };
}

function admit(value = fixture()) {
  return admitRuntimeIndependentReviewBatch({
    manifestBytes: value.manifestBytes,
    packetBytesById: value.packetBytesById,
    resultBytesById: value.resultBytesById,
    admittedAt: ADMITTED_AT,
    observedAt: ADMITTED_AT
  });
}

function changeReview(value, id, mutate) {
  const review = JSON.parse(value.resultBytesById.get(id));
  mutate(review);
  value.resultBytesById.set(id, jsonBytes(review));
  return value;
}

test('seven exact approved results admit one receipt covering only the 34 review-ready rows', () => {
  const first = admit();
  const second = admit();
  assert.deepEqual(first.receipt, second.receipt);
  assert.equal(first.receipt.reviews.length, 7);
  assert.equal(first.receipt.coverage.itemCount, 34);
  assert.equal(first.receipt.finalAcceptanceConfidence, 81);
  assert.equal(first.receipt.disposition, 'clean');
  assert.deepEqual(first.receipt.implementationIntake, []);
  assert.equal(new Set(first.receipt.coverage.itemIds).size, 34);
  assert.deepEqual(first.receipt.unresolvedGateClasses, [
    'external-linux-platform-and-privileged-qualification',
    'provider-ab-trials',
    'pack-held-out-evaluation-and-natural-person-adjudication',
    'owner-dispositions-and-activations',
    'durable-jira-closure'
  ]);
  assert.match(first.receipt.receiptDigest, /^[a-f0-9]{64}$/u);
});

test('manifest, packet, verdict, target, findings, threshold, time, and inventory drift fail closed', () => {
  const manifestDrift = fixture();
  const manifest = JSON.parse(manifestDrift.manifestBytes);
  manifest.batchDigest = 'f'.repeat(64);
  manifestDrift.manifestBytes = jsonBytes(manifest);
  assert.throws(() => admit(manifestDrift), /KSTACK_REVIEW_BATCH_MANIFEST_BINDING_INVALID/u);

  const packetDrift = fixture();
  packetDrift.packetBytesById.set('host-portability', Buffer.concat([
    packetDrift.packetBytesById.get('host-portability'), Buffer.from(' ', 'utf8')
  ]));
  assert.throws(() => admit(packetDrift), /KSTACK_REVIEW_BATCH_PACKET_DRIFT/u);

  assert.throws(
    () => admit(changeReview(fixture(), 'domain-foundation', (review) => { review.targetDigest = 'f'.repeat(64); })),
    /KSTACK_REVIEW_RESULT_INVALID/u
  );
  assert.throws(
    () => admit(changeReview(fixture(), 'host-negative-disposition', (review) => { review.verdict = 'APPROVE'; })),
    /KSTACK_REVIEW_RESULT_INVALID/u
  );
  assert.throws(
    () => admit(changeReview(fixture(), 'host-integrated', (review) => { review.confidence = 80; })),
    /KSTACK_REVIEW_RESULT_NOT_ACCEPTED/u
  );
  assert.throws(
    () => admit(changeReview(fixture(), 'domain-execution', (review) => {
      review.securityFindings = [{ id: 'SEC-1', severity: 'high', summary: 'Fix the boundary before qualification.' }];
    })),
    /KSTACK_REVIEW_RESULT_DECISION_MISMATCH/u
  );
  assert.throws(
    () => admit(changeReview(fixture(), 'domain-acquisition', (review) => { review.reviewedAt = '2026-08-30T06:02:00.000Z'; })),
    /KSTACK_REVIEW_RESULT_TIME_INVALID/u
  );
  assert.throws(
    () => admitRuntimeIndependentReviewBatch({
      manifestBytes: fixture().manifestBytes,
      packetBytesById: fixture().packetBytesById,
      resultBytesById: fixture().resultBytesById,
      admittedAt: '2026-08-30T06:02:00.000Z',
      observedAt: ADMITTED_AT
    }),
    /KSTACK_REVIEW_BATCH_ADMITTED_AT_FUTURE/u
  );

  const extraResult = fixture();
  extraResult.resultBytesById.set('unexpected', jsonBytes({ value: true }));
  assert.throws(() => admit(extraResult), /KSTACK_REVIEW_BATCH_INPUT_INVENTORY_INVALID/u);
});

test('an Opus revise at 86 is accepted as mandatory bug-fix intake and exact 81 is the boundary', () => {
  const revised = changeReview(fixture(), 'host-integrated', (review) => {
    review.verdict = 'REVISE';
    review.confidence = 86;
    review.failedCriteria = ['Add a regression case for the observed portability edge.'];
    review.securityFindings = [{ id: 'SEC-86', severity: 'medium', summary: 'Tighten the evidence binding.' }];
    review.materialDissent = ['Retain the narrower maximum claim until the fix validates.'];
    review.unresolvedQuestions = ['Does the corrected receipt replay on both hosts?'];
    review.recommendation = 'Move forward into implementation and close every bound bug-fix item.';
  });
  const accepted = admit(revised);
  const review = accepted.receipt.reviews.find((entry) => entry.id === 'host-integrated');
  assert.equal(review.confidence, 86);
  assert.equal(review.verdict, 'REVISE');
  assert.equal(review.disposition, 'bugfix-only');
  assert.equal(review.bugFixCount, 4);
  assert.equal(accepted.receipt.disposition, 'bugfix-only');
  assert.equal(accepted.receipt.implementationIntake.length, 4);
  assert.ok(accepted.receipt.implementationIntake.every((item) => item.id.startsWith('host-integrated:')));

  const boundary = changeReview(fixture(), 'domain-foundation', (candidate) => { candidate.confidence = 81; });
  assert.equal(admit(boundary).receipt.reviews.find((entry) => entry.id === 'domain-foundation').confidence, 81);
  const below = changeReview(fixture(), 'domain-foundation', (candidate) => { candidate.confidence = 80; });
  assert.throws(() => admit(below), /KSTACK_REVIEW_RESULT_NOT_ACCEPTED/u);
});

test('revise without explicit findings still creates one mandatory recommendation intake row', () => {
  const revised = changeReview(fixture(), 'domain-acquisition', (review) => {
    review.verdict = 'REVISE';
    review.confidence = 86;
    review.recommendation = 'Add the missing provider-trial assertion during implementation.';
  });
  const accepted = admit(revised);
  const review = accepted.receipt.reviews.find((entry) => entry.id === 'domain-acquisition');
  assert.equal(review.disposition, 'bugfix-only');
  assert.equal(review.bugFixCount, 1);
  assert.equal(review.bugFixIntake[0].kind, 'review-revision');
  assert.equal(review.bugFixIntake[0].detail, 'Add the missing provider-trial assertion during implementation.');
});

test('CLI admits exact result-directory contents and rejects an extra file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-review-batch-cli-'));
  const value = fixture(root);
  const packetDirectory = path.join(root, 'packets');
  const resultDirectory = path.join(root, 'results');
  fs.mkdirSync(packetDirectory, { recursive: true, mode: 0o700 });
  fs.mkdirSync(resultDirectory, { recursive: true, mode: 0o700 });
  for (const descriptor of value.packets) {
    fs.writeFileSync(descriptor.path, value.packetBytesById.get(descriptor.id), { mode: 0o600 });
    fs.writeFileSync(path.join(resultDirectory, `${descriptor.id}.json`), value.resultBytesById.get(descriptor.id), { mode: 0o600 });
  }
  const manifestFile = path.join(root, 'manifest.json');
  const output = path.join(root, 'receipt.json');
  fs.writeFileSync(manifestFile, value.manifestBytes, { mode: 0o600 });
  const script = path.resolve('.kstack/qualifications/runtime-independent-review-batch.mjs');
  const args = [
    script, 'admit', '--manifest', manifestFile,
    '--results-dir', resultDirectory, '--out', output, '--admitted-at', ADMITTED_AT
  ];
  const accepted = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(JSON.parse(accepted.stdout).coveredItems, 34);
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).reviews.length, 7);

  const obsoleteAuthorization = spawnSync(process.execPath, [
    script, 'admit', '--manifest', manifestFile, '--authorization-file', path.join(root, 'obsolete.txt'),
    '--results-dir', resultDirectory, '--out', path.join(root, 'obsolete-receipt.json'), '--admitted-at', ADMITTED_AT
  ], { encoding: 'utf8' });
  assert.equal(obsoleteAuthorization.status, 2);
  assert.match(obsoleteAuthorization.stderr, /KSTACK_REVIEW_BATCH_ARGUMENT_INVALID/u);

  fs.writeFileSync(path.join(resultDirectory, 'notes.txt'), 'not admitted\n', { mode: 0o600 });
  const rejected = spawnSync(process.execPath, [
    ...args.slice(0, args.indexOf('--out') + 1), path.join(root, 'second-receipt.json'),
    ...args.slice(args.indexOf('--out') + 2)
  ], { encoding: 'utf8' });
  assert.equal(rejected.status, 2);
  assert.match(rejected.stderr, /KSTACK_REVIEW_RESULT_DIRECTORY_INVALID/u);
});
