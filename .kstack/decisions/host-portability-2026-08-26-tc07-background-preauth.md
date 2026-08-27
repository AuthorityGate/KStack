# HP-TC07 owner decision: background preauthorization

**Decision ID:** `HP-TC07-Q-BACKGROUND-PREAUTH`
**Status:** `LOCKED`
**Owner answer:** `Yes with conditions`
**Scope:** ask-tier background host execution only

## Full question shown

For an ask-tier action that is expected to execute later in the background
without the owner present, should KStack prohibit durable preauthorization and
require a fresh, exact owner approval at execution time after rechecking current
policy, active set, target, inputs, limits, expiry, nonce, idempotency, and
authority? The recommended answer was **Yes**, because it avoids converting one
old approval into standing future authority; its tradeoff is less unattended
automation and a possible execution-time owner interruption. `No` would permit
bounded durable preauthorization subject to explicit TTL, revocation,
revalidation, and disclosed risk. `Comment` allowed qualifications, alternate
wording, conditions, or additional direction. HP-TC07 remediation remained
blocked pending this choice.

## Locked readback

`HP-TC07-Q-BACKGROUND-PREAUTH / durable background preauthorization -> Yes with conditions`.

Meaning: prohibit durable preauthorization and require fresh exact
execution-time owner approval. Before calling the human, KStack must perform
only bounded, non-escalating automated troubleshooting, wait a short configured
timeout, make only the permitted finite additional attempts, and revalidate
current policy, active set, target, inputs, limits, expiry, nonce, idempotency,
and authority after recovery and immediately before execution.

If validation still fails, KStack remains fail-closed and relays one complete
`Yes` / `No` / `Comment` question stating the attempted troubleshooting, exact
failure and evidence, and safe choices. That question may select abort, a
bounded retry, or qualified safe direction. It cannot waive failed safety or
authority validation and cannot authorize the blocked action. This decision
grants no implementation or external-action authority.
