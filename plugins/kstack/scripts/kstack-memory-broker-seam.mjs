#!/usr/bin/env node
/**
 * KStack memory maturity slice 1: the broker request-sequence seam.
 *
 * Accepted design:
 *   .kstack/decisions/memory-maturity-2026-08-26-slice1-authority-citation.md
 *
 * Slice 1 ships the nine-step request sequence *structurally* and nothing
 * more. The seam is disabled by default and refuses at entry before it parses
 * anything, so no read, ingest, remote-sync, or administrative-delete path is
 * reachable yet.
 *
 * Everything the sequence touches is an in-memory stand-in supplied by the
 * caller: there is no database, no durable catalog, no real policy lease or
 * transaction, no capability issuance service, and no connector. Those belong
 * to later slices. This file imports only `node:crypto` and the slice 1
 * authority contracts, so it cannot reach a repository, an issue tracker, a
 * release, a delivery, or a reviewer.
 */
import crypto from 'node:crypto';
import {
  assertRepoId,
  authorizeCapability,
  authorizeRecordAccess,
  canonicalConstraints,
  CAPABILITY_ACTIONS,
  constraintsHash,
  constraintsSatisfied,
  deriveRecordScope,
  evaluateFreshness,
  evaluateGrant,
  assertEnumerableInput,
  exactKeys,
  inertCopy,
  snapshotInput,
  LIMITS,
  MUTATING_ACTIONS,
  parseAuthorizationRequest,
  parseCapabilityState,
  parseCitedResultV1,
  parseFieldSet,
  parseGrantSet,
  parseSourceRecordV1,
  REPOSITORY_PROVIDERS,
  RETRIEVAL_CHANNELS,
  TRUST_LABEL,
  verifyCitedRange
} from './kstack-memory-authority.mjs';

/** The seam is off unless a caller explicitly turns it on. */
export const MEMORY_BROKER_SEAM_ENABLED_BY_DEFAULT = false;

/** The nine numbered steps of the accepted broker request sequence. */
export const BROKER_REQUEST_SEQUENCE = Object.freeze([
  'parse-closed-schema',
  'authenticate-and-canonicalize-repository',
  'hash-constraints-and-resolve-capability',
  'acquire-shared-policy-lease',
  'query-authorized-catalog',
  'reauthorize-each-candidate',
  'verify-digests',
  'emit-cited-results-and-receipt',
  'revalidate-and-consume-nonce-on-activation'
]);

/**
 * Authorities the broker does not and must not hold. Named here so a probe can
 * assert their absence rather than inferring it.
 */
export const BROKER_ABSENT_AUTHORITIES = Object.freeze([
  'repository-write',
  'issue-tracker-write',
  'release',
  'commit',
  'deploy',
  'reviewer',
  'secret-repository'
]);

export class MemoryBrokerSeamError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MemoryBrokerSeamError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new MemoryBrokerSeamError(code, message);
}

/**
 * In-memory stand-in for the per-repository policy lease. It records that the
 * sequence took and released a lease in the right order. It is deliberately
 * not a concurrency control: real writer-preferred leasing, linearization, and
 * crash recovery are later-slice work.
 */
class LeaseLedgerStandIn {
  #held = new Map();

  acquireShared(repoId) {
    const depth = this.#held.get(repoId) ?? 0;
    this.#held.set(repoId, depth + 1);
    return { repoId, mode: 'shared', depth: depth + 1 };
  }

  release(handle) {
    const depth = this.#held.get(handle.repoId) ?? 0;
    if (depth <= 0) fail('KSTACK_MEMORY_BROKER_LEASE_UNDERFLOW', 'released a lease that was not held');
    this.#held.set(handle.repoId, depth - 1);
  }

