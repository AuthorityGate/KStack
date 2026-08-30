import crypto from 'node:crypto';
import { assertValidatedPackSelectionResult, createPackArtifact } from './kstack-domain-selection.mjs';
import {
  PACK_ARTIFACT_CLASSES,
  assertValidatedPackCatalogGraph,
  packCanonicalBytes,
  parseD5Artifact
} from './kstack-domain-schema.mjs';

const DIGEST = /^[a-f0-9]{64}$/u;
const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const U64_MAX = (1n << 64n) - 1n;
const HARD_PER_PACK_BYTES = 16_384;
const HARD_TOTAL_PACK_BYTES = 32_768;
const MAX_MESSAGES = 1_024;
const PROFILE_DOMAIN = 'KSTACK-PROVIDER-BUDGET-PROFILE-V1\n';
const QUALIFICATION_DOMAIN = 'KSTACK-PROVIDER-BUDGET-QUALIFICATION-V1\n';
const APPLICABILITY_DOMAIN = 'KSTACK-CATALOG-APPLICABILITY-V1\n';
const RECEIPT_DOMAIN = 'KSTACK-PACK-BUDGET-RECEIPT-V1\n';
const DISPATCH_DOMAIN = 'KSTACK-PACK-BUDGET-DISPATCH-V1\n';
const QUALIFIED_PROFILES = new WeakSet();
const VALIDATED_APPLICABILITY = new WeakSet();
const BUDGET_RESULTS = new WeakSet();

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

function checkedText(value, expression, code, maximum = 128) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !value.isWellFormed()
      || value.normalize('NFC') !== value || CONTROL_OR_BIDI.test(value) || !expression.test(value)) fail(code);
  return value;
}

function digest(value, code) {
  return checkedText(value, DIGEST, code, 64);
}

function sameDigest(left, right, code) {
  const a = Buffer.from(digest(left, code), 'hex');
  const b = Buffer.from(digest(right, code), 'hex');
  if (!crypto.timingSafeEqual(a, b)) fail(code);
}

function integer(value, minimum, maximum, code) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) fail(code);
  return value;
}

function rawDigest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function domainDigest(domain, value) {
  return crypto.createHash('sha256').update(Buffer.from(domain)).update(packCanonicalBytes(value)).digest('hex');
}

function immutable(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

function sortedDigests(values, code) {
  if (!Array.isArray(values) || values.length > 256) fail(code);
  const result = values.map((value) => digest(value, code));
  const sorted = [...result].sort(compareUtf8);
  if (new Set(result).size !== result.length || result.some((value, index) => value !== sorted[index])) fail(code);
  return result;
}

function profileRecord(input) {
  const code = 'PACK_BUDGET_PROFILE_UNQUALIFIED';
  exact(input, [
    'artifactType', 'schemaVersion', 'providerId', 'modelId', 'contextWindowTokens',
    'tokenizerMode', 'tokenizerName', 'tokenizerVersion', 'tokenizerCodeDigest',
    'tokenizerAssetDigests', 'requestFramingVersion', 'fixedFramingTokens',
    'perMessageFramingTokens', 'responseReserveTokens', 'safetyReserveTokens',
    'profilePolicyDigest'
  ], code);
  if (input.artifactType !== 'kstack-provider-budget-profile' || input.schemaVersion !== 1
      || !['qualified-exact', 'byte-upper-bound-v1'].includes(input.tokenizerMode)
      || input.requestFramingVersion !== 'kstack-provider-messages-v1') fail(code);
  return {
    artifactType: input.artifactType,
    schemaVersion: 1,
    providerId: checkedText(input.providerId, ID, code),
    modelId: checkedText(input.modelId, ID, code),
    contextWindowTokens: integer(input.contextWindowTokens, 1, Number.MAX_SAFE_INTEGER, code),
    tokenizerMode: input.tokenizerMode,
    tokenizerName: checkedText(input.tokenizerName, ID, code),
    tokenizerVersion: checkedText(input.tokenizerVersion, /^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/u, code),
    tokenizerCodeDigest: digest(input.tokenizerCodeDigest, code),
    tokenizerAssetDigests: sortedDigests(input.tokenizerAssetDigests, code),
    requestFramingVersion: input.requestFramingVersion,
    fixedFramingTokens: integer(input.fixedFramingTokens, 0, Number.MAX_SAFE_INTEGER, code),
    perMessageFramingTokens: integer(input.perMessageFramingTokens, 0, Number.MAX_SAFE_INTEGER, code),
    responseReserveTokens: integer(input.responseReserveTokens, 0, Number.MAX_SAFE_INTEGER, code),
    safetyReserveTokens: integer(input.safetyReserveTokens, 0, Number.MAX_SAFE_INTEGER, code),
    profilePolicyDigest: digest(input.profilePolicyDigest, code)
  };
}

export function createProviderBudgetProfile(input) {
  const record = profileRecord({ artifactType: 'kstack-provider-budget-profile', schemaVersion: 1, ...input });
  const canonicalBytes = packCanonicalBytes(record);
  return immutable({ record, canonicalBytes, profileDigest: domainDigest(PROFILE_DOMAIN, record) });
}

function parseProfile(bytes, expectedDigest) {
  let parsed;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    parsed = JSON.parse(text);
  } catch { fail('PACK_BUDGET_PROFILE_UNQUALIFIED'); }
  const record = profileRecord(parsed);
  const canonicalBytes = packCanonicalBytes(record);
  if (!canonicalBytes.equals(Buffer.from(bytes))) fail('PACK_BUDGET_PROFILE_UNQUALIFIED');
  const profileDigest = domainDigest(PROFILE_DOMAIN, record);
  sameDigest(profileDigest, expectedDigest, 'PACK_BUDGET_PROFILE_UNQUALIFIED');
  return { record, canonicalBytes, profileDigest };
}

