import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { derivePostDeployDefects, parseArgs, readPlan, runPostDeploy, sourceManifest, validatePlan } from '../plugins/kstack/scripts/kstack-post-deploy.mjs';

const commitSha = '1'.repeat(40);
const artifactSha256 = '2'.repeat(64);

function plan(overrides = {}) {
  const base = {
    schemaVersion: 'kstack-post-deploy-validation-plan-v1',
    planId: 'production-browser-validation',
    environment: 'production',
    allowedOrigins: ['https://app.example.test'],
    handoff: { jiraRequired: false, maxCanaryDurationMs: 60_000, maxSuiteDurationMs: 120_000 },
    playwright: {
      configPath: 'playwright.config.mjs', testPaths: ['tests/post-deploy'], projects: ['chromium'], canaryBrowser: 'chromium',
      navigationTimeoutMs: 5_000, testTimeoutMs: 5_000, globalTimeoutMs: 10_000,
      retries: 1, workers: 1, expectedStatuses: [200], waitUntil: 'load',
      failOnConsoleError: true, failOnRequestFailure: true, allowSkipped: false
    }
  };
  return { ...base, ...overrides, playwright: { ...base.playwright, ...(overrides.playwright ?? {}) } };
}

function experienceContract() {
  const lanes = ['critical-journey', 'accessibility', 'responsive', 'visual-regression', 'brand-consistency', 'content-clarity', 'state-coverage', 'performance'];
  return {
    schemaVersion: 'kstack-product-experience-v1', surface: 'user-facing', adoption: { mode: 'adopt-existing', decisionId: 'fixture-decision', ownerConfirmed: true },
    product: { name: 'Fixture', promise: 'Make deployed behavior clear.', primaryUsers: ['Operator'], jobs: ['Validate a release'], brandTraits: ['clear', 'calm', 'trusted'], antiTraits: ['noisy'], voicePrinciples: ['Lead with the outcome.'], informationArchitecturePrinciples: ['Keep status and recovery together.'] },
    system: { tokenFormat: 'project-native', tokensPath: 'ui/tokens.json', componentRoots: ['ui/components'], assetRoots: [], exceptions: [] },
    journeys: [{ id: 'release', name: 'Validate release', priority: 'critical', testPath: 'tests/post-deploy/release.spec.mjs', requiredStates: ['loading', 'success', 'system-error', 'retry'], successOutcome: 'The operator validates the release.', alternatives: ['Guided validation', 'Checklist validation'], selectedAlternative: 'Guided validation', selectionRationale: 'The guided flow presents evidence before release.', hierarchy: 'Status and evidence lead; recovery follows the failing check.', interactionModel: 'Keyboard and pointer users advance through explicit validation steps.', recoveryBehavior: 'A failed check retains context and offers retry or safe exit.' }],
    validation: {
      accessibilityTarget: 'wcag-2.2-aa', requiredLanes: lanes,
      minimumCasesByLane: Object.fromEntries(lanes.map((lane) => [lane, 1])),
      viewports: [{ id: 'mobile', width: 390, height: 844, inputModes: ['touch', 'screen-reader'], touch: true, colorScheme: 'light' }, { id: 'desktop', width: 1440, height: 900, inputModes: ['keyboard', 'mouse', 'screen-reader'], touch: false, colorScheme: 'dark' }],
      locales: ['en-US'], zoomPercents: [100, 200],
      visualReview: { required: true, syntheticDataOnly: true, minimumConfidence: 93, baselineApprovalId: 'fixture-baselines-2026-08-28', baselineRoots: ['tests/post-deploy'] },
      performance: { maxLcpMs: 2500, maxInpMs: 200, maxClsMilli: 100, fieldEvidenceRequired: false }
    }
  };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-post-deploy-'));
  fs.mkdirSync(path.join(root, '.kstack'));
  fs.mkdirSync(path.join(root, 'tests', 'post-deploy'), { recursive: true });
  fs.mkdirSync(path.join(root, 'ui', 'components'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', '@playwright', 'test'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}\n');
  fs.writeFileSync(path.join(root, 'playwright.config.mjs'), 'export default {};\n');
  fs.writeFileSync(path.join(root, 'ui', 'tokens.json'), '{}\n');
  fs.writeFileSync(path.join(root, 'ui', 'components', 'button.css'), '.button{}\n');
  fs.writeFileSync(path.join(root, 'tests', 'post-deploy', 'release.spec.mjs'), '/* consumes KSTACK_POST_DEPLOY_BASE_URL */\n');
  const packageRoot = path.join(root, 'node_modules', '@playwright', 'test');
  fs.writeFileSync(path.join(packageRoot, 'package.json'), '{"name":"@playwright/test","version":"9.9.9-test","type":"module","main":"index.js"}\n');
  fs.writeFileSync(path.join(packageRoot, 'index.js'), `
import fs from 'node:fs';
function page() {
  return {
    on() {}, setDefaultNavigationTimeout() {},
    async goto(url) { globalThis.__kstackUrl = process.env.FAKE_FINAL_URL || url; return { status: () => 200 }; },
    url() { return globalThis.__kstackUrl; }, async title() { return 'Healthy fixture'; },
    async screenshot({ path }) { fs.writeFileSync(path, 'png'); }
  };
}
const browserType = { async launch() { return {
  async newContext() { return { tracing: { async start() {}, async stop({ path }) { fs.writeFileSync(path, 'trace'); } }, async newPage() { return page(); }, async close() {} }; },
  async close() {}
}; } };
export const chromium = browserType;
export const firefox = browserType;
export const webkit = browserType;
`);
  fs.writeFileSync(path.join(packageRoot, 'cli.js'), `import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const canonical = (value) => value === null || typeof value === 'boolean' || typeof value === 'string' || Number.isSafeInteger(value) ? JSON.stringify(value) : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : '{' + Object.keys(value).sort((a,b) => Buffer.compare(Buffer.from(a),Buffer.from(b))).map((key) => JSON.stringify(key)+':'+canonical(value[key])).join(',') + '}';
const canary = Boolean(process.env.KSTACK_CANARY_OBSERVATION_PATH);
const flaky = process.env.FAKE_SUITE_MODE === 'flaky';
const skipped = process.env.FAKE_SUITE_MODE === 'skipped';
const results = canary ? [{status:'passed'}] : flaky ? [{status:'failed'}, {status:'passed'}] : skipped ? [{status:'skipped'}] : [{status:'passed'}];
fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE, JSON.stringify({ suites: [{ specs: [{ tests: [{ results }] }] }] }));
if (canary) {
  const finalUrl = new URL(process.env.FAKE_FINAL_URL || process.env.KSTACK_POST_DEPLOY_BASE_URL);
  fs.writeFileSync(process.env.KSTACK_CANARY_OBSERVATION_PATH, JSON.stringify({ responseStatus: 200, finalOrigin: finalUrl.origin, finalPathSha256: '3'.repeat(64), titleSha256: '4'.repeat(64), consoleErrors: 0, requestFailures: 0 }));
  fs.writeFileSync(process.env.KSTACK_CANARY_SCREENSHOT_PATH, 'png');
}
if (!canary && process.env.KSTACK_EXPERIENCE_RESULT_PATH) {
  const lanes = ['critical-journey', 'accessibility', 'responsive', 'visual-regression', 'brand-consistency', 'content-clarity', 'state-coverage', 'performance'];
  const mode = process.env.FAKE_EXPERIENCE_MODE;
  const cases = [];
  const add = (caseId,lane,state,viewportId,zoomPercent,checkType) => cases.push({caseId,lane,journeyId:'release',state,viewportId,locale:'en-US',zoomPercent,checkType,outcome:'PASS',evidencePath:'cases/'+caseId+'.txt',evidenceSha256:sha(caseId)});
  for (const lane of lanes) add('base-'+lane,lane,'success','mobile',100,lane);
  for (const check of ['axe','keyboard','focus','aria','contrast','reflow']) add('a11y-'+check,'accessibility','success','desktop',100,check);
  for (const state of ['loading','system-error','retry']) add('state-'+state,'state-coverage',state,'mobile',100,'state');
  for (const state of ['loading','system-error','retry']) add('visual-state-'+state,'visual-regression',state,'mobile',100,'state');
  for (const viewport of ['mobile','desktop']) for (const zoom of [100,200]) for (const lane of ['responsive','visual-regression']) add('matrix-'+lane+'-'+viewport+'-'+zoom,lane,'success',viewport,zoom,lane);
  const runDir = path.dirname(process.env.KSTACK_EXPERIENCE_RESULT_PATH); fs.mkdirSync(path.join(runDir,'cases'));
  for (const item of cases) fs.writeFileSync(path.join(runDir,item.evidencePath),item.caseId);
  const performanceRaw = {schemaVersion:'kstack-performance-measurement-v1',journeyId:'release',evidenceKind:'lab',environment:'chromium fixture',sampleSize:5,windowStart:'2026-08-28T10:00:00.000Z',windowEnd:'2026-08-28T10:05:00.000Z',lcpMs:2000,inpMs:150,clsMilli:50};
  const performanceRawBytes = canonical(performanceRaw)+'\\n';
  fs.mkdirSync(path.join(runDir,'performance')); fs.writeFileSync(path.join(runDir,'performance','raw.json'),performanceRawBytes);
  const manifest = {schemaVersion:'kstack-experience-evidence-manifest-v1',contractSha256:process.env.KSTACK_EXPERIENCE_CONTRACT_SHA256,release:{releaseId:process.env.KSTACK_POST_DEPLOY_RELEASE_ID,deploymentId:process.env.KSTACK_POST_DEPLOY_DEPLOYMENT_ID,commitSha:process.env.KSTACK_POST_DEPLOY_COMMIT_SHA,artifactSha256:process.env.KSTACK_POST_DEPLOY_ARTIFACT_SHA256},cases,manualAccessibilityStatus:'PENDING_OWNER_ASSESSMENT',visualDisclosure:{classification:'synthetic',authorizationReceiptPath:null,authorizationReceiptSha256:null},performanceEvidence:{journeyId:'release',evidenceKind:'lab',environment:'chromium fixture',sampleSize:5,windowStart:'2026-08-28T10:00:00.000Z',windowEnd:'2026-08-28T10:05:00.000Z',evidencePath:'performance/raw.json',evidenceSha256:sha(performanceRawBytes),lcpMs:2000,inpMs:150,clsMilli:50}};
  const manifestBytes = canonical(manifest)+'\\n'; fs.writeFileSync(path.join(runDir,'experience-evidence.json'),manifestBytes);
  const projected = (lane) => cases.filter((item)=>item.lane===lane).map((item)=>({...item})).sort((a,b)=>Buffer.compare(Buffer.from(a.caseId),Buffer.from(b.caseId)));
  const visual = projected('visual-regression');
  const result = {
    schemaVersion: 'kstack-experience-runtime-result-v2', contractSha256: process.env.KSTACK_EXPERIENCE_CONTRACT_SHA256, evidenceManifestPath:'experience-evidence.json', evidenceManifestSha256:sha(manifestBytes),
    release: { releaseId: process.env.KSTACK_POST_DEPLOY_RELEASE_ID, deploymentId: process.env.KSTACK_POST_DEPLOY_DEPLOYMENT_ID, commitSha: process.env.KSTACK_POST_DEPLOY_COMMIT_SHA, artifactSha256: process.env.KSTACK_POST_DEPLOY_ARTIFACT_SHA256 },
    lanes: lanes.map((lane) => { const laneCases=projected(lane); return { lane, cases: laneCases.length, failed: 0, findings: mode === 'accessibility-finding' && lane === 'accessibility' ? 1 : 0, evidenceSha256: sha(canonical(laneCases)+'\\n') }; }),
    metrics: { evidenceKind: 'lab', lcpMs: 2000, inpMs: 150, clsMilli: 50 },
    visualReview: { status: mode === 'review-pending' ? 'PENDING' : 'APPROVED', confidence: 93, failed: 0, security: 0, dissent: 0, questions: 0, screenshotManifestSha256: sha(canonical(visual)+'\\n') }
  };
  fs.writeFileSync(process.env.KSTACK_EXPERIENCE_RESULT_PATH, JSON.stringify(result));
  if (mode === 'source-drift') fs.writeFileSync(path.join(process.cwd(),'ui','tokens.json'),'drift');
}
`, { mode: 0o700 });
  const selectedPlan = plan();
  fs.writeFileSync(path.join(root, '.kstack', 'post-deploy-validation.json'), `${JSON.stringify(selectedPlan, null, 2)}\n`);
  return { root, selectedPlan };
}

function writeV2(root, selected) {
  fs.writeFileSync(path.join(root, '.kstack', 'post-deploy-validation.json'), `${JSON.stringify(selected, null, 2)}\n`);
  fs.writeFileSync(path.join(root, '.kstack', 'experience.json'), `${JSON.stringify(experienceContract(), null, 2)}\n`);
}

function options(root) {
  return {
    projectRoot: root, planPath: '.kstack/post-deploy-validation.json', baseUrl: 'https://app.example.test/',
    releaseId: 'release-1', deploymentId: 'deployment-1', commitSha, artifactSha256
  };
}

test('plan schema is closed and production is HTTPS-only', () => {
  assert.equal(validatePlan(plan()).environment, 'production');
  assert.throws(() => validatePlan({ ...plan(), surprise: true }), /KSTACK_POST_DEPLOY_PLAN_INVALID/u);
  assert.throws(() => validatePlan(plan({ allowedOrigins: ['http://app.example.test'] })), /PRODUCTION_REQUIRES_HTTPS/u);
  assert.throws(() => validatePlan(plan({ playwright: { retries: 3 } })), /RETRIES_INVALID/u);
  assert.throws(() => validatePlan(plan({ playwright: { testPaths: ['../escape'] } })), /TEST_PATHS_INVALID/u);
});

test('legacy v1 cannot bypass a repository experience contract', () => {
  const { root } = fixture();
  try {
    fs.writeFileSync(path.join(root, '.kstack', 'experience.json'), `${JSON.stringify(experienceContract(), null, 2)}\n`);
    assert.throws(() => readPlan(root, '.kstack/post-deploy-validation.json'), /KSTACK_POST_DEPLOY_EXPERIENCE_PLAN_V2_REQUIRED/u);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('plan and test sources are descriptor-read, bounded, and symlink-rejecting', () => {
  const { root, selectedPlan } = fixture();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-post-deploy-outside-'));
  try {
    const loaded = readPlan(root, '.kstack/post-deploy-validation.json');
    assert.match(loaded.digest, /^[0-9a-f]{64}$/u);
    assert.equal(sourceManifest(root, selectedPlan).files, 2);
    fs.symlinkSync(path.join(root, 'tests', 'post-deploy', 'release.spec.mjs'), path.join(root, 'tests', 'post-deploy', 'linked.spec.mjs'));
    assert.throws(() => sourceManifest(root, selectedPlan), /SOURCE_SYMLINK/u);
    fs.unlinkSync(path.join(root, 'tests', 'post-deploy', 'linked.spec.mjs'));
    fs.writeFileSync(path.join(outside, 'outside.spec.mjs'), 'outside\n');
    fs.symlinkSync(outside, path.join(root, 'linked-tests'));
    assert.throws(() => sourceManifest(root, plan({ playwright: { testPaths: ['linked-tests'] } })), /SOURCE_SYMLINK/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('CLI rejects unknown or duplicate options instead of silently changing the run', () => {
  assert.throws(() => parseArgs(['validate-plan', '--project-root', '.', '--plan', '.kstack/post-deploy-validation.json', '--extra', 'yes']), /KSTACK_POST_DEPLOY_USAGE/u);
  assert.throws(() => parseArgs(['validate-plan', '--project-root', '.', '--project-root', '.', '--plan', '.kstack/post-deploy-validation.json']), /KSTACK_POST_DEPLOY_USAGE/u);
  assert.doesNotThrow(() => parseArgs(['run', '--project-root', '.', '--plan', 'plan.json', '--base-url', 'https://app.example.test', '--release-id', 'r1', '--deployment-id', 'd1', '--commit-sha', commitSha, '--artifact-sha256', artifactSha256, '--jira-config', '.kstack/config.json', '--thread-id', 'thread-1', '--item-id', 'item-1']));
  assert.throws(() => parseArgs(['run', '--project-root', '.', '--plan', 'plan.json', '--base-url', 'https://app.example.test', '--release-id', 'r1', '--deployment-id', 'd1', '--commit-sha', commitSha, '--artifact-sha256', artifactSha256, '--jira-config', '.kstack/config.json']), /KSTACK_POST_DEPLOY_USAGE/u);
});

test('a healthy receipt requires both the independent canary and a nonempty clean suite', async () => {
  const { root } = fixture();
  try {
    const result = await runPostDeploy(options(root));
    assert.equal(result.receipt.status, 'HEALTHY');
    assert.equal(result.receipt.playwright.version, '9.9.9-test');
    assert.equal(result.receipt.playwright.canary.status, 'PASS');
    assert.deepEqual(result.receipt.playwright.suite.counts, { total: 1, passed: 1, failed: 0, flaky: 0, skipped: 0, interrupted: 0 });
    assert.match(result.receipt.receiptSha256, /^[0-9a-f]{64}$/u);
    assert.equal(result.handoff.status, 'READY_FOR_USER_VALIDATION');
    assert.equal(fs.existsSync(path.join(path.dirname(result.path), 'playwright-results.json')), false);
    assert.equal(fs.statSync(result.path).mode & 0o077, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('runtime defects classify functional, slow, flaky, skipped, timeout, console, and request failures', () => {
  const defects = derivePostDeployDefects(
    { status: 'FAIL', consoleErrors: 2, requestFailures: 1, durationMs: 6_000 },
    { status: 'FAIL', timedOut: true, durationMs: 11_000, counts: { failed: 2, flaky: 1, interrupted: 1, skipped: 1 } },
    { maxCanaryDurationMs: 5_000, maxSuiteDurationMs: 10_000 }
  );
  assert.deepEqual(new Set(defects.map((item) => item.category)), new Set([
    'runtime-health', 'browser-console', 'request-failure', 'functional', 'inconsistent', 'timeout', 'coverage', 'performance', 'performance-suite'
  ]));
  assert.equal(defects.every((item) => /^[0-9a-f]{16}$/u.test(item.fingerprint)), true);
});

test('Jira-required health does not hand off until durable events are projected', async () => {
  const { root } = fixture();
  const planPath = path.join(root, '.kstack', 'post-deploy-validation.json');
  const required = plan({ handoff: { jiraRequired: true, maxCanaryDurationMs: 60_000, maxSuiteDurationMs: 120_000 } });
  fs.writeFileSync(planPath, `${JSON.stringify(required, null, 2)}\n`);
  try {
    const pending = await runPostDeploy({
      ...options(root), jira: { configPath: '.kstack/config.json', threadId: 'release-thread', itemId: 'release-item' },
      recordTracking: async () => ({ mode: 'approval-queued', eventCount: 3, draftCount: 1, projectedCount: 0, statusCount: 0, versionCount: 0, projectionComplete: false })
    });
    assert.equal(pending.receipt.status, 'HEALTHY');
    assert.equal(pending.handoff.status, 'JIRA_TRACKING_PENDING');

    const projected = await runPostDeploy({
      ...options(root), jira: { configPath: '.kstack/config.json', threadId: 'release-thread', itemId: 'release-item' },
      recordTracking: async () => ({ mode: 'automatic', eventCount: 3, draftCount: 1, projectedCount: 3, statusCount: 1, versionCount: 1, projectionComplete: true })
    });
    assert.equal(projected.handoff.status, 'READY_FOR_USER_VALIDATION');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('flaky success and a canary redirect outside the allowlist both fail closed', async () => {
  const first = fixture();
  const second = fixture();
  try {
    process.env.FAKE_SUITE_MODE = 'flaky';
    const flaky = await runPostDeploy(options(first.root));
    assert.equal(flaky.receipt.status, 'FAILED');
    assert.equal(flaky.receipt.playwright.suite.counts.flaky, 1);
    delete process.env.FAKE_SUITE_MODE;
    process.env.FAKE_FINAL_URL = 'https://unexpected.example.test/';
    const redirected = await runPostDeploy(options(second.root));
    assert.equal(redirected.receipt.status, 'FAILED');
    assert.equal(redirected.receipt.playwright.canary.status, 'FAIL');
    assert.equal(redirected.receipt.playwright.suite.status, 'NOT_RUN_CANARY_FAILED');
  } finally {
    delete process.env.FAKE_SUITE_MODE;
    delete process.env.FAKE_FINAL_URL;
    fs.rmSync(first.root, { recursive: true, force: true });
    fs.rmSync(second.root, { recursive: true, force: true });
  }
});

test('v2 requires exact product-experience evidence before user handoff', async () => {
  const { root } = fixture();
  const selected = plan({ schemaVersion: 'kstack-post-deploy-validation-plan-v2', handoff: { jiraRequired: true, maxCanaryDurationMs: 60_000, maxSuiteDurationMs: 120_000 }, experience: { required: true, contractPath: '.kstack/experience.json' } });
  writeV2(root, selected);
  try {
    const pending = await runPostDeploy(options(root));
    assert.equal(pending.handoff.status, 'JIRA_TRACKING_PENDING');
    const passed = await runPostDeploy({
      ...options(root), jira: { configPath: '.kstack/config.json', threadId: 'release-thread', itemId: 'release-item' },
      recordTracking: async () => ({ mode: 'automatic', eventCount: 3, draftCount: 1, projectedCount: 3, statusCount: 1, versionCount: 1, projectionComplete: true })
    });
    assert.equal(passed.receipt.schemaVersion, 'kstack-post-deploy-validation-receipt-v2');
    assert.equal(passed.receipt.experience.status, 'PASS');
    assert.equal(passed.handoff.status, 'READY_FOR_USER_VALIDATION');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('v2 creates category-specific experience defects and separates pending review', async () => {
  const first = fixture(); const second = fixture();
  for (const root of [first.root, second.root]) {
    const selected = plan({ schemaVersion: 'kstack-post-deploy-validation-plan-v2', handoff: { jiraRequired: true, maxCanaryDurationMs: 60_000, maxSuiteDurationMs: 120_000 }, experience: { required: true, contractPath: '.kstack/experience.json' } });
    writeV2(root, selected);
  }
  try {
    process.env.FAKE_EXPERIENCE_MODE = 'accessibility-finding';
    const failed = await runPostDeploy(options(first.root));
    assert.equal(failed.handoff.status, 'EXPERIENCE_REMEDIATION_REQUIRED');
    assert.equal(failed.receipt.defects.some((defect) => defect.category === 'accessibility'), true);
    process.env.FAKE_EXPERIENCE_MODE = 'review-pending';
    const pending = await runPostDeploy(options(second.root));
    assert.equal(pending.handoff.status, 'EXPERIENCE_REVIEW_REQUIRED');
    assert.equal(pending.receipt.defects.some((defect) => defect.category === 'visual-review'), true);
  } finally {
    delete process.env.FAKE_EXPERIENCE_MODE;
    fs.rmSync(first.root, { recursive: true, force: true });
    fs.rmSync(second.root, { recursive: true, force: true });
  }
});

test('v2 rejects experience source drift during the browser suite', async () => {
  const { root } = fixture();
  const selected = plan({ schemaVersion: 'kstack-post-deploy-validation-plan-v2', handoff: { jiraRequired: true, maxCanaryDurationMs: 60_000, maxSuiteDurationMs: 120_000 }, experience: { required: true, contractPath: '.kstack/experience.json' } });
  writeV2(root, selected);
  try {
    process.env.FAKE_EXPERIENCE_MODE = 'source-drift';
    const failed = await runPostDeploy(options(root));
    assert.equal(failed.handoff.status, 'EXPERIENCE_REMEDIATION_REQUIRED');
    assert.deepEqual(failed.receipt.experience.failures, [{ lane: 'runtime', reason: 'KSTACK_EXPERIENCE_SOURCE_DRIFT' }]);
  } finally {
    delete process.env.FAKE_EXPERIENCE_MODE;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
