#!/usr/bin/env node
// Pre-publication checks: secrets, private paths, personal contact data, and an optional
// private denylist of terms that must never appear in the public repository or its history.
//
//   node scripts/release-check.mjs [--denylist FILE]
//
// The denylist is a plain text file (one term per line, '#' comments; /regex/ lines are case-insensitive regular
// expressions) kept OUTSIDE the repository.
// It can also be supplied with EXTELLIGENCING_DENYLIST. Without it only the generic checks run, and the
// report says so. These checks are heuristics, not a substitute for human review.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanSecrets, scanPii } from '../lib/secrets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const dIdx = argv.indexOf('--denylist');
const denyFile = dIdx > -1 ? argv[dIdx + 1] : process.env.EXTELLIGENCING_DENYLIST;

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const findings = [];
const add = (where, what) => findings.push(`${where}: ${what}`);

let terms = [];
// A denylist line is a literal term, or /pattern/ for a case-insensitive regular expression.
const matcher = (t) => {
  const m = /^\/(.+)\/$/.exec(t);
  if (m) {
    const re = new RegExp(m[1], 'i');
    return (text) => re.test(text);
  }
  const low = t.toLowerCase();
  return (text) => text.toLowerCase().includes(low);
};
if (denyFile) {
  terms = fs.readFileSync(denyFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}
const tests = terms.map((t) => [t, matcher(t)]);

const PRIVATE_PATH = /(?:\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+|[A-Z]:\\Users\\[A-Za-z0-9._-]+)/;
const files = git('ls-files', '-co', '--exclude-standard').split('\n').filter(Boolean);

for (const rel of files) {
  const full = path.join(root, rel);
  let text;
  try {
    const buf = fs.readFileSync(full);
    if (buf.includes(0)) continue; // binary
    text = buf.toString('utf8');
  } catch {
    continue;
  }
  for (const s of scanSecrets(text)) add(rel, `possible secret (${s.id})`);
  for (const s of scanPii(text)) add(rel, `possible personal contact data (${s.id})`);
  if (PRIVATE_PATH.test(text)) add(rel, 'contains an absolute private-looking home path');
  for (const [, hit] of tests) if (hit(text) || hit(rel)) add(rel, 'contains a denylisted term');
  for (const forbidden of ['.env', 'id_rsa', '.pem']) if (rel.endsWith(forbidden)) add(rel, 'sensitive file name');
}

// Git history: authors, committers, messages, and content of every commit.
let history = '';
try {
  history = git('log', '--all', '--format=%an <%ae>|%cn <%ce>|%s%n%b');
} catch {
  /* no commits yet */
}
for (const line of history.split('\n')) {
  for (const [, hit] of tests) if (hit(line)) add('git history', 'a commit author or message contains a denylisted term');
}
if (terms.length) {
  for (const t of terms) {
    const rx = /^\/(.+)\/$/.exec(t);
    try {
      const args = rx ? ['log', '--all', '-i', '-E', `-G${rx[1]}`, '--format=%h'] : ['log', '--all', '-i', '-F', `-S${t}`, '--format=%h'];
      const out = execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
      if (out) add('git history', `a denylisted term appears in file content of commit(s): ${out.split('\n').join(', ')}`);
    } catch {
      /* no commits */
    }
  }
}

const unique = [...new Set(findings)];
console.log(`Files scanned: ${files.length}`);
console.log(denyFile ? `Denylist: ${terms.length} term(s) from ${path.basename(denyFile)}` : 'Denylist: NOT PROVIDED (only generic checks ran; pass --denylist FILE before publishing)');
if (unique.length) {
  console.log(`\nFindings (${unique.length}):`);
  for (const f of unique) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\nNo findings.');
