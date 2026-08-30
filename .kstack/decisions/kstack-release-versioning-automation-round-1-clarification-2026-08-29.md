# Round-One Clarification Decision Record: KStack Release Versioning Automation

Status: LOCKED

- Thread ID: `kstack-release-versioning-automation`
- Objective: Design a real release-versioning and tagging automation process for KStack, replacing the current de facto non-process (frozen 0.1.0 version, no CI integrity gate, unused claude plugin tag command, divergent `.claude-plugin`/`.codex-plugin` version schemes).
- Round-one invocation ID: `9afb2836-8c71-4743-8030-899e1e058e9a`
- Design digest: `8d345fb4839755994611006ad4d9a8a499e140c356be0340937f5815d49d30f1`
- Confirmation date: `2026-08-29`

## Complete Source Inventory and SHA-256 Digests

| Source path | Role | SHA-256 |
|---|---|---|
| `/tmp/claude-1000/-mnt-c-Users-lr427-source-AuthorityGate-products/1a8b9085-588a-48d4-87ba-d6b0f0be8338/scratchpad/kstack-release-automation-brief.md` | Round-one brief; its file digest is the design digest | `8d345fb4839755994611006ad4d9a8a499e140c356be0340937f5815d49d30f1` |
| `/tmp/claude-1000/-mnt-c-Users-lr427-source-AuthorityGate-products/1a8b9085-588a-48d4-87ba-d6b0f0be8338/scratchpad/kstack-release-review-out/codex.json` | Codex round-one review | `704e26d731f2d38d6e7c6bc9dec4ce3b9da3170c40b740180c593afaa5ce8f73` |
| `/tmp/claude-1000/-mnt-c-Users-lr427-source-AuthorityGate-products/1a8b9085-588a-48d4-87ba-d6b0f0be8338/scratchpad/kstack-release-review-out/opus.json` | Opus round-one review | `bc4e2318ce3bd4e1c59636e9c87ae9127e4da78eaa9b9c667272d9386a3e35d6` |
| `/tmp/claude-1000/-mnt-c-Users-lr427-source-AuthorityGate-products/1a8b9085-588a-48d4-87ba-d6b0f0be8338/scratchpad/kstack-release-review-out/manifest.json` | Dual-review runner manifest | `7a01fcc04efabb0fd97cbc8a73188e2f9ed0c363f46cf98e97928209d7a2ad77` |
| `/tmp/claude-1000/-mnt-c-Users-lr427-source-AuthorityGate-products/1a8b9085-588a-48d4-87ba-d6b0f0be8338/scratchpad/kstack-release-review-gate.json` | Design-gate result: `BLOCKED` | `17387be42378808ee6c2f3bc573bb5f119b542a14645a0059a24f844be037eaa` |

## Extraction Method

The coordinating host (Claude Sonnet) read the complete round-one brief and
both full structured reviewer reports, including each reviewer's `decision`,
`confidence`, `failedChecks`, `securityFindings`, `materialDissent`,
`recommendation`, `strongestObjection`, and `unresolvedQuestions`. It built a
consolidated question ledger by merging overlapping items across both reviewers
and questioned the owner directly across three exchanges rather than collapsing
the session to a single general prompt.

For the source-inventory and completeness check, both reviewers' full JSON
review objects were read in full, not merely their summaries. The round-one
brief's ten evidence items and unresolved-questions section were cross-checked
against both reports' `failedChecks`, `unresolvedQuestions`, `materialDissent`,
and `securityFindings` arrays. No unaccounted source item remained.

## Scope-Alignment Check

The coordinating host compared each reviewer's proposed additions—deterministic
manifest rules, setup-visible source identity, a dirty-tree compensating
control, a canonical version model, and rollback automation—against the
objective's three stated outcomes:

1. A consumer can tell whether installed content is current or stale.
2. Shipped files are provably self-consistent at tag time.
3. In-flight downstream consumers are not disrupted.

All proposed additions trace to outcome 1 or outcome 2. None introduces an
untraceable scope expansion. The scope-alignment check is complete.

## Questions, Answers, and Dispositions

### Q1 — Dirty working-tree installation policy

- **Category:** Security finding / material dissent
- **Source pointers:** `opus.json` `securityFindings[SEC-01-working-tree-install-bypasses-ci]` and `strongestObjection`; `codex.json` `unresolvedQuestions[0]`.
- **Direct question:** How strict should setup be about installing from a dirty/uncommitted working tree, given evidence #8 (this session's reproduced `KSTACK_POST_DEPLOY_SOURCE_AUDIT_DIVERGENT` failure) and both reviewers flagging that CI-only validation never covers the actual live-directory install path? The offered choices were hard-refuse-by-default-with-override (recommended by the coordinating host), loud-warning-only-never-refuse, or an owner-specified alternative.
- **User-stated answer:** “Loud warning only, never refuse.”
- **Accepted consequence:** This leaves open the residual risk raised by Opus's strongest objection: a consumer can still install unreviewed or uncommitted content after ignoring the warning. The owner explicitly accepts that risk in exchange for preserving the existing dogfooding and local-development workflow.
- **Disposition:** RESOLVED.

### Q2 — Canonical version source

