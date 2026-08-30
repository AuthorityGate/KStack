#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertOutboundSecretScan } from './kstack-safety-matchers.mjs';

export const CONTRACT_SCHEMA = 'kstack-product-experience-v1';
export const RESULT_SCHEMA = 'kstack-experience-runtime-result-v2';
export const EVIDENCE_SCHEMA = 'kstack-experience-evidence-manifest-v1';
export const PERFORMANCE_EVIDENCE_SCHEMA = 'kstack-performance-measurement-v1';
export const REQUIRED_LANES = Object.freeze([
  'critical-journey', 'accessibility', 'responsive', 'visual-regression',
  'brand-consistency', 'content-clarity', 'state-coverage', 'performance'
]);

const MAX_DOCUMENT_BYTES = 256 * 1024;
const MAX_SOURCE_FILES = 4_096;
const MAX_SOURCE_BYTES = 64 * 1024 * 1024;
const MAX_SOURCE_NODES = 8_192;
const MAX_SOURCE_DEPTH = 32;
const HEX64 = /^[0-9a-f]{64}$/u;
const GIT_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const RELEASE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const CONTRACT_KEYS = new Set(['schemaVersion', 'surface', 'adoption', 'product', 'system', 'journeys', 'validation']);
const ADOPTION_KEYS = new Set(['mode', 'decisionId', 'ownerConfirmed']);
const PRODUCT_KEYS = new Set(['name', 'promise', 'primaryUsers', 'jobs', 'brandTraits', 'antiTraits', 'voicePrinciples', 'informationArchitecturePrinciples']);
const SYSTEM_KEYS = new Set(['tokenFormat', 'tokensPath', 'componentRoots', 'assetRoots', 'exceptions']);
const EXCEPTION_KEYS = new Set(['id', 'scope', 'reason', 'owner', 'removalCondition']);
const JOURNEY_KEYS = new Set(['id', 'name', 'priority', 'testPath', 'requiredStates', 'successOutcome', 'alternatives', 'selectedAlternative', 'selectionRationale', 'hierarchy', 'interactionModel', 'recoveryBehavior']);
const VALIDATION_KEYS = new Set(['accessibilityTarget', 'requiredLanes', 'minimumCasesByLane', 'viewports', 'locales', 'zoomPercents', 'visualReview', 'performance']);
const VIEWPORT_KEYS = new Set(['id', 'width', 'height', 'inputModes', 'touch', 'colorScheme']);
const VISUAL_KEYS = new Set(['required', 'syntheticDataOnly', 'minimumConfidence', 'baselineApprovalId', 'baselineRoots']);
const PERFORMANCE_KEYS = new Set(['maxLcpMs', 'maxInpMs', 'maxClsMilli', 'fieldEvidenceRequired']);
const RESULT_KEYS = new Set(['schemaVersion', 'contractSha256', 'release', 'evidenceManifestPath', 'evidenceManifestSha256', 'lanes', 'metrics', 'visualReview']);
const RELEASE_KEYS = new Set(['releaseId', 'deploymentId', 'commitSha', 'artifactSha256']);
const LANE_KEYS = new Set(['lane', 'cases', 'failed', 'findings', 'evidenceSha256']);
const METRIC_KEYS = new Set(['evidenceKind', 'lcpMs', 'inpMs', 'clsMilli']);
const REVIEW_KEYS = new Set(['status', 'confidence', 'failed', 'security', 'dissent', 'questions', 'screenshotManifestSha256']);
const EVIDENCE_KEYS = new Set(['schemaVersion', 'contractSha256', 'release', 'cases', 'manualAccessibilityStatus', 'visualDisclosure', 'performanceEvidence']);
const CASE_KEYS = new Set(['caseId', 'lane', 'journeyId', 'state', 'viewportId', 'locale', 'zoomPercent', 'checkType', 'outcome', 'evidencePath', 'evidenceSha256']);
const DISCLOSURE_KEYS = new Set(['classification', 'authorizationReceiptPath', 'authorizationReceiptSha256']);
const PERFORMANCE_EVIDENCE_KEYS = new Set(['journeyId', 'evidenceKind', 'environment', 'sampleSize', 'windowStart', 'windowEnd', 'evidencePath', 'evidenceSha256', 'lcpMs', 'inpMs', 'clsMilli']);
const PERFORMANCE_RAW_KEYS = new Set(['schemaVersion', 'journeyId', 'evidenceKind', 'environment', 'sampleSize', 'windowStart', 'windowEnd', 'lcpMs', 'inpMs', 'clsMilli']);
const ACCESSIBILITY_CHECKS = Object.freeze(['axe', 'keyboard', 'focus', 'aria', 'contrast', 'reflow']);
const STATES = new Set(['loading', 'empty', 'success', 'validation-error', 'permission-denied', 'system-error', 'retry', 'offline', 'degraded', 'destructive-confirmation']);
const INPUT_MODES = new Set(['keyboard', 'mouse', 'touch', 'stylus', 'screen-reader']);

