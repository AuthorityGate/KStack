import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileDigest, recordDigest, sourceRoot } from './host-implementation-inventory.mjs';
import { applyRuntimeClosureLedger, validateRuntimeClosureLedger } from './runtime-completion-ledger.mjs';

const qualificationRoot = path.dirname(fileURLToPath(import.meta.url));
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(sourceRoot, relative), 'utf8'));
const roadmapPath = '.kstack/roadmaps/runtime-maturity-focused-2026-08-28.json';
const roadmap = readJson(roadmapPath);
const hostImplementation = readJson('.kstack/qualifications/host-implementation-validation-evidence.json');
const domainImplementation = readJson('.kstack/qualifications/domain-implementation-validation-evidence.json');
const secondHost = readJson('.kstack/qualifications/opencode-goose-second-host-proof-evidence.json');
const openCode = readJson('.kstack/qualifications/opencode-v1.18.25-conformance-evidence.json');
const goose = readJson('.kstack/qualifications/goose-v1.48.0-conformance-evidence.json');
const hostRows = new Map(hostImplementation.rows.map((row) => [row.itemId.toLowerCase().replace('tc', 'tc'), row]));
const domainRows = new Map(domainImplementation.rows.map((row) => [row.itemId, row]));
const roadmapItems = new Map(roadmap.items.map((row) => [row.localId, row]));
const unique = (values) => [...new Set(values)];
const evidence = (...values) => unique(values.flat().filter(Boolean));

const hpId = (index) => `hp-tc${String(index).padStart(2, '0')}-${[
  'schemas', 'request-context', 'replay-time', 'evidence-selection', 'eligibility-quarantine',
  'harness-bypass', 'structural-broker', 'race-mutation', 'mcp-boundary', 'receipt-trust',
  'leases-activation', 'migrations-rollout'
][index - 1]}`;
const hbIds = [
  'hb-tc01-canonical-package', 'hb-tc02-installer', 'hb-tc03-opencode-package',
  'hb-tc04-readonly-mcp', 'hb-tc05-opencode-conformance'
];
const hostItemIds = roadmap.items.filter((row) => row.labels.includes('host-portability') || row.labels.includes('host-breadth')).map((row) => row.localId);
const domainItemIds = roadmap.items.filter((row) => row.labels.includes('domain-breadth')).map((row) => row.localId);

function hostReceiptRow(itemId) {
  const contractId = itemId.slice(0, 7).toUpperCase();
  const row = hostImplementation.rows.find((entry) => entry.itemId === contractId);
  if (!row) throw new Error(`host implementation row missing for ${itemId}`);
  return row;
}

function technicalHostRow(itemId) {
  const row = hostReceiptRow(itemId);
  return {
    itemId, lane: roadmapItems.get(itemId).labels.includes('host-portability') ? 'HOST_PORTABILITY' : 'HOST_BREADTH',
    technicalState: 'IMPLEMENTED_VALIDATED', completionState: 'INDEPENDENT_FINAL_REVIEW_PENDING',
    evidenceDigests: evidence(hostImplementation.evidenceDigest, row.implementationDigest, row.validationReceiptDigest),
    remainingRequirements: ['independent-final-review', 'durable-jira-closure']
  };
}

