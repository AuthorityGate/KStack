#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitize } from './kstack-provider-runner.mjs';
import { parseKStackConfigDocument } from './secret-broker/config-document-v2.mjs';
import { projectSecretBrokerConfig } from './secret-broker/config-v2.mjs';

export const defaultConfig = {
  schemaVersion: 1,
  project: {
    name: "",
    roots: ["."]
  },
  workflow: {
    objectiveDepth: "deep",
    reviewScope: "full",
    designLanes: ["product", "ux", "architecture", "data", "security", "operations"],
    implementationTransition: "after-design-approval",
    materialDecisionRule: "A decision is material when reversing it would change public behavior, architecture, stored data, security, operations, cost, or more than one implementation unit.",
    planningLensTrial: {
      enabled: false,
      objectives: {}
    },
    contextReduction: {
      measurementEnabled: false,
      eagerInstructionsEnabled: false,
      slicingEnabled: false,
      qualificationEvidenceSha256: null,
      qualificationRouteId: null,
      qualificationProfileId: null
    },
    panel: {
      enabled: false,
      releaseStage: "local",
      capacityProfile: "shipped",
      projectPersonaDirectory: ".kstack/personas",
      stateDirectory: ".kstack/panels",
      paidShadowEnabled: false,
      productionEnabled: false,
      maxRunUsdMicros: 0,
      maxEvaluationUsdMicros: 0,
      spendConfirmation: "per-run",
      minimumProductionProviderFamilies: 2,
      productionPolicyDecisionDigest: null,
      singleFamilyOwnerDecisionDigest: null,
      capacityPolicyDecisionDigest: null,
      panels: {}
    },
    designGate: {
      minimumConfidence: 93,
      minimumConfidenceRound11Plus: 81,
      minimumConfidenceSkillClass: 70,
      citationGrounding: "off",
      reviewSequence: {
        mode: "primary-then-independent-final",
        primaryReadinessConfidence: 93,
        finalAcceptanceConfidence: 81
      },
      secondaryReview: {
        mode: "triggered",
        primaryReadinessConfidence: 93,
        finalAcceptanceConfidence: 81,
        requireFinalReview: true,
        requireDifferentAgent: true,
        requireDifferentProviderFamilyForHighRisk: true,
        auditSamplePermille: 0,
        materialDesignRiskClass: "high"
      },
      reviewBudget: {
        maxRounds: 42,
        maxElapsedMinutes: 120,
        onExhausted: "user-decision"
      },
      requiredReviewers: ["codex", "opus"],
      requiredChecks: [
        "objectives-complete",
        "design-schema-valid",
        "threat-model-complete",
        "rollback-defined",
        "verification-plan-complete",
        "artifact-secret-scan"
      ],
      requireZeroSecurityFindings: true,
      requireZeroMaterialDissent: true
    },
    phaseModels: {
      init: ["active"],
      objectives: ["active"],
      review: ["active"],
      design: ["codex", "opus"],
      implement: ["codex"],
      interrogate: ["opus"],
      qc: ["opus"],
      interrogationGate: {
        minimumConfidence: 93,
        maxRedesignRounds: 2
      },
      qcGate: {
        minimumConfidence: 95,
        maxFixRounds: 3,
        requireDualForHighRisk: true
      }
    }
  },
  models: {
    mode: "preferred",
    onUnavailable: "ask",
    codex: {
      command: "codex",
      args: [],
      model: null,
      reasoningEffort: "high",
      timeoutSeconds: 600
    },
    opus: {
      command: "claude",
      args: [],
      model: "opus",
      effort: "high",
      timeoutSeconds: 600
    },
    fable: {
      command: "claude",
      args: [],
      model: "fable",
      effort: "high",
      timeoutSeconds: 600
    }
  },
  authority: {
    inspect: "allow",
    edit: "ask",
    test: "allow",
    commit: "ask",
    push: "ask",
    pullRequest: "ask",
    merge: "ask",
    deploy: "deny",
    deviceInstall: "ask",
    destructive: "ask",
    externalTicketCreation: "ask",
    jiraAdministration: "ask"
  },
  jira: {
    enabled: false,
    siteUrl: null,
    apiBaseUrl: null,
    deliveryRecordPath: null,
    projects: [
      { key: "KSTK", issueTypes: ["Task"], defaultFields: {} }
    ],
    credentialSource: {
      type: "env",
      emailEnvVar: "JIRA_EMAIL",
      tokenEnvVar: "JIRA_API_TOKEN"
    },
    staticLabels: [],
    timeoutMs: 15000,
    maxAttempts: 3,
    approvalTtlMs: 86400000,
    dryRun: false,
    nodeMinVersion: "20.0.0",
    tracking: {
      mode: "off",
      required: false,
      repositoryNamespace: null,
      projectKey: null,
      automaticVersionAssignment: false,
      releaseVersions: []
    }
  },
  persistence: {
    scope: "project",
    crossSession: false,
    retainRawModelOutput: true,
    redactSecrets: true
  },
  memory: {
    enabled: false,
    retrieval: "explicit",
    contextInjection: "disabled",
    engine: "pglite",
    bodyDirectory: null,
    indexDirectory: null,
    remote: null,
    namespace: "",
    trust: "read-write",
    sync: "manual",
    resultLimit: 8,
    tokenBudget: 2000,
    authority: {
      createRepository: "ask",
      clone: "ask",
      fetch: "ask",
      integrate: "ask",
      commit: "ask",
      push: "ask",
      resolveConflicts: "ask"
    }
  },
  verification: {
    discoverRepositoryCommands: true,
    verifyToolchainRuntimeSeparatelyFromTargetCompatibility: true,
    requireArtifactIdentity: true,
    preserveUserData: true
  }
};

const allowed = {
  objectiveDepth: new Set(["focused", "deep", "exhaustive"]),
  reviewScope: new Set(["change", "repository", "environment", "full"]),
  implementationTransition: new Set(["plan-only", "ask", "after-design-approval"]),
  phaseRole: new Set(["active", "codex", "opus", "fable"]),
  modelMode: new Set(["off", "preferred", "required"]),
  onUnavailable: new Set(["continue", "ask", "stop"]),
  authority: new Set(["allow", "ask", "deny"]),
  persistenceScope: new Set(["none", "project", "user"]),
  memoryRetrieval: new Set(["explicit"]),
  memoryContextInjection: new Set(["disabled"]),
  memoryEngine: new Set(["pglite"]),
  memoryTrust: new Set(["read-write", "read-only", "deny"]),
  memorySync: new Set(["manual"]),
  jiraTrackingMode: new Set(["off", "approval-queued", "automatic"])
};

