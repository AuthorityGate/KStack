import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../plugins/kstack/scripts/kstack-config.mjs';
import { runDualReview } from '../plugins/kstack/scripts/kstack-dual-review.mjs';
import { buildDecisionPacket, verifyDecisionPacket } from '../plugins/kstack/scripts/kstack-citation-grounding.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('dual runner preserves independent successful reports', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-dual-'));
  fs.mkdirSync(path.join(project, '.kstack'));
  const config = structuredClone(defaultConfig);
  config.project.name = 'fixture';
  config.models.codex.command = process.execPath;
  config.models.codex.args = [path.join(root, 'tests', 'fixtures', 'fake-codex.mjs')];
  config.models.opus.command = process.execPath;
  config.models.opus.args = [path.join(root, 'tests', 'fixtures', 'fake-claude.mjs')];
  config.models.codex.timeoutSeconds = 5;
  config.models.opus.timeoutSeconds = 5;
  fs.writeFileSync(path.join(project, '.kstack', 'config.json'), JSON.stringify(config, null, 2));
  const promptFile = path.join(project, 'decision.md');
  const outDir = path.join(project, '.kstack', 'reviews', 'fixture');
  fs.writeFileSync(promptFile, 'Choose a stable interface.');

  const manifest = await runDualReview({ projectRoot: project, promptFile, outDir });

  assert.equal(manifest.status, 'dual-complete');
  assert.equal(manifest.designDigest.length, 64);
  const codex = JSON.parse(fs.readFileSync(path.join(outDir, 'codex.json'), 'utf8'));
  const opus = JSON.parse(fs.readFileSync(path.join(outDir, 'opus.json'), 'utf8'));
  assert.equal(codex.reviewer, 'codex');
  assert.equal(opus.reviewer, 'opus');
  assert.equal(codex.review.confidence, 97);
  assert.equal(opus.review.confidence, 96);
});

test('advisory dual runner supplies and binds one canonical packet to both v2 envelopes', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-dual-grounding-'));
  fs.mkdirSync(path.join(project, '.kstack'));
  const config = structuredClone(defaultConfig);
  config.project.name = 'fixture';
  config.workflow.designGate.citationGrounding = 'advisory';
  config.models.codex.command = process.execPath;
  config.models.codex.args = [path.join(root, 'tests', 'fixtures', 'fake-codex.mjs')];
  config.models.opus.command = process.execPath;
  config.models.opus.args = [path.join(root, 'tests', 'fixtures', 'fake-claude.mjs')];
  config.models.codex.timeoutSeconds = 5;
  config.models.opus.timeoutSeconds = 5;
  fs.writeFileSync(path.join(project, '.kstack', 'config.json'), JSON.stringify(config));
  const promptFile = path.join(project, 'decision.md');
  const outDir = path.join(project, '.kstack', 'reviews', 'fixture');
  fs.writeFileSync(promptFile, 'A uniquely citable design line.\r\n');

  const manifest = await runDualReview({
    projectRoot: project, promptFile, outDir,
    citationQualification: { effective: true, route: 'grounding_v2' }
  });
  assert.equal(manifest.status, 'dual-complete');
  assert.equal(manifest.citationGroundingMode, 'advisory');
  assert.equal(fs.existsSync(path.join(outDir, 'decision-packet-v1.bin')), false, 'the packet is not a durable review artifact');
  const packet = buildDecisionPacket([{
    sourceId: 'SRC-DESIGN', label: 'design under review', role: 'design-under-review', inclusion: 'full', content: fs.readFileSync(promptFile)
  }]);
  const packetBinding = Object.fromEntries(Object.entries(manifest.packet).filter(([key]) => !['frameCounter', 'frameToken'].includes(key)));
  const verified = verifyDecisionPacket(packet.packetBytes, packetBinding);
  assert.equal(verified.sources[0].content.toString(), 'A uniquely citable design line.\n');
  for (const reviewer of ['codex', 'opus']) {
    const envelope = JSON.parse(fs.readFileSync(path.join(outDir, `${reviewer}.json`)));
    assert.equal(envelope.schemaVersion, 2);
    assert.equal(envelope.packetSha256, manifest.packet.packetSha256);
    assert.equal(envelope.packetSerializationVersion, manifest.packet.packetSerializationVersion);
  }
});

test('advisory provider ownership performs one-shot per-provider legacy recovery', async () => {
  const recoveryMode = 'malformed';
  const project = fs.mkdtempSync(path.join(os.tmpdir(), `kstack-dual-${recoveryMode}-`));
  fs.mkdirSync(path.join(project, '.kstack'));
  const config = structuredClone(defaultConfig);
  config.project.name = 'recovery-fixture';
  config.workflow.designGate.citationGrounding = 'advisory';
  for (const provider of ['codex', 'opus']) {
    config.models[provider].command = process.execPath;
    config.models[provider].args = [path.join(root, 'tests', 'fixtures', `fake-grounding-recovery-${provider}.mjs`), `--recovery-mode=${recoveryMode}`];
    config.models[provider].timeoutSeconds = 5;
  }
  fs.writeFileSync(path.join(project, '.kstack', 'config.json'), JSON.stringify(config), { mode: 0o600 });
  const promptFile = path.join(project, 'decision.md');
  fs.writeFileSync(promptFile, 'Exercise provider response ownership.');
  const manifest = await runDualReview({ projectRoot: project, promptFile, outDir: path.join(project, 'review'), citationQualification: { effective: true, route: 'grounding_v2' } });
  assert.equal(manifest.status, 'dual-complete');
  for (const provider of ['codex', 'opus']) {
    assert.equal(manifest.providers[provider].route, 'legacy_recovery');
    assert.equal(JSON.parse(fs.readFileSync(path.join(project, 'review', `${provider}.json`))).schemaVersion, 1);
  }
});
