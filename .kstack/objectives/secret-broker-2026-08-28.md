# Objective: KStack Secret Broker

**Thread:** `secret-broker-2026-08-28`  
**Date:** 2026-08-28  
**Status:** design in progress  
**Review route:** Codex-only item improvement; confidence `>=93`; zero failed
checks, security findings, material dissent, and unresolved questions on the
same frozen item candidate  
**Implementation authority:** not granted

## Outcome

Create one KStack skill and protected execution service that lets Claude Code
and Codex CLI perform an exact approved operation with a password, API key,
token, certificate, or other secret without placing the secret value in chat,
model context, tool arguments, command arguments, ordinary process environment,
repository files, logs, receipts, Jira, GitHub, reviewer packets, reports, or
clipboard.

The model may see and select safe metadata plus an opaque secret handle. It may
never retrieve, enumerate across unauthorized scopes, transform, echo, export,
or ask a generic tool to return the protected value. A bounded executor resolves
the handle only after policy, approval, target, adapter, generation, and
freshness checks and performs one registered operation. The result is a fixed,
content-free receipt or typed safe failure.

## User-visible behavior

1. `kstack-init` discovers supported local and production custody backends and
   asks whether to configure now, defer, or disable the broker for the
   repository. Discovery and planning are read-only.
2. Secret entry happens outside model-visible chat through a provider UI,
   provider-native authorization, OS credential UI, or a no-echo local broker
   prompt. KStack never asks the user to paste a secret into chat.
3. Safe lookup returns only opaque handle, purpose, provider/tenant/target
   labels, scope, lifecycle state, generation, and expiry class. Labels never
   authorize use.
4. Preparation displays the exact operation, target, environment, credential
   purpose, approval requirement, and failure consequence without revealing
   the value.
5. Execution is single-purpose, target-bound, time-bounded, non-transferable,
   and fail-closed. Unknown outcomes become `AMBIGUOUS` and require read-only
   reconciliation before another attempt.
6. Rotation, revocation, expiry, deletion, recovery, migration, and backend
   loss have explicit states and operator guidance. There is no plaintext-file
   fallback.
7. A secret pasted into chat is already exposed to the host. KStack warns,
   blocks covered downstream use, records only a non-secret incident fact, and
   offers rotation guidance; it never claims it prevented the initial exposure.

## Scope

### Included in v1 design

- Claude Code and Codex CLI using one KStack-native contract with honest,
  per-host capability claims.
- One developer-oriented backend and one production/self-hosted backend behind
  the same closed adapter interface.
- Passwords, API tokens, client credentials, certificates/private-key handles,
  and provider-issued dynamic credentials when a backend supports them.
- Opaque handles, safe metadata discovery, preparation, approval, execution,
  lifecycle, audit, reconciliation, setup, migration, health, and uninstall.
- Registered narrow adapters such as Git HTTPS authentication, Jira API calls,
  provider API clients, inherited descriptors, private sockets, native
  callbacks, and target-specific SDK handles.
- Cross-platform custody profiles for Windows, macOS, and Linux, qualified
  separately instead of weakened to a common denominator.
- Synthetic-secret tests and isolated local fixtures. No production secret is
  needed for design or initial implementation.

### Explicitly excluded from v1

- A general password-manager UI, browser autofill, consumer password sharing,
  arbitrary shell secret injection, bulk export, or MCP resource returning
  plaintext.
- Passing secrets through ordinary environment variables, argv, repository or
  shared temporary files, model-visible stdin/stdout/stderr, or prompt
  expansion.
- Automatic import of `.env`, credential, or configuration files.
- Automatic rotation, deletion, migration, or provider mutation without exact
  preview, separate authority, approval, and ambiguity handling.
- Claiming protection from a compromised kernel/administrator/debugger or an
  already-authorized malicious target.
- Selecting a KStack-native encrypted repository before external and OS
  custody adapters are shown insufficient. Existing ECR designs remain a
  fallback candidate, not the default implementation mandate.

## Observed repository baseline

- The safety broker already rejects credential-bearing request keys, scans
  exact outbound fields and Git object closures, delays Git credential access
  until scan/approval/attestation/target checks, and accepts only bounded safe
  receipts.
