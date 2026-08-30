# Goose v1.48.0 protected conformance qualification

Status: `PASS` for the single operation profile
`goose.advisory-public-read.v1`.

This qualification does not grant whole-host support. It establishes only the
operation-scoped `advisory` claim represented by `OPERATION_SCOPED_ONLY`.

## Result

- Exact reproducibly built Goose binary SHA-256:
  `057a1788b48cc1452203920afd31eac274d5b9cb10026734d587e5db33885792`.
- Protected fixtures: 20 of 20 passed, with one positive and one expected-denial
  fixture for each of the ten registered fixture groups.
- Executions: 20 of 20 independently replayed from protected observer receipts.
- Provider requests: 18 credential-free loopback requests.
- Production credentials and targets: absent.
- Namespace boundary: user, network, mount, and PID namespaces with loopback as
  the only network interface, no-new-privileges, all capabilities dropped,
  bounded resources, and zero live descendants after provider shutdown.
- Evidence expiry: `2026-09-06T04:36:28.942Z`.

## Current evidence bindings

- Evidence digest:
  `sha256:4b14bddf46e0cf52a1e93d057b79542affbc4fdec2653698a9507ceae3f0bb7f`.
- Evidence-set digest:
  `sha256:49c064e777059c04e6a9ce484a1760d5b2443aeb222f7ab5b91bd0143c5d4cf3`.
- Operation-status digest:
  `sha256:16e0238f3967082c170be47fa85949e569c66c597f4f997df53ddeb3f4a6f15c`.
- Fixture-set digest:
  `sha256:dd0d5d1ce3e95673e376996ef0a479c7eb7527b461eacecc365d738aa2c4a77d`.
- Provider implementation digest:
  `sha256:91ae7f601b3928cf17a8fc9963b438d7b9792d08604839b112de500bca00634e`.
- PID1 reaper source digest:
  `sha256:6cd19410eb124db0ee7664b01f3761c122dc02ef6a876257604bc6c190343b01`.

The campaign binds the exact binary, reproducible-build and supply-chain
evidence, Goose adapter, Goose-specific conformance registry, synthetic
provider, PID1 reaper source, active install manifest, dependency gates, exact
fixture set, environment facts, observer set, isolation target, side-effect
budget, authoritative clock, and current child-harness bytes. The standalone
validator recomputes those bindings and independently adjudicates all 20
executions from closed-schema evidence.

## Host-specific observations

- Goose discovers project instructions from `.agents/skills`; the positive
  fixture observes exactly one project probe while the duplicate-root negative
  fixture independently detects both project and global candidates and denies
  admission before advisory execution.
- Goose emits a tabular native skill inventory and structured JSON advisory
  output. The adapter binds the native formats instead of translating OpenCode
  event semantics into Goose evidence.
- The native-permission negative fixture receives a structured `bash` tool
  proposal, observes Goose reject it because the qualified profile has no tools,
  and independently verifies that the repository remains unchanged.
- A response-loss fixture is adjudicated at the protected effecting-provider
  boundary. A possibly committed outcome is denied after exactly one provider
  call and is never blindly retried.
- Subject repository mutations are measured for every native Goose execution
  and flow into each protected adjudication row as forbidden-side-effect state.

## Remaining limits

- No privileged, write-capable, approval-bearing, deployment, or general
  background-operation profile is promoted by this result.
- The background fixtures prove bounded lifecycle behavior inside this advisory
  campaign only.
- HB-TC06 now has fresh current OpenCode evidence and a fail-closed integrated
  two-host proof candidate; promotion still requires the bound independent
  final review.
- Fresh independent final review of the integrated Host work remains required
  before final runtime closure. No external review payload was dispatched by
  this qualification.
