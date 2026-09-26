import { evaluatePolicy, paginate, approvedByMaintainer, headModes } from './pr-policy.mjs';
import { readFileSync } from 'node:fs';

const repo = process.env.GITHUB_REPOSITORY;
let number = process.env.PR_NUMBER;
const token = process.env.GH_TOKEN;
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !token)
  throw new Error('GITHUB_REPOSITORY, PR_NUMBER and GH_TOKEN are required.');
const root = `/repos/${repo}`;
const api = async (path, body) => {
  const response = await fetch(`https://api.github.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw Object.assign(
      new Error(`GitHub API request failed (${response.status}). No allowance granted.`),
      { status: response.status },
    );
  return response.json();
};
if (!number && process.env.GITHUB_EVENT_NAME === 'workflow_run') {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const sha = event.workflow_run?.head_sha;
  if (!/^[a-f0-9]{40,64}$/.test(sha ?? '')) throw new Error('Missing review revision.');
  const associated = await paginate(api, `${root}/commits/${sha}/pulls`);
  const candidates = associated.filter(
    (item) => item.state === 'open' && item.base.repo.full_name === repo,
  );
  if (candidates.length !== 1)
    throw new Error(
      'Could not resolve a unique open PR for the review. Rerun the policy with its PR number.',
    );
  number = String(candidates[0].number);
}
if (!/^[1-9]\d*$/.test(number ?? '')) throw new Error('A valid PR number is required.');
const pr = await api(`${root}/pulls/${number}`);
if (pr.state !== 'open') {
  console.log('PR is closed; no status changed.');
  process.exit(0);
}
const head = pr.head.sha;
const base = pr.base.sha;
const status = (state, description) =>
  api(`${root}/statuses/${head}`, {
    state,
    context: 'Contribution policy',
    description,
    target_url: `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  });
await status('pending', 'Checking house allowance, credit and ownership');
try {
  const files = await paginate(api, `${root}/pulls/${number}/files`, pr.changed_files);
  if (new Set(files.map((file) => file.filename)).size !== files.length)
    throw new Error('Duplicate changed-file results; please retry.');
  const permissionFor = async (login) => {
    try {
      return (await api(`${root}/collaborators/${encodeURIComponent(login)}/permission`))
        .permission;
    } catch (error) {
      if (error.status === 404) return 'none';
      throw error;
    }
  };
  const reviews = await paginate(api, `${root}/pulls/${number}/reviews`);
  const approved = await approvedByMaintainer(reviews, head, pr.user.login, permissionFor);
  const decode = (blob) => {
    if (blob.encoding !== 'base64' || blob.size > 16384 || !blob.content)
      throw new Error('House JSON must be a readable file under 16 KB.');
    return JSON.parse(Buffer.from(blob.content, 'base64').toString('utf8'));
  };
  const modes = await headModes(api, root, head);
  const result = await evaluatePolicy({
    files,
    author: pr.user.login,
    authorPermission: await permissionFor(pr.user.login),
    repositoryOwner: repo.split('/')[0],
    approved,
    readHead: async (file) => {
      if (!/^[a-f0-9]{40,64}$/.test(file.sha)) throw new Error('Invalid file SHA.');
      return decode(await api(`${root}/git/blobs/${file.sha}`));
    },
    readBase: async (path) =>
      decode(
        await api(
          `${root}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${base}`,
        ),
      ),
    modeOf: (path) => modes.get(path),
  });
  const latest = await api(`${root}/pulls/${number}`);
  if (latest.head.sha !== head || latest.base.sha !== base || latest.state !== 'open')
    throw new Error('PR changed during inspection. Run the check again for the current revision.');
  for (const reason of result.reviewReasons) console.log(`Review: ${reason}`);
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  await status('success', `${result.added} new house; credit and ownership checks passed`);
  console.log('Contribution policy passed.');
} catch (error) {
  await status('failure', 'Contribution policy needs attention; see workflow log');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
