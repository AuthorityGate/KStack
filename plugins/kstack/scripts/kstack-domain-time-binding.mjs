const DIGEST = /^[a-f0-9]{64}$/u;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exact(value, keys, code) {
  const actual = plain(value) ? Object.keys(value).sort() : [];
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}

function digest(value, code) {
  if (typeof value !== 'string' || !DIGEST.test(value)) fail(code);
  return value;
}

function instant(value, code) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail(code);
  try { if (new Date(value).toISOString() !== value) fail(code); } catch { fail(code); }
  return value;
}

function immutable(value) {
  Object.freeze(value);
  return value;
}

export function confirmTrustedTimeBinding(binding, authority, code = 'TRUSTED_TIME_UNAVAILABLE') {
  exact(binding, [
    'now', 'trustedTimeReceiptDigest', 'useReceiptDigest', 'policyDigest',
    'anchorDigest', 'qualified', 'rollbackDetected'
  ], code);
  if (binding.qualified !== true || binding.rollbackDetected !== false
      || !authority || typeof authority.confirmCurrent !== 'function') fail(code);
  const normalized = {
    now: instant(binding.now, code),
    trustedTimeReceiptDigest: digest(binding.trustedTimeReceiptDigest, code),
    useReceiptDigest: digest(binding.useReceiptDigest, code),
    policyDigest: digest(binding.policyDigest, code),
    anchorDigest: digest(binding.anchorDigest, code),
    qualified: true, rollbackDetected: false
  };
  const confirmation = authority.confirmCurrent({ ...normalized });
  if (!plain(confirmation) || typeof confirmation.then === 'function') fail(code);
  exact(confirmation, [
    'current', 'trustedTimeReceiptDigest', 'useReceiptDigest', 'policyDigest',
    'anchorDigest', 'checkpointDigest', 'rollbackDetected', 'protected', 'repositoryResident'
  ], code);
  if (confirmation.current !== true || confirmation.rollbackDetected !== false
      || confirmation.protected !== true || confirmation.repositoryResident !== false) fail(code);
  for (const field of [
    'trustedTimeReceiptDigest', 'useReceiptDigest', 'policyDigest', 'anchorDigest'
  ]) {
    if (digest(confirmation[field], code) !== normalized[field]) fail(code);
  }
  const checkpointDigest = digest(confirmation.checkpointDigest, code);
  return immutable({ ...normalized, checkpointDigest });
}
