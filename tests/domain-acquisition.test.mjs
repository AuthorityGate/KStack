import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ACQUISITION_LICENSE_ALLOWLIST,
  APPROVED_ASSURANCE_SOURCE_SET_V1,
  DIRECT_RUNTIME_ACQUISITION_ALLOWED,
  assertApprovedAssuranceSourceSet,
  evaluateAcquisitionQualification,
  evaluateAcquisitionQualificationFacts,
  sealAcquisitionTranslation,
  validateAcquisitionSourceSet,
  verifyOfflineAcquisitionSource
} from '../plugins/kstack/scripts/kstack-domain-acquisition.mjs';
import { packCanonicalBytes } from '../plugins/kstack/scripts/kstack-domain-schema.mjs';

const root = path.resolve(import.meta.dirname, '..');
const acquisitionRoot = path.join(root, 'plugins/kstack/acquisition/assurance-gstack-v1');
const pinnedSourceFixture = path.join(root, 'tests/fixtures/acquisition-gstack-v1');
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(acquisitionRoot, name), 'utf8')); }
function domainSha(domain, value) { return crypto.createHash('sha256').update(Buffer.from(`${domain}\n`)).update(packCanonicalBytes(value)).digest('hex'); }
function code(expected, action) { assert.throws(action, (error) => error?.code === expected); }
async function asyncCode(expected, action) { await assert.rejects(action, (error) => error?.code === expected); }
function translationInput(record) {
  return {
    targetPackId: record.targetPackId,
    targetVersion: record.targetVersion,
    targetBundleDigest: record.targetBundleDigest,
    translatorId: record.translatorId,
    humanProvenanceConfirmationDigest: record.humanProvenanceConfirmationDigest,
    noticesDigest: record.noticesDigest,
    translationMap: structuredClone(record.translationMap),
    executableMaterialIncluded: record.executableMaterialIncluded,
    directRuntimeLoadingAllowed: record.directRuntimeLoadingAllowed
  };
}
async function trustedPinnedSourceFixture() {
  const parent = await fsp.mkdtemp(path.join(os.tmpdir(), 'kstack-acquisition-positive-'));
  const sourceRoot = path.join(parent, 'source');
  await fsp.cp(pinnedSourceFixture, sourceRoot, { recursive: true, force: false, errorOnExist: true });
  await Promise.all([
    parent, sourceRoot, path.join(sourceRoot, 'review'), path.join(sourceRoot, 'review/specialists')
  ].map((directory) => fsp.chmod(directory, 0o700)));
  await Promise.all([
    path.join(sourceRoot, 'LICENSE'),
    ...APPROVED_ASSURANCE_SOURCE_SET_V1.entries.map((entry) => path.join(sourceRoot, ...entry.path.split('/')))
  ].map((file) => fsp.chmod(file, 0o600)));
  return { parent, sourceRoot };
}

test('the acquisition source set is the exact owner-approved seven-file MIT corpus', () => {
  const sourceSet = readJson('source-set.json');
  const validated = assertApprovedAssuranceSourceSet(sourceSet);
  assert.deepEqual(sourceSet, APPROVED_ASSURANCE_SOURCE_SET_V1);
  assert.equal(validated.sourceSetDigest, 'a793666c13d88da6106e4deda670f2c4b777a6fe45fef03e14908a954db0ae0d');
  assert.equal(sourceSet.entries.length, 7);
  assert.equal(DIRECT_RUNTIME_ACQUISITION_ALLOWED, false);
  assert.deepEqual(ACQUISITION_LICENSE_ALLOWLIST, ['Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0', 'ISC', 'MIT']);
  assert.deepEqual(packCanonicalBytes(sourceSet), Buffer.from(fs.readFileSync(path.join(acquisitionRoot, 'source-set.json'), 'utf8').trimEnd()));

  const changedCommit = structuredClone(sourceSet); changedCommit.commit = '0'.repeat(40);
  code('KSTACK_ACQUISITION_SOURCE_NOT_APPROVED', () => assertApprovedAssuranceSourceSet(changedCommit));
  const widened = structuredClone(sourceSet); widened.directRuntimeLoadingProhibited = false;
  code('KSTACK_ACQUISITION_SOURCE_SET_INVALID', () => validateAcquisitionSourceSet(widened));
  const traversal = structuredClone(sourceSet); traversal.entries[0].path = '../security.md';
  code('KSTACK_ACQUISITION_SOURCE_SET_INVALID', () => validateAcquisitionSourceSet(traversal));
});

