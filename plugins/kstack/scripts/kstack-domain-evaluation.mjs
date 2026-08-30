import crypto from 'node:crypto';
export const EVALUATION_CONDITIONS = Object.freeze(['A', 'B', 'C']);
export const EVALUATION_STRATA = Object.freeze([
  'ambiguous-partially-acted', 'canary-degradation', 'ordinary-staged-release',
  'rollback-incident-handoff', 'state-data-migration'
]);
export const EVALUATION_CROSS_CUTS = Object.freeze([
  'branchCount', 'environment', 'evidenceFreshness', 'externalText', 'jira', 'reversibility'
]);

const CROSS_CUT_VALUES = Object.freeze({
  branchCount: ['multiple', 'single'], environment: ['development', 'production'],
  evidenceFreshness: ['fresh', 'stale-or-missing'], externalText: ['adversarial', 'ordinary'],
  jira: ['off', 'on'], reversibility: ['irreversible', 'reversible']
});
const packProfile = (packId, criticalStrata, crossCutValues) => Object.freeze({
  packId,
  criticalStrata: Object.freeze(criticalStrata),
  crossCutValues: Object.freeze(Object.fromEntries(Object.entries(crossCutValues)
    .map(([key, values]) => [key, Object.freeze(values)])))
});
export const DOMAIN_EVALUATION_PROFILES = Object.freeze({
  assurance: packProfile('assurance', [
    'assets-boundaries', 'controls-effectiveness', 'data-obligations',
    'residual-risk-exceptions', 'threats-abuse-paths'
  ], {
    boundaryCount: ['multiple', 'single'], controlState: ['degraded-or-unknown', 'effective'],
    dataSensitivity: ['ordinary', 'sensitive'], environment: ['development', 'production'],
    evidenceFreshness: ['fresh', 'stale-or-missing'], externalText: ['adversarial', 'ordinary']
  }),
  'product-experience': packProfile('product-experience', [
    'accessibility-language', 'error-recovery-support', 'journey-state-continuity',
    'premise-outcome', 'representative-validation'
  ], {
    accessibilityNeed: ['ordinary', 'specialized'], audienceBreadth: ['diverse', 'single'],
    evidenceFreshness: ['fresh', 'stale-or-missing'], externalText: ['adversarial', 'ordinary'],
    journeyComplexity: ['multiple-path', 'single-path'], surface: ['developer', 'end-user']
  }),
  'release-operations': packProfile('release-operations', [...EVALUATION_STRATA], CROSS_CUT_VALUES),
  'research-knowledge': packProfile('research-knowledge', [
    'citation-decision-use', 'contradiction-counterevidence', 'question-scope',
    'source-quality', 'synthesis-inference'
  ], {
    claimImpact: ['high', 'ordinary'], evidenceFreshness: ['fresh', 'stale-or-missing'],
    externalText: ['adversarial', 'ordinary'], sourceAgreement: ['conflicting', 'consistent'],
    sourceCount: ['multiple', 'single'], sourceType: ['primary', 'secondary']
  })
});
const DIGEST = /^[a-f0-9]{64}$/u;
const ID = /^[a-z][a-z0-9._-]{0,127}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const FROZEN_CORPORA = new WeakSet();
const EXECUTION_LEDGERS = new WeakSet();
const ADJUDICATIONS = new WeakSet();
const RESAMPLES = 100_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function exact(value, keys, code) {
  const actual = plain(value) ? Object.keys(value).sort(compareUtf8) : [];
  const expected = [...keys].sort(compareUtf8);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}

function text(value, expression, code, maximum = 128) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !value.isWellFormed()
      || value.normalize('NFC') !== value || CONTROL_OR_BIDI.test(value) || !expression.test(value)) fail(code);
  return value;
}

function digest(value, code) {
  return text(value, DIGEST, code, 64);
}

function integer(value, minimum, maximum, code) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) fail(code);
  return value;
}

function bool(value, code) {
  if (typeof value !== 'boolean') fail(code);
  return value;
}

function immutable(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

function canonicalEvaluationValue(value, ancestors = new Set()) {
  if (value === null || value === true || value === false) return JSON.stringify(value);
  if (typeof value === 'string') {
    if (!value.isWellFormed() || value.normalize('NFC') !== value) fail('EVALUATION_CANONICAL_INVALID');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) fail('EVALUATION_CANONICAL_INVALID');
    return JSON.stringify(value);
  }
  if (!value || typeof value !== 'object' || ancestors.has(value)) fail('EVALUATION_CANONICAL_INVALID');
  ancestors.add(value);
  let output;
  if (Array.isArray(value)) output = `[${value.map((entry) => canonicalEvaluationValue(entry, ancestors)).join(',')}]`;
  else {
    if (!plain(value)) fail('EVALUATION_CANONICAL_INVALID');
    output = `{${Object.keys(value).sort(compareUtf8).map((key) => `${JSON.stringify(key)}:${canonicalEvaluationValue(value[key], ancestors)}`).join(',')}}`;
  }
  ancestors.delete(value);
  return output;
}

export function evaluationCanonicalBytes(value) {
  return Buffer.from(canonicalEvaluationValue(value), 'utf8');
}

function domainDigest(domain, value) {
  return crypto.createHash('sha256').update(Buffer.from(`${domain}\n`)).update(evaluationCanonicalBytes(value)).digest('hex');
}

function profileRecord(profile) {
  return {
    packId: profile.packId,
    criticalStrata: [...profile.criticalStrata],
    crossCutValues: Object.fromEntries(Object.keys(profile.crossCutValues).sort(compareUtf8)
      .map((key) => [key, [...profile.crossCutValues[key]]]))
  };
}

