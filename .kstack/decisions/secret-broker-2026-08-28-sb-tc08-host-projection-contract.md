# KStack Secret Broker — SB-TC08 host-projection contract

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Item | `SB-TC08` — Claude/Codex projections, main-window questions, direct-path denial, capability truth, and multi-worker scheduling |
| Status | `REVIEW-REQUIRED` |
| Research cutoff | 2026-08-31 |
| Frozen dependencies | SB-TC00 `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`; SB-TC01 `7cce1f2fce8de5894c3b5e33c27a0d2754fe99afa18c702765f6e40c5564fe57`; SB-TC02 `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075`; SB-TC03 `b8aadd172e87a4c9f3c349890162b73b3f5e5682818c0428c25edb0534ac8c99`; SB-TC04 `3cf4c46653c6562ebf3f52a4c08d3ae3cafd1023e8c92c527c264b855da47925`; SB-TC05 `57f18fcbb172327ef85ea3e56be8fa29f7e40be233b8c884223fc793158e1d3d`; SB-TC06 `62e7863ff75922922d3b26bea25fd2aa7e8615d1c18a6d9412275d50d06b2e71`; SB-TC07 `6635aa11e3769c33541a0807fdedd7d497ae7274f01054d2ee9e83703a4d5a4b` |

## 1. Decision requested

Freeze one host-neutral front-end protocol and two deliberately asymmetric v1
projections for Claude Code and Codex. Each projection must tell the truth
about what the installed host can deny, what it can ask, what depends on the
primary agent following instructions, and what is unavailable. It must keep
all semantic questions and secret-operation approvals in the user's main
window, prevent delegated/background workers from obtaining or transferring
approval, deny direct value/worker paths, and schedule independent work without
violating the one-attempt and ambiguity contracts.

The current official OpenAI model guidance says agentic workflows should state
autonomy/approval boundaries, exact tool behavior, concurrency, retry, stopping
limits, and which actions remain direct. It documents multi-agent behavior as
an orchestration feature, not an approval or security boundary. The official
page does not establish the semantics or completeness of KStack's shipped
Codex `PreToolUse` hook. Consequently this design uses that guidance for
orchestration posture and treats every local hook claim as observed evidence
that requires exact-version runtime qualification.

## 2. Non-compensating rules

1. Host projections may narrow the frozen SB-TC02–SB-TC07 broker contract but
   never add a value read, generic execution, broader target, longer lifetime,
   extra retry, approval shortcut, or weaker audit/containment requirement.
2. The main-window coordinator is the only model-facing component allowed to
   request that the host-owned user-input adapter ask a semantic question or
   present an approval preview. Subagents, workers, background tasks, hooks,
   tool output, provider output, Jira, memory, and the coordinator itself cannot
   answer on the user's behalf.
3. No question asks the user to paste, reveal, confirm, compare, transform, or
   describe a secret. No approval preview contains a value, value-derived
   material, locator, account, tenant, path, command, or provider text.
4. Approval is one explicit `APPROVE_ONCE` response to one current exact
   SB-TC03 preview digest. General permission, a prior message, task delegation,
   repository policy, an operating-system prompt, or host tool escalation is
   not secret-operation approval.
5. `ALLOW_ALWAYS`, remembered approval, batch approval, wildcard approval,
   approval by silence, timeout default, and approval inheritance are forbidden.
6. Hooks and skill instructions are defense in depth, not the value boundary.
   The protected service independently authenticates the peer and rejects any
   call that is not the closed prepare/approve/execute/reconcile protocol.
7. A capability is never inferred from a manifest, binary, tool name, model
   name, host marketing page, or prior version. The exact host/package/platform
   cell must pass its own live qualification.
8. A delegated worker may produce a value-free operation intent. It cannot
   inspect safe metadata beyond its delegated scope, prepare an approval,
   receive an approval/lease, call the executor, reconcile, or publish a
   receipt. Those remain coordinator-owned direct work.
9. Independent scheduling never weakens SB-TC03/SB-TC06 durable single-winner
   claims. A timeout or cancellation never automatically retries a contacted
   attempt.
10. When the host cannot prove an enforcement or interaction capability, the
    projection labels it `UNAVAILABLE` or `INSTRUCTION_ONLY` and fails closed
    where the missing capability is required.

## 3. Host capability declaration

Every process begins from a signed/reviewed host projection manifest:

