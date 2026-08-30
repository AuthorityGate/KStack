# Domain breadth D7 multi-pack evaluation profiles

**Scope:** evaluation-corpus and candidate-binding runtime only  
**Authority:** qualification preparation; no provider execution, adjudication, qualification, selection, or activation

## Correction

The original executable D7 contract freezes release-operations strata. Those
strata cannot be reused as evidence for the assurance, product-experience, or
research-knowledge candidates. Each candidate now has a separate canonical
evaluation profile with five critical strata and six binary cross-cuts:

| Candidate | Critical strata |
| --- | --- |
| `assurance@1.0.0` | assets/boundaries; controls/effectiveness; data/obligations; residual-risk/exceptions; threats/abuse paths |
| `product-experience@1.0.0` | accessibility/language; error/recovery/support; journey/state continuity; premise/outcome; representative validation |
| `release-operations@1.0.0` | ambiguous/partially acted; canary degradation; ordinary staged release; rollback/incident handoff; state/data migration |
| `research-knowledge@1.0.0` | citation/decision use; contradiction/counterevidence; question/scope; source quality; synthesis/inference |

The exact profile record is domain-separated and SHA-256 bound into a v2
evaluation plan. A plan is rejected when the candidate ID and profile digest
do not match. The checked-in candidate builder opens and canonicalizes the
candidate bundle and rejects an evaluation plan unless its candidate digest
equals the resulting exact bundle digest.

## Corpus and execution invariants

Every profile still requires exactly 300 independently authored cases: 60 per
critical stratum, at least 15 held out from pack authors in every stratum, and
40%-60% representation for each binary cross-cut inside every stratum. Pack
authors cannot author cases. Exact case IDs, sources, authors, gold gaps,
acceptance criteria, lane ownership, and held-out flags enter the corpus
digest.

The common D7 execution and analysis path continues to require 900 distinct
sessions, exact A/B/C coverage, tool prohibition, raw-finding inventory
binding, two independent domain-qualified natural-person adjudicators,
deliberate gridlock, 100,000 stratified resamples, Holm gates, exact safety
bounds, D4/D10 validation, and D6 budget/duration qualification. The execution
ledger digest now includes the corpus digest, preventing a ledger from being
rebound to different gold gaps or a different pack profile.

The original release-operations v1 freeze route remains available for its
already-frozen contract. New four-pack campaigns use the v2 pack-specific
route.

## Current evidence and remaining work

`tests/domain-evaluation.test.mjs` validates four distinct profile and corpus
digests, 300 balanced cases per profile, 900 isolated executions, profile
drift rejection, two-person gridlock, and the generalized statistical path.
`tests/domain-pack-candidates.test.mjs` validates that every profile is bound
to the exact checked-in candidate bundle and rejects substituted bundle
digests.

These tests exercise synthetic negative and boundary fixtures only. They do
not constitute an authentic corpus, provider output, natural-person
adjudication, D4/D10 or D6 qualification receipt, independent final review, or
owner activation. All four candidates remain inactive until those external
requirements are completed with genuine evidence.
