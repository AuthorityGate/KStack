#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [inputArg, binaryArg, outputArg] = process.argv.slice(2);
if (!inputArg || !binaryArg || !outputArg) {
  process.stderr.write('usage: bind-goose-v1.48.0-sbom.mjs INPUT_SBOM BINARY OUTPUT_SBOM\n');
  process.exit(2);
}

const input = JSON.parse(fs.readFileSync(inputArg, 'utf8'));
const binary = fs.readFileSync(binaryArg);
const artifactSha256 = crypto.createHash('sha256').update(binary).digest('hex');
if (artifactSha256 !== '057a1788b48cc1452203920afd31eac274d5b9cb10026734d587e5db33885792') {
  throw new Error('Goose artifact digest does not match the reproducibility qualification');
}
if (input.bomFormat !== 'CycloneDX' || input.specVersion !== '1.5'
  || input.metadata?.component?.name !== 'goose' || input.metadata.component.version !== '1.48.0'
  || input.components?.length !== 1043 || input.dependencies?.length !== 1044) {
  throw new Error('CycloneDX input does not match the qualified Goose graph');
}
if (input.components.some((component) => !component.purl || !component.licenses?.length)) {
  throw new Error('CycloneDX component lacks a package URL or license expression');
}

const uuidBytes = crypto.createHash('sha256')
  .update(`kstack-goose-v1.48.0\0${artifactSha256}`, 'utf8')
  .digest().subarray(0, 16);
uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x50;
uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
const hex = uuidBytes.toString('hex');
input.serialNumber = `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
input.metadata.component.hashes = [{ alg: 'SHA-256', content: artifactSha256 }];
input.metadata.tools.push({
  vendor: 'KStack',
  name: 'bind-goose-v1.48.0-sbom.mjs',
  version: '1',
  hashes: [{ alg: 'SHA-256', content: crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex') }]
});
input.metadata.properties = [
  { name: 'kstack:artifact:bytes', value: String(binary.length) },
  { name: 'kstack:artifact:build-id-sha1', value: 'a1c7aea9ef21faa9cfcc9c8634f8ea4916f9aa79' },
  { name: 'kstack:source:manifest-sha256', value: '0d2cb9b14a970aae67c27a9a2d1db2eaca12ce2e5b082e8441413de7bb240234' },
  { name: 'kstack:source:cargo-lock-sha256', value: 'cc55ae1fad9e84444f23a09ec76505c5996487e156fb173b5fa945a62c69287f' },
  { name: 'kstack:qualification:profile', value: 'goose-cli-default-bin-goose@x86_64-unknown-linux-gnu' }
];

const output = `${JSON.stringify(input, null, 2)}\n`;
fs.mkdirSync(path.dirname(path.resolve(outputArg)), { recursive: true });
fs.writeFileSync(outputArg, output, 'utf8');
process.stdout.write(`${JSON.stringify({ artifactSha256, artifactBytes: binary.length, serialNumber: input.serialNumber, components: input.components.length, dependencies: input.dependencies.length }, null, 2)}\n`);
