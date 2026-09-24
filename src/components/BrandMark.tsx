import { MARK_COLORS, MARK_PIXELS } from '../lib/brand';

// The leaf-and-lantern fork, drawn from the same pixels as the favicon.
export default function BrandMark({
  size = 24,
  night = false,
  tile = false,
}: {
  size?: number;
  night?: boolean;
  tile?: boolean;
}) {
  const colors = MARK_COLORS[night ? 'night' : 'day'];
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {tile && <rect width="32" height="32" rx="7" fill={colors.tile} />}
      {MARK_PIXELS.map(([x, y, width, height, color], i) => (
        <rect key={i} x={x} y={y} width={width} height={height} fill={colors[color]} />
      ))}
    </svg>
  );
}

// The wordmark's full stop: a 6x8 pixel lantern sitting on the baseline.
export function LanternDot() {
  return (
    <svg
      className="brand-lantern"
      width="6"
      height="8"
      viewBox="0 0 6 8"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="0" width="4" height="1" fill="#6F5A3C" />
      <rect x="0" y="1" width="6" height="5" fill="#F2C06B" />
      <rect x="2" y="2" width="2" height="2" fill="#FFE0A0" />
      <rect x="1" y="6" width="4" height="1" fill="#6F5A3C" />
    </svg>
  );
}
