#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { findConfig, validateConfig } from './kstack-config.mjs';
import { sha256 } from './kstack-review-schema.mjs';

const maxArtifactBytes = 1024 * 1024;
const allowedBodyExtensions = new Set(['.md', '.json', '.gitignore']);
const secretPatterns = [
  ['private-key', /-----BEGIN [^-]*PRIVATE KEY-----/i],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ['openai-key', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['bearer-token', /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}=*/i],
  ['assigned-secret', /\b(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["']?[^\s"']{12,}/i]
];

function parseArgs(argv) {
  const [command = 'status', ...rest] = argv;
  const args = { command, approved: new Set() };
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith('--')) throw new Error(`Unexpected argument: ${item}`);
    const key = item.slice(2);
    const value = rest[index + 1]?.startsWith('--') || rest[index + 1] === undefined ? true : rest[++index];
    args[key] = value;
  }
  if (typeof args.approved === 'string') args.approved = new Set(args.approved.split(',').map((value) => value.trim()).filter(Boolean));
  else args.approved = new Set();
  return args;
}

function readUtf8(buffer, label) {
  if (buffer.length > maxArtifactBytes) throw new Error(`${label} exceeds the ${maxArtifactBytes}-byte curated-artifact limit`);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

function entropy(value) {
  const counts = new Map();
  for (const character of value) counts.set(character, (counts.get(character) || 0) + 1);
  let result = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    result -= probability * Math.log2(probability);
  }
  return result;
}

export function scanTextForSecrets(text) {
  const findings = [];
  for (const [id, pattern] of secretPatterns) if (pattern.test(text)) findings.push(id);
  const candidates = text.match(/\b[A-Za-z0-9+_=-]{32,128}\b/g) || [];
  if (candidates.some((candidate) => entropy(candidate) >= 4.3 && /[A-Za-z]/.test(candidate) && /\d/.test(candidate))) findings.push('high-entropy-value');
  return [...new Set(findings)];
}

function assertNoSecrets(text, label) {
  const findings = scanTextForSecrets(text);
  if (findings.length) throw new Error(`${label} rejected by secret scan (${findings.join(', ')}); values were not logged`);
}

function atomicWrite(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(temporary, contents, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function walk(root, skipGit = true) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (skipGit && entry.name === '.git') continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(target, skipGit));
    else if (entry.isFile()) files.push(target);
    else throw new Error(`Body contains unsupported filesystem entry: ${target}`);
  }
  return files;
}

function scanBody(root) {
  for (const file of walk(root)) {
    const extension = path.basename(file) === '.gitignore' ? '.gitignore' : path.extname(file).toLowerCase();
    if (!allowedBodyExtensions.has(extension)) throw new Error(`Body contains prohibited file type: ${path.relative(root, file)}`);
    const text = readUtf8(fs.readFileSync(file), path.relative(root, file));
    assertNoSecrets(text, path.relative(root, file));
    if (extension === '.json') JSON.parse(text);
  }
}

function git(bodyDirectory, args, options = {}) {
  const result = spawnSync('git', ['-C', bodyDirectory, ...args], { encoding: options.encoding ?? 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0 && !options.allowFailure) throw new Error(`git ${args[0]} failed: ${(result.stderr || result.stdout || '').toString().trim()}`);
  return result;
}

function gh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`gh ${args[0]} failed: ${(result.stderr || result.stdout || '').trim()}`);
  return result;
}

function ensureAuthority(memory, action, approved) {
  const policy = memory.authority[action];
  if (policy === 'deny') throw new Error(`memory.authority.${action} denies this action`);
  if (policy === 'ask' && !approved.has(action)) throw new Error(`memory.authority.${action} requires explicit approval; rerun with --approved ${action}`);
}

function loadState(configPath) {
  const resolvedConfig = configPath ? path.resolve(configPath) : findConfig();
  if (!resolvedConfig) throw new Error('No .kstack/config.json found.');
  const config = JSON.parse(fs.readFileSync(resolvedConfig, 'utf8'));
  const errors = validateConfig(config);
  if (errors.length) throw new Error(`Invalid KStack config: ${errors.join('; ')}`);
  if (!config.memory?.enabled) throw new Error('KStack memory is disabled; run kstack-init or kstack-memory setup first.');
  const projectRoot = path.dirname(path.dirname(resolvedConfig));
  const bodyDirectory = path.resolve(projectRoot, config.memory.bodyDirectory);
  const indexDirectory = path.resolve(projectRoot, config.memory.indexDirectory);
  const withinProject = path.relative(projectRoot, bodyDirectory);
  if (withinProject === '' || (!withinProject.startsWith('..') && !path.isAbsolute(withinProject))) throw new Error('memory.bodyDirectory must be outside the project repository to avoid a nested Git worktree');
  const indexWithinBody = path.relative(bodyDirectory, indexDirectory);
  if (indexWithinBody === '' || (!indexWithinBody.startsWith('..') && !path.isAbsolute(indexWithinBody))) throw new Error('memory.indexDirectory must be outside the portable body');
  return { config, configPath: resolvedConfig, projectRoot, memory: config.memory, bodyDirectory, indexDirectory };
}

