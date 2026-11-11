import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { tmp, REPO, install, ok, extelligencing, read, has, activate } from './helpers.mjs';

function listAll(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p));
    }
  };
  walk(dir);
  return out;
}

test('Scenario A: product owner end to end', () => {
  const root = tmp();
  install(root);
  assert.match(ok(root, ['boot']), /onboarding has not been done/);
  activate(root, 'product-owner');
  assert.equal(ok(root, ['boot']), '');
  assert.match(read(root, '.extelligencing/profile.md'), /Product Owner/);
  const route = JSON.parse(ok(root, ['context', 'route', '--task', 'drafting', '--json']));
  assert.ok(route.items.some((i) => i.path === '.extelligencing/preferences.json' && i.scope === 'personal'));
  ok(root, ['evidence', 'propose', '--json', JSON.stringify({ kind: 'hypothesis', summary: 'Likes templates for stakeholder updates', instances: ['one update'] })]);
  ok(root, ['evidence', 'reject', 'ev-20261111-001']);
  assert.ok(!has(root, '.extelligencing/evidence/log.md'));
});

test('Scenario B: engineer gets a workspace with no product templates forced on them', () => {
  const root = tmp();
  install(root);
  activate(root, 'software-engineer');
  const files = listAll(root);
  assert.ok(!files.some((f) => /template|prd|story|epic/i.test(f)), files.join('\n'));
  const profile = read(root, '.extelligencing/profile.md');
  assert.match(profile, /Software engineer/);
  assert.match(profile, /Occasional on-call responder/);
  assert.doesNotMatch(profile, /Product/i);
  const route = JSON.parse(ok(root, ['context', 'route', '--task', 'drafting', '--json']));
  assert.ok(route.items.every((i) => i.scope !== 'shared'));
});

test('the same core serves different roles: configuration differs, installed policy files are identical', () => {
  const a = tmp();
  const b = tmp();
  install(a);
  install(b);
  activate(a, 'product-owner');
  activate(b, 'software-engineer');
  for (const f of listAll(path.join(a, '.kiro'))) assert.equal(read(a, `.kiro/${f}`), read(b, `.kiro/${f}`));
  assert.notEqual(read(a, '.extelligencing/profile.md'), read(b, '.extelligencing/profile.md'));
});

test('fresh install passes doctor and boot works from the installed hook command', () => {
  const root = tmp();
  install(root);
  const cmd = JSON.parse(read(root, '.kiro/hooks/extelligencing-boot.json')).hooks[0].action.command.split(' ');
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Extelligencing/);
  assert.equal(extelligencing(root, ['doctor']).code, 0);
});

test('boot fails safely (no output, non-zero exit) when Extelligencing state is missing', () => {
  const root = tmp();
  const r = extelligencing(root, ['boot']);
  assert.notEqual(r.code, 0);
  assert.match(r.err, /not installed/i);
});

test('always-on kernel stays small and carries the required policies', () => {
  const kernel = fs.readFileSync(path.join(REPO, 'core', 'kernel.md'), 'utf8');
  assert.ok(kernel.split(/\s+/).length < 500, 'kernel under 500 words');
  for (const needle of ['Authority', 'Proportionality', 'Restraint', 'Persistence', 'Shared workspace', 'hypothesis', 'Honesty about limits']) {
    assert.ok(kernel.includes(needle), needle);
  }
});

test('public repository hygiene: generic release checks pass', () => {
  const r = spawnSync('node', ['scripts/release-check.mjs'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('hook simulation: documented invocation (shell, workspace root, JSON on stdin) works; trace records it', async () => {
  const root = tmp();
  ok(root, ['init', '--runtime', 'kiro', '--yes', '--trace']);
  const command = JSON.parse(read(root, '.kiro/hooks/extelligencing-boot.json')).hooks[0].action.command;
  const input = JSON.stringify({ hook_event_name: 'SessionStart', cwd: root, session_id: 's1' });
  const r = spawnSync('sh', ['-c', command], { cwd: root, input, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Validation code: EXT-[0-9a-f]{8}/);
  const line = JSON.parse(read(root, '.extelligencing/trace.log').trim().split('\n').at(-1));
  assert.equal(line.action, 'start');
  assert.equal(line.nonce, r.stdout.match(/EXT-[0-9a-f]{8}/)[0]);
  assert.deepEqual(line.stdin.keys, ['cwd', 'hook_event_name', 'session_id']);
  assert.ok(Array.isArray(line.ancestors));
});

test('hook simulation: stdin that never closes cannot hang the hook', async () => {
  const root = tmp();
  ok(root, ['init', '--runtime', 'kiro', '--yes', '--trace']);
  const { spawn } = await import('node:child_process');
  const child = spawn('sh', ['-c', 'node .extelligencing/runtime/bin/extelligencing.mjs boot'], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
  const t0 = Date.now();
  const code = await new Promise((resolve) => {
    const guard = setTimeout(() => {
      child.kill();
      resolve('timeout');
    }, 4000);
    child.on('exit', (c) => {
      clearTimeout(guard);
      resolve(c);
    });
  }); // stdin is never written to or closed
  assert.equal(code, 0);
  assert.ok(Date.now() - t0 < 3000);
});

test('hook simulation: from another directory the relative command fails loudly, and `doctor` is the diagnostic', () => {
  const root = tmp();
  install(root);
  const command = JSON.parse(read(root, '.kiro/hooks/extelligencing-boot.json')).hooks[0].action.command;
  const r = spawnSync('sh', ['-c', command], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.equal(r.stdout, '', 'a failing hook must not print a misleading success message');
});

test('trace is off by default and boot output carries no validation code', () => {
  const root = tmp();
  install(root);
  assert.doesNotMatch(ok(root, ['boot']), /Validation code/);
  assert.ok(!has(root, '.extelligencing/trace.log'));
});