  isHeld(repoId) {
    return (this.#held.get(repoId) ?? 0) > 0;
  }
}

const SEAM_OPTION_KEYS = [
  'enabled', 'catalog', 'capabilities', 'grants', 'bodies',
  'policyGeneration', 'authenticatedSubjects', 'auditKey',
  'repositoryRegistry', 'fieldSets'
];

const OPERATION_KEYS = [
  'request', 'capabilityIdHash', 'candidates', 'nowMilliseconds',
  'allowLabeledSnapshots', 'clockSample', 'transportWrite', 'activation'
];

/**
 * `assertedScope` is what the caller believes it is reading. It is only ever
 * checked for consistency against the record's own authority locator; the
 * scope that grant and path-prefix matching actually use is derived from the
 * validated record, never from here.
 */
const CANDIDATE_KEYS = [
  'recordId', 'assertedScope', 'chunkByteStart', 'chunkByteEndExclusive',
  'chunkSha256', 'retrievalChannels', 'componentScores', 'connectorFailed'
];

const LIST_OPTION_KEYS = Object.freeze([
  'catalog', 'capabilities', 'grants', 'bodies', 'repositoryRegistry', 'fieldSets',
  'authenticatedSubjects'
]);

const REGISTRY_ENTRY_KEYS = ['repoId', 'provider'];

const CLOCK_SAMPLE_KEYS = [
  'previousWallMilliseconds', 'currentWallMilliseconds',
  'previousMonotonicMilliseconds', 'currentMonotonicMilliseconds'
];

const ACTIVATION_KEYS = ['requested', 'recordId'];

/**
 * The slice 1 broker seam.
 *
 * `run()` walks the nine numbered steps in order over caller-supplied
 * in-memory state and returns the step trace, any cited results, and a
 * content-free audit receipt. With `enabled` false — the default — it refuses
 * before step 1.
 */
export class MemoryBrokerSeam {
  #enabled;
  #catalog;
  #capabilities;
  #grants;
  #bodies;
  #policyGeneration;
  #subjects;
  #auditKey;
  #repositoryRegistry;
  #fieldSets;
  #leases = new LeaseLedgerStandIn();
  #consumedNonces = new Set();

