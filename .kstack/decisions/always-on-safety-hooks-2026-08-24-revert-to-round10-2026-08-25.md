# Decision: revert always-on safety hooks to round 10

**Thread:** `always-on-safety-hooks-2026-08-24`  
**Decision date:** 2026-08-25  
**Decision owner:** project owner  
**Status:** accepted and controlling for the next design round  
**Working baseline:** round 10

**Per-item redo-lineage ledger:**
[`always-on-safety-hooks-2026-08-24-item-ledger.md`](always-on-safety-hooks-2026-08-24-item-ledger.md)

## Decision

The owner explicitly directed a full design-lineage revert to round 10. Rounds
11 through 17, the Fable round-12 and round-14 rulings, and the cumulative
round-15 design specification are superseded and are not design authority for
future work. They remain preserved only as non-authoritative audit history in:

`.kstack/reviews/always-on-safety-hooks-2026-08-24-SUPERSEDED-2026-08-25/`

The active reviewed baseline is the complete round-10 packet in:

`.kstack/reviews/always-on-safety-hooks-2026-08-24-round10/`

This decision changes documentation, decision lineage, and project memory
only. It does not authorize application implementation and does not modify an
installed hook, credential, host configuration, or Git history.

## Reason

The minimum-of-two-reviewers gate-confidence sequence for rounds 9 through 17
was `42, 62, 41, 38, 30, 18, 24, 3, 31`. Round 10 was the only round to exceed
its predecessor and establish the high-water mark of 62. Every post-round-10
result remained below 62: five transitions declined and the two partial
recoveries at rounds 15 and 17 did not restore the round-10 level. The design
accumulated mechanisms and review surface while confidence failed to recover.

The owner therefore rejected the continued lineage and required that a
confidence drop stop the proposed change, trigger reevaluation of alternatives,
and produce durable records of rejected options. This record implements that
decision without drafting or reviewing a replacement round 11.

## Rejected-options ledger

### 1. Forgeable local credential-disposition attestation as a Q3 boundary

- **What was tried:** A local credential-disposition or absence/revocation
  attestation produced inside the same user boundary was proposed as proof that
  the Q3 credential condition was closed.
- **Rounds:** Introduced in round 11 and carried into the discarded lineage.
- **Confidence effect:** The combined gate confidence fell from 62 in round 10
  to 41 in round 11.
- **Why rejected:** The same-UID actor whose credential access is in question
  is also the only local party able to produce or influence the attestation.
  Within that boundary, the mechanism can assert credential absence or
  revocation but cannot independently verify it against that actor. A
  forgeable, self-attested fact therefore cannot serve as a Q3 security
  boundary.

### 2. Bespoke NFA matcher engine replacing the bounded reviewed RegExp set

- **What was tried:** A custom compiler/interpreter and NFA execution model was
  introduced to replace the existing ten bounded, reviewed RegExp matchers,
  bringing new state, edge, EOF, memory, migration, and work-accounting rules.
- **Rounds:** Introduced and expanded in rounds 12 and 13; the discarded Fable
  round-14 ruling later directed its removal.
- **Confidence effect:** Combined confidence declined from 41 in round 11 to
  38 in round 12 and then to 30 in round 13.
- **Why rejected:** The custom engine creates a large novel parsing and
  matching attack surface with substantial correctness, resource-accounting,
  migration, and maintenance risk. No compensating security requirement
  requires that new engine. The existing RegExp declarations, when statically
  pinned, capped, gated, and tested, are the lower-risk mechanism.

### 3. Private immutable Git snapshot or confined object reader

- **What was tried:** A private immutable snapshot or confined Git-object
  reader was treated as necessary to prevent a same-UID actor from
  reconstructing deleted executor, worker, or askpass bytes from repository
  history.
- **Rounds:** The reconstructability demand originated in Codex's round-10
  blocker, was promoted into a proposed mechanism by round 13, and was rejected
  in the now-superseded Fable round-14 reasoning.
- **Confidence effect:** The finding was open at the round-10 combined
  confidence of 62. Turning it into snapshot architecture did not improve the
  design: confidence had fallen to 30 by round 13 and fell again to 18 in
  round 14.
- **Why rejected:** Under this objective's own threat model, the same-UID actor
  already has arbitrary code execution as that user, including ordinary Git,
  filesystem, process, and network capabilities. Reconstructing previously
  deleted KStack implementation bytes adds no actor capability. Whether an old
  helper could still use a valid credential is an owner residual-risk and
  credential-validity fact, not a new capability created by reconstruction.
  Q3 therefore does not require a private snapshot or confined object reader.

