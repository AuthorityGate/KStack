#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '../..');
const FREEZE_PATH = '.kstack/reviews/runtime-maturity-focused-2026-08-29-final-review-freeze-v1.json';
const EXCLUDED_PREFIXES = Object.freeze(['.kstack/secrets/']);
const EXCLUDED_PATHS = new Set([FREEZE_PATH]);
const CURRENT_EVIDENCE = Object.freeze([
  '.kstack/reviews/runtime-maturity-focused-2026-08-29-completion-audit.md',
  '.kstack/reviews/kcrp-host-domain-2026-08-29-validation.md',
  '.kstack/reviews/host-breadth-2026-08-29-hb-tc06/implementation-progress.md',
  '.kstack/qualifications/linux-qualification-2026-08-29-implementation-progress.md',
  '.kstack/qualifications/linux-qualification-2026-08-29-validation-v4.md',
  '.kstack/qualifications/linux-ubuntu-24.04-wsl2-2026-08-29.json',
  '.kstack/qualifications/linux-ubuntu-24.04-wsl2-native-probe-2026-08-29.md',
  '.kstack/qualifications/goose-v1.48.0-requalification-2026-08-29.md',
  '.kstack/qualifications/goose-v1.48.0-lock-remediation-2026-08-29.patch',
  '.kstack/qualifications/goose-v1.48.0-remediation-feasibility-2026-08-29.md',
  '.kstack/qualifications/goose-v1.48.0-kstack-deny-2026-08-29.toml',
  '.kstack/qualifications/goose-v1.48.0-license-remediation-2026-08-29.patch',
  '.kstack/qualifications/goose-v1.48.0-license-source-remediation-2026-08-29.md',
  '.kstack/qualifications/goose-v1.48.0-reproducible-build-2026-08-29.md',
  '.kstack/qualifications/goose-v1.48.0-supply-chain-2026-08-29.md',
  '.kstack/qualifications/goose-v1.48.0-adapter-isolated-execution-2026-08-29.md',
  '.kstack/qualifications/goose-v1.48.0-isolated-cell-evidence.json',
  '.kstack/decisions/goose-v1.48.0-adapter-objective-2026-08-29.md',
  'plugins/kstack/references/DESIGN_ALTITUDE.md',
  'plugins/kstack/references/HOST_DEPENDENCY_ADMISSION.md'
]);

function asciiCompare(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function canonicalRelative(value) {
  const normalized = value.replaceAll('\\', '/');
  if (!normalized || normalized === '.' || normalized.startsWith('/') || normalized.startsWith('//')
    || /^[A-Za-z]:\//u.test(normalized) || normalized.split('/').includes('..')
    || path.posix.normalize(normalized) !== normalized) throw new Error('FINAL_REVIEW_FREEZE_PATH_INVALID');
  return normalized;
}

function excluded(relativePath) {
  return EXCLUDED_PATHS.has(relativePath) || EXCLUDED_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function parseStatus(repositoryRoot) {
  const bytes = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
    cwd: repositoryRoot, encoding: 'buffer', maxBuffer: 16 * 1024 * 1024
  });
  const records = bytes.toString('utf8').split('\0');
  const statuses = new Map();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.length < 4 || record[2] !== ' ') throw new Error('FINAL_REVIEW_FREEZE_GIT_STATUS_INVALID');
    const status = record.slice(0, 2);
    const firstPath = canonicalRelative(record.slice(3));
    statuses.set(firstPath, status);
    if (/[RC]/u.test(status)) {
      const secondPath = records[++index];
      if (!secondPath) throw new Error('FINAL_REVIEW_FREEZE_GIT_STATUS_INVALID');
      statuses.set(canonicalRelative(secondPath), status);
    }
  }
  return statuses;
}

