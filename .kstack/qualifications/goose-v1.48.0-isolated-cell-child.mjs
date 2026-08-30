import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildGooseInvocation,
  observeGooseExecution
} from '../../plugins/kstack/scripts/kstack-goose-adapter.mjs';

const [binaryPath] = process.argv.slice(2);
if (!binaryPath || !path.isAbsolute(binaryPath)) throw new Error('absolute Goose binary path required');

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])])) : value;
const recordDigest = (value) => sha256(JSON.stringify(canonical(value)));
const fileDigest = (relative) => sha256(fs.readFileSync(path.join(sourceRoot, relative)));

function tree(root) {
  const rows = [];
  const walk = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => compare(a.name, b.name))) {
      const full = path.join(directory, entry.name);
      const relative = path.relative(root, full).split(path.sep).join('/');
      const stat = fs.lstatSync(full);
      if (entry.isSymbolicLink()) rows.push({ path: relative, type: 'symlink', target: fs.readlinkSync(full), mode: stat.mode & 0o777 });
      else if (entry.isDirectory()) { rows.push({ path: relative, type: 'directory', mode: stat.mode & 0o777 }); walk(full); }
      else if (entry.isFile()) rows.push({ path: relative, type: 'file', sha256: sha256(fs.readFileSync(full)), bytes: stat.size, mode: stat.mode & 0o777 });
      else rows.push({ path: relative, type: 'other', mode: stat.mode & 0o777 });
    }
  };
  walk(root);
  return { rows, digest: recordDigest(rows) };
}

execFileSync('/usr/sbin/ip', ['link', 'set', 'lo', 'up'], { stdio: 'ignore' });
const interfaces = fs.readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2)
  .map((line) => line.split(':')[0].trim()).filter(Boolean).sort(compare);
const loopbackOnly = interfaces.length === 1 && interfaces[0] === 'lo';

const cellRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-goose-cell-'));
const repositoryRoot = path.join(cellRoot, 'repository');
const pathRoot = path.join(cellRoot, 'path-root');
fs.mkdirSync(path.join(repositoryRoot, '.agents', 'skills', 'kstack-advisory'), { recursive: true, mode: 0o700 });
fs.mkdirSync(path.join(pathRoot, 'home'), { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(repositoryRoot, '.agents', 'skills', 'kstack-advisory', 'SKILL.md'), `---\nname: kstack-advisory\ndescription: Bounded public-read advisory qualification marker.\n---\n\nKSTACK_GOOSE_SKILL_PROJECTION_V1\n`, { mode: 0o600 });
const repositoryBefore = tree(repositoryRoot);
const binarySha256 = sha256(fs.readFileSync(binaryPath));
if (binarySha256 !== '057a1788b48cc1452203920afd31eac274d5b9cb10026734d587e5db33885792') throw new Error('qualified Goose binary digest mismatch');

const requestLogPath = path.join(cellRoot, 'provider-requests.jsonl');
fs.writeFileSync(requestLogPath, '', { mode: 0o600 });
const providerScript = fileURLToPath(new URL('./goose-v1.48.0-synthetic-provider.mjs', import.meta.url));
const provider = spawn(process.execPath, [providerScript, requestLogPath], {
  cwd: cellRoot,
  env: { HOME: cellRoot, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', PATH: '/usr/bin:/bin', TZ: 'UTC' },
  stdio: ['ignore', 'pipe', 'pipe']
});
const endpoint = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('synthetic provider readiness timeout')), 5_000);
  let stdout = '';
  provider.once('error', reject);
  provider.stdout.on('data', (chunk) => {
    stdout += chunk.toString('utf8');
    const match = stdout.match(/READY (http:\/\/127\.0\.0\.1:[0-9]+)\n/u);
    if (match) { clearTimeout(timeout); resolve(match[1]); }
  });
});
const readProviderRequests = () => fs.readFileSync(requestLogPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));

