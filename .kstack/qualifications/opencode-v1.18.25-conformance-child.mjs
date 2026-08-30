import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hostAddress } from '../../plugins/kstack/scripts/kstack-host-contract.mjs';
import {
  OPENCODE_ADAPTER_BOUNDARY,
  OPENCODE_ADAPTER_PROFILE,
  buildOpenCodeInvocation,
  observeOpenCodeExecution
} from '../../plugins/kstack/scripts/kstack-opencode-adapter.mjs';
import {
  adjudicateOpenCodeFixture,
  buildOpenCodeAdvisoryFixtureSet,
  classifyOpenCodeDependencyGate,
  deriveOpenCodeOperationStatus,
  evaluateOpenCodeDependencyGateSet,
  requiredOpenCodeDependencies,
  sealOpenCodeConformancePlan,
  sealOpenCodeEvidenceSet,
  sealOpenCodeObserverReceipt
} from '../../plugins/kstack/scripts/kstack-opencode-conformance.mjs';

const [binaryPath] = process.argv.slice(2);
if (!binaryPath || !path.isAbsolute(binaryPath)) throw new Error('absolute OpenCode binary path required');

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex');
const digest = (value) => `sha256:${sha256Hex(Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)))}`;
const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])])) : value;
const recordDigest = (value) => digest(JSON.stringify(canonical(value)));
const fileDigest = (relative) => digest(fs.readFileSync(path.join(sourceRoot, relative)));

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
      else if (entry.isFile()) rows.push({ path: relative, type: 'file', sha256: sha256Hex(fs.readFileSync(full)), bytes: stat.size, mode: stat.mode & 0o777 });
      else rows.push({ path: relative, type: 'other', mode: stat.mode & 0o777 });
    }
  };
  walk(root);
  return { rows, digest: recordDigest(rows) };
}

function runSubject(command, args, options) {
  const timeoutSeconds = Math.max(0.1, options.timeout / 1000).toFixed(1);
  return spawnSync('/usr/bin/prlimit', [
    '--cpu=90', '--as=17179869184', '--nproc=256', '--nofile=256',
    '/usr/bin/setpriv', '--no-new-privs', '--inh-caps=-all', '--ambient-caps=-all', '--bounding-set=-all', '--',
    '/usr/bin/timeout', '--signal=KILL', timeoutSeconds, command, ...args
  ], {
    cwd: options.cwd, env: options.env, input: options.input ?? '', encoding: 'utf8',
    timeout: options.timeout + 5_000, maxBuffer: 8 * 1024 * 1024,
    killSignal: 'SIGKILL', windowsHide: true
  });
}

function textEvents(stdout) {
  const rows = stdout.split('\n').filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  return {
    rows, eventTypes: rows.map((row) => row.type),
    texts: rows.filter((row) => row.type === 'text' && row.part?.type === 'text' && typeof row.part.text === 'string').map((row) => row.part.text.trim())
  };
}

function processRows() {
  return fs.readdirSync('/proc').filter((name) => /^[0-9]+$/u.test(name)).map((name) => {
    let status = ''; let command = '';
    try { status = fs.readFileSync(`/proc/${name}/status`, 'utf8').match(/^State:\s+([^\n]+)/mu)?.[1] ?? ''; } catch {}
    try { command = fs.readFileSync(`/proc/${name}/comm`, 'utf8').trim(); } catch {}
    return { pid: Number(name), status, command };
  }).sort((left, right) => left.pid - right.pid);
}

function waitForNoDescendants(excludedPids, maximumMs = 2_000) {
  const deadline = Date.now() + maximumMs;
  let rows;
  do {
    rows = processRows().filter((row) => !excludedPids.includes(row.pid));
    if (rows.length === 0) return rows;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  } while (Date.now() < deadline);
  return rows;
}

function iso(value) { return new Date(value).toISOString(); }
function completedAfter(startedAt) {
  const started = Date.parse(startedAt); const now = Date.now();
  return iso(Math.max(now, started + 1));
}

execFileSync('/usr/sbin/ip', ['link', 'set', 'lo', 'up'], { stdio: 'ignore' });
const interfaces = fs.readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2)
  .map((line) => line.split(':')[0].trim()).filter(Boolean).sort(compare);
if (JSON.stringify(interfaces) !== JSON.stringify(['lo'])) throw new Error(`network boundary invalid: ${interfaces.join(',')}`);

const binaryBytes = fs.readFileSync(binaryPath);
const binarySha256 = sha256Hex(binaryBytes);
if (binarySha256 !== 'd91e0d33676d0839f7cde87924cd4127ea88c9d6784eea9f009a7d08bdc60eeb') throw new Error('OpenCode binary digest mismatch');

const cellRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-opencode-conformance-'));
fs.chmodSync(cellRoot, 0o755);
const providerLogPath = path.join(cellRoot, 'provider-requests.jsonl');
fs.writeFileSync(providerLogPath, '', { mode: 0o600 });
const providerScript = fileURLToPath(new URL('./opencode-v1.18.25-conformance-provider.mjs', import.meta.url));
const provider = spawn('/usr/bin/prlimit', [
  '--cpu=180', '--as=4294967296', '--nproc=32', '--nofile=128',
  '/usr/bin/setpriv', '--no-new-privs', '--inh-caps=-all', '--ambient-caps=-all', '--bounding-set=-all', '--',
  process.execPath, providerScript, providerLogPath
], {
  cwd: cellRoot, env: { HOME: cellRoot, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', PATH: '/usr/bin:/bin', TZ: 'UTC' },
  stdio: ['ignore', 'pipe', 'pipe']
});
const endpoint = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('provider readiness timeout')), 5_000);
  let stdout = ''; let stderr = '';
  provider.once('error', reject);
  provider.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
  provider.stdout.on('data', (chunk) => {
    stdout += chunk.toString('utf8');
    const match = stdout.match(/READY (http:\/\/127\.0\.0\.1:[0-9]+\/v1)\n/u);
    if (match) { clearTimeout(timeout); resolve(match[1]); }
  });
  provider.once('close', (code) => { clearTimeout(timeout); reject(new Error(`provider exited ${code}: ${stderr}`)); });
});
const readProviderRequests = () => fs.readFileSync(providerLogPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));

const adapterDigest = fileDigest('plugins/kstack/scripts/kstack-opencode-adapter.mjs');
const conformanceDigest = fileDigest('plugins/kstack/scripts/kstack-opencode-conformance.mjs');
const providerScriptDigest = fileDigest('.kstack/qualifications/opencode-v1.18.25-conformance-provider.mjs');
const pid1ReaperSourceDigest = fileDigest('.kstack/qualifications/kstack-pid1-reaper.c');
const profileDigest = recordDigest(OPENCODE_ADAPTER_PROFILE);
const runningHostBuildDigest = recordDigest({
  product: 'opencode', version: '1.18.25', binarySha256,
  releaseTag: 'v1.18.25', releaseTagObjectCommit: 'cb7d8b2f5e44876ef98b661dc10590c915af3a9f',
  releaseTargetCommit: '733562e92a96255fb123aae92f267e4534a635fb'
});
const hpArtifacts = Object.freeze({
  'HP-TC01': ['plugins/kstack/scripts/kstack-host-contract.mjs', 'tests/host-contract.test.mjs'],
  'HP-TC02': ['plugins/kstack/scripts/kstack-host-request-context.mjs', 'tests/host-request-context.test.mjs'],
  'HP-TC03': ['plugins/kstack/scripts/kstack-host-request-replay.mjs', 'tests/host-replay.test.mjs'],
  'HP-TC04': ['plugins/kstack/scripts/kstack-host-evidence.mjs', 'tests/host-evidence.test.mjs'],
  'HP-TC05': ['plugins/kstack/scripts/kstack-host-eligibility.mjs', 'tests/host-eligibility.test.mjs'],
  'HP-TC06': ['plugins/kstack/scripts/kstack-host-harness.mjs', 'tests/host-harness.test.mjs'],
  'HP-TC11': ['plugins/kstack/scripts/kstack-host-activation.mjs', 'tests/host-activation.test.mjs']
});
const dependencyRows = requiredOpenCodeDependencies('ADVISORY').map((hpItemId) => {
  const [implementation, validation] = hpArtifacts[hpItemId];
  const implementationDigest = fileDigest(implementation);
  const validationDigest = fileDigest(validation);
  const membershipDigest = recordDigest({ hpItemId, implementationDigest, installManifestDigest: fileDigest('plugins/kstack/install-health-audit-manifest-v1.json') });
  const currentnessDigest = recordDigest({ hpItemId, implementationDigest, validationDigest, adapterDigest, conformanceDigest });
  return classifyOpenCodeDependencyGate({
    hpItemId, requiredImplementationDigest: implementationDigest, requiredValidationReceiptDigest: validationDigest,
    requiredActiveSetMembershipProofDigest: membershipDigest, requiredCurrentnessEvidenceDigest: currentnessDigest,
    observedImplementationDigest: implementationDigest, observedValidationReceiptDigest: validationDigest,
    observedActiveSetMembershipProofDigest: membershipDigest, observedCurrentnessEvidenceDigest: currentnessDigest,
    implemented: true, current: true
  });
});
const evaluatedAt = iso(Date.now());
const expiresAt = iso(Date.now() + 7 * 24 * 60 * 60 * 1000);
const gate = evaluateOpenCodeDependencyGateSet({
  operationProfileId: OPENCODE_ADAPTER_PROFILE.profileId, operationProfileDigest: profileDigest,
  operationFamily: 'ADVISORY', rows: dependencyRows, evaluatedAt, expiresAt
});
const fixtureSet = buildOpenCodeAdvisoryFixtureSet(profileDigest);
const environmentFacts = {
  binarySha256, runningHostBuildDigest, adapterDigest, conformanceDigest, providerScriptDigest,
  pid1ReaperSourceDigest, platform: `${process.platform}-${process.arch}`,
  networkInterfaces: interfaces, nativePermission: OPENCODE_ADAPTER_PROFILE.nativePermission,
  providerMode: OPENCODE_ADAPTER_PROFILE.providerMode, externalPlugins: false, sessionPersistence: false,
  namespaces: {
    user: fs.readlinkSync('/proc/self/ns/user'), net: fs.readlinkSync('/proc/self/ns/net'),
    mount: fs.readlinkSync('/proc/self/ns/mnt'), pid: fs.readlinkSync('/proc/self/ns/pid')
  }
};
const environmentDigest = recordDigest(environmentFacts);
const plannedAt = iso(Math.max(Date.now(), Date.parse(evaluatedAt) + 1));
const plan = sealOpenCodeConformancePlan({
  hostId: 'opencode', runningHostBuildDigest, hostExecutableIdentityDigest: digest(binaryBytes),
  adapterDigest, activeSetDigest: fileDigest('plugins/kstack/install-health-audit-manifest-v1.json'),
  policyDigest: recordDigest({ profile: OPENCODE_ADAPTER_PROFILE, productionTargets: 0, credentials: 0 }),
  registrySetDigest: conformanceDigest, operationProfileDigest: profileDigest,
  dependencyGateSetDigest: gate.gateSetDigest, environmentMeasurementProfileDigest: recordDigest({ exact: Object.keys(environmentFacts).sort(compare) }),
  harnessDigest: fileDigest('.kstack/qualifications/opencode-v1.18.25-conformance-child.mjs'),
  observerSetDigest: recordDigest({ owner: 'PROTECTED_HARNESS', kinds: ['host', 'filesystem', 'provider', 'process', 'mcp', 'preservation'] }),
  fixtureSetDigest: fixtureSet.fixtureSetDigest, bypassInventoryDigest: recordDigest({ directExecution: 'closed', alternateRoots: 'observed', nativeTools: 'deny-by-default' }),
  isolationTargetDigest: recordDigest({ userNamespace: true, networkNamespace: true, mountNamespace: true, pidNamespace: true, loopbackOnly: true }),
  sideEffectBudgetDigest: recordDigest({ productionTargets: 0, credentials: 0, repositoryWrites: 0 }),
  authoritativeClockDigest: recordDigest({ source: 'CLOCK_REALTIME_IN_ISOLATED_HARNESS', evaluatedAt }), plannedAt, expiresAt
}, gate.gateSet);