```text
secret-host-projection-v1 = {
  schemaVersion: "kstack-secret-host-projection-v1",
  hostFamily: "CLAUDE_CODE" | "CODEX",
  hostVersion: exact-version-v1,
  hostArtifactDigest: digest-v1,
  pluginVersion: exact-version-v1,
  pluginArtifactDigest: digest-v1,
  platformCellRef: registry-id-v1,
  mainSessionBindingMode: closed-session-binding-v1,
  questionSurface: "TRUSTED_MAIN_ADAPTER" | "DISPLAY_ONLY" |
                   "UNAVAILABLE",
  preToolDeny: capability-state-v1,
  preToolAsk: capability-state-v1,
  explicitBrokerInvocation: capability-state-v1,
  mainWindowQuestion: capability-state-v1,
  userAnswerAttestation: capability-state-v1,
  delegation: capability-state-v1,
  cancellationSignal: capability-state-v1,
  maximumConcurrentWorkers: positive-integer-v1,
  qualificationReceiptRef: opaque-ref-v1
}

capability-state-v1 =
  UNAVAILABLE | INSTRUCTION_ONLY | OBSERVED | SYNTHETIC_QUALIFIED
```

`OBSERVED` means one bounded behavior was seen locally; it is not an enforcement
claim. Only `SYNTHETIC_QUALIFIED` can satisfy a load-bearing projection gate.
The qualification receipt binds the exact host executable/package, plugin and
hook digests, OS build, invocation mode, user/project installation scope, tool
envelopes, and negative/positive fixtures. A host update, plugin update,
configuration change, enrollment change, executable relocation, or tool-schema
change invalidates the receipt.

The runtime recomputes exact artifact identity and performs a value-free
startup challenge for every required capability. If the effective host cannot
report a trustworthy exact version/artifact digest, that field is
`UNAVAILABLE`; a display string is insufficient. Capability state never rises
at runtime without a matching immutable qualification receipt.

## 4. Host-neutral front-end protocol

The model-facing front end exposes exactly:

```text
DescribeSafe(handleId, scope) -> SB-TC02 public metadata | NOT_AVAILABLE
PrepareIntent(operationIntent) -> question-or-preview-v1 | safe error
SubmitMainAnswer(questionId, userAnswerAttestationRef) ->
  next question-or-preview | safe error
ApproveOnce(previewId, previewDigest, userAnswerAttestationRef) ->
  approval result
ExecutePrepared(leaseId) -> SB-TC07 receipt | safe error
ReconcileReceipt(receiptId) -> safe reconciliation state | safe error
CancelPending(requestId) -> CANCELLED | ALREADY_TERMINAL | NOT_AVAILABLE
```

There is no provider operation, locator, path, URL, value, render, export,
template, arbitrary command, arbitrary environment, raw output, hook decision,
worker-selection, or retry parameter. The service, not the host, resolves the
registered backend/adapter/target from trusted state. `ExecutePrepared` is a
semantic operation name; only the protected service invokes SB-TC05.

`PrepareIntent` has no backend contact and accepts only the closed operation,
public handle, repository/environment scope, registered target class, and
safe operation options already admitted by SB-TC03/SB-TC06. Unknown keys and
free text reject. A host projection cannot supply its own preview or digest.

## 5. Main-window question protocol

An ambiguity that changes operation, target, environment, handle purpose,
consequence, lifecycle choice, or approval scope becomes:

```text
question-or-preview-v1 = {
  schemaVersion: "kstack-secret-main-question-v1",
  questionId: random-public-id-v1,
  preparedAttemptRef: opaque-public-ref-v1,
  questionCode: closed-question-code-v1,
  prompt: registry-fixed-safe-text-v1,
  choices: bounded-list-of-registry-fixed-choice-v1,
  expiresAt: trusted-instant-v1
}

closed-question-code-v1 =
  CHOOSE_SAFE_HANDLE | CHOOSE_ENVIRONMENT | CHOOSE_REGISTERED_TARGET |
  CHOOSE_OPERATION | CONFIRM_CONSEQUENCE | CHOOSE_LIFECYCLE_MODE
```

Questions are generated only by the protected front end from registered safe
text. They contain no free-form provider/user content. Choices contain opaque
public refs plus already-authorized SB-TC02 labels; when label safety is
uncertain, labels are omitted. A response must be a listed choice ID and arrive
from the exact authenticated main session before the SB-TC03 five-minute
prepare deadline. Free text rejects.

