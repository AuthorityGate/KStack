# KStack token reduction: credential-safe packet slicing and benchmark gate

Status: PROPOSED DESIGN ONLY  
Date: 2026-08-27  
Implementation authority: none granted by this artifact.  
External-review authority: none granted by this artifact.

## 1. Decision

KStack should implement token reduction as three independently measured items:

1. measure and ratchet its eager prompt surface;
2. introduce digest-bound, dependency-closed review packets for bite-size
   rounds with automatic full-artifact fallback; and
3. measure provider-reported token/cache usage and quality over representative
   paired overnight replays before enabling slicing by default.

The planning target is **15-35% lower overnight input tokens**. This is a
hypothesis to test, not a present capability or claim. KStack must not describe
deferred instruction loading as tool-output compaction, raw-token reduction as
billing reduction, or a planning target as a measured result.

Credential safety is an admission invariant, not a benchmark arm. Secret
plaintext, authentication material, recovery material, or values derived from
them never enter a model packet, prompt cache, output capture, log, receipt,
report, benchmark corpus, replay fixture, or external token-counting API. The
encrypted credential repository (ECR) remains design-only and cannot be used as
a credential source by this work.

## 2. Scope and non-goals

In scope: eager KStack instructions; repeatedly transmitted design material;
dependency discovery and verification; full-artifact fallback; usage, cache,
latency, rounds, quality, defect, and fallback metrics; CI ratchets; overnight
automation on non-sensitive tasks; and a hard ECR isolation boundary.

Out of scope: implementing or activating ECR; handling live authentication
material; semantic rewriting of tool/model output; copying gstack code;
claiming 15-35% before a qualifying KStack A/B run; or lowering any confidence,
dissent, security, or deterministic-check gate.

## 3. Observed evidence

### 3.1 KStack snapshot

- `kstack-dual-review.mjs` reads the whole selected prompt, hashes it, embeds it
  in the reviewer prompt, and dispatches it. Advisory citation grounding marks
  the design source as `inclusion: full`.
- `assertOutboundSecretScan` is explicit before advisory joint dispatch, but
  the legacy/off route appears to dispatch `fullPrompt` without an
  unconditional exact-byte pre-spawn scan. Every route therefore needs one
  common admission gate; no route may silently redact and continue.
- Provider output is initially captured in temporary files. Retention can be
  disabled and output sanitized afterward. Post-capture sanitization is defense
  in depth, not outbound admission.
- `kstack-safety-matchers.mjs` exposes `MatcherSetV1-byte-latin1` for common
  key/auth/provider/generic assignment patterns. Pattern matching is useful but
  is not proof arbitrary sensitive material is absent.
- `kstack-panel-core.mjs` refuses an original-output digest for
  `secret-rejected`, overflow, and invalid-UTF-8 dispositions. That is the
  fail-closed precedent for proposed receipts.
- Skill files are already 1,519-10,082 bytes each in this snapshot. The current
  TC05 ECR design is 183,352 bytes, so repeated artifact transmission is the
  likely dominant opportunity.

Evidence digests at inspection time:

| Source | SHA-256 |
|---|---|
| `kstack-dual-review.mjs` | `8500e912decb3121789238cafae1cd5a4ab7dd55a8869a384a2e5440b5f6dc21` |
| `kstack-provider-runner.mjs` | `fdce7011a56d78421f483078229fc85c1009ed2536bca45bb9a9332e1d891a29` |
| `kstack-safety-matchers.mjs` | `29da1da3723ce6242676c83459f675feb546624934bda480c26bc11737832721` |
| `kstack-invoke-role.mjs` | `307bc5a4e15bbcf10499664a942172270eb95e1141a6ede3d394f1fb156483c3` |
| `kstack-panel-core.mjs` | `be54390775bd24771b67c6be5ce250af1632b997e7437373eba6edec2b05e305` |
| `DUAL_REVIEW.md` | `15d71115c05a18fb3039f6e2290cd3a4a62cc599f5c603d35cb0156456e2fb66` |

Implementation must re-inspect current sources and bind to their then-current
digests.

### 3.2 gstack v1.71 primary evidence

The inspected gstack checkout was commit
`394db326f2d3aaccd4804fe846b82aaa7d189dee`. Its v1.71 changelog reports about
51% lower eager input for `/review`, 50% for `/land-and-deploy`, 46% for
`/codex`, 32% for always-loaded `CLAUDE.md`, and 15% over its skill corpus. It
moves repeated preamble behavior to runtime scripts, gates onboarding, carves
late/mutually exclusive sections, tests behavior/section loading, and captures
lower context-budget ceilings.

