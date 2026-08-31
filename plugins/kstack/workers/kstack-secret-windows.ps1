# Audited native host worker; not imported into the model-facing Node process.
param(
  [Parameter(Mandatory = $true)][ValidateSet('Probe', 'SyntheticLifecycle', 'SyntheticJiraAdapter', 'EnrollInteractive', 'RotateInteractive', 'Revoke', 'Inventory', 'JiraAuthCheck')][string]$Mode,
  [string]$HandleId,
  [string]$PurposeId,
  [string]$AdapterId,
  [string]$TargetOrigin,
  [string]$TestRoot,
  [switch]$TestDiagnostics
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[void][Reflection.Assembly]::LoadWithPartialName('System.Security')
[void][Reflection.Assembly]::LoadWithPartialName('System.Net.Http')
$Utf8 = New-Object System.Text.UTF8Encoding($false)
$BackendId = 'windows-dpapi-current-user-v1'
$RecordSchema = 'kstack-windows-dpapi-record-v1'
$HandlePattern = '^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
$IdentifierPattern = '^[a-z0-9][a-z0-9._-]{0,95}$'
$TargetPattern = '^https://[a-z0-9-]+[.]atlassian[.]net$'

function Write-SafeResult([hashtable]$Value) {
  [Console]::Out.WriteLine(($Value | ConvertTo-Json -Compress -Depth 6))
}

function Fail-Closed([string]$Code) {
  throw [InvalidOperationException]::new($Code)
}

function Get-StateRoot {
  if ($Mode -in @('SyntheticLifecycle', 'SyntheticJiraAdapter')) {
    if ([string]::IsNullOrWhiteSpace($TestRoot)) { return [IO.Path]::Combine([IO.Path]::GetTempPath(), "kstack-secret-test-$([Guid]::NewGuid().ToString('N'))") }
    if (-not [IO.Path]::IsPathRooted($TestRoot)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_TEST_ROOT_INVALID' }
    return [IO.Path]::GetFullPath($TestRoot)
  }
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA) -or -not [IO.Path]::IsPathRooted($env:LOCALAPPDATA)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_STATE_UNAVAILABLE' }
  return [IO.Path]::Combine($env:LOCALAPPDATA, 'AuthorityGate', 'KStack', 'secret-broker')
}

function Set-PrivateAcl([string]$Path) {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  if ($null -eq $identity.User) { Fail-Closed 'KSTACK_SECRET_WINDOWS_IDENTITY_UNAVAILABLE' }
  $acl = New-Object Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true, $false)
  $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
  $propagation = [Security.AccessControl.PropagationFlags]::None
  $allow = [Security.AccessControl.AccessControlType]::Allow
  $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity.User, 'FullControl', $inheritance, $propagation, $allow)))
  $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier('S-1-5-18')), 'FullControl', $inheritance, $propagation, $allow)))
  [IO.Directory]::SetAccessControl($Path, $acl)
}

function Ensure-StateRoot([string]$Root) {
  [IO.Directory]::CreateDirectory($Root) | Out-Null
  Set-PrivateAcl $Root
  $handles = [IO.Path]::Combine($Root, 'handles')
  [IO.Directory]::CreateDirectory($handles) | Out-Null
  Set-PrivateAcl $handles
  return $handles
}

function Assert-Handle([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value) -or $Value -cnotmatch $HandlePattern) { Fail-Closed 'KSTACK_SECRET_WINDOWS_HANDLE_INVALID' }
}

function Assert-Identifier([string]$Value, [string]$Code) {
  if ([string]::IsNullOrWhiteSpace($Value) -or $Value -cnotmatch $IdentifierPattern) { Fail-Closed $Code }
}

function Assert-Target([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value) -or $Value -cnotmatch $TargetPattern) { Fail-Closed 'KSTACK_SECRET_WINDOWS_TARGET_INVALID' }
}

function New-Metadata([string]$Id, [string]$Purpose, [string]$Adapter, [string]$Target, [int]$Generation, [string]$State) {
  return [ordered]@{
    schemaVersion = $RecordSchema
    handleId = $Id
    backendId = $BackendId
    adapterId = $Adapter
    targetOrigin = $Target
    purposeId = $Purpose
    generation = $Generation
    state = $State
    createdAt = [DateTime]::UtcNow.ToString('o')
  }
}

