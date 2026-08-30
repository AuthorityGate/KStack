import crypto from 'node:crypto';

export const SECONDARY_REVIEW_TRIGGERS = Object.freeze([
  'OWNER_REQUESTED',
  'ROADBLOCK',
  'MATERIAL_UNCERTAINTY',
  'INDEPENDENT_FINAL_REVIEW',
  'HIGH_RISK_BOUNDARY',
  'MATERIAL_DISSENT',
  'AUDIT_SAMPLE'
]);

const REQUIRED_TRIGGERS = new Set(['OWNER_REQUESTED', 'INDEPENDENT_FINAL_REVIEW', 'HIGH_RISK_BOUNDARY']);
const EVIDENCE_KEYS = Object.freeze([
  'ownerRequested', 'roadblock', 'materialUncertainty',
  'independentFinalReview', 'highRiskBoundary', 'materialDissent'
]);
const EVIDENCE_TO_TRIGGER = Object.freeze({
  ownerRequested: 'OWNER_REQUESTED',
  roadblock: 'ROADBLOCK',
  materialUncertainty: 'MATERIAL_UNCERTAINTY',
  independentFinalReview: 'INDEPENDENT_FINAL_REVIEW',
  highRiskBoundary: 'HIGH_RISK_BOUNDARY',
  materialDissent: 'MATERIAL_DISSENT'
});
const HEX64 = /^[0-9a-f]{64}$/u;
const ID = /^[a-z][a-z0-9]*(?:[-.:][a-z0-9]+)*$/u;

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) fail(code);
}

