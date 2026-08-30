import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  admitKcrpProviderTrialWindowAuthorization,
  analyzeKcrpProviderTrialCampaign,
  buildKcrpProviderTrialCorpus,
  buildKcrpProviderTrialWindowPlan,
  KCRP_PROVIDER_TRIAL_CONSTANTS,
  validateKcrpProviderTrialRun
} from '../plugins/kstack/scripts/kstack-kcrp-provider-trial.mjs';

const H = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])]))
    : value;
const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

function seal(run) {
  const body = structuredClone(run); delete body.runDigest;
  return { ...body, runDigest: digest(body) };
}

function run({ lane, windowId, windowDate, pairIndex, taskClass, arm, controlFirst }) {
  const treatment = arm === 'B3';
  const pairId = `pair-${String(pairIndex).padStart(2, '0')}`;
  return seal({
    schemaVersion: 1, lane, windowId, windowDate, pairId, taskId: `task-${String(pairIndex).padStart(2, '0')}`,
    taskClass, arm, armOrdinal: controlFirst ? (treatment ? 2 : 1) : (treatment ? 1 : 2),
    providerId: 'codex', modelId: 'gpt-5.6-sol', reasoningLevel: 'high',
    snapshotDigest: H('snapshot'), packetDigest: H(`${lane}:${pairId}:${arm}:packet`),
    manifestDigest: H(`${lane}:${pairId}:${arm}:manifest`), promptBytes: treatment ? 70_000 : 100_000,
    usage: {
      rawInputTokens: treatment ? 700 : 1_000, cacheWriteTokens: 0, cachedInputTokens: 0,
      outputTokens: 100, reasoningTokens: 200,
      billedCostMicrousd: null, billedCostReceiptDigest: null,
      unavailableCostReason: KCRP_PROVIDER_TRIAL_CONSTANTS.costUnavailableReason
    },
    latency: { ttftMs: null, ttftUnavailableReason: KCRP_PROVIDER_TRIAL_CONSTANTS.ttftUnavailableReason, providerMs: treatment ? 700 : 900, endToEndMs: treatment ? 800 : 1_000 },
    terminal: { decision: 'APPROVE', confidence: 96, rounds: 1, providerCalls: 1, deterministicDigest: H(`${lane}:${pairId}:decision`), fallbackReason: null },
    quality: {
      criticalHighMisses: 0, securityFindings: 0, nonCriticalFalseNegatives: 0,
      nonCriticalOpportunities: 10, adjudicationDigest: H(`${lane}:${windowId}:${pairId}:adjudication`),
      blindingReceiptDigest: H(`${lane}:${windowId}:${pairId}:blind`)
    },
    usageReceiptDigest: H(`${lane}:${windowId}:${pairId}:${arm}:usage`),
    processReceiptDigest: H(`${lane}:${windowId}:${pairId}:${arm}:process`),
    secretSafety: { credentialMaterial: false, admitted: true, scanDigest: H(`${lane}:${windowId}:${pairId}:${arm}:scan`) },
    runDigest: H('placeholder')
  });
}

function campaign(lane = 'host') {
  const dates = ['2026-08-30', '2026-08-31', '2026-09-01'];
  const runs = [];
  for (let window = 0; window < 3; window += 1) {
    for (let pairIndex = 0; pairIndex < 30; pairIndex += 1) {
      const taskClass = KCRP_PROVIDER_TRIAL_CONSTANTS.taskClasses[Math.floor(pairIndex / 5)];
      const controlFirst = pairIndex % 2 === 0;
      for (const arm of ['A', 'B3']) runs.push(run({
        lane, windowId: `window-${window + 1}`, windowDate: dates[window], pairIndex, taskClass, arm, controlFirst
      }));
    }
  }
  return { schemaVersion: 1, lane, corpusDigest: H(`${lane}:corpus`), runnerDigest: H('runner'), bootstrapSeedDigest: H(`${lane}:bootstrap`), runs };
}

test('Host and Domain corpora bind thirty unique tasks across the six exact classes', () => {
  for (const lane of ['host', 'domain']) {
    const result = buildKcrpProviderTrialCorpus({
      lane,
      fixtureDigest: H(`${lane}:fixture`),
      snapshotDigest: H('snapshot'),
      arms: {
        A: { reviewInputDigest: H(`${lane}:full-input`), packetDigest: H(`${lane}:full-packet`), manifestDigest: H(`${lane}:full-manifest`) },
        B3: { reviewInputDigest: H(`${lane}:reduced-input`), packetDigest: H(`${lane}:reduced-packet`), manifestDigest: H(`${lane}:reduced-manifest`) }
      }
    });
    assert.equal(result.record.tasks.length, 30);
    assert.equal(new Set(result.record.tasks.map((row) => row.taskId)).size, 30);
    assert.equal(new Set(result.record.tasks.map((row) => row.promptDigest)).size, 30);
    assert.deepEqual(
      Object.fromEntries(KCRP_PROVIDER_TRIAL_CONSTANTS.taskClasses.map((taskClass) => [
        taskClass, result.record.tasks.filter((row) => row.taskClass === taskClass).length
      ])),
      Object.fromEntries(KCRP_PROVIDER_TRIAL_CONSTANTS.taskClasses.map((taskClass) => [taskClass, 5]))
    );
    assert.match(result.corpusDigest, /^[a-f0-9]{64}$/u);
  }
});

