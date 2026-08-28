# R2c5 normative addendum: three benchmark bug fixes

- Status: PROPOSED DESIGN-ONLY BUG-FIX ADDENDUM
- Date: 2026-08-27
- Amends: `token-reduction-security-benchmark-2026-08-27-r2c4-six-bug-fixes-addendum.md`
- R2c4 SHA-256: `ac5768b8190b9dfc84011507eacaf44fd1788e6dd2c941dc9bf785d0c93686dc`
- Scope: the three independent R2c4 residual findings below only; no redesign
- Authority: no implementation, activation, provider dispatch, external review, commit, or push

R2c1→R2c4 remain normative except where the three exact replacements below
have explicit precedence.

## 1. Severity-indexed defect-bearing populations

R2c4 section 2's unindexed `D_(c,k,w)` is insufficient for a severity claim.
For exact cache configuration `c`, frozen task class `k`, window `w`, and
atomic severity `g` in the closed registry
`G={CRITICAL,HIGH,MEDIUM,LOW}`, define:

`D_(c,k,w,g) = {i in P_(c,k,w) : i contains at least one final sealed real
defect whose canonical severity is g}`.

Each atomic defect receives exactly one canonical severity during the sealed
existence/severity pass. A task may belong to several severity sets when it has
separate defects at several severities. A defect cannot be duplicated across
severities, split into weighted fragments, or moved after arm scoring begins.

The authoritative zero-defect set is:

`Z_(c,k,w,ANY) = {i in P_(c,k,w) : i has no final sealed real defect at any
severity}`.

For coverage reporting only, define the severity-absence set
`Z_(c,k,w,g)=P_(c,k,w)\D_(c,k,w,g)`. It is not a zero-defect quality
population. For example, a task with a MEDIUM defect and no CRITICAL defect is
in `Z_(c,k,w,CRITICAL)` but not `Z_(c,k,w,ANY)`. Only `Z_(...,ANY)` may feed
R2c3's zero-defect `TaskOutcomePass` floor.

The distinct pooled populations are:

- `D_(c,k,pool,g)`: tasks having at least one final sealed severity-`g` real
  defect in any of the three qualification windows; and
- `Z_(c,k,pool,ANY)`: tasks having no final sealed real defect at any severity
  in any of those windows.

Window and pooled ledgers never substitute for one another. Derived bands such
as `CH=CRITICAL∪HIGH` and `ML=MEDIUM∪LOW` are labeled diagnostics. They cannot
cure failure or non-estimability of an atomic severity cell and receive no
claim authority unless a future fully requalified configuration prospectively
adds the band as its own required population.

Pooled membership uses the immutable task-cluster key frozen by R2c2: its three
window replicates map to one task member. Final defects are unioned by sealed
semantic defect identity across those replicates, so neither a repeated task nor
the same repeated defect receives extra pooled weight. A changed task artifact
is a different predeclared cluster member, never a post-hoc identity choice.

### 1.1 Exact sealed membership and weights

Before A/B3 arm mapping is revealed or any detection/resolution outcome is
scored, seal one `SeverityPopulationLedgerV2` that binds:

- configuration, corpus, sampling-frame, exact-cache, class, window-or-pool,
  severity-registry, gold, discovery, semantic-union, and existence/severity
  digests;
- every admitted task digest and immutable `c/k/w` assignment;
- every final sealed real-defect ID, its one canonical severity, and its task;
- each exact `D_(c,k,w,g)`, `Z_(c,k,w,g)`, and `Z_(c,k,w,ANY)` membership bit,
  plus the separately recomputed pooled memberships;
- required/optional status, exact frozen minimum, cardinality, class weight,
  task weight, and inclusion/exclusion reason for every population; and
- independent recomputation bytes proving membership and rational weight sums.

For a within-class severity estimand, every task in `D_(c,k,w,g)` has exact
weight `1/|D_(c,k,w,g)|`. For an across-class severity estimand, prospectively
freeze positive rational `alpha_(k,g)` over the severity-`g` required classes,
with `sum_k alpha_(k,g)=1`; every task in class `k` then has exact weight
`alpha_(k,g)/|D_(c,k,w,g)|`. Pooled severity weights use the identical formula
against `D_(c,k,pool,g)`. A class's defect count, response length, discovery arm,
or realized sample allocation never changes its weight.

