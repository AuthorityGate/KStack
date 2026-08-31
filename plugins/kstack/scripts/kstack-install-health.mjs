#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MAX_CONTRACT_BYTES = 65_536;
const MAX_MANIFEST_BYTES = 262_144;
const MAX_CHILD_BYTES = 65_536;
const MAX_PUBLIC_BYTES = 262_144;
const IMPORT_MS = 5_000;
const REFLEXION_MS = 10_000;
const HOOK_MS = 3_000;
const CODEX_MS = 3_000;
const HEALTH_PREFIX = 'KSTACK_POST_DEPLOY_HEALTH_V1 ';
const CLAIM = 'installed-files-paths-lookups-structurally-sound-v1';
const CONTRACT_NAME = 'install-health-contract-v1.json';
const MANIFEST_NAME = 'install-health-audit-manifest-v1.json';
const REGISTRY_NAME = 'install-health-authority-registry-v1.json';
const CONTRACT_RELPATH = '.codex-plugin/reflexion-runtime-contract-v1.txt';
const SENTINEL_RELPATH = '.codex-plugin/reflexion-runtime-unavailable-v1';
const HEX64 = /^[0-9a-f]{64}$/u;

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function byteSort(left, right) { return Buffer.compare(Buffer.from(left), Buffer.from(right)); }
function exactKeys(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(','); }
function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!value || typeof value !== 'object') fail('KSTACK_POST_DEPLOY_CANONICAL_JSON_INVALID');
  return `{${Object.keys(value).sort(byteSort).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function canonicalBytes(value) { return Buffer.from(`${canonical(value)}\n`); }

function parseArgs(argv) {
  const value = { roots: [], surfaces: [], overrideRequest: null, overrideApproval: null, modernCodex: false, changedState: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const take = () => { const next = argv[index + 1]; if (next === undefined) fail('KSTACK_POST_DEPLOY_USAGE_ARGUMENT'); index += 1; return next; };
    if (arg === '--source-root') value.sourceRoot = take();
    else if (arg === '--host') value.host = take();
    else if (arg === '--scope') value.scope = take();
    else if (arg === '--mode') value.mode = take();
    else if (arg === '--changed-state') value.changedState = take() === 'true';
    else if (arg === '--root') value.roots.push({ rootId: take(), path: take(), reflexionState: take(), role: take() });
    else if (arg === '--surface') value.surfaces.push({ surfaceId: take(), host: take(), path: take(), rootPath: take(), mode: take() });
    else if (arg === '--modern-codex') value.modernCodex = true;
    else if (arg === '--override-request') value.overrideRequest = take();
    else if (arg === '--override-approval') value.overrideApproval = take();
    else fail('KSTACK_POST_DEPLOY_USAGE_ARGUMENT');
  }
  if (!path.isAbsolute(value.sourceRoot ?? '') || !['codex', 'claude', 'all'].includes(value.host) || !['user', 'project'].includes(value.scope) || !['symlink', 'copy'].includes(value.mode) || value.roots.length === 0 || Boolean(value.overrideRequest) !== Boolean(value.overrideApproval)) fail('KSTACK_POST_DEPLOY_USAGE_ARGUMENT');
  return value;
}

function readBoundedJson(file, maximum, code) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum) fail(code);
  const bytes = fs.readFileSync(file);
  if (bytes.length !== stat.size || bytes.includes(0)) fail(code);
  try { return { bytes, value: JSON.parse(bytes.toString('utf8')) }; } catch { fail(code); }
}

function validateContract(root) {
  const { bytes, value } = readBoundedJson(path.join(root, CONTRACT_NAME), MAX_CONTRACT_BYTES, 'KSTACK_POST_DEPLOY_CONTRACT_INVALID');
  if (!exactKeys(value, ['schemaVersion', 'contractId', 'skills', 'probes']) || value.schemaVersion !== 1 || value.contractId !== 'kstack-install-health-contract-v1' || !Array.isArray(value.skills) || !Array.isArray(value.probes)) fail('KSTACK_POST_DEPLOY_CONTRACT_INVALID');
  const skillIds = value.skills.map((item) => item?.skillId);
  const probeIds = value.probes.map((item) => item?.probeId);
  if (new Set(skillIds).size !== skillIds.length || new Set(probeIds).size !== probeIds.length || [...skillIds].sort(byteSort).join('\0') !== skillIds.join('\0') || [...probeIds].sort(byteSort).join('\0') !== probeIds.join('\0')) fail('KSTACK_POST_DEPLOY_CONTRACT_INVALID');
  const probes = new Map();
  for (const probe of value.probes) {
    if (!probe || Object.keys(probe).sort().join(',') !== 'kind,path,probeId' || !/^[a-z][a-z0-9-]{0,63}-v1$/u.test(probe.probeId) || !/^scripts\/[A-Za-z0-9][A-Za-z0-9._/-]*\.mjs$/u.test(probe.path) || path.posix.normalize(probe.path) !== probe.path || !['esm-import-v1', 'reflexion-no-match-v1'].includes(probe.kind)) fail('KSTACK_POST_DEPLOY_CONTRACT_INVALID');
    probes.set(probe.probeId, probe);
  }
  for (const skill of value.skills) {
    if (!skill || Object.keys(skill).sort().join(',') !== 'scripts,skillId' || !/^kstack-[a-z0-9-]+$/u.test(skill.skillId) || !Array.isArray(skill.scripts)) fail('KSTACK_POST_DEPLOY_CONTRACT_INVALID');
    for (const script of skill.scripts) if (!script || Object.keys(script).sort().join(',') !== 'path,probeId' || probes.get(script.probeId)?.path !== script.path) fail('KSTACK_POST_DEPLOY_CONTRACT_INVALID');
  }
  return { value, sha256: sha256(bytes), probes };
}

function scanSkillScripts(bytes) {
  const found = new Set();
  const expression = /(?:\$\{CLAUDE_PLUGIN_ROOT\}\/|<kstack-plugin-root>\/|\.\.\/\.\.\/)?(scripts\/[A-Za-z0-9][A-Za-z0-9._/-]*\.mjs)/gu;
  for (const match of bytes.matchAll(expression)) found.add(match[1]);
  return [...found].sort(byteSort);
}

function validateSourceSkills(sourceRoot, contract) {
  const expectedSkillIds = contract.value.skills.map((skill) => skill.skillId);
  const actualSkillIds = fs.readdirSync(path.join(sourceRoot, 'skills'), { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith('kstack-')).map((entry) => entry.name).sort(byteSort);
  if (actualSkillIds.join('\0') !== expectedSkillIds.join('\0')) fail('KSTACK_POST_DEPLOY_SKILL_SET_MISMATCH');
  for (const skill of contract.value.skills) {
    const bytes = fs.readFileSync(path.join(sourceRoot, 'skills', skill.skillId, 'SKILL.md'), 'utf8');
    const expected = [...new Set(skill.scripts.map((item) => item.path))].sort(byteSort);
    if (scanSkillScripts(bytes).join('\0') !== expected.join('\0')) fail('KSTACK_POST_DEPLOY_SKILL_SCRIPT_DECLARATION_MISMATCH');
  }
}

function validateManifest(sourceRoot) {
  const manifestPath = path.join(sourceRoot, MANIFEST_NAME);
  const { bytes, value } = readBoundedJson(manifestPath, MAX_MANIFEST_BYTES, 'KSTACK_POST_DEPLOY_MANIFEST_INVALID');
  if (!exactKeys(value, ['schema', 'manifestId', 'protocolVersion', 'sourceAuditManifestSha256', 'entries']) || value.schema !== 'kstack-install-health-audit-manifest-v1' || value.manifestId !== 'kstack-release-audit-v1' || value.protocolVersion !== 'kstack-install-health-coordinator-v1' || value.sourceAuditManifestSha256 !== null || !Array.isArray(value.entries)) fail('KSTACK_POST_DEPLOY_MANIFEST_INVALID');
  if (value.entries.some((entry) => entry?.path === MANIFEST_NAME)) fail('HC_MANIFEST_SELF_REFERENCE');
  let previous = null;
  for (const entry of value.entries) {
    if (!entry || Object.keys(entry).sort().join(',') !== 'executable,path,sha256,size' || typeof entry.path !== 'string' || path.posix.normalize(entry.path) !== entry.path || path.posix.isAbsolute(entry.path) || entry.path.startsWith('../') || !Number.isSafeInteger(entry.size) || entry.size < 0 || !HEX64.test(entry.sha256) || typeof entry.executable !== 'boolean' || (previous !== null && byteSort(previous, entry.path) >= 0)) fail('KSTACK_POST_DEPLOY_MANIFEST_INVALID');
    previous = entry.path;
    // The manifest records the modes that setup normalizes on the installed
    // runtime. A Git source checkout may legitimately have different modes;
    // source auditing binds its type, size, and bytes instead.
    verifyEntry(sourceRoot, entry, 'KSTACK_POST_DEPLOY_SOURCE_AUDIT_DIVERGENT', false);
  }
  return { value, sha256: sha256(bytes) };
}

function verifyEntry(root, entry, code, enforceExecutable = true) {
  const target = path.join(root, entry.path);
  let stat;
  try { stat = fs.lstatSync(target); } catch { fail(code); }
  // WSL's DrvFS/v9fs projection commonly reports an execute mask on every
  // file regardless of the Git mode. Byte/type checks and actual Node probes
  // remain binding there. Native Windows does not expose the manifest's POSIX
  // executable bit, so its byte/type checks and launched probes are binding.
  let modeProjected = process.platform === 'win32';
  if (!modeProjected) try { modeProjected = fs.statfsSync(target).type === 0x01021997; } catch {}
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== entry.size || (enforceExecutable && !modeProjected && Boolean(stat.mode & 0o111) !== entry.executable) || sha256(fs.readFileSync(target)) !== entry.sha256) fail(code);
}

function verifyInstalledEntry(sourceRoot, root, entry) {
  if (entry.path !== '.codex-plugin/plugin.json') {
    verifyEntry(root, entry, 'KSTACK_POST_DEPLOY_INSTALLED_ROOT_DIVERGENT');
    return;
  }
  const target = path.join(root, entry.path);
  const targetBytes = fs.readFileSync(target);
  if (targetBytes.length === entry.size && sha256(targetBytes) === entry.sha256) {
    verifyEntry(root, entry, 'KSTACK_POST_DEPLOY_INSTALLED_ROOT_DIVERGENT');
    return;
  }
  const stat = fs.lstatSync(target);
  let modeProjected = process.platform === 'win32';
  if (!modeProjected) try { modeProjected = fs.statfsSync(target).type === 0x01021997; } catch {}
  if (!stat.isFile() || stat.isSymbolicLink() || (!modeProjected && Boolean(stat.mode & 0o111) !== entry.executable)) fail('KSTACK_POST_DEPLOY_INSTALLED_ROOT_DIVERGENT');
  const source = readBoundedJson(path.join(sourceRoot, entry.path), MAX_CONTRACT_BYTES, 'KSTACK_POST_DEPLOY_INSTALLED_ROOT_DIVERGENT').value;
  const installed = readBoundedJson(target, MAX_CONTRACT_BYTES, 'KSTACK_POST_DEPLOY_INSTALLED_ROOT_DIVERGENT').value;
  const base = typeof source.version === 'string' ? source.version.split('+', 1)[0] : '';
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  if (!base || typeof installed.version !== 'string' || !new RegExp(`^${escapedBase}\\+codex\\.[0-9]{17}$`, 'u').test(installed.version)) fail('KSTACK_POST_DEPLOY_INSTALLED_ROOT_DIVERGENT');
  if (canonical({ ...source, version: null }) !== canonical({ ...installed, version: null })) fail('KSTACK_POST_DEPLOY_INSTALLED_ROOT_DIVERGENT');
}

function validateInstalledRoot(sourceRoot, root, manifest) {
  const hasSkills = fs.existsSync(path.join(root, 'skills'));
  for (const entry of manifest.value.entries) {
    if (!hasSkills && (entry.path.startsWith('skills/') || entry.path.startsWith('references/'))) continue;
    verifyInstalledEntry(sourceRoot, root, entry);
  }
  const { bytes } = readBoundedJson(path.join(root, MANIFEST_NAME), MAX_MANIFEST_BYTES, 'HC_MANIFEST_COPY_DIVERGENT');
  if (sha256(bytes) !== manifest.sha256) fail('HC_MANIFEST_COPY_DIVERGENT');
}

function runChild(argv, { cwd, timeout, environment = {} }) {
  const env = { PATH: process.env.PATH, HOME: environment.HOME ?? cwd, TMPDIR: environment.TMPDIR ?? cwd, XDG_CONFIG_HOME: environment.XDG_CONFIG_HOME ?? cwd, XDG_CACHE_HOME: environment.XDG_CACHE_HOME ?? cwd, XDG_STATE_HOME: environment.XDG_STATE_HOME ?? cwd, LANG: 'C.UTF-8' };
  const result = spawnSync(process.execPath, argv, { cwd, env, encoding: 'utf8', timeout, maxBuffer: MAX_CHILD_BYTES, shell: false, windowsHide: true, killSignal: 'SIGKILL' });
  return { ...result, launched: !result.error || result.error.code === 'ETIMEDOUT', timedOut: result.error?.code === 'ETIMEDOUT' };
}

function hookHosts(args, root) {
  if (args.host !== 'all') return [args.host];
  if (root.rootId.startsWith('codex-')) return ['codex'];
  if (root.rootId.startsWith('claude-')) return ['claude'];
  return ['codex', 'claude'];
}

function hookLaunchFailure(probeId, code, launched = false) {
  return { probeId, outcome: 'FAILED', code, launched, blocking: true, overridden: false, approvalRef: null };
}

function probeHookLaunch(root, host, scope) {
  const probeId = `safety-hook-${host}-${scope}-launch-v1`;
  let fixture;
  try {
    const manifestRelative = host === 'codex'
      ? readBoundedJson(path.join(root, '.codex-plugin', 'plugin.json'), MAX_CONTRACT_BYTES, 'KSTACK_POST_DEPLOY_HOOK_MANIFEST_INVALID').value.hooks
      : './hooks/hooks.json';
    if (manifestRelative !== (host === 'codex' ? './hooks/codex-hooks.json' : './hooks/hooks.json')) return hookLaunchFailure(probeId, 'KSTACK_POST_DEPLOY_HOOK_MANIFEST_INVALID');
    const manifest = readBoundedJson(path.join(root, manifestRelative.slice(2)), MAX_CONTRACT_BYTES, 'KSTACK_POST_DEPLOY_HOOK_MANIFEST_INVALID').value;
    if (!exactKeys(manifest, ['description', 'hooks']) || !exactKeys(manifest.hooks, ['PreToolUse']) || !Array.isArray(manifest.hooks.PreToolUse) || manifest.hooks.PreToolUse.length !== 1) return hookLaunchFailure(probeId, 'KSTACK_POST_DEPLOY_HOOK_MANIFEST_INVALID');
    const group = manifest.hooks.PreToolUse[0];
    if (!exactKeys(group, ['matcher', 'hooks']) || group.matcher !== '*' || !Array.isArray(group.hooks) || group.hooks.length !== 2) return hookLaunchFailure(probeId, 'KSTACK_POST_DEPLOY_HOOK_MANIFEST_INVALID');
    const handler = group.hooks.find((entry) => entry?.command?.endsWith(`--scope ${scope}`));
    const handlerKeys = host === 'codex' ? ['command', 'commandWindows', 'statusMessage', 'timeout', 'type'] : ['command', 'statusMessage', 'timeout', 'type'];
    const variable = host === 'codex' ? 'PLUGIN_ROOT' : 'CLAUDE_PLUGIN_ROOT';
    const expected = `node \"\${${variable}}/scripts/kstack-safety-hook.mjs\" --scope ${scope}`;
    if (!handler || !exactKeys(handler, handlerKeys) || handler.type !== 'command' || handler.timeout !== 2 || handler.command !== expected) return hookLaunchFailure(probeId, 'KSTACK_POST_DEPLOY_HOOK_MANIFEST_INVALID');
    if (host === 'codex' && handler.commandWindows !== `node \"%PLUGIN_ROOT%\\scripts\\kstack-safety-hook.mjs\" --scope ${scope}`) return hookLaunchFailure(probeId, 'KSTACK_POST_DEPLOY_HOOK_MANIFEST_INVALID');

    fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-health-hook-'));
    const input = {
      session_id: 'kstack-install-health', cwd: fixture, permission_mode: 'default', hook_event_name: 'PreToolUse',
      tool_name: 'Bash', tool_input: { command: 'git status' }, tool_use_id: `health-${scope}`,
      ...(host === 'codex' ? { model: 'health-probe', turn_id: 'health-turn' } : { prompt_id: 'health-prompt' })
    };
    const environment = {
      PATH: [path.dirname(process.execPath), process.env.PATH].filter(Boolean).join(path.delimiter),
      HOME: fixture, TMPDIR: fixture, XDG_CONFIG_HOME: fixture, XDG_CACHE_HOME: fixture, XDG_STATE_HOME: fixture, LANG: 'C.UTF-8'
    };
    environment[variable] = root;
    const command = process.platform === 'win32' ? handler.commandWindows : handler.command;
    const result = spawnSync(command, { cwd: fixture, env: environment, input: JSON.stringify(input), encoding: 'utf8', timeout: HOOK_MS, maxBuffer: MAX_CHILD_BYTES, shell: true, windowsHide: true, killSignal: 'SIGKILL' });
    if (result.error?.code === 'ETIMEDOUT') return hookLaunchFailure(probeId, 'KSTACK_POST_DEPLOY_HOOK_LAUNCH_TIMEOUT', true);
    if (result.error || result.status !== 0 || result.stderr !== '' || result.stdout !== '{}') return hookLaunchFailure(probeId, 'KSTACK_POST_DEPLOY_HOOK_LAUNCH_FAILED', !result.error);
    return { probeId, outcome: 'PASS', code: null, launched: true, blocking: false, overridden: false, approvalRef: null };
  } catch {
    return hookLaunchFailure(probeId, 'KSTACK_POST_DEPLOY_HOOK_MANIFEST_INVALID');
  } finally {
    if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
  }
}

