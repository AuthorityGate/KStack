import crypto from 'node:crypto';

import { clopperPearsonUpper } from './kstack-domain-evaluation.mjs';
import { assertOutboundSecretScan, MATCHER_VERSION } from './kstack-safety-matchers.mjs';

const HASH = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const LANES = Object.freeze(['host', 'domain']);
const ARMS = Object.freeze(['A', 'B3']);
const TASK_CLASSES = Object.freeze([
  'dense-design', 'local-design', 'qc-prior-findings',
  'security-adjacent', 'short-skill', 'sparse-design'
]);
const FALLBACK_REASONS = Object.freeze([
  'AMBIGUOUS_DEFECT_ATTRIBUTION', 'CONFIDENCE_REGRESSION', 'DETERMINISTIC_CHECK_UNEVALUABLE',
  'FULL_ARTIFACT_REQUIRED', 'MUTABLE_REFERENCE', 'NEW_FINDING', 'PACKET_AT_LEAST_90_PERCENT',
  'RECONSTRUCTION_DISAGREEMENT', 'UNBOUNDED_CYCLE', 'UNRESOLVED_REFERENCE'
]);
const COST_UNAVAILABLE = 'AUTHORITATIVE_BILLING_RECEIPT_UNAVAILABLE';
const TTFT_UNAVAILABLE = 'PROVIDER_TTFT_UNAVAILABLE';
const RESAMPLES = 100_000;
const CORPUS_OBJECTIVES = Object.freeze({
  'dense-design': Object.freeze([
    'Trace objective coverage across architecture blocks and identify one missing dependency.',
    'Assess boundary completeness, failure containment, and recovery intent without proposing code.',
    'Find contradictions between lifecycle states, authority boundaries, and evidence promotion.',
    'Evaluate whether verification intent covers every high-risk transition and rollback boundary.',
    'Determine whether the design is complete at 10,000-foot altitude and backlog-ready.'
  ]),
  'local-design': Object.freeze([
    'Assess the selected local contract for one ambiguous state transition.',
    'Identify one missing precondition or postcondition in the selected design block.',
    'Check whether local evidence is sufficient for the stated disposition.',
    'Evaluate the selected dependency edge for ordering or ownership ambiguity.',
    'Determine whether the selected block can be independently realized and verified.'
  ]),
  'qc-prior-findings': Object.freeze([
    'Re-evaluate prior findings and report only findings that remain unresolved.',
    'Check whether the repair closes the stated defect without weakening another invariant.',
    'Identify stale evidence, target drift, or a finding closed only by assertion.',
    'Verify that the current disposition follows from the supplied receipts and boundaries.',
    'Determine whether any prior critical or high finding still blocks qualification.'
  ]),
  'security-adjacent': Object.freeze([
    'Assess trust boundaries and identify any credential, authority, or confused-deputy exposure.',
    'Check replay, substitution, and stale-binding resistance across the selected flow.',
    'Evaluate fail-closed behavior when identity, evidence, or provider state is unavailable.',
    'Identify any path, child-execution, network, or tool capability that exceeds the declared authority.',
    'Assess whether retained evidence can leak secrets or permit unauthorized activation.'
  ]),
  'short-skill': Object.freeze([
    'Return the strongest remaining blocker and the evidence that proves it.',
    'State whether the selected item is ready for independent final review and why.',
    'Name the single highest-value verification still missing.',
    'Identify the most material ambiguity in the supplied contract.',
    'Give the disposition and one sentence of evidence-grounded rationale.'
  ]),
  'sparse-design': Object.freeze([
    'Identify assumptions that are not supported by the available design evidence.',
    'Determine which missing boundary prevents backlog-ready planning.',
    'Assess whether the sparse design states a testable outcome and recovery intent.',
    'Find the first unresolved dependency that blocks safe realization.',
    'Determine whether clarification, revision, or approval is justified by the supplied record.'
  ])
});

function fail(code, detail = '') {
  const error = new Error(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code;
  throw error;
}
function compare(left, right) { return Buffer.compare(Buffer.from(left), Buffer.from(right)); }
function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  const actual = Object.keys(value).sort(compare);
  const expected = [...keys].sort(compare);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}
