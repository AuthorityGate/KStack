import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { defaultConfig, validateConfig } from '../plugins/kstack/scripts/kstack-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('default configuration is valid', () => {
  assert.deepEqual(validateConfig(structuredClone(defaultConfig)), []);
  assert.equal(defaultConfig.workflow.designGate.minimumConfidence, 93);
  assert.equal(defaultConfig.workflow.designGate.minimumConfidenceRound11Plus, 81);
  assert.deepEqual(defaultConfig.workflow.designGate.reviewSequence, {
    mode: 'primary-then-independent-final', primaryReadinessConfidence: 93, finalAcceptanceConfidence: 81
  });
  assert.deepEqual(defaultConfig.workflow.designGate.secondaryReview, {
    mode: 'triggered', primaryReadinessConfidence: 93, finalAcceptanceConfidence: 81,
    requireFinalReview: true, requireDifferentAgent: true,
    requireDifferentProviderFamilyForHighRisk: true, auditSamplePermille: 0,
    materialDesignRiskClass: 'high'
  });
});

test('design roles are ordered and either provider may own primary improvement', () => {
  const config = structuredClone(defaultConfig);
  config.workflow.phaseModels.design = ['opus', 'codex'];
  assert.deepEqual(validateConfig(config), []);
  config.workflow.designGate.reviewSequence.primaryReadinessConfidence = 92;
  assert.match(validateConfig(config).join('\n'), /primaryReadinessConfidence must be an integer from 93 to 100/u);
  config.workflow.designGate.reviewSequence.primaryReadinessConfidence = 93;
  config.workflow.designGate.reviewSequence.finalAcceptanceConfidence = 80;
  assert.match(validateConfig(config).join('\n'), /finalAcceptanceConfidence must be an integer from 81 to 100/u);
});

test('secondary-review routing cannot weaken final or high-risk independence', () => {
  const config = structuredClone(defaultConfig);
  config.workflow.designGate.secondaryReview.requireFinalReview = false;
  config.workflow.designGate.secondaryReview.requireDifferentAgent = false;
  config.workflow.designGate.secondaryReview.requireDifferentProviderFamilyForHighRisk = false;
  config.workflow.designGate.secondaryReview.auditSamplePermille = 1001;
  config.workflow.designGate.secondaryReview.materialDesignRiskClass = 'ordinary';
  const errors = validateConfig(config).join('\n');
  assert.match(errors, /requireFinalReview must be true/u);
  assert.match(errors, /requireDifferentAgent must be true/u);
  assert.match(errors, /requireDifferentProviderFamilyForHighRisk must be true/u);
  assert.match(errors, /auditSamplePermille must be an integer from 0 to 1000/u);
  assert.match(errors, /materialDesignRiskClass must be high/u);
});

test('staged review configuration is closed and rejects one declared backend for both roles', () => {
  const extraSequence = structuredClone(defaultConfig);
  extraSequence.workflow.designGate.reviewSequence.extra = true;
  assert.match(validateConfig(extraSequence).join('\n'), /workflow\.designGate\.reviewSequence\.extra is unknown/u);

  const extraSecondary = structuredClone(defaultConfig);
  extraSecondary.workflow.designGate.secondaryReview.extra = true;
  assert.match(validateConfig(extraSecondary).join('\n'), /workflow\.designGate\.secondaryReview\.extra is unknown/u);

  const aliased = structuredClone(defaultConfig);
  aliased.models.opus.command = aliased.models.codex.command;
  aliased.models.opus.args = [...aliased.models.codex.args];
  assert.match(validateConfig(aliased).join('\n'), /must not resolve to the same declared backend/u);

  const divergent = structuredClone(defaultConfig);
  divergent.workflow.designGate.reviewSequence.finalAcceptanceConfidence = 82;
  assert.match(validateConfig(divergent).join('\n'), /reviewSequence and secondaryReview finalAcceptanceConfidence must match/u);

  const sequenceOnly = structuredClone(defaultConfig);
  delete sequenceOnly.workflow.designGate.secondaryReview;
  assert.match(validateConfig(sequenceOnly).join('\n'), /reviewSequence and secondaryReview must be provided together/u);

  const secondaryOnly = structuredClone(defaultConfig);
  delete secondaryOnly.workflow.designGate.reviewSequence;
  assert.match(validateConfig(secondaryOnly).join('\n'), /reviewSequence and secondaryReview must be provided together/u);
});

