import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  validateDeliveryBacklog,
  validateTenThousandFootDesign
} from '../plugins/kstack/scripts/kstack-workflow-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureFile = path.join(root, 'tests', 'fixtures', 'valid-10k-design.md');
const designBytes = fs.readFileSync(fixtureFile);
const digest = crypto.createHash('sha256').update(designBytes).digest('hex');

function backlog() {
  return {
    schemaVersion: 1,
    designDigest: digest,
    status: 'ready',
    blocks: [
      {
        designBlockId: 'BLK-FOUNDATION', itemId: 'foundation', jiraKey: 'KSTK-101',
        summary: 'Establish the shared contract', dependsOn: [],
        acceptanceCriteria: ['Both hosts reject a malformed design.'],
        validationEvidence: ['Host-parity contract test.'], state: 'ready'
      },
      {
        designBlockId: 'BLK-ADMISSION', itemId: 'admission', jiraKey: 'KSTK-102',
        summary: 'Admit the reviewed transition', dependsOn: ['BLK-FOUNDATION'],
        acceptanceCriteria: ['Only exact review evidence reaches approval.'],
        validationEvidence: ['Design-gate test.'], state: 'ready'
      }
    ]
  };
}

test('10,000-foot design contract accepts a bounded architecture and dependency DAG', () => {
  const result = validateTenThousandFootDesign(designBytes);
  assert.equal(result.status, 'valid');
  assert.deepEqual(result.blocks.map(({ id, dependsOn }) => ({ id, dependsOn })), [
    { id: 'BLK-FOUNDATION', dependsOn: [] },
    { id: 'BLK-ADMISSION', dependsOn: ['BLK-FOUNDATION'] }
  ]);
});

test('design contract rejects premature implementation detail before model dispatch', () => {
  const invalid = Buffer.from(designBytes.toString('utf8').replace(
    'Exact files, commands, test invocations, release packaging, and deployment steps are deferred.',
    '```bash\nnpm run deploy\n```'
  ));
  const result = validateTenThousandFootDesign(invalid);
  assert.equal(result.status, 'invalid');
  assert.ok(result.errors.some((item) => item.code === 'DESIGN_PREMATURE_CODE_DETAIL'));
});

test('complete Jira-backed backlog is bound to every approved design block', () => {
  const result = validateDeliveryBacklog({ designBytes, backlog: backlog(), jiraRequired: true });
  assert.equal(result.status, 'valid');
  assert.equal(result.blockCount, 2);
  assert.equal(result.activeBlockCount, 0);
});

test('backlog gate rejects missing Jira mappings, missing blocks, and multiple active work', () => {
  const invalid = backlog();
  invalid.status = 'in-progress';
  invalid.blocks[0].jiraKey = null;
  invalid.blocks[0].state = 'active';
  invalid.blocks[1].state = 'active';
  invalid.blocks.pop();
  const result = validateDeliveryBacklog({ designBytes, backlog: invalid, jiraRequired: true });
  assert.equal(result.status, 'invalid');
  assert.ok(result.errors.some((item) => item.code === 'BACKLOG_JIRA_MAPPING_MISSING'));
  assert.ok(result.errors.some((item) => item.code === 'BACKLOG_BLOCK_MISSING'));
});

test('at most one Jira delivery block can be active during implementation', () => {
  const invalid = backlog();
  invalid.status = 'in-progress';
  invalid.blocks[0].state = 'active';
  invalid.blocks[1].state = 'active';
  const result = validateDeliveryBacklog({ designBytes, backlog: invalid, jiraRequired: true });
  assert.equal(result.status, 'invalid');
  assert.ok(result.errors.some((item) => item.code === 'BACKLOG_MULTIPLE_ACTIVE'));
});

test('an active block requires completed dependencies and complete means every block is done', () => {
  const inProgress = backlog();
  inProgress.status = 'in-progress';
  inProgress.blocks[1].state = 'active';
  let result = validateDeliveryBacklog({ designBytes, backlog: inProgress, jiraRequired: true });
  assert.ok(result.errors.some((item) => item.code === 'BACKLOG_ACTIVE_DEPENDENCY_UNMET'));

  inProgress.blocks[0].state = 'done';
  result = validateDeliveryBacklog({ designBytes, backlog: inProgress, jiraRequired: true });
  assert.equal(result.status, 'valid');

  inProgress.status = 'complete';
  inProgress.blocks[1].state = 'ready';
  result = validateDeliveryBacklog({ designBytes, backlog: inProgress, jiraRequired: true });
  assert.ok(result.errors.some((item) => item.code === 'BACKLOG_COMPLETE_STATE_INVALID'));
});
