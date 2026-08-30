import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateSecondHostAbstractionProof,
  SECOND_HOST_PROOF_CONSTANTS,
  validateSecondHostAbstractionProof
} from '../../plugins/kstack/scripts/kstack-second-host-proof.mjs';
import { OPENCODE_ADAPTER_BOUNDARY } from '../../plugins/kstack/scripts/kstack-opencode-adapter.mjs';
import { GOOSE_ADAPTER_BOUNDARY } from '../../plugins/kstack/scripts/kstack-goose-adapter.mjs';
import {
  canonical,
  fileDigest,
  recordDigest,
  sha256Hex,
  sourceRoot
} from './host-implementation-inventory.mjs';

const qualificationRoot = path.dirname(fileURLToPath(import.meta.url));
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(qualificationRoot, name), 'utf8'));
const bare = (value) => value.startsWith('sha256:') ? value.slice(7) : value;
const exactKeys = (value, expected, code) => {
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) throw new Error(code);
};
const diagnostic = (evidence, fixtureId) => {
  const row = evidence.fixtureDiagnostics.find((entry) => entry.fixtureId === fixtureId);
  if (!row?.passed) throw new Error(`fixture is not passing: ${fixtureId}`);
  return row;
};
const normalizeEvent = (event) => /_BASELINE_MATCHED$/u.test(event)
  && !event.startsWith('CODEX_') && !event.startsWith('CLAUDE_')
  ? 'HOST_BASELINE_MATCHED' : event;
const semanticRequests = (evidence) => evidence.fixtureSet.fixtures.map((fixture) => ({
  fixtureId: fixture.fixtureId,
  fixtureGroupId: fixture.fixtureGroupId,
  polarity: fixture.polarity,
  expectedDecisionCode: fixture.expectedDecisionCode,
  expectedNativeEventSequence: fixture.expectedNativeEventSequence.map(normalizeEvent),
  stableFailureCodes: fixture.stableFailureCodes
}));
const semanticResults = (evidence) => evidence.adjudicationRows.map((row) => ({
  fixtureId: row.fixtureId,
  observedDecisionCode: row.observedDecisionCode,
  nativeEventSequence: row.nativeEventSequence.map(normalizeEvent),
  failureCode: row.failureCode
}));

const initialOpenCode = readJson('opencode-v1.18.25-conformance-attempt-d6a8f658c7fd92c73f2c4b18d5e2008277e5b474d6c754e25584554c70219eff.json');
const openCode = readJson('opencode-v1.18.25-conformance-evidence.json');
const goose = readJson('goose-v1.48.0-conformance-evidence.json');
const implementationEvidence = readJson('host-implementation-validation-evidence.json');
for (const [name, evidence] of [['initial OpenCode', initialOpenCode], ['OpenCode', openCode], ['Goose', goose]]) {
  if (evidence.aggregate !== 'PASS' || evidence.operationStatus.status !== 'FULL'
      || evidence.maximumClaim !== 'OPERATION_SCOPED_ONLY'
      || evidence.fixtureSet.fixtures.length !== 20 || evidence.executions.length !== 20
      || evidence.failedFixtureIds.length !== 0) throw new Error(`${name} conformance is incomplete`);
  const body = { ...evidence };
  delete body.evidenceDigest;
  if (evidence.evidenceDigest !== `sha256:${recordDigest(body)}`) throw new Error(`${name} top-level digest mismatch`);
}
if (implementationEvidence.aggregate !== 'PASS' || implementationEvidence.rows.length !== 17
    || implementationEvidence.rows.some((row) => !row.implemented || !row.current)) {
  throw new Error('host implementation validation is incomplete');
}

const requestSetOpenCode = semanticRequests(openCode);
const requestSetGoose = semanticRequests(goose);
const resultSetOpenCode = semanticResults(openCode);
const resultSetGoose = semanticResults(goose);
if (JSON.stringify(requestSetOpenCode) !== JSON.stringify(requestSetGoose)
    || JSON.stringify(resultSetOpenCode) !== JSON.stringify(resultSetGoose)) {
  throw new Error('host semantic fixture/result normalization mismatch');
}
const commonProfile = {
  profileId: 'advisory-public-read-v1',
  operations: ['version', 'help', 'instruction-discovery', 'advisory'],
  fixtureGroups: openCode.fixtureSet.requiredGroupIds,
  semanticRequestSetDigest: recordDigest(requestSetOpenCode),
  semanticResultSetDigest: recordDigest(resultSetOpenCode),
  credentials: 'ABSENT',
  productionTargets: 'ABSENT',
  maximumClaim: 'OPERATION_SCOPED_ONLY'
};
const profileDigest = recordDigest(commonProfile);
const adapterDefinitions = Object.freeze({
  opencode: Object.freeze({
    path: 'plugins/kstack/scripts/kstack-opencode-adapter.mjs',
    boundary: OPENCODE_ADAPTER_BOUNDARY,
    projectionKind: 'PROJECT_OPENCODE_SKILL'
  }),
  goose: Object.freeze({
    path: 'plugins/kstack/scripts/kstack-goose-adapter.mjs',
    boundary: GOOSE_ADAPTER_BOUNDARY,
    projectionKind: 'PROJECT_AGENT_SKILL'
  })
});
const forbiddenProjectionFields = Object.freeze([
  'allow', 'approval', 'authority', 'credential', 'eligibility', 'policy', 'retry',
  'secret', 'supportTier', 'terminalStatus', 'token'
]);