const planningLensIds = new Set(['strategy', 'developer-experience', 'strengthened-product-ux']);

const contextReductionKeys = new Set([
  'measurementEnabled', 'eagerInstructionsEnabled', 'slicingEnabled',
  'qualificationEvidenceSha256', 'qualificationRouteId',
  'qualificationProfileId'
]);
const designReviewSequenceKeys = new Set([
  'mode', 'primaryReadinessConfidence', 'finalAcceptanceConfidence'
]);
const secondaryReviewKeys = new Set([
  'mode', 'primaryReadinessConfidence', 'finalAcceptanceConfidence',
  'requireFinalReview', 'requireDifferentAgent',
  'requireDifferentProviderFamilyForHighRisk', 'auditSamplePermille',
  'materialDesignRiskClass'
]);

// The frozen security chain qualifies zero runtime routes/profiles. Keep this
// registry closed until a separately reviewed qualification adds an exact pair.
const qualifiedContextReductionRouteProfiles = new Set();

function validateContextReductionConfig(reduction, errors) {
  const need = (condition, message) => { if (!condition) errors.push(message); };
  need(reduction && typeof reduction === 'object' && !Array.isArray(reduction), 'workflow.contextReduction must be an object');
  if (!reduction || typeof reduction !== 'object' || Array.isArray(reduction)) return;
  unknownKeys(reduction, contextReductionKeys, 'workflow.contextReduction', errors);

  for (const key of ['measurementEnabled', 'eagerInstructionsEnabled', 'slicingEnabled']) {
    need(typeof reduction[key] === 'boolean', `workflow.contextReduction.${key} must be boolean`);
  }
  need(
    reduction.qualificationEvidenceSha256 === null
      || (typeof reduction.qualificationEvidenceSha256 === 'string'
        && /^[0-9a-f]{64}$/.test(reduction.qualificationEvidenceSha256)),
    'workflow.contextReduction.qualificationEvidenceSha256 must be null or lowercase 64-hex'
  );
  for (const key of ['qualificationRouteId', 'qualificationProfileId']) {
    need(
      reduction[key] === null || (typeof reduction[key] === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(reduction[key])),
      `workflow.contextReduction.${key} must be null or a lower-case hyphen-case ID`
    );
  }

  const qualificationKeys = [
    'qualificationEvidenceSha256',
    'qualificationRouteId',
    'qualificationProfileId'
  ];
  const qualificationAllNull = qualificationKeys.every((key) => Object.hasOwn(reduction, key) && reduction[key] === null);
  const qualificationAllPresent = qualificationKeys.every((key) => Object.hasOwn(reduction, key) && reduction[key] !== null && reduction[key] !== undefined);
  need(
    qualificationAllNull || qualificationAllPresent,
    'workflow.contextReduction qualificationEvidenceSha256, qualificationRouteId, and qualificationProfileId must be all null or all configured'
  );

  const featureRequested = reduction.eagerInstructionsEnabled === true || reduction.slicingEnabled === true;
  const evidenceConfigured = typeof reduction.qualificationEvidenceSha256 === 'string'
    && /^[0-9a-f]{64}$/.test(reduction.qualificationEvidenceSha256);
  const pair = `${reduction.qualificationRouteId ?? ''}:${reduction.qualificationProfileId ?? ''}`;
  const routeProfileQualified = qualificationAllPresent && qualifiedContextReductionRouteProfiles.has(pair);
  if (featureRequested) {
    need(evidenceConfigured, 'workflow.contextReduction eager instructions or slicing requires qualificationEvidenceSha256');
    need(routeProfileQualified, 'workflow.contextReduction eager instructions or slicing requires a supported qualified route/profile; none are qualified in this build');
  } else if (qualificationAllPresent) {
    need(routeProfileQualified, 'workflow.contextReduction qualificationRouteId/qualificationProfileId is not a supported qualified pair');
  }
}

const panelKeys = new Set([
  'enabled', 'releaseStage', 'capacityProfile',
  'projectPersonaDirectory', 'stateDirectory', 'paidShadowEnabled',
  'productionEnabled', 'maxRunUsdMicros', 'maxEvaluationUsdMicros',
  'spendConfirmation', 'minimumProductionProviderFamilies',
  'productionPolicyDecisionDigest', 'singleFamilyOwnerDecisionDigest',
  'capacityPolicyDecisionDigest', 'panels'
]);
const panelDefinitionKeys = new Set([
  'threshold', 'adapter', 'dataClass', 'externalAuthor', 'requiredVoters',
  'advisers'
]);
const panelSlotKeys = new Set(['slotId', 'personaId', 'backendId', 'providerFamily']);
const panelIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const panelReservedIds = new Set(['con', 'prn', 'aux', 'nul', 'clock$', 'fable', 'fable-mediator']);

function validPanelId(value) {
  return typeof value === 'string' && Buffer.byteLength(value, 'ascii') <= 63
    && panelIdPattern.test(value) && !panelReservedIds.has(value.toLowerCase())
    && !/^(?:com|lpt)[1-9]$/i.test(value);
}

function validProjectRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0 || path.isAbsolute(value) || value.includes('\\')) return false;
  const normalized = path.posix.normalize(value);
  return normalized === value && normalized !== '.' && !normalized.startsWith('../')
    && !value.split('/').some((part) => part === '' || part === '.' || part === '..');
}

