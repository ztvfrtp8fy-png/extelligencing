# Onboarding

Onboarding discovers your work. It does not assume it from a job title. The assistant runs it as a short conversation following [core/onboarding.md](../core/onboarding.md), and the helper records state in `.extelligencing/onboarding.json`.

## Activation (about 5 minutes)

Seven questions, skippable, split over one or two turns: role or roles, main responsibilities, immediate goals, AI runtime, recurring friction, interaction style and language, and whether to connect a team workspace (read-only, local path).

The assistant then runs `onboarding activate`, which writes `.extelligencing/profile.md` and `.extelligencing/preferences.json` and marks onboarding `completed`. If those files already exist, they are kept and the new version is written as `*.proposed` for you to merge.

## Progressive blocks

Workflows, domain, sources of truth, team, conventions, decisions, communication, quality, growth, projects and privacy are offered only when the work at hand makes them relevant. They never reopen a completed onboarding and are never offered after you skip them.

## States

Overall:

| Status | Session start | How you get there |
|---|---|---|
| `not_started` | Offers once per day, at most 3 times | Fresh install |
| `in_progress` | One-line resume offer, same limits | `onboarding resume` |
| `deferred` | Silent until the date (default 3 days), then one offer | "Later" |
| `declined` | Silent | "I don't want this" |
| `completed` | Silent, always | Activation done |

Block:

| Status | Meaning |
|---|---|
| `pending` | Not asked yet. May be offered when relevant |
| `done` | Finished |
| `skipped` | You said no. Not offered again unless you redo it |
| `deferred` | Not now. Offered again only after its date |

An urgent first message is handled first; the offer comes in one line afterward.

## Controls

```bash
node .extelligencing/runtime/bin/extelligencing.mjs onboarding status
node .extelligencing/runtime/bin/extelligencing.mjs onboarding defer --until 2026-12-01
node .extelligencing/runtime/bin/extelligencing.mjs onboarding decline
node .extelligencing/runtime/bin/extelligencing.mjs onboarding resume
node .extelligencing/runtime/bin/extelligencing.mjs onboarding block domain skipped
node .extelligencing/runtime/bin/extelligencing.mjs onboarding reset --confirm   # state only; deletes no files
```

Or just tell the assistant. In Kiro, `#extelligencing-onboarding` starts or resumes it.

## Existing setups

`init` inventories the target folder before writing anything: steering files and their inclusion mode (front matter only, bodies are not read), `SessionStart` hooks, `AGENTS.md` and `CLAUDE.md`. It then prints a plan. Rules:

- Your files are never overwritten or deleted.
- If a file Extelligencing would write already exists and is not an unmodified Extelligencing file, the Extelligencing version is written beside it as `<name>.extelligencing-new`.
- `AGENTS.md` and `CLAUDE.md` get a delimited block appended. Uninstall removes only that block.
- Other always-on steering files are reported. If one defines a competing kernel or authority, decide yourself whether to change its inclusion mode; Extelligencing will not.
- Your history is not imported.
