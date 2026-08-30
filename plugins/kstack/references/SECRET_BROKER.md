# KStack Secret Broker contract

The Secret Broker exposes safe metadata and opaque handles. It has no value
read, reveal, export, render, template, arbitrary-shell, arbitrary-URL, or
generic environment-injection operation.

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

The first development cell is Windows current-user DPAPI custody. Its claim is
limited to the logged-in Windows user boundary; it does not claim protection
from that user's compromised processes, administrator, kernel, or debugger.
The first target adapter is a bounded Jira Cloud authentication check. It may
send the admitted credential only to the pre-bound Jira origin, discards the
response body, and emits only a fixed status receipt.

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
For automated or unattended Jira/Atlassian operations, prefer a static
credential enrolled through the DPAPI custody cell and a target-bound adapter
over dependence on an interactive OAuth connector.
