import { describe, expect, it } from 'vitest';
import { rosterTimeout } from './roster-timeout';
import { drawGroundErrandItem, errandGroundOffset, errandItemPose } from '../src/city/errand-items';
import { drawResident, NIGHT_DIM, residentReach } from '../src/city/residents';
import { tint } from '../src/city/houses';
import type { ErrandKind, ErrandPhase, ErrandVisual } from '../src/lib/seasonal-errands';
import { DEFAULT_RESIDENT } from '../src/lib/schema';
import type { ResidentState } from '../src/lib/simulation';
import { matrixContext } from './matrix-context';

const KINDS: ErrandKind[] = ['seedlings', 'lemonade', 'harvest', 'thermos'];
const FACINGS: ResidentState['facing'][] = ['se', 'sw', 'ne', 'nw'];
const PHASES: ErrandPhase[] = ['outbound', 'pickup', 'carrying', 'dropoff', 'returning'];
const person = { ...DEFAULT_RESIDENT, skin: '#DBAA89', outfit: '#AA79B9', hair: '#4C526B' };
const sample = (kind: ErrandKind, phase: ErrandPhase, progress: number): ErrandVisual => ({
  kind,
  phase,
  progress,
});
type Recorder = ReturnType<typeof matrixContext>;
const boxes = (r: Recorder) =>
  r.calls.flatMap((call, index) => {
    if (call.name !== 'fillRect') return [];
    const p = r.points.filter((point) => point.index === index);
    return [
      {
        color: call.fillStyle as string,
        x0: Math.min(...p.map((point) => point.x)),
        y0: Math.min(...p.map((point) => point.y)),
        x1: Math.max(...p.map((point) => point.x)),
        y1: Math.max(...p.map((point) => point.y)),
      },
    ];
  });
const state = (errand: ErrandVisual, facing: ResidentState['facing'], walkPhase = 0) => ({
  errand,
  facing,
  walkPhase,
  moving: errand.phase === 'carrying',
  greeting: false,
});