function walkFiles(repositoryRoot, relativeRoot, predicate) {
  const absoluteRoot = path.join(repositoryRoot, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  const files = [];
  const stack = [relativeRoot];
  while (stack.length) {
    const current = stack.pop();
    const absolute = path.join(repositoryRoot, current);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error('FINAL_REVIEW_FREEZE_LINK_REJECTED');
    if (stat.isDirectory()) {
      const children = fs.readdirSync(absolute).map((name) => canonicalRelative(path.posix.join(current, name)));
      children.sort(asciiCompare).reverse();
      stack.push(...children);
    } else if (stat.isFile() && predicate(current)) files.push(current);
  }
  return files;
}

function governingDependencies(repositoryRoot) {
  const files = new Set(CURRENT_EVIDENCE);
  files.add('plugins/kstack/scripts/kstack-host-contract.mjs');
  files.add('plugins/kstack/scripts/kstack-domain-evaluation.mjs');
  files.add('tests/helpers/runtime-final-review-freeze.mjs');
  files.add('tests/runtime-final-review-freeze.test.mjs');
  const decisionName = /^(?:host|domain|openclaw|gstack-hermes|kcrp|token-reduction|adaptive-secondary|staged-primary|runtime-maturity-focused).+\.(?:md|json)$/u;
  for (const relativePath of walkFiles(repositoryRoot, '.kstack/decisions', (entry) => decisionName.test(path.posix.basename(entry)))) {
    files.add(relativePath);
  }
  files.add('.kstack/roadmaps/runtime-maturity-focused-2026-08-28.json');
  files.add('plugins/kstack/references/DUAL_REVIEW.md');
  files.add('plugins/kstack/skills/kstack-qc/SKILL.md');
  for (const relativePath of walkFiles(repositoryRoot, 'plugins/kstack/scripts', (entry) => {
    const name = path.posix.basename(entry);
    return /^kstack-kcrp-.+\.mjs$/u.test(name)
      || ['kstack-review-measurement.mjs', 'kstack-provider-runner.mjs', 'kstack-review-schema.mjs'].includes(name);
  })) files.add(relativePath);
  return files;
}

function artifactRole(relativePath) {
  if (relativePath === '.kstack/config.json' || relativePath === '.kstack/wsl-jira-executor.json') return 'configuration';
  if (relativePath.startsWith('.kstack/roadmaps/')) return 'roadmap';
  if (relativePath.startsWith('.kstack/objectives/')) return 'objective';
  if (relativePath.startsWith('.kstack/qualifications/')) return 'qualification-evidence';
  if (relativePath.startsWith('.kstack/reviews/')) return 'validation-evidence';
  if (relativePath.startsWith('.kstack/decisions/')) {
    return relativePath.endsWith('runtime-maturity-focused-2026-08-28-status.md') ? 'deferred-status-report' : 'governing-decision';
  }
  if (relativePath.startsWith('tests/')) return 'verification';
  if (relativePath === '.gitignore' || relativePath === 'AGENTS.md' || relativePath === 'README.md' || relativePath === 'package.json' || relativePath === 'setup'
    || relativePath === 'setup.ps1'
    || relativePath.startsWith('.claude-plugin/') || relativePath.includes('/.claude-plugin/')
    || relativePath.includes('/.codex-plugin/')) return 'distribution-contract';
  if (relativePath.startsWith('plugins/kstack/')) return 'production';
  throw new Error('FINAL_REVIEW_FREEZE_ROLE_UNCLASSIFIED');
}

function readArtifact(repositoryRoot, relativePath, gitStatus) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('FINAL_REVIEW_FREEZE_NONREGULAR_REJECTED');
  const realRoot = fs.realpathSync.native(repositoryRoot);
  const realFile = fs.realpathSync.native(absolutePath);
  if (path.relative(realRoot, realFile).startsWith('..') || path.isAbsolute(path.relative(realRoot, realFile))) {
    throw new Error('FINAL_REVIEW_FREEZE_ESCAPE_REJECTED');
  }
  const bytes = fs.readFileSync(absolutePath);
  return Object.freeze({
    path: relativePath,
    role: artifactRole(relativePath),
    gitStatus,
    bytes: bytes.length,
    sha256: sha256(bytes)
  });
}

