import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HEX64 = /^[a-f0-9]{64}$/u;
const EXPECTED_BINARY = '057a1788b48cc1452203920afd31eac274d5b9cb10026734d587e5db33885792';
const EXPECTED_ACTIONS = Object.freeze(['VERSION', 'HELP', 'SKILLS_LIST', 'ADVISORY']);
const EMPTY_SHA256 = crypto.createHash('sha256').update('').digest('hex');
const SECRET_PATTERN = /(?:ATATT3xF[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*\S+)/iu;
const qualificationRoot = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(qualificationRoot, '..', '..');

export class GooseIsolatedEvidenceError extends Error {
  constructor(code, detail = '') {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'GooseIsolatedEvidenceError';
    this.code = code;
  }
}

function fail(code, detail = '') { throw new GooseIsolatedEvidenceError(code, detail); }
function compare(left, right) { return Buffer.compare(Buffer.from(left), Buffer.from(right)); }
function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort(compare);
  const expected = [...keys].sort(compare);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code, 'closed schema');
}
function digest(value, code) { if (typeof value !== 'string' || !HEX64.test(value)) fail(code); return value; }
function text(value, code) { if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) fail(code); return value; }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])]));
  return value;
}
function recordDigest(value) { return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
function fileDigest(relative) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(sourceRoot, relative))).digest('hex'); }
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}

function validateOperation(value, action) {
  const code = 'KSTACK_GOOSE_ISOLATED_OPERATION_INVALID';
  exact(value, [
    'schemaVersion', 'operationId', 'action', 'binaryPath', 'binarySha256',
    'repositoryRoot', 'pathRoot', 'inputDigest', 'expectedMarker',
    'brokerTicketDigest', 'deadlineMs'
  ], code);
  if (value.schemaVersion !== 1 || value.action !== action || value.binarySha256 !== EXPECTED_BINARY) fail(code);
  text(value.operationId, code); digest(value.inputDigest, code); text(value.expectedMarker, code);
  if (!path.isAbsolute(value.binaryPath) || !path.isAbsolute(value.repositoryRoot) || !path.isAbsolute(value.pathRoot)) fail(code);
  if (action === 'ADVISORY') digest(value.brokerTicketDigest, code);
  else if (value.brokerTicketDigest !== null) fail(code);
  if (!Number.isSafeInteger(value.deadlineMs) || value.deadlineMs < 100 || value.deadlineMs > 120_000) fail(code);
  return value;
}

function validateObservation(value, operation, providerRequestDigest) {
  const code = 'KSTACK_GOOSE_ISOLATED_OBSERVATION_INVALID';
  exact(value, [
    'schemaVersion', 'hostId', 'operationId', 'action', 'binarySha256',
    'inputDigest', 'stdoutSha256', 'stderrSha256', 'providerRequestCount',
    'providerRequestDigest', 'rootMutationDigest', 'markerObserved',
    'loopbackOnly', 'orphanCount', 'nativeOutcome', 'reasonCodes'
  ], code);
  if (value.schemaVersion !== 1 || value.hostId !== 'goose' || value.operationId !== operation.operationId
    || value.action !== operation.action || value.binarySha256 !== EXPECTED_BINARY
    || value.inputDigest !== operation.inputDigest) fail(code);
  digest(value.stdoutSha256, code); digest(value.stderrSha256, code); digest(value.rootMutationDigest, code);
  if (value.stderrSha256 !== EMPTY_SHA256 || value.markerObserved !== true || value.loopbackOnly !== true
    || value.orphanCount !== 0 || value.nativeOutcome !== 'MATCH'
    || !Array.isArray(value.reasonCodes) || value.reasonCodes.length !== 0) fail(code);
  const expectedRequests = operation.action === 'ADVISORY' ? 2 : 0;
  if (value.providerRequestCount !== expectedRequests) fail(code);
  if (expectedRequests === 2) {
    if (value.providerRequestDigest !== providerRequestDigest) fail(code);
  } else if (value.providerRequestDigest !== null) fail(code);
  return value;
}

