#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HASH = /^[0-9a-f]{64}$/u;
const STATES = new Set(['designing', 'accepted-design', 'targeted-final-remediation', 'owner-decision-required']);

function fail(code) {
  throw new Error(code);
}

function exactKeys(value, expected, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('\0') !== [...expected].sort().join('\0')) fail(code);
}

function assertHash(value, code) {
  if (typeof value !== 'string' || !HASH.test(value)) fail(code);
}

function uniqueStrings(values, code) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || value.length === 0)) fail(code);
  const result = [...new Set(values)].sort();
  if (result.length !== values.length) fail(code);
  return result;
}

function findingRows(findings) {
  if (!Array.isArray(findings) || findings.length === 0) fail('KSTACK_DESIGN_LINEAGE_FINDINGS_REQUIRED');
  const ids = new Set();
  return findings.map((finding) => {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) fail('KSTACK_DESIGN_LINEAGE_FINDING_INVALID');
    if (typeof finding.id !== 'string' || finding.id.length === 0 || ids.has(finding.id)) fail('KSTACK_DESIGN_LINEAGE_FINDING_INVALID');
    ids.add(finding.id);
    const allowedClausePaths = uniqueStrings(finding.allowedClausePaths, 'KSTACK_DESIGN_LINEAGE_FINDING_INVALID');
    if (allowedClausePaths.length === 0) fail('KSTACK_DESIGN_LINEAGE_FINDING_SCOPE_REQUIRED');
    return {
      id: finding.id,
      detail: typeof finding.detail === 'string' && finding.detail.length > 0 ? finding.detail : finding.id,
      allowedClausePaths,
      status: 'open',
      failedAttempts: 0,
      evidence: []
    };
  });
}

function defaultBudget(findings) {
  const clauses = new Set(findings.flatMap((finding) => finding.allowedClausePaths));
  return { maxChangedClauses: clauses.size, maxAddedBytes: 65_536, maxRemovedBytes: 65_536 };
}

function validateBudget(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('KSTACK_DESIGN_LINEAGE_BUDGET_INVALID');
  const fields = ['maxChangedClauses', 'maxAddedBytes', 'maxRemovedBytes'];
  if (fields.some((field) => !Number.isSafeInteger(value[field]) || value[field] < 0)) fail('KSTACK_DESIGN_LINEAGE_BUDGET_INVALID');
  return Object.fromEntries(fields.map((field) => [field, value[field]]));
}

function alarm(state, cycle, code, detail) {
  if (!state.auditAlarms.some((item) => item.code === code && item.cycle === cycle)) {
    state.auditAlarms.push({ cycle, code, detail });
  }
}

function reviewIsPrimaryReady(primary, threshold) {
  return primary?.decision === 'approve' && primary?.clean === true
    && Number.isInteger(primary?.confidence) && primary.confidence >= threshold;
}

function reviewIsFinalAccepted(final, threshold) {
  return final && final.decision !== 'block' && Number.isInteger(final.confidence)
    && final.confidence >= threshold;
}

export function createDesignLineage({ threadId, primaryThreshold = 93, finalThreshold = 81,
  earlyWarningCycle = 6 } = {}) {
  if (typeof threadId !== 'string' || threadId.length === 0) fail('KSTACK_DESIGN_LINEAGE_THREAD_INVALID');
  if (!Number.isInteger(primaryThreshold) || primaryThreshold < 0 || primaryThreshold > 100) fail('KSTACK_DESIGN_LINEAGE_THRESHOLD_INVALID');
  if (!Number.isInteger(finalThreshold) || finalThreshold < 0 || finalThreshold > 100) fail('KSTACK_DESIGN_LINEAGE_THRESHOLD_INVALID');
  if (!Number.isInteger(earlyWarningCycle) || earlyWarningCycle < 5 || earlyWarningCycle > 8) fail('KSTACK_DESIGN_LINEAGE_EARLY_WARNING_INVALID');
  return {
    schema: 'kstack-design-lineage-v1', threadId, status: 'designing', primaryThreshold, finalThreshold,
    earlyWarningCycle, acceptedParentDigest: null, currentBaselineDigest: null,
    highWater: null, remediation: null, cycles: [], auditAlarms: [],
    learningLedger: { accepted: [], rejected: [], inconclusive: [] }
  };
}

