import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  admitLinuxQualificationBundle,
  linuxQualificationCanonicalBytes
} from '../plugins/kstack/scripts/kstack-linux-qualification-bundle.mjs';

const NOW = '2026-08-30T06:30:00.000Z';
const CELL_IDS = [
  'debian-stable-native-x64', 'fedora-stable-native-x64',
  'ubuntu-lts-native-x64', 'ubuntu-lts-wsl2-x64'
];
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function write(root, relativePath, bytes) {
  const file = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, bytes, { mode: 0o600 });
  return { path: relativePath, sha256: sha256(bytes) };
}

function artifact(root, cellId, label) {
  const bytes = Buffer.from(`KStack Linux qualification evidence\ncell=${cellId}\nkind=${label}\n`, 'utf8');
  return write(root, `evidence/${cellId}/${label}.txt`, bytes);
}

function buildCell(root, cellId) {
  const wsl = cellId.endsWith('wsl2-x64');
  const fedora = cellId.startsWith('fedora');
  const debian = cellId.startsWith('debian');
  const artifacts = new Map();
  for (const label of [
    'backend-cgroup', 'backend-ebpf', 'backend-pidfd', 'distribution', 'filesystem', 'init', 'kernel',
    'lifecycle-clean-install', 'lifecycle-health', 'lifecycle-host-discovery', 'lifecycle-invocation',
    'lifecycle-persisted-data-recovery', 'lifecycle-rollback', 'lifecycle-upgrade', 'package-manager', 'persisted-state'
  ]) artifacts.set(label, artifact(root, cellId, label));
  const observation = {
    schemaVersion: 1, cellId,
    distributionId: fedora ? 'fedora' : debian ? 'debian' : 'ubuntu',
    distributionVersion: fedora ? 'stable' : debian ? '12' : '24.04',
    distributionFamily: fedora ? 'fedora' : debian ? 'debian' : 'ubuntu',
    distributionEvidenceDigest: artifacts.get('distribution').sha256,
    environment: wsl ? 'wsl2' : 'native', architecture: 'x86_64',
    kernelRelease: wsl ? '6.18.33.2-microsoft-standard-WSL2' : '6.12.0-generic',
    kernelEvidenceDigest: artifacts.get('kernel').sha256,
    filesystemType: 'ext4', filesystemNative: true,
    filesystemEvidenceDigest: artifacts.get('filesystem').sha256,
    initSystem: 'systemd', initOperational: true,
    initEvidenceDigest: artifacts.get('init').sha256,
    packageManager: fedora ? 'dnf' : 'apt',
    packageManagerEvidenceDigest: artifacts.get('package-manager').sha256,
    observedAt: '2026-08-30T06:00:00.000Z', expiresAt: '2026-09-29T06:00:00.000Z'
  };
  const stepLabels = [
    ['clean-install', 'lifecycle-clean-install'], ['host-discovery', 'lifecycle-host-discovery'],
    ['invocation', 'lifecycle-invocation'], ['upgrade', 'lifecycle-upgrade'],
    ['rollback', 'lifecycle-rollback'], ['health', 'lifecycle-health'],
    ['persisted-data-recovery', 'lifecycle-persisted-data-recovery']
  ];
  const lifecycle = {
    schemaVersion: 1, cellId, sourceVersion: '1.0.0', upgradeVersion: '1.1.0', rollbackVersion: '1.0.0',
    nativeStorage: true,
    steps: stepLabels.map(([stepId, label], index) => ({
      stepId, outcome: 'PASS', evidenceDigest: artifacts.get(label).sha256, durationMs: index + 1
    })),
    persistedStateDigestBefore: artifacts.get('persisted-state').sha256,
    persistedStateDigestAfter: artifacts.get('persisted-state').sha256,
    observedAt: '2026-08-30T06:00:00.000Z', expiresAt: '2026-09-29T06:00:00.000Z'
  };
  const backends = {
    schemaVersion: 1, cellId, kernelRelease: observation.kernelRelease,
    effectiveCapabilities: ['CAP_BPF', 'CAP_SYS_ADMIN', 'CAP_SYS_PTRACE'],
    probes: [
      ['cgroup-v2', 'backend-cgroup'], ['ebpf', 'backend-ebpf'], ['pidfd', 'backend-pidfd']
    ].map(([backendId, label]) => ({
      backendId, disposition: 'QUALIFIED', featurePresent: true,
      privilegedExecutionObserved: true, evidenceDigest: artifacts.get(label).sha256, limitation: null
    })),
    observedAt: '2026-08-30T06:00:00.000Z', expiresAt: '2026-09-29T06:00:00.000Z'
  };
  return {
    cellId,
    observation: write(root, `records/${cellId}/observation.json`, linuxQualificationCanonicalBytes(observation)),
    lifecycle: write(root, `records/${cellId}/lifecycle.json`, linuxQualificationCanonicalBytes(lifecycle)),
    backends: write(root, `records/${cellId}/backends.json`, linuxQualificationCanonicalBytes(backends)),
    artifacts: [...artifacts.values()].sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)))
  };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-linux-bundle-'));
  fs.chmodSync(root, 0o700);
  const manifest = {
    schema: 'kstack-linux-qualification-bundle-v1',
    generatedAt: '2026-08-30T06:20:00.000Z',
    cells: CELL_IDS.map((cellId) => buildCell(root, cellId))
  };
  fs.writeFileSync(path.join(root, 'manifest.json'), linuxQualificationCanonicalBytes(manifest), { mode: 0o600 });
  return root;
}