function qualificationRecord(input) {
  const code = 'PACK_BUDGET_TOKENIZER_UNQUALIFIED';
  exact(input, [
    'artifactType', 'schemaVersion', 'profileDigest', 'providerModelBindingDigest',
    'contextSourceDigest', 'goldenVectorSetDigest', 'byteUpperBoundProofDigest',
    'specialFramingProofDigest', 'qualified'
  ], code);
  if (input.artifactType !== 'kstack-provider-budget-qualification' || input.schemaVersion !== 1
      || input.qualified !== true) fail(code);
  return {
    artifactType: input.artifactType, schemaVersion: 1,
    profileDigest: digest(input.profileDigest, code),
    providerModelBindingDigest: digest(input.providerModelBindingDigest, code),
    contextSourceDigest: digest(input.contextSourceDigest, code),
    goldenVectorSetDigest: input.goldenVectorSetDigest === null ? null : digest(input.goldenVectorSetDigest, code),
    byteUpperBoundProofDigest: input.byteUpperBoundProofDigest === null ? null : digest(input.byteUpperBoundProofDigest, code),
    specialFramingProofDigest: digest(input.specialFramingProofDigest, code),
    qualified: true
  };
}

function validateExactTokenizer(input, profile, qualification) {
  const code = 'PACK_BUDGET_TOKENIZER_UNQUALIFIED';
  if (!plain(input)) fail(code);
  exact(input, ['tokenizerName', 'tokenizerVersion', 'codeBytes', 'assets', 'goldenVectors', 'count'], code);
  if (input.tokenizerName !== profile.tokenizerName || input.tokenizerVersion !== profile.tokenizerVersion
      || typeof input.count !== 'function' || (!Buffer.isBuffer(input.codeBytes) && !(input.codeBytes instanceof Uint8Array))
      || !Array.isArray(input.assets) || !Array.isArray(input.goldenVectors) || input.goldenVectors.length < 1) fail(code);
  sameDigest(rawDigest(input.codeBytes), profile.tokenizerCodeDigest, code);
  const assetDigests = input.assets.map((asset) => {
    exact(asset, ['name', 'bytes'], code);
    checkedText(asset.name, /^[a-z0-9][a-z0-9._/-]{0,239}$/u, code, 240);
    if (!Buffer.isBuffer(asset.bytes) && !(asset.bytes instanceof Uint8Array)) fail(code);
    return rawDigest(asset.bytes);
  }).sort(compareUtf8);
  if (assetDigests.length !== profile.tokenizerAssetDigests.length
      || assetDigests.some((value, index) => value !== profile.tokenizerAssetDigests[index])) fail(code);
  const vectors = input.goldenVectors.map((vector) => {
    exact(vector, ['requestBytes', 'expectedTokens'], code);
    if (!Buffer.isBuffer(vector.requestBytes) && !(vector.requestBytes instanceof Uint8Array)) fail(code);
    const expectedTokens = integer(vector.expectedTokens, 0, Number.MAX_SAFE_INTEGER, code);
    let actual;
    try { actual = input.count(Buffer.from(vector.requestBytes)); } catch { fail(code); }
    if (actual !== expectedTokens) fail(code);
    return { requestBase64: Buffer.from(vector.requestBytes).toString('base64'), expectedTokens };
  });
  sameDigest(domainDigest('KSTACK-TOKENIZER-GOLDEN-VECTORS-V1\n', vectors), qualification.goldenVectorSetDigest, code);
  if (qualification.byteUpperBoundProofDigest !== null) fail(code);
  return immutable({ count: input.count });
}

