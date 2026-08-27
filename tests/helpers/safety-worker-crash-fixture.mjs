#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const marker = path.join(envelope.request.root, '.kstack-orphan-worker-marker');
spawn(process.execPath, ['-e', "setTimeout(() => require('node:fs').writeFileSync(process.argv[1], 'orphaned\\n'), 150)", marker], {
  env: { PATH: '/usr/bin:/bin' }, stdio: 'ignore', shell: false
});
process.kill(process.pid, 'SIGKILL');
