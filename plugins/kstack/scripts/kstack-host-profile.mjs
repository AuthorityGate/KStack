import { addressObject, HOST_PACKAGE_DOMAINS } from './kstack-host-package.mjs';

const TOOL_ROLES = Object.freeze(['inspect', 'search', 'execute', 'edit', 'delegate']);
const EXECUTION_MODES = Object.freeze(['native-analysis', 'delegated-plan', 'delegated-build']);
const AUTHORITY_CLASSES = Object.freeze(['read-only', 'workspace-mutation', 'protected-operation']);
const RISK_SIGNALS = Object.freeze([
  'external-write', 'protected-value', 'destructive', 'privileged', 'untrusted-input',
  'independent-review', 'regulated-data'
]);
const PROTECTED_CAPABILITIES = Object.freeze([
  'protected-value-read', 'protected-value-render', 'generic-environment-injection'
]);

function fail(code, detail = '') {
  const error = new Error(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code;
  throw error;
}

function exactKeys(value, keys, code) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(code, `expected ${expected.join(',')}`);
  }
}

function nonemptyString(value, code) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) fail(code);
  return value;
}

function stringSet(value, allowed, code, { empty = false } = {}) {
  if (!Array.isArray(value) || (!empty && value.length === 0)) fail(code);
  const unique = new Set();
  for (const item of value) {
    nonemptyString(item, code);
    if (allowed && !allowed.includes(item)) fail(code, item);
    if (unique.has(item)) fail(code, `duplicate ${item}`);
    unique.add(item);
  }
  return [...unique].sort();
}

export function validateHostProfile(input) {
  exactKeys(input, [
    'schemaVersion', 'hostId', 'displayName', 'instructionFile', 'toolMap',
    'capabilities', 'supportedModes'
  ], 'KSTACK_HOST_PROFILE_INVALID');
  if (input.schemaVersion !== 1) fail('KSTACK_HOST_PROFILE_INVALID', 'schemaVersion');
  const hostId = nonemptyString(input.hostId, 'KSTACK_HOST_PROFILE_INVALID');
  const displayName = nonemptyString(input.displayName, 'KSTACK_HOST_PROFILE_INVALID');
  const instructionFile = nonemptyString(input.instructionFile, 'KSTACK_HOST_PROFILE_INVALID');
  if (!/^[A-Z][A-Z0-9_-]*\.md$/u.test(instructionFile)) fail('KSTACK_HOST_PROFILE_INVALID', 'instructionFile');
  exactKeys(input.toolMap, TOOL_ROLES, 'KSTACK_HOST_PROFILE_INVALID');
  const toolMap = Object.fromEntries(TOOL_ROLES.map((role) => [
    role, nonemptyString(input.toolMap[role], 'KSTACK_HOST_PROFILE_INVALID')
  ]));
  const capabilities = stringSet(input.capabilities, null, 'KSTACK_HOST_PROFILE_INVALID');
  for (const forbidden of PROTECTED_CAPABILITIES) {
    if (capabilities.includes(forbidden)) fail('KSTACK_HOST_PROFILE_FORBIDDEN_CAPABILITY', forbidden);
  }
  const supportedModes = stringSet(input.supportedModes, EXECUTION_MODES, 'KSTACK_HOST_PROFILE_INVALID');
  return { schemaVersion: 1, hostId, displayName, instructionFile, toolMap, capabilities, supportedModes };
}

function freezeProfile(profile) {
  const validated = validateHostProfile(profile);
  Object.freeze(validated.toolMap);
  Object.freeze(validated.capabilities);
  Object.freeze(validated.supportedModes);
  return Object.freeze(validated);
}

