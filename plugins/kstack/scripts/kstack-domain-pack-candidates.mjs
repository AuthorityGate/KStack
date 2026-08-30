import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import {
  createD5Artifact,
  packCanonicalBytes,
  packFileSetDigest,
  validatePackBundle
} from './kstack-domain-schema.mjs';
import { freezePackEvaluationCorpus } from './kstack-domain-evaluation.mjs';

export const DOMAIN_PACK_CANDIDATES = Object.freeze({
  assurance: Object.freeze({
    title: 'Assurance', purpose: 'Expose evidence-bound security, privacy, compliance, control, and residual-risk gaps.',
    coverage: Object.freeze(['compliance', 'control-evidence', 'privacy', 'resilience', 'security'])
  }),
  'product-experience': Object.freeze({
    title: 'Product experience', purpose: 'Expose evidence-bound premise, journey, accessibility, content, and experience-validation gaps.',
    coverage: Object.freeze(['accessibility', 'decision-record', 'developer-experience', 'documentation', 'product-premise', 'user-journey'])
  }),
  'release-operations': Object.freeze({
    title: 'Release operations', purpose: 'Expose evidence-bound release readiness, observation, rollback, and incident-handoff gaps without executing effects.',
    coverage: Object.freeze(['health-evidence', 'incident-record', 'release-ledger', 'release-readiness', 'resilience', 'rollback-evidence'])
  }),
  'research-knowledge': Object.freeze({
    title: 'Research knowledge', purpose: 'Expose evidence-bound research scope, source quality, synthesis, contradiction, and decision-use gaps.',
    coverage: Object.freeze(['citation', 'decision-record', 'documentation', 'source-quality', 'synthesis'])
  })
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

async function openedFile(filePath, relativePath) {
  const handle = await fs.open(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1 || before.size > 1_048_576) fail('PACK_CANDIDATE_SOURCE_INVALID');
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
        || before.mtimeNs !== after.mtimeNs || bytes.length !== before.size) fail('PACK_CANDIDATE_SOURCE_INVALID');
    return { relativePath, bytes, regular: true, linkCount: 1, identityStable: true };
  } finally { await handle.close(); }
}

async function atomicWrite(filePath, bytes) {
  const temporary = `${filePath}.candidate-${process.pid}`;
  const handle = await fs.open(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  await fs.rename(temporary, filePath);
}

function parseJson(bytes) {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail('PACK_CANDIDATE_SOURCE_INVALID'); }
}

