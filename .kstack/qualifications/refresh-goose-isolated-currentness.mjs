#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fileDigest, recordDigest, sourceRoot } from './host-implementation-inventory.mjs';

const qualificationRoot = path.dirname(fileURLToPath(import.meta.url));
const evidencePath = path.join(qualificationRoot, 'goose-v1.48.0-isolated-cell-evidence.json');
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const original = structuredClone(evidence);
const unsigned = { ...original };
delete unsigned.evidenceDigest;
if (original.schema !== 'kstack-goose-v1.48.0-isolated-cell-v1'
    || original.aggregate !== 'PASS' || original.evidenceDigest !== recordDigest(unsigned)) {
  throw new Error('KSTACK_GOOSE_CURRENTNESS_SOURCE_INVALID');
}
const expectedStableBindings = {
  adapterDigest: fileDigest('plugins/kstack/scripts/kstack-goose-adapter.mjs'),
  providerScriptDigest: fileDigest('.kstack/qualifications/goose-v1.48.0-synthetic-provider.mjs'),
  childHarnessDigest: fileDigest('.kstack/qualifications/goose-v1.48.0-isolated-cell-child.mjs'),
  pid1ReaperSourceDigest: fileDigest('.kstack/qualifications/kstack-pid1-reaper.c'),
  supplyChainEvidenceDigest: fileDigest('.kstack/qualifications/goose-v1.48.0-supply-chain-2026-08-29.md')
};
for (const [key, expected] of Object.entries(expectedStableBindings)) {
  if (original.bindings?.[key] !== expected) throw new Error('KSTACK_GOOSE_CURRENTNESS_NONMANIFEST_DRIFT');
}
if (typeof original.bindings.installManifestDigest !== 'string'
    || !/^[a-f0-9]{64}$/u.test(original.bindings.installManifestDigest)) {
  throw new Error('KSTACK_GOOSE_CURRENTNESS_BINDING_INVALID');
}
const currentManifestDigest = fileDigest('plugins/kstack/install-health-audit-manifest-v1.json');
evidence.bindings.installManifestDigest = currentManifestDigest;
const refreshed = { ...evidence };
delete refreshed.evidenceDigest;
evidence.evidenceDigest = recordDigest(refreshed);
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({
  result: 'REFRESHED_CURRENTNESS_ONLY',
  evidencePath: path.relative(sourceRoot, evidencePath).split(path.sep).join('/'),
  priorInstallManifestDigest: original.bindings.installManifestDigest,
  currentInstallManifestDigest: currentManifestDigest,
  priorEvidenceDigest: original.evidenceDigest,
  evidenceDigest: evidence.evidenceDigest
}, null, 2)}\n`);
