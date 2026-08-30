import crypto from 'node:crypto';
import { packCanonicalBytes } from './kstack-domain-schema.mjs';

const DIGEST = /^[a-f0-9]{64}$/u;
const ID = /^[a-z][a-z0-9._:-]{0,127}$/u;
const NS = /^(?:0|-?[1-9][0-9]{0,18})$/u;
const I64_MIN = -(1n << 63n);
const I64_MAX = (1n << 63n) - 1n;
const ZERO = '0'.repeat(64);
const POLICY_DOMAIN = 'KSTACK-TRUSTED-TIME-POLICY-V1\n';
const SOURCE_DOMAIN = 'KSTACK-TRUSTED-TIME-SOURCE-EVIDENCE-V1\n';
const INTERVAL_DOMAIN = 'KSTACK-TRUSTED-TIME-INTERVAL-V1\n';
const ANCHOR_DOMAIN = 'KSTACK-TIME-ANCHOR-V1\n';
const RECEIPT_DOMAIN = 'KSTACK-TRUSTED-TIME-RECEIPT-V1\n';
const POLICIES = new WeakSet();
const INTERVALS = new WeakSet();
const PUBLICATIONS = new WeakSet();

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function exact(value, keys, code) {
  const actual = plain(value) ? Object.keys(value).sort(compareUtf8) : [];
  const expected = [...keys].sort(compareUtf8);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}

function text(value, expression, code, maximum = 128) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !value.isWellFormed()
      || value.normalize('NFC') !== value || !expression.test(value)) fail(code);
  return value;
}

function digest(value, code) {
  return text(value, DIGEST, code, 64);
}

function integer(value, minimum, maximum, code) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) fail(code);
  return value;
}

function bool(value, code) {
  if (typeof value !== 'boolean') fail(code);
  return value;
}

function ns(value, code) {
  text(value, NS, code, 20);
  let parsed;
  try { parsed = BigInt(value); } catch { fail(code); }
  if (parsed < I64_MIN || parsed > I64_MAX || parsed.toString() !== value) fail(code);
  return parsed;
}

function nsText(value, code) {
  if (value < I64_MIN || value > I64_MAX) fail(code);
  return value.toString();
}

function addNs(...values) {
  const result = values.reduce((sum, value) => sum + value, 0n);
  if (result < I64_MIN || result > I64_MAX) fail('TRUSTED_TIME_UNAVAILABLE');
  return result;
}

function immutable(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

function domainDigest(domain, value) {
  return crypto.createHash('sha256').update(Buffer.from(domain)).update(packCanonicalBytes(value)).digest('hex');
}

function endpoint(value, code) {
  return text(value, /^[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9._:[\]-]+(?::[0-9]{1,5})?$/u, code, 256);
}

function adapter(input, witness, code) {
  const keys = witness
    ? ['witnessId', 'adapterId', 'adapterVersion', 'endpointIdentity', 'trustMaterialDigest', 'independenceGroupId', 'namespaceId']
    : ['sourceId', 'adapterId', 'adapterVersion', 'endpointIdentity', 'trustMaterialDigest', 'independenceGroupId'];
  exact(input, keys, code);
  const output = {
    [witness ? 'witnessId' : 'sourceId']: text(input[witness ? 'witnessId' : 'sourceId'], ID, code),
    adapterId: text(input.adapterId, ID, code), adapterVersion: text(input.adapterVersion, ID, code),
    endpointIdentity: endpoint(input.endpointIdentity, code), trustMaterialDigest: digest(input.trustMaterialDigest, code),
    independenceGroupId: text(input.independenceGroupId, ID, code)
  };
  if (witness) output.namespaceId = text(input.namespaceId, ID, code);
  return output;
}

function sortedUniqueBy(records, key, code) {
  const values = records.map((entry) => entry[key]);
  if (new Set(values).size !== values.length || values.some((entry, index) => entry !== [...values].sort(compareUtf8)[index])) fail(code);
}

function policyRecord(input) {
  const code = 'TRUSTED_TIME_POLICY_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'sources', 'rollbackWitnesses',
    'minimumRemoteSources', 'minimumIndependenceGroups', 'minimumRollbackWitnesses',
    'minimumWitnessIndependenceGroups', 'maxSampleAgeMs', 'maxIntervalWidthMs',
    'maxWallMonotonicDivergenceMs', 'maxFutureEvidenceSkewMs', 'rollbackToleranceMs', 'policyVersion'
  ], code);
  if (input.artifactType !== 'kstack-trusted-time-policy' || input.schemaVersion !== 1
      || !Array.isArray(input.sources) || !Array.isArray(input.rollbackWitnesses)) fail(code);
  const sources = input.sources.map((entry) => adapter(entry, false, code));
  const rollbackWitnesses = input.rollbackWitnesses.map((entry) => adapter(entry, true, code));
  sortedUniqueBy(sources, 'sourceId', code); sortedUniqueBy(rollbackWitnesses, 'witnessId', code);
  const minimumRemoteSources = integer(input.minimumRemoteSources, 2, sources.length, code);
  const minimumIndependenceGroups = integer(input.minimumIndependenceGroups, 2, sources.length, code);
  const minimumRollbackWitnesses = integer(input.minimumRollbackWitnesses, 2, rollbackWitnesses.length, code);
  const minimumWitnessIndependenceGroups = integer(input.minimumWitnessIndependenceGroups, 2, rollbackWitnesses.length, code);
  if (new Set(sources.map((entry) => entry.independenceGroupId)).size < minimumIndependenceGroups
      || new Set(rollbackWitnesses.map((entry) => entry.independenceGroupId)).size < minimumWitnessIndependenceGroups
      || new Set(rollbackWitnesses.map((entry) => entry.namespaceId)).size !== rollbackWitnesses.length) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1, projectId: text(input.projectId, ID, code), sources, rollbackWitnesses,
    minimumRemoteSources, minimumIndependenceGroups, minimumRollbackWitnesses, minimumWitnessIndependenceGroups,
    maxSampleAgeMs: integer(input.maxSampleAgeMs, 1, 86_400_000, code),
    maxIntervalWidthMs: integer(input.maxIntervalWidthMs, 1, 60_000, code),
    maxWallMonotonicDivergenceMs: integer(input.maxWallMonotonicDivergenceMs, 0, 86_400_000, code),
    maxFutureEvidenceSkewMs: integer(input.maxFutureEvidenceSkewMs, 0, 86_400_000, code),
    rollbackToleranceMs: integer(input.rollbackToleranceMs, 0, 60_000, code),
    policyVersion: integer(input.policyVersion, 1, 2_147_483_647, code)
  };
}

