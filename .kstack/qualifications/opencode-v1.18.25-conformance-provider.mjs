import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

const [requestLogPath] = process.argv.slice(2);
if (!requestLogPath) throw new Error('request log path required');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const writeLog = (row) => fs.appendFileSync(requestLogPath, `${JSON.stringify(row)}\n`, { encoding: 'utf8', mode: 0o600 });

function sse(reply, id, chunks) {
  reply.writeHead(200, {
    'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'close'
  });
  for (const chunk of chunks) reply.write(`data: ${JSON.stringify({
    id, object: 'chat.completion.chunk', created: 0, model: 'kstack-qualification', ...chunk
  })}\n\n`);
  reply.end('data: [DONE]\n\n');
}

function toolTurn(reply, fixtureId, name, args) {
  sse(reply, `chatcmpl-${fixtureId}-tool`, [
    { choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] },
    { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: `call_${fixtureId.replace(/[^a-z0-9]/gu, '_')}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: null }] },
    { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
    { choices: [], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } }
  ]);
}

function textTurn(reply, fixtureId, value) {
  sse(reply, `chatcmpl-${fixtureId}-text`, [
    { choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] },
    { choices: [{ index: 0, delta: { content: value }, finish_reason: null }] },
    { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
    { choices: [], usage: { prompt_tokens: 140, completion_tokens: 20, total_tokens: 160 } }
  ]);
}

function fixtureIdFrom(bodyText) {
  return bodyText.match(/observation fixture ([a-z0-9._-]+)/u)?.[1] ?? 'unknown-fixture';
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
    const bodyText = body.toString('utf8');
    sequence += 1;
    if (request.method === 'GET' && request.url === '/v1/models') {
      writeLog({ sequence, method: request.method, path: request.url, bodySha256: sha256(body), fixtureId: null, phase: 'MODEL_LIST' });
      reply.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      reply.end('{"object":"list","data":[{"id":"kstack-qualification","object":"model","created":0,"owned_by":"kstack"}]}');
      return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
      writeLog({ sequence, method: request.method, path: request.url, bodySha256: sha256(body), fixtureId: null, phase: 'UNEXPECTED' });
      reply.writeHead(404, { 'content-type': 'application/json' });
      reply.end('{"error":{"message":"unexpected qualification request"}}');
      return;
    }
    let parsed;
    try { parsed = JSON.parse(bodyText); } catch { parsed = null; }
    const messages = Array.isArray(parsed?.messages) ? parsed.messages : [];
    const roles = messages.map((message) => message?.role ?? null);
    const containsToolResult = roles.includes('tool');
    const fixtureId = fixtureIdFrom(bodyText);
    const tokenMatches = [...bodyText.matchAll(/Observation fixture [a-z0-9._-]+: return only ([0-9a-f]{64})\./gu)];
    const phase = containsToolResult ? 'AFTER_NATIVE_TOOL_RESULT' : 'BEFORE_NATIVE_TOOL_RESULT';
    writeLog({
      sequence, method: request.method, path: request.url, bodySha256: sha256(body),
      fixtureId, phase, roles, tokenCount: tokenMatches.length,
      tokenDigests: tokenMatches.map((match) => sha256(match[1]))
    });
    if (!parsed || parsed.model !== 'kstack-qualification') {
      reply.writeHead(417, { 'content-type': 'application/json' });
      reply.end('{"error":{"message":"qualification model mismatch"}}');
      return;
    }
    if (fixtureId === 'receipt-ambiguity.negative.v1') {
      request.socket.destroy();
      return;
    }
    if (fixtureId === 'background-lifecycle.negative.v1') return;
    if (fixtureId === 'native-permissions.negative.v1') {
      if (!containsToolResult) toolTurn(reply, fixtureId, 'bash', { command: 'printf KSTACK_FORBIDDEN_NATIVE_ACTION > forbidden-native-action.txt' });
      else textTurn(reply, fixtureId, 'NATIVE_PERMISSION_DENIED');
      return;
    }
    if (!containsToolResult) {
      if (tokenMatches.length !== 0) {
        reply.writeHead(417, { 'content-type': 'application/json' });
        reply.end('{"error":{"message":"fixture token disclosed before native skill result"}}');
      } else toolTurn(reply, fixtureId, 'skill', { name: 'kstack-conformance-probe' });
      return;
    }
    if (fixtureId === 'hostile-data.negative.v1') {
      textTurn(reply, fixtureId, 'password=synthetic-fixture-value-not-a-credential');
      return;
    }
    const token = tokenMatches[0]?.[1];
    if (!token || tokenMatches.length !== 1) {
      reply.writeHead(417, { 'content-type': 'application/json' });
      reply.end('{"error":{"message":"native skill result missing exact fixture token"}}');
      return;
    }
    textTurn(reply, fixtureId, token);
  });
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(49154, '127.0.0.1', resolve);
});
process.stdout.write('READY http://127.0.0.1:49154/v1\n');
const stop = () => server.close(() => process.exit(0));
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
