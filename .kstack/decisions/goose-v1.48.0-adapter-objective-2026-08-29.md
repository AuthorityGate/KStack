# Goose `v1.48.0` adapter objective and ownership disposition — 2026-08-29

**Jira item:** `hb-tc09-goose-host` / `KSTK-84`  
**Status:** primary objective/design and bounded implementation at or above the
KStack 93 threshold; independent final review and host admission remain open  
**Selected first profile:** `goose.advisory-public-read.v1`  
**Disposition:** `COMPOSE-INTERNAL-PLUS-ADAPT`; Goose supplies a native CLI,
project skill discovery, and provider protocol while KStack retains every
policy, authority, eligibility, credential, retry, evidence, and release
decision

## Objective boundary

Prove that the exact remediated Goose `v1.48.0` binary can serve as a materially
different, thin host adapter for one bounded advisory/public-read profile. The
initial profile may discover one project-local `.agents/skills` projection and
execute native `version`, `run --help`, `skills list`, and deterministic
advisory operations. It may not activate Goose extensions, native tools,
recipes, plugins, MCP, subagents, scheduler/background work, update paths,
persistent resumable sessions, or direct provider credentials.

Success here is not general Goose support and does not satisfy HB-TC06 by
itself. The common KStack contract remains host-neutral, OpenCode evidence is
not reusable as Goose evidence, and the independent review/admission decision
must evaluate the final integrated bytes.

## Content-addressed primary-source ledger

The source observations below bind the exact reconstructed and remediated tree
whose manifest SHA-256 is
`0d2cb9b14a970aae67c27a9a2d1db2eaca12ce2e5b082e8441413de7bb240234`.
Paths are relative to the Goose source root. These hashes are evidence inputs,
not an incorporation of upstream source into KStack.

| Primary source | SHA-256 | Mechanism observed |
|---|---|---|
| `crates/goose-cli/src/cli.rs` | `f103e7f0c97dab2c7f68b2135645133a12615948c2762782a47ff4330694e0cb` | native commands and flags, skills/plugin/update/MCP/scheduler surfaces |
| `crates/goose-cli/src/session/builder.rs` | `84365e7becc26429b1194098909dd5b00c1898f02fa55f472b1eb156f87cc620` | run/session/profile/extension/output construction |
| `crates/goose-cli/src/commands/recipe.rs` | `e06c006eb8adfa21e4a83233380baabb2cdfa5a0203f19fe82f26a64897fba3b` | recipe CLI behavior |
| `crates/goose/src/skills/mod.rs` | `6a59c9e9ebbf4553cdd8195347757be9e5e13a587b07f035775cb69c3f886a1b` | project and user skill discovery |
| `crates/goose/src/config/paths.rs` | `5df20511b6b564b58fc38a7d5ce842aedb5922d68905d6d0db64f7acf4ebe4b8` | `GOOSE_PATH_ROOT` and project/user paths |
| `crates/goose/src/config/extensions.rs` | `8e8668b532c0e0702dd8678c36d9a76ac212dbf342e4c471b93a93b2e3204486` | extension configuration |
| `crates/goose/src/config/permission.rs` | `3d327892558897b63dae724f0e186040b11785afbf8ecc4176046bedeef0ab30` | native permission configuration |
| `crates/goose/src/providers/provider_secrets.rs` | `c627dedaae48def42765dbbe05d0f2a814d4908fbd0809a8b17a988ab8431a69` | native provider-secret handling |
| `crates/goose-providers/src/openai.rs` | `dc5c14d4ffcc8571aa459e161f5bec7a1c69e507e3c0e89ffcfdc62ce4fb4e00` | OpenAI-compatible host/base-path protocol |
| `crates/goose/src/agents/subagent_handler.rs` | `f41e36a3f1128ce458f6f466799ccb9b685a25ad91b14c289d5024ad5eb08905` | native subagent execution |
| `crates/goose/src/scheduler.rs` | `ec66a280e319dc22596fdfd61704bf6552843a9e9af9c5390fa53e464c6a6473` | scheduler/background lifecycle |
| `crates/goose/src/plugins/discovery.rs` | `5317f9244ccb1ad9e6d3f671910e33e1fc50177313ea5d621ba49d3498490b28` | project/user plugin discovery and enablement |
| `crates/goose/src/recipe/mod.rs` | `95887d76180a1f9b2277eafd97afda9058709fb99bcbc2f17828a3e03a08880d` | recipe loading and composition |
| `crates/goose/src/agents/extension_manager.rs` | `5a69f9dbfb998bbf3ab25448b837538e38af787f8eb108fb8c4f0f09f535842c` | extension lifecycle |
| `documentation/docs/guides/context-engineering/using-skills.md` | `f521f1fedeb5720c3664b064620ea51faa8fa77407f430bef89050eb405b66c3` | documented skill locations and behavior |
| `documentation/docs/guides/goose-cli-commands.md` | `cf7cc878cc3a5b64a03da0c980cb95dbdffe2fb3d31b31387d396124854b3569` | documented command surface |
| `documentation/docs/tutorials/headless-goose.md` | `7f86e8f82a4cb6414cfe1087386eaf92d2ce549f41885237dd7462c89da7ab9f` | documented headless execution |
| `documentation/docs/tutorials/subagents.md` | `9ceac93ffdf2f58aea9905e8529a49348e4a5c341be8d59dc03939a850c6aeb8` | documented subagent surface |

