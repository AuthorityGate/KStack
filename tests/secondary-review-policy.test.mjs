import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildSecondaryReviewDecision,
  canonicalSecondaryReviewValue,
  compareSecondaryReviewPolicies,
  digestSecondaryReviewValue,
  SecondaryReviewDecisionLedger,
  verifySecondaryReviewDecision
} from '../plugins/kstack/scripts/kstack-secondary-review-policy.mjs';

const H = (character) => character.repeat(64);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shadowLimitations = [
  'The six avoided ordinary legacy invocations are synthetic fixtures stipulated to approve with zero findings.',
  'Equal finding and decision-change totals are not evidence of equivalent defect yield or production performance.'
];
const policy = Object.freeze({
  mode: 'triggered',
  primaryReadinessConfidence: 93,
  finalAcceptanceConfidence: 81,
  requireFinalReview: true,
  requireDifferentAgent: true,
  requireDifferentProviderFamilyForHighRisk: true,
  auditSamplePermille: 0,
  materialDesignRiskClass: 'high'
});

function input(overrides = {}) {
  return {
    policy,
    workUnitDigest: H('1'),
    phase: 'design',
    primary: { agentId: 'codex', providerFamily: 'openai', backendDigest: H('4') },
    reviewer: { agentId: 'opus', providerFamily: 'anthropic', backendDigest: H('5') },
    reviewerAvailable: true,
    evidence: {
      ownerRequested: false,
      roadblock: false,
      materialUncertainty: false,
      independentFinalReview: false,
      highRiskBoundary: false,
      materialDissent: false
    },
    readiness: {
      measured: true, decision: 'approve', confidence: 93, failedChecks: 0,
      securityFindings: 0, materialDissent: 0, unresolvedQuestions: 0
    },
    riskClassificationDigest: H('2'),
    configurationDigest: H('3'),
    decidedAt: '2026-08-30T16:00:00.000Z',
    roundNumber: 1,
    ...overrides
  };
}

function withTrigger(key, overrides = {}) {
  const base = input(overrides);
  return { ...base, evidence: { ...base.evidence, [key]: true } };
}

test('canonical secondary-review digests are independent of object key order', () => {
  const left = { schema: 'binding-v1', risk: { phase: 'design', classification: 'high' }, reviewers: ['codex', 'opus'] };
  const right = { reviewers: ['codex', 'opus'], risk: { classification: 'high', phase: 'design' }, schema: 'binding-v1' };
  assert.equal(canonicalSecondaryReviewValue(left), canonicalSecondaryReviewValue(right));
  assert.equal(
    digestSecondaryReviewValue('KSTACK-SECONDARY-REVIEW-TEST-V1\n', left),
    digestSecondaryReviewValue('KSTACK-SECONDARY-REVIEW-TEST-V1\n', right)
  );
});

test('round count alone never triggers a secondary reviewer', () => {
  for (const roundNumber of [1, 11, 42]) {
    const decision = buildSecondaryReviewDecision(input({ roundNumber }));
    assert.equal(decision.route, 'PRIMARY_ONLY');
    assert.equal(decision.dispatch, false);
    assert.deepEqual(decision.triggerCodes, []);
    assert.equal(decision.roundCountTriggered, false);
  }
});

test('the closed trigger set deterministically selects requested or required review', () => {
  const cases = [
    ['ownerRequested', 'OWNER_REQUESTED', 'REQUIRED'],
    ['roadblock', 'ROADBLOCK', 'REQUESTED'],
    ['materialUncertainty', 'MATERIAL_UNCERTAINTY', 'REQUESTED'],
    ['independentFinalReview', 'INDEPENDENT_FINAL_REVIEW', 'REQUIRED'],
    ['highRiskBoundary', 'HIGH_RISK_BOUNDARY', 'REQUIRED'],
    ['materialDissent', 'MATERIAL_DISSENT', 'REQUESTED']
  ];
  for (const [field, trigger, route] of cases) {
    const decision = buildSecondaryReviewDecision(withTrigger(field));
    assert.deepEqual(decision.triggerCodes, [trigger]);
    assert.equal(decision.route, route);
    assert.equal(decision.dispatch, true);
  }
  const audit = buildSecondaryReviewDecision(input({ policy: { ...policy, auditSamplePermille: 1000 } }));
  assert.deepEqual(audit.triggerCodes, ['AUDIT_SAMPLE']);
  assert.equal(audit.route, 'REQUESTED');
  assert.equal(audit.dispatch, true);
});