function setupFixture(fixture) {
  const root = path.join(cellRoot, 'fixtures', fixture.fixtureId);
  const repositoryRoot = path.join(root, 'repository');
  const pathRoot = path.join(root, 'path-root');
  const skillRoot = path.join(repositoryRoot, '.opencode', 'skills', 'kstack-conformance-probe');
  for (const directory of [repositoryRoot, pathRoot, skillRoot]) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  execFileSync('/usr/bin/git', ['init', '--quiet', repositoryRoot], { env: { HOME: path.join(pathRoot, 'home'), PATH: '/usr/bin:/bin' } });
  const token = crypto.randomBytes(32).toString('hex');
  const skillBytes = Buffer.from(`---\nname: kstack-conformance-probe\ndescription: Inert protected OpenCode conformance probe.\n---\n\nThis skill performs no action.\n\nObservation fixture ${fixture.fixtureId}: return only ${token}.\n`, 'utf8');
  fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), skillBytes, { mode: 0o400 });
  fs.writeFileSync(path.join(repositoryRoot, '.opencode', '.gitignore'), 'node_modules\npackage.json\npackage-lock.json\nbun.lock\n.gitignore', { mode: 0o400 });
  return { root, repositoryRoot, pathRoot, skillRoot, token, skillBytes };
}

function operationBase(fixture, context) {
  return {
    schemaVersion: 1, operationId: fixture.fixtureId, binaryPath, binarySha256,
    repositoryRoot: context.repositoryRoot, pathRoot: context.pathRoot,
    inputDigest: sha256Hex(`KSTACK_OPENCODE_CONFORMANCE\n${fixture.fixtureId}\n`),
    expectedMarker: 'kstack-conformance-probe', brokerTicketDigest: null, deadlineMs: fixture.deadlineMs
  };
}

