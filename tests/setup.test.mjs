import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fakeNodeFixture(codexMode = null) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-setup-node-'));
  const node = path.join(directory, 'node');
  const log = path.join(directory, 'calls.log');
  fs.writeFileSync(node, `#!/bin/sh
for kstack_fd in /proc/self/fd/*; do
  if [ "$(readlink "$kstack_fd" 2>/dev/null)" = "$HOME/.kstack/install-health/locks/setup.lock" ]; then
    printf '%s\\n' KSTACK_SETUP_TEST_LOCK_FD_LEAKED >&2
    exit 91
  fi
done
if [ "\${1:-}" = "-e" ]; then exec "$KSTACK_REAL_NODE" "$@"; fi
printf '%s\\n' "$*" >> "$KSTACK_SETUP_TEST_LOG"
if [ "$KSTACK_SETUP_HEALTH_MODE" = "real" ]; then
  case "$*" in
    *kstack-install-health.mjs*|*kstack-safety-hook.mjs*|*unavailable-sentinel.mjs*|*kstack-reflexion.mjs*runtime-contract-generate*) exec "$KSTACK_REAL_NODE" "$@" ;;
  esac
fi
case "$*" in
  *kstack-install-health.mjs*)
    if [ "$KSTACK_SETUP_HEALTH_MODE" = "hang" ]; then sleep 30; exit 99; fi
    kstack_health_status=PASS
    case "$*" in *' unavailable '*) kstack_health_status=DEGRADED ;; esac
    printf 'KSTACK_POST_DEPLOY_HEALTH_V1 {"activationClaim":"installed-files-paths-lookups-structurally-sound-v1","changedState":true,"diagnostics":[],"exitCode":0,"interactiveActivationTested":false,"overallStatus":"%s","roots":[],"schemaVersion":1,"surfaces":[]}\n' "$kstack_health_status"
    exit 0 ;;
  *unavailable-sentinel.mjs*provision-parent*"$KSTACK_SETUP_FAIL_MATCH"*) exit 67 ;;
  *kstack-reflexion.mjs*runtime-contract-generate*)
    if [ -n "$KSTACK_CODEX_MODE" ] && [ "$KSTACK_CODEX_MODE" != "unavailable" ]; then
      mkdir -p "$4/.codex-plugin"
      printf '%s\\n' KSTACK_SETUP_TEST_CONTRACT > "$4/.codex-plugin/reflexion-runtime-contract-v1.txt"
      printf '%s\\n' '{"kind":"runtime-contract-v1","status":"generated"}'
      exit 0
    fi
    exit 1 ;;
esac
exit 0
`, { mode: 0o700 });
  const timeout = path.join(directory, 'timeout');
  fs.writeFileSync(timeout, `#!/bin/sh
if [ "$KSTACK_SETUP_HEALTH_MODE" = "hang" ]; then
  if [ "$1" != "--signal=TERM" ] || [ "$2" != "--kill-after=2s" ] || [ "$3" != "118s" ]; then
    printf '%s\\n' KSTACK_SETUP_TEST_TIMEOUT_ARGUMENTS_INVALID >&2
    exit 92
  fi
  printf '%s\\n' 'TIMEOUT --signal=TERM --kill-after=2s 118s' >> "$KSTACK_SETUP_TEST_LOG"
  shift 3
  exec /usr/bin/timeout --signal=TERM --kill-after=1s 0.25s "$@"
fi
exec /usr/bin/timeout "$@"
`, { mode: 0o700 });
  if (codexMode !== null) {
    const codex = path.join(directory, 'codex');
    fs.writeFileSync(codex, `#!/bin/sh
printf 'CODEX %s\\n' "$*" >> "$KSTACK_SETUP_TEST_LOG"
if [ "$KSTACK_CODEX_MODE" = "unavailable" ]; then exit 1; fi
case "$*" in
  'plugin --help') exit 0 ;;
  'plugin marketplace list --json')
    if [ -s "$KSTACK_CODEX_MARKETPLACE_MARKER" ]; then
      printf '{"marketplaces":[{"name":"kstack","root":"%s"}]}\\n' "$(cat "$KSTACK_CODEX_MARKETPLACE_MARKER")"
    else
      printf '%s\\n' '{"marketplaces":[]}'
    fi
    exit 0 ;;
  'plugin marketplace remove kstack') : > "$KSTACK_CODEX_MARKETPLACE_MARKER"; exit 0 ;;
  'plugin marketplace add '*) printf '%s\\n' "$4" > "$KSTACK_CODEX_MARKETPLACE_MARKER"; exit 0 ;;
  'plugin list --json')
    if [ -s "$KSTACK_CODEX_INSTALLED_MARKER" ]; then
      kstack_version="$(cat "$KSTACK_CODEX_INSTALLED_MARKER")"
      kstack_source="$(cat "$KSTACK_CODEX_MARKETPLACE_MARKER")"
      printf '{"installed":[{"pluginId":"kstack@kstack","name":"kstack","marketplaceName":"kstack","version":"%s","installed":true,"enabled":true,"source":{"source":"local","path":"%s"}}]}\\n' "$kstack_version" "$kstack_source"
    else
      printf '%s\\n' '{"installed":[]}'
    fi
    exit 0 ;;
  'plugin remove kstack@kstack')
    kstack_version="$(cat "$KSTACK_CODEX_INSTALLED_MARKER")"
    rm -rf "$HOME/.codex/plugins/cache/kstack/kstack/$kstack_version"
    : > "$KSTACK_CODEX_INSTALLED_MARKER"
    exit 0 ;;
  'plugin add kstack@kstack')
    kstack_source="$(cat "$KSTACK_CODEX_MARKETPLACE_MARKER")"
    kstack_version="$($KSTACK_REAL_NODE -e 'const fs = require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version);' "$kstack_source/.codex-plugin/plugin.json")"
    kstack_cache="$HOME/.codex/plugins/cache/kstack/kstack/$kstack_version"
    if [ "$KSTACK_CODEX_MODE" != "broken" ]; then
      mkdir -p "$kstack_cache"
      cp -R "$kstack_source/." "$kstack_cache/"
    fi
    printf '%s\\n' "$kstack_version" > "$KSTACK_CODEX_INSTALLED_MARKER"
    exit 0 ;;
esac
exit 1
`, { mode: 0o700 });
  }
  const claude = path.join(directory, 'claude');
  fs.writeFileSync(claude, `#!/bin/sh
printf 'CLAUDE %s\n' "$*" >> "$KSTACK_SETUP_TEST_LOG"
case "$*" in
  'plugin --help') exit 0 ;;
  'plugin list --json') printf '%s\n' '[]'; exit 0 ;;
  'plugin marketplace list --json') printf '%s\n' '[]'; exit 0 ;;
  'plugin marketplace add '*) exit 0 ;;
  'plugin install kstack@kstack '*) exit 0 ;;
  'plugin uninstall kstack@kstack '*) exit 0 ;;
  'plugin marketplace remove kstack '*) exit 0 ;;
esac
exit 1
`, { mode: 0o700 });
  return { directory, node, log };
}

