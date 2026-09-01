[CmdletBinding()]
param(
  [Alias('Host')]
  [ValidateSet('codex')]
  [string]$KStackTargetHost = 'codex',

  [ValidateSet('user', 'project')]
  [string]$Scope = 'user',

  [string]$Target = '',

  [switch]$Copy,

  [string]$HealthOverrideRequest = '',

  [string]$HealthOverrideApproval = ''
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'

function Write-KStackFailure {
  param([string]$Code, [string]$Detail = '')
  if ($Detail) { [Console]::Error.WriteLine("${Code}: ${Detail}") }
  else { [Console]::Error.WriteLine($Code) }
}

function Invoke-KStackNative {
  param([string]$Executable, [string[]]$Arguments, [switch]$AllowFailure)
  & $Executable @Arguments
  $status = $LASTEXITCODE
  if (-not $AllowFailure -and $status -ne 0) { throw "KSTACK_NATIVE_COMMAND_FAILED executable=$Executable exitCode=$status" }
  if ($AllowFailure) { return $status }
}

function Write-Utf8NoBom {
  param([string]$Path, [string]$Text)
  [IO.File]::WriteAllText($Path, $Text, [Text.UTF8Encoding]::new($false))
}

function Copy-KStackRuntime {
  param([string]$SourceRoot, [string]$Destination, [string]$UserProfile, [string]$RuntimeNode, [bool]$StampPlugin)
  [IO.Directory]::CreateDirectory($Destination) | Out-Null
  $copyHelper = Join-Path $SourceRoot 'scripts\kstack-windows-copy.mjs'
  foreach ($directory in @('acquisition', 'scripts', 'hooks', 'packs', 'personas', 'schemas', 'native', 'workers', 'vendor', 'node_modules', 'skills', 'references', '.codex-plugin', '.claude-plugin')) {
    Invoke-KStackNative -Executable $RuntimeNode -Arguments @($copyHelper, (Join-Path $SourceRoot $directory), (Join-Path $Destination $directory)) | Out-Null
  }
  foreach ($file in @('package.json', 'package-lock.json', '.npmrc', 'install-health-contract-v1.json', 'install-health-audit-manifest-v1.json', 'install-health-authority-registry-v1.json', 'secret-broker-accepted-design-v1.json', 'secret-broker-release-manifest-v1.json', 'secret-broker-source-audit-manifest-v1.json')) {
    Copy-Item -LiteralPath (Join-Path $SourceRoot $file) -Destination (Join-Path $Destination $file)
  }
  $marketplaceDirectory = Join-Path $Destination '.agents\plugins'
  [IO.Directory]::CreateDirectory($marketplaceDirectory) | Out-Null
  $marketplace = Get-Content -LiteralPath (Join-Path (Split-Path -Parent (Split-Path -Parent $SourceRoot)) '.agents\plugins\marketplace.json') -Raw | ConvertFrom-Json
  $plugin = @($marketplace.plugins | Where-Object { $_.name -eq 'kstack' })
  if ($plugin.Count -ne 1) { throw 'KSTACK_WINDOWS_MARKETPLACE_INVALID' }
  $plugin[0].source = [PSCustomObject]@{ source = 'local'; path = './' }
  Write-Utf8NoBom -Path (Join-Path $marketplaceDirectory 'marketplace.json') -Text (($marketplace | ConvertTo-Json -Depth 20) + "`n")

  if ($StampPlugin) {
    $manifestPath = Join-Path $Destination '.codex-plugin\plugin.json'
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $baseVersion = ([string]$manifest.version).Split('+')[0]
    if (-not $baseVersion) { throw 'KSTACK_WINDOWS_PLUGIN_MANIFEST_INVALID' }
    $millis = [DateTimeOffset]::UtcNow
    do {
      $version = $baseVersion + '+codex.' + $millis.ToString('yyyyMMddHHmmssfff')
      $cacheCandidate = Join-Path $UserProfile ".codex\plugins\cache\kstack\kstack\$version"
      $millis = $millis.AddMilliseconds(1)
    } while (Test-Path -LiteralPath $cacheCandidate)
    $manifest.version = $version
    Write-Utf8NoBom -Path $manifestPath -Text (($manifest | ConvertTo-Json -Depth 20) + "`n")
    Write-Output "stamped Codex plugin version: $version"
  }
}

function Install-KStackSkillCopies {
  param([string]$RuntimeRoot, [string]$DestinationRoot)
  [IO.Directory]::CreateDirectory($DestinationRoot) | Out-Null
  foreach ($sourceSkill in Get-ChildItem -LiteralPath (Join-Path $RuntimeRoot 'skills') -Directory | Where-Object { $_.Name -like 'kstack-*' }) {
    $destination = Join-Path $DestinationRoot $sourceSkill.Name
    if (Test-Path -LiteralPath $destination) {
      $backup = $destination + '.backup.' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')
      Move-Item -LiteralPath $destination -Destination $backup
      Write-Output "preserved existing install: $backup"
    }
    Copy-Item -LiteralPath $sourceSkill.FullName -Destination $destination -Recurse
    $skillFile = Join-Path $destination 'SKILL.md'
    $text = [IO.File]::ReadAllText($skillFile)
    $text = $text.Replace('${CLAUDE_PLUGIN_ROOT}', $RuntimeRoot).Replace('../../scripts/', "$RuntimeRoot/scripts/").Replace('<kstack-plugin-root>/scripts/', "$RuntimeRoot/scripts/")
    Write-Utf8NoBom -Path $skillFile -Text $text
    Write-Output "installed: $destination"
  }
}

function Get-CodexJson {
  param([string]$Codex, [string[]]$Arguments)
  $output = & $Codex @Arguments 2>$null | Out-String
  if ($LASTEXITCODE -ne 0) { throw 'KSTACK_WINDOWS_CODEX_JSON_UNAVAILABLE' }
  return $output | ConvertFrom-Json
}

function Install-KStackCodexPlugin {
  param([string]$Codex, [string]$RuntimeRoot, [string]$UserProfile)
  $marketplaces = Get-CodexJson -Codex $Codex -Arguments @('plugin', 'marketplace', 'list', '--json')
  $installed = Get-CodexJson -Codex $Codex -Arguments @('plugin', 'list', '--json')
  $marketplace = @($marketplaces.marketplaces | Where-Object { $_.name -eq 'kstack' })
  if ($marketplace.Count -gt 1) { throw 'KSTACK_WINDOWS_CODEX_MARKETPLACE_AMBIGUOUS' }
  if ($marketplace.Count -eq 1 -and [IO.Path]::GetFullPath([string]$marketplace[0].root) -ne [IO.Path]::GetFullPath($RuntimeRoot)) {
    Invoke-KStackNative -Executable $Codex -Arguments @('plugin', 'marketplace', 'remove', 'kstack') | Out-Null
    $marketplace = @()
  }
  if ($marketplace.Count -eq 0) {
    Invoke-KStackNative -Executable $Codex -Arguments @('plugin', 'marketplace', 'add', $RuntimeRoot) | Out-Null
  }
  if (@($installed.installed | Where-Object { $_.pluginId -eq 'kstack@kstack' -and $_.installed -eq $true }).Count -gt 0) {
    Invoke-KStackNative -Executable $Codex -Arguments @('plugin', 'remove', 'kstack@kstack') | Out-Null
  }
  Invoke-KStackNative -Executable $Codex -Arguments @('plugin', 'add', 'kstack@kstack') | Out-Null
  $manifest = Get-Content -LiteralPath (Join-Path $RuntimeRoot '.codex-plugin\plugin.json') -Raw | ConvertFrom-Json
  $cacheRoot = Join-Path $UserProfile ".codex\plugins\cache\kstack\kstack\$($manifest.version)"
  if (-not (Test-Path -LiteralPath $cacheRoot -PathType Container)) { throw 'KSTACK_CODEX_PLUGIN_CACHE_UNCONFIRMED' }
  return [IO.Path]::GetFullPath($cacheRoot)
}

$exitCode = 0
$setupLock = $null
$stageRoot = $null
$savedEnvironment = @{
  NODE_OPTIONS = $env:NODE_OPTIONS
  NODE_PATH = $env:NODE_PATH
  NODE_ICU_DATA = $env:NODE_ICU_DATA
  HOME = $env:HOME
}

try {
  if ($env:OS -ne 'Windows_NT') { throw 'KSTACK_WINDOWS_SETUP_REQUIRES_WINDOWS' }
  if ([bool]$HealthOverrideRequest -ne [bool]$HealthOverrideApproval) { throw 'KSTACK_WINDOWS_HEALTH_OVERRIDE_PAIR_REQUIRED' }
  if ($KStackTargetHost -ne 'codex') { throw 'KSTACK_WINDOWS_HOST_UNSUPPORTED' }
  if (-not $env:USERPROFILE -or -not [IO.Path]::IsPathRooted($env:USERPROFILE)) { throw 'KSTACK_WINDOWS_USERPROFILE_INVALID' }

  $nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $nodeCommand -or -not [IO.Path]::IsPathRooted($nodeCommand.Source)) { throw 'KSTACK_REFLEXION_SETUP_NODE_NOT_FOUND' }
  $runtimeNode = [IO.Path]::GetFullPath($nodeCommand.Source)
  $repositoryRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSCommandPath))
  $sourceRoot = Join-Path $repositoryRoot 'plugins\kstack'

  $env:NODE_OPTIONS = $null
  $env:NODE_PATH = $null
  $env:NODE_ICU_DATA = $null
  $env:HOME = $env:USERPROFILE

  $lockDirectory = Join-Path $env:USERPROFILE '.kstack\install-health\locks'
  [IO.Directory]::CreateDirectory($lockDirectory) | Out-Null
  try {
    $setupLock = [IO.File]::Open((Join-Path $lockDirectory 'setup.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  } catch {
    throw 'KSTACK_POST_DEPLOY_SETUP_CONCURRENT'
  }

  if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot 'node_modules\@electric-sql\pglite') -PathType Container)) {
    $npmCommand = Get-Command npm.cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $npmCommand) { throw 'KSTACK_WINDOWS_NPM_NOT_FOUND' }
    Write-Output "Installing KStack's locked local-memory runtime..."
    Invoke-KStackNative -Executable $npmCommand.Source -Arguments @('ci', '--prefix', $sourceRoot, '--no-bin-links', '--omit=dev', '--ignore-scripts') | Out-Null
  }

  if ($Scope -eq 'project') {
    if (-not $Target) { $Target = (Get-Location).Path }
    if (-not (Test-Path -LiteralPath $Target -PathType Container)) { throw 'KSTACK_WINDOWS_TARGET_INVALID' }
    $targetRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Target).Path)
    $destinationRoot = Join-Path $targetRoot '.agents\skills'
  } else {
    $targetRoot = $null
    $destinationRoot = Join-Path $env:USERPROFILE '.codex\skills'
  }
  [IO.Directory]::CreateDirectory($destinationRoot) | Out-Null
  $runtimeRoot = Join-Path $destinationRoot '.kstack-runtime'
  $stageRoot = Join-Path $destinationRoot ('.kstack-runtime.stage.' + [Guid]::NewGuid().ToString('N'))
  Copy-KStackRuntime -SourceRoot $sourceRoot -Destination $stageRoot -UserProfile $env:USERPROFILE -RuntimeNode $runtimeNode -StampPlugin ($Scope -eq 'user')

  if (Test-Path -LiteralPath $runtimeRoot) {
    $runtimeBackup = $runtimeRoot + '.backup.' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')
    Move-Item -LiteralPath $runtimeRoot -Destination $runtimeBackup
    Write-Output "preserved existing runtime: $runtimeBackup"
  }
  Move-Item -LiteralPath $stageRoot -Destination $runtimeRoot
  $stageRoot = $null
  Write-Output "installed native Windows runtime: $runtimeRoot"

  $sentinel = Join-Path $runtimeRoot 'scripts\reflexion\unavailable-sentinel.mjs'
  $reflexion = Join-Path $runtimeRoot 'scripts\kstack-reflexion.mjs'
  Invoke-KStackNative -Executable $runtimeNode -Arguments @($sentinel, 'verify-runtime', '--installed-plugin-root', $runtimeRoot) | Out-Null
  Invoke-KStackNative -Executable $runtimeNode -Arguments @($sentinel, 'provision-parent', '--installed-plugin-root', $runtimeRoot) | Out-Null
  Invoke-KStackNative -Executable $runtimeNode -Arguments @($sentinel, 'invalidate', '--installed-plugin-root', $runtimeRoot) | Out-Null
  Invoke-KStackNative -Executable $runtimeNode -Arguments @($reflexion, 'runtime-contract-generate', '--installed-plugin-root', $runtimeRoot) | Out-Null

  $modernCodex = $false
  $executionRoot = $runtimeRoot
  $surfacePath = $destinationRoot
  $surfaceMode = 'copy'
  if ($Scope -eq 'user') {
    $codexCommand = Get-Command codex -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($codexCommand) {
      & $codexCommand.Source plugin --help *> $null
      $modernCodex = $LASTEXITCODE -eq 0
    }
    if ($modernCodex) {
      $executionRoot = Install-KStackCodexPlugin -Codex $codexCommand.Source -RuntimeRoot $runtimeRoot -UserProfile $env:USERPROFILE
      $surfacePath = Join-Path $executionRoot 'skills'
      $surfaceMode = 'plugin'
      Write-Output "verified Codex plugin cache: $executionRoot"
    } else {
      Write-KStackFailure -Code 'KSTACK_WINDOWS_CODEX_PLUGIN_COMMANDS_UNAVAILABLE' -Detail 'using direct user skill copies; Codex safety hooks remain inactive'
      Install-KStackSkillCopies -RuntimeRoot $runtimeRoot -DestinationRoot $destinationRoot
    }
  } else {
    Install-KStackSkillCopies -RuntimeRoot $runtimeRoot -DestinationRoot $destinationRoot
    if (Test-Path -LiteralPath (Join-Path $targetRoot '.kstack\config.json') -PathType Leaf) {
      Invoke-KStackNative -Executable $runtimeNode -Arguments @((Join-Path $runtimeRoot 'scripts\kstack-safety-admin.mjs'), 'install', '--project-root', $targetRoot, '--plugin-root', $runtimeRoot) | Out-Null
    } else {
      Write-KStackFailure -Code 'KSTACK_WINDOWS_SAFETY_ENROLLMENT_DEFERRED' -Detail 'run $kstack-init; enrollment occurs after .kstack/config.json is validated'
    }
    Write-KStackFailure -Code 'KSTACK_WINDOWS_CODEX_PROJECT_HOOK_REQUIRES_USER_PLUGIN' -Detail 'run .\setup.ps1 -Scope user to activate the deny-only Codex hook'
  }

  $healthArguments = @(
    (Join-Path $runtimeRoot 'scripts\kstack-install-health.mjs'),
    '--source-root', $sourceRoot,
    '--host', 'codex',
    '--scope', $Scope,
    '--mode', 'copy',
    '--changed-state', 'true'
  )
  if ($modernCodex) {
    $healthArguments += @('--root', 'codex-native', $runtimeRoot, 'admitted', 'provisioning')
    $healthArguments += @('--root', 'codex-cache', $executionRoot, 'admitted', 'execution')
    $healthArguments += '--modern-codex'
  } else {
    $healthArguments += @('--root', 'codex-runtime', $runtimeRoot, 'admitted', 'execution')
  }
  $healthArguments += @('--surface', 'codex-filesystem', 'codex', $surfacePath, $executionRoot, $surfaceMode)
  if ($HealthOverrideRequest) { $healthArguments += @('--override-request', $HealthOverrideRequest, '--override-approval', $HealthOverrideApproval) }
  Invoke-KStackNative -Executable $runtimeNode -Arguments $healthArguments

  Write-Output 'Native Windows KStack installation passed its filesystem, hook, import, and Reflexion health probes.'
  if ($modernCodex) { Write-Output 'Restart Codex, open /skills, and invoke $kstack:kstack-init.' }
  else { Write-Output 'Restart Codex, open /skills, and invoke $kstack-init.' }
} catch {
  $exitCode = 1
  Write-KStackFailure -Code 'KSTACK_WINDOWS_SETUP_FAILED' -Detail $_.Exception.Message
  Write-KStackFailure -Code 'KSTACK_POST_DEPLOY_MANUAL_RECOVERY_REQUIRED' -Detail 'no automatic rollback ran; inspect the timestamped backups reported above, restore only the intended backup, and rerun setup.ps1'
} finally {
  if ($stageRoot -and (Test-Path -LiteralPath $stageRoot)) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }
  if ($setupLock) { $setupLock.Dispose() }
  $env:NODE_OPTIONS = $savedEnvironment.NODE_OPTIONS
  $env:NODE_PATH = $savedEnvironment.NODE_PATH
  $env:NODE_ICU_DATA = $savedEnvironment.NODE_ICU_DATA
  $env:HOME = $savedEnvironment.HOME
}

exit $exitCode
