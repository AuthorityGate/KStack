# KStack Secret Broker — WP01 public boundary

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Work package | `SB-WP01` / Jira KSTK-132 |
| Jira stable item digest | `00f936e2cf64af53b407e3d54a459f921926975db21c0cbf26b21e5106be0b62` |
| Integrated dependency | SB-TC12 SHA-256 `0c516367cbf7ab6088f17f54594abd364119ad9020c90ca52ca64ed9739b681e` |
| Direct contracts | SB-TC02 SHA-256 `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075`; SB-TC11 SHA-256 `1ec9bccc8dde857c6d659cee36d10b535a2fbfad65b5fe79966d000ec12e70ee` |
| Disposition requested | `WP01_IMPLEMENTED`; exact-candidate review required |
| Runtime effect state | `UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT` |

## Outcome

WP01 implements only the accepted public/package boundary:

- exact closed JSON Schema snapshots define v1 describe/list requests and
  describe/list results, including recursively closed public metadata;
- the existing bounded host canonical codec supplies duplicate-key, UTF-8,
  Unicode, integer, trailing-byte, depth, size, and RFC-8785-style canonical
  rejection without adding a second parser;
- registry IDs, 256-bit handle candidates, 128-bit opaque reference candidates,
  cursors, safe-label syntax, public metadata, and public result shapes have
  explicit validators and fixed limits;
- handle and reference candidates use the OS CSPRNG and encode no scope,
  backend, provider, target, account, tenant, path, or authority;
- the execution-shaped CLI returns the same fixed unavailable record for
  malformed, absent, wrong-scope, unauthorized, stale, revoked, or deleted
  handle classes and the same fixed cursor-unavailable record for any supplied
  cursor while the broker is fenced; and
- native Windows and Linux workers, provider/target contact, protected state,
  credential entry, and the enrolled WSL Jira source remain untouched.

The metadata validator is deliberately structural. It does not claim that a
registry ID resolves, a label has protected enrollment admission, a handle is
authorized/current, or an available result may be emitted. Those decisions
remain unavailable until their later protected-state, authority, lifecycle,
and registry work packages close. The CLI therefore emits no available result.

## Frozen implementation candidate

| Path | SHA-256 | Role |
|---|---|---|
| `plugins/kstack/scripts/secret-broker/public-v1.mjs` | `f0597c034aefe02592e935b4d738b42ed03f3e29fe65c27f3acd5c160e2f7f63` | pure public codec, primitive, schema, metadata, and fixed-unavailable validators |
| `plugins/kstack/scripts/kstack-secret-broker.mjs` | `1fab24d18d15112559cf0888445ba78a2b610f6e2b2e38d2e05b4e343023095f` | closed value-free public CLI entrypoints while retaining the WP00 fence |
| `plugins/kstack/schemas/secret-broker/v1/public-request.schema.json` | `0384e1a4ca02c55f7c0c9438d8f54c345e739c6bf757c08d9632223d99c7aae1` | exact v1 request schema snapshot |
| `plugins/kstack/schemas/secret-broker/v1/public-result.schema.json` | `47d02676a4570ba3fc22b060ef933faaa1c72a601c1bea9a7db8eff81ba856c2` | exact v1 result and safe-metadata schema snapshot |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `f1b3bfa7d9a1df43d0a8407d303b8ba3b3c32bbef9c2665bc2588d3e7a1f74c8` | regenerated source/install byte closure including schemas and codec |
| `setup` | `319e156808e157fdc9fdc95ca3e6d4d664b693b793a1e372db6a8fafe006b45d` | POSIX/native-copy schema delivery and cache comparison |
| `setup.ps1` | `4bbad4377cddd95d45fa5272f25066a5ff3a79dceda1cddb76b8cd9a821f8e11` | native Windows schema delivery |
| `tests/helpers/generate-install-health-audit-manifest.mjs` | `edb9a7a82a7541ea634c1d618f3792f20d7c639ac02dbf570be90aaf9b39a85e` | schema-root source-audit generation |
| `tests/install-health.test.mjs` | `ef831383e439112e6be38d5536a25032cbbd4314955720858bfe3d028290925e` | installed schema byte-presence and staged-runtime coverage |
| `tests/secret-broker.test.mjs` | `76e23d55680fb1bc5a83830658ce17dd7c14b740e4660f94032680d58bba416a` | hostile parser, opaque property, schema snapshot, metadata, fixed-result, CLI, and worker-fence coverage |
| `tests/reflexion-architecture-gate.mjs` | `8975a87682f4ef00b72d06342e1dccbb27a1d5125c69031a84baeaf2e20c148c` | exact importer/capability/use-site registration for the pure codec |

## Verification

- Exact-candidate `npm test`: 1,019 tests; 1,017 passed; 0 failed; 2
  environment-gated skips. The skips remain the real Windows worker and real
  Linux desktop Secret Service qualifications; neither bypasses the WP00
  global fence.
- Focused Secret Broker suite: 24 tests; 22 passed; 0 failed; 2 identical
  environment-gated skips.
- Runtime-faithful architecture suite: 9 tests; 9 passed; 0 failed. The new
  public module has only crypto plus two pure local imports and no filesystem,
  network, child-process, dynamic-import, eval, or WebAssembly capability.
- Install-health plus native Windows setup: 7 tests; 7 passed; 0 failed.
- Audit-manifest regeneration check, JavaScript parse checks, JSON schema parse
  checks, and `git diff --check` passed.

## Residual boundary and handoff

WP01 does not implement or authorize public configuration schema 2, protected
registry resolution, label admission, repository/environment identity,
principal/policy authority, cursor mint/consume state, backend custody,
lifecycle transitions, audit receipts, provider/target execution, setup/import,
pilot, production, deployment, release publication, or Git publication.

After an exact-candidate review closes at 93/all-zero, WP02 may begin as a new
Jira item for config-v2 parsing/migration and acyclic release/content manifests.
WP02 must preserve the global effect fence and may not open protected state or
contact a provider, target, or Jira credential source.