- **Category:** Material-dissent / recommendation convergence
- **Source pointers:** `codex.json` `materialDissent[4]` and `recommendation`; `opus.json` `recommendation` item 3.
- **Direct question:** Should `.claude-plugin/plugin.json` become the single canonical version source, with `marketplace.json` and `.codex-plugin/plugin.json` mechanically derived and CI-verified rather than hand-edited, while each also carries its own separate `buildId`?
- **User-stated answer:** “Yes, adopt it.”
- **Accepted consequence:** Round 2 must define `.claude-plugin/plugin.json` as the canonical version authority, mechanically derive or verify the other manifests, and retain a distinct per-manifest `buildId` rather than conflating source version and build identity.
- **Disposition:** RESOLVED.

### Q3 — Global PreToolUse serialized-envelope size cap

- **Category:** Security finding
- **Source pointers:** `codex.json` `securityFindings[KSTACK-HOOK-INPUT-DOS]` (severity high); `opus.json` `securityFindings[SEC-02-hook-cap-fix-must-stay-fail-closed]` (severity high).
- **Direct question:** The global (`matcher: "*"`, every tool call, every session) `PreToolUse` safety hook has a hard 8 KiB serialized-envelope cap; exceeding it silently denies with a generic, non-actionable message. The failure was reproduced directly this session against `kstack-safety-hook.mjs` and reproduced again independently during this clarification pass against a large dispatch prompt. Both reviewers rated it high severity and recommended fixing it urgently but separately from the release-automation design. Should it be fixed now in parallel, or tracked and fixed later?
- **User-stated answer:** “Fix it now, in parallel.”
- **Accepted consequence:** A separate scoped fix dispatch is authorized outside this design thread's approval gate. It must raise the bound to a reasonable value, add an actionable size-limit error naming the exact cap, and remain fail-closed on oversize. It must never truncate and then scan, because Opus explicitly warned in `SEC-02` that truncate-then-evaluate would itself create a bypass.
- **Disposition:** RESOLVED.

### Q4 — Automated version bump

- **Category:** Material dissent / security finding
- **Source pointers:** `codex.json` `materialDissent[4]`; `opus.json` `materialDissent[1]` and `securityFindings[SEC-03-auto-bump-privileges-and-check-evasion]` (severity medium).
- **Direct question:** Both reviewers recommended deferring automated version-bump-bot logic (Option C) until commit-message discipline and release cadence are established. They cited `SEC-03`: a default GitHub Actions workflow token's commits do not retrigger workflows, while a PAT workaround typically bypasses branch protection. The user was first asked to confirm this deferral after not explicitly selecting it in an earlier multi-select.
- **User-stated answer:** “Actually, automate the version bump too.”
- **Accepted consequence:** Round 2 must explicitly design around `SEC-03`: the automated bump mechanism may not silently bypass branch protection or produce an ungated merge. Automation is in scope only with the flagged authority and check-evasion risk addressed.
- **Disposition:** RESOLVED. This diverges from both reviewers' recommendation; the owner's explicit, informed choice governs under `kstack-design-clarify` authority.

### Q5 — Install-failure recovery

- **Category:** Unresolved question
- **Source pointers:** `codex.json` `unresolvedQuestions[5]`; `opus.json` `recommendation` item 7.
- **Direct question:** What should install-failure recovery be: documentation of the existing manual timestamped-backup procedure, or a new automated rollback mechanism? If automated, what should trigger it?
- **User-stated answer:** “Build automated rollback,” triggered when setup auto-detects a failed install-health check and rolls back itself, not through a separate manual `--rollback` command.
- **Accepted consequence:** Round 2 must design automated rollback as part of setup's failure path, with the install-health check as its trigger, rather than merely documenting manual recovery or requiring a separate rollback invocation.
- **Disposition:** RESOLVED.

### Q6 — Empirical validation of plugin update and tag behavior

- **Category:** Unverified assumption
- **Source pointers:** `opus.json` `unresolvedQuestions[0]` and `unresolvedQuestions[1]`.
- **Direct question:** Both reviewers flagged two empirical assumptions as unverified: (a) whether bumping the version actually restores `claude plugin update` staleness detection for a directory-source marketplace, and (b) whether `claude plugin tag` succeeds at all against this repository's structure. Rather than assume either, should both be tested during round 2 drafting?
- **User-stated answer:** The user confirmed this disposition with “Yes, lock it in as stated” in the final read-back that explicitly covered this item.
- **Accepted consequence:** Round 2's design brief must report actual test results for both behaviors, not assumptions.
- **Disposition:** RESOLVED.

## Unresolved Items

None. Every item above reached an explicit user disposition.

## Final Owner Confirmation

The user was read back the complete six-item decision set in one consolidated
message and explicitly confirmed with “Yes, lock it in as stated” before this
record was written.

- Confirmation date: `2026-08-29`
- Confirmation status: Explicit and complete

## Migration, Supersession, and Prior Records

- Migration limitation: None.
- Earlier clarification record superseded: None.
- Record superseded by this file: None. This is KStack's first release-versioning-automation design thread, and no prior clarification record exists for it.

Later rounds must treat this locked record as authoritative, cite its path and
digest in the next decision brief, and map each resulting design change to its
question ID. Any genuine conflict from new repository evidence, a newly
discovered safety constraint, or a new user request requires a new linked
decision record; this record must not be edited in place after locking.
