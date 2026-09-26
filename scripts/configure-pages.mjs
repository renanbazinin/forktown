import { appendFileSync } from 'node:fs';

const repository = process.env.GITHUB_REPOSITORY;
if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
  throw new Error('Run this script inside GitHub Actions with a valid GITHUB_REPOSITORY.');
}
const [owner, name] = repository.split('/');
const base =
  process.env.PAGES_BASE_PATH ||
  (name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '/' : `/${name}/`);
if (!/^\/(?:[\w.-]+\/)*$/.test(base)) {
  throw new Error('PAGES_BASE_PATH must be / or a path such as /forktown/.');
}
// Link previews need the site's full address. A custom domain can name itself with
// PAGES_SITE_URL; otherwise the github.io address works, and GitHub redirects it.
const site =
  process.env.PAGES_SITE_URL ||
  `https://${owner.toLowerCase()}.github.io/${name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '' : `${name}/`}`;
if (!/^https:\/\/[\w.-]+(?::\d+)?\/(?:[\w.~-]+\/)*$/.test(site)) {
  throw new Error(
    'PAGES_SITE_URL must be an https address ending in /, such as https://town.example/.',
  );
}
if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is not available.');
appendFileSync(
  process.env.GITHUB_ENV,
  `VITE_BASE_PATH=${base}\nVITE_GITHUB_REPOSITORY=${repository}\nVITE_SITE_URL=${site}\n`,
);
console.log(`Building ${repository} at ${base} for ${site}`);
