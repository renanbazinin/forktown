// Morning Market browsers (agent B, SPEC §4.1): what a guest does at their stall. They stand
// facing it, glance to the next stall every 6–10 min (`market-look:${id}:${k}`, written here, not
// zooGlance) and chat one beat in three. Existing poses only.
// Import rule (SPEC §7.3): value-import only world, town-calendar, seasons, district-places and
// district-calendar; never resident-trips, events or anything under src/city/.
//
// A browser keeps one rhythm from the moment they reach their spot. Look k (k ≥ 1) starts 6–10
// minutes after look k − 1, and for MARKET_GLANCE minutes they turn a quarter to the next stall
// along their row; the rest of the beat they face their own stall. One beat in three they chat
// with the stallholder for MARKET_CHAT minutes, a minute after turning back. Nothing starts in the
// first MARKET_CALM minute at the spot and nothing runs into the last one, so a browser always
// arrives and sets off facing their stall. Someone early for their own hour glances only once it
// has opened.
//
// `chat` is a seated pose in the figure (folded legs), so a browser never takes it: they stand,
// and the market painter draws the chat's bubble over them (src/city/district/market.ts).
import type { OutingFacing, OutingPose, PoseContext } from '../outings.ts';
import { hash } from '../world.ts';
import { DISTRICT_SPOTS, type Spot } from '../district-places.ts';

/** Minutes a glance to the next stall is held. */
export const MARKET_GLANCE = 1.5;
/** Minutes a chat with the stallholder lasts. */
export const MARKET_CHAT = 2;
/** Minutes after arriving, and before leaving, when a browser only faces their stall. */
export const MARKET_CALM = 1;
/** Shortest and longest beat: minutes from one glance to the next. */
export const MARKET_BEAT = { min: 6, max: 10 } as const;

/** The six stalls: 0–2 along the north edge (west to east), 3–5 along the west edge (north to south). */
export const MARKET_STALLS = 6;
/** The stall a browsing seat stands at: two seats to a stall, in spot order. */
export const stallOfSeat = (seat: number) => Math.floor(seat / 2);

type Facing = Spot['facing'];
/** Minutes look k (k ≥ 1) starts after look k − 1. */
const beatLength = (id: string, k: number) =>
  MARKET_BEAT.min + (hash(`market-look:${id}:${k}`) % (MARKET_BEAT.max - MARKET_BEAT.min + 1));

/**
 * Where a browser at `seat` looks when they glance along their row on look `k`: inward from the
 * row's two end stalls, either way (by the look's own hash) from the middle one. A quarter turn
 * from the spot's own facing, never about.
 */
export function glanceFacing(id: string, seat: number, k: number): Facing {
  const north = DISTRICT_SPOTS.market[seat]?.facing === 'ne';
  const place = stallOfSeat(seat) % 3;
  // +1 looks to the next stall along the row: east on the north edge, south on the west edge.
  const way =
    place === 0 ? 1 : place === 2 ? -1 : (hash(`market-look:${id}:${k}`) >>> 4) % 2 ? 1 : -1;
  if (north) return way > 0 ? 'se' : 'nw';
  return way > 0 ? 'sw' : 'ne';
}

/** Minutes from arriving to the start of look k (look 0 starts on arrival). */
export function marketLookStart(id: string, k: number) {
  let t = 0;
  for (let i = 1; i <= k; i++) t += beatLength(id, i);
  return t;
}

export type MarketBeat = {
  /** The look this moment belongs to, 0 on arrival. */
  look: number;
  /** Minutes since the look began. */
  since: number;
  /** The quarter turn to the next stall while it lasts; undefined faces the browser's own stall. */
  glance: Facing | undefined;
  /** Chatting with the stallholder. */
  chat: boolean;
};

/**
 * A browser's beat at `time`, having reached their spot at `arrive` and setting off at `leave`.
 * The rhythm runs from arrival, but the glances wait for the browser's own hour to open (`opens`,
 * their window's start): someone early stays at their own stall until then, as an early guest
 * anywhere in town faces the show. Pure: the same browser, visit and minute always give the same
 * beat, to the figure and the art.
 */
export function marketBeat(
  id: string,
  seat: number,
  arrive: number,
  time: number,
  leave: number,
  opens = arrive,
): MarketBeat {
  const elapsed = time - arrive;
  if (elapsed < 0 || time >= leave)
    return { look: 0, since: elapsed, glance: undefined, chat: false };
  let look = 0,
    start = 0;
  for (let next = beatLength(id, 1); next <= elapsed; next = start + beatLength(id, look + 1)) {
    look++;
    start = next;
  }
  const since = elapsed - start;
  // Only whole glances and chats: none starts in the first calm minute or runs into the last.
  const fits = (from: number, length: number) =>
    from >= MARKET_CALM && arrive + from + length <= leave - MARKET_CALM;
  const glancing =
    look > 0 && since < MARKET_GLANCE && arrive + start >= opens && fits(start, MARKET_GLANCE);
  const chatFrom = (look ? start + MARKET_GLANCE : 0) + MARKET_CALM;
  const chat =
    hash(`market-chat:${id}:${look}`) % 3 === 0 &&
    elapsed >= chatFrom &&
    elapsed < chatFrom + MARKET_CHAT &&
    fits(chatFrom, MARKET_CHAT);
  return { look, since, glance: glancing ? glanceFacing(id, seat, look) : undefined, chat };
}

const beatOf = ({ home, trip, time }: PoseContext) =>
  marketBeat(home.id, trip.seat, trip.arrive, time, trip.leave, trip.event.start);

/** A browser's pose: none, ever. They stand at their stall (see the header on `chat`). */
export const marketPose: OutingPose = () => undefined;

/** Where a browser looks: a quarter turn to the next stall while a glance lasts, else their own. */
export const marketFacing: OutingFacing = (c) => beatOf(c).glance;

/** Whether a browser is chatting with their stallholder; the market painter draws the bubble. */
export const marketChat = (c: PoseContext) => beatOf(c).chat;
