# Contribution policy and merge protection

Enabled on `main` on September 21, 2026. See [verified GitHub results](CONTRIBUTION_VERIFICATION.md).

The required `Contribution policy` status inspects PR files through GitHub's API. Only trusted default-branch code runs; PR code is never checked out and its dependencies are never installed. The token reads contents/PRs and writes statuses, but cannot merge or deploy. API failures and incomplete lists fail the check.

The result is a status on the PR's head commit, and more than one PR can point at the same commit. So the check evaluates every open PR into the default branch that shares the head commit, and passes only when all of them pass. A duplicate PR can't borrow another PR's pass or flip its result. A failing duplicate does hold the others back until a maintainer closes it and runs the check again. PRs into other branches aren't merge-gated, so they get no status.

- Each PR adds at most one house filename. Renames count; deletions do not offset additions. Code/docs PRs can add zero houses.
- New-house creator credit matches the PR author, ignoring case. Each house has one resident. New starter credit is prohibited.
- You can edit your own house without changing its credit. Deletion, renaming, changing another person's house, or changing credit needs a different maintainer's approval of the current commit.
- The repository owner, with current admin permission, can edit existing project starter houses credited to `forktown` without another review. This exception only covers modifications that keep the same filename and starter credit. It does not cover community houses, deletions, renames, new houses, or credit changes. Repository ownership comes from the trusted workflow context, not PR contents.
- Collaborative credit and account renames use that reviewed exception. Approval never exempts the allowance or schema validation.
- Without maintainer approval, outside contributors can change only pages people read: `README.md`, `docs/*.md`, images in `docs/images/` (PNG, JPEG, GIF or WebP) and `examples/*.json`. Everything else needs approval, because it can change validation or steer people and tools: code, tests, `.github/` (templates included), agent instructions such as `CLAUDE.md`, `AGENTS.md` and `.claude/`, and `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `THIRD_PARTY_NOTICES.md` and `LICENSE`. A rename needs approval unless both its old and new paths are reader pages. Trusted maintainers can submit normal code changes without self-review.
- Everything in `places/` must be a plain file. The policy reads each file's Git mode from the PR's head commit and rejects links, folders and executable files there: the API would read a link's own text, while the checkout follows it. Approval doesn't lift this. Links and submodules anywhere else need maintainer approval. `npm run validate` also rejects anything in `places/` that isn't a regular file.
- Approvals must match the current head and come from someone with current write/maintain/admin permission. New pushes, dismissed approvals, and later changes requests invalidate the approval.

Review events trigger a no-permission signal followed by trusted reevaluation. A maintainer can also rerun the workflow with a PR number, or anyone can comment `/check-contribution` after review. This only reruns checks; it grants no approval. A review reruns the check for every open PR that shares the reviewed commit.

Protect `main` with required checks `Contribution policy` and `check`, strict up-to-date checking, required PRs, and disabled force pushes/deletions. Set general review count to zero; the policy enforces house-specific review. Include administrators in enforcement. No routine bypass is intended.

Merge queues are not configured. Do not enable one until policy evaluates each constituent PR separately; a one-house limit on the whole group would be incorrect.

Bootstrap the policy by merging it once, then verify a successful real PR status before requiring it. A skipped workflow or missing status is not a passed check.