function text(value, code, pattern = ID) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(code);
  return value;
}
function hash(value, code) { return text(value, code, HASH); }
function integer(value, minimum, maximum, code) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code);
  return value;
}
function nullableInteger(value, minimum, maximum, code) {
  return value === null ? null : integer(value, minimum, maximum, code);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])]));
  return value;
}
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}
function validDate(value, code) {
  text(value, code, DATE);
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) fail(code);
  return value;
}
function validateUsage(input, code) {
  exact(input, [
    'rawInputTokens', 'cacheWriteTokens', 'cachedInputTokens', 'outputTokens', 'reasoningTokens',
    'billedCostMicrousd', 'billedCostReceiptDigest', 'unavailableCostReason'
  ], code);
  const billedCostMicrousd = nullableInteger(input.billedCostMicrousd, 0, Number.MAX_SAFE_INTEGER, code);
  const billedCostReceiptDigest = input.billedCostReceiptDigest === null ? null : hash(input.billedCostReceiptDigest, code);
  const unavailableCostReason = input.unavailableCostReason === null ? null : text(input.unavailableCostReason, code);
  if (billedCostMicrousd === null) {
    if (billedCostReceiptDigest !== null || unavailableCostReason !== COST_UNAVAILABLE) fail(code);
  } else if (billedCostReceiptDigest === null || unavailableCostReason !== null) fail(code);
  return {
    rawInputTokens: integer(input.rawInputTokens, 1, Number.MAX_SAFE_INTEGER, code),
    cacheWriteTokens: integer(input.cacheWriteTokens, 0, Number.MAX_SAFE_INTEGER, code),
    cachedInputTokens: integer(input.cachedInputTokens, 0, Number.MAX_SAFE_INTEGER, code),
    outputTokens: integer(input.outputTokens, 0, Number.MAX_SAFE_INTEGER, code),
    reasoningTokens: integer(input.reasoningTokens, 0, Number.MAX_SAFE_INTEGER, code),
    billedCostMicrousd, billedCostReceiptDigest, unavailableCostReason
  };
}
function validateLatency(input, code) {
  exact(input, ['ttftMs', 'ttftUnavailableReason', 'providerMs', 'endToEndMs'], code);
  const ttftMs = nullableInteger(input.ttftMs, 0, 86_400_000, code);
  const ttftUnavailableReason = input.ttftUnavailableReason === null ? null : text(input.ttftUnavailableReason, code);
  if ((ttftMs === null) !== (ttftUnavailableReason === TTFT_UNAVAILABLE)) fail(code);
  const providerMs = integer(input.providerMs, 1, 86_400_000, code);
  const endToEndMs = integer(input.endToEndMs, providerMs, 86_400_000, code);
  return { ttftMs, ttftUnavailableReason, providerMs, endToEndMs };
}
function validateTerminal(input, code) {
  exact(input, ['decision', 'confidence', 'rounds', 'providerCalls', 'deterministicDigest', 'fallbackReason'], code);
  if (!['APPROVE', 'REVISE'].includes(input.decision)) fail(code);
  const fallbackReason = input.fallbackReason === null ? null : text(input.fallbackReason, code);
  if (fallbackReason !== null && !FALLBACK_REASONS.includes(fallbackReason)) fail(code);
  return {
    decision: input.decision,
    confidence: integer(input.confidence, 0, 100, code),
    rounds: integer(input.rounds, 1, 100, code),
    providerCalls: integer(input.providerCalls, 1, 100, code),
    deterministicDigest: hash(input.deterministicDigest, code), fallbackReason
  };
}
function validateQuality(input, code) {
  exact(input, [
    'criticalHighMisses', 'securityFindings', 'nonCriticalFalseNegatives',
    'nonCriticalOpportunities', 'adjudicationDigest', 'blindingReceiptDigest'
  ], code);
  const opportunities = integer(input.nonCriticalOpportunities, 1, 10_000, code);
  return {
    criticalHighMisses: integer(input.criticalHighMisses, 0, 10_000, code),
    securityFindings: integer(input.securityFindings, 0, 10_000, code),
    nonCriticalFalseNegatives: integer(input.nonCriticalFalseNegatives, 0, opportunities, code),
    nonCriticalOpportunities: opportunities,
    adjudicationDigest: hash(input.adjudicationDigest, code),
    blindingReceiptDigest: hash(input.blindingReceiptDigest, code)
  };
}

