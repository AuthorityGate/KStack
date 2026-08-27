#!/usr/bin/env node
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const expectedKeys = ['KSTACK_SAFETY_WORKER', 'LANG', 'LC_ALL', 'PATH'];
const ambientKeys = ['GIT_ASKPASS', 'GIT_SSH_COMMAND', 'SSH_AUTH_SOCK', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_COUNT', 'GIT_CREDENTIAL_HELPER', 'HOME', 'XDG_CONFIG_HOME', 'KSTACK_TEST_AMBIENT_SECRET'];
const leakedKey = ambientKeys.find((key) => process.env[key] !== undefined);
if (leakedKey || Object.keys(process.env).sort().join('\0') !== expectedKeys.join('\0')) {
  process.stderr.write(`token=${leakedKey ? process.env[leakedKey] : 'unexpected-worker-environment'}\n`);
} else {
  const destinationRefs = envelope.request.payload.updates.map((update) => update.destinationRef);
  process.stdout.write(`${JSON.stringify({
    version: 1, ok: true, workerPid: process.pid,
    receipt: { action: 'git-push', outcome: 'pushed', updateCount: destinationRefs.length, destinationRefs }
  })}\n`);
}
