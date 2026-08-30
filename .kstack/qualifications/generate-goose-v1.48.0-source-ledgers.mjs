#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [sourceArg, outputArg] = process.argv.slice(2);
if (!sourceArg || !outputArg) {
  process.stderr.write('usage: generate-goose-v1.48.0-source-ledgers.mjs SOURCE_ROOT OUTPUT_ROOT\n');
  process.exit(2);
}

const sourceRoot = fs.realpathSync(sourceArg);
const outputRoot = path.resolve(outputArg);
const cargoRoot = process.env.CARGO_HOME
  ? fs.realpathSync(process.env.CARGO_HOME)
  : path.join(os.homedir(), '.cargo');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = (value) => JSON.stringify(value, null, 2) + '\n';

const metadataRun = spawnSync('cargo', [
  'metadata', '--locked', '--offline', '--format-version', '1',
  '--filter-platform', 'x86_64-unknown-linux-gnu'
], {
  cwd: sourceRoot,
  env: { ...process.env, CARGO_NET_OFFLINE: 'true' },
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});
if (metadataRun.status !== 0) throw new Error(`cargo metadata failed: ${metadataRun.stderr.trim()}`);
const metadata = JSON.parse(metadataRun.stdout);
const resolvedIds = new Set(metadata.resolve.nodes.map((node) => node.id));
const packages = metadata.packages.filter((pkg) => resolvedIds.has(pkg.id));

const lockText = fs.readFileSync(path.join(sourceRoot, 'Cargo.lock'), 'utf8');
const lockEntries = new Map();
for (const block of lockText.split(/\n(?=\[\[package\]\]\n)/u)) {
  const name = block.match(/^name = "([^"]+)"$/mu)?.[1];
  const version = block.match(/^version = "([^"]+)"$/mu)?.[1];
  const source = block.match(/^source = "([^"]+)"$/mu)?.[1] ?? null;
  const checksum = block.match(/^checksum = "([0-9a-f]{64})"$/mu)?.[1] ?? null;
  if (name && version) lockEntries.set(`${name}\0${version}\0${source ?? ''}`, { checksum, source });
}

const archiveIndex = new Map();
const cacheRoot = path.join(cargoRoot, 'registry', 'cache');
for (const indexName of fs.readdirSync(cacheRoot)) {
  const indexRoot = path.join(cacheRoot, indexName);
  if (!fs.statSync(indexRoot).isDirectory()) continue;
  for (const name of fs.readdirSync(indexRoot)) {
    if (name.endsWith('.crate')) archiveIndex.set(name.slice(0, -6), path.join(indexRoot, name));
  }
}

function filesUnder(root) {
  const output = [];
  function visit(directory, relative = '') {
    for (const name of fs.readdirSync(directory).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))) {
      if (!relative && (name === '.git' || name === 'target')) continue;
      const absolute = path.join(directory, name);
      const child = relative ? `${relative}/${name}` : name;
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        output.push({ path: child, bytes: Buffer.from(`symlink:${fs.readlinkSync(absolute)}`, 'utf8') });
      } else if (stat.isDirectory()) visit(absolute, child);
      else if (stat.isFile()) output.push({ path: child, bytes: fs.readFileSync(absolute) });
    }
  }
  visit(root);
  return output;
}

const treeCache = new Map();
function treeIdentity(root) {
  const canonicalRoot = fs.realpathSync(root);
  if (treeCache.has(canonicalRoot)) return treeCache.get(canonicalRoot);
  const files = filesUnder(canonicalRoot);
  const lines = files.map((file) => `${sha256(file.bytes)} ${file.bytes.length} ${file.path}\n`).join('');
  const result = { fileCount: files.length, manifestSha256: sha256(Buffer.from(lines, 'utf8')) };
  treeCache.set(canonicalRoot, result);
  return result;
}

const noticeTexts = new Map();
function licenseFiles(pkg) {
  const root = path.dirname(pkg.manifest_path);
  const candidates = new Set();
  if (pkg.license_file) candidates.add(path.resolve(root, pkg.license_file));
  for (const name of fs.readdirSync(root)) {
    if (/^(?:licen[cs]e|copying|notice|copyright)(?:[._-].*)?$/iu.test(name)) candidates.add(path.join(root, name));
  }
  const refs = [];
  for (const file of [...candidates].sort()) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    const bytes = fs.readFileSync(file);
    if (bytes.length > 2 * 1024 * 1024) throw new Error(`license file too large: ${file}`);
    const digest = sha256(bytes);
    if (!noticeTexts.has(digest)) {
      const utf8 = bytes.toString('utf8');
      const roundTrip = Buffer.from(utf8, 'utf8');
      noticeTexts.set(digest, roundTrip.equals(bytes)
        ? { sha256: digest, encoding: 'utf8', text: utf8 }
        : { sha256: digest, encoding: 'base64', text: bytes.toString('base64') });
    }
    refs.push({ name: path.basename(file), sha256: digest, bytes: bytes.length });
  }
  return refs;
}