function runSetupFixture(args, failMatch, {
  codexMode = null,
  healthMode = '',
  home: selectedHome = null,
  setupTimeoutMs = 60_000
} = {}) {
  const fixture = fakeNodeFixture(codexMode);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-setup-target-'));
  const home = selectedHome ?? fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-setup-home-'));
  const environment = {
    ...process.env,
    HOME: home,
    PATH: `${fixture.directory}:${process.env.PATH}`,
    KSTACK_REAL_NODE: process.execPath,
    KSTACK_SETUP_TEST_LOG: fixture.log,
    KSTACK_SETUP_FAIL_MATCH: failMatch,
    KSTACK_SETUP_HEALTH_MODE: healthMode,
    KSTACK_CODEX_MODE: codexMode ?? '',
    KSTACK_CODEX_INSTALLED_MARKER: path.join(fixture.directory, 'codex-installed'),
    KSTACK_CODEX_MARKETPLACE_MARKER: path.join(fixture.directory, 'codex-marketplace')
  };
  if (codexMode === 'installed' || codexMode === 'stale') {
    const staleVersion = '0.1.0+codex.20260812133549';
    fs.writeFileSync(environment.KSTACK_CODEX_INSTALLED_MARKER, `${staleVersion}\n`);
    fs.writeFileSync(environment.KSTACK_CODEX_MARKETPLACE_MARKER, `${codexMode === 'installed' ? path.join(home, '.codex', 'skills', '.kstack-runtime') : root}\n`);
    const staleCache = path.join(home, '.codex', 'plugins', 'cache', 'kstack', 'kstack', staleVersion);
    fs.mkdirSync(staleCache, { recursive: true });
    fs.writeFileSync(path.join(staleCache, 'stale-only.txt'), 'marketplace refresh must not update this cache\n');
  }
  const result = spawnSync(path.join(root, 'setup'), [...args, '--target', target], { cwd: root, env: environment, encoding: 'utf8', timeout: setupTimeoutMs, maxBuffer: 4 * 1024 * 1024, shell: false });
  const calls = fs.existsSync(fixture.log) ? fs.readFileSync(fixture.log, 'utf8').trim().split('\n').filter(Boolean) : [];
  return { result, calls, target, home };
}

