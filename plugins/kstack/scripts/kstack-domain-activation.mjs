import crypto from 'node:crypto';
import { assertConsumedIdentityActionResult } from './kstack-domain-identity.mjs';
import { parseProtectedPolicyState, validateWeakeningTransitionUse } from './kstack-domain-separation.mjs';
import { confirmTrustedTimeBinding } from './kstack-domain-time-binding.mjs';
import { createPackArtifact, validateApprovalGraph } from './kstack-domain-selection.mjs';
import {
  activationBodyDigest,
  assertValidatedPackCatalogGraph,
  createD5Artifact,
  packCanonicalBytes,
  parsePackCanonicalJson,
  parseD5Artifact,
  validatePackCatalogGraph
} from './kstack-domain-schema.mjs';

const DIGEST = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const LOWER_ID = /^[a-z][a-z0-9-]{0,63}$/u;
const NONCE = /^[a-f0-9]{64}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const PREPARED_ACTIVATIONS = new WeakSet();
const VALIDATED_HEADS = new WeakSet();
const D2_SNAPSHOT_PROJECTIONS = new WeakSet();

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exact(value, keys, code) {
  const actual = plain(value) ? Object.keys(value).sort() : [];
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}

function string(value, expression, code, maximum = 256) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum
      || !value.isWellFormed() || value.normalize('NFC') !== value
      || CONTROL_OR_BIDI.test(value) || !expression.test(value)) fail(code);
  return value;
}

function digest(value, code) {
  return string(value, DIGEST, code, 64);
}

function integer(value, minimum, maximum, code) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) fail(code);
  return value;
}

function instant(value, code) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail(code);
  try { if (new Date(value).toISOString() !== value) fail(code); } catch { fail(code); }
  return value;
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
  return crypto.createHash('sha256').update(Buffer.from(domain, 'utf8')).update(packCanonicalBytes(value)).digest('hex');
}

function sameDigest(left, right, code) {
  const a = Buffer.from(digest(left, code), 'hex');
  const b = Buffer.from(digest(right, code), 'hex');
  if (!crypto.timingSafeEqual(a, b)) fail(code);
}

function pointerRecord(input) {
  const code = 'PACK_ACTIVATION_LEDGER_UNAVAILABLE';
  exact(input, [
    'recordVersion', 'projectId', 'repositoryImmutableId', 'contractVersion',
    'generation', 'snapshotDigest', 'predecessorPointerDigest',
    'activationRequestDigest', 'commitTransactionId', 'committedAt'
  ], code);
  if (input.recordVersion !== 1 || input.contractVersion !== 1) fail(code);
  return {
    recordVersion: 1, projectId: string(input.projectId, ID, code),
    repositoryImmutableId: string(input.repositoryImmutableId, ID, code), contractVersion: 1,
    generation: integer(input.generation, 0, Number.MAX_SAFE_INTEGER, code),
    snapshotDigest: digest(input.snapshotDigest, code), predecessorPointerDigest: digest(input.predecessorPointerDigest, code),
    activationRequestDigest: digest(input.activationRequestDigest, code),
    commitTransactionId: string(input.commitTransactionId, ID, code), committedAt: instant(input.committedAt, code)
  };
}

export function createCurrentPackPointerRecord(input) {
  const record = pointerRecord(input);
  return immutable({
    record, canonicalBytes: packCanonicalBytes(record),
    pointerRecordDigest: domainDigest('KSTACK-CURRENT-PACK-POINTER-RECORD-V1\n', record)
  });
}

