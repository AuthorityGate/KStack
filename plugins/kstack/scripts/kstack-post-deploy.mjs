#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { sanitize } from './kstack-safety-matchers.mjs';
import { loadJiraState } from './kstack-jira.mjs';
import { appendTrackingEvent, listTrackingEvents, syncTrackingEvents } from './kstack-jira-tracking.mjs';
import { experienceSourceManifest, readExperienceContract, readExperienceResult } from './kstack-experience.mjs';

const PLAN_SCHEMA_V1 = 'kstack-post-deploy-validation-plan-v1';
const PLAN_SCHEMA_V2 = 'kstack-post-deploy-validation-plan-v2';
const RECEIPT_SCHEMA = 'kstack-post-deploy-validation-receipt-v1';
const RECEIPT_SCHEMA_V2 = 'kstack-post-deploy-validation-receipt-v2';
const HANDOFF_SCHEMA = 'kstack-post-deploy-handoff-receipt-v1';
const HANDOFF_SCHEMA_V2 = 'kstack-post-deploy-handoff-receipt-v2';
const OUTPUT_PREFIX = 'KSTACK_POST_DEPLOY_VALIDATION_V1 ';
const OUTPUT_PREFIX_V2 = 'KSTACK_POST_DEPLOY_VALIDATION_V2 ';
const HANDOFF_PREFIX = 'KSTACK_POST_DEPLOY_HANDOFF_V1 ';
const HANDOFF_PREFIX_V2 = 'KSTACK_POST_DEPLOY_HANDOFF_V2 ';
const MAX_PLAN_BYTES = 65_536;
const MAX_REPORT_BYTES = 16 * 1024 * 1024;
const MAX_SOURCE_FILES = 2_048;
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 65_536;
const MAX_ARTIFACT_FILES = 8_192;
const MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;
const MAX_ARTIFACT_NODES = 16_384;
const MAX_ARTIFACT_DEPTH = 32;
const HEX64 = /^[0-9a-f]{64}$/u;
const GIT_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const PLAN_KEYS_V1 = new Set(['schemaVersion', 'planId', 'environment', 'allowedOrigins', 'playwright', 'handoff']);
const PLAN_KEYS_V2 = new Set([...PLAN_KEYS_V1, 'experience']);
const EXPERIENCE_KEYS = new Set(['required', 'contractPath']);
const HANDOFF_KEYS = new Set(['jiraRequired', 'maxCanaryDurationMs', 'maxSuiteDurationMs']);
const PLAYWRIGHT_KEYS = new Set([
  'configPath', 'testPaths', 'projects', 'canaryBrowser', 'navigationTimeoutMs',
  'testTimeoutMs', 'globalTimeoutMs', 'retries', 'workers', 'expectedStatuses',
  'waitUntil', 'failOnConsoleError', 'failOnRequestFailure', 'allowSkipped'
]);