function sourceScanReceipt(scanId, relativePath, forbiddenTokens) {
  const source = fs.readFileSync(path.join(sourceRoot, relativePath), 'utf8');
  const findings = [];
  for (const token of forbiddenTokens) {
    const expression = new RegExp(`\\b${token}\\b`, 'giu');
    for (const match of source.matchAll(expression)) {
      findings.push({ token, line: source.slice(0, match.index).split('\n').length });
    }
  }
  const receipt = {
    schema: 'kstack-source-scan-receipt-v1', scanId, relativePath,
    subjectDigest: fileDigest(relativePath), forbiddenTokens: [...forbiddenTokens],
    findings, passed: findings.length === 0
  };
  return Object.freeze({ ...receipt, receiptDigest: recordDigest(receipt) });
}

function adapterAuthorityScanReceipt(hostId) {
  const definition = adapterDefinitions[hostId];
  const source = fs.readFileSync(path.join(sourceRoot, definition.path), 'utf8');
  const observedPorts = Object.keys(definition.boundary);
  const forbiddenImports = ['node:child_process', 'node:http', 'node:https', 'node:net', 'node:tls']
    .filter((specifier) => source.includes(`from '${specifier}'`) || source.includes(`from \"${specifier}\"`));
  const passed = JSON.stringify(observedPorts) === JSON.stringify(SECOND_HOST_PROOF_CONSTANTS.ports)
    && observedPorts.every((portId) => typeof definition.boundary[portId] === 'function')
    && forbiddenImports.length === 0;
  const receipt = {
    schema: 'kstack-adapter-authority-scan-receipt-v1', hostId,
    adapterPath: definition.path, adapterDigest: fileDigest(definition.path),
    expectedPorts: [...SECOND_HOST_PROOF_CONSTANTS.ports], observedPorts,
    forbiddenImports, passed
  };
  return Object.freeze({ ...receipt, receiptDigest: recordDigest(receipt) });
}

function forbiddenFieldScanReceipt() {
  const observations = [];
  for (const [hostId, definition] of Object.entries(adapterDefinitions)) {
    const base = {
      packageDigest: '1'.repeat(64), skillDigest: '2'.repeat(64),
      projectionKind: definition.projectionKind, nativePathDigest: '3'.repeat(64)
    };
    for (const field of forbiddenProjectionFields) {
      let rejected = false;
      let errorCode = null;
      try { definition.boundary.discoverInstructionProjection({ ...base, [field]: 'forbidden' }); }
      catch (error) { rejected = true; errorCode = error?.code ?? error?.message ?? 'UNKNOWN'; }
      observations.push({ hostId, field, rejected, errorCode });
    }
  }
  const receipt = {
    schema: 'kstack-forbidden-field-scan-receipt-v1',
    scanId: 'adapter-projection-forbidden-fields-v1', forbiddenFields: [...forbiddenProjectionFields],
    observations, passed: observations.every((row) => row.rejected)
  };
  return Object.freeze({ ...receipt, receiptDigest: recordDigest(receipt) });
}

const genericSourceHostBranchScan = sourceScanReceipt(
  'generic-host-contract-host-branch-v1',
  'plugins/kstack/scripts/kstack-host-contract.mjs',
  ['opencode', 'goose', 'claude', 'codex']
);
const forbiddenFieldScan = forbiddenFieldScanReceipt();
const adapterAuthorityScans = Object.freeze({
  opencode: adapterAuthorityScanReceipt('opencode'),
  goose: adapterAuthorityScanReceipt('goose')
});
if (!genericSourceHostBranchScan.passed || !forbiddenFieldScan.passed
    || Object.values(adapterAuthorityScans).some((receipt) => !receipt.passed)) {
  throw new Error('measured shared-boundary scan failed');
}

const portDefinitions = SECOND_HOST_PROOF_CONSTANTS.ports.map((portId) => ({
  portId,
  request: { contract: 'HostAdapterBoundaryV1', portId, direction: 'KSTACK_TO_HOST_ADAPTER', authorityBearing: false },
  result: { contract: 'HostAdapterBoundaryV1', portId, direction: 'HOST_ADAPTER_TO_KSTACK', observationOnly: true }
}));