export function createTrustedTimePolicy(input) {
  const record = policyRecord({ artifactType: 'kstack-trusted-time-policy', schemaVersion: 1, ...input });
  const canonicalBytes = packCanonicalBytes(record);
  return immutable({ record, canonicalBytes, policyDigest: domainDigest(POLICY_DOMAIN, record) });
}

export function validateTrustedTimePolicy(input) {
  const code = 'TRUSTED_TIME_POLICY_INVALID';
  exact(input, ['policyBytes', 'expectedPolicyDigest', 'protection'], code);
  exact(input.protection, ['repositoryResident', 'brokerProtected', 'ownerCeremonyDigest'], code);
  if (input.protection.repositoryResident !== false || input.protection.brokerProtected !== true) fail(code);
  digest(input.protection.ownerCeremonyDigest, code);
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input.policyBytes)); } catch { fail(code); }
  const record = policyRecord(parsed);
  const canonicalBytes = packCanonicalBytes(record);
  if (!canonicalBytes.equals(Buffer.from(input.policyBytes))) fail(code);
  const policyDigest = domainDigest(POLICY_DOMAIN, record);
  if (policyDigest !== digest(input.expectedPolicyDigest, code)) fail(code);
  const result = immutable({ record, canonicalBytes, policyDigest, protection: { ...input.protection } });
  POLICIES.add(result);
  return result;
}

function sourceEvidence(input, policy, localMonotonicNs) {
  const code = 'TRUSTED_TIME_UNAVAILABLE';
  exact(input, [
    'artifactType', 'schemaVersion', 'sourceId', 'adapterId', 'adapterVersion',
    'endpointIdentity', 'trustMaterialDigest', 'independenceGroupId', 'requestNonce',
    'requestMonotonicNs', 'responseMonotonicNs', 'remoteLowerUtcNs', 'remoteUpperUtcNs',
    'authenticatedUncertaintyNs', 'authenticated', 'correlated', 'protocolVersionQualified',
    'eraKnown', 'leapStateKnown', 'complete', 'evidenceDigest'
  ], code);
  if (input.artifactType !== 'kstack-trusted-time-source-evidence' || input.schemaVersion !== 1) fail(code);
  const configured = policy.sources.find((entry) => entry.sourceId === input.sourceId);
  if (!configured || ['adapterId', 'adapterVersion', 'endpointIdentity', 'trustMaterialDigest', 'independenceGroupId']
    .some((key) => input[key] !== configured[key])) fail(code);
  for (const key of ['authenticated', 'correlated', 'protocolVersionQualified', 'eraKnown', 'leapStateKnown', 'complete']) {
    if (input[key] !== true) fail(code);
  }
  const requestMono = ns(input.requestMonotonicNs, code);
  const responseMono = ns(input.responseMonotonicNs, code);
  const remoteLower = ns(input.remoteLowerUtcNs, code);
  const remoteUpper = ns(input.remoteUpperUtcNs, code);
  const uncertainty = ns(input.authenticatedUncertaintyNs, code);
  if (requestMono < 0n || responseMono < requestMono || localMonotonicNs < responseMono
      || uncertainty < 0n || remoteLower > remoteUpper
      || localMonotonicNs - responseMono > BigInt(policy.maxSampleAgeMs) * 1_000_000n) fail(code);
  const rtt = responseMono - requestMono;
  const lower = addNs(remoteLower, -uncertainty, -rtt);
  const upper = addNs(remoteUpper, uncertainty, rtt);
  const record = { ...input };
  const expectedEvidenceDigest = domainDigest(SOURCE_DOMAIN, { ...record, evidenceDigest: ZERO });
  if (input.evidenceDigest !== expectedEvidenceDigest) fail(code);
  return { record, evidenceDigest: input.evidenceDigest, lower, upper, responseMono, independenceGroupId: configured.independenceGroupId };
}

export function createTrustedTimeSourceEvidence(input) {
  const record = { artifactType: 'kstack-trusted-time-source-evidence', schemaVersion: 1, ...input, evidenceDigest: ZERO };
  const evidenceDigest = domainDigest(SOURCE_DOMAIN, record);
  const complete = { ...record, evidenceDigest };
  return immutable({ record: complete, canonicalBytes: packCanonicalBytes(complete), evidenceDigest });
}

export function qualifyTrustedTimeInterval(input) {
  const code = 'TRUSTED_TIME_UNAVAILABLE';
  exact(input, ['validatedPolicy', 'samples', 'localObservation'], code);
  if (!input.validatedPolicy || !POLICIES.has(input.validatedPolicy) || !Array.isArray(input.samples)) fail(code);
  exact(input.localObservation, ['bootIdDigest', 'monotonicNs', 'wallUtcNs'], code);
  const localMonotonicNs = ns(input.localObservation.monotonicNs, code);
  ns(input.localObservation.wallUtcNs, code); digest(input.localObservation.bootIdDigest, code);
  const policy = input.validatedPolicy.record;
  const samples = input.samples.map((entry) => sourceEvidence(entry, policy, localMonotonicNs));
  if (samples.length < policy.minimumRemoteSources || new Set(samples.map((entry) => entry.record.sourceId)).size !== samples.length
      || new Set(samples.map((entry) => entry.independenceGroupId)).size < policy.minimumIndependenceGroups) fail(code);
  const lower = samples.reduce((maximum, entry) => entry.lower > maximum ? entry.lower : maximum, I64_MIN);
  const upper = samples.reduce((minimum, entry) => entry.upper < minimum ? entry.upper : minimum, I64_MAX);
  if (lower > upper || upper - lower > BigInt(policy.maxIntervalWidthMs) * 1_000_000n) fail(code);
  const record = {
    artifactType: 'kstack-trusted-time-interval', schemaVersion: 1,
    projectId: policy.projectId, policyDigest: input.validatedPolicy.policyDigest,
    bootIdDigest: input.localObservation.bootIdDigest, sampledMonotonicNs: localMonotonicNs.toString(),
    sampledWallUtcNs: input.localObservation.wallUtcNs,
    lowerUtcNs: lower.toString(), upperUtcNs: upper.toString(),
    sourceEvidenceDigests: samples.map((entry) => entry.evidenceDigest).sort(compareUtf8)
  };
  const result = immutable({
    policy: input.validatedPolicy, record, intervalDigest: domainDigest(INTERVAL_DOMAIN, record), samples
  });
  INTERVALS.add(result);
  return result;
}

