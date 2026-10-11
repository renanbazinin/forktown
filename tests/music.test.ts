import { describe, expect, it } from 'vitest';
import {
  beatsOf,
  compose,
  durationOf,
  isTownTune,
  TOWN_ROTATION,
  townTuneAt,
  trackForTown,
  TRACKS,
  type TrackId,
} from '../src/music/score';
import { isTune, TOWN_TUNES } from '../src/music/tunes';
import { eventsForDay } from '../src/lib/events';

describe('Original town soundtrack', () => {
  it('follows the concert boundaries and returns to the town’s tune for the hour', () => {
    for (let day = 0; day < 20; day++) {
      const events = eventsForDay(day);
      const concert = events[1];
      expect(trackForTown(0, events)).toBe('party');
      expect(trackForTown(1409.99, events)).toBe('night');
      expect(trackForTown(1410, events)).toBe('party');
      expect(trackForTown(149.99, events)).toBe('party');
      expect(trackForTown(150, events)).toBe('smallhours');
      expect(trackForTown(360, events)).toBe('sunrise');
      expect(trackForTown(650, events)).toBe('town');
      expect(trackForTown(850, events)).toBe('afternoon');
      expect(trackForTown(concert.start - 0.01, events)).toBe('goldenhour');
      expect(trackForTown(concert.start, events)).toBe(concert.id);
      expect(trackForTown(concert.end - 0.01, events)).toBe(concert.id);
      expect(trackForTown(concert.end, events)).toBe('lamplight');
    }
  });
  it('takes the town’s own tunes in turn through the day, each for a stretch', () => {
    expect(TOWN_ROTATION[0].from).toBe(0);
    TOWN_ROTATION.forEach((slot, index) => {
      const next = TOWN_ROTATION[index + 1]?.from ?? 1440;
      // At least an hour of town time (a real minute), and never the same tune twice in a row.
      expect(next - slot.from).toBeGreaterThanOrEqual(60);
      if (index) expect(slot.track).not.toBe(TOWN_ROTATION[index - 1].track);
      expect(townTuneAt(slot.from)).toBe(slot.track);
      expect(townTuneAt(next - 0.01)).toBe(slot.track);
      expect(townTuneAt(slot.from + 1440)).toBe(slot.track);
    });
    // Every tune of the hour is on the rotation, with the day theme and the night theme.
    for (const id of Object.keys(TOWN_TUNES)) expect(isTownTune(id as TrackId)).toBe(true);
    expect(isTownTune('town') && isTownTune('night')).toBe(true);
    expect(isTownTune('rock') || isTownTune('party')).toBe(false);
  });
  it('gives each tune of the hour a room, a level and whole phrases', () => {
    for (const [id, info] of Object.entries(TOWN_TUNES)) {
      expect(isTune(id)).toBe(true);
      expect(info.hall, id).toBeDefined();
      expect(info.loudness, id).toBeGreaterThan(0.02);
      expect(info.loudness, id).toBeLessThan(0.06);
      // The town hands one tune to the next at the end of a phrase of four bars.
      expect(beatsOf(id as TrackId) % (4 * (info.bar ?? 4)), id).toBe(0);
      expect(info.instruments?.length, id).toBeGreaterThan(0);
    }
  });
  it('keeps the small hours quiet: no drums between 02:30 and 06:00', () => {
    for (const id of ['smallhours', 'beforedawn'] as const)
      expect(
        compose(id).some((n) =>
          ['kick', 'snare', 'hat', 'softkick', 'rim', 'shaker', 'tick', 'ride'].includes(n.voice),
        ),
        id,
      ).toBe(false);
  });
  it.each(Object.keys(TRACKS) as TrackId[])(
    '%s has a finite, playable score and restrained gain',
    (track) => {
      const notes = compose(track);
      const tune = isTune(track);
      expect(notes.length).toBeGreaterThan(tune ? 60 : 100);
      expect(durationOf(track)).toBeGreaterThan(30);
      // A tune of the hour runs longer, so an hour of it is not one short loop over and over.
      expect(durationOf(track)).toBeLessThan(tune ? 115 : 60);
      if (tune) expect(durationOf(track)).toBeGreaterThan(60);
      for (const note of notes) {
        expect(Number.isFinite(note.beat + note.length + note.pitch + note.gain + note.pan)).toBe(
          true,
        );
        expect(note.beat).toBeGreaterThanOrEqual(0);
        expect(note.beat).toBeLessThan(beatsOf(track));
        expect(note.length).toBeGreaterThan(0);
        expect(note.pitch).toBeGreaterThanOrEqual(tune ? 24 : 28);
        expect(note.pitch).toBeLessThanOrEqual(tune ? 100 : 90);
        expect(note.gain).toBeGreaterThan(0);
        expect(note.gain).toBeLessThanOrEqual(0.25);
        expect(Math.abs(note.pan)).toBeLessThanOrEqual(1);
      }
      expect(compose(track)).toEqual(notes);
    },
  );
  it('keeps the night arrangement sparse and percussion-free', () => {
    expect(compose('night').some((n) => ['hat', 'kick', 'snare', 'lead'].includes(n.voice))).toBe(
      false,
    );
    expect(compose('night').length).toBeLessThan(compose('town').length / 2);
    expect(
      new Set(
        compose('rock')
          .filter((n) => n.voice === 'lead')
          .map((n) => n.pitch),
      ).size,
    ).toBeGreaterThan(10);
  });
});