export function qualifyProviderBudgetProfile(input) {
  const code = 'PACK_BUDGET_TOKENIZER_UNQUALIFIED';
  exact(input, [
    'profileBytes', 'expectedProfileDigest', 'qualificationBytes',
    'expectedQualificationDigest', 'exactTokenizer'
  ], code);
  const profile = parseProfile(input.profileBytes, input.expectedProfileDigest);
  let parsed;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(input.qualificationBytes);
    parsed = JSON.parse(text);
  } catch { fail(code); }
  const qualification = qualificationRecord(parsed);
  const qualificationBytes = packCanonicalBytes(qualification);
  if (!qualificationBytes.equals(Buffer.from(input.qualificationBytes))) fail(code);
  const qualificationDigest = domainDigest(QUALIFICATION_DOMAIN, qualification);
  sameDigest(qualificationDigest, input.expectedQualificationDigest, code);
  sameDigest(qualification.profileDigest, profile.profileDigest, code);
  let tokenizer = null;
  if (profile.record.tokenizerMode === 'qualified-exact') {
    if (qualification.goldenVectorSetDigest === null) fail(code);
    tokenizer = validateExactTokenizer(input.exactTokenizer, profile.record, qualification);
  } else {
    if (input.exactTokenizer !== null || qualification.goldenVectorSetDigest !== null
        || qualification.byteUpperBoundProofDigest === null) fail(code);
  }
  const result = immutable({ ...profile, qualification, qualificationBytes, qualificationDigest, tokenizer });
  QUALIFIED_PROFILES.add(result);
  return result;
}

export function createProviderBudgetQualification(input) {
  const record = qualificationRecord({ artifactType: 'kstack-provider-budget-qualification', schemaVersion: 1, ...input });
  const canonicalBytes = packCanonicalBytes(record);
  return immutable({ record, canonicalBytes, qualificationDigest: domainDigest(QUALIFICATION_DOMAIN, record) });
}

function availableMaterial(graph, proof) {
  const catalog = graph.snapshot.catalogEntries.find((entry) => entry.packId === proof.packId);
  if (!catalog || catalog.state !== 'available' || proof.state !== 'available') return null;
  const material = createPackArtifact({
    artifactType: 'kstack-pack-material', schemaVersion: 1,
    packId: proof.packId, version: proof.version, bundleDigest: proof.bundleDigest
  });
  const retained = graph.retentionSet.bundles.find((entry) => entry.packId === proof.packId);
  if (!retained || retained.bundleDigest !== proof.bundleDigest) fail('PACK_SELECTION_INVALID');
  const contentFile = retained.files.find((entry) => entry.relativePath === 'content.json');
  const manifestFile = retained.files.find((entry) => entry.relativePath === 'manifest.json');
  if (!contentFile || !manifestFile) fail('PACK_SELECTION_INVALID');
  const content = parseD5Artifact(contentFile.bytes, 'kstack-pack-content', catalog.contentDigest);
  const manifest = parseD5Artifact(manifestFile.bytes, 'kstack-pack-manifest', catalog.manifestDigest);
  return { proof, catalog, material, content, manifest };
}