function witnessState(input, configured, code) {
  exact(input, ['witnessId', 'namespaceId', 'sequence', 'anchorHeadDigest', 'signed', 'durable', 'linearizable', 'receiptDigest'], code);
  if (input.witnessId !== configured.witnessId || input.namespaceId !== configured.namespaceId
      || input.signed !== true || input.durable !== true || input.linearizable !== true) fail(code);
  return {
    witnessId: input.witnessId, namespaceId: input.namespaceId,
    sequence: integer(input.sequence, 0, Number.MAX_SAFE_INTEGER, code),
    anchorHeadDigest: digest(input.anchorHeadDigest, code), signed: true, durable: true,
    linearizable: true, receiptDigest: digest(input.receiptDigest, code)
  };
}

async function witnessCapabilities(client, configured) {
  const code = 'TIME_WITNESS_CONFLICT';
  if (!client || typeof client.capabilities !== 'function' || typeof client.read !== 'function'
      || typeof client.compareAndSet !== 'function') fail(code);
  const capabilities = await client.capabilities();
  exact(capabilities, ['external', 'linearizableCas', 'authenticated', 'signedReceipts', 'durable', 'blindOverwriteUnsupported', 'deletionUnsupported'], code);
  if (Object.values(capabilities).some((value) => value !== true)) fail(code);
  return configured;
}

async function readWitnesses(policy, clients) {
  const code = 'TIME_WITNESS_CONFLICT';
  if (!Array.isArray(clients) || clients.length !== policy.record.rollbackWitnesses.length) fail(code);
  const byId = new Map(clients.map((entry) => {
    exact(entry, ['witnessId', 'client'], code);
    return [entry.witnessId, entry.client];
  }));
  if (byId.size !== clients.length) fail(code);
  const states = [];
  for (const configured of policy.record.rollbackWitnesses) {
    const client = byId.get(configured.witnessId);
    await witnessCapabilities(client, configured);
    states.push(witnessState(await client.read({ projectId: policy.record.projectId, namespaceId: configured.namespaceId }), configured, code));
  }
  if (states.length < policy.record.minimumRollbackWitnesses
      || new Set(policy.record.rollbackWitnesses.map((entry) => entry.independenceGroupId)).size < policy.record.minimumWitnessIndependenceGroups) fail(code);
  return { states, byId };
}

function absentWitnessState(input, configured) {
  const code = 'TIME_WITNESS_CONFLICT';
  exact(input, ['witnessId', 'namespaceId', 'absent', 'signed', 'durable', 'linearizable', 'receiptDigest'], code);
  if (input.witnessId !== configured.witnessId || input.namespaceId !== configured.namespaceId
      || input.absent !== true || input.signed !== true || input.durable !== true || input.linearizable !== true) fail(code);
  digest(input.receiptDigest, code);
}

