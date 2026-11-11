# Extelligencing

**Your intelligence, extended.**
*Personal by design. Connected by choice.*

Extelligencing is an open-source, local-first framework that gives an AI coding or work assistant the professional context it keeps losing between sessions: who you are at work, how you like to collaborate, and what your team has agreed. You keep that context in plain Markdown and JSON files that you own, the assistant loads only what a task needs, and nothing about you is remembered without your approval.

It is a set of files plus a small zero-dependency Node.js helper. There is no account, no server and no telemetry.

> **Status: v0.1.0-beta.1 (first public beta).**
> **Kiro** is the primary integration and has had limited live validation. **Codex** and **Claude Code** integrations exist but are **experimental and unverified in live sessions**. Claude Desktop is not supported. Tested on macOS only. See [what has and has not been verified](docs/KIRO-VALIDATION.md).

## The problem

AI assistants start each session knowing little about you. You re-explain your role, your preferences, your team's conventions and where the source of truth lives. Team conventions sit in documents the assistant has to be pointed to, and the more context you hand over, the more you pay for it in attention, time and possibly cost. Systems that remember for you raise the opposite worry: what was stored, and who decided?

## What Extelligencing does

- **Keeps relevant professional context you control.** A short onboarding (about 5 minutes, skippable, resumable) writes your roles, goals and preferences into files in your workspace. You can read, edit or delete them.
- **Loads only what a task needs.** A small always-on kernel, plus policies and documents loaded on demand through a context map and a router, so you coordinate less by hand and the assistant reads less.
- **Helps in proportion.** Urgent work gets a direct answer. Teaching, challenge or reflection appear only when useful, at most one at a time.
- **Asks before it remembers.** Anything the assistant wants to keep about you goes through *observe → propose → review → approve → persist*. Rejecting or deferring is a normal outcome and persists nothing.
- **Connects to team context by choice.** Point it at a folder or Git checkout your team already maintains. It reads it, names the source, and flags conflicts with your preferences when they affect your work.

The aim is an assistant that is more effective because the right context is available with less effort from you. This has been observed in small, informal sessions; it has **not** been measured.

## What it does not promise

