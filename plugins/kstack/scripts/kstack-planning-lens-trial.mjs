#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findConfig, validateConfig } from './kstack-config.mjs';
import {
  analyzeTrial,
  captureOutput,
  freezeSelectors,
  prepareAdjudication,
  prepareTrial,
  trialStatus,
  trialTemplate
} from './kstack-planning-lens-core.mjs';

function parseArgs(argv) {
  if (argv[0] === '--help') return { command: 'help', help: true };
  const [command = 'status', ...rest] = argv;
  const args = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const current = rest[index];
    if (!current.startsWith('--')) throw new Error(`Unexpected argument: ${current}`);
    const key = current.slice(2);
    if (key === 'help') args.help = true;
    else args[key] = rest[++index];
  }
  return args;
}

function requireArg(args, name) {
  if (!args[name]) throw new Error(`Missing --${name}`);
  return args[name];
}

function loadConfig(projectRoot, explicitPath) {
  const configPath = explicitPath ? path.resolve(explicitPath) : findConfig(projectRoot);
  if (!configPath) throw new Error('No .kstack/config.json found.');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const errors = validateConfig(config, { configPath });
  if (errors.length) throw new Error(`Invalid KStack config:\n- ${errors.join('\n- ')}`);
  return config;
}

function initialize(directory, trialId, projectRoot) {
  const resolved = path.resolve(directory);
  const relative = path.relative(path.resolve(projectRoot), resolved);
  if (relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`))) throw new Error('trial directory must be outside the Git worktree');
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  const template = trialTemplate(trialId);
  for (const [name, value] of Object.entries(template)) {
    fs.writeFileSync(path.join(resolved, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  }
  return { status: 'TEMPLATES_CREATED', trialDir: resolved, files: ['trial.json', 'corpus.json', 'gold.json'] };
}

function usage() {
  return `Usage:
  kstack-planning-lens-trial init --trial-dir OUTSIDE_WORKTREE [--trial-id ID]
  kstack-planning-lens-trial prepare --trial-dir DIR [--project-root DIR] [--config FILE]
  kstack-planning-lens-trial freeze-selectors --trial-dir DIR [--project-root DIR]
  kstack-planning-lens-trial capture --trial-dir DIR --dispatch ID --output FILE [--project-root DIR]
  kstack-planning-lens-trial adjudication --trial-dir DIR [--project-root DIR]
  kstack-planning-lens-trial analyze --trial-dir DIR [--project-root DIR]
  kstack-planning-lens-trial status --trial-dir DIR [--project-root DIR]

The trial directory must be access-controlled and outside the Git worktree.
prepare freezes a shuffled dispatch plan but withholds provider packets until selectors freeze.
freeze-selectors releases the packets; no command calls a provider or spends money.`;
}

export async function main(argv) {
  const args = parseArgs(argv);
  if (args.help || args.command === 'help') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const projectRoot = path.resolve(args['project-root'] ?? process.cwd());
  let result;
  if (args.command === 'init') {
    result = initialize(requireArg(args, 'trial-dir'), args['trial-id'] ?? 'planning-lens-trial', projectRoot);
  } else if (args.command === 'prepare') {
    result = prepareTrial({
      trialDir: requireArg(args, 'trial-dir'),
      projectRoot,
      config: loadConfig(projectRoot, args.config)
    });
  } else if (args.command === 'capture') {
    result = captureOutput({
      trialDir: requireArg(args, 'trial-dir'),
      projectRoot,
      dispatchId: requireArg(args, 'dispatch'),
      outputFile: requireArg(args, 'output')
    });
  } else if (args.command === 'freeze-selectors') {
    result = freezeSelectors({ trialDir: requireArg(args, 'trial-dir'), projectRoot });
  } else if (args.command === 'adjudication') {
    result = prepareAdjudication({ trialDir: requireArg(args, 'trial-dir'), projectRoot });
  } else if (args.command === 'analyze') {
    result = analyzeTrial({ trialDir: requireArg(args, 'trial-dir'), projectRoot });
  } else if (args.command === 'status') {
    result = trialStatus({ trialDir: requireArg(args, 'trial-dir'), projectRoot });
  } else {
    throw new Error(`Unknown command: ${args.command}`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 2;
  });
}