function probeImport(root, probe) {
  const target = path.join(root, probe.path);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-health-import-'));
  try {
    const result = runChild(['--no-warnings', '--import', pathToFileURL(target).href, '-e', 'process.stdout.write("KSTACK_INSTALL_HEALTH_IMPORT_OK_V1\\n")'], { cwd: fixture, timeout: IMPORT_MS });
    if (result.timedOut) return { probeId: probe.probeId, outcome: 'TIMEOUT', code: 'KSTACK_POST_DEPLOY_IMPORT_TIMEOUT', launched: true, blocking: true, overridden: false, approvalRef: null };
    if (result.status !== 0 || result.stdout !== 'KSTACK_INSTALL_HEALTH_IMPORT_OK_V1\n' || result.stderr !== '') return { probeId: probe.probeId, outcome: 'FAILED', code: 'KSTACK_POST_DEPLOY_IMPORT_FAILED', launched: result.launched, blocking: true, overridden: false, approvalRef: null };
    return { probeId: probe.probeId, outcome: 'PASS', code: null, launched: true, blocking: false, overridden: false, approvalRef: null };
  } finally { try { fs.rmdirSync(fixture); } catch {} }
}

function probeReflexion(root, probe, state) {
  if (state === 'unavailable') return { probeId: probe.probeId, outcome: 'SKIPPED_UNAVAILABLE', code: 'KSTACK_POST_DEPLOY_REFLEXION_UNAVAILABLE', launched: false, blocking: false, overridden: false, approvalRef: null };
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-health-reflexion-'));
  const kstack = path.join(fixture, '.kstack');
  try {
    fs.mkdirSync(kstack, { mode: 0o700 });
    const template = runChild([path.join(root, 'scripts', 'kstack-config.mjs'), 'template'], { cwd: fixture, timeout: IMPORT_MS });
    if (template.status !== 0 || template.stderr !== '') return { probeId: probe.probeId, outcome: 'FAILED', code: 'KSTACK_POST_DEPLOY_REFLEXION_FIXTURE_FAILED', launched: template.launched, blocking: true, overridden: false, approvalRef: null };
    JSON.parse(template.stdout);
    fs.writeFileSync(path.join(kstack, 'config.json'), template.stdout, { mode: 0o600 });
    fs.writeFileSync(path.join(kstack, 'reflexion-lessons.json'), '[]\n', { mode: 0o600 });
    const result = runChild([path.join(root, probe.path), 'lookup', '--project-root', fixture, '--config', path.join(kstack, 'config.json'), '--keywords', 'kstack-install-health-nonce'], { cwd: fixture, timeout: REFLEXION_MS });
    if (result.timedOut) return { probeId: probe.probeId, outcome: 'TIMEOUT', code: 'KSTACK_POST_DEPLOY_REFLEXION_LOOKUP_TIMEOUT', launched: true, blocking: true, overridden: false, approvalRef: null };
    const noMatch = result.stdout.includes('<<<KSTACK_UNTRUSTED_REFLEXION_LESSONS_V1>>>\n- [no-match@v1]\n<<<END_KSTACK_UNTRUSTED_REFLEXION_LESSONS_V1>>>');
    if (result.status !== 0 || !noMatch || result.stderr !== '') return { probeId: probe.probeId, outcome: 'FAILED', code: 'KSTACK_POST_DEPLOY_REFLEXION_LOOKUP_FAILED', launched: result.launched, blocking: true, overridden: false, approvalRef: null };
    return { probeId: probe.probeId, outcome: 'PASS', code: null, launched: true, blocking: false, overridden: false, approvalRef: null };
  } catch {
    return { probeId: probe.probeId, outcome: 'FAILED', code: 'KSTACK_POST_DEPLOY_REFLEXION_FIXTURE_FAILED', launched: false, blocking: true, overridden: false, approvalRef: null };
  } finally {
    for (const target of [path.join(kstack, 'config.json'), path.join(kstack, 'reflexion-lessons.json')]) try { fs.unlinkSync(target); } catch {}
    try { fs.rmdirSync(kstack); } catch {}
    try { fs.rmdirSync(fixture); } catch {}
  }
}

