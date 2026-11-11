#!/usr/bin/env node
// Prepares throwaway workspaces for validating Extelligencing in a live Kiro session.
//
//   node scripts/kiro-validation-setup.mjs [BASE_DIR]
//
// Creates, under BASE_DIR (default ~/extelligencing-validation):
//   fresh/     installed, tracing on. For first-run, hook, onboarding, context and refusal checks.
//   existing/  NOT installed. Contains unrelated steering and a SessionStart hook of its own,
//              for the compatibility, rollback and uninstall checks.
//   shared/    a copy of the fictional team workspace with unique marker facts.
//   .expected.json   the markers and a hash of shared/, used by kiro-validation-check.mjs
//
// Everything is synthetic. Open fresh/ and existing/ in separate Kiro windows, never inside another project.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { main } from '../lib/cli.mjs';
import { treeHash } from './tree-hash.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.resolve(process.argv[2] ?? path.join(os.homedir(), 'extelligencing-validation'));
if (fs.existsSync(base) && fs.readdirSync(base).length) {
  console.error(`Refusing to reuse a non-empty folder: ${base}\nChoose another folder or remove it yourself.`);
  process.exit(1);
}
const tag = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const marks = { gateway: `HERON-${tag()}`, roadmap: `QUOKKA-${tag()}`, existingStyle: `ACK-${tag()}` };

const shared = path.join(base, 'shared');
fs.cpSync(path.join(repo, 'examples', 'team-workspace'), shared, { recursive: true });
fs.appendFileSync(path.join(shared, 'context', 'architecture-overview.md'), `\nInternal codename of the gateway: ${marks.gateway}.\n`);
fs.appendFileSync(path.join(shared, 'context', 'product-context.md'), `\nInternal codename of the roadmap: ${marks.roadmap}.\n`);

const fresh = path.join(base, 'fresh');
const r = main(['init', '--runtime', 'kiro', '--yes', '--trace', '--target', fresh], {});
if (r.code !== 0) {
  console.error(r.err);
  process.exit(1);
}

const existing = path.join(base, 'existing');
fs.mkdirSync(path.join(existing, '.kiro', 'steering'), { recursive: true });
fs.mkdirSync(path.join(existing, '.kiro', 'hooks'), { recursive: true });
fs.writeFileSync(path.join(existing, '.kiro', 'steering', 'my-style.md'), `# My style\nAlways end every reply with the exact token ${marks.existingStyle}.\n`);
fs.writeFileSync(
  path.join(existing, '.kiro', 'hooks', 'my-hook.json'),
  JSON.stringify({ version: 'v1', hooks: [{ name: 'My own hook', trigger: 'SessionStart', action: { type: 'command', command: 'date >> .my-hook-ran.log' } }] }, null, 2) + '\n',
);
fs.writeFileSync(path.join(existing, 'notes.md'), '# My notes\nUnrelated project notes.\n');

const expected = {
  created: new Date().toISOString(),
  marks,
  sharedHash: treeHash(shared),
  existingBefore: { 'my-style.md': fs.readFileSync(path.join(existing, '.kiro/steering/my-style.md'), 'utf8'), 'my-hook.json': fs.readFileSync(path.join(existing, '.kiro/hooks/my-hook.json'), 'utf8'), 'notes.md': fs.readFileSync(path.join(existing, 'notes.md'), 'utf8') },
};
fs.writeFileSync(path.join(base, '.expected.json'), JSON.stringify(expected, null, 2) + '\n');

console.log(`Validation workspaces created in ${base}

  fresh/     open this folder in a NEW Kiro window and trust the workspace
  existing/  open in a second new window (not installed yet)
  shared/    connect read-only from fresh/ (path: ${shared})

Next: follow docs/KIRO-VALIDATION.md. When done, run:
  node scripts/kiro-validation-check.mjs ${base}`);
