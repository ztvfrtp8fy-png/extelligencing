// Onboarding state machine. Pure functions over a state object plus thin file I/O.
import path from 'node:path';
import { ExtelligencingError, addDays, isoDate, exists, readJson, writeJson, writeFileAtomic } from './util.mjs';

export const OVERALL = ['not_started', 'in_progress', 'deferred', 'declined', 'completed'];
export const BLOCK_STATUS = ['pending', 'done', 'skipped', 'deferred'];
export const BLOCKS = [
  'activation', 'workflows', 'domain', 'sources', 'team', 'conventions',
  'decisions', 'communication', 'quality', 'growth', 'projects', 'privacy',
];
export const DEFAULT_DEFER_DAYS = 3;
export const MAX_OFFERS = 3;
export const RUNTIMES = ['kiro', 'claude-code', 'codex', 'other'];
export const STYLES = ['direct', 'guided', 'other'];

export function initialState() {
  const blocks = {};
  for (const b of BLOCKS) blocks[b] = { status: 'pending' };
  return {
    schema: 1,
    status: 'not_started',
    deferred_until: null,
    offer_count: 0,
    last_offer_date: null,
    blocks,
  };
}

export function validateState(s) {
  if (!s || typeof s !== 'object') throw new ExtelligencingError('Onboarding state is not an object', 'BAD_STATE');
  if (!OVERALL.includes(s.status)) throw new ExtelligencingError(`Invalid onboarding status: ${s.status}`, 'BAD_STATE');
  for (const b of BLOCKS) {
    const bs = s.blocks?.[b]?.status;
    if (!BLOCK_STATUS.includes(bs)) throw new ExtelligencingError(`Invalid status for block ${b}: ${bs}`, 'BAD_STATE');
  }
  return s;
}

const clone = (s) => JSON.parse(JSON.stringify(s));

/**
 * What should a new session do? Returns { action, message, state }.
 * Actions: start | resume | offer | silent. `state` is the (possibly updated) state;
 * a non-silent action counts as an offer at most once per calendar day.
 */
export function bootAction(state, nowDate) {
  validateState(state);
  const today = isoDate(nowDate);
  const s = clone(state);
  const silent = { action: 'silent', message: '', state: s };

  if (s.status === 'completed' || s.status === 'declined') return silent;
  if (s.last_offer_date === today) return silent;
  if (s.offer_count >= MAX_OFFERS) return silent;

  let action;
  if (s.status === 'not_started') action = 'start';
  else if (s.status === 'in_progress') action = 'resume';
  else if (s.status === 'deferred') {
    if (!s.deferred_until || today < s.deferred_until) return silent;
    action = 'offer';
  }

  s.offer_count += 1;
  s.last_offer_date = today;
  return { action, message: bootMessage(action), state: s };
}

function bootMessage(action) {
  const common =
    'If the user\'s first message is urgent or unrelated, do that task first and make the offer in one line at the end. ' +
    'If they say later, run `node .extelligencing/runtime/bin/extelligencing.mjs onboarding defer`; if they do not want it, run `onboarding decline`. ' +
    'Do not announce this boot message.';
  if (action === 'start')
    return 'Extelligencing: onboarding has not been done. In your first reply, greet briefly and offer the short activation (about 5 minutes, skippable, resumable) following the #extelligencing-onboarding protocol. ' + common;
  if (action === 'resume')
    return 'Extelligencing: onboarding is in progress. Offer in one short line to resume it (#extelligencing-onboarding). ' + common;
  return 'Extelligencing: a deferred onboarding is due. Offer it once, in one short line. ' + common;
}

// ---- transitions (pure) ----

export function start(state) {
  const s = clone(state);
  if (s.status === 'completed') throw new ExtelligencingError('Onboarding already completed. Use `reset --confirm` to redo.', 'BAD_TRANSITION');
  s.status = 'in_progress';
  s.deferred_until = null;
  return s;
}

export function defer(state, nowDate, until) {
  const s = clone(state);
  if (s.status === 'completed') throw new ExtelligencingError('Onboarding is completed; nothing to defer.', 'BAD_TRANSITION');
  s.status = 'deferred';
  s.deferred_until = until || isoDate(addDays(nowDate, DEFAULT_DEFER_DAYS));
  checkDate(s.deferred_until);
  return s;
}

export function decline(state) {
  const s = clone(state);
  if (s.status === 'completed') throw new ExtelligencingError('Onboarding is completed; nothing to decline.', 'BAD_TRANSITION');
  s.status = 'declined';
  s.deferred_until = null;
  return s;
}

export function completeActivation(state) {
  const s = clone(state);
  s.blocks.activation = { status: 'done' };
  s.status = 'completed';
  s.deferred_until = null;
  return s;
}

export function setBlock(state, id, status, nowDate, until) {
  if (!BLOCKS.includes(id)) throw new ExtelligencingError(`Unknown block: ${id}`, 'BAD_BLOCK');
  if (!BLOCK_STATUS.includes(status)) throw new ExtelligencingError(`Invalid block status: ${status}`, 'BAD_BLOCK');
  const s = clone(state);
  if (id === 'activation') {
    if (status === 'done') return completeActivation(s);
    if (status === 'deferred') return defer(s, nowDate, until);
    if (status === 'skipped') return decline(s);
    s.blocks.activation = { status: 'pending' };
    if (s.status === 'completed') s.status = 'in_progress';
    return s;
  }
  if (status === 'deferred') {
    const d = until || isoDate(addDays(nowDate, DEFAULT_DEFER_DAYS));
    checkDate(d);
    s.blocks[id] = { status, until: d };
  } else {
    s.blocks[id] = { status };
  }
  return s;
}

