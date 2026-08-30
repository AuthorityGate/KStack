import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(repositoryRoot, 'plugins', 'kstack');
const runner = path.join(sourceRoot, 'scripts', 'kstack-install-health.mjs');

function cleanEnvironment(overrides = {}) {
  const environment = { ...process.env, ...overrides };
  delete environment.NODE_OPTIONS;
  delete environment.NODE_PATH;
  delete environment.NODE_ICU_DATA;
  return environment;
}

function createNativeRuntime(selectedSource = sourceRoot) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-install-health-test-'));
  for (const name of ['acquisition', 'hooks', 'node_modules', 'packs', 'personas', 'references', 'scripts', 'skills', 'workers']) fs.cpSync(path.join(selectedSource, name), path.join(root, name), { recursive: true });
  for (const name of ['.npmrc', 'install-health-audit-manifest-v1.json', 'install-health-authority-registry-v1.json', 'install-health-contract-v1.json', 'package-lock.json', 'package.json']) fs.copyFileSync(path.join(selectedSource, name), path.join(root, name));
  for (const directory of ['.claude-plugin', '.codex-plugin']) fs.mkdirSync(path.join(root, directory));
  fs.copyFileSync(path.join(selectedSource, '.claude-plugin', 'plugin.json'), path.join(root, '.claude-plugin', 'plugin.json'));
  fs.copyFileSync(path.join(selectedSource, '.codex-plugin', 'plugin.json'), path.join(root, '.codex-plugin', 'plugin.json'));
  const audit = JSON.parse(fs.readFileSync(path.join(root, 'install-health-audit-manifest-v1.json'), 'utf8'));
  for (const entry of audit.entries) {
    const target = path.join(root, entry.path);
    if (fs.existsSync(target)) fs.chmodSync(target, entry.executable ? 0o755 : 0o644);
  }
  for (const args of [
    ['verify-runtime', '--installed-plugin-root', root],
    ['provision-parent', '--installed-plugin-root', root],
    ['invalidate', '--installed-plugin-root', root]
  ]) {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'reflexion', 'unavailable-sentinel.mjs'), ...args], { encoding: 'utf8', env: cleanEnvironment() });
    assert.equal(result.status, 0, result.stderr);
  }
  const generated = spawnSync(process.execPath, [path.join(root, 'scripts', 'kstack-reflexion.mjs'), 'runtime-contract-generate', '--installed-plugin-root', root], { encoding: 'utf8', env: cleanEnvironment() });
  assert.equal(generated.status, 0, generated.stderr);
  return root;
}

function createNonExecutableSourceCheckout(selectedSource = sourceRoot) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-install-health-source-'));
  const audit = JSON.parse(fs.readFileSync(path.join(selectedSource, 'install-health-audit-manifest-v1.json'), 'utf8'));
  for (const entry of audit.entries) {
    const target = path.join(root, entry.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(selectedSource, entry.path), target);
    fs.chmodSync(target, 0o644);
  }
  fs.copyFileSync(path.join(selectedSource, 'install-health-audit-manifest-v1.json'), path.join(root, 'install-health-audit-manifest-v1.json'));
  return root;
}

function runHealth(root, extra = [], environment = {}, selectedSource = sourceRoot) {
  const args = [
    runner,
    '--source-root', selectedSource,
    '--host', 'claude',
    '--scope', 'user',
    '--mode', 'symlink',
    '--changed-state', 'true',
    '--root', 'execution-root', root, 'admitted', 'execution',
    '--surface', 'claude-filesystem', 'claude', path.join(root, 'skills'), root, 'plugin',
    ...extra
  ];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', env: cleanEnvironment(environment), timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
  const line = result.stdout.split('\n').find((item) => item.startsWith('KSTACK_POST_DEPLOY_HEALTH_V1 '));
  assert.ok(line, `missing health record: ${result.stdout}\n${result.stderr}`);
  return { result, health: JSON.parse(line.slice('KSTACK_POST_DEPLOY_HEALTH_V1 '.length)) };
}

