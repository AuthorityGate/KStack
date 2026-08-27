# Rejected-options ledger: live post-deploy health check

**Thread:** `post-deploy-health-check-2026-08-24`  
**Created:** 2026-08-25  
**Status:** living document; update in place  
**Baseline for comparison:** round 11 combined confidence 62

This ledger records whole mechanisms that regress confidence or are otherwise
shown unsound. It complements the subordinate per-item ledger and never
replaces the formal design gate.

## Rejected-options ledger

### 1. Round-12 role environments plus underspecified signed override protocol

- **What was tried:** Round 12 reframed descendant control, loader isolation,
  and executable identity as bounded diagnostic selection/disclosure rather
  than sandbox/attestation claims. It proposed a private six-key environment
  for KStack Node probes, a real-user PATH/home environment for a POSIX Codex
  first hop, explicit frozen-value arguments/private plan propagation, and an
  exact-context two-key Ed25519 single-use `DEGRADED_OVERRIDE`.
- **Round:**
  `.kstack/reviews/post-deploy-health-check-2026-08-24-round12/`, design digest
  `d7f1b2ef6e2904c686f0fe18b1d44cbfdc92ef358a17dcfd94f0e4fa16fbebb8`.
- **Confidence effect:** Codex 42 and Opus 64 produced combined confidence 42,
  twenty points below round 11's 62. The option must not be built forward from.
- **Why rejected:** The disclosure direction is sound, but the brief kept a
  phase-wide no-network/provider claim while admitting that Codex internals and
  descendants are unsupervised. Its Codex PATH changes meaning for empty or
  relative components under the forced coordinator CWD, while its synthetic
  HOME/XDG values may make KStack probes observe a context unlike the actual
  user install. Frozen-value propagation is explicit only after `frozenNode`
  exists; setup's selection source is absent, and launch deadlines are called
  optional despite load-bearing bounded capture/timeout results. The override
  direction binds exact failure subjects to a full rerun, but does not define
  canonical serialization, byte-exact domain-separated transcripts, registry
  location/enrollment/custody, record target derivation, or an atomic durable
  audit-publication sequence. Cleanup and descendant-held-pipe liveness also
  lack owners.
- **Concrete alternative:** Keep the objective-level reframing but separate the
  mechanisms. Scope no-network/provider/memory language to direct
  KStack-authored edges and add public
  `codexObservationSideEffectsBounded:false`. For Codex, accept only an
  absolute-component PATH (reject empty/relative elements) or return the exact
  lower-tier unavailable code; name its closed JSON argv. For each KStack
  observation, use captured real HOME/XDG only when installed code resolves
  through them and private fixture paths only for explicit absolute fixture
  operands. Select Node in setup by one named rule—POSIX `command -v node`,
  absolute-file validation, then canonicalization—and make output byte caps,
  pipe-side deadline/closure, kill behavior, and setup-owned plan cleanup core
  fields. Isolate HC3 in its own future round: inline one canonical JSON
  algorithm and literal request/approval/revocation transcript framing; choose
  one fixed registry/enrollment/key-custody boundary; derive the use path from
  installation ID plus request digest; publish a complete record via private
  temp create, write, mode/identity recheck, file sync, atomic no-replace
  rename/link, and parent-directory sync before exit zero; retain the use intent
  through crashes and test revocation/use under one lock. Do not restore a
  sandbox, byte-attestation, or unsigned override claim absent a new objective.

### 2. Round-13 narrowed remediation (environment fidelity, Node selection, bounded capture) minus HC3

- **What was tried:** Round 13 applied round 12's own concrete alternative,
  narrowed to exclude HC3. It scoped the phase-wide no-network/provider/memory
  claim to KStack-authored edges and added
  `codexObservationSideEffectsBounded:false`; validated Codex PATH to
  absolute-only components with named `CODEX_JSON_UNAVAILABLE` degradation
  and a closed argv shape; introduced a two-probe HOME/XDG context-dependence
  classification for KStack-owned Node probes; named a three-step
  `command -v node` / absolute-file-validate / canonicalize Node-selection
  rule with no fallback; and made output byte caps, launch deadline,
  kill-and-close pipe liveness, and setup-owned plan cleanup mandatory core
  launch-abstraction fields.
- **Round:**
  `.kstack/reviews/post-deploy-health-check-2026-08-24-round13/`, design digest
  `d10c7130518985287e2bbf77bf89e6e5e87347c471f4fd59b9a4037658eb776c`.
- **Confidence effect:** Codex 48 and Opus 68 produced combined confidence 48,
  14 points below round 11's 62 and below the standing reject floor of 62. The
  option must not be built forward from.
- **Why rejected:** The descendant/network-scope disclosure item (R13-A) is
  sound and both reviewers passed it; the regression is entirely in the
  environment-fidelity item (R13-B) and the Node-selection/bounded-capture item
  (R13-C). R13-B's context-dependence rule is defined closed over `HOME`/
  `XDG_*` only, yet the same brief forwards `CODEX_HOME` into the Codex
  environment as tree-relocating while denying it to the context-dependent
  Codex/marketplace registration-view probe (Opus) — a live false-success/
  false-failure channel on the exact probe the objective cares about most, not
  merely a wording gap — and the rule has no admissible path to classify a
  probe keyed on any variable outside the `HOME`/`XDG_*` families. Separately,
  captured environment values have no named outcome when empty, relative, or
  non-absolute (Codex). R13-C's mandatory bounded-capture core fields carry no
  concrete `timeoutMs` values anywhere, and the setup-to-coordinator "required
  core shape" block omits the five capture fields the same item declares
  mandatory for every launch (Opus) — two normative shapes for one call
  disagree. The claimed "unconditional"/"guaranteed" plan cleanup is
  implemented only as a `finally` path, which cannot run after SIGKILL or
  default-disposition SIGTERM/SIGINT/SIGHUP, so the guarantee does not follow
  from the selected mechanism (both reviewers, independently). Opus separately
  found that killing a deadlined coordinator does not terminate the
  coordinator's own first-hop children (KStack probes, the frozen Codex CLI
  process), which can outlive the installer.
- **Concrete alternative:** Keep R13-A unchanged (validated by both
  reviewers). For R13-B, restate the context-dependence predicate as a
  per-probe enumerated variable set rather than a closed `HOME`/`XDG_*`
  family: name the Reflexion lookup as reading `HOME` plus applicable `XDG_*`,
  and name the Codex/marketplace registration-view lookup as reading `HOME`
  plus applicable `XDG_*` plus `CODEX_HOME`, each forwarded into the
  probe's real-context environment only when setup actually observed it set
  and absolute, never synthesized; extend the validation fixture to relocate
  the registration-view probe's target tree via `CODEX_HOME` and assert the
  probe observes the relocated tree, not the `$HOME` default. Name an exact
  degraded/rejected outcome for every captured `HOME`/`TMPDIR`/`XDG_*`/
  `CODEX_HOME`/`PATH` value that is set but empty, relative, or non-absolute,
  including the `PATH`-entirely-unset case, rather than leaving any of them
  silently permissive. For R13-C, name concrete numeric `timeoutMs` ceilings
  for every launch kind including an explicit setup-side ceiling on the
  coordinator launch (not merely "the coordinator's own ceiling bounds the
  sum of its children"), and restate the setup-to-coordinator launch call
  with the complete mandatory core field set so only one normative shape
  exists. Replace "unconditional"/"guaranteed" plan-cleanup language with
  either best-effort signal handlers (SIGINT/SIGTERM/SIGHUP) installed
  alongside the `finally` path plus an honest disclosure of the residual
  SIGKILL/unhandled-signal case, or drop the absolute wording entirely and
  disclose signal-termination residue as an accepted limitation. Name an
  explicit owner and mechanism (e.g., a coordinator process group that setup
  signals as a group on deadline) for terminating the coordinator's own
  first-hop children when setup kills a deadlined coordinator. Specify the
  private plan directory's creation semantics (an `mkdtemp`-style 0700
  setup-owned directory) and scope or identity-check the exit-path unlink.
  Do not restore a single shared fixture environment, a silent PATH
  fallthrough, an optional/extension-only capture schema, or a sandbox/
  attestation claim absent a new objective. HC3 remains isolated to its own
  future round exactly as round 13 deferred it.

### 3. Round-14 per-probe classification, concrete ceilings, and signal-aware cleanup (HC3 still excluded)

- **What was tried:** Round 14 applied round 13's own rejected-options
  alternative (entry 2) in full: replaced the closed `HOME`/`XDG_*` predicate
  with per-probe enumerated resolution-variable sets (adding `CODEX_HOME` to
  the Codex/marketplace registration-view probe's set); added a three-state
  (absent/valid/degenerate) captured-value classification naming an exact
  outcome for every degenerate `HOME`/`TMPDIR`/`XDG_*`/`CODEX_HOME`/`PATH`
  value including `PATH`-entirely-unset; named concrete `timeoutMs` ceilings
  for every launch kind (5000/20000/90000ms) inside one ten-field normative
  launch schema instantiated identically three times; replaced round 13's
  "unconditional"/"guaranteed" plan-cleanup wording with best-effort
  `SIGINT`/`SIGTERM`/`SIGHUP` handlers alongside the `finally` path plus an
  honest `SIGKILL`-residual disclosure; named setup as the owner of a
  coordinator process-group `SIGKILL` (`detached:true`) for first-hop-child
  termination on the coordinator's own deadline; and specified an `mkdtemp`
  0700 plan directory with a device/inode identity-checked exit-path unlink.
- **Round:**
  `.kstack/reviews/post-deploy-health-check-2026-08-24-round14/`, design
  digest `f80ae6cd308281882158f9aa0bbb43a59cd928e21d4d55c279453b80dd013af6`.
- **Confidence effect:** Codex 41 and Opus 55 produced combined confidence 41,
  21 points below round 11's 62, below the standing reject floor of 62, and 7
  points below round 13's own already-rejected 48 — a further regression, not
  merely a failure to clear the floor. The option must not be built forward
  from.
- **Why rejected:** R14-A (carried forward unchanged from round 13) remains
  sound and unchallenged by both reviewers. The regression is entirely in
  R14-B and R14-C, and unlike round 13's completeness gaps in an otherwise
  sound narrower claim, round 14's defects are newly introduced structural
  contradictions inside its own repair mechanisms. R14-B's three-state rule
  makes "absent" categorically safe and "degenerate" categorically unsafe for
  the identical underlying property — the installed code's own unspecified
  fallback resolution when a variable it needs is not supplied — which both
  reviewers independently identify as reopening the exact false-success
  channel the degenerate branch exists to close (Opus:
  `SEC-R14B-ABSENT-VARIABLE-SILENT-FALLBACK`,
  `SEC-R14B-ECODEX-MANDATORY-HOME-ABSENT-UNNAMED`, both medium; Codex: same
  gap independently). The Reflexion probe's resolution-variable set was left
  qualified ("each only if applicable to that lookup's own resolution order")
  rather than actually enumerated, reproducing round 13's own named defect (a
  classification with no admissible, named determination) on the probe round
  13 did not touch (both reviewers). Opus separately found no stated carrier
  for `E_node_real` to reach the coordinator, which the brief itself launches
  under `E_node_isolated`. In R14-C, the `detached:true` process group needed
  for the new group-`SIGKILL` mechanism was omitted from the "complete"
  ten-field launch schema (Codex, medium) and, more materially, removes the
  coordinator's process group from terminal signal delivery — so the same
  round's new best-effort `SIGINT`/`SIGTERM`/`SIGHUP` handlers unlink the plan
  and exit without ever signaling the group, orphaning a live coordinator, its
  probe children, and a running Codex process on ordinary operator
  cancellation, a failure mode that did not exist in round 13's non-detached
  design (Opus, `SEC-R14C-ORPHANED-COORDINATOR-GROUP-ON-SETUP-SIGNAL`,
  medium; independent material dissent). A coordinator killed at its own new
  90000ms ceiling, or truncated at the byte cap, has no named code, `D`/`E`/`X`
  membership, or exit code (Opus, `SEC-R14C-COORDINATOR-DEADLINE-OUTCOME-UNNAMED`,
  medium). The `lstat`-then-path-`unlink` sequence does not deliver the
  claimed TOCTOU resistance (Codex, material dissent), and the `rmdir` gate
  contradicts the brief's own validation item 9 for the case where the
  coordinator, not setup, performs the unlink (Opus).
