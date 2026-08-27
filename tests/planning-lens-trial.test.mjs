import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { defaultConfig, validateConfig } from '../plugins/kstack/scripts/kstack-config.mjs';
import {
  analyzeTrial,
  captureOutput,
  enabledPlanningLenses,
  enforceTrialCaps,
  evaluateDifferences,
  evaluateFixedSequence,
  exactSignTestP,
  freezeSelectors,
  prepareAdjudication,
  prepareTrial,
  resolveSheet,
  SCORE_FIELDS,
  selectorDecision,
  trialStatus
} from '../plugins/kstack/scripts/kstack-planning-lens-core.mjs';

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function targets(prefix) {
  return Array.from({ length: 4 }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    gap: `Gap ${index + 1}`,
    consequence: `Consequence ${index + 1}`,
    acceptableDecision: `Decision ${index + 1}`,
    verification: `Verification ${index + 1}`,
    severity: index === 0 ? 'S3' : 'S2',
    natural: index < 2
  }));
}

function fixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-lens-trial-'));
  const projectRoot = path.join(parent, 'project');
  const trialDir = path.join(parent, 'private-trial');
  fs.mkdirSync(path.join(projectRoot, '.kstack'), { recursive: true });
  fs.mkdirSync(trialDir);
  const config = structuredClone(defaultConfig);
  config.project.name = 'fixture';
  config.workflow.planningLensTrial.enabled = true;
  config.workflow.planningLensTrial.objectives = {
    'trial-objective': ['strategy', 'developer-experience', 'strengthened-product-ux']
  };
  writeJson(path.join(projectRoot, '.kstack', 'config.json'), config);
  const roles = [
    'trial-lead', 'corpus-steward', 'gold-validator', 'primary-selector',
    'independent-selector', 'adjudicator-a', 'adjudicator-b', 'adjudicator-c'
  ];
  writeJson(path.join(trialDir, 'trial.json'), {
    schemaVersion: 1,
    trialId: 'fixture-trial',
    candidates: ['strategy', 'developer-experience', 'strengthened-product-ux'],
    limits: { cases: 16, people: 8, budgetUsd: 588, providerAttempts: 294 },
    roster: roles.map((role, index) => ({ name: `Person ${index + 1}`, role }))
  });

  const cells = [
    ...Array(5).fill('strategy-only'),
    ...Array(5).fill('developer-experience-only'),
    ...Array(4).fill('both'),
    ...Array(2).fill('neither')
  ];
  const cases = [];
  const goldCases = [];
  cells.forEach((cell, index) => {
    const id = `case-${String(index + 1).padStart(2, '0')}`;
    const strategy = cell === 'strategy-only' || cell === 'both';
    const dx = cell === 'developer-experience-only' || cell === 'both';
    cases.push({ id, objectiveId: 'trial-objective', title: `Case ${index + 1}`, facts: [`Fact packet ${index + 1}`] });
    goldCases.push({
      id,
      applicability: { strategy, 'developer-experience': dx },
      targets: {
        strategy: strategy ? targets(`${id}-s`) : [],
        'developer-experience': dx ? targets(`${id}-x`) : []
      }
    });
  });
  writeJson(path.join(trialDir, 'corpus.json'), { schemaVersion: 1, cases });
  writeJson(path.join(trialDir, 'gold.json'), { schemaVersion: 1, cases: goldCases });
  return { parent, projectRoot, trialDir, config };
}

function deterministicIds(prefix = 'opaque') {
  let value = 0;
  return () => `${prefix}-${String(++value).padStart(4, '0')}`;
}

function fillJudgment(judgment, targetCards, slotA, slotB) {
  for (const target of targetCards) {
    for (const field of SCORE_FIELDS) {
      judgment.slotA[target.id][field] = slotA;
      judgment.slotB[target.id][field] = slotB;
    }
  }
  judgment.preferred = slotA === slotB ? 'tie' : slotA ? 'A' : 'B';
  judgment.confidence = 90;
}

function completeSelectors(trialDir, decisionFor = () => 'apply') {
  const file = path.join(trialDir, 'run', 'selectors.json');
  const selectors = JSON.parse(fs.readFileSync(file));
  for (const record of selectors.cases) {
    for (const family of ['strategy', 'developer-experience']) {
      for (const selector of ['primary', 'independent']) {
        record[family][selector].decision = decisionFor(record.caseId, family);
        record[family][selector].rationale = 'Independent decision from the KStack-owned fact packet.';
        record[family][selector].timestamp = '2026-08-24T12:30:00.000Z';
      }
    }
  }
  writeJson(file, selectors);
  return selectors;
}

