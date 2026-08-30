# KStack host profile contract

Host profiles make KStack methods portable without turning prompt text into an
authority boundary. A profile declares a host's instruction filename, semantic
tool-role mapping, capabilities, and supported modes. Canonical skills refer to
roles such as `inspect`, `search`, `execute`, `edit`, and `delegate`; renderers
never rewrite another host's prompt through global string replacement.

Rendering and execution qualification are separate. Hermes and OpenClaw may be
rendered for review and fixture testing, but an execution request is admitted
only against an unexpired qualification cell for the exact host, version,
platform, mode, and capabilities. Environment variables and host-generated
markers are observations, not evidence of qualification.

Routing uses mutation class, protected-value involvement, risk signals,
capability requirements, and evidence obligations. Source-line count is not an
authority signal. Protected operations are sent to bounded target adapters,
never to a general model host. Direct protected-value read, render, and generic
environment-injection capabilities are forbidden in profiles and cells.

Generated artifacts are deterministic and digest bound. They describe method;
they cannot grant authority, expand a work envelope, or borrow evidence from a
different host, mode, platform, provider, or version.

Delegated execution consumes a closed work envelope bound to repository
identity, authority snapshot, objective and plan, host and mode, exact operation
classes, risk signals, budgets, lifetime, nonce, and required evidence. A
content-free receipt must bind back to that envelope and the qualified cell.
`possibly-acted` is nonterminal and permits query-only reconciliation; it never
permits automatic retry. Even a proved `no-effect` result requires the owner or
coordinator to issue a new envelope rather than replaying the old nonce.

## Candidate qualification

`kstack-host-qualification.mjs` is the only production path from observed host
evidence to a qualification cell. Records are closed, time bounded, and bind
the signed tag object, exact commit, lockfile, runtime, isolation behavior,
source findings, current advisory counts, functional tests, and mode-specific
constraints. A rejected record returns stable reasons but no cell.

Native analysis admits only file inspection and text search with delegation
denied. Delegated modes require a non-zero timeout, external sandbox evidence,
and external-launcher mediation. OpenClaw ACP cannot satisfy those boundaries
with host configuration alone because its ACP harness is outside the OpenClaw
sandbox and explicit ACP spawning remains separate from automatic dispatch.

As of 2026-08-28, the recorded Hermes and OpenClaw candidates are negative
fixtures. Host-native package rendering remains available; production runtime
execution remains blocked until a new exact candidate passes every gate.

Linux platform, lifecycle, and privileged-backend results use the retained-byte
bundle admission in [LINUX_QUALIFICATION.md](LINUX_QUALIFICATION.md). Digest
fields without the exact admitted evidence inventory are not qualification.
