import fs from 'node:fs';
import { parentPort, workerData } from 'node:worker_threads';

let stopped = false;
function beat() {
  if (stopped) return;
  try {
    const current = fs.readFileSync(workerData.path);
    if (!current.equals(Buffer.from(workerData.bytes, 'base64'))) throw new Error('lock-mismatch');
    const now = new Date();
    fs.utimesSync(workerData.path, now, now);
    parentPort.postMessage({ type: 'heartbeat', at: Date.now() });
  } catch {
    parentPort.postMessage({ type: 'error' });
    stopped = true;
  }
}
parentPort.on('message', (message) => {
  if (message === 'stop') {
    stopped = true;
    parentPort.postMessage({ type: 'stopped' });
  }
});
beat();
const timer = setInterval(beat, workerData.intervalMs);
timer.unref();