function Get-MetadataBytes([System.Collections.IDictionary]$Metadata) {
  return $Utf8.GetBytes(($Metadata | ConvertTo-Json -Compress -Depth 4))
}

function Get-Entropy([byte[]]$MetadataBytes) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return $sha.ComputeHash($MetadataBytes) } finally { $sha.Dispose() }
}

function Clear-Bytes([byte[]]$Value) {
  if ($null -ne $Value) { [Array]::Clear($Value, 0, $Value.Length) }
}

function Get-Sha256([string]$Value) {
  [byte[]]$bytes = $null
  [byte[]]$hash = $null
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $Utf8.GetBytes($Value)
    $hash = $sha.ComputeHash($bytes)
    return ([BitConverter]::ToString($hash).Replace('-', '').ToLowerInvariant())
  } finally {
    Clear-Bytes $bytes
    Clear-Bytes $hash
    $sha.Dispose()
  }
}

function Assert-Email([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value) -or $Value.Length -gt 254 -or $Value -cnotmatch '^[^:@\s]+@[^:@\s]+[.][^:@\s]+$') { Fail-Closed 'KSTACK_SECRET_WINDOWS_EMAIL_INVALID' }
}

function Get-RecordPaths([string]$HandlesRoot, [string]$Id) {
  Assert-Handle $Id
  $recordRoot = [IO.Path]::Combine($HandlesRoot, $Id)
  return @{
    Root = $recordRoot
    Metadata = [IO.Path]::Combine($recordRoot, 'metadata.json')
    Blob = [IO.Path]::Combine($recordRoot, 'protected.bin')
    Tombstone = [IO.Path]::Combine($HandlesRoot, "${Id}.revoked")
  }
}