- **No guaranteed cost savings.** It tries to avoid unnecessary context and repeated work. No comparison of tokens, credits or time has been made that supports a saving.
- **No infallible memory.** The assistant is a language model following written policies. It can ignore them, mention things it should not, or phrase things badly. The [validation notes](docs/KIRO-VALIDATION.md#3-limitations-and-minor-issues-seen) list what was seen.
- **No security sandbox.** "Read-only" for shared workspaces means the helper never writes there and the assistant is instructed not to. It is not enforced by the operating system. Likewise the approval step for saving things is a policy plus a command flag, not a permission barrier. Keep your tool's own permission prompts on. See [SECURITY.md](SECURITY.md).
- **No universal compatibility.** One integration is exercised in real sessions. Others are best-effort file generation.
- **No hosted features.** No sync, accounts, discovery or analytics.

## How it works

| Scope | Lives in | Who controls it |
|---|---|---|
| Personal | `.extelligencing/` in your workspace | You |
| Shared / team (optional) | A folder or Git checkout you point to | Your team. Extelligencing only reads it |
| Framework | This repository | Open-source contributors. No personal or team data |

Your Git host and AI provider process data under their own policies. The maintainers of this project see none of it.

**Evidence and persistence.** The assistant may notice something about how you work. It cannot save it. It can propose an entry (an observation, hypothesis, repeated pattern, preference, decision or validated learning); you review it and approve, reject or defer it. Only an approved entry is written, and thin evidence is refused (a repeated pattern needs at least three listed instances). Details: [core/evidence.md](core/evidence.md).

**Context routing.** `context route --task shared --topic "gateway codename"` finds matching shared documents by word match on path, title and text, and returns only the best matching lines, so a factual question often needs no document to be opened. Details: [docs/WORKSPACES.md](docs/WORKSPACES.md).

Read more: [Architecture](docs/ARCHITECTURE.md) · [Onboarding](docs/ONBOARDING.md) · [Runtime matrix](docs/RUNTIME-MATRIX.md) · [Known limitations](docs/KNOWN-LIMITATIONS.md) · [Roadmap](ROADMAP.md).

## Install (Kiro)

You need Node.js 18 or newer, Git and the Kiro IDE.

```bash
git clone https://github.com/ztvfrtp8fy-png/extelligencing.git
cd extelligencing

# 1. Preview. Nothing is changed.
node bin/extelligencing.mjs init --target ~/extelligencing-workspace --runtime kiro

# 2. Apply.
node bin/extelligencing.mjs init --target ~/extelligencing-workspace --runtime kiro --yes
```

Then:

1. Open `~/extelligencing-workspace` in Kiro.
2. **Trust the workspace.** This is required. In an untrusted workspace Kiro registers the hook but does not run it, and does not inject the kernel, so the assistant behaves as if Extelligencing were not installed (Command Palette → `Workspaces: Manage Workspace Trust`, then `Developer: Reload Window`).
3. Start a **new chat** and send your first message. On a fresh install, the assistant offers the short onboarding; say *later* or *no* and it stops asking.

If the offer does not appear, type `#extelligencing-onboarding`.

Check the install:

```bash
node bin/extelligencing.mjs doctor --target ~/extelligencing-workspace
```

`doctor` verifies the files and the hook definition. It cannot see whether Kiro trusts the workspace or actually ran the hook.

### Installing into an existing project

`init` is non-destructive: it lists your existing steering files and hooks, never changes them, never overwrites a file it does not own (it writes `<name>.extelligencing-new` beside it instead), and refuses to write through symbolic links that leave the target folder. `AGENTS.md` and `CLAUDE.md` get a delimited block appended.

A dedicated personal workspace is the simplest setup. If you install into a project repository shared with others, remember that `.extelligencing/` (git-ignored by its own `.gitignore`) holds the helper the hook calls, so the committed `.kiro/` files would point to something your teammates do not have. Keep the `.kiro/` additions out of version control (for example in `.git/info/exclude`).

### Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| No onboarding offer, assistant ignores Extelligencing | Workspace not trusted, or the window was not reloaded. Trust it, reload the window, start a new chat. Kiro's log shows `hooks.v2.executionDisabledUntrustedWorkspace` in this case |
| Offer never appears but the workspace is trusted | The hook runs `node` from the PATH Kiro sees. If Kiro cannot find `node`, the hook fails silently (not observed in testing, but possible). Use `#extelligencing-onboarding` |
| `doctor` reports a missing or modified file | Re-run `init --yes`; modified files are kept and the new version is written beside them |
| Assistant did not follow a policy | Language models are not deterministic. Report it with the [feedback template](.github/ISSUE_TEMPLATE/feedback.yml) |

### Uninstall

```bash
node bin/extelligencing.mjs uninstall --target ~/extelligencing-workspace --yes               # keeps your personal data
node bin/extelligencing.mjs uninstall --target ~/extelligencing-workspace --yes --purge-data  # also removes .extelligencing/
```

Only files that still match what was installed are removed. Files you edited are kept and reported.

## Shared workspaces (optional, read-only)

`examples/team-workspace/` is a fictional team. Connect it and try it from your workspace:

```bash
cd ~/extelligencing-workspace
node .extelligencing/runtime/bin/extelligencing.mjs workspace connect /path/to/extelligencing/examples/team-workspace --name orbit
node .extelligencing/runtime/bin/extelligencing.mjs context route --task shared --topic "architecture"
node .extelligencing/runtime/bin/extelligencing.mjs context route --task drafting
```

The helper stores only the path, refuses `..` traversal and symbolic links that leave the shared folder, and never writes there. The Git host, authentication and access control stay entirely yours. More in [docs/DEMO.md](docs/DEMO.md).

## Supported platforms

| Platform | Status |
|---|---|
| **Kiro IDE** | Primary. Hook, kernel injection, targeted retrieval, read-only shared workspace and refusal flow observed in a small number of live sessions on macOS. Several paths are not yet observed. See [KIRO-VALIDATION.md](docs/KIRO-VALIDATION.md) |
| **Codex** (`AGENTS.md`) | Experimental. Files are generated and tested statically. Not verified in a live session |
| **Claude Code** (`CLAUDE.md`) | Experimental. Files are generated and tested statically. Not verified in a live session |
| Claude Desktop, other assistants | Not supported |

## Tests

```bash
npm test
```

86 automated tests cover the helper and the generated files. They do not show how a live model behaves; that is what the [Kiro validation](docs/KIRO-VALIDATION.md) records, with its limits.

## Contribute and give feedback

Use cases, runtime adapters, fixes and honest feedback are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Feedback is always voluntary: never post company documents or personal data.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
