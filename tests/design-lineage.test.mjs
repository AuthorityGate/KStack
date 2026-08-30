import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { advanceDesignLineage, createDesignLineage, evaluateDesignProposal, replayDesignLineage } from '../plugins/kstack/scripts/kstack-design-lineage.mjs';

const D = (character) => character.repeat(64);
const primary = (confidence, clean = true) => ({ decision: clean ? 'approve' : 'revise', confidence, clean });
const final = (confidence, findings = [], decision = 'revise') => ({ decision, confidence, findings });
const finding = (id, clause = `Architecture blocks/${id}`) => ({ id, detail: `${id} must be corrected`, allowedClausePaths: [clause] });

test('Insight Experience 94/86 is terminal accepted and findings move to implementation intake', () => {
  const state = advanceDesignLineage(createDesignLineage({ threadId: 'insight-experience' }), {
    cycle: 41, designDigest: D('a'), primary: primary(94), final: final(86, [finding('IX-1')])
  });
  assert.equal(state.status, 'accepted-design');
  assert.equal(state.acceptedParentDigest, D('a'));
  assert.deepEqual(state.cycles[0].implementationFindingIds, ['IX-1']);

  const rejected = advanceDesignLineage(state, { cycle: 42, designDigest: D('b') });
  assert.equal(rejected.status, 'accepted-design');
  assert.equal(rejected.currentBaselineDigest, D('a'));
  assert.equal(rejected.auditAlarms.at(-1).code, 'ACCEPTED_PARENT_EXIT_ATTEMPT');
});

test('Native Evidence cycle 13 freezes 97 high-water and later aggregate rescoring cannot abandon it', () => {
  const findings = ['NE-1', 'NE-2', 'NE-3', 'NE-4', 'NE-5'].map((id) => finding(id));
  const early = Array.from({ length: 12 }, (_, index) => ({
    cycle: index + 1, designDigest: String(index % 10).repeat(64), primary: primary(80 + index, false),
    ...(index === 0 ? {} : { proposal: {
      hypothesis: `Cycle ${index + 1} tests a bounded revision informed by the best prior evidence.`,
      acceptedEvidenceIds: ['CYCLE-1-ACCEPTED'], rejectedEvidenceIds: [], changedClausePaths: ['Architecture decision']
    } })
  }));
  const state = replayDesignLineage(createDesignLineage({ threadId: 'native-evidence' }), [
    ...early,
    { cycle: 13, designDigest: D('d'), primary: primary(97), final: final(70, findings), proposal: {
      hypothesis: 'Reach the final gate from the accumulated high-water evidence.',
      acceptedEvidenceIds: ['CYCLE-1-ACCEPTED'], rejectedEvidenceIds: [], changedClausePaths: ['Architecture decision']
    } },
    { cycle: 24, designDigest: D('e'), mode: 'full', primary: primary(96), final: final(74, findings) },
    { cycle: 44, designDigest: D('f'), mode: 'full', primary: primary(72, false) }
  ]);
  assert.equal(state.status, 'targeted-final-remediation');
  assert.equal(state.acceptedParentDigest, D('d'));
  assert.equal(state.currentBaselineDigest, D('d'));
  assert.equal(state.cycles.find((cycle) => cycle.cycle === 13).outcome, 'high-water-parent-accepted-targeted-remediation');
  assert.equal(state.cycles.find((cycle) => cycle.cycle === 24).outcome, 'rejected-unrestricted-continuation');
  assert.equal(state.cycles.find((cycle) => cycle.cycle === 44).outcome, 'rejected-unrestricted-continuation');
  assert.ok(state.auditAlarms.some((alarm) => alarm.code === 'EARLY_WARNING_REQUIRED'));
  assert.ok(state.auditAlarms.some((alarm) => alarm.code === 'UNRESTRICTED_DESIGN_AFTER_HIGH_WATER'));
});

