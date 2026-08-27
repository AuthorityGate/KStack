#!/usr/bin/env node
import fs from 'node:fs';

const input = fs.readFileSync(0, 'utf8');
const isV2 = input.includes('<<<KSTACK:PACKET:BEGIN:');
const mode = process.argv.includes('--recovery-mode=exit') ? 'exit' : 'malformed';
if (isV2 && mode === 'exit') process.exit(4);
const output = isV2 ? '{malformed-v2' : JSON.stringify({
  decision: 'approve', confidence: 99, failedChecks: [], securityFindings: [],
  materialDissent: [], recommendation: 'Recovered legacy review.',
  strongestObjection: 'Recovery was required.', unresolvedQuestions: []
});
const lastIndex = process.argv.indexOf('--output-last-message');
if (lastIndex >= 0) fs.writeFileSync(process.argv[lastIndex + 1], output);
else if (isV2) process.stdout.write(output);
else process.stdout.write(JSON.stringify({ structured_output: JSON.parse(output) }));