export const HOST_PROFILES = Object.freeze({
  claude: freezeProfile({
    schemaVersion: 1, hostId: 'claude', displayName: 'Claude Code', instructionFile: 'CLAUDE.md',
    toolMap: { inspect: 'Read', search: 'Grep', execute: 'Bash', edit: 'Edit', delegate: 'Task' },
    capabilities: ['delegation', 'file-edit', 'file-read', 'shell', 'text-search'],
    supportedModes: ['delegated-build', 'delegated-plan', 'native-analysis']
  }),
  codex: freezeProfile({
    schemaVersion: 1, hostId: 'codex', displayName: 'Codex', instructionFile: 'AGENTS.md',
    toolMap: { inspect: 'exec_command', search: 'exec_command (rg)', execute: 'exec_command', edit: 'apply_patch', delegate: 'spawn_agent' },
    capabilities: ['delegation', 'file-edit', 'file-read', 'shell', 'text-search'],
    supportedModes: ['delegated-build', 'delegated-plan', 'native-analysis']
  }),
  hermes: freezeProfile({
    schemaVersion: 1, hostId: 'hermes', displayName: 'Hermes Agent', instructionFile: 'AGENTS.md',
    toolMap: { inspect: 'read_file', search: 'terminal (rg)', execute: 'terminal', edit: 'patch', delegate: 'delegate_task' },
    capabilities: ['delegation', 'file-edit', 'file-read', 'shell', 'text-search'],
    supportedModes: ['delegated-build', 'delegated-plan', 'native-analysis']
  }),
  openclaw: freezeProfile({
    schemaVersion: 1, hostId: 'openclaw', displayName: 'OpenClaw', instructionFile: 'AGENTS.md',
    toolMap: { inspect: 'read', search: 'exec (rg)', execute: 'exec', edit: 'edit/write', delegate: 'sessions_spawn' },
    capabilities: ['delegation', 'file-edit', 'file-read', 'shell', 'text-search'],
    supportedModes: ['delegated-build', 'delegated-plan', 'native-analysis']
  })
});

export function validateCanonicalSkill(input) {
  exactKeys(input, [
    'schemaVersion', 'skillId', 'title', 'executionMode', 'authorityClass',
    'requiredCapabilities', 'forbiddenCapabilities', 'riskSignals', 'steps'
  ], 'KSTACK_CANONICAL_SKILL_INVALID');
  if (input.schemaVersion !== 1) fail('KSTACK_CANONICAL_SKILL_INVALID', 'schemaVersion');
  const skillId = nonemptyString(input.skillId, 'KSTACK_CANONICAL_SKILL_INVALID');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(skillId)) fail('KSTACK_CANONICAL_SKILL_INVALID', 'skillId');
  const title = nonemptyString(input.title, 'KSTACK_CANONICAL_SKILL_INVALID');
  const executionMode = nonemptyString(input.executionMode, 'KSTACK_CANONICAL_SKILL_INVALID');
  if (!EXECUTION_MODES.includes(executionMode)) fail('KSTACK_CANONICAL_SKILL_INVALID', 'executionMode');
  const authorityClass = nonemptyString(input.authorityClass, 'KSTACK_CANONICAL_SKILL_INVALID');
  if (!AUTHORITY_CLASSES.includes(authorityClass)) fail('KSTACK_CANONICAL_SKILL_INVALID', 'authorityClass');
  const requiredCapabilities = stringSet(input.requiredCapabilities, null, 'KSTACK_CANONICAL_SKILL_INVALID');
  const forbiddenCapabilities = stringSet(input.forbiddenCapabilities, null, 'KSTACK_CANONICAL_SKILL_INVALID');
  const riskSignals = stringSet(input.riskSignals, RISK_SIGNALS, 'KSTACK_CANONICAL_SKILL_INVALID', { empty: true });
  if (!Array.isArray(input.steps) || input.steps.length === 0) fail('KSTACK_CANONICAL_SKILL_INVALID', 'steps');
  const steps = input.steps.map((step, index) => {
    if (step?.kind === 'tool') {
      exactKeys(step, ['kind', 'role', 'instruction'], 'KSTACK_CANONICAL_SKILL_INVALID');
      if (!TOOL_ROLES.includes(step.role)) fail('KSTACK_CANONICAL_SKILL_INVALID', `step ${index} role`);
      return {
        kind: step.kind,
        role: step.role,
        instruction: nonemptyString(step.instruction, 'KSTACK_CANONICAL_SKILL_INVALID')
      };
    }
    exactKeys(step, ['kind', 'text'], 'KSTACK_CANONICAL_SKILL_INVALID');
    if (!['prose', 'boundary', 'evidence'].includes(step.kind)) fail('KSTACK_CANONICAL_SKILL_INVALID', `step ${index}`);
    return { kind: step.kind, text: nonemptyString(step.text, 'KSTACK_CANONICAL_SKILL_INVALID') };
  });
  const overlap = requiredCapabilities.filter((item) => forbiddenCapabilities.includes(item));
  if (overlap.length > 0) fail('KSTACK_CANONICAL_SKILL_INVALID', `capability conflict ${overlap.join(',')}`);
  for (const forbidden of PROTECTED_CAPABILITIES) {
    if (requiredCapabilities.includes(forbidden)) fail('KSTACK_CANONICAL_SKILL_FORBIDDEN_CAPABILITY', forbidden);
  }
  return {
    schemaVersion: 1, skillId, title, executionMode, authorityClass,
    requiredCapabilities, forbiddenCapabilities, riskSignals, steps
  };
}