function byteSort(left, right) { return Buffer.compare(Buffer.from(left), Buffer.from(right)); }
function fail(code, detail = null) { const error = new Error(code); error.code = code; error.detail = detail; throw error; }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string' || Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!value || typeof value !== 'object') fail('KSTACK_POST_DEPLOY_CANONICAL_JSON_INVALID');
  return `{${Object.keys(value).sort(byteSort).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function canonicalBytes(value) { return Buffer.from(`${canonical(value)}\n`); }
function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === expected.size
    && Object.keys(value).every((key) => expected.has(key));
}
function safeRelative(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
    && !path.isAbsolute(value) && !value.includes('\\') && path.posix.normalize(value) === value
    && value !== '.' && !value.startsWith('../') && !value.split('/').some((part) => part === '' || part === '.' || part === '..');
}
function parseOrigin(value, environment) {
  let parsed;
  try { parsed = new URL(value); } catch { fail('KSTACK_POST_DEPLOY_ORIGIN_INVALID'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) fail('KSTACK_POST_DEPLOY_ORIGIN_INVALID');
  if (environment === 'production' && parsed.protocol !== 'https:') fail('KSTACK_POST_DEPLOY_PRODUCTION_REQUIRES_HTTPS');
  return parsed.origin;
}
function parseBaseUrl(value, environment) {
  let parsed;
  try { parsed = new URL(value); } catch { fail('KSTACK_POST_DEPLOY_BASE_URL_INVALID'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) fail('KSTACK_POST_DEPLOY_BASE_URL_INVALID');
  if (environment === 'production' && parsed.protocol !== 'https:') fail('KSTACK_POST_DEPLOY_PRODUCTION_REQUIRES_HTTPS');
  return parsed;
}

function safeRead(file, maximum, code) {
  const before = fs.lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink() || before.size > maximum) fail(code);
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
  const handle = fs.openSync(file, flags);
  try {
    const opened = fs.fstatSync(handle);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) fail(code);
    const bytes = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(handle, bytes, offset, bytes.length - offset, offset);
      if (count === 0) fail(code);
      offset += count;
    }
    const after = fs.fstatSync(handle);
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs) fail(code);
    return bytes;
  } finally { fs.closeSync(handle); }
}

function assertContainedNoSymlinks(root, absolute, code) {
  const relative = path.relative(root, absolute);
  if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(code);
  let current = root;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) fail(code);
  }
  const real = fs.realpathSync(absolute);
  const realRelative = path.relative(root, real);
  if (realRelative === '' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) fail(code);
}

export function validatePlan(plan) {
  const isV1 = plan?.schemaVersion === PLAN_SCHEMA_V1;
  const isV2 = plan?.schemaVersion === PLAN_SCHEMA_V2;
  if ((!isV1 && !isV2) || !exactKeys(plan, isV2 ? PLAN_KEYS_V2 : PLAN_KEYS_V1) || !ID.test(plan.planId ?? '')) fail('KSTACK_POST_DEPLOY_PLAN_INVALID');
  if (!['development', 'staging', 'production'].includes(plan.environment)) fail('KSTACK_POST_DEPLOY_ENVIRONMENT_INVALID');
  if (!Array.isArray(plan.allowedOrigins) || plan.allowedOrigins.length < 1 || plan.allowedOrigins.length > 8) fail('KSTACK_POST_DEPLOY_ORIGINS_INVALID');
  const origins = plan.allowedOrigins.map((value) => parseOrigin(value, plan.environment));
  if (new Set(origins).size !== origins.length) fail('KSTACK_POST_DEPLOY_ORIGINS_INVALID');
  const pw = plan.playwright;
  if (!exactKeys(pw, PLAYWRIGHT_KEYS) || !safeRelative(pw.configPath)) fail('KSTACK_POST_DEPLOY_PLAYWRIGHT_CONFIG_INVALID');
  if (!Array.isArray(pw.testPaths) || pw.testPaths.length < 1 || pw.testPaths.length > 64 || !pw.testPaths.every(safeRelative) || new Set(pw.testPaths).size !== pw.testPaths.length) fail('KSTACK_POST_DEPLOY_TEST_PATHS_INVALID');
  if (!Array.isArray(pw.projects) || pw.projects.length < 1 || pw.projects.length > 16 || !pw.projects.every((item) => typeof item === 'string' && /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/u.test(item)) || new Set(pw.projects).size !== pw.projects.length) fail('KSTACK_POST_DEPLOY_PROJECTS_INVALID');
  if (!['chromium', 'firefox', 'webkit'].includes(pw.canaryBrowser)) fail('KSTACK_POST_DEPLOY_CANARY_BROWSER_INVALID');
  for (const [key, minimum, maximum] of [
    ['navigationTimeoutMs', 1_000, 120_000], ['testTimeoutMs', 1_000, 120_000],
    ['globalTimeoutMs', 10_000, 1_800_000], ['retries', 0, 2], ['workers', 1, 16]
  ]) if (!Number.isSafeInteger(pw[key]) || pw[key] < minimum || pw[key] > maximum) fail(`KSTACK_POST_DEPLOY_${key.toUpperCase()}_INVALID`);
  if (!Array.isArray(pw.expectedStatuses) || pw.expectedStatuses.length < 1 || pw.expectedStatuses.length > 16 || !pw.expectedStatuses.every((item) => Number.isInteger(item) && item >= 100 && item <= 599) || new Set(pw.expectedStatuses).size !== pw.expectedStatuses.length) fail('KSTACK_POST_DEPLOY_EXPECTED_STATUSES_INVALID');
  if (!['commit', 'domcontentloaded', 'load', 'networkidle'].includes(pw.waitUntil)) fail('KSTACK_POST_DEPLOY_WAIT_UNTIL_INVALID');
  for (const key of ['failOnConsoleError', 'failOnRequestFailure', 'allowSkipped']) if (typeof pw[key] !== 'boolean') fail(`KSTACK_POST_DEPLOY_${key.toUpperCase()}_INVALID`);
  if (!exactKeys(plan.handoff, HANDOFF_KEYS) || typeof plan.handoff.jiraRequired !== 'boolean') fail('KSTACK_POST_DEPLOY_HANDOFF_INVALID');
  for (const [key, minimum, maximum] of [
    ['maxCanaryDurationMs', 1_000, 180_000], ['maxSuiteDurationMs', 1_000, 1_800_000]
  ]) if (!Number.isSafeInteger(plan.handoff[key]) || plan.handoff[key] < minimum || plan.handoff[key] > maximum) fail(`KSTACK_POST_DEPLOY_${key.toUpperCase()}_INVALID`);
  if (isV2 && (!exactKeys(plan.experience, EXPERIENCE_KEYS) || plan.experience.required !== true || !safeRelative(plan.experience.contractPath) || plan.handoff.jiraRequired !== true)) fail('KSTACK_POST_DEPLOY_EXPERIENCE_INVALID');
  return Object.freeze({ ...plan, allowedOrigins: origins, playwright: Object.freeze({ ...pw }), handoff: Object.freeze({ ...plan.handoff }), experience: isV2 ? Object.freeze({ ...plan.experience }) : null });
}

export function readPlan(projectRoot, planPath) {
  const root = fs.realpathSync(projectRoot);
  const absolute = path.resolve(root, planPath);
  const relative = path.relative(root, absolute);
  if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail('KSTACK_POST_DEPLOY_PLAN_OUTSIDE_PROJECT');
  assertContainedNoSymlinks(root, absolute, 'KSTACK_POST_DEPLOY_PLAN_PATH_INVALID');
  let value;
  const bytes = safeRead(absolute, MAX_PLAN_BYTES, 'KSTACK_POST_DEPLOY_PLAN_READ_INVALID');
  try { value = JSON.parse(bytes.toString('utf8')); } catch { fail('KSTACK_POST_DEPLOY_PLAN_JSON_INVALID'); }
  const plan = validatePlan(value);
  if (plan.schemaVersion === PLAN_SCHEMA_V1 && fs.existsSync(path.join(root, '.kstack', 'experience.json'))) fail('KSTACK_POST_DEPLOY_EXPERIENCE_PLAN_V2_REQUIRED');
  return { root, absolute, bytes, digest: sha256(bytes), plan };
}

function walkSources(root, relative, entries, totals) {
  const absolute = path.join(root, relative);
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) fail('KSTACK_POST_DEPLOY_SOURCE_SYMLINK');
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(absolute).sort(byteSort)) walkSources(root, path.posix.join(relative, name), entries, totals);
    return;
  }
  if (!stat.isFile()) fail('KSTACK_POST_DEPLOY_SOURCE_TYPE_INVALID');
  totals.files += 1; totals.bytes += stat.size;
  if (totals.files > MAX_SOURCE_FILES || totals.bytes > MAX_SOURCE_BYTES) fail('KSTACK_POST_DEPLOY_SOURCE_BUDGET_EXCEEDED');
  const bytes = safeRead(absolute, MAX_SOURCE_BYTES, 'KSTACK_POST_DEPLOY_SOURCE_READ_INVALID');
  entries.push({ path: relative, size: bytes.length, sha256: sha256(bytes) });
}

export function sourceManifest(projectRoot, plan) {
  const entries = [];
  const totals = { files: 0, bytes: 0 };
  for (const relative of [plan.playwright.configPath, ...plan.playwright.testPaths].sort(byteSort)) {
    assertContainedNoSymlinks(projectRoot, path.join(projectRoot, relative), 'KSTACK_POST_DEPLOY_SOURCE_SYMLINK');
    walkSources(projectRoot, relative, entries, totals);
  }
  entries.sort((left, right) => byteSort(left.path, right.path));
  const unique = entries.filter((entry, index) => index === 0 || entry.path !== entries[index - 1].path);
  return { files: unique.length, bytes: unique.reduce((sum, entry) => sum + entry.size, 0), digest: sha256(canonicalBytes(unique)) };
}

function ensurePrivateDirectory(directory, projectRoot) {
  const relative = path.relative(projectRoot, directory);
  if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail('KSTACK_POST_DEPLOY_EVIDENCE_OUTSIDE_PROJECT');
  let current = projectRoot;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) fs.mkdirSync(current, { mode: 0o700 });
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('KSTACK_POST_DEPLOY_EVIDENCE_PATH_INVALID');
    try { fs.chmodSync(current, 0o700); } catch {}
  }
}

function resolvePlaywright(projectRoot) {
  const require = createRequire(path.join(projectRoot, 'package.json'));
  let modulePath;
  try { modulePath = require.resolve('@playwright/test'); } catch { fail('KSTACK_POST_DEPLOY_PLAYWRIGHT_UNAVAILABLE'); }
  const packageRoot = path.dirname(modulePath);
  const cliPath = path.join(packageRoot, 'cli.js');
  const packagePath = path.join(packageRoot, 'package.json');
  if (!fs.existsSync(cliPath) || !fs.existsSync(packagePath)) fail('KSTACK_POST_DEPLOY_PLAYWRIGHT_UNAVAILABLE');
  const metadata = JSON.parse(safeRead(packagePath, MAX_PLAN_BYTES, 'KSTACK_POST_DEPLOY_PLAYWRIGHT_PACKAGE_INVALID').toString('utf8'));
  return { cliPath, version: metadata.version ?? 'unknown' };
}

function writeCanaryHarness(runDirectory) {
  const configPath = path.join(runDirectory, 'canary.config.mjs');
  const specPath = path.join(runDirectory, 'canary.spec.mjs');
  const screenshotPath = path.join(runDirectory, 'canary.png');
  const observationPath = path.join(runDirectory, 'canary-observation.json');
  fs.writeFileSync(configPath, `import path from 'node:path';\nimport { fileURLToPath } from 'node:url';\nimport { defineConfig } from '@playwright/test';\nconst here = path.dirname(fileURLToPath(import.meta.url));\nexport default defineConfig({ testDir: here, testMatch: 'canary.spec.mjs', workers: 1, retries: 0, timeout: Number(process.env.KSTACK_CANARY_TIMEOUT_MS), globalTimeout: Number(process.env.KSTACK_CANARY_GLOBAL_TIMEOUT_MS), forbidOnly: true, projects: [{ name: 'kstack-canary', use: { browserName: process.env.KSTACK_CANARY_BROWSER, headless: true, ignoreHTTPSErrors: false, serviceWorkers: 'block', trace: 'on' } }] });\n`, { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(specPath, `import crypto from 'node:crypto';\nimport fs from 'node:fs';\nimport { test, expect } from '@playwright/test';\nconst digest = (value) => crypto.createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex');\ntest('KStack independent deployed-target canary', async ({ page }) => {\n  let consoleErrors = 0; let requestFailures = 0; let responseStatus = null; let finalUrl = null; let titleSha256 = null;\n  page.on('console', (message) => { if (message.type() === 'error') consoleErrors += 1; });\n  page.on('requestfailed', () => { requestFailures += 1; });\n  try {\n    const response = await page.goto(process.env.KSTACK_POST_DEPLOY_BASE_URL, { waitUntil: process.env.KSTACK_CANARY_WAIT_UNTIL, timeout: Number(process.env.KSTACK_CANARY_TIMEOUT_MS) });\n    responseStatus = response?.status() ?? null; finalUrl = new URL(page.url()); titleSha256 = digest(await page.title());\n    await page.screenshot({ path: process.env.KSTACK_CANARY_SCREENSHOT_PATH, fullPage: true });\n    expect(JSON.parse(process.env.KSTACK_CANARY_EXPECTED_STATUSES)).toContain(responseStatus);\n    expect(JSON.parse(process.env.KSTACK_CANARY_ALLOWED_ORIGINS)).toContain(finalUrl.origin);\n    if (process.env.KSTACK_CANARY_FAIL_CONSOLE === 'true') expect(consoleErrors).toBe(0);\n    if (process.env.KSTACK_CANARY_FAIL_REQUEST === 'true') expect(requestFailures).toBe(0);\n  } finally {\n    const record = { responseStatus, finalOrigin: finalUrl?.origin ?? null, finalPathSha256: finalUrl ? digest(finalUrl.pathname + finalUrl.search) : null, titleSha256, consoleErrors, requestFailures };\n    fs.writeFileSync(process.env.KSTACK_CANARY_OBSERVATION_PATH, JSON.stringify(record));\n  }\n});\n`, { mode: 0o600, flag: 'wx' });
  return { configPath, specPath, screenshotPath, observationPath };
}