This is real evidence of gstack eager-instruction reduction, not evidence of
equal total KStack savings. Its token counts are exact only in opt-in provider
counter mode and otherwise estimated from calibrated bytes/content classes. It
is not a published overnight cost/quality benchmark. Its separate
`GCOMPACTION.md` is explicitly `TABLED`; the proposed 15-30% tool-output
reduction is not shipped and must not be credited or imported.

Primary sources:

- <https://github.com/garrytan/gstack/commit/394db326f2d3aaccd4804fe846b82aaa7d189dee>
- <https://github.com/garrytan/gstack/blob/main/CHANGELOG.md>
- <https://github.com/garrytan/gstack/blob/main/lib/context-bill.ts>
- <https://github.com/garrytan/gstack/blob/main/test/context-budget-ratchet.test.ts>
- <https://github.com/garrytan/gstack/blob/main/test/skill-e2e-preamble-script-ab.test.ts>
- <https://github.com/garrytan/gstack/blob/main/test/carve-section-loading.test.ts>
- <https://github.com/garrytan/gstack/blob/main/docs/designs/GCOMPACTION.md>

## 4. Four quantities that remain separate

| Quantity | Valid measurement | Does not prove |
|---|---|---|
| Eager prompt reduction | rendered bytes and input count before tool activity | lower total session use if deferred material later loads |
| Artifact slicing | canonical slice versus full-artifact bytes/tokens | equal completeness or defect detection |
| Tool-output compaction | original versus replaced tool-output tokens | shipped support merely because a design exists |
| Billing reduction | authoritative uncached, cached, output/reasoning usage and cost | savings from bytes alone |

Unavailable fields are recorded as `unavailable`, never imputed as zero or
inferred from another provider.

## 5. Credential-safe data boundary

### 5.1 Forbidden and permitted data

Forbidden in control and treatment paths:

- passwords, passphrases, PINs, API/auth/session tokens, private keys, recovery
  material, or decrypted ECR records;
- real-record ciphertext, nonce, tag, wrapped key, or linkable metadata;
- a digest, MAC, fingerprint, embedding, tokenizer output, length histogram,
  prefix/suffix, entropy sample, or any other value derived from forbidden data;
- a stable provider-visible credential identifier; and
- raw environment, command line, exception, stdout/stderr, crash dump, or
  telemetry that may contain forbidden data.

This applies before hashing. A rejected candidate is never hashed, sent to an
external token counter, cached, or copied to quarantine.

Packets may contain only a random per-invocation alias such as `CREDREF-1` and
closed-catalog non-sensitive metadata: operation class, environment class,
provider class, policy outcome, user-presence requirement, and non-sensitive
error code. The alias has no derivation from credential material, ECR record
identifier, ciphertext, account, or target. Its alias-to-handle map is
memory-only, process-local, absent from provider input/receipts, and dropped at
terminal completion. Review packets cannot request reveal or execution.

### 5.2 Common admission pipeline

Every prompt, dependency, generated packet, cache entry, captured component,
receipt/report field, and benchmark fixture must pass:

1. strict UTF-8 where text is required; malformed input rejects;
2. closed schema plus byte/depth/count limits before interpolation;
3. categorical exclusion of ECR, credential-source, environment-secret, known
   secret-bearing, and unapproved binary sources;
4. deterministic original-byte/text matchers;
5. source-appropriate allowlist parsing and heuristic reject signals;
6. canonical construction only from admitted components;
7. rescan of the exact canonical bytes about to cross the provider boundary;
8. digest computation only after both scans pass;
9. spawn-time verification that every route receives exactly those admitted
   bytes; and
10. scan of complete captured output before allowlisted persistence.

The same gate wraps advisory, legacy/off, fallback/recovery, Codex-only, panel,
role, and any future provider route. There is no route-specific exemption. A
scan failure rejects before any provider spawn; it never silently redacts and
dispatches.

Scanner error, unsupported encoding, truncation before scan completion,
race/drift, missing provenance, or unknown source class returns
`SECRET_SAFETY_UNPROVEN`. A full-artifact fallback also requires admission and
cannot bypass this result. Persistent diagnostics contain only a generic code,
stage, timestamp, and non-sensitive invocation ID—not excerpt, offset, matcher
ID, candidate digest, original size, or secret-dependent detail. Redaction is
defense in depth after rejection, not evidence of safety.

### 5.3 Persistence and prompt-cache policy

Persistent schemas may include only: arm/task IDs, non-sensitive
model/configuration and admitted packet-manifest digests, admitted byte/token
counts, timestamps/durations, separated usage fields, terminal class,
decision/confidence, aggregate defect classes, and closed-catalog fallback
reason. They never retain full packets, raw responses/tool output, environment,
alias maps, or a digest of rejected material.

