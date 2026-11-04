import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const children = [
  spawn(node, ['server/index.js'], { cwd: root, env: process.env, stdio: 'inherit' }),
  spawn(node, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { cwd: root, env: process.env, stdio: 'inherit' }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 150);
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('Could not start a dev process:', error.message);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.log(`A dev process exited (${signal || code}); stopping the other process.`);
      stop(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
