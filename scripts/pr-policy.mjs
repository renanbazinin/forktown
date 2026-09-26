export const isHouse = (path) => /^places\/[^/]+\.json$/.test(path);
export const isMaintainer = (permission) => ['admin', 'maintain', 'write'].includes(permission);
// Pages people only read. Everything else outside a house, including agent instructions
// (CLAUDE.md, AGENTS.md, .claude/), .github/, and the security, conduct, contributing,
// license and notice files, can steer tools or people, so outside changes need review.
export const isReaderOnly = (path) =>
  /^(?:docs\/[^/]+\.md|docs\/images\/[^/]+\.(?:png|jpe?g|gif|webp)|examples\/[^/]+\.json|README\.md)$/.test(
    path,
  );
// Git tree modes for an ordinary file. Links (120000) and submodules (160000) are not files.
const FILE_MODES = ['100644', '100755'];

export async function paginate(api, path, expected) {
  const all = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await api(`${path}?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('GitHub returned an invalid list.');
    all.push(...batch);
    if (batch.length < 100 || (expected !== undefined && all.length === expected)) {
      if (expected !== undefined && all.length !== expected)
        throw new Error('GitHub returned an incomplete changed-file list. Please retry.');
      return all;
    }
  }
  throw new Error('The PR is too large to inspect completely. Split it into smaller PRs.');
}

export async function approvedByMaintainer(reviews, head, author, permissionFor) {
  const latest = new Map();
  for (const review of reviews) {
    if (review.user?.login && ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state))
      latest.set(review.user.login.toLowerCase(), review);
  }
  for (const review of latest.values()) {
    if (
      review.user.login.toLowerCase() !== author.toLowerCase() &&
      review.state === 'APPROVED' &&
      review.commit_id === head &&
      isMaintainer(await permissionFor(review.user.login))
    )
      return true;
  }
  return false;
}

// File content is untrusted data; never import, execute, or interpolate it into a shell.
export async function evaluatePolicy({
  files,
  author,
  authorPermission,
  repositoryOwner,
  approved,
  readHead,
  readBase,
  modeOf,
}) {
  const errors = [];
  const reviewReasons = [];
  const additions = files.filter(
    (f) => isHouse(f.filename) && ['added', 'renamed', 'copied'].includes(f.status),
  );
  if (additions.length > 1)
    errors.push(
      `At most one new house and neighbor per PR. Found ${additions.length}: ${additions.map((f) => JSON.stringify(f.filename)).join(', ')}. Move extra houses to separate PRs; deletions do not create extra slots.`,
    );
  for (const file of files) {
    const oldPath = file.previous_filename ?? file.filename;
    if (file.status !== 'removed') {
      // The checkout follows links, but the API reads the link's own text; only plain files
      // are what they seem.
      const mode = await modeOf(file.filename);
      if (mode === undefined)
        throw new Error(`Could not find ${JSON.stringify(file.filename)} in the PR's commit.`);
      if (file.filename.startsWith('places/') && mode !== '100644') {
        errors.push(
          `${JSON.stringify(file.filename)} must be a plain file. Links, folders and executable files can't live in places/.`,
        );
        continue;
      }
      if (!FILE_MODES.includes(mode) && !isMaintainer(authorPermission))
        reviewReasons.push(`Link or submodule: ${JSON.stringify(file.filename)}`);
    }
    if (!isHouse(file.filename) && !isHouse(oldPath)) {
      if (
        !isMaintainer(authorPermission) &&
        !(isReaderOnly(file.filename) && isReaderOnly(oldPath))
      )
        reviewReasons.push(`Shared app or automation change: ${JSON.stringify(file.filename)}`);
      continue;
    }
    if (
      !['added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unchanged'].includes(
        file.status,
      )
    )
      throw new Error('Unknown file change status; cannot safely evaluate this PR.');
    if (isHouse(file.filename) && file.status !== 'removed') {
      const house = await readHead(file);
      if (
        !house ||
        typeof house !== 'object' ||
        Array.isArray(house) ||
        typeof house.creator !== 'string' ||
        !/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(house.creator)
      ) {
        errors.push(`${JSON.stringify(file.filename)} needs a valid creator username.`);
        continue;
      }
      if (
        house.residents !== undefined ||
        (house.resident !== undefined &&
          (!house.resident || typeof house.resident !== 'object' || Array.isArray(house.resident)))
      )
        errors.push(
          `${JSON.stringify(file.filename)} must contain one resident object, never a list.`,
        );
      if (additions.includes(file) && house.creator.toLowerCase() !== author.toLowerCase())
        reviewReasons.push(
          `New house credit differs from PR author: ${JSON.stringify(file.filename)}`,
        );
      if (additions.includes(file) && house.creator.toLowerCase() === 'forktown')
        errors.push('The forktown creator is reserved for existing starter houses.');
      if (!['added', 'copied'].includes(file.status) && isHouse(oldPath)) {
        const original = await readBase(oldPath);
        const ownerMaintainsStarter =
          authorPermission === 'admin' &&
          typeof repositoryOwner === 'string' &&
          repositoryOwner.toLowerCase() === author.toLowerCase() &&
          file.status === 'modified' &&
          oldPath === file.filename &&
          original.creator?.toLowerCase() === 'forktown' &&
          house.creator.toLowerCase() === 'forktown';
        if (
          (!ownerMaintainsStarter && original.creator?.toLowerCase() !== author.toLowerCase()) ||
          house.creator.toLowerCase() !== original.creator?.toLowerCase() ||
          file.status === 'renamed'
        )
          reviewReasons.push(`Existing house ownership/rename change: ${JSON.stringify(oldPath)}`);
      }
    } else if (isHouse(oldPath)) {
      reviewReasons.push(`House deletion: ${JSON.stringify(oldPath)}`);
    }
  }
  if (reviewReasons.length && !approved)
    errors.push(
      `A different maintainer must approve this exact commit, then rerun the policy check: ${reviewReasons.join('; ')}. After approval, comment /check-contribution on the PR.`,
    );
  return { errors, reviewReasons, added: additions.length };
}

