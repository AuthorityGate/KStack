import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultConfig, validateConfig } from '../plugins/kstack/scripts/kstack-config.mjs';
import {
  beginReviewMeasurement,
  REVIEW_MEASUREMENT_KIND,
  REVIEW_USAGE_REASON_NOT_SUPPLIED,
  REVIEW_USAGE_REASON_UNTRUSTED
} from '../plugins/kstack/scripts/kstack-review-measurement.mjs';

function clock(...values) {
  let index = 0;
  return () => values[index++];
}

test('context reduction defaults are all disabled and valid', () => {
  const config = structuredClone(defaultConfig);
  assert.deepEqual(config.workflow.contextReduction, {
    measurementEnabled: false,
    eagerInstructionsEnabled: false,
    slicingEnabled: false,
    qualificationEvidenceSha256: null,
    qualificationRouteId: null,
    qualificationProfileId: null
  });
  assert.deepEqual(validateConfig(config), []);
});

test('measurement-disabled wrapper preserves exact review input identity and bytes', () => {
  const prompt = Buffer.from([0x00, 0x41, 0xff, 0x0a]);
  const before = Buffer.from(prompt);
  let clockCalls = 0;
  const observation = beginReviewMeasurement(prompt, {
    enabled: false,
    monotonicNowNs: () => { clockCalls += 1; return 1n; }
  });
  assert.equal(observation.reviewInput, prompt);
  assert.equal(observation.finish(), null);
  assert.deepEqual(prompt, before);
  assert.equal(clockCalls, 0);
  assert.equal(Object.hasOwn(observation, 'route'), false);
});

test('measurement records exact admitted UTF-8 bytes and injected monotonic duration', () => {
  const prompt = 'A\u20ac\ud83d\ude00';
  const observation = beginReviewMeasurement(prompt, {
    enabled: true,
    monotonicNowNs: clock(100n, 650n)
  });
  const result = observation.finish();
  assert.equal(observation.reviewInput, prompt);
  assert.deepEqual(result, {
    schemaVersion: 1,
    kind: REVIEW_MEASUREMENT_KIND,
    reviewInputBytes: Buffer.byteLength(prompt, 'utf8'),
    durationNanoseconds: '550',
    providerUsage: {
      U: null,
      W: null,
      R: null,
      P: null,
      closedReason: REVIEW_USAGE_REASON_NOT_SUPPLIED
    }
  });
});

