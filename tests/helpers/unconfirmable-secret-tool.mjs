#!/usr/bin/env node
// Protocol double that behaves exactly like fake-secret-tool.mjs except that looking up an
// absent key exits 2 instead of 1. The worker treats only (status 1, empty stdout) as a
// confirmed absence, so this drives cleanup into KSTACK_SECRET_LINUX_CLEANUP_UNCONFIRMED
// without disturbing any lookup of a key that is actually present.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function fail() { process.exitCode = 2; }

const [command, ...rawArgs] = process.argv.slice(2);
const root = process.env.KSTACK_SECRET_TEST_STORE;
if (!root || !path.isAbsolute(root) || !['store', 'lookup', 'clear'].includes(command)) {
  fail();
} else {
  let args = rawArgs;
  if (command === 'store') {
    if (args[0] !== '--label' || !args[1]) fail();
    else args = args.slice(2);
  }
  if (process.exitCode === undefined && (args.length < 2 || args.length % 2 !== 0)) fail();
  if (process.exitCode === undefined) {
    const attributes = [];
    for (let index = 0; index < args.length; index += 2) {
      if (!/^[a-z0-9-]+$/u.test(args[index]) || !/^[a-zA-Z0-9._-]+$/u.test(args[index + 1])) fail();
      attributes.push([args[index], args[index + 1]]);
    }
    if (process.exitCode === undefined) {
      attributes.sort(([left], [right]) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
      const key = crypto.createHash('sha256').update(JSON.stringify(attributes)).digest('hex');
      const file = path.join(root, key);
      fs.mkdirSync(root, { recursive: true, mode: 0o700 });
      fs.chmodSync(root, 0o700);
      if (command === 'store') {
        const chunks = [];
        for await (const chunk of process.stdin) chunks.push(chunk);
        const value = Buffer.concat(chunks);
        fs.writeFileSync(file, value, { mode: 0o600, flag: 'wx' });
        value.fill(0);
      } else if (command === 'lookup') {
        if (!fs.existsSync(file)) process.exitCode = 2;
        else {
          const value = fs.readFileSync(file);
          process.stdout.write(value);
          process.stdout.write('\n');
          value.fill(0);
        }
      } else if (!fs.existsSync(file)) process.exitCode = 1;
      else fs.rmSync(file);
    }
  }
}