Source code controls when documentation and behavior differ. The actual
isolated run also records a native title-generation request before the
advisory request and ephemeral session/log files beneath the disposable
`GOOSE_PATH_ROOT`, even with `--no-session`. Those facts narrow the claim and
are not treated as retries or durable KStack state.

## Reuse-first classification

| Goose mechanism | Decision | Initial-profile use and boundary |
|---|---|---|
| Project `.agents/skills` discovery | `ADAPT` | Project-local KStack instructions may be discovered, but the projection is closed-schema and cannot carry authority, policy, eligibility, retry, or secret fields. |
| CLI `run`, JSON output, `--quiet`, `--no-session`, `--no-profile` | `ADOPT` + `COMPOSE` | Use the native process surface inside KStack containment; KStack binds exact arguments, environment, binary digest, deadlines, output schema, and evidence. |
| `GOOSE_PATH_ROOT` workspace isolation | `ADAPT` | Redirect all Goose-owned transient state to a disposable root; repository root must remain byte-identical. `--no-session` is not claimed to prevent every ephemeral database/log write. |
| OpenAI-compatible provider protocol | `ADAPT` | Qualification uses only a deterministic loopback provider with no credential. A later real provider must route through the protected KStack broker and requires separate authorization/evidence. |
| Native permission system | `ADAPT` display-only | Goose may render or emit a native approval artifact. It cannot grant KStack authority or replace the KStack approval/broker decision. |
| Process events, structured output, cancellation | `ADAPT` observe-only | The adapter hashes and observes native facts; KStack owns terminal status, evidence eligibility, cancellation policy, and retry decisions. |
| Recipes | `REJECT` | Not loaded or treated as KStack plans/instructions in the initial profile. |
| Extensions and native tools | `REJECT` | Empty inventory; no stdio/HTTP extension, bundled tool, or direct-tool path is admitted. |
| MCP | `REJECT` | No Goose MCP endpoint or extension participates in the first profile. Any later facade must pass the separate KStack MCP boundary. |
| Providers with direct credentials | `REJECT` | No provider secret enters Goose or its environment. KStack broker owns credential custody and release. |
| Subagents | `REJECT` | No nested Goose agent execution; KStack review routing remains independent. |
| Scheduler/background execution | `REJECT` | No scheduler, detached task, watcher, or resumed background authority. |
| Plugins | `REJECT` | Project/user plugin discovery is outside the selected projection and must remain absent. |
| Native session persistence/resume | `REJECT` | No resumable user session. Ephemeral files in the disposable root are destroyed with the cell and are not evidence of admitted persistence. |
| Self-update/install | `REJECT` | The adapter cannot download, update, replace, or install Goose. Exact binary/source admission stays with KStack. |
| Goose policy, memory, retry, eligibility, release authority | `REJECT` | No ownership transfer and no lowest-common-denominator change to the common host contract. |