test('a sixty-invocation window is payload-bound, crossover-balanced, scanned, and authorization guarded', () => {
  const full = Buffer.from('full packet');
  const reduced = Buffer.from('reduced packet');
  const bytesDigest = (value) => crypto.createHash('sha256').update(value).digest('hex');
  const corpus = buildKcrpProviderTrialCorpus({
    lane: 'host', fixtureDigest: H('fixture'),
    snapshotDigest: H('snapshot'),
    arms: {
      A: { reviewInputDigest: bytesDigest(full), packetDigest: H('full-packet'), manifestDigest: H('full-manifest') },
      B3: { reviewInputDigest: bytesDigest(reduced), packetDigest: H('reduced-packet'), manifestDigest: H('reduced-manifest') }
    }
  });
  const plan = buildKcrpProviderTrialWindowPlan({
    corpus, windowId: 'window-1', windowDate: '2026-08-30', runnerDigest: H('runner'),
    providerId: 'codex', modelId: 'gpt-5.6-sol', reasoningLevel: 'high',
    armInputs: { A: full, B3: reduced }
  });
  assert.equal(plan.record.invocations.length, 60);
  assert.equal(plan.payloads.size, 60);
  assert.equal(plan.record.invocations.filter((row) => row.arm === 'A' && row.armOrdinal === 1).length, 15);
  for (const invocation of plan.record.invocations) {
    const payload = plan.payloads.get(invocation.invocationId);
    assert.equal(crypto.createHash('sha256').update(payload).digest('hex'), invocation.payloadDigest);
    assert.match(invocation.secretScanDigest, /^[a-f0-9]{64}$/u);
  }
  assert.throws(
    () => admitKcrpProviderTrialWindowAuthorization(plan, H('wrong')),
    /KSTACK_KCRP_PROVIDER_TRIAL_AUTHORIZATION_REQUIRED/u
  );
  assert.equal(
    admitKcrpProviderTrialWindowAuthorization(plan, plan.authorizationDigest).authorized,
    true
  );

  const unsafe = buildKcrpProviderTrialCorpus({
    lane: 'host', fixtureDigest: H('fixture'),
    snapshotDigest: H('snapshot'),
    arms: {
      A: { reviewInputDigest: bytesDigest(Buffer.from('token=abcdefghijklmnop')), packetDigest: H('full-packet'), manifestDigest: H('full-manifest') },
      B3: { reviewInputDigest: bytesDigest(reduced), packetDigest: H('reduced-packet'), manifestDigest: H('reduced-manifest') }
    }
  });
  assert.throws(() => buildKcrpProviderTrialWindowPlan({
    corpus: unsafe, windowId: 'window-1', windowDate: '2026-08-30', runnerDigest: H('runner'),
    providerId: 'codex', modelId: 'gpt-5.6-sol', reasoningLevel: 'high',
    armInputs: { A: Buffer.from('token=abcdefghijklmnop'), B3: reduced }
  }), /OUTBOUND_SECRET_SCAN_REJECTED/u);
});

function mutateRun(input, predicate, mutate) {
  const copy = structuredClone(input);
  const index = copy.runs.findIndex(predicate);
  copy.runs[index] = seal(mutate(copy.runs[index]));
  return copy;
}

test('three exact 30-pair crossover windows qualify Host and Domain campaigns', () => {
  for (const lane of ['host', 'domain']) {
    const result = analyzeKcrpProviderTrialCampaign(campaign(lane));
    assert.equal(result.qualified, true);
    assert.equal(result.record.disposition, 'QUALIFIED_OPT_IN');
    assert.equal(result.record.windows.length, 3);
    assert.equal(result.record.aggregate.pairCount, 90);
    assert.ok(Math.abs(result.record.aggregate.rawInputReduction - 0.3) < Number.EPSILON);
    assert.equal(result.record.aggregate.bootstrap.resamples, 100_000);
    assert.equal(result.record.aggregate.billedCost.available, false);
    assert.equal(result.record.aggregate.billedCost.unavailableReason, 'AUTHORITATIVE_BILLING_RECEIPT_UNAVAILABLE');
    assert.match(result.campaignDigest, /^[a-f0-9]{64}$/u);
  }
});

