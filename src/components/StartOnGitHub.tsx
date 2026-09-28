import { useId, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import BuildingPreview from './BuildingPreview';
import { storyPrompt } from '../lib/builder-nudges';
import {
  CREATOR_PLACEHOLDER,
  FIELD_GUIDE,
  blankHouseFileUrl,
  houseFile,
  newHouseFileUrl,
  readUsername,
  starterHouse,
  starterNames,
} from '../lib/github-new-file';
import type { Place } from '../lib/schema';

/**
 * The published town's open plot: a whole house, ready to propose on GitHub, with no install.
 * The typed username stays in the page and in the link it builds; nothing is saved anywhere.
 */
export default function StartOnGitHub({
  plot,
  places,
  repositoryUrl,
  typed,
  onTyped,
  night = false,
}: {
  plot: string;
  places: readonly Place[];
  repositoryUrl: string;
  /** What the visitor typed as their username, kept by the town while they compare plots. */
  typed: string;
  onTyped: (typed: string) => void;
  night?: boolean;
}) {
  const field = useId();
  // What happened to the last copy, and of which file: another plot's copy says nothing here.
  const [copied, setCopied] = useState<{ file: string; ok: boolean } | null>(null);
  const { username, problem } = readUsername(typed);
  const names = useMemo(() => starterNames(plot, places), [plot, places]);
  // The preview keeps its placeholder credit, so typing never redraws the house.
  const look = useMemo(() => starterHouse(plot, places, '', names), [plot, places, names]);
  const house = problem ? null : starterHouse(plot, places, username, names);
  if (!look) return null;
  const file = `${look.id}.json`;
  const copy = copied?.file === file ? copied : null;
  async function copyFile() {
    if (!house) return;
    try {
      await navigator.clipboard.writeText(houseFile(house));
      setCopied({ file, ok: true });
    } catch {
      setCopied({ file, ok: false });
    }
  }
  return (
    <div className="start-on-github">
      <div className="start-house">
        <BuildingPreview place={look} size={64} night={night} />
        <span>
          <strong>{look.name}</strong>
          <small>{look.resident.name} moves in</small>
          <code>places/{file}</code>
        </span>
      </div>
      <p className="muted-copy">
        Start your house right in your browser. GitHub opens a new file with the house filled in,
        ready for your story and your pull request.
      </p>
      <div className="start-username">
        <label htmlFor={field}>Your GitHub username</label>
        <span className="input-prefix">
          <span aria-hidden="true">@</span>
          <input
            id={field}
            value={typed}
            placeholder="your-username"
            maxLength={40}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => {
              onTyped(event.target.value);
              setCopied(null);
            }}
            aria-invalid={!!problem}
            aria-describedby={`${field}-note`}
          />
        </span>
        {problem ? (
          <span className="field-error" id={`${field}-note`}>
            {problem}
          </span>
        ) : (
          <span
            className={`start-hint ${username ? '' : 'start-hint-needed'}`}
            id={`${field}-note`}
          >
            {username ? (
              'Your house credits it. A check compares it with the account that opens the pull request.'
            ) : (
              <>
                Fill this in: until you do, the file says <code>{CREATOR_PLACEHOLDER}</code>, and
                the pull request check asks for your own username.
              </>
            )}
          </span>
        )}
      </div>
      {house ? (
        <a
          className="button button-primary full-width"
          href={newHouseFileUrl(repositoryUrl, house)}
          target="_blank"
          rel="noreferrer"
        >
          Create my house file on GitHub <ExternalLink size={15} />
        </a>
      ) : (
        <button
          className="button button-primary full-width"
          disabled
          aria-describedby={`${field}-note`}
        >
          Create my house file on GitHub <ExternalLink size={15} />
        </button>
      )}
      <ol className="start-steps">
        <li>GitHub may ask you to fork Forktown first. Accept: the fork is your own copy.</li>
        <li>
          Replace the placeholder <code>story</code> with your own, so the Lantern Fork can tell it
          as Tonight’s tale. Try answering “{storyPrompt(look.id)}” Change the name and colors too,
          if you like.{' '}
          <a href={`${repositoryUrl}/blob/HEAD/${FIELD_GUIDE}`} target="_blank" rel="noreferrer">
            What each field means <ExternalLink size={11} />
          </a>
        </li>
        <li>
          Choose <strong>Commit changes</strong>, then <strong>Propose changes</strong> and{' '}
          <strong>Create pull request</strong>. Checks run, and a first house moves in by itself
          once they pass.
        </li>
      </ol>
      <div className="start-fallback">
        <p>
          Empty file on GitHub? It can drop the text while it makes your fork. Copy the JSON, start
          a blank file named <code>{file}</code>, and paste.
        </p>
        <div>
          <button className="text-button" onClick={copyFile} disabled={!house}>
            {copy?.ok ? <Check size={14} /> : <Copy size={14} />} Copy JSON
          </button>
          <a
            className="text-button"
            href={blankHouseFileUrl(repositoryUrl)}
            target="_blank"
            rel="noreferrer"
          >
            Start a blank file <ExternalLink size={13} />
          </a>
        </div>
        <p role="status">
          {copy &&
            (copy.ok
              ? `Copied. Paste it into a new file named ${file}.`
              : 'Copy isn’t available in this browser. Select the text under See the file instead.')}
        </p>
      </div>
      <details className="start-file">
        <summary>See the file</summary>
        <pre tabIndex={0} aria-label={`The house file, ${file}`}>
          <code>{houseFile(house ?? look)}</code>
        </pre>
      </details>
    </div>
  );
}
