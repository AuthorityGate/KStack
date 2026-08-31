#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function fail(code) { const error = new Error(code); error.code = code; throw error; }

function canonicalEntry(pathname) {
  const stat = fs.lstatSync(pathname);
  if (stat.isSymbolicLink()) fail('KSTACK_WINDOWS_COPY_LINK_REJECTED');
  if (!stat.isDirectory() && !stat.isFile()) fail('KSTACK_WINDOWS_COPY_TYPE_REJECTED');
  return stat;
}

export function copyWindowsTree(sourceArgument, destinationArgument) {
  if (process.platform !== 'win32' || !path.isAbsolute(sourceArgument) || !path.isAbsolute(destinationArgument)) fail('KSTACK_WINDOWS_COPY_ARGUMENT_INVALID');
  const source = fs.realpathSync.native(sourceArgument);
  const sourceStat = canonicalEntry(source);
  if (!sourceStat.isDirectory() || fs.existsSync(destinationArgument)) fail('KSTACK_WINDOWS_COPY_ARGUMENT_INVALID');
  const destination = path.resolve(destinationArgument);
  const relative = path.relative(source, destination);
  if (!relative || (!path.isAbsolute(relative) && !relative.startsWith('..' + path.sep) && relative !== '..')) fail('KSTACK_WINDOWS_COPY_ARGUMENT_INVALID');

  const copyDirectory = (from, to) => {
    fs.mkdirSync(to);
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const sourcePath = path.join(from, entry.name);
      const destinationPath = path.join(to, entry.name);
      const stat = canonicalEntry(sourcePath);
      if (stat.isDirectory()) copyDirectory(sourcePath, destinationPath);
      else fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
    }
  };
  copyDirectory(source, destination);
  return Object.freeze({ kind: 'kstack-windows-copy-v1', status: 'copied' });
}

function canonicalPathClass(argv1, moduleUrl) {
  if (typeof argv1 !== 'string' || !argv1 || typeof moduleUrl !== 'string' || !moduleUrl.startsWith('file:')) return 'unknown';
  try { return fs.realpathSync.native(path.resolve(argv1)) === fs.realpathSync.native(fileURLToPath(moduleUrl)) ? 'direct' : 'proved-imported'; } catch { return 'unknown'; }
}

const startup = import.meta.main === true ? 'direct' : canonicalPathClass(process.argv[1], import.meta.url) === 'proved-imported' ? 'imported' : 'mismatch';
if (startup === 'direct') {
  try {
    if (process.argv.length !== 4) fail('KSTACK_WINDOWS_COPY_ARGUMENT_INVALID');
    process.stdout.write(`${JSON.stringify(copyWindowsTree(process.argv[2], process.argv[3]))}\n`);
  } catch (error) {
    process.stderr.write(`${error.code ?? 'KSTACK_WINDOWS_COPY_FAILED'}\n`);
    process.exitCode = 1;
  }
} else if (startup === 'mismatch') {
  process.stderr.write('KSTACK_WINDOWS_COPY_ENTRY_MISMATCH\n');
  process.exitCode = 1;
}
