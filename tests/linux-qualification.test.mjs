import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  evaluateLinuxBackends,
  evaluateLinuxCellObservation,
  evaluateLinuxLifecycle,
  evaluateLinuxQualificationProgram,
  validateLinuxBackendQualification,
  validateLinuxCellObservation,
  validateLinuxLifecycle
} from '../plugins/kstack/scripts/kstack-linux-qualification.mjs';

const NOW = '2026-08-29T18:01:00.000Z';
const D = (character) => character.repeat(64);

function cell(cellId = 'ubuntu-lts-wsl2-x64', overrides = {}) {
  const wsl = cellId.endsWith('wsl2-x64');
  const fedora = cellId.startsWith('fedora');
  const debian = cellId.startsWith('debian');
  return {
    schemaVersion: 1, cellId,
    distributionId: fedora ? 'fedora' : debian ? 'debian' : 'ubuntu',
    distributionVersion: fedora ? 'stable' : debian ? '12' : '24.04',
    distributionFamily: fedora ? 'fedora' : debian ? 'debian' : 'ubuntu', distributionEvidenceDigest: D('0'),
    environment: wsl ? 'wsl2' : 'native', architecture: 'x86_64',
    kernelRelease: wsl ? '6.18.33.2-microsoft-standard-WSL2' : '6.12.0-generic',
    kernelEvidenceDigest: D('1'), filesystemType: 'ext4', filesystemNative: true,
    filesystemEvidenceDigest: D('2'), initSystem: wsl ? 'non-systemd-pid1' : 'systemd',
    initOperational: !wsl, initEvidenceDigest: D('3'), packageManager: fedora ? 'dnf' : 'apt',
    packageManagerEvidenceDigest: D('4'), observedAt: '2026-08-29T18:00:00.000Z',
    expiresAt: '2026-09-28T18:00:00.000Z', ...overrides
  };
}

function lifecycle(cellId = 'ubuntu-lts-wsl2-x64', overrides = {}) {
  return {
    schemaVersion: 1, cellId, sourceVersion: '1.0.0', upgradeVersion: '1.1.0', rollbackVersion: '1.0.0',
    nativeStorage: true,
    steps: ['clean-install', 'host-discovery', 'invocation', 'upgrade', 'rollback', 'health', 'persisted-data-recovery']
      .map((stepId, index) => ({ stepId, outcome: 'PASS', evidenceDigest: String(index + 1).repeat(64), durationMs: index + 1 })),
    persistedStateDigestBefore: D('a'), persistedStateDigestAfter: D('a'),
    observedAt: '2026-08-29T18:00:00.000Z', expiresAt: '2026-09-28T18:00:00.000Z', ...overrides
  };
}

function backends(cellId = 'ubuntu-lts-wsl2-x64', overrides = {}) {
  return {
    schemaVersion: 1, cellId, kernelRelease: '6.18.33.2-microsoft-standard-WSL2',
    effectiveCapabilities: ['CAP_BPF', 'CAP_SYS_ADMIN', 'CAP_SYS_PTRACE'],
    probes: ['cgroup-v2', 'ebpf', 'pidfd'].map((backendId, index) => ({
      backendId, disposition: 'QUALIFIED', featurePresent: true, privilegedExecutionObserved: true,
      evidenceDigest: String(index + 1).repeat(64), limitation: null
    })),
    observedAt: '2026-08-29T18:00:00.000Z', expiresAt: '2026-09-28T18:00:00.000Z', ...overrides
  };
}

test('Linux observation schema is closed, target-bound, and records WSL differences without requiring systemd', () => {
  assert.equal(evaluateLinuxCellObservation(cell(), NOW).qualified, true);
  assert.equal(validateLinuxCellObservation(cell()).initOperational, false);
  assert.throws(() => validateLinuxCellObservation({ ...cell(), surprise: true }), { code: 'KSTACK_LINUX_CELL_INVALID' });
  assert.throws(() => validateLinuxCellObservation(cell('ubuntu-lts-native-x64', { environment: 'wsl2' })), { code: 'KSTACK_LINUX_CELL_INVALID' });
  assert.equal(evaluateLinuxCellObservation(cell(undefined, { filesystemNative: false }), NOW).rejectionCodes[0], 'KSTACK_LINUX_NATIVE_FILESYSTEM_REQUIRED');
});

