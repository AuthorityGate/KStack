import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../plugins/kstack/scripts/kstack-config.mjs';
import { runRoleInvocation } from '../plugins/kstack/scripts/kstack-invoke-role.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('single-role runner invokes configured Fable with the caller prompt', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-fable-'));
  fs.mkdirSync(path.join(project, '.kstack'));
  const config = structuredClone(defaultConfig);
  config.project.name = 'fixture';
  config.workflow.phaseModels.qc = ['fable'];
  config.models.fable.command = process.execPath;
  config.models.fable.args = [path.join(root, 'tests', 'fixtures', 'fake-fable.mjs')];
  config.models.fable.timeoutSeconds = 5;
  fs.writeFileSync(path.join(project, '.kstack', 'config.json'), JSON.stringify(config, null, 2));
  const promptFile = path.join(project, 'fable-brief.md');
  const outDir = path.join(project, '.kstack', 'qc', 'fable-round-3');
  fs.writeFileSync(promptFile, 'Resolve both failed remediation rounds.');

  const manifest = await runRoleInvocation({ role: 'fable', projectRoot: project, promptFile, outDir });

  assert.equal(manifest.status, 'complete');
  assert.equal(manifest.role, 'fable');
  assert.equal(manifest.directiveFile, path.join(outDir, 'fable.md'));
  assert.equal(
    fs.readFileSync(manifest.directiveFile, 'utf8'),
    'Fable directive for fable: Resolve both failed remediation rounds.\n'
  );
});
