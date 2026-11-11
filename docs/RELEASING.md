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
- [ ] Repository settings (below) are done, and private vulnerability reporting is **verified enabled**, not assumed.

## Repository settings (manual, owner)

These are GitHub settings, not code. Enable them before or right after making the repository public:

1. **Private vulnerability reporting**: Settings → Code security → Private vulnerability reporting. `SECURITY.md` and `CODE_OF_CONDUCT.md` point reporters there. Verify with `gh api repos/OWNER/REPO/private-vulnerability-reporting` returning `{"enabled":true}`.
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

# 4. Make the repository public
gh repo edit OWNER/REPO --visibility public --accept-visibility-change-consequences

# 5. Enable Discussions and private vulnerability reporting, then verify (see above)
gh repo edit OWNER/REPO --enable-discussions
gh api -X PUT repos/OWNER/REPO/private-vulnerability-reporting
gh api repos/OWNER/REPO/private-vulnerability-reporting

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