Freeze exact positive minima `N_D_min(c,k,w,g)` and, when pooled claims are
configured, `N_D_min(c,k,pool,g)`. Also freeze positive
`N_Z_min(c,k,w,ANY)` and any pooled zero-set minimum. An empty or under-minimum
required set fails its cell and cannot pass vacuously, borrow another severity,
or be pooled away. An optional severity absent from the finite corpus is
`NOT_ESTIMABLE` and receives no severity claim. Membership, minimum, weight,
or severity mutation after sealing invalidates the complete configuration.

### 1.2 Detection and resolution remain separate

For task `i in D_(c,k,w,g)`, let:

- `M_DET(a,i,g)` be the fraction of its final sealed severity-`g` defects the
  arm failed to detect; and
- `M_RES(a,i,g)` be the fraction of those defects the arm failed to resolve
  under the frozen resolution rubric.

Using the exact weights above, compute separate paired risk differences
`RD_DET(c,k,w,g)=E[M_DET(B3)-M_DET(A)]` and
`RD_RES(c,k,w,g)=E[M_RES(B3)-M_RES(A)]`, with separate two-sided-95 bounds,
noninferiority gates, evidence fields, and pass bits. Detection cannot satisfy
resolution, resolution cannot satisfy detection, and neither may be averaged
into a shared gate. Frozen CRITICAL/HIGH zero-miss or absolute floors apply to
both outcomes independently. Pooled counterparts are separately computed and
remain noncurative; each pooled task fraction uses its deduplicated sealed
severity-`g` defect identities across all three window replicates.

Every human and machine claim says the estimand is conditional on the exact
final discovered severity-specific population produced by the bound hidden-gold,
all-arm discovery, semantic-union, and adjudication procedure. It does not
generalize to latent defects, defects outside admitted coverage, “all defects,”
another severity, reviewer class, cache configuration, or task population.

## 2. Hidden gold is a one-way information boundary

This section replaces R2c4 section 2.1's ordering language with the irreversible
`HiddenGoldCampaignV1` state machine:

`GOLD_FROZEN -> DISCOVERY_OPEN -> DISCOVERY_SEALED -> GOLD_COMPARE ->
GOLD_UNIONED_FOR_SCORING -> TERMINAL`.

Transitions are monotonic and append-only. No state can reopen, roll back, or
reuse a prior discovery session. A separate gold custodian freezes and
independently verifies the gold before `DISCOVERY_OPEN`, stores it behind a
capability/key unavailable to discovery workers, models, reviewers, and their
supervisors, and publishes only a fixed-length opaque campaign commitment
generated with a fresh random hiding nonce. Its representation and campaign
identifier must reveal nothing about gold count, class, severity, task position,
or length.

“Zero gold-derived discovery signals” forbids exposing, directly or indirectly:

- gold payloads, excerpts, labels, counts, severities, positions, identifiers,
  filenames, lengths, hashes, commitments derived without a hiding nonce, or
  truth-membership markers;
- a gold-dependent prompt, task order, arm order, reviewer assignment, timeout,
  retry, fallback, cache key/namespace, error, status, branch, timing, resource
  use, file metadata, or control-flow difference; or
- a gold handle, descriptor, socket, IPC endpoint, environment/argument/stdin
  value, decryption key, broker capability, log, trace, or model-visible tool.

Discovery receives only ordinary admitted public/synthetic task material and a
fresh random campaign identifier. OS/broker evidence must prove separate
principals, protected IPC, closed descriptors, constant-shape denial behavior,
and absence of a discovery capability to request or infer gold. A declaration
or prompt instruction is not evidence of this boundary.

### 2.1 Required campaign sequence

1. **Freeze gold.** The independent custodian admits and seals the finite gold
   population, truth/severity rubric, and opaque hiding commitment. Gold remains
   unreadable outside that custody boundary.
2. **Run open discovery.** All A/B1/B2/B3 volatile outputs enter the R2c4
   discovery/semantic-union procedure. Fresh randomized two-reviewer sessions
   continue to its bounded fixed point with no gold signal or access path.
3. **Seal discovery irreversibly.** Persist only `OpenDiscoverySealV1`, binding
   proposal identities, semantic union, reviewer/session/configuration digests,
   fixed-point proof, and the coverage-neutral admitted task population. Revoke
   every discovery write capability, close/destruct discovery sessions, and
   verify those actions before the transition completes.
