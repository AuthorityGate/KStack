import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

const [requestLogPath] = process.argv.slice(2);
if (!requestLogPath) throw new Error('request log path required');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const writeLog = (row) => fs.appendFileSync(requestLogPath, `${JSON.stringify(row)}\n`, { encoding: 'utf8', mode: 0o600 });

function sse(reply, chunks) {
  reply.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store',
    connection: 'close'
  });
  for (const chunk of chunks) reply.write(`data: ${JSON.stringify(chunk)}\n\n`);
  reply.end('data: [DONE]\n\n');
}

function firstTurn(reply) {
  sse(reply, [
    {
      id: 'chatcmpl-kstack-opencode-tool', object: 'chat.completion.chunk', created: 0,
      model: 'kstack-qualification', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]
    },
    {
      id: 'chatcmpl-kstack-opencode-tool', object: 'chat.completion.chunk', created: 0,
      model: 'kstack-qualification', choices: [{
        index: 0,
        delta: { tool_calls: [{ index: 0, id: 'call_kstack_skill', type: 'function', function: { name: 'skill', arguments: '{"name":"kstack-causal-probe"}' } }] },
        finish_reason: null
      }]
    },
    {
      id: 'chatcmpl-kstack-opencode-tool', object: 'chat.completion.chunk', created: 0,
      model: 'kstack-qualification', choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }]
    },
    {
      id: 'chatcmpl-kstack-opencode-tool', object: 'chat.completion.chunk', created: 0,
      model: 'kstack-qualification', choices: [], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }
    }
  ]);
}

function secondTurn(reply, bodyText) {
  const match = bodyText.match(/Observation fixture [a-z0-9._-]+: return only ([0-9a-f]{64})\./u);
  if (!match) {
    reply.writeHead(417, { 'content-type': 'application/json' });
    reply.end('{"error":{"message":"native skill tool result missing qualification clause"}}');
    return;
  }
  const token = match[1];
  sse(reply, [
    {
      id: 'chatcmpl-kstack-opencode-answer', object: 'chat.completion.chunk', created: 0,
      model: 'kstack-qualification', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]
    },
    {
      id: 'chatcmpl-kstack-opencode-answer', object: 'chat.completion.chunk', created: 0,
      model: 'kstack-qualification', choices: [{ index: 0, delta: { content: token }, finish_reason: null }]
    },
    {
      id: 'chatcmpl-kstack-opencode-answer', object: 'chat.completion.chunk', created: 0,
      model: 'kstack-qualification', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
    },
    {
      id: 'chatcmpl-kstack-opencode-answer', object: 'chat.completion.chunk', created: 0,
      model: 'kstack-qualification', choices: [], usage: { prompt_tokens: 140, completion_tokens: 20, total_tokens: 160 }
    }
  ]);
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
      writeLog({ sequence, method: request.method, path: request.url, bodySha256: sha256(body), phase: 'MODEL_LIST' });
      reply.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      reply.end('{"object":"list","data":[{"id":"kstack-qualification","object":"model","created":0,"owned_by":"kstack"}]}');
      return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
      writeLog({ sequence, method: request.method, path: request.url, bodySha256: sha256(body), phase: 'UNEXPECTED' });
      reply.writeHead(404, { 'content-type': 'application/json' });
      reply.end('{"error":{"message":"unexpected qualification request"}}');
      return;
    }
    let parsed;
    try { parsed = JSON.parse(bodyText); } catch { parsed = null; }
    const messages = Array.isArray(parsed?.messages) ? parsed.messages : [];
    const roles = messages.map((message) => message?.role ?? null);
    const containsToolResult = roles.includes('tool');
    const challengeMatches = [...bodyText.matchAll(/Observation fixture [a-z0-9._-]+: return only ([0-9a-f]{64})\./gu)];
    writeLog({
      sequence,
      method: request.method,
      path: request.url,
      bodySha256: sha256(body),
      phase: containsToolResult ? 'AFTER_NATIVE_SKILL_RESULT' : 'BEFORE_NATIVE_SKILL_RESULT',
      roles,
      challengeTokenCount: challengeMatches.length,
      challengeTokenDigests: challengeMatches.map((match) => sha256(match[1]))
    });
    if (!parsed || parsed.model !== 'kstack-qualification') {
      reply.writeHead(417, { 'content-type': 'application/json' });
      reply.end('{"error":{"message":"qualification model mismatch"}}');
      return;
    }
    if (containsToolResult) secondTurn(reply, bodyText);
    else if (challengeMatches.length === 0) firstTurn(reply);
    else {
      reply.writeHead(417, { 'content-type': 'application/json' });
      reply.end('{"error":{"message":"challenge token disclosed before native skill result"}}');
    }
  });
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(49153, '127.0.0.1', resolve);
});
process.stdout.write('READY http://127.0.0.1:49153/v1\n');
const stop = () => server.close(() => process.exit(0));
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
