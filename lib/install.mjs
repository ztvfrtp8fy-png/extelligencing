// Non-destructive install, upgrade, rollback and uninstall.
// Rules: never overwrite a file we do not own; never delete anything modified by the user;
// show a plan first; apply only on request; undo everything if an apply step fails.
import fs from 'node:fs';
import path from 'node:path';
import { ExtelligencingError, sha256, exists, readText, readJson, writeFileAtomic, writeJson, parseFrontMatter, isInside, realOrResolve } from './util.mjs';
import { entriesFor, BLOCK_BEGIN, BLOCK_END, REPO_ROOT, SUPPORTED } from './adapters.mjs';
import { initialState } from './onboarding.mjs';

export const manifestPath = (root) => path.join(root, '.extelligencing', 'manifest.json');

export function version() {
  return readJson(path.join(REPO_ROOT, 'package.json')).version;
}

// ---------- path safety ----------

/**
 * True if writing to (or deleting) `abs` would land outside the workspace root, for example because a
 * parent folder such as .kiro is a symlink to somewhere else, or the file itself is a symlink.
 * Paths that do not exist yet are judged by their nearest existing parent.
 */
export function escapesRoot(root, abs) {
  if (!exists(root)) return false;
  let p = abs;
  while (!exists(p)) p = path.dirname(p);
  try {
    if (p === abs && fs.lstatSync(p).isSymbolicLink()) return true;
    return !isInside(realOrResolve(root), fs.realpathSync(p));
  } catch {
    return true; // dangling or unreadable link: refuse
  }
}

function assertSafeTargets(root, relPaths) {
  const bad = relPaths.filter((rel) => escapesRoot(root, path.join(root, rel)));
  if (bad.length) {
    throw new ExtelligencingError(
      `Refusing to install: these paths resolve outside the target folder through a symbolic link: ${bad.join(', ')}. Nothing was changed. Replace the link with a real folder, or choose another target.`,
      'UNSAFE_PATH',
    );
  }
}

// ---------- block helpers ----------

export function extractBlock(text) {
  const b = text.indexOf(BLOCK_BEGIN);
  const e = text.indexOf(BLOCK_END);
  if (b === -1 || e === -1 || e < b) return null;
  return { start: b, end: e + BLOCK_END.length, text: text.slice(b, e + BLOCK_END.length) };
}

const trimBlock = (t) => t.replace(/\n+$/, '');

// ---------- inventory of existing runtime configuration (read-only, front matter only) ----------

export function inventory(root) {
  const inv = { steering: [], sessionStartHooks: [], legacyHooks: [], rootFiles: [], warnings: [] };
  const sdir = path.join(root, '.kiro', 'steering');
  if (exists(sdir)) {
    for (const f of fs.readdirSync(sdir).filter((f) => f.endsWith('.md')).sort()) {
      if (f.startsWith('extelligencing-')) continue;
      const full = path.join(sdir, f);
      const head = fs.readFileSync(full, 'utf8').slice(0, 1500); // front matter only; bodies are not read
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(head);
      const { data } = fm ? parseFrontMatter(`---\n${fm[1]}\n---\n`) : { data: {} };
      const inclusion = data.inclusion || 'always';
      inv.steering.push({ file: `.kiro/steering/${f}`, inclusion, bytes: fs.statSync(full).size });
    }
  }
  const hdir = path.join(root, '.kiro', 'hooks');
  if (exists(hdir)) {
    for (const f of fs.readdirSync(hdir).sort()) {
      if (f === 'extelligencing-boot.json') continue;
      if (f.endsWith('.kiro.hook')) {
        inv.legacyHooks.push(`.kiro/hooks/${f}`);
        continue;
      }
      if (!f.endsWith('.json')) continue;
      try {
        const j = readJson(path.join(hdir, f));
        for (const h of j.hooks ?? []) if (h.trigger === 'SessionStart') inv.sessionStartHooks.push({ file: `.kiro/hooks/${f}`, name: h.name ?? '(unnamed)' });
      } catch {
        inv.warnings.push(`.kiro/hooks/${f} is not valid JSON; left untouched.`);
      }
    }
  }
  for (const f of ['AGENTS.md', 'CLAUDE.md']) if (exists(path.join(root, f))) inv.rootFiles.push(f);
  const alwaysOn = inv.steering.filter((s) => s.inclusion === 'always');
  if (alwaysOn.length) inv.warnings.push(`${alwaysOn.length} existing always-on steering file(s). Extelligencing will not change them. If any define a competing kernel or authority, review them manually (set "inclusion: manual" yourself if you decide to).`);
  if (inv.sessionStartHooks.length) inv.warnings.push(`${inv.sessionStartHooks.length} existing SessionStart hook(s). They are kept and will run alongside the Extelligencing boot hook.`);
  if (inv.legacyHooks.length) inv.warnings.push('Legacy .kiro.hook files found. Hooks in that format may not run on current Kiro versions; the Extelligencing boot hook uses the current JSON format.');
  return inv;
}

