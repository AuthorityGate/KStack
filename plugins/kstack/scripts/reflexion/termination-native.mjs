import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export const TERMINATION_NATIVE_ABI = 'kstack-reflexion-termination-native-abi-v1';

export async function invokeTerminationNative(binaryPath, args, { timeout = 10_000 } = {}) {
  if (typeof binaryPath !== 'string' || !Array.isArray(args) || args.some((value) => typeof value !== 'string')) throw new TypeError('native binary path and string argument array are required');
  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, args, { encoding: 'utf8', timeout, maxBuffer: 1_048_576, windowsHide: true });
    if (stderr !== '') throw new Error('TERMINATION_NATIVE_STDERR');
    const result = JSON.parse(stdout);
    if (result?.abiVersion !== TERMINATION_NATIVE_ABI) throw new Error('TERMINATION_NATIVE_ABI_MISMATCH');
    return Object.freeze(result);
  } catch (error) {
    const stdout = typeof error.stdout === 'string' ? error.stdout : '';
    if (stdout) {
      try {
        const result = JSON.parse(stdout);
        if (result?.abiVersion === TERMINATION_NATIVE_ABI && result.ok === false) return Object.freeze(result);
      } catch {}
    }
    throw error;
  }
}

export function expectedClone3Arguments(cgroupFd) {
  if (!Number.isInteger(cgroupFd) || cgroupFd < 0) throw new TypeError('cgroupFd must be a nonnegative descriptor');
  return Object.freeze({ flags: Object.freeze(['CLONE_INTO_CGROUP', 'CLONE_PIDFD']), cgroupFd, exitSignal: 'SIGCHLD', pidfdStorage: 'clone_args.pidfd' });
}
