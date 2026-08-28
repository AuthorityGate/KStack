#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findOutboundSecret } from './kstack-safety-matchers.mjs';

const INPUT_LIMIT = 8 * 1024;
const OUTPUT_LIMIT = 4 * 1024;
const ASK_FAMILIES = new Set(['git-commit', 'git-push', 'git-merge', 'git-destructive', 'git-unsupported', 'provider-pr-create', 'provider-merge', 'external-ticket-create', 'jira-administration']);
const AUTHORITY_KEYS = Object.freeze(['inspect', 'edit', 'test', 'commit', 'push', 'pullRequest', 'merge', 'deploy', 'deviceInstall', 'destructive', 'externalTicketCreation', 'jiraAdministration']);
const FAMILY_AUTHORITY = Object.freeze({
  'git-commit': 'commit', 'git-push': 'push', 'git-merge': 'merge', 'git-destructive': 'destructive',
  'provider-pr-create': 'pullRequest', 'provider-merge': 'merge', 'external-ticket-create': 'externalTicketCreation',
  'jira-administration': 'jiraAdministration',
  deploy: 'deploy', 'device-install': 'deviceInstall'
});
const BROKER_ACTION_FAMILY = Object.freeze({
  'git-commit': 'git-commit', 'git-push': 'git-push', 'git-merge': 'git-merge', 'git-destructive': 'git-destructive',
  'provider-pr-create': 'provider-pr-create', 'provider-merge': 'provider-merge', 'jira-ticket-create': 'external-ticket-create'
});
const SECRET_NAMES = /\b(?:ANTHROPIC_API_KEY|OPENAI_API_KEY|JIRA_API_TOKEN|ATLASSIAN_API_TOKEN|AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN|GH_TOKEN|NPM_TOKEN|PASSWORD|PASSWD|CLIENT_SECRET|ACCESS_TOKEN)\b/iu;
const SECRET_PATHS = /(?:^|[\s'"=:/\\])(\.env(?:\.[A-Za-z0-9_.-]+)?|\.npmrc|\.pypirc|\.netrc|\.git-credentials|\.aws[\\/]credentials|\.config[\\/]gh[\\/]hosts\.yml|\.ssh[\\/](?:id_[A-Za-z0-9_-]+|config)|credentials?\.json)(?:$|[\s'";,/\\])/iu;
const CONTROL_PATHS = /(?:^|[\s'"=:/\\])(?:\.kstack[\\/](?:config\.json|safety-hooks\.json)|\.claude[\\/](?:settings(?:\.local)?\.json|hooks)|\.codex[\\/](?:config\.toml|hooks)|\.(?:codex|claude)-plugin[\\/](?:plugin|marketplace)\.json|setup|kstack-(?:git-askpass|jira-bootstrap|safety-(?:admin|hook|broker|executor|worker|matchers))\.mjs)(?:$|[\s'";,/\\])/iu;
const DIRECT_BROKER = /(?:^|[\s'"/])kstack-(?:git-askpass|safety-(?:broker|executor|worker))\.mjs(?:$|[\s'";])/iu;

function response(decision, reason, host) {
  if (decision === 'abstain') return reason ? { systemMessage: reason } : {};
  if (host === 'codex' && decision === 'ask') throw new Error('Codex ask is structurally prohibited');
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason
    }
  };
}

function serializedBounded(value, host) {
  let bytes = Buffer.from(JSON.stringify(value), 'utf8');
  if (bytes.length <= OUTPUT_LIMIT) return bytes;
  bytes = Buffer.from(JSON.stringify(response('deny', 'KStack safety response exceeded its fixed transport bound.', host)), 'utf8');
  if (bytes.length > OUTPUT_LIMIT) throw new Error('fixed denial response exceeds output bound');
  return bytes;
}

export function detectHookHost(input, environment = process.env) {
  if (typeof environment.PLUGIN_ROOT === 'string' && environment.PLUGIN_ROOT.length > 0) return 'codex';
  return Object.hasOwn(input, 'model') || Object.hasOwn(input, 'turn_id') ? 'codex' : 'claude';
}

function shellText(input) {
  if (typeof input?.tool_input?.command === 'string') return input.tool_input.command;
  if (typeof input?.tool_input?.file_path === 'string') return input.tool_input.file_path;
  return JSON.stringify(input?.tool_input ?? null);
}

function configuredCredentialReference(text, activation) {
  const paths = new Set(activation.registration?.protectedCredentialPaths ?? []);
  const names = new Set(activation.registration?.protectedCredentialEnvironment ?? []);
  const source = activation.credentialSource;
  if (source?.type === 'file' && typeof source.path === 'string') paths.add(source.path);
  if (source?.type === 'env') {
    if (typeof source.emailEnvVar === 'string') names.add(source.emailEnvVar);
    if (typeof source.tokenEnvVar === 'string') names.add(source.tokenEnvVar);
  }
  for (const protectedPath of paths) if (typeof protectedPath === 'string' && path.isAbsolute(protectedPath) && text.includes(protectedPath)) return true;
  for (const name of names) if (typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) && new RegExp(`(?:\\$\\{?${name}\\}?|\\b(?:printenv|env)\\s+${name}\\b)`, 'u').test(text)) return true;
  return false;
}

function isControlPlaneMutation(input, text) {
  if (!CONTROL_PATHS.test(text)) return false;
  if (['Write', 'Edit', 'apply_patch'].includes(input.tool_name)) return true;
  if (!['Bash', 'PowerShell'].includes(input.tool_name)) return false;
  return /(?:^|[;&|]\s*|\b)(?:rm|mv|cp|install|truncate|tee|chmod|chown|ln|touch)\b|\bsed\s+-[^\s]*i\b|\bperl\s+-[^\s]*i\b|(?:>|>>)/iu.test(text);
}

export function classifySafetyAction(input) {
  const tool = typeof input?.tool_name === 'string' ? input.tool_name : '';
  const text = shellText(input);
  if (tool === 'mcp__kstack_safety__execute') return 'broker-execute';
  if (DIRECT_BROKER.test(text)) return 'broker-direct';
  if (SECRET_NAMES.test(text) || SECRET_PATHS.test(text)) return 'credential-access';
  if (/(?:^|[;&|]\s*|\b)(?:adb\s+(?:install|uninstall)|xcrun\s+simctl\s+install)\b/iu.test(text)) return 'device-install';
  if (/(?:^|[;&|]\s*|\b)(?:kubectl\s+(?:apply|delete|replace|patch)|terraform\s+(?:apply|destroy)|wrangler\s+deploy|npm\s+publish)\b/iu.test(text)) return 'deploy';
  if (/\bgit(?:\s+-[^\s]+)*\s+commit\b/iu.test(text)) return 'git-commit';
  if (/\bgit(?:\s+-[^\s]+)*\s+push\b/iu.test(text)) return 'git-push';
  if (/\bgit(?:\s+-[^\s]+)*\s+merge\b/iu.test(text)) return 'git-merge';
  if (/\bgit(?:\s+-[^\s]+)*\s+(?:reset\s+--hard|clean\b|checkout\s+--|restore\b|branch\s+-D\b|tag\s+-d\b|worktree\s+(?:remove|prune)|stash\s+(?:drop|clear)|reflog\s+expire|gc\b|rm\b)/iu.test(text)) return 'git-destructive';
  if (/(?:^|[;&|]\s*|\b)rm\s+(?:-[A-Za-z]*r[A-Za-z]*|--recursive)\b/iu.test(text)) return 'git-destructive';
  if (/\bgh\s+pr\s+create\b/iu.test(text)) return 'provider-pr-create';
  if (/\bgh\s+pr\s+merge\b/iu.test(text)) return 'provider-merge';
  if (/\bkstack-jira-bootstrap\.mjs\s+(?:approve|apply)\b/iu.test(text)) return 'jira-administration';
  if (/\b(?:kstack-jira\.mjs|npm\s+run\s+jira\s+--)\s+submit\b|\b(?:jira|acli)\s+(?:issue|ticket)\s+create\b|\bgh\s+issue\s+create\b/iu.test(text)) return 'external-ticket-create';
  if (/\bgit\b/iu.test(text)) {
    const unsafeOption = /(?:^|\s)(?:-c|--config-env|--paginate|--exec-path|--html-path|--man-path|--info-path|--no-replace-objects|--ext-diff|--textconv|--output)(?:[=\s]|$)/iu.test(text);
    const readOnly = /\bgit(?:\s+--no-pager)?\s+(?:status|diff|show|log|blame|grep|ls-files|ls-tree|rev-parse|rev-list|merge-base|cat-file|for-each-ref)\b|\bgit(?:\s+--no-pager)?\s+branch\s+--show-current\b|\bgit(?:\s+--no-pager)?\s+remote\s+(?:-v|get-url)\b|\bgit(?:\s+--no-pager)?\s+config\s+(?:--get|--get-all|--show-origin)\b/iu.test(text);
    if (!readOnly || unsafeOption) return 'git-unsupported';
  }
  return 'unrecognized';
}

function findProjectRoot(cwd) {
  let current;
  try { current = fs.realpathSync.native(cwd); } catch { return null; }
  for (;;) {
    const registration = path.join(current, '.kstack', 'safety-hooks.json');
    if (fs.existsSync(registration)) return { root: current, registration };
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function readTrustedProjectFile(root, relative, maximumBytes) {
  const stateDirectory = path.join(root, '.kstack');
  const stateLink = fs.lstatSync(stateDirectory);
  if (stateLink.isSymbolicLink() || !stateLink.isDirectory() || fs.realpathSync.native(stateDirectory) !== stateDirectory || (stateLink.mode & 0o022) !== 0) throw new Error('untrusted state directory');
  const file = path.join(stateDirectory, relative);
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fs.fstatSync(descriptor);
    const link = fs.lstatSync(file);
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    if (!stat.isFile() || link.isSymbolicLink() || !link.isFile() || link.dev !== stat.dev || link.ino !== stat.ino || (stat.mode & 0o022) !== 0 || (uid !== null && stat.uid !== uid && stat.uid !== 0) || stat.size > maximumBytes) throw new Error('untrusted project file');
    return fs.readFileSync(descriptor);
  } finally { fs.closeSync(descriptor); }
}

function validatedAuthority(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config) || !config.authority || typeof config.authority !== 'object' || Array.isArray(config.authority)) throw new Error('authority is absent');
  const authority = {};
  for (const key of AUTHORITY_KEYS) {
    const value = key === 'jiraAdministration' && config.authority[key] === undefined ? 'deny' : config.authority[key];
    if (!['allow', 'ask', 'deny'].includes(value)) throw new Error('authority is invalid');
    authority[key] = value;
  }
  return Object.freeze(authority);
}

function authorityFor(family, activation) {
  const key = FAMILY_AUTHORITY[family];
  return key ? activation.authority?.[key] : null;
}

export function readActivation(cwd, { pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || process.env.PLUGIN_ROOT } = {}) {
  const found = findProjectRoot(cwd);
  if (!found) return Object.freeze({ active: false, status: 'OUTSIDE-ENROLLMENT' });
  try {
    const registrationBytes = readTrustedProjectFile(found.root, 'safety-hooks.json', 64 * 1024);
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(registrationBytes));
    if (value.schemaVersion !== 1 || typeof value.enabled !== 'boolean' || value.activation?.user !== true || value.activation?.project !== true) throw new Error('registration schema is invalid');
    if (value.enabled === false) return Object.freeze({ active: false, status: 'DISABLED', root: found.root });
    const configBytes = readTrustedProjectFile(found.root, 'config.json', 1024 * 1024);
    const config = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(configBytes));
    const authority = validatedAuthority(config);
    let status = 'ENABLED';
    const policyDigest = crypto.createHash('sha256').update(configBytes).digest('hex');
    if (typeof value.policyDigest !== 'string' || value.policyDigest !== policyDigest || !Number.isSafeInteger(value.policyGeneration) || value.policyGeneration < 1) status = 'TAMPERED';
    if (value.releaseDigests && pluginRoot) {
      for (const [relative, expected] of Object.entries(value.releaseDigests)) {
        const candidate = path.resolve(pluginRoot, relative);
        if (!candidate.startsWith(`${path.resolve(pluginRoot)}${path.sep}`) || typeof expected !== 'string' || !/^[0-9a-f]{64}$/u.test(expected)) { status = 'TAMPERED'; break; }
        try {
          const bytes = fs.readFileSync(candidate);
          const actual = crypto.createHash('sha256').update(bytes).digest('hex');
          if (actual !== expected) { status = 'TAMPERED'; break; }
        } catch { status = 'TAMPERED'; break; }
      }
    }
    const activation = { active: true, status, root: found.root, policyDigest, policyGeneration: value.policyGeneration };
    Object.defineProperties(activation, {
      authority: { value: authority },
      credentialSource: { value: config?.jira?.credentialSource },
      registration: { value }
    });
    return Object.freeze(activation);
  } catch { return Object.freeze({ active: false, status: 'UNTRUSTED', root: found.root }); }
}