// ---------- plan ----------

function loadManifest(root) {
  return exists(manifestPath(root)) ? readJson(manifestPath(root)) : null;
}

export function plan(root, runtime) {
  if (!SUPPORTED.includes(runtime)) throw new ExtelligencingError(`Unsupported runtime "${runtime}". Choose one of: ${SUPPORTED.join(', ')}`, 'BAD_RUNTIME');
  if (exists(root) && !fs.statSync(root).isDirectory()) throw new ExtelligencingError(`Target is not a directory: ${root}`, 'BAD_TARGET');
  const prev = loadManifest(root);
  const prevHash = new Map((prev?.installed ?? []).map((e) => [e.path, e.sha256]));
  const items = [];
  const entries = entriesFor(runtime);
  assertSafeTargets(root, [...entries.map((e) => e.path), '.extelligencing/config.json', '.extelligencing/onboarding.json', '.extelligencing/manifest.json']);

  for (const entry of entries) {
    const abs = path.join(root, entry.path);
    if (entry.type === 'block') {
      if (!exists(abs)) {
        items.push({ ...entry, action: 'create', note: 'new file containing the Extelligencing block' });
        continue;
      }
      const cur = readText(abs);
      const blk = extractBlock(cur);
      if (!blk) {
        items.push({ ...entry, action: 'merge-block', note: 'append a delimited Extelligencing block; existing content untouched' });
      } else if (trimBlock(blk.text) === trimBlock(entry.content)) {
        items.push({ ...entry, action: 'skip-identical' });
      } else if (prevHash.get(entry.path) === sha256(trimBlock(blk.text))) {
        items.push({ ...entry, action: 'update', note: 'replace the managed block only' });
      } else {
        items.push({ ...entry, action: 'propose-alongside', note: `block was edited; new version written to ${entry.path}.extelligencing-new` });
      }
      continue;
    }
    if (!exists(abs)) {
      items.push({ ...entry, action: 'create' });
      continue;
    }
    const cur = readText(abs);
    if (cur === entry.content) items.push({ ...entry, action: 'skip-identical' });
    else if (prevHash.get(entry.path) === sha256(cur)) items.push({ ...entry, action: 'update', note: 'upgrade of an unmodified Extelligencing file' });
    else items.push({ ...entry, action: 'propose-alongside', note: `file exists and is not an unmodified Extelligencing file; new version written to ${entry.path}.extelligencing-new` });
  }
  return { root, runtime, items, inventory: inventory(root), alreadyInstalled: !!prev };
}

export function formatPlan(p) {
  const lines = [`Extelligencing install plan for ${p.root} (runtime: ${p.runtime})`, ''];
  for (const i of p.items) lines.push(`  ${i.action.padEnd(17)} ${i.path}${i.note ? '  (' + i.note + ')' : ''}`);
  lines.push('  data (kept if present)  .extelligencing/onboarding.json, .extelligencing/config.json');
  const inv = p.inventory;
  if (inv.steering.length || inv.sessionStartHooks.length || inv.rootFiles.length) {
    lines.push('', 'Existing configuration found (nothing below is modified):');
    for (const s of inv.steering) lines.push(`  steering ${s.file} [${s.inclusion}]`);
    for (const h of inv.sessionStartHooks) lines.push(`  SessionStart hook ${h.file}: ${h.name}`);
    for (const f of inv.rootFiles) lines.push(`  ${f} (a Extelligencing block is merged in; the rest is kept)`);
  }
  for (const w of inv.warnings) lines.push('', `Warning: ${w}`);
  return lines.join('\n');
}

