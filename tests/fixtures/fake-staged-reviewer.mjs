#!/usr/bin/env node
import fs from 'node:fs';

const option = (name, fallback = null) => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};
const provider = option('fixture-provider', 'opus');
if (process.argv.includes('--version')) {
  process.stdout.write(`${option('fixture-version-output', provider === 'codex' ? 'codex-cli fixture 1.0.0' : '1.0.0 (Claude Code)')}\n`);
  process.exit(0);
}
const confidence = Number(option('fixture-confidence', '96'));
const decision = option('fixture-decision', 'approve');
const logFile = option('fixture-log');
const malformed = option('fixture-malformed', 'false') === 'true';
const forbiddenFiles = process.argv
  .filter((value) => value.startsWith('--fixture-forbidden-file='))
  .map((value) => value.slice('--fixture-forbidden-file='.length));
const forbiddenEnv = option('fixture-forbidden-env');
const argvLog = option('fixture-argv-log');
const promptLog = option('fixture-prompt-log');
const delayMs = Number(option('fixture-delay-ms', '0'));
const hang = option('fixture-hang', 'false') === 'true';
const intake = option('fixture-intake', 'false') === 'true';
const bareRevise = option('fixture-bare-revise', 'false') === 'true';
if (logFile) fs.appendFileSync(logFile, `${provider}\n`);
if (forbiddenFiles.some((file) => fs.existsSync(file))) process.exit(7);
if (forbiddenEnv && process.env[forbiddenEnv] !== undefined) process.exit(8);
if (argvLog) fs.appendFileSync(argvLog, `${JSON.stringify({ provider, argv: process.argv.slice(2), cwd: process.cwd() })}\n`);
if (promptLog) fs.appendFileSync(promptLog, `${JSON.stringify({ provider, prompt: fs.readFileSync(0, 'utf8') })}\n`);
if (Number.isSafeInteger(delayMs) && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
if (hang) await new Promise(() => { setInterval(() => {}, 1000); });
const review = {
  decision,
  confidence,
  failedChecks: decision === 'approve' || (decision === 'revise' && bareRevise) ? [] : ['Fixture primary is not ready.'],
  securityFindings: intake ? [{ id: 'SEC-INTAKE', severity: 'medium', summary: 'Fix during implementation.' }] : [],
  materialDissent: intake ? ['Carry the alternative into implementation acceptance tests.'] : [],
  recommendation: 'Exercise the staged review protocol.',
  strongestObjection: 'This fixture does not use a real provider.',
  unresolvedQuestions: intake ? ['Resolve the implementation detail during block refinement.'] : []
};
if (provider === 'codex') {
  const index = process.argv.indexOf('--output-last-message');
  if (index === -1 || !process.argv[index + 1]) process.exit(3);
  fs.writeFileSync(process.argv[index + 1], malformed ? 'not-json' : JSON.stringify(review));
  process.stdout.write('codex staged fixture complete\n');
} else {
  process.stdout.write(malformed ? 'not-json\n' : `${JSON.stringify({ structured_output: review })}\n`);
}
