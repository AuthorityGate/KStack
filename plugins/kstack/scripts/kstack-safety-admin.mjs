#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readActivation } from './kstack-safety-hook.mjs';
import { defaultGitPushCredentialPath } from './kstack-safety-executor.mjs';

export const SAFETY_CONTROL_FILES = Object.freeze([
  'hooks/hooks.json',
  'scripts/kstack-safety-admin.mjs',
  'scripts/kstack-safety-broker.mjs',
  'scripts/kstack-safety-executor.mjs',
  'scripts/kstack-safety-worker.mjs',
  'scripts/kstack-git-askpass.mjs',
  'scripts/kstack-jira-bootstrap.mjs',
  'scripts/kstack-safety-hook.mjs',
  'scripts/kstack-safety-matchers.mjs'
]);

function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

export function releaseDigests(pluginRoot) {
  const root = fs.realpathSync.native(pluginRoot);
  return Object.fromEntries(SAFETY_CONTROL_FILES.map((relative) => [relative, sha256File(path.join(root, relative))]));
}

function stateDirectory(projectRoot) {
  const root = fs.realpathSync.native(projectRoot);
  const directory = path.join(root, '.kstack');
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
  const link = fs.lstatSync(directory);
  if (link.isSymbolicLink() || !link.isDirectory() || fs.realpathSync.native(directory) !== directory) throw new Error('KSTACK_SAFETY_STATE_DIRECTORY_UNTRUSTED');
  return directory;
}

function registrationPath(projectRoot) { return path.join(stateDirectory(projectRoot), 'safety-hooks.json'); }

function descriptorRead(file, maximumBytes = 1024 * 1024) {
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fs.fstatSync(descriptor);
    const link = fs.lstatSync(file);
    if (!stat.isFile() || link.isSymbolicLink() || !link.isFile() || link.dev !== stat.dev || link.ino !== stat.ino || stat.size > maximumBytes) throw new Error('KSTACK_SAFETY_REGISTRATION_UNTRUSTED');
    return fs.readFileSync(descriptor);
  } finally { fs.closeSync(descriptor); }
}

function existingRegistration(file) {
  if (!fs.existsSync(file)) return null;
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(descriptorRead(file, 64 * 1024)));
  if (value.schemaVersion !== 1) throw new Error('KSTACK_SAFETY_REGISTRATION_DRIFT');
  return value;
}

function durableWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  const descriptor = fs.openSync(temporary, 'r');
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  fs.renameSync(temporary, file);
  const directory = fs.openSync(path.dirname(file), 'r');
  try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
}

function policySnapshot(projectRoot, existing) {
  const bytes = descriptorRead(path.join(stateDirectory(projectRoot), 'config.json'));
  const config = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const keys = ['inspect', 'edit', 'test', 'commit', 'push', 'pullRequest', 'merge', 'deploy', 'deviceInstall', 'destructive', 'externalTicketCreation'];
  for (const key of keys) if (!['allow', 'ask', 'deny'].includes(config?.authority?.[key])) throw new Error('KSTACK_SAFETY_AUTHORITY_INVALID');
  const policyDigest = sha256(bytes);
  const previous = Number.isSafeInteger(existing?.policyGeneration) && existing.policyGeneration >= 1 ? existing.policyGeneration : 0;
  if (existing?.policyDigest !== policyDigest && previous === Number.MAX_SAFE_INTEGER) throw new Error('KSTACK_SAFETY_POLICY_GENERATION_EXHAUSTED');
  return { policyDigest, policyGeneration: existing?.policyDigest === policyDigest ? Math.max(previous, 1) : previous + 1 };
}

function registrationDigest(value) { return value === null ? null : sha256(Buffer.from(JSON.stringify(value), 'utf8')); }

function writeAuditIntent(projectRoot, action, before, after, extra = {}) {
  const root = stateDirectory(projectRoot);
  const directory = path.join(root, 'safety-hooks-audit');
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
  const link = fs.lstatSync(directory);
  if (link.isSymbolicLink() || !link.isDirectory() || fs.realpathSync.native(directory) !== directory) throw new Error('KSTACK_SAFETY_AUDIT_DIRECTORY_UNTRUSTED');
  const eventId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const file = path.join(directory, `${eventId}.json`);
  const record = {
    schemaVersion: 1, eventId, occurredAt: new Date().toISOString(), phase: 'intent-before-mutation', action,
    beforeRegistrationDigest: registrationDigest(before), afterRegistrationDigest: registrationDigest(after),
    enabledBefore: before?.enabled ?? null, enabledAfter: after?.enabled ?? null, ...extra
  };
  durableWrite(file, record);
  return file;
}