### 4. Per-platform native launcher binaries as the v1 default

- **What was tried:** Native launchers for each supported platform, with pinned
  compiler toolchains, architecture-specific builds, code signing,
  notarization, and distributed binary artifacts, were considered as the
  default hook-command vehicle.
- **Rounds:** Considered in rounds 13 and 14; the discarded Fable round-14
  reasoning selected a pinned static environment-scrubber command instead.
- **Confidence effect:** The launcher decision was part of the expansion from
  round 12's confidence of 38 to round 13's 30 and round 14's 18. Selecting the
  simpler alternative did not recover confidence within that overloaded
  lineage.
- **Why rejected:** Native launchers impose a disproportionate v1 release and
  supply-chain surface: compiler and SDK pins, per-platform build provenance,
  signing keys and policy, notarization, binary distribution, updates, and
  platform-specific incident response. A pinned static environment-scrubber
  command can satisfy the v1 post-start environment requirement with a much
  smaller trusted and operational surface. Native launchers may return only if
  evidence shows that the static command cannot satisfy a named supported
  platform, and that platform-specific exception requires fresh owner review.

### 5. Totalizing closed-artifact-universe capability analysis and exact-producer-bound preview cap

- **What was tried:** A totalizing "closed artifact universe"
  capability-analysis framework covering all four distribution channels and
  all bundled third-party dependencies, including `pglite`, `node-gyp`, and
  transitive dependencies, paired with an exact-producer-identity-bound
  preview-cap contract.
- **Rounds:** Attempted once, in the round-12-redo dispatch at
  `.kstack/reviews/always-on-safety-hooks-2026-08-24-round12-redo/`.
- **Confidence effect:** Combined confidence dropped from round 11-redo's 74
  to 66.
- **Why rejected:** The preview-cap contract required the final response
  buffer to be built and cap-checked before scanning while also containing
  exact post-scan values unchanged. Codex identified that timing contract as a
  direct self-contradiction and unimplementable as written. Separately, the
  blanket prohibition on source-text evaluation, custom loaders, and computed
  resolution had no exception path for KStack's actual bundled native
  dependencies, including `pglite` and `node-gyp`, which legitimately need
  filesystem, process, or network access for unrelated plugin features. That
  unbounded proof obligation risked making every distribution channel
  unshippable at once and repeated the already-rejected failure pattern of
  trying to prove a universal claim against everything. Future static-graph
  and capability-analysis claims must instead be scoped to the actual
  safety-relevant module boundary and its reachable imports.

### 6. Five-file safety boundary with incomplete launch, spawn, upgrade, and wire contracts

- **What was tried:** A narrowed five-file Safety-Module Set v1 over the
  scan/prepare/status/deny path, paired with specimen-scoped source/setup-copy
  evidence, unavailable-before-atomic precedence, full `createHostBridge`
  removal, status v2 compatibility aliases, and a conservative numeric preview
  cap.
- **Rounds:** Attempted once, in the round-12-redo2 dispatch at
  `.kstack/reviews/always-on-safety-hooks-2026-08-24-round12-redo2/`.
- **Confidence effect:** Combined confidence dropped from round 11-redo's 74
  to 64.
- **Why rejected:** The narrower scope was directionally accepted, but its
  boundary was not yet an executable contract. It omitted the graph root set
  and exact `hooks.json` launch grammar; left the one retained Git `spawnSync`
  site's argv, environment, config, and operand hardening unspecified; allowed
  artifact selection before activation refresh succeeded; asserted exact
  READY/ask size constants without complete canonical outer schemas; did not
  structurally dispose constructor injection seams; and used three legacy
  filenames rather than a capability-based rule for a differently named
  first-party credential/tool-call module. These gaps produced two high launch
  and upgrade findings from Codex plus a high scanner-spawn finding from Opus.
  A future attempt may keep the safety graph narrow, but it must make every
  launch, retained process, injection, serialization, and upgrade edge exact
  without expanding analysis to unrelated third-party dependencies.

### 7. Exact-edge CFD boundary with unsafe fallbacks and semantic analysis residue

- **What was tried:** A third round-12 redo applied ten localized remediations:
  exact `{hook, broker, admin}` roots; byte-exact `hooks.json`; one fixed Git
  argv/environment; structurally private zero-argument broker construction;
  verify-before-select upgrade ordering; complete READY/ask/ref schemas;
  conservative response inequalities; honest status-v2 wording; a plain full
  installed-file list; and first-party-only protected-path analysis.