function Write-NewRecord([string]$HandlesRoot, [System.Collections.IDictionary]$Metadata, [byte[]]$ValueBytes) {
  $paths = Get-RecordPaths $HandlesRoot $Metadata.handleId
  if ([IO.Directory]::Exists($paths.Root)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_RECORD_EXISTS' }
  $temporary = "$($paths.Root).pending-$([Guid]::NewGuid().ToString('N'))"
  $metadataBytes = $null
  $entropy = $null
  $protected = $null
  try {
    [IO.Directory]::CreateDirectory($temporary) | Out-Null
    Set-PrivateAcl $temporary
    $metadataBytes = Get-MetadataBytes $Metadata
    $entropy = Get-Entropy $metadataBytes
    $protected = [Security.Cryptography.ProtectedData]::Protect($ValueBytes, $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes([IO.Path]::Combine($temporary, 'metadata.json'), $metadataBytes)
    [IO.File]::WriteAllBytes([IO.Path]::Combine($temporary, 'protected.bin'), $protected)
    [IO.Directory]::Move($temporary, $paths.Root)
  } finally {
    Clear-Bytes $metadataBytes
    Clear-Bytes $entropy
    Clear-Bytes $protected
    if ([IO.Directory]::Exists($temporary)) { [IO.Directory]::Delete($temporary, $true) }
  }
}

function Read-Record([string]$HandlesRoot, [string]$Id) {
  $paths = Get-RecordPaths $HandlesRoot $Id
  if (-not [IO.Directory]::Exists($paths.Root) -or -not [IO.File]::Exists($paths.Metadata) -or -not [IO.File]::Exists($paths.Blob)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_RECORD_MISSING' }
  $metadataBytes = [IO.File]::ReadAllBytes($paths.Metadata)
  if ($metadataBytes.Length -lt 2 -or $metadataBytes.Length -gt 8192) { Clear-Bytes $metadataBytes; Fail-Closed 'KSTACK_SECRET_WINDOWS_RECORD_INVALID' }
  try { $metadata = ($Utf8.GetString($metadataBytes) | ConvertFrom-Json) } catch { Clear-Bytes $metadataBytes; Fail-Closed 'KSTACK_SECRET_WINDOWS_RECORD_INVALID' }
  $expected = @('adapterId', 'backendId', 'createdAt', 'generation', 'handleId', 'purposeId', 'schemaVersion', 'state', 'targetOrigin')
  $actual = @($metadata.PSObject.Properties.Name | Sort-Object)
  if (@(Compare-Object $expected $actual).Count -ne 0 -or $metadata.schemaVersion -ne $RecordSchema -or $metadata.backendId -ne $BackendId -or $metadata.handleId -cne $Id -or $metadata.adapterId -ne 'jira-cloud-auth-v1' -or $metadata.state -notin @('active', 'revoked') -or $metadata.generation -isnot [int] -or $metadata.generation -lt 1) {
    Clear-Bytes $metadataBytes
    Fail-Closed 'KSTACK_SECRET_WINDOWS_RECORD_INVALID'
  }
  Assert-Identifier $metadata.purposeId 'KSTACK_SECRET_WINDOWS_PURPOSE_INVALID'
  Assert-Target $metadata.targetOrigin
  return @{ Paths = $paths; Metadata = $metadata; MetadataBytes = $metadataBytes }
}

function Unprotect-Record([hashtable]$Record) {
  if ($Record.Metadata.state -ne 'active' -or [IO.File]::Exists($Record.Paths.Tombstone)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_RECORD_REVOKED' }
  $entropy = $null
  $protected = $null
  try {
    $entropy = Get-Entropy $Record.MetadataBytes
    $protected = [IO.File]::ReadAllBytes($Record.Paths.Blob)
    if ($protected.Length -lt 32 -or $protected.Length -gt 65536) { Fail-Closed 'KSTACK_SECRET_WINDOWS_RECORD_INVALID' }
    return [Security.Cryptography.ProtectedData]::Unprotect($protected, $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  } catch {
    Fail-Closed 'KSTACK_SECRET_WINDOWS_UNPROTECT_FAILED'
  } finally {
    Clear-Bytes $entropy
    Clear-Bytes $protected
  }
}

function Convert-SecureValueToBytes([Security.SecureString]$SecureValue) {
  $pointer = [IntPtr]::Zero
  [char[]]$characters = $null
  [byte[]]$bytes = $null
  try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($SecureValue)
    $characters = New-Object char[] $SecureValue.Length
    for ($index = 0; $index -lt $characters.Length; $index++) { $characters[$index] = [char][Runtime.InteropServices.Marshal]::ReadInt16($pointer, $index * 2) }
    $bytes = $Utf8.GetBytes($characters)
    if ($bytes.Length -lt 16 -or $bytes.Length -gt 16384) { Clear-Bytes $bytes; Fail-Closed 'KSTACK_SECRET_WINDOWS_VALUE_LENGTH_INVALID' }
    return $bytes
  } finally {
    if ($null -ne $characters) { [Array]::Clear($characters, 0, $characters.Length) }
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($pointer) }
  }
}

function Equal-Bytes([byte[]]$Left, [byte[]]$Right) {
  if ($Left.Length -ne $Right.Length) { return $false }
  $difference = 0
  for ($index = 0; $index -lt $Left.Length; $index++) { $difference = $difference -bor ($Left[$index] -bxor $Right[$index]) }
  return $difference -eq 0
}

function Write-ProtectedDirectory([string]$Directory, [System.Collections.IDictionary]$Metadata, [byte[]]$ValueBytes) {
  $metadataBytes = $null
  $entropy = $null
  $protected = $null
  try {
    [IO.Directory]::CreateDirectory($Directory) | Out-Null
    Set-PrivateAcl $Directory
    $metadataBytes = Get-MetadataBytes $Metadata
    $entropy = Get-Entropy $metadataBytes
    $protected = [Security.Cryptography.ProtectedData]::Protect($ValueBytes, $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes([IO.Path]::Combine($Directory, 'metadata.json'), $metadataBytes)
    [IO.File]::WriteAllBytes([IO.Path]::Combine($Directory, 'protected.bin'), $protected)
  } finally {
    Clear-Bytes $metadataBytes
    Clear-Bytes $entropy
    Clear-Bytes $protected
  }
}

function Replace-Record([string]$HandlesRoot, [System.Collections.IDictionary]$Metadata, [byte[]]$ValueBytes) {
  $paths = Get-RecordPaths $HandlesRoot $Metadata.handleId
  if (-not [IO.Directory]::Exists($paths.Root)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_RECORD_MISSING' }
  $temporary = "$($paths.Root).pending-$([Guid]::NewGuid().ToString('N'))"
  $previous = "$($paths.Root).previous-g$($Metadata.generation - 1)"
  if ([IO.Directory]::Exists($previous)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_PREVIOUS_EXISTS' }
  try {
    Write-ProtectedDirectory $temporary $Metadata $ValueBytes
    [IO.Directory]::Move($paths.Root, $previous)
    try { [IO.Directory]::Move($temporary, $paths.Root) } catch {
      [IO.Directory]::Move($previous, $paths.Root)
      throw
    }
  } finally {
    if ([IO.Directory]::Exists($temporary)) { [IO.Directory]::Delete($temporary, $true) }
  }
}

function Write-RevocationTombstone([hashtable]$Paths, [int]$Generation) {
  if ([IO.File]::Exists($Paths.Tombstone)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_RECORD_REVOKED' }
  $temporary = "$($Paths.Tombstone).pending-$([Guid]::NewGuid().ToString('N'))"
  [byte[]]$bytes = $null
  try {
    $bytes = $Utf8.GetBytes((([ordered]@{ schemaVersion = 'kstack-secret-revocation-tombstone-v1'; generation = $Generation; state = 'revoked' }) | ConvertTo-Json -Compress))
    $stream = New-Object IO.FileStream($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    [IO.File]::Move($temporary, $Paths.Tombstone)
  } finally {
    Clear-Bytes $bytes
    if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
  }
}

function Read-ConfirmedValue([string]$Prompt) {
  [byte[]]$first = $null
  [byte[]]$second = $null
  try {
    $first = Convert-SecureValueToBytes (Read-Host "$Prompt" -AsSecureString)
    $second = Convert-SecureValueToBytes (Read-Host 'Confirm protected value' -AsSecureString)
    if (-not (Equal-Bytes $first $second)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_CONFIRMATION_MISMATCH' }
    $copy = New-Object byte[] $first.Length
    [Array]::Copy($first, $copy, $first.Length)
    return $copy
  } finally {
    Clear-Bytes $first
    Clear-Bytes $second
  }
}

function Invoke-Probe {
  [byte[]]$value = New-Object byte[] 32
  [byte[]]$protected = $null
  [byte[]]$plain = $null
  try {
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($value)
    $protected = [Security.Cryptography.ProtectedData]::Protect($value, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $plain = [Security.Cryptography.ProtectedData]::Unprotect($protected, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    if (-not (Equal-Bytes $value $plain)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_DPAPI_UNAVAILABLE' }
    Write-SafeResult ([ordered]@{ schemaVersion = 'kstack-secret-backend-probe-v1'; backendId = $BackendId; available = $true; custodyScope = 'current-windows-user' })
  } finally {
    Clear-Bytes $value
    Clear-Bytes $protected
    Clear-Bytes $plain
  }
}

function Invoke-Enroll([string]$HandlesRoot) {
  Assert-Handle $HandleId
  Assert-Identifier $PurposeId 'KSTACK_SECRET_WINDOWS_PURPOSE_INVALID'
  if ($AdapterId -ne 'jira-cloud-auth-v1') { Fail-Closed 'KSTACK_SECRET_WINDOWS_ADAPTER_UNAVAILABLE' }
  Assert-Target $TargetOrigin
  [byte[]]$value = $null
  try {
    $paths = Get-RecordPaths $HandlesRoot $HandleId
    if ([IO.File]::Exists($paths.Tombstone)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_RECORD_REVOKED' }
    $value = Read-ConfirmedValue 'Enter protected value'
    $metadata = New-Metadata $HandleId $PurposeId $AdapterId $TargetOrigin 1 'active'
    Write-NewRecord $HandlesRoot $metadata $value
    Write-SafeResult ([ordered]@{ schemaVersion = 'kstack-secret-enrollment-result-v1'; handleId = $HandleId; backendId = $BackendId; generation = 1; state = 'active' })
  } finally { Clear-Bytes $value }
}

function Invoke-Rotate([string]$HandlesRoot) {
  $record = Read-Record $HandlesRoot $HandleId
  [byte[]]$value = $null
  try {
    if ($record.Metadata.state -ne 'active' -or [IO.File]::Exists($record.Paths.Tombstone)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_RECORD_REVOKED' }
    $value = Read-ConfirmedValue 'Enter replacement protected value'
    $metadata = New-Metadata $record.Metadata.handleId $record.Metadata.purposeId $record.Metadata.adapterId $record.Metadata.targetOrigin ($record.Metadata.generation + 1) 'active'
    Replace-Record $HandlesRoot $metadata $value
    Write-SafeResult ([ordered]@{ schemaVersion = 'kstack-secret-rotation-result-v1'; handleId = $HandleId; backendId = $BackendId; generation = $metadata.generation; state = 'active'; priorGenerationRetained = $true })
  } finally {
    Clear-Bytes $value
    Clear-Bytes $record.MetadataBytes
  }
}

function Invoke-Revoke([string]$HandlesRoot) {
  $record = Read-Record $HandlesRoot $HandleId
  [byte[]]$value = $null
  try {
    $value = Unprotect-Record $record
    $metadata = New-Metadata $record.Metadata.handleId $record.Metadata.purposeId $record.Metadata.adapterId $record.Metadata.targetOrigin ($record.Metadata.generation + 1) 'revoked'
    Write-RevocationTombstone $record.Paths $metadata.generation
    if (-not [IO.File]::Exists($record.Paths.Tombstone)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_TOMBSTONE_MISSING' }
    Replace-Record $HandlesRoot $metadata $value
    Write-SafeResult ([ordered]@{ schemaVersion = 'kstack-secret-revocation-result-v1'; handleId = $HandleId; backendId = $BackendId; generation = $metadata.generation; state = 'revoked'; priorGenerationRetained = $true })
  } finally {
    Clear-Bytes $value
    Clear-Bytes $record.MetadataBytes
  }
}

function Invoke-JiraHttp([string]$Origin, [string]$UserEmail, [byte[]]$ValueBytes) {
  Assert-Email $UserEmail
  [byte[]]$emailBytes = $null
  [byte[]]$credentialBytes = $null
  $handler = $null
  $client = $null
  $response = $null
  try {
    $emailBytes = $Utf8.GetBytes($UserEmail)
    $credentialBytes = New-Object byte[] ($emailBytes.Length + 1 + $ValueBytes.Length)
    [Array]::Copy($emailBytes, 0, $credentialBytes, 0, $emailBytes.Length)
    $credentialBytes[$emailBytes.Length] = 58
    [Array]::Copy($ValueBytes, 0, $credentialBytes, $emailBytes.Length + 1, $ValueBytes.Length)
    $encoded = [Convert]::ToBase64String($credentialBytes)
    $handler = New-Object Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $client = New-Object Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(15)
    $client.DefaultRequestHeaders.Authorization = New-Object Net.Http.Headers.AuthenticationHeaderValue('Basic', $encoded)
    $response = $client.GetAsync("$Origin/rest/api/3/myself", [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    return [int]$response.StatusCode
  } catch {
    Fail-Closed 'KSTACK_SECRET_WINDOWS_JIRA_REQUEST_FAILED'
  } finally {
    if ($null -ne $response) { $response.Dispose() }
    if ($null -ne $client) { $client.Dispose() }
    if ($null -ne $handler) { $handler.Dispose() }
    Clear-Bytes $emailBytes
    Clear-Bytes $credentialBytes
  }
}

function Invoke-JiraAuthCheck([string]$HandlesRoot) {
  Assert-Handle $HandleId
  $userEmail = Read-Host 'Enter Jira account email'
  Assert-Email $userEmail
  $record = Read-Record $HandlesRoot $HandleId
  [byte[]]$value = $null
  try {
    if ($record.Metadata.adapterId -ne 'jira-cloud-auth-v1') { Fail-Closed 'KSTACK_SECRET_WINDOWS_ADAPTER_UNAVAILABLE' }
    Assert-Target $record.Metadata.targetOrigin
    $value = Unprotect-Record $record
    $status = Invoke-JiraHttp $record.Metadata.targetOrigin $userEmail $value
    $outcome = if ($status -eq 200) { 'SUCCEEDED' } elseif ($status -in @(401, 403)) { 'DENIED' } else { 'FAILED' }
    Write-SafeResult ([ordered]@{
      schemaVersion = 'kstack-secret-operation-receipt-v1'
      operationId = "auth-check-$([Guid]::NewGuid().ToString('N'))"
      handleDigest = Get-Sha256 $HandleId
      backendId = $BackendId
      adapterId = 'jira-cloud-auth-v1'
      targetDigest = Get-Sha256 $record.Metadata.targetOrigin
      generation = $record.Metadata.generation
      outcome = $outcome
      occurredAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    })
  } finally {
    $userEmail = $null
    Clear-Bytes $value
    Clear-Bytes $record.MetadataBytes
  }
}

function Invoke-Inventory([string]$HandlesRoot) {
  $items = @()
  foreach ($directory in @([IO.Directory]::GetDirectories($HandlesRoot) | Sort-Object)) {
    $id = [IO.Path]::GetFileName($directory)
    if ($id -cnotmatch $HandlePattern) { continue }
    $record = Read-Record $HandlesRoot $id
    try {
      $items += [ordered]@{
        handleId = $record.Metadata.handleId
        backendId = $record.Metadata.backendId
        adapterId = $record.Metadata.adapterId
        targetDigest = Get-Sha256 $record.Metadata.targetOrigin
        purposeId = $record.Metadata.purposeId
        generation = $record.Metadata.generation
        state = $record.Metadata.state
      }
    } finally { Clear-Bytes $record.MetadataBytes }
  }
  Write-SafeResult ([ordered]@{ schemaVersion = 'kstack-secret-safe-inventory-v1'; backendId = $BackendId; items = $items })
}

function Invoke-SyntheticLifecycle([string]$Root, [string]$HandlesRoot) {
  $id = ([Guid]::NewGuid().ToString()).ToLowerInvariant()
  [byte[]]$first = New-Object byte[] 48
  [byte[]]$second = New-Object byte[] 48
  [byte[]]$opened = $null
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($first)
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($second)
  try {
    $metadata1 = New-Metadata $id 'synthetic-jira-auth' 'jira-cloud-auth-v1' 'https://synthetic.atlassian.net' 1 'active'
    Write-NewRecord $HandlesRoot $metadata1 $first
    $record1 = Read-Record $HandlesRoot $id
    try {
      $opened = Unprotect-Record $record1
      if (-not (Equal-Bytes $first $opened)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_SYNTHETIC_MISMATCH' }
    } finally { Clear-Bytes $opened; Clear-Bytes $record1.MetadataBytes }

    $metadata2 = New-Metadata $id 'synthetic-jira-auth' 'jira-cloud-auth-v1' 'https://synthetic.atlassian.net' 2 'active'
    Replace-Record $HandlesRoot $metadata2 $second
    $record2 = Read-Record $HandlesRoot $id
    try {
      $opened = Unprotect-Record $record2
      if (-not (Equal-Bytes $second $opened)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_SYNTHETIC_MISMATCH' }
    } finally { Clear-Bytes $opened; Clear-Bytes $record2.MetadataBytes }

    $paths = Get-RecordPaths $HandlesRoot $id
    $failed = "$($paths.Root).failed"
    $previous = "$($paths.Root).previous-g1"
    [IO.Directory]::Move($paths.Root, $failed)
    [IO.Directory]::Move($previous, $paths.Root)
    $recovered = Read-Record $HandlesRoot $id
    try {
      $opened = Unprotect-Record $recovered
      if (-not (Equal-Bytes $first $opened)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_SYNTHETIC_MISMATCH' }
    } finally { Clear-Bytes $opened; Clear-Bytes $recovered.MetadataBytes }
    [IO.Directory]::Delete($failed, $true)

    $active = Read-Record $HandlesRoot $id
    try {
      $opened = Unprotect-Record $active
      $revoked = New-Metadata $id 'synthetic-jira-auth' 'jira-cloud-auth-v1' 'https://synthetic.atlassian.net' 2 'revoked'
      Write-RevocationTombstone $active.Paths $revoked.generation
      Replace-Record $HandlesRoot $revoked $opened
    } finally { Clear-Bytes $opened; Clear-Bytes $active.MetadataBytes }
    $revokedRecord = Read-Record $HandlesRoot $id
    $denied = $false
    try { $opened = Unprotect-Record $revokedRecord } catch { if ($_.Exception.Message -eq 'KSTACK_SECRET_WINDOWS_RECORD_REVOKED') { $denied = $true } else { throw } } finally { Clear-Bytes $opened; Clear-Bytes $revokedRecord.MetadataBytes }
    if (-not $denied) { Fail-Closed 'KSTACK_SECRET_WINDOWS_REVOKE_FAILED' }

    $paths = Get-RecordPaths $HandlesRoot $id
    $revokedCurrent = "$($paths.Root).revoked-current"
    $priorActive = "$($paths.Root).previous-g1"
    [IO.Directory]::Move($paths.Root, $revokedCurrent)
    [IO.Directory]::Move($priorActive, $paths.Root)
    $restoredAfterRevoke = Read-Record $HandlesRoot $id
    if (-not [IO.File]::Exists($restoredAfterRevoke.Paths.Tombstone)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_TOMBSTONE_LOST' }
    $resurrectionDenied = $false
    try { $opened = Unprotect-Record $restoredAfterRevoke } catch { if ($_.Exception.Message -eq 'KSTACK_SECRET_WINDOWS_RECORD_REVOKED') { $resurrectionDenied = $true } else { throw } } finally { Clear-Bytes $opened; Clear-Bytes $restoredAfterRevoke.MetadataBytes }
    if (-not $resurrectionDenied) { Fail-Closed 'KSTACK_SECRET_WINDOWS_NON_RESURRECTION_FAILED' }

    Write-SafeResult ([ordered]@{
      schemaVersion = 'kstack-secret-synthetic-lifecycle-v1'
      backendId = $BackendId
      enrollment = 'PASS'
      use = 'PASS'
      rotation = 'PASS'
      recovery = 'PASS'
      revocation = 'PASS'
      nonResurrection = 'PASS'
      valueOutputBytes = 0
    })
  } finally {
    Clear-Bytes $first
    Clear-Bytes $second
    Clear-Bytes $opened
    if ([IO.Directory]::Exists($Root)) { [IO.Directory]::Delete($Root, $true) }
  }
}

function Invoke-SyntheticJiraAdapter([string]$Root, [string]$HandlesRoot) {
  $id = ([Guid]::NewGuid().ToString()).ToLowerInvariant()
  [byte[]]$value = $Utf8.GetBytes(('kstack-' + 'synthetic-' + 'jira-' + 'adapter-value'))
  [byte[]]$opened = $null
  [byte[]]$emailBytes = $null
  [byte[]]$credentialBytes = $null
  [byte[]]$requestBytes = New-Object byte[] 8192
  [byte[]]$responseBytes = $null
  $listener = $null
  $tcp = $null
  $stream = $null
  $handler = $null
  $client = $null
  $httpResponse = $null
  try {
    $metadata = New-Metadata $id 'synthetic-jira-auth' 'jira-cloud-auth-v1' 'https://synthetic.atlassian.net' 1 'active'
    Write-NewRecord $HandlesRoot $metadata $value
    $record = Read-Record $HandlesRoot $id
    try { $opened = Unprotect-Record $record } finally { Clear-Bytes $record.MetadataBytes }
    if (-not (Equal-Bytes $value $opened)) { Fail-Closed 'KSTACK_SECRET_WINDOWS_SYNTHETIC_MISMATCH' }

    $email = 'synthetic@example.invalid'
    $emailBytes = $Utf8.GetBytes($email)
    $credentialBytes = New-Object byte[] ($emailBytes.Length + 1 + $opened.Length)
    [Array]::Copy($emailBytes, 0, $credentialBytes, 0, $emailBytes.Length)
    $credentialBytes[$emailBytes.Length] = 58
    [Array]::Copy($opened, 0, $credentialBytes, $emailBytes.Length + 1, $opened.Length)
    $expectedHeader = 'Authorization: Basic ' + [Convert]::ToBase64String($credentialBytes)

    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
    $handler = New-Object Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $handler.UseProxy = $false
    $client = New-Object Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(10)
    $client.DefaultRequestHeaders.Authorization = New-Object Net.Http.Headers.AuthenticationHeaderValue('Basic', [Convert]::ToBase64String($credentialBytes))
    $task = $client.GetAsync("http://127.0.0.1:$port/rest/api/3/myself")

    $tcp = $listener.AcceptTcpClient()
    $stream = $tcp.GetStream()
    $stream.ReadTimeout = 5000
    $count = 0
    while ($count -lt $requestBytes.Length) {
      $read = $stream.Read($requestBytes, $count, $requestBytes.Length - $count)
      if ($read -le 0) { break }
      $count += $read
      if ($count -ge 4 -and [Text.Encoding]::ASCII.GetString($requestBytes, 0, $count).Contains("`r`n`r`n")) { break }
    }
    $requestText = [Text.Encoding]::ASCII.GetString($requestBytes, 0, $count)
    $matched = $requestText.Split(@("`r`n"), [StringSplitOptions]::None) -contains $expectedHeader
    $statusLine = if ($matched) { 'HTTP/1.1 200 OK' } else { 'HTTP/1.1 401 Unauthorized' }
    $responseBytes = [Text.Encoding]::ASCII.GetBytes("$statusLine`r`nContent-Length: 0`r`nConnection: close`r`n`r`n")
    $stream.Write($responseBytes, 0, $responseBytes.Length)
    $stream.Flush()
    $httpResponse = $task.GetAwaiter().GetResult()
    if (-not $matched -or [int]$httpResponse.StatusCode -ne 200) { Fail-Closed 'KSTACK_SECRET_WINDOWS_JIRA_ADAPTER_FAILED' }

    Write-SafeResult ([ordered]@{
      schemaVersion = 'kstack-secret-synthetic-adapter-v1'
      backendId = $BackendId
      adapterId = 'jira-cloud-auth-v1'
      targetBinding = 'PASS'
      authentication = 'PASS'
      redirectsDisabled = $true
      responseBodyDiscarded = $true
      valueOutputBytes = 0
    })
  } finally {
    if ($null -ne $httpResponse) { $httpResponse.Dispose() }
    if ($null -ne $stream) { $stream.Dispose() }
    if ($null -ne $tcp) { $tcp.Dispose() }
    if ($null -ne $listener) { $listener.Stop() }
    if ($null -ne $client) { $client.Dispose() }
    if ($null -ne $handler) { $handler.Dispose() }
    Clear-Bytes $value
    Clear-Bytes $opened
    Clear-Bytes $emailBytes
    Clear-Bytes $credentialBytes
    Clear-Bytes $requestBytes
    Clear-Bytes $responseBytes
    if ([IO.Directory]::Exists($Root)) { [IO.Directory]::Delete($Root, $true) }
  }
}

try {
  Fail-Closed 'KSTACK_SECRET_WINDOWS_IMPLEMENTATION_UNAVAILABLE'
  if ($Mode -eq 'Probe') { Invoke-Probe; exit 0 }
  $root = Get-StateRoot
  $handlesRoot = Ensure-StateRoot $root
  switch ($Mode) {
    'SyntheticLifecycle' { Invoke-SyntheticLifecycle $root $handlesRoot }
    'SyntheticJiraAdapter' { Fail-Closed 'KSTACK_SECRET_WINDOWS_JIRA_CELL_RETIRED' }
    'EnrollInteractive' { Fail-Closed 'KSTACK_SECRET_WINDOWS_JIRA_CELL_RETIRED' }
    'RotateInteractive' { Fail-Closed 'KSTACK_SECRET_WINDOWS_JIRA_CELL_RETIRED' }
    'Revoke' { Invoke-Revoke $handlesRoot }
    'Inventory' { Invoke-Inventory $handlesRoot }
    'JiraAuthCheck' { Fail-Closed 'KSTACK_SECRET_WINDOWS_JIRA_CELL_RETIRED' }
    default { Fail-Closed 'KSTACK_SECRET_WINDOWS_MODE_INVALID' }
  }
} catch {
  if ($Mode -in @('SyntheticLifecycle', 'SyntheticJiraAdapter') -and $TestDiagnostics -and $_.Exception.Message -ne 'KSTACK_SECRET_WINDOWS_IMPLEMENTATION_UNAVAILABLE') {
    [Console]::Error.WriteLine("$($_.Exception.GetType().FullName):$($_.Exception.Message):line-$($_.InvocationInfo.ScriptLineNumber)")
  }
  $code = $_.Exception.Message
  if ($code -cnotmatch '^KSTACK_SECRET_[A-Z0-9_]+$') { $code = 'KSTACK_SECRET_WINDOWS_INTERNAL_ERROR' }
  [Console]::Error.WriteLine($code)
  exit 1
}