test('Jira configuration rejects unknown keys, unsafe origins, reserved fields, and malformed strings', () => {
  const unknown = structuredClone(defaultConfig);
  unknown.jira.extra = true;
  assert.match(validateConfig(unknown).join('\n'), /jira\.extra is unknown/);

  const origin = structuredClone(defaultConfig);
  origin.jira.enabled = true;
  origin.jira.siteUrl = 'https://evil.atlassian.net.attacker.com';
  assert.match(validateConfig(origin).join('\n'), /exactly one label/);

  const scoped = structuredClone(defaultConfig);
  scoped.jira.apiBaseUrl = 'https://api.atlassian.com/ex/jira/ba41d897-4290-40f9-9886-bd4f2601d96a';
  assert.deepEqual(validateConfig(scoped), []);
  scoped.jira.apiBaseUrl = 'https://api.atlassian.com.attacker.test/ex/jira/ba41d897-4290-40f9-9886-bd4f2601d96a';
  assert.match(validateConfig(scoped).join('\n'), /hostname must be api\.atlassian\.com/);
  scoped.jira.apiBaseUrl = 'https://api.atlassian.com/ex/jira/not-a-cloud-id';
  assert.match(validateConfig(scoped).join('\n'), /exact scoped Jira Cloud API base URL/);

  const reserved = structuredClone(defaultConfig);
  reserved.jira.projects[0].defaultFields.security = { id: '1' };
  assert.match(validateConfig(reserved).join('\n'), /defaultFields\.security is reserved/);

  const malformed = structuredClone(defaultConfig);
  malformed.jira.staticLabels = ['bad\uD800'];
  assert.match(validateConfig(malformed).join('\n'), /well-formed Unicode/);

  const relativeRecord = structuredClone(defaultConfig);
  relativeRecord.jira.deliveryRecordPath = '.kstack/jira-delivery-stack.json';
  assert.match(validateConfig(relativeRecord).join('\n'), /deliveryRecordPath must be null or an absolute path/u);
});

test('Jira delivery record may use an absolute path outside the repository', () => {
  const config = structuredClone(defaultConfig);
  config.jira.deliveryRecordPath = path.join(root, '..', '.kstack-state', 'jira-delivery-stack.json');
  assert.deepEqual(validateConfig(config, { configPath: path.join(root, '.kstack', 'config.json') }), []);
  config.jira.deliveryRecordPath = path.join(root, '.kstack', 'jira-delivery-stack.json');
  assert.match(validateConfig(config, { configPath: path.join(root, '.kstack', 'config.json') }).join('\n'), /must resolve outside the repository/u);
});

test('maxAttempts is validated as total physical POST attempts', () => {
  const config = structuredClone(defaultConfig);
  config.jira.maxAttempts = 0;
  assert.match(validateConfig(config).join('\n'), /total POST attempts/);
});

test('invalid external authority is rejected', () => {
  const config = structuredClone(defaultConfig);
  config.authority.deploy = 'always';
  assert.match(validateConfig(config).join('\n'), /authority\.deploy is invalid/);
});

test('Jira administration is distinct and legacy omission fails closed', () => {
  const config = structuredClone(defaultConfig);
  assert.equal(config.authority.jiraAdministration, 'ask');
  config.authority.jiraAdministration = 'always';
  assert.match(validateConfig(config).join('\n'), /authority\.jiraAdministration is invalid/);
  delete config.authority.jiraAdministration;
  assert.deepEqual(validateConfig(config), []);
});