export function validateDesignLineage(state) {
  exactKeys(state, [
    'schema', 'threadId', 'status', 'primaryThreshold', 'finalThreshold', 'earlyWarningCycle',
    'acceptedParentDigest', 'currentBaselineDigest', 'highWater', 'remediation', 'cycles',
    'auditAlarms', 'learningLedger'
  ], 'KSTACK_DESIGN_LINEAGE_INVALID');
  if (!state || state.schema !== 'kstack-design-lineage-v1' || !STATES.has(state.status)) fail('KSTACK_DESIGN_LINEAGE_INVALID');
  if (typeof state.threadId !== 'string' || state.threadId.length === 0
    || !Number.isInteger(state.primaryThreshold) || state.primaryThreshold < 0 || state.primaryThreshold > 100
    || !Number.isInteger(state.finalThreshold) || state.finalThreshold < 0 || state.finalThreshold > 100
    || !Number.isInteger(state.earlyWarningCycle) || state.earlyWarningCycle < 5 || state.earlyWarningCycle > 8) {
    fail('KSTACK_DESIGN_LINEAGE_INVALID');
  }
  if (!Array.isArray(state.cycles) || !Array.isArray(state.auditAlarms)
    || !state.learningLedger || ['accepted', 'rejected', 'inconclusive'].some((key) => !Array.isArray(state.learningLedger[key]))) {
    fail('KSTACK_DESIGN_LINEAGE_INVALID');
  }
  exactKeys(state.learningLedger, ['accepted', 'rejected', 'inconclusive'], 'KSTACK_DESIGN_LINEAGE_INVALID');
  if (state.acceptedParentDigest !== null) assertHash(state.acceptedParentDigest, 'KSTACK_DESIGN_LINEAGE_INVALID');
  return state;
}

export function evaluateDesignProposal(state, proposal) {
  validateDesignLineage(state);
  const priorCycles = state.cycles.filter((cycle) => cycle.outcome !== 'accepted-design-locked');
  if (priorCycles.length === 0) return Object.freeze({ ready: true, missingAcceptedEvidence: [], missingRejectedEvidence: [] });
  const acceptedEvidenceIds = uniqueStrings(proposal?.acceptedEvidenceIds ?? [], 'KSTACK_DESIGN_PROPOSAL_INVALID');
  const rejectedEvidenceIds = uniqueStrings(proposal?.rejectedEvidenceIds ?? [], 'KSTACK_DESIGN_PROPOSAL_INVALID');
  if (typeof proposal?.hypothesis !== 'string' || proposal.hypothesis.length === 0
    || !Array.isArray(proposal.changedClausePaths)) fail('KSTACK_DESIGN_PROPOSAL_INVALID');
  uniqueStrings(proposal.changedClausePaths, 'KSTACK_DESIGN_PROPOSAL_INVALID');
  const knownAccepted = new Set(state.learningLedger.accepted.map((item) => item.id));
  const knownRejected = new Set(state.learningLedger.rejected.map((item) => item.id));
  if (acceptedEvidenceIds.some((id) => !knownAccepted.has(id)) || rejectedEvidenceIds.some((id) => !knownRejected.has(id))) {
    fail('KSTACK_DESIGN_PROPOSAL_EVIDENCE_UNKNOWN');
  }
  const missingAcceptedEvidence = knownAccepted.size > 0 && acceptedEvidenceIds.length === 0 ? [...knownAccepted] : [];
  const missingRejectedEvidence = knownRejected.size > 0 && rejectedEvidenceIds.length === 0 ? [...knownRejected] : [];
  return Object.freeze({
    ready: missingAcceptedEvidence.length === 0 && missingRejectedEvidence.length === 0,
    missingAcceptedEvidence, missingRejectedEvidence
  });
}

function recordLearning(state, event, priorHighWater) {
  const confidence = Number.isInteger(event.primary?.confidence) ? event.primary.confidence : null;
  const idPrefix = `CYCLE-${event.cycle}`;
  const common = {
    cycle: event.cycle, designDigest: event.designDigest, hypothesis: event.proposal?.hypothesis ?? 'Initial design baseline.',
    changedClausePaths: event.proposal?.changedClausePaths ?? [], primaryConfidence: confidence
  };
  if ((priorHighWater === null && state.learningLedger.accepted.length === 0)
    || (event.primary?.clean === true && confidence !== null && confidence > priorHighWater)) {
    state.learningLedger.accepted.push({ id: `${idPrefix}-ACCEPTED`, ...common,
      lesson: 'Retain this candidate as the best supported design evidence.' });
  } else if (confidence !== null && confidence < priorHighWater) {
    state.learningLedger.rejected.push({ id: `${idPrefix}-REJECTED`, ...common,
      lesson: 'Do not reuse this change without a new evidence-backed explanation.' });
  } else {
    state.learningLedger.inconclusive.push({ id: `${idPrefix}-INCONCLUSIVE`, ...common,
      lesson: 'This cycle did not improve the high-water candidate.' });
  }
}

