import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HOST_FIELD_VALUE_SCHEMA_DIGESTS,
  HOST_PACKAGE_DOMAINS,
  addressObject,
  admitInitialStateEvidence,
  admitSourcePackage,
  canonicalJson,
  createHealthRecord,
  createInstalledMemberManifest,
  createInstallerCandidate,
  createInstallerHandoff,
  createInstallerPreflightRequest,
  createMigrationAuthorization,
  createMigrationProposal,
  createPreservationBaseline,
  createRegistrySchemaBinding,
  rawDigest,
  renderSourcePackage,
  renderUnsupportedStatus,
  validateCanonicalPackage,
  validatePortableRelativePath,
  validateRegistrySet,
  validateReuseAdmission,
  verifyHistoricalResolution
} from '../plugins/kstack/scripts/kstack-host-package.mjs';

const D = (character) => `sha256:${character.repeat(64)}`;

function registry(templateDigest = D('1')) {
  return {
    schemaId: 'kstack.registry-set.v1', schemaVersion: 1,
    schemaDialect: 'https://json-schema.org/draft/2020-12/schema', metaschemaDigest: D('a'),
    operationIds: ['authoritygate.kstack.inspect'],
    profileIds: [{ id: 'default', requiredOperationIds: ['authoritygate.kstack.inspect'] }],
    targetIds: [
      { id: 'agent-skills', lifecycle: 'BASELINE' },
      { id: 'claude', lifecycle: 'BASELINE' },
      { id: 'codex', lifecycle: 'BASELINE' },
      { id: 'opencode', lifecycle: 'CANDIDATE' }
    ],
    mediaTypes: [
      { id: 'application-octet-stream', canonicalValue: 'application/octet-stream' },
      { id: 'text-markdown', canonicalValue: 'text/markdown; charset=utf-8' }
    ],
    reasonCodes: [
      { id: 'host-capability-unavailable', category: 'UNSUPPORTED', maximumOutcome: 'UNSUPPORTED' },
      { id: 'projection-nonsemantic-framing-omitted', category: 'UNSUPPORTED', maximumOutcome: 'DEGRADED' }
    ],
    platformProfiles: [{ id: 'linux-x64', constraintSchemaDigest: D('b') }],
    metadataAdapters: [{ id: 'agent-skills-v1', schemaDigest: D('c'), projectionSchemaVersion: '1' }],
    hostFields: [],
    destinationTemplates: [{ id: 'project-skills', scope: 'PROJECT', templateSchemaDigest: D('e') }],
    unsupportedStatusTemplates: [{ id: 'markdown-status-v1', mediaTypeId: 'text-markdown', templateSchemaDigest: D('f'), templateDigest }],
    testObligationIds: ['canonical-json', 'clause-partition', 'installer-handoff']
  };
}

function canonicalPackage(registrySetDigest) {
  return {
    schemaId: 'kstack.canonical-package.v1', schemaVersion: 1, registrySetDigest,
    packageId: 'authoritygate.kstack', packageVersion: '1.0.0',
    skills: [{
      skillId: 'portable-inspect', root: 'skills/portable-inspect',
      entrySource: 'skills/portable-inspect/SKILL.src.md', agentSkillsEntry: 'skills/portable-inspect/SKILL.md',
      memberPaths: ['skills/portable-inspect/SKILL.src.md', 'skills/portable-inspect/reference.src.md'],
      operationIds: ['authoritygate.kstack.inspect']
    }],
    members: [
      { path: 'LICENSE', role: 'LICENSE', skillId: null, modelVisible: 'NO' },
      { path: 'skills/portable-inspect/SKILL.src.md', role: 'MODEL_SOURCE', skillId: 'portable-inspect', modelVisible: 'YES' },
      { path: 'skills/portable-inspect/reference.src.md', role: 'MODEL_SOURCE', skillId: 'portable-inspect', modelVisible: 'YES' }
    ],
    tokens: [{ tokenId: 'read-tool', kind: 'TOOL_NAME', argument: 'authoritygate.kstack.inspect', allowedContexts: ['CODE_SPAN'] }],
    targetIds: ['agent-skills', 'claude', 'codex', 'opencode'], reuseAdmissionDigests: []
  };
}

const entrySource = [
  '---',
  'name: "portable-inspect"',
  'description: "Inspect a bounded source."',
  '---',
  '<!-- kstack-clause:v1 {"appliesTo":["authoritygate.kstack.inspect"],"class":"workflow","id":"inspect-workflow"} -->',
  'Use `{{kstack-token:read-tool}}` for the admitted source.',
  '<!-- /kstack-clause:v1 -->',
  ''
].join('\n');

const referenceSource = [
  '<!-- kstack-clause:v1 {"appliesTo":["authoritygate.kstack.inspect"],"class":"authority","id":"inspect-authority"} -->',
  'The package never grants authority.',
  '<!-- /kstack-clause:v1 -->',
  ''
].join('\n');

function admitted(reg = registry()) {
  const registrySetDigest = addressObject(HOST_PACKAGE_DOMAINS.registrySet, reg);
  return admitSourcePackage({
    registry: reg,
    package: canonicalPackage(registrySetDigest),
    memberBytes: { LICENSE: 'MIT\n', 'skills/portable-inspect/SKILL.src.md': entrySource, 'skills/portable-inspect/reference.src.md': referenceSource },
    agentSkillsSchemaBinding: { specificationId: 'agentskills.specification', boundVersion: '2026-08-26', schemaDigest: D('9') }
  });
}

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected, expected);
}

test('canonical registry/package admission builds a one-way digest graph and exhaustive byte partitions', () => {
  const first = admitted();
  const second = admitted();
  assert.equal(first.registrySetDigest, second.registrySetDigest);
  assert.equal(first.sourceBundleDigest, second.sourceBundleDigest);
  assert.equal(first.sourceBundle.canonicalPackageDigest, first.canonicalPackageDigest);
  assert.equal(first.clauseInventory.sourceMemberSetDigest, first.sourceMemberSetDigest);
  assert.equal(Object.hasOwn(first.clauseInventory, 'sourceBundleDigest'), false);
  assert.equal(Object.hasOwn(first.sourceMemberSet, 'sourceBundleDigest'), false);
  assert.equal(first.sourceMemberSet.members.every((row) => row.executable === false), true);

  for (const partition of first.clauseInventory.filePartitions) {
    assert.equal(partition.segments[0].startByte, '0');
    assert.equal(partition.segments.at(-1).endByte, partition.byteLength);
    for (let index = 1; index < partition.segments.length; index += 1) {
      assert.equal(partition.segments[index - 1].endByte, partition.segments[index].startByte);
    }
    assert.equal(partition.segments.some((segment) => segment.kind === 'CLAUSE_BODY'), true);
  }
  const token = first.clauseInventory.rows.find((row) => row.clauseId === 'inspect-workflow').tokenOccurrences[0];
  assert.deepEqual(token, {
    tokenId: 'read-tool', startByte: token.startByte, endByte: token.endByte,
    context: 'CODE_SPAN', rawSpanDigest: rawDigest('{{kstack-token:read-tool}}')
  });
});

