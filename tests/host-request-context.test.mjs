import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HOST_ADMISSION_REASON_CODES,
  HOST_CONTEXT_IDENTITIES,
  HOST_OPERATION_CLASSES,
  ProtectedRequestAdmissionKernel,
  contextHead,
  hostAdmissionExplanation,
  validateHostContextArtifact
} from '../plugins/kstack/scripts/kstack-host-request-context.mjs';
import {
  artifactHead,
  validateHostArtifact
} from '../plugins/kstack/scripts/kstack-host-contract.mjs';

const digest = (character = 'a') => `sha256:${character.repeat(64)}`;
const schemaSetDigest = digest('f');
const createdAt = '2026-08-28T12:01:00.000Z';
const expiresAt = '2026-08-28T12:10:00.000Z';
const vocabulary = Object.freeze({
  mediaTypes: ['application-json'], operationIds: ['inspect', 'publish'], operationClassIds: [...HOST_OPERATION_CLASSES],
  capabilityIds: ['file-read'], fixtureIds: ['basic'], reasonCodes: ['KSTACK_HOST_CLASS_MISMATCH'],
  errorCodes: ['KSTACK_HOST_DENIED'], operationProfileIds: ['read-safe'], componentRoles: ['runtime'],
  receiptKinds: ['local'], quarantineSubjectTypes: ['host']
});

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected, expected);
}

async function rejectsCode(expected, action) {
  await assert.rejects(action, (error) => error?.code === expected, expected);
}

