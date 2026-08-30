import crypto from 'node:crypto';
import {
  assertAsciiId,
  assertDigest,
  assertTimestamp,
  hostAddress,
  hostCanonicalBytes
} from './kstack-host-contract.mjs';

export class McpBoundaryError extends Error {
  constructor(code) { super(code); this.name = 'McpBoundaryError'; this.code = code; }
}

function fail(code) { throw new McpBoundaryError(code); }
function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort(); const wanted = [...keys].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(code);
}
function digest(value, code) { try { return assertDigest(value); } catch { fail(code); } }
function ascii(value, code) { try { return assertAsciiId(value); } catch { fail(code); } }
function timestamp(value, code) { try { return assertTimestamp(value); } catch { fail(code); } }
function bool(value, code) { if (typeof value !== 'boolean') fail(code); return value; }
function uint(value, maximum, positive, code) { if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > maximum) fail(code); return value; }
function enumeration(value, allowed, code) { if (!allowed.includes(value)) fail(code); return value; }
function mcpMethod(value, code) { if (typeof value !== 'string' || !/^[a-z][a-z0-9._/-]{0,127}$/u.test(value)) fail(code); return value; }
function boundedAscii(value, code) { if (typeof value !== 'string' || value.length < 1 || value.length > 128 || /[^\x21-\x7e]/u.test(value)) fail(code); return value; }
function stableCode(value, code) { if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_]{0,127}$/u.test(value)) fail(code); return value; }
function orderedUnique(values, validator, minimum, maximum, code) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) fail(code);
  values.forEach((value) => validator(value, code));
  if (new Set(values).size !== values.length) fail(code);
  return values;
}
function sortedUnique(values, validator, minimum, maximum, code) {
  orderedUnique(values, validator, minimum, maximum, code);
  if (values.some((value, index) => index > 0 && value <= values[index - 1])) fail(code);
  return values;
}
function immutable(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}

export const PUBLIC_MCP_METHODS = Object.freeze(['initialize', 'ping', 'resources/list', 'resources/read']);
export const PUBLIC_MCP_NOTIFICATIONS = Object.freeze(['notifications/initialized', 'notifications/cancelled']);
export const MCP_OUTPUT_CLASSES = Object.freeze(['MODEL_VISIBLE_UNTRUSTED', 'PROHIBITED', 'PROTECTED_DIAGNOSTIC', 'PUBLIC_SAFE', 'RESTRICTED_STRUCTURED']);
const PUBLIC_RULES = Object.freeze(['schema', 'registry', 'package-manifest', 'host-candidate-status', 'status-current']);
const ERROR_MAP = Object.freeze({
  PARSE_ERROR: [-32700, 'Parse error'], INVALID_REQUEST: [-32600, 'Invalid Request'], METHOD_NOT_FOUND: [-32601, 'Method not found'],
  INVALID_PARAMS: [-32602, 'Invalid params'], INTERNAL_FAILURE: [-32603, 'Internal error'], RESOURCE_NOT_FOUND: [-32001, 'Resource not found'],
  RESOURCE_TOO_LARGE: [-32002, 'Resource too large'], INVALID_CURSOR: [-32003, 'Invalid cursor'], SNAPSHOT_EXPIRED: [-32004, 'Snapshot expired'],
  RESOURCE_SNAPSHOT_UNAVAILABLE: [-32005, 'Resource snapshot unavailable'], RATE_LIMITED: [-32006, 'Rate limited'], CANCELLED: [-32007, 'Request cancelled']
});
const TOKEN_PREFIX = 'KSTACK-MCP-SNAPSHOT-READ-TOKEN-V1';
const CURSOR_PREFIX = 'KSTACK-MCP-SNAPSHOT-CURSOR-V1';

export function createMcpError(symbol, requestId, resourceId, retryable, correlationDigest) {
  if (!Object.hasOwn(ERROR_MAP, symbol)) fail('KSTACK_MCP_ERROR_INVALID');
  if (!(requestId === null || typeof requestId === 'string' && Buffer.byteLength(requestId, 'utf8') <= 256 || Number.isSafeInteger(requestId))) fail('KSTACK_MCP_ERROR_INVALID');
  if (!(resourceId === null || typeof resourceId === 'string' && /^[a-z0-9][a-z0-9._-]{0,127}$/u.test(resourceId))) fail('KSTACK_MCP_ERROR_INVALID');
  bool(retryable, 'KSTACK_MCP_ERROR_INVALID'); digest(correlationDigest, 'KSTACK_MCP_ERROR_INVALID');
  const [code, message] = ERROR_MAP[symbol];
  return immutable({ jsonrpc: '2.0', id: requestId, error: { code, message, data: { resourceId, retryable, correlationDigest } } });
}

export function validateMcpFacadeProfile(value) {
  const code = 'KSTACK_MCP_PUBLIC_PROFILE_INVALID';
  exact(value, [
    'schemaId', 'schemaVersion', 'profileId', 'protocolVersion', 'transport', 'principalMode',
    'allowedRequestMethods', 'allowedNotifications', 'maxFrameBytes', 'maxConcurrentRequests', 'maxQueuedRequests',
    'requestDeadlineMs', 'maxResourceBytes', 'maxListPageItems', 'maxListResources', 'maxSnapshotLeases',
    'maxSnapshotLeaseBytes', 'maxSnapshotLeaseLifetimeMs'
  ], code);
  if (value.schemaId !== 'kstack.mcp-facade-profile.v1' || value.schemaVersion !== 1 || value.transport !== 'STDIO'
    || value.principalMode !== 'UNAUTHENTICATED_LOCAL_READER') fail(code);
  ascii(value.profileId, code); ascii(value.protocolVersion, code);
  if (JSON.stringify(value.allowedRequestMethods) !== JSON.stringify(PUBLIC_MCP_METHODS)
    || JSON.stringify(value.allowedNotifications) !== JSON.stringify(PUBLIC_MCP_NOTIFICATIONS)) fail(code);
  for (const key of ['maxFrameBytes', 'maxConcurrentRequests', 'requestDeadlineMs', 'maxResourceBytes', 'maxListPageItems', 'maxListResources', 'maxSnapshotLeases', 'maxSnapshotLeaseBytes', 'maxSnapshotLeaseLifetimeMs']) uint(value[key], 16_777_216, true, code);
  uint(value.maxQueuedRequests, 4096, false, code);
  if (value.maxFrameBytes > 1_048_576 || value.maxConcurrentRequests > 64 || value.maxQueuedRequests > 256
    || value.requestDeadlineMs > 60_000 || value.maxResourceBytes > 1_048_576 || value.maxListPageItems > 256
    || value.maxListResources > 1024 || value.maxSnapshotLeases > 64 || value.maxSnapshotLeaseBytes > 16_777_216
    || value.maxSnapshotLeaseLifetimeMs > 300_000) fail(code);
  return immutable({ profile: value, profileDigest: hostAddress('KSTACK-MCP-FACADE-PROFILE-V1', value) });
}

export function validateMcpPublicCatalog(value) {
  const code = 'KSTACK_MCP_PUBLIC_CATALOG_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'profileDigest', 'projectionPolicyDigest', 'rules'], code);
  if (value.schemaId !== 'kstack.mcp-resource-catalog.v1' || value.schemaVersion !== 1) fail(code);
  for (const key of ['profileDigest', 'projectionPolicyDigest']) digest(value[key], code);
  if (!Array.isArray(value.rules) || value.rules.length !== PUBLIC_RULES.length) fail(code);
  value.rules.forEach((rule) => {
    exact(rule, ['ruleId', 'kind', 'mediaType', 'sourceSchemaDigest', 'projectionSchemaDigest', 'maximumClassification', 'maxBytes'], code);
    ascii(rule.ruleId, code); enumeration(rule.kind, ['CURRENT_STATUS', 'IMMUTABLE_OBJECT'], code);
    digest(rule.sourceSchemaDigest, code); digest(rule.projectionSchemaDigest, code);
    if (rule.mediaType !== 'application/json' || rule.maximumClassification !== 'PUBLIC_REPOSITORY_METADATA') fail(code);
    uint(rule.maxBytes, 1_048_576, true, code);
  });
  if (JSON.stringify(value.rules.map((rule) => rule.ruleId)) !== JSON.stringify(PUBLIC_RULES)) fail(code);
  return immutable({ catalog: value, catalogDigest: hostAddress('KSTACK-MCP-RESOURCE-CATALOG-V1', value) });
}

export function validateMcpPublicProjectionPolicy(value) {
  const code = 'KSTACK_MCP_PUBLIC_PROJECTION_POLICY_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'rows'], code);
  if (value.schemaId !== 'kstack.mcp-public-projection-policy.v1' || value.schemaVersion !== 1) fail(code);
  if (!Array.isArray(value.rows) || value.rows.length !== PUBLIC_RULES.length) fail(code);
  for (const row of value.rows) {
    exact(row, ['ruleId', 'sourceSchemaDigest', 'outputSchemaDigest', 'fields', 'replacementCodes', 'maxDepth', 'maxFields', 'maxCollectionItems'], code); ascii(row.ruleId, code);
    digest(row.sourceSchemaDigest, code); digest(row.outputSchemaDigest, code);
    uint(row.maxDepth, 32, true, code); uint(row.maxFields, 256, true, code); uint(row.maxCollectionItems, 1024, false, code);
    if (!Array.isArray(row.fields) || row.fields.length < 1 || row.fields.length > 64) fail(code);
    const ids = [];
    for (const field of row.fields) {
      exact(field, ['fieldId', 'valueType', 'maxStringBytes'], code); ascii(field.fieldId, code); ids.push(field.fieldId);
      enumeration(field.valueType, ['BOOLEAN', 'DIGEST', 'INTEGER', 'STRING', 'TIMESTAMP'], code);
      uint(field.maxStringBytes, 16_384, field.valueType === 'STRING', code);
      if (field.valueType !== 'STRING' && field.maxStringBytes !== 0) fail(code);
    }
    if (new Set(ids).size !== ids.length || ids.some((id, index) => index > 0 && id <= ids[index - 1])) fail(code);
    sortedUnique(row.replacementCodes, stableCode, 0, 64, code);
  }
  if (JSON.stringify(value.rows.map((row) => row.ruleId)) !== JSON.stringify(PUBLIC_RULES)) fail(code);
  return immutable({ policy: value, policyDigest: hostAddress('KSTACK-MCP-PUBLIC-PROJECTION-POLICY-V1', value) });
}