test('canonical JSON and package schemas fail closed on ambient or noncanonical inputs', () => {
  assert.equal(canonicalJson({ z: true, a: 'value' }), '{"a":"value","z":true}');
  code('KSTACK_CANONICAL_JSON_INVALID', () => canonicalJson({ value: 2 }));
  code('SOURCE_PATH_INVALID_OR_COLLIDING', () => validatePortableRelativePath('../escape'));
  code('SOURCE_PATH_INVALID_OR_COLLIDING', () => validatePortableRelativePath('C:/escape'));
  code('SOURCE_PATH_INVALID_OR_COLLIDING', () => validatePortableRelativePath('aux.txt'));
  const reg = registry();
  code('KSTACK_REGISTRY_SET_INVALID', () => validateRegistrySet({ ...reg, authority: 'allow' }));
  code('KSTACK_REGISTRY_SET_INVALID', () => validateRegistrySet({ ...reg, mediaTypes: reg.mediaTypes.filter((row) => row.id !== 'text-markdown') }));
  code('KSTACK_REGISTRY_SET_INVALID', () => validateRegistrySet({ ...reg, unsupportedStatusTemplates: [{ ...reg.unsupportedStatusTemplates[0], mediaTypeId: 'unknown-media' }] }));
  code('KSTACK_REGISTRY_SET_INVALID', () => validateRegistrySet({ ...reg, unsupportedStatusTemplates: [] }));
  for (const key of [
    'name', 'metadata', 'allowed-tools', 'allowed.tools', 'skill-id', 'x-identity',
    'x-host-authority', 'x-authoritative', 'x-auth', 'x-permit', 'x-approve',
    'x-qualify', 'x-bypass', 'x-principal', 'x-role', 'x-activate', 'x-creds',
    'x-secret-reference', 'x-grant', 'x-privilege', 'x-token', 'x-sudo',
    'x-elevate', 'x-entitle', 'x-capability', 'x-access', 'x-owner', 'tools',
    'x-tools', 'x-admin', 'x-superuser', 'x-root', 'x-impersonate', 'x-trust',
    'x-allow', 'x-deny', 'x-enable', 'x-enabled', 'x-on', 'x-password',
    'x-passphrase', 'x-key', 'x-signature', 'x-acl', 'x-rights', 'x-claims',
    'x-user', 'x-group', 'x-session', 'x-scope', 'x-model',
    'x-kstack-agent-skills-v1-tools', 'x-kstack-agent-skills-v1-password'
  ]) {
    code('KSTACK_REGISTRY_SET_INVALID', () => validateRegistrySet({
      ...reg, hostFields: [{ adapterId: 'agent-skills-v1', key, valueSchemaDigest: HOST_FIELD_VALUE_SCHEMA_DIGESTS.publicIdentifierV1 }]
    }));
  }
  code('KSTACK_REGISTRY_SET_INVALID', () => validateRegistrySet({
    ...reg,
    hostFields: [{ adapterId: 'missing-adapter', key: 'x-kstack-missing-adapter-note', valueSchemaDigest: HOST_FIELD_VALUE_SCHEMA_DIGESTS.publicIdentifierV1 }]
  }));
  code('KSTACK_REGISTRY_SET_INVALID', () => validateRegistrySet({
    ...reg,
    hostFields: [{ adapterId: 'agent-skills-v1', key: 'x-kstack-agent-skills-v1-note', valueSchemaDigest: D('d') }]
  }));
  const pkg = canonicalPackage(addressObject(HOST_PACKAGE_DOMAINS.registrySet, reg));
  code('KSTACK_CANONICAL_PACKAGE_INVALID', () => validateCanonicalPackage({ ...pkg, activation: true }, reg));
  code('MODEL_SOURCE_UNLISTED_OR_MISSING', () => admitSourcePackage({
    registry: reg, package: pkg,
    memberBytes: { LICENSE: 'MIT\n', 'skills/portable-inspect/SKILL.src.md': entrySource },
    agentSkillsSchemaBinding: { specificationId: 'agentskills.specification', boundVersion: 'v1', schemaDigest: D('9') }
  }));
});

test('registry schemas bind an exact metaschema and reject remote references or unknown vocabularies', () => {
  const metaschema = Buffer.from('{"title":"pinned draft 2020-12 metaschema"}\n');
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    additionalProperties: false, properties: { name: { type: 'string' } }, required: ['name'], type: 'object'
  };
  const created = createRegistrySchemaBinding({ metaschemaBytes: metaschema, schema });
  assert.equal(created.binding.metaschemaDigest, rawDigest(metaschema));
  assert.equal(created.schemaDigest, addressObject(HOST_PACKAGE_DOMAINS.registrySchema, created.binding));
  code('KSTACK_REGISTRY_SCHEMA_INVALID', () => createRegistrySchemaBinding({
    metaschemaBytes: metaschema, schema: { ...schema, properties: { name: { $ref: 'https://attacker.invalid/schema' } } }
  }));
  code('KSTACK_REGISTRY_SCHEMA_INVALID', () => createRegistrySchemaBinding({
    metaschemaBytes: metaschema, schema: { ...schema, $vocabulary: { 'https://unknown.invalid/vocab': true } }
  }));
});