function tupleSort(left, right) {
  return left.length - right.length || Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function profile(operationId, operationClassId, operationSchemaDigest) {
  return {
    ...artifactHead('OperationRequirementProfileV1', schemaSetDigest), operationId, operationSchemaDigest, operationClassId,
    requiredCapabilities: [{ capabilityId: 'file-read', evidenceProfileDigest: digest('1'), mandatory: true }],
    negativeFixtureIds: ['basic'], receiptProfileDigest: digest('2'), actionFenceProfileDigest: digest('3'), alternateProfiles: []
  };
}

function proposal(operationId = 'inspect', changes = {}) {
  return {
    ...contextHead('UntrustedOperationProposalV1', schemaSetDigest), operationId,
    inputs: [{ name: 'input', mediaTypeId: 'application-json', artifactRef: { schemaDigest: digest('4'), objectDigest: digest('5'), byteCount: 64 } }],
    requestedLimits: { deadlineMs: 5000, maxInputBytes: 1024, maxOutputBytes: 2048 },
    candidateRepositoryLocatorDigest: digest('6'),
    displayEchoes: { operationClassId: null, hostInstanceDigest: null, hostBuildDigest: null, adapterDigest: null },
    ...changes
  };
}

function fixture(options = {}) {
  const operationId = options.operationId ?? 'inspect';
  const operationClassId = options.operationClassId ?? 'LOCAL_READ';
  const operationSchemaDigest = options.operationSchemaDigest ?? digest('7');
  const requirement = profile(operationId, operationClassId, operationSchemaDigest);
  const requirementProfileDigest = validateHostArtifact('OperationRequirementProfileV1', requirement, { vocabulary }).objectDigest;
  const activeSetDigest = digest('8');
  const policyDigest = digest('9');
  const sourceProfile = {
    ...contextHead('ContextSourceProfileV1', schemaSetDigest), profileId: 'protected-source', implementationDigest: digest('a'),
    configurationDigest: digest('b'), maximumAssuranceLevel: 'PROTECTED_BROKER', activeSetDigest
  };
  const sourceProfileDigest = validateHostContextArtifact('ContextSourceProfileV1', sourceProfile).objectDigest;
  const principalDigest = options.assuranceLevel === 'PUBLIC_UNAUTHENTICATED' ? null : digest('c');
  const channel = {
    ...contextHead('AuthenticatedChannelContextV1', schemaSetDigest), contextSourceProfileDigest: sourceProfileDigest,
    channelInstanceDigest: digest('d'), launchNonceDigest: digest('e'), peerPrincipalDigest: principalDigest,
    peerEvidenceDigest: digest('1'), processEvidenceDigest: digest('2'), hostInstanceDigest: digest('3'), hostBuildDigest: digest('4'),
    adapterDigest: digest('5'), establishedAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-08-28T12:20:00.000Z',
    assuranceLevel: options.assuranceLevel ?? 'AUTHENTICATED_LOCAL'
  };
  const channelDigest = validateHostContextArtifact('AuthenticatedChannelContextV1', channel).objectDigest;
  const repository = {
    ...contextHead('RepositoryContextV1', schemaSetDigest), canonicalRepositoryIdentityDigest: digest('6'), worktreeIdentityDigest: digest('7'),
    vcsMetadataIdentityDigest: digest('8'), openedRootIdentityDigest: digest('9'), mountNamespaceIdentityDigest: digest('a'),
    caseSensitivityProfileId: 'case-sensitive', rootMeasurementEvidenceDigest: digest('b'), observedAt: '2026-08-28T12:00:00.000Z',
    expiresAt: '2026-08-28T12:20:00.000Z'
  };
  const repositoryDigest = validateHostContextArtifact('RepositoryContextV1', repository).objectDigest;
  const session = {
    ...contextHead('ProtectedSessionContextV1', schemaSetDigest), sessionIdDigest: digest('c'), authenticatedChannelContextDigest: channelDigest,
    principalDigest, hostInstanceDigest: channel.hostInstanceDigest, hostBuildDigest: channel.hostBuildDigest, adapterDigest: channel.adapterDigest,
    repositoryContextDigest: repositoryDigest, activeSetDigest, issuedAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-08-28T12:20:00.000Z',
    revocationStateDigest: digest('d')
  };
  const approvalRequired = options.approvalRequired ?? ['ASK_SIDE_EFFECT', 'PRIVILEGED_SIDE_EFFECT'].includes(operationClassId);
  const rules = HOST_OPERATION_CLASSES.map((classId) => ({
    operationClassId: classId,
    minimumAssuranceLevel: classId === operationClassId
      ? (options.minimumAssuranceLevel ?? (approvalRequired ? 'PROTECTED_BROKER' : 'AUTHENTICATED_LOCAL'))
      : 'PUBLIC_UNAUTHENTICATED',
    approvalRequired: classId === operationClassId ? approvalRequired : false,
    maxLimits: { deadlineMs: 3000, maxInputBytes: 512, maxOutputBytes: 1024 },
    approvalAudienceId: 'repository-owner', actionScopeDigest: digest('e'), principalDisplayRefDigest: digest('f'),
    sideEffectTargetRefDigest: classId === operationClassId && approvalRequired ? digest('1') : null,
    riskCodes: ['KSTACK_HOST_CLASS_MISMATCH'], recoveryCodes: ['KSTACK_HOST_DENIED']
  })).sort((left, right) => tupleSort(left.operationClassId, right.operationClassId));
  const operationRegistry = {
    ...contextHead('OperationRegistryV1', schemaSetDigest), registryId: 'base', activeSetDigest,
    entries: [{ operationId, operationSchemaDigest, requirementProfileDigest }]
  };
  const state = {
    policyDigest,
    evidenceDigest: digest('2'),
    snapshotCount: 0,
    channelCount: 0,
    repositoryCount: 0,
    sessionCount: 0,
    evidenceCount: 0,
    runtimeCount: 0,
    inputValidationCount: 0,
    replayReservations: [],
    replayBindings: [],
    replayBurns: [],
    replayAdmissions: [],
    protectedDisplayReceipts: new Set(),
    protectedApprovalEnvelopes: new Set(),
    now: '2026-08-28T12:02:00.000Z',
    runtime: { hostInstanceDigest: channel.hostInstanceDigest, hostBuildDigest: channel.hostBuildDigest, adapterDigest: channel.adapterDigest },
    approvalDecision: 'APPROVE'
  };
  const dependencies = {
    bindChannel: async () => {
      state.channelCount += 1; options.onChannel?.(state.channelCount, channel, state);
      return structuredClone(options.channel ?? channel);
    },
    resolveRepository: async () => {
      state.repositoryCount += 1; options.onRepository?.(state.repositoryCount, repository, state);
      return structuredClone(options.repository ?? repository);
    },
    resolveSession: async () => {
      state.sessionCount += 1; options.onSession?.(state.sessionCount, session, state);
      return structuredClone(options.session ?? session);
    },
    snapshotGovernance: async () => {
      state.snapshotCount += 1;
      options.onSnapshot?.(state.snapshotCount, state);
      return structuredClone({ activeSetDigest, policyDigest: state.policyDigest, operationRegistry, classRules: rules });
    },
    resolveContextSourceProfile: async () => structuredClone(sourceProfile),
    resolveRequirementProfile: async () => structuredClone(options.requirement ?? requirement),
    validateInputArtifact: async (value) => {
      state.inputValidationCount += 1;
      options.onValidateInput?.(state.inputValidationCount, value, state);
      return structuredClone(options.resolvedInput ?? value);
    },
    currentEvidenceSet: async () => {
      state.evidenceCount += 1; options.onEvidence?.(state.evidenceCount, state);
      return { hostEvidenceSetDigest: state.evidenceDigest };
    },
    reserveReplayBindings: async (value) => {
      state.replayReservations.push(structuredClone(value));
      options.onReplayReserve?.(value, state);
      return { nonceDigest: digest('3'), idempotencyKeyDigest: digest('4'), attemptId: 'attempt-1' };
    },
    bindReplayRequest: async (value) => {
      state.replayBindings.push(structuredClone(value));
      options.onReplayBind?.(value, state);
      return { attemptId: 'attempt-1', requestDigest: value.requestDigest };
    },
    burnReplayReservation: async (value) => {
      state.replayBurns.push(structuredClone(value));
      options.onReplayBurn?.(value, state);
      return { burned: true };
    },
    recordReplayAdmission: async (value) => {
      state.replayAdmissions.push(structuredClone(value));
      options.onReplayAdmission?.(value, state);
      return { attemptId: value.attemptId, state: value.admitted ? 'ADMITTED' : 'DENIED' };
    },
    deriveTimes: async () => structuredClone(options.times ?? { createdAt, expiresAt }),
    currentInstant: async () => state.now,
    remeasureRuntime: async () => {
      state.runtimeCount += 1; options.onRuntime?.(state.runtimeCount, state.runtime, state);
      return structuredClone(state.runtime);
    },
    presentApproval: async (display) => {
      const receipt = {
        ...contextHead('ProtectedDisplayReceiptV1', schemaSetDigest),
        approvalDisplayDigest: validateHostContextArtifact('ApprovalDisplayV1', display).objectDigest,
        presentationChannelDigest: digest('5'), presentedAt: '2026-08-28T12:01:01.000Z'
      };
      state.protectedDisplayReceipts.add(validateHostContextArtifact('ProtectedDisplayReceiptV1', receipt).objectDigest);
      return receipt;
    },
    requestApproval: async ({ subject, display, displayReceipt }) => {
      if (state.approvalDecision !== 'APPROVE') return { decision: state.approvalDecision };
      const envelope = {
        ...contextHead('ProtectedApprovalEnvelopeV1', schemaSetDigest),
        approvalSubjectDigest: validateHostContextArtifact('ApprovalSubjectV1', subject).objectDigest,
        approvalDisplayDigest: validateHostContextArtifact('ApprovalDisplayV1', display).objectDigest,
        displayReceiptDigest: validateHostContextArtifact('ProtectedDisplayReceiptV1', displayReceipt).objectDigest,
        principalDigest, protectedSessionContextDigest: validateHostContextArtifact('ProtectedSessionContextV1', session).objectDigest,
        repositoryContextDigest: repositoryDigest, hostInstanceDigest: channel.hostInstanceDigest, hostBuildDigest: channel.hostBuildDigest,
        approvalAudienceId: 'repository-owner', actionScopeDigest: digest('e'), nonceDigest: digest('3'),
        issuedAt: '2026-08-28T12:01:02.000Z', expiresAt: '2026-08-28T12:09:00.000Z', decision: 'APPROVE'
      };
      state.protectedApprovalEnvelopes.add(validateHostContextArtifact('ProtectedApprovalEnvelopeV1', envelope).objectDigest);
      return envelope;
    },
    verifyApproval: async ({ displayReceiptDigest, approvalEnvelopeDigest }) => ({
      valid: state.protectedDisplayReceipts.has(displayReceiptDigest) && state.protectedApprovalEnvelopes.has(approvalEnvelopeDigest),
      displayReceiptDigest,
      approvalEnvelopeDigest
    })
  };
  return {
    kernel: new ProtectedRequestAdmissionKernel({ schemaSetDigest, vocabulary, dependencies }),
    state, dependencies, proposal: proposal(operationId), channel, repository, session, sourceProfile, operationRegistry, requirement, rules
  };
}

test('HP-TC02 publishes every protected context and admission artifact identity', () => {
  assert.deepEqual(Object.keys(HOST_CONTEXT_IDENTITIES).sort(), [
    'AdmissionTranscriptV1', 'ApprovalDisplayV1', 'ApprovalSubjectV1', 'AuthenticatedChannelContextV1',
    'ContextSourceProfileV1', 'OperationRegistryV1', 'ProtectedApprovalEnvelopeV1', 'ProtectedDisplayReceiptV1',
    'ProtectedSessionContextV1', 'RepositoryContextV1', 'RequestAdmissionResultV1', 'TrustedRequestContextV1',
    'UntrustedOperationProposalV1'
  ]);
  const value = proposal();
  assert.match(validateHostContextArtifact('UntrustedOperationProposalV1', value).objectDigest, /^sha256:/u);
  code('KSTACK_HOST_CONTEXT_SHAPE_INVALID', () => validateHostContextArtifact('UntrustedOperationProposalV1', {
    ...value, principalDigest: digest('a')
  }));
});

test('protected admission derives a read request without accepting trusted caller fields', async () => {
  const current = fixture();
  const admitted = await current.kernel.admit(current.proposal);
  assert.equal(admitted.outcome, 'ADMITTED');
  assert.equal(admitted.operationClassId, 'LOCAL_READ');
  assert.deepEqual(admitted.request.limits, { deadlineMs: 3000, maxInputBytes: 512, maxOutputBytes: 1024 });
  assert.equal(admitted.request.authorityEnvelopeDigest, null);
  assert.equal(admitted.approvalSubject, null);
  assert.equal(admitted.trustedRequestContext.principalDigest, current.channel.peerPrincipalDigest);
  assert.deepEqual(await current.kernel.verifyHandoff(admitted), {
    valid: true, requestDigest: admitted.requestDigest, verifiedAt: current.state.now
  });
});

test('approval construction is acyclic and exact for protected side effects', async () => {
  const current = fixture({ operationId: 'publish', operationClassId: 'ASK_SIDE_EFFECT', assuranceLevel: 'PROTECTED_BROKER' });
  const admitted = await current.kernel.admit(current.proposal);
  assert.equal(admitted.outcome, 'ADMITTED');
  assert.equal(admitted.request.authorityEnvelopeDigest, admitted.approvalEnvelopeDigest);
  assert.equal(admitted.approvalEnvelope.approvalSubjectDigest, admitted.approvalSubjectDigest);
  assert.equal(admitted.approvalDisplay.approvalSubjectDigest, admitted.approvalSubjectDigest);
  assert.equal(Object.hasOwn(admitted.approvalSubject, 'authorityEnvelopeDigest'), false);
  assert.equal((await current.kernel.verifyHandoff(admitted)).valid, true);

  const changed = structuredClone(admitted);
  changed.request.policyDigest = digest('0');
  await rejectsCode('KSTACK_HOST_TRANSPORT_CHANGED', () => current.kernel.verifyHandoff(changed));
  const substituted = structuredClone(admitted);
  substituted.approvalEnvelope.actionScopeDigest = digest('0');
  await rejectsCode('KSTACK_HOST_APPROVAL_ENVELOPE_MISMATCH', () => current.kernel.verifyHandoff(substituted));
});

test('replay reservation binds the exact final request before durable admission', async () => {
  const events = [];
  const current = fixture({
    operationId: 'publish', operationClassId: 'ASK_SIDE_EFFECT', assuranceLevel: 'PROTECTED_BROKER',
    onReplayReserve: () => events.push('RESERVED'),
    onReplayBind: () => events.push('REQUEST_BOUND'),
    onReplayAdmission: (value) => events.push(value.admitted ? 'ADMITTED' : 'DENIED')
  });
  const admitted = await current.kernel.admit(current.proposal);
  assert.equal(admitted.outcome, 'ADMITTED');
  assert.deepEqual(events, ['RESERVED', 'REQUEST_BOUND', 'ADMITTED']);
  assert.equal(current.state.replayBurns.length, 0);
  assert.equal(current.state.replayBindings[0].requestDigest, admitted.requestDigest);
  assert.equal(current.state.replayBindings[0].approvalSubjectDigest, admitted.approvalSubjectDigest);
  assert.equal(current.state.replayBindings[0].authorityEnvelopeDigest, admitted.approvalEnvelopeDigest);
  assert.equal(current.state.replayReservations[0].protectedSessionContextDigest,
    admitted.trustedRequestContext.protectedSessionContextDigest);
});

test('approval denial burns the unbound reservation and a post-bind epoch race records denial', async () => {
  const approval = fixture({ operationId: 'publish', operationClassId: 'ASK_SIDE_EFFECT', assuranceLevel: 'PROTECTED_BROKER' });
  approval.state.approvalDecision = 'DENY';
  const rejected = await approval.kernel.admit(approval.proposal);
  assert.equal(rejected.reasonCode, 'KSTACK_HOST_APPROVAL_DENIED');
  assert.equal(approval.state.replayReservations.length, 1);
  assert.equal(approval.state.replayBindings.length, 0);
  assert.deepEqual(approval.state.replayBurns, [{ nonceDigest: digest('3') }]);
  assert.equal(approval.state.replayAdmissions.length, 0);

  const raced = fixture({
    onSnapshot: (count, state) => { if (count === 3) state.policyDigest = digest('0'); }
  });
  const denied = await raced.kernel.admit(raced.proposal);
  assert.equal(denied.reasonCode, 'KSTACK_HOST_POLICY_CHANGED');
  assert.equal(raced.state.replayBindings.length, 1);
  assert.equal(raced.state.replayBurns.length, 0);
  assert.deepEqual(raced.state.replayAdmissions, [{
    attemptId: 'attempt-1', admitted: false, stateEvidenceDigest: digest('2')
  }]);
});

test('diagnostic class echoes can compare but never downgrade the registry class', async () => {
  const current = fixture({ operationId: 'publish', operationClassId: 'ASK_SIDE_EFFECT', assuranceLevel: 'PROTECTED_BROKER' });
  current.proposal.displayEchoes.operationClassId = 'LOCAL_READ';
  const denied = await current.kernel.admit(current.proposal);
  assert.equal(denied.outcome, 'DENIED');
  assert.equal(denied.reasonCode, 'KSTACK_HOST_CLASS_MISMATCH');
  assert.equal(denied.requestDigest, undefined);
  assert.equal(denied.result.requestDigest, null);
});

test('assurance, session, input, and approval failures return closed stable outcomes', async () => {
  const insufficient = fixture({ operationId: 'publish', operationClassId: 'ASK_SIDE_EFFECT', assuranceLevel: 'AUTHENTICATED_LOCAL' });
  const assuranceResult = await insufficient.kernel.admit(insufficient.proposal);
  assert.equal(assuranceResult.outcome, 'DENIED');
  assert.equal(assuranceResult.reasonCode, 'KSTACK_HOST_ASSURANCE_INSUFFICIENT');

  const mismatched = fixture();
  mismatched.session.activeSetDigest = digest('0');
  const sessionResult = await mismatched.kernel.admit(mismatched.proposal);
  assert.equal(sessionResult.reasonCode, 'KSTACK_HOST_ACTIVE_SET_CHANGED');

  const wrongInput = fixture({ resolvedInput: { schemaDigest: digest('4'), objectDigest: digest('0'), byteCount: 64 } });
  const inputResult = await wrongInput.kernel.admit(wrongInput.proposal);
  assert.equal(inputResult.reasonCode, 'KSTACK_HOST_INPUT_MISMATCH');

  const deniedApproval = fixture({ operationId: 'publish', operationClassId: 'ASK_SIDE_EFFECT', assuranceLevel: 'PROTECTED_BROKER' });
  deniedApproval.state.approvalDecision = 'DENY';
  const approvalResult = await deniedApproval.kernel.admit(deniedApproval.proposal);
  assert.equal(approvalResult.reasonCode, 'KSTACK_HOST_APPROVAL_DENIED');
  assert.equal(approvalResult.result.approvalEnvelopeDigest, null);
});

test('public context requires an explicit public rule and cannot carry a principal', async () => {
  const current = fixture({ assuranceLevel: 'PUBLIC_UNAUTHENTICATED', minimumAssuranceLevel: 'PUBLIC_UNAUTHENTICATED' });
  const admitted = await current.kernel.admit(current.proposal);
  assert.equal(admitted.outcome, 'ADMITTED');
  assert.equal(admitted.trustedRequestContext.principalDigest, null);
  const claimed = structuredClone(current.channel);
  claimed.peerPrincipalDigest = digest('0');
  code('KSTACK_HOST_PRINCIPAL_MISMATCH', () => validateHostContextArtifact('AuthenticatedChannelContextV1', claimed));
});

test('handoff re-resolves protected policy, evidence, root, runtime, and expiry', async () => {
  const policy = fixture();
  const policyBundle = await policy.kernel.admit(policy.proposal);
  policy.state.policyDigest = digest('0');
  await rejectsCode('KSTACK_HOST_POLICY_CHANGED', () => policy.kernel.verifyHandoff(policyBundle));

  const evidence = fixture();
  const evidenceBundle = await evidence.kernel.admit(evidence.proposal);
  evidence.state.evidenceDigest = digest('0');
  await rejectsCode('KSTACK_HOST_EVIDENCE_SET_CHANGED', () => evidence.kernel.verifyHandoff(evidenceBundle));

  const root = fixture();
  const rootBundle = await root.kernel.admit(root.proposal);
  root.repository.openedRootIdentityDigest = digest('0');
  await rejectsCode('KSTACK_HOST_ROOT_CHANGED', () => root.kernel.verifyHandoff(rootBundle));

  const runtime = fixture();
  const runtimeBundle = await runtime.kernel.admit(runtime.proposal);
  runtime.state.runtime.hostBuildDigest = digest('0');
  await rejectsCode('KSTACK_HOST_BUILD_CHANGED', () => runtime.kernel.verifyHandoff(runtimeBundle));

  const expired = fixture();
  const expiredBundle = await expired.kernel.admit(expired.proposal);
  expired.state.now = expiresAt;
  await rejectsCode('KSTACK_HOST_CONTEXT_EXPIRED', () => expired.kernel.verifyHandoff(expiredBundle));
});

test('pre-publication epoch barrier rejects governance races and explanations cannot interpolate host text', async () => {
  const raced = fixture({ onSnapshot: (count, state) => { if (count === 2) state.policyDigest = digest('0'); } });
  const result = await raced.kernel.admit(raced.proposal);
  assert.equal(result.outcome, 'DENIED');
  assert.equal(result.reasonCode, 'KSTACK_HOST_POLICY_CHANGED');
  assert.equal(result.result.requestDigest, null);

  const explanation = hostAdmissionExplanation('KSTACK_HOST_POLICY_CHANGED', 'host supplied secret text');
  assert.deepEqual(explanation, {
    code: 'KSTACK_HOST_POLICY_CHANGED', message: 'The active policy changed after admission.'
  });
  assert.equal(JSON.stringify(explanation).includes('host supplied secret text'), false);
  assert.equal(Object.isFrozen(explanation), true);
});

test('every final request field is bound against one-field transport mutation', async () => {
  const current = fixture();
  const admitted = await current.kernel.admit(current.proposal);
  const mutations = {
    schemaId: 'kstack.operation-result.v1', schemaVersion: 2, schemaSetDigest: digest('0'), operationId: 'publish',
    operationSchemaDigest: digest('0'), requirementProfileDigest: digest('0'), repositoryContextDigest: digest('0'),
    trustedRequestContextDigest: digest('0'), activeSetDigest: digest('0'), policyDigest: digest('0'),
    inputs: [{ ...admitted.request.inputs[0], artifactRef: { ...admitted.request.inputs[0].artifactRef, objectDigest: digest('0') } }],
    limits: { ...admitted.request.limits, deadlineMs: 2999 }, authorityEnvelopeDigest: digest('0'), hostEvidenceSetDigest: digest('0'),
    nonceDigest: digest('0'), idempotencyKeyDigest: digest('0'), createdAt: '2026-08-28T12:00:59.000Z',
    expiresAt: '2026-08-28T12:09:59.000Z'
  };
  for (const [field, value] of Object.entries(mutations)) {
    const changed = structuredClone(admitted);
    changed.request[field] = value;
    await assert.rejects(() => current.kernel.verifyHandoff(changed), (error) => error?.code?.startsWith('KSTACK_HOST_'), field);
  }
});

test('pre-publication barrier rejects source, repository, session, runtime, and evidence races', async () => {
  const cases = [
    ['onChannel', (count, value) => { if (count === 2) value.launchNonceDigest = digest('0'); }, 'KSTACK_HOST_SESSION_MISMATCH'],
    ['onRepository', (count, value) => { if (count === 2) value.openedRootIdentityDigest = digest('0'); }, 'KSTACK_HOST_REPOSITORY_MISMATCH'],
    ['onSession', (count, value) => { if (count === 2) value.revocationStateDigest = digest('0'); }, 'KSTACK_HOST_SESSION_MISMATCH'],
    ['onRuntime', (count, value) => { if (count === 2) value.adapterDigest = digest('0'); }, 'KSTACK_HOST_ADAPTER_CHANGED'],
    ['onEvidence', (count, state) => { if (count === 2) state.evidenceDigest = digest('0'); }, 'KSTACK_HOST_EVIDENCE_SET_CHANGED']
  ];
  for (const [hook, action, expected] of cases) {
    const current = fixture({ [hook]: action });
    const result = await current.kernel.admit(current.proposal);
    assert.equal(result.outcome, 'DENIED', hook);
    assert.equal(result.reasonCode, expected, hook);
  }
});

test('proposal boundary excludes every caller-controlled trusted or fallback field', () => {
  const forbidden = [
    'principalDigest', 'operationClassId', 'policyDigest', 'hostEvidenceSetDigest', 'activeSetDigest', 'approvalEnvelopeDigest',
    'trustedRequestContextDigest', 'protectedSessionContextDigest', 'cwd', 'repositoryPath', 'environment', 'hostClientName'
  ];
  for (const field of forbidden) code('KSTACK_HOST_CONTEXT_SHAPE_INVALID', () => validateHostContextArtifact('UntrustedOperationProposalV1', {
    ...proposal(), [field]: field.endsWith('Digest') ? digest('0') : 'caller-controlled'
  }));
});

test('registry, profile, schema, public-promotion, and stale-context failures are distinct', async () => {
  const unknown = fixture();
  unknown.proposal.operationId = 'publish';
  assert.equal((await unknown.kernel.admit(unknown.proposal)).reasonCode, 'KSTACK_HOST_OPERATION_UNKNOWN');

  const schemaMismatch = fixture();
  schemaMismatch.requirement.operationSchemaDigest = digest('0');
  assert.equal((await schemaMismatch.kernel.admit(schemaMismatch.proposal)).reasonCode, 'KSTACK_HOST_OPERATION_SCHEMA_MISMATCH');

  const profileMismatch = fixture();
  profileMismatch.requirement.receiptProfileDigest = digest('0');
  assert.equal((await profileMismatch.kernel.admit(profileMismatch.proposal)).reasonCode, 'KSTACK_HOST_PROFILE_MISMATCH');

  const publicPromotion = fixture({ assuranceLevel: 'PUBLIC_UNAUTHENTICATED' });
  assert.equal((await publicPromotion.kernel.admit(publicPromotion.proposal)).reasonCode, 'KSTACK_HOST_ASSURANCE_INSUFFICIENT');

  const stale = fixture({ times: { createdAt: '2026-08-28T12:20:00.000Z', expiresAt: '2026-08-28T12:21:00.000Z' } });
  assert.equal((await stale.kernel.admit(stale.proposal)).reasonCode, 'KSTACK_HOST_CONTEXT_EXPIRED');

  const crossSchemaSet = fixture();
  crossSchemaSet.proposal.schemaSetDigest = digest('0');
  assert.equal((await crossSchemaSet.kernel.admit(crossSchemaSet.proposal)).reasonCode, 'KSTACK_HOST_PROFILE_MISMATCH');
});

test('approval subject, display, receipt, and envelope substitutions all fail closed', async () => {
  const current = fixture({ operationId: 'publish', operationClassId: 'ASK_SIDE_EFFECT', assuranceLevel: 'PROTECTED_BROKER' });
  const admitted = await current.kernel.admit(current.proposal);
  const mutations = [
    ['approvalSubject', 'policyDigest', digest('0')],
    ['approvalDisplay', 'hostBuildDigest', digest('0')],
    ['displayReceipt', 'presentationChannelDigest', digest('0')],
    ['approvalEnvelope', 'approvalAudienceId', 'another-audience'],
    ['approvalEnvelope', 'approvalSubjectDigest', admitted.approvalEnvelopeDigest]
  ];
  for (const [artifact, field, value] of mutations) {
    const changed = structuredClone(admitted);
    changed[artifact][field] = value;
    await assert.rejects(() => current.kernel.verifyHandoff(changed), (error) => error?.code?.startsWith('KSTACK_HOST_'), `${artifact}.${field}`);
  }
});

test('handoff requires protected approval provenance, not a self-consistent caller envelope', async () => {
  const issuer = fixture({ operationId: 'publish', operationClassId: 'ASK_SIDE_EFFECT', assuranceLevel: 'PROTECTED_BROKER' });
  const admitted = await issuer.kernel.admit(issuer.proposal);
  const untrustedVerifier = fixture({ operationId: 'publish', operationClassId: 'ASK_SIDE_EFFECT', assuranceLevel: 'PROTECTED_BROKER' });
  await rejectsCode('KSTACK_HOST_APPROVAL_ENVELOPE_MISMATCH', () => untrustedVerifier.kernel.verifyHandoff(admitted));

  issuer.state.now = '2026-08-28T12:09:00.000Z';
  await rejectsCode('KSTACK_HOST_CONTEXT_EXPIRED', () => issuer.kernel.verifyHandoff(admitted));
});

test('handoff revalidates inputs and rejects added transport fields', async () => {
  const changedInput = fixture({
    onValidateInput: (count, value) => { if (count === 2) value.objectDigest = digest('0'); }
  });
  const admitted = await changedInput.kernel.admit(changedInput.proposal);
  await rejectsCode('KSTACK_HOST_INPUT_MISMATCH', () => changedInput.kernel.verifyHandoff(admitted));

  const exactTransport = fixture();
  const exactBundle = await exactTransport.kernel.admit(exactTransport.proposal);
  const widened = { ...structuredClone(exactBundle), callerAuthority: true };
  await rejectsCode('KSTACK_HOST_TRANSPORT_CHANGED', () => exactTransport.kernel.verifyHandoff(widened));
});

test('every stable reason code has one immutable host-text-free explanation', () => {
  assert.equal(HOST_ADMISSION_REASON_CODES.length, 27);
  const messages = HOST_ADMISSION_REASON_CODES.map((reasonCode) => {
    const explanation = hostAdmissionExplanation(reasonCode, 'untrusted host text');
    assert.equal(explanation.code, reasonCode);
    assert.equal(Object.isFrozen(explanation), true);
    assert.equal(JSON.stringify(explanation).includes('untrusted host text'), false);
    return explanation.message;
  });
  assert.equal(new Set(messages).size, HOST_ADMISSION_REASON_CODES.length);
});
