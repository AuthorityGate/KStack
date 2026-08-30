# OpenCode v1.18.25 protected conformance qualification

Status: `PASS` for the single operation profile
`opencode.native-skill-advisory.v1`.

This qualification does not grant whole-host support. It establishes only the
operation-scoped `advisory` claim represented by `OPERATION_SCOPED_ONLY`.

## Result

- Exact pinned OpenCode binary SHA-256:
  `d91e0d33676d0839f7cde87924cd4127ea88c9d6784eea9f009a7d08bdc60eeb`.
- Protected fixtures: 20 of 20 passed, with one positive and one expected-denial
  fixture for each of the ten registered fixture groups.
- Executions: 20 of 20 independently replayed from protected observer receipts.
- Provider requests: 16 credential-free loopback requests.
- Production credentials and targets: absent.
- Namespace boundary: user, network, mount, and PID namespaces with loopback as
  the only network interface, no-new-privileges, all capabilities dropped,
  bounded resources, and zero live descendants after provider shutdown.
- Evidence expiry: `2026-09-06T04:35:46.611Z`.

## Current evidence bindings

- Evidence digest:
  `sha256:8af39cb7ccc1821eaab5dd1168ae52cd950695156864b2e3c90693ea3ab5551f`.
- Evidence-set digest:
  `sha256:0059d0767ac77370f81079df09d03c6cd0ebfb5e01274521411594668285b5cc`.
- Operation-status digest:
  `sha256:5a08f0b283a14583c7e569e42e26dcdfbb927f03c2f1c7a71a0016d2643053d5`.
- Provider implementation digest:
  `sha256:3cde7f47bc29dab5dee8cd548f4edaf70d6d496cb9c37bc1047794ddf967ae30`.
- PID1 reaper source digest:
  `sha256:6cd19410eb124db0ee7664b01f3761c122dc02ef6a876257604bc6c190343b01`.

The final campaign binds the pinned binary, official provenance, adapter,
conformance registry, provider implementation, PID1 reaper source, active
install manifest, dependency gate, exact fixture set, environment facts,
observer set, isolation target, side-effect budget, authoritative clock, and
current child-harness bytes. The standalone validator recomputes those current
file bindings and independently adjudicates every execution from the raw
closed-schema inputs.

## Corrections exposed by the campaign

- GNU `timeout` reports a SIGKILL deadline as either status 124/137 or a null
  status with `SIGKILL`; the final oracle binds the signal, elapsed interval,
  bounded PID1 drain, and zero descendants rather than trusting one status form.
- The native-permission negative fixture observes the independent filesystem
  side effect, not command text that merely appeared in the proposed native
  event sequence.
- The response-loss fixture is adjudicated at the protected effecting-provider
  boundary. A possibly committed response loss produces denial after exactly
  one action-provider call and never permits a blind retry.
- The provider and reaper sources are now content-addressed currentness inputs;
  changing either invalidates the evidence.

## Remaining limits

- No privileged, write-capable, approval-bearing, deployment, or general
  background-operation profile is promoted by this result.
- The background fixtures prove bounded lifecycle behavior inside this advisory
  campaign; they do not grant a broader background-operation claim.
- HB-TC06 now has distinct current OpenCode and Goose evidence sets plus a
  fail-closed integrated proof candidate; promotion still requires the bound
  independent final review.
- Fresh independent final review of the integrated Host work remains required
  before final runtime closure. No external review payload was dispatched by
  this qualification.