export function evaluationProfileDigest(packId) {
  const profile = DOMAIN_EVALUATION_PROFILES[packId];
  if (!profile) fail('EVALUATION_PROFILE_INVALID');
  return domainDigest('KSTACK-EVALUATION-PROFILE-V2', profileRecord(profile));
}

function sortedUnique(values, allowed, code, minimum = 1) {
  if (!Array.isArray(values) || values.length < minimum || values.length > allowed.length
      || values.some((entry) => !allowed.includes(entry))) fail(code);
  const sorted = [...values].sort(compareUtf8);
  if (new Set(values).size !== values.length || values.some((entry, index) => entry !== sorted[index])) fail(code);
  return [...values];
}

export function evaluationPowerPlan() {
  const zAlpha = 2.128045;
  const zPower = 0.841621;
  const hypotheses = [
    { id: 'c-a-material-recall', effect: 0.10, boundary: 0.05, delta: 0.05, sd: 0.25 },
    { id: 'c-a-base-recall', effect: 0, boundary: -0.02, delta: 0.02, sd: 0.10 },
    { id: 'c-b-material-recall', effect: 0.06, boundary: 0.02, delta: 0.04, sd: 0.20 }
  ].map((entry) => {
    const n0 = Math.ceil((((zAlpha + zPower) * entry.sd) / entry.delta) ** 2);
    const n = Math.ceil(n0 / 0.80);
    return { ...entry, n0, attritionAdjustedN: n };
  });
  if (hypotheses.some((entry) => entry.n0 !== 221 || entry.attritionAdjustedN !== 277)) fail('EVALUATION_POWER_PLAN_INVALID');
  return immutable({ alpha: 0.05, alphaStar: 0.05 / 3, power: 0.80, attritionRetention: 0.80, zAlpha, zPower, frozenCases: 300, hypotheses });
}

function validatePlan(input) {
  const code = 'EVALUATION_PLAN_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'candidatePackDigest', 'candidatePackAuthorIds',
    'planDigest', 'adjudicationGuideDigest', 'executionCodeDigest', 'analysisCodeDigest',
    'conditionPromptDigests', 'providerId', 'modelId', 'parametersDigest',
    'responseSchemaDigest', 'responseReserveTokens', 'baseSixLaneDigest', 'randomizationSeedDigest'
  ], code);
  if (input.artifactType !== 'kstack-evaluation-plan' || input.schemaVersion !== 1) fail(code);
  exact(input.conditionPromptDigests, EVALUATION_CONDITIONS, code);
  const conditionPromptDigests = {};
  for (const condition of EVALUATION_CONDITIONS) conditionPromptDigests[condition] = digest(input.conditionPromptDigests[condition], code);
  const candidatePackAuthorIds = Array.isArray(input.candidatePackAuthorIds)
    ? input.candidatePackAuthorIds.map((entry) => text(entry, ID, code)) : fail(code);
  const sorted = [...candidatePackAuthorIds].sort(compareUtf8);
  if (candidatePackAuthorIds.length < 1 || new Set(candidatePackAuthorIds).size !== candidatePackAuthorIds.length
      || candidatePackAuthorIds.some((entry, index) => entry !== sorted[index])) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1,
    candidatePackDigest: digest(input.candidatePackDigest, code), candidatePackAuthorIds,
    planDigest: digest(input.planDigest, code), adjudicationGuideDigest: digest(input.adjudicationGuideDigest, code),
    executionCodeDigest: digest(input.executionCodeDigest, code), analysisCodeDigest: digest(input.analysisCodeDigest, code),
    conditionPromptDigests, providerId: text(input.providerId, ID, code), modelId: text(input.modelId, ID, code),
    parametersDigest: digest(input.parametersDigest, code), responseSchemaDigest: digest(input.responseSchemaDigest, code),
    responseReserveTokens: integer(input.responseReserveTokens, 1, Number.MAX_SAFE_INTEGER, code),
    baseSixLaneDigest: digest(input.baseSixLaneDigest, code), randomizationSeedDigest: digest(input.randomizationSeedDigest, code)
  };
}

function validatePackPlan(input) {
  const code = 'EVALUATION_PLAN_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'candidatePackId', 'candidatePackDigest',
    'candidatePackAuthorIds', 'evaluationProfileDigest', 'planDigest',
    'adjudicationGuideDigest', 'executionCodeDigest', 'analysisCodeDigest',
    'conditionPromptDigests', 'providerId', 'modelId', 'parametersDigest',
    'responseSchemaDigest', 'responseReserveTokens', 'baseSixLaneDigest',
    'randomizationSeedDigest'
  ], code);
  const candidatePackId = text(input.candidatePackId, ID, code);
  const profile = DOMAIN_EVALUATION_PROFILES[candidatePackId];
  if (input.artifactType !== 'kstack-evaluation-plan' || input.schemaVersion !== 2 || !profile
      || input.evaluationProfileDigest !== evaluationProfileDigest(candidatePackId)) fail(code);
  const {
    candidatePackId: ignoredCandidatePackId,
    evaluationProfileDigest: ignoredProfileDigest,
    ...legacyInput
  } = input;
  void ignoredCandidatePackId;
  void ignoredProfileDigest;
  const legacy = validatePlan({ ...legacyInput, schemaVersion: 1 });
  return {
    ...legacy,
    schemaVersion: 2,
    candidatePackId,
    evaluationProfileDigest: input.evaluationProfileDigest
  };
}