// ---------- apply with rollback ----------

export function apply(root, runtime, { env = process.env, trace = false } = {}) {
  const p = plan(root, runtime);
  const undo = []; // functions, run in reverse on failure
  let writes = 0;
  const rootCreated = !exists(root);
  const failAt = env.EXTELLIGENCING_FAIL_AT ? Number(env.EXTELLIGENCING_FAIL_AT) : null; // test hook for rollback
  const write = (abs, text) => {
    writes++;
    if (failAt && writes === failAt) throw new ExtelligencingError('Injected failure', 'INJECTED');
    const existed = exists(abs);
    const before = existed ? readText(abs) : null;
    const createdDirs = [];
    let d = path.dirname(abs);
    while (!exists(d) && d.startsWith(root)) {
      createdDirs.push(d);
      d = path.dirname(d);
    }
    writeFileAtomic(abs, text);
    undo.push(() => {
      if (existed) fs.writeFileSync(abs, before);
      else fs.rmSync(abs, { force: true });
      for (const dir of createdDirs) {
        try {
          fs.rmdirSync(dir);
        } catch {
          /* not empty */
        }
      }
    });
  };

  const installed = [];
  const results = [];
  const prevEntries = new Map((loadManifest(root)?.installed ?? []).map((e) => [e.path, e]));
  try {
    for (const i of p.items) {
      const abs = path.join(root, i.path);
      if (i.action === 'skip-identical') {
        installed.push(record(i, i.type === 'block' ? extractBlock(readText(abs)).text : i.content));
        results.push(i);
      } else if (i.action === 'propose-alongside') {
        write(`${abs}.extelligencing-new`, i.content);
        const old = prevEntries.get(i.path);
        if (old) installed.push(old); // still ours from an earlier install; uninstall will report it as kept
        results.push(i);
      } else if (i.type === 'block') {
        const cur = exists(abs) ? readText(abs) : '';
        const blk = cur ? extractBlock(cur) : null;
        let next;
        if (!cur) next = i.content;
        else if (blk) next = cur.slice(0, blk.start) + trimBlock(i.content) + cur.slice(blk.end);
        else next = cur.replace(/\n*$/, '\n\n') + i.content;
        write(abs, next);
        installed.push(record(i, trimBlock(i.content)));
        results.push(i);
      } else {
        write(abs, i.content);
        installed.push(record(i, i.content));
        results.push(i);
      }
    }
    // Personal data: created only when missing; never overwritten.
    const cfg = path.join(root, '.extelligencing', 'config.json');
    if (!exists(cfg)) write(cfg, JSON.stringify({ schema: 1, runtime, shared: [], ...(trace ? { trace: true } : {}) }, null, 2) + '\n');
    else {
      const c = readJson(cfg);
      if (c.runtime !== runtime || (trace && c.trace !== true)) {
        c.runtime = runtime;
        if (trace) c.trace = true;
        write(cfg, JSON.stringify(c, null, 2) + '\n');
      }
    }
    const st = path.join(root, '.extelligencing', 'onboarding.json');
    if (!exists(st)) write(st, JSON.stringify(initialState(), null, 2) + '\n');
    write(manifestPath(root), JSON.stringify({ schema: 1, version: version(), runtime, installed }, null, 2) + '\n');
  } catch (e) {
    for (const u of undo.reverse()) {
      try {
        u();
      } catch {
        /* best effort */
      }
    }
    if (rootCreated) {
      try {
        fs.rmdirSync(root);
      } catch {
        /* not empty */
      }
    }
    throw new ExtelligencingError(`Install failed and was rolled back: ${e.message}`, 'ROLLED_BACK');
  }
  return { plan: p, results };
}

function record(item, hashedText) {
  return { path: item.path, type: item.type, sha256: sha256(hashedText) };
}

// ---------- uninstall ----------

