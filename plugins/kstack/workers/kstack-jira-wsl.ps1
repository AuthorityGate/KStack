[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('append', 'list', 'sync')]
  [string]$Command,

  [string]$ProjectRoot = '',

  [string]$File = '',

  [switch]$TestDiagnostics
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'

function Fail-KStackJiraWsl {
  param([string]$Code)
  throw [InvalidOperationException]::new($Code)
}

function Assert-RegularFile {
  param([string]$Path, [string]$Code)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { Fail-KStackJiraWsl $Code }
  $item = Get-Item -LiteralPath $Path -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Fail-KStackJiraWsl $Code }
  return [IO.Path]::GetFullPath($item.FullName)
}

function Get-ExactKeys {
  param([object]$Value)
  return @($Value.PSObject.Properties.Name | Sort-Object) -join ','
}

function Invoke-WslCapture {
  param([string]$Executable, [string]$Distribution, [string[]]$Arguments, [string]$FailureCode)
  $lines = @(& $Executable '--distribution' $Distribution '--exec' @Arguments)
  if ($LASTEXITCODE -ne 0) { Fail-KStackJiraWsl $FailureCode }
  return @($lines)
}

$temporaryWslFile = $null
$cleanupWsl = $null
$cleanupDistribution = $null

try {
  if ($env:OS -ne 'Windows_NT') { Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_WINDOWS_REQUIRED' }
  if (($Command -eq 'append') -ne (-not [string]::IsNullOrWhiteSpace($File))) {
    Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_ARGUMENTS_INVALID'
  }

  if ([string]::IsNullOrWhiteSpace($ProjectRoot)) { $ProjectRoot = (Get-Location).Path }
  if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_PROJECT_INVALID'
  }
  $project = Get-Item -LiteralPath (Resolve-Path -LiteralPath $ProjectRoot).Path -Force
  $projectPath = [IO.Path]::GetFullPath($project.FullName).TrimEnd([IO.Path]::DirectorySeparatorChar)

  $bindingPath = Assert-RegularFile (Join-Path $projectPath '.kstack\wsl-jira-executor.json') 'KSTACK_JIRA_WSL_BINDING_INVALID'
  $configPath = Assert-RegularFile (Join-Path $projectPath '.kstack\config.json') 'KSTACK_JIRA_WSL_CONFIG_INVALID'
  try { $binding = Get-Content -LiteralPath $bindingPath -Raw | ConvertFrom-Json } catch {
    Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_BINDING_INVALID'
  }
  if ((Get-ExactKeys $binding) -cne 'distribution,nodePath,repositoryNamespace,schemaVersion,windowsRepositoryPath,wslRepositoryPath') {
    Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_BINDING_INVALID'
  }
  if (($binding.schemaVersion -cne 'kstack-jira-wsl-executor-v1') -or
    ([string]$binding.distribution -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$') -or
    ([string]$binding.nodePath -cnotmatch '^/[A-Za-z0-9._/-]+$') -or
    ([string]$binding.wslRepositoryPath -cnotmatch '^/mnt/[a-z]/[A-Za-z0-9 ._+()/-]+$') -or
    ([string]$binding.repositoryNamespace -cnotmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')) {
    Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_BINDING_INVALID'
  }
  $boundWindowsPath = [IO.Path]::GetFullPath([string]$binding.windowsRepositoryPath).TrimEnd([IO.Path]::DirectorySeparatorChar)
  if ($boundWindowsPath -cne $projectPath) { Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_PROJECT_MISMATCH' }

  $systemDirectory = [Environment]::GetFolderPath([Environment+SpecialFolder]::System)
  $wsl = Assert-RegularFile (Join-Path $systemDirectory 'wsl.exe') 'KSTACK_JIRA_WSL_EXECUTOR_UNAVAILABLE'
  $distributions = @(& $wsl '--list' '--quiet') | ForEach-Object { ([regex]::Replace([string]$_, "`0", '')).Trim() } | Where-Object { $_ }
  if ($LASTEXITCODE -ne 0) { Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_EXECUTOR_UNAVAILABLE' }
  if (@($distributions | Where-Object { $_ -ceq [string]$binding.distribution }).Count -ne 1) {
    Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_DISTRIBUTION_MISMATCH'
  }

  $translatedProject = @(Invoke-WslCapture $wsl ([string]$binding.distribution) @('/usr/bin/wslpath', '-a', '-u', $projectPath) 'KSTACK_JIRA_WSL_PROJECT_TRANSLATION_FAILED')
  if ($translatedProject.Count -ne 1 -or ([string]$translatedProject[0]).Trim() -cne [string]$binding.wslRepositoryPath) {
    Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_PROJECT_MISMATCH'
  }

  $wslRoot = [string]$binding.wslRepositoryPath
  $wslConfig = "$wslRoot/.kstack/config.json"
  $wslConfigScript = "$wslRoot/plugins/kstack/scripts/kstack-jira-wsl-config.mjs"
  $projectionLines = @(Invoke-WslCapture $wsl ([string]$binding.distribution) @([string]$binding.nodePath, $wslConfigScript, $wslConfig) 'KSTACK_JIRA_WSL_CONFIG_INVALID')
  try { $configProjection = (@($projectionLines) -join "`n") | ConvertFrom-Json } catch {
    Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_CONFIG_INVALID'
  }
  if ((Get-ExactKeys $configProjection) -cne 'credentialSourceAbsolute,credentialSourceType,jiraEnabled,repositoryNamespace,schemaVersion' -or
    ($configProjection.schemaVersion -cne 'kstack-jira-wsl-config-projection-v1') -or
    ($configProjection.jiraEnabled -ne $true) -or
    ($configProjection.repositoryNamespace -cne [string]$binding.repositoryNamespace) -or
    ($configProjection.credentialSourceType -cne 'file') -or
    ($configProjection.credentialSourceAbsolute -ne $true)) {
    Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_CONFIG_INVALID'
  }
  $wslScript = "$wslRoot/plugins/kstack/scripts/kstack-jira-tracking.mjs"
  $arguments = @('--distribution', [string]$binding.distribution, '--exec', [string]$binding.nodePath, $wslScript, $Command)
  if ($Command -eq 'append') {
    $inputPath = Assert-RegularFile $File 'KSTACK_JIRA_WSL_EVENT_FILE_INVALID'
    $translatedInput = @(Invoke-WslCapture $wsl ([string]$binding.distribution) @('/usr/bin/wslpath', '-a', '-u', $inputPath) 'KSTACK_JIRA_WSL_EVENT_TRANSLATION_FAILED')
    if ($translatedInput.Count -ne 1 -or [string]::IsNullOrWhiteSpace([string]$translatedInput[0])) {
      Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_EVENT_TRANSLATION_FAILED'
    }
    $temporary = @(Invoke-WslCapture $wsl ([string]$binding.distribution) @('/usr/bin/mktemp', '/tmp/kstack-jira-wsl-XXXXXXXX.json') 'KSTACK_JIRA_WSL_TEMPORARY_FILE_FAILED')
    if ($temporary.Count -ne 1 -or ([string]$temporary[0]).Trim() -cnotmatch '^/tmp/kstack-jira-wsl-[A-Za-z0-9]{8}[.]json$') {
      Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_TEMPORARY_FILE_FAILED'
    }
    $temporaryWslFile = ([string]$temporary[0]).Trim()
    $cleanupWsl = $wsl
    $cleanupDistribution = [string]$binding.distribution
    & $wsl '--distribution' ([string]$binding.distribution) '--exec' '/usr/bin/cp' '--' (([string]$translatedInput[0]).Trim()) $temporaryWslFile
    if ($LASTEXITCODE -ne 0) { Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_EVENT_COPY_FAILED' }
    & $wsl '--distribution' ([string]$binding.distribution) '--exec' '/usr/bin/chmod' '600' $temporaryWslFile
    if ($LASTEXITCODE -ne 0) { Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_EVENT_COPY_FAILED' }
    $arguments += @('--file', $temporaryWslFile)
  }
  $arguments += @('--config', $wslConfig)
  & $wsl @arguments
  $childExitCode = $LASTEXITCODE
  if ($temporaryWslFile) {
    & $wsl '--distribution' ([string]$binding.distribution) '--exec' '/usr/bin/rm' '-f' '--' $temporaryWslFile
    if ($LASTEXITCODE -ne 0) { Fail-KStackJiraWsl 'KSTACK_JIRA_WSL_TEMPORARY_CLEANUP_FAILED' }
    $temporaryWslFile = $null
  }
  exit $childExitCode
} catch {
  if ($TestDiagnostics) {
    [Console]::Error.WriteLine("$($_.Exception.GetType().FullName):$($_.Exception.Message):line-$($_.InvocationInfo.ScriptLineNumber)")
  }
  $code = $_.Exception.Message
  if ($temporaryWslFile -and $cleanupWsl -and $cleanupDistribution) {
    & $cleanupWsl '--distribution' $cleanupDistribution '--exec' '/usr/bin/rm' '-f' '--' $temporaryWslFile 2>$null | Out-Null
  }
  if ($code -cnotmatch '^KSTACK_JIRA_WSL_[A-Z0-9_]+$') { $code = 'KSTACK_JIRA_WSL_INTERNAL_ERROR' }
  [Console]::Error.WriteLine($code)
  exit 1
}
