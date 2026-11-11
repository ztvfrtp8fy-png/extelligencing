# Demo (about 3 minutes, synthetic data)

Everything here uses the fictional "Orbit" team in `examples/team-workspace/`.

```bash
# 1. Install into a throwaway folder
node bin/extelligencing.mjs init --target /tmp/extelligencing-demo --runtime kiro --yes
cd /tmp/extelligencing-demo

# 2. First session-start check (this is what the hook runs)
node .extelligencing/runtime/bin/extelligencing.mjs boot

# 3. Activation as a squad lead who writes in Portuguese, with the team workspace attached
sed "s#__SHARED_PATH__#$OLDPWD/examples/team-workspace#" "$OLDPWD/examples/personas/squad-lead.json" > /tmp/lead.json
node .extelligencing/runtime/bin/extelligencing.mjs onboarding activate --file /tmp/lead.json

# 4. Later sessions stay quiet
node .extelligencing/runtime/bin/extelligencing.mjs boot       # prints nothing

# 5. Smallest sufficient context for a task
node .extelligencing/runtime/bin/extelligencing.mjs context route --task quick
node .extelligencing/runtime/bin/extelligencing.mjs context route --task shared --topic architecture
node .extelligencing/runtime/bin/extelligencing.mjs context route --task drafting
#   -> shows the preference/convention conflict on output_language (pt-BR vs en)

# 6. A proposal that is rejected leaves no trace
node .extelligencing/runtime/bin/extelligencing.mjs evidence propose --json '{"kind":"hypothesis","summary":"Prefers decisions before meetings","instances":["one planning session"]}'
node .extelligencing/runtime/bin/extelligencing.mjs evidence reject ev-$(date +%Y%m%d)-001 --reason "not accurate"
ls .extelligencing/evidence      # proposals only; no log.md

# 7. Clean up
node .extelligencing/runtime/bin/extelligencing.mjs uninstall --yes --purge-data
```

What to notice: step 5 lists a handful of files, each labeled by scope and source; the conflict is reported rather than silently resolved; nothing is written to the team folder at any point.