test('planning-lens config is default-off and only enables closed IDs on named objectives', () => {
  assert.deepEqual(enabledPlanningLenses(defaultConfig, 'anything'), []);
  const shipped = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.kstack', 'config.json')));
  assert.deepEqual(shipped.workflow.planningLensTrial, { enabled: false, objectives: {} });
  const config = structuredClone(defaultConfig);
  config.workflow.planningLensTrial.enabled = true;
  config.workflow.planningLensTrial.objectives['objective-1'] = ['strategy'];
  assert.deepEqual(validateConfig(config), []);
  assert.deepEqual(enabledPlanningLenses(config, 'objective-1'), ['strategy']);
  assert.deepEqual(enabledPlanningLenses(config, 'objective-2'), []);

  config.workflow.planningLensTrial.objectives['objective-1'].push('custom-file-path');
  assert.match(validateConfig(config).join('\n'), /closed-catalog lens IDs/);
});

test('corpus preparation caps oversupply and freezes a shuffled opaque dispatch plan', () => {
  const { projectRoot, trialDir, config } = fixture();
  const corpusFile = path.join(trialDir, 'corpus.json');
  const goldFile = path.join(trialDir, 'gold.json');
  const corpus = JSON.parse(fs.readFileSync(corpusFile));
  const gold = JSON.parse(fs.readFileSync(goldFile));
  for (let index = 17; index <= 20; index += 1) {
    const id = `case-${index}`;
    corpus.cases.push({ id, objectiveId: 'trial-objective', title: `Extra case ${index}`, facts: [`Extra fact packet ${index}`] });
    gold.cases.push({
      id,
      applicability: { strategy: true, 'developer-experience': false },
      targets: { strategy: targets(`${id}-s`), 'developer-experience': [] }
    });
  }
  writeJson(corpusFile, corpus);
  writeJson(goldFile, gold);
  const manifest = prepareTrial({
    trialDir,
    projectRoot,
    config,
    randomIndex: () => 0,
    idFactory: deterministicIds(),
    now: () => '2026-08-24T12:00:00.000Z'
  });
  assert.equal(manifest.selectedCases.length, 16);
  const cellCounts = {};
  for (const item of manifest.selectedCases) cellCounts[item.cell] = (cellCounts[item.cell] ?? 0) + 1;
  assert.deepEqual(
    cellCounts,
    { 'strategy-only': 5, 'developer-experience-only': 5, both: 4, neither: 2 }
  );
  assert.equal(manifest.plannedProviderAttempts, 80);
  assert.equal(manifest.maximumReservedCostUsd, 160);
  assert.equal(trialStatus({ trialDir, projectRoot }).status, 'AWAITING_SELECTOR_FREEZE');
  assert.deepEqual(fs.readdirSync(path.join(trialDir, 'run', 'dispatch')), []);

  const map = JSON.parse(fs.readFileSync(path.join(trialDir, 'run', 'arm-map.json')));
  completeSelectors(trialDir);
  freezeSelectors({ trialDir, projectRoot, now: () => '2026-08-24T12:00:30.000Z' });
  assert.equal(trialStatus({ trialDir, projectRoot }).status, 'AWAITING_OUTPUTS');
  const packet = JSON.parse(fs.readFileSync(path.join(trialDir, 'run', 'dispatch', `${map.cases[0].arms.T1}.json`)));
  assert.match(packet.prompt, /Broader planning analysis/);
  assert.match(packet.prompt, /Do not identify or speculate about the authoring provider or model/);
  assert.match(packet.prompt, /Product, UX, Architecture, Data, Security, and Operations/);
  assert.doesNotMatch(packet.dispatchId, /^T[0-4]$/);
  const outputFile = path.join(trialDir, 'one-output.md');
  fs.writeFileSync(outputFile, 'A six-lane review output.');
  const packetFile = path.join(trialDir, 'run', 'dispatch', `${packet.dispatchId}.json`);
  writeJson(packetFile, { ...packet, prompt: `${packet.prompt}\nchanged` });
  assert.throws(() => captureOutput({ trialDir, projectRoot, dispatchId: packet.dispatchId, outputFile }), /dispatch packet changed/);
  writeJson(packetFile, packet);
  const receipt = captureOutput({ trialDir, projectRoot, dispatchId: packet.dispatchId, outputFile, now: () => '2026-08-24T12:01:00.000Z' });
  assert.equal(receipt.bytes, 25);
  assert.equal(receipt.ownerReviewRequired, false);
  assert.throws(() => captureOutput({ trialDir, projectRoot, dispatchId: packet.dispatchId, outputFile }), /EEXIST/);

  const challengedFile = path.join(trialDir, 'challenged-output.md');
  fs.writeFileSync(challengedFile, 'Premise disposition: challenged\n');
  const challenged = captureOutput({ trialDir, projectRoot, dispatchId: map.cases[0].arms.T3, outputFile: challengedFile });
  assert.equal(challenged.ownerReviewRequired, true);
  assert.equal(trialStatus({ trialDir, projectRoot }).status, 'OWNER_REVIEW_REQUIRED');
});

