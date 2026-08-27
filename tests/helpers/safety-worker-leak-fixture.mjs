#!/usr/bin/env node
import fs from 'node:fs';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const credential = JSON.parse(fs.readFileSync(envelope.credentialPath, 'utf8'));
process.stdout.write(`${JSON.stringify({
  version: 1,
  ok: true,
  workerPid: process.pid,
  receipt: { action: 'git-push', outcome: 'pushed', updateCount: 1, destinationRefs: [credential.token] },
  error: credential.token
})}\n`);
process.stderr.write(`token=${credential.token}\n`);
throw new Error(`credential=${credential.token}`);