const differenceDefinitions = [
  ['instruction-discovery', 'OpenCode project skill projection and native event stream', 'Goose .agents/skills discovery and tabular inventory', 'One exact project instruction projection; duplicate roots deny admission', 'Host-native discovery is observed through a closed projection'],
  ['extensions-tools', 'Selected native skill path with deny-by-default permissions', 'No extensions and no native tools in the qualified profile', 'Unregistered native capability is unavailable', 'Host-specific inventory is bounded before execution'],
  ['provider-credential-lifecycle', 'One synthetic advisory provider flow', 'Native title plus advisory requests through the synthetic provider', 'No credential enters the host and provider shape is exact', 'Adapter observes each host-native provider sequence'],
  ['subagents', 'No subagent route admitted', 'Native Goose subagents rejected for this profile', 'No inherited or nested execution authority', null],
  ['mcp', 'Public KStack facade tested outside native advisory execution', 'Goose MCP excluded from the selected profile', 'MCP cannot promote identity, authority, or host eligibility', null],
  ['permissions', 'OpenCode native permission events observed without authority transfer', 'Goose tool proposal fails because the admitted tool inventory is empty', 'KStack remains the sole authority and broker owner', 'Host-native permission result is observation-only'],
  ['roots', 'OpenCode config/data/cache/home roots isolated from the repository', 'GOOSE_PATH_ROOT and HOME isolate Goose transient state', 'Repository identity remains byte-identical', 'Each adapter renders its native disposable-root layout'],
  ['background-tasks', 'Deadline and process lifecycle observed through OpenCode execution', 'GNU timeout and PID1 drain observe Goose cancellation', 'No orphan survives the bounded deadline', 'Native termination forms normalize to the common lifecycle result'],
  ['cancellation', 'OpenCode cancellation events are adapter observations', 'Goose process signal and timeout state are adapter observations', 'Cancellation never creates retry or authority', 'Host-specific cancellation facts normalize at the boundary'],
  ['retry-idempotency', 'Provider receipt ambiguity denies blind retry', 'Effecting-provider ambiguity denies after one call', 'Possibly committed work is never retried blindly', null],
  ['session-state', 'OpenCode isolated state is disposable and non-authoritative', 'Goose --no-session still writes only disposable transient state', 'No host session becomes KStack memory or durable authority', 'Adapter binds the actual native transient-state behavior'],
  ['memory-context', 'No host memory route is admitted', 'No Goose memory or resume route is admitted', 'Context cannot silently become durable cross-session state', null],
  ['updates', 'Pinned OpenCode binary and active-set change require requalification', 'Pinned reproducibly built Goose binary cannot self-update through the adapter', 'Host update invalidates evidence instead of inheriting support', 'Each exact binary/source identity has a host-specific admission path'],
  ['output-receipts', 'OpenCode JSONL/native events are content-addressed', 'Goose structured JSON and provider log facts are content-addressed', 'Only safe structured observations and content-free receipts persist', 'Each adapter parses its native output without semantic substitution']
].map(([surfaceId, opencodeBehavior, gooseBehavior, commonRequirement, hostSpecificAdaptation]) => ({
  surfaceId, opencodeBehavior, gooseBehavior, commonRequirement, hostSpecificAdaptation
}));
if (differenceDefinitions.map((row) => row.surfaceId).join('|') !== SECOND_HOST_PROOF_CONSTANTS.surfaces.join('|')) {
  throw new Error('difference matrix surface drift');
}

function hostAdapter(evidence, hostId) {
  const definition = adapterDefinitions[hostId];
  const adapterDigest = fileDigest(definition.path);
  const authorityScan = adapterAuthorityScans[hostId];
  return {
    hostId,
    buildDigest: bare(evidence.plan.runningHostBuildDigest),
    adapterDigest,
    portImplementations: SECOND_HOST_PROOF_CONSTANTS.ports.map((portId) => ({
      portId,
      implementationDigest: sha256Hex(Function.prototype.toString.call(definition.boundary[portId]))
    })),
    nativeEventSchemaDigest: recordDigest(evidence.fixtureSet.fixtures.map((fixture) => ({
      fixtureId: fixture.fixtureId,
      events: fixture.expectedNativeEventSequence
    }))),
    projectionPlanDigest: bare(evidence.planDigest),
    bypassInventoryDigest: bare(evidence.plan.bypassInventoryDigest),
    environmentProfileDigest: recordDigest(evidence.isolation.environmentFacts),
    fixtureMappingDigest: bare(evidence.fixtureSetDigest),
    authorityScanPassed: authorityScan.passed,
    authorityScanReceiptDigest: authorityScan.receiptDigest
  };
}

