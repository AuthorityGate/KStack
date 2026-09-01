# Focused Host and Domain completion audit — 2026-08-29

**Purpose:** current execution control; this is not the runtime-maturity status
report and does not change the Advanced classification.  
**Authoritative inputs:** focused roadmap, durable Jira event ledger and
projection receipts, current worktree, and the complete 840-test validation.  
**Report rule:**
`.kstack/decisions/runtime-maturity-focused-2026-08-28-status.md` remains
untouched until every required closure proof exists.

## Corrected scope accounting

The 2026-08-28 report describes 21 Host items because it predates the focused
Hermes and OpenClaw additions. The current roadmap contains:

| Scope | Total | Active | Blocked | Planned | Done |
| --- | ---: | ---: | ---: | ---: | ---: |
| Core Host | 24 | 21 | 3 | 0 | 0 |
| Core Domain | 17 | 17 | 0 | 0 | 0 |
| Host/Domain KCRP provider trials | 2 | 2 | 0 | 0 | 0 |
| **Audited total** | **43** | **40** | **3** | **0** | **0** |

Jira seeding, primary implementation readiness, synthetic contract tests, and
real qualification are different states. No row is counted Done without its
own current independent review, real required execution, and durable Jira
closure evidence.

## Workflow control correction

`KSTK-77` now covers the host-neutral delivery sequence that keeps these rows
executable without collapsing design into deployment: 50,000-foot objective
interrogation, a validated 10,000-foot design, a complete dependency-ordered
Jira backlog, and implementation of exactly one ready block at a time. The
contract is enforced by `plugins/kstack/scripts/kstack-workflow-contract.mjs`
and defined by `plugins/kstack/references/DESIGN_ALTITUDE.md`.

Every repository can also bootstrap its own Jira project/space. Work-item
creation and Jira administration are separate authorities. Project/space,
board, and initial-backlog creation requires an explicit
`authority.jiraAdministration` value of `ask` or `allow`, an exact preview-hash
confirmation in an interactive terminal, and verified Jira read-back. A value
of `deny` or an absent legacy setting fails closed. This correction is active
but is not counted among the 43 Host/Domain closure rows and does not make
`KSTK-77` Done.

## Host matrix