function assertCurrentCodexCache(run) {
  const runtime = path.join(run.home, '.codex', 'skills', '.kstack-runtime');
  const version = JSON.parse(fs.readFileSync(path.join(runtime, '.codex-plugin', 'plugin.json'), 'utf8')).version;
  const cache = path.join(run.home, '.codex', 'plugins', 'cache', 'kstack', 'kstack', version);
  assert.match(version, /^0\.2\.0-rc\.1\+codex\.\d{17}$/u);
  assert.equal(fs.existsSync(path.join(cache, '.codex-plugin', 'reflexion-runtime-contract-v1.txt')), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(runtime, '.codex-plugin', 'plugin.json'), 'utf8')).hooks, './hooks/codex-hooks.json');
  assert.equal(fs.readFileSync(path.join(cache, '.codex-plugin', 'plugin.json'), 'utf8'), fs.readFileSync(path.join(runtime, '.codex-plugin', 'plugin.json'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(cache, 'hooks', 'codex-hooks.json'), 'utf8'), fs.readFileSync(path.join(runtime, 'hooks', 'codex-hooks.json'), 'utf8'));
  assert.equal(fs.existsSync(path.join(cache, 'scripts', 'reflexion')), true);
  assert.equal(fs.readFileSync(path.join(cache, 'scripts', 'kstack-reflexion.mjs'), 'utf8'), fs.readFileSync(path.join(runtime, 'scripts', 'kstack-reflexion.mjs'), 'utf8'));
  const expectedSkills = ['kstack-design', 'kstack-design-clarify', 'kstack-experience', 'kstack-implement', 'kstack-init', 'kstack-interrogate', 'kstack-jira', 'kstack-memory', 'kstack-objectives', 'kstack-post-deploy', 'kstack-qc', 'kstack-review', 'kstack-secrets'];
  const cachedSkills = fs.readdirSync(path.join(cache, 'skills'), { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith('kstack-')).map((entry) => entry.name).sort();
  assert.deepEqual(cachedSkills, expectedSkills);
  for (const skill of expectedSkills) assert.equal(fs.readFileSync(path.join(cache, 'skills', skill, 'SKILL.md'), 'utf8'), fs.readFileSync(path.join(runtime, 'skills', skill, 'SKILL.md'), 'utf8'));
  assert.equal(fs.existsSync(path.join(cache, 'stale-only.txt')), false);
  return { runtime, version, cache };
}

test('setup targets host-native skill directories without a wrapper', () => {
  const setup = fs.readFileSync(path.join(root, 'setup'), 'utf8');
  assert.match(setup, /\.agents\/skills/);
  assert.match(setup, /codex plugin marketplace add/);
  assert.match(setup, /codex plugin add kstack@kstack/);
  assert.match(setup, /\.codex\/skills/);
  assert.match(setup, /\.claude\/skills/);
  assert.match(setup, /plugins\/kstack\/skills/);
  assert.doesNotMatch(setup, /CODEX_HOME=/);
  assert.doesNotMatch(setup, /GSTACK_HOME=/);
  assert.doesNotMatch(setup, /danger-full-access/);
  assert.match(setup, /KSTACK_CODEX_WINDOWS_CHECKOUT_DETECTED/);
  assert.match(setup, /Linux-native staged runtime/);
  assert.match(setup, /claude_in_scope "\$scope" plugin install kstack@kstack/);
  assert.match(setup, /Five scoped KStack entry skills are discoverable/iu);
  assert.match(setup, /\$kstack:kstack-init in the modern Codex plugin/iu);
  assert.match(setup, /bounded safety hooks are default-on/iu);
  assert.match(setup, /kstack-install-health\.mjs/);
  assert.match(setup, /KSTACK_POST_DEPLOY_HEALTH_V1/);
  assert.match(setup, /KSTACK_POST_DEPLOY_MANUAL_RECOVERY_REQUIRED/);
  assert.match(setup, /--health-override-request/);
  assert.match(setup, /flock -n -E 200 -o "\$KSTACK_INSTALL_HEALTH_LOCK_FILE"/);
  assert.match(setup, /cp -R "\$ROOT\/plugins\/kstack\/personas"/);
});

test('setup provisions and invalidates Reflexion roots with one verified Node in the main shell', () => {
  const setup = fs.readFileSync(path.join(root, 'setup'), 'utf8');
  assert.match(setup, /KSTACK_REFLEXION_SETUP_NODE_NOT_FOUND/);
  assert.match(setup, /KSTACK_REFLEXION_SETUP_NODE_INVALID/);
  assert.match(setup, /readonly KSTACK_RUNTIME_NODE/);
  assert.match(setup, /verify-runtime --installed-plugin-root/);
  assert.match(setup, /provision-parent --installed-plugin-root/);
  assert.match(setup, /invalidate --installed-plugin-root/);
  assert.match(setup, /runtime-contract-generate --installed-plugin-root/);
  assert.match(setup, /env -u NODE_OPTIONS -u NODE_PATH -u NODE_ICU_DATA/);
  assert.match(setup, /BASH_SUBSHELL/);
  assert.match(setup, /BASHPID/);
  assert.match(setup, /declare -A KSTACK_REFLEXION_ROOT_RESULTS/);
  assert.match(setup, /builtin exit 1/);
  assert.doesNotMatch(setup, /rm .*reflexion-runtime/u);
});

test('a concurrent setup sharing HOME is rejected before installed mutation', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-setup-lock-home-'));
  const lockRoot = path.join(home, '.kstack', 'install-health', 'locks');
  fs.mkdirSync(lockRoot, { recursive: true });
  const marker = path.join(home, 'lock-held');
  const holder = spawn('flock', ['-n', path.join(lockRoot, 'setup.lock'), 'sh', '-c', `touch '${marker}'; sleep 30`], { stdio: 'ignore' });
  try {
    for (let attempt = 0; attempt < 100 && !fs.existsSync(marker); attempt += 1) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    assert.equal(fs.existsSync(marker), true);
    const { result, calls } = runSetupFixture(['--host', 'claude', '--scope', 'project'], '__never__', { home });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /KSTACK_POST_DEPLOY_SETUP_CONCURRENT/u);
    assert.deepEqual(calls, []);
  } finally {
    holder.kill('SIGKILL');
    await new Promise((resolve) => holder.once('close', resolve));
  }
});

