import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsConstants from 'node:fs';
import path from 'node:path';
import { packCanonicalBytes } from './kstack-domain-schema.mjs';

export const ACQUISITION_LICENSE_ALLOWLIST = Object.freeze([
  'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0', 'ISC', 'MIT'
]);
export const DIRECT_RUNTIME_ACQUISITION_ALLOWED = false;
const DIGEST = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const ID = /^[a-z][a-z0-9._-]{0,127}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u;
const MATERIAL_KINDS = Object.freeze(['checklist', 'fixture', 'question', 'schema', 'taxonomy', 'template']);
const VERIFIED_SOURCE_SETS = new WeakSet();
const TRANSLATIONS = new WeakSet();

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function compare(left, right) { return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8')); }
function exact(value, keys, code) {
  const actual = plain(value) ? Object.keys(value).sort(compare) : [];
  const expected = [...keys].sort(compare);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}
function text(value, expression, code, maximum = 256) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !value.isWellFormed()
      || value.normalize('NFC') !== value || !expression.test(value)) fail(code);
  return value;
}
function digest(value, code) { return text(value, DIGEST, code, 64); }
function integer(value, minimum, maximum, code) { if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code); return value; }
function basisPoints(value, code) {
  const scaled = value * 10_000;
  if (!Number.isSafeInteger(scaled)) fail(code);
  return scaled;
}
function bool(value, code) { if (typeof value !== 'boolean') fail(code); return value; }
function immutable(value) { if (value && typeof value === 'object') { for (const child of Object.values(value)) immutable(child); Object.freeze(value); } return value; }
function sortedUnique(values, allowed, code) {
  if (!Array.isArray(values) || values.length < 1 || values.length > allowed.length || values.some((value) => !allowed.includes(value))) fail(code);
  if (new Set(values).size !== values.length || values.some((value, index) => index > 0 && compare(values[index - 1], value) >= 0)) fail(code);
  return [...values];
}
function sourcePath(value, code) {
  text(value, /^[\x20-\x7e]{1,240}$/u, code, 240);
  if (value.startsWith('/') || value.includes('\\') || value.split('/').some((part) => !part || part === '.' || part === '..')
      || path.posix.normalize(value) !== value) fail(code);
  return value;
}
function domainDigest(domain, value) { return crypto.createHash('sha256').update(Buffer.from(`${domain}\n`)).update(packCanonicalBytes(value)).digest('hex'); }

export const APPROVED_ASSURANCE_SOURCE_SET_V1 = immutable({
  artifactType: 'kstack-domain-acquisition-source-set', schemaVersion: 1,
  repository: 'garrytan/gstack', commit: 'ad8400543cd9ce8d07641362db48d44a95417e33',
  license: { spdxId: 'MIT', rootLicenseDigest: 'e56fbb5b3d95756f3fa1cfefa24732ec79f18ece1ad08a4e79e00df57e8b198c', byteLength: 1066 },
  allowedMaterialKinds: ['checklist', 'fixture', 'question', 'schema', 'taxonomy', 'template'],
  directRuntimeLoadingProhibited: true,
  entries: [
    { path: 'review/specialists/api-contract.md', sha256: '263d23ac119dd601d315c191dbdbd503d47c00264c9c0ca81959559ca11d4e95', byteLength: 2357 },
    { path: 'review/specialists/data-migration.md', sha256: 'b6fd9eb229002ea598f8fe9ff53b1cd8821e3bd37a7aa7b07b5526556c71ebca', byteLength: 2306 },
    { path: 'review/specialists/maintainability.md', sha256: '7d945a69e0763fd1be26ffdff65f1088cab555d80630ed4ad44313e5e6623036', byteLength: 2325 },
    { path: 'review/specialists/performance.md', sha256: '545c294ae53638b4c8524e8cde08246a4ce3b5c287ec7c44e27f5556a3b0e8cc', byteLength: 2618 },
    { path: 'review/specialists/red-team.md', sha256: '9ea05149f5b13d6a19ecec26285142d09d259cf80a515af828abdd1f43320427', byteLength: 2258 },
    { path: 'review/specialists/security.md', sha256: 'd0dc1cf0f1c7450507cfc663a67624cbcd5d4cfd0258a3bfeb51dba6f09c7df2', byteLength: 3025 },
    { path: 'review/specialists/testing.md', sha256: '3fd6dc5d802fd112f75934c4c168c3f03e25275b70e1e403eb670cbf7447e4e7', byteLength: 2226 }
  ]
});