function hostExecution(evidence, hostId) {
  return {
    hostId,
    profileDigest,
    fixtureSetDigest: bare(evidence.fixtureSetDigest),
    fixtureCount: evidence.fixtureSet.fixtures.length,
    passedFixtureCount: evidence.executions.filter((row) => row.state === 'PASS').length,
    subjectProcessDigest: evidence.sourceEvidence.binarySha256,
    disposableRootDigest: recordDigest({
      environmentMeasurements: evidence.executions.map((row) => ({
        fixtureId: row.fixtureId,
        environmentStartDigest: row.environmentStartDigest,
        environmentEndDigest: row.environmentEndDigest,
        currentnessMeasurementDigest: row.currentnessMeasurementDigest,
        cleanupEvidenceDigest: row.cleanupEvidenceDigest
      })),
      namespaces: evidence.isolation.environmentFacts.namespaces,
      cleanupEvidence: evidence.isolation.cleanupEvidence
    }),
    observerDigest: recordDigest(evidence.observerReceipts),
    evidenceSetDigest: bare(evidence.evidenceSetDigest),
    receiptSetDigest: recordDigest(evidence.observerReceipts.map((row) => row.observationDigest)),
    eligibility: evidence.operationStatus.status === 'FULL' ? 'ELIGIBLE' : 'INELIGIBLE',
    kernelRequestSetDigest: recordDigest(requestSetOpenCode),
    kernelResultSetDigest: recordDigest(resultSetOpenCode),
    normalizedTraceDigest: recordDigest({ requests: requestSetOpenCode, results: resultSetOpenCode }),
    observedAt: evidence.operationStatus.evaluatedAt,
    expiresAt: evidence.operationStatus.expiresAt
  };
}

function preservationRow(evidence) {
  const measured = diagnostic(evidence, 'preservation.positive.v1');
  return {
    baselineDigest: bare(measured.details.repositoryInstalledDigest),
    resultDigest: bare(measured.details.repositoryFinalDigest),
    passed: measured.details.repositoryInstalledDigest === measured.details.repositoryFinalDigest
  };
}
const preservation = { opencode: preservationRow(openCode), goose: preservationRow(goose) };

const surfaceFixtureGroups = Object.freeze({
  'instruction-discovery': ['instruction-package'],
  'extensions-tools': ['native-permissions'],
  'provider-credential-lifecycle': ['approval-broker'],
  subagents: ['instruction-package'],
  mcp: ['public-mcp-facade'],
  permissions: ['native-permissions'],
  roots: ['workspace'],
  'background-tasks': ['background-lifecycle'],
  cancellation: ['background-lifecycle'],
  'retry-idempotency': ['receipt-ambiguity'],
  'session-state': ['workspace'],
  'memory-context': ['workspace', 'instruction-package'],
  updates: ['identity-currentness'],
  'output-receipts': ['hostile-data']
});
const surfaceMeasurements = Object.fromEntries(differenceDefinitions.map((row) => {
  const fixtureGroups = surfaceFixtureGroups[row.surfaceId];
  const diagnostics = [openCode, goose].flatMap((evidence) => fixtureGroups.flatMap((group) => [
    diagnostic(evidence, `${group}.negative.v1`),
    diagnostic(evidence, `${group}.positive.v1`)
  ])).map((entry) => ({ fixtureId: entry.fixtureId, passed: entry.passed, detailsDigest: recordDigest(entry.details) }));
  const receipt = {
    schema: 'kstack-host-surface-measurement-v1', surfaceId: row.surfaceId,
    fixtureGroups, diagnostics, passed: diagnostics.every((entry) => entry.passed)
  };
  return [row.surfaceId, { ...receipt, receiptDigest: recordDigest(receipt) }];
}));

const negativeSources = {
  'alternate-root-escape': [diagnostic(openCode, 'workspace.negative.v1'), diagnostic(goose, 'instruction-package.negative.v1')],
  'background-orphan': [diagnostic(openCode, 'background-lifecycle.negative.v1'), diagnostic(goose, 'background-lifecycle.negative.v1')],
  'cross-host-evidence-substitution': [openCode.evidenceDigest, goose.evidenceDigest, fileDigest('tests/second-host-proof.test.mjs')],
  'direct-user-mcp-action': [diagnostic(openCode, 'public-mcp-facade.negative.v1'), diagnostic(goose, 'public-mcp-facade.negative.v1')],
  'generic-host-branch': [fileDigest('plugins/kstack/scripts/kstack-host-contract.mjs'), fileDigest('tests/reflexion-architecture-gate.mjs')],
  'host-retry-duplication': [diagnostic(openCode, 'receipt-ambiguity.negative.v1'), diagnostic(goose, 'receipt-ambiguity.negative.v1')],
  'host-update-invalidation': [initialOpenCode.evidenceDigest, openCode.evidenceDigest, openCode.plan.activeSetDigest],
  'native-event-observer-contradiction': [fileDigest('tests/opencode-conformance.test.mjs'), fileDigest('tests/goose-conformance.test.mjs')],
  'provider-credential-broker-bypass': [diagnostic(openCode, 'approval-broker.negative.v1'), diagnostic(goose, 'approval-broker.negative.v1')],
  'recipe-authority-promotion': [fileDigest('.kstack/decisions/goose-v1.48.0-adapter-objective-2026-08-29.md'), diagnostic(goose, 'instruction-package.negative.v1')],
  'semantic-field-projection-leak': [fileDigest('tests/opencode-adapter.test.mjs'), fileDigest('tests/goose-adapter.test.mjs')],
  'subagent-inheritance-bypass': [fileDigest('.kstack/decisions/goose-v1.48.0-adapter-objective-2026-08-29.md'), differenceDefinitions.find((row) => row.surfaceId === 'subagents')],
  'shared-contract-preservation-regression': [diagnostic(openCode, 'preservation.negative.v1'), diagnostic(goose, 'preservation.negative.v1')]
};
if (Object.keys(negativeSources).join('|') !== SECOND_HOST_PROOF_CONSTANTS.negativeCases.join('|')) {
  throw new Error('negative evidence inventory drift');
}

