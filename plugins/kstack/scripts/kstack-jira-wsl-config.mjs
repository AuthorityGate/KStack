#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readKStackConfig } from './kstack-config.mjs';

function main(argv) {
  if (argv.length !== 1) throw new Error('KSTACK_JIRA_WSL_CONFIG_ARGUMENT_INVALID');
  const configPath = path.resolve(argv[0]);
  const config = readKStackConfig(configPath);
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'kstack-jira-wsl-config-projection-v1',
    jiraEnabled: config.jira.enabled,
    repositoryNamespace: config.jira.tracking.repositoryNamespace,
    credentialSourceType: config.jira.credentialSource.type,
    credentialSourceAbsolute: path.isAbsolute(config.jira.credentialSource.path)
  })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch { process.stderr.write('KSTACK_JIRA_WSL_CONFIG_INVALID\n'); process.exitCode = 2; }
}