function validatePanelConfig(panel, errors) {
  const need = (condition, message) => { if (!condition) errors.push(message); };
  need(panel && typeof panel === 'object' && !Array.isArray(panel), 'workflow.panel must be an object');
  if (!panel || typeof panel !== 'object' || Array.isArray(panel)) return;
  unknownKeys(panel, panelKeys, 'workflow.panel', errors);
  need(typeof panel.enabled === 'boolean', 'workflow.panel.enabled must be boolean');
  need(['local', 'shadow', 'production'].includes(panel.releaseStage), 'workflow.panel.releaseStage must be local, shadow, or production');
  need(['shipped', 'hard'].includes(panel.capacityProfile), 'workflow.panel.capacityProfile must be shipped or hard');
  const pathKeys = ['projectPersonaDirectory', 'stateDirectory'];
  for (const key of pathKeys) need(validProjectRelativePath(panel[key]), `workflow.panel.${key} must be a normalized contained project-relative path`);
  if (pathKeys.every((key) => validProjectRelativePath(panel[key]))) {
    need(new Set(pathKeys.map((key) => panel[key].toLowerCase())).size === pathKeys.length, 'workflow.panel paths must not alias');
  }
  need(typeof panel.paidShadowEnabled === 'boolean', 'workflow.panel.paidShadowEnabled must be boolean');
  need(typeof panel.productionEnabled === 'boolean', 'workflow.panel.productionEnabled must be boolean');
  for (const key of ['maxRunUsdMicros', 'maxEvaluationUsdMicros']) {
    need(Number.isSafeInteger(panel[key]) && panel[key] >= 0, `workflow.panel.${key} must be a non-negative safe integer`);
  }
  need(['per-run', 'per-attempt'].includes(panel.spendConfirmation), 'workflow.panel.spendConfirmation must be per-run or per-attempt');
  need(panel.minimumProductionProviderFamilies === 1 || panel.minimumProductionProviderFamilies === 2, 'workflow.panel.minimumProductionProviderFamilies must be 1 or 2');
  for (const key of ['productionPolicyDecisionDigest', 'singleFamilyOwnerDecisionDigest', 'capacityPolicyDecisionDigest']) {
    need(panel[key] === null || (typeof panel[key] === 'string' && /^[a-f0-9]{64}$/.test(panel[key])), `workflow.panel.${key} must be null or a lowercase SHA-256 digest`);
  }
  if (panel.paidShadowEnabled) {
    need(panel.releaseStage === 'shadow', 'workflow.panel.paidShadowEnabled requires releaseStage shadow');
    need(panel.maxRunUsdMicros > 0, 'workflow.panel.paidShadowEnabled requires a positive maxRunUsdMicros');
  }
  if (panel.productionEnabled) {
    need(panel.releaseStage === 'production', 'workflow.panel.productionEnabled requires releaseStage production');
    need(panel.maxRunUsdMicros > 0, 'workflow.panel.productionEnabled requires a positive maxRunUsdMicros');
    need(typeof panel.productionPolicyDecisionDigest === 'string', 'workflow.panel.productionEnabled requires productionPolicyDecisionDigest');
  }
  if (panel.minimumProductionProviderFamilies === 1) {
    need(typeof panel.singleFamilyOwnerDecisionDigest === 'string', 'workflow.panel.minimumProductionProviderFamilies 1 requires singleFamilyOwnerDecisionDigest');
  }
  if (panel.capacityProfile === 'hard') {
    need(typeof panel.capacityPolicyDecisionDigest === 'string', 'workflow.panel.capacityProfile hard requires capacityPolicyDecisionDigest');
  }
  need(panel.panels && typeof panel.panels === 'object' && !Array.isArray(panel.panels), 'workflow.panel.panels must be an object');
  if (!panel.panels || typeof panel.panels !== 'object' || Array.isArray(panel.panels)) return;
  const profileLimits = panel.capacityProfile === 'hard'
    ? { voters: [2, 16], advisers: [0, 8] }
    : { voters: [2, 4], advisers: [0, 2] };
  for (const [panelId, definition] of Object.entries(panel.panels)) {
    const prefix = `workflow.panel.panels.${panelId}`;
    need(validPanelId(panelId), `${prefix} uses an invalid or reserved panel ID`);
    need(definition && typeof definition === 'object' && !Array.isArray(definition), `${prefix} must be an object`);
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) continue;
    unknownKeys(definition, panelDefinitionKeys, prefix, errors);
    need(Number.isInteger(definition.threshold) && definition.threshold >= 1 && definition.threshold <= 100, `${prefix}.threshold must be an integer from 1 to 100`);
    need(['document-v1', 'plan-v1', 'code-review-v1', 'opaque-review-v1'].includes(definition.adapter), `${prefix}.adapter is invalid`);
    need(['public', 'internal', 'confidential', 'restricted'].includes(definition.dataClass), `${prefix}.dataClass is invalid`);
    need(typeof definition.externalAuthor === 'string' && definition.externalAuthor.length > 0 && definition.externalAuthor.length <= 256, `${prefix}.externalAuthor must be a non-empty string of at most 256 characters`);
    const allSlots = [];
    for (const [key, [minimum, maximum]] of Object.entries({ requiredVoters: profileLimits.voters, advisers: profileLimits.advisers })) {
      const slots = definition[key];
      need(Array.isArray(slots) && slots.length >= minimum && slots.length <= maximum, `${prefix}.${key} must contain ${minimum}-${maximum} slots for the selected profile`);
      if (!Array.isArray(slots)) continue;
      slots.forEach((slot, index) => {
        const slotPrefix = `${prefix}.${key}[${index}]`;
        need(slot && typeof slot === 'object' && !Array.isArray(slot), `${slotPrefix} must be an object`);
        if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return;
        unknownKeys(slot, panelSlotKeys, slotPrefix, errors);
        for (const field of ['slotId', 'personaId', 'backendId', 'providerFamily']) need(validPanelId(slot[field]), `${slotPrefix}.${field} is invalid or reserved`);
        need(slot.backendId !== 'fable', `${slotPrefix}.backendId cannot be fable; Fable is mediator-only`);
        const expectedProviderFamily = slot.backendId === 'codex' ? 'openai' : 'anthropic';
        need(slot.providerFamily === expectedProviderFamily, `${slotPrefix}.providerFamily must be ${expectedProviderFamily} for backend ${slot.backendId}`);
        allSlots.push(slot.slotId);
      });
    }
    need(new Set(allSlots).size === allSlots.length, `${prefix} slot IDs must be unique across voters and advisers`);
  }
  if (panel.enabled) need(Object.keys(panel.panels).length > 0, 'workflow.panel.enabled requires at least one panel definition');
}

