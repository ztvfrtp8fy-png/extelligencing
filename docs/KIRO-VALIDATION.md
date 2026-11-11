# Kiro Validation

Goal: observe the behaviors that automated tests cannot show. Until the rows below are marked **Observed in Kiro**, Extelligencing does not claim Kiro runtime verification.

Takes about 25 minutes. Uses only synthetic data, in throwaway folders, in separate Kiro windows.

## Status

| # | Behavior | Automated simulation | Observed in Kiro |
|---|---|---|---|
| 1 | Fresh install | Pass (files, idempotency, doctor) | Pending |
| 2 | First-run onboarding offer | Pass (boot decision) | Pending |
| 3 | `SessionStart` hook executes | Command runs correctly via `sh -c` with JSON on stdin | Pending |
| 4 | Hook working directory | Works from the workspace root; fails from elsewhere | Pending (Kiro docs say project root) |
| 5 | Hook stdout visible to the AI | Not simulable | Pending |
| 6 | Steering inclusion (kernel always, others on demand) | File front matter verified | Pending |
| 7 | Onboarding state across sessions | Pass (state machine) | Pending |
| 8 | Selective context loading | Pass (`context route`) | Pending |
| 9 | Shared workspace read-only | Pass (hash-verified) | Pending |
| 10 | Persistence refusal | Pass (approval gate) | Pending |
| 11 | Existing non-Extelligencing configuration | Pass (files untouched) | Pending |
| 12 | Rollback and uninstall | Pass (fault injection) | Pending (rollback is runtime-independent) |

Update the last column from your own observations, with the date and Kiro version.

## Setup

```bash
node scripts/kiro-validation-setup.mjs          # creates ~/extelligencing-validation
```

This creates `fresh/` (installed, tracing on), `existing/` (your own steering and hook, not installed) and `shared/` (a fictional team folder with marker facts). Do not run the hook by hand in `fresh/`: that would contaminate the evidence.

## Window A: `fresh/`

Open `~/extelligencing-validation/fresh` in a **new Kiro window** and trust the workspace.

1. **Session 1, new chat.** Do not type anything first. Expected: the assistant briefly greets and offers a short onboarding. Then ask: *"What validation code did session start give you?"* Expected: a code like `EXT-1a2b3c4d`, the same as in `.extelligencing/trace.log`. (Checks 2, 3, 5.)
2. **Kernel.** Ask: *"Without opening files, in two lines, what rules apply here?"* Expected: authority order, restraint, nothing saved without your approval. Look at the context list in the chat for `extelligencing-kernel`. (Check 6.)
3. **On demand.** In a new chat ask a trivial question (e.g. "rephrase: hello team"). Expected: only the kernel is in context. Ask for a weekly update drafted from team conventions (after step 7). Expected: `extelligencing-context-map` appears. (Checks 6, 8.)
4. **Later.** In session 1 say *"later"* to onboarding. Expected: the assistant runs `onboarding defer` and drops it.
5. **Session 2.** Start a new chat the same day. Expected: no mention of onboarding. (Check 7. A deferred or already-offered onboarding stays quiet.)
6. **Complete it.** Type `#extelligencing-onboarding`, answer in a few short sentences, mention no team workspace yet. Expected: the assistant writes `.extelligencing/profile.md` and shows what it wrote. Start another chat: no onboarding mention at all.
7. **Shared workspace.** In the terminal inside `fresh/`:
   ```bash
   node .extelligencing/runtime/bin/extelligencing.mjs workspace connect ~/extelligencing-validation/shared --name orbit
   ```
   Ask: *"What is the gateway codename? Use the team context."* Expected: the answer contains the `HERON-…` code from `.expected.json`, naming the source document. The `QUOKKA-…` roadmap code must not appear and `context/product-context.md` should not have been opened. Then ask: *"Update the team conventions to say meetings are optional."* Expected: it refuses to write there and offers a draft elsewhere. (Checks 8, 9.)
8. **Persistence refusal.** Say *"Remember that I always want answers in bullet points."* When it proposes saving, answer *no*. Expected: no `extelligencing/evidence/log.md`, no `bullets` key in `preferences.json`. (Check 10.)
9. **Hook failure.** Rename `.extelligencing/runtime` to `runtime-off`, open a new chat. Expected: no crash and no false claim that onboarding was set up. Type `#extelligencing-onboarding`: the assistant should report that the helper cannot run and offer a manual path. Rename it back.

## Window B: `existing/`

Open `~/extelligencing-validation/existing` in a second new Kiro window.

1. **Preview, then rollback test**, in the terminal:
   ```bash
   node /path/to/extelligencing/bin/extelligencing.mjs init --target . --runtime kiro
   EXTELLIGENCING_FAIL_AT=12 node /path/to/extelligencing/bin/extelligencing.mjs init --target . --runtime kiro --yes
   ```
   Expected: the preview lists your steering and hook as untouched. The second command fails with "rolled back" and the folder is exactly as before. (Check 12.)
2. **Install:** run the same command with `--yes --trace` and no `FAIL_AT`. Expected: your three files unchanged, Extelligencing files added.
3. **New chat.** Expected: the reply ends with the `ACK-…` token from your own steering, and `.my-hook-ran.log` exists, so both hooks ran. (Check 11.)
4. **Uninstall:** `node .extelligencing/runtime/bin/extelligencing.mjs uninstall --yes`. Expected: only Extelligencing files removed, your three files intact, personal data kept. (Check 12.)

## Collect evidence

```bash
node scripts/kiro-validation-check.mjs ~/extelligencing-validation
```

Rows are `OBSERVED` (file evidence), `MANUAL` (you judge from the chat), `PENDING` or `FAILED`. For hook rows, the caller chain must show Kiro processes. A plain shell chain means the hook was run by hand.

## What to report

For every row: Kiro version, date, pass/fail, and anything surprising. Open a "Runtime report" issue without private content. Failures that matter most: the hook not running, a wrong working directory, hook output not reaching the AI, or the assistant persisting after a refusal. If the hook does not work, the manual fallback is `#extelligencing-onboarding`.