const hostItems = [
  ...Array.from({ length: 12 }, (_, index) => technicalHostRow(hpId(index + 1))),
  ...hbIds.map(technicalHostRow),
  {
    itemId: 'hb-tc06-second-host-proof', lane: 'HOST_BREADTH',
    technicalState: 'DISTINCT_TWO_HOST_TECHNICAL_PROOF_READY', completionState: 'INDEPENDENT_FINAL_REVIEW_PENDING',
    evidenceDigests: evidence(secondHost.evidenceDigest, secondHost.proof.executions.map((row) => row.evidenceSetDigest)),
    remainingRequirements: ['independent-final-review', 'abstraction-proof-promotion', 'durable-jira-closure']
  },
  {
    itemId: 'hb-tc07-hermes-host', lane: 'HOST_BREADTH',
    technicalState: 'NEGATIVE_SOURCE_QUALIFICATION_CURRENT', completionState: 'UNSUPPORTED_DISPOSITION_REVIEW_PENDING',
    evidenceDigests: evidence(
      fileDigest('.kstack/qualifications/hermes-v2026.8.27-requalification-2026-08-29.md'),
      fileDigest('.kstack/qualifications/host-candidates-2026-08-28.json'),
      fileDigest('.kstack/qualifications/hermes-openclaw-release-recheck-2026-08-30.md')
    ),
    remainingRequirements: ['independent-review-of-negative-qualification', 'owner-accept-or-requalify-later-release', 'durable-jira-closure']
  },
  {
    itemId: 'hb-tc08-openclaw-orchestration', lane: 'HOST_BREADTH',
    technicalState: 'NEGATIVE_SOURCE_AND_SANDBOX_QUALIFICATION_CURRENT', completionState: 'UNSUPPORTED_DISPOSITION_REVIEW_PENDING',
    evidenceDigests: evidence(
      fileDigest('.kstack/qualifications/host-candidates-2026-08-28.json'),
      fileDigest('.kstack/decisions/gstack-hermes-openclaw-review-2026-08-28.md'),
      fileDigest('.kstack/qualifications/openclaw-v2026.7.1-2-acp-boundary-citations-2026-08-30.md'),
      fileDigest('.kstack/qualifications/hermes-openclaw-release-recheck-2026-08-30.md')
    ),
    remainingRequirements: ['independent-review-of-negative-qualification', 'owner-accept-or-requalify-clean-release', 'durable-jira-closure']
  },
  {
    itemId: 'hb-tc09-goose-host', lane: 'HOST_BREADTH',
    technicalState: 'OPERATION_SCOPED_PROTECTED_QUALIFICATION_PASS', completionState: 'INDEPENDENT_FINAL_REVIEW_PENDING',
    evidenceDigests: evidence(goose.evidenceDigest, goose.evidenceSetDigest, fileDigest('.kstack/qualifications/goose-v1.48.0-supply-chain-2026-08-29.md')),
    remainingRequirements: ['independent-final-review', 'host-admission-with-hb-tc06', 'durable-jira-closure']
  },
  {
    itemId: 'linux-distro-matrix', lane: 'HOST_BREADTH',
    technicalState: 'ONE_OF_FOUR_PLATFORM_CELLS_QUALIFIED', completionState: 'EXTERNAL_PLATFORM_CELLS_PENDING',
    evidenceDigests: evidence(
      fileDigest('.kstack/qualifications/linux-ubuntu-24.04-wsl2-2026-08-29.json'),
      fileDigest('plugins/kstack/scripts/kstack-linux-qualification.mjs'),
      fileDigest('plugins/kstack/scripts/kstack-linux-qualification-bundle.mjs'),
      fileDigest('plugins/kstack/scripts/kstack-linux-observation-admit.mjs'),
      fileDigest('plugins/kstack/workers/kstack-linux-observation-collect.sh'),
      fileDigest('tests/linux-observation-admit.test.mjs'),
      fileDigest('tests/linux-qualification-bundle.test.mjs')
    ),
    remainingRequirements: ['ubuntu-native-x64', 'debian-native-x64', 'fedora-native-x64', 'independent-final-review', 'durable-jira-closure']
  },
  {
    itemId: 'linux-lifecycle-qualification', lane: 'HOST_BREADTH',
    technicalState: 'LIFECYCLE_CONTRACT_IMPLEMENTED_ZERO_OF_FOUR_CELLS', completionState: 'TWO_RELEASE_EXTERNAL_LIFECYCLES_PENDING',
    evidenceDigests: evidence(
      fileDigest('plugins/kstack/scripts/kstack-linux-qualification.mjs'),
      fileDigest('plugins/kstack/scripts/kstack-linux-qualification-bundle.mjs'),
      fileDigest('tests/linux-qualification.test.mjs'),
      fileDigest('tests/linux-qualification-bundle.test.mjs')
    ),
    remainingRequirements: ['four-clean-install-upgrade-rollback-recovery-cells', 'two-exact-release-identities', 'independent-final-review', 'durable-jira-closure']
  },
  {
    itemId: 'linux-privileged-backends', lane: 'HOST_PORTABILITY',
    technicalState: 'CONTRACT_IMPLEMENTED_ZERO_OF_TWELVE_BACKEND_CELLS', completionState: 'AUTHORIZED_PRIVILEGED_EXECUTION_PENDING',
    evidenceDigests: evidence(
      fileDigest('plugins/kstack/scripts/kstack-linux-qualification.mjs'),
      fileDigest('plugins/kstack/scripts/kstack-linux-qualification-bundle.mjs'),
      fileDigest('.kstack/qualifications/linux-ubuntu-24.04-wsl2-2026-08-29.json'),
      fileDigest('tests/linux-qualification-bundle.test.mjs')
    ),
    remainingRequirements: ['cgroup-v2-on-four-cells', 'ebpf-on-four-cells', 'pidfd-on-four-cells', 'independent-final-review', 'durable-jira-closure']
  },
  {
    itemId: 'kcrp-host-provider-trial', lane: 'HOST_PORTABILITY',
    technicalState: 'WINDOW1_PREPARED_PROVIDER_EXECUTION_AUTHORIZATION_PENDING', completionState: 'PROVIDER_AB_TRIAL_PENDING',
    evidenceDigests: evidence(
      fileDigest('.kstack/decisions/kcrp-host-domain-offline-byte-replay-2026-08-29-evidence.md'),
      fileDigest('tests/fixtures/kcrp-host-hb-tc06-byte-replay-v1.json'),
      fileDigest('plugins/kstack/scripts/kstack-kcrp-provider-trial.mjs'),
      fileDigest('tests/kcrp-provider-trial-execution.test.mjs')
    ),
    remainingRequirements: ['three-distinct-date-full-versus-reduced-provider-windows', 'token-latency-cost-measurements', 'blind-quality-noninferiority', 'durable-jira-closure']
  }
];

