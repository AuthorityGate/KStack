import assert from 'node:assert/strict';
import { builtinModules } from 'node:module';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runBoundedResolverBatch, runResolverConformance } from '../plugins/kstack/scripts/reflexion-architecture/resolver-client.mjs';

const SUPPORTED_SUFFIXES = new Set(['.mjs', '.js', '.cjs']);
const BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
const AMBIENT_CAPABILITIES = Object.freeze([
  'Buffer', 'Function', 'Reflect', 'TextDecoder', 'TextEncoder', 'URL', 'WebAssembly',
  '__dirname', '__filename', 'clearInterval', 'clearTimeout', 'console', 'eval', 'fetch',
  'globalThis', 'module', 'performance', 'process', 'require', 'setInterval', 'setTimeout',
  'structuredClone'
]);
const IMPORT_MANIFEST = new Map([
  ['kstack-checkpoint.mjs', ['node:crypto']],
  ['kstack-citation-admin.mjs', ['node:fs','node:path','node:url','./kstack-config.mjs','./kstack-provider-runner.mjs','./kstack-review-schema.mjs','./kstack-citation-runtime.mjs','./kstack-dual-review.mjs']],
  ['kstack-citation-grounding.mjs', ['node:crypto']],
  ['kstack-citation-native.mjs', ['node:crypto','node:fs','node:os','node:path','node:url','node:worker_threads','node:child_process','./kstack-citation-state.mjs','node:module']],
  ['kstack-citation-runtime.mjs', ['node:crypto','node:fs','node:os','node:path','node:child_process','node:child_process','node:worker_threads','./kstack-citation-state.mjs','./kstack-citation-native.mjs','./kstack-citation-grounding.mjs']],
  ['kstack-citation-state.mjs', ['node:crypto','node:fs','node:path','./secret-broker/config-document-v2.mjs']],
  ['kstack-config.mjs', ['node:fs','node:path','node:url','./kstack-provider-runner.mjs','./secret-broker/config-document-v2.mjs','./secret-broker/config-v2.mjs']],
  ['kstack-design-gate.mjs', ['node:fs','node:path','node:url','./kstack-config.mjs','./kstack-review-schema.mjs','./kstack-citation-grounding.mjs','./kstack-secondary-review-policy.mjs','./kstack-workflow-contract.mjs','./kstack-staged-review.mjs']],
  ['kstack-design-lineage.mjs', ['node:fs','node:url']],
  ['kstack-domain-acquisition.mjs', ['node:crypto','node:fs/promises','node:fs','node:path','./kstack-domain-schema.mjs']],
  ['kstack-domain-activation.mjs', ['node:crypto','./kstack-domain-identity.mjs','./kstack-domain-separation.mjs','./kstack-domain-time-binding.mjs','./kstack-domain-selection.mjs','./kstack-domain-schema.mjs']],
  ['kstack-domain-budget.mjs', ['node:crypto','./kstack-domain-selection.mjs','./kstack-domain-schema.mjs']],
  ['kstack-domain-catalog.mjs', ['node:crypto','./kstack-host-profile.mjs']],
  ['kstack-domain-evaluation.mjs', ['node:crypto']],
  ['kstack-domain-identity.mjs', ['node:crypto','./kstack-host-contract.mjs']],
  ['kstack-domain-pack-candidates.mjs', ['node:fs/promises','node:path','node:url','node:crypto','./kstack-domain-schema.mjs','./kstack-domain-evaluation.mjs']],
  ['kstack-domain-result-broker.mjs', ['node:crypto','./kstack-host-contract.mjs','./kstack-domain-selection.mjs','./kstack-domain-result.mjs','./kstack-domain-schema.mjs']],
  ['kstack-domain-result.mjs', ['node:crypto','./kstack-host-contract.mjs','./kstack-domain-selection.mjs','./kstack-domain-schema.mjs','./kstack-domain-time-binding.mjs']],
  ['kstack-domain-schema.mjs', ['node:crypto','./kstack-domain-time-binding.mjs']],
  ['kstack-domain-selection.mjs', ['node:crypto','./kstack-host-contract.mjs','./kstack-domain-identity.mjs']],
  ['kstack-domain-separation.mjs', ['node:crypto','./kstack-host-contract.mjs','./kstack-domain-identity.mjs']],
  ['kstack-domain-time-binding.mjs', []],
  ['kstack-domain-time.mjs', ['node:crypto','./kstack-domain-schema.mjs']],
  ['kstack-dual-review.mjs', ['node:crypto','node:fs','node:path','node:url','./kstack-config.mjs','./kstack-provider-runner.mjs','./kstack-review-schema.mjs','./kstack-citation-grounding.mjs','./kstack-citation-state.mjs','./kstack-citation-runtime.mjs']],
  ['kstack-experience.mjs', ['node:crypto','node:fs','node:path','node:url','./kstack-safety-matchers.mjs']],
  ['kstack-git-askpass.mjs', ['node:net']],
  ['kstack-goose-adapter.mjs', ['node:crypto','node:fs','node:path']],
  ['kstack-goose-conformance.mjs', ['./kstack-host-contract.mjs','./kstack-host-harness.mjs']],
  ['kstack-host-activation.mjs', ['./kstack-host-contract.mjs']],
  ['kstack-host-broker.mjs', ['./kstack-host-contract.mjs','./kstack-host-harness.mjs']],
  ['kstack-host-contract.mjs', ['node:crypto']],
  ['kstack-host-eligibility.mjs', ['./kstack-host-contract.mjs','./kstack-host-evidence.mjs']],
  ['kstack-host-evidence.mjs', ['node:crypto','./kstack-host-contract.mjs']],
  ['kstack-host-harness.mjs', ['./kstack-host-contract.mjs']],
  ['kstack-host-installer.mjs', ['./kstack-host-package.mjs']],
  ['kstack-host-migration.mjs', ['./kstack-host-contract.mjs']],
  ['kstack-host-mutation.mjs', ['./kstack-host-contract.mjs']],
  ['kstack-host-package.mjs', ['node:crypto']],
  ['kstack-host-profile.mjs', ['./kstack-host-package.mjs']],
  ['kstack-host-qualification.mjs', ['node:crypto']],
  ['kstack-host-receipt.mjs', ['./kstack-host-contract.mjs']],
  ['kstack-host-replay-store.mjs', ['node:crypto','node:fs','node:path','./kstack-host-contract.mjs','./kstack-host-replay.mjs']],
  ['kstack-host-replay.mjs', ['./kstack-host-contract.mjs','./kstack-host-request-context.mjs']],
  ['kstack-host-request-context.mjs', ['./kstack-host-contract.mjs']],
  ['kstack-host-request-replay.mjs', ['./kstack-host-contract.mjs']],
  ['kstack-install-health.mjs', ['node:crypto','node:fs','node:os','node:path','node:child_process','node:url']],
  ['kstack-invoke-role.mjs', ['node:crypto','node:fs','node:path','node:url','./kstack-config.mjs','./kstack-provider-runner.mjs']],
  ['kstack-jira-bootstrap.mjs', ['node:crypto','node:fs','node:fs/promises','node:os','node:path','node:readline/promises','node:url','./kstack-config.mjs','./secret-broker/config-document-v2.mjs','./secret-broker/config-migration-v2.mjs','./kstack-safety-broker.mjs','./kstack-jira.mjs','./kstack-provider-runner.mjs']],
  ['kstack-jira-tracking.mjs', ['node:crypto','node:fs','node:fs/promises','node:os','node:path','node:url','node:util','./kstack-safety-broker.mjs','./kstack-jira-bootstrap.mjs','./kstack-jira.mjs','./kstack-provider-runner.mjs']],
  ['kstack-jira-wsl-config.mjs', ['node:path','node:url','./kstack-config.mjs']],
  ['kstack-jira.mjs', ['node:crypto','node:fs','node:fs/promises','node:os','node:path','node:readline/promises','node:url','./kstack-config.mjs','./kstack-provider-runner.mjs']],
  ['kstack-kcrp-byte-benchmark.mjs', ['node:util','./kstack-kcrp-core.mjs','./kstack-kcrp-dispatch-manifest.mjs','./kstack-kcrp-json.mjs']],
  ['kstack-kcrp-core.mjs', ['./kstack-kcrp-json.mjs']],
  ['kstack-kcrp-dispatch-manifest.mjs', ['./kstack-kcrp-json.mjs','./kstack-kcrp-core.mjs','node:util']],
  ['kstack-kcrp-json.mjs', ['node:crypto']],
  ['kstack-kcrp-provider-trial.mjs', ['node:crypto','./kstack-domain-evaluation.mjs','./kstack-safety-matchers.mjs']],
  ['kstack-linux-observation-admit.mjs', ['node:crypto','node:fs','node:path','node:url','./kstack-linux-qualification.mjs','./kstack-linux-qualification-bundle.mjs','./kstack-safety-matchers.mjs']],
  ['kstack-linux-qualification-bundle.mjs', ['node:crypto','node:fs','node:path','node:url','./kstack-linux-qualification.mjs','./kstack-safety-matchers.mjs']],
  ['kstack-linux-qualification.mjs', ['node:crypto']],
  ['kstack-mcp-boundary.mjs', ['node:crypto','./kstack-host-contract.mjs']],
  ['kstack-memory.mjs', ['node:crypto','node:fs','node:os','node:path','node:child_process','node:url','@electric-sql/pglite','./kstack-config.mjs','./kstack-review-schema.mjs']],
  ['kstack-opencode-adapter.mjs', ['node:crypto','node:fs','node:path']],
  ['kstack-opencode-candidate.mjs', ['node:crypto','./kstack-host-package.mjs','./kstack-host-installer.mjs']],
  ['kstack-opencode-conformance.mjs', ['./kstack-host-contract.mjs','./kstack-host-harness.mjs']],
  ['kstack-panel-core.mjs', ['node:crypto','node:fs','node:path','./kstack-safety-matchers.mjs']],
  ['kstack-panel-personas.mjs', ['node:fs','node:path','node:url','./kstack-panel-core.mjs']],
  ['kstack-panel.mjs', ['node:crypto','node:fs','node:path','node:child_process','node:url','./kstack-config.mjs','./kstack-safety-matchers.mjs','./kstack-provider-runner.mjs','./kstack-panel-core.mjs','./kstack-panel-personas.mjs']],
  ['kstack-planning-lens-core.mjs', ['node:crypto','node:fs','node:path','./kstack-safety-matchers.mjs']],
  ['kstack-planning-lens-trial.mjs', ['node:fs','node:path','node:url','./kstack-config.mjs','./kstack-planning-lens-core.mjs']],
  ['kstack-post-deploy.mjs', ['node:crypto','node:fs','node:path','node:child_process','node:module','node:url','./kstack-safety-matchers.mjs','./kstack-jira.mjs','./kstack-jira-tracking.mjs','./kstack-experience.mjs']],
  ['kstack-provider-runner.mjs', ['node:fs','node:child_process','./kstack-safety-matchers.mjs','./kstack-safety-matchers.mjs']],
  ['kstack-reflexion.mjs', ['node:crypto','node:fs','node:os','node:path','node:child_process','node:url','./kstack-config.mjs','./kstack-memory.mjs','./reflexion/retrieval-core.mjs','./reflexion/corpus-io.mjs','./reflexion/prompt-assembler.mjs','./reflexion/unavailable-sentinel.mjs','./reflexion/runtime-profile.mjs','./reflexion-architecture/resolver-client.mjs']],
  ['kstack-review-measurement.mjs', []],
  ['kstack-review-schema.mjs', ['node:crypto']],
  ['kstack-safety-admin.mjs', ['node:crypto','node:fs','node:path','node:url','./kstack-safety-hook.mjs','./kstack-safety-executor.mjs','./secret-broker/config-document-v2.mjs']],
  ['kstack-safety-broker.mjs', ['node:crypto','node:fs','node:path','node:child_process','./kstack-safety-matchers.mjs','./kstack-safety-executor.mjs']],
  ['kstack-safety-executor.mjs', ['node:fs','node:os','node:path','node:child_process','node:url','./kstack-safety-matchers.mjs']],
  ['kstack-safety-hook.mjs', ['node:fs','node:crypto','node:path','node:url','./kstack-safety-matchers.mjs','./secret-broker/config-document-v2.mjs']],
  ['kstack-safety-matchers.mjs', []],
  ['kstack-safety-worker.mjs', ['node:crypto','node:fs','node:fs/promises','node:net','node:os','node:path','node:child_process','node:url']],
  ['kstack-second-host-proof.mjs', ['node:crypto']],
  ['kstack-secondary-review-policy.mjs', ['node:crypto']],
  ['kstack-secret-broker.mjs', ['node:crypto','node:fs','node:path','node:url','./kstack-safety-broker.mjs','./kstack-safety-matchers.mjs','./secret-broker/public-v1.mjs']],
  ['kstack-secret-linux.mjs', ['node:crypto','node:fs','node:http','node:https','node:os','node:path','node:child_process','node:url']],
  ['kstack-staged-review.mjs', ['node:crypto','node:fs','node:path','node:url','./kstack-config.mjs','./kstack-provider-runner.mjs','./kstack-review-schema.mjs','./kstack-secondary-review-policy.mjs','./kstack-workflow-contract.mjs']],
  ['kstack-windows-copy.mjs', ['node:fs','node:path','node:url']],
  ['kstack-work-envelope.mjs', ['node:crypto']],
  ['kstack-workflow-contract.mjs', ['node:crypto','node:fs','node:path','node:url']],
  ['reflexion-architecture/entry-probe.mjs', []],
  ['reflexion-architecture/resolver-client.mjs', ['node:child_process','node:crypto','node:fs','node:os','node:path','node:url']],
  ['reflexion-architecture/resolver-driver.mjs', ['./entry-probe.mjs','./unicode-oracle.mjs']],
  ['reflexion-architecture/unicode-oracle.mjs', ['node:crypto','../reflexion/normalization.mjs']],
  ['reflexion/corpus-boundary.mjs', ['./normalization.mjs']],
  ['reflexion/corpus-io.mjs', ['node:crypto','node:fs','node:path','./corpus-boundary.mjs']],
  ['reflexion/normalization.mjs', []],
  ['reflexion/prompt-assembler.mjs', []],
  ['reflexion/retrieval-core.mjs', ['./normalization.mjs','./normalization.mjs']],
  ['reflexion/runtime-profile.mjs', []],
  ['reflexion/termination-contract.mjs', ['node:crypto']],
  ['reflexion/termination-native.mjs', ['node:child_process','node:util']],
  ['reflexion/termination-schema.mjs', ['node:crypto','./termination-contract.mjs']],
  ['reflexion/termination-supervisor.mjs', ['node:crypto','./termination-contract.mjs','./termination-schema.mjs']],
  ['reflexion/unavailable-sentinel.mjs', ['node:fs','node:path','node:url','./runtime-profile.mjs']],
  ['secret-broker/compatibility-v1.mjs', ['../kstack-host-contract.mjs','./public-v1.mjs']],
  ['secret-broker/config-document-v2.mjs', ['../kstack-host-contract.mjs','./config-v2.mjs']],
  ['secret-broker/config-migration-v2.mjs', ['node:crypto','node:fs','node:os','node:path','../kstack-host-contract.mjs','../kstack-config.mjs','./config-document-v2.mjs','./config-v2.mjs']],
  ['secret-broker/config-v2.mjs', ['../kstack-host-contract.mjs','./public-v1.mjs']],
  ['secret-broker/control-plane-v1.mjs', ['node:crypto']],
  ['secret-broker/public-v1.mjs', ['node:crypto','../kstack-host-contract.mjs','../kstack-safety-matchers.mjs']],
  ['secret-broker/release-manifest-v1.mjs', ['node:crypto','node:fs','node:path','../kstack-host-contract.mjs']],
  ['secret-broker/release-provenance-v1.mjs', ['node:crypto','../kstack-host-contract.mjs']],
  ['secret-broker/synthetic-protected-state-v1.mjs', ['node:crypto','node:fs','node:path','./control-plane-v1.mjs']]
]);
const CAPABILITY_TOKEN_MANIFEST = new Map([
  ['kstack-checkpoint.mjs', {Buffer:13,crypto:5,require:1,structuredClone:7}],
  ['kstack-citation-admin.mjs', {Buffer:1,fileURLToPath:2,fs:12,path:16,process:9}],
  ['kstack-citation-grounding.mjs', {Buffer:25,TextDecoder:1,crypto:3}],
  ['kstack-citation-native.mjs', {Buffer:29,URL:1,Worker:2,clearTimeout:2,crypto:7,fileURLToPath:2,fs:76,importedCreateRequire:2,module:1,os:4,path:39,process:17,setTimeout:2,spawn:2,structuredClone:1}],
  ['kstack-citation-runtime.mjs', {Buffer:15,URL:2,Worker:2,clearTimeout:2,crypto:13,fs:133,os:6,path:47,process:14,require:1,setTimeout:2,spawn:3,spawnSync:3,structuredClone:1}],
  ['kstack-citation-state.mjs', {Buffer:23,TextDecoder:2,crypto:7,fs:7,path:7,process:1,structuredClone:3}],
  ['kstack-config.mjs', {Buffer:1,URL:5,console:4,fetch:2,fileURLToPath:2,fs:8,path:49,process:11}],
  ['kstack-design-gate.mjs', {console:1,fileURLToPath:2,fs:22,path:18,process:7}],
  ['kstack-design-lineage.mjs', {fileURLToPath:2,fs:10,process:11,structuredClone:1}],
  ['kstack-domain-acquisition.mjs', {Buffer:4,crypto:4,fs:7,fsConstants:3,path:25,performance:1,process:2}],
  ['kstack-domain-activation.mjs', {Buffer:3,crypto:4}],
  ['kstack-domain-budget.mjs', {Buffer:20,TextDecoder:2,crypto:5}],
  ['kstack-domain-catalog.mjs', {Buffer:17,crypto:3}],
  ['kstack-domain-evaluation.mjs', {Buffer:12,crypto:5}],
  ['kstack-domain-identity.mjs', {Buffer:7,crypto:5}],
  ['kstack-domain-pack-candidates.mjs', {Buffer:6,TextDecoder:1,crypto:3,fileURLToPath:3,fs:11,path:15,process:5}],
  ['kstack-domain-result-broker.mjs', {Buffer:9,crypto:5}],
  ['kstack-domain-result.mjs', {Buffer:17,crypto:9}],
  ['kstack-domain-schema.mjs', {Buffer:37,TextDecoder:1,crypto:7}],
  ['kstack-domain-selection.mjs', {Buffer:12,crypto:4}],
  ['kstack-domain-separation.mjs', {Buffer:13,crypto:5}],
  ['kstack-domain-time-binding.mjs', {}],
  ['kstack-domain-time.mjs', {Buffer:13,TextDecoder:3,crypto:3}],
  ['kstack-dual-review.mjs', {Buffer:2,console:2,crypto:5,fileURLToPath:2,fs:21,path:26,process:10,structuredClone:1}],
  ['kstack-experience.mjs', {Buffer:6,crypto:3,fileURLToPath:2,fs:17,path:21,performance:34,process:8}],
  ['kstack-git-askpass.mjs', {Buffer:1,net:3,process:9,setTimeout:1}],
  ['kstack-goose-adapter.mjs', {Buffer:4,URL:1,crypto:3,fs:4,path:5,structuredClone:2}],
  ['kstack-goose-conformance.mjs', {}],
  ['kstack-host-activation.mjs', {}],
  ['kstack-host-broker.mjs', {}],
  ['kstack-host-contract.mjs', {Buffer:23,TextDecoder:1,crypto:4,structuredClone:3}],
  ['kstack-host-eligibility.mjs', {}],
  ['kstack-host-evidence.mjs', {Buffer:19,crypto:12}],
  ['kstack-host-harness.mjs', {process:1}],
  ['kstack-host-installer.mjs', {Buffer:5}],
  ['kstack-host-migration.mjs', {}],
  ['kstack-host-mutation.mjs', {Buffer:1}],
  ['kstack-host-package.mjs', {Buffer:32,TextDecoder:3,crypto:3}],
  ['kstack-host-profile.mjs', {}],
  ['kstack-host-qualification.mjs', {crypto:3}],
  ['kstack-host-receipt.mjs', {}],
  ['kstack-host-replay-store.mjs', {Buffer:1,crypto:6,fs:57,path:16,process:6,structuredClone:20}],
  ['kstack-host-replay.mjs', {Buffer:4,structuredClone:1}],
  ['kstack-host-request-context.mjs', {Buffer:1,structuredClone:1}],
  ['kstack-host-request-replay.mjs', {structuredClone:1}],
  ['kstack-install-health.mjs', {Buffer:14,crypto:6,fs:49,module:1,os:5,path:88,pathToFileURL:2,process:27,spawnSync:4}],
  ['kstack-invoke-role.mjs', {console:2,crypto:3,fileURLToPath:2,fs:10,path:12,process:6,structuredClone:1}],
  ['kstack-jira-bootstrap.mjs', {Buffer:10,URL:2,crypto:7,fileURLToPath:2,fs:18,fsp:22,os:4,path:14,process:17,readline:3,structuredClone:1}],
  ['kstack-jira-tracking.mjs', {Buffer:17,crypto:7,fileURLToPath:2,fs:28,fsp:28,isDeepStrictEqual:3,os:6,path:36,process:32,setTimeout:2}],
  ['kstack-jira-wsl-config.mjs', {fileURLToPath:2,path:6,process:6}],
  ['kstack-jira.mjs', {Buffer:6,TextDecoder:1,clearInterval:4,crypto:9,fetch:2,fileURLToPath:2,fs:15,fsp:31,globalThis:1,os:3,path:42,process:24,readline:3,require:3,setInterval:1,setTimeout:1}],
  ['kstack-kcrp-byte-benchmark.mjs', {Buffer:5,Reflect:3,utilTypes:5}],
  ['kstack-kcrp-core.mjs', {Buffer:59,TextDecoder:2,TextEncoder:1}],
  ['kstack-kcrp-dispatch-manifest.mjs', {Buffer:8,utilTypes:6}],
  ['kstack-kcrp-json.mjs', {Buffer:8,TextDecoder:1,crypto:4}],
  ['kstack-kcrp-provider-trial.mjs', {Buffer:13,crypto:5}],
  ['kstack-linux-observation-admit.mjs', {Buffer:3,TextDecoder:2,crypto:3,fileURLToPath:2,fs:21,path:11,process:10}],
  ['kstack-linux-qualification-bundle.mjs', {Buffer:5,TextDecoder:1,crypto:3,fileURLToPath:2,fs:21,path:31,process:12}],
  ['kstack-linux-qualification.mjs', {Buffer:3,crypto:3}],
  ['kstack-mcp-boundary.mjs', {Buffer:26,TextDecoder:1,clearTimeout:1,crypto:8,setTimeout:1}],
  ['kstack-memory.mjs', {PGlite:2,TextDecoder:1,console:1,crypto:3,fetch:5,fileURLToPath:2,fs:28,os:3,path:50,process:7,spawnSync:4}],
  ['kstack-opencode-adapter.mjs', {Buffer:4,URL:1,crypto:3,fs:4,path:9,structuredClone:2}],
  ['kstack-opencode-candidate.mjs', {Buffer:28,TextDecoder:1,crypto:3,fetch:1}],
  ['kstack-opencode-conformance.mjs', {}],
  ['kstack-panel-core.mjs', {Buffer:8,TextDecoder:1,crypto:3,fs:10,path:7}],
  ['kstack-panel-personas.mjs', {Buffer:1,fileURLToPath:2,fs:10,path:11,require:1}],
  ['kstack-panel.mjs', {Buffer:10,TextDecoder:1,clearTimeout:1,crypto:5,fileURLToPath:2,fs:32,path:40,process:11,setTimeout:2,spawn:2,structuredClone:1}],
  ['kstack-planning-lens-core.mjs', {TextDecoder:1,URL:1,crypto:8,fs:42,path:84}],
  ['kstack-planning-lens-trial.mjs', {fileURLToPath:2,fs:4,path:10,process:8}],
  ['kstack-post-deploy.mjs', {Buffer:8,URL:3,console:4,createRequire:2,crypto:7,fileURLToPath:4,fs:37,module:1,path:60,performance:4,process:26,require:2,spawnSync:3}],
  ['kstack-provider-runner.mjs', {Buffer:1,clearTimeout:4,fs:21,process:4,setTimeout:4,spawn:4}],
  ['kstack-reflexion.mjs', {Buffer:7,crypto:5,fileURLToPath:4,fs:37,os:3,path:23,process:31,spawnSync:2}],
  ['kstack-review-measurement.mjs', {Buffer:3,process:1}],
  ['kstack-review-schema.mjs', {crypto:3}],
  ['kstack-safety-admin.mjs', {Buffer:1,TextDecoder:1,crypto:7,fileURLToPath:3,fs:34,path:19,process:10}],
  ['kstack-safety-broker.mjs', {Buffer:10,clearTimeout:1,crypto:12,fs:14,path:11,performance:4,process:2,setTimeout:1,spawnSync:2,structuredClone:3}],
  ['kstack-safety-executor.mjs', {Buffer:3,TextDecoder:2,URL:1,clearTimeout:2,fileURLToPath:2,fs:3,os:3,path:11,process:10,setTimeout:1,spawn:3}],
  ['kstack-safety-hook.mjs', {Buffer:5,TextDecoder:2,crypto:4,fileURLToPath:3,fs:14,path:23,process:11}],
  ['kstack-safety-matchers.mjs', {Buffer:2,TextDecoder:1}],
  ['kstack-safety-worker.mjs', {Buffer:10,TextDecoder:2,URL:2,clearTimeout:2,crypto:4,fileURLToPath:2,fs:9,fsp:37,net:3,os:3,path:31,process:18,setTimeout:1,spawn:3,spawnSync:3}],
  ['kstack-second-host-proof.mjs', {Buffer:3,crypto:3}],
  ['kstack-secondary-review-policy.mjs', {crypto:3,structuredClone:2}],
  ['kstack-secret-broker.mjs', {Buffer:6,URL:3,crypto:3,fileURLToPath:5,fs:11,path:6,process:12}],
  ['kstack-secret-linux.mjs', {Buffer:20,URL:1,crypto:19,fileURLToPath:2,fs:64,http:4,https:7,module:1,os:4,path:31,process:21,spawnSync:4}],
  ['kstack-staged-review.mjs', {Buffer:5,console:1,crypto:9,fileURLToPath:2,fs:114,path:75,process:27,structuredClone:1}],
  ['kstack-windows-copy.mjs', {fileURLToPath:2,fs:11,path:11,process:10}],
  ['kstack-work-envelope.mjs', {crypto:3}],
  ['kstack-workflow-contract.mjs', {Buffer:2,console:1,crypto:3,fileURLToPath:2,fs:6,path:7,process:6}],
  ['reflexion-architecture/entry-probe.mjs', {}],
  ['reflexion-architecture/resolver-client.mjs', {Buffer:6,TextDecoder:1,URL:2,clearTimeout:3,crypto:4,fs:18,module:3,os:3,path:28,pathToFileURL:9,process:2,setTimeout:3,spawn:2}],
  ['reflexion-architecture/resolver-driver.mjs', {Buffer:2,TextDecoder:1,URL:2,module:1,process:9}],
  ['reflexion-architecture/unicode-oracle.mjs', {Buffer:1,crypto:4,process:5}],
  ['reflexion/corpus-boundary.mjs', {Buffer:2,TextDecoder:1}],
  ['reflexion/corpus-io.mjs', {Buffer:2,TextDecoder:2,crypto:4,fs:48,path:18,process:7}],
  ['reflexion/normalization.mjs', {}],
  ['reflexion/prompt-assembler.mjs', {}],
  ['reflexion/retrieval-core.mjs', {Buffer:2}],
  ['reflexion/runtime-profile.mjs', {process:8}],
  ['reflexion/termination-contract.mjs', {crypto:3,process:5}],
  ['reflexion/termination-native.mjs', {execFile:2,promisify:2}],
  ['reflexion/termination-schema.mjs', {Buffer:8,TextDecoder:1,crypto:5,performance:3,require:1}],
  ['reflexion/termination-supervisor.mjs', {Buffer:3,crypto:5}],
  ['reflexion/unavailable-sentinel.mjs', {fileURLToPath:3,fs:19,path:14,process:22}],
  ['secret-broker/compatibility-v1.mjs', {Buffer:5}],
  ['secret-broker/config-document-v2.mjs', {Buffer:4,TextDecoder:1,fetch:1}],
  ['secret-broker/config-migration-v2.mjs', {Buffer:1,crypto:8,fs:68,os:4,path:21,process:5,structuredClone:5}],
  ['secret-broker/config-v2.mjs', {Buffer:2}],
  ['secret-broker/control-plane-v1.mjs', {Buffer:6,Reflect:2,TextDecoder:2,crypto:7}],
  ['secret-broker/public-v1.mjs', {Buffer:11,crypto:3}],
  ['secret-broker/release-manifest-v1.mjs', {Buffer:4,crypto:4,fs:7,path:34}],
  ['secret-broker/release-provenance-v1.mjs', {Buffer:8,crypto:5}],
  ['secret-broker/synthetic-protected-state-v1.mjs', {Buffer:5,Reflect:2,crypto:7,fs:38,path:12,process:7}]
]);
const IMPORT_META_MANIFEST = new Map([
  ['kstack-citation-admin.mjs',1], ['kstack-citation-native.mjs',3], ['kstack-citation-runtime.mjs',2],
  ['kstack-config.mjs',1], ['kstack-design-gate.mjs',1], ['kstack-design-lineage.mjs',1], ['kstack-dual-review.mjs',1],
  ['kstack-domain-pack-candidates.mjs',2],
  ['kstack-experience.mjs',1],
  ['kstack-invoke-role.mjs',1], ['kstack-jira-bootstrap.mjs',1], ['kstack-jira-tracking.mjs',1], ['kstack-jira-wsl-config.mjs',1], ['kstack-jira.mjs',1], ['kstack-memory.mjs',1],
  ['kstack-linux-observation-admit.mjs',1], ['kstack-linux-qualification-bundle.mjs',1],
  ['kstack-panel-personas.mjs',1], ['kstack-panel.mjs',1],
  ['kstack-planning-lens-trial.mjs',1], ['kstack-post-deploy.mjs',2],
  ['kstack-safety-admin.mjs',2], ['kstack-safety-executor.mjs',1], ['kstack-safety-hook.mjs',2], ['kstack-safety-worker.mjs',1],
  ['kstack-secret-broker.mjs',4], ['kstack-secret-linux.mjs',1],
  ['kstack-staged-review.mjs',1], ['kstack-windows-copy.mjs',2],
  ['kstack-workflow-contract.mjs',1],
  ['kstack-reflexion.mjs',3], ['reflexion-architecture/entry-probe.mjs',1],
  ['reflexion-architecture/resolver-driver.mjs',9], ['reflexion/unavailable-sentinel.mjs',2]
]);
const CAPABILITY_USE_SITE_MANIFEST = new Map([
  ['kstack-checkpoint.mjs','0eef20f6d93771a692bc76b7e541419bc93607d7ac4cbf6d72e8996ba67f9ff3'],
  ['kstack-citation-admin.mjs','0c7ea1e05de451470624e57649857a85856883b6ec938c579a91282b77d1ad86'],
  ['kstack-citation-grounding.mjs','97b828d143b208d13a733c295281abc21329310b961f06ac8e354787317f050e'],
  ['kstack-citation-native.mjs','75d36fcdb896cc6d69517b1fa5db8b6b3cfcd05424bb8a81d6408fc2867a7ed0'],
  ['kstack-citation-runtime.mjs','1139e542e11a3fba3b2a594eb0743d569dc2593c086c1247f230771a84e57002'],
  ['kstack-citation-state.mjs','711bd2c0f6581325321300cc69455160e9d97bd638199edca489f9b5693c65e5'],
  ['kstack-config.mjs','530a8f6dc0e1e92d489d3b87d8dabb0dcf53e2534daa55a1ee0387fa4f0a2cd3'],
  ['kstack-design-gate.mjs','e6c09081d7d1f71a1ec120d27416d43d6f4c38e45d7aebaae7ea2995e36969d2'],
  ['kstack-design-lineage.mjs','d39b32c602e7243fc81c465d539e9a9539fbc9de7374f380304ab2142669aa26'],
  ['kstack-domain-acquisition.mjs','b599afdb80c9cff80fec0161d31fa028a3ae28b1878a3d5bb4f5fd734da1ffc1'],
  ['kstack-domain-activation.mjs','b250c8304fa8db82dd318b755040dae255469d363ca5274aa4a8d6ffdd4a6662'],
  ['kstack-domain-budget.mjs','1501fb81067cff0d9d91e072c4568fdcf2a238b99b2ab3c4f33a6a1ffafca1f9'],
  ['kstack-domain-catalog.mjs','6f3dd655c0878bb6eff15e0d134b2a7838c650426b7e62d0d300e557aefb28cc'],
  ['kstack-domain-evaluation.mjs','7252565d563828c7dd3170fa6ee8da81a07edf6875b27a384ae97f2a888fee25'],
  ['kstack-domain-identity.mjs','a79d68603687614280b0bfd981dbb6edccd21303b71e0485ea495ab9f5598f17'],
  ['kstack-domain-pack-candidates.mjs','3a287ee8b63166a846f55eaec7e99f431df6f2931ebde0a3004a444d42ecf14c'],
  ['kstack-domain-result-broker.mjs','3b251a5f362c6e5e76b480a54de0582ae1731997ad4337c5da924614e637b295'],
  ['kstack-domain-result.mjs','6173f6d8fd34af3bda5a6c0589a042fe3db404eea8fa4c93d877c7a2530fa69a'],
  ['kstack-domain-schema.mjs','daa276b1bf068e6e4cae6237586d99e03ad9b5ebf65be692b742dde2d6d61506'],
  ['kstack-domain-selection.mjs','00a7a149e74a6ad8c593ca27c572492474e38ae02e9cfc221c22ebe1ed56ab57'],
  ['kstack-domain-separation.mjs','577c236fe454cb1c568e190008f2b4a208ccd91313481ca33c5f3551dde6062c'],
  ['kstack-domain-time-binding.mjs','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  ['kstack-domain-time.mjs','b44c123c66d7ebd6d3cdf9cb52c50563773c2018e78deed30f7c62a1b09cbf22'],
  ['kstack-dual-review.mjs','14a27d2afa963d7bf03671c5a1a8344f678e7c7ea904a1cb007f3a48f62bb9c1'],
  ['kstack-experience.mjs','cadbce9f757561246caae30a501bb9c01d5683120873b734fdffa1dd42e7925f'],
  ['kstack-git-askpass.mjs','7b5922e73f1602b6d4733de19183e9af8a3802eda2228682db6b1f040ea452c1'],
  ['kstack-goose-adapter.mjs','432d528ebf777d9102322ac56b673cf426b86dc6d975d0d02afe757b0c3ee8d8'],
  ['kstack-goose-conformance.mjs','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  ['kstack-host-activation.mjs','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  ['kstack-host-broker.mjs','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  ['kstack-host-contract.mjs','0477f2758369f1635ee0ea51df95e5566a71bc2f45517b3081dc14b83750580a'],
  ['kstack-host-eligibility.mjs','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  ['kstack-host-evidence.mjs','c560d2e81eb8fb45d95956611f0e3c6d0f47f16421c9b8a89e560ca2f9011326'],
  ['kstack-host-harness.mjs','f8962c22d883cf20d1e0482c1ebe8cc2148ce2840bdcd9fc281facba3c6b221e'],
  ['kstack-host-installer.mjs','28961b3248f94e63adca0a0b95d254933c71f9bb0ad647cb1fa534518abe6a28'],
  ['kstack-host-migration.mjs','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  ['kstack-host-mutation.mjs','e3dc2f92fe4bccb6dcaa440ca9b66bd58e706e92e9c0fce317f25620eb6f7fe8'],
  ['kstack-host-package.mjs','fd4987fd3bfc0eb92df9e4b4ef6d4f44e1cdda264479064455f37898651a86b5'],
  ['kstack-host-profile.mjs','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  ['kstack-host-qualification.mjs','dcac88135c86843d0fbee2e53b7faf05f132a4a33e74cf3d1befcfc61c4b428e'],
  ['kstack-host-receipt.mjs','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  ['kstack-host-replay-store.mjs','3ed06fa9f42029aed62d406d25d0f5da62f00dbb59bbcdf48cfdc4bb4d4ca265'],
  ['kstack-host-replay.mjs','ab455c17dfcfc22a868db7f2409d84c710fb6eac7f7c7f65e945b16916b5e1d0'],
  ['kstack-host-request-context.mjs','de29405db87415cd30d5049e8af49431451bade7b52250397c304048dfdf47d0'],
  ['kstack-host-request-replay.mjs','158ae58378ca5a8ddc54f199ab781980646eab982e9caf890132b013e453e707'],
  ['kstack-install-health.mjs','8f717810f7c0c88581f5471cf5ab1071f057266b7b3fd9853bf0364000ab172e'],
  ['kstack-invoke-role.mjs','9b116af71293ca87f43c32187b35d672ca01d5583febed489a720251bf561973'],
  ['kstack-jira-bootstrap.mjs','3021fd0061e71503a238f3e68c0a80020c8fa23f8b7d0e08f86a5215dc7d0781'],
  ['kstack-jira-tracking.mjs','d36cd11e3eaf9d2adce742fdd367bab76cce0fcd7de492f36042e85e98439867'],
  ['kstack-jira-wsl-config.mjs','fb70d2b525518ab58602200b43757d462bd1fb0cb4933b75a0f57323f0e97935'],
  ['kstack-jira.mjs','8848d87744d777ae52a556c3d86d666c55cbec457bb8dc3c850a9c110e55ca11'],
  ['kstack-kcrp-byte-benchmark.mjs','b0647889cd68034441e1351894e124d66b92f52a7e74b72c0dd50bde5461a2f8'],
  ['kstack-kcrp-core.mjs','d92cb3a27f925e4fb096c0daf90e4f01615026b864cbc2903bf42a2ad4625afb'],
  ['kstack-kcrp-dispatch-manifest.mjs','1b9bf7b3d6b5a29d1630881ff2693df2bbd8f596c05f3fc6e20c25778412bc87'],
  ['kstack-kcrp-json.mjs','a624e72c6a3a7cc81478f7404fd8f06b2d299abf5c972ddee7495cdf9fee899c'],
  ['kstack-kcrp-provider-trial.mjs','e2596c3dade2c5f3603cbc133b13e79bf100c2a8307cc0578e7dc497ea894cff'],
  ['kstack-linux-observation-admit.mjs','b6341ce6dd0eedaa0fca69ad6530dd7923e68377eb5b27743823dc8a6cf561ad'],
  ['kstack-linux-qualification-bundle.mjs','e63cf8a1269193f80bd5a41e93737fed2c71ed5dc6f50d12187844ffd456a35b'],
  ['kstack-linux-qualification.mjs','dd78f8ed78ae4a1da4af3c917367c6643df86143c756c5f023a685454b5b639a'],
  ['kstack-mcp-boundary.mjs','9d77d6faecd4181845d3abbe9b643ae46a0dc65e4d7534dbed076d951761dec9'],
  ['kstack-memory.mjs','d02b324cfa3ef671e1ba6daf71472cdc487bf65295a233e1cf2080e3282a6173'],
  ['kstack-opencode-adapter.mjs','c0a488f8b2aef00d4cac39f44fdb25d51a76533c0f142163a7f49a362b41490d'],
  ['kstack-opencode-candidate.mjs','06f3bf209aa54cb9b423cdac7cc1615d822e4fa11942dbd6b7962a2ee1960c6d'],
  ['kstack-opencode-conformance.mjs','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  ['kstack-panel-core.mjs','70e28a6f0cc2eb189bedda4eeba2ed779a5f2302238bd154764f88b9fb5ba95f'],
  ['kstack-panel-personas.mjs','09294ecd511185cf918fce23c9fdfc08a8c1e3dafe4076ab5b194d821ae4e6a0'],
  ['kstack-panel.mjs','ba9aac1fb9b28e17515337798c48ab2dd6c0d0129372696cd780358df967aecb'],
  ['kstack-planning-lens-core.mjs','297cd35c5abb5bc9e21078e1316aed20be9e6f4cff414fa5de5efaeec27bd333'],
  ['kstack-planning-lens-trial.mjs','507972986fd06ae4296f201fd5cd7380bf911c60a437436a53490e0617954d14'],
  ['kstack-post-deploy.mjs','ab1ec38d999b6918ba88d5c54383e23d1bc67feb688b5669d39122761510eb23'],
  ['kstack-provider-runner.mjs','7a12040f74a5b2348f8824957c35ab0fab1ac420bf6e49f352726954fcf1091f'],
  ['kstack-reflexion.mjs','7b305f579b7b398e5d07539af51f50c55843f98a98e63304e5bf7b11fc8f02eb'],
  ['kstack-review-measurement.mjs','f737a6de3ce4fa796063f9dd10ef40f7858943d49ecd491e9abadb070147d954'],
  ['kstack-review-schema.mjs','82f5389b474cd47307c6143cf5c23f6f4efe2af280e223f5f713d2ba1943db28'],
  ['kstack-safety-admin.mjs','a8f93d542889b30878c817e726c34fa0637a27c6f95639d5aa02f48c891484f2'],
  ['kstack-safety-broker.mjs','a0165ffd4d805f8c02d5a5c1f00c4a64cb524467cb71afbb03cc5cb844f0a801'],
  ['kstack-safety-executor.mjs','0ffcae6d5b10d2adffdafebb74b210de5e3578dae37c3df131c07206a3a78965'],
  ['kstack-safety-hook.mjs','cf9cbd5df3f29039dfdcad77b4c54c3adbf18694c53f7f1ae072032e29b248bd'],
  ['kstack-safety-matchers.mjs','feb15348d15233501879ffba394d5ccdfce1d2e66266b177b89b7e2c0077f230'],
  ['kstack-safety-worker.mjs','cf8b45c097085937a210cca7e150b63ddfdc15a11a01809263495decde6c9712'],
  ['kstack-second-host-proof.mjs','2d21450db206a7b12b8c98c388da22903b48ee3f78be26a9cbda42563ad34844'],
  ['kstack-secondary-review-policy.mjs','e9df666b0cdf0a7ea15da1a36bb233ceaa4a31470e870f10edfe3c325690968b'],
  ['kstack-secret-broker.mjs','1b18c69cdf355c35ed177fa593f4bdab6faae694591485fc68d609c2d9ddedff'],
  ['kstack-secret-linux.mjs','a2326d161dac493e3f7dc4db01aa58dcf767d407c037c1566f6a81557a6b7add'],
  ['kstack-staged-review.mjs','8f79c800ae111c9c1464d47033335ff635f6c8b8e97c2d01e8f60bef6cb85029'],
  ['kstack-windows-copy.mjs','b13baf6a4dfa1e4ce91adcfd0462f5260101c90bfeaa3f28b43f070ec9cc57d7'],
  ['kstack-work-envelope.mjs','6474471600e9e743c66af27a5158098b6998fb977a83d80163dc648e017d7c97'],
  ['kstack-workflow-contract.mjs','95d7a718e0b23ed1877de17ab83d9034dc46856e2e146e397f96c5c6812b9dcc'],
  ['reflexion-architecture/entry-probe.mjs','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  ['reflexion-architecture/resolver-client.mjs','ac7ce04d7cb705e98f4899317ad17102b80fbfa076fbad14272b89b6f9764b11'],
  ['reflexion-architecture/resolver-driver.mjs','cedebf4cff0eea222f600b030d7067b941e0446fff631a6e628c660ae10a8591'],
  ['reflexion-architecture/unicode-oracle.mjs','8be5b68b1b678974bef8326947d5fea0238dcff90b707c51e808a04f6ed86860'],
  ['reflexion/corpus-boundary.mjs','d3d568bed9f4d6727220cb6a47da1343139534a9b62cc8fc9124bb48ed665c10'],
  ['reflexion/corpus-io.mjs','e82145af3bc947965cda711a007a7c44e967f002f019161035e7004a13d49dd9'],
  ['reflexion/normalization.mjs','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  ['reflexion/prompt-assembler.mjs','4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
  ['reflexion/retrieval-core.mjs','0925a08bdd7815926a0f7be99a51a8ff20239b827d8c59217f9557c7d11a1368'],
  ['reflexion/runtime-profile.mjs','abac6ad7845bf40014807f103fce3ca799613e48405aef1d7caec0f1405d6025'],
  ['reflexion/termination-contract.mjs','a72f0135058a9cae48b59d854e5baf1a80b93509c94fc831d64884bfb22c4cf3'],
  ['reflexion/termination-native.mjs','e8d7f85b264f657d9b915c638b02761a9900fac5c3723867e3c953213cde12de'],
  ['reflexion/termination-schema.mjs','0917a3cf1fa06d24b06b9293ab4d9b1484b350911db74e81b54f56c3d9d67a57'],
  ['reflexion/termination-supervisor.mjs','dc9f0d14f3082733fa4eeb5626a0d422e60cbd3a3aeabe4cebd0e10502ca30c7'],
  ['reflexion/unavailable-sentinel.mjs','e8f6864b7695172649eb3448cc7475bbc8225e82aa764aa47e2a48382ae05e2f'],
  ['secret-broker/compatibility-v1.mjs','129968b9dd382c7f6df48b83954625c18489c67b2d056570a5c854010743de6a'],
  ['secret-broker/config-document-v2.mjs','482801c1ea78ba29ee6e29ea5a98ab868e49030e2958b335fea1e33a8c549f31'],
  ['secret-broker/config-migration-v2.mjs','f17d34e851fe4fa7c053a76d1bcffd4be60d7f9998f0396a7eba36ab60ea3f40'],
  ['secret-broker/config-v2.mjs','21a9e4a33ded2041f0cd4e16e4a1c99fe4530c301ea97508a16c4ac72bdc54e8'],
  ['secret-broker/control-plane-v1.mjs','480ba19589a4de03bfd36e0a79d861d1650df50d269460209ff7afc8b435e1ce'],
  ['secret-broker/public-v1.mjs','ecb74502734288a255af6d1e7b04b08fa04194924faf505b2fa226b1490685fd'],
  ['secret-broker/release-manifest-v1.mjs','d4ddb22d3c42ef794dcae5d644877aeed5e940f9761246abf9851c48e4929cdc'],
  ['secret-broker/release-provenance-v1.mjs','b5074ea04438cccfe2e0947dffe517128155814600fe68d52951331ebcc7f5e8'],
  ['secret-broker/synthetic-protected-state-v1.mjs','360a17c0c5d211b7400ed55b46537c27805f71e26ef664a6b246e2dae617dc01']
]);

const FROZEN_OFFLINE_SOURCE_SHA256 = new Map([
  ['kstack-config.mjs', 'b29850f82455ce0bc8739b6aca1f4628ff22a8817335cfc30f95ad7be5b3add4'],
  ['kstack-kcrp-byte-benchmark.mjs', '521c3b3caa1b52dce912b187519a7ed3c35bc8d601dbe7aabf5b4feb3dfb21f2'],
  ['kstack-kcrp-core.mjs', 'd0e7c7272989edcf6df84a3a65b030c9be6da4532612dc2ba9b702cb09e5c155'],
  ['kstack-kcrp-dispatch-manifest.mjs', '87e15cdda08552c643e10222da4fc5a8a6641385e4712c5f07f095528f5b099b'],
  ['kstack-kcrp-json.mjs', 'f27f42839dcacd2cb6909fdb74747a3497d80538e7df8dd39287aee6f57eae99'],
  ['kstack-review-measurement.mjs', '1fab15ecaed41f03325a37294eb9d1e99a3b275dd054d920b2134318202b9faf']
]);

const OFFLINE_SUBSET_IMPORTERS = new Map([
  ['kstack-kcrp-byte-benchmark.mjs', []],
  ['kstack-kcrp-core.mjs', ['kstack-kcrp-byte-benchmark.mjs', 'kstack-kcrp-dispatch-manifest.mjs']],
  ['kstack-kcrp-dispatch-manifest.mjs', ['kstack-kcrp-byte-benchmark.mjs']],
  ['kstack-kcrp-json.mjs', ['kstack-kcrp-byte-benchmark.mjs', 'kstack-kcrp-core.mjs', 'kstack-kcrp-dispatch-manifest.mjs']],
  ['kstack-review-measurement.mjs', []]
]);

const OFFLINE_FORBIDDEN_IMPORTS = new Set([
  'node:child_process', 'node:cluster', 'node:dgram', 'node:dns', 'node:fs', 'node:fs/promises',
  'node:http', 'node:http2', 'node:https', 'node:net', 'node:process', 'node:tls', 'node:worker_threads',
  './kstack-config.mjs', './kstack-provider-runner.mjs'
]);

function gateError(code, detail = '') { const error = new Error(`${code}${detail ? `: ${detail}` : ''}`); error.code = code; return error; }

export function parseArchitectureJson(bytes, { maximumBytes = 1_048_576, maximumDepth = 64, maximumNodes = 100_000 } = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > maximumBytes) throw gateError('KSTACK_ARCHITECTURE_JSON_INVALID');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw gateError('KSTACK_ARCHITECTURE_JSON_INVALID'); }
  let index = 0;
  let nodes = 0;
  const whitespace = () => { while (/\s/u.test(text[index] ?? '')) index += 1; };
  const string = () => {
    const start = index;
    if (text[index++] !== '"') throw gateError('KSTACK_ARCHITECTURE_JSON_INVALID');
    while (index < text.length) {
      if (text[index] === '"') { index += 1; try { return JSON.parse(text.slice(start, index)); } catch { throw gateError('KSTACK_ARCHITECTURE_JSON_INVALID'); } }
      if (text[index] === '\\') index += 2; else index += 1;
    }
    throw gateError('KSTACK_ARCHITECTURE_JSON_INVALID');
  };
  const value = (depth) => {
    nodes += 1;
    if (depth > maximumDepth || nodes > maximumNodes) throw gateError('KSTACK_ARCHITECTURE_JSON_INVALID');
    whitespace();
    if (text[index] === '"') { string(); return; }
    if (text[index] === '{') {
      index += 1; whitespace(); const keys = new Set();
      if (text[index] === '}') { index += 1; return; }
      for (;;) {
        whitespace(); const key = string();
        if (keys.has(key)) throw gateError('KSTACK_ARCHITECTURE_JSON_DUPLICATE_KEY');
        keys.add(key); whitespace(); if (text[index++] !== ':') throw gateError('KSTACK_ARCHITECTURE_JSON_INVALID');
        value(depth + 1); whitespace();
        if (text[index] === '}') { index += 1; return; }
        if (text[index++] !== ',') throw gateError('KSTACK_ARCHITECTURE_JSON_INVALID');
      }
    }
    if (text[index] === '[') {
      index += 1; whitespace(); if (text[index] === ']') { index += 1; return; }
      for (;;) { value(depth + 1); whitespace(); if (text[index] === ']') { index += 1; return; } if (text[index++] !== ',') throw gateError('KSTACK_ARCHITECTURE_JSON_INVALID'); }
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(text.slice(index));
    if (!match) throw gateError('KSTACK_ARCHITECTURE_JSON_INVALID');
    index += match[0].length;
  };
  value(0); whitespace(); if (index !== text.length) throw gateError('KSTACK_ARCHITECTURE_JSON_INVALID');
  try { return JSON.parse(text); } catch { throw gateError('KSTACK_ARCHITECTURE_JSON_INVALID'); }
}

function syntaxTokens(source) {
  const tokens = [];
  let index = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (source.startsWith('#!', index)) { const newline = source.indexOf('\n', index); index = newline < 0 ? source.length : newline + 1; }
  let brace = 0; let paren = 0; let bracket = 0;
  while (index < source.length) {
    const char = source[index]; const next = source[index + 1];
    if (/\s/u.test(char)) { index += 1; continue; }
    if (char === '/' && next === '/') { index = source.indexOf('\n', index + 2); if (index < 0) break; continue; }
    if (char === '/' && next === '*') { index = source.indexOf('*/', index + 2); if (index < 0) throw gateError('KSTACK_ARCHITECTURE_SOURCE_SYNTAX'); index += 2; continue; }
    if (char === '"' || char === "'" || char === '`') {
      const quote = char; index += 1;
      while (index < source.length) { if (source[index] === '\\') index += 2; else if (source[index++] === quote) break; }
      continue;
    }
    if (/[A-Za-z_$]/u.test(char)) {
      const start = index++; while (/[A-Za-z0-9_$]/u.test(source[index] ?? '')) index += 1;
      tokens.push({ value: source.slice(start, index), brace, paren, bracket }); continue;
    }
    tokens.push({ value: char, brace, paren, bracket });
    if (char === '{') brace += 1; else if (char === '}') brace -= 1;
    else if (char === '(') paren += 1; else if (char === ')') paren -= 1;
    else if (char === '[') bracket += 1; else if (char === ']') bracket -= 1;
    if (brace < 0 || paren < 0 || bracket < 0) throw gateError('KSTACK_ARCHITECTURE_SOURCE_SYNTAX');
    index += 1;
  }
  return tokens;
}

function hasAmbiguousModuleSyntax(source) {
  const tokens = syntaxTokens(source);
  const top = tokens.filter((token) => token.brace === 0 && token.paren === 0 && token.bracket === 0);
  for (let index = 0; index < top.length; index += 1) {
    const token = top[index].value;
    if (token === 'export' || token === 'await') return true;
    if (token === 'import' && top[index + 1]?.value !== '(') return true;
    if (token === 'import' && top[index + 1]?.value === '.' && top[index + 2]?.value === 'meta') return true;
    if (['const', 'let', 'class'].includes(token) && ['require','module','exports','__dirname','__filename'].includes(top[index + 1]?.value)) return true;
  }
  return false;
}

function nearestPackageType(filename) {
  let directory = path.dirname(filename);
  for (;;) {
    const candidate = path.join(directory, 'package.json');
    if (fs.existsSync(candidate)) {
      const stat = fs.lstatSync(candidate);
      if (!stat.isFile() || stat.isSymbolicLink()) throw gateError('KSTACK_ARCHITECTURE_PACKAGE_METADATA');
      const parsed = parseArchitectureJson(fs.readFileSync(candidate));
      return parsed.type === 'module' || parsed.type === 'commonjs' ? parsed.type : null;
    }
    const parent = path.dirname(directory);
    if (parent === directory || path.basename(directory) === 'node_modules') return null;
    directory = parent;
  }
}

export function classifyParseGoal(filename, source) {
  const suffix = path.extname(filename);
  if (suffix === '.mjs') return 'module';
  if (suffix === '.cjs') return 'commonjs-wrapper';
  if (suffix !== '.js') throw gateError('KSTACK_ARCHITECTURE_SOURCE_SUFFIX');
  const type = nearestPackageType(filename);
  if (type === 'module') return 'module';
  if (type === 'commonjs') return 'commonjs-wrapper';
  return hasAmbiguousModuleSyntax(source) ? 'module' : 'commonjs-wrapper';
}

export function validateParseGoal(filename, source, goal = classifyParseGoal(filename, source)) {
  if (goal === 'commonjs-wrapper') {
    try { Function('exports', 'require', 'module', '__filename', '__dirname', source); }
    catch { throw gateError('KSTACK_ARCHITECTURE_SOURCE_SYNTAX'); }
    return goal;
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-module-parse-'));
  const target = path.join(directory, 'source.mjs');
  try {
    fs.writeFileSync(target, source);
    const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8', timeout: 5_000, maxBuffer: 65_536, shell: false, env: {} });
    if (result.status !== 0 || result.signal !== null || result.error) throw gateError('KSTACK_ARCHITECTURE_SOURCE_SYNTAX');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  return goal;
}

export function selectPackageMapEntry(map, requestKey) {
  if (requestKey.endsWith('/')) return null;
  if (Object.hasOwn(map, requestKey) && !requestKey.includes('*')) return Object.freeze({ key: requestKey, capture: null, value: map[requestKey] });
  const patterns = Object.keys(map).filter((key) => (key.match(/\*/gu) ?? []).length === 1).sort((left, right) => {
    const leftIndex = left.indexOf('*'); const rightIndex = right.indexOf('*');
    return rightIndex - leftIndex || right.length - left.length;
  });
  for (const key of patterns) {
    const star = key.indexOf('*'); const base = key.slice(0, star); const trailer = key.slice(star + 1);
    if (!requestKey.startsWith(base) || requestKey === base || (trailer && (!requestKey.endsWith(trailer) || requestKey.length < key.length))) continue;
    const capture = requestKey.slice(base.length, requestKey.length - trailer.length);
    if (capture.length > 0) return Object.freeze({ key, capture, value: map[key] });
  }
  return null;
}

export function walkInactivePackageMap(map, requestKey, kind = 'exports') {
  let selected;
  if (kind === 'exports' && (typeof map === 'string' || Array.isArray(map) || map === null)) {
    if (requestKey !== '.') throw gateError('KSTACK_ARCHITECTURE_PACKAGE_MAP');
    selected = Object.freeze({ key: '.', capture: null, value: map });
  } else {
    if (map === null || typeof map !== 'object' || Array.isArray(map)) throw gateError('KSTACK_ARCHITECTURE_PACKAGE_MAP');
    if (kind === 'exports') {
      const keys = Object.keys(map);
      const hasSubpathKeys = keys.some((key) => key.startsWith('.'));
      const hasConditionKeys = keys.some((key) => !key.startsWith('.'));
      if (hasSubpathKeys && hasConditionKeys) throw gateError('KSTACK_ARCHITECTURE_PACKAGE_MAP');
      if (hasConditionKeys) {
        if (requestKey !== '.') throw gateError('KSTACK_ARCHITECTURE_PACKAGE_MAP');
        selected = Object.freeze({ key: '.', capture: null, value: map });
      }
    }
    selected ??= selectPackageMapEntry(map, requestKey);
  }
  if (!selected) throw gateError('KSTACK_ARCHITECTURE_PACKAGE_MAP');
  const leaves = [];
  const visit = (value, depth = 0) => {
    if (depth > 64) throw gateError('KSTACK_ARCHITECTURE_PACKAGE_MAP');
    if (value === null) { leaves.push(null); return; }
    if (typeof value === 'string') {
      const substituted = selected.capture === null ? value : value.split('*').join(selected.capture);
      if (kind === 'exports' ? !substituted.startsWith('./') : (path.isAbsolute(substituted) || /^[a-z]+:/iu.test(substituted))) throw gateError('KSTACK_ARCHITECTURE_PACKAGE_MAP');
      if (substituted.split(/[\\/]/u).includes('..')) throw gateError('KSTACK_ARCHITECTURE_PACKAGE_MAP');
      leaves.push(substituted); return;
    }
    if (Array.isArray(value)) { if (value.length === 0 || value.length > 256) throw gateError('KSTACK_ARCHITECTURE_PACKAGE_MAP'); for (const item of value) visit(item, depth + 1); return; }
    if (typeof value === 'object') { const entries = Object.values(value); if (entries.length === 0 || entries.length > 256) throw gateError('KSTACK_ARCHITECTURE_PACKAGE_MAP'); for (const item of entries) visit(item, depth + 1); return; }
    throw gateError('KSTACK_ARCHITECTURE_PACKAGE_MAP');
  };
  visit(selected.value);
  const distinct = [...new Set(leaves)];
  if (distinct.length !== 1 || distinct[0] === null) throw gateError('KSTACK_ARCHITECTURE_PACKAGE_MAP_AMBIGUOUS');
  return Object.freeze({ selectedKey: selected.key, leaf: distinct[0], leaves: Object.freeze(leaves) });
}

function productionFiles(scriptsRoot) {
  const seen = new Set();
  const visit = (directory) => {
    const real = fs.realpathSync.native(directory);
    if (seen.has(real)) throw gateError('KSTACK_ARCHITECTURE_DIRECTORY_CYCLE');
    seen.add(real);
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw gateError('KSTACK_ARCHITECTURE_SOURCE_SYMLINK');
      if (entry.isDirectory()) files.push(...visit(target));
      else if (!entry.isFile() || !SUPPORTED_SUFFIXES.has(path.extname(entry.name))) throw gateError('KSTACK_ARCHITECTURE_SOURCE_SUFFIX');
      else files.push(fs.realpathSync.native(target));
    }
    return files;
  };
  return visit(scriptsRoot).sort();
}

function repositoryProductionCensus(repoRoot, scriptsRoot) {
  const excludedNames = new Set(['.git', '.kstack', 'node_modules', 'vendor', 'tests', 'fixtures', 'generated', 'dist', 'build']);
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (excludedNames.has(entry.name) || target === path.join(repoRoot, 'plugins/kstack/native')) continue;
        visit(target); continue;
      }
      if (entry.isSymbolicLink()) continue;
      if (entry.isFile() && SUPPORTED_SUFFIXES.has(path.extname(entry.name))
          && target !== scriptsRoot && !target.startsWith(`${scriptsRoot}${path.sep}`)) throw gateError('KSTACK_ARCHITECTURE_PRODUCTION_OUTSIDE_ROOT', path.relative(repoRoot, target));
    }
  };
  visit(repoRoot);
}

export function staticSpecifiers(source) {
  const results = [];
  const expression = /(?:^|\n)\s*(?:import\s+(?:[^;'"`]*?\s+from\s+)?|export\s+(?:\*|\{[^}]*\})\s+from\s+)(['"])([^'"\r\n]+)\1/gu;
  for (const match of source.matchAll(expression)) results.push(match[2]);
  return results;
}

export function capabilityTokenInventory(source) {
  const externalBindings = new Set();
  const expression = /(?:^|\n)\s*import\s+([^;'"`]+?)\s+from\s+(['"])([^'"\r\n]+)\2/gu;
  for (const match of source.matchAll(expression)) {
    const clause = match[1].trim(); const specifier = match[3];
    if (specifier.startsWith('.')) continue;
    const defaultBinding = /^([A-Za-z_$][A-Za-z0-9_$]*)/u.exec(clause);
    if (defaultBinding) externalBindings.add(defaultBinding[1]);
    const namespaceBinding = /\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)/u.exec(clause);
    if (namespaceBinding) externalBindings.add(namespaceBinding[1]);
    const named = /\{([\s\S]*)\}/u.exec(clause);
    if (named) for (const item of named[1].split(',')) {
      const parts = item.trim().split(/\s+as\s+/u);
      if (parts[0]) externalBindings.add(parts[1] ?? parts[0]);
    }
  }
  const names = [...new Set([...externalBindings, ...AMBIENT_CAPABILITIES])].sort();
  return Object.fromEntries(names.map((name) => [name, (source.match(new RegExp(`\\b${name}\\b`, 'gu')) ?? []).length]).filter(([, count]) => count > 0));
}

export function capabilityUseSiteDigest(source) {
  const names = Object.keys(capabilityTokenInventory(source));
  const rows = [];
  for (const [lineIndex, line] of source.split('\n').entries()) {
    for (const name of names) {
      const count = (line.match(new RegExp(`\\b${name}\\b`, 'gu')) ?? []).length;
      for (let occurrence = 0; occurrence < count; occurrence += 1) rows.push([name, lineIndex + 1, occurrence, line]);
    }
  }
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

function checkCapabilityManifest(scriptsRoot, files) {
  assert.deepEqual(files.map((file) => path.relative(scriptsRoot, file)), [...IMPORT_MANIFEST.keys()]);
  assert.deepEqual([...CAPABILITY_TOKEN_MANIFEST.keys()], [...IMPORT_MANIFEST.keys()]);
  assert.deepEqual([...CAPABILITY_USE_SITE_MANIFEST.keys()], [...IMPORT_MANIFEST.keys()]);
  for (const [relative, expectedSha256] of FROZEN_OFFLINE_SOURCE_SHA256) {
    const bytes = fs.readFileSync(path.join(scriptsRoot, relative));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expectedSha256, `frozen offline source drift in ${relative}`);
  }
  for (const file of files) {
    const relative = path.relative(scriptsRoot, file); const source = fs.readFileSync(file, 'utf8');
    assert.deepEqual(staticSpecifiers(source), IMPORT_MANIFEST.get(relative), `capability import drift in ${relative}`);
    assert.deepEqual(capabilityTokenInventory(source), CAPABILITY_TOKEN_MANIFEST.get(relative), `capability token drift in ${relative}`);
    assert.equal(capabilityUseSiteDigest(source), CAPABILITY_USE_SITE_MANIFEST.get(relative), `capability use-site drift in ${relative}`);
    assert.equal((source.match(/import\.meta/gu) ?? []).length, IMPORT_META_MANIFEST.get(relative) ?? 0, `import.meta drift in ${relative}`);
    assert.doesNotMatch(source, /\bimport\s*\(/u, `dynamic import in ${relative}`);
    assert.doesNotMatch(source, /\bimport\s+[^;]+\s+(?:with|assert)\s*\{/u, `import attributes in ${relative}`);
    assert.doesNotMatch(source, /\b(?:eval|Function)\s*\(/u, `dynamic execution in ${relative}`);
    assert.doesNotMatch(source, /\bWebAssembly\b/u, `WebAssembly capability in ${relative}`);
  }
  const exactHighRiskRows = [
    ['kstack-provider-runner.mjs', /\bspawn\(/gu, 2], ['kstack-memory.mjs', /\bspawnSync\(/gu, 3],
    ['kstack-safety-broker.mjs', /\bspawnSync\(/gu, 1],
    ['kstack-safety-executor.mjs', /\bspawn\(/gu, 1],
    ['kstack-safety-worker.mjs', /\bspawn\(/gu, 1], ['kstack-safety-worker.mjs', /\bspawnSync\(/gu, 2],
    ['kstack-secret-linux.mjs', /\bspawnSync\(/gu, 3],
    ['kstack-install-health.mjs', /\bspawnSync\(/gu, 3],
    ['kstack-panel.mjs', /\bspawn\(/gu, 1],
    ['kstack-citation-native.mjs', /\bspawn\(/gu, 1], ['kstack-citation-native.mjs', /new Worker\(/gu, 1],
    ['kstack-citation-runtime.mjs', /\bspawn\(/gu, 2], ['kstack-citation-runtime.mjs', /\bspawnSync\(/gu, 2], ['kstack-citation-runtime.mjs', /new Worker\(/gu, 1],
    ['kstack-reflexion.mjs', /\bspawnSync\(/gu, 1], ['reflexion-architecture/resolver-client.mjs', /\bspawn\(/gu, 1],
    ['reflexion/termination-native.mjs', /\bexecFileAsync\(/gu, 1],
    ['reflexion-architecture/resolver-driver.mjs', /import\.meta\.resolve\(/gu, 8], ['kstack-jira.mjs', /globalThis\.fetch/gu, 1]
  ];
  for (const [relative, expression, count] of exactHighRiskRows) assert.equal((fs.readFileSync(path.join(scriptsRoot, relative), 'utf8').match(expression) ?? []).length, count, `capability use drift in ${relative}`);

  const offlineNames = new Set(OFFLINE_SUBSET_IMPORTERS.keys());
  const actualImporters = new Map([...offlineNames].map((name) => [name, []]));
  for (const [importer, specifiers] of IMPORT_MANIFEST) {
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
      if (actualImporters.has(target)) actualImporters.get(target).push(importer);
    }
  }
  for (const [relative, expectedImporters] of OFFLINE_SUBSET_IMPORTERS) {
    const importers = actualImporters.get(relative).sort();
    assert.deepEqual(importers, expectedImporters, `offline consumer drift in ${relative}`);
    assert.equal(importers.every((importer) => offlineNames.has(importer)), true, `runtime consumer admitted for ${relative}`);

    const source = fs.readFileSync(path.join(scriptsRoot, relative), 'utf8');
    const specifiers = staticSpecifiers(source);
    assert.equal(specifiers.some((specifier) => OFFLINE_FORBIDDEN_IMPORTS.has(specifier)), false, `offline boundary import in ${relative}`);
    const inventory = capabilityTokenInventory(source);
    for (const capability of ['fetch', 'globalThis', 'require']) {
      assert.equal(inventory[capability] ?? 0, 0, `offline ${capability} capability in ${relative}`);
    }
    assert.doesNotMatch(source, /\b(?:XMLHttpRequest|WebSocket|spawn|spawnSync|execFile|execFileSync|fork)\s*\(/u, `offline execution or network capability in ${relative}`);
    if (relative === 'kstack-review-measurement.mjs') {
      assert.equal(inventory.process, 1, 'review measurement process capability drift');
      assert.equal((source.match(/\bprocess\.hrtime\.bigint\b/gu) ?? []).length, 1, 'review measurement monotonic clock drift');
      assert.equal((source.match(/\bprocess\./gu) ?? []).length, 1, 'review measurement process boundary drift');
    } else {
      assert.equal(inventory.process ?? 0, 0, `offline process capability in ${relative}`);
    }
  }
}

async function checkOfflineSubsetContracts(scriptsRoot) {
  const load = async (relative) => import(pathToFileURL(path.join(scriptsRoot, relative)).href);
  const json = await load('kstack-kcrp-json.mjs');
  const core = await load('kstack-kcrp-core.mjs');
  const dispatchManifest = await load('kstack-kcrp-dispatch-manifest.mjs');
  const byteBenchmark = await load('kstack-kcrp-byte-benchmark.mjs');
  const measurement = await load('kstack-review-measurement.mjs');
  const config = await load('kstack-config.mjs');

  assert.equal(json.KCRP_JSON_VERSION, 'kstack-kcrp-json-v1');
  assert.equal(json.KCRP_CONTROL_JSON_MAX_BYTES, 4_194_304);
  assert.equal(json.KCRP_JSON_MAX_DEPTH, 64);
  assert.deepEqual(core.KCRP_OFFLINE_BOUNDARIES, {
    status: 'OFFLINE_SUBSET_ONLY',
    implemented: ['canonical-json-v1', 'item-map-validation', 'declared-closure', 'source-record-serialization', 'review-input-framing', 'offline-closure-eligibility'],
    unimplemented: [
      'qualified-safe-file-discovery', 'governance-policy-resolution',
      'complete-dispatch-manifest-schema', 'outbound-scan', 'provider-execution',
      'receipt-chain', 'gate-integration', 'configuration', 'activation'
    ]
  });
  assert.deepEqual(dispatchManifest.KCRP_DISPATCH_MANIFEST_BOUNDARY, {
    status: 'OFFLINE_SUBSET_ONLY',
    kind: 'kstack-kcrp-dispatch-manifest-offline-subset-v1',
    dispatchAuthority: 'NONE',
    finalR2eManifestImplemented: false
  });
  assert.deepEqual(byteBenchmark.KCRP_BYTE_BENCHMARK_BOUNDARY, {
    status: 'OFFLINE_SUBSET_ONLY',
    kind: 'kstack-kcrp-byte-benchmark-offline-subset-v1',
    dispatchAuthority: 'NONE',
    providerMeasurementAvailable: false
  });
  assert.equal(measurement.REVIEW_MEASUREMENT_KIND, 'kstack-review-measurement-v1');
  const marker = Object.freeze({ exactReviewInput: true });
  const disabledMeasurement = measurement.beginReviewMeasurement(marker);
  assert.equal(disabledMeasurement.enabled, false);
  assert.equal(disabledMeasurement.reviewInput, marker);
  assert.equal(disabledMeasurement.finish(), null);

  const expectedContextReduction = {
    measurementEnabled: false,
    eagerInstructionsEnabled: false,
    slicingEnabled: false,
    qualificationEvidenceSha256: null,
    qualificationRouteId: null,
    qualificationProfileId: null
  };
  assert.deepEqual(config.defaultConfig.workflow.contextReduction, expectedContextReduction);
  assert.deepEqual(config.validateConfig(config.defaultConfig), []);
  for (const feature of ['eagerInstructionsEnabled', 'slicingEnabled']) {
    const candidate = JSON.parse(JSON.stringify(config.defaultConfig));
    candidate.workflow.contextReduction = {
      ...candidate.workflow.contextReduction,
      [feature]: true,
      qualificationEvidenceSha256: '0'.repeat(64),
      qualificationRouteId: 'offline-reduced',
      qualificationProfileId: 'default'
    };
    assert.match(config.validateConfig(candidate).join('\n'), /none are qualified in this build/u, `${feature} activation boundary drift`);
  }
}

function checkMetadata(repoRoot, scriptsRoot, files) {
  const rootPackage = parseArchitectureJson(fs.readFileSync(path.join(repoRoot, 'package.json')));
  const pluginPackage = parseArchitectureJson(fs.readFileSync(path.join(repoRoot, 'plugins/kstack/package.json')));
  const pluginManifest = parseArchitectureJson(fs.readFileSync(path.join(repoRoot, 'plugins/kstack/.codex-plugin/plugin.json')));
  assert.equal(rootPackage.scripts.test, 'node --test tests/*.test.mjs');
  assert.equal(rootPackage.scripts['test:memory-gate'], 'node tests/reflexion-memory-gate-harness.mjs');
  assert.equal(rootPackage.scripts['build:termination-native'], 'node plugins/kstack/native/reflexion-termination-native/build-native.mjs');
  const terminationNativeBuilder = path.join(repoRoot, 'plugins/kstack/native/reflexion-termination-native/build-native.mjs');
  const terminationNativeBuilderStat = fs.lstatSync(terminationNativeBuilder);
  assert.equal(terminationNativeBuilderStat.isFile() && !terminationNativeBuilderStat.isSymbolicLink(), true);
  assert.equal(fs.realpathSync.native(terminationNativeBuilder), terminationNativeBuilder);
  for (const [name, script] of Object.entries(rootPackage.scripts)) {
    if (name === 'test' || name === 'test:memory-gate' || name === 'build:termination-native') continue;
    const match = /^node ([A-Za-z0-9_./-]+)(?: [A-Za-z0-9_./:-]+)*$/u.exec(script);
    if (!match) throw gateError('KSTACK_ARCHITECTURE_PACKAGE_SCRIPT');
    const target = fs.realpathSync.native(path.join(repoRoot, match[1]));
    if (!files.includes(target)) throw gateError('KSTACK_ARCHITECTURE_PACKAGE_SCRIPT');
  }
  for (const metadata of [rootPackage, pluginPackage]) for (const key of ['main','bin','exports','imports']) if (Object.hasOwn(metadata, key)) throw gateError('KSTACK_ARCHITECTURE_LAUNCH_METADATA');
  assert.deepEqual(Object.keys(pluginManifest), ['name','version','description','author','skills','hooks','interface']);
  assert.deepEqual(Object.keys(pluginManifest.interface), ['displayName','shortDescription','longDescription','developerName','category','capabilities','defaultPrompt']);
  if (typeof pluginManifest.skills !== 'string' || pluginManifest.hooks !== './hooks/codex-hooks.json') throw gateError('KSTACK_ARCHITECTURE_PLUGIN_MANIFEST');
  void scriptsRoot;
}

export async function validateProductionArchitecture(repoRoot) {
  const scriptsRoot = fs.realpathSync.native(path.join(repoRoot, 'plugins/kstack/scripts'));
  const files = productionFiles(scriptsRoot);
  repositoryProductionCensus(repoRoot, scriptsRoot);
  checkCapabilityManifest(scriptsRoot, files);
  await checkOfflineSubsetContracts(scriptsRoot);
  checkMetadata(repoRoot, scriptsRoot, files);
  const requests = [];
  for (const file of files) {
    const source = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
    validateParseGoal(file, source);
    if (classifyParseGoal(file, source) === 'module') for (const specifier of staticSpecifiers(source)) requests.push({ specifier, parentURL: pathToFileURL(file).href });
  }
  const driverPath = path.join(scriptsRoot, 'reflexion-architecture/resolver-driver.mjs');
  const conformance = await runResolverConformance(driverPath);
  const graph = await runBoundedResolverBatch({ driverPath, requests });
  const sortedRequests = requests.sort((left, right) => Buffer.compare(Buffer.from(left.parentURL), Buffer.from(right.parentURL)) || Buffer.compare(Buffer.from(left.specifier), Buffer.from(right.specifier)))
    .filter((item, index, array) => index === 0 || item.parentURL !== array[index - 1].parentURL || item.specifier !== array[index - 1].specifier);
  for (let index = 0; index < graph.responses.length; index += 1) {
    const response = graph.responses[index]; const request = sortedRequests[index];
    if (!response.ok) throw gateError('KSTACK_ARCHITECTURE_RESOLUTION', `${response.failureKind}/${response.errorCode}`);
    if (BUILTINS.has(response.url)) continue;
    let target;
    try { target = fs.realpathSync.native(new URL(response.url)); } catch { throw gateError('KSTACK_ARCHITECTURE_RESOLUTION_TARGET'); }
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink() || !SUPPORTED_SUFFIXES.has(path.extname(target))) throw gateError('KSTACK_ARCHITECTURE_RESOLUTION_TARGET');
    if (target.includes(`${path.sep}node_modules${path.sep}`)) continue;
    if (!target.startsWith(`${scriptsRoot}${path.sep}`)) throw gateError('KSTACK_ARCHITECTURE_LOCAL_CONTAINMENT');
    void request;
  }
  return Object.freeze({ fileCount: files.length, edgeCount: graph.responses.length, conformance });
}
