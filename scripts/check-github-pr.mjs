import { runContributionPolicy } from './pr-policy.mjs';
import { readFileSync } from 'node:fs';

const repo = process.env.GITHUB_REPOSITORY;
const number = process.env.PR_NUMBER;
const token = process.env.GH_TOKEN;
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !token)
  throw new Error('GITHUB_REPOSITORY, PR_NUMBER and GH_TOKEN are required.');
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
let sha;
if (!number && process.env.GITHUB_EVENT_NAME === 'workflow_run') {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  sha = event.workflow_run?.head_sha;
  if (!/^[a-f0-9]{40,64}$/.test(sha ?? '')) throw new Error('Missing review revision.');
} else if (!/^[1-9]\d*$/.test(number ?? '')) throw new Error('A valid PR number is required.');
const result = await runContributionPolicy({
  api,
  repo,
  number,
  sha,
  runUrl: `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`,
});
if (result === 'failure') process.exitCode = 1;