test('final review waits for a clean 93 while roadblock advice remains available earlier', () => {
  const below = buildSecondaryReviewDecision(withTrigger('independentFinalReview', {
    readiness: { measured: true, decision: 'approve', confidence: 92, failedChecks: 0, securityFindings: 0, materialDissent: 0, unresolvedQuestions: 0 }
  }));
  assert.equal(below.status, 'PRIMARY_NOT_READY');
  assert.equal(below.dispatch, false);

  const dirty = buildSecondaryReviewDecision(withTrigger('independentFinalReview', {
    readiness: { measured: true, decision: 'approve', confidence: 99, failedChecks: 0, securityFindings: 0, materialDissent: 0, unresolvedQuestions: 1 }
  }));
  assert.equal(dirty.status, 'PRIMARY_NOT_READY');
  assert.equal(dirty.dispatch, false);

  const exact = buildSecondaryReviewDecision(withTrigger('independentFinalReview'));
  assert.equal(exact.status, 'READY_TO_DISPATCH');
  assert.equal(exact.dispatch, true);

  const roadblock = buildSecondaryReviewDecision(withTrigger('roadblock', {
    readiness: { measured: false, decision: 'revise', confidence: 40, failedChecks: 4, securityFindings: 1, materialDissent: 1, unresolvedQuestions: 2 }
  }));
  assert.equal(roadblock.status, 'READY_TO_DISPATCH');
  assert.equal(roadblock.dispatch, true);
});

test('agent identity aliasing and high-risk provider-family aliasing fail closed', () => {
  const sameAgent = buildSecondaryReviewDecision(withTrigger('roadblock', {
    reviewer: { agentId: 'codex', providerFamily: 'anthropic', backendDigest: H('5') }
  }));
  assert.equal(sameAgent.status, 'REVIEWER_INDEPENDENCE_INVALID');
  assert.equal(sameAgent.dispatch, false);

  const sameFamilyHighRisk = buildSecondaryReviewDecision(withTrigger('highRiskBoundary', {
    reviewer: { agentId: 'codex-reviewer', providerFamily: 'openai', backendDigest: H('5') }
  }));
  assert.equal(sameFamilyHighRisk.status, 'REVIEWER_INDEPENDENCE_INVALID');
  assert.equal(sameFamilyHighRisk.availabilityDisposition, 'INDEPENDENCE_INVALID');
  assert.equal(sameFamilyHighRisk.reviewerAvailable, true);

  const sameFamilyOrdinary = buildSecondaryReviewDecision(withTrigger('roadblock', {
    reviewer: { agentId: 'codex-reviewer', providerFamily: 'openai', backendDigest: H('5') }
  }));
  assert.equal(sameFamilyOrdinary.status, 'READY_TO_DISPATCH');

  const sameBackend = buildSecondaryReviewDecision(withTrigger('roadblock', {
    reviewer: { agentId: 'opus', providerFamily: 'anthropic', backendDigest: H('4') }
  }));
  assert.equal(sameBackend.status, 'REVIEWER_INDEPENDENCE_INVALID');
});

test('required unavailability blocks and advisory unavailability degrades explicitly', () => {
  const required = buildSecondaryReviewDecision(withTrigger('ownerRequested', { reviewerAvailable: false }));
  assert.equal(required.status, 'REVIEWER_UNAVAILABLE_BLOCKING');
  assert.equal(required.availabilityDisposition, 'UNAVAILABLE_BLOCKING');

  const advisory = buildSecondaryReviewDecision(withTrigger('roadblock', { reviewerAvailable: false }));
  assert.equal(advisory.status, 'REVIEWER_UNAVAILABLE_DEGRADED');
  assert.equal(advisory.availabilityDisposition, 'UNAVAILABLE_DEGRADED');
});

