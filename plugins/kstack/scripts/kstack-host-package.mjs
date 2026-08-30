import crypto from 'node:crypto';

export const HOST_PACKAGE_DOMAINS = Object.freeze({
  canonicalPackage: 'KSTACK-CANONICAL-PACKAGE-V1',
  registrySet: 'KSTACK-REGISTRY-SET-V1',
  registrySchema: 'KSTACK-REGISTRY-SCHEMA-V1',
  reuseAdmission: 'KSTACK-REUSE-ADMISSION-V1',
  sourceMemberSet: 'KSTACK-SOURCE-MEMBER-SET-V1',
  clauseInventory: 'KSTACK-CLAUSE-INVENTORY-V1',
  sourceBundle: 'KSTACK-SOURCE-BUNDLE-V1',
  projectionPlan: 'KSTACK-PROJECTION-PLAN-V1',
  projectionMap: 'KSTACK-PROJECTION-MAP-V1',
  renderBundle: 'KSTACK-RENDER-BUNDLE-V1',
  historicalResolution: 'KSTACK-HISTORICAL-RESOLUTION-V1',
  installerCandidate: 'KSTACK-INSTALLER-CANDIDATE-V1',
  installerProfile: 'KSTACK-INSTALLER-PROFILE-V1',
  activationBinding: 'KSTACK-ACTIVATION-BINDING-V1',
  stagingPlan: 'KSTACK-STAGING-PLAN-V1',
  installerAttempt: 'KSTACK-INSTALLER-ATTEMPT-V1',
  attemptLease: 'KSTACK-ATTEMPT-LEASE-V1',
  preActivationEvidence: 'KSTACK-PREACTIVATION-EVIDENCE-V1',
  installerTransactionRecord: 'KSTACK-INSTALLER-TRANSACTION-RECORD-V1',
  installerHealth: 'KSTACK-INSTALLER-HEALTH-V1',
  activeInstallReceipt: 'KSTACK-ACTIVE-INSTALL-RECEIPT-V1',
  cleanupPlan: 'KSTACK-INSTALLER-CLEANUP-PLAN-V1',
  installerPreflightRequest: 'KSTACK-INSTALLER-PREFLIGHT-REQUEST-V1',
  initialStateEvidence: 'KSTACK-INITIAL-STATE-EVIDENCE-V1',
  installedMemberManifest: 'KSTACK-INSTALLED-MEMBER-MANIFEST-V1',
  healthRecord: 'KSTACK-HEALTH-RECORD-V1',
  preservationBaseline: 'KSTACK-PRESERVATION-BASELINE-V1',
  migrationProposal: 'KSTACK-PRESERVATION-MIGRATION-PROPOSAL-V1',
  migrationAuthorization: 'KSTACK-PRESERVATION-MIGRATION-AUTHORIZATION-V1',
  installerHandoff: 'KSTACK-INSTALLER-HANDOFF-V1',
  hostFieldValueSchema: 'KSTACK-HOST-FIELD-VALUE-SCHEMA-V1',
  frontmatterSemantic: 'KSTACK-FRONTMATTER-SEMANTIC-V1',
  projectedFrontmatterSemantic: 'KSTACK-PROJECTED-FRONTMATTER-SEMANTIC-V1',
  unsupportedStatusTemplate: 'KSTACK-UNSUPPORTED-STATUS-TEMPLATE-V1',
  hostProfileAdmission: 'KSTACK-HOST-PROFILE-ADMISSION-V1',
  hostProfileRenderedSkill: 'KSTACK-HOST-PROFILE-RENDERED-SKILL-V1'
});

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SKILL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SEMVER = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const ROLES = new Set(['MODEL_SOURCE', 'SCRIPT', 'ASSET', 'LICENSE', 'METADATA_SOURCE']);
const TOKEN_KINDS = new Set(['SKILL_ROOT', 'INVOCATION_PREFIX', 'TOOL_NAME', 'METADATA_PATH']);
const TOKEN_CONTEXTS = new Set(['PROSE', 'CODE_SPAN', 'CODE_BLOCK', 'LINK_TARGET']);
const CLAUSE_CLASSES = new Set(['authority', 'gate', 'artifact', 'error', 'question', 'workflow']);
const DISPOSITIONS = new Set(['EXACT', 'TYPED_PROJECTION', 'UNSUPPORTED']);
const SCOPES = new Set(['PROJECT', 'USER']);
const RESERVED_HOST_FIELD_KEY = /(?:name|metadata|allowedtools|tools|skill|identity|authorit|auth|permission|permit|approv|qualif|bypass|principal|role|activat|credential|cred|secret|grant|privileg|token|sudo|elevat|entitl|capabilit|access|owner|admin|superuser|root|impersonat|trust|allow|deny|enabl|password|passphrase|key|signature|acl|rights|claim|user|group|session|scope|model)/u;
const HOST_FIELD_SUFFIX = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  throw error;
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

function identifier(value, code, pattern = ID) {
  text(value, code, 240);
  if (!pattern.test(value)) fail(code, value);
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

function decimal(value, code) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)$/u.test(value)) fail(code);
  return value;
}

function sortedUnique(values, code, validate = (value) => text(value, code)) {
  if (!Array.isArray(values)) fail(code);
  const result = values.map((value) => validate(value));
  const sorted = [...result].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  if (result.some((value, index) => value !== sorted[index]) || new Set(result).size !== result.length) fail(code, 'set array is not canonical');
  return result;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function hostFieldNamespace(adapterId) {
  return `x-kstack-${adapterId}-`;
}

function hostFieldSuffix(adapterId, key) {
  const namespace = hostFieldNamespace(adapterId);
  if (!key.startsWith(namespace)) return null;
  const suffix = key.slice(namespace.length);
  return HOST_FIELD_SUFFIX.test(suffix) ? suffix : null;
}

function isReservedHostFieldSuffix(value) {
  return RESERVED_HOST_FIELD_KEY.test(value.replace(/[.-]/gu, ''));
}

function cloneCanonical(value, location = '$') {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    if (typeof value === 'string' && value.normalize('NFC') !== value) fail('KSTACK_CANONICAL_JSON_INVALID', location);
    return value;
  }
  if (typeof value === 'number') {
    if (value !== 1) fail('KSTACK_CANONICAL_JSON_INVALID', `${location} numeric value`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => cloneCanonical(item, `${location}[${index}]`));
  plain(value, 'KSTACK_CANONICAL_JSON_INVALID');
  return Object.fromEntries(Object.keys(value).sort(compareUtf8).map((key) => {
    if (key.normalize('NFC') !== key) fail('KSTACK_CANONICAL_JSON_INVALID', `${location} key`);
    return [key, cloneCanonical(value[key], `${location}.${key}`)];
  }));
}

export function canonicalJson(value) {
  return JSON.stringify(cloneCanonical(value));
}

export function rawDigest(bytes) {
  const input = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes);
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}

export function addressObject(domain, value) {
  if (!Object.values(HOST_PACKAGE_DOMAINS).includes(domain)) fail('KSTACK_DIGEST_DOMAIN_INVALID');
  return rawDigest(Buffer.concat([Buffer.from(domain), Buffer.from([0]), Buffer.from(canonicalJson(value))]));
}

const PUBLIC_IDENTIFIER_HOST_FIELD_SCHEMA = Object.freeze({
  schemaId: 'kstack.host-field-value-schema.v1',
  schemaVersion: 1,
  kind: 'PUBLIC_IDENTIFIER',
  maximumUtf8Bytes: '64',
  pattern: '^[a-z0-9]+(?:[.-][a-z0-9]+)*$'
});

export const HOST_FIELD_VALUE_SCHEMA_DIGESTS = Object.freeze({
  publicIdentifierV1: addressObject(HOST_PACKAGE_DOMAINS.hostFieldValueSchema, PUBLIC_IDENTIFIER_HOST_FIELD_SCHEMA)
});

function validateHostFieldValue(valueSchemaDigest, value, code) {
  if (valueSchemaDigest !== HOST_FIELD_VALUE_SCHEMA_DIGESTS.publicIdentifierV1) fail(code, 'unsupported host field value schema');
  text(value, code, 64);
  if (!HOST_FIELD_SUFFIX.test(value)) fail(code, 'host field value does not satisfy its schema');
  return value;
}

export function validatePortableRelativePath(value) {
  text(value, 'SOURCE_PATH_INVALID_OR_COLLIDING', 240);
  if (value.includes('\\') || value.startsWith('/') || /^[A-Za-z]:/u.test(value) || /^[a-z][a-z0-9+.-]*:/iu.test(value)) fail('SOURCE_PATH_INVALID_OR_COLLIDING');
  const segments = value.split('/');
  if (segments.some((segment) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(segment)
      || segment === '.' || segment === '..' || /[. ]$/u.test(segment) || WINDOWS_DEVICE.test(segment))) fail('SOURCE_PATH_INVALID_OR_COLLIDING');
  return value;
}

export function createRegistrySchemaBinding({ metaschemaBytes, schema }) {
  const schemaDialect = 'https://json-schema.org/draft/2020-12/schema';
  const metaschemaDigest = rawDigest(metaschemaBytes);
  plain(schema, 'KSTACK_REGISTRY_SCHEMA_INVALID');
  if (schema.$schema !== schemaDialect) fail('KSTACK_REGISTRY_SCHEMA_INVALID', 'dialect');
  const inspect = (value) => {
    if (Array.isArray(value)) { for (const item of value) inspect(item); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
      if (key === '$ref' && (typeof nested !== 'string' || !nested.startsWith('#'))) fail('KSTACK_REGISTRY_SCHEMA_INVALID', 'remote reference');
      if (key === '$vocabulary') fail('KSTACK_REGISTRY_SCHEMA_INVALID', 'unknown vocabulary');
      inspect(nested);
    }
  };
  inspect(schema);
  const binding = { schemaDialect, metaschemaDigest, schema };
  return Object.freeze({ binding, schemaDigest: addressObject(HOST_PACKAGE_DOMAINS.registrySchema, binding) });
}

function pathSet(rows, code) {
  const folded = new Set();
  let previous = null;
  for (const row of rows) {
    const current = validatePortableRelativePath(row.path);
    if (previous !== null && Buffer.compare(Buffer.from(previous), Buffer.from(current)) >= 0) fail(code, 'paths are not unique and sorted');
    const key = current.normalize('NFC').toLowerCase();
    if (folded.has(key)) fail('SOURCE_PATH_INVALID_OR_COLLIDING', current);
    folded.add(key);
    previous = current;
  }
}

function validateRegistrySchemaReference(value, code) {
  digest(value, code);
  return value;
}

