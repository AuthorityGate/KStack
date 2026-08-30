#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertOutboundSecretScan,
  MATCHER_VERSION
} from '../../plugins/kstack/scripts/kstack-safety-matchers.mjs';
import { finalBugFixIntake } from '../../plugins/kstack/scripts/kstack-review-schema.mjs';
import { canonical, recordDigest } from './host-implementation-inventory.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const HASH = /^[a-f0-9]{64}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const DESTINATION = Object.freeze({
  provider: 'local-claude-cli', model: 'opus', tools: 'none', sessionless: true
});
export const RUNTIME_REVIEW_PACKET_CONTRACTS = Object.freeze([
  Object.freeze({
    id: 'host-portability', packetSchema: 'kstack-host-core-independent-final-review-payload-v1',
    reviewSchema: 'kstack-host-core-independent-final-review-v1', groupId: 'host-portability',
    verdict: 'APPROVE', scope: Object.freeze([
      'hp-tc01-schemas', 'hp-tc02-request-context', 'hp-tc03-replay-time',
      'hp-tc04-evidence-selection', 'hp-tc05-eligibility-quarantine', 'hp-tc06-harness-bypass',
      'hp-tc07-structural-broker', 'hp-tc08-race-mutation', 'hp-tc09-mcp-boundary',
      'hp-tc10-receipt-trust', 'hp-tc11-leases-activation', 'hp-tc12-migrations-rollout'
    ])
  }),
  Object.freeze({
    id: 'host-breadth-foundation', packetSchema: 'kstack-host-core-independent-final-review-payload-v1',
    reviewSchema: 'kstack-host-core-independent-final-review-v1', groupId: 'host-breadth-foundation',
    verdict: 'APPROVE', scope: Object.freeze([
      'hb-tc01-canonical-package', 'hb-tc02-installer', 'hb-tc03-opencode-package',
      'hb-tc04-readonly-mcp', 'hb-tc05-opencode-conformance'
    ])
  }),
  Object.freeze({
    id: 'host-integrated', packetSchema: 'kstack-host-integrated-independent-final-review-payload-v1',
    reviewSchema: 'kstack-host-integrated-independent-final-review-v1', groupId: null,
    verdict: 'APPROVE', scope: Object.freeze(['hb-tc06-second-host-proof', 'hb-tc09-goose-host'])
  }),
  Object.freeze({
    id: 'host-negative-disposition', packetSchema: 'kstack-host-negative-disposition-independent-review-payload-v1',
    reviewSchema: 'kstack-host-negative-disposition-independent-review-v1', groupId: null,
    verdict: 'APPROVE_NEGATIVE_QUALIFICATION', scope: Object.freeze(['hb-tc07-hermes-host', 'hb-tc08-openclaw-orchestration'])
  }),
  Object.freeze({
    id: 'domain-foundation', packetSchema: 'kstack-domain-core-independent-final-review-payload-v1',
    reviewSchema: 'kstack-domain-core-independent-final-review-v1', groupId: 'domain-foundation',
    verdict: 'APPROVE', scope: Object.freeze([
      'domain-d0-catalog-runtime', 'domain-d1-identity', 'domain-d2f1-inventory',
      'domain-d2f2-policy', 'domain-d2f3-selection', 'domain-d3-separation'
    ])
  }),
  Object.freeze({
    id: 'domain-execution', packetSchema: 'kstack-domain-core-independent-final-review-payload-v1',
    reviewSchema: 'kstack-domain-core-independent-final-review-v1', groupId: 'domain-execution',
    verdict: 'APPROVE', scope: Object.freeze([
      'domain-d4d10-evidence', 'domain-d5f1-schemas', 'domain-d5f2-activation',
      'domain-d6-budgets', 'domain-d7-evaluation', 'domain-d8-time'
    ])
  }),
  Object.freeze({
    id: 'domain-acquisition', packetSchema: 'kstack-domain-core-independent-final-review-payload-v1',
    reviewSchema: 'kstack-domain-core-independent-final-review-v1', groupId: 'domain-acquisition',
    verdict: 'APPROVE', scope: Object.freeze(['domain-acquisition-trial'])
  })
]);
const PACKET_CONTRACTS = RUNTIME_REVIEW_PACKET_CONTRACTS;
const EXPECTED_IDS = Object.freeze(PACKET_CONTRACTS.map((row) => row.id));
const EXPECTED_SCOPE = Object.freeze(PACKET_CONTRACTS.flatMap((row) => row.scope));
const REVIEW_KEYS = Object.freeze([
  'schema', 'reviewer', 'reviewerFamily', 'targetDigest', 'verdict', 'confidence',
  'failedCriteria', 'securityFindings', 'materialDissent', 'unresolvedQuestions',
  'recommendation', 'reviewedAt'
]);
const GROUP_REVIEW_KEYS = Object.freeze([...REVIEW_KEYS, 'groupId']);
const FINAL_ACCEPTANCE_CONFIDENCE = 81;
const FINDING_SEVERITIES = Object.freeze(new Set(['low', 'medium', 'high', 'critical']));

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function digest(value, code) {
  if (typeof value !== 'string' || !HASH.test(value)) fail(code);
  return value;
}

