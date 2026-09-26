import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readDeepLink } from '../src/lib/deep-link';
import {
  MILLPOND_LABEL,
  millpondCopy,
  millpondCopyFor,
  onTheIce,
  skatingCard,
  skatingLiveAt,
  SKATING_NAME,
  type MillpondCopy,
} from '../src/lib/millpond-copy';
import {
  BOAT_SEASON,
  boatsAt,
  fisherAt,
  FISH_RISE,
  fishRiseRate,
  fishRisesAt,
  heronAt,
  HERON_SCHEDULE,
  iceOn,
  leafCountAt,
  lilyFlowersOn,
  lilyPadsOn,
  millpondGroundDay,
  millpondSkatingDay,
  millpondStatusAt,
  mistAt,
  MILLPOND_VENUE,
  petalCountAt,
  sceneSkatersAt,
  SKATING,
  wheelAngleAt,
  type IceStage,
  type MillpondStatus,
} from '../src/lib/millpond';
import { lanternsLit } from '../src/lib/lanterns';
import { yearDayAt } from '../src/lib/seasons';
import { CALENDAR_EPOCH_DAY, DAYS_PER_YEAR, townCalendarAt } from '../src/lib/town-calendar';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TownEvents from '../src/components/TownEvents';
import MillpondInfo from '../src/components/MillpondInfo';
import { eventsForDay, eventStatus } from '../src/lib/events';
import { footballAt } from '../src/lib/football';

const YEAR = CALENDAR_EPOCH_DAY + DAYS_PER_YEAR * 2; // Year 3, like the fixtures
const dayOf = (season: number, date: number) => YEAR + 28 * season + date - 1;
const MINUTES = [0, 180, 330, 375, 420, 600, 780, 839.9, 840, 900, 999.9, 1000, 1165, 1200, 1320];
const CREWS = [[], ['Eliza'], ['Eliza', 'Sol'], ['Eliza', 'Sol', 'Renan', 'Ana']];

/** Every combination of the status fields, so the voice holds whatever the model reports. */
function* statuses(): Generator<MillpondStatus> {
  const ices: IceStage[] = ['open', 'freezing', 'frozen', 'thawing'];
  const skatings = [
    null,
    { live: true, start: 840, end: 1000 },
    { live: false, start: 840, end: 1000 },
  ];
  const boats = ['out', 'moored', 'stored'] as const;
  // A walking heron is a resting one on the move (the model's `heronWalking`).
  const herons = [
    [null],
    ['hunting'],
    ['resting'],
    ['asleep'],
    ['resting', 'out'],
    ['resting', 'home'],
    ['resting', 'between'],
  ] as const;
  for (const ice of ices)
    for (const skating of skatings)
      for (const boat of boats)
        for (const [heron, heronWalking] of herons)
          for (let flags = 0; flags < 128; flags++) {
            // Flowers only ever bloom on painted pads.
            if (flags & 32 && !(flags & 16)) continue;
            yield {
              ice,
              skating,
              boats: boat,
              heron,
              fishRising: !!(flags & 1),
              fisher: !!(flags & 2),
              petals: !!(flags & 4),
              leaves: !!(flags & 8),
              lilies: !!(flags & 16),
              flowers: !!(flags & 32),
              mist: !!(flags & 64),
              boatsOut: boat === 'out' ? 1 + (flags & 1) : 0,
              ...(heronWalking ? { heronWalking } : {}),
            };
          }
}
const words = (copy: MillpondCopy) => [
  copy.label,
  copy.footer,
  ...copy.blocks.flatMap((block) => [block.eyebrow, block.heading, block.body, block.note ?? '']),
];
/** The brand's copy rules plus the pond's own: quiet, honest, and no spoilers. */
function brandProblems(copy: MillpondCopy, skaters: readonly string[]) {
  const problems: string[] = [];
  const text = words(copy).join(' ');
  if (copy.label !== MILLPOND_LABEL) problems.push(`label ${copy.label}`);
  if (copy.blocks.length < 1 || copy.blocks.length > 2)
    problems.push(`${copy.blocks.length} blocks`);
  for (const block of copy.blocks) {
    if (!block.heading.endsWith('.')) problems.push(`heading "${block.heading}"`);
    if (block.eyebrow !== block.eyebrow.toUpperCase()) problems.push(`eyebrow "${block.eyebrow}"`);
    if (!block.body.trim()) problems.push(`empty body under "${block.heading}"`);
  }
  if (text.includes('!')) problems.push('exclamation mark');
  if ((text.match(/\blittle\b/gi) ?? []).length > 1) problems.push('"little" more than once');
  const secret = text.match(/crack|\blure|glint|secret|full moon|treasure|hidden|mystery/i);
  if (secret) problems.push(`hint "${secret[0]}"`);
  const crowd = text.match(/crowd|packed|busy|dozens|everyone skates|lots of|many skaters/i);
  if (crowd) problems.push(`crowd "${crowd[0]}"`);
  // (The sentence scan is slow, so only where a count could be.)
  const counts = text.includes(' out on the ice.')
    ? (text.match(/[^.]* (is|are) out on the ice\./g) ?? [])
    : [];
  if (skaters.length > 0 ? counts.length !== 1 : counts.length > 0)
    problems.push(`count ${counts}`);
  const [first] = counts;
  if (first && first.trim() !== onTheIce(skaters)) problems.push(`count ${first}`);
  if (/\bforktown\b/i.test(text)) problems.push('says forktown');
  if (
    text.includes('away until the water opens') &&
    /The heron (is hunting|is asleep|keeps|steps|heads|walks|waits|is back)/.test(text)
  )
    problems.push('the heron is both away and here');
  if ((text.match(/\bshallows\b/g) ?? []).length > 2) problems.push('"shallows" three times');
  return problems;
}