export function validateConfig(config, options = {}) {
  const errors = [];
  const need = (condition, message) => { if (!condition) errors.push(message); };

  need(config && typeof config === 'object' && !Array.isArray(config), 'config must be an object');
  if (!config || typeof config !== 'object') return errors;
  need(config.schemaVersion === 1 || config.schemaVersion === 2, 'schemaVersion must be 1 or 2');
  try { projectSecretBrokerConfig(config); } catch (error) { need(false, error.code ?? 'secretBroker configuration is invalid'); }
  need(typeof config.project?.name === 'string', 'project.name must be a string');
  need(Array.isArray(config.project?.roots) && config.project.roots.length > 0, 'project.roots must be a non-empty array');
  need(allowed.objectiveDepth.has(config.workflow?.objectiveDepth), 'workflow.objectiveDepth is invalid');
  need(allowed.reviewScope.has(config.workflow?.reviewScope), 'workflow.reviewScope is invalid');
  need(Array.isArray(config.workflow?.designLanes) && config.workflow.designLanes.length > 0, 'workflow.designLanes must be a non-empty array');
  need(allowed.implementationTransition.has(config.workflow?.implementationTransition), 'workflow.implementationTransition is invalid');
  need(typeof config.workflow?.materialDecisionRule === 'string' && config.workflow.materialDecisionRule.length > 0, 'workflow.materialDecisionRule is required');
  if (config.workflow?.planningLensTrial !== undefined) {
    const trial = config.workflow.planningLensTrial;
    need(trial && typeof trial === 'object' && !Array.isArray(trial), 'workflow.planningLensTrial must be an object');
    need(typeof trial?.enabled === 'boolean', 'workflow.planningLensTrial.enabled must be boolean');
    need(trial?.objectives && typeof trial.objectives === 'object' && !Array.isArray(trial.objectives), 'workflow.planningLensTrial.objectives must be an object');
    if (trial?.objectives && typeof trial.objectives === 'object' && !Array.isArray(trial.objectives)) {
      for (const [objectiveId, lenses] of Object.entries(trial.objectives)) {
        need(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(objectiveId), 'workflow.planningLensTrial objective IDs must be 1-128 safe characters');
        need(Array.isArray(lenses) && lenses.length > 0 && new Set(lenses).size === lenses.length && lenses.every((lens) => planningLensIds.has(lens)), `workflow.planningLensTrial.objectives.${objectiveId} must contain unique closed-catalog lens IDs`);
      }
    }
  }
  if (config.workflow?.contextReduction !== undefined) {
    validateContextReductionConfig(config.workflow.contextReduction, errors);
  }
  if (config.workflow?.panel !== undefined) validatePanelConfig(config.workflow.panel, errors);
  if (config.workflow?.designGate !== undefined) {
    const gate = config.workflow.designGate;
    need((gate?.reviewSequence === undefined) === (gate?.secondaryReview === undefined),
      'workflow.designGate reviewSequence and secondaryReview must be provided together or both omitted');
    need(Number.isInteger(gate?.minimumConfidence) && gate.minimumConfidence >= 90 && gate.minimumConfidence <= 100, 'workflow.designGate.minimumConfidence must be an integer from 90 to 100');
    need(gate?.minimumConfidenceRound11Plus === undefined || (Number.isInteger(gate.minimumConfidenceRound11Plus) && gate.minimumConfidenceRound11Plus >= 81 && gate.minimumConfidenceRound11Plus <= 100), 'workflow.designGate.minimumConfidenceRound11Plus must be an integer from 81 to 100');
    need(gate?.minimumConfidenceSkillClass === undefined || (Number.isInteger(gate.minimumConfidenceSkillClass) && gate.minimumConfidenceSkillClass >= 70 && gate.minimumConfidenceSkillClass <= 100), 'workflow.designGate.minimumConfidenceSkillClass must be an integer from 70 to 100');
    need(gate?.citationGrounding === undefined || ['off', 'advisory'].includes(gate.citationGrounding), 'workflow.designGate.citationGrounding must be off or advisory');
    if (gate?.reviewSequence !== undefined) {
      unknownKeys(gate.reviewSequence, designReviewSequenceKeys, 'workflow.designGate.reviewSequence', errors);
      need(gate.reviewSequence?.mode === 'primary-then-independent-final', 'workflow.designGate.reviewSequence.mode must be primary-then-independent-final');
      need(Number.isInteger(gate.reviewSequence?.primaryReadinessConfidence)
        && gate.reviewSequence.primaryReadinessConfidence >= 93 && gate.reviewSequence.primaryReadinessConfidence <= 100,
      'workflow.designGate.reviewSequence.primaryReadinessConfidence must be an integer from 93 to 100');
      need(Number.isInteger(gate.reviewSequence?.finalAcceptanceConfidence)
        && gate.reviewSequence.finalAcceptanceConfidence >= 81 && gate.reviewSequence.finalAcceptanceConfidence <= 100,
      'workflow.designGate.reviewSequence.finalAcceptanceConfidence must be an integer from 81 to 100');
    }
    if (gate?.secondaryReview !== undefined) {
      const secondary = gate.secondaryReview;
      unknownKeys(secondary, secondaryReviewKeys, 'workflow.designGate.secondaryReview', errors);
      need(secondary?.mode === 'triggered', 'workflow.designGate.secondaryReview.mode must be triggered');
      need(Number.isInteger(secondary?.primaryReadinessConfidence)
        && secondary.primaryReadinessConfidence >= 93 && secondary.primaryReadinessConfidence <= 100,
      'workflow.designGate.secondaryReview.primaryReadinessConfidence must be an integer from 93 to 100');
      need(Number.isInteger(secondary?.finalAcceptanceConfidence)
        && secondary.finalAcceptanceConfidence >= 81 && secondary.finalAcceptanceConfidence <= 100,
      'workflow.designGate.secondaryReview.finalAcceptanceConfidence must be an integer from 81 to 100');
      need(secondary?.requireFinalReview === true,
        'workflow.designGate.secondaryReview.requireFinalReview must be true');
      need(secondary?.requireDifferentAgent === true,
        'workflow.designGate.secondaryReview.requireDifferentAgent must be true');
      need(secondary?.requireDifferentProviderFamilyForHighRisk === true,
        'workflow.designGate.secondaryReview.requireDifferentProviderFamilyForHighRisk must be true');
      need(Number.isInteger(secondary?.auditSamplePermille)
        && secondary.auditSamplePermille >= 0 && secondary.auditSamplePermille <= 1000,
      'workflow.designGate.secondaryReview.auditSamplePermille must be an integer from 0 to 1000');
      need(secondary?.materialDesignRiskClass === 'high',
        'workflow.designGate.secondaryReview.materialDesignRiskClass must be high');
    }
    if (gate?.reviewSequence !== undefined && gate?.secondaryReview !== undefined) {
      need(gate.reviewSequence.primaryReadinessConfidence === gate.secondaryReview.primaryReadinessConfidence,
        'workflow.designGate reviewSequence and secondaryReview primaryReadinessConfidence must match');
      need(gate.reviewSequence.finalAcceptanceConfidence === gate.secondaryReview.finalAcceptanceConfidence,
        'workflow.designGate reviewSequence and secondaryReview finalAcceptanceConfidence must match');
    }
    if (gate?.reviewBudget !== undefined) {
      need(Number.isInteger(gate.reviewBudget?.maxRounds) && gate.reviewBudget.maxRounds >= 1 && gate.reviewBudget.maxRounds <= 42, 'workflow.designGate.reviewBudget.maxRounds must be an integer from 1 to 42');
      need(Number.isInteger(gate.reviewBudget?.maxElapsedMinutes) && gate.reviewBudget.maxElapsedMinutes >= 10 && gate.reviewBudget.maxElapsedMinutes <= 1440, 'workflow.designGate.reviewBudget.maxElapsedMinutes must be an integer from 10 to 1440');
      need(gate.reviewBudget?.onExhausted === 'user-decision', 'workflow.designGate.reviewBudget.onExhausted must be user-decision');
    }
    need(Array.isArray(gate?.requiredReviewers) && gate.requiredReviewers.length >= 2 && new Set(gate.requiredReviewers).size === gate.requiredReviewers.length && gate.requiredReviewers.every((value) => typeof value === 'string' && value.length > 0), 'workflow.designGate.requiredReviewers must contain at least two unique reviewer IDs');
    need(Array.isArray(gate?.requiredChecks) && gate.requiredChecks.length > 0 && new Set(gate.requiredChecks).size === gate.requiredChecks.length && gate.requiredChecks.every((value) => typeof value === 'string' && value.length > 0), 'workflow.designGate.requiredChecks must contain unique check IDs');
    need(gate?.requireZeroSecurityFindings === true, 'workflow.designGate.requireZeroSecurityFindings must be true');
    need(gate?.requireZeroMaterialDissent === true, 'workflow.designGate.requireZeroMaterialDissent must be true');
  }
  if (config.workflow?.phaseModels !== undefined) {
    const phases = config.workflow.phaseModels;
    const keys = ['init', 'objectives', 'review', 'design', 'implement', 'interrogate', 'qc', 'interrogationGate', 'qcGate'];
    need(keys.every((key) => Object.hasOwn(phases, key)), 'workflow.phaseModels must be complete; rerun kstack-init');
    const route = (key, minimum, maximum) => {
      const value = phases?.[key];
      need(Array.isArray(value) && value.length >= minimum && value.length <= maximum, `workflow.phaseModels.${key} must contain ${minimum === maximum ? minimum : `${minimum}-${maximum}`} roles`);
      if (Array.isArray(value)) {
        need(value.every((role) => allowed.phaseRole.has(role)), `workflow.phaseModels.${key} contains an invalid role`);
        need(new Set(value).size === value.length, `workflow.phaseModels.${key} contains duplicate roles`);
      }
    };
    route('init', 1, 2);
    route('objectives', 1, 2);
    route('review', 1, 2);
    route('design', 2, 2);
    route('implement', 1, 1);
    route('interrogate', 1, 2);
    route('qc', 1, 2);
    need(Array.isArray(phases?.design) && phases.design.length === 2 && new Set(phases.design).size === 2 && phases.design.includes('codex') && phases.design.includes('opus'), 'workflow.phaseModels.design must be ordered primary/final roles containing exactly codex and opus');
    const implementRole = Array.isArray(phases?.implement) ? phases.implement[0] : undefined;
    for (const key of ['interrogate', 'qc']) {
      const roles = phases?.[key];
      if (implementRole !== 'active' && Array.isArray(roles) && !roles.includes('active')) {
        need(roles.some((role) => role !== implementRole), `workflow.phaseModels.${key} must include a role different from implementation`);
      }
    }
    need(phases?.interrogationGate?.minimumConfidence === 93, 'workflow.phaseModels.interrogationGate.minimumConfidence must be 93');
    need(phases?.interrogationGate?.maxRedesignRounds === 2, 'workflow.phaseModels.interrogationGate.maxRedesignRounds must be 2');
    need(phases?.qcGate?.minimumConfidence === 95, 'workflow.phaseModels.qcGate.minimumConfidence must be 95');
    need(phases?.qcGate?.maxFixRounds === 3, 'workflow.phaseModels.qcGate.maxFixRounds must be 3');
    need(phases?.qcGate?.requireDualForHighRisk === true, 'workflow.phaseModels.qcGate.requireDualForHighRisk must be true');
  }
  need(allowed.modelMode.has(config.models?.mode), 'models.mode is invalid');
  need(allowed.onUnavailable.has(config.models?.onUnavailable), 'models.onUnavailable is invalid');
  need(typeof config.models?.codex?.command === 'string' && config.models.codex.command.length > 0, 'models.codex.command is required');
  need(typeof config.models?.opus?.command === 'string' && config.models.opus.command.length > 0, 'models.opus.command is required');
  need(Array.isArray(config.models?.codex?.args) && config.models.codex.args.every((value) => typeof value === 'string'), 'models.codex.args must be a string array');
  need(Array.isArray(config.models?.opus?.args) && config.models.opus.args.every((value) => typeof value === 'string'), 'models.opus.args must be a string array');
  need(Number.isInteger(config.models?.codex?.timeoutSeconds) && config.models.codex.timeoutSeconds > 0, 'models.codex.timeoutSeconds must be a positive integer');
  need(Number.isInteger(config.models?.opus?.timeoutSeconds) && config.models.opus.timeoutSeconds > 0, 'models.opus.timeoutSeconds must be a positive integer');
  const codexBackend = JSON.stringify({ command: config.models?.codex?.command, entrypoint: config.models?.codex?.args?.[0] ?? null });
  const opusBackend = JSON.stringify({ command: config.models?.opus?.command, entrypoint: config.models?.opus?.args?.[0] ?? null });
  need(codexBackend !== opusBackend, 'models.codex and models.opus must not resolve to the same declared backend');
  const fableReferenced = Object.values(config.workflow?.phaseModels || {}).some((roles) => Array.isArray(roles) && roles.includes('fable')) || config.workflow?.panel?.enabled === true;
  if (fableReferenced) {
    need(typeof config.models?.fable?.command === 'string' && config.models.fable.command.length > 0, 'models.fable.command is required');
    need(Array.isArray(config.models?.fable?.args) && config.models.fable.args.every((value) => typeof value === 'string'), 'models.fable.args must be a string array');
    need(typeof config.models?.fable?.model === 'string' && config.models.fable.model.length > 0, 'models.fable.model is required');
    need(Number.isInteger(config.models?.fable?.timeoutSeconds) && config.models.fable.timeoutSeconds > 0, 'models.fable.timeoutSeconds must be a positive integer');
  }
  if (config.workflow?.panel?.panels && typeof config.workflow.panel.panels === 'object') {
    for (const [panelId, definition] of Object.entries(config.workflow.panel.panels)) {
      for (const slot of [...(definition?.requiredVoters ?? []), ...(definition?.advisers ?? [])]) {
        if (slot && typeof slot.backendId === 'string') {
          const backend = config.models?.[slot.backendId];
          need(backend && typeof backend === 'object', `workflow.panel.panels.${panelId} backend ${slot.backendId} is not configured in models`);
          if (slot.backendId !== 'codex' && typeof config.models?.fable?.model === 'string') {
            need(backend?.model !== config.models.fable.model, `workflow.panel.panels.${panelId} backend ${slot.backendId} cannot select the configured Fable mediator model`);
          }
        }
      }
    }
  }

  for (const key of ['inspect', 'edit', 'test', 'commit', 'push', 'pullRequest', 'merge', 'deploy', 'deviceInstall', 'destructive', 'externalTicketCreation', 'jiraAdministration']) {
    const value = key === 'jiraAdministration' && config.authority?.[key] === undefined ? 'deny' : config.authority?.[key];
    need(allowed.authority.has(value), `authority.${key} is invalid`);
  }
  validateJiraConfig(config.jira, errors);
  if (typeof config.jira?.deliveryRecordPath === 'string' && options.configPath) {
    const repoRoot = path.dirname(path.dirname(path.resolve(options.configPath)));
    const relative = path.relative(repoRoot, path.resolve(config.jira.deliveryRecordPath));
    need(relative.startsWith(`..${path.sep}`) || relative === '..', 'jira.deliveryRecordPath must resolve outside the repository');
  }
  if (config.jira?.tracking?.mode === 'automatic') {
    need(config.authority?.externalTicketCreation === 'allow', 'jira.tracking.mode automatic requires authority.externalTicketCreation allow');
  }
  if (config.jira?.credentialSource?.type === 'file' && options.configPath) {
    const repoRoot = path.dirname(path.dirname(path.resolve(options.configPath)));
    if (options.command === 'draft') validateCredentialFilePathContainment(config.jira.credentialSource, repoRoot, errors);
    else validateCredentialFileConfig(config.jira.credentialSource, repoRoot, errors);
  }
  need(allowed.persistenceScope.has(config.persistence?.scope), 'persistence.scope is invalid');
  for (const key of ['crossSession', 'retainRawModelOutput', 'redactSecrets']) {
    need(typeof config.persistence?.[key] === 'boolean', `persistence.${key} must be boolean`);
  }
  if (config.memory !== undefined) {
    const memory = config.memory;
    need(typeof memory?.enabled === 'boolean', 'memory.enabled must be boolean');
    need(allowed.memoryRetrieval.has(memory?.retrieval), 'memory.retrieval must be explicit');
    need(allowed.memoryContextInjection.has(memory?.contextInjection), 'memory.contextInjection must be disabled');
    need(allowed.memoryEngine.has(memory?.engine), 'memory.engine must be pglite');
    for (const key of ['bodyDirectory', 'indexDirectory', 'remote']) {
      need(memory?.[key] === null || (typeof memory?.[key] === 'string' && memory[key].length > 0), `memory.${key} must be null or a non-empty string`);
    }
    need(typeof memory?.namespace === 'string' && (memory.namespace === '' || /^[a-z0-9][a-z0-9-]{0,62}$/.test(memory.namespace)), 'memory.namespace must be empty or lower-case hyphen-case');
    need(allowed.memoryTrust.has(memory?.trust), 'memory.trust is invalid');
    need(allowed.memorySync.has(memory?.sync), 'memory.sync must be manual');
    need(Number.isInteger(memory?.resultLimit) && memory.resultLimit > 0 && memory.resultLimit <= 50, 'memory.resultLimit must be an integer from 1 to 50');
    need(Number.isInteger(memory?.tokenBudget) && memory.tokenBudget >= 256 && memory.tokenBudget <= 16000, 'memory.tokenBudget must be an integer from 256 to 16000');
    for (const key of ['createRepository', 'clone', 'fetch', 'integrate', 'commit', 'push', 'resolveConflicts']) {
      need(allowed.authority.has(memory?.authority?.[key]), `memory.authority.${key} is invalid`);
    }
    if (memory?.enabled) {
      need(typeof memory.bodyDirectory === 'string' && memory.bodyDirectory.length > 0, 'memory.bodyDirectory is required when memory is enabled');
      need(typeof memory.indexDirectory === 'string' && memory.indexDirectory.length > 0, 'memory.indexDirectory is required when memory is enabled');
      need(typeof memory.namespace === 'string' && memory.namespace.length > 0, 'memory.namespace is required when memory is enabled');
    }
  }
  return errors;
}