Benchmark fixtures are synthetic or public, immutable, reviewed as
non-sensitive, and marked `credentialMaterial: false` by admission rather than
caller assertion. Production artifacts, private external tickets, raw model
logs, user data, and ECR directories are excluded from discovery. Aggregates
require at least five observations per cell before distributions are emitted.

Provider caching is permitted only for immutable admitted non-sensitive
fixtures or ordinary packets explicitly selected `cache-eligible`.
Credential-adjacent tasks—even with aliases—are `cache-forbidden`; the runner
must request cache disablement/zero retention where exposed and verify effective
policy. Unknown policy denies external dispatch. Cache keys and metrics derive
only from post-admission non-sensitive bytes/configuration. Results separately
record raw input, cache writes, and cached reads; a cache hit is not prompt
reduction.

## 6. Dependency-closed packet contract

The treatment sends canonical `kstack-review-slice-manifest-v1` plus its
components. The manifest binds:

- schema/canonicalization/framing versions and full-design digest;
- changed item IDs and exact ranges or structured node IDs;
- every dependency's ID, role, inclusion reason, admitted digest, and order;
- objective/locked-owner closure and affected prior invariants;
- deterministic checks/test evidence;
- exclusions with machine-verifiable reasons;
- closure algorithm/configuration digest;
- packet digest and full-fallback eligibility; and
- `credentialMaterial: false` established by admission.

The packet is reconstructible from the immutable full design and manifest. A
reviewer sees that material was omitted and can return
`FULL_ARTIFACT_REQUIRED` without confidence penalty.

Closure includes every reachable objective, owner answer, definition,
invariant, schema, bound, failure mode, test, prior finding, and cross-reference,
plus reverse dependencies whose validity could change. Prose similarity alone
cannot establish closure.

Automatic admitted full-artifact fallback occurs for an unresolved/mutable
reference; an unbounded cycle; builder/verifier disagreement; reviewer request;
confidence regression or new finding; an unevaluable deterministic check;
ambiguous defect attribution; or a slice at least 90% of full tokens. Fallback
is measured and does not carry forward slice approval/confidence.

## 7. Representative paired A/B benchmark

### 7.1 Arms and corpus

- **A/control:** current full admitted artifact and eager instructions.
- **B1/eager:** full artifact with only eager/runtime instruction changes.
- **B2/slice:** current instructions with the dependency-closed packet.
- **B3/combined:** B1 plus B2.

Tool-output compaction is not an arm unless the host ships a supported output
replacement mechanism and a separately approved KStack design exists.

Use randomized crossover order with identical task seed, immutable repository
snapshot, model identity, reasoning setting, tool policy, and deterministic
checks. Unpreserved bindings make the pair invalid, not zero.

Use at least 30 paired task instances, at least five in each class: short
skill-only; medium/local design; large sparse-dependency design; large
dense/cyclic design; QC fix with prior findings; and security-adjacent synthetic
tasks containing only aliases/non-sensitive metadata. Corpus admission and its
immutable manifest must be independently reproducible before paid execution.

### 7.2 Measurements

Record per invocation, when exposed:

- rendered eager and full/slice packet bytes and exact tokenizer/provider count;
- uncached/raw input, cache-write, cached-input/read, output, and reasoning
  tokens separately;
- time to first token, provider duration, and end-to-end duration;
- rounds and provider calls to terminal outcome;
- fallback and its closed-catalog reason;
- decision/confidence, failed checks, security findings, dissent, unresolved
  questions, and deterministic result;
- independently adjudicated true/false defects, severity, and arm misses; and
- actual billed cost only from an authoritative provider/account receipt.

Missing metrics remain `null` with a reason. Estimated tokens name the
tokenizer/model and are never merged with exact provider usage.

### 7.3 Overnight replay and analysis

Run at least three complete overnight windows on different dates. Every window
contains every valid pair, randomizes arm order in bounded blocks, and includes
cold/warm cache strata where controllable. Concurrency is equal and capped;
retries, timeouts, rate limits, and invalid runs remain visible.

Checkpoint only admitted manifests and allowlisted metrics. Restart from
immutable pair IDs; never serialize prompts, provider sessions, environment, or
alias maps. A security stop ends the window before further dispatch and cannot
auto-retry.

Primary endpoint:

`1 - sum(B3 raw_input_tokens) / sum(A raw_input_tokens)`

Report paired median and total-weighted reduction with a two-sided 95% paired
bootstrap confidence interval stratified by task class and overnight window.
Report each class separately so large artifacts cannot hide short-task
regression. Secondary endpoints are cache usage, output/reasoning, latency,
rounds, fallback, and authoritative billed cost. Quality is defect-level paired
adjudication, not confidence alone.