function boundedText(value, code, maximum = 128) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum
      || !value.isWellFormed() || CONTROL_OR_BIDI.test(value)) fail(code);
  return value;
}

function reviewTextArray(value, code) {
  if (!Array.isArray(value) || value.length > 256) fail(code);
  return value.map((entry) => boundedText(entry, code, 4096));
}

function reviewSecurityFindings(value, code) {
  if (!Array.isArray(value) || value.length > 256) fail(code);
  const ids = new Set();
  return value.map((entry) => {
    exact(entry, ['id', 'severity', 'summary'], code);
    const id = boundedText(entry.id, code, 128);
    const severity = boundedText(entry.severity, code, 16);
    const summary = boundedText(entry.summary, code, 4096);
    if (!FINDING_SEVERITIES.has(severity) || ids.has(id)) fail(code);
    ids.add(id);
    return { id, severity, summary };
  });
}

function instant(value, code) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail(code);
  try {
    if (new Date(value).toISOString() !== value) fail(code);
  } catch { fail(code); }
  return value;
}

function exactArray(left, right, code) {
  if (!Array.isArray(left) || left.length !== right.length
      || left.some((value, index) => value !== right[index])) fail(code);
}

function parseJsonBytes(bytes, code, maximum) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 2 || bytes.length > maximum) fail(code);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail(code); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  return value;
}

function validateDestination(value, sessionless, code) {
  exact(value, sessionless ? ['provider', 'model', 'tools', 'sessionless'] : ['provider', 'model', 'tools'], code);
  if (value.provider !== DESTINATION.provider || value.model !== DESTINATION.model
      || value.tools !== DESTINATION.tools || (sessionless && value.sessionless !== true)) fail(code);
}

function validateBatchManifest(manifest) {
  exact(manifest, ['schema', 'batchDigest', 'reviewTarget'], 'KSTACK_REVIEW_BATCH_MANIFEST_INVALID');
  if (manifest.schema !== 'kstack-independent-review-batch-manifest-v2') fail('KSTACK_REVIEW_BATCH_MANIFEST_INVALID');
  const target = manifest.reviewTarget;
  exact(target, ['schema', 'destination', 'packets', 'exclusions', 'secretBoundary'], 'KSTACK_REVIEW_BATCH_TARGET_INVALID');
  if (target.schema !== 'kstack-independent-review-batch-target-v2') fail('KSTACK_REVIEW_BATCH_TARGET_INVALID');
  validateDestination(target.destination, true, 'KSTACK_REVIEW_BATCH_DESTINATION_INVALID');
  exact(target.exclusions, ['credentialFiles', 'providerTrials', 'jiraMutation', 'ownerDecisions', 'packActivation'], 'KSTACK_REVIEW_BATCH_EXCLUSIONS_INVALID');
  if (Object.values(target.exclusions).some((value) => value !== true)) fail('KSTACK_REVIEW_BATCH_EXCLUSIONS_INVALID');
  exact(target.secretBoundary, ['excludedPrefixes', 'externalCredentialFilesIncluded', 'matcher'], 'KSTACK_REVIEW_BATCH_SECRET_BOUNDARY_INVALID');
  exactArray(target.secretBoundary.excludedPrefixes, ['.kstack/secrets/'], 'KSTACK_REVIEW_BATCH_SECRET_BOUNDARY_INVALID');
  if (target.secretBoundary.externalCredentialFilesIncluded !== false || target.secretBoundary.matcher !== MATCHER_VERSION) fail('KSTACK_REVIEW_BATCH_SECRET_BOUNDARY_INVALID');
  if (!Array.isArray(target.packets) || target.packets.length !== PACKET_CONTRACTS.length) fail('KSTACK_REVIEW_BATCH_PACKET_INVENTORY_INVALID');
  exactArray(target.packets.map((row) => row?.id), EXPECTED_IDS, 'KSTACK_REVIEW_BATCH_PACKET_INVENTORY_INVALID');
  for (const packet of target.packets) {
    exact(packet, ['id', 'path', 'bytes', 'sha256', 'targetDigest'], 'KSTACK_REVIEW_BATCH_PACKET_DESCRIPTOR_INVALID');
    if (typeof packet.path !== 'string' || !path.isAbsolute(packet.path)
        || path.normalize(packet.path) !== packet.path || !Number.isSafeInteger(packet.bytes)
        || packet.bytes < 2 || packet.bytes > 4 * 1024 * 1024) fail('KSTACK_REVIEW_BATCH_PACKET_DESCRIPTOR_INVALID');
    digest(packet.sha256, 'KSTACK_REVIEW_BATCH_PACKET_DESCRIPTOR_INVALID');
    digest(packet.targetDigest, 'KSTACK_REVIEW_BATCH_PACKET_DESCRIPTOR_INVALID');
  }
  const expectedDigest = sha256(Buffer.from(JSON.stringify(target), 'utf8'));
  if (manifest.batchDigest !== expectedDigest) {
    fail('KSTACK_REVIEW_BATCH_MANIFEST_BINDING_INVALID');
  }
  return target;
}

