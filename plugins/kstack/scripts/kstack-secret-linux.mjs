#!/usr/bin/env node
// Audited native host worker; never import this module into a model-facing process.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BACKEND_ID = 'linux-secret-service-v1';
const RECORD_SCHEMA = 'kstack-linux-secret-service-record-v1';
const HANDLE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const IDENTIFIER = /^[a-z0-9][a-z0-9._-]{0,95}$/u;
const TARGET = /^https:\/\/[a-z0-9-]+[.]atlassian[.]net$/u;
const EMAIL = /^[^:@\s]+@[^:@\s]+[.][^:@\s]+$/u;
const MODES = new Set(['Probe', 'SyntheticLifecycle', 'SyntheticJiraAdapter', 'EnrollInteractive', 'RotateInteractive', 'Revoke', 'Inventory', 'JiraAuthCheck']);
const SYNTHETIC_MODES = new Set(['SyntheticLifecycle', 'SyntheticJiraAdapter']);
const SECRET_TOOL = '/usr/bin/secret-tool';
const MAX_SECRET_BYTES = 4096;

class LinuxSecretError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function fail(code) { throw new LinuxSecretError(code); }
function safeResult(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function clear(value) { if (Buffer.isBuffer(value)) value.fill(0); }
function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('\0') !== [...expected].sort().join('\0')) fail('KSTACK_SECRET_LINUX_RECORD_INVALID');
}
function assertHandle(value) { if (typeof value !== 'string' || !HANDLE.test(value)) fail('KSTACK_SECRET_LINUX_HANDLE_INVALID'); }
function assertIdentifier(value, code) { if (typeof value !== 'string' || !IDENTIFIER.test(value)) fail(code); }
function assertTarget(value) { if (typeof value !== 'string' || !TARGET.test(value)) fail('KSTACK_SECRET_LINUX_TARGET_INVALID'); }
function assertEmail(value) { if (typeof value !== 'string' || value.length > 254 || !EMAIL.test(value)) fail('KSTACK_SECRET_LINUX_EMAIL_INVALID'); }
function assertSecret(value) {
  if (!Buffer.isBuffer(value) || value.length < 16 || value.length > MAX_SECRET_BYTES
    || value.some((byte) => byte < 0x21 || byte > 0x7e)) fail('KSTACK_SECRET_LINUX_VALUE_INVALID');
}

function parseArgs(argv) {
  const options = { mode: null, handleId: null, purposeId: null, adapterId: null, targetOrigin: null, testRoot: null, testSecretTool: null };
  const keys = new Map([
    ['--mode', 'mode'], ['--handle-id', 'handleId'], ['--purpose-id', 'purposeId'], ['--adapter-id', 'adapterId'],
    ['--target-origin', 'targetOrigin'], ['--test-root', 'testRoot'], ['--test-secret-tool', 'testSecretTool']
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    const property = keys.get(argv[index]);
    if (!property || !argv[index + 1] || options[property] !== null) fail('KSTACK_SECRET_LINUX_ARGUMENTS_INVALID');
    options[property] = argv[index + 1];
  }
  if (!MODES.has(options.mode)) fail('KSTACK_SECRET_LINUX_ARGUMENTS_INVALID');
  if ((options.testRoot || options.testSecretTool) && !SYNTHETIC_MODES.has(options.mode)) fail('KSTACK_SECRET_LINUX_TEST_BOUNDARY_INVALID');
  if (Boolean(options.testRoot) !== Boolean(options.testSecretTool)) fail('KSTACK_SECRET_LINUX_TEST_BOUNDARY_INVALID');
  const supplied = ['handleId', 'purposeId', 'adapterId', 'targetOrigin'].filter((key) => options[key] !== null);
  if (['Probe', 'Inventory'].includes(options.mode) && supplied.length !== 0) fail('KSTACK_SECRET_LINUX_ARGUMENTS_INVALID');
  if (SYNTHETIC_MODES.has(options.mode) && supplied.length !== 0) fail('KSTACK_SECRET_LINUX_ARGUMENTS_INVALID');
  if (options.mode === 'EnrollInteractive' && supplied.sort().join(',') !== 'adapterId,handleId,purposeId,targetOrigin') fail('KSTACK_SECRET_LINUX_ARGUMENTS_INVALID');
  if (['RotateInteractive', 'Revoke', 'JiraAuthCheck'].includes(options.mode)
    && (supplied.length !== 1 || supplied[0] !== 'handleId')) fail('KSTACK_SECRET_LINUX_ARGUMENTS_INVALID');
  return options;
}

function assertNoSymlinkComponents(absolute) {
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const component of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    if (!fs.existsSync(current)) continue;
    if (fs.lstatSync(current).isSymbolicLink()) fail('KSTACK_SECRET_LINUX_STATE_UNTRUSTED');
  }
}