export function validateAcquisitionSourceSet(input) {
  const code = 'KSTACK_ACQUISITION_SOURCE_SET_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'repository', 'commit', 'license', 'allowedMaterialKinds', 'directRuntimeLoadingProhibited', 'entries'], code);
  if (input.artifactType !== 'kstack-domain-acquisition-source-set' || input.schemaVersion !== 1 || input.directRuntimeLoadingProhibited !== true) fail(code);
  exact(input.license, ['spdxId', 'rootLicenseDigest', 'byteLength'], code);
  if (!ACQUISITION_LICENSE_ALLOWLIST.includes(input.license.spdxId)) fail(code);
  const license = { spdxId: input.license.spdxId, rootLicenseDigest: digest(input.license.rootLicenseDigest, code), byteLength: integer(input.license.byteLength, 1, 1_048_576, code) };
  if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 64) fail(code);
  const entries = input.entries.map((entry) => {
    exact(entry, ['path', 'sha256', 'byteLength'], code);
    return { path: sourcePath(entry.path, code), sha256: digest(entry.sha256, code), byteLength: integer(entry.byteLength, 1, 1_048_576, code) };
  });
  if (new Set(entries.map((entry) => entry.path)).size !== entries.length
      || entries.some((entry, index) => index > 0 && compare(entries[index - 1].path, entry.path) >= 0)) fail(code);
  const record = immutable({
    artifactType: input.artifactType, schemaVersion: 1, repository: text(input.repository, REPOSITORY, code),
    commit: text(input.commit, COMMIT, code, 40), license,
    allowedMaterialKinds: sortedUnique(input.allowedMaterialKinds, MATERIAL_KINDS, code),
    directRuntimeLoadingProhibited: true, entries
  });
  return immutable({ record, sourceSetDigest: domainDigest('KSTACK-DOMAIN-ACQUISITION-SOURCE-SET-V1', record) });
}

export function assertApprovedAssuranceSourceSet(input) {
  const validated = validateAcquisitionSourceSet(input);
  if (!packCanonicalBytes(validated.record).equals(packCanonicalBytes(APPROVED_ASSURANCE_SOURCE_SET_V1))) fail('KSTACK_ACQUISITION_SOURCE_NOT_APPROVED');
  return validated;
}

function trustedDirectory(stat, code) {
  const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
  if (!stat.isDirectory() || stat.isSymbolicLink() || !owned || (stat.mode & 0o022) !== 0) fail(code);
}

async function directoryChain(root, relativePath, code) {
  const parts = relativePath.split('/').slice(0, -1);
  const directories = [root];
  for (let index = 1; index <= parts.length; index += 1) directories.push(path.join(root, ...parts.slice(0, index)));
  const result = [];
  for (const directory of directories) {
    const stat = await fs.lstat(directory).catch(() => fail(code));
    trustedDirectory(stat, code);
    result.push({ directory, dev: stat.dev, ino: stat.ino });
  }
  return result;
}

async function openedExactFile(root, relativePath, expectedDigest, expectedLength, code) {
  const absolute = path.resolve(root, ...relativePath.split('/'));
  if (absolute !== path.join(root, ...relativePath.split('/')) || !absolute.startsWith(`${root}${path.sep}`)) fail(code);
  const beforeDirectories = await directoryChain(root, relativePath, code);
  const before = await fs.lstat(absolute).catch(() => fail(code));
  if (!before.isFile() || before.isSymbolicLink()) fail(code);
  const handle = await fs.open(absolute, fsConstants.constants.O_RDONLY | (fsConstants.constants.O_NOFOLLOW ?? 0)).catch(() => fail(code));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== expectedLength) fail(code);
    const bytes = await handle.readFile();
    if (bytes.length !== expectedLength || crypto.createHash('sha256').update(bytes).digest('hex') !== expectedDigest) fail(code);
  } finally { await handle.close(); }
  const afterDirectories = await directoryChain(root, relativePath, code);
  if (afterDirectories.some((entry, index) => entry.directory !== beforeDirectories[index].directory
      || entry.dev !== beforeDirectories[index].dev || entry.ino !== beforeDirectories[index].ino)) fail(code);
}