  constructor(options = {}) {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', 'broker seam options must be a plain object');
    }
    // Before the spread below and before any key enumeration: a proxy or boxed
    // primitive has no bounded enumeration cost, and spreading one materializes
    // its ownKeys result before this code can measure anything.
    assertEnumerableInput(options, 'broker seam options');
    for (const key of Object.keys(options)) {
      if (!SEAM_OPTION_KEYS.includes(key)) {
        fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', `broker seam options has unknown field ${key}`);
      }
    }
    const settings = {
      enabled: MEMORY_BROKER_SEAM_ENABLED_BY_DEFAULT,
      catalog: [],
      capabilities: [],
      grants: [],
      bodies: [],
      policyGeneration: 0,
      authenticatedSubjects: [],
      auditKey: null,
      repositoryRegistry: [],
      fieldSets: [],
      ...options
    };
    if (typeof settings.enabled !== 'boolean') {
      fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', 'enabled must be boolean');
    }
    // Every list-valued option crosses the same boundary the operation path
    // uses, BEFORE anything iterates it. Without this, each `for...of` and
    // `new Set(...)` below would consult the caller's own `@@iterator` and the
    // constructor would be the one place in the codebase still trusting
    // caller-supplied iteration.
    // ONE budget for the whole constructor call, not one per option: separate
    // budgets meant the effective bound was the stated constant multiplied by
    // the number of list options, which is not a bound on the call at all.
    const optionBudget = { nodes: 0, bytes: 0, depth: 0 };
    for (const key of LIST_OPTION_KEYS) {
      if (!Array.isArray(settings[key])) {
        fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', `${key} must be a list`);
      }
      settings[key] = inertCopy(settings[key], key, optionBudget);
    }
    this.#enabled = settings.enabled;
    this.#catalog = new Map();
    for (const raw of settings.catalog) {
      const record = parseSourceRecordV1(raw);
      if (this.#catalog.has(record.recordId)) {
        fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', 'catalog contains a duplicate recordId');
      }
      this.#catalog.set(record.recordId, record);
    }
    this.#capabilities = new Map();
    for (const raw of settings.capabilities) {
      const capability = parseCapabilityState(raw);
      if (this.#capabilities.has(capability.capabilityIdHash)) {
        fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', 'capabilities contain a duplicate capabilityIdHash');
      }
      this.#capabilities.set(capability.capabilityIdHash, capability);
    }
    this.#grants = [...parseGrantSet(settings.grants).values()];
    this.#bodies = new Map();
    for (const entry of settings.bodies) {
      // `settings.bodies` was already inert-copied above, under the shared
      // budget. Re-snapshotting each entry would copy every body a second time
      // on a fresh budget, and `Buffer.from` would copy it a third — two of the
      // three outside any bound. The entries are already validated and inert,
      // so this checks shape and stores the existing buffer.
      exactKeys(entry, ['recordId', 'originalBytes'], 'body entry');
      if (!Buffer.isBuffer(entry.originalBytes)) {
        fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', 'body entry originalBytes must be raw bytes');
      }
      this.#bodies.set(entry.recordId, entry.originalBytes);
    }
    if (!Number.isInteger(settings.policyGeneration) || settings.policyGeneration < 0) {
      fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', 'policyGeneration must be a non-negative integer');
    }
    this.#policyGeneration = settings.policyGeneration;
    // Owner-registered repository identities. The repoId is a digest, so the
    // provider it was derived under cannot be recovered from it: the registry
    // is the only authority for the `providers` constraint dimension.
    this.#repositoryRegistry = new Map();
    for (const rawEntry of settings.repositoryRegistry) {
      const entry = snapshotInput(rawEntry, REGISTRY_ENTRY_KEYS, 'repository registration');
      if (!Object.values(REPOSITORY_PROVIDERS).includes(entry.provider)) {
        fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', 'repository registration names an unknown provider');
      }
      const repoId = assertRepoId(entry.repoId, 'repoId');
      if (this.#repositoryRegistry.has(repoId)) {
        fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', 'repository registry contains a duplicate repoId');
      }
      this.#repositoryRegistry.set(repoId, entry.provider);
    }
    // KStack-owned versioned field sets. These carry both the per-field-set
    // freshness policy and the authoritative field-ID allowlist, so neither is
    // taken from the caller.
    this.#fieldSets = new Map();
    for (const raw of settings.fieldSets) {
      const policy = parseFieldSet(raw);
      if (this.#fieldSets.has(policy.fieldSetId)) {
        fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', 'field sets contain a duplicate fieldSetId');
      }
      this.#fieldSets.set(policy.fieldSetId, policy);
    }
    // Built from this module's own inert copy, so the Set is ours.
    this.#subjects = new Set(settings.authenticatedSubjects);
    // `Buffer.from(arrayBuffer)` would alias rather than copy, leaving the HMAC
    // key mutable by the caller after construction. It is byte-valued, so it
    // fell outside the list-option sweep and needs the copy applied directly.
    if (settings.auditKey !== null && !ArrayBuffer.isView(settings.auditKey)) {
      // Brand check BEFORE the length check: `inertCopy` faithfully copies a
      // plain array or an object carrying a `length`, either of which would
      // satisfy a length test and then fail much later as a raw TypeError out
      // of createHmac. An HMAC key must be real bytes.
      fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', 'auditKey must be raw bytes');
    }
    this.#auditKey = settings.auditKey === null
      ? crypto.randomBytes(32)
      : inertCopy(settings.auditKey, 'auditKey', optionBudget);
    if (this.#auditKey.length < 32) {
      fail('KSTACK_MEMORY_BROKER_OPTION_INVALID', 'auditKey must be at least 32 bytes');
    }
  }

  get enabled() {
    return this.#enabled;
  }

  get policyGeneration() {
    return this.#policyGeneration;
  }

  /** Revocation increments the generation. Kept minimal on purpose. */
  revoke() {
    this.#policyGeneration += 1;
    return this.#policyGeneration;
  }

  #keyedDigest(label, value) {
    return crypto.createHmac('sha256', this.#auditKey).update(`${label}:${value}`).digest('hex');
  }

  /**
   * Probe used by conformance checks: the broker exposes no write, release,
   * commit, deploy, or reviewer operation of any kind.
   */
  static probeAbsentAuthorities() {
    const surface = new Set([
      ...Object.getOwnPropertyNames(MemoryBrokerSeam.prototype),
      ...Object.getOwnPropertyNames(MemoryBrokerSeam)
    ]);
    const forbidden = /write|commit|push|merge|release|deploy|publish|review|mutate|delete/iu;
    const offending = [...surface].filter((name) => forbidden.test(name));
    return { surface: [...surface].sort(), offending, absent: BROKER_ABSENT_AUTHORITIES };
  }

