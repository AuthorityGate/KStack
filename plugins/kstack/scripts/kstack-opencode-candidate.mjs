import crypto from 'node:crypto';
import {
  HOST_PACKAGE_DOMAINS,
  addressObject as addressHostObject,
  canonicalJson,
  rawDigest,
  validatePortableRelativePath
} from './kstack-host-package.mjs';
import { validateInstallerProfile } from './kstack-host-installer.mjs';

export const OPENCODE_CANDIDATE_DOMAINS = Object.freeze({
  packagingEvidence: 'KSTACK-OPENCODE-PACKAGING-EVIDENCE-V1',
  instructionContentEvidence: 'KSTACK-INSTRUCTION-ONLY-CONTENT-EVIDENCE-V1',
  candidateStatus: 'KSTACK-CANDIDATE-STATUS-V1',
  discoveryObservation: 'KSTACK-OPENCODE-DISCOVERY-OBSERVATION-V1',
  canonicalMemberInventory: 'KSTACK-OPENCODE-CANONICAL-MEMBER-INVENTORY-V1',
  resourceDependencyGraph: 'KSTACK-OPENCODE-RESOURCE-DEPENDENCY-GRAPH-V1',
  dependencyClosure: 'KSTACK-OPENCODE-DEPENDENCY-CLOSURE-V1',
  fixtureFacts: 'KSTACK-OPENCODE-FIXTURE-FACTS-V1',
  tokenCommitment: 'KSTACK-OPENCODE-TOKEN-COMMITMENT-V1',
  pairCommitment: 'KSTACK-OPENCODE-PAIR-COMMITMENT-V1',
  challengeGenerationReceipt: 'KSTACK-OPENCODE-CHALLENGE-GENERATION-RECEIPT-V1',
  randomizedOrderEvidence: 'KSTACK-OPENCODE-RANDOMIZED-ORDER-EVIDENCE-V1',
  typedOutput: 'KSTACK-OPENCODE-TYPED-OUTPUT-V1',
  revealRecord: 'KSTACK-OPENCODE-REVEAL-RECORD-V1',
  variantRender: 'KSTACK-OPENCODE-VARIANT-RENDER-V1',
  variantDifferenceEvidence: 'KSTACK-OPENCODE-VARIANT-DIFFERENCE-EVIDENCE-V1',
  projectionBinding: 'KSTACK-OPENCODE-PROJECTION-BINDING-V1',
  reuseProvenance: 'KSTACK-OPENCODE-REUSE-PROVENANCE-V1'
});

export const CANDIDATE_STATES = Object.freeze([
  'DECLARED',
  'RENDERABLE_CANDIDATE',
  'INSTALLABLE_CANDIDATE',
  'INSTALLED_CANDIDATE',
  'DISCOVERY_OBSERVED_INSTRUCTION_ONLY',
  'CANDIDATE_INVALIDATED'
]);

export const CONTENT_REASON_CODES = Object.freeze([
  'ALLOWLIST_MISMATCH',
  'DEPENDENCY_INCOMPLETE',
  'DEPENDENCY_UNSAFE',
  'EVIDENCE_AMBIGUOUS',
  'FORBIDDEN_INSTRUCTION',
  'FORBIDDEN_MARKUP',
  'FORBIDDEN_MEMBER_ROLE',
  'LINTER_FAILED',
  'REVIEW_FAILED'
]);

export const DISCOVERY_REASON_CODES = Object.freeze([
  'ADJUDICATION_AMBIGUOUS',
  'COMMITMENT_INVALID',
  'CONTROL_MISSING',
  'EFFECT_ATTEMPTED',
  'EXTRA_OUTPUT',
  'HOST_FACT_CHANGED',
  'OUTPUT_MISMATCH',
  'PACKAGE_DIFFERENCE_INVALID',
  'PAIR_BINDING_MISMATCH',
  'TOKEN_DISCLOSED'
]);

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const PUBLIC_IDENTIFIER = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SAFE_CLASSES = Object.freeze(['ADVISORY', 'DISCOVERY', 'READ_ONLY']);
const OPERATION_CLASSES = Object.freeze(['ADVISORY', 'ASK', 'CREDENTIAL', 'DISCOVERY', 'EXTERNAL', 'INSTALL', 'MUTABLE', 'PROCESS_CONTROL', 'READ_ONLY']);
const CONTENT_OUTCOMES = Object.freeze(['AMBIGUOUS', 'FAIL', 'PASS']);
const EVIDENCE_UNAVAILABLE = Object.freeze(['CANDIDATE_INVALIDATED', 'DEPENDENCY_FAILED', 'FACT_STALE', 'FACT_UNVERIFIED', 'STATE_NOT_REACHED']);
const INVALIDATION_REASONS = Object.freeze(['BUILD_CHANGED', 'CONFIG_CHANGED', 'EVIDENCE_FAILED', 'EVIDENCE_STALE', 'EXPIRY_REACHED', 'INSTALL_CHANGED', 'REGISTRY_CHANGED', 'RENDER_CHANGED', 'SOURCE_CHANGED']);
const REF_NAMES = Object.freeze(['packagingEvidence', 'projectionPlan', 'renderBundle', 'installerProfile', 'installReceipt', 'discoveryObservation']);
const REQUIRED_REF_COUNT = Object.freeze({ DECLARED: 0, RENDERABLE_CANDIDATE: 3, INSTALLABLE_CANDIDATE: 4, INSTALLED_CANDIDATE: 5, DISCOVERY_OBSERVED_INSTRUCTION_ONLY: 6 });
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  throw error;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function plain(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  return value;
}

function exact(value, keys, code) {
  plain(value, code);
  const actual = Object.keys(value).sort(compareUtf8);
  const expected = [...keys].sort(compareUtf8);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code, 'closed schema mismatch');
  return value;
}

function text(value, code, maximum = 4096) {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > maximum || value.normalize('NFC') !== value || /[\u0000\r]/u.test(value)) fail(code);
  return value;
}

function id(value, code) {
  text(value, code, 128);
  if (!ID.test(value)) fail(code);
  return value;
}

function digest(value, code) {
  if (typeof value !== 'string' || !DIGEST.test(value)) fail(code);
  return value;
}

function nullableDigest(value, code) {
  if (value !== null) digest(value, code);
  return value;
}

function bool(value, code) {
  if (typeof value !== 'boolean') fail(code);
  return value;
}

function oneOf(value, values, code) {
  if (!values.includes(value)) fail(code);
  return value;
}

function sortedUnique(values, code, validator = (value) => text(value, code), { nonempty = false } = {}) {
  if (!Array.isArray(values) || (nonempty && values.length === 0)) fail(code);
  const result = values.map(validator);
  const sorted = [...result].sort(compareUtf8);
  if (new Set(result).size !== result.length || result.some((value, index) => value !== sorted[index])) fail(code, 'set is not canonical');
  return result;
}

function timestamp(value, code, nullable = false) {
  if (nullable && value === null) return value;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) fail(code);
  return value;
}

export function validateDestinationRootFact(value) {
  const code = 'KSTACK_OPENCODE_DESTINATION_ROOT_FACT_INVALID';
  text(value, code, 240);
  if (value.includes('\\') || value.startsWith('/') || /^[A-Za-z]:/u.test(value) || /^[a-z][a-z0-9+.-]*:/iu.test(value)) fail(code);
  const segments = value.split('/');
  if (segments.some((segment) => !/^(?:\.?[A-Za-z0-9][A-Za-z0-9._-]{0,62})$/u.test(segment)
      || segment === '.' || segment === '..' || /[. ]$/u.test(segment) || WINDOWS_DEVICE.test(segment))) fail(code);
  return value;
}

function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}

