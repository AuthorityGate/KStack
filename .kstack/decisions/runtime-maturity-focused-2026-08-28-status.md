# Runtime maturity focused status

**Date:** 2026-08-28  
**Current classification:** Advanced  
**Target classification:** Master  
**Execution model:** Jira-first, independently evidenced work lanes

## Outcome

KStack remains Advanced because its reviewed architecture is broader than its
implemented and live-qualified runtime. The remaining work is not one feature:
it is a coordinated execution program across release, Host, Domain, Memory,
secret lifecycle, and measured provider qualification. Evidence from one lane
does not close another lane.

The complete focused backlog now exists in Jira. KStack created or exactly
adopted and read back 72 durable KSTK issues (`KSTK-1` through `KSTK-72`): nine
earlier roadmap umbrellas and 63 focused additions. The focused manifest is
`.kstack/roadmaps/runtime-maturity-focused-2026-08-28.json`.

## Completion accounting

Jira seeding and runtime implementation are separate measurements. Creating a
verified Jira entry does not implement or close its work item.

| Measurement | Current result |
| --- | ---: |
| Jira issues created/adopted and read back | 72/72 |
| Focused items independently closed | 0/63 |
| Focused items active | 1/63 (`KSTK-7`) |
| Host items independently closed | 0/21 |
| Domain items independently closed | 0/17 |
| Secret-lifecycle items independently closed | 0/6 |

The `confidence: 100` attached to the `IMPLEMENTATION_VALIDATED` event on
`KSTK-7` applies only to the reported 30/30 test execution for that exact code
change. It is not an overall completion percentage, an independent review, or
permission to mark `KSTK-7` done.

## Focused backlog

The 63 focused additions are divided into non-overlapping execution lanes:

| Lane | Items | Required outcome |
| --- | ---: | --- |
| Program coordination | 1 | Preserve independent evidence and sequence the runtime promotion |
| Host | 21 | Implement 12 HP contracts, six HB contracts, and three explicit Linux qualifications |
| Domain | 17 | Implement 12 D0-D8 contracts, four independent packs, and one acquisition trial |
| Release, product experience, and Jira | 9 | Promote the candidate, close JT-TC01-TC07, run staging, and prove repeated rollback |
| Memory | 5 | Implement authority, retrieval, ingestion, encryption/deletion, and portable sync |
| Secret lifecycle | 6 | Close ECR TC05 and TC07-TC11 through synthetic qualification |
| Provider measurement | 4 | Run Host, Domain, and Release/Jira A/B trials and qualify one default-off route |

Linux is a cross-cutting focus on 15 of the items. It includes the HP runtime
contracts that depend on Linux behavior, the transactional host installer, and
explicit native Linux/WSL2 distribution, privileged-backend, and lifecycle
qualification. Linux focus does not replace macOS, Windows, OpenCode, MCP, or
second-host coverage.

## What holds the runtime at Advanced

1. **Release reach is not yet live-qualified.** The product-experience
   candidate is present in the working tree, but exact promotion, installation,
   staging execution, failure injection, rollback, and repeat evidence remain.
2. **Host architecture exceeds executable host proof.** HP and HB designs exist,
   but the runtime still needs executable schemas, broker boundaries, installer
   behavior, truthful capabilities, OpenCode conformance, a second-host proof,
   and real Linux lifecycle evidence.
3. **Domain breadth is designed but not delivered as independently reversible
   packs.** Catalog, identity, policy binding, evidence, activation, budgets,
   evaluation, and trusted-time contracts must run before packs can qualify.
4. **Jira tracking needs independent closure beyond successful seeding.** Live
   issue creation works, but JT-TC01 through JT-TC07 retain their own adversarial,
   workflow, version, migration, packaging, and integrated-gate obligations.
5. **Memory and secrets are not production runtime capabilities.** The five
   Memory slices and six secret-lifecycle items require implementation,
   non-resurrection behavior, custody boundaries, synthetic adversarial trials,
   and portable evidence.
6. **Efficiency evidence is offline.** KCRP cannot become a default provider
   route until provider A/B trials preserve required findings, decisions,
   security, and mandatory records.

## Execution started

The first focused implementation item is `KSTK-7`, JT-TC03 Jira mapping. During
roadmap synchronization, KStack found that exact Jira issue adoption compared
ADF documents using order-sensitive JSON serialization. Atlassian returned the
same document with object members in a different order, producing a false
drift result after a successful create.

The runtime now compares provider-returned structured fields with semantic deep
equality while preserving array order and exact values. A regression fixture
reorders the ADF members. The Jira tracking suite passes 30/30 tests, and the
item has durable `ITEM_ACTIVE`, `BUG_FOUND`, `BUG_FIXED`, and
`IMPLEMENTATION_VALIDATED` records projected to `KSTK-7`. It is not marked done:
independent closure and the remaining JT-TC03 obligations still apply.

## Focus order

1. Independently close JT-TC03 and then JT-TC01, JT-TC04, JT-TC05, JT-TC06,
   and JT-TC07 so backlog execution has a trustworthy live ledger.
2. Promote and install the exact product-experience candidate, then run its
   authorized staging and rollback qualification.
3. Execute the Linux-first Host tranche: HP-TC01/02/03, HB-TC02, the distro
   matrix, privileged backends, and install/upgrade/rollback qualification.
4. Build the Domain enabling spine: D0, D1, D2-F1/F2/F3, D5-F1/F2, and D6,
   followed by the release-operations and product-experience packs.
5. Work Memory and secret lifecycle in parallel only where their evidence and
   authority boundaries remain independent.
6. Run provider measurement after the representative Host, Domain, and
   Release/Jira packets are stable; keep every new route default-off until it
   passes qualification.

## Authority still required

Jira issue creation was explicitly authorized and completed. Repository commit,
active-runtime installation, device installation, external staging deployment,
production policy changes, and use of real secrets remain separate authority
gates. Local implementation and tests may continue without treating those
mutations as implicitly approved.

## Secret/password scope

No real password or secret is currently being implemented, imported, migrated,
or stored by a KStack Secret Broker. The planned capability is not a general
password manager and will not expose a `get secret` operation to a model.

The current design candidate is a provider-neutral opaque-handle broker. A
model would select an approved handle and a registered target operation; a
separate protected worker would resolve the value, perform only that operation,
reject value-bearing output, and emit a content-free receipt. Qualification
must use synthetic credentials before any production credential is admitted.

The provisional backend portfolio is:

- developer cells: Windows Credential Manager/DPAPI, macOS Keychain, and Linux
  Secret Service, each qualified independently;
- production/self-hosted cell: OpenBao through a version-pinned protected
  adapter and qualified workload identity or auto-auth path;
- no plaintext-file, ordinary environment-variable, arbitrary-shell, direct
  model read, or silent fallback path.

This portfolio is not closed or implemented. Secret Broker SB-TC01 remains a
review-required design with a confirmed audit-admission defect, and SB-TC02
through SB-TC12 remain open and untested. The six focused Jira entries are the
execution backlog, not evidence of a working secret runtime.

The Jira API token supplied in the external `Jira.txt` file was used only to
authenticate the explicitly authorized Jira issue creation. It was not imported
into a broker, committed to this repository, or selected as the first broker
credential. The first synthetic credential and exact registered operation still
need to be selected and frozen as part of the Secret Broker design.

## Evidence

- Focused roadmap: `.kstack/roadmaps/runtime-maturity-focused-2026-08-28.json`
- Jira configuration: `.kstack/config.json`
- Runtime fix: `plugins/kstack/scripts/kstack-jira-tracking.mjs`
- Regression coverage: `tests/jira-tracking.test.mjs`
