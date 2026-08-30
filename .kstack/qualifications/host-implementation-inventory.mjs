import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const nativeReferenceFiles = (name) => [
  `plugins/kstack/native/${name}/Cargo.toml`,
  `plugins/kstack/native/${name}/Cargo.lock`,
  `plugins/kstack/native/${name}/src/main.rs`
];

export const HOST_IMPLEMENTATION_INVENTORY = Object.freeze([
  ['HP-TC01', ['plugins/kstack/scripts/kstack-host-contract.mjs'], [
    'tests/host-contract.test.mjs',
    'tests/reflexion-architecture-gate.mjs'
  ], [
    ...nativeReferenceFiles('host-contract-reference'),
    'tests/helpers/host-contract-python-oracle.py',
    'tests/fixtures/host-contract-cross-runtime-vectors-v1.json'
  ]],
  ['HP-TC02', ['plugins/kstack/scripts/kstack-host-request-context.mjs'], ['tests/host-request-context.test.mjs']],
  ['HP-TC03', [
    'plugins/kstack/scripts/kstack-host-request-replay.mjs',
    'plugins/kstack/scripts/kstack-host-replay.mjs',
    'plugins/kstack/scripts/kstack-host-replay-store.mjs'
  ], ['tests/host-replay.test.mjs']],
  ['HP-TC04', ['plugins/kstack/scripts/kstack-host-evidence.mjs'], ['tests/host-evidence.test.mjs'], nativeReferenceFiles('host-contract-reference')],
  ['HP-TC05', ['plugins/kstack/scripts/kstack-host-eligibility.mjs'], ['tests/host-eligibility.test.mjs'], nativeReferenceFiles('host-eligibility-reference')],
  ['HP-TC06', ['plugins/kstack/scripts/kstack-host-harness.mjs'], ['tests/host-harness.test.mjs'], nativeReferenceFiles('host-harness-reference')],
  ['HP-TC07', ['plugins/kstack/scripts/kstack-host-broker.mjs'], ['tests/host-broker.test.mjs'], nativeReferenceFiles('host-broker-reference')],
  ['HP-TC08', ['plugins/kstack/scripts/kstack-host-mutation.mjs'], ['tests/host-mutation.test.mjs'], nativeReferenceFiles('host-mutation-reference')],
  ['HP-TC09', ['plugins/kstack/scripts/kstack-mcp-boundary.mjs'], ['tests/mcp-boundary.test.mjs'], nativeReferenceFiles('mcp-boundary-reference')],
  ['HP-TC10', ['plugins/kstack/scripts/kstack-host-receipt.mjs'], ['tests/host-receipt.test.mjs'], nativeReferenceFiles('host-receipt-reference')],
  ['HP-TC11', ['plugins/kstack/scripts/kstack-host-activation.mjs'], ['tests/host-activation.test.mjs'], nativeReferenceFiles('host-activation-reference')],
  ['HP-TC12', ['plugins/kstack/scripts/kstack-host-migration.mjs'], ['tests/host-migration.test.mjs'], nativeReferenceFiles('host-migration-reference')],
  ['HB-TC01', [
    'plugins/kstack/scripts/kstack-host-package.mjs',
    'plugins/kstack/scripts/kstack-host-profile.mjs'
  ], ['tests/host-package.test.mjs', 'tests/host-profile.test.mjs']],
  ['HB-TC02', ['plugins/kstack/scripts/kstack-host-installer.mjs'], ['tests/host-installer.test.mjs']],
  ['HB-TC03', ['plugins/kstack/scripts/kstack-opencode-candidate.mjs'], ['tests/opencode-candidate.test.mjs']],
  ['HB-TC04', ['plugins/kstack/scripts/kstack-mcp-boundary.mjs'], ['tests/mcp-facade.test.mjs'], [
    'tests/helpers/mcp-facade-python-oracle.py'
  ]],
  ['HB-TC05', [
    'plugins/kstack/scripts/kstack-opencode-adapter.mjs',
    'plugins/kstack/scripts/kstack-opencode-conformance.mjs',
    '.kstack/qualifications/opencode-v1.18.25-conformance-evidence.json'
  ], [
    'tests/opencode-adapter.test.mjs',
    'tests/opencode-conformance.test.mjs',
    'tests/opencode-protected-conformance.test.mjs'
  ], [
    'tests/helpers/opencode-conformance-python-oracle.py'
  ]]
].map(([itemId, implementationFiles, validationFiles, validationSupportFiles = []]) => Object.freeze({
  itemId,
  implementationFiles: Object.freeze(implementationFiles),
  validationFiles: Object.freeze(validationFiles),
  validationSupportFiles: Object.freeze(validationSupportFiles)
})));

const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
export const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])]))
    : value;
export const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const recordDigest = (value) => sha256Hex(JSON.stringify(canonical(value)));
export const fileDigest = (relative) => sha256Hex(fs.readFileSync(path.join(sourceRoot, relative)));

export function materializeHostInventory() {
  return HOST_IMPLEMENTATION_INVENTORY.map((row) => ({
    itemId: row.itemId,
    implementationFiles: row.implementationFiles.map((file) => ({ file, sha256: fileDigest(file) })),
    validationFiles: row.validationFiles.map((file) => ({ file, sha256: fileDigest(file) })),
    validationSupportFiles: row.validationSupportFiles.map((file) => ({ file, sha256: fileDigest(file) }))
  }));
}
