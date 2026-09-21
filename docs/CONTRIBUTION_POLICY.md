# Contribution policy and merge protection

Enabled on `main` on September 21, 2026. See [verified GitHub results](CONTRIBUTION_VERIFICATION.md).

The required `Contribution policy` status inspects PR files through GitHub's API. Only trusted default-branch code runs; PR code is never checked out and its dependencies are never installed. The token reads contents/PRs and writes statuses, but cannot merge or deploy. Results attach to the inspected PR head. API failures and incomplete lists fail the check.

- Each PR adds at most one house filename. Renames count; deletions do not offset additions. Code/docs PRs can add zero houses.
- New-house creator credit matches the PR author, ignoring case. Each house has one resident. New starter credit is prohibited.
- You can edit your own house without changing its credit. Deletion, renaming, changing another person's house, or changing credit needs a different maintainer's approval of the current commit.
- Collaborative credit and account renames use that reviewed exception. Approval never exempts the allowance or schema validation.
- Outside app/automation changes also need maintainer approval, since they can alter validation. Trusted maintainers can submit normal code changes without self-review.
- Approvals must match the current head and come from someone with current write/maintain/admin permission. New pushes, dismissed approvals, and later changes requests invalidate the approval.

Review events trigger a no-permission signal followed by trusted reevaluation. A maintainer can also rerun the workflow with a PR number, or anyone can comment `/check-contribution` after review. This only reruns checks; it grants no approval. If review association cannot resolve a unique PR, rerun explicitly with its number.

Protect `main` with required checks `Contribution policy` and `check`, strict up-to-date checking, required PRs, and disabled force pushes/deletions. Set general review count to zero; the policy enforces house-specific review. Include administrators in enforcement. No routine bypass is intended.

Merge queues are not configured. Do not enable one until policy evaluates each constituent PR separately; a one-house limit on the whole group would be incorrect.

Bootstrap the policy by merging it once, then verify a successful real PR status before requiring it. A skipped workflow or missing status is not a passed check.
