# Known Limitations (0.1 beta)

- **Live verification is limited.** Generated files and the helper are tested automatically (86 tests). Kiro has been observed in a small number of live sessions on macOS; Codex and Claude Code have not been observed at all. See the [matrix](RUNTIME-MATRIX.md) and [KIRO-VALIDATION.md](KIRO-VALIDATION.md).
- **The Kiro hook is unconfirmed in real sessions.** Kiro's documentation says command hooks run in the project root, and the hook command is a relative path, so it fails (silently, from the model's point of view) if Kiro uses another directory. Stdout injection and trusted-workspace behavior also need confirmation. Fallback: `#extelligencing-onboarding`. See [KIRO-VALIDATION.md](KIRO-VALIDATION.md).
- **Approval is enforced by a flag and by policy, not by a sandbox.** See [SECURITY.md](../SECURITY.md).
- **Requires Node.js 18+** on the machine for the helper. Without it, the policies still load but the hook, routing and evidence commands do not run.
- **One workspace per install.** Extelligencing lives in the folder you install it into. There is no user-level (global) install yet. A dedicated personal workspace folder is the simplest setup; project repositories can be opened alongside it.
- **Selection is simple.** Shared documents are chosen by word match on path, title and text (all words first, then any word). No synonyms, stemming or semantic search, so a question phrased with different words than the document can miss. Capped at 5 per request, with at most two matching lines each.
- **Conflict relevance is rule-based.** Conflicts are raised unprompted only for drafting team deliverables; whether a model also mentions them elsewhere needs live observation. Detection is structured only. It compares keys in `preferences.json` and `conventions.json`. It does not find disagreements in prose.
- **Prompt-injection and secret checks are heuristics.**
- **Shared workspaces can be stale.** Extelligencing reads the local copy; it does not fetch or verify freshness.
- **No proposal flow for shared context.** Changes to team content are made by the team through its normal process.
- **Efficiency is unmeasured.** No claim is made about cost, credits, latency or quality improvements. The few per-session numbers recorded come from single runs with human approval delays.
- **Retrieval noise.** When no document contains all words of a multi-word topic, partial matches can return loosely related documents with a matching line each.
- **Model-generated extras.** Assistants sometimes list your own profile or mention a preference conflict that does not affect the question, despite the policy. The helper does not produce those.
- **Tested on macOS only.** The code is portable Node.js, but Linux and Windows are untested (the optional `trace` feature uses `ps`).
- **Not an OS sandbox.** Read-only shared access and the approval step are helper behavior and policy. See [SECURITY.md](../SECURITY.md).
- **Evidence proposals are validated mechanically** (instance counts, required fields, wording and secret checks). Judging whether instances are truly independent is left to the person.
- **English-first core text.** Assistants can converse in your language, but the policy files are English.
- **The name "Extelligencing" has not had a trademark search.** No conflicting npm package was found.
