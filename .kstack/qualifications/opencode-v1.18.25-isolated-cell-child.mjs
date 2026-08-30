import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createDiscoveryChallengePair,
  createOpenCodeDiscoveryObservation,
  verifyDiscoveryVariantDifference
} from '../../plugins/kstack/scripts/kstack-opencode-candidate.mjs';
import {
  OPENCODE_ADAPTER_PROFILE,
  buildOpenCodeInvocation,
  observeOpenCodeExecution
} from '../../plugins/kstack/scripts/kstack-opencode-adapter.mjs';

const [binaryPath] = process.argv.slice(2);
if (!binaryPath || !path.isAbsolute(binaryPath)) throw new Error('absolute OpenCode binary path required');

const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex');
const digest = (value) => `sha256:${sha256Hex(Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)))}`;
const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])])) : value;
const recordDigest = (value) => digest(JSON.stringify(canonical(value)));

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
  return spawnSync('/usr/bin/prlimit', [
    '--cpu=90', '--as=17179869184', '--nproc=256', '--nofile=256',
    '/usr/bin/setpriv', '--no-new-privs',
    '--inh-caps=-all', '--ambient-caps=-all', '--bounding-set=-all', '--', command, ...args
  ], {
    ...options,
    encoding: 'utf8',
    timeout: options.timeout ?? 90_000,
    maxBuffer: 8 * 1024 * 1024,
    killSignal: 'SIGKILL',
    windowsHide: true
  });
}

function parseTextOutput(stdout) {
  const rows = stdout.split('\n').filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  const textRows = rows.filter((row) => row.type === 'text' && row.part?.type === 'text' && typeof row.part.text === 'string');
  if (textRows.length !== 1) throw new Error(`expected one completed OpenCode text event, found ${textRows.length}`);
  return { output: textRows[0].part.text.trim(), eventDigest: recordDigest(rows), eventTypes: rows.map((row) => row.type) };
}

execFileSync('/usr/sbin/ip', ['link', 'set', 'lo', 'up'], { stdio: 'ignore' });
const interfaces = fs.readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2)
  .map((line) => line.split(':')[0].trim()).filter(Boolean).sort(compare);
const loopbackOnly = interfaces.length === 1 && interfaces[0] === 'lo';
if (!loopbackOnly) throw new Error(`network namespace has non-loopback interfaces: ${interfaces.join(',')}`);

const binaryBytes = fs.readFileSync(binaryPath);
const binarySha256 = sha256Hex(binaryBytes);
if (binarySha256 !== 'd91e0d33676d0839f7cde87924cd4127ea88c9d6784eea9f009a7d08bdc60eeb') throw new Error('qualified OpenCode binary digest mismatch');

const cellRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-opencode-cell-'));
fs.chmodSync(cellRoot, 0o755);
const providerLogPath = path.join(cellRoot, 'provider-requests.jsonl');
fs.writeFileSync(providerLogPath, '', { mode: 0o600 });

const providerScript = fileURLToPath(new URL('./opencode-v1.18.25-synthetic-provider.mjs', import.meta.url));
const provider = spawn('/usr/bin/prlimit', [
  '--cpu=90', '--as=4294967296', '--nproc=32', '--nofile=128',
  '/usr/bin/setpriv', '--no-new-privs',
  '--inh-caps=-all', '--ambient-caps=-all', '--bounding-set=-all', '--',
  process.execPath, providerScript, providerLogPath
], {
  cwd: cellRoot,
  env: { HOME: cellRoot, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', PATH: '/usr/bin:/bin', TZ: 'UTC' },
  stdio: ['ignore', 'pipe', 'pipe']
});
const endpoint = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('synthetic provider readiness timeout')), 5_000);
  let stdout = '';
  let stderr = '';
  provider.once('error', reject);
  provider.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
  provider.stdout.on('data', (chunk) => {
    stdout += chunk.toString('utf8');
    const match = stdout.match(/READY (http:\/\/127\.0\.0\.1:[0-9]+\/v1)\n/u);
    if (match) { clearTimeout(timeout); resolve(match[1]); }
  });
  provider.once('close', (code) => {
    clearTimeout(timeout);
    reject(new Error(`synthetic provider exited ${code}: ${stderr}`));
  });
});

