import crypto from 'node:crypto';
import { renderHostSkill, validateHostProfile } from './kstack-host-profile.mjs';

const PACK_KEYS = Object.freeze(['packId', 'version', 'title', 'domains', 'methods', 'contentDigest', 'provenanceDigest']);
const METHOD_KEYS = Object.freeze(['methodId', 'title', 'applicability', 'instructions', 'evidenceRequirements']);
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const HEX64 = /^[a-f0-9]{64}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const VALIDATED_DOMAIN_SELECTIONS = new WeakSet();
export const DOMAIN_RENDERING_SCOPE = 'D0_ANALYSIS_METHOD_RENDERING_ONLY_NOT_D2_PACK_ADMISSION_OR_ACTIVATION';

function immutable(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) immutable(child); Object.freeze(value); }
  return value;
}

function fail(code, detail = '') {
  const error = new Error(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code;
  throw error;
}

function exactKeys(value, keys, code) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}

function string(value, expression, code, maximum = 200) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum || value.trim() !== value
      || !value.isWellFormed() || value.normalize('NFC') !== value || CONTROL_OR_BIDI.test(value)
      || !expression.test(value)) fail(code);
  return value;
}

function strings(value, expression, code, maximumItems, maximumLength = 200) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumItems) fail(code);
  const admitted = value.map((item) => string(item, expression, code, maximumLength));
  if (new Set(admitted).size !== admitted.length) fail(code);
  return [...admitted].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function digest(domain, value) {
  return crypto.createHash('sha256').update(Buffer.from(domain, 'utf8')).update(Buffer.from([0]))
    .update(JSON.stringify(canonical(value))).digest('hex');
}

function validateMethod(input) {
  exactKeys(input, METHOD_KEYS, 'KSTACK_DOMAIN_METHOD_INVALID');
  const methodId = string(input.methodId, IDENTIFIER, 'KSTACK_DOMAIN_METHOD_INVALID');
  const title = string(input.title, /^.{1,120}$/u, 'KSTACK_DOMAIN_METHOD_INVALID', 120);
  const applicability = strings(input.applicability, IDENTIFIER, 'KSTACK_DOMAIN_METHOD_INVALID', 32, 64);
  const instructions = strings(input.instructions, /^[^\u0000-\u001f\u007f-\u009f]+$/u, 'KSTACK_DOMAIN_METHOD_INVALID', 32, 1000);
  const evidenceRequirements = strings(input.evidenceRequirements, /^[^\u0000-\u001f\u007f-\u009f]+$/u, 'KSTACK_DOMAIN_METHOD_INVALID', 16, 500);
  return { methodId, title, applicability, instructions, evidenceRequirements };
}

function validatePack(input) {
  exactKeys(input, PACK_KEYS, 'KSTACK_DOMAIN_PACK_INVALID');
  const packId = string(input.packId, IDENTIFIER, 'KSTACK_DOMAIN_PACK_INVALID');
  const version = string(input.version, VERSION, 'KSTACK_DOMAIN_PACK_INVALID');
  const title = string(input.title, /^.{1,120}$/u, 'KSTACK_DOMAIN_PACK_INVALID', 120);
  const domains = strings(input.domains, IDENTIFIER, 'KSTACK_DOMAIN_PACK_INVALID', 16, 64);
  if (!Array.isArray(input.methods) || input.methods.length === 0 || input.methods.length > 128) fail('KSTACK_DOMAIN_PACK_INVALID');
  const methods = input.methods.map(validateMethod).sort((left, right) => Buffer.compare(Buffer.from(left.methodId), Buffer.from(right.methodId)));
  if (new Set(methods.map((method) => method.methodId)).size !== methods.length) fail('KSTACK_DOMAIN_PACK_INVALID');
  const contentDigest = string(input.contentDigest, HEX64, 'KSTACK_DOMAIN_PACK_INVALID', 64);
  const provenanceDigest = string(input.provenanceDigest, HEX64, 'KSTACK_DOMAIN_PACK_INVALID', 64);
  const content = { packId, version, title, domains, methods };
  if (digest('KSTACK-DOMAIN-PACK-CONTENT-V1', content) !== contentDigest) fail('KSTACK_DOMAIN_PACK_CONTENT_MISMATCH');
  return { ...content, contentDigest, provenanceDigest };
}

export function buildDomainPack(input) {
  exactKeys(input, ['packId', 'version', 'title', 'domains', 'methods', 'provenanceDigest'], 'KSTACK_DOMAIN_PACK_INVALID');
  const provisional = { ...input, contentDigest: '0'.repeat(64) };
  const packId = string(provisional.packId, IDENTIFIER, 'KSTACK_DOMAIN_PACK_INVALID');
  const version = string(provisional.version, VERSION, 'KSTACK_DOMAIN_PACK_INVALID');
  const title = string(provisional.title, /^.{1,120}$/u, 'KSTACK_DOMAIN_PACK_INVALID', 120);
  const domains = strings(provisional.domains, IDENTIFIER, 'KSTACK_DOMAIN_PACK_INVALID', 16, 64);
  if (!Array.isArray(provisional.methods) || provisional.methods.length === 0 || provisional.methods.length > 128) fail('KSTACK_DOMAIN_PACK_INVALID');
  const methods = provisional.methods.map(validateMethod).sort((left, right) => Buffer.compare(Buffer.from(left.methodId), Buffer.from(right.methodId)));
  const content = { packId, version, title, domains, methods };
  return Object.freeze(validatePack({ ...content, contentDigest: digest('KSTACK-DOMAIN-PACK-CONTENT-V1', content), provenanceDigest: provisional.provenanceDigest }));
}

