/**
 * GATE 1 for memory maturity slice 1.
 *
 * The accepted design publishes five normative conformance vectors. This file
 * reproduces every one of them byte-for-byte from the structured inputs and
 * pins the design document digest so neither side can drift silently.
 *
 * The assertions run at module scope, before any test registers, so a mismatch
 * aborts the whole file rather than reporting a partial pass.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  deriveRepoId,
  encodeHostedRepositoryIdentity,
  encodeJiraObservation,
  encodeLocalCloneRepositoryIdentity,
  encodeSelectedFieldSequence,
  REPOSITORY_PROVIDERS,
  SCALAR_KIND,
  SLICE1_DESIGN_DIGEST
} from '../plugins/kstack/scripts/kstack-memory-authority.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DESIGN_PATH = path.resolve(
  here,
  '../.kstack/decisions/memory-maturity-2026-08-26-slice1-authority-citation.md'
);

const designBytes = fs.readFileSync(DESIGN_PATH);
const designText = designBytes.toString('utf8');
const designDigest = crypto.createHash('sha256').update(designBytes).digest('hex');

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/* --- vector 1: pre-KSB1 regression string ------------------------------- *
 * Plain byte concatenation, NUL separated. This is a regression fixture
 * only and is never a production identity path; it is deliberately kept out
 * of the module and lives here alone.
 */
const NUL = String.fromCharCode(0);
const PRE_KSB1_REGRESSION_PARTS = ['kstack-repo-v1', 'github', 'github.com', 'authoritygate', 'kstack'];
const PRE_KSB1_REGRESSION_BYTES = Buffer.from(PRE_KSB1_REGRESSION_PARTS.join(NUL), 'utf8');
const PRE_KSB1_REGRESSION_SHA256 = '48f03e73809ec6882c01af6f8fd5c2dcf9cfcb6c7565a76686465d1ae54045b0';
const PRE_KSB1_REGRESSION_DOC_LITERAL = 'kstack-repo-v1\\0github\\0github.com\\0authoritygate\\0kstack';

/* --- vector 2: hosted-provider repoId ----------------------------------- */
const HOSTED_HEX = '4b53423101000102000000066769746875620002020000000a6769746875622e636f6d00030200000009313233343536373839';
const HOSTED_SHA256 = '6ba4d63b14febec8b521af09858ab90e530b7808f7dbac29e74c3a00cef032d5';

/* --- vector 3: local-clone repoId --------------------------------------- */
const LOCAL_CLONE_HEX = '4b53423101000102000000096c6f63616c2d67697400020100000020000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f0003020000000764656661756c74';
const LOCAL_CLONE_SHA256 = '9169a6c9e776f4025f987104ddb25dce0cb158cb3f2e5c2f13641b5fcd0694eb';
const LOCAL_CLONE_UUID = Buffer.from(Array.from({ length: 32 }, (unused, index) => index));

/* --- vector 4: Jira selected-field sequence (field 9) -------------------- */
const JIRA_FIELD9_SHA256 = '8e3290d2cb593e52cb3b4932ad76f7d1b3d6ed5f885b2b9fdeea9e3fae648665';

/* --- vector 5: complete Jira observation -------------------------------- */
const JIRA_OBSERVATION_HEX = '4b5342310100010200000006736974652d31000202000000053130303030000302000000053230303030000402000000044b532d310005020000000a72656c656173652d76310006060000000000070200000018323032362d30382d32365431323a30303a30302e3030305a00080200000018323032362d30382d32365431323a30303a30312e3030305a00090100000036000000010000002e4b534631010001020000000773756d6d617279000203000000010000030300000001010004020000000453686970';
const JIRA_OBSERVATION_SHA256 = '82c6bdbfb8d6fe98ecbcd60fcbff6572c85b3daed8afc105b2f73cdacdf97184';

const JIRA_OBSERVATION_INPUT = Object.freeze({
  siteId: 'site-1',
  projectId: '10000',
  issueId: '20000',
  issueKeyAtObservation: 'KS-1',
  fieldSetId: 'release-v1',
  sourceRevision: null,
  jiraUpdated: '2026-08-26T12:00:00.000Z',
  observedAt: '2026-08-26T12:00:01.000Z'
});

/* ----------------------------------------------------------------------- */
/* Blocking gate: evaluated at module load                                  */
/* ----------------------------------------------------------------------- */