export function validateKcrpProviderTrialRun(input) {
  const code = 'KSTACK_KCRP_PROVIDER_TRIAL_RUN_INVALID';
  exact(input, [
    'schemaVersion', 'lane', 'windowId', 'windowDate', 'pairId', 'taskId', 'taskClass',
    'arm', 'armOrdinal', 'providerId', 'modelId', 'reasoningLevel', 'snapshotDigest',
    'packetDigest', 'manifestDigest', 'promptBytes', 'usage', 'latency', 'terminal',
    'quality', 'usageReceiptDigest', 'processReceiptDigest', 'secretSafety', 'runDigest'
  ], code);
  if (input.schemaVersion !== 1 || !LANES.includes(input.lane) || !TASK_CLASSES.includes(input.taskClass)
      || !ARMS.includes(input.arm)) fail(code);
  exact(input.secretSafety, ['credentialMaterial', 'admitted', 'scanDigest'], code);
  if (input.secretSafety.credentialMaterial !== false || input.secretSafety.admitted !== true) fail(code);
  const record = {
    schemaVersion: 1, lane: input.lane,
    windowId: text(input.windowId, code), windowDate: validDate(input.windowDate, code),
    pairId: text(input.pairId, code), taskId: text(input.taskId, code), taskClass: input.taskClass,
    arm: input.arm, armOrdinal: integer(input.armOrdinal, 1, 2, code),
    providerId: text(input.providerId, code), modelId: text(input.modelId, code),
    reasoningLevel: text(input.reasoningLevel, code),
    snapshotDigest: hash(input.snapshotDigest, code), packetDigest: hash(input.packetDigest, code),
    manifestDigest: hash(input.manifestDigest, code),
    promptBytes: integer(input.promptBytes, 1, 16 * 1024 * 1024, code),
    usage: validateUsage(input.usage, code), latency: validateLatency(input.latency, code),
    terminal: validateTerminal(input.terminal, code), quality: validateQuality(input.quality, code),
    usageReceiptDigest: hash(input.usageReceiptDigest, code),
    processReceiptDigest: hash(input.processReceiptDigest, code),
    secretSafety: { credentialMaterial: false, admitted: true, scanDigest: hash(input.secretSafety.scanDigest, code) }
  };
  if (input.runDigest !== digest(record)) fail(code);
  return immutable({ ...record, runDigest: input.runDigest });
}

