# Rejected-options ledger: design-gate citation grounding

**Thread:** `design-gate-citation-grounding-2026-08-23`  
**Created:** 2026-08-25  
**Status:** living document; update in place  
**Baseline for comparison:** round 35 combined confidence 79

This ledger records whole mechanisms that regress confidence or are otherwise
shown unsound. It complements the subordinate per-item ledger and does not
replace the formal design gate.

## Rejected-options ledger

### 1. Round-36 total-result packet with partial helper projection and incomplete reset disclosure

- **What was tried:** Round 36 retained the accepted authenticated four-leg
  fixed-lease predicate, added exact malformed and authenticated-absence
  outcomes, showed a defensive count guard, supplied corrected mapping/command/
  smoke/remedy/residual/fixture text, and explicitly accepted same-instance
  older-byte replay and local-wall-clock skew. It attempted packet
  self-containment with focused validator/authentication excerpts.
- **Round:**
  `.kstack/reviews/design-gate-citation-grounding-2026-08-23-round36/` at
  design digest
  `79c9a3644e53559bc13d611b44dc41746238bf305c7c5093e41ecd832d0961b5`.
- **Confidence effect:** Codex 68 and Opus 70 produced combined confidence 68,
  eleven points below round 35's 79 high-water mark and below the 72 floor.
- **Why rejected:** The packet reintroduced the defect class it aimed to
  remove: the corrected mapping specified the historical two-token
  `STATE_NOT_QUALIFIED SMOKE_ATTEMPTS_EXHAUSTED` result while the objective,
  runtime throw, result table, and validation plan specified bare
  `SMOKE_ATTEMPTS_EXHAUSTED`. Both reviewers independently treated that as the
  decisive contradiction. The packet also omitted `validTimestamp`, the policy
  object, full non-exhausting successor logic, and ordinary formatter while
  claiming packet completeness. Its replay residual understated cheaper reset
  paths through deletion, authentication-invalidating tamper, and the
  malformed-state reset procedure; it left fingerprint primitive-string
  equality, higher-generation replacement, and transient future-time recovery
  unspecified. The gate was `BLOCKED` with three security findings and failed
  threat-model and verification checks.
- **Alternative:** Do not edit or extend the round-36 packet. A future
  owner-authorized isolated attempt must restart from round 35's independently
  accepted core and construct a fresh packet with one bare exhaustion code in
  every section; inline the exact policy object, `validTimestamp`, complete
  load-bearing smoke validator, full successor branches, and ordinary malformed
  formatter/route; bind fingerprints as validated primitive lowercase-hex
  strings before `===`; specify generation-1 replacement after authenticated
  absence; and choose one explicit transient-future-time recovery contract.
  Its residual must name all same-boundary lease-clearing paths: valid older-byte
  replay, deletion, MAC/binding-invalidating tamper, and authorized malformed
  reset. That alternative is a future comparison candidate only, carries no
  round-36 confidence, and requires a new independently reviewed design digest.

### 2. Round-37 total-contract packet with incomplete outer state machine

- **What was tried:** Round 37 restarted from round 35, selected the bare
  `SMOKE_ATTEMPTS_EXHAUSTED` code everywhere, defined the malformed result and
  deterministic authenticated absence, inlined the requested helpers, policy,
  smoke validator, predicate, successor, formatter, replacement text, and all
  four reset paths, added fingerprint types, and disclosed wall-clock recovery.
- **Round:**
  `.kstack/reviews/design-gate-citation-grounding-2026-08-23-round37/` at
  design digest
  `322403db104170c73086d24e87c622a4f657736f71d81d712aea81ca539bdd01`.
- **Confidence effect:** Codex 72 and Opus 73 produced combined confidence 72,
  seven points below round 35's 79 high-water mark and eight below the real 80
  target. The gate was `BLOCKED` with four security findings, one genuine
  material dissent, and failed threat-model and verification checks.
- **Why rejected:** The exhaustion result representation and complete four-path
  reset acceptance were consistent, but the packet again claimed totality while
  omitting load-bearing adjacent transitions. `Number(now)` admitted coercible
  values despite a closed Date/number contract. Saturating generation code
  contradicted “plus one” prose at `Number.MAX_SAFE_INTEGER`. The outer v2
  schema, pass/fail completion write, run-limit disjointness, and current
  formatter-producer evidence were absent. The proposed global admin catch
  silently removed details for non-smoke commands. The shallow-frozen
  authenticated wrapper left its nested record mutable. A killed third
  `not_run` start can cause a valid 14-day refusal, and count/ordinal equality is
  writer-conventional rather than schema-enforced. Non-state invalid inputs also
  shared `STATE_MALFORMED` without a usable operator remedy.
- **Alternative:** Do not edit or extend the round-37 packet. Any future
  owner-authorized attempt must again start from round 35 and use a fresh digest.
  It must inline the closed outer v2 schema and canonical parse order, including
  safe-integer generation and shadow/mutation timestamp shapes; define one
  saturating-generation helper and use it in code, tables, and fixtures; accept
  only a valid Date or primitive finite number without coercion; inline the
  complete locked start and pass/fail completion publications, including pass
  count reset to zero; preserve the shared admin catch and prove smoke errors
  have no detail; define `STATE_RUN_LIMIT_REACHED` as the disjoint
  `advisoryRunsSinceGo` limit; prove no ordinary producer supplies the removed
  exhaustion detail; deep-freeze or clone the authenticated projection; enforce
  count/ordinal equality; add exact remedies for non-state invalid inputs; and
  explicitly accept or repair the crashed-third-attempt refusal. It must retain
  the single bare exhaustion code and all four reset classes. This alternative
  is unreviewed, carries no round-37 confidence, and is not a continuation of the
  rejected packet.

