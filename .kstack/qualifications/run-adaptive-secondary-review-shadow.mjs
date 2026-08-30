#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compareSecondaryReviewPolicies } from '../../plugins/kstack/scripts/kstack-secondary-review-policy.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixture = path.join(repositoryRoot, 'tests', 'fixtures', 'fake-staged-reviewer.mjs');
const outputFile = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repositoryRoot, '.kstack', 'qualifications', 'adaptive-secondary-review-shadow-comparison-2026-08-30.json');

function invoke({ intake = false, decision = 'approve' } = {}) {
  const started = performance.now();
  const result = spawnSync(process.execPath, [
    fixture,
    '--fixture-provider=opus',
    '--fixture-confidence=88',
    `--fixture-decision=${decision}`,
    `--fixture-intake=${intake}`
  ], { cwd: repositoryRoot, encoding: 'utf8', timeout: 10_000 });
  const durationMs = Math.max(0, Math.round(performance.now() - started));
  if (result.status !== 0) throw new Error('KSTACK_SECONDARY_REVIEW_SHADOW_PROVIDER_FAILED');
  const parsed = JSON.parse(result.stdout).structured_output;
  const findingCount = parsed.failedChecks.length + parsed.securityFindings.length
    + parsed.materialDissent.length + parsed.unresolvedQuestions.length;
  return { durationMs, findingCount, decisionChanged: parsed.decision !== 'approve' ? 1 : 0 };
}

const legacyOrdinary = Array.from({ length: 6 }, () => invoke());
const legacyFinal = invoke({ intake: true, decision: 'revise' });
const adaptiveFinal = invoke({ intake: true, decision: 'revise' });
const limitations = [
  'The six avoided ordinary legacy invocations are synthetic fixtures stipulated to approve with zero findings.',
  'Equal finding and decision-change totals are not evidence of equivalent defect yield or production performance.'
];
const comparison = compareSecondaryReviewPolicies({
  classification: 'synthetic',
  observedAt: new Date().toISOString(),
  limitations,
  samples: [{
    workUnitId: 'staged-review-shadow',
    legacySecondaryDurationsMs: [...legacyOrdinary.map((entry) => entry.durationMs), legacyFinal.durationMs],
    adaptiveSecondaryDurationsMs: [adaptiveFinal.durationMs],
    legacyFindingCount: legacyOrdinary.reduce((sum, entry) => sum + entry.findingCount, legacyFinal.findingCount),
    adaptiveFindingCount: adaptiveFinal.findingCount,
    legacyDecisionChangeCount: legacyOrdinary.reduce((sum, entry) => sum + entry.decisionChanged, legacyFinal.decisionChanged),
    adaptiveDecisionChangeCount: adaptiveFinal.decisionChanged
  }]
});
const qualification = { ...comparison };

fs.writeFileSync(outputFile, `${JSON.stringify(qualification, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({
  result: 'PASS',
  outputFile: path.relative(repositoryRoot, outputFile),
  comparisonDigest: comparison.comparisonDigest,
  totals: comparison.totals
}, null, 2)}\n`);
