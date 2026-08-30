import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { prepareQualificationWindow } from '../.kstack/qualifications/prepare-kcrp-provider-trial-window.mjs';
import { executePreparedQualificationWindow } from '../.kstack/qualifications/run-kcrp-provider-trial-window.mjs';

const response = JSON.stringify({
  decision: 'APPROVE', confidence: 96, requiredFindings: [], decisions: ['retain'],
  deterministicChecks: ['bound'], securityFindings: [], unresolvedQuestions: []
});

test('wrong authorization dispatches zero providers and exact authorization produces sixty process receipts', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-kcrp-run-'));
  const outDir = path.join(parent, 'window');
  try {
    const prepared = prepareQualificationWindow({
      lane: 'domain', windowId: 'window-1', windowDate: '2026-08-30',
      providerId: 'codex', modelId: 'gpt-5.6-sol', reasoningLevel: 'high', outDir
    });
    let calls = 0;
    const invoke = async () => {
      calls += 1;
      return {
        status: 'complete', startedAt: '2026-08-30T05:00:00.000Z', durationMs: 100,
        stdout: '', stderr: '', response,
        usage: { inputTokens: 1000, rawInputTokens: 900, cachedInputTokens: 100, outputTokens: 50 }
      };
    };
    await assert.rejects(
      executePreparedQualificationWindow({
        planFile: path.join(outDir, 'plan.json'), authorizationDigest: '0'.repeat(64), invoke
      }),
      /KSTACK_KCRP_PROVIDER_TRIAL_AUTHORIZATION_REQUIRED/u
    );
    assert.equal(calls, 0);
    assert.equal(fs.existsSync(path.join(outDir, 'results')), false);
    const result = await executePreparedQualificationWindow({
      planFile: path.join(outDir, 'plan.json'), authorizationDigest: prepared.authorizationDigest, invoke
    });
    assert.equal(result.invocations, 60);
    assert.equal(calls, 60);
    const receipt = JSON.parse(fs.readFileSync(path.join(outDir, 'results/process-receipt.json'), 'utf8'));
    assert.equal(receipt.invocations.length, 60);
    assert.equal(receipt.planDigest, prepared.planDigest);
    assert.match(receipt.processReceiptDigest, /^[a-f0-9]{64}$/u);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