const config = {
  $schema: 'https://opencode.ai/config.json',
  autoupdate: false,
  share: 'disabled',
  permission: { '*': 'deny', skill: 'allow' },
  provider: {
    kstack: {
      npm: '@ai-sdk/openai-compatible',
      name: 'KStack loopback qualification provider',
      options: { baseURL: endpoint },
      models: { 'kstack-qualification': { name: 'KStack qualification model' } }
    }
  }
};
const configText = JSON.stringify(config);
const liveConfigDigest = recordDigest(config);
const runningHostBuildDigest = recordDigest({
  product: 'opencode', version: '1.18.25', binarySha256,
  releaseTag: 'v1.18.25', releaseTagObjectCommit: 'cb7d8b2f5e44876ef98b661dc10590c915af3a9f',
  releaseTargetCommit: '733562e92a96255fb123aae92f267e4534a635fb'
});
const registrySetDigest = digest(fs.readFileSync(new URL('../../plugins/kstack/scripts/kstack-opencode-candidate.mjs', import.meta.url)));
const adapterBytes = fs.readFileSync(new URL('../../plugins/kstack/scripts/kstack-opencode-adapter.mjs', import.meta.url));
const adapterSha256 = sha256Hex(adapterBytes);
const fixtureId = 'opencode-native-skill-causal-v1';
const skillName = 'kstack-causal-probe';
const fixturePrompt = `Load the registered skill named ${skillName} for observation fixture ${fixtureId}, obey its inert observation clause, and return only the requested value.`;
const baseSkillBytes = Buffer.from(`---\nname: kstack-causal-probe\ndescription: Bounded instruction-only causal discovery fixture.\n---\n\nThis skill performs no action. Follow only the inert observation fixture clause below.\n`, 'utf8');
const challenge = createDiscoveryChallengePair({
  registrySetDigest,
  baseRenderBundleDigest: recordDigest({ 'kstack-causal-probe/SKILL.md': sha256Hex(baseSkillBytes) }),
  fixtureId,
  fixturePrompt,
  challengeClauseSchemaDigest: recordDigest({ clause: 'Observation fixture {fixtureId}: return only {tokenHex}.', tokenBits: 256 })
});
const treatmentBytes = Buffer.concat([baseSkillBytes, Buffer.from(`\nObservation fixture ${fixtureId}: return only ${challenge.protectedTokens.treatmentToken.toString('hex')}.\n`)]);
const controlBytes = Buffer.concat([baseSkillBytes, Buffer.from(`\nObservation fixture ${fixtureId}: return only ${challenge.protectedTokens.controlToken.toString('hex')}.\n`)]);
const difference = verifyDiscoveryVariantDifference({
  fixtureId,
  fixtureFactsDigest: challenge.publicChallenge.fixtureFactsDigest,
  baseMemberBytes: { 'kstack-causal-probe/SKILL.md': baseSkillBytes },
  treatmentMemberBytes: { 'kstack-causal-probe/SKILL.md': treatmentBytes },
  controlMemberBytes: { 'kstack-causal-probe/SKILL.md': controlBytes },
  challengeMemberPath: 'kstack-causal-probe/SKILL.md',
  treatmentToken: challenge.protectedTokens.treatmentToken,
  controlToken: challenge.protectedTokens.controlToken
});

