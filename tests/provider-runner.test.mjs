import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitize } from '../plugins/kstack/scripts/kstack-provider-runner.mjs';

test('sanitize redacts Atlassian API tokens and Basic auth payloads', () => {
  const atlassianToken = 'ATATT3xFfGF0abcdefghijklmnopqrstuvwxyz0123456789_-';
  assert.equal(sanitize(`token ${atlassianToken}`), 'token [REDACTED TOKEN]');
  assert.equal(
    sanitize('Authorization: Basic dXNlckBleGFtcGxlLmNvbTpBdGxhc3NpYW5Ub2tlbg=='),
    'Authorization: Basic [REDACTED]'
  );
});

test('sanitize redacts Jira environment assignments while retaining their keys', () => {
  assert.equal(sanitize('JIRA_API_TOKEN=opaque-jira-token-value'), 'JIRA_API_TOKEN=[REDACTED]');
  assert.equal(
    sanitize('JIRA_API_TOKEN=ATATT3xFfGF0abcdefghijklmnopqrstuvwxyz0123456789_-'),
    'JIRA_API_TOKEN=[REDACTED]'
  );
  assert.equal(sanitize('JIRA_EMAIL="engineer@example.com"'), 'JIRA_EMAIL="[REDACTED]"');
  assert.equal(
    sanitize("ATLASSIAN_API_TOKEN='another-opaque-token-value'"),
    "ATLASSIAN_API_TOKEN='[REDACTED]'"
  );
});

test('sanitize redacts Slack token variants', () => {
  for (const kind of ['b', 'a', 'p', 'r', 's']) {
    const slackToken = `xox${kind}-123456789012-123456789012-abcdefghijklmnopqrstuvwxyz`;
    assert.equal(sanitize(slackToken), '[REDACTED TOKEN]');
  }
});

test('sanitize redacts AWS access keys and secret access key assignments', () => {
  assert.equal(sanitize('access=AKIA1234567890ABCDEF'), 'access=[REDACTED AWS ACCESS KEY]');
  assert.equal(
    sanitize('AWS_SECRET_ACCESS_KEY="AbCdEfGhIjKlMnOpQrStUvWxYz0123456789+/AB"'),
    'AWS_SECRET_ACCESS_KEY="[REDACTED]"'
  );
});

test('sanitize redacts long opaque generic credential assignments only at the value', () => {
  const samples = [
    ["api_key='AbCdEfGhIjKlMnOp'", "api_key='[REDACTED]'"],
    ['api-key: "AbCdEfGhIjKlMnOp"', 'api-key: "[REDACTED]"'],
    ['TOKEN=AbCdEfGhIjKlMnOp', 'TOKEN=[REDACTED]'],
    ['secret = AbCdEfGhIjKlMnOp', 'secret = [REDACTED]'],
    ['password: AbCdEfGhIjKlMnOp', 'password: [REDACTED]'],
    ['DB_PASSWORD=AbCdEfGhIjKlMnOp', 'DB_PASSWORD=[REDACTED]'],
    ['credential=AbCdEfGhIjKlMnOp', 'credential=[REDACTED]']
  ];
  for (const [input, expected] of samples) assert.equal(sanitize(input), expected);
  assert.equal(sanitize('token=short-value'), 'token=short-value');
});

test('sanitize retains existing private key, GitHub/OpenAI token, and Bearer behavior', () => {
  const privateKey = '-----BEGIN PRIVATE KEY-----\nprivate-material\n-----END PRIVATE KEY-----';
  assert.equal(sanitize(privateKey), '[REDACTED PRIVATE KEY]');
  assert.equal(sanitize('ghp_abcdefghijklmnopqrstuvwxyz'), '[REDACTED TOKEN]');
  assert.equal(sanitize('sk-abcdefghijklmnopqrstuvwxyz'), '[REDACTED TOKEN]');
  assert.equal(sanitize('Authorization: Bearer abc.def_ghi-jkl=='), 'Authorization: Bearer [REDACTED]');
});
