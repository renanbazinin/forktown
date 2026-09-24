// The house lantern at DOM size: the same cap, paper and core as the one on the Fork.
export default function LanternGlyph({
  lit = false,
  scale = 2,
}: {
  lit?: boolean;
  scale?: number;
}) {
  return (
    <svg
      className={`lantern-glyph${lit ? ' is-lit' : ''}`}
      width={6 * scale}
      height={8 * scale}
      viewBox="0 0 6 8"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="0" width="4" height="1" fill="#6F5A3C" />
      <rect
        className="lantern-glyph-body"
        x="0"
        y="1"
        width="6"
        height="5"
        fill={lit ? '#FFE0A0' : '#F6E3B4'}
      />
      {lit && <rect x="2" y="2" width="2" height="2" fill="#FFF6D8" />}
      <rect x="1" y="6" width="4" height="1" fill="#6F5A3C" />
    </svg>
  );
}
