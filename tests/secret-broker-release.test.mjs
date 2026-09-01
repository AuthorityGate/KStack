import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { hostCanonicalBytes, parseHostCanonicalJson } from '../plugins/kstack/scripts/kstack-host-contract.mjs';
import {
  buildSecretBrokerReleaseManifest,
  manifestDigest,
  parseSecretBrokerReleaseManifest,
  SECRET_BROKER_RELEASE_MANIFEST_PATH,
  SECRET_BROKER_SOURCE_AUDIT_PATH,
  validateSecretBrokerReleaseManifest,
  validateSecretBrokerSourceAudit
} from '../plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs';
import {
  classifySourceCheckoutPublication,
  RELEASE_AUTHORITY_ROOT_VERSION,
  RELEASE_PUBLICATION_VERSION,
  RELEASE_ROLES,
  releaseAuthorityPolicyDigest,
  releasePublicationSigningBytes,
  validateReleasePublication
} from '../plugins/kstack/scripts/secret-broker/release-provenance-v1.mjs';

const pluginRoot = path.resolve('plugins/kstack');
const releasePath = path.join(pluginRoot, SECRET_BROKER_RELEASE_MANIFEST_PATH);
const auditPath = path.join(pluginRoot, SECRET_BROKER_SOURCE_AUDIT_PATH);

test('release manifest is canonical, acyclic, and exactly closes its owned content set', () => {
  const bytes = fs.readFileSync(releasePath);
  const release = parseSecretBrokerReleaseManifest(bytes, pluginRoot);
  assert.deepEqual(release, buildSecretBrokerReleaseManifest(pluginRoot));
  assert.equal(release.releaseClass, 'UNSIGNED_DEVELOPMENT');
  assert.equal(release.contentEntries.some((entry) => entry.path === SECRET_BROKER_RELEASE_MANIFEST_PATH), false);
  assert.equal(release.contentEntries.some((entry) => entry.path === SECRET_BROKER_SOURCE_AUDIT_PATH), false);
  assert.equal(release.contentEntries.every((entry, index, entries) => index === 0 || entries[index - 1].path < entry.path), true);
  assert.equal(Object.keys(release.contractDigests).length, 12);
});

test('source audit excludes only itself and closes over release plus all release content', () => {
  const release = parseSecretBrokerReleaseManifest(fs.readFileSync(releasePath), pluginRoot);
  const auditBytes = fs.readFileSync(auditPath);
  const audit = parseHostCanonicalJson(auditBytes);
  validateSecretBrokerSourceAudit(audit, release, pluginRoot);
  assert.equal(audit.entries.some((entry) => entry.path === SECRET_BROKER_SOURCE_AUDIT_PATH), false);
  assert.equal(audit.entries.filter((entry) => entry.path === SECRET_BROKER_RELEASE_MANIFEST_PATH).length, 1);
  assert.equal(audit.entries.length, release.contentEntries.length + 1);
  assert.equal(release.sourceAuditManifestDigest, undefined);
  assert.equal(audit.releaseManifestDigest, undefined);

  const unrelatedReleaseEntry = structuredClone(audit);
  const releaseEntry = unrelatedReleaseEntry.entries.find((entry) => entry.path === SECRET_BROKER_RELEASE_MANIFEST_PATH);
  releaseEntry.size = 0;
  releaseEntry.sha256 = `sha256:${'0'.repeat(64)}`;
  assert.throws(() => validateSecretBrokerSourceAudit(unrelatedReleaseEntry, release));
});

test('release manifest validation closes all semantic fields without source checkout access', () => {
  const release = parseSecretBrokerReleaseManifest(fs.readFileSync(releasePath));
  const mutations = [
    (value) => { value.pluginBaseVersion = '01.2.3'; },
    (value) => { value.publicConfigSchema = 'attacker-schema'; },
    (value) => { value.publicApiSchemas.reverse(); },
    (value) => { value.protectedRecordSchemas = ['attacker-record']; },
    (value) => { value.workerProtocols = []; },
    (value) => { value.adapterProtocols = []; },
    (value) => { value.auditProtocol = 'attacker-audit'; },
    (value) => { value.qualificationProtocol = 'attacker-qualification'; },
    (value) => { value.hostCompatibilityProfiles.reverse(); },
    (value) => { value.installHealthContractDigest = `sha256:${'0'.repeat(64)}`.slice(0, -1); },
    (value) => { value.validatorArtifacts[0].sha256 = `sha256:${'0'.repeat(64)}`; },
    (value) => { value.contentEntries[0].artifactRole = 'SCRIPT'; }
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(release);
    mutate(changed);
    assert.throws(() => validateSecretBrokerReleaseManifest(changed));
  }
});

