import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateFirstHostStabilityGate,
  evaluateSecondHostAbstractionProof,
  SECOND_HOST_PROOF_CONSTANTS,
  validateFirstHostStabilityGate,
  validateSecondHostAbstractionProof
} from '../plugins/kstack/scripts/kstack-second-host-proof.mjs';

const h = (character) => character.repeat(64);
const hashFor = (index) => index.toString(16).padStart(64, '0');

function implementationRows(ids, offset = 0) {
  return ids.map((itemId, index) => ({
    itemId,
    implementationDigest: hashFor(offset + index + 1),
    validationReceiptDigest: hashFor(offset + index + 101),
    implemented: true,
    current: true
  }));
}

function firstHostRun(kind, offset, observedAt) {
  return {
    kind,
    hostId: 'opencode',
    buildDigest: h('a'),
    configurationDigest: h('b'),
    environmentDigest: h('c'),
    profileDigest: h('d'),
    changeDigest: kind === 'initial' ? null : h('e'),
    eligibility: 'ELIGIBLE',
    conformanceReceiptDigest: hashFor(offset),
    passed: true,
    observedAt
  };
}

function stabilityGate() {
  return {
    schemaVersion: 1,
    gateId: 'opencode-stability-for-advisory-public-read-v1',
    profileDigest: h('d'),
    hpImplementations: implementationRows(SECOND_HOST_PROOF_CONSTANTS.hpItems),
    hbImplementations: implementationRows(SECOND_HOST_PROOF_CONSTANTS.hbItems, 300),
    initialQualification: firstHostRun('initial', 501, '2026-08-29T08:00:00.000Z'),
    requalification: firstHostRun('requalification', 502, '2026-08-29T09:00:00.000Z'),
    preservationEvidenceDigest: h('f'),
    preservationPassed: true,
    openDefectCodes: [],
    evaluatedAt: '2026-08-29T09:30:00.000Z',
    expiresAt: '2026-09-28T09:30:00.000Z'
  };
}

function ports() {
  return SECOND_HOST_PROOF_CONSTANTS.ports.map((portId, index) => ({
    portId,
    requestSchemaDigest: hashFor(600 + index),
    resultSchemaDigest: hashFor(700 + index)
  }));
}

function adapter(hostId, offset, fixtureMappingDigest) {
  return {
    hostId,
    buildDigest: hashFor(offset),
    adapterDigest: hashFor(offset + 1),
    portImplementations: SECOND_HOST_PROOF_CONSTANTS.ports.map((portId, index) => ({
      portId,
      implementationDigest: hashFor(offset + 10 + index)
    })),
    nativeEventSchemaDigest: hashFor(offset + 30),
    projectionPlanDigest: hashFor(offset + 31),
    bypassInventoryDigest: hashFor(offset + 32),
    environmentProfileDigest: hashFor(offset + 33),
    fixtureMappingDigest,
    authorityScanPassed: true,
    authorityScanReceiptDigest: hashFor(offset + 34)
  };
}

function differences() {
  return SECOND_HOST_PROOF_CONSTANTS.surfaces.map((surfaceId, index) => ({
    surfaceId,
    opencodeBehaviorDigest: hashFor(900 + index),
    gooseBehaviorDigest: index < 3 ? hashFor(1_000 + index) : hashFor(900 + index),
    commonRequirementDigest: hashFor(1_100 + index),
    hostSpecificAdaptationDigest: index < 3 ? hashFor(1_200 + index) : null,
    kstackOwner: 'governance-kernel',
    hostOwner: index === 0 ? 'native-instruction-loader' : 'bounded-native-surface',
    overlapOutcome: index === 0 ? 'HOST_OWNS_UNDER_BOUNDARY' : 'KSTACK_OWNS',
    noBypassEvidenceDigest: index === 0 ? hashFor(1_300) : null,
    testObligationsDigest: hashFor(1_400 + index)
  }));
}

function execution(hostId, offset, fixtureSetDigest) {
  return {
    hostId,
    profileDigest: h('d'),
    fixtureSetDigest,
    fixtureCount: 12,
    passedFixtureCount: 12,
    subjectProcessDigest: hashFor(offset),
    disposableRootDigest: hashFor(offset + 1),
    observerDigest: hashFor(offset + 2),
    evidenceSetDigest: hashFor(offset + 3),
    receiptSetDigest: hashFor(offset + 4),
    eligibility: 'ELIGIBLE',
    kernelRequestSetDigest: h('2'),
    kernelResultSetDigest: h('3'),
    normalizedTraceDigest: h('4'),
    observedAt: '2026-08-29T09:40:00.000Z',
    expiresAt: '2026-09-28T09:40:00.000Z'
  };
}

