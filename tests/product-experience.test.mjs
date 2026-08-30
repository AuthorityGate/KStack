import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CONTRACT_SCHEMA, EVIDENCE_SCHEMA, RESULT_SCHEMA, REQUIRED_LANES, experienceSourceManifest,
  parseExperienceArgs, readExperienceContract, readExperienceResult, validateExperienceContract,
  validateDtcgTokenDocument, validateExperienceEvidenceManifest, validateExperienceResult
} from '../plugins/kstack/scripts/kstack-experience.mjs';

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const SHA = digest('evidence');
const COMMIT = 'a'.repeat(40);
const fixtureRoots = [];
test.after(() => { for (const root of fixtureRoots) fs.rmSync(root, { recursive: true, force: true }); });
const byteSort = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string' || Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort(byteSort).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
const canonicalDigest = (value) => digest(`${canonical(value)}\n`);

function contract() {
  return {
    schemaVersion: CONTRACT_SCHEMA,
    surface: 'user-facing',
    adoption: { mode: 'adopt-existing', decisionId: 'owner-ux-decision', ownerConfirmed: true },
    product: {
      name: 'Example Product',
      promise: 'Complete the primary job with clarity and confidence.',
      primaryUsers: ['Operator'],
      jobs: ['Complete a governed release'],
      brandTraits: ['clear', 'calm', 'trustworthy'],
      antiTraits: ['noisy'],
      voicePrinciples: ['State the outcome before supporting detail.'],
      informationArchitecturePrinciples: ['Keep release status and recovery actions together.']
    },
    system: {
      tokenFormat: 'project-native',
      tokensPath: 'ui/tokens.json',
      componentRoots: ['ui/components'],
      assetRoots: ['ui/assets'],
      exceptions: []
    },
    journeys: [{
      id: 'release', name: 'Release a validated change', priority: 'critical',
      testPath: 'tests/ui/release.spec.mjs',
      requiredStates: ['loading', 'success', 'validation-error', 'system-error', 'retry'],
      successOutcome: 'The operator can identify and complete the validated release.',
      alternatives: ['Guided release flow', 'Single-screen release checklist'],
      selectedAlternative: 'Guided release flow',
      selectionRationale: 'The guided flow exposes validation and recovery decisions before release.',
      hierarchy: 'Release status leads, validation evidence follows, and recovery stays adjacent to failure.',
      interactionModel: 'A staged keyboard- and pointer-operable flow confirms each irreversible transition.',
      recoveryBehavior: 'Failures retain entered context and offer a bounded retry or safe return to validation.'
    }],
    validation: {
      accessibilityTarget: 'wcag-2.2-aa',
      requiredLanes: [...REQUIRED_LANES],
      minimumCasesByLane: Object.fromEntries(REQUIRED_LANES.map((lane) => [lane, 1])),
      viewports: [
        { id: 'mobile', width: 390, height: 844, inputModes: ['touch', 'screen-reader'], touch: true, colorScheme: 'light' },
        { id: 'desktop', width: 1440, height: 900, inputModes: ['keyboard', 'mouse', 'screen-reader'], touch: false, colorScheme: 'dark' }
      ],
      locales: ['en-US'],
      zoomPercents: [100, 200],
      visualReview: { required: true, syntheticDataOnly: true, minimumConfidence: 93, baselineApprovalId: 'owner-baselines-2026-08-28', baselineRoots: ['tests/ui'] },
      performance: { maxLcpMs: 2500, maxInpMs: 200, maxClsMilli: 100, fieldEvidenceRequired: false }
    }
  };
}

function binding(contractSha256 = SHA) {
  return { contractSha256, releaseId: 'release-1', deploymentId: 'deploy-1', commitSha: COMMIT, artifactSha256: SHA };
}

