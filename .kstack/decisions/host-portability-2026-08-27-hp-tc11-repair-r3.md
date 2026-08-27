# HP-TC11 round-3 repair: fresh reverse-generation lineage

**Prior packet:** `2420dceca58d6c1e982fcd5e31084c16e4b682fc23adacc8713a123788d16fa0`
**Prior result:** Codex 97 revise; 1 failed / 1 high security / 0 dissent /
1 question; output `c9f534cb3a114fffcf9037ed307ca1ba38436acd4f2b0b2de209d0289e2db95c`
**Item/boundary:** HP-TC11 only; the R2 protected root publication, handle,
lease/action, forward recovery, retirement, and every other clause remain frozen

## Exact correction

Reverse activation never republishes an old immutable generation object or
digest. It publishes a fresh `ActivationGenerationV1` with new transaction
metadata and lineage while referencing the exact retained prior execution
closure as reusable content.

## Metadata and execution-closure separation

`ActivationExecutionClosureV1` is protected, immutable, and content-addressed.
It binds the exact loaded resources, process/broker/mutation/MCP binaries and
configurations, adapter/policy/evidence registries, executable identities,
compatibility facts, readiness vector definitions, and retention references.
It contains no activation sequence, current/prior generation, journal intent,
restriction epoch, migration gate, or transaction-specific readiness result.

Each `ActivationGenerationV1` binds one `executionClosureDigest` plus fresh
generation-specific fields: active-set digest, generation digest/sequence,
current root digest/sequence expected before publication, immediate prior
generation digest, journal `COMMIT_INTENT` digest, current restriction and
eligibility epochs, current host-binding snapshot/version, current HP-TC12
migration-gate digest, newly measured instance/readiness receipts, activation
direction `FORWARD|REVERSE`, target historical generation digest when reverse,
trusted times, and retirement policy.

## Exact reverse construction

For reverse activation, the protected builder:

1. resolves the requested historical generation and its retained
   `executionClosureDigest` through the authenticated journal/root lineage;
2. rehashes and revalidates every retained execution-closure member against the
   current platform, compatibility, revocation, host binding, and policy;
3. privately instantiates fresh ready process/resource instances from that exact
   closure; no old live instance or old authorization state is reused;
4. evaluates the current HP-TC12 reverse migration gate and current restriction/
   eligibility epochs;
5. creates a new immutable reverse `ActivationGenerationV1` whose sequence is
   greater than the current root, whose immediate prior is the current
   generation, whose reverse target names the historical generation, and whose
   intent/epoch/gate/readiness fields are all from this reverse transaction; and
6. publishes that fresh generation through the unchanged R2 protected root
   compare-and-swap and durability protocol.

The new generation may reference the byte-identical historical execution
closure, but its generation digest is necessarily new. Republishing a historical
generation digest, sequence, root expectation, intent, readiness receipt,
restriction epoch, host snapshot, or migration gate is prohibited and rejects
before `COMMIT_INTENT`.

## Reverse recovery predicates

R2 recovery applies to the fresh reverse generation with these exact bindings:

- root equals the pre-reverse current generation and no successful reverse-root
  replacement receipt exists: reverse did not publish; retain current and mark
  `RECOVERED_PRIOR` for the reverse transaction;
- root equals the new reverse-generation digest and the durable replacement
  receipt, new sequence/lineage, reverse intent, current epochs/gate, target
  historical generation, revalidated execution closure, and fresh readiness
  receipts all authenticate: reverse published; recover `ACTIVE` on the new
  reverse generation;
- root equals the historical generation digest directly, or any new/old lineage,
  intent, epoch, gate, target, closure, readiness, or receipt field is missing,
  stale, forked, rolled back, mismatched, or unprovable: `ACTIVATION_AMBIGUOUS`;
  issue no lease and perform no action.

The old historical generation remains a lineage and evidence record only. It is
never made current again. A later reverse to the same historical closure creates
another fresh generation with another strictly increasing sequence and current
transaction bindings.

## Corrected verification properties

Golden vectors distinguish historical generation digest, retained execution-
closure digest, current root, and fresh reverse-generation digest. Fault tests
substitute every stale historical sequence, intent, epoch, gate, host snapshot,
readiness receipt, root expectation, and generation digest before/during/after
the reverse root swap and durability barrier.

Properties prove sequences and immediate lineage remain monotonic across any
forward/reverse chain; execution bytes may be reused only through an authenticated
revalidated closure; every publication has fresh transaction metadata/readiness;
the root never points directly back to stale generation metadata; and any
unprovable reverse state blocks without mixing old authority with new execution.

## Review request

Review only whether this repair makes reverse activation publish a fresh
immutable generation with current lineage/intent/epoch/gate/readiness while
referencing and revalidating the exact retained prior execution closure, and
updates recovery to prohibit stale generation republication. Closure requires
Codex 93+ and 0 failed/security/dissent/questions.

Do not inspect other files, use tools, invoke Opus, implement, activate a host,
use credentials, perform external actions, commit, push, deploy, publish, edit
reports, or close another HP item.