function validateGap(input, code) {
  exact(input, ['gapId', 'severity', 'acceptanceCriteriaDigest', 'supportingSourceIds', 'laneOwnership', 'critical'], code);
  const supportingSourceIds = Array.isArray(input.supportingSourceIds)
    ? input.supportingSourceIds.map((entry) => text(entry, ID, code)) : fail(code);
  if (supportingSourceIds.length < 1 || new Set(supportingSourceIds).size !== supportingSourceIds.length) fail(code);
  return {
    gapId: text(input.gapId, ID, code), severity: text(input.severity, /^(?:critical|high|medium)$/u, code),
    acceptanceCriteriaDigest: digest(input.acceptanceCriteriaDigest, code),
    supportingSourceIds: [...supportingSourceIds].sort(compareUtf8),
    laneOwnership: text(input.laneOwnership, /^(?:base-lane|pack-incremental|shared)$/u, code),
    critical: bool(input.critical, code)
  };
}

function validateCase(input, authors, code, profile = DOMAIN_EVALUATION_PROFILES['release-operations']) {
  exact(input, ['caseId', 'criticalStratum', 'crossCuts', 'sourceDigest', 'authorId', 'heldOutFromPackAuthors', 'goldGaps'], code);
  if (!profile.criticalStrata.includes(input.criticalStratum)) fail(code);
  const crossCutKeys = Object.keys(profile.crossCutValues).sort(compareUtf8);
  exact(input.crossCuts, crossCutKeys, code);
  const crossCuts = {};
  for (const key of crossCutKeys) {
    if (!profile.crossCutValues[key].includes(input.crossCuts[key])) fail(code);
    crossCuts[key] = input.crossCuts[key];
  }
  const authorId = text(input.authorId, ID, code);
  if (authors.has(authorId)) fail(code);
  if (!Array.isArray(input.goldGaps) || input.goldGaps.length < 1 || input.goldGaps.length > 128) fail(code);
  const goldGaps = input.goldGaps.map((gap) => validateGap(gap, code));
  if (new Set(goldGaps.map((gap) => gap.gapId)).size !== goldGaps.length) fail(code);
  return {
    caseId: text(input.caseId, ID, code), criticalStratum: input.criticalStratum, crossCuts,
    sourceDigest: digest(input.sourceDigest, code), authorId,
    heldOutFromPackAuthors: bool(input.heldOutFromPackAuthors, code), goldGaps
  };
}

function validateCorpusCases(inputCases, plan, profile, code) {
  if (!Array.isArray(inputCases) || inputCases.length !== 300) fail(code);
  const authors = new Set(plan.candidatePackAuthorIds);
  const cases = inputCases.map((entry) => validateCase(entry, authors, code, profile));
  if (new Set(cases.map((entry) => entry.caseId)).size !== 300) fail(code);
  const crossCutKeys = Object.keys(profile.crossCutValues).sort(compareUtf8);
  for (const stratum of profile.criticalStrata) {
    const rows = cases.filter((entry) => entry.criticalStratum === stratum);
    if (rows.length !== 60 || rows.filter((entry) => entry.heldOutFromPackAuthors).length < 15) fail(code);
    for (const cut of crossCutKeys) {
      const count = rows.filter((entry) => entry.crossCuts[cut] === profile.crossCutValues[cut][0]).length;
      if (count < 24 || count > 36) fail(code);
    }
  }
  return cases;
}

export function freezeEvaluationCorpus(input) {
  const code = 'EVALUATION_CORPUS_INVALID';
  exact(input, ['plan', 'cases'], code);
  const plan = validatePlan(input.plan);
  const cases = validateCorpusCases(input.cases, plan, DOMAIN_EVALUATION_PROFILES['release-operations'], code);
  const corpusRecord = { artifactType: 'kstack-evaluation-corpus', schemaVersion: 1, cases };
  const result = immutable({
    plan, cases, corpusDigest: domainDigest('KSTACK-EVALUATION-CORPUS-V1', corpusRecord),
    powerPlan: evaluationPowerPlan()
  });
  FROZEN_CORPORA.add(result);
  return result;
}

export function freezePackEvaluationCorpus(input) {
  const code = 'EVALUATION_CORPUS_INVALID';
  exact(input, ['plan', 'cases'], code);
  const plan = validatePackPlan(input.plan);
  const profile = DOMAIN_EVALUATION_PROFILES[plan.candidatePackId];
  const cases = validateCorpusCases(input.cases, plan, profile, code);
  const frozenProfile = immutable(profileRecord(profile));
  const corpusRecord = {
    artifactType: 'kstack-pack-evaluation-corpus', schemaVersion: 2,
    candidatePackId: plan.candidatePackId, evaluationProfile: frozenProfile, cases
  };
  const result = immutable({
    plan,
    profile: frozenProfile,
    cases,
    corpusDigest: domainDigest('KSTACK-EVALUATION-CORPUS-V2', corpusRecord),
    powerPlan: evaluationPowerPlan()
  });
  FROZEN_CORPORA.add(result);
  return result;
}

export function deriveConditionOrder(randomizationSeedDigest, caseId) {
  digest(randomizationSeedDigest, 'EVALUATION_PLAN_INVALID');
  text(caseId, ID, 'EVALUATION_CORPUS_INVALID');
  return EVALUATION_CONDITIONS.map((condition) => ({
    condition,
    key: crypto.createHash('sha256').update(Buffer.from('KSTACK-EVALUATION-ORDER-V1\n'))
      .update(Buffer.from(randomizationSeedDigest, 'hex')).update(Buffer.from(caseId)).update(Buffer.from(condition)).digest('hex')
  })).sort((a, b) => compareUtf8(a.key, b.key)).map((entry) => entry.condition);
}

