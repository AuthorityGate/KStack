import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { validateOpenCodeDiscoveryObservation } from '../plugins/kstack/scripts/kstack-opencode-candidate.mjs';

const evidence = JSON.parse(fs.readFileSync(new URL('../.kstack/qualifications/opencode-v1.18.25-isolated-cell-evidence.json', import.meta.url), 'utf8'));
const provenance = JSON.parse(fs.readFileSync(new URL('../.kstack/qualifications/opencode-v1.18.25-provenance.json', import.meta.url), 'utf8'));
const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])])) : value;
const digest = (value) => `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;

test('real pinned OpenCode cell evidence is digest-bound and remains candidate-only', () => {
  const body = { ...evidence };
  delete body.evidenceDigest;
  assert.equal(evidence.evidenceDigest, digest(body));
  assert.equal(evidence.aggregate, 'PASS');
  assert.equal(evidence.binary.version, provenance.version);
  assert.equal(evidence.binary.sha256, provenance.binary.sha256);
  assert.match(evidence.adapter.sha256, /^[0-9a-f]{64}$/u);
  assert.equal(evidence.adapter.profile.profileId, 'opencode.native-skill-advisory.v1');
  assert.equal(evidence.adapter.profile.maximumClaim, 'ADVISORY_INSTRUCTION_ONLY');
  assert.equal(evidence.maximumClaim, 'NO_OPERATION_QUALIFICATION');
  assert.equal(evidence.discoveryObservation.outcome, 'OBSERVED');
  assert.deepEqual(evidence.discoveryObservation.reasonCodes, []);
  assert.equal(validateOpenCodeDiscoveryObservation(evidence.discoveryObservation).discoveryObservationDigest, evidence.discoveryObservationDigest);
});

test('paired OpenCode sessions prove native skill mediation without advance token disclosure or effects', () => {
  assert.deepEqual(evidence.interfaces, ['lo']);
  assert.equal(evidence.loopbackOnly, true);
  assert.equal(evidence.providerRequestCount, 4);
  assert.equal(evidence.effectBlockerEvidence.providerAdvanceTokenKnowledge, false);
  assert.equal(evidence.effectBlockerEvidence.credentialsPresent, false);
  assert.equal(evidence.effectBlockerEvidence.outputsCommittedBeforeReveal, true);
  assert.equal(evidence.effectBlockerEvidence.orphanCount, 0);
  assert.deepEqual(evidence.effectBlockerEvidence.orphanRows, []);
  assert.deepEqual(evidence.sessionEvidence.map((row) => row.variant), ['CONTROL', 'TREATMENT']);
  for (const row of evidence.sessionEvidence) {
    assert.equal(row.providerRequestCount, 2);
    assert.deepEqual(row.chatRequestPhases, ['BEFORE_NATIVE_SKILL_RESULT', 'AFTER_NATIVE_SKILL_RESULT']);
    assert.deepEqual(row.eventTypes, ['step_start', 'tool_use', 'step_finish', 'step_start', 'text', 'step_finish']);
    assert.equal(row.expectedOpenCodeStatePreprovisioned, true);
    assert.equal(row.repositoryUnchangedDuringModelRun, true);
    assert.match(row.discoveryAdapterObservationDigest, /^[0-9a-f]{64}$/u);
    assert.match(row.advisoryAdapterObservationDigest, /^[0-9a-f]{64}$/u);
  }
  const [control, treatment] = evidence.discoveryObservation.sessions;
  assert.equal(control.variant, 'CONTROL');
  assert.equal(treatment.variant, 'TREATMENT');
  assert.notEqual(control.hostSessionIdentityDigest, treatment.hostSessionIdentityDigest);
  assert.notEqual(control.observationRenderDigest, treatment.observationRenderDigest);
  assert.notEqual(control.committedTypedOutputDigest, treatment.committedTypedOutputDigest);
  assert.equal(control.attemptedEffects, 'NONE');
  assert.equal(treatment.attemptedEffects, 'NONE');
});

test('OpenCode provenance does not overstate the unsigned release tag object', () => {
  assert.equal(provenance.release.tagRefObjectVerified, false);
  assert.equal(provenance.release.tagRefObjectVerificationReason, 'unsigned');
  assert.equal(provenance.release.targetCommitVerified, true);
  assert.equal(provenance.release.targetCommitVerificationReason, 'valid');
  assert.equal(provenance.release.claim, 'TARGET_COMMIT_VERIFIED_RELEASE_TAG_OBJECT_UNSIGNED');
  assert.equal(provenance.asset.githubPublishedSha256, provenance.asset.observedSha256);
});