function address(domain, value) {
  if (!Object.values(OPENCODE_CANDIDATE_DOMAINS).includes(domain)) fail('KSTACK_OPENCODE_DIGEST_DOMAIN_INVALID');
  return rawDigest(Buffer.concat([Buffer.from(domain, 'utf8'), Buffer.from([0]), Buffer.from(canonicalJson(value), 'utf8')]));
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function validateOpenCodePackagingEvidence(input, options = {}) {
  const code = 'KSTACK_OPENCODE_PACKAGING_EVIDENCE_INVALID';
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'targetId', 'officialSourceDigests', 'observedHostBuildDigest', 'observedLiveConfigDigest', 'userSkillRootFact', 'projectSkillRootFact', 'entryFilenameFact', 'invocationSyntaxFact', 'metadataFactSchemaDigest', 'observationEvidenceDigests', 'currentnessEvidenceDigest', 'expiresAtUtc'], code);
  if (input.schemaId !== 'kstack.opencode-packaging-evidence.v1' || input.schemaVersion !== 1 || input.targetId !== 'opencode') fail(code);
  for (const key of ['registrySetDigest', 'observedHostBuildDigest', 'observedLiveConfigDigest', 'currentnessEvidenceDigest']) digest(input[key], code);
  sortedUnique(input.officialSourceDigests, code, (value) => digest(value, code), { nonempty: true });
  sortedUnique(input.observationEvidenceDigests, code, (value) => digest(value, code), { nonempty: true });
  if (input.officialSourceDigests.some((value) => input.observationEvidenceDigests.includes(value))
      || input.observedHostBuildDigest === input.observedLiveConfigDigest) fail(code, 'evidence domains alias');
  for (const key of ['userSkillRootFact', 'projectSkillRootFact']) if (input[key] !== null) {
    try { validateDestinationRootFact(input[key]); } catch { fail(code, key); }
  }
  if (input.entryFilenameFact !== null && input.entryFilenameFact !== 'SKILL.md') fail(code);
  if (input.invocationSyntaxFact !== null && (typeof input.invocationSyntaxFact !== 'string' || Buffer.byteLength(input.invocationSyntaxFact, 'utf8') > 64 || !PUBLIC_IDENTIFIER.test(input.invocationSyntaxFact))) fail(code);
  nullableDigest(input.metadataFactSchemaDigest, code);
  timestamp(input.expiresAtUtc, code);
  if (options.requireCurrent !== false && Date.parse(input.expiresAtUtc) <= (options.now?.getTime?.() ?? Date.now())) fail('KSTACK_OPENCODE_PACKAGING_EVIDENCE_STALE');
  const body = immutable(input);
  return immutable({ evidence: body, packagingEvidenceDigest: address(OPENCODE_CANDIDATE_DOMAINS.packagingEvidence, body) });
}

export function requireRenderablePackagingEvidence(input, options = {}) {
  const validated = validateOpenCodePackagingEvidence(input, options);
  if (input.userSkillRootFact === null && input.projectSkillRootFact === null) fail('KSTACK_OPENCODE_PACKAGING_FACT_UNVERIFIED', 'skill root');
  if (input.entryFilenameFact === null || input.invocationSyntaxFact === null) fail('KSTACK_OPENCODE_PACKAGING_FACT_UNVERIFIED', 'entry or invocation');
  return validated;
}

export function createCanonicalMemberBinding(input) {
  const code = 'KSTACK_OPENCODE_MEMBER_BINDING_INVALID';
  exact(input, ['path', 'memberDigest', 'memberRole', 'clauseId', 'operationRoots', 'resourceDependencyIds'], code);
  validatePortableRelativePath(input.path); digest(input.memberDigest, code);
  oneOf(input.memberRole, ['MODEL_VISIBLE_MARKDOWN', 'UNSUPPORTED_STUB'], code);
  if (input.clauseId !== null) id(input.clauseId, code);
  sortedUnique(input.operationRoots, code, (value) => id(value, code));
  sortedUnique(input.resourceDependencyIds, code, (value) => id(value, code));
  const binding = immutable(input);
  return immutable({ binding, canonicalMemberInventoryDigest: address(OPENCODE_CANDIDATE_DOMAINS.canonicalMemberInventory, binding) });
}

export function createResourceDependencyGraph(input) {
  const code = 'KSTACK_OPENCODE_DEPENDENCY_GRAPH_INVALID';
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'nodes', 'edges', 'resources', 'resourceEdges'], code);
  if (input.schemaId !== 'kstack.opencode-resource-dependency-graph.v1' || input.schemaVersion !== 1) fail(code);
  digest(input.registrySetDigest, code);
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges) || !Array.isArray(input.resourceEdges)) fail(code);
  let prior = null;
  for (const node of input.nodes) {
    exact(node, ['operationId', 'class'], code); id(node.operationId, code); oneOf(node.class, OPERATION_CLASSES, code);
    if (prior !== null && compareUtf8(prior, node.operationId) >= 0) fail(code); prior = node.operationId;
  }
  const operationIds = new Set(input.nodes.map((node) => node.operationId));
  sortedUnique(input.resources, code, (value) => id(value, code));
  const resourceIds = new Set(input.resources);
  prior = null;
  for (const edge of input.edges) {
    exact(edge, ['from', 'to', 'kind'], code); id(edge.from, code); id(edge.to, code); id(edge.kind, code);
    if (!operationIds.has(edge.from) || !operationIds.has(edge.to)) fail(code);
    const key = `${edge.from}\0${edge.to}\0${edge.kind}`;
    if (prior !== null && compareUtf8(prior, key) >= 0) fail(code); prior = key;
  }
  prior = null;
  for (const edge of input.resourceEdges) {
    exact(edge, ['fromResourceId', 'toType', 'toId', 'kind'], code); id(edge.fromResourceId, code); id(edge.toId, code); id(edge.kind, code);
    oneOf(edge.toType, ['OPERATION', 'RESOURCE'], code);
    if (!resourceIds.has(edge.fromResourceId) || (edge.toType === 'OPERATION' ? !operationIds.has(edge.toId) : !resourceIds.has(edge.toId))) fail(code);
    const key = `${edge.fromResourceId}\0${edge.toType}\0${edge.toId}\0${edge.kind}`;
    if (prior !== null && compareUtf8(prior, key) >= 0) fail(code); prior = key;
  }
  const graph = immutable(input);
  return immutable({ graph, resourceDependencyGraphDigest: address(OPENCODE_CANDIDATE_DOMAINS.resourceDependencyGraph, graph) });
}

function deriveClosure(memberBinding, graph) {
  const roots = new Set(memberBinding.operationRoots);
  const pendingResources = [...memberBinding.resourceDependencyIds]; const visitedResources = new Set();
  for (const resourceId of pendingResources) if (!graph.resources.includes(resourceId)) fail('KSTACK_OPENCODE_DEPENDENCY_INCOMPLETE');
  while (pendingResources.length > 0) {
    const resourceId = pendingResources.shift();
    if (visitedResources.has(resourceId)) continue;
    visitedResources.add(resourceId);
    const outgoing = graph.resourceEdges.filter((row) => row.fromResourceId === resourceId);
    if (outgoing.length === 0) fail('KSTACK_OPENCODE_DEPENDENCY_INCOMPLETE');
    for (const edge of outgoing) {
      if (edge.toType === 'OPERATION') roots.add(edge.toId);
      else pendingResources.push(edge.toId);
    }
  }
  const reachable = new Set(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of graph.edges.filter((row) => row.from === current)) if (!reachable.has(edge.to)) { reachable.add(edge.to); queue.push(edge.to); }
  }
  const orderedRoots = [...roots].sort(compareUtf8);
  const nodes = graph.nodes.filter((row) => reachable.has(row.operationId));
  if (nodes.length !== reachable.size) fail('KSTACK_OPENCODE_DEPENDENCY_INCOMPLETE');
  const edges = graph.edges.filter((row) => reachable.has(row.from) && reachable.has(row.to)).map(({ from, to, kind }) => ({ from, to, kind }));
  const closureBody = { roots: orderedRoots, nodes, edges };
  return { ...closureBody, closureDigest: address(OPENCODE_CANDIDATE_DOMAINS.dependencyClosure, closureBody) };
}