test('a new full-design proposal must learn from both accepted and rejected evidence before dispatch', () => {
  let state = advanceDesignLineage(createDesignLineage({ threadId: 'learning' }), {
    cycle: 1, designDigest: D('a'), primary: primary(90, true)
  });
  state = advanceDesignLineage(state, {
    cycle: 2, designDigest: D('b'), primary: primary(75, false), proposal: {
      hypothesis: 'Test a smaller boundary.', acceptedEvidenceIds: ['CYCLE-1-ACCEPTED'],
      rejectedEvidenceIds: [], changedClausePaths: ['Architecture decision']
    }
  });
  assert.deepEqual(state.learningLedger.accepted.map((item) => item.id), ['CYCLE-1-ACCEPTED']);
  assert.deepEqual(state.learningLedger.rejected.map((item) => item.id), ['CYCLE-2-REJECTED']);
  assert.deepEqual(evaluateDesignProposal(state, {
    hypothesis: 'Blindly try another change.', acceptedEvidenceIds: ['CYCLE-1-ACCEPTED'],
    rejectedEvidenceIds: [], changedClausePaths: ['Architecture blocks/BLK-1']
  }), {
    ready: false, missingAcceptedEvidence: [], missingRejectedEvidence: ['CYCLE-2-REJECTED']
  });
  const rejected = advanceDesignLineage(state, {
    cycle: 3, designDigest: D('c'), primary: primary(92, true), proposal: {
      hypothesis: 'Blindly try another change.', acceptedEvidenceIds: ['CYCLE-1-ACCEPTED'],
      rejectedEvidenceIds: [], changedClausePaths: ['Architecture blocks/BLK-1']
    }
  });
  assert.equal(rejected.cycles.at(-1).outcome, 'rejected-missing-learning-context');
  assert.equal(rejected.auditAlarms.at(-1).code, 'LEARNING_CONTEXT_INCOMPLETE');
});

test('targeted item clearance is cumulative even when aggregate scores fall', () => {
  let state = advanceDesignLineage(createDesignLineage({ threadId: 'cumulative-items' }), {
    cycle: 13, designDigest: D('a'), primary: primary(97), final: final(70, [finding('NE-1'), finding('NE-2')])
  });
  state = advanceDesignLineage(state, {
    cycle: 14, designDigest: D('b'), mode: 'targeted', baselineDigest: D('a'),
    changedClausePaths: ['Architecture blocks/NE-1'], semanticDelta: { addedBytes: 20, removedBytes: 10 },
    itemResults: [{ id: 'NE-1', status: 'cleared', evidence: 'Independent targeted review cleared NE-1.' }],
    primary: primary(89, false), final: final(61)
  });
  assert.equal(state.remediation.items.find((item) => item.id === 'NE-1').status, 'cleared');
  assert.equal(state.currentBaselineDigest, D('b'));
  assert.ok(state.auditAlarms.some((alarm) => alarm.code === 'AGGREGATE_RESCORING_CANNOT_DISCARD_ITEM'));
  state = advanceDesignLineage(state, {
    cycle: 15, designDigest: D('c'), mode: 'targeted', baselineDigest: D('b'),
    changedClausePaths: ['Architecture blocks/NE-2'], semanticDelta: { addedBytes: 10, removedBytes: 5 },
    itemResults: [{ id: 'NE-2', status: 'cleared', evidence: 'Independent targeted review cleared NE-2.' }],
    primary: primary(72, false), final: final(55)
  });
  assert.equal(state.status, 'accepted-design');
  assert.equal(state.currentBaselineDigest, D('c'));
  assert.equal(state.remediation.items.find((item) => item.id === 'NE-1').status, 'cleared');
});

test('unrelated changes restore the baseline and two failed isolated attempts require an owner decision', () => {
  let state = advanceDesignLineage(createDesignLineage({ threadId: 'bounded' }), {
    cycle: 1, designDigest: D('a'), primary: primary(97), final: final(70, [finding('NE-1')])
  });
  state = advanceDesignLineage(state, {
    cycle: 2, designDigest: D('b'), mode: 'targeted', baselineDigest: D('a'),
    changedClausePaths: ['Architecture decision'], semanticDelta: { addedBytes: 1, removedBytes: 0 },
    itemResults: [{ id: 'NE-1', status: 'cleared', evidence: 'Unrelated edit.' }]
  });
  assert.equal(state.currentBaselineDigest, D('a'));
  assert.equal(state.auditAlarms.at(-1).code, 'UNRELATED_CLAUSE_DELTA');
  for (const [cycle, digest] of [[3, D('c')], [4, D('d')]]) {
    state = advanceDesignLineage(state, {
      cycle, designDigest: digest, mode: 'targeted', baselineDigest: D('a'),
      changedClausePaths: ['Architecture blocks/NE-1'], semanticDelta: { addedBytes: 1, removedBytes: 0 },
      itemResults: [{ id: 'NE-1', status: 'failed', evidence: `Attempt ${cycle} failed.` }]
    });
  }
  assert.equal(state.status, 'owner-decision-required');
  assert.equal(state.auditAlarms.at(-1).code, 'REMEDIATION_ATTEMPT_LIMIT');
});