function independentCanary(root, resolved, browserName, baseUrl, pw, runDirectory) {
  const harness = writeCanaryHarness(runDirectory);
  const reportPath = path.join(runDirectory, 'canary-results.json');
  const environment = { ...process.env,
    CI: '1', KSTACK_POST_DEPLOY_BASE_URL: baseUrl, KSTACK_CANARY_BROWSER: browserName,
    KSTACK_CANARY_TIMEOUT_MS: String(pw.navigationTimeoutMs), KSTACK_CANARY_GLOBAL_TIMEOUT_MS: String(Math.min(pw.globalTimeoutMs, 180_000)),
    KSTACK_CANARY_WAIT_UNTIL: pw.waitUntil, KSTACK_CANARY_EXPECTED_STATUSES: JSON.stringify(pw.expectedStatuses),
    KSTACK_CANARY_ALLOWED_ORIGINS: JSON.stringify(pw.allowedOrigins), KSTACK_CANARY_FAIL_CONSOLE: String(pw.failOnConsoleError),
    KSTACK_CANARY_FAIL_REQUEST: String(pw.failOnRequestFailure), KSTACK_CANARY_SCREENSHOT_PATH: harness.screenshotPath,
    KSTACK_CANARY_OBSERVATION_PATH: harness.observationPath, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath, PLAYWRIGHT_HTML_OPEN: 'never'
  };
  for (const name of ['NODE_OPTIONS', 'NODE_PATH', 'PWDEBUG']) delete environment[name];
  const started = Date.now();
  const result = spawnSync(process.execPath, [resolved.cliPath, 'test', '--config', harness.configPath, '--workers', '1', '--retries', '0', '--reporter', 'json', '--output', path.join(runDirectory, 'canary-results'), '--forbid-only', '--update-snapshots', 'none'], {
    cwd: root, env: environment, encoding: 'utf8', shell: false, windowsHide: true,
    timeout: Math.min(pw.globalTimeoutMs, 180_000) + 10_000, maxBuffer: MAX_REPORT_BYTES, killSignal: 'SIGKILL'
  });
  let report = null; let observation = null;
  try { report = JSON.parse(safeRead(reportPath, MAX_REPORT_BYTES, 'KSTACK_POST_DEPLOY_CANARY_REPORT_INVALID').toString('utf8')); } catch {}
  try { observation = JSON.parse(safeRead(harness.observationPath, MAX_PLAN_BYTES, 'KSTACK_POST_DEPLOY_CANARY_OBSERVATION_INVALID').toString('utf8')); } catch {}
  try { fs.unlinkSync(reportPath); } catch {}
  try { fs.unlinkSync(harness.observationPath); } catch {}
  const counts = parseSuiteReport(report);
  const checks = {
    process: result.status === 0, oneTest: counts.total === 1 && counts.passed === 1 && counts.failed === 0 && counts.flaky === 0,
    observation: observation !== null, response: Boolean(observation && pw.expectedStatuses.includes(observation.responseStatus)),
    origin: Boolean(observation && pw.allowedOrigins.includes(observation.finalOrigin)),
    console: Boolean(observation && (!pw.failOnConsoleError || observation.consoleErrors === 0)),
    requests: Boolean(observation && (!pw.failOnRequestFailure || observation.requestFailures === 0))
  };
  const passed = Object.values(checks).every(Boolean);
  return { status: passed ? 'PASS' : 'FAIL', browser: browserName, responseStatus: observation?.responseStatus ?? null, finalOrigin: observation?.finalOrigin ?? null, finalPathSha256: observation?.finalPathSha256 ?? null, titleSha256: observation?.titleSha256 ?? null, consoleErrors: observation?.consoleErrors ?? 0, requestFailures: observation?.requestFailures ?? 0, counts, checks, exitCode: result.status, timedOut: result.error?.code === 'ETIMEDOUT', durationMs: Date.now() - started };
}