export function validateMcpLaunchEvidence(value) {
  const code = 'KSTACK_MCP_LAUNCH_EVIDENCE_INVALID';
  exact(value, [
    'schemaId', 'schemaVersion', 'executableDigest', 'confinementProfileDigest', 'openedHandleIdentityDigests',
    'launchNonceDigest', 'observedAtUtc', 'expiresAtUtc', 'transport', 'writableFilesystem', 'network',
    'children', 'inheritedDescriptorCount'
  ], code);
  if (value.schemaId !== 'kstack.mcp-launch-evidence.v1' || value.schemaVersion !== 1 || value.transport !== 'STDIO') fail(code);
  digest(value.executableDigest, code); digest(value.confinementProfileDigest, code); digest(value.launchNonceDigest, code);
  sortedUnique(value.openedHandleIdentityDigests, digest, 2, 64, code);
  timestamp(value.observedAtUtc, code); timestamp(value.expiresAtUtc, code);
  if (value.observedAtUtc >= value.expiresAtUtc || value.writableFilesystem !== false || value.network !== false
    || value.children !== false || value.inheritedDescriptorCount !== 0) fail(code);
  return immutable({ evidence: value, launchEvidenceDigest: hostAddress('KSTACK-MCP-LAUNCH-EVIDENCE-V1', value) });
}

export function validateMcpRepositoryBinding(value) {
  const code = 'KSTACK_MCP_REPOSITORY_BINDING_INVALID';
  exact(value, [
    'schemaId', 'schemaVersion', 'canonicalRepositoryIdentityDigest', 'openedRootIdentityDigest', 'activeSetDigest',
    'registrySetDigest', 'profileDigest', 'projectionPolicyDigest', 'resourceCatalogDigest', 'launchEvidenceDigest'
  ], code);
  if (value.schemaId !== 'kstack.mcp-repository-binding.v1' || value.schemaVersion !== 1) fail(code);
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, code);
  return immutable({ binding: value, repositoryBindingDigest: hostAddress('KSTACK-MCP-REPOSITORY-BINDING-V1', value) });
}