const readProviderRequests = () => fs.readFileSync(providerLogPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
const sessionRows = [];
const outputRows = {};
const sessionEvidence = [];

for (const variant of challenge.publicChallenge.randomizedOrder.order) {
  const sessionRoot = path.join(cellRoot, variant.toLowerCase());
  const repositoryRoot = path.join(sessionRoot, 'repository');
  const pathRoot = path.join(sessionRoot, 'path-root');
  const homeRoot = path.join(pathRoot, 'home');
  const xdgRoot = pathRoot;
  const skillRoot = path.join(repositoryRoot, '.opencode', 'skills', 'kstack-causal-probe');
  for (const directory of [repositoryRoot, homeRoot, skillRoot]) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  execFileSync('/usr/bin/git', ['init', '--quiet', repositoryRoot], { env: { HOME: homeRoot, PATH: '/usr/bin:/bin' } });
  const memberBytes = variant === 'CONTROL' ? controlBytes : treatmentBytes;
  fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), memberBytes, { mode: 0o400 });
  const expectedGitignore = Buffer.from('node_modules\npackage.json\npackage-lock.json\nbun.lock\n.gitignore', 'utf8');
  fs.writeFileSync(path.join(repositoryRoot, '.opencode', '.gitignore'), expectedGitignore, { mode: 0o400 });
  const repositoryInstalled = tree(repositoryRoot);
  const operationBase = {
    schemaVersion: 1,
    operationId: fixtureId,
    binaryPath,
    binarySha256,
    repositoryRoot,
    pathRoot,
    expectedMarker: skillName,
    deadlineMs: 90_000
  };
  const discoveryOperation = {
    ...operationBase,
    action: 'SKILL_DISCOVERY',
    inputDigest: sha256Hex(`SKILL_DISCOVERY\n${skillName}\n`),
    brokerTicketDigest: null,
    deadlineMs: 20_000
  };
  const discoveryInvocation = buildOpenCodeInvocation(discoveryOperation, { loopbackEndpoint: endpoint, verifyBinary: true });
  if (discoveryInvocation.configDigest !== liveConfigDigest.slice(7)) throw new Error('adapter live configuration drift');
  const discovery = runSubject(discoveryInvocation.command, discoveryInvocation.args, {
    cwd: discoveryInvocation.cwd, env: discoveryInvocation.env, input: discoveryInvocation.stdin, timeout: discoveryInvocation.deadlineMs
  });
  if (discovery.status !== 0) throw new Error(`${variant} native skill discovery failed: ${discovery.stderr}`);
  let discovered;
  try { discovered = JSON.parse(discovery.stdout); } catch { throw new Error(`${variant} native skill discovery was not JSON: ${discovery.stdout}`); }
  const discoveredProbe = Array.isArray(discovered) ? discovered.filter((row) => row?.name === 'kstack-causal-probe') : [];
  const unexpectedDiscovered = Array.isArray(discovered)
    ? discovered.filter((row) => !['customize-opencode', 'kstack-causal-probe'].includes(row?.name)) : [];
  if (!Array.isArray(discovered) || discoveredProbe.length !== 1 || unexpectedDiscovered.length !== 0
      || discoveredProbe[0]?.location !== path.join(skillRoot, 'SKILL.md')) {
    throw new Error(`${variant} native skill discovery mismatch: ${JSON.stringify(discovered)}`);
  }
  const generatedGitignorePath = path.join(repositoryRoot, '.opencode', '.gitignore');
  if (!fs.existsSync(generatedGitignorePath) || !fs.readFileSync(generatedGitignorePath).equals(expectedGitignore)) {
    throw new Error(`${variant} native discovery created unexpected repository state`);
  }
  const repositoryBeforeRun = tree(repositoryRoot);
  if (repositoryBeforeRun.digest !== repositoryInstalled.digest) throw new Error(`${variant} native discovery mutated the preprovisioned repository`);
  const discoveryObservation = observeOpenCodeExecution(discoveryOperation, {
    exitCode: discovery.status,
    signal: discovery.signal,
    timedOut: discovery.error?.code === 'ETIMEDOUT',
    stdout: discovery.stdout,
    stderr: discovery.stderr,
    providerRequestCount: 0,
    providerRequestDigest: null,
    providerPhases: [],
    nativeEventTypes: [],
    loopbackOnly,
    repositoryBeforeDigest: repositoryInstalled.digest.slice(7),
    repositoryAfterDigest: repositoryBeforeRun.digest.slice(7),
    allowedStateDigest: tree(xdgRoot).digest.slice(7),
    orphanCount: 0
  });
  if (discoveryObservation.observation.nativeOutcome !== 'MATCH') throw new Error(`${variant} adapter discovery observation mismatch`);
  const requestsBefore = readProviderRequests().length;
  const advisoryOperation = {
    ...operationBase,
    action: 'ADVISORY',
    inputDigest: sha256Hex(fixturePrompt),
    brokerTicketDigest: sha256Hex('kstack-opencode-synthetic-loopback-broker-ticket-v1')
  };
  const advisoryInvocation = buildOpenCodeInvocation(advisoryOperation, { loopbackEndpoint: endpoint, verifyBinary: true });
  if (advisoryInvocation.args.at(-1) !== fixturePrompt) throw new Error('adapter fixture prompt drift');
  const run = runSubject(advisoryInvocation.command, advisoryInvocation.args, {
    cwd: advisoryInvocation.cwd, env: advisoryInvocation.env, input: advisoryInvocation.stdin, timeout: advisoryInvocation.deadlineMs
  });
  if (run.status !== 0) throw new Error(`${variant} OpenCode run failed (${run.status}/${run.signal}): ${run.stderr}\n${run.stdout}`);
  const parsedOutput = parseTextOutput(run.stdout);
  const requests = readProviderRequests().slice(requestsBefore);
  const chatRequests = requests.filter((row) => row.method === 'POST' && row.path === '/v1/chat/completions');
  if (chatRequests.length !== 2
      || chatRequests[0].phase !== 'BEFORE_NATIVE_SKILL_RESULT' || chatRequests[0].challengeTokenCount !== 0
      || chatRequests[1].phase !== 'AFTER_NATIVE_SKILL_RESULT' || chatRequests[1].challengeTokenCount !== 1
      || !chatRequests[1].roles.includes('tool')) {
    throw new Error(`${variant} provider transcript did not prove native skill mediation: ${JSON.stringify(requests)}`);
  }
  const repositoryAfter = tree(repositoryRoot);
  if (repositoryAfter.digest !== repositoryBeforeRun.digest) throw new Error(`${variant} OpenCode run mutated repository root`);
  const xdgAfter = tree(xdgRoot);
  const liveOrphans = fs.readdirSync('/proc').filter((name) => /^[0-9]+$/u.test(name))
    .map(Number).filter((pid) => ![1, process.pid, provider.pid].includes(pid));
  if (liveOrphans.length !== 0) throw new Error(`${variant} left namespace descendants: ${liveOrphans.join(',')}`);
  const adapterObservation = observeOpenCodeExecution(advisoryOperation, {
    exitCode: run.status,
    signal: run.signal,
    timedOut: run.error?.code === 'ETIMEDOUT',
    stdout: run.stdout,
    stderr: run.stderr,
    providerRequestCount: chatRequests.length,
    providerRequestDigest: recordDigest(chatRequests).slice(7),
    providerPhases: chatRequests.map((row) => row.phase),
    nativeEventTypes: parsedOutput.eventTypes,
    loopbackOnly,
    repositoryBeforeDigest: repositoryBeforeRun.digest.slice(7),
    repositoryAfterDigest: repositoryAfter.digest.slice(7),
    allowedStateDigest: xdgAfter.digest.slice(7),
    orphanCount: liveOrphans.length
  });
  if (adapterObservation.observation.nativeOutcome !== 'MATCH') throw new Error(`${variant} adapter advisory observation mismatch`);
  const outputReceiptDigest = recordDigest({ stdoutSha256: sha256Hex(run.stdout), stderrSha256: sha256Hex(run.stderr), eventDigest: parsedOutput.eventDigest, exitCode: run.status });
  const installedMemberManifestDigest = recordDigest(repositoryInstalled.rows.filter((row) => row.path.includes('kstack-causal-probe')));
  const sessionIdentityDigest = recordDigest({ variant, pidNamespace: fs.readlinkSync('/proc/self/ns/pid'), networkNamespace: fs.readlinkSync('/proc/self/ns/net'), repositoryRoot, homeRoot });
  const effectEvidenceDigest = recordDigest({
    repositoryInstalledDigest: repositoryInstalled.digest,
    repositoryBeforeRunDigest: repositoryBeforeRun.digest,
    repositoryAfterDigest: repositoryAfter.digest,
    preprovisionedOpenCodeStateDigest: recordDigest(repositoryInstalled.rows.filter((row) => row.path === '.opencode/.gitignore')),
    xdgAfterDigest: xdgAfter.digest,
    interfaces,
    chatRequestDigest: recordDigest(chatRequests),
    providerRequestCount: requests.length,
    subjectUid: process.getuid(),
    nativePermission: { '*': 'deny', skill: 'allow' }
  });
  outputRows[variant] = parsedOutput.output;
  sessionRows.push({
    variant,
    observationRenderDigest: variant === 'CONTROL' ? difference.controlRenderDigest : difference.treatmentRenderDigest,
    installedMemberManifestDigest,
    hostSessionIdentityDigest: sessionIdentityDigest,
    runningHostBuildDigest,
    liveConfigDigest,
    fixtureFactsDigest: challenge.publicChallenge.fixtureFactsDigest,
    outputReceiptDigest,
    attemptedEffects: 'NONE',
    effectEvidenceDigest
  });
  sessionEvidence.push({
    variant,
    nativeDiscoveryDigest: recordDigest(discovered),
    discoveryAdapterObservationDigest: discoveryObservation.observationDigest,
    advisoryAdapterObservationDigest: adapterObservation.observationDigest,
    advisoryInvocationDigest: advisoryInvocation.invocationDigest,
    outputReceiptDigest,
    eventTypes: parsedOutput.eventTypes,
    providerRequestCount: requests.length,
    chatRequestPhases: chatRequests.map((row) => row.phase),
    expectedOpenCodeStatePreprovisioned: true,
    repositoryUnchangedDuringModelRun: true,
    xdgStateDigest: xdgAfter.digest
  });
}

