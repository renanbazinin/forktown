import { describe, expect, it } from 'vitest';
import {
  ARRIVE,
  BONK,
  CROUCH,
  CUTS,
  FLOP,
  FWOOMP,
  HAT_LAND,
  PAT,
  ROBIN,
  SPRING,
  STOW,
  stopName,
  TUG,
  theTreelineAd,
  theTreelineAdScore,
} from '../src/films/ads/the-treeline';
import { slateSeconds } from '../src/films/kit';
import { CINEMA_ADS } from '../src/lib/cinema';
import { TUBE_SIGN_LINES, TUBE_STATIONS, tubeStation } from '../src/lib/tubes';
import { recordingContext } from './recording-context';

const ad = CINEMA_ADS.find((spot) => spot.artwork === 'tube')!;
const draw = (seconds: number) => {
  const recording = recordingContext(320, 180);
  theTreelineAd.draw(recording.ctx, seconds / ad.duration, seconds);
  return recording.calls;
};
const text = (seconds: number) =>
  draw(seconds)
    .filter((call) => call.name === 'fillText')
    .map((call) => call.args[0]);

describe('The Treeline ad', () => {
  const beats = [BONK, STOW, CROUCH, FWOOMP, TUG, FLOP, ROBIN, ARRIVE, HAT_LAND, PAT, SPRING];

  it('tells the whole story before the sponsor slate', () => {
    expect([...beats].sort((a, b) => a - b)).toEqual(beats);
    const slate = 1 - slateSeconds(ad) / ad.duration;
    expect(SPRING + 0.02).toBeLessThan(slate);
    // The robin is on the ride and the drop is at Willow Halt.
    expect(ROBIN).toBeGreaterThan(CUTS[1]);
    expect(ROBIN).toBeLessThan(CUTS[2]);
    expect(ARRIVE).toBeGreaterThan(CUTS[2]);
    // The picture never writes the tagline: only the slate does.
    for (let seconds = 0; seconds < ad.duration; seconds += 0.5)
      expect(text(seconds)).not.toContain(ad.tagline);
  });

  it('lands its sound on the picture', () => {
    const cues = theTreelineAdScore(ad);
    const near = (kind: string, beat: number) =>
      cues.some((cue) => cue.kind === kind && Math.abs(cue.at - beat * ad.duration) < 0.02);
    expect(near('boing', BONK)).toBe(true);
    expect(near('knock', STOW)).toBe(true);
    expect(near('thud', FWOOMP)).toBe(true);
    expect(near('whir', TUG)).toBe(true);
    expect(near('tweet', ROBIN)).toBe(true);
    expect(near('thud', ARRIVE)).toBe(true);
    expect(near('pop', HAT_LAND)).toBe(true);
    expect(near('boing', SPRING)).toBe(true);
    for (const kind of ['swish', 'sweep', 'wind', 'whir'])
      expect(cues.some((cue) => cue.kind === kind)).toBe(true);
  });

  it('maps the whole line on the ride: every halt a stop, the ride between its own two', () => {
    // The strip's stops are discs on one row; the two of the ride are larger, and the rider's dot
    // rides between them.
    const row = (seconds: number) =>
      draw(seconds).filter((call) => call.name === 'ellipse' && call.args[1] === 14);
    const mid = ((CUTS[1] + CUTS[2]) / 2) * ad.duration;
    // The stops first, in line order; then the rider's dot, a ring round a red middle.
    const stops = row(mid).slice(0, -2);
    expect(
      row(mid)
        .slice(-2)
        .map((call) => call.args[2]),
    ).toEqual([3.5, 2.5]);
    expect(stops.every((call) => [1.5, 2.5].includes(call.args[2] as number))).toBe(true);
    expect(stops).toHaveLength(TUBE_STATIONS.length);
    expect(TUBE_STATIONS).toHaveLength(7);
    const x = (id: string) => stops[TUBE_STATIONS.findIndex((s) => s.id === id)].args[0] as number;
    // Along the loop, the far bank's end on the left: the ride runs left to right, as the shot.
    const xs = TUBE_STATIONS.map((s) => x(s.id));
    expect([...xs].sort((a, b) => b - a)).toEqual(xs);
    expect(x('C1')).toBeLessThan(x('N1'));
    const ends = stops.filter((call) => call.args[2] === 2.5).map((call) => call.args[0]);
    expect(ends).toEqual([x('N1'), x('C1')]);
    const rider = (seconds: number) =>
      row(seconds).find((call) => call.args[2] === 3.5)!.args[0] as number;
    const early = rider((CUTS[1] + 0.01) * ad.duration),
      late = rider((CUTS[2] - 0.01) * ad.duration);
    expect(early).toBeGreaterThan(x('C1'));
    expect(late).toBeLessThan(x('N1'));
    expect(late).toBeGreaterThan(early);
  });

  it('reads the real sign, names both halts and keeps its one caption', () => {
    // The umbrella is stowed at Hedgerow Halt, by the sign, and the ride ends at Willow Halt.
    const [first, last] = [tubeStation('C1'), tubeStation('N1')];
    expect(text(3.5)).toEqual(expect.arrayContaining([...TUBE_SIGN_LINES]));
    expect(text(1)).toEqual(expect.arrayContaining(['THE TREELINE', first.name.toUpperCase()]));
    // On the ride, the line's strip names its own two stops, "Halt" left off as on a line map.
    expect([stopName('C1'), stopName('N1')]).toEqual(['HEDGEROW', 'WILLOW']);
    expect(text(((CUTS[1] + CUTS[2]) / 2) * ad.duration)).toEqual(
      expect.arrayContaining(['THE TREELINE', stopName(first.id), stopName(last.id)]),
    );
    expect(text((CUTS[2] + 0.03) * ad.duration)).toContain(last.name.toUpperCase());
    expect(text((FLOP + 0.03) * ad.duration)).toContain('Now with less suction.');
    expect(text(TUG * ad.duration)).not.toContain('Now with less suction.');
  });
});
