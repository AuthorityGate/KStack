# Jira roadmap seeding defect and repair

**Date:** 2026-08-28  
**Status:** implementation under verification  
**Defect:** a Jira delivery stack could reach `verified` after creating only a
project/space, filter, and board; the plan contained no work-item operations,
so the newly verified board was empty by construction.

## Corrected behavior

New and existing-project/new-board previews now bind one of three explicit
roadmap modes into the approved plan digest:

- `auto` creates five generic KStack lifecycle tasks: objectives, design,
  implementation, QC, and release;
- `custom` loads a closed `kstack-jira-roadmap-v1` manifest with 1-64 items;
- `empty` is an explicit owner opt-out and is never the default for a mutating
  onboarding path.

Each planned item has a stable repository-project-local ID, issue type,
summary, description, labels, deterministic identity marker, and content
digest marker. Apply preflights issue types, searches all identity markers
before mutation, adopts one exact match, rejects multiple or mismatched
matches, posts each absent item once, reads it back, and durably completes its
individual operation before moving to the next item. Unknown POST outcomes
stop as `ambiguous`; reconciliation performs reads only and either adopts exact
matches or returns missing items to a newly previewed state for fresh approval.

Project, board, filter, and issue deletion remain outside automatic rollback.
Credential values and arbitrary provider bodies remain excluded from plans and
receipts.

## KStack qualification manifest

`.kstack/roadmaps/kstack-2026-08-28.json` records nine current KStack
workstreams. It contains no tenant, account, credential, personal path, or Jira
resource identifier. Its exact items must appear in the live Jira space before
the KStack onboarding defect is considered closed.

## Required evidence

1. Default preview contains five roadmap operations and no network request.
2. Custom manifests reject malformed, duplicate, oversized, or unknown fields.
3. Plan digest changes when any roadmap content changes while the stable item
   identity marker does not.
4. Missing issue types fail before the first issue POST.
5. Exact matches are adopted; multiple or content-mismatched matches fail
   closed.
6. Each successful POST is followed by exact read-back and durable operation
   completion.
7. Ambiguous issue POST stops later items; reconciliation never posts.
8. Credential canaries are absent from records, diagnostics, and test output.
9. Live read-back proves all nine KStack manifest items exist exactly once.