  /**
   * Read every caller-supplied value exactly once into a frozen local
   * structure, so the object that is validated is always the object that is
   * used.
   *
   * Without this, an accessor-backed input could return one value to a check
   * and a different value to the later use of that same field — a
   * time-of-check-to-time-of-use gap. The accepted design requires that
   * missing, ambiguous, stale, duplicated, or unresolvable inputs deny, which
   * cannot hold if an input is free to change between the two reads.
   */
  #snapshotOperation(operation) {
    // One boundary for the whole codebase: the same inert deep copy the
    // authority module performs. Everything below reads only the copy, so no
    // caller-supplied accessor, proxy, or shadowed method is ever consulted
    // twice — or at all. `transportWrite` is declared opaque below rather than
    // relying on the copier passing functions through, which it no longer does.
    // `transportWrite` is declared opaque: it is legitimately a function, and
    // the copier now refuses function leaves outright because a closure has no
    // measurable retained size. Declaring it here carries it by reference
    // without granting it any trust — it is type-checked below before use.
    const input = snapshotInput(operation, OPERATION_KEYS, 'broker operation', ['transportWrite']);

    const nowMilliseconds = input.nowMilliseconds;
    if (!Number.isInteger(nowMilliseconds)) {
      fail('KSTACK_MEMORY_BROKER_OPERATION_INVALID', 'nowMilliseconds must be an integer');
    }
    const allowLabeledSnapshots = input.allowLabeledSnapshots;
    if (typeof allowLabeledSnapshots !== 'boolean') {
      fail('KSTACK_MEMORY_BROKER_OPERATION_INVALID', 'allowLabeledSnapshots must be boolean');
    }

    const clockSample = input.clockSample;
    if (clockSample !== null) {
      if (typeof clockSample !== 'object' || Array.isArray(clockSample)) {
        fail('KSTACK_MEMORY_BROKER_OPERATION_INVALID', 'clockSample must be an object or null');
      }
      exactKeys(clockSample, CLOCK_SAMPLE_KEYS, 'clockSample');
    }

    const rawActivation = input.activation;
    exactKeys(rawActivation, ACTIVATION_KEYS, 'activation');
    const activation = Object.freeze({
      requested: rawActivation.requested === true,
      recordId: rawActivation.recordId
    });

    const transportWrite = input.transportWrite;
    if (transportWrite !== null && typeof transportWrite !== 'function') {
      fail('KSTACK_MEMORY_BROKER_OPERATION_INVALID', 'transportWrite must be a function or null');
    }

    const rawCandidates = input.candidates;
    if (!Array.isArray(rawCandidates)) {
      fail('KSTACK_MEMORY_BROKER_OPERATION_INVALID', 'candidates must be a list');
    }
    if (rawCandidates.length > LIMITS.listElements) {
      fail('KSTACK_MEMORY_BROKER_OPERATION_INVALID', 'candidates exceed the list bound');
    }
    // `rawCandidates` is this module's own frozen copy, so ordinary array
    // methods are safe on it in a way they never are on caller input.
    const candidates = Object.freeze(rawCandidates.map((raw) => {
      exactKeys(raw, CANDIDATE_KEYS, 'candidate');
      return Object.freeze({
        recordId: raw.recordId,
        assertedScope: raw.assertedScope,
        chunkByteStart: raw.chunkByteStart,
        chunkByteEndExclusive: raw.chunkByteEndExclusive,
        chunkSha256: raw.chunkSha256,
        retrievalChannels: raw.retrievalChannels,
        componentScores: raw.componentScores,
        connectorFailed: raw.connectorFailed === true
      });
    }));

    // `parseAuthorizationRequest` returns its own frozen validated value, so
    // the request is snapshotted by the act of parsing it.
    const request = parseAuthorizationRequest(input.request);

