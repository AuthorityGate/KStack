#!/usr/bin/env node
import net from 'node:net';

const socketPath = process.env.KSTACK_ASKPASS_SOCKET;
const prompt = process.argv[2] ?? '';
const kind = /username/iu.test(prompt) ? 'username' : /password/iu.test(prompt) ? 'password' : null;

if (typeof socketPath !== 'string' || !socketPath || kind === null) {
  process.stderr.write('KSG-ASKPASS-PROTOCOL-001\n');
  process.exit(1);
}

const socket = net.createConnection(socketPath);
const chunks = [];
let bytes = 0;
socket.setTimeout(5_000, () => socket.destroy(new Error('timeout')));
socket.on('connect', () => socket.end(kind));
socket.on('data', (chunk) => {
  bytes += chunk.length;
  if (bytes > 8_192) socket.destroy(new Error('overflow'));
  else chunks.push(chunk);
});
socket.on('error', () => {
  process.stderr.write('KSG-ASKPASS-UNAVAILABLE-001\n');
  process.exitCode = 1;
});
socket.on('close', () => {
  if (process.exitCode) return;
  process.stdout.write(Buffer.concat(chunks));
  process.stdout.write('\n');
});
