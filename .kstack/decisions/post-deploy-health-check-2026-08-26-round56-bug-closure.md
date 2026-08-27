# Post-deploy health check — accepted round-56 bug closure

**Accepted score endpoint:** Codex 98, Opus 74, combined 74
**Owner minimum:** 72
**Review invocation:** `cfaa0b6a-7b5d-43b9-8ed9-003568c28d71`
**Reviewed digest:** `d297f67d3d4e00396c25dff707a8547dad7eee8a206b5fab2d620de5ea2d4fb3`

No additional score-improvement round follows. This addendum removes the
confirmed specification bugs and records the evidence-based disposition of the
disputed kernel-escaping premise without rewriting the historical review.

## Corrected total byte splitter

The splitter receives one nonempty, NUL-free `/proc/self/stat` byte record after
the acquisition layer has verified exactly one LF and that LF is terminal, then
removed it. `end` is the exclusive byte length.

1. Find the first `0x20`. If none exists, reject
   `STAT_FIRST_SPACE_MISSING`. If its index is zero, reject `STAT_PID_EMPTY`.
2. Set `openerIndex = firstSpace + 1`. If `openerIndex >= end`, reject
   `STAT_COMM_OPENER_OOB`. If `record[openerIndex] !== 0x28`, reject
   `STAT_COMM_OPENER_MISSING`.
3. Find the final `0x29` only in `[openerIndex + 1, end)`. If none exists,
   reject `STAT_COMM_CLOSER_MISSING`.
4. If `closerIndex + 1 >= end` or that byte is not `0x20`, reject
   `STAT_COMM_DELIMITER_MISSING`.
5. If `closerIndex + 2 >= end`, reject `STAT_SUFFIX_EMPTY`. If that byte is
   another `0x20`, reject `STAT_COMM_DELIMITER_DUPLICATE_SPACE`.
6. Return opaque byte slices `record[0:firstSpace]`,
   `record[openerIndex + 1:closerIndex]`, and
   `record[closerIndex + 2:end]`.

This closes the missing-sentinel guard, the possible opener-side out-of-bounds
read, and the ambiguous `openerIndex` assignment. Named negative fixtures must
assert the exact rejection code, not merely generic failure. A mutant returning
the suffix from `closerIndex + 1` is also required to fail.

## Kernel printed-representation disposition

The review premise that `/proc/self/stat` escapes LF and backslash is disproved
for the current Linux implementation. In authoritative Linux source,
`do_task_stat()` calls `proc_task_name(m, task, false)`; the escaped form is used
by `/proc/*/status`, not stat. The source then emits `") "` and the state byte.
See <https://github.com/torvalds/linux/blob/master/fs/proc/array.c>.

Therefore runtime fixtures for this user-process lane may compare the printed
comm bytes directly with the bytes stored by `prctl(PR_SET_NAME)`, after the
kernel's 15-byte payload truncation. Backslash, tab, valid multibyte UTF-8, raw
`0xff`, internal `)`, terminal `)`, and empty comm are explicit round-trip
cells. LF is a negative acquisition fixture: because stat does not escape it,
it creates an interior LF and violates the exactly-one-terminal-LF contract.

Qualification must pin this behavior by running the backslash, LF, and raw-byte
cells on every supported kernel family. A future kernel that changes stat comm
rendering fails qualification; the implementation must not guess an encoding.
No bound on the printed field may be inferred for kernel/workqueue task names;
the 15-byte comparison applies only to this self-process `PR_SET_NAME` fixture
lane.

## Blocking safety dependencies

The splitter never emits raw `commBytes` to a terminal, log, JSON string, path,
key, or message. Any diagnostic consumer is blocked until a separate bounded
byte-escaping rule is validated and must reference only that escaped form.

Likewise, no parsed record is accepted for topology use until the suffix item
has validated the one-byte state field and the complete numeric-field grammar.
Those are explicit blocking edges, not prose-only deferrals. They remove the
raw-output and future-format silent-use paths identified in the review without
expanding the delimiter itself.

## Closure

The final-`)` delimiter, exact one-space predicate, empty comm behavior, and
opaque slicing remain unchanged. The confirmed opener bugs are corrected; the
escaping objection is dispositioned against primary source; and the two
downstream safety requirements are now blocking dependencies.