- **Concrete alternative:** Keep R14-A unchanged (validated by both
  reviewers across two consecutive rounds). For R14-B: unify the absent and
  degenerate branches for every variable in a context-dependent probe's own
  resolution-variable set and for `E_codex`'s mandatory `HOME` — an absent
  value must join the same fail-closed outcome as a degenerate one
  (`ENV_CONTEXT_DEGENERATE`/`X`/`FAILED`/1 for probes,
  `CODEX_JSON_UNAVAILABLE`/`D`/`DEGRADED` for `E_codex`), or the brief must
  give a specific, named reason the installed code's fallback is trustworthy
  when a variable is missing but not when it is malformed; reserve the
  "absent is a silent no-op" treatment only for variables genuinely outside
  every probe's resolution-variable set (e.g. `TMPDIR`). Fully enumerate the
  Reflexion probe's resolution-variable set with no "only if applicable"
  qualifier — name the exact fixed member list, the same discipline already
  applied to the registration-view probe. Name a concrete, validated
  propagation channel (e.g. an explicit plan-schema field carrying the
  captured real values, or their pre-validated equivalents) by which the
  coordinator — which itself runs under `E_node_isolated` — constructs
  `E_node_real` for a context-dependent probe. Restate the duplicate/
  differently-cased-name rejection rule directly in whichever item's
  normative text governs it, rather than promising a restatement elsewhere
  that does not appear. For R14-C: either add `detached`/process-group
  creation as an explicit mandatory field of the one normative launch schema
  and route every signal path (deadline/byte-cap **and** `SIGINT`/`SIGTERM`/
  `SIGHUP`) through the same negative-PID group `SIGKILL` before any plan
  unlink or setup exit, or drop the process-group mechanism and disclose
  first-hop-child survival on every termination path as an explicit residual
  in the same honest terms already used for the `SIGKILL`-to-setup plan-file
  residual. Name an explicit code, CLS-3 partition membership, and exit code
  for a coordinator killed at its own deadline or truncated at its byte cap.
  Replace the "TOCTOU-resistant" characterization with an accurate one (a
  best-effort reduction of exposure within the disclosed local trust
  boundary, not elimination of the check-to-use race), or replace path-based
  `unlink` with a genuinely stronger primitive if the property is actually
  required. Make `mkdtemp`-directory removal setup's own unconditional
  best-effort responsibility regardless of which process removed the plan
  file, so it is not gated on "successful unlink by either mechanism" in a
  way that contradicts the validation fixture for the coordinator-unlinks-first
  case. Do not restore a single shared fixture environment, a silent PATH
  fallthrough, an optional/extension-only capture schema, a sandbox/
  attestation claim absent a new objective, or an unqualified TOCTOU-
  resistance claim. HC3 remains isolated to its own future round exactly as
  rounds 12 and 13 deferred it.
- **Structural-approach flag (three consecutive rejections on the same
  mechanism):** Rounds 12, 13, and 14 have now all attempted the same
  environment-construction-plus-launch-abstraction mechanism and all three
  were rejected (combined confidence 42, 48, 41 — round 14 is a regression
  below round 13, not an improvement toward the 62 floor or the 81 target).
  Round 13's own narrowly-scoped repair of round 12's findings introduced new,
  differently-shaped findings in the same two sub-areas (environment fidelity,
  launch/cleanup ownership) rather than converging, and round 14's repair of
  round 13's findings repeated this pattern once more, including reproducing
  one of round 13's own named defect classes (an unenumerated classification)
  on a part of the design round 13 had not touched. This recurring pattern —
  each narrowed fix closing its named gaps while its own new mechanism opens
  an adjacent one in the same two sub-areas — is itself evidence that
  R14-B/R14-C's underlying decomposition (a growing set of independently
  specified special-case branches: per-probe variable sets, a three-state
  captured-value rule, a process-group launch mode, best-effort signal
  handlers, an identity-checked unlink) may have exceeded what one narrowed
  round can safely co-specify without missing an interaction between two of
  its own new mechanisms. Per the owner's standing instruction, this is
  flagged for an explicit decision before a round 15 is attempted: whether to
  continue narrowing (splitting R14-B and R14-C's remaining defects into
  smaller, single-mechanism rounds under the one-change-per-round discipline,
  e.g. one round solely for the absent/degenerate unification, a separate
  round solely for signal-path first-hop termination) or to request a
  structurally different mechanism for environment classification and/or
  first-hop-child lifecycle ownership rather than continuing to patch the
  current decomposition.

### 4. Round-15 three-role (required/context-determining/advisory) environment-variable classification, R14-C still excluded

- **What was tried:** Round 15 narrowed scope to exactly one item --
  environment-variable classification -- per the owner's explicit split of
  R14-B and R14-C into separate future rounds. It replaced round 14's flat
  absent/valid/degenerate rule with a three-role classification
  (`required`/`context-determining`/`advisory`) tying the safety of an
  absent value to whether the consumer's own resolution logic has a defined
  default-context fallback; fully enumerated four environment-variable
  consumers (Reflexion probe, registration-view probe, context-independent
  structural probes, and `E_codex`) with fixed, unqualified variable sets;
  gave `HOME` an unconditional `required` role for the registration-view
  probe regardless of `CODEX_HOME`'s state, deliberately avoiding an
  unverified precedence claim; added `CODEX_HOME` as a full member of the
  registration-view probe's set (previously denied to it); and added
  `envContext`/`codexEnvContext` private-result fields labeling which named
  context (`default`/`relocated`) a context-determining variable's value
  produced. It carried forward R14-A, the Codex PATH/argv contract, and the
  Node-selection rule unchanged, and left the entire R14-C launch/cleanup/
  signal-handling/first-hop-termination mechanism untouched, exactly as
  round 11 had it.
- **Round:**
  `.kstack/reviews/post-deploy-health-check-2026-08-24-round15/`, design
  digest `33026b72aeaceb4a592ce7f13eae39dd767237c850299a0fed31c2100acd09ec`.
- **Confidence effect:** Codex 43 and Opus 66 produced combined confidence
  43, 19 points below round 11's 62 floor and below this round's own stated
  62 reject threshold. The option must not be built forward from.
- **Why rejected:** Both reviewers independently found the identical
  self-contradiction as their lead finding: `E_codex`'s declared five-member
  variable set includes `LANG`, but the brief's own outcome table assigns
  `LANG` none of the three declared roles, directly falsifying the brief's
  own normative claim that every declared variable receives exactly one
  role (Codex `strongestObjection`; Opus `failedChecks` item 1, found
  independently). Opus separately found "present, valid absolute" -- the
  discriminator for every row of the normative table -- is defined only for
  `PATH`, so a syntactically-absolute but nonexistent or non-directory value
  has no named outcome and would be forwarded and labeled `"relocated"`
  (`SEC-R15B-VALID-ABSOLUTE-UNDEFINED`, medium); that `E_node_real` (the
  actual environment for the two consumers this round specifies) is never
  itself fully enumerated, unlike the other two named environments, leaving
  its own `LANG`/`PATH` state unstated (`SEC-R15B-LANG-UNPINNED-E-NODE-REAL`,
  low, plus a related completeness failedCheck); that `E_codex`'s
  five-member set omits `XDG_CACHE_HOME`/`XDG_STATE_HOME` even though the
  registration-view probe declares both as resolution-variable-set members,
  so the KStack-owned probe and the real third-party Codex process can
  observe and label divergent contexts, contradicting the brief's own
  claimed symmetry (`SEC-R15B-ECODEX-XDG-CACHE-STATE-OMITTED`, medium); and
  that present-empty XDG values hard-fail to `FAILED`/1 even though the
  governing XDG convention treats empty identically to unset, reproducing
  round 14's own named unprincipled-distinction defect class with reversed
  polarity and no disclosed trade-off (`SEC-R15B-XDG-EMPTY-HARD-FAIL`,
  medium, plus material dissent). Opus additionally dissented that assigning
  `context-determining` -- a role defined by a property of a consumer's own
  resolution logic -- to `E_codex`'s `CODEX_HOME`/`XDG_CONFIG_HOME`
  contradicts the carried-forward disclosure that the design makes no claim
  about the invoked Codex process's own behavior. Codex separately found the
  registration-view probe's explicit refusal to assert `CODEX_HOME`/`HOME`
  precedence directly conflicts with validation item 4, which requires a
  valid `CODEX_HOME` to actually select the relocated tree -- necessarily
  asserting some precedence behavior (`SEC-R15B-EFFECTIVE-CONTEXT-MISLABEL`,
  medium, plus material dissent). Both reviewers characterized these as
  closure defects in specific corners of an otherwise sound rule rather than
  a structural rejection of the three-role approach; Opus explicitly credited
  the core move (tying `absent`'s safety to a defined default-context
  fallback existing, and refusing to branch `HOME`'s role on `CODEX_HOME`'s
  state) as correctly closing `SEC-R14B-ECODEX-MANDATORY-HOME-ABSENT-UNNAMED`
  and said it would expect "a narrowly revised R15-B to pass."
