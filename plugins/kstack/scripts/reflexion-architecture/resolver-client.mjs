import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_INPUT_BYTES = 8_388_608;
const MAX_OUTPUT_BYTES = 16_777_216;
const MAX_STDERR_BYTES = 65_536;
const MAX_REQUESTS = 65_536;
const DENIED_ENVIRONMENT = Object.freeze(['NODE_OPTIONS', 'NODE_PATH', 'NODE_ICU_DATA']);

function clientError(code) { const error = new Error(code); error.code = code; return error; }
function compareUtf8(left, right) { return Buffer.compare(Buffer.from(left), Buffer.from(right)); }

export function createResolverConformanceFixture() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-resolver-probe-'));
  const nested = path.join(fixtureRoot, 'nested');
  const nodeModules = path.join(fixtureRoot, 'node_modules');
  const dependency = path.join(nodeModules, 'probe-dep');
  const invalid = path.join(nodeModules, 'probe-bad');
  fs.mkdirSync(nested, { recursive: true });
  fs.mkdirSync(dependency, { recursive: true });
  fs.mkdirSync(invalid, { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, 'package.json'), JSON.stringify({
    name: 'probe-self', type: 'module', exports: { '.': './self.mjs' }, imports: { '#scope': './root-scope.mjs' }
  }));
  fs.writeFileSync(path.join(nested, 'package.json'), JSON.stringify({ type: 'module', imports: { '#scope': './nested-scope.mjs' } }));
  fs.writeFileSync(path.join(dependency, 'package.json'), JSON.stringify({
    name: 'probe-dep', type: 'module', exports: { '.': { node: { import: './import.mjs', default: './default.mjs' }, default: './default.mjs' } }
  }));
  fs.writeFileSync(path.join(invalid, 'package.json'), '{invalid json');
  for (const target of ['importer.mjs', 'relative.mjs', 'self.mjs', 'root-scope.mjs']) fs.writeFileSync(path.join(fixtureRoot, target), 'export {};\n');
  for (const target of ['importer.mjs', 'nested-scope.mjs']) fs.writeFileSync(path.join(nested, target), 'export {};\n');
  for (const target of ['import.mjs', 'default.mjs']) fs.writeFileSync(path.join(dependency, target), 'export {};\n');
  const parentURL = pathToFileURL(path.join(fixtureRoot, 'importer.mjs')).href;
  const nestedParentURL = pathToFileURL(path.join(nested, 'importer.mjs')).href;
  const absentURL = pathToFileURL(path.join(fixtureRoot, 'absent.mjs')).href;
  const requests = [
    { specifier: './relative.mjs', parentURL }, { specifier: '#scope', parentURL },
    { specifier: '#scope', parentURL: nestedParentURL }, { specifier: 'probe-self', parentURL },
    { specifier: 'probe-dep', parentURL }, { specifier: absentURL, parentURL }
  ];
  const expected = new Map([
    [`${parentURL}\0./relative.mjs`, pathToFileURL(path.join(fixtureRoot, 'relative.mjs')).href],
    [`${parentURL}\0#scope`, pathToFileURL(path.join(fixtureRoot, 'root-scope.mjs')).href],
    [`${nestedParentURL}\0#scope`, pathToFileURL(path.join(nested, 'nested-scope.mjs')).href],
    [`${parentURL}\0probe-self`, pathToFileURL(path.join(fixtureRoot, 'self.mjs')).href],
    [`${parentURL}\0probe-dep`, pathToFileURL(path.join(dependency, 'import.mjs')).href],
    [`${parentURL}\0${absentURL}`, absentURL]
  ]);
  const conformance = {
    parentURL, moduleNotFound: 'probe-definitely-missing', pathNotExported: 'probe-dep/not-exported',
    importNotDefined: '#not-defined', invalidPackageConfig: 'probe-bad'
  };
  return Object.freeze({
    fixtureRoot, requests: Object.freeze(requests), expected, conformance: Object.freeze(conformance), absentURL,
    cleanup: () => fs.rmSync(fixtureRoot, { recursive: true, force: true })
  });
}