function byteSort(left, right) { return Buffer.compare(Buffer.from(left), Buffer.from(right)); }
function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string' || Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort(byteSort).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function canonicalBytes(value) { return Buffer.from(`${canonical(value)}\n`); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function signingTranscript(tag, object, requestSha256 = null) {
  const body = canonicalBytes(object);
  const bodyLength = Buffer.alloc(8); bodyLength.writeBigUInt64BE(BigInt(body.length));
  if (!requestSha256) return Buffer.concat([Buffer.from(tag), bodyLength, body]);
  const digestLength = Buffer.alloc(8); digestLength.writeBigUInt64BE(32n);
  return Buffer.concat([Buffer.from(tag), digestLength, Buffer.from(requestSha256, 'hex'), bodyLength, body]);
}
function rawPublicKeyBase64(publicKey) { return Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64'); }
function signRequest(unsigned, privateKey) {
  return { ...unsigned, requesterSig: crypto.sign(null, signingTranscript('KSTACK-ED25519-REQUEST-V1\n', unsigned), privateKey).toString('base64') };
}
function signApproval(request, approverPrincipalId, privateKey) {
  const requestSha256 = sha256(canonicalBytes(request));
  const unsigned = { schema: 'override-approval-v1', requestSha256, approverPrincipalId };
  return { requestSha256, approval: { ...unsigned, approverSig: crypto.sign(null, signingTranscript('KSTACK-ED25519-APPROVAL-V1\n', unsigned, requestSha256), privateKey).toString('base64') } };
}
function writeOverridePair(directory, label, request, approval) {
  const requestFile = path.join(directory, `${label}-request.json`);
  const approvalFile = path.join(directory, `${label}-approval.json`);
  fs.writeFileSync(requestFile, canonicalBytes(request), { mode: 0o600 });
  fs.writeFileSync(approvalFile, canonicalBytes(approval), { mode: 0o600 });
  return ['--override-request', requestFile, '--override-approval', approvalFile];
}

test('the central contract and source audit are bound without manifest self-reference', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'install-health-contract-v1.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'install-health-audit-manifest-v1.json'), 'utf8'));
  assert.equal(contract.contractId, 'kstack-install-health-contract-v1');
  assert.deepEqual(contract.probes.map((probe) => probe.probeId), [...contract.probes.map((probe) => probe.probeId)].sort());
  assert.equal(manifest.sourceAuditManifestSha256, null);
  assert.equal(manifest.entries.some((entry) => entry.path === 'install-health-audit-manifest-v1.json'), false);
  assert.equal(manifest.entries.some((entry) => entry.path === 'scripts/kstack-install-health.mjs'), true);
  assert.equal(manifest.entries.some((entry) => entry.path === 'install-health-contract-v1.json'), true);
  assert.equal(manifest.entries.some((entry) => entry.path === 'package-lock.json'), true);
  const current = spawnSync(process.execPath, [path.join(repositoryRoot, 'tests', 'helpers', 'generate-install-health-audit-manifest.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(current.status, 0, current.stderr);
});

test('installed probes execute, e108a79-class missing contract fails, and unavailable Reflexion is loud degraded', { timeout: 60_000 }, () => {
  const sourceCheckout = createNonExecutableSourceCheckout();
  const runtime = createNativeRuntime();
  try {
    const healthy = runHealth(runtime, [], {}, sourceCheckout);
    assert.equal(healthy.result.status, 0, JSON.stringify(healthy.health.diagnostics));
    assert.equal(healthy.health.overallStatus, 'PASS');
    assert.equal(healthy.health.interactiveActivationTested, false);
    assert.equal(healthy.health.activationClaim, 'installed-files-paths-lookups-structurally-sound-v1');
    assert.equal(healthy.health.roots[0].executedProbeCount, 11);
    assert.deepEqual(healthy.health.roots[0].probeResults.map((probe) => probe.outcome), Array(11).fill('PASS'));

    const installedScript = path.join(runtime, 'scripts', 'kstack-config.mjs');
    fs.chmodSync(installedScript, 0o644);
    const missingExecute = runHealth(runtime, [], {}, sourceCheckout);
    assert.equal(missingExecute.result.status, 1);
    assert.ok(missingExecute.health.diagnostics.some((item) => item.code === 'KSTACK_POST_DEPLOY_INSTALLED_ROOT_DIVERGENT' && item.blocking === true));
    fs.chmodSync(installedScript, 0o755);

    const installedMetadata = path.join(runtime, 'package.json');
    fs.chmodSync(installedMetadata, 0o755);
    const unexpectedExecute = runHealth(runtime, [], {}, sourceCheckout);
    assert.equal(unexpectedExecute.result.status, 1);
    assert.ok(unexpectedExecute.health.diagnostics.some((item) => item.code === 'KSTACK_POST_DEPLOY_INSTALLED_ROOT_DIVERGENT' && item.blocking === true));
    fs.chmodSync(installedMetadata, 0o644);

    const fakeBin = fs.mkdtempSync(path.join(runtime, 'codex-json-'));
    const fakeCodex = path.join(fakeBin, 'codex');
    fs.writeFileSync(fakeCodex, '#!/bin/sh\ncase "$*" in\n  --version) printf "codex-cli 0.149.0\\n" ;;\n  *) printf "{malformed\\n" ;;\nesac\n', { mode: 0o700 });
    const jsonDegraded = runHealth(runtime, ['--modern-codex'], { PATH: `${fakeBin}:${process.env.PATH}` }, sourceCheckout);
    assert.equal(jsonDegraded.result.status, 0);
    assert.equal(jsonDegraded.health.overallStatus, 'DEGRADED');
    assert.ok(jsonDegraded.health.diagnostics.some((item) => item.tier === 'third-party-codex' && item.blocking === false));

    fs.unlinkSync(path.join(runtime, '.codex-plugin', 'reflexion-runtime-contract-v1.txt'));
    const incident = runHealth(runtime, [], {}, sourceCheckout);
    assert.equal(incident.result.status, 1);
    assert.equal(incident.health.overallStatus, 'FAILED');
    assert.ok(incident.health.diagnostics.some((item) => item.code === 'KSTACK_POST_DEPLOY_REFLEXION_CONTRACT_MISSING' && item.blocking === true));
    assert.match(incident.result.stderr, /KSTACK_POST_DEPLOY_MANUAL_RECOVERY_REQUIRED/u);

    const unavailable = spawnSync(process.execPath, [path.join(runtime, 'scripts', 'reflexion', 'unavailable-sentinel.mjs'), 'invalidate', '--installed-plugin-root', runtime], { encoding: 'utf8', env: cleanEnvironment() });
    assert.equal(unavailable.status, 0, unavailable.stderr);
    const degradedArgs = [runner, '--source-root', sourceCheckout, '--host', 'claude', '--scope', 'user', '--mode', 'symlink', '--changed-state', 'true', '--root', 'execution-root', runtime, 'unavailable', 'execution', '--surface', 'claude-filesystem', 'claude', path.join(runtime, 'skills'), runtime, 'plugin'];
    const degradedResult = spawnSync(process.execPath, degradedArgs, { encoding: 'utf8', env: cleanEnvironment(), timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    const degradedLine = degradedResult.stdout.split('\n').find((item) => item.startsWith('KSTACK_POST_DEPLOY_HEALTH_V1 '));
    const degraded = JSON.parse(degradedLine.slice('KSTACK_POST_DEPLOY_HEALTH_V1 '.length));
    assert.equal(degradedResult.status, 0);
    assert.equal(degraded.overallStatus, 'DEGRADED');
    assert.equal(degraded.roots[0].executedProbeCount, 10);
    assert.ok(degraded.roots[0].probeResults.some((probe) => probe.code === 'KSTACK_POST_DEPLOY_REFLEXION_UNAVAILABLE' && probe.outcome === 'SKIPPED_UNAVAILABLE' && probe.launched === false));
  } finally {
    fs.rmSync(runtime, { recursive: true, force: true });
    fs.rmSync(sourceCheckout, { recursive: true, force: true });
  }
});

test('a hung installed import is individually bounded and remains blocking', { timeout: 60_000 }, () => {
  const runtime = createNativeRuntime();
  try {
    fs.appendFileSync(path.join(runtime, 'scripts', 'kstack-jira.mjs'), '\nsetInterval(() => {}, 1_000);\n');
    const regenerated = spawnSync(process.execPath, [path.join(repositoryRoot, 'tests', 'helpers', 'generate-install-health-audit-manifest.mjs'), '--plugin-root', runtime], { encoding: 'utf8', env: cleanEnvironment() });
    assert.equal(regenerated.status, 0, regenerated.stderr);
    const started = Date.now();
    const timedOut = runHealth(runtime, [], {}, runtime);
    assert.ok(Date.now() - started < 15_000);
    assert.equal(timedOut.result.status, 1);
    assert.equal(timedOut.health.overallStatus, 'FAILED');
    assert.ok(timedOut.health.diagnostics.some((item) => item.code === 'KSTACK_POST_DEPLOY_IMPORT_TIMEOUT' && item.blocking === true));
  } finally {
    fs.rmSync(runtime, { recursive: true, force: true });
  }
});

test('override signatures enforce expiry, target binding, distinct identities, and capped replay', { timeout: 120_000 }, () => {
  const runtime = createNativeRuntime();
  const stateHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-install-health-state-'));
  try {
    const requester = crypto.generateKeyPairSync('ed25519');
    const approver = crypto.generateKeyPairSync('ed25519');
    const registry = {
      schema: 'kstack-install-health-authority-registry-v1',
      principals: [
        { principalId: 'approver-a', publicKeyBase64: rawPublicKeyBase64(approver.publicKey), roles: ['approver', 'requester'] },
        { principalId: 'requester-a', publicKeyBase64: rawPublicKeyBase64(requester.publicKey), roles: ['requester'] }
      ]
    };
    fs.writeFileSync(path.join(runtime, 'install-health-authority-registry-v1.json'), `${JSON.stringify(registry, null, 2)}\n`);
    fs.appendFileSync(path.join(runtime, 'scripts', 'kstack-jira.mjs'), '\nthrow new Error("controlled install-health import failure");\n');
    const regenerated = spawnSync(process.execPath, [path.join(repositoryRoot, 'tests', 'helpers', 'generate-install-health-audit-manifest.mjs'), '--plugin-root', runtime], { encoding: 'utf8', env: cleanEnvironment() });
    assert.equal(regenerated.status, 0, regenerated.stderr);

    const environment = { XDG_STATE_HOME: stateHome };
    const failed = runHealth(runtime, [], environment, runtime);
    assert.equal(failed.result.status, 1);
    assert.equal(failed.health.overallStatus, 'FAILED');
    assert.ok(failed.health.diagnostics.some((item) => item.code === 'KSTACK_POST_DEPLOY_IMPORT_FAILED'));

    const overrideDirectory = path.join(stateHome, 'kstack', 'install-health-overrides-v1');
    const contextFile = fs.readdirSync(overrideDirectory).find((name) => name.startsWith('context-'));
    const exported = JSON.parse(fs.readFileSync(path.join(overrideDirectory, contextFile), 'utf8'));
    const issuedAt = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().replace('.000Z', 'Z');
    const expiresAt = new Date(Date.parse(issuedAt) + 60 * 60 * 1000).toISOString().replace('.000Z', 'Z');
    const requestUnsigned = {
      schema: 'override-request-v1',
      overrideContextDigestV1: exported.overrideContextDigestV1,
      approvedFailureSubjects: exported.overrideRequestContext.failureSubjects,
      reasonCode: 'NON_REFLEXION_IMPORT_FALSE_POSITIVE',
      requestNonce: crypto.randomBytes(16).toString('hex'),
      issuedAt,
      expiresAt,
      requesterPrincipalId: 'requester-a'
    };
    const request = signRequest(requestUnsigned, requester.privateKey);
    const { requestSha256, approval } = signApproval(request, 'approver-a', approver.privateKey);
    const overrideArgs = writeOverridePair(stateHome, 'valid', request, approval);

    const singlePartyUnsigned = { ...requestUnsigned, requestNonce: crypto.randomBytes(16).toString('hex'), requesterPrincipalId: 'approver-a' };
    const singlePartyRequest = signRequest(singlePartyUnsigned, approver.privateKey);
    const singlePartyApproval = signApproval(singlePartyRequest, 'approver-a', approver.privateKey).approval;
    const singleParty = runHealth(runtime, writeOverridePair(stateHome, 'single-party', singlePartyRequest, singlePartyApproval), environment, runtime);
    assert.equal(singleParty.result.status, 1);
    assert.ok(singleParty.health.diagnostics.some((item) => item.code === 'HC_OVERRIDE_NOT_APPLICABLE' && item.blocking === true));

    const expiredAt = new Date(Date.parse(issuedAt) - 60_000).toISOString().replace('.000Z', 'Z');
    const expiredIssuedAt = new Date(Date.parse(expiredAt) - 60_000).toISOString().replace('.000Z', 'Z');
    const expiredUnsigned = { ...requestUnsigned, requestNonce: crypto.randomBytes(16).toString('hex'), issuedAt: expiredIssuedAt, expiresAt: expiredAt };
    const expiredRequest = signRequest(expiredUnsigned, requester.privateKey);
    const expiredApproval = signApproval(expiredRequest, 'approver-a', approver.privateKey).approval;
    const expired = runHealth(runtime, writeOverridePair(stateHome, 'expired', expiredRequest, expiredApproval), environment, runtime);
    assert.equal(expired.result.status, 1);
    assert.ok(expired.health.diagnostics.some((item) => item.code === 'HC_OVERRIDE_NOT_APPLICABLE' && item.blocking === true));

    const overridden = runHealth(runtime, overrideArgs, environment, runtime);
    assert.equal(overridden.result.status, 0);
    assert.equal(overridden.health.overallStatus, 'DEGRADED_OVERRIDE');
    assert.equal(overridden.health.override.used, true);
    assert.ok(overridden.health.diagnostics.some((item) => item.code === 'KSTACK_POST_DEPLOY_IMPORT_FAILED' && item.overridden === true));
    const auditFile = fs.readdirSync(overrideDirectory).find((name) => name.startsWith(`use-${requestSha256}-`));
    const audit = JSON.parse(fs.readFileSync(path.join(overrideDirectory, auditFile), 'utf8'));
    assert.equal(audit.requesterPrincipalId, 'requester-a');
    assert.equal(audit.approverPrincipalId, 'approver-a');
    assert.equal(audit.outcome, 'DEGRADED_OVERRIDE');

    const retargeted = runHealth(runtime, [...overrideArgs, '--surface', 'second-target', 'claude', path.join(runtime, 'skills'), runtime, 'plugin'], environment, runtime);
    assert.equal(retargeted.result.status, 1);
    assert.ok(retargeted.health.diagnostics.some((item) => item.code === 'HC_OVERRIDE_NOT_APPLICABLE' && item.blocking === true));

    for (const expectedUse of [2, 3]) {
      const replay = runHealth(runtime, overrideArgs, environment, runtime);
      assert.equal(replay.result.status, 0);
      assert.equal(replay.health.overallStatus, 'DEGRADED_OVERRIDE');
      assert.equal(replay.health.override.auditRef, `audit:${requestSha256}:${expectedUse}`);
    }
    const exhausted = runHealth(runtime, overrideArgs, environment, runtime);
    assert.equal(exhausted.result.status, 1);
    assert.ok(exhausted.health.diagnostics.some((item) => item.code === 'HC_OVERRIDE_MAX_USES' && item.blocking === true));
    assert.equal(fs.readdirSync(overrideDirectory).filter((name) => name.startsWith(`use-${requestSha256}-`)).length, 3);
  } finally {
    fs.rmSync(runtime, { recursive: true, force: true });
    fs.rmSync(stateHome, { recursive: true, force: true });
  }
});