### 3. Round-38 cumulative specification with incomplete outer failure contract

- **What was tried:** One cumulative authoritative spec was inlined byte-for-
  byte. It retained round 35's core, defined the stored schema/parser,
  non-coercing input admission, saturation, clone-on-projection, successful
  locked writes, bare smoke codes, run-limit disjointness, crash refusal, and
  non-pass count/ordinal equality.
- **Round:** `.kstack/reviews/design-gate-citation-grounding-2026-08-23-round38/`
  at digest `daec012d0192f52d69fac0ec9194bf266c4d04a515596c637bbb24f88fad8711`.
- **Confidence effect:** Codex 61 and Opus 77 produce combined 61, eighteen
  points below round 35's 79, eleven below the floor, and nineteen below 80.
- **Why rejected:** Finite numeric time lacked writable-Date-range/fraction
  rules. Start omitted fresh field construction and existing-mutation behavior.
  Completion omitted provider, reread, re-authentication, supersession, invalid-
  summary, clock, lock, and post-rename durability results. The packet omitted
  key custody, exact HMAC roles, fingerprint/fixture construction, CSPRNG
  mutation IDs, and ordinary qualification. Its four-path taxonomy excluded
  other authenticated predicate-false replays, forward skew, and key rotation.
  Both reviewers rejected claimed self-containment.
- **Alternative:** Do not revise this digest. A future owner-authorized new
  digest must retain only independently sound mechanisms and add: TimeClip-range
  integer milliseconds; key custody/rotation and exact HMAC transcript;
  fingerprint/fixture/binding construction; CSPRNG mutation IDs and collision
  scope; fresh-versus-preserved successor fields; existing-mutation refusal;
  complete ordinary qualification; exact smoke outputs for lock/platform/
  provider/supersession/re-authentication/summary/clock/I/O failures; atomic
  write outcomes before and after rename plus temporary cleanup; and a
  generalized clearing taxonomy for every authenticated predicate-false replay,
  absence/reset, clock skew, and key rotation. This carries no round-38
  confidence and does not authorize round 39.

### 4. Round-39 single-item TimeClip-range packet with an unspecified adversarial scope boundary

- **What was tried:** Round 39 broke from rounds 36-38 by selecting exactly one
  item — TimeClip-range integer-millisecond validation for
  `canonicalExhaustionPredicate`'s `now` input — and defined it completely: the
  exact `TIMECLIP_RANGE_MS = 8640000000000000` admissible range, five ordered
  rejection cases (Invalid Date, non-number type, NaN/Infinity, non-integer,
  out-of-range), one shared `STATE_MALFORMED` code for all of them, and an
  explicit two-column in-scope/deferred table naming the other nine
  rejected-options-entry-3 alternatives as out of scope. Neither reviewer
  assigned this round's outcome to any deferred item.
- **Round:**
  `.kstack/reviews/design-gate-citation-grounding-2026-08-23-round39/` at
  design digest
  `601991cfdd2608e6dcb01d770a859f3246588991409912a86eca7074aa351382`.
- **Confidence effect:** Codex 35 and Opus 84 produced combined confidence 35 —
  the thread's lowest single-reviewer confidence to date, 44 points below
  round 35's 79 high-water mark and 45 below the round-11+ threshold of 80.
- **Why rejected:** Narrowing to one item did not fail on scope ambition this
  time; it surfaced a genuine, previously undetected defect inside the one
  selected item. Codex found the Date-path rule's premise — "a valid `Date`'s
  `getTime()` can only return an in-range integer or NaN" — is false whenever
  `getTime` is overridden on the instance or `Date.prototype`, which bypasses
  every integer/range condition specified for the non-Date path (medium
  security finding). Codex also found the rule's "reject explicit `undefined`"
  requirement is unreachable and self-contradictory given the retained
  `now = new Date()` default parameter, and that the validation plan omits
  fixtures for both gaps. Opus, independently, treated the same Date-path claim
  as correct by construction with "no third case" and did not flag the
  override scenario at all — a direct factual disagreement between the two
  reviewers, resolved in the round-39 synthesis as both being correct under
  different, unstated implicit scopes (native-only Date instances vs. the full
  space `instanceof Date` admits) that the brief never specified. Opus
  separately found the brief's "no currently valid caller is affected"
  compatibility claim unproven (no call-site enumeration was performed) and
  found the required minimum-boundary admission fixture uncomputable as
  specified because it collides with the unchanged forward-skew leg. Gate
  `BLOCKED`; three failed checks (`objectives-complete`, `threat-model-complete`,
  `verification-plan-complete`), three security findings, two material dissent
  entries, and unresolved questions from both reviewers.
- **Alternative:** Do not revise this digest. A future owner-authorized attempt
  at `CG-TIMECLIP-001` alone (still excluding all nine other entry-3 items)
  must additionally: state explicitly whether the Date-path validation must
  defend against an overridden/subclassed `getTime` or may assume native,
  unmodified `Date` instances only, and specify the intrinsic-call form
  (e.g. `Date.prototype.getTime.call(now)`) if the former; either drop the
  explicit-`undefined`-must-reject requirement or remove the default parameter
  and check argument presence explicitly, and pick one consistently; name
  `TIMECLIP_RANGE_MS` as a module-level exported constant outside the frozen
  `CANONICAL_EXHAUSTION_POLICY` object; state the compatibility narrowing
  (numeric strings, `null`, booleans, `valueOf`-bearing objects, cross-realm
  `Date` instances) as an intended, accepted behavior change rather than a
  no-op, or perform a call-site enumeration proving no such caller exists; and
  either drop the minimum-boundary *admission* fixture or state the exact
  persisted-timestamp constraint and `timestamp()` extended-year contract that
  makes it constructible. This carries no round-39 confidence and does not
  authorize round 40. Per the round-39 synthesis, the facilitator should also
  weigh whether the unresolved Codex/Opus factual disagreement on the
  Date-path `getTime` claim warrants Fable arbitration before any further
  attempt at this specific item.

