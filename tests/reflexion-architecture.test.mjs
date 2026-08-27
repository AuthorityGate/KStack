import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { capabilityTokenInventory, capabilityUseSiteDigest, classifyParseGoal, parseArchitectureJson, staticSpecifiers, validateParseGoal, validateProductionArchitecture, walkInactivePackageMap } from './reflexion-architecture-gate.mjs';
import { runBoundedResolverBatch } from '../plugins/kstack/scripts/reflexion-architecture/resolver-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptsRoot = path.join(root, 'plugins', 'kstack', 'scripts');
const command = path.join(scriptsRoot, 'kstack-reflexion.mjs');
const pinned = new Map([
  [path.join(scriptsRoot, 'reflexion', 'retrieval-core.mjs'), new Set([command])],
  [path.join(scriptsRoot, 'reflexion', 'corpus-io.mjs'), new Set([command])],
  [path.join(scriptsRoot, 'reflexion', 'corpus-boundary.mjs'), new Set([path.join(scriptsRoot, 'reflexion', 'corpus-io.mjs')])],
  [path.join(scriptsRoot, 'reflexion', 'unavailable-sentinel.mjs'), new Set([command])],
  [path.join(scriptsRoot, 'reflexion', 'prompt-assembler.mjs'), new Set([command])],
  [path.join(scriptsRoot, 'reflexion-architecture', 'resolver-client.mjs'), new Set([command])],
  [path.join(scriptsRoot, 'reflexion', 'termination-contract.mjs'), new Set([
    path.join(scriptsRoot, 'reflexion', 'termination-schema.mjs'),
    path.join(scriptsRoot, 'reflexion', 'termination-supervisor.mjs')
  ])],
  [path.join(scriptsRoot, 'reflexion', 'termination-schema.mjs'), new Set([
    path.join(scriptsRoot, 'reflexion', 'termination-supervisor.mjs')
  ])],
  [path.join(scriptsRoot, 'reflexion', 'termination-supervisor.mjs'), new Set()],
  [path.join(scriptsRoot, 'reflexion-architecture', 'resolver-driver.mjs'), new Set()]
]);

function productionFiles(directory = scriptsRoot, seen = new Set()) {
  const real = fs.realpathSync.native(directory);
  assert.equal(seen.has(real), false, `production directory cycle: ${directory}`);
  seen.add(real);
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    assert.equal(entry.isSymbolicLink(), false, `production symlink: ${target}`);
    if (entry.isDirectory()) files.push(...productionFiles(target, seen));
    else {
      assert.equal(entry.isFile(), true, `unsupported production entry: ${target}`);
      assert.ok(['.mjs', '.js', '.cjs'].includes(path.extname(entry.name)), `unsupported production suffix: ${target}`);
      files.push(fs.realpathSync.native(target));
    }
  }
  return files;
}