export function derivePostDeployDefects(canary, suite, handoff, experience = { status: 'NOT_REQUIRED', failures: [] }) {
  const defects = [];
  const add = (category, summary) => {
    const fingerprint = sha256(Buffer.from(`${category}\0${summary}`, 'utf8')).slice(0, 16);
    defects.push({ category, fingerprint, summary });
  };
  if (canary.status !== 'PASS') add('runtime-health', 'Deployed target failed the independent browser canary');
  if (canary.consoleErrors > 0) add('browser-console', `Deployed target emitted ${canary.consoleErrors} browser console error(s)`);
  if (canary.requestFailures > 0) add('request-failure', `Deployed target produced ${canary.requestFailures} failed browser request(s)`);
  if (suite.counts.failed > 0) add('functional', `${suite.counts.failed} post-deploy acceptance test(s) failed`);
  if (suite.counts.flaky > 0) add('inconsistent', `${suite.counts.flaky} post-deploy acceptance test(s) were flaky`);
  if (suite.counts.interrupted > 0 || suite.timedOut) add('timeout', 'Post-deploy validation was interrupted or timed out');
  if (suite.counts.skipped > 0) add('coverage', `${suite.counts.skipped} required post-deploy acceptance test(s) were skipped`);
  if (canary.durationMs > handoff.maxCanaryDurationMs) add('performance', `Independent browser canary exceeded its ${handoff.maxCanaryDurationMs} ms budget`);
  if (suite.durationMs > handoff.maxSuiteDurationMs) add('performance-suite', `Post-deploy suite exceeded its ${handoff.maxSuiteDurationMs} ms budget`);
  if (suite.status !== 'PASS' && defects.length === 0) add('acceptance', 'Post-deploy acceptance did not reach a clean passing result');
  const categories = {
    'critical-journey': 'ux-journey', accessibility: 'accessibility', responsive: 'responsive',
    'visual-regression': 'visual-regression', 'visual-review': 'visual-review',
    'brand-consistency': 'brand-consistency', 'content-clarity': 'content-clarity',
    'state-coverage': 'state-coverage', performance: 'experience-performance',
    runtime: 'experience-evidence'
  };
  for (const failure of experience.failures ?? []) add(categories[failure.lane] ?? 'product-experience', `Product experience ${failure.lane} failed: ${failure.reason}`);
  if (experience.status === 'FAIL' && (experience.failures?.length ?? 0) === 0) add('product-experience', 'Product experience evidence did not reach a clean passing result');
  return defects;
}

