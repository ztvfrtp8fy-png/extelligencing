import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as ob from '../lib/onboarding.mjs';
import { tmp, install, ok, extelligencing, read, has } from './helpers.mjs';

const D = (s) => new Date(`${s}T10:00:00Z`);

test('boot: not_started offers once per day, then silent the same day', () => {
  const s0 = ob.initialState();
  const a = ob.bootAction(s0, D('2026-11-11'));
  assert.equal(a.action, 'start');
  assert.match(a.message, /onboarding/i);
  const b = ob.bootAction(a.state, D('2026-11-11'));
  assert.equal(b.action, 'silent');
  const c = ob.bootAction(a.state, D('2026-11-12'));
  assert.equal(c.action, 'start');
});

test('boot: stops offering after the maximum number of offers', () => {
  let s = ob.initialState();
  for (let day = 1; day <= ob.MAX_OFFERS; day++) {
    const r = ob.bootAction(s, D(`2026-11-0${day}`));
    assert.notEqual(r.action, 'silent');
    s = r.state;
  }
  assert.equal(ob.bootAction(s, D('2026-11-20')).action, 'silent');
});

test('boot: completed and declined are always silent', () => {
  for (const status of ['completed', 'declined']) {
    const s = { ...ob.initialState(), status };
    assert.equal(ob.bootAction(s, D('2027-01-01')).action, 'silent');
  }
});

test('boot: deferred is silent until the date, then offers once', () => {
  let s = ob.defer(ob.initialState(), D('2026-11-11'));
  assert.equal(s.deferred_until, '2026-11-14');
  assert.equal(ob.bootAction(s, D('2026-11-13')).action, 'silent');
  const due = ob.bootAction(s, D('2026-11-14'));
  assert.equal(due.action, 'offer');
  assert.equal(ob.bootAction(due.state, D('2026-11-14')).action, 'silent');
});

test('boot: in_progress offers a resume', () => {
  const s = ob.start(ob.initialState());
  assert.equal(ob.bootAction(s, D('2026-11-11')).action, 'resume');
});

test('transitions: legal and illegal', () => {
  const s = ob.initialState();
  assert.equal(ob.start(s).status, 'in_progress');
  assert.equal(ob.decline(s).status, 'declined');
  assert.equal(ob.start(ob.decline(s)).status, 'in_progress', 'declined can be resumed on request');
  const done = ob.completeActivation(s);
  assert.equal(done.status, 'completed');
  assert.throws(() => ob.defer(done, D('2026-11-11')), /completed/);
  assert.throws(() => ob.decline(done), /completed/);
  assert.throws(() => ob.start(done), /reset/);
  assert.throws(() => ob.defer(s, D('2026-11-11'), 'tomorrow'), /Invalid date/);
});

test('blocks: skipped is never offered; deferred only after its date; pending is offerable', () => {
  let s = ob.completeActivation(ob.initialState());
  s = ob.setBlock(s, 'domain', 'skipped', D('2026-11-11'));
  s = ob.setBlock(s, 'team', 'deferred', D('2026-11-11'), '2026-11-20');
  s = ob.setBlock(s, 'quality', 'done', D('2026-11-11'));
  const early = ob.offerableBlocks(s, D('2026-11-15'));
  assert.ok(!early.includes('domain'));
  assert.ok(!early.includes('team'));
  assert.ok(!early.includes('quality'));
  assert.ok(early.includes('workflows'));
  assert.ok(ob.offerableBlocks(s, D('2026-11-20')).includes('team'));
});

test('blocks: progressive blocks never reopen a completed onboarding', () => {
  let s = ob.completeActivation(ob.initialState());
  s = ob.setBlock(s, 'domain', 'pending', D('2026-11-11'));
  assert.equal(s.status, 'completed');
  assert.equal(ob.bootAction(s, D('2026-11-11')).action, 'silent');
  assert.throws(() => ob.setBlock(s, 'nope', 'done', D('2026-11-11')), /Unknown block/);
  assert.throws(() => ob.setBlock(s, 'domain', 'maybe', D('2026-11-11')), /Invalid block status/);
});

test('reset needs confirmation, returns to initial state and deletes no files', () => {
  const root = tmp();
  install(root);
  ok(root, ['onboarding', 'activate', '--json', JSON.stringify({ roles: ['Designer'] })]);
  assert.ok(has(root, '.extelligencing/profile.md'));
  const r = extelligencing(root, ['onboarding', 'reset']);
  assert.notEqual(r.code, 0);
  assert.equal(JSON.parse(read(root, '.extelligencing/onboarding.json')).status, 'completed');
  ok(root, ['onboarding', 'reset', '--confirm']);
  assert.equal(JSON.parse(read(root, '.extelligencing/onboarding.json')).status, 'not_started');
  assert.ok(has(root, '.extelligencing/profile.md'), 'written files survive a reset');
});

test('activate: requires a role, validates runtime, never clobbers an edited profile', () => {
  const root = tmp();
  install(root);
  assert.notEqual(extelligencing(root, ['onboarding', 'activate', '--json', '{}']).code, 0);
  assert.notEqual(extelligencing(root, ['onboarding', 'activate', '--json', JSON.stringify({ roles: ['x'], runtime: 'vim' })]).code, 0);
  ok(root, ['onboarding', 'activate', '--json', JSON.stringify({ roles: ['Data analyst'] })]);
  const before = read(root, '.extelligencing/profile.md');
  assert.match(before, /Data analyst/);
  // user edits, then onboarding is redone
  fs.appendFileSync(`${root}/.extelligencing/profile.md`, '\nMy own note.\n');
  ok(root, ['onboarding', 'reset', '--confirm']);
  const out = ok(root, ['onboarding', 'activate', '--json', JSON.stringify({ roles: ['Data scientist'] })]);
  assert.match(out, /kept existing/);
  assert.match(read(root, '.extelligencing/profile.md'), /My own note/);
  assert.match(read(root, '.extelligencing/profile.md.proposed'), /Data scientist/);
});

test('cli: boot output is empty once completed', () => {
  const root = tmp();
  install(root);
  assert.match(ok(root, ['boot']), /Extelligencing/);
  ok(root, ['onboarding', 'activate', '--json', JSON.stringify({ roles: ['Architect'] })]);
  assert.equal(ok(root, ['boot'], { EXTELLIGENCING_NOW: '2026-12-31T00:00:00Z' }), '');
});
