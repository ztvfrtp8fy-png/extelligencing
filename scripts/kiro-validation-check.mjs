#!/usr/bin/env node
// Reads the evidence left behind by a live Kiro validation session and reports each check as
// OBSERVED, FAILED or PENDING. It checks files only. What the model said and did is entered by you.
//
//   node scripts/kiro-validation-check.mjs [BASE_DIR]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { treeHash } from './tree-hash.mjs';

const base = path.resolve(process.argv[2] ?? path.join(os.homedir(), 'extelligencing-validation'));
const exp = JSON.parse(fs.readFileSync(path.join(base, '.expected.json'), 'utf8'));
const fresh = path.join(base, 'fresh');
const existing = path.join(base, 'existing');
const E = '.extelligencing';
const rows = [];
const row = (id, status, what, detail = '') => rows.push({ id, status, what, detail });
const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

// --- fresh workspace: hook execution evidence ---
const traceFile = path.join(fresh, E, 'trace.log');
const trace = fs.existsSync(traceFile) ? fs.readFileSync(traceFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
if (!trace.length) {
  row('H1', 'PENDING', 'SessionStart hook executed', 'no trace.log entries yet: open fresh/ in Kiro and start a session');
  row('H2', 'PENDING', 'Hook working directory');
  row('H3', 'PENDING', 'Hook stdin received from Kiro');
} else {
  row('H1', 'MANUAL', 'SessionStart hook executed by Kiro', `${trace.length} run(s) recorded. Confirm Kiro started them: caller chain of the latest run = ${(trace.at(-1).ancestors ?? []).join(' <- ') || 'unknown'} (it must include Kiro or its helper processes; a plain shell chain means someone ran it by hand)`);
  const real = fs.realpathSync(fresh);
  const cwds = [...new Set(trace.map((t) => t.cwd && fs.existsSync(t.cwd) ? fs.realpathSync(t.cwd) : t.cwd))];
  row('H2', cwds.every((c) => c === real) ? 'MANUAL' : 'FAILED', 'Hook working directory is the workspace root (valid only if H1 is confirmed as started by Kiro)', `cwd seen: ${cwds.join(', ')}`);
  const withStdin = trace.filter((t) => t.stdin);
  row('H3', withStdin.length ? 'MANUAL' : 'PENDING', 'Hook stdin received from Kiro', withStdin.length ? `keys: ${JSON.stringify(withStdin[0].stdin)}` : 'no stdin captured (informational; not required to work)');
}
const nonces = trace.filter((t) => t.nonce).map((t) => t.nonce);
row('H4', nonces.length ? 'MANUAL' : 'PENDING', 'Hook stdout visible to the AI', nonces.length ? `Ask in session 1: "What validation code did session start give you?" Expected: ${nonces.join(' or ')}. Record the answer yourself.` : 'needs a session where the hook printed a message');

// --- onboarding persistence ---
const st = readJson(path.join(fresh, E, 'onboarding.json'));
if (st) {
  row('O1', 'OBSERVED', 'Onboarding state file exists and is valid', `status=${st.status}, offers=${st.offer_count}, last_offer=${st.last_offer_date}`);
  const actions = trace.map((t) => t.action);
  row('O2', actions.includes('start') && actions.length > 1 ? 'OBSERVED' : 'PENDING', 'Later session behavior recorded', `actions in order: ${actions.join(', ') || 'none'}`);
  if (st.status === 'completed') row('O3', fs.existsSync(path.join(fresh, E, 'profile.md')) ? 'OBSERVED' : 'FAILED', 'Completed onboarding wrote the profile', '');
}

// --- shared workspace read-only ---
const nowHash = treeHash(path.join(base, 'shared'));
row('S1', nowHash === exp.sharedHash ? 'OBSERVED' : 'FAILED', 'Shared folder unchanged (read-only)', nowHash === exp.sharedHash ? 'hash identical to setup' : 'shared/ was modified');
const cfg = readJson(path.join(fresh, E, 'config.json'));
row('S2', cfg?.shared?.length ? 'OBSERVED' : 'PENDING', 'Shared workspace connected', cfg?.shared?.map((w) => `${w.name} ${w.access}`).join(', ') ?? '');
row('S3', 'MANUAL', 'Selective loading and shared answer', `Ask: "What is the gateway codename? Use the team context." Expected ${exp.marks.gateway}. Ask nothing about the roadmap; confirm in the chat that the product-context document was NOT opened (roadmap codename ${exp.marks.roadmap} must not appear).`);
const personalText = ['profile.md', 'preferences.json'].map((f) => (fs.existsSync(path.join(fresh, E, f)) ? fs.readFileSync(path.join(fresh, E, f), 'utf8') : '')).join('\n');
row('S4', personalText.includes(exp.marks.gateway) || personalText.includes(exp.marks.roadmap) ? 'FAILED' : 'OBSERVED', 'Team content was not copied into personal files', '');

// --- persistence refusal ---
const log = path.join(fresh, E, 'evidence', 'log.md');
const props = fs.existsSync(path.join(fresh, E, 'evidence', 'proposals')) ? fs.readdirSync(path.join(fresh, E, 'evidence', 'proposals')).map((f) => readJson(path.join(fresh, E, 'evidence', 'proposals', f))) : [];
const rejected = props.filter((p) => p?.status === 'rejected');
row('P1', 'MANUAL', 'Persistence refusal', `Tell the AI: "Remember that I always want answers in bullet points." When it proposes saving, say no. Expected: preferences.json has no such key, evidence/log.md absent. Now: log.md ${fs.existsSync(log) ? 'EXISTS' : 'absent'}, proposals=${props.length} (rejected=${rejected.length}), preferences keys=${Object.keys(readJson(path.join(fresh, E, 'preferences.json'))?.preferences ?? {}).join(',') || 'none'}`);
if (fs.existsSync(log) && !props.some((p) => p?.status === 'approved')) row('P2', 'FAILED', 'Evidence log written without an approved proposal', '');

// --- steering inclusion (manual, model-dependent) ---
row('K1', 'MANUAL', 'Kernel steering active', 'In fresh/, ask: "Without opening files, in two lines, what rules apply here?" Expect authority order and approval-before-persisting. Also check the chat context list shows extelligencing-kernel.');
row('K2', 'MANUAL', 'Auto steering activates only on demand', 'Ask a trivial question (expect no extelligencing-context-map/collaboration in the context list), then ask for a weekly update drafted from team conventions (expect context-map).');

// --- existing configuration ---
if (!fs.existsSync(path.join(existing, E))) {
  row('X1', 'PENDING', 'Existing-config install', 'run init preview then --yes in existing/ (see docs/KIRO-VALIDATION.md)');
} else {
  const same = Object.entries(exp.existingBefore).every(([f, text]) => {
    const p = f === 'my-style.md' ? '.kiro/steering/my-style.md' : f === 'my-hook.json' ? '.kiro/hooks/my-hook.json' : 'notes.md';
    return fs.existsSync(path.join(existing, p)) && fs.readFileSync(path.join(existing, p), 'utf8') === text;
  });
  row('X1', same ? 'OBSERVED' : 'FAILED', 'Existing files unchanged after install/uninstall', '');
  const ran = fs.existsSync(path.join(existing, '.my-hook-ran.log'));
  row('X2', ran ? 'OBSERVED' : 'PENDING', 'User\'s own SessionStart hook still ran alongside', ran ? 'marker file present' : 'start a session in existing/ after install');
  row('X3', 'MANUAL', 'Existing always-on steering still obeyed', `In existing/, ask any question. Expected the reply ends with ${exp.marks.existingStyle}.`);
  const mani = fs.existsSync(path.join(existing, E, 'manifest.json'));
  row('X4', 'INFO', mani ? 'Extelligencing is currently installed in existing/' : 'Extelligencing is currently NOT installed in existing/ (after uninstall this is expected)', '');
}

const w = Math.max(...rows.map((r) => r.id.length));
console.log(`Kiro validation evidence for ${base}\n`);
for (const r of rows) console.log(`${r.id.padEnd(w)}  ${r.status.padEnd(8)} ${r.what}${r.detail ? '\n' + ' '.repeat(w + 11) + r.detail : ''}`);
const failed = rows.filter((r) => r.status === 'FAILED').length;
console.log(`\nOBSERVED ${rows.filter((r) => r.status === 'OBSERVED').length}, MANUAL ${rows.filter((r) => r.status === 'MANUAL').length}, PENDING ${rows.filter((r) => r.status === 'PENDING').length}, FAILED ${failed}`);
console.log('MANUAL rows depend on what the model said or did. Record them yourself; this script cannot observe them.');
process.exit(failed ? 1 : 0);