export function validateCatalogApplicability(input) {
  exact(input, ['validatedCatalogGraph'], 'PACK_SELECTION_INVALID');
  let graph;
  try { graph = assertValidatedPackCatalogGraph(input.validatedCatalogGraph); } catch { fail('PACK_SELECTION_INVALID'); }
  const materials = graph.materialProofs.map((proof) => availableMaterial(graph, proof)).filter(Boolean);
  const expected = [];
  for (const material of materials) for (const section of material.content.record.sections) {
    expected.push(`${material.material.artifactDigest}\u0000${section.id}`);
  }
  expected.sort(compareUtf8);
  const entries = graph.snapshot.applicabilityEntries;
  const actual = entries.map((entry) => `${entry.packMaterialDigest}\u0000${entry.sectionId}`);
  if (actual.length !== expected.length || actual.some((entry, index) => entry !== expected[index])) fail('PACK_SELECTION_INVALID');
  const record = {
    artifactType: 'kstack-catalog-applicability', schemaVersion: 1,
    catalogSnapshotDigest: graph.snapshotDigest, entries
  };
  const result = immutable({
    graph, materials, record, applicabilityTableDigest: domainDigest(APPLICABILITY_DOMAIN, record)
  });
  VALIDATED_APPLICABILITY.add(result);
  return result;
}

function checkedAdd(values) {
  let total = 0n;
  for (const value of values) {
    total += BigInt(value);
    if (total > U64_MAX || total > BigInt(Number.MAX_SAFE_INTEGER)) fail('PACK_BUDGET_EXCEEDED');
  }
  return Number(total);
}

function checkedMultiply(left, right) {
  const product = BigInt(left) * BigInt(right);
  if (product > U64_MAX || product > BigInt(Number.MAX_SAFE_INTEGER)) fail('PACK_BUDGET_EXCEEDED');
  return Number(product);
}

function messages(input) {
  const code = 'PACK_BUDGET_RENDER_INVALID';
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_MESSAGES) fail(code);
  return input.map((message) => {
    exact(message, ['role', 'content'], code);
    if (!['assistant', 'system', 'tool', 'user'].includes(message.role)
        || typeof message.content !== 'string' || !message.content.isWellFormed()
        || message.content.normalize('NFC') !== message.content) fail(code);
    return { role: message.role, content: message.content };
  });
}

function caps(input, profile) {
  const code = 'PACK_BUDGET_PROFILE_UNQUALIFIED';
  exact(input, [
    'repositoryContextCapTokens', 'operationContextCapTokens', 'repositoryPerPackCapBytes',
    'operationPerPackCapBytes', 'repositoryTotalPackCapBytes', 'operationTotalPackCapBytes'
  ], code);
  const output = {};
  for (const [key, value] of Object.entries(input)) output[key] = integer(value, 1, Number.MAX_SAFE_INTEGER, code);
  if (output.repositoryContextCapTokens > profile.contextWindowTokens
      || output.operationContextCapTokens > profile.contextWindowTokens
      || output.repositoryPerPackCapBytes > HARD_PER_PACK_BYTES
      || output.operationPerPackCapBytes > HARD_PER_PACK_BYTES
      || output.repositoryTotalPackCapBytes > HARD_TOTAL_PACK_BYTES
      || output.operationTotalPackCapBytes > HARD_TOTAL_PACK_BYTES) fail(code);
  return output;
}

function renderRequest(requestFramingVersion, requestMessages) {
  return packCanonicalBytes({ requestFramingVersion, messages: requestMessages });
}

function exactCount(qualifiedProfile, bytes) {
  let result;
  try { result = qualifiedProfile.tokenizer.count(Buffer.from(bytes)); } catch { fail('PACK_BUDGET_TOKENIZER_UNQUALIFIED'); }
  return integer(result, 0, Number.MAX_SAFE_INTEGER, 'PACK_BUDGET_TOKENIZER_UNQUALIFIED');
}