describe('Millpond panel copy', () => {
  it('keeps the brand voice for every status the model can report', () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const status of statuses())
      for (const minutes of [330, 600, 900, 1165, 1320])
        for (const skaters of status.skating?.live ? CREWS : [CREWS[0]]) {
          const copy = millpondCopyFor(status, minutes, dayOf(3, 12), skaters);
          const problems = brandProblems(copy, status.skating?.live ? skaters : []);
          checked++;
          if (problems.length) wrong.push(`${JSON.stringify(status)} ${minutes}: ${problems}`);
        }
    expect(checked).toBeGreaterThan(200_000);
    expect(wrong.slice(0, 5)).toEqual([]);
  }, 30_000);

  it('keeps the brand voice through a whole real year', () => {
    const wrong: string[] = [];
    for (let day = YEAR; day < YEAR + DAYS_PER_YEAR; day++)
      for (const minutes of MINUTES)
        for (const skaters of [CREWS[0], CREWS[2]]) {
          const copy = millpondCopy(minutes, day, skaters);
          const live =
            !!millpondStatusAt(minutes, day).skating && skatingLiveAt(minutes, skaters.length);
          const problems = brandProblems(copy, live ? skaters : []);
          if (problems.length) wrong.push(`${day - YEAR} ${minutes}: ${problems}`);
        }
    expect(wrong.slice(0, 5)).toEqual([]);
  });

  it('never says what the pond is not showing: every sentence against the model, all year', () => {
    const hunting = new Set(['stalk', 'freeze', 'strike', 'swallow', 'stand']);
    const still = new Set(['stand', 'preen']);
    type Moment = {
      minutes: number;
      day: number;
      time: number;
      today: number;
      groundDay: number;
      ice: IceStage;
      heron: ReturnType<typeof heronAt>;
      boats: ReturnType<typeof boatsAt>;
      /** Everything the panel says at this moment. */
      said: string;
    };
    const boatsIn = (m: Moment, state: string) => m.boats.filter((b) => b.state === state).length;
    const first = (m: Moment, test: (day: number) => boolean) => {
      let ahead = 1;
      while (!test(m.today + ahead)) ahead++;
      const almanac = townCalendarAt(m.today + ahead, 720);
      return ahead === 1 ? 'tomorrow' : `${almanac.season} ${almanac.date}`;
    };
    const on = (when: string, word: string) => (when === 'tomorrow' ? when : `${word} ${when}`);
    const iceOf = (day: number) => iceOn(millpondGroundDay(720, day)).stage;
    const leapsOn = new Map<number, boolean>();
    const leapsAtDusk = (m: Moment) => {
      if (!leapsOn.has(m.today)) {
        let any = false;
        for (let t = FISH_RISE.dusk; t < FISH_RISE.night && !any; t += 0.25)
          any = fishRisesAt(t, m.today).some((rise) => rise.leap);
        leapsOn.set(m.today, any);
      }
      return leapsOn.get(m.today)!;
    };
    // Each sentence the panel can say, and what must be on screen whenever it says it.
    const RULES: [RegExp, (m: Moment) => boolean][] = [
      [
        /Out on the ice\.|Skating until/,
        (m) => m.ice === 'frozen' && m.time >= 840 && m.time < 1000,
      ],
      [/Out on the ice\./, (m) => m.time === 840 || sceneSkatersAt(m.minutes, m.day).length > 0],
      [/Frozen hard\./, (m) => m.ice === 'frozen'],
      [/again tomorrow at 14:00/, (m) => millpondSkatingDay(m.today + 1)],
      [/last skate of the winter/, (m) => iceOf(m.today + 1) === 'thawing'],
      [/freezing over/, (m) => m.ice === 'freezing'],
      [
        /Skating starts (tomorrow|on \w+ \d+),/,
        (m) =>
          m.ice === 'freezing' &&
          m.said.includes(`starts ${on(first(m, millpondSkatingDay), 'on')},`),
      ],
      [/breaking up/, (m) => m.ice === 'thawing'],
      [
        /Open water again/,
        (m) =>
          m.said.includes(
            `again ${on(
              first(m, (d) => iceOf(d) === 'open'),
              'from',
            )}.`,
          ),
      ],
      [
        /turning wheel|wheel keeps turning|old mill turns/,
        (m) => wheelAngleAt(m.minutes, m.day) !== null,
      ],
      [/lanterns glimmer/, (m) => lanternsLit(18, m.minutes) > 0],
      [/Rowboats heading (out|home)/, (m) => boatsIn(m, 'out') > 0],
      [/Two rowboats row slow loops/, (m) => boatsIn(m, 'out') === 2],
      [
        /Two rowboats wait at the jetty|rowboats are back at the jetty/,
        (m) => boatsIn(m, 'moored') === 2,
      ],
      [/Their summer on the water is over/, (m) => m.groundDay > BOAT_SEASON.lastOut],
      [/wait at the jetty for summer/, (m) => m.groundDay < BOAT_SEASON.out],
      [/They go out at 08:30/, (m) => m.groundDay >= BOAT_SEASON.out && m.time < 510],
      [/upturned on the bank/, (m) => boatsIn(m, 'stored') === 2],
      [/Mist on the pond|mist hangs/, (m) => mistAt(m.minutes, m.day) > 0.2],
      [/early fisher/, (m) => fisherAt(m.minutes, m.day) !== null],
      [
        /The heron is hunting|Stock-still in the shallows/,
        (m) => m.ice === 'open' && !!m.heron && hunting.has(m.heron.pose) && m.heron.wade > 0.5,
      ],
      [/asleep in the reeds/, (m) => m.heron?.pose === 'sleep'],
      [/keeps watch/, (m) => m.ice === 'open' && !!m.heron && still.has(m.heron.pose)],
      [/keeps watch from the shallows/, (m) => (m.heron?.wade ?? 0) > 0.5],
      [
        /steps out of the reeds/,
        (m) => m.heron?.pose === 'walk' && m.time < HERON_SCHEDULE.hunts[0].from,
      ],
      [
        /heads back to its reeds/,
        (m) => m.heron?.pose === 'walk' && m.time >= HERON_SCHEDULE.roost,
      ],
      [/walks to a new spot/, (m) => m.heron?.pose === 'walk'],
      [
        /waits at the edge of the ice/,
        (m) => m.ice === 'freezing' && still.has(m.heron?.pose ?? ''),
      ],
      [
        /back by the open water|waits in the first open water/,
        (m) => m.ice === 'thawing' && still.has(m.heron?.pose ?? '') && m.heron!.wade > 0.5,
      ],
      [
        /No hunting/,
        (m) => m.ice !== 'open' && !!m.heron && !['stalk', 'strike'].includes(m.heron.pose),
      ],
      [/away until the water opens/, (m) => m.ice === 'frozen' && !m.heron],
      [
        /Fish are rising/,
        (m) =>
          m.ice === 'open' &&
          fishRiseRate(m.time) >= 1 &&
          [-1, -0.5, 0, 0.5, 1].some((dt) => fishRisesAt(m.minutes + dt, m.day).length > 0),
      ],
      [/silver leap/, leapsAtDusk],
      [/Blossom petals/, (m) => m.ice === 'open' && petalCountAt(yearDayAt(m.today, m.time)) >= 1],
      [/Fallen leaves/, (m) => m.ice === 'open' && leafCountAt(yearDayAt(m.today, m.time)) >= 1],
      [/Lily pads float/, (m) => lilyPadsOn(m.groundDay).length >= 1],
      [/in flower/, (m) => lilyFlowersOn(m.groundDay).length >= 1],
    ];
    const hits = RULES.map(() => 0);
    const wrong: string[] = [];
    const check = (day: number, minutes: number) => {
      const said = words(millpondCopy(minutes, day)).join(' ');
      const m: Moment = {
        minutes,
        day,
        time: minutes,
        today: day,
        groundDay: millpondGroundDay(minutes, day),
        ice: millpondStatusAt(minutes, day).ice,
        heron: heronAt(minutes, day),
        boats: boatsAt(minutes, day),
        said,
      };
      RULES.forEach(([sentence, holds], index) => {
        if (!sentence.test(said)) return;
        hits[index]++;
        if (!holds(m) && wrong.length < 12)
          wrong.push(`${day - YEAR} ${minutes} ${sentence}: ${said.slice(0, 400)}`);
      });
    };
    // Every half minute of the year over any three days (1.5-minute steps, staggered), plus
    // both sides of every edge the copy or the pond changes at.
    const EDGES = [0, 10, 330, 336, 360, 420, 480, 492, 510, 525, 535, 545, 700, 712, 840];
    EDGES.push(948, 960, 1000, 1080, 1085, 1095, 1110, 1122, 1200, 1230, 1260, 1290, 1430);
    for (let day = YEAR; day < YEAR + DAYS_PER_YEAR; day++) {
      for (let minutes = ((day - YEAR) % 3) * 0.5; minutes < 1440; minutes += 1.5)
        check(day, minutes);
      for (const edge of EDGES)
        for (const minutes of [edge - 0.05, edge, edge + 0.05])
          if (minutes >= 0 && minutes < 1440) check(day, minutes);
    }
    expect(wrong).toEqual([]);
    // No rule is vacuous: the panel says every one of these sentences somewhere in the year.
    expect(RULES.filter((_, index) => hits[index] === 0).map(([rule]) => String(rule))).toEqual([]);
  }, 30_000);

  it('names the neighbours on the ice only while skating is live', () => {
    const live = { ...[...statuses()][0], ice: 'frozen' as const };
    const on = { ...live, skating: { live: true, start: 840, end: 1000 } };
    const say = (status: MillpondStatus, minutes: number, names: string[]) =>
      words(millpondCopyFor(status, minutes, dayOf(3, 12), names)).join(' ');
    expect(say(on, 900, ['Eliza'])).toContain('Eliza is out on the ice.');
    expect(say(on, 900, ['Eliza', 'Sol'])).toContain('Eliza and Sol are out on the ice.');
    expect(say(on, 900, ['Eliza', 'Sol', 'Renan'])).toContain('3 neighbors are out on the ice.');
    expect(say(on, 900, [])).not.toMatch(/(is|are) out on the ice/);
    expect(say(on, 900, [])).toContain('Out on the ice.');
    const later = { ...live, skating: { live: false, start: 840, end: 1000 } };
    expect(say(later, 1100, ['Eliza', 'Sol'])).not.toMatch(/(is|are) out on the ice/);
    // Skaters glide from the moment they reach the ice, a few minutes before 14:00.
    expect(say(later, 835, ['Eliza'])).toContain('Eliza is out on the ice.');
    expect(say(later, 835, [])).not.toMatch(/(is|are) out on the ice/);
    expect(onTheIce(['  '])).toBe('1 neighbor is out on the ice.');
  });

  it('tells a frozen afternoon honestly: tomorrow, or the last skate', () => {
    const frozen = (day: number, minutes: number) => words(millpondCopy(minutes, day)).join(' ');
    expect(frozen(dayOf(3, 12), 1100)).toContain('again tomorrow at 14:00');
    // Winter 19 is the last frozen day; Winter 20 starts the thaw.
    expect(millpondSkatingDay(dayOf(3, 19))).toBe(true);
    expect(millpondSkatingDay(dayOf(3, 20))).toBe(false);
    expect(frozen(dayOf(3, 19), 1100)).toContain('last skate of the winter');
    expect(frozen(dayOf(3, 6), 720)).toContain('Skating starts on Winter 9, once the ice is hard.');
    expect(frozen(dayOf(3, 8), 720)).toContain('Skating starts tomorrow, once the ice is hard.');
    expect(frozen(dayOf(3, 21), 720)).toContain('Open water again from Winter 24');
  });
});

