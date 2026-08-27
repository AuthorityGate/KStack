# Owner decision: domain-breadth content acquisition

**Thread:** `domain-breadth-option-selection-2026-08-26`  
**Decision:** `DB-OPT-Q1`  
**Decision date:** 2026-08-26  
**Status:** `LOCKED-YES-OPTION-B`  
**Owner answer:** `Yes`  
**Reviewed base brief SHA-256:**
`aa125e851d501e69351a3969d726b6ecfa84599d911ee23fa1a9db4441723ef7`  
**Normative round-2 addendum SHA-256:**
`e013b0b7b7a304255280a5279994f2ff5ff16647933161fadcd5de2f61bfae5d`  
**Codex option-review evidence SHA-256:**
`a46fdcb87c5ab23dbf6710021ef384a760d2940bdbee65cd695de835f5bd06d9`  
**Review result:** Codex 96 `APPROVE`; 0 failed checks, 0 security
findings, 0 material dissent, 0 unresolved questions; no Opus

## Full question shown to the owner

**Question DB-OPT-Q1:** Should KStack adopt Option B for a bounded trial: use
only exact-digest, v1-license-allowlisted external sources as offline source
corpora; translate selected non-executable material into governed KStack-native
packs; require the predeclared qualification gates above; and prohibit direct
runtime marketplace loading?

**Recommendation shown:** Yes, because the owner's stated priority is materially
faster domain breadth without surrendering KStack governance. The recommendation
is not robust to a policy that values maintenance and supply-chain minimization
more than reuse; under that policy, Option D is equally or more appropriate.

**If Yes:** design the offline acquisition contract and seven-file assurance
trial. No content is implemented or activated by this answer.

**If No:** use Option D and author pack content natively. External projects
remain research references only.

**If Comment:** narrow the v1 license allowlist, alter the exact seven-file
trial, or state that maintenance/security risk should outweigh reuse; do not
use a comment to authorize runtime marketplace loading or waive existing pack
gates.

**Blocked until answered:** the acquisition-pipeline design and
external-source translation. Existing native pack work retains its current
status.

**Selectable responses presented:** `Yes`, `No`, `Comment`.

## Verbatim owner answer

`Yes`

## Locked answer mapping and readback

`DB-OPT-Q1 / Adopt reviewed Option B for the bounded trial -> Yes`.

The owner locks the exact reviewed acquisition direction:

1. External material is input only as an offline corpus whose repository,
   commit, path, bytes, digest, detected license, obligations, and notices are
   recorded before translation.
2. V1 admits only `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`,
   and `CC0-1.0`, subject to file-level overrides, obligation preservation,
   and human provenance confirmation. Uncertain or non-allowlisted material
   falls back to native Option D for that source.
3. Only selected non-executable questions, checklists, templates, taxonomies,
   schemas, or fixtures may be translated. The output is a governed
   KStack-native pack, not an executable upstream skill or package.
4. Translation cannot waive the existing closed schema, deterministic
   composition, authority, evaluation, activation, rollback, provenance, or
   receipt gates. Qualification is prerequisite evidence, not activation.
5. Direct runtime marketplace, plugin, catalog, registry, network, MCP,
   instruction, hook, or script loading from an external source is prohibited.
6. Every source-set change, changed byte, new file, new dependency, new
   license, or new domain requires a new immutable source-set digest and the
   applicable requalification. There is no directory-glob or mutable-catalog
   admission path.
7. A failed or inconclusive trial remains unqualified and selects native
   Option D for that content unless a new owner-approved, preregistered trial
   is reviewed before new results are visible.

## Preserved architecture and authority boundaries

- D0 remains `VALIDATED`: the closed declarative catalog and four-pack roadmap
  remain the runtime architecture. This Option B is only a subordinate content
  acquisition strategy and does not replace or reopen D0.
- D9 remains `VALIDATED`: `release-operations` remains analysis-only. Imported
  or translated content cannot add release mutation or execution authority.
- Round-one Q1 remains `UNRESOLVED`; this decision does not select or infer an
  authenticated out-of-band identity or separation-of-duty boundary.
- D1 through D8 and D10 retain their existing ledger states. This acquisition
  choice does not validate, repair, activate, or unblock them.
- Review gridlock remains blocking. Neither a marketplace nor an external
  model or project receives a deciding vote or authority through this record.

## Later bounded trial scope

The only admitted first-trial source set is these seven exact path/digest pairs
from `garrytan/gstack@ad8400543cd9ce8d07641362db48d44a95417e33`,
subject to the reviewed root MIT license digest
`e56fbb5b3d95756f3fa1cfefa24732ec79f18ece1ad08a4e79e00df57e8b198c`
and rejection of any later-discovered overriding terms:

| Source path | SHA-256 |
|---|---|
| `review/specialists/api-contract.md` | `263d23ac119dd601d315c191dbdbd503d47c00264c9c0ca81959559ca11d4e95` |
| `review/specialists/data-migration.md` | `b6fd9eb229002ea598f8fe9ff53b1cd8821e3bd37a7aa7b07b5526556c71ebca` |
| `review/specialists/maintainability.md` | `7d945a69e0763fd1be26ffdff65f1088cab555d80630ed4ad44313e5e6623036` |
| `review/specialists/performance.md` | `545c294ae53638b4c8524e8cde08246a4ce3b5c287ec7c44e27f5556a3b0e8cc` |
| `review/specialists/red-team.md` | `9ea05149f5b13d6a19ecec26285142d09d259cf80a515af828abdd1f43320427` |
| `review/specialists/security.md` | `d0dc1cf0f1c7450507cfc663a67624cbcd5d4cfd0258a3bfeb51dba6f09c7df2` |
| `review/specialists/testing.md` | `3fd6dc5d802fd112f75934c4c168c3f03e25275b70e1e403eb670cbf7447e4e7` |

Before any translation, the later trial must preregister the corpus digest,
estimands, exclusions, adjudication guide, multiplicity method, and sample-size
calculation. It must use the reviewed paired, blinded evaluation with at least
200 independently authored assurance cases, 80% power, two-sided alpha 0.05,
independent domain-qualified adjudicator agreement, and all seven frozen gates:
provenance/structure, incremental recall, unsupported findings, duplicates,
base-lane regression, budget, and deterministic isolation/rollback.

This paragraph records later design scope only. It does not start the trial,
approve a corpus, translate content, or claim that any gate has passed.

## No-authority boundary

This record locks an architecture choice only. It does not authorize product or
skill/runtime code changes, copying or translating source bytes, dependency or
plugin installation, marketplace access, network acquisition, credential use,
evaluation execution, pack activation, external mutation, commit, push,
deployment, publication, report changes, or any change to the D0/D9 or Q1
boundaries.

Any change to the v1 allowlist, seven-file source set, direct-runtime
prohibition, qualification gates, or preserved boundaries requires a new
linked owner decision. Do not edit this locked record in place after integrity
review.