export async function initializeTrustedTimeProtection(input) {
  const code = 'TIME_WITNESS_CONFLICT';
  exact(input, ['validatedPolicy', 'witnessClients', 'ledger', 'bootObservation', 'operationNonce'], code);
  if (!input.validatedPolicy || !POLICIES.has(input.validatedPolicy) || !input.ledger
      || typeof input.ledger.capabilities !== 'function' || typeof input.ledger.prepare !== 'function'
      || typeof input.ledger.bindAnchor !== 'function' || typeof input.ledger.commit !== 'function') fail(code);
  exact(input.bootObservation, ['bootIdDigest', 'monotonicNs', 'wallUtcNs'], code);
  digest(input.bootObservation.bootIdDigest, code); ns(input.bootObservation.monotonicNs, code); ns(input.bootObservation.wallUtcNs, code);
  const capabilities = await input.ledger.capabilities();
  exact(capabilities, ['durablePending', 'atomicCommit', 'appendOnly', 'readAfterWrite'], code);
  if (Object.values(capabilities).some((value) => value !== true)) fail(code);
  const policy = input.validatedPolicy;
  if (!Array.isArray(input.witnessClients) || input.witnessClients.length !== policy.record.rollbackWitnesses.length) fail(code);
  const byId = new Map(input.witnessClients.map((entry) => {
    exact(entry, ['witnessId', 'client'], code); return [entry.witnessId, entry.client];
  }));
  if (byId.size !== input.witnessClients.length) fail(code);
  for (const configured of policy.record.rollbackWitnesses) {
    const client = byId.get(configured.witnessId);
    await witnessCapabilities(client, configured);
    absentWitnessState(await client.read({ projectId: policy.record.projectId, namespaceId: configured.namespaceId }), configured);
  }
  const core = {
    artifactType: 'kstack-time-anchor-genesis-core', schemaVersion: 1,
    projectId: policy.record.projectId, sequence: 0, previousAnchorDigest: ZERO,
    policyDigest: policy.policyDigest, bootIdDigest: input.bootObservation.bootIdDigest,
    kernelRealtimeUtcNs: input.bootObservation.wallUtcNs, kernelMonotonicNs: input.bootObservation.monotonicNs,
    witnessNamespaces: policy.record.rollbackWitnesses.map((entry) => ({ witnessId: entry.witnessId, namespaceId: entry.namespaceId })),
    operationNonce: text(input.operationNonce, /^[a-f0-9]{64}$/u, code, 64)
  };
  const prepared = await input.ledger.prepare(core);
  exact(prepared, ['pendingId', 'durableWriteReceiptDigest', 'durable'], code);
  if (prepared.durable !== true) fail(code);
  const anchor = { ...core, artifactType: 'kstack-time-anchor-genesis', durableWriteReceiptDigest: digest(prepared.durableWriteReceiptDigest, code) };
  const anchorBytes = packCanonicalBytes(anchor);
  const anchorDigest = domainDigest('KSTACK-TIME-ANCHOR-GENESIS-V1\n', anchor);
  const bound = await input.ledger.bindAnchor({ pendingId: prepared.pendingId, anchorBytes, anchorDigest });
  if (!plain(bound) || bound.bound !== true || bound.durable !== true) fail(code);
  const witnessReceiptDigests = [];
  for (const configured of policy.record.rollbackWitnesses) {
    const response = await byId.get(configured.witnessId).compareAndSet({
      projectId: policy.record.projectId, namespaceId: configured.namespaceId,
      expectedAbsent: true, expectedSequence: null, expectedHeadDigest: null,
      newSequence: 0, newHeadDigest: anchorDigest, operationNonce: input.operationNonce
    });
    const state = witnessState(response, configured, code);
    if (state.sequence !== 0 || state.anchorHeadDigest !== anchorDigest) fail(code);
    witnessReceiptDigests.push(state.receiptDigest);
  }
  const committed = await input.ledger.commit({
    pendingId: prepared.pendingId, sequence: 0, anchorBytes, anchorDigest,
    witnessReceiptDigests: witnessReceiptDigests.sort(compareUtf8)
  });
  exact(committed, ['committed', 'durable', 'sequence', 'anchorHeadDigest', 'commitReceiptDigest'], code);
  if (committed.committed !== true || committed.durable !== true || committed.sequence !== 0
      || committed.anchorHeadDigest !== anchorDigest) fail(code);
  return immutable({
    anchor, anchorBytes, anchorDigest, commitReceiptDigest: digest(committed.commitReceiptDigest, code),
    localHead: {
      sequence: 0, anchorHeadDigest: anchorDigest, anchorBytes, durable: true,
      bootIdDigest: input.bootObservation.bootIdDigest, monotonicNs: input.bootObservation.monotonicNs,
      wallUtcNs: input.bootObservation.wallUtcNs, policyDigest: policy.policyDigest
    }
  });
}

function parseGenesisAnchor(bytes, expectedDigest, policy) {
  const code = 'TIME_WITNESS_CONFLICT';
  let input;
  try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(code); }
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'sequence', 'previousAnchorDigest',
    'policyDigest', 'bootIdDigest', 'kernelRealtimeUtcNs', 'kernelMonotonicNs',
    'witnessNamespaces', 'operationNonce', 'durableWriteReceiptDigest'
  ], code);
  if (input.artifactType !== 'kstack-time-anchor-genesis' || input.schemaVersion !== 1
      || input.projectId !== policy.record.projectId || input.sequence !== 0
      || input.previousAnchorDigest !== ZERO || input.policyDigest !== policy.policyDigest) fail(code);
  for (const field of ['policyDigest', 'bootIdDigest', 'durableWriteReceiptDigest']) digest(input[field], code);
  ns(input.kernelRealtimeUtcNs, code); ns(input.kernelMonotonicNs, code);
  text(input.operationNonce, /^[a-f0-9]{64}$/u, code, 64);
  const expectedNamespaces = policy.record.rollbackWitnesses.map((entry) => ({ witnessId: entry.witnessId, namespaceId: entry.namespaceId }));
  if (!Array.isArray(input.witnessNamespaces)
      || !packCanonicalBytes(input.witnessNamespaces).equals(packCanonicalBytes(expectedNamespaces))) fail(code);
  const canonicalBytes = packCanonicalBytes(input);
  if (!canonicalBytes.equals(Buffer.from(bytes))
      || domainDigest('KSTACK-TIME-ANCHOR-GENESIS-V1\n', input) !== digest(expectedDigest, code)) fail(code);
  return input;
}