- **Rounds:** Attempted once, in the round-12-redo3 dispatch at
  `.kstack/reviews/always-on-safety-hooks-2026-08-24-round12-redo3/`.
- **Confidence effect:** Combined confidence dropped from round 11-redo's 74
  to 43 (`min(Codex 43, Opus 76)`), the largest regression of the redo lineage.
- **Why rejected:** The supposedly exact hook bytes froze a `.` fallback that
  can launch repository-CWD code when plugin-root variables are empty and did
  not scrub the launcher environment. The hardened Git child still honored
  repository-local config/includes and helper-spawning keys, leaving a named
  KStack-created arbitrary-file-open path. The name-only manifest deferred its
  final file/classification lists and relied on an undefined selected-root
  content digest, while its first-party protected-path check remained a
  semantic, non-decidable obligation rather than a finite lint. Ask/status
  producers were unreachable in the enumerated graph; multi-scope atomic swap
  and crash recovery were asserted without a storage unit; and Git version,
  scanner/hook failure, status-state, and attestation-MAC contracts remained
  incomplete. A future attempt must keep the small-change direction but remove
  unsafe fallbacks and semantic proof claims: fail closed on unresolved launch
  roots, neutralize local Git config/helper keys, use a finite named
  protected-path lint, define one content digest and per-scope swap semantics,
  and make ask/status ownership and failure states explicit.

### 8. Absolute launcher paths without deterministic serialization or interpreter provenance

- **What was tried:** A fifth redo-lineage attempt made exactly one design
  change from round 11 redo: activation/update would materialize literal
  canonical absolute interpreter and hook-module paths, reject every relative,
  `PATH`, environment-root, and cwd fallback, report
  `KSG-LAUNCHER-UNAVAILABLE-001` on resolution failure, and prove the result
  with same-named hostile-CWD canaries.
- **Rounds:** Attempted once, in the round-12-redo4 dispatch at
  `.kstack/reviews/always-on-safety-hooks-2026-08-24-round12-redo4/`.
- **Confidence effect:** Combined confidence dropped from round 11 redo's 74
  to 52 (`min(Codex 52, Opus 74)`).
- **Why rejected:** Both reviewers agreed that the absolute hook-module operand
  removes the original `.`/cwd fallback, but the replacement command delegated
  its security boundary to undefined “correctly shell-quoted” bytes. The shown
  double quotes do not neutralize POSIX-shell dollar, backtick, or backslash
  interpretation, so a metacharacter-bearing installation path can create a
  new injection path. The interpreter was bound only as an absolute canonical
  regular file, without an authoritative source or positive identity; a hostile
  activation-time `PATH` could therefore be frozen into an apparently valid
  registration. The test did not cover hostile activation, positive
  interpreter identity, or parser-significant paths, and platform grammar,
  Codex-cell scope, and execution-time revalidation ownership were still
  ambiguous. A future launcher proposal must treat command serialization and
  interpreter provenance as inseparable parts of path pinning: define one exact
  parser/escaping or rejection grammar per supported cell, derive the
  interpreter from an authoritative non-`PATH` source, and verify both recorded
  identities under hostile activation as well as hostile invocation.

### 9. Exact host encoders without deployed consumer qualification

- **What was tried:** A sixth redo-lineage attempt treated the complete
  launcher as one cohesive mechanism. It retained canonical absolute targets;
  used Claude's direct `args` exec form; defined Codex POSIX quoting byte-for-
  byte with the embedded-apostrophe rule; selected only canonical root-owned
  executable Node 20+ from `process.execPath`; covered hostile activation and
  invocation plus quotes, backticks, dollars, backslashes, whitespace, and
  newlines; covered both hosts and scopes; and disclosed pre-start/same-UID
  replacement as a Q4/Q14 residual.
- **Rounds:** Attempted once, in the round-12-redo5 dispatch at
  `.kstack/reviews/always-on-safety-hooks-2026-08-24-round12-redo5/`.
- **Confidence effect:** Combined confidence dropped from round 11 redo's 74
  to 68 (`min(Codex 68, Opus 72)`). This is the sixth consecutive failed
  attempt at round 12.
