import { isWellFormedScalarString, normalizeMatchValue, scalarLength } from './normalization.mjs';

export const MAX_CORPUS_BYTES = 1_048_576;
export const MAX_VALID_LESSONS = 4_096;

const REQUIRED_FIELDS = Object.freeze([
  'id', 'createdAt', 'taskSignature', 'rule', 'why', 'sourceFailure', 'occurrences', 'promotedToClaudeMd'
]);
const KNOWN_FIELDS = new Set([...REQUIRED_FIELDS, 'applicabilityPhrases']);
const STRING_SCALAR_LIMITS = Object.freeze({ id: 160, createdAt: 64, rule: 8_192, why: 8_192, sourceFailure: 16_384 });
const CODES = new Set([
  'KSTACK_REFLEXION_CORPUS_UTF8_INVALID',
  'KSTACK_REFLEXION_CORPUS_JSON_SYNTAX',
  'KSTACK_REFLEXION_CORPUS_TOP_LEVEL_SHAPE',
  'KSTACK_REFLEXION_CORPUS_LESSON_SHAPE',
  'KSTACK_REFLEXION_CORPUS_UNKNOWN_PROPERTY',
  'KSTACK_REFLEXION_CORPUS_MISSING_PROPERTY',
  'KSTACK_REFLEXION_CORPUS_FIELD_TYPE',
  'KSTACK_REFLEXION_CORPUS_FIELD_VALUE',
  'KSTACK_REFLEXION_CORPUS_CARDINALITY',
  'KSTACK_REFLEXION_CORPUS_SCALAR_SEQUENCE',
  'KSTACK_REFLEXION_CORPUS_SCALAR_LIMIT',
  'KSTACK_REFLEXION_CORPUS_NORMALIZED_TOKEN_LIMIT',
  'KSTACK_REFLEXION_CORPUS_NORMALIZED_UTF8_LIMIT',
  'KSTACK_REFLEXION_CORPUS_ALIAS_FLOOR',
  'KSTACK_REFLEXION_CORPUS_DUPLICATE_ID'
]);

function makeCorpusError(code, metadata = {}) {
  if (!CODES.has(code)) throw new Error('invalid sealed corpus error');
  const error = new Error(code);
  Object.defineProperties(error, {
    name: { value: 'KStackReflexionCorpusError' },
    code: { value: code, enumerable: true },
    metadata: { value: Object.freeze({ ...metadata }), enumerable: true }
  });
  return Object.seal(error);
}

function fail(code, metadata) {
  throw makeCorpusError(code, metadata);
}

function validateScalarString(value, field, lessonIndex, { nonempty = true, limit = STRING_SCALAR_LIMITS[field] } = {}) {
  if (typeof value !== 'string') fail('KSTACK_REFLEXION_CORPUS_FIELD_TYPE', { field, lessonIndex });
  if (!isWellFormedScalarString(value)) fail('KSTACK_REFLEXION_CORPUS_SCALAR_SEQUENCE', { field, lessonIndex });
  if (nonempty && !value.trim()) fail('KSTACK_REFLEXION_CORPUS_FIELD_VALUE', { field, lessonIndex });
  const observed = scalarLength(value);
  if (observed > limit) fail('KSTACK_REFLEXION_CORPUS_SCALAR_LIMIT', { field, lessonIndex, limit, observed });
}

function validateMatchArray(value, field, lessonIndex, limit, { alias = false } = {}) {
  if (!Array.isArray(value)) fail('KSTACK_REFLEXION_CORPUS_FIELD_TYPE', { field, lessonIndex });
  if (field === 'taskSignature' && value.length === 0) fail('KSTACK_REFLEXION_CORPUS_CARDINALITY', { field, lessonIndex, limit, observed: 0 });
  if (value.length > limit) fail('KSTACK_REFLEXION_CORPUS_CARDINALITY', { field, lessonIndex, limit, observed: value.length });
  const normalizedSeen = new Set();
  for (let elementIndex = 0; elementIndex < value.length; elementIndex += 1) {
    const element = value[elementIndex];
    if (typeof element !== 'string') fail('KSTACK_REFLEXION_CORPUS_FIELD_TYPE', { field, lessonIndex, elementIndex });
    if (!isWellFormedScalarString(element)) fail('KSTACK_REFLEXION_CORPUS_SCALAR_SEQUENCE', { field, lessonIndex, elementIndex });
    if (!element.trim()) fail('KSTACK_REFLEXION_CORPUS_FIELD_VALUE', { field, lessonIndex, elementIndex });
    const observedScalars = scalarLength(element);
    if (observedScalars > 160) fail('KSTACK_REFLEXION_CORPUS_SCALAR_LIMIT', { field, lessonIndex, elementIndex, limit: 160, observed: observedScalars });
    const normalized = normalizeMatchValue(element);
    const tokenCount = normalized ? normalized.split(' ').length : 0;
    const byteCount = Buffer.byteLength(normalized);
    if (tokenCount > 160) fail('KSTACK_REFLEXION_CORPUS_NORMALIZED_TOKEN_LIMIT', { field, lessonIndex, elementIndex, limit: 160, observed: tokenCount });
    if (byteCount > 10_240) fail('KSTACK_REFLEXION_CORPUS_NORMALIZED_UTF8_LIMIT', { field, lessonIndex, elementIndex, limit: 10_240, observed: byteCount });
    if (tokenCount === 0) fail('KSTACK_REFLEXION_CORPUS_FIELD_VALUE', { field, lessonIndex, elementIndex });
    if (alias) {
      const lmnScalars = [...normalized].filter((scalar) => /[\p{L}\p{M}\p{N}]/u.test(scalar)).length;
      if (tokenCount < 2 && lmnScalars < 6) fail('KSTACK_REFLEXION_CORPUS_ALIAS_FLOOR', { field, lessonIndex, elementIndex });
    }
    if (alias && normalizedSeen.has(normalized)) fail('KSTACK_REFLEXION_CORPUS_FIELD_VALUE', { field, lessonIndex, elementIndex });
    normalizedSeen.add(normalized);
  }
  return normalizedSeen;
}

