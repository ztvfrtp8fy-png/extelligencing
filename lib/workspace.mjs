// Shared Workspace Layer: strictly read-only access to a user-authorized local directory.
// This module never writes inside a shared path. Only config.json (personal) is written.
import fs from 'node:fs';
import path from 'node:path';
import { ExtelligencingError, exists, readJson, readText, writeJson, isInside, realOrResolve, parseFrontMatter } from './util.mjs';
import { scanInjection, scanSecrets } from './secrets.mjs';

const SHARED_DIRS = ['conventions', 'context', 'templates', 'decisions'];
const MAX_FILE_BYTES = 256 * 1024;
const MAX_DEPTH = 4;

export const configPath = (root) => path.join(root, '.extelligencing', 'config.json');

export function loadConfig(root) {
  const p = configPath(root);
  if (!exists(p)) return { schema: 1, runtime: 'other', shared: [] };
  const c = readJson(p);
  if (!Array.isArray(c.shared)) c.shared = [];
  return c;
}

export function saveConfig(root, config) {
  writeJson(configPath(root), config);
}

/** Register a shared workspace by local path. Does not read or copy its content. */
export function connect(root, { name, path: p }) {
  if (!p) throw new ExtelligencingError('A path is required', 'BAD_PATH');
  const abs = path.resolve(p);
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    throw new ExtelligencingError(`Path does not exist: ${abs}`, 'BAD_PATH');
  }
  if (!st.isDirectory()) throw new ExtelligencingError(`Not a directory: ${abs}`, 'BAD_PATH');
  const real = realOrResolve(abs);
  const personal = realOrResolve(path.join(root, '.extelligencing'));
  if (isInside(personal, real) || isInside(real, personal)) {
    throw new ExtelligencingError('The shared path must be separate from the personal .extelligencing folder (in either direction).', 'BAD_PATH');
  }
  if (!name) name = path.basename(real);
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new ExtelligencingError('Workspace name may contain letters, digits, dot, dash, underscore', 'BAD_NAME');
  const config = loadConfig(root);
  if (config.shared.some((w) => w.name === name)) throw new ExtelligencingError(`A shared workspace named "${name}" is already connected`, 'DUPLICATE');
  config.shared.push({ name, path: real, access: 'read-only' });
  saveConfig(root, config);
  return { name, path: real, access: 'read-only' };
}

export function disconnect(root, name) {
  const config = loadConfig(root);
  const before = config.shared.length;
  config.shared = config.shared.filter((w) => w.name !== name);
  if (config.shared.length === before) throw new ExtelligencingError(`No shared workspace named "${name}"`, 'NOT_FOUND');
  saveConfig(root, config);
  return { removed: name };
}

function getWorkspace(root, name) {
  const config = loadConfig(root);
  const ws = name ? config.shared.find((w) => w.name === name) : config.shared[0];
  if (!ws) return null;
  return ws;
}

/** Resolve a relative path inside a shared workspace. Rejects traversal and symlink escapes. */
export function safeSharedPath(ws, rel) {
  if (path.isAbsolute(rel)) throw new ExtelligencingError('Shared paths must be relative', 'BAD_PATH');
  const base = realOrResolve(ws.path);
  const full = path.resolve(base, rel);
  if (!isInside(base, full)) throw new ExtelligencingError(`Path escapes the shared workspace: ${rel}`, 'PATH_ESCAPE');
  if (exists(full) && !isInside(base, fs.realpathSync(full))) throw new ExtelligencingError(`Symlink escapes the shared workspace: ${rel}`, 'PATH_ESCAPE');
  return full;
}

/** Read-only read of one shared file. */
export function readShared(ws, rel) {
  const full = safeSharedPath(ws, rel);
  const st = fs.statSync(full);
  if (!st.isFile()) throw new ExtelligencingError(`Not a file: ${rel}`, 'BAD_PATH');
  if (st.size > MAX_FILE_BYTES) throw new ExtelligencingError(`File too large to load: ${rel}`, 'TOO_LARGE');
  return { source: { workspace: ws.name, path: rel }, content: readText(full) };
}