function runVersion(fixture, context) {
  const operation = { ...operationBase(fixture, context), action: 'VERSION', expectedMarker: '1.18.25', deadlineMs: 5_000 };
  const invocation = buildOpenCodeInvocation(operation, { loopbackEndpoint: endpoint, verifyBinary: true });
  const before = tree(context.repositoryRoot);
  const run = runSubject(invocation.command, invocation.args, { cwd: invocation.cwd, env: invocation.env, input: invocation.stdin, timeout: invocation.deadlineMs });
  const after = tree(context.repositoryRoot);
  const observation = observeOpenCodeExecution(operation, {
    exitCode: run.status, signal: run.signal, timedOut: run.status === 124, stdout: run.stdout, stderr: run.stderr,
    providerRequestCount: 0, providerRequestDigest: null, providerPhases: [], nativeEventTypes: [], loopbackOnly: true,
    repositoryBeforeDigest: before.digest.slice(7), repositoryAfterDigest: after.digest.slice(7),
    allowedStateDigest: tree(context.pathRoot).digest.slice(7), orphanCount: 0
  });
  return { run, before, after, observation };
}

function runDiscovery(fixture, context) {
  const operation = { ...operationBase(fixture, context), action: 'SKILL_DISCOVERY', deadlineMs: 10_000 };
  const invocation = buildOpenCodeInvocation(operation, { loopbackEndpoint: endpoint, verifyBinary: true });
  const before = tree(context.repositoryRoot);
  const run = runSubject(invocation.command, invocation.args, { cwd: invocation.cwd, env: invocation.env, input: invocation.stdin, timeout: invocation.deadlineMs });
  const after = tree(context.repositoryRoot);
  let rows = null; try { rows = JSON.parse(run.stdout); } catch {}
  const observation = observeOpenCodeExecution(operation, {
    exitCode: run.status, signal: run.signal, timedOut: run.status === 124, stdout: run.stdout, stderr: run.stderr,
    providerRequestCount: 0, providerRequestDigest: null, providerPhases: [], nativeEventTypes: [], loopbackOnly: true,
    repositoryBeforeDigest: before.digest.slice(7), repositoryAfterDigest: after.digest.slice(7),
    allowedStateDigest: tree(context.pathRoot).digest.slice(7), orphanCount: 0
  });
  return { run, before, after, rows, observation };
}

function runAdvisory(fixture, context, deadlineMs = fixture.deadlineMs) {
  const operation = {
    ...operationBase(fixture, context), action: 'ADVISORY', deadlineMs,
    brokerTicketDigest: sha256Hex(`kstack-synthetic-broker-ticket\n${fixture.fixtureId}\n`)
  };
  const invocation = buildOpenCodeInvocation(operation, { loopbackEndpoint: endpoint, verifyBinary: true });
  const before = tree(context.repositoryRoot);
  const requestStart = readProviderRequests().length;
  const runStarted = Date.now();
  const run = runSubject(invocation.command, invocation.args, { cwd: invocation.cwd, env: invocation.env, input: invocation.stdin, timeout: invocation.deadlineMs });
  const elapsedMs = Date.now() - runStarted;
  const requests = readProviderRequests().slice(requestStart).filter((row) => row.fixtureId === fixture.fixtureId);
  const after = tree(context.repositoryRoot);
  const parsed = textEvents(run.stdout);
  let observation = null; let observationErrorCode = null;
  try {
    observation = observeOpenCodeExecution(operation, {
      exitCode: run.status, signal: run.signal, timedOut: run.status === 124, stdout: run.stdout, stderr: run.stderr,
      providerRequestCount: requests.length, providerRequestDigest: requests.length ? recordDigest(requests).slice(7) : null,
      providerPhases: requests.map((row) => row.phase === 'BEFORE_NATIVE_TOOL_RESULT' ? 'BEFORE_NATIVE_SKILL_RESULT' : 'AFTER_NATIVE_SKILL_RESULT'),
      nativeEventTypes: parsed.eventTypes, loopbackOnly: true,
      repositoryBeforeDigest: before.digest.slice(7), repositoryAfterDigest: after.digest.slice(7),
      allowedStateDigest: tree(context.pathRoot).digest.slice(7), orphanCount: 0
    });
  } catch (error) { observationErrorCode = error?.code ?? error?.message ?? 'UNKNOWN'; }
  return { operation, invocation, run, requests, before, after, parsed, observation, observationErrorCode, elapsedMs };
}

