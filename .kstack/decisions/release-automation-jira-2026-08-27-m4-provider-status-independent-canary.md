# Release M4 round 4 — deterministic peer-offset encoding

**Item:** `M4-PROVIDER-STATUS-INDEPENDENT-CANARY`
**Round:** 4
**Mode:** single concrete bug fix
**Review route:** Codex only; no Opus

This packet composes after M4 round digests
`102cebd2919338d5282810a5887cf4868331dbb5c521c0772d518ce448c2dc2c`,
`ac28589d119230ded16cbbaf4847763eda9c55227c6010b59298e79b9d2bb80f`,
and `200fca7c2a5d90813d525464be1c08d590c5d357868f0a955e8ee8e099435d83`.
It fixes only review digest
`b80bc6df93d6a63d9c9ba63b4683f6dde748cec2d9d9dc937aa182cbad76d4db`.

Replace the offset preimage with the UTF-8 bytes of the JCS-canonical array:

```json
["kstack-canary-peer-offset-v1","<64-lowercase-hex-plan-digest>","<observation-window-id>"]
```

`observation-window-id` is a canonical UUID string. Hash the exact bytes with
SHA-256, interpret digest bytes 0 through 7 as one unsigned 64-bit **big-endian**
integer, and reduce modulo `N`. Selection remains
`(offset + sampleOrdinal - 1) mod N` over the canonical sorted address set.

Fixtures pin the exact JCS bytes, SHA-256 digest, big-endian integer, offset,
and selected index for N=1, 2, 5, and 16 across Node, native Linux, and the
portable reference implementation. Little-endian, delimiter-free, uppercase
digest, noncanonical UUID, and zero-based ordinal mutants must fail.

Closure requires Codex at least 93 with zero failed checks, security findings,
dissent, and unresolved M4 questions. All frozen boundaries remain unchanged;
no Opus or implementation is authorized.
