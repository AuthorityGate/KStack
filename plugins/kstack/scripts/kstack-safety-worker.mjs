#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const INPUT_LIMIT = 128 * 1024;
const CREDENTIAL_LIMIT = 16 * 1024;
const GIT_OUTPUT_LIMIT = 64 * 1024;
const GIT_TIMEOUT_MS = 90_000;
const ZERO_OID = /^0{40}(?:0{24})?$/u;
const OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const SAFE_REF = /^refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9._\/-]*$/u;
const SAFE_HEAD_REF = /^refs\/heads\/[A-Za-z0-9][A-Za-z0-9._\/-]*$/u;
const SAFE_CODE = /^KSG-[A-Z0-9-]{1,80}$/u;
const SAFE_IDENT = /^([^<>\u0000-\u001f\u007f]{1,200}) <([^<>\s\u0000-\u001f\u007f]{1,254})>$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const ASKPASS_SOURCE = fileURLToPath(new URL('./kstack-git-askpass.mjs', import.meta.url));
const ASKPASS_SHA256 = '90b104f4ea1486381544f525cf23ce46c72ce8b6ccc6edc630f3039ccb2dbc8d';

class WorkerError extends Error {
  constructor(code, { ambiguous = false } = {}) { super(SAFE_CODE.test(code) ? code : 'KSG-EXECUTE-FAILED-001'); this.code = this.message; this.ambiguous = ambiguous; }
}
function fail(code, options) { throw new WorkerError(code, options); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exactKeys(value, keys) { return plain(value) && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0'); }
function inside(root, candidate) { const relative = path.relative(root, candidate); return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)); }

function closedEnvironment(home, extra = {}) {
  return {
    PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', HOME: home, XDG_CONFIG_HOME: home,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0',
    GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', ...extra
  };
}

async function privateTemporaryDirectory() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = path.join(os.tmpdir(), `kstack-safety-worker-${crypto.randomBytes(16).toString('hex')}`);
    try {
      await fsp.mkdir(candidate, { mode: 0o700 });
      const state = await fsp.lstat(candidate);
      if (!state.isDirectory() || state.isSymbolicLink() || (state.mode & 0o777) !== 0o700 || (typeof process.getuid === 'function' && state.uid !== process.getuid())) fail('KSG-WORKER-ISOLATION-001');
      return candidate;
    } catch (error) {
      if (error instanceof WorkerError) throw error;
      if (error?.code !== 'EEXIST') fail('KSG-WORKER-ISOLATION-001');
    }
  }
  fail('KSG-WORKER-ISOLATION-001');
}

async function readInput() {
  const chunks = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    total += chunk.length;
    if (total > INPUT_LIMIT) fail('KSG-WORKER-PROTOCOL-001');
    chunks.push(chunk);
  }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { fail('KSG-WORKER-PROTOCOL-001'); }
}

async function descriptorRealpath(handle) {
  if (process.platform === 'linux') return fsp.realpath(`/proc/self/fd/${handle.fd}`);
  if (process.platform === 'darwin') return fsp.realpath(`/dev/fd/${handle.fd}`);
  fail('KSG-WORKER-ISOLATION-001');
}

function unchanged(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs;
}

