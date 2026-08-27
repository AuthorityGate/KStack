# Objective brief: KStack Memory Maturity

**Date:** 2026-08-26
**Depth:** deep
**Status:** ready for isolated round-one design review
**Parent thread:** `kstack-capability-fabric-2026-08-26`
**Locked owner record:** `.kstack/decisions/kstack-capability-fabric-2026-08-26-round-1-clarification.md`

## Problem

KStack has a local PGlite-backed memory path, explicit retrieval, and manual
remote synchronization, but it does not yet provide a mature, host-neutral
memory service with authoritative provenance, deterministic retrieval,
repository boundaries, lifecycle deletion, or independently qualified local
acceleration. This weakens reliable cross-session reuse and makes it difficult
to distinguish durable evidence from a derived search aid.

This thread designs only the memory-maturity slice. It must not absorb release
execution, domain-pack, host-portability, or confidence-policy implementation.
Jira appears here only as an authoritative source of bounded work and release
records; Git/GitHub remains the authority for versioned KStack artifacts.

## Locked owner decisions

The parent clarification is `LOCKED`; this thread applies rather than reopens
its decisions:

- memory is repository-isolated by default, with explicit cross-repository
  grants and separate read, ingest, remote-sync, and administrative-delete
  permissions (Q10);
- required deletion supports tombstones, body removal or crypto-shredding,
  purge of every derived index/cache/replica, and only a non-sensitive audit
  digest afterward (Q11);
- local-model tags, expansions, and other derivatives have bounded rank
  influence; they cannot suppress exact identifiers/security terms, decide
  trust, or satisfy citations (Q12);
- production or user-data repositories encrypt memory bodies at rest by
  default; development plaintext requires visible configuration and warning
  rather than silent fallback (Q13);
- every Ollama workload and model is qualified for the measured customer
  environment and corpus, with held-out fixtures, named baselines, sufficient
  class counts, confidence bounds, and drift requalification (Q18);
- KStack may automatically choose an already-qualified, digest-bound model
  within the measured resource envelope, but model download/installation is a
  separate ask-tier action (Q19);
- CPU, RAM, and accelerator reserves are configurable and enforced from
  measured peak use, not one universal percentage (Q20);
- context overflow uses cited retrieval/chunking, a smaller qualified model, or
  configured cloud fallback; it never silently truncates or exceeds budget
  (Q21);
- Git/GitHub owns authoritative KStack artifacts, Jira owns authoritative
  ticket/workflow/release records, and Ollama owns no authoritative memory
  (Q23);
- deterministic PGlite/BM25 retrieval is the default. Optional embeddings must
  materially improve a named retrieval outcome without regressing exact-term
  guarantees (Q24); and
- Jira snapshots are explicitly scoped and retain source key, revision,
  timestamps, digests, provenance, freshness, redaction, and deletion policy;
  credentials and unrestricted issue content are excluded (Q25).

Q22 is also binding context: Jira is the durable human-facing release ledger.
This memory design may index authorized release-ledger snapshots, but cannot
change Jira or trigger release activity.

## Required outcome

Produce a neutral, implementation-ready architecture decision that specifies:

1. the authority boundary among Git/GitHub, Jira, the local artifact catalog,
   lexical/vector indexes, caches, and Ollama;
2. repository namespaces, caller identity, least-privilege ACLs, explicit
   cross-repository grants, and grant revocation;
3. ingestion, redaction/quarantine, content addressing, supersession,
   retention, deletion, encryption, key lifecycle, and rebuild semantics;
4. a deterministic PGlite/BM25 baseline and an optional, disposable embedding
   layer whose contribution is measurable and bounded;
5. cited retrieval schemas and ranking rules that preserve exact identifiers,
   security terms, trust, source revision, freshness, and original bytes;
6. Jira snapshot scoping, change detection, staleness, deletion propagation,
   and reconciliation with Git/GitHub records;
7. workload- and environment-specific Ollama qualification, model selection,
   resource/context behavior, network/privacy controls, abstention, and
   deterministic fallback;
8. corruption, prompt-injection, credential, cross-tenant, stale-data,
   rollback, and disaster-recovery threats; and
9. independently shippable migration stages with acceptance and rollback
   evidence for each stage.

## Non-goals

- Making PGlite, an embedding index, Ollama, or generated summaries a system of
  record.
- Replacing Codex or Opus as independent reviewers or allowing a local model to
  score gates, grant authority, choose releases, or execute side effects.
- Treating Jira prose as trusted instruction or ingesting an unrestricted Jira
  instance.
- Automatically downloading a model, enabling networked inference, or claiming
  performance from GPU model names alone.
- Delivering a universal generative-model recommendation independent of
  workload, context demand, driver/runtime availability, or resource reserve.
- Implementing the design, changing configuration/code, or modifying external
  GitHub/Jira state in this round.

## Success evidence

- A repository-scoped query cannot access another repository without an
  explicit, auditable grant; revocation takes effect at the service boundary.
- Every returned memory result cites the immutable Git/GitHub artifact or
  revisioned, approved Jira snapshot that supports it, with source and chunk
  digests.
- The lexical baseline recovers all frozen exact identifier and security-term
  fixtures even when semantic indexes are enabled or corrupt.
- Deleting a sensitive body removes or cryptographically destroys it from
  originals, rebuild inputs, indexes, caches, replicas, backups within policy,
  and future retrieval; only safe receipt metadata survives.
- Production/user-data fixtures fail closed without valid encryption/key
  policy. Development plaintext is conspicuous and explicitly configured.
- Jira fixtures prove field/project scope, revision and freshness tracking,
  credential exclusion, redaction, deletion propagation, and idempotent
  snapshot updates.
- Each optional Ollama workload has a signed/digest-bound qualification receipt
  tying model, quantization, context, runtime, environment profile, corpus,
  metrics, resource peaks, and expiry. Failure or absence preserves baseline
  behavior.
- Indexes can be discarded and rebuilt from authorized sources, and the prior
  stable retrieval implementation remains an atomic rollback target.

## Constraints and authority

All trust, ACL, retention, deletion, encryption, provenance, citation, and
fallback decisions are deterministic. Model output is untrusted derived data.
The memory service must not receive deployment or repository-write authority.
This objective authorizes only project-local objective/review artifacts and
read-only inspection. It authorizes no implementation, reviewer dispatch,
model installation, Jira/GitHub write, commit, push, or deployment.
