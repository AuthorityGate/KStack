import { HOST_ARTIFACT_SCHEMAS, HOST_BOOTSTRAP_SCHEMA_DOCUMENTS, buildHostArtifactSchemaSet } from '/mnt/e/Source/Projects/KStack/plugins/kstack/scripts/kstack-host-contract.mjs';
import { inspectPattern } from '/tmp/claude-1000/-mnt-e-Source-Projects-KStack/72dc2d91-7b72-4d79-a804-54a7ce551fa1/scratchpad/instrument-r3.mjs';

const vocabulary = Object.freeze({
  mediaTypes: ['application-json'], operationIds: ['inspect'], operationClassIds: ['LOCAL_READ', 'read-only'],
  capabilityIds: ['file-read', 'text-search'], fixtureIds: ['basic'], reasonCodes: ['KSTACK_HOST_CLASS_MISMATCH', 'none'], errorCodes: ['KSTACK_HOST_DENIED', 'denied'],
  operationProfileIds: ['read-safe'], componentRoles: ['runtime'], receiptKinds: ['local'], quarantineSubjectTypes: ['host']
});

function collectPatterns(node, out) {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const item of node) collectPatterns(item, out); return; }
  if (typeof node.pattern === 'string') out.push(node.pattern);
  for (const key of Object.keys(node)) collectPatterns(node[key], out);
}

const sources = {};
{ const p = []; collectPatterns(HOST_ARTIFACT_SCHEMAS, p); sources.HOST_ARTIFACT_SCHEMAS = p; }
{ const p = []; collectPatterns(HOST_BOOTSTRAP_SCHEMA_DOCUMENTS, p); sources.HOST_BOOTSTRAP_SCHEMA_DOCUMENTS = p; }
{ const built = buildHostArtifactSchemaSet(vocabulary); const p = []; collectPatterns(built, p); sources.buildHostArtifactSchemaSet_realVocab = p; }

const allPatterns = new Set();
for (const list of Object.values(sources)) for (const p of list) allPatterns.add(p);

console.log('=== per-source pattern counts ===');
for (const [name, list] of Object.entries(sources)) console.log(name, `${list.length} occurrences (${new Set(list).size} distinct)`);

console.log('=== inspected distinct patterns ===');
let maxSymbolCount = 0, maxDfaStateCount = 0, totalDfaStates = 0;
for (const p of allPatterns) {
  const r = inspectPattern(p);
  console.log(JSON.stringify(r));
  if (r.symbolCount > maxSymbolCount) maxSymbolCount = r.symbolCount;
  if (r.dfaStateCount > maxDfaStateCount) maxDfaStateCount = r.dfaStateCount;
  totalDfaStates += r.dfaStateCount;
}
console.log(JSON.stringify({ summary: true, distinctPatternCount: allPatterns.size, maxSymbolCount, maxDfaStateCount, totalDfaStatesAcrossDistinctPatterns: totalDfaStates }));
