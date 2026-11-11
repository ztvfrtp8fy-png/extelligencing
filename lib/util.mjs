// Small shared helpers. No dependencies.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class ExtelligencingError extends Error {
  constructor(message, code = 'EXTELLIGENCING_ERROR') {
    super(message);
    this.name = 'ExtelligencingError';
    this.code = code;
  }
}

export const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

/** Current time. EXTELLIGENCING_NOW (ISO string) overrides it, which keeps tests deterministic. */
export function now(env = process.env) {
  return env.EXTELLIGENCING_NOW ? new Date(env.EXTELLIGENCING_NOW) : new Date();
}

export const isoDate = (d) => d.toISOString().slice(0, 10);

export function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function exists(p) {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

export function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

export function readJson(p) {
  try {
    return JSON.parse(readText(p));
  } catch (e) {
    throw new ExtelligencingError(`Cannot read JSON at ${p}: ${e.message}`, 'BAD_JSON');
  }
}

/** Write atomically: temp file then rename. */
export function writeFileAtomic(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, p);
}

export function writeJson(p, data) {
  writeFileAtomic(p, JSON.stringify(data, null, 2) + '\n');
}

/** True if child is the same as or inside parent (both resolved, symlinks followed when they exist). */
export function isInside(parent, child) {
  const rp = realOrResolve(parent);
  const rc = realOrResolve(child);
  const rel = path.relative(rp, rc);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function realOrResolve(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

/** Parse `--key value`, `--flag`, and positionals. */
export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[a.slice(2)] = next;
          i++;
        } else {
          flags[a.slice(2)] = true;
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

/** Parse a tiny `key: value` front matter block. Returns { data, body }. */
export function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { data, body: m[2] };
}