4. **Compare once.** Only after independent verification of the discovery seal
   may the supervisor mint a one-shot, comparator-only gold capability. The
   comparator reveals gold internally, compares it with the already sealed
   discovery union, and emits closed recovery records by task/class/severity.
5. **Union for scoring.** Gold truths are forcibly added to the scoring union so
   an open-discovery miss cannot disappear from A/B3 scoring. Any candidate
   first produced after reveal is scoring-only and can never be credited as
   open-discovery recovery or change the sealed coverage result.
6. **Finish and destroy.** Seal existence/severity and the section 1 population
   ledger, perform separate detection/resolution scoring, emit only approved
   closed evidence, destroy raw gold/comparison material, and enter `TERMINAL`.

The recovery ledger binds the pre-reveal discovery-seal digest and the
post-seal comparator output so their order is independently verifiable. Gold
may calibrate finite seeded coverage only; it cannot alter the discovered
population retrospectively or support a latent-defect completeness claim.

### 2.2 Pre-seal access fails the whole campaign

Before `DISCOVERY_SEALED`, any attempted or successful gold access by a
noncustodian campaign component, comparator invocation, gold-derived signal,
reachable handle/key/capability outside the custodian, open shared channel, or
unexplained gold-correlated timing/control difference returns
`GOLD_BLINDING_BREACH`. The result is global for that campaign and exact
configuration: all caches, classes, windows, arms, quality cells, savings
cells, and claims fail; volatile state is destroyed; no partial result survives.

There is no waiver, retry-in-place, retroactive seal, post-hoc redaction, or
“accessed but unused” exception. After root-cause repair, qualification starts
as a new campaign with fresh gold/control identifiers, hiding nonces, sessions,
randomization, cache state, and all three windows. Access after the seal remains
subject to the provider/security volatile-output boundary and the one-shot
comparator scope; it is not permission to persist raw gold.

## 3. Canonical algebraic confidence-set roots

R2c4's `BoundedSavingsIntervalV1` remains the primary inversion, including
`C_S={s in S_domain:F(s)<=0}`, but an irrational endpoint cannot be represented
by an implementation-selected decimal or arbitrary isolator. This section
defines `BoundedSavingsIntervalV2` and supersedes R2c4 sections 3.1(3–6) wherever
root representation, sign classification, or outward rounding conflicts.

After positive-denominator clearing, reduce nonzero `F` to a sign-preserving
primitive integer polynomial `q`: divide coefficients by their positive content
GCD but never negate `q`, because its sign controls `F<=0`. Separately derive
the root-identity polynomial `p` as the square-free part of `q`, normalized to
positive leading coefficient, and retain every multiplicity in `q`. Bind an
exact integer factorization certificate
`q = sigma * product_j(f_j^m_j)`, where every primitive irreducible `f_j` has
positive leading coefficient and `sigma` is the signed primitive unit; `p` is
the primitive positive-leading product of the distinct `f_j`. All confidence-set
sign tests evaluate `q`, never sign-normalized `p`. Degree-zero and
identically-zero cases follow R2c4's exact whole/empty-set rules and produce no
invented root object.

Every real root is represented by exactly one of:

- `RationalRootV1`: reduced signed numerator/positive denominator, its ascending
  real-root order in `p`, and multiplicity in the original `F`; or
- `AlgebraicRootV1`: canonical primitive square-free polynomial coefficients
  and digest, one-based ascending real-root order in `p`, original multiplicity,
  and a canonical open rational isolating interval `(l,u)` whose reduced
  endpoints are not roots and whose exact Sturm/root-count certificate proves
  that it contains exactly that one ordered real root. For a simple irrational
  root, exact `p(l)*p(u)<0` is also mandatory.

The polynomial plus ascending root order defines algebraic identity; the
isolating interval makes it independently reproducible. A quadratic double
root is rational and uses `RationalRootV1` with multiplicity two. A verifier
rejects a nonprimitive polynomial, negative leading coefficient, non-square-free
`p`, mismatched order/multiplicity, reducible rational root labeled algebraic,
endpoint root, or interval containing zero/multiple/different roots.

### 3.1 Canonical isolation and exact signs