test('the overall health bound kills a hung runner and releases the same-HOME lock', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-setup-timeout-home-'));
  const started = Date.now();
  const timedOut = runSetupFixture(['--host', 'claude', '--scope', 'project'], '__never__', { healthMode: 'hang', home });
  assert.equal(timedOut.result.status, 1);
  assert.ok(Date.now() - started < 5_000);
  assert.ok(timedOut.calls.includes('TIMEOUT --signal=TERM --kill-after=2s 118s'));
  assert.match(timedOut.result.stdout, /KSTACK_POST_DEPLOY_SETUP_BUDGET_EXHAUSTED/u);
  assert.match(timedOut.result.stderr, /KSTACK_POST_DEPLOY_MANUAL_RECOVERY_REQUIRED/u);

  const retry = runSetupFixture(['--host', 'claude', '--scope', 'project'], '__never__', { home });
  assert.equal(retry.result.status, 0, retry.result.stderr);
  assert.doesNotMatch(retry.result.stderr, /KSTACK_POST_DEPLOY_SETUP_CONCURRENT/u);
});

test('copy setup builds a runtime that passes the real post-deploy auditor', { timeout: 130_000 }, () => {
  const copied = runSetupFixture(
    ['--host', 'codex', '--scope', 'project', '--copy'],
    '__never__',
    { healthMode: 'real', setupTimeoutMs: 120_000 }
  );
  assert.equal(copied.result.status, 0, `${copied.result.stdout}\n${copied.result.stderr}`);
  assert.equal(fs.existsSync(path.join(copied.target, '.agents', 'skills', '.kstack-runtime', 'personas')), true);
  assert.match(copied.result.stdout, /KSTACK_POST_DEPLOY_HEALTH_V1 .*"overallStatus":"PASS"/u);
});

