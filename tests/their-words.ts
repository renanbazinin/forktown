// A neighbor's own words on the cards. The town's copy follows the brand's rules (no "!", no
// straight apostrophe, no git words); a house's name, its resident's name and greeting, its
// creator's handle and its sign are theirs to write however they like. The voice checks take those
// out before they read what is left, so a contributor's punctuation never fails them, while every
// word the town itself draws is still checked.
import { placeSchema, type Place } from '../src/lib/schema';
import { MY_LITTLE_PLACE } from './fixtures';

/** signs.ts letters every sign in Arial; nothing the town writes itself uses it. */
export const isSignFont = (font: string) => /\bArial\b/.test(font);

const theirs = (place: Place) =>
  [place.name, place.resident.name, place.resident.greeting, place.creator]
    .map((words) => words.trim())
    .filter(Boolean);

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A line of drawn text with the neighbor's words taken out: each whole name, greeting and handle
 * where it stands on its own (so a resident "Rosie" is not cut out of the house's "Rosie's"), each
 * of their words, and the pieces a card's wrap leaves of a word too wide for its column (the line's
 * first word may be the end of one of theirs, its last the start of one, and a line of one word
 * any piece of one: "ziestHouse!" from "WelcomeToTheCoziestHouse!"). Curly quotes, "@" and the full
 * stop around their words are the card's own; a straight quote or "!" of the card's is never taken
 * out with them.
 */
export function withoutTheirWords(text: string, place: Place): string {
  const whole = theirs(place).sort((a, b) => b.length - a.length);
  const words = whole.flatMap((line) => line.split(/\s+/)).filter(Boolean);
  const tokens = whole
    .reduce(
      (left, line) =>
        left.replace(new RegExp(`(?<=^|[\\s“‘(@])${escape(line)}(?=$|[\\s”’).,:;])`, 'gu'), ' '),
      text,
    )
    .split(/\s+/)
    .filter(Boolean);
  return tokens
    .filter((token, i) => {
      const bare = token.replace(/^[“‘(@]+/, '').replace(/[”’).,:;]+$/, '');
      if (!bare) return false;
      const only = tokens.length === 1;
      return !words.some(
        (word) =>
          word === token ||
          word === bare ||
          (only && word.includes(bare)) ||
          (i === 0 && word.endsWith(bare)) ||
          (i === tokens.length - 1 && word.startsWith(bare)),
      );
    })
    .join(' ');
}

/** The brand's rules for the town's own copy on a card. */
export const OFF_VOICE = /!|'|\b(?:repo|commit|branch|SHA|merged)\b/i;

/** A context that keeps every fillText with the font it was set in, and draws it as well. */
export function writing(ctx: CanvasRenderingContext2D) {
  const written: { text: string; font: string }[] = [];
  const traced = new Proxy(ctx, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (key !== 'fillText') return value;
      return (text: string, ...rest: number[]) => {
        written.push({ text: String(text), font: String(Reflect.get(target, 'font')) });
        return (value as (...args: unknown[]) => unknown)(text, ...rest);
      };
    },
    set: (target, key, value) => Reflect.set(target, key, value),
  });
  return { ctx: traced, written };
}

/**
 * Houses whose owners wrote freely, as the builder allows: apostrophes, ampersands and "!" in every
 * field, a long name the cards wrap by words, one long word they break inside, signs (text and a
 * right-aligned HTML run) that shout, and a resident and handle named inside the house's name.
 */
export const WORDY_HOUSES: Place[] = [
  placeSchema.parse({
    ...MY_LITTLE_PLACE,
    id: 'grandma-rosie-s-little-cottage',
    name: "Grandma Rosie's Little Cottage",
    creator: 'rosie-o-brien',
    resident: { ...MY_LITTLE_PLACE.resident, name: "D'Arcy & Bea", greeting: "Come in, y'all!" },
    sign: { ...MY_LITTLE_PLACE.sign, mode: 'text', text: "WELCOME! IT'S OPEN" },
  }),
  placeSchema.parse({
    ...MY_LITTLE_PLACE,
    id: 'welcometothecoziesthouse',
    name: 'WelcomeToTheCoziestHouse!',
    resident: { ...MY_LITTLE_PLACE.resident, name: 'Nobody', greeting: 'Merged my branch!' },
    sign: {
      ...MY_LITTLE_PLACE.sign,
      mode: 'html',
      html: `<div style="background-color: #203B35; text-align: right"><strong style="font-size: 24px">COME IN!</strong><p>my repo's branch</p></div>`,
    },
  }),
  placeSchema.parse({
    ...MY_LITTLE_PLACE,
    id: 'rosie-s-place',
    name: "Grandma Rosie's Jam & Tea Room",
    creator: 'rosie',
    resident: { ...MY_LITTLE_PLACE.resident, name: 'Rosie', greeting: "Tea's on, come in!" },
  }),
];
