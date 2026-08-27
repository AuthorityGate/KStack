import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUILD_TIMEOUT_MS = 300_000;
export const BUILD_STREAM_MAX_BYTES = 1_048_576;

function collect(stream, limit, terminate) {
  const chunks = [];
  let length = 0;
  let overflow = false;
  stream.on('data', (chunk) => {
    if (overflow) return;
    const remaining = limit - length;
    if (chunk.length > remaining) {
      if (remaining > 0) chunks.push(chunk.subarray(0, remaining));
      overflow = true;
      terminate();
      return;
    }
    chunks.push(chunk);
    length += chunk.length;
  });
  return { bytes: () => Buffer.concat(chunks), overflow: () => overflow };
}

function chmodTree(root) {
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw new Error('snapshot-invalid');
    fs.chmodSync(current, stat.isDirectory() ? 0o700 : 0o600);
    if (stat.isDirectory()) for (const name of fs.readdirSync(current)) stack.push(path.join(current, name));
  }
}

function copyTree(source, destination) {
  fs.cpSync(source, destination, { recursive: true, dereference: false, errorOnExist: true, force: false });
  chmodTree(destination);
}

export function discoverNodeHeadersRootV1(execPath = process.execPath) {
  const explicit = process.env.KSTACK_NODE_HEADERS_ROOT;
  const candidates = explicit
    ? [path.resolve(explicit)]
    : [path.resolve(path.dirname(execPath), '..'), path.resolve(path.dirname(execPath), '../..'), process.config.variables.node_prefix].filter(Boolean);
  const seen = new Set();
  for (const candidate of candidates) {
    if (!path.isAbsolute(candidate)) continue;
    const canonical = fs.realpathSync.native(candidate);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    const header = path.join(canonical, 'include', 'node', 'node_version.h');
    if (!fs.existsSync(header)) continue;
    const text = fs.readFileSync(header, 'utf8');
    const parts = ['MAJOR', 'MINOR', 'PATCH'].map((part) => text.match(new RegExp(`^#define NODE_${part}_VERSION ([0-9]+)$`, 'm'))?.[1]);
    if (parts.every(Boolean) && parts.join('.') === process.versions.node) return canonical;
  }
  throw Object.assign(new Error('node headers unavailable'), { reason: 'prerequisite-unavailable', component: 'node-headers' });
}

export async function buildCitationNativeSnapshotV1({ pluginRoot, attemptRoot, timeoutMs = BUILD_TIMEOUT_MS }) {
  const snapshot = path.join(attemptRoot, 'first-load-snapshot');
  fs.mkdirSync(snapshot, { mode: 0o700 });
  const nativeSource = path.join(snapshot, 'native', 'citation-fs-native');
  const vendorRoot = path.join(snapshot, 'vendor', 'node-gyp-11.4.2');
  const headersRoot = path.join(snapshot, 'headers');
  copyTree(path.join(pluginRoot, 'native', 'citation-fs-native'), nativeSource);
  copyTree(path.join(pluginRoot, 'vendor', 'node-gyp-11.4.2'), vendorRoot);
  const discoveredHeaders = discoverNodeHeadersRootV1();
  fs.mkdirSync(path.join(headersRoot, 'include'), { recursive: true, mode: 0o700 });
  copyTree(path.join(discoveredHeaders, 'include', 'node'), path.join(headersRoot, 'include', 'node'));
  for (const name of ['home', 'tmp', 'devdir']) fs.mkdirSync(path.join(attemptRoot, name), { mode: 0o700 });
  const args = [
    path.join(vendorRoot, 'bin', 'node-gyp.js'), 'rebuild', '--directory', nativeSource,
    '--release', '--nodedir', headersRoot, '--devdir', path.join(attemptRoot, 'devdir'),
    '--arch', process.arch, '--jobs', '1'
  ];
  const environment = {
    PATH: process.env.PATH,
    HOME: path.join(attemptRoot, 'home'),
    TMPDIR: path.join(attemptRoot, 'tmp'),
    TEMP: path.join(attemptRoot, 'tmp'),
    TMP: path.join(attemptRoot, 'tmp'),
    LANG: 'C', LC_ALL: 'C', TZ: 'UTC'
  };
  const child = spawn(process.execPath, args, { cwd: attemptRoot, env: environment, shell: false, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const terminate = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch {} };
  const stdout = collect(child.stdout, BUILD_STREAM_MAX_BYTES, terminate);
  const stderr = collect(child.stderr, BUILD_STREAM_MAX_BYTES, terminate);
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; terminate(); }, timeoutMs);
  const result = await new Promise((resolve) => {
    child.once('error', (error) => resolve({ error }));
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  if (timedOut || stdout.overflow() || stderr.overflow() || result.error || result.code !== 0) {
    const error = new Error('native build failed');
    error.reason = timedOut ? 'build-timeout' : 'build-failed';
    error.component = 'build-toolchain';
    error.transcript = { stdout: stdout.bytes(), stderr: stderr.bytes(), timedOut, overflow: stdout.overflow() || stderr.overflow() };
    throw error;
  }
  return { artifactPath: path.join(nativeSource, 'build', 'Release', 'kstack_citation_fs_native.node'), snapshot, stdout: stdout.bytes(), stderr: stderr.bytes() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildCitationNativeSnapshotV1({ pluginRoot: path.resolve(process.argv[2]), attemptRoot: path.resolve(process.argv[3]) })
    .then((result) => process.stdout.write(`${JSON.stringify({ artifactPath: result.artifactPath, snapshot: result.snapshot })}\n`))
    .catch((error) => {
      process.stderr.write(`${JSON.stringify({ reason: error.reason ?? 'build-failed', component: error.component ?? 'build-toolchain' })}\n`);
      process.exitCode = 2;
    });
}
