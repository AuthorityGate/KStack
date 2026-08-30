#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { admitKcrpProviderTrialWindowAuthorization } from '../../plugins/kstack/scripts/kstack-kcrp-provider-trial.mjs';
import { runProcess } from '../../plugins/kstack/scripts/kstack-provider-runner.mjs';
import { assertOutboundSecretScan } from '../../plugins/kstack/scripts/kstack-safety-matchers.mjs';
import { recordDigest } from './host-implementation-inventory.mjs';
import { qualificationRunnerDigest } from './kcrp-provider-trial-runner-binding.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const HASH = /^[a-f0-9]{64}$/u;
const RESPONSE_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  required: ['decision', 'confidence', 'requiredFindings', 'decisions', 'deterministicChecks', 'securityFindings', 'unresolvedQuestions'],
  properties: {
    decision: { type: 'string', enum: ['APPROVE', 'REVISE'] },
    confidence: { type: 'integer', minimum: 0, maximum: 100 },
    requiredFindings: { type: 'array', items: { type: 'string' } },
    decisions: { type: 'array', items: { type: 'string' } },
    deterministicChecks: { type: 'array', items: { type: 'string' } },
    securityFindings: { type: 'array', items: { type: 'string' } },
    unresolvedQuestions: { type: 'array', items: { type: 'string' } }
  }
});

function fail(message) {
  const error = new Error(`KSTACK_KCRP_PROVIDER_TRIAL_EXECUTION_INVALID: ${message}`);
  error.code = 'KSTACK_KCRP_PROVIDER_TRIAL_EXECUTION_INVALID';
  throw error;
}

function byteDigest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function readRegular(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('non-regular input');
  return fs.readFileSync(file);
}

function loadPreparedWindow(planFile) {
  const resolvedPlan = path.resolve(planFile);
  const root = path.dirname(resolvedPlan);
  let receipt;
  try { receipt = JSON.parse(readRegular(resolvedPlan).toString('utf8')); }
  catch (error) { if (error?.code === 'KSTACK_KCRP_PROVIDER_TRIAL_EXECUTION_INVALID') throw error; fail('plan JSON'); }
  if (receipt?.schemaVersion !== 1 || receipt?.kind !== 'kstack-kcrp-provider-trial-window-preparation-v1'
      || !receipt.plan || !Array.isArray(receipt.payloadFiles) || receipt.payloadFiles.length !== 60
      || typeof receipt.planDigest !== 'string' || !HASH.test(receipt.planDigest)
      || typeof receipt.authorizationDigest !== 'string' || !HASH.test(receipt.authorizationDigest)
      || receipt.payloadSetDigest !== recordDigest(receipt.payloadFiles)) fail('plan receipt');
  if (receipt.plan.runnerDigest !== qualificationRunnerDigest()) fail('runner binding drift');
  const expected = new Map(receipt.plan.invocations.map((row) => [row.invocationId, row]));
  if (expected.size !== 60 || expected.size !== receipt.payloadFiles.length) fail('invocation inventory');
  const payloads = new Map();
  for (const fileRow of receipt.payloadFiles) {
    const invocation = expected.get(fileRow.invocationId);
    if (!invocation || fileRow.payloadDigest !== invocation.payloadDigest || fileRow.payloadBytes !== invocation.payloadBytes
        || typeof fileRow.relativePath !== 'string' || fileRow.relativePath.includes('\\')) fail('payload binding');
    const file = path.resolve(root, ...fileRow.relativePath.split('/'));
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail('payload path');
    const payload = readRegular(file);
    if (payload.length !== fileRow.payloadBytes || byteDigest(payload) !== fileRow.payloadDigest) fail('payload drift');
    assertOutboundSecretScan(payload, { byteDomain: true });
    payloads.set(fileRow.invocationId, payload);
  }
  const plan = Object.freeze({
    record: receipt.plan,
    planDigest: receipt.planDigest,
    authorizationDigest: receipt.authorizationDigest,
    payloads
  });
  return Object.freeze({ root, receipt, plan });
}

function minimalCodexEnvironment() {
  const env = { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' };
  for (const key of [
    'PATH', 'HOME', 'CODEX_HOME', 'OPENAI_API_KEY', 'TZ', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
    'NODE_EXTRA_CA_CERTS', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'ALL_PROXY', 'TEMP', 'TMP'
  ]) if (typeof process.env[key] === 'string') env[key] = process.env[key];
  return env;
}

function codexArgs(plan, schemaFile, lastMessageFile, workingRoot) {
  if (plan.providerId !== 'codex') fail('unsupported provider');
  return [
    'exec', '--json', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--sandbox', 'read-only',
    '--disable', 'shell_tool', '--disable', 'code_mode_host', '--disable', 'apps',
    '--disable', 'browser_use', '--disable', 'computer_use', '--disable', 'hooks',
    '--disable', 'multi_agent', '--disable', 'skill_search', '--skip-git-repo-check',
    '-C', workingRoot, '--output-schema', schemaFile, '--output-last-message', lastMessageFile,
    '--model', plan.modelId, '-c', `model_reasoning_effort="${plan.reasoningLevel}"`
  ];
}

function parseUsage(stdout) {
  let usage = null;
  for (const line of stdout.split('\n').filter(Boolean)) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event?.type === 'turn.completed' && event.usage) usage = event.usage;
  }
  if (!usage || !Number.isSafeInteger(usage.input_tokens) || usage.input_tokens < 1
      || !Number.isSafeInteger(usage.cached_input_tokens) || usage.cached_input_tokens < 0
      || usage.cached_input_tokens > usage.input_tokens
      || !Number.isSafeInteger(usage.output_tokens) || usage.output_tokens < 0) fail('authenticated usage unavailable');
  return Object.freeze({
    inputTokens: usage.input_tokens,
    rawInputTokens: usage.input_tokens - usage.cached_input_tokens,
    cachedInputTokens: usage.cached_input_tokens,
    outputTokens: usage.output_tokens
  });
}

