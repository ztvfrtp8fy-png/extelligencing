# Demo (about 3 minutes, synthetic data)

Everything here uses the fictional "Orbit" team in `examples/team-workspace/` and a throwaway folder. Nothing touches a real workspace. Run it from the root of the cloned repository, in bash or zsh.

```bash
# 1. Install into a throwaway folder
REPO=$(pwd)
node bin/extelligencing.mjs init --target /tmp/extelligencing-demo --runtime kiro --yes
cd /tmp/extelligencing-demo
x() { node .extelligencing/runtime/bin/extelligencing.mjs "$@"; }

# 2. The session-start check, which is what the Kiro hook runs.
#    Onboarding has not been done, so it prints the instruction the agent receives.
x boot

# 3. Activate as a fictional squad lead who writes in Portuguese, with the sample team connected read-only
sed "s#__SHARED_PATH__#$REPO/examples/team-workspace#" "$REPO/examples/personas/squad-lead.json" > lead.json
x onboarding activate --file lead.json

# 4. Later sessions stay quiet
x boot                                      # prints nothing

# 5. The smallest sufficient context for a task
x context route --task quick                # nothing beyond the kernel
x context route --task shared --topic "notifications asynchronous"
x context route --task drafting --topic "weekly status update"
#   -> status-updates.md with its matching line, plus the output_language conflict (pt-BR vs en)
x context route --task shared --topic "architecture" --conflicts   # --conflicts lists every conflict on request

# 6. A proposal that is rejected leaves no trace
x evidence propose --json '{"kind":"hypothesis","summary":"Prefers decisions before meetings","instances":["one planning session"]}'
x evidence list                             # shows the proposal id
x evidence reject <the id printed above> --reason "not accurate"
ls .extelligencing/evidence                 # proposals only; no log.md

# 7. Clean up
x uninstall --yes --purge-data
```

What to notice:

- Step 5 returns a handful of documents, each labeled by scope and source, with only the matching lines. Topics are matched by words, so `"weekly status update"` finds the status-update convention even though no file is named that.
- The language conflict is shown while drafting a team deliverable, and a personal *interaction* preference (how the agent talks to you) would not be raised on its own.
- Nothing is written to the team folder at any point, and the rejected proposal is never persisted.
