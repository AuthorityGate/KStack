# Reuse-first option gate — owner decision

**Status:** LOCKED  
**Decision ID:** `RF-GATE-Q1`  
**Decision date:** 2026-08-26  
**Owner answer:** `Yes`  
**Scope:** process-design direction only  
**Implementation authority:** NOT GRANTED

## Bound reviewed sources

| Artifact | SHA-256 | Meaning |
|---|---|---|
| `.kstack/decisions/reuse-first-option-gate-2026-08-26.md` | `490132d09fd36f709e815e169f74457df374019284a08782f8ad57a8e68f93bd` | Exact Codex-qualified process design selected by this answer |
| `.kstack/decisions/reuse-first-option-gate-2026-08-26-codex-closure.md` | `fbc0d2ec5bd45e53217c484c5ce1cddbe318f70d4ddfe8c5c0c4f16415565aa1` | Codex-only review history: 72 revise, 95 revise, 99 clean |
| `.kstack/decisions/worker-first-orchestration-2026-08-26-w3-readback-ack.md` | `24041c4fe9db37f46eb090db55990658bdcf544e98637d3395a3d1e17fd22b21` | Locked full-readback, proceed-unless-corrected owner-question rule |

No Claude Opus report was requested or used for this decision.

## Full question shown to the owner

**Question `RF-GATE-Q1`:** Should KStack add decision
`REUSE-FIRST-GATE-2026-08-26`, requiring current source-level contender
research and an explicit Adopt/Adapt/Compose/Build comparison before detailed
design or item-level remediation for each material new capability, while
preserving native Build as the safe option and freezing validated unrelated
items?

**Recommendation:** Yes. It corrects the observed design-order failure without
forcing external reuse or changing implementation authority.

**If Yes:** select this process gate for later implementation design. Each
affected capability pauses after objectives for research, configured review,
and full owner selection; unrelated work continues. No implementation is
authorized by this answer.

**If No:** retain the current order. KStack may compare options during design,
but will not prevent native hardening/remediation before source-pinned research.

**If Comment:** narrow applicability, change evidence/trial rules, or propose
another ordering. This structural design remains blocked until mapped.

**Blocked until answered:** implementation design for this process gate.

**Selectable responses presented:** `Yes`, `No`, `Comment`.

## Verbatim answer

`Yes`

## Locked answer mapping and complete readback

`RF-GATE-Q1 / Adopt the reviewed reuse-first option gate -> Yes`.

The owner selects the exact process direction at reviewed digest
`490132d09fd36f709e815e169f74457df374019284a08782f8ad57a8e68f93bd`:

1. For every material new capability, KStack must perform current,
   source-level contender research after objective grounding and before
   detailed design, item-level remediation, or implementation handoff.
2. The option brief must explicitly and neutrally compare **Adopt**, **Adapt**,
   **Compose**, and **Build**, with exact source revision/digest,
   license/provenance, authority/security incompatibility, integration,
   maintenance, migration/exit cost, and trial/qualification evidence.
3. Existing external systems are candidates, not authorities. Selection never
   installs, executes, activates, or imports a contender and never authorizes an
   external side effect.
4. Native **Build** remains a valid first-class result whenever it best meets
   safety, governance, lifecycle cost, portability, reversibility, or other
   recorded criteria. The gate does not force external reuse.
5. Every capability receives its own full `Yes`/`No`/`Comment` owner selection
   after its frozen research and reviewed option brief. Reviewer confidence or
   silence cannot select an option.
6. An external or composed option is only `SELECTED_FOR_TRIAL` at selection.
   It cannot become a production implementation baseline without a
   digest-bound `QUALIFIED_BASELINE` receipt and ordinary later authority.
7. Rejected, deferred, superseded, disqualified, inconclusive, and trial-failed
   options remain in the append-only rejected-option ledger with evidence that
   could legitimately reopen them.
8. A material capability with no implementation begun—including a previously
   owner-approved design—runs this gate before its next remediation/design step
   or implementation handoff. Implementation-started and shipped capabilities
   are grandfathered unless a later material replacement or changed objective
   independently triggers the gate.
9. Every unrelated validated item remains frozen. This decision cannot alter,
   re-review, weaken, or relabel it; a real dependency requires a separately
   scoped material proposal and owner direction.
10. The gate integrates with `kstack-objectives`, `kstack-design`,
    `kstack-design-clarify`, `kstack-interrogate`, and worker-first
    orchestration exactly as the reviewed artifact states.
11. This answer selects process design only. It grants no permission to edit
    KStack skill/runtime code, install dependencies, run a qualification trial,
    use production data, create Jira/GitHub mutations, commit, push, merge, or
    deploy.

## Consequences accepted

- Material capability work may pause earlier and incur research, provenance,
  license, comparison, owner-decision, and—when reuse is selected—trial cost.
- A contender whose current revision or license cannot be resolved cannot be
  presented as current or become the selected dependency. KStack may still
  select evidenced native Build.
- Reuse selection may be slower initially, but detailed remediation cannot
  continue merely because time was already invested in a native direction.
- Only the affected capability pauses for owner selection or qualification;
  unrelated workers and validated items continue.
- Previously completed review remains historical evidence, but it substitutes
  for this gate only through the reviewed exact-equivalence rule.

## Scope freeze

The only new authoritative artifact created by this lock is this owner-decision
record. The reviewed design and Codex outputs remain byte-for-byte unchanged.
Every other validated KStack capability/item is outside `RF-GATE-Q1` and stays
frozen. No existing ledger status is changed by this record.

## Unresolved items

None for process-direction selection. Implementation design and code remain
future, separately authorized work.

## Lock rule

The complete mapping above is the required readback. Under the bound W3 owner
rule, the owner chose proceed-unless-corrected, so no second acknowledgment is
required after this full readback. Do not edit this locked record in place. A
future change requires a linked superseding owner decision naming the exact
changed clause and consequence.
