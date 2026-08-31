import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const powershell = process.platform === 'win32'
  ? 'powershell.exe'
  : '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';

function windowsPath(value) {
  if (process.platform === 'win32') return value;
  const match = /^\/mnt\/([a-zA-Z])\/(.*)$/u.exec(value);
  if (!match) return null;
  return `${match[1].toUpperCase()}:\\${match[2].replaceAll('/', '\\')}`;
}

function psLiteral(value) { return `'${value.replaceAll("'", "''")}'`; }

test('native Windows setup is a distinct copy-based Codex installer with exact invocation guidance', () => {
  const source = fs.readFileSync(path.join(root, 'setup.ps1'), 'utf8');
  assert.match(source, /ValidateSet\('codex'\)/u);
  assert.match(source, /ValidateSet\('user', 'project'\)/u);
  assert.match(source, /plugin', 'marketplace', 'add'/u);
  assert.match(source, /plugin', 'add', 'kstack@kstack'/u);
  assert.match(source, /KSTACK_WINDOWS_CODEX_PLUGIN_COMMANDS_UNAVAILABLE/u);
  assert.match(source, /kstack-windows-copy\.mjs/u);
  assert.match(source, /runtime-contract-generate/u);
  assert.match(source, /\$kstack:kstack-init/u);
  assert.match(source, /\$kstack-init/u);
  assert.doesNotMatch(source, /\/kstack-init in Codex/u);
  const hooks = fs.readFileSync(path.join(root, 'plugins', 'kstack', 'hooks', 'codex-hooks.json'), 'utf8');
  assert.match(hooks, /"commandWindows"/u);
});

test('real native Windows PowerShell installs and mutates an initialized project', { timeout: 120_000, skip: process.platform !== 'win32' && !fs.existsSync(powershell) }, (context) => {
  const setupPath = windowsPath(path.join(root, 'setup.ps1'));
  const configScript = windowsPath(path.join(root, 'plugins', 'kstack', 'scripts', 'kstack-config.mjs'));
  if (!setupPath || !configScript) { context.skip('repository is not visible to native Windows'); return; }
  const nodeProbe = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', '(Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue).Source'], { encoding: 'utf8', timeout: 10_000 });
  if (nodeProbe.status !== 0 || !nodeProbe.stdout.trim()) { context.skip('native Windows Node is unavailable'); return; }

  const command = [
    '$ErrorActionPreference = "Stop"',
    '$project = Join-Path $env:TEMP ("kstack-windows-test-project-" + [Guid]::NewGuid().ToString("N"))',
    '$profile = Join-Path $env:TEMP ("kstack-windows-test-profile-" + [Guid]::NewGuid().ToString("N"))',
    'try {',
    'New-Item -ItemType Directory -Path $project,$profile | Out-Null',
    'New-Item -ItemType Directory -Path (Join-Path $project ".kstack") | Out-Null',
    '$node = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source',
    `$template = & $node ${psLiteral(configScript)} template`,
    'if ($LASTEXITCODE -ne 0) { throw "template failed" }',
    '[IO.File]::WriteAllText((Join-Path $project ".kstack\\config.json"), ($template -join "`n") + "`n", [Text.UTF8Encoding]::new($false))',
    '$env:USERPROFILE = $profile',
    '$env:HOME = $profile',
    '$env:PATH = Split-Path -Parent $node',
    `& ${psLiteral(setupPath)} -Host codex -Scope project -Target $project`,
    'if ($LASTEXITCODE -ne 0) { throw "setup failed" }',
    `& ${psLiteral(setupPath)} -Host codex -Scope project -Target $project`,
    'if ($LASTEXITCODE -ne 0) { throw "refresh failed" }',
    '$runtime = Join-Path $project ".agents\\skills\\.kstack-runtime"',
    '$reflexion = Join-Path $runtime "scripts\\kstack-reflexion.mjs"',
    '& $node $reflexion record --project-root $project --config (Join-Path $project ".kstack\\config.json") --approved edit --task-signature windows-native --rule "ALWAYS preserve Windows path identity" --why "Native custody must stay bounded" --source-failure "The POSIX-only runtime rejected Windows" | Out-Null',
    'if ($LASTEXITCODE -ne 0) { throw "record failed" }',
    '$skillEntries = @(Get-ChildItem (Join-Path $project ".agents\\skills") -Directory)',
    '$skills = @($skillEntries | Where-Object { $_.Name -like "kstack-*" -and $_.Name -notlike "*.backup.*" }).Count',
    '$backups = @($skillEntries | Where-Object { $_.Name -like "kstack-*.backup.*" }).Count',
    '$lessons = Get-Content (Join-Path $project ".kstack\\reflexion-lessons.json") -Raw | ConvertFrom-Json',
    '[PSCustomObject]@{ Skills = $skills; Backups = $backups; Contract = Test-Path (Join-Path $runtime ".codex-plugin\\reflexion-runtime-contract-v1.txt"); Safety = Test-Path (Join-Path $project ".kstack\\safety-hooks.json"); LessonCount = @($lessons).Count } | ConvertTo-Json -Compress',
    '} finally {',
    'foreach ($item in @($project,$profile)) { if (Test-Path -LiteralPath $item) { Remove-Item -LiteralPath $item -Recurse -Force } }',
    '}'
  ].join('; ');
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', command], { cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal((result.stdout.match(/KSTACK_POST_DEPLOY_HEALTH_V1 .*"overallStatus":"PASS"/gu) ?? []).length, 2);
  const record = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
  assert.deepEqual(record, { Skills: 13, Backups: 13, Contract: true, Safety: true, LessonCount: 1 });
});