const jiraKeys = new Set([
  'enabled', 'siteUrl', 'apiBaseUrl', 'deliveryRecordPath', 'projects', 'credentialSource', 'staticLabels',
  'timeoutMs', 'maxAttempts', 'approvalTtlMs', 'dryRun', 'nodeMinVersion',
  'tracking'
]);
const PROJECT_KEY = /^[A-Z][A-Z0-9_]{1,9}$/u;
const jiraTrackingKeys = new Set(['mode', 'required', 'repositoryNamespace', 'projectKey', 'automaticVersionAssignment', 'releaseVersions']);
const projectKeys = new Set(['key', 'issueTypes', 'defaultFields']);
const envCredentialKeys = new Set(['type', 'emailEnvVar', 'tokenEnvVar']);
const fileCredentialKeys = new Set(['type', 'path', 'allowInsecurePermissions']);
const reservedJiraFields = new Set(['project', 'issuetype', 'summary', 'description', 'labels', 'security']);

function unknownKeys(value, permitted, prefix, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (!permitted.has(key)) errors.push(`${prefix}.${key} is unknown`);
  }
}

function wellFormedTree(value, location, errors) {
  if (typeof value === 'string') {
    if (!value.isWellFormed()) errors.push(`${location} is not well-formed Unicode`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => wellFormedTree(item, `${location}[${index}]`, errors));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (!key.isWellFormed()) errors.push(`${location} contains a non-well-formed object key`);
      wellFormedTree(child, `${location}.${key}`, errors);
    }
  }
}

