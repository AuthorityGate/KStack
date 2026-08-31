# KStack Secret Broker contract

The Secret Broker exposes safe metadata and opaque handles. It has no value
read, reveal, export, render, template, arbitrary-shell, arbitrary-URL, or
generic environment-injection operation.

## Current implementation fence

The accepted design is machine-bound, but the current implementation is not
conformant. `kstack-secret-broker.mjs status` therefore reports exactly
`UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`. Windows and Linux worker entry
points fail before probing custody, changing state, resolving a value, or
contacting a target. Inventory validation and content-free planning remain
available, but every plan item is `UNAVAILABLE`; a caller-declared qualified
cell is explicitly non-authoritative. The fence may be narrowed only by a later
reviewed implementation item on the accepted design set.

## Evidence levels

- `DISCOVERED`: a backend or adapter is present; no use claim.
- `CONFIGURED`: safe metadata and identity binding validate.
- `SYNTHETIC_QUALIFIED`: lifecycle and leakage fixtures pass using generated
  non-production values.
- `PILOT_VALIDATED`: one owner-authorized real entry completes target-bound use,
  rotation, recovery, and rollback with its source retained.
- `PRODUCTION_APPROVED`: the exact backend/platform/adapter cell has independent
  review, operational ownership, monitoring, and promotion approval.

No level can be inferred from another platform, backend, adapter, or target.

## Migration definition

Enrollment is not migration completion. A migration is complete only when the
destination record is read back, the intended target operation succeeds, a
replacement generation succeeds, recovery is proven, the observation window
passes, the source is separately retired, and non-resurrection checks pass.
Unknown target or provider outcomes remain ambiguous and block retry.

## Initial cells

Windows current-user DPAPI custody remains experimental generic broker work.
Its claim is limited to the logged-in Windows user boundary; it does not claim
protection from that user's compromised processes, administrator, kernel, or
debugger. Its Jira adapter is retired and must not be used to create a second
Jira credential path.

Linux has a separate desktop Secret Service implementation cell. It uses the
fixed `/usr/bin/secret-tool` interface in the logged-in D-Bus session, stores
only safe handle metadata in private Linux state, but its entry point is fenced
`UNAVAILABLE` before backend contact. After the global implementation fence is
replaced by reviewed controls, the cell still remains unqualified until the
real backend lifecycle and adapter qualification run in that exact session.
Headless Linux and WSL without an admitted Secret Service provider fail closed.
This optional cell does not replace or migrate an already enrolled repository
Jira source.

The KStack repository's Jira credential and executor remain solely in WSL at
the source enrolled by `.kstack/config.json`. Native Windows Jira work uses the
closed `kstack-jira-wsl.ps1` handoff to that WSL executor; credential bytes
never cross into Windows. Qualification does not transfer between Windows,
Linux desktop, and WSL.

OpenBao is the provisional production/self-hosted cell. It remains unavailable
until its version, workload identity or auto-auth bootstrap, namespace, policy,
audit admission, deadlines, ambiguity behavior, and recovery ownership are
independently qualified. There is no fallback from OpenBao to a local file or
development backend.

## Inventory boundary

Inventory entries contain purpose, credential kind, environment class, target
label, custody family, desired backend, adapter ID, rotation intent, and source
retention policy. They contain no value, path, endpoint, account, username,
tenant, host name, provider response, or free-form notes.

The source itself is opaque, including its apparent format. A request to learn
field names, delimiters, line counts, key count, or other structure is still a
source read and is forbidden through model-facing or generic tools. Only an
independently reviewed exact-format importer may consume an existing source;
otherwise the owner creates a replacement credential and enters it directly at
the trusted no-echo enrollment prompt. Any value emitted to a model-visible
channel is compromised and must be rotated before enrollment or use.

## Operational notes

2026-08-29: In downstream KStack-managed AGILB under AuthorityGate, an owner-
directed model-facing read of a plaintext credential file exposed an Atlassian
API token to model context. The value was treated as compromised and required
rotation before enrollment or use; it was neither enrolled nor reused. Even
when an owner says to "look at" or "use" a credential file, the implementer or
orchestrator must keep it opaque and redirect to the broker's no-echo enrollment
prompt.

Hosted account-level OAuth MCP connectors, including Jira/Atlassian connectors
authorized through interactive `/mcp`, have not reliably retained authorization
across sessions in this environment and have required repeated manual re-auth.
For automated or unattended Jira/Atlassian operations, use the exact credential
source already enrolled by the repository. Do not infer that an interactive
OAuth connector outage requires a new platform credential. Linux Secret Service
is an interactive desktop development cell, not a headless or production
credential source.
