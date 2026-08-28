export const REVIEW_MEASUREMENT_KIND = 'kstack-review-measurement-v1';
export const REVIEW_USAGE_REASON_NOT_SUPPLIED = 'AUTHENTICATED_PROVIDER_RECEIPT_NOT_SUPPLIED';
export const REVIEW_USAGE_REASON_UNTRUSTED = 'AUTHENTICATED_PROVIDER_RECEIPT_UNTRUSTED';

const startOptionKeys = new Set(['enabled', 'monotonicNowNs']);
const finishOptionKeys = new Set(['providerUsageReceipt']);
const UINT64_MAX = (1n << 64n) - 1n;

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function assertPlainOptions(value, allowed, location) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    fail('KSTACK_REVIEW_MEASUREMENT_OPTIONS_INVALID', `${location} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail('KSTACK_REVIEW_MEASUREMENT_OPTIONS_INVALID', `${location}.${key} is unknown`);
  }
}

function exactReviewInputBytes(reviewInput) {
  if (typeof reviewInput === 'string') {
    if (!reviewInput.isWellFormed()) fail('KSTACK_REVIEW_INPUT_INVALID', 'review input must be well-formed Unicode');
    return Buffer.byteLength(reviewInput, 'utf8');
  }
  if (Buffer.isBuffer(reviewInput) || reviewInput instanceof Uint8Array) return reviewInput.byteLength;
  fail('KSTACK_REVIEW_INPUT_INVALID', 'review input must be a string, Buffer, or Uint8Array');
}

function readMonotonic(clock) {
  let value;
  try { value = clock(); }
  catch { fail('KSTACK_REVIEW_MONOTONIC_CLOCK_INVALID'); }
  if (typeof value !== 'bigint' || value < 0n || value > UINT64_MAX) {
    fail('KSTACK_REVIEW_MONOTONIC_CLOCK_INVALID');
  }
  return value;
}

function nullUsage(reason) {
  return Object.freeze({ U: null, W: null, R: null, P: null, closedReason: reason });
}

/**
 * Observe an already-admitted review input without transforming or replacing it.
 *
 * This measurement-only tranche has no qualified provider-receipt admission
 * authority. Consequently every caller-supplied receipt is untrusted and all
 * usage counters remain null. A future qualified supervisor must add the
 * authenticated, exact-binding admission path; CLI text and model output are
 * deliberately not accepted here.
 */
export function beginReviewMeasurement(reviewInput, options = {}) {
  assertPlainOptions(options, startOptionKeys, 'options');
  const enabled = options.enabled ?? false;
  if (typeof enabled !== 'boolean') fail('KSTACK_REVIEW_MEASUREMENT_OPTIONS_INVALID', 'options.enabled must be boolean');
  const monotonicNowNs = options.monotonicNowNs ?? process.hrtime.bigint;
  if (typeof monotonicNowNs !== 'function') fail('KSTACK_REVIEW_MEASUREMENT_OPTIONS_INVALID', 'options.monotonicNowNs must be a function');

  // Preserve the caller's exact value/reference. Measurement must not alter the
  // prompt bytes or carry any routing decision.
  const admittedReviewInput = reviewInput;
  if (!enabled) {
    return Object.freeze({
      reviewInput: admittedReviewInput,
      enabled: false,
      finish(finishOptions = {}) {
        assertPlainOptions(finishOptions, finishOptionKeys, 'finishOptions');
        return null;
      }
    });
  }

  const reviewInputBytes = exactReviewInputBytes(admittedReviewInput);
  const startedNs = readMonotonic(monotonicNowNs);
  let finished = false;
  return Object.freeze({
    reviewInput: admittedReviewInput,
    enabled: true,
    finish(finishOptions = {}) {
      assertPlainOptions(finishOptions, finishOptionKeys, 'finishOptions');
      if (finished) fail('KSTACK_REVIEW_MEASUREMENT_ALREADY_FINISHED');
      finished = true;
      const finishedNs = readMonotonic(monotonicNowNs);
      if (finishedNs < startedNs) fail('KSTACK_REVIEW_MONOTONIC_CLOCK_INVALID');
      const receiptSupplied = finishOptions.providerUsageReceipt !== undefined
        && finishOptions.providerUsageReceipt !== null;
      return Object.freeze({
        schemaVersion: 1,
        kind: REVIEW_MEASUREMENT_KIND,
        reviewInputBytes,
        durationNanoseconds: (finishedNs - startedNs).toString(10),
        providerUsage: nullUsage(receiptSupplied ? REVIEW_USAGE_REASON_UNTRUSTED : REVIEW_USAGE_REASON_NOT_SUPPLIED)
      });
    }
  });
}
