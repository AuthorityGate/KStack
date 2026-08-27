#!/usr/bin/env node
let prompt = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) prompt += chunk;

const modelIndex = process.argv.indexOf('--model');
const model = modelIndex >= 0 ? process.argv[modelIndex + 1] : 'missing';
process.stdout.write(`Fable directive for ${model}: ${prompt.trim()}\n`);
