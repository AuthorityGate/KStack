import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { defaultConfig } from '../plugins/kstack/scripts/kstack-config.mjs';
import { runMemoryCommand, scanTextForSecrets } from '../plugins/kstack/scripts/kstack-memory.mjs';

function memoryFixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-memory-'));
  const project = path.join(parent, 'project');
  fs.mkdirSync(path.join(project, '.kstack'), { recursive: true });
  const config = structuredClone(defaultConfig);
  config.project.name = 'memory-fixture';
  config.memory.enabled = true;
  config.memory.bodyDirectory = path.join(parent, 'body');
  config.memory.indexDirectory = path.join(parent, 'index');
  config.memory.namespace = 'memory-fixture';
  const configFile = path.join(project, '.kstack', 'config.json');
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  return { parent, project, configFile };
}

test('secret scanner rejects representative credentials without echoing values', () => {
  assert.deepEqual(scanTextForSecrets('normal architecture decision'), []);
  assert.ok(scanTextForSecrets('api_key=abcdefghijklmnopqrstuvwxyz123456').length > 0);
});

test('PGLite memory ingests, searches, reports status, and rebuilds', async () => {
  const fixture = memoryFixture();
  const source = path.join(fixture.project, 'accepted-design.md');
  fs.writeFileSync(source, '# Decision\n\nUse an explicit portable memory body for architecture evidence.\n');
  await runMemoryCommand({ command: 'init', config: fixture.configFile, approved: new Set() });
  const ingested = await runMemoryCommand({ command: 'ingest', config: fixture.configFile, source, kind: 'decision', title: 'Portable memory', approved: new Set() });
  assert.equal(ingested.status, 'ingested');
  const found = await runMemoryCommand({ command: 'search', config: fixture.configFile, query: 'portable memory', approved: new Set() });
  assert.equal(found.trust, 'UNTRUSTED_RETRIEVED_DATA');
  assert.equal(found.automaticContextInjection, false);
  assert.equal(found.results.length, 1);
  const current = await runMemoryCommand({ command: 'status', config: fixture.configFile, approved: new Set() });
  assert.equal(current.status, 'current');
  const rebuilt = await runMemoryCommand({ command: 'rebuild', config: fixture.configFile, approved: new Set() });
  assert.equal(rebuilt.artifactCount, 1);
});

test('enabled memory with zero artifacts reports incomplete readiness', async () => {
  const fixture = memoryFixture();
  await runMemoryCommand({ command: 'init', config: fixture.configFile, approved: new Set() });
  const empty = await runMemoryCommand({ command: 'status', config: fixture.configFile, approved: new Set() });
  assert.equal(empty.status, 'empty');
  assert.equal(empty.bodyArtifacts, 0);
  assert.equal(empty.indexedArtifacts, 0);
  assert.match(empty.actionRequired, /Ingest at least one accepted/);
});

test('JSON artifact content is not misclassified as artifact metadata', async () => {
  const fixture = memoryFixture();
  const source = path.join(fixture.project, 'accepted-decision.json');
  fs.writeFileSync(source, JSON.stringify({ decision: 'bound review rounds' }));
  await runMemoryCommand({ command: 'init', config: fixture.configFile, approved: new Set() });
  await runMemoryCommand({ command: 'ingest', config: fixture.configFile, source, kind: 'decision', title: 'Review budget', approved: new Set() });
  const rebuilt = await runMemoryCommand({ command: 'rebuild', config: fixture.configFile, approved: new Set() });
  assert.equal(rebuilt.artifactCount, 1);
  const current = await runMemoryCommand({ command: 'status', config: fixture.configFile, approved: new Set() });
  assert.equal(current.status, 'current');
  assert.equal(current.bodyArtifacts, 1);
});
