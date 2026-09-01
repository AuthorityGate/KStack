#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig, findConfig, readKStackConfig } from './kstack-config.mjs';
import { claudeInvocationArgs, runProcess, sanitize } from './kstack-provider-runner.mjs';

const supportedRoles = new Set(['opus', 'fable']);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) throw new Error(`Unexpected argument: ${current}`);
    const key = current.slice(2);
    if (key === 'help') args.help = true;
    else args[key] = argv[++index];
  }
  return args;
}

function loadConfig(projectRoot, explicitPath) {
  const file = explicitPath ? path.resolve(explicitPath) : findConfig(projectRoot);
  if (!file) return { file: null, config: structuredClone(defaultConfig) };
  const config = readKStackConfig(file);
  return { file, config };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function runRoleInvocation(options) {
  const role = options.role;
  if (!supportedRoles.has(role)) throw new Error(`Unsupported single-provider role: ${role}`);

  const projectRoot = path.resolve(options.projectRoot);
  const promptFile = path.resolve(options.promptFile);
  const prompt = fs.readFileSync(promptFile, 'utf8');
  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  const { file: configPath, config } = loadConfig(projectRoot, options.configPath);
  const modelConfig = config.models?.[role];
  if (!modelConfig) throw new Error(`models.${role} is not configured`);

  const manifest = {
    schemaVersion: 1,
    role,
    status: 'disabled',
    configPath,
    projectRoot,
    promptSha256: sha256(prompt),
    createdAt: new Date().toISOString()
  };
  const manifestFile = path.join(outDir, 'manifest.json');
  if (config.models.mode === 'off') {
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    return manifest;
  }

  const stdoutFile = path.join(outDir, `.${role}-stdout.tmp`);
  const stderrFile = path.join(outDir, `.${role}-stderr.tmp`);
  const result = await runProcess(modelConfig.command, claudeInvocationArgs(modelConfig), {
    cwd: projectRoot,
    stdinFile: promptFile,
    stdoutFile,
    stderrFile,
    timeoutMs: modelConfig.timeoutSeconds * 1000
  });
  const clean = (value) => config.persistence.redactSecrets ? sanitize(value) : value;
  const directive = clean(result.stdout);
  const stderr = clean(result.stderr);
  const directiveFile = path.join(outDir, `${role}.md`);
  if (result.status === 'complete') fs.writeFileSync(directiveFile, directive, { mode: 0o600 });
  if (stderr) fs.writeFileSync(path.join(outDir, `${role}.stderr.log`), stderr, { mode: 0o600 });
  for (const temporary of [stdoutFile, stderrFile]) {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }

  Object.assign(manifest, {
    status: result.status,
    exitCode: result.exitCode,
    signal: result.signal,
    error: result.error,
    startedAt: result.startedAt,
    durationMs: result.durationMs,
    directiveFile: result.status === 'complete' ? directiveFile : null,
    directiveSha256: result.status === 'complete' ? sha256(directive) : null,
    configurationSha256: sha256(JSON.stringify(modelConfig))
  });
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return manifest;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: kstack-invoke-role --role fable --prompt-file FILE --project-root DIR --out-dir DIR [--config FILE]');
    return;
  }
  for (const required of ['role', 'prompt-file', 'project-root', 'out-dir']) {
    if (!args[required]) throw new Error(`Missing --${required}`);
  }
  const manifest = await runRoleInvocation({
    role: args.role,
    promptFile: args['prompt-file'],
    projectRoot: args['project-root'],
    outDir: args['out-dir'],
    configPath: args.config
  });
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  if (manifest.status !== 'complete' && manifest.status !== 'disabled') process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.stack || error.message); process.exitCode = 2; });
}
