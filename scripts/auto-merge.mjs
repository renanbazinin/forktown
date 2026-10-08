import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clip, isHouse, isMaintainer, paginate, withoutBom } from './pr-policy.mjs';

// A PR whose only change is one new house, credited to its author, merges itself once every
// other check has passed, as long as no house in town credits that author yet. Anyone who already
// has a house waits for a maintainer, who can still merge by hand. Like the contribution policy,
// this reads PR contents through the API as data and never runs them. The town it compares
// against is the trusted default-branch checkout.
export const CONTEXT = 'Auto-merge';
// Checks that must be present and passed however many others there are. Branch protection
// requires both too, from GitHub Actions.
const REQUIRED_CHECK = 'check';
const REQUIRED_STATUS = 'Contribution policy';
const PASSED = ['success', 'neutral', 'skipped'];
const SHA = /^[a-f0-9]{40,64}$/;
// Marks the one comment per PR that asks its author to update the branch.
const REMINDER = '<!-- forktown-auto-merge: update branch -->';
// Marks the one comment per PR that welcomes a new neighbor once their house has merged.
const WELCOME = '<!-- forktown-auto-merge: welcome -->';

/**
 * Every creator in a checked-out town, lower-cased because GitHub usernames ignore case, with the
 * house files that credit them, and the commit they were read from. A house that can't be read
 * stops every auto-merge.
 */
export function readTown(directory) {
  const creators = new Map();
  for (const name of readdirSync(join(directory, 'places')).sort()) {
    if (!name.endsWith('.json')) continue;
    const house = JSON.parse(withoutBom(readFileSync(join(directory, 'places', name), 'utf8')));
    if (typeof house?.creator !== 'string') throw new Error(`places/${name} has no creator.`);
    const key = house.creator.toLowerCase();
    creators.set(key, [...(creators.get(key) ?? []), name]);
  }
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: directory,
    encoding: 'utf8',
  }).trim();
  if (!SHA.test(sha)) throw new Error('Could not read the town commit.');
  return { sha, creators };
}

// Every other check on a commit that hasn't passed yet, with the required ones when missing.
function unfinishedChecks(checkRuns, statuses) {
  const others = statuses.filter((status) => status.context !== CONTEXT);
  const unfinished = [
    ...checkRuns
      .filter((run) => run.status !== 'completed' || !PASSED.includes(run.conclusion))
      .map((run) => run.name),
    ...others.filter((status) => status.state !== 'success').map((status) => status.context),
  ];
  if (
    !checkRuns.some(
      (run) =>
        run.name === REQUIRED_CHECK &&
        run.app?.slug === 'github-actions' &&
        run.status === 'completed' &&
        run.conclusion === 'success',
    )
  )
    unfinished.push(REQUIRED_CHECK);
  if (!others.some((status) => status.context === REQUIRED_STATUS && status.state === 'success'))
    unfinished.push(REQUIRED_STATUS);
  return [...new Set(unfinished)];
}

// House content is untrusted data: parse it, never run it.
export function decode(blob) {
  if (blob?.encoding !== 'base64' || !(blob.size <= 16384) || !blob.content) return undefined;
  try {
    return JSON.parse(withoutBom(Buffer.from(blob.content, 'base64').toString('utf8')));
  } catch {
    return undefined;
  }
}

// A maintainer's request for changes holds the merge until they approve or dismiss it.
async function onHold(api, root, number, permissionFor) {
  const latest = new Map();
  for (const review of await paginate(api, `${root}/pulls/${number}/reviews`)) {
    if (review.user?.login && ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state))
      latest.set(review.user.login.toLowerCase(), review);
  }
  for (const review of latest.values()) {
    if (
      review.state === 'CHANGES_REQUESTED' &&
      isMaintainer(await permissionFor(review.user.login))
    )
      return true;
  }
  return false;
}

// A status notifies nobody, so the contributor also hears by name, once per PR, that the branch
// needs updating. Returns whether it commented.
async function remindToUpdate(api, root, pr, main) {
  const comments = await paginate(api, `${root}/issues/${pr.number}/comments`);
  if (comments.some((comment) => comment.user?.type === 'Bot' && comment.body?.includes(REMINDER)))
    return false;
  await api(`${root}/issues/${pr.number}/comments`, {
    body: `${REMINDER}\n@${pr.user.login}, \`${main}\` has moved on since you branched. Click **Update branch** at the bottom of this pull request, and your house moves in by itself once the checks pass.`,
  });
  return true;
}