function pairRuns(control, treatment, code) {
  for (const key of [
    'lane', 'windowId', 'windowDate', 'pairId', 'taskId', 'taskClass', 'providerId',
    'modelId', 'reasoningLevel', 'snapshotDigest'
  ]) if (control[key] !== treatment[key]) fail(code, `pair binding ${key}`);
  if (control.arm !== 'A' || treatment.arm !== 'B3' || control.armOrdinal === treatment.armOrdinal) fail(code, 'arm pairing');
  if ((control.armOrdinal === 1) !== (treatment.armOrdinal === 2)) fail(code, 'arm order');
  if (control.terminal.deterministicDigest !== treatment.terminal.deterministicDigest) fail(code, 'deterministic mismatch');
  return immutable({ control, treatment });
}
function seededRandom(seedDigest) {
  let counter = 0n; let pool = Buffer.alloc(0); let offset = 0;
  return () => {
    if (offset + 4 > pool.length) {
      const count = Buffer.alloc(8); count.writeBigUInt64BE(counter); counter += 1n;
      pool = crypto.createHash('sha256').update(Buffer.from(seedDigest, 'hex')).update(count).digest(); offset = 0;
    }
    const value = pool.readUInt32BE(offset); offset += 4;
    return value / 0x1_0000_0000;
  };
}
function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))];
}
function median(values) { return percentile(values, 0.5); }
function stratifiedBootstrap(pairs, seedDigest) {
  const groups = [];
  for (const windowId of [...new Set(pairs.map((pair) => pair.control.windowId))].sort(compare)) {
    for (const taskClass of TASK_CLASSES) {
      const group = pairs.filter((pair) => pair.control.windowId === windowId && pair.control.taskClass === taskClass);
      if (group.length !== 5) fail('KSTACK_KCRP_PROVIDER_TRIAL_CAMPAIGN_INVALID', 'bootstrap stratum');
      groups.push(group);
    }
  }
  const random = seededRandom(seedDigest);
  const reductions = new Float64Array(RESAMPLES);
  const defectDeltas = new Float64Array(RESAMPLES);
  for (let sample = 0; sample < RESAMPLES; sample += 1) {
    let controlTokens = 0; let treatmentTokens = 0;
    let controlMisses = 0; let treatmentMisses = 0; let opportunities = 0;
    for (const group of groups) for (let draw = 0; draw < group.length; draw += 1) {
      const pair = group[Math.floor(random() * group.length)];
      controlTokens += pair.control.usage.rawInputTokens;
      treatmentTokens += pair.treatment.usage.rawInputTokens;
      controlMisses += pair.control.quality.nonCriticalFalseNegatives;
      treatmentMisses += pair.treatment.quality.nonCriticalFalseNegatives;
      opportunities += pair.control.quality.nonCriticalOpportunities;
    }
    reductions[sample] = 1 - treatmentTokens / controlTokens;
    defectDeltas[sample] = (treatmentMisses - controlMisses) / opportunities;
  }
  reductions.sort(); defectDeltas.sort();
  return immutable({
    resamples: RESAMPLES,
    reductionLower95: reductions[Math.floor(0.025 * RESAMPLES)],
    reductionUpper95: reductions[Math.ceil(0.975 * RESAMPLES) - 1],
    nonCriticalDeltaUpper95: defectDeltas[Math.ceil(0.975 * RESAMPLES) - 1]
  });
}
function analyzePairs(pairs, bootstrapSeedDigest) {
  const control = pairs.map((pair) => pair.control);
  const treatment = pairs.map((pair) => pair.treatment);
  const controlTokens = control.reduce((sum, run) => sum + run.usage.rawInputTokens, 0);
  const treatmentTokens = treatment.reduce((sum, run) => sum + run.usage.rawInputTokens, 0);
  const fallback = treatment.filter((run) => run.terminal.fallbackReason !== null);
  const fallbackUpper95 = clopperPearsonUpper(fallback.length, treatment.length);
  const bootstrap = stratifiedBootstrap(pairs, bootstrapSeedDigest);
  const classFallbackMaximum = Math.max(...TASK_CLASSES.map((taskClass) => {
    const rows = treatment.filter((run) => run.taskClass === taskClass);
    return rows.filter((run) => run.terminal.fallbackReason !== null).length / rows.length;
  }));
  const roundsP95Delta = percentile(treatment.map((run) => run.terminal.rounds), 0.95)
    - percentile(control.map((run) => run.terminal.rounds), 0.95);
  const medianRoundsDelta = median(treatment.map((run) => run.terminal.rounds))
    - median(control.map((run) => run.terminal.rounds));
  const p50LatencyImprovement = 1 - median(treatment.map((run) => run.latency.endToEndMs))
    / median(control.map((run) => run.latency.endToEndMs));
  const p95LatencyWorsening = percentile(treatment.map((run) => run.latency.endToEndMs), 0.95)
    / percentile(control.map((run) => run.latency.endToEndMs), 0.95) - 1;
  const billedCostComplete = [...control, ...treatment].every((run) => run.usage.billedCostMicrousd !== null);
  const gates = {
    tokenReduction: 1 - treatmentTokens / controlTokens >= 0.15 && bootstrap.reductionLower95 >= 0.15,
    criticalAndSecurity: treatment.every((run) => run.quality.criticalHighMisses === 0 && run.quality.securityFindings === 0),
    nonCriticalQuality: bootstrap.nonCriticalDeltaUpper95 <= 0.02,
    deterministic: pairs.every((pair) => pair.control.terminal.deterministicDigest === pair.treatment.terminal.deterministicDigest),
    rounds: medianRoundsDelta <= 0 && roundsP95Delta <= 1,
    fallback: fallback.length / treatment.length <= 0.10 && fallbackUpper95 <= 0.20 && classFallbackMaximum <= 0.35,
    latency: p50LatencyImprovement >= 0.10 && p95LatencyWorsening <= 0.05
  };
  return immutable({
    pairCount: pairs.length, controlRawInputTokens: controlTokens, treatmentRawInputTokens: treatmentTokens,
    rawInputReduction: 1 - treatmentTokens / controlTokens, bootstrap,
    fallback: { events: fallback.length, point: fallback.length / treatment.length, upper95: fallbackUpper95, classMaximum: classFallbackMaximum },
    rounds: { medianDelta: medianRoundsDelta, p95Delta: roundsP95Delta },
    latency: { p50Improvement: p50LatencyImprovement, p95Worsening: p95LatencyWorsening },
    billedCost: billedCostComplete ? {
      available: true,
      controlMicrousd: control.reduce((sum, run) => sum + run.usage.billedCostMicrousd, 0),
      treatmentMicrousd: treatment.reduce((sum, run) => sum + run.usage.billedCostMicrousd, 0),
      unavailableReason: null
    } : { available: false, controlMicrousd: null, treatmentMicrousd: null, unavailableReason: COST_UNAVAILABLE },
    gates, qualified: Object.values(gates).every(Boolean)
  });
}