const domainItems = domainImplementation.rows.map((row) => {
  const pack = row.maturity === 'CANDIDATE_ONLY';
  const acquisition = row.maturity === 'OFFLINE_TRIAL_IMPLEMENTED';
  return {
    itemId: row.itemId, lane: 'DOMAIN_BREADTH',
    technicalState: pack ? 'CANONICAL_CANDIDATE_VALIDATED' : acquisition ? 'OFFLINE_ACQUISITION_TRIAL_IMPLEMENTED' : 'IMPLEMENTED_VALIDATED',
    completionState: pack ? 'PACK_QUALIFICATION_AND_ACTIVATION_PENDING' : 'INDEPENDENT_FINAL_REVIEW_PENDING',
    evidenceDigests: evidence(domainImplementation.evidenceDigest, row.implementationDigest, row.validationReceiptDigest),
    remainingRequirements: pack
      ? ['held-out-incremental-evaluation', 'natural-person-adjudication', 'd4-d10-and-d6-qualification', 'independent-final-review', 'owner-d5-activation', 'durable-jira-closure']
      : acquisition
        ? ['independent-final-review', 'owner-accept-offline-only-disposition', 'durable-jira-closure']
        : ['independent-final-review', 'durable-jira-closure']
  };
});
domainItems.push({
  itemId: 'kcrp-domain-provider-trial', lane: 'DOMAIN_BREADTH',
  technicalState: 'WINDOW1_PREPARED_PROVIDER_EXECUTION_AUTHORIZATION_PENDING', completionState: 'PROVIDER_AB_TRIAL_PENDING',
  evidenceDigests: evidence(
    fileDigest('.kstack/decisions/kcrp-host-domain-offline-byte-replay-2026-08-29-evidence.md'),
    fileDigest('tests/fixtures/kcrp-domain-d7-byte-replay-v1.json'),
    fileDigest('plugins/kstack/scripts/kstack-kcrp-provider-trial.mjs'),
    fileDigest('tests/kcrp-provider-trial-preparation.test.mjs')
  ),
  remainingRequirements: ['three-distinct-date-full-versus-reduced-provider-windows', 'token-latency-cost-measurements', 'blind-quality-noninferiority', 'durable-jira-closure']
});

