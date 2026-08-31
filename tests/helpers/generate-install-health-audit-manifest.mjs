#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let pluginRoot = path.join(repositoryRoot, 'plugins', 'kstack');
let check = false;
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index] === '--check') check = true;
  else if (process.argv[index] === '--plugin-root' && process.argv[index + 1]) { pluginRoot = path.resolve(process.argv[index + 1]); index += 1; }
  else { process.stderr.write('KSTACK_INSTALL_HEALTH_AUDIT_MANIFEST_USAGE\n'); process.exit(2); }
}
const outputPath = path.join(pluginRoot, 'install-health-audit-manifest-v1.json');
const roots = ['acquisition', 'hooks', 'packs', 'personas', 'references', 'scripts', 'skills', 'workers'];
const topLevel = ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.npmrc', 'install-health-authority-registry-v1.json', 'install-health-contract-v1.json', 'package-lock.json', 'package.json'];

function walk(relative, entries) {
  const absolute = path.join(pluginRoot, relative);
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) throw new Error(`KSTACK_RELEASE_RUNTIME_SYMLINK:${relative}`);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(absolute).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))) walk(path.posix.join(relative, name), entries);
    return;
  }
  if (!stat.isFile()) throw new Error(`KSTACK_RELEASE_RUNTIME_TYPE:${relative}`);
  const bytes = fs.readFileSync(absolute);
  // DrvFS commonly reports every file as executable. Bind the installed
  // runtime's normalized modes instead: production .mjs launch surfaces are
  // 0755 and all declarative/reference files are 0644.
  const executable = relative.startsWith('scripts/') && relative.endsWith('.mjs');
  entries.push({ path: relative, executable, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
}

const entries = [];
for (const relative of [...topLevel, ...roots]) walk(relative, entries);
entries.sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
if (entries.some((entry) => entry.path === 'install-health-audit-manifest-v1.json')) throw new Error('HC_MANIFEST_SELF_REFERENCE');
const output = `${JSON.stringify({
  schema: 'kstack-install-health-audit-manifest-v1',
  manifestId: 'kstack-release-audit-v1',
  protocolVersion: 'kstack-install-health-coordinator-v1',
  sourceAuditManifestSha256: null,
  entries
}, null, 2)}\n`;
if (check) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== output) {
    process.stderr.write('KSTACK_INSTALL_HEALTH_AUDIT_MANIFEST_STALE\n');
    process.exitCode = 1;
  }
} else {
  fs.writeFileSync(outputPath, output, { mode: 0o644 });
}
