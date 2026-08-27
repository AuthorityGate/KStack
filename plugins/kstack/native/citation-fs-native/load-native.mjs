import { createRequire } from 'node:module';

const ABI_VERSION = 'kstack-citation-fs-native-abi-v2';
const EXPORTS = ['applyAndInspectProtectionFd', 'inspectDirectoryFd', 'inspectFileFd', 'inspectProtectionFd', 'selfTest'];

export function loadCitationFsNative(artifactPath) {
  const addon = createRequire(import.meta.url)(artifactPath);
  if (!addon || Object.keys(addon).sort().join('\0') !== EXPORTS.join('\0') || EXPORTS.some((name) => typeof addon[name] !== 'function')) throw new Error('NATIVE_ADDON_UNAVAILABLE');
  const result = addon.selfTest();
  if (!result || Object.keys(result).sort().join('\0') !== ['abiVersion', 'platform', 'verdict'].join('\0') || result.abiVersion !== ABI_VERSION || result.platform !== 'linux' || result.verdict !== 'pass') throw new Error('NATIVE_ADDON_UNAVAILABLE');
  return addon;
}