const outputsCommittedDigest = recordDigest(Object.fromEntries(Object.entries(outputRows).map(([variant, output]) => [variant, recordDigest({ variant, output })])));
const numericProcesses = fs.readdirSync('/proc').filter((name) => /^[0-9]+$/u.test(name));
const processRows = numericProcesses.map((name) => {
  let status = '';
  let command = '';
  try { status = fs.readFileSync(`/proc/${name}/status`, 'utf8').match(/^State:\s+([^\n]+)/mu)?.[1] ?? ''; } catch {}
  try { command = fs.readFileSync(`/proc/${name}/comm`, 'utf8').trim(); } catch {}
  return { pid: Number(name), status, command };
}).sort((left, right) => left.pid - right.pid);
const orphanRows = processRows.filter((row) => ![1, process.pid, provider.pid].includes(row.pid));
const orphanCount = orphanRows.length;
const effectBlockerEvidence = {
  userNamespace: fs.readlinkSync('/proc/self/ns/user'),
  networkNamespace: fs.readlinkSync('/proc/self/ns/net'),
  mountNamespace: fs.readlinkSync('/proc/self/ns/mnt'),
  pidNamespace: fs.readlinkSync('/proc/self/ns/pid'),
  pid1ReaperSourceSha256: sha256Hex(fs.readFileSync(new URL('./kstack-pid1-reaper.c', import.meta.url))),
  pid1ReaperBinarySha256: sha256Hex(fs.readFileSync('/proc/1/exe')),
  loopbackOnly,
  subjectUid: process.getuid(),
  namespaceUidMap: fs.readFileSync('/proc/self/uid_map', 'utf8').trim(),
  noNewPrivileges: true,
  capabilitiesDropped: true,
  nativePermission: { '*': 'deny', skill: 'allow' },
  credentialsPresent: false,
  providerAdvanceTokenKnowledge: false,
  outputsCommittedBeforeReveal: true,
  orphanCount,
  orphanRows
};
const observation = createOpenCodeDiscoveryObservation({
  publicChallenge: challenge.publicChallenge,
  protectedTokens: challenge.protectedTokens,
  sessions: sessionRows,
  outputs: { CONTROL: outputRows.CONTROL, TREATMENT: outputRows.TREATMENT },
  expectedRunningHostBuildDigest: runningHostBuildDigest,
  expectedLiveConfigDigest: liveConfigDigest,
  adjudicatorConfigDigest: recordDigest({ exactOutput: true, outputBytesMaximum: 64, requireNoEffects: true, requireTwoNativeToolTurns: true }),
  effectBlockerEvidenceDigest: recordDigest(effectBlockerEvidence),
  revealEvidenceDigest: recordDigest({ outputsCommittedDigest, commitments: [challenge.publicChallenge.controlTokenCommitmentDigest, challenge.publicChallenge.treatmentTokenCommitmentDigest] }),
  variantDifferenceEvidence: difference,
  ambientInputs: [fixturePrompt, configText, JSON.stringify(['--pure', 'run', '--format', 'json', '--model', 'kstack/kstack-qualification'])],
  ambiguous: false
});

