import crypto from 'node:crypto';

export const PACKET_CANONICALIZATION_VERSION = 'kstack-packet-utf8-lf-v1';
export const PACKET_SERIALIZATION_VERSION = 'kstack-source-record-v1';
export const PACKET_FRAMING_VERSION = 'kstack-frame-token-v1';
export const PACKET_MAX_BYTES = 1_048_576;
export const CITATION_LIMIT = 20;

const SOURCE_ID = /^[A-Z][A-Z0-9_-]{0,63}$/;
const CITATION_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const ROLES = new Set(['design-under-review', 'checks-artifact', 'counter-evidence', 'context']);
const INCLUSIONS = new Set(['full', 'excerpt', 'summary']);
const GROUND_KINDS = new Set(['assertion', 'absence', 'normative']);
const ARRAY_FIELDS = new Set(['failedChecks', 'materialDissent', 'unresolvedQuestions']);
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function groundingError(code, message = code) {
  return Object.assign(new Error(message), { code });
}

function scalarLength(value) {
  return [...value].length;
}

function isUnicodeScalarSequence(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function decodeUtf8(value, code = 'PACKET_UTF8_INVALID') {
  try {
    return utf8Decoder.decode(Buffer.isBuffer(value) ? value : Buffer.from(value));
  } catch {
    throw groundingError(code);
  }
}

export function canonicalizePacketSource(value) {
  if (typeof value === 'string' && !isUnicodeScalarSequence(value)) throw groundingError('PACKET_UTF8_INVALID');
  let text = decodeUtf8(value);
  if (text.startsWith('\uFEFF')) text = text.slice(1);
  return Buffer.from(text.replaceAll('\r\n', '\n').replaceAll('\r', '\n'), 'utf8');
}

function validateSourceMetadata(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw groundingError('PACKET_SOURCE_INVALID');
  if (!SOURCE_ID.test(source.sourceId)) throw groundingError('PACKET_SOURCE_ID_INVALID');
  if (typeof source.label !== 'string' || !isUnicodeScalarSequence(source.label) || scalarLength(source.label) < 1 || scalarLength(source.label) > 200 || /[\u0000-\u001f\uFEFF]/u.test(source.label)) {
    throw groundingError('PACKET_SOURCE_LABEL_INVALID');
  }
  if (!ROLES.has(source.role)) throw groundingError('PACKET_SOURCE_ROLE_INVALID');
  if (!INCLUSIONS.has(source.inclusion)) throw groundingError('PACKET_SOURCE_INCLUSION_INVALID');
}

function header(name, value) {
  return Buffer.from(`${name} ${value}\n`, 'ascii');
}

function recordForSource(source) {
  validateSourceMetadata(source);
  const id = Buffer.from(source.sourceId, 'utf8');
  const label = Buffer.from(source.label, 'utf8');
  const content = canonicalizePacketSource(source.content);
  if (content.length === 0) throw groundingError('PACKET_SOURCE_EMPTY');
  const prefix = Buffer.concat([
    Buffer.from('KSTACK-SOURCE-RECORD-V1\n', 'ascii'),
    header('ID', id.length), id, Buffer.from('\n', 'ascii'),
    header('LABEL', label.length), label, Buffer.from('\n', 'ascii'),
    header('ROLE', source.role),
    header('INCLUSION', source.inclusion),
    header('CONTENT', content.length)
  ]);
  const suffix = Buffer.from('\nEND KSTACK-SOURCE-RECORD-V1\n', 'ascii');
  return { bytes: Buffer.concat([prefix, content, suffix]), content, contentOffset: prefix.length };
}

export function buildDecisionPacket(sources) {
  if (!Array.isArray(sources) || sources.length === 0) throw groundingError('PACKET_SOURCE_COUNT_INVALID');
  const seen = new Set();
  const records = [];
  const metadata = [];
  let packetOffset = 0;
  for (const source of sources) {
    if (seen.has(source?.sourceId)) throw groundingError('PACKET_SOURCE_DUPLICATE');
    seen.add(source?.sourceId);
    const record = recordForSource(source);
    records.push(record.bytes);
    metadata.push({
      sourceId: source.sourceId,
      label: source.label,
      role: source.role,
      inclusion: source.inclusion,
      recordByteStart: packetOffset,
      recordByteLength: record.bytes.length,
      contentByteStart: packetOffset + record.contentOffset,
      contentByteLength: record.content.length,
      sourceSha256: sha256(record.content),
      recordSha256: sha256(record.bytes)
    });
    packetOffset += record.bytes.length;
    if (packetOffset > PACKET_MAX_BYTES) throw groundingError('PACKET_TOO_LARGE');
  }
  const packetBytes = Buffer.concat(records);
  return {
    packetBytes,
    binding: {
      packetCanonicalizationVersion: PACKET_CANONICALIZATION_VERSION,
      packetSerializationVersion: PACKET_SERIALIZATION_VERSION,
      packetFramingVersion: PACKET_FRAMING_VERSION,
      packetByteLength: packetBytes.length,
      packetSha256: sha256(packetBytes),
      sources: metadata
    }
  };
}

function readLine(bytes, cursor) {
  const end = bytes.indexOf(0x0a, cursor);
  if (end < 0) throw groundingError('PACKET_SERIALIZATION_INVALID');
  return { text: bytes.subarray(cursor, end).toString('ascii'), next: end + 1 };
}

function parseLengthLine(bytes, cursor, name) {
  const line = readLine(bytes, cursor);
  const match = line.text.match(new RegExp(`^${name} (0|[1-9][0-9]*)$`));
  if (!match) throw groundingError('PACKET_SERIALIZATION_INVALID');
  const value = Number(match[1]);
  if (!Number.isSafeInteger(value)) throw groundingError('PACKET_SERIALIZATION_INVALID');
  return { value, next: line.next };
}

function parseBytesField(bytes, cursor, name, allowEmpty = false) {
  const length = parseLengthLine(bytes, cursor, name);
  const end = length.next + length.value;
  if ((!allowEmpty && length.value === 0) || end >= bytes.length || bytes[end] !== 0x0a) throw groundingError('PACKET_SERIALIZATION_INVALID');
  return { value: bytes.subarray(length.next, end), next: end + 1 };
}

export function parseDecisionPacket(packetValue) {
  const bytes = Buffer.isBuffer(packetValue) ? packetValue : Buffer.from(packetValue);
  if (bytes.length === 0 || bytes.length > PACKET_MAX_BYTES) throw groundingError(bytes.length ? 'PACKET_TOO_LARGE' : 'PACKET_SOURCE_COUNT_INVALID');
  const sources = [];
  const ids = new Set();
  let cursor = 0;
  while (cursor < bytes.length) {
    const recordStart = cursor;
    const start = readLine(bytes, cursor);
    if (start.text !== 'KSTACK-SOURCE-RECORD-V1') throw groundingError('PACKET_SERIALIZATION_INVALID');
    cursor = start.next;
    const idField = parseBytesField(bytes, cursor, 'ID'); cursor = idField.next;
    const labelField = parseBytesField(bytes, cursor, 'LABEL'); cursor = labelField.next;
    const roleLine = readLine(bytes, cursor); cursor = roleLine.next;
    const inclusionLine = readLine(bytes, cursor); cursor = inclusionLine.next;
    const role = roleLine.text.startsWith('ROLE ') ? roleLine.text.slice(5) : '';
    const inclusion = inclusionLine.text.startsWith('INCLUSION ') ? inclusionLine.text.slice(10) : '';
    const contentLength = parseLengthLine(bytes, cursor, 'CONTENT'); cursor = contentLength.next;
    const contentStart = cursor;
    const contentEnd = contentStart + contentLength.value;
    if (contentLength.value === 0 || contentEnd >= bytes.length || bytes[contentEnd] !== 0x0a) throw groundingError('PACKET_SERIALIZATION_INVALID');
    const content = bytes.subarray(contentStart, contentEnd);
    cursor = contentEnd + 1;
    const end = readLine(bytes, cursor);
    if (end.text !== 'END KSTACK-SOURCE-RECORD-V1') throw groundingError('PACKET_SERIALIZATION_INVALID');
    cursor = end.next;
    const source = {
      sourceId: decodeUtf8(idField.value), label: decodeUtf8(labelField.value), role, inclusion, content
    };
    validateSourceMetadata(source);
    if (ids.has(source.sourceId)) throw groundingError('PACKET_SOURCE_DUPLICATE');
    ids.add(source.sourceId);
    if (!canonicalizePacketSource(content).equals(content)) throw groundingError('PACKET_NOT_CANONICAL');
    const recordBytes = bytes.subarray(recordStart, cursor);
    const rebuilt = recordForSource(source);
    if (!rebuilt.bytes.equals(recordBytes)) throw groundingError('PACKET_NON_ROUND_TRIPPING');
    sources.push({
      sourceId: source.sourceId,
      label: source.label,
      role,
      inclusion,
      content,
      recordByteStart: recordStart,
      recordByteLength: recordBytes.length,
      contentByteStart: contentStart,
      contentByteLength: content.length,
      sourceSha256: sha256(content),
      recordSha256: sha256(recordBytes)
    });
  }
  if (sources.length === 0 || cursor !== bytes.length) throw groundingError('PACKET_SERIALIZATION_INVALID');
  return { packetBytes: bytes, sources };
}

function metadataEqual(actual, expected) {
  const keys = ['sourceId', 'label', 'role', 'inclusion', 'recordByteStart', 'recordByteLength', 'contentByteStart', 'contentByteLength', 'sourceSha256', 'recordSha256'];
  return expected && keys.every((key) => actual[key] === expected[key]) && Object.keys(expected).every((key) => keys.includes(key));
}

export function verifyDecisionPacket(packetValue, binding) {
  const bindingKeys = ['packetByteLength', 'packetCanonicalizationVersion', 'packetFramingVersion', 'packetSerializationVersion', 'packetSha256', 'sources'].sort();
  if (!binding || JSON.stringify(Object.keys(binding).sort()) !== JSON.stringify(bindingKeys)) throw groundingError('PACKET_METADATA_MISMATCH');
  if (!binding || binding.packetCanonicalizationVersion !== PACKET_CANONICALIZATION_VERSION || binding.packetSerializationVersion !== PACKET_SERIALIZATION_VERSION || binding.packetFramingVersion !== PACKET_FRAMING_VERSION) {
    throw groundingError('PACKET_VERSION_UNSUPPORTED');
  }
  const parsed = parseDecisionPacket(packetValue);
  if (binding.packetByteLength !== parsed.packetBytes.length || binding.packetSha256 !== sha256(parsed.packetBytes)) throw groundingError('PACKET_DIGEST_MISMATCH');
  if (!Array.isArray(binding.sources) || binding.sources.length !== parsed.sources.length) throw groundingError('PACKET_METADATA_MISMATCH');
  for (let index = 0; index < parsed.sources.length; index += 1) {
    if (!metadataEqual(parsed.sources[index], binding.sources[index])) throw groundingError('PACKET_METADATA_MISMATCH');
  }
  return parsed;
}

export function frameDecisionPacket(packetValue, tokenForCounter) {
  const packetBytes = Buffer.isBuffer(packetValue) ? packetValue : Buffer.from(packetValue);
  for (let counter = 0; counter < 32; counter += 1) {
    const token = tokenForCounter
      ? tokenForCounter(counter, packetBytes)
      : sha256(Buffer.concat([Buffer.from(`KSTACK-FRAME-v1\n${counter}\n`, 'ascii'), packetBytes])).toUpperCase();
    if (!/^[0-9A-F]{64}$/.test(token)) throw groundingError('PACKET_FRAME_TOKEN_INVALID');
    const begin = Buffer.from(`<<<KSTACK:PACKET:BEGIN:${token}>>>`, 'ascii');
    const end = Buffer.from(`<<<KSTACK:PACKET:END:${token}>>>`, 'ascii');
    if (packetBytes.includes(begin) || packetBytes.includes(end)) continue;
    return { counter, token, begin, end, framedBytes: Buffer.concat([begin, Buffer.from('\n'), packetBytes, end]) };
  }
  throw groundingError('PACKET_FRAME_COLLISION_EXHAUSTED');
}

function exactKeys(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}

function citableItem(review, target) {
  if (!exactKeys(target, ['field'], ['itemIndex', 'securityFindingId'])) return null;
  if (target.field === 'recommendation' && Object.keys(target).length === 1) return review.recommendation;
  if (target.field === 'strongestObjection' && Object.keys(target).length === 1) return review.strongestObjection;
  if (ARRAY_FIELDS.has(target.field) && Number.isInteger(target.itemIndex) && target.itemIndex >= 0 && target.itemIndex <= 2_147_483_647 && Object.keys(target).length === 2) return review[target.field]?.[target.itemIndex];
  if (target.field === 'securityFindings' && typeof target.securityFindingId === 'string' && Object.keys(target).length === 2) {
    const matches = review.securityFindings?.filter((finding) => finding?.id === target.securityFindingId) ?? [];
    return matches.length === 1 ? matches[0] : null;
  }
  return null;
}

function targetKey(target) {
  if (target?.field === 'securityFindings') return `securityFindings:${target.securityFindingId}`;
  if (ARRAY_FIELDS.has(target?.field)) return `${target.field}:${target.itemIndex}`;
  return target?.field ?? '';
}

function itemGroundKind(item, requiredField) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const keys = Object.keys(item).sort();
  const expected = requiredField === 'securityFindings'
    ? ['groundKind', 'id', 'severity', 'summary']
    : ['groundKind', 'text'];
  return JSON.stringify(keys) === JSON.stringify(expected) ? item.groundKind : null;
}