function validateLesson(lesson, lessonIndex) {
  if (lesson === null || typeof lesson !== 'object' || Array.isArray(lesson) || Object.getPrototypeOf(lesson) !== Object.prototype) {
    fail('KSTACK_REFLEXION_CORPUS_LESSON_SHAPE', { lessonIndex });
  }
  for (const key of Object.keys(lesson)) {
    if (!KNOWN_FIELDS.has(key)) fail('KSTACK_REFLEXION_CORPUS_UNKNOWN_PROPERTY', { lessonIndex });
  }
  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(lesson, field)) fail('KSTACK_REFLEXION_CORPUS_MISSING_PROPERTY', { field, lessonIndex });
  }

  validateScalarString(lesson.id, 'id', lessonIndex);
  validateScalarString(lesson.createdAt, 'createdAt', lessonIndex);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(lesson.createdAt) || Number.isNaN(Date.parse(lesson.createdAt))) {
    fail('KSTACK_REFLEXION_CORPUS_FIELD_VALUE', { field: 'createdAt', lessonIndex });
  }
  const signatures = validateMatchArray(lesson.taskSignature, 'taskSignature', lessonIndex, 32);
  const aliases = Object.hasOwn(lesson, 'applicabilityPhrases') ? lesson.applicabilityPhrases : [];
  const normalizedAliases = validateMatchArray(aliases, 'applicabilityPhrases', lessonIndex, 16, { alias: true });
  for (const normalized of normalizedAliases) {
    if (signatures.has(normalized)) fail('KSTACK_REFLEXION_CORPUS_FIELD_VALUE', { field: 'applicabilityPhrases', lessonIndex });
  }
  validateScalarString(lesson.rule, 'rule', lessonIndex);
  validateScalarString(lesson.why, 'why', lessonIndex);
  validateScalarString(lesson.sourceFailure, 'sourceFailure', lessonIndex);
  if (!Number.isSafeInteger(lesson.occurrences) || lesson.occurrences < 0) fail('KSTACK_REFLEXION_CORPUS_FIELD_VALUE', { field: 'occurrences', lessonIndex });
  if (typeof lesson.promotedToClaudeMd !== 'boolean') fail('KSTACK_REFLEXION_CORPUS_FIELD_TYPE', { field: 'promotedToClaudeMd', lessonIndex });
  return Object.freeze({ ...lesson, taskSignature: Object.freeze([...lesson.taskSignature]), applicabilityPhrases: Object.freeze([...aliases]) });
}

function jsonOffset(error, decoded) {
  const match = typeof error?.message === 'string' ? /(?: at position |position )(\d+)(?: \(line \d+ column \d+\))?$/u.exec(error.message) : null;
  if (!match) return {};
  const offset = Number(match[1]);
  return Number.isSafeInteger(offset) && offset <= decoded.length ? { utf16CodeUnitOffset: offset } : {};
}

export function parseAndValidateCorpusBytes(bytes) {
  let decoded;
  try {
    if (!(bytes instanceof Uint8Array)) fail('KSTACK_REFLEXION_CORPUS_UTF8_INVALID');
    if (bytes.byteLength > MAX_CORPUS_BYTES) fail('KSTACK_REFLEXION_CORPUS_CARDINALITY', { limit: MAX_CORPUS_BYTES, observed: bytes.byteLength });
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    if (error?.name === 'KStackReflexionCorpusError') throw error;
    throw makeCorpusError('KSTACK_REFLEXION_CORPUS_UTF8_INVALID');
  }

  let parsed;
  try {
    parsed = JSON.parse(decoded);
  } catch (error) {
    throw makeCorpusError('KSTACK_REFLEXION_CORPUS_JSON_SYNTAX', jsonOffset(error, decoded));
  }

  try {
    if (!Array.isArray(parsed)) fail('KSTACK_REFLEXION_CORPUS_TOP_LEVEL_SHAPE');
    if (parsed.length > MAX_VALID_LESSONS) fail('KSTACK_REFLEXION_CORPUS_CARDINALITY', { limit: MAX_VALID_LESSONS, observed: parsed.length });
    const lessons = parsed.map(validateLesson);
    const firstById = new Map();
    for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex += 1) {
      const id = lessons[lessonIndex].id;
      if (firstById.has(id)) {
        fail('KSTACK_REFLEXION_CORPUS_DUPLICATE_ID', { firstLessonIndex: firstById.get(id), secondLessonIndex: lessonIndex });
      }
      firstById.set(id, lessonIndex);
    }
    return Object.freeze(lessons);
  } catch (error) {
    if (error?.name === 'KStackReflexionCorpusError') throw error;
    throw makeCorpusError('KSTACK_REFLEXION_CORPUS_FIELD_VALUE');
  }
}

export function serializeValidatedCorpus(lessons) {
  const bytes = Buffer.from(`${JSON.stringify(lessons, null, 2)}\n`, 'utf8');
  parseAndValidateCorpusBytes(bytes);
  return bytes;
}
