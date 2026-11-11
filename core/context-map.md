# Extelligencing Context Map

Routes a task to the smallest sufficient context. It points to content; it does not contain it. Under-loading is safer than over-loading. Never load "just in case" or the whole workspace.

You can ask the helper for the exact files: `node .extelligencing/runtime/bin/extelligencing.mjs context route --task <shape>`. It prints each file with its scope (personal, shared, project) and flags conflicts. If it cannot run, use the table below by hand.

| Task shape | `--task` | Load | Do not load |
|---|---|---|---|
| Quick or operational | `quick` | Nothing beyond the kernel | Everything else |
| Drafting a deliverable | `drafting` | Matching template (if any), preferences, team conventions on that artifact | Evidence, decisions |
| Decision support | `decision` | `collaboration` policy, relevant decision records, team conventions on decisions | Templates |
| Continue known work | `continuation` | The project's own prior context first, then preferences | Evidence, governance |
| Personal context needed | `personal` | `.extelligencing/profile.md`, `.extelligencing/preferences.json` | Shared, evidence |
| Team convention question | `shared` | Relevant shared documents only, with source named | Personal evidence |
| Evidence or memory change | `evidence` | `evidence` policy, `.extelligencing/evidence/proposals` | Templates |
| More onboarding | `onboarding` | `onboarding` protocol, `.extelligencing/onboarding.json` | Everything else |

## Finding something in shared context

1. Start targeted: `context route --task shared --topic "<key words of the question>"`. It returns the matching documents with the matching lines, which is often enough to answer.
2. Open only the listed documents, best first, and only if the excerpt is not enough.
3. If nothing matches, retry once with fewer or different words.
4. Only if that fails, search the shared folder directly (read-only): list matching file names first, open the best one, and do not reuse unrelated matches.

Do not begin with a recursive search over the whole shared workspace.

Preference conflicts are shown only when they affect the task (for example, drafting a team deliverable). If the user asks about conflicts, run `context route --task drafting --conflicts`.

## Rules

- One bundle at a time. If the task changes type, load only the difference.
- Keep scopes distinguishable: label every loaded fact as personal, shared or project.
- If a needed file does not exist, report it as missing. Do not fill the gap with a guess.
- Loading context never authorizes writing to it.
