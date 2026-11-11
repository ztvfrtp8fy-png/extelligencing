// Context routing: decide the smallest sufficient set of sources for a task shape.
// Returns references with scope labels. It does not load document bodies (except titles for matching).
import path from 'node:path';
import { ExtelligencingError, exists } from './util.mjs';
import { loadConfig, listSharedDocs, docTitle, loadConventions, loadPersonalPreferences, detectConflicts, resolveWorkspace } from './workspace.mjs';

export const TASKS = ['quick', 'drafting', 'decision', 'continuation', 'personal', 'shared', 'evidence', 'onboarding'];
const MAX_SHARED = 5;

/** Where a policy document lives for a given runtime. */
export function policyPath(runtime, ref) {
  return runtime === 'kiro' ? `.kiro/steering/extelligencing-${ref}.md` : `.extelligencing/core/${ref}.md`;
}

export function route(root, { task, topic = null, workspace = null }) {
  if (!TASKS.includes(task)) throw new ExtelligencingError(`Unknown task shape "${task}". Use one of: ${TASKS.join(', ')}`, 'BAD_TASK');
  const config = loadConfig(root);
  const items = [];
  const missing = [];
  const notes = [];
  let conflicts = [];

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

  if (wantShared) {
    const ws = resolveWorkspace(root, workspace);
    if (!ws) {
      missing.push('No shared workspace is connected');
    } else if (!exists(ws.path)) {
      missing.push(`Shared workspace "${ws.name}" path no longer exists`);
    } else {
      const kinds = sharedKinds;
      let docs = listSharedDocs(ws).filter((rel) => kinds.includes(rel.split('/')[0]));
      if (topic) {
        const t = topic.toLowerCase();
        docs = docs.filter((rel) => rel.toLowerCase().includes(t) || docTitle(ws, rel).toLowerCase().includes(t));
        if (docs.length === 0) missing.push(`No shared document matches topic "${topic}"`);
      }
      const truncated = docs.length > MAX_SHARED;
      for (const rel of docs.slice(0, MAX_SHARED)) items.push({ scope: 'shared', workspace: ws.name, path: rel, reason: topic ? `matches "${topic}"` : `${rel.split('/')[0]} document` });
      if (truncated) notes.push(`${docs.length - MAX_SHARED} more shared documents match; pass --topic to narrow.`);
      conflicts = detectConflicts(loadPersonalPreferences(root), ws, loadConventions(ws));
    }
  }

  return { task, runtime: config.runtime, items, missing, conflicts, notes };
}

export function formatRoute(r) {
  const lines = [`Task: ${r.task}`];
  if (r.items.length === 0) lines.push('Load: nothing beyond the kernel');
  for (const i of r.items) lines.push(`Load [${i.scope}${i.workspace ? ':' + i.workspace : ''}] ${i.path} - ${i.reason}`);
  for (const m of r.missing) lines.push(`Missing: ${m}`);
  for (const c of r.conflicts) lines.push(`Conflict on "${c.key}" (${c.scope}): personal=${JSON.stringify(c.personal)} team=${JSON.stringify(c.team)} [${c.source.workspace}:${c.source.path}]. ${c.note}`);
  for (const n of r.notes) lines.push(`Note: ${n}`);
  return lines.join('\n');
}