export function canonicalSecondaryReviewValue(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalSecondaryReviewValue).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalSecondaryReviewValue(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digestSecondaryReviewValue(domain, value) {
  return crypto.createHash('sha256').update(domain).update(canonicalSecondaryReviewValue(value)).digest('hex');
}

function identity(value, code) {
  exact(value, ['agentId', 'providerFamily', 'backendDigest'], code);
  if (!ID.test(value.agentId) || !ID.test(value.providerFamily) || !HEX64.test(value.backendDigest)) fail(code);
  return { agentId: value.agentId, providerFamily: value.providerFamily, backendDigest: value.backendDigest };
}

function readiness(value) {
  exact(value, ['measured', 'decision', 'confidence', 'failedChecks', 'securityFindings', 'materialDissent', 'unresolvedQuestions'], 'KSTACK_SECONDARY_REVIEW_READINESS_INVALID');
  if (typeof value.measured !== 'boolean' || !['approve', 'revise', 'block'].includes(value.decision)
      || !Number.isInteger(value.confidence) || value.confidence < 0 || value.confidence > 100
      || ![value.failedChecks, value.securityFindings, value.materialDissent, value.unresolvedQuestions]
        .every((count) => Number.isSafeInteger(count) && count >= 0)) {
    fail('KSTACK_SECONDARY_REVIEW_READINESS_INVALID');
  }
  return { ...value };
}

export function validateSecondaryReviewPolicy(policy) {
  exact(policy, [
    'mode', 'primaryReadinessConfidence', 'finalAcceptanceConfidence',
    'requireFinalReview', 'requireDifferentAgent', 'requireDifferentProviderFamilyForHighRisk',
    'auditSamplePermille', 'materialDesignRiskClass'
  ], 'KSTACK_SECONDARY_REVIEW_POLICY_INVALID');
  if (policy.mode !== 'triggered'
      || !Number.isInteger(policy.primaryReadinessConfidence) || policy.primaryReadinessConfidence < 93 || policy.primaryReadinessConfidence > 100
      || !Number.isInteger(policy.finalAcceptanceConfidence) || policy.finalAcceptanceConfidence < 81 || policy.finalAcceptanceConfidence > 100
      || policy.requireFinalReview !== true || policy.requireDifferentAgent !== true
      || policy.requireDifferentProviderFamilyForHighRisk !== true
      || !Number.isInteger(policy.auditSamplePermille) || policy.auditSamplePermille < 0 || policy.auditSamplePermille > 1000
      || policy.materialDesignRiskClass !== 'high') {
    fail('KSTACK_SECONDARY_REVIEW_POLICY_INVALID');
  }
  return structuredClone(policy);
}

export function resolveSecondaryReviewPolicy(designGate) {
  if (!designGate || typeof designGate !== 'object' || Array.isArray(designGate)) {
    fail('KSTACK_SECONDARY_REVIEW_POLICY_INVALID');
  }
  if (designGate.secondaryReview !== undefined) {
    return validateSecondaryReviewPolicy(designGate.secondaryReview);
  }
  const sequence = designGate.reviewSequence;
  return validateSecondaryReviewPolicy({
    mode: 'triggered',
    primaryReadinessConfidence: sequence?.primaryReadinessConfidence ?? 93,
    finalAcceptanceConfidence: sequence?.finalAcceptanceConfidence ?? 81,
    requireFinalReview: true,
    requireDifferentAgent: true,
    requireDifferentProviderFamilyForHighRisk: true,
    auditSamplePermille: 0,
    materialDesignRiskClass: 'high'
  });
}

export function normalizeReviewRound(value) {
  if (Number.isSafeInteger(value) && value >= 1) return value;
  if (typeof value === 'string' && /^[1-9][0-9]*$/u.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return null;
}

function auditSelected(policy, workUnitDigest) {
  if (policy.auditSamplePermille === 0) return false;
  const selection = Number.parseInt(digestSecondaryReviewValue('KSTACK-SECONDARY-REVIEW-AUDIT-SAMPLE-V1\n', {
    workUnitDigest, auditSamplePermille: policy.auditSamplePermille
  }).slice(0, 8), 16) % 1000;
  return selection < policy.auditSamplePermille;
}

function deriveTriggers(policy, workUnitDigest, evidence) {
  exact(evidence, EVIDENCE_KEYS, 'KSTACK_SECONDARY_REVIEW_EVIDENCE_INVALID');
  if (!EVIDENCE_KEYS.every((key) => typeof evidence[key] === 'boolean')) fail('KSTACK_SECONDARY_REVIEW_EVIDENCE_INVALID');
  const triggers = EVIDENCE_KEYS.filter((key) => evidence[key]).map((key) => EVIDENCE_TO_TRIGGER[key]);
  if (auditSelected(policy, workUnitDigest)) triggers.push('AUDIT_SAMPLE');
  return SECONDARY_REVIEW_TRIGGERS.filter((trigger) => triggers.includes(trigger));
}

export function buildSecondaryReviewDecision(input) {
  exact(input, [
    'policy', 'workUnitDigest', 'phase', 'primary', 'reviewer', 'reviewerAvailable',
    'evidence', 'readiness', 'riskClassificationDigest', 'configurationDigest',
    'decidedAt', 'roundNumber'
  ], 'KSTACK_SECONDARY_REVIEW_INPUT_INVALID');
  const policy = validateSecondaryReviewPolicy(input.policy);
  if (!HEX64.test(input.workUnitDigest) || !HEX64.test(input.riskClassificationDigest)
      || !HEX64.test(input.configurationDigest) || !ID.test(input.phase)
      || typeof input.reviewerAvailable !== 'boolean'
      || !Number.isSafeInteger(input.roundNumber) || input.roundNumber < 1
      || typeof input.decidedAt !== 'string' || !Number.isFinite(Date.parse(input.decidedAt))) {
    fail('KSTACK_SECONDARY_REVIEW_INPUT_INVALID');
  }
  const primary = identity(input.primary, 'KSTACK_SECONDARY_REVIEW_PRIMARY_INVALID');
  const reviewer = input.reviewer === null ? null : identity(input.reviewer, 'KSTACK_SECONDARY_REVIEW_REVIEWER_INVALID');
  const currentReadiness = readiness(input.readiness);
  const triggers = deriveTriggers(policy, input.workUnitDigest, input.evidence);
  const route = triggers.length === 0
    ? 'PRIMARY_ONLY'
    : triggers.some((trigger) => REQUIRED_TRIGGERS.has(trigger)) ? 'REQUIRED' : 'REQUESTED';
  const finalTriggered = triggers.includes('INDEPENDENT_FINAL_REVIEW');
  const cleanPrimary = currentReadiness.measured === true && currentReadiness.decision === 'approve'
    && currentReadiness.confidence >= policy.primaryReadinessConfidence
    && [currentReadiness.failedChecks, currentReadiness.securityFindings,
      currentReadiness.materialDissent, currentReadiness.unresolvedQuestions].every((count) => count === 0);
  const independenceValid = route === 'PRIMARY_ONLY' || (reviewer !== null
    && (!policy.requireDifferentAgent || reviewer.agentId !== primary.agentId)
    && (!policy.requireDifferentAgent || reviewer.backendDigest !== primary.backendDigest)
    && (!triggers.includes('HIGH_RISK_BOUNDARY') || !policy.requireDifferentProviderFamilyForHighRisk
      || reviewer.providerFamily !== primary.providerFamily));

  let status = 'PRIMARY_ONLY';
  let dispatch = false;
  let availabilityDisposition = 'NOT_TRIGGERED';
  if (route !== 'PRIMARY_ONLY') {
    if (finalTriggered && !cleanPrimary) {
      status = 'PRIMARY_NOT_READY';
      availabilityDisposition = 'NOT_EVALUATED';
    } else if (!independenceValid) {
      status = 'REVIEWER_INDEPENDENCE_INVALID';
      availabilityDisposition = 'INDEPENDENCE_INVALID';
    } else if (!input.reviewerAvailable) {
      status = route === 'REQUIRED' ? 'REVIEWER_UNAVAILABLE_BLOCKING' : 'REVIEWER_UNAVAILABLE_DEGRADED';
      availabilityDisposition = route === 'REQUIRED' ? 'UNAVAILABLE_BLOCKING' : 'UNAVAILABLE_DEGRADED';
    } else {
      status = 'READY_TO_DISPATCH';
      dispatch = true;
      availabilityDisposition = 'AVAILABLE';
    }
  }

  const unsigned = {
    schema: 'kstack-secondary-review-decision-v1',
    workUnitDigest: input.workUnitDigest,
    phase: input.phase,
    primary,
    reviewer,
    triggerCodes: triggers,
    route,
    status,
    dispatch,
    requiredReviewerCount: route === 'PRIMARY_ONLY' ? 0 : 1,
    reviewerAvailable: input.reviewerAvailable,
    availabilityDisposition,
    primaryReadiness: { ...currentReadiness, clean: cleanPrimary },
    riskClassificationDigest: input.riskClassificationDigest,
    configurationDigest: input.configurationDigest,
    decidedAt: new Date(input.decidedAt).toISOString(),
    roundNumber: input.roundNumber,
    roundCountTriggered: false
  };
  return Object.freeze({ ...unsigned, decisionDigest: digestSecondaryReviewValue('KSTACK-SECONDARY-REVIEW-DECISION-V1\n', unsigned) });
}

export function verifySecondaryReviewDecision(decision, input) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) fail('KSTACK_SECONDARY_REVIEW_DECISION_INVALID');
  const rebuilt = buildSecondaryReviewDecision(input);
  if (canonicalSecondaryReviewValue(rebuilt) !== canonicalSecondaryReviewValue(decision)) fail('KSTACK_SECONDARY_REVIEW_DECISION_INVALID');
  return true;
}