### 5. Round-40 verbatim Fable-directed brand-check rule with a dropped-parameter signature

- **What was tried:** Round 40 was arbitrated by Fable specifically to resolve
  round 39's Codex/Opus disagreement. Fable ruled the overridable-`getTime()`
  bypass in scope and directed a specific replacement: remove `instanceof
  Date` entirely, extract via `Date.prototype.getTime.call(now)` in a
  try/catch (a genuine ECMA-262 §21.4.4.10 brand check), run the unified
  four-check chain on the extracted value with no trusted branch, and make
  `now` a required parameter with no default. Round 40 inlined that exact
  ruling text verbatim into the decision brief, as the facilitator's dispatch
  instructions required ("apply verbatim, do not reinterpret"), alongside the
  unchanged round-35 accepted core and the same in-scope/deferred table from
  round 39.
- **Round:**
  `.kstack/reviews/design-gate-citation-grounding-2026-08-23-round40/` at
  design digest
  `d969321b588c8766e0f3eca8dd5d86d7ce6d3f0f8dc04fe6e6565216e9e3abc4`.
- **Confidence effect:** Codex 24 and Opus 66 produced combined confidence
  24 — a new thread-low, 11 points below round 39's already-worst 35, 55
  points below round 35's 79 high-water mark, and 56 below the round-11+
  threshold of 80.
- **Why rejected:** Not a Codex/Opus disagreement this time — both reviewers
  independently converged on the identical root defect, in the binding Fable
  directive's own text rather than in either reviewer's interpretation of it.
  The directive's inlined normative signature line reads
  `canonicalExhaustionPredicate(state, now)` (arity 2), but the same brief's
  unchanged round-35 accepted core and current-implementation-reality section
  both show the real signature at HEAD,
  `canonicalExhaustionPredicate(authenticatedState, currentFingerprint, now = new Date())`
  (arity 3), and policy leg (1) depends on `currentFingerprint`. Primary
  inspection of `kstack-citation-state.mjs` at HEAD `9ca0b55` confirms arity 3
  is what actually exists. Opus rated this a high-severity security finding
  (`CG40-SIG-ARITY-FAILOPEN`): implemented literally as two parameters,
  `currentFingerprint` is dropped, `record.deploymentFingerprint === undefined`
  is false for every real record, and the exhaustion predicate silently never
  refuses again — a fail-open regression of the security-relevant fingerprint
  leg. Codex reported the same root cause independently
  (`CG-TIMECLIP-001-SIGNATURE`, high). Both reviewers also independently found
  the deterministic validation plan's adversarial-subclass fixture
  self-contradictory: it demands rejection of a `class extends Date {}`
  instance with an overridden `getTime()` returning `1e300`/`NaN`, but the
  normative brand check (`Date.prototype.getTime.call`) correctly reads the
  true `[[DateValue]]` and would admit a genuine subclass instance built with
  a valid underlying time regardless of the override — so the fixture as
  written would fail against a *correct* implementation. Both also asked for
  an independently distinguishable copy of the Fable directive text in the
  packet to verify the claimed byte-for-byte quotation, since the packet is
  reviewer-visible only and neither reviewer can read repository files
  directly. Opus additionally flagged that the "no currently valid caller
  affected" and "fails closed" claims are asserted without a call-site
  inventory or caller-exception-handling evidence in the packet. Gate
  `BLOCKED`; three failed checks (`objectives-complete`,
  `threat-model-complete`, `verification-plan-complete`), four security
  findings (two high, two low), and four material dissent entries, including
  both reviewers explicitly dissenting from the brief's "no unresolved
  questions" claim.
- **Facilitator flag — implementing the binding Fable ruling verbatim also
  failed.** Per this thread's standing round-40 dispatch instructions, this
  outcome is flagged explicitly: round 40 faithfully inlined the binding
  Fable directive without reinterpretation and still regressed to the
  thread's new confidence low. The defect is not a disagreement about the
  fix's substance (both reviewers accept the brand-check mechanism, the
  four-check chain, the cross-realm-Date handling, the required-parameter
  change, and the out-of-scope same-realm-poisoning carve-out as correct) but
  a signature-arity error inside the ruling's own inlined text, most likely
  introduced because the ruling's author (operating with no file-write tool
  per `fable.md`'s own tooling note) wrote shorthand ("state") standing for
  the unchanged non-`now` parameters rather than the literal two-parameter
  signature. This indicates `CG-TIMECLIP-001` itself may need to be dropped
  from this thread's remaining scope and revisited independently — under a
  corrected ruling text and a corrected adversarial fixture — rather than
  continuing to consume this thread's rounds on it.
- **Alternative:** Do not revise this digest, and do not silently "fix" the
  signature line inside the existing Fable ruling text without surfacing the
  correction to the owner first (per Opus's material dissent: the brief's
  no-reinterpretation instruction and the ruling's own erroneous line cannot
  both be honored). A future owner-authorized attempt at `CG-TIMECLIP-001`
  alone must: (1) obtain a corrected ruling — either a new, explicitly
  corrected Fable directive restating the signature as
  `canonicalExhaustionPredicate(authenticatedState, currentFingerprint, now)`
  with `now` required and no default, or an owner-approved named exception
  correcting just that line before inlining; (2) rewrite the adversarial
  fixture to test two distinct cases instead of one contradictory case: a
  plain object with `Object.setPrototypeOf(obj, Date.prototype)` and an
  overridden `getTime` (must throw `STATE_MALFORMED`, no `[[DateValue]]`), and
  a `class extends Date {}` instance constructed from an invalid or
  out-of-range source with an overridden `getTime` returning an in-range
  value (must still throw `STATE_MALFORMED`, because the true slot, not the
  override, is read); (3) include a call-site inventory for
  `canonicalExhaustionPredicate` at HEAD proving no caller relies on the
  removed default or passes a non-primitive-number, non-genuine-Date value;
  and (4) include an independently distinguishable copy of the ruling text in
  the packet so reviewers can verify byte-for-byte fidelity themselves. This
  carries no round-40 confidence and does not authorize round 41.