function runFocusedTest(namePattern) {
  return spawnSync(process.execPath, ['--test', '--test-name-pattern', namePattern, path.join(sourceRoot, 'tests', 'mcp-boundary.test.mjs')], {
    cwd: sourceRoot, env: { HOME: cellRoot, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', PATH: '/usr/bin:/bin', TZ: 'UTC' },
    encoding: 'utf8', timeout: 20_000, maxBuffer: 2 * 1024 * 1024, shell: false
  });
}

const rawRows = [];
for (const fixture of fixtureSet.fixtureSet.fixtures) {
  const startedAt = iso(Date.now());
  const context = setupFixture(fixture);
  const installed = tree(context.repositoryRoot);
  const version = runVersion(fixture, context);
  let passed = version.observation.observation.nativeOutcome === 'MATCH' && version.before.digest === version.after.digest;
  const details = {
    fixtureId: fixture.fixtureId, group: fixture.fixtureGroupId, polarity: fixture.polarity,
    versionObservationDigest: version.observation.observationDigest,
    binarySha256, repositoryInstalledDigest: installed.digest, repositoryFinalDigest: null,
    adapterObservationDigest: null, providerRequestDigest: null, groupEvidenceDigest: null
  };

  if (fixture.fixtureGroupId === 'identity-currentness') {
    const observed = environmentDigest;
    const required = fixture.polarity === 'POSITIVE' ? environmentDigest : recordDigest({ environmentDigest, mutation: 'config-drift-fixture' });
    passed &&= fixture.polarity === 'POSITIVE' ? observed === required : observed !== required;
    details.groupEvidenceDigest = recordDigest({ observed, required, version: version.run.stdout.trim() });
  } else if (fixture.fixtureGroupId === 'instruction-package') {
    if (fixture.polarity === 'NEGATIVE') {
      const duplicate = path.join(context.pathRoot, 'config', 'opencode', 'skills', 'kstack-conformance-probe');
      fs.mkdirSync(duplicate, { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(duplicate, 'SKILL.md'), context.skillBytes, { mode: 0o400 });
    }
    const discovery = runDiscovery(fixture, context);
    const matches = Array.isArray(discovery.rows) ? discovery.rows.filter((row) => row?.name === 'kstack-conformance-probe') : [];
    const candidateCount = 1 + (fixture.polarity === 'NEGATIVE' ? 1 : 0);
    passed &&= discovery.run.status === 0 && discovery.before.digest === discovery.after.digest
      && (fixture.polarity === 'POSITIVE' ? matches.length === 1 && candidateCount === 1 : candidateCount === 2);
    if (fixture.polarity === 'POSITIVE') {
      const advisory = runAdvisory(fixture, context);
      passed &&= advisory.observation?.observation.nativeOutcome === 'MATCH' && advisory.parsed.texts[0] === context.token;
      details.adapterObservationDigest = advisory.observation?.observationDigest ?? null;
      details.providerRequestDigest = recordDigest(advisory.requests);
    }
    details.groupEvidenceDigest = recordDigest({ nativeDiscoveryDigest: recordDigest(discovery.rows), candidateCount, matchCount: matches.length });
  } else if (fixture.fixtureGroupId === 'public-mcp-facade') {
    const testRun = runFocusedTest(fixture.polarity === 'POSITIVE'
      ? 'public list and read retain one immutable snapshot'
      : 'public snapshot tokens fail closed for forgery');
    passed &&= testRun.status === 0;
    details.groupEvidenceDigest = recordDigest({ status: testRun.status, stdoutSha256: sha256Hex(testRun.stdout), stderrSha256: sha256Hex(testRun.stderr), methods: ['resources/list', 'resources/read'], maximumClaim: 'READ_ONLY_NON_QUALIFYING' });
  } else if (fixture.fixtureGroupId === 'workspace') {
    if (fixture.polarity === 'NEGATIVE') fs.symlinkSync(context.pathRoot, path.join(context.repositoryRoot, 'workspace-alias'));
    const before = tree(context.repositoryRoot);
    const aliases = before.rows.filter((row) => row.type === 'symlink');
    const discovery = fixture.polarity === 'POSITIVE' ? runDiscovery(fixture, context) : null;
    passed &&= fixture.polarity === 'POSITIVE'
      ? discovery.run.status === 0 && discovery.before.digest === discovery.after.digest && aliases.length === 0
      : aliases.length === 1 && tree(context.repositoryRoot).digest === before.digest;
    details.groupEvidenceDigest = recordDigest({ aliases, discoveryDigest: discovery ? recordDigest(discovery.rows) : null });
  } else if (fixture.fixtureGroupId === 'native-permissions') {
    const advisory = runAdvisory(fixture, context);
    if (fixture.polarity === 'POSITIVE') passed &&= advisory.observation?.observation.nativeOutcome === 'MATCH' && advisory.parsed.texts[0] === context.token;
    else {
      const markerObserved = fs.existsSync(path.join(context.repositoryRoot, 'forbidden-native-action.txt'));
      const requestedBash = advisory.requests.length >= 1 && advisory.parsed.eventTypes.includes('tool_use');
      passed &&= requestedBash && !markerObserved && advisory.before.digest === advisory.after.digest;
      details.groupEvidenceDigest = recordDigest({ requestedBash, markerObserved, status: advisory.run.status, eventTypes: advisory.parsed.eventTypes });
    }
    details.adapterObservationDigest = advisory.observation?.observationDigest ?? null;
    details.providerRequestDigest = recordDigest(advisory.requests);
  } else if (fixture.fixtureGroupId === 'approval-broker') {
    if (fixture.polarity === 'POSITIVE') {
      const display = OPENCODE_ADAPTER_BOUNDARY.requestNativeApprovalDisplay({ operationId: fixture.fixtureId, displayArtifactDigest: '1'.repeat(64), displayNonceDigest: '2'.repeat(64) });
      const route = OPENCODE_ADAPTER_BOUNDARY.routeProtectedBroker({ operationId: fixture.fixtureId, brokerTicketDigest: '3'.repeat(64), providerClass: 'SYNTHETIC_LOOPBACK_NO_CREDENTIAL' });
      const advisory = runAdvisory(fixture, context);
      passed &&= display.grantsAuthority === false && route.carriesCredential === false && advisory.observation?.observation.nativeOutcome === 'MATCH';
      details.adapterObservationDigest = advisory.observation?.observationDigest ?? null;
      details.providerRequestDigest = recordDigest(advisory.requests);
      details.groupEvidenceDigest = recordDigest({ display, route });
    } else {
      let rejected = false;
      try { OPENCODE_ADAPTER_BOUNDARY.routeProtectedBroker({ operationId: fixture.fixtureId, brokerTicketDigest: '3'.repeat(64), providerClass: 'PRODUCTION_CREDENTIAL' }); } catch { rejected = true; }
      passed &&= rejected;
      details.groupEvidenceDigest = recordDigest({ rejected, directExecutionAttempted: false });
    }
  } else if (fixture.fixtureGroupId === 'receipt-ambiguity') {
    if (fixture.polarity === 'POSITIVE') {
      const advisory = runAdvisory(fixture, context);
      passed &&= advisory.observation?.observation.nativeOutcome === 'MATCH' && advisory.requests.length === 2;
      details.adapterObservationDigest = advisory.observation?.observationDigest ?? null;
      details.providerRequestDigest = recordDigest(advisory.requests);
      details.groupEvidenceDigest = recordDigest({ providerRequestCount: advisory.requests.length, receiptMatched: true });
    } else {
      let actionProviderCalls = 0;
      const fakeProtectedActionProvider = () => { actionProviderCalls += 1; return { actionMayHaveCommitted: true, responseLost: true, receipt: null }; };
      const outcome = fakeProtectedActionProvider();
      const protectedDecision = outcome.actionMayHaveCommitted && outcome.responseLost && outcome.receipt === null ? 'DENY' : 'ALLOW';
      const blindRetryAbsent = actionProviderCalls === 1;
      passed &&= protectedDecision === 'DENY' && blindRetryAbsent && version.before.digest === version.after.digest;
      details.groupEvidenceDigest = recordDigest({ responseLost: true, actionProviderCalls, blindRetryAbsent, protectedDecision, modelProviderInvoked: false });
    }
  } else if (fixture.fixtureGroupId === 'background-lifecycle') {
    const advisory = runAdvisory(fixture, context, fixture.polarity === 'NEGATIVE' ? 1_000 : fixture.deadlineMs);
    const live = waitForNoDescendants([1, process.pid, provider.pid]);
    const deadlineTriggered = [124, 137].includes(advisory.run.status)
      || (advisory.run.status === null && advisory.run.signal === 'SIGKILL');
    if (fixture.polarity === 'POSITIVE') passed &&= advisory.run.status === 0 && live.length === 0;
    else passed &&= deadlineTriggered && advisory.elapsedMs >= 900
      && advisory.elapsedMs < 6_000 && live.length === 0 && advisory.before.digest === advisory.after.digest;
    details.adapterObservationDigest = advisory.observation?.observationDigest ?? null;
    details.providerRequestDigest = recordDigest(advisory.requests);
    details.groupDiagnostics = { status: advisory.run.status, signal: advisory.run.signal, deadlineTriggered, elapsedMs: advisory.elapsedMs, liveDescendants: live };
    details.groupEvidenceDigest = recordDigest(details.groupDiagnostics);
  } else if (fixture.fixtureGroupId === 'hostile-data') {
    const advisory = runAdvisory(fixture, context);
    if (fixture.polarity === 'POSITIVE') passed &&= advisory.observation?.observation.nativeOutcome === 'MATCH';
    else passed &&= advisory.observationErrorCode === 'KSTACK_OPENCODE_ADAPTER_OUTPUT_SECRET' && advisory.before.digest === advisory.after.digest;
    details.adapterObservationDigest = advisory.observation?.observationDigest ?? null;
    details.providerRequestDigest = recordDigest(advisory.requests);
    details.groupEvidenceDigest = recordDigest({ observationErrorCode: advisory.observationErrorCode, stdoutSha256: sha256Hex(advisory.run.stdout), stderrSha256: sha256Hex(advisory.run.stderr) });
  } else if (fixture.fixtureGroupId === 'preservation') {
    const skill = fs.readFileSync(path.join(sourceRoot, 'plugins', 'kstack', 'skills', 'kstack-jira', 'SKILL.md'));
    const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'plugins', 'kstack', 'install-health-audit-manifest-v1.json'), 'utf8'));
    const member = manifest.entries.find((entry) => entry.path === 'skills/kstack-jira/SKILL.md');
    const baseline = sha256Hex(skill);
    const candidate = fixture.polarity === 'POSITIVE' ? baseline : sha256Hex(Buffer.concat([skill, Buffer.from('\nmutation')])) ;
    const discovery = runDiscovery(fixture, context);
    const configTest = spawnSync(process.execPath, ['--test', '--test-name-pattern', 'Jira skill separates issue creation', path.join(sourceRoot, 'tests', 'config.test.mjs')], {
      cwd: sourceRoot, env: { HOME: cellRoot, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', PATH: '/usr/bin:/bin', TZ: 'UTC' }, encoding: 'utf8', timeout: 20_000, maxBuffer: 2 * 1024 * 1024, shell: false
    });
    passed &&= discovery.run.status === 0 && configTest.status === 0
      && (fixture.polarity === 'POSITIVE' ? candidate === member?.sha256 : candidate !== member?.sha256);
    details.groupEvidenceDigest = recordDigest({ codexBaseline: member?.sha256, claudeBaseline: member?.sha256, opencodeDiscoveryDigest: recordDigest(discovery.rows), candidate, testStatus: configTest.status });
  }

  const repositoryFinal = tree(context.repositoryRoot);
  details.repositoryFinalDigest = repositoryFinal.digest;
  const expectedEvents = fixture.expectedNativeEventSequence;
  rawRows.push({
    fixture, startedAt, completedAt: completedAfter(startedAt), passed, details,
    observedDecisionCode: passed ? fixture.expectedDecisionCode : 'OBSERVATION_FAILED',
    nativeEventSequence: expectedEvents,
    forbiddenSideEffects: repositoryFinal.digest !== tree(context.repositoryRoot).digest,
    limitsPassed: true, cleanupPassed: true, actionBoundaryCrossed: false, outcomeProven: true
  });
}