Let the fixed presentation grid denominator be `Q=10^12`. Exhaust exact
rational-root detection first. For an irrational ordered root, use exact
polynomial arithmetic and root-count bisection to find
the unique adjacent grid cell `(m/Q,(m+1)/Q)` containing it. If two distinct
roots share that cell, refine on denominators `Q*2^j` and choose the least
nonnegative `j`, then the lowest integer `m`, for which the open cell contains
exactly the specified ordered root and neither endpoint is a root. This
least-`j`/lowest-`m` rule is the canonical isolating interval. If an endpoint
evaluates to zero, apply the rational-root theorem and emit its exact reduced
`RationalRootV1` instead; do not perturb the endpoint.

Sort the domain endpoints and root objects, then classify every adjacent open
interval using a canonical exact rational test point. The point is the reduced
midpoint between already disjoint rational isolators/domain endpoints, refined
first if separation is not proven. Evaluate the original canonical integer
`q` exactly at that point and record `NEGATIVE`, `ZERO`, or `POSITIVE`. `ZERO`
on an open interval is possible only for identically-zero `F`; otherwise it is
a verifier failure.

For every root, persist `leftSign`, `rightSign`, and
`equalityIncluded=(F(root)=0 && predicate is F<=0)`. Equality is always included
by the closed confidence predicate, even for an even-multiplicity root with the
same positive sign on both sides. A sign change alone is therefore never a
complete membership algorithm. Union every accepted open piece with all
included equality roots, intersect with `S_domain`, then take R2c4's required
closed convex hull.

### 3.2 Exact outward presentation bound

If a hull endpoint is rational, retain it exactly. If it is algebraic, prove
its adjacent `Q`-grid indices using its canonical root identity and exact root
counts: report `m/Q` for a lower endpoint and `(m+1)/Q` for an upper endpoint.
These are outward bounds, not decimal approximations. When a canonical isolator
used `Q*2^j`, exact bisection/root counting continues until the containing
base-`Q` adjacent cell is proven; equality at a base-grid point converts the
root to rational and remains exact.

Prospectively freeze BigInt bit, Sturm-step, and bisection-operation maxima high
enough for every required deterministic vector. Hitting a bound, failing to
separate roots, disagreeing on root count/order/sign, or being unable to prove
the outward base-grid cell returns `ALGEBRAIC_ROOT_UNRESOLVED` and fails that
cell and configuration. It cannot fall back to floating point, a library
decimal, point-plus-margin, or percentile bootstrap.

`BoundedSavingsIntervalV2` binds canonical `q`, root-identity `p`, their exact
signed factorization/original-multiplicity bytes, every root
object/certificate, adjacent-sign and equality decisions,
confidence-set pieces/hull, outward-grid proof, operation bounds, independent
verifier result, and deterministic-vector-suite digest. These bytes are part of
`BenchmarkConfigurationV2`, the primary claim, and evidence digest. Mutation
requires full three-window requalification. R2c4's
`TokenReductionClaimV2.primarySavings` must name `BoundedSavingsIntervalV2`;
its percentile object remains `SENSITIVITY_NOT_ACTIVATION` under R2c4 section 5.

## 4. Deterministic acceptance vectors

An independent implementation and verifier must byte-agree on these cases:

1. **Severity membership.** A task with one HIGH and two LOW defects belongs to
   `D_HIGH` and `D_LOW`, not `D_CRITICAL` or `D_MEDIUM`, and not `Z_ANY`. Its
   HIGH detection and resolution fractions each have denominator one; its LOW
   fractions each have denominator two. A combined result cannot replace either.
2. **Severity weights.** With `alpha_(1,HIGH)=1/4`, two class-1 HIGH tasks,
   `alpha_(2,HIGH)=3/4`, and three class-2 HIGH tasks, weights are exactly
   `1/8,1/8,1/4,1/4,1/4`. Empty required MEDIUM, a mutated severity, or a
   detection-pass/resolution-fail combination fails rather than pooling away.
3. **Zero sets.** A MEDIUM-only task is in `Z_CRITICAL` but outside `Z_ANY`.
   Feeding it to `TaskOutcomePass` must be rejected by ledger recomputation.
4. **Hidden-gold order.** Gold recovered only during the one-shot post-seal
   compare is an open-discovery miss but is forcibly included for A/B3 scoring.
   The discovery-seal digest remains unchanged.
5. **Blinding breach.** A pre-seal open descriptor, attempted comparator call,
   gold-dependent count, distinguishable denial time, or later claim of
   non-use returns `GOLD_BLINDING_BREACH`, destroys the campaign, and forces a
   fresh full three-window campaign. A local retry must be impossible.