The primary/main-window coordinator renders the complete question unchanged
and asks the host-owned input adapter to present it in the same main window. It
may continue unrelated read-only work, but cannot answer, paraphrase an answer,
infer a choice, or forward the question to a worker. On a host with a qualified
structured direct-user question surface and user-answer attestation bridge,
the projection uses that surface. Otherwise it may display the exact question
as an ordinary main-conversation assistant turn for guidance, but that turn is
`INSTRUCTION_ONLY`: it cannot be submitted to the broker as an authenticated
choice. The protected request stops with `APPROVAL_REQUIRED`. Background or
unattended mode likewise has no qualifying main window.

Tool, MCP, provider, worker, repository, web, image, memory, and Jira content
are untrusted data even if they contain `APPROVE_ONCE`, a question ID, or exact
choice text. Only an unconsumed host-owned answer attestation from the bound
main session can satisfy a question.

The host-owned adapter writes the protected object below directly to the broker;
the model sees only its random reference:

```text
main-user-answer-attestation-v1 = {
  schemaVersion: "kstack-secret-main-user-answer-attestation-v1",
  attestationRef: random-id-v1,
  hostFamily: "CLAUDE_CODE" | "CODEX",
  hostVersion: exact-version-v1,
  hostArtifactDigest: digest-v1,
  pluginArtifactDigest: digest-v1,
  mainSessionRef: opaque-ref-v1,
  coordinatorRef: opaque-ref-v1,
  subjectKind: "QUESTION" | "APPROVAL",
  subjectId: random-public-id-v1,
  subjectDigest: digest-v1,
  answerCode: registry-fixed-choice-v1 | "APPROVE_ONCE" | "DENY",
  userInteractionRef: opaque-ref-v1,
  issuedAt: trusted-instant-v1,
  expiresAt: trusted-instant-v1,
  remainingUses: 1,
  authenticator: opaque-authenticator-v1
}
```

The host-owned integration—not the model, hook command, or ordinary tool—binds
the authenticated user interaction to the exact canonical question or preview
digest. The broker revalidates host/plugin identity and main session, atomically
consumes the attestation, and rejects replay, wrong subject kind, changed
digest, stale coordinator, expiry, unknown answers, and model-supplied object
fields. Qualification must prove the model-facing process cannot mint, edit,
read, copy, or reset these protected records. If the host supplies no such
integration, `userAnswerAttestation=UNAVAILABLE`; question/approval-required
secret operations are unavailable even though the agent can converse normally.

## 6. Exact approval projection

After all questions, the front end returns the exact SB-TC03 safe preview and
digest plus:

```text
host-approval-request-v1 = {
  schemaVersion: "kstack-secret-host-approval-request-v1",
  previewId: random-public-id-v1,
  preparedOperationDigest: digest-v1,
  previewSchemaId: registry-id-v1,
  previewDigest: digest-v1,
  mainSessionRef: opaque-ref-v1,
  coordinatorRef: opaque-ref-v1,
  expiresAt: trusted-instant-v1,
  allowedAnswers: ["APPROVE_ONCE", "DENY"]
}
```

The user sees the complete registered preview in the main window through the
host-owned adapter. The service accepts only a matching, protected, one-use
answer attestation from the exact main session/coordinator before expiry.
`APPROVE_ONCE` creates the SB-TC03 approval bound to the full prepared digest.
Any changed field, host/session handoff, coordinator restart, question, edit,
expiry, cancellation, or denial invalidates the request. Re-preparation
requires a new preview and attested answer.

A host-native permission/escalation prompt for running the broker command is a
separate host safety decision. It cannot replace `ApproveOnce`, and a prior
`ApproveOnce` cannot force the host to execute a denied tool call. When both
are needed, the semantic KStack preview is approved first; the host may then
apply its own narrower execution policy.

## 7. Claude Code projection

The currently shipped repository projection is observed to receive bounded
`PreToolUse` envelopes and emit deny decisions for covered direct credential,
direct worker, and policy-denied paths. It is also observed to emit an `ask`
decision only for an exact broker-prepared, session/tool-use-bound attestation.
Those are local implementation observations, not imported vendor guarantees.

A Claude cell may claim `PRE_TOOL_DENY` or `PRE_TOOL_ASK` only after live tests
prove the exact installed host invokes both user- and project-scope hooks for
every claimed tool envelope, honors denial, binds the returned ask to the same
tool use, and does not turn an ask into persistent allowance. A matcher gap,
timeout behavior that proceeds, skipped scope, malformed envelope acceptance,
or alternate tool path makes that capability unavailable.

