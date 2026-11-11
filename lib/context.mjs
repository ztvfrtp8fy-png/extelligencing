// Context routing: decide the smallest sufficient set of sources for a task shape.
// Returns references with scope labels. Document bodies are read only to match a --topic, and only
// the matching lines of the best matches are returned, so an agent rarely needs a broad search.
import path from 'node:path';
import { ExtelligencingError, exists, readText } from './util.mjs';
import { loadConfig, listSharedDocs, docTitle, loadConventions, loadPersonalPreferences, detectConflicts, resolveWorkspace, safeSharedPath } from './workspace.mjs';

export const TASKS = ['quick', 'drafting', 'decision', 'continuation', 'personal', 'shared', 'evidence', 'onboarding'];
const MAX_SHARED = 5;
const MAX_EXCERPT_LINES = 2;
const MAX_EXCERPT_CHARS = 160;
const STOP = new Set(['the', 'and', 'for', 'what', 'which', 'with', 'from', 'that', 'this', 'use', 'name', 'does', 'how', 'are', 'has', 'have', 'document', 'documents', 'context', 'team', 'about', 'tell', 'please']);

/** Meaningful search words of a topic: lower case, at least 3 characters, no filler words. */
export function topicTerms(topic) {
  return [...new Set(String(topic).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w)))];
}

/** The lines that contain the most search terms (ties keep document order), shown in document order. */
function bestLines(body, terms) {
  const scored = body
    .split(/\r?\n/)
    .map((line, i) => ({ i, line: line.trim(), n: terms.filter((t) => line.toLowerCase().includes(t)).length }))
    .filter((x) => x.n > 0 && !x.line.startsWith('#'));
  return scored
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, MAX_EXCERPT_LINES)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.line.slice(0, MAX_EXCERPT_CHARS));
}

/**
 * Targeted retrieval inside a shared workspace, in two steps and without any index:
 *  1. documents whose path/title contains the topic, or whose text contains ALL its terms;
 *  2. only if step 1 finds nothing: documents containing ANY term (reported as partial).
 * Each match carries at most a few matching lines, never the whole document.
 */
function matchTopic(ws, docs, topic) {
  const terms = topicTerms(topic);
  const whole = String(topic).toLowerCase();
  const info = docs.map((rel) => {
    let body = '';
    try {
      body = readText(safeSharedPath(ws, rel));
    } catch {
      /* unreadable documents simply do not match */
    }
    const label = `${rel} ${docTitle(ws, rel)}`.toLowerCase();
    const low = body.toLowerCase();
    const hit = terms.filter((t) => label.includes(t) || low.includes(t));
    return { rel, body, hit, named: label.includes(whole) };
  });
  const rank = (a, b) => b.hit.length - a.hit.length || Number(b.named) - Number(a.named) || a.rel.localeCompare(b.rel);
  const tier1 = info.filter((d) => d.named || (terms.length > 0 && d.hit.length === terms.length));
  const chosen = tier1.length ? tier1 : info.filter((d) => d.hit.length > 0);
  const partial = tier1.length === 0 && chosen.length > 0;
  return {
    partial,
    terms,
    matches: chosen.sort(rank).map((d) => ({
      rel: d.rel,
      hit: d.hit,
      excerpt: bestLines(d.body, d.hit),
    })),
  };
}

/** Where a policy document lives for a given runtime. */
export function policyPath(runtime, ref) {
  return runtime === 'kiro' ? `.kiro/steering/extelligencing-${ref}.md` : `.extelligencing/core/${ref}.md`;
}