function validateExecution(input, frozen, code) {
  exact(input, [
    'caseId', 'condition', 'executionOrdinal', 'sessionId', 'providerId', 'modelId',
    'parametersDigest', 'subjectEvidenceDigest', 'responseSchemaDigest', 'responseReserveTokens',
    'baseSixLaneDigest', 'promptDigest', 'status', 'attemptCount', 'outputDigest',
    'renderedBytes', 'durationMs', 'toolCallCount', 'conditionLeakageDetected',
    'findingInventory', 'findingInventoryDigest'
  ], code);
  const caseRecord = frozen.cases.find((entry) => entry.caseId === input.caseId);
  if (!caseRecord || !EVALUATION_CONDITIONS.includes(input.condition)) fail(code);
  const order = deriveConditionOrder(frozen.plan.randomizationSeedDigest, input.caseId);
  if (input.executionOrdinal !== order.indexOf(input.condition)) fail(code);
  if (input.providerId !== frozen.plan.providerId || input.modelId !== frozen.plan.modelId
      || input.parametersDigest !== frozen.plan.parametersDigest
      || input.subjectEvidenceDigest !== caseRecord.sourceDigest
      || input.responseSchemaDigest !== frozen.plan.responseSchemaDigest
      || input.responseReserveTokens !== frozen.plan.responseReserveTokens
      || input.baseSixLaneDigest !== frozen.plan.baseSixLaneDigest
      || input.promptDigest !== frozen.plan.conditionPromptDigests[input.condition]
      || input.toolCallCount !== 0 || input.conditionLeakageDetected !== false) fail(code);
  if (!['persistent-failure', 'success'].includes(input.status)) fail(code);
  const attemptCount = integer(input.attemptCount, 1, 2, code);
  if (!Array.isArray(input.findingInventory) || input.findingInventory.length > 10_000) fail(code);
  const findingInventory = input.findingInventory.map((entry) => {
    exact(entry, ['findingId', 'rawFindingDigest'], code);
    return { findingId: text(entry.findingId, ID, code), rawFindingDigest: digest(entry.rawFindingDigest, code) };
  });
  const findingIds = findingInventory.map((entry) => entry.findingId);
  if (new Set(findingIds).size !== findingIds.length
      || findingIds.some((entry, index) => index > 0 && compareUtf8(findingIds[index - 1], entry) >= 0)) fail(code);
  if (input.status === 'persistent-failure' && (attemptCount !== 2 || input.outputDigest !== null
      || findingInventory.length !== 0 || input.findingInventoryDigest !== null)) fail(code);
  if (input.status === 'success') {
    digest(input.outputDigest, code);
    const expectedInventoryDigest = domainDigest('KSTACK-EVALUATION-RAW-FINDING-INVENTORY-V1', {
      outputDigest: input.outputDigest, findings: findingInventory
    });
    if (input.findingInventoryDigest !== expectedInventoryDigest) fail(code);
  }
  return {
    caseId: input.caseId, condition: input.condition, executionOrdinal: input.executionOrdinal,
    sessionId: text(input.sessionId, ID, code), providerId: input.providerId, modelId: input.modelId,
    parametersDigest: input.parametersDigest, subjectEvidenceDigest: input.subjectEvidenceDigest,
    responseSchemaDigest: input.responseSchemaDigest, responseReserveTokens: input.responseReserveTokens,
    baseSixLaneDigest: input.baseSixLaneDigest, promptDigest: input.promptDigest, status: input.status,
    attemptCount, outputDigest: input.outputDigest, findingInventory, findingInventoryDigest: input.findingInventoryDigest,
    renderedBytes: integer(input.renderedBytes, 0, Number.MAX_SAFE_INTEGER, code),
    durationMs: integer(input.durationMs, 0, Number.MAX_SAFE_INTEGER, code),
    toolCallCount: 0, conditionLeakageDetected: false
  };
}

export function validateEvaluationExecution(input) {
  const code = 'EVALUATION_EXECUTION_INVALID';
  exact(input, ['frozenCorpus', 'records'], code);
  if (!input.frozenCorpus || !FROZEN_CORPORA.has(input.frozenCorpus)
      || !Array.isArray(input.records) || input.records.length !== 900) fail(code);
  const records = input.records.map((entry) => validateExecution(entry, input.frozenCorpus, code));
  const keys = records.map((entry) => `${entry.caseId}\u0000${entry.condition}`);
  if (new Set(keys).size !== 900 || new Set(records.map((entry) => entry.sessionId)).size !== 900) fail(code);
  for (const caseRecord of input.frozenCorpus.cases) for (const condition of EVALUATION_CONDITIONS) {
    if (!keys.includes(`${caseRecord.caseId}\u0000${condition}`)) fail(code);
  }
  const record = {
    artifactType: 'kstack-evaluation-execution-ledger', schemaVersion: 1,
    corpusDigest: input.frozenCorpus.corpusDigest, records
  };
  const result = immutable({ frozenCorpus: input.frozenCorpus, records, executionLedgerDigest: domainDigest('KSTACK-EVALUATION-EXECUTION-V1', record) });
  EXECUTION_LEDGERS.add(result);
  return result;
}

