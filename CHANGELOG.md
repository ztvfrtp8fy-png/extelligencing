# Changelog

## 0.1.0-beta.1 (release candidate; date set at publication)

First public beta of Extelligencing. Licensed under Apache-2.0.

### Added
- Runtime-independent core: kernel, context map, collaboration policy, evidence policy, shared-workspace policy, onboarding protocol (`core/`).
- Helper CLI (`extelligencing`): install plan and apply, uninstall, rollback on failure, `doctor`, session-start check, onboarding state machine, context routing, shared-workspace connection, evidence proposals.
- Onboarding with explicit states (`not_started`, `in_progress`, `deferred`, `declined`, `completed`) and block states (`pending`, `done`, `skipped`, `deferred`), offer limits, skip, defer, resume, edit and reset.
- Shared Workspace Layer: read-only access to a user-selected local path, source labels, bounded selection, conflict detection, `workspace check`.
- Kiro adapter: steering files and a `SessionStart` command hook.
- Experimental Codex (`AGENTS.md`) and Claude Code (`CLAUDE.md`) adapters.
- Synthetic examples (three personas, a fictional multidisciplinary team workspace) and optional product templates.
- Validation tooling for live Kiro sessions: `init --trace`, `trace show`, `scripts/kiro-validation-setup.mjs`, `scripts/kiro-validation-check.mjs`.
- 86 automated tests, a release hygiene check (`npm run check:release`), and contribution, security and conduct documents.

### Changed after the first live Kiro sessions
- `context route --topic` matches words in file names, titles and text (all words first, then any word, labeled partial) and returns only the best matching lines, so shared lookups need not search the whole shared workspace.
- Preference conflicts are shown automatically only when they affect the task (drafting a team deliverable); `--conflicts` lists all on request.
- Kernel and context-map policy: targeted retrieval first, direct search only as a fallback, no unrelated facts in answers, no unprompted conflict mentions.

### Security
- `init` and `uninstall` refuse to write or delete through a symbolic link that resolves outside the target folder, and `init` validates every path before writing anything.

### Validation status
- Kiro IDE 1.4.62 on macOS: observed in a small number of live sessions with synthetic data. See `docs/KIRO-VALIDATION.md` for what was and was not observed. The hook runs only in trusted workspaces.
- Codex and Claude Code: generated files are tested statically; not verified in live sessions.

### Known limitations
- No measurement of cost, credits or productivity; no such claim is made.
- Read-only shared access and the approval step are helper behavior and policy, not an operating-system sandbox.
- Partial-match retrieval can return loosely related documents; assistants occasionally add unneeded context or mention irrelevant conflicts.
- macOS only has been tested. See `docs/KNOWN-LIMITATIONS.md`.
