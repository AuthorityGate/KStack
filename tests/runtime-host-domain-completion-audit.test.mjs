import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

const read = (relative) => JSON.parse(fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8'));
const bytes = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url));
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;
const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const fileDigest = (relative) => crypto.createHash('sha256').update(bytes(relative)).digest('hex');

const audit = read('.kstack/qualifications/runtime-host-domain-completion-audit.json');
const roadmap = read('.kstack/roadmaps/runtime-maturity-focused-2026-08-28.json');

test('completion audit exactly covers every current Host and Domain Breadth roadmap item', () => {
  const hostIds = roadmap.items.filter((row) => row.labels.includes('host-portability') || row.labels.includes('host-breadth')).map((row) => row.localId).sort();
  const domainIds = roadmap.items.filter((row) => row.labels.includes('domain-breadth')).map((row) => row.localId).sort();
  assert.deepEqual(audit.hostItems.map((row) => row.itemId).sort(), hostIds);
  assert.deepEqual(audit.domainItems.map((row) => row.itemId).sort(), domainIds);
  assert.equal(audit.hostItems.length, 25);
  assert.equal(audit.domainItems.length, 18);
  assert.equal(new Set(audit.hostItems.map((row) => row.itemId)).size, 25);
  assert.equal(new Set(audit.domainItems.map((row) => row.itemId)).size, 18);
});

test('audit is digest-bound to current implementation and host evidence', () => {
  const body = { ...audit }; delete body.evidenceDigest;
  assert.equal(audit.evidenceDigest, digest(body));
  assert.equal(audit.roadmapDigest, fileDigest('.kstack/roadmaps/runtime-maturity-focused-2026-08-28.json'));
  assert.equal(audit.bindings.hostImplementationEvidenceDigest, read('.kstack/qualifications/host-implementation-validation-evidence.json').evidenceDigest);
  assert.equal(audit.bindings.domainImplementationEvidenceDigest, read('.kstack/qualifications/domain-implementation-validation-evidence.json').evidenceDigest);
  assert.equal(audit.bindings.secondHostEvidenceDigest, read('.kstack/qualifications/opencode-goose-second-host-proof-evidence.json').evidenceDigest);
  assert.equal(audit.bindings.openCodeEvidenceDigest, read('.kstack/qualifications/opencode-v1.18.25-conformance-evidence.json').evidenceDigest);
  assert.equal(audit.bindings.gooseEvidenceDigest, read('.kstack/qualifications/goose-v1.48.0-conformance-evidence.json').evidenceDigest);
});

test('audit cannot claim completion or report update while required gates remain', () => {
  assert.equal(audit.summary.fullyClosed, 0);
  assert.equal(audit.formalRuntimeReportUpdated, false);
  assert.equal(audit.hostItems.find((row) => row.itemId === 'hb-tc06-second-host-proof').completionState, 'INDEPENDENT_FINAL_REVIEW_PENDING');
  assert.equal(audit.hostItems.find((row) => row.itemId === 'linux-distro-matrix').technicalState, 'ONE_OF_FOUR_PLATFORM_CELLS_QUALIFIED');
  assert.equal(audit.hostItems.find((row) => row.itemId === 'linux-lifecycle-qualification').technicalState, 'LIFECYCLE_CONTRACT_IMPLEMENTED_ZERO_OF_FOUR_CELLS');
  assert.equal(audit.hostItems.find((row) => row.itemId === 'linux-privileged-backends').technicalState, 'CONTRACT_IMPLEMENTED_ZERO_OF_TWELVE_BACKEND_CELLS');
  assert.equal(audit.domainItems.filter((row) => row.technicalState === 'CANONICAL_CANDIDATE_VALIDATED').length, 4);
  assert.equal(audit.domainItems.filter((row) => row.technicalState === 'IMPLEMENTED_VALIDATED').length, 12);
});