function validatePacket(contract, descriptor, bytes) {
  if (bytes.length !== descriptor.bytes || sha256(bytes) !== descriptor.sha256) fail('KSTACK_REVIEW_BATCH_PACKET_DRIFT');
  assertOutboundSecretScan(bytes, { byteDomain: true });
  const packet = parseJsonBytes(bytes, 'KSTACK_REVIEW_BATCH_PACKET_INVALID', 4 * 1024 * 1024);
  if (packet.schema !== contract.packetSchema || packet.targetDigest !== descriptor.targetDigest) fail('KSTACK_REVIEW_BATCH_PACKET_INVALID');
  validateDestination(packet.destination, false, 'KSTACK_REVIEW_BATCH_PACKET_DESTINATION_INVALID');
  if (contract.groupId === null) {
    if (Object.hasOwn(packet, 'groupId')) fail('KSTACK_REVIEW_BATCH_PACKET_INVALID');
  } else if (packet.groupId !== contract.groupId) fail('KSTACK_REVIEW_BATCH_PACKET_INVALID');
  if (Array.isArray(packet.scope)) exactArray(packet.scope, contract.scope, 'KSTACK_REVIEW_BATCH_SCOPE_INVALID');
  else if (contract.id !== 'host-integrated' || typeof packet.scope !== 'string' || packet.scope.length < 1) fail('KSTACK_REVIEW_BATCH_SCOPE_INVALID');
  return packet;
}

