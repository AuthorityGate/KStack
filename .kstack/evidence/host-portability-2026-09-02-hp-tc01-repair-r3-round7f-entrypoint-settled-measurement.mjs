// Measurement 2: settle the entry point ambiguity flagged twice by review.
// This script imports compileClosedSchemaSet DIRECTLY from the production
// module (not the instrumentation harness's exported inspectPattern) and
// states so explicitly in its own output.
import { compileClosedSchemaSet } from '/mnt/e/Source/Projects/KStack/plugins/kstack/scripts/kstack-host-contract.mjs';

function compileOnce(pattern) {
  const entries = [{ schemaId: 'x', schema: { type: 'string', pattern } }];
  const t0 = process.hrtime.bigint();
  compileClosedSchemaSet(entries);
  const t1 = process.hrtime.bigint();
  return Number(t1 - t0) / 1e6;
}

function warmedTiming(pattern, label, trials, warmup) {
  const times = [];
  for (let i = 0; i < trials; i += 1) times.push(compileOnce(pattern));
  const steady = times.slice(warmup);
  const mean = steady.reduce((a, b) => a + b, 0) / steady.length;
  const sorted = [...steady].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0], max = sorted[sorted.length - 1];
  console.log(JSON.stringify({ label, entryPoint: 'production compileClosedSchemaSet, imported directly from plugins/kstack/scripts/kstack-host-contract.mjs -- NOT the instrumentation harness or its exported inspectPattern', pattern, bytes: Buffer.byteLength(pattern, 'ascii'), trials, warmup, steadyMeanMs: +mean.toFixed(3), steadyMedianMs: +median.toFixed(3), steadyMinMs: +min.toFixed(3), steadyMaxMs: +max.toFixed(3) }));
}

warmedTiming('^a*a{0,4000}$', 'baseline-narrow-alphabet-entrypoint-settled', 30, 15);
warmedTiming('^a*a{0,4000}-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_bcdefghijklmnopqrstuvwxyz$', 'widened-alphabet-symbolCount67-entrypoint-settled', 30, 15);
