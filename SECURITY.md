# Security Policy

## Reporting a vulnerability

Please do not open a public issue with details of a security problem.

Report it privately through GitHub: open this repository's **Security** tab and choose **Report a vulnerability**. If you do not see that option, open a public issue titled "Security contact request" that contains **no technical details**, and a maintainer will arrange a private channel.

Extelligencing is a beta maintained by volunteers. We aim to acknowledge reports within a week but cannot guarantee a response time.

## What Extelligencing does and does not do

Extelligencing is plain files plus a small Node.js helper with no dependencies.

- The helper has no backend, accounts or telemetry, and imports no network modules. It makes no network calls.
- It never reads Git credentials and never runs Git commands against your shared workspace. The only subprocess it starts is `ps`, used when you turn on `trace` to record which process started the hook.
- Shared workspaces are accessed through a local path you provide. The helper only reads from them. It rejects `..` traversal, absolute paths and symbolic links that leave the shared folder, and it does not copy shared content into your personal files.
- `init` and `uninstall` refuse to write or delete through a symbolic link that resolves outside the target folder. `init` checks every path before writing anything and undoes its own changes if a step fails.
- Changes to your personal profile, preferences and evidence go through an approval step.

## Limits you should know

- **Read-only is not an operating-system sandbox.** It describes what the helper does and what the assistant is instructed to do. It does not stop another program, or an assistant that runs shell commands and ignores its instructions, from writing to the shared folder. If you need a guarantee, enforce it outside Extelligencing: file permissions, a read-only mount, or a checkout you can discard. The path checks also do not defend against a link being swapped between the check and the read.
- **The approval step is policy plus a command flag, not a permission barrier.** An assistant that can run commands can run `evidence approve --confirm`. Extelligencing instructs it never to do so without your explicit approval, and the command refuses without `--confirm`, but a misbehaving or prompt-injected assistant could still ignore the instructions. Keep your tool's own permission prompts on for file writes and commands.
- **Shared text is treated as data, but a model can still be influenced by it.** `workspace check` flags instruction-like text and obvious secrets with simple patterns. It is not a complete defense against prompt injection. Connect only shared workspaces you trust.
- **Secret and personal-data scans are heuristics.** They catch common patterns and miss many others. Do not rely on them.
- **Your AI provider and Git host see what they are given.** Anything loaded into a conversation is processed by your AI provider under its terms. Your Git host controls access to your shared repository.
- **Personal files are plain text on your disk.** `.extelligencing/` is created with its own `.gitignore` that excludes everything, to reduce accidental commits. When tracing is on, `trace.log` records local paths and process names. Protect your machine as you normally would.
- **Hooks run commands.** The Kiro adapter installs a `SessionStart` hook that runs `node .extelligencing/runtime/bin/extelligencing.mjs boot`. Kiro runs hooks only in trusted workspaces. Do not trust a workspace you did not review, and review any `.kiro/hooks` you did not write.

## Supported versions

Only the latest 0.x beta receives fixes.
