# Authority and verification invariants

Reflexion retrieval, repair, runtime-contract, and prompt-routing details are documented in [REFLEXION.md](REFLEXION.md).

- KStack never replaces the host's workspace, home, agent configuration, or
  permission profile.
- KStack never grants itself permissions. Apply both host policy and
  `.kstack/config.json`; the more restrictive boundary wins.
- Bounded safety hooks are default-on at user and enrolled-project scope. They
  never emit `allow`. Claude may ask only for a broker-prepared, attested action;
  Codex is deny-only and makes no ask-tier coverage claim.
- Credential access is a hard pre-tool invariant on covered paths. Credential
  values are not broker request fields, scan artifacts, previews, logs, process
  arguments, or process environments. Git-push credentials live by default at
  `$XDG_CONFIG_HOME/kstack/credentials/git-push.json` (falling back to
  `$HOME/.config/kstack/credentials/git-push.json`), mode 0600, outside the
  repository. The file contains exactly `version`, `kind`, `remoteUrl`,
  `username`, and `token`; v1 requires `version: 1` and
  `kind: "https-token"`. `remoteUrl` binds the credential to the exact approved
  HTTPS target (plain HTTP is admitted only for loopback testing).
- After scan, dual approval, attestation, preview equality, and drift checks,
  the broker creates a fresh worker with an exact, closed environment. For push,
  only that worker opens and descriptor-revalidates the credential. It holds the
  stable value in worker memory and supplies the username and token to Git over
  a per-execution mode-0600 Unix socket inside a private 128-bit-random
  directory; a second execution never reuses that path. Missing, linked,
  replaced, malformed, in-repository, wrongly owned, or non-0600 credential
  files fail closed; there is no permission-skip override. Git stdout and stderr
  are discarded inside the worker, and the parent accepts only a fixed receipt
  or allowlisted error code.
- The same production worker covers plain unsigned local commits without
  opening a credential. The approved target is an exact `refs/heads/*` ref. The
  worker revalidates an ordinary non-linked repository, symbolic HEAD, old HEAD
  and tree, staged tree, author, committer, and message; creates the commit with
  `commit-tree`; then updates only the approved ref with an old-OID compare-and-
  swap. Repository hooks and commit signing are not invoked. Signing remains a
  separate, unsupported concern rather than an implicit extension of this
  executor.
- A valid worker failure received before a side effect remains `EXECUTE_FAILED`.
  Once Git or the isolated worker may have acted, timeout, signal, output loss,
  malformed receipt, and nonzero push results are `COMPLETED_AMBIGUOUS`; callers
  must reconcile state and must not automatically retry. The parent kills the
  complete isolated process group so a Git descendant cannot silently continue
  after the worker is lost. This executor is bounded to git push and unsigned
  commit on POSIX hosts where descriptor paths, `O_NOFOLLOW`, ownership/mode
  checks, Unix sockets, process groups, and a root-owned Git binary can all be
  established. Other hosts fail closed and are outside bounded coverage.
- Commit, push, merge, destructive Git, provider PR/merge, and external ticket
  creation use `prepare -> scan -> READY -> execute`. Direct broker launches and
  direct side-effect forms are denied on covered Claude paths.
- Control-plane changes are detect-only and tamper-evident. Report `TAMPERED`,
  `UNTRUSTED`, `DISABLED`, and `OUTSIDE-ENROLLMENT` honestly; never claim that a
  hook prevents its owner from disabling it.
- Project enrollment state is trusted by default across POSIX, native Windows,
  and Windows-mounted WSL workspaces. Canonical paths, regular-file identity,
  bounded parsing, and exact policy/release digests detect drift; projected
  `0600`/`0700` permission bits are not an enrollment prerequisite. This does
  not relax the separate protected credential-store checks.
- Hook coverage is per host, action, tool path, mode, and enrollment. Hook skip,
  timeout, launch failure, safe/bare modes, bypasses, specialized paths, and
  direct external processes are coverage gaps, not fail-closed guarantees.
- Treat inspect, edit, test, commit, push, pull request, merge, deploy, device
  install, and destructive operations as distinct authorities.
- Apply that same authority matrix in init, objectives, review, design,
  implementation, Interrogation, QC, and memory. Model selection never changes
  access.
- Resolve exact targets before any external or destructive action.
- Prefer reversible operations and preserve user data.
- For device installation, verify package/application identity, build variant,
  signing identity, version direction, upgrade compatibility, and backup or
  recovery status. Never use uninstall or clear-data as a signing workaround.
- Distinguish build runtime from output compatibility. Discover the repository's
  wrapper, toolchain declarations, CI commands, and successful historical
  conventions before selecting a JDK, SDK, compiler, or runtime.
- Do not claim validation for a gate that did not run.
- A second model is advice, not authorization.
- Citation grounding is advisory and `anchor_verified` means only that the
  declared quote exists in a verified packet content span. It never means the
  claim, source, packet completeness, or review conclusion is proven.
- Never bypass citation platform, instance-key, receipt, smoke, shadow, or
  reservation failures. An inactive advisory run must use the frozen legacy
  route and retain its exit status.
- Design may not leave the loop until every required reviewer individually
  reaches the configured confidence threshold (minimum 90, configurable up to
  100) and current failed checks, security findings, material dissent, and
  unresolved questions are all zero.
- After the first completed dual-review synthesis, design may not begin round 2,
  request approval, or hand off to implementation until the human user has
  answered the source-derived clarification questionnaire and confirmed its
  locked project-local decision record. Every later round treats those answers
  as authoritative; only new evidence or a new user request surfaced directly
  to the user may produce a linked superseding decision.
- Never turn a review request into implementation without satisfying the
  configured transition and authority gates.
- Any plan change caused by an implementation issue or later user prompt must
  pass Interrogation at 93 or return to the full design loop. Uncertainty is
  material.
- Implementation is not complete until post-implementation QC passes at 95
  with zero failed checks, findings, or unresolved questions. High-risk QC
  requires both Codex and Opus, and self-review alone cannot pass.
- Interrogation and QC are cooperative evidence reviews, not cryptographic
  identity attestations or calibrated probability guarantees.
- Memory retrieval is explicit and untrusted. It never changes system policy or
  grants tool authority. Private Git visibility does not permit secrets.
- Memory repository creation, clone, fetch, integration, commit, push, and
  conflict resolution are separate authorities. Synchronization is never
  automatic and conflicts are never auto-resolved.
