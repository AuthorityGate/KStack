# HB-TC02 round-2 activation bug fix

**Base digest:** `110779cce9e64945a02cf4226d89cc387bbb379a9ef77a41dd503cc87f52dea5`
**Frozen:** registry installer, transaction states, recovery, non-copy boundary

## Activation binding variants

Before PREPARED, address exactly one `ActivationBindingV1` variant.

`TREE_DESTINATION` binds containing-directory identity, entry-name digest,
observed state, current tree identity/manifest or null, staged tree
identity/manifest, filesystem/volume identity, and durability-domain digest.
No link/reparse point is valid in this variant.

`POINTER_DESTINATION` is a logical destination binding:

- containing-directory identity and pointer entry-name digest;
- pointer kind (`REGULAR_POINTER_FILE|SYMLINK|JUNCTION`) from the profile;
- expected current pointer identity/byte digest or null for absent;
- owned immutable version-store root identity;
- resolved old version-tree identity/manifest or null;
- staged immutable new version-tree identity/manifest;
- pointer-format schema digest and expected new pointer byte/target digest;
- filesystem/volume identity and durability-domain digest.

Pointer ownership is validated without following it; its target is then
resolved separately beneath the already-open owned version-store root and must
equal the bound tree identity. Symlink/junction is allowed only as this exact
KStack-owned pointer entry under a qualified pointer profile. It remains
forbidden as a bundle member, tree member, or unprofiled destination. The
classifier adds `KSTACK_POINTER_ACTIVE` and never treats a qualifying pointer
as an ordinary directory.

`HOST_NATIVE_DESTINATION` binds the exact adapter/profile/evidence digest,
typed native destination identity, old/new manifest, durability domain, and
closed supported-state set. No opaque string identity is permitted.

## Total state-by-strategy compatibility

The following table is complete; every unlisted or failed predicate returns
`ATOMIC_ACTIVATION_UNAVAILABLE` before PREPARED.

| Observed state | ABSENT_RENAME | ATOMIC_DIRECTORY_EXCHANGE | ATOMIC_POINTER_SWAP | HOST_NATIVE_TRANSACTION |
|---|---|---|---|---|
| `ABSENT` | Allowed with `TREE_DESTINATION`, no-replace same-parent rename | Forbidden | Allowed with `POINTER_DESTINATION`: prepare immutable version tree, then no-replace atomic pointer creation | Allowed only if exact native evidence lists `ABSENT` |
| `EMPTY_OWNED` | Forbidden; no removal transition exists | Allowed with `TREE_DESTINATION` and exact empty old identity | Forbidden | Allowed only if exact native evidence lists `EMPTY_OWNED` |
| `KSTACK_ACTIVE` | Forbidden | Allowed with exact old tree receipt/identity | Forbidden | Allowed only if exact native evidence lists `KSTACK_ACTIVE` |
| `KSTACK_POINTER_ACTIVE` | Forbidden | Forbidden | Allowed with exact pointer/old/new version bindings | Allowed only if exact native evidence lists `KSTACK_POINTER_ACTIVE` |
| `FOREIGN_OR_UNKNOWN` | Forbidden | Forbidden | Forbidden | Forbidden |

For pointer `ABSENT`, creating the immutable version tree occurs only beneath
the inactive owned version store and cannot affect discovery; the single
active-path mutation is no-replace pointer creation. For pointer update, the
single active-path mutation is atomic pointer replacement. All version trees
are verified/durable before PREPARED and protected receipts retain old/new.

The prior statement allowing EMPTY_OWNED under ABSENT_RENAME is withdrawn.
There is no delete-empty-directory shortcut. State, binding variant, profile
strategy, primitive evidence, and live remeasurement must match exactly.

## Review request

Review only these concrete activation fixes against the frozen base. Closure
requires an explicit score/confidence of at least 93 and zero failed checks,
security findings, dissent, and questions. Do not redesign, invoke Opus, use
tools, inspect/edit files, implement, commit, push, deploy, publish, or edit
reports.