export function analyzeKcrpProviderTrialCampaign(input) {
  const code = 'KSTACK_KCRP_PROVIDER_TRIAL_CAMPAIGN_INVALID';
  exact(input, ['schemaVersion', 'lane', 'corpusDigest', 'runnerDigest', 'bootstrapSeedDigest', 'runs'], code);
  if (input.schemaVersion !== 1 || !LANES.includes(input.lane) || !Array.isArray(input.runs) || input.runs.length !== 180) fail(code);
  const corpusDigest = hash(input.corpusDigest, code);
  const runnerDigest = hash(input.runnerDigest, code);
  const bootstrapSeedDigest = hash(input.bootstrapSeedDigest, code);
  const runs = input.runs.map(validateKcrpProviderTrialRun);
  if (runs.some((run) => run.lane !== input.lane)) fail(code, 'lane binding');
  const windows = [...new Set(runs.map((run) => run.windowId))].sort(compare);
  if (windows.length !== 3) fail(code, 'window count');
  const dates = windows.map((windowId) => {
    const rows = runs.filter((run) => run.windowId === windowId);
    const values = [...new Set(rows.map((run) => run.windowDate))];
    if (values.length !== 1) fail(code, 'window date');
    return values[0];
  });
  if (new Set(dates).size !== 3) fail(code, 'distinct dates');
  const pairMap = new Map();
  for (const run of runs) {
    const key = `${run.windowId}\0${run.pairId}`;
    const rows = pairMap.get(key) ?? []; rows.push(run); pairMap.set(key, rows);
  }
  if ([...pairMap.values()].some((rows) => rows.length !== 2)) fail(code, 'pair cardinality');
  const pairs = [...pairMap.entries()].map(([key, rows]) => {
    const control = rows.find((run) => run.arm === 'A');
    const treatment = rows.find((run) => run.arm === 'B3');
    if (!control || !treatment) fail(code, 'pair arms');
    return pairRuns(control, treatment, code);
  }).sort((left, right) => compare(`${left.control.windowId}\0${left.control.pairId}`, `${right.control.windowId}\0${right.control.pairId}`));
  const canonicalPairIds = [...new Set(pairs.map((pair) => pair.control.pairId))].sort(compare);
  if (canonicalPairIds.length !== 30) fail(code, 'pair inventory');
  for (const windowId of windows) {
    const windowPairs = pairs.filter((pair) => pair.control.windowId === windowId);
    if (windowPairs.length !== 30 || canonicalPairIds.some((pairId) => !windowPairs.some((pair) => pair.control.pairId === pairId))) fail(code, 'window coverage');
    if (windowPairs.filter((pair) => pair.control.armOrdinal === 1).length !== 15) fail(code, 'crossover balance');
    for (const taskClass of TASK_CLASSES) if (windowPairs.filter((pair) => pair.control.taskClass === taskClass).length !== 5) fail(code, 'class balance');
  }
  const snapshotDigests = new Set(runs.map((run) => run.snapshotDigest));
  const providerConfigs = new Set(runs.map((run) => `${run.providerId}\0${run.modelId}\0${run.reasoningLevel}`));
  if (snapshotDigests.size !== 1 || providerConfigs.size !== 1) fail(code, 'campaign binding');
  const aggregate = analyzePairs(pairs, bootstrapSeedDigest);
  const windowResults = windows.map((windowId) => ({
    windowId,
    windowDate: pairs.find((pair) => pair.control.windowId === windowId).control.windowDate,
    result: analyzePairs(pairs.filter((pair) => pair.control.windowId === windowId), digest({ bootstrapSeedDigest, windowId }))
  }));
  const qualified = aggregate.qualified && windowResults.every((window) => window.result.qualified);
  const record = immutable({
    schemaVersion: 1, lane: input.lane, corpusDigest, runnerDigest, bootstrapSeedDigest,
    snapshotDigest: [...snapshotDigests][0], providerConfigurationDigest: digest([...providerConfigs][0]),
    windows: windowResults, aggregate,
    disposition: qualified ? 'QUALIFIED_OPT_IN' : 'NOT_QUALIFIED', qualified,
    runSetDigest: digest(runs.map((run) => run.runDigest))
  });
  return immutable({ record, campaignDigest: digest(record), qualified });
}

