import { describe, expect, it } from 'vitest';
import { renderCity } from '../src/city/render';
import { eventsForDay } from '../src/lib/events';
import { ZOO_FRAME } from '../src/lib/zoo';
import { places } from './house-variety';
import { recordingContext } from './recording-context';

// Words on the map set their own alignment. One that borrowed the last object's would shift as
// culling or a new neighbor changed what was drawn before it.
const WORDS: Record<string, string> = { '♪': 'start', '♫': 'start', 'ROOM TO GROW': 'center' };

const OPENING = { x: 720, y: 88, zoom: 0.7 };
// The zoo is culled from the opening view, so its words are read with the zoo in view.
const ZOO = { x: 720 - ZOO_FRAME.center.x * 0.7, y: 450 - ZOO_FRAME.center.y * 0.7, zoom: 0.7 };

function alignments(start: CanvasTextAlign, minutes: number, camera = OPENING) {
  const { ctx } = recordingContext(1440, 900);
  const seen: string[] = [];
  const traced = new Proxy(ctx, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (key !== 'fillText') return value;
      return (text: string, ...rest: number[]) => {
        if (text in WORDS) seen.push(`${text} ${target.textAlign}`);
        return value(text, ...rest);
      };
    },
    set: (target, key, value) => Reflect.set(target, key, value),
  });
  traced.textAlign = start;
  const day = 3;
  renderCity({
    ctx: traced,
    width: 1440,
    height: 900,
    camera,
    places,
    selectedPlot: null,
    hoveredPlot: null,
    night: minutes < 360 || minutes >= 1200,
    showPlots: false,
    residents: [],
    events: eventsForDay(day, 720),
    minutes,
    day,
  });
  return seen;
}

describe('Words on the map', () => {
  it('keep their own alignment whatever was drawn before them', () => {
    for (const minutes of [720, 1150]) {
      const seen = [
        ...alignments('end', minutes),
        ...alignments('left', minutes),
        ...alignments('end', minutes, ZOO),
        ...alignments('left', minutes, ZOO),
      ];
      expect(seen.some((word) => word.startsWith('ROOM TO GROW'))).toBe(true);
      for (const word of seen) {
        const text = word.slice(0, word.lastIndexOf(' '));
        expect(word, `${minutes}`).toBe(`${text} ${WORDS[text]}`);
      }
    }
  });
});