- **Concrete alternative:** Keep the three-role classification structure and
  the unconditional single-role-per-variable discipline (both evidenced as
  the right direction by both reviewers). (1) Add an explicit fourth,
  non-role category -- e.g. `synthesized-constant` -- for a variable that is
  never read from the ambient environment at all, and apply it uniformly to
  `E_node_isolated`'s six fixture constants and `E_codex`'s `LANG`, rather
  than leaving `LANG` a declared-but-unclassified member of a "three role"
  set. (2) Define "present, valid absolute" once, explicitly, for every
  non-`PATH` variable -- name whether it is syntax-only (leading `/`),
  syntax plus `stat` existence, syntax plus regular-directory-ness, or
  syntax plus canonicalization -- and name the exact fail-closed outcome for
  a syntactically-absolute value that fails that stricter test (e.g. a
  nonexistent or non-directory absolute path), so the table's discriminator
  actually has one meaning everywhere it is used. (3) Fully enumerate
  `E_node_real` itself the same way `E_node_isolated` and `E_codex` are
  enumerated: name its `LANG` value and its `PATH` presence/absence
  explicitly, so validation item 1 is executable. (4) Reconcile the
  registration-view probe and `E_codex`'s variable sets: either add
  `XDG_CACHE_HOME`/`XDG_STATE_HOME` to `E_codex` under the same roles, or
  name the specific reason the real Codex process is deliberately given a
  narrower environment than the KStack-owned probe models and disclose the
  resulting observation-divergence as an accepted residual rather than an
  implicit contradiction of a claimed symmetry. (5) Redefine the role
  assigned to a third-party consumer's variables (`E_codex`'s `CODEX_HOME`/
  `XDG_CONFIG_HOME`) in terms of what setup supplied rather than what
  context the consumer's own resolution logic is claimed to use -- e.g.
  `supplied`/`not-supplied` with no "observed context" label -- or explicitly
  narrow the carried-forward "no claim about Codex's own behavior"
  disclosure to state the specific claim this round now relies on. (6)
  Decide the present-empty case for `context-determining` XDG variables
  deliberately and state it as a named decision either way: treat
  present-empty as equivalent to absent (matching the governing XDG
  convention's own definition of that equivalence), or keep fail-closed and
  explicitly disclose the resulting false-failure cost as an accepted
  trade-off, the same way the unconditional-`HOME`-required cost is already
  disclosed for the registration-view probe. Do not restore round 14's flat
  absent/valid/degenerate rule, a closed `HOME`/`XDG_*`-only family, a
  state-dependent compound role (branching one variable's role on another
  variable's value), or a claim of cross-consumer symmetry that the
  enumerated sets do not actually deliver. R14-C (launch/cleanup/signal-
  handling/first-hop-termination) and HC3/`SEC-OVERRIDE-EXIT-ZERO` remain
  isolated to their own future rounds exactly as this round deferred them.

### 5. Round-16 R15-B closure attempt: taxonomy self-contradiction and forwarded-value ambiguity

- **What was tried:** Round 16 applied entry 4's six-item alternative in full
  against round 15's text: added a fourth, non-role `synthesized-constant`
  category for `LANG` (applied to both `E_codex` and, for consistency,
  `E_node_isolated`'s six fixture literals); defined one
  syntax/existence/directory-ness/canonicalization "present, valid absolute"
  predicate for every non-`PATH` variable, adding an explicitly named
  "present, syntactically absolute but invalid" table column; fully
  enumerated `E_node_real` (pinning its `LANG` to `"C"` and stating `PATH`
  is deliberately, totally absent because no probe under `E_node_real` or
  `E_node_isolated` spawns a subprocess); added `XDG_CACHE_HOME`/
  `XDG_STATE_HOME` to `E_codex` under the same treatment as
  `XDG_CONFIG_HOME`, closing the probe/`E_codex` symmetry gap; replaced
  `context-determining` with a new role, `optionally-supplied`, for
  `E_codex`'s four non-`required`/non-`PATH`/non-`LANG` members, grounded in
  what setup captured rather than a claim about the third-party Codex CLI's
  own resolution logic, and separately stated the registration-view probe's
  own `CODEX_HOME`-first precedence explicitly (a claim about KStack's own
  probe code, not about the third-party process); and adopted the XDG Base
  Directory Specification's own empty-equals-unset text for
  `XDG_`-prefixed variables specifically, so present-empty is treated as
  absent for those three variables only.
- **Round:**
  `.kstack/reviews/post-deploy-health-check-2026-08-24-round16/`, design
  digest `acba6ab7949cdf538a83f42c2e84573ce199350e3c21083422521e704b25c05f`.
- **Confidence effect:** Codex 32 and Opus 44 produced combined confidence
  32, 30 points below round 11's 62 floor and below this round's own stated
  62 reject threshold -- a further regression from round 15's already-
  rejected 43. The option must not be built forward from.
- **Why rejected:** Both reviewers independently found the identical
  self-contradiction as their lead finding, reproducing the exact defect
  *class* that got round 15 rejected one level up, at the taxonomy
  definition itself rather than at a single variable's row: Fix 1 states
  every declared variable is assigned "exactly one of four classifications...
  the three roles above remain the complete set of roles governing
  ambient-dependent behavior," but Fix 5 introduces a fourth ambient-
  dependent role, `optionally-supplied`, and assigns it to four declared
  `E_codex` variables -- five total classifications, not the stated four
  (Codex `strongestObjection`; Opus failed check 1 and `strongestObjection`,
  found independently). Both reviewers separately, independently found Fix 2
  specifies two mutually exclusive contents for the same environment member:
  its own test 4 says canonicalization "produces the actual
  forwarded/relocated value," while the same fix's normative table says
  every valid-absolute value is "forwarded verbatim" -- a symlink-containing
  captured value's canonical string differs from its verbatim string, so the
  brief names no single answer to what a probe or `E_codex` member actually
  receives (Codex failed check 2 and `SEC-R16-CANONICAL-FORWARDING-
  AMBIGUOUS`, medium; Opus failed check 2 and `SEC-R16-FORWARD-CANONICAL-
  UNDEFINED`, medium, additionally noting this re-opens the exact
  post-validation symlink-redirection window canonicalization was added to
  close). Both reviewers also independently found Fix 5's
  `supplied-degenerate` state is defined as covering "every non-empty"
  value -- which textually includes present-valid-absolute, contradicting
  the same fix's classification of present-valid-absolute as `"supplied"`
  (Codex failed check 3; Opus failed check 4, plus `SEC-R16-SUPPLIED-
  DEGENERATE-UNRECORDED`, low, noting the named state has no home in the
  `codexEnvSupplied` result object). Opus separately found a provenance
  accounting error carried in from round 15 (not newly introduced by round
  16's own six fixes): the brief attributes `ENV_CONTEXT_DEGENERATE` to
  "round 14," but the brief's own carry-forward rule excludes all round-14
  text except three named items that do not include it -- `ENV_CONTEXT_
  DEGENERATE` was actually introduced in round 14's text and reused,
  un-flagged, by round 15 outside that round's own "carried forward
  unchanged" section, then inherited silently by round 16. Codex separately
  found validation items 2-3 are not executable against consumer 3
  (`E_node_isolated`) because Fix 1 states synthesized constants have no
  ambient absent/empty states for those items' required fixtures to exercise.
  Both reviewers characterized four of the six fixes (full `E_node_real`
  enumeration, the `E_codex`/probe symmetry addition, the
  `optionally-supplied` grounding move and explicit registration-view
  precedence statement, and the XDG empty-equals-unset adoption) as closing
  their named gaps cleanly, crediting this round's *direction* on those four
  while failing the round on Fix 1's and Fix 2's own internal
  contradictions -- the FAIL is not a structural rejection of R15-B's
  three-role approach, which neither reviewer reopened.
- **Concrete alternative:** Keep every one of round 16's four
  reviewer-credited fixes (E_node_real enumeration, E_codex/probe symmetry,
  the third-party role rename and registration-view precedence statement,
  and the XDG empty-equals-unset adoption) unchanged. Repair only Fix 1 and
  Fix 2's self-contradictions, plus the two smaller Fix 5 gaps, in the next
  round: (1) State the taxonomy as five total classifications explicitly --
  four ambient-dependent roles (`required`, `context-determining`,
  `optionally-supplied`, `advisory`) plus one non-role category
  (`synthesized-constant`) -- and delete the false parenthetical asserting
  three roles are the complete set. (2) Name a single forwarded value for
  every valid-absolute variable and say so explicitly in both test 4 and the
  normative table: given canonicalization's own stated purpose (closing
  symlink-loop and TOCTOU races), forward the canonicalized string, not the
  verbatim captured string, for every `required`, `context-determining`, and
  `optionally-supplied` variable's valid-absolute case; update validation
  items 2, 5, 7, and 9 to assert the canonicalized value. (3) Also in the
  same round: name which process performs the new existence/directory-ness/
  canonicalization tests and at what point relative to the frozen final
  inventory and the coordinator's first invocation (Opus,
  `SEC-R16-VALIDATION-ACTOR-UNSPECIFIED`). (4) Fix `supplied-degenerate`'s
  definition to exclude present-valid-absolute explicitly (e.g. "present-
  empty, present-relative, or present-syntactically-absolute-but-invalid,
  outside the Fix-6 XDG exception" rather than "every non-empty"), and
  either give it a third label in `codexEnvSupplied` with its own validation
  fixture or drop the named sub-state and describe only the fail-closed
  outcome. (5) Correct `ENV_CONTEXT_DEGENERATE`'S provenance citation:
  state plainly that it originates in round 14's (rejected) text and was
  carried forward, unflagged, by round 15 and round 16 outside the formal
  "carried forward unchanged" mechanism -- either add it as a fourth named
  carried-forward item with its own justification for survival across
  rejected rounds, or re-derive/re-justify it fresh in the repairing round's
  own text. (6) Resolve, in text, why `E_codex`'s seven-member set omits
  advisory `TMPDIR` despite Fix 4's own stated symmetry rationale with
  probe 2, and state whether a required-check failure in probes 1-2
  (`ENV_CONTEXT_DEGENERATE`) short-circuits `E_codex` construction, matching
  validation item 6's fixture assumptions to a stated rule. Do not reopen
  the three-role/four-role structure itself, `E_node_real`'s enumeration,
  the `E_codex`/probe symmetry addition, the registration-view precedence
  statement, or the XDG empty-equals-unset adoption -- none of these were
  failed by either reviewer. R14-C (launch/cleanup/signal-handling/
  first-hop-termination) and HC3/`SEC-OVERRIDE-EXIT-ZERO` remain isolated to
  their own future rounds exactly as this round deferred them.

### 6. Round-17 R15-B closure repair: validation-evidence contradiction and canonicalization overclaim

- **What was tried:** Round 17 applied entry 5's six-item alternative in
  full against round 16's text: stated the taxonomy as five total
  classifications (deleting the false "three roles are complete"
  parenthetical); named the canonicalized string as the single forwarded
  value for every `required`/`context-determining`/`optionally-supplied`
  valid-absolute case, and named setup, acting at plan-construction time
  before the coordinator's single invocation, as the sole validation actor;
  corrected `optionally-supplied`'s failure-state prose to exclude
  present-valid-absolute and dropped the named `supplied-degenerate`
  sub-state entirely (on the grounds that `codexEnvSupplied` is emitted only
  on successful construction, so no third label has a case to describe);
  formally adopted `ENV_CONTEXT_DEGENERATE` as a fourth carried-forward item
  with its round-14 origin stated explicitly; and added advisory `TMPDIR` to
  `E_codex` (an eighth member) under the same treatment as both probes' own
  advisory `TMPDIR`, plus an explicit statement that no consumer's
  required-check failure short-circuits another consumer's construction or
  attempt.
- **Round:**
  `.kstack/reviews/post-deploy-health-check-2026-08-24-round17/`, design
  digest `18e84385c6071cd345b9fb3275f859db0b21a81c4cd300cf75afbb24c95c52ce`.
- **Confidence effect:** Codex 38 and Opus 70 produced combined confidence
  38, 24 points below round 11's 62 floor and below this round's own stated
  62 reject threshold -- an improvement over round 16's 32 (the first
  round-over-round improvement in the R15-B series) but still well short of
  the floor. The option must not be built forward from.
- **Why rejected:** Opus explicitly credited three of this round's four
  repairs as sound and correctly closing their gaps -- the five-classification
  taxonomy statement, the `optionally-supplied`/`codexEnvSupplied`
  atomic-construction argument (called "the stronger answer"), the
  `ENV_CONTEXT_DEGENERATE` provenance correction, and the `E_codex` `TMPDIR`
  addition with its eight-member enumeration -- and neither reviewer reopened
  round 16's four already-credited fixes or the retained taxonomy structure.
  The FAIL concentrates on repair 2 (the canonicalized-forwarding repair) in
  two independent ways. First, both reviewers found the round's own
  validation-evidence section reproduces the identical normative-versus-test
  contradiction class this round exists to repair, relocated one section
  further: validation item 2's generalizing clause requires every `required`
  variable's present-valid-absolute case to be asserted as forwarded
  canonicalized, while repair 2's own text excludes `E_codex.PATH` (declared
  `required`) from canonicalization in three separate places, so an
  implementer following item 2 literally would assert the opposite of the
  normative table (Opus failedChecks item 1 and `strongestObjection`: "a
  round that repairs a normative-versus-test contradiction must not ship a
  new one in its own test prose"); Opus separately found validation item 10's
  "every declared variable per consumer" scope cannot be satisfied for
  `synthesized-constant` members, which have no ambient state to test.
  Second, both reviewers independently found repair 2's own security
  justification overstated what canonicalization actually delivers: Codex
  (`SEC-R17-CANONICALIZATION-TOCTOU-OVERCLAIM`, medium) and Opus
  (`SEC-R17-CANON-WINDOW-OVERCLAIM`, medium, plus material dissent) both
  found that "closes" a post-validation symlink-redirection/TOCTOU window
  when the design's own unmodified assurance object still declares
  `freezeToExecutionIdentityVerified:false` -- Opus explicitly did not
  dispute the underlying choice (canonicalize, not verbatim), only the
  overclaimed justification for it. Codex separately, and more
  substantively than Opus (which filed only a low finding on the same
  point), found repair 4's `TMPDIR` addition to `E_codex` contradicts the
  brief's own advisory-invariant claim that no advisory state ever affects a
  consumer's outcome, because `TMPDIR` is forwarded into a third-party,
  unsupervised process whose own exit/output behavior is not something this
  design observes or controls (`SEC-R17-TMPDIR-ADVISORY-INVARIANT`, medium,
  Codex `strongestObjection` and material dissent) -- a genuine
  cross-reviewer severity disagreement on the same underlying fact, not the
  same finding described twice.
- **Concrete alternative:** Keep every one of this round's three
  reviewer-credited repairs unchanged (the five-classification taxonomy
  statement, the `optionally-supplied`/`codexEnvSupplied` atomic-construction
  correction, and the `ENV_CONTEXT_DEGENERATE` provenance correction), and
  keep repair 4's `TMPDIR` addition and eight-member `E_codex` enumeration,
  narrowing only its stated invariant per the reconciliation below. Repair
  only repair 2's own contradictions and overclaim, confined to the
  validation-evidence section and to claim calibration, with **no change to
  any normative rule** (Opus's own framing: "narrow and mechanical, not
  structural"): (1) Replace validation item 2's generalizing clause with one
  that names the `PATH` carve-out explicitly -- every non-`PATH` `required`,
  `context-determining`, and `optionally-supplied` variable's
  present-valid-absolute case is forwarded canonicalized; `E_codex.PATH`'s
  valid case is forwarded verbatim per Carried-forward-2; `advisory`
  `TMPDIR` is forwarded verbatim. (2) Scope validation item 10 to the four
  ambient-dependent roles only and state explicitly that `synthesized-
  constant` members receive no existence/directory-ness/canonicalization
  test. (3) Downgrade repair 2's security framing and the matching
  failure-modes bullet from "closes" to "narrows, does not close" the
  post-validation redirection/TOCTOU window, matching the unmodified
  `freezeToExecutionIdentityVerified:false` disclosure, and rest the
  canonicalize-over-verbatim choice on cross-consumer byte-identity
  (validation item 7) alone, which both reviewers already accept as
  sufficient justification on its own. (4) State in one clause whether
  canonicalization runs for `advisory` members at all and, if a canonical
  failure occurs on one, that the outcome is the advisory row's "omitted, no
  effect," not a fail-closed code. (5) Reconcile repair 2's plan-construction
  carrier statement with the exclusions section's "concrete carrier remains
  unnamed" language in one sentence, so a later round does not treat this as
  a new contradiction. (6) Align the `E_node_isolated` count language ("six
  fixture literals" versus "five fixed fixture constants... plus `LANG=C`")
  to the same phrasing throughout. (7) Resolve Codex's substantive TMPDIR
  objection by narrowing the advisory invariant's own wording to what it
  actually claims -- "no advisory-variable state ever causes a consumer's
  own environment construction to fail" -- and explicitly state that this
  narrower claim does not extend to, and makes no claim about, the invoked
  third-party Codex process's own downstream behavior, consistent with and
  cross-referencing Carried-forward-1's existing no-claim-about-Codex's-own-
  behavior disclosure boundary; do not omit or re-synthesize `TMPDIR` for
  `E_codex`, since Opus separately credited the addition itself as correct
  and this reconciliation resolves Codex's objection without reversing it.
  Do not reopen repairs 1, 3, or 4's own content, the retained
  three-role/four-role/five-classification structure, or any of round 16's
  four credited fixes -- none of these were failed by either reviewer this
  round. R14-C (launch/cleanup/signal-handling/first-hop-termination) and
  HC3/`SEC-OVERRIDE-EXIT-ZERO` remain isolated to their own future rounds
  exactly as this round deferred them.
- **Structural-simplification flag (fifth consecutive rejection in the
  environment-construction/-classification sub-area; third consecutive
  rejection of R15-B's own text):** Rounds 13 through 17 have now all been
  rejected while concentrated in this same sub-area (combined confidence 48,
  41, 43, 32, 38), and R15-B specifically (rounds 15, 16, 17) has now failed
  three consecutive times on the identical defect *class*: a normative
  statement contradicted elsewhere in the same document, each time relocated
  into a section the prior round's repair had not touched (round 15: `LANG`
  declared but assigned no role; round 16: Fix 1's role-count claim
  falsified by its own Fix 5, and Fix 2's test-4 clause contradicting its own
  normative table; round 17: validation item 2 and item 10 contradicting
  repair 2's own normative carve-outs). The evidence this round cuts both
  ways on whether a fundamentally simpler classification model is needed
  rather than continued narrowing of the current one. Against
  simplification: Opus's confidence rose from 44 to 70 (this round's own
  combined confidence, 38, is also the first round-over-round improvement in
  the R15-B series, up from round 16's 32); three of four repairs were
  credited outright; and Opus itself expects the narrow, mechanical fix
  above to pass. For simplification: the binding reviewer (Codex) has not
  exceeded 43 across any of rounds 15-17, round 17's 38 remains below round
  15's own already-rejected 43, and the recurring defect pattern -- a
  self-consistency error surfacing in a new location every time the
  previous one is patched -- is itself evidence that this design's current
  shape (a role/state table cross-referenced against a growing,
  independently-numbered list of validation fixtures) may be too
  cross-referenced to draft self-consistently in one pass, the same
  category of concern rejected-options entry 3 raised for R14-B/R14-C at a
  larger scale. Per the owner's standing instruction, this is flagged for an
  explicit decision before a round 18 is attempted: whether to continue with
  one more round narrowly confined to the validation-evidence section and
  claim-calibration wording above (no normative-rule changes), or to treat a
  second consecutive appearance of this defect class in a repair round's own
  validation prose as sufficient grounds to collapse the classification
  model to something with fewer independently-restated cross-references
  (e.g., deriving every validation item mechanically from the per-consumer
  tables rather than restating each variable's forwarding rule by hand in
  both places).

### 7. Round-18 canonical environment policy: correct structure with incomplete boundary semantics

- **Round:** 18; design digest
  `cb90d0189af14262f53c1a5db251cbc991a99cfe60927430111cce4bb363704a`;
  Codex 68, Opus 74, combined 68; gate `BLOCKED`.
- **Why rejected:** Both reviewers returned `revise`. They independently found
  the host-platform boundary undefined, fixture-root creation and negative
  testing underspecified, and a test oracle that can calculate expectations
  with the same faulty interpreter under test. Opus additionally found the
  `empty` and validator-invalid states overlap with different observable XDG
  outcomes, generated definition prose is not bound to interpreter semantics,
  degraded-result consumption is unspecified, and `C.UTF-8` is not portable
  across the unstated host set. Opus reported two low security findings; four
  material dissents and unresolved questions remain across the reviewers.
  Whole-design launch/process lifecycle, cleanup, HC3, and verification are
  also explicitly deferred.
- **What is retained:** The structural choice is not rejected. One canonical
  data policy interpreted generically, with tests and documentation derived
  from it, remains the preferred direction. Opus called it the right choice
  and a clear advance over rounds 1–17; neither reviewer recommended the
  handwritten fallback. Calibrated CODEX_HOME and canonicalization non-claims
  also remain retained.
- **Concrete alternative requiring owner authorization:** If the owner opens
  a future round, keep the selected architecture and make only these boundary
  decisions: (1) declare POSIX-only support or encode delimiter, absoluteness,
  executable, locale, and environment-key rules per platform as one unit;
  (2) encode state precedence once as absent, then empty, then validator-
  invalid, then valid; (3) define deterministic fixture subpaths, modes,
  collision/creation/canonicalization diagnostics, and an injectable fixture
  provider for negative cases; (4) derive expected test outcomes with a
  separate generic oracle based on policy columns and immutable exported
  action definitions, never runtime interpreter execution; (5) generate the
  reference's state/action definitions from that exported semantic source;
  (6) choose per-case coordinator spawning or a synthetic startup-snapshot
  seam for ambient cases; and (7) define degraded exit/CI consumption,
  variable-identifying unavailable diagnostics, malformed raw JSON handling,
  and the intended portable locale rule. Do not implement or open round 19
  without an explicit owner amendment.

### 8. Round-20 convergence design: core approved, five packaging/portability defects remain

- **Round:** 20; design digest
  `4f287894017e220f1ac7eb4da49086f920c8e04b3758bf57343917a81556a19a`;
  Codex approve/91, Opus revise/74, combined 74; gate `BLOCKED`.
- **Why rejected:** The required Opus reviewer found literal `/usr/bin/env`
  non-symlink admission contradicts the declared Linux scope; optional Codex
  output can potentially consume coordinator caps and turn D into X; policy
  parser grammar is not completely closed; nonblocking HC3 lock contention
  and continuous-hold behavior are unnamed; and environment path values move
  into cross-user-visible argv (`SEC-ARGV-ENV-DISCLOSURE`, low). Codex found
  none of these and approved the whole design, so reviewer disagreement is
  preserved rather than averaged away.
- **Retained:** All load-bearing mechanisms are retained unchanged: canonical
  policy/state/action architecture, independent oracle, plan elimination,
  five-case aggregate, E/D membership, exact installation framing, paired
  revocation authority, append-only registry rollback/equivocation barrier,
  and durable one-use audit publication before exit zero.
- **Concrete alternative if the owner authorizes another round:** (1) admit
  `/usr/bin/env` by canonical regular-X_OK identity while allowing a symlinked
  literal path; (2) never relay Codex stdout/stderr into coordinator output
  and record only bounded fixed diagnostics; (3) define the policy grammar
  fully and separately from KSTACK-CJSON-1; (4) hold one bounded lock from
  registry validation through use publication and give contention/state-I/O
  exact X codes; (5) keep captured path values in a closed environment or
  otherwise remove them from argv; (6) calibrate WSL probe ceilings and `/tmp`
  admission with fixtures/remediation; (7) assert use-ledger namespacing and
  policy-mutation coverage. Do not reopen the retained core.

### 9. Round-21 native bootstrap closure: correct packaging fixes, incomplete portability and timing

- **Round:** 21; design digest
  `63c7373bf7baa899f1cc36d42324cbf718419badcc285c7f8f9d169acf638e88`;
  Codex revise/62, Opus revise/74, combined 62; gate `BLOCKED`.
- **Why rejected:** The 240-second inner budget equaled its outer deadline and
  could not contain an override rerun. The helper required unavailable macOS
  `clearenv`, Node symlink identity was ambiguous, helper digest verification
  was conditional, pipe SIGPIPE/write bounds and process-group creation were
  incomplete, and supported ABI/evidence coverage was not closed.
- **Retained:** Closed policy grammar, no environment values in argv,
  disjoint Codex/private output budgets, exact HC3 state codes and
  installation-namespaced use/revocation paths.
- **Alternative:** Remove equality at every deadline level; either fully
  specify a portable authenticated native supervisor or eliminate it; bind
  executable identity after exec; close signal/group/pipe behavior; and make
  the complete packet independently implementable.

### 10. Round-22 JavaScript empty-environment bootstrap: pipe and entry-trust regression

- **Round:** 22; design digest
  `3d944686d996c5a725994d795b92524693f8e74bc4bb1ce3da4508e8d73ebbd9`;
  Codex block/25, Opus revise/66, combined 25; gate `BLOCKED`.
- **Why rejected:** The 4096-byte atomic-pipe premise is false on macOS and
  too small for common WSL interop PATH. The executing Bash and PATH-derived
  Node were not trusted roots; Bash was assigned Node-like launch behavior;
  child deadline capping could equal the parent; retryable contention sat
  outside the exhaustive result model; and audit/context/installation-ID
  durability was incomplete.
- **Retained:** Conservative 60-second probe budgets, complete override rerun,
  retryable rather than fabricated-health contention intent, fixture fallback,
  and closed policy/output isolation.
- **Alternative:** Use one enumerated manifest-bound native supervisor that
  snapshots allowlisted ambient state internally, clears the environment with
  explicit Linux/macOS routines, creates and supervises the process group,
  and transports no values. Add fixed interpreter and complete Node trust
  predicates, a separate pre-verdict RETRY/75 schema, absolute parent
  deadlines with reserved slack, and exact durable HC3 object/race rules.

### 11. Round-23 native supervisor: unreachable PASS and non-linearized authority

- **Round:** 23; design digest
  `44522b0406e6228b2b6edfe5b3457d6cbffc858ea6a0c425a867476d0fb4394b`;
  Codex block/24, Opus revise/44, combined 24; gate `BLOCKED`.
- **Why rejected:** Exact coordinator env contained only fixture variables,
  so it could not construct the ambient PATH/CODEX_HOME rows needed to run
  Codex and PASS was unreachable. Routine high-water writers bypassed the
  override lock, permitting stale-authority use. Unsigned signing bodies,
  public results, deterministic observations, durable directory creation,
  fixture normalization, identity handoff, permanent snapshot errors,
  READY/setsid behavior, utility variants, and manifest trust claims were
  incomplete.
- **Retained:** Native supervision, conservative budgets, fixed executable
  trust predicates, no environment values in argv/files, RETRY as a
  pre-verdict outcome, exact file-level durability and normalized fixtures.
- **Alternative:** Carry allowlisted ambient values to the coordinator in a
  disjoint internal env namespace removed before probe launch; use a
  single-threaded native proxy/session-child arrangement with exact READY and
  async-safe post-fork behavior; place every high-water writer and use under
  one lock; remove nondeterministic observation time; define unsigned crypto
  frames and closed public objects; durably create every state ancestor; and
  calibrate manifest trust and platform support honestly.

### 12. Round-24 linearized supervisor: core races closed, protocol domains incomplete

- **Round:** 24; design digest
  `84d4aa4f27c23985413811c1b201a6878502a619e95dc80d44eb30360a22c21b`;
  Codex revise/34, Opus revise/52, combined 34; gate `BLOCKED`.
- **Why rejected:** Setup work preceded the supervisor-created deadline;
  deadline and mode had no closed coordinator channel; override arithmetic
  conflicted with the launch formula; pre-coordinator output ownership,
  lock/liveness/filesystem semantics, crypto/result domains, revocation
  authority, macOS durability, environment visibility, manifest keying,
  retention, and crash-safe rollback remained incomplete.
- **Retained:** Reachable Codex construction through an internal namespace;
  proxy/session-child cleanup; one high-water/use lock; deterministic
  observation bytes; unsigned signature bodies; normalized fixtures; and
  durable ancestor creation.
- **Alternative:** Follow the KStack design skill's interaction-risk rule.
  Validate the deadline origin/handoff and arithmetic as one inseparable item
  first; then review the independent result, locking, authority, and
  durability groups separately with per-item outcomes rather than bundling
  them into another whole-design rewrite.

### 13. Round-25 absolute deadline handoff: arithmetic retained, clock boundary rejected

- **Round:** 25; design digest
  `b1d1e5ffc0446c008c568a0d9821dbb71150f6831f68ad72dee27a8c39f7872f`;
  Codex revise/62, Opus revise/66, combined 62; gate `BLOCKED`.
- **Why rejected:** T_coord governed child admission but not every coordinator
  wait/read/HC3/output/cleanup path. The native absolute CLOCK_MONOTONIC value
  had no contractual epoch identity with Node's documented hrtime API;
  setup-to-supervisor mode transport, entry ordering, suspend behavior,
  sequential launches and reserve/clamped-Codex accounting were incomplete.
- **Retained:** Correct ten-versus-twenty sequential child arithmetic,
  supervisor outer margin, strict child cap intent, fixed non-secret handoff
  metadata, and separation from other round-24 subsystems.
- **Alternative:** Complete the same isolated item with a post-exec fixed-size
  relative-budget frame that Node anchors to its own hrtime epoch, continuous
  supervisor boot-time enforcement, closed setup operands, strictly sequential
  children, and T_result/T_coord/T_outer caps applied to every operation.

### 14. Round-26 relative-budget lifecycle: sound core, contradictory reserve and incomplete native boundary

- **Round:** 26; design digest
  `1f8222ee66a2f835e2a579296674e217bc8fecefeb36dfd2c6a0763b0588ca81`;
  invocation `d8dcdfa4-a601-4f68-a216-6c2d046f057b`; Codex revise/20, Opus
  revise/72, combined 20; change from round 25: -42; gate `BLOCKED`.
- **Why rejected:** Both reviewers found that the global `T_result` cap
  prohibits reap, output, flush, and cleanup operations that the timeout path
  requires after `T_result`. The stated 10s reserve also allocates 2s reap plus
  8s result/cleanup while claiming 2s remains, an arithmetic impossibility.
  Both found the unconditional statement that the Node-local deadline remains
  60s inside the continuous native deadline false under suspend or rate
  divergence, although supervisor enforcement still preserves safety. The
  supervisor's kill/wait/close path has no bounded wait or terminal fallback.
  Opus additionally found no minimum usable-budget floor; no explicit
  Windows-native scope; no native supervisor substrate, build, distribution,
  or trust verification; no pre-exec process-group rule or escaped-descendant
  policy; no inherited fixed-fd binding; a Node stat-to-exec path race; and
  approval paths not explicitly backed by content-signature verification.
  These produced two medium and two low security findings. Codex's 20 versus
  Opus's 72 is retained as material reviewer disagreement, not averaged away.
- **Retained:** The post-exec relative-budget architecture removes the
  cross-runtime epoch assumption. The exact 28-byte frame, t0-before-parse
  ordering, 660s/1320s arithmetic, strict sequential child model, and
  unclamped-Codex-D versus clamped-parent-X/equality classification were
  accepted or left unchallenged. Every non-deadline round-24 finding remains
  outside this item.
- **Alternative:** Keep the relative frame but split coordinator behavior into
  ordinary work through `T_result`, direct-child reap through
  `T_result+2s`, result/output/abort-cleanup through `T_result+8s`, and an
  unused final 2s before `T_coord_local`. Use a 76s minimum usable budget with
  distinct `BOOTSTRAP_BUDGET_INSUFFICIENT`; raise and close transport at 5s
  with an anchor ACK; state the 60s relationship only for equal-rate/no-suspend
  operation and make supervisor expiry the sole guarantee under divergence,
  mapping X. Bound post-group-kill wait to 2s with an immediate nonblocking
  fallback. Enumerate the C17 POSIX build targets and manifest-bound
  descriptor execution; declare Windows-native out; establish the process
  group before exec; disclose and fail known escaped descendants; bind the
  frame to fixed inherited fds; execute verified Node/coordinator descriptors;
  and require signed approval content rather than trusting locator paths.
  Provide production-inaccessible deterministic clock/syscall seams. Do not
  change public result, lock/filesystem, HC3 grammar/revocation, durability,
  retention, manifest-key, or rollback domains in this repair.

### 15. Round-27 descriptor execution: deadline closure retained, mutable-byte and target conflict rejected

- **Round:** 27; design digest
  `337eb8cfe09594cedc3ecfc175ed9ee756405c7753d7db1f79642bad467f7ff6`;
  invocation `c6aa91c3-3a97-49a9-95eb-89c8d3b92ec6`; Codex revise/24, Opus
  revise/74, combined 24; change from round 26: +4; gate `BLOCKED`.
- **Why rejected:** Both reviewers found that open/hash/`fexecve` of the same
  owner-writable descriptor closes path replacement but not in-place byte
  mutation between hash and consumption. Codex recorded this as high severity
  and separately retained the high escaped-descendant residual. Opus found the
  required `fexecve` absent on both claimed macOS targets (high), found the
  coordinator's `/dev/fd/5` and musl `fexecve` procfs dependency unstated
  (medium), found the unbounded/uncontained verifier vehicle open (medium), and
  found release/test-seam exclusion asserted rather than mechanically gated
  (low). Both reviewers also found that close-on-exec EOF does not distinguish
  exec success from failed exec plus child exit. Opus additionally kept
  pre-fork bounds, result-channel grammar, signals/waits, admission enforcement,
  and release-manifest authentication open. Six total security findings and
  four total dissents remain; reviewer disagreement (24 versus 74) is preserved.
- **Retained:** Round 27's deadline half is sound. Opus expressly accepts
  `76 = 60+5+1+10`, `10 = 2+6+2`, the derivable
  `T_result/T_reap/T_emit/T_coord_local` boundaries, the equal-rate/no-suspend
  60s proof, and supervisor-authoritative X under divergence. The relative
  28-byte frame, sequential children, and unclamped-D/clamped-X rule remain
  retained. Those are not reopened in round 28.
- **Alternative:** Make one target-set/execution-integrity change. Admit only
  enumerated Linux glibc/musl x86-64/arm64 and capability-positive WSL2 GNU
  targets; make macOS, Windows-native, WSL1, and capability-negative kernels
  deterministic unsupported/X with no pathname fallback. In single-threaded
  setup, copy the expected supervisor, Node, and bundled coordinator bytes into
  separate `memfd_create(MFD_ALLOW_SEALING)` objects before fork; add and verify
  `F_SEAL_WRITE|F_SEAL_GROW|F_SEAL_SHRINK|F_SEAL_SEAL`; hash only the sealed
  objects; prove no prior shared writable mapping or descriptor transfer; and
  consume those exact objects by sealed `fexecve` and fixed coordinator fd 5
  through checked procfs. Require procfs and executable-memfd capability,
  revalidate length/digest/seals after transfer, close all aliases, and use
  explicit E-record plus entered-process ACK protocols so EOF alone is never
  exec success. Test every target/capability, source-mutation interleaving,
  seal bit and prohibited write/mapping, fd/CLOEXEC boundary, actual sealed
  exec/load, and exec failure state. Do not claim owner-writable inode hashing
  is sufficient. Keep pre-fork bounding, result channel, verifier vehicle,
  signal/wait and finalization-I/O mechanisms, admission calibration, escaped
  descendants, Node loader/shared libraries, manifest keying, and unrelated
  round-24 findings open and unmodified.

### 16. Round-28 sealed images: integrity core retained, coordinator main-module vehicle incomplete

- **Round:** 28; design digest
  `0c3e72b2c203dc90f368817f0bfcd966a858aba590d78683b6241113ee3c199c`;
  invocation `3e6dcacb-6414-4322-a778-7ad14d780726`; Codex approve/92, Opus
  revise/62, combined 62; change from round 27: +38; gate `BLOCKED`.
- **Why rejected:** Opus found the final operational load link incomplete.
  Default Node main resolution realpaths `/proc/self/fd/5` to the non-existent
  `/memfd:... (deleted)` display target, so no coordinator/READY is expected
  without `--preserve-symlinks-main` or an equivalent. The extensionless fd
  path's module kind is unspecified, and the already-running coordinator is
  circularly asked to verify and then load the bytes that produced it. Opus
  additionally retained separate gaps for MFD_EXEC/noexec detection, exec
  errno classification, setup single-thread enforcement, fd 5/6 collision
  allocation, WSL2 ARM64 runner availability, ambient Node preload and
  memfd process.execPath (medium), memfd classification, setup trust, and
  memory/pre-fork resource exposure (low). Codex found none of these and
  approved at 92; the 30-point reviewer difference is preserved, not averaged.
- **Retained:** The round is a genuine 38-point advance. Codex approved the
  complete proposition with no failed check, security finding, dissent, or
  question. Opus agrees that copy then four-seal then hash the sealed object is
  sound, source mutation becomes irrelevant, and the narrowed Linux/WSL plus
  deterministic unsupported macOS/Windows target repair is correct. The
  deadline algebra/divergence behavior and E/S/E/C transition grammar also
  remain frozen.
- **Alternative:** Change only the coordinator load vehicle. Immediately
  pre-exec, make the supervisor's fd-5 four-seal/length/digest/EOF and procfs
  alias identity validation the load-bearing proof. Invoke sealed Node fd 6
  with exact argv `kstack-node --preserve-symlinks-main -- /proc/self/fd/5`
  followed by the frozen coordinator operands, so main-module realpath is
  suppressed and application flags cannot become Node options. Emit one
  self-contained CommonJS artifact with a fixed CJS sentinel, builtin-only
  requires, no ESM/external module behavior, and exact main filename/argv
  invariants. Delete the circular "then loads" language; any post-entry
  fd/hash observation is diagnostic only and can only fail closed. Require an
  actual sealed-Node + sealed-fd-5 + READY-C end-to-end fixture on every admitted
  target, with wrong/missing flag ordering and ESM/wrapper/temp fallbacks
  rejected. Keep MFD_EXEC/errno/thread/fd allocation/runner/env/process.execPath/
  setup-trust/pre-fork and every unrelated finding open and unchanged.

### 17. Round-29 coordinator loader: correct vehicle, ineffective launch boundary

- **Round:** 29; design digest
  `95210e713755d57566159c0d18e34fbded74c332f4c510995c54b4e144d723af`;
  invocation `ff6ba27e-81dc-4e74-953f-b53e8833ee4e`; Codex block/97, Opus
  revise/62, combined 62; change from round 28: 0; gate `BLOCKED`.
- **Why rejected:** Both reviewers independently found the effective Node
  boundary open. `NODE_OPTIONS` can inject pre-main code that writes READY C,
  invalidating the claimed option boundary and READY meaning (high from each).
  Four seals bind a file object's bytes but not descriptor number 5; parent-side
  validation followed by unresolved child fd arrangement permits slot
  substitution before Node opens `/proc/self/fd/5` (high from each). Opus also
  found an internal fork-versus-same-process topology conflict, procfs loader
  lookups and hard-coded slot allocation gaps (medium), diagnostic source-path
  grammar (low), READY overclaiming, unpinned Node behavior, and a required
  six-label matrix that cannot run without WSL2 ARM64. Codex likewise blocked
  on absent completed target evidence. Seven security findings and seven total
  dissents remain; Codex's 97 is high certainty in the block decision, not an
  approval score.
- **Retained:** The actual load-vehicle choice is correct: sealed fd 5 as a
  self-contained CommonJS main under exact
  `--preserve-symlinks-main -- /proc/self/fd/5`, supervisor validation as
  load-bearing, and coordinator self-observation as diagnostic only. The
  sealed-image/target correction and deadline algebra/divergence remain frozen.
- **Alternative:** Select one fork-child topology. Create every channel first,
  stage each child-surviving source at collision-free fds >=64, fork with
  signals blocked, and atomically `dup3` into fixed 3–7 slots. Close all staging
  and unrelated endpoints, then in the single-threaded/no-callback child repeat
  fd5/fd6 identity, seals, length, digest, EOF, proc-alias and CLOEXEC checks.
  After the alias closes, forbid every fd-creating/reassigning operation and
  immediately fexecve sealed Node; test a deliberate slot-5/slot-6 swap at each
  boundary. Construct nodeEnvp only from `LANG=C` plus frozen internal KSTACK
  ambient carriers, excluding every other name and specifically all NODE/LD/
  loader/preload inputs; use working NODE_OPTIONS require/import spoof fixtures.
  Call READY C joint inferential evidence, not standalone proof. Pin admitted
  Node version/length/digest and require the complete matrix plus independent
  re-gate for any change. Remove WSL2 ARM64 and any other target lacking both a
  committed runner and pinned image; unsupported targets map X with no fallback.
  Keep MFD_EXEC/errno/setup trust/pre-fork/result/signal-wait and unrelated
  findings open.

### 18. Round-30 launch boundary: collision/env core retained, post-exec continuity overclaimed

- **Round:** 30; design digest
  `d0c259c59e4941a9ddc8ed4110d8b428ebe0fea5bc95564d8b888ef2d2302fb0`;
  invocation `5b05aa74-ee1a-4bbb-9649-b87667d877ed`; Codex revise/34, Opus
  revise/66, combined 34; change from round 29: -28; gate `BLOCKED`.
- **Why rejected:** Both reviewers found that the packet's no-intervening-fd
  claim cannot cross `fexecve`: the dynamic ELF loader and Node startup may
  legitimately open and close descriptors before the coordinator reads fd 5.
  The unqualified interpreter/shared-library and `/etc/ld.so.preload` boundary
  therefore also permits pre-main substitution or READY spoofing relative to
  the stated threat claim (one high and two medium findings across reviewers).
  A failed early `dup3` could write the bootstrap record to an arbitrary
  preexisting fd 7 (medium). Opus additionally found no exact child-final
  validation record/exit, no RLIMIT floor or staging failure result, an
  ambiguous close rule that could close a newly installed target, duplicated
  child validation prose, uncalibrated child hashing, no supervisor-image
  re-gate trigger, contradictory parent/child authority, pending Ubuntu image
  evidence, and no explicit threat model. Release fault-hook reachability,
  READY-writer descendant inheritance, ambient CJS resolution, and
  memfd-noexec availability produced four low findings. Eight total security
  findings and four material dissents are retained.
- **Retained:** The >=64 staging band makes sources and targets structurally
  disjoint; the closed allowlist environment removes ambient Node/loader option
  injection; the final check belongs after placement; the pinned sealed Node
  and fd-5 CommonJS vehicle remain the correct execution direction; WSL2 ARM64
  remains truthfully unsupported without a runner; and READY remains evidence,
  not authentication. Round 27's deadline/divergence algebra stays frozen.
- **Alternative:** Make one assurance-semantics correction. Keep a known
  staging error descriptor until an explicit fd-7-installed flag is true and
  give dup, final-validation, and exec-return failures distinct fixed records,
  exit codes, and X mappings. Require the minimum usable RLIMIT and deterministic
  staging-capacity X; after placement numerically forbid close operations on
  3–7; run exactly one marker-anchored authoritative child pass; and call parent
  validation defense-in-depth only. Limit the production trampoline's no-fd-
  mutation guarantee to final validation through `fexecve`. Treat the dynamic
  loader and Node as permitted to use other fds, qualify root/kernel/interpreter/
  shared-library/loader configuration as an explicit platform TCB or return X,
  and have the coordinator recheck inherited fd 5 before one C/EOF and before
  any descendant. Mark READY as non-exhaustive joint evidence, bind supervisor
  byte/build changes to full re-gating, and mechanically exclude named fault
  hooks from the production image. Keep Ubuntu evidence pending until observed;
  do not claim it passed. Preserve MFD_EXEC, setup/manifest provenance,
  pre-fork/result/timing, and unrelated findings open.

### 19. Round-31 assurance semantics: corrected architecture, incomplete and ptrace-unsafe contract

- **Round:** 31; design digest
  `0de1bc8af5d82d1301b226fb7d50c7b9a4d7c56da1b5f4a81704f222c4107a70`;
  invocation `4c615589-ba13-44c7-993c-0fc53337f451`; Codex block/18, Opus
  revise/62, combined 18; change from round 30: -16; gate `BLOCKED`.
- **Why rejected:** Both reviewers found the exact validation contract
  incomplete. The V table omits fd7 entirely and omits required fd3/fd4
  CLOEXEC checks; its numeric values appear to be execution ordinals even
  though alias operations execute before hashes assigned lower numbers. The
  error grammar omits successful exec's zero bytes plus EOF, while the parent
  never explicitly closes its copies of the READY/error writers or metadata
  reader, so EOF is not derivable. Both reviewers independently found an
  in-scope high-severity same-UID ptrace/process-memory attack that can mutate
  descriptors/code between validation and READY. Opus also found untracked
  non-CLOEXEC fds above 7 inherited by Node (medium), compiler-movable linker
  markers (medium), and an under-enumerated dynamic host TCB omitting hwcaps,
  cache, NSS/gconv/locale and other pre-READY inputs (medium). Ubuntu and both-
  target hash timing evidence remain pending. Six total security findings and
  five material dissents are retained.
- **Retained:** The architecture is not reopened: use the known staging error
  endpoint until fd7 installation; separate D/V/E bootstrap failures; keep one
  authoritative post-placement child pass; numerically protect 3–7; limit the
  no-fd-mutation claim to child-final validation through `fexecve`; recheck
  inherited fd5 in the coordinator; emit one C/EOF before descendants; call
  READY non-exhaustive evidence; and bind supervisor changes/test-hook absence
  to re-gating. Deadline, seals, target set, closed env and CommonJS vehicle stay
  frozen.
- **Alternative:** Issue one complete assurance contract. Assign stable IDs to
  every fd3–7 type/direction/CLOEXEC, fd5/fd6 identity/seal/length/hash/EOF and
  proc-alias operation, separately state one source/pass order, and make every
  V write a fixed record then exit 121. Add the zero-byte EOF/no-bootstrap-code
  exec success cell and require the parent to close its fd3 reader and fd4/fd7
  writers immediately after fork before reads/waits. Require
  `PR_SET_DUMPABLE(0)` plus Yama ptrace_scope 2/3 (or stronger qualified policy),
  reject unqualified hosts X, and negatively test ptrace, process_vm_writev and
  proc-mem across native and post-exec intervals. Close every untracked fd above
  7 with one capability-gated close_range after collision-safe placement.
  Compile the trampoline as a pinned isolated no-LTO/no-inline TU with
  `asm volatile` memory barriers and make every build change re-gate. Narrow the
  platform TCB to an enumerated immutable host-root closure including actual
  hwcaps/cache/config/dlopen inputs, and give NSS/gconv/locale/config categories
  exact included or trace-gated excluded dispositions. Keep Ubuntu/timing
  evidence pending and do not call the design implementation-ready.

### 20. Round-32 total assurance contract: bundled and falsely infers exec from EOF

- **Round:** 32; design digest
  `9fd2617b1b46f769394d93e10c603f234111fa94b8f92295003f89b09cf224a8`;
  invocation `e83342ad-549e-45d0-af90-ac46fd51c129`; Codex revise/5, Opus
  revise/30, combined 5; change from round 31: -13; gate `BLOCKED`.
- **Why rejected:** The central zero-byte error-pipe EOF cell asserts a cause
  the parent cannot observe. Successful exec, premature writer close/loss,
  pre-exec SIGKILL, and a kernel point-of-no-return exec failure can all yield
  zero bytes plus EOF, so freezing `NODE_EXEC_ENTERED` is false even though a
  later READY timeout still prevents a pass. The round also bundled five
  independently attributable areas contrary to the one-change rule. Codex
  found missing fd3/fd4/fd7 identity/distinctness, no reportable fd7-validation
  fallback, an unencoded dumpability mismatch, and an observed-but-unenforced
  TCB closure. Opus found unvalidated fds0–2, an unencoded signal-mask failure,
  incomplete peer pidfd/proc-fd/signal/read coverage, post-exec disclosure,
  MFD_EXEC feasibility, unauthenticated digest provenance, and metadata-write
  blocking. Every named matrix remained pending. Ten security findings and six
  dissents are retained.
- **Observed platform evidence:** Read-only inspection of the current WSL2
  x86-64 runner found kernel `6.18.33.2-microsoft-standard-WSL2`, Yama present
  at `ptrace_scope=1`, and uid map `1000 0 1`; no sysctl or namespace state was
  changed. Frozen R32 requires Yama 2/3 and its initial-namespace predicate, so
  this runner maps `KSTACK_POST_DEPLOY_MEMORY_ISOLATION_UNAVAILABLE`, X. This
  evidence rejects feasibility of the current policy here but does not select
  a replacement.
- **Retained:** Stable non-ordinal V IDs, collision-safe close_range direction,
  immediate parent closure of child-side protocol endpoints, compiler-binding
  direction, and explicit treatment of host-root startup inputs remain useful
  proposals, not validated mechanisms. The sealed architecture, deadline,
  target, environment and CommonJS vehicle remain frozen.
- **Alternative:** Change only nodeExecError EOF classification. Delete
  `NODE_EXEC_ENTERED` and every success inference from zero-byte EOF; record
  only `WRITE_END_RELEASED_UNCONFIRMED` with exec unknown. Combine it with the
  observed child/READY sequence: pre-READY exit, fatal signal or stop maps an
  exact conservative unconfirmed X; a live child continues only within the
  retained bound; timeout maps X; and exact C plus the subsequent declared
  protocol is the sole affirmative coordinator-entry evidence available to
  this classifier. Keep the ordinary fexecve-return E record. Treat
  point-of-no-return failure and SIGKILL as unconfirmed X without inventing an
  errno. Test close/live, exit codes, fatal/stopped states, returned exec,
  point-of-no-return failure, READY stall, valid C/result, malformed result and
  every record/C order. Preserve fd identity/fd0–2/V/fd7, signal mask, runtime
  TCB enforcement, Yama policy, peer surfaces, MFD_EXEC and all other findings
  open and unmodified.

### 21. Round-33 conservative EOF semantics: core accepted, drain precedence incomplete

- **Round:** 33; design digest
  `48dfe053a4cdc012bf9d182935bd52039d2a0effeb75952a1c9e34701b4db4eb`;
  invocation `8e177f7b-6139-45fb-97d5-befe1ac1cf38`; Codex approve/87, Opus
  revise/72, combined 72; change from round 32: +67; gate `BLOCKED`.
- **Why rejected:** The isolated correction is substantively accepted: both
  reviewers endorse deleting every exec-success inference from zero-byte fd7
  EOF and retaining only `WRITE_END_RELEASED_UNCONFIRMED`. Codex passed at 87.
  Opus found the replacement table scheduler-dependent because it allows the
  parent to observe terminal status before draining already-buffered exact C
  and result, causing a healthy fast-exit run to fail with no real ambiguity.
  The WIFSTOPPED row is unreachable without WUNTRACED/WSTOPPED; nodeExecError
  no-EOF cases are absent; new X codes do not explicitly map to aggregate
  FAILED; stopped-child cleanup is unspecified; and audit fields are unbounded.
  READY identity/authentication remains one high and one medium retained
  finding, while peer-stop availability and audit bounds add two low findings.
  Five dissents preserve the distinction between accepting the EOF deletion and
  rejecting the incomplete observation order.
- **Retained:** Zero-byte fd7 EOF means writer release only, with exec unknown
  and no acceptance. Returned fexecve failure retains E; point-of-no-return
  failure and pre-READY fatal termination map conservatively X; no errno is
  invented. Exact C plus the subsequent complete protocol is the only
  affirmative coordinator-entry evidence available to this classifier, still
  conditional on separately open READY identity/authentication.
- **Alternative:** Change only observation ordering. Use one normative ppoll
  loop over nonblocking READY, result, fd7 and pidfd. On any channel or terminal
  hint, drain READY then result then fd7 to terminator/EOF/EAGAIN, parse, and
  consult WEXITED status. When terminal is pending, perform a bounded final
  drain before precedence so buffered complete valid protocol is honored under
  every readiness ordering. Remove WIFSTOPPED/WSTOPPED; stops remain nonterminal
  until the retained deadline kills/reaps. Treat fd7 EOF as optional telemetry:
  valid C/result may complete without it, while no EOF/no protocol reaches
  terminal or deadline X. Map every unconfirmed X to `FAILED`/1; name exact
  group-kill/reap disposition; bound audit fields; and test simultaneous
  pidfd/channel permutations and both no-EOF branches. Preserve READY identity/
  auth and every non-ordering finding open.

### 22. Round-34 deterministic observation order: correct direction, contradictory chunk and cutoff rules

- **Round:** 34; design digest
  `4057467525b3af9441faa93e1daac34fdbc77d47ac612e7df2c877f0c3657c54`;
  invocation `f3f501df-52bb-4e12-8c5d-edf35eee30a2`; Codex revise/12, Opus
  revise/46, combined 12; change from round 33: -60; gate `BLOCKED`.
- **Why rejected:** Both reviewers found that priority 1 makes a normal partial
  read followed by EAGAIN immediately protocol-invalid, directly contradicting
  the loop and fixtures that assemble later chunks. Stopping at the first
  terminator leaves queued duplicate/trailing bytes unread, so read boundaries
  still change the verdict. Syscall/read/parser failures map to two conflicting
  codes, and final-boundary inclusion is unspecified. Opus additionally found
  no sticky EOF or poll-set removal (level-triggered POLLHUP spin), a final drain
  capable of exceeding the absolute deadline, no exact C-only code, no live-child
  priority-3 disposition, unspecified pidfd closes, and wake-driven counter
  overflow. The bounded final drain also widens the decision-bearing window for
  unauthenticated post-death descendant bytes (high attributable delta). Five
  security findings and five dissents are retained.
- **Retained:** The direction is right: drain READY/result/fd7 before WEXITED,
  latch terminal under WNOWAIT, use a bounded final drain, remove WIFSTOPPED,
  treat fd7 EOF as telemetry, map X to FAILED, and reap failures. Round 33's
  `WRITE_END_RELEASED_UNCONFIRMED` semantics remain frozen.
- **Alternative:** Correct only the ordering mechanism. During ordinary loops,
  partial-at-EAGAIN is PENDING and nonterminal; it becomes protocol-invalid only
  at true EOF, the exact terminal cutoff, or absolute deadline. Continue reading
  beyond terminators to EOF/EAGAIN and require READY/result EOF sealing unless an
  independently reviewed bounded terminator rule exists. Make EOF sticky, remove
  and close that fd; latch WEXITED once under WNOWAIT, remove pidfd from polling,
  and close it after the single reap. Define final drain as the minimum of the
  absolute supervisor deadline, checked terminal+2s, and absolute reap boundary,
  with one exact zero-time cutoff drain. Map syscall/control errors only to
  OBSERVATION_FAILED and syntax/size/cap errors only to PROTOCOL_INVALID. Name
  C-only deadline `READY_OBSERVED_PROTOCOL_INCOMPLETE`, FAILED/1. Follow retained
  live-child disposition or default to bounded group kill/reap. Increment audit
  counters only for bounded progress. Record the widened death-to-latch window,
  keep channel authentication open and prerequisite, and forbid unauthenticated
  post-terminal bytes from affirmative decisions. Verify with actual pipe,
  pidfd, ppoll, EAGAIN, terminator/trailing and cutoff-boundary fixtures.

### 23. Round-35 corrected ordering: chunk handling improved, drain remains writer-unbounded

- **Round:** 35; design digest
  `5ccab1239becccf5f5834cca2320f2b47c13e64330dd5d399f6331fcd1680ff1`;
  invocation `b440f431-9bfe-47fe-8509-041f47b6ab76`; Codex revise/28, Opus
  revise/24, combined 24; change from round 34: +12; gate `BLOCKED`.
- **Why rejected:** Both reviewers found that the per-channel drain reads until
  EAGAIN/EOF but checks neither time nor cap inside that loop. A continuously
  nonempty writer can therefore run past supervisor, terminal+2s and reap
  boundaries without returning to their checks (high). At a deadline edge the
  loop drains before precedence, so bytes obtained after the deadline can still
  enter priority 4 (high). Codex also found sequential multi-fd cutoff ambiguity,
  no safe cap+1/EOF probe when the buffer exactly fills, conflicting positive/
  zero read error wording, and an unproved six-transition progress count. Opus
  found terminal precedence misdiagnosis, final drain consuming all reap reserve,
  inherited writers preventing EOF sealing, abnormal death subordinated to a
  result, contradictory pidfd-open fallback, and an unstated producer close
  contract. Undefined channel authentication remains a high overall blocker;
  unauthenticated negative veto, abnormal-death acceptance and reap exhaustion
  add three medium findings. Six findings and five dissents are retained.
- **Retained:** Ordinary partial-at-EAGAIN is PENDING; draining beyond a
  terminator, sticky EOF/pidfd removal, explicit auth gating and real pipe tests
  remain the right direction. Round 33's fd7 EOF semantics and the
  READY→result→fd7-before-terminal order remain frozen proposals.
- **Alternative:** Isolate only one bounded per-channel drain primitive. Before
  and immediately after every nonblocking read, check the applicable absolute
  cutoff. Do not issue a read when pre>=cutoff; if a read crosses/reaches it,
  exclude the whole chunk from affirmative state and return unconfirmed. Permit
  at most C decision bytes, then issue a separate one-byte probe: byte means
  protocol overflow, EOF seals, EAGAIN stays open. Map positive reads and zero
  EOF normally, EAGAIN/EWOULDBLOCK pending, EINTR through a fresh cutoff check,
  and only other negative read results to observation failure. Prove at most C
  positive eligible reads plus one probe and test continuous writers, slow
  cutoff crossing, exact-capacity close/open/extra, every chunk split, equal
  boundary, all syscall returns and memory canaries. Keep cross-channel cutoff,
  final-drain/reap reserve, precedence/authentication, pidfd fallback, producer
  EOF/inherited writers, progress proof and every unrelated finding open.

### 24. Round-36 bounded drain: cutoff direction retained, callable contract incomplete

- **Round:** 36; design digest
  `d789fdac528d116ae1d324e0d13e70bdec74c911b8fd49862bf508ff25d1884b`;
  invocation `42c38263-111d-4fe9-b9bd-23a20297cab9`; Codex revise/82, Opus
  revise/57, combined 57; change from round 35: +33; gate `BLOCKED`.
- **Why rejected:** Both reviewers retain the per-read clock barriers,
  equality-is-late rule, separate one-byte exact-capacity probe, and disjoint
  positive/EOF/retry/error direction. The specified function is not executable
  as a closed primitive. `fixedScratchMax` is missing from its input list and
  has no positive lower bound, so a zero-length read can be misclassified as
  EOF and produce `EOF_SEALED`. A crossing chunk is physically written into
  decision storage before the post-read clock establishes eligibility. Bytes
  consumed and discarded on a late read or observation failure do not set a
  sticky channel gap, so later invocation can splice a suffix onto an earlier
  prefix. `decisionLength` has no in/out return contract; clock history and the
  EAGAIN clock-failure branch are incomplete; repeated EINTR has no finite retry
  cap. Five security findings and five dissents are retained.
- **Retained:** Check the applicable absolute cutoff immediately before and
  after each nonblocking read; treat equality as late; exclude an entire
  crossing chunk from affirmative state; use a separate one-byte probe after C
  decision bytes; keep positive read, true EOF, EAGAIN/EWOULDBLOCK, EINTR, and
  other errors disjoint. Round 33's conservative fd7 EOF meaning and round
  35's drain-before-terminal direction remain proposals, not implementation
  authority.
- **Alternative:** Do not issue another isolated primitive-only round. The
  round-36 synthesis selects one consolidated implementation design grounded
  in the current setup and `kstack-install-health.mjs`. It must either remove
  the multi-phase resumable pipe mechanism entirely or publish a closed
  callable contract with explicit positive scratch bounds, separate staging,
  sticky gap state, finite retries, clock state, returned lengths, channel
  authentication, cross-channel precedence, producer closure, reap reserve,
  and executable fixtures. The consolidation must also disposition every open
  environment, launch, HC3, schema, recovery, output-bound, dependency, and
  concurrency row before it can claim whole-design readiness.

### 25. Round-37 simplified coordinator: architecture retained, execution contract contradictory

- **Round:** 37; design digest
  `2c52720a3b2728dbaeeb02b04eb98dbb391a02cd4e7c7989075d745ebf499181`;
  invocation `e0fd2864-6a1a-4487-ae5c-96ed3256bb03`; Codex revise/32, Opus
  revise/63, combined 32; change from round 36: -25; gate `BLOCKED`.
- **Why rejected:** The design removes the native supervisor but does not
  replace it with an executable bounded protocol. A JavaScript coordinator
  cannot reliably signal the process groups allegedly created behind nested
  GNU `timeout` wrappers, and the stated legal sequential child budgets total
  more than the 118-second phase deadline. The packet also omits the private
  coordinator-to-setup staging and atomic durable HC3 publication needed to
  support exactly one public output, exact result and HC3 schemas, an
  unambiguous treatment of `timeout` exit statuses 124/137, and complete Codex
  command/selection/JSON semantics. HC3 generation and canonicalization, lock
  identity, executable-path and ancestor trust, HC4-HC12 evidence, and
  safe-import enforcement are not closed. Seven security findings and six
  dissents are retained.
- **Retained:** Setup owns the phase, a JavaScript coordinator replaces the
  native supervisor, manual recovery remains the default, the result is
  diagnostic rather than authoritative, and root/surface validation plus a
  closed environment remain the right simplifying direction. Removing memfd,
  pidfd, READY/result pipes, fd7 inference, and the native helper substantially
  reduces the trusted mechanism when the replacement contract is complete.
- **Alternative:** Restore the established item-sized review loop. First isolate
  direct child process-group ownership, signal handling, timeout identity, and
  bounded termination without changing phase budgets or publication. Review
  remaining-budget arithmetic next; then private result/HC3 publication;
  schemas; Codex semantics; lock/path admission; and HC4-HC12/safe-import
  evidence as separate mechanisms. Each brief must state the untouched open
  findings and be judged only on its proposition. Perform a full integration
  review only after the individual mechanisms are stable.