function evidenceManifest(contractSha256 = SHA) {
  const cases = [];
  const add = (caseId, lane, state, viewportId, zoomPercent, checkType) => cases.push({ caseId, lane, journeyId: 'release', state, viewportId, locale: 'en-US', zoomPercent, checkType, outcome: 'PASS', evidencePath: `cases/${caseId}.txt`, evidenceSha256: digest(caseId) });
  for (const lane of REQUIRED_LANES) add(`base-${lane}`, lane, 'success', 'mobile', 100, lane);
  for (const check of ['axe', 'keyboard', 'focus', 'aria', 'contrast', 'reflow']) add(`a11y-${check}`, 'accessibility', 'success', 'desktop', 100, check);
  for (const state of ['loading', 'validation-error', 'system-error', 'retry']) add(`state-${state}`, 'state-coverage', state, 'mobile', 100, 'state');
  for (const state of ['loading', 'validation-error', 'system-error', 'retry']) add(`visual-state-${state}`, 'visual-regression', state, 'mobile', 100, 'state');
  for (const viewport of ['mobile', 'desktop']) for (const zoom of [100, 200]) for (const lane of ['responsive', 'visual-regression']) add(`matrix-${lane}-${viewport}-${zoom}`, lane, 'success', viewport, zoom, lane);
  return {
    schemaVersion: EVIDENCE_SCHEMA, contractSha256,
    release: { releaseId: 'release-1', deploymentId: 'deploy-1', commitSha: COMMIT, artifactSha256: SHA }, cases,
    manualAccessibilityStatus: 'PENDING_OWNER_ASSESSMENT',
    visualDisclosure: { classification: 'synthetic', authorizationReceiptPath: null, authorizationReceiptSha256: null },
    performanceEvidence: {
      journeyId: 'release', evidenceKind: 'lab', environment: 'chromium 140 desktop fixture', sampleSize: 5,
      windowStart: '2026-08-28T10:00:00.000Z', windowEnd: '2026-08-28T10:05:00.000Z',
      evidencePath: 'performance/raw.json', evidenceSha256: digest(performanceRawBytes()), lcpMs: 2000, inpMs: 150, clsMilli: 50
    }
  };
}

function performanceRaw() {
  return {
    schemaVersion: 'kstack-performance-measurement-v1', journeyId: 'release', evidenceKind: 'lab',
    environment: 'chromium 140 desktop fixture', sampleSize: 5,
    windowStart: '2026-08-28T10:00:00.000Z', windowEnd: '2026-08-28T10:05:00.000Z',
    lcpMs: 2000, inpMs: 150, clsMilli: 50
  };
}
function performanceRawBytes() { return `${canonical(performanceRaw())}\n`; }
function projectedCases(evidence, lane) {
  return evidence.cases.filter((item) => item.lane === lane).map((item) => ({ ...item }))
    .sort((left, right) => byteSort(left.caseId, right.caseId));
}

function checkedEvidence(contractSha256 = SHA, policy = contract()) {
  return validateExperienceEvidenceManifest(evidenceManifest(contractSha256), policy, binding(contractSha256));
}