provider.kill('SIGTERM');
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { provider.kill('SIGKILL'); reject(new Error('synthetic provider did not exit')); }, 5_000);
  provider.once('close', () => { clearTimeout(timeout); resolve(); });
});

const providerRequests = readProviderRequests();
const result = {
  schema: 'kstack-opencode-v1.18.25-isolated-cell-v1',
  sourceEvidence: {
    releaseTag: 'v1.18.25',
    releasePublishedAt: '2026-08-28T05:58:20Z',
    releaseTagObjectCommit: 'cb7d8b2f5e44876ef98b661dc10590c915af3a9f',
    releaseTagObjectVerified: false,
    releaseTargetCommit: '733562e92a96255fb123aae92f267e4534a635fb',
    releaseTargetCommitVerified: true,
    assetName: 'opencode-linux-x64.tar.gz',
    assetSha256: '58a3729a6f3432dd6d2917fcc4a949788891a035818646ad480e12c947f56e78',
    sourceArchiveSha256: '44e9530d7be172005c7d60aef317440eecb85d557d94cce7fa35c5a7b9d9da0b'
  },
  binary: {
    version: '1.18.25',
    sha256: binarySha256,
    bytes: binaryBytes.length,
    elfBuildId: 'c30f169b1bef81fa57467cd091ba53aab5235468'
  },
  adapter: {
    sha256: adapterSha256,
    profile: OPENCODE_ADAPTER_PROFILE,
    observations: sessionEvidence.map((row) => ({
      variant: row.variant,
      discoveryObservationDigest: row.discoveryAdapterObservationDigest,
      advisoryObservationDigest: row.advisoryAdapterObservationDigest,
      advisoryInvocationDigest: row.advisoryInvocationDigest
    })).sort((a, b) => compare(a.variant, b.variant))
  },
  runningHostBuildDigest,
  liveConfigDigest,
  interfaces,
  loopbackOnly,
  effectBlockerEvidence,
  providerRequestCount: providerRequests.length,
  providerRequestDigest: recordDigest(providerRequests),
  sessionEvidence: sessionEvidence.sort((a, b) => compare(a.variant, b.variant)),
  variantDifferenceEvidenceDigest: difference.variantDifferenceEvidenceDigest,
  discoveryObservation: observation.observation,
  discoveryObservationDigest: observation.discoveryObservationDigest,
  maximumClaim: 'NO_OPERATION_QUALIFICATION',
  aggregate: observation.observation.outcome === 'OBSERVED' && orphanCount === 0 && loopbackOnly ? 'PASS' : 'FAIL'
};
result.evidenceDigest = recordDigest(result);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
