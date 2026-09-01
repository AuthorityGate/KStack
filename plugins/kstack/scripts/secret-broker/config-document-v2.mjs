import { hostCanonicalBytes } from '../kstack-host-contract.mjs';
import {
  SECRET_BROKER_CONFIG_MAX_BYTES,
  projectSecretBrokerConfig
} from './config-v2.mjs';

const MAX_DEPTH = 32;
const MAX_OBJECT_PROPERTIES = 1_024;
const MAX_ARRAY_ITEMS = 1_024;
const MAX_STRING_BYTES = 16_384;

export class KStackConfigDocumentError extends Error {
  constructor(code) {
    super(code);
    this.name = 'KStackConfigDocumentError';
    this.code = code;
  }
}

function fail(code) { throw new KStackConfigDocumentError(code); }

function decode(input) {
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array)) fail('KSTACK_CONFIG_INPUT_INVALID');
  const bytes = Buffer.from(input);
  if (bytes.length < 2) fail('KSTACK_CONFIG_INPUT_INVALID');
  if (bytes.length > SECRET_BROKER_CONFIG_MAX_BYTES) fail('KSTACK_CONFIG_BYTES_EXCEEDED');
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) fail('KSTACK_CONFIG_BOM_FORBIDDEN');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { fail('KSTACK_CONFIG_UTF8_INVALID'); }
  return { bytes, text };
}

function assertString(value) {
  if (!value.isWellFormed() || value.normalize('NFC') !== value) fail('KSTACK_CONFIG_STRING_INVALID');
  if (Buffer.byteLength(value, 'utf8') > MAX_STRING_BYTES) fail('KSTACK_CONFIG_STRING_BYTES_EXCEEDED');
}

class DuplicateSafeJsonParser {
  constructor(text) { this.text = text; this.offset = 0; }

  parse() {
    this.space();
    const value = this.value(0);
    this.space();
    if (this.offset !== this.text.length) fail('KSTACK_CONFIG_TRAILING_DATA');
    return value;
  }

  space() {
    while (this.offset < this.text.length && /[\u0009\u000a\u000d\u0020]/u.test(this.text[this.offset])) this.offset += 1;
  }

  value(depth) {
    if (depth > MAX_DEPTH) fail('KSTACK_CONFIG_DEPTH_EXCEEDED');
    this.space();
    const token = this.text[this.offset];
    if (token === '{') return this.object(depth);
    if (token === '[') return this.array(depth);
    if (token === '"') return this.string();
    if (token === 't') return this.literal('true', true);
    if (token === 'f') return this.literal('false', false);
    if (token === 'n') return this.literal('null', null);
    if (token === '-' || token >= '0' && token <= '9') return this.integer();
    fail('KSTACK_CONFIG_JSON_SYNTAX_INVALID');
  }

  literal(token, value) {
    if (this.text.slice(this.offset, this.offset + token.length) !== token) fail('KSTACK_CONFIG_JSON_SYNTAX_INVALID');
    this.offset += token.length;
    return value;
  }

  object(depth) {
    this.offset += 1;
    this.space();
    const output = {};
    const keys = new Set();
    if (this.text[this.offset] === '}') { this.offset += 1; return output; }
    while (true) {
      if (keys.size >= MAX_OBJECT_PROPERTIES) fail('KSTACK_CONFIG_OBJECT_PROPERTIES_EXCEEDED');
      if (this.text[this.offset] !== '"') fail('KSTACK_CONFIG_JSON_SYNTAX_INVALID');
      const key = this.string();
      if (keys.has(key)) fail('KSTACK_CONFIG_DUPLICATE_KEY');
      keys.add(key);
      this.space();
      if (this.text[this.offset++] !== ':') fail('KSTACK_CONFIG_JSON_SYNTAX_INVALID');
      Object.defineProperty(output, key, {
        value: this.value(depth + 1), enumerable: true, configurable: true, writable: true
      });
      this.space();
      const separator = this.text[this.offset++];
      if (separator === '}') return output;
      if (separator !== ',') fail('KSTACK_CONFIG_JSON_SYNTAX_INVALID');
      this.space();
    }
  }