test('Jira continuous tracking is repository-scoped, explicit, and authority-bound', () => {
  const config = structuredClone(defaultConfig);
  assert.deepEqual(config.jira.tracking, {
    mode: 'off', required: false, repositoryNamespace: null, projectKey: null,
    automaticVersionAssignment: false, releaseVersions: []
  });
  config.jira.tracking = {
    mode: 'approval-queued', required: true, repositoryNamespace: 'AuthorityGate/KStack', projectKey: 'KSTK',
    automaticVersionAssignment: false, releaseVersions: []
  };
  assert.deepEqual(validateConfig(config), []);

  config.jira.tracking.mode = 'automatic';
  assert.match(validateConfig(config).join('\n'), /requires authority\.externalTicketCreation allow/u);
  config.authority.externalTicketCreation = 'allow';
  assert.deepEqual(validateConfig(config), []);

  config.jira.tracking.projectKey = 'OTHER';
  assert.match(validateConfig(config).join('\n'), /must reference jira\.projects/u);
  config.jira.tracking.projectKey = null;
  assert.match(validateConfig(config).join('\n'), /projectKey is required/u);
  config.jira.tracking.projectKey = 'KSTK';
  config.jira.tracking.repositoryNamespace = null;
  assert.match(validateConfig(config).join('\n'), /repositoryNamespace is required/u);
  config.jira.tracking.repositoryNamespace = 'AuthorityGate/KStack';
  config.jira.tracking.automaticVersionAssignment = true;
  assert.match(validateConfig(config).join('\n'), /requires at least one approved releaseVersions entry/u);
  config.jira.tracking.releaseVersions = [{ id: '10001', name: 'v1.0.0', releaseDate: '2026-08-28' }];
  assert.deepEqual(validateConfig(config), []);
});

test('legacy Jira configuration without tracking remains valid and fails closed as off', () => {
  const config = structuredClone(defaultConfig);
  delete config.jira.tracking;
  assert.deepEqual(validateConfig(config), []);
});

test('design threshold accepts 90 and rejects values below the floor', () => {
  const config = structuredClone(defaultConfig);
  config.workflow.designGate.minimumConfidence = 90;
  assert.deepEqual(validateConfig(config), []);

  config.workflow.designGate.minimumConfidence = 89;
  assert.match(validateConfig(config).join('\n'), /minimumConfidence must be an integer from 90 to 100/);
});

test('later-round, final-review, and skill-class design thresholds enforce their floors', () => {
  const config = structuredClone(defaultConfig);
  config.workflow.designGate.minimumConfidenceRound11Plus = 81;
  config.workflow.designGate.reviewSequence.finalAcceptanceConfidence = 81;
  config.workflow.designGate.minimumConfidenceSkillClass = 70;
  assert.deepEqual(validateConfig(config), []);

  config.workflow.designGate.minimumConfidenceRound11Plus = 80;
  config.workflow.designGate.reviewSequence.finalAcceptanceConfidence = 80;
  config.workflow.designGate.minimumConfidenceSkillClass = 69;
  const errors = validateConfig(config).join('\n');
  assert.match(errors, /minimumConfidenceRound11Plus must be an integer from 81 to 100/);
  assert.match(errors, /finalAcceptanceConfidence must be an integer from 81 to 100/);
  assert.match(errors, /minimumConfidenceSkillClass must be an integer from 70 to 100/);
});

test('legacy design-gate configuration may omit the new confidence tiers', () => {
  const config = structuredClone(defaultConfig);
  delete config.workflow.designGate.minimumConfidenceRound11Plus;
  delete config.workflow.designGate.minimumConfidenceSkillClass;
  assert.deepEqual(validateConfig(config), []);
});

test('material design review budget is bounded and always returns control to the user', () => {
  const config = structuredClone(defaultConfig);
  assert.deepEqual(validateConfig(config), []);
  config.workflow.designGate.reviewBudget.maxRounds = 43;
  config.workflow.designGate.reviewBudget.maxElapsedMinutes = 9;
  config.workflow.designGate.reviewBudget.onExhausted = 'continue';
  const errors = validateConfig(config).join('\n');
  assert.match(errors, /maxRounds must be an integer from 1 to 42/);
  assert.match(errors, /maxElapsedMinutes must be an integer from 10 to 1440/);
  assert.match(errors, /onExhausted must be user-decision/);
});