test('caller-supplied or forged usage receipts never populate U/W/R/P', () => {
  const forged = {
    authenticated: true,
    usage: { U: 1, W: 2, R: 3, P: 6 },
    cliOutput: 'input_tokens=1'
  };
  const result = beginReviewMeasurement('prompt', {
    enabled: true,
    monotonicNowNs: clock(1n, 2n)
  }).finish({ providerUsageReceipt: forged });
  assert.deepEqual(result.providerUsage, {
    U: null,
    W: null,
    R: null,
    P: null,
    closedReason: REVIEW_USAGE_REASON_UNTRUSTED
  });
  assert.doesNotMatch(JSON.stringify(result), /input_tokens|authenticated|\"usage\"/);
});

test('eager instructions and slicing fail closed without qualification evidence and a supported pair', () => {
  for (const key of ['eagerInstructionsEnabled', 'slicingEnabled']) {
    const config = structuredClone(defaultConfig);
    config.workflow.contextReduction[key] = true;
    let errors = validateConfig(config).join('\n');
    assert.match(errors, /requires qualificationEvidenceSha256/);
    assert.match(errors, /requires a supported qualified route\/profile; none are qualified/);

    config.workflow.contextReduction.qualificationEvidenceSha256 = 'a'.repeat(64);
    config.workflow.contextReduction.qualificationRouteId = 'invented-route';
    config.workflow.contextReduction.qualificationProfileId = 'invented-profile';
    errors = validateConfig(config).join('\n');
    assert.doesNotMatch(errors, /requires qualificationEvidenceSha256/);
    assert.match(errors, /requires a supported qualified route\/profile; none are qualified/);
  }
});

test('measurement can be enabled independently without a qualification claim', () => {
  const config = structuredClone(defaultConfig);
  config.workflow.contextReduction.measurementEnabled = true;
  assert.deepEqual(validateConfig(config), []);
});

test('qualification evidence, route, and profile form an atomic all-null or all-complete tuple', () => {
  const values = {
    qualificationEvidenceSha256: 'a'.repeat(64),
    qualificationRouteId: 'candidate-route',
    qualificationProfileId: 'candidate-profile'
  };
  const keys = Object.keys(values);
  for (let mask = 1; mask < 7; mask += 1) {
    const config = structuredClone(defaultConfig);
    keys.forEach((key, index) => {
      if ((mask & (1 << index)) !== 0) config.workflow.contextReduction[key] = values[key];
    });
    const errors = validateConfig(config).join('\n');
    assert.match(
      errors,
      /qualificationEvidenceSha256, qualificationRouteId, and qualificationProfileId must be all null or all configured/,
      `partial qualification tuple mask ${mask} must fail`
    );
  }

  const complete = structuredClone(defaultConfig);
  Object.assign(complete.workflow.contextReduction, values);
  const completeErrors = validateConfig(complete).join('\n');
  assert.doesNotMatch(completeErrors, /must be all null or all configured/);
  assert.match(completeErrors, /is not a supported qualified pair/);
});

test('atomic qualification tuple still rejects every malformed field', () => {
  const malformed = [
    ['qualificationEvidenceSha256', 'A'.repeat(64), /qualificationEvidenceSha256 must be null or lowercase 64-hex/],
    ['qualificationEvidenceSha256', 'a'.repeat(63), /qualificationEvidenceSha256 must be null or lowercase 64-hex/],
    ['qualificationRouteId', 'Candidate_Route', /qualificationRouteId must be null or a lower-case hyphen-case ID/],
    ['qualificationProfileId', '', /qualificationProfileId must be null or a lower-case hyphen-case ID/]
  ];
  for (const [key, value, pattern] of malformed) {
    const config = structuredClone(defaultConfig);
    Object.assign(config.workflow.contextReduction, {
      qualificationEvidenceSha256: 'a'.repeat(64),
      qualificationRouteId: 'candidate-route',
      qualificationProfileId: 'candidate-profile',
      [key]: value
    });
    assert.match(validateConfig(config).join('\n'), pattern);
  }
});

test('a present context reduction block cannot omit an atomic tuple member', () => {
  for (const key of ['qualificationEvidenceSha256', 'qualificationRouteId', 'qualificationProfileId']) {
    const config = structuredClone(defaultConfig);
    delete config.workflow.contextReduction[key];
    assert.match(
      validateConfig(config).join('\n'),
      /qualificationEvidenceSha256, qualificationRouteId, and qualificationProfileId must be all null or all configured/
    );
  }
});

test('legacy configuration may omit the context reduction block', () => {
  const config = structuredClone(defaultConfig);
  delete config.workflow.contextReduction;
  assert.deepEqual(validateConfig(config), []);
});

test('context reduction schema rejects unknown keys, malformed digests, and unsupported dormant pairs', () => {
  const config = structuredClone(defaultConfig);
  config.workflow.contextReduction.extra = true;
  config.workflow.contextReduction.qualificationEvidenceSha256 = 'A'.repeat(64);
  config.workflow.contextReduction.qualificationRouteId = 'invented-route';
  config.workflow.contextReduction.qualificationProfileId = 'invented-profile';
  const errors = validateConfig(config).join('\n');
  assert.match(errors, /workflow\.contextReduction\.extra is unknown/);
  assert.match(errors, /qualificationEvidenceSha256 must be null or lowercase 64-hex/);
  assert.match(errors, /qualificationRouteId\/qualificationProfileId is not a supported qualified pair/);
});

test('measurement rejects unknown options, hostile inputs, clock rollback, and reuse', () => {
  assert.throws(
    () => beginReviewMeasurement('prompt', { enabled: true, route: 'changed' }),
    { code: 'KSTACK_REVIEW_MEASUREMENT_OPTIONS_INVALID' }
  );
  assert.throws(
    () => beginReviewMeasurement('\ud800', { enabled: true, monotonicNowNs: clock(1n) }),
    { code: 'KSTACK_REVIEW_INPUT_INVALID' }
  );
  assert.throws(
    () => beginReviewMeasurement('prompt', { enabled: true, monotonicNowNs: clock(2n, 1n) }).finish(),
    { code: 'KSTACK_REVIEW_MONOTONIC_CLOCK_INVALID' }
  );
  const observation = beginReviewMeasurement('prompt', { enabled: true, monotonicNowNs: clock(1n, 2n) });
  observation.finish();
  assert.throws(() => observation.finish(), { code: 'KSTACK_REVIEW_MEASUREMENT_ALREADY_FINISHED' });
});
