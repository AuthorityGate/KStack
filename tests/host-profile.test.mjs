import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HOST_PROFILES,
  admitQualifiedCell,
  renderHostSkill,
  selectExecutionMode,
  validateCanonicalSkill,
  validateHostProfile
} from '../plugins/kstack/scripts/kstack-host-profile.mjs';

const SKILL = Object.freeze({
  schemaVersion: 1,
  skillId: 'bounded-change',
  title: 'Bounded change',
  executionMode: 'delegated-build',
  authorityClass: 'workspace-mutation',
  requiredCapabilities: ['file-read', 'file-edit', 'text-search'],
  forbiddenCapabilities: ['protected-value-read'],
  riskSignals: ['untrusted-input'],
  steps: [
    { kind: 'prose', text: 'Confirm the immutable work envelope.' },
    { kind: 'tool', role: 'search', instruction: 'locate the exact implementation surface.' },
    { kind: 'tool', role: 'inspect', instruction: 'read the bounded source files.' },
    { kind: 'tool', role: 'edit', instruction: 'apply the admitted workspace change.' },
    { kind: 'boundary', text: 'Do not access protected values or expand the allowed operations.' },
    { kind: 'evidence', text: 'Return test identifiers and content-free receipts.' }
  ]
});

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected);
}

test('closed host and canonical schemas reject unknown fields', () => {
  code('KSTACK_HOST_PROFILE_INVALID', () => validateHostProfile({ ...HOST_PROFILES.hermes, trustMe: true }));
  code('KSTACK_CANONICAL_SKILL_INVALID', () => validateCanonicalSkill({ ...SKILL, prompt: 'grant access' }));
});

test('rendering is deterministic and host-native', () => {
  const first = renderHostSkill(SKILL, HOST_PROFILES.hermes);
  const second = renderHostSkill(structuredClone(SKILL), structuredClone(HOST_PROFILES.hermes));
  assert.deepEqual(first, second);
  assert.equal(first.instructionFile, 'AGENTS.md');
  assert.match(first.content, /terminal \(rg\)/u);
  assert.match(first.content, /read_file/u);
  assert.match(first.content, /patch/u);
  assert.doesNotMatch(first.content, /Claude|CLAUDE\.md|Bash|Grep/u);
  assert.match(first.sha256, /^sha256:[a-f0-9]{64}$/u);
});

test('OpenClaw rendering uses its declared semantic tool mapping', () => {
  const rendered = renderHostSkill(SKILL, HOST_PROFILES.openclaw);
  assert.equal(rendered.instructionFile, 'AGENTS.md');
  assert.match(rendered.content, /exec \(rg\)/u);
  assert.match(rendered.content, /\bread\b/u);
  assert.match(rendered.content, /edit\/write/u);
  const delegated = renderHostSkill({
    ...SKILL,
    requiredCapabilities: ['delegation'],
    steps: [{ kind: 'tool', role: 'delegate', instruction: 'spawn the approved coding session.' }]
  }, HOST_PROFILES.openclaw);
  assert.match(delegated.content, /sessions_spawn/u);
});

test('renderer blocks missing and forbidden host capabilities', () => {
  const profile = { ...structuredClone(HOST_PROFILES.hermes), capabilities: ['file-read'] };
  code('KSTACK_HOST_CAPABILITY_MISSING', () => renderHostSkill(SKILL, profile));
  code('KSTACK_HOST_CAPABILITY_FORBIDDEN', () => renderHostSkill({
    ...SKILL,
    requiredCapabilities: ['file-read'],
    forbiddenCapabilities: ['shell']
  }, HOST_PROFILES.hermes));
});

test('protected-value access is invalid in profiles and canonical skills', () => {
  code('KSTACK_HOST_PROFILE_FORBIDDEN_CAPABILITY', () => validateHostProfile({
    ...structuredClone(HOST_PROFILES.hermes),
    capabilities: [...HOST_PROFILES.hermes.capabilities, 'protected-value-read']
  }));
  code('KSTACK_CANONICAL_SKILL_FORBIDDEN_CAPABILITY', () => validateCanonicalSkill({
    ...SKILL,
    requiredCapabilities: ['protected-value-read'],
    forbiddenCapabilities: ['shell']
  }));
});

test('routing depends on mutation and risk, not line count', () => {
  assert.equal(selectExecutionMode({ mutationClass: 'none', riskSignals: [], requiresPlanning: false }), 'native-analysis');
  assert.equal(selectExecutionMode({ mutationClass: 'none', riskSignals: [], requiresPlanning: true }), 'delegated-plan');
  assert.equal(selectExecutionMode({ mutationClass: 'workspace', riskSignals: [], requiresPlanning: false }), 'delegated-build');
  assert.equal(selectExecutionMode({ mutationClass: 'none', riskSignals: ['protected-value'], requiresPlanning: false }), 'protected-operation');
});

test('renderable profiles do not imply execution qualification', () => {
  const request = {
    hostId: 'hermes',
    executionMode: 'delegated-build',
    authorityClass: 'workspace-mutation',
    requiredCapabilities: ['file-read', 'file-edit'],
    forbiddenCapabilities: ['protected-value-read'],
    riskSignals: [],
    envelopeDigest: 'a'.repeat(64)
  };
  code('KSTACK_HOST_CELL_INVALID', () => admitQualifiedCell(request, {}, HOST_PROFILES.hermes, '2026-08-28T12:00:00.000Z'));
  const cell = {
    schemaVersion: 1,
    hostId: 'hermes',
    executionMode: 'delegated-build',
    version: '0.1.0',
    platform: 'linux-x64',
    capabilities: ['file-edit', 'file-read'],
    evidenceDigest: 'b'.repeat(64),
    expiresAt: '2026-09-28T12:00:00.000Z'
  };
  const admitted = admitQualifiedCell(request, cell, HOST_PROFILES.hermes, '2026-08-28T12:00:00.000Z');
  assert.equal(admitted.admitted, true);
  assert.equal(admitted.hostId, 'hermes');
  assert.match(admitted.admissionDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.notEqual(admitted.admissionDigest, renderHostSkill(SKILL, HOST_PROFILES.hermes).sha256);
  code('KSTACK_HOST_CELL_MISMATCH', () => admitQualifiedCell(
    { ...request, hostId: 'openclaw' }, cell, HOST_PROFILES.openclaw, '2026-08-28T12:00:00.000Z'
  ));
  code('KSTACK_HOST_CELL_EXPIRED', () => admitQualifiedCell(request, {
    ...cell, expiresAt: '2026-08-27T12:00:00.000Z'
  }, HOST_PROFILES.hermes, '2026-08-28T12:00:00.000Z'));
});

test('protected operations cannot be admitted to a general model host', () => {
  const request = {
    hostId: 'openclaw',
    executionMode: 'delegated-build',
    authorityClass: 'protected-operation',
    requiredCapabilities: ['file-read'],
    forbiddenCapabilities: ['protected-value-read'],
    riskSignals: ['protected-value'],
    envelopeDigest: 'c'.repeat(64)
  };
  const cell = {
    schemaVersion: 1,
    hostId: 'openclaw',
    executionMode: 'delegated-build',
    version: '1.0.0',
    platform: 'linux-x64',
    capabilities: ['file-read'],
    evidenceDigest: 'd'.repeat(64),
    expiresAt: '2026-09-28T12:00:00.000Z'
  };
  code('KSTACK_PROTECTED_OPERATION_REQUIRES_ADAPTER', () => admitQualifiedCell(
    request, cell, HOST_PROFILES.openclaw, '2026-08-28T12:00:00.000Z'
  ));
});