export async function recoverTrustedTimeGenesis(input) {
  const code = 'TIME_WITNESS_CONFLICT';
  exact(input, ['validatedPolicy', 'witnessClients', 'ledger'], code);
  if (!input.validatedPolicy || !POLICIES.has(input.validatedPolicy) || !input.ledger
      || typeof input.ledger.capabilities !== 'function' || typeof input.ledger.readPendingGenesis !== 'function'
      || typeof input.ledger.commit !== 'function') fail(code);
  const capabilities = await input.ledger.capabilities();
  exact(capabilities, ['durablePending', 'atomicCommit', 'appendOnly', 'readAfterWrite'], code);
  if (Object.values(capabilities).some((value) => value !== true)) fail(code);
  const pending = await input.ledger.readPendingGenesis();
  exact(pending, ['pendingId', 'anchorBytes', 'anchorDigest', 'operationNonce', 'durable'], code);
  if (pending.durable !== true) fail(code);
  digest(pending.anchorDigest, code); text(pending.operationNonce, /^[a-f0-9]{64}$/u, code, 64);
  const anchor = parseGenesisAnchor(pending.anchorBytes, pending.anchorDigest, input.validatedPolicy);
  if (anchor.operationNonce !== pending.operationNonce) fail(code);
  if (!Array.isArray(input.witnessClients) || input.witnessClients.length !== input.validatedPolicy.record.rollbackWitnesses.length) fail(code);
  const byId = new Map(input.witnessClients.map((entry) => {
    exact(entry, ['witnessId', 'client'], code); return [entry.witnessId, entry.client];
  }));
  if (byId.size !== input.witnessClients.length) fail(code);
  const receiptDigests = [];
  for (const configured of input.validatedPolicy.record.rollbackWitnesses) {
    const client = byId.get(configured.witnessId);
    await witnessCapabilities(client, configured);
    const state = await client.read({ projectId: input.validatedPolicy.record.projectId, namespaceId: configured.namespaceId });
    if (plain(state) && state.absent === true) {
      absentWitnessState(state, configured);
      const advanced = witnessState(await client.compareAndSet({
        projectId: input.validatedPolicy.record.projectId, namespaceId: configured.namespaceId,
        expectedAbsent: true, expectedSequence: null, expectedHeadDigest: null,
        newSequence: 0, newHeadDigest: pending.anchorDigest, operationNonce: pending.operationNonce
      }), configured, code);
      if (advanced.sequence !== 0 || advanced.anchorHeadDigest !== pending.anchorDigest) fail(code);
      receiptDigests.push(advanced.receiptDigest);
    } else {
      const advanced = witnessState(state, configured, code);
      if (advanced.sequence !== 0 || advanced.anchorHeadDigest !== pending.anchorDigest) fail(code);
      receiptDigests.push(advanced.receiptDigest);
    }
  }
  const committed = await input.ledger.commit({
    pendingId: pending.pendingId, sequence: 0, anchorBytes: Buffer.from(pending.anchorBytes),
    anchorDigest: pending.anchorDigest, witnessReceiptDigests: receiptDigests.sort(compareUtf8)
  });
  exact(committed, ['committed', 'durable', 'sequence', 'anchorHeadDigest', 'commitReceiptDigest'], code);
  if (committed.committed !== true || committed.durable !== true || committed.sequence !== 0
      || committed.anchorHeadDigest !== pending.anchorDigest) fail(code);
  return immutable({
    anchor, anchorBytes: Buffer.from(pending.anchorBytes), anchorDigest: pending.anchorDigest,
    commitReceiptDigest: digest(committed.commitReceiptDigest, code), recovered: true,
    localHead: {
      sequence: 0, anchorHeadDigest: pending.anchorDigest, anchorBytes: Buffer.from(pending.anchorBytes), durable: true,
      bootIdDigest: anchor.bootIdDigest, monotonicNs: anchor.kernelMonotonicNs,
      wallUtcNs: anchor.kernelRealtimeUtcNs, policyDigest: input.validatedPolicy.policyDigest
    }
  });
}

function localHead(input, policyDigest, code) {
  exact(input, ['sequence', 'anchorHeadDigest', 'anchorBytes', 'durable', 'bootIdDigest', 'monotonicNs', 'wallUtcNs', 'policyDigest'], code);
  if (input.durable !== true || input.policyDigest !== policyDigest) fail(code);
  return {
    sequence: integer(input.sequence, 0, Number.MAX_SAFE_INTEGER, code),
    anchorHeadDigest: digest(input.anchorHeadDigest, code), anchorBytes: Buffer.from(input.anchorBytes), durable: true,
    bootIdDigest: digest(input.bootIdDigest, code), monotonicNs: ns(input.monotonicNs, code),
    wallUtcNs: ns(input.wallUtcNs, code), policyDigest: input.policyDigest
  };
}

function assertWitnessAgreement(states, local) {
  const code = 'TIME_WITNESS_CONFLICT';
  const tuples = new Set(states.map((entry) => `${entry.sequence}\u0000${entry.anchorHeadDigest}`));
  if (tuples.size !== 1) fail(code);
  const witness = states[0];
  if (witness.sequence > local.sequence) fail('PROTECTED_STATE_ROLLBACK_DETECTED');
  if (witness.sequence !== local.sequence || witness.anchorHeadDigest !== local.anchorHeadDigest) fail(code);
}

function continuity(policy, previous, before, after) {
  const code = 'TRUSTED_TIME_UNAVAILABLE';
  digest(before.bootIdDigest, code); digest(after.bootIdDigest, code);
  const beforeMono = ns(before.monotonicNs, code); const afterMono = ns(after.monotonicNs, code);
  const beforeWall = ns(before.wallUtcNs, code); const afterWall = ns(after.wallUtcNs, code);
  if (before.bootIdDigest !== after.bootIdDigest || afterMono < beforeMono) fail(code);
  if (before.bootIdDigest !== previous.bootIdDigest) return { beforeMono, afterMono, beforeWall, afterWall };
  if (beforeMono < previous.monotonicNs) fail(code);
  const monotonicAdvance = afterMono - previous.monotonicNs;
  const wallAdvance = afterWall - previous.wallUtcNs;
  const divergence = wallAdvance >= monotonicAdvance ? wallAdvance - monotonicAdvance : monotonicAdvance - wallAdvance;
  if (wallAdvance < -BigInt(policy.rollbackToleranceMs) * 1_000_000n
      || divergence > BigInt(policy.maxWallMonotonicDivergenceMs) * 1_000_000n) fail(code);
  return { beforeMono, afterMono, beforeWall, afterWall };
}

