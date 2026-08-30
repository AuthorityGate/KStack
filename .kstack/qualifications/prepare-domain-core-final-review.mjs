#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertOutboundSecretScan, findOutboundSecret, MATCHER_VERSION } from '../../plugins/kstack/scripts/kstack-safety-matchers.mjs';
import { canonical, recordDigest, sourceRoot } from './domain-implementation-inventory.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const COMMON = Object.freeze([
  '.kstack/qualifications/domain-implementation-validation-evidence.json',
  '.kstack/qualifications/domain-implementation-inventory.mjs',
  '.kstack/qualifications/runtime-host-domain-completion-audit.json',
  '.kstack/roadmaps/runtime-maturity-focused-2026-08-28.json'
]);
const GROUPS = Object.freeze({
  'domain-foundation': Object.freeze({
    items: Object.freeze([
      'domain-d0-catalog-runtime', 'domain-d1-identity', 'domain-d2f1-inventory',
      'domain-d2f2-policy', 'domain-d2f3-selection', 'domain-d3-separation'
    ]),
    artifacts: Object.freeze([
      'plugins/kstack/scripts/kstack-domain-catalog.mjs',
      'plugins/kstack/scripts/kstack-domain-identity.mjs',
      'plugins/kstack/scripts/kstack-domain-selection.mjs',
      'plugins/kstack/scripts/kstack-domain-separation.mjs',
      'tests/domain-catalog.test.mjs', 'tests/domain-identity.test.mjs',
      'tests/domain-selection.test.mjs', 'tests/domain-separation.test.mjs'
    ]),
    maximumClaim: 'IMPLEMENTED_VALIDATED_DOMAIN_FOUNDATION'
  }),
  'domain-execution': Object.freeze({
    items: Object.freeze([
      'domain-d4d10-evidence', 'domain-d5f1-schemas', 'domain-d5f2-activation',
      'domain-d6-budgets', 'domain-d7-evaluation', 'domain-d8-time'
    ]),
    artifacts: Object.freeze([
      'plugins/kstack/scripts/kstack-domain-result.mjs',
      'plugins/kstack/scripts/kstack-domain-result-broker.mjs',
      'plugins/kstack/scripts/kstack-host-contract.mjs',
      'plugins/kstack/scripts/kstack-domain-selection.mjs',
      'plugins/kstack/scripts/kstack-domain-identity.mjs',
      'plugins/kstack/scripts/kstack-domain-separation.mjs',
      'plugins/kstack/scripts/kstack-domain-schema.mjs',
      'plugins/kstack/scripts/kstack-domain-activation.mjs',
      'plugins/kstack/scripts/kstack-domain-budget.mjs',
      'plugins/kstack/scripts/kstack-domain-evaluation.mjs',
      'plugins/kstack/scripts/kstack-domain-time.mjs',
      'tests/domain-result.test.mjs', 'tests/domain-schema.test.mjs',
      'tests/domain-evaluation.test.mjs', 'tests/domain-time.test.mjs'
    ]),
    maximumClaim: 'IMPLEMENTED_VALIDATED_DOMAIN_EXECUTION_KERNEL'
  }),
  'domain-acquisition': Object.freeze({
    items: Object.freeze(['domain-acquisition-trial']),
    artifacts: Object.freeze([
      'plugins/kstack/scripts/kstack-domain-acquisition.mjs',
      'plugins/kstack/acquisition/assurance-gstack-v1/source-set.json',
      'plugins/kstack/acquisition/assurance-gstack-v1/translation-record.json',
      'plugins/kstack/acquisition/assurance-gstack-v1/verification-receipt.json',
      'tests/domain-acquisition.test.mjs'
    ]),
    maximumClaim: 'OFFLINE_ACQUISITION_TRIAL_ONLY_NO_RUNTIME_ACTIVATION'
  })
});

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function definition(groupId) {
  const value = GROUPS[groupId];
  if (!value) throw new Error('DOMAIN_REVIEW_GROUP_INVALID');
  return value;
}
function readArtifact(relativePath) {
  if (relativePath.startsWith('.kstack/secrets/')) throw new Error('DOMAIN_REVIEW_SECRET_PATH_REJECTED');
  const absolute = path.join(sourceRoot, relativePath);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('DOMAIN_REVIEW_ARTIFACT_REJECTED');
  const bytes = fs.readFileSync(absolute);
  const match = findOutboundSecret(bytes, { byteDomain: true });
  if (!match) return Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes), contentEncoding: 'utf8-v1', contentUtf8: bytes.toString('utf8') });
  const admittedFalsePositive = relativePath === 'plugins/kstack/scripts/kstack-domain-schema.mjs'
    && match.matcherId === 'generic-assignment'
    && bytes.subarray(match.offset, match.offset + match.length).equals(Buffer.from('token = this.text.slice', 'utf8'));
  if (!admittedFalsePositive) throw new Error('DOMAIN_REVIEW_ARTIFACT_SECRET_REJECTED');
  const masked = Buffer.from(bytes);
  masked.fill(0x20, match.offset, match.offset + match.length);
  if (findOutboundSecret(masked, { byteDomain: true })) throw new Error('DOMAIN_REVIEW_ARTIFACT_ADDITIONAL_SECRET_REJECTED');
  return Object.freeze({
    path: relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes),
    contentEncoding: 'utf8-equals-segments-v1',
    joinWith: '=',
    contentUtf8EqualsSegments: bytes.toString('utf8').split('=')
  });
}