function byteSort(left, right) { return Buffer.compare(Buffer.from(left), Buffer.from(right)); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function fail(code, detail = null) { const error = new Error(code); error.code = code; error.detail = detail; throw error; }
function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === expected.size
    && Object.keys(value).every((key) => expected.has(key));
}
function boundedText(value, minimum = 1, maximum = 512) {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
}
function uniqueTextArray(value, minimum, maximum, itemMaximum = 160) {
  return Array.isArray(value) && value.length >= minimum && value.length <= maximum
    && value.every((item) => boundedText(item, 1, itemMaximum)) && new Set(value).size === value.length;
}
function safeRelative(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
    && !path.isAbsolute(value) && !value.includes('\\') && path.posix.normalize(value) === value
    && value !== '.' && !value.startsWith('../') && !value.split('/').some((part) => part === '' || part === '.' || part === '..');
}
function safeInteger(value, minimum, maximum) { return Number.isSafeInteger(value) && value >= minimum && value <= maximum; }
function isoInstant(value) {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}
function secretScan(value) {
  try { assertOutboundSecretScan(Buffer.from(JSON.stringify(value), 'utf8')); }
  catch { fail('KSTACK_EXPERIENCE_SECRET_MATERIAL_REJECTED'); }
}
function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string' || Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!value || typeof value !== 'object') fail('KSTACK_EXPERIENCE_CANONICAL_JSON_INVALID');
  return `{${Object.keys(value).sort(byteSort).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function canonicalBytes(value) { return Buffer.from(`${canonical(value)}\n`, 'utf8'); }
function caseEvidenceProjection(item) {
  return Object.freeze({
    caseId: item.caseId, lane: item.lane, journeyId: item.journeyId, state: item.state,
    viewportId: item.viewportId, locale: item.locale, zoomPercent: item.zoomPercent,
    checkType: item.checkType, outcome: item.outcome, evidencePath: item.evidencePath,
    evidenceSha256: item.evidenceSha256
  });
}
function projectedCases(cases, lane = null) {
  return cases.filter((item) => lane === null || item.lane === lane)
    .map(caseEvidenceProjection).sort((left, right) => byteSort(left.caseId, right.caseId));
}
function performanceEvidenceProjection(value) {
  return Object.freeze({
    schemaVersion: PERFORMANCE_EVIDENCE_SCHEMA, journeyId: value.journeyId,
    evidenceKind: value.evidenceKind, environment: value.environment, sampleSize: value.sampleSize,
    windowStart: value.windowStart, windowEnd: value.windowEnd,
    lcpMs: value.lcpMs, inpMs: value.inpMs, clsMilli: value.clsMilli
  });
}

export function validateDtcgTokenDocument(value) {
  let nodes = 0; let tokens = 0;
  const visit = (node, depth) => {
    nodes += 1;
    if (nodes > 10_000 || depth > 64 || !node || typeof node !== 'object' || Array.isArray(node)) fail('KSTACK_EXPERIENCE_DTCG_INVALID');
    const keys = Object.keys(node);
    const token = Object.hasOwn(node, '$value');
    if (token) {
      tokens += 1;
      if (keys.some((key) => !key.startsWith('$')) || (Object.hasOwn(node, '$type') && !boundedText(node.$type, 1, 80))) fail('KSTACK_EXPERIENCE_DTCG_INVALID');
      if (node.$value === undefined) fail('KSTACK_EXPERIENCE_DTCG_INVALID');
      return;
    }
    for (const key of keys) {
      if (key.startsWith('$')) {
        if (!['$type', '$description', '$extends', '$root'].includes(key)) fail('KSTACK_EXPERIENCE_DTCG_INVALID');
        if (key === '$root') visit(node[key], depth + 1);
        continue;
      }
      if (!boundedText(key, 1, 160)) fail('KSTACK_EXPERIENCE_DTCG_INVALID');
      visit(node[key], depth + 1);
    }
  };
  visit(value, 0);
  if (tokens === 0) fail('KSTACK_EXPERIENCE_DTCG_INVALID');
  return Object.freeze({ tokens, nodes });
}

function safeRead(file, maximum, code) {
  const before = fs.lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink() || before.size > maximum) fail(code);
  const handle = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fs.fstatSync(handle);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) fail(code);
    const bytes = Buffer.alloc(opened.size); let offset = 0;
    while (offset < bytes.length) { const count = fs.readSync(handle, bytes, offset, bytes.length - offset, offset); if (count === 0) fail(code); offset += count; }
    const after = fs.fstatSync(handle);
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs) fail(code);
    return bytes;
  } finally { fs.closeSync(handle); }
}

function containedPath(root, relative, code) {
  if (!safeRelative(relative)) fail(code);
  const absolute = path.join(root, relative);
  const relation = path.relative(root, absolute);
  if (!relation || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) fail(code);
  let current = root;
  for (const component of relation.split(path.sep)) {
    current = path.join(current, component);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) fail(code);
  }
  const real = fs.realpathSync(absolute);
  const realRelation = path.relative(root, real);
  if (!realRelation || realRelation.startsWith(`..${path.sep}`) || path.isAbsolute(realRelation)) fail(code);
  return absolute;
}

export function validateExperienceContract(contract) {
  if (!exactKeys(contract, CONTRACT_KEYS) || contract.schemaVersion !== CONTRACT_SCHEMA || contract.surface !== 'user-facing') fail('KSTACK_EXPERIENCE_CONTRACT_INVALID');
  if (!exactKeys(contract.adoption, ADOPTION_KEYS) || !['adopt-existing', 'create-shared'].includes(contract.adoption.mode)
      || !ID.test(contract.adoption.decisionId ?? '') || contract.adoption.ownerConfirmed !== true) fail('KSTACK_EXPERIENCE_ADOPTION_INVALID');
  if (!exactKeys(contract.product, PRODUCT_KEYS)) fail('KSTACK_EXPERIENCE_PRODUCT_INVALID');
  const product = contract.product;
  if (!boundedText(product.name, 1, 120) || !boundedText(product.promise, 1, 500)) fail('KSTACK_EXPERIENCE_PRODUCT_INVALID');
  if (!uniqueTextArray(product.primaryUsers, 1, 12) || !uniqueTextArray(product.jobs, 1, 24, 240)) fail('KSTACK_EXPERIENCE_PRODUCT_INVALID');
  if (!uniqueTextArray(product.brandTraits, 3, 7, 80) || !uniqueTextArray(product.antiTraits, 1, 7, 80) || !uniqueTextArray(product.voicePrinciples, 1, 12, 200)
      || !uniqueTextArray(product.informationArchitecturePrinciples, 1, 12, 200)) fail('KSTACK_EXPERIENCE_BRAND_INVALID');

  if (!exactKeys(contract.system, SYSTEM_KEYS) || !['dtcg-2025.10', 'project-native'].includes(contract.system.tokenFormat)) fail('KSTACK_EXPERIENCE_SYSTEM_INVALID');
  if (!safeRelative(contract.system.tokensPath) || !uniqueTextArray(contract.system.componentRoots, 1, 24, 512) || !contract.system.componentRoots.every(safeRelative)
      || !Array.isArray(contract.system.assetRoots) || contract.system.assetRoots.length > 24 || !contract.system.assetRoots.every(safeRelative) || new Set(contract.system.assetRoots).size !== contract.system.assetRoots.length) fail('KSTACK_EXPERIENCE_SYSTEM_INVALID');
  if (!Array.isArray(contract.system.exceptions) || contract.system.exceptions.length > 64) fail('KSTACK_EXPERIENCE_SYSTEM_INVALID');
  const exceptionIds = new Set();
  for (const item of contract.system.exceptions) {
    if (!exactKeys(item, EXCEPTION_KEYS) || !ID.test(item.id ?? '') || exceptionIds.has(item.id) || !boundedText(item.scope, 1, 240)
        || !boundedText(item.reason, 1, 500) || !boundedText(item.owner, 1, 120) || !boundedText(item.removalCondition, 1, 500)) fail('KSTACK_EXPERIENCE_SYSTEM_INVALID');
    exceptionIds.add(item.id);
  }

  if (!Array.isArray(contract.journeys) || contract.journeys.length < 1 || contract.journeys.length > 48) fail('KSTACK_EXPERIENCE_JOURNEYS_INVALID');
  const journeyIds = new Set();
  for (const journey of contract.journeys) {
    if (!exactKeys(journey, JOURNEY_KEYS) || !ID.test(journey.id ?? '') || journeyIds.has(journey.id) || !boundedText(journey.name, 1, 160)
        || !['critical', 'important'].includes(journey.priority) || !safeRelative(journey.testPath) || !boundedText(journey.successOutcome, 1, 300)
        || !uniqueTextArray(journey.alternatives, 2, 8, 300)
        || !boundedText(journey.selectedAlternative, 1, 300) || !journey.alternatives.includes(journey.selectedAlternative)
        || !boundedText(journey.selectionRationale, 1, 800) || !boundedText(journey.hierarchy, 1, 500)
        || !boundedText(journey.interactionModel, 1, 500) || !boundedText(journey.recoveryBehavior, 1, 500)
        || !Array.isArray(journey.requiredStates) || journey.requiredStates.length < 1 || journey.requiredStates.length > STATES.size
        || !journey.requiredStates.every((state) => STATES.has(state)) || new Set(journey.requiredStates).size !== journey.requiredStates.length) fail('KSTACK_EXPERIENCE_JOURNEYS_INVALID');
    journeyIds.add(journey.id);
  }
  if (!contract.journeys.some((journey) => journey.priority === 'critical')) fail('KSTACK_EXPERIENCE_JOURNEYS_INVALID');

  const validation = contract.validation;
  if (!exactKeys(validation, VALIDATION_KEYS) || validation.accessibilityTarget !== 'wcag-2.2-aa') fail('KSTACK_EXPERIENCE_VALIDATION_INVALID');
  if (!Array.isArray(validation.requiredLanes) || validation.requiredLanes.length !== REQUIRED_LANES.length
      || REQUIRED_LANES.some((lane) => !validation.requiredLanes.includes(lane)) || new Set(validation.requiredLanes).size !== validation.requiredLanes.length) fail('KSTACK_EXPERIENCE_LANES_INVALID');
  if (!validation.minimumCasesByLane || typeof validation.minimumCasesByLane !== 'object' || Array.isArray(validation.minimumCasesByLane)
      || Object.keys(validation.minimumCasesByLane).length !== REQUIRED_LANES.length
      || REQUIRED_LANES.some((lane) => !safeInteger(validation.minimumCasesByLane[lane], 1, 10_000))) fail('KSTACK_EXPERIENCE_LANE_MINIMUMS_INVALID');
  if (!Array.isArray(validation.viewports) || validation.viewports.length < 2 || validation.viewports.length > 16) fail('KSTACK_EXPERIENCE_VIEWPORTS_INVALID');
  const viewportIds = new Set();
  for (const viewport of validation.viewports) {
    if (!exactKeys(viewport, VIEWPORT_KEYS) || !ID.test(viewport.id ?? '') || viewportIds.has(viewport.id)
        || !safeInteger(viewport.width, 240, 7680) || !safeInteger(viewport.height, 240, 4320)
        || !uniqueTextArray(viewport.inputModes, 1, INPUT_MODES.size, 20) || !viewport.inputModes.every((mode) => INPUT_MODES.has(mode))
        || typeof viewport.touch !== 'boolean' || viewport.touch !== viewport.inputModes.includes('touch')
        || !['light', 'dark'].includes(viewport.colorScheme)) fail('KSTACK_EXPERIENCE_VIEWPORTS_INVALID');
    viewportIds.add(viewport.id);
  }
  if (!validation.viewports.some((viewport) => viewport.inputModes.includes('keyboard'))
      || !validation.viewports.some((viewport) => viewport.inputModes.some((mode) => ['mouse', 'touch', 'stylus'].includes(mode)))) fail('KSTACK_EXPERIENCE_VIEWPORTS_INVALID');
  if (!uniqueTextArray(validation.locales, 1, 16, 35) || !validation.locales.every((locale) => /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u.test(locale))) fail('KSTACK_EXPERIENCE_LOCALES_INVALID');
  if (!Array.isArray(validation.zoomPercents) || validation.zoomPercents.length < 1 || validation.zoomPercents.length > 5 || !validation.zoomPercents.includes(100)
      || !validation.zoomPercents.every((zoom) => safeInteger(zoom, 100, 400)) || new Set(validation.zoomPercents).size !== validation.zoomPercents.length) fail('KSTACK_EXPERIENCE_ZOOM_INVALID');
  if (!exactKeys(validation.visualReview, VISUAL_KEYS) || validation.visualReview.required !== true || typeof validation.visualReview.syntheticDataOnly !== 'boolean'
      || !safeInteger(validation.visualReview.minimumConfidence, 93, 100) || !ID.test(validation.visualReview.baselineApprovalId ?? '')
      || !uniqueTextArray(validation.visualReview.baselineRoots, 1, 24, 512)
      || !validation.visualReview.baselineRoots.every(safeRelative)) fail('KSTACK_EXPERIENCE_VISUAL_POLICY_INVALID');
  if (!exactKeys(validation.performance, PERFORMANCE_KEYS) || !safeInteger(validation.performance.maxLcpMs, 100, 60_000)
      || !safeInteger(validation.performance.maxInpMs, 10, 10_000) || !safeInteger(validation.performance.maxClsMilli, 0, 1_000)
      || typeof validation.performance.fieldEvidenceRequired !== 'boolean') fail('KSTACK_EXPERIENCE_PERFORMANCE_POLICY_INVALID');
  secretScan(contract);
  return Object.freeze(contract);
}

export function readExperienceContract(projectRoot, contractPath) {
  const root = fs.realpathSync(projectRoot);
  const absolute = containedPath(root, contractPath, 'KSTACK_EXPERIENCE_CONTRACT_PATH_INVALID');
  const bytes = safeRead(absolute, MAX_DOCUMENT_BYTES, 'KSTACK_EXPERIENCE_CONTRACT_READ_INVALID');
  let value; try { value = JSON.parse(bytes.toString('utf8')); } catch { fail('KSTACK_EXPERIENCE_CONTRACT_JSON_INVALID'); }
  return { root, absolute, bytes, digest: sha256(bytes), contract: validateExperienceContract(value) };
}

function walkSource(root, relative, entries, totals, depth = 0) {
  totals.nodes += 1;
  if (totals.nodes > MAX_SOURCE_NODES || depth > MAX_SOURCE_DEPTH) fail('KSTACK_EXPERIENCE_SOURCE_BUDGET_EXCEEDED');
  const absolute = containedPath(root, relative, 'KSTACK_EXPERIENCE_SOURCE_PATH_INVALID');
  const stat = fs.lstatSync(absolute);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(absolute).sort(byteSort)) walkSource(root, path.posix.join(relative, name), entries, totals, depth + 1);
    return;
  }
  if (!stat.isFile()) fail('KSTACK_EXPERIENCE_SOURCE_TYPE_INVALID');
  totals.files += 1; totals.bytes += stat.size;
  if (totals.files > MAX_SOURCE_FILES || totals.bytes > MAX_SOURCE_BYTES) fail('KSTACK_EXPERIENCE_SOURCE_BUDGET_EXCEEDED');
  const bytes = safeRead(absolute, MAX_SOURCE_BYTES, 'KSTACK_EXPERIENCE_SOURCE_READ_INVALID');
  entries.push({ path: relative, size: bytes.length, sha256: sha256(bytes) });
}

export function experienceSourceManifest(projectRoot, contract) {
  const root = fs.realpathSync(projectRoot); const entries = []; const totals = { files: 0, bytes: 0, nodes: 0 };
  if (contract.system.tokenFormat === 'dtcg-2025.10') {
    const tokenFile = containedPath(root, contract.system.tokensPath, 'KSTACK_EXPERIENCE_SOURCE_PATH_INVALID');
    const bytes = safeRead(tokenFile, MAX_DOCUMENT_BYTES, 'KSTACK_EXPERIENCE_DTCG_INVALID');
    let value; try { value = JSON.parse(bytes.toString('utf8')); } catch { fail('KSTACK_EXPERIENCE_DTCG_INVALID'); }
    validateDtcgTokenDocument(value);
  }
  const sources = [contract.system.tokensPath, ...contract.system.componentRoots, ...contract.system.assetRoots,
    ...contract.validation.visualReview.baselineRoots, ...contract.journeys.map((journey) => journey.testPath)];
  for (const relative of [...new Set(sources)].sort(byteSort)) walkSource(root, relative, entries, totals);
  entries.sort((left, right) => byteSort(left.path, right.path));
  const unique = entries.filter((entry, index) => index === 0 || entry.path !== entries[index - 1].path);
  return Object.freeze({ files: unique.length, bytes: unique.reduce((sum, entry) => sum + entry.size, 0), digest: sha256(canonicalBytes(unique)) });
}

export function validateExperienceEvidenceManifest(manifest, contract, binding) {
  if (!exactKeys(manifest, EVIDENCE_KEYS) || manifest.schemaVersion !== EVIDENCE_SCHEMA || manifest.contractSha256 !== binding.contractSha256) fail('KSTACK_EXPERIENCE_EVIDENCE_INVALID');
  if (!exactKeys(manifest.release, RELEASE_KEYS) || manifest.release.releaseId !== binding.releaseId || manifest.release.deploymentId !== binding.deploymentId
      || manifest.release.commitSha !== binding.commitSha || manifest.release.artifactSha256 !== binding.artifactSha256) fail('KSTACK_EXPERIENCE_EVIDENCE_BINDING_MISMATCH');
  if (!Array.isArray(manifest.cases) || manifest.cases.length < REQUIRED_LANES.length || manifest.cases.length > 10_000) fail('KSTACK_EXPERIENCE_EVIDENCE_CASES_INVALID');
  if (!['PENDING_OWNER_ASSESSMENT', 'COMPLETE', 'NOT_REQUIRED'].includes(manifest.manualAccessibilityStatus)) fail('KSTACK_EXPERIENCE_EVIDENCE_MANUAL_STATUS_INVALID');
  if (!exactKeys(manifest.visualDisclosure, DISCLOSURE_KEYS) || !['synthetic', 'owner-authorized'].includes(manifest.visualDisclosure.classification)
      || (manifest.visualDisclosure.classification === 'synthetic'
        ? manifest.visualDisclosure.authorizationReceiptPath !== null || manifest.visualDisclosure.authorizationReceiptSha256 !== null
        : !safeRelative(manifest.visualDisclosure.authorizationReceiptPath) || !HEX64.test(manifest.visualDisclosure.authorizationReceiptSha256 ?? ''))
      || (contract.validation.visualReview.syntheticDataOnly && manifest.visualDisclosure.classification !== 'synthetic')) fail('KSTACK_EXPERIENCE_EVIDENCE_DISCLOSURE_INVALID');
  const journeyIds = new Set(contract.journeys.map((journey) => journey.id));
  const performance = manifest.performanceEvidence;
  if (!exactKeys(performance, PERFORMANCE_EVIDENCE_KEYS) || !journeyIds.has(performance.journeyId)
      || !['lab', 'field-p75'].includes(performance.evidenceKind) || !boundedText(performance.environment, 1, 200)
      || !safeInteger(performance.sampleSize, 1, 1_000_000_000) || !isoInstant(performance.windowStart) || !isoInstant(performance.windowEnd)
      || Date.parse(performance.windowEnd) < Date.parse(performance.windowStart) || !safeRelative(performance.evidencePath)
      || !HEX64.test(performance.evidenceSha256 ?? '') || !safeInteger(performance.lcpMs, 0, 120_000)
      || !safeInteger(performance.inpMs, 0, 60_000) || !safeInteger(performance.clsMilli, 0, 10_000)) fail('KSTACK_EXPERIENCE_PERFORMANCE_EVIDENCE_INVALID');
  const viewports = new Map(contract.validation.viewports.map((viewport) => [viewport.id, viewport]));
  const cases = new Map();
  for (const item of manifest.cases) {
    if (!exactKeys(item, CASE_KEYS) || !ID.test(item.caseId ?? '') || cases.has(item.caseId) || !contract.validation.requiredLanes.includes(item.lane)
        || !journeyIds.has(item.journeyId) || !STATES.has(item.state) || !viewports.has(item.viewportId) || !contract.validation.locales.includes(item.locale)
        || !contract.validation.zoomPercents.includes(item.zoomPercent) || !boundedText(item.checkType, 1, 80) || item.outcome !== 'PASS'
        || !safeRelative(item.evidencePath) || !HEX64.test(item.evidenceSha256 ?? '')) fail('KSTACK_EXPERIENCE_EVIDENCE_CASES_INVALID');
    if (item.lane === 'accessibility' && item.checkType === 'keyboard' && !viewports.get(item.viewportId).inputModes.includes('keyboard')) fail('KSTACK_EXPERIENCE_EVIDENCE_CASES_INVALID');
    cases.set(item.caseId, item);
  }
  const failures = [];
  for (const lane of REQUIRED_LANES) if ([...cases.values()].filter((item) => item.lane === lane).length < contract.validation.minimumCasesByLane[lane]) failures.push({ lane, reason: 'manifest-insufficient-cases' });
  for (const journey of contract.journeys) for (const state of journey.requiredStates) if (![...cases.values()].some((item) => item.journeyId === journey.id && item.state === state)) failures.push({ lane: 'state-coverage', reason: `missing-${journey.id}-${state}` });
  for (const journey of contract.journeys.filter((item) => item.priority === 'critical')) {
    if (![...cases.values()].some((item) => item.lane === 'critical-journey' && item.journeyId === journey.id)) failures.push({ lane: 'critical-journey', reason: `missing-${journey.id}` });
    for (const check of ACCESSIBILITY_CHECKS) if (![...cases.values()].some((item) => item.lane === 'accessibility' && item.journeyId === journey.id && item.checkType === check)) failures.push({ lane: 'accessibility', reason: `missing-${journey.id}-${check}` });
    for (const viewport of contract.validation.viewports) for (const locale of contract.validation.locales) for (const zoom of contract.validation.zoomPercents) {
      for (const lane of ['responsive', 'visual-regression']) if (![...cases.values()].some((item) => item.lane === lane && item.journeyId === journey.id && item.viewportId === viewport.id && item.locale === locale && item.zoomPercent === zoom)) failures.push({ lane, reason: `missing-${journey.id}-${viewport.id}-${locale}-${zoom}` });
    }
  }
  for (const journey of contract.journeys) for (const state of journey.requiredStates) if (![...cases.values()].some((item) => item.lane === 'visual-regression' && item.journeyId === journey.id && item.state === state)) failures.push({ lane: 'visual-regression', reason: `missing-${journey.id}-${state}` });
  if (contract.journeys.find((journey) => journey.id === performance.journeyId)?.priority !== 'critical') failures.push({ lane: 'performance', reason: 'critical-journey-evidence-required' });
  return Object.freeze({ status: failures.length === 0 ? 'PASS' : 'FAIL', failures: Object.freeze(failures), cases: Object.freeze([...cases.values()]), performanceEvidence: Object.freeze(performance) });
}

export function validateExperienceResult(result, contract, binding, evidence) {
  if (!exactKeys(result, RESULT_KEYS) || result.schemaVersion !== RESULT_SCHEMA || !HEX64.test(result.contractSha256 ?? '') || result.contractSha256 !== binding.contractSha256) fail('KSTACK_EXPERIENCE_RESULT_INVALID');
  if (!safeRelative(result.evidenceManifestPath) || !HEX64.test(result.evidenceManifestSha256 ?? '') || !evidence || evidence.status !== 'PASS') fail('KSTACK_EXPERIENCE_RESULT_EVIDENCE_INVALID');
  if (!exactKeys(result.release, RELEASE_KEYS) || result.release.releaseId !== binding.releaseId || result.release.deploymentId !== binding.deploymentId
      || result.release.commitSha !== binding.commitSha || result.release.artifactSha256 !== binding.artifactSha256
      || !RELEASE_ID.test(result.release.releaseId ?? '') || !RELEASE_ID.test(result.release.deploymentId ?? '') || !GIT_OID.test(result.release.commitSha ?? '') || !HEX64.test(result.release.artifactSha256 ?? '')) fail('KSTACK_EXPERIENCE_RESULT_BINDING_MISMATCH');
  if (!Array.isArray(result.lanes) || result.lanes.length !== contract.validation.requiredLanes.length) fail('KSTACK_EXPERIENCE_RESULT_LANES_INVALID');
  const laneMap = new Map();
  for (const lane of result.lanes) {
    if (!exactKeys(lane, LANE_KEYS) || !contract.validation.requiredLanes.includes(lane.lane) || laneMap.has(lane.lane)
        || !safeInteger(lane.cases, 0, 100_000) || !safeInteger(lane.failed, 0, lane.cases) || !safeInteger(lane.findings, 0, 100_000)
        || !HEX64.test(lane.evidenceSha256 ?? '')) fail('KSTACK_EXPERIENCE_RESULT_LANES_INVALID');
    laneMap.set(lane.lane, lane);
  }
  const failures = [];
  failures.push(...evidence.failures);
  for (const laneName of contract.validation.requiredLanes) {
    const lane = laneMap.get(laneName);
    const laneCases = projectedCases(evidence.cases, laneName);
    if (!lane || lane.cases !== laneCases.length || lane.evidenceSha256 !== sha256(canonicalBytes(laneCases))) fail('KSTACK_EXPERIENCE_RESULT_LANE_EVIDENCE_MISMATCH');
    if (lane.cases < contract.validation.minimumCasesByLane[laneName]) failures.push({ lane: laneName, reason: 'insufficient-cases' });
    else if (lane.failed > 0) failures.push({ lane: laneName, reason: 'failed-checks' });
    else if (lane.findings > 0) failures.push({ lane: laneName, reason: 'unresolved-findings' });
  }
  if (!exactKeys(result.metrics, METRIC_KEYS) || !['lab', 'field-p75'].includes(result.metrics.evidenceKind)
      || !safeInteger(result.metrics.lcpMs, 0, 120_000) || !safeInteger(result.metrics.inpMs, 0, 60_000) || !safeInteger(result.metrics.clsMilli, 0, 10_000)) fail('KSTACK_EXPERIENCE_RESULT_METRICS_INVALID');
  for (const key of METRIC_KEYS) if (result.metrics[key] !== evidence.performanceEvidence[key]) fail('KSTACK_EXPERIENCE_RESULT_METRICS_EVIDENCE_MISMATCH');
  if (contract.validation.performance.fieldEvidenceRequired && result.metrics.evidenceKind !== 'field-p75') failures.push({ lane: 'performance', reason: 'field-evidence-required' });
  if (result.metrics.lcpMs > contract.validation.performance.maxLcpMs) failures.push({ lane: 'performance', reason: 'lcp-budget' });
  if (result.metrics.inpMs > contract.validation.performance.maxInpMs) failures.push({ lane: 'performance', reason: 'inp-budget' });
  if (result.metrics.clsMilli > contract.validation.performance.maxClsMilli) failures.push({ lane: 'performance', reason: 'cls-budget' });
  if (!exactKeys(result.visualReview, REVIEW_KEYS) || !['APPROVED', 'PENDING', 'REVISE'].includes(result.visualReview.status)
      || !safeInteger(result.visualReview.confidence, 0, 100) || !safeInteger(result.visualReview.failed, 0, 100_000)
      || !safeInteger(result.visualReview.security, 0, 100_000) || !safeInteger(result.visualReview.dissent, 0, 100_000)
      || !safeInteger(result.visualReview.questions, 0, 100_000) || !HEX64.test(result.visualReview.screenshotManifestSha256 ?? '')) fail('KSTACK_EXPERIENCE_RESULT_REVIEW_INVALID');
  if (result.visualReview.status !== 'APPROVED') failures.push({ lane: 'visual-review', reason: 'review-not-approved' });
  if (result.visualReview.confidence < contract.validation.visualReview.minimumConfidence) failures.push({ lane: 'visual-review', reason: 'confidence-below-threshold' });
  for (const counter of ['failed', 'security', 'dissent', 'questions']) if (result.visualReview[counter] !== 0) failures.push({ lane: 'visual-review', reason: `${counter}-not-zero` });
  secretScan(result);
  const uniqueFailures = failures.filter((failure, index) => failures.findIndex((candidate) => candidate.lane === failure.lane && candidate.reason === failure.reason) === index);
  return Object.freeze({ status: uniqueFailures.length === 0 ? 'PASS' : 'FAIL', failures: Object.freeze(uniqueFailures), contractSha256: result.contractSha256, screenshotManifestSha256: result.visualReview.screenshotManifestSha256 });
}

export function readExperienceResult(projectRoot, resultPath, contract, binding) {
  const root = fs.realpathSync(projectRoot);
  const absolute = containedPath(root, resultPath, 'KSTACK_EXPERIENCE_RESULT_PATH_INVALID');
  const bytes = safeRead(absolute, MAX_DOCUMENT_BYTES, 'KSTACK_EXPERIENCE_RESULT_READ_INVALID');
  let value; try { value = JSON.parse(bytes.toString('utf8')); } catch { fail('KSTACK_EXPERIENCE_RESULT_JSON_INVALID'); }
  if (!safeRelative(value.evidenceManifestPath)) fail('KSTACK_EXPERIENCE_RESULT_EVIDENCE_INVALID');
  const runDirectory = path.dirname(absolute);
  const manifestAbsolute = containedPath(runDirectory, value.evidenceManifestPath, 'KSTACK_EXPERIENCE_EVIDENCE_PATH_INVALID');
  const manifestBytes = safeRead(manifestAbsolute, MAX_DOCUMENT_BYTES, 'KSTACK_EXPERIENCE_EVIDENCE_READ_INVALID');
  if (sha256(manifestBytes) !== value.evidenceManifestSha256) fail('KSTACK_EXPERIENCE_EVIDENCE_DIGEST_MISMATCH');
  let manifest; try { manifest = JSON.parse(manifestBytes.toString('utf8')); } catch { fail('KSTACK_EXPERIENCE_EVIDENCE_JSON_INVALID'); }
  const evidence = validateExperienceEvidenceManifest(manifest, contract, binding);
  for (const item of evidence.cases) {
    const evidenceAbsolute = containedPath(runDirectory, item.evidencePath, 'KSTACK_EXPERIENCE_CASE_EVIDENCE_PATH_INVALID');
    const evidenceBytes = safeRead(evidenceAbsolute, 16 * 1024 * 1024, 'KSTACK_EXPERIENCE_CASE_EVIDENCE_READ_INVALID');
    if (sha256(evidenceBytes) !== item.evidenceSha256) fail('KSTACK_EXPERIENCE_CASE_EVIDENCE_DIGEST_MISMATCH');
  }
  const performanceAbsolute = containedPath(runDirectory, evidence.performanceEvidence.evidencePath, 'KSTACK_EXPERIENCE_PERFORMANCE_EVIDENCE_PATH_INVALID');
  const performanceBytes = safeRead(performanceAbsolute, 16 * 1024 * 1024, 'KSTACK_EXPERIENCE_PERFORMANCE_EVIDENCE_READ_INVALID');
  if (sha256(performanceBytes) !== evidence.performanceEvidence.evidenceSha256) fail('KSTACK_EXPERIENCE_PERFORMANCE_EVIDENCE_DIGEST_MISMATCH');
  let performanceRaw;
  try { performanceRaw = JSON.parse(performanceBytes.toString('utf8')); } catch { fail('KSTACK_EXPERIENCE_PERFORMANCE_EVIDENCE_CONTENT_INVALID'); }
  if (!exactKeys(performanceRaw, PERFORMANCE_RAW_KEYS)
      || canonical(performanceRaw) !== canonical(performanceEvidenceProjection(evidence.performanceEvidence))) fail('KSTACK_EXPERIENCE_PERFORMANCE_EVIDENCE_CONTENT_INVALID');
  if (manifest.visualDisclosure.classification === 'owner-authorized') {
    const authorizationAbsolute = containedPath(runDirectory, manifest.visualDisclosure.authorizationReceiptPath, 'KSTACK_EXPERIENCE_DISCLOSURE_RECEIPT_PATH_INVALID');
    const authorizationBytes = safeRead(authorizationAbsolute, MAX_DOCUMENT_BYTES, 'KSTACK_EXPERIENCE_DISCLOSURE_RECEIPT_READ_INVALID');
    if (sha256(authorizationBytes) !== manifest.visualDisclosure.authorizationReceiptSha256) fail('KSTACK_EXPERIENCE_DISCLOSURE_RECEIPT_DIGEST_MISMATCH');
  }
  const screenshotManifestSha256 = sha256(canonicalBytes(projectedCases(evidence.cases, 'visual-regression')));
  if (value.visualReview?.screenshotManifestSha256 !== screenshotManifestSha256) fail('KSTACK_EXPERIENCE_SCREENSHOT_MANIFEST_MISMATCH');
  return { absolute, bytes, digest: sha256(bytes), result: validateExperienceResult(value, contract, binding, evidence), evidenceManifestSha256: value.evidenceManifestSha256 };
}

export function parseExperienceArgs(argv) {
  const [command, ...rest] = argv; const options = { command };
  if (rest.length % 2 !== 0) fail('KSTACK_EXPERIENCE_ARGUMENTS_INVALID');
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index]; const value = rest[index + 1];
    const name = key?.slice(2);
    if (!key?.startsWith('--') || !name || value === undefined || Object.hasOwn(options, name)) fail('KSTACK_EXPERIENCE_ARGUMENTS_INVALID');
    options[name] = value;
  }
  return options;
}

function main(argv) {
  const options = parseExperienceArgs(argv);
  const allowed = options.command === 'validate-contract'
    ? new Set(['command', 'project-root', 'contract'])
    : options.command === 'phase-gate'
      ? new Set(['command', 'project-root', 'contract', 'phase'])
    : options.command === 'validate-result'
      ? new Set(['command', 'project-root', 'contract', 'result', 'release-id', 'deployment-id', 'commit-sha', 'artifact-sha256']) : null;
  if (!allowed || Object.keys(options).some((key) => !allowed.has(key)) || !options['project-root'] || !options.contract) fail('KSTACK_EXPERIENCE_ARGUMENTS_INVALID');
  const loaded = readExperienceContract(options['project-root'], options.contract);
  const sources = experienceSourceManifest(loaded.root, loaded.contract);
  if (options.command === 'validate-contract' || options.command === 'phase-gate') {
    if (options.command === 'phase-gate' && !['design', 'implementation', 'qc'].includes(options.phase)) fail('KSTACK_EXPERIENCE_ARGUMENTS_INVALID');
    process.stdout.write(`${JSON.stringify({ status: 'PASS', phase: options.phase ?? null, contractSha256: loaded.digest, sources })}\n`); return;
  }
  for (const key of ['result', 'release-id', 'deployment-id', 'commit-sha', 'artifact-sha256']) if (!options[key]) fail('KSTACK_EXPERIENCE_ARGUMENTS_INVALID');
  const checked = readExperienceResult(loaded.root, options.result, loaded.contract, {
    contractSha256: loaded.digest, releaseId: options['release-id'], deploymentId: options['deployment-id'],
    commitSha: options['commit-sha'], artifactSha256: options['artifact-sha256']
  });
  process.stdout.write(`${JSON.stringify({ ...checked.result, resultSha256: checked.digest, sources })}\n`);
  if (checked.result.status !== 'PASS') process.exitCode = 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.code ?? 'KSTACK_EXPERIENCE_UNEXPECTED'}\n`); process.exitCode = 1; }
}