export function activateSafetyHooks({ projectRoot, pluginRoot, preserveDisabled = false }) {
  const file = registrationPath(projectRoot);
  const existing = existingRegistration(file);
  const enabled = preserveDisabled && existing?.enabled === false ? false : true;
  const policy = policySnapshot(projectRoot, existing);
  const registration = {
    schemaVersion: 1,
    enabled,
    activation: { user: true, project: true },
    coverage: {
      claude: 'deny plus broker-only ask-tier mediation on admitted interactive cells',
      codex: 'deny-only for credential access and authority-matrix hard-deny families',
      limitations: 'Hooks can be disabled, skipped, timed out, bypassed, or absent on specialized tool paths; direct external processes are outside coverage.'
    },
    controlPlane: 'detect-only-tamper-evident',
    ...policy,
    releaseDigests: releaseDigests(pluginRoot)
  };
  const protectedCredentialPaths = new Set(existing?.protectedCredentialPaths ?? []);
  const gitCredentialPath = defaultGitPushCredentialPath();
  if (gitCredentialPath) protectedCredentialPaths.add(gitCredentialPath);
  if (protectedCredentialPaths.size) registration.protectedCredentialPaths = [...protectedCredentialPaths].sort();
  if (existing?.protectedCredentialEnvironment) registration.protectedCredentialEnvironment = existing.protectedCredentialEnvironment;
  const audit = writeAuditIntent(projectRoot, preserveDisabled ? 'install' : 'activate', existing, registration);
  durableWrite(file, registration);
  return Object.freeze({ file, enabled, audit });
}

export function setSafetyHooksEnabled(projectRoot, enabled) {
  if (typeof enabled !== 'boolean') throw new Error('KSTACK_SAFETY_ENABLED_INVALID');
  const file = registrationPath(projectRoot);
  const value = existingRegistration(file);
  if (!value) throw new Error('KSTACK_SAFETY_REGISTRATION_ABSENT');
  const updated = { ...value, enabled };
  const audit = writeAuditIntent(projectRoot, enabled ? 'enable' : 'disable', value, updated);
  durableWrite(file, updated);
  return Object.freeze({ file, enabled, audit });
}

export function rollbackSafetyHooks(projectRoot) {
  const file = registrationPath(projectRoot);
  const existing = existingRegistration(file);
  if (!existing) return Object.freeze({ file, active: false, backup: null, audit: null });
  const rollbackDirectory = path.join(path.dirname(file), 'rollback');
  fs.mkdirSync(rollbackDirectory, { recursive: true, mode: 0o700 });
  const rollbackLink = fs.lstatSync(rollbackDirectory);
  if (rollbackLink.isSymbolicLink() || !rollbackLink.isDirectory() || fs.realpathSync.native(rollbackDirectory) !== rollbackDirectory) throw new Error('KSTACK_SAFETY_ROLLBACK_DIRECTORY_UNTRUSTED');
  const backup = path.join(rollbackDirectory, `safety-hooks-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.json`);
  const audit = writeAuditIntent(projectRoot, 'rollback', existing, null, { backup: path.relative(path.dirname(file), backup) });
  fs.renameSync(file, backup);
  const directory = fs.openSync(path.dirname(file), 'r');
  try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  return Object.freeze({ file, active: false, backup, audit });
}

function parseArguments(argv) {
  const command = argv[0] ?? 'status';
  let projectRoot = process.cwd();
  let pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === '--project-root') projectRoot = argv[++index];
    else if (argv[index] === '--plugin-root') pluginRoot = argv[++index];
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  return { command, projectRoot, pluginRoot };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  let result;
  if (options.command === 'activate') result = activateSafetyHooks(options);
  else if (options.command === 'install') result = activateSafetyHooks({ ...options, preserveDisabled: true });
  else if (options.command === 'enable') result = setSafetyHooksEnabled(options.projectRoot, true);
  else if (options.command === 'disable') result = setSafetyHooksEnabled(options.projectRoot, false);
  else if (options.command === 'rollback') result = rollbackSafetyHooks(options.projectRoot);
  else if (options.command === 'status') result = readActivation(options.projectRoot, { pluginRoot: options.pluginRoot });
  else throw new Error(`unknown command: ${options.command}`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
