# OpenClaw `v2026.7.1-2` ACP boundary citations — 2026-08-30

This record pins the three ACP boundary facts used by KStack's negative
qualification to the exact accepted OpenClaw source identity. It is evidence
for an unsupported disposition only; it does not activate OpenClaw.

## Source identity

| Field | Value |
|---|---|
| Repository | `https://github.com/openclaw/openclaw.git` |
| Annotated tag | `v2026.7.1-2` |
| Tag object | `be8b8a9e8838f832e4fa47cde8bea0a33aec71ba` |
| Commit | `0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c` |
| Documentation file | `docs/tools/acp-agents.md` |
| Documentation SHA-256 | `68f5a5588710bea3027583bf06587706eb476d3ad1a31b0ef798586fcb895aa9` |
| Runtime-policy source | `src/agents/acp-spawn.ts` |
| Runtime-policy source SHA-256 | `dc401b6b4d89dce33322b05e0f2097304a974a3cc4e3d95bdd6a0f666e9e3842` |
| Runtime-policy test | `src/agents/acp-spawn.test.ts` |
| Runtime-policy test SHA-256 | `92e771d44a0da201bb34a64bc4f21f15cf57cd360fe02a0c64d56704d608e84b` |

The checkout reported the exact tag and commit above before the file digests
and line locations were measured.

## Pinned findings

1. **ACP harness execution is not wrapped by the OpenClaw sandbox.**
   `docs/tools/acp-agents.md:731-744` states that ACP sessions execute on the
   host runtime and identifies the external harness's own CLI permissions and
   selected working directory as the effective boundary. The implementation
   independently encodes that fact in
   `src/agents/acp-spawn.ts:236-254` by rejecting ACP spawn from a sandboxed
   requester because the ACP runtime is host-side.
2. **Required OpenClaw sandboxing is incompatible with ACP spawn.**
   `docs/tools/acp-agents.md:746-750` records that
   `sessions_spawn(runtime="acp")` does not support `sandbox="require"`.
   `src/agents/acp-spawn.ts:251-253` returns the corresponding policy error,
   and `src/agents/acp-spawn.test.ts:2576-2590` proves rejection occurs before
   gateway dispatch or session initialization.
3. **Disabling automatic ACP dispatch does not disable explicit spawn.**
   `docs/tools/acp-agents.md:207-214` distinguishes automatic thread dispatch
   from explicit `sessions_spawn({ runtime: "acp" })`: setting
   `acp.dispatch.enabled=false` pauses the former while leaving the latter
   callable.

## KStack disposition

These facts require an external sandbox and external launcher mediation for
any delegated OpenClaw cell. The candidate's host sandbox and host-config
delegation controls therefore remain admission-blocking. The source citations
do not claim that OpenClaw is wholly unsafe, and a later exact stable release
may be requalified.
