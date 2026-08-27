# QC round 10: dedicated exit code — downstream-consumer audit evidence

## Scope and status

`qcFixRound = 4` (unchanged — no production code changed this round).
Round 9: Codex approved cleanly (97, zero findings/questions). Opus approved
(92) but named one concrete `unresolvedQuestion`, which per `kstack-qc`'s
decision precedence blocks regardless of confidence: **has a repo-wide
search actually been run for consumers of `kstack-jira.mjs`'s exit status
that branch on 2, confirming they all also correctly handle the newly-split
20?** Opus's point was specific and fair: prior rounds' consumer-search
claims existed in this QC thread's *narrative*, but no grep/inventory
evidence was ever included *in a reviewed packet* — the QC packet-only
constraint means "I checked this in an earlier round" isn't evidence a
reviewer can verify; only what's embedded in the packet is.

This round supplies that evidence directly, produced fresh by an
independently-dispatched auditor with no prior involvement in this QC
thread (not carried forward from this thread's own earlier claims).

## Downstream-consumer audit (new evidence this round)

**Verdict: no consumers found.** Nothing in the repository invokes
`kstack-jira.mjs` — directly or through the `npm run jira` package-script
alias — and then branches specifically on exit code 2. The new exit code 20
therefore cannot break any existing repository consumer's retry/fatal
classification, because no such consumer currently exists.

**Method:** an unfiltered, file-type-independent literal search
(`grep -rn "kstack-jira" . --exclude-dir=.git --exclude-dir=node_modules`)
found 89 files total. 87 are archived QC/review/decision-doc/reflexion-lesson
artifacts under `.kstack/qc/`, `.kstack/reviews/`, `.kstack/decisions/`, and
`.kstack/reflexion-lessons.json` — quoted diffs, transcripts, and historical
discussion, not executable wrappers or operator instructions. The remaining
11 are the live, non-archival references, individually checked:

- `package.json:9` — defines the `jira` npm-script alias
  (`node plugins/kstack/scripts/kstack-jira.mjs`). **No file in the
  repository invokes this alias.**
- `plugins/kstack/skills/kstack-jira/SKILL.md:17` — invokes only the fully
  offline `draft` command. Does not inspect its result or document
  exit-code handling at all.
- `plugins/kstack/skills/kstack-design/SKILL.md:55`,
  `kstack-implement/SKILL.md:121`, `kstack-qc/SKILL.md:159`,
  `kstack-review/SKILL.md:87` — may delegate to offline drafting, but
  contain no exit-status branching.
- `plugins/kstack/skills/kstack-init/SKILL.md:41` — mentions the host-side
  `doctor` command but never invokes or branches on it.
- `plugins/kstack/references/CONFIG.md:75` — tells a human operator to run
  `doctor`; prescribes no exit handling.
- `plugins/kstack/references/JIRA_QUEUE.md:61` — documents both exit 2 and
  exit 20 accurately (this is the doc surface this round's diff already
  updates), but does not instruct any skill or human to branch/retry based
  on either code.
- `plugins/kstack/skills/kstack-jira/agents/openai.yaml:4` — only names the
  drafting skill in a prompt string.
- `tests/config.test.mjs:140-142` — reads `SKILL.md`'s text and asserts it
  contains the `draft` command string; does not execute it.
- All ten `plugins/kstack/skills/*/SKILL.md` files were individually
  checked. **None documents Jira exit-status handling.**
- `.github/workflows/ci.yml:29` (the CI added this session) — runs
  `npm test` only. It neither invokes `npm run jira` nor branches on any
  Jira CLI exit code.

A separate targeted search for generic exit-status idioms
(`$?`, `PIPESTATUS`, `errorlevel`, `.status`, `.exitCode`, `returncode`,
`child_process`/`spawn`/`exec`/`Popen`) scoped to files also matching
"jira" found matches only *inside* `kstack-jira.mjs` itself (its own
internal status handling) — none in an external caller.

## Full cumulative diff

Identical to round 9 — no production code changed. See `brief-round9.md`
for the complete diff (`.kstack/decisions/jira-ticket-queue-final-spec-2026-08-17.md`,
`plugins/kstack/references/JIRA_QUEUE.md`, `plugins/kstack/scripts/kstack-jira.mjs`,
`tests/jira-queue.test.mjs`).

## Verification evidence

Round 9's fresh test run stands unchanged: `tests/jira-queue.test.mjs`
57/57 pass; full suite 9/9 pass, 0 fail. This round adds no new test
changes — only the consumer-audit evidence above, which is investigative
(read-only grep), not a code/behavior change.

## Review instructions

You are reviewing round 10 independently. You have not seen any other
reviewer's output for this round. Production code and tests are identical
to round 9 (and round 8's implementation). What's new is the downstream-
consumer audit evidence above, supplied directly in this packet because you
cannot read repository files yourself.

If, after reviewing this evidence and the full diff, you find zero
remaining findings, your confidence score should reflect that — this is the
same instruction as round 9: do not hold confidence below 95 out of generic
caution once every concrete objection you can name has been resolved and
independently verified. If you still cannot reach 95, name the single
concrete item preventing it as an `unresolvedQuestion` rather than reporting
a bare sub-95 number with nothing to act on.

Report decision (pass/fix/redesign/block), confidence 0-100, failed checks,
findings, strongest objection, and unresolved questions per the standard QC
format.