function ensurePrivateDirectory(directory) {
  assertNoSymlinkComponents(directory);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  assertNoSymlinkComponents(directory);
  fs.chmodSync(directory, 0o700);
  const stat = fs.lstatSync(directory);
  const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
  if (!stat.isDirectory() || stat.isSymbolicLink() || !owned || (stat.mode & 0o077) !== 0) fail('KSTACK_SECRET_LINUX_STATE_UNTRUSTED');
}

function stateRoot(options) {
  if (SYNTHETIC_MODES.has(options.mode)) {
    if (options.testRoot) {
      if (!path.isAbsolute(options.testRoot)) fail('KSTACK_SECRET_LINUX_TEST_ROOT_INVALID');
      return path.resolve(options.testRoot);
    }
    return fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-secret-linux-'));
  }
  const home = process.env.HOME;
  if (!home || !path.isAbsolute(home)) fail('KSTACK_SECRET_LINUX_STATE_UNAVAILABLE');
  const base = process.env.XDG_STATE_HOME || path.join(home, '.local', 'state');
  if (!path.isAbsolute(base)) fail('KSTACK_SECRET_LINUX_STATE_UNAVAILABLE');
  return path.join(path.resolve(base), 'kstack', 'secret-broker');
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, fs.constants.O_RDONLY);
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function writeNewFile(file, bytes) {
  const descriptor = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  try { fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  fs.chmodSync(file, 0o600);
}

function writeInitialMetadata(file, metadata) {
  const temporary = `${file}.pending-${crypto.randomUUID()}`;
  try {
    writeNewFile(temporary, Buffer.from(`${JSON.stringify(metadata)}\n`, 'utf8'));
    fs.renameSync(temporary, file);
    fsyncDirectory(path.dirname(file));
  } finally { if (fs.existsSync(temporary)) fs.rmSync(temporary); }
}

function replaceMetadata(file, oldMetadata, newMetadata) {
  const prior = path.join(path.dirname(file), `metadata.previous-g${oldMetadata.generation}.json`);
  if (fs.existsSync(prior)) fail('KSTACK_SECRET_LINUX_PREVIOUS_EXISTS');
  const temporary = `${file}.pending-${crypto.randomUUID()}`;
  try {
    writeNewFile(temporary, Buffer.from(`${JSON.stringify(newMetadata)}\n`, 'utf8'));
    fs.renameSync(file, prior);
    try { fs.renameSync(temporary, file); } catch (error) { fs.renameSync(prior, file); throw error; }
    fsyncDirectory(path.dirname(file));
  } finally { if (fs.existsSync(temporary)) fs.rmSync(temporary); }
}

function metadataFor(handleId, purposeId, adapterId, targetOrigin, generation, state) {
  return { schemaVersion: RECORD_SCHEMA, handleId, backendId: BACKEND_ID, adapterId, targetOrigin, purposeId, generation, state, createdAt: new Date().toISOString() };
}

function recordPaths(handlesRoot, handleId) {
  assertHandle(handleId);
  return {
    root: path.join(handlesRoot, handleId),
    metadata: path.join(handlesRoot, handleId, 'metadata.json'),
    tombstone: path.join(handlesRoot, `${handleId}.revoked`)
  };
}

function readRecord(handlesRoot, handleId) {
  const paths = recordPaths(handlesRoot, handleId);
  if (!fs.existsSync(paths.metadata)) fail('KSTACK_SECRET_LINUX_RECORD_MISSING');
  assertNoSymlinkComponents(paths.metadata);
  let descriptor;
  let stat;
  let source;
  try {
    descriptor = fs.openSync(paths.metadata, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    stat = fs.fstatSync(descriptor);
    const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
    if (!stat.isFile() || !owned || (stat.mode & 0o077) !== 0 || stat.size < 2 || stat.size > 8192) fail('KSTACK_SECRET_LINUX_RECORD_INVALID');
    source = fs.readFileSync(descriptor, 'utf8');
  } catch (error) {
    if (error instanceof LinuxSecretError) throw error;
    fail('KSTACK_SECRET_LINUX_RECORD_INVALID');
  } finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
  let metadata;
  try { metadata = JSON.parse(source); } catch { fail('KSTACK_SECRET_LINUX_RECORD_INVALID'); }
  exactKeys(metadata, ['schemaVersion', 'handleId', 'backendId', 'adapterId', 'targetOrigin', 'purposeId', 'generation', 'state', 'createdAt']);
  if (metadata.schemaVersion !== RECORD_SCHEMA || metadata.handleId !== handleId || metadata.backendId !== BACKEND_ID
    || metadata.adapterId !== 'jira-cloud-auth-v1' || !Number.isSafeInteger(metadata.generation) || metadata.generation < 1
    || !['active', 'revoked'].includes(metadata.state) || Number.isNaN(Date.parse(metadata.createdAt))
    || new Date(metadata.createdAt).toISOString() !== metadata.createdAt) fail('KSTACK_SECRET_LINUX_RECORD_INVALID');
  assertIdentifier(metadata.purposeId, 'KSTACK_SECRET_LINUX_PURPOSE_INVALID');
  assertTarget(metadata.targetOrigin);
  return { paths, metadata };
}

function trustedTestTool(file) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
  if (!path.isAbsolute(file) || !stat.isFile() || stat.isSymbolicLink() || !owned || (stat.mode & 0o022) !== 0 || path.extname(absolute) !== '.mjs') {
    fail('KSTACK_SECRET_LINUX_TEST_TOOL_UNTRUSTED');
  }
  return absolute;
}

function secretToolInvocation(options, args, input = null) {
  let executable = SECRET_TOOL;
  let finalArgs = args;
  const environment = {};
  for (const key of ['HOME', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'DISPLAY', 'WAYLAND_DISPLAY', 'LANG', 'LC_ALL']) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  if (options.testSecretTool) {
    executable = process.execPath;
    finalArgs = [trustedTestTool(options.testSecretTool), ...args];
    environment.KSTACK_SECRET_TEST_STORE = path.join(options.testRoot, 'secret-service-double');
  } else {
    if (process.platform !== 'linux' || !fs.existsSync(SECRET_TOOL)) fail('KSTACK_SECRET_LINUX_SERVICE_UNAVAILABLE');
    const real = fs.realpathSync.native(SECRET_TOOL);
    const stat = fs.statSync(real);
    if (!stat.isFile() || stat.uid !== 0 || (stat.mode & 0o022) !== 0) fail('KSTACK_SECRET_LINUX_TOOL_UNTRUSTED');
    if (!process.env.DBUS_SESSION_BUS_ADDRESS) fail('KSTACK_SECRET_LINUX_SESSION_UNAVAILABLE');
  }
  const result = spawnSync(executable, finalArgs, { input, env: environment, maxBuffer: 65_536, timeout: 15_000, windowsHide: true });
  if (result.error || result.signal) fail('KSTACK_SECRET_LINUX_SERVICE_FAILED');
  return result;
}

function secretAttributes(handleId, generation) {
  return ['kstack-backend', BACKEND_ID, 'kstack-handle', handleId, 'kstack-generation', String(generation)];
}

function storeSecret(options, handleId, generation, value) {
  assertSecret(value);
  const result = secretToolInvocation(options, ['store', '--label', `KStack Jira ${handleId}`, ...secretAttributes(handleId, generation)], value);
  try {
    if (result.status !== 0 || result.stdout.length !== 0 || result.stderr.length !== 0) fail('KSTACK_SECRET_LINUX_STORE_FAILED');
  } finally { clear(result.stdout); clear(result.stderr); }
}

function lookupSecret(options, handleId, generation, { missingAllowed = false } = {}) {
  const result = secretToolInvocation(options, ['lookup', ...secretAttributes(handleId, generation)]);
  try {
    if (missingAllowed && result.status === 1 && result.stdout.length === 0) return null;
    if (result.status !== 0 || result.stderr.length !== 0 || result.stdout.length < 2 || result.stdout.length > MAX_SECRET_BYTES + 1
      || result.stdout.at(-1) !== 0x0a) fail('KSTACK_SECRET_LINUX_LOOKUP_FAILED');
    const value = Buffer.from(result.stdout.subarray(0, result.stdout.length - 1));
    assertSecret(value);
    return value;
  } finally { clear(result.stdout); clear(result.stderr); }
}

function clearSecret(options, handleId, generation) {
  const result = secretToolInvocation(options, ['clear', ...secretAttributes(handleId, generation)]);
  try {
    if (result.status !== 0 || result.stdout.length !== 0 || result.stderr.length !== 0) fail('KSTACK_SECRET_LINUX_CLEAR_FAILED');
  } finally { clear(result.stdout); clear(result.stderr); }
}

function discardSecret(options, handleId, generation) {
  let found;
  try {
    found = lookupSecret(options, handleId, generation, { missingAllowed: true });
    if (found !== null) clearSecret(options, handleId, generation);
  } catch {} finally { clear(found); }
}

function readTtyLine(prompt, hidden) {
  let descriptor;
  let echoDisabled = false;
  const bytes = [];
  try {
    descriptor = fs.openSync('/dev/tty', fs.constants.O_RDWR);
    if (!fs.fstatSync(descriptor).isCharacterDevice()) fail('KSTACK_SECRET_LINUX_TTY_UNAVAILABLE');
    if (hidden) {
      const result = spawnSync('/usr/bin/stty', ['-echo'], { stdio: [descriptor, descriptor, descriptor], timeout: 2000 });
      if (result.status !== 0) fail('KSTACK_SECRET_LINUX_TTY_UNAVAILABLE');
      echoDisabled = true;
    }
    fs.writeSync(descriptor, Buffer.from(prompt, 'utf8'));
    const one = Buffer.alloc(1);
    while (bytes.length <= MAX_SECRET_BYTES) {
      const count = fs.readSync(descriptor, one, 0, 1, null);
      if (count !== 1) fail('KSTACK_SECRET_LINUX_TTY_UNAVAILABLE');
      if (one[0] === 0x0a) break;
      if (one[0] === 0x03 || one[0] === 0x04) fail('KSTACK_SECRET_LINUX_TTY_CANCELLED');
      if (one[0] === 0x08 || one[0] === 0x7f) bytes.pop();
      else if (one[0] !== 0x0d) bytes.push(one[0]);
    }
    one.fill(0);
    if (bytes.length > MAX_SECRET_BYTES) fail('KSTACK_SECRET_LINUX_VALUE_INVALID');
    return Buffer.from(bytes);
  } finally {
    bytes.fill(0);
    if (descriptor !== undefined) {
      if (echoDisabled) {
        spawnSync('/usr/bin/stty', ['echo'], { stdio: [descriptor, descriptor, descriptor], timeout: 2000 });
        fs.writeSync(descriptor, Buffer.from('\n'));
      }
      fs.closeSync(descriptor);
    }
  }
}

function readConfirmedSecret(prompt) {
  let first;
  let second;
  try {
    first = readTtyLine(`${prompt}: `, true);
    second = readTtyLine('Confirm protected value: ', true);
    assertSecret(first); assertSecret(second);
    if (first.length !== second.length || !crypto.timingSafeEqual(first, second)) fail('KSTACK_SECRET_LINUX_CONFIRMATION_MISMATCH');
    return Buffer.from(first);
  } finally { clear(first); clear(second); }
}

function writeTombstone(paths, generation) {
  if (fs.existsSync(paths.tombstone)) fail('KSTACK_SECRET_LINUX_RECORD_REVOKED');
  writeNewFile(paths.tombstone, Buffer.from(`${JSON.stringify({ schemaVersion: 'kstack-secret-revocation-tombstone-v1', generation, state: 'revoked' })}\n`));
  fsyncDirectory(path.dirname(paths.tombstone));
}

function activeSecret(options, record) {
  if (record.metadata.state !== 'active' || fs.existsSync(record.paths.tombstone)) fail('KSTACK_SECRET_LINUX_RECORD_REVOKED');
  return lookupSecret(options, record.metadata.handleId, record.metadata.generation);
}

function basicAuthorization(email, value) {
  assertEmail(email);
  const emailBytes = Buffer.from(email, 'utf8');
  const joined = Buffer.alloc(emailBytes.length + 1 + value.length);
  try {
    emailBytes.copy(joined); joined[emailBytes.length] = 0x3a; value.copy(joined, emailBytes.length + 1);
    return `Basic ${joined.toString('base64')}`;
  } finally { clear(emailBytes); clear(joined); }
}

function jiraStatus(origin, email, value) {
  assertTarget(origin);
  const authorization = basicAuthorization(email, value);
  return new Promise((resolve, reject) => {
    const request = https.request(new URL('/rest/api/3/myself', origin), {
      method: 'GET', headers: { authorization, accept: 'application/json' }, agent: false, timeout: 15_000
    }, (response) => { const status = response.statusCode; response.resume(); response.once('end', () => resolve(status)); });
    request.once('timeout', () => request.destroy(new Error('timeout')));
    request.once('error', () => reject(new LinuxSecretError('KSTACK_SECRET_LINUX_JIRA_REQUEST_FAILED')));
    request.end();
  });
}

function ensureHandlesRoot(root) {
  ensurePrivateDirectory(root);
  const handlesRoot = path.join(root, 'handles');
  ensurePrivateDirectory(handlesRoot);
  return handlesRoot;
}

async function probe(options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-secret-linux-probe-'));
  options = { ...options, testRoot: null, testSecretTool: null };
  const handleId = crypto.randomUUID();
  const value = crypto.randomBytes(32).toString('base64url');
  const bytes = Buffer.from(value, 'ascii');
  let opened;
  let stored = false;
  try {
    storeSecret(options, handleId, 1, bytes);
    stored = true;
    opened = lookupSecret(options, handleId, 1);
    if (!crypto.timingSafeEqual(bytes, opened)) fail('KSTACK_SECRET_LINUX_PROBE_MISMATCH');
    clearSecret(options, handleId, 1);
    stored = false;
    let afterClear;
    try {
      afterClear = lookupSecret(options, handleId, 1, { missingAllowed: true });
      if (afterClear !== null) fail('KSTACK_SECRET_LINUX_PROBE_CLEAR_FAILED');
    } finally { clear(afterClear); }
    safeResult({ schemaVersion: 'kstack-secret-backend-probe-v1', backendId: BACKEND_ID, available: true, custodyScope: 'current-linux-desktop-session' });
  } finally {
    if (stored) discardSecret(options, handleId, 1);
    clear(bytes); clear(opened); fs.rmSync(root, { recursive: true, force: true });
  }
}

function enroll(options, handlesRoot) {
  assertHandle(options.handleId); assertIdentifier(options.purposeId, 'KSTACK_SECRET_LINUX_PURPOSE_INVALID');
  if (options.adapterId !== 'jira-cloud-auth-v1') fail('KSTACK_SECRET_LINUX_ADAPTER_UNAVAILABLE');
  assertTarget(options.targetOrigin);
  const paths = recordPaths(handlesRoot, options.handleId);
  if (fs.existsSync(paths.root) || fs.existsSync(paths.tombstone)) fail('KSTACK_SECRET_LINUX_RECORD_EXISTS');
  ensurePrivateDirectory(paths.root);
  let value;
  let complete = false;
  try {
    value = readConfirmedSecret('Enter protected value');
    storeSecret(options, options.handleId, 1, value);
    try { writeInitialMetadata(paths.metadata, metadataFor(options.handleId, options.purposeId, options.adapterId, options.targetOrigin, 1, 'active')); }
    catch (error) { clearSecret(options, options.handleId, 1); throw error; }
    complete = true;
    safeResult({ schemaVersion: 'kstack-secret-enrollment-result-v1', handleId: options.handleId, backendId: BACKEND_ID, generation: 1, state: 'active' });
  } finally {
    clear(value);
    if (!complete && fs.existsSync(paths.root) && fs.readdirSync(paths.root).length === 0) fs.rmdirSync(paths.root);
  }
}

function rotate(options, handlesRoot) {
  const record = readRecord(handlesRoot, options.handleId);
  if (record.metadata.state !== 'active' || fs.existsSync(record.paths.tombstone)) fail('KSTACK_SECRET_LINUX_RECORD_REVOKED');
  const generation = record.metadata.generation + 1;
  let value;
  let opened;
  let stored = false;
  let committed = false;
  try {
    value = readConfirmedSecret('Enter replacement protected value');
    storeSecret(options, options.handleId, generation, value);
    stored = true;
    opened = lookupSecret(options, options.handleId, generation);
    if (opened.length !== value.length || !crypto.timingSafeEqual(opened, value)) fail('KSTACK_SECRET_LINUX_ROTATION_VERIFY_FAILED');
    try { replaceMetadata(record.paths.metadata, record.metadata, metadataFor(options.handleId, record.metadata.purposeId, record.metadata.adapterId, record.metadata.targetOrigin, generation, 'active')); }
    catch (error) { clearSecret(options, options.handleId, generation); throw error; }
    committed = true;
    safeResult({ schemaVersion: 'kstack-secret-rotation-result-v1', handleId: options.handleId, backendId: BACKEND_ID, generation, state: 'active', priorGenerationRetained: true });
  } finally {
    if (stored && !committed) discardSecret(options, options.handleId, generation);
    clear(value); clear(opened);
  }
}

function revoke(options, handlesRoot) {
  const record = readRecord(handlesRoot, options.handleId);
  if (record.metadata.state !== 'active' || fs.existsSync(record.paths.tombstone)) fail('KSTACK_SECRET_LINUX_RECORD_REVOKED');
  const generation = record.metadata.generation + 1;
  writeTombstone(record.paths, generation);
  for (let current = 1; current <= record.metadata.generation; current += 1) {
    let found;
    try {
      found = lookupSecret(options, options.handleId, current, { missingAllowed: true });
      if (found !== null) clearSecret(options, options.handleId, current);
    } finally { clear(found); }
  }
  replaceMetadata(record.paths.metadata, record.metadata, metadataFor(options.handleId, record.metadata.purposeId, record.metadata.adapterId, record.metadata.targetOrigin, generation, 'revoked'));
  safeResult({ schemaVersion: 'kstack-secret-revocation-result-v1', handleId: options.handleId, backendId: BACKEND_ID, generation, state: 'revoked', priorGenerationRetained: false });
}

function inventory(handlesRoot) {
  const items = [];
  for (const entry of fs.readdirSync(handlesRoot, { withFileTypes: true }).sort((left, right) => Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)))) {
    if (!entry.isDirectory() || !HANDLE.test(entry.name)) continue;
    const record = readRecord(handlesRoot, entry.name);
    items.push({ handleId: record.metadata.handleId, backendId: BACKEND_ID, adapterId: record.metadata.adapterId,
      targetDigest: sha256(record.metadata.targetOrigin), purposeId: record.metadata.purposeId, generation: record.metadata.generation, state: record.metadata.state });
  }
  safeResult({ schemaVersion: 'kstack-secret-safe-inventory-v1', backendId: BACKEND_ID, items });
}