async function defaultInvoke({ plan, invocation, payloadFile, resultRoot }) {
  const slug = invocation.invocationId.replaceAll(':', '--');
  const stdoutFile = path.join(resultRoot, `${slug}.events.jsonl`);
  const stderrFile = path.join(resultRoot, `${slug}.stderr.log`);
  const lastMessageFile = path.join(resultRoot, `${slug}.response.json`);
  const schemaFile = path.join(resultRoot, 'response-schema.json');
  const result = await runProcess('codex', codexArgs(plan, schemaFile, lastMessageFile, resultRoot), {
    cwd: resultRoot,
    env: minimalCodexEnvironment(),
    stdinFile: payloadFile,
    stdoutFile,
    stderrFile,
    timeoutMs: 30 * 60 * 1000,
    killProcessTree: true
  });
  return { ...result, lastMessageFile, stdoutFile, stderrFile };
}

export async function executePreparedQualificationWindow({
  planFile, authorizationDigest, invoke = defaultInvoke
}) {
  if (typeof planFile !== 'string' || typeof invoke !== 'function') fail('execution arguments');
  const loaded = loadPreparedWindow(planFile);
  admitKcrpProviderTrialWindowAuthorization(loaded.plan, authorizationDigest);
  const resultRoot = path.join(loaded.root, 'results');
  fs.mkdirSync(resultRoot, { recursive: false, mode: 0o700 });
  fs.writeFileSync(path.join(resultRoot, 'response-schema.json'), `${JSON.stringify(RESPONSE_SCHEMA)}\n`, { flag: 'wx', mode: 0o600 });
  const receipts = [];
  for (const invocation of loaded.plan.record.invocations) {
    const payloadFile = path.join(resultRoot, `${invocation.invocationId.replaceAll(':', '--')}.stdin`);
    fs.writeFileSync(payloadFile, loaded.plan.payloads.get(invocation.invocationId), { flag: 'wx', mode: 0o600 });
    const result = await invoke({
      plan: loaded.plan.record,
      invocation,
      payloadFile,
      resultRoot
    });
    if (result?.status !== 'complete') fail(`provider ${invocation.invocationId}`);
    const stdout = typeof result.stdout === 'string' ? result.stdout : '';
    const usage = result.usage ?? parseUsage(stdout);
    const responseBytes = result.lastMessageFile && fs.existsSync(result.lastMessageFile)
      ? readRegular(result.lastMessageFile) : Buffer.from(result.response ?? '', 'utf8');
    if (responseBytes.length < 2) fail(`response ${invocation.invocationId}`);
    let response;
    try { response = JSON.parse(responseBytes.toString('utf8')); } catch { fail(`response JSON ${invocation.invocationId}`); }
    receipts.push({
      invocationId: invocation.invocationId,
      payloadDigest: invocation.payloadDigest,
      status: 'complete',
      startedAt: result.startedAt,
      durationMs: result.durationMs,
      responseDigest: byteDigest(responseBytes),
      response,
      usage,
      stdoutDigest: byteDigest(Buffer.from(stdout, 'utf8')),
      stderrDigest: byteDigest(Buffer.from(result.stderr ?? '', 'utf8'))
    });
  }
  const body = {
    schemaVersion: 1,
    kind: 'kstack-kcrp-provider-trial-window-process-receipt-v1',
    planDigest: loaded.plan.planDigest,
    authorizationDigest,
    lane: loaded.plan.record.lane,
    windowId: loaded.plan.record.windowId,
    windowDate: loaded.plan.record.windowDate,
    providerId: loaded.plan.record.providerId,
    modelId: loaded.plan.record.modelId,
    reasoningLevel: loaded.plan.record.reasoningLevel,
    invocations: receipts
  };
  const receipt = { ...body, processReceiptDigest: recordDigest(body) };
  fs.writeFileSync(path.join(resultRoot, 'process-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return Object.freeze({
    result: 'PROCESS_RECEIPTS_READY_FOR_BLIND_ADJUDICATION',
    resultRoot,
    invocations: receipts.length,
    processReceiptDigest: receipt.processReceiptDigest
  });
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith('--') || argv[index + 1] === undefined) fail('arguments');
    values[argv[index].slice(2)] = argv[index + 1];
  }
  return values;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  const args = parseArgs(process.argv.slice(2));
  executePreparedQualificationWindow({ planFile: args.plan, authorizationDigest: args.authorization })
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