export function validateGooseIsolatedEvidence(input) {
  const code = 'KSTACK_GOOSE_ISOLATED_EVIDENCE_INVALID';
  exact(input, [
    'schema', 'binarySha256', 'bindings', 'interfaces', 'loopbackOnly',
    'repositoryBeforeDigest', 'repositoryAfterDigest', 'pathRootAfterDigest',
    'pathRootEntries', 'providerRequestCount', 'providerRequestDigest',
    'observations', 'aggregate', 'evidenceDigest'
  ], code);
  if (input.schema !== 'kstack-goose-v1.48.0-isolated-cell-v1'
    || input.binarySha256 !== EXPECTED_BINARY || input.loopbackOnly !== true
    || input.aggregate !== 'PASS') fail(code);
  exact(input.bindings, [
    'adapterDigest', 'providerScriptDigest', 'childHarnessDigest',
    'pid1ReaperSourceDigest', 'installManifestDigest', 'supplyChainEvidenceDigest'
  ], code);
  const expectedBindings = {
    adapterDigest: fileDigest('plugins/kstack/scripts/kstack-goose-adapter.mjs'),
    providerScriptDigest: fileDigest('.kstack/qualifications/goose-v1.48.0-synthetic-provider.mjs'),
    childHarnessDigest: fileDigest('.kstack/qualifications/goose-v1.48.0-isolated-cell-child.mjs'),
    pid1ReaperSourceDigest: fileDigest('.kstack/qualifications/kstack-pid1-reaper.c'),
    installManifestDigest: fileDigest('plugins/kstack/install-health-audit-manifest-v1.json'),
    supplyChainEvidenceDigest: fileDigest('.kstack/qualifications/goose-v1.48.0-supply-chain-2026-08-29.md')
  };
  if (JSON.stringify(input.bindings) !== JSON.stringify(expectedBindings)) fail(code, 'currentness binding drift');
  if (!Array.isArray(input.interfaces) || input.interfaces.length !== 1 || input.interfaces[0] !== 'lo') fail(code);
  digest(input.repositoryBeforeDigest, code); digest(input.repositoryAfterDigest, code);
  digest(input.pathRootAfterDigest, code); digest(input.providerRequestDigest, code);
  if (input.repositoryBeforeDigest !== input.repositoryAfterDigest || input.providerRequestCount !== 2) fail(code);
  if (!Array.isArray(input.pathRootEntries) || input.pathRootEntries.length === 0
    || input.pathRootEntries.some((entry) => typeof entry !== 'string' || entry.length === 0
      || path.isAbsolute(entry) || entry.split('/').includes('..'))) fail(code);
  if (!Array.isArray(input.observations) || input.observations.length !== EXPECTED_ACTIONS.length) fail(code);
  for (const [index, entry] of input.observations.entries()) {
    exact(entry, ['operation', 'invocationDigest', 'observation', 'observationDigest'], code);
    const operation = validateOperation(entry.operation, EXPECTED_ACTIONS[index]);
    digest(entry.invocationDigest, code); digest(entry.observationDigest, code);
    const observation = validateObservation(entry.observation, operation, input.providerRequestDigest);
    if (recordDigest(observation) !== entry.observationDigest) fail(code, 'observation digest');
  }
  const unsigned = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'evidenceDigest'));
  if (recordDigest(unsigned) !== input.evidenceDigest) fail(code, 'aggregate digest');
  if (SECRET_PATTERN.test(JSON.stringify(input))) fail(code, 'credential-shaped content');
  return immutable(structuredClone(input));
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const target = process.argv[2] || fileURLToPath(new URL('./goose-v1.48.0-isolated-cell-evidence.json', import.meta.url));
  const value = validateGooseIsolatedEvidence(JSON.parse(fs.readFileSync(target, 'utf8')));
  process.stdout.write(`${JSON.stringify({ result: 'PASS', evidenceDigest: value.evidenceDigest, operations: value.observations.length }, null, 2)}\n`);
}