export async function readCurrentPackHead(input) {
  const code = 'PACK_ACTIVATION_LEDGER_UNAVAILABLE';
  exact(input, [
    'projectId', 'repositoryImmutableId', 'readerNonce', 'priorHighWater',
    'trustedTime', 'trustedTimeAuthority', 'ledger', 'snapshotAuthority', 'brokerTrustAuthority', 'nonceLedger'
  ], code);
  const projectId = string(input.projectId, ID, code);
  const repositoryImmutableId = string(input.repositoryImmutableId, ID, code);
  const readerNonce = string(input.readerNonce, NONCE, code, 64);
  const time = confirmTrustedTimeBinding(input.trustedTime, input.trustedTimeAuthority, code);
  for (const [authority, methods] of [
    [input.ledger, ['capabilities', 'readCurrent']],
    [input.snapshotAuthority, ['readByDigest']],
    [input.brokerTrustAuthority, ['verifyHeadProof']],
    [input.nonceLedger, ['consumeOnce']]
  ]) if (!authority || methods.some((method) => typeof authority[method] !== 'function')) fail(code);
  const capabilities = await input.ledger.capabilities();
  exact(capabilities, ['serializableRead', 'monotoneRevision', 'checkpointContinuity', 'durable'], code);
  if (Object.values(capabilities).some((value) => value !== true)) fail(code);
  const live = await input.ledger.readCurrent({ projectId, repositoryImmutableId, readerNonce });
  exact(live, [
    'pointerRecord', 'ledgerEpoch', 'ledgerRevision', 'checkpointDigest',
    'trustedTimeReceiptDigest', 'issuedAt', 'expiresAt', 'brokerKeyId', 'signatureBase64'
  ], code);
  const pointer = createCurrentPackPointerRecord(live.pointerRecord);
  if (pointer.record.projectId !== projectId || pointer.record.repositoryImmutableId !== repositoryImmutableId) fail(code);
  const issuedAt = instant(live.issuedAt, code);
  const expiresAt = instant(live.expiresAt, code);
  const nowMs = Date.parse(time.now);
  if (Date.parse(issuedAt) > nowMs || Date.parse(expiresAt) <= nowMs
      || Date.parse(pointer.record.committedAt) > Date.parse(issuedAt)
      || Date.parse(expiresAt) - Date.parse(issuedAt) > 30_000) fail('PACK_ACTIVATION_STALE');
  sameDigest(live.trustedTimeReceiptDigest, time.trustedTimeReceiptDigest, code);
  const proof = {
    proofVersion: 1, projectId, repositoryImmutableId,
    pointerRecordDigest: pointer.pointerRecordDigest,
    generation: pointer.record.generation, snapshotDigest: pointer.record.snapshotDigest,
    ledgerEpoch: integer(live.ledgerEpoch, 1, Number.MAX_SAFE_INTEGER, code),
    ledgerRevision: integer(live.ledgerRevision, 1, Number.MAX_SAFE_INTEGER, code),
    checkpointDigest: digest(live.checkpointDigest, code), readerNonce,
    trustedTimeReceiptDigest: time.trustedTimeReceiptDigest, issuedAt, expiresAt,
    brokerKeyId: string(live.brokerKeyId, ID, code)
  };
  const proofDigest = domainDigest('KSTACK-CURRENT-PACK-HEAD-PROOF-V1\n', proof);
  const trust = await input.brokerTrustAuthority.verifyHeadProof({
    proof, proofDigest, signatureBase64: string(live.signatureBase64, /^[A-Za-z0-9+/]+={0,2}$/u, code, 4096)
  });
  exact(trust, ['qualified', 'current', 'keyId', 'checkpointContinuity', 'rollbackDetected'], code);
  if (trust.qualified !== true || trust.current !== true || trust.checkpointContinuity !== true
      || trust.rollbackDetected !== false || trust.keyId !== proof.brokerKeyId) fail(code);
  if (input.priorHighWater !== null) {
    exact(input.priorHighWater, ['ledgerEpoch', 'ledgerRevision'], code);
    const priorEpoch = integer(input.priorHighWater.ledgerEpoch, 1, Number.MAX_SAFE_INTEGER, code);
    const priorRevision = integer(input.priorHighWater.ledgerRevision, 1, Number.MAX_SAFE_INTEGER, code);
    if (proof.ledgerEpoch < priorEpoch || proof.ledgerEpoch === priorEpoch && proof.ledgerRevision < priorRevision) fail('PACK_ACTIVATION_STALE');
  }
  const nonce = await input.nonceLedger.consumeOnce({ projectId, repositoryImmutableId, readerNonce, proofDigest });
  exact(nonce, ['consumed', 'checkpointDigest'], code);
  if (nonce.consumed !== true) fail('PACK_ACTIVATION_REPLAYED');
  digest(nonce.checkpointDigest, code);
  const snapshotSource = await input.snapshotAuthority.readByDigest(proof.snapshotDigest);
  exact(snapshotSource, ['bytes', 'durable', 'immutable', 'retentionPinned'], code);
  if (snapshotSource.durable !== true || snapshotSource.immutable !== true || snapshotSource.retentionPinned !== true) fail(code);
  const snapshot = parseD5Artifact(snapshotSource.bytes, 'kstack-pack-catalog-snapshot', proof.snapshotDigest);
  if (snapshot.record.generation !== proof.generation) fail(code);
  const output = immutable({
    pointer: pointer.record, pointerBytes: pointer.canonicalBytes,
    pointerRecordDigest: pointer.pointerRecordDigest, proof, proofDigest,
    proofSignatureBase64: live.signatureBase64, snapshot: snapshot.record,
    snapshotBytes: snapshot.canonicalBytes, snapshotDigest: snapshot.artifactDigest,
    generation: snapshot.record.generation,
    highWater: { ledgerEpoch: proof.ledgerEpoch, ledgerRevision: proof.ledgerRevision }
  });
  VALIDATED_HEADS.add(output);
  return output;
}