function registryIdentity(pkg) {
  const lock = lockEntries.get(`${pkg.name}\0${pkg.version}\0${pkg.source}`);
  if (!lock?.checksum) throw new Error(`missing registry checksum: ${pkg.id}`);
  const archive = archiveIndex.get(`${pkg.name}-${pkg.version}`);
  if (!archive) throw new Error(`missing registry archive: ${pkg.id}`);
  const bytes = fs.readFileSync(archive);
  const actual = sha256(bytes);
  if (actual !== lock.checksum) throw new Error(`registry archive checksum mismatch: ${pkg.id}`);
  return {
    kind: 'crates.io',
    retrievalUrl: `https://crates.io/api/v1/crates/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}/download`,
    archiveSha256: actual,
    archiveBytes: bytes.length
  };
}

function sourceIdentity(pkg) {
  if (pkg.source?.startsWith('registry+')) return registryIdentity(pkg);
  if (pkg.source?.startsWith('git+')) {
    const [repository, revision = ''] = pkg.source.slice(4).split('#');
    return { kind: 'git', repository, revision, ...treeIdentity(path.dirname(pkg.manifest_path)) };
  }
  const root = path.dirname(pkg.manifest_path);
  const relative = path.relative(sourceRoot, root).split(path.sep).join('/');
  if (relative.startsWith('../')) throw new Error(`path package escapes source root: ${pkg.id}`);
  return { kind: 'candidate-source', relativePath: relative || '.', ...treeIdentity(root) };
}

const noticePackages = [];
const sourcePackages = [];
for (const pkg of [...packages].sort((a, b) => a.id.localeCompare(b.id))) {
  if (!pkg.license) throw new Error(`missing license expression: ${pkg.id}`);
  const notices = licenseFiles(pkg);
  const source = sourceIdentity(pkg);
  noticePackages.push({ id: pkg.id, name: pkg.name, version: pkg.version, licenseExpression: pkg.license, noticeFiles: notices });
  sourcePackages.push({ id: pkg.id, name: pkg.name, version: pkg.version, licenseExpression: pkg.license, source });
}

const modifiedFiles = [
  { path: 'Cargo.lock', package: 'goose-workspace', licenseExpression: 'Apache-2.0' },
  { path: 'Cargo.toml', package: 'goose-workspace', licenseExpression: 'Apache-2.0' },
  { path: 'vendor/v8/Cargo.toml', package: 'v8', licenseExpression: 'Apache-2.0' },
  { path: 'vendor/kstack-ansi-colours-compat/Cargo.toml', package: 'ansi_colours', licenseExpression: 'Apache-2.0' },
  { path: 'vendor/kstack-ansi-colours-compat/src/lib.rs', package: 'ansi_colours', licenseExpression: 'Apache-2.0' },
  { path: 'vendor/deno_core/modules/module_map_data.rs', package: 'deno_core', licenseExpression: 'MIT' },
  { path: 'vendor/pctx_type_check_runtime/src/typescript.min.js', package: 'pctx_type_check_runtime', licenseExpression: 'MIT' }
].map((entry) => ({ ...entry, mplCovered: entry.licenseExpression.includes('MPL-2.0') }));

const mplPackages = sourcePackages
  .filter((pkg) => pkg.licenseExpression.includes('MPL-2.0'))
  .map((pkg) => ({ id: pkg.id, name: pkg.name, version: pkg.version, licenseExpression: pkg.licenseExpression, modifiedFiles: [] }));
if (modifiedFiles.some((entry) => entry.mplCovered)) throw new Error('modified MPL-covered file requires explicit corresponding-source inclusion');

fs.mkdirSync(outputRoot, { recursive: true });
const common = {
  candidate: { name: 'goose', version: '1.48.0', target: 'x86_64-unknown-linux-gnu', featureProfile: 'goose-cli-default-bin-goose' },
  generatedAt: '2026-08-29T00:00:00.000Z',
  generator: { name: 'generate-goose-v1.48.0-source-ledgers.mjs', sha256: sha256(fs.readFileSync(new URL(import.meta.url))) }
};
const notices = {
  schema: 'kstack-third-party-notices-v1', ...common,
  packageCount: noticePackages.length,
  packages: noticePackages,
  texts: [...noticeTexts.values()].sort((a, b) => a.sha256.localeCompare(b.sha256))
};
const sources = {
  schema: 'kstack-corresponding-source-v1', ...common,
  packageCount: sourcePackages.length,
  packages: sourcePackages,
  modifiedFiles,
  mplPackages,
  modifiedMplFiles: []
};
fs.writeFileSync(path.join(outputRoot, 'goose-v1.48.0-third-party-notices.json'), canonical(notices), 'utf8');
fs.writeFileSync(path.join(outputRoot, 'goose-v1.48.0-corresponding-source.json'), canonical(sources), 'utf8');
process.stdout.write(canonical({ packageCount: packages.length, noticeTextCount: noticeTexts.size, mplPackageCount: mplPackages.length, modifiedFileCount: modifiedFiles.length }));
