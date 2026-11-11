import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmp, install, ok, extelligencing, read, has, treeHash } from './helpers.mjs';
import { inventory } from '../lib/install.mjs';

test('init without --yes changes nothing', () => {
  const root = tmp();
  const before = treeHash(root);
  const out = ok(root, ['init', '--runtime', 'kiro']);
  assert.match(out, /Nothing was changed/);
  assert.equal(treeHash(root), before);
});

test('fresh Kiro install: kernel always-on, other policies on demand, valid hook', () => {
  const root = tmp();
  install(root);
  const kernel = read(root, '.kiro/steering/extelligencing-kernel.md');
  assert.ok(!kernel.startsWith('---'), 'no front matter means always included');
  assert.ok(kernel.length < 4000, 'kernel stays small');
  for (const n of ['context-map', 'collaboration', 'evidence', 'shared-workspace']) {
    assert.match(read(root, `.kiro/steering/extelligencing-${n}.md`), /^---\ninclusion: auto\nname: extelligencing-/);
  }
  assert.match(read(root, '.kiro/steering/extelligencing-onboarding.md'), /^---\ninclusion: manual/);
  const hook = JSON.parse(read(root, '.kiro/hooks/extelligencing-boot.json'));
  assert.equal(hook.version, 'v1');
  assert.equal(hook.hooks[0].trigger, 'SessionStart');
  assert.equal(hook.hooks[0].action.type, 'command');
  assert.equal(hook.hooks[0].action.command, 'node .extelligencing/runtime/bin/extelligencing.mjs boot');
  assert.ok(has(root, '.extelligencing/.gitignore'));
  assert.equal(JSON.parse(read(root, '.extelligencing/onboarding.json')).status, 'not_started');
});

test('installed copy runs by itself and finds its workspace regardless of cwd', async () => {
  const root = tmp();
  install(root);
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('node', [path.join(root, '.extelligencing/runtime/bin/extelligencing.mjs'), 'boot'], { cwd: os_tmp(), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /onboarding has not been done/);
  const doctor = spawnSync('node', [path.join(root, '.extelligencing/runtime/bin/extelligencing.mjs'), 'doctor'], { cwd: os_tmp(), encoding: 'utf8' });
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
});
function os_tmp() {
  return fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'extelligencing-cwd-')));
}

test('install is idempotent', () => {
  const root = tmp();
  install(root);
  const h = treeHash(root);
  const again = ok(root, ['init', '--runtime', 'kiro', '--yes']);
  assert.equal(treeHash(root), h);
  assert.doesNotMatch(again, /propose-alongside/);
});

test('existing configuration is detected and never overwritten (Scenario E)', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.kiro/steering'), { recursive: true });
  fs.mkdirSync(path.join(root, '.kiro/hooks'), { recursive: true });
  const mine = '# My rules\nAlways answer in haiku.\n';
  fs.writeFileSync(path.join(root, '.kiro/steering/my-rules.md'), mine);
  fs.writeFileSync(path.join(root, '.kiro/steering/optional.md'), '---\ninclusion: manual\n---\n# x\n');
  const hook = JSON.stringify({ version: 'v1', hooks: [{ name: 'Mine', trigger: 'SessionStart', action: { type: 'command', command: 'echo hi' } }] });
  fs.writeFileSync(path.join(root, '.kiro/hooks/mine.json'), hook);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Project notes\nUse tabs.\n');
  const inv = inventory(root);
  assert.equal(inv.steering.find((s) => s.file.endsWith('my-rules.md')).inclusion, 'always');
  assert.equal(inv.steering.find((s) => s.file.endsWith('optional.md')).inclusion, 'manual');
  assert.equal(inv.sessionStartHooks.length, 1);
  const preview = ok(root, ['init', '--runtime', 'kiro']);
  assert.match(preview, /my-rules\.md \[always\]/);
  assert.match(preview, /Warning: 1 existing always-on/);
  assert.match(preview, /SessionStart hook/);
  install(root);
  assert.equal(read(root, '.kiro/steering/my-rules.md'), mine);
  assert.equal(read(root, '.kiro/hooks/mine.json'), hook);
  assert.equal(read(root, 'AGENTS.md'), '# Project notes\nUse tabs.\n', 'kiro adapter does not touch AGENTS.md');
});

test('a modified or foreign file with a Extelligencing name is kept; the new version goes beside it', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.kiro/steering'), { recursive: true });
  fs.writeFileSync(path.join(root, '.kiro/steering/extelligencing-kernel.md'), 'someone else\'s file');
  const out = ok(root, ['init', '--runtime', 'kiro', '--yes']);
  assert.match(out, /propose-alongside\s+\.kiro\/steering\/extelligencing-kernel\.md/);
  assert.equal(read(root, '.kiro/steering/extelligencing-kernel.md'), 'someone else\'s file');
  assert.ok(has(root, '.kiro/steering/extelligencing-kernel.md.extelligencing-new'));
});

