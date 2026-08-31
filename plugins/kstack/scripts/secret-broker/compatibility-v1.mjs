import { assertDigest, hostCanonicalBytes, parseHostCanonicalJson } from '../kstack-host-contract.mjs';
import { validateOpaqueRef, validateRegistryId } from './public-v1.mjs';

export const SECRET_COMPATIBILITY_MAX_BYTES = 65_536;
export const SECRET_COMPATIBILITY_KEYS = Object.freeze([
  'componentId', 'currentVersion', 'readableVersions', 'writableVersion',
  'migrationEdges', 'rollbackReadableVersions', 'hostProfileRefs'
]);
export const SECRET_MIGRATION_EDGE_KEYS = Object.freeze(['fromVersion', 'toVersion', 'migratorDigest']);

const EXACT_VERSION = /^[a-z][a-z0-9.-]{0,126}[a-z0-9]$/u;

export class SecretCompatibilityError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SecretCompatibilityError';
    this.code = code;
  }
}

function fail(code) { throw new SecretCompatibilityError(code); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exactKeys(value, keys) {
  if (!plain(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))
      || Object.keys(value).some((key) => !keys.includes(key))) fail('KSTACK_SECRET_COMPATIBILITY_SCHEMA_INVALID');
}
function deepFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze));
  if (plain(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepFreeze(item)])));
  return value;
}
function copy(value) { return parseHostCanonicalJson(hostCanonicalBytes(value)); }
function compare(left, right) { return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8')); }
function assertExactVersion(value) {
  if (typeof value !== 'string' || !EXACT_VERSION.test(value) || value.includes('..')) fail('KSTACK_SECRET_COMPATIBILITY_VERSION_INVALID');
  return value;
}
function assertSortedUnique(values, validator, code) {
  if (!Array.isArray(values)) fail(code);
  values.forEach(validator);
  for (let index = 1; index < values.length; index += 1) if (compare(values[index - 1], values[index]) >= 0) fail(code);
}

export function validateCompatibilityRowValue(value) {
  exactKeys(value, SECRET_COMPATIBILITY_KEYS);
  try { validateRegistryId(value.componentId); } catch { fail('KSTACK_SECRET_COMPATIBILITY_SCHEMA_INVALID'); }
  assertExactVersion(value.currentVersion);
  assertExactVersion(value.writableVersion);
  if (value.writableVersion !== value.currentVersion) fail('KSTACK_SECRET_COMPATIBILITY_DOWNGRADE_WRITE_FORBIDDEN');
  assertSortedUnique(value.readableVersions, assertExactVersion, 'KSTACK_SECRET_COMPATIBILITY_READABLE_INVALID');
  if (value.readableVersions.length < 1 || !value.readableVersions.includes(value.currentVersion)) fail('KSTACK_SECRET_COMPATIBILITY_READABLE_INVALID');
  assertSortedUnique(value.rollbackReadableVersions, assertExactVersion, 'KSTACK_SECRET_COMPATIBILITY_ROLLBACK_INVALID');
  if (value.rollbackReadableVersions.some((version) => !value.readableVersions.includes(version))) fail('KSTACK_SECRET_COMPATIBILITY_ROLLBACK_INVALID');
  assertSortedUnique(value.hostProfileRefs, (reference) => {
    try { validateOpaqueRef(reference); } catch { fail('KSTACK_SECRET_COMPATIBILITY_HOST_REFS_INVALID'); }
  }, 'KSTACK_SECRET_COMPATIBILITY_HOST_REFS_INVALID');
  if (!Array.isArray(value.migrationEdges)) fail('KSTACK_SECRET_COMPATIBILITY_MIGRATIONS_INVALID');
  const edgeKeys = [];
  for (const edge of value.migrationEdges) {
    exactKeys(edge, SECRET_MIGRATION_EDGE_KEYS);
    assertExactVersion(edge.fromVersion);
    assertExactVersion(edge.toVersion);
    if (edge.fromVersion === edge.toVersion) fail('KSTACK_SECRET_COMPATIBILITY_MIGRATIONS_INVALID');
    try { assertDigest(edge.migratorDigest); } catch { fail('KSTACK_SECRET_COMPATIBILITY_MIGRATIONS_INVALID'); }
    edgeKeys.push(`${edge.fromVersion}\u0000${edge.toVersion}\u0000${edge.migratorDigest}`);
  }
  for (let index = 1; index < edgeKeys.length; index += 1) if (compare(edgeKeys[index - 1], edgeKeys[index]) >= 0) fail('KSTACK_SECRET_COMPATIBILITY_MIGRATIONS_INVALID');
  const checked = deepFreeze(copy(value));
  if (hostCanonicalBytes(checked).length > SECRET_COMPATIBILITY_MAX_BYTES) fail('KSTACK_SECRET_COMPATIBILITY_BYTES_EXCEEDED');
  return checked;
}

export function parseCompatibilityRow(input) {
  const bytes = Buffer.isBuffer(input) ? input : input instanceof Uint8Array ? Buffer.from(input) : null;
  if (!bytes || bytes.length < 2) fail('KSTACK_SECRET_COMPATIBILITY_INPUT_INVALID');
  if (bytes.length > SECRET_COMPATIBILITY_MAX_BYTES) fail('KSTACK_SECRET_COMPATIBILITY_BYTES_EXCEEDED');
  let value;
  try { value = parseHostCanonicalJson(bytes); } catch { fail('KSTACK_SECRET_COMPATIBILITY_ENCODING_INVALID'); }
  return validateCompatibilityRowValue(value);
}

export function canonicalCompatibilityRowBytes(value) {
  const bytes = hostCanonicalBytes(validateCompatibilityRowValue(value));
  if (bytes.length > SECRET_COMPATIBILITY_MAX_BYTES) fail('KSTACK_SECRET_COMPATIBILITY_BYTES_EXCEEDED');
  return bytes;
}

export function validateCompatibilityRows(rows) {
  if (!Array.isArray(rows)) fail('KSTACK_SECRET_COMPATIBILITY_SET_INVALID');
  const checked = rows.map(validateCompatibilityRowValue);
  for (let index = 1; index < checked.length; index += 1) if (compare(checked[index - 1].componentId, checked[index].componentId) >= 0) fail('KSTACK_SECRET_COMPATIBILITY_SET_INVALID');
  return deepFreeze(checked.map(copy));
}
