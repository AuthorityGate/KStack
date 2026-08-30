# HB-TC01 round-5 repair 1 — fail-closed host fields

Date: 2026-08-29  
Scope: the independent final-review round-5 host-field finding only

## Binding rule

An additional host scalar field is admissible only when all of the following
hold:

1. its adapter exists in the same `RegistrySetV1`;
2. its key is under the exact adapter-owned namespace
   `x-kstack-<adapter-id>-<field-id>`;
3. the suffix is a canonical lowercase dotted or dashed identifier and does
   not use a reserved identity, authority, activation, approval,
   qualification, credential, secret, ownership, or capability stem;
4. its `valueSchemaDigest` is one of the implementation's closed, executable
   host-value schema profiles; and
5. every projected value passes the predicate identified by that exact digest.

The namespace is the fail-closed control. A newly invented host-interpreted
synonym cannot collide with a canonical or adapter-native field because KStack
will emit it only under its owned extension namespace. Reserved suffix
filtering remains defense in depth, not the completeness claim.

## Initial executable profile

V1 admits one public-identifier profile. Its value must be NFC, contain 1–64
UTF-8 bytes, and match `^[a-z0-9]+(?:[.-][a-z0-9]+)*$`. The profile object is
content-addressed in the `KSTACK-HOST-FIELD-VALUE-SCHEMA-V1` domain. Unknown
schema digests fail closed. Free text, credentials, secret material, embedded
tool declarations, and arbitrary booleans are therefore not valid values for
this V1 extension path.

This repair does not change canonical Agent Skills fields. `name`,
`description`, `license`, `compatibility`, and `metadata` remain governed by
the canonical frontmatter path and cannot be registered as additional host
fields.