for (const [name, expected, actual] of [
  ['host', hostItemIds, hostItems.map((row) => row.itemId)],
  ['domain', domainItemIds, domainItems.map((row) => row.itemId)]
]) {
  const missing = expected.filter((itemId) => !actual.includes(itemId));
  const extra = actual.filter((itemId) => !expected.includes(itemId));
  const duplicates = actual.filter((itemId, index) => actual.indexOf(itemId) !== index);
  if (missing.length || extra.length || duplicates.length) throw new Error(`${name} audit inventory drift: ${JSON.stringify({ missing, extra, duplicates })}`);
}

const generatedAt = new Date(Math.max(
  Date.parse(hostImplementation.completedAt), Date.parse(domainImplementation.completedAt),
  Date.parse(secondHost.proof.observedAt)
) + 1_000).toISOString();
const baseRows = [...hostItems, ...domainItems];
const closureLedgerPath = path.join(sourceRoot, '.kstack/qualifications/runtime-host-domain-closure-ledger.json');
const closureLedger = fs.existsSync(closureLedgerPath)
  ? validateRuntimeClosureLedger(JSON.parse(fs.readFileSync(closureLedgerPath, 'utf8')), {
    roadmapDigest: fileDigest(roadmapPath), baseRows
  })
  : Object.freeze({
    schemaVersion: 1,
    kind: 'kstack-runtime-host-domain-closure-ledger-v1',
    roadmapDigest: fileDigest(roadmapPath),
    entries: [],
    ledgerDigest: null
  });
const closedRows = applyRuntimeClosureLedger(baseRows, closureLedger);
const closedHostItems = closedRows.slice(0, hostItems.length);
const closedDomainItems = closedRows.slice(hostItems.length);
const report = {
  schema: 'kstack-runtime-host-domain-completion-audit-v1',
  generatedAt,
  roadmapDigest: fileDigest(roadmapPath),
  bindings: {
    hostImplementationEvidenceDigest: hostImplementation.evidenceDigest,
    domainImplementationEvidenceDigest: domainImplementation.evidenceDigest,
    secondHostEvidenceDigest: secondHost.evidenceDigest,
    openCodeEvidenceDigest: openCode.evidenceDigest,
    gooseEvidenceDigest: goose.evidenceDigest,
    closureLedgerDigest: closureLedger.ledgerDigest
  },
  hostItems: closedHostItems,
  domainItems: closedDomainItems,
  summary: {
    hostItems: closedHostItems.length,
    domainItems: closedDomainItems.length,
    technicallyImplementedOrQualified: closedRows.filter((row) => ![
      'EXTERNAL_PLATFORM_CELLS_PENDING', 'TWO_RELEASE_EXTERNAL_LIFECYCLES_PENDING',
      'AUTHORIZED_PRIVILEGED_EXECUTION_PENDING', 'PROVIDER_AB_TRIAL_PENDING',
      'PACK_QUALIFICATION_AND_ACTIVATION_PENDING'
    ].includes(row.completionState)).length,
    fullyClosed: closedRows.filter((row) => row.completionState === 'FULLY_CLOSED').length,
    externalExecutionPending: closedRows.filter((row) => row.completionState.includes('PENDING')).length
  },
  formalRuntimeReportUpdated: false
};
report.evidenceDigest = recordDigest(report);
fs.writeFileSync(path.join(qualificationRoot, 'runtime-host-domain-completion-audit.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({
  result: 'PASS', evidenceDigest: report.evidenceDigest,
  hostItems: report.summary.hostItems, domainItems: report.summary.domainItems,
  technicallyImplementedOrQualified: report.summary.technicallyImplementedOrQualified,
  fullyClosed: report.summary.fullyClosed,
  formalRuntimeReportUpdated: report.formalRuntimeReportUpdated
}, null, 2)}\n`);