test('panel configuration is opt-in, closed, bounded, and keeps Fable mediator-only', () => {
  const config = structuredClone(defaultConfig);
  assert.deepEqual(validateConfig(config), []);
  config.workflow.panel.enabled = true;
  config.workflow.panel.panels['launch-review'] = {
    threshold: 88,
    adapter: 'document-v1',
    dataClass: 'internal',
    externalAuthor: 'project-owner',
    requiredVoters: [
      { slotId: 'security', personaId: 'security-engineer', backendId: 'codex', providerFamily: 'openai' },
      { slotId: 'resilience', personaId: 'resilience-expert', backendId: 'opus', providerFamily: 'anthropic' }
    ],
    advisers: []
  };
  assert.deepEqual(validateConfig(config), []);

  config.workflow.panel.panels['launch-review'].threshold = 0;
  config.workflow.panel.panels['launch-review'].requiredVoters[0].backendId = 'fable';
  config.workflow.panel.extra = true;
  const errors = validateConfig(config).join('\n');
  assert.match(errors, /threshold must be an integer from 1 to 100/);
  assert.match(errors, /Fable is mediator-only/);
  assert.match(errors, /workflow\.panel\.extra is unknown/);
});

test('panel backend pins cannot spoof provider diversity or alias the Fable mediator model', () => {
  const config = structuredClone(defaultConfig);
  config.workflow.panel.enabled = true;
  config.workflow.panel.panels['backend-review'] = {
    threshold: 88,
    adapter: 'code-review-v1',
    dataClass: 'internal',
    externalAuthor: 'project-owner',
    requiredVoters: [
      { slotId: 'openai', personaId: 'security-engineer', backendId: 'codex', providerFamily: 'anthropic' },
      { slotId: 'mediator-alias', personaId: 'resilience-expert', backendId: 'fable-copy', providerFamily: 'anthropic' }
    ],
    advisers: []
  };
  config.models['fable-copy'] = { ...config.models.fable };
  const errors = validateConfig(config).join('\n');
  assert.match(errors, /providerFamily must be openai for backend codex/);
  assert.match(errors, /cannot select the configured Fable mediator model/);
});

test('paid shadow and production panel configuration fail closed without linked policy and spend', () => {
  const config = structuredClone(defaultConfig);
  config.workflow.panel.paidShadowEnabled = true;
  let errors = validateConfig(config).join('\n');
  assert.match(errors, /requires releaseStage shadow/);
  assert.match(errors, /positive maxRunUsdMicros/);

  config.workflow.panel.paidShadowEnabled = false;
  config.workflow.panel.productionEnabled = true;
  config.workflow.panel.releaseStage = 'production';
  errors = validateConfig(config).join('\n');
  assert.match(errors, /positive maxRunUsdMicros/);
  assert.match(errors, /requires productionPolicyDecisionDigest/);
});

test('citation grounding has only off and advisory modes', () => {
  const config = structuredClone(defaultConfig);
  config.workflow.designGate.citationGrounding = 'blocking';
  assert.match(validateConfig(config).join('\n'), /citationGrounding must be off or advisory/);
});

test('legacy configuration without phase models remains valid', () => {
  const config = structuredClone(defaultConfig);
  delete config.workflow.phaseModels;
  assert.deepEqual(validateConfig(config), []);
});

test('configuration without a Fable role does not require models.fable', () => {
  const config = structuredClone(defaultConfig);
  delete config.models.fable;
  assert.deepEqual(validateConfig(config), []);
});

test('configuration with a Fable role requires models.fable', () => {
  const config = structuredClone(defaultConfig);
  config.workflow.phaseModels.qc = ['fable'];
  delete config.models.fable;
  const errors = validateConfig(config).join('\n');
  assert.match(errors, /models\.fable\.command is required/);
  assert.match(errors, /models\.fable\.args must be a string array/);
  assert.match(errors, /models\.fable\.model is required/);
  assert.match(errors, /models\.fable\.timeoutSeconds must be a positive integer/);
});

test('partial phase model configuration is rejected', () => {
  const config = structuredClone(defaultConfig);
  delete config.workflow.phaseModels.qc;
  assert.match(validateConfig(config).join('\n'), /phaseModels must be complete/);
});