export function projectD2PackSnapshot(input) {
  const code = 'PACK_ACTIVATION_GRAPH_INVALID';
  exact(input, ['currentHead', 'repositoryPolicyDigest', 'approvalGraphs'], code);
  if (!input.currentHead || !VALIDATED_HEADS.has(input.currentHead)
      || !Array.isArray(input.approvalGraphs)) fail(code);
  const available = input.currentHead.snapshot.catalogEntries.filter((entry) => entry.state === 'available');
  if (input.approvalGraphs.length !== available.length) fail(code);
  const graphs = new Map(input.approvalGraphs.map((entry) => {
    exact(entry, [
      'packId', 'inventoryBytes', 'expectedInventoryDigest',
      'expectedOperationReceiptDigest', 'expectedApprovalDigest'
    ], code);
    return [entry.packId, entry];
  }));
  if (graphs.size !== input.approvalGraphs.length) fail(code);
  const entries = available.map((catalog) => {
    const source = graphs.get(catalog.packId);
    if (!source) fail(code);
    let graph;
    try {
      graph = validateApprovalGraph({
        inventoryBytes: source.inventoryBytes, expectedInventoryDigest: source.expectedInventoryDigest,
        expectedOperationReceiptDigest: source.expectedOperationReceiptDigest,
        expectedApprovalDigest: source.expectedApprovalDigest
      });
    } catch { fail(code); }
    if (graph.packId !== catalog.packId || graph.version !== catalog.version) fail(code);
    sameDigest(graph.bundleDigest, catalog.bundleDigest, code);
    return {
      packId: graph.packId, version: graph.version, materialDigest: graph.materialDigest,
      compatibilityTupleDigest: graph.compatibilityTupleDigest,
      reviewArtifactDigest: graph.reviewArtifactDigest,
      approvalArtifactDigest: graph.approvalArtifactDigest
    };
  });
  if (entries.length < 1) fail(code);
  const snapshot = createPackArtifact({
    artifactType: 'kstack-pack-snapshot', schemaVersion: 1,
    generation: input.currentHead.generation,
    repositoryPolicyDigest: digest(input.repositoryPolicyDigest, code), entries
  });
  const output = immutable({
    snapshot: snapshot.record, snapshotBytes: snapshot.canonicalBytes,
    snapshotDigest: snapshot.artifactDigest, generation: snapshot.record.generation,
    d5SnapshotDigest: input.currentHead.snapshotDigest,
    d5PointerRecordDigest: input.currentHead.pointerRecordDigest,
    d5HeadProofDigest: input.currentHead.proofDigest,
    d5LedgerEpoch: input.currentHead.proof.ledgerEpoch,
    d5LedgerRevision: input.currentHead.proof.ledgerRevision
  });
  D2_SNAPSHOT_PROJECTIONS.add(output);
  return output;
}

export function confirmD2PackSnapshotCurrent(input) {
  const code = 'PACK_SELECTION_STALE';
  exact(input, ['projection', 'freshHead'], code);
  if (!input.projection || !D2_SNAPSHOT_PROJECTIONS.has(input.projection)
      || !input.freshHead || !VALIDATED_HEADS.has(input.freshHead)) fail(code);
  if (input.freshHead.snapshotDigest !== input.projection.d5SnapshotDigest
      || input.freshHead.pointerRecordDigest !== input.projection.d5PointerRecordDigest
      || input.freshHead.generation !== input.projection.generation
      || input.freshHead.proof.ledgerEpoch < input.projection.d5LedgerEpoch
      || input.freshHead.proof.ledgerEpoch === input.projection.d5LedgerEpoch
        && input.freshHead.proof.ledgerRevision < input.projection.d5LedgerRevision) fail(code);
  return immutable({
    current: true, snapshotDigest: input.projection.snapshotDigest,
    generation: input.projection.generation,
    d5SnapshotDigest: input.projection.d5SnapshotDigest,
    pointerRecordDigest: input.projection.d5PointerRecordDigest,
    headProofDigest: input.freshHead.proofDigest,
    ledgerEpoch: input.freshHead.proof.ledgerEpoch,
    ledgerRevision: input.freshHead.proof.ledgerRevision,
    rollbackDetected: false
  });
}

