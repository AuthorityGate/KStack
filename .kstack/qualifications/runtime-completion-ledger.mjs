import { canonical, recordDigest } from './host-implementation-inventory.mjs';

const HASH = /^[a-f0-9]{64}$/u;
const ISSUE = /^[A-Z][A-Z0-9]+-[1-9][0-9]*$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const DISPOSITIONS = new Set(['SATISFIED', 'ACCEPTED_UNSUPPORTED']);

function fail(detail) {
  const error = new Error(`KSTACK_RUNTIME_CLOSURE_LEDGER_INVALID: ${detail}`);
  error.code = 'KSTACK_RUNTIME_CLOSURE_LEDGER_INVALID';
  throw error;
}

function exact(value, keys, detail) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) fail(detail);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(detail);
}

function digest(value, detail) {
  if (typeof value !== 'string' || !HASH.test(value)) fail(detail);
  return value;
}

function digestSet(values, detail) {
  if (!Array.isArray(values) || values.length < 1) fail(detail);
  const admitted = values.map((value) => digest(value, detail));
  if (new Set(admitted).size !== admitted.length || admitted.some((value, index) => index && admitted[index - 1] >= value)) fail(detail);
  return admitted;
}

function requirementRecord(value, expectedId) {
  exact(value, ['requirementId', 'disposition', 'evidenceDigests', 'ownerDecisionDigest'], `requirement ${expectedId}`);
  if (value.requirementId !== expectedId || !DISPOSITIONS.has(value.disposition)) fail(`requirement ${expectedId}`);
  const ownerRequirement = expectedId.startsWith('owner-');
  if (ownerRequirement !== (value.ownerDecisionDigest !== null)) fail(`owner binding ${expectedId}`);
  if (ownerRequirement) digest(value.ownerDecisionDigest, `owner decision ${expectedId}`);
  if (!ownerRequirement && value.disposition !== 'SATISFIED') fail(`unsupported disposition ${expectedId}`);
  return {
    requirementId: expectedId,
    disposition: value.disposition,
    evidenceDigests: digestSet(value.evidenceDigests, `evidence ${expectedId}`),
    ownerDecisionDigest: value.ownerDecisionDigest
  };
}

function closureEntry(value, baseRow) {
  exact(value, ['itemId', 'lane', 'targetDigest', 'requirements', 'jira', 'closedAt', 'closureDigest'], `entry ${baseRow.itemId}`);
  if (value.itemId !== baseRow.itemId || value.lane !== baseRow.lane) fail(`identity ${baseRow.itemId}`);
  if (value.targetDigest !== recordDigest(baseRow)) fail(`target drift ${baseRow.itemId}`);
  if (!Array.isArray(value.requirements)) fail(`requirements ${baseRow.itemId}`);
  const expectedRequirements = [...baseRow.remainingRequirements].sort();
  if (value.requirements.length !== expectedRequirements.length) fail(`requirement count ${baseRow.itemId}`);
  const actualIds = value.requirements.map((row) => row?.requirementId);
  if (actualIds.some((id, index) => id !== expectedRequirements[index])) fail(`requirement inventory ${baseRow.itemId}`);
  const requirements = value.requirements.map((row, index) => requirementRecord(row, expectedRequirements[index]));

  exact(value.jira, ['issueKey', 'statusCategory', 'resolution', 'evidenceDigest'], `jira ${baseRow.itemId}`);
  if (typeof value.jira.issueKey !== 'string' || !ISSUE.test(value.jira.issueKey)
      || value.jira.statusCategory !== 'DONE' || value.jira.resolution !== 'DONE') fail(`jira ${baseRow.itemId}`);
  digest(value.jira.evidenceDigest, `jira evidence ${baseRow.itemId}`);
  const jiraRequirement = requirements.find((row) => row.requirementId === 'durable-jira-closure');
  if (!jiraRequirement || !jiraRequirement.evidenceDigests.includes(value.jira.evidenceDigest)) fail(`jira requirement ${baseRow.itemId}`);
  if (typeof value.closedAt !== 'string' || !ISO_UTC.test(value.closedAt)
      || !Number.isFinite(Date.parse(value.closedAt))) fail(`closedAt ${baseRow.itemId}`);

  const record = {
    itemId: value.itemId,
    lane: value.lane,
    targetDigest: value.targetDigest,
    requirements,
    jira: value.jira,
    closedAt: value.closedAt
  };
  if (value.closureDigest !== recordDigest(record)) fail(`closure digest ${baseRow.itemId}`);
  return Object.freeze({ ...canonical(record), closureDigest: value.closureDigest });
}

export function validateRuntimeClosureLedger(input, { roadmapDigest, baseRows }) {
  exact(input, ['schemaVersion', 'kind', 'roadmapDigest', 'entries', 'ledgerDigest'], 'ledger shape');
  if (input.schemaVersion !== 1 || input.kind !== 'kstack-runtime-host-domain-closure-ledger-v1'
      || input.roadmapDigest !== roadmapDigest || !Array.isArray(input.entries)) fail('ledger identity');
  const rows = new Map(baseRows.map((row) => [row.itemId, row]));
  if (rows.size !== baseRows.length) fail('base inventory');
  const entryIds = input.entries.map((row) => row?.itemId);
  if (new Set(entryIds).size !== entryIds.length || entryIds.some((id, index) => index && entryIds[index - 1] >= id)) fail('entry order');
  const entries = input.entries.map((entry) => {
    const baseRow = rows.get(entry?.itemId);
    if (!baseRow) fail('unknown item');
    return closureEntry(entry, baseRow);
  });
  const record = {
    schemaVersion: 1,
    kind: 'kstack-runtime-host-domain-closure-ledger-v1',
    roadmapDigest: input.roadmapDigest,
    entries
  };
  if (input.ledgerDigest !== recordDigest(record)) fail('ledger digest');
  return Object.freeze({ ...canonical(record), ledgerDigest: input.ledgerDigest });
}

export function applyRuntimeClosureLedger(baseRows, ledger) {
  const closed = new Map(ledger.entries.map((entry) => [entry.itemId, entry]));
  return baseRows.map((row) => {
    const entry = closed.get(row.itemId);
    if (!entry) return row;
    return {
      ...row,
      completionState: 'FULLY_CLOSED',
      evidenceDigests: [...new Set([...row.evidenceDigests, entry.closureDigest, entry.jira.evidenceDigest])],
      remainingRequirements: [],
      closure: {
        closureDigest: entry.closureDigest,
        closedAt: entry.closedAt,
        jiraIssueKey: entry.jira.issueKey,
        jiraEvidenceDigest: entry.jira.evidenceDigest,
        targetDigest: entry.targetDigest
      }
    };
  });
}