| Jira | Item | Current evidence | Missing closure proof |
| --- | --- | --- | --- |
| KSTK-66 | HP-TC01 schemas | Primary implementation 93; repository green | Fresh independent final review on current integrated bytes |
| KSTK-37 | HP-TC02 request context | Primary implementation 93; repository green | Fresh independent final review on current integrated bytes |
| KSTK-3 | HP-TC03 replay/time | Primary implementation 93; repository green | Fresh independent final review on current integrated bytes |
| KSTK-4 | HP-TC04 evidence selection | Primary implementation 93; repository green | Fresh independent final review on current integrated bytes |
| KSTK-64 | HP-TC05 eligibility/quarantine | Primary implementation 93; repository green | Fresh independent final review on current integrated bytes |
| KSTK-59 | HP-TC06 harness/bypass | Primary implementation 93; repository green | Fresh independent final review on current integrated bytes |
| KSTK-35 | HP-TC07 structural broker | Primary implementation 93; repository green | Fresh independent final review on current integrated bytes |
| KSTK-45 | HP-TC08 race mutation | Primary implementation 93; repository green | Fresh independent final review on current integrated bytes |
| KSTK-29 | HP-TC09 MCP boundary | Primary implementation 93; repository green | Fresh independent final review on current integrated bytes |
| KSTK-12 | HP-TC10 receipt trust | Primary implementation 93; repository green | Fresh independent final review on current integrated bytes |
| KSTK-17 | HP-TC11 leases/activation | Primary implementation 93; repository green | Fresh independent final review on current integrated bytes |
| KSTK-32 | HP-TC12 migrations/rollout | Primary implementation 93; repository green | Fresh independent final review on current integrated bytes |
| KSTK-39 | HB-TC01 canonical package | Primary implementation 93; prior approval invalidated by shared drift | Fresh integrated final review after the final Host byte freeze |
| KSTK-48 | HB-TC02 installer | Primary implementation 93; prior approval invalidated by shared drift | Fresh integrated final review after the final Host byte freeze |
| KSTK-61 | HB-TC03 OpenCode package | Primary implementation 93 | Fresh integrated final review; provider attempts returned no result |
| KSTK-63 | HB-TC04 read-only MCP | Primary implementation 93 | Fresh integrated final review; provider attempt returned no result |
| KSTK-51 | HB-TC05 OpenCode conformance | Conformance system primary implementation 93 | Exact HP closure; real OpenCode fixtures and protected evidence; fresh final review |
| KSTK-28 | HB-TC06 second-host proof | Executable proof contract primary implementation 93; 8/8 focused; Jira comment 12594 | Stable OpenCode run/requalification; separate Goose objective/adapter; two real evidence sets; fresh final review |
| KSTK-75 | HB-TC07 Hermes | Candidate is correctly blocked | Signed upstream release and completed update path, then isolated real qualification |
| KSTK-73 | HB-TC08 OpenClaw | Candidate is correctly blocked | Advisory-free pinned closure and externally mediated ACP sandbox/launcher, then qualification |
| KSTK-84 | HB-TC09 Goose | Exact v1.48.0 provenance passes; advisory lock repair plus clean-room Apache-2.0 color compatibility override pass the explicit KStack technical license/source policy, unit tests, locked metadata, and default-feature CLI compile; deterministic `deno_core` module serialization and PCTX type-check snapshot-time remediation replay cleanly across two independent source reconstructions; a resume-triggered third reconstruction again produces the same stripped PIE binary `057a1788…` (253,305,256 bytes, identical build ID, RELRO, NX stack); deterministic CycloneDX 1.5 binds 1,043 components/1,044 nodes; conservative notice/corresponding-source ledgers cover 1,146 packages, 598 texts, 17 MPL-family packages, and all seven remediated files with zero modified MPL-covered files; the source-addressed nine-port dedicated adapter executes version/help/project-skill/advisory operations through the exact binary in a credential-free user/network/mount/PID namespace with four MATCH results, loopback-only networking, two classified title-plus-advisory provider requests, unchanged disposable repository, zero orphans, and a passing closed-schema evidence validator; Jira comments 12607/12611/12618/12619/12620 | Independent remediation/threat-model review; protected conformance evidence/admission for the stable profile; stable OpenCode predecessor and distinct HB-TC06 two-host proof; fresh integrated final review |
| KSTK-33 | Linux distro matrix | Windows-launched Ubuntu 24.04 WSL2 observation proves operational systemd and ext4; cell qualified; contract validated v4; Jira comment 12608 | Ubuntu native, Debian native, Fedora native, and exact complete matrix evidence |
| KSTK-41 | Linux privileged backends | WSL2 cgroup/pidfd seam-tested; eBPF unavailable; Jira comment 12609 | Real cgroup v2, eBPF, and pidfd privileged execution on every exact cell |
| KSTK-47 | Linux lifecycle | Fail-closed seven-step contract validated; Jira comment 12610 | Two exact releases and real install/upgrade/rollback/health/data-recovery on every cell |

## Domain matrix

