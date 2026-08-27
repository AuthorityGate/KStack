#!/usr/bin/env node
import fs from 'node:fs';

const input = fs.readFileSync(0, 'utf8');
const grounding = input.includes('<<<KSTACK:PACKET:BEGIN:');
const quote = ['A genuinely wired citation decision packet.', 'A uniquely citable design line.'].find((candidate) => input.includes(candidate));

const review = {
  decision: 'approve',
  confidence: 96,
  failedChecks: [],
  securityFindings: [],
  materialDissent: [],
  recommendation: grounding ? { text: 'Opus review approves the fixture design.', groundKind: 'assertion' } : 'Opus review approves the fixture design.',
  strongestObjection: grounding ? { text: 'The fixture does not exercise a real provider.', groundKind: 'absence' } : 'The fixture does not exercise a real provider.',
  unresolvedQuestions: [],
  ...(grounding ? { citations: [{ id: 'OPUS-CIT-1', target: { field: 'recommendation' }, sourceId: 'SRC-DESIGN', claim: 'The packet contains the decision line.', quotedText: quote ?? 'A uniquely citable design line.' }] } : {})
};
console.log(JSON.stringify({ structured_output: review }));
