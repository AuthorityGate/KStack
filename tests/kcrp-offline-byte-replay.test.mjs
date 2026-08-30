import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { bytesSha256, parseCanonicalJson } from '../plugins/kstack/scripts/kstack-kcrp-json.mjs';
import {
  KCRP_REPLAY_FILE_SURFACES,
  readBoundedRepositoryFile,
  replayAll,
  replayEcr,
  replayMemory
} from './helpers/kcrp-offline-byte-replay.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function relativeToRepository(absolutePath) {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join('/');
}

function fileRejection(surface, reason, forbidden = '') {
  return (error) => {
    assert.equal(error?.code, 'KCRP_REPLAY_FILE_REJECTED');
    assert.deepEqual(error?.evidence, { surface, reason });
    assert.equal(error?.message, 'KCRP_REPLAY_FILE_REJECTED');
    if (forbidden) assert.equal(JSON.stringify(error).includes(forbidden), false);
    return true;
  };
}

test('bounded repository reader admits regular files and rejects traversal on every surface', () => {
  const fixture = 'tests/fixtures/kcrp-memory-byte-replay-v1.json';
  const expected = fs.readFileSync(path.join(repositoryRoot, fixture));
  for (const surface of Object.values(KCRP_REPLAY_FILE_SURFACES)) {
    assert.equal(readBoundedRepositoryFile(fixture, { surface }).equals(expected), true);
    assert.throws(
      () => readBoundedRepositoryFile('../outside-repository', { surface }),
      fileRejection(surface, 'PATH_TRAVERSAL', 'outside-repository')
    );
  }
});