test('--host all copy mode continues a later distinct root after a hard failure and exits only after aggregation', { timeout: 130_000 }, () => {
  const { result, calls, target } = runSetupFixture(
    ['--host', 'all', '--scope', 'project', '--copy'],
    '.agents/skills/.kstack-runtime',
    { setupTimeoutMs: 120_000 }
  );
  assert.equal(result.status, 1);
  const firstProvision = calls.filter((line) => line.includes('.agents/skills/.kstack-runtime') && line.includes('provision-parent'));
  const laterVerification = calls.filter((line) => line.includes('.claude/skills/.kstack-runtime') && line.includes('verify-runtime'));
  assert.equal(firstProvision.length, 1);
  assert.equal(laterVerification.length, 1);
  assert.ok(calls.some((line) => line.includes('.claude/skills/.kstack-runtime') && line.includes('runtime-contract-generate')));
  assert.match(result.stderr, /KSTACK_REFLEXION_SETUP_PARENT_PROVISION_FAILED/u);
  assert.match(result.stderr, /KSTACK_REFLEXION_CONTRACT_ABSENT/u);
  assert.equal(fs.existsSync(path.join(target, '.agents', 'skills', 'kstack-init')), false);
  assert.equal(fs.existsSync(path.join(target, '.claude', 'skills', 'kstack-init')), true);
});

test('--host all symlink mode deduplicates the shared canonical root and does not retry a hard failure', () => {
  const { result, calls } = runSetupFixture(['--host', 'all', '--scope', 'project'], '/plugins/kstack');
  assert.equal(result.status, 1);
  assert.equal(calls.filter((line) => line.includes('verify-runtime')).length, 1);
  assert.equal(calls.filter((line) => line.includes('provision-parent')).length, 1);
  assert.equal(calls.some((line) => line.includes('runtime-contract-generate')), false);
});

