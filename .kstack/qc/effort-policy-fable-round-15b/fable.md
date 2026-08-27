The advisor confirmed both load-bearing kernel claims and the ruling. I couldn't write the plan file — the harness blocked every file-write path available in plan mode — so the complete ruling is delivered here verbatim. The post-approval step is to save it to `.kstack/decisions/fable-arbitration-lock-rename-mutual-exclusion-round15-2026-08-23.md`, matching the existing decision-file naming convention.

---

# Fable arbitration ruling — round 15, lock-rename mutual-exclusion closure claim

## Summary

**Codex's BLOCK is upheld on substance. Opus is right about the kernel semantics; Codex is right about the conclusion.** The `/proc/self/fd/<lockFd>/../index.append-lock` construction narrows the TOCTOU window but does not close it, so the draft's unconditional closure claim is false under this loop's own "closed, not bounded" standard — the same standard round 14 was blocked on. The directive is option **(b)**: round 16 must change the mechanism, not the wording.

## 1. Kernel semantics of `/proc/self/fd/<fd>`

It reflects the **current** location. `/proc/self/fd/<fd>` is a magic symlink whose target is computed at resolution time from the fd's `struct file` → current dentry (`d_path`). When used as a path prefix in a syscall, the VFS does not do a textual readlink-then-walk — it jumps directly to the open file's dentry (`nd_jump_link`), so resolution follows the inode wherever it currently sits in the tree. If another process has renamed the directory, `/proc/self/fd/<fd>/..` resolves to the *new* parent; if the directory has been rmdir'd, lookups inside it fail ENOENT. Opus's premise is fully correct.

## 2. Opus's naming-grammar defense does NOT defeat Codex's race

The grammar defense covers only the interleaving where repairer A's move has **completed** before repairer B's rename syscall begins path resolution. It does not cover the in-flight interleaving inside B's single `rename()` syscall:

- `do_renameat2` resolves the **source parent** first (`filename_parentat`, LOOKUP_PARENT): `/proc/self/fd/<lockFd>/..` → the still-canonical top-level parent. B now holds a reference to that parent dentry but **no lock**. (The top-level parent never moves, so the reference stays valid throughout.)
- Only later does it call `lock_rename()` (parents' `i_rwsem`, plus `s_vfs_rename_mutex` cross-directory) and **then** look up the final component `index.append-lock` **by name** under those locks (`__lookup_hash`). Nothing re-validates against any previously-fstat'd inode — `lock_rename`'s "trap" check guards ancestor loops, not identity.
- Between parent resolution and lock acquisition, B can be preempted arbitrarily long. In that gap, A's complete rename (moving the validated inode into its private container) and a fresh acquirer's complete mkdir-and-acquire at the canonical name can both land — each briefly taking and releasing the same parent lock, fully serialized, no kernel rule violated.
- B then acquires the locks, looks up `index.append-lock` in the top-level parent it resolved earlier, finds the **new live lock**, and renames it into B's quarantine destination. The new owner still believes it holds the mutex; the canonical name is now free; a third acquirer takes it. Two live holders — exactly Codex's scenario.

Per-syscall rename atomicity does not compose into inode-conditioned semantics: the VFS serializes the *mutation* phases of concurrent renames, but nothing pins B's earlier parent resolution to its later final-component lookup. The final source component is bound by **name at lookup time**, never by the validated inode. The naming-grammar invariant is irrelevant to this interleaving because B's `..` resolved *before* the move — to the top-level parent, not a private container — so no fixture over the container grammar can test this race away.

On practical width: the exploit needs B to stall inside one syscall between two specific points while two complete multi-step operations land in the gap — astronomically narrow in practice, but arbitrarily stretchable by scheduling, and the draft claims *closure*, not narrowness. Note also that Codex's finding text does describe this in-flight window ("After `/proc/self/fd/<lockFd>/..` resolves to the original parent, another breaker can move the validated inode and install a replacement…") — it did not need to rebut the grammar point, because the exploitable interleaving precedes the move.

## 3. Binding directive for round 16: option (b) — real gap; change the mechanism

The principle the next round must internalize: **no rename/link/unlink-family protocol can condition a namespace mutation on the identity of the final source component** — POSIX/Linux has no compare-and-rename on directory entries. And since directories cannot be hardlinked, no `linkat`/AT_EMPTY_PATH trick yields an identity-bound *move* of a directory either: rename is the only directory-move primitive, and its source is name-keyed. That forecloses the "clever syscall fix" branch entirely.

Round 15's fd-anchoring **is** genuinely sound where the validated inode is the *parent* of the final component (e.g. the fd-bound `linkSync` of `owner.json` inside the held lock — keep those uses; Opus's praise of that race arbiter stands). It cannot be sound where the validated inode *is* the final component — which is all three flagged lifecycle moves (quarantine, stale-lock break, normal release).

In order of preference:

1. **Preferred — eliminate the movable-lock design entirely.** Replace directory-move locking with a kernel-mediated inode-bound lock on a persistent, created-once, never-renamed, never-unlinked lock file: `flock(LOCK_EX|LOCK_NB)` or `fcntl` F_OFD_SETLK. The never-replaced invariant is load-bearing: the classic flock failure mode is a replaced lock file, where two acquirers open different inodes at the same path and both "hold" the lock — the file must be created once and never unlinked or renamed thereafter. The kernel binds the lock to the open file description and releases it automatically on process death, so the quarantine / stale-break / death-proof / ownerless-reclaim machinery is **deleted wholesale rather than repaired** — that subsystem exists only to compensate for mkdir-locks not dying with their owners. The cost to confront honestly: Node has no builtin flock. Round 16 must specify the vehicle (a small N-API/native dependency, an `fs-ext`-class module, or a spawned util-linux `flock(1)` holder child) with capability probing and a fail-closed fallback, at the same rigor as the rest of the spec. Crash recovery reduces to "reopen and retry."

2. **Fallback (only if any external/native primitive is out of bounds)** — restructure so every identity-sensitive mutation has the validated inode as its *immediate parent*: a persistent, never-moved canonical lock directory whose interior entries (owner record, break-claim, tombstones) carry all mutable state, mutated only via `/proc/self/fd/<lockFd>/<child>` paths, with an exclusive link-created break-claim record serializing breakers. Warning: this is a protocol redesign with its own new staleness story (who breaks a stale break-claim?) and must return as a full design round, not a patch.

**Explicitly rejected:** shipping round 15's mechanism with Opus's conditional-closure wording plus a grammar fixture. That answers only the completed-move interleaving; the residual race does not depend on the grammar invariant at all.

## Scope

Per the brief, this ruling covers only the lock-rename mechanism. Opus's other round-15 findings (spend amplification, gate restart bounds, enumeration exclusions, tokenization, `currentBindings` authority, fstat adjacency) are untouched by this ruling and proceed on their own track.

---

**Post-approval steps:** save this ruling verbatim to `.kstack/decisions/fable-arbitration-lock-rename-mutual-exclusion-round15-2026-08-23.md`, then feed the section-3 directive into the round-16 dispatch brief.