test('an accepted parent changes only through an owner-authorized bounded amendment', () => {
  let state = advanceDesignLineage(createDesignLineage({ threadId: 'amendment' }), {
    cycle: 1, designDigest: D('a'), primary: primary(94), final: final(86)
  });
  state = advanceDesignLineage(state, {
    cycle: 2, designDigest: D('b'), mode: 'targeted', baselineDigest: D('a'),
    amendment: {
      ownerAuthorized: true, approvedParentDigest: D('a'), amendmentBaselineDigest: D('a'),
      allowedFindingIds: ['AMD-1'], allowedClausePaths: ['Architecture blocks/BLK-1'],
      semanticDeltaBudget: { maxChangedClauses: 1, maxAddedBytes: 100, maxRemovedBytes: 100 }
    },
    changedClausePaths: ['Architecture blocks/BLK-1'], semanticDelta: { addedBytes: 10, removedBytes: 2 },
    itemResults: [{ id: 'AMD-1', status: 'cleared', evidence: 'Owner-authorized amendment independently cleared.' }]
  });
  assert.equal(state.status, 'accepted-design');
  assert.equal(state.acceptedParentDigest, D('a'));
  assert.equal(state.currentBaselineDigest, D('b'));
  assert.equal(state.remediation.approvedParentDigest, D('a'));
  assert.equal(state.remediation.amendmentBaselineDigest, D('a'));
});

test('mandatory parser metadata is not modeled as a reviewer defect', async () => {
  const source = await import('node:fs').then((fs) => fs.readFileSync(new URL('../plugins/kstack/scripts/kstack-staged-review.mjs', import.meta.url), 'utf8'));
  assert.match(source, /Implementation-ready: no.*required workflow metadata/su);
});

test('the lineage CLI is cross-platform addressed and rejects unknown or duplicate arguments', () => {
  const script = fileURLToPath(new URL('../plugins/kstack/scripts/kstack-design-lineage.mjs', import.meta.url));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-design-lineage-cli-'));
  const stateFile = path.join(root, 'lineage.json');
  const accepted = spawnSync(process.execPath, [script, 'init', '--file', stateFile, '--thread-id', 'cli-test'], { encoding: 'utf8' });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(JSON.parse(fs.readFileSync(stateFile)).threadId, 'cli-test');
  for (const args of [
    ['init', '--file', path.join(root, 'extra.json'), '--thread-id', 'x', '--extra', 'y'],
    ['init', '--file', path.join(root, 'duplicate.json'), '--file', path.join(root, 'other.json')]
  ]) {
    const rejected = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /KSTACK_DESIGN_LINEAGE_ARGUMENT_INVALID/u);
  }
});

test('early warning is emitted once across later stalled cycles', () => {
  let state = createDesignLineage({ threadId: 'one-warning', earlyWarningCycle: 5 });
  for (let cycle = 1; cycle <= 8; cycle += 1) {
    state = advanceDesignLineage(state, {
      cycle, designDigest: String(cycle).repeat(64), primary: primary(70 + cycle, false),
      ...(cycle === 1 ? {} : { proposal: {
        hypothesis: `Bounded cycle ${cycle}`, acceptedEvidenceIds: ['CYCLE-1-ACCEPTED'],
        rejectedEvidenceIds: [], changedClausePaths: ['Architecture decision']
      } })
    });
  }
  assert.equal(state.auditAlarms.filter((alarm) => alarm.code === 'EARLY_WARNING_REQUIRED').length, 1);
});

test('design skill makes lineage init, preflight, and advancement mandatory cycle gates', () => {
  const skill = fs.readFileSync(new URL('../plugins/kstack/skills/kstack-design/SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /kstack-design-lineage\.mjs init/u);
  assert.match(skill, /kstack-design-lineage\.mjs preflight/u);
  assert.match(skill, /kstack-design-lineage\.mjs advance/u);
  assert.match(skill, /consumes zero reviewer invocations/u);
});
