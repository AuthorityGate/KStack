# OpenCode v1.18.25 isolated native-skill qualification

**Outcome:** PASS — real pinned binary, paired causal discovery only  
**Claim ceiling:** `NO_OPERATION_QUALIFICATION`  
**HB use:** stable executed predecessor evidence for HB-TC05; not HB-TC05 closure

## Exact subject

- Official repository: `https://github.com/anomalyco/opencode`
- Release tag: `v1.18.25`
- Release asset SHA-256:
  `58a3729a6f3432dd6d2917fcc4a949788891a035818646ad480e12c947f56e78`
- Extracted binary SHA-256:
  `d91e0d33676d0839f7cde87924cd4127ea88c9d6784eea9f009a7d08bdc60eeb`
- ELF build ID: `c30f169b1bef81fa57467cd091ba53aab5235468`
- Source archive SHA-256:
  `44e9530d7be172005c7d60aef317440eecb85d557d94cce7fa35c5a7b9d9da0b`
- Tag-ref object `cb7d8b2f5e44876ef98b661dc10590c915af3a9f` is unsigned.
- Target commit `733562e92a96255fb123aae92f267e4534a635fb` has GitHub verification
  state `valid`. This evidence does not call the release tag signed.

The normalized provenance is
[`opencode-v1.18.25-provenance.json`](./opencode-v1.18.25-provenance.json).

## Executed causal protocol

The protected harness generated independent random 256-bit treatment and
control values and committed both values plus randomized order before render.
The two skill renders differed only in the closed inert observation clause.
Each variant used a fresh disposable repository, HOME, XDG state root, and
OpenCode session.

The generic prompt contained neither value. The loopback provider also had no
advance value input. Its first response requested OpenCode's native `skill`
tool. It could derive a value only from the native tool result in the second
request. Each session produced exactly:

1. `BEFORE_NATIVE_SKILL_RESULT`, with zero challenge values;
2. `AFTER_NATIVE_SKILL_RESULT`, with one tool-result value; and
3. the exact variant value as the sole completed text output.

The committed evidence contains two different session identities, two output
receipts, four provider requests, exact native event sequences, unchanged
repository bytes during discovery and each model run, and a preprovisioned
exact OpenCode `.opencode/.gitignore` state file.

Both discovery and advisory execution passed through the dedicated nine-port
`HostAdapterBoundaryV1` OpenCode adapter. The adapter is byte-bound in the cell,
uses only the registered instruction-only advisory profile, constructs the
deny-by-default credential-free invocation, and independently normalizes the
native events, provider phases, repository measurements, and lifecycle result.

## Isolation and independent observations

- User, network, mount, and PID namespaces were fresh.
- The namespace exposed only `lo`; the provider listened on loopback.
- The subject environment was an explicit credential-free allowlist.
- OpenCode ran with `--pure`, update/model fetch disabled, and native permission
  `{ "*": "deny", "skill": "allow" }`.
- `no_new_privs` and an empty inheritable, ambient, and bounding capability set
  were enforced with CPU, address-space, process/thread, and descriptor limits.
- A compiled, source-bound PID-1 reaper retained a strict zero-orphan gate.
- No production credential, provider, endpoint, repository, or target was used.

## Evidence and replay

- Cell evidence digest:
  `sha256:52ce535adcfde0165e6ebf9538eed4319848e7ba715fa0f6f1d3dbda75ad8009`
- Discovery observation digest:
  `sha256:edd858831dc833b90ca269fce290108c1175e368b27f4d965e09078e7c2bc4b0`
- Variant-difference evidence digest:
  `sha256:4b6cf2f8d7d532bb102a04f03ba55e06cdbb7e6b4d9e10aeab805c2fb5eac1c7`
- Provenance semantic digest:
  `sha256:73d8f3fd8e11f86a363c14bada445b36ef806f816a5913b93841883ef82c7caf`

Evidence:
[`opencode-v1.18.25-isolated-cell-evidence.json`](./opencode-v1.18.25-isolated-cell-evidence.json)

Reproduce the isolated run:

```text
node .kstack/qualifications/run-opencode-v1.18.25-isolated-cell.mjs ABSOLUTE_OPENCODE_BINARY
```

Validate the checked evidence and all pinned local artifacts:

```text
node .kstack/qualifications/validate-opencode-v1.18.25-isolated-cell.mjs ABSOLUTE_ASSET_ARCHIVE ABSOLUTE_BINARY ABSOLUTE_SOURCE_ARCHIVE
```

The validator re-hashes the release asset, binary, exact source archive and
official source files; checks the live binary version and ELF build ID; binds
the exact candidate implementation and configuration; revalidates the closed
discovery observation; and requires the causal, isolation, preservation, and
zero-orphan invariants.

## Remaining gate

This result proves real OpenCode v1.18.25 instruction discovery/load and an
advisory response through the native skill tool. It does not qualify an
operation profile, write, approval, credential, external, background, MCP,
Jira, provider, commit, release, or deployment capability. HB-TC05 still needs
the protected per-operation adapter and the complete positive/negative fixture
set; HB-TC06 still needs a distinct two-host OpenCode+Goose evidence set.