function negativeMeasurement(caseId, methodId, passed, observation) {
  const sources = negativeSources[caseId];
  const receipt = {
    schema: 'kstack-second-host-negative-measurement-v1', caseId, methodId,
    sourceDigests: sources.map((source) => recordDigest(source)), observation,
    passed: passed === true
  };
  return Object.freeze({ ...receipt, receiptDigest: recordDigest(receipt) });
}
const allObserversAgree = (evidence) => evidence.executions.every((row) => row.observersAgree && row.outcomeProven);
const negativeMeasurements = Object.freeze({
  'alternate-root-escape': negativeMeasurement('alternate-root-escape', 'EXECUTED_HOST_DENIAL_FIXTURES',
    negativeSources['alternate-root-escape'].every((row) => row.passed), { fixtureIds: negativeSources['alternate-root-escape'].map((row) => row.fixtureId) }),
  'background-orphan': negativeMeasurement('background-orphan', 'EXECUTED_LIFECYCLE_DENIAL_FIXTURES',
    negativeSources['background-orphan'].every((row) => row.passed), { fixtureIds: negativeSources['background-orphan'].map((row) => row.fixtureId) }),
  'cross-host-evidence-substitution': negativeMeasurement('cross-host-evidence-substitution', 'DISTINCT_EVIDENCE_IDENTITY_CHECK',
    openCode.evidenceDigest !== goose.evidenceDigest && openCode.fixtureSetDigest !== goose.fixtureSetDigest
      && openCode.sourceEvidence.binarySha256 !== goose.sourceEvidence.binarySha256,
    { openCodeEvidenceDigest: bare(openCode.evidenceDigest), gooseEvidenceDigest: bare(goose.evidenceDigest) }),
  'direct-user-mcp-action': negativeMeasurement('direct-user-mcp-action', 'EXECUTED_MCP_DENIAL_FIXTURES',
    negativeSources['direct-user-mcp-action'].every((row) => row.passed), { fixtureIds: negativeSources['direct-user-mcp-action'].map((row) => row.fixtureId) }),
  'generic-host-branch': negativeMeasurement('generic-host-branch', 'GENERIC_SOURCE_HOST_BRANCH_SCAN',
    genericSourceHostBranchScan.passed, { scanReceiptDigest: genericSourceHostBranchScan.receiptDigest, findings: genericSourceHostBranchScan.findings }),
  'host-retry-duplication': negativeMeasurement('host-retry-duplication', 'EXECUTED_RECEIPT_AMBIGUITY_FIXTURES',
    negativeSources['host-retry-duplication'].every((row) => row.passed), { fixtureIds: negativeSources['host-retry-duplication'].map((row) => row.fixtureId) }),
  'host-update-invalidation': negativeMeasurement('host-update-invalidation', 'DISTINCT_REQUALIFICATION_IDENTITY_CHECK',
    initialOpenCode.evidenceDigest !== openCode.evidenceDigest && initialOpenCode.plan.activeSetDigest !== openCode.plan.activeSetDigest,
    { initialEvidenceDigest: bare(initialOpenCode.evidenceDigest), currentEvidenceDigest: bare(openCode.evidenceDigest), activeSetChanged: initialOpenCode.plan.activeSetDigest !== openCode.plan.activeSetDigest }),
  'native-event-observer-contradiction': negativeMeasurement('native-event-observer-contradiction', 'INDEPENDENT_OBSERVER_AGREEMENT_CHECK',
    allObserversAgree(openCode) && allObserversAgree(goose), { openCodeExecutions: openCode.executions.length, gooseExecutions: goose.executions.length }),
  'provider-credential-broker-bypass': negativeMeasurement('provider-credential-broker-bypass', 'EXECUTED_BROKER_DENIAL_FIXTURES',
    negativeSources['provider-credential-broker-bypass'].every((row) => row.passed), { fixtureIds: negativeSources['provider-credential-broker-bypass'].map((row) => row.fixtureId) }),
  'recipe-authority-promotion': negativeMeasurement('recipe-authority-promotion', 'EXECUTED_INSTRUCTION_AUTHORITY_DENIAL_FIXTURE',
    negativeSources['recipe-authority-promotion'][1].passed, { fixtureId: negativeSources['recipe-authority-promotion'][1].fixtureId }),
  'semantic-field-projection-leak': negativeMeasurement('semantic-field-projection-leak', 'EXECUTED_FORBIDDEN_FIELD_SCAN',
    forbiddenFieldScan.passed, { scanReceiptDigest: forbiddenFieldScan.receiptDigest, observationCount: forbiddenFieldScan.observations.length }),
  'subagent-inheritance-bypass': negativeMeasurement('subagent-inheritance-bypass', 'EXECUTED_SUBAGENT_ROUTE_DENIAL_FIXTURE',
    diagnostic(goose, 'instruction-package.negative.v1').passed, { fixtureId: 'instruction-package.negative.v1' }),
  'shared-contract-preservation-regression': negativeMeasurement('shared-contract-preservation-regression', 'EXECUTED_PRESERVATION_NEGATIVE_FIXTURES',
    negativeSources['shared-contract-preservation-regression'].every((row) => row.passed), { fixtureIds: negativeSources['shared-contract-preservation-regression'].map((row) => row.fixtureId) })
});
if (Object.keys(negativeMeasurements).join('|') !== SECOND_HOST_PROOF_CONSTANTS.negativeCases.join('|')
    || Object.values(negativeMeasurements).some((receipt) => !receipt.passed)) {
  throw new Error('measured negative coverage failed');
}

