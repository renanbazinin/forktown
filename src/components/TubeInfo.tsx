import { tubeCopy } from '../lib/tube-copy';
import type { TubeStatus } from '../lib/tube-traffic';

export default function TubeInfo({
  status,
  station,
}: {
  /** The line now, from the same plans the residents follow. */
  status: TubeStatus;
  /** The halt selected on the map: the panel opens with where it stands and its minutes to the
   *  halts either side. */
  station?: string | null;
}) {
  const copy = tubeCopy(status, station);
  return (
    <div className="venue-info">
      <span className="quiet-label">{copy.label}</span>
      {copy.blocks.map((block) => (
        <div className="venue-program" key={block.eyebrow}>
          <span className="eyebrow">{block.eyebrow}</span>
          <h3>{block.heading}</h3>
          <p>{block.body}</p>
          {block.note && <p className="muted-copy">{block.note}</p>}
        </div>
      ))}
      {/* The station sign is too small to read on the map, so the panel is where it is read. */}
      <figure className="home-sign">
        <figcaption className="quiet-label">{copy.sign.caption}</figcaption>
        <p className="tube-sign">{copy.sign.text}</p>
      </figure>
      <p className="muted-copy">{copy.footer}</p>
    </div>
  );
}