- **Why rejected:** Both reviewers accepted the absolute tuple and the two
  encoders for their exact declared consumers. The packet qualified locally
  observed host versions only as test fixtures; activation, publication, and
  status did not bind an enabled registration to the installed host build,
  Claude command-form support, platform, or Codex shell identity, or invalidate
  it after host update/configuration drift. If Claude ignores `args`, the same
  handler can launch bare Node without the guard and feed hook stdin to Node;
  an incompatible Codex parser can reinterpret an otherwise-correct `Q`
  string. Both cases can remain reported active. The expected-path flags were
  self-referential rather than independently anchored; fixed status messages
  and macOS evidence were absent; and the `argv0` equality check was forgeable
  by the modeled same-UID actor while excluding normal activation layouts.
  Loader-variable and general launch-failure findings remain separate deferred
  items, but the claim must narrow to interpreter-binary identity. A future
  owner-authorized architecture should use a KStack-owned executable shim at a
  stable metacharacter-free path whose zero-argument behavior is fixed denial,
  bind publication/status to an exact host/platform/handler/shell qualification
  record with update invalidation, drop `argv0` as a security control, and
  initially claim only platforms with real-host conformance evidence.

### 10. Fixed Git candidates with denylist environment and runtime loopback qualification

- **What was tried:** An eighth redo-lineage attempt isolated the scanner Git
  binary item. It used exact Linux/Darwin candidate tables, validated lexical
  and canonical path chains as root-owned and non-writable, spawned the
  canonical real path, required Git 2.45.0, retained redo6's closed Git config,
  added both no-lazy controls, ran a three-clone promisor/loopback conformance
  probe on first use, and returned a typed terminal unavailable handle.
- **Rounds:** Attempted once, in the round-12-redo7 dispatch at
  `.kstack/reviews/always-on-safety-hooks-2026-08-24-round12-redo7/`.
- **Confidence effect:** Combined confidence fell from the current item-level
  high-water mark 78 to 42 (`min(Codex 42, Opus 64)`).
- **Why rejected:** The intentionally unguarded positive control inherited
  proxy variables, so it could contact a non-loopback destination; guarded
  zero-connect assertions observed only one listener and could pass while Git
  egressed elsewhere. The non-`GIT_*` environment was closed by a fixed
  denylist, leaving `DEVELOPER_DIR`, TLS/proxy variables,
  `GLIBC_TUNABLES`, and future runtime selectors. On macOS, root-owned
  `/usr/bin/git` may be a toolchain shim whose effective Git is selected by
  that inherited environment, while root-owned wrapper-script leaves similarly
  shift identity to an unpinned interpreter. Finally, `lstat` immediately
  before pathname-based `spawnSync` did not atomically bind execution to the
  qualified inode, and mixed candidate failures had no total reason
  precedence. Broker lifetime, probe cost, Git >=2.45 layout coverage, version
  output grammar, http-less builds, and installation-wide unavailable status
  were also unresolved. A future attempt must build a closed child environment,
  bind execution atomically to a native executable on each actually supported
  platform (or narrow the platform claim), use an all-egress denial/observation
  boundary instead of a single listener, totalize failure precedence, and
  separate durable release qualification from the hot scan path only with an
  identity-bound invalidation and honest status contract.

### 11. Dedicated credential formatter with incomplete probe canary and Windows admission

- **What was tried:** A ninth redo-lineage attempt isolated the admin
  credential path-format helper. It moved the sanctioned export into a
  one-export `node:path`-only module, constrained it to primitive platform/base
  inputs and lexical formatting, directly invoked that production export under
  throwing filesystem spies, and compared credential-relevant registration and
  status output across present, absent, and alternate node types.
- **Rounds:** Attempted once, in the round-12-redo8 dispatch at
  `.kstack/reviews/always-on-safety-hooks-2026-08-24-round12-redo8/`.
- **Confidence effect:** Combined confidence fell from the current item-level
  high-water mark 78 to 72 (`min(Codex 72, Opus 76)`).