test('interrogation and QC thresholds are fixed safety floors', () => {
  const interrogation = structuredClone(defaultConfig);
  interrogation.workflow.phaseModels.interrogationGate.minimumConfidence = 92;
  assert.match(validateConfig(interrogation).join('\n'), /minimumConfidence must be 93/);

  const qc = structuredClone(defaultConfig);
  qc.workflow.phaseModels.qcGate.minimumConfidence = 94;
  assert.match(validateConfig(qc).join('\n'), /minimumConfidence must be 95/);
});

test('literal duplicate phase roles are rejected', () => {
  const config = structuredClone(defaultConfig);
  config.workflow.phaseModels.qc = ['opus', 'opus'];
  assert.match(validateConfig(config).join('\n'), /duplicate roles/);
});

test('literal implementer cannot be the only interrogation or QC reviewer', () => {
  const config = structuredClone(defaultConfig);
  config.workflow.phaseModels.implement = ['codex'];
  config.workflow.phaseModels.interrogate = ['codex'];
  config.workflow.phaseModels.qc = ['codex'];
  const errors = validateConfig(config).join('\n');
  assert.match(errors, /interrogate must include a role different/);
  assert.match(errors, /qc must include a role different/);
});

test('memory cannot enable automatic context injection', () => {
  const config = structuredClone(defaultConfig);
  config.memory.contextInjection = 'per-turn';
  assert.match(validateConfig(config).join('\n'), /contextInjection must be disabled/);
});