export function renderHostSkill(skillInput, profileInput) {
  const skill = validateCanonicalSkill(skillInput);
  const profile = validateHostProfile(profileInput);
  if (!profile.supportedModes.includes(skill.executionMode)) fail('KSTACK_HOST_MODE_UNSUPPORTED');
  const missing = skill.requiredCapabilities.filter((item) => !profile.capabilities.includes(item));
  if (missing.length > 0) fail('KSTACK_HOST_CAPABILITY_MISSING', missing.join(','));
  const forbidden = skill.forbiddenCapabilities.filter((item) => profile.capabilities.includes(item));
  if (forbidden.length > 0) fail('KSTACK_HOST_CAPABILITY_FORBIDDEN', forbidden.join(','));

  const body = skill.steps.map((step, index) => {
    if (step.kind === 'tool') return `${index + 1}. Use \`${profile.toolMap[step.role]}\` to ${step.instruction}`;
    const label = step.kind === 'boundary' ? 'Boundary' : step.kind === 'evidence' ? 'Evidence' : 'Instruction';
    return `${index + 1}. ${label}: ${step.text}`;
  }).join('\n');
  const metadata = {
    schemaVersion: 1,
    skillId: skill.skillId,
    hostId: profile.hostId,
    instructionFile: profile.instructionFile,
    executionMode: skill.executionMode,
    authorityClass: skill.authorityClass,
    requiredCapabilities: skill.requiredCapabilities,
    forbiddenCapabilities: skill.forbiddenCapabilities,
    riskSignals: skill.riskSignals
  };
  const content = [
    `# ${skill.title}`,
    '',
    `Host: ${profile.displayName} (\`${profile.hostId}\`)`,
    `Mode: \`${skill.executionMode}\``,
    `Authority: \`${skill.authorityClass}\``,
    '',
    body,
    '',
    'This generated artifact describes method only. It does not grant authority or prove host qualification.',
    ''
  ].join('\n');
  return Object.freeze({
    ...metadata,
    content,
    sha256: addressObject(HOST_PACKAGE_DOMAINS.hostProfileRenderedSkill, { metadata, content })
  });
}

export function selectExecutionMode(workInput) {
  exactKeys(workInput, ['mutationClass', 'riskSignals', 'requiresPlanning'], 'KSTACK_WORK_CLASSIFICATION_INVALID');
  const mutationClass = nonemptyString(workInput.mutationClass, 'KSTACK_WORK_CLASSIFICATION_INVALID');
  if (!['none', 'workspace', 'external', 'protected'].includes(mutationClass)) fail('KSTACK_WORK_CLASSIFICATION_INVALID');
  const riskSignals = stringSet(workInput.riskSignals, RISK_SIGNALS, 'KSTACK_WORK_CLASSIFICATION_INVALID', { empty: true });
  if (typeof workInput.requiresPlanning !== 'boolean') fail('KSTACK_WORK_CLASSIFICATION_INVALID');
  if (mutationClass === 'protected' || riskSignals.includes('protected-value')) return 'protected-operation';
  if (mutationClass === 'none' && !workInput.requiresPlanning) return 'native-analysis';
  if (workInput.requiresPlanning && mutationClass === 'none') return 'delegated-plan';
  return 'delegated-build';
}