test('selector freeze precedes packet release and one reviewer cannot suppress a lens', () => {
  const { projectRoot, trialDir, config } = fixture();
  prepareTrial({ trialDir, projectRoot, config, randomIndex: () => 0, idFactory: deterministicIds() });
  const selectors = completeSelectors(trialDir);
  selectors.cases[0].strategy.primary.decision = 'skip';
  selectors.cases[0].strategy.independent.decision = 'apply';
  writeJson(path.join(trialDir, 'run', 'selectors.json'), selectors);
  assert.equal(selectorDecision(selectors.cases[0], 'strategy'), 'apply');

  const premature = path.join(trialDir, 'run', 'outputs', 'premature.md');
  fs.writeFileSync(premature, 'Output obtained before selector freeze.');
  assert.throws(() => freezeSelectors({ trialDir, projectRoot }), /before any output is captured/);
  fs.unlinkSync(premature);
  freezeSelectors({ trialDir, projectRoot, now: () => '2026-08-24T12:30:00.000Z' });
  assert.equal(fs.readdirSync(path.join(trialDir, 'run', 'dispatch')).length, 80);

  selectors.cases[0].strategy.independent.decision = 'skip';
  writeJson(path.join(trialDir, 'run', 'selectors.json'), selectors);
  const outputFile = path.join(trialDir, 'candidate.md');
  fs.writeFileSync(outputFile, 'Candidate output.');
  const dispatchId = JSON.parse(fs.readFileSync(path.join(trialDir, 'run', 'dispatch-order.json'))).dispatch[0].dispatchId;
  assert.throws(() => captureOutput({ trialDir, projectRoot, dispatchId, outputFile }), /selectors changed after they were frozen/);
});

test('adjudication omits explicit arm, policy, case, and roster identity metadata and resolves item disagreements', () => {
  const { projectRoot, trialDir, config } = fixture();
  prepareTrial({ trialDir, projectRoot, config, randomIndex: () => 0, idFactory: deterministicIds(), now: () => '2026-08-24T12:00:00.000Z' });
  completeSelectors(trialDir);
  freezeSelectors({ trialDir, projectRoot });
  const order = JSON.parse(fs.readFileSync(path.join(trialDir, 'run', 'dispatch-order.json'))).dispatch;
  for (const item of order) fs.writeFileSync(path.join(trialDir, 'run', 'outputs', `${item.dispatchId}.md`), `Review output for ${item.caseId}.`);
  const packageManifest = prepareAdjudication({
    trialDir,
    projectRoot,
    randomIndex: () => 0,
    idFactory: deterministicIds('comparison'),
    now: () => '2026-08-24T13:00:00.000Z'
  });
  assert.ok(packageManifest.sheets.length > 0);
  const sheetFile = path.join(trialDir, 'run', 'adjudication', 'sheets', `${packageManifest.sheets[0].comparisonId}.json`);
  const sheet = JSON.parse(fs.readFileSync(sheetFile));
  assert.equal(sheet.targetCards.length, 4);
  assert.equal(Object.keys(sheet.judgments.adjudicatorA.slotA).length, 4);
  assert.equal(Object.hasOwn(sheet, 'candidateSlot'), false);
  assert.equal(Object.hasOwn(sheet, 'policy'), false);
  assert.equal(Object.hasOwn(sheet, 'arm'), false);
  assert.equal(Object.hasOwn(sheet, 'caseId'), false);
  assert.equal(Object.hasOwn(sheet.judgments.adjudicatorA, 'name'), false);
  assert.deepEqual(Object.keys(sheet.targetCards[0]).sort(), ['acceptableDecision', 'consequence', 'gap', 'id', 'verification']);
  assert.match(sheet.targetCards[0].id, /^target-[1-4]$/);
  assert.equal(Object.hasOwn(packageManifest.sheets[0], 'caseId'), false);
  const humanPackage = fs.readdirSync(path.join(trialDir, 'run', 'adjudication', 'sheets'))
    .map((name) => fs.readFileSync(path.join(trialDir, 'run', 'adjudication', 'sheets', name), 'utf8'))
    .join('\n');
  assert.doesNotMatch(humanPackage, /Person [1-8]/);

  fillJudgment(sheet.judgments.adjudicatorA, sheet.targetCards, true, false);
  fillJudgment(sheet.judgments.adjudicatorB, sheet.targetCards, true, false);
  const firstTarget = sheet.targetCards[0].id;
  sheet.judgments.adjudicatorB.slotA[firstTarget].gap = false;
  sheet.judgments.resolver.slotA[firstTarget].gap = true;
  assert.deepEqual(resolveSheet(sheet), { slotA: 1, slotB: 0 });
});