function validateOutcome(input, caseRecord, execution, code) {
  exact(input, [
    'caseId', 'condition', 'gapResults', 'findings', 'unsupportedCase',
    'duplicateCase', 'findingCount', 'unsupportedFindingCount', 'duplicateFindingCount',
    'evidenceViolationCount', 'authorityViolationCount', 'persistentFailure'
  ], code);
  if (input.caseId !== caseRecord.caseId || input.condition !== execution.condition
      || input.persistentFailure !== (execution.status === 'persistent-failure')) fail(code);
  if (!Array.isArray(input.gapResults) || input.gapResults.length !== caseRecord.goldGaps.length) fail(code);
  const gapResults = input.gapResults.map((entry, index) => {
    exact(entry, ['gapId', 'found'], code);
    if (entry.gapId !== caseRecord.goldGaps[index].gapId) fail(code);
    return { gapId: entry.gapId, found: bool(entry.found, code) };
  });
  if (!Array.isArray(input.findings) || input.findings.length !== execution.findingInventory.length) fail(code);
  const inventoryById = new Map(execution.findingInventory.map((entry) => [entry.findingId, entry]));
  const findings = input.findings.map((entry, index) => {
    exact(entry, [
      'findingId', 'rawFindingDigest', 'material', 'classification', 'severity', 'gapId',
      'novelGapDigest', 'duplicateOfFindingId', 'supportingSourceIds', 'sourceTraceDigest',
      'laneOwnership', 'critical'
    ], code);
    const inventory = inventoryById.get(entry.findingId);
    if (!inventory || entry.findingId !== execution.findingInventory[index].findingId
        || entry.rawFindingDigest !== inventory.rawFindingDigest) fail(code);
    const classification = text(entry.classification, /^(?:gold|novel|unsupported)$/u, code);
    const material = bool(entry.material, code);
    const severity = text(entry.severity, /^(?:critical|high|medium|low|informational)$/u, code);
    const gapId = entry.gapId === null ? null : text(entry.gapId, ID, code);
    const novelGapDigest = entry.novelGapDigest === null ? null : digest(entry.novelGapDigest, code);
    const duplicateOfFindingId = entry.duplicateOfFindingId === null
      ? null : text(entry.duplicateOfFindingId, ID, code);
    const supportingSourceIds = Array.isArray(entry.supportingSourceIds)
      ? entry.supportingSourceIds.map((sourceId) => text(sourceId, ID, code)) : fail(code);
    if (new Set(supportingSourceIds).size !== supportingSourceIds.length
        || supportingSourceIds.some((sourceId, sourceIndex) => sourceIndex > 0
          && compareUtf8(supportingSourceIds[sourceIndex - 1], sourceId) >= 0)) fail(code);
    const sourceTraceDigest = entry.sourceTraceDigest === null ? null : digest(entry.sourceTraceDigest, code);
    const laneOwnership = entry.laneOwnership === null ? null
      : text(entry.laneOwnership, /^(?:base-lane|pack-incremental|shared)$/u, code);
    const critical = bool(entry.critical, code);
    const goldGap = gapId === null ? null : caseRecord.goldGaps.find((gap) => gap.gapId === gapId);
    if (duplicateOfFindingId === entry.findingId
        || (duplicateOfFindingId !== null && !inventoryById.has(duplicateOfFindingId))
        || critical !== (severity === 'critical')
        || (classification === 'gold' && (!goldGap || novelGapDigest !== null
          || laneOwnership !== goldGap.laneOwnership || critical !== goldGap.critical))
        || (classification === 'novel' && (gapId !== null || novelGapDigest === null
          || supportingSourceIds.length === 0 || sourceTraceDigest === null || laneOwnership === null))
        || (classification === 'unsupported' && (gapId !== null || novelGapDigest !== null))
        || (!material && duplicateOfFindingId !== null)) fail(code);
    return {
      findingId: entry.findingId, rawFindingDigest: entry.rawFindingDigest, material, classification,
      severity, gapId, novelGapDigest, duplicateOfFindingId, supportingSourceIds,
      sourceTraceDigest, laneOwnership, critical
    };
  });
  const derivedGapResults = caseRecord.goldGaps.map((gap) => ({
    gapId: gap.gapId,
    found: findings.some((finding) => finding.material && finding.classification === 'gold'
      && finding.gapId === gap.gapId && finding.duplicateOfFindingId === null)
  }));
  if (gapResults.some((entry, index) => entry.found !== derivedGapResults[index].found)) fail(code);
  const unsupportedFindingCount = findings.filter((finding) => finding.material
    && finding.classification === 'unsupported').length;
  const duplicateFindingCount = findings.filter((finding) => finding.material
    && finding.duplicateOfFindingId !== null).length;
  const outcome = {
    caseId: input.caseId, condition: input.condition, gapResults, findings,
    unsupportedCase: bool(input.unsupportedCase, code), duplicateCase: bool(input.duplicateCase, code),
    findingCount: integer(input.findingCount, 0, 10_000, code),
    unsupportedFindingCount: integer(input.unsupportedFindingCount, 0, 10_000, code),
    duplicateFindingCount: integer(input.duplicateFindingCount, 0, 10_000, code),
    evidenceViolationCount: integer(input.evidenceViolationCount, 0, 10_000, code),
    authorityViolationCount: integer(input.authorityViolationCount, 0, 10_000, code),
    persistentFailure: input.persistentFailure
  };
  if (outcome.persistentFailure && (gapResults.some((entry) => entry.found)
      || !outcome.unsupportedCase || !outcome.duplicateCase)) fail(code);
  if (outcome.findingCount !== findings.length
      || outcome.unsupportedFindingCount !== unsupportedFindingCount
      || outcome.duplicateFindingCount !== duplicateFindingCount
      || outcome.unsupportedCase !== (outcome.persistentFailure || unsupportedFindingCount > 0)
      || outcome.duplicateCase !== (outcome.persistentFailure || duplicateFindingCount > 0)) fail(code);
  return outcome;
}

function validateProfile(input, packAuthors, code) {
  exact(input, ['adjudicatorId', 'naturalPerson', 'domainQualified', 'independentFromPackAuthors', 'identityAttestationDigest'], code);
  const adjudicatorId = text(input.adjudicatorId, ID, code);
  if (packAuthors.has(adjudicatorId) || input.naturalPerson !== true || input.domainQualified !== true
      || input.independentFromPackAuthors !== true) fail(code);
  return { adjudicatorId, naturalPerson: true, domainQualified: true, independentFromPackAuthors: true, identityAttestationDigest: digest(input.identityAttestationDigest, code) };
}

