// The snowmen line in the Lunch Green's panel (agent E, SPEC §4.6): "Snowmen on the green: 3. They
// stay until the thaw." while any stand. History, not a score: it says how many are there, and
// nothing at all before the first is finished or after the last has melted.
import { PANEL_COPY } from '../../lib/district-copy';
import { snowmenStanding } from '../../lib/outings/snowmen';
import type { GreenNoteProps } from './cards';

export default function GreenNote({ day, minutes }: GreenNoteProps) {
  const standing = snowmenStanding(day, minutes);
  if (!standing) return null;
  return <p className="muted-copy">{PANEL_COPY.green.snowmen(standing)}</p>;
}
