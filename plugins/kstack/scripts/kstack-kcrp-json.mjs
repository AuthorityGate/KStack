import crypto from 'node:crypto';

export const KCRP_JSON_VERSION = 'kstack-kcrp-json-v1';
export const KCRP_CONTROL_JSON_MAX_BYTES = 4_194_304;
export const KCRP_JSON_MAX_DEPTH = 64;

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function tooLarge(actualBytes) {
  const error = new Error('KCRP_JSON_TOO_LARGE');
  error.code = 'KCRP_JSON_TOO_LARGE';
  error.actualBytes = actualBytes;
  error.maximumBytes = KCRP_CONTROL_JSON_MAX_BYTES;
  throw error;
}

function asBytes(input, maximumBytes = null) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) {
    if (maximumBytes !== null && input.length > maximumBytes) tooLarge(input.length);
    return Buffer.from(input);
  }
  if (typeof input === 'string') return Buffer.from(input, 'utf8');
  fail('KCRP_JSON_INPUT_INVALID');
}

function assertScalarString(value) {
  if (typeof value !== 'string' || !value.isWellFormed()) fail('KCRP_JSON_STRING_INVALID');
  return value;
}

function encodeString(value, encoder) {
  assertScalarString(value);
  encoder.append('"');
  for (const scalar of value) {
    const codePoint = scalar.codePointAt(0);
    if (scalar === '"') encoder.append('\\"');
    else if (scalar === '\\') encoder.append('\\\\');
    else if (codePoint <= 0x1f) encoder.append(`\\u00${codePoint.toString(16).padStart(2, '0')}`);
    else encoder.append(scalar);
  }
  encoder.append('"');
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

class BoundedEncoder {
  constructor() { this.output = ''; this.byteLength = 0; }

  append(text) {
    const next = this.byteLength + Buffer.byteLength(text, 'utf8');
    if (next > KCRP_CONTROL_JSON_MAX_BYTES) tooLarge(next);
    this.byteLength = next;
    this.output += text;
  }
}

function encodeValue(value, depth, ancestors, encoder) {
  if (depth > KCRP_JSON_MAX_DEPTH) fail('KCRP_JSON_DEPTH_LIMIT');
  if (value === null) { encoder.append('null'); return; }
  if (value === true) { encoder.append('true'); return; }
  if (value === false) { encoder.append('false'); return; }
  if (typeof value === 'string') { encodeString(value, encoder); return; }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail('KCRP_JSON_NUMBER_INVALID');
    encoder.append(String(value));
    return;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) fail('KCRP_JSON_VALUE_INVALID');
    if (Object.keys(value).length !== value.length) fail('KCRP_JSON_VALUE_INVALID');
    ancestors.add(value);
    encoder.append('[');
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) fail('KCRP_JSON_VALUE_INVALID');
      if (index > 0) encoder.append(',');
      encodeValue(value[index], depth + 1, ancestors, encoder);
    }
    encoder.append(']');
    ancestors.delete(value);
    return;
  }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) fail('KCRP_JSON_VALUE_INVALID');
  if (ancestors.has(value)) fail('KCRP_JSON_VALUE_INVALID');
  ancestors.add(value);
  const keys = Object.keys(value);
  for (const key of keys) assertScalarString(key);
  keys.sort(compareUtf8);
  encoder.append('{');
  for (let index = 0; index < keys.length; index += 1) {
    if (index > 0) encoder.append(',');
    encodeString(keys[index], encoder);
    encoder.append(':');
    encodeValue(value[keys[index]], depth + 1, ancestors, encoder);
  }
  encoder.append('}');
  ancestors.delete(value);
}

export function canonicalJsonEncode(value) {
  const encoder = new BoundedEncoder();
  try { encodeValue(value, 0, new Set(), encoder); }
  catch (error) {
    if (error instanceof RangeError) fail('KCRP_JSON_DEPTH_LIMIT');
    throw error;
  }
  return encoder.output;
}

export function canonicalJsonBytes(value) {
  return Buffer.from(canonicalJsonEncode(value), 'utf8');
}

class Parser {
  constructor(text) { this.text = text; this.offset = 0; }

  parse() {
    const value = this.value(0);
    if (this.offset !== this.text.length) fail('KCRP_JSON_TRAILING_DATA');
    return value;
  }

  value(depth) {
    if (depth > KCRP_JSON_MAX_DEPTH) fail('KCRP_JSON_DEPTH_LIMIT');
    const token = this.text[this.offset];
    if (token === '{') return this.object(depth);
    if (token === '[') return this.array(depth);
    if (token === '"') return this.string();
    if (token === 't') return this.literal('true', true);
    if (token === 'f') return this.literal('false', false);
    if (token === 'n') return this.literal('null', null);
    if (token === '-' || (token >= '0' && token <= '9')) return this.integer();
    fail('KCRP_JSON_SYNTAX_INVALID');
  }

  literal(token, value) {
    if (this.text.slice(this.offset, this.offset + token.length) !== token) fail('KCRP_JSON_SYNTAX_INVALID');
    this.offset += token.length;
    return value;
  }