test('saved verification and translation records are canonical, exact-covered, and authority-free', () => {
  const sourceSet = readJson('source-set.json');
  const receipt = readJson('verification-receipt.json');
  const translation = readJson('translation-record.json');
  for (const name of ['verification-receipt.json', 'translation-record.json']) {
    const record = readJson(name);
    assert.deepEqual(packCanonicalBytes(record), Buffer.from(fs.readFileSync(path.join(acquisitionRoot, name), 'utf8').trimEnd()));
  }
  assert.equal(domainSha('KSTACK-DOMAIN-ACQUISITION-VERIFICATION-V1', receipt), 'fcaac68abe87c30a071e31a70254dc453e801aa0806df19a9f9578872493fb92');
  assert.equal(domainSha('KSTACK-DOMAIN-ACQUISITION-TRANSLATION-V1', translation), '88e50849a282700c22c9f020f4ebc029c35df2114292cb362a8ef3d9ace70660');
  assert.deepEqual(translation.translationMap.map((entry) => entry.sourcePath), sourceSet.entries.map((entry) => entry.path));
  assert.ok(translation.translationMap.every((entry, index) => entry.sourceSha256 === sourceSet.entries[index].sha256));
  assert.equal(receipt.directRuntimeLoadingAllowed, false);
  assert.equal(translation.directRuntimeLoadingAllowed, false);
  assert.equal(translation.executableMaterialIncluded, false);
  const forbiddenKeys = new Set(['url', 'command', 'tool', 'hook', 'marketplace', 'plugin', 'network', 'mcp', 'script', 'instruction']);
  const visit = (value) => { if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { assert.equal(forbiddenKeys.has(key.toLowerCase()), false); visit(child); } };
  visit({ receipt, translation });
});

test('pinned offline bytes reproduce the stored receipt and translation, then qualify without activation', async () => {
  const fixture = await trustedPinnedSourceFixture();
  try {
    const sourceSet = readJson('source-set.json');
    const storedReceipt = readJson('verification-receipt.json');
    const storedTranslation = readJson('translation-record.json');
    const verification = await verifyOfflineAcquisitionSource({ sourceRoot: fixture.sourceRoot, sourceSet });
    assert.deepEqual(verification.receipt, storedReceipt);
    assert.equal(verification.verificationDigest, storedTranslation.verificationDigest);

    const sealed = sealAcquisitionTranslation(translationInput(storedTranslation), verification);
    assert.deepEqual(sealed.record, storedTranslation);
    assert.equal(sealed.translationDigest, '88e50849a282700c22c9f020f4ebc029c35df2114292cb362a8ef3d9ace70660');

    const gates = {
      provenanceStructure: true, incrementalRecall: true, unsupportedFindings: true,
      duplicates: true, baseLaneRegression: true, budget: true, isolationRollback: true
    };
    const qualification = evaluateAcquisitionQualification({
      translation: sealed, corpusDigest: '2'.repeat(64), evaluationAnalysisDigest: '3'.repeat(64),
      caseCount: 300, power: 0.80, twoSidedAlpha: 0.05, adjudicatorAgreement: 0.90, gates
    });
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.record.disposition, 'qualified-not-activated');
    assert.equal(qualification.qualificationDigest, '5a73ded7b09629a3e353f180707c20c9c1a513ca9ffbafc5240c81fe2650fca3');
    assert.equal(qualification.qualificationDigest, domainSha('KSTACK-DOMAIN-ACQUISITION-QUALIFICATION-V1', qualification.record));
  } finally { await fsp.rm(fixture.parent, { recursive: true, force: true }); }
});