function assertTrust(memory, write = false) {
  if (memory.trust === 'deny') throw new Error(`Memory namespace ${memory.namespace} is denied by policy`);
  if (write && memory.trust !== 'read-write') throw new Error(`Memory namespace ${memory.namespace} is not writable`);
}

function withBodyLock(state, operation) {
  fs.mkdirSync(state.indexDirectory, { recursive: true, mode: 0o700 });
  const lockFile = path.join(state.indexDirectory, `.body-${sha256(state.bodyDirectory).slice(0, 16)}.lock`);
  let handle;
  try {
    handle = fs.openSync(lockFile, 'wx', 0o600);
    fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString() }));
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Memory body is locked: ${lockFile}`);
    throw error;
  }
  return Promise.resolve().then(operation).finally(() => {
    fs.closeSync(handle);
    fs.unlinkSync(lockFile);
  });
}

function bodyManifest(state) {
  return {
    schemaVersion: 1,
    bodyId: sha256(state.bodyDirectory).slice(0, 24),
    format: 'kstack-curated-body',
    createdAt: new Date().toISOString()
  };
}

async function openIndex(state) {
  fs.mkdirSync(state.indexDirectory, { recursive: true, mode: 0o700 });
  const db = new PGlite(state.indexDirectory);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS kstack_metadata (key text PRIMARY KEY, value text NOT NULL);
    CREATE TABLE IF NOT EXISTS artifacts (
      artifact_id text PRIMARY KEY,
      namespace text NOT NULL,
      kind text NOT NULL,
      title text NOT NULL,
      source text NOT NULL,
      created_at timestamptz NOT NULL,
      body_path text NOT NULL,
      content_sha256 text NOT NULL,
      content text NOT NULL,
      indexed_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS artifacts_namespace_idx ON artifacts(namespace);
  `);
  await db.query("INSERT INTO kstack_metadata(key, value) VALUES ('schemaVersion', '1') ON CONFLICT (key) DO NOTHING");
  const version = await db.query("SELECT value FROM kstack_metadata WHERE key = 'schemaVersion'");
  if (version.rows[0]?.value !== '1') throw new Error(`Unsupported PGLite schema version: ${version.rows[0]?.value}`);
  return db;
}

function artifactMetadataFiles(state) {
  const root = path.join(state.bodyDirectory, 'projects', state.memory.namespace, 'artifacts');
  return walk(root).filter((file) => path.basename(file) === 'artifact.json');
}

function readArtifact(state, metadataFile) {
  const metadata = JSON.parse(readUtf8(fs.readFileSync(metadataFile), path.relative(state.bodyDirectory, metadataFile)));
  if (metadata.schemaVersion !== 1 || metadata.namespace !== state.memory.namespace) throw new Error(`Invalid artifact metadata: ${metadataFile}`);
  const contentFile = path.resolve(path.dirname(metadataFile), metadata.contentFile);
  if (path.dirname(contentFile) !== path.dirname(metadataFile)) throw new Error(`Artifact content path escapes its directory: ${metadataFile}`);
  const content = readUtf8(fs.readFileSync(contentFile), path.relative(state.bodyDirectory, contentFile));
  if (sha256(content) !== metadata.contentSha256) throw new Error(`Artifact digest mismatch: ${metadata.artifactId}`);
  assertNoSecrets(content, metadata.artifactId);
  return { metadata, content, bodyPath: path.relative(state.bodyDirectory, contentFile).split(path.sep).join('/') };
}