### 6. Round-41 corrected-signature packet with under-verified completeness packaging

- **What was tried:** Round 41 applied entry 5's exact four-point remediation:
  corrected the ruling's inlined `Signature.` line to the real arity-3 form
  (`authenticatedState, currentFingerprint, now`), explicitly disclosing the
  correction as a transcription fix rather than a reinterpretation; replaced
  round 40's self-contradictory single adversarial fixture with two
  non-contradictory cases (Case A: prototype-spoofed plain object with no
  genuine `[[DateValue]]`; Case B: a genuine `class extends Date {}` instance
  built from an invalid/out-of-range source with an overridden `getTime`
  returning an in-range value); added a call-site inventory for
  `canonicalExhaustionPredicate` and its sole caller
  `nextSmokeCycleCountersV1`, tracing every reachable production and test
  call site; and inlined the ruling text in a separately labeled "Verbatim
  Fable ruling text, corrected transcription only" block distinct from the
  brief's own prose.
- **Round:**
  `.kstack/reviews/design-gate-citation-grounding-2026-08-23-round41/` at
  design digest
  `2c17f36434c0fe6ee1e450ebf93f11160b981ddcea2cde1a6d6dfd44bce5df79`.
- **Confidence effect:** Codex 68 (`revise`) and Opus 87 (`approve`) produced
  combined confidence 68 — a substantial two-round recovery from round 40's
  thread-low 24 (Codex 24→68, Opus 66→87), but 11 points below round 35's 79
  floor and 13 below the round-11+ threshold of 81.
- **Why rejected:** Unlike round 40, neither reviewer challenged the
  corrected rule's substance: both affirmed the arity-3 signature correction
  is faithful to the ruling's intent, both confirmed the brand-check chain
  still closes the round-38/39 defects, and both confirmed round 40's
  `CG40-SIG-ARITY-FAILOPEN` fail-open regression does not recur because
  `currentFingerprint` is retained untouched. The rejection is instead for
  five narrower packet-completeness findings. Codex (four findings, treated
  as blocking): (1) the "Verbatim Fable ruling text, corrected transcription
  only" block's `Signature.` line bundles the corrected call spelling with an
  explanatory clause naming which parameters were restored, so the brief's
  claim of "exactly one edit" is not literally true as drafted, and the
  original ruling block was not reproduced in the packet for byte-for-byte
  comparison; (2) the "Exact result code for every rejection case" table
  states every rejection maps to `STATE_MALFORMED` without locally repeating
  that this only applies once the pre-existing authenticated-record
  short-circuit has already passed; (3) the deterministic validation plan is
  missing a cross-realm-`Date`-acceptance fixture despite that being a listed
  mandatory failure condition; (4) the packet does not carry forward an
  actual passing-test-suite result or a protected-material-scan result, both
  of which the brief's own deterministic-checks section requires. Opus
  (`approve`, 87) independently corroborated only one of these — the
  call-site inventory's grep was restricted to `--include="*.mjs"`, so its
  "no currently valid caller is affected" conclusion is narrower than the
  claim made — and separately flagged a fixture-wording imprecision in Case B
  (`new (class extends Date {})(1e300)` TimeClips to `NaN` at construction, so
  rejection fires at the finiteness leg, not the range leg, as the fixture
  text implied) and an inability to independently byte-compare the verbatim
  block against `fable.md` from the packet alone. Opus treated all of these
  as pre-implementation verification items, not blocking design defects, and
  recorded zero material dissent. Gate `BLOCKED`; two failed checks
  (`objectives-complete`, `verification-plan-complete`; `threat-model-complete`
  and `rollback-defined` passed), one low-severity, explicitly-deferred-scope
  security finding, and two material dissent entries (both from Codex, both
  packet-precision findings, not substantive challenges to the rule).
- **Facilitator flag — a corrected, arity-accurate application of the ruling's
  substance still did not reach the round's floor.** Per this thread's
  standing round-41 dispatch instructions, this is reported explicitly:
  `CG-TIMECLIP-001` may need to be dropped from this thread's active rounds
  and revisited as a fully separate, fresh design pass outside this thread's
  continuation. This report is paired with an explicit qualitative
  distinction from round 40's rejection, for the facilitator's own judgment:
  round 40 failed because both reviewers found a defect *inside the binding
  ruling's own directive text* (a fix that would have been wrong if
  implemented literally); round 41 failed because of packet-packaging and
  evidence-completeness gaps that neither reviewer connects to the
  correctness of the underlying design, and on which the two reviewers
  substantially agree on substance while disagreeing on how strictly the
  packet's own self-imposed completeness bar must be met before design
  sign-off. The confidence trajectory (24→68 combined across one round) is
  large forward progress, not a stall or regression signal, and per the
  project's standing Fable-triggering criteria this round's outcome does not
  by itself indicate a fundamental design conflict warranting arbitration —
  both reviewers converged upward with no relocated finding and no
  significant confidence drop.