async function readCredential(file, repoRoot) {
  if (!path.isAbsolute(file) || fs.constants.O_NOFOLLOW === undefined) fail('KSG-CREDENTIAL-STORE-UNAVAILABLE-001');
  let handle;
  let bytes;
  try {
    const beforeLink = await fsp.lstat(file);
    if (beforeLink.isSymbolicLink() || !beforeLink.isFile()) fail('KSG-CREDENTIAL-STORE-UNTRUSTED-001');
    handle = await fsp.open(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | (fs.constants.O_NONBLOCK ?? 0));
    const before = await handle.stat();
    const real = await descriptorRealpath(handle);
    const currentLink = await fsp.lstat(file);
    const currentPath = await fsp.stat(await fsp.realpath(file));
    if (!before.isFile() || currentLink.isSymbolicLink() || !currentLink.isFile() || before.dev !== currentPath.dev || before.ino !== currentPath.ino || currentLink.dev !== before.dev || currentLink.ino !== before.ino) fail('KSG-CREDENTIAL-STORE-UNTRUSTED-001');
    if (typeof process.getuid !== 'function' || before.uid !== process.getuid() || before.nlink !== 1 || (before.mode & 0o777) !== 0o600 || before.size < 2 || before.size > CREDENTIAL_LIMIT || inside(repoRoot, real)) fail('KSG-CREDENTIAL-STORE-UNTRUSTED-001');
    bytes = Buffer.alloc(CREDENTIAL_LIMIT + 1);
    const read = await handle.read(bytes, 0, bytes.length, 0);
    const after = await handle.stat();
    const afterLink = await fsp.lstat(file);
    if (read.bytesRead !== before.size || read.bytesRead > CREDENTIAL_LIMIT || !unchanged(before, after) || afterLink.isSymbolicLink() || afterLink.dev !== after.dev || afterLink.ino !== after.ino) fail('KSG-CREDENTIAL-STORE-UNTRUSTED-001');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, read.bytesRead));
    let value;
    try { value = JSON.parse(text); } catch { fail('KSG-CREDENTIAL-STORE-MALFORMED-001'); }
    if (!exactKeys(value, ['version', 'kind', 'remoteUrl', 'username', 'token']) || value.version !== 1 || value.kind !== 'https-token' || typeof value.remoteUrl !== 'string' || typeof value.username !== 'string' || typeof value.token !== 'string' || value.username.length < 1 || Buffer.byteLength(value.username, 'utf8') > 256 || value.token.length < 1 || Buffer.byteLength(value.token, 'utf8') > 4_096 || /[\u0000-\u001f\u007f]/u.test(value.username) || /[\u0000-\u001f\u007f]/u.test(value.token)) fail('KSG-CREDENTIAL-STORE-MALFORMED-001');
    return value;
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    fail(error?.code === 'ENOENT' ? 'KSG-CREDENTIAL-STORE-UNAVAILABLE-001' : 'KSG-CREDENTIAL-STORE-UNTRUSTED-001');
  } finally {
    bytes?.fill(0);
    await handle?.close().catch(() => {});
  }
}

function validateRemote(remoteUrl, targetId) {
  let parsed;
  try { parsed = new URL(remoteUrl); } catch { fail('KSG-CREDENTIAL-TARGET-001'); }
  const loopbackHttp = parsed.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (targetId !== remoteUrl || parsed.href !== remoteUrl || (parsed.protocol !== 'https:' && !loopbackHttp) || parsed.username || parsed.password || parsed.search || parsed.hash) fail('KSG-CREDENTIAL-TARGET-001');
  return parsed.protocol.slice(0, -1);
}

function validateRequest(request) {
  if (!exactKeys(request, ['version', 'action', 'sessionId', 'cellKey', 'root', 'targetId', 'targetFingerprintDigest', 'policyGeneration', 'targetGeneration', 'certificateDigest', 'payload']) || request.version !== 3 || !['git-push', 'git-commit'].includes(request.action) || typeof request.root !== 'string' || !path.isAbsolute(request.root) || typeof request.targetId !== 'string' || !plain(request.payload)) fail('KSG-WORKER-PROTOCOL-001');
  if (request.action === 'git-push') {
    if (!exactKeys(request.payload, ['updates', 'atomic']) || !Array.isArray(request.payload.updates) || request.payload.updates.length < 1 || request.payload.updates.length > 4 || typeof request.payload.atomic !== 'boolean' || (request.payload.updates.length > 1 && !request.payload.atomic)) fail('KSG-WORKER-PROTOCOL-001');
    for (const update of request.payload.updates) if (!exactKeys(update, ['sourceOid', 'expectedRemoteOldOid', 'destinationRef']) || (!OID.test(update.sourceOid) && !ZERO_OID.test(update.sourceOid)) || (!OID.test(update.expectedRemoteOldOid) && !ZERO_OID.test(update.expectedRemoteOldOid)) || !SAFE_REF.test(update.destinationRef) || update.destinationRef.includes('..') || update.destinationRef.endsWith('.lock')) fail('KSG-WORKER-PROTOCOL-001');
    return;
  }
  if (!exactKeys(request.payload, ['message', 'author', 'committer', 'headOid', 'headTreeOid', 'proposedTreeOid']) || !SAFE_HEAD_REF.test(request.targetId) || request.targetId.includes('..') || request.targetId.endsWith('.lock') || typeof request.payload.message !== 'string' || request.payload.message.length < 1 || Buffer.byteLength(request.payload.message, 'utf8') > 65_536 || CONTROL_OR_BIDI.test(request.payload.message) || !SAFE_IDENT.test(request.payload.author) || !SAFE_IDENT.test(request.payload.committer) || !OID.test(request.payload.headOid) || !OID.test(request.payload.headTreeOid) || !OID.test(request.payload.proposedTreeOid)) fail('KSG-WORKER-PROTOCOL-001');
}