function compose(input, dispatchRecheck = false) {
  const code = 'PACK_BUDGET_RENDER_INVALID';
  exact(input, [
    'validatedSelection', 'validatedCatalogGraph', 'qualifiedProfile', 'artifactClass',
    'baseMessages', 'caps'
  ], code);
  let selection;
  try { selection = assertValidatedPackSelectionResult(input.validatedSelection); } catch { fail('PACK_SELECTION_INVALID'); }
  if (!input.qualifiedProfile || !QUALIFIED_PROFILES.has(input.qualifiedProfile)) fail('PACK_BUDGET_PROFILE_UNQUALIFIED');
  if (!PACK_ARTIFACT_CLASSES.includes(input.artifactClass)) fail('PACK_SELECTION_INVALID');
  const applicability = validateCatalogApplicability({ validatedCatalogGraph: input.validatedCatalogGraph });
  const profile = input.qualifiedProfile.record;
  const budgetCaps = caps(input.caps, profile);
  const baseMessages = messages(input.baseMessages);
  const selected = selection.projection.orderedEntries;
  const materialByDigest = new Map(applicability.materials.map((entry) => [entry.material.artifactDigest, entry]));
  const table = new Map(applicability.record.entries.map((entry) => [`${entry.packMaterialDigest}\u0000${entry.sectionId}`, entry]));
  const packMessages = [];
  const matches = [];
  const perPack = [];
  let cumulativePackBytes = 0;
  for (const selectedEntry of selected) {
    const material = materialByDigest.get(selectedEntry.materialDigest);
    if (!material || material.proof.packId !== selectedEntry.packId || material.proof.version !== selectedEntry.version) fail('PACK_SELECTION_INVALID');
    const renderedSections = [];
    for (const section of material.content.record.sections) {
      const row = table.get(`${selectedEntry.materialDigest}\u0000${section.id}`);
      if (!row) fail('PACK_SELECTION_INVALID');
      if (!row.artifactClasses.includes(input.artifactClass)) continue;
      const bytes = packCanonicalBytes({ id: section.id, questions: section.questions });
      renderedSections.push({ sectionId: section.id, bytes });
    }
    if (renderedSections.length === 0) fail('PACK_SELECTION_INVALID');
    const prefix = Buffer.from(`[KSTACK-PACK:${selectedEntry.packId}:${selectedEntry.materialDigest}]\n`, 'utf8');
    const suffix = Buffer.from(`\n[/KSTACK-PACK:${selectedEntry.packId}]`, 'utf8');
    const body = Buffer.concat([prefix, ...renderedSections.flatMap((entry, index) => index === 0 ? [entry.bytes] : [Buffer.from('\n'), entry.bytes]), suffix]);
    const actualBytes = body.length;
    const allowance = Math.min(material.manifest.record.maxUtf8Bytes, budgetCaps.repositoryPerPackCapBytes,
      budgetCaps.operationPerPackCapBytes, HARD_PER_PACK_BYTES);
    if (actualBytes > allowance) fail('PACK_BUDGET_EXCEEDED');
    cumulativePackBytes = checkedAdd([cumulativePackBytes, actualBytes]);
    perPack.push({ packId: selectedEntry.packId, actualUtf8Bytes: actualBytes, allowanceUtf8Bytes: allowance, cumulativeUtf8Bytes: cumulativePackBytes });
    for (const section of renderedSections) matches.push({
      packId: selectedEntry.packId, sectionId: section.sectionId, actualRenderedUtf8Bytes: section.bytes.length
    });
    packMessages.push({ role: 'system', content: body.toString('utf8') });
  }
  const totalAllowance = Math.min(budgetCaps.repositoryTotalPackCapBytes, budgetCaps.operationTotalPackCapBytes, HARD_TOTAL_PACK_BYTES);
  if (cumulativePackBytes > totalAllowance) fail('PACK_BUDGET_EXCEEDED');
  const requestMessages = [...baseMessages, ...packMessages];
  if (requestMessages.length > MAX_MESSAGES) fail(code);
  const finalRequestBytes = renderRequest(profile.requestFramingVersion, requestMessages);
  const measuredRequestUtf8Bytes = requestMessages.reduce((sum, message) => checkedAdd([sum, Buffer.byteLength(message.content, 'utf8')]), 0);
  let requestTokens;
  let cumulativeExactTokenCounts = null;
  if (profile.tokenizerMode === 'qualified-exact') {
    requestTokens = exactCount(input.qualifiedProfile, finalRequestBytes);
    cumulativeExactTokenCounts = packMessages.map((_, index) => exactCount(
      input.qualifiedProfile,
      renderRequest(profile.requestFramingVersion, [...baseMessages, ...packMessages.slice(0, index + 1)])
    ));
  } else {
    const framingTokens = checkedAdd([profile.fixedFramingTokens, checkedMultiply(profile.perMessageFramingTokens, requestMessages.length)]);
    requestTokens = checkedAdd([measuredRequestUtf8Bytes, framingTokens]);
  }
  const effectiveContextTokens = Math.min(profile.contextWindowTokens, budgetCaps.repositoryContextCapTokens, budgetCaps.operationContextCapTokens);
  const requiredTokens = checkedAdd([requestTokens, profile.responseReserveTokens, profile.safetyReserveTokens]);
  if (requiredTokens > effectiveContextTokens) fail('PACK_BUDGET_EXCEEDED');
  const receipt = immutable({
    artifactType: 'kstack-pack-budget-receipt', schemaVersion: 1,
    selectionDigest: selection.projection.selectionDigest,
    catalogSnapshotDigest: applicability.graph.snapshotDigest,
    applicabilityTableDigest: applicability.applicabilityTableDigest,
    artifactClass: input.artifactClass,
    profileDigest: input.qualifiedProfile.profileDigest,
    qualificationDigest: input.qualifiedProfile.qualificationDigest,
    tokenizerMode: profile.tokenizerMode,
    tokenizerCodeDigest: profile.tokenizerCodeDigest,
    tokenizerAssetDigests: profile.tokenizerAssetDigests,
    requestFramingVersion: profile.requestFramingVersion,
    finalRequestBase64: finalRequestBytes.toString('base64'),
    finalRequestDigest: rawDigest(finalRequestBytes),
    measuredRequestUtf8Bytes,
    messageCount: requestMessages.length,
    requestTokens,
    responseReserveTokens: profile.responseReserveTokens,
    safetyReserveTokens: profile.safetyReserveTokens,
    requiredTokens,
    profileContextTokens: profile.contextWindowTokens,
    repositoryContextCapTokens: budgetCaps.repositoryContextCapTokens,
    operationContextCapTokens: budgetCaps.operationContextCapTokens,
    effectiveContextTokens,
    remainingTokens: effectiveContextTokens - requiredTokens,
    repositoryPerPackCapBytes: budgetCaps.repositoryPerPackCapBytes,
    operationPerPackCapBytes: budgetCaps.operationPerPackCapBytes,
    repositoryTotalPackCapBytes: budgetCaps.repositoryTotalPackCapBytes,
    operationTotalPackCapBytes: budgetCaps.operationTotalPackCapBytes,
    hardPerPackCapBytes: HARD_PER_PACK_BYTES,
    hardTotalPackCapBytes: HARD_TOTAL_PACK_BYTES,
    totalPackUtf8Bytes: cumulativePackBytes,
    totalPackAllowanceUtf8Bytes: totalAllowance,
    matchedSections: matches,
    perPack,
    cumulativeExactTokenCounts
  });
  const result = immutable({
    receipt, receiptBytes: packCanonicalBytes(receipt), receiptDigest: domainDigest(RECEIPT_DOMAIN, receipt),
    finalRequestBytes, revalidationInput: { ...input, baseMessages, caps: budgetCaps }, dispatchRecheck
  });
  BUDGET_RESULTS.add(result);
  return result;
}