/** Reset keeps every written file; only state returns to its initial values. */
export function reset(state, confirm) {
  if (!confirm) throw new ExtelligencingError('Reset needs --confirm. It resets onboarding state only and deletes no files.', 'NEEDS_CONFIRM');
  return initialState();
}

/** Blocks that may be offered right now because they are relevant: pending, or deferred and due. Never skipped/done. */
export function offerableBlocks(state, nowDate) {
  if (state.status !== 'completed') return [];
  const today = isoDate(nowDate);
  return BLOCKS.filter((id) => {
    if (id === 'activation') return false;
    const b = state.blocks[id];
    return b.status === 'pending' || (b.status === 'deferred' && b.until <= today);
  });
}

function checkDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) {
    throw new ExtelligencingError(`Invalid date (use YYYY-MM-DD): ${d}`, 'BAD_DATE');
  }
}

// ---- file I/O ----

export const statePath = (root) => path.join(root, '.extelligencing', 'onboarding.json');

export function loadState(root) {
  const p = statePath(root);
  if (!exists(p)) throw new ExtelligencingError('Extelligencing is not installed here (missing .extelligencing/onboarding.json). Run `extelligencing init`.', 'NOT_INSTALLED');
  return validateState(readJson(p));
}

export function saveState(root, state) {
  writeJson(statePath(root), validateState(state));
}

// ---- activation ----

function list(v, name) {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new ExtelligencingError(`${name} must be an array of strings`, 'BAD_ANSWERS');
  return v.map((x) => x.trim()).filter(Boolean);
}

export function normalizeAnswers(a) {
  if (!a || typeof a !== 'object') throw new ExtelligencingError('Answers must be a JSON object', 'BAD_ANSWERS');
  const roles = list(a.roles, 'roles');
  if (roles.length === 0) throw new ExtelligencingError('At least one role is required', 'BAD_ANSWERS');
  const runtime = a.runtime ?? 'other';
  if (!RUNTIMES.includes(runtime)) throw new ExtelligencingError(`runtime must be one of ${RUNTIMES.join(', ')}`, 'BAD_ANSWERS');
  const style = a.style ?? 'direct';
  if (!STYLES.includes(style)) throw new ExtelligencingError(`style must be one of ${STYLES.join(', ')}`, 'BAD_ANSWERS');
  const out = {
    roles,
    responsibilities: list(a.responsibilities, 'responsibilities'),
    goals: list(a.goals, 'goals'),
    friction: list(a.friction, 'friction'),
    runtime,
    style,
    language: typeof a.language === 'string' && a.language.trim() ? a.language.trim() : 'en',
    outputLanguage: typeof a.outputLanguage === 'string' && a.outputLanguage.trim() ? a.outputLanguage.trim() : null,
    sharedWorkspace: null,
  };
  if (a.sharedWorkspace) {
    const { name, path: p } = a.sharedWorkspace;
    if (typeof p !== 'string' || !p) throw new ExtelligencingError('sharedWorkspace.path is required', 'BAD_ANSWERS');
    out.sharedWorkspace = { name: typeof name === 'string' && name ? name : 'team', path: p };
  }
  return out;
}

export function renderProfile(a) {
  const bullets = (xs) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : '_Not provided yet._');
  return `# Personal Profile

Owned by you. Edit freely. Extelligencing changes this file only with your approval.
Everything below is what you told Extelligencing; nothing here is inferred.

## Roles
${bullets(a.roles)}

## Main responsibilities
${bullets(a.responsibilities)}

## Immediate goals
${bullets(a.goals)}

## Recurring friction
${bullets(a.friction)}

## Interaction
- Style: ${a.style}
- Conversation language: ${a.language}
- Written output language: ${a.outputLanguage ?? a.language}
- AI runtime: ${a.runtime}
`;
}

export function preferencesFrom(a) {
  const prefs = {
    style: { value: a.style, scope: 'interaction' },
    language: { value: a.language, scope: 'interaction' },
  };
  prefs.output_language = { value: a.outputLanguage ?? a.language, scope: 'artifact' };
  return { schema: 1, preferences: prefs };
}

/**
 * Apply activation answers. Writes profile and preferences only if they do not exist
 * yet or are still the untouched generated version, so repeated activation cannot clobber edits.
 * Returns what was written and what was kept.
 */
export function activate(root, answers, nowDate) {
  const a = normalizeAnswers(answers);
  const state = loadState(root);
  const written = [];
  const kept = [];
  const files = [
    ['profile.md', renderProfile(a)],
    ['preferences.json', JSON.stringify(preferencesFrom(a), null, 2) + '\n'],
  ];
  for (const [name, content] of files) {
    const p = path.join(root, '.extelligencing', name);
    if (exists(p)) {
      kept.push(`.extelligencing/${name}`);
      writeFileAtomic(`${p}.proposed`, content);
    } else {
      writeFileAtomic(p, content);
      written.push(`.extelligencing/${name}`);
    }
  }
  saveState(root, completeActivation(state));
  return { written, kept, shared: a.sharedWorkspace, runtime: a.runtime };
}