export function route(root, { task, topic = null, workspace = null, showConflicts = false }) {
  if (!TASKS.includes(task)) throw new ExtelligencingError(`Unknown task shape "${task}". Use one of: ${TASKS.join(', ')}`, 'BAD_TASK');
  const config = loadConfig(root);
  const items = [];
  const missing = [];
  const notes = [];
  let conflicts = [];
  let conflictsNotShown = 0;

  const policy = (ref, reason) => items.push({ scope: 'framework', path: policyPath(config.runtime, ref), reason });
  const personal = (rel, reason) => {
    if (exists(path.join(root, rel))) items.push({ scope: 'personal', path: rel, reason });
    else missing.push(`${rel} (personal) does not exist`);
  };

  const wantShared = ['shared', 'drafting', 'decision'].includes(task);
  const sharedKinds = { shared: ['conventions', 'context', 'decisions', 'templates'], drafting: ['templates', 'conventions'], decision: ['conventions', 'decisions'] }[task];

  switch (task) {
    case 'quick':
      notes.push('Kernel only. Load nothing else.');
      break;
    case 'drafting':
      personal('.extelligencing/preferences.json', 'how this person wants output written');
      break;
    case 'decision':
      policy('collaboration', 'intervention rules for consequential decisions');
      break;
    case 'continuation':
      notes.push("Read the project's own prior context first (outside Extelligencing), then preferences if style matters.");
      personal('.extelligencing/preferences.json', 'interaction style');
      break;
    case 'personal':
      personal('.extelligencing/profile.md', 'roles and responsibilities');
      personal('.extelligencing/preferences.json', 'structured preferences');
      break;
    case 'evidence':
      policy('evidence', 'persistence rules');
      break;
    case 'onboarding':
      policy('onboarding', 'protocol');
      personal('.extelligencing/onboarding.json', 'current state');
      break;
    case 'shared':
      policy('shared-workspace', 'scope and conflict rules');
      break;
  }

  if (wantShared || showConflicts) {
    const ws = resolveWorkspace(root, workspace);
    if (!ws) {
      missing.push('No shared workspace is connected');
    } else if (!exists(ws.path)) {
      missing.push(`Shared workspace "${ws.name}" path no longer exists`);
    } else {
      if (wantShared) {
        const kinds = sharedKinds;
        const docs = listSharedDocs(ws).filter((rel) => kinds.includes(rel.split('/')[0]));
        let picked = docs.map((rel) => ({ rel, reason: `${rel.split('/')[0]} document`, excerpt: [] }));
        if (topic) {
          const m = matchTopic(ws, docs, topic);
          picked = m.matches.map((x) => ({
            rel: x.rel,
            reason: m.partial ? `partial match: ${x.hit.join(', ')}` : `matches "${topic}"`,
            excerpt: x.excerpt,
          }));
          if (m.partial) notes.push(`No shared document contains all of: ${m.terms.join(', ')}. Showing partial matches only.`);
          if (picked.length === 0) {
            missing.push(`No shared document matches topic "${topic}". Try fewer or different words. Only if that fails, search the shared folder directly (read-only), list matching file names first, then open the best one.`);
          }
        }
        for (const x of picked.slice(0, MAX_SHARED)) items.push({ scope: 'shared', workspace: ws.name, path: x.rel, reason: x.reason, ...(x.excerpt.length ? { excerpt: x.excerpt } : {}) });
        if (picked.length > MAX_SHARED) notes.push(`${picked.length - MAX_SHARED} more shared documents match; pass --topic to narrow.`);
      }
      const all = detectConflicts(loadPersonalPreferences(root), ws, loadConventions(ws));
      // A conflict is shown when it can change the work: always on request, and for drafting only if it
      // concerns a team deliverable (artifact scope). A personal interaction preference simply applies.
      conflicts = showConflicts ? all : task === 'drafting' ? all.filter((c) => c.scope !== 'interaction') : [];
      conflictsNotShown = all.length - conflicts.length;
    }
  }

  return { task, runtime: config.runtime, items, missing, conflicts, ...(conflictsNotShown ? { conflictsNotShown } : {}), notes };
}

export function formatRoute(r) {
  const lines = [`Task: ${r.task}`];
  if (r.items.length === 0) lines.push('Load: nothing beyond the kernel');
  for (const i of r.items) {
    lines.push(`Load [${i.scope}${i.workspace ? ':' + i.workspace : ''}] ${i.path} - ${i.reason}`);
    for (const e of i.excerpt ?? []) lines.push(`    > ${e}`);
  }
  for (const m of r.missing) lines.push(`Missing: ${m}`);
  for (const c of r.conflicts) lines.push(`Conflict on "${c.key}" (${c.scope}): personal=${JSON.stringify(c.personal)} team=${JSON.stringify(c.team)} [${c.source.workspace}:${c.source.path}]. ${c.note}`);
  for (const n of r.notes) lines.push(`Note: ${n}`);
  return lines.join('\n');
}