export async function evaluateSafetyHook(input, { scope = 'user', verifyAttestation } = {}) {
  if (!input || input.hook_event_name !== 'PreToolUse' || typeof input.tool_name !== 'string' || input.tool_name.length > 256 || typeof input.cwd !== 'string' || !path.isAbsolute(input.cwd) || !plainInput(input.tool_input)) return response('deny', 'KStack rejected a malformed hook envelope.', detectHookHost(input ?? {}));
  const host = detectHookHost(input);
  const activation = readActivation(typeof input.cwd === 'string' ? input.cwd : '');
  let family = classifySafetyAction(input);
  const text = shellText(input);
  try {
    if (findOutboundSecret(Buffer.from(JSON.stringify(input.tool_input), 'utf8')) || (activation.root && configuredCredentialReference(text, activation))) family = 'credential-access';
  } catch { return response('deny', 'KStack rejected an unscannable tool request.', host); }
  if (!activation.active) {
    if (activation.status === 'OUTSIDE-ENROLLMENT') return response('abstain', null, host);
    const covered = family !== 'unrecognized';
    return covered && activation.status === 'UNTRUSTED'
      ? response('deny', 'KStack enrollment is untrusted; this covered action is unavailable.', host)
      : response('abstain', `KStack safety hooks are ${activation.status}; bounded coverage is inactive.`, host);
  }
  const tamper = isControlPlaneMutation(input, text);
  if (activation.status === 'TAMPERED' && family === 'broker-execute') return response('deny', 'KStack control-plane tamper evidence invalidated this prepared execution.', host);
  if (family === 'unrecognized') return response('abstain', tamper || activation.status === 'TAMPERED' ? 'KStack control-plane change detected; enforcement files are detect-only and may be disabled by their owner.' : null, host);
  if (family === 'broker-direct') return response('deny', 'KSG-BROKER-DIRECT-001: direct broker execution is unavailable.', host);
  if (family === 'broker-execute') {
    if (host === 'codex') return response('abstain', 'KStack does not claim forced approval for ask-tier actions on Codex.', host);
    if (typeof verifyAttestation !== 'function') return response('deny', 'KSG-BROKER-UNAVAILABLE-001: the certified approval-bound broker channel is unavailable.', host);
    const verdict = await verifyAttestation(input.tool_input, { scope, toolUseId: input.tool_use_id, sessionId: input.session_id });
    const verdictFamily = BROKER_ACTION_FAMILY[verdict?.action];
    if (!verdict || verdict.valid !== true || !verdictFamily || authorityFor(verdictFamily, activation) !== 'ask' || typeof verdict.preview !== 'string' || Buffer.byteLength(verdict.preview, 'utf8') > 2_048 || typeof verdict.previewDigest !== 'string' || !/^[0-9a-f]{64}$/u.test(verdict.previewDigest)) return response('deny', 'KSG-ATTESTATION-001: prepared request verification failed.', host);
    const ask = response('ask', `KStack prepared ${verdict.action}: ${verdict.preview}`, host);
    if (serializedBounded(ask, host).toString('utf8') !== JSON.stringify(ask)) return response('deny', 'KSG-PREVIEW-LIMIT-001: the approval prompt exceeds its fixed transport budget.', host);
    return ask;
  }
  if (family === 'credential-access') return response('deny', 'KStack policy blocks this action before protected content can reach the tool.', host);
  if (host === 'codex') {
    const authority = authorityFor(family, activation);
    if (family === 'jira-administration' && authority !== 'allow') return response('deny', 'KStack Jira administration is unavailable on the covered Codex path until the owner runs the approved host-side command.', host);
    if (authority !== 'deny') return response('abstain', 'KStack does not claim forced approval for this ask-tier action on Codex.', host);
    return response('deny', 'KStack authority policy blocks this action on the covered Codex tool path.', host);
  }
  const authority = authorityFor(family, activation);
  if (authority === 'deny') return response('deny', 'KStack authority policy blocks this action on the covered Claude tool path.', host);
  if (family === 'git-unsupported') return response('deny', 'KSG-GIT-MUTATION-UNSUPPORTED-001: this Git form is outside the admitted read-only grammar.', host);
  if (authority === 'ask') return response('deny', ASK_FAMILIES.has(family)
    ? 'KStack requires the broker prepare/execute path for this protected action.'
    : 'KStack cannot execute this ask-tier action without an admitted broker capability.', host);
  return response('abstain', tamper ? 'KStack control-plane change detected.' : null, host);
}

function plainInput(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }

async function readInput() {
  const chunks = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    total += chunk.length;
    if (total > INPUT_LIMIT) throw new Error('hook envelope exceeds 8 KiB');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

async function main() {
  const scopeIndex = process.argv.indexOf('--scope');
  const scope = scopeIndex >= 0 ? process.argv[scopeIndex + 1] : 'user';
  let host = detectHookHost({});
  let output;
  try {
    const input = await readInput();
    host = detectHookHost(input);
    output = await evaluateSafetyHook(input, { scope });
  } catch { output = response('deny', 'KStack safety hook failed before evaluation.', host); }
  const bytes = serializedBounded(output, host);
  process.stdout.write(bytes);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main().catch(() => { process.stderr.write('KStack safety hook failed.\n'); process.exitCode = 2; });

export { serializedBounded as serializeHookResponse };
