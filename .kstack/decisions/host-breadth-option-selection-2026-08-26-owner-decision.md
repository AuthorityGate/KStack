# Owner decision: host-breadth architecture

**Thread:** `host-breadth-option-selection-2026-08-26`
**Decision:** `HB-Q1`
**Status:** `LOCKED-YES-OPTION-C-WITH-NON-COPY-CONSTRAINT`
**Reviewed digest:** `825c5169e5c7df1a23df5060519edd49af956af8e65c7ae8937e186b70066a81`
**Review result:** Codex 96 approve; 0 failed checks, 0 security findings,
0 material dissent, 0 unresolved questions; no Opus

## Owner answer

The owner explicitly answered **Yes** after the qualifying readback. Option C
is selected as the Host architecture direction, with this standing constraint:
KStack may adapt reusable gstack host mechanics only component by component,
with retained MIT attribution, a justified material KStack improvement,
independent tests, and rejection of any component that weakens the combined
design. Verbatim adoption is not selected.

This constraint is compatible with the reviewed Option C. It makes mandatory
the brief's existing rejection of Option A, selective adaptation boundary,
KStack-native governance, provenance manifest, and conformance evidence.

## Full HB-Q1 mapping

| Reviewed boundary | Locked answer | Consequence |
|---|---|---|
| Agent Skills canonical package | Yes | Package metadata and prompt text remain non-authoritative. |
| Adapted gstack registry/generator with KStack transactional installer | Yes, subject to the standing non-copy constraint | Every reuse candidate must pass component admission below. |
| Eventual MCP tools/resources boundary | Yes, as the later HB-TC04 direction only | No MCP implementation, identity promotion, ask-tier tool, or side effect is authorized now. |
| KStack-native governance, broker, activation, receipts, and conformance | Yes, mandatory | Reused mechanics cannot replace, weaken, or bypass these controls. |
| ACP deferral | Yes | ACP stays out of scope absent a later owner decision to make KStack an agent backend. |

Option C is a host-breadth layer within the existing Host Portability and
Capability Fabric direction. It does not reopen locked HP-Q1 through HP-Q3 or
validated HP-TC07. Options A, D, and E remain rejected or deferred; Option B
remains a fallback description rather than the selected direction.

## Component admission rule

Before a gstack-derived pattern or source unit enters an implementation plan,
one reviewable record must bind:

1. upstream repository, license, commit, path, and exact source digest;
2. the precise behavior, pattern, or source span proposed for reuse;
3. why reuse is stronger than a small KStack-native alternative;
4. the exact adaptation and its material KStack improvement;
5. authority, security, maintenance, migration, and support-claim effects;
6. retained notice and local provenance binding;
7. deterministic unit, golden, and adversarial tests plus transactional or
   real-host conformance where applicable; and
8. one closed disposition: `ADAPT`, `REIMPLEMENT-PATTERN`, or `REJECT`.

`ADAPT` is allowed only when the result preserves the useful upstream behavior
and meets or exceeds applicable KStack governance, security, determinism,
rollback, and testability baselines. A known regression against either
applicable baseline requires `REJECT` unless the owner separately acknowledges
that exact risk. No admission record can promote a host or operation to
supported or `FULL`.

## Initial component mapping

| gstack source | Candidate | Mandatory improvement | Initial disposition |
|---|---|---|---|
| `hosts/define-host.ts` | Fresh-default factory and override composition | Closed `HostProjectionV1`; packaging separate from qualification; no authority-bearing prompt field | `REIMPLEMENT-PATTERN-PENDING` |
| `hosts/index.ts` | Registry, aliases, derived lists | Lifecycle and adapter/schema digests; no host-level qualification | `REIMPLEMENT-PATTERN-PENDING` |
| `scripts/host-config.ts` | Typed validation contract | Closed fields; safe normalized paths; metadata/platform checks; bound digest | `REIMPLEMENT-PATTERN-PENDING` |
| `scripts/host-config-export.ts` | `list/get/detect/validate/assets` interface | Sole installer input; no shell-string execution; closed JSON | `REIMPLEMENT-PATTERN-PENDING` |
| `scripts/gen-skill-docs.ts` | Discovery, normalization, transforms, fanout, provenance, freshness, aggregate failure | Small library; typed projections; exhaustive normative-clause preservation | `REIMPLEMENT-PATTERN-PENDING` |
| `test/host-config.test.ts` | Parameterized registry, golden, and idempotency patterns | Adversarial, no-promotion, clause, crash, and independent conformance tests | `REIMPLEMENT-PATTERN-PENDING` |
| `docs/ADDING_A_HOST.md` | Contributor workflow structure | Separate registered, renderable, installable, qualified, and supported states | `REIMPLEMENT-PATTERN-PENDING` |
| `setup` as architecture | Handwritten host dispatcher | Conflicts with generic transactional installation and contains registry/setup drift | `REJECT` |
| Prompt rewrites as enforcement/support evidence | Literal instruction changes | Cannot prove interception, identity, authority, confinement, receipts, or conformance | `REJECT` |
| `openai.yaml` logic as generic metadata architecture | Codex-specific sidecar | Use independent closed host metadata adapters | `REJECT` |

`REIMPLEMENT-PATTERN-PENDING` admits no upstream bytes. The later item-level
record must prove whether adapted source or a clean KStack implementation of
the pattern is stronger.

## Authorization boundary and questions

This selects architecture only. It does not authorize product code, source
reuse, installation, credentials, host qualification, MCP, external mutation,
commit, push, deployment, publication, or report changes.

There is no blocking question. The explicit Yes plus standing constraint maps
fully to the reviewed Option C.
