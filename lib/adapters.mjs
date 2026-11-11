// Runtime adapters: turn the runtime-independent core/ into runtime-native files.
// Each adapter returns managed entries: { path, content, type: 'file' | 'block' }.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readText } from './util.mjs';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BLOCK_BEGIN = '<!-- extelligencing:begin (managed by Extelligencing; edit outside this block) -->';
export const BLOCK_END = '<!-- extelligencing:end -->';

export const SUPPORTED = ['kiro', 'codex', 'claude-code'];

/** Honest status per runtime. Keep in sync with docs/RUNTIME-MATRIX.md. */
export const RUNTIME_STATUS = {
  kiro: 'primary integration (observed in a small number of live sessions; see docs/KIRO-VALIDATION.md)',
  codex: 'experimental (AGENTS.md; not verified in a live Codex session)',
  'claude-code': 'experimental (CLAUDE.md import; not verified in a live Claude Code session)',
};

const core = (name) => readText(path.join(REPO_ROOT, 'core', `${name}.md`));

const STEERING = {
  'context-map': { inclusion: 'auto', description: 'Extelligencing context routing. Use when a task needs professional context beyond a quick answer: drafting a deliverable, decision support, continuing known work, or using personal or shared team conventions. Do not activate for trivial or purely operational tasks.' },
  collaboration: { inclusion: 'auto', description: 'Extelligencing intervention policy. Use when deciding whether to teach, challenge or reflect, or when a consequential or hard-to-reverse decision is being made. Do not activate for routine or urgent tasks.' },
  evidence: { inclusion: 'auto', description: 'Extelligencing persistence rules. Use before proposing or writing any memory, preference, decision, evaluation or note about the user, and when reviewing proposed changes to persistent context.' },
  'shared-workspace': { inclusion: 'auto', description: 'Extelligencing shared workspace rules. Use when reading team conventions or shared context from a connected shared workspace, or when personal and team conventions may conflict.' },
  onboarding: { inclusion: 'manual', description: 'Extelligencing onboarding protocol. Invoke with #extelligencing-onboarding to begin, resume, edit or reset onboarding.' },
};

const MANAGED_NOTE = '<!-- Managed by Extelligencing. Local edits are kept on upgrade; a .extelligencing-new file is written beside it instead. -->';

function kiroEntries() {
  const entries = [
    { path: '.kiro/steering/extelligencing-kernel.md', type: 'file', content: `${MANAGED_NOTE}\n${core('kernel')}` },
  ];
  for (const [name, fm] of Object.entries(STEERING)) {
    const front = `---\ninclusion: ${fm.inclusion}\nname: extelligencing-${name}\ndescription: "${fm.description.replace(/"/g, "'")}"\n---\n`;
    entries.push({ path: `.kiro/steering/extelligencing-${name}.md`, type: 'file', content: `${front}${MANAGED_NOTE}\n${core(name)}` });
  }
  const hook = {
    version: 'v1',
    hooks: [
      {
        name: 'Extelligencing Boot',
        trigger: 'SessionStart',
        action: { type: 'command', command: 'node .extelligencing/runtime/bin/extelligencing.mjs boot' },
      },
    ],
  };
  entries.push({ path: '.kiro/hooks/extelligencing-boot.json', type: 'file', content: JSON.stringify(hook, null, 2) + '\n' });
  return entries;
}

function coreCopies() {
  return ['kernel', 'context-map', 'collaboration', 'evidence', 'shared-workspace', 'onboarding'].map((n) => ({
    path: `.extelligencing/core/${n}.md`,
    type: 'file',
    content: core(n),
  }));
}

const POINTERS = `## Policies, loaded only when the task needs them

- Context routing: .extelligencing/core/context-map.md (run \`node .extelligencing/runtime/bin/extelligencing.mjs context route --task <shape>\` for the exact files)
- Intervention policy: .extelligencing/core/collaboration.md
- Persistence and evidence: .extelligencing/core/evidence.md
- Shared workspace rules: .extelligencing/core/shared-workspace.md
- Onboarding protocol: .extelligencing/core/onboarding.md

## Session start

If you can run commands, run \`node .extelligencing/runtime/bin/extelligencing.mjs boot\` once at the start of a session and follow its output if it prints anything. If it prints nothing, say nothing. If you cannot run commands, do nothing; the user can ask to "start Extelligencing onboarding".`;

function agentsBlock() {
  return `${BLOCK_BEGIN}\n# Extelligencing\n\n${core('kernel').replace(/^# Extelligencing Kernel\n+/, '')}\n${POINTERS}\n${BLOCK_END}\n`;
}

function claudeBlock() {
  return `${BLOCK_BEGIN}\n# Extelligencing\n\n@.extelligencing/core/kernel.md\n\n${POINTERS}\n${BLOCK_END}\n`;
}

function runtimeCopies() {
  const out = [];
  const add = (rel) => out.push({ path: `.extelligencing/runtime/${rel}`, type: 'file', content: readText(path.join(REPO_ROOT, rel)) });
  add('bin/extelligencing.mjs');
  for (const f of fs.readdirSync(path.join(REPO_ROOT, 'lib')).filter((f) => f.endsWith('.mjs')).sort()) add(`lib/${f}`);
  // The adapters read core/ at install time only; the installed copy needs the core text for `doctor`.
  return out;
}

export function entriesFor(runtime) {
  if (!SUPPORTED.includes(runtime)) throw new Error(`Unsupported runtime: ${runtime}. Choose one of ${SUPPORTED.join(', ')}`);
  const common = [
    ...runtimeCopies(),
    { path: '.extelligencing/.gitignore', type: 'file', content: '# Personal data. Keep out of shared repositories.\n*\n!.gitignore\n' },
  ];
  if (runtime === 'kiro') return [...common, ...kiroEntries()];
  if (runtime === 'codex') return [...common, ...coreCopies(), { path: 'AGENTS.md', type: 'block', content: agentsBlock() }];
  return [...common, ...coreCopies(), { path: 'CLAUDE.md', type: 'block', content: claudeBlock() }];
}