export function lintInstructionOnlyMarkdown(memberBytes, memberRole = 'MODEL_VISIBLE_MARKDOWN') {
  const code = 'KSTACK_OPENCODE_CONTENT_BYTES_INVALID';
  const bytes = Buffer.from(memberBytes);
  if (bytes.length === 0 || bytes.length > 64 * 1024) fail(code);
  let source;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail(code); }
  if (source.normalize('NFC') !== source || source.includes('\r') || source.includes('\u0000')) fail(code);
  const findings = [];
  const add = (value) => { if (!findings.includes(value)) findings.push(value); };
  if (memberRole === 'UNSUPPORTED_STUB') {
    if (!/^UNSUPPORTED: [A-Z][A-Z0-9_]{2,63}\.\n$/u.test(source)) add('FORBIDDEN_INSTRUCTION');
  } else {
    if (/```|~~~|\[[^\]]*\]\(|<\/?[A-Za-z]|<[a-z][a-z0-9+.-]*:|https?:\/\//iu.test(source)) add('FORBIDDEN_MARKUP');
    if (/(?:^|[\s`])(?:\.\.?\/|\/[A-Za-z0-9]|[A-Za-z]:\\)|\.(?:bat|cmd|exe|js|mjs|ps1|py|sh)\b/imu.test(source)) add('FORBIDDEN_INSTRUCTION');
    if (/\b(?:run|execute|invoke|call|launch|spawn|install|write|edit|modify|delete|remove|create|commit|push|deploy|release|upload|download|fetch|connect|login|authenticate|approve|authorize|bypass|grant|ignore|disregard|override|jailbreak)\b/iu.test(source)) add('FORBIDDEN_INSTRUCTION');
    if (/\b(?:shell|terminal|command|script|interpreter|tool|plugin|mcp|subagent|model|credential|password|secret|token|network|jira|provider|filesystem|file system)\b/iu.test(source)) add('FORBIDDEN_INSTRUCTION');
    if (/\$\(|`[^`]+`|(?:^|\n)\s*(?:\$|>|#)\s+|&&|\|\||;\s*(?:curl|wget|git|npm|node|python|bash|sh)\b/iu.test(source)) add('FORBIDDEN_INSTRUCTION');
  }
  findings.sort(compareUtf8);
  return immutable({ outcome: findings.length === 0 ? 'PASS' : 'FAIL', reasonCodes: findings, sourceDigest: rawDigest(bytes) });
}

function validateDependencyClosure(input, code) {
  exact(input, ['roots', 'nodes', 'edges', 'closureDigest'], code);
  sortedUnique(input.roots, code, (value) => id(value, code));
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) fail(code);
  let prior = null;
  for (const node of input.nodes) {
    exact(node, ['operationId', 'class'], code); id(node.operationId, code); oneOf(node.class, SAFE_CLASSES, code);
    if (prior !== null && compareUtf8(prior, node.operationId) >= 0) fail(code); prior = node.operationId;
  }
  prior = null;
  for (const edge of input.edges) {
    exact(edge, ['from', 'to', 'kind'], code); id(edge.from, code); id(edge.to, code); id(edge.kind, code);
    const key = `${edge.from}\0${edge.to}\0${edge.kind}`;
    if (prior !== null && compareUtf8(prior, key) >= 0) fail(code); prior = key;
  }
  digest(input.closureDigest, code);
}

function validateAutomatedContentReview(input, code) {
  exact(input, ['implementationDigest', 'configDigest', 'allowlistDigest', 'markdownParserDigest', 'outcome', 'findingDigests'], code);
  for (const key of ['implementationDigest', 'configDigest', 'allowlistDigest', 'markdownParserDigest']) digest(input[key], code);
  oneOf(input.outcome, CONTENT_OUTCOMES, code);
  sortedUnique(input.findingDigests, code, (value) => digest(value, code));
  if ((input.outcome === 'PASS') !== (input.findingDigests.length === 0)) fail(code);
}

function validateIndependentContentReview(input, code) {
  exact(input, ['reviewerClass', 'modelConfigDigest', 'promptPacketDigest', 'resultDigest', 'outcome', 'findingDigests'], code);
  if (input.reviewerClass !== 'INDEPENDENT_CODEX') fail(code);
  for (const key of ['modelConfigDigest', 'promptPacketDigest', 'resultDigest']) digest(input[key], code);
  oneOf(input.outcome, CONTENT_OUTCOMES, code);
  sortedUnique(input.findingDigests, code, (value) => digest(value, code));
  if ((input.outcome === 'PASS') !== (input.findingDigests.length === 0)) fail(code);
}

export function validateInstructionOnlyContentEvidence({ evidence, memberBytes, memberBinding, dependencyGraph }) {
  const code = 'KSTACK_OPENCODE_CONTENT_EVIDENCE_INVALID';
  exact(evidence, ['schemaId', 'schemaVersion', 'registrySetDigest', 'sourceBundleDigest', 'renderBundleDigest', 'memberPath', 'memberDigest', 'clauseId', 'memberRole', 'canonicalMemberInventoryDigest', 'resourceDependencyGraphDigest', 'dependencyClosure', 'linter', 'independentReview', 'overall', 'reasonCodes'], code);
  if (evidence.schemaId !== 'kstack.instruction-only-content-evidence.v1' || evidence.schemaVersion !== 1) fail(code);
  for (const key of ['registrySetDigest', 'sourceBundleDigest', 'renderBundleDigest', 'memberDigest', 'canonicalMemberInventoryDigest', 'resourceDependencyGraphDigest']) digest(evidence[key], code);
  validatePortableRelativePath(evidence.memberPath); if (evidence.clauseId !== null) id(evidence.clauseId, code);
  oneOf(evidence.memberRole, ['MODEL_VISIBLE_MARKDOWN', 'UNSUPPORTED_STUB'], code);
  validateDependencyClosure(evidence.dependencyClosure, code); validateAutomatedContentReview(evidence.linter, code); validateIndependentContentReview(evidence.independentReview, code);
  oneOf(evidence.overall, CONTENT_OUTCOMES, code); sortedUnique(evidence.reasonCodes, code, (value) => oneOf(value, CONTENT_REASON_CODES, code));

  const boundMember = createCanonicalMemberBinding(memberBinding);
  const boundGraph = createResourceDependencyGraph(dependencyGraph);
  const actualClosure = deriveClosure(boundMember.binding, boundGraph.graph);
  const lint = lintInstructionOnlyMarkdown(memberBytes, evidence.memberRole);
  const identitiesMatch = evidence.memberPath === memberBinding.path && evidence.memberDigest === rawDigest(memberBytes)
    && evidence.memberDigest === memberBinding.memberDigest && evidence.memberRole === memberBinding.memberRole
    && evidence.clauseId === memberBinding.clauseId && evidence.canonicalMemberInventoryDigest === boundMember.canonicalMemberInventoryDigest
    && evidence.resourceDependencyGraphDigest === boundGraph.resourceDependencyGraphDigest
    && evidence.registrySetDigest === dependencyGraph.registrySetDigest && same(evidence.dependencyClosure, actualClosure);
  const passes = identitiesMatch && lint.outcome === 'PASS' && evidence.linter.outcome === 'PASS'
    && evidence.independentReview.outcome === 'PASS' && evidence.reasonCodes.length === 0;
  if (passes !== (evidence.overall === 'PASS')) fail(code, `overall does not match executable gates identity=${identitiesMatch} lint=${lint.outcome} declaredLinter=${evidence.linter.outcome} review=${evidence.independentReview.outcome} reasons=${evidence.reasonCodes.length}`);
  if (!passes) fail(code, 'content is not admissible');
  const body = immutable(evidence);
  return immutable({ evidence: body, instructionOnlyContentEvidenceDigest: address(OPENCODE_CANDIDATE_DOMAINS.instructionContentEvidence, body) });
}

function validateEvidenceRef(input, code) {
  exact(input, ['digest', 'unavailableReason'], code);
  nullableDigest(input.digest, code);
  if (input.unavailableReason !== null) oneOf(input.unavailableReason, EVIDENCE_UNAVAILABLE, code);
  if ((input.digest === null) === (input.unavailableReason === null)) fail(code, 'reference must have exactly one value');
}

export function validateOpenCodeProjectionBinding(input) {
  const code = 'KSTACK_OPENCODE_PROJECTION_BINDING_INVALID';
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'sourceBundleDigest', 'projectionPlanDigest', 'renderBundleDigest', 'packagingEvidenceDigest', 'observedHostBuildDigest', 'observedLiveConfigDigest', 'metadataFactSchemaDigest', 'destinationTemplateId', 'scope', 'instructionOnlyContentEvidenceDigests', 'installerProfileDigest', 'maximumClaim'], code);
  if (input.schemaId !== 'kstack.opencode-projection-binding.v1' || input.schemaVersion !== 1 || input.maximumClaim !== 'NO_OPERATION_QUALIFICATION') fail(code);
  for (const key of ['registrySetDigest', 'sourceBundleDigest', 'projectionPlanDigest', 'renderBundleDigest', 'packagingEvidenceDigest', 'observedHostBuildDigest', 'observedLiveConfigDigest', 'metadataFactSchemaDigest']) digest(input[key], code);
  id(input.destinationTemplateId, code); oneOf(input.scope, ['PROJECT', 'USER'], code);
  sortedUnique(input.instructionOnlyContentEvidenceDigests, code, (value) => digest(value, code), { nonempty: true });
  nullableDigest(input.installerProfileDigest, code);
  const binding = immutable(input);
  return immutable({ projectionBinding: binding, projectionBindingDigest: address(OPENCODE_CANDIDATE_DOMAINS.projectionBinding, binding) });
}

function validateCandidateStatusBody(input, code) {
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'targetId', 'runningHostBuildDigest', 'liveConfigDigest', 'currentnessEvidenceDigest', 'expiresAtUtc', 'previousStatusBodyDigest', 'state', 'maximumClaim', 'invalidationReason', 'changedFactEvidenceDigest', 'refs'], code);
  if (input.schemaId !== 'kstack.candidate-status.v1' || input.schemaVersion !== 1 || input.targetId !== 'opencode' || input.maximumClaim !== 'NO_OPERATION_QUALIFICATION') fail(code);
  for (const key of ['registrySetDigest', 'runningHostBuildDigest', 'liveConfigDigest', 'currentnessEvidenceDigest']) digest(input[key], code);
  timestamp(input.expiresAtUtc, code, true); nullableDigest(input.previousStatusBodyDigest, code); nullableDigest(input.changedFactEvidenceDigest, code);
  oneOf(input.state, CANDIDATE_STATES, code); if (input.invalidationReason !== null) oneOf(input.invalidationReason, INVALIDATION_REASONS, code);
  exact(input.refs, REF_NAMES, code); for (const name of REF_NAMES) validateEvidenceRef(input.refs[name], code);
  return input;
}

export function validateCandidateStatus(input, options = {}) {
  const code = 'KSTACK_OPENCODE_CANDIDATE_STATUS_INVALID';
  validateCandidateStatusBody(input, code);
  const previousEnvelope = options.previousStatus ?? null;
  const previous = previousEnvelope?.status ?? previousEnvelope;
  if (input.state === 'DECLARED') {
    if (input.previousStatusBodyDigest !== null || input.invalidationReason !== null || input.changedFactEvidenceDigest !== null) fail(code);
    if (REF_NAMES.some((name) => input.refs[name].digest !== null || input.refs[name].unavailableReason !== 'STATE_NOT_REACHED')) fail(code);
  } else {
    if (!previous) fail(code, 'previous status required');
    validateCandidateStatusBody(previous, code);
    const previousDigest = previousEnvelope?.statusBodyDigest ?? address(OPENCODE_CANDIDATE_DOMAINS.candidateStatus, previous);
    if (input.previousStatusBodyDigest !== previousDigest) fail(code, 'previous digest mismatch');
    if (previous.targetId !== input.targetId || previous.registrySetDigest !== input.registrySetDigest) fail(code, 'chain identity mismatch');
    if (input.state === 'CANDIDATE_INVALIDATED') {
      if (!['RENDERABLE_CANDIDATE', 'INSTALLABLE_CANDIDATE', 'INSTALLED_CANDIDATE', 'DISCOVERY_OBSERVED_INSTRUCTION_ONLY'].includes(previous.state)
          || input.invalidationReason === null || input.changedFactEvidenceDigest === null || !same(input.refs, previous.refs)) fail(code);
    } else {
      const expected = CANDIDATE_STATES[CANDIDATE_STATES.indexOf(previous.state) + 1];
      if (input.state !== expected || input.invalidationReason !== null || input.changedFactEvidenceDigest !== null) fail(code);
      const required = REQUIRED_REF_COUNT[input.state];
      for (let index = 0; index < REF_NAMES.length; index += 1) {
        const ref = input.refs[REF_NAMES[index]];
        if (index < required ? ref.digest === null : ref.digest !== null || ref.unavailableReason !== 'STATE_NOT_REACHED') fail(code, 'state reference matrix');
      }
      for (let index = 0; index < REQUIRED_REF_COUNT[previous.state]; index += 1) if (!same(input.refs[REF_NAMES[index]], previous.refs[REF_NAMES[index]])) fail(code, 'prior reference drift');
    }
  }
  if (input.state !== 'CANDIDATE_INVALIDATED' && !options.allowExpired && input.expiresAtUtc !== null && Date.parse(input.expiresAtUtc) <= (options.now?.getTime?.() ?? Date.now())) fail('KSTACK_OPENCODE_CANDIDATE_STATUS_EXPIRED');
  if (!['DECLARED', 'CANDIDATE_INVALIDATED'].includes(input.state)) {
    const packagingEnvelope = options.packagingEvidence ? validateOpenCodePackagingEvidence(options.packagingEvidence, { now: options.now, requireCurrent: !options.allowExpired }) : null;
    const bindingEnvelope = options.projectionBinding?.projectionBinding ? options.projectionBinding : options.projectionBinding ? validateOpenCodeProjectionBinding(options.projectionBinding) : null;
    const binding = bindingEnvelope?.projectionBinding;
    if (!packagingEnvelope || !binding
        || packagingEnvelope.packagingEvidenceDigest !== input.refs.packagingEvidence.digest
        || packagingEnvelope.packagingEvidenceDigest !== binding.packagingEvidenceDigest
        || bindingEnvelope.projectionBindingDigest !== address(OPENCODE_CANDIDATE_DOMAINS.projectionBinding, binding)
        || binding.registrySetDigest !== input.registrySetDigest || binding.observedHostBuildDigest !== input.runningHostBuildDigest
        || binding.observedLiveConfigDigest !== input.liveConfigDigest || options.packagingEvidence.currentnessEvidenceDigest !== input.currentnessEvidenceDigest
        || options.packagingEvidence.expiresAtUtc !== input.expiresAtUtc || binding.projectionPlanDigest !== input.refs.projectionPlan.digest
        || binding.renderBundleDigest !== input.refs.renderBundle.digest) fail(code, 'candidate evidence binding');
    if (['INSTALLABLE_CANDIDATE', 'INSTALLED_CANDIDATE', 'DISCOVERY_OBSERVED_INSTRUCTION_ONLY'].includes(input.state)
        && (binding.installerProfileDigest === null || binding.installerProfileDigest !== input.refs.installerProfile.digest)) fail(code, 'installer evidence binding');
  }
  if (input.state === 'DISCOVERY_OBSERVED_INSTRUCTION_ONLY') {
    const observationEnvelope = options.observation;
    const observation = observationEnvelope?.observation;
    if (!observation || observation.outcome !== 'OBSERVED'
        || observationEnvelope.discoveryObservationDigest !== address(OPENCODE_CANDIDATE_DOMAINS.discoveryObservation, observation)
        || observationEnvelope.discoveryObservationDigest !== input.refs.discoveryObservation.digest) fail(code, 'discovery observation');
  }
  const body = immutable(input);
  return immutable({ status: body, statusBodyDigest: address(OPENCODE_CANDIDATE_DOMAINS.candidateStatus, body) });
}

export function createCandidateStatus(input, options = {}) {
  return validateCandidateStatus({ schemaId: 'kstack.candidate-status.v1', schemaVersion: 1, ...input }, options);
}

export function renderCandidateStatus(statusInput, options = {}) {
  const validated = validateCandidateStatus(statusInput, options);
  const refs = REF_NAMES.map((name) => `${name}=${statusInput.refs[name].digest ?? statusInput.refs[name].unavailableReason}`).join('\n');
  return `target=opencode\nstate=${statusInput.state}\nmaximumClaim=NO_OPERATION_QUALIFICATION\nregistrySetDigest=${statusInput.registrySetDigest}\nrunningHostBuildDigest=${statusInput.runningHostBuildDigest}\nliveConfigDigest=${statusInput.liveConfigDigest}\ncurrentnessEvidenceDigest=${statusInput.currentnessEvidenceDigest}\nstatusBodyDigest=${validated.statusBodyDigest}\n${refs}\n`;
}

function tokenCommitment(token) {
  if (!Buffer.isBuffer(token) || token.length !== 32) fail('KSTACK_OPENCODE_CHALLENGE_INVALID');
  return rawDigest(Buffer.concat([Buffer.from(OPENCODE_CANDIDATE_DOMAINS.tokenCommitment), Buffer.from([0]), token]));
}

function random32(randomSource) {
  const value = Buffer.from(randomSource(32));
  if (value.length !== 32) fail('KSTACK_OPENCODE_CHALLENGE_RANDOM_INVALID');
  return value;
}

export function createDiscoveryChallengePair(input, options = {}) {
  const code = 'KSTACK_OPENCODE_CHALLENGE_INVALID';
  exact(input, ['registrySetDigest', 'baseRenderBundleDigest', 'fixtureId', 'fixturePrompt', 'challengeClauseSchemaDigest'], code);
  digest(input.registrySetDigest, code); digest(input.baseRenderBundleDigest, code); id(input.fixtureId, code); digest(input.challengeClauseSchemaDigest, code);
  text(input.fixturePrompt, code, 512);
  if (!input.fixturePrompt.includes(input.fixtureId) || /sha256:[0-9a-f]{64}|[0-9a-f]{64}/u.test(input.fixturePrompt)) fail(code, 'prompt identity or token leakage');
  const randomSource = options.randomBytes ?? crypto.randomBytes;
  const treatmentToken = random32(randomSource); const controlToken = random32(randomSource); const orderSeed = random32(randomSource);
  if (treatmentToken.equals(controlToken)) fail('KSTACK_OPENCODE_CHALLENGE_RANDOM_INVALID');
  const treatmentTokenCommitmentDigest = tokenCommitment(treatmentToken);
  const controlTokenCommitmentDigest = tokenCommitment(controlToken);
  const fixturePromptDigest = rawDigest(input.fixturePrompt);
  const fixtureFacts = {
    schemaId: 'kstack.opencode-fixture-facts.v1', schemaVersion: 1, fixtureId: input.fixtureId,
    fixturePromptDigest, baseRenderBundleDigest: input.baseRenderBundleDigest,
    challengeClauseSchemaDigest: input.challengeClauseSchemaDigest,
    variants: ['CONTROL', 'TREATMENT'], tokensAbsentOutsideProtectedClause: true
  };
  const fixtureFactsDigest = address(OPENCODE_CANDIDATE_DOMAINS.fixtureFacts, fixtureFacts);
  const order = (orderSeed[0] & 1) === 0 ? ['CONTROL', 'TREATMENT'] : ['TREATMENT', 'CONTROL'];
  const randomizedOrder = { schemaId: 'kstack.opencode-randomized-order.v1', schemaVersion: 1, fixtureFactsDigest, order, orderSeedCommitmentDigest: tokenCommitment(orderSeed) };
  const randomizedOrderEvidenceDigest = address(OPENCODE_CANDIDATE_DOMAINS.randomizedOrderEvidence, randomizedOrder);
  const pair = {
    schemaId: 'kstack.opencode-challenge-pair.v1', schemaVersion: 1, registrySetDigest: input.registrySetDigest,
    baseRenderBundleDigest: input.baseRenderBundleDigest, fixtureId: input.fixtureId, fixtureFactsDigest, fixturePromptDigest,
    treatmentTokenCommitmentDigest, controlTokenCommitmentDigest, randomizedOrderEvidenceDigest
  };
  const pairCommitmentDigest = address(OPENCODE_CANDIDATE_DOMAINS.pairCommitment, pair);
  const generationReceipt = { schemaId: 'kstack.opencode-challenge-generation-receipt.v1', schemaVersion: 1, pairCommitmentDigest, treatmentTokenCommitmentDigest, controlTokenCommitmentDigest, tokensProtected: true, commitmentsRecordedBeforeRender: true };
  const challengeGenerationReceiptDigest = address(OPENCODE_CANDIDATE_DOMAINS.challengeGenerationReceipt, generationReceipt);
  return {
    publicChallenge: immutable({ ...pair, pairCommitmentDigest, challengeGenerationReceiptDigest, randomizedOrder, fixtureFacts, fixturePrompt: input.fixturePrompt }),
    protectedTokens: { treatmentToken, controlToken, orderSeed }
  };
}

function canonicalMemberBytes(input, code) {
  plain(input, code);
  const paths = Object.keys(input).sort(compareUtf8);
  if (paths.length === 0 || Object.keys(input).some((value, index) => value !== paths[index])) fail(code, 'member map order');
  return paths.map((path) => {
    validatePortableRelativePath(path);
    const bytes = Buffer.from(input[path]);
    if (bytes.length === 0 || bytes.length > 64 * 1024) fail(code, 'member bounds');
    return { path, byteLength: String(bytes.length), contentDigest: rawDigest(bytes) };
  });
}

export function verifyDiscoveryVariantDifference(input) {
  const code = 'KSTACK_OPENCODE_VARIANT_DIFFERENCE_INVALID';
  exact(input, ['fixtureId', 'fixtureFactsDigest', 'baseMemberBytes', 'treatmentMemberBytes', 'controlMemberBytes', 'challengeMemberPath', 'treatmentToken', 'controlToken'], code);
  id(input.fixtureId, code); digest(input.fixtureFactsDigest, code); validatePortableRelativePath(input.challengeMemberPath);
  if (!Buffer.isBuffer(input.treatmentToken) || !Buffer.isBuffer(input.controlToken) || input.treatmentToken.length !== 32 || input.controlToken.length !== 32 || input.treatmentToken.equals(input.controlToken)) fail(code);
  const baseMembers = canonicalMemberBytes(input.baseMemberBytes, code);
  const treatmentMembers = canonicalMemberBytes(input.treatmentMemberBytes, code);
  const controlMembers = canonicalMemberBytes(input.controlMemberBytes, code);
  if (!same(baseMembers.map((row) => row.path), treatmentMembers.map((row) => row.path)) || !same(baseMembers.map((row) => row.path), controlMembers.map((row) => row.path))) fail(code, 'member paths');
  const treatmentClause = Buffer.from(`\nObservation fixture ${input.fixtureId}: return only ${input.treatmentToken.toString('hex')}.\n`, 'utf8');
  const controlClause = Buffer.from(`\nObservation fixture ${input.fixtureId}: return only ${input.controlToken.toString('hex')}.\n`, 'utf8');
  for (const { path } of baseMembers) {
    const base = Buffer.from(input.baseMemberBytes[path]); const treatment = Buffer.from(input.treatmentMemberBytes[path]); const control = Buffer.from(input.controlMemberBytes[path]);
    if (path === input.challengeMemberPath) {
      if (!treatment.equals(Buffer.concat([base, treatmentClause])) || !control.equals(Buffer.concat([base, controlClause]))) fail(code, 'challenge clause mismatch');
    } else if (!treatment.equals(base) || !control.equals(base)) fail(code, 'unexpected package difference');
  }
  if (!baseMembers.some((row) => row.path === input.challengeMemberPath)) fail(code, 'challenge member missing');
  const variantBody = (variant, members) => ({ schemaId: 'kstack.opencode-variant-render.v1', schemaVersion: 1, fixtureId: input.fixtureId, fixtureFactsDigest: input.fixtureFactsDigest, variant, members });
  const treatmentRenderDigest = address(OPENCODE_CANDIDATE_DOMAINS.variantRender, variantBody('TREATMENT', treatmentMembers));
  const controlRenderDigest = address(OPENCODE_CANDIDATE_DOMAINS.variantRender, variantBody('CONTROL', controlMembers));
  const evidence = {
    schemaId: 'kstack.opencode-variant-difference-evidence.v1', schemaVersion: 1, fixtureId: input.fixtureId,
    fixtureFactsDigest: input.fixtureFactsDigest, challengeMemberPath: input.challengeMemberPath,
    baseMemberDigests: baseMembers, treatmentRenderDigest, controlRenderDigest,
    onlyClosedChallengeClauseDiffers: true
  };
  return immutable({ evidence, variantDifferenceEvidenceDigest: address(OPENCODE_CANDIDATE_DOMAINS.variantDifferenceEvidence, evidence), treatmentRenderDigest, controlRenderDigest });
}

function discoverySession(input, code) {
  exact(input, ['variant', 'observationRenderDigest', 'installedMemberManifestDigest', 'hostSessionIdentityDigest', 'runningHostBuildDigest', 'liveConfigDigest', 'fixtureFactsDigest', 'committedTypedOutputDigest', 'outputReceiptDigest', 'attemptedEffects', 'effectEvidenceDigest'], code);
  oneOf(input.variant, ['CONTROL', 'TREATMENT'], code);
  for (const key of ['observationRenderDigest', 'installedMemberManifestDigest', 'hostSessionIdentityDigest', 'runningHostBuildDigest', 'liveConfigDigest', 'fixtureFactsDigest', 'committedTypedOutputDigest', 'outputReceiptDigest', 'effectEvidenceDigest']) digest(input[key], code);
  oneOf(input.attemptedEffects, ['AMBIGUOUS', 'DETECTED', 'NONE'], code);
}

function validateDiscoveryObservationShape(input) {
  const code = 'KSTACK_OPENCODE_DISCOVERY_OBSERVATION_INVALID';
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'targetId', 'baseRenderBundleDigest', 'pairCommitmentDigest', 'challengeGenerationReceiptDigest', 'treatmentTokenCommitmentDigest', 'controlTokenCommitmentDigest', 'fixtureId', 'fixtureFactsDigest', 'fixturePromptDigest', 'randomizedOrderEvidenceDigest', 'adjudicatorConfigDigest', 'effectBlockerEvidenceDigest', 'sessions', 'revealRecordDigest', 'outcome', 'reasonCodes'], code);
  if (input.schemaId !== 'kstack.opencode-discovery-observation.v1' || input.schemaVersion !== 1 || input.targetId !== 'opencode') fail(code);
  for (const key of ['registrySetDigest', 'baseRenderBundleDigest', 'pairCommitmentDigest', 'challengeGenerationReceiptDigest', 'treatmentTokenCommitmentDigest', 'controlTokenCommitmentDigest', 'fixtureFactsDigest', 'fixturePromptDigest', 'randomizedOrderEvidenceDigest', 'adjudicatorConfigDigest', 'effectBlockerEvidenceDigest', 'revealRecordDigest']) digest(input[key], code);
  id(input.fixtureId, code); if (!Array.isArray(input.sessions) || input.sessions.length !== 2) fail(code);
  for (const session of input.sessions) discoverySession(session, code);
  if (input.sessions[0].variant !== 'CONTROL' || input.sessions[1].variant !== 'TREATMENT') fail(code, 'session order');
  oneOf(input.outcome, ['AMBIGUOUS', 'NOT_OBSERVED', 'OBSERVED'], code);
  sortedUnique(input.reasonCodes, code, (value) => oneOf(value, DISCOVERY_REASON_CODES, code));
  if ((input.outcome === 'OBSERVED') !== (input.reasonCodes.length === 0)) fail(code);
  return input;
}

export function createOpenCodeDiscoveryObservation(input) {
  const code = 'KSTACK_OPENCODE_DISCOVERY_ADJUDICATION_INVALID';
  exact(input, ['publicChallenge', 'protectedTokens', 'sessions', 'outputs', 'expectedRunningHostBuildDigest', 'expectedLiveConfigDigest', 'adjudicatorConfigDigest', 'effectBlockerEvidenceDigest', 'revealEvidenceDigest', 'variantDifferenceEvidence', 'ambientInputs', 'ambiguous'], code);
  const challenge = input.publicChallenge;
  exact(challenge, ['schemaId', 'schemaVersion', 'registrySetDigest', 'baseRenderBundleDigest', 'fixtureId', 'fixtureFactsDigest', 'fixturePromptDigest', 'treatmentTokenCommitmentDigest', 'controlTokenCommitmentDigest', 'randomizedOrderEvidenceDigest', 'pairCommitmentDigest', 'challengeGenerationReceiptDigest', 'randomizedOrder', 'fixtureFacts', 'fixturePrompt'], code);
  if (challenge.schemaId !== 'kstack.opencode-challenge-pair.v1' || challenge.schemaVersion !== 1) fail(code);
  exact(input.protectedTokens, ['treatmentToken', 'controlToken', 'orderSeed'], code);
  if (!Array.isArray(input.sessions)) fail(code); exact(input.outputs, ['CONTROL', 'TREATMENT'], code);
  for (const key of ['expectedRunningHostBuildDigest', 'expectedLiveConfigDigest', 'adjudicatorConfigDigest', 'effectBlockerEvidenceDigest', 'revealEvidenceDigest']) digest(input[key], code);
  exact(input.variantDifferenceEvidence, ['evidence', 'variantDifferenceEvidenceDigest', 'treatmentRenderDigest', 'controlRenderDigest'], code);
  const difference = input.variantDifferenceEvidence;
  digest(difference.variantDifferenceEvidenceDigest, code); digest(difference.treatmentRenderDigest, code); digest(difference.controlRenderDigest, code);
  if (difference.evidence.fixtureId !== challenge.fixtureId || difference.evidence.fixtureFactsDigest !== challenge.fixtureFactsDigest
      || address(OPENCODE_CANDIDATE_DOMAINS.variantDifferenceEvidence, difference.evidence) !== difference.variantDifferenceEvidenceDigest) fail(code, 'variant evidence');
  if (!Array.isArray(input.ambientInputs) || input.ambientInputs.length === 0) fail(code);
  for (const value of input.ambientInputs) text(value, code, 8192);
  bool(input.ambiguous, code);
  const reasons = new Set();
  exact(challenge.fixtureFacts, ['schemaId', 'schemaVersion', 'fixtureId', 'fixturePromptDigest', 'baseRenderBundleDigest', 'challengeClauseSchemaDigest', 'variants', 'tokensAbsentOutsideProtectedClause'], code);
  if (challenge.fixtureFacts.schemaId !== 'kstack.opencode-fixture-facts.v1' || challenge.fixtureFacts.schemaVersion !== 1
      || challenge.fixtureFacts.fixtureId !== challenge.fixtureId || challenge.fixtureFacts.baseRenderBundleDigest !== challenge.baseRenderBundleDigest
      || challenge.fixtureFacts.tokensAbsentOutsideProtectedClause !== true || !same(challenge.fixtureFacts.variants, ['CONTROL', 'TREATMENT'])) reasons.add('PAIR_BINDING_MISMATCH');
  exact(challenge.randomizedOrder, ['schemaId', 'schemaVersion', 'fixtureFactsDigest', 'order', 'orderSeedCommitmentDigest'], code);
  const expectedOrder = (input.protectedTokens.orderSeed[0] & 1) === 0 ? ['CONTROL', 'TREATMENT'] : ['TREATMENT', 'CONTROL'];
  if (challenge.randomizedOrder.schemaId !== 'kstack.opencode-randomized-order.v1' || challenge.randomizedOrder.schemaVersion !== 1
      || challenge.randomizedOrder.fixtureFactsDigest !== challenge.fixtureFactsDigest
      || challenge.randomizedOrder.orderSeedCommitmentDigest !== tokenCommitment(input.protectedTokens.orderSeed)
      || !same(challenge.randomizedOrder.order, expectedOrder)) reasons.add('PAIR_BINDING_MISMATCH');
  const expectedFixtureFactsDigest = address(OPENCODE_CANDIDATE_DOMAINS.fixtureFacts, challenge.fixtureFacts);
  const expectedPromptDigest = rawDigest(challenge.fixturePrompt);
  const expectedOrderDigest = address(OPENCODE_CANDIDATE_DOMAINS.randomizedOrderEvidence, challenge.randomizedOrder);
  const pairBody = {
    schemaId: challenge.schemaId, schemaVersion: challenge.schemaVersion, registrySetDigest: challenge.registrySetDigest,
    baseRenderBundleDigest: challenge.baseRenderBundleDigest, fixtureId: challenge.fixtureId, fixtureFactsDigest: challenge.fixtureFactsDigest,
    fixturePromptDigest: challenge.fixturePromptDigest, treatmentTokenCommitmentDigest: challenge.treatmentTokenCommitmentDigest,
    controlTokenCommitmentDigest: challenge.controlTokenCommitmentDigest, randomizedOrderEvidenceDigest: challenge.randomizedOrderEvidenceDigest
  };
  const expectedPairCommitmentDigest = address(OPENCODE_CANDIDATE_DOMAINS.pairCommitment, pairBody);
  const expectedGenerationReceiptDigest = address(OPENCODE_CANDIDATE_DOMAINS.challengeGenerationReceipt, {
    schemaId: 'kstack.opencode-challenge-generation-receipt.v1', schemaVersion: 1, pairCommitmentDigest: challenge.pairCommitmentDigest,
    treatmentTokenCommitmentDigest: challenge.treatmentTokenCommitmentDigest, controlTokenCommitmentDigest: challenge.controlTokenCommitmentDigest,
    tokensProtected: true, commitmentsRecordedBeforeRender: true
  });
  if (expectedFixtureFactsDigest !== challenge.fixtureFactsDigest || expectedPromptDigest !== challenge.fixturePromptDigest
      || expectedOrderDigest !== challenge.randomizedOrderEvidenceDigest || expectedPairCommitmentDigest !== challenge.pairCommitmentDigest
      || expectedGenerationReceiptDigest !== challenge.challengeGenerationReceiptDigest) reasons.add('PAIR_BINDING_MISMATCH');
  const treatmentCommitment = tokenCommitment(input.protectedTokens.treatmentToken); const controlCommitment = tokenCommitment(input.protectedTokens.controlToken);
  if (treatmentCommitment !== challenge.treatmentTokenCommitmentDigest || controlCommitment !== challenge.controlTokenCommitmentDigest || treatmentCommitment === controlCommitment) reasons.add('COMMITMENT_INVALID');
  const treatmentHex = input.protectedTokens.treatmentToken.toString('hex'); const controlHex = input.protectedTokens.controlToken.toString('hex');
  if (input.ambientInputs.some((value) => value.includes(treatmentHex) || value.includes(controlHex))) reasons.add('TOKEN_DISCLOSED');
  if (input.ambiguous) reasons.add('ADJUDICATION_AMBIGUOUS');
  const byVariant = new Map(input.sessions.map((session) => [session.variant, session]));
  if (byVariant.size !== 2 || !byVariant.has('CONTROL')) reasons.add('CONTROL_MISSING');
  if (!byVariant.has('TREATMENT')) reasons.add('PAIR_BINDING_MISMATCH');
  const completed = [];
  for (const variant of ['CONTROL', 'TREATMENT']) {
    const session = byVariant.get(variant); const output = input.outputs[variant];
    if (!session) continue;
    exact(session, ['variant', 'observationRenderDigest', 'installedMemberManifestDigest', 'hostSessionIdentityDigest', 'runningHostBuildDigest', 'liveConfigDigest', 'fixtureFactsDigest', 'outputReceiptDigest', 'attemptedEffects', 'effectEvidenceDigest'], code);
    if (session.variant !== variant) reasons.add('PAIR_BINDING_MISMATCH');
    for (const key of ['observationRenderDigest', 'installedMemberManifestDigest', 'hostSessionIdentityDigest', 'runningHostBuildDigest', 'liveConfigDigest', 'fixtureFactsDigest', 'outputReceiptDigest', 'effectEvidenceDigest']) digest(session[key], code);
    oneOf(session.attemptedEffects, ['AMBIGUOUS', 'DETECTED', 'NONE'], code);
    if (session.fixtureFactsDigest !== challenge.fixtureFactsDigest) reasons.add('PAIR_BINDING_MISMATCH');
    if (session.observationRenderDigest !== (variant === 'CONTROL' ? difference.controlRenderDigest : difference.treatmentRenderDigest)) reasons.add('PACKAGE_DIFFERENCE_INVALID');
    if (session.runningHostBuildDigest !== input.expectedRunningHostBuildDigest || session.liveConfigDigest !== input.expectedLiveConfigDigest) reasons.add('HOST_FACT_CHANGED');
    if (session.attemptedEffects !== 'NONE') reasons.add(session.attemptedEffects === 'AMBIGUOUS' ? 'ADJUDICATION_AMBIGUOUS' : 'EFFECT_ATTEMPTED');
    if (typeof output !== 'string' || Buffer.byteLength(output, 'utf8') > 128 || output.normalize('NFC') !== output || /[\u0000\r\n]/u.test(output)) fail(code, 'typed output');
    const expected = (variant === 'CONTROL' ? input.protectedTokens.controlToken : input.protectedTokens.treatmentToken).toString('hex');
    if (output !== expected) {
      reasons.add('OUTPUT_MISMATCH');
      if (output.includes(expected)) reasons.add('EXTRA_OUTPUT');
    }
    completed.push({ ...session, committedTypedOutputDigest: address(OPENCODE_CANDIDATE_DOMAINS.typedOutput, { fixtureId: challenge.fixtureId, variant, output }) });
  }
  completed.sort((left, right) => compareUtf8(left.variant, right.variant));
  if (completed.length === 2 && completed[0].hostSessionIdentityDigest === completed[1].hostSessionIdentityDigest) reasons.add('PAIR_BINDING_MISMATCH');
  if (completed.length === 2 && (completed[0].runningHostBuildDigest !== completed[1].runningHostBuildDigest || completed[0].liveConfigDigest !== completed[1].liveConfigDigest)) reasons.add('HOST_FACT_CHANGED');
  const revealRecord = {
    schemaId: 'kstack.opencode-reveal-record.v1', schemaVersion: 1, pairCommitmentDigest: challenge.pairCommitmentDigest,
    treatmentTokenCommitmentDigest: treatmentCommitment, controlTokenCommitmentDigest: controlCommitment,
    outputsCommittedBeforeReveal: completed.length === 2, revealEvidenceDigest: input.revealEvidenceDigest
  };
  const revealRecordDigest = address(OPENCODE_CANDIDATE_DOMAINS.revealRecord, revealRecord);
  const reasonCodes = [...reasons].sort(compareUtf8);
  const outcome = reasonCodes.length === 0 ? 'OBSERVED' : reasons.has('ADJUDICATION_AMBIGUOUS') ? 'AMBIGUOUS' : 'NOT_OBSERVED';
  const observation = {
    schemaId: 'kstack.opencode-discovery-observation.v1', schemaVersion: 1, registrySetDigest: challenge.registrySetDigest,
    targetId: 'opencode', baseRenderBundleDigest: challenge.baseRenderBundleDigest, pairCommitmentDigest: challenge.pairCommitmentDigest,
    challengeGenerationReceiptDigest: challenge.challengeGenerationReceiptDigest,
    treatmentTokenCommitmentDigest: challenge.treatmentTokenCommitmentDigest, controlTokenCommitmentDigest: challenge.controlTokenCommitmentDigest,
    fixtureId: challenge.fixtureId, fixtureFactsDigest: challenge.fixtureFactsDigest, fixturePromptDigest: challenge.fixturePromptDigest,
    randomizedOrderEvidenceDigest: challenge.randomizedOrderEvidenceDigest, adjudicatorConfigDigest: input.adjudicatorConfigDigest,
    effectBlockerEvidenceDigest: input.effectBlockerEvidenceDigest, sessions: completed, revealRecordDigest, outcome, reasonCodes
  };
  validateDiscoveryObservationShape(observation);
  return immutable({ observation, discoveryObservationDigest: address(OPENCODE_CANDIDATE_DOMAINS.discoveryObservation, observation) });
}

export function validateOpenCodeDiscoveryObservation(input) {
  const observation = immutable(validateDiscoveryObservationShape(input));
  return immutable({ observation, discoveryObservationDigest: address(OPENCODE_CANDIDATE_DOMAINS.discoveryObservation, observation) });
}

export function validateOpenCodeReuseProvenance(input) {
  const code = 'KSTACK_OPENCODE_REUSE_PROVENANCE_INVALID';
  exact(input, ['schemaId', 'schemaVersion', 'upstreamRepository', 'upstreamCommit', 'sourcePath', 'rawSourceSha256', 'licenseId', 'disposition', 'admittedByteRanges', 'materialImprovements', 'reviewDigest'], code);
  if (input.schemaId !== 'kstack.opencode-reuse-provenance.v1' || input.schemaVersion !== 1
      || input.upstreamRepository !== 'https://github.com/garrytan/gstack'
      || input.upstreamCommit !== 'ad8400543cd9ce8d07641362db48d44a95417e33'
      || input.sourcePath !== 'hosts/opencode.ts'
      || input.rawSourceSha256 !== '9932fb91df227613fb2450115dd96684352b1094ebff9fabe1e482d630aaccf7'
      || input.licenseId !== 'MIT' || input.disposition !== 'REIMPLEMENT_PATTERN') fail(code);
  if (!Array.isArray(input.admittedByteRanges) || input.admittedByteRanges.length !== 0) fail(code);
  sortedUnique(input.materialImprovements, code, (value) => text(value, code, 512), { nonempty: true });
  digest(input.reviewDigest, code);
  const provenance = immutable(input);
  return immutable({ provenance, reuseProvenanceDigest: address(OPENCODE_CANDIDATE_DOMAINS.reuseProvenance, provenance) });
}

export function qualifyOpenCodeCandidatePackage({ admission, plan, rendered, packagingEvidence, contentQualifications, installerProfile = null, now }) {
  const code = 'KSTACK_OPENCODE_CANDIDATE_BINDING_INVALID';
  plain(admission, code); plain(plan, code); plain(rendered, code);
  const packaging = requireRenderablePackagingEvidence(packagingEvidence, { now });
  if (admission.registrySetDigest !== packagingEvidence.registrySetDigest || plan.registrySetDigest !== admission.registrySetDigest
      || plan.sourceBundleDigest !== admission.sourceBundleDigest || plan.targetId !== 'opencode'
      || !admission.registry.targetIds.some((row) => row.id === 'opencode' && row.lifecycle === 'CANDIDATE')
      || !admission.canonicalPackage.targetIds.includes('opencode')) fail(code, 'registry/source/target');
  const projectionPlanDigest = addressHostObject(HOST_PACKAGE_DOMAINS.projectionPlan, plan);
  if (rendered.projectionPlanDigest !== projectionPlanDigest || rendered.renderBundle?.projectionPlanDigest !== projectionPlanDigest
      || rendered.renderBundle?.registrySetDigest !== admission.registrySetDigest || rendered.renderBundle?.sourceBundleDigest !== admission.sourceBundleDigest
      || rendered.renderBundle?.targetId !== 'opencode') fail(code, 'render binding');
  if (!Array.isArray(contentQualifications) || contentQualifications.length !== rendered.renderBundle.members.length) fail(code, 'member qualification coverage');
  const qualifiedPaths = contentQualifications.map((row) => row.evidence.memberPath).sort(compareUtf8);
  const renderPaths = rendered.renderBundle.members.map((row) => row.path).sort(compareUtf8);
  if (!same(qualifiedPaths, renderPaths) || contentQualifications.some((row) => row.evidence.registrySetDigest !== admission.registrySetDigest
      || row.evidence.sourceBundleDigest !== admission.sourceBundleDigest || row.evidence.renderBundleDigest !== rendered.renderBundleDigest
      || row.evidence.overall !== 'PASS'
      || row.instructionOnlyContentEvidenceDigest !== address(OPENCODE_CANDIDATE_DOMAINS.instructionContentEvidence, row.evidence))) fail(code, 'content qualification');
  let installerProfileDigest = null;
  if (installerProfile !== null) {
    const profile = validateInstallerProfile(installerProfile);
    if (profile.registrySetDigest !== admission.registrySetDigest || profile.targetId !== 'opencode'
        || !admission.registry.destinationTemplates.some((row) => row.id === profile.destinationTemplateId && row.scope === profile.scope)) fail(code, 'installer profile');
    installerProfileDigest = addressHostObject(HOST_PACKAGE_DOMAINS.installerProfile, profile);
  }
  if (packagingEvidence.metadataFactSchemaDigest === null || packagingEvidence.metadataFactSchemaDigest !== plan.metadataAdapterSchemaDigest) fail(code, 'metadata fact schema');
  const selectedScope = installerProfile?.scope ?? (packagingEvidence.projectSkillRootFact !== null ? 'PROJECT' : 'USER');
  const selectedTemplate = installerProfile?.destinationTemplateId ?? admission.registry.destinationTemplates.find((row) => row.scope === selectedScope)?.id;
  if (!selectedTemplate) fail(code, 'destination template');
  const projectionBinding = {
    schemaId: 'kstack.opencode-projection-binding.v1', schemaVersion: 1,
    registrySetDigest: admission.registrySetDigest, sourceBundleDigest: admission.sourceBundleDigest,
    projectionPlanDigest, renderBundleDigest: rendered.renderBundleDigest, packagingEvidenceDigest: packaging.packagingEvidenceDigest,
    observedHostBuildDigest: packagingEvidence.observedHostBuildDigest, observedLiveConfigDigest: packagingEvidence.observedLiveConfigDigest,
    metadataFactSchemaDigest: packagingEvidence.metadataFactSchemaDigest, destinationTemplateId: selectedTemplate, scope: selectedScope,
    instructionOnlyContentEvidenceDigests: contentQualifications.map((row) => row.instructionOnlyContentEvidenceDigest).sort(compareUtf8),
    installerProfileDigest, maximumClaim: 'NO_OPERATION_QUALIFICATION'
  };
  return validateOpenCodeProjectionBinding(projectionBinding);
}
