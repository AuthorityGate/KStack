import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

const [requestLogPath] = process.argv.slice(2);
if (!requestLogPath) throw new Error('request log path required');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const response = [
  'data: {"id":"chatcmpl-kstack-goose","object":"chat.completion.chunk","created":0,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-kstack-goose","object":"chat.completion.chunk","created":0,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"KSTACK_GOOSE_ADVISORY_OK"},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-kstack-goose","object":"chat.completion.chunk","created":0,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
  '',
  'data: {"id":"chatcmpl-kstack-goose","object":"chat.completion.chunk","created":0,"model":"gpt-4o","choices":[],"usage":{"prompt_tokens":100,"completion_tokens":10,"total_tokens":110}}',
  '',
  'data: [DONE]',
  '',
  ''
].join('\n');

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
    if (request.method === 'POST' && request.url === '/v1/chat/completions') {
      let parsed;
      try { parsed = JSON.parse(body.toString('utf8')); } catch { parsed = null; }
      fs.appendFileSync(requestLogPath, `${JSON.stringify({ method: request.method, path: request.url, bodySha256: sha256(body), body: parsed })}\n`, { encoding: 'utf8', mode: 0o600 });
      if (!parsed || !JSON.stringify(parsed).includes('KSTACK_GOOSE_ADVISORY_OK')) {
        reply.writeHead(417, { 'content-type': 'application/json' });
        reply.end('{"error":{"message":"qualification prompt mismatch"}}');
        return;
      }
      reply.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
      reply.end(response);
      return;
    }
    reply.writeHead(404, { 'content-type': 'application/json' });
    reply.end('{"error":{"message":"unexpected qualification request"}}');
  });
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(49152, '127.0.0.1', resolve); });
process.stdout.write('READY http://127.0.0.1:49152\n');
const stop = () => server.close(() => process.exit(0));
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