/** List candidate Markdown documents (relative paths) without reading bodies. */
export function listSharedDocs(ws) {
  const base = realOrResolve(ws.path);
  const out = [];
  const walk = (dirRel, depth) => {
    if (depth > MAX_DEPTH) return;
    let entries;
    try {
      entries = fs.readdirSync(path.join(base, dirRel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith('.')) continue;
      const rel = path.posix.join(dirRel, e.name);
      if (e.isSymbolicLink()) {
        // Follow only if it stays inside the shared root.
        try {
          if (!isInside(base, fs.realpathSync(path.join(base, rel)))) continue;
        } catch {
          continue;
        }
      }
      let st;
      try {
        st = fs.statSync(path.join(base, rel));
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(rel, depth + 1);
      else if (st.isFile() && e.name.endsWith('.md') && st.size <= MAX_FILE_BYTES) out.push(rel);
    }
  };
  for (const d of SHARED_DIRS) if (exists(path.join(base, d))) walk(d, 1);
  return out;
}

export function docTitle(ws, rel) {
  try {
    const { body } = parseFrontMatter(readText(safeSharedPath(ws, rel)));
    const h = /^#\s+(.+)$/m.exec(body);
    return h ? h[1].trim() : path.basename(rel, '.md');
  } catch {
    return path.basename(rel, '.md');
  }
}

export function manifest(ws) {
  const p = path.join(ws.path, 'extelligencing-shared.json');
  return exists(p) ? readJson(p) : null;
}

/** Structured team conventions, comparable with personal preferences. */
export function loadConventions(ws) {
  const p = path.join(ws.path, 'conventions.json');
  if (!exists(p)) return {};
  const data = readJson(p);
  const map = data.conventions && typeof data.conventions === 'object' ? data.conventions : {};
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    if (v && typeof v === 'object' && 'value' in v) out[k] = { value: v.value, scope: v.scope === 'interaction' ? 'interaction' : 'artifact', doc: v.doc ?? null };
  }
  return out;
}

/**
 * Compare personal preferences with team conventions.
 * Same key + different value = conflict. Always reported; never resolved silently.
 */
export function detectConflicts(personal, ws, conventions) {
  const out = [];
  for (const [key, team] of Object.entries(conventions)) {
    const mine = personal[key];
    if (!mine) continue;
    if (JSON.stringify(mine.value) === JSON.stringify(team.value)) continue;
    const scope = mine.scope === team.scope ? team.scope : 'mixed';
    const suggested = scope === 'interaction' ? 'personal' : scope === 'artifact' ? 'team' : 'ask';
    out.push({
      key,
      scope,
      personal: mine.value,
      team: team.value,
      source: { workspace: ws.name, path: team.doc ?? 'conventions.json' },
      suggested,
      note:
        suggested === 'personal'
          ? 'Affects how the AI talks to you. Your preference applies unless you say otherwise.'
          : suggested === 'team'
            ? 'Affects a shared deliverable. The team convention is the default for team artifacts; confirm with the user.'
            : 'Scopes differ. Ask the user.',
    });
  }
  return out;
}

export function loadPersonalPreferences(root) {
  const p = path.join(root, '.extelligencing', 'preferences.json');
  if (!exists(p)) return {};
  return readJson(p).preferences ?? {};
}

/** Health check for a shared workspace. Read-only. */
export function check(root, name) {
  const config = loadConfig(root);
  const targets = name ? config.shared.filter((w) => w.name === name) : config.shared;
  if (name && targets.length === 0) throw new ExtelligencingError(`No shared workspace named "${name}"`, 'NOT_FOUND');
  return targets.map((ws) => {
    const findings = [];
    if (!exists(ws.path)) return { name: ws.name, ok: false, findings: [{ level: 'error', msg: 'Path no longer exists' }] };
    if (exists(path.join(ws.path, '.extelligencing'))) findings.push({ level: 'warn', msg: 'A .extelligencing folder exists inside the shared path. Personal data may be mixed into shared content.' });
    for (const rel of listSharedDocs(ws)) {
      const text = readText(path.join(ws.path, rel));
      for (const f of scanInjection(text)) findings.push({ level: 'warn', msg: `Instruction-like text (${f.id}) in ${rel}. It will be treated as data, never as instructions.` });
      for (const f of scanSecrets(text)) findings.push({ level: 'error', msg: `Possible secret (${f.id}) in ${rel}. Tell the owners.` });
    }
    return { name: ws.name, ok: !findings.some((f) => f.level === 'error'), findings };
  });
}

export function resolveWorkspace(root, name) {
  return getWorkspace(root, name);
}