export function validateRegistrySet(input) {
  exact(input, ['schemaId', 'schemaVersion', 'schemaDialect', 'metaschemaDigest', 'operationIds', 'profileIds', 'targetIds', 'mediaTypes', 'reasonCodes', 'platformProfiles', 'metadataAdapters', 'hostFields', 'destinationTemplates', 'unsupportedStatusTemplates', 'testObligationIds'], 'KSTACK_REGISTRY_SET_INVALID');
  if (input.schemaId !== 'kstack.registry-set.v1' || input.schemaVersion !== 1 || input.schemaDialect !== 'https://json-schema.org/draft/2020-12/schema') fail('KSTACK_REGISTRY_SET_INVALID');
  digest(input.metaschemaDigest, 'KSTACK_REGISTRY_SET_INVALID');
  sortedUnique(input.operationIds, 'KSTACK_REGISTRY_SET_INVALID', (value) => identifier(value, 'KSTACK_REGISTRY_SET_INVALID'));
  sortedUnique(input.testObligationIds, 'KSTACK_REGISTRY_SET_INVALID', (value) => identifier(value, 'KSTACK_REGISTRY_SET_INVALID'));
  const collections = [
    ['profileIds', ['id', 'requiredOperationIds']],
    ['targetIds', ['id', 'lifecycle']],
    ['mediaTypes', ['id', 'canonicalValue']],
    ['reasonCodes', ['id', 'category', 'maximumOutcome']],
    ['platformProfiles', ['id', 'constraintSchemaDigest']],
    ['metadataAdapters', ['id', 'schemaDigest', 'projectionSchemaVersion']],
    ['hostFields', ['adapterId', 'key', 'valueSchemaDigest']],
    ['destinationTemplates', ['id', 'scope', 'templateSchemaDigest']],
    ['unsupportedStatusTemplates', ['id', 'mediaTypeId', 'templateSchemaDigest', 'templateDigest']]
  ];
  for (const [name, keys] of collections) {
    if (!Array.isArray(input[name])) fail('KSTACK_REGISTRY_SET_INVALID', name);
    let prior = null;
    for (const row of input[name]) {
      exact(row, keys, 'KSTACK_REGISTRY_SET_INVALID');
      const rowId = name === 'hostFields' ? `${row.adapterId}/${row.key}` : row.id;
      text(rowId, 'KSTACK_REGISTRY_SET_INVALID');
      if (prior !== null && Buffer.compare(Buffer.from(prior), Buffer.from(rowId)) >= 0) fail('KSTACK_REGISTRY_SET_INVALID', `${name} order`);
      prior = rowId;
    }
  }
  for (const row of input.profileIds) sortedUnique(row.requiredOperationIds, 'KSTACK_REGISTRY_SET_INVALID', (value) => identifier(value, 'KSTACK_REGISTRY_SET_INVALID'));
  for (const row of input.targetIds) if (!['BASELINE', 'CANDIDATE', 'DEPRECATED'].includes(row.lifecycle)) fail('KSTACK_REGISTRY_SET_INVALID');
  for (const required of ['agent-skills', 'claude', 'codex']) if (!input.targetIds.some((row) => row.id === required && row.lifecycle === 'BASELINE')) fail('KSTACK_REGISTRY_SET_INVALID', `missing baseline ${required}`);
  for (const row of input.reasonCodes) if (!['UNSUPPORTED', 'INVALID', 'UNAVAILABLE'].includes(row.category) || !['DEGRADED', 'UNSUPPORTED'].includes(row.maximumOutcome)) fail('KSTACK_REGISTRY_SET_INVALID');
  for (const row of input.platformProfiles) validateRegistrySchemaReference(row.constraintSchemaDigest, 'KSTACK_REGISTRY_SET_INVALID');
  for (const row of input.metadataAdapters) { validateRegistrySchemaReference(row.schemaDigest, 'KSTACK_REGISTRY_SET_INVALID'); if (row.projectionSchemaVersion !== '1') fail('KSTACK_REGISTRY_SET_INVALID'); }
  const metadataAdapterIds = registryIds(input, 'metadataAdapters');
  for (const row of input.hostFields) {
    identifier(row.adapterId, 'KSTACK_REGISTRY_SET_INVALID');
    const suffix = hostFieldSuffix(row.adapterId, row.key);
    if (!metadataAdapterIds.has(row.adapterId) || suffix === null || isReservedHostFieldSuffix(suffix)) fail('KSTACK_REGISTRY_SET_INVALID', 'host field key');
    validateRegistrySchemaReference(row.valueSchemaDigest, 'KSTACK_REGISTRY_SET_INVALID');
    if (!Object.values(HOST_FIELD_VALUE_SCHEMA_DIGESTS).includes(row.valueSchemaDigest)) fail('KSTACK_REGISTRY_SET_INVALID', 'unsupported host field value schema');
  }
  for (const row of input.destinationTemplates) { if (!SCOPES.has(row.scope)) fail('KSTACK_REGISTRY_SET_INVALID'); validateRegistrySchemaReference(row.templateSchemaDigest, 'KSTACK_REGISTRY_SET_INVALID'); }
  const mediaTypeIds = registryIds(input, 'mediaTypes');
  for (const row of input.mediaTypes) { identifier(row.id, 'KSTACK_REGISTRY_SET_INVALID'); text(row.canonicalValue, 'KSTACK_REGISTRY_SET_INVALID'); }
  for (const [id, canonicalValue] of [['application-octet-stream', 'application/octet-stream'], ['text-markdown', 'text/markdown; charset=utf-8']]) {
    if (!input.mediaTypes.some((row) => row.id === id && row.canonicalValue === canonicalValue)) fail('KSTACK_REGISTRY_SET_INVALID', `missing media type ${id}`);
  }
  if (input.unsupportedStatusTemplates.length === 0) fail('KSTACK_REGISTRY_SET_INVALID', 'unsupported status template');
  for (const row of input.unsupportedStatusTemplates) {
    identifier(row.id, 'KSTACK_REGISTRY_SET_INVALID'); identifier(row.mediaTypeId, 'KSTACK_REGISTRY_SET_INVALID');
    if (!mediaTypeIds.has(row.mediaTypeId)) fail('KSTACK_REGISTRY_SET_INVALID', 'unsupported template media type');
    digest(row.templateSchemaDigest, 'KSTACK_REGISTRY_SET_INVALID'); digest(row.templateDigest, 'KSTACK_REGISTRY_SET_INVALID');
  }
  return input;
}

function registryIds(registry, collection) {
  return new Set(registry[collection].map((row) => typeof row === 'string' ? row : row.id));
}

function requireRegistered(values, allowed, code) {
  for (const value of values) if (!allowed.has(value)) fail(code, value);
}

function validatePackageMember(row) {
  exact(row, ['path', 'role', 'skillId', 'modelVisible'], 'KSTACK_CANONICAL_PACKAGE_INVALID');
  validatePortableRelativePath(row.path);
  if (!ROLES.has(row.role)) fail('KSTACK_CANONICAL_PACKAGE_INVALID');
  if (!['YES', 'NO'].includes(row.modelVisible)) fail('KSTACK_CANONICAL_PACKAGE_INVALID');
  if (row.skillId !== null) identifier(row.skillId, 'KSTACK_CANONICAL_PACKAGE_INVALID', SKILL_ID);
  if (row.role === 'MODEL_SOURCE') {
    if (row.modelVisible !== 'YES' || row.skillId === null || !/\.src\.md$/u.test(row.path)) fail('KSTACK_CANONICAL_PACKAGE_INVALID');
  } else if (row.modelVisible !== 'NO') fail('KSTACK_CANONICAL_PACKAGE_INVALID');
  if (['SCRIPT', 'ASSET'].includes(row.role) && row.skillId === null) fail('KSTACK_CANONICAL_PACKAGE_INVALID');
}

export function validateReuseAdmission(input, registryInput) {
  const registry = validateRegistrySet(registryInput);
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'componentId', 'disposition', 'upstream', 'reusedBehavior', 'alternativeConsidered', 'reuseJustification', 'materialImprovements', 'baselineEffects', 'localOutputs', 'noticeMemberDigest', 'testObligationIds', 'reviewDigest', 'ownerDecisionDigest'], 'REUSE_ADMISSION_MISSING_OR_INVALID');
  if (input.schemaId !== 'kstack.reuse-admission.v1' || input.schemaVersion !== 1 || input.registrySetDigest !== addressObject(HOST_PACKAGE_DOMAINS.registrySet, registry)
      || !['ADAPT', 'REIMPLEMENT_PATTERN', 'REJECT'].includes(input.disposition)) fail('REUSE_ADMISSION_MISSING_OR_INVALID');
  identifier(input.componentId, 'REUSE_ADMISSION_MISSING_OR_INVALID');
  for (const key of ['reusedBehavior', 'alternativeConsidered', 'reuseJustification']) text(input[key], 'REUSE_ADMISSION_MISSING_OR_INVALID');
  sortedUnique(input.materialImprovements, 'REUSE_ADMISSION_MISSING_OR_INVALID');
  sortedUnique(input.testObligationIds, 'REUSE_ADMISSION_MISSING_OR_INVALID', (value) => identifier(value, 'REUSE_ADMISSION_MISSING_OR_INVALID'));
  requireRegistered(input.testObligationIds, registryIds(registry, 'testObligationIds'), 'REUSE_ADMISSION_MISSING_OR_INVALID');
  digest(input.reviewDigest, 'REUSE_ADMISSION_MISSING_OR_INVALID'); digest(input.ownerDecisionDigest, 'REUSE_ADMISSION_MISSING_OR_INVALID'); nullableDigest(input.noticeMemberDigest, 'REUSE_ADMISSION_MISSING_OR_INVALID');
  exact(input.upstream, ['repository', 'commit', 'licenseId', 'licenseDigest', 'sourcePaths'], 'REUSE_ADMISSION_MISSING_OR_INVALID');
  if (input.upstream.repository !== 'https://github.com/garrytan/gstack' || input.upstream.commit !== 'ad8400543cd9ce8d07641362db48d44a95417e33'
      || input.upstream.licenseId !== 'MIT') fail('REUSE_ADMISSION_MISSING_OR_INVALID');
  digest(input.upstream.licenseDigest, 'REUSE_ADMISSION_MISSING_OR_INVALID');
  if (!Array.isArray(input.upstream.sourcePaths) || input.upstream.sourcePaths.length === 0) fail('REUSE_ADMISSION_MISSING_OR_INVALID');
  for (const source of input.upstream.sourcePaths) {
    exact(source, ['path', 'contentDigest', 'admittedByteRanges'], 'REUSE_ADMISSION_MISSING_OR_INVALID');
    validatePortableRelativePath(source.path); digest(source.contentDigest, 'REUSE_ADMISSION_MISSING_OR_INVALID');
    if (!Array.isArray(source.admittedByteRanges)) fail('REUSE_ADMISSION_MISSING_OR_INVALID');
    let prior = 0n;
    for (const range of source.admittedByteRanges) {
      exact(range, ['start', 'end'], 'REUSE_ADMISSION_MISSING_OR_INVALID'); decimal(range.start, 'REUSE_ADMISSION_MISSING_OR_INVALID'); decimal(range.end, 'REUSE_ADMISSION_MISSING_OR_INVALID');
      const start = BigInt(range.start); const end = BigInt(range.end);
      if (start < prior || end <= start) fail('REUSE_ADMISSION_MISSING_OR_INVALID');
      prior = end;
    }
  }
  if (!Array.isArray(input.baselineEffects) || input.baselineEffects.length === 0) fail('REUSE_ADMISSION_MISSING_OR_INVALID');
  const dimensions = new Set();
  for (const effect of input.baselineEffects) {
    exact(effect, ['dimension', 'upstreamEffect', 'kstackEffect', 'evidenceDigest'], 'REUSE_ADMISSION_MISSING_OR_INVALID');
    if (!['BEHAVIOR', 'AUTHORITY', 'SECURITY', 'DETERMINISM', 'ROLLBACK', 'MAINTENANCE', 'TESTABILITY'].includes(effect.dimension)
        || dimensions.has(effect.dimension) || !['PRESERVE', 'IMPROVE', 'NOT_APPLICABLE'].includes(effect.upstreamEffect)
        || !['PRESERVE', 'IMPROVE', 'NOT_APPLICABLE'].includes(effect.kstackEffect)) fail('REUSE_ADMISSION_MISSING_OR_INVALID');
    dimensions.add(effect.dimension); digest(effect.evidenceDigest, 'REUSE_ADMISSION_MISSING_OR_INVALID');
  }
  if (!Array.isArray(input.localOutputs)) fail('REUSE_ADMISSION_MISSING_OR_INVALID');
  for (const output of input.localOutputs) { exact(output, ['path', 'contentDigest'], 'REUSE_ADMISSION_MISSING_OR_INVALID'); validatePortableRelativePath(output.path); digest(output.contentDigest, 'REUSE_ADMISSION_MISSING_OR_INVALID'); }
  const rangeCount = input.upstream.sourcePaths.reduce((count, source) => count + source.admittedByteRanges.length, 0);
  if (input.disposition === 'ADAPT' && (rangeCount === 0 || input.localOutputs.length === 0 || input.noticeMemberDigest === null || input.materialImprovements.length === 0)) fail('REUSE_ADMISSION_MISSING_OR_INVALID');
  if (input.disposition === 'REIMPLEMENT_PATTERN' && (rangeCount !== 0 || input.localOutputs.length !== 0 || input.noticeMemberDigest !== null)) fail('REUSE_ADMISSION_MISSING_OR_INVALID');
  if (input.disposition === 'REJECT' && (rangeCount !== 0 || input.localOutputs.length !== 0 || input.noticeMemberDigest !== null)) fail('REUSE_ADMISSION_MISSING_OR_INVALID');
  return input;
}

