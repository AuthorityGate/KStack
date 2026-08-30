import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const packFixtureNames = Object.freeze({
  assurance: 'untrusted-declaration.json',
  'product-experience': 'complete-state-inventory.json',
  'release-operations': 'unknown-status.json',
  'research-knowledge': 'claim-boundary.json'
});
const packFiles = (packId) => [
  `plugins/kstack/packs/${packId}/1.0.0/bundle.index.json`,
  `plugins/kstack/packs/${packId}/1.0.0/content.json`,
  `plugins/kstack/packs/${packId}/1.0.0/evidence.schema.json`,
  `plugins/kstack/packs/${packId}/1.0.0/fixtures/${packFixtureNames[packId]}`,
  `plugins/kstack/packs/${packId}/1.0.0/manifest.json`
];

export const DOMAIN_IMPLEMENTATION_INVENTORY = Object.freeze([
  ['domain-d0-catalog-runtime', ['plugins/kstack/scripts/kstack-domain-catalog.mjs'], ['tests/domain-catalog.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d1-identity', ['plugins/kstack/scripts/kstack-domain-identity.mjs'], ['tests/domain-identity.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d2f1-inventory', ['plugins/kstack/scripts/kstack-domain-selection.mjs'], ['tests/domain-selection.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d2f2-policy', ['plugins/kstack/scripts/kstack-domain-selection.mjs'], ['tests/domain-selection.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d2f3-selection', ['plugins/kstack/scripts/kstack-domain-selection.mjs'], ['tests/domain-selection.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d3-separation', ['plugins/kstack/scripts/kstack-domain-separation.mjs'], ['tests/domain-separation.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d4d10-evidence', [
    'plugins/kstack/scripts/kstack-domain-result.mjs',
    'plugins/kstack/scripts/kstack-domain-result-broker.mjs'
  ], ['tests/domain-result.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d5f1-schemas', ['plugins/kstack/scripts/kstack-domain-schema.mjs'], ['tests/domain-schema.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d5f2-activation', ['plugins/kstack/scripts/kstack-domain-activation.mjs'], ['tests/domain-schema.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d6-budgets', ['plugins/kstack/scripts/kstack-domain-budget.mjs'], ['tests/domain-schema.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d7-evaluation', ['plugins/kstack/scripts/kstack-domain-evaluation.mjs'], ['tests/domain-evaluation.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d8-time', ['plugins/kstack/scripts/kstack-domain-time.mjs'], ['tests/domain-time.test.mjs'], 'CORE_IMPLEMENTED'],
  ['pack-release-operations', [
    'plugins/kstack/scripts/kstack-domain-pack-candidates.mjs',
    'plugins/kstack/scripts/kstack-domain-evaluation.mjs',
    ...packFiles('release-operations')
  ], ['tests/domain-pack-candidates.test.mjs'], 'CANDIDATE_ONLY'],
  ['pack-product-experience', [
    'plugins/kstack/scripts/kstack-domain-pack-candidates.mjs',
    'plugins/kstack/scripts/kstack-domain-evaluation.mjs',
    ...packFiles('product-experience')
  ], ['tests/domain-pack-candidates.test.mjs'], 'CANDIDATE_ONLY'],
  ['pack-assurance', [
    'plugins/kstack/scripts/kstack-domain-pack-candidates.mjs',
    'plugins/kstack/scripts/kstack-domain-evaluation.mjs',
    ...packFiles('assurance')
  ], ['tests/domain-pack-candidates.test.mjs'], 'CANDIDATE_ONLY'],
  ['pack-research-knowledge', [
    'plugins/kstack/scripts/kstack-domain-pack-candidates.mjs',
    'plugins/kstack/scripts/kstack-domain-evaluation.mjs',
    ...packFiles('research-knowledge')
  ], ['tests/domain-pack-candidates.test.mjs'], 'CANDIDATE_ONLY'],
  ['domain-acquisition-trial', ['plugins/kstack/scripts/kstack-domain-acquisition.mjs'], ['tests/domain-acquisition.test.mjs'], 'OFFLINE_TRIAL_IMPLEMENTED']
].map(([itemId, implementationFiles, validationFiles, maturity]) => Object.freeze({
  itemId,
  implementationFiles: Object.freeze(implementationFiles),
  validationFiles: Object.freeze(validationFiles),
  maturity
})));

const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
export const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])]))
    : value;
export const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const recordDigest = (value) => sha256Hex(JSON.stringify(canonical(value)));
export const fileDigest = (relative) => sha256Hex(fs.readFileSync(path.join(sourceRoot, relative)));

export function materializeDomainInventory() {
  return DOMAIN_IMPLEMENTATION_INVENTORY.map((row) => ({
    itemId: row.itemId,
    maturity: row.maturity,
    implementationFiles: row.implementationFiles.map((file) => ({ file, sha256: fileDigest(file) })),
    validationFiles: row.validationFiles.map((file) => ({ file, sha256: fileDigest(file) }))
  }));
}