export async function verifyOfflineAcquisitionSource(input) {
  const code = 'KSTACK_ACQUISITION_OFFLINE_VERIFICATION_FAILED';
  exact(input, ['sourceRoot', 'sourceSet'], code);
  const sourceSet = assertApprovedAssuranceSourceSet(input.sourceSet);
  const sourceRoot = path.resolve(text(input.sourceRoot, /^[^\u0000-\u001f\u007f]{1,4096}$/u, code, 4096));
  const rootStat = await fs.lstat(sourceRoot).catch(() => fail(code));
  trustedDirectory(rootStat, code);
  await openedExactFile(sourceRoot, 'LICENSE', sourceSet.record.license.rootLicenseDigest, sourceSet.record.license.byteLength, code);
  for (const entry of sourceSet.record.entries) await openedExactFile(sourceRoot, entry.path, entry.sha256, entry.byteLength, code);
  const receipt = immutable({
    artifactType: 'kstack-domain-acquisition-verification', schemaVersion: 1,
    sourceSetDigest: sourceSet.sourceSetDigest, repository: sourceSet.record.repository,
    commit: sourceSet.record.commit, verifiedEntryCount: sourceSet.record.entries.length,
    licenseSpdxId: sourceSet.record.license.spdxId, offlineOnly: true, directRuntimeLoadingAllowed: false
  });
  const result = immutable({ sourceSet: sourceSet.record, receipt, verificationDigest: domainDigest('KSTACK-DOMAIN-ACQUISITION-VERIFICATION-V1', receipt) });
  VERIFIED_SOURCE_SETS.add(result);
  return result;
}

export function sealAcquisitionTranslation(input, verification) {
  const code = 'KSTACK_ACQUISITION_TRANSLATION_INVALID';
  exact(input, ['targetPackId', 'targetVersion', 'targetBundleDigest', 'translatorId', 'humanProvenanceConfirmationDigest', 'noticesDigest', 'translationMap', 'executableMaterialIncluded', 'directRuntimeLoadingAllowed'], code);
  if (!verification || !VERIFIED_SOURCE_SETS.has(verification) || input.targetPackId !== 'assurance'
      || input.targetVersion !== '1.0.0' || input.executableMaterialIncluded !== false || input.directRuntimeLoadingAllowed !== false) fail(code);
  if (!Array.isArray(input.translationMap) || input.translationMap.length !== verification.sourceSet.entries.length) fail(code);
  const translationMap = input.translationMap.map((entry) => {
    exact(entry, ['sourcePath', 'sourceSha256', 'targetSectionIds', 'materialKinds'], code);
    const source = verification.sourceSet.entries.find((candidate) => candidate.path === entry.sourcePath);
    if (!source || source.sha256 !== entry.sourceSha256) fail(code);
    const targetSectionIds = Array.isArray(entry.targetSectionIds) ? entry.targetSectionIds.map((id) => text(id, ID, code)) : fail(code);
    if (targetSectionIds.length < 1 || new Set(targetSectionIds).size !== targetSectionIds.length
        || targetSectionIds.some((id, index) => index > 0 && compare(targetSectionIds[index - 1], id) >= 0)) fail(code);
    return { sourcePath: source.path, sourceSha256: source.sha256, targetSectionIds, materialKinds: sortedUnique(entry.materialKinds, MATERIAL_KINDS, code) };
  });
  if (new Set(translationMap.map((entry) => entry.sourcePath)).size !== translationMap.length
      || translationMap.some((entry, index) => entry.sourcePath !== verification.sourceSet.entries[index].path)) fail(code);
  const record = immutable({
    artifactType: 'kstack-domain-acquisition-translation', schemaVersion: 1,
    sourceSetDigest: verification.receipt.sourceSetDigest, verificationDigest: verification.verificationDigest,
    targetPackId: input.targetPackId, targetVersion: input.targetVersion,
    targetBundleDigest: digest(input.targetBundleDigest, code), translatorId: text(input.translatorId, ID, code),
    humanProvenanceConfirmationDigest: digest(input.humanProvenanceConfirmationDigest, code),
    noticesDigest: digest(input.noticesDigest, code), translationMap,
    executableMaterialIncluded: false, directRuntimeLoadingAllowed: false
  });
  const result = immutable({ record, translationDigest: domainDigest('KSTACK-DOMAIN-ACQUISITION-TRANSLATION-V1', record) });
  TRANSLATIONS.add(result);
  return result;
}

