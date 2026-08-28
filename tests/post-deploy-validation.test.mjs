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

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-post-deploy-'));
  fs.mkdirSync(path.join(root, '.kstack'));
  fs.mkdirSync(path.join(root, 'tests', 'post-deploy'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', '@playwright', 'test'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}\n');
  fs.writeFileSync(path.join(root, 'playwright.config.mjs'), 'export default {};\n');
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
  fs.writeFileSync(path.join(packageRoot, 'cli.js'), `import fs from 'node:fs';
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
`, { mode: 0o700 });
  const selectedPlan = plan();
  fs.writeFileSync(path.join(root, '.kstack', 'post-deploy-validation.json'), `${JSON.stringify(selectedPlan, null, 2)}\n`);
  return { root, selectedPlan };
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