export function uninstall(root, { purgeData = false } = {}) {
  const m = loadManifest(root);
  if (!m) throw new ExtelligencingError('No Extelligencing manifest found. Nothing to uninstall.', 'NOT_INSTALLED');
  const removed = [];
  const kept = [];
  for (const e of m.installed) {
    const abs = path.join(root, e.path);
    if (!exists(abs)) continue;
    if (escapesRoot(root, abs)) {
      kept.push({ path: e.path, why: 'resolves outside the workspace through a symbolic link' });
      continue;
    }
    const cur = readText(abs);
    if (e.type === 'block') {
      const blk = extractBlock(cur);
      if (!blk) continue;
      if (sha256(trimBlock(blk.text)) !== e.sha256) {
        kept.push({ path: e.path, why: 'managed block was edited' });
        continue;
      }
      const rest = (cur.slice(0, blk.start) + cur.slice(blk.end)).replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
      if (rest === '') fs.rmSync(abs);
      else fs.writeFileSync(abs, rest + '\n');
      removed.push(e.path);
    } else if (sha256(cur) === e.sha256) {
      fs.rmSync(abs);
      removed.push(e.path);
    } else {
      kept.push({ path: e.path, why: 'modified since install' });
    }
  }
  fs.rmSync(manifestPath(root), { force: true });
  // Remove only directories that are now empty.
  for (const dir of ['.kiro/steering', '.kiro/hooks', '.kiro', '.extelligencing/core', '.extelligencing/runtime/bin', '.extelligencing/runtime/lib', '.extelligencing/runtime']) {
    try {
      fs.rmdirSync(path.join(root, dir));
    } catch {
      /* not empty or absent */
    }
  }
  let purged = false;
  if (purgeData) {
    fs.rmSync(path.join(root, '.extelligencing'), { recursive: true, force: true });
    purged = true;
  } else {
    try {
      fs.rmdirSync(path.join(root, '.extelligencing'));
    } catch {
      /* personal data stays */
    }
  }
  return { removed, kept, purged, dataKept: !purged && exists(path.join(root, '.extelligencing')) };
}

// ---------- doctor ----------

export function doctor(root) {
  const checks = [];
  const add = (ok, msg, level = ok ? 'ok' : 'error') => checks.push({ level, msg });
  const m = loadManifest(root);
  add(!!m, m ? `Extelligencing ${m.version} installed for runtime "${m.runtime}"` : 'Not installed (no .extelligencing/manifest.json)');
  const major = Number(process.versions.node.split('.')[0]);
  add(major >= 18, `Node ${process.versions.node} (needs 18+)`);
  if (!m) return checks;
  for (const e of m.installed) {
    const abs = path.join(root, e.path);
    if (!exists(abs)) {
      add(false, `Missing managed file: ${e.path}`);
      continue;
    }
    const cur = readText(abs);
    const h = e.type === 'block' ? (extractBlock(cur) ? sha256(trimBlock(extractBlock(cur).text)) : null) : sha256(cur);
    if (h !== e.sha256) add(false, `Modified since install: ${e.path} (kept as is)`, 'warn');
  }
  if (m.runtime === 'kiro') {
    const hp = path.join(root, '.kiro', 'hooks', 'extelligencing-boot.json');
    try {
      const h = readJson(hp).hooks?.[0];
      add(h?.trigger === 'SessionStart' && h?.action?.type === 'command', 'Boot hook is a SessionStart command hook');
    } catch {
      add(false, 'Boot hook missing or invalid. Fallback: type #extelligencing-onboarding in chat.');
    }
    const kp = path.join(root, '.kiro', 'steering', 'extelligencing-kernel.md');
    add(exists(kp) && !/^---\s*\ninclusion:\s*(manual|auto|fileMatch)/.test(readText(kp)), 'Kernel steering present and always-on');
    checks.push({ level: 'info', msg: 'Hooks only run in trusted workspaces. Whether the hook fired in your Kiro version cannot be checked from here; if onboarding does not start, type #extelligencing-onboarding.' });
  }
  try {
    const cfg = readJson(path.join(root, '.extelligencing', 'config.json'));
    for (const w of cfg.shared ?? []) add(exists(w.path), `Shared workspace "${w.name}" path ${exists(w.path) ? 'exists' : 'is missing'}`, exists(w.path) ? 'ok' : 'warn');
  } catch {
    add(false, 'Cannot read .extelligencing/config.json');
  }
  return checks;
}