export function admitQualifiedCell(requestInput, cellInput, profileInput, nowInput) {
  exactKeys(requestInput, [
    'hostId', 'executionMode', 'authorityClass', 'requiredCapabilities',
    'forbiddenCapabilities', 'riskSignals', 'envelopeDigest'
  ], 'KSTACK_HOST_ADMISSION_INVALID');
  exactKeys(cellInput, [
    'schemaVersion', 'hostId', 'executionMode', 'version', 'platform',
    'capabilities', 'evidenceDigest', 'expiresAt'
  ], 'KSTACK_HOST_CELL_INVALID');
  const profile = validateHostProfile(profileInput);
  if (cellInput.schemaVersion !== 1) fail('KSTACK_HOST_CELL_INVALID', 'schemaVersion');
  const hostId = nonemptyString(requestInput.hostId, 'KSTACK_HOST_ADMISSION_INVALID');
  if (hostId !== profile.hostId || cellInput.hostId !== hostId) fail('KSTACK_HOST_CELL_MISMATCH');
  if (!EXECUTION_MODES.includes(requestInput.executionMode) || cellInput.executionMode !== requestInput.executionMode) {
    fail('KSTACK_HOST_CELL_MISMATCH', 'executionMode');
  }
  if (!AUTHORITY_CLASSES.includes(requestInput.authorityClass)) fail('KSTACK_HOST_ADMISSION_INVALID', 'authorityClass');
  const requiredCapabilities = stringSet(requestInput.requiredCapabilities, null, 'KSTACK_HOST_ADMISSION_INVALID');
  const forbiddenCapabilities = stringSet(requestInput.forbiddenCapabilities, null, 'KSTACK_HOST_ADMISSION_INVALID');
  const riskSignals = stringSet(requestInput.riskSignals, RISK_SIGNALS, 'KSTACK_HOST_ADMISSION_INVALID', { empty: true });
  if (!/^[a-f0-9]{64}$/u.test(requestInput.envelopeDigest)) fail('KSTACK_HOST_ADMISSION_INVALID', 'envelopeDigest');
  nonemptyString(cellInput.version, 'KSTACK_HOST_CELL_INVALID');
  nonemptyString(cellInput.platform, 'KSTACK_HOST_CELL_INVALID');
  const capabilities = stringSet(cellInput.capabilities, null, 'KSTACK_HOST_CELL_INVALID');
  if (!/^[a-f0-9]{64}$/u.test(cellInput.evidenceDigest)) fail('KSTACK_HOST_CELL_INVALID', 'evidenceDigest');
  const expiresAt = Date.parse(cellInput.expiresAt);
  const now = Date.parse(nowInput);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(now)) fail('KSTACK_HOST_CELL_INVALID', 'time');
  if (expiresAt <= now) fail('KSTACK_HOST_CELL_EXPIRED');
  const classified = selectExecutionMode({
    mutationClass: requestInput.authorityClass === 'read-only'
      ? 'none'
      : requestInput.authorityClass === 'protected-operation' ? 'protected' : 'workspace',
    riskSignals,
    requiresPlanning: requestInput.executionMode === 'delegated-plan'
  });
  if (classified === 'protected-operation') fail('KSTACK_PROTECTED_OPERATION_REQUIRES_ADAPTER');
  const missing = requiredCapabilities.filter((item) => !capabilities.includes(item));
  if (missing.length > 0) fail('KSTACK_HOST_CELL_CAPABILITY_MISSING', missing.join(','));
  const forbidden = forbiddenCapabilities.filter((item) => capabilities.includes(item));
  if (forbidden.length > 0) fail('KSTACK_HOST_CELL_CAPABILITY_FORBIDDEN', forbidden.join(','));
  for (const direct of PROTECTED_CAPABILITIES) {
    if (capabilities.includes(direct)) fail('KSTACK_HOST_CELL_FORBIDDEN_CAPABILITY', direct);
  }
  return Object.freeze({
    admitted: true,
    hostId,
    executionMode: requestInput.executionMode,
    cellEvidenceDigest: cellInput.evidenceDigest,
    admissionDigest: addressObject(HOST_PACKAGE_DOMAINS.hostProfileAdmission, { request: requestInput, cell: cellInput, profile })
  });
}

export const HOST_PROFILE_CONSTANTS = Object.freeze({
  toolRoles: TOOL_ROLES,
  executionModes: EXECUTION_MODES,
  authorityClasses: AUTHORITY_CLASSES,
  riskSignals: RISK_SIGNALS,
  protectedCapabilities: PROTECTED_CAPABILITIES
});