No upstream bytes are copied into the adapter. KStack builds only the minimum
closed-schema bridge needed to compose these accepted native surfaces.

## Semantic ownership and conflict map

| Concern | Goose-native fact | KStack owner and conflict resolution |
|---|---|---|
| Approval | Goose can expose native permission behavior. | KStack is sole authority owner; native approval is display-only and `grantsAuthority` is always false. Double approval cannot create permission. |
| Retry/turn behavior | Goose may make internal model requests; the qualified advisory produced one title request and one task request. | KStack classifies both requests by observation and permits no adapter retry field. Any unregistered additional request fails the provider-shape check. |
| Memory/session | Goose writes transient session/log material even with the selected flags. | KStack supplies a disposable path root, forbids resume/persistence, and requires repository equality. No Goose state becomes KStack memory. |
| Provider and credential | Goose implements provider clients and native secret handling. | Initial execution is credential-free loopback. Protected KStack broker remains sole future credential-release owner; direct provider secrets are rejected. |
| Tools/extensions/MCP | Goose can load broad native capabilities. | Empty native-tool/extension inventory and no MCP. Any later surface is a new objective and qualification, never inherited. |
| Policy/eligibility | Goose reports native results. | KStack alone computes allow/deny, eligibility, support tier, terminal status, evidence admission, and release state. |
| Process/cancel | Goose owns its child process mechanics. | KStack supplies containment, deadline, resource caps, cancellation request, orphan check, and immutable observations. |
| Output | Goose produces text/JSON and logs. | KStack rejects terminal escapes and credential patterns, stores only content digests in protected evidence, and does not ingest disposable raw provider logs. |

## Adapter contract and negative cases

The dedicated adapter exports exactly the nine `HostAdapterBoundaryV1` ports:
`bindHostInstance`, `bindRepositoryContext`,
`discoverInstructionProjection`, `observeNativeAction`,
`requestNativeApprovalDisplay`, `routeProtectedBroker`,
`observeProcessLifecycle`, `observeStructuredOutput`, and
`observeCancellation`. The common host contract contains no Goose branch.

The implementation must fail closed for each of these cases:

1. wrong or non-executable Goose binary, mismatched SHA-256, unsupported host
   version, malformed descriptor, or an extra port;
2. non-absolute/non-normalized roots, open-schema operations, unsupported
   action, missing advisory broker ticket, or unexpected ticket on a public
   operation;
3. non-loopback provider endpoint, credential-bearing environment, direct
   provider class, native extension/tool/profile/session request, or update;
4. projection/event/output fields that attempt to carry KStack authority,
   policy, eligibility, retry, support tier, terminal status, tokens, or
   secrets;
5. nonzero exit, signal, timeout, missing marker, malformed advisory JSON,
   unexpected provider request count, provider request on a public operation,
   or missing provider digest;
6. non-loopback interface, repository mutation, orphan process, unexpected
   cancellation, terminal-control bytes, NULs, oversized output, or detected
   credential material; and
7. any attempt to substitute OpenCode evidence, synthetic unit results, or a
   prior Goose build for the exact per-operation Goose evidence.

## Promotion and rollback

The adapter and its projection remain candidate-only. Promotion requires the
exact current integrated packet to pass independent final review, protected
per-operation evidence binding, host eligibility/admission, preservation
checks for Codex/Claude/OpenCode, and every HB-TC06 predecessor. A failed gate
removes or disables only the Goose candidate adapter/projection and evidence;
it does not change the common contract or other hosts.

The maximum current claim is therefore one exact Goose `v1.48.0` binary
executing a credential-free, loopback-only advisory/public-read qualification
profile under KStack observation and containment. Real provider use, protected
broker use, broad tools, host support, and final release remain unclaimed.
