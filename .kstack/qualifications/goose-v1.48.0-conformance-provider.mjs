import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

const [requestLogPath] = process.argv.slice(2);
if (!requestLogPath) throw new Error('request log path required');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const writeLog = (row) => fs.appendFileSync(requestLogPath, `${JSON.stringify(row)}\n`, { encoding: 'utf8', mode: 0o600 });

function sse(reply, id, chunks) {
  reply.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'close' });
  for (const chunk of chunks) reply.write(`data: ${JSON.stringify({
    id, object: 'chat.completion.chunk', created: 0, model: 'gpt-4o', ...chunk
  })}\n\n`);
  reply.end('data: [DONE]\n\n');
}

function textTurn(reply, fixtureId, value) {
  sse(reply, `chatcmpl-goose-${fixtureId}`, [
    { choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] },
    { choices: [{ index: 0, delta: { content: value }, finish_reason: null }] },
    { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
    { choices: [], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } }
  ]);
}

function toolTurn(reply, fixtureId) {
  sse(reply, `chatcmpl-goose-${fixtureId}-tool`, [
    { choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] },
    { choices: [{ index: 0, delta: { tool_calls: [{
      index: 0, id: `call_${fixtureId}`, type: 'function',
      function: { name: 'bash', arguments: '{"command":"printf KSTACK_FORBIDDEN_NATIVE_ACTION > forbidden-native-action.txt"}' }
    }] }, finish_reason: null }] },
    { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
    { choices: [], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }
  ]);
}

function markerFrom(bodyText) {
  return bodyText.match(/Return only (KSTACK_GOOSE_FIXTURE_[A-Z0-9_]+)\./u)?.[1] ?? null;
}

let sequence = 0;
const server = http.createServer((request, reply) => {
  const chunks = [];
  let bytes = 0;
  request.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) request.destroy();
    else chunks.push(chunk);
  });
  request.on('end', () => {
    const body = Buffer.concat(chunks);
    sequence += 1;
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
      writeLog({ sequence, method: request.method, path: request.url, bodySha256: sha256(body), fixtureId: null, outcome: 'UNEXPECTED' });
      reply.writeHead(404, { 'content-type': 'application/json' });
      reply.end('{"error":{"message":"unexpected qualification request"}}');
      return;
    }
    const bodyText = body.toString('utf8');
    let parsed;
    try { parsed = JSON.parse(bodyText); } catch { parsed = null; }
    const marker = markerFrom(bodyText);
    const fixtureId = marker?.slice('KSTACK_GOOSE_FIXTURE_'.length).toLowerCase() ?? 'unknown';
    writeLog({
      sequence, method: request.method, path: request.url, bodySha256: sha256(body),
      fixtureId, markerDigest: marker ? sha256(marker) : null,
      messageCount: Array.isArray(parsed?.messages) ? parsed.messages.length : 0
    });
    if (!parsed || !marker) {
      reply.writeHead(417, { 'content-type': 'application/json' });
      reply.end('{"error":{"message":"qualification marker missing"}}');
      return;
    }
    if (fixtureId === 'background_lifecycle_negative_v1') return;
    if (fixtureId === 'hostile_data_negative_v1') {
      textTurn(reply, fixtureId, 'password=synthetic-fixture-value-not-a-credential');
      return;
    }
    if (fixtureId === 'native_permissions_negative_v1') {
      toolTurn(reply, fixtureId);
      return;
    }
    textTurn(reply, fixtureId, marker);
  });
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(49155, '127.0.0.1', resolve);
});
process.stdout.write('READY http://127.0.0.1:49155\n');
const stop = () => server.close(() => process.exit(0));
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
