import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const nativeRoot = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(nativeRoot, 'src', 'reflexion_termination_native.c');

export async function buildReflexionTerminationNative({ outputPath, compiler = process.env.CC || 'cc' } = {}) {
  if (!outputPath) throw new TypeError('outputPath is required');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true, mode: 0o700 });
  const args = ['-std=c17', '-O2', '-D_FORTIFY_SOURCE=2', '-fstack-protector-strong', '-Wall', '-Wextra', '-Werror', '-Wformat=2', '-Wconversion', '-Wshadow', '-Wno-deprecated-declarations', '-Wl,-z,relro,-z,now', source, '-lcrypto', '-ldl', '-o', outputPath];
  const result = await new Promise((resolve, reject) => {
    const child = spawn(compiler, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = []; const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk)); child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', reject); child.once('close', (code) => resolve({ code, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }));
  });
  if (result.code !== 0) throw Object.assign(new Error('reflexion termination native build failed'), { stdout: result.stdout, stderr: result.stderr });
  fs.chmodSync(outputPath, 0o700);
  return Object.freeze({ outputPath, stdout: result.stdout, stderr: result.stderr });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve('.kstack/native-build/reflexion-termination/kstack-reflexion-termination-native');
  buildReflexionTerminationNative({ outputPath }).then(() => process.stdout.write(`${JSON.stringify({ outputPath })}\n`)).catch((error) => {
    process.stderr.write(error.stderr?.toString() || `${error.message}\n`); process.exitCode = 2;
  });
}