function authorizeMaterialAmendment(state, event) {
  const amendment = event.amendment;
  if (!amendment || amendment.ownerAuthorized !== true) return false;
  assertHash(amendment.approvedParentDigest, 'KSTACK_DESIGN_AMENDMENT_INVALID');
  assertHash(amendment.amendmentBaselineDigest, 'KSTACK_DESIGN_AMENDMENT_INVALID');
  if (amendment.approvedParentDigest !== state.acceptedParentDigest
    || amendment.amendmentBaselineDigest !== state.currentBaselineDigest) fail('KSTACK_DESIGN_AMENDMENT_PARENT_MISMATCH');
  const allowedFindingIds = uniqueStrings(amendment.allowedFindingIds, 'KSTACK_DESIGN_AMENDMENT_INVALID');
  const allowedClausePaths = uniqueStrings(amendment.allowedClausePaths, 'KSTACK_DESIGN_AMENDMENT_INVALID');
  if (allowedFindingIds.length === 0 || allowedClausePaths.length === 0) fail('KSTACK_DESIGN_AMENDMENT_INVALID');
  const semanticDeltaBudget = validateBudget(amendment.semanticDeltaBudget);
  state.status = 'targeted-final-remediation';
  state.remediation = {
    kind: 'owner-authorized-material-amendment', approvedParentDigest: state.acceptedParentDigest,
    amendmentBaselineDigest: state.currentBaselineDigest, baselineDigest: state.currentBaselineDigest,
    allowedFindingIds, allowedClausePaths, semanticDeltaBudget,
    items: allowedFindingIds.map((id) => ({
      id, detail: `Owner-authorized amendment ${id}`, allowedClausePaths: [...allowedClausePaths],
      status: 'open', failedAttempts: 0, evidence: []
    })),
    ownerAuthorized: true
  };
  return true;
}

function targetedAdvance(state, event) {
  const remediation = state.remediation;
  if (event.mode !== 'targeted') {
    alarm(state, event.cycle, 'UNRESTRICTED_DESIGN_AFTER_HIGH_WATER', 'The accepted high-water candidate remains frozen; use one bounded remediation item.');
    state.cycles.push({ cycle: event.cycle, designDigest: event.designDigest, outcome: 'rejected-unrestricted-continuation' });
    return state;
  }
  if (event.baselineDigest !== remediation.baselineDigest) fail('KSTACK_DESIGN_REMEDIATION_BASELINE_MISMATCH');
  const changedClausePaths = uniqueStrings(event.changedClausePaths, 'KSTACK_DESIGN_REMEDIATION_DELTA_INVALID');
  const delta = event.semanticDelta;
  if (!delta || !Number.isSafeInteger(delta.addedBytes) || delta.addedBytes < 0
    || !Number.isSafeInteger(delta.removedBytes) || delta.removedBytes < 0) fail('KSTACK_DESIGN_REMEDIATION_DELTA_INVALID');
  const results = event.itemResults;
  if (!Array.isArray(results) || results.length !== 1) fail('KSTACK_DESIGN_REMEDIATION_ONE_ITEM_REQUIRED');
  const result = results[0];
  const item = remediation.items.find((candidate) => candidate.id === result.id);
  if (!item || item.status === 'cleared') fail('KSTACK_DESIGN_REMEDIATION_ITEM_INVALID');
  const allowed = new Set(item.allowedClausePaths);
  if (changedClausePaths.some((clause) => !allowed.has(clause))
    || changedClausePaths.length > remediation.semanticDeltaBudget.maxChangedClauses
    || delta.addedBytes > remediation.semanticDeltaBudget.maxAddedBytes
    || delta.removedBytes > remediation.semanticDeltaBudget.maxRemovedBytes) {
    alarm(state, event.cycle, 'UNRELATED_CLAUSE_DELTA', 'Candidate rejected; the prior remediation baseline remains active.');
    state.cycles.push({ cycle: event.cycle, designDigest: event.designDigest, outcome: 'rejected-unrelated-delta', itemId: item.id });
    return state;
  }
  if (!['cleared', 'failed'].includes(result.status) || typeof result.evidence !== 'string' || result.evidence.length === 0) {
    fail('KSTACK_DESIGN_REMEDIATION_RESULT_INVALID');
  }
  item.evidence.push({ cycle: event.cycle, status: result.status, detail: result.evidence });
  if (result.status === 'cleared') {
    if (Number.isInteger(event.final?.confidence) && event.final.confidence < state.finalThreshold) {
      alarm(state, event.cycle, 'AGGREGATE_RESCORING_CANNOT_DISCARD_ITEM', 'The item-specific clearance is retained despite a lower aggregate final score.');
    }
    item.status = 'cleared';
    remediation.baselineDigest = event.designDigest;
    state.currentBaselineDigest = event.designDigest;
  } else {
    item.failedAttempts += 1;
    if (item.failedAttempts >= 2) {
      state.status = 'owner-decision-required';
      alarm(state, event.cycle, 'REMEDIATION_ATTEMPT_LIMIT', 'Two isolated attempts failed; owner decision or a nonblocking cross-model consult is required without scope growth.');
    }
  }
  state.cycles.push({
    cycle: event.cycle, designDigest: event.designDigest, outcome: `targeted-item-${result.status}`,
    itemId: item.id, aggregatePrimaryConfidence: event.primary?.confidence ?? null,
    aggregateFinalConfidence: event.final?.confidence ?? null
  });
  if (remediation.items.length > 0 && remediation.items.every((candidate) => candidate.status === 'cleared')) {
    state.status = 'accepted-design';
    state.remediation.completedDigest = state.currentBaselineDigest;
  }
  return state;
}