  array(depth) {
    this.offset += 1;
    this.space();
    const output = [];
    if (this.text[this.offset] === ']') { this.offset += 1; return output; }
    while (true) {
      if (output.length >= MAX_ARRAY_ITEMS) fail('KSTACK_CONFIG_ARRAY_ITEMS_EXCEEDED');
      output.push(this.value(depth + 1));
      this.space();
      const separator = this.text[this.offset++];
      if (separator === ']') return output;
      if (separator !== ',') fail('KSTACK_CONFIG_JSON_SYNTAX_INVALID');
      this.space();
    }
  }

  string() {
    this.offset += 1;
    let output = '';
    while (this.offset < this.text.length) {
      const character = this.text[this.offset++];
      if (character === '"') { assertString(output); return output; }
      let chunk;
      if (character === '\\') {
        const escaped = this.text[this.offset++];
        if (escaped === '"' || escaped === '\\' || escaped === '/') chunk = escaped;
        else if (escaped === 'u') chunk = this.unicodeEscape();
        else if (escaped === 'b') chunk = '\b';
        else if (escaped === 'f') chunk = '\f';
        else if (escaped === 'n') chunk = '\n';
        else if (escaped === 'r') chunk = '\r';
        else if (escaped === 't') chunk = '\t';
        else fail('KSTACK_CONFIG_JSON_ESCAPE_INVALID');
      } else {
        if (character.charCodeAt(0) <= 0x1f) fail('KSTACK_CONFIG_JSON_CONTROL_INVALID');
        chunk = character;
      }
      output += chunk;
      if (Buffer.byteLength(output, 'utf8') > MAX_STRING_BYTES) fail('KSTACK_CONFIG_STRING_BYTES_EXCEEDED');
    }
    fail('KSTACK_CONFIG_JSON_STRING_UNTERMINATED');
  }

  unicodeEscape() {
    const first = this.hexUnit();
    if (first >= 0xdc00 && first <= 0xdfff) fail('KSTACK_CONFIG_JSON_SURROGATE_INVALID');
    if (first < 0xd800 || first > 0xdbff) return String.fromCharCode(first);
    if (this.text[this.offset] !== '\\' || this.text[this.offset + 1] !== 'u') fail('KSTACK_CONFIG_JSON_SURROGATE_INVALID');
    this.offset += 2;
    const second = this.hexUnit();
    if (second < 0xdc00 || second > 0xdfff) fail('KSTACK_CONFIG_JSON_SURROGATE_INVALID');
    return String.fromCodePoint(0x10000 + ((first - 0xd800) << 10) + second - 0xdc00);
  }

  hexUnit() {
    const digits = this.text.slice(this.offset, this.offset + 4);
    if (!/^[0-9a-f]{4}$/iu.test(digits)) fail('KSTACK_CONFIG_JSON_ESCAPE_INVALID');
    this.offset += 4;
    return Number.parseInt(digits, 16);
  }

  integer() {
    const match = /^-?(?:0|[1-9][0-9]*)/u.exec(this.text.slice(this.offset));
    if (!match) fail('KSTACK_CONFIG_JSON_NUMBER_INVALID');
    const numeral = match[0];
    this.offset += numeral.length;
    if (this.text[this.offset] === '.' || this.text[this.offset] === 'e' || this.text[this.offset] === 'E' || numeral === '-0') fail('KSTACK_CONFIG_JSON_NUMBER_INVALID');
    let value;
    try { value = BigInt(numeral); } catch { fail('KSTACK_CONFIG_JSON_NUMBER_INVALID'); }
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) fail('KSTACK_CONFIG_JSON_NUMBER_INVALID');
    return Number(value);
  }
}

function exactKeys(value, expected, code = 'KSTACK_CONFIG_SCHEMA_INVALID') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some((key) => !expected.includes(key))) fail(code);
}

