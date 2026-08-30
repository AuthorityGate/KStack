import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { evaluateHostQualification, validateHostQualification } from '../plugins/kstack/scripts/kstack-host-qualification.mjs';
import { admitQualifiedCell, HOST_PROFILES } from '../plugins/kstack/scripts/kstack-host-profile.mjs';

const BASE = Object.freeze({
  schemaVersion: 1,
  qualificationId: 'synthetic-hermes-native-linux-x64',
  hostId: 'hermes',
  version: '1.0.0',
  executionMode: 'native-analysis',
  platform: 'linux-x64',
  source: {
    repository: 'https://example.invalid/hermes.git',
    tag: 'v1.0.0',
    tagObjectSha: '1'.repeat(40),
    commitSha: '2'.repeat(40),
    tagVerified: true,
    tagVerificationReason: 'valid',
    lockfileSha256: '3'.repeat(64),
    manifestSha256: '4'.repeat(64),
    findings: []
  },
  runtime: { kind: 'python', version: '3.12.3', archiveSha256: null, engineSatisfied: true },
  supplyChain: {
    lockfileFrozen: true,
    lifecycleScriptsDisabled: true,
    advisoryAssessment: { status: 'MEASURED', evidenceDigest: '9'.repeat(64) },
    advisories: { critical: 0, high: 0, moderate: 0, low: 0 }
  },
  isolation: {
    installRootDigest: '5'.repeat(64),
    systemMutation: false,
    credentialUse: false,
    networkUse: 'source-only'
  },
  functional: { syntaxPassed: true, sourceGuardsPassed: true, testsPassed: true, testsRun: 20 },
  constraints: {
    sandboxEnforcement: 'none',
    delegationControl: 'denied',
    maximumWallClockMs: 60_000,
    allowedOperations: ['inspect-file', 'search-text'],
    protectedValueAccess: false
  },
  admissionBlocked: false,
  terminalOutcome: 'ELIGIBLE_FOR_ADMISSION',
  reasonCodes: [],
  observedAt: '2026-08-28T12:00:00.000Z',
  expiresAt: '2026-09-28T12:00:00.000Z'
});

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected);
}

test('qualification schemas are closed and deterministic', () => {
  code('KSTACK_HOST_QUALIFICATION_INVALID', () => validateHostQualification({ ...BASE, trustMe: true }));
  code('KSTACK_HOST_QUALIFICATION_SOURCE_INVALID', () => validateHostQualification({
    ...BASE,
    source: { ...BASE.source, signatureText: 'not evidence' }
  }));
  assert.deepEqual(validateHostQualification(BASE), validateHostQualification(structuredClone(BASE)));
});

test('a fully evidenced native analysis cell can be issued', () => {
  const result = evaluateHostQualification(BASE, '2026-08-28T12:01:00.000Z');
  assert.equal(result.admitted, true);
  assert.equal(result.cell.hostId, 'hermes');
  assert.deepEqual(result.cell.capabilities, ['file-read', 'text-search']);
  assert.match(result.evidenceDigest, /^[a-f0-9]{64}$/u);
  const admission = admitQualifiedCell({
    hostId: 'hermes',
    executionMode: 'native-analysis',
    authorityClass: 'read-only',
    requiredCapabilities: ['file-read', 'text-search'],
    forbiddenCapabilities: ['file-edit'],
    riskSignals: [],
    envelopeDigest: '8'.repeat(64)
  }, result.cell, HOST_PROFILES.hermes, '2026-08-28T12:01:00.000Z');
  assert.equal(admission.admitted, true);
});

test('signatures, runtime, source findings, advisories, and tests gate independently', () => {
  const result = evaluateHostQualification({
    ...structuredClone(BASE),
    source: {
      ...structuredClone(BASE.source),
      tagVerified: false,
      tagVerificationReason: 'unsigned',
      findings: [{ code: 'unfinished-update-function', severity: 'high', evidenceDigest: '6'.repeat(64) }]
    },
    runtime: { ...BASE.runtime, engineSatisfied: false },
    supplyChain: { ...structuredClone(BASE.supplyChain), advisories: { critical: 1, high: 2, moderate: 0, low: 0 } },
    functional: { ...BASE.functional, testsPassed: false, testsRun: 0 }
  }, '2026-08-28T12:01:00.000Z');
  assert.equal(result.admitted, false);
  assert.deepEqual(result.rejectionCodes, [
    'KSTACK_HOST_CRITICAL_ADVISORY',
    'KSTACK_HOST_HIGH_ADVISORY',
    'KSTACK_HOST_HIGH_SOURCE_FINDING',
    'KSTACK_HOST_RUNTIME_INCOMPATIBLE',
    'KSTACK_HOST_SOURCE_UNVERIFIED',
    'KSTACK_HOST_TEST_EVIDENCE_MISSING'
  ]);
});