function publicLogicalUri(value) {
  if (typeof value !== 'string' || value.length > 2048 || !value.isWellFormed() || value.normalize('NFC') !== value
    || /[%?#\\\u0000-\u001f\u007f]/u.test(value) || value !== value.toLowerCase()) fail('KSTACK_MCP_PUBLIC_URI_INVALID');
  const digestPart = '[0-9a-f]{64}';
  const rows = [
    [`^kstack://schema/(${digestPart})$`, 'schema'], [`^kstack://registry/(${digestPart})$`, 'registry'],
    [`^kstack://package/(${digestPart})/manifest$`, 'package-manifest'], ['^kstack://host/opencode/candidate-status$', 'host-candidate-status'],
    ['^kstack://status/current$', 'status-current']
  ];
  const matches = rows.map(([source, ruleId]) => ({ match: new RegExp(source, 'u').exec(value), ruleId })).filter((row) => row.match);
  if (matches.length !== 1) fail('KSTACK_MCP_PUBLIC_URI_INVALID');
  return { ruleId: matches[0].ruleId, sourceDigest: matches[0].match[1] ? `sha256:${matches[0].match[1]}` : null };
}

function hmac(key, prefix, value) { return crypto.createHmac('sha256', key).update(prefix).update('\0').update(hostCanonicalBytes(value)).digest('hex'); }
function encodeToken(key, prefix, fields) {
  const envelope = { fields, mac: hmac(key, prefix, fields) };
  return hostCanonicalBytes(envelope).toString('base64url');
}
function decodeToken(key, prefix, token, code) {
  if (typeof token !== 'string' || token.length < 40 || token.length > 4096 || !/^[A-Za-z0-9_-]+$/u.test(token)) fail(code);
  let envelope;
  try {
    const bytes = Buffer.from(token, 'base64url'); envelope = JSON.parse(bytes.toString('utf8'));
    if (hostCanonicalBytes(envelope).toString('base64url') !== token) fail(code);
  } catch { fail(code); }
  exact(envelope, ['fields', 'mac'], code);
  if (typeof envelope.mac !== 'string' || !/^[0-9a-f]{64}$/u.test(envelope.mac)) fail(code);
  const expected = hmac(key, prefix, envelope.fields);
  if (!crypto.timingSafeEqual(Buffer.from(envelope.mac, 'hex'), Buffer.from(expected, 'hex'))) fail(code);
  return envelope.fields;
}

function validatePublicBackend(backend, allowTestBackend) {
  exact(backend, ['descriptor', 'freezeSnapshot', 'revalidateSnapshot', 'trustedTime'], 'KSTACK_MCP_PUBLIC_BACKEND_INVALID');
  exact(backend.descriptor, [
    'protectionClass', 'repositoryWritable', 'agentWritable', 'readOnlyHandles', 'noNetwork', 'noChildren',
    'launchEvidenceDigest', 'repositoryBindingDigest', 'openedRootIdentityDigest'
  ], 'KSTACK_MCP_PUBLIC_BACKEND_INVALID');
  const classes = ['os-protected', 'qualified-service']; if (allowTestBackend) classes.push('test-only');
  for (const key of ['launchEvidenceDigest', 'repositoryBindingDigest', 'openedRootIdentityDigest']) digest(backend.descriptor[key], 'KSTACK_MCP_PUBLIC_BACKEND_INVALID');
  if (!classes.includes(backend.descriptor.protectionClass) || backend.descriptor.repositoryWritable !== false
    || backend.descriptor.agentWritable !== false || backend.descriptor.readOnlyHandles !== true
    || backend.descriptor.noNetwork !== true || backend.descriptor.noChildren !== true
    || ['freezeSnapshot', 'revalidateSnapshot', 'trustedTime'].some((key) => typeof backend[key] !== 'function')) fail('KSTACK_MCP_PUBLIC_BACKEND_INVALID');
  return backend;
}

const PUBLIC_PROHIBITED_TEXT = /(?:\b(?:SUPPORTED|FULL|QUALIFIED|AUTHORIZED|APPROVED)\b|\/(?:home|Users|etc)\/|[A-Za-z]:\\|\\\\)/u;
function validateSnapshotInput(value, profile, catalog, projectionPolicy, backendDescriptor) {
  const code = 'KSTACK_MCP_PUBLIC_SNAPSHOT_INVALID';
  exact(value, [
    'profileDigest', 'repositoryBindingDigest', 'openedRootIdentityDigest', 'activeSetDigest', 'registrySetDigest',
    'packageDigest', 'resourceCatalogDigest', 'projectionPolicyDigest', 'candidateStatusBodyDigest',
    'orderedSourceObjectDigests', 'authoritativeReadSequence', 'observedAtUtc', 'expiresAtUtc',
    'snapshotDigest', 'resourceInventoryDigest', 'resources'
  ], code);
  for (const key of ['profileDigest', 'repositoryBindingDigest', 'openedRootIdentityDigest', 'activeSetDigest', 'registrySetDigest', 'packageDigest', 'resourceCatalogDigest', 'projectionPolicyDigest', 'snapshotDigest', 'resourceInventoryDigest']) digest(value[key], code);
  if (!(value.candidateStatusBodyDigest === null || /^sha256:[0-9a-f]{64}$/u.test(value.candidateStatusBodyDigest))) fail(code);
  orderedUnique(value.orderedSourceObjectDigests, digest, 4, profile.maxListResources, code);
  uint(value.authoritativeReadSequence, Number.MAX_SAFE_INTEGER, false, code);
  if (value.repositoryBindingDigest !== backendDescriptor.repositoryBindingDigest || value.openedRootIdentityDigest !== backendDescriptor.openedRootIdentityDigest
    || value.profileDigest !== hostAddress('KSTACK-MCP-FACADE-PROFILE-V1', profile)
    || value.resourceCatalogDigest !== hostAddress('KSTACK-MCP-RESOURCE-CATALOG-V1', catalog)
    || value.projectionPolicyDigest !== catalog.projectionPolicyDigest) fail(code);
  timestamp(value.observedAtUtc, code); timestamp(value.expiresAtUtc, code); if (value.observedAtUtc >= value.expiresAtUtc) fail(code);
  if (!Array.isArray(value.resources) || value.resources.length < 4 || value.resources.length > profile.maxListResources) fail(code);
  let bytes = 0; const uris = new Set(); const resourceIds = new Set(); const ruleCounts = new Map();
  const resources = value.resources.map((resource) => {
    exact(resource, ['resourceId', 'logicalUri', 'name', 'mediaType', 'sourceDigest', 'sourceObjectDigest', 'sourceSchemaDigest', 'source'], code);
    ascii(resource.resourceId, code); if (resourceIds.has(resource.resourceId)) fail(code); resourceIds.add(resource.resourceId);
    if (typeof resource.name !== 'string' || resource.name.length < 1 || Buffer.byteLength(resource.name, 'utf8') > 256 || resource.name.normalize('NFC') !== resource.name) fail(code);
    if (resource.mediaType !== 'application/json') fail(code);
    const parsed = publicLogicalUri(resource.logicalUri); if (resource.sourceDigest !== parsed.sourceDigest) fail(code);
    digest(resource.sourceObjectDigest, code);
    if (uris.has(resource.logicalUri)) fail(code); uris.add(resource.logicalUri);
    const rule = catalog.rules.find((row) => row.ruleId === parsed.ruleId); if (!rule) fail(code);
    const policyRow = projectionPolicy.rows.find((row) => row.ruleId === parsed.ruleId); if (!policyRow) fail(code);
    if (policyRow.sourceSchemaDigest !== rule.sourceSchemaDigest || policyRow.outputSchemaDigest !== rule.projectionSchemaDigest) fail(code);
    if (resource.sourceSchemaDigest !== policyRow.sourceSchemaDigest || !resource.source || typeof resource.source !== 'object' || Array.isArray(resource.source)) fail(code);
    const payload = {};
    for (const field of policyRow.fields) {
      if (!Object.hasOwn(resource.source, field.fieldId)) fail(code); const entry = resource.source[field.fieldId];
      if (field.valueType === 'BOOLEAN') bool(entry, code);
      else if (field.valueType === 'DIGEST') digest(entry, code);
      else if (field.valueType === 'INTEGER') uint(entry, Number.MAX_SAFE_INTEGER, false, code);
      else if (field.valueType === 'TIMESTAMP') timestamp(entry, code);
      else if (typeof entry !== 'string' || !entry.isWellFormed() || entry.normalize('NFC') !== entry || Buffer.byteLength(entry, 'utf8') > field.maxStringBytes
        || SECRET_LIKE.test(entry) || PUBLIC_PROHIBITED_TEXT.test(entry)) fail('KSTACK_MCP_OUTPUT_PROHIBITED');
      payload[field.fieldId] = entry;
    }
    if (parsed.ruleId === 'host-candidate-status' && !['DECLARED', 'PACKAGED', 'RENDERED', 'INSTALLED', 'DISCOVERY_OBSERVED', 'CANDIDATE_INVALIDATED', 'UNAVAILABLE'].includes(payload.status)) fail('KSTACK_MCP_OUTPUT_PROHIBITED');
    const body = immutable({
      schemaId: 'kstack.mcp-public-resource.v1', schemaVersion: 1, resourceId: resource.resourceId,
      snapshotDigest: value.snapshotDigest, sourceDigest: resource.sourceDigest,
      projectionPolicyDigest: catalog.projectionPolicyDigest, maximumClaim: 'READ_ONLY_NON_QUALIFYING', payload
    });
    const bodyBytes = hostCanonicalBytes(body); if (bodyBytes.length > rule.maxBytes || bodyBytes.length > profile.maxResourceBytes) fail(code);
    bytes += bodyBytes.length; ruleCounts.set(parsed.ruleId, (ruleCounts.get(parsed.ruleId) ?? 0) + 1);
    return immutable({
      resourceId: resource.resourceId, logicalUri: resource.logicalUri, name: resource.name, mediaType: resource.mediaType,
      sourceDigest: resource.sourceDigest, sourceObjectDigest: resource.sourceObjectDigest, sourceSchemaDigest: resource.sourceSchemaDigest, ruleId: parsed.ruleId,
      body, bodyBytes, bodyDigest: hostAddress('KSTACK-MCP-PUBLIC-BODY-V1', body)
    });
  });
  const ordered = [...resources].sort((left, right) => PUBLIC_RULES.indexOf(left.ruleId) - PUBLIC_RULES.indexOf(right.ruleId) || Buffer.compare(Buffer.from(left.logicalUri), Buffer.from(right.logicalUri)));
  if (resources.some((resource, index) => resource !== ordered[index])) fail(code);
  if (JSON.stringify(value.orderedSourceObjectDigests) !== JSON.stringify(resources.map((resource) => resource.sourceObjectDigest))) fail(code);
  for (const ruleId of PUBLIC_RULES) if ((ruleCounts.get(ruleId) ?? 0) !== (ruleId === 'schema' ? ruleCounts.get(ruleId) : 1)) fail(code);
  if (!ruleCounts.has('schema')) fail(code);
  if (bytes > profile.maxSnapshotLeaseBytes) fail('KSTACK_MCP_RATE_LIMITED');
  const expectedInventoryDigest = hostAddress('KSTACK-MCP-RESOURCE-INVENTORY-V1', resources.map((resource) => ({
    resourceId: resource.resourceId, sourceDigest: resource.sourceDigest, name: resource.name, mediaType: resource.mediaType, ruleId: resource.ruleId
  })));
  if (value.resourceInventoryDigest !== expectedInventoryDigest) fail(code);
  const snapshotBody = immutable({
    profileDigest: value.profileDigest, repositoryBindingDigest: value.repositoryBindingDigest,
    openedRootIdentityDigest: value.openedRootIdentityDigest, activeSetDigest: value.activeSetDigest,
    registrySetDigest: value.registrySetDigest, packageDigest: value.packageDigest,
    resourceCatalogDigest: value.resourceCatalogDigest, projectionPolicyDigest: value.projectionPolicyDigest,
    candidateStatusBodyDigest: value.candidateStatusBodyDigest, orderedSourceObjectDigests: value.orderedSourceObjectDigests,
    authoritativeReadSequence: value.authoritativeReadSequence, observedAtUtc: value.observedAtUtc, expiresAtUtc: value.expiresAtUtc
  });
  if (value.snapshotDigest !== hostAddress('KSTACK-MCP-READ-SNAPSHOT-V1', snapshotBody)) fail(code);
  return immutable({ ...value, resources, issuedAt: value.observedAtUtc, expiresAt: value.expiresAtUtc, byteCount: bytes });
}

export class PublicMcpFacade {
  #profile; #profileDigest; #catalog; #catalogDigest; #projectionPolicy; #backend; #key; #leases = new Map();

  constructor(options) {
    exact(options, ['profile', 'catalog', 'projectionPolicy', 'backend', 'macKey', 'allowTestBackend'], 'KSTACK_MCP_PUBLIC_PROFILE_INVALID');
    const validatedProfile = validateMcpFacadeProfile(options.profile); const validatedCatalog = validateMcpPublicCatalog(options.catalog);
    const validatedPolicy = validateMcpPublicProjectionPolicy(options.projectionPolicy);
    if (validatedCatalog.catalog.profileDigest !== validatedProfile.profileDigest || validatedCatalog.catalog.projectionPolicyDigest !== validatedPolicy.policyDigest) fail('KSTACK_MCP_PUBLIC_PROFILE_INVALID');
    for (let index = 0; index < validatedCatalog.catalog.rules.length; index += 1) {
      const rule = validatedCatalog.catalog.rules[index]; const row = validatedPolicy.policy.rows[index];
      if (rule.ruleId !== row.ruleId || rule.sourceSchemaDigest !== row.sourceSchemaDigest || rule.projectionSchemaDigest !== row.outputSchemaDigest) fail('KSTACK_MCP_PUBLIC_PROFILE_INVALID');
    }
    if (!(options.macKey === null || Buffer.isBuffer(options.macKey) && options.macKey.length === 32 && options.allowTestBackend === true)) fail('KSTACK_MCP_PUBLIC_PROFILE_INVALID');
    this.#profile = validatedProfile.profile; this.#profileDigest = validatedProfile.profileDigest;
    this.#catalog = validatedCatalog.catalog; this.#catalogDigest = validatedCatalog.catalogDigest; this.#projectionPolicy = validatedPolicy.policy;
    this.#backend = validatePublicBackend(options.backend, options.allowTestBackend === true); this.#key = options.macKey ? Buffer.from(options.macKey) : crypto.randomBytes(32);
  }

  capabilities() {
    return immutable({ protocolVersion: this.#profile.protocolVersion, principal: 'PUBLIC_UNAUTHENTICATED_V1', capabilities: { resources: { subscribe: false, listChanged: false } }, methods: PUBLIC_MCP_METHODS, notifications: PUBLIC_MCP_NOTIFICATIONS, tools: [], prompts: [] });
  }

  protocolLimits() {
    return immutable({
      profileDigest: this.#profileDigest,
      protocolVersion: this.#profile.protocolVersion,
      maxFrameBytes: this.#profile.maxFrameBytes,
      maxConcurrentRequests: this.#profile.maxConcurrentRequests,
      maxQueuedRequests: this.#profile.maxQueuedRequests,
      requestDeadlineMs: this.#profile.requestDeadlineMs,
      maxListPageItems: this.#profile.maxListPageItems
    });
  }

  async #now() { const value = await this.#backend.trustedTime(); timestamp(value, 'KSTACK_MCP_PUBLIC_TIME_INVALID'); return value; }
  #purge(now) { for (const [id, lease] of this.#leases) if (lease.expiresAt <= now) this.#leases.delete(id); }

  async list(input) {
    exact(input, ['limit', 'cursor'], 'KSTACK_MCP_PUBLIC_REQUEST_INVALID'); uint(input.limit, this.#profile.maxListPageItems, true, 'KSTACK_MCP_PUBLIC_REQUEST_INVALID');
    const now = await this.#now(); this.#purge(now); let lease; let position = 0;
    if (input.cursor === null) {
      if (this.#leases.size >= this.#profile.maxSnapshotLeases) fail('KSTACK_MCP_RATE_LIMITED');
      const snapshot = validateSnapshotInput(await this.#backend.freezeSnapshot(), this.#profile, this.#catalog, this.#projectionPolicy, this.#backend.descriptor);
      if (snapshot.issuedAt > now || snapshot.expiresAt <= now || Date.parse(snapshot.expiresAt) - Date.parse(snapshot.issuedAt) > this.#profile.maxSnapshotLeaseLifetimeMs) fail('KSTACK_MCP_PUBLIC_SNAPSHOT_INVALID');
      const leaseId = crypto.randomBytes(16).toString('hex');
      const leaseRows = snapshot.resources.map((resource) => {
        const logicalRow = { resourceId: resource.resourceId, sourceDigest: resource.sourceDigest, name: resource.name, mediaType: resource.mediaType, ruleId: resource.ruleId };
        return immutable({
          resourceKeyDigest: hostAddress('KSTACK-MCP-RESOURCE-KEY-V1', logicalRow),
          sourceDigest: resource.sourceDigest,
          bodyDigest: resource.bodyDigest,
          byteCount: resource.bodyBytes.length
        });
      });
      const leaseBody = immutable({
        schemaId: 'kstack.mcp-snapshot-lease.v1', schemaVersion: 1, leaseId,
        profileDigest: this.#profileDigest, repositoryBindingDigest: snapshot.repositoryBindingDigest,
        resourceCatalogDigest: this.#catalogDigest, projectionPolicyDigest: this.#catalog.projectionPolicyDigest,
        snapshotDigest: snapshot.snapshotDigest, resourceInventoryDigest: snapshot.resourceInventoryDigest,
        rows: leaseRows, issuedAtUtc: snapshot.issuedAt, expiresAtUtc: snapshot.expiresAt
      });
      const leaseDigest = hostAddress('KSTACK-MCP-SNAPSHOT-LEASE-V1', leaseBody);
      const tokenFields = immutable({ schemaVersion: 1, leaseId, snapshotDigest: snapshot.snapshotDigest, repositoryBindingDigest: snapshot.repositoryBindingDigest, resourceInventoryDigest: snapshot.resourceInventoryDigest, expiresAt: snapshot.expiresAt });
      const token = encodeToken(this.#key, TOKEN_PREFIX, tokenFields);
      const scoped = snapshot.resources.map((resource, index) => immutable({ ...resource, resourceKeyDigest: leaseRows[index].resourceKeyDigest, uri: `${resource.logicalUri}/snapshot/${token}` }));
      const scopedResourceListDigest = hostAddress('KSTACK-MCP-SCOPED-RESOURCE-LIST-V1', scoped.map((resource) => ({ resourceId: resource.resourceId, uri: resource.uri, bodyDigest: resource.bodyDigest })));
      const leaseByteCount = snapshot.byteCount + Buffer.byteLength(token, 'utf8') + hostCanonicalBytes(scoped.map((resource) => ({ resourceId: resource.resourceId, uri: resource.uri, name: resource.name, mediaType: resource.mediaType }))).length;
      if (leaseByteCount + [...this.#leases.values()].reduce((total, existing) => total + existing.leaseByteCount, 0) > this.#profile.maxSnapshotLeaseBytes) fail('KSTACK_MCP_RATE_LIMITED');
      lease = immutable({ leaseId, ...snapshot, leaseBody, leaseDigest, token, scoped, scopedResourceListDigest, leaseByteCount });
      this.#leases.set(leaseId, lease);
    } else {
      const fields = decodeToken(this.#key, CURSOR_PREFIX, input.cursor, 'KSTACK_MCP_INVALID_CURSOR');
      exact(fields, ['leaseId', 'leaseDigest', 'token', 'scopedResourceListDigest', 'position', 'limit', 'expiresAt'], 'KSTACK_MCP_INVALID_CURSOR');
      if (fields.limit !== input.limit || !Number.isSafeInteger(fields.position) || fields.position < 1 || fields.expiresAt <= now) fail('KSTACK_MCP_INVALID_CURSOR');
      lease = this.#leases.get(fields.leaseId); if (!lease || lease.leaseDigest !== fields.leaseDigest || lease.token !== fields.token
        || lease.scopedResourceListDigest !== fields.scopedResourceListDigest || lease.expiresAt !== fields.expiresAt) fail('KSTACK_MCP_INVALID_CURSOR');
      if (await this.#backend.revalidateSnapshot(immutable({ repositoryBindingDigest: lease.repositoryBindingDigest, snapshotDigest: lease.snapshotDigest })) !== true) fail('KSTACK_MCP_INVALID_CURSOR');
      position = fields.position;
    }
    const rows = lease.scoped.slice(position, position + input.limit).map((resource) => immutable({ uri: resource.uri, name: resource.name, mimeType: resource.mediaType }));
    const nextPosition = position + rows.length;
    const nextCursor = nextPosition < lease.scoped.length ? encodeToken(this.#key, CURSOR_PREFIX, { leaseId: lease.leaseId, leaseDigest: lease.leaseDigest, token: lease.token, scopedResourceListDigest: lease.scopedResourceListDigest, position: nextPosition, limit: input.limit, expiresAt: lease.expiresAt }) : null;
    return immutable({ resources: rows, nextCursor, snapshotDigest: lease.snapshotDigest });
  }

  async read(input) {
    exact(input, ['uri'], 'KSTACK_MCP_PUBLIC_REQUEST_INVALID'); if (typeof input.uri !== 'string') fail('KSTACK_MCP_RESOURCE_NOT_FOUND');
    const marker = '/snapshot/'; const offset = input.uri.lastIndexOf(marker); if (offset < 1) fail('KSTACK_MCP_RESOURCE_NOT_FOUND');
    const logicalUri = input.uri.slice(0, offset); const token = input.uri.slice(offset + marker.length);
    try { publicLogicalUri(logicalUri); } catch { fail('KSTACK_MCP_RESOURCE_NOT_FOUND'); }
    const fields = decodeToken(this.#key, TOKEN_PREFIX, token, 'KSTACK_MCP_RESOURCE_NOT_FOUND');
    exact(fields, ['schemaVersion', 'leaseId', 'snapshotDigest', 'repositoryBindingDigest', 'resourceInventoryDigest', 'expiresAt'], 'KSTACK_MCP_RESOURCE_NOT_FOUND');
    const now = await this.#now(); if (fields.expiresAt <= now) fail('KSTACK_MCP_SNAPSHOT_EXPIRED');
    const lease = this.#leases.get(fields.leaseId); if (!lease) fail('KSTACK_MCP_RESOURCE_SNAPSHOT_UNAVAILABLE');
    if (lease.token !== token || lease.snapshotDigest !== fields.snapshotDigest || lease.repositoryBindingDigest !== fields.repositoryBindingDigest
      || lease.resourceInventoryDigest !== fields.resourceInventoryDigest || lease.expiresAt !== fields.expiresAt) fail('KSTACK_MCP_RESOURCE_NOT_FOUND');
    if (await this.#backend.revalidateSnapshot(immutable({ repositoryBindingDigest: lease.repositoryBindingDigest, snapshotDigest: lease.snapshotDigest })) !== true) fail('KSTACK_MCP_RESOURCE_SNAPSHOT_UNAVAILABLE');
    const parsed = publicLogicalUri(logicalUri);
    const resource = lease.scoped.find((row) => row.logicalUri === logicalUri && row.uri === input.uri); if (!resource) fail('KSTACK_MCP_RESOURCE_NOT_FOUND');
    const expectedResourceKeyDigest = hostAddress('KSTACK-MCP-RESOURCE-KEY-V1', {
      resourceId: resource.resourceId, sourceDigest: parsed.sourceDigest, name: resource.name,
      mediaType: resource.mediaType, ruleId: parsed.ruleId
    });
    if (resource.resourceKeyDigest !== expectedResourceKeyDigest) fail('KSTACK_MCP_RESOURCE_NOT_FOUND');
    return immutable({ uri: resource.uri, mimeType: resource.mediaType, body: resource.body, bodyDigest: resource.bodyDigest });
  }

  close() { this.#leases.clear(); this.#key.fill(0); }
}

export function parseMcpJsonFrame(input, limits) {
  const code = 'KSTACK_MCP_FRAME_INVALID';
  exact(limits, ['maxFrameBytes', 'maxDepth', 'maxNodes', 'maxCollectionItems', 'maxStringBytes'], code);
  for (const key of Object.keys(limits)) uint(limits[key], key === 'maxNodes' ? 1_000_000 : 16_777_216, true, code);
  if (!(input instanceof Uint8Array) || input.byteLength > limits.maxFrameBytes) fail(code);
  let source;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(input); } catch { fail(code); }
  let cursor = 0; let nodes = 0;
  const whitespace = () => { while (/[\x20\x09\x0a\x0d]/u.test(source[cursor] ?? '')) cursor += 1; };
  const string = () => {
    const start = cursor; cursor += 1; let escaped = false;
    while (cursor < source.length) {
      const point = source.charCodeAt(cursor);
      if (!escaped && point === 0x22) {
        cursor += 1; let value;
        try { value = JSON.parse(source.slice(start, cursor)); } catch { fail(code); }
        if (!value.isWellFormed() || value.normalize('NFC') !== value || Buffer.byteLength(value, 'utf8') > limits.maxStringBytes) fail(code);
        return value;
      }
      if (!escaped && point < 0x20) fail(code);
      if (!escaped && point === 0x5c) escaped = true; else escaped = false;
      cursor += 1;
    }
    fail(code);
  };
  const value = (depth) => {
    nodes += 1; if (depth > limits.maxDepth || nodes > limits.maxNodes) fail(code); whitespace();
    const token = source[cursor];
    if (token === '"') return string();
    if (token === '[') {
      cursor += 1; whitespace(); const result = [];
      if (source[cursor] === ']') { cursor += 1; return result; }
      for (;;) {
        if (result.length >= limits.maxCollectionItems) fail(code);
        result.push(value(depth + 1)); whitespace();
        if (source[cursor] === ']') { cursor += 1; return result; }
        if (source[cursor] !== ',') fail(code); cursor += 1;
      }
    }
    if (token === '{') {
      cursor += 1; whitespace(); const result = Object.create(null); let count = 0;
      if (source[cursor] === '}') { cursor += 1; return result; }
      for (;;) {
        if (count >= limits.maxCollectionItems) fail(code); count += 1;
        whitespace(); if (source[cursor] !== '"') fail(code); const key = string();
        if (Object.hasOwn(result, key)) fail('KSTACK_MCP_FRAME_DUPLICATE_KEY');
        whitespace(); if (source[cursor] !== ':') fail(code); cursor += 1; result[key] = value(depth + 1); whitespace();
        if (source[cursor] === '}') { cursor += 1; return result; }
        if (source[cursor] !== ',') fail(code); cursor += 1;
      }
    }
    for (const [literal, result] of [['true', true], ['false', false], ['null', null]]) {
      if (source.startsWith(literal, cursor)) { cursor += literal.length; return result; }
    }
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u.exec(source.slice(cursor));
    if (!match) fail(code); cursor += match[0].length; const number = Number(match[0]);
    if (!Number.isSafeInteger(number)) fail(code); return number;
  };
  const result = value(0); whitespace(); if (cursor !== source.length) fail(code); return immutable(result);
}

function mcpRequestId(value, code) {
  if (!(value === null || Number.isSafeInteger(value) || typeof value === 'string' && value.isWellFormed()
    && value.normalize('NFC') === value && Buffer.byteLength(value, 'utf8') <= 256)) fail(code);
  return value;
}

function mcpWireSymbol(error) {
  const code = error?.code;
  if (code === 'KSTACK_MCP_INVALID_REQUEST') return 'INVALID_REQUEST';
  if (code === 'KSTACK_MCP_INVALID_PARAMS' || code === 'KSTACK_MCP_PUBLIC_REQUEST_INVALID') return 'INVALID_PARAMS';
  if (code === 'KSTACK_MCP_METHOD_NOT_FOUND') return 'METHOD_NOT_FOUND';
  if (code === 'KSTACK_MCP_RESOURCE_NOT_FOUND') return 'RESOURCE_NOT_FOUND';
  if (code === 'KSTACK_MCP_RESOURCE_TOO_LARGE') return 'RESOURCE_TOO_LARGE';
  if (code === 'KSTACK_MCP_INVALID_CURSOR') return 'INVALID_CURSOR';
  if (code === 'KSTACK_MCP_SNAPSHOT_EXPIRED') return 'SNAPSHOT_EXPIRED';
  if (code === 'KSTACK_MCP_RESOURCE_SNAPSHOT_UNAVAILABLE' || code === 'KSTACK_MCP_PUBLIC_SNAPSHOT_INVALID') return 'RESOURCE_SNAPSHOT_UNAVAILABLE';
  if (code === 'KSTACK_MCP_RATE_LIMITED') return 'RATE_LIMITED';
  if (code === 'KSTACK_MCP_CANCELLED') return 'CANCELLED';
  return 'INTERNAL_FAILURE';
}

function requestKey(value) { return hostCanonicalBytes(value).toString('hex'); }

export class PublicMcpProtocolSession {
  #facade; #limits; #correlationKey; #correlationNonceDigest; #sequence = 0; #initialized = false; #ready = false;
  #closed = false; #active = 0; #queued = []; #requests = new Map();

  constructor(options) {
    const code = 'KSTACK_MCP_SESSION_INVALID';
    exact(options, ['facade', 'correlationKey', 'allowTestKey'], code);
    if (!(options.facade instanceof PublicMcpFacade)) fail(code);
    if (!(options.correlationKey === null || Buffer.isBuffer(options.correlationKey) && options.correlationKey.length === 32 && options.allowTestKey === true)) fail(code);
    this.#facade = options.facade; this.#limits = options.facade.protocolLimits();
    this.#correlationKey = options.correlationKey ? Buffer.from(options.correlationKey) : crypto.randomBytes(32);
    this.#correlationNonceDigest = crypto.createHash('sha256').update('KSTACK-MCP-CORRELATION-NONCE-V1').update('\0').update(this.#correlationKey).digest('hex');
  }

  transportLimits() { return this.#limits; }
  #correlationDigest() {
    this.#sequence += 1;
    return hostAddress('KSTACK-MCP-CORRELATION-V1', { correlationNonceDigest: this.#correlationNonceDigest, sequence: this.#sequence });
  }
  #error(symbol, id = null, retryable = false) { return createMcpError(symbol, id, null, retryable, this.#correlationDigest()); }
  #cancel(id) {
    const work = this.#requests.get(requestKey(id)); if (!work) return;
    work.cancel?.();
  }
  #drain() {
    while (!this.#closed && this.#active < this.#limits.maxConcurrentRequests && this.#queued.length) this.#start(this.#queued.shift());
  }
  #start(work) {
    this.#active += 1; work.started = true;
    let timer; let cancelResolve;
    const cancellation = new Promise((resolve) => { cancelResolve = resolve; });
    work.cancel = () => cancelResolve({ kind: 'cancelled' });
    const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve({ kind: 'deadline' }), this.#limits.requestDeadlineMs); });
    const task = Promise.resolve().then(work.task).then((result) => ({ kind: 'result', result }), (error) => ({ kind: 'error', error }));
    Promise.race([task, cancellation, deadline]).then((outcome) => {
      clearTimeout(timer);
      let response;
      if (outcome.kind === 'result') response = immutable({ jsonrpc: '2.0', id: work.id, result: outcome.result });
      else if (outcome.kind === 'cancelled' || outcome.kind === 'deadline') response = this.#error('CANCELLED', work.id, false);
      else response = this.#error(mcpWireSymbol(outcome.error), work.id, ['RATE_LIMITED', 'RESOURCE_SNAPSHOT_UNAVAILABLE'].includes(mcpWireSymbol(outcome.error)));
      this.#requests.delete(work.key); work.resolve(response);
      const release = () => { this.#active -= 1; this.#drain(); };
      if (outcome.kind === 'result' || outcome.kind === 'error') release();
      else task.then(release);
    });
  }
  #schedule(id, task) {
    const key = requestKey(id);
    if (this.#requests.has(key)) return Promise.resolve(this.#error('INVALID_REQUEST', null, false));
    return new Promise((resolve) => {
      const work = { id, key, task, resolve, started: false, cancel: null }; this.#requests.set(key, work);
      if (this.#active < this.#limits.maxConcurrentRequests) this.#start(work);
      else if (this.#queued.length < this.#limits.maxQueuedRequests) {
        work.cancel = () => {
          const index = this.#queued.indexOf(work); if (index < 0) return;
          this.#queued.splice(index, 1); this.#requests.delete(key); resolve(this.#error('CANCELLED', id, false));
        };
        this.#queued.push(work);
      }
      else { this.#requests.delete(key); resolve(this.#error('RATE_LIMITED', id, true)); }
    });
  }
  #initialize(params) {
    const code = 'KSTACK_MCP_PUBLIC_REQUEST_INVALID';
    exact(params, ['protocolVersion', 'capabilities', 'clientInfo'], code);
    if (params.protocolVersion !== this.#limits.protocolVersion || !params.capabilities || typeof params.capabilities !== 'object' || Array.isArray(params.capabilities)) fail(code);
    exact(params.clientInfo, ['name', 'version'], code); boundedAscii(params.clientInfo.name, code); boundedAscii(params.clientInfo.version, code);
    if (this.#initialized) fail(code); this.#initialized = true;
    const advertised = this.#facade.capabilities();
    return immutable({ protocolVersion: advertised.protocolVersion, capabilities: advertised.capabilities, serverInfo: { name: 'kstack-public-readonly-facade', version: '1' } });
  }
  async #dispatch(method, params) {
    const code = 'KSTACK_MCP_PUBLIC_REQUEST_INVALID';
    if (method === 'initialize') return this.#initialize(params);
    if (method === 'ping') { exact(params, [], code); return immutable({}); }
    if (!this.#ready) fail(code);
    if (method === 'resources/list') {
      if (!params || typeof params !== 'object' || Array.isArray(params) || ![0, 1].includes(Object.keys(params).length) || Object.keys(params).some((key) => key !== 'cursor')) fail(code);
      const cursor = Object.hasOwn(params, 'cursor') ? params.cursor : null;
      if (!(cursor === null || typeof cursor === 'string')) fail(code);
      const result = await this.#facade.list({ limit: this.#limits.maxListPageItems, cursor });
      return immutable({ resources: result.resources, ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) });
    }
    if (method === 'resources/read') {
      exact(params, ['uri'], code); if (typeof params.uri !== 'string') fail(code);
      const result = await this.#facade.read({ uri: params.uri });
      return immutable({ contents: [{ uri: result.uri, mimeType: result.mimeType, text: hostCanonicalBytes(result.body).toString('utf8') }] });
    }
    fail('KSTACK_MCP_METHOD_NOT_FOUND');
  }
  #notification(method, params) {
    const code = 'KSTACK_MCP_PUBLIC_REQUEST_INVALID';
    if (method === 'notifications/initialized') {
      exact(params, [], code); if (!this.#initialized || this.#ready) fail(code); this.#ready = true; return;
    }
    if (method === 'notifications/cancelled') {
      if (!params || typeof params !== 'object' || Array.isArray(params)) fail(code);
      const keys = Object.keys(params).sort();
      if (JSON.stringify(keys) !== JSON.stringify(Object.hasOwn(params, 'reason') ? ['reason', 'requestId'] : ['requestId'])) fail(code);
      mcpRequestId(params.requestId, code);
      if (Object.hasOwn(params, 'reason') && (typeof params.reason !== 'string' || Buffer.byteLength(params.reason, 'utf8') > 256)) fail(code);
      this.#cancel(params.requestId); return;
    }
  }
  async handleFrame(bytes) {
    if (this.#closed) return null;
    const parseLimits = { maxFrameBytes: this.#limits.maxFrameBytes, maxDepth: 32, maxNodes: 4096, maxCollectionItems: 1024, maxStringBytes: Math.min(this.#limits.maxFrameBytes, 65_536) };
    let request;
    try { request = parseMcpJsonFrame(bytes, parseLimits); }
    catch (error) { return this.#error(error?.code === 'KSTACK_MCP_FRAME_DUPLICATE_KEY' ? 'INVALID_REQUEST' : 'PARSE_ERROR', null, false); }
    let id = null; let hasId = false; let method; let params;
    try {
      if (!request || typeof request !== 'object' || Array.isArray(request)) fail('KSTACK_MCP_INVALID_REQUEST');
      const keys = Object.keys(request); if (keys.some((key) => !['jsonrpc', 'id', 'method', 'params'].includes(key)) || !keys.includes('jsonrpc') || !keys.includes('method')) fail('KSTACK_MCP_INVALID_REQUEST');
      if (request.jsonrpc !== '2.0' || typeof request.method !== 'string' || request.method.length < 1 || Buffer.byteLength(request.method, 'utf8') > 128) fail('KSTACK_MCP_INVALID_REQUEST');
      hasId = Object.hasOwn(request, 'id'); if (hasId) id = mcpRequestId(request.id, 'KSTACK_MCP_INVALID_REQUEST');
      method = request.method; params = Object.hasOwn(request, 'params') ? request.params : Object.create(null);
      if (!params || typeof params !== 'object' || Array.isArray(params)) fail('KSTACK_MCP_INVALID_PARAMS');
    } catch (error) {
      return this.#error(error?.code === 'KSTACK_MCP_INVALID_PARAMS' ? 'INVALID_PARAMS' : 'INVALID_REQUEST', null, false);
    }
    if (!hasId) {
      try { this.#notification(method, params); } catch { /* valid notifications never receive a response */ }
      return null;
    }
    if (!PUBLIC_MCP_METHODS.includes(method)) return this.#error('METHOD_NOT_FOUND', id, false);
    return this.#schedule(id, async () => {
      try { return await this.#dispatch(method, params); }
      catch (error) {
        if (error?.code === 'KSTACK_MCP_PUBLIC_REQUEST_INVALID') throw Object.assign(new Error('invalid params'), { code: 'KSTACK_MCP_INVALID_PARAMS' });
        throw error;
      }
    });
  }
  close() {
    if (this.#closed) return;
    this.#closed = true;
    for (const work of this.#queued.splice(0)) { this.#requests.delete(work.key); work.resolve(this.#error('CANCELLED', work.id, false)); }
    for (const work of this.#requests.values()) work.cancel?.();
    this.#facade.close(); this.#correlationKey.fill(0);
  }
}

export async function runPublicMcpStdio(options) {
  const code = 'KSTACK_MCP_STDIO_INVALID';
  exact(options, ['session', 'input', 'writeFrame', 'fixedDiagnostic'], code);
  if (!(options.session instanceof PublicMcpProtocolSession) || !options.input || typeof options.input[Symbol.asyncIterator] !== 'function'
    || typeof options.writeFrame !== 'function' || typeof options.fixedDiagnostic !== 'function') fail(code);
  const limits = options.session.transportLimits(); let pending = new Set(); let buffered = Buffer.alloc(0); let writeChain = Promise.resolve(); let fatal = false;
  const submit = (line) => {
    const operation = options.session.handleFrame(line).then((response) => {
      if (response === null) return;
      const frame = Buffer.concat([hostCanonicalBytes(response), Buffer.from('\n')]);
      writeChain = writeChain.then(() => options.writeFrame(frame)); return writeChain;
    });
    pending.add(operation); operation.then(() => pending.delete(operation), () => pending.delete(operation));
  };
  try {
    for await (const chunk of options.input) {
      if (!(chunk instanceof Uint8Array)) { fatal = true; break; }
      let offset = 0;
      while (offset < chunk.byteLength) {
        const newline = chunk.indexOf(0x0a, offset);
        const end = newline < 0 ? chunk.byteLength : newline;
        const segmentLength = end - offset;
        if (buffered.length + segmentLength > limits.maxFrameBytes) { fatal = true; break; }
        if (segmentLength) buffered = Buffer.concat([buffered, Buffer.from(chunk.subarray(offset, end))]);
        if (newline < 0) break;
        submit(buffered); buffered = Buffer.alloc(0); offset = newline + 1;
        const capacity = limits.maxConcurrentRequests + limits.maxQueuedRequests + 1;
        if (pending.size >= capacity) await Promise.race(pending);
      }
      if (fatal) break;
    }
    if (!fatal && buffered.length) submit(buffered);
    if (fatal) { options.session.close(); await options.fixedDiagnostic('KSTACK_MCP_STDIO_FRAME_INVALID'); }
    await Promise.allSettled([...pending]); await writeChain;
  } finally { options.session.close(); }
  return immutable({ closed: true, fatalFramingError: fatal });
}

export function validateMcpTransportProfile(value) {
  const code = 'KSTACK_MCP_TRANSPORT_UNQUALIFIED';
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'profileId', 'implementationDigest', 'configDigest', 'peerAuthenticationPrimitiveId',
    'channelBindingConstructionId', 'principalAssurance', 'endpointIdentityDigest', 'limitsDigest', 'revocationSourceDigest',
    'negativeVectorDigests', 'transportKind', 'localOnly', 'confidentiality', 'integrity', 'replayProtection', 'peerCredentialQuery',
    'peerProcessBinding', 'protectedListenerAcl', 'qualifiedOutcome'
  ], code);
  if (value.schemaId !== 'kstack.mcp-transport-profile.v1' || value.schemaVersion !== 1) fail(code);
  digest(value.schemaSetDigest, code); ascii(value.profileId, code);
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, code);
  ascii(value.peerAuthenticationPrimitiveId, code); ascii(value.channelBindingConstructionId, code);
  enumeration(value.principalAssurance, ['OS_AUTHENTICATED_PROCESS', 'UNAUTHENTICATED'], code);
  sortedUnique(value.negativeVectorDigests, digest, 1, 64, code);
  for (const key of ['localOnly', 'confidentiality', 'integrity', 'replayProtection', 'peerCredentialQuery', 'peerProcessBinding', 'protectedListenerAcl']) bool(value[key], code);
  if (value.transportKind !== 'PROTECTED_LOCAL_IPC' || value.principalAssurance !== 'OS_AUTHENTICATED_PROCESS'
    || value.qualifiedOutcome !== 'PROVEN' || ['localOnly', 'confidentiality', 'integrity', 'replayProtection', 'peerCredentialQuery', 'peerProcessBinding', 'protectedListenerAcl'].some((key) => !value[key])) fail(code);
  return immutable({ profile: value, profileDigest: hostAddress('KSTACK-MCP-TRANSPORT-PROFILE-V1', value) });
}

export function deriveMcpPrincipalContext(input) {
  const code = 'KSTACK_MCP_PRINCIPAL_INVALID';
  exact(input, [
    'schemaSetDigest', 'transportProfileDigest', 'channelBindingDigest', 'principalRoleId', 'accountIdentityDigest',
    'peerProcessIdentityDigest', 'peerStartIdentityDigest', 'peerExecutableDigest', 'peerBuildDigest', 'hostSessionDigest',
    'repositoryContextDigest', 'worktreeIdentityDigest', 'openedRootIdentityDigest', 'endpointIdentityDigest', 'activeSetDigest',
    'policyDigest', 'assuranceLevel', 'issuedAt', 'expiresAt', 'trustedTimeSampleDigest', 'protectedDerivation'
  ], code);
  digest(input.schemaSetDigest, code); ascii(input.principalRoleId, code);
  for (const [key, entry] of Object.entries(input)) if (key.endsWith('Digest')) digest(entry, code);
  enumeration(input.assuranceLevel, ['OS_AUTHENTICATED_PROCESS'], code); bool(input.protectedDerivation, code);
  timestamp(input.issuedAt, code); timestamp(input.expiresAt, code);
  if (!input.protectedDerivation || input.issuedAt >= input.expiresAt) fail(code);
  const context = immutable({ schemaId: 'kstack.mcp-principal-context.v1', schemaVersion: 1, ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'protectedDerivation')) });
  return immutable({ context, contextDigest: hostAddress('KSTACK-MCP-PRINCIPAL-CONTEXT-V1', context) });
}

export function validateMcpAcl(value) {
  const code = 'KSTACK_MCP_ACL_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'aclId', 'rows'], code);
  if (value.schemaId !== 'kstack.mcp-acl.v1' || value.schemaVersion !== 1) fail(code);
  digest(value.schemaSetDigest, code); ascii(value.aclId, code); if (!Array.isArray(value.rows) || value.rows.length > 1024) fail(code);
  const keys = [];
  for (const row of value.rows) {
    exact(row, ['rowId', 'principalRoleId', 'repositoryContextDigest', 'transportAssurance', 'methodId', 'objectId', 'operationProfileId', 'inputSchemaDigest', 'outputPolicyId', 'outputPolicyDigest', 'maxFrameBytes', 'maxOutputBytes', 'requiredEligibilityClass', 'requiredAuthorityClass'], code);
    for (const key of ['rowId', 'principalRoleId', 'objectId', 'operationProfileId', 'outputPolicyId', 'requiredEligibilityClass', 'requiredAuthorityClass']) ascii(row[key], code);
    mcpMethod(row.methodId, code);
    for (const key of ['repositoryContextDigest', 'inputSchemaDigest', 'outputPolicyDigest']) digest(row[key], code);
    if (row.transportAssurance !== 'OS_AUTHENTICATED_PROCESS' || [row.methodId, row.objectId, row.operationProfileId].some((entry) => entry.includes('*'))) fail(code);
    uint(row.maxFrameBytes, 1_048_576, true, code); uint(row.maxOutputBytes, 1_048_576, true, code);
    keys.push(`${row.principalRoleId}\0${row.repositoryContextDigest}\0${row.methodId}\0${row.objectId}`);
  }
  if (new Set(keys).size !== keys.length) fail(code);
  return immutable({ acl: value, aclDigest: hostAddress('KSTACK-MCP-ACL-V1', value) });
}

export function negotiateMcpCapabilities(input) {
  exact(input, ['registeredCapabilityIds', 'offeredCapabilityIds', 'aclCapabilityIds'], 'KSTACK_MCP_CAPABILITY_INVALID');
  for (const key of Object.keys(input)) sortedUnique(input[key], ascii, 0, 1024, 'KSTACK_MCP_CAPABILITY_INVALID');
  const registered = new Set(input.registeredCapabilityIds); const acl = new Set(input.aclCapabilityIds);
  const selected = input.offeredCapabilityIds.filter((id) => registered.has(id) && acl.has(id));
  return immutable({ selectedCapabilityIds: selected, selectedCapabilitySetDigest: hostAddress('KSTACK-MCP-CAPABILITY-SET-V1', selected) });
}

export function classifyMcpBoundary(input) {
  exact(input, ['profile', 'publicMethod', 'publicProjectionValid', 'transportQualified', 'principalAuthenticated', 'sessionActive', 'sequenceValid', 'capabilityAdvertised', 'aclExact', 'outputAdmissible', 'releaseContextEqual'], 'KSTACK_MCP_CLASSIFICATION_INVALID');
  enumeration(input.profile, ['PUBLIC', 'RESTRICTED'], 'KSTACK_MCP_CLASSIFICATION_INVALID');
  for (const [key, value] of Object.entries(input)) if (key !== 'profile') bool(value, 'KSTACK_MCP_CLASSIFICATION_INVALID');
  if (input.profile === 'PUBLIC') return input.publicMethod && input.publicProjectionValid ? 'PUBLIC_RELEASE' : 'DENY';
  if (!input.transportQualified || !input.principalAuthenticated || !input.sessionActive || !input.sequenceValid || !input.capabilityAdvertised || !input.aclExact) return 'DENY';
  if (!input.outputAdmissible || !input.releaseContextEqual) return 'SUPPRESS';
  return 'RESTRICTED_RELEASE';
}

export function mcpCapabilityId(methodId, objectId) {
  mcpMethod(methodId, 'KSTACK_MCP_CAPABILITY_INVALID'); ascii(objectId, 'KSTACK_MCP_CAPABILITY_INVALID');
  return hostAddress('KSTACK-MCP-CAPABILITY-ID-V1', { methodId, objectId }).slice(7);
}

export function validateMcpOutputPolicy(value) {
  const code = 'KSTACK_MCP_OUTPUT_POLICY_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'policyId', 'methodId', 'outputSchemaDigest', 'fields', 'maxBytes', 'maxItems', 'maxDepth', 'maxStringBytes', 'encoding', 'escaping', 'redactionDisposition', 'untrustedEnvelopeId', 'allowedMediaTypes', 'allowedUriSchemes', 'truncationDisposition', 'requiresReleaseRevalidation'], code);
  if (value.schemaId !== 'kstack.mcp-output-policy.v1' || value.schemaVersion !== 1) fail(code);
  digest(value.schemaSetDigest, code); ascii(value.policyId, code); mcpMethod(value.methodId, code); digest(value.outputSchemaDigest, code); ascii(value.untrustedEnvelopeId, code);
  if (!Array.isArray(value.fields) || value.fields.length < 1 || value.fields.length > 256) fail(code);
  const ids = [];
  for (const field of value.fields) {
    exact(field, ['fieldId', 'classification', 'valueType', 'modelVisible'], code); ascii(field.fieldId, code); ids.push(field.fieldId);
    enumeration(field.classification, MCP_OUTPUT_CLASSES, code); enumeration(field.valueType, ['BOOLEAN', 'DIGEST', 'INTEGER', 'STRING'], code); bool(field.modelVisible, code);
    if (['PROHIBITED', 'PROTECTED_DIAGNOSTIC'].includes(field.classification) || field.classification === 'MODEL_VISIBLE_UNTRUSTED' !== field.modelVisible) fail(code);
  }
  if (new Set(ids).size !== ids.length || ids.some((id, index) => index > 0 && id <= ids[index - 1])) fail(code);
  uint(value.maxBytes, 1_048_576, true, code); uint(value.maxItems, 256, true, code); uint(value.maxDepth, 32, true, code); uint(value.maxStringBytes, 16_384, true, code);
  if (value.encoding !== 'UTF-8' || value.escaping !== 'JSON_CANONICAL' || value.redactionDisposition !== 'DENY_ON_MATCH' || value.truncationDisposition !== 'DENY') fail(code);
  sortedUnique(value.allowedMediaTypes, boundedAscii, 1, 32, code); sortedUnique(value.allowedUriSchemes, ascii, 0, 16, code); if (!value.requiresReleaseRevalidation) fail(code);
  return immutable({ policy: value, policyDigest: hostAddress('KSTACK-MCP-OUTPUT-POLICY-V1', value) });
}

const SECRET_LIKE = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~-]{16,}|\b(?:password|api[_-]?key|token|secret)\s*[:=]\s*\S{12,})/iu;
export function projectMcpOutput(input) {
  exact(input, ['policy', 'methodId', 'outputSchemaDigest', 'items'], 'KSTACK_MCP_OUTPUT_SCHEMA_INVALID');
  const validated = validateMcpOutputPolicy(input.policy); if (input.methodId !== validated.policy.methodId || input.outputSchemaDigest !== validated.policy.outputSchemaDigest) fail('KSTACK_MCP_OUTPUT_SCHEMA_INVALID');
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > validated.policy.maxItems) fail('KSTACK_MCP_OUTPUT_SCHEMA_INVALID');
  const ids = new Set(); const projected = [];
  for (const item of input.items) {
    exact(item, ['fieldId', 'classification', 'sourceDigest', 'value'], 'KSTACK_MCP_OUTPUT_SCHEMA_INVALID');
    const row = validated.policy.fields.find((field) => field.fieldId === item.fieldId); if (!row || ids.has(item.fieldId) || item.classification !== row.classification) fail('KSTACK_MCP_OUTPUT_SCHEMA_INVALID'); ids.add(item.fieldId);
    digest(item.sourceDigest, 'KSTACK_MCP_OUTPUT_SCHEMA_INVALID');
    if (row.valueType === 'DIGEST') digest(item.value, 'KSTACK_MCP_OUTPUT_SCHEMA_INVALID');
    else if (row.valueType === 'INTEGER') uint(item.value, Number.MAX_SAFE_INTEGER, false, 'KSTACK_MCP_OUTPUT_SCHEMA_INVALID');
    else if (row.valueType === 'BOOLEAN') bool(item.value, 'KSTACK_MCP_OUTPUT_SCHEMA_INVALID');
    else if (typeof item.value !== 'string' || !item.value.isWellFormed() || item.value.normalize('NFC') !== item.value || Buffer.byteLength(item.value, 'utf8') > validated.policy.maxStringBytes || SECRET_LIKE.test(item.value)) fail('KSTACK_MCP_OUTPUT_PROHIBITED');
    projected.push(row.classification === 'MODEL_VISIBLE_UNTRUSTED'
      ? immutable({ fieldId: item.fieldId, classification: row.classification, sourceDigest: item.sourceDigest, untrustedEnvelopeId: validated.policy.untrustedEnvelopeId, textDigest: hostAddress('KSTACK-MCP-UNTRUSTED-TEXT-V1', item.value), value: item.value })
      : immutable(item));
  }
  const body = immutable({ schemaId: 'kstack.mcp-output.v1', schemaVersion: 1, methodId: input.methodId, outputSchemaDigest: input.outputSchemaDigest, policyDigest: validated.policyDigest, items: projected });
  const bytes = hostCanonicalBytes(body); if (bytes.length > validated.policy.maxBytes) fail('KSTACK_MCP_OUTPUT_TOO_LARGE');
  return immutable({ body, bytes, byteDigest: hostAddress('KSTACK-MCP-OUTPUT-BYTES-V1', body), policyDigest: validated.policyDigest });
}

function validateRestrictedBackend(backend, allowTestBackend) {
  exact(backend, ['descriptor', 'append', 'authenticatePrincipal', 'mintNonceDigest', 'atomicRevalidate', 'releaseFrame'], 'KSTACK_MCP_TRANSPORT_UNQUALIFIED');
  exact(backend.descriptor, ['protectionClass', 'repositoryWritable', 'agentWritable', 'durableLedger', 'atomicPublication'], 'KSTACK_MCP_TRANSPORT_UNQUALIFIED');
  const classes = ['os-protected', 'qualified-service']; if (allowTestBackend) classes.push('test-only');
  if (!classes.includes(backend.descriptor.protectionClass) || backend.descriptor.repositoryWritable !== false || backend.descriptor.agentWritable !== false
    || backend.descriptor.durableLedger !== true || backend.descriptor.atomicPublication !== true
    || ['append', 'authenticatePrincipal', 'mintNonceDigest', 'atomicRevalidate', 'releaseFrame'].some((key) => typeof backend[key] !== 'function')) fail('KSTACK_MCP_TRANSPORT_UNQUALIFIED');
  return backend;
}

export class ProtectedMcpBoundary {
  #schemaSetDigest; #backend; #sessions = new Map(); #tickets = new Map();
  constructor(options) {
    exact(options, ['schemaSetDigest', 'backend', 'allowTestBackend'], 'KSTACK_MCP_TRANSPORT_UNQUALIFIED');
    this.#schemaSetDigest = digest(options.schemaSetDigest, 'KSTACK_MCP_TRANSPORT_UNQUALIFIED'); this.#backend = validateRestrictedBackend(options.backend, options.allowTestBackend === true);
  }

  async openSession(input) {
    exact(input, ['transportProfile', 'principalContext', 'acl', 'offeredCapabilityIds', 'registeredCapabilityIds', 'maximumRequestCount', 'maximumOutputCount', 'maximumFrameBytes', 'maximumOutputBytes', 'createdAt', 'expiresAt', 'revocationSequence'], 'KSTACK_MCP_SESSION_INVALID');
    const transport = validateMcpTransportProfile(input.transportProfile); const principal = deriveMcpPrincipalContext({ ...input.principalContext, protectedDerivation: true }); const acl = validateMcpAcl(input.acl);
    if (transport.profile.schemaSetDigest !== this.#schemaSetDigest || principal.context.schemaSetDigest !== this.#schemaSetDigest || acl.acl.schemaSetDigest !== this.#schemaSetDigest
      || principal.context.transportProfileDigest !== transport.profileDigest || principal.context.endpointIdentityDigest !== transport.profile.endpointIdentityDigest
      || principal.context.expiresAt < input.expiresAt || input.createdAt >= input.expiresAt) fail('KSTACK_MCP_SESSION_INVALID');
    if (await this.#backend.authenticatePrincipal(immutable({ transportProfile: transport.profile, principalContext: principal.context })) !== true) fail('KSTACK_MCP_PRINCIPAL_INVALID');
    timestamp(input.createdAt, 'KSTACK_MCP_SESSION_INVALID'); timestamp(input.expiresAt, 'KSTACK_MCP_SESSION_INVALID');
    uint(input.maximumRequestCount, 1_000_000, true, 'KSTACK_MCP_SESSION_INVALID'); uint(input.maximumOutputCount, 1_000_000, true, 'KSTACK_MCP_SESSION_INVALID'); uint(input.maximumFrameBytes, 1_048_576, true, 'KSTACK_MCP_SESSION_INVALID'); uint(input.maximumOutputBytes, 1_048_576, true, 'KSTACK_MCP_SESSION_INVALID'); uint(input.revocationSequence, Number.MAX_SAFE_INTEGER, false, 'KSTACK_MCP_SESSION_INVALID');
    const applicableRows = acl.acl.rows.filter((row) => row.principalRoleId === principal.context.principalRoleId && row.repositoryContextDigest === principal.context.repositoryContextDigest);
    const aclCapabilities = applicableRows.map((row) => mcpCapabilityId(row.methodId, row.objectId)).sort();
    const negotiated = negotiateMcpCapabilities({ registeredCapabilityIds: input.registeredCapabilityIds, offeredCapabilityIds: input.offeredCapabilityIds, aclCapabilityIds: aclCapabilities });
    const nonceDigest = await this.#backend.mintNonceDigest(); digest(nonceDigest, 'KSTACK_MCP_SESSION_INVALID');
    const session = immutable({
      schemaId: 'kstack.mcp-session.v1', schemaVersion: 1, schemaSetDigest: this.#schemaSetDigest, contextDigest: principal.contextDigest,
      protectedNonceDigest: nonceDigest, sequence: 0, offeredCapabilitySetDigest: hostAddress('KSTACK-MCP-CAPABILITY-SET-V1', input.offeredCapabilityIds),
      selectedCapabilitySetDigest: negotiated.selectedCapabilitySetDigest, selectedCapabilityIds: negotiated.selectedCapabilityIds,
      aclDigest: acl.aclDigest, outputPolicySetDigest: hostAddress('KSTACK-MCP-OUTPUT-POLICY-SET-V1', [...new Set(applicableRows.map((row) => row.outputPolicyDigest))].sort()),
      maximumRequestCount: input.maximumRequestCount, maximumOutputCount: input.maximumOutputCount, maximumFrameBytes: input.maximumFrameBytes,
      maximumOutputBytes: input.maximumOutputBytes, createdAt: input.createdAt, expiresAt: input.expiresAt,
      revocationSequence: input.revocationSequence, state: 'ACTIVE'
    });
    const sessionDigest = hostAddress('KSTACK-MCP-SESSION-V1', session); if (this.#sessions.has(sessionDigest)) fail('KSTACK_MCP_SESSION_INVALID');
    const receipt = await this.#backend.append(immutable({ event: 'SESSION_OPENED', sessionDigest, sequence: 0 })); digest(receipt, 'KSTACK_MCP_SESSION_LEDGER_INVALID');
    this.#sessions.set(sessionDigest, { session, principal: principal.context, acl: acl.acl, rows: applicableRows, requestCount: 0, outputCount: 0 });
    return immutable({ sessionDigest, selectedCapabilityIds: negotiated.selectedCapabilityIds, protectedLedgerReceiptDigest: receipt });
  }

  async admitRequest(input) {
    exact(input, ['sessionDigest', 'sequence', 'methodId', 'objectId', 'operationProfileId', 'operationRequestDigest', 'inputSchemaDigest', 'frameBytes', 'bindingSnapshot'], 'KSTACK_MCP_REQUEST_INVALID');
    digest(input.sessionDigest, 'KSTACK_MCP_REQUEST_INVALID'); mcpMethod(input.methodId, 'KSTACK_MCP_REQUEST_INVALID'); ascii(input.objectId, 'KSTACK_MCP_REQUEST_INVALID'); ascii(input.operationProfileId, 'KSTACK_MCP_REQUEST_INVALID'); digest(input.operationRequestDigest, 'KSTACK_MCP_REQUEST_INVALID'); digest(input.inputSchemaDigest, 'KSTACK_MCP_REQUEST_INVALID'); uint(input.frameBytes, 1_048_576, true, 'KSTACK_MCP_REQUEST_INVALID');
    const state = this.#sessions.get(input.sessionDigest); if (!state || state.session.state !== 'ACTIVE' || input.sequence !== state.session.sequence + 1 || state.requestCount >= state.session.maximumRequestCount || input.frameBytes > state.session.maximumFrameBytes) fail('KSTACK_MCP_REPLAY_OR_SESSION_INVALID');
    exact(input.bindingSnapshot, ['contextDigest', 'channelBindingDigest', 'peerProcessIdentityDigest', 'peerStartIdentityDigest', 'repositoryContextDigest', 'openedRootIdentityDigest', 'activeSetDigest', 'policyDigest', 'aclDigest', 'eligibilityDigest', 'eligibilityClass', 'authorityDigest', 'authorityClass', 'brokerEvaluationDigest', 'fenceDigest', 'outputPolicyDigest', 'revocationSequence', 'observedAt'], 'KSTACK_MCP_RELEASE_CONTEXT_CHANGED');
    for (const [key, value] of Object.entries(input.bindingSnapshot)) if (key.endsWith('Digest')) digest(value, 'KSTACK_MCP_RELEASE_CONTEXT_CHANGED'); timestamp(input.bindingSnapshot.observedAt, 'KSTACK_MCP_RELEASE_CONTEXT_CHANGED');
    ascii(input.bindingSnapshot.eligibilityClass, 'KSTACK_MCP_RELEASE_CONTEXT_CHANGED'); ascii(input.bindingSnapshot.authorityClass, 'KSTACK_MCP_RELEASE_CONTEXT_CHANGED');
    const expected = state.principal;
    if (input.bindingSnapshot.contextDigest !== state.session.contextDigest || input.bindingSnapshot.channelBindingDigest !== expected.channelBindingDigest
      || input.bindingSnapshot.peerProcessIdentityDigest !== expected.peerProcessIdentityDigest || input.bindingSnapshot.peerStartIdentityDigest !== expected.peerStartIdentityDigest
      || input.bindingSnapshot.repositoryContextDigest !== expected.repositoryContextDigest || input.bindingSnapshot.openedRootIdentityDigest !== expected.openedRootIdentityDigest
      || input.bindingSnapshot.activeSetDigest !== expected.activeSetDigest || input.bindingSnapshot.policyDigest !== expected.policyDigest
      || input.bindingSnapshot.aclDigest !== state.session.aclDigest || input.bindingSnapshot.revocationSequence !== state.session.revocationSequence
      || input.bindingSnapshot.observedAt >= state.session.expiresAt) fail('KSTACK_MCP_RELEASE_CONTEXT_CHANGED');
    const capability = mcpCapabilityId(input.methodId, input.objectId); if (!state.session.selectedCapabilityIds.includes(capability)) fail('KSTACK_MCP_METHOD_NOT_ADVERTISED');
    const row = state.rows.find((candidate) => candidate.methodId === input.methodId && candidate.objectId === input.objectId
      && candidate.operationProfileId === input.operationProfileId && candidate.inputSchemaDigest === input.inputSchemaDigest); if (!row) fail('KSTACK_MCP_ACL_DENIED');
    if (input.bindingSnapshot.outputPolicyDigest !== row.outputPolicyDigest || input.bindingSnapshot.eligibilityClass !== row.requiredEligibilityClass
      || input.bindingSnapshot.authorityClass !== row.requiredAuthorityClass
      || await this.#backend.atomicRevalidate(immutable({ phase: 'ADMISSION', sessionDigest: input.sessionDigest, sequence: input.sequence, expectedBindingSnapshot: input.bindingSnapshot, currentBindingSnapshot: input.bindingSnapshot })) !== true) fail('KSTACK_MCP_RELEASE_CONTEXT_CHANGED');
    const ticket = immutable({ sessionDigest: input.sessionDigest, sequence: input.sequence, methodId: input.methodId, objectId: input.objectId, operationProfileId: input.operationProfileId, operationRequestDigest: input.operationRequestDigest, inputSchemaDigest: input.inputSchemaDigest, aclRowId: row.rowId, outputPolicyId: row.outputPolicyId, outputPolicyDigest: row.outputPolicyDigest, bindingSnapshotDigest: hostAddress('KSTACK-MCP-BINDING-SNAPSHOT-V1', input.bindingSnapshot) });
    const ticketDigest = hostAddress('KSTACK-MCP-REQUEST-TICKET-V1', ticket); const receipt = await this.#backend.append(immutable({ event: 'REQUEST_ADMITTED', sessionDigest: input.sessionDigest, sequence: input.sequence, ticketDigest })); digest(receipt, 'KSTACK_MCP_SESSION_LEDGER_INVALID');
    state.session = immutable({ ...state.session, sequence: input.sequence }); state.requestCount += 1; this.#tickets.set(ticketDigest, { ticket, bindingSnapshot: input.bindingSnapshot, row, consumed: false });
    return immutable({ ticketDigest, outputPolicyId: row.outputPolicyId, protectedLedgerReceiptDigest: receipt });
  }

  async release(input) {
    exact(input, ['ticketDigest', 'projection', 'outputPolicy', 'currentBindingSnapshot'], 'KSTACK_MCP_RELEASE_INVALID'); digest(input.ticketDigest, 'KSTACK_MCP_RELEASE_INVALID');
    const pending = this.#tickets.get(input.ticketDigest); if (!pending || pending.consumed) fail('KSTACK_MCP_RELEASE_INVALID'); pending.consumed = true;
    const projected = projectMcpOutput({ policy: input.outputPolicy, methodId: pending.ticket.methodId, outputSchemaDigest: input.outputPolicy.outputSchemaDigest, items: input.projection });
    if (projected.policyDigest !== pending.ticket.outputPolicyDigest || projected.bytes.length > pending.row.maxOutputBytes) fail('KSTACK_MCP_OUTPUT_POLICY_INVALID');
    exact(input.currentBindingSnapshot, Object.keys(pending.bindingSnapshot), 'KSTACK_MCP_RELEASE_CONTEXT_CHANGED');
    for (const [key, value] of Object.entries(input.currentBindingSnapshot)) if (key.endsWith('Digest')) digest(value, 'KSTACK_MCP_RELEASE_CONTEXT_CHANGED'); timestamp(input.currentBindingSnapshot.observedAt, 'KSTACK_MCP_RELEASE_CONTEXT_CHANGED');
    const sessionState = this.#sessions.get(pending.ticket.sessionDigest);
    const stableBindingEqual = Object.keys(pending.bindingSnapshot).filter((key) => key !== 'observedAt').every((key) => input.currentBindingSnapshot[key] === pending.bindingSnapshot[key]);
    if (!sessionState || sessionState.session.state !== 'ACTIVE' || sessionState.outputCount >= sessionState.session.maximumOutputCount
      || !stableBindingEqual || input.currentBindingSnapshot.observedAt < pending.bindingSnapshot.observedAt || input.currentBindingSnapshot.observedAt >= sessionState.session.expiresAt
      || await this.#backend.atomicRevalidate(immutable({ sessionDigest: pending.ticket.sessionDigest, sequence: pending.ticket.sequence, expectedBindingSnapshot: pending.bindingSnapshot, currentBindingSnapshot: input.currentBindingSnapshot })) !== true) {
      const receipt = await this.#backend.append(immutable({ event: 'RELEASE_SUPPRESSED', ticketDigest: input.ticketDigest, reason: 'KSTACK_MCP_RELEASE_CONTEXT_CHANGED' })); digest(receipt, 'KSTACK_MCP_SESSION_LEDGER_INVALID');
      fail('KSTACK_MCP_RELEASE_CONTEXT_CHANGED');
    }
    const releaseReceipt = await this.#backend.releaseFrame(projected.bytes); digest(releaseReceipt, 'KSTACK_MCP_RELEASE_INVALID');
    sessionState.outputCount += 1;
    const classificationCounts = Object.fromEntries(MCP_OUTPUT_CLASSES.map((classification) => [classification, projected.body.items.filter((item) => item.classification === classification).length]));
    const audit = immutable({
      schemaId: 'kstack.mcp-release-audit.v1', schemaVersion: 1, sessionDigest: pending.ticket.sessionDigest,
      requestTicketDigest: input.ticketDigest, sequence: pending.ticket.sequence, methodId: pending.ticket.methodId,
      inputSchemaDigest: pending.ticket.inputSchemaDigest, outputSchemaDigest: projected.body.outputSchemaDigest,
      outputByteDigest: projected.byteDigest, classificationCounts, aclRowId: pending.ticket.aclRowId,
      outputPolicyDigest: projected.policyDigest, repositoryContextDigest: pending.bindingSnapshot.repositoryContextDigest,
      activeSetDigest: pending.bindingSnapshot.activeSetDigest, policyDigest: pending.bindingSnapshot.policyDigest,
      eligibilityDigest: pending.bindingSnapshot.eligibilityDigest, authorityDigest: pending.bindingSnapshot.authorityDigest,
      brokerEvaluationDigest: pending.bindingSnapshot.brokerEvaluationDigest, fenceDigest: pending.bindingSnapshot.fenceDigest,
      operationProfileId: pending.ticket.operationProfileId, operationRequestDigest: pending.ticket.operationRequestDigest,
      releaseSnapshotDigest: hostAddress('KSTACK-MCP-BINDING-SNAPSHOT-V1', input.currentBindingSnapshot), releasedAt: input.currentBindingSnapshot.observedAt, outcome: 'RELEASED'
    });
    const auditDigest = hostAddress('KSTACK-MCP-RELEASE-AUDIT-V1', audit); const auditReceipt = await this.#backend.append(immutable({ event: 'RELEASED', ticketDigest: input.ticketDigest, auditDigest })); digest(auditReceipt, 'KSTACK_MCP_SESSION_LEDGER_INVALID');
    return immutable({ releaseReceiptDigest: releaseReceipt, audit, auditDigest, protectedLedgerReceiptDigest: auditReceipt });
  }

  async revoke(sessionDigest, revocationSequence) {
    digest(sessionDigest, 'KSTACK_MCP_SESSION_INVALID'); uint(revocationSequence, Number.MAX_SAFE_INTEGER, true, 'KSTACK_MCP_SESSION_INVALID'); const state = this.#sessions.get(sessionDigest);
    if (!state || state.session.state !== 'ACTIVE' || revocationSequence <= state.session.revocationSequence) fail('KSTACK_MCP_SESSION_INVALID');
    state.session = immutable({ ...state.session, revocationSequence, state: 'REVOKED' }); const receipt = await this.#backend.append(immutable({ event: 'SESSION_REVOKED', sessionDigest, revocationSequence })); digest(receipt, 'KSTACK_MCP_SESSION_LEDGER_INVALID');
    return immutable({ sessionDigest, state: 'REVOKED', protectedLedgerReceiptDigest: receipt });
  }
}