export function composePackBudget(input) {
  return compose(input, false);
}

export function admitPackBudgetDispatch(input) {
  exact(input, ['budgetResult', 'validatedSelection', 'validatedCatalogGraph'], 'PACK_BUDGET_RECEIPT_MISMATCH');
  if (!input.budgetResult || !BUDGET_RESULTS.has(input.budgetResult)) fail('PACK_BUDGET_RECEIPT_MISMATCH');
  const original = input.budgetResult;
  const refreshed = compose({
    ...original.revalidationInput,
    validatedSelection: input.validatedSelection,
    validatedCatalogGraph: input.validatedCatalogGraph
  }, true);
  if (refreshed.receiptDigest !== original.receiptDigest
      || !refreshed.finalRequestBytes.equals(original.finalRequestBytes)) fail('PACK_BUDGET_RECEIPT_MISMATCH');
  const record = {
    artifactType: 'kstack-pack-budget-dispatch', schemaVersion: 1,
    budgetReceiptDigest: original.receiptDigest,
    selectionDigest: original.receipt.selectionDigest,
    catalogSnapshotDigest: original.receipt.catalogSnapshotDigest,
    finalRequestDigest: original.receipt.finalRequestDigest,
    admitted: true
  };
  return immutable({
    record, canonicalBytes: packCanonicalBytes(record),
    dispatchReceiptDigest: domainDigest(DISPATCH_DOMAIN, record),
    finalRequestBytes: Buffer.from(original.finalRequestBytes)
  });
}