test('configuration drift and decision replay are rejected', () => {
  const originalInput = withTrigger('independentFinalReview');
  const decision = buildSecondaryReviewDecision(originalInput);
  assert.equal(verifySecondaryReviewDecision(decision, originalInput), true);
  assert.throws(() => verifySecondaryReviewDecision(decision, {
    ...originalInput, configurationDigest: H('4')
  }), /KSTACK_SECONDARY_REVIEW_DECISION_INVALID/u);

  const ledger = new SecondaryReviewDecisionLedger();
  assert.equal(ledger.consume(decision).consumed, true);
  assert.throws(() => ledger.consume(decision), /KSTACK_SECONDARY_REVIEW_DECISION_REPLAYED/u);
});

test('shadow comparison records invocation, latency, defect-yield, and decision-change totals', () => {
  const comparison = compareSecondaryReviewPolicies({
    classification: 'synthetic',
    observedAt: '2026-08-30T16:10:00.000Z',
    limitations: shadowLimitations,
    samples: [
      {
        workUnitId: 'ordinary-iteration',
        legacySecondaryDurationsMs: [8, 7, 9],
        adaptiveSecondaryDurationsMs: [],
        legacyFindingCount: 0,
        adaptiveFindingCount: 0,
        legacyDecisionChangeCount: 0,
        adaptiveDecisionChangeCount: 0
      },
      {
        workUnitId: 'final-review',
        legacySecondaryDurationsMs: [10],
        adaptiveSecondaryDurationsMs: [10],
        legacyFindingCount: 3,
        adaptiveFindingCount: 3,
        legacyDecisionChangeCount: 1,
        adaptiveDecisionChangeCount: 1
      }
    ]
  });
  assert.deepEqual(comparison.totals, {
    legacySecondaryInvocations: 4,
    adaptiveSecondaryInvocations: 1,
    avoidedSecondaryInvocations: 3,
    legacySecondaryDurationMs: 34,
    adaptiveSecondaryDurationMs: 10,
    legacyFindingCount: 3,
    adaptiveFindingCount: 3,
    legacyDecisionChangeCount: 1,
    adaptiveDecisionChangeCount: 1
  });
  assert.match(comparison.comparisonDigest, /^[0-9a-f]{64}$/u);
});

test('the preserved measured shadow evidence is internally bound and retains final defect yield', () => {
  const evidence = JSON.parse(fs.readFileSync(path.join(
    repositoryRoot, '.kstack', 'qualifications',
    'adaptive-secondary-review-shadow-comparison-2026-08-30.json'
  ), 'utf8'));
  const rebuilt = compareSecondaryReviewPolicies({
    classification: evidence.classification,
    observedAt: evidence.observedAt,
    samples: evidence.samples,
    limitations: evidence.limitations
  });
  assert.equal(rebuilt.comparisonDigest, evidence.comparisonDigest);
  assert.deepEqual(rebuilt.totals, evidence.totals);
  assert.ok(rebuilt.totals.adaptiveSecondaryInvocations < rebuilt.totals.legacySecondaryInvocations);
  assert.equal(rebuilt.totals.adaptiveFindingCount, rebuilt.totals.legacyFindingCount);
  assert.equal(rebuilt.totals.adaptiveDecisionChangeCount, rebuilt.totals.legacyDecisionChangeCount);
  assert.deepEqual(evidence.limitations, shadowLimitations);
});

test('QC, initialization, and Jira tracking bind the closed triggers and 93/81 sequence', () => {
  const surfaces = [
    'plugins/kstack/skills/kstack-qc/SKILL.md',
    'plugins/kstack/skills/kstack-init/SKILL.md',
    'plugins/kstack/references/JIRA_TRACKING.md'
  ].map((file) => fs.readFileSync(path.join(repositoryRoot, file), 'utf8'));
  const triggers = [
    'OWNER_REQUESTED', 'ROADBLOCK', 'MATERIAL_UNCERTAINTY',
    'INDEPENDENT_FINAL_REVIEW', 'HIGH_RISK_BOUNDARY', 'MATERIAL_DISSENT', 'AUDIT_SAMPLE'
  ];
  for (const surface of surfaces) {
    for (const trigger of triggers) assert.match(surface, new RegExp(`\\b${trigger}\\b`, 'u'));
    assert.match(surface, /\b93\b/u);
    assert.match(surface, /\b81\b/u);
  }
});