// Welcomes a new neighbor by name, once per PR. Nobody has read the house yet, so the comment
// never quotes its name, story or sign: only the file name, which check validated as the house's
// id. The links, and the promise that it appears soon, need a town that is being published.
// Returns whether it commented.
async function welcome(api, root, { number, author, file }, site) {
  const comments = await paginate(api, `${root}/issues/${number}/comments`);
  if (comments.some((comment) => comment.user?.type === 'Bot' && comment.body?.includes(WELCOME)))
    return false;
  const id = file.slice('places/'.length, -'.json'.length);
  const visit = site
    ? `It appears in a couple of minutes, once the town is rebuilt: [visit your house](${site}#place=${encodeURIComponent(id)}). If it isn't there yet, reload the page. At nightfall its lantern lights with the others on [the Lantern Fork](${site}#venue=fork).`
    : 'At nightfall its lantern lights with the others on the Lantern Fork.';
  await api(`${root}/issues/${number}/comments`, {
    body: `${WELCOME}\n@${author}, welcome to Forktown. Your house has moved in.\n\n${visit}\n\nTo change it later, open a new pull request that edits only \`${file}\`. A maintainer reviews edits before they merge.`,
  });
  return true;
}

// What to do with one PR: leave it alone ('skipped'), give it to a maintainer ('failure'), wait
// ('pending'), or merge it. Merging is left to the caller.
async function consider({ api, root, repo, main, pr, town, permissionFor }) {
  const head = pr.head?.sha;
  if (pr.state !== 'open' || pr.base?.ref !== main || pr.base?.repo?.full_name !== repo)
    return { state: 'skipped', description: `not an open PR into ${main}` };
  if (pr.draft) return { state: 'skipped', description: 'a draft' };
  if (!SHA.test(head ?? '')) throw new Error('Missing PR revision.');
  const files =
    pr.changed_files === 1 ? await api(`${root}/pulls/${pr.number}/files?per_page=2`) : [];
  const [file] = files;
  if (files.length !== 1 || file.status !== 'added' || !isHouse(file.filename))
    return { state: 'skipped', description: 'its change is not just one new house' };
  // The strict check: the places files must not know this username yet.
  const author = pr.user.login;
  const homes = town.creators.get(author.toLowerCase());
  if (homes) {
    const more = homes.length > 1 ? ` and ${homes.length - 1} more` : '';
    return {
      state: 'failure',
      description: `Needs a maintainer: ${author} already has a house (${homes[0]}${more})`,
    };
  }
  if (!SHA.test(file.sha ?? '')) throw new Error('Invalid file SHA.');
  const house = decode(await api(`${root}/git/blobs/${file.sha}`));
  if (typeof house?.creator !== 'string' || house.creator.toLowerCase() !== author.toLowerCase())
    return {
      state: 'failure',
      description:
        'Needs a maintainer: only a house that credits the PR author merges automatically',
    };
  if (await onHold(api, root, pr.number, permissionFor))
    return { state: 'pending', description: 'On hold: a maintainer requested changes' };
  // What lands must be exactly what passed: the head contains the town compared against above,
  // and that town is still current. Branch protection's up-to-date rule backs this when merging.
  // Asked before the other checks finish, so the contributor can update the branch straight away.
  const current = (await api(`${root}/git/ref/heads/${main}`)).object?.sha;
  const compared = await api(`${root}/compare/${town.sha}...${head}?per_page=1`);
  if (current !== town.sha || compared.behind_by !== 0)
    return {
      state: 'pending',
      description: `Behind ${main}: click Update branch, and this merges automatically once the checks pass`,
      behind: true,
    };
  const runs = await api(`${root}/commits/${head}/check-runs?per_page=100`);
  const combined = await api(`${root}/commits/${head}/status?per_page=100`);
  if (
    !Array.isArray(runs?.check_runs) ||
    runs.check_runs.length !== runs.total_count ||
    !Array.isArray(combined?.statuses) ||
    combined.statuses.length !== combined.total_count
  )
    throw new Error('GitHub returned an incomplete list of checks. Please retry.');
  const unfinished = unfinishedChecks(runs.check_runs, combined.statuses);
  if (unfinished.length)
    return {
      state: 'pending',
      description: `Merges automatically once these pass: ${unfinished.join(', ')}`,
    };
  return { state: 'merge', file: file.filename };
}

