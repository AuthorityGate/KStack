import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../plugins/kstack/scripts/kstack-config.mjs';
import { evaluateDesignGate, requiredDesignGateNoFollowFlag } from '../plugins/kstack/scripts/kstack-design-gate.mjs';
import { sha256 } from '../plugins/kstack/scripts/kstack-review-schema.mjs';
import { buildDecisionPacket, frameDecisionPacket } from '../plugins/kstack/scripts/kstack-citation-grounding.mjs';

const designGateScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../plugins/kstack/scripts/kstack-design-gate.mjs');
const validDesign = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/valid-10k-design.md'));

function fixture({ confidence = 93 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-gate-'));
  const reviewDir = path.join(root, 'review');
  fs.mkdirSync(reviewDir);
  const designFile = path.join(root, 'design.md');
  fs.writeFileSync(designFile, validDesign);
  const designDigest = sha256(fs.readFileSync(designFile));
  const invocationId = 'fixture-invocation';
  const configFile = path.join(root, 'config.json');
  const legacyConfig = structuredClone(defaultConfig);
  delete legacyConfig.workflow.designGate.reviewSequence;
  delete legacyConfig.workflow.designGate.secondaryReview;
  fs.writeFileSync(configFile, JSON.stringify(legacyConfig));
  const review = {
    decision: 'approve', confidence, failedChecks: [], securityFindings: [], materialDissent: [],
    recommendation: 'Proceed.', strongestObjection: 'Implementation must preserve the design.', unresolvedQuestions: []
  };
  for (const reviewer of ['codex', 'opus']) {
    const raw = `${reviewer} raw fixture output`;
    fs.writeFileSync(path.join(reviewDir, `${reviewer}.md`), raw);
    const envelope = {
      schemaVersion: 1, reviewer, invocationId, designDigest, rawOutputSha256: 'a'.repeat(64), review
    };
    envelope.rawOutputSha256 = sha256(raw);
    fs.writeFileSync(path.join(reviewDir, `${reviewer}.json`), JSON.stringify(envelope));
  }
  const providers = {};
  for (const reviewer of ['codex', 'opus']) {
    const envelope = JSON.parse(fs.readFileSync(path.join(reviewDir, `${reviewer}.json`)));
    providers[reviewer] = { status: 'complete', envelopeSha256: sha256(JSON.stringify(envelope)), rawOutputSha256: envelope.rawOutputSha256 };
  }
  fs.writeFileSync(path.join(reviewDir, 'manifest.json'), JSON.stringify({ status: 'dual-complete', invocationId, designDigest, providers }));
  const checksFile = path.join(root, 'checks.json');
  fs.writeFileSync(checksFile, JSON.stringify({
    schemaVersion: 1,
    designDigest,
    checks: defaultConfig.workflow.designGate.requiredChecks.map((id) => ({ id, status: 'pass', evidence: `fixture evidence for ${id}` }))
  }));
  return { designFile, reviewDir, checksFile, configFile };
}

function enableAdvisoryGrounding(files, { quotedText = 'Use a staged workflow with explicit phase boundaries and durable evidence.', sourceId = 'SRC-DESIGN' } = {}) {
  const config = JSON.parse(fs.readFileSync(files.configFile));
  config.workflow.designGate.citationGrounding = 'advisory';
  fs.writeFileSync(files.configFile, JSON.stringify(config));
  const packet = buildDecisionPacket([{
    sourceId: 'SRC-DESIGN',
    label: 'design under review',
    role: 'design-under-review',
    inclusion: 'full',
    content: fs.readFileSync(files.designFile)
  }]);
  const frame = frameDecisionPacket(packet.packetBytes);
  const manifestFile = path.join(files.reviewDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  manifest.citationGroundingMode = 'advisory';
  manifest.packet = { ...packet.binding, frameCounter: frame.counter, frameToken: frame.token };
  for (const reviewer of ['codex', 'opus']) {
    const envelopeFile = path.join(files.reviewDir, `${reviewer}.json`);
    const envelope = JSON.parse(fs.readFileSync(envelopeFile));
    envelope.schemaVersion = 2;
    envelope.packetSha256 = packet.binding.packetSha256;
    envelope.packetCanonicalizationVersion = packet.binding.packetCanonicalizationVersion;
    envelope.packetSerializationVersion = packet.binding.packetSerializationVersion;
    envelope.packetFramingVersion = packet.binding.packetFramingVersion;
    envelope.review.recommendation = { text: 'Proceed.', groundKind: 'normative' };
    envelope.review.strongestObjection = { text: 'The design is security-sensitive.', groundKind: 'assertion' };
    envelope.review.citations = [{
      id: 'CIT-1',
      target: { field: 'strongestObjection' },
      sourceId,
      claim: 'The supplied design is the reviewed artifact.',
      quotedText
    }];
    fs.writeFileSync(envelopeFile, JSON.stringify(envelope));
    manifest.providers[reviewer].envelopeSha256 = sha256(JSON.stringify(envelope));
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
}

test('gate passes complete evidence at the configured confidence threshold', () => {
  const files = fixture();
  const gate = evaluateDesignGate(files);
  assert.equal(gate.status, 'READY_FOR_USER_APPROVAL');
  assert.equal(gate.combinedConfidence, 93);
  assert.equal(gate.failedCheckCount, 0);
  assert.equal(gate.securityFindingCount, 0);
});

test('missing O_NOFOLLOW support fails closed with an explicit design-gate code', () => {
  assert.throws(() => requiredDesignGateNoFollowFlag({}), /KSTACK_DESIGN_GATE_NOFOLLOW_UNAVAILABLE/u);
  assert.equal(requiredDesignGateNoFollowFlag({ O_NOFOLLOW: 456 }), 456);
});

test('configured staged mode rejects legacy dual-review evidence', () => {
  const files = fixture();
  const config = JSON.parse(fs.readFileSync(files.configFile));
  config.workflow.designGate.reviewSequence = structuredClone(defaultConfig.workflow.designGate.reviewSequence);
  config.workflow.designGate.secondaryReview = structuredClone(defaultConfig.workflow.designGate.secondaryReview);
  fs.writeFileSync(files.configFile, JSON.stringify(config));
  const gate = evaluateDesignGate(files);
  assert.equal(gate.status, 'BLOCKED');
  assert.ok(gate.reasons.some((reason) => reason.code === 'REVIEW_PROTOCOL_INVALID'));
});

test('authoritative secondary-review policy cannot admit legacy evidence without its compatibility block', () => {
  const files = fixture();
  const config = JSON.parse(fs.readFileSync(files.configFile));
  config.workflow.designGate.secondaryReview = structuredClone(defaultConfig.workflow.designGate.secondaryReview);
  fs.writeFileSync(files.configFile, JSON.stringify(config));
  assert.throws(() => evaluateDesignGate(files), /reviewSequence and secondaryReview must be provided together/u);
});

test('design round 10 uses the round 1-10 confidence tier', () => {
  const gate = evaluateDesignGate({ ...fixture(), round: 10 });
  assert.equal(gate.status, 'READY_FOR_USER_APPROVAL');
  assert.equal(gate.minimumConfidence, 93);
});

test('design round 11 uses the later-round confidence tier', () => {
  const gate = evaluateDesignGate({ ...fixture({ confidence: 81 }), round: 11 });
  assert.equal(gate.status, 'READY_FOR_USER_APPROVAL');
  assert.equal(gate.minimumConfidence, 81);
});

test('design round 30 continues to use the later-round confidence tier', () => {
  const gate = evaluateDesignGate({ ...fixture({ confidence: 81 }), round: 30 });
  assert.equal(gate.status, 'READY_FOR_USER_APPROVAL');
  assert.equal(gate.minimumConfidence, 81);
});

test('explicit skill-class design round 1 uses the skill-class confidence tier', () => {
  const gate = evaluateDesignGate({ ...fixture({ confidence: 70 }), round: 1, skillClass: true });
  assert.equal(gate.status, 'READY_FOR_USER_APPROVAL');
  assert.equal(gate.minimumConfidence, 70);
});

test('explicit skill-class design round 15 overrides later-round tiering', () => {
  const files = fixture({ confidence: 70 });
  const outFile = path.join(path.dirname(files.designFile), 'gate.json');
  const result = spawnSync(process.execPath, [
    designGateScript,
    '--design', files.designFile,
    '--review-dir', files.reviewDir,
    '--checks', files.checksFile,
    '--out', outFile,
    '--round', '15',
    '--skill-class',
    '--config', files.configFile
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const gate = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  assert.equal(gate.status, 'READY_FOR_USER_APPROVAL');
  assert.equal(gate.minimumConfidence, 70);
});

test('missing and unrecognized design rounds safely use the round 1-10 tier', () => {
  for (const round of [undefined, 'unknown']) {
    const gate = evaluateDesignGate({ ...fixture({ confidence: 89 }), round });
    assert.equal(gate.status, 'BLOCKED');
    assert.equal(gate.minimumConfidence, 93);
    assert.ok(gate.reasons.some((reason) => reason.code === 'CONFIDENCE_BELOW_THRESHOLD'));
  }
});

test('gate blocks low confidence, security findings, and failed checks', () => {
  const files = fixture();
  const opusFile = path.join(files.reviewDir, 'opus.json');
  const opus = JSON.parse(fs.readFileSync(opusFile));
  opus.review.confidence = 89;
  opus.review.securityFindings = [{ id: 'SEC-1', severity: 'high', summary: 'Unresolved fixture issue.' }];
  fs.writeFileSync(opusFile, JSON.stringify(opus));
  const manifestFile = path.join(files.reviewDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  manifest.providers.opus.envelopeSha256 = sha256(JSON.stringify(opus));
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  const checks = JSON.parse(fs.readFileSync(files.checksFile));
  checks.checks[0].status = 'fail';
  fs.writeFileSync(files.checksFile, JSON.stringify(checks));
  const gate = evaluateDesignGate(files);
  assert.equal(gate.status, 'BLOCKED');
  assert.match(gate.reasons.map((reason) => reason.code).join(','), /CONFIDENCE_BELOW_THRESHOLD/);
  assert.match(gate.reasons.map((reason) => reason.code).join(','), /SECURITY_FINDINGS/);
  assert.match(gate.reasons.map((reason) => reason.code).join(','), /CHECK_FAILED/);
});

test('gate blocks a modified reviewer envelope', () => {
  const files = fixture();
  const opusFile = path.join(files.reviewDir, 'opus.json');
  const opus = JSON.parse(fs.readFileSync(opusFile));
  opus.review.recommendation = 'Tampered after the runner completed.';
  fs.writeFileSync(opusFile, JSON.stringify(opus));
  const gate = evaluateDesignGate(files);
  assert.equal(gate.status, 'BLOCKED');
  assert.match(gate.reasons.map((reason) => reason.code).join(','), /ENVELOPE_DIGEST_MISMATCH/);
});

test('advisory gate verifies citations against the packet source-content span', () => {
  const files = fixture();
  enableAdvisoryGrounding(files);
  const gate = evaluateDesignGate(files);
  assert.equal(gate.status, 'READY_FOR_USER_APPROVAL');
  assert.equal(gate.citationGrounding.status, 'evaluated');
  assert.equal(gate.citationGrounding.citationsEmitted, 2);
  assert.equal(gate.citationGrounding.anchorVerified, 2);
  assert.equal(gate.citationGrounding.citationFailed, 0);
  assert.equal(gate.citationGrounding.wouldBlock, 0);
});

test('advisory gate detects a fabricated file/source and quotation', () => {
  const files = fixture();
  enableAdvisoryGrounding(files, { sourceId: 'SRC-FABRICATED-FILE', quotedText: 'This fabricated line does not exist.' });
  const gate = evaluateDesignGate(files);
  assert.equal(gate.status, 'READY_FOR_USER_APPROVAL', 'advisory grounding must remain nonblocking');
  assert.equal(gate.citationGrounding.anchorVerified, 0);
  assert.equal(gate.citationGrounding.citationFailed, 2);
  assert.equal(gate.citationGrounding.wouldBlock, 2);
  for (const result of Object.values(gate.citationGrounding.reviewers)) {
    assert.ok(result.outcomes.some((outcome) => outcome.code === 'GROUNDING_SOURCE_NOT_FOUND'));
  }
});

test('advisory gate fails closed when packet binding no longer matches reconstructed bytes', () => {
  const files = fixture();
  enableAdvisoryGrounding(files);
  const manifestFile = path.join(files.reviewDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  manifest.packet.packetSha256 = '0'.repeat(64);
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  const gate = evaluateDesignGate(files);
  assert.equal(gate.citationGrounding.status, 'not_available');
  assert.equal(gate.citationGrounding.packetFailure, 'PACKET_DIGEST_MISMATCH');
  assert.equal(gate.citationGrounding.wouldBlock, 2);
});

test('advisory gate rejects a self-consistent packet for a different design', () => {
  const files = fixture();
  enableAdvisoryGrounding(files);
  const replacement = buildDecisionPacket([{
    sourceId: 'SRC-DESIGN', label: 'design under review', role: 'design-under-review', inclusion: 'full', content: 'A different design.'
  }]);
  const manifestFile = path.join(files.reviewDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  const replacementFrame = frameDecisionPacket(replacement.packetBytes);
  manifest.packet = { ...replacement.binding, frameCounter: replacementFrame.counter };
  Reflect.set(manifest.packet, 'frameToken', replacementFrame.token);
  for (const reviewer of ['codex', 'opus']) {
    const envelopeFile = path.join(files.reviewDir, `${reviewer}.json`);
    const envelope = JSON.parse(fs.readFileSync(envelopeFile));
    envelope.packetSha256 = replacement.binding.packetSha256;
    fs.writeFileSync(envelopeFile, JSON.stringify(envelope));
    manifest.providers[reviewer].envelopeSha256 = sha256(JSON.stringify(envelope));
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  const gate = evaluateDesignGate(files);
  assert.equal(gate.citationGrounding.status, 'not_available');
  assert.equal(gate.citationGrounding.packetFailure, 'PACKET_DIGEST_MISMATCH');
});