test('run receipts are closed, content-bound, credential-free, and exact-usage typed', () => {
  const valid = campaign().runs[0];
  assert.equal(validateKcrpProviderTrialRun(valid).runDigest, valid.runDigest);
  for (const mutate of [
    (row) => { row.extra = true; },
    (row) => { row.secretSafety.credentialMaterial = true; },
    (row) => { row.usage.rawInputTokens = 0; },
    (row) => { row.usage.billedCostMicrousd = 1; },
    (row) => { row.latency.ttftUnavailableReason = null; },
    (row) => { row.runDigest = H('forged'); }
  ]) {
    const copy = structuredClone(valid); mutate(copy);
    assert.throws(() => validateKcrpProviderTrialRun(copy), /KSTACK_KCRP_PROVIDER_TRIAL_RUN_INVALID/u);
  }
});

test('campaign rejects missing coverage, reused dates, binding drift, and deterministic mismatch', () => {
  const missing = campaign(); missing.runs.pop();
  assert.throws(() => analyzeKcrpProviderTrialCampaign(missing), /KSTACK_KCRP_PROVIDER_TRIAL_CAMPAIGN_INVALID/u);
  const dateReuse = campaign();
  for (let index = 120; index < 180; index += 1) dateReuse.runs[index] = seal({ ...dateReuse.runs[index], windowDate: '2026-08-31' });
  assert.throws(() => analyzeKcrpProviderTrialCampaign(dateReuse), /distinct dates/u);
  const drift = mutateRun(campaign(), (row) => row.windowId === 'window-1' && row.pairId === 'pair-00' && row.arm === 'B3', (row) => ({ ...row, modelId: 'other-model' }));
  assert.throws(() => analyzeKcrpProviderTrialCampaign(drift), /pair binding modelId/u);
  const mismatch = mutateRun(campaign(), (row) => row.windowId === 'window-1' && row.pairId === 'pair-00' && row.arm === 'B3', (row) => ({ ...row, terminal: { ...row.terminal, deterministicDigest: H('different') } }));
  assert.throws(() => analyzeKcrpProviderTrialCampaign(mismatch), /deterministic mismatch/u);
});

test('quality, token, round, fallback, and latency regressions remain non-qualifying', () => {
  const token = campaign();
  token.runs = token.runs.map((row) => row.arm === 'B3' ? seal({ ...row, usage: { ...row.usage, rawInputTokens: 900 } }) : row);
  assert.equal(analyzeKcrpProviderTrialCampaign(token).qualified, false);

  const quality = mutateRun(campaign(), (row) => row.arm === 'B3', (row) => ({ ...row, quality: { ...row.quality, criticalHighMisses: 1 } }));
  assert.equal(analyzeKcrpProviderTrialCampaign(quality).qualified, false);

  const rounds = campaign();
  rounds.runs = rounds.runs.map((row) => row.arm === 'B3' ? seal({ ...row, terminal: { ...row.terminal, rounds: 2 } }) : row);
  assert.equal(analyzeKcrpProviderTrialCampaign(rounds).qualified, false);

  const fallback = campaign();
  fallback.runs = fallback.runs.map((row, index) => row.arm === 'B3' && index % 4 === 1
    ? seal({ ...row, terminal: { ...row.terminal, fallbackReason: 'FULL_ARTIFACT_REQUIRED' } }) : row);
  assert.equal(analyzeKcrpProviderTrialCampaign(fallback).qualified, false);

  const latency = campaign();
  latency.runs = latency.runs.map((row) => row.arm === 'B3' ? seal({ ...row, latency: { ...row.latency, providerMs: 900, endToEndMs: 1_100 } }) : row);
  assert.equal(analyzeKcrpProviderTrialCampaign(latency).qualified, false);
});

test('authoritative billed cost is aggregated only when every run supplies a bound receipt', () => {
  const input = campaign();
  input.runs = input.runs.map((row) => seal({
    ...row,
    usage: {
      ...row.usage,
      billedCostMicrousd: row.arm === 'A' ? 100 : 70,
      billedCostReceiptDigest: H(`${row.runDigest}:billing`), unavailableCostReason: null
    }
  }));
  const result = analyzeKcrpProviderTrialCampaign(input);
  assert.equal(result.qualified, true);
  assert.deepEqual(result.record.aggregate.billedCost, {
    available: true, controlMicrousd: 9_000, treatmentMicrousd: 6_300, unavailableReason: null
  });
});