const gate = (() => {
  // The design this gate is bound to must be the accepted, frozen text.
  assert.equal(designDigest, SLICE1_DESIGN_DIGEST, 'accepted design digest changed');

  // Every published literal must still be present verbatim in that text.
  for (const literal of [
    PRE_KSB1_REGRESSION_DOC_LITERAL, PRE_KSB1_REGRESSION_SHA256,
    HOSTED_HEX, HOSTED_SHA256,
    LOCAL_CLONE_HEX, LOCAL_CLONE_SHA256,
    JIRA_FIELD9_SHA256,
    JIRA_OBSERVATION_HEX, JIRA_OBSERVATION_SHA256
  ]) {
    assert.ok(designText.includes(literal), `design no longer publishes ${literal.slice(0, 32)}`);
  }

  // Vector 1
  assert.equal(sha256Hex(PRE_KSB1_REGRESSION_BYTES), PRE_KSB1_REGRESSION_SHA256);

  // Vector 2
  const hostedBytes = encodeHostedRepositoryIdentity({
    canonicalHost: 'github.com',
    providerRepositoryId: '123456789'
  });
  assert.equal(hostedBytes.toString('hex'), HOSTED_HEX);
  assert.equal(sha256Hex(hostedBytes), HOSTED_SHA256);
  const hostedDerived = deriveRepoId({
    provider: REPOSITORY_PROVIDERS.hosted,
    canonicalHost: 'github.com',
    providerRepositoryId: '123456789'
  });
  assert.equal(hostedDerived.repoId, HOSTED_SHA256);
  assert.equal(hostedDerived.canonicalBytes.toString('hex'), HOSTED_HEX);

  // Vector 3
  const localCloneBytes = encodeLocalCloneRepositoryIdentity({
    localRepositoryUuid: LOCAL_CLONE_UUID,
    ownerNamespace: 'default'
  });
  assert.equal(localCloneBytes.toString('hex'), LOCAL_CLONE_HEX);
  assert.equal(sha256Hex(localCloneBytes), LOCAL_CLONE_SHA256);
  const localCloneDerived = deriveRepoId({
    provider: REPOSITORY_PROVIDERS.localClone,
    localRepositoryUuid: LOCAL_CLONE_UUID,
    ownerNamespace: 'default'
  });
  assert.equal(localCloneDerived.repoId, LOCAL_CLONE_SHA256);
  assert.equal(localCloneDerived.canonicalBytes.toString('hex'), LOCAL_CLONE_HEX);

  // Vector 4
  const sequenceBytes = encodeSelectedFieldSequence([
    { fieldId: 'summary', occurrence: 0, scalarKind: SCALAR_KIND.text, value: 'Ship' }
  ]);
  assert.equal(sha256Hex(sequenceBytes), JIRA_FIELD9_SHA256);

  // Vector 5
  const observation = encodeJiraObservation({
    ...JIRA_OBSERVATION_INPUT,
    selectedFieldSequence: sequenceBytes
  });
  assert.equal(observation.bytes.toString('hex'), JIRA_OBSERVATION_HEX);
  assert.equal(observation.observationSha256, JIRA_OBSERVATION_SHA256);
  assert.equal(observation.selectedFieldsSha256, JIRA_FIELD9_SHA256);

  return { hostedBytes, localCloneBytes, sequenceBytes, observation };
})();

/* ----------------------------------------------------------------------- */
/* Reported form of the same gate                                           */
/* ----------------------------------------------------------------------- */

test('gate 1 vector 0: accepted design digest is pinned', () => {
  assert.equal(designDigest, SLICE1_DESIGN_DIGEST);
});

test('gate 1 vector 1: pre-KSB1 regression string reproduces its digest', () => {
  assert.equal(sha256Hex(PRE_KSB1_REGRESSION_BYTES), PRE_KSB1_REGRESSION_SHA256);
  assert.ok(designText.includes(PRE_KSB1_REGRESSION_DOC_LITERAL));
});

test('gate 1 vector 2: hosted repoId bytes and digest match the design', () => {
  assert.equal(gate.hostedBytes.toString('hex'), HOSTED_HEX);
  assert.equal(sha256Hex(gate.hostedBytes), HOSTED_SHA256);
});

test('gate 1 vector 3: local-clone repoId bytes and digest match the design', () => {
  assert.equal(gate.localCloneBytes.toString('hex'), LOCAL_CLONE_HEX);
  assert.equal(sha256Hex(gate.localCloneBytes), LOCAL_CLONE_SHA256);
});

test('gate 1 vector 4: Jira selected-field sequence digest matches the design', () => {
  assert.equal(sha256Hex(gate.sequenceBytes), JIRA_FIELD9_SHA256);
});

test('gate 1 vector 5: complete Jira observation bytes and digest match the design', () => {
  assert.equal(gate.observation.bytes.toString('hex'), JIRA_OBSERVATION_HEX);
  assert.equal(gate.observation.observationSha256, JIRA_OBSERVATION_SHA256);
});

export { PRE_KSB1_REGRESSION_BYTES, PRE_KSB1_REGRESSION_SHA256 };
