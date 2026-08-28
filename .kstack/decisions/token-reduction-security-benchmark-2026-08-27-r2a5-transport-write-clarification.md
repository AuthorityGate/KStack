# R2a.5 normative addendum: transport-write clarification

Status: PROPOSED DESIGN-ONLY LOW-RESIDUAL REPAIR  
Date: 2026-08-27  
Base SHA-256: `264941a83b6fd4bdf04c01059243e7995e1a1060cbd82f09954d3114b845d558`  
R2a SHA-256: `1f0b3bfb284f10e4af02103dd012fa2aafafc9f67a6d57a062ed4c238750f16d`  
R2a.1 SHA-256: `6de688651700fc6c3d522362b035ff5e380640de29ce0785c6c6a9f82a1ae0b3`  
R2a.2 SHA-256: `0db0058ce1e650f6b9a1ca884252e4f8b24cfc4c55f29e22a4cbeff1a5a72a2c`  
R2a.3 SHA-256: `fcaa90359dacff5ba221e9f2fd9dc79e6cc258780eb140b017cbc89d3f3e94aa`  
R2a.4 SHA-256: `eace05f3df449ff60ce698520ea6d26da1935e1efc1949db30c7aeeaa37ac1c6`  
Scope: final LOW transport-write ambiguity only.  
Implementation/external-review authority: none granted.

## 1. Replacement rule

Every R2a.3/R2a.4 prohibition on a “second physical send” is replaced by the
following exact rule:

> A capability authorizes exactly one logical request on exactly one qualified
> connection attempt. It forbids a second logical request, a second connection
> attempt, or any application/transport retransmission. The broker may perform
> multiple partial transport writes solely to consume the exact remaining
> byte/frame budget of that same capability-bound request, in order, from the
> already realized immutable request state.

Partial writes do not mint a new budget and do not reset an offset. After each
write, the broker atomically advances the sole monotonic committed offset/frame
cursor and reduces the remaining bound budget. A later write may contain only
the exact next suffix/frames already bound by the same request and capability.

The broker forbids regeneration or reserialization of any byte, replay from
offset zero or any prior offset, duplicate/overlapping frame ranges, reconnect,
alternate socket/stream, retry after ambiguous write result, budget increase,
write after the terminal request marker, and write after transition to
response-read-only or closed. A zero/short/interrupted write may continue only
when the OS/TLS result proves exactly how many bytes were accepted; an unknown
accepted count enters the global security-stop/indeterminate state without
retry.

For `AuthRefreshCapabilityV1`, “exactly one logical refresh request” uses the
same rule. Multiple bounded partial writes may finish its one request; no second
logical request, connection attempt, or retransmission is permitted.

## 2. Required tests

- Force every short-write boundary and prove the cursor resumes at the exact
  next byte/frame without duplication or regeneration.
- Inject ambiguous accepted counts and prove no retry, reconnect, or replay.
- Attempt offset rollback, overlap, skip, extra frame, new socket, and
  post-terminal/post-response-only writes; each must enter global security stop.
- Prove one request completed through many exact partial writes is accepted and
  still consumes only one capability.

## 3. Self-assessment

R2a.5 design-readiness self-score: **99/100**.  
Independent R2a.5 review: **not run**.  
LOW residual addressed: **one of one**.  
Qualified routes/profiles: **zero pending evidence**.  
Implementation/runtime changes: **none**.