/**
 * Merges the PR with this number, or each open PR whose head is this commit, when it qualifies,
 * and reports why not on an `Auto-merge` status otherwise. PRs that aren't one new house get no
 * status. Returns what happened to each PR; errors merge nothing. `site` is the address Publish
 * town puts the town at, when this repository publishes one.
 */
export async function runAutoMerge({ api, repo, number, sha, town, runUrl, site, log = console }) {
  const root = `/repos/${repo}`;
  const main = (await api(root)).default_branch;
  const numbers = number
    ? [Number(number)]
    : (await paginate(api, `${root}/pulls`))
        .filter((pr) => pr.head?.sha === sha)
        .map((pr) => pr.number);
  if (!numbers.length) log.log('No open PR has this commit as its head; nothing to merge.');
  const permissions = new Map();
  const permissionFor = async (login) => {
    const key = login.toLowerCase();
    if (!permissions.has(key)) {
      try {
        permissions.set(
          key,
          (await api(`${root}/collaborators/${encodeURIComponent(login)}/permission`)).permission,
        );
      } catch (error) {
        if (error.status !== 404) throw error;
        permissions.set(key, 'none');
      }
    }
    return permissions.get(key);
  };
  const outcomes = [];
  const merged = [];
  for (const n of numbers) {
    try {
      const pr = await api(`${root}/pulls/${n}`);
      const verdict = await consider({ api, root, repo, main, pr, town, permissionFor });
      let { state, description } = verdict;
      if (state === 'merge') {
        try {
          // Squashed, so the commit on main credits the contributor, not this workflow. Pinned to
          // the head that passed: a newer push makes GitHub refuse.
          const merge = {
            sha: pr.head.sha,
            merge_method: 'squash',
            commit_title: `${pr.title} (#${n})`,
          };
          await api(`${root}/pulls/${n}/merge`, merge, 'PUT');
          // Counted as soon as it lands, so a status that fails to post below still publishes
          // the town and welcomes the neighbor.
          merged.push({ number: n, author: pr.user.login, file: verdict.file });
          state = 'success';
          description = 'Merged automatically: a first house for a new neighbor';
        } catch (error) {
          if (![405, 409].includes(error.status)) throw error;
          const latest = await api(`${root}/pulls/${n}`);
          state = latest.merged ? 'skipped' : 'pending';
          description = latest.merged
            ? 'merged meanwhile'
            : `Merges automatically once GitHub allows it: ${error.detail ?? `HTTP ${error.status}`}`;
        }
      }
      if (state !== 'skipped')
        await api(`${root}/statuses/${pr.head.sha}`, {
          state,
          context: CONTEXT,
          description: clip(description),
          target_url: runUrl,
        });
      if (verdict.behind && (await remindToUpdate(api, root, pr, main)))
        log.log(`PR #${n}: asked @${pr.user.login} to update the branch.`);
      outcomes.push({ number: n, state, description });
      log.log(`PR #${n}: ${state === 'skipped' ? `left alone, ${description}.` : description}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcomes.push({ number: n, state: 'error', description: message });
      log.error(`PR #${n}: ${message}`);
    }
  }
  let publishing = false;
  if (merged.length) {
    // A merge by this workflow's token starts no push workflow, so publish the town directly.
    // It only needs building: check passed on the exact head merged, up to date with main.
    try {
      await api(`${root}/actions/workflows/pages.yml/dispatches`, {
        ref: main,
        inputs: { tested: 'true' },
      });
      publishing = true;
      log.log('Started Publish town for the new house.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcomes.push({ state: 'error', description: `Could not start Publish town: ${message}` });
      log.error(`Could not start Publish town: ${message}`);
    }
  }
  // Last, and only logged when it fails: a welcome never changes what happened above.
  for (const house of merged) {
    try {
      if (await welcome(api, root, house, publishing ? site : undefined))
        log.log(`PR #${house.number}: welcomed @${house.author}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`PR #${house.number}: could not post the welcome: ${message}`);
    }
  }
  return outcomes;
}
