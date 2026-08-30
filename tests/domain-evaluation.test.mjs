import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  DOMAIN_EVALUATION_PROFILES,
  EVALUATION_CONDITIONS,
  EVALUATION_CROSS_CUTS,
  EVALUATION_STRATA,
  analyzeEvaluation,
  clopperPearsonUpper,
  deriveConditionOrder,
  evaluationCanonicalBytes,
  evaluationPowerPlan,
  evaluationProfileDigest,
  freezeEvaluationCorpus,
  freezePackEvaluationCorpus,
  validateEvaluationAdjudication,
  validateEvaluationExecution
} from '../plugins/kstack/scripts/kstack-domain-evaluation.mjs';

function sha(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function domainSha(domain, value) {
  return sha(Buffer.concat([Buffer.from(`${domain}\n`), evaluationCanonicalBytes(value)]));
}

function code(expected, action) {
  assert.throws(action, (error) => {
    assert.equal(error?.code, expected, `expected ${expected}, received ${error?.code ?? error}`);
    return true;
  });
}

function plan() {
  return {
    artifactType: 'kstack-evaluation-plan', schemaVersion: 1,
    candidatePackDigest: sha(Buffer.from('candidate-pack')), candidatePackAuthorIds: ['pack-author'],
    planDigest: sha(Buffer.from('plan')), adjudicationGuideDigest: sha(Buffer.from('guide')),
    executionCodeDigest: sha(Buffer.from('execution')), analysisCodeDigest: sha(Buffer.from('analysis')),
    conditionPromptDigests: Object.fromEntries(EVALUATION_CONDITIONS.map((condition) => [condition, sha(Buffer.from(`prompt-${condition}`))])),
    providerId: 'provider', modelId: 'model-v1', parametersDigest: sha(Buffer.from('parameters')),
    responseSchemaDigest: sha(Buffer.from('response-schema')), responseReserveTokens: 512,
    baseSixLaneDigest: sha(Buffer.from('base-six-lanes')), randomizationSeedDigest: sha(Buffer.from('randomization-seed'))
  };
}

function corpusCases() {
  return EVALUATION_STRATA.flatMap((criticalStratum, stratumIndex) => Array.from({ length: 60 }, (_, row) => {
    const index = stratumIndex * 60 + row;
    const first = row % 2 === 0;
    return {
      caseId: `case-${String(index).padStart(3, '0')}`, criticalStratum,
      crossCuts: {
        branchCount: first ? 'multiple' : 'single',
        environment: first ? 'development' : 'production',
        evidenceFreshness: first ? 'fresh' : 'stale-or-missing',
        externalText: first ? 'adversarial' : 'ordinary',
        jira: first ? 'off' : 'on', reversibility: first ? 'irreversible' : 'reversible'
      },
      sourceDigest: sha(Buffer.from(`source-${index}`)), authorId: `case-author-${index}`,
      heldOutFromPackAuthors: row < 15,
      goldGaps: [{
        gapId: `gap-${index}`, severity: row === 0 ? 'critical' : 'high',
        acceptanceCriteriaDigest: sha(Buffer.from(`accept-${index}`)),
        supportingSourceIds: [`source-${index}`], laneOwnership: 'shared', critical: row === 0
      }]
    };
  }));
}

function packPlan(packId) {
  return {
    ...plan(),
    schemaVersion: 2,
    candidatePackId: packId,
    candidatePackDigest: sha(Buffer.from(`candidate-pack:${packId}`)),
    evaluationProfileDigest: evaluationProfileDigest(packId)
  };
}

function packCorpusCases(packId) {
  const profile = DOMAIN_EVALUATION_PROFILES[packId];
  const crossCutKeys = Object.keys(profile.crossCutValues).sort();
  return profile.criticalStrata.flatMap((criticalStratum, stratumIndex) => Array.from({ length: 60 }, (_, row) => {
    const index = stratumIndex * 60 + row;
    return {
      caseId: `case-${String(index).padStart(3, '0')}`,
      criticalStratum,
      crossCuts: Object.fromEntries(crossCutKeys.map((key) => [key, profile.crossCutValues[key][row % 2]])),
      sourceDigest: sha(Buffer.from(`${packId}:source:${index}`)),
      authorId: `${packId}-case-author-${index}`,
      heldOutFromPackAuthors: row < 15,
      goldGaps: [{
        gapId: `gap-${index}`,
        severity: row === 0 ? 'critical' : 'high',
        acceptanceCriteriaDigest: sha(Buffer.from(`${packId}:accept:${index}`)),
        supportingSourceIds: [`source-${index}`],
        laneOwnership: 'shared',
        critical: row === 0
      }]
    };
  }));
}

function executionRecords(frozen) {
  return frozen.cases.flatMap((caseRecord) => {
    const order = deriveConditionOrder(frozen.plan.randomizationSeedDigest, caseRecord.caseId);
    return EVALUATION_CONDITIONS.map((condition) => {
      const index = Number(caseRecord.caseId.slice(-3));
      const found = condition === 'C' || condition === 'B' && index % 10 < 7 || condition === 'A' && index % 2 === 0;
      const findingInventory = found ? [{
        findingId: `finding-${caseRecord.caseId}-${condition.toLowerCase()}`,
        rawFindingDigest: sha(Buffer.from(`raw-finding-${caseRecord.caseId}-${condition}`))
      }] : [];
      const outputDigest = sha(Buffer.from(`output-${caseRecord.caseId}-${condition}`));
      return {
      caseId: caseRecord.caseId, condition, executionOrdinal: order.indexOf(condition),
      sessionId: `session-${caseRecord.caseId}-${condition.toLowerCase()}`,
      providerId: frozen.plan.providerId, modelId: frozen.plan.modelId,
      parametersDigest: frozen.plan.parametersDigest, subjectEvidenceDigest: caseRecord.sourceDigest,
      responseSchemaDigest: frozen.plan.responseSchemaDigest,
      responseReserveTokens: frozen.plan.responseReserveTokens,
      baseSixLaneDigest: frozen.plan.baseSixLaneDigest,
      promptDigest: frozen.plan.conditionPromptDigests[condition], status: 'success', attemptCount: 1,
      outputDigest, findingInventory,
      findingInventoryDigest: domainSha('KSTACK-EVALUATION-RAW-FINDING-INVENTORY-V1', {
        outputDigest, findings: findingInventory
      }),
      renderedBytes: condition === 'C' ? 4_000 : 3_000,
      durationMs: condition === 'C' ? 1_100 : 1_000,
      toolCallCount: 0, conditionLeakageDetected: false
      };
    });
  });
}

function outcome(caseRecord, condition) {
  const index = Number(caseRecord.caseId.slice(-3));
  const found = condition === 'C' || condition === 'B' && index % 10 < 7 || condition === 'A' && index % 2 === 0;
  return {
    caseId: caseRecord.caseId, condition,
    gapResults: caseRecord.goldGaps.map((gap) => ({ gapId: gap.gapId, found })),
    findings: found ? [{
      findingId: `finding-${caseRecord.caseId}-${condition.toLowerCase()}`,
      rawFindingDigest: sha(Buffer.from(`raw-finding-${caseRecord.caseId}-${condition}`)),
      material: true, classification: 'gold', severity: caseRecord.goldGaps[0].severity,
      gapId: caseRecord.goldGaps[0].gapId, novelGapDigest: null, duplicateOfFindingId: null,
      supportingSourceIds: caseRecord.goldGaps[0].supportingSourceIds,
      sourceTraceDigest: sha(Buffer.from(`trace-${caseRecord.caseId}-${condition}`)),
      laneOwnership: caseRecord.goldGaps[0].laneOwnership, critical: caseRecord.goldGaps[0].critical
    }] : [],
    unsupportedCase: false, duplicateCase: false, findingCount: found ? 1 : 0,
    unsupportedFindingCount: 0, duplicateFindingCount: 0,
    evidenceViolationCount: 0, authorityViolationCount: 0, persistentFailure: false
  };
}

function decisions(execution) {
  return execution.records.flatMap((record) => {
    const caseRecord = execution.frozenCorpus.cases.find((entry) => entry.caseId === record.caseId);
    const final = record.status === 'persistent-failure' ? {
      caseId: caseRecord.caseId, condition: record.condition,
      gapResults: caseRecord.goldGaps.map((gap) => ({ gapId: gap.gapId, found: false })),
      findings: [], unsupportedCase: true, duplicateCase: true, findingCount: 0,
      unsupportedFindingCount: 0, duplicateFindingCount: 0,
      evidenceViolationCount: 0, authorityViolationCount: 0, persistentFailure: true
    } : outcome(caseRecord, record.condition);
    const mappingDigest = domainSha('KSTACK-EVALUATION-ADJUDICATED-MAPPING-V1', final);
    return ['adjudicator-one', 'adjudicator-two'].map((adjudicatorId) => ({
      caseId: record.caseId, condition: record.condition, adjudicatorId,
      outcome: final, mappingDigest, signatureDigest: sha(Buffer.from(`${adjudicatorId}:${mappingDigest}`)), blinded: true
    }));
  });
}

function adjudicationInput(execution) {
  return {
    executionLedger: execution,
    adjudicatorProfiles: ['adjudicator-one', 'adjudicator-two'].map((adjudicatorId) => ({
      adjudicatorId, naturalPerson: true, domainQualified: true,
      independentFromPackAuthors: true, identityAttestationDigest: sha(Buffer.from(`identity:${adjudicatorId}`))
    })),
    decisions: decisions(execution), reconciliations: [], unblindingMapDigest: sha(Buffer.from('unblinding-map'))
  };
}

function remapOutcome(outcome, mutate) {
  const changed = structuredClone(outcome);
  mutate(changed);
  changed.gapResults = changed.gapResults.map((entry, index) => ({
    ...entry,
    found: changed.findings.some((finding) => finding.material
      && finding.classification === 'gold'
      && finding.gapId === changed.gapResults[index].gapId
      && finding.duplicateOfFindingId === null)
  }));
  changed.findingCount = changed.findings.length;
  changed.unsupportedFindingCount = changed.findings.filter((finding) => finding.material
    && finding.classification === 'unsupported').length;
  changed.duplicateFindingCount = changed.findings.filter((finding) => finding.material
    && finding.duplicateOfFindingId !== null).length;
  changed.unsupportedCase = changed.persistentFailure || changed.unsupportedFindingCount > 0;
  changed.duplicateCase = changed.persistentFailure || changed.duplicateFindingCount > 0;
  return changed;
}

function adjudicationWithOutcomeMutation(execution, mutate) {
  const input = adjudicationInput(execution);
  input.decisions = input.decisions.map((decision) => {
    const outcome = remapOutcome(decision.outcome, (value) => mutate(value, decision));
    const mappingDigest = domainSha('KSTACK-EVALUATION-ADJUDICATED-MAPPING-V1', outcome);
    return {
      ...decision, outcome, mappingDigest,
      signatureDigest: sha(Buffer.from(`${decision.adjudicatorId}:${mappingDigest}:mutated`))
    };
  });
  return validateEvaluationAdjudication(input);
}

function analysisInput(adjudication, overrides = {}) {
  return {
    adjudication,
    bootstrapSeedDigest: sha(Buffer.from(`bootstrap:${overrides.seed ?? 'default'}`)),
    d4d10Validation: {
      receiptDigest: sha(Buffer.from('d4d10')), evidenceViolationCount: 0,
      authorityViolationCount: 0, adversarialViolationCount: 0,
      ...overrides.d4d10Validation
    },
    d6Validation: {
      receiptDigest: sha(Buffer.from('d6')), packUtf8Bytes: 4_000,
      contextAdmitted: true, ...overrides.d6Validation
    }
  };
}

test('D7 freezes the exact 300-case balanced corpus and reproduces the preregistered power plan', () => {
  const power = evaluationPowerPlan();
  assert.deepEqual(power.hypotheses.map((entry) => [entry.n0, entry.attritionAdjustedN]), [[221, 277], [221, 277], [221, 277]]);
  const frozen = freezeEvaluationCorpus({ plan: plan(), cases: corpusCases() });
  assert.equal(frozen.cases.length, 300);
  assert.deepEqual(deriveConditionOrder(frozen.plan.randomizationSeedDigest, 'case-000'),
    deriveConditionOrder(frozen.plan.randomizationSeedDigest, 'case-000'));

  const imbalanced = corpusCases();
  for (let index = 0; index < 40; index += 1) imbalanced[index].crossCuts.jira = 'off';
  code('EVALUATION_CORPUS_INVALID', () => freezeEvaluationCorpus({ plan: plan(), cases: imbalanced }));
});

test('each candidate pack has its own digest-bound balanced 300-case profile and corpus', () => {
  const packIds = Object.keys(DOMAIN_EVALUATION_PROFILES).sort();
  assert.deepEqual(packIds, ['assurance', 'product-experience', 'release-operations', 'research-knowledge']);
  assert.equal(new Set(packIds.map(evaluationProfileDigest)).size, 4);
  const frozen = packIds.map((packId) => freezePackEvaluationCorpus({
    plan: packPlan(packId),
    cases: packCorpusCases(packId)
  }));
  assert.equal(new Set(frozen.map((entry) => entry.corpusDigest)).size, 4);
  assert.equal(new Set(frozen.map((entry) => entry.profile.criticalStrata.join(','))).size, 4);
  const ledgers = frozen.map((entry) => validateEvaluationExecution({
    frozenCorpus: entry,
    records: executionRecords(entry)
  }));
  assert.equal(new Set(ledgers.map((entry) => entry.executionLedgerDigest)).size, 4);
  const adjudicated = validateEvaluationAdjudication(adjudicationInput(ledgers[0]));
  const analysis = analyzeEvaluation({
    adjudication: adjudicated,
    bootstrapSeedDigest: sha(Buffer.from('assurance-bootstrap-seed')),
    d4d10Validation: {
      receiptDigest: sha(Buffer.from('assurance-d4d10')),
      evidenceViolationCount: 0,
      authorityViolationCount: 0,
      adversarialViolationCount: 0
    },
    d6Validation: {
      receiptDigest: sha(Buffer.from('assurance-d6')),
      packUtf8Bytes: 4_000,
      contextAdmitted: true
    }
  });
  assert.equal(analysis.qualified, true);
  assert.equal(analysis.record.disposition, 'qualified-not-activated');

  const mismatchedPlan = packPlan('assurance');
  mismatchedPlan.evaluationProfileDigest = evaluationProfileDigest('research-knowledge');
  code('EVALUATION_PLAN_INVALID', () => freezePackEvaluationCorpus({
    plan: mismatchedPlan,
    cases: packCorpusCases('assurance')
  }));
  code('EVALUATION_CORPUS_INVALID', () => freezePackEvaluationCorpus({
    plan: packPlan('assurance'),
    cases: packCorpusCases('product-experience')
  }));
});

test('D7 enforces 900 isolated frozen executions, deliberate gridlock, and two-person agreement', () => {
  const frozen = freezeEvaluationCorpus({ plan: plan(), cases: corpusCases() });
  const records = executionRecords(frozen);
  const execution = validateEvaluationExecution({ frozenCorpus: frozen, records });
  assert.equal(execution.records.length, 900);
  const adjudicated = validateEvaluationAdjudication(adjudicationInput(execution));
  assert.equal(adjudicated.outcomes.length, 900);
  assert.equal(adjudicated.agreement, 1);
  assert.equal(adjudicated.kappa, 1);

  const disputed = adjudicationInput(execution);
  const changed = structuredClone(disputed.decisions[0].outcome);
  changed.findings[0].sourceTraceDigest = sha(Buffer.from('disputed-source-trace'));
  disputed.decisions[0].outcome = changed;
  disputed.decisions[0].mappingDigest = domainSha('KSTACK-EVALUATION-ADJUDICATED-MAPPING-V1', changed);
  disputed.decisions[0].signatureDigest = sha(Buffer.from(`changed:${disputed.decisions[0].mappingDigest}`));
  code('EVALUATION_GRIDLOCK', () => validateEvaluationAdjudication(disputed));

  const leaked = structuredClone(records);
  leaked[0].conditionLeakageDetected = true;
  code('EVALUATION_EXECUTION_INVALID', () => validateEvaluationExecution({ frozenCorpus: frozen, records: leaked }));

  const inventoryDrift = structuredClone(records);
  inventoryDrift[0].findingInventory[0].rawFindingDigest = sha(Buffer.from('substituted-raw-finding'));
  code('EVALUATION_EXECUTION_INVALID', () => validateEvaluationExecution({ frozenCorpus: frozen, records: inventoryDrift }));

  const aggregateDrift = adjudicationInput(execution);
  aggregateDrift.decisions[0].outcome.findingCount = 2;
  aggregateDrift.decisions[0].mappingDigest = domainSha('KSTACK-EVALUATION-ADJUDICATED-MAPPING-V1', aggregateDrift.decisions[0].outcome);
  code('EVALUATION_ADJUDICATION_INVALID', () => validateEvaluationAdjudication(aggregateDrift));

  const persistentRecords = structuredClone(records);
  Object.assign(persistentRecords[0], {
    status: 'persistent-failure', attemptCount: 2, outputDigest: null, renderedBytes: 0,
    findingInventory: [], findingInventoryDigest: null
  });
  const persistentExecution = validateEvaluationExecution({ frozenCorpus: frozen, records: persistentRecords });
  const persistentAdjudication = validateEvaluationAdjudication(adjudicationInput(persistentExecution));
  assert.equal(persistentAdjudication.outcomes[0].unsupportedCase, true);
  assert.equal(persistentAdjudication.outcomes[0].duplicateCase, true);

  const unreliable = adjudicationInput(execution);
  let disagreements = 0;
  const reconciliations = [];
  for (let index = 0; index < unreliable.decisions.length; index += 2) {
    const left = unreliable.decisions[index];
    const right = unreliable.decisions[index + 1];
    if (disagreements >= 100 || right.outcome.findings.length === 0) continue;
    const changed = remapOutcome(right.outcome, (value) => { value.findings[0].material = false; });
    right.outcome = changed;
    right.mappingDigest = domainSha('KSTACK-EVALUATION-ADJUDICATED-MAPPING-V1', changed);
    right.signatureDigest = sha(Buffer.from(`unreliable:${right.mappingDigest}`));
    reconciliations.push({
      caseId: left.caseId, condition: left.condition,
      finalOutcome: left.outcome, finalMappingDigest: left.mappingDigest,
      adjudicatorSignatures: [
        { adjudicatorId: left.adjudicatorId, signatureDigest: left.signatureDigest },
        { adjudicatorId: right.adjudicatorId, signatureDigest: right.signatureDigest }
      ],
      blinded: true
    });
    disagreements += 1;
  }
  unreliable.reconciliations = reconciliations;
  assert.equal(disagreements, 100);
  code('ADJUDICATION_UNRELIABLE', () => validateEvaluationAdjudication(unreliable));
});

test('D7 exact safety bounds, 100k stratified bootstrap, Holm gates, and qualification-only disposition are executable', () => {
  assert.ok(Math.abs(clopperPearsonUpper(0, 300) - (1 - 0.05 ** (1 / 300))) < 1e-14);
  assert.ok(clopperPearsonUpper(1, 300) > clopperPearsonUpper(0, 300));
  assert.ok(clopperPearsonUpper(3, 300) <= 0.03);
  assert.ok(clopperPearsonUpper(4, 300) > 0.03);

  const frozen = freezeEvaluationCorpus({ plan: plan(), cases: corpusCases() });
  const execution = validateEvaluationExecution({ frozenCorpus: frozen, records: executionRecords(frozen) });
  const adjudicated = validateEvaluationAdjudication(adjudicationInput(execution));
  const analysis = analyzeEvaluation({
    adjudication: adjudicated, bootstrapSeedDigest: sha(Buffer.from('bootstrap-seed')),
    d4d10Validation: { receiptDigest: sha(Buffer.from('d4d10')), evidenceViolationCount: 0, authorityViolationCount: 0, adversarialViolationCount: 0 },
    d6Validation: { receiptDigest: sha(Buffer.from('d6')), packUtf8Bytes: 4_000, contextAdmitted: true }
  });
  assert.equal(analysis.record.resamples, 100_000);
  assert.equal(analysis.qualified, true);
  assert.equal(analysis.record.disposition, 'qualified-not-activated');
});

test('D7 independently exercises every failing analysis gate and both refusal dispositions', () => {
  const frozen = freezeEvaluationCorpus({ plan: plan(), cases: corpusCases() });
  const execution = validateEvaluationExecution({ frozenCorpus: frozen, records: executionRecords(frozen) });
  const baseline = validateEvaluationAdjudication(adjudicationInput(execution));

  const weakenedRecall = adjudicationWithOutcomeMutation(execution, (outcome, decision) => {
    if (decision.condition === 'C') outcome.findings[0].material = false;
  });
  const recallAnalysis = analyzeEvaluation(analysisInput(weakenedRecall, { seed: 'recall' }));
  assert.equal(recallAnalysis.record.gates.caRecall, false);
  assert.equal(recallAnalysis.record.gates.cbRecall, false);
  assert.equal(recallAnalysis.record.disposition, 'select-strengthened-wording');

  const criticalLoss = adjudicationWithOutcomeMutation(execution, (outcome, decision) => {
    if (decision.caseId === 'case-000' && decision.condition === 'C') outcome.findings[0].material = false;
  });
  const criticalAnalysis = analyzeEvaluation(analysisInput(criticalLoss, { seed: 'critical-loss' }));
  assert.equal(criticalAnalysis.record.gates.caBaseRecall, false);
  assert.equal(criticalAnalysis.record.disposition, 'blocked');

  const unsafe = adjudicationWithOutcomeMutation(execution, (outcome, decision) => {
    if (decision.condition === 'C' && Number(decision.caseId.slice(-3)) < 4) {
      Object.assign(outcome.findings[0], {
        classification: 'unsupported', gapId: null, novelGapDigest: null
      });
    }
  });
  const safetyAnalysis = analyzeEvaluation(analysisInput(unsafe, { seed: 'safety' }));
  assert.equal(safetyAnalysis.record.gates.safety, false);
  assert.equal(safetyAnalysis.record.disposition, 'blocked');

  const validationAnalysis = analyzeEvaluation(analysisInput(baseline, {
    seed: 'validation', d4d10Validation: { evidenceViolationCount: 1 }
  }));
  assert.equal(validationAnalysis.record.gates.validation, false);
  assert.equal(validationAnalysis.record.disposition, 'blocked');

  const budgetAnalysis = analyzeEvaluation(analysisInput(baseline, {
    seed: 'budget', d6Validation: { packUtf8Bytes: 16_385, contextAdmitted: false }
  }));
  assert.equal(budgetAnalysis.record.gates.budgetAndDuration, false);
  assert.equal(budgetAnalysis.record.disposition, 'blocked');
});