test('translation sealing rejects forged provenance and every executable or binding substitution', async () => {
  const fixture = await trustedPinnedSourceFixture();
  try {
    const verification = await verifyOfflineAcquisitionSource({
      sourceRoot: fixture.sourceRoot, sourceSet: readJson('source-set.json')
    });
    const valid = translationInput(readJson('translation-record.json'));
    code('KSTACK_ACQUISITION_TRANSLATION_INVALID', () => sealAcquisitionTranslation(valid, structuredClone(verification)));
    for (const mutate of [
      (value) => value.translationMap.reverse(),
      (value) => { value.translationMap[0].sourceSha256 = '0'.repeat(64); },
      (value) => { value.targetPackId = 'research-knowledge'; },
      (value) => { value.targetVersion = '1.0.1'; },
      (value) => { value.executableMaterialIncluded = true; },
      (value) => { value.directRuntimeLoadingAllowed = true; }
    ]) {
      const changed = structuredClone(valid);
      mutate(changed);
      code('KSTACK_ACQUISITION_TRANSLATION_INVALID', () => sealAcquisitionTranslation(changed, verification));
    }
  } finally { await fsp.rm(fixture.parent, { recursive: true, force: true }); }
});

test('offline verification refuses substituted bytes and symlinked corpus files', async () => {
  const temporary = await fsp.mkdtemp(path.join(os.tmpdir(), 'kstack-acquisition-test-'));
  try {
    await fsp.writeFile(path.join(temporary, 'ordinary-license'), 'not-the-pinned-license');
    await fsp.symlink(path.join(temporary, 'ordinary-license'), path.join(temporary, 'LICENSE'));
    await asyncCode('KSTACK_ACQUISITION_OFFLINE_VERIFICATION_FAILED', () => verifyOfflineAcquisitionSource({
      sourceRoot: temporary, sourceSet: readJson('source-set.json')
    }));
    await fsp.unlink(path.join(temporary, 'LICENSE'));
    await fsp.writeFile(path.join(temporary, 'LICENSE'), 'substituted');
    await asyncCode('KSTACK_ACQUISITION_OFFLINE_VERIFICATION_FAILED', () => verifyOfflineAcquisitionSource({
      sourceRoot: temporary, sourceSet: readJson('source-set.json')
    }));
  } finally { await fsp.rm(temporary, { recursive: true, force: true }); }
});

test('qualification is all-required, preserves native fallback, and never activates', () => {
  const gates = {
    provenanceStructure: true, incrementalRecall: true, unsupportedFindings: true,
    duplicates: true, baseLaneRegression: true, budget: true, isolationRollback: true
  };
  const passed = evaluateAcquisitionQualificationFacts({
    caseCount: 300, power: 0.80, twoSidedAlpha: 0.05, adjudicatorAgreement: 0.90, gates
  });
  assert.equal(passed.qualified, true);
  assert.equal(passed.disposition, 'qualified-not-activated');
  const failed = evaluateAcquisitionQualificationFacts({
    caseCount: 300, power: 0.80, twoSidedAlpha: 0.05, adjudicatorAgreement: 0.90,
    gates: { ...gates, duplicates: false }
  });
  assert.equal(failed.qualified, false);
  assert.equal(failed.disposition, 'unqualified-native-fallback');
  for (const mutation of [
    { power: Number.NaN },
    { adjudicatorAgreement: Number.NaN },
    { adjudicatorAgreement: 0.90001 }
  ]) {
    code('KSTACK_ACQUISITION_QUALIFICATION_INVALID', () => evaluateAcquisitionQualificationFacts({
      caseCount: 300, power: 0.80, twoSidedAlpha: 0.05, adjudicatorAgreement: 0.90, gates, ...mutation
    }));
  }
  code('KSTACK_ACQUISITION_QUALIFICATION_INVALID', () => evaluateAcquisitionQualification({
    translation: readJson('translation-record.json'), corpusDigest: '0'.repeat(64),
    evaluationAnalysisDigest: '1'.repeat(64), caseCount: 300, power: 0.80,
    twoSidedAlpha: 0.05, adjudicatorAgreement: 1, gates
  }));
});