async function validateGitBinary(gitBinary) {
  let state;
  let real;
  try { state = await fsp.stat(gitBinary); real = await fsp.realpath(gitBinary); } catch { fail('KSG-WORKER-ISOLATION-001'); }
  if (!state.isFile() || real !== gitBinary || (state.mode & 0o022) !== 0 || (typeof process.getuid === 'function' && state.uid !== 0)) fail('KSG-WORKER-ISOLATION-001');
}

function gitScalar(gitBinary, args, { cwd, environment, input, ambiguous = false, maximum = 8_192, code = 'KSG-GIT-EXECUTE-001' } = {}) {
  const result = spawnSync(gitBinary, args, { cwd, env: environment, input, shell: false, encoding: 'utf8', timeout: 10_000, maxBuffer: maximum, windowsHide: true });
  if (result.error || result.status !== 0 || result.signal !== null) fail(code, { ambiguous });
  const value = result.stdout.trim();
  if (Buffer.byteLength(value, 'utf8') > maximum) fail(code, { ambiguous });
  return value;
}

async function materializeAskpass(destination) {
  let bytes;
  let executable;
  try { bytes = await fsp.readFile(ASKPASS_SOURCE); } catch { fail('KSG-WORKER-ISOLATION-001'); }
  try {
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== ASKPASS_SHA256) fail('KSG-WORKER-ISOLATION-001');
    const portableShebang = Buffer.from('#!/usr/bin/env node\n');
    if (!path.isAbsolute(process.execPath) || !bytes.subarray(0, portableShebang.length).equals(portableShebang)) fail('KSG-WORKER-ISOLATION-001');
    const interpreter = path.join(path.dirname(destination), 'node');
    await fsp.symlink(process.execPath, interpreter);
    if ((await fsp.realpath(interpreter)) !== await fsp.realpath(process.execPath)) fail('KSG-WORKER-ISOLATION-001');
    executable = Buffer.concat([Buffer.from(`#!${interpreter}\n`), bytes.subarray(portableShebang.length)]);
    await fsp.writeFile(destination, executable, { mode: 0o700, flag: 'wx' });
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    fail('KSG-WORKER-ISOLATION-001');
  } finally {
    bytes.fill(0);
    executable?.fill(0);
  }
}

async function startAskpassServer(socketPath, credential) {
  let requests = 0;
  let passwordRequests = 0;
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    const chunks = [];
    let size = 0;
    socket.on('data', (chunk) => { size += chunk.length; if (size > 32) socket.destroy(); else chunks.push(chunk); });
    socket.on('end', () => {
      requests += 1;
      const kind = Buffer.concat(chunks).toString('ascii');
      const value = kind === 'username' ? credential.username : kind === 'password' ? credential.token : null;
      if (kind === 'password') passwordRequests += 1;
      if (requests > 8 || value === null) socket.destroy();
      else socket.end(value);
    });
    socket.on('error', () => {});
  });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
    await fsp.chmod(socketPath, 0o600);
    const socketState = await fsp.lstat(socketPath);
    if (!socketState.isSocket() || (socketState.mode & 0o777) !== 0o600 || (typeof process.getuid === 'function' && socketState.uid !== process.getuid())) fail('KSG-WORKER-ISOLATION-001');
    return { server, sockets, passwordRequests: () => passwordRequests };
  } catch (error) {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
    if (error instanceof WorkerError) throw error;
    fail('KSG-WORKER-ISOLATION-001');
  }
}

