#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildKcrpProviderTrialCorpus,
  buildKcrpProviderTrialWindowPlan
} from '../../plugins/kstack/scripts/kstack-kcrp-provider-trial.mjs';
import { replayMemory } from '../../tests/helpers/kcrp-offline-byte-replay.mjs';
import { recordDigest } from './host-implementation-inventory.mjs';
import { qualificationRunnerDigest } from './kcrp-provider-trial-runner-binding.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const FIXTURES = Object.freeze({
  host: 'tests/fixtures/kcrp-host-hb-tc06-byte-replay-v1.json',
  domain: 'tests/fixtures/kcrp-domain-d7-byte-replay-v1.json'
});

function fail(message) {
  const error = new Error(`KSTACK_KCRP_PROVIDER_TRIAL_PREPARATION_INVALID: ${message}`);
  error.code = 'KSTACK_KCRP_PROVIDER_TRIAL_PREPARATION_INVALID';
  throw error;
}

export function buildQualificationCorpus(lane) {
  const fixture = FIXTURES[lane];
  if (!fixture) fail('lane');
  const replay = replayMemory({ configRelativePath: fixture, verifyExpected: true });
  const snapshotDigest = recordDigest({
    configSha256: replay.configSha256,
    canonicalConfigSha256: replay.canonicalConfigSha256,
    itemMapSha256: replay.itemMapSha256,
    objectiveSha256: replay.identities.objectiveSha256,
    reviewerSha256: replay.identities.reviewerSha256,
    governanceSha256: replay.identities.governanceSha256
  });
  const arms = Object.fromEntries(['A', 'B3'].map((arm) => [arm, {
    reviewInputDigest: replay.trialArms[arm].reviewInputDigest,
    packetDigest: replay.trialArms[arm].packetDigest,
    manifestDigest: replay.trialArms[arm].manifestDigest
  }]));
  const corpus = buildKcrpProviderTrialCorpus({
    lane,
    fixtureDigest: replay.configSha256,
    snapshotDigest,
    arms
  });
  return Object.freeze({ corpus, replay, fixture, snapshotDigest });
}

function safePayloadName(invocationId) {
  const encoded = invocationId.replaceAll(':', '--');
  if (!/^[A-Za-z0-9._-]+$/u.test(encoded)) fail('invocation filename');
  return `${encoded}.bin`;
}

function writeExclusiveJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}

export function prepareQualificationWindow({
  lane, windowId, windowDate, providerId, modelId, reasoningLevel, outDir
}) {
  if (typeof outDir !== 'string' || !path.isAbsolute(outDir)) fail('absolute output directory required');
  const resolvedOut = path.resolve(outDir);
  const parent = path.dirname(resolvedOut);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) fail('output parent');
  fs.mkdirSync(resolvedOut, { recursive: false, mode: 0o700 });
  const payloadRoot = path.join(resolvedOut, 'payloads');
  fs.mkdirSync(payloadRoot, { mode: 0o700 });
  const prepared = buildQualificationCorpus(lane);
  const plan = buildKcrpProviderTrialWindowPlan({
    corpus: prepared.corpus,
    windowId,
    windowDate,
    runnerDigest: qualificationRunnerDigest(),
    providerId,
    modelId,
    reasoningLevel,
    armInputs: {
      A: prepared.replay.trialArms.A.reviewInput,
      B3: prepared.replay.trialArms.B3.reviewInput
    }
  });
  const payloadFiles = [];
  let payloadBytes = 0;
  for (const invocation of plan.record.invocations) {
    const payload = plan.payloads.get(invocation.invocationId);
    const name = safePayloadName(invocation.invocationId);
    fs.writeFileSync(path.join(payloadRoot, name), payload, { flag: 'wx', mode: 0o600 });
    payloadBytes += payload.length;
    payloadFiles.push({
      invocationId: invocation.invocationId,
      relativePath: `payloads/${name}`,
      payloadBytes: payload.length,
      payloadDigest: invocation.payloadDigest
    });
  }
  const corpusReceipt = { ...prepared.corpus, fixture: prepared.fixture };
  const planReceipt = {
    schemaVersion: 1,
    kind: 'kstack-kcrp-provider-trial-window-preparation-v1',
    plan: plan.record,
    planDigest: plan.planDigest,
    authorizationDigest: plan.authorizationDigest,
    payloadFiles,
    payloadSetDigest: recordDigest(payloadFiles)
  };
  writeExclusiveJson(path.join(resolvedOut, 'corpus.json'), corpusReceipt);
  writeExclusiveJson(path.join(resolvedOut, 'plan.json'), planReceipt);
  return Object.freeze({
    outDir: resolvedOut,
    corpusDigest: prepared.corpus.corpusDigest,
    planDigest: plan.planDigest,
    authorizationDigest: plan.authorizationDigest,
    payloadSetDigest: planReceipt.payloadSetDigest,
    invocations: payloadFiles.length,
    payloadBytes
  });
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!flag?.startsWith('--') || argv[index + 1] === undefined) fail('arguments');
    values[flag.slice(2)] = argv[index + 1];
  }
  return values;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  const args = parseArgs(process.argv.slice(2));
  const result = prepareQualificationWindow({
    lane: args.lane,
    windowId: args['window-id'],
    windowDate: args['window-date'],
    providerId: args.provider ?? 'codex',
    modelId: args.model,
    reasoningLevel: args.reasoning,
    outDir: args.out
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