const integratedImplementationInventory = Object.freeze([
  {
    itemId: 'HB-TC06', files: [
      '.kstack/qualifications/build-opencode-goose-second-host-proof.mjs',
      '.kstack/qualifications/validate-opencode-goose-second-host-proof.mjs',
      'plugins/kstack/scripts/kstack-second-host-proof.mjs',
      'tests/second-host-proof.test.mjs',
      'tests/second-host-proof-evidence.test.mjs'
    ]
  },
  {
    itemId: 'HB-TC09', files: [
      'plugins/kstack/scripts/kstack-goose-adapter.mjs',
      'plugins/kstack/scripts/kstack-goose-conformance.mjs',
      '.kstack/qualifications/goose-v1.48.0-conformance-child.mjs',
      '.kstack/qualifications/goose-v1.48.0-conformance-provider.mjs',
      '.kstack/qualifications/run-goose-v1.48.0-conformance.mjs',
      '.kstack/qualifications/validate-goose-v1.48.0-conformance.mjs',
      'tests/goose-adapter.test.mjs',
      'tests/goose-conformance.test.mjs',
      'tests/goose-protected-conformance.test.mjs'
    ]
  }
].map((row) => ({
  itemId: row.itemId,
  files: row.files.map((file) => ({ file, sha256: fileDigest(file) }))
})));
const integratedImplementationDigest = recordDigest(integratedImplementationInventory);

const implementationRows = new Map(implementationEvidence.rows.map((row) => [row.itemId, row]));
const hpImplementations = SECOND_HOST_PROOF_CONSTANTS.hpItems.map((itemId) => implementationRows.get(itemId));
const hbImplementations = SECOND_HOST_PROOF_CONSTANTS.hbItems.map((itemId) => implementationRows.get(itemId));
if ([...hpImplementations, ...hbImplementations].some((row) => !row)) throw new Error('implementation row missing');

const finalReviewTarget = {
  commonProfile,
  implementationEvidenceDigest: implementationEvidence.evidenceDigest,
  openCodeEvidenceDigest: openCode.evidenceDigest,
  gooseEvidenceDigest: goose.evidenceDigest,
  sharedBoundarySourceDigest: fileDigest('plugins/kstack/scripts/kstack-host-contract.mjs'),
  proofEvaluatorDigest: fileDigest('plugins/kstack/scripts/kstack-second-host-proof.mjs'),
  integratedImplementationDigest,
  differenceDefinitions,
  boundaryMeasurementDigests: {
    genericSourceHostBranchScan: genericSourceHostBranchScan.receiptDigest,
    forbiddenFieldScan: forbiddenFieldScan.receiptDigest,
    adapterAuthorityScans: Object.fromEntries(Object.entries(adapterAuthorityScans).map(([hostId, receipt]) => [hostId, receipt.receiptDigest]))
  },
  surfaceMeasurementDigests: Object.fromEntries(Object.entries(surfaceMeasurements).map(([surfaceId, receipt]) => [surfaceId, receipt.receiptDigest])),
  negativeEvidenceDigests: Object.fromEntries(Object.entries(negativeMeasurements).map(([caseId, receipt]) => [caseId, receipt.receiptDigest]))
};
const finalReviewTargetDigest = recordDigest(finalReviewTarget);
const finalReviewPath = path.join(qualificationRoot, 'host-integrated-independent-final-review.json');
let finalReview = null;
if (fs.existsSync(finalReviewPath)) {
  finalReview = JSON.parse(fs.readFileSync(finalReviewPath, 'utf8'));
  exactKeys(finalReview, [
    'schema', 'reviewer', 'reviewerFamily', 'targetDigest', 'verdict', 'confidence',
    'failedCriteria', 'securityFindings', 'materialDissent', 'unresolvedQuestions',
    'recommendation', 'reviewedAt', 'reviewDigest'
  ], 'independent final review schema drift');
  const reviewBody = { ...finalReview };
  delete reviewBody.reviewDigest;
  if (finalReview.schema !== 'kstack-host-integrated-independent-final-review-v1'
      || finalReview.reviewerFamily !== 'claude'
      || finalReview.targetDigest !== finalReviewTargetDigest
      || finalReview.verdict !== 'APPROVE'
      || !Number.isInteger(finalReview.confidence) || finalReview.confidence < 81
      || !Array.isArray(finalReview.failedCriteria) || finalReview.failedCriteria.length !== 0
      || !Array.isArray(finalReview.securityFindings) || finalReview.securityFindings.length !== 0
      || !Array.isArray(finalReview.materialDissent) || finalReview.materialDissent.length !== 0
      || !Array.isArray(finalReview.unresolvedQuestions) || finalReview.unresolvedQuestions.length !== 0
      || typeof finalReview.recommendation !== 'string' || finalReview.recommendation.length < 1
      || finalReview.reviewDigest !== recordDigest(reviewBody)) {
    throw new Error('independent final review is invalid or stale');
  }
}

