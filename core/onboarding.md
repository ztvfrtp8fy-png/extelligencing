# Extelligencing Onboarding Protocol

Goal: build a useful personal configuration from the professional's actual work, fast, without a long questionnaire. Do not assume work from a job title.

State lives in `.extelligencing/onboarding.json`. Read it with `node .extelligencing/runtime/bin/extelligencing.mjs onboarding status`. Change it only through the helper.

## State model

Overall status: `not_started`, `in_progress`, `deferred`, `declined`, `completed`.

| Status | Meaning | Session start behavior |
|---|---|---|
| `not_started` | Never begun | Offer to begin (once per session) |
| `in_progress` | Activation begun, not finished | Offer to resume in one line |
| `deferred` | User said "later" | Silent until the `until` date, then offer once |
| `declined` | User does not want onboarding | Silent forever (until the user asks) |
| `completed` | Activation finished | Silent. Never mention onboarding |

Only activation gates `completed`. Progressive blocks never reopen it.

Block status: `pending` (not asked yet, may be offered when relevant), `done`, `skipped` (user said no; never offered again unless they redo it), `deferred` (not now; offered again only after `until`).

## Rules

- Be brief. Two to four questions per turn. Every question can be skipped or postponed.
- If the first message of the session is an urgent or unrelated task, do the task first. Then offer onboarding in one line. If the user says later, run `onboarding defer`; do not raise it again that session.
- Do not repeat questions for `done` or `skipped` blocks.
- Never write real names of other people, customers, ticket IDs, secrets or confidential figures. Abstract them.
- Do not read anything outside the workspace without asking. Do not import the user's past history.
- Write once at the end of a block, say in one line what was saved and where.

## Activation (about 5 minutes)

Ask only these, in one or two turns:

1. What is your role, or roles?
2. What are your main responsibilities right now?
3. What are your immediate goals?
4. Which AI runtime are you using? (kiro, claude-code, codex, other)
5. What recurring friction would you like less of?
6. How should I interact: brief and direct, guided, or something else? Any language preferences (conversation and written output)?
7. Is there a team workspace (a folder or checked-out repo) I should be able to read? If yes, its local path. Read-only.

Then run:

```
node .extelligencing/runtime/bin/extelligencing.mjs onboarding activate --json '<answers>'
```
with fields `roles[]`, `responsibilities[]`, `goals[]`, `runtime`, `friction[]`, `style` (`direct|guided|other`), `language`, `outputLanguage`, optional `sharedWorkspace` (`{name, path}`). The helper writes the profile, preferences and config, and marks onboarding completed. Show the user what was written.

## Existing setups

`extelligencing init` already reports existing runtime configuration and never overwrites it. If always-on rules overlap this kernel, list them and propose one resolution per overlap. Apply only with approval. Never delete the user's files. Do not copy content that describes another person or organization.

## Progressive blocks (offer only when relevant to the work at hand)

| Id | Topic |
|---|---|
| `workflows` | Workflows and deliverables |
| `domain` | Technical or business domains |
| `sources` | Sources of truth |
| `team` | Team structure and responsibilities |
| `conventions` | Working conventions |
| `decisions` | Decision-making patterns |
| `communication` | Communication preferences |
| `quality` | Quality requirements |
| `growth` | Skills the user wants to develop |
| `projects` | Project context and dependencies |
| `privacy` | Privacy and persistence preferences |

Record outcomes with `onboarding block <id> <done|skipped|deferred|pending> [--until YYYY-MM-DD]`. Content goes to `.extelligencing/profile.md` sections only after the user reviews it.

## Controls

- `skip` or `later` at any question.
- Resume: `#extelligencing-onboarding` or `onboarding resume`.
- Edit: re-run a block; show current content; ask what changed.
- Reset: `onboarding reset --confirm`. Sets states back; never deletes written files.
