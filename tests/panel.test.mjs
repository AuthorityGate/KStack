import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { defaultConfig } from '../plugins/kstack/scripts/kstack-config.mjs';
import {
  PANEL_PROFILES, PANEL_SCHEMA_VERSION, ROLE_ENVELOPE_SCHEMA_VERSION,
  assertRunStorageUsage, bindFableDirective, canonicalBytes, canonicalJson,
  closePanelBarrier, consumeFableDirective, evaluateMediationNeed,
  meetsPanelThreshold, persistPanelAttempt, routePanelTerminal, sha256,
  settleNonVoterFailure, storageArithmetic, updateIssueLedger,
  validateRoleEnvelope
} from '../plugins/kstack/scripts/kstack-panel-core.mjs';
import { defaultPersonaIds, loadPersonaCatalog } from '../plugins/kstack/scripts/kstack-panel-personas.mjs';
import { auditPanelRunStorage, continuePanelRun, mediatePanelRun, startPanelRun } from '../plugins/kstack/scripts/kstack-panel.mjs';

const digest = (label) => sha256(Buffer.from(label));
const fixedAttemptId = '123e4567-e89b-42d3-a456-426614174000';

function escapedBytes(length) {
  return '\n'.repeat(Math.floor(length / 2)) + (length % 2 ? 'x' : '');
}

function issueId(index, prefix = 'issue') {
  const head = `${prefix}-${String(index).padStart(3, '0')}-`;
  return `${head}${'x'.repeat(63 - head.length)}`;
}

function maximalEnvelope(profileName, role = 'required-voter', overrides = {}) {
  const profile = PANEL_PROFILES[profileName];
  const findings = Array.from({ length: profile.findingCount }, (_, index) => ({
    issueId: issueId(index), title: escapedBytes(profile.findingTitleBytes),
    body: escapedBytes(profile.findingBodyBytes), evidenceRefs: [escapedBytes(profile.findingEvidenceBytes)],
    reopensIssueId: null
  }));
  const dispositions = Array.from({ length: profile.dispositionCount }, (_, index) => ({
    issueId: issueId(index, 'prior'), disposition: 'still-open'
  }));
  const envelope = {
    schemaVersion: ROLE_ENVELOPE_SCHEMA_VERSION, attemptId: fixedAttemptId,
    role, slotId: role === 'fable-mediator' ? 'fable-mediator' : 'reviewer-one',
    personaId: role === 'fable-mediator' ? 'fable-mediator' : 'security-engineer',
    round: 1, backendId: role === 'fable-mediator' ? 'fable' : 'codex',
    providerFamily: role === 'fable-mediator' ? 'configured-fable' : 'openai',
    commonPacketDigest: digest('packet'), addendumDigest: null,
    candidateDigest: digest('candidate'), specDigest: digest('spec'),
    personaDigest: digest('persona'), evidenceDigests: Array.from({ length: profile.bindingCount }, (_, index) => digest(`evidence-${index}`)),
    confidence: role === 'required-voter' ? 100 : null, unableToAssess: false,
    status: role === 'required-voter' ? 'ballot' : role === 'adviser' ? 'advisory-report' : 'mediation-directive',
    summary: escapedBytes(profile.textBytes / 2), rationale: escapedBytes(profile.textBytes / 2),
    findings, risks: Array.from({ length: profile.riskCount }, () => escapedBytes(profile.riskBytes)),
    openQuestions: Array.from({ length: profile.questionCount }, () => escapedBytes(profile.questionBytes)),
    priorIssueDispositions: dispositions,
    bindingDigests: Array.from({ length: profile.bindingCount }, () => escapedBytes(128)),
    ...overrides
  };
  return envelope;
}