export async function publishTrustedTime(input) {
  const code = 'TRUSTED_TIME_UNAVAILABLE';
  exact(input, ['qualifiedInterval', 'localBefore', 'localAfter', 'localState', 'witnessClients', 'ledger', 'operationNonce'], code);
  if (!input.qualifiedInterval || !INTERVALS.has(input.qualifiedInterval)) fail(code);
  const policy = input.qualifiedInterval.policy;
  if (!input.ledger || typeof input.ledger.capabilities !== 'function' || typeof input.ledger.prepare !== 'function'
      || typeof input.ledger.bindAnchor !== 'function' || typeof input.ledger.commit !== 'function') fail(code);
  const capabilities = await input.ledger.capabilities();
  exact(capabilities, ['durablePending', 'atomicCommit', 'appendOnly', 'readAfterWrite'], code);
  if (Object.values(capabilities).some((value) => value !== true)) fail(code);
  const previous = localHead(input.localState, policy.policyDigest, code);
  const { states, byId } = await readWitnesses(policy, input.witnessClients);
  assertWitnessAgreement(states, previous);
  exact(input.localBefore, ['bootIdDigest', 'monotonicNs', 'wallUtcNs'], code);
  exact(input.localAfter, ['bootIdDigest', 'monotonicNs', 'wallUtcNs'], code);
  if (input.localBefore.bootIdDigest !== input.qualifiedInterval.record.bootIdDigest) fail(code);
  const progress = continuity(policy.record, previous, input.localBefore, input.localAfter);
  const elapsed = progress.afterMono - ns(input.qualifiedInterval.record.sampledMonotonicNs, code);
  if (elapsed < 0n || elapsed > BigInt(policy.record.maxSampleAgeMs) * 1_000_000n) fail(code);
  const lower = ns(input.qualifiedInterval.record.lowerUtcNs, code);
  const upper = addNs(ns(input.qualifiedInterval.record.upperUtcNs, code), elapsed);
  const sequence = previous.sequence + 1;
  if (!Number.isSafeInteger(sequence)) fail(code);
  const core = {
    artifactType: 'kstack-time-anchor-core', schemaVersion: 1, projectId: policy.record.projectId,
    sequence, previousAnchorDigest: previous.anchorHeadDigest, bootIdDigest: input.localAfter.bootIdDigest,
    kernelRealtimeUtcNs: input.localAfter.wallUtcNs, kernelMonotonicNs: input.localAfter.monotonicNs,
    remoteLowerUtcNs: nsText(lower, code), remoteUpperUtcNs: nsText(upper, code),
    sourceEvidenceDigests: input.qualifiedInterval.record.sourceEvidenceDigests,
    policyDigest: policy.policyDigest, issuedAtIntervalDigest: input.qualifiedInterval.intervalDigest,
    operationNonce: text(input.operationNonce, /^[a-f0-9]{64}$/u, code, 64)
  };
  const prepared = await input.ledger.prepare(core);
  exact(prepared, ['pendingId', 'durableWriteReceiptDigest', 'durable'], code);
  if (prepared.durable !== true) fail(code);
  const anchor = { ...core, artifactType: 'kstack-time-anchor', durableWriteReceiptDigest: digest(prepared.durableWriteReceiptDigest, code) };
  const anchorBytes = packCanonicalBytes(anchor);
  const anchorDigest = domainDigest(ANCHOR_DOMAIN, anchor);
  const bound = await input.ledger.bindAnchor({ pendingId: prepared.pendingId, anchorBytes, anchorDigest });
  if (!plain(bound) || bound.durable !== true || bound.bound !== true) fail(code);
  const witnessReceipts = [];
  for (const configured of policy.record.rollbackWitnesses) {
    const response = await byId.get(configured.witnessId).compareAndSet({
      projectId: policy.record.projectId, namespaceId: configured.namespaceId,
      expectedSequence: previous.sequence, expectedHeadDigest: previous.anchorHeadDigest,
      newSequence: sequence, newHeadDigest: anchorDigest, operationNonce: input.operationNonce
    });
    const state = witnessState(response, configured, 'TIME_WITNESS_CONFLICT');
    if (state.sequence !== sequence || state.anchorHeadDigest !== anchorDigest) fail('TIME_WITNESS_CONFLICT');
    witnessReceipts.push(state.receiptDigest);
  }
  const committed = await input.ledger.commit({ pendingId: prepared.pendingId, sequence, anchorBytes, anchorDigest, witnessReceiptDigests: witnessReceipts.sort(compareUtf8) });
  exact(committed, ['committed', 'durable', 'sequence', 'anchorHeadDigest', 'commitReceiptDigest'], code);
  if (committed.committed !== true || committed.durable !== true || committed.sequence !== sequence
      || committed.anchorHeadDigest !== anchorDigest) fail(code);
  const reread = await readWitnesses(policy, input.witnessClients);
  if (reread.states.some((entry) => entry.sequence !== sequence || entry.anchorHeadDigest !== anchorDigest)) fail('TIME_WITNESS_CONFLICT');
  const receipt = {
    artifactType: 'kstack-trusted-time-receipt', schemaVersion: 1, projectId: policy.record.projectId,
    policyDigest: policy.policyDigest, anchorSequence: sequence, anchorDigest,
    rollbackWitnessReceiptDigests: witnessReceipts.sort(compareUtf8), witnessedSequence: sequence,
    witnessedAnchorHeadDigest: anchorDigest, bootIdDigest: input.localAfter.bootIdDigest,
    sourceEvidenceDigests: input.qualifiedInterval.record.sourceEvidenceDigests,
    lowerUtcNs: nsText(lower, code), upperUtcNs: nsText(upper, code),
    monotonicNs: input.localAfter.monotonicNs, wallUtcNs: input.localAfter.wallUtcNs,
    issuedAtIntervalDigest: input.qualifiedInterval.intervalDigest
  };
  const result = immutable({
    policy, anchor, anchorBytes, anchorDigest, receipt, receiptBytes: packCanonicalBytes(receipt),
    receiptDigest: domainDigest(RECEIPT_DOMAIN, receipt), commitReceiptDigest: digest(committed.commitReceiptDigest, code),
    publicationMonotonicNs: progress.afterMono.toString()
  });
  PUBLICATIONS.add(result);
  return result;
}

