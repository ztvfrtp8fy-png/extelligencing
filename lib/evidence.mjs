// Evidence and persistence governance: observe -> propose -> review -> approve -> persist.
// A proposal is staging only. Persisting needs explicit approval of that proposal.
import fs from 'node:fs';
import path from 'node:path';
import { ExtelligencingError, exists, readJson, writeJson, writeFileAtomic, readText, isoDate, addDays } from './util.mjs';
import { scanSecrets, scanPii } from './secrets.mjs';

export const KINDS = ['observation', 'hypothesis', 'repeated_pattern', 'preference', 'decision', 'validated_learning'];
const MIN_INSTANCES = 3;
const EVALUATIVE = /\b(skill level|proficien\w+|rated|rating|score[sd]?|weak at|poor at|bad at|incompetent|senior-level|junior-level|underperform\w*)\b/i;

const dir = (root) => path.join(root, '.extelligencing', 'evidence', 'proposals');
const file = (root, id) => path.join(dir(root), `${id}.json`);

function nextId(root, nowDate) {
  const stamp = isoDate(nowDate).replace(/-/g, '');
  fs.mkdirSync(dir(root), { recursive: true });
  const n = fs.readdirSync(dir(root)).filter((f) => f.startsWith(`ev-${stamp}-`)).length + 1;
  return `ev-${stamp}-${String(n).padStart(3, '0')}`;
}

export function propose(root, input, nowDate) {
  const { kind, summary } = input;
  if (!KINDS.includes(kind)) throw new ExtelligencingError(`kind must be one of ${KINDS.join(', ')}`, 'BAD_PROPOSAL');
  if (typeof summary !== 'string' || !summary.trim()) throw new ExtelligencingError('summary is required', 'BAD_PROPOSAL');
  if (summary.length > 500) throw new ExtelligencingError('summary must be 500 characters or fewer', 'BAD_PROPOSAL');
  const instances = Array.isArray(input.instances) ? input.instances.map(String) : [];
  const warnings = [];

  if ((kind === 'repeated_pattern' || kind === 'validated_learning') && instances.length < MIN_INSTANCES) {
    throw new ExtelligencingError(`${kind} needs at least ${MIN_INSTANCES} independent instances (got ${instances.length}). Propose an observation or hypothesis instead.`, 'INSUFFICIENT_EVIDENCE');
  }
  if (kind === 'validated_learning' && !(Array.isArray(input.outcome_refs) && input.outcome_refs.length)) {
    throw new ExtelligencingError('validated_learning needs outcome_refs linking the pattern to a measured outcome', 'INSUFFICIENT_EVIDENCE');
  }
  if ((kind === 'preference' || kind === 'decision') && !(typeof input.quote === 'string' && input.quote.trim())) {
    throw new ExtelligencingError(`${kind} needs "quote": the person's own words, not an interpretation`, 'BAD_PROPOSAL');
  }
  if (kind === 'preference') {
    if (typeof input.key !== 'string' || !/^[a-z][a-z0-9_]*$/.test(input.key)) throw new ExtelligencingError('preference needs a snake_case "key"', 'BAD_PROPOSAL');
    if (input.value === undefined) throw new ExtelligencingError('preference needs "value"', 'BAD_PROPOSAL');
  }
  if (EVALUATIVE.test(summary) && kind !== 'preference' && kind !== 'decision') {
    warnings.push('Evaluative wording detected. A model must not rate the person. Rephrase as an observable behavior or drop it.');
  }
  if (kind === 'hypothesis') warnings.push('Hypothesis: a guess, not a fact about the person.');
  if (kind === 'observation' && instances.length === 0) warnings.push('No instance listed. State the concrete event.');

  const blob = JSON.stringify(input);
  const secrets = scanSecrets(blob);
  if (secrets.length) throw new ExtelligencingError(`Proposal appears to contain a secret (${secrets.map((s) => s.id).join(', ')}). Remove it; nothing was stored.`, 'SECRET_DETECTED');
  if (scanPii(blob).length) warnings.push('Possible personal contact data (email). Remove third-party personal data before approving.');

  const id = nextId(root, nowDate);
  const proposal = {
    schema: 1,
    id,
    status: 'proposed',
    kind,
    summary: summary.trim(),
    instances,
    counter_evidence: input.counter_evidence ? String(input.counter_evidence) : null,
    outcome_refs: input.outcome_refs ?? undefined,
    quote: input.quote ?? undefined,
    key: input.key ?? undefined,
    value: input.value ?? undefined,
    scope: input.scope === 'artifact' ? 'artifact' : 'interaction',
    warnings,
    created: isoDate(nowDate),
    decided: null,
  };
  writeJson(file(root, id), proposal);
  return proposal;
}

