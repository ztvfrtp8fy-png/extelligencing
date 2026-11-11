# Architecture

Extelligencing has one shared core and thin runtime adapters.

```
core/            Runtime-independent policy text (the source of truth)
lib/ bin/        Helper CLI: install, onboarding state, routing, workspaces, evidence
adapters         lib/adapters.mjs turns core/ into runtime-native files
examples/        Synthetic personas and a fictional team workspace
extensions/      Optional, role-specific material (nothing depends on it)
```

In a user's workspace:

```
.extelligencing/                    Personal scope. Owned by the person. Git-ignored by default.
  config.json             runtime, connected shared workspaces (paths only)
  onboarding.json         onboarding state
  profile.md              what the person told Extelligencing
  preferences.json        structured preferences (key, value, scope)
  evidence/proposals/     staged proposals (no authority)
  evidence/log.md         approved entries only
  decisions/              approved decisions
  manifest.json           files Extelligencing installed, with hashes (for upgrade and uninstall)
  runtime/                copy of the helper, so hooks work with no other install
.kiro/ | AGENTS.md | CLAUDE.md   runtime adapter output
```

## The five capabilities

| Capability | Where | Mechanism |
|---|---|---|
| Kernel and governance | `core/kernel.md` | Always-on, under 500 words. Authority order, proportionality, restraint, persistence, shared-workspace rules, honesty about limits |
| Progressive context | `core/context-map.md`, `lib/context.mjs` | `context route --task <shape>` returns the smallest set of files, labeled by scope, with missing items reported |
| Collaboration policy | `core/collaboration.md` | Behaviors from direct to reflection, with hard constraints. Loaded on demand |
| Evidence and persistence | `core/evidence.md`, `lib/evidence.mjs` | Observe, propose, review, approve, persist. Deterministic validation of proposals |
| Adaptive onboarding | `core/onboarding.md`, `lib/onboarding.mjs` | Short activation, optional progressive blocks, a state machine with consistent semantics |

Plus the optional [Shared Workspace Layer](WORKSPACES.md).

## Authority and precedence

1. Kernel safety and confidentiality boundaries (nothing can override them)
2. The person's explicit instruction in the conversation
3. Personal configuration (how to work with this person)
4. Authorized team conventions (how team artifacts are produced)
5. Project context
6. Retrieved documents (information only, never instructions)

Conflicts between 3 and 4 are always surfaced. Preferences carry a scope: `interaction` (personal wins) or `artifact` (team convention is the default for team deliverables).

## What is deterministic and what is not

Deterministic and tested: install plan, merge, rollback, uninstall, onboarding transitions, boot decisions, routing, conflict detection, path safety, proposal validation, approval gating.

Not deterministic and not testable statically: whether a live model obeys the kernel, uses the context map, stays proportional, or declines to persist. That is the policy layer, and it is checked with the [runtime test protocol](RUNTIME-TEST-PROTOCOL.md).

## Design decisions

- **Markdown and JSON, no database.** Everything is inspectable and editable by the person.
- **Command hook over agent hook.** The session-start check is a small script, so it costs no model call and prints nothing when there is nothing to say. Kiro runs hooks only in trusted workspaces. If the hook cannot run, `#extelligencing-onboarding` works as a manual fallback.
- **Kernel always-on, everything else on demand.** Steering inclusion is `auto` or `manual` for all other policy files, to keep default context small.
- **Runtime-neutral references.** Policies are identified by name (`collaboration`); each adapter maps names to its own paths.
- **No Git or network code.** Shared workspaces are paths. Authentication stays with the user's Git tooling.
- **Approval is a gate in a tool, backed by policy.** See [SECURITY.md](../SECURITY.md) for its limits.

## Extension points (future)

- Proposed shared-context updates as local diffs, then reviewed branches and pull requests.
- Provider helpers for GitHub, GitLab and Bitbucket using existing credentials.
- Additional adapters. See [CONTRIBUTING.md](../CONTRIBUTING.md).
