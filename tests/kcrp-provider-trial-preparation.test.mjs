import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildQualificationCorpus,
  prepareQualificationWindow
} from '../.kstack/qualifications/prepare-kcrp-provider-trial-window.mjs';

test('Host and Domain qualification corpora bind the current replay frames', () => {
  for (const lane of ['host', 'domain']) {
    const prepared = buildQualificationCorpus(lane);
    assert.equal(prepared.corpus.record.tasks.length, 30);
    assert.equal(prepared.corpus.record.snapshotDigest, prepared.snapshotDigest);
    for (const arm of ['A', 'B3']) {
      assert.equal(
        crypto.createHash('sha256').update(prepared.replay.trialArms[arm].reviewInput).digest('hex'),
        prepared.corpus.record.arms[arm].reviewInputDigest
      );
    }
  }
});

test('window preparation writes sixty exact payloads and never invokes a provider', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-kcrp-plan-'));
  const outDir = path.join(parent, 'window');
  try {
    const result = prepareQualificationWindow({
      lane: 'host', windowId: 'window-1', windowDate: '2026-08-30',
      providerId: 'codex', modelId: 'gpt-5.6-sol', reasoningLevel: 'high', outDir
    });
    assert.equal(result.invocations, 60);
    assert.equal(fs.readdirSync(path.join(outDir, 'payloads')).length, 60);
    const receipt = JSON.parse(fs.readFileSync(path.join(outDir, 'plan.json'), 'utf8'));
    assert.equal(receipt.authorizationDigest, result.authorizationDigest);
    assert.equal(receipt.payloadFiles.length, 60);
    for (const row of receipt.payloadFiles) {
      const payload = fs.readFileSync(path.join(outDir, row.relativePath));
      assert.equal(payload.length, row.payloadBytes);
      assert.equal(crypto.createHash('sha256').update(payload).digest('hex'), row.payloadDigest);
    }
    assert.throws(() => prepareQualificationWindow({
      lane: 'host', windowId: 'window-1', windowDate: '2026-08-30',
      providerId: 'codex', modelId: 'gpt-5.6-sol', reasoningLevel: 'high', outDir
    }), /EEXIST/u);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