function compareSemver(left, right) {
  const parse = (value) => {
    const [core, pre] = value.split('-', 2);
    return { core: core.split('.').map(Number), pre: pre?.split('.') ?? null };
  };
  const a = parse(left); const b = parse(right);
  for (let index = 0; index < 3; index += 1) if (a.core[index] !== b.core[index]) return a.core[index] - b.core[index];
  if (a.pre === null || b.pre === null) return a.pre === b.pre ? 0 : a.pre === null ? 1 : -1;
  const length = Math.max(a.pre.length, b.pre.length);
  for (let index = 0; index < length; index += 1) {
    if (a.pre[index] === undefined || b.pre[index] === undefined) return a.pre[index] === undefined ? -1 : 1;
    if (a.pre[index] === b.pre[index]) continue;
    const ai = /^(?:0|[1-9][0-9]*)$/u.test(a.pre[index]);
    const bi = /^(?:0|[1-9][0-9]*)$/u.test(b.pre[index]);
    if (ai && bi) return Number(a.pre[index]) - Number(b.pre[index]);
    if (ai !== bi) return ai ? -1 : 1;
    return a.pre[index] < b.pre[index] ? -1 : 1;
  }
  return 0;
}

function classifyTransition(before, after, transitionKind, requiredPackIds) {
  const code = 'PACK_ACTIVATION_DIFF_INVALID';
  const required = requiredPackIds.includes(before.packId);
  let admittedKinds = [];
  let weakeningRequired = true;
  let weakeningAction = 'policy-weakening';
  if (before.state === 'roadmap-only' && after.state === 'available') {
    admittedKinds = ['activate']; weakeningRequired = false;
  } else if (before.state === 'available' && after.state === 'available') {
    const direction = compareSemver(after.version, before.version);
    admittedKinds = direction > 0 ? ['upgrade'] : direction < 0 ? ['downgrade', 'rollback'] : ['downgrade', 'rollback'];
    weakeningRequired = direction <= 0;
    weakeningAction = 'catalog-downgrade';
  } else if (before.state === 'available' && after.state === 'quarantined') {
    admittedKinds = ['quarantine']; weakeningRequired = false;
  } else if (before.state === 'quarantined' && after.state === 'available') {
    admittedKinds = ['quarantine-reversal']; weakeningAction = 'quarantine-reversal';
  } else if (after.state === 'roadmap-only' && before.state !== 'roadmap-only') {
    admittedKinds = ['disable']; weakeningRequired = required;
    weakeningAction = required ? 'required-pack-waiver' : 'policy-weakening';
  }
  if (!admittedKinds.includes(transitionKind)) fail(code);
  return { transitionKind, weakeningRequired, weakeningAction };
}

async function confirmActivationPolicyState(input, projectId, repositoryImmutableId) {
  const code = 'PACK_ACTIVATION_POLICY_STATE_INVALID';
  const parsed = parseProtectedPolicyState(input.policyStateBytes, input.policyStateProtection);
  sameDigest(parsed.policyStateDigest, input.expectedPolicyStateDigest, code);
  if (!input.policyStateAuthority || typeof input.policyStateAuthority.confirmCurrent !== 'function') fail(code);
  const confirmation = await input.policyStateAuthority.confirmCurrent({
    policyStateDigest: parsed.policyStateDigest,
    projectId,
    repositoryImmutableId
  });
  exact(confirmation, [
    'current', 'policyStateDigest', 'checkpointDigest', 'rollbackDetected',
    'protected', 'repositoryResident'
  ], code);
  if (confirmation.current !== true || confirmation.rollbackDetected !== false
      || confirmation.protected !== true || confirmation.repositoryResident !== false) fail(code);
  sameDigest(confirmation.policyStateDigest, parsed.policyStateDigest, code);
  digest(confirmation.checkpointDigest, code);
  return { ...parsed, checkpointDigest: confirmation.checkpointDigest };
}

