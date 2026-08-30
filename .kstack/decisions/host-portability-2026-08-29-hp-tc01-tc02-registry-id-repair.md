# HP-TC01/02 registry identifier repair

Date: 2026-08-29
Status: implementation repair candidate; review and QC required
Scope: registry identifiers only; all other HP-TC01 and HP-TC02 contracts remain frozen

## Defect

HP-TC01 defines every `RegistryRef(X)` and `VocabularyEntryV1.id` as the
lowercase-only `AsciiIdV1`. HP-TC02 then defines authoritative operation-class
IDs such as `LOCAL_READ` and registry-owned reason codes such as
`KSTACK_HOST_CLASS_MISMATCH`. Those values cannot be stored in the HP-TC01
vocabulary registry or validated by an HP-TC01 artifact. The two frozen
contracts are therefore not constructible together.

## Exact repair

Keep `AsciiIdV1` unchanged for schema IDs, field names, ordinary component
IDs, and every location that explicitly declares `AsciiIdV1`.

Add one non-overlapping declaration:

```text
StableCodeIdV1 = string(
  utf8Bytes=1..128,
  pattern=^[A-Z][A-Z0-9_]{0,127}$
)
RegistryIdV1 = oneOf(AsciiIdV1,StableCodeIdV1), exactly one branch
```

Only these two HP-TC01 declarations change:

```text
RegistryRef(X) = RegistryIdV1 resolving exactly once in collection X
VocabularyEntryV1 = Record{id:RegistryIdV1}
```

Every collection remains exact, case-sensitive, byte-sorted, and duplicate
rejecting. Lowercase and uppercase spellings are different IDs; the registry
contains no aliases and resolution never folds case. A mixed-case identifier
is invalid. Schema IDs and schema references remain lowercase `AsciiIdV1`, so
this repair does not widen bootstrap or resolver selection.

HP-TC02's six operation classes and its `KSTACK_HOST_*` reason codes now have
one canonical representation. No migration is required because HP-TC01/02 had
no completed implementation, active schema set, or admitted artifact when the
contradiction was found.

## Required verification

- accept every HP-TC02 closed operation class and reason code through a bound
  vocabulary collection;
- reject mixed case, leading underscore/digit, lower/upper aliases not present
  in the exact registry, strings over 128 bytes, and Unicode;
- prove `AsciiIdV1` still rejects uppercase in schema IDs and ordinary fields;
- regenerate exact expanded vocabulary and artifact-schema digests;
- run Node, Python, Rust, architecture, install-health, and full repository
  regressions before recording `BUG_FIXED`.

This repair grants no operation authority, admission, eligibility, mutation,
receipt, activation, migration, or host support.