export function validateJiraConfig(jira, errors = []) {
  const need = (condition, message) => { if (!condition) errors.push(message); };
  need(jira && typeof jira === 'object' && !Array.isArray(jira), 'jira must be an object');
  if (!jira || typeof jira !== 'object' || Array.isArray(jira)) return errors;
  unknownKeys(jira, jiraKeys, 'jira', errors);
  need(jira.deliveryRecordPath === null || (typeof jira.deliveryRecordPath === 'string' && path.isAbsolute(jira.deliveryRecordPath)), 'jira.deliveryRecordPath must be null or an absolute path');
  need(typeof jira.enabled === 'boolean', 'jira.enabled must be boolean');
  need(typeof jira.dryRun === 'boolean', 'jira.dryRun must be boolean');
  need(Number.isInteger(jira.timeoutMs) && jira.timeoutMs >= 1000 && jira.timeoutMs <= 120000, 'jira.timeoutMs must be an integer from 1000 to 120000');
  need(Number.isInteger(jira.maxAttempts) && jira.maxAttempts >= 1 && jira.maxAttempts <= 5, 'jira.maxAttempts must be an integer from 1 to 5 (total POST attempts)');
  need(Number.isInteger(jira.approvalTtlMs) && jira.approvalTtlMs >= 60000 && jira.approvalTtlMs <= 604800000, 'jira.approvalTtlMs must be an integer from 60000 to 604800000');
  need(jira.nodeMinVersion === '20.0.0', 'jira.nodeMinVersion must be 20.0.0');

  if (jira.tracking !== undefined) {
    const tracking = jira.tracking;
    need(tracking && typeof tracking === 'object' && !Array.isArray(tracking), 'jira.tracking must be an object');
    if (tracking && typeof tracking === 'object' && !Array.isArray(tracking)) {
      unknownKeys(tracking, jiraTrackingKeys, 'jira.tracking', errors);
      need(allowed.jiraTrackingMode.has(tracking.mode), 'jira.tracking.mode must be off, approval-queued, or automatic');
      need(typeof tracking.required === 'boolean', 'jira.tracking.required must be boolean');
      need(tracking.repositoryNamespace === null || (typeof tracking.repositoryNamespace === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(tracking.repositoryNamespace)), 'jira.tracking.repositoryNamespace must be null or owner/name');
      need(tracking.projectKey === null || (typeof tracking.projectKey === 'string' && PROJECT_KEY.test(tracking.projectKey)), 'jira.tracking.projectKey must be null or a valid Jira project key');
      need(typeof tracking.automaticVersionAssignment === 'boolean', 'jira.tracking.automaticVersionAssignment must be boolean');
      need(Array.isArray(tracking.releaseVersions), 'jira.tracking.releaseVersions must be an array');
      if (Array.isArray(tracking.releaseVersions)) {
        const versionIds = new Set();
        const versionNames = new Set();
        for (const [index, version] of tracking.releaseVersions.entries()) {
          need(version && typeof version === 'object' && !Array.isArray(version), `jira.tracking.releaseVersions[${index}] must be an object`);
          if (!version || typeof version !== 'object' || Array.isArray(version)) continue;
          unknownKeys(version, new Set(['id', 'name', 'releaseDate']), `jira.tracking.releaseVersions[${index}]`, errors);
          need(typeof version.id === 'string' && /^[1-9][0-9]*$/u.test(version.id), `jira.tracking.releaseVersions[${index}].id must be a positive Jira ID string`);
          need(typeof version.name === 'string' && version.name.length >= 1 && version.name.length <= 255, `jira.tracking.releaseVersions[${index}].name must contain 1-255 characters`);
          need(typeof version.releaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(version.releaseDate) && !Number.isNaN(Date.parse(`${version.releaseDate}T00:00:00.000Z`)), `jira.tracking.releaseVersions[${index}].releaseDate must be YYYY-MM-DD`);
          need(!versionIds.has(version.id), `jira.tracking.releaseVersions duplicates ID ${version.id}`);
          need(!versionNames.has(version.name), `jira.tracking.releaseVersions duplicates name ${version.name}`);
          versionIds.add(version.id);
          versionNames.add(version.name);
        }
      }
      if (tracking.required === true) need(tracking.mode !== 'off', 'jira.tracking.required cannot use off mode');
      if (tracking.mode !== 'off') {
        need(typeof tracking.repositoryNamespace === 'string', 'jira.tracking.repositoryNamespace is required when tracking is enabled');
        need(typeof tracking.projectKey === 'string', 'jira.tracking.projectKey is required when tracking is enabled');
      }
      if (tracking.mode === 'off') need(tracking.automaticVersionAssignment === false, 'jira.tracking.automaticVersionAssignment requires enabled tracking');
      if (tracking.automaticVersionAssignment === true) need(Array.isArray(tracking.releaseVersions) && tracking.releaseVersions.length > 0, 'jira.tracking.automaticVersionAssignment requires at least one approved releaseVersions entry');
    }
  }

  if (jira.siteUrl !== null) {
    let parsed;
    try { parsed = new URL(jira.siteUrl); } catch {}
    need(typeof jira.siteUrl === 'string' && parsed?.protocol === 'https:', 'jira.siteUrl must be an HTTPS URL or null');
    if (parsed) {
      need(!parsed.username && !parsed.password, 'jira.siteUrl must not contain userinfo');
      need(parsed.pathname === '/' && !parsed.search && !parsed.hash, 'jira.siteUrl must be an origin without path, query, or fragment');
      need(/^[a-z0-9-]+\.atlassian\.net$/.test(parsed.hostname.toLowerCase()), 'jira.siteUrl hostname must be exactly one label plus .atlassian.net');
    }
  }
  if (jira.enabled) need(typeof jira.siteUrl === 'string', 'jira.siteUrl is required when jira.enabled is true');

  if (jira.apiBaseUrl !== undefined && jira.apiBaseUrl !== null) {
    let parsed;
    try { parsed = new URL(jira.apiBaseUrl); } catch {}
    need(typeof jira.apiBaseUrl === 'string' && parsed?.protocol === 'https:', 'jira.apiBaseUrl must be an HTTPS URL or null');
    if (parsed) {
      need(!parsed.username && !parsed.password, 'jira.apiBaseUrl must not contain userinfo');
      need(parsed.hostname.toLowerCase() === 'api.atlassian.com', 'jira.apiBaseUrl hostname must be api.atlassian.com');
      need(/^\/ex\/jira\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(parsed.pathname) && !parsed.search && !parsed.hash, 'jira.apiBaseUrl must be an exact scoped Jira Cloud API base URL');
    }
  }

  need(Array.isArray(jira.projects) && jira.projects.length > 0, 'jira.projects must be a non-empty array');
  if (Array.isArray(jira.projects)) {
    const seenProjects = new Set();
    jira.projects.forEach((project, index) => {
      const prefix = `jira.projects[${index}]`;
      need(project && typeof project === 'object' && !Array.isArray(project), `${prefix} must be an object`);
      if (!project || typeof project !== 'object' || Array.isArray(project)) return;
      unknownKeys(project, projectKeys, prefix, errors);
      need(typeof project.key === 'string' && project.key.length > 0, `${prefix}.key must be a non-empty string`);
      if (typeof project.key === 'string') {
        need(!seenProjects.has(project.key), `${prefix}.key must be unique`);
        seenProjects.add(project.key);
      }
      need(Array.isArray(project.issueTypes) && project.issueTypes.length > 0 && project.issueTypes.every((item) => typeof item === 'string' && item.length > 0), `${prefix}.issueTypes must contain non-empty strings`);
      need(project.defaultFields && typeof project.defaultFields === 'object' && !Array.isArray(project.defaultFields), `${prefix}.defaultFields must be an object`);
      if (project.defaultFields && typeof project.defaultFields === 'object' && !Array.isArray(project.defaultFields)) {
        for (const key of Object.keys(project.defaultFields)) need(!reservedJiraFields.has(key), `${prefix}.defaultFields.${key} is reserved`);
        wellFormedTree(project.defaultFields, `${prefix}.defaultFields`, errors);
      }
    });
  }
  if (jira.tracking?.projectKey) need(jira.projects.some((project) => project?.key === jira.tracking.projectKey), 'jira.tracking.projectKey must reference jira.projects');

  need(Array.isArray(jira.staticLabels) && jira.staticLabels.every((item) => typeof item === 'string' && item.length > 0), 'jira.staticLabels must contain non-empty strings');
  if (Array.isArray(jira.staticLabels)) {
    jira.staticLabels.forEach((label, index) => {
      if (typeof label === 'string') {
        need(!label.startsWith('kstack-draft-'), `jira.staticLabels[${index}] uses the reserved kstack-draft- prefix`);
        wellFormedTree(label, `jira.staticLabels[${index}]`, errors);
      }
    });
  }

  const source = jira.credentialSource;
  need(source && typeof source === 'object' && !Array.isArray(source), 'jira.credentialSource must be an object');
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    if (source.type === 'env') {
      unknownKeys(source, envCredentialKeys, 'jira.credentialSource', errors);
      need(typeof source.emailEnvVar === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(source.emailEnvVar), 'jira.credentialSource.emailEnvVar must be an environment variable name');
      need(typeof source.tokenEnvVar === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(source.tokenEnvVar), 'jira.credentialSource.tokenEnvVar must be an environment variable name');
    } else if (source.type === 'file') {
      unknownKeys(source, fileCredentialKeys, 'jira.credentialSource', errors);
      need(typeof source.path === 'string' && path.isAbsolute(source.path), 'jira.credentialSource.path must be absolute');
      need(typeof source.allowInsecurePermissions === 'boolean', 'jira.credentialSource.allowInsecurePermissions must be boolean');
    } else {
      errors.push('jira.credentialSource.type must be env or file');
    }
  }
  return errors;
}

