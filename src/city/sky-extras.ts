// Extras in the night sky (agent E, SPEC §4.4): on the summer star nights only (Summer 27, 28 and
// Autumn 1), at most 3 slow cool-white meteors, each a 40-px streak that fades in and out over at
// least 1.5 real seconds (alpha changes ≤ 0.08 a frame). Screen space, after drawSky.
// No Math.random, Date.now or performance.now: meteors run on the town clock.
import type { SkyScene } from './district-art';

type Ctx = CanvasRenderingContext2D;

/** Foundation stub: draws nothing. */
export const drawSkyExtras: (ctx: Ctx, scene: SkyScene) => void = () => {};