function parseSuiteReport(value) {
  const counts = { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, interrupted: 0 };
  const visitSuite = (suite) => {
    for (const spec of suite?.specs ?? []) for (const item of spec.tests ?? []) {
      counts.total += 1;
      const results = item.results ?? [];
      const last = results.at(-1);
      const statuses = results.map((result) => result.status);
      if (last?.status === 'passed') {
        if (statuses.slice(0, -1).some((status) => status !== 'passed' && status !== 'skipped')) counts.flaky += 1;
        else counts.passed += 1;
      } else if (last?.status === 'skipped' || results.length === 0) counts.skipped += 1;
      else if (last?.status === 'interrupted' || last?.status === 'timedOut') counts.interrupted += 1;
      else counts.failed += 1;
    }
    for (const child of suite?.suites ?? []) visitSuite(child);
  };
  for (const suite of value?.suites ?? []) visitSuite(suite);
  return counts;
}

function suiteArgs(plan, cliPath, runDirectory) {
  const pw = plan.playwright;
  const args = [cliPath, 'test', ...pw.testPaths, '--config', pw.configPath, '--workers', String(pw.workers), '--retries', String(pw.retries), '--timeout', String(pw.testTimeoutMs), '--global-timeout', String(pw.globalTimeoutMs), '--trace', 'retain-on-failure-and-retries', '--reporter', 'json', '--output', path.join(runDirectory, 'test-results'), '--forbid-only', '--fail-on-flaky-tests', '--update-snapshots', 'none'];
  for (const project of pw.projects) args.push('--project', project);
  return args;
}

function runSuite(root, plan, resolved, binding, runDirectory, experienceContext = null) {
  const reportPath = path.join(runDirectory, 'playwright-results.json');
  const environment = { ...process.env,
    CI: '1', KSTACK_POST_DEPLOY_BASE_URL: binding.baseUrl,
    KSTACK_POST_DEPLOY_RELEASE_ID: binding.releaseId, KSTACK_POST_DEPLOY_DEPLOYMENT_ID: binding.deploymentId,
    KSTACK_POST_DEPLOY_COMMIT_SHA: binding.commitSha, KSTACK_POST_DEPLOY_ARTIFACT_SHA256: binding.artifactSha256,
    PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath, PLAYWRIGHT_HTML_OPEN: 'never'
  };
  if (experienceContext) {
    environment.KSTACK_EXPERIENCE_RESULT_PATH = experienceContext.resultPath;
    environment.KSTACK_EXPERIENCE_CONTRACT_PATH = experienceContext.contractPath;
    environment.KSTACK_EXPERIENCE_CONTRACT_SHA256 = experienceContext.contractSha256;
  }
  for (const name of ['NODE_OPTIONS', 'NODE_PATH', 'PWDEBUG']) delete environment[name];
  const started = Date.now();
  const result = spawnSync(process.execPath, suiteArgs(plan, resolved.cliPath, runDirectory), {
    cwd: root, env: environment, encoding: 'utf8', shell: false, windowsHide: true,
    timeout: plan.playwright.globalTimeoutMs + 10_000, maxBuffer: MAX_REPORT_BYTES, killSignal: 'SIGKILL'
  });
  let raw = null; let parsed = null; let counts = { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, interrupted: 0 };
  try {
    raw = safeRead(reportPath, MAX_REPORT_BYTES, 'KSTACK_POST_DEPLOY_REPORT_INVALID');
    parsed = JSON.parse(raw.toString('utf8'));
    counts = parseSuiteReport(parsed);
  } catch {}
  const reportSha256 = raw ? sha256(raw) : null;
  try { fs.unlinkSync(reportPath); } catch {}
  const timedOut = result.error?.code === 'ETIMEDOUT';
  const passed = !timedOut && result.status === 0 && parsed && counts.total > 0 && counts.failed === 0 && counts.flaky === 0 && counts.interrupted === 0 && (plan.playwright.allowSkipped || counts.skipped === 0);
  const stdout = sanitize(String(result.stdout ?? '')).slice(0, MAX_OUTPUT_BYTES);
  const stderr = sanitize(String(result.stderr ?? result.error?.message ?? '')).slice(0, MAX_OUTPUT_BYTES);
  fs.writeFileSync(path.join(runDirectory, 'suite-stdout.txt'), stdout, { mode: 0o600 });
  fs.writeFileSync(path.join(runDirectory, 'suite-stderr.txt'), stderr, { mode: 0o600 });
  return { status: passed ? 'PASS' : 'FAIL', exitCode: result.status, signal: result.signal ?? null, timedOut, durationMs: Date.now() - started, counts, reportSha256 };
}

