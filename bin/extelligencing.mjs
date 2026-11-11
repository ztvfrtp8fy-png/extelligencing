#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../lib/cli.mjs';

// When running from an installed copy (<workspace>/.extelligencing/runtime/bin), the workspace is three levels up.
// This keeps hooks working even if the runtime starts them from another directory.
const here = path.dirname(fileURLToPath(import.meta.url));
const parts = here.split(path.sep);
const installed = parts.slice(-3).join('/') === '.extelligencing/runtime/bin';
const root = installed ? path.resolve(here, '..', '..', '..') : undefined;

const argv = process.argv.slice(2);
const hasRoot = argv.some((a) => a === '--root' || a.startsWith('--root=') || a === '--target' || a.startsWith('--target='));

// Only while tracing (validation), read the runtime's hook input from stdin, with a short timeout so a runtime
// that keeps stdin open can never hang the hook.
function traceEnabled() {
  try {
    return root && JSON.parse(fs.readFileSync(path.join(root, '.extelligencing', 'config.json'), 'utf8')).trace === true;
  } catch {
    return false;
  }
}

function readStdin(ms) {
  if (process.stdin.isTTY) return Promise.resolve(null);
  return new Promise((resolve) => {
    let data = '';
    const t = setTimeout(() => resolve(data || null), ms);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => {
      clearTimeout(t);
      resolve(data || null);
    });
    process.stdin.on('error', () => resolve(null));
  });
}

const stdin = argv[0] === 'boot' && traceEnabled() ? await readStdin(500) : null;
const res = main(argv, { root: hasRoot ? undefined : root, cwd: process.cwd(), stdin });
if (res.out) process.stdout.write(res.out + '\n');
if (res.err) process.stderr.write(res.err + '\n');
process.exit(res.code);