export function validateCanonicalPackage(input, registryInput) {
  const registry = validateRegistrySet(registryInput);
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'packageId', 'packageVersion', 'skills', 'members', 'tokens', 'targetIds', 'reuseAdmissionDigests'], 'KSTACK_CANONICAL_PACKAGE_INVALID');
  if (input.schemaId !== 'kstack.canonical-package.v1' || input.schemaVersion !== 1) fail('KSTACK_CANONICAL_PACKAGE_INVALID');
  if (input.registrySetDigest !== addressObject(HOST_PACKAGE_DOMAINS.registrySet, registry)) fail('KSTACK_REGISTRY_BINDING_MISMATCH');
  identifier(input.packageId, 'KSTACK_CANONICAL_PACKAGE_INVALID');
  if (!SEMVER.test(input.packageVersion)) fail('KSTACK_CANONICAL_PACKAGE_INVALID', 'packageVersion');
  pathSet(input.members, 'KSTACK_CANONICAL_PACKAGE_INVALID');
  for (const member of input.members) validatePackageMember(member);
  sortedUnique(input.targetIds, 'KSTACK_CANONICAL_PACKAGE_INVALID', (value) => identifier(value, 'KSTACK_CANONICAL_PACKAGE_INVALID'));
  requireRegistered(input.targetIds, registryIds(registry, 'targetIds'), 'KSTACK_CANONICAL_PACKAGE_INVALID');
  for (const required of ['agent-skills', 'claude', 'codex']) if (!input.targetIds.includes(required)) fail('KSTACK_CANONICAL_PACKAGE_INVALID');
  sortedUnique(input.reuseAdmissionDigests, 'KSTACK_CANONICAL_PACKAGE_INVALID', (value) => digest(value, 'KSTACK_CANONICAL_PACKAGE_INVALID'));
  if (!Array.isArray(input.skills) || input.skills.length === 0) fail('KSTACK_CANONICAL_PACKAGE_INVALID');
  let previousSkill = null;
  for (const skill of input.skills) {
    exact(skill, ['skillId', 'root', 'entrySource', 'agentSkillsEntry', 'memberPaths', 'operationIds'], 'KSTACK_CANONICAL_PACKAGE_INVALID');
    identifier(skill.skillId, 'KSTACK_CANONICAL_PACKAGE_INVALID', SKILL_ID);
    if (previousSkill !== null && skill.skillId <= previousSkill) fail('KSTACK_CANONICAL_PACKAGE_INVALID', 'skill order');
    previousSkill = skill.skillId;
    if (skill.root !== `skills/${skill.skillId}` || skill.entrySource !== `${skill.root}/SKILL.src.md` || skill.agentSkillsEntry !== `${skill.root}/SKILL.md`) fail('KSTACK_CANONICAL_PACKAGE_INVALID');
    sortedUnique(skill.memberPaths, 'KSTACK_CANONICAL_PACKAGE_INVALID', validatePortableRelativePath);
    sortedUnique(skill.operationIds, 'KSTACK_CANONICAL_PACKAGE_INVALID', (value) => identifier(value, 'KSTACK_CANONICAL_PACKAGE_INVALID'));
    requireRegistered(skill.operationIds, registryIds(registry, 'operationIds'), 'KSTACK_CANONICAL_PACKAGE_INVALID');
    const actual = input.members.filter((row) => row.skillId === skill.skillId).map((row) => row.path);
    if (canonicalJson(actual) !== canonicalJson(skill.memberPaths) || !skill.memberPaths.includes(skill.entrySource)) fail('KSTACK_CANONICAL_PACKAGE_INVALID', 'skill member inventory');
  }
  if (!Array.isArray(input.tokens)) fail('KSTACK_CANONICAL_PACKAGE_INVALID');
  let previousToken = null;
  for (const token of input.tokens) {
    exact(token, ['tokenId', 'kind', 'argument', 'allowedContexts'], 'KSTACK_CANONICAL_PACKAGE_INVALID');
    identifier(token.tokenId, 'KSTACK_CANONICAL_PACKAGE_INVALID', SKILL_ID);
    if (previousToken !== null && token.tokenId <= previousToken) fail('KSTACK_CANONICAL_PACKAGE_INVALID', 'token order');
    previousToken = token.tokenId;
    if (!TOKEN_KINDS.has(token.kind) || (token.kind === 'TOOL_NAME') !== (token.argument !== null)) fail('KSTACK_CANONICAL_PACKAGE_INVALID');
    if (token.argument !== null) identifier(token.argument, 'KSTACK_CANONICAL_PACKAGE_INVALID');
    sortedUnique(token.allowedContexts, 'KSTACK_CANONICAL_PACKAGE_INVALID', (value) => { if (!TOKEN_CONTEXTS.has(value)) fail('KSTACK_CANONICAL_PACKAGE_INVALID'); return value; });
  }
  return input;
}

function canonicalSource(bytes, code) {
  const buffer = Buffer.from(bytes);
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  if (decoded.normalize('NFC') !== decoded || decoded.includes('\r') || decoded.includes('\u0000') || decoded.charCodeAt(0) === 0xfeff) fail(code);
  return { buffer, decoded };
}

function parseCanonicalFrontmatter(source, skillId) {
  if (!source.startsWith('---\n')) fail('KSTACK_AGENT_SKILLS_FRONTMATTER_INVALID');
  const end = source.indexOf('---\n', 4);
  if (end < 0) fail('KSTACK_AGENT_SKILLS_FRONTMATTER_INVALID');
  const raw = source.slice(0, end + 4);
  const lines = source.slice(4, end).split('\n').filter(Boolean);
  const permitted = ['name', 'description', 'license', 'compatibility', 'metadata'];
  const result = {};
  let prior = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === 'metadata:') {
      if (permitted.indexOf('metadata') <= prior || Object.hasOwn(result, 'metadata')) fail('KSTACK_AGENT_SKILLS_FRONTMATTER_INVALID');
      prior = permitted.indexOf('metadata'); result.metadata = {};
      let previousMetadata = null;
      while (index + 1 < lines.length && lines[index + 1].startsWith('  ')) {
        index += 1;
        const metadata = /^  ("(?:[^"\\]|\\.)*"): ("(?:[^"\\]|\\.)*")$/u.exec(lines[index]);
        if (!metadata) fail('KSTACK_AGENT_SKILLS_FRONTMATTER_INVALID');
        const key = JSON.parse(metadata[1]); const value = JSON.parse(metadata[2]);
        if (!/^kstack\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/u.test(key) || isReservedHostFieldSuffix(key.slice('kstack.'.length))
            || previousMetadata !== null && key <= previousMetadata || Buffer.byteLength(value, 'utf8') > 1024) fail('KSTACK_AGENT_SKILLS_FRONTMATTER_INVALID');
        previousMetadata = key; result.metadata[key] = value;
      }
      continue;
    }
    const match = /^([a-z]+): ("(?:[^"\\]|\\.)*")$/u.exec(line);
    if (!match || !permitted.slice(0, 4).includes(match[1]) || Object.hasOwn(result, match[1])) fail('KSTACK_AGENT_SKILLS_FRONTMATTER_INVALID');
    const order = permitted.indexOf(match[1]);
    if (order <= prior) fail('KSTACK_AGENT_SKILLS_FRONTMATTER_INVALID');
    prior = order;
    result[match[1]] = JSON.parse(match[2]);
  }
  if (result.name !== skillId || typeof result.description !== 'string' || Buffer.byteLength(result.description, 'utf8') > 1024) fail('KSTACK_AGENT_SKILLS_FRONTMATTER_INVALID');
  return { raw, endByte: Buffer.byteLength(raw), fields: result };
}

function byteOffset(source, characterOffset) {
  return Buffer.byteLength(source.slice(0, characterOffset), 'utf8');
}

function tokenContext(source, start) {
  const before = source.slice(0, start);
  const fenceCount = (before.match(/```/gu) ?? []).length;
  if (fenceCount % 2 === 1) return 'CODE_BLOCK';
  const line = before.slice(before.lastIndexOf('\n') + 1);
  if ((line.match(/`/gu) ?? []).length % 2 === 1) return 'CODE_SPAN';
  const openLink = before.lastIndexOf('](');
  if (openLink > before.lastIndexOf(')')) return 'LINK_TARGET';
  return 'PROSE';
}

function parseModelSource(member, bytes, tokenById) {
  const { buffer, decoded } = canonicalSource(bytes, 'SOURCE_TEXT_NONCANONICAL');
  const skillId = member.skillId;
  const entry = member.path === `skills/${skillId}/SKILL.src.md`;
  let cursor = 0;
  const segments = [];
  let frontmatter = null;
  if (entry) {
    frontmatter = parseCanonicalFrontmatter(decoded, skillId);
    segments.push({ kind: 'FRONTMATTER', startByte: '0', endByte: String(frontmatter.endByte), spanDigest: rawDigest(buffer.subarray(0, frontmatter.endByte)), clauseId: null });
    cursor = frontmatter.raw.length;
  }
  const rows = [];
  const openPattern = /^<!-- kstack-clause:v1 (\{[^\n]+\}) -->\n/gmu;
  openPattern.lastIndex = cursor;
  while (cursor < decoded.length) {
    const open = openPattern.exec(decoded);
    if (!open || open.index < cursor) fail('CLAUSE_PARTITION_INCOMPLETE', member.path);
    if (open.index > cursor) {
      const framing = decoded.slice(cursor, open.index);
      if (!/^\n+$/u.test(framing)) fail('CLAUSE_PARTITION_INCOMPLETE', member.path);
      const startByte = byteOffset(decoded, cursor); const endByte = byteOffset(decoded, open.index);
      segments.push({ kind: 'FRAMING_LF', startByte: String(startByte), endByte: String(endByte), spanDigest: rawDigest(buffer.subarray(startByte, endByte)), clauseId: null });
    }
    let marker;
    try { marker = JSON.parse(open[1]); } catch { fail('CLAUSE_GRAMMAR_INVALID'); }
    exact(marker, ['appliesTo', 'class', 'id'], 'CLAUSE_GRAMMAR_INVALID');
    const canonicalMarker = canonicalJson(marker);
    if (canonicalMarker !== open[1] || !CLAUSE_CLASSES.has(marker.class)) fail('CLAUSE_GRAMMAR_INVALID');
    identifier(marker.id, 'CLAUSE_GRAMMAR_INVALID');
    sortedUnique(marker.appliesTo, 'CLAUSE_GRAMMAR_INVALID', (value) => identifier(value, 'CLAUSE_GRAMMAR_INVALID'));
    const openStart = byteOffset(decoded, open.index); const bodyStartChar = openPattern.lastIndex; const bodyStart = byteOffset(decoded, bodyStartChar);
    const close = '\n<!-- /kstack-clause:v1 -->\n';
    const closeStartChar = decoded.indexOf(close, bodyStartChar);
    if (closeStartChar < 0) fail('CLAUSE_GRAMMAR_INVALID');
    const body = decoded.slice(bodyStartChar, closeStartChar);
    if (body.length === 0 || body.includes('<!-- kstack-clause:v1 ')) fail('CLAUSE_GRAMMAR_INVALID');
    const bodyEnd = byteOffset(decoded, closeStartChar);
    const closeStart = bodyEnd; const closeEndChar = closeStartChar + close.length; const closeEnd = byteOffset(decoded, closeEndChar);
    segments.push({ kind: 'OPEN_MARKER', startByte: String(openStart), endByte: String(bodyStart), spanDigest: rawDigest(buffer.subarray(openStart, bodyStart)), clauseId: marker.id });
    segments.push({ kind: 'CLAUSE_BODY', startByte: String(bodyStart), endByte: String(bodyEnd), spanDigest: rawDigest(buffer.subarray(bodyStart, bodyEnd)), clauseId: marker.id });
    segments.push({ kind: 'CLOSE_MARKER', startByte: String(closeStart), endByte: String(closeEnd), spanDigest: rawDigest(buffer.subarray(closeStart, closeEnd)), clauseId: marker.id });
    const tokenOccurrences = [];
    for (const match of body.matchAll(/\{\{kstack-token:([a-z0-9]+(?:-[a-z0-9]+)*)\}\}/gu)) {
      const token = tokenById.get(match[1]);
      if (!token) fail('TOKEN_UNKNOWN_OR_CONTEXT_INVALID');
      const absoluteChar = bodyStartChar + match.index;
      const startByte = byteOffset(decoded, absoluteChar); const endByte = byteOffset(decoded, absoluteChar + match[0].length);
      const context = tokenContext(decoded, absoluteChar);
      if (!token.allowedContexts.includes(context)) fail('TOKEN_UNKNOWN_OR_CONTEXT_INVALID');
      tokenOccurrences.push({ tokenId: token.tokenId, startByte: String(startByte), endByte: String(endByte), context, rawSpanDigest: rawDigest(buffer.subarray(startByte, endByte)) });
    }
    rows.push({ clauseId: marker.id, sourcePath: member.path, sourceStartByte: String(bodyStart), sourceEndByte: String(bodyEnd), sourceSpanDigest: rawDigest(buffer.subarray(bodyStart, bodyEnd)), class: marker.class, appliesTo: marker.appliesTo, tokenOccurrences });
    cursor = closeEndChar;
    openPattern.lastIndex = cursor;
  }
  if (segments.length === 0 || Number(segments[0].startByte) !== 0 || Number(segments.at(-1).endByte) !== buffer.length) fail('CLAUSE_PARTITION_INCOMPLETE');
  for (let index = 1; index < segments.length; index += 1) if (segments[index - 1].endByte !== segments[index].startByte) fail('CLAUSE_PARTITION_INCOMPLETE');
  return { rows, partition: { sourcePath: member.path, sourceMemberDigest: rawDigest(buffer), byteLength: String(buffer.length), segments }, frontmatter };
}