Even when `PRE_TOOL_ASK` is qualified, the hook may ask only for the exact
`host-approval-request-v1` already created by the main coordinator. It cannot
create, broaden, or auto-answer the preview. All non-broker ask-tier direct
actions remain denied and must be re-prepared. Hook stdout/stderr is fixed,
value-free, and bounded by SB-TC07.

## 8. Codex projection

The currently shipped repository hook deliberately prohibits an `ask` response
for Codex and abstains on ask-tier actions. Therefore v1 declares
`preToolAsk=UNAVAILABLE` for Codex. KStack must not describe Codex as providing
forced KStack approval, automatic approval interception, or a guaranteed
real-time secret-operation prompt.

Codex may use the broker safely through explicit skill/front-end invocation:

1. the primary Codex agent calls `PrepareIntent` directly;
2. any semantic question is presented in the main window by a qualified
   host-owned KStack user-input adapter, never a subagent or background task;
3. that adapter deposits a protected one-use answer attestation and returns
   only its random reference to the primary agent;
4. the same adapter shows the complete approval preview and records a fresh
   attested `APPROVE_ONCE` or `DENY`; and
5. the primary agent passes only those references to `SubmitMainAnswer` or
   `ApproveOnce`, then calls `ExecutePrepared` directly.

If a structured direct-user input tool is currently available to the primary
agent, it may display the fixed choices only when a qualified host-owned bridge
also emits the protected attestation; tool availability alone is not enough.
Availability is session/mode-specific, and its appearance in documentation or
another run is not capability proof. Without the attestation bridge, ordinary
assistant/user turns remain useful conversation but are `INSTRUCTION_ONLY` and
cannot approve a Secret Broker operation. A Codex shell/tool approval is
separate and never substitutes for the semantic preview response. Operations
whose frozen SB-TC03 policy genuinely requires no question or human approval
may still use explicit invocation when every other gate passes.

Codex `PreToolUse` deny may be claimed only for exact qualified covered paths.
Because explicit invocation can be bypassed by an unrecognized tool, plugin
disablement, or a direct OS process, denial hooks remain defense in depth. The
protected broker protocol, worker peer authentication, OS access controls, and
absence of any value-return API are the security boundary.

## 9. Direct-path denial

Every projection registers these deny classes:

```text
DIRECT_VALUE_SOURCE
DIRECT_BACKEND_CLIENT
DIRECT_BROKER_WORKER
DIRECT_ADAPTER_OR_EXECUTOR
GENERIC_SECRET_INJECTION
UNREGISTERED_TARGET
UNPREPARED_BROKER_EXECUTION
LEASE_OR_APPROVAL_TRANSFER
CONTROL_PLANE_MUTATION
```

Host hooks deny recognized attempts where qualified. The front-end and
protected service independently reject them regardless of hook outcome. Worker
binaries accept only mutually authenticated protected-service peers, an
attempt-bound channel, and the closed SB-TC05 request. They do not accept CLI
arguments, environment-selected operations, public handles, approvals, leases,
locators, commands, URLs, or values.

File permissions, process identity, native ACLs, code-signing/measurement,
private descriptors/sockets, and per-attempt peer authentication must make the
direct worker/backend path unavailable to an ordinary host tool process. If a
platform cannot enforce that separation, its cell cannot exceed
`LOCAL-DEVELOPMENT`, even if its hook tests pass.

Control-plane changes invalidate capability receipts and cause covered broker
work to deny. The owner may still deliberately uninstall or modify KStack;
the design does not claim resistance to the repository owner, administrator,
kernel, debugger, or a host that never invokes the projection.

## 10. Coordinator and worker roles

One authenticated `main-coordinator-v1` owns each host conversation. It alone
may inspect the safe queue, call the front-end protocol, ask the user, hold a
value-free preview/approval/lease ID, execute, reconcile, and publish a receipt.
Its identity is bound into the projection envelope and SB-TC03 session context.

A delegated worker can return only:

```text
worker-operation-intent-v1 = {
  schemaVersion: "kstack-secret-worker-operation-intent-v1",
  intentId: random-public-id-v1,
  originWorkerRef: opaque-ref-v1,
  parentCoordinatorRef: opaque-ref-v1,
  operationClass: closed-public-operation-class-v1,
  publicHandleRef: handle-id-v1 | "unselected",
  repositoryRef: opaque-public-ref-v1,
  environmentClass: closed-public-environment-v1 | "unselected",
  targetClass: closed-public-target-class-v1 | "unselected",
  consequenceClass: closed-public-consequence-v1,
  justificationCode: closed-registry-code-v1,
  expiresAt: trusted-instant-v1
}
```