  object(depth) {
    this.offset += 1;
    const output = {};
    const keys = new Set();
    if (this.text[this.offset] === '}') { this.offset += 1; return output; }
    while (true) {
      if (this.text[this.offset] !== '"') fail('KCRP_JSON_SYNTAX_INVALID');
      const key = this.string();
      if (keys.has(key)) fail('KCRP_JSON_DUPLICATE_KEY');
      keys.add(key);
      if (this.text[this.offset] !== ':') fail('KCRP_JSON_SYNTAX_INVALID');
      this.offset += 1;
      Object.defineProperty(output, key, { value: this.value(depth + 1), enumerable: true, configurable: true, writable: true });
      const separator = this.text[this.offset];
      if (separator === '}') { this.offset += 1; return output; }
      if (separator !== ',') fail('KCRP_JSON_SYNTAX_INVALID');
      this.offset += 1;
    }
  }

  array(depth) {
    this.offset += 1;
    const output = [];
    if (this.text[this.offset] === ']') { this.offset += 1; return output; }
    while (true) {
      output.push(this.value(depth + 1));
      const separator = this.text[this.offset];
      if (separator === ']') { this.offset += 1; return output; }
      if (separator !== ',') fail('KCRP_JSON_SYNTAX_INVALID');
      this.offset += 1;
    }
  }

  string() {
    this.offset += 1;
    let output = '';
    while (this.offset < this.text.length) {
      const character = this.text[this.offset++];
      if (character === '"') return assertScalarString(output);
      if (character === '\\') {
        const escaped = this.text[this.offset++];
        if (escaped === '"' || escaped === '\\' || escaped === '/') output += escaped;
        else if (escaped === 'u') output += this.unicodeEscape();
        else output += this.namedEscape(escaped);
        continue;
      }
      if (character.charCodeAt(0) <= 0x1f) fail('KCRP_JSON_CONTROL_INVALID');
      output += character;
    }
    fail('KCRP_JSON_STRING_UNTERMINATED');
  }

  namedEscape(escaped) {
    if (escaped === 'b') return String.fromCharCode(8);
    if (escaped === 'f') return String.fromCharCode(12);
    if (escaped === 'n') return String.fromCharCode(10);
    if (escaped === 'r') return String.fromCharCode(13);
    if (escaped === 't') return String.fromCharCode(9);
    fail('KCRP_JSON_ESCAPE_INVALID');
  }

  unicodeEscape() {
    const first = this.hexUnit();
    if (first >= 0xdc00 && first <= 0xdfff) fail('KCRP_JSON_SURROGATE_INVALID');
    if (first < 0xd800 || first > 0xdbff) return String.fromCharCode(first);
    if (this.text[this.offset] !== '\\' || this.text[this.offset + 1] !== 'u') fail('KCRP_JSON_SURROGATE_INVALID');
    this.offset += 2;
    const second = this.hexUnit();
    if (second < 0xdc00 || second > 0xdfff) fail('KCRP_JSON_SURROGATE_INVALID');
    return String.fromCodePoint(0x10000 + ((first - 0xd800) << 10) + second - 0xdc00);
  }

  hexUnit() {
    const digits = this.text.slice(this.offset, this.offset + 4);
    if (!/^[0-9a-f]{4}$/i.test(digits)) fail('KCRP_JSON_ESCAPE_INVALID');
    this.offset += 4;
    return Number.parseInt(digits, 16);
  }

  integer() {
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(this.text.slice(this.offset));
    if (!match) fail('KCRP_JSON_NUMBER_INVALID');
    const numeral = match[0];
    this.offset += numeral.length;
    if (numeral.includes('.') || /[eE]/.test(numeral) || numeral === '-0') fail('KCRP_JSON_NUMBER_INVALID');
    let integer;
    try { integer = BigInt(numeral); } catch { fail('KCRP_JSON_NUMBER_INVALID'); }
    if (integer > BigInt(Number.MAX_SAFE_INTEGER) || integer < BigInt(Number.MIN_SAFE_INTEGER)) fail('KCRP_JSON_NUMBER_INVALID');
    return Number(integer);
  }
}

export function parseCanonicalJson(input) {
  if (typeof input === 'string') fail('KCRP_JSON_INPUT_INVALID');
  const bytes = asBytes(input, KCRP_CONTROL_JSON_MAX_BYTES);
  if (bytes.length > KCRP_CONTROL_JSON_MAX_BYTES) tooLarge(bytes.length);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) fail('KCRP_JSON_BOM_FORBIDDEN');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { fail('KCRP_JSON_UTF8_INVALID'); }
  if (!text.isWellFormed()) fail('KCRP_JSON_STRING_INVALID');
  const value = new Parser(text).parse();
  if (!canonicalJsonBytes(value).equals(bytes)) fail('KCRP_JSON_NONCANONICAL');
  return value;
}

export function canonicalJsonSha256(value) {
  return crypto.createHash('sha256').update(canonicalJsonBytes(value)).digest('hex');
}

export function bytesSha256(value) {
  return crypto.createHash('sha256').update(asBytes(value)).digest('hex');
}