const observedAt = new Date(Math.max(
  Date.parse(openCode.operationStatus.evaluatedAt),
  Date.parse(goose.operationStatus.evaluatedAt),
  Date.parse(implementationEvidence.completedAt)
) + 1_000).toISOString();
const expiresAt = new Date(Math.min(
  Date.parse(openCode.operationStatus.expiresAt),
  Date.parse(goose.operationStatus.expiresAt),
  Date.parse(implementationEvidence.completedAt) + 7 * 86_400_000
)).toISOString();
const initialEnvironmentDigest = recordDigest(initialOpenCode.isolation.environmentFacts);
const currentEnvironmentDigest = recordDigest(openCode.isolation.environmentFacts);
const requalificationChanges = [
  ['activeSetDigest', initialOpenCode.plan.activeSetDigest, openCode.plan.activeSetDigest],
  ['harnessDigest', initialOpenCode.plan.harnessDigest, openCode.plan.harnessDigest],
  ['runningHostBuildDigest', initialOpenCode.plan.runningHostBuildDigest, openCode.plan.runningHostBuildDigest],
  ['policyDigest', initialOpenCode.plan.policyDigest, openCode.plan.policyDigest],
  ['environmentDigest', initialEnvironmentDigest, currentEnvironmentDigest]
].filter(([, initial, current]) => initial !== current).map(([field, initial, current]) => ({ field, initial, current }));
const requalificationChangeDigest = requalificationChanges.length === 0 ? null : recordDigest(requalificationChanges);
const proof = {
  schemaVersion: 1,
  proofId: 'opencode-goose-advisory-public-read-v1',
  profileId: commonProfile.profileId,
  profileDigest,
  stabilityGate: {
    schemaVersion: 1,
    gateId: 'opencode-stability-for-advisory-public-read-v1',
    profileDigest,
    hpImplementations,
    hbImplementations,
    initialQualification: {
      kind: 'initial', hostId: 'opencode',
      buildDigest: bare(initialOpenCode.plan.runningHostBuildDigest),
      configurationDigest: bare(initialOpenCode.plan.policyDigest),
      environmentDigest: initialEnvironmentDigest,
      profileDigest, changeDigest: null, eligibility: 'ELIGIBLE',
      conformanceReceiptDigest: bare(initialOpenCode.evidenceDigest),
      passed: true, observedAt: initialOpenCode.operationStatus.evaluatedAt
    },
    requalification: {
      kind: 'requalification', hostId: 'opencode',
      buildDigest: bare(openCode.plan.runningHostBuildDigest),
      configurationDigest: bare(openCode.plan.policyDigest),
      environmentDigest: currentEnvironmentDigest,
      profileDigest,
      changeDigest: requalificationChangeDigest,
      eligibility: 'ELIGIBLE', conformanceReceiptDigest: bare(openCode.evidenceDigest),
      passed: true, observedAt: openCode.operationStatus.evaluatedAt
    },
    preservationEvidenceDigest: recordDigest(preservation),
    preservationPassed: Object.values(preservation).every((row) => row.passed),
    openDefectCodes: finalReview ? [] : ['INDEPENDENT_FINAL_REVIEW_PENDING'],
    evaluatedAt: observedAt,
    expiresAt
  },
  secondHostObjective: {
    hostId: 'goose',
    objectiveDigest: fileDigest('.kstack/decisions/goose-v1.48.0-adapter-objective-2026-08-29.md'),
    decisionDigest: fileDigest('.kstack/decisions/gstack-hermes-openclaw-review-2026-08-28.md'),
    primarySourceLedgerDigest: fileDigest('.kstack/qualifications/goose-v1.48.0-supply-chain-2026-08-29.md'),
    reuseDispositionDigest: recordDigest({ disposition: 'COMPOSE-INTERNAL-PLUS-ADAPT', objectiveDigest: fileDigest('.kstack/decisions/goose-v1.48.0-adapter-objective-2026-08-29.md') }),
    ownerClarificationDigest: fileDigest('.kstack/decisions/goose-v1.48.0-adapter-objective-2026-08-29.md'),
    codexClosureDigest: bare(goose.evidenceDigest),
    selectedProfileDigest: profileDigest,
    status: 'APPROVED'
  },
  sharedBoundary: {
    contractDigest: fileDigest('plugins/kstack/scripts/kstack-host-contract.mjs'),
    schemaRegistryDigest: recordDigest(portDefinitions),
    genericSourceDigest: fileDigest('plugins/kstack/scripts/kstack-host-contract.mjs'),
    ports: portDefinitions.map((row) => ({
      portId: row.portId,
      requestSchemaDigest: recordDigest(row.request),
      resultSchemaDigest: recordDigest(row.result)
    })),
    genericSourceHostBranchScanPassed: genericSourceHostBranchScan.passed,
    genericSourceHostBranchScanReceiptDigest: genericSourceHostBranchScan.receiptDigest,
    forbiddenFieldScanPassed: forbiddenFieldScan.passed,
    forbiddenFieldScanReceiptDigest: forbiddenFieldScan.receiptDigest
  },
  adapters: [
    hostAdapter(openCode, 'opencode'),
    hostAdapter(goose, 'goose')
  ],
  differenceMatrix: differenceDefinitions.map((row) => ({
    surfaceId: row.surfaceId,
    opencodeBehaviorDigest: recordDigest(row.opencodeBehavior),
    gooseBehaviorDigest: recordDigest(row.gooseBehavior),
    commonRequirementDigest: recordDigest(row.commonRequirement),
    hostSpecificAdaptationDigest: row.hostSpecificAdaptation === null ? null : recordDigest(row.hostSpecificAdaptation),
    kstackOwner: 'governance-kernel',
    hostOwner: row.hostSpecificAdaptation === null ? 'none' : `native-${row.surfaceId}`,
    overlapOutcome: row.hostSpecificAdaptation === null ? 'KSTACK_OWNS' : 'HOST_OWNS_UNDER_BOUNDARY',
    noBypassEvidenceDigest: row.hostSpecificAdaptation === null ? null : recordDigest({
      kind: 'surface-no-bypass-evidence-v1',
      surfaceId: row.surfaceId,
      measurementReceiptDigest: surfaceMeasurements[row.surfaceId].receiptDigest
    }),
    testObligationsDigest: recordDigest({
      kind: 'surface-test-obligations-v1',
      surfaceId: row.surfaceId,
      fixtureGroups: surfaceMeasurements[row.surfaceId].fixtureGroups,
      measurementReceiptDigest: surfaceMeasurements[row.surfaceId].receiptDigest
    })
  })),
  executions: [hostExecution(openCode, 'opencode'), hostExecution(goose, 'goose')],
  preservation,
  negativeCoverage: SECOND_HOST_PROOF_CONSTANTS.negativeCases.map((caseId) => ({
    caseId, passed: negativeMeasurements[caseId].passed, evidenceDigest: negativeMeasurements[caseId].receiptDigest
  })),
  observedAt,
  expiresAt
};

