# Release M7 round 4 — remove prepared-state abort

**Frozen base digests:**
`6f0251d327f7b92eec5a3b0c0ff4e82b4bb0b9e6aac7654955a801c2219e424c`,
`bb4cd89148882a3d4aa9776bfe7b02f023fc59e875d36dae8b24d4c0340e16ed`,
`d4223394a2820742e78a716a763b63a3232f9b6ab39c6d5c778dbb1766d1e4b8`
**Prior Codex:** 92 revise in 9033 ms
**Mode:** one concrete security fix only

Delete `WitnessAbortCertificateV1` and every prepared-state abort, expiry,
timeout-clear, overwrite, or sequence-reuse path.

For one witness-set generation, checkpoint sequence, and prior checkpoint, a
witness that signed a proposal remains durably `PREPARED` for that exact digest
until it receives the one byte-identical unanimous
`WitnessCommitCertificateV1`. Only that certificate may atomically advance its
committed head. It never signs another proposal for the slot and never treats
prepared state as current authority.

Recovery reads every witness:

- if the full unanimous commit certificate exists or can be reconstructed from
  all matching prepares, replay that exact certificate to every laggard;
- if prepares are missing, split, unavailable, or cannot form one byte-identical
  full certificate, preserve safe gridlock; and
- if continued operation is required, the owner must approve a new trust domain,
  witness set, profile, and genesis that explicitly tombstones the old domain.
  Old sequences, slots, keys, receipts, and history are never imported as
  redeemable authority or reused.

There is no administrative force-clear. Witness backup restore must retain the
prepared slot; loss is gridlock, not absence. Qualification races crashes,
network partitions, concurrent brokers, partial prepares, complete-but-
undelivered certificates, partial commits, witness restore, and new-domain
enrollment. It proves that one old-domain slot has zero or one committed digest,
never a commit/abort pair, and no old authority becomes redeemable in the new
domain.

All round-3 time-quorum and HKDF clauses remain unchanged. Closure requires
Codex confidence at least 93 with zero failed checks, security findings,
material dissent, and unresolved M7 questions. Runtime remains
`TARGET_FIXTURE_NOT_YET_QUALIFIED`. No Opus, implementation, credential access,
privileged run, remote setup, external mutation, report edit, commit, push, or
deployment is authorized.