export function admitSourcePackage({ registry: registryInput, package: packageInput, memberBytes, agentSkillsSchemaBinding, reuseAdmissions = [] }) {
  const registry = validateRegistrySet(registryInput);
  const canonicalPackage = validateCanonicalPackage(packageInput, registry);
  plain(memberBytes, 'KSTACK_SOURCE_MEMBER_SET_INVALID');
  const packagePaths = canonicalPackage.members.map((row) => row.path);
  if (canonicalJson(Object.keys(memberBytes).sort(compareUtf8)) !== canonicalJson(packagePaths)) fail('MODEL_SOURCE_UNLISTED_OR_MISSING');
  const registrySetDigest = addressObject(HOST_PACKAGE_DOMAINS.registrySet, registry);
  if (!Array.isArray(reuseAdmissions)) fail('REUSE_ADMISSION_MISSING_OR_INVALID');
  const admittedReuseDigests = reuseAdmissions.map((admission) => addressObject(HOST_PACKAGE_DOMAINS.reuseAdmission, validateReuseAdmission(admission, registry))).sort(compareUtf8);
  if (canonicalJson(admittedReuseDigests) !== canonicalJson(canonicalPackage.reuseAdmissionDigests)) fail('REUSE_ADMISSION_MISSING_OR_INVALID', 'package binding');
  const canonicalPackageDigest = addressObject(HOST_PACKAGE_DOMAINS.canonicalPackage, canonicalPackage);
  const sourceMembers = canonicalPackage.members.map((member) => {
    const bytes = Buffer.from(memberBytes[member.path]);
    if (member.role === 'MODEL_SOURCE') canonicalSource(bytes, 'SOURCE_TEXT_NONCANONICAL');
    return { path: member.path, role: member.role, skillId: member.skillId, mediaTypeId: member.role === 'MODEL_SOURCE' ? 'text-markdown' : 'application-octet-stream', byteLength: String(bytes.length), contentDigest: rawDigest(bytes), executable: false };
  });
  const sourceMemberSet = { schemaId: 'kstack.source-member-set.v1', schemaVersion: 1, registrySetDigest, canonicalPackageDigest, members: sourceMembers };
  const sourceMemberSetDigest = addressObject(HOST_PACKAGE_DOMAINS.sourceMemberSet, sourceMemberSet);
  const tokenById = new Map(canonicalPackage.tokens.map((token) => [token.tokenId, token]));
  const parsed = canonicalPackage.members.filter((member) => member.role === 'MODEL_SOURCE').map((member) => parseModelSource(member, memberBytes[member.path], tokenById));
  const rows = parsed.flatMap((item) => item.rows).sort((left, right) => compareUtf8(left.sourcePath, right.sourcePath) || Number(left.sourceStartByte) - Number(right.sourceStartByte));
  if (new Set(rows.map((row) => row.clauseId)).size !== rows.length) fail('CLAUSE_INVENTORY_MISMATCH', 'duplicate clause id');
  const filePartitions = parsed.map((item) => item.partition).sort((left, right) => compareUtf8(left.sourcePath, right.sourcePath));
  const clauseInventory = { schemaId: 'kstack.clause-inventory.v1', schemaVersion: 1, registrySetDigest, canonicalPackageDigest, sourceMemberSetDigest, filePartitions, rows };
  const clauseInventoryDigest = addressObject(HOST_PACKAGE_DOMAINS.clauseInventory, clauseInventory);
  exact(agentSkillsSchemaBinding, ['specificationId', 'boundVersion', 'schemaDigest'], 'KSTACK_SOURCE_BUNDLE_INVALID');
  if (agentSkillsSchemaBinding.specificationId !== 'agentskills.specification') fail('KSTACK_SOURCE_BUNDLE_INVALID');
  text(agentSkillsSchemaBinding.boundVersion, 'KSTACK_SOURCE_BUNDLE_INVALID'); digest(agentSkillsSchemaBinding.schemaDigest, 'KSTACK_SOURCE_BUNDLE_INVALID');
  const sourceBundle = { schemaId: 'kstack.source-bundle.v1', schemaVersion: 1, registrySetDigest, canonicalPackageDigest, sourceMemberSetDigest, agentSkillsSchemaBinding, clauseInventoryDigest, reuseAdmissionDigests: canonicalPackage.reuseAdmissionDigests };
  const sourceBundleDigest = addressObject(HOST_PACKAGE_DOMAINS.sourceBundle, sourceBundle);
  return Object.freeze({ registry, registrySetDigest, canonicalPackage, canonicalPackageDigest, sourceMemberSet, sourceMemberSetDigest, clauseInventory, clauseInventoryDigest, sourceBundle, sourceBundleDigest, memberBytes: Object.freeze(Object.fromEntries(packagePaths.map((path) => [path, Buffer.from(memberBytes[path])]))) });
}

export function renderUnsupportedStatus(template, values) {
  exact(template, ['schemaId', 'schemaVersion', 'templateId', 'mediaTypeId', 'orderedSegments'], 'KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID');
  if (template.schemaId !== 'kstack.unsupported-status-template.v1' || template.schemaVersion !== 1 || !Array.isArray(template.orderedSegments)) fail('KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID');
  exact(values, ['sourcePath', 'reasonCode', 'affectedIds'], 'KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID');
  validatePortableRelativePath(values.sourcePath); identifier(values.reasonCode, 'KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID');
  sortedUnique(values.affectedIds, 'KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID', (value) => identifier(value, 'KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID'));
  identifier(template.templateId, 'KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID');
  if (template.mediaTypeId !== 'text-markdown') fail('KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID');
  const escape = (value) => value.replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  return template.orderedSegments.map((segment) => {
    if (!plain(segment, 'KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID').kind) fail('KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID');
    if (segment.kind === 'LITERAL') { exact(segment, ['kind', 'value'], 'KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID'); return text(segment.value, 'KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID'); }
    exact(segment, ['kind'], 'KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID');
    if (segment.kind === 'SOURCE_PATH') return escape(values.sourcePath);
    if (segment.kind === 'REASON_CODE') return escape(values.reasonCode);
    if (segment.kind === 'AFFECTED_IDS') return values.affectedIds.map(escape).join(',');
    fail('KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID');
  }).join('');
}

function validateProjectionPlan(plan, admission) {
  exact(plan, ['schemaId', 'schemaVersion', 'registrySetDigest', 'sourceBundleDigest', 'targetId', 'hostProjectionSchemaVersion', 'metadataAdapterId', 'metadataAdapterSchemaDigest', 'frontmatterProjection', 'resourceDispositions', 'tokenUseDispositions'], 'KSTACK_PROJECTION_PLAN_INVALID');
  if (plan.schemaId !== 'kstack.projection-plan.v1' || plan.schemaVersion !== 1 || plan.hostProjectionSchemaVersion !== '1'
      || plan.registrySetDigest !== admission.registrySetDigest || plan.sourceBundleDigest !== admission.sourceBundleDigest) fail('KSTACK_PROJECTION_PLAN_INVALID');
  const target = admission.registry.targetIds.find((row) => row.id === plan.targetId);
  const adapter = admission.registry.metadataAdapters.find((row) => row.id === plan.metadataAdapterId);
  if (!target || !adapter || adapter.schemaDigest !== plan.metadataAdapterSchemaDigest) fail('KSTACK_PROJECTION_PLAN_INVALID', 'registry reference');
  exact(plan.frontmatterProjection, ['mode', 'keptFields', 'hostFields'], 'KSTACK_PROJECTION_PLAN_INVALID');
  if (!['AGENT_SKILLS_CANONICAL', 'CLOSED_ALLOWLIST'].includes(plan.frontmatterProjection.mode)) fail('KSTACK_PROJECTION_PLAN_INVALID');
  sortedUnique(plan.frontmatterProjection.keptFields, 'KSTACK_PROJECTION_PLAN_INVALID');
  const canonicalFieldKeys = new Set(['name', 'description', 'license', 'compatibility', 'metadata']);
  if (plan.frontmatterProjection.keptFields.some((key) => !canonicalFieldKeys.has(key))
      || !plan.frontmatterProjection.keptFields.includes('name') || !plan.frontmatterProjection.keptFields.includes('description')) fail('KSTACK_PROJECTION_PLAN_INVALID', 'kept field');
  if (plan.frontmatterProjection.mode === 'AGENT_SKILLS_CANONICAL') {
    for (const skill of admission.canonicalPackage.skills) {
      const source = new TextDecoder('utf-8', { fatal: true }).decode(admission.memberBytes[skill.entrySource]);
      const parsed = parseCanonicalFrontmatter(source, skill.skillId);
      if (Object.keys(parsed.fields).some((key) => !plan.frontmatterProjection.keptFields.includes(key))) fail('KSTACK_PROJECTION_PLAN_INVALID', 'canonical mode drops source field');
    }
  }
  if (!Array.isArray(plan.frontmatterProjection.hostFields)) fail('KSTACK_PROJECTION_PLAN_INVALID');
  let priorHostField = null;
  for (const field of plan.frontmatterProjection.hostFields) {
    exact(field, ['key', 'value'], 'KSTACK_PROJECTION_PLAN_INVALID');
    text(field.key, 'KSTACK_PROJECTION_PLAN_INVALID'); text(field.value, 'KSTACK_PROJECTION_PLAN_INVALID');
    if (priorHostField !== null && compareUtf8(priorHostField, field.key) >= 0) fail('KSTACK_PROJECTION_PLAN_INVALID', 'host field order');
    priorHostField = field.key;
    const registeredHostField = admission.registry.hostFields.find((row) => row.adapterId === plan.metadataAdapterId && row.key === field.key);
    if (!registeredHostField) fail('KSTACK_PROJECTION_PLAN_INVALID', 'host field');
    validateHostFieldValue(registeredHostField.valueSchemaDigest, field.value, 'KSTACK_PROJECTION_PLAN_INVALID');
  }
  if (!admission.registry.reasonCodes.some((row) => row.id === 'projection-nonsemantic-framing-omitted' && row.category === 'UNSUPPORTED')) fail('KSTACK_PROJECTION_PLAN_INVALID', 'omission reason');
  if (!Array.isArray(plan.resourceDispositions) || plan.resourceDispositions.length !== admission.canonicalPackage.members.length) fail('KSTACK_PROJECTION_PLAN_INVALID', 'resource coverage');
  const resources = new Map();
  let previous = null;
  for (const row of plan.resourceDispositions) {
    exact(row, ['sourcePath', 'outputPath', 'disposition', 'reasonCode', 'affectedIds'], 'KSTACK_PROJECTION_PLAN_INVALID');
    validatePortableRelativePath(row.sourcePath); validatePortableRelativePath(row.outputPath);
    if (previous !== null && compareUtf8(row.sourcePath, previous) <= 0) fail('KSTACK_PROJECTION_PLAN_INVALID', 'resource order');
    previous = row.sourcePath;
    if (!DISPOSITIONS.has(row.disposition) || resources.has(row.sourcePath)) fail('KSTACK_PROJECTION_PLAN_INVALID');
    const packageMember = admission.canonicalPackage.members.find((member) => member.path === row.sourcePath);
    if (!packageMember || packageMember.role !== 'MODEL_SOURCE' && row.disposition !== 'EXACT') fail('KSTACK_PROJECTION_PLAN_INVALID', 'non-model member must be exact');
    sortedUnique(row.affectedIds, 'KSTACK_PROJECTION_PLAN_INVALID', (value) => identifier(value, 'KSTACK_PROJECTION_PLAN_INVALID'));
    if (row.disposition === 'UNSUPPORTED') {
      identifier(row.reasonCode, 'KSTACK_PROJECTION_PLAN_INVALID');
      if (row.affectedIds.length === 0 || !admission.registry.reasonCodes.some((reason) => reason.id === row.reasonCode && reason.category === 'UNSUPPORTED')) fail('KSTACK_PROJECTION_PLAN_INVALID');
    } else if (row.reasonCode !== null) fail('KSTACK_PROJECTION_PLAN_INVALID');
    resources.set(row.sourcePath, row);
  }
  if (canonicalJson([...resources.keys()]) !== canonicalJson(admission.canonicalPackage.members.map((row) => row.path))) fail('KSTACK_PROJECTION_PLAN_INVALID', 'resource coverage');
  const outputPaths = [...resources.values()].map((row) => row.outputPath).sort(compareUtf8);
  if (new Set(outputPaths.map((value) => value.toLowerCase())).size !== outputPaths.length) fail('KSTACK_PROJECTION_PLAN_INVALID', 'output collision');
  if (!Array.isArray(plan.tokenUseDispositions)) fail('KSTACK_PROJECTION_PLAN_INVALID');
  const tokenUses = new Map();
  for (const row of plan.tokenUseDispositions) {
    exact(row, ['sourcePath', 'clauseId', 'tokenId', 'sourceStartByte', 'sourceEndByte', 'disposition', 'value', 'valueDigest', 'reasonCode', 'affectedIds'], 'KSTACK_PROJECTION_PLAN_INVALID');
    validatePortableRelativePath(row.sourcePath); identifier(row.clauseId, 'KSTACK_PROJECTION_PLAN_INVALID'); identifier(row.tokenId, 'KSTACK_PROJECTION_PLAN_INVALID'); decimal(row.sourceStartByte, 'KSTACK_PROJECTION_PLAN_INVALID'); decimal(row.sourceEndByte, 'KSTACK_PROJECTION_PLAN_INVALID');
    const key = `${row.sourcePath}:${row.sourceStartByte}:${row.sourceEndByte}`;
    if (tokenUses.has(key) || !['PROJECT', 'UNSUPPORTED'].includes(row.disposition)) fail('KSTACK_PROJECTION_PLAN_INVALID');
    sortedUnique(row.affectedIds, 'KSTACK_PROJECTION_PLAN_INVALID', (value) => identifier(value, 'KSTACK_PROJECTION_PLAN_INVALID'));
    if (row.disposition === 'PROJECT') {
      text(row.value, 'KSTACK_PROJECTION_PLAN_INVALID');
      if (row.valueDigest !== rawDigest(row.value) || row.reasonCode !== null) fail('KSTACK_PROJECTION_PLAN_INVALID');
    } else if (row.value !== null || row.valueDigest !== null || row.reasonCode === null || row.affectedIds.length === 0) fail('KSTACK_PROJECTION_PLAN_INVALID');
    tokenUses.set(key, row);
  }
  const occurrences = admission.clauseInventory.rows.flatMap((row) => row.tokenOccurrences.map((occurrence) => ({ ...occurrence, sourcePath: row.sourcePath, clauseId: row.clauseId })));
  if (tokenUses.size !== occurrences.length) fail('KSTACK_PROJECTION_PLAN_INVALID', 'token coverage');
  for (const occurrence of occurrences) {
    const key = `${occurrence.sourcePath}:${occurrence.startByte}:${occurrence.endByte}`;
    const disposition = tokenUses.get(key);
    if (!disposition || disposition.tokenId !== occurrence.tokenId || disposition.clauseId !== occurrence.clauseId) fail('KSTACK_PROJECTION_PLAN_INVALID', 'token binding');
  }
  return { resources, tokenUses };
}