function signedFixture() {
  const keys = RELEASE_ROLES.map((role) => ({ role, ...crypto.generateKeyPairSync('ed25519') }));
  const root = {
    schemaVersion: RELEASE_AUTHORITY_ROOT_VERSION,
    policyEpoch: 7,
    principals: keys.map(({ role, publicKey }, index) => ({
      principalRef: `release-principal-${index + 1}`,
      role,
      publicKeySpkiBase64: publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
    }))
  };
  const release = parseSecretBrokerReleaseManifest(fs.readFileSync(releasePath), pluginRoot);
  const publication = {
    schemaVersion: RELEASE_PUBLICATION_VERSION,
    pluginBaseVersion: release.pluginBaseVersion,
    sourceRevisionDigest: `sha256:${'1'.repeat(64)}`,
    sourceTreeDigest: `sha256:${'2'.repeat(64)}`,
    buildToolchainDigest: `sha256:${'3'.repeat(64)}`,
    releaseManifestDigest: manifestDigest(release),
    sourceAuditManifestDigest: `sha256:${crypto.createHash('sha256').update(fs.readFileSync(auditPath)).digest('hex')}`,
    releaseAuthorityPolicyEpoch: root.policyEpoch,
    releaseAuthorityPolicyDigest: releaseAuthorityPolicyDigest(root),
    publishedAt: '2026-08-31T12:00:00.000Z',
    signatures: []
  };
  const message = releasePublicationSigningBytes(publication);
  publication.signatures = keys.map(({ role, privateKey }, index) => ({
    role,
    principalRef: root.principals[index].principalRef,
    signatureBase64: crypto.sign(null, message, privateKey).toString('base64')
  }));
  return { root, publication };
}

test('external provenance requires three distinct role-bound signatures over both manifest digests', () => {
  const { root, publication } = signedFixture();
  const expected = {
    pluginBaseVersion: publication.pluginBaseVersion,
    releaseManifestDigest: publication.releaseManifestDigest,
    sourceAuditManifestDigest: publication.sourceAuditManifestDigest,
    authorityRootPinDigest: releaseAuthorityPolicyDigest(root)
  };
  const result = validateReleasePublication(publication, root, expected);
  assert.equal(result.state, 'SIGNED_PUBLICATION_VERIFIED');
  assert.deepEqual(classifySourceCheckoutPublication({ publication, externalAuthorityRoot: root, expected }), {
    ...result, state: 'SIGNED_PUBLICATION_CALLER_VERIFIED', pilotEligible: false, productionEligible: false
  });

  const tampered = structuredClone(publication);
  tampered.sourceAuditManifestDigest = `sha256:${'f'.repeat(64)}`;
  assert.throws(() => validateReleasePublication(tampered, root));

  const reused = structuredClone(root);
  reused.principals[1].principalRef = reused.principals[0].principalRef;
  assert.throws(() => validateReleasePublication(publication, reused));

  const repeatedKey = structuredClone(root);
  repeatedKey.principals[1].publicKeySpkiBase64 = repeatedKey.principals[0].publicKeySpkiBase64;
  assert.throws(() => validateReleasePublication(publication, repeatedKey, expected));

  assert.throws(() => validateReleasePublication(publication, root));
  assert.throws(() => classifySourceCheckoutPublication({ publication, externalAuthorityRoot: root }));
  assert.throws(() => validateReleasePublication(publication, root, { ...expected, authorityRootPinDigest: `sha256:${'0'.repeat(64)}` }));
  assert.throws(() => validateReleasePublication(publication, root, { ...expected, releaseManifestDigest: `sha256:${'0'.repeat(64)}` }));

  const reordered = structuredClone(publication);
  [reordered.signatures[0], reordered.signatures[1]] = [reordered.signatures[1], reordered.signatures[0]];
  assert.throws(() => validateReleasePublication(reordered, root));

  const malformed = structuredClone(publication);
  malformed.signatures[0].signatureBase64 = `${malformed.signatures[0].signatureBase64}\n`;
  assert.throws(() => validateReleasePublication(malformed, root));
});

test('a checkout cannot bootstrap release authority from itself', () => {
  assert.deepEqual(classifySourceCheckoutPublication(), {
    state: 'UNSIGNED_DEVELOPMENT', pilotEligible: false, productionEligible: false
  });
  const release = parseHostCanonicalJson(fs.readFileSync(releasePath));
  assert.equal(Object.hasOwn(release, 'releaseAuthorityRoot'), false);
  assert.equal(hostCanonicalBytes(release).equals(fs.readFileSync(releasePath)), true);
});

test('caller-created signed material never establishes installer trust or eligibility', () => {
  const { root, publication } = signedFixture();
  const callerBinding = {
    pluginBaseVersion: publication.pluginBaseVersion,
    releaseManifestDigest: publication.releaseManifestDigest,
    sourceAuditManifestDigest: publication.sourceAuditManifestDigest,
    authorityRootPinDigest: releaseAuthorityPolicyDigest(root)
  };
  const classified = classifySourceCheckoutPublication({ publication, externalAuthorityRoot: root, expected: callerBinding });
  assert.equal(classified.state, 'SIGNED_PUBLICATION_CALLER_VERIFIED');
  assert.equal(classified.pilotEligible, false);
  assert.equal(classified.productionEligible, false);
});
