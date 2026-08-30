# Goose `v1.48.0` adapter and isolated execution qualification — 2026-08-29

**Jira item:** `hb-tc09-goose-host` / `KSTK-84`  
**Outcome:** `BOUNDED_ADAPTER_ISOLATED_EXECUTION_PASS_REVIEW_REQUIRED`  
**Maximum claim:** the exact reproducibly rebuilt Goose Linux binary executes
four native operations through the dedicated KStack adapter in a
credential-free, loopback-only disposable namespace without repository
mutation or orphaned processes; this is not general Goose support, a real
provider qualification, HB-TC06 closure, host admission, or release approval

## Bound implementation and binary

| Artifact | SHA-256 |
|---|---|
| exact Goose `v1.48.0` Linux binary | `057a1788b48cc1452203920afd31eac274d5b9cb10026734d587e5db33885792` |
| `plugins/kstack/scripts/kstack-goose-adapter.mjs` | `d76661ee55db463c1909c43dd2837e190e652bfffe85d1d982e70ce7ebdcdab6` |
| `tests/goose-adapter.test.mjs` | `7593c44d3781ab92f2f14d02f99dc521c873a088fc85aa31876f2a86a705c213` |
| `goose-v1.48.0-synthetic-provider.mjs` | `7418381dbb53b05ed2ab628d55eb2f62865deb4defa6c0f31403604823b12676` |
| `goose-v1.48.0-isolated-cell-child.mjs` | `604dfa9e45d7f251886720fa54e040276fbef46b93d0393a627a1fc495786e29` |
| `run-goose-v1.48.0-isolated-cell.mjs` | `6f939a6032f63df7cfb021d6dc5482c2733e1bc0bb9348e10d9814eaa5040790` |
| `validate-goose-v1.48.0-isolated-cell.mjs` | `2f0023641c083fdf1c25c34057df14ab5021ffa159097b51b9adc26ad06c1303` |
| `goose-v1.48.0-isolated-cell-evidence.json` file bytes | `6a29dc289911290d7e5970a968ea34a64512c84797aed12c9dfa81c86d3fe812` |

The WSL resume removed the earlier disposable build directory. Reconstructing
the exact source, remediation patches, staged git dependencies, Rusty V8
archive, tool packages, and locked offline release build produced the same
253,305,256-byte binary SHA-256 and build ID as both prior independent builds.
The isolated runner rejects any different binary before execution.

## Dedicated adapter boundary

The adapter exposes exactly the nine `HostAdapterBoundaryV1` ports and a single
`goose.advisory-public-read.v1` profile. Its operation and port schemas are
closed. It verifies the binary digest, exact working roots and environment,
disallows native tools/extensions/profile/session persistence, restricts the
provider endpoint to `127.0.0.1`, rejects authority/policy/eligibility/retry/
secret fields, and rejects credential-shaped or terminal-control output.

The common host contract has no Goose-specific branch. Native approval is
display-only; native process/output/cancellation facts are observation inputs.
KStack retains policy, approval, eligibility, credential, retry, terminal
status, evidence, and release ownership.

## Containment cell

The outer runner uses Linux `unshare` with new user, network, mount, and PID
namespaces plus a fresh `/proc`. Only loopback is raised. The child invokes the
exact Goose binary through `prlimit` and `setpriv` with:

- CPU, address-space, process, and file-descriptor limits;
- `no_new_privs` and empty inheritable, ambient, and bounding capabilities;
- a disposable repository and `GOOSE_PATH_ROOT`;
- an exact minimal environment with telemetry disabled and no credential
  variable;
- no profile, no resumable session, quiet JSON advisory output, no extension,
  and no native tool; and
- a deterministic synthetic OpenAI-compatible provider bound only to a random
  `127.0.0.1` port inside the namespace.

The synthetic provider is a protocol fixture, not a second LLM and not a real
provider. It receives no credential and is killed before final evidence is
emitted. Raw request bodies, prompts, responses, and disposable provider logs
are not copied into the repository evidence.

## Per-operation result

| Native operation | Outcome | Provider requests | Marker | Repository mutation | Orphans |
|---|---|---:|---|---|---:|
| `goose --version` | `MATCH` | 0 | `1.48.0` | none | 0 |
| `goose run --help` | `MATCH` | 0 | native help marker | none | 0 |
| `goose skills list` | `MATCH` | 0 | project `kstack-advisory` skill | none | 0 |
| bounded `goose run` advisory | `MATCH` | 2 | structured `KSTACK_GOOSE_ADVISORY_OK` | none | 0 |

The advisory's two requests are distinct native actions: Goose first requests
a session title, then requests the bounded advisory response. They are not an
adapter retry. The adapter requires exactly this observed two-request shape;
any additional or missing request fails qualification.

The disposable repository digest was
`e35ba53df8baa8c3b06c57b577598beb33830f51ff9383c7f5edc2aa85c1aa0d`
before and after all four operations. The only visible network interface was
`lo`. Every operation observed zero orphaned processes.

Goose created ephemeral SQLite and log files below the disposable
`GOOSE_PATH_ROOT` despite `--no-session`. This result therefore proves
repository isolation and rejected resume/persistence, not that Goose performs
no transient writes. The path-root content digest is preserved in evidence,
and the entire root is outside the project.

## Durable evidence and validation

`goose-v1.48.0-isolated-cell-evidence.json` records:

- aggregate result `PASS`;
- internal canonical evidence digest
  `6d8627a5ba3c9051e733fd3176736c61fa3c83ef45d129fa66f8ccef5c35ae28`;
- exact binary digest, namespace interfaces, repository/path-root digests;
- four content-addressed operation, invocation, output, provider, mutation,
  and observation records; and
- two provider requests represented only by count and aggregate digest
  `ffb31737d6b0193ead27fe3f578b914b7100a3682ae88983c1bb8f975a4251c6`.

The internal digest covers the canonical record before its own digest field is
added; the file-byte SHA-256 covers the final serialized artifact. Both are
retained deliberately.

The standalone closed-schema validator recomputes every observation digest and
the internal aggregate digest, binds the exact binary and four-action order,
requires the title-plus-advisory provider shape, verifies repository equality,
loopback-only networking and zero orphans, and rejects extra/raw fields. It
passes the durable artifact. Focused adapter/second-host tests pass, including
positive validation and tamper/extra-field rejection. A bounded
credential-pattern scan of the adapter, runner, child, synthetic provider, and
durable evidence found no credential value or raw provider body. The evidence
contains the qualification marker and broker-ticket digest, never a broker
credential.

## Remaining non-claims and gates

This closes only the dedicated-adapter and credential-free isolated-execution
portions of KSTK-84. It does not prove a protected real-provider broker path,
the complete HB-TC05/HB-TC06 conformance profile, stable OpenCode predecessor
qualification, provider-token/cost/quality evidence, broader Goose features,
or production support. Independent remediation/threat-model review, current
integrated final review, protected distinct Goose evidence for any larger
profile, KStack eligibility, and owner admission remain required.