describe('Millpond skating card', () => {
  it('shows only on skating days and is live from 14:00 to 16:40, or once someone is on the ice', () => {
    for (let day = YEAR; day < YEAR + DAYS_PER_YEAR; day++) {
      const skating = millpondSkatingDay(day);
      for (const minutes of MINUTES) {
        const card = skatingCard(minutes, day, 2);
        expect(card === null, `${day - YEAR} ${minutes}`).toBe(!skating);
        if (!card) continue;
        // Two neighbours are already out: an early arrival (from 13:00) makes it live too.
        const live = minutes >= SKATING.depart && minutes < SKATING.end;
        expect(card.live).toBe(live);
        expect(skatingCard(minutes, day, 0)!.live).toBe(
          minutes >= SKATING.start && minutes < SKATING.end,
        );
        expect(card.status).toBe(
          live ? 'Happening now' : minutes < SKATING.start ? 'Later today' : 'Finished today',
        );
        expect(card.time).toBe('14:00–16:40');
        expect(card.name).toBe(SKATING_NAME);
        expect(card.skaters).toBe(live ? 2 : 0);
      }
    }
  });

  it('never counts a crowd it cannot see', () => {
    expect(skatingCard(900, dayOf(3, 12), 0)?.skaters).toBe(0);
    expect(skatingCard(900, dayOf(3, 12), 1)?.skaters).toBe(1);
    expect(skatingCard(1439.9, dayOf(3, 12) - 1, 5)).toEqual(skatingCard(-0.1, dayOf(3, 12), 5));
    expect(skatingCard(900 + 1440, dayOf(3, 12) - 1, 1)).toEqual(skatingCard(900, dayOf(3, 12), 1));
  });

  it('says its time and count aloud, and joins the live cards while it is on', () => {
    const day = dayOf(3, 12);
    const cards = (minutes: number, skaters: number) => {
      const html = renderToStaticMarkup(
        createElement(TownEvents, {
          events: eventsForDay(day, 720),
          minutes,
          day,
          skaters,
          football: footballAt(minutes, day),
          onVisit: () => {},
        }),
      );
      return [...html.matchAll(/<button[^>]*aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)].map(
        ([, label, inner]) => ({ label, text: inner.replace(/<[^>]*>/g, '') }),
      );
    };
    const live = cards(870, 1);
    const skating = live.findIndex((card) => card.label.includes(SKATING_NAME));
    expect(live[skating].label).toBe(
      `Visit The Millpond: ${SKATING_NAME}, happening now, 14:00 to 16:40, 1 neighbor on the ice`,
    );
    expect(live[skating].text).toContain('Happening now · 14:00–16:40 · 1 on the ice');
    expect(cards(870, 3)[skating].label).toContain('3 neighbors on the ice');
    expect(cards(870, 0)[skating].label).not.toMatch(/on the ice/);
    // Football first, then the live cards, then skating, then everything later or finished.
    const events = eventsForDay(day, 720);
    const firstLater = events.findIndex((event) => eventStatus(event, 870) !== 'Happening now');
    expect(firstLater).toBeGreaterThanOrEqual(0);
    expect(skating).toBe(1 + firstLater);
    expect(live[0].label).toMatch(/football/i);
    // Before and after the session it waits at the end of the list.
    for (const minutes of [720, 1100])
      expect(cards(minutes, 1).at(-1)!.label).toMatch(
        /Skating on the Millpond, (later|finished) today, 14:00 to 16:40$/,
      );
    // The panel names the neighbours on the ice.
    const panel = renderToStaticMarkup(
      createElement(MillpondInfo, { minutes: 870, day, skaters: ['Eliza'] }),
    );
    expect(panel).toContain('Eliza is out on the ice.');
  });

  it('uses the generic event markup, a keyboard button, and no football classes', () => {
    const card = readFileSync('src/components/MillpondEventCard.tsx', 'utf8');
    expect(card).toContain('<button');
    expect(card).toContain('className={`event-card ');
    expect(card).toContain('live-dot');
    expect(card).not.toMatch(/football/i);
    const events = readFileSync('src/components/TownEvents.tsx', 'utf8');
    expect(events).toContain('<MillpondEventCard');
    const info = readFileSync('src/components/MillpondInfo.tsx', 'utf8');
    expect(info).toContain('venue-info');
    expect(info).toContain('quiet-label');
  });

  it('keeps the pond out of the empty-plot card and in the link', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(readDeepLink('#venue=millpond', [])).toEqual({ plot: MILLPOND_VENUE.plot });
    expect(app).toContain("'#venue=millpond'");
    // The pond's panel comes before the empty-plot fallback that offers "Build here".
    expect(app.indexOf('<MillpondInfo')).toBeGreaterThan(-1);
    expect(app.indexOf('<MillpondInfo')).toBeLessThan(app.indexOf("'Build here'"));
    const city = readFileSync('src/components/City.tsx', 'utf8');
    expect(city).toContain('millpondCamera');
    expect(city).toContain('MILLPOND_VENUE.name');
  });

  it('is a pure function of the town clock', () => {
    const source = readFileSync('src/lib/millpond-copy.ts', 'utf8');
    expect(source).not.toMatch(/\bDate\b|Math\.random|localStorage|sessionStorage/);
  });
});
