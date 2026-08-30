#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertOutboundSecretScan, MATCHER_VERSION } from '../../plugins/kstack/scripts/kstack-safety-matchers.mjs';
import { canonical, recordDigest, sourceRoot } from './host-implementation-inventory.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REVIEW_ITEMS = Object.freeze(['hb-tc07-hermes-host', 'hb-tc08-openclaw-orchestration']);
const ARTIFACT_PATHS = Object.freeze([
  '.kstack/decisions/gstack-hermes-openclaw-review-2026-08-28.md',
  '.kstack/decisions/openclaw-hermes-focused-add-2026-08-28.md',
  '.kstack/qualifications/hermes-v2026.8.27-requalification-2026-08-29.md',
  '.kstack/qualifications/hermes-openclaw-release-recheck-2026-08-30.md',
  '.kstack/qualifications/openclaw-v2026.7.1-2-acp-boundary-citations-2026-08-30.md',
  '.kstack/qualifications/host-candidates-2026-08-28.json',
  '.kstack/qualifications/runtime-host-domain-completion-audit.json',
  '.kstack/roadmaps/runtime-maturity-focused-2026-08-28.json'
]);

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function readArtifact(relativePath) {
  if (relativePath.startsWith('.kstack/secrets/')) throw new Error('NEGATIVE_REVIEW_SECRET_PATH_REJECTED');
  const absolute = path.join(sourceRoot, relativePath);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('NEGATIVE_REVIEW_ARTIFACT_REJECTED');
  const bytes = fs.readFileSync(absolute);
  return Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes), contentUtf8: bytes.toString('utf8') });
}

export function buildHostNegativeDispositionReviewPayload() {
  const audit = JSON.parse(fs.readFileSync(path.join(sourceRoot, '.kstack/qualifications/runtime-host-domain-completion-audit.json'), 'utf8'));
  const rows = REVIEW_ITEMS.map((itemId) => {
    const row = audit.hostItems?.find((entry) => entry.itemId === itemId);
    if (!row || row.completionState !== 'UNSUPPORTED_DISPOSITION_REVIEW_PENDING'
        || !row.remainingRequirements.includes('independent-review-of-negative-qualification')
        || !row.remainingRequirements.some((entry) => entry.startsWith('owner-'))
        || !row.remainingRequirements.includes('durable-jira-closure')) throw new Error('NEGATIVE_REVIEW_AUDIT_NOT_READY');
    return row;
  });
  const artifacts = ARTIFACT_PATHS.map(readArtifact);
  const target = canonical({
    schema: 'kstack-host-negative-disposition-target-v1',
    scope: REVIEW_ITEMS,
    rows,
    artifacts: artifacts.map(({ path: artifactPath, bytes, sha256: digest }) => ({ path: artifactPath, bytes, sha256: digest })),
    maximumClaim: 'NEGATIVE_QUALIFICATION_ONLY_NO_HOST_ACTIVATION',
    ownerAuthorityExcluded: true,
    jiraClosureExcluded: true
  });
  const targetDigest = recordDigest(target);
  return Object.freeze({
    schema: 'kstack-host-negative-disposition-independent-review-payload-v1',
    destination: { provider: 'local-claude-cli', model: 'opus', tools: 'none' },
    targetDigest,
    scope: REVIEW_ITEMS,
    primaryReadiness: {
      reviewerFamily: 'codex',
      confidence: 95,
      failedCriteria: 0,
      securityFindings: 0,
      materialDissent: 0,
      readyForIndependentFinalReview: true,
      basis: [
        'exact candidate identities and negative findings are durable',
        'latest official stable-release state was rechecked read-only',
        'no activation or broader host-support claim is requested',
        'owner disposition and Jira Done remain separate post-review gates'
      ]
    },
    decisionThreshold: {
      minimumConfidence: 81,
      approvalRequiresZeroFailedCriteria: true,
      approvalRequiresZeroSecurityFindings: true,
      approvalRequiresZeroMaterialDissent: true,
      reviseAtOrAboveMinimumAcceptedForBugFixIntake: true
    },
    instructions: [
      'Act as the independent final reviewer after the Codex primary assessment reached 95.',
      'Use only the embedded artifacts. Do not inspect files, call tools, use network access, or request credentials.',
      'Review whether the exact Hermes and OpenClaw negative qualifications are evidence-supported, current for stable releases, scoped without overclaim, and sufficient to present the owner with an accept-unsupported versus later-requalification decision.',
      'Do not choose the owner disposition, activate either host, close Jira, or broaden the qualified Host profile.',
      'Return one JSON object only with exactly: schema, reviewer, reviewerFamily, targetDigest, verdict, confidence, failedCriteria, securityFindings, materialDissent, unresolvedQuestions, recommendation, reviewedAt.',
      'Use schema kstack-host-negative-disposition-independent-review-v1, reviewerFamily claude, this exact targetDigest, verdict APPROVE_NEGATIVE_QUALIFICATION or REVISE, integer confidence 0-100, string arrays for failedCriteria, materialDissent, and unresolvedQuestions, securityFindings objects with id/severity/summary, a nonempty recommendation, and an RFC3339 UTC reviewedAt timestamp.',
      'At confidence 81 or higher, APPROVE_NEGATIVE_QUALIFICATION with no findings is clean and REVISE is accepted into implementation with every finding converted to mandatory bug-fix intake. Below 81 is not accepted.'
    ],
    secretBoundary: {
      excludedPrefixes: ['.kstack/secrets/'],
      externalCredentialFilesIncluded: false,
      matcher: MATCHER_VERSION
    },
    target,
    artifacts
  });
}

export function prepareHostNegativeDispositionReview(outFile) {
  if (typeof outFile !== 'string' || !path.isAbsolute(outFile)) throw new Error('NEGATIVE_REVIEW_OUTPUT_INVALID');
  const payload = buildHostNegativeDispositionReviewPayload();
  const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  assertOutboundSecretScan(bytes, { byteDomain: true });
  fs.writeFileSync(outFile, bytes, { flag: 'wx', mode: 0o600 });
  return Object.freeze({
    path: outFile,
    sha256: sha256(bytes),
    bytes: bytes.length,
    targetDigest: payload.targetDigest,
    items: payload.scope.length,
    artifacts: payload.artifacts.length,
    destination: payload.destination,
    primaryConfidence: payload.primaryReadiness.confidence,
    matcher: MATCHER_VERSION
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  const outIndex = process.argv.indexOf('--out');
  if (outIndex < 0 || !process.argv[outIndex + 1] || process.argv.length !== 4) {
    process.stderr.write('usage: prepare-host-negative-disposition-review.mjs --out ABSOLUTE_PATH\n');
    process.exitCode = 2;
  } else {
    try { process.stdout.write(`${JSON.stringify(prepareHostNegativeDispositionReview(process.argv[outIndex + 1]), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
  }
}
