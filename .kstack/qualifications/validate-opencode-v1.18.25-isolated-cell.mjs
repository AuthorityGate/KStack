import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateOpenCodeDiscoveryObservation } from '../../plugins/kstack/scripts/kstack-opencode-candidate.mjs';
import { OPENCODE_ADAPTER_PROFILE } from '../../plugins/kstack/scripts/kstack-opencode-adapter.mjs';

const [assetPath, binaryPath, sourceArchivePath] = process.argv.slice(2);
if (![assetPath, binaryPath, sourceArchivePath].every((value) => value && path.isAbsolute(value))) {
  process.stderr.write('usage: validate-opencode-v1.18.25-isolated-cell.mjs ABSOLUTE_ASSET_ARCHIVE ABSOLUTE_BINARY ABSOLUTE_SOURCE_ARCHIVE\n');
  process.exit(2);
}

const evidencePath = fileURLToPath(new URL('./opencode-v1.18.25-isolated-cell-evidence.json', import.meta.url));
const provenancePath = fileURLToPath(new URL('./opencode-v1.18.25-provenance.json', import.meta.url));
const candidatePath = fileURLToPath(new URL('../../plugins/kstack/scripts/kstack-opencode-candidate.mjs', import.meta.url));
const adapterPath = fileURLToPath(new URL('../../plugins/kstack/scripts/kstack-opencode-adapter.mjs', import.meta.url));
const reaperSourcePath = fileURLToPath(new URL('./kstack-pid1-reaper.c', import.meta.url));
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));