- **Alternative:** Do not revise this digest. A future owner-authorized
  attempt at `CG-TIMECLIP-001` alone must, at minimum: (1) restructure the
  "Verbatim Fable ruling text" block so the disclosed correction is stated
  entirely outside the quoted block (e.g., in the surrounding prose only),
  leaving the quoted `Signature.` line as a pure spelling substitution with
  no embedded explanatory clause, and reproduce or otherwise make available
  the original ruling text so a reviewer can perform an actual byte-for-byte
  comparison rather than accepting the correction on stated evidence alone;
  (2) restate the rejection-case-to-result-code table with an explicit local
  qualifier that it applies only once `authenticatedRecord(authenticatedState)`
  has returned a non-null record; (3) add a deterministic fixture proving
  cross-realm `Date` acceptance; (4) actually run the targeted citation test
  suite and an artifact secret scan and carry both results forward in the
  packet rather than only describing them as requirements; (5) re-run the
  call-site search without the `--include="*.mjs"` restriction (all
  extensions, plus a check for dynamic/computed access and any package
  export map or plugin manifest) and fold the result into the inventory; and
  (6) correct Case B's fixture wording to assert only `STATE_MALFORMED`
  without claiming which check leg fires, or use an explicitly
  NaN-constructing source. This carries no round-41 confidence and does not
  authorize round 42.

### 7. Round-42 packaging-fixed packet clears the confidence bar but the gate still blocks on zero-tolerance requirements

- **What was tried:** Round 42 applied entry 6's exact six-point remediation
  in full: (1) restructured the "Verbatim Fable ruling text" block into an
  "Original ruling text, unedited" block (reproducing
  `.kstack/qc/citation-grounding-fable-round39/fable.md`'s directive text
  verbatim) immediately followed by a "Corrected block, applied" section
  containing only the one-line `Signature.` spelling substitution with the
  disclosure moved entirely into surrounding prose; (2) added an explicit
  local qualifier to the rejection-case-to-result-code table stating it
  applies only once `authenticatedRecord(authenticatedState)` has returned a
  non-null record; (3) added a cross-realm-`Date` acceptance fixture,
  precisely constructed via Node's `vm` module, with its predicted behavior
  independently verified by direct execution in this environment before the
  round was dispatched (`vm.runInContext('new Date(1700000000000)', ctx)`
  fails `instanceof Date` but `Date.prototype.getTime.call(...)` correctly
  returns `1700000000000`); (4) actually ran the targeted citation test suite
  (`node --test tests/citation-grounding.test.mjs`; all 14 tests pass at HEAD
  `3da371a`) and an artifact secret scan (clean against every source/test
  file this item names plus prior-round decision documents), carrying both
  real results forward in the packet rather than describing them as future
  obligations; (5) re-ran the `canonicalExhaustionPredicate` call-site search
  with no extension restriction, added an explicit dynamic/computed-access
  check (no quoted or template-literal spelling of the identifier exists
  anywhere in the repository), and checked every `package.json`/plugin
  manifest in the repository (none references this function or its file's
  specific exports) — the widened search reproduced the identical call-site
  set round 41 found under `--include="*.mjs"`; and (6) rewrote Case B to
  construct from an explicitly `NaN`-producing source
  (`new (class extends Date {})(NaN)`) and assert only that `STATE_MALFORMED`
  is thrown, without naming which check leg fires, replacing round 41's
  `1e300`-based fixture whose "rejected at the range leg" claim was
  independently confirmed wrong by direct execution (the `Date` constructor
  applies TimeClip to its argument, so `1e300` actually produces a `NaN` true
  `[[DateValue]]`, tripping the finiteness leg, not the range leg).
- **Round:**
  `.kstack/reviews/design-gate-citation-grounding-2026-08-23-round42/` at
  design digest
  `4e1d9c109e9f49ae29e2008f98ad78d20bd37db06e057b7b30e8d5c36592ed64`.
- **Confidence effect:** Codex 84 (`revise`) and Opus 85 (`approve`) produced
  combined confidence 84 — 5 points above round 35's 79 floor and 3 points
  above the round-11+ threshold of 81. This is the first round since round 35
  to clear both bars. Both reviewers substantively affirmed the design and
  every one of the six packaging fixes: Opus's recommendation confirms all
  six reviewer confirmation points satisfied in full, including that the
  verbatim-block diff is now genuinely a pure one-line substitution, that
  Cases A and B are non-contradictory and Case B's rewrite "correctly
  diagnoses round 41's imprecision," that the cross-realm fixture is
  "precisely constructible and correctly predicted" and is "the single most
  valuable addition this round," and that both the test-suite and
  secret-scan results are "carried forward as actual output ... not as
  future obligations." Codex's own materialDissent array is empty (zero
  material dissent from either reviewer) and its recommendation text states
  the "proposed three-parameter brand-check design" should be "preserved."
