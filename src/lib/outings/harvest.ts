// Harvest Fair and Long Table guests (docs/HARVEST_FAIR.md): the fair takes `sip` (cider), `chat`
// and `sit` on the straw seat at their spot; the table takes `sit`, `sip` and `chat`. Existing
// poses only.
// Import rule: value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
//
// attendingPose returns these as they are (no hold, no beat, no settle), so every pose here is
// held a minute at least, and the fair, which is not a seated outing, crouches on its own way
// down to the straw seat and back up.
import { OUTING_TIMES } from '../district-calendar.ts';
import type { EventPose } from '../events.ts';
import type { OutingPose } from '../outings.ts';
import { hash } from '../world.ts';

/** Minutes held at least by any pose: none flashes up. */
export const HARVEST_HOLD = 1;
/** Minutes halfway down on the way to the straw seat, and again on the way up (the planner's own). */
export const STRAW_SETTLE = 0.4;
/** Minutes a fair guest stands on arriving, and before leaving, at the least. */
export const FAIR_CALM = 1.5;

/** What a guest does sat down: settling in, a cup of cider, a word with the neighbour. */
const SEATED: readonly EventPose[] = ['sit', 'sip', 'chat', 'sip', 'chat', 'sit'];

/** The minute the fair closes: every guest is on their feet by then, and the seats can go. */
export const FAIR_CLOSES = OUTING_TIMES['harvest-fair'].end;

type Spell = readonly [from: number, to: number];
const spellCache = new Map<string, readonly Spell[]>();
/**
 * One guest's seated spells at the fair, minutes after their arrival: [down, up) pairs. They
 * stand a while on arriving, sit for 9 to 20 minutes, stand for 2 to 6 to stretch their legs,
 * and so on; the last spell ends early enough to stand for their last minutes, and is over by
 * `closes` (minutes after arrival), when the fair shuts and the straw seats are gathered up.
 */
export function fairSpells(id: string, stay: number, closes = stay): readonly Spell[] {
  const key = `${id}:${stay}:${closes}`;
  const known = spellCache.get(key);
  if (known) return known;
  const spells: Spell[] = [];
  const last = Math.min(stay - FAIR_CALM, closes);
  let from = FAIR_CALM + (hash(`fair-arrive:${id}`) % 4);
  for (let k = 0; from < last; k++) {
    const to = Math.min(last, from + 9 + (hash(`fair-sit:${id}:${k}`) % 12));
    // A spell too short to sit a minute between crouches is never begun.
    if (to - from < 2 * STRAW_SETTLE + HARVEST_HOLD) break;
    spells.push([from, to]);
    from = to + 2 + (hash(`fair-stand:${id}:${k}`) % 5);
  }
  if (spellCache.size > 512) spellCache.clear();
  spellCache.set(key, spells);
  return spells;
}

/**
 * The pose of minute `t` of a sitting [from, to) held in beats of `beat` minutes: the first beat
 * is a plain sit, and the last takes what is left over, so none is shorter than a beat.
 */
function seatedBeat(id: string, t: number, from: number, to: number, beat: number): EventPose {
  const beats = Math.floor((to - from) / beat);
  const index = Math.min(Math.floor((t - from) / beat), Math.max(0, beats - 1));
  return index <= 0 ? 'sit' : SEATED[(index + (hash(`harvest-beat:${id}`) % 6)) % 6];
}

/**
 * A fair guest: on their feet on the footpath when they arrive and before they go, and in
 * between a spell or two on the straw seat at their spot, with a cup of cider and a chat.
 * Getting down and up again takes a moment in a crouch. When the fair closes at 17:00 everyone
 * is up, and a guest still there says their goodbyes standing.
 */
export const fairPose: OutingPose = ({ home, time, arrive, leave }) => {
  const t = time - arrive;
  for (const [from, to] of fairSpells(home.id, leave - arrive, FAIR_CLOSES - arrive)) {
    if (t < from) return undefined;
    if (t >= to) continue;
    if (t < from + STRAW_SETTLE || t >= to - STRAW_SETTLE) return 'crouch';
    const beat = 3 + (hash(`fair-beat:${home.id}`) % 3);
    return seatedBeat(home.id, t, from + STRAW_SETTLE, to - STRAW_SETTLE, beat);
  }
  return undefined;
};

/**
 * A Long Table guest sits down to wait for supper, then eats, sips and talks with the
 * neighbours either side until they go, four to seven minutes at a time. The planner crouches
 * them on the way down and up (the table is a seated outing).
 */
export const tablePose: OutingPose = ({ home, time, arrive, leave }) => {
  const beat = 4 + (hash(`table-beat:${home.id}`) % 4);
  return seatedBeat(home.id, Math.max(arrive, time), arrive, Math.max(arrive, leave), beat);
};
