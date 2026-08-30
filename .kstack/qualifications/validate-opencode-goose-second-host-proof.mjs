import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  evaluateSecondHostAbstractionProof,
  SECOND_HOST_PROOF_CONSTANTS,
  validateSecondHostAbstractionProof
} from '../../plugins/kstack/scripts/kstack-second-host-proof.mjs';
import { OPENCODE_ADAPTER_BOUNDARY } from '../../plugins/kstack/scripts/kstack-opencode-adapter.mjs';
import { GOOSE_ADAPTER_BOUNDARY } from '../../plugins/kstack/scripts/kstack-goose-adapter.mjs';
import {
  fileDigest,
  recordDigest,
  sha256Hex,
  sourceRoot
} from './host-implementation-inventory.mjs';

const qualificationRoot = path.dirname(fileURLToPath(import.meta.url));
const bare = (value) => value.startsWith('sha256:') ? value.slice(7) : value;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
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
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(qualificationRoot, name), 'utf8'));
const fail = (detail) => { throw new Error(`KSTACK_SECOND_HOST_EVIDENCE_INVALID: ${detail}`); };
const receiptDigest = (receipt) => {
  const body = { ...receipt };
  delete body.receiptDigest;
  return recordDigest(body);
};
const diagnostic = (evidence, fixtureId) => evidence.fixtureDiagnostics.find((entry) => entry.fixtureId === fixtureId);
const expectedIntegratedFiles = Object.freeze({
  'HB-TC06': [
    '.kstack/qualifications/build-opencode-goose-second-host-proof.mjs',
    '.kstack/qualifications/validate-opencode-goose-second-host-proof.mjs',
    'plugins/kstack/scripts/kstack-second-host-proof.mjs',
    'tests/second-host-proof.test.mjs',
    'tests/second-host-proof-evidence.test.mjs'
  ],
  'HB-TC09': [
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
});

export function validateSecondHostEvidenceBundle(input, now = new Date().toISOString()) {
  const expectedKeys = [
    'schema', 'bindings', 'commonProfile', 'semanticRequestSet', 'semanticResultSet',
    'integratedImplementationInventory', 'portDefinitions', 'differenceDefinitions',
    'measurements', 'negativeEvidenceSources',
    'finalReview', 'primaryReadinessConfidence', 'proof', 'result', 'evidenceDigest'
  ].sort();
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || !same(Object.keys(input).sort(), expectedKeys)) fail('closed schema');
  if (input.schema !== 'kstack-opencode-goose-second-host-proof-evidence-v1') fail('schema');
  const body = { ...input };
  delete body.evidenceDigest;
  if (input.evidenceDigest !== recordDigest(body)) fail('top-level digest');
  const implementation = readJson('host-implementation-validation-evidence.json');
  const openCode = readJson('opencode-v1.18.25-conformance-evidence.json');
  const goose = readJson('goose-v1.48.0-conformance-evidence.json');
  const expectedBindings = {
    builderDigest: fileDigest('.kstack/qualifications/build-opencode-goose-second-host-proof.mjs'),
    evaluatorDigest: fileDigest('plugins/kstack/scripts/kstack-second-host-proof.mjs'),
    hostImplementationEvidenceDigest: implementation.evidenceDigest,
    openCodeEvidenceDigest: bare(openCode.evidenceDigest),
    gooseEvidenceDigest: bare(goose.evidenceDigest),
    installManifestDigest: fileDigest('plugins/kstack/install-health-audit-manifest-v1.json'),
    integratedImplementationDigest: recordDigest(input.integratedImplementationInventory)
  };
  const expectedIntegratedInventory = Object.entries(expectedIntegratedFiles).map(([itemId, files]) => ({
    itemId, files: files.map((file) => ({ file, sha256: fileDigest(file) }))
  }));
  if (!same(input.integratedImplementationInventory, expectedIntegratedInventory)) fail('integrated implementation inventory drift');
  if (!same(input.bindings, expectedBindings)) fail('currentness binding drift');
  const openCodeRequests = semanticRequests(openCode);
  const gooseRequests = semanticRequests(goose);
  const openCodeResults = semanticResults(openCode);
  const gooseResults = semanticResults(goose);
  if (!same(openCodeRequests, gooseRequests) || !same(openCodeResults, gooseResults)
      || !same(input.semanticRequestSet, openCodeRequests)
      || !same(input.semanticResultSet, openCodeResults)
      || input.commonProfile.semanticRequestSetDigest !== recordDigest(openCodeRequests)
      || input.commonProfile.semanticResultSetDigest !== recordDigest(openCodeResults)
      || input.proof.profileDigest !== recordDigest(input.commonProfile)) fail('semantic normalization');
  if (!Array.isArray(input.portDefinitions)
      || input.portDefinitions.map((row) => row.portId).join('|') !== SECOND_HOST_PROOF_CONSTANTS.ports.join('|')) fail('port inventory');
  if (!Array.isArray(input.differenceDefinitions)
      || input.differenceDefinitions.map((row) => row.surfaceId).join('|') !== SECOND_HOST_PROOF_CONSTANTS.surfaces.join('|')) fail('difference matrix');
  if (Object.keys(input.negativeEvidenceSources).join('|') !== SECOND_HOST_PROOF_CONSTANTS.negativeCases.join('|')
      || Object.values(input.negativeEvidenceSources).some((row) => row.sourceCount < 2 || !/^[a-f0-9]{64}$/u.test(row.evidenceDigest))) fail('negative evidence');
  const proof = validateSecondHostAbstractionProof(input.proof);
  const measurements = input.measurements;
  if (!measurements || !same(Object.keys(measurements).sort(), [
    'adapterAuthorityScans', 'forbiddenFieldScan', 'genericSourceHostBranchScan',
    'negativeMeasurements', 'requalificationChanges', 'surfaceMeasurements'
  ].sort())) fail('measurement schema');
  const genericScan = measurements.genericSourceHostBranchScan;
  if (genericScan.receiptDigest !== receiptDigest(genericScan) || genericScan.passed !== true
      || genericScan.findings.length !== 0 || genericScan.subjectDigest !== fileDigest(genericScan.relativePath)
      || proof.sharedBoundary.genericSourceHostBranchScanReceiptDigest !== genericScan.receiptDigest) fail('generic source scan');
  const forbiddenScan = measurements.forbiddenFieldScan;
  if (forbiddenScan.receiptDigest !== receiptDigest(forbiddenScan) || forbiddenScan.passed !== true
      || forbiddenScan.observations.length !== 22 || forbiddenScan.observations.some((row) => !row.rejected)
      || proof.sharedBoundary.forbiddenFieldScanReceiptDigest !== forbiddenScan.receiptDigest) fail('forbidden field scan');
  const boundaries = { opencode: OPENCODE_ADAPTER_BOUNDARY, goose: GOOSE_ADAPTER_BOUNDARY };
  const adapterPaths = { opencode: 'plugins/kstack/scripts/kstack-opencode-adapter.mjs', goose: 'plugins/kstack/scripts/kstack-goose-adapter.mjs' };
  for (const [index, hostId] of ['opencode', 'goose'].entries()) {
    const scan = measurements.adapterAuthorityScans[hostId];
    if (scan.receiptDigest !== receiptDigest(scan) || scan.passed !== true || scan.forbiddenImports.length !== 0
        || scan.adapterDigest !== fileDigest(adapterPaths[hostId])
        || !same(scan.observedPorts, SECOND_HOST_PROOF_CONSTANTS.ports)
        || proof.adapters[index].authorityScanReceiptDigest !== scan.receiptDigest) fail('adapter authority scan');
    const expectedPorts = SECOND_HOST_PROOF_CONSTANTS.ports.map((portId) => ({
      portId, implementationDigest: sha256Hex(Function.prototype.toString.call(boundaries[hostId][portId]))
    }));
    if (!same(proof.adapters[index].portImplementations, expectedPorts)) fail('adapter port implementation binding');
  }
  const preservationRows = { opencode: diagnostic(openCode, 'preservation.positive.v1'), goose: diagnostic(goose, 'preservation.positive.v1') };
  for (const hostId of ['opencode', 'goose']) {
    const row = preservationRows[hostId];
    const expected = {
      baselineDigest: bare(row.details.repositoryInstalledDigest),
      resultDigest: bare(row.details.repositoryFinalDigest),
      passed: row.passed && row.details.repositoryInstalledDigest === row.details.repositoryFinalDigest
    };
    if (!same(proof.preservation[hostId], expected)) fail('preservation binding');
  }
  for (const [surfaceId, receipt] of Object.entries(measurements.surfaceMeasurements)) {
    const proofRow = proof.differenceMatrix.find((row) => row.surfaceId === surfaceId);
    if (receipt.receiptDigest !== receiptDigest(receipt) || receipt.passed !== true
        || receipt.diagnostics.some((row) => !row.passed) || !proofRow) fail('surface measurement');
    const expectedTestDigest = recordDigest({
      kind: 'surface-test-obligations-v1', surfaceId,
      fixtureGroups: receipt.fixtureGroups, measurementReceiptDigest: receipt.receiptDigest
    });
    if (proofRow.testObligationsDigest !== expectedTestDigest) fail('surface test binding');
    if (proofRow.hostSpecificAdaptationDigest !== null) {
      const expectedNoBypass = recordDigest({
        kind: 'surface-no-bypass-evidence-v1', surfaceId,
        measurementReceiptDigest: receipt.receiptDigest
      });
      if (proofRow.noBypassEvidenceDigest !== expectedNoBypass) fail('surface no-bypass binding');
    }
  }
  for (const [index, caseId] of SECOND_HOST_PROOF_CONSTANTS.negativeCases.entries()) {
    const receipt = measurements.negativeMeasurements[caseId];
    const coverage = proof.negativeCoverage[index];
    if (receipt.receiptDigest !== receiptDigest(receipt) || receipt.passed !== true
        || coverage.caseId !== caseId || coverage.passed !== receipt.passed
        || coverage.evidenceDigest !== receipt.receiptDigest
        || input.negativeEvidenceSources[caseId].evidenceDigest !== receipt.receiptDigest) fail('negative measurement binding');
  }
  const initial = readJson('opencode-v1.18.25-conformance-attempt-d6a8f658c7fd92c73f2c4b18d5e2008277e5b474d6c754e25584554c70219eff.json');
  const initialEnvironmentDigest = recordDigest(initial.isolation.environmentFacts);
  const currentEnvironmentDigest = recordDigest(openCode.isolation.environmentFacts);
  const expectedChanges = [
    ['activeSetDigest', initial.plan.activeSetDigest, openCode.plan.activeSetDigest],
    ['harnessDigest', initial.plan.harnessDigest, openCode.plan.harnessDigest],
    ['runningHostBuildDigest', initial.plan.runningHostBuildDigest, openCode.plan.runningHostBuildDigest],
    ['policyDigest', initial.plan.policyDigest, openCode.plan.policyDigest],
    ['environmentDigest', initialEnvironmentDigest, currentEnvironmentDigest]
  ].filter(([, left, right]) => left !== right).map(([field, left, right]) => ({ field, initial: left, current: right }));
  if (!same(measurements.requalificationChanges, expectedChanges)
      || proof.stabilityGate.requalification.changeDigest !== (expectedChanges.length ? recordDigest(expectedChanges) : null)) fail('requalification change binding');
  const result = evaluateSecondHostAbstractionProof(proof, proof.observedAt);
  if (!same(result, input.result)) fail('proof replay');
  if (Date.parse(proof.expiresAt) <= Date.parse(now)) fail('proof expired');
  const [openCodeExecution, gooseExecution] = proof.executions;
  if (openCodeExecution.fixtureSetDigest !== bare(openCode.fixtureSetDigest)
      || gooseExecution.fixtureSetDigest !== bare(goose.fixtureSetDigest)
      || openCodeExecution.evidenceSetDigest !== bare(openCode.evidenceSetDigest)
      || gooseExecution.evidenceSetDigest !== bare(goose.evidenceSetDigest)
      || openCodeExecution.fixtureCount !== 20 || gooseExecution.fixtureCount !== 20
      || openCodeExecution.passedFixtureCount !== 20 || gooseExecution.passedFixtureCount !== 20) fail('host execution binding');
  for (const [execution, evidence] of [[openCodeExecution, openCode], [gooseExecution, goose]]) {
    const expectedRootDigest = recordDigest({
      environmentMeasurements: evidence.executions.map((row) => ({
        fixtureId: row.fixtureId,
        environmentStartDigest: row.environmentStartDigest,
        environmentEndDigest: row.environmentEndDigest,
        currentnessMeasurementDigest: row.currentnessMeasurementDigest,
        cleanupEvidenceDigest: row.cleanupEvidenceDigest
      })),
      namespaces: evidence.isolation.environmentFacts.namespaces,
      cleanupEvidence: evidence.isolation.cleanupEvidence
    });
    if (execution.disposableRootDigest !== expectedRootDigest) fail('disposable root measurement binding');
  }
  if (input.primaryReadinessConfidence !== 96) fail('primary readiness');
  const reviewPath = path.join(qualificationRoot, 'host-integrated-independent-final-review.json');
  const reviewPresent = fs.existsSync(reviewPath);
  if (input.finalReview.required !== true || input.finalReview.receiptPresent !== reviewPresent) fail('final review state');
  if (!reviewPresent) {
    if (!same(proof.stabilityGate.openDefectCodes, ['INDEPENDENT_FINAL_REVIEW_PENDING'])
        || result.outcome !== 'FIRST_HOST_UNSTABLE'
        || !result.reasonCodes.includes('KSTACK_SECOND_HOST_OPEN_DEFECT')) fail('pending-review fail closure');
  } else if (proof.stabilityGate.openDefectCodes.length !== 0
      || result.outcome !== 'ABSTRACTION_PROVEN_FOR_PROFILE') fail('approved-review promotion');
  if (/(?:ATATT3xF[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*\S+)/iu.test(JSON.stringify(input))) fail('secret-like durable evidence');
  return {
    result: 'PASS', evidenceDigest: input.evidenceDigest,
    proofOutcome: result.outcome, profileDigest: proof.profileDigest,
    hosts: proof.executions.map((row) => `${row.hostId}:${row.passedFixtureCount}/${row.fixtureCount}`),
    finalReviewPresent: reviewPresent, expiresAt: proof.expiresAt
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const target = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(qualificationRoot, 'opencode-goose-second-host-proof-evidence.json');
  process.stdout.write(`${JSON.stringify(validateSecondHostEvidenceBundle(JSON.parse(fs.readFileSync(target, 'utf8'))), null, 2)}\n`);
}