test('Reflexion pinned production modules have closed static importer sets', () => {
  const files = productionFiles();
  for (const target of pinned.keys()) assert.ok(files.includes(fs.realpathSync.native(target)), `missing pinned target ${target}`);
  const observed = new Map([...pinned.keys()].map((target) => [fs.realpathSync.native(target), new Set()]));
  for (const importer of files) {
    const source = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(importer));
    assert.doesNotMatch(source, /\bimport\s*\(/u, `dynamic import in ${importer}`);
    assert.doesNotMatch(source, /\b(?:eval|Function)\s*\(/u, `dynamic execution in ${importer}`);
    for (const specifier of staticSpecifiers(source)) {
      if (!specifier.startsWith('.')) continue;
      const resolved = fs.realpathSync.native(path.resolve(path.dirname(importer), specifier));
      if (observed.has(resolved)) observed.get(resolved).add(importer);
    }
  }
  for (const [target, permitted] of pinned) {
    assert.deepEqual([...observed.get(fs.realpathSync.native(target))].sort(), [...permitted].map((value) => fs.realpathSync.native(value)).sort());
  }
});

test('command startup source pins fail-closed gate order and one main call site', () => {
  const source = fs.readFileSync(command, 'utf8');
  const entry = source.indexOf("KSTACK_REFLEXION_ENTRY_MISMATCH");
  const environment = source.indexOf("KSTACK_REFLEXION_ENVIRONMENT_DENIED");
  const platform = source.indexOf("KSTACK_REFLEXION_PLATFORM_UNSUPPORTED");
  const sentinel = source.indexOf('SENTINEL_BASENAME');
  const contract = source.indexOf('function admitRuntimeContract');
  assert.ok(entry >= 0 && environment > entry && platform > environment);
  assert.ok(sentinel >= 0 && contract >= 0);
  assert.equal((source.match(/effects\.main\(/gu) ?? []).length, 1);
  assert.match(source, /Object\.keys\(effects\)\.join\(','\) !== 'main,writeStderr,setExitCode'/u);
});

test('runtime artifacts are target-local ignored state and memory gate is a dedicated CI step', () => {
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(ignore, /reflexion-runtime-contract-v1\.txt/u);
  assert.match(ignore, /reflexion-runtime-unavailable-v1/u);
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.match(workflow, /node-version: 24\.12\.0/u);
  assert.match(workflow, /name: Run Reflexion memory gate\s+run: npm run test:memory-gate/u);
});

test('capability inventory is binding-aware and detects added imported or ambient uses', () => {
  const source = "import fs from 'node:fs';\nconst value = fs.readFileSync('x');\nprocess.stdout.write(value);\n";
  const baseline = capabilityTokenInventory(source);
  const mutated = capabilityTokenInventory(`${source}fs.writeFileSync('y', value);\n`);
  assert.equal(mutated.fs, baseline.fs + 1);
  assert.equal(mutated.process, baseline.process);
  assert.notEqual(capabilityUseSiteDigest(source), capabilityUseSiteDigest(`${source}fs.writeFileSync('y', value);\n`));
  assert.equal(capabilityTokenInventory(`${source}globalThis.fetch('https://invalid.example');\n`).globalThis, 1);
});

test('architecture JSON and parse-goal engine enforce duplicate-free metadata and Node wrapper semantics', () => {
  assert.throws(() => parseArchitectureJson(Buffer.from('{"type":"module","type":"commonjs"}')), /KSTACK_ARCHITECTURE_JSON_DUPLICATE_KEY/u);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-parse-goal-'));
  try {
    const untyped = path.join(fixture, 'untyped');
    const moduleScope = path.join(fixture, 'module');
    const commonScope = path.join(fixture, 'common');
    fs.mkdirSync(untyped); fs.mkdirSync(moduleScope); fs.mkdirSync(commonScope);
    fs.writeFileSync(path.join(moduleScope, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(commonScope, 'package.json'), '{"type":"commonjs"}');
    assert.equal(classifyParseGoal(path.join(untyped, 'plain.js'), 'const value = import("x");'), 'commonjs-wrapper');
    assert.equal(classifyParseGoal(path.join(untyped, 'esm.js'), 'export const value = 1;'), 'module');
    assert.equal(classifyParseGoal(path.join(moduleScope, 'typed.js'), 'const value = 1;'), 'module');
    assert.equal(classifyParseGoal(path.join(commonScope, 'typed.js'), 'return;'), 'commonjs-wrapper');
    assert.equal(classifyParseGoal(path.join(commonScope, 'override.mjs'), 'export {};'), 'module');
    assert.equal(classifyParseGoal(path.join(moduleScope, 'override.cjs'), 'return;'), 'commonjs-wrapper');
    assert.equal(validateParseGoal(path.join(commonScope, 'return.cjs'), 'return;'), 'commonjs-wrapper');
    assert.throws(() => validateParseGoal(path.join(commonScope, 'collision.cjs'), 'const require = 1;'), /KSTACK_ARCHITECTURE_SOURCE_SYNTAX/u);
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});

test('inactive package-map walker follows exact/pattern precedence and rejects ambiguous inactive branches', () => {
  assert.equal(walkInactivePackageMap('./main.mjs', '.').leaf, './main.mjs');
  assert.equal(walkInactivePackageMap({ node: './main.mjs', default: './main.mjs' }, '.').leaf, './main.mjs');
  assert.throws(() => walkInactivePackageMap({ '.': './main.mjs', default: './fallback.mjs' }, '.'), /KSTACK_ARCHITECTURE_PACKAGE_MAP/u);
  assert.equal(walkInactivePackageMap({ './feature/x': './exact.mjs', './feature/*': './wild/*.mjs' }, './feature/x').leaf, './exact.mjs');
  assert.equal(walkInactivePackageMap({ './feature/*': './outer/*.mjs', './feature/internal/*': './inner/*.mjs' }, './feature/internal/x').leaf, './inner/x.mjs');
  assert.throws(() => walkInactivePackageMap({ './x/*': './target/*.mjs' }, './x/'), /KSTACK_ARCHITECTURE_PACKAGE_MAP/u);
  assert.throws(() => walkInactivePackageMap({ './x/*.js': './target/*.mjs' }, './x/.js'), /KSTACK_ARCHITECTURE_PACKAGE_MAP/u);
  assert.throws(() => walkInactivePackageMap({ '.': ['./a.mjs', './b.mjs'] }, '.'), /KSTACK_ARCHITECTURE_PACKAGE_MAP_AMBIGUOUS/u);
  assert.throws(() => walkInactivePackageMap({ '.': { node: './a.mjs', default: 'dep' } }, '.', 'imports'), /KSTACK_ARCHITECTURE_PACKAGE_MAP_AMBIGUOUS/u);
  assert.equal(walkInactivePackageMap({ '.': { node: './a.mjs', default: './a.mjs' } }, '.').leaf, './a.mjs');
  assert.deepEqual(staticSpecifiers("import {\n  value as renamed\n} from './named.mjs';\nimport * as namespace from './namespace.mjs';\nexport { value as other } from './reexport.mjs';\nexport * from './star.mjs';\n"), ['./named.mjs', './namespace.mjs', './reexport.mjs', './star.mjs']);
});

test('inactive package-map one-leaf control equals the real resolver classification', async () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-inactive-map-resolver-'));
  try {
    const importer = path.join(fixture, 'importer.mjs');
    const target = path.join(fixture, 'target.mjs');
    const exportsMap = { '.': { node: { import: './target.mjs', default: './target.mjs' }, default: './target.mjs' } };
    fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ name: 'inactive-map-control', type: 'module', exports: exportsMap }));
    fs.writeFileSync(importer, 'export {};\n'); fs.writeFileSync(target, 'export {};\n');
    const walked = walkInactivePackageMap(exportsMap, '.');
    const driverPath = path.join(scriptsRoot, 'reflexion-architecture', 'resolver-driver.mjs');
    const resolved = await runBoundedResolverBatch({ driverPath, requests: [{ specifier: 'inactive-map-control', parentURL: pathToFileURL(importer).href }] });
    assert.equal(pathToFileURL(path.resolve(fixture, walked.leaf)).href, resolved.responses[0].url);
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});

test('runtime-faithful production architecture gate executes conformance and one graph batch', async () => {
  const result = await validateProductionArchitecture(root);
  assert.ok(result.fileCount >= 20);
  assert.ok(result.edgeCount >= result.fileCount);
  assert.equal(result.conformance.resolverProbeSha256, '3e2a3a2daf77c4c2b16d2919f86995f41188248b553f62c27e4f448b03d31f64');
  assert.equal(result.conformance.unicodeProbeSha256, 'ce0453507f8603f09be1d4b7581d47b8a39f040189e9bf43b193f2c88f4f3f23');
  assert.equal(result.conformance.unicodeRecord.scalarCount, 1_112_064);
  assert.equal(result.conformance.unicodeRecord.primaryCompositionPairCount, 12_133);
  assert.equal(result.conformance.unicodeRecord.conditionalContextCount, 2_224_128);
  assert.equal(result.conformance.unicodeRecord.uniqueScalarMaximumCount, 1);
  assert.equal(result.conformance.unicodeRecord.quoteCompositionSafe, true);
  assert.equal(result.conformance.unicodeRecord.tokenSplitBoundProved, true);
});

test('bounded resolver parent terminates timeout, output-cap, and stdin-transport fixtures', async () => {
  const makeDriver = (source) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-resolver-parent-'));
    const target = path.join(directory, 'resolver-driver.mjs');
    fs.writeFileSync(target, source);
    return target;
  };
  const bounds = { deadlineMs: 30, termGraceMs: 20, killGraceMs: 20 };
  await assert.rejects(runBoundedResolverBatch({ driverPath: makeDriver('setInterval(() => {}, 1000);\n'), requests: [], testBounds: bounds }), { code: 'KSTACK_REFLEXION_RESOLVER_DRIVER_TIMEOUT' });
  await assert.rejects(runBoundedResolverBatch({ driverPath: makeDriver('process.stdout.write(Buffer.alloc(16_777_217)); setInterval(() => {}, 1000);\n'), requests: [], testBounds: { deadlineMs: 2_000, termGraceMs: 20, killGraceMs: 20 } }), { code: 'KSTACK_REFLEXION_RESOLVER_DRIVER_OUTPUT_LIMIT' });
  const requests = Array.from({ length: 65_000 }, (_, index) => ({ specifier: `./xxxxxxxxxx-${index}.mjs`, parentURL: 'file:///tmp/importer.mjs' }));
  await assert.rejects(runBoundedResolverBatch({ driverPath: makeDriver("process.stdin.once('data', () => process.exit(64)); process.stdin.resume();\n"), requests, testBounds: { deadlineMs: 2_000, termGraceMs: 20, killGraceMs: 20 } }), { code: 'KSTACK_REFLEXION_RESOLVER_DRIVER_STDIN' });
});