async function upsertArtifact(db, artifact) {
  const { metadata, content, bodyPath } = artifact;
  await db.query(`
    INSERT INTO artifacts(artifact_id, namespace, kind, title, source, created_at, body_path, content_sha256, content, indexed_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
    ON CONFLICT (artifact_id) DO UPDATE SET
      namespace=excluded.namespace, kind=excluded.kind, title=excluded.title, source=excluded.source,
      created_at=excluded.created_at, body_path=excluded.body_path, content_sha256=excluded.content_sha256,
      content=excluded.content, indexed_at=now()
  `, [metadata.artifactId, metadata.namespace, metadata.kind, metadata.title, metadata.source, metadata.createdAt, bodyPath, metadata.contentSha256, content]);
}

async function initialize(state) {
  assertTrust(state.memory, true);
  await withBodyLock(state, async () => {
    const manifestFile = path.join(state.bodyDirectory, 'kstack-body.json');
    if (!fs.existsSync(manifestFile)) atomicWrite(manifestFile, `${JSON.stringify(bodyManifest(state), null, 2)}\n`);
    const db = await openIndex(state);
    await db.close();
  });
  return { status: 'initialized', bodyDirectory: state.bodyDirectory, indexDirectory: state.indexDirectory, namespace: state.memory.namespace };
}

async function ingest(state, args) {
  assertTrust(state.memory, true);
  if (!args.source) throw new Error('ingest requires --source FILE');
  const kind = typeof args.kind === 'string' ? args.kind : 'note';
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(kind)) throw new Error('--kind must be lower-case hyphen-case');
  const sourceFile = path.resolve(args.source);
  const extension = path.extname(sourceFile).toLowerCase();
  if (!['.md', '.json'].includes(extension)) throw new Error('Only curated Markdown and JSON artifacts are accepted');
  const content = readUtf8(fs.readFileSync(sourceFile), sourceFile);
  assertNoSecrets(content, sourceFile);
  if (extension === '.json') JSON.parse(content);
  const contentSha256 = sha256(content);
  const artifactId = sha256(`${state.memory.namespace}\0${kind}\0${contentSha256}`).slice(0, 32);
  const directory = path.join(state.bodyDirectory, 'projects', state.memory.namespace, 'artifacts', kind, artifactId);
  const contentName = `content${extension}`;
  const metadata = {
    schemaVersion: 1,
    artifactId,
    namespace: state.memory.namespace,
    kind,
    title: typeof args.title === 'string' ? args.title : path.basename(sourceFile, extension),
    source: typeof args.origin === 'string' ? args.origin : sourceFile,
    createdAt: new Date().toISOString(),
    contentFile: contentName,
    contentSha256,
    trust: 'untrusted-data'
  };
  assertNoSecrets(JSON.stringify(metadata), `${artifactId} metadata`);
  await withBodyLock(state, async () => {
    atomicWrite(path.join(directory, contentName), content);
    atomicWrite(path.join(directory, 'artifact.json'), `${JSON.stringify(metadata, null, 2)}\n`);
    const db = await openIndex(state);
    try { await upsertArtifact(db, { metadata, content, bodyPath: path.relative(state.bodyDirectory, path.join(directory, contentName)).split(path.sep).join('/') }); }
    finally { await db.close(); }
  });
  return { status: 'ingested', artifactId, contentSha256, namespace: state.memory.namespace };
}

async function rebuild(state) {
  assertTrust(state.memory);
  return withBodyLock(state, async () => {
    scanBody(state.bodyDirectory);
    const artifacts = artifactMetadataFiles(state).map((file) => readArtifact(state, file));
    const db = await openIndex(state);
    try {
      await db.transaction(async (transaction) => {
        await transaction.query('DELETE FROM artifacts WHERE namespace = $1', [state.memory.namespace]);
        for (const artifact of artifacts) await upsertArtifact(transaction, artifact);
      });
    } finally { await db.close(); }
    return { status: 'rebuilt', namespace: state.memory.namespace, artifactCount: artifacts.length };
  });
}

async function search(state, args) {
  assertTrust(state.memory);
  if (!args.query) throw new Error('search requires --query TEXT');
  const requestedLimit = args.limit ? Number(args.limit) : state.memory.resultLimit;
  const limit = Math.min(state.memory.resultLimit, Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : state.memory.resultLimit);
  const db = await openIndex(state);
  try {
    const result = await db.query(`
      SELECT artifact_id, kind, title, source, created_at, body_path, content_sha256,
        ts_rank(to_tsvector('english', title || ' ' || content), websearch_to_tsquery('english', $2)) AS rank,
        left(content, $3) AS excerpt
      FROM artifacts
      WHERE namespace = $1 AND to_tsvector('english', title || ' ' || content) @@ websearch_to_tsquery('english', $2)
      ORDER BY rank DESC, created_at DESC
      LIMIT $4
    `, [state.memory.namespace, args.query, Math.max(256, Math.floor(state.memory.tokenBudget * 4 / Math.max(limit, 1))), limit]);
    return {
      status: 'complete',
      trust: 'UNTRUSTED_RETRIEVED_DATA',
      automaticContextInjection: false,
      namespace: state.memory.namespace,
      query: args.query,
      results: result.rows.map((row) => ({ ...row, provenance: { bodyDirectory: state.bodyDirectory, bodyPath: row.body_path } }))
    };
  } finally { await db.close(); }
}