const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex');
const digest = (value) => `sha256:${sha256Hex(Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)))}`;
const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])])) : value;
const recordDigest = (value) => digest(JSON.stringify(canonical(value)));
const fail = (message) => { throw new Error(`OpenCode v1.18.25 qualification invalid: ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };
const fileSha = (filename) => sha256Hex(fs.readFileSync(filename));

assert(provenance.schema === 'kstack-opencode-provenance-v1' && provenance.product === 'opencode' && provenance.version === '1.18.25', 'provenance identity');
assert(provenance.release.tag === 'v1.18.25', 'release tag');
assert(provenance.release.tagRefObjectSha === 'cb7d8b2f5e44876ef98b661dc10590c915af3a9f', 'tag ref object');
assert(provenance.release.tagRefObjectVerified === false && provenance.release.tagRefObjectVerificationReason === 'unsigned', 'unsigned tag object must remain explicit');
assert(provenance.release.targetCommitSha === '733562e92a96255fb123aae92f267e4534a635fb', 'target commit');
assert(provenance.release.targetCommitVerified === true && provenance.release.targetCommitVerificationReason === 'valid', 'verified target commit');
assert(provenance.release.claim === 'TARGET_COMMIT_VERIFIED_RELEASE_TAG_OBJECT_UNSIGNED', 'supply-chain claim boundary');

for (const [filename, expectedSha, expectedBytes] of [
  [assetPath, provenance.asset.observedSha256, provenance.asset.bytes],
  [binaryPath, provenance.binary.sha256, provenance.binary.bytes],
  [sourceArchivePath, provenance.sourceArchive.sha256, provenance.sourceArchive.bytes]
]) {
  const stat = fs.statSync(filename);
  assert(stat.isFile() && stat.size === expectedBytes && fileSha(filename) === expectedSha, `artifact mismatch: ${path.basename(filename)}`);
}
assert(provenance.asset.githubPublishedSha256 === provenance.asset.observedSha256, 'asset did not match GitHub-published digest');
const archiveList = spawnSync('/usr/bin/tar', ['-tf', assetPath], { encoding: 'utf8', timeout: 20_000, maxBuffer: 1024 * 1024 });
assert(archiveList.status === 0, 'asset archive listing failed');
assert(JSON.stringify(archiveList.stdout.split('\n').filter(Boolean)) === JSON.stringify(provenance.asset.archiveMembers), 'asset archive members');

for (const [relative, expectedSha] of Object.entries(provenance.officialSourceFiles)) {
  const extracted = spawnSync('/usr/bin/tar', ['-xOf', sourceArchivePath, `${provenance.sourceArchive.root}${relative}`], {
    encoding: null, timeout: 20_000, maxBuffer: 8 * 1024 * 1024
  });
  assert(extracted.status === 0 && sha256Hex(extracted.stdout) === expectedSha, `official source file mismatch: ${relative}`);
}
const readelf = spawnSync('/usr/bin/readelf', ['-n', binaryPath], { encoding: 'utf8', timeout: 20_000 });
assert(readelf.status === 0 && readelf.stdout.includes(`Build ID: ${provenance.binary.buildId}`), 'ELF build ID');
const versionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-opencode-version-'));
const version = spawnSync(binaryPath, ['--version'], {
  cwd: versionRoot,
  env: {
    HOME: versionRoot,
    XDG_DATA_HOME: path.join(versionRoot, 'data'),
    XDG_CONFIG_HOME: path.join(versionRoot, 'config'),
    XDG_CACHE_HOME: path.join(versionRoot, 'cache'),
    XDG_STATE_HOME: path.join(versionRoot, 'state'),
    LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', PATH: '/usr/bin:/bin', TZ: 'UTC',
    OPENCODE_DISABLE_AUTOUPDATE: '1', OPENCODE_DISABLE_MODELS_FETCH: '1', OPENCODE_PURE: '1'
  },
  encoding: 'utf8', timeout: 20_000
});
fs.rmSync(versionRoot, { recursive: true, force: true });
assert(version.status === 0 && version.stdout.trim() === provenance.binary.observedVersion, 'live version observation');

assert(evidence.schema === 'kstack-opencode-v1.18.25-isolated-cell-v1' && evidence.aggregate === 'PASS', 'cell aggregate');
const evidenceBody = { ...evidence };
delete evidenceBody.evidenceDigest;
assert(evidence.evidenceDigest === recordDigest(evidenceBody), 'evidence digest');
assert(evidence.binary.version === provenance.version && evidence.binary.sha256 === provenance.binary.sha256
  && evidence.binary.bytes === provenance.binary.bytes && evidence.binary.elfBuildId === provenance.binary.buildId, 'cell binary binding');
assert(evidence.adapter.sha256 === fileSha(adapterPath), 'adapter byte binding');
assert(JSON.stringify(evidence.adapter.profile) === JSON.stringify(OPENCODE_ADAPTER_PROFILE), 'adapter profile binding');
assert(Array.isArray(evidence.adapter.observations) && evidence.adapter.observations.length === 2
  && evidence.adapter.observations[0].variant === 'CONTROL' && evidence.adapter.observations[1].variant === 'TREATMENT', 'adapter observation membership');
for (const row of evidence.adapter.observations) {
  for (const field of ['discoveryObservationDigest', 'advisoryObservationDigest', 'advisoryInvocationDigest']) {
    assert(/^[0-9a-f]{64}$/u.test(row[field]), `adapter ${row.variant} ${field}`);
  }
}
assert(evidence.sourceEvidence.releaseTag === provenance.release.tag
  && evidence.sourceEvidence.releasePublishedAt === provenance.release.publishedAt
  && evidence.sourceEvidence.releaseTagObjectCommit === provenance.release.tagRefObjectSha
  && evidence.sourceEvidence.releaseTagObjectVerified === provenance.release.tagRefObjectVerified
  && evidence.sourceEvidence.releaseTargetCommit === provenance.release.targetCommitSha
  && evidence.sourceEvidence.releaseTargetCommitVerified === provenance.release.targetCommitVerified
  && evidence.sourceEvidence.assetSha256 === provenance.asset.observedSha256
  && evidence.sourceEvidence.sourceArchiveSha256 === provenance.sourceArchive.sha256, 'cell provenance binding');

const expectedConfig = {
  $schema: 'https://opencode.ai/config.json',
  autoupdate: false,
  share: 'disabled',
  permission: { '*': 'deny', skill: 'allow' },
  provider: {
    kstack: {
      npm: '@ai-sdk/openai-compatible',
      name: 'KStack loopback qualification provider',
      options: { baseURL: 'http://127.0.0.1:49153/v1' },
      models: { 'kstack-qualification': { name: 'KStack qualification model' } }
    }
  }
};
const expectedConfigDigest = recordDigest(expectedConfig);
const expectedBuildDigest = recordDigest({
  product: 'opencode', version: '1.18.25', binarySha256: provenance.binary.sha256,
  releaseTag: provenance.release.tag, releaseTagObjectCommit: provenance.release.tagRefObjectSha,
  releaseTargetCommit: provenance.release.targetCommitSha
});
assert(evidence.liveConfigDigest === expectedConfigDigest && evidence.runningHostBuildDigest === expectedBuildDigest, 'live build/config binding');
assert(evidence.discoveryObservation.registrySetDigest === digest(fs.readFileSync(candidatePath)), 'candidate implementation binding');
assert(evidence.interfaces.length === 1 && evidence.interfaces[0] === 'lo' && evidence.loopbackOnly === true, 'loopback-only namespace');
const blocker = evidence.effectBlockerEvidence;
assert(blocker.loopbackOnly === true && blocker.namespaceUidMap === '0       1000          1', 'user/network namespace binding');
assert(blocker.noNewPrivileges === true && blocker.capabilitiesDropped === true, 'privilege drop');
assert(blocker.nativePermission?.['*'] === 'deny' && blocker.nativePermission?.skill === 'allow', 'native permission profile');
assert(blocker.credentialsPresent === false && blocker.providerAdvanceTokenKnowledge === false, 'credential/token isolation');
assert(blocker.outputsCommittedBeforeReveal === true, 'commit before reveal');
assert(blocker.pid1ReaperSourceSha256 === sha256Hex(fs.readFileSync(reaperSourcePath))
  && /^[0-9a-f]{64}$/u.test(blocker.pid1ReaperBinarySha256), 'PID-1 reaper binding');
assert(blocker.orphanCount === 0 && Array.isArray(blocker.orphanRows) && blocker.orphanRows.length === 0, 'zero orphans');

assert(evidence.providerRequestCount === 4 && /^sha256:[0-9a-f]{64}$/u.test(evidence.providerRequestDigest), 'provider transcript closure');
assert(Array.isArray(evidence.sessionEvidence) && evidence.sessionEvidence.length === 2
  && evidence.sessionEvidence[0].variant === 'CONTROL' && evidence.sessionEvidence[1].variant === 'TREATMENT', 'paired session evidence');
for (const session of evidence.sessionEvidence) {
  assert(session.providerRequestCount === 2, `${session.variant} provider request count`);
  assert(JSON.stringify(session.chatRequestPhases) === JSON.stringify(['BEFORE_NATIVE_SKILL_RESULT', 'AFTER_NATIVE_SKILL_RESULT']), `${session.variant} native skill mediation`);
  assert(JSON.stringify(session.eventTypes) === JSON.stringify(['step_start', 'tool_use', 'step_finish', 'step_start', 'text', 'step_finish']), `${session.variant} event sequence`);
  assert(session.expectedOpenCodeStatePreprovisioned === true && session.repositoryUnchangedDuringModelRun === true, `${session.variant} filesystem effects`);
  const adapterRow = evidence.adapter.observations.find((row) => row.variant === session.variant);
  assert(adapterRow.discoveryObservationDigest === session.discoveryAdapterObservationDigest
    && adapterRow.advisoryObservationDigest === session.advisoryAdapterObservationDigest
    && adapterRow.advisoryInvocationDigest === session.advisoryInvocationDigest, `${session.variant} adapter observation binding`);
}

const validatedObservation = validateOpenCodeDiscoveryObservation(evidence.discoveryObservation);
assert(validatedObservation.discoveryObservationDigest === evidence.discoveryObservationDigest, 'discovery observation digest');
assert(evidence.discoveryObservation.outcome === 'OBSERVED' && evidence.discoveryObservation.reasonCodes.length === 0, 'causal discovery outcome');
assert(evidence.discoveryObservation.sessions.length === 2
  && evidence.discoveryObservation.sessions[0].variant === 'CONTROL'
  && evidence.discoveryObservation.sessions[1].variant === 'TREATMENT', 'observation session order');
const [control, treatment] = evidence.discoveryObservation.sessions;
assert(control.hostSessionIdentityDigest !== treatment.hostSessionIdentityDigest, 'independent host sessions');
assert(control.observationRenderDigest !== treatment.observationRenderDigest, 'distinct closed challenge renders');
assert(control.outputReceiptDigest !== treatment.outputReceiptDigest && control.committedTypedOutputDigest !== treatment.committedTypedOutputDigest, 'distinct committed outputs');
assert([control, treatment].every((row) => row.attemptedEffects === 'NONE'
  && row.runningHostBuildDigest === evidence.runningHostBuildDigest
  && row.liveConfigDigest === evidence.liveConfigDigest), 'session currentness/effects');
assert(evidence.maximumClaim === 'NO_OPERATION_QUALIFICATION', 'claim ceiling');

process.stdout.write(`${JSON.stringify({
  result: 'PASS',
  evidenceDigest: evidence.evidenceDigest,
  discoveryObservationDigest: evidence.discoveryObservationDigest,
  provenanceDigest: recordDigest(provenance),
  binarySha256: provenance.binary.sha256,
  sourceArchiveSha256: provenance.sourceArchive.sha256,
  sessions: evidence.sessionEvidence.length,
  zeroOrphans: true,
  maximumClaim: evidence.maximumClaim
}, null, 2)}\n`);
