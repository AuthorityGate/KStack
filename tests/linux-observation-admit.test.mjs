import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { admitLinuxObservationCollection } from '../plugins/kstack/scripts/kstack-linux-observation-admit.mjs';

const NOW = '2026-08-30T12:00:00.000Z';
const COLLECTOR = path.resolve('plugins/kstack/workers/kstack-linux-observation-collect.sh');
const ADMIT = path.resolve('plugins/kstack/scripts/kstack-linux-observation-admit.mjs');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function write(root, name, text) {
  fs.writeFileSync(path.join(root, name), text, { mode: 0o600 });
}

function fixture(changes = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-linux-observation-'));
  fs.chmodSync(root, 0o700);
  const values = {
    metadata: [
      'schema=kstack-linux-observation-collection-v1',
      `cellId=${changes.cellId || 'ubuntu-lts-native-x64'}`,
      `collectorSha256=${changes.collectorSha256 || sha256(fs.readFileSync(COLLECTOR))}`,
      `observedAt=${changes.observedAt || '2026-08-30T11:00:00.000Z'}`,
      `expiresAt=${changes.expiresAt || '2026-09-29T11:00:00.000Z'}`
    ].join('\n') + '\n',
    distribution: changes.distribution || [
      'PRETTY_NAME="Ubuntu 24.04.4 LTS"', 'ID=ubuntu', 'VERSION_ID="24.04"', 'ID_LIKE=debian'
    ].join('\n') + '\n',
    kernel: changes.kernel || 'system=Linux\nrelease=6.8.0-134-generic\narchitecture=x86_64\n',
    filesystem: changes.filesystem || 'target=/\nsource=/dev/mapper/ubuntu-root\nfstype=ext4\noptions=rw,relatime\n',
    init: changes.init || 'pid1=systemd\nsystemctlState=running\nsystemctlStatus=0\n',
    manager: changes.manager || 'command=apt\nversion=apt 2.8.3 (amd64)\n'
  };
  write(root, 'metadata.txt', values.metadata);
  write(root, 'distribution.txt', values.distribution);
  write(root, 'kernel.txt', values.kernel);
  write(root, 'filesystem.txt', values.filesystem);
  write(root, 'init.txt', values.init);
  write(root, 'package-manager.txt', values.manager);
  return root;
}

test('byte-opening admission qualifies one exact native Ubuntu observation without promoting lifecycle or backends', () => {
  const admitted = admitLinuxObservationCollection({ root: fixture(), now: NOW });
  assert.equal(admitted.evidence.schema, 'kstack-linux-current-cell-observation-evidence-v1');
  assert.equal(admitted.evidence.cell.cellId, 'ubuntu-lts-native-x64');
  assert.equal(admitted.evidence.cell.environment, 'native');
  assert.equal(admitted.evidence.cell.filesystemNative, true);
  assert.equal(admitted.evidence.evaluation.qualified, true);
  assert.deepEqual(admitted.evidence.sourceEvidence.map(({ name }) => name), [
    'distribution.txt', 'filesystem.txt', 'init.txt', 'kernel.txt', 'metadata.txt', 'package-manager.txt'
  ]);
  assert.equal(Object.hasOwn(admitted.evidence, 'lifecycle'), false);
  assert.equal(Object.hasOwn(admitted.evidence, 'backends'), false);
});

test('collector, target, filesystem, init, package, inventory, and time substitutions fail closed', () => {
  assert.throws(() => admitLinuxObservationCollection({ root: fixture({ collectorSha256: '0'.repeat(64) }), now: NOW }), /KSTACK_LINUX_OBSERVATION_METADATA_INVALID/u);
  assert.throws(() => admitLinuxObservationCollection({ root: fixture({ kernel: 'system=Linux\nrelease=6.8.0-microsoft-standard-WSL2\narchitecture=x86_64\n' }), now: NOW }), /KSTACK_LINUX_OBSERVATION_TARGET_MISMATCH/u);
  assert.throws(() => admitLinuxObservationCollection({ root: fixture({ filesystem: 'target=/tmp\nsource=tmpfs\nfstype=tmpfs\noptions=rw\n' }), now: NOW }), /KSTACK_LINUX_OBSERVATION_FILESYSTEM_NOT_NATIVE/u);
  assert.throws(() => admitLinuxObservationCollection({ root: fixture({ init: 'pid1=bash\nsystemctlState=offline\nsystemctlStatus=1\n' }), now: NOW }), /KSTACK_LINUX_OBSERVATION_INIT_NOT_OPERATIONAL/u);
  assert.throws(() => admitLinuxObservationCollection({ root: fixture({ manager: 'command=dnf\nversion=dnf 4.0\n' }), now: NOW }), /KSTACK_LINUX_OBSERVATION_PACKAGE_INVALID/u);
  const extra = fixture();
  write(extra, 'extra.txt', 'not admitted\n');
  assert.throws(() => admitLinuxObservationCollection({ root: extra, now: NOW }), /KSTACK_LINUX_OBSERVATION_INVENTORY_INVALID/u);
  assert.throws(() => admitLinuxObservationCollection({ root: fixture(), now: '2026-08-30T10:59:59.000Z' }), /KSTACK_LINUX_OBSERVATION_TIME_FUTURE/u);
});

test('CLI writes one private exclusive evidence record', () => {
  const output = path.join(os.tmpdir(), `kstack-linux-native-observation-${crypto.randomUUID()}.json`);
  const observedAt = new Date(Date.now() - 60_000).toISOString();
  const expiresAt = new Date(Date.parse(observedAt) + 30 * 86_400_000).toISOString();
  const first = spawnSync(process.execPath, [ADMIT, 'admit', '--root', fixture({ observedAt, expiresAt }), '--out', output], { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).status, 'QUALIFIED');
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).cell.cellId, 'ubuntu-lts-native-x64');
  assert.equal(fs.statSync(output).mode & 0o777, 0o600);
  const repeated = spawnSync(process.execPath, [ADMIT, 'admit', '--root', fixture({ observedAt, expiresAt }), '--out', output], { encoding: 'utf8' });
  assert.equal(repeated.status, 2);
});