async function status(state) {
  assertTrust(state.memory);
  const bodyFiles = fs.existsSync(state.bodyDirectory) ? artifactMetadataFiles(state).length : 0;
  let indexed = 0;
  if (fs.existsSync(state.indexDirectory)) {
    const db = await openIndex(state);
    try { indexed = Number((await db.query('SELECT count(*)::int AS count FROM artifacts WHERE namespace = $1', [state.memory.namespace])).rows[0]?.count || 0); }
    finally { await db.close(); }
  }
  const gitStatus = fs.existsSync(path.join(state.bodyDirectory, '.git')) ? git(state.bodyDirectory, ['status', '--porcelain=v1', '--branch']).stdout.trim() : 'not-connected';
  const health = bodyFiles === 0 && indexed === 0 ? 'empty' : bodyFiles === indexed ? 'current' : 'stale';
  return {
    status: health,
    namespace: state.memory.namespace,
    bodyArtifacts: bodyFiles,
    indexedArtifacts: indexed,
    git: gitStatus,
    automaticContextInjection: false,
    actionRequired: health === 'empty' ? 'Ingest at least one accepted Markdown or JSON artifact before claiming cross-session memory is operational.' : null
  };
}

function scanGitRef(state, ref) {
  const names = git(state.bodyDirectory, ['ls-tree', '-r', '--name-only', '-z', ref], { encoding: 'buffer' }).stdout.toString('utf8').split('\0').filter(Boolean);
  for (const name of names) {
    const extension = path.basename(name) === '.gitignore' ? '.gitignore' : path.extname(name).toLowerCase();
    if (!allowedBodyExtensions.has(extension)) throw new Error(`Fetched body contains prohibited file type: ${name}`);
    const content = git(state.bodyDirectory, ['show', `${ref}:${name}`], { encoding: 'buffer' }).stdout;
    const text = readUtf8(content, `${ref}:${name}`);
    assertNoSecrets(text, `${ref}:${name}`);
    if (extension === '.json') JSON.parse(text);
  }
}

function connect(state, args) {
  assertTrust(state.memory, true);
  if (!state.memory.remote) throw new Error('memory.remote is required');
  fs.mkdirSync(state.bodyDirectory, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(path.join(state.bodyDirectory, '.git'))) git(state.bodyDirectory, ['init', '-b', 'main']);
  const existing = git(state.bodyDirectory, ['remote', 'get-url', 'origin'], { allowFailure: true });
  if (existing.status === 0 && existing.stdout.trim() !== state.memory.remote) throw new Error('Existing origin does not match memory.remote');
  if (existing.status !== 0) git(state.bodyDirectory, ['remote', 'add', 'origin', state.memory.remote]);
  return { status: 'connected', remote: state.memory.remote };
}