const definitions = [
  ['VERSION', '1.48.0', null],
  ['HELP', 'Execute commands from an instruction file or stdin', null],
  ['SKILLS_LIST', 'kstack-advisory', null],
  ['ADVISORY', 'KSTACK_GOOSE_ADVISORY_OK', sha256('kstack-goose-synthetic-loopback-broker-ticket-v1')]
];
const observations = [];
for (const [action, expectedMarker, brokerTicketDigest] of definitions) {
  const operation = {
    schemaVersion: 1,
    operationId: `goose.${action.toLowerCase()}.isolated.v1`,
    action,
    binaryPath,
    binarySha256,
    repositoryRoot,
    pathRoot,
    inputDigest: sha256(`${action}\n${expectedMarker}\n`),
    expectedMarker,
    brokerTicketDigest,
    deadlineMs: action === 'ADVISORY' ? 60_000 : 20_000
  };
  const invocation = buildGooseInvocation(operation, { loopbackEndpoint: action === 'ADVISORY' ? endpoint : null, verifyBinary: true });
  const requestStart = readProviderRequests().length;
  const result = spawnSync('/usr/bin/prlimit', [
    '--cpu=60', '--as=4294967296', '--nproc=64', '--nofile=256',
    '/usr/bin/setpriv', '--no-new-privs', '--inh-caps=-all', '--ambient-caps=-all', '--bounding-set=-all', '--',
    invocation.command, ...invocation.args
  ], {
    cwd: invocation.cwd,
    env: invocation.env,
    input: invocation.stdin,
    encoding: 'utf8',
    timeout: invocation.deadlineMs,
    maxBuffer: 4 * 1024 * 1024,
    killSignal: 'SIGKILL',
    windowsHide: true
  });
  const requests = readProviderRequests().slice(requestStart);
  const repositoryAfterOperation = tree(repositoryRoot);
  if (repositoryAfterOperation.digest !== repositoryBefore.digest) throw new Error(`${action} mutated repository root`);
  const pathRootAfter = tree(pathRoot);
  const numericProcesses = fs.readdirSync('/proc').filter((name) => /^[0-9]+$/u.test(name));
  const orphanCount = numericProcesses.filter((name) => ![1, process.pid, provider.pid].includes(Number(name))).length;
  const observed = observeGooseExecution(operation, {
    exitCode: Number.isInteger(result.status) ? result.status : null,
    signal: result.signal,
    timedOut: result.error?.code === 'ETIMEDOUT',
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    providerRequestCount: requests.length,
    providerRequestDigest: requests.length ? recordDigest(requests) : null,
    loopbackOnly,
    rootMutationDigest: recordDigest({ repositoryBefore: repositoryBefore.digest, repositoryAfter: repositoryAfterOperation.digest, pathRootAfter: pathRootAfter.digest }),
    orphanCount
  });
  observations.push({ operation, invocationDigest: invocation.invocationDigest, ...observed });
}

provider.kill('SIGTERM');
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { provider.kill('SIGKILL'); reject(new Error('synthetic provider did not exit')); }, 5_000);
  provider.once('close', () => { clearTimeout(timeout); resolve(); });
});
const providerRequests = readProviderRequests();
const repositoryAfter = tree(repositoryRoot);
const pathRootAfter = tree(pathRoot);
const result = {
  schema: 'kstack-goose-v1.48.0-isolated-cell-v1',
  binarySha256,
  bindings: {
    adapterDigest: fileDigest('plugins/kstack/scripts/kstack-goose-adapter.mjs'),
    providerScriptDigest: fileDigest('.kstack/qualifications/goose-v1.48.0-synthetic-provider.mjs'),
    childHarnessDigest: fileDigest('.kstack/qualifications/goose-v1.48.0-isolated-cell-child.mjs'),
    pid1ReaperSourceDigest: fileDigest('.kstack/qualifications/kstack-pid1-reaper.c'),
    installManifestDigest: fileDigest('plugins/kstack/install-health-audit-manifest-v1.json'),
    supplyChainEvidenceDigest: fileDigest('.kstack/qualifications/goose-v1.48.0-supply-chain-2026-08-29.md')
  },
  interfaces,
  loopbackOnly,
  repositoryBeforeDigest: repositoryBefore.digest,
  repositoryAfterDigest: repositoryAfter.digest,
  pathRootAfterDigest: pathRootAfter.digest,
  pathRootEntries: pathRootAfter.rows.map((entry) => entry.path),
  providerRequestCount: providerRequests.length,
  providerRequestDigest: recordDigest(providerRequests),
  observations: observations.map(({ structuredOutput: _structuredOutput, ...entry }) => entry),
  aggregate: observations.every((entry) => entry.observation.nativeOutcome === 'MATCH')
    && repositoryBefore.digest === repositoryAfter.digest && loopbackOnly ? 'PASS' : 'FAIL'
};
result.evidenceDigest = recordDigest(result);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
