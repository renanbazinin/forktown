// The snowmen line in the Lunch Green's panel (docs/STARGAZING.md): "Snowmen on the green: 3. They
// stand until the thaw." while any stand. History, not a score: it says how many are there, and
// nothing at all before the first is finished or after the last has melted. On a build day the
// panel already holds the snowmen lunch's own card, which says they stand until the thaw, so the
// line is only the count.
import { PANEL_COPY } from '../../lib/district-copy';
import { snowmenDay } from '../../lib/events';
import { snowmenStanding } from '../../lib/outings/snowmen';
import type { GreenNoteProps } from './cards';

export default function GreenNote({ day, minutes }: GreenNoteProps) {
  const standing = snowmenStanding(day, minutes);
  if (!standing) return null;
  const line = snowmenDay(day) ? PANEL_COPY.green.count : PANEL_COPY.green.snowmen;
  return <p className="muted-copy">{line(standing)}</p>;
}