export function evaluateAcquisitionQualification(input) {
  const code = 'KSTACK_ACQUISITION_QUALIFICATION_INVALID';
  exact(input, ['translation', 'corpusDigest', 'evaluationAnalysisDigest', 'caseCount', 'power', 'twoSidedAlpha', 'adjudicatorAgreement', 'gates'], code);
  if (!input.translation || !TRANSLATIONS.has(input.translation)) fail(code);
  const facts = evaluateAcquisitionQualificationFacts({
    caseCount: input.caseCount, power: input.power, twoSidedAlpha: input.twoSidedAlpha,
    adjudicatorAgreement: input.adjudicatorAgreement, gates: input.gates
  });
  const record = immutable({
    artifactType: 'kstack-domain-acquisition-qualification', schemaVersion: 1,
    translationDigest: input.translation.translationDigest, corpusDigest: digest(input.corpusDigest, code),
    evaluationAnalysisDigest: digest(input.evaluationAnalysisDigest, code), caseCount: input.caseCount,
    powerBasisPoints: basisPoints(facts.power, code),
    twoSidedAlphaBasisPoints: basisPoints(facts.twoSidedAlpha, code),
    adjudicatorAgreementBasisPoints: basisPoints(facts.adjudicatorAgreement, code),
    gates: facts.gates,
    disposition: facts.disposition
  });
  return immutable({ record, qualificationDigest: domainDigest('KSTACK-DOMAIN-ACQUISITION-QUALIFICATION-V1', record), qualified: facts.qualified });
}

export function evaluateAcquisitionQualificationFacts(input) {
  const code = 'KSTACK_ACQUISITION_QUALIFICATION_INVALID';
  exact(input, ['caseCount', 'power', 'twoSidedAlpha', 'adjudicatorAgreement', 'gates'], code);
  exact(input.gates, ['provenanceStructure', 'incrementalRecall', 'unsupportedFindings', 'duplicates', 'baseLaneRegression', 'budget', 'isolationRollback'], code);
  const gates = Object.fromEntries(Object.entries(input.gates).map(([key, value]) => [key, bool(value, code)]));
  const caseCount = integer(input.caseCount, 200, 100_000, code);
  if (typeof input.power !== 'number' || !Number.isFinite(input.power) || input.power < 0.80 || input.power > 1
      || input.twoSidedAlpha !== 0.05 || typeof input.adjudicatorAgreement !== 'number' || !Number.isFinite(input.adjudicatorAgreement)
      || input.adjudicatorAgreement < 0 || input.adjudicatorAgreement > 1) fail(code);
  basisPoints(input.power, code);
  basisPoints(input.twoSidedAlpha, code);
  basisPoints(input.adjudicatorAgreement, code);
  const qualified = caseCount >= 200 && input.adjudicatorAgreement >= 0.90 && Object.values(gates).every(Boolean);
  return immutable({
    caseCount, power: input.power, twoSidedAlpha: input.twoSidedAlpha,
    adjudicatorAgreement: input.adjudicatorAgreement, gates, qualified,
    disposition: qualified ? 'qualified-not-activated' : 'unqualified-native-fallback'
  });
}