function cloneBody(state, args) {
  assertTrust(state.memory, true);
  ensureAuthority(state.memory, 'clone', args.approved);
  if (!state.memory.remote) throw new Error('memory.remote is required');
  if (fs.existsSync(state.bodyDirectory) && fs.readdirSync(state.bodyDirectory).length) throw new Error('memory.bodyDirectory must be absent or empty before clone');
  fs.mkdirSync(path.dirname(state.bodyDirectory), { recursive: true, mode: 0o700 });
  const result = spawnSync('git', ['clone', '--origin', 'origin', state.memory.remote, state.bodyDirectory], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git clone failed: ${(result.stderr || result.stdout || '').trim()}`);
  scanBody(state.bodyDirectory);
  return { status: 'cloned-and-validated', remote: state.memory.remote };
}

function createPrivate(state, args) {
  assertTrust(state.memory, true);
  ensureAuthority(state.memory, 'createRepository', args.approved);
  if (!state.memory.remote || /:|\/\//.test(state.memory.remote)) throw new Error('For create-private, memory.remote must be OWNER/REPOSITORY');
  fs.mkdirSync(state.bodyDirectory, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(path.join(state.bodyDirectory, '.git'))) git(state.bodyDirectory, ['init', '-b', 'main']);
  if (git(state.bodyDirectory, ['remote', 'get-url', 'origin'], { allowFailure: true }).status === 0) throw new Error('origin already exists; use connect/status instead of create-private');
  const result = gh(['repo', 'create', state.memory.remote, '--private', '--source', state.bodyDirectory, '--remote', 'origin']);
  return { status: 'private-repository-created', remote: state.memory.remote, output: result.stdout.trim() };
}

function fetchBody(state, args) {
  assertTrust(state.memory);
  ensureAuthority(state.memory, 'fetch', args.approved);
  const branch = typeof args.branch === 'string' ? args.branch : 'main';
  git(state.bodyDirectory, ['fetch', '--no-tags', 'origin', branch]);
  scanGitRef(state, 'FETCH_HEAD');
  return { status: 'fetched-and-validated', branch };
}

function integrate(state, args) {
  assertTrust(state.memory, true);
  ensureAuthority(state.memory, 'integrate', args.approved);
  const dirty = git(state.bodyDirectory, ['status', '--porcelain']).stdout.trim();
  if (dirty) throw new Error('Body worktree must be clean before integration');
  scanGitRef(state, 'FETCH_HEAD');
  git(state.bodyDirectory, ['merge', '--ff-only', 'FETCH_HEAD']);
  scanBody(state.bodyDirectory);
  return { status: 'fast-forward-integrated' };
}

function commitBody(state, args) {
  assertTrust(state.memory, true);
  ensureAuthority(state.memory, 'commit', args.approved);
  if (!args.message) throw new Error('commit requires --message TEXT');
  scanBody(state.bodyDirectory);
  git(state.bodyDirectory, ['add', '--all']);
  const staged = git(state.bodyDirectory, ['diff', '--cached', '--name-only', '-z'], { encoding: 'buffer' }).stdout.toString('utf8').split('\0').filter(Boolean);
  for (const name of staged) {
    const content = git(state.bodyDirectory, ['show', `:${name}`], { encoding: 'buffer' }).stdout;
    const text = readUtf8(content, `staged:${name}`);
    assertNoSecrets(text, `staged:${name}`);
  }
  if (!staged.length) return { status: 'nothing-to-commit' };
  git(state.bodyDirectory, ['commit', '-m', args.message]);
  return { status: 'committed', files: staged.length, revision: git(state.bodyDirectory, ['rev-parse', 'HEAD']).stdout.trim() };
}

function pushBody(state, args) {
  assertTrust(state.memory, true);
  ensureAuthority(state.memory, 'fetch', args.approved);
  ensureAuthority(state.memory, 'push', args.approved);
  const branch = typeof args.branch === 'string' ? args.branch : 'main';
  scanBody(state.bodyDirectory);
  const fetchResult = git(state.bodyDirectory, ['fetch', '--no-tags', 'origin', branch], { allowFailure: true });
  if (fetchResult.status === 0) {
    scanGitRef(state, 'FETCH_HEAD');
    const ancestor = git(state.bodyDirectory, ['merge-base', '--is-ancestor', 'FETCH_HEAD', 'HEAD'], { allowFailure: true });
    if (ancestor.status !== 0) throw new Error('Remote body is not an ancestor of local HEAD; integrate explicitly before push');
  }
  git(state.bodyDirectory, ['push', 'origin', `HEAD:refs/heads/${branch}`]);
  return { status: 'pushed', branch, revision: git(state.bodyDirectory, ['rev-parse', 'HEAD']).stdout.trim() };
}

export async function runMemoryCommand(args) {
  const state = loadState(args.config);
  switch (args.command) {
    case 'init': return initialize(state);
    case 'ingest': return ingest(state, args);
    case 'rebuild': return rebuild(state);
    case 'search': return search(state, args);
    case 'status': return status(state);
    case 'connect': return connect(state, args);
    case 'clone': return cloneBody(state, args);
    case 'create-private': return createPrivate(state, args);
    case 'fetch': return fetchBody(state, args);
    case 'integrate': return integrate(state, args);
    case 'commit': return commitBody(state, args);
    case 'push': return pushBody(state, args);
    default: throw new Error(`Unknown memory command: ${args.command}`);
  }
}

async function main(argv) {
  const args = parseArgs(argv);
  const result = await runMemoryCommand(args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 2; });
}