test('exact external evidence bundle qualifies all four Linux matrix, lifecycle, and privileged-backend cells', () => {
  const root = fixture();
  const first = admitLinuxQualificationBundle({ root, now: NOW, observedAt: NOW });
  const second = admitLinuxQualificationBundle({ root, now: NOW, observedAt: NOW });
  assert.deepEqual(first.receipt, second.receipt);
  assert.equal(first.receipt.qualified, true);
  assert.deepEqual(first.receipt.coverage, { lifecycle: true, matrix: true, privilegedBackends: true });
  assert.equal(first.receipt.cells.length, 4);
  assert.equal(first.receipt.cells.every(({ evidenceArtifacts }) => evidenceArtifacts === 16), true);
  assert.match(first.receipt.receiptSha256, /^[a-f0-9]{64}$/u);
});

test('artifact drift, unreferenced evidence, symlinks, record failure, and future evaluation fail closed', () => {
  const drift = fixture();
  fs.appendFileSync(path.join(drift, 'evidence/debian-stable-native-x64/kernel.txt'), 'drift\n');
  assert.throws(() => admitLinuxQualificationBundle({ root: drift, now: NOW, observedAt: NOW }), /KSTACK_LINUX_BUNDLE_ARTIFACT_DRIFT/u);

  const extra = fixture();
  fs.writeFileSync(path.join(extra, 'notes.txt'), 'not admitted\n', { mode: 0o600 });
  assert.throws(() => admitLinuxQualificationBundle({ root: extra, now: NOW, observedAt: NOW }), /KSTACK_LINUX_BUNDLE_INVENTORY_INVALID/u);

  const linked = fixture();
  fs.symlinkSync(path.join(linked, 'evidence/debian-stable-native-x64/kernel.txt'), path.join(linked, 'linked.txt'));
  assert.throws(() => admitLinuxQualificationBundle({ root: linked, now: NOW, observedAt: NOW }), /KSTACK_LINUX_BUNDLE_INVENTORY_INVALID/u);

  const failed = fixture();
  const lifecycleFile = path.join(failed, 'records/debian-stable-native-x64/lifecycle.json');
  const lifecycle = JSON.parse(fs.readFileSync(lifecycleFile, 'utf8'));
  lifecycle.steps[0].outcome = 'FAIL';
  fs.writeFileSync(lifecycleFile, linuxQualificationCanonicalBytes(lifecycle), { mode: 0o600 });
  const manifestFile = path.join(failed, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.cells[0].lifecycle.sha256 = sha256(fs.readFileSync(lifecycleFile));
  fs.writeFileSync(manifestFile, linuxQualificationCanonicalBytes(manifest), { mode: 0o600 });
  assert.throws(() => admitLinuxQualificationBundle({ root: failed, now: NOW, observedAt: NOW }), /KSTACK_LINUX_BUNDLE_NOT_QUALIFIED/u);

  assert.throws(
    () => admitLinuxQualificationBundle({ root: fixture(), now: '2026-08-30T06:31:00.000Z', observedAt: NOW }),
    /KSTACK_LINUX_BUNDLE_TIME_FUTURE/u
  );
});

test('CLI writes one exclusive private receipt outside the exact bundle and refuses an in-bundle output', () => {
  const root = fixture();
  const output = path.join(os.tmpdir(), `kstack-linux-receipt-${crypto.randomUUID()}.json`);
  const script = path.resolve('plugins/kstack/scripts/kstack-linux-qualification-bundle.mjs');
  const accepted = spawnSync(process.execPath, [script, 'admit', '--root', root, '--out', output], { encoding: 'utf8' });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(JSON.parse(accepted.stdout).status, 'QUALIFIED');
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).qualified, true);
  assert.equal(fs.statSync(output).mode & 0o777, 0o600);
  const repeated = spawnSync(process.execPath, [script, 'admit', '--root', root, '--out', output], { encoding: 'utf8' });
  assert.equal(repeated.status, 2);
  const inside = spawnSync(process.execPath, [script, 'admit', '--root', root, '--out', path.join(root, 'receipt.json')], { encoding: 'utf8' });
  assert.equal(inside.status, 2);
  assert.match(inside.stderr, /KSTACK_LINUX_BUNDLE_ARGUMENT_INVALID/u);
});