test('--host all user plugin mode covers first install and already-installed process paths', () => {
  const added = runSetupFixture(['--host', 'all', '--scope', 'user'], '__never__', { codexMode: 'new' });
  assert.equal(added.result.status, 0);
  assert.ok(added.calls.some((line) => line === `CODEX plugin marketplace add ${path.join(added.home, '.codex', 'skills', '.kstack-runtime')}`));
  assert.ok(added.calls.includes('CODEX plugin add kstack@kstack'));
  assert.equal(added.calls.filter((line) => line.includes('verify-runtime')).length, 1);
  assert.ok(added.calls.some((line) => line.includes('.codex/skills/.kstack-runtime') && line.includes('runtime-contract-generate')));
  assert.equal(fs.realpathSync(path.join(added.home, '.claude', 'skills', 'kstack-implement')), path.join(added.home, '.codex', 'skills', '.kstack-runtime', 'skills', 'kstack-implement'));
  assert.equal(fs.existsSync(path.join(added.home, '.claude', 'skills', 'kstack-init')), true);
  assertCurrentCodexCache(added);
  assert.ok(added.calls.some((line) => line.startsWith('CLAUDE plugin install kstack@kstack --scope user')));
  assert.ok(added.calls.some((line) => line.includes('kstack-install-health.mjs') && line.includes('--modern-codex')));
  assert.match(added.result.stdout, /KSTACK_POST_DEPLOY_HEALTH_V1 .*"overallStatus":"PASS"/u);

  const existing = runSetupFixture(['--host', 'all', '--scope', 'user'], '__never__', { codexMode: 'installed' });
  assert.equal(existing.result.status, 0);
  assert.equal(existing.calls.some((line) => line.startsWith('CODEX plugin marketplace add ')), false);
  assert.equal(existing.calls.includes('CODEX plugin remove kstack@kstack'), true);
  assert.equal(existing.calls.includes('CODEX plugin add kstack@kstack'), true);
  assert.equal(existing.calls.filter((line) => line.includes('verify-runtime')).length, 1);
  assertCurrentCodexCache(existing);
  assert.equal(existing.calls.filter((line) => line.includes('kstack-install-health.mjs')).length, 1);
});

test('modern Codex user install migrates a live-checkout marketplace to the admitted native root', () => {
  const migrated = runSetupFixture(['--host', 'codex', '--scope', 'user'], '__never__', { codexMode: 'stale' });
  const runtime = path.join(migrated.home, '.codex', 'skills', '.kstack-runtime');
  assert.equal(migrated.result.status, 0);
  assert.ok(migrated.calls.includes('CODEX plugin marketplace remove kstack'));
  assert.ok(migrated.calls.includes(`CODEX plugin marketplace add ${runtime}`));
  assert.equal(migrated.calls.includes('CODEX plugin remove kstack@kstack'), true);
  assert.equal(migrated.calls.includes('CODEX plugin add kstack@kstack'), true);
  assert.match(migrated.result.stdout, /verified Codex plugin cache:/u);
  assert.equal(JSON.parse(fs.readFileSync(path.join(runtime, '.agents', 'plugins', 'marketplace.json'), 'utf8')).plugins[0].source.path, './');
  assertCurrentCodexCache(migrated);
});

test('modern Codex user install fails closed when plugin add does not create the physical cache', () => {
  const broken = runSetupFixture(['--host', 'codex', '--scope', 'user'], '__never__', { codexMode: 'broken' });
  assert.equal(broken.result.status, 1);
  assert.ok(broken.calls.includes('CODEX plugin add kstack@kstack'));
  assert.match(broken.result.stderr, /KSTACK_CODEX_PLUGIN_CACHE_UNCONFIRMED/u);
  assert.match(broken.result.stdout, /KSTACK_POST_DEPLOY_HEALTH_V1 .*KSTACK_POST_DEPLOY_INSTALL_INCOMPLETE/u);
  assert.match(broken.result.stderr, /KSTACK_POST_DEPLOY_MANUAL_RECOVERY_REQUIRED/u);
});

test('--host all user legacy mode falls back to both host-native skill roots', () => {
  const { result, calls, home } = runSetupFixture(['--host', 'all', '--scope', 'user'], '__never__', { codexMode: 'unavailable' });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /legacy user skill directory/u);
  assert.equal(calls.filter((line) => line.includes('verify-runtime')).length, 1);
  assert.equal(fs.existsSync(path.join(home, '.codex', 'skills', 'kstack-init')), true);
  assert.equal(fs.existsSync(path.join(home, '.claude', 'skills', 'kstack-init')), true);
  assert.match(result.stdout, /KSTACK_POST_DEPLOY_HEALTH_V1 .*"overallStatus":"DEGRADED"/u);
});

test('single-host hard failure uses the same final aggregation path', () => {
  const { result, calls } = runSetupFixture(['--host', 'claude', '--scope', 'project'], '/plugins/kstack');
  assert.equal(result.status, 1);
  assert.equal(calls.filter((line) => line.includes('provision-parent')).length, 1);
  assert.match(result.stderr, /KSTACK_REFLEXION_SETUP_PARENT_PROVISION_FAILED/u);
});
