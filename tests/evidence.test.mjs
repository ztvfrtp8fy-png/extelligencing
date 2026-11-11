import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmp, install, ok, extelligencing, read, has, activate, treeHash } from './helpers.mjs';

const prop = (root, o) => extelligencing(root, ['evidence', 'propose', '--json', JSON.stringify(o)]);
const setup = () => {
  const root = tmp();
  install(root);
  activate(root, 'product-owner');
  return root;
};

test('a proposal alone persists nothing', () => {
  const root = setup();
  const before = { prefs: read(root, '.extelligencing/preferences.json'), profile: read(root, '.extelligencing/profile.md') };
  const r = prop(root, { kind: 'observation', summary: 'Rewrote the same update twice', instances: ['week 1'] });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /Nothing is persisted/);
  assert.equal(read(root, '.extelligencing/preferences.json'), before.prefs);
  assert.equal(read(root, '.extelligencing/profile.md'), before.profile);
  assert.ok(!has(root, '.extelligencing/evidence/log.md'));
});

test('Scenario A/F: rejecting a proposal leaves no trace in persistent files', () => {
  const root = setup();
  const snapshot = { prefs: read(root, '.extelligencing/preferences.json'), profile: read(root, '.extelligencing/profile.md') };
  prop(root, { kind: 'hypothesis', summary: 'May prefer to decide before gathering more input', instances: ['one meeting'] });
  ok(root, ['evidence', 'reject', 'ev-20261111-001', '--reason', 'not accurate']);
  assert.match(ok(root, ['evidence', 'list']), /rejected/);
  assert.equal(read(root, '.extelligencing/preferences.json'), snapshot.prefs);
  assert.equal(read(root, '.extelligencing/profile.md'), snapshot.profile);
  assert.ok(!has(root, '.extelligencing/evidence/log.md'));
  assert.ok(!has(root, '.extelligencing/decisions'));
  const again = extelligencing(root, ['evidence', 'approve', 'ev-20261111-001', '--confirm']);
  assert.notEqual(again.code, 0, 'rejected proposals cannot be approved');
  assert.ok(!has(root, '.extelligencing/evidence/log.md'));
});

test('approval requires explicit --confirm', () => {
  const root = setup();
  prop(root, { kind: 'observation', summary: 'Prefers bullets', instances: ['x'] });
  const r = extelligencing(root, ['evidence', 'approve', 'ev-20261111-001']);
  assert.equal(r.code, 3);
  assert.match(r.err, /--confirm/);
  assert.ok(!has(root, '.extelligencing/evidence/log.md'));
});

test('deferral persists nothing and can later be approved', () => {
  const root = setup();
  prop(root, { kind: 'observation', summary: 'Asked for shorter answers', instances: ['x'] });
  ok(root, ['evidence', 'defer', 'ev-20261111-001', '--until', '2026-12-01']);
  assert.ok(!has(root, '.extelligencing/evidence/log.md'));
  ok(root, ['evidence', 'approve', 'ev-20261111-001', '--confirm']);
  assert.match(read(root, '.extelligencing/evidence/log.md'), /Asked for shorter answers/);
});

test('approved preference updates preferences.json; approved decision is a file; approvals are final', () => {
  const root = setup();
  prop(root, { kind: 'preference', summary: 'Wants short answers', quote: 'Keep answers short', key: 'verbosity', value: 'short' });
  ok(root, ['evidence', 'approve', 'ev-20261111-001', '--confirm']);
  const prefs = JSON.parse(read(root, '.extelligencing/preferences.json')).preferences;
  assert.deepEqual(prefs.verbosity, { value: 'short', scope: 'interaction' });
  assert.ok(prefs.style, 'existing preferences are kept');
  prop(root, { kind: 'decision', summary: 'Weekly update goes out on Friday', quote: 'We will send updates on Fridays' });
  ok(root, ['evidence', 'approve', 'ev-20261111-002', '--confirm']);
  assert.match(read(root, '.extelligencing/decisions/ev-20261111-002.md'), /Fridays/);
  assert.notEqual(extelligencing(root, ['evidence', 'approve', 'ev-20261111-002', '--confirm']).code, 0);
  assert.notEqual(extelligencing(root, ['evidence', 'reject', 'ev-20261111-002']).code, 0);
});

test('capability claims need independent instances; thin evidence is refused', () => {
  const root = setup();
  const thin = prop(root, { kind: 'repeated_pattern', summary: 'Writes proposals before meetings', instances: ['a', 'b'] });
  assert.notEqual(thin.code, 0);
  assert.match(thin.err, /at least 3/);
  assert.equal(prop(root, { kind: 'repeated_pattern', summary: 'Writes proposals before meetings', instances: ['a', 'b', 'c'] }).code, 0);
  const vl = prop(root, { kind: 'validated_learning', summary: 'Proposals shorten meetings', instances: ['a', 'b', 'c'] });
  assert.notEqual(vl.code, 0);
  assert.match(vl.err, /outcome_refs/);
});

test('preferences and decisions need the person\'s own words', () => {
  const root = setup();
  assert.notEqual(prop(root, { kind: 'preference', summary: 'x', key: 'k', value: 1 }).code, 0);
  assert.notEqual(prop(root, { kind: 'decision', summary: 'x' }).code, 0);
  assert.notEqual(prop(root, { kind: 'preference', summary: 'x', quote: 'q', key: 'Bad Key', value: 1 }).code, 0);
  assert.notEqual(prop(root, { kind: 'wizard', summary: 'x' }).code, 0);
});

test('evaluative wording about the person is flagged', () => {
  const root = setup();
  const r = prop(root, { kind: 'hypothesis', summary: 'Seems weak at prioritization, skill level: low', instances: ['one meeting'] });
  assert.match(r.out, /Evaluative wording/);
  assert.match(r.out, /Hypothesis: a guess/);
});

test('secrets are refused and not stored', () => {
  const root = setup();
  const r = prop(root, { kind: 'observation', summary: 'Pasted a token', instances: ['ghp_' + 'x'.repeat(36)]  /* fake token built at runtime */ });
  assert.notEqual(r.code, 0);
  assert.match(r.err, /secret/);
  assert.equal(ok(root, ['evidence', 'list']), '');
  const files = fs.existsSync(`${root}/.extelligencing/evidence/proposals`) ? fs.readdirSync(`${root}/.extelligencing/evidence/proposals`) : [];
  assert.equal(files.length, 0);
});

test('third-party contact data triggers a warning', () => {
  const root = setup();
  const r = prop(root, { kind: 'observation', summary: `Emailed ${'jane.doe'}@${'bigcorp'}.io about the plan`, instances: ['x'] });
  assert.match(r.out, /personal contact data/);
  const ok2 = prop(root, { kind: 'observation', summary: 'Emailed someone@example.com', instances: ['x'] });
  assert.doesNotMatch(ok2.out, /personal contact data/);
});

test('invalid ids are rejected', () => {
  const root = setup();
  assert.notEqual(extelligencing(root, ['evidence', 'show', '../../etc/passwd']).code, 0);
  assert.notEqual(extelligencing(root, ['evidence', 'approve', 'ev-20261111-999', '--confirm']).code, 0);
});

test('proposals do not touch anything outside .extelligencing', () => {
  const root = setup();
  const outside = () => treeHash(root).length; // sanity
  const snap = fs.readdirSync(root).sort();
  prop(root, { kind: 'observation', summary: 'x', instances: ['y'] });
  ok(root, ['evidence', 'approve', 'ev-20261111-001', '--confirm']);
  assert.deepEqual(fs.readdirSync(root).sort(), snap);
  assert.ok(outside());
});
