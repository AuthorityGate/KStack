import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  SECRET_COMPATIBILITY_KEYS,
  SECRET_MIGRATION_EDGE_KEYS,
  canonicalCompatibilityRowBytes,
  parseCompatibilityRow,
  validateCompatibilityRowValue,
  validateCompatibilityRows
} from '../plugins/kstack/scripts/secret-broker/compatibility-v1.mjs';

const D = (character) => `sha256:${character.repeat(64)}`;
const R1 = 'ksr1_AAAAAAAAAAAAAAAAAAAAAA';
const R2 = 'ksr1_AQEBAQEBAQEBAQEBAQEBAQ';
const row = (overrides = {}) => ({
  componentId: 'public-config',
  currentVersion: 'kstack-config-v2',
  readableVersions: ['kstack-config-v1', 'kstack-config-v2'],
  writableVersion: 'kstack-config-v2',
  migrationEdges: [{ fromVersion: 'kstack-config-v1', toVersion: 'kstack-config-v2', migratorDigest: D('a') }],
  rollbackReadableVersions: ['kstack-config-v1', 'kstack-config-v2'],
  hostProfileRefs: [R1, R2],
  ...overrides
});

test('compatibility schema and runtime share exact row and edge keys', () => {
  const schema = JSON.parse(fs.readFileSync(new URL('../plugins/kstack/schemas/secret-broker/v1/compatibility.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(schema.required, SECRET_COMPATIBILITY_KEYS);
  assert.deepEqual(schema.$defs.migrationEdge.required, SECRET_MIGRATION_EDGE_KEYS);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.migrationEdge.additionalProperties, false);
  assert.deepEqual(validateCompatibilityRowValue(row()), row());
});

test('compatibility rows round trip only through canonical duplicate-free bytes', () => {
  const bytes = canonicalCompatibilityRowBytes(row());
  assert.deepEqual(parseCompatibilityRow(bytes), row());
  assert.throws(() => parseCompatibilityRow(Buffer.from(`${bytes}\n`)), (error) => error?.code === 'KSTACK_SECRET_COMPATIBILITY_ENCODING_INVALID');
  assert.throws(() => parseCompatibilityRow(Buffer.from('{"componentId":"one","componentId":"two"}')), (error) => error?.code === 'KSTACK_SECRET_COMPATIBILITY_ENCODING_INVALID');
});

test('compatibility rows reject ranges, downgrade writes, unsorted sets, and implicit rollback', () => {
  for (const candidate of [
    row({ currentVersion: '^2.0.0', writableVersion: '^2.0.0', readableVersions: ['^2.0.0'] }),
    row({ writableVersion: 'kstack-config-v1' }),
    row({ readableVersions: ['kstack-config-v2', 'kstack-config-v1'] }),
    row({ readableVersions: ['kstack-config-v2'], rollbackReadableVersions: ['kstack-config-v1'] }),
    row({ migrationEdges: [{ fromVersion: 'kstack-config-v1', toVersion: 'kstack-config-v1', migratorDigest: D('a') }] }),
    row({ migrationEdges: [{ fromVersion: 'kstack-config-v1', toVersion: 'kstack-config-v2', migratorDigest: 'a'.repeat(64) }] }),
    row({ hostProfileRefs: [R2, R1] }),
    { ...row(), futureField: true }
  ]) assert.throws(() => validateCompatibilityRowValue(candidate));
});

test('compatibility set is component-sorted and exact-cell references remain opaque', () => {
  const publicApi = row({ componentId: 'public-api' });
  const publicConfig = row({ componentId: 'public-config' });
  assert.equal(validateCompatibilityRows([publicApi, publicConfig]).length, 2);
  assert.throws(() => validateCompatibilityRows([publicConfig, publicApi]), (error) => error?.code === 'KSTACK_SECRET_COMPATIBILITY_SET_INVALID');
  assert.throws(() => validateCompatibilityRowValue(row({ hostProfileRefs: ['windows-native'] })));
});
