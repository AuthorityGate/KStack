#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertOutboundSecretScan, findOutboundSecret, MATCHER_VERSION } from '../../plugins/kstack/scripts/kstack-safety-matchers.mjs';
import { sourceRoot } from './host-implementation-inventory.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ARTIFACT_PATHS = Object.freeze([
  '.kstack/qualifications/opencode-goose-second-host-proof-evidence.json',
  '.kstack/qualifications/host-implementation-validation-evidence.json',
  '.kstack/qualifications/opencode-v1.18.25-conformance-evidence.json',
  '.kstack/qualifications/goose-v1.48.0-conformance-evidence.json',
  '.kstack/qualifications/build-opencode-goose-second-host-proof.mjs',
  '.kstack/qualifications/validate-opencode-goose-second-host-proof.mjs',
  'plugins/kstack/scripts/kstack-host-contract.mjs',
  'plugins/kstack/scripts/kstack-second-host-proof.mjs',
  'plugins/kstack/scripts/kstack-opencode-adapter.mjs',
  'plugins/kstack/scripts/kstack-opencode-conformance.mjs',
  'plugins/kstack/scripts/kstack-goose-adapter.mjs',
  'plugins/kstack/scripts/kstack-goose-conformance.mjs',
  'plugins/kstack/install-health-audit-manifest-v1.json',
  'tests/host-contract.test.mjs',
  'tests/opencode-adapter.test.mjs',
  'tests/opencode-conformance.test.mjs',
  'tests/goose-adapter.test.mjs',
  'tests/goose-conformance.test.mjs',
  'tests/goose-protected-conformance.test.mjs',
  'tests/second-host-proof.test.mjs',
  'tests/second-host-proof-evidence.test.mjs',
  'tests/reflexion-architecture-gate.mjs'
]);
const ADMITTED_FALSE_POSITIVES = Object.freeze({
  '.kstack/qualifications/validate-opencode-goose-second-host-proof.mjs': Object.freeze([
    Object.freeze({ matcherId: 'private-key', sha256: 'b73c39b95b1614ca3f3224fd7e19483d1eff977eaf6599517458fdd1db8d80c9' })
  ]),
  'plugins/kstack/scripts/kstack-opencode-adapter.mjs': Object.freeze([
    Object.freeze({ matcherId: 'private-key', sha256: 'b73c39b95b1614ca3f3224fd7e19483d1eff977eaf6599517458fdd1db8d80c9' })
  ]),
  'plugins/kstack/scripts/kstack-goose-adapter.mjs': Object.freeze([
    Object.freeze({ matcherId: 'private-key', sha256: 'b73c39b95b1614ca3f3224fd7e19483d1eff977eaf6599517458fdd1db8d80c9' })
  ]),
  'tests/goose-protected-conformance.test.mjs': Object.freeze([
    Object.freeze({ matcherId: 'private-key', sha256: 'b73c39b95b1614ca3f3224fd7e19483d1eff977eaf6599517458fdd1db8d80c9' })
  ])
});

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function findingKey(finding) { return `${finding.matcherId}:${finding.sha256}`; }

function readArtifact(relativePath) {
  if (relativePath.startsWith('.kstack/secrets/')) throw new Error('FINAL_REVIEW_SECRET_PATH_REJECTED');
  const file = path.join(sourceRoot, relativePath);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('FINAL_REVIEW_ARTIFACT_REJECTED');
  const bytes = fs.readFileSync(file);
  const scanBytes = Buffer.from(bytes);
  const observed = [];
  let finding = findOutboundSecret(scanBytes, { byteDomain: true });
  while (finding) {
    const matched = bytes.subarray(finding.offset, finding.offset + finding.length);
    observed.push({ matcherId: finding.matcherId, sha256: sha256(matched) });
    scanBytes.fill(0x20, finding.offset, finding.offset + finding.length);
    finding = findOutboundSecret(scanBytes, { byteDomain: true });
  }
  const expected = ADMITTED_FALSE_POSITIVES[relativePath] ?? [];
  if (JSON.stringify(observed.map(findingKey).sort()) !== JSON.stringify(expected.map(findingKey).sort())) {
    throw new Error(`FINAL_REVIEW_ARTIFACT_SECRET_REJECTED:${relativePath}`);
  }
  return observed.length > 0
    ? { path: relativePath, bytes: bytes.length, sha256: sha256(bytes), contentEncoding: 'base64-v1', contentBase64: bytes.toString('base64') }
    : { path: relativePath, bytes: bytes.length, sha256: sha256(bytes), contentEncoding: 'utf8-v1', contentUtf8: bytes.toString('utf8') };
}