// Every path in the PR's head commit with its Git mode, from one API call. A truncated tree
// could hide a link, so it fails closed.
export async function headModes(api, root, head) {
  const tree = await api(`${root}/git/trees/${head}?recursive=1`);
  if (!Array.isArray(tree?.tree) || tree.truncated !== false)
    throw new Error('GitHub returned an incomplete file tree. Please retry.');
  return new Map(tree.tree.map((entry) => [entry.path, entry.mode]));
}

async function evaluatePullRequest({ api, root, repo, pr, modes, permissionFor }) {
  const files = await paginate(api, `${root}/pulls/${pr.number}/files`, pr.changed_files);
  if (new Set(files.map((file) => file.filename)).size !== files.length)
    throw new Error('Duplicate changed-file results; please retry.');
  const reviews = await paginate(api, `${root}/pulls/${pr.number}/reviews`);
  const decode = (blob) => {
    if (blob.encoding !== 'base64' || blob.size > 16384 || !blob.content)
      throw new Error('House JSON must be a readable file under 16 KB.');
    return JSON.parse(Buffer.from(blob.content, 'base64').toString('utf8'));
  };
  return evaluatePolicy({
    files,
    author: pr.user.login,
    authorPermission: await permissionFor(pr.user.login),
    repositoryOwner: repo.split('/')[0],
    approved: await approvedByMaintainer(reviews, pr.head.sha, pr.user.login, permissionFor),
    readHead: async (file) => {
      if (!/^[a-f0-9]{40,64}$/.test(file.sha)) throw new Error('Invalid file SHA.');
      return decode(await api(`${root}/git/blobs/${file.sha}`));
    },
    readBase: async (path) =>
      decode(
        await api(
          `${root}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${pr.base.sha}`,
        ),
      ),
    modeOf: (path) => modes.get(path),
  });
}

// The status lives on the head commit, which any number of PRs can share. Check every open PR
// into the default branch that points at this commit and pass only when all of them pass, so a
// second PR can neither borrow nor flip the first one's result. PRs into other branches are
// not merge-gated and are skipped.
export async function runContributionPolicy({ api, repo, number, sha, runUrl, log = console }) {
  const root = `/repos/${repo}`;
  const trigger = number ? await api(`${root}/pulls/${number}`) : undefined;
  if (trigger && trigger.state !== 'open') {
    log.log('PR is closed; no status changed.');
    return 'skipped';
  }
  const head = trigger ? trigger.head.sha : sha;
  if (!/^[a-f0-9]{40,64}$/.test(head ?? '')) throw new Error('Missing PR revision.');
  const status = (state, description) =>
    api(`${root}/statuses/${head}`, {
      state,
      context: 'Contribution policy',
      description,
      target_url: runUrl,
    });
  try {
    const defaultBranch = (await api(root)).default_branch;
    const numbers = new Set();
    for (const item of [
      ...(trigger ? [trigger] : []),
      ...(await paginate(api, `${root}/commits/${head}/pulls`)),
    ])
      if (
        item.state === 'open' &&
        item.head?.sha === head &&
        item.base?.repo?.full_name === repo &&
        item.base.ref === defaultBranch
      )
        numbers.add(item.number);
    if (!numbers.size) {
      log.log(`No open PR into ${defaultBranch} uses this commit; no status changed.`);
      return 'skipped';
    }
    if (numbers.size > 10)
      throw new Error('Too many open PRs share this commit. Close the duplicates and retry.');
    await status('pending', 'Checking house allowance, credit and ownership');
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
    const prs = [];
    for (const n of [...numbers].sort((a, b) => a - b)) {
      const pr = n === trigger?.number ? trigger : await api(`${root}/pulls/${n}`);
      if (pr.state === 'open' && pr.head.sha === head && pr.base.ref === defaultBranch)
        prs.push(pr);
    }
    const modes = await headModes(api, root, head);
    const results = [];
    for (const pr of prs)
      results.push({
        pr,
        ...(await evaluatePullRequest({ api, root, repo, pr, modes, permissionFor })),
      });
    for (const { pr } of results) {
      const latest = await api(`${root}/pulls/${pr.number}`);
      if (latest.head.sha !== head || latest.base.sha !== pr.base.sha || latest.state !== 'open')
        throw new Error(
          'PR changed during inspection. Run the check again for the current revision.',
        );
    }
    const errors = [];
    for (const { pr, reviewReasons, errors: found } of results) {
      const prefix = results.length > 1 ? `PR #${pr.number}: ` : '';
      for (const reason of reviewReasons) log.log(`${prefix}Review: ${reason}`);
      errors.push(...found.map((error) => prefix + error));
    }
    if (results.length > 1 && errors.length)
      errors.push(
        'Open PRs that share one commit must all pass. A maintainer can close the duplicate and rerun.',
      );
    if (!results.length) throw new Error('The PR changed before it could be checked.');
    if (errors.length) throw new Error(errors.join('\n'));
    const added = Math.max(...results.map((result) => result.added));
    await status('success', `${added} new house; credit and ownership checks passed`);
    log.log('Contribution policy passed.');
    return 'success';
  } catch (error) {
    await status('failure', 'Contribution policy needs attention; see workflow log');
    log.error(error instanceof Error ? error.message : String(error));
    return 'failure';
  }
}
