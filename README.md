# Extelligencing

**Your intelligence, extended.**
*Personal by design. Connected by choice.*

Extelligencing is an open-source framework for working with an AI assistant the way you actually work. It keeps the context that matters, loads only what a task needs, gives you help in proportion to the situation, and never remembers anything about you without your approval.

It is a set of plain Markdown and JSON files plus a small helper script. No account, no server, no telemetry.

> **Status: v0.1.0-beta.1.** Kiro is the primary adapter. Codex and Claude Code adapters exist but are experimental. See [what is and is not verified](docs/RUNTIME-MATRIX.md).

## What it does for you

- **Keeps your setup, not your secrets.** A short onboarding (about 5 minutes, skippable) writes your roles, goals and preferences to files you own and can edit.
- **Loads less.** A small always-on kernel, plus a context map that points the assistant to the smallest set of files a task needs.
- **Helps in proportion.** Urgent work gets a direct answer. Teaching, challenge or reflection appear only when useful, at most one at a time.
- **Asks before it remembers.** Anything the assistant wants to keep goes through observe, propose, review, approve, persist. Rejecting or deferring is normal.
- **Connected by choice.** Point Extelligencing at a folder or checked-out Git repo your team already uses. It reads it, names the source, flags conflicts with your preferences, and never writes to it.

Extelligencing does not claim measured productivity gains or credit savings. The design tries to avoid unnecessary context and repeated work; whether that helps you is something we want to learn from your feedback.

## Install (Kiro)

You need Node.js 18 or newer and Git.

```bash
git clone https://github.com/ztvfrtp8fy-png/extelligencing.git
cd extelligencing

# 1. Preview. Nothing is changed.
node bin/extelligencing.mjs init --target ~/extelligencing-workspace --runtime kiro

# 2. Apply.
node bin/extelligencing.mjs init --target ~/extelligencing-workspace --runtime kiro --yes
```

Open `~/extelligencing-workspace` in Kiro and start a new chat. A session-start hook offers the short onboarding. If it does not appear (hooks run only in trusted workspaces), type `#extelligencing-onboarding`.

Already have steering files or hooks in that folder? Extelligencing lists them, never changes them, and writes its own files beside yours. Details: [Onboarding](docs/ONBOARDING.md#existing-setups).

Check the install, or remove it:

```bash
node bin/extelligencing.mjs doctor --target ~/extelligencing-workspace
node bin/extelligencing.mjs uninstall --target ~/extelligencing-workspace --yes   # keeps your personal data
```

After install, the same command is available inside the workspace as `node .extelligencing/runtime/bin/extelligencing.mjs`. That copy is what the hook runs.

Other runtimes: `--runtime codex` (writes an `AGENTS.md` block) or `--runtime claude-code` (writes a `CLAUDE.md` block). Both are experimental.

## Try the shared workspace demo

`examples/team-workspace/` is a fictional team's conventions. Connect it read-only and see how Extelligencing uses it:

```bash
cd ~/extelligencing-workspace
node .extelligencing/runtime/bin/extelligencing.mjs workspace connect /path/to/extelligencing/examples/team-workspace --name orbit
node .extelligencing/runtime/bin/extelligencing.mjs context route --task shared --topic architecture
node .extelligencing/runtime/bin/extelligencing.mjs context route --task drafting
```

The second command lists the matching shared document with its source. The third reports any conflict between your preferences and the team's conventions. More in [docs/DEMO.md](docs/DEMO.md).

## How it is organized

| Scope | Lives in | Who controls it |
|---|---|---|
| Personal | `.extelligencing/` in your workspace | You |
| Shared / team | A folder or Git checkout you point to | Your team. Extelligencing reads only |
| Framework | This repository | Open-source contributors. No personal or team data |

Read more: [Architecture](docs/ARCHITECTURE.md), [Personal vs shared workspaces](docs/WORKSPACES.md), [Onboarding](docs/ONBOARDING.md), [Runtime matrix](docs/RUNTIME-MATRIX.md), [Kiro validation](docs/KIRO-VALIDATION.md), [Known limitations](docs/KNOWN-LIMITATIONS.md), [Roadmap](ROADMAP.md).

## Privacy

Extelligencing has no backend and sends nothing anywhere. The files stay on your machine. Your AI provider processes what you and the assistant exchange, and your Git host (if any) controls access to your shared repository, each under its own policies. See [SECURITY.md](SECURITY.md).

## Tests

```bash
npm test          # or: node --test tests/
```

Automated tests cover the helper and the generated files. They cannot show how a live AI model behaves. [Kiro validation](docs/KIRO-VALIDATION.md) lists what needs a real session and what has been observed so far.

## Contribute and give feedback

Use cases, runtime adapters, fixes and honest feedback are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Feedback is always voluntary: never post company documents or personal data.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
