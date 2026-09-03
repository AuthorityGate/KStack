// Measurement 1: ONE real compileClosedSchemaSet call containing all four
// distinct widened-pattern variants together, timed directly against
// production. Measurement 2 (entry-point settlement) is a separate script,
// measure-production-entrypoint.mjs, in the same directory.
import { compileClosedSchemaSet } from '/mnt/e/Source/Projects/KStack/plugins/kstack/scripts/kstack-host-contract.mjs';

const SUFFIX = '-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_bcdefghijklmnopqrstuvwxyz';
const counts = [4000, 3999, 3998, 3997];
const patterns = counts.map((n) => `^a*a{0,${n}}${SUFFIX}$`);

function entriesFor(patterns) {
  return patterns.map((pattern, index) => ({ schemaId: `p${index}`, schema: { type: 'string', pattern } }));
}

function compileOnce(entries) {
  const t0 = process.hrtime.bigint();
  compileClosedSchemaSet(entries);
  const t1 = process.hrtime.bigint();
  return Number(t1 - t0) / 1e6;
}

function warmedTiming(entries, label, trials, warmup) {
  const times = [];
  for (let i = 0; i < trials; i += 1) times.push(compileOnce(entries));
  const steady = times.slice(warmup);
  const mean = steady.reduce((a, b) => a + b, 0) / steady.length;
  const sorted = [...steady].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0], max = sorted[sorted.length - 1];
  console.log(JSON.stringify({ label, entryPoint: 'production compileClosedSchemaSet (direct import from kstack-host-contract.mjs, not the harness)', patternCount: entries.length, trials, warmup, steadyMeanMs: +mean.toFixed(3), steadyMedianMs: +median.toFixed(3), steadyMinMs: +min.toFixed(3), steadyMaxMs: +max.toFixed(3) }));
}

console.log('patterns:', JSON.stringify(patterns.map((p) => ({ pattern: p, bytes: Buffer.byteLength(p, 'ascii') }))));

const entries = entriesFor(patterns);
warmedTiming(entries, 'combined-4-widened-patterns-one-call', 15, 7);