export async function preparePackActivation(input) {
  const code = 'PACK_ACTIVATION_DIFF_INVALID';
  exact(input, [
    'currentHead', 'candidateGraph', 'transitionKind', 'changedPackIds',
    'policyStateBytes', 'policyStateProtection', 'expectedPolicyStateDigest', 'policyStateAuthority',
    'stagingId', 'contentStore', 'historyAuthority'
  ], code);
  if (!input.currentHead || !VALIDATED_HEADS.has(input.currentHead)) fail('PACK_ACTIVATION_STALE');
  const candidateGraph = assertValidatedPackCatalogGraph(input.candidateGraph);
  if (!Array.isArray(input.changedPackIds) || input.changedPackIds.length !== 1) fail(code);
  const changedPackId = string(input.changedPackIds[0], LOWER_ID, code, 64);
  const before = input.currentHead.snapshot;
  const after = candidateGraph.snapshot;
  if (candidateGraph.projectId !== input.currentHead.pointer.projectId
      || candidateGraph.repositoryImmutableId !== input.currentHead.pointer.repositoryImmutableId) fail(code);
  const policyState = await confirmActivationPolicyState(
    input, candidateGraph.projectId, candidateGraph.repositoryImmutableId
  );
  sameDigest(after.predecessorSnapshotDigest, input.currentHead.snapshotDigest, code);
  if (after.generation !== input.currentHead.generation + 1
      || after.schemaRegistryDigest !== before.schemaRegistryDigest
      || after.contractPolicyDigest !== before.contractPolicyDigest) fail(code);
  const changedCatalog = before.catalogEntries.filter((entry, index) =>
    !packCanonicalBytes(entry).equals(packCanonicalBytes(after.catalogEntries[index])));
  if (changedCatalog.length !== 1 || changedCatalog[0].packId !== changedPackId) fail(code);
  const beforeEntry = before.catalogEntries.find((entry) => entry.packId === changedPackId);
  const afterEntry = after.catalogEntries.find((entry) => entry.packId === changedPackId);
  const beforeCompatibility = before.compatibilityEntries.filter((entry) => entry.packId !== changedPackId);
  const afterCompatibility = after.compatibilityEntries.filter((entry) => entry.packId !== changedPackId);
  if (!packCanonicalBytes(beforeCompatibility).equals(packCanonicalBytes(afterCompatibility))) fail(code);
  const changedMaterialDigests = new Set([beforeEntry, afterEntry]
    .filter((entry) => entry.state !== 'roadmap-only')
    .map((entry) => createPackArtifact({
      artifactType: 'kstack-pack-material', schemaVersion: 1,
      packId: entry.packId, version: entry.version, bundleDigest: entry.bundleDigest
    }).artifactDigest));
  const beforeApplicability = before.applicabilityEntries
    .filter((entry) => !changedMaterialDigests.has(entry.packMaterialDigest));
  const afterApplicability = after.applicabilityEntries
    .filter((entry) => !changedMaterialDigests.has(entry.packMaterialDigest));
  if (!packCanonicalBytes(beforeApplicability).equals(packCanonicalBytes(afterApplicability))) fail(code);
  const classification = classifyTransition(
    beforeEntry, afterEntry, input.transitionKind, policyState.record.requiredPacks
  );
  if (input.transitionKind === 'rollback') {
    if (!input.historyAuthority || typeof input.historyAuthority.confirmRetained !== 'function') fail(code);
    const retained = await input.historyAuthority.confirmRetained({ packId: changedPackId, catalogEntry: afterEntry });
    exact(retained, ['retained', 'compatible', 'historyDigest'], code);
    if (retained.retained !== true || retained.compatible !== true) fail(code);
    digest(retained.historyDigest, code);
  }
  if (!input.contentStore || typeof input.contentStore.capabilities !== 'function'
      || typeof input.contentStore.stage !== 'function' || typeof input.contentStore.confirmStaged !== 'function') {
    fail('PACK_ACTIVATION_STAGING_NOT_DURABLE');
  }
  const capabilities = await input.contentStore.capabilities();
  exact(capabilities, ['immutableByDigest', 'durable', 'retentionPins', 'readAfterWrite', 'atomicPromotion'], 'PACK_ACTIVATION_STAGING_NOT_DURABLE');
  if (Object.values(capabilities).some((value) => value !== true)) fail('PACK_ACTIVATION_STAGING_NOT_DURABLE');
  const stagingId = string(input.stagingId, ID, code);
  const staged = await input.contentStore.stage({
    stagingId, snapshotDigest: candidateGraph.snapshotDigest,
    operationInventoryDigest: candidateGraph.operationInventoryDigest,
    retentionSet: candidateGraph.retentionSet
  });
  exact(staged, ['staged', 'durable', 'readAfterWrite', 'pinned', 'stagingDigest', 'leaseExpiresAt'], 'PACK_ACTIVATION_STAGING_NOT_DURABLE');
  if (staged.staged !== true || staged.durable !== true || staged.readAfterWrite !== true || staged.pinned !== true) fail('PACK_ACTIVATION_STAGING_NOT_DURABLE');
  digest(staged.stagingDigest, 'PACK_ACTIVATION_STAGING_NOT_DURABLE');
  instant(staged.leaseExpiresAt, 'PACK_ACTIVATION_STAGING_NOT_DURABLE');
  const confirmed = await input.contentStore.confirmStaged({ stagingId, snapshotDigest: candidateGraph.snapshotDigest, stagingDigest: staged.stagingDigest });
  exact(confirmed, ['complete', 'durable', 'pinned', 'snapshotDigest', 'stagingDigest'], 'PACK_ACTIVATION_STAGING_NOT_DURABLE');
  if (confirmed.complete !== true || confirmed.durable !== true || confirmed.pinned !== true) fail('PACK_ACTIVATION_STAGING_NOT_DURABLE');
  sameDigest(confirmed.snapshotDigest, candidateGraph.snapshotDigest, 'PACK_ACTIVATION_STAGING_NOT_DURABLE');
  sameDigest(confirmed.stagingDigest, staged.stagingDigest, 'PACK_ACTIVATION_STAGING_NOT_DURABLE');
  const output = immutable({
    currentHead: input.currentHead, candidateGraph, changedPackIds: [changedPackId],
    classification, policyStateDigest: policyState.policyStateDigest,
    policyStateCheckpointDigest: policyState.checkpointDigest,
    stagingId, stagingDigest: staged.stagingDigest,
    leaseExpiresAt: staged.leaseExpiresAt
  });
  PREPARED_ACTIVATIONS.add(output);
  return output;
}