function validateReview(contract, descriptor, bytes, admittedAt) {
  assertOutboundSecretScan(bytes, { byteDomain: true });
  const value = parseJsonBytes(bytes, 'KSTACK_REVIEW_RESULT_INVALID', 64 * 1024);
  exact(value, contract.groupId === null ? REVIEW_KEYS : GROUP_REVIEW_KEYS, 'KSTACK_REVIEW_RESULT_INVALID');
  if (value.schema !== contract.reviewSchema || value.reviewerFamily !== 'claude'
      || value.targetDigest !== descriptor.targetDigest || ![contract.verdict, 'REVISE'].includes(value.verdict)
      || (contract.groupId !== null && value.groupId !== contract.groupId)) fail('KSTACK_REVIEW_RESULT_INVALID');
  boundedText(value.reviewer, 'KSTACK_REVIEW_RESULT_INVALID');
  if (!Number.isSafeInteger(value.confidence) || value.confidence < FINAL_ACCEPTANCE_CONFIDENCE || value.confidence > 100) fail('KSTACK_REVIEW_RESULT_NOT_ACCEPTED');
  const failedCriteria = reviewTextArray(value.failedCriteria, 'KSTACK_REVIEW_RESULT_INVALID');
  const securityFindings = reviewSecurityFindings(value.securityFindings, 'KSTACK_REVIEW_RESULT_INVALID');
  const materialDissent = reviewTextArray(value.materialDissent, 'KSTACK_REVIEW_RESULT_INVALID');
  const unresolvedQuestions = reviewTextArray(value.unresolvedQuestions, 'KSTACK_REVIEW_RESULT_INVALID');
  const recommendation = boundedText(value.recommendation, 'KSTACK_REVIEW_RESULT_INVALID', 4096);
  const hasFindings = [failedCriteria, securityFindings, materialDissent, unresolvedQuestions].some((entries) => entries.length > 0);
  if (value.verdict === contract.verdict && hasFindings) fail('KSTACK_REVIEW_RESULT_DECISION_MISMATCH');
  const bugFixIntake = finalBugFixIntake({
    decision: value.verdict === 'REVISE' ? 'revise' : 'approve',
    failedChecks: failedCriteria,
    securityFindings,
    materialDissent,
    unresolvedQuestions,
    recommendation
  }).map((item) => Object.freeze({
    ...item,
    id: `${contract.id}:${item.id}`,
    sourceReviewTargetDigest: descriptor.targetDigest,
    scope: [...contract.scope]
  }));
  instant(value.reviewedAt, 'KSTACK_REVIEW_RESULT_INVALID');
  if (Date.parse(value.reviewedAt) > Date.parse(admittedAt)) fail('KSTACK_REVIEW_RESULT_TIME_INVALID');
  const reviewBody = canonical(value);
  return Object.freeze({
    id: contract.id,
    groupId: contract.groupId,
    packetSha256: descriptor.sha256,
    targetDigest: descriptor.targetDigest,
    scope: [...contract.scope],
    resultSha256: sha256(bytes),
    reviewDigest: recordDigest(reviewBody),
    reviewer: value.reviewer,
    reviewerFamily: value.reviewerFamily,
    verdict: value.verdict,
    confidence: value.confidence,
    disposition: bugFixIntake.length === 0 ? 'clean' : 'bugfix-only',
    bugFixCount: bugFixIntake.length,
    bugFixIntake,
    reviewedAt: value.reviewedAt
  });
}

export function admitRuntimeIndependentReviewBatch({
  manifestBytes, packetBytesById, resultBytesById, admittedAt,
  observedAt = new Date().toISOString()
}) {
  instant(admittedAt, 'KSTACK_REVIEW_BATCH_ADMITTED_AT_INVALID');
  instant(observedAt, 'KSTACK_REVIEW_BATCH_OBSERVED_AT_INVALID');
  if (Date.parse(admittedAt) > Date.parse(observedAt)) fail('KSTACK_REVIEW_BATCH_ADMITTED_AT_FUTURE');
  const manifest = parseJsonBytes(manifestBytes, 'KSTACK_REVIEW_BATCH_MANIFEST_INVALID', 64 * 1024);
  assertOutboundSecretScan(manifestBytes, { byteDomain: true });
  const target = validateBatchManifest(manifest);
  if (!(packetBytesById instanceof Map) || !(resultBytesById instanceof Map)
      || packetBytesById.size !== PACKET_CONTRACTS.length || resultBytesById.size !== PACKET_CONTRACTS.length
      || EXPECTED_IDS.some((id) => !packetBytesById.has(id) || !resultBytesById.has(id))) fail('KSTACK_REVIEW_BATCH_INPUT_INVENTORY_INVALID');
  const reviews = PACKET_CONTRACTS.map((contract, index) => {
    const descriptor = target.packets[index];
    validatePacket(contract, descriptor, packetBytesById.get(contract.id));
    return validateReview(contract, descriptor, resultBytesById.get(contract.id), admittedAt);
  });
  const scope = reviews.flatMap((row) => row.scope);
  exactArray(scope, EXPECTED_SCOPE, 'KSTACK_REVIEW_BATCH_COVERAGE_INVALID');
  if (new Set(scope).size !== scope.length) fail('KSTACK_REVIEW_BATCH_COVERAGE_INVALID');
  const packetSetDigest = recordDigest(target.packets.map(({ id, bytes, sha256: packetSha256, targetDigest }) => ({
    id, bytes, packetSha256, targetDigest
  })));
  const implementationIntake = reviews.flatMap((review) => review.bugFixIntake);
  const body = canonical({
    schemaVersion: 1,
    kind: 'kstack-runtime-independent-final-review-batch-receipt-v1',
    batchDigest: manifest.batchDigest,
    destination: DESTINATION,
    packetSetDigest,
    admittedAt,
    reviews,
    finalAcceptanceConfidence: FINAL_ACCEPTANCE_CONFIDENCE,
    disposition: implementationIntake.length === 0 ? 'clean' : 'bugfix-only',
    implementationIntake,
    coverage: { itemIds: scope, itemCount: scope.length, itemSetDigest: recordDigest(scope) },
    unresolvedGateClasses: [
      'external-linux-platform-and-privileged-qualification',
      'provider-ab-trials',
      'pack-held-out-evaluation-and-natural-person-adjudication',
      'owner-dispositions-and-activations',
      'durable-jira-closure'
    ]
  });
  const receipt = Object.freeze({ ...body, receiptDigest: recordDigest(body) });
  const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  assertOutboundSecretScan(receiptBytes, { byteDomain: true });
  return Object.freeze({ receipt, receiptBytes });
}

