import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { validateSecondHostEvidenceBundle } from '../.kstack/qualifications/validate-opencode-goose-second-host-proof.mjs';
import { evaluateSecondHostAbstractionProof } from '../plugins/kstack/scripts/kstack-second-host-proof.mjs';

const evidence = JSON.parse(fs.readFileSync(new URL('../.kstack/qualifications/opencode-goose-second-host-proof-evidence.json', import.meta.url), 'utf8'));
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;
const reseal = (value) => {
  const body = { ...value };
  delete body.evidenceDigest;
  value.evidenceDigest = crypto.createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex');
  return value;
};

test('current OpenCode and Goose evidence replays as a fail-closed two-host proof candidate', () => {
  const result = validateSecondHostEvidenceBundle(evidence, evidence.proof.observedAt);
  assert.equal(result.result, 'PASS');
  assert.equal(result.proofOutcome, 'FIRST_HOST_UNSTABLE');
  assert.deepEqual(result.hosts, ['opencode:20/20', 'goose:20/20']);
  assert.equal(result.finalReviewPresent, false);
  assert.equal(evidence.primaryReadinessConfidence, 96);
  assert.deepEqual(evidence.proof.stabilityGate.openDefectCodes, ['INDEPENDENT_FINAL_REVIEW_PENDING']);
});

test('cross-host fixture evidence remains distinct while normalized semantics are equal', () => {
  const [openCode, goose] = evidence.proof.executions;
  assert.notEqual(openCode.fixtureSetDigest, goose.fixtureSetDigest);
  assert.notEqual(openCode.evidenceSetDigest, goose.evidenceSetDigest);
  assert.notEqual(openCode.observerDigest, goose.observerDigest);
  assert.equal(openCode.kernelRequestSetDigest, goose.kernelRequestSetDigest);
  assert.equal(openCode.kernelResultSetDigest, goose.kernelResultSetDigest);
  assert.equal(openCode.normalizedTraceDigest, goose.normalizedTraceDigest);
});

test('binding, semantic, and review-state drift are rejected', () => {
  const binding = structuredClone(evidence);
  binding.bindings.gooseEvidenceDigest = '0'.repeat(64);
  assert.throws(() => validateSecondHostEvidenceBundle(reseal(binding), evidence.proof.observedAt), /currentness binding drift/u);
  const semantics = structuredClone(evidence);
  semantics.semanticResultSet[0].observedDecisionCode = 'ALLOW';
  assert.throws(() => validateSecondHostEvidenceBundle(reseal(semantics), evidence.proof.observedAt), /semantic normalization/u);
  const review = structuredClone(evidence);
  review.finalReview.receiptPresent = true;
  assert.throws(() => validateSecondHostEvidenceBundle(reseal(review), evidence.proof.observedAt), /final review state/u);
});

test('measured scans, port code, Goose preservation, negative receipts, and root evidence cannot be asserted by construction', () => {
  const scan = structuredClone(evidence);
  scan.measurements.genericSourceHostBranchScan.findings.push({ token: 'goose', line: 1 });
  scan.measurements.genericSourceHostBranchScan.passed = true;
  const scanBody = { ...scan.measurements.genericSourceHostBranchScan };
  delete scanBody.receiptDigest;
  scan.measurements.genericSourceHostBranchScan.receiptDigest = crypto.createHash('sha256').update(JSON.stringify(canonical(scanBody))).digest('hex');
  scan.proof.sharedBoundary.genericSourceHostBranchScanReceiptDigest = scan.measurements.genericSourceHostBranchScan.receiptDigest;
  assert.throws(() => validateSecondHostEvidenceBundle(reseal(scan), evidence.proof.observedAt), /generic source scan/u);

  const port = structuredClone(evidence);
  port.proof.adapters[1].portImplementations[0].implementationDigest = '0'.repeat(64);
  assert.throws(() => validateSecondHostEvidenceBundle(reseal(port), evidence.proof.observedAt), /adapter port implementation binding/u);

  const preservation = structuredClone(evidence);
  preservation.proof.preservation.goose.resultDigest = '1'.repeat(64);
  assert.throws(() => validateSecondHostEvidenceBundle(reseal(preservation), evidence.proof.observedAt), /preservation binding/u);

  const negative = structuredClone(evidence);
  negative.measurements.negativeMeasurements['background-orphan'].passed = false;
  assert.throws(() => validateSecondHostEvidenceBundle(reseal(negative), evidence.proof.observedAt), /negative measurement binding/u);

  const root = structuredClone(evidence);
  root.proof.executions[1].disposableRootDigest = crypto.createHash('sha256').update('goose-label-only').digest('hex');
  root.result = evaluateSecondHostAbstractionProof(root.proof, root.proof.observedAt);
  assert.throws(() => validateSecondHostEvidenceBundle(reseal(root), evidence.proof.observedAt), /disposable root measurement binding/u);
});