- **Why rejected (gate `BLOCKED` despite confidence clearing both bars):**
  Every prior rejection in this ledger (entries 4, 5, 6) was confidence-driven
  or defect-driven. This one is neither: no reviewer disputes the design's
  substance, and combined confidence (84) exceeds even the higher round-11+
  bar (81). The gate still returns `BLOCKED` because KStack's design gate
  requires unanimous `approve` decisions, zero security findings of any
  severity, and zero unresolved questions from either reviewer, in addition
  to the confidence floor and zero failed checks — and this round satisfies
  none of those three additional requirements even at 84/85 confidence.
  Specifically: (a) Codex's decision is `revise`, not `approve`, triggering
  `REVIEW_NOT_APPROVED` on its own regardless of confidence; (b) Codex
  reported two `failedChecks` items, one of which (a genuine self-referential
  wording defect in this brief's own "Round-42 deterministic checks
  additionally require" section — the bullet requiring `instanceof Date`
  "absent from the rule text entirely" is unsatisfiable as literally written,
  because the corrected normative block itself necessarily contains the
  phrase "instanceof Date" when stating that it is not used, e.g. "instanceof
  Date is NOT used anywhere in this rule") fails the `objectives-complete`
  deterministic check; the other (this round's own generated packet
  artifacts had not yet been secret-scanned at the time Codex reviewed the
  packet, since those artifacts cannot exist before the dual-review
  invocation completes) was resolved post-hoc by directly re-running the
  secret scan against the round's own six generated files after the
  invocation finished, which came back clean — the same structural
  resolution round 41 used for its own `artifact-secret-scan` check;
  (c) Opus reported one low-severity security finding,
  `CG42-SIBLING-COERCION-RESIDUAL`, describing residual, already-explicitly-
  deferred risk in `nextSmokeCycleCountersV1`'s own separate `now` coercion
  (unchanged by, and out of scope for, this item) — Opus itself
  characterizes this as "not a defect of this item," but the gate's
  `requireZeroSecurityFindings` policy makes zero severity threshold on this
  requirement, so any security finding of any severity blocks the gate
  regardless of scope framing; and (d) both reviewers recorded narrow,
  purely evidentiary `unresolvedQuestions` (Codex: what the round's own
  artifact-scan result is, now answered above; whether the `instanceof Date`
  check wording will be corrected; Opus: whether `nextSmokeCycleCountersV1`
  has direct test callers that could reach the predicate with an omitted
  `now` argument via the wrapper rather than through the traced production
  chain, whether the bare-identifier call-site grep's `.kstack` exclusion is
  itself evidenced, whether the corrected block has been verified against
  the *external* ruling file rather than only the packet's own internal
  reproduction of it, and how the `-8640000000000000` lower-boundary
  fixture's persisted-time record is constructed) — the gate treats any
  unresolved question from either reviewer as blocking, independent of
  whether the reviewer characterizes it as a blocking defect or a pre-
  implementation verification refinement. Gate `BLOCKED`; one failed check
  (`objectives-complete`; `design-schema-valid`, `threat-model-complete`,
  `rollback-defined`, `verification-plan-complete`, and `artifact-secret-scan`
  all passed), one low-severity security finding, and zero material dissent
  from either reviewer.
- **Facilitator flag — this is qualitatively different from every prior
  rejection of this item.** Rounds 39-41 were rejected for reasons a
  reviewer characterized as blocking (a genuine factual disagreement in
  round 39, a fail-open regression inside the binding ruling's own text in
  round 40, and Codex-treated-as-blocking packet-completeness gaps in
  round 41). Round 42 is rejected by the gate's mechanical, zero-tolerance
  policy thresholds (`REVIEW_NOT_APPROVED`, `SECURITY_FINDINGS`,
  `UNRESOLVED_QUESTIONS`) even though: confidence cleared both the 79 floor
  and the 81 round-11+ target; zero material dissent was recorded by either
  reviewer; Opus explicitly approved; and every substantive finding either
  reviewer raised is either now resolved (the two Codex packaging findings)
  or explicitly self-characterized as residual/deferred/non-blocking-
  verification rather than a defect (Opus's security finding and its four
  unresolved questions). This is the closest this item has come to
  `READY_FOR_USER_APPROVAL` across seven attempts (rounds 36-42). The
  remaining gap to close in a future round, per the two genuinely open
  items: correct the `objectives-complete` deterministic-check wording to
  scope the `instanceof Date` absence requirement to the *implemented* rule
  (matching the brief's own already-correctly-scoped failure-modes bullet)
  rather than "the rule text" generally; and resolve Opus's
  `CG42-SIBLING-COERCION-RESIDUAL` finding's zero-security-findings
  requirement by either (i) obtaining owner sign-off that a residual,
  explicitly out-of-scope, already-deferred low-severity finding does not
  block this item's design sign-off (a policy question, not a design
  defect), or (ii) closing it directly by widening this item's scope to also
  correct `nextSmokeCycleCountersV1`'s own `now` coercion in the same brief
  (which the current scope table explicitly defers to a separate brief, so
  this would itself be a scope change requiring fresh dispatch
  authorization).
- **Alternative:** Do not revise this digest. A future owner-authorized
  attempt at `CG-TIMECLIP-001` should, at minimum: (1) reword the
  `objectives-complete`-mapped deterministic-check bullet to require
  `instanceof Date` (or any other prototype-chain/duck-typed check) be
  absent from the *implemented* admission logic specifically, not from "the
  rule text" as a whole, matching the already-correct failure-modes bullet's
  scoping; (2) obtain an explicit owner or facilitator decision on whether
  `CG42-SIBLING-COERCION-RESIDUAL` (or any future similarly-scoped residual
  finding for an explicitly out-of-scope sibling function) should count
  against this item's zero-security-findings gate requirement, since the
  finding names risk in code this item's own scope table already defers; and
  (3) close Opus's four narrow unresolved questions with direct evidence: a
  `grep -rn "nextSmokeCycleCountersV1"` run with its full result set and the
  wrapper's own declared signature reproduced verbatim; an explicit
  justification (or removal) of the `.kstack`-directory exclusion in the
  bare-identifier call-site grep; an independent verification of the
  packet's "Original ruling text, unedited" block against the *external*
  `.kstack/qc/citation-grounding-fable-round39/fable.md` file (not merely the
  packet's own internal reproduction of it); and a stated construction method
  for the `-8640000000000000` lower-boundary fixture's persisted-time record.
  This carries no round-42 confidence and does not authorize round 43.

### 8. Round-43 closing packet regresses confidence by introducing new packaging defects while closing the round-42 items it targeted

- **What was tried:** Round 43 applied entry 7's exact three-point closing
  remediation: (1) reworded the self-contradictory `objectives-complete`
  bullet to scope the `instanceof Date`-absence requirement to the
  *implemented* admission logic rather than "the rule text" generally,
  matching the brief's own already-correct failure-modes-section phrasing;
  (2) disposed of `CG42-SIBLING-COERCION-RESIDUAL` as an explicitly
  scoped-out, tracked residual (option (a) from the dispatch instructions,
  not a one-line fold-in, because closing `nextSmokeCycleCountersV1`'s own
  `now` coercion properly requires either a new shared helper or accepted
  code duplication plus a decision on whether to also remove *that*
  function's own default — both out of this item's authorized scope), named
  a candidate future item `CG-TIMECLIP-002` in the item ledger, and
  instructed both reviewers not to re-enter that same disclosed observation
  into `securityFindings`; and (3) closed all six of round 42's unresolved
  questions with real, executed evidence: a `nextSmokeCycleCountersV1`
  call-site grep and its own declared signature (confirmed it carries its
  own unchanged `now = new Date()` default, so Opus's hypothesized
  two-argument-call bypass does not arise); a re-run of the bare-identifier
  grep with no `.kstack` exclusion (zero code matches, only prose); a
  byte-for-byte `diff`/matching-SHA-256 comparison of the packet's reproduced
  ruling text against the actual external `fable.md` file (zero differences,
  identical hash `0267f04b6e2894baf7c7625ee5bd8d7e94298f62fe4ff17df20f1a100cea855e`);
  and a precise, corrected construction method for the lower-TimeClip-boundary
  fixture, established by direct execution to require reframing (not
  dropping) round 42's original plan, because the state module's own
  `TIMESTAMP` regex (`^\d{4}-\d{2}-\d{2}T...$`, four-digit year, no `0000-`
  prefix) makes the earliest structurally valid `smoke.startedAt` value
  (`0001-01-01T00:00:00.000Z`, `-62135596800000` ms) unconditionally greater
  than the true TimeClip lower bound (`-8640000000000000`), so the
  pre-existing forward-skew leg deterministically fires before the range
  check can be isolated through any record-based integration fixture at that
  exact boundary — verified directly (`node -e` confirming the isolated
  four-leg check-chain expression admits `-8640000000000000` and rejects
  `-8640000000000001`).
- **Round:**
  `.kstack/reviews/design-gate-citation-grounding-2026-08-23-round43/` at
  design digest
  `91abd476100a3bda9ba5fb9742382c9547f91416d3fe438526c45190fa417e95`.
- **Confidence effect:** Codex 84→76 (`revise`), Opus 85→85 (`approve`),
  combined 76 — a **regression** below both the gate's own round-11+
  hard minimum (80) and this thread's own internal 79 floor, the first
  confidence drop since round 41→42's recovery. Opus's confidence held
  steady and its decision remained `approve` with zero `failedChecks`,
  zero `securityFindings` (per the reviewer instruction, it recorded its
  sharper variant of the already-disclosed sibling-residual observation in
  prose only), and zero `unresolvedQuestions` — Opus confirmed the substance
  is unchanged from round 42 and re-verified no regression via independent
  adjacent-input-class testing (Proxy-wrapped Date, boxed `Number`, `BigInt`,
  overridden `valueOf`/`Symbol.toPrimitive`, `-0`), all correctly handled.
  The regression is entirely attributable to Codex, and entirely to this
  round's own new drafting, not to round 42's carried-forward substance:
  Codex found five `failedChecks`, three of which are genuine, newly
  introduced packaging defects rather than restatements of round 42's
  already-closed items: (a) the reworded `objectives-complete` bullet's new
  "no stale or duplicated restatement" clause is in literal tension with the
  same packet's deliberate retention of the full superseded arity-2
  "Original ruling text, unedited" block for comparison purposes — a defect
  Opus independently corroborated as a non-blocking editorial note, proposing
  the identical fix Codex implies; (b) the widened `nextSmokeCycleCountersV1`
  call-site inventory's shown command output omitted the `.kstack` prose
  matches the surrounding text says the same unrestricted grep found,
  substituting paraphrase for pasted evidence; and (c) the "Closing question
  O3" byte-for-byte verification diffed the external `fable.md` against
  round 42's decision-brief.md, not against round 43's own copy of the same
  block, so the packet's claim that *this round's* reproduction is verified
  is not established by the comparison actually shown (the two blocks are in
  fact identical, since round 43's copy was taken verbatim from round 42's
  already-verified one, but the evidence as displayed targets the wrong
  round's artifact). Codex's remaining two `failedChecks` are the
  structurally unavoidable round-43-artifacts-not-yet-scanned timing gap
  (resolved post-hoc in this round's own `checks.json`, the same pattern
  round 41 and round 42 used) and a fair but inherent pre-implementation
  limitation on the lower-boundary fixture (a standalone check-chain
  expression cannot itself prove a not-yet-written implementation uses it
  correctly — true of any design-only round's code excerpts, and the
  deterministic validation plan already defers the actual fixture-writing to
  implementation time). Gate `BLOCKED`: `REVIEW_NOT_APPROVED`,
  `CONFIDENCE_BELOW_THRESHOLD` (76 < 80), `REVIEW_FAILED_CHECKS`,
  `UNRESOLVED_QUESTIONS`, and two failed deterministic checks
  (`objectives-complete`, `verification-plan-complete`;
  `design-schema-valid`, `threat-model-complete`, `rollback-defined`, and
  `artifact-secret-scan` all passed). Zero security findings, zero material
  dissent.
- **Facilitator flag — this is a genuine confidence regression, not a new
  substantive defect.** Per this thread's standing discipline (a
  round-over-round confidence drop means reject that round's change and do
  not build forward from it), this round is rejected outright rather than
  patched forward within the same dispatch. The underlying `CG-TIMECLIP-001`
  design remains exactly as validated at round 42 (Opus's independent
  re-verification this round found zero regressions in substance); the
  regression is fully contained to this round's own packet-drafting
  precision on three narrow, mechanically fixable points (a wording
  qualifier, a paste-the-full-output completeness gap, and a diff-target
  citation pointing at the wrong round's file), plus a residual-disposition
  and question-closure approach (Closing fix 2, and closing questions O1,
  O2's substance, O4's substance) that both reviewers found sound and did
  not fault.
- **Alternative:** Do not revise this digest. A future owner-authorized
  attempt at `CG-TIMECLIP-001` should start from round 42's packet (not
  round 43's) and apply only the three genuinely still-needed fixes,
  verified against round 42's own reviewer feedback plus this entry's
  findings, one at a time or as a single narrowly-scoped batch given they
  are independent and do not touch the same subsystem: (1) qualify the
  `objectives-complete` bullet's "no stale or duplicated restatement" clause
  to explicitly exempt the explicitly-labeled "Original ruling text,
  unedited" comparison reproduction (both reviewers agree on this fix, only
  its literal wording is missing); (2) paste the complete, unabridged output
  of the unrestricted `nextSmokeCycleCountersV1` bare-identifier grep,
  including its `.kstack` prose matches, rather than describing them; and
  (3) re-run the "Closing question O3" byte-for-byte diff and SHA-256
  comparison directly against *that future round's own* copy of the
  reproduced ruling-text block (not round 42's file), and show the fresh
  command output naming the correct round's file. The residual-finding
  disposition (Closing fix 2) and the O1/O2/O4 substance from this round
  should be carried forward unchanged, since neither reviewer faulted them.
  This carries no round-43 confidence and does not authorize round 44.

### 9. Round-44 repair audits the sibling instead of the changed predicate and overstates the time trust boundary

- **What was tried:** Round 44 resumed from round 42's substantive baseline,
  repaired the comparison-block wording, split the `.kstack` search into
  finite scopes, and correctly diffed its own reproduced Fable block. Digest
  `e72836ae2909da566433747e8348f0cda85ef81211537c7e18ce8aa71d54f186`.
- **Result:** Codex `revise` 74, Opus `revise` 76, combined 74. Gate
  `BLOCKED`; five reviewer failed checks, four security findings, four material
  dissent entries, and unresolved questions. Both reviewers independently
  found the decisive evidence error: the packet audited
  `nextSmokeCycleCountersV1`, not `canonicalExhaustionPredicate`, whose default
  is removed. Opus also found the attacker-controlled-time claim overbroad,
  the default removal an honestly caller-visible break, the lower-bound seam
  unauthorized/ambiguous, actual suite output absent, the applied block
  insufficiently bound, and the arity correction wrongly characterized as a
  mere spelling edit rather than a substantive safety correction supported by
  the review lineage.
- **Preserved evidence:** Neither reviewer rejects the brand-read/check-chain
  mechanism itself. Opus expressly affirms `Date.prototype.getTime.call(now)`
  in try/catch, the unified finite/integer/TimeClip checks, cross-realm Date
  acceptance, five-way `STATE_MALFORMED` mapping, and one-function rollback.
- **Alternative:** Do not implement or revise this digest. The authorized
  round-45 attempt must inventory every `canonicalExhaustionPredicate` caller
  and trace `now` to its source; state that removing the default is a contract
  break while proving no in-repository caller relies on it; narrow the threat
  claim to representation/range validation and disclose admissible false-past
  values; show raw forwarding through the sibling; drop the unauthorized test
  seam and disclose the lower-bound black-box limitation; carry actual test
  output; hash-bind the applied block; and describe arity 3 as a substantive
  correction authorized by the accumulated review/owner lineage, not as a
  separately confirmed Fable typo.

### 10. Round-45 design passes both reviewers and every deterministic check but remains mechanically blocked by one resolved factual question

- **What was tried:** Round 45 digest
  `16741fadff9ee020c346d4def2c50bce093a0cf44772b403d840527367681bd0`
  applied entry 9's full alternative: correct-symbol caller inventory and time
  origin, honest default-removal compatibility statement, narrowed
  representation/range threat boundary, raw sibling forwarding evidence,
  removal of the ambiguous helper seam, actual test output, applied-block
  binding, and honest arity-3 authority.
- **Result:** Codex `approve` 91 and Opus `approve` 88, combined 88. Both record
  `CG-TIMECLIP-001: PASS`; zero failed checks, zero security findings, zero
  material dissent; all six deterministic checks pass. Opus independently
  confirms every round-44 blocker is closed and the applied brand-read/check-
  chain mechanism is sound. The gate is nevertheless `BLOCKED` solely on
  `UNRESOLVED_QUESTIONS` because Opus left one factual question asking whether
  the unchanged forward-skew leg throws for a far-past `now`.
- **Primary resolution:** Source inspection answers yes: the predicate checks
  `persistedTimes.some((value) => timestamp(value) > nowMs)` and throws
  `STATE_MALFORMED` before result/lease evaluation. At the lower TimeClip
  bound, every structurally valid four-digit persisted timestamp is greater.
  This validates the packet's disclosed static-review premise, but synthesis
  cannot erase a non-empty structured reviewer field, so the gate remains
  honestly blocked.
- **Alternative:** Do not implement this blocked digest. No further round is
  authorized here. If the owner later authorizes one, it should preserve round
  45 unchanged and present the exact forward-skew source lines plus the
  four-digit timestamp minimum directly in the review packet so both reviewers
  can return empty unresolved-question arrays; no design mechanism change is
  indicated by round 45's evidence.
