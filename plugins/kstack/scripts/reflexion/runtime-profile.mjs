export const CONDITION_IDENTIFIER = 'node-esm-import-default-v1';
export const RESOLVER_PROBE_IDENTIFIER = '3e2a3a2daf77c4c2b16d2919f86995f41188248b553f62c27e4f448b03d31f64';

const PROFILES = Object.freeze([
  Object.freeze({
    id: 'node-24.12-unicode-16', node: '24.12', v8: '13.6', icu: '77.1', unicode: '16.0',
    platform: 'posix', arch: null,
    unicodeProbeSha256: 'ce0453507f8603f09be1d4b7581d47b8a39f040189e9bf43b193f2c88f4f3f23'
  }),
  Object.freeze({
    id: 'windows-node-24.19-unicode-17', node: '24.19', v8: '13.6', icu: '78.3', unicode: '17.0',
    platform: 'win32', arch: 'x64',
    unicodeProbeSha256: '97c358e818dc7f9e236bad4a21592c49053b06335ea0811936ba668a271f023b'
  })
]);

function majorMinor(value) { return typeof value === 'string' ? value.match(/^\d+\.\d+/u)?.[0] : undefined; }

export function normalizeRuntimeFields(snapshot, platform, arch) {
  return Object.freeze({
    node: majorMinor(snapshot?.node), v8: majorMinor(snapshot?.v8), icu: majorMinor(snapshot?.icu),
    unicode: snapshot?.unicode, icuSmall: snapshot?.icuSmall, v8I18n: snapshot?.v8I18n,
    platform, arch
  });
}

export function currentRuntimeFields() {
  return normalizeRuntimeFields({
    node: process.versions.node, v8: process.versions.v8, icu: process.versions.icu,
    unicode: process.versions.unicode, icuSmall: process.config.variables.icu_small,
    v8I18n: process.config.variables.v8_enable_i18n_support
  }, process.platform, process.arch);
}

export function selectRuntimeProfile(fields) {
  if (!fields || fields.icuSmall !== false || fields.v8I18n !== 1) return null;
  return PROFILES.find((profile) => profile.node === fields.node && profile.v8 === fields.v8
    && profile.icu === fields.icu && profile.unicode === fields.unicode
    && (profile.platform === 'posix' ? fields.platform !== 'win32' : fields.platform === profile.platform)
    && (profile.arch === null || fields.arch === profile.arch)) ?? null;
}

export function runtimeProfiles() { return PROFILES; }