test('bounded repository reader rejects final and ancestor link escapes on every surface', (t) => {
  const localRoot = fs.mkdtempSync(path.join(repositoryRoot, 'tests/fixtures/.kcrp-reader-'));
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kcrp-reader-target-'));
  const externalFile = path.join(externalRoot, 'outside.txt');
  const finalLink = path.join(localRoot, 'final-link');
  const ancestorLink = path.join(localRoot, 'ancestor-link');
  fs.writeFileSync(externalFile, 'outside');
  try {
    try {
      fs.symlinkSync(externalFile, finalLink, 'file');
      fs.symlinkSync(externalRoot, ancestorLink, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOSYS'].includes(error?.code)) {
        t.skip(`link creation unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    const finalRelative = relativeToRepository(finalLink);
    const ancestorRelative = `${relativeToRepository(ancestorLink)}/outside.txt`;
    for (const surface of Object.values(KCRP_REPLAY_FILE_SURFACES)) {
      assert.throws(
        () => readBoundedRepositoryFile(finalRelative, { surface }),
        fileRejection(surface, 'LINK_COMPONENT_REJECTED', 'outside.txt')
      );
      assert.throws(
        () => readBoundedRepositoryFile(ancestorRelative, { surface }),
        fileRejection(surface, 'LINK_COMPONENT_REJECTED', 'outside.txt')
      );
    }
  } finally {
    fs.rmSync(localRoot, { recursive: true, force: true });
    fs.rmSync(externalRoot, { recursive: true, force: true });
  }
});

test('bounded repository reader rejects post-open path identity swaps on every surface', () => {
  const localRoot = fs.mkdtempSync(path.join(repositoryRoot, 'tests/fixtures/.kcrp-swap-'));
  try {
    for (const surface of Object.values(KCRP_REPLAY_FILE_SURFACES)) {
      const candidate = path.join(localRoot, `${surface.toLowerCase()}.txt`);
      const displaced = `${candidate}.opened`;
      fs.writeFileSync(candidate, 'original-bytes');
      let seamRan = false;
      assert.throws(() => readBoundedRepositoryFile(relativeToRepository(candidate), {
        surface,
        testAfterOpen() {
          fs.renameSync(candidate, displaced);
          fs.writeFileSync(candidate, 'changed-bytes!');
          seamRan = true;
        }
      }), fileRejection(surface, 'IDENTITY_CHANGED', path.basename(candidate)));
      assert.equal(seamRan, true);
    }
  } finally {
    fs.rmSync(localRoot, { recursive: true, force: true });
  }
});

test('canonical replay reconstructs every Memory and ECR evidence identity and count', () => {
  const memory = replayMemory();
  const ecr = replayEcr();

  assert.deepEqual({
    itemMapSha256: memory.itemMapSha256,
    includedItemIds: memory.closure.includedItemIds,
    omittedItemIds: memory.closure.omittedItemIds,
    full: memory.full,
    reduced: memory.reduced,
    reportSha256: memory.reportSha256
  }, memory.config.expected);
  assert.equal(memory.report.full.totalBytes, 153693);
  assert.equal(memory.report.treatment.totalBytes, 84903);
  assert.equal(memory.report.savings.deltaBytes, 68790);
  assert.deepEqual(memory.report.savings.exactRational, { numerator: '22930', denominator: '51231' });
  assert.deepEqual(memory.report.savings.basisPoints, { numerator: '229300000', denominator: '51231' });
  assert.deepEqual(memory.report.providerUsage, {
    U: null, W: null, R: null, P: null,
    closedReason: 'OFFLINE_SUBSET_NO_AUTHENTICATED_PROVIDER_RECEIPT'
  });
  assert.deepEqual(memory.report.providerClaims, {
    tokenSavings: null, costSavings: null, quality: null,
    closedReason: 'OFFLINE_CANONICAL_BYTE_BENCHMARK_ONLY'
  });

  assert.deepEqual({
    itemMapSha256: ecr.itemMapSha256,
    includedItemIds: ecr.closure.includedItemIds,
    omittedItemIds: ecr.closure.omittedItemIds
  }, ecr.config.expected);
  assert.equal(ecr.closure.requestedItemIds.length, 1);
  assert.equal(ecr.closure.includedItemIds.length, 13);
  assert.equal(ecr.closure.omittedItemIds.length, 0);
  assert.equal(ecr.reducedArmAvailable, false);
});

test('Host and Domain implementation packets replay byte-identically without provider claims', () => {
  const cases = [
    {
      configRelativePath: 'tests/fixtures/kcrp-host-hb-tc06-byte-replay-v1.json',
      includedItemIds: ['HOST_HB06_DESIGN', 'HOST_HB06_IMPLEMENTATION', 'HOST_HB06_PROGRESS', 'HOST_HB06_TEST'],
      omittedItemIds: ['HOST_LINUX_UNRELATED']
    },
    {
      configRelativePath: 'tests/fixtures/kcrp-domain-d7-byte-replay-v1.json',
      includedItemIds: ['DOMAIN_D7_DESIGN', 'DOMAIN_D7_IMPLEMENTATION', 'DOMAIN_D7_TEST'],
      omittedItemIds: ['DOMAIN_ASSURANCE_UNRELATED']
    }
  ];

  for (const fixture of cases) {
    const first = replayMemory({ configRelativePath: fixture.configRelativePath });
    const second = replayMemory({ configRelativePath: fixture.configRelativePath });
    assert.deepEqual(first.closure.includedItemIds, fixture.includedItemIds);
    assert.deepEqual(first.closure.omittedItemIds, fixture.omittedItemIds);
    assert.equal(first.closure.route, 'reduced');
    assert.equal(first.reportBytes.equals(second.reportBytes), true);
    assert.equal(first.reportSha256, second.reportSha256);
    assert.equal(first.report.full.totalBytes > first.report.treatment.totalBytes, true);
    assert.deepEqual(first.report.providerUsage, {
      U: null, W: null, R: null, P: null,
      closedReason: 'OFFLINE_SUBSET_NO_AUTHENTICATED_PROVIDER_RECEIPT'
    });
    assert.deepEqual(first.report.providerClaims, {
      tokenSavings: null, costSavings: null, quality: null,
      closedReason: 'OFFLINE_CANONICAL_BYTE_BENCHMARK_ONLY'
    });
  }
});

test('two independent helper executions are canonical and byte-identical', () => {
  const first = replayAll();
  const second = replayAll();
  assert.equal(first.reportBytes.equals(second.reportBytes), true);
  assert.equal(first.reportSha256, second.reportSha256);
  assert.equal(bytesSha256(first.reportBytes), first.reportSha256);
  assert.equal(first.report.replayRuns, 2);
  assert.equal(first.report.replayByteIdentical, true);

  assert.deepEqual(parseCanonicalJson(first.reportBytes), first.report);
});

test('stdout is aggregate-only and pins the published top-level identities', () => {
  const replay = replayAll();
  const printed = replay.reportBytes.toString('utf8');
  for (const forbidden of ['.kstack/', 'tests/', 'plugins/', 'github-jira-ingestion']) {
    assert.equal(printed.includes(forbidden), false, `aggregate output leaked ${forbidden}`);
  }
  assert.equal(replay.reportSha256, '2f5c9e3df519a6ea81d5326640af786ee91ecb57c3ef4892b970051ccaf34c76');
  assert.equal(replay.report.memory.configSha256, 'faabee96773d51cb018d17739b35f7f9f95802280d6d476a69088ae1c97bff1c');
  assert.equal(replay.report.memory.canonicalConfigSha256, 'b3b85d02af9c42b129c788aa3dc452b99a1fc04329c4806d08cb912f78c7b262');
  assert.equal(replay.report.memory.itemMapSha256, '1dd8d1e9adac2fbbea80e329d638241fab696cd838e182097bae0daf6b7fdc48');
  assert.equal(replay.report.memory.objectiveSha256, '8611a99bddd92392a142b431d7693b3faa0a0d1e0328ea955f229cf133a208cf');
  assert.equal(replay.report.memory.reviewerSha256, '8c0712df91b9de8e9821474b7baf8429771ff45dc4947f1fe0674233c9db26b4');
  assert.equal(replay.report.memory.governanceSha256, 'b93b7b2ed932cc5dfee6a1e728ac502cb3639dfa37929cb9773cdfbcb805d45b');
});

test('aggregate replay pins packet, manifest, report, and ECR map evidence', () => {
  const replay = replayAll().report;
  assert.deepEqual(replay.memory.closure, { includedCount: 6, omittedCount: 2, requestedCount: 1, route: 'reduced' });
  assert.deepEqual(replay.memory.full, {
    manifestBytes: 1824,
    manifestSha256: 'cee87c390ae1e1a040fe53fb75639d71795f94c73ac465c6a455ede7ff7d70d7',
    packetBytes: 151869,
    packetSha256: 'ca334fef9003c5bf03d0344820d8b549269ac69b81c61bc31b219cb0e61da4b3'
  });
  assert.deepEqual(replay.memory.reduced, {
    manifestBytes: 1581,
    manifestSha256: 'bcd485cfa1be4eec370011a1971bbce2afdd843450c1d60a6892db6ce5ee5b38',
    packetBytes: 83322,
    packetSha256: '1137a8f0673059217ebcf757717ed240940c41f12588a0a258b964b67d703112'
  });
  assert.equal(replay.memory.benchmark.reportSha256, 'de2a66a3f3222856451c2277aa17e366980be1c8d17ada23e7444bea8975b45d');
  assert.equal(replay.memory.benchmark.pairCount, 1);
  assert.deepEqual(replay.memory.benchmark.outcomeCounts, { blocked: 0, fullFallback: 0, reduced: 1 });
  assert.equal(replay.ecr.configSha256, '507e2147210633f39cc2814aa368f502be1e136350c5c8f0aa7045799537edca');
  assert.equal(replay.ecr.canonicalConfigSha256, '61f1160b9cd45d004a9385f7faf103eef85420749ddbf6a0ed1362fdc4f1a363');
  assert.equal(replay.ecr.itemMapSha256, '57a61fa441f2e25aec491bfa15cb59b060d96d2bdba30578c5303d539964edfe');
  assert.deepEqual(replay.ecr.closure, {
    includedCount: 13, omittedCount: 0, reducedArmAvailable: false, requestedCount: 1, route: 'reduced'
  });
});
