#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeInvocationArgs, readCapped, runProcess } from './kstack-provider-runner.mjs';
import { groundingReviewResponseSchema } from './kstack-review-schema.mjs';
import {
  checkCitationPlatformV1, runCitationMaintenanceV1, runCitationShadowV1, runCitationSmokeV1
} from './kstack-citation-runtime.mjs';
import { runDualReview } from './kstack-dual-review.mjs';

function parseArgs(argv) {
  const result = { _: [] };
  const switches = new Set([
    'regenerate', 'check-citation-grounding-platform', 'smoke-citation-grounding',
    'shadow-citation-grounding', 'sweep-citation-grounding-staging',
    'reset-citation-grounding-state', 'reset-citation-native-build',
    'reset-citation-grounding-lock-tombstones', 'repair-citation-grounding-instance-store',
    'repair-citation-grounding-state-protection'
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) result._.push(argv[index]);
    else {
      const key = argv[index].slice(2);
      if (switches.has(key)) result[key] = true;
      else result[key] = argv[++index];
    }
  }
  return result;
}

function load(projectRoot) {
  const configFile = path.join(projectRoot, '.kstack', 'config.json');
  const configBytes = fs.readFileSync(configFile);
  return { config: JSON.parse(configBytes), configBytes };
}

function smokeSchema() {
  return { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', minItems: 50, maxItems: 50, items: { type: 'object', additionalProperties: false, required: ['id', 'excerpt'], properties: { id: { type: 'string' }, excerpt: { type: 'string' } } } } } };
}

async function smokeProviders(projectRoot, config, fixtureBytes, attemptOrdinal) {
  const fixture = JSON.parse(fixtureBytes);
  const directory = path.join(projectRoot, '.kstack', 'state', `citation-smoke-work-${process.pid}`);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const results = [];
  try {
    for (const providerId of ['codex', 'opus']) {
      const targets = fixture.providers[providerId];
      const prompt = `KStack citation exact-reproduction smoke attempt ${attemptOrdinal}. Return only the required JSON. Reproduce each expected excerpt exactly.\n${JSON.stringify(targets)}`;
      const input = path.join(directory, `${providerId}.stdin`);
      const stdout = path.join(directory, `${providerId}.stdout`);
      const stderr = path.join(directory, `${providerId}.stderr`);
      const schema = path.join(directory, `${providerId}.schema`);
      const last = path.join(directory, `${providerId}.last`);
      fs.writeFileSync(input, prompt, { mode: 0o600 });
      fs.writeFileSync(schema, JSON.stringify(smokeSchema()), { mode: 0o600 });
      const model = config.models[providerId];
      const args = providerId === 'codex'
        ? [...model.args, 'exec', '--ephemeral', '--ignore-user-config', '--sandbox', 'read-only', '--skip-git-repo-check', '-C', projectRoot, '--output-schema', schema, '--output-last-message', last]
        : claudeInvocationArgs(model, { defaultModel: 'opus', jsonSchema: smokeSchema() });
      const run = await runProcess(model.command, args, { cwd: projectRoot, stdinFile: input, stdoutFile: stdout, stderrFile: stderr, timeoutMs: model.timeoutSeconds * 1000 });
      const raw = providerId === 'codex' && fs.existsSync(last) ? readCapped(last) : run.stdout;
      let parsed;
      try { parsed = JSON.parse(raw); if (parsed.structured_output) parsed = parsed.structured_output; } catch {}
      const expected = new Map(targets.map((item) => [item.id, item.excerpt]));
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      const ids = new Set(items.map((item) => item?.id));
      const structurallyComplete = run.status === 'complete' && items.length === 50 && ids.size === 50 && items.every((item) => item && Object.keys(item).sort().join() === 'excerpt,id' && expected.has(item.id) && typeof item.excerpt === 'string');
      const exactMatchCount = structurallyComplete ? items.filter((item) => expected.get(item.id) === item.excerpt).length : 0;
      const ordinary = new Set(targets.filter((item) => item.category === 'ordinary_prose').map((item) => item.id));
      const ordinaryProseMismatchCount = structurallyComplete ? items.filter((item) => ordinary.has(item.id) && expected.get(item.id) !== item.excerpt).length : 30;
      results.push({ rawBytes: raw ? Buffer.from(raw) : null, structurallyComplete, exactMatchCount, ordinaryProseMismatchCount });
    }
    return results;
  } finally {
    for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name));
    fs.rmdirSync(directory);
  }
}