- **Why rejected:** The direct helper test was correctly aimed at the sanctioned
  export, and both reviewers retained the dedicated path-only module as the
  preferred shape. The production admin/status spy nevertheless trapped only
  exact credential-path operands, so a swallowed `readdir`, glob, or watch of
  the credential parent could still reveal existence without incrementing the
  canary. The Windows rule treated `path.win32.isAbsolute` as fully qualified,
  admitting root-relative values that cannot reliably participate in exact
  textual protection matching. The mandatory `vm.SourceTextModule` check did
  not name its required runner flag; activation behavior and error disclosure
  for malformed internal input were incomplete; skipped host fixtures could be
  silent; caller snapshot construction and executor-factory consumption were
  not directly canaried; and Windows alias/case/short-name limitations were not
  disclosed. A future attempt may retain the pure module, but must observe the
  entire unique credential fixture root including ancestor enumeration and
  encompassing glob/watch patterns with normalized PathLike operands; admit
  only an exact fully-qualified Windows grammar; run the structural sandbox as
  an explicit hard Node >=20 command with the needed flag; use a fixed path-free
  pre-mutation input error; enumerate every supported/unsupported fixture cell;
  structurally bind both primitive caller records; and canary executor
  construction up to the separately authorized worker-read boundary.

### 12. Detached full-file manifest with incompletely frozen payload and verifier contract

- **What was tried:** A tenth redo-lineage attempt treated the exact permitted
  full payload list and per-file raw-byte SHA-256 as one inseparable mechanism.
  It inlined 1,827 exact entries, detached the manifest to avoid a self-hash
  cycle, defined a selected-root digest over canonical manifest bytes, and
  required distinct extra, missing, wrong-type, and content-mismatch results at
  build, install, upgrade, doctor, status, refresh, and rollback.
- **Rounds:** Attempted once, in the round-12-redo9 dispatch at
  `.kstack/reviews/always-on-safety-hooks-2026-08-24-round12-redo9/`.
- **Confidence effect:** Combined confidence fell from the current item-level
  high-water mark 78 to 58 (`min(Codex 58, Opus 66)`).
- **Why rejected:** The core list-plus-digest direction remained preferred and
  no reviewer required signing or external pinning, but the exact contract was
  not implementation-ready. Canonical JSON left integer and escape spellings
  open; the path grammar admitted control/quote ambiguity and did not totalize
  target-filesystem aliases; no-follow checks did not anchor the root and all
  parent components; actual-tree work and diagnostic output were unbounded;
  first-install bootstrap, legacy migration, and crash-atomic selector/
  manifest/registration state were incomplete; and the payload-freeze premise
  did not reconcile current dependency preparation below the source root. The
  next alternative should retain the plain mechanism but use a preassembled
  immutable payload, printable-ASCII canonical paths, a named supported-
  filesystem matrix, root-handle traversal, bounded typed-overflow behavior,
  and one versioned recoverable selection tuple. It must keep first-install
  provenance and between-check same-UID replacement explicitly outside Q4
  detection rather than introduce heavier trust infrastructure.

### 13. Numeric cap with unrestricted matcher-version escaping

- **What was tried:** Round12-redo11 derived 1,253-byte maximal attestation,
  1,456-byte empty-preview READY, and 3,946-byte READY cap without builder
  identity.
- **Confidence effect:** The batch combined confidence was 55, 28 below the
  current 83 high-water mark. Both displayed PASS, but Opus's own failed check
  contradicts that label on this exact arithmetic premise.
- **Why rejected:** The grammar admits any 64 ASCII matcher-version bytes while
  the row count assumes no JSON escaping. Quote, backslash, and control bytes
  invalidate the claimed upper bound. Final measurement is safe but does not
  establish the requested independent conservative derivation.
- **Alternative:** restrict that field to a no-escape ASCII alphabet and
  recompute, or include maximal escaping growth. Preserve final buffer checks.

### 14. Semantically incorporated child controls without exact numeric limits

- **What was tried:** Round12-redo11 layered shell-false invocation, fixed
  suffix shapes, operand validation, separator discipline, and a minimal closed
  environment on validated redo6 configuration isolation.
- **Confidence effect:** Codex failed this item; Opus passed with required
  refinements. It is one of the specific drivers of combined confidence 55.
- **Why rejected:** Literal global controls, complete environment values, and
  timeout/output/argv-count/argv-byte ceilings were not all enumerated. A
  security-critical “bounded” contract therefore permits divergent results.
- **Alternative:** inline every literal and numeric constant, capture exact
  argv/options/environment, and define fixed per-platform environment tables.

### 15. Finite-lint proposal with non-mechanical anchors and exceptions

- **What was tried:** Round12-redo11 pinned a parser, five first-party inputs,
  seven named syntactic rules, third-party exclusions, and positive/near-miss
  fixtures.
- **Confidence effect:** Both reviewers failed the item; it is the strongest
  shared objection in the 55-confidence batch.
