import { millpondCopy } from '../lib/millpond-copy';

export default function MillpondInfo({
  minutes,
  day,
  skaters,
}: {
  minutes: number;
  day: number;
  /** The names of the neighbours on the ice right now. */
  skaters: readonly string[];
}) {
  const copy = millpondCopy(minutes, day, skaters);
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
      <p className="muted-copy">{copy.footer}</p>
    </div>
  );
}