function exactArrayObjects(value, keys) {
  if (!Array.isArray(value)) fail('KSTACK_CONFIG_SCHEMA_INVALID');
  for (const item of value) exactKeys(item, keys);
}

function assertV2ClosedShape(value) {
  exactKeys(value.project, ['name', 'roots']);
  exactKeys(value.workflow, [
    'objectiveDepth', 'reviewScope', 'designLanes', 'implementationTransition',
    'materialDecisionRule', 'planningLensTrial', 'contextReduction', 'panel',
    'designGate', 'phaseModels'
  ]);
  exactKeys(value.workflow.planningLensTrial, ['enabled', 'objectives']);
  exactKeys(value.workflow.contextReduction, [
    'measurementEnabled', 'eagerInstructionsEnabled', 'slicingEnabled',
    'qualificationEvidenceSha256', 'qualificationRouteId', 'qualificationProfileId'
  ]);
  exactKeys(value.workflow.panel, [
    'enabled', 'releaseStage', 'capacityProfile', 'projectPersonaDirectory',
    'stateDirectory', 'paidShadowEnabled', 'productionEnabled', 'maxRunUsdMicros',
    'maxEvaluationUsdMicros', 'spendConfirmation', 'minimumProductionProviderFamilies',
    'productionPolicyDecisionDigest', 'singleFamilyOwnerDecisionDigest',
    'capacityPolicyDecisionDigest', 'panels'
  ]);
  if (!value.workflow.panel.panels || typeof value.workflow.panel.panels !== 'object' || Array.isArray(value.workflow.panel.panels)) fail('KSTACK_CONFIG_SCHEMA_INVALID');
  for (const definition of Object.values(value.workflow.panel.panels)) {
    exactKeys(definition, ['threshold', 'adapter', 'dataClass', 'externalAuthor', 'requiredVoters', 'advisers']);
    exactArrayObjects(definition.requiredVoters, ['slotId', 'personaId', 'backendId', 'providerFamily']);
    exactArrayObjects(definition.advisers, ['slotId', 'personaId', 'backendId', 'providerFamily']);
  }
  exactKeys(value.workflow.designGate, [
    'minimumConfidence', 'minimumConfidenceRound11Plus', 'minimumConfidenceSkillClass',
    'citationGrounding', 'reviewSequence', 'secondaryReview', 'reviewBudget',
    'requiredReviewers', 'requiredChecks', 'requireZeroSecurityFindings',
    'requireZeroMaterialDissent'
  ]);
  exactKeys(value.workflow.designGate.reviewSequence, ['mode', 'primaryReadinessConfidence', 'finalAcceptanceConfidence']);
  exactKeys(value.workflow.designGate.secondaryReview, [
    'mode', 'primaryReadinessConfidence', 'finalAcceptanceConfidence',
    'requireFinalReview', 'requireDifferentAgent', 'requireDifferentProviderFamilyForHighRisk',
    'auditSamplePermille', 'materialDesignRiskClass'
  ]);
  exactKeys(value.workflow.designGate.reviewBudget, ['maxRounds', 'maxElapsedMinutes', 'onExhausted']);
  exactKeys(value.workflow.phaseModels, [
    'init', 'objectives', 'review', 'design', 'implement', 'interrogate', 'qc',
    'interrogationGate', 'qcGate'
  ]);
  exactKeys(value.workflow.phaseModels.interrogationGate, ['minimumConfidence', 'maxRedesignRounds']);
  exactKeys(value.workflow.phaseModels.qcGate, ['minimumConfidence', 'maxFixRounds', 'requireDualForHighRisk']);

  exactKeys(value.models, ['mode', 'onUnavailable', 'codex', 'opus', 'fable']);
  exactKeys(value.models.codex, ['command', 'args', 'model', 'reasoningEffort', 'timeoutSeconds']);
  exactKeys(value.models.opus, ['command', 'args', 'model', 'effort', 'timeoutSeconds']);
  exactKeys(value.models.fable, ['command', 'args', 'model', 'effort', 'timeoutSeconds']);
  exactKeys(value.authority, [
    'inspect', 'edit', 'test', 'commit', 'push', 'pullRequest', 'merge', 'deploy',
    'deviceInstall', 'destructive', 'externalTicketCreation', 'jiraAdministration'
  ]);
  exactKeys(value.jira, [
    'enabled', 'siteUrl', 'apiBaseUrl', 'deliveryRecordPath', 'projects',
    'credentialSource', 'staticLabels', 'timeoutMs', 'maxAttempts', 'approvalTtlMs',
    'dryRun', 'nodeMinVersion', 'tracking'
  ]);
  exactArrayObjects(value.jira.projects, ['key', 'issueTypes', 'defaultFields']);
  if (value.jira.credentialSource?.type === 'env') exactKeys(value.jira.credentialSource, ['type', 'emailEnvVar', 'tokenEnvVar']);
  else if (value.jira.credentialSource?.type === 'file') exactKeys(value.jira.credentialSource, ['type', 'path', 'allowInsecurePermissions']);
  else fail('KSTACK_CONFIG_SCHEMA_INVALID');
  exactKeys(value.jira.tracking, ['mode', 'required', 'repositoryNamespace', 'projectKey', 'automaticVersionAssignment', 'releaseVersions']);
  exactArrayObjects(value.jira.tracking.releaseVersions, ['id', 'name', 'releaseDate']);
  exactKeys(value.persistence, ['scope', 'crossSession', 'retainRawModelOutput', 'redactSecrets']);
  exactKeys(value.memory, [
    'enabled', 'retrieval', 'contextInjection', 'engine', 'bodyDirectory',
    'indexDirectory', 'remote', 'namespace', 'trust', 'sync', 'resultLimit',
    'tokenBudget', 'authority'
  ]);
  exactKeys(value.memory.authority, ['createRepository', 'clone', 'fetch', 'integrate', 'commit', 'push', 'resolveConflicts']);
  exactKeys(value.verification, [
    'discoverRepositoryCommands', 'verifyToolchainRuntimeSeparatelyFromTargetCompatibility',
    'requireArtifactIdentity', 'preserveUserData'
  ]);
}