export function buildRuntimeFinalReviewFreeze({ repositoryRoot = DEFAULT_ROOT, frozenAt }) {
  const root = fs.realpathSync.native(path.resolve(repositoryRoot));
  if (typeof frozenAt !== 'string' || new Date(frozenAt).toISOString() !== frozenAt) {
    throw new Error('FINAL_REVIEW_FREEZE_TIME_INVALID');
  }
  const status = parseStatus(root);
  const paths = new Set();
  for (const relativePath of status.keys()) if (!excluded(relativePath)) paths.add(relativePath);
  for (const relativePath of governingDependencies(root)) if (!excluded(relativePath)) paths.add(relativePath);
  const sortedPaths = [...paths].sort(asciiCompare);
  const artifacts = sortedPaths.map((relativePath) => readArtifact(root, relativePath, status.get(relativePath) ?? 'clean-governing-dependency'));
  const byRole = {};
  const byGitStatus = {};
  let totalBytes = 0;
  for (const artifact of artifacts) {
    byRole[artifact.role] = (byRole[artifact.role] ?? 0) + 1;
    byGitStatus[artifact.gitStatus] = (byGitStatus[artifact.gitStatus] ?? 0) + 1;
    totalBytes += artifact.bytes;
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/u.test(head)) throw new Error('FINAL_REVIEW_FREEZE_HEAD_INVALID');
  const artifactSetSha256 = sha256(Buffer.from(JSON.stringify(artifacts), 'utf8'));
  return Object.freeze({
    schemaVersion: 1,
    kind: 'kstack-runtime-final-review-freeze-v1',
    frozenAt,
    repositoryHead: head,
    scope: 'focused-host-and-domain-runtime-maturity',
    reportDisposition: 'DEFERRED_UNTIL_ALL_ROWS_COMPLETE',
    secretDisposition: {
      excludedPrefixes: [...EXCLUDED_PREFIXES],
      externalCredentialFilesIncluded: false,
      reason: 'CREDENTIAL_CAPABLE_STATE_IS_NOT_REVIEW_PAYLOAD'
    },
    jiraState: { active: 40, blocked: 3, planned: 0, done: 0, total: 43 },
    validation: { tests: 961, passed: 960, failed: 0, skipped: 1, architecturePassed: 9, installHealthPassed: 4 },
    counts: { artifacts: artifacts.length, totalBytes, byRole, byGitStatus },
    artifactSetSha256,
    artifacts
  });
}

export function canonicalFreezeBytes(freeze) {
  return Buffer.from(`${JSON.stringify(freeze, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const result = { repositoryRoot: DEFAULT_ROOT, frozenAt: null, verify: null, out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--project-root') result.repositoryRoot = argv[++index];
    else if (key === '--frozen-at') result.frozenAt = argv[++index];
    else if (key === '--verify') result.verify = argv[++index];
    else if (key === '--out') result.out = argv[++index];
    else throw new Error('FINAL_REVIEW_FREEZE_ARGUMENT_INVALID');
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const bytes = canonicalFreezeBytes(buildRuntimeFinalReviewFreeze(options));
    if (options.verify) {
      const expected = fs.readFileSync(path.resolve(options.verify));
      if (!bytes.equals(expected)) throw new Error('FINAL_REVIEW_FREEZE_DRIFT');
      process.stdout.write(`${JSON.stringify({ status: 'MATCH', sha256: sha256(bytes), bytes: bytes.length })}\n`);
    } else if (options.out) {
      const output = path.resolve(options.out);
      if (output !== path.join(path.resolve(options.repositoryRoot), FREEZE_PATH)) throw new Error('FINAL_REVIEW_FREEZE_OUTPUT_INVALID');
      fs.writeFileSync(output, bytes, { mode: 0o600 });
      process.stdout.write(`${JSON.stringify({ status: 'WRITTEN', sha256: sha256(bytes), bytes: bytes.length, output })}\n`);
    } else process.stdout.write(bytes);
  } catch (error) {
    process.stderr.write(`${error?.message || 'FINAL_REVIEW_FREEZE_FAILED'}\n`);
    process.exitCode = 2;
  }
}
