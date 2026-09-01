#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findConfig, readKStackConfig } from './kstack-config.mjs';
import { finalBugFixIntake, sha256, validateReview } from './kstack-review-schema.mjs';
import { buildDecisionPacket, evaluateGroundingOverlay, frameDecisionPacket, verifyDecisionPacket } from './kstack-citation-grounding.mjs';
import {
  canonicalSecondaryReviewValue,
  digestSecondaryReviewValue,
  normalizeReviewRound,
  resolveSecondaryReviewPolicy,
  verifySecondaryReviewDecision
} from './kstack-secondary-review-policy.mjs';
import { validateTenThousandFootDesign } from './kstack-workflow-contract.mjs';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function addReason(reasons, code, detail) {
  reasons.push({ code, detail });
}

function effectiveMinimumConfidence(policy, round, skillClass) {
  if (skillClass === true) return policy.minimumConfidenceSkillClass ?? 70;
  const normalizedRound = normalizeReviewRound(round);
  if (Number.isSafeInteger(normalizedRound) && normalizedRound >= 11) return policy.minimumConfidenceRound11Plus ?? 81;
  return policy.minimumConfidence;
}

function same(left, right) {
  return canonicalSecondaryReviewValue(left) === canonicalSecondaryReviewValue(right);
}

export function requiredDesignGateNoFollowFlag(constants = fs.constants) {
  if (!Number.isInteger(constants?.O_NOFOLLOW) || constants.O_NOFOLLOW === 0) {
    throw new Error('KSTACK_DESIGN_GATE_NOFOLLOW_UNAVAILABLE');
  }
  return constants.O_NOFOLLOW;
}

