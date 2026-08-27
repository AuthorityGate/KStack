#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findConfig, validateConfig } from './kstack-config.mjs';
import { sha256, validateReview } from './kstack-review-schema.mjs';
import { buildDecisionPacket, evaluateGroundingOverlay, frameDecisionPacket, verifyDecisionPacket } from './kstack-citation-grounding.mjs';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function addReason(reasons, code, detail) {
  reasons.push({ code, detail });
}

function effectiveMinimumConfidence(policy, round, skillClass) {
  if (skillClass === true) return policy.minimumConfidenceSkillClass ?? 70;
  const normalizedRound = typeof round === 'string' && /^[1-9][0-9]*$/.test(round) ? Number(round) : round;
  if (Number.isSafeInteger(normalizedRound) && normalizedRound >= 11) return policy.minimumConfidenceRound11Plus ?? 80;
  return policy.minimumConfidence;
}

export function evaluateDesignGate({ designFile, reviewDir, checksFile, configFile, round, skillClass = false }) {
  const design = fs.readFileSync(designFile);
  const designDigest = sha256(design);
  const config = readJson(configFile);
  const configErrors = validateConfig(config);
  if (configErrors.length) throw new Error(`Invalid KStack config: ${configErrors.join('; ')}`);
  const policy = config.workflow.designGate;
  if (!policy) throw new Error('workflow.designGate is required');

  const reasons = [];
  const manifest = readJson(path.join(reviewDir, 'manifest.json'));
  const minimumConfidence = effectiveMinimumConfidence(policy, round, skillClass);
  const groundingMode = policy.citationGrounding ?? 'off';
  let verifiedPacket = null;
  let packetFailure = null;
  if (groundingMode === 'advisory') {
    try {
      const packetKeys = ['frameCounter', 'frameToken', 'packetByteLength', 'packetCanonicalizationVersion', 'packetFramingVersion', 'packetSerializationVersion', 'packetSha256', 'sources'].sort();
      if (manifest.citationGroundingMode !== 'advisory' || !manifest.packet
          || JSON.stringify(Object.keys(manifest.packet).sort()) !== JSON.stringify(packetKeys)) {
        throw Object.assign(new Error('packet manifest binding is malformed'), { code: 'PACKET_METADATA_MISMATCH' });
      }
      const reconstructed = buildDecisionPacket([{
        sourceId: 'SRC-DESIGN', label: 'design under review', role: 'design-under-review', inclusion: 'full', content: design
      }]);
      const packetBinding = Object.fromEntries(Object.entries(manifest.packet).filter(([key]) => !['frameCounter', 'frameToken'].includes(key)));
      verifiedPacket = verifyDecisionPacket(reconstructed.packetBytes, packetBinding);
      const frame = frameDecisionPacket(reconstructed.packetBytes);
      if (manifest.packet.frameCounter !== frame.counter || manifest.packet.frameToken !== frame.token) {
        throw Object.assign(new Error('packet frame binding does not reproduce'), { code: 'PACKET_FRAME_BINDING_MISMATCH' });
      }
    } catch (error) {
      packetFailure = error?.code ?? 'GROUNDING_PACKET_NOT_AVAILABLE';
    }
  }
  if (manifest.designDigest !== designDigest) addReason(reasons, 'DESIGN_DIGEST_MISMATCH', 'Review manifest is not bound to this design.');
  if (manifest.status !== 'dual-complete') addReason(reasons, 'REVIEW_INCOMPLETE', `Review status is ${manifest.status}.`);

  const reviews = {};
  const groundingByReviewer = {};
  const confidences = [];
  for (const reviewer of policy.requiredReviewers) {
    const envelopeFile = path.join(reviewDir, `${reviewer}.json`);
    if (!fs.existsSync(envelopeFile)) {
      addReason(reasons, 'REVIEWER_MISSING', `${reviewer} envelope is missing.`);
      continue;
    }
    const envelope = readJson(envelopeFile);
    const expectedEnvelopeKeys = envelope.schemaVersion === 2
      ? ['designDigest', 'invocationId', 'packetCanonicalizationVersion', 'packetFramingVersion', 'packetSerializationVersion', 'packetSha256', 'rawOutputSha256', 'review', 'reviewer', 'schemaVersion'].sort()
      : ['designDigest', 'invocationId', 'rawOutputSha256', 'review', 'reviewer', 'schemaVersion'].sort();
    if (JSON.stringify(Object.keys(envelope).sort()) !== JSON.stringify(expectedEnvelopeKeys)) addReason(reasons, 'ENVELOPE_SCHEMA_INVALID', `${reviewer} envelope fields are invalid.`);
    const permittedSchemaVersions = groundingMode === 'advisory' ? [1, 2] : [1];
    if (!permittedSchemaVersions.includes(envelope.schemaVersion) || envelope.reviewer !== reviewer) addReason(reasons, 'REVIEWER_IDENTITY_INVALID', `${reviewer} identity binding is invalid.`);
    if (groundingMode === 'advisory' && envelope.schemaVersion === 2 && (
      envelope.packetSha256 !== manifest.packet?.packetSha256
      || envelope.packetCanonicalizationVersion !== manifest.packet?.packetCanonicalizationVersion
      || envelope.packetSerializationVersion !== manifest.packet?.packetSerializationVersion
      || envelope.packetFramingVersion !== manifest.packet?.packetFramingVersion
    )) addReason(reasons, 'ENVELOPE_PACKET_BINDING_MISMATCH', `${reviewer} envelope is bound to a different decision packet.`);
    if (envelope.invocationId !== manifest.invocationId) addReason(reasons, 'INVOCATION_MISMATCH', `${reviewer} invocation is stale or foreign.`);
    if (envelope.designDigest !== designDigest) addReason(reasons, 'DESIGN_DIGEST_MISMATCH', `${reviewer} reviewed a different design.`);
    const envelopeDigest = sha256(JSON.stringify(envelope));
    if (manifest.providers?.[reviewer]?.status !== 'complete') addReason(reasons, 'REVIEWER_PROCESS_INVALID', `${reviewer} provider process was not complete.`);
    if (manifest.providers?.[reviewer]?.envelopeSha256 !== envelopeDigest) addReason(reasons, 'ENVELOPE_DIGEST_MISMATCH', `${reviewer} envelope does not match the runner manifest.`);
    if (manifest.providers?.[reviewer]?.rawOutputSha256 !== envelope.rawOutputSha256) addReason(reasons, 'RAW_OUTPUT_DIGEST_MISMATCH', `${reviewer} raw-output binding does not match the runner manifest.`);
    const rawFile = path.join(reviewDir, `${reviewer}.md`);
    if (fs.existsSync(rawFile) && sha256(fs.readFileSync(rawFile)) !== envelope.rawOutputSha256) addReason(reasons, 'RAW_OUTPUT_DIGEST_MISMATCH', `${reviewer} retained raw output was modified.`);
    const reviewErrors = validateReview(envelope.review);
    for (const error of reviewErrors) addReason(reasons, 'REVIEW_SCHEMA_INVALID', `${reviewer}: ${error}`);
    if (reviewErrors.length) continue;
    reviews[reviewer] = envelope.review;
    if (groundingMode === 'advisory') groundingByReviewer[reviewer] = evaluateGroundingOverlay(envelope.review, verifiedPacket);
    confidences.push(envelope.review.confidence);
    if (envelope.review.decision !== 'approve') addReason(reasons, 'REVIEW_NOT_APPROVED', `${reviewer} decision is ${envelope.review.decision}.`);
    if (envelope.review.confidence < minimumConfidence) addReason(reasons, 'CONFIDENCE_BELOW_THRESHOLD', `${reviewer} confidence ${envelope.review.confidence} is below ${minimumConfidence}.`);
    if (envelope.review.failedChecks.length) addReason(reasons, 'REVIEW_FAILED_CHECKS', `${reviewer} reported failed checks.`);
    if (policy.requireZeroSecurityFindings && envelope.review.securityFindings.length) addReason(reasons, 'SECURITY_FINDINGS', `${reviewer} reported security findings.`);
    if (policy.requireZeroMaterialDissent && envelope.review.materialDissent.length) addReason(reasons, 'MATERIAL_DISSENT', `${reviewer} reported material dissent.`);
    if (envelope.review.unresolvedQuestions.length) addReason(reasons, 'UNRESOLVED_QUESTIONS', `${reviewer} reported unresolved questions.`);
  }

  const checksDocument = readJson(checksFile);
  if (checksDocument.schemaVersion !== 1 || checksDocument.designDigest !== designDigest || !Array.isArray(checksDocument.checks)) {
    addReason(reasons, 'CHECKS_DOCUMENT_INVALID', 'Deterministic checks are missing or bound to a different design.');
  } else {
    const checks = new Map(checksDocument.checks.map((check) => [check.id, check]));
    for (const required of policy.requiredChecks) {
      const check = checks.get(required);
      if (!check) addReason(reasons, 'CHECK_MISSING', `${required} is missing.`);
      else if (check.status !== 'pass' || typeof check.evidence !== 'string' || !check.evidence) addReason(reasons, 'CHECK_FAILED', `${required} did not pass with reproducible evidence.`);
    }
  }

  const gate = {
    schemaVersion: 1,
    status: reasons.length ? 'BLOCKED' : 'READY_FOR_USER_APPROVAL',
    designDigest,
    invocationId: manifest.invocationId ?? null,
    minimumConfidence,
    combinedConfidence: confidences.length === policy.requiredReviewers.length ? Math.min(...confidences) : null,
    reviewerDecisions: Object.fromEntries(Object.entries(reviews).map(([name, review]) => [name, { decision: review.decision, confidence: review.confidence }])),
    failedCheckCount: reasons.filter((reason) => ['CHECK_MISSING', 'CHECK_FAILED', 'REVIEW_FAILED_CHECKS'].includes(reason.code)).length,
    securityFindingCount: Object.values(reviews).reduce((count, review) => count + review.securityFindings.length, 0),
    materialDissentCount: Object.values(reviews).reduce((count, review) => count + review.materialDissent.length, 0),
    ...(groundingMode === 'advisory' ? { citationGrounding: {
      mode: 'advisory',
      status: packetFailure ? 'not_available' : 'evaluated',
      packetFailure,
      reviewers: groundingByReviewer,
      citationsEmitted: Object.values(groundingByReviewer).reduce((count, item) => count + item.citationsEmitted, 0),
      anchorVerified: Object.values(groundingByReviewer).reduce((count, item) => count + item.anchorVerified, 0),
      citationFailed: Object.values(groundingByReviewer).reduce((count, item) => count + item.citationFailed, 0),
      wouldBlock: Object.values(groundingByReviewer).reduce((count, item) => count + item.wouldBlock, 0)
    } } : {}),
    reasons,
    createdAt: new Date().toISOString()
  };
  return gate;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index].replace(/^--/, '');
    if (key === 'skill-class') args[key] = true;
    else args[key] = argv[++index];
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  for (const required of ['design', 'review-dir', 'checks', 'out']) if (!args[required]) throw new Error(`Missing --${required}`);
  const configFile = args.config ? path.resolve(args.config) : findConfig(path.dirname(path.resolve(args.design)));
  if (!configFile) throw new Error('No .kstack/config.json found.');
  const gate = evaluateDesignGate({
    designFile: path.resolve(args.design),
    reviewDir: path.resolve(args['review-dir']),
    checksFile: path.resolve(args.checks),
    configFile,
    round: args.round,
    skillClass: args['skill-class'] === true
  });
  fs.writeFileSync(path.resolve(args.out), `${JSON.stringify(gate, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(gate, null, 2)}\n`);
  if (gate.status !== 'READY_FOR_USER_APPROVAL') process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.stack || error.message); process.exitCode = 2; }
}
