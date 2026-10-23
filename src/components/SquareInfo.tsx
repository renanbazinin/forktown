import { squareCopy } from '../lib/square-copy';

export default function SquareInfo({
  dancers,
}: {
  /** The names of the neighbors dancing on the square right now. */
  dancers: readonly string[];
}) {
  const copy = squareCopy(dancers);
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
      <p className="muted-copy">{copy.footer}</p>
    </div>
  );
}