function proof() {
  return {
    schemaVersion: 1,
    proofId: 'opencode-goose-advisory-public-read-v1',
    profileId: 'advisory-public-read-v1',
    profileDigest: h('d'),
    stabilityGate: stabilityGate(),
    secondHostObjective: {
      hostId: 'goose',
      objectiveDigest: h('5'),
      decisionDigest: h('6'),
      primarySourceLedgerDigest: h('7'),
      reuseDispositionDigest: h('8'),
      ownerClarificationDigest: h('9'),
      codexClosureDigest: h('a'),
      selectedProfileDigest: h('d'),
      status: 'APPROVED'
    },
    sharedBoundary: {
      contractDigest: h('b'),
      schemaRegistryDigest: h('c'),
      genericSourceDigest: h('e'),
      ports: ports(),
      genericSourceHostBranchScanPassed: true,
      genericSourceHostBranchScanReceiptDigest: h('6'),
      forbiddenFieldScanPassed: true,
      forbiddenFieldScanReceiptDigest: h('7')
    },
    adapters: [adapter('opencode', 1_500, h('1')), adapter('goose', 1_600, h('5'))],
    differenceMatrix: differences(),
    executions: [execution('opencode', 1_700, h('1')), execution('goose', 1_800, h('5'))],
    preservation: Object.fromEntries(['opencode', 'goose'].map((hostId, index) => [hostId, {
      baselineDigest: hashFor(1_900 + index),
      resultDigest: hashFor(2_000 + index),
      passed: true
    }])),
    negativeCoverage: SECOND_HOST_PROOF_CONSTANTS.negativeCases.map((caseId, index) => ({
      caseId,
      passed: true,
      evidenceDigest: hashFor(2_100 + index)
    })),
    observedAt: '2026-08-29T10:00:00.000Z',
    expiresAt: '2026-09-28T10:00:00.000Z'
  };
}

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected);
}

test('the exact two-host proof qualifies only the bounded shared profile', () => {
  const result = evaluateSecondHostAbstractionProof(proof(), '2026-08-29T10:05:00.000Z');
  assert.equal(result.outcome, 'ABSTRACTION_PROVEN_FOR_PROFILE');
  assert.deepEqual(result.provenHosts, ['opencode', 'goose']);
  assert.deepEqual(result.reasonCodes, []);
  assert.match(result.evidenceDigest, /^[a-f0-9]{64}$/u);
  assert.equal(Object.isFrozen(validateSecondHostAbstractionProof(proof())), true);
});

test('closed schemas and exact ordered inventories reject ambiguity', () => {
  code('KSTACK_SECOND_HOST_PROOF_INVALID', () => validateSecondHostAbstractionProof({ ...proof(), supportTier: 'all-hosts' }));
  const missingPort = proof();
  missingPort.sharedBoundary.ports.pop();
  code('KSTACK_SECOND_HOST_SHARED_BOUNDARY_INVALID', () => validateSecondHostAbstractionProof(missingPort));
  const reorderedSurface = proof();
  [reorderedSurface.differenceMatrix[0], reorderedSurface.differenceMatrix[1]] = [reorderedSurface.differenceMatrix[1], reorderedSurface.differenceMatrix[0]];
  code('KSTACK_SECOND_HOST_DIFFERENCE_MATRIX_INVALID', () => validateSecondHostAbstractionProof(reorderedSurface));
});

test('first-host stability fails independently for implementation, qualification, regression, defect, and time', () => {
  const base = stabilityGate();
  assert.equal(evaluateFirstHostStabilityGate(base, '2026-08-29T10:05:00.000Z').status, 'SATISFIED');
  const notImplemented = structuredClone(base);
  notImplemented.hpImplementations[0].implemented = false;
  assert.equal(evaluateFirstHostStabilityGate(notImplemented, '2026-08-29T10:05:00.000Z').status, 'NOT_IMPLEMENTED');
  const notQualified = structuredClone(base);
  notQualified.initialQualification.eligibility = 'UNKNOWN';
  assert.equal(evaluateFirstHostStabilityGate(notQualified, '2026-08-29T10:05:00.000Z').status, 'NOT_QUALIFIED');
  const regressed = structuredClone(base);
  regressed.hbImplementations[0].current = false;
  assert.equal(evaluateFirstHostStabilityGate(regressed, '2026-08-29T10:05:00.000Z').status, 'REGRESSED');
  const defect = structuredClone(base);
  defect.openDefectCodes = ['KSTACK_SHARED_BYPASS'];
  assert.equal(evaluateFirstHostStabilityGate(defect, '2026-08-29T10:05:00.000Z').status, 'OPEN_DEFECT');
  assert.equal(evaluateFirstHostStabilityGate(base, '2026-09-28T09:30:00.000Z').status, 'STALE');
});