function ordinaryEnvelope(overrides = {}) {
  return {
    schemaVersion: ROLE_ENVELOPE_SCHEMA_VERSION, attemptId: fixedAttemptId,
    role: 'required-voter', slotId: 'reviewer-one', personaId: 'security-engineer',
    round: 1, backendId: 'codex', providerFamily: 'openai',
    commonPacketDigest: digest('packet'), addendumDigest: null,
    candidateDigest: digest('candidate'), specDigest: digest('spec'),
    personaDigest: digest('persona'), evidenceDigests: [], confidence: 90,
    unableToAssess: false, status: 'ballot', summary: 'summary', rationale: 'rationale',
    findings: [], risks: [], openQuestions: [], priorIssueDispositions: [], bindingDigests: [],
    ...overrides
  };
}

test('simultaneous all-maxima voter, adviser, and Fable envelopes fit both exact profiles', () => {
  for (const profileName of ['shipped', 'hard']) {
    const cap = PANEL_PROFILES[profileName].envelopeBytes;
    for (const role of ['required-voter', 'adviser', 'fable-mediator']) {
      const validated = validateRoleEnvelope(maximalEnvelope(profileName, role), { profile: profileName });
      assert.ok(validated.bytes.length <= cap, `${profileName}/${role}: ${validated.bytes.length} <= ${cap}`);
      assert.equal(validated.bytes.equals(canonicalBytes(validated.envelope)), true);
    }
  }
});

test('one encoded byte beyond a field cap rejects before persistence and leaves no content artifact', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-panel-cap-'));
  const attemptId = '223e4567-e89b-42d3-a456-426614174000';
  const envelope = ordinaryEnvelope({
    attemptId,
    summary: escapedBytes(PANEL_PROFILES.shipped.textBytes + 1),
    rationale: ''
  });
  const result = persistPanelAttempt({
    runDirectory: root, attemptId, profile: 'shipped',
    components: { stdout: canonicalBytes(envelope), stderr: '', error: '', signal: '' }
  });
  assert.equal(result.status, 'rejected');
  assert.deepEqual(fs.readdirSync(result.directory).sort(), ['diagnostics.json', 'manifest.json', 'receipt.json']);
  assert.doesNotMatch(fs.readFileSync(path.join(result.directory, 'diagnostics.json'), 'utf8'), /summary|rationale/);
});

