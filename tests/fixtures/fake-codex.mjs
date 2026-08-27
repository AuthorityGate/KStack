#!/usr/bin/env node
import fs from 'node:fs';

const input = fs.readFileSync(0, 'utf8');
const grounding = input.includes('<<<KSTACK:PACKET:BEGIN:');
const quote = ['A genuinely wired citation decision packet.', 'A uniquely citable design line.'].find((candidate) => input.includes(candidate));

const review = {
  decision: 'approve',
  confidence: 97,
  failedChecks: [],
  securityFindings: [],
  materialDissent: [],
  recommendation: grounding ? { text: 'Codex review approves the fixture design.', groundKind: 'assertion' } : 'Codex review approves the fixture design.',
  strongestObjection: grounding ? { text: 'The fixture does not exercise a real provider.', groundKind: 'absence' } : 'The fixture does not exercise a real provider.',
  unresolvedQuestions: [],
  ...(grounding ? { citations: [{ id: 'CODEX-CIT-1', target: { field: 'recommendation' }, sourceId: 'SRC-DESIGN', claim: 'The packet contains the decision line.', quotedText: quote ?? 'A uniquely citable design line.' }] } : {})
};
const index = process.argv.indexOf('--output-last-message');
if (index === -1 || !process.argv[index + 1]) process.exit(3);
fs.writeFileSync(process.argv[index + 1], JSON.stringify(review));
console.log('codex fixture complete');
