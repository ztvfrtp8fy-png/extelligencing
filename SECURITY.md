# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting for this repository ("Security" tab, "Report a vulnerability"). If that is not available, open an issue asking for a private contact channel, without details.

We aim to acknowledge reports within a week. Extelligencing is a beta maintained by volunteers, so there is no guaranteed response time.

## What Extelligencing does and does not do

Extelligencing is local files plus a small Node.js helper.

- It has no backend, accounts, telemetry or network access. The helper makes no network calls.
- It never reads Git credentials and never runs Git commands against your shared workspace.
- Shared workspaces are accessed read-only through a path you provide. The helper refuses path traversal and symlinks that point outside the shared folder.
- Persistent changes to your personal files go through an approval flow.

## Limits you should know

- **The approval flow is policy, not a sandbox.** An AI runtime that can run commands can run `evidence approve --confirm`. Extelligencing instructs the assistant never to do so without your explicit approval, and the command refuses without `--confirm`. A misbehaving or prompt-injected assistant could still ignore the instructions. Keep your runtime's own permission prompts on for file writes and commands.
- **Shared text is treated as data, but a model can still be influenced by it.** `workspace check` flags instruction-like text and obvious secrets with simple patterns. It is not a complete defense against prompt injection. Only connect shared workspaces you trust.
- **Secret and personal-data scans are heuristics.** They catch common patterns and miss many others. Do not rely on them.
- **Your AI provider and Git host see what they are given.** Anything loaded into a conversation is processed by your AI provider under its terms. Your Git host controls access to your shared repository.
- **Personal files are plain text on your disk.** `.extelligencing/` is created with a local `.gitignore` that excludes everything, to reduce accidental commits. Protect your machine as you normally would.

## Supported versions

Only the latest 0.x beta receives fixes.