test('requalification must be later and independently evidenced while change identity reflects actual deltas', () => {
  const sameReceipt = stabilityGate();
  sameReceipt.requalification.conformanceReceiptDigest = sameReceipt.initialQualification.conformanceReceiptDigest;
  code('KSTACK_SECOND_HOST_STABILITY_GATE_INVALID', () => validateFirstHostStabilityGate(sameReceipt));
  const noChange = stabilityGate();
  noChange.requalification.changeDigest = null;
  assert.doesNotThrow(() => validateFirstHostStabilityGate(noChange));
  const notLater = stabilityGate();
  notLater.requalification.observedAt = notLater.initialQualification.observedAt;
  code('KSTACK_SECOND_HOST_STABILITY_GATE_INVALID', () => validateFirstHostStabilityGate(notLater));
});

test('ambiguous lifecycle ownership rejects the second host without weakening KStack', () => {
  const objectiveRejected = proof();
  objectiveRejected.secondHostObjective.status = 'HOST_OVERLAP_REJECTED';
  assert.equal(evaluateSecondHostAbstractionProof(objectiveRejected, '2026-08-29T10:05:00.000Z').outcome, 'HOST_OVERLAP_REJECTED');
  const rowRejected = proof();
  rowRejected.differenceMatrix[3].overlapOutcome = 'REJECT';
  assert.equal(evaluateSecondHostAbstractionProof(rowRejected, '2026-08-29T10:05:00.000Z').outcome, 'HOST_OVERLAP_REJECTED');
});

test('cosmetic differences, cross-host evidence reuse, and semantic drift invalidate proof', () => {
  const cosmetic = proof();
  for (const row of cosmetic.differenceMatrix) {
    row.gooseBehaviorDigest = row.opencodeBehaviorDigest;
    row.hostSpecificAdaptationDigest = null;
  }
  const cosmeticResult = evaluateSecondHostAbstractionProof(cosmetic, '2026-08-29T10:05:00.000Z');
  assert.equal(cosmeticResult.outcome, 'PROOF_INVALID');
  assert.ok(cosmeticResult.reasonCodes.includes('KSTACK_SECOND_HOST_NOT_MATERIALLY_DIFFERENT'));
  const reused = proof();
  reused.executions[1].observerDigest = reused.executions[0].observerDigest;
  assert.ok(evaluateSecondHostAbstractionProof(reused, '2026-08-29T10:05:00.000Z').reasonCodes.includes('KSTACK_SECOND_HOST_EVIDENCE_REUSED'));
  const reusedFixtureSet = proof();
  reusedFixtureSet.executions[1].fixtureSetDigest = reusedFixtureSet.executions[0].fixtureSetDigest;
  reusedFixtureSet.adapters[1].fixtureMappingDigest = reusedFixtureSet.executions[1].fixtureSetDigest;
  assert.ok(evaluateSecondHostAbstractionProof(reusedFixtureSet, '2026-08-29T10:05:00.000Z').reasonCodes.includes('KSTACK_SECOND_HOST_EVIDENCE_REUSED'));
  const drift = proof();
  drift.executions[1].kernelResultSetDigest = h('f');
  assert.ok(evaluateSecondHostAbstractionProof(drift, '2026-08-29T10:05:00.000Z').reasonCodes.includes('KSTACK_SECOND_HOST_SEMANTIC_MISMATCH'));
});

test('a host that cannot pass every selected-profile fixture remains unsupported', () => {
  const input = proof();
  input.executions[1].passedFixtureCount = 11;
  const result = evaluateSecondHostAbstractionProof(input, '2026-08-29T10:05:00.000Z');
  assert.equal(result.outcome, 'SECOND_HOST_PROFILE_UNSUPPORTED');
  assert.deepEqual(result.provenHosts, []);
});

test('authority scans, preservation, negative coverage, and freshness are mandatory', () => {
  const scans = proof();
  scans.sharedBoundary.genericSourceHostBranchScanPassed = false;
  assert.ok(evaluateSecondHostAbstractionProof(scans, '2026-08-29T10:05:00.000Z').reasonCodes.includes('KSTACK_SECOND_HOST_BOUNDARY_SCAN_FAILED'));
  const preservation = proof();
  preservation.preservation.goose.passed = false;
  preservation.negativeCoverage[0].passed = false;
  assert.ok(evaluateSecondHostAbstractionProof(preservation, '2026-08-29T10:05:00.000Z').reasonCodes.includes('KSTACK_SECOND_HOST_PRESERVATION_FAILED'));
  const stale = evaluateSecondHostAbstractionProof(proof(), '2026-09-28T10:00:00.000Z');
  assert.equal(stale.outcome, 'FIRST_HOST_UNSTABLE');
});
