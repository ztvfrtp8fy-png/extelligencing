# Runtime Capability Matrix

Extelligencing does not assume every runtime offers the same features. "Static" means verified by automated tests of the generated files and helper. "Live" means verified in a real session with the real product, following [RUNTIME-TEST-PROTOCOL.md](RUNTIME-TEST-PROTOCOL.md).

Status of this release: **Kiro has been observed in a small number of live sessions (Kiro IDE 1.4.62, macOS). Codex and Claude Code have not been observed at all** and remain experimental. Entries marked "Not yet" are open items, not claims. [KIRO-VALIDATION.md](KIRO-VALIDATION.md) is the source of truth for Kiro, including its sample size and what was not observed. Claude Desktop is not supported.

| Capability | Kiro | Codex | Claude Code |
|---|---|---|---|
| Adapter status | Primary | Experimental | Experimental |
| Mechanism | `.kiro/steering/*.md`, `.kiro/hooks/*.json` | `AGENTS.md` block | `CLAUDE.md` block with an `@` import |
| Always-on kernel | Static: yes (steering without front matter). Live: observed (steering-inclusion event in each trusted session) | Static: yes (inline in block). Live: Not yet | Static: yes (import). Live: Not yet |
| On-demand policies | Static: `inclusion: auto` with descriptions. Live: observed, but the agent loads them itself with Kiro's `disclose_context` tool; they are not injected automatically | By instruction in the block (assistant opens files). Live: Not yet | Same as Codex. Live: Not yet |
| Manual onboarding trigger | `#extelligencing-onboarding` (steering `manual`). Live: Not yet observed | Ask "start Extelligencing onboarding". Live: Not yet | Same. Live: Not yet |
| Session-start onboarding | `SessionStart` command hook. Static: file shape valid. Live: observed (runs only in a trusted workspace; working directory is the workspace root; input arrives as JSON on stdin; stdout reached the model once) | No hook. The block asks the assistant to run `boot` once if it can run commands. Live: Not yet | Same as Codex |
| Helper script (state, routing, evidence) | Static: yes. Live: observed agents running `onboarding defer` and `context route`. Needs `node` on the PATH Kiro sees | Same | Same |
| Context routing | Via helper and `context-map` steering | Via helper and block pointers | Same |
| Non-destructive install with existing config | Static: yes (tested with existing steering, hooks). Live: Not yet observed | Static: yes (existing `AGENTS.md` preserved byte for byte on uninstall) | Static: yes (`CLAUDE.md`) |
| Uninstall and rollback | Static: yes. Live: Not yet observed | Static: yes | Static: yes |
| Custom agents | Not used in 0.1. An agent that overrides steering would need the kernel referenced explicitly | Not applicable | Not applicable |
| Fallback when a capability is missing | `#extelligencing-onboarding`; `doctor` reports a missing or invalid hook | Ask the assistant to run onboarding | Same |

## Reading the table honestly

- A generated file being correct does not prove the runtime loads and obeys it.
- Kiro hooks run in trusted workspaces only, and the legacy `.kiro.hook` format is not supported by this adapter.
- Codex and Claude Code behavior can change between versions. Treat these adapters as starting points and report what you find.

If you verify or break something, please open an issue using the "Runtime report" template.
