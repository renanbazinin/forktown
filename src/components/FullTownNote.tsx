import { ExternalLink } from 'lucide-react';
import { EXPANDING_DOC, expandingUrl, OPEN_PLOTS_COPY } from '../lib/open-plots';

/** Said wherever a new house would start, once every house plot has one. */
export default function FullTownNote({
  id,
  repositoryUrl,
}: {
  id?: string;
  repositoryUrl: string | null;
}) {
  const url = expandingUrl(repositoryUrl);
  return (
    <p className="full-town-note" id={id}>
      {OPEN_PLOTS_COPY.full}{' '}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {OPEN_PLOTS_COPY.grow} <ExternalLink size={12} />
        </a>
      ) : (
        <>
          {OPEN_PLOTS_COPY.grow}: <code>{EXPANDING_DOC}</code>
        </>
      )}
    </p>
  );
}
