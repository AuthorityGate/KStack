const matcherDefinitions = Object.freeze([
  Object.freeze({ id: 'private-key', source: '-----BEGIN [^-]*PRIVATE KEY-----', flags: 'i' }),
  Object.freeze({ id: 'basic-auth', source: '\\bBasic\\s+[A-Za-z0-9+/]+={0,2}', flags: 'i' }),
  Object.freeze({ id: 'jira-atlassian', source: '\\b(?:JIRA|ATLASSIAN)_(?:API_TOKEN|EMAIL)\\s*=\\s*[\"\']?[^\\s\"\']+', flags: 'i' }),
  Object.freeze({ id: 'github-openai', source: '\\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\\b', flags: '' }),
  Object.freeze({ id: 'atlassian-token', source: '\\bATATT3xF[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])', flags: '' }),
  Object.freeze({ id: 'slack-token', source: '\\bxox[baprs]-[A-Za-z0-9-]+\\b', flags: '' }),
  Object.freeze({ id: 'aws-access-key', source: '\\bAKIA[0-9A-Z]{16}\\b', flags: '' }),
  Object.freeze({ id: 'aws-secret-key', source: '\\b(?:AWS[_-]?)?SECRET[_-]?ACCESS[_-]?KEY\\s*[:=]\\s*[\"\']?[A-Za-z0-9/+=]{40}', flags: 'i' }),
  Object.freeze({ id: 'generic-assignment', source: '(?:api[_-]?key|token|secret|password|credential)\\s*[:=]\\s*[\"\']?[A-Za-z0-9+/_.=-]{12,}', flags: 'i' }),
  Object.freeze({ id: 'bearer-auth', source: '\\bBearer\\s+[A-Za-z0-9._~+\\/-]+=*', flags: 'i' })
]);

export const MATCHER_VERSION = 'MatcherSetV1-byte-latin1';

export function matcherSetV1() {
  return matcherDefinitions.map(({ id, source, flags }) => Object.freeze({ id, pattern: new RegExp(source, flags) }));
}

export function findOutboundSecret(value, { byteDomain = false } = {}) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  // latin1 is a lossless one-code-unit-per-byte mapping. It gives every Git
  // object, including NUL and invalid UTF-8, one deterministic matcher domain.
  const text = byteDomain ? bytes.toString('latin1') : new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  for (const { id, pattern } of matcherSetV1()) {
    const match = pattern.exec(text);
    if (match) return Object.freeze({ matcherId: id, offset: match.index, length: match[0].length });
  }
  return null;
}

export function assertOutboundSecretScan(value, options) {
  if (findOutboundSecret(value, options)) throw new Error('OUTBOUND_SECRET_SCAN_REJECTED');
}

export function sanitize(value) {
  return value
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/\bBasic\s+[A-Za-z0-9+/]+={0,2}/gi, 'Basic [REDACTED]')
    .replace(/(\b(?:JIRA|ATLASSIAN)_(?:API_TOKEN|EMAIL)\s*=\s*)(['"]?)[^\s'"]+\2/gi, '$1$2[REDACTED]$2')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g, '[REDACTED TOKEN]')
    .replace(/\bATATT3xF[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])/g, '[REDACTED TOKEN]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]+\b/g, '[REDACTED TOKEN]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED AWS ACCESS KEY]')
    .replace(/(\b(?:AWS[_-]?)?SECRET[_-]?ACCESS[_-]?KEY\s*[:=]\s*)(['"]?)[A-Za-z0-9/+=]{40}\2/gi, '$1$2[REDACTED]$2')
    .replace(/((?:api[_-]?key|token|secret|password|credential)\s*[:=]\s*)(['"]?)[A-Za-z0-9+/_.=-]{12,}\2/gi, '$1$2[REDACTED]$2')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]');
}
