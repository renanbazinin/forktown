# External contributor trial

Status: waiting for the owner's outside tester (issue #6). The repository is private and the tester needs authorized access. Public launch remains an owner decision. Owner-created PRs and automated tests do not replace this trial.

1. Fork from the tester's account, clone, create a branch, run `npm ci` and `npm run dev`.
2. Design one house using the tester's GitHub username and an empty plot, then save.
3. Open **See my saved JSON**, expand the field guide, and explain `creator`, `plot`, and `resident`. Record confusing wording.
4. Commit/push that house and open a PR. Record `check` and `Contribution policy` results.
5. Add a second house on the same branch. Confirm the allowance rejects it with helpful filenames.
6. Remove the extra house and push again. Confirm the same PR passes.
7. Temporarily choose an occupied plot. Confirm validation fails; choose an empty one and verify recovery.
8. After normal review and merge, verify the Pages house, account credit, source JSON, resident, and share link.

Record the operating system, steps, PR URLs/commits, results, confusing steps, and any fork-workflow approval needed. Remove rejected test changes before merging. Keep #6 open until the trial actually completes.