| Jira | Item | Current evidence | Missing closure proof |
| --- | --- | --- | --- |
| KSTK-57 | D0 catalog runtime | Host-neutral catalog implementation and full regression pass | Current integrated independent final review |
| KSTK-13 | D1 identity | Primary implementation 93 | Fresh final review and production external-broker custody qualification |
| KSTK-24 | D2-F1 inventory | Primary implementation 93 | Fresh final review and qualified D5 activation path |
| KSTK-44 | D2-F2 policy | Primary implementation 93 | Fresh final review and qualified D5 activation path |
| KSTK-11 | D2-F3 selection | Primary implementation 93 | Fresh final review and qualified D5 activation path |
| KSTK-43 | D3 separation | Primary implementation 93 | Fresh final review and production broker qualification |
| KSTK-72 | D4/D10 evidence | Primary implementation 93 | Fresh final review and real evidence-backend custody qualification |
| KSTK-8 | D5-F1 schemas | Collision-free closed registry and adversarial suite green | Current integrated final review |
| KSTK-42 | D5-F2 activation | Atomic/recovery contract and adversarial suite green | Production backend qualification and current integrated final review |
| KSTK-27 | D6 budgets | Deterministic accounting/applicability implementation green | Real provider qualification and current integrated final review |
| KSTK-50 | D7 evaluation | Per-finding blinded adjudication and gridlock implementation green | Frozen 300-case/900-execution provider trial and two natural-person adjudicators |
| KSTK-53 | D8 trusted time | Genesis/successor crash recovery implementation green | Qualified authenticated time, two external CAS witnesses, protected ledger |
| KSTK-54 | Release-operations pack | Canonical inactive candidate installed/audited | Real blinded pack trial, final review, owner activation, independent rollback proof |
| KSTK-60 | Product-experience pack | Canonical inactive candidate installed/audited | Real pack trial, final review, owner activation, independent rollback proof |
| KSTK-10 | Assurance pack | Canonical inactive candidate installed/audited | Real pack trial, final review, owner activation, independent rollback proof |
| KSTK-36 | Research-knowledge pack | Canonical inactive candidate installed/audited | Real pack trial, final review, owner activation, independent rollback proof |
| KSTK-23 | Offline acquisition | Exact seven-file MIT source and translation contract verified | Preregistered 200+ case blinded trial and independent human adjudication |

## Cross-lane provider trials

| Jira | Item | Current evidence | Missing closure proof |
| --- | --- | --- | --- |
| KSTK-31 | Host KCRP A/B | Exact HB-TC06 dependency packet; byte-identical offline full/reduced replay; Jira comment 12595; route remains default-off | Authorized 30-task/six-class/three-window provider campaign; authenticated tokens/latency/cost/quality preservation evidence |
| KSTK-21 | Domain KCRP A/B | Exact D7 dependency packet; byte-identical offline full/reduced replay; Jira comment 12596; route remains default-off | Authorized 30-task/six-class/three-window provider campaign; authenticated tokens/latency/cost/quality preservation evidence |

## Current integrated validation

- HB-TC06 focused: 8 passed, 0 failed.
- Production architecture: 9 passed, 0 failed.
- Install health: 4 passed, 0 failed.
- Complete repository: 848 tests, 847 passed, 0 failed, 1 intentional
  platform-dependent skip, in 103,665.515798 ms. The final run executed
  outside the restricted wrapper because the post-resume wrapper hung
  synchronous child-process stdin; the same Host contract module passed 27/27
  outside that wrapper without a product change.
- Install-health audit-manifest check: passed.
- `git diff --check`: passed.
- Runtime-maturity report diff: empty.

## Execution order from this checkpoint

1. Freeze the integrated current Host/Domain bytes and dispatch the required
   independent final review only after the configured secondary reviewer is
   available and the packet payload is explicitly authorized.
2. Repair any findings with the primary agent, rerun all gates, and dispatch a
   fresh final only after returning to at least 93.
3. Execute real OpenCode, Goose, Linux, Domain provider, human-adjudication,
   trusted-time/witness, Hermes, and OpenClaw qualification cells without
   transferring evidence between rows.
4. Run the prepared KCRP Host and Domain packets through the preregistered
   provider campaigns with exact receipts and no default route activation.
5. Mark each Jira item Done only from its own closure evidence, then update the
   runtime-maturity report once the matrix contains no Active, Blocked, or
   Planned row.
