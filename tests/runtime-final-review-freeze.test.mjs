import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildRuntimeFinalReviewFreeze,
  canonicalFreezeBytes
} from './helpers/runtime-final-review-freeze.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frozenAt = '2026-08-30T07:33:37.000Z';

test('focused runtime final-review freeze is deterministic, complete, and secret-excluding', () => {
  const first = buildRuntimeFinalReviewFreeze({ repositoryRoot, frozenAt });
  const second = buildRuntimeFinalReviewFreeze({ repositoryRoot, frozenAt });
  assert.equal(canonicalFreezeBytes(first).equals(canonicalFreezeBytes(second)), true);
  assert.equal(first.kind, 'kstack-runtime-final-review-freeze-v1');
  assert.equal(first.reportDisposition, 'DEFERRED_UNTIL_ALL_ROWS_COMPLETE');
  assert.deepEqual(first.jiraState, { active: 40, blocked: 3, planned: 0, done: 0, total: 43 });
  assert.deepEqual(first.validation, {
    tests: 961, passed: 960, failed: 0, skipped: 1, architecturePassed: 9, installHealthPassed: 4
  });
  assert.equal(first.counts.artifacts, first.artifacts.length);
  assert.equal(new Set(first.artifacts.map(({ path: artifactPath }) => artifactPath)).size, first.artifacts.length);
  assert.equal(first.artifacts.some(({ path: artifactPath }) => artifactPath.startsWith('.kstack/secrets/')), false);
  assert.equal(first.artifacts.some(({ path: artifactPath }) => artifactPath.endsWith('Jira.txt')), false);
  for (const required of [
    'plugins/kstack/scripts/kstack-host-contract.mjs',
    'plugins/kstack/scripts/kstack-domain-evaluation.mjs',
    'tests/helpers/runtime-final-review-freeze.mjs',
    'tests/runtime-final-review-freeze.test.mjs',
    '.kstack/reviews/runtime-maturity-focused-2026-08-29-completion-audit.md',
    '.kstack/reviews/kcrp-host-domain-2026-08-29-validation.md',
    '.kstack/qualifications/linux-qualification-2026-08-29-validation-v4.md',
    '.kstack/qualifications/linux-ubuntu-24.04-wsl2-native-probe-2026-08-29.md',
    '.kstack/qualifications/goose-v1.48.0-requalification-2026-08-29.md',
    '.kstack/qualifications/goose-v1.48.0-lock-remediation-2026-08-29.patch',
    '.kstack/qualifications/goose-v1.48.0-remediation-feasibility-2026-08-29.md',
    '.kstack/qualifications/goose-v1.48.0-kstack-deny-2026-08-29.toml',
    '.kstack/qualifications/goose-v1.48.0-license-remediation-2026-08-29.patch',
    '.kstack/qualifications/goose-v1.48.0-license-source-remediation-2026-08-29.md',
    '.kstack/qualifications/goose-v1.48.0-reproducible-build-2026-08-29.md',
    '.kstack/qualifications/goose-v1.48.0-supply-chain-2026-08-29.md',
    '.kstack/qualifications/goose-v1.48.0-adapter-isolated-execution-2026-08-29.md',
    '.kstack/qualifications/goose-v1.48.0-isolated-cell-evidence.json',
    '.kstack/decisions/goose-v1.48.0-adapter-objective-2026-08-29.md',
    'plugins/kstack/references/DESIGN_ALTITUDE.md',
    'plugins/kstack/references/HOST_DEPENDENCY_ADMISSION.md',
    '.kstack/decisions/host-breadth-hb-tc06-2026-08-27-design-candidate.md',
    '.kstack/decisions/domain-breadth-packs-2026-08-27-d7-evaluation.md'
  ]) assert.equal(first.artifacts.some(({ path: artifactPath }) => artifactPath === required), true, required);
  for (let index = 1; index < first.artifacts.length; index += 1) {
    assert.equal(Buffer.compare(Buffer.from(first.artifacts[index - 1].path), Buffer.from(first.artifacts[index].path)) < 0, true);
  }
});