function diagnostic(code, tier, severity, subjectId) { return { approvalRef: null, blocking: severity === 'failed', code, overridden: false, severity, subjectId, tier }; }

function validateReflexionState(root) {
  const contract = path.join(root.path, CONTRACT_RELPATH);
  const sentinel = path.join(root.path, SENTINEL_RELPATH);
  const contractPresent = (() => { try { const stat = fs.lstatSync(contract); return stat.isFile() && !stat.isSymbolicLink(); } catch { return false; } })();
  const sentinelPresent = (() => { try { const stat = fs.lstatSync(sentinel); return stat.isFile() && !stat.isSymbolicLink(); } catch { return false; } })();
  if (root.reflexionState === 'admitted' && (!contractPresent || sentinelPresent)) fail('KSTACK_POST_DEPLOY_REFLEXION_CONTRACT_MISSING');
  if (root.reflexionState === 'unavailable' && (contractPresent || !sentinelPresent)) fail('KSTACK_POST_DEPLOY_REFLEXION_UNAVAILABLE_STATE_INVALID');
  if (!['admitted', 'unavailable'].includes(root.reflexionState)) fail('KSTACK_POST_DEPLOY_REFLEXION_STATE_INVALID');
}

function validateSurface(surface, contract, sourceRoot) {
  const actual = fs.readdirSync(surface.path, { withFileTypes: true }).filter((entry) => entry.name.startsWith('kstack-') && !entry.name.includes('.backup.')).map((entry) => entry.name).sort(byteSort);
  const expected = contract.value.skills.map((skill) => skill.skillId);
  if (actual.join('\0') !== expected.join('\0')) fail('KSTACK_POST_DEPLOY_SKILL_SET_MISMATCH');
  for (const skillId of expected) {
    const target = path.join(surface.path, skillId);
    const stat = fs.lstatSync(target);
    if (surface.mode === 'symlink') {
      if (!stat.isSymbolicLink() || fs.realpathSync.native(target) !== path.join(fs.realpathSync.native(surface.rootPath), 'skills', skillId)) fail('KSTACK_POST_DEPLOY_SKILL_BINDING_MISMATCH');
    } else {
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail('KSTACK_POST_DEPLOY_SKILL_BINDING_MISMATCH');
      let expectedBytes = fs.readFileSync(path.join(sourceRoot, 'skills', skillId, 'SKILL.md'), 'utf8');
      if (surface.mode === 'copy') {
        const rootPath = fs.realpathSync.native(surface.rootPath);
        expectedBytes = expectedBytes.split('${CLAUDE_PLUGIN_ROOT}').join(rootPath).split('../../scripts/').join(`${rootPath}/scripts/`).split('<kstack-plugin-root>/scripts/').join(`${rootPath}/scripts/`);
      }
      if (fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8') !== expectedBytes) fail('KSTACK_POST_DEPLOY_SKILL_BINDING_MISMATCH');
    }
  }
  return { surfaceId: surface.surfaceId, host: surface.host, rootId: null, status: 'MATCH', diagnosticCodes: [] };
}

function codexJsonObservation(expectedRoot) {
  const calls = [['--version'], ['plugin', 'marketplace', 'list', '--json'], ['plugin', 'list', '--json']];
  const results = calls.map((args) => {
    const executable = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'codex';
    const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', ['codex', ...args].join(' ')] : args;
    return spawnSync(executable, commandArgs, { encoding: 'utf8', timeout: CODEX_MS, maxBuffer: MAX_CHILD_BYTES, shell: false, env: { PATH: process.env.PATH, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, ComSpec: process.env.ComSpec, LANG: 'C.UTF-8' }, killSignal: 'SIGKILL' });
  });
  if (results.some((result) => result.error || result.status !== 0 || result.stderr !== '')) return { status: 'UNAVAILABLE', code: 'KSTACK_POST_DEPLOY_CODEX_JSON_UNAVAILABLE' };
  try {
    const marketplaces = JSON.parse(results[1].stdout).marketplaces;
    const installed = JSON.parse(results[2].stdout).installed;
    if (!Array.isArray(marketplaces) || !Array.isArray(installed)) throw new Error();
    const marketplace = marketplaces.find((entry) => entry?.name === 'kstack');
    const plugin = installed.find((entry) => entry?.pluginId === 'kstack@kstack');
    const expected = fs.realpathSync.native(expectedRoot);
    const expectedVersion = JSON.parse(fs.readFileSync(path.join(expected, '.codex-plugin', 'plugin.json'), 'utf8')).version;
    if (!results[0].stdout.trim() || !marketplace || !plugin || plugin.installed !== true || plugin.enabled !== true || plugin.marketplaceName !== 'kstack' || plugin.version !== expectedVersion || plugin.source?.source !== 'local' || fs.realpathSync.native(plugin.source.path) !== expected || fs.realpathSync.native(marketplace.root) !== expected) return { status: 'MISMATCH', code: 'KSTACK_POST_DEPLOY_CODEX_JSON_MISMATCH' };
    return { status: 'MATCH', code: null };
  } catch { return { status: 'UNSUPPORTED', code: 'KSTACK_POST_DEPLOY_CODEX_JSON_UNSUPPORTED' }; }
}

function contextFor(args, manifestSha256, contractSha256, failures) {
  const roots = args.roots.map((root) => ({ logicalRootId: root.rootId, path: fs.realpathSync.native(root.path), reflexionState: root.reflexionState, role: root.role })).sort((left, right) => byteSort(`${left.logicalRootId}\0${left.path}`, `${right.logicalRootId}\0${right.path}`));
  const surfaces = args.surfaces.map((surface) => ({ surfaceId: surface.surfaceId, host: surface.host, path: fs.realpathSync.native(surface.path), rootPath: fs.realpathSync.native(surface.rootPath), mode: surface.mode })).sort((left, right) => byteSort(`${left.surfaceId}\0${left.path}`, `${right.surfaceId}\0${right.path}`));
  return { schema: 'override-request-context-v1', sourceAuditManifestSha256: manifestSha256, contractSha256, authorityRegistrySha256: sha256(fs.readFileSync(path.join(args.sourceRoot, REGISTRY_NAME))), coordinatorProtocolVersion: 'kstack-install-health-coordinator-v1', host: args.host, scope: args.scope, mode: args.mode, changedState: args.changedState, roots, surfaces, failureSubjects: failures.map((item) => ({ code: item.code, subjectId: item.subjectId })).sort((left, right) => byteSort(`${left.code}\0${left.subjectId}`, `${right.code}\0${right.subjectId}`)) };
}

function stateRoot() { return path.join(process.env.XDG_STATE_HOME || path.join(process.env.HOME, '.local', 'state'), 'kstack', 'install-health-overrides-v1'); }
function exportContext(context, digest) {
  const directory = stateRoot(); fs.mkdirSync(directory, { recursive: true, mode: 0o700 }); fs.chmodSync(directory, 0o700);
  const file = path.join(directory, `context-${digest}.json`);
  try { fs.writeFileSync(file, canonicalBytes({ schema: 'override-context-export-v1', overrideContextDigestV1: digest, overrideRequestContext: context }), { mode: 0o600, flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  return file;
}

function canonicalBase64(value, length) {
  if (typeof value !== 'string') fail('HC_OVERRIDE_SIGNATURE_INVALID');
  const raw = Buffer.from(value, 'base64');
  if (raw.length !== length || raw.toString('base64') !== value) fail('HC_OVERRIDE_SIGNATURE_INVALID');
  return raw;
}
function keyObject(publicKeyBase64) {
  const raw = canonicalBase64(publicKeyBase64, 32);
  return crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw]), format: 'der', type: 'spki' });
}
function transcript(tag, object, requestSha256 = null) {
  const body = canonicalBytes(object); const length = Buffer.alloc(8); length.writeBigUInt64BE(BigInt(body.length));
  if (!requestSha256) return Buffer.concat([Buffer.from(tag), length, body]);
  const digestLength = Buffer.alloc(8); digestLength.writeBigUInt64BE(32n);
  return Buffer.concat([Buffer.from(tag), digestLength, Buffer.from(requestSha256, 'hex'), length, body]);
}
function verifyOverride(args, context, digest, failures) {
  if (!args.overrideRequest) return null;
  const registry = readBoundedJson(path.join(args.sourceRoot, REGISTRY_NAME), MAX_CONTRACT_BYTES, 'HC_OVERRIDE_REGISTRY_INVALID').value;
  const request = readBoundedJson(args.overrideRequest, MAX_CONTRACT_BYTES, 'HC_OVERRIDE_REQUEST_INVALID').value;
  const approval = readBoundedJson(args.overrideApproval, MAX_CONTRACT_BYTES, 'HC_OVERRIDE_APPROVAL_INVALID').value;
  const reasonCodes = new Set(['TRANSIENT_TIMEOUT', 'TRANSIENT_PRIVATE_RESOURCE', 'SECONDARY_ARTIFACT_FALSE_POSITIVE', 'NON_REFLEXION_IMPORT_FALSE_POSITIVE']);
  if (!exactKeys(registry, ['schema', 'principals']) || registry.schema !== 'kstack-install-health-authority-registry-v1' || !Array.isArray(registry.principals)
      || !exactKeys(request, ['schema', 'overrideContextDigestV1', 'approvedFailureSubjects', 'reasonCode', 'requestNonce', 'issuedAt', 'expiresAt', 'requesterPrincipalId', 'requesterSig']) || request.schema !== 'override-request-v1' || !HEX64.test(request.overrideContextDigestV1) || !/^[0-9a-f]{32}$/u.test(request.requestNonce) || !reasonCodes.has(request.reasonCode)
      || !exactKeys(approval, ['schema', 'requestSha256', 'approverPrincipalId', 'approverSig']) || approval.schema !== 'override-approval-v1' || !HEX64.test(approval.requestSha256)) fail('HC_OVERRIDE_SCHEMA_INVALID');
  const principalIds = new Set(); const publicKeys = new Set();
  for (const principal of registry.principals) {
    if (!exactKeys(principal, ['principalId', 'publicKeyBase64', 'roles']) || !/^[a-z][a-z0-9-]{0,63}$/u.test(principal.principalId) || !Array.isArray(principal.roles) || principal.roles.length === 0 || principal.roles.some((role) => !['approver', 'requester'].includes(role)) || new Set(principal.roles).size !== principal.roles.length || principalIds.has(principal.principalId) || publicKeys.has(principal.publicKeyBase64)) fail('HC_OVERRIDE_REGISTRY_INVALID');
    keyObject(principal.publicKeyBase64); principalIds.add(principal.principalId); publicKeys.add(principal.publicKeyBase64);
  }
  const requester = registry?.principals?.find((item) => item.principalId === request.requesterPrincipalId && item.roles?.includes('requester'));
  const approver = registry?.principals?.find((item) => item.principalId === approval.approverPrincipalId && item.roles?.includes('approver'));
  if (!requester || !approver || requester.principalId === approver.principalId || requester.publicKeyBase64 === approver.publicKeyBase64 || request.overrideContextDigestV1 !== digest || canonical(request.approvedFailureSubjects) !== canonical(context.failureSubjects)) fail('HC_OVERRIDE_NOT_APPLICABLE');
  const now = Date.now(); const issued = Date.parse(request.issuedAt); const expires = Date.parse(request.expiresAt);
  const seconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
  const canonicalSecond = (value, millis) => Number.isFinite(millis) && new Date(millis).toISOString().replace('.000Z', 'Z') === value;
  if (!seconds.test(request.issuedAt) || !seconds.test(request.expiresAt) || !canonicalSecond(request.issuedAt, issued) || !canonicalSecond(request.expiresAt, expires) || now < issued || now >= expires || expires <= issued || expires - issued > 86_400_000) fail('HC_OVERRIDE_NOT_APPLICABLE');
  const requestUnsigned = { ...request }; delete requestUnsigned.requesterSig;
  const requestSignature = canonicalBase64(request.requesterSig, 64);
  if (!crypto.verify(null, transcript('KSTACK-ED25519-REQUEST-V1\n', requestUnsigned), keyObject(requester.publicKeyBase64), requestSignature)) fail('HC_OVERRIDE_SIGNATURE_INVALID');
  const requestSha256 = sha256(canonicalBytes(request));
  if (approval.requestSha256 !== requestSha256) fail('HC_OVERRIDE_NOT_APPLICABLE');
  const approvalUnsigned = { ...approval }; delete approvalUnsigned.approverSig;
  const approvalSignature = canonicalBase64(approval.approverSig, 64);
  if (!crypto.verify(null, transcript('KSTACK-ED25519-APPROVAL-V1\n', approvalUnsigned, requestSha256), keyObject(approver.publicKeyBase64), approvalSignature)) fail('HC_OVERRIDE_SIGNATURE_INVALID');
  if (Date.now() >= expires) fail('HC_OVERRIDE_NOT_APPLICABLE');
  const directory = stateRoot(); fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const existing = fs.readdirSync(directory).filter((name) => name.startsWith(`use-${requestSha256}-`));
  if (existing.length >= 3) fail('HC_OVERRIDE_MAX_USES');
  const useIndex = existing.length + 1; const audit = { schema: 'kstack-install-health-override-use-v1', requestSha256, approvalSha256: sha256(canonicalBytes(approval)), overrideContextDigestV1: digest, requesterPrincipalId: requester.principalId, approverPrincipalId: approver.principalId, failures: context.failureSubjects, useIndex, usedAt: new Date().toISOString(), outcome: 'DEGRADED_OVERRIDE' };
  fs.writeFileSync(path.join(directory, `use-${requestSha256}-${useIndex}.json`), canonicalBytes(audit), { mode: 0o600, flag: 'wx' });
  return { requestSha256, useIndex };
}