function parseRecoveryAnchor(bytes, expectedDigest, policy) {
  const code = 'TIME_WITNESS_CONFLICT';
  let input;
  try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(code); }
  exact(input, [
    'artifactType', 'schemaVersion', 'projectId', 'sequence', 'previousAnchorDigest',
    'bootIdDigest', 'kernelRealtimeUtcNs', 'kernelMonotonicNs', 'remoteLowerUtcNs',
    'remoteUpperUtcNs', 'sourceEvidenceDigests', 'policyDigest', 'issuedAtIntervalDigest',
    'operationNonce', 'durableWriteReceiptDigest'
  ], code);
  if (input.artifactType !== 'kstack-time-anchor' || input.schemaVersion !== 1
      || input.projectId !== policy.record.projectId || input.policyDigest !== policy.policyDigest) fail(code);
  integer(input.sequence, 1, Number.MAX_SAFE_INTEGER, code);
  for (const field of ['previousAnchorDigest', 'bootIdDigest', 'policyDigest', 'issuedAtIntervalDigest', 'durableWriteReceiptDigest']) digest(input[field], code);
  for (const field of ['kernelRealtimeUtcNs', 'kernelMonotonicNs', 'remoteLowerUtcNs', 'remoteUpperUtcNs']) ns(input[field], code);
  if (!Array.isArray(input.sourceEvidenceDigests) || input.sourceEvidenceDigests.length < policy.record.minimumRemoteSources) fail(code);
  const sources = input.sourceEvidenceDigests.map((entry) => digest(entry, code));
  if (new Set(sources).size !== sources.length || sources.some((entry, index) => entry !== [...sources].sort(compareUtf8)[index])) fail(code);
  text(input.operationNonce, /^[a-f0-9]{64}$/u, code, 64);
  const canonicalBytes = packCanonicalBytes(input);
  if (!canonicalBytes.equals(Buffer.from(bytes)) || domainDigest(ANCHOR_DOMAIN, input) !== digest(expectedDigest, code)) fail(code);
  return input;
}

export async function recoverTrustedTimeUpdate(input) {
  const code = 'TIME_WITNESS_CONFLICT';
  exact(input, ['validatedPolicy', 'witnessClients', 'ledger'], code);
  if (!input.validatedPolicy || !POLICIES.has(input.validatedPolicy) || !input.ledger
      || typeof input.ledger.capabilities !== 'function' || typeof input.ledger.readPending !== 'function'
      || typeof input.ledger.commit !== 'function') fail(code);
  const capabilities = await input.ledger.capabilities();
  exact(capabilities, ['durablePending', 'atomicCommit', 'appendOnly', 'readAfterWrite'], code);
  if (Object.values(capabilities).some((value) => value !== true)) fail(code);
  const pending = await input.ledger.readPending();
  exact(pending, [
    'pendingId', 'oldSequence', 'oldHeadDigest', 'newSequence', 'newHeadDigest',
    'anchorBytes', 'operationNonce', 'durable'
  ], code);
  if (pending.durable !== true || pending.newSequence !== pending.oldSequence + 1) fail(code);
  integer(pending.oldSequence, 0, Number.MAX_SAFE_INTEGER, code);
  integer(pending.newSequence, 1, Number.MAX_SAFE_INTEGER, code);
  digest(pending.oldHeadDigest, code); digest(pending.newHeadDigest, code);
  text(pending.operationNonce, /^[a-f0-9]{64}$/u, code, 64);
  const anchor = parseRecoveryAnchor(pending.anchorBytes, pending.newHeadDigest, input.validatedPolicy);
  if (anchor.sequence !== pending.newSequence || anchor.previousAnchorDigest !== pending.oldHeadDigest
      || anchor.operationNonce !== pending.operationNonce) fail(code);
  const { states, byId } = await readWitnesses(input.validatedPolicy, input.witnessClients);
  const configuredById = new Map(input.validatedPolicy.record.rollbackWitnesses.map((entry) => [entry.witnessId, entry]));
  const receiptDigests = [];
  for (const state of states) {
    const old = state.sequence === pending.oldSequence && state.anchorHeadDigest === pending.oldHeadDigest;
    const advanced = state.sequence === pending.newSequence && state.anchorHeadDigest === pending.newHeadDigest;
    if (!old && !advanced) fail(code);
    if (advanced) receiptDigests.push(state.receiptDigest);
    else {
      const configured = configuredById.get(state.witnessId);
      const response = witnessState(await byId.get(state.witnessId).compareAndSet({
        projectId: input.validatedPolicy.record.projectId, namespaceId: configured.namespaceId,
        expectedSequence: pending.oldSequence, expectedHeadDigest: pending.oldHeadDigest,
        newSequence: pending.newSequence, newHeadDigest: pending.newHeadDigest,
        operationNonce: pending.operationNonce
      }), configured, code);
      if (response.sequence !== pending.newSequence || response.anchorHeadDigest !== pending.newHeadDigest) fail(code);
      receiptDigests.push(response.receiptDigest);
    }
  }
  const committed = await input.ledger.commit({
    pendingId: pending.pendingId, sequence: pending.newSequence,
    anchorBytes: Buffer.from(pending.anchorBytes), anchorDigest: pending.newHeadDigest,
    witnessReceiptDigests: receiptDigests.sort(compareUtf8)
  });
  exact(committed, ['committed', 'durable', 'sequence', 'anchorHeadDigest', 'commitReceiptDigest'], code);
  if (committed.committed !== true || committed.durable !== true || committed.sequence !== pending.newSequence
      || committed.anchorHeadDigest !== pending.newHeadDigest) fail(code);
  const reread = await readWitnesses(input.validatedPolicy, input.witnessClients);
  if (reread.states.some((entry) => entry.sequence !== pending.newSequence || entry.anchorHeadDigest !== pending.newHeadDigest)) fail(code);
  const receipt = {
    artifactType: 'kstack-trusted-time-receipt', schemaVersion: 1,
    projectId: input.validatedPolicy.record.projectId, policyDigest: input.validatedPolicy.policyDigest,
    anchorSequence: pending.newSequence, anchorDigest: pending.newHeadDigest,
    rollbackWitnessReceiptDigests: receiptDigests.sort(compareUtf8), witnessedSequence: pending.newSequence,
    witnessedAnchorHeadDigest: pending.newHeadDigest, bootIdDigest: anchor.bootIdDigest,
    sourceEvidenceDigests: anchor.sourceEvidenceDigests,
    lowerUtcNs: anchor.remoteLowerUtcNs, upperUtcNs: anchor.remoteUpperUtcNs,
    monotonicNs: anchor.kernelMonotonicNs, wallUtcNs: anchor.kernelRealtimeUtcNs,
    issuedAtIntervalDigest: anchor.issuedAtIntervalDigest
  };
  const result = immutable({
    policy: input.validatedPolicy, anchor, anchorBytes: Buffer.from(pending.anchorBytes),
    anchorDigest: pending.newHeadDigest, receipt, receiptBytes: packCanonicalBytes(receipt),
    receiptDigest: domainDigest(RECEIPT_DOMAIN, receipt),
    commitReceiptDigest: digest(committed.commitReceiptDigest, code),
    publicationMonotonicNs: anchor.kernelMonotonicNs, recovered: true
  });
  PUBLICATIONS.add(result);
  return result;
}

