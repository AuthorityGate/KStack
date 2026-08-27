import assert from 'node:assert/strict';
import { matchLessons, renderActorReference, renderEvidenceReport, MAX_CORPUS_EVIDENCE_ITEMS } from '../plugins/kstack/scripts/reflexion/retrieval-core.mjs';

assert.equal(typeof globalThis.gc, 'function');

function fixture() {
  const queries = Array.from({ length: 32 }, (_, index) => `query-token-${index}`);
  const taskSignature = [...queries];
  const lessons = Array.from({ length: 960 }, (_, index) => ({
    id: `lesson-${String(index).padStart(4, '0')}`,
    taskSignature,
    applicabilityPhrases: [],
    occurrences: index % 4,
    rule: `ALWAYS retain bounded evidence ${index}`,
    why: 'The retrieval memory gate must exercise the near-cap successful path.'
  }));
  return { queries, lessons };
}

function usage() {
  const value = process.memoryUsage();
  return value.heapUsed + value.arrayBuffers;
}

for (const verbose of [false, true]) {
  globalThis.gc();
  const before = usage();
  const { queries, lessons } = fixture();
  const result = matchLessons(lessons, queries, { all: true });
  assert.ok(result.counts.evidenceItems >= Math.floor(MAX_CORPUS_EVIDENCE_ITEMS * 0.9));
  renderActorReference(result, (lesson) => ({ rule: lesson.rule, why: lesson.why, immutable: {} }));
  if (verbose) renderEvidenceReport(result);
  globalThis.gc();
  const delta = usage() - before;
  assert.ok(delta < 384 * 1024 * 1024, `Reflexion memory delta ${delta} exceeded 384 MiB`);
}