test('component reuse provenance permits pattern reimplementation without admitting upstream bytes', () => {
  const reg = registry();
  const registrySetDigest = addressObject(HOST_PACKAGE_DOMAINS.registrySet, reg);
  const reuse = {
    schemaId: 'kstack.reuse-admission.v1', schemaVersion: 1, registrySetDigest,
    componentId: 'gstack.host-registry-pattern', disposition: 'REIMPLEMENT_PATTERN',
    upstream: {
      repository: 'https://github.com/garrytan/gstack', commit: 'ad8400543cd9ce8d07641362db48d44a95417e33',
      licenseId: 'MIT', licenseDigest: D('e'),
      sourcePaths: [{ path: 'hosts/index.ts', contentDigest: D('f'), admittedByteRanges: [] }]
    },
    reusedBehavior: 'Registry and derived target-list pattern.',
    alternativeConsidered: 'Independent closed registry implementation.',
    reuseJustification: 'The pattern is useful while its source structure is incompatible.',
    materialImprovements: ['Content-addressed lifecycle and no qualification claims.'],
    baselineEffects: [
      { dimension: 'AUTHORITY', upstreamEffect: 'PRESERVE', kstackEffect: 'IMPROVE', evidenceDigest: D('1') },
      { dimension: 'DETERMINISM', upstreamEffect: 'PRESERVE', kstackEffect: 'IMPROVE', evidenceDigest: D('2') }
    ],
    localOutputs: [], noticeMemberDigest: null,
    testObligationIds: ['canonical-json'], reviewDigest: D('3'), ownerDecisionDigest: D('4')
  };
  assert.equal(validateReuseAdmission(reuse, reg), reuse);
  const reuseDigest = addressObject(HOST_PACKAGE_DOMAINS.reuseAdmission, reuse);
  const pkg = { ...canonicalPackage(registrySetDigest), reuseAdmissionDigests: [reuseDigest] };
  const result = admitSourcePackage({
    registry: reg, package: pkg, reuseAdmissions: [reuse],
    memberBytes: { LICENSE: 'MIT\n', 'skills/portable-inspect/SKILL.src.md': entrySource, 'skills/portable-inspect/reference.src.md': referenceSource },
    agentSkillsSchemaBinding: { specificationId: 'agentskills.specification', boundVersion: 'v1', schemaDigest: D('9') }
  });
  assert.deepEqual(result.sourceBundle.reuseAdmissionDigests, [reuseDigest]);
  code('REUSE_ADMISSION_MISSING_OR_INVALID', () => admitSourcePackage({
    registry: reg, package: pkg, reuseAdmissions: [],
    memberBytes: { LICENSE: 'MIT\n', 'skills/portable-inspect/SKILL.src.md': entrySource, 'skills/portable-inspect/reference.src.md': referenceSource },
    agentSkillsSchemaBinding: { specificationId: 'agentskills.specification', boundVersion: 'v1', schemaDigest: D('9') }
  }));
  code('REUSE_ADMISSION_MISSING_OR_INVALID', () => validateReuseAdmission({
    ...reuse, upstream: { ...reuse.upstream, sourcePaths: [{ ...reuse.upstream.sourcePaths[0], admittedByteRanges: [{ start: '0', end: '1' }] }] }
  }, reg));
});

test('source admission rejects noncanonical text, unmarked prose, unknown tokens, and wrong token context', () => {
  const reg = registry();
  const pkg = canonicalPackage(addressObject(HOST_PACKAGE_DOMAINS.registrySet, reg));
  const base = { LICENSE: 'MIT\n', 'skills/portable-inspect/SKILL.src.md': entrySource, 'skills/portable-inspect/reference.src.md': referenceSource };
  const admit = (replacement) => admitSourcePackage({
    registry: reg, package: pkg, memberBytes: { ...base, ...replacement },
    agentSkillsSchemaBinding: { specificationId: 'agentskills.specification', boundVersion: 'v1', schemaDigest: D('9') }
  });
  code('SOURCE_TEXT_NONCANONICAL', () => admit({ 'skills/portable-inspect/reference.src.md': referenceSource.replaceAll('\n', '\r\n') }));
  code('CLAUSE_PARTITION_INCOMPLETE', () => admit({ 'skills/portable-inspect/reference.src.md': `unmarked\n${referenceSource}` }));
  code('TOKEN_UNKNOWN_OR_CONTEXT_INVALID', () => admit({ 'skills/portable-inspect/reference.src.md': referenceSource.replace('The package', '{{kstack-token:unknown}} The package') }));
  code('TOKEN_UNKNOWN_OR_CONTEXT_INVALID', () => admit({ 'skills/portable-inspect/SKILL.src.md': entrySource.replace('`{{kstack-token:read-tool}}`', '{{kstack-token:read-tool}}') }));
});

test('canonical Agent Skills metadata is preserved as non-authoritative namespaced data', () => {
  const sourceWithMetadata = entrySource.replace('---\n<!-- kstack-clause', 'metadata:\n  "kstack.category": "inspection"\n---\n<!-- kstack-clause');
  const reg = registry();
  const registrySetDigest = addressObject(HOST_PACKAGE_DOMAINS.registrySet, reg);
  const admission = admitSourcePackage({
    registry: reg, package: canonicalPackage(registrySetDigest),
    memberBytes: { LICENSE: 'MIT\n', 'skills/portable-inspect/SKILL.src.md': sourceWithMetadata, 'skills/portable-inspect/reference.src.md': referenceSource },
    agentSkillsSchemaBinding: { specificationId: 'agentskills.specification', boundVersion: 'v1', schemaDigest: D('9') }
  });
  const base = planFor(admission);
  const rendered = renderSourcePackage({
    admission, plan: { ...base, frontmatterProjection: { ...base.frontmatterProjection, keptFields: ['description', 'metadata', 'name'] } },
    resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64'
  });
  assert.match(rendered.memberBytes['skills/portable-inspect/SKILL.md'].toString(), /metadata:\n  "kstack\.category": "inspection"\n/u);
  code('KSTACK_PROJECTION_PLAN_INVALID', () => renderSourcePackage({
    admission, plan: base, resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64'
  }));
  const allowlistRendered = renderSourcePackage({
    admission,
    plan: { ...base, frontmatterProjection: { ...base.frontmatterProjection, mode: 'CLOSED_ALLOWLIST' } },
    resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64'
  });
  assert.doesNotMatch(allowlistRendered.memberBytes['skills/portable-inspect/SKILL.md'].toString(), /metadata:/u);
  assert.equal(allowlistRendered.projectionMap.frontmatterMaps[0].fieldBindings.some((row) => row.sourceKey === 'metadata' && row.disposition === 'DROP'), true);
  const hostile = sourceWithMetadata.replace('kstack.category', 'kstack.authority-bypass');
  code('KSTACK_AGENT_SKILLS_FRONTMATTER_INVALID', () => admitSourcePackage({
    registry: reg, package: canonicalPackage(registrySetDigest),
    memberBytes: { LICENSE: 'MIT\n', 'skills/portable-inspect/SKILL.src.md': hostile, 'skills/portable-inspect/reference.src.md': referenceSource },
    agentSkillsSchemaBinding: { specificationId: 'agentskills.specification', boundVersion: 'v1', schemaDigest: D('9') }
  }));
  for (const key of ['kstack.allowed-tools', 'kstack.credential-hint', 'kstack.secret-ref']) {
    const reserved = sourceWithMetadata.replace('kstack.category', key);
    code('KSTACK_AGENT_SKILLS_FRONTMATTER_INVALID', () => admitSourcePackage({
      registry: reg, package: canonicalPackage(registrySetDigest),
      memberBytes: { LICENSE: 'MIT\n', 'skills/portable-inspect/SKILL.src.md': reserved, 'skills/portable-inspect/reference.src.md': referenceSource },
      agentSkillsSchemaBinding: { specificationId: 'agentskills.specification', boundVersion: 'v1', schemaDigest: D('9') }
    }));
  }
});

