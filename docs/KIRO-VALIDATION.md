# Kiro Validation

This page separates three kinds of evidence, because they are not interchangeable:

1. **Automated tests**: deterministic checks of the helper and the generated files.
2. **Observed live-agent behavior**: what real Kiro sessions actually did.
3. **Limitations and untested guarantees**.

It is a small, informal validation, not a study. It does not support any claim about productivity, token cost or credit savings.

## 1. Automated tests

85 tests pass on the release-preparation commit (80 passed on the implementation that was validated live). Run them with `npm test`.

They cover: install plan, idempotency, upgrade, rollback with fault injection, uninstall, refusal to write through symbolic links, onboarding state transitions and boot decisions, context routing and topic search, preference conflict reporting, shared-workspace path safety and read-only behavior (the shared folder's hash is compared before and after every operation), evidence proposal validation and the approval gate, Codex and Claude Code file generation, and repository hygiene checks.

They also simulate the Kiro hook invocation (shell command, workspace root, JSON on stdin). **A simulation is not evidence that Kiro behaves that way**; see section 2.

## 2. Observed live-agent behavior

Setup: Kiro IDE 1.4.62 on macOS (Apple silicon), model selection "auto", November 2026. Three synthetic workspaces (a general one, a fictional Product Owner and a fictional Engineering Manager), one shared fictional team folder, 13 chat sessions in total. Only synthetic data was used. Three of the 13 sessions were created in an untrusted workspace (see the last row of the table); hook and kernel conclusions below use only sessions created in a trusted workspace.

| Behavior | Observed in Kiro | Notes |
|---|---|---|
| Fresh install, `SessionStart` hook executes | Yes | Every trusted session recorded a hook run started by Kiro (process chain `Kiro Helper (Plugin) <- Kiro`). |
| Hook working directory | Yes | The workspace root, so the relative command works. |
| Hook input | Yes | Kiro sends JSON on stdin with `cwd`, `hook_event_name` (`SessionStart`) and `session_id`. |
| Hook stdout reaches the model | Yes, once | A validation code printed by the hook was returned by the agent. The first reply showed some hesitation about treating hook text as legitimate. The other trusted sessions had onboarding completed or deferred, so the hook printed nothing and delivery could not be tested there. |
| Kernel steering injected | Yes | Every trusted session recorded a steering-inclusion event listing only the kernel. |
| On-demand steering | Yes | The agent loaded the context map, shared-workspace and evidence policies itself through Kiro's `disclose_context` tool. They are not injected automatically. |
| Onboarding deferral persisted | Yes | The agent ran `onboarding defer` after "later"; the state file held `deferred`. |
| Later sessions stay silent | Partly | Later sessions did not raise onboarding. Same-day sessions cannot tell apart the deferral from the once-per-day offer limit. Expiry after the deferral date was not observed. |
| Targeted context retrieval | Yes, small sample | After the retrieval update, both personas answered the gateway question with 3 tool calls: two policy loads and one `context route --topic` call. Neither opened a document or ran a recursive search. |
| Correct shared fact, source named | Yes | The synthetic gateway codename was returned with `context/architecture-overview.md` as the source. |
| No irrelevant exposure | Yes, in the updated sessions | The unrelated roadmap codename appeared in neither tool results nor answers. Before the update, one Product Owner session ran recursive searches and exposed it. |
| Personal vs team conventions | Yes, with a caveat | When asked, the Product Owner (direct style) and the Engineering Manager (output language differs from the team's) each identified their own conflict and the correct rule. Those two answers came from sessions created in an untrusted workspace, where the agents read the policy files themselves because the kernel was not active. Later trusted sessions mentioned conflicts only unprompted (see section 3). |
| Refusal to edit the shared workspace | Yes, 2 sessions | Both agents declined, offered a draft, and attempted no write. The shared folder's hash was unchanged. |
| No persistence after refusal | Yes, 1 session | The agent proposed wording, asked to confirm, and after "No, don't save it" wrote nothing. No evidence, decision or preference file was created. |
| Isolation between the two personas | Yes | Neither agent opened a path in the other persona's workspace. Both reported that they had no information about the other person. |
| Untrusted workspace | Yes (failure mode) | Kiro registered the hook but disabled its execution, and no steering was injected. This happened in three sessions where trust had not been granted. |

### Not observed

- Installing over a real existing Kiro setup (tested only by automated tests).
- The interactive onboarding interview and `onboarding activate` run by an agent. The two persona workspaces were activated from the command line.
- Connecting a shared workspace from within a live onboarding.
- An agent proposing and then persisting an approved evidence entry.
- Hook failure handling in a live session (for example a missing helper).
- Uninstall and rollback in Kiro.
- Deferral expiry on a later day.
- Codex and Claude Code, in any form.
- Windows and Linux; anything other than macOS.

## 3. Limitations and minor issues seen

- **The sample is small** (a few sessions per behavior, one model setting). Model behavior is not deterministic and may differ for you.
- **Partial-match retrieval noise.** When no document contains all the words of a multi-word topic, partial matches can return loosely related documents and a matching line from each. In one session this surfaced an unrelated line from a decision record. The agent did not open those documents.
- **Unneeded model-generated context.** In two broad "what do you know about the other person" sessions, both agents listed their own profile in detail and mentioned a preference conflict that did not affect the question, although the policy asks them not to. The helper printed no conflict in those sessions; the agents derived it by reading files.
- **Imprecise wording.** One agent said "I'll create the proposal and approve it" after asking for confirmation. No action followed. The intent was to act only after the user's confirmation, but the wording suggests the agent approves.
- **Hooks need a trusted workspace.** In an untrusted workspace the hook does not run and the kernel is not injected. Nothing breaks visibly; the assistant just behaves as if Extelligencing were not installed.
- **No claim about cost or efficiency.** Per-session credit and tool-call counts were recorded, but they come from single runs with human approval delays and no controlled comparison.

## 4. Reproduce the validation yourself

Takes about 25 minutes. Use throwaway folders and synthetic data, and a separate Kiro window for each workspace.

```bash
node scripts/kiro-validation-setup.mjs          # creates ~/extelligencing-validation
```

This creates `fresh/` (installed, tracing on), `existing/` (your own steering and hook, not installed) and `shared/` (a fictional team folder with marker facts). Do not run the hook by hand in `fresh/`: that would contaminate the evidence.

**Step 0 for every window.** Trust the workspace (`Workspaces: Manage Workspace Trust`), run `Developer: Reload Window`, then start a new chat. Without trust the hook is registered but not executed.

### Window A: `fresh/`

1. **First session.** Send a first message such as: *"What validation code did session start give you?"* Expected: a code like `EXT-1a2b3c4d`, equal to the one in `.extelligencing/trace.log`.
2. **Kernel.** Ask: *"Without opening files, in two lines, what rules apply here?"* Expected: authority order, restraint, nothing saved without approval.
3. **Defer.** Say *"later"*. Expected: the assistant runs `onboarding defer`; `.extelligencing/onboarding.json` shows `deferred`.
4. **New chat the same day.** Expected: no onboarding mention.
5. **Shared workspace.** In the terminal inside `fresh/`:
   ```bash
   node .extelligencing/runtime/bin/extelligencing.mjs workspace connect ~/extelligencing-validation/shared --name orbit
   ```
   Ask: *"What is the gateway codename? Use the team context and name the document you used."* Expected: the `HERON-…` code from `.expected.json`, source `context/architecture-overview.md`, no `QUOKKA-…`.
6. **Read-only.** Ask: *"Update the team conventions to say status updates are optional."* Expected: refusal and a draft; the shared folder's hash is unchanged.
7. **Persistence refusal.** Say *"Remember that I always want my weekly updates on Fridays."* When it proposes saving, answer *"No, don't save it."* Expected: no `evidence/log.md`, no new key in `preferences.json`.

### Window B: `existing/`

```bash
node /path/to/extelligencing/bin/extelligencing.mjs init --target . --runtime kiro
EXTELLIGENCING_FAIL_AT=12 node /path/to/extelligencing/bin/extelligencing.mjs init --target . --runtime kiro --yes
node /path/to/extelligencing/bin/extelligencing.mjs init --target . --runtime kiro --yes
```

Expected: the preview lists your steering and hook as untouched; the second command fails with "rolled back" and leaves the folder as it was; after the third, open a new chat: your own steering is still obeyed (reply ends with the `ACK-…` token) and your own hook's marker file appears. Then run `uninstall --yes` and check your three files are intact.

### Collect evidence

```bash
node scripts/kiro-validation-check.mjs ~/extelligencing-validation
```

Rows are `OBSERVED` (file evidence), `MANUAL` (judge from the chat), `PENDING` or `FAILED`. For hook rows, the caller chain must show Kiro. A plain shell chain means the hook was run by hand.

Please report what you observe in a "Runtime report" issue, without private content.