function artifactManifest(directory) {
  const entries = []; const totals = { files: 0, bytes: 0, nodes: 0 };
  const walk = (current, relative = '', depth = 0) => {
    totals.nodes += 1;
    if (totals.nodes > MAX_ARTIFACT_NODES || depth > MAX_ARTIFACT_DEPTH) fail('KSTACK_POST_DEPLOY_ARTIFACT_BUDGET_EXCEEDED');
    for (const name of fs.readdirSync(current).sort(byteSort)) {
      const childRelative = relative ? path.posix.join(relative, name) : name;
      if (childRelative === 'receipt.json') continue;
      const absolute = path.join(current, name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) fail('KSTACK_POST_DEPLOY_ARTIFACT_SYMLINK');
      if (stat.isDirectory()) walk(absolute, childRelative, depth + 1);
      else if (stat.isFile()) {
        totals.files += 1; totals.bytes += stat.size;
        if (totals.files > MAX_ARTIFACT_FILES || totals.bytes > MAX_ARTIFACT_BYTES) fail('KSTACK_POST_DEPLOY_ARTIFACT_BUDGET_EXCEEDED');
        const bytes = safeRead(absolute, MAX_ARTIFACT_BYTES, 'KSTACK_POST_DEPLOY_ARTIFACT_READ_INVALID');
        entries.push({ path: childRelative, size: bytes.length, sha256: sha256(bytes) });
      } else fail('KSTACK_POST_DEPLOY_ARTIFACT_TYPE_INVALID');
    }
  };
  walk(directory);
  return { count: entries.length, digest: sha256(canonicalBytes(entries)) };
}

function trackingInput(binding, values) {
  return {
    repositoryNamespace: binding.repositoryNamespace,
    projectKey: binding.projectKey,
    threadId: values.threadId,
    itemId: values.itemId,
    sourceEventId: values.sourceEventId,
    kind: values.kind,
    localState: values.localState,
    occurredAt: values.occurredAt,
    summary: values.summary,
    evidence: values.evidence,
    review: values.review ?? null,
    release: values.release ?? null
  };
}

function jiraProjectionComplete(sync, eventIds) {
  if (sync.mode !== 'automatic') return false;
  const projected = new Set(sync.projected.map((item) => item.eventId));
  return eventIds.every((eventId) => projected.has(eventId));
}

export async function recordPostDeployOutcome(options) {
  const jiraState = await loadJiraState({ configPath: options.configPath, command: 'post-deploy-handoff' });
  const tracking = jiraState.jira.tracking || { mode: 'off', required: false };
  if (tracking.mode === 'off') fail('KSTACK_POST_DEPLOY_JIRA_TRACKING_DISABLED');
  const binding = { repositoryNamespace: tracking.repositoryNamespace, projectKey: tracking.projectKey };
  const state = { repoRoot: jiraState.repoRoot, jira: jiraState.jira, config: jiraState.config, clock: jiraState.clock };
  const existing = await listTrackingEvents(state);
  const sameItem = existing.filter((event) => event.threadId === options.threadId && event.itemId === options.itemId);
  const occurredAt = options.receipt.completedAt;
  const evidence = [{ repoRelativePath: path.relative(jiraState.repoRoot, options.receiptPath).replace(/\\/gu, '/'), sha256: options.receiptFileSha256, evidenceKind: 'post-deploy-receipt' }];
  const appended = [];
  const releaseEventKey = sha256(canonicalBytes(options.receipt.release)).slice(0, 16);
  const append = async (values) => {
    const result = await appendTrackingEvent(state, trackingInput(binding, { ...values, occurredAt, evidence }));
    appended.push(result.event.eventId);
  };
  if (sameItem.length === 0) await append({
    threadId: options.threadId, itemId: options.itemId,
    sourceEventId: `postdeploy:${releaseEventKey}:parent-created`, kind: 'ITEM_CREATED', localState: 'planned',
    summary: `Release validation for ${options.receipt.release.releaseId}`
  });
  if (options.receipt.status === 'HEALTHY') {
    const validationLabel = options.receipt.experience ? 'Playwright and product-experience' : 'Playwright';
    await append({
      threadId: options.threadId, itemId: options.itemId,
      sourceEventId: `postdeploy:${releaseEventKey}:qc`, kind: 'QC_VALIDATED', localState: 'active',
      summary: `${validationLabel} post-deploy validation passed for ${options.receipt.release.releaseId}`,
      review: { decision: 'pass', confidence: 100, failed: 0, security: 0, dissent: 0, questions: 0 }
    });
    await append({
      threadId: options.threadId, itemId: options.itemId,
      sourceEventId: `postdeploy:${releaseEventKey}:done`, kind: 'ITEM_DONE', localState: 'done',
      summary: `Automated ${validationLabel.toLowerCase()} release validation completed for ${options.receipt.release.releaseId}`
    });
    await append({
      threadId: options.threadId, itemId: options.itemId,
      sourceEventId: `postdeploy:${releaseEventKey}:released`, kind: 'ITEM_RELEASED', localState: 'done',
      summary: `Release ${options.receipt.release.releaseId} deployed and ${options.receipt.experience ? 'browser/experience-validated' : 'browser-validated'}; user validation remains`,
      release: { name: options.receipt.release.releaseId, releaseDate: occurredAt.slice(0, 10), receiptSha256: options.receipt.receiptSha256 }
    });
  } else {
    await append({
      threadId: options.threadId, itemId: options.itemId,
      sourceEventId: `postdeploy:${releaseEventKey}:failed`, kind: 'BUG_FOUND', localState: 'blocked',
      summary: `Post-deploy validation blocked ${options.receipt.release.releaseId}; follow-up work created`
    });
    for (const defect of options.receipt.defects) {
      const defectItemId = `postdeploy-defect-${defect.category}-${defect.fingerprint}`;
      await append({
        threadId: options.threadId, itemId: defectItemId,
        sourceEventId: `postdeploy:${releaseEventKey}:defect:${defect.fingerprint}`, kind: 'ITEM_CREATED', localState: 'planned',
        summary: `${defect.summary} [parent ${options.itemId}]`
      });
    }
  }
  const sync = await syncTrackingEvents(state, jiraState);
  return {
    mode: sync.mode,
    eventCount: appended.length,
    draftCount: sync.drafts.length,
    projectedCount: sync.projected.length,
    statusCount: sync.statuses.length,
    versionCount: sync.versions.length,
    projectionComplete: jiraProjectionComplete(sync, appended)
  };
}