- **Why rejected:** Several AST categories and exception nodes were undefined.
  Mutation matching requires flow the lint disclaims or becomes vacuous, and
  locator/mutation literals can reject the deny classifier that recognizes
  them.
- **Alternative:** exhaustive AST node/callee/member patterns; exact inline
  anchor or whole-file over-approximation; digest-bound data-table exceptions;
  and a conforming-classifier positive fixture.

### 16. Structural seam removal with semantic alternate reachability

- **What was tried:** Round12-redo11 required one zero-argument factory,
  private classes/state/scanner, exact frozen facade, no injectable inputs, and
  export/property/AST negative checks.
- **Confidence effect:** Codex failed and Opus passed; the item is specifically
  implicated in the combined 55 result.
- **Why rejected:** “Reachable alternate implementation” lacked a finite rule
  for nonlocal imports, indirect construction, or implementation identity.
- **Alternative:** exact import/export/call-expression sets and forbidden
  parameter/property/callee identifiers, with one negative fixture per
  indirect form and process-level time/failure tests.

### 17. Honest channel labels with incomplete promotion proof

- **What was tried:** Round12-redo11 kept per-channel evidence independent,
  expressly withheld Claude installed-payload and final Codex-cache coverage,
  and described a future channel promotion.
- **Confidence effect:** Codex failed and Opus passed; this exact future gate is
  specifically implicated in combined confidence 55.
- **Why rejected:** Current narrowing is retained, but future EVIDENCED status
  lacked digest algorithm/canonical manifest, exact file universe, mandatory
  mutation rejection, release policy, and user-visible surfacing ownership.
- **Alternative:** canonical SHA-256 path-plus-byte-digest manifest, exact root
  enumeration, mandatory extra/missing/changed rejection, explicit release
  policy for unevidenced rows, and separately owned status surfacing.

## Reasoning preserved for direct reuse

The two Fable rulings are discarded as binding design lineage. The following
arguments discovered during that work are preserved as reusable reasoning, not
as authority from those rulings.

### Git-history reconstruction does not violate Q3

The threat model already grants the same-UID actor arbitrary code execution as
the user. That actor can write equivalent code, invoke Git and filesystem APIs,
spawn processes, and use network clients without reconstructing a KStack blob.
Recovering deleted executor, worker, or askpass bytes from Git history therefore
does not grant a capability the actor lacked. The relevant Q3 question is
whether the current KStack-distributed artifact's own code creates a protected
credential or execution path that the actor would not otherwise receive.

Credential validity must be kept separate from capability. If a reconstructed
historical helper can use a still-valid credential, the credential's continued
validity and custody are explicit owner residual-risk facts. They are not proof
that byte reconstruction itself elevated the actor. The next design may require
truthful credential-risk disclosure or an owner decision about credential
validity, but it must not invent a private snapshot merely to suppress bytes
that add no capability under the stated threat model.

### Same-UID ambient-mutation classification test

Apply this test to every same-UID ambient-state finding:

1. Name the exact KStack-distributed artifact, code path, claimed protection,
   and actor action.
2. Ask whether the artifact's own shipped code creates or exposes the protected
   capability when used or directly imported. If yes, the finding is a design
   or build requirement and needs a bounded prevention or fail-closed result.
3. Otherwise ask whether the exposure exists only because the same-UID actor
   can already create, mutate, replace, or select ambient host state before or
   after KStack's own operation using authority granted by the threat model. If
   yes, it is not a KStack build requirement; route it to an explicit Q14
   outside-coverage disclosure with exact scope and consequences.
4. Do not use ambient same-UID power to excuse a KStack-created path. The
   outside-coverage classification applies only when KStack's distributed
   artifact adds no capability or exposure of its own.

This test keeps Q3 focused on KStack-created credential and execution paths and
keeps Q14 honest about host powers the product does not and cannot contain.

## Required next-round starting point

The next real design round must start from round 10, not from any archived
round or the retired cumulative specification. Its actual open question is
Codex's round-10 `block`/94 finding that deleted executor, worker, and askpass
bytes remain reconstructable from Git history.

Resolve that finding directly with the preserved argument above: establish
that reconstruction adds no capability to the same-UID actor under the stated
threat model, separate credential-validity residual risk from actor capability,
bound the Q3 claim to paths created by the KStack-distributed artifact, and
route ambient-state limits to exact Q14 outside-coverage disclosure. Do not
start another snapshot, attestation, matcher-engine, launcher, or Fable detour.