export function get(root, id) {
  if (!/^ev-\d{8}-\d{3}$/.test(id)) throw new ExtelligencingError(`Invalid proposal id: ${id}`, 'BAD_ID');
  if (!exists(file(root, id))) throw new ExtelligencingError(`No such proposal: ${id}`, 'NOT_FOUND');
  return readJson(file(root, id));
}

export function list(root, status) {
  if (!exists(dir(root))) return [];
  return fs.readdirSync(dir(root)).filter((f) => f.endsWith('.json')).sort().map((f) => readJson(path.join(dir(root), f))).filter((p) => !status || p.status === status);
}

export function reject(root, id, reason, nowDate) {
  const p = get(root, id);
  if (p.status === 'approved') throw new ExtelligencingError('Already approved and persisted. Edit the persisted file by hand to remove it.', 'BAD_TRANSITION');
  p.status = 'rejected';
  p.reason = reason ? String(reason) : null;
  p.decided = isoDate(nowDate);
  writeJson(file(root, id), p);
  return p;
}

export function defer(root, id, nowDate, until) {
  const p = get(root, id);
  if (p.status === 'approved' || p.status === 'rejected') throw new ExtelligencingError(`Proposal is ${p.status}; it cannot be deferred.`, 'BAD_TRANSITION');
  p.status = 'deferred';
  p.until = until || isoDate(addDays(nowDate, 14));
  p.decided = isoDate(nowDate);
  writeJson(file(root, id), p);
  return p;
}

/**
 * Persist an approved proposal. `confirm` must be true: it records that the person
 * explicitly approved this exact proposal. It cannot be inferred.
 */
export function approve(root, id, { confirm }, nowDate) {
  if (confirm !== true) throw new ExtelligencingError('Approval needs --confirm, passed only after the person explicitly approved this proposal.', 'NEEDS_CONFIRM');
  const p = get(root, id);
  if (p.status !== 'proposed' && p.status !== 'deferred') throw new ExtelligencingError(`Proposal is ${p.status}; only proposed or deferred proposals can be approved. Re-propose with new evidence if needed.`, 'BAD_TRANSITION');
  const persisted = persist(root, p, nowDate);
  p.status = 'approved';
  p.decided = isoDate(nowDate);
  p.persisted_to = persisted;
  writeJson(file(root, id), p);
  return p;
}

function persist(root, p, nowDate) {
  if (p.kind === 'preference') {
    const pp = path.join(root, '.extelligencing', 'preferences.json');
    const data = exists(pp) ? readJson(pp) : { schema: 1, preferences: {} };
    data.preferences[p.key] = { value: p.value, scope: p.scope };
    writeJson(pp, data);
    return '.extelligencing/preferences.json';
  }
  if (p.kind === 'decision') {
    const rel = path.join('.extelligencing', 'decisions', `${p.id}.md`);
    writeFileAtomic(path.join(root, rel), `# Decision ${p.id}\n\n- Date: ${isoDate(nowDate)}\n- Summary: ${p.summary}\n- In the person's words: "${p.quote}"\n`);
    return rel.split(path.sep).join('/');
  }
  const rel = '.extelligencing/evidence/log.md';
  const lp = path.join(root, rel);
  const head = exists(lp) ? readText(lp) : '# Approved Evidence Log\n\nEntries here were each approved by the person. Hypotheses stay labeled as hypotheses.\n';
  const lines = [`\n## ${p.id} (${p.kind})`, `- Approved: ${isoDate(nowDate)}`, `- ${p.summary}`];
  if (p.instances.length) lines.push(`- Instances: ${p.instances.length}`, ...p.instances.map((i) => `  - ${i}`));
  if (p.counter_evidence) lines.push(`- Counter-evidence considered: ${p.counter_evidence}`);
  writeFileAtomic(lp, head + lines.join('\n') + '\n');
  return rel;
}
