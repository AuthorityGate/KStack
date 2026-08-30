#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const root = new URL('./', import.meta.url);
const read = (name) => JSON.parse(fs.readFileSync(new URL(name, root), 'utf8'));
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const sbom = read('goose-v1.48.0-x86_64-unknown-linux-gnu.cdx.json');
const notices = read('goose-v1.48.0-third-party-notices.json');
const sources = read('goose-v1.48.0-corresponding-source.json');

assert.equal(sbom.bomFormat, 'CycloneDX');
assert.equal(sbom.specVersion, '1.5');
assert.equal(sbom.components.length, 1043);
assert.equal(sbom.dependencies.length, 1044);
assert.equal(sbom.metadata.component.name, 'goose');
assert.equal(sbom.metadata.component.version, '1.48.0');
assert.deepEqual(sbom.metadata.component.hashes, [{
  alg: 'SHA-256',
  content: '057a1788b48cc1452203920afd31eac274d5b9cb10026734d587e5db33885792'
}]);
assert.equal(sbom.components.filter((component) => !component.purl || !component.licenses?.length).length, 0);

const binder = sbom.metadata.tools.find((tool) => tool.name === 'bind-goose-v1.48.0-sbom.mjs');
assert.ok(binder);
assert.equal(binder.hashes[0].content, sha256(fs.readFileSync(new URL('bind-goose-v1.48.0-sbom.mjs', root))));

assert.equal(notices.schema, 'kstack-third-party-notices-v1');
assert.equal(sources.schema, 'kstack-corresponding-source-v1');
assert.equal(notices.packageCount, notices.packages.length);
assert.equal(sources.packageCount, sources.packages.length);
assert.equal(notices.packageCount, 1146);
assert.equal(sources.packageCount, 1146);

const noticeIds = new Set(notices.packages.map((pkg) => pkg.id));
const sourceIds = new Set(sources.packages.map((pkg) => pkg.id));
assert.equal(noticeIds.size, notices.packages.length);
assert.deepEqual(noticeIds, sourceIds);
const sourceNameVersions = new Set(sources.packages.map((pkg) => `${pkg.name}\0${pkg.version}`));
for (const component of sbom.components) assert.ok(sourceNameVersions.has(`${component.name}\0${component.version}`));

const textByDigest = new Map();
for (const text of notices.texts) {
  assert.match(text.sha256, /^[0-9a-f]{64}$/u);
  const bytes = text.encoding === 'utf8' ? Buffer.from(text.text, 'utf8') : Buffer.from(text.text, 'base64');
  assert.equal(sha256(bytes), text.sha256);
  textByDigest.set(text.sha256, text);
}
assert.equal(textByDigest.size, 598);
for (const pkg of notices.packages) {
  assert.ok(pkg.licenseExpression);
  for (const file of pkg.noticeFiles) assert.ok(textByDigest.has(file.sha256));
}

for (const pkg of sources.packages) {
  assert.ok(pkg.licenseExpression);
  if (pkg.source.kind === 'crates.io') {
    assert.match(pkg.source.archiveSha256, /^[0-9a-f]{64}$/u);
    assert.ok(pkg.source.archiveBytes > 0);
    assert.match(pkg.source.retrievalUrl, /^https:\/\/crates\.io\/api\/v1\/crates\//u);
  } else if (pkg.source.kind === 'git') {
    assert.ok(pkg.source.repository.startsWith('https://'));
    assert.match(pkg.source.revision, /^[0-9a-f]{40}$/u);
    assert.match(pkg.source.manifestSha256, /^[0-9a-f]{64}$/u);
  } else {
    assert.equal(pkg.source.kind, 'candidate-source');
    assert.match(pkg.source.manifestSha256, /^[0-9a-f]{64}$/u);
  }
}

assert.equal(sources.mplPackages.length, 17);
assert.equal(sources.modifiedMplFiles.length, 0);
assert.equal(sources.modifiedFiles.length, 7);
assert.equal(sources.modifiedFiles.some((file) => file.mplCovered), false);
for (const pkg of sources.mplPackages) {
  assert.ok(pkg.licenseExpression.includes('MPL-2.0'));
  assert.deepEqual(pkg.modifiedFiles, []);
}

process.stdout.write(`${JSON.stringify({
  result: 'PASS',
  sbomComponents: sbom.components.length,
  dependencyNodes: sbom.dependencies.length,
  sourcePackages: sources.packageCount,
  noticeTexts: notices.texts.length,
  mplPackages: sources.mplPackages.length,
  modifiedMplFiles: sources.modifiedMplFiles.length
}, null, 2)}\n`);
