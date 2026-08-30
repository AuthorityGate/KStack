#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertOutboundSecretScan,
  findOutboundSecret,
  MATCHER_VERSION
} from '../../plugins/kstack/scripts/kstack-safety-matchers.mjs';
import {
  canonical,
  HOST_IMPLEMENTATION_INVENTORY,
  recordDigest,
  sourceRoot
} from './host-implementation-inventory.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const COMMON = Object.freeze([
  '.kstack/qualifications/host-implementation-validation-evidence.json',
  '.kstack/qualifications/host-implementation-inventory.mjs',
  '.kstack/qualifications/runtime-host-domain-completion-audit.json',
  '.kstack/roadmaps/runtime-maturity-focused-2026-08-28.json'
]);
const GROUPS = Object.freeze({
  'host-portability-identity': Object.freeze({
    rows: Object.freeze([
      ['hp-tc01-schemas', 'HP-TC01'],
      ['hp-tc02-request-context', 'HP-TC02'],
      ['hp-tc03-replay-time', 'HP-TC03'],
      ['hp-tc04-evidence-selection', 'HP-TC04']
    ]),
    maximumClaim: 'IMPLEMENTED_VALIDATED_HOST_PORTABILITY_IDENTITY'
  }),
  'host-portability-governance': Object.freeze({
    rows: Object.freeze([
      ['hp-tc05-eligibility-quarantine', 'HP-TC05'],
      ['hp-tc06-harness-bypass', 'HP-TC06'],
      ['hp-tc07-structural-broker', 'HP-TC07'],
      ['hp-tc08-race-mutation', 'HP-TC08']
    ]),
    maximumClaim: 'IMPLEMENTED_VALIDATED_HOST_PORTABILITY_GOVERNANCE'
  }),
  'host-portability-lifecycle': Object.freeze({
    rows: Object.freeze([
      ['hp-tc09-mcp-boundary', 'HP-TC09'],
      ['hp-tc10-receipt-trust', 'HP-TC10'],
      ['hp-tc11-leases-activation', 'HP-TC11'],
      ['hp-tc12-migrations-rollout', 'HP-TC12']
    ]),
    maximumClaim: 'IMPLEMENTED_VALIDATED_HOST_PORTABILITY_LIFECYCLE'
  }),
  'host-breadth-package': Object.freeze({
    rows: Object.freeze([
      ['hb-tc01-canonical-package', 'HB-TC01'],
      ['hb-tc02-installer', 'HB-TC02'],
      ['hb-tc03-opencode-package', 'HB-TC03']
    ]),
    maximumClaim: 'IMPLEMENTED_VALIDATED_HOST_BREADTH_PACKAGE'
  }),
  'host-breadth-facade-conformance': Object.freeze({
    rows: Object.freeze([
      ['hb-tc04-readonly-mcp', 'HB-TC04'],
      ['hb-tc05-opencode-conformance', 'HB-TC05']
    ]),
    maximumClaim: 'IMPLEMENTED_VALIDATED_HOST_BREADTH_FACADE_CONFORMANCE'
  }),
  'host-portability': Object.freeze({
    rows: Object.freeze([
      ['hp-tc01-schemas', 'HP-TC01'],
      ['hp-tc02-request-context', 'HP-TC02'],
      ['hp-tc03-replay-time', 'HP-TC03'],
      ['hp-tc04-evidence-selection', 'HP-TC04'],
      ['hp-tc05-eligibility-quarantine', 'HP-TC05'],
      ['hp-tc06-harness-bypass', 'HP-TC06'],
      ['hp-tc07-structural-broker', 'HP-TC07'],
      ['hp-tc08-race-mutation', 'HP-TC08'],
      ['hp-tc09-mcp-boundary', 'HP-TC09'],
      ['hp-tc10-receipt-trust', 'HP-TC10'],
      ['hp-tc11-leases-activation', 'HP-TC11'],
      ['hp-tc12-migrations-rollout', 'HP-TC12']
    ]),
    maximumClaim: 'IMPLEMENTED_VALIDATED_HOST_PORTABILITY_KERNEL'
  }),
  'host-breadth-foundation': Object.freeze({
    rows: Object.freeze([
      ['hb-tc01-canonical-package', 'HB-TC01'],
      ['hb-tc02-installer', 'HB-TC02'],
      ['hb-tc03-opencode-package', 'HB-TC03'],
      ['hb-tc04-readonly-mcp', 'HB-TC04'],
      ['hb-tc05-opencode-conformance', 'HB-TC05']
    ]),
    maximumClaim: 'IMPLEMENTED_VALIDATED_HOST_BREADTH_FOUNDATION'
  })
});
const ADMITTED_FALSE_POSITIVES = Object.freeze({
  'plugins/kstack/scripts/kstack-host-replay-store.mjs': Object.freeze([
    Object.freeze({ matcherId: 'generic-assignment', sha256: '105e8684a1628c4ff632535c911f12c1a0d2f5d84a47ced7ca8d0fd49d78f1aa' })
  ]),
  'plugins/kstack/scripts/kstack-host-package.mjs': Object.freeze([
    Object.freeze({ matcherId: 'generic-assignment', sha256: 'f031e5b2ecc040bcedce65c3f24fe0b5eeb11495f5221a838201fd50b2734990' }),
    Object.freeze({ matcherId: 'generic-assignment', sha256: 'ddddf26116b75479b359760b7960cebf836f887c36ac0d724405a306081a7238' })
  ]),
  'plugins/kstack/scripts/kstack-mcp-boundary.mjs': Object.freeze([
    Object.freeze({ matcherId: 'generic-assignment', sha256: 'b7074f29e98f3894a5847567f8ac3953aabf4a364c66ddcc35502970fe08750e' })
  ]),
  'plugins/kstack/scripts/kstack-opencode-adapter.mjs': Object.freeze([
    Object.freeze({ matcherId: 'private-key', sha256: 'b73c39b95b1614ca3f3224fd7e19483d1eff977eaf6599517458fdd1db8d80c9' })
  ]),
  'plugins/kstack/scripts/kstack-opencode-candidate.mjs': Object.freeze([
    Object.freeze({ matcherId: 'generic-assignment', sha256: '4b0793fb0eea6ce7df403698341cb1b9deed9cae7ceaf336aea89cb90de921f4' })
  ]),
  'tests/host-package.test.mjs': Object.freeze([
    Object.freeze({ matcherId: 'generic-assignment', sha256: '4db5afc31bba8121a357b0fdcff50753655b25c890ad7b5283c57d2c982ce045' })
  ]),
  'tests/host-replay.test.mjs': Object.freeze([
    Object.freeze({ matcherId: 'generic-assignment', sha256: 'd7ffadb62ccc33f5bd4cf7cad82a9d7a71d5faeda58cf78ab427d4b0b8fdcf16' })
  ]),
  'tests/mcp-boundary.test.mjs': Object.freeze([
    Object.freeze({ matcherId: 'generic-assignment', sha256: '5d4b010e2dea5ac05adb0b50e4faab86ef867084d28209727fbc272a56873a56' }),
    Object.freeze({ matcherId: 'generic-assignment', sha256: 'd3cb73f9b7d9f51bcefd77c3889a14c2a563d1fbbebd38c0072801c2ef90d7b7' })
  ]),
  'tests/mcp-facade.test.mjs': Object.freeze([
    Object.freeze({ matcherId: 'generic-assignment', sha256: 'fbfedc1cbecd1709243d5062285a8f789094bfb12cf3db354f1092dbf8009049' }),
    Object.freeze({ matcherId: 'generic-assignment', sha256: 'fc721ed469f811a9e71cd0fc312679c32c507483a7604879b5506bf49d8a1701' })
  ]),
  'tests/opencode-candidate.test.mjs': Object.freeze([
    Object.freeze({ matcherId: 'generic-assignment', sha256: '88efbbe73db1792d7712861ebc17ea00347bec6e038a2e8bd309b8a8667fde01' }),
    Object.freeze({ matcherId: 'generic-assignment', sha256: 'b9736a0b8ee957ef7a2a4a15e23da66a796608012ab9579300a62d01578b157b' }),
    Object.freeze({ matcherId: 'generic-assignment', sha256: '88efbbe73db1792d7712861ebc17ea00347bec6e038a2e8bd309b8a8667fde01' }),
    Object.freeze({ matcherId: 'generic-assignment', sha256: 'b9736a0b8ee957ef7a2a4a15e23da66a796608012ab9579300a62d01578b157b' }),
    Object.freeze({ matcherId: 'generic-assignment', sha256: 'a2e58fd092f576f201132b0d4eab0f5eb28d2194d6b32a4fc5dd1dd21d3ec522' })
  ]),
  'tests/opencode-protected-conformance.test.mjs': Object.freeze([
    Object.freeze({ matcherId: 'private-key', sha256: 'b73c39b95b1614ca3f3224fd7e19483d1eff977eaf6599517458fdd1db8d80c9' })
  ])
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function findingKey(finding) {
  return `${finding.matcherId}:${finding.sha256}`;
}

function definition(groupId) {
  const value = GROUPS[groupId];
  if (!value) throw new Error('HOST_CORE_REVIEW_GROUP_INVALID');
  return value;
}

function artifactPaths(group) {
  const inventory = new Map(HOST_IMPLEMENTATION_INVENTORY.map((row) => [row.itemId, row]));
  const paths = new Set(COMMON);
  for (const [, validationItemId] of group.rows) {
    const row = inventory.get(validationItemId);
    if (!row) throw new Error('HOST_CORE_REVIEW_INVENTORY_MISSING');
    for (const relativePath of [
      ...row.implementationFiles,
      ...row.validationFiles,
      ...row.validationSupportFiles
    ]) paths.add(relativePath);
  }
  return [...paths];
}

function readArtifact(relativePath) {
  if (relativePath.startsWith('.kstack/secrets/') || relativePath.endsWith('Jira.txt')) {
    throw new Error('HOST_CORE_REVIEW_SECRET_PATH_REJECTED');
  }
  const absolute = path.join(sourceRoot, relativePath);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('HOST_CORE_REVIEW_ARTIFACT_REJECTED');
  const bytes = fs.readFileSync(absolute);
  const scanBytes = Buffer.from(bytes);
  let match = findOutboundSecret(scanBytes, { byteDomain: true });
  if (match) {
    const observed = [];
    while (match) {
      const matched = bytes.subarray(match.offset, match.offset + match.length);
      observed.push({ matcherId: match.matcherId, sha256: sha256(matched) });
      scanBytes.fill(0x20, match.offset, match.offset + match.length);
      match = findOutboundSecret(scanBytes, { byteDomain: true });
    }
    const expected = ADMITTED_FALSE_POSITIVES[relativePath] ?? [];
    const observedKeys = observed.map(findingKey).sort();
    const expectedKeys = expected.map(findingKey).sort();
    if (JSON.stringify(canonical(observedKeys)) !== JSON.stringify(canonical(expectedKeys))) {
      throw new Error(`HOST_CORE_REVIEW_ARTIFACT_SECRET_REJECTED:${relativePath}`);
    }
    return Object.freeze({
      path: relativePath,
      bytes: bytes.length,
      sha256: sha256(bytes),
      contentEncoding: 'base64-v1',
      contentBase64: bytes.toString('base64')
    });
  }
  return Object.freeze({
    path: relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes),
    contentEncoding: 'utf8-v1',
    contentUtf8: bytes.toString('utf8')
  });
}

export function buildHostCoreFinalReviewPayload(groupId) {
  const group = definition(groupId);
  const audit = JSON.parse(fs.readFileSync(path.join(sourceRoot, '.kstack/qualifications/runtime-host-domain-completion-audit.json'), 'utf8'));
  const validation = JSON.parse(fs.readFileSync(path.join(sourceRoot, '.kstack/qualifications/host-implementation-validation-evidence.json'), 'utf8'));
  if (validation.aggregate !== 'PASS') throw new Error('HOST_CORE_REVIEW_VALIDATION_NOT_READY');
  const rows = group.rows.map(([auditItemId, validationItemId]) => {
    const auditRow = audit.hostItems?.find((entry) => entry.itemId === auditItemId);
    const validationRow = validation.rows?.find((entry) => entry.itemId === validationItemId);
    if (!auditRow || !validationRow?.implemented || !validationRow.current
        || auditRow.completionState !== 'INDEPENDENT_FINAL_REVIEW_PENDING'
        || !auditRow.remainingRequirements.includes('independent-final-review')
        || !auditRow.remainingRequirements.includes('durable-jira-closure')) {
      throw new Error('HOST_CORE_REVIEW_AUDIT_NOT_READY');
    }
    return auditRow;
  });
  const artifacts = artifactPaths(group).map(readArtifact);
  const target = canonical({
    schema: 'kstack-host-core-final-review-target-v1',
    groupId,
    rows,
    validationEvidenceDigest: validation.evidenceDigest,
    artifacts: artifacts.map(({ path: artifactPath, bytes, sha256: digest }) => ({
      path: artifactPath, bytes, sha256: digest
    })),
    maximumClaim: group.maximumClaim,
    externalPlatformQualificationExcluded: true,
    hostAdmissionExcluded: true,
    ownerAuthorityExcluded: true,
    jiraClosureExcluded: true
  });
  const targetDigest = recordDigest(target);
  return Object.freeze({
    schema: 'kstack-host-core-independent-final-review-payload-v1',
    destination: { provider: 'local-claude-cli', model: 'opus', tools: 'none' },
    groupId,
    targetDigest,
    scope: group.rows.map(([auditItemId]) => auditItemId),
    primaryReadiness: {
      reviewerFamily: 'codex',
      confidence: 95,
      failedCriteria: 0,
      securityFindings: 0,
      materialDissent: 0,
      readyForIndependentFinalReview: true,
      basis: [
        'the exact implementation inventory is complete and current',
        'the bound Host validation execution passed',
        'the maximum claim excludes external platform qualification, host admission, owner authority, and Jira closure',
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
      'For an artifact with contentEncoding base64-v1, decode contentBase64 to the exact source bytes and verify its byte count and SHA-256 before review.',
      `Review only group ${groupId} and maximum claim ${group.maximumClaim}.`,
      'Verify closed schemas, canonical identity and binding, fail-closed authority boundaries, replay and ambiguity behavior, implementation-to-test coverage, and whether every scoped row satisfies its independent-final-review requirement.',
      'Do not qualify external platform cells, admit a Host candidate, grant owner authority, close Jira, or broaden the maximum claim.',
      'Return one JSON object only with exactly: schema, reviewer, reviewerFamily, groupId, targetDigest, verdict, confidence, failedCriteria, securityFindings, materialDissent, unresolvedQuestions, recommendation, reviewedAt.',
      'Use schema kstack-host-core-independent-final-review-v1, reviewerFamily claude, this exact groupId and targetDigest, verdict APPROVE or REVISE, integer confidence 0-100, string arrays for failedCriteria, materialDissent, and unresolvedQuestions, securityFindings objects with id/severity/summary, a nonempty recommendation, and an RFC3339 UTC reviewedAt timestamp.',
      'At confidence 81 or higher, APPROVE with no findings is clean and REVISE is accepted into implementation with every finding converted to mandatory bug-fix intake. Below 81 is not accepted.'
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

export function prepareHostCoreFinalReview(groupId, outFile) {
  if (typeof outFile !== 'string' || !path.isAbsolute(outFile)) throw new Error('HOST_CORE_REVIEW_OUTPUT_INVALID');
  const payload = buildHostCoreFinalReviewPayload(groupId);
  const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  assertOutboundSecretScan(bytes, { byteDomain: true });
  fs.writeFileSync(outFile, bytes, { flag: 'wx', mode: 0o600 });
  return Object.freeze({
    path: outFile,
    sha256: sha256(bytes),
    bytes: bytes.length,
    groupId,
    targetDigest: payload.targetDigest,
    items: payload.scope.length,
    artifacts: payload.artifacts.length,
    destination: payload.destination,
    primaryConfidence: payload.primaryReadiness.confidence,
    matcher: MATCHER_VERSION
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  const groupIndex = process.argv.indexOf('--group');
  const outIndex = process.argv.indexOf('--out');
  if (groupIndex < 0 || outIndex < 0 || !process.argv[groupIndex + 1]
      || !process.argv[outIndex + 1] || process.argv.length !== 6) {
    process.stderr.write('usage: prepare-host-core-final-review.mjs --group GROUP --out ABSOLUTE_PATH\n');
    process.exitCode = 2;
  } else {
    try {
      process.stdout.write(`${JSON.stringify(prepareHostCoreFinalReview(
        process.argv[groupIndex + 1], process.argv[outIndex + 1]
      ), null, 2)}\n`);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 2;
    }
  }
}