test('exact sign test and fixed-sequence gatekeeping use the locked alphas and skip untestable packages', () => {
  assert.equal(exactSignTestP(5, 0), 0.03125);
  assert.equal(exactSignTestP(7, 1), 0.03515625);
  assert.equal(exactSignTestP(7, 2), 0.08984375);
  assert.equal(exactSignTestP(0, 0), 1);
  const handComputed = evaluateDifferences([0.25, 0.25, 0.25, 0, -0.25], { minimumN: 5 });
  assert.deepEqual(handComputed, {
    n: 5,
    nonzero: 4,
    positive: 3,
    negative: 1,
    mean: 0.1,
    pValue: 0.3125,
    testable: true,
    effectPass: true
  });

  const fourWins = Array(4).fill(0.25);
  const fiveWins = Array(5).fill(0.25);
  const result = evaluateFixedSequence({
    T1: fiveWins,
    T2: fiveWins,
    E: { strategy: [0, 0, 0, 0], 'developer-experience': fourWins },
    D: { strategy: fourWins, 'developer-experience': fourWins },
    B: { strategy: fourWins, 'developer-experience': fourWins, selectorEligible: true }
  });
  assert.equal(result.T1.alpha, 0.05);
  assert.equal(result.T2.alpha, 0.10);
  assert.equal(result.T1.status, 'ELIGIBLE_FOR_NEW_DESIGN');
  assert.equal(result.T2.status, 'ELIGIBLE_FOR_NEW_DESIGN');
  assert.equal(result.E.status, 'UNTESTABLE_EFFICACY');
  assert.equal(result.D.status, 'ELIGIBLE_FOR_NEW_DESIGN');
  assert.equal(result.B.status, 'ELIGIBLE_FOR_NEW_DESIGN');

  const sole = evaluateFixedSequence({ T1: fiveWins, T2: [] });
  assert.equal(sole.T1.alpha, 0.05);
  assert.equal(sole.T1.status, 'ELIGIBLE_FOR_NEW_DESIGN');
  assert.equal(sole.T2.status, 'UNTESTABLE_EFFICACY');
  assert.equal(sole.E.status, 'CLOSED_ROOTS');

  const holmStops = evaluateFixedSequence({
    T1: [0.25, 0.25, 0.25, 0.25, 0],
    T2: [0.25, 0.25, 0.25, 0.25, 0]
  });
  assert.equal(holmStops.T1.pValue, 0.0625);
  assert.equal(holmStops.T1.alpha, 0.05);
  assert.equal(holmStops.T1.rejects, false);
  assert.equal(holmStops.T2.alpha, 0.10);
  assert.equal(holmStops.T2.rejects, false);
  assert.equal(holmStops.T1.status, 'NOT_ELIGIBLE_EFFICACY');
  assert.equal(holmStops.T2.status, 'NOT_ELIGIBLE_EFFICACY');
});