function validateCredentialFilePathContainment(source, repoRoot, errors = []) {
  if (!source || source.type !== 'file' || typeof source.path !== 'string' || !path.isAbsolute(source.path)) return errors;
  const relative = path.relative(repoRoot, source.path);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    errors.push('jira.credentialSource.path must resolve outside the repository');
  }
  return errors;
}

export function validateCredentialFileConfig(source, repoRoot, errors = []) {
  if (!source || source.type !== 'file' || !path.isAbsolute(source.path)) return errors;
  let repoReal;
  let fileReal;
  let linkStat;
  let stat;
  try {
    repoReal = fs.realpathSync(repoRoot);
    linkStat = fs.lstatSync(source.path);
    fileReal = fs.realpathSync(source.path);
    stat = fs.statSync(fileReal);
  } catch (error) {
    errors.push(`jira.credentialSource.path validation failed: ${sanitize(error.message)}`);
    return errors;
  }
  const relative = path.relative(repoReal, fileReal);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    errors.push('jira.credentialSource.path must resolve outside the repository');
  }
  if (linkStat.isSymbolicLink()) errors.push('jira.credentialSource.path must not be a symlink');
  if (!stat.isFile()) errors.push('jira.credentialSource.path must be a regular file');
  if (stat.dev !== linkStat.dev || stat.ino !== linkStat.ino) errors.push('jira.credentialSource.path changed during validation');
  if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) errors.push('jira.credentialSource.path must be owned by the invoking user');
  if (!source.allowInsecurePermissions && (stat.mode & 0o077) !== 0) errors.push('jira.credentialSource.path grants group/other access');
  return errors;
}

export function findConfig(start = process.cwd()) {
  let current = path.resolve(start);
  while (true) {
    const candidate = path.join(current, '.kstack', 'config.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function readKStackConfig(file, options = {}) {
  const config = parseKStackConfigDocument(fs.readFileSync(file));
  const errors = validateConfig(config, { ...options, configPath: options.configPath ?? file });
  if (errors.length) {
    const error = new Error(`Invalid KStack config:\n- ${errors.join('\n- ')}`);
    error.code = 'KSTACK_CONFIG_INVALID';
    error.validationErrors = errors;
    throw error;
  }
  return config;
}

function main(argv) {
  const [command = 'show', arg] = argv;
  if (command === 'template') {
    process.stdout.write(`${JSON.stringify(defaultConfig, null, 2)}\n`);
    return;
  }

  const file = arg ? path.resolve(arg) : findConfig();
  if (!file) {
    console.error('No .kstack/config.json found. Invoke kstack-init first.');
    process.exitCode = 2;
    return;
  }

  let config;
  try {
    config = readKStackConfig(file);
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  if (command === 'validate') {
    console.log(`valid: ${file}`);
  } else if (command === 'show') {
    process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
  } else {
    console.error(`Unknown command: ${command}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
