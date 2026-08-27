# Objective brief: worker-first KStack orchestration

**Date:** 2026-08-26
**Status:** ready for isolated Codex-only process-improvement review
**Scope:** KStack skill control plane only

## Problem

KStack currently assigns phase roles and provider reviews but gives no shared,
host-neutral rule for delegating ordinary repository work to worker agents.
The root/main CLI can consequently become both coordinator and implementer,
obscuring parallel capacity, owner questions, review status, and which agent is
actually running work.

## Owner-required outcome

Make worker-agent delegation the default for KStack execution while the
root/main CLI remains the coordinator and message relay. When worker capacity
exists, root avoids task implementation and review work and instead:

- scopes and assigns independent work;
- keeps a truthful running/queued/owner-blocked ledger;
- relays owner questions, changes, approvals, blockers, and results;
- reconciles worker outputs and shared repository state; and
- emits a compact console overview at every material update containing process,
  last round, confidence, defects/errors, duration, and status.

For the active program, that overview is append-only: current active, queued,
and owner-blocked work coexists with a `CLOSED` history that never drops a
closed process. Each closed row retains the process/item, final round, final
Codex score, any permitted Opus closure score, final defect/error counts,
duration, exact terminal outcome, digest/evidence link, and scope remaining
outside that closure. When a provider round exists, report its exact
manifest-recorded duration in addition to cumulative process duration.

Owner questions are never relayed as shorthand IDs. Before requesting input,
root shows every stable ID with its complete question and safety/scope clauses,
recommended answer, rationale/consequence/tradeoff, blocked work, and accepted
`Yes`/`No`/`Comment` form. It uses a separate selectable response control per question
when the host supports one and otherwise renders the same explicit choices;
questions are never collapsed into a bulk selector. After an answer, root prints a per-question ID/topic to
recorded-answer-and-meaning readback before locking or dispatching it.

Finite capacity must be represented honestly. A queued item is not a running
agent, an unavailable host capability is not an agent, and no named worker may
be claimed before the host confirms it exists. Delegation never broadens
permissions or changes the owner's standing Codex-only improvement / qualified
Opus closure routing.

## Proposed implementation boundary

Add one concise shared orchestration reference and minimal links/rules in the
KStack skills that coordinate material objectives, design, clarification,
implementation, interrogation, QC, full review, and setup. Do not duplicate the
full protocol across skills or create a scheduler service. Add structural
conformance tests and update the generated install-health audit manifest so the
new reference and changed skills deploy as one verified payload.

## Success evidence

- Every applicable skill loads one canonical orchestration reference.
- The reference distinguishes actual workers from queued and owner-blocked work,
  defines a default-delegate decision, and preserves direct root fallback only
  for coordination, truly nondelegable work, no worker capability, or explicit
  owner direction.
- Material status output has all owner-requested fields and deterministic
  definitions for missing scores, defects, errors, and elapsed time.
- Active/queued work and append-only closed history are shown together; closed
  rows retain scores, exact provider-manifest and process durations, outcomes,
  evidence/digest, and remaining scope.
- Question fixtures reject shorthand-only requests or answer locks without a
  full per-question readback, and require exactly `Yes`, `No`, and `Comment`.
- Worker assignments bind scope, authority, inputs, files, expected output,
  stop conditions, and reporting; a worker cannot grant itself or descendants
  more authority.
- Root relays every owner/auth/scope/blocker/result event and remains the only
  owner-facing coordinator unless the host itself forces a different UI.
- Tests prove applicable skills link the shared reference, its state/event and
  status contracts are complete, other skills do not copy the protocol, and
  the install payload manifest matches the changed tree.

## Non-goals

- Implementing a cross-host scheduler, daemon, persistent message bus, or new
  worker API.
- Claiming worker support on a host without an observed delegation mechanism.
- Changing KStack authority, model routing, confidence thresholds, review
  independence, or provider invocation code.
- Letting workers contact the owner directly when root can relay, silently
  answer owner questions, spawn untracked descendants, or edit the same files
  concurrently without an explicit collision plan.
- Commit, push, deployment, or other external mutation.

## Authority

This objective authorizes project-local design/review artifacts. Implementation
may begin only after the owner-directed Codex/Opus process-improvement closure
rule passes. It does not authorize commit, push, deploy, or external mutation.
