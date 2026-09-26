# External contributor trial

Status: done. Issue #6 closed on September 24, 2026. The repository is public.

An outside contributor, [Adi1231234](https://github.com/Adi1231234), ran the trial on Windows 11 with Node 22 from a fork of the public repository, as an experienced developer rather than a beginner. Steps 1, 2 and 4 worked: the local builder saved `places/rehovot-orchard.json`, `npm run check:pr` passed, and PR #41 (Rehovot Orchard on C6) was reviewed, merged and published. The trial also fixed a garbled plot row in CONTRIBUTING (#42) and a Windows test timeout (#43).

The outside run did not record the field-guide read-through (step 3), the two-house rejection (steps 5–6), the occupied-plot recovery (step 7) or a check of the published house (step 8). Maintainer-run branch tests in PR #10 cover steps 5–7; see [contribution verification](CONTRIBUTION_VERIFICATION.md). A run by someone new to GitHub is still welcome, and the checklist below is kept for it.

1. Fork from the tester's account, clone, create a branch, run `npm ci` and `npm run dev`.
2. Design one house using the tester's GitHub username and an empty plot, then save.
3. Open **See my saved JSON**, expand the field guide, and explain `creator`, `plot`, and `resident`. Record confusing wording.
4. Commit/push that house and open a PR. Record `check` and `Contribution policy` results.
5. Add a second house on the same branch. Confirm the allowance rejects it with helpful filenames.
6. Remove the extra house and push again. Confirm the same PR passes.
7. Temporarily choose an occupied plot. Confirm validation fails; choose an empty one and verify recovery.
8. After normal review and merge, verify the Pages house, account credit, source JSON, resident, and share link.

Record the operating system, steps, PR URLs/commits, results, confusing steps, and any fork-workflow approval needed. Remove rejected test changes before merging.
