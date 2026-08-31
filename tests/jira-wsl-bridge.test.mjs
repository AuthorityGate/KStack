import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bridgePath = path.join(repositoryRoot, 'plugins', 'kstack', 'workers', 'kstack-jira-wsl.ps1');
const bindingPath = path.join(repositoryRoot, '.kstack', 'wsl-jira-executor.json');

test('native Windows Jira bridge has a closed command and execution surface', () => {
  const source = fs.readFileSync(bridgePath, 'utf8');
  assert.match(source, /ValidateSet\('append', 'list', 'sync'\)/u);
  assert.match(source, /'--distribution'.*'--exec'/u);
  assert.match(source, /kstack-jira-tracking[.]mjs/u);
  assert.match(source, /KSTACK_JIRA_WSL_DISTRIBUTION_MISMATCH/u);
  assert.match(source, /KSTACK_JIRA_WSL_PROJECT_MISMATCH/u);
  assert.match(source, /\/usr\/bin\/mktemp/u);
  assert.match(source, /\/usr\/bin\/chmod' '600'/u);
  assert.doesNotMatch(source, /Invoke-Expression|Start-Process|cmd[.]exe|bash|-lc|sh -c/iu);
  assert.doesNotMatch(source, /credentialSource[.]path.*Get-Content|Authorization|apiToken|password/iu);
});

test('WSL Jira executor binding is exact and contains no credential metadata', () => {
  const binding = JSON.parse(fs.readFileSync(bindingPath, 'utf8'));
  assert.deepEqual(Object.keys(binding).sort(), [
    'distribution', 'nodePath', 'repositoryNamespace', 'schemaVersion', 'windowsRepositoryPath', 'wslRepositoryPath'
  ]);
  assert.equal(binding.schemaVersion, 'kstack-jira-wsl-executor-v1');
  assert.equal(binding.repositoryNamespace, 'AuthorityGate/KStack');
  assert.match(binding.distribution, /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u);
  assert.match(binding.windowsRepositoryPath, /^[A-Za-z]:\\/u);
  assert.match(binding.wslRepositoryPath, /^\/mnt\/[a-z]\//u);
  assert.match(binding.nodePath, /^\//u);
  assert.doesNotMatch(JSON.stringify(binding), /credential|token|email|secret/iu);
});

test('repository instructions make WSL authoritative and prohibit fallback discovery', () => {
  const instructions = fs.readFileSync(path.join(repositoryRoot, 'AGENTS.md'), 'utf8');
  assert.match(instructions, /sole Jira credential and executor.*WSL/su);
  assert.match(instructions, /Never treat a missing Atlassian\/Jira MCP connector as a Jira outage/u);
  assert.match(instructions, /kstack-jira-wsl[.]ps1/u);
  assert.match(instructions, /Never read, display, copy, migrate, or expose/u);
});