test('native analysis cannot silently expose mutation or delegation', () => {
  const result = evaluateHostQualification({
    ...structuredClone(BASE),
    constraints: {
      ...structuredClone(BASE.constraints),
      delegationControl: 'host-config',
      allowedOperations: ['inspect-file', 'edit-file']
    }
  }, '2026-08-28T12:01:00.000Z');
  assert.equal(result.admitted, false);
  assert.ok(result.rejectionCodes.includes('KSTACK_HOST_NATIVE_ANALYSIS_MUTATION_SURFACE'));
  assert.ok(result.rejectionCodes.includes('KSTACK_HOST_NATIVE_ANALYSIS_DELEGATION_SURFACE'));
});

test('OpenClaw delegated execution requires an external sandbox and launcher', () => {
  const openclaw = {
    ...structuredClone(BASE),
    qualificationId: 'synthetic-openclaw-delegated-linux-x64',
    hostId: 'openclaw',
    executionMode: 'delegated-build',
    runtime: { kind: 'node', version: '24.15.0', archiveSha256: '7'.repeat(64), engineSatisfied: true },
    constraints: {
      sandboxEnforcement: 'host',
      delegationControl: 'host-config',
      maximumWallClockMs: 60_000,
      allowedOperations: ['inspect-file', 'edit-file', 'run-test'],
      protectedValueAccess: false
    }
  };
  const rejected = evaluateHostQualification(openclaw, '2026-08-28T12:01:00.000Z');
  assert.equal(rejected.admitted, false);
  assert.ok(rejected.rejectionCodes.includes('KSTACK_OPENCLAW_ACP_NOT_HOST_SANDBOXED'));
  assert.ok(rejected.rejectionCodes.includes('KSTACK_OPENCLAW_EXPLICIT_ACP_SPAWN_UNMEDIATED'));
  const admitted = evaluateHostQualification({
    ...openclaw,
    constraints: {
      ...openclaw.constraints,
      sandboxEnforcement: 'external',
      delegationControl: 'external-launcher'
    }
  }, '2026-08-28T12:01:00.000Z');
  assert.equal(admitted.admitted, true);
});

test('zero timeout, protected values, system writes, credentials, and expiry fail closed', () => {
  const result = evaluateHostQualification({
    ...structuredClone(BASE),
    isolation: { ...BASE.isolation, systemMutation: true, credentialUse: true },
    constraints: { ...BASE.constraints, maximumWallClockMs: 0, protectedValueAccess: true }
  }, '2026-09-28T12:00:00.000Z');
  assert.equal(result.admitted, false);
  for (const expected of [
    'KSTACK_HOST_QUALIFICATION_EXPIRED',
    'KSTACK_HOST_SYSTEM_MUTATION_OBSERVED',
    'KSTACK_HOST_CREDENTIAL_USE_OBSERVED',
    'KSTACK_HOST_UNBOUNDED_RUNTIME',
    'KSTACK_HOST_PROTECTED_VALUE_SURFACE'
  ]) assert.ok(result.rejectionCodes.includes(expected), expected);
});

test('real 2026-08-28 host candidates remain rejected and mode-isolated', () => {
  const aggregate = JSON.parse(fs.readFileSync(new URL('../.kstack/qualifications/host-candidates-2026-08-28.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(aggregate).sort(), ['candidates', 'schema']);
  assert.equal(aggregate.schema, 'kstack-host-qualification-candidates-v1');
  const results = aggregate.candidates.map((candidate) => evaluateHostQualification(candidate, '2026-08-28T20:10:00.000Z'));
  assert.equal(results.length, 3);
  assert.ok(results.every((result) => result.admitted === false));
  aggregate.candidates.forEach((candidate, index) => {
    assert.equal(candidate.admissionBlocked, !results[index].admitted);
    assert.equal(candidate.terminalOutcome, 'ADMISSION_BLOCKED');
    assert.deepEqual(candidate.reasonCodes, results[index].rejectionCodes);
  });
  assert.ok(results[0].rejectionCodes.includes('KSTACK_HOST_HIGH_SOURCE_FINDING'));
  assert.ok(results[1].rejectionCodes.includes('KSTACK_HOST_CRITICAL_ADVISORY'));
  assert.ok(results[2].rejectionCodes.includes('KSTACK_OPENCLAW_ACP_NOT_HOST_SANDBOXED'));
});
