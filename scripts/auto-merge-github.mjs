import { fileURLToPath } from 'node:url';
import { readTown, runAutoMerge } from './auto-merge.mjs';

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
const number = process.env.PR_NUMBER || undefined;
const sha = process.env.HEAD_SHA || undefined;
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !token)
  throw new Error('GITHUB_REPOSITORY and GH_TOKEN are required.');
if (number ? !/^[1-9]\d*$/.test(number) : !/^[a-f0-9]{40,64}$/.test(sha ?? ''))
  throw new Error('A valid PR_NUMBER or HEAD_SHA is required.');
const api = async (path, body, method = body ? 'POST' : 'GET') => {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    // GitHub says why it won't merge, such as a head that moved on; the status repeats it.
    const detail = (await response.json().catch(() => undefined))?.message;
    throw Object.assign(
      new Error(`GitHub API request failed (${response.status})${detail ? `: ${detail}` : ''}`),
      { status: response.status, detail },
    );
  }
  return response.status === 204 ? null : response.json();
};
const outcomes = await runAutoMerge({
  api,
  repo,
  number,
  sha,
  town: readTown(fileURLToPath(new URL('..', import.meta.url))),
  runUrl: `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`,
});
if (outcomes.some((outcome) => outcome.state === 'error')) process.exitCode = 1;
