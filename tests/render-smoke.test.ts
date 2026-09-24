import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderCity } from '../src/city/render';
import { placeSchema } from '../src/lib/schema';
import { recordingContext } from './recording-context';

const places = readdirSync('places')
  .filter((file) => file.endsWith('.json'))
  .map((file) => placeSchema.parse(JSON.parse(readFileSync(`places/${file}`, 'utf8'))));

// A node frame of the opening view at noon, golden hour, mid Lantern hour and deep night.
// The budget keeps the lanterns, posts and stakes from quietly multiplying the draw calls.
describe('Rendering the opening view in node', () => {
  it.each([720, 1165, 1205, 180])('draws minute %s within the call budget', (minutes) => {
    const { ctx, calls } = recordingContext(1440, 900);
    expect(() =>
      renderCity({
        ctx,
        width: 1440,
        height: 900,
        camera: { x: 720, y: 88, zoom: 0.7 },
        places,
        selectedPlot: null,
        hoveredPlot: null,
        night: minutes < 360 || minutes >= 1200,
        showPlots: false,
        minutes,
        day: 3,
      }),
    ).not.toThrow();
    expect(calls.length).toBeGreaterThan(1000);
    expect(calls.length).toBeLessThan(40_000);
  });
});