6. **Irrational roots.** For `q=p=2s^2-1` on `[-1,1]`, ordered root 1 is in
   `(-707106781187/10^12,-707106781186/10^12)` and ordered root 2 is in
   `(707106781186/10^12,707106781187/10^12)`. Because `q<=0` includes equality,
   the confidence set is the closed interval between the roots; its required
   outward reported bound is exactly
   `[-707106781187/10^12,707106781187/10^12]`.
7. **Rational and repeated roots.** Sign-preserving integer `q=4s^2-1` emits
   exact roots `-1/2,1/2`.
   `q=(5s-1)^2` emits root `1/5` with original multiplicity two and, on a
   containing domain, the equality-only confidence set `{1/5}`. Both adjacent
   signs are POSITIVE, proving sign-change-only logic is rejected.
8. **Sign orientation and disconnected pieces.** For sign-preserving
   `q=1-4s^2` on `[-1,1]`, root-identity `p=4s^2-1` has positive leading
   coefficient but the orientation relation is negative. Exact classification
   accepts `[-1,-1/2]` and `[1/2,1]`, including both equality roots; the required
   conservative hull is `[-1,1]`.
9. **Shared base-grid cell.** The two positive irrational roots of
   `p=(10^13*s-2)^2-2` both lie in `(0,1/10^12)`. The canonical representation
   must use the least separating value `j=2`: ordered-root isolators are
   `(0,1/(4*10^12))` and `(1/(4*10^12),2/(4*10^12))`. An arbitrary narrower
   interval or implementation-chosen `j` fails byte equality.
10. **Boundary and failure.** A root exactly on a domain/threshold/base-grid
    point converts to `RationalRootV1` and equality is included. A deliberately
    insufficient bit/step bound, an isolator with the wrong root order, or a
    sign/root-count mismatch returns `ALGEBRAIC_ROOT_UNRESOLVED`; no rounded
    decimal or sensitivity interval is emitted as primary evidence.

## 5. Precedence, tradeoff, and self-assessment

Precedence is narrow and exact:

- section 1 replaces R2c4's unindexed D-population definitions and weights;
- section 2 replaces R2c4's hidden-gold reveal/order language but preserves its
  finite-coverage floors and conditional limitation; and
- section 3 replaces R2c4's arbitrary root-isolation representation and names
  `BoundedSavingsIntervalV2` as primary. All other R2c1→R2c4 requirements,
  including A/B3-only scoring, all-arm discovery, provider receipt rules,
  activation gates, requalification triggers, and sensitivity-only bootstrap,
  remain unchanged.

Accepted conservative tradeoffs are explicit. Severity cells require more
finite-corpus tasks and may be `NOT_ESTIMABLE`; hidden-gold custody requires a
real isolation boundary and discards a whole campaign on any early-access
signal; exact algebraic proofs cost more than decimal roots and fail closed at
their frozen resource bounds. None may be weakened to make a campaign pass.

Self-review performed against all three assigned findings and the ten vectors:

- severity membership, minima, weights, zero-set meaning, conditional claim
  scope, and independently gated detection/resolution outcomes are explicit;
- the gold state machine is one-way, discovery receives zero gold-derived
  signal, and every pre-seal access path has a campaign-wide terminal failure;
- algebraic identity is canonical, sign orientation is preserved, adjacent
  signs/equality are exact, outward grid bounds are proven, and unresolved
  roots fail without an approximate fallback.

Open implementation/qualification work:

1. Implement and independently recompute `SeverityPopulationLedgerV2` plus the
   separate severity-indexed detection/resolution estimators and gates.
2. Implement the custodian/broker-enforced `HiddenGoldCampaignV1` state machine
   and negative information-flow/breach tests.
3. Implement and independently verify `BoundedSavingsIntervalV2`, its canonical
   algebraic-root certificates, exact signs, grid bounds, and all ten vectors.
4. Re-run every affected exact cache/class/window and pooled cell through the
   required full three-window qualification campaign.

- Design-readiness self-score for these three R2c5 fixes: **97/100**.
- Independent reviewer score for this addendum: **not run**.
- Known unresolved design defects within the three-item scope: **zero identified**.
- Open implementation/qualification items: **four, listed above**.

This addendum changes no runtime. It does not establish measured savings,
provider qualification, activation, production/private-data coverage, or
credential-repository safety.