export async function runPostDeploy(options) {
  const loaded = readPlan(options.projectRoot, options.planPath);
  const binding = {
    baseUrl: options.baseUrl, releaseId: options.releaseId, deploymentId: options.deploymentId,
    commitSha: options.commitSha, artifactSha256: options.artifactSha256
  };
  if (!ID.test(binding.releaseId ?? '') || !ID.test(binding.deploymentId ?? '') || !GIT_OID.test(binding.commitSha ?? '') || !HEX64.test(binding.artifactSha256 ?? '')) fail('KSTACK_POST_DEPLOY_BINDING_INVALID');
  const base = parseBaseUrl(binding.baseUrl, loaded.plan.environment);
  if (!loaded.plan.allowedOrigins.includes(base.origin)) fail('KSTACK_POST_DEPLOY_BASE_URL_NOT_ALLOWED');
  const sources = sourceManifest(loaded.root, loaded.plan);
  let experienceLoaded = null;
  let experienceSources = null;
  if (loaded.plan.experience?.required) {
    experienceLoaded = readExperienceContract(loaded.root, loaded.plan.experience.contractPath);
    experienceSources = experienceSourceManifest(loaded.root, experienceLoaded.contract);
  }
  const resolved = resolvePlaywright(loaded.root);
  const evidenceRoot = path.join(loaded.root, '.kstack', 'post-deploy-evidence');
  ensurePrivateDirectory(evidenceRoot, loaded.root);
  const runId = `${new Date().toISOString().replace(/[-:.TZ]/gu, '')}-${crypto.randomBytes(8).toString('hex')}`;
  const runDirectory = path.join(evidenceRoot, runId);
  fs.mkdirSync(runDirectory, { mode: 0o700 });
  const startedAt = new Date().toISOString();
  const canary = independentCanary(loaded.root, resolved, loaded.plan.playwright.canaryBrowser, binding.baseUrl, { ...loaded.plan.playwright, allowedOrigins: loaded.plan.allowedOrigins }, runDirectory);
  const experienceResultPath = path.join(runDirectory, 'experience-result.json');
  const experienceContext = experienceLoaded ? {
    resultPath: experienceResultPath,
    contractPath: experienceLoaded.absolute,
    contractSha256: experienceLoaded.digest
  } : null;
  const suite = canary.status === 'PASS' ? runSuite(loaded.root, loaded.plan, resolved, binding, runDirectory, experienceContext) : { status: 'NOT_RUN_CANARY_FAILED', exitCode: null, signal: null, timedOut: false, durationMs: 0, counts: { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, interrupted: 0 }, reportSha256: null };
  let experience = { status: 'NOT_REQUIRED', failures: [] };
  if (experienceLoaded && suite.status !== 'PASS') experience = { status: 'NOT_RUN_SUITE_FAILED', failures: [{ lane: 'runtime', reason: 'suite-not-passing' }], contractSha256: experienceLoaded.digest, sourceManifest: experienceSources, resultSha256: null, screenshotManifestSha256: null };
  else if (experienceLoaded) {
    try {
      const after = readExperienceContract(loaded.root, loaded.plan.experience.contractPath);
      const afterSources = experienceSourceManifest(loaded.root, after.contract);
      if (after.digest !== experienceLoaded.digest || afterSources.digest !== experienceSources.digest
          || afterSources.files !== experienceSources.files || afterSources.bytes !== experienceSources.bytes) fail('KSTACK_EXPERIENCE_SOURCE_DRIFT');
      const relativeResult = path.relative(loaded.root, experienceResultPath).replace(/\\/gu, '/');
      const checked = readExperienceResult(loaded.root, relativeResult, experienceLoaded.contract, {
        contractSha256: experienceLoaded.digest, releaseId: binding.releaseId, deploymentId: binding.deploymentId,
        commitSha: binding.commitSha, artifactSha256: binding.artifactSha256
      });
      experience = { ...checked.result, sourceManifest: experienceSources, resultSha256: checked.digest };
    } catch (error) {
      experience = { status: 'FAIL', failures: [{ lane: 'runtime', reason: error.code ?? 'experience-result-invalid' }], contractSha256: experienceLoaded.digest, sourceManifest: experienceSources, resultSha256: null, screenshotManifestSha256: null };
    }
  }
  const defects = derivePostDeployDefects(canary, suite, loaded.plan.handoff, experience);
  const experiencePassed = !experienceLoaded || experience.status === 'PASS';
  const status = canary.status === 'PASS' && suite.status === 'PASS' && experiencePassed && defects.length === 0 ? 'HEALTHY' : 'FAILED';
  const artifacts = artifactManifest(runDirectory);
  const isV2 = Boolean(experienceLoaded);
  const receipt = {
    schemaVersion: isV2 ? RECEIPT_SCHEMA_V2 : RECEIPT_SCHEMA, runId, status, startedAt, completedAt: new Date().toISOString(),
    planId: loaded.plan.planId, planSha256: loaded.digest, environment: loaded.plan.environment,
    target: { origin: base.origin, basePathSha256: sha256(Buffer.from(base.pathname, 'utf8')) },
    release: { releaseId: binding.releaseId, deploymentId: binding.deploymentId, commitSha: binding.commitSha, artifactSha256: binding.artifactSha256 },
    playwright: { version: resolved.version, sourceManifest: sources, canary, suite },
    ...(isV2 ? { experience } : {}),
    defects, artifacts
  };
  const receiptSha256 = sha256(canonicalBytes(receipt));
  const complete = { ...receipt, receiptSha256 };
  const receiptPath = path.join(runDirectory, 'receipt.json');
  const receiptBytes = canonicalBytes(complete);
  fs.writeFileSync(receiptPath, receiptBytes, { mode: 0o600, flag: 'wx' });
  process.stdout.write(`${isV2 ? OUTPUT_PREFIX_V2 : OUTPUT_PREFIX}${canonical(complete)}\n`);
  let jira = null;
  let trackingError = null;
  if (options.jira || loaded.plan.handoff.jiraRequired) {
    if (!options.jira) trackingError = 'KSTACK_POST_DEPLOY_JIRA_BINDING_REQUIRED';
    else {
      try {
        jira = await (options.recordTracking ?? recordPostDeployOutcome)({
          ...options.jira, receipt: complete, receiptPath, receiptFileSha256: sha256(receiptBytes)
        });
      } catch (error) { trackingError = error.code ?? 'KSTACK_POST_DEPLOY_JIRA_FAILED'; }
    }
  }
  const ready = status === 'HEALTHY' && (!loaded.plan.handoff.jiraRequired || (jira?.projectionComplete === true && !trackingError));
  const experienceReviewPending = experience.status === 'FAIL' && experience.failures.length === 1
    && experience.failures[0].lane === 'visual-review' && experience.failures[0].reason === 'review-not-approved';
  const handoff = {
    schemaVersion: isV2 ? HANDOFF_SCHEMA_V2 : HANDOFF_SCHEMA,
    runId,
    browserReceiptSha256: complete.receiptSha256,
    status: ready ? 'READY_FOR_USER_VALIDATION' : status === 'HEALTHY' ? 'JIRA_TRACKING_PENDING'
      : isV2 ? (experienceReviewPending ? 'EXPERIENCE_REVIEW_REQUIRED' : 'EXPERIENCE_REMEDIATION_REQUIRED') : 'REMEDIATION_REQUIRED',
    jiraRequired: loaded.plan.handoff.jiraRequired,
    ...(isV2 ? { experienceStatus: experience.status } : {}),
    jira,
    trackingError
  };
  const handoffComplete = { ...handoff, handoffSha256: sha256(canonicalBytes(handoff)) };
  const handoffPath = path.join(runDirectory, 'handoff.json');
  fs.writeFileSync(handoffPath, canonicalBytes(handoffComplete), { mode: 0o600, flag: 'wx' });
  process.stdout.write(`${isV2 ? HANDOFF_PREFIX_V2 : HANDOFF_PREFIX}${canonical(handoffComplete)}\n`);
  return { receipt: complete, path: receiptPath, handoff: handoffComplete, handoffPath };
}

