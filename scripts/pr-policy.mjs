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
