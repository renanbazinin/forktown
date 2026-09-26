import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const LICENSE_FILE = /^(?:licen[cs]e|copying)(?:[.-][\w.-]*)?$/i;

/** The package folder a bundled module comes from, or undefined for the town's own code. */
function packageOf(id: string, root: string) {
  // Build helpers such as Vite's preload helper arrive as virtual modules: "\0vite/...".
  if (id.startsWith('\0')) {
    const folder = join(root, 'node_modules', id.slice(1).split('/')[0]);
    return existsSync(join(folder, 'package.json')) ? folder : undefined;
  }
  const path = id.replace(/\\/g, '/').split('?')[0];
  const at = path.lastIndexOf('/node_modules/');
  if (at < 0) return undefined;
  const parts = path.slice(at + '/node_modules/'.length).split('/');
  const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
  return `${path.slice(0, at)}/node_modules/${name}`;
}

/**
 * One text file with the license of every package whose code or files end up in the build,
 * read from the package itself. The minifier drops their license comments, and MIT, ISC and
 * BSD all ask for the notice to travel with the code.
 */
export function thirdPartyNotices(moduleIds: Iterable<string>, root = process.cwd()) {
  const folders = new Set<string>();
  for (const id of moduleIds) {
    const folder = packageOf(id, root);
    if (folder) folders.add(folder);
  }
  const packages = [...folders]
    .map((folder) => {
      const pkg = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
      const file = readdirSync(folder)
        .filter((name) => LICENSE_FILE.test(name))
        .sort(byName)[0];
      if (!file)
        throw new Error(
          `${pkg.name} has no license file to copy into the build. Add its notice by hand.`,
        );
      const text = readFileSync(join(folder, file), 'utf8').replace(/\r\n/g, '\n');
      return {
        name: pkg.name as string,
        version: pkg.version as string,
        license: String(pkg.license ?? 'see below'),
        // Vite's file goes on to list its own build tools, which never reach the bundle.
        text: text.split(/^# Licenses of bundled dependencies/m)[0].trim(),
      };
    })
    .sort((a, b) => byName(a.name, b.name) || byName(a.version, b.version));
  const text = [
    'Forktown includes code and files from these open-source packages.',
    'Each one is shown with its license, copied from the package at build time.',
    ...packages.map(
      (pkg) => `${'-'.repeat(72)}\n${pkg.name} ${pkg.version} (${pkg.license})\n\n${pkg.text}`,
    ),
  ].join('\n\n');
  return { packages, text: `${text}\n` };
}

/** Writes licenses/third-party.txt next to the font licenses in every production build. */
export function thirdPartyLicenses(): Plugin {
  let root = process.cwd();
  return {
    name: 'forktown-third-party-licenses',
    apply: 'build',
    configResolved(config) {
      root = config.root;
    },
    generateBundle(_, bundle) {
      const ids = Object.values(bundle).flatMap((item) =>
        item.type === 'chunk' ? item.moduleIds : [],
      );
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/third-party.txt',
        source: thirdPartyNotices(ids, root).text,
      });
    },
  };
}