function planFor(admission, overrides = {}) {
  const occurrence = admission.clauseInventory.rows.find((row) => row.clauseId === 'inspect-workflow').tokenOccurrences[0];
  return {
    schemaId: 'kstack.projection-plan.v1', schemaVersion: 1,
    registrySetDigest: admission.registrySetDigest, sourceBundleDigest: admission.sourceBundleDigest,
    targetId: 'opencode', hostProjectionSchemaVersion: '1', metadataAdapterId: 'agent-skills-v1', metadataAdapterSchemaDigest: D('c'),
    frontmatterProjection: { mode: 'AGENT_SKILLS_CANONICAL', keptFields: ['description', 'name'], hostFields: [] },
    resourceDispositions: [
      { sourcePath: 'LICENSE', outputPath: 'LICENSE', disposition: 'EXACT', reasonCode: null, affectedIds: [] },
      { sourcePath: 'skills/portable-inspect/SKILL.src.md', outputPath: 'skills/portable-inspect/SKILL.md', disposition: 'TYPED_PROJECTION', reasonCode: null, affectedIds: ['authoritygate.kstack.inspect'] },
      { sourcePath: 'skills/portable-inspect/reference.src.md', outputPath: 'skills/portable-inspect/reference.md', disposition: 'TYPED_PROJECTION', reasonCode: null, affectedIds: ['authoritygate.kstack.inspect'] }
    ],
    tokenUseDispositions: [{
      sourcePath: 'skills/portable-inspect/SKILL.src.md', clauseId: 'inspect-workflow', tokenId: occurrence.tokenId,
      sourceStartByte: occurrence.startByte, sourceEndByte: occurrence.endByte,
      disposition: 'PROJECT', value: 'read_file', valueDigest: rawDigest('read_file'), reasonCode: null,
      affectedIds: ['authoritygate.kstack.inspect']
    }],
    ...overrides
  };
}