test('user edits to an installed file survive re-install and uninstall', () => {
  const root = tmp();
  install(root);
  fs.appendFileSync(path.join(root, '.kiro/steering/extelligencing-collaboration.md'), '\nMy house rule.\n');
  const out = ok(root, ['init', '--runtime', 'kiro', '--yes']);
  assert.match(out, /propose-alongside\s+\.kiro\/steering\/extelligencing-collaboration\.md/);
  assert.match(read(root, '.kiro/steering/extelligencing-collaboration.md'), /My house rule/);
  const un = ok(root, ['uninstall', '--yes']);
  assert.match(un, /kept\s+\.kiro\/steering\/extelligencing-collaboration\.md/);
  assert.match(read(root, '.kiro/steering/extelligencing-collaboration.md'), /My house rule/);
  assert.ok(!has(root, '.kiro/steering/extelligencing-kernel.md'));
});

test('failed install is rolled back completely', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), 'mine');
  const before = treeHash(root);
  for (const n of [1, 5, 12, 19]) {
    const r = extelligencing(root, ['init', '--runtime', 'kiro', '--yes'], { EXTELLIGENCING_FAIL_AT: String(n) });
    assert.notEqual(r.code, 0, `failure at ${n}`);
    assert.match(r.err, /rolled back/);
    assert.equal(treeHash(root), before, `workspace unchanged after failure at write ${n}`);
    assert.ok(!has(root, '.extelligencing'));
  }
});

test('uninstall: removes only unmodified Extelligencing files, keeps personal data unless purged', () => {
  const root = tmp();
  install(root);
  ok(root, ['onboarding', 'activate', '--json', JSON.stringify({ roles: ['Engineer'] })]);
  assert.notEqual(extelligencing(root, ['uninstall']).code, 0, 'needs --yes');
  const out = ok(root, ['uninstall', '--yes']);
  assert.match(out, /Personal data kept/);
  assert.ok(!has(root, '.kiro'));
  assert.ok(!has(root, '.extelligencing/runtime'));
  assert.ok(has(root, '.extelligencing/profile.md'));
  assert.ok(!has(root, '.extelligencing/manifest.json'));
});

test('uninstall --purge-data removes personal data too', () => {
  const root = tmp();
  install(root);
  ok(root, ['onboarding', 'activate', '--json', JSON.stringify({ roles: ['Engineer'] })]);
  ok(root, ['uninstall', '--yes', '--purge-data']);
  assert.ok(!has(root, '.extelligencing'));
});

for (const [runtime, file] of [['codex', 'AGENTS.md'], ['claude-code', 'CLAUDE.md']]) {
  test(`${runtime}: merges a delimited block into an existing ${file} and restores it on uninstall`, () => {
    const root = tmp();
    const original = '# Project notes\n\nUse tabs.\n';
    fs.writeFileSync(path.join(root, file), original);
    const preview = ok(root, ['init', '--runtime', runtime]);
    assert.match(preview, new RegExp(`merge-block\\s+${file}`));
    assert.equal(read(root, file), original);
    install(root, runtime);
    const merged = read(root, file);
    assert.ok(merged.startsWith(original.trimEnd()));
    assert.match(merged, /extelligencing:begin/);
    assert.match(merged, /extelligencing:end/);
    assert.match(merged, runtime === 'codex' ? /Restraint/ : /@\.extelligencing\/core\/kernel\.md/);
    assert.ok(has(root, '.extelligencing/core/collaboration.md'));
    const h = treeHash(root);
    ok(root, ['init', '--runtime', runtime, '--yes']);
    assert.equal(treeHash(root), h, 'idempotent');
    ok(root, ['uninstall', '--yes']);
    assert.equal(read(root, file), original, 'original content restored exactly');
  });
}

test('codex: creates AGENTS.md when missing and removes it on uninstall', () => {
  const root = tmp();
  install(root, 'codex');
  assert.ok(has(root, 'AGENTS.md'));
  ok(root, ['uninstall', '--yes']);
  assert.ok(!has(root, 'AGENTS.md'));
});