export function buildHostIntegratedFinalReviewPayload() {
  const proof = JSON.parse(fs.readFileSync(path.join(sourceRoot, ARTIFACT_PATHS[0]), 'utf8'));
  const targetDigest = proof?.finalReview?.targetDigest;
  if (typeof targetDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(targetDigest)
      || proof?.primaryReadinessConfidence < 93 || proof?.finalReview?.receiptPresent !== false) throw new Error('FINAL_REVIEW_TARGET_NOT_READY');
  return {
    schema: 'kstack-host-integrated-independent-final-review-payload-v1',
    destination: { provider: 'local-claude-cli', model: 'opus', tools: 'none' },
    targetDigest,
    scope: 'OpenCode and Goose integrated Host proof for the advisory-public-read-v1 profile only',
    decisionThreshold: {
      minimumConfidence: 81,
      approvalRequiresZeroFailedCriteria: true,
      approvalRequiresZeroSecurityFindings: true,
      approvalRequiresZeroMaterialDissent: true,
      reviseAtOrAboveMinimumAcceptedForBugFixIntake: true
    },
    instructions: [
      'Act as the independent final reviewer after a Codex primary readiness score of 96.',
      'Use only the artifacts embedded in this packet. Do not request or infer credentials, private state, .kstack/secrets, Jira.txt, network data, or repository files outside the packet.',
      'For base64-v1 artifacts, decode contentBase64 and verify the declared byte count and SHA-256 before review.',
      'Verify current artifact bindings, shared-contract preservation, OpenCode/Goose evidence independence, negative cases, fail-closed eligibility, and whether the bounded shared profile is genuinely qualified.',
      'Return one JSON object only with exactly: schema, reviewer, reviewerFamily, targetDigest, verdict, confidence, failedCriteria, securityFindings, materialDissent, unresolvedQuestions, recommendation, reviewedAt.',
      'Use schema kstack-host-integrated-independent-final-review-v1, reviewerFamily claude, this exact targetDigest, verdict APPROVE or REVISE, integer confidence 0-100, string arrays for failedCriteria, materialDissent, and unresolvedQuestions, securityFindings objects with id/severity/summary, a nonempty recommendation, and an RFC3339 UTC reviewedAt timestamp.',
      'At confidence 81 or higher, APPROVE with no findings is clean and REVISE is accepted into implementation with every finding converted to mandatory bug-fix intake. Below 81 is not accepted. Do not include reviewDigest; KStack will add it locally.'
    ],
    secretBoundary: {
      excludedPrefixes: ['.kstack/secrets/'],
      externalCredentialFilesIncluded: false,
      matcher: MATCHER_VERSION
    },
    artifacts: ARTIFACT_PATHS.map(readArtifact)
  };
}

export function prepareHostIntegratedFinalReview(outFile) {
  if (typeof outFile !== 'string' || !path.isAbsolute(outFile)) throw new Error('FINAL_REVIEW_OUTPUT_INVALID');
  const payload = buildHostIntegratedFinalReviewPayload();
  const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  assertOutboundSecretScan(bytes, { byteDomain: true });
  fs.writeFileSync(outFile, bytes, { flag: 'wx', mode: 0o600 });
  return Object.freeze({
    path: outFile,
    sha256: sha256(bytes),
    bytes: bytes.length,
    targetDigest: payload.targetDigest,
    artifacts: payload.artifacts.length,
    destination: payload.destination,
    matcher: MATCHER_VERSION
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  const outIndex = process.argv.indexOf('--out');
  if (outIndex < 0 || !process.argv[outIndex + 1] || process.argv.length !== 4) {
    process.stderr.write('usage: prepare-host-integrated-final-review.mjs --out ABSOLUTE_PATH\n');
    process.exitCode = 2;
  } else {
    try { process.stdout.write(`${JSON.stringify(prepareHostIntegratedFinalReview(process.argv[outIndex + 1]), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
  }
}