function readRegular(file, maximum, code) {
  let descriptor;
  try {
    const linked = fs.lstatSync(file);
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(descriptor);
    if (!linked.isFile() || linked.isSymbolicLink() || !opened.isFile()
        || linked.dev !== opened.dev || linked.ino !== opened.ino
        || opened.size < 2 || opened.size > maximum) fail(code);
    return fs.readFileSync(descriptor);
  } catch (error) {
    if (error?.code?.startsWith?.('KSTACK_')) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function readExactResultDirectory(directory) {
  const linked = fs.lstatSync(directory);
  if (!linked.isDirectory() || linked.isSymbolicLink()) fail('KSTACK_REVIEW_RESULT_DIRECTORY_INVALID');
  const expectedNames = EXPECTED_IDS.map((id) => `${id}.json`).sort();
  const names = fs.readdirSync(directory).sort();
  exactArray(names, expectedNames, 'KSTACK_REVIEW_RESULT_DIRECTORY_INVALID');
  return new Map(EXPECTED_IDS.map((id) => [
    id, readRegular(path.join(directory, `${id}.json`), 64 * 1024, 'KSTACK_REVIEW_RESULT_FILE_INVALID')
  ]));
}

function parseArgs(argv) {
  if (argv[0] !== 'admit') fail('KSTACK_REVIEW_BATCH_ARGUMENT_INVALID');
  const result = {};
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--manifest', '--results-dir', '--out', '--admitted-at'].includes(key) || !value || Object.hasOwn(result, key)) fail('KSTACK_REVIEW_BATCH_ARGUMENT_INVALID');
    result[key] = value;
  }
  if (argv.length !== 9 || Object.keys(result).length !== 4) fail('KSTACK_REVIEW_BATCH_ARGUMENT_INVALID');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const manifestPath = path.resolve(args['--manifest']);
    const resultsDirectory = path.resolve(args['--results-dir']);
    const output = path.resolve(args['--out']);
    const manifestBytes = readRegular(manifestPath, 64 * 1024, 'KSTACK_REVIEW_BATCH_MANIFEST_FILE_INVALID');
    const manifest = parseJsonBytes(manifestBytes, 'KSTACK_REVIEW_BATCH_MANIFEST_INVALID', 64 * 1024);
    const packetBytesById = new Map(manifest.reviewTarget?.packets?.map((row) => [
      row.id, readRegular(row.path, 4 * 1024 * 1024, 'KSTACK_REVIEW_BATCH_PACKET_FILE_INVALID')
    ]) ?? []);
    const resultBytesById = readExactResultDirectory(resultsDirectory);
    const { receipt, receiptBytes } = admitRuntimeIndependentReviewBatch({
      manifestBytes, packetBytesById, resultBytesById,
      admittedAt: args['--admitted-at'], observedAt: new Date().toISOString()
    });
    const handle = fs.openSync(output, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    try { fs.writeFileSync(handle, receiptBytes); fs.fsyncSync(handle); } finally { fs.closeSync(handle); }
    process.stdout.write(`${JSON.stringify({
      status: 'ADMITTED', output, receiptDigest: receipt.receiptDigest,
      reviews: receipt.reviews.length, coveredItems: receipt.coverage.itemCount
    })}\n`);
  } catch (error) {
    process.stderr.write(`${error?.code || error?.message || 'KSTACK_REVIEW_BATCH_FAILED'}\n`);
    process.exitCode = 2;
  }
}
