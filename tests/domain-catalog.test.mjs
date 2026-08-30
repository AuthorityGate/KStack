import assert from 'node:assert/strict';
import test from 'node:test';
import { HOST_PROFILES } from '../plugins/kstack/scripts/kstack-host-profile.mjs';
import {
  buildDomainPack,
  renderDomainSelection,
  selectDomainMethods,
  validateDomainCatalog
} from '../plugins/kstack/scripts/kstack-domain-catalog.mjs';

const PACK = buildDomainPack({
  packId: 'release-operations',
  version: '1.0.0',
  title: 'Release operations',
  domains: ['release'],
  methods: [{
    methodId: 'readiness-review',
    title: 'Release readiness review',
    applicability: ['release', 'deployment'],
    instructions: ['Inspect the declared release evidence.', 'Identify missing proof and unresolved ambiguity.'],
    evidenceRequirements: ['Cite artifact digests and validation identifiers.']
  }],
  provenanceDigest: 'a'.repeat(64)
});
const CATALOG = Object.freeze({ schemaVersion: 1, catalogId: 'default-catalog', packs: [PACK] });

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected);
}

test('catalog and pack schemas are closed, deterministic, and content bound', () => {
  const first = validateDomainCatalog(CATALOG);
  const second = validateDomainCatalog(structuredClone(CATALOG));
  assert.deepEqual(first, second);
  code('KSTACK_DOMAIN_CATALOG_INVALID', () => validateDomainCatalog({ ...CATALOG, authority: true }));
  code('KSTACK_DOMAIN_PACK_CONTENT_MISMATCH', () => validateDomainCatalog({
    ...CATALOG,
    packs: [{ ...PACK, title: 'Changed' }]
  }));
  for (const methods of [null, {}, [], Array.from({ length: 129 }, () => PACK.methods[0])]) {
    code('KSTACK_DOMAIN_PACK_INVALID', () => buildDomainPack({
      packId: 'invalid-pack', version: '1.0.0', title: 'Invalid', domains: ['release'], methods,
      provenanceDigest: 'a'.repeat(64)
    }));
  }
  for (const mutation of [
    { title: 'Cafe\u0301' },
    { instructions: ['Inspect safe text.\u202e'] },
    { instructions: ['Inspect safe text.\u0000'] }
  ]) {
    const method = { ...PACK.methods[0], ...mutation };
    code('KSTACK_DOMAIN_METHOD_INVALID', () => buildDomainPack({
      packId: 'invalid-pack', version: '1.0.0', title: 'Invalid', domains: ['release'], methods: [method],
      provenanceDigest: 'a'.repeat(64)
    }));
  }
  code('KSTACK_DOMAIN_PACK_INVALID', () => buildDomainPack({
    packId: 'invalid-pack', version: '1.0.0', title: 'Invalid', domains: ['release'],
    methods: [PACK.methods[0], PACK.methods[0]], provenanceDigest: 'a'.repeat(64)
  }));
});

test('selection is exact, applicability bound, and digest protected', () => {
  const selection = selectDomainMethods(CATALOG, { packIds: ['release-operations'], applicability: ['release'] });
  assert.equal(selection.methods.length, 1);
  assert.equal(selectDomainMethods(CATALOG, { packIds: ['release-operations'], applicability: ['security'] }).methods.length, 0);
  code('KSTACK_DOMAIN_SELECTION_UNKNOWN_PACK', () => selectDomainMethods(CATALOG, { packIds: ['unknown-pack'], applicability: ['release'] }));
  code('KSTACK_DOMAIN_SELECTION_PROVENANCE_INVALID', () => renderDomainSelection({
    ...selection,
    selectionDigest: 'b'.repeat(64)
  }, HOST_PROFILES.hermes));
  code('KSTACK_DOMAIN_SELECTION_PROVENANCE_INVALID', () => renderDomainSelection(structuredClone(selection), HOST_PROFILES.hermes));
});

test('one host-neutral selection renders natively for Hermes and OpenClaw without authority', () => {
  const selection = selectDomainMethods(CATALOG, { packIds: ['release-operations'], applicability: ['release'] });
  const hermes = renderDomainSelection(selection, HOST_PROFILES.hermes);
  const openclaw = renderDomainSelection(selection, HOST_PROFILES.openclaw);
  assert.equal(hermes.artifacts[0].instructionFile, 'AGENTS.md');
  assert.equal(openclaw.artifacts[0].instructionFile, 'AGENTS.md');
  assert.notEqual(hermes.renderingDigest, openclaw.renderingDigest);
  for (const rendered of [hermes, openclaw]) {
    assert.match(rendered.artifacts[0].content, /native-analysis/u);
    assert.match(rendered.artifacts[0].content, /read-only/u);
    assert.match(rendered.artifacts[0].content, /Analysis only/u);
    assert.match(rendered.artifacts[0].content, /does not grant authority/u);
  }
});