function result(contractSha256 = SHA, evidence = evidenceManifest(contractSha256)) {
  const screenshotManifestSha256 = canonicalDigest(projectedCases(evidence, 'visual-regression'));
  return {
    schemaVersion: RESULT_SCHEMA,
    contractSha256,
    evidenceManifestPath: 'experience-evidence.json',
    evidenceManifestSha256: canonicalDigest(evidence),
    release: { releaseId: 'release-1', deploymentId: 'deploy-1', commitSha: COMMIT, artifactSha256: SHA },
    lanes: REQUIRED_LANES.map((lane) => {
      const cases = projectedCases(evidence, lane);
      return { lane, cases: cases.length, failed: 0, findings: 0, evidenceSha256: canonicalDigest(cases) };
    }),
    metrics: { evidenceKind: 'lab', lcpMs: 2000, inpMs: 150, clsMilli: 50 },
    visualReview: { status: 'APPROVED', confidence: 93, failed: 0, security: 0, dissent: 0, questions: 0, screenshotManifestSha256 }
  };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-experience-'));
  fixtureRoots.push(root);
  fs.mkdirSync(path.join(root, '.kstack'));
  fs.mkdirSync(path.join(root, 'ui', 'components'), { recursive: true });
  fs.mkdirSync(path.join(root, 'ui', 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tests', 'ui'), { recursive: true });
  fs.writeFileSync(path.join(root, 'ui', 'tokens.json'), '{}\n');
  fs.writeFileSync(path.join(root, 'ui', 'components', 'button.css'), '.button{}\n');
  fs.writeFileSync(path.join(root, 'ui', 'assets', 'mark.svg'), '<svg/>\n');
  fs.writeFileSync(path.join(root, 'tests', 'ui', 'release.spec.mjs'), 'export {};\n');
  const value = contract();
  const contractPath = path.join(root, '.kstack', 'experience.json');
  fs.writeFileSync(contractPath, `${JSON.stringify(value, null, 2)}\n`);
  return { root, contractPath, value };
}

test('accepts a closed user-facing experience contract and deterministic source manifest', () => {
  const item = fixture();
  const loaded = readExperienceContract(item.root, '.kstack/experience.json');
  assert.equal(loaded.contract.product.name, 'Example Product');
  const first = experienceSourceManifest(item.root, loaded.contract);
  const second = experienceSourceManifest(item.root, loaded.contract);
  assert.deepEqual(first, second);
  assert.equal(first.files, 4);
});

test('rejects unknown contract keys and incomplete lane policy', () => {
  const unknown = contract(); unknown.extra = true;
  assert.throws(() => validateExperienceContract(unknown), /KSTACK_EXPERIENCE_CONTRACT_INVALID/u);
  const missing = contract(); missing.validation.requiredLanes.pop();
  assert.throws(() => validateExperienceContract(missing), /KSTACK_EXPERIENCE_LANES_INVALID/u);
});

test('validates bounded DTCG token structure and rejects empty declarations', () => {
  assert.deepEqual(validateDtcgTokenDocument({ color: { action: { $type: 'color', $value: '#123456' } } }), { tokens: 1, nodes: 3 });
  assert.throws(() => validateDtcgTokenDocument({ color: { $description: 'No token value' } }), /KSTACK_EXPERIENCE_DTCG_INVALID/u);
});

test('requires explicit adoption, alternatives, information architecture, and bounded exceptions', () => {
  const missingDecision = contract(); missingDecision.adoption.ownerConfirmed = false;
  assert.throws(() => validateExperienceContract(missingDecision), /KSTACK_EXPERIENCE_ADOPTION_INVALID/u);
  const oneAlternative = contract(); oneAlternative.journeys[0].alternatives = ['Only option'];
  assert.throws(() => validateExperienceContract(oneAlternative), /KSTACK_EXPERIENCE_JOURNEYS_INVALID/u);
  const noRationale = contract(); noRationale.journeys[0].selectionRationale = '';
  assert.throws(() => validateExperienceContract(noRationale), /KSTACK_EXPERIENCE_JOURNEYS_INVALID/u);
  const noCriticalJourney = contract(); noCriticalJourney.journeys[0].priority = 'important';
  assert.throws(() => validateExperienceContract(noCriticalJourney), /KSTACK_EXPERIENCE_JOURNEYS_INVALID/u);
  const malformedException = contract(); malformedException.system.exceptions = [{ id: 'temporary', scope: 'button' }];
  assert.throws(() => validateExperienceContract(malformedException), /KSTACK_EXPERIENCE_SYSTEM_INVALID/u);
});

test('CLI parsing rejects duplicate, odd, and unknown options', () => {
  assert.throws(() => parseExperienceArgs(['validate-contract', '--contract', 'a', '--contract', 'b']), /KSTACK_EXPERIENCE_ARGUMENTS_INVALID/u);
  assert.throws(() => parseExperienceArgs(['validate-contract', '--contract']), /KSTACK_EXPERIENCE_ARGUMENTS_INVALID/u);
});

test('visual review policy has a non-lowerable 93 confidence floor', () => {
  const value = contract(); value.validation.visualReview.minimumConfidence = 92;
  assert.throws(() => validateExperienceContract(value), /KSTACK_EXPERIENCE_VISUAL_POLICY_INVALID/u);
});

test('binds explicit input modalities and approved visual baseline roots', () => {
  const missingKeyboard = contract();
  missingKeyboard.validation.viewports[1].inputModes = ['mouse', 'screen-reader'];
  assert.throws(() => validateExperienceContract(missingKeyboard), /KSTACK_EXPERIENCE_VIEWPORTS_INVALID/u);
  const touchMismatch = contract(); touchMismatch.validation.viewports[0].touch = false;
  assert.throws(() => validateExperienceContract(touchMismatch), /KSTACK_EXPERIENCE_VIEWPORTS_INVALID/u);
  const missingApproval = contract(); missingApproval.validation.visualReview.baselineApprovalId = '';
  assert.throws(() => validateExperienceContract(missingApproval), /KSTACK_EXPERIENCE_VISUAL_POLICY_INVALID/u);
});

test('rejects path traversal and symlinked experience sources', () => {
  const traversal = contract(); traversal.system.tokensPath = '../tokens.json';
  assert.throws(() => validateExperienceContract(traversal), /KSTACK_EXPERIENCE_SYSTEM_INVALID/u);
  const item = fixture();
  fs.rmSync(path.join(item.root, 'ui', 'tokens.json'));
  fs.symlinkSync(path.join(item.root, 'ui', 'components', 'button.css'), path.join(item.root, 'ui', 'tokens.json'));
  const loaded = readExperienceContract(item.root, '.kstack/experience.json');
  assert.throws(() => experienceSourceManifest(item.root, loaded.contract), /KSTACK_EXPERIENCE_SOURCE_PATH_INVALID/u);
});

test('bounds source-tree depth before recursive traversal can become unbounded', () => {
  const item = fixture();
  let relative = 'deep';
  fs.mkdirSync(path.join(item.root, relative));
  for (let index = 0; index < 34; index += 1) {
    relative = path.posix.join(relative, `level-${index}`);
    fs.mkdirSync(path.join(item.root, relative));
  }
  item.value.system.componentRoots = ['deep'];
  const validated = validateExperienceContract(item.value);
  assert.throws(() => experienceSourceManifest(item.root, validated), /KSTACK_EXPERIENCE_SOURCE_BUDGET_EXCEEDED/u);
});

test('rejects secret material embedded in the experience contract', () => {
  const value = contract(); value.product.promise = 'password=abcdefghijklmnop';
  assert.throws(() => validateExperienceContract(value), /KSTACK_EXPERIENCE_SECRET_MATERIAL_REJECTED/u);
});

test('accepts exact release-bound, zero-finding experience evidence', () => {
  const checked = validateExperienceResult(result(), contract(), binding(), checkedEvidence());
  assert.equal(checked.status, 'PASS');
  assert.deepEqual(checked.failures, []);
});

test('requires accessibility, responsive, visual-state, and performance evidence for critical journeys', () => {
  const missingAccessibility = evidenceManifest();
  missingAccessibility.cases = missingAccessibility.cases.filter((item) => !(item.lane === 'accessibility' && item.checkType === 'aria'));
  const accessibility = validateExperienceEvidenceManifest(missingAccessibility, contract(), binding());
  assert.ok(accessibility.failures.some((item) => item.lane === 'accessibility' && item.reason === 'missing-release-aria'));

  const missingVisualState = evidenceManifest();
  missingVisualState.cases = missingVisualState.cases.filter((item) => item.caseId !== 'visual-state-loading');
  const visual = validateExperienceEvidenceManifest(missingVisualState, contract(), binding());
  assert.ok(visual.failures.some((item) => item.lane === 'visual-regression' && item.reason === 'missing-release-loading'));

  const wrongInput = evidenceManifest();
  wrongInput.cases.find((item) => item.checkType === 'keyboard').viewportId = 'mobile';
  assert.throws(() => validateExperienceEvidenceManifest(wrongInput, contract(), binding()), /KSTACK_EXPERIENCE_EVIDENCE_CASES_INVALID/u);
});

test('synthetic-only review policy rejects unbound owner-authorized disclosure', () => {
  const manifest = evidenceManifest();
  manifest.visualDisclosure = { classification: 'owner-authorized', authorizationReceiptPath: 'authorization.json', authorizationReceiptSha256: SHA };
  assert.throws(() => validateExperienceEvidenceManifest(manifest, contract(), binding()), /KSTACK_EXPERIENCE_EVIDENCE_DISCLOSURE_INVALID/u);
  const policy = contract(); policy.validation.visualReview.syntheticDataOnly = false;
  assert.equal(validateExperienceEvidenceManifest(manifest, policy, binding()).status, 'PASS');
});

test('fails closed on lane findings and performance budgets', () => {
  const manifest = evidenceManifest(); manifest.performanceEvidence.lcpMs = 2501;
  const value = result(SHA, manifest);
  value.lanes.find((lane) => lane.lane === 'accessibility').findings = 2;
  value.metrics.lcpMs = 2501;
  const evidence = validateExperienceEvidenceManifest(manifest, contract(), binding());
  const checked = validateExperienceResult(value, contract(), binding(), evidence);
  assert.equal(checked.status, 'FAIL');
  assert.deepEqual(checked.failures, [
    { lane: 'accessibility', reason: 'unresolved-findings' },
    { lane: 'performance', reason: 'lcp-budget' }
  ]);
});

test('recomputes lane counts and evidence digests from exact case context', () => {
  const count = result(); count.lanes.find((lane) => lane.lane === 'responsive').cases -= 1;
  assert.throws(() => validateExperienceResult(count, contract(), binding(), checkedEvidence()), /KSTACK_EXPERIENCE_RESULT_LANE_EVIDENCE_MISMATCH/u);
  const manifest = evidenceManifest();
  manifest.cases.find((item) => item.lane === 'visual-regression').viewportId = 'desktop';
  const evidence = validateExperienceEvidenceManifest(manifest, contract(), binding());
  const staleReview = result();
  assert.throws(() => validateExperienceResult(staleReview, contract(), binding(), evidence), /KSTACK_EXPERIENCE_RESULT_LANE_EVIDENCE_MISMATCH/u);
});

test('requires exact lane uniqueness and exact release identity', () => {
  const duplicate = result(); duplicate.lanes[1].lane = duplicate.lanes[0].lane;
  assert.throws(() => validateExperienceResult(duplicate, contract(), binding(), checkedEvidence()), /KSTACK_EXPERIENCE_RESULT_LANES_INVALID/u);
  const stale = result(); stale.release.deploymentId = 'deploy-2';
  assert.throws(() => validateExperienceResult(stale, contract(), binding(), checkedEvidence()), /KSTACK_EXPERIENCE_RESULT_BINDING_MISMATCH/u);
});

test('requires an approved 93 confidence visual review with zero counters', () => {
  const pending = result(); pending.visualReview.status = 'PENDING'; pending.visualReview.confidence = 92; pending.visualReview.questions = 1;
  const checked = validateExperienceResult(pending, contract(), binding(), checkedEvidence());
  assert.equal(checked.status, 'FAIL');
  assert.deepEqual(checked.failures, [
    { lane: 'visual-review', reason: 'review-not-approved' },
    { lane: 'visual-review', reason: 'confidence-below-threshold' },
    { lane: 'visual-review', reason: 'questions-not-zero' }
  ]);
});

test('distinguishes lab metrics from required field p75 evidence', () => {
  const policy = contract(); policy.validation.performance.fieldEvidenceRequired = true;
  const checked = validateExperienceResult(result(), policy, binding(), checkedEvidence(SHA, policy));
  assert.deepEqual(checked.failures, [{ lane: 'performance', reason: 'field-evidence-required' }]);
});

test('binds result performance metrics to journey and raw measurement evidence', () => {
  const evidence = checkedEvidence();
  const value = result(); value.metrics.lcpMs = 1999;
  assert.throws(() => validateExperienceResult(value, contract(), binding(), evidence), /KSTACK_EXPERIENCE_RESULT_METRICS_EVIDENCE_MISMATCH/u);
});

test('reads a no-follow result from inside the project and binds its digest', () => {
  const item = fixture();
  const loaded = readExperienceContract(item.root, '.kstack/experience.json');
  const manifest = evidenceManifest(loaded.digest);
  manifest.release.deploymentId = 'deploy-1';
  fs.mkdirSync(path.join(item.root, '.kstack', 'cases'));
  for (const entry of manifest.cases) fs.writeFileSync(path.join(item.root, '.kstack', entry.evidencePath), entry.caseId);
  fs.mkdirSync(path.join(item.root, '.kstack', 'performance'));
  fs.writeFileSync(path.join(item.root, '.kstack', manifest.performanceEvidence.evidencePath), performanceRawBytes());
  fs.writeFileSync(path.join(item.root, '.kstack', 'experience-evidence.json'), `${canonical(manifest)}\n`);
  const value = result(loaded.digest, manifest);
  fs.writeFileSync(path.join(item.root, '.kstack', 'experience-result.json'), `${JSON.stringify(value)}\n`);
  const checked = readExperienceResult(item.root, '.kstack/experience-result.json', loaded.contract, binding(loaded.digest));
  assert.equal(checked.result.status, 'PASS');
  assert.match(checked.digest, /^[0-9a-f]{64}$/u);
});

test('rejects a raw performance file that does not contain the reported measurement envelope', () => {
  const item = fixture();
  const loaded = readExperienceContract(item.root, '.kstack/experience.json');
  const manifest = evidenceManifest(loaded.digest); manifest.release.deploymentId = 'deploy-1';
  fs.mkdirSync(path.join(item.root, '.kstack', 'cases'));
  for (const entry of manifest.cases) fs.writeFileSync(path.join(item.root, '.kstack', entry.evidencePath), entry.caseId);
  fs.mkdirSync(path.join(item.root, '.kstack', 'performance'));
  const dishonest = `${canonical({ ...performanceRaw(), lcpMs: 1999 })}\n`;
  manifest.performanceEvidence.evidenceSha256 = digest(dishonest);
  fs.writeFileSync(path.join(item.root, '.kstack', manifest.performanceEvidence.evidencePath), dishonest);
  fs.writeFileSync(path.join(item.root, '.kstack', 'experience-evidence.json'), `${canonical(manifest)}\n`);
  const value = result(loaded.digest, manifest);
  fs.writeFileSync(path.join(item.root, '.kstack', 'experience-result.json'), `${JSON.stringify(value)}\n`);
  assert.throws(() => readExperienceResult(item.root, '.kstack/experience-result.json', loaded.contract, binding(loaded.digest)), /KSTACK_EXPERIENCE_PERFORMANCE_EVIDENCE_CONTENT_INVALID/u);
});