test('all skills are explicit-only and contain no scaffold TODOs', () => {
  const skillsRoot = path.join(root, 'plugins', 'kstack', 'skills');
  for (const name of fs.readdirSync(skillsRoot)) {
    const skillRoot = path.join(skillsRoot, name);
    if (!fs.statSync(skillRoot).isDirectory()) continue;
    const skill = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
    const metadata = fs.readFileSync(path.join(skillRoot, 'agents', 'openai.yaml'), 'utf8');
    assert.doesNotMatch(skill, /\[TODO|TODO:/);
    assert.match(metadata, /allow_implicit_invocation:\s*false/);
    assert.match(metadata, new RegExp(`\\$${name}\\b`));
  }
});

test('Interrogation and QC skills preserve their gates and shared authority', () => {
  const skillsRoot = path.join(root, 'plugins', 'kstack', 'skills');
  const interrogation = fs.readFileSync(path.join(skillsRoot, 'kstack-interrogate', 'SKILL.md'), 'utf8');
  const qc = fs.readFileSync(path.join(skillsRoot, 'kstack-qc', 'SKILL.md'), 'utf8');
  assert.match(interrogation, /confidence below 93/);
  assert.match(interrogation, /same project authority matrix/);
  assert.match(interrogation, /FULL_DESIGN_REQUIRED/);
  assert.match(qc, /confidence below 95/);
  assert.match(qc, /same project authority matrix/);
  assert.match(qc, /require both Codex and Opus/);
  assert.match(qc, /USER_DECISION_REQUIRED/);
});

test('design cycle 2 is blocked until direct-user clarification is locked', () => {
  const skillsRoot = path.join(root, 'plugins', 'kstack', 'skills');
  const design = fs.readFileSync(path.join(skillsRoot, 'kstack-design', 'SKILL.md'), 'utf8');
  const clarify = fs.readFileSync(path.join(skillsRoot, 'kstack-design-clarify', 'SKILL.md'), 'utf8');
  const interrogation = fs.readFileSync(path.join(skillsRoot, 'kstack-interrogate', 'SKILL.md'), 'utf8');
  assert.match(design, /first completed staged final-review synthesis/);
  assert.match(design, /ROUND_ONE_CLARIFICATION_LOCKED/);
  assert.match(design, /Do not start round 2/);
  assert.match(clarify, /once-per-thread gate/);
  assert.match(clarify, /every instance of:/);
  assert.match(clarify, /scope divergence/);
  assert.match(clarify, /Status: LOCKED/);
  assert.match(clarify, /may not silently/);
  assert.match(clarify, /direct human questionnaire/);
  assert.match(interrogation, /Review plan drift before changing implementation/);
});

test('design review process tracks rounds without an elapsed-time window', () => {
  const processFiles = [
    path.join(root, 'plugins', 'kstack', 'skills', 'kstack-design', 'SKILL.md'),
    path.join(root, 'plugins', 'kstack', 'skills', 'kstack-init', 'SKILL.md'),
    path.join(root, 'plugins', 'kstack', 'references', 'DUAL_REVIEW.md'),
    path.join(root, 'plugins', 'kstack', 'references', 'CONFIG.md'),
  ].map((file) => fs.readFileSync(file, 'utf8'));

  for (const process of processFiles) {
    assert.doesNotMatch(process, /maxElapsedMinutes|elapsed wall time|elapsed minutes|minutes remaining|remaining budget|opened at|120 minutes/i);
    assert.match(process, /round/);
  }
  assert.match(processFiles[0], /--round N/);
  assert.match(processFiles[2], /--round N/);
});

test('Jira skill separates issue creation from guarded project-space administration', () => {
  const skillsRoot = path.join(root, 'plugins', 'kstack', 'skills');
  const jira = fs.readFileSync(path.join(skillsRoot, 'kstack-jira', 'SKILL.md'), 'utf8');
  const metadata = fs.readFileSync(path.join(skillsRoot, 'kstack-jira', 'agents', 'openai.yaml'), 'utf8');
  const shellBlocks = [...jira.matchAll(/```bash\n([\s\S]*?)```/g)].map((match) => match[1]).join('\n');
  assert.match(shellBlocks, /kstack-jira\.mjs draft/);
  assert.doesNotMatch(shellBlocks, /\b(?:approve|submit|reconcile|resolve|discard|doctor|show)\b/);
  assert.match(jira, /jira\.enabled: true/);
  assert.match(jira, /Project\/space onboarding does not have that\nprecondition/);
  assert.match(jira, /previously skipped Jira may invoke\nthis skill/);
  assert.match(jira, /offline `start`\ncommand to update only this repository's `.kstack\/config\.json`/);
  assert.match(jira, /do not require a manual config edit/);
  assert.match(jira, /lifecycle: offline\n`start`, `preview`, and `show`, read-only\n`validate` and `reconcile`/);
  assert.match(jira, /kstack-jira-bootstrap\.mjs start --site-url/);
  assert.match(jira, /supported per-project workflow/);
  assert.match(jira, /authority\.jiraAdministration/);
  assert.match(jira, /interactive-TTY operations/);
  assert.match(jira, /active host agent may launch that PTY and enter/);
  assert.match(jira, /owner must open another\nconsole/);
  assert.match(jira, /Run `apply` only from `new-approved`/);
  assert.match(jira, /restriction is only for `kstack-jira\.mjs`/);
  assert.match(jira, /every command in the separate\n`<kstack-plugin-root>\/scripts\/kstack-jira-bootstrap\.mjs` lifecycle/);
  assert.match(jira, /Every initialized repository can use this workflow/);
  assert.match(jira, /requested outcome is a verified live project\/space/);
  assert.match(jira, /Report a preview as `new-previewed`, never as\ncompletion/);
  assert.match(metadata, /Create or connect this project's Jira space/);
  assert.match(metadata, /do not stop at an offline preview/);
  assert.doesNotMatch(metadata, /without applying an external mutation/);
  const init = fs.readFileSync(path.join(skillsRoot, 'kstack-init', 'SKILL.md'), 'utf8');
  assert.match(init, /same skill and host session may finish/);
  assert.match(init, /active host agent may drive the interactive PTY/);
  assert.match(init, /Every initialized repository receives this\n   capability/);
  assert.match(init, /selects `skip` retains the ability/);
  assert.match(init, /not that the project is permanently barred/);
  const design = fs.readFileSync(path.join(skillsRoot, 'kstack-design', 'SKILL.md'), 'utf8');
  assert.match(design, /confirmed Jira key/);
  assert.match(design, /BACKLOG_REALIZATION_BLOCKED/);
  for (const name of ['kstack-review', 'kstack-implement', 'kstack-qc']) {
    const skill = fs.readFileSync(path.join(skillsRoot, name, 'SKILL.md'), 'utf8');
    assert.match(skill, /When `jira\.enabled` is true/);
    assert.match(skill, /only the fully offline\n?`draft` command|only the fully offline `draft`/);
  }
});
