#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hostCanonicalBytes } from '../../plugins/kstack/scripts/kstack-host-contract.mjs';
import {
  buildSecretBrokerReleaseManifest,
  buildSecretBrokerSourceAudit,
  SECRET_BROKER_RELEASE_MANIFEST_PATH,
  SECRET_BROKER_SOURCE_AUDIT_PATH
} from '../../plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let pluginRoot = path.join(repositoryRoot, 'plugins', 'kstack');
let check = false;
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index] === '--check') check = true;
  else if (process.argv[index] === '--plugin-root' && process.argv[index + 1]) { pluginRoot = path.resolve(process.argv[++index]); }
  else { process.stderr.write('KSTACK_SECRET_RELEASE_MANIFEST_USAGE\n'); process.exit(2); }
}

const releasePath = path.join(pluginRoot, SECRET_BROKER_RELEASE_MANIFEST_PATH);
const auditPath = path.join(pluginRoot, SECRET_BROKER_SOURCE_AUDIT_PATH);
const releaseBytes = hostCanonicalBytes(buildSecretBrokerReleaseManifest(pluginRoot));

function checkOrWrite(file, bytes, code) {
  if (check) {
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes)) {
      process.stderr.write(`${code}\n`);
      process.exitCode = 1;
    }
  } else fs.writeFileSync(file, bytes, { mode: 0o644 });
}

checkOrWrite(releasePath, releaseBytes, 'KSTACK_SECRET_RELEASE_MANIFEST_STALE');
if (!check) {
  const auditBytes = hostCanonicalBytes(buildSecretBrokerSourceAudit(pluginRoot, releaseBytes));
  checkOrWrite(auditPath, auditBytes, 'KSTACK_SECRET_SOURCE_AUDIT_MANIFEST_STALE');
} else if (fs.existsSync(releasePath)) {
  const auditBytes = hostCanonicalBytes(buildSecretBrokerSourceAudit(pluginRoot, fs.readFileSync(releasePath)));
  checkOrWrite(auditPath, auditBytes, 'KSTACK_SECRET_SOURCE_AUDIT_MANIFEST_STALE');
}