function runGit(gitBinary, args, environment, root) {
  return new Promise((resolve) => {
    let child;
    let spawned = false;
    try { child = spawn(gitBinary, args, { cwd: root, env: environment, shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); }
    catch { resolve({ spawned: false, ok: false }); return; }
    const output = { bytes: 0, overflow: false };
    const collect = (stream) => stream.on('data', (chunk) => { output.bytes += chunk.length; if (output.bytes > GIT_OUTPUT_LIMIT) { output.overflow = true; child.kill('SIGKILL'); } });
    collect(child.stdout); collect(child.stderr);
    child.once('spawn', () => { spawned = true; });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, GIT_TIMEOUT_MS);
    child.once('error', () => { clearTimeout(timer); resolve({ spawned: false, ok: false }); });
    child.once('close', (status, signal) => { clearTimeout(timer); resolve({ spawned, ok: status === 0 && signal === null && !timedOut && !output.overflow }); });
  });
}

async function executePush(envelope) {
  if (!exactKeys(envelope, ['version', 'request', 'credentialPath', 'gitBinary']) || envelope.version !== 1 || typeof envelope.gitBinary !== 'string' || !path.isAbsolute(envelope.gitBinary)) fail('KSG-WORKER-PROTOCOL-001');
  validateRequest(envelope.request);
  await validateGitBinary(envelope.gitBinary);
  const root = path.resolve(envelope.request.root);
  let repoReal;
  try { repoReal = await fsp.realpath(root); } catch { fail('KSG-GIT-EXECUTE-001'); }
  if (repoReal !== root) fail('KSG-GIT-EXECUTE-001');
  const temporary = await privateTemporaryDirectory();
  const askpass = path.join(temporary, 'askpass.mjs');
  const socketPath = path.join(temporary, 'credential.sock');
  const isolatedGit = path.join(temporary, 'repository.git');
  let credential;
  let askpassServer;
  try {
    const inspectionEnvironment = closedEnvironment(temporary);
    const inspection = spawnSync(envelope.gitBinary, ['--no-pager', '--no-replace-objects', '-C', repoReal, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: temporary, env: inspectionEnvironment, shell: false, encoding: 'utf8', timeout: 10_000, maxBuffer: 8_192, windowsHide: true });
    if (inspection.error || inspection.status !== 0 || inspection.signal !== null) fail('KSG-GIT-EXECUTE-001');
    let commonDirectory;
    let sourceObjects;
    try { commonDirectory = await fsp.realpath(inspection.stdout.trim()); sourceObjects = await fsp.realpath(path.join(commonDirectory, 'objects')); } catch { fail('KSG-GIT-EXECUTE-001'); }
    const alternates = path.join(sourceObjects, 'info', 'alternates');
    if (!(await fsp.stat(sourceObjects)).isDirectory() || fs.existsSync(alternates)) fail('KSG-GIT-EXECUTE-001');
    await fsp.mkdir(path.join(isolatedGit, 'objects', 'info'), { recursive: true, mode: 0o700 });
    await fsp.mkdir(path.join(isolatedGit, 'objects', 'pack'), { recursive: true, mode: 0o700 });
    await fsp.mkdir(path.join(isolatedGit, 'refs', 'heads'), { recursive: true, mode: 0o700 });
    await fsp.mkdir(path.join(isolatedGit, 'refs', 'tags'), { recursive: true, mode: 0o700 });
    await fsp.writeFile(path.join(isolatedGit, 'HEAD'), 'ref: refs/heads/main\n', { mode: 0o600, flag: 'wx' });
    await fsp.writeFile(path.join(isolatedGit, 'config'), '[core]\n\trepositoryformatversion = 0\n\tbare = true\n', { mode: 0o600, flag: 'wx' });
    credential = await readCredential(envelope.credentialPath, repoReal);
    const protocol = validateRemote(credential.remoteUrl, envelope.request.targetId);
    await materializeAskpass(askpass);
    askpassServer = await startAskpassServer(socketPath, credential);
    const environment = closedEnvironment(temporary, { GIT_ASKPASS: askpass, KSTACK_ASKPASS_SOCKET: socketPath, GIT_OBJECT_DIRECTORY: sourceObjects });
    const exactHttp = `http.${credential.remoteUrl}`;
    const args = [
      '--no-pager', '--no-replace-objects', `--git-dir=${isolatedGit}`,
      '-c', 'core.hooksPath=/dev/null', '-c', 'credential.helper=', '-c', 'credential.useHttpPath=true',
      '-c', 'http.followRedirects=false', '-c', 'http.proxy=', '-c', `${exactHttp}.followRedirects=false`,
      '-c', `${exactHttp}.proxy=`, '-c', `${exactHttp}.extraHeader=`, '-c', `${exactHttp}.cookieFile=`,
      '-c', `${exactHttp}.saveCookies=false`, '-c', `${exactHttp}.sslVerify=true`,
      '-c', 'protocol.allow=never', '-c', `protocol.${protocol}.allow=always`,
      '-c', `url.${credential.remoteUrl}.insteadOf=${credential.remoteUrl}`,
      'push', '--porcelain', '--no-verify', ...(envelope.request.payload.atomic ? ['--atomic'] : []),
      ...envelope.request.payload.updates.map((update) => `--force-with-lease=${update.destinationRef}:${update.expectedRemoteOldOid}`),
      '--', credential.remoteUrl,
      ...envelope.request.payload.updates.map((update) => `${ZERO_OID.test(update.sourceOid) ? '' : update.sourceOid}:${update.destinationRef}`)
    ];
    const result = await runGit(envelope.gitBinary, args, environment, temporary);
    if (!result.ok) fail('KSG-GIT-PUSH-FAILED-001', { ambiguous: result.spawned });
    if (askpassServer.passwordRequests() < 1) fail('KSG-CREDENTIAL-NOT-USED-001', { ambiguous: true });
    return { action: 'git-push', outcome: 'pushed', updateCount: envelope.request.payload.updates.length, destinationRefs: envelope.request.payload.updates.map((update) => update.destinationRef) };
  } finally {
    if (credential) { credential.username = ''; credential.token = ''; }
    for (const socket of askpassServer?.sockets ?? []) socket.destroy();
    await new Promise((resolve) => askpassServer?.server.close(resolve) ?? resolve());
    await fsp.rm(temporary, { recursive: true, force: true }).catch(() => {});
  }
}