async function main(argv) {
  const args = parseArgs(argv);
  const aliases = [
    ['check-citation-grounding-platform', 'check-platform'], ['smoke-citation-grounding', 'smoke'],
    ['shadow-citation-grounding', 'shadow'], ['sweep-citation-grounding-staging', 'sweep-staging'],
    ['reset-citation-grounding-state', 'reset-state'], ['reset-citation-native-build', 'reset-native-build'],
    ['reset-citation-grounding-lock-tombstones', 'reset-coordinator-lock-tombstones'],
    ['repair-citation-grounding-instance-store', 'repair-instance-store'],
    ['repair-citation-grounding-state-protection', 'repair-state-protection']
  ];
  const command = args._[0] ?? aliases.find(([flag]) => args[flag])?.[1];
  const projectRoot = path.resolve(args['project-root'] ?? process.cwd());
  const { config, configBytes } = load(projectRoot);
  const common = { projectRoot, config, configBytes };
  let result;
  if (command === 'check-platform') result = await checkCitationPlatformV1(common);
  else if (command === 'smoke') {
    const fixtureFile = path.resolve(args.fixture ?? path.join(projectRoot, '.kstack', 'fixtures', 'citation-grounding', 'exact-reproduction-v1.json'));
    const fixtureBytes = fs.readFileSync(fixtureFile);
    result = await runCitationSmokeV1({ ...common, fixtureBytes, runProviders: ({ attemptOrdinal }) => smokeProviders(projectRoot, config, fixtureBytes, attemptOrdinal) });
  } else if (command === 'shadow') {
    const promptFile = path.resolve(args.prompt);
    result = await runCitationShadowV1({ ...common, dualRuns: Number(args.runs), judgment: args.judgment, reasonCodes: args.reasons ? args.reasons.split(',').filter(Boolean) : [], runRepresentative: async ({ index }) => {
      const base = path.join(projectRoot, '.kstack', 'state', `citation-shadow-${process.pid}-${index}`);
      const legacy = await runDualReview({ projectRoot, promptFile, outDir: `${base}-legacy`, citationQualification: { effective: false, route: 'legacy_direct' } });
      const advisory = await runDualReview({ projectRoot, promptFile, outDir: `${base}-advisory`, citationQualification: { effective: true, route: 'grounding_v2' } });
      if (!['dual-complete', 'single-model-fallback'].includes(legacy.status) || !['dual-complete', 'single-model-fallback'].includes(advisory.status)) throw new Error('shadow provider run failed');
      for (const directory of [`${base}-legacy`, `${base}-advisory`]) fs.rmSync(directory, { recursive: true });
    } });
  } else {
    const mapping = {
      'reset-state': 'reset-state', 'reset-native-build': 'reset-native-build',
      'reset-coordinator-lock-tombstones': 'reset-coordinator-lock-tombstones',
      'sweep-staging': 'sweep-staging', 'repair-instance-store': 'repair-instance-store',
      'repair-state-protection': 'repair-state-protection'
    };
    if (!mapping[command]) throw new Error('Usage: kstack-citation-admin <check-platform|smoke|shadow|reset-state|reset-native-build|reset-coordinator-lock-tombstones|sweep-staging|repair-instance-store|repair-state-protection>');
    result = await runCitationMaintenanceV1(mapping[command], { ...common, regenerate: args.regenerate === true });
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.code ?? error.reason ?? 'CITATION_GROUNDING_COMMAND_FAILED'}${error.detail ? ` ${error.detail}` : ''}\n`);
    process.exitCode = 2;
  });
}
