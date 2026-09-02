#!/usr/bin/env node
// Protocol double for a Secret Service collection that cannot answer whether an item exists.
// It targets the worker's missingAllowed early return specifically: that return treated exit 1
// with empty stdout as a confirmed absence, and a locked collection produces exactly that pair
// apart from its stderr diagnostic. So this double answers every lookup it cannot satisfy with
// the lock diagnostic on stderr instead of a silent exit 1.
//
// Lookups that find the item still succeed, so a run proceeds normally until cleanup. Cleanup is
// where it bites: discardSecret looks the item up with missingAllowed before clearing, and a
// worker that ignores stderr reads the lock as "already gone" and reports CONFIRMED for an item
// it never removed. Note that this is only reachable through the missingAllowed path — the main
// lookup path has always rejected a non-empty stderr.
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
      } else if (command === 'clear') {
        if (fs.existsSync(file)) fs.rmSync(file);
      } else if (fs.existsSync(file)) {
        const value = fs.readFileSync(file);
        process.stdout.write(value);
        process.stdout.write('\n');
        value.fill(0);
      } else {
        // The discriminating case: an absence it cannot vouch for, reported as a lock.
        process.stderr.write('gnome-keyring: the collection is locked\n');
        process.exitCode = 1;
      }
    }
  }
}