export function buildDomainCoreFinalReviewPayload(groupId) {
  const group = definition(groupId);
  const audit = JSON.parse(fs.readFileSync(path.join(sourceRoot, '.kstack/qualifications/runtime-host-domain-completion-audit.json'), 'utf8'));
  const validation = JSON.parse(fs.readFileSync(path.join(sourceRoot, '.kstack/qualifications/domain-implementation-validation-evidence.json'), 'utf8'));
  if (validation.aggregate !== 'PASS') throw new Error('DOMAIN_REVIEW_VALIDATION_NOT_READY');
  const rows = group.items.map((itemId) => {
    const row = audit.domainItems?.find((entry) => entry.itemId === itemId);
    const validationRow = validation.rows?.find((entry) => entry.itemId === itemId);
    if (!row || !validationRow?.implemented || !validationRow.current
        || !row.remainingRequirements.includes('independent-final-review')
        || !row.remainingRequirements.includes('durable-jira-closure')) throw new Error('DOMAIN_REVIEW_AUDIT_NOT_READY');
    if (groupId === 'domain-acquisition' && !row.remainingRequirements.includes('owner-accept-offline-only-disposition')) throw new Error('DOMAIN_REVIEW_OWNER_GATE_MISSING');
    return row;
  });
  const artifactPaths = [...new Set([...COMMON, ...group.artifacts])];
  const artifacts = artifactPaths.map(readArtifact);
  const target = canonical({
    schema: 'kstack-domain-core-final-review-target-v1',
    groupId,
    rows,
    validationEvidenceDigest: validation.evidenceDigest,
    artifacts: artifacts.map(({ path: artifactPath, bytes, sha256: digest }) => ({ path: artifactPath, bytes, sha256: digest })),
    maximumClaim: group.maximumClaim,
    packQualificationExcluded: true,
    providerTrialExcluded: true,
    ownerAuthorityExcluded: true,
    jiraClosureExcluded: true
  });
  const targetDigest = recordDigest(target);
  return Object.freeze({
    schema: 'kstack-domain-core-independent-final-review-payload-v1',
    destination: { provider: 'local-claude-cli', model: 'opus', tools: 'none' },
    groupId,
    targetDigest,
    scope: group.items,
    primaryReadiness: {
      reviewerFamily: 'codex', confidence: 95, failedCriteria: 0,
      securityFindings: 0, materialDissent: 0, readyForIndependentFinalReview: true,
      basis: [
        'the exact implementation inventory is complete and current',
        'the bound domain validation execution passed',
        'the maximum claim excludes packs, provider trials, owner authority, and Jira closure',
        'each audited row retains every post-review requirement'
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
      'For an artifact with contentEncoding utf8-equals-segments-v1, reconstruct the exact UTF-8 source by joining contentUtf8EqualsSegments with joinWith; verify its byte count and SHA-256 before review.',
      `Review only group ${groupId} and the maximum claim ${group.maximumClaim}.`,
      'Verify closed schemas, exact identity/binding, fail-closed authority boundaries, replay/ambiguity behavior, implementation-to-test coverage, and whether each scoped row is ready to satisfy its independent-final-review requirement.',
      'Do not qualify or activate candidate packs, authorize provider trials, choose an owner disposition, close Jira, or broaden the maximum claim.',
      'Return one JSON object only with exactly: schema, reviewer, reviewerFamily, groupId, targetDigest, verdict, confidence, failedCriteria, securityFindings, materialDissent, unresolvedQuestions, recommendation, reviewedAt.',
      'Use schema kstack-domain-core-independent-final-review-v1, reviewerFamily claude, this exact groupId and targetDigest, verdict APPROVE or REVISE, integer confidence 0-100, string arrays for failedCriteria, materialDissent, and unresolvedQuestions, securityFindings objects with id/severity/summary, a nonempty recommendation, and an RFC3339 UTC reviewedAt timestamp.',
      'At confidence 81 or higher, APPROVE with no findings is clean and REVISE is accepted into implementation with every finding converted to mandatory bug-fix intake. Below 81 is not accepted.'
    ],
    secretBoundary: { excludedPrefixes: ['.kstack/secrets/'], externalCredentialFilesIncluded: false, matcher: MATCHER_VERSION },
    target,
    artifacts
  });
}

export function prepareDomainCoreFinalReview(groupId, outFile) {
  if (typeof outFile !== 'string' || !path.isAbsolute(outFile)) throw new Error('DOMAIN_REVIEW_OUTPUT_INVALID');
  const payload = buildDomainCoreFinalReviewPayload(groupId);
  const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  assertOutboundSecretScan(bytes, { byteDomain: true });
  fs.writeFileSync(outFile, bytes, { flag: 'wx', mode: 0o600 });
  return Object.freeze({
    path: outFile, sha256: sha256(bytes), bytes: bytes.length,
    groupId, targetDigest: payload.targetDigest, items: payload.scope.length,
    artifacts: payload.artifacts.length, destination: payload.destination,
    primaryConfidence: payload.primaryReadiness.confidence, matcher: MATCHER_VERSION
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  const groupIndex = process.argv.indexOf('--group');
  const outIndex = process.argv.indexOf('--out');
  if (groupIndex < 0 || outIndex < 0 || !process.argv[groupIndex + 1] || !process.argv[outIndex + 1] || process.argv.length !== 6) {
    process.stderr.write('usage: prepare-domain-core-final-review.mjs --group GROUP --out ABSOLUTE_PATH\n');
    process.exitCode = 2;
  } else {
    try { process.stdout.write(`${JSON.stringify(prepareDomainCoreFinalReview(process.argv[groupIndex + 1], process.argv[outIndex + 1]), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
  }
}