export function buildKcrpProviderTrialCorpus({
  lane, fixtureDigest, snapshotDigest, arms
}) {
  const code = 'KSTACK_KCRP_PROVIDER_TRIAL_CORPUS_INVALID';
  if (!LANES.includes(lane)) fail(code);
  for (const value of [fixtureDigest, snapshotDigest]) hash(value, code);
  exact(arms, ['A', 'B3'], code);
  const armBindings = {};
  for (const arm of ARMS) {
    exact(arms[arm], ['reviewInputDigest', 'packetDigest', 'manifestDigest'], code);
    armBindings[arm] = Object.fromEntries(Object.entries(arms[arm]).map(([key, value]) => [key, hash(value, code)]));
  }
  const laneLabel = lane === 'host' ? 'Host portability and host breadth' : 'Domain breadth';
  const tasks = [];
  let ordinal = 0;
  for (const taskClass of TASK_CLASSES) {
    const objectives = CORPUS_OBJECTIVES[taskClass];
    if (!Array.isArray(objectives) || objectives.length !== 5) fail(code);
    for (const objective of objectives) {
      ordinal += 1;
      const pairId = `pair-${String(ordinal - 1).padStart(2, '0')}`;
      const taskId = `${lane}-${taskClass}-${String(ordinal).padStart(2, '0')}`;
      const prompt = `Lane: ${laneLabel}\nTask class: ${taskClass}\nTask: ${objective}\nUse only the supplied packet. Separate observed evidence from inference. Return the disposition, required findings, decisions, confidence, deterministic checks, and unresolved questions in the trial response schema.`;
      tasks.push(immutable({ pairId, taskId, taskClass, ordinal, prompt, promptDigest: digest({ prompt }) }));
    }
  }
  const record = immutable({
    schemaVersion: 1,
    kind: 'kstack-kcrp-provider-trial-corpus-v1',
    lane,
    fixtureDigest,
    snapshotDigest,
    arms: armBindings,
    tasks
  });
  return immutable({ record, corpusDigest: digest(record) });
}

function bytes(value, code) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail(code);
  const copied = Buffer.from(value);
  if (copied.length < 1 || copied.length > 16 * 1024 * 1024) fail(code);
  return copied;
}
function byteDigest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function providerTrialPayload({ lane, task, arm, armInput }) {
  const metadata = canonical({
    schemaVersion: 1,
    kind: 'kstack-kcrp-provider-trial-payload-v1',
    lane,
    pairId: task.pairId,
    taskId: task.taskId,
    taskClass: task.taskClass,
    arm
  });
  const header = Buffer.from(`KSTACK-KCRP-PROVIDER-TRIAL-V1\n${JSON.stringify(metadata)}\nTASK ${Buffer.byteLength(task.prompt, 'utf8')}\n${task.prompt}\nREVIEW-INPUT ${armInput.length}\n`, 'utf8');
  return Buffer.concat([header, armInput, Buffer.from('\nEND KSTACK-KCRP-PROVIDER-TRIAL-V1\n', 'ascii')]);
}

