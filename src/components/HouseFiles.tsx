import { useState } from 'react';
import { ArrowLeft, Copy, FolderOpen, ExternalLink } from 'lucide-react';
import { places, repositoryUrl } from '../lib/places';
import { localSaveAvailable } from '../lib/local-save';
import JsonGuide from './JsonGuide';

// Show the actual contribution files, including omitted defaults and formatting.
const sources = import.meta.glob<string>('../../places/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});
export type SavedHouseFile = { id: string; name: string; json: string };

export default function HouseFiles({
  initialId,
  saved,
  onBack,
}: {
  initialId?: string;
  saved?: SavedHouseFile;
  onBack?: () => void;
}) {
  const files = places.map((place) => ({
    id: place.id,
    name: place.name,
    json: sources[`../../places/${place.id}.json`],
  }));
  // A successful local save can arrive just before Vite discovers the new file.
  if (saved && !files.some((file) => file.id === saved.id)) files.push(saved);
  const [selectedId, setSelectedId] = useState(initialId ?? files[0]?.id);
  const [notice, setNotice] = useState('');
  const selected = files.find((file) => file.id === selectedId) ?? files[0];
  return (
    <div className="house-files">
      {onBack && (
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={14} /> Back to my house
        </button>
      )}
      <p className="modal-intro">
        Every house starts with one JSON file in <code>places/</code>. Pick a house to see how its
        name, appearance, and neighbor are described.
      </p>
      <p className="local-note">
        {localSaveAvailable
          ? 'These are the house files in the local project running on this computer. Saving here does not publish to the shared town.'
          : 'These are the house files included in this version of the town. Your new house joins them after its pull request is reviewed, merged, and published.'}
      </p>
      <div className="house-files-layout">
        <nav className="house-file-list" aria-label="House JSON files">
          <strong>
            <FolderOpen size={16} /> places/ <span>{files.length} files</span>
          </strong>
          {files.map((file) => (
            <button
              key={file.id}
              aria-pressed={selected?.id === file.id}
              onClick={() => {
                setSelectedId(file.id);
                setNotice('');
              }}
            >
              <span>{file.id}.json</span>
              <small>{file.name}</small>
            </button>
          ))}
        </nav>
        {selected && (
          <div className="code-export">
            <div className="code-heading">
              <span>places/{selected.id}.json</span>
              <span>JSON</span>
            </div>
            <pre tabIndex={0} aria-label={`Source of ${selected.id}.json`}>
              <code>{selected.json}</code>
            </pre>
            <div className="export-actions">
              <button
                className="button button-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(selected.json);
                    setNotice(
                      'File copied. Start with a new id and an empty plot when making your own.',
                    );
                  } catch {
                    setNotice('Copy is unavailable. You can select the JSON text above.');
                  }
                }}
              >
                <Copy size={14} /> Copy this file
              </button>
            </div>
            {notice && (
              <p className="form-notice" role="status">
                {notice}
              </p>
            )}
          </div>
        )}
      </div>
      <JsonGuide />
      {repositoryUrl && (
        <a
          className="text-button"
          href={`${repositoryUrl}/tree/HEAD/places`}
          target="_blank"
          rel="noreferrer"
        >
          Browse published house files on GitHub <ExternalLink size={14} />
        </a>
      )}
      {repositoryUrl && (
        <p className="house-files-note">
          The GitHub folder reflects the repository’s default branch. A local file or an unmerged
          contribution may not appear there yet.
        </p>
      )}
    </div>
  );
}