export function validateDomainCatalog(input) {
  exactKeys(input, ['schemaVersion', 'catalogId', 'packs'], 'KSTACK_DOMAIN_CATALOG_INVALID');
  if (input.schemaVersion !== 1) fail('KSTACK_DOMAIN_CATALOG_INVALID');
  const catalogId = string(input.catalogId, IDENTIFIER, 'KSTACK_DOMAIN_CATALOG_INVALID');
  if (!Array.isArray(input.packs) || input.packs.length === 0 || input.packs.length > 256) fail('KSTACK_DOMAIN_CATALOG_INVALID');
  const packs = input.packs.map(validatePack).sort((left, right) => Buffer.compare(Buffer.from(left.packId), Buffer.from(right.packId)));
  if (new Set(packs.map((pack) => pack.packId)).size !== packs.length) fail('KSTACK_DOMAIN_CATALOG_INVALID');
  const catalog = { schemaVersion: 1, catalogId, packs };
  return Object.freeze({ ...catalog, catalogDigest: digest('KSTACK-DOMAIN-CATALOG-V1', catalog) });
}

export function selectDomainMethods(catalogInput, selectionInput) {
  const catalog = validateDomainCatalog(catalogInput);
  exactKeys(selectionInput, ['packIds', 'applicability'], 'KSTACK_DOMAIN_SELECTION_INVALID');
  const packIds = strings(selectionInput.packIds, IDENTIFIER, 'KSTACK_DOMAIN_SELECTION_INVALID', 256);
  const applicability = strings(selectionInput.applicability, IDENTIFIER, 'KSTACK_DOMAIN_SELECTION_INVALID', 32, 64);
  const known = new Set(catalog.packs.map((pack) => pack.packId));
  if (packIds.some((packId) => !known.has(packId))) fail('KSTACK_DOMAIN_SELECTION_UNKNOWN_PACK');
  const methods = [];
  for (const pack of catalog.packs.filter((candidate) => packIds.includes(candidate.packId))) {
    for (const method of pack.methods) {
      if (method.applicability.some((tag) => applicability.includes(tag))) {
        methods.push({ packId: pack.packId, packVersion: pack.version, contentDigest: pack.contentDigest, method });
      }
    }
  }
  methods.sort((left, right) => Buffer.compare(Buffer.from(`${left.packId}/${left.method.methodId}`), Buffer.from(`${right.packId}/${right.method.methodId}`)));
  const selection = { catalogDigest: catalog.catalogDigest, packIds, applicability, methods };
  const result = { ...selection, selectionDigest: digest('KSTACK-DOMAIN-SELECTION-V1', selection) };
  VALIDATED_DOMAIN_SELECTIONS.add(result);
  return immutable(result);
}

export function renderDomainSelection(selectionInput, profileInput) {
  exactKeys(selectionInput, ['catalogDigest', 'packIds', 'applicability', 'methods', 'selectionDigest'], 'KSTACK_DOMAIN_SELECTION_INVALID');
  if (!VALIDATED_DOMAIN_SELECTIONS.has(selectionInput)) fail('KSTACK_DOMAIN_SELECTION_PROVENANCE_INVALID');
  const profile = validateHostProfile(profileInput);
  if (!HEX64.test(selectionInput.catalogDigest) || !HEX64.test(selectionInput.selectionDigest)) fail('KSTACK_DOMAIN_SELECTION_INVALID');
  const unsigned = {
    catalogDigest: selectionInput.catalogDigest,
    packIds: selectionInput.packIds,
    applicability: selectionInput.applicability,
    methods: selectionInput.methods
  };
  if (digest('KSTACK-DOMAIN-SELECTION-V1', unsigned) !== selectionInput.selectionDigest) fail('KSTACK_DOMAIN_SELECTION_DIGEST_MISMATCH');
  const artifacts = selectionInput.methods.map((entry) => {
    exactKeys(entry, ['packId', 'packVersion', 'contentDigest', 'method'], 'KSTACK_DOMAIN_SELECTION_INVALID');
    const method = validateMethod(entry.method);
    const steps = [
      ...method.instructions.map((instruction) => ({ kind: 'prose', text: instruction })),
      { kind: 'boundary', text: 'Analysis only. Do not mutate workspace or external state and do not access protected values.' },
      ...method.evidenceRequirements.map((requirement) => ({ kind: 'evidence', text: requirement }))
    ];
    const rendered = renderHostSkill({
      schemaVersion: 1,
      skillId: `${entry.packId}-${method.methodId}`,
      title: method.title,
      executionMode: 'native-analysis',
      authorityClass: 'read-only',
      requiredCapabilities: ['file-read', 'text-search'],
      forbiddenCapabilities: ['protected-value-read'],
      riskSignals: [],
      steps
    }, profile);
    return Object.freeze({
      packId: entry.packId,
      packVersion: entry.packVersion,
      methodId: method.methodId,
      contentDigest: entry.contentDigest,
      hostId: profile.hostId,
      instructionFile: rendered.instructionFile,
      content: rendered.content,
      artifactDigest: digest('KSTACK-DOMAIN-RENDERED-ARTIFACT-V1', { selectionDigest: selectionInput.selectionDigest, rendered })
    });
  });
  return Object.freeze({
    hostId: profile.hostId,
    selectionDigest: selectionInput.selectionDigest,
    authorityScope: DOMAIN_RENDERING_SCOPE,
    artifacts,
    renderingDigest: digest('KSTACK-DOMAIN-RENDERING-V1', {
      hostId: profile.hostId, selectionDigest: selectionInput.selectionDigest,
      authorityScope: DOMAIN_RENDERING_SCOPE, artifacts
    })
  });
}