validateSecondHostAbstractionProof(proof);
const result = evaluateSecondHostAbstractionProof(proof, observedAt);
const bundle = {
  schema: 'kstack-opencode-goose-second-host-proof-evidence-v1',
  bindings: {
    builderDigest: fileDigest('.kstack/qualifications/build-opencode-goose-second-host-proof.mjs'),
    evaluatorDigest: fileDigest('plugins/kstack/scripts/kstack-second-host-proof.mjs'),
    hostImplementationEvidenceDigest: implementationEvidence.evidenceDigest,
    openCodeEvidenceDigest: bare(openCode.evidenceDigest),
    gooseEvidenceDigest: bare(goose.evidenceDigest),
    installManifestDigest: fileDigest('plugins/kstack/install-health-audit-manifest-v1.json'),
    integratedImplementationDigest
  },
  integratedImplementationInventory,
  commonProfile,
  semanticRequestSet: requestSetOpenCode,
  semanticResultSet: resultSetOpenCode,
  portDefinitions,
  differenceDefinitions,
  measurements: {
    genericSourceHostBranchScan,
    forbiddenFieldScan,
    adapterAuthorityScans,
    surfaceMeasurements,
    negativeMeasurements,
    requalificationChanges
  },
  negativeEvidenceSources: Object.fromEntries(Object.entries(negativeSources).map(([caseId, sources]) => [caseId, {
    sourceCount: sources.length,
    evidenceDigest: negativeMeasurements[caseId].receiptDigest
  }])),
  finalReview: {
    required: true,
    targetDigest: finalReviewTargetDigest,
    receiptPresent: finalReview !== null,
    receiptDigest: finalReview?.reviewDigest ?? null
  },
  primaryReadinessConfidence: 96,
  proof,
  result
};
bundle.evidenceDigest = recordDigest(bundle);
fs.writeFileSync(path.join(qualificationRoot, 'opencode-goose-second-host-proof-evidence.json'), `${JSON.stringify(bundle, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({
  result: result.outcome,
  evidenceDigest: bundle.evidenceDigest,
  profileDigest,
  openDefectCodes: proof.stabilityGate.openDefectCodes,
  currentHosts: proof.executions.map((row) => ({ hostId: row.hostId, fixtures: row.fixtureCount, passed: row.passedFixtureCount })),
  finalReviewTargetDigest,
  primaryReadinessConfidence: bundle.primaryReadinessConfidence
}, null, 2)}\n`);