const LEGACY_TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion', 'project', 'workflow', 'models', 'authority', 'jira',
  'persistence', 'memory', 'verification'
]);

export function parseKStackConfigDocument(input) {
  const { bytes, text } = decode(input);
  const value = new DuplicateSafeJsonParser(text).parse();
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('KSTACK_CONFIG_SCHEMA_INVALID');
  if (value.schemaVersion === 1) {
    if (Object.hasOwn(value, 'secretBroker')) fail('KSTACK_SECRET_CONFIG_LEGACY_EXTENSION_FORBIDDEN');
    if (Object.keys(value).some((key) => !LEGACY_TOP_LEVEL_KEYS.includes(key))) fail('KSTACK_CONFIG_SCHEMA_INVALID');
  } else if (value.schemaVersion === 2) {
    exactKeys(value, [...LEGACY_TOP_LEVEL_KEYS, 'secretBroker']);
    assertV2ClosedShape(value);
    if (!hostCanonicalBytes(value).equals(bytes)) fail('KSTACK_CONFIG_V2_NONCANONICAL');
  } else {
    fail('KSTACK_CONFIG_VERSION_UNSUPPORTED');
  }
  projectSecretBrokerConfig(value);
  return value;
}

export function canonicalKStackConfigV2Bytes(value) {
  if (!value || value.schemaVersion !== 2) fail('KSTACK_CONFIG_VERSION_UNSUPPORTED');
  const bytes = hostCanonicalBytes(value);
  if (bytes.length > SECRET_BROKER_CONFIG_MAX_BYTES) fail('KSTACK_CONFIG_BYTES_EXCEEDED');
  parseKStackConfigDocument(bytes);
  return bytes;
}