test('runtime limitation reporting (Scenario G)', () => {
  const root = tmp();
  const bad = extelligencing(root, ['init', '--runtime', 'vim', '--yes']);
  assert.notEqual(bad.code, 0);
  assert.match(bad.err, /Unsupported runtime "vim"/);
  fs.writeFileSync(path.join(root, 'afile'), 'x');
  const notDir = extelligencing(path.join(root, 'afile'), ['init', '--runtime', 'kiro', '--yes']);
  assert.notEqual(notDir.code, 0);
  assert.match(notDir.err, /not a directory/);
  install(root);
  fs.rmSync(path.join(root, '.kiro/hooks/extelligencing-boot.json'));
  const d = extelligencing(root, ['doctor']);
  assert.notEqual(d.code, 0);
  assert.match(d.out, /Missing managed file: \.kiro\/hooks\/extelligencing-boot\.json/);
  assert.match(d.out, /Fallback: type #extelligencing-onboarding/);
});

test('doctor flags a broken hook and an invalid hook file', () => {
  const root = tmp();
  install(root);
  fs.writeFileSync(path.join(root, '.kiro/hooks/extelligencing-boot.json'), '{not json');
  const d = extelligencing(root, ['doctor']);
  assert.match(d.out, /Modified since install/);
  assert.match(d.out, /Boot hook missing or invalid/);
});

test('init creates a missing target folder, and removes it again if the install fails', () => {
  const base = tmp();
  const target = path.join(base, 'new', 'workspace');
  const r = extelligencing(target, ['init', '--runtime', 'kiro', '--yes'], { EXTELLIGENCING_FAIL_AT: '3' });
  assert.notEqual(r.code, 0);
  assert.ok(!fs.existsSync(target));
  ok(target, ['init', '--runtime', 'kiro', '--yes']);
  assert.ok(has(target, '.extelligencing/onboarding.json'));
});

// ---------- symbolic links must never redirect writes or deletions outside the workspace ----------

function listFilesRec(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      e.isDirectory() ? walk(p) : out.push(path.relative(dir, p));
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

test('init refuses a symlinked .kiro folder and writes nothing, inside or outside', () => {
  const root = tmp();
  const outside = tmp();
  fs.symlinkSync(outside, path.join(root, '.kiro'));
  const r = extelligencing(root, ['init', '--runtime', 'kiro', '--yes']);
  assert.notEqual(r.code, 0);
  assert.match(r.err, /resolve outside the target folder through a symbolic link/);
  assert.match(r.err, /\.kiro\/steering\/extelligencing-kernel\.md/);
  assert.deepEqual(listFilesRec(outside), []);
  assert.ok(!has(root, '.extelligencing'), 'no partial install');
  assert.notEqual(extelligencing(root, ['init', '--runtime', 'kiro']).code, 0, 'the preview refuses too');
});

test('init refuses a symlinked .extelligencing folder and a symlinked managed file', () => {
  const a = tmp();
  const outsideA = tmp();
  fs.symlinkSync(outsideA, path.join(a, '.extelligencing'));
  assert.notEqual(extelligencing(a, ['init', '--runtime', 'kiro', '--yes']).code, 0);
  assert.deepEqual(listFilesRec(outsideA), []);

  const b = tmp();
  const target = path.join(tmp(), 'victim.md');
  fs.writeFileSync(target, 'victim');
  fs.mkdirSync(path.join(b, '.kiro', 'steering'), { recursive: true });
  fs.symlinkSync(target, path.join(b, '.kiro', 'steering', 'extelligencing-kernel.md'));
  assert.notEqual(extelligencing(b, ['init', '--runtime', 'kiro', '--yes']).code, 0);
  assert.equal(fs.readFileSync(target, 'utf8'), 'victim');
});

test('init refuses a dangling symlink at a managed path', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.kiro', 'hooks'), { recursive: true });
  fs.symlinkSync(path.join(tmp(), 'does-not-exist'), path.join(root, '.kiro', 'hooks', 'extelligencing-boot.json'));
  const r = extelligencing(root, ['init', '--runtime', 'kiro', '--yes']);
  assert.notEqual(r.code, 0);
  assert.match(r.err, /extelligencing-boot\.json/);
});

test('symlinks that stay inside the workspace are still allowed', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'real-kiro'));
  fs.symlinkSync(path.join(root, 'real-kiro'), path.join(root, '.kiro'));
  assert.equal(extelligencing(root, ['init', '--runtime', 'kiro', '--yes']).code, 0);
  assert.ok(has(root, 'real-kiro/steering/extelligencing-kernel.md'));
});

test('uninstall does not delete through a symlink that now points outside', () => {
  const root = tmp();
  install(root);
  const outside = tmp();
  fs.cpSync(path.join(root, '.kiro'), path.join(outside, 'copy'), { recursive: true });
  fs.rmSync(path.join(root, '.kiro'), { recursive: true });
  fs.symlinkSync(path.join(outside, 'copy'), path.join(root, '.kiro'));
  const before = listFilesRec(outside).sort();
  const out = ok(root, ['uninstall', '--yes']);
  assert.match(out, /kept\s+\.kiro\/steering\/extelligencing-kernel\.md.*symbolic link/);
  assert.deepEqual(listFilesRec(outside).sort(), before, 'files outside the workspace were not touched');
});

test('post-install message is honest about maturity and mentions workspace trust', () => {
  const kiro = tmp();
  const out = ok(kiro, ['init', '--runtime', 'kiro', '--yes']);
  assert.match(out, /primary integration \(observed in a small number of live sessions/);
  assert.doesNotMatch(out, /Runtime status: supported/);
  assert.match(out, /TRUST the workspace/);
  const codex = tmp();
  const out2 = ok(codex, ['init', '--runtime', 'codex', '--yes']);
  assert.match(out2, /experimental/);
  assert.match(out2, /unverified in live sessions/);
  const claude = tmp();
  assert.match(ok(claude, ['init', '--runtime', 'claude-code', '--yes']), /experimental/);
});
