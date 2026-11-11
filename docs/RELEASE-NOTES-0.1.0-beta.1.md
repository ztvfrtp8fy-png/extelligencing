# Extelligencing v0.1.0-beta.1

**Your intelligence, extended.** *Personal by design. Connected by choice.*

First public beta of Extelligencing, an open-source, local-first framework that gives an AI assistant the professional context it keeps losing between sessions, without a server, an account or telemetry.

## What you get

- **Personal context you own.** A short, skippable onboarding writes your roles, goals and preferences to Markdown and JSON files in your workspace.
- **Less context, loaded on demand.** A small always-on kernel, a context map, and `context route`, which finds the right shared document and returns only the matching lines.
- **Proportional help.** Direct answers for urgent work; teaching, challenge or reflection only when they help, at most one at a time.
- **Consent for memory.** Anything the assistant wants to remember goes through observe, propose, review, approve, persist. Rejecting or deferring persists nothing.
- **Optional shared workspaces.** Read a folder or Git checkout your team already uses, with sources named and conflicts with your preferences flagged when they matter. Hosting, credentials and access control stay yours.
- **Non-destructive install** with a preview, rollback on failure, uninstall, and refusal to write through symbolic links that leave the target folder.

## Integrations

| | Status |
|---|---|
| Kiro IDE | Primary. Observed in a small number of live sessions on macOS (Kiro 1.4.62). Requires a **trusted workspace** for the hook and kernel |
| Codex | Experimental, unverified in live sessions |
| Claude Code | Experimental, unverified in live sessions |
| Claude Desktop | Not supported |

## Install

Requires Node.js 18 or newer and Git.

```bash
git clone https://github.com/ztvfrtp8fy-png/extelligencing.git
cd extelligencing
node bin/extelligencing.mjs init --target ~/extelligencing-workspace --runtime kiro          # preview
node bin/extelligencing.mjs init --target ~/extelligencing-workspace --runtime kiro --yes    # apply
```

Open the folder in Kiro, **trust the workspace**, reload the window and start a new chat. Full instructions, troubleshooting and uninstall are in the README.

## What was verified

- 86 automated tests pass.
- In real Kiro sessions with synthetic data: the session-start hook ran and its output reached the model, the kernel was injected, onboarding deferral was persisted and respected, shared lookups used the router instead of recursive searches, a read-only shared workspace was not written to and edit requests were refused, a declined memory was not saved, and two personas did not open each other's files.
- Details, sample sizes and what was **not** observed: `docs/KIRO-VALIDATION.md`.

## Limitations

- This is a beta with a small, informal validation. No claim is made about productivity, token cost or credit savings.
- "Read-only" and the approval step are helper behavior plus instructions to the assistant, not an operating-system sandbox. See `SECURITY.md`.
- Assistants can still ignore policies, list more of your own context than needed, or mention conflicts that do not matter.
- Retrieval is plain word matching; partial matches can be noisy.
- Not yet observed live: installing over an existing Kiro setup, the interactive onboarding interview, agent-driven persistence of an approved entry, uninstall in Kiro, Codex, Claude Code, Linux and Windows.

## Feedback

Experience reports and runtime reports are welcome through issue templates and Discussions. Feedback is voluntary; never post company documents or personal data.
