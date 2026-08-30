# HB-TC01 implementation clarifications after independent review round 2

Date: 2026-08-29  
Scope: bounded clarification of the approved HB-TC01 chain; Option C, authority
boundaries, reuse dispositions, and installer non-authority remain unchanged

## Destructive migration handoff

`MIGRATE` receives the exact `PreservationBaselineV1`, its dereferenced
`InstalledMemberManifestV1`, the exact candidate `RenderBundleV1`, the
`InstallerCandidateV1`, the migration proposal, and its authorization. The
handoff validator validates every closed schema and digest-typed field, derives
the complete UTF-8-byte-sorted `ADD|REMOVE|CHANGE` set again from the installed
and candidate member inventories, and requires byte-for-byte canonical equality
with the supplied proposal. Required test evidence is nonempty. It reconstructs
and exactly compares the authorization, requires `APPROVE` with a non-null risk
acknowledgement, and cross-binds registry, target, platform, scope, and
destination template. Caller-created lookalike objects never substitute for
these checks.

## Projected frontmatter

Registered host fields are emitted as bounded scalar fields. Canonical Agent
Skills scalar fields retain their fixed order; additional registered scalar
keys follow in UTF-8 byte order; `metadata` remains last with UTF-8-byte-sorted
nested keys. The renderer parses its emitted bytes under the exact allowed key
set, reconstructs the projected semantic wrapper, requires semantic equality
with the planned field map, and requires canonical re-emission to reproduce the
same bytes.

The skill-identity key `name`, structured `metadata`, experimental
`allowed-tools`, and authority-, activation-, principal-, role-, credential-,
or secret-like keys are reserved and cannot be registered as host scalar
fields. Registered canonical scalar keys such as `description` may be
target-reencoded, but the emitted skill identity cannot be replaced.

`KEEP` versus `REENCODE` is decided per field: an unchanged canonical semantic
value is `KEEP`; a retained key with a different value is `REENCODE`. Changes
to another field do not relabel unchanged fields. New registered fields are
`ADD`, and removed canonical fields are `DROP`.

`AGENT_SKILLS_CANONICAL` preserves every canonical field present in each entry
source. `CLOSED_ALLOWLIST` may intentionally remove optional canonical fields,
but it must retain `name` and `description`. Both modes admit only canonical
source keys plus registered host fields.

## Unsupported and omitted resources

The round-4 `partitionMaps.disposition` enum is extended with `UNSUPPORTED`
only for source partitions whose complete model-visible resource disposition is
`UNSUPPORTED`. Such rows bind the source span, carry the registered unsupported
reason, and have null output offsets and digest because the separately mapped
generated status member accounts for all output bytes. `PRESERVE|OMIT` remains
the complete enum for supported resources.

Non-model members are `EXACT` only in v1. They cannot enter the markdown status
template path or change media type. The fixed
`projection-nonsemantic-framing-omitted` reason must resolve in the bound reason
registry before any typed projection is accepted.

## Determinism and evidence

Every key, path, member, reuse-admission digest, field, and other set-like name
that contributes to a content-addressed HB-TC01 object is ordered by its NFC
UTF-8 bytes. Evidence for a reproduction command binds the digest of every file
named by that command, including its test driver rather than only a helper it
loads. These clarifications are testable acceptance requirements for the next
fresh independent review.