export function validateEvaluationAdjudication(input) {
  const code = 'EVALUATION_ADJUDICATION_INVALID';
  exact(input, ['executionLedger', 'adjudicatorProfiles', 'decisions', 'reconciliations', 'unblindingMapDigest'], code);
  if (!input.executionLedger || !EXECUTION_LEDGERS.has(input.executionLedger)
      || !Array.isArray(input.adjudicatorProfiles) || input.adjudicatorProfiles.length !== 2
      || !Array.isArray(input.decisions) || input.decisions.length !== 1_800
      || !Array.isArray(input.reconciliations)) fail(code);
  const packAuthors = new Set(input.executionLedger.frozenCorpus.plan.candidatePackAuthorIds);
  const profiles = input.adjudicatorProfiles.map((entry) => validateProfile(entry, packAuthors, code));
  if (profiles[0].adjudicatorId === profiles[1].adjudicatorId) fail(code);
  const profileIds = new Set(profiles.map((entry) => entry.adjudicatorId));
  const decisions = input.decisions.map((decision) => {
    exact(decision, ['caseId', 'condition', 'adjudicatorId', 'outcome', 'mappingDigest', 'signatureDigest', 'blinded'], code);
    if (!profileIds.has(decision.adjudicatorId) || decision.blinded !== true) fail(code);
    const execution = input.executionLedger.records.find((entry) => entry.caseId === decision.caseId && entry.condition === decision.condition);
    const caseRecord = input.executionLedger.frozenCorpus.cases.find((entry) => entry.caseId === decision.caseId);
    if (!execution || !caseRecord) fail(code);
    const outcome = validateOutcome(decision.outcome, caseRecord, execution, code);
    const mappingDigest = domainDigest('KSTACK-EVALUATION-ADJUDICATED-MAPPING-V1', outcome);
    if (decision.mappingDigest !== mappingDigest) fail(code);
    return { caseId: decision.caseId, condition: decision.condition, adjudicatorId: decision.adjudicatorId,
      outcome, mappingDigest, signatureDigest: digest(decision.signatureDigest, code), blinded: true };
  });
  const decisionKeys = decisions.map((entry) => `${entry.caseId}\u0000${entry.condition}\u0000${entry.adjudicatorId}`);
  if (new Set(decisionKeys).size !== 1_800) fail(code);
  const reconciliationMap = new Map(input.reconciliations.map((entry) => {
    exact(entry, ['caseId', 'condition', 'finalOutcome', 'finalMappingDigest', 'adjudicatorSignatures', 'blinded'], code);
    const execution = input.executionLedger.records.find((record) => record.caseId === entry.caseId && record.condition === entry.condition);
    const caseRecord = input.executionLedger.frozenCorpus.cases.find((record) => record.caseId === entry.caseId);
    if (!execution || !caseRecord || entry.blinded !== true || !Array.isArray(entry.adjudicatorSignatures)) fail(code);
    const finalOutcome = validateOutcome(entry.finalOutcome, caseRecord, execution, code);
    const finalMappingDigest = domainDigest('KSTACK-EVALUATION-ADJUDICATED-MAPPING-V1', finalOutcome);
    if (entry.finalMappingDigest !== finalMappingDigest || entry.adjudicatorSignatures.length !== 2) fail(code);
    const ids = entry.adjudicatorSignatures.map((signature) => {
      exact(signature, ['adjudicatorId', 'signatureDigest'], code);
      digest(signature.signatureDigest, code);
      return signature.adjudicatorId;
    });
    if (new Set(ids).size !== 2 || ids.some((id) => !profileIds.has(id))) fail(code);
    return [`${entry.caseId}\u0000${entry.condition}`, { finalOutcome, finalMappingDigest }];
  }));
  if (reconciliationMap.size !== input.reconciliations.length) fail(code);
  let agreements = 0;
  let comparisons = 0;
  const leftMarginals = new Map();
  const rightMarginals = new Map();
  const outcomes = [];
  for (const execution of input.executionLedger.records) {
    const pair = profiles.map((profile) => decisions.find((entry) => entry.caseId === execution.caseId
      && entry.condition === execution.condition && entry.adjudicatorId === profile.adjudicatorId));
    if (pair.some((entry) => !entry)) fail(code);
    const left = pair[0].outcome.findings;
    const right = pair[1].outcome.findings;
    if (left.length !== right.length) fail(code);
    for (let index = 0; index < left.length; index += 1) {
      if (left[index].findingId !== right[index].findingId
          || left[index].rawFindingDigest !== right[index].rawFindingDigest) fail(code);
      const leftLabel = `${left[index].material ? 'material' : 'non-material'}:${left[index].classification}:${left[index].duplicateOfFindingId === null ? 'original' : 'duplicate'}`;
      const rightLabel = `${right[index].material ? 'material' : 'non-material'}:${right[index].classification}:${right[index].duplicateOfFindingId === null ? 'original' : 'duplicate'}`;
      comparisons += 1;
      if (leftLabel === rightLabel) agreements += 1;
      leftMarginals.set(leftLabel, (leftMarginals.get(leftLabel) ?? 0) + 1);
      rightMarginals.set(rightLabel, (rightMarginals.get(rightLabel) ?? 0) + 1);
    }
    const key = `${execution.caseId}\u0000${execution.condition}`;
    if (pair[0].mappingDigest === pair[1].mappingDigest) {
      if (reconciliationMap.has(key)) fail(code);
      outcomes.push(pair[0].outcome);
    } else {
      const reconciliation = reconciliationMap.get(key);
      if (!reconciliation) fail('EVALUATION_GRIDLOCK');
      outcomes.push(reconciliation.finalOutcome);
    }
  }
  if (reconciliationMap.size !== decisions.filter((entry, index) => index % 2 === 0).length
      && [...reconciliationMap.keys()].some((key) => {
        const pair = decisions.filter((entry) => `${entry.caseId}\u0000${entry.condition}` === key);
        return pair.length !== 2 || pair[0].mappingDigest === pair[1].mappingDigest;
      })) fail(code);
  const agreement = comparisons === 0 ? 1 : agreements / comparisons;
  const observed = agreement;
  const labels = new Set([...leftMarginals.keys(), ...rightMarginals.keys()]);
  const expected = comparisons === 0 ? 1 : [...labels].reduce((sum, label) => sum
    + ((leftMarginals.get(label) ?? 0) / comparisons) * ((rightMarginals.get(label) ?? 0) / comparisons), 0);
  const kappa = expected === 1 ? 1 : (observed - expected) / (1 - expected);
  if (agreement < 0.90 || kappa < 0.80) fail('ADJUDICATION_UNRELIABLE');
  const result = immutable({
    executionLedger: input.executionLedger, profiles, decisions, outcomes,
    agreement, kappa, unblindingMapDigest: digest(input.unblindingMapDigest, code),
    adjudicationDigest: domainDigest('KSTACK-EVALUATION-ADJUDICATION-V1', {
      executionLedgerDigest: input.executionLedger.executionLedgerDigest,
      profiles, decisions, reconciliations: input.reconciliations, unblindingMapDigest: input.unblindingMapDigest
    })
  });
  ADJUDICATIONS.add(result);
  return result;
}