async function executeCommit(envelope) {
  if (!exactKeys(envelope, ['version', 'request', 'gitBinary']) || envelope.version !== 1 || typeof envelope.gitBinary !== 'string' || !path.isAbsolute(envelope.gitBinary)) fail('KSG-WORKER-PROTOCOL-001');
  validateRequest(envelope.request);
  await validateGitBinary(envelope.gitBinary);
  const root = path.resolve(envelope.request.root);
  let repoReal;
  try { repoReal = await fsp.realpath(root); } catch { fail('KSG-GIT-EXECUTE-001'); }
  if (repoReal !== root) fail('KSG-GIT-EXECUTE-001');
  const temporary = await privateTemporaryDirectory();
  try {
    const environment = closedEnvironment(temporary);
    const topLevel = gitScalar(envelope.gitBinary, ['--no-pager', '--no-replace-objects', '-C', repoReal, 'rev-parse', '--show-toplevel'], { cwd: temporary, environment });
    const gitDirectoryText = gitScalar(envelope.gitBinary, ['--no-pager', '--no-replace-objects', '-C', repoReal, 'rev-parse', '--path-format=absolute', '--git-dir'], { cwd: temporary, environment });
    const commonDirectoryText = gitScalar(envelope.gitBinary, ['--no-pager', '--no-replace-objects', '-C', repoReal, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: temporary, environment });
    let gitDirectory;
    let commonDirectory;
    try { gitDirectory = await fsp.realpath(gitDirectoryText); commonDirectory = await fsp.realpath(commonDirectoryText); } catch { fail('KSG-GIT-EXECUTE-001'); }
    if (topLevel !== repoReal || gitDirectory !== commonDirectory || inside(repoReal, commonDirectory) === false || gitScalar(envelope.gitBinary, [`--git-dir=${commonDirectory}`, 'rev-parse', '--is-bare-repository'], { cwd: temporary, environment }) !== 'false') fail('KSG-GIT-EXECUTE-001');
    const sourceObjects = await fsp.realpath(path.join(commonDirectory, 'objects')).catch(() => null);
    if (!sourceObjects || !(await fsp.stat(sourceObjects)).isDirectory() || fs.existsSync(path.join(sourceObjects, 'info', 'alternates'))) fail('KSG-GIT-EXECUTE-001');
    const gitArgs = ['--no-pager', '--no-replace-objects', `--git-dir=${commonDirectory}`, `--work-tree=${repoReal}`];
    const headRef = gitScalar(envelope.gitBinary, [...gitArgs, 'symbolic-ref', '--quiet', 'HEAD'], { cwd: temporary, environment, code: 'KSG-GIT-COMMIT-FAILED-001' });
    const headOid = gitScalar(envelope.gitBinary, [...gitArgs, 'rev-parse', '--verify', 'HEAD'], { cwd: temporary, environment, code: 'KSG-GIT-COMMIT-FAILED-001' });
    const headTreeOid = gitScalar(envelope.gitBinary, [...gitArgs, 'rev-parse', '--verify', 'HEAD^{tree}'], { cwd: temporary, environment, code: 'KSG-GIT-COMMIT-FAILED-001' });
    const proposedType = gitScalar(envelope.gitBinary, [...gitArgs, 'cat-file', '-t', envelope.request.payload.proposedTreeOid], { cwd: temporary, environment, code: 'KSG-GIT-COMMIT-FAILED-001' });
    const indexTreeOid = gitScalar(envelope.gitBinary, [...gitArgs, 'write-tree'], { cwd: temporary, environment, code: 'KSG-GIT-COMMIT-FAILED-001' });
    if (headRef !== envelope.request.targetId || headOid !== envelope.request.payload.headOid || headTreeOid !== envelope.request.payload.headTreeOid || proposedType !== 'tree' || indexTreeOid !== envelope.request.payload.proposedTreeOid) fail('KSG-GIT-COMMIT-FAILED-001');
    const author = SAFE_IDENT.exec(envelope.request.payload.author);
    const committer = SAFE_IDENT.exec(envelope.request.payload.committer);
    const identityEnvironment = closedEnvironment(temporary, {
      GIT_AUTHOR_NAME: author[1], GIT_AUTHOR_EMAIL: author[2],
      GIT_COMMITTER_NAME: committer[1], GIT_COMMITTER_EMAIL: committer[2]
    });
    const commitOid = gitScalar(envelope.gitBinary, [...gitArgs, '-c', 'commit.gpgSign=false', 'commit-tree', envelope.request.payload.proposedTreeOid, '-p', envelope.request.payload.headOid], { cwd: temporary, environment: identityEnvironment, input: `${envelope.request.payload.message}\n`, code: 'KSG-GIT-COMMIT-FAILED-001' });
    if (!OID.test(commitOid)) fail('KSG-GIT-COMMIT-FAILED-001');
    gitScalar(envelope.gitBinary, [...gitArgs, 'update-ref', '--no-deref', '-m', 'commit: KStack safety broker', envelope.request.targetId, commitOid, envelope.request.payload.headOid], { cwd: temporary, environment: identityEnvironment, ambiguous: true, code: 'KSG-GIT-COMMIT-FAILED-001' });
    return { action: 'git-commit', outcome: 'committed', commitOid, headRef: envelope.request.targetId };
  } finally {
    await fsp.rm(temporary, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  if (process.env.KSTACK_SAFETY_WORKER !== '1') fail('KSG-WORKER-ISOLATION-001');
  const envelope = await readInput();
  const receipt = envelope?.request?.action === 'git-commit' ? await executeCommit(envelope) : await executePush(envelope);
  process.stdout.write(`${JSON.stringify({ version: 1, ok: true, workerPid: process.pid, receipt })}\n`);
}

main().catch((error) => {
  const code = error instanceof WorkerError ? error.code : 'KSG-EXECUTE-FAILED-001';
  const ambiguous = error instanceof WorkerError && error.ambiguous === true;
  process.stdout.write(`${JSON.stringify({ version: 1, ok: false, workerPid: process.pid, code, ambiguous })}\n`);
});
