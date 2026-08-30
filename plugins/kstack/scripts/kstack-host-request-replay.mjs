import { assertAsciiId } from './kstack-host-contract.mjs';

const DIGEST = /^sha256:[0-9a-f]{64}$/u;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plain(value, code = 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  return value;
}

function exact(value, fields, code = 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID') {
  plain(value, code);
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) fail(code);
  return value;
}

function digest(value, code = 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID') {
  if (typeof value !== 'string' || !DIGEST.test(value)) fail(code);
  return value;
}

function asciiId(value, code = 'KSTACK_REPLAY_LEDGER_CORRUPT') {
  try { return assertAsciiId(value); } catch { fail(code); }
}

function requireFunction(value) {
  if (typeof value !== 'function') fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function immutable(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') immutable(child);
  return Object.freeze(value);
}

const RESERVE_FIELDS = Object.freeze([
  'proposalDigest', 'contextDraftDigest', 'protectedSessionContextDigest', 'principalDigest',
  'repositoryContextDigest', 'worktreeIdentityDigest', 'operationId', 'operationSchemaDigest',
  'requirementProfileDigest', 'operationClassId', 'inputs', 'limits', 'expiresAt', 'activeSetDigest',
  'policyDigest', 'stateEvidenceDigest'
]);

export function createReplayAdmissionBridge(options) {
  exact(options, ['kernel', 'deriveEffectScope'], 'KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  if (!options.kernel || typeof options.kernel !== 'object') fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  const reserve = requireFunction(options.kernel.reserve?.bind(options.kernel));
  const bindRequest = requireFunction(options.kernel.bindRequest?.bind(options.kernel));
  const burnReservation = requireFunction(options.kernel.burnReservation?.bind(options.kernel));
  const advance = requireFunction(options.kernel.advance?.bind(options.kernel));
  const deriveEffectScope = requireFunction(options.deriveEffectScope);

  return immutable({
    async reserveReplayBindings(input) {
      exact(input, RESERVE_FIELDS);
      for (const field of ['proposalDigest', 'contextDraftDigest', 'protectedSessionContextDigest',
        'repositoryContextDigest', 'worktreeIdentityDigest', 'operationSchemaDigest', 'requirementProfileDigest',
        'activeSetDigest', 'policyDigest', 'stateEvidenceDigest']) digest(input[field]);
      if (input.principalDigest !== null) digest(input.principalDigest);
      if (!Array.isArray(input.inputs)) fail('KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
      plain(input.limits);
      const effectScope = clone(await deriveEffectScope(clone(input)));
      const result = await reserve({
        contextDraftDigest: input.contextDraftDigest,
        protectedSessionContextDigest: input.protectedSessionContextDigest,
        principalDigest: input.principalDigest,
        repositoryContextDigest: input.repositoryContextDigest,
        operationId: input.operationId,
        operationSchemaDigest: input.operationSchemaDigest,
        requirementProfileDigest: input.requirementProfileDigest,
        operationClassId: input.operationClassId,
        effectScope,
        expiresAt: input.expiresAt,
        activeSetDigest: input.activeSetDigest,
        policyDigest: input.policyDigest,
        stateEvidenceDigest: input.stateEvidenceDigest
      });
      if (!result?.reserved) fail(result?.disposition || 'KSTACK_REPLAY_LEDGER_UNAVAILABLE');
      asciiId(result.attemptId, 'KSTACK_REPLAY_LEDGER_UNAVAILABLE');
      return immutable({
        nonceDigest: digest(result.nonceDigest),
        idempotencyKeyDigest: digest(result.idempotencyKeyDigest),
        attemptId: result.attemptId
      });
    },

    async bindReplayRequest(input) {
      const result = await bindRequest(clone(input));
      if (!result?.bound) fail(result?.disposition || 'KSTACK_REPLAY_LEDGER_UNAVAILABLE');
      asciiId(result.attemptId);
      return immutable({ attemptId: result.attemptId, requestDigest: digest(result.requestDigest) });
    },

    async burnReplayReservation(input) {
      return clone(await burnReservation(clone(input)));
    },

    async recordReplayAdmission(input) {
      exact(input, ['attemptId', 'admitted', 'stateEvidenceDigest'], 'KSTACK_REPLAY_LEDGER_CORRUPT');
      asciiId(input.attemptId); digest(input.stateEvidenceDigest, 'KSTACK_REPLAY_LEDGER_CORRUPT');
      if (typeof input.admitted !== 'boolean') fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      const first = await advance({
        attemptId: input.attemptId, toState: 'ADMITTED', stateEvidenceDigest: input.stateEvidenceDigest,
        providerAttemptDigest: null, providerReceiptDigest: null, localResultDigest: null, ambiguity: null
      });
      if (first.state !== 'ADMITTED') fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      if (input.admitted) return immutable({ attemptId: input.attemptId, state: 'ADMITTED' });
      const denied = await advance({
        attemptId: input.attemptId, toState: 'DENIED', stateEvidenceDigest: input.stateEvidenceDigest,
        providerAttemptDigest: null, providerReceiptDigest: null, localResultDigest: null, ambiguity: null
      });
      if (denied.state !== 'DENIED') fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      return immutable({ attemptId: input.attemptId, state: 'DENIED' });
    }
  });
}