test('Architecture B persists one canonical content envelope and no raw or sanitized duplicate', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-panel-one-copy-'));
  const attemptId = '323e4567-e89b-42d3-a456-426614174000';
  const envelope = ordinaryEnvelope({ attemptId });
  const result = persistPanelAttempt({
    runDirectory: root, attemptId, profile: 'shipped',
    components: { stdout: Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`), stderr: '', error: '', signal: '' }
  });
  assert.equal(result.status, 'complete');
  assert.deepEqual(fs.readdirSync(result.directory).sort(), ['diagnostics.json', 'envelope.json', 'manifest.json', 'receipt.json']);
  assert.equal(fs.readFileSync(path.join(result.directory, 'envelope.json'), 'utf8'), canonicalJson(envelope));
  assert.ok(result.totalBytes <= PANEL_PROFILES.shipped.attemptDirectoryBytes);
  assert.equal(fs.readdirSync(result.directory).some((name) => /raw|sanitized|stdout|stderr|log|tmp/i.test(name)), false);
});

test('secret, malformed, and capture-overflow paths persist bounded non-content records only', () => {
  const cases = [
    { id: '423e4567-e89b-42d3-a456-426614174000', stdout: 'token=abcdefghijklmnop' },
    { id: '523e4567-e89b-42d3-a456-426614174000', stdout: '{malformed' },
    { id: '623e4567-e89b-42d3-a456-426614174000', stdout: 'x'.repeat(PANEL_PROFILES.shipped.captureBytes + 1) },
    { id: '723e4567-e89b-42d3-a456-426614174000', stdout: Buffer.from([0xc3, 0x28]) }
  ];
  for (const item of cases) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-panel-reject-'));
    const result = persistPanelAttempt({ runDirectory: root, attemptId: item.id, profile: 'shipped', components: { stdout: item.stdout, stderr: '', error: '', signal: '' } });
    assert.equal(result.status, 'rejected');
    assert.deepEqual(fs.readdirSync(result.directory).sort(), ['diagnostics.json', 'manifest.json', 'receipt.json']);
    const retained = fs.readdirSync(result.directory).map((name) => fs.readFileSync(path.join(result.directory, name), 'utf8')).join('\n');
    assert.doesNotMatch(retained, /abcdefghijklmnop|offset|snippet|spanDigest|matched/i);
    assert.ok(result.totalBytes <= PANEL_PROFILES.shipped.attemptDirectoryBytes);
  }
});

test('attempt and run-level maximal arithmetic reproduces Fable hard and shipped rulings exactly', () => {
  assert.deepEqual(storageArithmetic('hard'), {
    profile: 'hard', attempts: 582, attemptDirectoryBytes: 147456,
    attemptBytes: 85819392, runLevelBytes: 25165824, totalBytes: 110985216,
    ceilingBytes: 134217728, headroomBytes: 23232512
  });
  assert.deepEqual(storageArithmetic('shipped'), {
    profile: 'shipped', attempts: 52, attemptDirectoryBytes: 65536,
    attemptBytes: 3407872, runLevelBytes: 8388608, totalBytes: 11796480,
    ceilingBytes: 16777216, headroomBytes: 4980736
  });
  for (const name of ['shipped', 'hard']) {
    const profile = PANEL_PROFILES[name];
    const usage = assertRunStorageUsage(name, {
      attemptDirectories: Array(profile.attempts).fill(profile.attemptDirectoryBytes),
      runLevel: { ...profile.runLevelSubcaps }
    });
    assert.equal(usage.total, storageArithmetic(name).totalBytes);
    assert.throws(() => assertRunStorageUsage(name, {
      attemptDirectories: [...Array(profile.attempts).fill(profile.attemptDirectoryBytes), 1],
      runLevel: { ...profile.runLevelSubcaps }
    }), /RUN_ATTEMPT_CEILING_EXCEEDED/);
  }
});

test('canonicalization is NFC, key-sorted, deterministic, and collision-rejecting', () => {
  const left = { z: 'e\u0301', a: { y: 2, x: 1 } };
  const right = { a: { x: 1, y: 2 }, z: '\u00e9' };
  assert.equal(canonicalJson(left), canonicalJson(right));
  assert.throws(() => canonicalJson({ '\u00e9': 1, 'e\u0301': 2 }), /CANONICAL_KEY_COLLISION/);
});

test('confidence-only completion uses every required voter and never averages', () => {
  assert.equal(meetsPanelThreshold([94, 91, 87], 88), false);
  assert.equal(meetsPanelThreshold([94, 91, 87], 87), true);
  assert.throws(() => meetsPanelThreshold([94, 91], 87.5), /PANEL_THRESHOLD_INVALID/);
  assert.throws(() => meetsPanelThreshold([94, 91], 0), /PANEL_THRESHOLD_INVALID/);
  assert.throws(() => validateRoleEnvelope(ordinaryEnvelope(), { threshold: 101 }), /PANEL_THRESHOLD_INVALID/);
  assert.throws(() => validateRoleEnvelope(ordinaryEnvelope({ backendId: 'fable' })), /ROLE_ENVELOPE_FABLE_IDENTITY_FORBIDDEN/);
});

test('source issue lifecycle permits only originator resolution, linked owner supersession, and new-ID reopen', () => {
  const opening = ordinaryEnvelope({
    confidence: 70,
    findings: [{ issueId: 'issue-one', title: 'One', body: 'Open issue.', evidenceRefs: [], reopensIssueId: null }]
  });
  const first = updateIssueLedger({ ballots: [opening] });
  assert.equal(first[0].status, 'open');
  const wrongOrigin = ordinaryEnvelope({ slotId: 'reviewer-two', priorIssueDispositions: [{ issueId: 'issue-one', disposition: 'resolved' }] });
  assert.throws(() => updateIssueLedger({ priorLedger: first, ballots: [wrongOrigin] }), /ORIGINATOR_REQUIRED/);
  const resolving = ordinaryEnvelope({ priorIssueDispositions: [{ issueId: 'issue-one', disposition: 'resolved' }] });
  const resolved = updateIssueLedger({ priorLedger: first, ballots: [resolving] });
  assert.equal(resolved[0].status, 'resolved');
  const reopening = ordinaryEnvelope({
    confidence: 70,
    findings: [{ issueId: 'issue-two', title: 'Two', body: 'New evidence.', evidenceRefs: [], reopensIssueId: 'issue-one' }]
  });
  const reopened = updateIssueLedger({ priorLedger: resolved, ballots: [reopening] });
  assert.equal(reopened.find((item) => item.issueId === 'issue-two').status, 'open');
  const successor = ordinaryEnvelope({
    confidence: 70,
    findings: [{ issueId: 'issue-three', title: 'Three', body: 'Successor.', evidenceRefs: [], reopensIssueId: null }]
  });
  const withSuccessor = updateIssueLedger({ priorLedger: reopened, ballots: [successor] });
  const superseded = updateIssueLedger({ priorLedger: withSuccessor, ballots: [], ownerSupersessions: [{ issueId: 'issue-two', successorId: 'issue-three', ownerRecordDigest: digest('owner') }] });
  assert.equal(superseded.find((item) => item.issueId === 'issue-two').status, 'superseded');
});

test('terminal routing rejects adviser and Fable outcomes before table lookup', () => {
  assert.throws(() => routePanelTerminal({ role: 'adviser', category: 'provider' }, true), /TERMINAL_INPUT_ROLE_FORBIDDEN/);
  assert.throws(() => routePanelTerminal({ role: 'fable-mediator', category: 'provider' }, true), /TERMINAL_INPUT_ROLE_FORBIDDEN/);
  assert.throws(() => routePanelTerminal({ role: 'fable-mediator', kind: 'independently-established-run-level-event', category: 'policy' }, true), /TERMINAL_INPUT_ROLE_FORBIDDEN/);
  assert.deepEqual(settleNonVoterFailure('adviser'), { status: 'ADVISER_REPORT_ABSENT', terminalEligible: false, pauseAuthoring: false });
  assert.equal(settleNonVoterFailure('fable-mediator').pauseAuthoring, true);
  assert.equal(routePanelTerminal({ role: 'required-voter', category: 'provider', reason: 'TIMEOUT' }, false).terminal, 'PANEL_BLOCKED_PROVIDER');
  assert.equal(routePanelTerminal({ role: 'required-voter', category: 'provider', reason: 'TIMEOUT' }, true).terminal, 'INCOMPLETE_WITH_DISSENT');
  assert.equal(routePanelTerminal({ role: 'required-voter', category: 'policy', reason: 'OUTPUT_SECRET_REJECTED' }, false).terminal, 'PANEL_BLOCKED_POLICY');
  assert.equal(routePanelTerminal({ role: 'required-voter', category: 'policy', reason: 'OUTPUT_SECRET_REJECTED' }, true).terminal, 'INCOMPLETE_WITH_DISSENT');
});

test('only stuck owner-certified factual disagreement reaches Fable and its directive is one-attempt binding', () => {
  const previous = { status: 'DISSENTING_BARRIER_CLOSED', openIssueIds: ['issue-one'], required: [{ slotId: 'one', confidence: 70 }] };
  const current = { status: 'DISSENTING_BARRIER_CLOSED', openIssueIds: ['issue-one'], required: [{ slotId: 'one', confidence: 70 }] };
  assert.equal(evaluateMediationNeed(previous, current, [{ issueId: 'issue-one', classification: 'policy', ownerCertified: true }]).action, 'OWNER_DECISION_REQUIRED');
  assert.equal(evaluateMediationNeed(previous, current, [{ issueId: 'issue-one', classification: 'technical', ownerCertified: true }]).action, 'INVOKE_FABLE');
  const directive = ordinaryEnvelope({ role: 'fable-mediator', slotId: 'fable-mediator', personaId: 'fable-mediator', backendId: 'fable', providerFamily: 'configured-fable', confidence: null, status: 'mediation-directive' });
  const binding = bindFableDirective(directive, 2);
  assert.equal(binding.appliesOnlyToAuthoringAttempt, 3);
  assert.throws(() => consumeFableDirective(binding, 4), /FABLE_DIRECTIVE_ATTEMPT_MISMATCH/);
  assert.equal(consumeFableDirective(binding, 3).consumed, true);
});

test('default persona catalog ships four substantive lenses and project records replace whole personas by digest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-personas-'));
  fs.mkdirSync(path.join(root, '.kstack', 'personas'), { recursive: true });
  const now = new Date('2026-08-24T12:00:00Z');
  const base = loadPersonaCatalog(root, { now });
  assert.deepEqual([...base.keys()], defaultPersonaIds());
  assert.match(base.get('security-engineer').body, /STRIDE/);
  assert.match(base.get('resilience-expert').body, /FMEA/);
  assert.match(base.get('compliance-auditor').body, /not legal advice/i);
  assert.match(base.get('news-article-journalist').body, /source ledger/i);
  const prior = base.get('resilience-expert');
  const replacement = {
    id: prior.id, version: 2, owner: 'Project owner', purpose: prior.purpose,
    methods: prior.methods, evidenceNeeds: prior.evidenceNeeds,
    epistemicLimits: prior.epistemicLimits, highStakes: false,
    reviewedOn: '2026-08-24', expiresOn: '2027-02-20', revoked: false,
    replacesDigest: prior.effectiveDigest, body: `${prior.body}\nProject-specific service topology applies.\n`
  };
  fs.writeFileSync(path.join(root, '.kstack', 'personas', 'resilience-expert.json'), JSON.stringify(replacement));
  const effective = loadPersonaCatalog(root, { now });
  assert.equal(effective.get('resilience-expert').origin, 'project');
  assert.notEqual(effective.get('resilience-expert').effectiveDigest, prior.effectiveDigest);
});

function configuredProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-panel-run-'));
  fs.mkdirSync(path.join(root, '.kstack'), { recursive: true });
  fs.writeFileSync(path.join(root, 'objective.md'), 'Review this launch document.');
  fs.writeFileSync(path.join(root, 'candidate.md'), 'Initial candidate.');
  const config = structuredClone(defaultConfig);
  config.project.name = 'fixture';
  config.workflow.panel.enabled = true;
  config.workflow.panel.panels['launch-panel'] = {
    threshold: 88, adapter: 'document-v1', dataClass: 'internal', externalAuthor: 'owner',
    requiredVoters: [
      { slotId: 'marketing', personaId: 'news-article-journalist', backendId: 'codex', providerFamily: 'openai' },
      { slotId: 'engineering', personaId: 'resilience-expert', backendId: 'opus', providerFamily: 'anthropic' },
      { slotId: 'ceo-voice', personaId: 'security-engineer', backendId: 'codex', providerFamily: 'openai' }
    ], advisers: []
  };
  fs.writeFileSync(path.join(root, '.kstack', 'config.json'), JSON.stringify(config));
  return root;
}

function fakePanelProvider(request) {
  const low = request.expected.slotId === 'ceo-voice' && request.expected.round < 3;
  const role = request.expected.role;
  const envelope = ordinaryEnvelope({
    ...request.expected,
    confidence: role === 'required-voter' ? low ? 87 : request.expected.slotId === 'marketing' ? 94 : 91 : null,
    status: role === 'fable-mediator' ? 'mediation-directive' : role === 'adviser' ? 'advisory-report' : 'ballot',
    findings: low ? [{ issueId: 'launch-risk', title: 'Risk', body: 'The risk is unresolved.', evidenceRefs: [], reopensIssueId: null }] : []
  });
  return Promise.resolve({ status: 'complete', components: { stdout: canonicalBytes(envelope), stderr: '', error: '', signal: '' } });
}

test('executable panel runner performs blind full barriers, bounded Fable mediation, and final re-vote', async () => {
  const root = configuredProject();
  const now = new Date('2026-08-24T12:00:00Z');
  const started = await startPanelRun({ projectRoot: root, panelId: 'launch-panel', objectiveFile: path.join(root, 'objective.md'), candidateFile: path.join(root, 'candidate.md'), invokeProvider: fakePanelProvider, now });
  assert.equal(started.state.status, 'AWAITING_AUTHOR');
  assert.deepEqual(started.state.rounds[0].barrier.required.map((item) => item.confidence), [94, 91, 87]);
  assert.equal(started.state.rounds[0].barrier.status, 'DISSENTING_BARRIER_CLOSED');
  for (const reference of started.state.rounds[0].requiredEnvelopeRefs) {
    const directory = path.dirname(path.join(started.runDirectory, reference.path));
    assert.deepEqual(fs.readdirSync(directory).sort(), ['diagnostics.json', 'envelope.json', 'manifest.json', 'receipt.json']);
  }

  fs.writeFileSync(path.join(root, 'candidate-2.md'), 'Revised candidate.');
  const authorTable = [{ issueId: 'launch-risk', disposition: 'addressed', rationale: 'Added mitigation.', evidenceDigests: [] }];
  const second = await continuePanelRun({ projectRoot: root, runId: started.spec.runId, candidateFile: path.join(root, 'candidate-2.md'), authorTable, invokeProvider: fakePanelProvider, now });
  assert.equal(second.state.status, 'AWAITING_AUTHOR');
  assert.equal(second.state.rounds.length, 2);

  const mediated = await mediatePanelRun({
    projectRoot: root, runId: started.spec.runId, now, invokeProvider: fakePanelProvider,
    ownerRouting: [{ issueId: 'launch-risk', classification: 'technical', ownerCertified: true }]
  });
  assert.equal(mediated.mediation.action, 'INVOKE_FABLE');
  assert.equal(mediated.state.status, 'AWAITING_AUTHOR_WITH_DIRECTIVE');
  assert.equal(mediated.state.fableBinding.appliesOnlyToAuthoringAttempt, 3);

  fs.writeFileSync(path.join(root, 'candidate-3.md'), 'Fable-directed candidate.');
  const directivePath = path.join(mediated.runDirectory, mediated.state.fableDirectiveEnvelopePath);
  const originalDirective = fs.readFileSync(directivePath);
  const modifiedDirective = JSON.parse(originalDirective.toString('utf8'));
  modifiedDirective.summary = 'modified after mediation';
  fs.writeFileSync(directivePath, canonicalBytes(modifiedDirective));
  await assert.rejects(continuePanelRun({ projectRoot: root, runId: started.spec.runId, candidateFile: path.join(root, 'candidate-3.md'), authorTable, invokeProvider: fakePanelProvider, now }), /FABLE_DIRECTIVE_BINDING_STALE/);
  assert.equal(fs.existsSync(path.join(mediated.runDirectory, 'snapshots', 'round-0003.txt')), false);
  fs.writeFileSync(directivePath, originalDirective);
  const third = await continuePanelRun({ projectRoot: root, runId: started.spec.runId, candidateFile: path.join(root, 'candidate-3.md'), authorTable, invokeProvider: fakePanelProvider, now });
  assert.equal(third.state.status, 'CONVERGED');
  assert.equal(third.state.fableBinding.consumed, true);
  assert.deepEqual(third.state.rounds[2].barrier.required.map((item) => item.confidence), [94, 91, 91]);
});

test('physical run inventory enforces one envelope allowlist and every storage tier', async () => {
  const root = configuredProject();
  const now = new Date('2026-08-24T12:00:00Z');
  const started = await startPanelRun({ projectRoot: root, panelId: 'launch-panel', objectiveFile: path.join(root, 'objective.md'), candidateFile: path.join(root, 'candidate.md'), invokeProvider: fakePanelProvider, now });
  const usage = auditPanelRunStorage(started.runDirectory, 'shipped');
  assert.ok(usage.attempts > 0);
  assert.ok(usage.runLevel > 0);
  assert.ok(usage.total <= PANEL_PROFILES.shipped.providerDerivedBytes);

  const firstAttempt = fs.readdirSync(path.join(started.runDirectory, 'attempts'))[0];
  fs.writeFileSync(path.join(started.runDirectory, 'attempts', firstAttempt, 'raw-output.json'), '{}');
  assert.throws(() => auditPanelRunStorage(started.runDirectory, 'shipped'), /RUN_ATTEMPT_FILE_INVENTORY_INVALID/);

  const separate = configuredProject();
  const second = await startPanelRun({ projectRoot: separate, panelId: 'launch-panel', objectiveFile: path.join(separate, 'objective.md'), candidateFile: path.join(separate, 'candidate.md'), invokeProvider: fakePanelProvider, now });
  const temporaryAttempt = path.join(second.runDirectory, 'attempts', '.823e4567-e89b-42d3-a456-426614174000.tmp');
  fs.mkdirSync(temporaryAttempt);
  fs.writeFileSync(path.join(temporaryAttempt, 'diagnostics.json'), Buffer.alloc(PANEL_PROFILES.shipped.attemptDirectoryBytes + 1));
  assert.throws(() => auditPanelRunStorage(second.runDirectory, 'shipped'), /RUN_ATTEMPT_DIRECTORY_CAP_EXCEEDED/);
});

test('paid production dispatch requires and accounts an API-aware aggregate broker receipt', async () => {
  const root = configuredProject();
  const configFile = path.join(root, '.kstack', 'config.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.workflow.panel.releaseStage = 'production';
  config.workflow.panel.productionEnabled = true;
  config.workflow.panel.maxRunUsdMicros = 52_000;
  config.workflow.panel.productionPolicyDecisionDigest = digest('production-policy');
  fs.writeFileSync(configFile, JSON.stringify(config));
  const now = new Date('2026-08-24T12:00:00Z');
  await assert.rejects(startPanelRun({ projectRoot: root, panelId: 'launch-panel', objectiveFile: path.join(root, 'objective.md'), candidateFile: path.join(root, 'candidate.md'), invokeProvider: fakePanelProvider, now }), /PANEL_API_AWARE_BROKER_REQUIRED/);

  const broker = async (request) => {
    const result = await fakePanelProvider(request);
    return {
      ...result,
      billingReceipt: {
        reservationId: request.billingCapability.reservationId,
        requestCount: 1, inputTokens: 100, outputTokens: 50,
        hiddenBillableTokens: 0, usdMicros: 1,
        completeUsage: true, serverWorkTerminated: true,
        tariffDigest: digest('tariff')
      }
    };
  };
  broker.apiAwareBroker = true;
  broker.aggregateBilling = true;
  broker.completeReceipts = true;
  broker.reserveAttempt = async ({ attemptId, maxUsdMicros }) => ({ reservationId: `reservation-${attemptId}`, maxUsdMicros });
  broker.settleAttempt = async () => ({ settled: true });
  const productionQualification = {
    brokerQualified: true, tariffCurrent: true, aggregateBillingTested: true,
    credentialSeparationTested: true, linuxIsolationQualified: true,
    filesystemQualified: true, egressQualified: true, corpusQualified: true,
    policyApproved: true
  };
  const started = await startPanelRun({ projectRoot: root, panelId: 'launch-panel', objectiveFile: path.join(root, 'objective.md'), candidateFile: path.join(root, 'candidate.md'), invokeProvider: broker, productionQualification, now });
  assert.equal(started.state.billing.spentUsdMicros, 3);
  assert.equal(started.state.billing.reservedUsdMicros, 0);
  assert.ok(started.state.billing.refundedUsdMicros > 0);
});
