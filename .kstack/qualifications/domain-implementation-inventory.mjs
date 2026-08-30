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
const HOST_CANONICAL = Object.freeze(['plugins/kstack/scripts/kstack-host-contract.mjs']);
const HOST_RENDERING = Object.freeze([
  'plugins/kstack/scripts/kstack-host-profile.mjs',
  'plugins/kstack/scripts/kstack-host-package.mjs'
]);
const IDENTITY = Object.freeze([
  'plugins/kstack/scripts/kstack-domain-identity.mjs',
  'plugins/kstack/scripts/kstack-kcrp-json.mjs',
  ...HOST_CANONICAL
]);
const SELECTION = Object.freeze(['plugins/kstack/scripts/kstack-domain-selection.mjs', ...IDENTITY]);
const SEPARATION = Object.freeze(['plugins/kstack/scripts/kstack-domain-separation.mjs', ...IDENTITY]);
const TIME_BINDING = Object.freeze(['plugins/kstack/scripts/kstack-domain-time-binding.mjs']);
const SCHEMA = Object.freeze(['plugins/kstack/scripts/kstack-domain-schema.mjs', ...TIME_BINDING]);
const VALIDATION_CASE_PREFIXES = Object.freeze({
  'domain-d0-catalog-runtime': Object.freeze(['catalog and pack schemas', 'selection is exact', 'one host-neutral selection']),
  'domain-d1-identity': Object.freeze(['D1 ', 'GitHub protected review', 'broker retains', 'concurrent reuse', 'missing trusted time']),
  'domain-d2f1-inventory': Object.freeze(['D2-F1 ', 'D2 inventory']),
  'domain-d2f2-policy': Object.freeze(['D2-F2 ']),
  'domain-d2f3-selection': Object.freeze(['D2-F3 ']),
  'domain-d3-separation': Object.freeze(['D3 ']),
  'domain-d4d10-evidence': Object.freeze(['producer trust', 'D4 ', 'D10 ', 'evidence broker', 'pure validation', 'commit coordinator', 'commit recovery', 'coordinator rejects']),
  'domain-d5f1-schemas': Object.freeze(['D5 canonical', 'D5 repaired', 'D5 bundle', 'D5 schema registry', 'D5 schema documents', 'D5 catalog graph']),
  'domain-d5f2-activation': Object.freeze(['D5 activation']),
  'domain-d6-budgets': Object.freeze(['D6 ']),
  'domain-d7-evaluation': Object.freeze(['D7 ', 'each candidate pack']),
  'domain-d8-time': Object.freeze(['D8 ']),
  'pack-release-operations': Object.freeze(['each governed pack candidate', 'pack candidates', 'candidate regeneration', 'every evaluation corpus']),
  'pack-product-experience': Object.freeze(['each governed pack candidate', 'pack candidates', 'candidate regeneration', 'every evaluation corpus']),
  'pack-assurance': Object.freeze(['each governed pack candidate', 'pack candidates', 'candidate regeneration', 'every evaluation corpus']),
  'pack-research-knowledge': Object.freeze(['each governed pack candidate', 'pack candidates', 'candidate regeneration', 'every evaluation corpus']),
  'domain-acquisition-trial': Object.freeze(['the acquisition source set', 'saved verification', 'pinned offline bytes', 'translation sealing', 'offline verification', 'qualification is all-required'])
});

export const DOMAIN_IMPLEMENTATION_INVENTORY = Object.freeze([
  ['domain-d0-catalog-runtime', ['plugins/kstack/scripts/kstack-domain-catalog.mjs', ...HOST_RENDERING], ['tests/domain-catalog.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d1-identity', [...IDENTITY], ['tests/domain-identity.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d2f1-inventory', [...SELECTION], ['tests/domain-selection.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d2f2-policy', [...SELECTION], ['tests/domain-selection.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d2f3-selection', [...SELECTION], ['tests/domain-selection.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d3-separation', [...SEPARATION], ['tests/domain-separation.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d4d10-evidence', [
    'plugins/kstack/scripts/kstack-domain-result.mjs',
    'plugins/kstack/scripts/kstack-domain-result-broker.mjs',
    ...SELECTION, ...SCHEMA, ...TIME_BINDING
  ], ['tests/domain-result.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d5f1-schemas', [...SCHEMA], ['tests/domain-schema.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d5f2-activation', ['plugins/kstack/scripts/kstack-domain-activation.mjs', ...IDENTITY, ...SEPARATION, ...SELECTION, ...SCHEMA], ['tests/domain-schema.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d6-budgets', ['plugins/kstack/scripts/kstack-domain-budget.mjs', ...SELECTION, ...SCHEMA], ['tests/domain-schema.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d7-evaluation', ['plugins/kstack/scripts/kstack-domain-evaluation.mjs'], ['tests/domain-evaluation.test.mjs'], 'CORE_IMPLEMENTED'],
  ['domain-d8-time', ['plugins/kstack/scripts/kstack-domain-time.mjs', ...SCHEMA, ...TIME_BINDING], ['tests/domain-time.test.mjs'], 'CORE_IMPLEMENTED'],
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
  implementationFiles: Object.freeze([...new Set(implementationFiles)]),
  validationFiles: Object.freeze([...new Set(validationFiles)]),
  validationCasePrefixes: VALIDATION_CASE_PREFIXES[itemId],
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
    validationFiles: row.validationFiles.map((file) => ({ file, sha256: fileDigest(file) })),
    validationCasePrefixes: row.validationCasePrefixes
  }));
}
