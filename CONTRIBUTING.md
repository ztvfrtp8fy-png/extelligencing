# Contributing to Extelligencing

Thanks for helping. Extelligencing stays useful by staying small, so the bar for adding things is "does this reduce the work or risk for a real professional?"

## Ground rules

- **No private data, ever.** Do not include real names, companies, customers, tickets, internal documents, transcripts or credentials in code, tests, examples, issues or PRs. Examples must be synthetic.
- **No telemetry, accounts or central services.** The framework must work with local files and standard Git only.
- **No unverified claims.** A runtime is "supported" only when the advertised behavior has been checked. Say what you tested and how.
- **Prefer the smallest change.** Strengthen an existing file before adding a new one.

## Setup

```bash
git clone https://github.com/ztvfrtp8fy-png/extelligencing.git extelligencing && cd extelligencing
npm test
npm run check:release
```

Node 18+, no dependencies to install.

## What to contribute

- **Fixes:** open an issue or a PR. Include a test when behavior changes.
- **Professional use cases:** add a synthetic persona to `examples/personas/` and, if useful, a scenario test. Show the role's real work, not a job title.
- **Runtime adapters:** see below.
- **Core policy changes** (`core/`): explain the problem you saw in real use. Core text is loaded into AI context, so every added sentence has a cost. Shorter is better.

## Writing a runtime adapter

1. Read `docs/ARCHITECTURE.md` and `lib/adapters.mjs`.
2. Generate runtime-native files from `core/`. Do not fork the policy text.
3. Be non-destructive: use the install plan (`create`, `merge-block`, `propose-alongside`). Never overwrite files you do not own.
4. Add tests for install, idempotency, uninstall and rollback.
5. Add a row to `docs/RUNTIME-MATRIX.md` that separates "verified by automated tests" from "verified in a live session".
6. Mark it experimental until someone has run `docs/RUNTIME-TEST-PROTOCOL.md` against the real runtime.

## Pull requests

- One topic per PR. Describe the problem, the change, and how you tested it.
- Run `npm test` and `npm run check:release` before opening it.
- Do not paste proprietary text from other projects. If you adapt ideas, say where they came from.

## Reporting feedback

Use GitHub Discussions for experience reports and ideas, and Issues for bugs. Use the templates. Sharing your role and runtime helps, and is optional. Never share personal or company content.

By contributing you agree your contribution is licensed under the Apache License 2.0.