function logGamma(z) {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.984369578019571e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  let x = 0.9999999999998099;
  const shifted = z - 1;
  for (let index = 0; index < coefficients.length; index += 1) x += coefficients[index] / (shifted + index + 1);
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaFraction(a, b, x) {
  const max = 200;
  const epsilon = 3e-14;
  const tiny = 1e-300;
  const qab = a + b; const qap = a + 1; const qam = a - 1;
  let c = 1; let d = 1 - qab * x / qap; if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d; let h = d;
  for (let m = 1; m <= max; m += 1) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? factor * betaFraction(a, b, x) / a
    : 1 - factor * betaFraction(b, a, 1 - x) / b;
}

export function clopperPearsonUpper(events, trials, alpha = 0.05) {
  integer(events, 0, trials, 'EVALUATION_STATISTIC_INVALID');
  integer(trials, 1, Number.MAX_SAFE_INTEGER, 'EVALUATION_STATISTIC_INVALID');
  if (!(alpha > 0 && alpha < 1)) fail('EVALUATION_STATISTIC_INVALID');
  if (events === trials) return 1;
  if (events === 0) return 1 - alpha ** (1 / trials);
  let low = 0; let high = 1;
  for (let index = 0; index < 100; index += 1) {
    const mid = (low + high) / 2;
    if (regularizedBeta(mid, events + 1, trials - events) < 1 - alpha) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function seededRandom(seedDigest) {
  let counter = 0;
  let pool = Buffer.alloc(0); let offset = 0;
  return () => {
    if (offset + 4 > pool.length) {
      const counterBytes = Buffer.alloc(8); counterBytes.writeBigUInt64BE(BigInt(counter)); counter += 1;
      pool = crypto.createHash('sha256').update(Buffer.from(seedDigest, 'hex')).update(counterBytes).digest(); offset = 0;
    }
    const value = pool.readUInt32BE(offset); offset += 4;
    return value / 0x1_0000_0000;
  };
}

function stratifiedBootstrap(rows, fields, seedDigest, strata) {
  const groups = strata.map((stratum) => rows.filter((entry) => entry.stratum === stratum));
  if (groups.some((group) => group.length !== 60)) fail('EVALUATION_STATISTIC_INVALID');
  const random = seededRandom(seedDigest);
  const distributions = Object.fromEntries(fields.map((field) => [field, new Float64Array(RESAMPLES)]));
  for (let sample = 0; sample < RESAMPLES; sample += 1) {
    const sums = Object.fromEntries(fields.map((field) => [field, 0]));
    for (const group of groups) for (let draw = 0; draw < group.length; draw += 1) {
      const row = group[Math.floor(random() * group.length)];
      for (const field of fields) sums[field] += row[field];
    }
    for (const field of fields) distributions[field][sample] = sums[field] / 300;
  }
  const result = {};
  for (const field of fields) {
    const sorted = Array.from(distributions[field]).sort((a, b) => a - b);
    result[field] = { lower95: sorted[Math.floor(0.05 * RESAMPLES)], upper95: sorted[Math.ceil(0.95 * RESAMPLES) - 1], samples: sorted };
  }
  return result;
}

export function analyzeEvaluation(input) {
  const code = 'EVALUATION_ANALYSIS_INVALID';
  exact(input, ['adjudication', 'bootstrapSeedDigest', 'd4d10Validation', 'd6Validation'], code);
  if (!input.adjudication || !ADJUDICATIONS.has(input.adjudication)) fail(code);
  digest(input.bootstrapSeedDigest, code);
  exact(input.d4d10Validation, ['receiptDigest', 'evidenceViolationCount', 'authorityViolationCount', 'adversarialViolationCount'], code);
  exact(input.d6Validation, ['receiptDigest', 'packUtf8Bytes', 'contextAdmitted'], code);
  digest(input.d4d10Validation.receiptDigest, code); digest(input.d6Validation.receiptDigest, code);
  const outcomes = input.adjudication.outcomes;
  const corpus = input.adjudication.executionLedger.frozenCorpus;
  const executionByKey = new Map(input.adjudication.executionLedger.records.map((entry) => [`${entry.caseId}\u0000${entry.condition}`, entry]));
  const rows = corpus.cases.map((caseRecord) => {
    const byCondition = Object.fromEntries(EVALUATION_CONDITIONS.map((condition) => [condition,
      outcomes.find((entry) => entry.caseId === caseRecord.caseId && entry.condition === condition)]));
    if (Object.values(byCondition).some((entry) => !entry)) fail(code);
    const total = caseRecord.goldGaps.length;
    const baseIndexes = caseRecord.goldGaps.map((gap, index) => gap.laneOwnership !== 'pack-incremental' ? index : -1).filter((index) => index >= 0);
    const recall = (condition) => byCondition[condition].gapResults.filter((entry) => entry.found).length / total;
    const baseRecall = (condition) => baseIndexes.length === 0 ? 1
      : baseIndexes.filter((index) => byCondition[condition].gapResults[index].found).length / baseIndexes.length;
    const criticalLoss = caseRecord.goldGaps.some((gap, index) => gap.critical
      && byCondition.A.gapResults[index].found && !byCondition.C.gapResults[index].found);
    const executionA = executionByKey.get(`${caseRecord.caseId}\u0000A`);
    const executionC = executionByKey.get(`${caseRecord.caseId}\u0000C`);
    const durationRatio = byCondition.A.persistentFailure || byCondition.C.persistentFailure || executionA.durationMs === 0
      ? Number.POSITIVE_INFINITY : executionC.durationMs / executionA.durationMs;
    return {
      stratum: caseRecord.criticalStratum, caRecall: recall('C') - recall('A'),
      cbRecall: recall('C') - recall('B'), caBaseRecall: baseRecall('C') - baseRecall('A'),
      durationRatio, criticalLoss, unsupportedCase: byCondition.C.unsupportedCase,
      duplicateCase: byCondition.C.duplicateCase,
      evidenceViolations: byCondition.C.evidenceViolationCount,
      authorityViolations: byCondition.C.authorityViolationCount
    };
  });
  if (rows.some((row) => !Number.isFinite(row.durationRatio))) fail(code);
  const strata = corpus.profile?.criticalStrata ?? EVALUATION_STRATA;
  const bootstrap = stratifiedBootstrap(
    rows, ['caRecall', 'cbRecall', 'caBaseRecall', 'durationRatio'],
    input.bootstrapSeedDigest, strata
  );
  const hypotheses = [
    { id: 'c-a-material-recall', bound: bootstrap.caRecall.lower95, boundary: 0.05 },
    { id: 'c-a-base-recall', bound: bootstrap.caBaseRecall.lower95, boundary: -0.02 },
    { id: 'c-b-material-recall', bound: bootstrap.cbRecall.lower95, boundary: 0.02 }
  ].map((entry) => ({ ...entry, pValue: bootstrap[entry.id === 'c-a-material-recall' ? 'caRecall' : entry.id === 'c-a-base-recall' ? 'caBaseRecall' : 'cbRecall'].samples
    .filter((value) => value <= entry.boundary).length / RESAMPLES }));
  const ordered = [...hypotheses].sort((a, b) => a.pValue - b.pValue || compareUtf8(a.id, b.id));
  let holmOpen = true;
  ordered.forEach((entry, index) => {
    entry.holmThreshold = 0.05 / (3 - index);
    entry.holmPass = holmOpen && entry.pValue <= entry.holmThreshold;
    if (!entry.holmPass) holmOpen = false;
  });
  const byId = new Map(ordered.map((entry) => [entry.id, entry]));
  const unsupportedEvents = rows.filter((row) => row.unsupportedCase).length;
  const duplicateEvents = rows.filter((row) => row.duplicateCase).length;
  const unsupportedUpper = clopperPearsonUpper(unsupportedEvents, 300);
  const duplicateUpper = clopperPearsonUpper(duplicateEvents, 300);
  const gates = {
    caRecall: bootstrap.caRecall.lower95 > 0.05 && byId.get('c-a-material-recall').holmPass,
    caBaseRecall: bootstrap.caBaseRecall.lower95 > -0.02 && byId.get('c-a-base-recall').holmPass
      && rows.every((row) => !row.criticalLoss),
    cbRecall: bootstrap.cbRecall.lower95 > 0.02 && byId.get('c-b-material-recall').holmPass,
    safety: unsupportedUpper <= 0.03 && duplicateUpper <= 0.10,
    validation: input.d4d10Validation.evidenceViolationCount === 0
      && input.d4d10Validation.authorityViolationCount === 0
      && input.d4d10Validation.adversarialViolationCount === 0
      && rows.every((row) => row.evidenceViolations === 0 && row.authorityViolations === 0),
    budgetAndDuration: input.d6Validation.packUtf8Bytes <= 16_384
      && input.d6Validation.contextAdmitted === true && bootstrap.durationRatio.upper95 <= 1.25
  };
  const disposition = Object.values(gates).every(Boolean) ? 'qualified-not-activated'
    : gates.cbRecall ? 'blocked' : 'select-strengthened-wording';
  const record = immutable({
    artifactType: 'kstack-evaluation-analysis', schemaVersion: 1,
    adjudicationDigest: input.adjudication.adjudicationDigest,
    bootstrapSeedDigest: input.bootstrapSeedDigest, resamples: RESAMPLES,
    bounds: {
      caRecallLower95: bootstrap.caRecall.lower95, caBaseRecallLower95: bootstrap.caBaseRecall.lower95,
      cbRecallLower95: bootstrap.cbRecall.lower95, durationRatioUpper95: bootstrap.durationRatio.upper95,
      unsupportedUpper95: unsupportedUpper, duplicateUpper95: duplicateUpper
    },
    hypotheses: ordered.map(({ samples, ...entry }) => entry), gates, disposition
  });
  return immutable({ record, analysisDigest: domainDigest('KSTACK-EVALUATION-ANALYSIS-V1', record), qualified: disposition === 'qualified-not-activated' });
}