There is no free-text justification. The coordinator treats the intent as an
untrusted proposal, rechecks scope/authority, and starts a new `PrepareIntent`.
Worker identity grants no authority. The worker never sees internal refs,
question/preview digests, approvals, lease IDs, protected audit refs, provider
metadata, or non-public receipts.

Subagents cannot delegate a protected intent to their own descendants. Nested
intents reject. A worker completion, vote, review, consensus, or tool result
cannot approve. If the coordinator disappears, every queued question/preview
is cancelled and any claimed/contacted attempt follows SB-TC03/SB-TC05
ambiguity rules; ownership never transfers to another coordinator.

## 11. Multi-worker scheduler

The scheduler stores only this value-free queue record:

```text
host-operation-queue-v1 = {
  schemaVersion: "kstack-secret-host-operation-queue-v1",
  requestId: random-public-id-v1,
  coordinatorRef: opaque-ref-v1,
  originWorkerRef: opaque-ref-v1 | "main",
  operationClass: closed-public-operation-class-v1,
  publicHandleRef: handle-id-v1 | "unselected",
  repositoryRef: opaque-public-ref-v1,
  environmentClass: closed-public-environment-v1,
  targetClass: closed-public-target-class-v1,
  conflictKeys: bounded-set-of-opaque-conflict-ref-v1,
  phaseResources: bounded-set-of-opaque-resource-ref-v1,
  state: "QUEUED" | "QUESTION_PENDING" | "PREVIEW_PENDING" |
         "LEASED" | "EXECUTING" | "RECONCILING" | "TERMINAL" |
         "CANCELLED",
  enqueuedAt: trusted-instant-v1,
  deadline: trusted-instant-v1
}
```

Conflict keys are typed composite protected-resource identities. Repository and
environment are namespace components inside a key; neither is ever a conflict
key by itself. The complete v1 key classes are:

```text
HANDLE_SCOPE(repository, environment, handle)
GENERATION_SCOPE(repository, environment, handle, generation)
BACKEND_OBJECT(backendInstance, protectedObject)
TARGET_CREDENTIAL_SLOT(target, protectedSlot)
ISSUED_INSTANCE(handle, templateGeneration, attempt)
LIFECYCLE_RESERVATION(handle, lifecycleRevision)
```

The protected service derives opaque refs for the applicable classes; callers
cannot supply, omit, or inspect them. Requests with the same exact typed
composite key never overlap. An ordinary stored-secret use holds
`HANDLE_SCOPE`, `GENERATION_SCOPE`, and its exact `TARGET_CREDENTIAL_SLOT` while
contact is possible. Dynamic use additionally holds `ISSUED_INSTANCE`.
Lifecycle work holds the same handle/generation/backend/target keys plus
`LIFECYCLE_RESERVATION`, so it conflicts with every ordinary use and competing
lifecycle attempt for the affected resources. Different handles in the same
repository/environment do not conflict unless they bind the same backend object
or target credential slot.

`phaseResources` includes the protected audit-writer ref and any adapter,
backend, or target capacity semaphore that serializes only a bounded phase. It
is not a whole-request conflict key. The scheduler acquires the SB-TC07
singleton audit writer only
for each pre-contact or terminal append/head commit, releases it after the
commit, and never holds it while waiting for a question/approval or during the
provider/target call. An independent request may execute while another request
waits to append, but neither may contact its backend before its own anchored
pre-contact event. Audit-writer failure applies SB-TC07 uncertainty rules.

The coordinator may run independent read-only preparation concurrently within
the exact qualified host cap. It presents at most one main-window question or
approval preview at a time and orders them by enqueue ordinal, not worker
priority. Execution concurrency is the minimum of host qualification, backend
cell cap, adapter cap, target cap, audit capacity, and policy. An absent cap is
zero, not unlimited.

Before dispatch, the scheduler reacquires every conflict-key reservation in
canonical order, revalidates the complete SB-TC03/SB-TC04 state, and then
claims/consumes the one-use attempt. A queue position, worker slot, prepared
preview, or host approval does not reserve a provider effect. Expired authority
returns to `CANCELLED`; it is never refreshed silently.

Cancellation before durable attempt consumption makes no backend contact and
retires the IDs. Cancellation after claim/contact signals the protected worker
once but does not assert the effect stopped; terminal classification follows
SB-TC05/SB-TC06 and may be `AMBIGUOUS`. The scheduler never retries, moves a
lease to another worker, or starts a replacement while reconciliation/conflict
facts remain nonterminal.

