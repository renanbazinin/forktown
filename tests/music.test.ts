import { describe, expect, it } from 'vitest';
import { BEATS, compose, durationOf, trackForTown, TRACKS, type TrackId } from '../src/music/score';
import { eventsForDay } from '../src/lib/events';

describe('Original town soundtrack', () => {
  it('follows the concert boundaries and returns to the right day/night theme', () => {
    for (let day = 0; day < 20; day++) {
      const events = eventsForDay(day);
      const concert = events[1];
      expect(trackForTown(0, events)).toBe('party');
      expect(trackForTown(1409.99, events)).toBe('night');
      expect(trackForTown(1410, events)).toBe('party');
      expect(trackForTown(149.99, events)).toBe('party');
      expect(trackForTown(150, events)).toBe('night');
      expect(trackForTown(360, events)).toBe('town');
      expect(trackForTown(850, events)).toBe('town');
      expect(trackForTown(concert.start - 0.01, events)).toBe('town');
      expect(trackForTown(concert.start, events)).toBe(concert.id);
      expect(trackForTown(concert.end - 0.01, events)).toBe(concert.id);
      expect(trackForTown(concert.end, events)).toBe('night');
    }
  });
  it.each(Object.keys(TRACKS) as TrackId[])(
    '%s has a finite, playable score and restrained gain',
    (track) => {
      const notes = compose(track);
      expect(notes.length).toBeGreaterThan(100);
      expect(durationOf(track)).toBeGreaterThan(30);
      expect(durationOf(track)).toBeLessThan(60);
      for (const note of notes) {
        expect(Number.isFinite(note.beat + note.length + note.pitch + note.gain + note.pan)).toBe(
          true,
        );
        expect(note.beat).toBeGreaterThanOrEqual(0);
        expect(note.beat).toBeLessThan(BEATS);
        expect(note.length).toBeGreaterThan(0);
        expect(note.pitch).toBeGreaterThanOrEqual(28);
        expect(note.pitch).toBeLessThanOrEqual(90);
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
