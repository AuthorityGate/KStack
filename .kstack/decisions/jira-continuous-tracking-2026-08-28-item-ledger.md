# Jira continuous tracking item ledger

**Objective:** `.kstack/objectives/jira-continuous-tracking-2026-08-28.md`  
**Closure:** review and repair one item at a time; confidence at least 93 with
zero failed checks, security findings, material dissent, and unresolved
questions on the exact digest  
**Review route:** Codex only unless the owner changes it  
**Live mutation:** not authorized by this ledger

| ID | Item | Status | Evidence / next action |
|---|---|---|---|
| JT-TC01 | Initial roadmap preview, create/adopt, read-back, and reconciliation | `VERIFIED-96-AWAITING-PUBLICATION` | Codex approved the exact implementation at 96 confidence with zero failed checks, security findings, dissent, or questions. Focused bootstrap tests pass 37/37, neighboring Jira/configuration tests pass 157/157, the full suite passes 998/999 with one expected Windows skip, and live read-back proves all nine KStack roadmap items exist exactly once. The review repaired successful-POST/inconclusive-read-back classification to `AMBIGUOUS_HISTORY`; publish the reviewed tree before durable Jira closure. |
| JT-TC02 | Durable local item/event outbox, stable identities, ordering, capture failure behavior | `CLOSED-99` | Codex R3 approved at 99 confidence with zero failed checks, security findings, dissent, or questions. Exact canonical bytes, enrolled binding, descriptor reads, bounded storage, all scanner classes, multi-process writers, and real crash-cut recovery passed 25/25 focused and 430/430 full-suite tests. |
| JT-TC03 | Jira issue mapping, create/adopt, revision/drift detection, and ongoing new-item projection | `REPAIRED-AWAITING-R2` | R1 was 98/revise with 3 environment-only failed checks, 4 security findings, and 2 dissent items. Automatic mode now performs complete project-scoped marker search, exact frozen-field adoption, one physical create POST, ambiguous-response reconciliation without repost, and exact durable OS-state item-to-ID/key mapping. Focused adversarial tests pass 30/30, combined neighbor/gate tests pass 151/151, and the full suite passes 435/435. |
| JT-TC04 | Activity comments and workflow-category transition projection | `IMPLEMENTED-UNDER-TEST` | Marker search precedes every append-only comment; ambiguous results reconcile before refusing retry. Latest portable status category is read, transitioned only through one exact candidate, and read back. Add pagination/duplicate/ambiguous transition adversarial fixtures. |
| JT-TC05 | Jira project versions, release assignment, upgrade history, and administration boundary | `IMPLEMENTED-UNDER-TEST` | Release events remain in comments. Optional assignment accepts only an approved numeric ID/name/date whose live version is in the bound project and already released; update uses additive fixVersions and read-back. Version creation/release administration remains open. |
| JT-TC06 | Init/design/implement/QC/review skill wiring, automatic versus approval-queued policy, and main-window status | `IMPLEMENTED-UNDER-TEST` | Init, objectives, design, Interrogation, implementation, QC, review, Jira, and configuration now require the two-lane protocol. Main-window aggregate status remains open. |
| JT-TC07 | Migration/import, qualification, live KStack population, packaging, rollback, and final integrated gate | `OPEN-UNTESTED` | Run only after TC01-TC06 independently close. |

## Rejected shortcuts

- A created project/board with zero issues is not completed onboarding.
- Re-scanning Markdown and guessing status without a durable event outbox is
  not continuous tracking.
- Jira issue text is never imported as authority to change KStack state.
- One mutable Jira description is not an audit history; accepted events append.
- Labels pretending to be releases do not replace Jira project versions.
- Automatic tracking does not imply automatic project/version administration.
- A Jira backlog issue without append-only delivery history is incomplete.