function main(argv) {
  let args;
  try { args = parseArgs(argv); } catch (error) { process.stderr.write(`KSTACK_POST_DEPLOY_USAGE ${error.code ?? 'KSTACK_POST_DEPLOY_USAGE_ARGUMENT'}\n`); process.exitCode = 2; return; }
  const diagnostics = []; const roots = []; const surfaces = [];
  let sourceManifestSha256 = null; let contractSha256 = null; let terminalCode = null;
  try {
    const sourceRoot = fs.realpathSync.native(args.sourceRoot);
    const contract = validateContract(sourceRoot); contractSha256 = contract.sha256;
    validateSourceSkills(sourceRoot, contract);
    const manifest = validateManifest(sourceRoot); sourceManifestSha256 = manifest.sha256;
    for (const rootInput of args.roots) {
      const rootPath = fs.realpathSync.native(rootInput.path); const root = { ...rootInput, path: rootPath };
      validateInstalledRoot(sourceRoot, rootPath, manifest); validateReflexionState(root);
      const probeResults = [];
      for (const hookHost of hookHosts(args, root)) {
        for (const scope of ['user', 'project']) {
          const result = probeHookLaunch(rootPath, hookHost, scope);
          probeResults.push(result);
          if (result.blocking) break;
        }
        if (probeResults.some((probe) => probe.blocking)) break;
      }
      if (root.role !== 'provisioning') {
        for (const probe of contract.value.probes) {
          const result = probe.kind === 'esm-import-v1' ? probeImport(rootPath, probe) : probeReflexion(rootPath, probe, root.reflexionState);
          probeResults.push(result);
          // A failed installed module invalidates the root. Stop launching
          // transitive dependants so one hung shared import consumes one
          // timeout budget instead of multiplying it across every skill.
          if (result.blocking) break;
        }
      }
      const failure = probeResults.some((probe) => probe.blocking); const degraded = probeResults.some((probe) => probe.outcome === 'SKIPPED_UNAVAILABLE');
      roots.push({ rootId: root.rootId, role: root.role, status: failure ? 'FAILED' : degraded ? 'DEGRADED' : root.role === 'provisioning' ? 'NOT_APPLICABLE' : 'PASS', executedProbeCount: probeResults.filter((probe) => probe.launched).length, probeResults });
    }
    for (const surface of args.surfaces) surfaces.push(validateSurface(surface, contract, sourceRoot));
    if (args.modernCodex) {
      const native = args.roots.find((root) => root.role === 'provisioning' || root.role === 'provisioning-and-execution');
      const observation = codexJsonObservation(native?.path ?? args.sourceRoot);
      surfaces.push({ surfaceId: 'codex-json', host: 'codex', rootId: null, status: observation.status, diagnosticCodes: observation.code ? [observation.code] : [] });
      if (observation.code) diagnostics.push(diagnostic(observation.code, 'third-party-codex', 'degraded', 'codex-json'));
    }
  } catch (error) {
    terminalCode = error.code ?? 'KSTACK_POST_DEPLOY_INTERNAL';
    diagnostics.push(diagnostic(terminalCode, 'kstack-structural', 'failed', 'health-runner'));
  }
  for (const root of roots) for (const probe of root.probeResults) if (probe.blocking) diagnostics.push(diagnostic(probe.code, probe.probeId === 'reflexion-no-match-v1' ? 'reflexion-availability' : 'kstack-structural', 'failed', `${root.rootId}:${probe.probeId}`));
  const failures = diagnostics.filter((item) => item.severity === 'failed');
  const overrideEligible = failures.length > 0 && !terminalCode && failures.every((item) => item.code === 'KSTACK_POST_DEPLOY_IMPORT_FAILED' || item.code === 'KSTACK_POST_DEPLOY_IMPORT_TIMEOUT');
  let override = { used: false, requestSha256: null, auditRef: null }; let status;
  if (failures.length > 0) {
    const context = contextFor(args, sourceManifestSha256, contractSha256, failures); const digest = sha256(canonicalBytes(context));
    if (overrideEligible) {
      try {
        const accepted = verifyOverride(args, context, digest, failures);
        if (accepted) { for (const item of failures) { item.overridden = true; item.approvalRef = accepted.requestSha256; } for (const root of roots) for (const probe of root.probeResults) if (probe.blocking) { probe.overridden = true; probe.approvalRef = accepted.requestSha256; } override = { used: true, requestSha256: accepted.requestSha256, auditRef: `audit:${accepted.requestSha256}:${accepted.useIndex}` }; status = 'DEGRADED_OVERRIDE'; }
        else { exportContext(context, digest); process.stderr.write(`KSTACK_POST_DEPLOY_OVERRIDE_CONTEXT_EXPORTED context:${digest}\n`); }
      } catch (error) { diagnostics.push(diagnostic(error.code ?? 'HC_OVERRIDE_NOT_APPLICABLE', 'override', 'failed', 'override')); }
    }
    status ??= 'FAILED';
  } else if (roots.some((root) => root.status === 'DEGRADED') || diagnostics.some((item) => item.severity === 'degraded') || surfaces.some((surface) => surface.status !== 'MATCH')) status = 'DEGRADED';
  else status = 'PASS';
  const result = { schemaVersion: 1, activationClaim: CLAIM, interactiveActivationTested: false, overallStatus: status, exitCode: status === 'FAILED' ? 1 : 0, changedState: args.changedState, sourceAuditManifestSha256: sourceManifestSha256, roots, surfaces: surfaces.sort((left, right) => byteSort(left.surfaceId, right.surfaceId)), diagnostics, override };
  const bytes = canonicalBytes(result); if (bytes.length > MAX_PUBLIC_BYTES) { process.stderr.write('KSTACK_POST_DEPLOY_PUBLIC_RESULT_TOO_LARGE\n'); process.exitCode = 1; return; }
  process.stdout.write(`${HEALTH_PREFIX}${bytes}`);
  if (result.exitCode === 1 && args.changedState) process.stderr.write('KSTACK_POST_DEPLOY_MANUAL_RECOVERY_REQUIRED: no automatic rollback ran; inspect the timestamped backups reported by setup, move the active path aside, restore only the intended backup, and rerun setup.\n');
  process.exitCode = result.exitCode;
}

main(process.argv.slice(2));