export function evaluateTemporalPredicate(input) {
  const code = 'TEMPORAL_BOUNDARY_AMBIGUOUS';
  exact(input, ['lowerUtcNs', 'upperUtcNs', 'predicate'], code);
  const lower = ns(input.lowerUtcNs, code); const upper = ns(input.upperUtcNs, code);
  if (lower > upper) fail(code);
  if (!plain(input.predicate)) fail(code);
  if (input.predicate.kind === 'not-before') {
    exact(input.predicate, ['kind', 'notBeforeUtcNs'], code);
    return immutable({ pass: lower >= ns(input.predicate.notBeforeUtcNs, code), kind: input.predicate.kind });
  }
  if (input.predicate.kind === 'expires-at') {
    exact(input.predicate, ['kind', 'expiresAtUtcNs'], code);
    return immutable({ pass: upper < ns(input.predicate.expiresAtUtcNs, code), kind: input.predicate.kind });
  }
  if (input.predicate.kind === 'maximum-age') {
    exact(input.predicate, ['kind', 'observedUtcNs', 'maxAgeNs', 'maxFutureEvidenceSkewNs', 'authenticatedDescriptorDigest', 'producerReceiptDigest'], code);
    digest(input.predicate.authenticatedDescriptorDigest, code); digest(input.predicate.producerReceiptDigest, code);
    const observed = ns(input.predicate.observedUtcNs, code); const maxAge = ns(input.predicate.maxAgeNs, code);
    if (maxAge < 0n) fail(code);
    const futureSkew = ns(input.predicate.maxFutureEvidenceSkewNs, code);
    if (futureSkew < 0n) fail(code);
    return immutable({ pass: observed <= upper && observed >= upper - maxAge && observed <= lower + futureSkew, kind: input.predicate.kind });
  }
  fail(code);
}

export function guardTrustedTimeUse(input) {
  const code = 'TRUSTED_TIME_UNAVAILABLE';
  exact(input, ['publication', 'currentHead', 'localObservation', 'predicate'], code);
  if (!input.publication || !PUBLICATIONS.has(input.publication)) fail(code);
  exact(input.currentHead, ['sequence', 'anchorHeadDigest', 'policyDigest'], code);
  if (input.currentHead.sequence !== input.publication.receipt.anchorSequence
      || input.currentHead.anchorHeadDigest !== input.publication.anchorDigest
      || input.currentHead.policyDigest !== input.publication.policy.policyDigest) fail(code);
  exact(input.localObservation, ['bootIdDigest', 'monotonicNs', 'wallUtcNs'], code);
  if (input.localObservation.bootIdDigest !== input.publication.receipt.bootIdDigest) fail(code);
  const nowMono = ns(input.localObservation.monotonicNs, code);
  const publishedMono = ns(input.publication.publicationMonotonicNs, code);
  const elapsed = nowMono - publishedMono;
  if (elapsed < 0n || elapsed > BigInt(input.publication.policy.record.maxSampleAgeMs) * 1_000_000n) fail(code);
  const lower = ns(input.publication.receipt.lowerUtcNs, code);
  const upper = addNs(ns(input.publication.receipt.upperUtcNs, code), elapsed);
  let predicate = input.predicate;
  if (predicate.kind === 'maximum-age') predicate = {
    ...predicate,
    maxFutureEvidenceSkewNs: (BigInt(input.publication.policy.record.maxFutureEvidenceSkewMs) * 1_000_000n).toString()
  };
  let decision;
  if (predicate.kind === 'maximum-age') {
    exact(predicate, ['kind', 'observedUtcNs', 'maxAgeNs', 'authenticatedDescriptorDigest', 'producerReceiptDigest', 'maxFutureEvidenceSkewNs'], code);
    digest(predicate.authenticatedDescriptorDigest, code); digest(predicate.producerReceiptDigest, code);
    const observed = ns(predicate.observedUtcNs, code); const maxAge = ns(predicate.maxAgeNs, code);
    const futureSkew = ns(predicate.maxFutureEvidenceSkewNs, code);
    decision = { pass: maxAge >= 0n && observed <= upper && observed >= upper - maxAge && observed <= lower + futureSkew, kind: predicate.kind };
  } else decision = evaluateTemporalPredicate({ lowerUtcNs: lower.toString(), upperUtcNs: upper.toString(), predicate });
  if (!decision.pass) fail('TEMPORAL_BOUNDARY_AMBIGUOUS');
  const record = {
    artifactType: 'kstack-trusted-time-use', schemaVersion: 1,
    trustedTimeReceiptDigest: input.publication.receiptDigest,
    anchorDigest: input.publication.anchorDigest, policyDigest: input.publication.policy.policyDigest,
    lowerUtcNs: lower.toString(), upperUtcNs: upper.toString(), predicate, pass: true
  };
  const useReceiptDigest = domainDigest('KSTACK-TRUSTED-TIME-USE-V1\n', record);
  const nowMs = upper / 1_000_000n;
  if (nowMs < -8_640_000_000_000_000n || nowMs > 8_640_000_000_000_000n) fail(code);
  return immutable({
    record, useReceiptDigest,
    binding: {
      now: new Date(Number(nowMs)).toISOString(),
      trustedTimeReceiptDigest: input.publication.receiptDigest,
      useReceiptDigest, policyDigest: input.publication.policy.policyDigest,
      anchorDigest: input.publication.anchorDigest,
      qualified: true, rollbackDetected: false
    }
  });
}
