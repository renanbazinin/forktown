import { tubeCopy } from '../lib/tube-copy';
import type { TubeStatus } from '../lib/tube-traffic';

export default function TubeInfo({
  status,
}: {
  /** The line now, from the same plans the residents follow. */
  status: TubeStatus;
}) {
  const copy = tubeCopy(status);
  return (
    <div className="venue-info">
      <span className="quiet-label">{copy.label}</span>
      {copy.blocks.map((block, index) => (
        <div className="venue-program" key={index}>
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
