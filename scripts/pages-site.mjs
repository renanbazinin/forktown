// The address Publish town builds a repository's town for. A custom domain can name itself with
// PAGES_SITE_URL; otherwise the github.io address works, and GitHub redirects it. Undefined for
// an address that isn't https or doesn't end in /.
export function pagesSite(repository, override) {
  const [owner, name] = repository.split('/');
  const site =
    override ||
    `https://${owner.toLowerCase()}.github.io/${name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '' : `${name}/`}`;
  return /^https:\/\/[\w.-]+(?::\d+)?\/(?:[\w.~-]+\/)*$/.test(site) ? site : undefined;
}