    return Object.freeze({
      request,
      capabilityIdHash: input.capabilityIdHash,
      candidates,
      nowMilliseconds,
      allowLabeledSnapshots,
      clockSample,
      transportWrite,
      activation
    });
  }

  run(operation) {
    // Step 0: the seam is a disabled flag first and a pipeline second.
    if (!this.#enabled) {
      fail(
        'KSTACK_MEMORY_BROKER_DISABLED',
        'the slice 1 broker seam is disabled; no read, ingest, remote-sync, or administrative-delete path is reachable'
      );
    }
    const trace = [];
    const started = Date.now();
    const record = (name, reasonCode) => {
      trace.push({ step: trace.length + 1, name, reasonCode });
    };

    /* 1. Parse a closed schema; reject unknown/over-limit fields.
     *
     * Every caller-supplied value is read exactly once here, into a frozen
     * local snapshot. Nothing after this point reads `operation` again, so the
     * value that was checked is always the value that is used. */
    const input = this.#snapshotOperation(operation);
    const request = input.request;
    const nowMilliseconds = input.nowMilliseconds;
    record(BROKER_REQUEST_SEQUENCE[0], 'SCHEMA_ACCEPTED');

    /* 2. Authenticate subject and canonicalize request repository. */
    if (!this.#subjects.has(request.subjectId)) {
      record(BROKER_REQUEST_SEQUENCE[1], 'SUBJECT_UNAUTHENTICATED');
      return this.#denied(request, trace, 'SUBJECT_UNAUTHENTICATED', started);
    }
    const repoId = assertRepoId(request.repoId, 'repoId');
    record(BROKER_REQUEST_SEQUENCE[1], 'SUBJECT_AUTHENTICATED');

    /* 3. Hash constraints; resolve capability. */
    const requestConstraintsHash = constraintsHash(request.constraints);
    const capability = this.#capabilities.get(input.capabilityIdHash) ?? null;
    if (capability === null) {
      record(BROKER_REQUEST_SEQUENCE[2], 'CAPABILITY_UNRESOLVABLE');
      return this.#denied(request, trace, 'CAPABILITY_UNRESOLVABLE', started);
    }
    const decision = authorizeCapability({
      // The already-parsed snapshot, never the caller's original object.
      request,
      capability,
      currentPolicyGeneration: this.#policyGeneration,
      nowMilliseconds,
      consumedNonces: this.#consumedNonces,
      grants: this.#grants,
      authenticatedSubjectId: request.subjectId
    });
    if (!decision.allowed) {
      record(BROKER_REQUEST_SEQUENCE[2], decision.reasonCode);
      return this.#denied(request, trace, decision.reasonCode, started, capability);
    }
    if (capability.constraintsHash !== requestConstraintsHash) {
      record(BROKER_REQUEST_SEQUENCE[2], 'CONSTRAINTS_MISMATCH');
      return this.#denied(request, trace, 'CONSTRAINTS_MISMATCH', started, capability);
    }
    record(BROKER_REQUEST_SEQUENCE[2], 'CAPABILITY_RESOLVED');

    /* 4. Acquire the repository shared policy lease; read generation/revocation. */
    const lease = this.#leases.acquireShared(repoId);
    const observedGeneration = this.#policyGeneration;
    record(BROKER_REQUEST_SEQUENCE[3], 'SHARED_LEASE_HELD');

    try {
      /* 5. Query catalog/index only in the authorized repository/grant set. */
      // Only live grants widen the query set. A revoked, expired, or
      // stale-generation grant must not even broaden what is looked at.
      const authorizedRepoIds = new Set([repoId]);
      for (const grant of this.#grants) {
        const liveness = evaluateGrant({
          grant,
          requestRepoId: repoId,
          action: request.action,
          currentPolicyGeneration: observedGeneration,
          nowMilliseconds: nowMilliseconds
        });
        if (liveness.allowed) authorizedRepoIds.add(grant.fromRepoId);
      }
      // Already validated and frozen by the entry snapshot.
      const selected = [];
      for (const raw of input.candidates) {
        const catalogRecord = this.#catalog.get(raw.recordId) ?? null;
        if (catalogRecord === null) continue;
        if (!authorizedRepoIds.has(catalogRecord.repoId)) continue;
        selected.push({ candidate: raw, record: catalogRecord });
      }
      record(BROKER_REQUEST_SEQUENCE[4], `CANDIDATES_${selected.length}`);

      /* 6. Reauthorize each candidate before original-byte access. */
      const reauthorized = [];
      const omissions = [];
      for (const entry of selected) {
        const access = authorizeRecordAccess({
          requestRepoId: repoId,
          record: entry.record,
          action: request.action,
          // The caller's asserted scope is checked for consistency only; the
          // scope grant matching uses comes from the record's own locator.
          assertedScope: entry.candidate.assertedScope,
          grants: this.#grants,
          currentPolicyGeneration: observedGeneration,
          nowMilliseconds: nowMilliseconds
        });
        if (!access.allowed) {
          omissions.push({ recordId: entry.record.recordId, reasonCode: access.reasonCode });
          continue;
        }
        // The `providers` dimension is the repository provider the record's
        // repoId was derived under, resolved from the owner-managed registry.
        // An unregistered repository resolves to null and so denies whenever
        // the dimension is constrained.
        const provider = this.#repositoryRegistry.get(entry.record.repoId) ?? null;
        const fieldSet = entry.record.authorityKind === 'jira'
          ? this.#fieldSets.get(entry.record.authorityLocator.fieldSetId) ?? null
          : null;
        const bounded = constraintsSatisfied(request.constraints, {
          provider,
          projectId: entry.record.authorityKind === 'jira'
            ? entry.record.authorityLocator.projectId
            : null,
          // Field IDs exist only for Jira records, and come from the versioned
          // KStack-owned field set, never from the request.
          fieldIds: fieldSet === null ? null : fieldSet.fields.map((field) => field.fieldId),
          // A path prefix is a source-control dimension. A Jira record is
          // scoped by project, so it resolves to null here and a path-prefix
          // constraint denies it rather than prefix-matching a project ID.
          pathBytes: entry.record.authorityKind === 'jira'
            ? null
            : deriveRecordScope(entry.record).bytes,
          retentionClass: entry.record.retentionClass
        });
        if (!bounded.satisfied) {
          omissions.push({ recordId: entry.record.recordId, reasonCode: bounded.reasonCode });
          continue;
        }
        reauthorized.push({ ...entry, grantId: access.grantId ?? null, fieldSet });
      }
      record(BROKER_REQUEST_SEQUENCE[5], `REAUTHORIZED_${reauthorized.length}`);

      /* 7. Verify source, metadata, original, range, and chunk digests. */
      const verified = [];
      for (const entry of reauthorized) {
        const freshness = this.#freshness({
          entry,
          nowMilliseconds: nowMilliseconds,
          clockSample: input.clockSample,
          allowLabeledSnapshots: input.allowLabeledSnapshots
        });
        if (freshness === null) {
          omissions.push({ recordId: entry.record.recordId, reasonCode: 'FIELD_SET_UNREGISTERED' });
          continue;
        }
        if (!freshness.emit) {
          omissions.push({ recordId: entry.record.recordId, reasonCode: `OMITTED_${freshness.state.toUpperCase()}` });
          continue;
        }
        const originalBytes = this.#bodies.get(entry.record.recordId) ?? null;
        if (originalBytes === null) {
          omissions.push({ recordId: entry.record.recordId, reasonCode: 'ORIGINAL_BYTES_ABSENT' });
          continue;
        }
        const chunkByteStart = entry.candidate.chunkByteStart;
        const chunkByteEndExclusive = entry.candidate.chunkByteEndExclusive;
        let chunk;
        try {
          chunk = verifyCitedRange({
            originalBytes,
            originalContentSha256: entry.record.originalSha256,
            chunkByteStart,
            chunkByteEndExclusive,
            chunkSha256: entry.candidate.chunkSha256
          });
        } catch (error) {
          omissions.push({ recordId: entry.record.recordId, reasonCode: error.code ?? 'DIGEST_MISMATCH' });
          continue;
        }
        // The emitted citation and the audit receipt carry the digest of the
        // bytes that were actually verified, recomputed here from those bytes,
        // never a value re-read from the candidate after the check.
        const verifiedRange = Object.freeze({
          chunkByteStart,
          chunkByteEndExclusive,
          chunkSha256: crypto.createHash('sha256').update(chunk).digest('hex')
        });
        verified.push({ ...entry, freshness, chunk, verifiedRange });
      }
      record(BROKER_REQUEST_SEQUENCE[6], `VERIFIED_${verified.length}`);

      /* 8. Emit cited results plus a content-free audit receipt while holding
       *    the lease; release only after local-transport write completion. */
      const results = verified.map((entry) => parseCitedResultV1({
        resultId: crypto.randomBytes(16).toString('hex'),
        requestRepoId: repoId,
        sourceRecordId: entry.record.recordId,
        authorityKind: entry.record.authorityKind,
        authorityLocator: entry.record.authorityLocator,
        sourceRevision: entry.record.authorityKind === 'jira'
          ? entry.record.authorityLocator.sourceRevision
          : entry.record.authorityLocator.commitSha40,
        observedAt: entry.record.observedAt,
        freshnessState: entry.freshness.state,
        originalContentSha256: entry.record.originalSha256,
        chunkByteStart: entry.verifiedRange.chunkByteStart,
        chunkByteEndExclusive: entry.verifiedRange.chunkByteEndExclusive,
        chunkSha256: entry.verifiedRange.chunkSha256,
        retrievalChannels: entry.candidate.retrievalChannels,
        componentScores: entry.candidate.componentScores,
        policyGeneration: observedGeneration,
        derivationReceiptIds: [],
        trustLabel: TRUST_LABEL
      }));
      const receipt = this.#receipt({
        request,
        capability,
        outcome: 'emitted',
        reasonCodes: omissions.map((omission) => omission.reasonCode),
        results,
        grantIds: [...new Set(reauthorized.map((entry) => entry.grantId).filter((value) => value !== null))],
        policyGeneration: observedGeneration,
        started
      });
      if (typeof input.transportWrite === 'function') {
        input.transportWrite({ results, receipt, leaseHeld: this.#leases.isHeld(repoId) });
      }
      record(BROKER_REQUEST_SEQUENCE[7], `EMITTED_${results.length}`);

      /* 9. Before local activation, repeat policy/revocation validation and
       *    consume the nonce in the same promotion transaction. */
      exactKeys(input.activation, ACTIVATION_KEYS, 'activation');
      let activation = { performed: false, reasonCode: 'ACTIVATION_NOT_REQUESTED' };
      if (input.activation.requested === true) {
        activation = this.#activate({ request, capability, observedGeneration });
      }
      record(BROKER_REQUEST_SEQUENCE[8], activation.reasonCode);

      return Object.freeze({
        outcome: activation.performed || input.activation.requested !== true ? 'completed' : 'blocked',
        trace: Object.freeze(trace),
        results: Object.freeze(results),
        omissions: Object.freeze(omissions),
        activation: Object.freeze(activation),
        receipt
      });
    } finally {
      // Released only after the local-transport write completed above.
      this.#leases.release(lease);
    }
  }

  /**
   * Freshness by authority kind.
   *
   * The accepted design ties `freshForSeconds`/`serveForSeconds` to a
   * `fieldSetId` policy, which only Jira records carry, so a Jira record is
   * evaluated against its own registered field set and an unregistered field
   * set denies. A source-control record is pinned to an immutable commit and
   * blob whose bytes are digest-verified at readback, so no serve window
   * applies to it; a connector failure is still reported as `unavailable`.
   *
   * Returns null when a Jira record names a field set that is not registered.
   */
  #freshness({ entry, nowMilliseconds, clockSample, allowLabeledSnapshots }) {
    const connectorFailed = entry.candidate.connectorFailed === true;
    if (entry.record.authorityKind === 'jira') {
      if (entry.fieldSet === null) return null;
      return evaluateFreshness({
        observedAt: entry.record.observedAt,
        freshForSeconds: entry.fieldSet.freshForSeconds,
        serveForSeconds: entry.fieldSet.serveForSeconds,
        nowMilliseconds,
        clockSample,
        connectorFailed,
        allowLabeledSnapshots
      });
    }
    if (connectorFailed) {
      return Object.freeze({
        state: 'unavailable',
        emit: allowLabeledSnapshots,
        ageSeconds: Math.max(0, nowMilliseconds - Date.parse(entry.record.observedAt)) / 1000,
        reasonCode: 'CONNECTOR_FAILURE'
      });
    }
    return Object.freeze({
      state: 'fresh',
      emit: true,
      ageSeconds: Math.max(0, nowMilliseconds - Date.parse(entry.record.observedAt)) / 1000,
      reasonCode: 'IMMUTABLE_COMMIT_PINNED'
    });
  }

  #activate({ request, capability, observedGeneration }) {
    if (this.#policyGeneration !== observedGeneration) {
      return { performed: false, reasonCode: 'POLICY_GENERATION_CHANGED' };
    }
    if (capability.revokedAt !== null) {
      return { performed: false, reasonCode: 'CAPABILITY_REVOKED' };
    }
    if (!MUTATING_ACTIONS.includes(request.action)) {
      return { performed: false, reasonCode: 'ACTION_DOES_NOT_ACTIVATE' };
    }
    if (request.requestNonce === null) {
      return { performed: false, reasonCode: 'NONCE_MISSING' };
    }
    if (this.#consumedNonces.has(request.requestNonce)) {
      return { performed: false, reasonCode: 'NONCE_REPLAYED' };
    }
    // Promotion and nonce consumption are one step: an in-memory stand-in for
    // the single transaction a later slice will own.
    this.#consumedNonces.add(request.requestNonce);
    return { performed: true, reasonCode: 'ACTIVATED' };
  }

  #denied(request, trace, reasonCode, started, capability = null) {
    return Object.freeze({
      outcome: 'denied',
      trace: Object.freeze(trace),
      results: Object.freeze([]),
      omissions: Object.freeze([]),
      activation: Object.freeze({ performed: false, reasonCode: 'ACTIVATION_NOT_REACHED' }),
      receipt: this.#receipt({
        request,
        capability,
        outcome: 'denied',
        reasonCodes: [reasonCode],
        results: [],
        grantIds: [],
        policyGeneration: this.#policyGeneration,
        started
      })
    });
  }

  /**
   * Content-free audit receipt: operation ID, keyed subject/capability
   * digests, repository/grant IDs, action, policy generation, result record
   * IDs and digests, reason codes, timestamps, and outcome. Queries, tokens,
   * bodies, chunks, issue prose, credentials, and secrets never appear.
   */
  #receipt({ request, capability, outcome, reasonCodes, results, grantIds, policyGeneration, started }) {
    return Object.freeze({
      operationId: crypto.randomBytes(16).toString('hex'),
      subjectDigest: this.#keyedDigest('subject', request.subjectId),
      capabilityDigest: capability === null ? null : this.#keyedDigest('capability', capability.capabilityIdHash),
      repoId: request.repoId,
      grantIds: Object.freeze([...grantIds]),
      action: request.action,
      policyGeneration,
      resultRecordIds: Object.freeze(results.map((result) => result.sourceRecordId)),
      resultDigests: Object.freeze(results.map((result) => result.chunkSha256)),
      reasonCodes: Object.freeze([...new Set(reasonCodes)]),
      startedAtMilliseconds: started,
      completedAtMilliseconds: Date.now(),
      outcome
    });
  }
}

/** Convenience factory that keeps the disabled default explicit at the seam. */
export function createMemoryBrokerSeam(options = {}) {
  // No spread, no guard, no enumeration. The previous form spread `...options`
  // into a fresh object before any validation, so every getter on a plain
  // object ran before the closed-schema check that decides which keys even
  // matter — and the guard protecting it was gated on `typeof === 'object'`,
  // which a Proxy wrapping a function or a bare primitive string both slip
  // past. The spread was redundant in the first place: the constructor already
  // defaults `enabled` from MEMORY_BROKER_SEAM_ENABLED_BY_DEFAULT and validates
  // key names before its own spread. Deleting it leaves exactly one validation
  // site in the seam, and nothing here that can be wrong.
  // `?? {}` preserves the previous `createMemoryBrokerSeam(null)` behaviour
  // exactly — the old spread turned null into the defaults object — without
  // reintroducing any enumeration. Deleting the spread was meant to change
  // cost, not contract.
  return new MemoryBrokerSeam(options ?? {});
}

export { CAPABILITY_ACTIONS, RETRIEVAL_CHANNELS, canonicalConstraints };
