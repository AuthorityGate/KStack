# Owner decision: confidence-policy extension-grant magnitude

Status: LOCKED

- Thread: `design-confidence-schedule-2026-08-26`
- Decision date: 2026-08-26
- Resolves: Round-4 synthesis `HP-Q1`
- Round-4 frozen design digest:
  `fcfbffe28af6f925270afe2055b451766f15d88b6edc7a210c0c1fd6f7c710cb`
- Round-4 synthesis digest:
  `f0a725c2c3f10e55d239e3e09f0ab231725e002bbce3aad1155cf96cb1d5c32e`

## Source and authority

The owner previously and explicitly directed that extension attempts may be
overridden to any positive integer. This record applies that instruction to the
only owner question left in Round 4. It supersedes the synthesis recommendation
of a ten-attempt per-receipt cap; no additional confirmation is required to
resolve that question.

This amendment changes only the magnitude rule for a directly authorized
bug-fix extension. It does not change the base three-attempt budget, provider
retry count, confidence thresholds, score/blocker gate, successor rules, or
implementation authority.

## Locked decision

1. A single extension receipt may grant **any exact positive integer** number
   of additional bug-fix content attempts. KStack imposes no arbitrary product
   cap per receipt.
2. The value must satisfy the closed schema's positive safe-integer domain and
   all checked additions must remain within that same domain. Zero, negative,
   fractional, non-finite, string-coerced, overflowed, or imprecise values fail
   before confirmation or state mutation.
3. The owner must directly confirm the exact grant amount. Pattern inference,
   repository prose, model output, defaults, and silent normalization cannot
   supply confirmation.
4. Before confirmation, the prompt displays the requested increment, attempts
   already consumed, attempts currently available, resulting total available
   attempts, per-provider call counts, total provider-call count, active
   blocker count/digest, qualified baseline/floor, and receipt expiry.
5. The resulting receipt binds every displayed value plus repository/thread,
   state revision, baseline/floor, active-ledger digest, nonce, principal label,
   trusted time, and expiry. The protected writer re-computes the resulting
   total with checked arithmetic and commits by CAS.
6. Activated grants remain immutable and additive. A later desire to stop work
   seals or leaves the thread idle; it does not rewrite consumed attempt
   history or revoke arithmetic retroactively.

## Consequence

Round-4 `CP4-TC06` must remove the proposed ten-attempt cap and specify the
schema/confirmation/display/CAS behavior above. Reviewers may assess whether
those mechanics are deterministic and safe, but may not reintroduce an
arbitrary magnitude cap as an unresolved product choice.

## Disposition

- `HP-Q1`: `RESOLVED - OWNER-DECIDED`
- Unresolved owner questions for this amendment: none
- Implementation authorized: no