function itemText(item) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && !Array.isArray(item)) return typeof item.text === 'string' ? item.text : typeof item.summary === 'string' ? item.summary : null;
  return null;
}

function enumerateCitableItems(review) {
  const items = [];
  for (const field of ['recommendation', 'strongestObjection']) items.push({ key: field, value: review[field], requiredField: field });
  for (const field of ARRAY_FIELDS) for (const [index, value] of (review[field] ?? []).entries()) items.push({ key: `${field}:${index}`, value, requiredField: field });
  for (const finding of review.securityFindings ?? []) items.push({ key: `securityFindings:${finding.id}`, value: finding, requiredField: 'securityFindings' });
  return items;
}

function validCitationText(value) {
  return typeof value === 'string' && isUnicodeScalarSequence(value) && value.trim().length > 0
    && Buffer.byteLength(value, 'utf8') <= 2048 && value.split('\n').length <= 20 && !value.includes('\uFFFD');
}

export function evaluateGroundingOverlay(review, verifiedPacket) {
  const telemetry = {
    citationsEmitted: 0,
    anchorVerified: 0,
    citationFailed: 0,
    citationRedacted: 0,
    declaredAssertion: 0,
    declaredAbsence: 0,
    declaredNormative: 0,
    wouldBlock: 0,
    recommendationAnchorClass: 'none',
    outcomes: []
  };
  if (!verifiedPacket || !Array.isArray(verifiedPacket.sources)) {
    telemetry.wouldBlock = 1;
    telemetry.recommendationAnchorClass = 'not_evaluable';
    telemetry.outcomes.push({ code: 'GROUNDING_PACKET_NOT_AVAILABLE' });
    return telemetry;
  }
  const duplicateSecurityIds = new Set();
  const seenSecurityIds = new Set();
  for (const finding of review.securityFindings ?? []) {
    if (seenSecurityIds.has(finding?.id)) duplicateSecurityIds.add(finding.id);
    seenSecurityIds.add(finding?.id);
  }
  if (duplicateSecurityIds.size) telemetry.outcomes.push({ code: 'GROUNDING_SECURITY_ID_DUPLICATE' });
  const requiredAssertions = new Set();
  let legacyOrInvalidFormat = false;
  for (const item of enumerateCitableItems(review)) {
    const kind = itemGroundKind(item.value, item.requiredField);
    if (!GROUND_KINDS.has(kind) || !itemText(item.value)) {
      legacyOrInvalidFormat = true;
      continue;
    }
    telemetry[`declared${kind[0].toUpperCase()}${kind.slice(1)}`] += 1;
    if (kind === 'assertion' && item.requiredField !== 'unresolvedQuestions') requiredAssertions.add(item.key);
  }
  if (legacyOrInvalidFormat) telemetry.outcomes.push({ code: 'GROUNDING_FORMAT_LEGACY' });
  const citations = Array.isArray(review.citations) ? review.citations : [];
  if (!Array.isArray(review.citations)) telemetry.outcomes.push({ code: 'GROUNDING_CITATIONS_INVALID' });
  const sourceMap = new Map(verifiedPacket.sources.map((source) => [source.sourceId, source]));
  const ids = new Set();
  const covered = new Set();
  const recommendationCandidates = [];
  for (const [index, citation] of citations.entries()) {
    telemetry.citationsEmitted += 1;
    let code = null;
    let source = null;
    let scopedRole = null;
    const target = citation?.target;
    const targetItem = citableItem(review, target);
    if (index >= CITATION_LIMIT) code = 'GROUNDING_CITATION_LIMIT_EXCEEDED';
    else if (!exactKeys(citation, ['id', 'target', 'claim', 'quotedText'], ['sourceId'])) code = 'GROUNDING_CITATION_INVALID';
    else if (!CITATION_ID.test(citation.id) || ids.has(citation.id)) code = 'GROUNDING_CITATION_ID_INVALID';
    else if (!targetItem || (target.field === 'securityFindings' && duplicateSecurityIds.has(target.securityFindingId))) code = 'GROUNDING_TARGET_INVALID';
    else if (!validCitationText(citation.claim) || !validCitationText(citation.quotedText)) code = 'GROUNDING_CITATION_TEXT_INVALID';
    else if (citation.sourceId !== undefined && !SOURCE_ID.test(citation.sourceId)) code = 'GROUNDING_SOURCE_ID_INVALID';
    if (citation?.id) ids.add(citation.id);
    if (!code) {
      const quote = Buffer.from(citation.quotedText, 'utf8');
      if (citation.sourceId !== undefined) {
        source = sourceMap.get(citation.sourceId);
        if (!source) code = 'GROUNDING_SOURCE_NOT_FOUND';
        else if (!source.content.includes(quote)) code = 'GROUNDING_QUOTE_NOT_FOUND';
        else scopedRole = source.role;
      } else {
        source = verifiedPacket.sources.find((candidate) => candidate.content.includes(quote));
        if (!source) code = 'GROUNDING_QUOTE_NOT_FOUND';
      }
    }
    const key = targetKey(target);
    if (!code) {
      telemetry.anchorVerified += 1;
      covered.add(key);
      telemetry.outcomes.push({ id: citation.id, target: key, status: 'anchor_verified', sourceId: citation.sourceId ?? null });
    } else {
      telemetry.citationFailed += 1;
      telemetry.outcomes.push({ id: citation?.id ?? null, target: key, status: 'failed', code });
    }
    if (target?.field === 'recommendation') recommendationCandidates.push({ code, scopedRole, scoped: citation?.sourceId !== undefined });
  }
  const missing = [...requiredAssertions].filter((key) => !covered.has(key));
  for (const target of missing) telemetry.outcomes.push({ target, code: 'GROUNDING_ASSERTION_UNCITED' });
  if (legacyOrInvalidFormat || telemetry.citationFailed || missing.length || duplicateSecurityIds.size || !Array.isArray(review.citations)) telemetry.wouldBlock = 1;
  if (legacyOrInvalidFormat || !Array.isArray(review.citations)) telemetry.recommendationAnchorClass = 'not_evaluable';
  else if (recommendationCandidates.some((item) => item.code)) telemetry.recommendationAnchorClass = 'invalid_present';
  else if (recommendationCandidates.some((item) => item.scoped && ['checks-artifact', 'counter-evidence'].includes(item.scopedRole))) telemetry.recommendationAnchorClass = 'checks_or_counterevidence_scoped_present';
  else if (recommendationCandidates.some((item) => item.scoped)) telemetry.recommendationAnchorClass = 'design_or_context_scoped_present';
  else if (recommendationCandidates.some((item) => !item.scoped && !item.code)) telemetry.recommendationAnchorClass = 'unscoped_valid_only';
  return telemetry;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