export function buildKcrpProviderTrialWindowPlan({
  corpus, windowId, windowDate, runnerDigest, providerId, modelId, reasoningLevel, armInputs
}) {
  const code = 'KSTACK_KCRP_PROVIDER_TRIAL_WINDOW_INVALID';
  exact(corpus, ['record', 'corpusDigest'], code);
  if (corpus.corpusDigest !== digest(corpus.record)
      || corpus.record.kind !== 'kstack-kcrp-provider-trial-corpus-v1'
      || corpus.record.schemaVersion !== 1 || !LANES.includes(corpus.record.lane)
      || !Array.isArray(corpus.record.tasks) || corpus.record.tasks.length !== 30) fail(code);
  exact(armInputs, ['A', 'B3'], code);
  const admittedInputs = { A: bytes(armInputs.A, code), B3: bytes(armInputs.B3, code) };
  if (byteDigest(admittedInputs.A) !== corpus.record.arms.A.reviewInputDigest
      || byteDigest(admittedInputs.B3) !== corpus.record.arms.B3.reviewInputDigest) fail(code, 'arm input binding');
  const record = {
    schemaVersion: 1,
    kind: 'kstack-kcrp-provider-trial-window-plan-v1',
    lane: corpus.record.lane,
    windowId: text(windowId, code),
    windowDate: validDate(windowDate, code),
    corpusDigest: corpus.corpusDigest,
    runnerDigest: hash(runnerDigest, code),
    providerId: text(providerId, code),
    modelId: text(modelId, code),
    reasoningLevel: text(reasoningLevel, code),
    snapshotDigest: corpus.record.snapshotDigest,
    invocations: []
  };
  const payloads = new Map();
  for (const task of corpus.record.tasks) {
    const controlFirst = task.ordinal % 2 === 1;
    for (const arm of controlFirst ? ARMS : [...ARMS].reverse()) {
      const armOrdinal = controlFirst ? (arm === 'A' ? 1 : 2) : (arm === 'B3' ? 1 : 2);
      const payload = providerTrialPayload({ lane: record.lane, task, arm, armInput: admittedInputs[arm] });
      assertOutboundSecretScan(payload, { byteDomain: true });
      const payloadDigest = byteDigest(payload);
      const invocationId = `${record.windowId}:${task.pairId}:${arm}`;
      const secretScanDigest = digest({ matcherVersion: MATCHER_VERSION, payloadDigest, status: 'PASS' });
      record.invocations.push({
        invocationId, pairId: task.pairId, taskId: task.taskId, taskClass: task.taskClass,
        arm, armOrdinal, payloadBytes: payload.length, payloadDigest,
        reviewInputDigest: corpus.record.arms[arm].reviewInputDigest,
        packetDigest: corpus.record.arms[arm].packetDigest,
        manifestDigest: corpus.record.arms[arm].manifestDigest,
        secretScanDigest
      });
      payloads.set(invocationId, payload);
    }
  }
  const sealed = immutable(record);
  const planDigest = digest(sealed);
  return Object.freeze({
    record: sealed,
    planDigest,
    authorizationDigest: digest({ domain: 'KSTACK_KCRP_PROVIDER_TRIAL_WINDOW_AUTHORIZATION_V1', planDigest }),
    payloads
  });
}

export function admitKcrpProviderTrialWindowAuthorization(plan, authorizationDigest) {
  const code = 'KSTACK_KCRP_PROVIDER_TRIAL_AUTHORIZATION_REQUIRED';
  if (!plan || typeof plan !== 'object' || !(plan.payloads instanceof Map)
      || plan.planDigest !== digest(plan.record)
      || plan.authorizationDigest !== digest({ domain: 'KSTACK_KCRP_PROVIDER_TRIAL_WINDOW_AUTHORIZATION_V1', planDigest: plan.planDigest })
      || typeof authorizationDigest !== 'string' || authorizationDigest !== plan.authorizationDigest
      || plan.payloads.size !== plan.record.invocations.length) fail(code);
  for (const invocation of plan.record.invocations) {
    const payload = plan.payloads.get(invocation.invocationId);
    if (!Buffer.isBuffer(payload) || byteDigest(payload) !== invocation.payloadDigest) fail(code);
    assertOutboundSecretScan(payload, { byteDomain: true });
  }
  return immutable({ authorized: true, planDigest: plan.planDigest, authorizationDigest });
}

export const KCRP_PROVIDER_TRIAL_CONSTANTS = Object.freeze({
  lanes: LANES, arms: ARMS, taskClasses: TASK_CLASSES, fallbackReasons: FALLBACK_REASONS,
  costUnavailableReason: COST_UNAVAILABLE, ttftUnavailableReason: TTFT_UNAVAILABLE,
  resamples: RESAMPLES, runsPerCampaign: 180, pairsPerWindow: 30, windows: 3,
  tasksPerClass: 5
});
