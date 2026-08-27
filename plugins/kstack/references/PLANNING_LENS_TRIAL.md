# Broader planning-lens trial

KStack includes a file-based internal evaluation harness for strategy,
developer-experience, and strengthened product/UX review treatments. It does
not enable a production lane, contact a provider, or spend money by itself.
An `ELIGIBLE_FOR_NEW_DESIGN` result means only that a policy may enter a fresh
production design and approval round.

## Opt in named objectives

The feature is default-off. Add only owner-named objective IDs to
`.kstack/config.json`:

```json
{
  "workflow": {
    "planningLensTrial": {
      "enabled": true,
      "objectives": {
        "named-objective-id": [
          "strategy",
          "developer-experience",
          "strengthened-product-ux"
        ]
      }
    }
  }
}
```

Only these three closed IDs are accepted. Disabling the section makes every
objective ineligible without deleting the map. Selection must be based on
KStack-owned human input, never ticket text or another external source.

## Run the file workflow

Use an access-controlled directory outside the repository. Do not copy its
corpus, gold cards, arm map, outputs, or judgments into Git.

```bash
npm run lens-trial -- init --trial-dir /private/path/lens-trial
npm run lens-trial -- prepare --trial-dir /private/path/lens-trial
npm run lens-trial -- status --trial-dir /private/path/lens-trial
```

`init` creates editable `trial.json`, `corpus.json`, and `gold.json` templates.
Replace all placeholders. The roster must contain eight distinct named people,
one per fixed role. The corpus may contain an allowlist larger than 16; prepare
randomly selects at most 5 strategy-only, 5 DX-only, 4 both, and 2 neither
cases. Every applicable family needs four target cards, including an S3 card
and a natural card; at least half of the selected cards in each family must be
natural.

`prepare` validates the locked caps (16 cases, eight people, USD 588, 294
provider attempts), freezes ordinary hashes, creates an opaque T0-T4 arm map,
and writes a shuffled `run/dispatch-order.json`. It does not yet write usable
provider packets. Both selectors must independently complete every
`run/selectors.json` entry, then freeze their records:

```bash
npm run lens-trial -- freeze-selectors --trial-dir /private/path/lens-trial
```

The lock binds the selector file and capture/adjudication fail if it later
changes. Only after the lock validates does `freeze-selectors` release the
complete prompt packets under `run/dispatch/`. Trial, corpus, gold, arm-map,
dispatch-order, and individual packet hashes are checked before later phases.
Send packets through the chosen author model in the shuffled order, then
capture each returned text:

```bash
npm run lens-trial -- capture \
  --trial-dir /private/path/lens-trial \
  --dispatch OPAQUE_ID \
  --output /private/path/provider-output.md
```

Capture rejects malformed Unicode, prohibited controls, known secret patterns,
duplicate output, and output above 4 MiB. Missing outputs remain missing; they
are not silently imputed. Every later command rechecks that the frozen dispatch
count is at most 294, the reservation is at most USD 588, the count matches the
dispatch plan, and the reservation equals USD 2 per emitted packet. A normal
16-case run emits 80 packets and reserves USD 160. Because provider execution
is manual, the harness cannot observe retries or actual charges; the operator
must count those in the real provider ledger and stop before either locked cap.

A captured exact `Premise disposition: uncertain` or `Premise disposition:
challenged` line makes status `OWNER_REVIEW_REQUIRED` and is carried into the
analysis report. Trial scoring may finish, but the affected objective cannot
proceed into a design until the owner disposes of the premise objection.

A family is skipped only when both distinct valid entries say `skip` with a
rationale, roster-bound name, and timestamp; every disagreement or single
reviewer skip applies it. The file contract verifies two different roster
names, but deliberately does not use cryptographic identity proof: the trial
lead remains responsible for confirming the two named people authored their
own entries. Then create the blinded package:

```bash
npm run lens-trial -- adjudication --trial-dir /private/path/lens-trial
```

Give adjudicators only `run/adjudication/`. Do not give them `arm-map.json`,
`analysis-map.json`, selectors, policy names, or aggregates. Sheet filenames
are opaque, and sheet order and A/B slots are randomized. Sheets omit case IDs,
original target IDs, severity/natural construction flags, and roster names;
assign A, B, and C out of band. Each sheet contains one family's four target
cards. This fixed
layout is 16 binary judgments per slot (four targets times gap, consequence,
acceptable decision/mitigation, and verification). It deliberately uses a
separate sheet for each applicable family: both-family cases no longer create
the ambiguous 96-field sheet in the round-8 draft, and neither cases have no
efficacy sheet. The analysis uses only each family's per-case 16-field capture
fraction, so splitting families and scrubbing non-scoring construction fields
loses no observation consumed by the sign tests or package gate.

No explicit author-model field or source filename enters a sheet, and prompts
tell authors not to identify their provider or model. The raw outputs remain
unscrubbed evaluation evidence, however: mandated treatment headings, content,
or writing style can make the likely treatment or model inferable. `armGuess`
and confidence record treatment recognizability; this is randomized-slot
blinding, not a claim that content makes authorship or treatment unknowable.

Adjudicators A and B replace every `null` field with a boolean. C fills only
fields where A and B disagree. `preferred`, arm guess, confidence, and notes are
descriptive and do not change the score. Analyze after the sheets are complete:

```bash
npm run lens-trial -- analyze --trial-dir /private/path/lens-trial
```

The analyzer computes paired treatment-minus-control capture scores, keeps ties
in the mean and out of the exact one-sided sign test, and requires mean effect
at least 0.10 plus positive differences on at least half the cases. Roots use
Holm gatekeeping: the smaller p-value is tested at 0.05 and, only after its
rejection, the other at 0.10; a sole testable root uses 0.05. Each root needs
`n >= 5` and at least four nonzero pairs. Packages need `n >= 4` and four
nonzero pairs in each family, open only after both roots qualify, and run E,
D, then B at `max(p_strategy, p_DX) <= 0.10`. An untestable package is skipped;
the first testable package failure makes later packages descriptive only.

The resulting `run/analysis.json` is aggregate trial evidence. Keep Option A
(the six mandatory lanes) for every negative, missing, untestable, incident, or
stopped result. The first analysis write is final for that directory; rerunning
after changing labels requires a new trial directory.

## Deliberate scope

This implementation keeps the load-bearing randomized-slot comparison,
independent human labels, dual-selector suppression rule, fixed sequence, exact
sign test, named-objective opt-in, and hard trial scale. It intentionally omits
live provider orchestration, calibration-bank ceremonies, whole-sheet capacity
formulas, global fallback machinery, retry simulations, detailed
resource/lane/truncation gates, cryptographic custody (including AEAD, Shamir,
seed reveal, and TPM mechanisms), Monte Carlo machinery, and billing receipts.
Provider choice, actual cost/time ledgers, access control, retention, and
incident response remain ordinary operator records.
