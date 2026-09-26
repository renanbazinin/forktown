# Contribution enforcement verification — September 21, 2026

Implementation: PR #9, deployed successfully to GitHub Pages. The suite passed 122 tests, nine real places validated, and type checking, production build, formatting and diff checks passed. The browser check covered the local one-house notice, JSON guide keyboard expansion, a 390px layout without horizontal overflow, draft return, and the published read-only JSON guide.

## GitHub integration (PR #10)

These were maintainer-controlled branch tests, not an external fork or beginner trial. No test houses are included in the final change.

| Revision | Scenario                                                | Observed result                                                                         |
| -------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| f39d570  | One new house with matching creator, empty A2 plot      | Policy and town checks passed; merge state CLEAN after protection enabled               |
| ac8809d  | Two new houses in separate commits                      | Policy failed listing both files; town check passed; merge state BLOCKED                |
| 8dc60fd  | One house but incorrect creator credit                  | Policy required independent maintainer approval; town check passed; merge state BLOCKED |
| d80a809  | Correct creator but occupied A1 plot                    | Policy passed; town validation rejected the conflicting plot; merge state BLOCKED       |
| 6cb4a5b  | Same PR corrected to matching creator and empty A2 plot | Policy and town checks passed again; merge state CLEAN                                  |

A commented PR review also triggered the no-permission review signal and the trusted workflow_run policy successfully. It did not grant approval. Independent approval, dismissal, and stale/self/non-maintainer approval rules are covered by automated tests; no second account was impersonated.

## Active protection

GitHub API verification confirmed main requires both `check` and `Contribution policy`, each from GitHub Actions (app 15368), with strict up-to-date checking. Pull requests are required, administrators are included, force pushes and branch deletion are disabled, and stale reviews are dismissed. General review count is zero because the trusted policy enforces review for ownership changes. No bypass or merge queue is configured.

## The outside trial

At the time of these checks the repository was private and the outside trial was still to come. The repository is public now, and issue #6 closed on September 24, 2026, after an outside contributor's fork PR (#41) was merged and published. See [External contributor trial](EXTERNAL_CONTRIBUTOR_TRIAL.md) for what it covered.
