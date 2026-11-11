# Personal and Shared Workspaces

| Scope | Contains | Owner | Extelligencing access |
|---|---|---|---|
| Personal | Profile, preferences, approved evidence, personal decisions | The individual | Read; write only with approval |
| Shared / team | Conventions, architecture and product context, templates, shared decisions | The team or organization | **Read only** |
| Framework | This repository: core, adapters, schemas, docs | Open-source contributors | No personal or team data |

## Hosting

You choose where shared context lives: a local folder, or a checked-out repository from GitHub, GitLab, Bitbucket or a self-hosted service. Extelligencing only sees a local path. Cloning, pulling and access control are done with your normal Git tools and permissions. Extelligencing never asks for or stores credentials, and has no account, backend or telemetry.

The maintainers of Extelligencing cannot see your workspaces. Your Git host and AI provider process data under their own policies.

## Connect

```bash
node .extelligencing/runtime/bin/extelligencing.mjs workspace connect /path/to/team-repo --name team
node .extelligencing/runtime/bin/extelligencing.mjs workspace check
node .extelligencing/runtime/bin/extelligencing.mjs workspace list
node .extelligencing/runtime/bin/extelligencing.mjs workspace disconnect team   # does not touch the shared folder
```

Only the path is stored, in `.extelligencing/config.json`. Content is not copied. The shared path may not be inside `.extelligencing/` or contain it.

## Convention (all optional)

```
extelligencing-shared.json     {"name": "...", "schema": 1}
conventions.json     structured conventions comparable with preferences
conventions/*.md     team conventions
context/*.md         architecture, product, domain
templates/*.md       shared templates
decisions/*.md       shared decisions
```

`conventions.json` entries look like `{"output_language": {"value": "en", "scope": "artifact", "doc": "conventions/communication.md"}}`.

## Using it

`context route --task shared|drafting|decision [--topic WORD]` returns up to 5 matching documents, each labeled with its workspace and path, plus anything missing. The assistant names the source when it relies on one.

Selection is by folder, file name and title. There is no semantic search in 0.1.

## Conflicts

For each key that appears in both your `preferences.json` and the team's `conventions.json` with different values, `context route` reports a conflict:

| Scope | Suggested default |
|---|---|
| `interaction` (how the AI talks to you) | Your preference |
| `artifact` (how a team deliverable is produced) | Team convention |
| Scopes differ | Ask |

The conflict is always shown, and your explicit instruction wins.

## Isolation guarantees

- The helper opens shared files only for reading. Tests hash the shared folder before and after every operation.
- Relative paths only. `..` traversal, absolute paths and symlinks that leave the shared folder are refused.
- Shared text is data. Instructions inside it cannot change the kernel or grant permissions; `workspace check` warns about instruction-like text.
- Team content is not copied into personal files. Personal evidence is not written to shared locations. Exporting anything is a deliberate, separate action that does not exist in 0.1.

## Not in 0.1

Proposing changes to shared context, diffs, branches, pull requests and provider integrations. See the [roadmap](../ROADMAP.md).