export function serializeResolverBatch(requests, conformance = null) {
  if (!Array.isArray(requests) || requests.length > MAX_REQUESTS) throw clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_INPUT');
  const canonical = requests.map((request) => ({ specifier: request.specifier, parentURL: request.parentURL }))
    .sort((left, right) => compareUtf8(left.parentURL, right.parentURL) || compareUtf8(left.specifier, right.specifier));
  const unique = canonical.filter((request, index) => index === 0 || request.specifier !== canonical[index - 1].specifier || request.parentURL !== canonical[index - 1].parentURL);
  const header = conformance === null
    ? { kind: 'resolver-batch-v1', requestCount: unique.length }
    : { kind: 'resolver-conformance-batch-v1', requestCount: unique.length, conformance };
  const lines = [JSON.stringify(header), ...unique.map((request, id) => JSON.stringify({ id, specifier: request.specifier, parentURL: request.parentURL }))];
  if (lines.slice(1).some((line) => Buffer.byteLength(line) > 32_768)) throw clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_INPUT');
  const input = Buffer.from(`${lines.join('\n')}\n`);
  if (input.length > MAX_INPUT_BYTES) throw clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_INPUT');
  return Object.freeze({ input, requests: Object.freeze(unique) });
}

function parseOutput(bytes, requestCount, conformanceExpected) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_PROTOCOL'); }
  if (!text.endsWith('\n') || text.includes('\r')) throw clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_PROTOCOL');
  const lines = text.slice(0, -1).split('\n');
  let conformance = null;
  if (conformanceExpected) {
    try { conformance = JSON.parse(lines.shift() ?? ''); } catch { throw clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_PROTOCOL'); }
    if (conformance?.kind !== 'resolver-conformance-v1' || conformance.directEntryMain !== true || conformance.importedEntryMain !== false
        || conformance.errorShapeCount !== 7 || !Array.isArray(conformance.errors) || conformance.errors.length !== 7
        || conformance.unicode?.kind !== 'unicode-oracle-v1') throw clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_PROTOCOL');
  }
  let completion;
  try { completion = JSON.parse(lines.pop() ?? ''); } catch { throw clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_PROTOCOL'); }
  if (completion?.kind !== 'resolver-batch-complete-v1' || completion.responseCount !== requestCount || lines.length !== requestCount) throw clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_PROTOCOL');
  const responses = lines.map((line, id) => {
    let record;
    try { record = JSON.parse(line); } catch { throw clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_PROTOCOL'); }
    if (record?.id !== id || typeof record.ok !== 'boolean') throw clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_PROTOCOL');
    if (record.ok ? typeof record.url !== 'string' : (!['specifier-not-found', 'environment-invalid', 'other-resolution'].includes(record.failureKind) || !/^ERR_[A-Z0-9_]{1,64}$/u.test(record.errorCode))) throw clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_PROTOCOL');
    return Object.freeze(record);
  });
  return Object.freeze({ responses: Object.freeze(responses), conformance: conformance ? Object.freeze(conformance) : null });
}

export function runBoundedResolverBatch({ driverPath, requests, conformance = null, testBounds = null }) {
  const driverReal = fs.realpathSync.native(driverPath);
  if (path.basename(driverReal) !== 'resolver-driver.mjs' || !fs.lstatSync(driverReal).isFile()) return Promise.reject(clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_PATH'));
  const serialized = serializeResolverBatch(requests, conformance);
  const deadlineMs = testBounds?.deadlineMs ?? 30_000;
  const termGraceMs = testBounds?.termGraceMs ?? 2_000;
  const killGraceMs = testBounds?.killGraceMs ?? 2_000;
  const environment = { ...process.env };
  for (const name of DENIED_ENVIRONMENT) delete environment[name];
  return new Promise((resolve, reject) => {
    let child;
    let settled = false;
    let terminalCode = null;
    let totalBytes = 0;
    let stderrBytes = 0;
    const stdout = [];
    const stderr = [];
    let deadlineTimer;
    let termTimer;
    let killTimer;
    const settle = (error = null, result = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadlineTimer); clearTimeout(termTimer); clearTimeout(killTimer);
      if (error) reject(error); else resolve(result);
    };
    const terminate = (code) => {
      if (terminalCode === null) terminalCode = code;
      try { child.stdin.end(); } catch {}
      try { child.kill('SIGTERM'); } catch {}
      termTimer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {}; killTimer = setTimeout(() => settle(clientError(terminalCode ?? 'KSTACK_REFLEXION_RESOLVER_DRIVER_REAP')), killGraceMs); }, termGraceMs);
    };
    try {
      child = spawn(process.execPath, ['--no-warnings', '--experimental-import-meta-resolve', driverReal], {
        cwd: path.dirname(path.dirname(path.dirname(path.dirname(path.dirname(driverReal))))), env: environment,
        shell: false, stdio: ['pipe', 'pipe', 'pipe'], detached: false
      });
    } catch { settle(clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_SPAWN')); return; }
    child.once('error', () => settle(clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_SPAWN')));
    child.stdin.once('error', () => { if (terminalCode === null) terminate('KSTACK_REFLEXION_RESOLVER_DRIVER_STDIN'); });
    const collect = (chunk, target, isStderr) => {
      totalBytes += chunk.length;
      if (isStderr) stderrBytes += chunk.length;
      if (totalBytes > MAX_OUTPUT_BYTES || stderrBytes > MAX_STDERR_BYTES) { terminate('KSTACK_REFLEXION_RESOLVER_DRIVER_OUTPUT_LIMIT'); return; }
      target.push(chunk);
    };
    child.stdout.on('data', (chunk) => collect(chunk, stdout, false));
    child.stderr.on('data', (chunk) => collect(chunk, stderr, true));
    child.once('close', (code, signal) => {
      if (terminalCode !== null) { settle(clientError(terminalCode)); return; }
      if (signal !== null || code !== 0 || stderrBytes !== 0) { settle(clientError('KSTACK_REFLEXION_RESOLVER_DRIVER_EXIT')); return; }
      try { settle(null, parseOutput(Buffer.concat(stdout), serialized.requests.length, conformance !== null)); }
      catch (error) { settle(error); }
    });
    deadlineTimer = setTimeout(() => terminate('KSTACK_REFLEXION_RESOLVER_DRIVER_TIMEOUT'), deadlineMs);
    child.stdin.write(serialized.input, (error) => {
      if (error) { if (terminalCode === null) terminate('KSTACK_REFLEXION_RESOLVER_DRIVER_STDIN'); return; }
      child.stdin.end();
    });
  });
}

export async function runResolverConformance(driverPath, testBounds = null) {
  const fixture = createResolverConformanceFixture();
  try {
    const result = await runBoundedResolverBatch({ driverPath, requests: fixture.requests, conformance: fixture.conformance, testBounds });
    const serialized = serializeResolverBatch(fixture.requests, fixture.conformance);
    for (let index = 0; index < serialized.requests.length; index += 1) {
      const request = serialized.requests[index];
      const response = result.responses[index];
      const expected = fixture.expected.get(`${request.parentURL}\0${request.specifier}`);
      if (!response.ok || response.url !== expected) throw clientError('KSTACK_REFLEXION_RESOLVER_CONFORMANCE');
      if (response.url === fixture.absentURL) {
        try { fs.lstatSync(new URL(response.url)); throw clientError('KSTACK_REFLEXION_RESOLVER_CONFORMANCE'); }
        catch (error) { if (error?.code !== 'ENOENT') throw error; }
      } else {
        const stat = fs.lstatSync(new URL(response.url));
        if (!stat.isFile() || stat.isSymbolicLink()) throw clientError('KSTACK_REFLEXION_RESOLVER_CONFORMANCE');
      }
    }
    const stableUnicode = {
      scalarCount: result.conformance.unicode.scalarCount,
      primaryCompositionPairCount: result.conformance.unicode.primaryCompositionPairCount,
      conditionalContextCount: result.conformance.unicode.conditionalContextCount,
      maximizingScalar: result.conformance.unicode.maximizingScalar,
      uniqueScalarMaximumCount: result.conformance.unicode.uniqueScalarMaximumCount,
      quoteCompositionSafe: result.conformance.unicode.quoteCompositionSafe,
      tokenSplitBoundProved: result.conformance.unicode.tokenSplitBoundProved,
      inputBytes: result.conformance.unicode.inputBytes,
      outputBytes: result.conformance.unicode.outputBytes,
      outputScalars: result.conformance.unicode.outputScalars,
      expansionRatio: result.conformance.unicode.expansionRatio,
      totalPoolUpperBound: result.conformance.unicode.totalPoolUpperBound,
      marginBytes: result.conformance.unicode.marginBytes,
      marginPercent: result.conformance.unicode.marginPercent,
      sourceDigest: result.conformance.unicode.sourceDigest
    };
    const errorCodes = result.conformance.errors.map((item) => item.expectedCode);
    const resolverRecord = {
      conditionVector: 'node-esm-import-default-v1', contextualParentDiffers: true,
      absentFileReturnsString: true, selectedTargets: ['relative', 'root-import', 'nested-import', 'self', 'node-import'],
      errorCodes, ownCode: result.conformance.errors.every((item) => item.ownCode && item.codeInError && item.prototypeCode === null),
      directEntryMain: result.conformance.directEntryMain, importedEntryMain: result.conformance.importedEntryMain
    };
    return Object.freeze({
      resolverProbeSha256: crypto.createHash('sha256').update(JSON.stringify(resolverRecord)).digest('hex'),
      unicodeProbeSha256: crypto.createHash('sha256').update(JSON.stringify(stableUnicode)).digest('hex'),
      resolverRecord: Object.freeze(resolverRecord), unicodeRecord: Object.freeze(stableUnicode)
    });
  } finally { fixture.cleanup(); }
}