export function advanceDesignLineage(inputState, event) {
  const state = structuredClone(validateDesignLineage(inputState));
  if (!event || !Number.isSafeInteger(event.cycle) || event.cycle < 1) fail('KSTACK_DESIGN_LINEAGE_EVENT_INVALID');
  assertHash(event.designDigest, 'KSTACK_DESIGN_LINEAGE_EVENT_INVALID');
  if (state.cycles.some((cycle) => cycle.cycle === event.cycle)) fail('KSTACK_DESIGN_LINEAGE_CYCLE_REPLAYED');

  if (state.status === 'accepted-design') {
    if (event.designDigest === state.currentBaselineDigest) {
      state.cycles.push({ cycle: event.cycle, designDigest: event.designDigest, outcome: 'accepted-design-locked' });
      return state;
    }
    if (!authorizeMaterialAmendment(state, event)) {
      alarm(state, event.cycle, 'ACCEPTED_PARENT_EXIT_ATTEMPT', 'An accepted design can change only through an explicit owner-authorized material amendment.');
      state.cycles.push({ cycle: event.cycle, designDigest: event.designDigest, outcome: 'rejected-accepted-parent-exit' });
      return state;
    }
  }

  if (['targeted-final-remediation', 'owner-decision-required'].includes(state.status)) {
    if (state.status === 'owner-decision-required') {
      state.cycles.push({ cycle: event.cycle, designDigest: event.designDigest, outcome: 'owner-decision-required' });
      return state;
    }
    return targetedAdvance(state, event);
  }

  const proposal = evaluateDesignProposal(state, event.proposal);
  if (!proposal.ready) {
    alarm(state, event.cycle, 'LEARNING_CONTEXT_INCOMPLETE', 'The next design proposal must examine applicable accepted and rejected evidence before review.');
    state.cycles.push({ cycle: event.cycle, designDigest: event.designDigest, outcome: 'rejected-missing-learning-context', proposal });
    return state;
  }

  const primaryReady = reviewIsPrimaryReady(event.primary, state.primaryThreshold);
  const priorConfidence = state.highWater?.primaryConfidence ?? -1;
  if (event.primary?.clean === true && Number.isInteger(event.primary.confidence) && event.primary.confidence > priorConfidence) {
    state.highWater = { designDigest: event.designDigest, primaryConfidence: event.primary.confidence, cycle: event.cycle };
  }
  recordLearning(state, event, priorConfidence < 0 ? null : priorConfidence);
  if (event.cycle >= state.earlyWarningCycle && !primaryReady
    && !state.auditAlarms.some((item) => item.code === 'EARLY_WARNING_REQUIRED')) {
    alarm(state, event.cycle, 'EARLY_WARNING_REQUIRED', 'Dispatch one lightweight independent advisory review; it cannot replace the full final gate.');
  }
  if (!primaryReady) {
    state.cycles.push({ cycle: event.cycle, designDigest: event.designDigest, outcome: 'primary-not-ready', primaryConfidence: event.primary?.confidence ?? null });
    return state;
  }
  if (reviewIsFinalAccepted(event.final, state.finalThreshold)) {
    state.status = 'accepted-design';
    state.acceptedParentDigest = event.designDigest;
    state.currentBaselineDigest = event.designDigest;
    state.cycles.push({ cycle: event.cycle, designDigest: event.designDigest, outcome: 'accepted-design',
      primaryConfidence: event.primary.confidence, finalConfidence: event.final.confidence,
      implementationFindingIds: (event.final.findings ?? []).map((finding) => finding.id) });
    return state;
  }
  const items = findingRows(event.final?.findings);
  state.status = 'targeted-final-remediation';
  state.acceptedParentDigest = event.designDigest;
  state.currentBaselineDigest = event.designDigest;
  state.remediation = {
    kind: 'subthreshold-final', approvedParentDigest: event.designDigest,
    amendmentBaselineDigest: event.designDigest, baselineDigest: event.designDigest,
    allowedFindingIds: items.map((item) => item.id),
    allowedClausePaths: [...new Set(items.flatMap((item) => item.allowedClausePaths))].sort(),
    semanticDeltaBudget: validateBudget(event.semanticDeltaBudget ?? defaultBudget(items)),
    items, ownerAuthorized: false
  };
  state.cycles.push({ cycle: event.cycle, designDigest: event.designDigest, outcome: 'high-water-parent-accepted-targeted-remediation',
    primaryConfidence: event.primary.confidence, finalConfidence: event.final?.confidence ?? null,
    findingIds: items.map((item) => item.id) });
  return state;
}

