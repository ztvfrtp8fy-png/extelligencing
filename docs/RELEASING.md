# Releasing

Maintainer guide for publishing `v0.1.0-beta.1`. **Nothing here is run automatically.** Each publication step needs the owner's explicit go-ahead.

## Distribution

Beta distribution is `git clone` of the GitHub repository. The npm package is intentionally **not** published: `package.json` has `"private": true`, which also prevents an accidental `npm publish`. `npm pack --dry-run` shows what a package would contain (45 files: `bin/`, `lib/`, `core/`, `docs/`, `examples/`, `extensions/`, `LICENSE`, `NOTICE`, `README.md`, `package.json`; no tests, scripts or local state). If npm distribution is wanted later, the smallest step is removing `"private"` and running `npm publish --tag beta` after a dry run.

## Checklist

Before publishing:

- [ ] `git status` is clean and `HEAD` is the intended commit.
- [ ] `npm test` passes.
- [ ] `node scripts/release-check.mjs --denylist <private-terms-file>` reports no findings. Keep the denylist outside the repository.
- [ ] `npm pack --dry-run` lists only intended files.
- [ ] Fresh clone: `npm test`, then `init --yes` into an empty folder, `doctor`, `uninstall --yes`.
- [ ] `LICENSE` is the unmodified Apache-2.0 text; `NOTICE` and `package.json` agree.
- [ ] README, `docs/KIRO-VALIDATION.md` and `docs/RUNTIME-MATRIX.md` match what was actually observed.
- [ ] Private vulnerability reporting is **verified enabled** right after the repository becomes public, and before the release is created (it cannot be enabled while the repository is private; see below).

## Repository settings (manual, owner)

These are GitHub settings, not code.

1. **Private vulnerability reporting**: GitHub offers it for **public** repositories only. While this repository is private, the API answers 404 to both reading and enabling it (checked 2026-11-11 with admin rights; GitHub's documentation describes the feature for owners and administrators of public repositories). So it can only be enabled **immediately after** the repository is made public: Settings → Advanced Security → Private vulnerability reporting → Enable, or the command in step 5 below. `SECURITY.md` and `CODE_OF_CONDUCT.md` point reporters to it, and tell them to open a detail-free issue asking for a private channel if the button is not shown, so the short window before it is enabled still has a working channel (Issues are enabled).
2. **Discussions**: Settings → General → Features. The issue-template chooser links to Discussions.
3. **Default branch** `main`. Optional protection (no force-push or deletion; unavailable for private repositories on the free plan).
4. **Topics and description**, optional.

## Publication sequence (requires authorization)

```bash
cd ~/dev/extelligencing

# 1. Push the branch (repository is still private)
git push origin main

# 2. Verify the pushed content from a clean clone
git clone https://github.com/OWNER/REPO.git /tmp/extelligencing-verify && (cd /tmp/extelligencing-verify && npm test && git log --format='%h %an %s')

# 3. Tag and push the tag (still private)
git tag -a v0.1.0-beta.1 -m "Extelligencing v0.1.0-beta.1"
git push origin v0.1.0-beta.1

# 4+5. Make the repository public and enable private vulnerability reporting in the same breath.
#      The release (step 6) must not be created unless this prints "PVR enabled".
R=OWNER/REPO
gh repo edit $R --visibility public --accept-visibility-change-consequences \
  && gh api -X PUT repos/$R/private-vulnerability-reporting \
  && test "$(gh api repos/$R/private-vulnerability-reporting --jq .enabled)" = true \
  && echo "PVR enabled"
# If the PUT fails, retry once after a few seconds. If it still fails, enable it in the web UI
# (Settings -> Advanced Security) and re-run the GET above before continuing.
gh repo edit $R --enable-discussions

# 6. Publish the release as a pre-release
gh release create v0.1.0-beta.1 --prerelease --verify-tag \
  --title "Extelligencing v0.1.0-beta.1" \
  --notes-file docs/RELEASE-NOTES-0.1.0-beta.1.md
```

Do not run step 4 before the checklist is complete: once public, assume anything pushed has been copied.

## If sensitive material is found

**Before the repository is public** (still private):
1. Do not make it public. Remove the material in a new commit if history does not matter, otherwise rewrite history (for example with `git filter-repo`) and force-push with the owner's authorization.
2. Delete any tag created from the bad commit: `git push --delete origin v0.1.0-beta.1`, and `git tag -d v0.1.0-beta.1`.
3. Re-run the checklist from the top.

**After the repository is public:**
1. Treat the material as exposed. If it is a credential, revoke and rotate it first.
2. Make the repository private again: `gh repo edit OWNER/REPO --visibility private --accept-visibility-change-consequences` (forks and clones already made are not affected).
3. Remove the release and tag: `gh release delete v0.1.0-beta.1 --cleanup-tag --yes`.
4. Rewrite history to remove the material, force-push, and ask GitHub Support to purge cached views and orphaned references if needed.
5. Assess who may have accessed it and notify them if personal data was involved. Then re-run the checklist and republish under a new tag.

If the package was ever published to npm: `npm deprecate extelligencing@0.1.0-beta.1 "<reason>"`, and `npm unpublish` is only possible within a short window.