export async function commitPackActivation(input) {
  const code = 'PACK_ACTIVATION_AUTH_INVALID';
  exact(input, [
    'prepared', 'requestBytes', 'expectedRequestDigest', 'd1Activation',
    'identityPolicyDigest', 'identityPolicyAuthority', 'd3AuthorizationUse', 'trustedTime', 'trustedTimeAuthority',
    'policyStateBytes', 'policyStateProtection', 'expectedPolicyStateDigest', 'policyStateAuthority',
    'commitTransactionId', 'ledger', 'contentStore'
  ], code);
  if (!input.prepared || !PREPARED_ACTIVATIONS.has(input.prepared)) fail(code);
  const prepared = input.prepared;
  const time = confirmTrustedTimeBinding(input.trustedTime, input.trustedTimeAuthority, code);
  const nowMs = Date.parse(time.now);
  const request = parseD5Artifact(input.requestBytes, 'kstack-pack-activation-request', input.expectedRequestDigest);
  const record = request.record;
  const changedPackId = prepared.changedPackIds[0];
  const policyState = await confirmActivationPolicyState(
    input, record.projectId, record.repositoryImmutableId
  );
  sameDigest(policyState.policyStateDigest, prepared.policyStateDigest, code);
  const beforeEntry = prepared.currentHead.snapshot.catalogEntries.find((entry) => entry.packId === changedPackId);
  const afterEntry = prepared.candidateGraph.snapshot.catalogEntries.find((entry) => entry.packId === changedPackId);
  const liveClassification = classifyTransition(
    beforeEntry, afterEntry, record.transitionKind, policyState.record.requiredPacks
  );
  if (!packCanonicalBytes(liveClassification).equals(packCanonicalBytes(prepared.classification))) fail(code);
  const compatibilityReviewDigest = prepared.candidateGraph.materialProofs
    .find((entry) => entry.packId === changedPackId)?.reviewArtifactDigest
    ?? prepared.currentHead.snapshot.catalogEntries.find((entry) => entry.packId === changedPackId)?.reviewArtifactDigest;
  if (record.projectId !== prepared.candidateGraph.projectId
      || record.repositoryImmutableId !== prepared.candidateGraph.repositoryImmutableId
      || record.fromSnapshotDigest !== prepared.currentHead.snapshotDigest
      || record.fromGeneration !== prepared.currentHead.generation
      || record.toSnapshotDigest !== prepared.candidateGraph.snapshotDigest
      || record.toGeneration !== prepared.candidateGraph.generation
      || record.schemaRegistryDigest !== prepared.candidateGraph.schemaRegistryDigest
      || record.compatibilityReviewDigest !== compatibilityReviewDigest
      || record.transitionKind !== prepared.classification.transitionKind
      || !packCanonicalBytes(record.changedPackIds).equals(packCanonicalBytes(prepared.changedPackIds))
      || Date.parse(record.notBefore) > nowMs || Date.parse(record.expiresAt) <= nowMs) fail(code);
  const bodyDigest = activationBodyDigest(record);
  if (!input.identityPolicyAuthority || typeof input.identityPolicyAuthority.confirmCurrent !== 'function') fail(code);
  const identityPolicy = await input.identityPolicyAuthority.confirmCurrent({
    policyDigest: digest(input.identityPolicyDigest, code), projectId: record.projectId,
    repositoryImmutableId: record.repositoryImmutableId, now: time.now
  });
  exact(identityPolicy, [
    'current', 'policyDigest', 'checkpointDigest', 'rollbackDetected',
    'protected', 'repositoryResident'
  ], code);
  if (identityPolicy.current !== true || identityPolicy.rollbackDetected !== false
      || identityPolicy.protected !== true || identityPolicy.repositoryResident !== false) fail(code);
  sameDigest(identityPolicy.policyDigest, input.identityPolicyDigest, code);
  digest(identityPolicy.checkpointDigest, code);
  const d1 = assertConsumedIdentityActionResult(input.d1Activation, {
    action: 'catalog-activation', targetDigest: bodyDigest,
    policyDigest: input.identityPolicyDigest, now: time.now
  });
  sameDigest(record.d1ActivationAttestationDigest, d1.receiptDigest, code);
  let d3Digest = null;
  let d3ConsumptionNonce = null;
  if (liveClassification.weakeningRequired) {
    if (!input.d3AuthorizationUse) fail('PACK_ACTIVATION_WEAKENING_AUTH_REQUIRED');
    exact(input.d3AuthorizationUse, ['authorization', 'authorizationDigest', 'requestBytes'], code);
    const use = validateWeakeningTransitionUse({
      authorization: input.d3AuthorizationUse.authorization,
      authorizationDigest: input.d3AuthorizationUse.authorizationDigest,
      requestBytes: input.d3AuthorizationUse.requestBytes,
      liveBeforeDigest: record.fromSnapshotDigest, candidateAfterDigest: record.toSnapshotDigest,
      action: liveClassification.weakeningAction, affectedPackIds: record.changedPackIds,
      trustedTime: {
        now: time.now, sourceProfileDigest: time.trustedTimeReceiptDigest,
        attestationDigest: time.trustedTimeReceiptDigest, qualified: true, rollbackDetected: false
      }
    });
    d3Digest = use.weakeningAuthorizationDigest;
    d3ConsumptionNonce = input.d3AuthorizationUse.authorization.consumptionId;
    sameDigest(record.d3WeakeningAuthorizationDigest, d3Digest, code);
  } else if (record.d3WeakeningAuthorizationDigest !== null || input.d3AuthorizationUse !== null) fail(code);
  const rerun = validatePackCatalogGraph({
    ...prepared.candidateGraph.revalidationInput,
    trustedTime: { ...input.trustedTime }, trustedTimeAuthority: input.trustedTimeAuthority
  });
  sameDigest(rerun.snapshotDigest, prepared.candidateGraph.snapshotDigest, 'PACK_ACTIVATION_GRAPH_INVALID');
  if (!input.contentStore || typeof input.contentStore.confirmStaged !== 'function') fail('PACK_ACTIVATION_STAGING_NOT_DURABLE');
  const staged = await input.contentStore.confirmStaged({
    stagingId: prepared.stagingId, snapshotDigest: rerun.snapshotDigest,
    stagingDigest: prepared.stagingDigest
  });
  exact(staged, ['complete', 'durable', 'pinned', 'snapshotDigest', 'stagingDigest'], 'PACK_ACTIVATION_STAGING_NOT_DURABLE');
  if (staged.complete !== true || staged.durable !== true || staged.pinned !== true) fail('PACK_ACTIVATION_STAGING_NOT_DURABLE');
  sameDigest(staged.snapshotDigest, rerun.snapshotDigest, 'PACK_ACTIVATION_STAGING_NOT_DURABLE');
  sameDigest(staged.stagingDigest, prepared.stagingDigest, 'PACK_ACTIVATION_STAGING_NOT_DURABLE');
  if (!input.ledger || typeof input.ledger.capabilities !== 'function' || typeof input.ledger.transactActivation !== 'function') fail('PACK_ACTIVATION_LEDGER_UNAVAILABLE');
  const capabilities = await input.ledger.capabilities();
  exact(capabilities, [
    'serializable', 'atomicPointerReceiptAndNonces', 'guardedCompareAndSwap',
    'uniqueGeneration', 'uniqueRequest', 'uniqueTransaction', 'uniqueNonce', 'idempotentRecovery'
  ], 'PACK_ACTIVATION_ATOMICITY_CAPABILITY_UNMET');
  if (Object.values(capabilities).some((value) => value !== true)) fail('PACK_ACTIVATION_ATOMICITY_CAPABILITY_UNMET');
  const transactionId = string(input.commitTransactionId, ID, code);
  const currentPointer = createCurrentPackPointerRecord({
    recordVersion: 1, projectId: record.projectId, repositoryImmutableId: record.repositoryImmutableId,
    contractVersion: 1, generation: record.toGeneration, snapshotDigest: record.toSnapshotDigest,
    predecessorPointerDigest: prepared.currentHead.pointerRecordDigest,
    activationRequestDigest: request.artifactDigest, commitTransactionId: transactionId, committedAt: time.now
  });
  const receipt = createD5Artifact({
    artifactType: 'kstack-pack-activation-receipt', schemaVersion: 1,
    requestDigest: request.artifactDigest, oldSnapshotDigest: record.fromSnapshotDigest,
    oldGeneration: record.fromGeneration, newSnapshotDigest: record.toSnapshotDigest,
    newGeneration: record.toGeneration, d1ActivationAttestationDigest: d1.receiptDigest,
    d3WeakeningAuthorizationDigest: d3Digest, commitTransactionId: transactionId,
    committedAt: time.now, priorPointerRecordDigest: prepared.currentHead.pointerRecordDigest,
    currentPointerRecordDigest: currentPointer.pointerRecordDigest
  });
  const transaction = await input.ledger.transactActivation(immutable({
    projectId: record.projectId, repositoryImmutableId: record.repositoryImmutableId,
    expectedPointerRecordDigest: prepared.currentHead.pointerRecordDigest,
    expectedSnapshotDigest: record.fromSnapshotDigest, expectedGeneration: record.fromGeneration,
    requestDigest: request.artifactDigest, requestNonce: record.requestNonce,
    policyStateDigest: policyState.policyStateDigest,
    policyStateCheckpointDigest: policyState.checkpointDigest,
    identityPolicyDigest: input.identityPolicyDigest,
    identityPolicyCheckpointDigest: identityPolicy.checkpointDigest,
    d1ConsumptionNonce: d1.receipt.nonce,
    d3ConsumptionNonce, transactionId, stagingId: prepared.stagingId,
    stagingDigest: prepared.stagingDigest, candidateSnapshotDigest: record.toSnapshotDigest,
    candidateGeneration: record.toGeneration, receiptBytes: receipt.canonicalBytes,
    receiptDigest: receipt.artifactDigest, pointerRecordBytes: currentPointer.canonicalBytes,
    pointerRecordDigest: currentPointer.pointerRecordDigest
  }));
  exact(transaction, [
    'outcome', 'receiptBytes', 'receiptDigest', 'pointerRecordBytes',
    'pointerRecordDigest', 'generation', 'snapshotDigest', 'retentionState'
  ], 'PACK_ACTIVATION_TRANSACTION_CONFLICT');
  if (!['committed', 'recovered'].includes(transaction.outcome)
      || transaction.generation !== record.toGeneration || transaction.retentionState !== 'historical-active') fail('PACK_ACTIVATION_TRANSACTION_CONFLICT');
  sameDigest(transaction.receiptDigest, receipt.artifactDigest, 'PACK_ACTIVATION_TRANSACTION_CONFLICT');
  sameDigest(transaction.pointerRecordDigest, currentPointer.pointerRecordDigest, 'PACK_ACTIVATION_TRANSACTION_CONFLICT');
  sameDigest(transaction.snapshotDigest, record.toSnapshotDigest, 'PACK_ACTIVATION_TRANSACTION_CONFLICT');
  const storedReceipt = parseD5Artifact(transaction.receiptBytes, 'kstack-pack-activation-receipt', transaction.receiptDigest);
  let storedPointerRecord;
  try { storedPointerRecord = parsePackCanonicalJson(transaction.pointerRecordBytes); } catch { fail('PACK_ACTIVATION_TRANSACTION_CONFLICT'); }
  const storedPointer = createCurrentPackPointerRecord(pointerRecord(storedPointerRecord));
  if (!storedReceipt.canonicalBytes.equals(receipt.canonicalBytes)
      || !storedPointer.canonicalBytes.equals(currentPointer.canonicalBytes)) fail('PACK_ACTIVATION_TRANSACTION_CONFLICT');
  return immutable({
    outcome: transaction.outcome, receipt: storedReceipt.record,
    receiptBytes: storedReceipt.canonicalBytes, receiptDigest: storedReceipt.artifactDigest,
    pointer: storedPointer.record, pointerRecordDigest: storedPointer.pointerRecordDigest
  });
}