export function parseArgs(argv) {
  const command = argv[0];
  const values = {};
  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index]; const next = argv[index + 1];
    if (!key.startsWith('--') || next === undefined) fail('KSTACK_POST_DEPLOY_USAGE');
    const name = key.slice(2);
    if (Object.prototype.hasOwnProperty.call(values, name)) fail('KSTACK_POST_DEPLOY_USAGE');
    values[name] = next; index += 1;
  }
  const baseRun = ['artifact-sha256', 'base-url', 'commit-sha', 'deployment-id', 'plan', 'project-root', 'release-id'];
  const jiraRun = [...baseRun, 'item-id', 'jira-config', 'thread-id'];
  const expectedSets = command === 'validate-plan'
    ? [['plan', 'project-root']]
    : command === 'run'
      ? [baseRun, jiraRun]
      : [];
  const actual = Object.keys(values).sort(byteSort);
  if (expectedSets.length === 0 || !expectedSets.some((expected) => actual.join('\0') === expected.sort(byteSort).join('\0'))) fail('KSTACK_POST_DEPLOY_USAGE');
  return { command, values };
}

async function main() {
  try {
    const { command, values } = parseArgs(process.argv.slice(2));
    if (command === 'validate-plan') {
      const loaded = readPlan(values['project-root'] ?? '.', values.plan);
      sourceManifest(loaded.root, loaded.plan);
      if (loaded.plan.experience?.required) {
        const experience = readExperienceContract(loaded.root, loaded.plan.experience.contractPath);
        experienceSourceManifest(loaded.root, experience.contract);
      }
      process.stdout.write(`KSTACK_POST_DEPLOY_PLAN_VALID_${loaded.plan.experience ? 'V2' : 'V1'} ${loaded.digest}\n`);
      return;
    }
    if (command !== 'run') fail('KSTACK_POST_DEPLOY_USAGE');
    const jira = values['jira-config'] ? { configPath: values['jira-config'], threadId: values['thread-id'], itemId: values['item-id'] } : null;
    const result = await runPostDeploy({ projectRoot: values['project-root'] ?? '.', planPath: values.plan, baseUrl: values['base-url'], releaseId: values['release-id'], deploymentId: values['deployment-id'], commitSha: values['commit-sha'], artifactSha256: values['artifact-sha256'], jira });
    if (result.handoff.status !== 'READY_FOR_USER_VALIDATION') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error.code ?? 'KSTACK_POST_DEPLOY_FAILED'}${error.detail ? `:${sanitize(String(error.detail))}` : ''}\n`);
    process.exitCode = error.code?.includes('UNAVAILABLE') || error.code?.includes('USAGE') || error.code?.includes('INVALID') ? 2 : 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
