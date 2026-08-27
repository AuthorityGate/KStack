# Memory maturity immutable source ledger

**Decision:** `MEM-Q-OPTION-001`  
**Evidence date:** 2026-08-26  
**Scope:** non-Ollama source and license reproduction only

Git blob IDs came from the GitHub Contents API at the fully bound commit; raw
SHA-256 was independently calculated over each immutable raw response. A future
consumer must reproduce the repository commit, path, blob, byte count, and
SHA-256 before adapting code. A mismatch blocks reuse rather than silently
selecting `HEAD`.

## Frozen gstack/gbrain source

The inspected checkout is `/tmp/gstack-reuse-audit-20260826`, origin
`https://github.com/garrytan/gstack.git`, commit
`ad8400543cd9ce8d07641362db48d44a95417e33`.

| Path | Bytes | Git blob | Raw SHA-256 | Claim bounded |
|---|---:|---|---|---|
| `LICENSE` | 1,066 | `35029511144443297cad2d26e4bac17d0e352f93` | `e56fbb5b3d95756f3fa1cfefa24732ec79f18ece1ad08a4e79e00df57e8b198c` | MIT text. |
| `hosts/gbrain.ts` | 1,026 | `32dfaa349ef5f67b9f5f642e2c979c63ee79e1ea` | `e687af8823cb16d384174e14f680dc1ef1bf7be2fd40108f3c542e78c285eb70` | Host integration and checkpoint stages. |
| `setup-gbrain/SKILL.md` | 96,636 | `327184b08ef1ef7b039ab22f8b174f2ed8c4c925` | `f3c81f0061523c0f0557880dffe999f89d25438b63ade9c8230247b8194f7986` | Idempotent setup and health workflow. |
| `setup-gbrain/memory.md` | 12,981 | `02a5bab75dafbba64a3e2f5a5e02864b6b3de672` | `56b3d8249ffed3701eed9c82e07a99b33579e31cd15c11e69d102ecd93cd7cb0` | Memory behavior and trust policy. |
| `sync-gbrain/SKILL.md` | 72,233 | `09a46e1df6af9e610a99224bf54c7d48ca31eae6` | `6912ba3b7b146a3a64591941be432ccababba82594877c9e50e7d86a875d3f24` | Operator sync lifecycle. |
| `USING_GBRAIN_WITH_GSTACK.md` | 31,512 | `4d557559275fadd0b1c8f2748922e71a8bdd4f22` | `637b29d4d9a5cd4c02607efa4467c25573c8b22621de0d7b58e9c6353b3c4d81` | Integration boundary. |
| `docs/gbrain-sync.md` | 7,773 | `330ed29e2a29cadf9d2072546e43df8fc189a1a8` | `c25b0115e2da4ff0dfd49602cbf2bfa4ba249e387b0bbd48dff4751ac86dd52d` | Queue and reconciliation. |
| `docs/gbrain-sync-errors.md` | 7,560 | `1f5f7bed674239686737786153dda9d31fd07f8f` | `da7df2065b859e2843de760be61174f3ef81a027df984b790588a0baecfed1a7` | Failure preservation. |
| `docs/gbrain-write-surfaces.md` | 9,276 | `7d84734b14030605c5d3ba8fd5020efaa7973400` | `cbfa78dde7fdec9857366dab6a91a7214ed2c3f3b54f0671667822056fcd6c24` | Write-surface inventory. |
| `lib/gbrain-exec.ts` | 13,558 | `a7d32dea7b60a74b86c4c459a6f1fac229c7c49c` | `cb53a64bbb21fa757eb279514fa19f2faaed025c05c62bfc8419a30f357cf8c9` | Split-engine execution. |
| `lib/gbrain-local-status.ts` | 20,998 | `5398c71a85ba2941c33f5cd3c49ecc0d39bdc5f0` | `848ede1564a95a9e960a794d81c899c21a61550d77da47e4a33b5b373964dacd` | Health/readiness. |
| `lib/gbrain-repo-policy-client.ts` | 6,960 | `890282847a4241e4f79509360de5dc6a33de2505` | `3235be4c4e7ce65bac19ceeb863d07606bdf19082408ff772528a60f48a4fe12` | Normalized-remote policy. |
| `lib/gbrain-sources.ts` | 13,545 | `34b42319cf363c07db3183514c5c55fe18164532` | `7691a7986a1d8bdcbd473ebe9dd46be8f43110d7807f0cf6cb81714c7f972bba` | Source identity. |
| `lib/gbrain-guards.ts` | 12,615 | `1c46b4ad47a5a41ea7da18e79a344c67086450fe` | `5722b8048986e8fde2a7074d4d0dec8573af290e99e12d151b761e1899cce5e7` | Destructive-source guards. |

## Immutable contender objects