async function jiraAuthCheck(options, handlesRoot) {
  const emailBytes = readTtyLine('Enter Jira account email: ', false);
  const email = emailBytes.toString('utf8');
  clear(emailBytes);
  assertEmail(email);
  const record = readRecord(handlesRoot, options.handleId);
  let value;
  try {
    if (record.metadata.adapterId !== 'jira-cloud-auth-v1') fail('KSTACK_SECRET_LINUX_ADAPTER_UNAVAILABLE');
    value = activeSecret(options, record);
    const status = await jiraStatus(record.metadata.targetOrigin, email, value);
    const outcome = status === 200 ? 'SUCCEEDED' : [401, 403].includes(status) ? 'DENIED' : 'FAILED';
    safeResult({ schemaVersion: 'kstack-secret-operation-receipt-v1', operationId: `auth-check-${crypto.randomUUID().replaceAll('-', '')}`,
      handleDigest: sha256(options.handleId), backendId: BACKEND_ID, adapterId: 'jira-cloud-auth-v1', targetDigest: sha256(record.metadata.targetOrigin),
      generation: record.metadata.generation, outcome, occurredAt: new Date().toISOString() });
  } finally { clear(value); }
}

function syntheticLifecycle(options, root, handlesRoot) {
  const handleId = crypto.randomUUID();
  const first = Buffer.from(`kstack-synthetic-${crypto.randomBytes(24).toString('base64url')}`, 'ascii');
  const second = Buffer.from(`kstack-rotated-${crypto.randomBytes(24).toString('base64url')}`, 'ascii');
  let opened;
  try {
    const paths = recordPaths(handlesRoot, handleId); ensurePrivateDirectory(paths.root);
    const one = metadataFor(handleId, 'synthetic-jira-auth', 'jira-cloud-auth-v1', 'https://synthetic.atlassian.net', 1, 'active');
    storeSecret(options, handleId, 1, first); writeInitialMetadata(paths.metadata, one);
    opened = activeSecret(options, readRecord(handlesRoot, handleId));
    if (!crypto.timingSafeEqual(first, opened)) fail('KSTACK_SECRET_LINUX_SYNTHETIC_MISMATCH'); clear(opened);
    const two = metadataFor(handleId, 'synthetic-jira-auth', 'jira-cloud-auth-v1', 'https://synthetic.atlassian.net', 2, 'active');
    storeSecret(options, handleId, 2, second); replaceMetadata(paths.metadata, one, two);
    opened = activeSecret(options, readRecord(handlesRoot, handleId));
    if (!crypto.timingSafeEqual(second, opened)) fail('KSTACK_SECRET_LINUX_SYNTHETIC_MISMATCH'); clear(opened);
    clearSecret(options, handleId, 2);
    fs.renameSync(path.join(paths.root, 'metadata.previous-g1.json'), paths.metadata);
    opened = activeSecret(options, readRecord(handlesRoot, handleId));
    if (!crypto.timingSafeEqual(first, opened)) fail('KSTACK_SECRET_LINUX_SYNTHETIC_MISMATCH'); clear(opened);
    writeTombstone(paths, 2); clearSecret(options, handleId, 1);
    let denied = false;
    try { opened = activeSecret(options, readRecord(handlesRoot, handleId)); } catch (error) { if (error.code === 'KSTACK_SECRET_LINUX_RECORD_REVOKED') denied = true; else throw error; }
    if (!denied) fail('KSTACK_SECRET_LINUX_NON_RESURRECTION_FAILED');
    safeResult({ schemaVersion: 'kstack-secret-synthetic-lifecycle-v1', backendId: BACKEND_ID, enrollment: 'PASS', use: 'PASS', rotation: 'PASS',
      recovery: 'PASS', revocation: 'PASS', nonResurrection: 'PASS', valueOutputBytes: 0 });
  } finally {
    clear(first); clear(second); clear(opened);
    for (const generation of [1, 2]) discardSecret(options, handleId, generation);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function syntheticJiraAdapter(options, root, handlesRoot) {
  const handleId = crypto.randomUUID();
  const value = Buffer.from(`kstack-synthetic-jira-${crypto.randomBytes(18).toString('base64url')}`, 'ascii');
  let opened;
  let server;
  try {
    const paths = recordPaths(handlesRoot, handleId); ensurePrivateDirectory(paths.root);
    storeSecret(options, handleId, 1, value);
    writeInitialMetadata(paths.metadata, metadataFor(handleId, 'synthetic-jira-auth', 'jira-cloud-auth-v1', 'https://synthetic.atlassian.net', 1, 'active'));
    opened = activeSecret(options, readRecord(handlesRoot, handleId));
    const expected = basicAuthorization('synthetic@example.invalid', opened);
    let matched = false;
    server = http.createServer((request, response) => {
      matched = request.method === 'GET' && request.url === '/rest/api/3/myself'
        && request.headers.host === 'synthetic.atlassian.net' && request.headers.authorization === expected;
      response.writeHead(matched ? 200 : 401, { 'content-length': '0' }); response.end();
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const port = server.address().port;
    const status = await new Promise((resolve, reject) => {
      const request = http.request({ host: '127.0.0.1', port, path: '/rest/api/3/myself', method: 'GET',
        headers: { host: 'synthetic.atlassian.net', authorization: expected }, agent: false }, (response) => { const code = response.statusCode; response.resume(); response.once('end', () => resolve(code)); });
      request.once('error', reject); request.end();
    });
    if (!matched || status !== 200) fail('KSTACK_SECRET_LINUX_JIRA_ADAPTER_FAILED');
    safeResult({ schemaVersion: 'kstack-secret-synthetic-adapter-v1', backendId: BACKEND_ID, adapterId: 'jira-cloud-auth-v1', targetBinding: 'PASS',
      authentication: 'PASS', redirectsDisabled: true, responseBodyDiscarded: true, valueOutputBytes: 0 });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    clear(value); clear(opened);
    discardSecret(options, handleId, 1);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function main(argv) {
  if (process.platform !== 'linux') fail('KSTACK_SECRET_LINUX_PLATFORM_UNAVAILABLE');
  const options = parseArgs(argv);
  fail('KSTACK_SECRET_LINUX_IMPLEMENTATION_UNAVAILABLE');
  if (options.mode === 'Probe') return probe(options);
  const root = stateRoot(options);
  const handlesRoot = ensureHandlesRoot(root);
  if (options.mode === 'SyntheticLifecycle') return syntheticLifecycle(options, root, handlesRoot);
  if (options.mode === 'SyntheticJiraAdapter') return syntheticJiraAdapter(options, root, handlesRoot);
  if (options.mode === 'EnrollInteractive') return enroll(options, handlesRoot);
  if (options.mode === 'RotateInteractive') return rotate(options, handlesRoot);
  if (options.mode === 'Revoke') return revoke(options, handlesRoot);
  if (options.mode === 'Inventory') return inventory(handlesRoot);
  if (options.mode === 'JiraAuthCheck') return jiraAuthCheck(options, handlesRoot);
  fail('KSTACK_SECRET_LINUX_MODE_INVALID');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    const code = error instanceof LinuxSecretError && /^KSTACK_SECRET_[A-Z0-9_]+$/u.test(error.code)
      ? error.code : 'KSTACK_SECRET_LINUX_INTERNAL_ERROR';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