test('attempt and spend caps reject overflow and frozen-manifest tampering fails closed', () => {
  assert.doesNotThrow(() => enforceTrialCaps({ providerAttempts: 294, reservedCostUsd: 588 }));
  assert.throws(() => enforceTrialCaps({ providerAttempts: 295, reservedCostUsd: 588 }), /attempts exceed the trial cap/);
  assert.throws(() => enforceTrialCaps({ providerAttempts: 294, reservedCostUsd: 588.01 }), /cost exceeds the trial budget/);

  const { projectRoot, trialDir, config } = fixture();
  prepareTrial({ trialDir, projectRoot, config, randomIndex: () => 0, idFactory: deterministicIds() });
  const manifestFile = path.join(trialDir, 'run', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  writeJson(manifestFile, { ...manifest, plannedProviderAttempts: 295 });
  assert.throws(() => trialStatus({ trialDir, projectRoot }), /attempts exceed the trial cap/);
});

test('analysis excludes a missing row instead of counting it as a tie or changing the sign-test denominator', () => {
  const { projectRoot, trialDir, config } = fixture();
  prepareTrial({ trialDir, projectRoot, config, randomIndex: () => 0, idFactory: deterministicIds() });
  completeSelectors(trialDir);
  freezeSelectors({ trialDir, projectRoot });
  const order = JSON.parse(fs.readFileSync(path.join(trialDir, 'run', 'dispatch-order.json'))).dispatch;
  for (const item of order) fs.writeFileSync(path.join(trialDir, 'run', 'outputs', `${item.dispatchId}.md`), `Review output for ${item.caseId}.`);
  const packageManifest = prepareAdjudication({ trialDir, projectRoot, randomIndex: () => 0, idFactory: deterministicIds('comparison') });
  const analysisMap = JSON.parse(fs.readFileSync(path.join(trialDir, 'run', 'analysis-map.json')));
  const omitted = analysisMap.policyRows.T1.strategy[0];
  for (const item of packageManifest.sheets) {
    if (item.comparisonId === omitted.comparisonId) continue;
    const file = path.join(trialDir, 'run', 'adjudication', 'sheets', `${item.comparisonId}.json`);
    const sheet = JSON.parse(fs.readFileSync(file));
    fillJudgment(sheet.judgments.adjudicatorA, sheet.targetCards, true, false);
    fillJudgment(sheet.judgments.adjudicatorB, sheet.targetCards, true, false);
    writeJson(file, sheet);
  }
  const report = analyzeTrial({ trialDir, projectRoot });
  assert.equal(report.policies.T1.n, 8);
  assert.equal(report.policies.T1.nonzero, 8);
  assert.equal(report.policies.T1.positive, 8);
  assert.equal(report.analysisPopulations.T1.length, 8);
  assert.ok(report.missingRows.some((row) => row.policy === 'T1' && row.caseId === omitted.caseId && row.comparisonId === omitted.comparisonId));
});

test('completed blinded sheets produce deterministic eligible signals without exposing a shipping decision', () => {
  const { projectRoot, trialDir, config } = fixture();
  prepareTrial({ trialDir, projectRoot, config, randomIndex: () => 0, idFactory: deterministicIds(), now: () => '2026-08-24T12:00:00.000Z' });
  const gold = JSON.parse(fs.readFileSync(path.join(trialDir, 'gold.json')));
  const goldById = new Map(gold.cases.map((item) => [item.id, item]));
  const selectors = completeSelectors(trialDir, (caseId, family) => goldById.get(caseId).applicability[family] ? 'apply' : 'skip');
  freezeSelectors({ trialDir, projectRoot });
  assert.equal(selectorDecision(selectors.cases[0], 'strategy'), 'apply');
  const unilateral = structuredClone(selectors.cases.find((record) => !goldById.get(record.caseId).applicability.strategy));
  unilateral.strategy.independent.name = unilateral.strategy.primary.name;
  assert.equal(selectorDecision(unilateral, 'strategy'), 'apply');
  const order = JSON.parse(fs.readFileSync(path.join(trialDir, 'run', 'dispatch-order.json'))).dispatch;
  for (const item of order) fs.writeFileSync(path.join(trialDir, 'run', 'outputs', `${item.dispatchId}.md`), `Review output for ${item.caseId}.`);

  const packageManifest = prepareAdjudication({ trialDir, projectRoot, randomIndex: () => 0, idFactory: deterministicIds('comparison'), now: () => '2026-08-24T13:00:00.000Z' });
  for (const item of packageManifest.sheets) {
    const file = path.join(trialDir, 'run', 'adjudication', 'sheets', `${item.comparisonId}.json`);
    const sheet = JSON.parse(fs.readFileSync(file));
    fillJudgment(sheet.judgments.adjudicatorA, sheet.targetCards, true, false);
    fillJudgment(sheet.judgments.adjudicatorB, sheet.targetCards, true, false);
    writeJson(file, sheet);
  }
  const report = analyzeTrial({ trialDir, projectRoot, now: () => '2026-08-24T14:00:00.000Z' });
  assert.equal(report.selectorEligible, true);
  assert.equal(report.analysisPopulations.T1.length, 9);
  assert.equal(report.analysisPopulations.T2.length, 9);
  assert.deepEqual(report.missingRows, []);
  for (const policy of ['T1', 'T2', 'E', 'D', 'B']) assert.equal(report.policies[policy].status, 'ELIGIBLE_FOR_NEW_DESIGN');
  assert.match(report.decisionBoundary, /fresh production design/);
  assert.equal(trialStatus({ trialDir, projectRoot }).status, 'ANALYZED');
  assert.throws(() => analyzeTrial({ trialDir, projectRoot }), /EEXIST/);
});