- The POSIX Git worker descriptor-revalidates a protected mode-0600 credential
  file outside the repository and supplies the stable value through a private
  one-use askpass socket. It strips ambient Git credential controls and discards
  child stdout/stderr.
- Jira credential loading validates absolute location, ownership, mode,
  symlink/identity stability, file shape, and out-of-repository placement, but
  the current source is still protected plaintext and the Jira process receives
  the value.
- Claude has bounded deny/ask projections on covered tool paths. Codex remains
  deny-only for ask-tier enforcement; explicit broker skill invocation must not
  be described as real-time interception.
- CI runs a full-history Gitleaks scan. Reflexion, Memory, KCRP, reports, and
  review artifacts have explicit secret-exclusion rules.
- ECR TC01–TC04 and TC06A/TC06B are closed design slices. TC05 and later ECR
  work are incomplete, and no ECR runtime exists.

## Design principles

1. **Eliminate before storing.** Prefer workload identity, OIDC, passkeys,
   certificates, provider-native federation, and short-lived dynamic
   credentials over long-lived shared secrets.
2. **Compose before building.** KStack owns policy, handles, approvals, target
   binding, execution fencing, safe receipts, and host projections. Qualified
   providers or OS custody own secret storage, cryptography, and provider-side
   rotation wherever possible.
3. **No model value channel.** The broker API has no `getValue`, reveal,
   export, render, template, arbitrary exec, or generic read operation.
4. **One operation, one lease.** A lease binds principal, session, host,
   repository, environment, handle, generation, provider, tenant, target,
   adapter/executable identity, operation digest, approval, TTL, and use count.
5. **Safe failure over fallback.** Backend, identity, audit, custody, target,
   freshness, or containment failure makes the operation unavailable.
6. **Capability claims are executed evidence.** Backend, host, platform, and
   adapter support are reported separately as discovered, configured,
   authenticated, executable, lifecycle-capable, qualified, and production
   approved.

## Success evidence

- A closed versioned schema rejects unknown fields, credential values, generic
  commands, raw endpoints, output paths, helper/plugin injection, and unbounded
  text before any backend contact.
- Opaque handles are unguessable or non-enumerable outside their authorized
  scope and are bound to immutable backend identity plus generation.
- The model-facing process never receives a protected value. Positive-control
  leak tests prove the harness detects exact, encoded, prefix, child, error,
  receipt, log, file, argv, environment, and crash-output leakage.
- Developer and production backends pass the same adapter conformance suite,
  with separately recorded limitations and no silent fallback between them.
- Bootstrap credentials reside in an OS credential facility or workload
  identity; repository files and ordinary ambient environment are prohibited.
- Rotation, revocation, expiry, deletion, provider ambiguity, backend outage,
  target drift, stale generation, approval expiry, concurrency, crash cuts, and
  restart have deterministic tests and safe terminal states.
- Existing Git and Jira protected-file users have a previewed, reversible
  migration with read-back verification. Source files are not deleted until
  the new path is qualified and separately approved; ambiguous migration never
  retries or destroys the source.
- Each supported platform and target adapter has real qualification evidence.
  Fixture success alone is labeled fixture-tested.
- The final design and every isolated item close at Codex confidence `>=93`
  with zero failed checks, security findings, material dissent, and unresolved
  questions on the same digest.

## Authority boundaries

- Read-only contender research and project-local design artifacts are allowed.
- No provider account, login, install, vault/server creation, secret entry,
  import, migration, rotation, revocation, deletion, environment change,
  deployment, Jira mutation, Git commit/push, or production trial is authorized
  by this objective.
- Review packets contain only repository code/design evidence and synthetic
  examples. They never contain real credential values, private tenant details,
  personal file paths, or user-specific configuration.
- Provider selection does not authorize procurement or dependency adoption.
- Implementation begins only after the complete design package reaches the
  stated gate and receives explicit owner approval.

## Isolated design items

The living ledger at
`.kstack/decisions/secret-broker-2026-08-28-item-ledger.md` controls item
attribution. Items may be reviewed in parallel only when their mechanisms and
failure consequences are independent; the final integration item is always
reviewed after its dependencies.