function projectToken(value, context) {
  if (value.includes('<!-- kstack-clause:') || value.includes('<!-- /kstack-clause:') || value.includes('\r') || value.includes('\u0000') || value.includes('---\n') || value.includes('```')) fail('TOKEN_UNKNOWN_OR_CONTEXT_INVALID', 'unsafe replacement');
  if (context === 'CODE_SPAN') {
    if (value.includes('`')) fail('TOKEN_UNKNOWN_OR_CONTEXT_INVALID');
    return value;
  }
  if (context === 'CODE_BLOCK') return value;
  if (context === 'LINK_TARGET') return encodeURI(value).replaceAll('(', '%28').replaceAll(')', '%29');
  return value.replace(/[<>]/gu, (character) => character === '<' ? '&lt;' : '&gt;');
}

function append(output, bytes) {
  const buffer = Buffer.from(bytes);
  const start = output.length;
  output.parts.push(buffer); output.length += buffer.length;
  return { start, end: output.length, digest: rawDigest(buffer) };
}

function canonicalFrontmatter(fields) {
  const order = ['name', 'description', 'license', 'compatibility'];
  const scalar = order.filter((key) => Object.hasOwn(fields, key)).map((key) => `${key}: ${JSON.stringify(fields[key])}\n`).join('');
  const hostScalar = Object.keys(fields).filter((key) => key !== 'metadata' && !order.includes(key)).sort(compareUtf8)
    .map((key) => `${key}: ${JSON.stringify(fields[key])}\n`).join('');
  const metadata = Object.hasOwn(fields, 'metadata')
    ? `metadata:\n${Object.keys(fields.metadata).sort(compareUtf8).map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(fields.metadata[key])}\n`).join('')}`
    : '';
  return `---\n${scalar}${hostScalar}${metadata}---\n`;
}

function parseProjectedFrontmatter(raw, allowedKeys) {
  if (typeof raw !== 'string' || !raw.startsWith('---\n') || !raw.endsWith('---\n')) fail('FRONTMATTER_MAP_MISMATCH');
  const lines = raw.slice(4, -4).split('\n').filter(Boolean);
  const fields = {};
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === 'metadata:') {
      if (!allowedKeys.has('metadata') || Object.hasOwn(fields, 'metadata')) fail('FRONTMATTER_MAP_MISMATCH');
      fields.metadata = {};
      while (index + 1 < lines.length && lines[index + 1].startsWith('  ')) {
        index += 1;
        const nested = /^  ("(?:[^"\\]|\\.)*"): ("(?:[^"\\]|\\.)*")$/u.exec(lines[index]);
        if (!nested) fail('FRONTMATTER_MAP_MISMATCH');
        const key = JSON.parse(nested[1]); const value = JSON.parse(nested[2]);
        if (Object.hasOwn(fields.metadata, key)) fail('FRONTMATTER_MAP_MISMATCH');
        fields.metadata[key] = value;
      }
      continue;
    }
    const scalar = /^([a-z][a-z0-9.-]*): ("(?:[^"\\]|\\.)*")$/u.exec(lines[index]);
    if (!scalar || !allowedKeys.has(scalar[1]) || Object.hasOwn(fields, scalar[1])) fail('FRONTMATTER_MAP_MISMATCH');
    fields[scalar[1]] = JSON.parse(scalar[2]);
  }
  if (raw !== canonicalFrontmatter(fields)) fail('FRONTMATTER_MAP_MISMATCH', 'noncanonical emitted frontmatter');
  return fields;
}

function projectModelMember({ member, resource, admission, plan, tokenUses }) {
  const bytes = admission.memberBytes[member.path];
  const partition = admission.clauseInventory.filePartitions.find((row) => row.sourcePath === member.path);
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const output = { parts: [], length: 0 };
  const frontmatterMaps = []; const partitionMaps = []; const rows = [];
  if (resource.disposition === 'UNSUPPORTED') return { bytes: null, frontmatterMaps, partitionMaps, rows };
  for (const segment of partition.segments) {
    const sourceStart = Number(segment.startByte); const sourceEnd = Number(segment.endByte);
    const sourceSpan = bytes.subarray(sourceStart, sourceEnd);
    if (segment.kind === 'FRONTMATTER') {
      const skill = admission.canonicalPackage.skills.find((item) => item.skillId === member.skillId);
      const parsed = parseCanonicalFrontmatter(source, skill.skillId);
      const kept = Object.fromEntries(Object.entries(parsed.fields).filter(([key]) => plan.frontmatterProjection.keptFields.includes(key)));
      for (const field of plan.frontmatterProjection.hostFields) kept[field.key] = field.value;
      const emitted = canonicalFrontmatter(kept);
      const emittedFields = parseProjectedFrontmatter(emitted, new Set(Object.keys(kept)));
      if (canonicalJson(emittedFields) !== canonicalJson(kept)) fail('FRONTMATTER_MAP_MISMATCH', 'semantic round trip');
      const span = append(output, emitted);
      const sourceSemanticDigest = addressObject(HOST_PACKAGE_DOMAINS.frontmatterSemantic, parsed.fields);
      const projected = {
        schemaId: 'kstack.projected-frontmatter-semantic.v1', schemaVersion: 1,
        registrySetDigest: admission.registrySetDigest, targetId: plan.targetId, metadataAdapterId: plan.metadataAdapterId,
        fields: Object.keys(emittedFields).sort(compareUtf8).map((key) => ({ key, value: typeof emittedFields[key] === 'string' ? emittedFields[key] : canonicalJson(emittedFields[key]), origin: Object.hasOwn(parsed.fields, key) ? 'CANONICAL' : 'HOST', sourceKey: Object.hasOwn(parsed.fields, key) ? key : null }))
      };
      const valueDigest = (value) => rawDigest(typeof value === 'string' ? value : canonicalJson(value));
      const fieldBindings = [
        ...Object.keys(parsed.fields).sort(compareUtf8).map((key) => ({ disposition: Object.hasOwn(emittedFields, key) ? (canonicalJson(parsed.fields[key]) === canonicalJson(emittedFields[key]) ? 'KEEP' : 'REENCODE') : 'DROP', sourceKey: key, outputKey: Object.hasOwn(emittedFields, key) ? key : null, sourceValueDigest: valueDigest(parsed.fields[key]), outputValueDigest: Object.hasOwn(emittedFields, key) ? valueDigest(emittedFields[key]) : null })),
        ...Object.keys(emittedFields).sort(compareUtf8).filter((key) => !Object.hasOwn(parsed.fields, key)).map((key) => ({ disposition: 'ADD', sourceKey: null, outputKey: key, sourceValueDigest: null, outputValueDigest: valueDigest(emittedFields[key]) }))
      ];
      frontmatterMaps.push({ sourcePath: member.path, outputPath: resource.outputPath, sourceStartByte: segment.startByte, sourceEndByte: segment.endByte, sourceSpanDigest: segment.spanDigest, sourceSemanticDigest, outputStartByte: String(span.start), outputEndByte: String(span.end), outputSpanDigest: span.digest, outputSemanticDigest: addressObject(HOST_PACKAGE_DOMAINS.projectedFrontmatterSemantic, projected), fieldBindings });
      continue;
    }
    if (['FRAMING_LF', 'OPEN_MARKER', 'CLOSE_MARKER'].includes(segment.kind)) {
      const preserve = segment.kind === 'FRAMING_LF' || resource.disposition === 'EXACT';
      const span = preserve ? append(output, sourceSpan) : null;
      partitionMaps.push({ sourcePath: member.path, kind: segment.kind, clauseId: segment.clauseId, sourceStartByte: segment.startByte, sourceEndByte: segment.endByte, sourceSpanDigest: segment.spanDigest, disposition: preserve ? 'PRESERVE' : 'OMIT', outputPath: resource.outputPath, outputStartByte: span ? String(span.start) : null, outputEndByte: span ? String(span.end) : null, outputSpanDigest: span?.digest ?? null, reasonCode: preserve ? null : 'projection-nonsemantic-framing-omitted' });
      continue;
    }
    const clause = admission.clauseInventory.rows.find((row) => row.sourcePath === member.path && row.clauseId === segment.clauseId);
    if (resource.disposition === 'EXACT' && clause.tokenOccurrences.length > 0) fail('PROJECTION_LITERAL_CHANGED', 'EXACT resource contains tokens');
    const bodyStart = output.length; let sourceCursor = sourceStart; const replacementBindings = [];
    for (const occurrence of clause.tokenOccurrences) {
      const occurrenceStart = Number(occurrence.startByte); const occurrenceEnd = Number(occurrence.endByte);
      append(output, bytes.subarray(sourceCursor, occurrenceStart));
      const use = tokenUses.get(`${member.path}:${occurrence.startByte}:${occurrence.endByte}`);
      if (use.disposition !== 'PROJECT') fail('PROJECTION_UNSUPPORTED', occurrence.tokenId);
      const replacement = projectToken(use.value, occurrence.context);
      const span = append(output, replacement);
      replacementBindings.push({ tokenId: occurrence.tokenId, sourceStartByte: occurrence.startByte, sourceEndByte: occurrence.endByte, outputStartByte: String(span.start), outputEndByte: String(span.end), outputDigest: span.digest });
      sourceCursor = occurrenceEnd;
    }
    append(output, bytes.subarray(sourceCursor, sourceEnd));
    const outputBytes = Buffer.concat(output.parts).subarray(bodyStart, output.length);
    rows.push({ clauseId: clause.clauseId, disposition: resource.disposition, sourcePath: member.path, sourceStartByte: clause.sourceStartByte, sourceEndByte: clause.sourceEndByte, outputPath: resource.outputPath, outputStartByte: String(bodyStart), outputEndByte: String(output.length), outputSpanDigest: rawDigest(outputBytes), replacementBindings, reasonCode: null, affectedIds: resource.affectedIds });
  }
  return { bytes: Buffer.concat(output.parts), frontmatterMaps, partitionMaps, rows };
}

export function renderSourcePackage({ admission, plan, resolverSchemaVersion, resolverImplementationDigest, platformProfile, unsupportedTemplates = {} }) {
  plain(admission, 'KSTACK_PROJECTION_INPUT_INVALID');
  text(resolverSchemaVersion, 'KSTACK_PROJECTION_INPUT_INVALID'); digest(resolverImplementationDigest, 'KSTACK_PROJECTION_INPUT_INVALID'); identifier(platformProfile, 'KSTACK_PROJECTION_INPUT_INVALID');
  if (!admission.registry.platformProfiles.some((row) => row.id === platformProfile)) fail('KSTACK_PROJECTION_INPUT_INVALID', 'platform profile');
  const { resources, tokenUses } = validateProjectionPlan(plan, admission);
  const projectionPlanDigest = addressObject(HOST_PACKAGE_DOMAINS.projectionPlan, plan);
  const rendered = []; const frontmatterMaps = []; const partitionMaps = []; const rows = []; const generatedOutputMaps = []; const unsupported = [];
  for (const member of admission.canonicalPackage.members) {
    const resource = resources.get(member.path);
    let outputBytes;
    if (member.role === 'MODEL_SOURCE') {
      const projected = projectModelMember({ member, resource, admission, plan, tokenUses });
      frontmatterMaps.push(...projected.frontmatterMaps); partitionMaps.push(...projected.partitionMaps); rows.push(...projected.rows);
      outputBytes = projected.bytes;
    } else {
      if (resource.disposition !== 'EXACT') fail('KSTACK_PROJECTION_PLAN_INVALID', 'non-model member must be exact');
      outputBytes = Buffer.from(admission.memberBytes[member.path]);
    }
    let role = member.role === 'MODEL_SOURCE' ? (member.path.endsWith('/SKILL.src.md') ? 'SKILL_ENTRY' : 'REFERENCE') : member.role;
    if (resource.disposition === 'UNSUPPORTED') {
      const expectedMediaTypeId = member.role === 'MODEL_SOURCE' ? 'text-markdown' : 'application-octet-stream';
      const templateEntries = admission.registry.unsupportedStatusTemplates.filter((entry) => entry.mediaTypeId === expectedMediaTypeId);
      if (templateEntries.length !== 1) fail('PROJECTION_UNSUPPORTED', 'template selection ambiguous');
      const [templateEntry] = templateEntries;
      const template = unsupportedTemplates[templateEntry?.id];
      if (!template || template.templateId !== templateEntry.id || template.mediaTypeId !== templateEntry.mediaTypeId
          || addressObject(HOST_PACKAGE_DOMAINS.unsupportedStatusTemplate, template) !== templateEntry.templateDigest) fail('PROJECTION_UNSUPPORTED', 'template unavailable');
      outputBytes = Buffer.from(renderUnsupportedStatus(template, { sourcePath: member.path, reasonCode: resource.reasonCode, affectedIds: resource.affectedIds }));
      role = 'UNSUPPORTED_STATUS';
      generatedOutputMaps.push({ outputPath: resource.outputPath, outputStartByte: '0', outputEndByte: String(outputBytes.length), outputSpanDigest: rawDigest(outputBytes), templateSchemaDigest: templateEntry.templateSchemaDigest, templateId: templateEntry.id, templateMediaTypeId: templateEntry.mediaTypeId, templateDigest: templateEntry.templateDigest, sourcePath: member.path, reasonCode: resource.reasonCode, affectedIds: resource.affectedIds });
      const sourcePartition = admission.clauseInventory.filePartitions.find((row) => row.sourcePath === member.path);
      for (const segment of sourcePartition.segments.filter((item) => item.kind !== 'CLAUSE_BODY')) partitionMaps.push({ sourcePath: member.path, kind: segment.kind, clauseId: segment.clauseId, sourceStartByte: segment.startByte, sourceEndByte: segment.endByte, sourceSpanDigest: segment.spanDigest, disposition: 'UNSUPPORTED', outputPath: resource.outputPath, outputStartByte: null, outputEndByte: null, outputSpanDigest: null, reasonCode: resource.reasonCode });
      for (const clause of admission.clauseInventory.rows.filter((row) => row.sourcePath === member.path)) rows.push({ clauseId: clause.clauseId, disposition: 'UNSUPPORTED', sourcePath: member.path, sourceStartByte: clause.sourceStartByte, sourceEndByte: clause.sourceEndByte, outputPath: resource.outputPath, outputStartByte: null, outputEndByte: null, outputSpanDigest: null, replacementBindings: [], reasonCode: resource.reasonCode, affectedIds: resource.affectedIds });
      unsupported.push({ sourcePath: member.path, reasonCode: resource.reasonCode, affectedIds: resource.affectedIds });
    }
    rendered.push({ path: resource.outputPath, role, mediaTypeId: member.role === 'MODEL_SOURCE' ? 'text-markdown' : 'application-octet-stream', byteLength: String(outputBytes.length), contentDigest: rawDigest(outputBytes), sourceMemberDigest: resource.disposition === 'UNSUPPORTED' ? null : rawDigest(admission.memberBytes[member.path]), bytes: outputBytes });
  }
  rendered.sort((left, right) => compareUtf8(left.path, right.path));
  if (rows.length !== admission.clauseInventory.rows.length || new Set(rows.map((row) => row.clauseId)).size !== admission.clauseInventory.rows.length) fail('PROJECTION_MAP_MISMATCH', 'clause coverage');
  for (const member of rendered.filter((item) => ['SKILL_ENTRY', 'REFERENCE', 'UNSUPPORTED_STATUS'].includes(item.role))) {
    const spans = [
      ...frontmatterMaps.filter((row) => row.outputPath === member.path).map((row) => [Number(row.outputStartByte), Number(row.outputEndByte)]),
      ...partitionMaps.filter((row) => row.outputPath === member.path && row.outputStartByte !== null).map((row) => [Number(row.outputStartByte), Number(row.outputEndByte)]),
      ...rows.filter((row) => row.outputPath === member.path && row.outputStartByte !== null).map((row) => [Number(row.outputStartByte), Number(row.outputEndByte)]),
      ...generatedOutputMaps.filter((row) => row.outputPath === member.path).map((row) => [Number(row.outputStartByte), Number(row.outputEndByte)])
    ].sort((left, right) => left[0] - right[0]);
    if (spans.length === 0 || spans[0][0] !== 0 || spans.at(-1)[1] !== Number(member.byteLength)) fail('PROJECTION_MAP_MISMATCH', member.path);
    for (let index = 1; index < spans.length; index += 1) if (spans[index - 1][1] !== spans[index][0]) fail('PROJECTION_MAP_MISMATCH', member.path);
  }
  const projectionMap = { schemaId: 'kstack.projection-map.v1', schemaVersion: 1, registrySetDigest: admission.registrySetDigest, sourceBundleDigest: admission.sourceBundleDigest, clauseInventoryDigest: admission.clauseInventoryDigest, projectionPlanDigest, frontmatterMaps, partitionMaps, rows, generatedOutputMaps };
  const projectionMapDigest = addressObject(HOST_PACKAGE_DOMAINS.projectionMap, projectionMap);
  const renderBundle = {
    schemaId: 'kstack.render-bundle.v1', schemaVersion: 1, registrySetDigest: admission.registrySetDigest,
    sourceBundleDigest: admission.sourceBundleDigest, clauseInventoryDigest: admission.clauseInventoryDigest,
    projectionPlanDigest, resolverSchemaVersion, resolverImplementationDigest, targetId: plan.targetId, platformProfile,
    members: rendered.map(({ bytes, ...member }) => member), projectionMapDigest, unsupported
  };
  const renderBundleDigest = addressObject(HOST_PACKAGE_DOMAINS.renderBundle, renderBundle);
  const historicalResolution = {
    schemaId: 'kstack.historical-resolution.v1', schemaVersion: 1, registrySetDigest: admission.registrySetDigest,
    sourceBundleDigest: admission.sourceBundleDigest, clauseInventoryDigest: admission.clauseInventoryDigest,
    projectionPlanDigest, renderBundleDigest, projectionMapDigest,
    reuseAdmissionDigests: admission.canonicalPackage.reuseAdmissionDigests, resolverSchemaVersion, resolverImplementationDigest
  };
  return Object.freeze({ projectionPlanDigest, projectionMap, projectionMapDigest, renderBundle, renderBundleDigest, historicalResolution, historicalResolutionDigest: addressObject(HOST_PACKAGE_DOMAINS.historicalResolution, historicalResolution), memberBytes: Object.freeze(Object.fromEntries(rendered.map((member) => [member.path, member.bytes]))) });
}

function exactCandidate(candidate) {
  exact(candidate, ['schemaId', 'schemaVersion', 'registrySetDigest', 'historicalResolutionDigest', 'renderBundleDigest', 'targetId', 'platformProfile', 'intendedScope', 'destinationTemplateId'], 'KSTACK_INSTALLER_CANDIDATE_INVALID');
  if (candidate.schemaId !== 'kstack.installer-candidate.v1' || candidate.schemaVersion !== 1 || !SCOPES.has(candidate.intendedScope)) fail('KSTACK_INSTALLER_CANDIDATE_INVALID');
  for (const key of ['registrySetDigest', 'historicalResolutionDigest', 'renderBundleDigest']) digest(candidate[key], 'KSTACK_INSTALLER_CANDIDATE_INVALID');
  for (const key of ['targetId', 'platformProfile', 'destinationTemplateId']) identifier(candidate[key], 'KSTACK_INSTALLER_CANDIDATE_INVALID');
  return candidate;
}

export function createInstallerCandidate(input) {
  const candidate = exactCandidate({ schemaId: 'kstack.installer-candidate.v1', schemaVersion: 1, ...input });
  return Object.freeze({ candidate, installerCandidateDigest: addressObject(HOST_PACKAGE_DOMAINS.installerCandidate, candidate) });
}

export function createInstallerPreflightRequest(candidate, expectedDigest) {
  exactCandidate(candidate);
  if (addressObject(HOST_PACKAGE_DOMAINS.installerCandidate, candidate) !== expectedDigest) fail('KSTACK_INSTALLER_CANDIDATE_INVALID', 'digest');
  const request = { schemaId: 'kstack.installer-preflight-request.v1', schemaVersion: 1, registrySetDigest: candidate.registrySetDigest, installerCandidateDigest: expectedDigest, expectedState: 'NO_PRIOR_ACTIVE_INSTALL' };
  return Object.freeze({ request, preflightRequestDigest: addressObject(HOST_PACKAGE_DOMAINS.installerPreflightRequest, request) });
}

function validateInstalledMemberManifest(input) {
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'targetId', 'platformProfile', 'scope', 'destinationTemplateId', 'installationRootIdentityDigest', 'members'], 'KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID');
  if (input.schemaId !== 'kstack.installed-member-manifest.v1' || input.schemaVersion !== 1 || !SCOPES.has(input.scope)) fail('KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID');
  digest(input.registrySetDigest, 'KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID'); identifier(input.targetId, 'KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID'); identifier(input.platformProfile, 'KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID');
  identifier(input.destinationTemplateId, 'KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID'); digest(input.installationRootIdentityDigest, 'KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID');
  if (!Array.isArray(input.members)) fail('KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID');
  pathSet(input.members, 'KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID');
  for (const member of input.members) {
    exact(member, ['path', 'byteLength', 'contentDigest', 'fileIdentityDigest'], 'KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID');
    decimal(member.byteLength, 'KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID'); digest(member.contentDigest, 'KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID'); digest(member.fileIdentityDigest, 'KSTACK_INSTALLED_MEMBER_MANIFEST_INVALID');
  }
  return input;
}

function validateHealthRecord(input) {
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'targetId', 'platformProfile', 'installedMemberManifestDigest', 'testSuiteDigest', 'results', 'overall'], 'KSTACK_HEALTH_RECORD_INVALID');
  if (input.schemaId !== 'kstack.health-record.v1' || input.schemaVersion !== 1) fail('KSTACK_HEALTH_RECORD_INVALID');
  for (const value of [input.registrySetDigest, input.installedMemberManifestDigest, input.testSuiteDigest]) digest(value, 'KSTACK_HEALTH_RECORD_INVALID');
  identifier(input.targetId, 'KSTACK_HEALTH_RECORD_INVALID'); identifier(input.platformProfile, 'KSTACK_HEALTH_RECORD_INVALID');
  if (!Array.isArray(input.results) || input.results.length === 0) fail('KSTACK_HEALTH_RECORD_INVALID');
  let prior = null;
  for (const result of input.results) {
    exact(result, ['testObligationId', 'outcome', 'evidenceDigests'], 'KSTACK_HEALTH_RECORD_INVALID'); identifier(result.testObligationId, 'KSTACK_HEALTH_RECORD_INVALID');
    if (prior !== null && compareUtf8(prior, result.testObligationId) >= 0) fail('KSTACK_HEALTH_RECORD_INVALID'); prior = result.testObligationId;
    if (!['PASS', 'FAIL', 'UNAVAILABLE'].includes(result.outcome)) fail('KSTACK_HEALTH_RECORD_INVALID');
    sortedUnique(result.evidenceDigests, 'KSTACK_HEALTH_RECORD_INVALID', (value) => digest(value, 'KSTACK_HEALTH_RECORD_INVALID'));
  }
  const overall = input.results.some((result) => result.outcome === 'FAIL') ? 'FAIL' : input.results.some((result) => result.outcome === 'UNAVAILABLE') ? 'UNAVAILABLE' : 'PASS';
  if (input.overall !== overall) fail('KSTACK_HEALTH_RECORD_INVALID');
  return input;
}

function validatePreservationBaseline(input, code = 'KSTACK_PRESERVATION_BASELINE_INVALID') {
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'targetId', 'platformProfile', 'installedMemberManifestDigest', 'healthRecordDigest', 'historicalResolutionDigest', 'ownerDecisionDigest'], code);
  if (input.schemaId !== 'kstack.preservation-baseline.v1' || input.schemaVersion !== 1) fail(code);
  for (const key of ['registrySetDigest', 'installedMemberManifestDigest', 'healthRecordDigest', 'historicalResolutionDigest', 'ownerDecisionDigest']) digest(input[key], code);
  identifier(input.targetId, code); identifier(input.platformProfile, code);
  return input;
}

export function admitInitialStateEvidence({ candidate, preflightRequest, evidence }) {
  exactCandidate(candidate);
  exact(preflightRequest, ['schemaId', 'schemaVersion', 'registrySetDigest', 'installerCandidateDigest', 'expectedState'], 'KSTACK_INSTALLER_PREFLIGHT_INVALID');
  exact(evidence, ['schemaId', 'schemaVersion', 'registrySetDigest', 'preflightRequestDigest', 'installerCandidateDigest', 'targetId', 'platformProfile', 'scope', 'destinationTemplateId', 'resolvedDestinationBindingDigest', 'observedState', 'ownershipEvidenceDigest', 'installedMemberManifestDigest', 'priorActiveInstallReceiptDigest', 'observationEvidenceDigest', 'protectedPreflightReceiptDigest'], 'KSTACK_INITIAL_STATE_EVIDENCE_INVALID');
  const candidateDigest = addressObject(HOST_PACKAGE_DOMAINS.installerCandidate, candidate);
  if (preflightRequest.schemaId !== 'kstack.installer-preflight-request.v1' || preflightRequest.schemaVersion !== 1
      || preflightRequest.registrySetDigest !== candidate.registrySetDigest || preflightRequest.installerCandidateDigest !== candidateDigest
      || preflightRequest.expectedState !== 'NO_PRIOR_ACTIVE_INSTALL') fail('KSTACK_INSTALLER_PREFLIGHT_INVALID');
  if (evidence.schemaId !== 'kstack.initial-state-evidence.v1' || evidence.schemaVersion !== 1 || !['ABSENT', 'EMPTY_OWNED', 'EXISTING'].includes(evidence.observedState)) fail('KSTACK_INITIAL_STATE_EVIDENCE_INVALID');
  const requestDigest = addressObject(HOST_PACKAGE_DOMAINS.installerPreflightRequest, preflightRequest);
  if (preflightRequest.installerCandidateDigest !== candidateDigest || evidence.preflightRequestDigest !== requestDigest || evidence.installerCandidateDigest !== candidateDigest
      || evidence.registrySetDigest !== candidate.registrySetDigest || evidence.targetId !== candidate.targetId || evidence.platformProfile !== candidate.platformProfile
      || evidence.scope !== candidate.intendedScope || evidence.destinationTemplateId !== candidate.destinationTemplateId) fail('KSTACK_INITIAL_STATE_EVIDENCE_INVALID', 'context binding');
  for (const key of ['resolvedDestinationBindingDigest', 'observationEvidenceDigest', 'protectedPreflightReceiptDigest']) digest(evidence[key], 'KSTACK_INITIAL_STATE_EVIDENCE_INVALID');
  for (const key of ['ownershipEvidenceDigest', 'installedMemberManifestDigest', 'priorActiveInstallReceiptDigest']) nullableDigest(evidence[key], 'KSTACK_INITIAL_STATE_EVIDENCE_INVALID');
  if (evidence.observedState === 'ABSENT' && [evidence.ownershipEvidenceDigest, evidence.installedMemberManifestDigest, evidence.priorActiveInstallReceiptDigest].some((value) => value !== null)) fail('KSTACK_INITIAL_STATE_EVIDENCE_INVALID');
  if (evidence.observedState === 'EMPTY_OWNED' && (evidence.ownershipEvidenceDigest === null || evidence.installedMemberManifestDigest !== null || evidence.priorActiveInstallReceiptDigest !== null)) fail('KSTACK_INITIAL_STATE_EVIDENCE_INVALID');
  if (evidence.observedState === 'EXISTING' || evidence.installedMemberManifestDigest !== null || evidence.priorActiveInstallReceiptDigest !== null) fail('KSTACK_INITIAL_STATE_NOT_QUALIFIED');
  return Object.freeze({ evidence, initialStateEvidenceDigest: addressObject(HOST_PACKAGE_DOMAINS.initialStateEvidence, evidence) });
}

export function createInstalledMemberManifest({ registrySetDigest, targetId, platformProfile, scope, destinationTemplateId, installationRootIdentityDigest, members }) {
  const manifest = validateInstalledMemberManifest({ schemaId: 'kstack.installed-member-manifest.v1', schemaVersion: 1, registrySetDigest, targetId, platformProfile, scope, destinationTemplateId, installationRootIdentityDigest, members });
  return Object.freeze({ manifest, installedMemberManifestDigest: addressObject(HOST_PACKAGE_DOMAINS.installedMemberManifest, manifest) });
}

export function createHealthRecord({ registrySetDigest, targetId, platformProfile, installedMemberManifestDigest, testSuiteDigest, results }) {
  if (!Array.isArray(results)) fail('KSTACK_HEALTH_RECORD_INVALID');
  const overall = results.some((result) => result.outcome === 'FAIL') ? 'FAIL' : results.some((result) => result.outcome === 'UNAVAILABLE') ? 'UNAVAILABLE' : 'PASS';
  const healthRecord = validateHealthRecord({ schemaId: 'kstack.health-record.v1', schemaVersion: 1, registrySetDigest, targetId, platformProfile, installedMemberManifestDigest, testSuiteDigest, results, overall });
  return Object.freeze({ healthRecord, healthRecordDigest: addressObject(HOST_PACKAGE_DOMAINS.healthRecord, healthRecord) });
}

export function createPreservationBaseline({ manifest, healthRecord, historicalResolutionDigest, ownerDecisionDigest }) {
  try { validateInstalledMemberManifest(manifest); validateHealthRecord(healthRecord); } catch { fail('KSTACK_PRESERVATION_BASELINE_INVALID'); }
  const installedMemberManifestDigest = addressObject(HOST_PACKAGE_DOMAINS.installedMemberManifest, manifest);
  if (healthRecord.installedMemberManifestDigest !== installedMemberManifestDigest || healthRecord.registrySetDigest !== manifest.registrySetDigest
      || healthRecord.targetId !== manifest.targetId || healthRecord.platformProfile !== manifest.platformProfile) fail('KSTACK_PRESERVATION_BASELINE_INVALID', 'health binding');
  digest(historicalResolutionDigest, 'KSTACK_PRESERVATION_BASELINE_INVALID'); digest(ownerDecisionDigest, 'KSTACK_PRESERVATION_BASELINE_INVALID');
  const baseline = {
    schemaId: 'kstack.preservation-baseline.v1', schemaVersion: 1, registrySetDigest: manifest.registrySetDigest,
    targetId: manifest.targetId, platformProfile: manifest.platformProfile, installedMemberManifestDigest,
    healthRecordDigest: addressObject(HOST_PACKAGE_DOMAINS.healthRecord, healthRecord), historicalResolutionDigest, ownerDecisionDigest
  };
  return Object.freeze({ baseline, preservationBaselineDigest: addressObject(HOST_PACKAGE_DOMAINS.preservationBaseline, baseline) });
}

function validateRenderMemberInventory(bundle, code) {
  plain(bundle, code);
  if (bundle.schemaId !== 'kstack.render-bundle.v1' || bundle.schemaVersion !== 1 || !Array.isArray(bundle.members) || bundle.members.length === 0) fail(code, 'render bundle');
  let prior = null;
  for (const member of bundle.members) {
    exact(member, ['path', 'role', 'mediaTypeId', 'byteLength', 'contentDigest', 'sourceMemberDigest'], code);
    validatePortableRelativePath(member.path); text(member.role, code); identifier(member.mediaTypeId, code); decimal(member.byteLength, code);
    digest(member.contentDigest, code); nullableDigest(member.sourceMemberDigest, code);
    if (prior !== null && compareUtf8(prior, member.path) >= 0) fail(code, 'render member order');
    prior = member.path;
  }
  return bundle;
}

function validateHistoricalResolutionShape(input, code = 'KSTACK_HISTORICAL_RESOLUTION_INVALID') {
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'sourceBundleDigest', 'clauseInventoryDigest', 'projectionPlanDigest', 'renderBundleDigest', 'projectionMapDigest', 'reuseAdmissionDigests', 'resolverSchemaVersion', 'resolverImplementationDigest'], code);
  if (input.schemaId !== 'kstack.historical-resolution.v1' || input.schemaVersion !== 1) fail(code);
  for (const key of ['registrySetDigest', 'sourceBundleDigest', 'clauseInventoryDigest', 'projectionPlanDigest', 'renderBundleDigest', 'projectionMapDigest', 'resolverImplementationDigest']) digest(input[key], code);
  text(input.resolverSchemaVersion, code, 64);
  sortedUnique(input.reuseAdmissionDigests, code, (value) => digest(value, code));
  return input;
}

function validateMigrationProposal(input, code = 'KSTACK_PRESERVATION_MIGRATION_INVALID') {
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'fromBaselineDigest', 'installerCandidateDigest', 'differences', 'requiredTestEvidenceDigests'], code);
  if (input.schemaId !== 'kstack.preservation-migration-proposal.v1' || input.schemaVersion !== 1) fail(code);
  for (const key of ['registrySetDigest', 'fromBaselineDigest', 'installerCandidateDigest']) digest(input[key], code);
  if (!Array.isArray(input.differences) || input.differences.length === 0) fail(code, 'differences');
  let prior = null;
  for (const difference of input.differences) {
    exact(difference, ['path', 'change', 'oldDigest', 'newDigest', 'reason'], code);
    validatePortableRelativePath(difference.path); text(difference.reason, code);
    if (prior !== null && compareUtf8(prior, difference.path) >= 0) fail(code, 'difference order');
    prior = difference.path;
    if (!['ADD', 'REMOVE', 'CHANGE'].includes(difference.change)) fail(code, 'difference change');
    nullableDigest(difference.oldDigest, code); nullableDigest(difference.newDigest, code);
    if (difference.change === 'ADD' && (difference.oldDigest !== null || difference.newDigest === null)
        || difference.change === 'REMOVE' && (difference.oldDigest === null || difference.newDigest !== null)
        || difference.change === 'CHANGE' && (difference.oldDigest === null || difference.newDigest === null || difference.oldDigest === difference.newDigest)) fail(code, 'difference digest');
  }
  sortedUnique(input.requiredTestEvidenceDigests, code, (value) => digest(value, code));
  if (input.requiredTestEvidenceDigests.length === 0) fail(code, 'test evidence');
  return input;
}

function validateMigrationAuthorization(input, code = 'KSTACK_PRESERVATION_MIGRATION_AUTHORIZATION_INVALID') {
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'migrationProposalDigest', 'ownerPrincipalDigest', 'decision', 'riskAcknowledgementDigest', 'protectedDecisionReceiptDigest'], code);
  if (input.schemaId !== 'kstack.preservation-migration-authorization.v1' || input.schemaVersion !== 1) fail(code);
  for (const key of ['registrySetDigest', 'migrationProposalDigest', 'ownerPrincipalDigest', 'protectedDecisionReceiptDigest']) digest(input[key], code);
  nullableDigest(input.riskAcknowledgementDigest, code);
  if (!['APPROVE', 'REJECT'].includes(input.decision) || input.decision === 'APPROVE' && input.riskAcknowledgementDigest === null) fail(code);
  return input;
}

export function createMigrationProposal({ baseline, installedManifest, candidate, candidateRenderBundle, reasons, requiredTestEvidenceDigests }) {
  exactCandidate(candidate);
  validatePreservationBaseline(baseline, 'KSTACK_PRESERVATION_MIGRATION_INVALID'); validateInstalledMemberManifest(installedManifest); validateRenderMemberInventory(candidateRenderBundle, 'KSTACK_PRESERVATION_MIGRATION_INVALID');
  plain(reasons, 'KSTACK_PRESERVATION_MIGRATION_INVALID');
  sortedUnique(requiredTestEvidenceDigests, 'KSTACK_PRESERVATION_MIGRATION_INVALID', (value) => digest(value, 'KSTACK_PRESERVATION_MIGRATION_INVALID'));
  if (requiredTestEvidenceDigests.length === 0) fail('KSTACK_PRESERVATION_MIGRATION_INVALID', 'test evidence');
  const fromBaselineDigest = addressObject(HOST_PACKAGE_DOMAINS.preservationBaseline, baseline);
  const installerCandidateDigest = addressObject(HOST_PACKAGE_DOMAINS.installerCandidate, candidate);
  if (baseline.installedMemberManifestDigest !== addressObject(HOST_PACKAGE_DOMAINS.installedMemberManifest, installedManifest)
      || canonicalJson([baseline.registrySetDigest, baseline.targetId, baseline.platformProfile]) !== canonicalJson([candidate.registrySetDigest, candidate.targetId, candidate.platformProfile])
      || canonicalJson([installedManifest.registrySetDigest, installedManifest.targetId, installedManifest.platformProfile]) !== canonicalJson([candidate.registrySetDigest, candidate.targetId, candidate.platformProfile])
      || installedManifest.scope !== candidate.intendedScope || installedManifest.destinationTemplateId !== candidate.destinationTemplateId
      || candidate.renderBundleDigest !== addressObject(HOST_PACKAGE_DOMAINS.renderBundle, candidateRenderBundle)) fail('KSTACK_PRESERVATION_MIGRATION_INVALID', 'object binding');
  const oldMembers = new Map(installedManifest.members.map((member) => [member.path, member]));
  const newMembers = new Map(candidateRenderBundle.members.map((member) => [member.path, member]));
  const paths = [...new Set([...oldMembers.keys(), ...newMembers.keys()])].sort(compareUtf8);
  const differences = [];
  for (const path of paths) {
    const oldMember = oldMembers.get(path); const newMember = newMembers.get(path);
    if (oldMember?.contentDigest === newMember?.contentDigest) continue;
    const reason = reasons[path]; text(reason, 'KSTACK_PRESERVATION_MIGRATION_INVALID');
    differences.push({ path, change: oldMember && newMember ? 'CHANGE' : oldMember ? 'REMOVE' : 'ADD', oldDigest: oldMember?.contentDigest ?? null, newDigest: newMember?.contentDigest ?? null, reason });
  }
  if (differences.length === 0 || Object.keys(reasons).some((path) => !differences.some((row) => row.path === path))) fail('KSTACK_PRESERVATION_MIGRATION_INVALID', 'differences');
  const proposal = validateMigrationProposal({ schemaId: 'kstack.preservation-migration-proposal.v1', schemaVersion: 1, registrySetDigest: candidate.registrySetDigest, fromBaselineDigest, installerCandidateDigest, differences, requiredTestEvidenceDigests });
  return Object.freeze({ proposal, migrationProposalDigest: addressObject(HOST_PACKAGE_DOMAINS.migrationProposal, proposal) });
}

export function createMigrationAuthorization({ registrySetDigest, migrationProposalDigest, ownerPrincipalDigest, decision, riskAcknowledgementDigest, protectedDecisionReceiptDigest }) {
  const authorization = validateMigrationAuthorization({ schemaId: 'kstack.preservation-migration-authorization.v1', schemaVersion: 1, registrySetDigest, migrationProposalDigest, ownerPrincipalDigest, decision, riskAcknowledgementDigest, protectedDecisionReceiptDigest });
  return Object.freeze({ authorization, migrationAuthorizationDigest: addressObject(HOST_PACKAGE_DOMAINS.migrationAuthorization, authorization) });
}

function context(candidate) {
  return [candidate.registrySetDigest, candidate.targetId, candidate.platformProfile, candidate.intendedScope, candidate.destinationTemplateId];
}

export function createInstallerHandoff({ mode, candidate, preflightRequest = null, initialStateEvidence = null, baseline = null, baselineInstalledManifest = null, baselineHistoricalResolution = null, baselineHistoricalRenderBundle = null, candidateRenderBundle = null, migrationProposal = null, migrationAuthorization = null }) {
  exactCandidate(candidate);
  if (!['INITIAL', 'PRESERVE', 'MIGRATE'].includes(mode)) fail('KSTACK_INSTALLER_HANDOFF_INVALID');
  const candidateDigest = addressObject(HOST_PACKAGE_DOMAINS.installerCandidate, candidate);
  let initialStateEvidenceDigest = null; let fromPreservationBaselineDigest = null; let migrationProposalDigest = null; let migrationAuthorizationDigest = null;
  if (mode === 'INITIAL') {
    if (!preflightRequest || !initialStateEvidence || baseline || migrationProposal || migrationAuthorization || baselineInstalledManifest || baselineHistoricalResolution || baselineHistoricalRenderBundle || candidateRenderBundle) fail('KSTACK_INSTALLER_HANDOFF_INVALID');
    try { initialStateEvidenceDigest = admitInitialStateEvidence({ candidate, preflightRequest, evidence: initialStateEvidence }).initialStateEvidenceDigest; }
    catch { fail('KSTACK_INSTALLER_HANDOFF_INVALID'); }
  } else if (mode === 'PRESERVE') {
    if (!baseline || !baselineInstalledManifest || !baselineHistoricalResolution || !baselineHistoricalRenderBundle || !candidateRenderBundle || preflightRequest || initialStateEvidence || migrationProposal || migrationAuthorization) fail('KSTACK_INSTALLER_HANDOFF_INVALID');
    validatePreservationBaseline(baseline); validateInstalledMemberManifest(baselineInstalledManifest);
    try {
      validateHistoricalResolutionShape(baselineHistoricalResolution);
      validateRenderMemberInventory(baselineHistoricalRenderBundle, 'PRESERVATION_BASELINE_MISMATCH');
      validateRenderMemberInventory(candidateRenderBundle, 'PRESERVATION_BASELINE_MISMATCH');
    } catch { fail('PRESERVATION_BASELINE_MISMATCH'); }
    const baselineContext = [baseline.registrySetDigest, baseline.targetId, baseline.platformProfile, baselineInstalledManifest.scope, baselineInstalledManifest.destinationTemplateId];
    const installedContext = [baselineInstalledManifest.registrySetDigest, baselineInstalledManifest.targetId, baselineInstalledManifest.platformProfile, baselineInstalledManifest.scope, baselineInstalledManifest.destinationTemplateId];
    const comparableRender = (bundle) => bundle.members.map((member) => ({ path: member.path, byteLength: member.byteLength, contentDigest: member.contentDigest }));
    const comparableInstall = baselineInstalledManifest.members.map((member) => ({ path: member.path, byteLength: member.byteLength, contentDigest: member.contentDigest }));
    if (canonicalJson(context(candidate)) !== canonicalJson(baselineContext) || canonicalJson(context(candidate)) !== canonicalJson(installedContext)
        || baselineHistoricalResolution.registrySetDigest !== candidate.registrySetDigest
        || baselineHistoricalRenderBundle.registrySetDigest !== candidate.registrySetDigest
        || candidateRenderBundle.registrySetDigest !== candidate.registrySetDigest
        || baselineHistoricalRenderBundle.targetId !== candidate.targetId || candidateRenderBundle.targetId !== candidate.targetId
        || baselineHistoricalRenderBundle.platformProfile !== candidate.platformProfile || candidateRenderBundle.platformProfile !== candidate.platformProfile
        || baseline.installedMemberManifestDigest !== addressObject(HOST_PACKAGE_DOMAINS.installedMemberManifest, baselineInstalledManifest)
        || baseline.historicalResolutionDigest !== addressObject(HOST_PACKAGE_DOMAINS.historicalResolution, baselineHistoricalResolution)
        || candidate.historicalResolutionDigest !== addressObject(HOST_PACKAGE_DOMAINS.historicalResolution, baselineHistoricalResolution)
        || baselineHistoricalResolution.renderBundleDigest !== addressObject(HOST_PACKAGE_DOMAINS.renderBundle, baselineHistoricalRenderBundle)
        || candidate.renderBundleDigest !== addressObject(HOST_PACKAGE_DOMAINS.renderBundle, candidateRenderBundle)
        || canonicalJson(comparableRender(candidateRenderBundle)) !== canonicalJson(comparableRender(baselineHistoricalRenderBundle))
        || canonicalJson(comparableRender(candidateRenderBundle)) !== canonicalJson(comparableInstall)) fail('PRESERVATION_BASELINE_MISMATCH');
    fromPreservationBaselineDigest = addressObject(HOST_PACKAGE_DOMAINS.preservationBaseline, baseline);
  } else {
    if (!baseline || !baselineInstalledManifest || !candidateRenderBundle || !migrationProposal || !migrationAuthorization
        || preflightRequest || initialStateEvidence || baselineHistoricalResolution || baselineHistoricalRenderBundle) fail('KSTACK_INSTALLER_HANDOFF_INVALID');
    validatePreservationBaseline(baseline, 'KSTACK_INSTALLER_HANDOFF_INVALID');
    try { validateInstalledMemberManifest(baselineInstalledManifest); validateRenderMemberInventory(candidateRenderBundle, 'KSTACK_INSTALLER_HANDOFF_INVALID'); validateMigrationProposal(migrationProposal, 'KSTACK_INSTALLER_HANDOFF_INVALID'); validateMigrationAuthorization(migrationAuthorization, 'KSTACK_INSTALLER_HANDOFF_INVALID'); }
    catch { fail('KSTACK_INSTALLER_HANDOFF_INVALID'); }
    fromPreservationBaselineDigest = addressObject(HOST_PACKAGE_DOMAINS.preservationBaseline, baseline);
    migrationProposalDigest = addressObject(HOST_PACKAGE_DOMAINS.migrationProposal, migrationProposal);
    migrationAuthorizationDigest = addressObject(HOST_PACKAGE_DOMAINS.migrationAuthorization, migrationAuthorization);
    let rebuiltProposal; let rebuiltAuthorization;
    try {
      rebuiltProposal = createMigrationProposal({
        baseline, installedManifest: baselineInstalledManifest, candidate, candidateRenderBundle,
        reasons: Object.fromEntries(migrationProposal.differences.map((row) => [row.path, row.reason])),
        requiredTestEvidenceDigests: migrationProposal.requiredTestEvidenceDigests
      }).proposal;
      rebuiltAuthorization = createMigrationAuthorization({
        registrySetDigest: migrationAuthorization.registrySetDigest, migrationProposalDigest: migrationAuthorization.migrationProposalDigest,
        ownerPrincipalDigest: migrationAuthorization.ownerPrincipalDigest, decision: migrationAuthorization.decision,
        riskAcknowledgementDigest: migrationAuthorization.riskAcknowledgementDigest,
        protectedDecisionReceiptDigest: migrationAuthorization.protectedDecisionReceiptDigest
      }).authorization;
    } catch { fail('KSTACK_INSTALLER_HANDOFF_INVALID'); }
    if (migrationProposal.fromBaselineDigest !== fromPreservationBaselineDigest || migrationProposal.installerCandidateDigest !== candidateDigest
        || migrationAuthorization.migrationProposalDigest !== migrationProposalDigest || migrationAuthorization.decision !== 'APPROVE'
        || migrationProposal.registrySetDigest !== candidate.registrySetDigest || migrationAuthorization.registrySetDigest !== candidate.registrySetDigest
        || baseline.registrySetDigest !== candidate.registrySetDigest || baseline.targetId !== candidate.targetId || baseline.platformProfile !== candidate.platformProfile
        || canonicalJson(rebuiltProposal) !== canonicalJson(migrationProposal) || canonicalJson(rebuiltAuthorization) !== canonicalJson(migrationAuthorization)) fail('KSTACK_INSTALLER_HANDOFF_INVALID', 'migration binding');
  }
  const handoff = { schemaId: 'kstack.installer-handoff.v1', schemaVersion: 1, registrySetDigest: candidate.registrySetDigest, mode, installerCandidateDigest: candidateDigest, fromPreservationBaselineDigest, initialStateEvidenceDigest, migrationProposalDigest, migrationAuthorizationDigest };
  return Object.freeze({ handoff, installerHandoffDigest: addressObject(HOST_PACKAGE_DOMAINS.installerHandoff, handoff) });
}

export function verifyHistoricalResolution({ historicalResolution, registrySetDigest, sourceBundle, clauseInventory, projectionPlan, renderBundle, projectionMap, renderMemberBytes, resolverAllowlist }) {
  validateHistoricalResolutionShape(historicalResolution);
  if (historicalResolution.registrySetDigest !== registrySetDigest) fail('KSTACK_HISTORICAL_RESOLUTION_INVALID');
  sortedUnique(sourceBundle?.reuseAdmissionDigests, 'KSTACK_HISTORICAL_RESOLUTION_INVALID', (value) => digest(value, 'KSTACK_HISTORICAL_RESOLUTION_INVALID'));
  const expected = {
    sourceBundleDigest: addressObject(HOST_PACKAGE_DOMAINS.sourceBundle, sourceBundle), clauseInventoryDigest: addressObject(HOST_PACKAGE_DOMAINS.clauseInventory, clauseInventory),
    projectionPlanDigest: addressObject(HOST_PACKAGE_DOMAINS.projectionPlan, projectionPlan), renderBundleDigest: addressObject(HOST_PACKAGE_DOMAINS.renderBundle, renderBundle), projectionMapDigest: addressObject(HOST_PACKAGE_DOMAINS.projectionMap, projectionMap)
  };
  for (const [key, value] of Object.entries(expected)) if (historicalResolution[key] !== value) fail('HISTORICAL_RESOLVER_UNAVAILABLE', key);
  const registryArtifacts = [sourceBundle, clauseInventory, projectionPlan, renderBundle, projectionMap];
  if (registryArtifacts.some((artifact) => !artifact || artifact.registrySetDigest !== registrySetDigest)) fail('HISTORICAL_RESOLVER_UNAVAILABLE', 'registry context');
  if (sourceBundle.clauseInventoryDigest !== expected.clauseInventoryDigest
      || projectionPlan.sourceBundleDigest !== expected.sourceBundleDigest
      || projectionMap.sourceBundleDigest !== expected.sourceBundleDigest
      || projectionMap.clauseInventoryDigest !== expected.clauseInventoryDigest
      || projectionMap.projectionPlanDigest !== expected.projectionPlanDigest
      || renderBundle.sourceBundleDigest !== expected.sourceBundleDigest
      || renderBundle.clauseInventoryDigest !== expected.clauseInventoryDigest
      || renderBundle.projectionPlanDigest !== expected.projectionPlanDigest
      || renderBundle.projectionMapDigest !== expected.projectionMapDigest
      || renderBundle.resolverSchemaVersion !== historicalResolution.resolverSchemaVersion
      || renderBundle.resolverImplementationDigest !== historicalResolution.resolverImplementationDigest) fail('HISTORICAL_RESOLVER_UNAVAILABLE', 'historical graph binding');
  if (canonicalJson(historicalResolution.reuseAdmissionDigests) !== canonicalJson(sourceBundle.reuseAdmissionDigests)) fail('HISTORICAL_RESOLVER_UNAVAILABLE', 'reuse admission binding');
  plain(renderMemberBytes, 'HISTORICAL_RESOLVER_UNAVAILABLE');
  const expectedPaths = renderBundle.members.map((member) => member.path).sort(compareUtf8);
  if (canonicalJson(Object.keys(renderMemberBytes).sort(compareUtf8)) !== canonicalJson(expectedPaths)) fail('HISTORICAL_RESOLVER_UNAVAILABLE', 'render member inventory');
  for (const member of renderBundle.members) {
    const bytes = Buffer.from(renderMemberBytes[member.path]);
    if (member.byteLength !== String(bytes.length) || member.contentDigest !== rawDigest(bytes)) fail('HISTORICAL_RESOLVER_UNAVAILABLE', member.path);
  }
  if (!Array.isArray(resolverAllowlist) || !resolverAllowlist.some((entry) => entry.schemaVersion === historicalResolution.resolverSchemaVersion && entry.implementationDigest === historicalResolution.resolverImplementationDigest)) fail('HISTORICAL_RESOLVER_UNAVAILABLE', 'resolver allowlist');
  return Object.freeze({ verified: true, historicalResolutionDigest: addressObject(HOST_PACKAGE_DOMAINS.historicalResolution, historicalResolution), opaqueExecutionAllowed: false });
}