test('lifecycle requires exact ordered coverage, true version rollback, native storage, and data recovery', () => {
  assert.equal(evaluateLinuxLifecycle(lifecycle(), NOW).qualified, true);
  assert.throws(() => validateLinuxLifecycle({ ...lifecycle(), rollbackVersion: '1.1.0' }), { code: 'KSTACK_LINUX_LIFECYCLE_INVALID' });
  const reordered = structuredClone(lifecycle());
  [reordered.steps[0], reordered.steps[1]] = [reordered.steps[1], reordered.steps[0]];
  assert.throws(() => validateLinuxLifecycle(reordered), { code: 'KSTACK_LINUX_LIFECYCLE_INVALID' });
  assert.deepEqual(evaluateLinuxLifecycle(lifecycle(undefined, {
    nativeStorage: false, persistedStateDigestAfter: D('b'),
    steps: lifecycle().steps.map((step, index) => index === 4 ? { ...step, outcome: 'FAIL' } : step)
  }), NOW).rejectionCodes, [
    'KSTACK_LINUX_LIFECYCLE_NATIVE_STORAGE_REQUIRED',
    'KSTACK_LINUX_LIFECYCLE_STEP_FAILED',
    'KSTACK_LINUX_PERSISTED_DATA_NOT_RECOVERED'
  ]);
});

test('privileged backend qualification cannot be inferred from feature presence or seam tests', () => {
  assert.equal(evaluateLinuxBackends(backends(), NOW).qualified, true);
  const seam = structuredClone(backends());
  seam.probes[1] = { ...seam.probes[1], disposition: 'SEAM_TESTED', privilegedExecutionObserved: false, limitation: 'No CAP_BPF execution target.' };
  const result = evaluateLinuxBackends(seam, NOW);
  assert.equal(result.qualified, false);
  assert.deepEqual(result.seamTestedBackends, ['ebpf']);
  assert.ok(result.rejectionCodes.includes('KSTACK_LINUX_BACKEND_EBPF_NOT_QUALIFIED'));
  const falseClaim = structuredClone(backends());
  falseClaim.probes[0].privilegedExecutionObserved = false;
  assert.throws(() => validateLinuxBackendQualification(falseClaim), { code: 'KSTACK_LINUX_BACKEND_INVALID' });
  assert.throws(() => validateLinuxBackendQualification(backends(undefined, { effectiveCapabilities: [] })), { code: 'KSTACK_LINUX_BACKEND_INVALID' });
});

test('program closure requires exact four-cell coverage in every independent lane', () => {
  const ids = ['debian-stable-native-x64', 'fedora-stable-native-x64', 'ubuntu-lts-native-x64', 'ubuntu-lts-wsl2-x64'];
  const complete = evaluateLinuxQualificationProgram({
    cells: ids.map((id) => cell(id)), lifecycles: ids.map((id) => lifecycle(id)), backends: ids.map((id) => backends(id))
  }, NOW);
  assert.equal(complete.qualified, true);
  assert.match(complete.programDigest, /^[a-f0-9]{64}$/u);
  const onlyCurrentWsl = evaluateLinuxQualificationProgram({ cells: [cell()], lifecycles: [], backends: [] }, NOW);
  assert.equal(onlyCurrentWsl.qualified, false);
  assert.equal(onlyCurrentWsl.matrix.coverageExact, false);
  assert.equal(onlyCurrentWsl.matrix.cells[0].qualified, true);
  assert.equal(onlyCurrentWsl.lifecycle.qualified, false);
  assert.equal(onlyCurrentWsl.privilegedBackends.qualified, false);
});

test('qualification evidence expires and duplicate cells never satisfy exact coverage', () => {
  assert.equal(evaluateLinuxCellObservation(cell(), '2026-09-28T18:00:00.000Z').qualified, false);
  assert.equal(evaluateLinuxLifecycle(lifecycle(), '2026-09-28T18:00:00.000Z').qualified, false);
  assert.equal(evaluateLinuxBackends(backends(), '2026-09-28T18:00:00.000Z').qualified, false);
  const duplicate = evaluateLinuxQualificationProgram({ cells: [cell(), cell()], lifecycles: [], backends: [] }, NOW);
  assert.equal(duplicate.matrix.coverageExact, false);
});

test('retained current WSL2 evidence qualifies one platform cell without promoting privileged backends', () => {
  const retained = JSON.parse(fs.readFileSync(new URL('../.kstack/qualifications/linux-ubuntu-24.04-wsl2-2026-08-29.json', import.meta.url), 'utf8'));
  assert.equal(retained.schema, 'kstack-linux-current-cell-evidence-v1');
  assert.equal(retained.cell.initSystem, 'systemd');
  assert.equal(retained.cell.initOperational, true);
  assert.equal(retained.cell.filesystemType, 'ext4');
  assert.equal(evaluateLinuxCellObservation(retained.cell, '2026-08-29T21:10:00.000Z').qualified, true);
  const backendResult = evaluateLinuxBackends(retained.backends, '2026-08-29T21:10:00.000Z');
  assert.equal(backendResult.qualified, false);
  assert.deepEqual(backendResult.qualifiedBackends, []);
  assert.deepEqual(backendResult.seamTestedBackends, ['cgroup-v2', 'pidfd']);
  assert.ok(backendResult.rejectionCodes.includes('KSTACK_LINUX_BACKEND_EBPF_NOT_QUALIFIED'));
});
