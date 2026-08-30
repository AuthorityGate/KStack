import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DOMAIN_PACK_CANDIDATES,
  buildDomainPackCandidate,
  freezeDomainPackCandidateEvaluation
} from '../plugins/kstack/scripts/kstack-domain-pack-candidates.mjs';
import {
  DOMAIN_EVALUATION_PROFILES,
  EVALUATION_CONDITIONS,
  evaluationProfileDigest
} from '../plugins/kstack/scripts/kstack-domain-evaluation.mjs';
import { createD5Artifact, parseD5Artifact } from '../plugins/kstack/scripts/kstack-domain-schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packRoot = path.join(root, 'plugins', 'kstack', 'packs');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function evaluationPlan(packId, candidatePackDigest) {
  return {
    artifactType: 'kstack-evaluation-plan', schemaVersion: 2,
    candidatePackId: packId, candidatePackDigest, candidatePackAuthorIds: ['pack-author'],
    evaluationProfileDigest: evaluationProfileDigest(packId),
    planDigest: sha(Buffer.from(`${packId}:plan`)),
    adjudicationGuideDigest: sha(Buffer.from(`${packId}:guide`)),
    executionCodeDigest: sha(Buffer.from('execution-code')),
    analysisCodeDigest: sha(Buffer.from('analysis-code')),
    conditionPromptDigests: Object.fromEntries(EVALUATION_CONDITIONS
      .map((condition) => [condition, sha(Buffer.from(`${packId}:prompt:${condition}`))])),
    providerId: 'provider', modelId: 'model-v1', parametersDigest: sha(Buffer.from('parameters')),
    responseSchemaDigest: sha(Buffer.from('response-schema')), responseReserveTokens: 512,
    baseSixLaneDigest: sha(Buffer.from('base-six-lanes')),
    randomizationSeedDigest: sha(Buffer.from(`${packId}:randomization-seed`))
  };
}

function evaluationCases(packId) {
  const profile = DOMAIN_EVALUATION_PROFILES[packId];
  const crossCutKeys = Object.keys(profile.crossCutValues).sort();
  return profile.criticalStrata.flatMap((criticalStratum, stratumIndex) => Array.from({ length: 60 }, (_, row) => {
    const index = stratumIndex * 60 + row;
    return {
      caseId: `case-${String(index).padStart(3, '0')}`,
      criticalStratum,
      crossCuts: Object.fromEntries(crossCutKeys.map((key) => [key, profile.crossCutValues[key][row % 2]])),
      sourceDigest: sha(Buffer.from(`${packId}:source:${index}`)),
      authorId: `${packId}-case-author-${index}`,
      heldOutFromPackAuthors: row < 15,
      goldGaps: [{
        gapId: `gap-${index}`, severity: row === 0 ? 'critical' : 'high',
        acceptanceCriteriaDigest: sha(Buffer.from(`${packId}:accept:${index}`)),
        supportingSourceIds: [`source-${index}`], laneOwnership: 'shared', critical: row === 0
      }]
    };
  }));
}

function collectKeys(value, output = []) {
  if (Array.isArray(value)) for (const child of value) collectKeys(child, output);
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    output.push(key); collectKeys(child, output);
  }
  return output;
}

test('each governed pack candidate is an independently digest-bound canonical D5 bundle', async () => {
  const results = [];
  for (const packId of Object.keys(DOMAIN_PACK_CANDIDATES).sort()) {
    const result = await buildDomainPackCandidate({ packId, packRoot, write: false });
    results.push(result);
    assert.ok(result.totalBytes <= 8_388_608);
    const directory = path.join(packRoot, packId, '1.0.0');
    const manifestBytes = await fs.readFile(path.join(directory, 'manifest.json'));
    const indexBytes = await fs.readFile(path.join(directory, 'bundle.index.json'));
    assert.equal(parseD5Artifact(manifestBytes, 'kstack-pack-manifest').artifactDigest, result.manifestDigest);
    assert.equal(parseD5Artifact(indexBytes, 'kstack-pack-bundle-index').artifactDigest, result.bundleIndexDigest);
  }
  assert.equal(new Set(results.map((entry) => entry.bundleDigest)).size, 4);
  assert.equal(new Set(results.map((entry) => entry.contentDigest)).size, 4);
});

test('pack candidates contain reasoning/evidence only and cannot smuggle runtime authority', async () => {
  const forbidden = new Set([
    'tools', 'authorityNeeds', 'commands', 'networkDestinations', 'credentials',
    'providerId', 'modelId', 'reviewers', 'thresholds', 'permissions'
  ]);
  for (const packId of Object.keys(DOMAIN_PACK_CANDIDATES)) {
    const directory = path.join(packRoot, packId, '1.0.0');
    for (const file of ['content.json', 'evidence.schema.json', 'manifest.json']) {
      const value = JSON.parse(await fs.readFile(path.join(directory, file), 'utf8'));
      assert.deepEqual(collectKeys(value).filter((key) => forbidden.has(key)), []);
    }
  }
  const content = JSON.parse(await fs.readFile(path.join(packRoot, 'release-operations', '1.0.0', 'content.json'), 'utf8'));
  assert.throws(() => createD5Artifact({ ...content, tools: ['deploy'] }),
    (error) => error?.code === 'PACK_CONTENT_INVALID');
});

test('candidate regeneration is byte-stable and never activates or executes a pack', async () => {
  const first = await Promise.all(Object.keys(DOMAIN_PACK_CANDIDATES).sort()
    .map((packId) => buildDomainPackCandidate({ packId, packRoot, write: false })));
  const second = await Promise.all(Object.keys(DOMAIN_PACK_CANDIDATES).sort()
    .map((packId) => buildDomainPackCandidate({ packId, packRoot, write: false })));
  assert.deepEqual(first, second);
  assert.equal(Object.keys(DOMAIN_PACK_CANDIDATES).some((key) => /activate|execute/u.test(key)), false);
});

test('every evaluation corpus is bound to the exact checked-in candidate bundle and pack profile', async () => {
  for (const packId of Object.keys(DOMAIN_PACK_CANDIDATES).sort()) {
    const candidate = await buildDomainPackCandidate({ packId, packRoot, write: false });
    const result = await freezeDomainPackCandidateEvaluation({
      packId,
      packRoot,
      plan: evaluationPlan(packId, candidate.bundleDigest),
      cases: evaluationCases(packId)
    });
    assert.equal(result.candidate.bundleDigest, candidate.bundleDigest);
    assert.equal(result.frozenCorpus.plan.candidatePackId, packId);
    assert.equal(result.frozenCorpus.plan.candidatePackDigest, candidate.bundleDigest);
    assert.equal(result.frozenCorpus.cases.length, 300);
  }

  const assurance = await buildDomainPackCandidate({ packId: 'assurance', packRoot, write: false });
  const drifted = evaluationPlan('assurance', assurance.bundleDigest);
  drifted.candidatePackDigest = sha(Buffer.from('substituted-candidate'));
  await assert.rejects(() => freezeDomainPackCandidateEvaluation({
    packId: 'assurance', packRoot, plan: drifted, cases: evaluationCases('assurance')
  }), (error) => error?.code === 'PACK_EVALUATION_CANDIDATE_MISMATCH');
});