test('projection renders deterministic host bytes and accounts for every semantic, framing, marker, and token span', () => {
  const admission = admitted();
  const plan = planFor(admission);
  const options = { admission, plan, resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64' };
  const first = renderSourcePackage(options);
  const second = renderSourcePackage(options);
  assert.equal(first.renderBundleDigest, second.renderBundleDigest);
  assert.equal(first.projectionMapDigest, second.projectionMapDigest);
  assert.equal(first.historicalResolutionDigest, second.historicalResolutionDigest);
  const output = first.memberBytes['skills/portable-inspect/SKILL.md'].toString();
  assert.match(output, /Use `read_file` for the admitted source\./u);
  assert.doesNotMatch(output, /kstack-clause|kstack-token/u);
  assert.equal(first.projectionMap.frontmatterMaps.length, 1);
  assert.equal(first.projectionMap.partitionMaps.some((row) => row.kind === 'OPEN_MARKER' && row.disposition === 'OMIT'), true);
  assert.equal(first.projectionMap.partitionMaps.some((row) => row.kind === 'CLOSE_MARKER' && row.disposition === 'OMIT'), true);
  const clause = first.projectionMap.rows.find((row) => row.clauseId === 'inspect-workflow');
  assert.equal(clause.replacementBindings.length, 1);
  assert.equal(clause.replacementBindings[0].outputDigest, rawDigest('read_file'));
  assert.equal(first.renderBundle.unsupported.length, 0);
  assert.equal(first.renderBundle.members.every((member) => Object.hasOwn(member, 'bytes') === false), true);
});

test('registered host frontmatter fields round-trip into emitted bytes and exact semantic provenance', () => {
  const reg = registry();
  reg.hostFields = [
    ...reg.hostFields,
    { adapterId: 'agent-skills-v1', key: 'x-kstack-agent-skills-v1-note', valueSchemaDigest: HOST_FIELD_VALUE_SCHEMA_DIGESTS.publicIdentifierV1 }
  ];
  const admission = admitted(reg);
  const base = planFor(admission);
  const plan = {
    ...base,
    frontmatterProjection: {
      ...base.frontmatterProjection,
      hostFields: [{ key: 'x-kstack-agent-skills-v1-note', value: 'bounded-adapter-value' }]
    }
  };
  const rendered = renderSourcePackage({ admission, plan, resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64' });
  const output = rendered.memberBytes['skills/portable-inspect/SKILL.md'].toString();
  assert.match(output, /description: "Inspect a bounded source\."\nx-kstack-agent-skills-v1-note: "bounded-adapter-value"\n---\n/u);
  const map = rendered.projectionMap.frontmatterMaps[0];
  assert.equal(map.fieldBindings.some((row) => row.disposition === 'ADD' && row.outputKey === 'x-kstack-agent-skills-v1-note'), true);
  assert.equal(map.fieldBindings.filter((row) => ['name', 'description'].includes(row.sourceKey)).every((row) => row.disposition === 'KEEP'), true);

  for (const value of ['bounded adapter value', 'TRUE', 'tools(*)', `${'a'.repeat(65)}`]) {
    code('KSTACK_PROJECTION_PLAN_INVALID', () => renderSourcePackage({
      admission,
      plan: { ...plan, frontmatterProjection: { ...plan.frontmatterProjection, hostFields: [{ key: 'x-kstack-agent-skills-v1-note', value }] } },
      resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64'
    }));
  }
});

test('projection rejects incomplete occurrence coverage, unsafe replacements, output collisions, and EXACT token mutation', () => {
  const admission = admitted();
  const base = planFor(admission);
  const render = (plan) => renderSourcePackage({ admission, plan, resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64' });
  code('KSTACK_PROJECTION_PLAN_INVALID', () => render({ ...base, tokenUseDispositions: [] }));
  code('TOKEN_UNKNOWN_OR_CONTEXT_INVALID', () => render({
    ...base,
    tokenUseDispositions: [{ ...base.tokenUseDispositions[0], value: '`unsafe`', valueDigest: rawDigest('`unsafe`') }]
  }));
  code('KSTACK_PROJECTION_PLAN_INVALID', () => render({
    ...base,
    resourceDispositions: base.resourceDispositions.map((row) => row.sourcePath === 'LICENSE' ? { ...row, outputPath: 'skills/portable-inspect/SKILL.md' } : row)
  }));
  code('KSTACK_PROJECTION_PLAN_INVALID', () => render({
    ...base,
    resourceDispositions: base.resourceDispositions.map((row) => row.sourcePath === 'LICENSE'
      ? { ...row, disposition: 'UNSUPPORTED', reasonCode: 'host-capability-unavailable', affectedIds: ['authoritygate.kstack.inspect'] }
      : row)
  }));
  code('PROJECTION_LITERAL_CHANGED', () => render({
    ...base,
    resourceDispositions: base.resourceDispositions.map((row) => row.sourcePath.endsWith('/SKILL.src.md') ? { ...row, disposition: 'EXACT' } : row)
  }));
  const noOmitReasonRegistry = registry();
  noOmitReasonRegistry.reasonCodes = noOmitReasonRegistry.reasonCodes.filter((row) => row.id !== 'projection-nonsemantic-framing-omitted');
  const noOmitAdmission = admitted(noOmitReasonRegistry);
  code('KSTACK_PROJECTION_PLAN_INVALID', () => renderSourcePackage({
    admission: noOmitAdmission, plan: planFor(noOmitAdmission), resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64'
  }));
});

test('unsupported status rendering is a closed non-executable template with fixed escaping', () => {
  const template = {
    schemaId: 'kstack.unsupported-status-template.v1', schemaVersion: 1,
    templateId: 'markdown-status-v1', mediaTypeId: 'text-markdown',
    orderedSegments: [
      { kind: 'LITERAL', value: 'Unsupported: ' }, { kind: 'SOURCE_PATH' },
      { kind: 'LITERAL', value: ' (' }, { kind: 'REASON_CODE' },
      { kind: 'LITERAL', value: ') [' }, { kind: 'AFFECTED_IDS' }, { kind: 'LITERAL', value: ']\n' }
    ]
  };
  assert.equal(renderUnsupportedStatus(template, {
    sourcePath: 'skills/x.src.md', reasonCode: 'host-capability-unavailable', affectedIds: ['authoritygate.kstack.inspect']
  }), 'Unsupported: skills/x.src.md (host-capability-unavailable) [authoritygate.kstack.inspect]\n');
  code('KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID', () => renderUnsupportedStatus({ ...template, orderedSegments: [{ kind: 'EVAL', value: '${process.env.SECRET}' }] }, {
    sourcePath: 'skills/x.src.md', reasonCode: 'host-capability-unavailable', affectedIds: ['authoritygate.kstack.inspect']
  }));
  code('KSTACK_UNSUPPORTED_STATUS_TEMPLATE_INVALID', () => renderUnsupportedStatus({ ...template, mediaTypeId: 'application-octet-stream' }, {
    sourcePath: 'skills/x.src.md', reasonCode: 'host-capability-unavailable', affectedIds: ['authoritygate.kstack.inspect']
  }));
});

test('UNSUPPORTED projection emits one registry-bound status member and generated-output map', () => {
  const template = {
    schemaId: 'kstack.unsupported-status-template.v1', schemaVersion: 1,
    templateId: 'markdown-status-v1', mediaTypeId: 'text-markdown',
    orderedSegments: [
      { kind: 'LITERAL', value: 'Unsupported ' }, { kind: 'SOURCE_PATH' },
      { kind: 'LITERAL', value: ': ' }, { kind: 'REASON_CODE' },
      { kind: 'LITERAL', value: ' [' }, { kind: 'AFFECTED_IDS' }, { kind: 'LITERAL', value: ']\n' }
    ]
  };
  const templateDigest = addressObject(HOST_PACKAGE_DOMAINS.unsupportedStatusTemplate, template);
  const admission = admitted(registry(templateDigest));
  const base = planFor(admission);
  const plan = {
    ...base,
    resourceDispositions: base.resourceDispositions.map((row) => row.sourcePath.endsWith('reference.src.md') ? {
      ...row, disposition: 'UNSUPPORTED', reasonCode: 'host-capability-unavailable'
    } : row)
  };
  const rendered = renderSourcePackage({
    admission, plan, resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64',
    unsupportedTemplates: { 'markdown-status-v1': template }
  });
  assert.equal(rendered.renderBundle.unsupported.length, 1);
  assert.equal(rendered.projectionMap.generatedOutputMaps.length, 1);
  assert.equal(rendered.projectionMap.generatedOutputMaps[0].templateDigest, templateDigest);
  assert.equal(rendered.projectionMap.generatedOutputMaps[0].templateMediaTypeId, 'text-markdown');
  assert.equal(rendered.projectionMap.partitionMaps.some((row) => row.sourcePath.endsWith('reference.src.md') && row.disposition === 'UNSUPPORTED' && row.outputStartByte === null), true);
  assert.equal(rendered.memberBytes['skills/portable-inspect/reference.md'].toString(),
    'Unsupported skills/portable-inspect/reference.src.md: host-capability-unavailable [authoritygate.kstack.inspect]\n');
  const unsupportedClause = rendered.projectionMap.rows.find((row) => row.clauseId === 'inspect-authority');
  assert.equal(unsupportedClause.outputStartByte, null);
  assert.equal(unsupportedClause.reasonCode, 'host-capability-unavailable');
  code('PROJECTION_UNSUPPORTED', () => renderSourcePackage({
    admission, plan, resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64', unsupportedTemplates: {}
  }));
  const mismatchedTemplate = { ...template, templateId: 'wrong-template' };
  code('PROJECTION_UNSUPPORTED', () => renderSourcePackage({
    admission, plan, resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64',
    unsupportedTemplates: { 'markdown-status-v1': mismatchedTemplate }
  }));
  const ambiguousRegistry = registry(templateDigest);
  ambiguousRegistry.unsupportedStatusTemplates = [
    { id: 'markdown-alt-v1', mediaTypeId: 'text-markdown', templateSchemaDigest: D('f'), templateDigest },
    ...ambiguousRegistry.unsupportedStatusTemplates
  ];
  const ambiguousAdmission = admitted(ambiguousRegistry);
  const ambiguousPlan = planFor(ambiguousAdmission);
  ambiguousPlan.resourceDispositions = ambiguousPlan.resourceDispositions.map((row) => row.sourcePath.endsWith('reference.src.md') ? { ...row, disposition: 'UNSUPPORTED', reasonCode: 'host-capability-unavailable' } : row);
  code('PROJECTION_UNSUPPORTED', () => renderSourcePackage({
    admission: ambiguousAdmission, plan: ambiguousPlan, resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64',
    unsupportedTemplates: { 'markdown-alt-v1': template, 'markdown-status-v1': template }
  }));
});

function candidateFixture() {
  return createInstallerCandidate({
    registrySetDigest: D('a'), historicalResolutionDigest: D('b'), renderBundleDigest: D('c'),
    targetId: 'opencode', platformProfile: 'linux-x64', intendedScope: 'PROJECT', destinationTemplateId: 'project-skills'
  });
}

function evidenceFixture(candidate, request, preflightRequestDigest) {
  return {
    schemaId: 'kstack.initial-state-evidence.v1', schemaVersion: 1,
    registrySetDigest: candidate.registrySetDigest, preflightRequestDigest,
    installerCandidateDigest: request.installerCandidateDigest, targetId: candidate.targetId,
    platformProfile: candidate.platformProfile, scope: candidate.intendedScope,
    destinationTemplateId: candidate.destinationTemplateId, resolvedDestinationBindingDigest: D('d'),
    observedState: 'ABSENT', ownershipEvidenceDigest: null, installedMemberManifestDigest: null,
    priorActiveInstallReceiptDigest: null, observationEvidenceDigest: D('e'), protectedPreflightReceiptDigest: D('f')
  };
}

test('INITIAL is a read-only typed preflight followed by an exactly bound mutation handoff', () => {
  const { candidate, installerCandidateDigest } = candidateFixture();
  const { request, preflightRequestDigest } = createInstallerPreflightRequest(candidate, installerCandidateDigest);
  const evidence = evidenceFixture(candidate, request, preflightRequestDigest);
  const admittedEvidence = admitInitialStateEvidence({ candidate, preflightRequest: request, evidence });
  const { handoff } = createInstallerHandoff({ mode: 'INITIAL', candidate, preflightRequest: request, initialStateEvidence: admittedEvidence.evidence });
  assert.equal(request.expectedState, 'NO_PRIOR_ACTIVE_INSTALL');
  assert.equal(handoff.initialStateEvidenceDigest, admittedEvidence.initialStateEvidenceDigest);
  assert.equal(handoff.fromPreservationBaselineDigest, null);
  assert.equal(handoff.migrationProposalDigest, null);
  assert.equal(handoff.migrationAuthorizationDigest, null);
  code('KSTACK_INITIAL_STATE_NOT_QUALIFIED', () => admitInitialStateEvidence({
    candidate, preflightRequest: request,
    evidence: { ...evidence, observedState: 'EXISTING', installedMemberManifestDigest: D('1'), priorActiveInstallReceiptDigest: D('2') }
  }));
  code('KSTACK_INITIAL_STATE_EVIDENCE_INVALID', () => admitInitialStateEvidence({
    candidate, preflightRequest: request, evidence: { ...evidence, targetId: 'claude' }
  }));
  code('KSTACK_INSTALLER_PREFLIGHT_INVALID', () => admitInitialStateEvidence({
    candidate, preflightRequest: { ...request, expectedState: 'ANY_STATE' }, evidence
  }));
  code('KSTACK_INSTALLER_HANDOFF_INVALID', () => createInstallerHandoff({
    mode: 'INITIAL', candidate, preflightRequest: request,
    initialStateEvidence: { ...evidence, priorActiveInstallReceiptDigest: D('1'), bogusExtraKey: 'forged' }
  }));
  code('KSTACK_INSTALLER_HANDOFF_INVALID', () => createInstallerHandoff({ mode: 'INITIAL', candidate, initialStateEvidence: evidence }));
});

test('PRESERVE binds exact install context and MIGRATE binds proposal plus authorization', () => {
  const renderBundle = {
    schemaId: 'kstack.render-bundle.v1', schemaVersion: 1, registrySetDigest: D('a'),
    sourceBundleDigest: D('1'), clauseInventoryDigest: D('2'), projectionPlanDigest: D('3'),
    resolverSchemaVersion: '1', resolverImplementationDigest: D('4'), targetId: 'opencode', platformProfile: 'linux-x64',
    projectionMapDigest: D('6'), unsupported: [],
    members: [{ path: 'SKILL.md', role: 'SKILL_ENTRY', mediaTypeId: 'text-markdown', byteLength: '4', contentDigest: D('5'), sourceMemberDigest: D('4') }]
  };
  const historicalResolution = {
    schemaId: 'kstack.historical-resolution.v1', schemaVersion: 1,
    registrySetDigest: D('a'), sourceBundleDigest: D('1'), clauseInventoryDigest: D('2'), projectionPlanDigest: D('3'),
    renderBundleDigest: addressObject(HOST_PACKAGE_DOMAINS.renderBundle, renderBundle), projectionMapDigest: D('6'),
    reuseAdmissionDigests: [], resolverSchemaVersion: '1', resolverImplementationDigest: D('4')
  };
  const { candidate } = createInstallerCandidate({
    registrySetDigest: D('a'), historicalResolutionDigest: addressObject(HOST_PACKAGE_DOMAINS.historicalResolution, historicalResolution),
    renderBundleDigest: addressObject(HOST_PACKAGE_DOMAINS.renderBundle, renderBundle),
    targetId: 'opencode', platformProfile: 'linux-x64', intendedScope: 'PROJECT', destinationTemplateId: 'project-skills'
  });
  const manifest = {
    schemaId: 'kstack.installed-member-manifest.v1', schemaVersion: 1,
    registrySetDigest: candidate.registrySetDigest, targetId: candidate.targetId,
    platformProfile: candidate.platformProfile, scope: candidate.intendedScope,
    destinationTemplateId: candidate.destinationTemplateId, installationRootIdentityDigest: D('4'),
    members: [{ path: 'SKILL.md', byteLength: '4', contentDigest: D('5'), fileIdentityDigest: D('6') }]
  };
  const baseline = {
    schemaId: 'kstack.preservation-baseline.v1', schemaVersion: 1,
    registrySetDigest: candidate.registrySetDigest, targetId: candidate.targetId,
    platformProfile: candidate.platformProfile,
    installedMemberManifestDigest: addressObject(HOST_PACKAGE_DOMAINS.installedMemberManifest, manifest),
    healthRecordDigest: D('7'), historicalResolutionDigest: candidate.historicalResolutionDigest, ownerDecisionDigest: D('8')
  };
  const preserveInputs = {
    mode: 'PRESERVE', candidate, baseline, baselineInstalledManifest: manifest,
    baselineHistoricalResolution: historicalResolution, baselineHistoricalRenderBundle: renderBundle, candidateRenderBundle: renderBundle
  };
  const preserve = createInstallerHandoff(preserveInputs);
  assert.equal(preserve.handoff.mode, 'PRESERVE');
  code('PRESERVATION_BASELINE_MISMATCH', () => createInstallerHandoff({
    ...preserveInputs, baselineInstalledManifest: { ...manifest, destinationTemplateId: 'other-template' }
  }));
  for (const [key, value] of [['registrySetDigest', D('f')], ['targetId', 'claude'], ['platformProfile', 'win32-x64']]) {
    code('PRESERVATION_BASELINE_MISMATCH', () => createInstallerHandoff({
      ...preserveInputs, baselineInstalledManifest: { ...manifest, [key]: value }
    }));
  }
  code('PRESERVATION_BASELINE_MISMATCH', () => createInstallerHandoff({
    ...preserveInputs,
    candidateRenderBundle: { ...renderBundle, members: [{ ...renderBundle.members[0], contentDigest: D('9') }] }
  }));
  code('PRESERVATION_BASELINE_MISMATCH', () => createInstallerHandoff({
    ...preserveInputs, candidate: { ...candidate, historicalResolutionDigest: D('0') }
  }));
  const foreignHistory = { ...historicalResolution, registrySetDigest: D('f') };
  const foreignHistoryDigest = addressObject(HOST_PACKAGE_DOMAINS.historicalResolution, foreignHistory);
  code('PRESERVATION_BASELINE_MISMATCH', () => createInstallerHandoff({
    ...preserveInputs,
    candidate: { ...candidate, historicalResolutionDigest: foreignHistoryDigest },
    baseline: { ...baseline, historicalResolutionDigest: foreignHistoryDigest },
    baselineHistoricalResolution: foreignHistory
  }));

  const migrationRenderBundle = {
    ...renderBundle,
    members: [{ ...renderBundle.members[0], byteLength: '5', contentDigest: D('9') }]
  };
  const { candidate: migrationCandidate } = createInstallerCandidate({
    registrySetDigest: candidate.registrySetDigest, historicalResolutionDigest: candidate.historicalResolutionDigest,
    renderBundleDigest: addressObject(HOST_PACKAGE_DOMAINS.renderBundle, migrationRenderBundle),
    targetId: candidate.targetId, platformProfile: candidate.platformProfile,
    intendedScope: candidate.intendedScope, destinationTemplateId: candidate.destinationTemplateId
  });
  const baselineDigest = addressObject(HOST_PACKAGE_DOMAINS.preservationBaseline, baseline);
  const candidateDigest = addressObject(HOST_PACKAGE_DOMAINS.installerCandidate, migrationCandidate);
  const proposal = {
    schemaId: 'kstack.preservation-migration-proposal.v1', schemaVersion: 1,
    registrySetDigest: migrationCandidate.registrySetDigest, fromBaselineDigest: baselineDigest,
    installerCandidateDigest: candidateDigest,
    differences: [{ path: 'SKILL.md', change: 'CHANGE', oldDigest: D('5'), newDigest: D('9'), reason: 'canonical projection update' }],
    requiredTestEvidenceDigests: [D('a')]
  };
  const proposalDigest = addressObject(HOST_PACKAGE_DOMAINS.migrationProposal, proposal);
  const authorization = {
    schemaId: 'kstack.preservation-migration-authorization.v1', schemaVersion: 1,
    registrySetDigest: migrationCandidate.registrySetDigest, migrationProposalDigest: proposalDigest,
    ownerPrincipalDigest: D('b'), decision: 'APPROVE', riskAcknowledgementDigest: D('c'), protectedDecisionReceiptDigest: D('d')
  };
  const migrateInputs = {
    mode: 'MIGRATE', candidate: migrationCandidate, baseline, baselineInstalledManifest: manifest,
    candidateRenderBundle: migrationRenderBundle, migrationProposal: proposal, migrationAuthorization: authorization
  };
  const migrate = createInstallerHandoff(migrateInputs);
  assert.equal(migrate.handoff.migrationProposalDigest, proposalDigest);
  code('KSTACK_INSTALLER_HANDOFF_INVALID', () => createInstallerHandoff({
    ...migrateInputs, migrationAuthorization: { ...authorization, decision: 'REJECT' }
  }));
  for (const forgedProposal of [
    { ...proposal, schemaId: 'forged.proposal.v1' },
    { ...proposal, differences: [] },
    { ...proposal, requiredTestEvidenceDigests: [] }
  ]) code('KSTACK_INSTALLER_HANDOFF_INVALID', () => createInstallerHandoff({ ...migrateInputs, migrationProposal: forgedProposal }));
  code('KSTACK_INSTALLER_HANDOFF_INVALID', () => createInstallerHandoff({
    ...migrateInputs,
    migrationAuthorization: { ...authorization, ownerPrincipalDigest: 'anyone', riskAcknowledgementDigest: null }
  }));
  code('KSTACK_INSTALLER_HANDOFF_INVALID', () => createInstallerHandoff({
    ...migrateInputs,
    baselineInstalledManifest: { ...manifest, scope: 'USER', destinationTemplateId: 'user-skills' }
  }));
});

test('content-addressed output ordering uses UTF-8 bytes rather than locale collation', () => {
  assert.equal(Math.sign('a-b.md'.localeCompare('a_b.md')), 1, 'fixture must distinguish locale and UTF-8 order');
  const admission = admitted();
  const base = planFor(admission);
  const plan = {
    ...base,
    resourceDispositions: base.resourceDispositions.map((row) => row.sourcePath.endsWith('/SKILL.src.md')
      ? { ...row, outputPath: 'a-b.md' }
      : row.sourcePath.endsWith('/reference.src.md') ? { ...row, outputPath: 'a_b.md' } : row)
  };
  const rendered = renderSourcePackage({ admission, plan, resolverSchemaVersion: '1', resolverImplementationDigest: D('8'), platformProfile: 'linux-x64' });
  assert.deepEqual(rendered.renderBundle.members.map((member) => member.path), ['LICENSE', 'a-b.md', 'a_b.md']);
});

test('manifest, health, baseline, migration proposal, and authorization construct strictly forward', () => {
  const installed = createInstalledMemberManifest({
    registrySetDigest: D('1'), targetId: 'codex', platformProfile: 'linux-x64', scope: 'PROJECT',
    destinationTemplateId: 'project-skills', installationRootIdentityDigest: D('2'),
    members: [{ path: 'SKILL.md', byteLength: '4', contentDigest: D('3'), fileIdentityDigest: D('4') }]
  });
  const health = createHealthRecord({
    registrySetDigest: D('1'), targetId: 'codex', platformProfile: 'linux-x64',
    installedMemberManifestDigest: installed.installedMemberManifestDigest, testSuiteDigest: D('5'),
    results: [
      { testObligationId: 'canonical-json', outcome: 'PASS', evidenceDigests: [D('6')] },
      { testObligationId: 'installer-handoff', outcome: 'PASS', evidenceDigests: [D('7')] }
    ]
  });
  assert.equal(health.healthRecord.overall, 'PASS');
  const preserved = createPreservationBaseline({
    manifest: installed.manifest, healthRecord: health.healthRecord,
    historicalResolutionDigest: D('8'), ownerDecisionDigest: D('9')
  });
  assert.equal(preserved.baseline.installedMemberManifestDigest, installed.installedMemberManifestDigest);
  assert.equal(preserved.baseline.healthRecordDigest, health.healthRecordDigest);

  const candidateRenderBundle = {
    schemaId: 'kstack.render-bundle.v1', schemaVersion: 1,
    members: [
      { path: 'NEW.md', role: 'REFERENCE', mediaTypeId: 'text-markdown', byteLength: '2', contentDigest: D('a'), sourceMemberDigest: D('b') },
      { path: 'SKILL.md', role: 'SKILL_ENTRY', mediaTypeId: 'text-markdown', byteLength: '5', contentDigest: D('c'), sourceMemberDigest: D('d') }
    ]
  };
  const madeCandidate = createInstallerCandidate({
    registrySetDigest: D('1'), historicalResolutionDigest: D('8'),
    renderBundleDigest: addressObject(HOST_PACKAGE_DOMAINS.renderBundle, candidateRenderBundle),
    targetId: 'codex', platformProfile: 'linux-x64', intendedScope: 'PROJECT', destinationTemplateId: 'project-skills'
  });
  const proposed = createMigrationProposal({
    baseline: preserved.baseline, installedManifest: installed.manifest,
    candidate: madeCandidate.candidate, candidateRenderBundle,
    reasons: { 'NEW.md': 'new bounded reference', 'SKILL.md': 'canonical projection update' },
    requiredTestEvidenceDigests: [D('e')]
  });
  assert.deepEqual(proposed.proposal.differences.map((row) => [row.path, row.change]), [['NEW.md', 'ADD'], ['SKILL.md', 'CHANGE']]);
  const authorized = createMigrationAuthorization({
    registrySetDigest: D('1'), migrationProposalDigest: proposed.migrationProposalDigest,
    ownerPrincipalDigest: D('f'), decision: 'APPROVE', riskAcknowledgementDigest: D('0'), protectedDecisionReceiptDigest: D('1')
  });
  const handoff = createInstallerHandoff({
    mode: 'MIGRATE', candidate: madeCandidate.candidate, baseline: preserved.baseline,
    baselineInstalledManifest: installed.manifest, candidateRenderBundle,
    migrationProposal: proposed.proposal, migrationAuthorization: authorized.authorization
  });
  assert.equal(handoff.handoff.migrationAuthorizationDigest, authorized.migrationAuthorizationDigest);
  code('KSTACK_PRESERVATION_MIGRATION_INVALID', () => createMigrationProposal({
    baseline: preserved.baseline, installedManifest: installed.manifest,
    candidate: madeCandidate.candidate, candidateRenderBundle,
    reasons: { 'SKILL.md': 'missing ADD reason' }, requiredTestEvidenceDigests: [D('e')]
  }));
  code('KSTACK_PRESERVATION_MIGRATION_INVALID', () => createMigrationProposal({
    baseline: preserved.baseline, installedManifest: { ...installed.manifest, targetId: 'claude' },
    candidate: madeCandidate.candidate, candidateRenderBundle,
    reasons: { 'NEW.md': 'new bounded reference', 'SKILL.md': 'canonical projection update' }, requiredTestEvidenceDigests: [D('e')]
  }));
  code('KSTACK_PRESERVATION_MIGRATION_AUTHORIZATION_INVALID', () => createMigrationAuthorization({
    registrySetDigest: D('1'), migrationProposalDigest: proposed.migrationProposalDigest,
    ownerPrincipalDigest: D('f'), decision: 'APPROVE', riskAcknowledgementDigest: null, protectedDecisionReceiptDigest: D('1')
  }));
});

test('historical resolution recomputes every object binding and requires an installed resolver allowlist entry', () => {
  const admission = admitted();
  const projectionPlan = planFor(admission);
  const rendered = renderSourcePackage({ admission, plan: projectionPlan, resolverSchemaVersion: '1', resolverImplementationDigest: D('2'), platformProfile: 'linux-x64' });
  const common = {
    historicalResolution: rendered.historicalResolution, registrySetDigest: admission.registrySetDigest,
    sourceBundle: admission.sourceBundle, clauseInventory: admission.clauseInventory,
    projectionPlan, renderBundle: rendered.renderBundle, projectionMap: rendered.projectionMap,
    renderMemberBytes: rendered.memberBytes
  };
  const verified = verifyHistoricalResolution({
    ...common,
    resolverAllowlist: [{ schemaVersion: '1', implementationDigest: D('2') }]
  });
  assert.equal(verified.verified, true);
  assert.equal(verified.opaqueExecutionAllowed, false);
  for (const reuseAdmissionDigests of [null, {}, 'not-an-array', [D('1'), D('0')], [D('1'), D('1')], ['not-a-digest']]) {
    code('KSTACK_HISTORICAL_RESOLUTION_INVALID', () => verifyHistoricalResolution({
      ...common,
      historicalResolution: { ...rendered.historicalResolution, reuseAdmissionDigests },
      resolverAllowlist: [{ schemaVersion: '1', implementationDigest: D('2') }]
    }));
  }
  code('HISTORICAL_RESOLVER_UNAVAILABLE', () => verifyHistoricalResolution({
    ...common,
    historicalResolution: { ...rendered.historicalResolution, reuseAdmissionDigests: [D('1')] },
    resolverAllowlist: [{ schemaVersion: '1', implementationDigest: D('2') }]
  }));
  for (const key of ['sourceBundle', 'clauseInventory', 'projectionPlan', 'renderBundle', 'projectionMap']) {
    const foreign = { ...common[key], registrySetDigest: D('f') };
    const digestKey = ({ sourceBundle: 'sourceBundleDigest', clauseInventory: 'clauseInventoryDigest', projectionPlan: 'projectionPlanDigest', renderBundle: 'renderBundleDigest', projectionMap: 'projectionMapDigest' })[key];
    code('HISTORICAL_RESOLVER_UNAVAILABLE', () => verifyHistoricalResolution({
      ...common,
      [key]: foreign,
      historicalResolution: { ...rendered.historicalResolution, [digestKey]: addressObject(HOST_PACKAGE_DOMAINS[({ sourceBundle: 'sourceBundle', clauseInventory: 'clauseInventory', projectionPlan: 'projectionPlan', renderBundle: 'renderBundle', projectionMap: 'projectionMap' })[key]], foreign) },
      resolverAllowlist: [{ schemaVersion: '1', implementationDigest: D('2') }]
    }));
  }
  code('KSTACK_HISTORICAL_RESOLUTION_INVALID', () => verifyHistoricalResolution({
    ...common,
    sourceBundle: { ...admission.sourceBundle, reuseAdmissionDigests: null },
    historicalResolution: { ...rendered.historicalResolution, sourceBundleDigest: addressObject(HOST_PACKAGE_DOMAINS.sourceBundle, { ...admission.sourceBundle, reuseAdmissionDigests: null }) },
    resolverAllowlist: [{ schemaVersion: '1', implementationDigest: D('2') }]
  }));
  code('HISTORICAL_RESOLVER_UNAVAILABLE', () => verifyHistoricalResolution({
    ...common, renderMemberBytes: { ...rendered.memberBytes, LICENSE: Buffer.from('tampered\n') },
    resolverAllowlist: [{ schemaVersion: '1', implementationDigest: D('2') }]
  }));
  code('HISTORICAL_RESOLVER_UNAVAILABLE', () => verifyHistoricalResolution({
    ...common,
    resolverAllowlist: []
  }));
});