export class SecondaryReviewDecisionLedger {
  #consumed = new Set();

  consume(decision) {
    if (!decision || !HEX64.test(decision.decisionDigest)) fail('KSTACK_SECONDARY_REVIEW_DECISION_INVALID');
    if (this.#consumed.has(decision.decisionDigest)) fail('KSTACK_SECONDARY_REVIEW_DECISION_REPLAYED');
    this.#consumed.add(decision.decisionDigest);
    return Object.freeze({ consumed: true, decisionDigest: decision.decisionDigest });
  }
}

export function compareSecondaryReviewPolicies(input) {
  exact(input, ['classification', 'observedAt', 'samples', 'limitations'], 'KSTACK_SECONDARY_REVIEW_SHADOW_INVALID');
  if (!['synthetic', 'production'].includes(input.classification)
      || typeof input.observedAt !== 'string' || !Number.isFinite(Date.parse(input.observedAt))
      || !Array.isArray(input.samples) || input.samples.length === 0
      || !Array.isArray(input.limitations) || input.limitations.length === 0
      || input.limitations.some((item) => typeof item !== 'string' || item.length === 0 || item.length > 500)) {
    fail('KSTACK_SECONDARY_REVIEW_SHADOW_INVALID');
  }
  const limitations = [...input.limitations];
  const samples = input.samples.map((sample) => {
    exact(sample, [
      'workUnitId', 'legacySecondaryDurationsMs', 'adaptiveSecondaryDurationsMs',
      'legacyFindingCount', 'adaptiveFindingCount', 'legacyDecisionChangeCount',
      'adaptiveDecisionChangeCount'
    ], 'KSTACK_SECONDARY_REVIEW_SHADOW_INVALID');
    if (!ID.test(sample.workUnitId)
        || ![sample.legacySecondaryDurationsMs, sample.adaptiveSecondaryDurationsMs]
          .every((rows) => Array.isArray(rows) && rows.every((value) => Number.isSafeInteger(value) && value >= 0))
        || ![sample.legacyFindingCount, sample.adaptiveFindingCount,
          sample.legacyDecisionChangeCount, sample.adaptiveDecisionChangeCount]
          .every((value) => Number.isSafeInteger(value) && value >= 0)) fail('KSTACK_SECONDARY_REVIEW_SHADOW_INVALID');
    return structuredClone(sample);
  });
  const total = (key) => samples.reduce((sum, sample) => sum + sample[key], 0);
  const duration = (key) => samples.reduce((sum, sample) => sum + sample[key].reduce((a, b) => a + b, 0), 0);
  const invocationCount = (key) => samples.reduce((sum, sample) => sum + sample[key].length, 0);
  const legacyInvocations = invocationCount('legacySecondaryDurationsMs');
  const adaptiveInvocations = invocationCount('adaptiveSecondaryDurationsMs');
  const unsigned = {
    schema: 'kstack-secondary-review-shadow-comparison-v1',
    classification: input.classification,
    observedAt: new Date(input.observedAt).toISOString(),
    samples,
    limitations,
    totals: {
      legacySecondaryInvocations: legacyInvocations,
      adaptiveSecondaryInvocations: adaptiveInvocations,
      avoidedSecondaryInvocations: legacyInvocations - adaptiveInvocations,
      legacySecondaryDurationMs: duration('legacySecondaryDurationsMs'),
      adaptiveSecondaryDurationMs: duration('adaptiveSecondaryDurationsMs'),
      legacyFindingCount: total('legacyFindingCount'),
      adaptiveFindingCount: total('adaptiveFindingCount'),
      legacyDecisionChangeCount: total('legacyDecisionChangeCount'),
      adaptiveDecisionChangeCount: total('adaptiveDecisionChangeCount')
    }
  };
  return Object.freeze({ ...unsigned, comparisonDigest: digestSecondaryReviewValue('KSTACK-SECONDARY-REVIEW-SHADOW-V1\n', unsigned) });
}
