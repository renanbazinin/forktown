// Houses the way contributors really write them, for the checks that fill the town with made-up
// neighbors (scripts/full-town-check.ts and scripts/newcomer-check.ts). The made-up houses of
// tests/full-town.ts cover every building, design and routine, but their names and signs are all
// short and tidy. A real newcomer often keeps the builder's defaults, or uses every character the
// schema allows, apostrophes and quotes included. Every house here is schema-valid, and the same
// on every run.
import { BUILDER_DEFAULT_STORY } from '../src/lib/lanterns.ts';
import {
  DEFAULT_DESIGN,
  DEFAULT_RESIDENT,
  DEFAULT_SIGN,
  placeSchema,
  type Place,
} from '../src/lib/schema.ts';

/** Every period a stroll and a night walk: the busiest a resident can be. */
const ALL_STROLL = { morning: 'stroll', afternoon: 'stroll', evening: 'stroll', night: 'stroll' };

/**
 * A house that keeps the builder's defaults: its old default names (a real neighbor already
 * has them), the examples' story, the HELLO sign and the starting look. `busy` sends the resident
 * out on every period and at night, as the sweep's newcomer does.
 */
export function builderDefaultHouse(plot: string, id: string, creator: string, busy = true) {
  return placeSchema.parse({
    id,
    name: 'My Little Place',
    creator,
    plot,
    building: 'cottage',
    color: '#789B76',
    decoration: 'flowers',
    story: BUILDER_DEFAULT_STORY,
    design: { ...DEFAULT_DESIGN },
    resident: {
      ...DEFAULT_RESIDENT,
      routine: busy ? { ...ALL_STROLL } : { ...DEFAULT_RESIDENT.routine },
    },
    sign: { ...DEFAULT_SIGN },
  });
}

// Every one exactly as long as the schema allows, with apostrophes and quotes.
export const LONGEST = {
  name: "Rosie's & D'Arcy's Lil' Tea Nook",
  resident: "Ann-Marie D'Arcy O'Neill",
  greeting: "Y'all come in, an' don't mind Bo's cat!!",
  story:
    "It's \"Rosie's\" on the sign, but D'Arcy's the one who's up at five, baking soda breads " +
    "for whoever's passing. Mind the old cat on the step: she's O'Malley's, and she won't share it.",
  text: "O'MALLEY'S TEA RM!",
};

/** Sign artwork of the full 2,000 characters: a title and as many styled spans as fit. */
export function longestSignHtml() {
  const span =
    '<span style="color: #FFF4D4; font-size: 12px; font-weight: bold; text-align: center"></span>';
  let html =
    '<div style="background-color: #35554A; color: #FFF4D4; text-align: center">' +
    '<strong style="font-size: 24px">ROSIE&#39;S &amp; D&#39;ARCY&#39;S</strong>';
  while (html.length + span.length + '</div>'.length < 2000) html += span;
  html += '</div>';
  return html.padEnd(2000, ' ');
}

/** A made-up house with every name, story and sign as long as the schema allows. */
export function longestHouse(made: Place, mode: 'html' | 'text'): Place {
  return placeSchema.parse({
    ...made,
    name: LONGEST.name,
    story: LONGEST.story,
    resident: { ...made.resident, name: LONGEST.resident, greeting: LONGEST.greeting },
    sign: {
      ...made.sign,
      mode,
      text: LONGEST.text,
      html: mode === 'html' ? longestSignHtml() : '',
    },
  });
}

/** How often a made-up house is swapped for one of these: one in every `CONTRIBUTOR_EVERY`. */
export const CONTRIBUTOR_EVERY = 37;

/**
 * The made-up houses, with one in every 37 keeping the builder's defaults and another one in
 * every 37 as long as the schema allows. Ids, plots and creators stay as they were made.
 */
export function contributorLike(madeUp: readonly Place[]): Place[] {
  return madeUp.map((made, index) => {
    const turn = Math.floor(index / CONTRIBUTOR_EVERY);
    if (index % CONTRIBUTOR_EVERY === 0)
      return builderDefaultHouse(made.plot, made.id, made.creator, turn % 2 === 0);
    if (index % CONTRIBUTOR_EVERY === Math.floor(CONTRIBUTOR_EVERY / 2))
      return longestHouse(made, turn % 2 === 0 ? 'html' : 'text');
    return made;
  });
}
