import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { main } from '../lib/cli.mjs';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEAM = path.join(REPO, 'examples', 'team-workspace');

export function tmp(prefix = 'extelligencing-test-') {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

/** Run the CLI in-process against a workspace root. */
export function extelligencing(root, args, env = {}) {
  return main(args, { root, env: { EXTELLIGENCING_NOW: '2026-11-11T10:00:00Z', ...env } });
}

export function ok(root, args, env) {
  const r = extelligencing(root, args, env);
  if (r.code !== 0) throw new Error(`extelligencing ${args.join(' ')} failed: ${r.err || r.out}`);
  return r.out;
}

export function install(root, runtime = 'kiro') {
  return ok(root, ['init', '--runtime', runtime, '--yes']);
}

export function persona(name, replace = {}) {
  let text = fs.readFileSync(path.join(REPO, 'examples', 'personas', `${name}.json`), 'utf8');
  for (const [k, v] of Object.entries(replace)) text = text.replaceAll(k, v);
  return text;
}

export function activate(root, name, replace) {
  return ok(root, ['onboarding', 'activate', '--json', persona(name, replace)]);
}

/** Hash every file under a directory, for "nothing changed" assertions. */
export function treeHash(dir) {
  const h = crypto.createHash('sha256');
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else h.update(path.relative(dir, p) + '\0' + fs.readFileSync(p));
    }
  };
  walk(dir);
  return h.digest('hex');
}

export function copyDir(src, dst) {
  fs.cpSync(src, dst, { recursive: true });
}

export const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
export const has = (root, rel) => fs.existsSync(path.join(root, rel));