export async function buildDomainPackCandidate(input) {
  if (!input || Object.keys(input).sort().join(',') !== 'packId,packRoot,write'
      || !DOMAIN_PACK_CANDIDATES[input.packId] || typeof input.packRoot !== 'string'
      || typeof input.write !== 'boolean') fail('PACK_CANDIDATE_INPUT_INVALID');
  const root = path.resolve(input.packRoot, input.packId, '1.0.0');
  const contentSource = await openedFile(path.join(root, 'content.json'), 'content.json');
  const evidenceSource = await openedFile(path.join(root, 'evidence.schema.json'), 'evidence.schema.json');
  const fixtureRoot = path.join(root, 'fixtures');
  const fixtureNames = (await fs.readdir(fixtureRoot)).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  if (fixtureNames.length < 1) fail('PACK_CANDIDATE_SOURCE_INVALID');
  const fixtureFiles = [];
  for (const name of fixtureNames) fixtureFiles.push(await openedFile(path.join(fixtureRoot, name), name));
  const content = createD5Artifact(parseJson(contentSource.bytes));
  const evidence = createD5Artifact(parseJson(evidenceSource.bytes));
  if (content.record.artifactType !== 'kstack-pack-content'
      || evidence.record.artifactType !== 'kstack-pack-evidence-schema') fail('PACK_CANDIDATE_SOURCE_INVALID');
  const canonicalFixtures = fixtureFiles.map((entry) => ({ ...entry, bytes: packCanonicalBytes(parseJson(entry.bytes)) }));
  const fixturesDigest = packFileSetDigest('KSTACK-PACK-FIXTURES-V1', canonicalFixtures);
  const metadata = DOMAIN_PACK_CANDIDATES[input.packId];
  const manifest = createD5Artifact({
    artifactType: 'kstack-pack-manifest', schemaVersion: 1, id: input.packId, version: '1.0.0',
    title: metadata.title, purpose: metadata.purpose, coverage: [...metadata.coverage],
    contentDigest: content.artifactDigest, evidenceSchemaDigest: evidence.artifactDigest,
    fixturesDigest, maxUtf8Bytes: 16_384
  });
  const bundleFiles = [
    { relativePath: 'content.json', bytes: content.canonicalBytes },
    { relativePath: 'evidence.schema.json', bytes: evidence.canonicalBytes },
    ...canonicalFixtures.map((entry) => ({ relativePath: `fixtures/${entry.relativePath}`, bytes: entry.bytes })),
    { relativePath: 'manifest.json', bytes: manifest.canonicalBytes }
  ].sort((left, right) => Buffer.compare(Buffer.from(left.relativePath), Buffer.from(right.relativePath)));
  const orderedFiles = bundleFiles.map((entry) => ({
    relativePath: entry.relativePath, byteLength: entry.bytes.length,
    contentSha256: crypto.createHash('sha256').update(entry.bytes).digest('hex')
  }));
  const index = createD5Artifact({
    artifactType: 'kstack-pack-bundle-index', schemaVersion: 1, packId: input.packId, version: '1.0.0',
    manifestDigest: manifest.artifactDigest, contentDigest: content.artifactDigest,
    evidenceSchemaDigest: evidence.artifactDigest, fixturesDigest, orderedFiles,
    bundleDigestAlgorithm: 'kstack-pack-file-set-v1'
  });
  const result = validatePackBundle({
    manifestBytes: manifest.canonicalBytes, contentBytes: content.canonicalBytes,
    evidenceSchemaBytes: evidence.canonicalBytes, fixtureFiles: canonicalFixtures,
    bundleIndexBytes: index.canonicalBytes
  });
  if (input.write) {
    await atomicWrite(path.join(root, 'content.json'), content.canonicalBytes);
    await atomicWrite(path.join(root, 'evidence.schema.json'), evidence.canonicalBytes);
    for (const fixture of canonicalFixtures) await atomicWrite(path.join(fixtureRoot, fixture.relativePath), fixture.bytes);
    await atomicWrite(path.join(root, 'manifest.json'), manifest.canonicalBytes);
    await atomicWrite(path.join(root, 'bundle.index.json'), index.canonicalBytes);
  }
  return Object.freeze({
    packId: input.packId, bundleDigest: result.bundleDigest, manifestDigest: manifest.artifactDigest,
    contentDigest: content.artifactDigest, evidenceSchemaDigest: evidence.artifactDigest,
    fixturesDigest, bundleIndexDigest: index.artifactDigest, totalBytes: result.totalBytes
  });
}

export async function freezeDomainPackCandidateEvaluation(input) {
  if (!input || Object.keys(input).sort().join(',') !== 'cases,packId,packRoot,plan'
      || !DOMAIN_PACK_CANDIDATES[input.packId] || typeof input.packRoot !== 'string') {
    fail('PACK_EVALUATION_INPUT_INVALID');
  }
  const candidate = await buildDomainPackCandidate({
    packId: input.packId,
    packRoot: input.packRoot,
    write: false
  });
  if (!input.plan || input.plan.candidatePackId !== input.packId
      || input.plan.candidatePackDigest !== candidate.bundleDigest) {
    fail('PACK_EVALUATION_CANDIDATE_MISMATCH');
  }
  const frozenCorpus = freezePackEvaluationCorpus({ plan: input.plan, cases: input.cases });
  return Object.freeze({ candidate, frozenCorpus });
}

async function main() {
  const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
  const packRoot = path.resolve(scriptRoot, '..', 'packs');
  const write = process.argv.includes('--write');
  const output = [];
  for (const packId of Object.keys(DOMAIN_PACK_CANDIDATES).sort()) {
    output.push(await buildDomainPackCandidate({ packId, packRoot, write }));
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