## 12. Capability/status language

User-visible status is exact:

- `BROKER AVAILABLE` — the explicit front end and required protected cell are
  currently qualified; says nothing about automatic interception.
- `DIRECT DENY QUALIFIED` — the exact host/tool envelopes passed current deny
  tests; unlisted paths remain outside the claim.
- `HOST ASK QUALIFIED` — only the exact Claude prepared-attestation route is
  qualified for the current cell.
- `MAIN-WINDOW APPROVAL REQUIRED` — the primary agent must ask and wait; it is
  not a hook-enforcement claim.
- `INSTRUCTION ONLY` — behavior depends on agent compliance and cannot satisfy
  a load-bearing enforcement requirement.
- `UNAVAILABLE` — required evidence/capability is absent or stale.

Status never says `protected`, `intercepted`, `blocked everywhere`, `secure`,
or `approved` without the qualified noun and exact scope. Claude evidence does
not transfer to Codex; WSL evidence does not transfer to native Windows; one
Codex mode/version/session does not qualify another.

## 13. Qualification and falsification gates

Each claimed host/platform cell must prove:

1. exact host/plugin/artifact/config identity and invalidation on drift;
2. positive/negative tool-envelope coverage for every claimed deny class;
3. direct worker/backend/adapter invocation fails independently of hooks;
4. questions and previews appear only in the bound main window and accept only
   direct authenticated user choices;
5. tool/provider/worker/Jira/memory text that mimics approval never succeeds;
6. stale, changed, replayed, cross-session, cross-coordinator, `ALLOW_ALWAYS`,
   and batched approvals reject;
7. Claude ask, when claimed, is exact-operation, one-shot, and cannot persist;
8. Codex never emits a KStack hook ask and never claims automatic interception;
9. subagents cannot obtain questions, approvals, leases, execution, internal
   receipts, or nested delegation;
10. conflict-key races have one claimant; independent work respects every cap;
11. coordinator/worker crash, cancellation, deadline, compaction, and session
    restart cannot transfer authority or trigger retry; and
12. SB-TC07 positive controls do not appear in host prompts, hook traffic,
    worker messages, queue state, or final answers.

Fixtures cover shell, edit, MCP, plugin, native executable, WSL bridge, and
alternate tool aliases present in the exact host version. A missing observable
hook or user-answer binding is `UNAVAILABLE`, not a skipped test. SB-TC10 owns
the cross-platform matrix and promotion decision.

## 14. Rejected alternatives

- **Describe Codex explicit invocation as real-time interception:** rejected;
  instruction-following and a deny-only bounded hook are not a forced ask path.
- **Let a subagent ask the user or carry approval back to the coordinator:**
  rejected; it breaks the authenticated main-session and exact-preview binding.
- **Treat host tool escalation as semantic operation approval:** rejected; the
  prompts authorize different subjects.
- **Pass a one-use lease to the worker that proposed the operation:** rejected;
  it makes delegation an authority-transfer channel.
- **Allow several simultaneous approval prompts:** rejected; responses can be
  misbound and background workers can create approval pressure/fatigue.
- **Use hooks as the only direct-path defense:** rejected; hooks may be absent,
  bypassed, disabled, or incomplete and do not protect a directly callable
  worker.
- **Infer capability from installed files or a successful prior version:**
  rejected; host behavior and tool schemas are mutable and cell-specific.
- **Automatically retry cancelled/timed-out work on another worker:** rejected;
  possible contact makes the effect ambiguous and authority non-transferable.

## 15. Source posture

- [Official OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model)
  — mutable official documentation, read 2026-08-31. It supports explicit
  autonomy/approval boundaries, exact tool contracts, concurrency/retry/stopping
  limits, direct handling for approval actions, and measured multi-agent use.
  It does not document or validate KStack's Codex hooks.
- `plugins/kstack/hooks/codex-hooks.json`,
  `plugins/kstack/hooks/hooks.json`, and
  `plugins/kstack/scripts/kstack-safety-hook.mjs` — mutable repository evidence
  inspected 2026-08-31. They show the current intended local projections,
  including the explicit structural prohibition on Codex `ask`; they are not
  runtime qualification or vendor documentation.

No undocumented host behavior is load-bearing. SB-TC08 accepts only the exact
asymmetric claims above until a future, separately reviewed host capability is
officially documented and independently qualified.