export function replayDesignLineage(initial, events) {
  if (!Array.isArray(events)) fail('KSTACK_DESIGN_LINEAGE_EVENTS_INVALID');
  return events.reduce((state, event) => advanceDesignLineage(state, event), initial);
}

function atomicWriteJson(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  fs.renameSync(temporary, file);
}

function parseOptions(argv, names) {
  if (argv.length !== names.length * 2 + 1) fail('KSTACK_DESIGN_LINEAGE_ARGUMENT_INVALID');
  const values = {};
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index]?.startsWith('--') ? argv[index].slice(2) : null;
    const value = argv[index + 1];
    if (!names.includes(key) || Object.hasOwn(values, key) || typeof value !== 'string' || value.startsWith('--')) {
      fail('KSTACK_DESIGN_LINEAGE_ARGUMENT_INVALID');
    }
    values[key] = value;
  }
  if (names.some((name) => !Object.hasOwn(values, name))) fail('KSTACK_DESIGN_LINEAGE_ARGUMENT_INVALID');
  return values;
}

function main(argv) {
  const command = argv[0];
  if (command === 'init') {
    const options = parseOptions(argv, ['file', 'thread-id']);
    const file = options.file;
    const state = createDesignLineage({ threadId: options['thread-id'] });
    fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    return;
  }
  if (command === 'preflight') {
    const options = parseOptions(argv, ['state', 'proposal']);
    const state = JSON.parse(fs.readFileSync(options.state, 'utf8'));
    const proposal = JSON.parse(fs.readFileSync(options.proposal, 'utf8'));
    const result = evaluateDesignProposal(state, proposal);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ready) process.exitCode = 2;
    return;
  }
  if (command === 'advance') {
    const options = parseOptions(argv, ['state', 'event']);
    const stateFile = options.state;
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const event = JSON.parse(fs.readFileSync(options.event, 'utf8'));
    const advanced = advanceDesignLineage(state, event);
    atomicWriteJson(stateFile, advanced);
    process.stdout.write(`${JSON.stringify(advanced, null, 2)}\n`);
    return;
  }
  if (command === 'replay') {
    const options = parseOptions(argv, ['file']);
    const input = JSON.parse(fs.readFileSync(options.file, 'utf8'));
    const state = replayDesignLineage(createDesignLineage(input.config), input.events);
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    return;
  }
  process.stderr.write('Usage: kstack-design-lineage init --file FILE --thread-id ID | preflight --state FILE --proposal FILE | advance --state FILE --event FILE | replay --file FILE\n');
  process.exitCode = 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