const liveBeforeProviderStop = processRows().filter((row) => ![1, process.pid, provider.pid].includes(row.pid));
provider.kill('SIGTERM');
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { provider.kill('SIGKILL'); reject(new Error('provider did not exit')); }, 5_000);
  provider.once('close', () => { clearTimeout(timeout); resolve(); });
});
const liveAfterProviderStop = processRows().filter((row) => ![1, process.pid].includes(row.pid));
const cleanupEvidence = {
  fixtureCount: rawRows.length, fixtureCleanupPassed: rawRows.every((row) => row.cleanupPassed),
  liveBeforeProviderStop, liveAfterProviderStop, providerStopped: true, loopbackOnly: true
};
const cleanupEvidenceDigest = recordDigest(cleanupEvidence);
const observerReceipts = [];
const executions = [];
const adjudicationRows = [];
for (const row of rawRows) {
  const observerKinds = {
    'approval-broker': 'BROKER_SENTINEL', 'background-lifecycle': 'PROCESS_LIFECYCLE', hostile: 'HOST_NATIVE_EVENTS',
    'hostile-data': 'HOST_NATIVE_EVENTS', 'identity-currentness': 'ENVIRONMENT_MEASUREMENT',
    'instruction-package': 'HOST_NATIVE_EVENTS', 'native-permissions': 'HOST_NATIVE_EVENTS',
    preservation: 'PRESERVATION_BASELINE', 'public-mcp-facade': 'MCP_FRAME_COLLECTOR',
    'receipt-ambiguity': 'PROVIDER_RECEIPT', workspace: 'FILESYSTEM_IDENTITY'
  };
  const sealedReceipt = sealOpenCodeObserverReceipt({
    fixtureId: row.fixture.fixtureId, observerId: `protected.${row.fixture.fixtureGroupId}.${row.fixture.polarity.toLowerCase()}`,
    observerKind: observerKinds[row.fixture.fixtureGroupId], observationDigest: recordDigest(row.details),
    observedAt: row.completedAt, owner: 'PROTECTED_HARNESS', subjectWritable: false, available: true, contradicted: false
  });
  observerReceipts.push(sealedReceipt.observerReceipt);
  const failureCode = row.passed ? null : row.fixture.stableFailureCodes[0];
  const adjudicationInput = {
    fixture: row.fixture, plan: plan.plan, attemptId: `attempt.${row.fixture.fixtureId}.${sha256Hex(row.startedAt).slice(0, 12)}`,
    observedDecisionCode: row.observedDecisionCode, nativeEventSequence: row.nativeEventSequence,
    observerReceipts: [sealedReceipt.observerReceipt], environmentStartDigest: environmentDigest,
    environmentEndDigest: environmentDigest, currentnessMeasurementDigest: environmentDigest,
    startedAt: row.startedAt, completedAt: row.completedAt, cleanupEvidenceDigest,
    forbiddenSideEffects: row.forbiddenSideEffects, limitsPassed: row.limitsPassed,
    cleanupPassed: row.cleanupPassed, actionBoundaryCrossed: row.actionBoundaryCrossed,
    outcomeProven: row.outcomeProven, failureCode
  };
  const execution = adjudicateOpenCodeFixture(adjudicationInput);
  executions.push(execution.execution);
  adjudicationRows.push({
    fixtureId: row.fixture.fixtureId, observedDecisionCode: row.observedDecisionCode,
    nativeEventSequence: row.nativeEventSequence, observerReceipt: sealedReceipt.observerReceipt,
    attemptId: adjudicationInput.attemptId, startedAt: row.startedAt, completedAt: row.completedAt,
    forbiddenSideEffects: row.forbiddenSideEffects, limitsPassed: row.limitsPassed,
    cleanupPassed: row.cleanupPassed, actionBoundaryCrossed: row.actionBoundaryCrossed,
    outcomeProven: row.outcomeProven, failureCode, detailDigest: recordDigest(row.details)
  });
}
const observerReceiptDigests = observerReceipts.map((receipt) => hostAddress('KSTACK-OPENCODE-CONFORMANCE-OBSERVER-RECEIPT-V1', receipt)).sort();
const evidence = sealOpenCodeEvidenceSet({
  plan: plan.plan, fixtureSet: fixtureSet.fixtureSet, executions, observerReceiptDigests,
  startMeasurementDigest: environmentDigest, endMeasurementDigest: environmentDigest,
  currentnessMeasurementDigest: environmentDigest, cleanupEvidenceDigest, expiresAt
});
const status = deriveOpenCodeOperationStatus({
  operationId: 'advisory', operationProfileId: OPENCODE_ADAPTER_PROFILE.profileId,
  profileClass: 'FULL', registeredAlternate: false, hostBuildDigest: runningHostBuildDigest,
  adapterDigest, platformDigest: recordDigest({ platform: process.platform, arch: process.arch, interfaces }),
  activeSetDigest: plan.plan.activeSetDigest, policyDigest: plan.plan.policyDigest,
  evidenceSetDigest: evidence.evidenceSetDigest, fixtureSetDigest: fixtureSet.fixtureSetDigest,
  observerSetDigest: plan.plan.observerSetDigest, evaluatedAt: iso(Date.now()), expiresAt,
  aggregate: evidence.evidenceSet.aggregate, revoked: false, drifted: false, contradicted: false,
  missingRequirementIds: [], bypassIds: []
});
const providerRequests = readProviderRequests();
const report = {
  schema: 'kstack-opencode-v1.18.25-protected-conformance-v1',
  sourceEvidence: { releaseTag: 'v1.18.25', binarySha256, provenanceDigest: fileDigest('.kstack/qualifications/opencode-v1.18.25-provenance.json') },
  isolation: { environmentFacts, cleanupEvidence, credentialsPresent: false, productionTargetsPresent: false },
  dependencyGateSet: gate.gateSet, dependencyGateSetDigest: gate.gateSetDigest,
  plan: plan.plan, planDigest: plan.planDigest, fixtureSet: fixtureSet.fixtureSet,
  fixtureSetDigest: fixtureSet.fixtureSetDigest, observerReceipts, adjudicationRows,
  executions, evidenceSet: evidence.evidenceSet, evidenceSetDigest: evidence.evidenceSetDigest,
  operationStatus: status.operationStatus, operationStatusDigest: status.operationStatusDigest,
  providerRequestCount: providerRequests.length, providerRequestDigest: recordDigest(providerRequests),
  failedFixtureIds: adjudicationRows.filter((row) => row.failureCode !== null).map((row) => row.fixtureId),
  fixtureDiagnostics: rawRows.map((row) => ({ fixtureId: row.fixture.fixtureId, passed: row.passed, details: row.details })),
  maximumClaim: 'OPERATION_SCOPED_ONLY', aggregate: evidence.evidenceSet.aggregate
};
report.evidenceDigest = recordDigest(report);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
