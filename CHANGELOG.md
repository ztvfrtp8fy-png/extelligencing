# Changelog

## 0.1.0-beta.1 (release candidate, unpublished)

First public beta candidate of Extelligencing. Licensed under Apache-2.0.

### Added
- Runtime-independent core: kernel, context map, collaboration policy, evidence policy, shared-workspace policy, onboarding protocol (`core/`).
- Helper CLI (`extelligencing`): install plan and apply, uninstall, rollback on failure, doctor, boot check, onboarding state machine, context routing, shared-workspace connection, evidence proposals.
- Onboarding with explicit states (`not_started`, `in_progress`, `deferred`, `declined`, `completed`), per-block states (`pending`, `done`, `skipped`, `deferred`), offer limits, skip, defer, resume, edit and reset.
- Shared Workspace Layer: read-only access to a user-selected local path, source labels, bounded selection, conflict detection, `workspace check`.
- Kiro adapter: steering files, `SessionStart` command hook.
- Experimental Codex (`AGENTS.md`) and Claude Code (`CLAUDE.md`) adapters.
- Synthetic examples: three personas, a fictional multidisciplinary team workspace, optional product templates.
- Validation tooling for live Kiro sessions: `init --trace`, `trace show`, `scripts/kiro-validation-setup.mjs`, `scripts/kiro-validation-check.mjs`, and a manual procedure (`docs/KIRO-VALIDATION.md`).
- Automated tests, release hygiene check, documentation, contribution and security guidance.

### Not verified yet
- Behavior inside a live Kiro, Codex or Claude Code session. See `docs/KIRO-VALIDATION.md` and `docs/RUNTIME-TEST-PROTOCOL.md`.
- Any effect on productivity, cost or credit use.
