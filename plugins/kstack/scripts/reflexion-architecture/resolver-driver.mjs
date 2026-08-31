import { importedEntryState } from './entry-probe.mjs';
import { runUnicodeOracle } from './unicode-oracle.mjs';

const MAX_INPUT_BYTES = 8_388_608;
const MAX_REQUESTS = 65_536;
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });

let rejected = false;
process.on('unhandledRejection', () => { rejected = true; process.exitCode = 70; });

function fail(code = 64) { process.exitCode = code; throw new Error('resolver protocol failure'); }
function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && Object.keys(value).every((key, index) => key === keys[index]);
}
function failureKind(code) {
  if (['ERR_MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED', 'ERR_PACKAGE_IMPORT_NOT_DEFINED'].includes(code)) return 'specifier-not-found';
  if (['ERR_INVALID_PACKAGE_CONFIG', 'ERR_INVALID_ARG_TYPE', 'ERR_INVALID_URL'].includes(code)) return 'environment-invalid';
  return 'other-resolution';
}
async function readInput() {
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > MAX_INPUT_BYTES) fail();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}
function validateConformance(value) {
  const keys = ['parentURL', 'moduleNotFound', 'pathNotExported', 'importNotDefined', 'invalidPackageConfig'];
  if (!exactKeys(value, keys) || keys.some((key) => typeof value[key] !== 'string')) fail();
  try { if (new URL(value.parentURL).protocol !== 'file:') fail(); } catch { fail(); }
  return value;
}
function observeError(label, expectedCode, operation) {
  try { operation(); fail(70); }
  catch (error) {
    if (process.exitCode === 70) throw error;
    const ownCode = Object.prototype.hasOwnProperty.call(error, 'code');
    const codeInError = error !== null && typeof error === 'object' && 'code' in error;
    const prototypeCode = error !== null && typeof error === 'object' ? Object.getPrototypeOf(error)?.code ?? null : null;
    if (!ownCode || !codeInError || prototypeCode !== null || error.code !== expectedCode) fail(70);
    return Object.freeze({ label, expectedCode, ownCode, codeInError, prototypeCode });
  }
}
function runConformanceProbe(conformance) {
  const parent = conformance.parentURL;
  const errors = [
    observeError('module-not-found', 'ERR_MODULE_NOT_FOUND', () => import.meta.resolve(conformance.moduleNotFound, parent)),
    observeError('path-not-exported', 'ERR_PACKAGE_PATH_NOT_EXPORTED', () => import.meta.resolve(conformance.pathNotExported, parent)),
    observeError('import-not-defined', 'ERR_PACKAGE_IMPORT_NOT_DEFINED', () => import.meta.resolve(conformance.importNotDefined, parent)),
    observeError('invalid-package-config', 'ERR_INVALID_PACKAGE_CONFIG', () => import.meta.resolve(conformance.invalidPackageConfig, parent)),
    observeError('invalid-arg-type', 'ERR_INVALID_ARG_TYPE', () => import.meta.resolve('./x.mjs', null)),
    observeError('invalid-url', 'ERR_INVALID_URL', () => import.meta.resolve('file://%', parent)),
    observeError('other-resolution', 'ERR_INVALID_MODULE_SPECIFIER', () => import.meta.resolve('#', parent))
  ];
  const unicode = runUnicodeOracle();
  if (import.meta.main !== true || importedEntryState !== false) fail(70);
  return Object.freeze({
    kind: 'resolver-conformance-v1', directEntryMain: true, importedEntryMain: false,
    errorShapeCount: errors.length, errors, unicode
  });
}

try {
  const input = await readInput();
  if (input.includes(0x0d) || (input.length > 0 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf)) fail();
  const text = decoder.decode(input);
  if (!text.endsWith('\n')) fail();
  const lines = text.slice(0, -1).split('\n');
  const headerLine = lines.shift() ?? '';
  const header = JSON.parse(headerLine);
  const conformanceMode = exactKeys(header, ['kind', 'requestCount', 'conformance']) && header.kind === 'resolver-conformance-batch-v1';
  if (!(conformanceMode || (exactKeys(header, ['kind', 'requestCount']) && header.kind === 'resolver-batch-v1'))
      || !Number.isSafeInteger(header.requestCount) || header.requestCount < 0 || header.requestCount > MAX_REQUESTS
      || lines.length !== header.requestCount || JSON.stringify(header) !== headerLine) fail();
  const conformance = conformanceMode ? validateConformance(header.conformance) : null;
  const requests = lines.map((line, id) => {
    const request = JSON.parse(line);
    if (!exactKeys(request, ['id', 'specifier', 'parentURL']) || request.id !== id || typeof request.specifier !== 'string'
        || typeof request.parentURL !== 'string' || Buffer.byteLength(line) > 32_768 || JSON.stringify(request) !== line) fail();
    try { if (new URL(request.parentURL).protocol !== 'file:') fail(); } catch { fail(); }
    return request;
  });
  const output = [];
  if (conformance) output.push(JSON.stringify(runConformanceProbe(conformance)));
  for (const request of requests) {
    if (rejected) fail(70);
    try {
      const result = import.meta.resolve(request.specifier, request.parentURL);
      if (typeof result !== 'string') fail(70);
      output.push(JSON.stringify({ id: request.id, ok: true, url: result }));
    } catch (error) {
      if (process.exitCode === 70) throw error;
      if (!Object.prototype.hasOwnProperty.call(error, 'code') || typeof error.code !== 'string' || !/^ERR_[A-Z0-9_]{1,64}$/u.test(error.code)) fail(70);
      output.push(JSON.stringify({ id: request.id, ok: false, failureKind: failureKind(error.code), errorCode: error.code }));
    }
  }
  if (rejected) fail(70);
  output.push(JSON.stringify({ kind: 'resolver-batch-complete-v1', responseCount: requests.length }));
  process.stdout.write(`${output.join('\n')}\n`);
} catch {
  if (process.exitCode === undefined) process.exitCode = 64;
}
