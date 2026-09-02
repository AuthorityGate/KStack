#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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
const forbiddenEnv = process.argv
  .filter((value) => value.startsWith('--fixture-forbidden-env='))
  .map((value) => value.slice('--fixture-forbidden-env='.length));
const outDirLog = option('fixture-outdir-log');
const argvLog = option('fixture-argv-log');
const promptLog = option('fixture-prompt-log');
const delayMs = Number(option('fixture-delay-ms', '0'));
const hang = option('fixture-hang', 'false') === 'true';
const intake = option('fixture-intake', 'false') === 'true';
const bareRevise = option('fixture-bare-revise', 'false') === 'true';
if (provider === 'opus') {
  const mcpConfigIndex = process.argv.indexOf('--mcp-config');
  let mcpConfig;
  try {
    mcpConfig = mcpConfigIndex === -1 ? undefined : JSON.parse(process.argv[mcpConfigIndex + 1]);
  } catch { /* handled by the schema check below */ }
  const mcpServers = mcpConfig?.mcpServers;
  if (!mcpServers || typeof mcpServers !== 'object' || Array.isArray(mcpServers)) {
    process.stderr.write('Error: Invalid MCP configuration:\nmcpServers: Invalid input: expected record, received undefined\n');
    process.exit(9);
  }
}
if (logFile) fs.appendFileSync(logFile, `${provider}\n`);
if (forbiddenFiles.some((file) => fs.existsSync(file))) process.exit(7);
if (forbiddenEnv.some((name) => process.env[name] !== undefined)) process.exit(8);
if (outDirLog) fs.appendFileSync(outDirLog, `${JSON.stringify({ provider, entries: fs.readdirSync(path.resolve(process.cwd(), '..')).sort() })}\n`);
// Adversarial sweep: a reviewer actively hunting for the other reviewer's traces. The primary's
// working directory carries a random name, so this discovers it by listing the review directory
// rather than being handed a path, then attempts an actual read of every artifact inside it and
// of the sibling per-role files. Exits 11 if any read succeeds. This demonstrates absence at the
// moment this process runs; denial of reads to a real provider rests on PROVIDER_NO_WRITE_FLAGS,
// which a Node fixture cannot exercise.
if (option('fixture-probe-peer-work', 'false') === 'true') {
  const reviewDir = path.resolve(process.cwd(), '..');
  const own = path.basename(process.cwd());
  const observed = [];
  let entries = [];
  try { entries = fs.readdirSync(reviewDir); } catch { entries = []; }
  for (const entry of entries) {
    if (!entry.startsWith('.provider-work-') || entry === own) continue;
    for (const artifact of ['stdout', 'stderr', 'prompt', 'last-message', 'schema.json']) {
      try { fs.readFileSync(path.join(reviewDir, entry, artifact)); observed.push(`${entry}/${artifact}`); } catch { /* absent or unreadable */ }
    }
  }
  for (const role of ['codex', 'opus']) {
    for (const artifact of [`${role}.json`, `${role}.md`, `${role}.stderr.log`]) {
      try { fs.readFileSync(path.join(reviewDir, artifact)); observed.push(artifact); } catch { /* absent or unreadable */ }
    }
  }
  const peerLog = option('fixture-peer-log');
  if (peerLog) fs.appendFileSync(peerLog, `${JSON.stringify({ provider, observed })}\n`);
  if (observed.length > 0) process.exit(11);
}
const disclosureLog = option('fixture-disclosure-log');
if (disclosureLog) {
  const openFiles = [];
  for (const entry of fs.readdirSync('/proc/self/fd')) {
    let target;
    try { target = fs.readlinkSync(`/proc/self/fd/${entry}`); } catch { continue; }
    if (target.startsWith('/') && !/^\/(?:proc|dev|sys)\//u.test(target)) openFiles.push(path.basename(target));
  }
  const home = process.env.HOME ?? null;
  fs.appendFileSync(disclosureLog, `${JSON.stringify({
    provider,
    argv: process.argv.join('\0'),
    env: Object.entries(process.env).map(([key, value]) => `${key}=${value}`).join('\0'),
    tmpdir: process.env.TMPDIR ?? null,
    home,
    homeEntries: home && fs.existsSync(home) ? fs.readdirSync(home).sort() : null,
    cwd: process.cwd(),
    openFiles: openFiles.sort()
  })}\n`);
}
if (argvLog) fs.appendFileSync(argvLog, `${JSON.stringify({ provider, argv: process.argv.slice(2), cwd: process.cwd() })}\n`);
if (promptLog) fs.appendFileSync(promptLog, `${JSON.stringify({ provider, prompt: fs.readFileSync(0, 'utf8') })}\n`);
if (Number.isSafeInteger(delayMs) && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
if (hang) await new Promise(() => { setInterval(() => {}, 1000); });
const review = {
  decision,
  confidence,
  failedChecks: decision === 'approve' || (decision === 'revise' && bareRevise) ? [] : ['Fixture primary is not ready.'],
  securityFindings: intake ? [{ id: 'SEC-INTAKE', severity: option('fixture-intake-severity', 'medium'), summary: 'Fix during implementation.' }] : [],
  materialDissent: intake ? ['Carry the alternative into implementation acceptance tests.'] : [],
  recommendation: 'Exercise the staged review protocol.',
  strongestObjection: option('fixture-objection', 'This fixture does not use a real provider.'),
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