### 7.4 Activation and rollback

B3 may become opt-in only after three qualifying windows where all are true:

- lower 95% bound for total raw-input reduction is at least 15%;
- point estimate is in/above the 15-35% planning band, unless an owner accepts
  lower measured benefit without converting the target into a claim;
- zero treatment-only missed critical/high defects and zero new security or
  credential-safety finding;
- upper 95% bound on treatment-minus-control non-critical defect rate is no
  worse than +2 percentage points;
- deterministic outcomes match except safe full-context fallback;
- median rounds do not increase and p95 increases by at most one;
- fallback is at most 10% point/20% upper bound overall, with no class over 35%;
- p50 end-to-end latency improves at least 10% and p95 worsens at most 5%; and
- every eager and packet-size ceiling is captured in a CI ratchet.

Default-on eligibility requires two additional passing windows. A new
provider/model/configuration needs at least one new full qualifying window.

Separate reversible flags control eager loading and slicing. Automatically use
full instructions/artifacts for new runs after any admission bypass,
secret-dependent persistent field, treatment-only critical/high miss, packet
reconstruction/binding failure, unauthorized ratchet increase, two consecutive
quality/fallback/round/latency breaches, or three windows below 10% savings.
Re-enable only through a new reviewed design digest and fresh benchmark.

## 8. Required deterministic tests

- Bind exact eager bytes per skill and prove deferred sections force-read before
  their dependent step while mutually exclusive sections remain absent.
- Reconstruct each slice byte-for-byte and independently recompute dependency
  closure; mutation of any manifest/source/order/range/exclusion rejects.
- Unresolved, reverse, cyclic, or mutable dependency fixtures force fallback.
- Each matcher and encoded/split/malformed/high-entropy synthetic canary rejects
  before hash, token count, spawn, cache, or persistence on every route.
- Receipt/report/corpus schemas reject unknown or secret-dependent fields.
- Missing usage fields remain unavailable rather than zero.
- Cache-forbidden tasks deny dispatch when policy verification is unavailable.
- Crash/restart persists no packets, aliases, environment, or raw output.
- Quality adjudication remains blind to arm identity.

Ratchets store generated ceilings. Raising one requires explicit baseline
regeneration, a reason, a diff, and review. Ordinary CI may lower a ceiling but
cannot raise it automatically.

## 9. Expected reduction and overnight plausibility

Applying only gstack-style eager trimming to KStack is estimated to reduce
total usage by about 0-5%, likely near 2%, because KStack's skill instructions
are already small relative to large decisions. This is a byte-proportion
estimate, not measurement.

For a roughly 183 KB artifact like current TC05, retaining 40-70% in a valid
dependency-closed packet removes about 30-60% of artifact-only input. With
fixed provider/session overhead, **15-35% lower overnight raw input** is a
credible planning range. It is plausible because avoided artifact bytes recur
on every independent invocation. Dense dependencies, fallback, eventual
loading of all deferred sections, added remediation rounds, provider caching,
or output/reasoning growth can eliminate it. Only the paired benchmark can
convert this range into a KStack claim.

## 10. Bite-size implementation sequence after approval

1. Measurement only: exact render/packet bytes plus nullable provider usage;
   no prompt change.
2. Security admission: closed schemas, path/source exclusions, pre-hash and
   output scans, all-route exact-byte spawn binding, cache policy, negatives.
3. Eager split: tested runtime helpers and only demonstrably late/exclusive
   instruction carves.
4. Slice builder/verifier: canonical manifest, independent closure,
   reconstruction, and fallback behind a disabled feature flag.
5. Corpus: freeze and independently verify synthetic/public non-sensitive data.
6. Overnight A/B: execute arms and publish allowlisted aggregates only.
7. Opt-in trial: activate only if every threshold passes.
8. Default decision: two more passing windows plus explicit owner approval.

A later item cannot repair or waive an earlier failed security predicate.

## 11. Open findings

1. Enumerate provider usage schemas and verifiable cache/retention controls for
   every supported host/model version.
2. Give the independent dependency-closure algorithm and structured source
   grammar their own bounded design.
3. Produce an immutable corpus manifest, license review, and independently
   reproducible non-sensitive admission evidence.
4. Select a billing-receipt authority; until then report tokens/cache/latency,
   not actual cost reduction.
5. ECR is design-only. No integration, handle resolver, or credential execution
   path may be enabled by token-reduction work.

## 12. Self-assessment

Design-readiness self-score: **94/100**.  
Independent reviewer score: **not run**.  
Known design security findings: **zero identified in this artifact**.  
Open implementation/qualification findings: **five, listed above**.

This score covers design readiness, not implementation or measured savings. It
does not mean an ECR exists or is safe for real credentials.