function readRegularBytes(file) {
  let descriptor;
  try {
    const linked = fs.lstatSync(file);
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | requiredDesignGateNoFollowFlag());
    const opened = fs.fstatSync(descriptor);
    if (!linked.isFile() || linked.isSymbolicLink() || !opened.isFile()
        || linked.dev !== opened.dev || linked.ino !== opened.ino || opened.size > 1_048_576) {
      throw new Error('invalid regular file');
    }
    return fs.readFileSync(descriptor);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

export function evaluateDesignGate({ designFile, reviewDir, checksFile, configFile, round, skillClass = false }) {
  const design = fs.readFileSync(designFile);
  const designDigest = sha256(design);
  const config = readKStackConfig(configFile);
  const policy = config.workflow.designGate;
  if (!policy) throw new Error('workflow.designGate is required');

  const reasons = [];
  const designContract = validateTenThousandFootDesign(design);
  for (const contractError of designContract.errors) {
    addReason(reasons, 'DESIGN_ALTITUDE_CONTRACT_INVALID', `${contractError.code}: ${contractError.detail}`);
  }
  const manifest = readJson(path.join(reviewDir, 'manifest.json'));
  const applicableConfidence = effectiveMinimumConfidence(policy, round, skillClass);
  const stagedReview = manifest.reviewProtocol === 'primary-then-independent-final-v1';
  const stagedConfigured = policy.secondaryReview?.mode === 'triggered'
    && policy.secondaryReview.requireFinalReview === true;
  const configuredSecondaryPolicy = resolveSecondaryReviewPolicy(policy);
  const primaryMinimumConfidence = stagedReview
    ? Math.max(configuredSecondaryPolicy?.primaryReadinessConfidence ?? 93, applicableConfidence)
    : applicableConfidence;
  const finalMinimumConfidence = stagedReview
    ? configuredSecondaryPolicy?.finalAcceptanceConfidence ?? 81
    : applicableConfidence;
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
  if (stagedConfigured && !stagedReview) addReason(reasons, 'REVIEW_PROTOCOL_INVALID', 'Configured staged review cannot be satisfied by legacy dual-review evidence.');
  if (manifest.status !== (stagedReview ? 'staged-complete' : 'dual-complete')) addReason(reasons, 'REVIEW_INCOMPLETE', `Review status is ${manifest.status}.`);
  if (stagedReview) {
    const expectedRoles = config.workflow.phaseModels.design;
    if (manifest.orderedReviewers?.primary !== expectedRoles[0] || manifest.orderedReviewers?.final !== expectedRoles[1]
        || manifest.providerInvocationCount !== 2) {
      addReason(reasons, 'REVIEW_SEQUENCE_INVALID', 'Staged review roles or invocation count do not match the configured primary/final sequence.');
    }
  }

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
    const expectedInvocationId = stagedReview ? manifest.providers?.[reviewer]?.invocationId : manifest.invocationId;
    if (envelope.invocationId !== expectedInvocationId) addReason(reasons, 'INVOCATION_MISMATCH', `${reviewer} invocation is stale or foreign.`);
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
    const finalReviewer = stagedReview && reviewer === manifest.orderedReviewers?.final;
    const reviewerMinimumConfidence = finalReviewer ? finalMinimumConfidence : primaryMinimumConfidence;
    if ((!finalReviewer && envelope.review.decision !== 'approve') || (finalReviewer && envelope.review.decision === 'block')) {
      addReason(reasons, finalReviewer ? 'FINAL_REVIEW_BLOCKED' : 'REVIEW_NOT_APPROVED', `${reviewer} decision is ${envelope.review.decision}.`);
    }
    if (envelope.review.confidence < reviewerMinimumConfidence) addReason(reasons, 'CONFIDENCE_BELOW_THRESHOLD', `${reviewer} confidence ${envelope.review.confidence} is below ${reviewerMinimumConfidence}.`);
    if (!finalReviewer && envelope.review.failedChecks.length) addReason(reasons, 'REVIEW_FAILED_CHECKS', `${reviewer} reported failed checks.`);
    if (!finalReviewer && policy.requireZeroSecurityFindings && envelope.review.securityFindings.length) addReason(reasons, 'SECURITY_FINDINGS', `${reviewer} reported security findings.`);
    if (!finalReviewer && policy.requireZeroMaterialDissent && envelope.review.materialDissent.length) addReason(reasons, 'MATERIAL_DISSENT', `${reviewer} reported material dissent.`);
    if (!finalReviewer && envelope.review.unresolvedQuestions.length) addReason(reasons, 'UNRESOLVED_QUESTIONS', `${reviewer} reported unresolved questions.`);
  }

  if (stagedReview) {
    const primaryReviewer = manifest.orderedReviewers?.primary;
    const primary = reviews[primaryReviewer];
    const readiness = manifest.primaryReadiness;
    const readinessMinimum = primaryMinimumConfidence;
    const clean = primary && primary.decision === 'approve' && primary.confidence >= readinessMinimum
      && primary.failedChecks.length === 0 && primary.securityFindings.length === 0
      && primary.materialDissent.length === 0 && primary.unresolvedQuestions.length === 0;
    if (!clean || readiness?.ready !== true || readiness.minimumConfidence !== readinessMinimum
        || readiness.decision !== primary?.decision || readiness.confidence !== primary?.confidence
        || ['failed', 'security', 'dissent', 'questions'].some((field) => readiness?.[field] !== 0)) {
      addReason(reasons, 'PRIMARY_READINESS_INVALID', 'The independent final review was not preceded by a reproducible clean primary readiness result.');
    }
    try {
      const normalizedRound = normalizeReviewRound(round) ?? 1;
      const expectedPolicy = {
        ...configuredSecondaryPolicy,
        primaryReadinessConfidence: primaryMinimumConfidence
      };
      const riskClassification = {
        schema: 'kstack-secondary-review-risk-classification-v1',
        phase: 'design',
        classification: configuredSecondaryPolicy.materialDesignRiskClass,
        workUnitDigest: designDigest
      };
      const backendKeys = ['available', 'backendDigest', 'configurationDigest', 'configuredArgs', 'model', 'providerFamily', 'providerFamilyEvidence', 'requestedCommand'].sort();
      for (const reviewer of [manifest.orderedReviewers?.primary, manifest.orderedReviewers?.final]) {
        const backend = manifest.reviewerBackends?.[reviewer];
        const familyEvidence = backend?.providerFamilyEvidence;
        const configuredBackend = config.models?.[reviewer];
        if (!backend || canonicalSecondaryReviewValue(Object.keys(backend).sort()) !== canonicalSecondaryReviewValue(backendKeys)
            || backend.available !== true || !/^[0-9a-f]{64}$/u.test(backend.backendDigest)
            || !/^[0-9a-f]{64}$/u.test(backend.configurationDigest)
            || !configuredBackend || backend.requestedCommand !== configuredBackend.command
            || !same(backend.configuredArgs, configuredBackend.args)
            || backend.model !== (configuredBackend.model ?? null)
            || !familyEvidence || familyEvidence.method !== 'resolved-backend-version-probe-v1'
            || familyEvidence.providerFamily !== backend.providerFamily
            || !/^[0-9a-f]{64}$/u.test(familyEvidence.probeOutputSha256)) {
          throw new Error('backend evidence invalid');
        }
      }
      const primaryBackend = manifest.reviewerBackends[manifest.orderedReviewers.primary];
      const finalBackend = manifest.reviewerBackends[manifest.orderedReviewers.final];
      if (primaryBackend.backendDigest === finalBackend.backendDigest
          || primaryBackend.providerFamily === finalBackend.providerFamily) {
        throw new Error('backend independence invalid');
      }
      const expectedBinding = {
        schema: 'kstack-secondary-review-configuration-binding-v1',
        orderedReviewers: manifest.orderedReviewers,
        designGateTiers: {
          minimumConfidence: policy.minimumConfidence,
          minimumConfidenceRound11Plus: policy.minimumConfidenceRound11Plus ?? null,
          minimumConfidenceSkillClass: policy.minimumConfidenceSkillClass ?? null,
          applicableConfidence,
          primaryMinimumConfidence,
          finalMinimumConfidence,
          normalizedRound,
          skillClass: skillClass === true
        },
        secondaryReview: expectedPolicy,
        riskClassification,
        reviewerBackends: manifest.reviewerBackends
      };
      if (!same(manifest.secondaryReviewConfigurationBinding, expectedBinding)) throw new Error('configuration binding invalid');
      const expectedInput = {
        policy: expectedPolicy,
        workUnitDigest: designDigest,
        phase: 'design',
        primary: {
          agentId: manifest.orderedReviewers.primary,
          providerFamily: primaryBackend.providerFamily,
          backendDigest: primaryBackend.backendDigest
        },
        reviewer: {
          agentId: manifest.orderedReviewers.final,
          providerFamily: finalBackend.providerFamily,
          backendDigest: finalBackend.backendDigest
        },
        reviewerAvailable: true,
        evidence: {
          ownerRequested: false,
          roadblock: false,
          materialUncertainty: false,
          independentFinalReview: true,
          highRiskBoundary: true,
          materialDissent: false
        },
        readiness: {
          measured: true,
          decision: readiness.decision,
          confidence: readiness.confidence,
          failedChecks: readiness.failed,
          securityFindings: readiness.security,
          materialDissent: readiness.dissent,
          unresolvedQuestions: readiness.questions
        },
        riskClassificationDigest: digestSecondaryReviewValue('KSTACK-SECONDARY-REVIEW-RISK-CLASSIFICATION-V1\n', riskClassification),
        configurationDigest: digestSecondaryReviewValue('KSTACK-SECONDARY-REVIEW-CONFIGURATION-BINDING-V1\n', expectedBinding),
        decidedAt: manifest.secondaryReviewDecision?.decidedAt,
        roundNumber: normalizedRound
      };
      if (!same(manifest.secondaryReviewDecisionInput, expectedInput)) throw new Error('decision input invalid');
      verifySecondaryReviewDecision(manifest.secondaryReviewDecision, expectedInput);
      if (manifest.secondaryReviewDecision?.status !== 'READY_TO_DISPATCH'
          || manifest.secondaryReviewDecision?.dispatch !== true) throw new Error('decision did not authorize dispatch');

      const receiptBytes = readRegularBytes(path.join(reviewDir, '.secondary-review-consumption.json'));
      const receipt = JSON.parse(receiptBytes.toString('utf8'));
      const receiptKeys = ['configurationDigest', 'consumedAt', 'decisionDigest', 'durableOutputDirectoryFence', 'schema', 'workUnitDigest'].sort();
      const consumptionKeys = ['consumed', 'decisionDigest', 'durableOutputDirectoryFence', 'receiptSha256'].sort();
      if (canonicalSecondaryReviewValue(Object.keys(receipt).sort()) !== canonicalSecondaryReviewValue(receiptKeys)
          || canonicalSecondaryReviewValue(Object.keys(manifest.secondaryReviewConsumption ?? {}).sort()) !== canonicalSecondaryReviewValue(consumptionKeys)
          || receipt.schema !== 'kstack-secondary-review-consumption-v1'
          || receipt.decisionDigest !== manifest.secondaryReviewDecision.decisionDigest
          || receipt.workUnitDigest !== designDigest
          || receipt.configurationDigest !== expectedInput.configurationDigest
          || receipt.durableOutputDirectoryFence !== true
          || !Number.isFinite(Date.parse(receipt.consumedAt))
          || manifest.secondaryReviewConsumption.consumed !== true
          || manifest.secondaryReviewConsumption.decisionDigest !== receipt.decisionDigest
          || manifest.secondaryReviewConsumption.durableOutputDirectoryFence !== true
          || manifest.secondaryReviewConsumption.receiptSha256 !== sha256(receiptBytes)) {
        throw new Error('consumption receipt invalid');
      }
    } catch {
      addReason(reasons, 'SECONDARY_REVIEW_DECISION_INVALID', 'The staged decision, verified backend-family evidence, configuration binding, or durable consumption receipt did not reproduce.');
    }
    const finalReviewer = manifest.orderedReviewers?.final;
    const finalReview = reviews[finalReviewer];
    const finalReadiness = manifest.finalReadiness;
    const expectedBugFixIntake = finalReview ? finalBugFixIntake(finalReview) : [];
    const finalAccepted = finalReview && finalReview.decision !== 'block' && finalReview.confidence >= finalMinimumConfidence;
    const expectedDisposition = finalAccepted ? expectedBugFixIntake.length === 0 ? 'clean' : 'bugfix-only' : 'return-to-primary';
    if (!finalAccepted || finalReadiness?.ready !== true || finalReadiness.minimumConfidence !== finalMinimumConfidence
        || finalReadiness.decision !== finalReview?.decision || finalReadiness.confidence !== finalReview?.confidence
        || finalReadiness?.disposition !== expectedDisposition
        || finalReadiness?.bugFixCount !== expectedBugFixIntake.length
        || finalReadiness?.failed !== finalReview?.failedChecks?.length
        || ['security', 'dissent', 'questions'].some((field) => finalReadiness?.[field] !== finalReview?.[field === 'security' ? 'securityFindings' : field === 'dissent' ? 'materialDissent' : 'unresolvedQuestions']?.length)) {
      addReason(reasons, 'FINAL_READINESS_INVALID', 'Staged completion requires a reproducible independent final result at or above its acceptance threshold; revise findings become mandatory bug-fix intake and block decisions return to primary design.');
    }
    if (JSON.stringify(manifest.bugFixIntake) !== JSON.stringify(expectedBugFixIntake)
        || manifest.finalDisposition !== expectedDisposition) {
      addReason(reasons, 'FINAL_BUGFIX_INTAKE_INVALID', 'Final-review bug-fix intake or disposition does not reproduce from the bound final envelope.');
    }
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
    designContract: {
      contract: designContract.contract,
      status: designContract.status,
      blockCount: designContract.blocks.length
    },
    invocationId: manifest.invocationId ?? null,
    minimumConfidence: finalMinimumConfidence,
    primaryMinimumConfidence,
    finalMinimumConfidence,
    combinedConfidence: confidences.length === policy.requiredReviewers.length ? Math.min(...confidences) : null,
    reviewerDecisions: Object.fromEntries(Object.entries(reviews).map(([name, review]) => [name, { decision: review.decision, confidence: review.confidence }])),
    failedCheckCount: reasons.filter((reason) => ['CHECK_MISSING', 'CHECK_FAILED', 'REVIEW_FAILED_CHECKS'].includes(reason.code)).length,
    securityFindingCount: Object.values(reviews).reduce((count, review) => count + review.securityFindings.length, 0),
    materialDissentCount: Object.values(reviews).reduce((count, review) => count + review.materialDissent.length, 0),
    finalDisposition: stagedReview ? manifest.finalDisposition ?? null : null,
    implementationIntake: stagedReview && reviews[manifest.orderedReviewers?.final]
      ? finalBugFixIntake(reviews[manifest.orderedReviewers.final]) : [],
    implementationIntakeCount: stagedReview && reviews[manifest.orderedReviewers?.final]
      ? finalBugFixIntake(reviews[manifest.orderedReviewers.final]).length : 0,
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