| Repository/path | Commit | Bytes | Git blob | Raw SHA-256 | Claim bounded |
|---|---|---:|---|---|---|
| Mem0 `LICENSE` | `39bc02330563764e7d4465f1ecff5f002d94da1a` | 11,349 | `d20d5102c3cf97ecbee54afd65893de4a11d26fe` | `0bbcbe931c353293a2fafce08326181dfeea0e568c566afd4ce8337a70f5e219` | Apache-2.0 text. |
| Mem0 `mem0/memory/main.py` | same | 168,002 | `a8b159f140cb72ed13f627d473e0b33ba15abd45` | `5b1b75e2f00aca7bd368a6e9cd5905145d60fd05a0e36d6b1ef3e2f1b4f28ca1` | Entity filters at lines 134-171 and 314-416; search/delete/history surfaces at lines 1,255-1,946. |
| Mem0 `docs/core-concepts/memory-operations/delete.mdx` | same | 7,268 | `a6dcf3f51b9360d30c3c947a4647c61ddfa6f295` | `37dbab3e09b3a5ce8b72f58e6d6b380cfa8a0149a653a1594feb5a371aa22430` | Deletion UX. |
| Mem0 `docs/open-source/features/rest-api.mdx` | same | 12,670 | `b798d242d903e1774c10f85a8bef1b184c4e2c0d` | `c9b29594446c8f654b15762d1e092956a2f00b97bfb6430c1b06125f85100234` | Self-hosted authenticated API shape. |
| Graphiti `LICENSE` | `683a8539c8925de69071a1305dc8bf0e52e17c65` | 11,325 | `5feb0d9d299a1107adfa8331306b13cc0eff2d78` | `2825300b20d7b951209835a4a331f29e24725a39d65168e4b831df53aa372650` | Apache-2.0 text. |
| Graphiti `graphiti_core/edges.py` | same | 33,631 | `28c170355e02a569b60c5e070f019572889ace82` | `0151d72ebfb057033c6d52a163e22f252f67b915722e14315b685c7831b3b1c6` | Episode UUID list and `valid_at`/`invalid_at` fields at lines 267-277. |
| Graphiti `graphiti_core/graphiti.py` | same | 71,892 | `7555a1f828c4b94970911876bfd257aaa4577d4c` | `7c65051a62982d8b510ebdbf37bae4d07020e74520e1f6d9bf8a0ffb26beeccb` | Episode processing/provenance context. |
| Graphiti `mcp_server/README.md` | same | 24,317 | `97088d2d6884984a588d98677517a540bd0d08d5` | `d1598f773dcdf29768f8af6d29be268d58593e631cf64edc0660f6f6100b09f2` | Exposed service and deletion surfaces. |
| Letta `LICENSE` | `4511fa0bc91f68fbab32b91f694617271ea9012b` | 10,759 | `f75c3422907f55d71685ae59afdc28498cde5a40` | `984c6db99fc6609803108dfc196762118662cd94b82a456dd9217583f18f3612` | Apache-2.0 text. |
| Letta Code `LICENSE` | `ad7e6cf5ff78c0e757770d66fcf04462a0e65c92` | 11,092 | `e72f5de5dd5610ee3fee7feb791ebff246cc931e` | `036e78b9d7dd33ae5b378fdda973b4aad7901c8d8371a0ae40fae1f6659a89d0` | Apache-2.0 text. |
| Letta Code `src/agent/memory-git.ts` | same | 61,687 | `d4add2014b2da737c203d2a4c794afe8b0df02e4` | `9595c9546eb47f7428a90d97ed267755be42a4930f85c2c4c125bc41d380c0a7` | Commit and synchronization boundary. |
| Letta Code `src/agent/memory-worktree.ts` | same | 18,230 | `05c038c2d4bc97726e17e820c2cc55d9138c8a8c` | `f59f7dff8c01a17166a125f6670640f5ae686b885a7f7850b496d60e5a5bc639` | Concurrent isolated worktree pattern. |
| Letta Code `src/agent/prompts/letta.md` | same | 18,193 | `c64745bbe485b1b4209ef7069fb674740db479bd` | `69ee5d2531a66f3b80cc7e3bf6481516517b76a63ea7101094917ea9d4769d56` | Memory activation/prompt boundary. |
| Letta Code `src/agent/memory-filesystem.ts` | same | 21,561 | `dffa83d0e7140a13fad4fca0055393c6cd44308a` | `fbb86b01da758ce68c3a42578b509f01185819f79f9cc2e5d52dd8f18118031f` | Protected memory filesystem classes. |
| MemFS docs `concepts/memfs/index.md` | `0bfd40b73de18fca8fd9c370263d2e46ac5379df` | 3,972 | `b35e4062c63469b2c4a28efa7ab188262072b504` | `889173552c8adea77a1fce37aba0b2e63eaf68c35d1c4a1d36d611bcd5d196be` | Git-backed MemFS behavior corroboration. |

## License closure

The complete license texts are the immutable `LICENSE` objects identified in
the ledger, not repository badges or website claims. The inspected first lines
and complete file bytes identify gstack as MIT and Mem0, Graphiti, Letta, and
Letta Code as Apache License 2.0.

KStack's installed PGLite is exactly `@electric-sql/pglite@0.5.4`, locked by
npm integrity
`sha512-yYZUyyXrHU7tPlCjwZQJ6hIG9DscdCCn7Uk0mYKwC1FeHX286AbcmFveMiRBEak8e9iPupjsoVImN3yJZVed2g==`.
Its 10,173-byte installed `LICENSE` has SHA-256
`a6cba85bc92e0cff7a450b1d873c0eaa2e9fc96bf472df0247a26bec77bf3ff9`;
`plugins/kstack/package-lock.json` has SHA-256
`c3e4ab2425f68e4f9d6b4c65224e94d913299ec91e00cb0dfde0b634ab13bf82`.

No model or model runtime is selected, so model licensing and hardware
qualification are outside this decision.

This ledger proves what was assessed and makes later byte-for-byte
reproduction possible. It does not convert an upstream pattern into trusted
KStack code: implementation still requires attribution, re-pin/re-hash,
independent tests, and KStack security review.