describe('Seasonal errand handoffs', () => {
  it('leaves the ground item at precisely the same point while its collector turns', () => {
    const feet = { x: 121, y: 223 };
    for (const scale of [1, 1.25, 2.5])
      for (const kind of KINDS)
        for (const night of [false, true]) {
          const ground = matrixContext();
          const offset = errandGroundOffset(scale);
          drawGroundErrandItem(
            ground.ctx,
            kind,
            feet.x + offset.x,
            feet.y + offset.y,
            night,
            scale,
          );
          const expected = boxes(ground);
          const colors = new Set(expected.map((box) => box.color));
          for (const facing of FACINGS)
            for (const [phase, progress] of [
              ['pickup', 0],
              ['dropoff', 1],
            ] as const) {
              const figure = matrixContext();
              drawResident(
                figure.ctx,
                person,
                feet.x,
                feet.y,
                scale,
                state(sample(kind, phase, progress), facing),
                { night },
              );
              const painted = boxes(figure).filter((box) => colors.has(box.color));
              expect(painted, `${kind} ${phase} ${facing} night=${night}`).toEqual(expected);
            }
        }
  });

  it('lifts and lowers in pixel steps, with no unexplained jump or item disappearing', () => {
    for (const kind of KINDS)
      for (const phase of ['pickup', 'dropoff'] as const)
        for (const facing of FACINGS) {
          let previous = errandItemPose(sample(kind, phase, 0), facing)!;
          for (let i = 1; i <= 200; i++) {
            const next = errandItemPose(sample(kind, phase, i / 200), facing)!;
            expect(next).toBeDefined();
            expect(Math.abs(next.anchor.x - previous.anchor.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(next.anchor.y - previous.anchor.y)).toBeLessThanOrEqual(1);
            expect(Math.abs(next.bodyBob - previous.bodyBob)).toBeLessThanOrEqual(1);
            previous = next;
          }
        }
  });

  it('keeps a grounded object behind the resident while they turn away', () => {
    const ground = matrixContext();
    drawGroundErrandItem(ground.ctx, 'thermos', 0, 0);
    const colors = new Set(boxes(ground).map((box) => box.color));
    for (const facing of FACINGS)
      for (const [phase, progress] of [
        ['pickup', 0],
        ['dropoff', 1],
      ] as const) {
        const r = matrixContext();
        drawResident(
          r.ctx,
          { ...person, figure: 'male' },
          0,
          0,
          1,
          state(sample('thermos', phase, progress), facing),
        );
        const torso = r.calls.findIndex(
          (call) =>
            call.name === 'fillRect' &&
            call.fillStyle === person.outfit &&
            call.args[2] === 7 &&
            call.args[3] === 9,
        );
        const prop = r.calls.reduce(
          (last, call, index) =>
            call.name === 'fillRect' && colors.has(call.fillStyle as string) ? index : last,
          -1,
        );
        expect(prop).toBeGreaterThan(0);
        expect(prop).toBeLessThan(torso);
      }
  });

  it('keeps both hands attached to the carrier while it is lifted and carried', () => {
    for (const kind of KINDS)
      for (const facing of FACINGS)
        for (const figure of ['male', 'female'] as const)
          for (const phase of ['pickup', 'carrying', 'dropoff'] as const)
            for (const progress of [0.25, 0.5, 0.75]) {
              const errand = sample(kind, phase, progress);
              const r = matrixContext();
              drawResident(r.ctx, { ...person, figure }, 0, 0, 1, state(errand, facing, 0.25));
              const pose = errandItemPose(errand, facing, 0.25, phase === 'carrying')!;
              const mirror = facing === 'sw' || facing === 'nw' ? -1 : 1;
              const hands = boxes(r).filter((box) => box.color === person.skin);
              for (const grip of [pose.farGrip, pose.nearGrip]) {
                const x = grip.x * mirror;
                expect(
                  hands.some(
                    (box) => box.x0 <= x && box.x1 >= x && box.y0 <= grip.y && box.y1 >= grip.y,
                  ),
                  `${kind} ${facing} ${phase}`,
                ).toBe(true);
              }
            }
  });

  it('leaves the resident unburdened on the way there and home', () => {
    for (const phase of ['outbound', 'returning'] as const)
      for (const kind of KINDS)
        expect(errandItemPose(sample(kind, phase, 0.5), 'se')).toBeUndefined();
  });
});

describe('Seasonal errand figures', () => {
  it(
    'fits existing resident culling and fade bounds in every direction and phase',
    () => {
      const check = matrixContext();
      const reach = residentReach(check.ctx, person);
      for (const figure of ['male', 'female'] as const)
        for (const kind of KINDS)
          for (const facing of FACINGS)
            for (const phase of PHASES)
              for (const progress of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1])
                for (const walkPhase of [0, 0.25, 0.5, 0.75]) {
                  const r = matrixContext();
                  drawResident(
                    r.ctx,
                    { ...person, figure },
                    0,
                    0,
                    1,
                    state(sample(kind, phase, progress), facing, walkPhase),
                  );
                  expect(r.matrix()).toEqual([1, 0, 0, 1, 0, 0]);
                  for (const box of boxes(r)) {
                    expect(Number.isFinite(box.x0 + box.x1 + box.y0 + box.y1)).toBe(true);
                    expect(box.x0).toBeGreaterThanOrEqual(-reach.x);
                    expect(box.x1).toBeLessThanOrEqual(reach.x);
                    expect(box.y0).toBeGreaterThanOrEqual(-reach.above);
                    expect(box.y1).toBeLessThanOrEqual(reach.below);
                  }
                }
    },
    rosterTimeout(190, 45_000),
  );

  it('keeps the carrier’s eyes clear, and the load past the near shoulder walking away', () => {
    for (const kind of KINDS) {
      const ground = matrixContext();
      drawGroundErrandItem(ground.ctx, kind, 0, 0, false, 1);
      const colors = new Set(boxes(ground).map((box) => box.color));
      for (const figure of ['male', 'female'] as const)
        for (const facing of FACINGS)
          for (const walkPhase of [0, 0.25, 0.5, 0.75]) {
            const errand = sample(kind, 'carrying', 0.5);
            const r = matrixContext();
            drawResident(r.ctx, { ...person, figure }, 0, 0, 1, state(errand, facing, walkPhase));
            const { bodyBob } = errandItemPose(errand, facing, walkPhase, true)!;
            const mirror = facing === 'sw' || facing === 'nw' ? -1 : 1;
            const load = boxes(r).filter((box) => colors.has(box.color));
            const where = `${kind} ${figure} ${facing} ${walkPhase}`;
            if (facing === 'se' || facing === 'sw')
              // The eyes are the pixels at x = 1 and 3, 18px up, riding the body's bob.
              for (const eye of [1.5, 3.5]) {
                const x = eye * mirror,
                  y = -17.5 + bodyBob;
                const covered = load.some(
                  (box) => box.x0 <= x && box.x1 >= x && box.y0 <= y && box.y1 >= y,
                );
                expect(covered, where).toBe(false);
              }
            else {
              // The body ends at x = 4: at least eight of the object's 11 columns show beyond it.
              const reach = Math.max(...load.map((box) => (mirror > 0 ? box.x1 : -box.x0)));
              expect(reach, where).toBeGreaterThanOrEqual(12);
            }
          }
    }
  });

  it('darkens every carried material at night with unchanged geometry', () => {
    for (const kind of KINDS)
      for (const facing of FACINGS) {
        const byDay = matrixContext(),
          byNight = matrixContext();
        const s = state(sample(kind, 'carrying', 0.5), facing, 0.25);
        drawResident(byDay.ctx, person, 0, 0, 1, s);
        drawResident(byNight.ctx, person, 0, 0, 1, s, { night: true });
        const expected = boxes(byDay).map(({ color, ...box }) => ({
          ...box,
          color: tint(color, NIGHT_DIM),
        }));
        expect(boxes(byNight)).toEqual(expected);
      }
  });

  it('does not advance while a paused town repeatedly paints the same snapshot', () => {
    for (const kind of KINDS) {
      const a = matrixContext(),
        b = matrixContext();
      const s = state(sample(kind, 'pickup', 0.35), 'ne');
      drawResident(a.ctx, person, 0, 0, 1, s);
      drawResident(b.ctx, person, 0, 0, 1, s);
      expect(a.calls).toEqual(b.calls);
    }
  });
});
