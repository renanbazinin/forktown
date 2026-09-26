import { ZOO_SLEEP, type ZooAction, type ZooAnimal, type ZooAnimalState } from '../lib/zoo';
import { project } from '../lib/world';

// The zoo's animals, drawn side-on at the animal's feet and flipped to face their way. Every pose
// comes from ZooAnimalState, so one state always paints one picture.
type Ctx = CanvasRenderingContext2D;
type Palette = Record<string, string>;
const round = Math.round;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// Day colours and their moonlit twins: the same shapes, cooler and dimmer, never amber.
const PALETTES: Record<ZooAnimal, { day: Palette; night: Palette }> = {
  elephant: {
    day: {
      skin: '#A3AEAB',
      light: '#B9C2BD',
      shade: '#8C9A98',
      far: '#84928F',
      ear: '#95A2A0',
      inner: '#BBA9A4',
      tusk: '#EFE6CD',
      nail: '#DDD5C0',
      eye: '#26332E',
      tuft: '#4D5955',
    },
    night: {
      skin: '#7E8F98',
      light: '#91A2AA',
      shade: '#6C7D87',
      far: '#63747F',
      ear: '#728590',
      inner: '#8D93A0',
      tusk: '#C8D2D4',
      nail: '#A9B6BC',
      eye: '#1B2429',
      tuft: '#3E4A52',
    },
  },
  giraffe: {
    day: {
      fur: '#DEBB6B',
      far: '#C6A25A',
      patch: '#A66F3D',
      low: '#E9D5A0',
      farLow: '#D2BC89',
      hoof: '#4B3A2B',
      mane: '#8E5E34',
      horn: '#7B5433',
      muzzle: '#E8CF95',
      eye: '#27332D',
    },
    night: {
      fur: '#ACA287',
      far: '#928A76',
      patch: '#75685A',
      low: '#B8BBAA',
      farLow: '#9FA294',
      hoof: '#343A3D',
      mane: '#5E5B52',
      horn: '#55534C',
      muzzle: '#B4AF9A',
      eye: '#1B2429',
    },
  },
  zebra: {
    day: {
      coat: '#F1EFE2',
      far: '#D0CFC2',
      stripe: '#323E39',
      farStripe: '#4B5752',
      muzzle: '#2B3531',
      eye: '#1B2622',
    },
    night: {
      coat: '#B9C5C7',
      far: '#9AA7AC',
      stripe: '#27333A',
      farStripe: '#3A4750',
      muzzle: '#222D33',
      eye: '#121A1E',
    },
  },
  penguin: {
    day: {
      back: '#34474F',
      flipper: '#28393F',
      belly: '#F3F1E2',
      beak: '#E2884A',
      feet: '#E89C5C',
      eye: '#151F1D',
    },
    night: {
      back: '#2A3A45',
      flipper: '#21303A',
      belly: '#C3CFD3',
      beak: '#A6958E',
      feet: '#A89990',
      eye: '#0F171B',
    },
  },
};
const SHADOWS: Record<ZooAnimal, { x: number; rx: number; ry: number }> = {
  elephant: { x: 3, rx: 28, ry: 6 },
  giraffe: { x: 0, rx: 19, ry: 5 },
  zebra: { x: -1, rx: 17, ry: 5 },
  penguin: { x: 0, rx: 10, ry: 3.5 },
};

/**
 * The diagonal walk: the near fore and far hind leg swing together, the other pair opposite, and
 * whichever pair reaches forward is lifted off the ground. Planted when the animal stands.
 */
function stride(a: ZooAnimalState, reach: number, raise: number) {
  const s = a.moving ? a.step : 0;
  return {
    swing: s * reach,
    lift: Math.max(0, s) * raise,
    counter: Math.max(0, -s) * raise,
    bob: a.moving ? round(Math.abs(s)) : 0,
  };
}

// How far each walker's body sinks as it folds its legs to lie down or get up.
const FOLD: Record<ZooAnimal, number> = { elephant: 9, giraffe: 30, zebra: 12, penguin: 0 };
// The fold in effect for the sprite being drawn; the body is shifted down by it, so the ground
// sits at y = -fold in the body's own coordinates.
let fold = 0;

// A leg: the thigh stays at the hip while the shin and hoof swing and lift with the stride.
function leg(
  ctx: Ctx,
  x: number,
  hip: number,
  w: number,
  swing: number,
  lift: number,
  upper: string,
  lower: string,
  hoof: string,
  hoofH: number,
) {
  if (fold) {
    // Kneeling: a short thigh stands on the shin folded flat along the ground.
    const ground = -fold;
    if (ground - 2 > hip) box(ctx, x, hip, w, ground - 2 - hip, upper);
    box(ctx, x, ground - 2, w + 3, 2, lower);
    return;
  }
  const knee = round(hip * 0.45);
  const foot = x + round(swing);
  const raised = round(lift);
  box(ctx, x + round(swing * 0.35), hip, w, knee - hip + 1, upper);
  box(ctx, foot, knee, w, -raised - hoofH - knee, lower);
  if (hoofH) box(ctx, foot, -raised - hoofH, w, hoofH, hoof);
}

// Face on: both ears fanned out, the trunk hanging down the middle between two tusks.
function elephantFace(ctx: Ctx, a: ZooAnimalState, c: Palette, h: number) {
  const ew = 9 + round(a.ear * 4),
    top = -43 + h - round(a.ear * 2);
  box(ctx, 16 - ew, top, ew, 15, c.ear);
  box(ctx, 17 - ew, top + 15, ew - 3, 4, c.ear);
  box(ctx, 17 - ew, top + 2, ew - 3, 11, c.inner);
  box(ctx, 28, top, ew, 15, c.ear);
  box(ctx, 30, top + 15, ew - 3, 4, c.ear);
  box(ctx, 30, top + 2, ew - 3, 11, c.inner);
  box(ctx, 17, -47 + h, 10, 2, c.skin);
  box(ctx, 15, -45 + h, 14, 15, c.skin);
  box(ctx, 18, -47 + h, 7, 1, c.light);
  const sw = round(a.tail);
  box(ctx, 19, -30 + h, 6, 9, c.skin);
  box(ctx, 20, -21 + h, 5, 9, c.skin);
  box(ctx, 20 + sw, -12 + h, 4, 7, c.skin);
  box(ctx, 19 + sw * 2, -6 + h, 5, 2, c.skin);
  box(ctx, 20, -24 + h, 4, 1, c.shade);
  box(ctx, 21 + sw, -10 + h, 3, 1, c.shade);
  box(ctx, 17, -30 + h, 2, 3, c.tusk);
  box(ctx, 16, -27 + h, 2, 2, c.tusk);
  box(ctx, 25, -30 + h, 2, 3, c.tusk);
  box(ctx, 26, -27 + h, 2, 2, c.tusk);
  const eyeH = a.blink ? 1 : 2;
  box(ctx, 17, -38 + h + (2 - eyeH), 2, eyeH, c.eye);
  box(ctx, 25, -38 + h + (2 - eyeH), 2, eyeH, c.eye);
}

function drawElephant(
  ctx: Ctx,
  a: ZooAnimalState,
  c: Palette,
  phase: ZooAction | undefined,
  elapsed: number,
  progress: number,
) {
  const g = stride(a, 2, 1);
  const b = g.bob;
  // Far legs in shade, then the barrel with its stepped back, then the near legs over the belly.
  leg(ctx, -15, -16, 8, g.swing, g.lift, c.far, c.far, c.far, 0);
  leg(ctx, 8, -16, 8, -g.swing, g.counter, c.far, c.far, c.far, 0);
  box(ctx, -23, -33 + b, 38, 21, c.skin);
  box(ctx, -19, -37 + b, 31, 4, c.skin);
  box(ctx, -13, -39 + b, 18, 2, c.skin);
  box(ctx, -26, -30 + b, 3, 14, c.skin);
  box(ctx, -12, -39 + b, 13, 1, c.light);
  box(ctx, -19, -15 + b, 31, 3, c.shade);
  box(ctx, -4, -29 + b, 1, 9, c.shade);
  const t = round(a.tail * 2);
  box(ctx, -28, -31 + b, 2, 8, c.skin);
  box(ctx, -28 - t, -24 + b, 2, 6, c.skin);
  box(ctx, -29 - round(a.tail * 3), -19 + b, 3, 3, c.tuft);
  leg(ctx, -20, -17, 9, -g.swing, g.counter, c.skin, c.skin, c.skin, 0);
  leg(ctx, 3, -17, 9, g.swing, g.lift, c.skin, c.skin, c.skin, 0);
  if (!fold) {
    box(ctx, -18 - round(g.swing), -2 - round(g.counter), 2, 2, c.nail);
    box(ctx, 7 + round(g.swing), -2 - round(g.lift), 2, 2, c.nail);
  }

  // The head drops a little to forage; the trunk follows a curve from the face to its tip.
  const h = b + round(a.graze * 4);
  const turn = a.look;
  const trunkShow = phase === 'drink' || phase === 'raise-trunk' || phase === 'spray';
  if (turn > 0.45 && !trunkShow && phase !== 'lower-trunk') {
    elephantFace(ctx, a, c, h);
    return;
  }
  box(ctx, 15, -45 + h, 11, 2, c.skin);
  box(ctx, 13, -43 + h, 16, 3, c.skin);
  box(ctx, 12, -40 + h, 21 - round(Math.max(0, turn) * 2), 14, c.skin);
  box(ctx, 14, -26 + h, 16, 4, c.skin);
  box(ctx, 16, -45 + h, 8, 1, c.light);
  // The trunk hangs from the face: `angle` swings its tip from straight down (pi) through forward
  // to up and back over the head, and the curve bulges between the two.
  // Turning toward the viewer only swings the tip a little forward; the trunk keeps hanging.
  const sway = (a.moving ? a.step : a.tail) * 0.06;
  const sniff = Math.max(0, turn);
  let angle = 2.95 - sway - a.graze * 0.45 - sniff * 0.6,
    length = 25 + a.graze * 3 - sniff * 2 - fold * 1.2;
  const rest = { angle, length };
  if (phase === 'drink') {
    const q = Math.min(1, progress * 3);
    angle += (3 - angle) * q;
    length += (38 - length) * q;
  }
  const up = { angle: -0.35, length: 36 };
  if (phase === 'raise-trunk') {
    const q = progress * progress * (3 - 2 * progress);
    angle = 3 + (up.angle - 3) * q;
    length = (38 + (up.length - 38) * q) * (1 - 0.25 * Math.sin(q * Math.PI));
  }
  if (phase === 'spray') ({ angle, length } = up);
  if (phase === 'lower-trunk') {
    angle = up.angle + (rest.angle - up.angle) * progress;
    length =
      (up.length + (rest.length - up.length) * progress) *
      (1 - 0.25 * Math.sin(progress * Math.PI));
  }
  const base = { x: 31 - sniff * 2, y: -27 + h };
  const tip = {
    x: base.x + Math.sin(angle) * length,
    y: base.y - Math.cos(angle) * length,
  };
  const middle = (angle + Math.PI / 2) / 2 + 0.4 * Math.max(0, 1 - Math.abs(angle - 1.3) / 1.5);
  const bend = {
    x: base.x + Math.sin(middle) * length * 0.55,
    y: base.y - Math.cos(middle) * length * 0.55,
  };
  for (let i = 0; i <= 7; i++) {
    const q = i / 7;
    const x = (1 - q) ** 2 * base.x + 2 * (1 - q) * q * bend.x + q * q * tip.x;
    const y = (1 - q) ** 2 * base.y + 2 * (1 - q) * q * bend.y + q * q * tip.y;
    const w = 7 - q * 3;
    box(ctx, round(x - w / 2), round(y - w / 2), round(w), round(w) + 1, c.skin);
  }
  // A little upturned curl at the tip while it hangs.
  if (angle > 2.2) box(ctx, round(tip.x), round(tip.y) - 3, 3, 3, c.skin);
  if (phase === 'spray') {
    for (let i = 0; i < 20; i++) {
      const q = (elapsed * 0.9 + i / 20) % 1;
      const x = tip.x - q * 90 + Math.sin(i * 3) * q * 8;
      const y = tip.y - Math.sin(q * Math.PI) * 38 + q * q * 62;
      ctx.globalAlpha = Math.min(1, elapsed * 3) * (1 - q * 0.6) * Math.min(1, (5 - elapsed) * 2);
      box(ctx, round(x), round(y), i % 3 === 0 ? 4 : 3, 3, i % 2 ? '#A9DCE5' : '#E1F6EF');
    }
    ctx.globalAlpha = 1;
  }
  box(ctx, 27, -24 + h, 6, 2, c.tusk);
  box(ctx, 32, -26 + h, 2, 2, c.tusk);
  // The ear fans back from its front edge as it flaps; turned away, it covers more of the head.
  const ear = round(a.ear * 6 + Math.max(0, -turn) * 3);
  const w = 13 + ear;
  const x0 = 23 - w,
    top = -41 + h - round(a.ear * 2);
  box(ctx, x0 + 2, top, w - 3, 2, c.ear);
  box(ctx, x0, top + 2, w, 14, c.ear);
  box(ctx, x0 + 1, top + 16, w - 3, 4, c.ear);
  box(ctx, x0 + 3, top + 20, w - 8, 3, c.ear);
  box(ctx, x0 + 2, top + 3, w - 5, 12, c.inner);
  if (turn > -0.45) {
    if (phase === 'spray') box(ctx, 24, -33 + h, 4, 1, c.eye);
    else box(ctx, 25, -34 + h + (a.blink ? 1 : 0), 2, a.blink ? 1 : 2, c.eye);
  }
}

// Head rules shared by the giraffe and zebra: profile, face-on (toward the viewer) or turned away.
function headView(look: number) {
  return look > 0.45 ? 'front' : look < -0.45 ? 'away' : 'side';
}

function drawGiraffe(
  ctx: Ctx,
  a: ZooAnimalState,
  c: Palette,
  phase: ZooAction | undefined,
  elapsed: number,
  night: boolean,
) {
  const g = stride(a, 4, 2);
  const b = g.bob;
  leg(ctx, -10, -37, 3, g.swing, g.lift, c.far, c.farLow, c.hoof, 2);
  leg(ctx, 12, -37, 3, -g.swing, g.counter, c.far, c.farLow, c.hoof, 2);
  // A sloping back: the withers stand well above the rump.
  box(ctx, -16, -49 + b, 31, 13, c.fur);
  box(ctx, -1, -53 + b, 17, 4, c.fur);
  box(ctx, -10, -51 + b, 9, 2, c.fur);
  box(ctx, -18, -47 + b, 2, 8, c.fur);
  box(ctx, -11, -36 + b, 21, 2, c.fur);
  for (const [x, y, w, h] of [
    [-14, -47, 5, 4],
    [-6, -49, 6, 4],
    [3, -51, 6, 4],
    [-10, -42, 5, 4],
    [-1, -44, 6, 5],
    [8, -46, 5, 5],
  ])
    box(ctx, x, y + b, w, h, c.patch);
  box(ctx, -19, -47 + b, 1, 6, c.fur);
  box(ctx, -19 - round(a.tail * 2), -41 + b, 1, 6, c.fur);
  box(ctx, -20 - round(a.tail * 3), -36 + b, 3, 4, c.mane);
  leg(ctx, -14, -38, 3, -g.swing, g.counter, c.fur, c.low, c.hoof, 2);
  leg(ctx, 9, -38, 3, g.swing, g.lift, c.fur, c.low, c.hoof, 2);

  // The neck leans forward from the withers and reaches up to stretch; a full stretch lifts the
  // head into the top of the acacia's crown. Grazing is browsing at head height: the neck stays
  // up and the muzzle dips forward to nibble, bobbing as it chews.
  const reach = clamp(a.stretch / 23);
  const length = 30 + a.stretch * 0.45;
  const neck = 0.34 - reach * 0.22 + a.graze * 0.12;
  const nibble =
    phase === 'nibble'
      ? Math.sin(elapsed * 7) * 0.12
      : a.graze * (0.85 + Math.sin(a.sleepPhase * 9) * 0.12);
  ctx.save();
  ctx.translate(11, -50 + b);
  ctx.rotate(neck);
  box(ctx, -4, -length, 8, length + 3, c.fur);
  box(ctx, -5, 3 - length, 2, length - 4, c.mane);
  for (let i = 0; i < 2; i++) box(ctx, -2 + i, round(-8 - (i * (length - 8)) / 2), 4, 5, c.patch);
  ctx.translate(0, -length);
  const view = headView(a.look);
  const eyeH = a.blink ? 1 : 2;
  if (view === 'front') {
    ctx.rotate(-neck);
    box(ctx, -4, -9, 9, 10, c.fur);
    box(ctx, -3, 1, 7, 4, c.muzzle);
    box(ctx, -3, -14, 2, 5, c.horn);
    box(ctx, 2, -14, 2, 5, c.horn);
    box(ctx, -8, -8 - round(a.ear * 2), 4, 2, c.fur);
    box(ctx, 5, -8 - round(a.ear * 2), 4, 2, c.fur);
    box(ctx, -4, -6 + (2 - eyeH), 2, eyeH, c.eye);
    box(ctx, 3, -6 + (2 - eyeH), 2, eyeH, c.eye);
  } else {
    ctx.rotate(0.4 - reach * 0.55 + nibble - neck);
    const long = view === 'away' ? 3 : 0;
    box(ctx, -3, -6, 11 - long, 7, c.fur);
    box(ctx, 8 - long, -4, 6 - long, 5, c.muzzle);
    box(ctx, -1, -11, 2, 5, c.horn);
    box(ctx, 3, -12, 2, 6, c.horn);
    box(ctx, -6, -5 - round(a.ear * 2), 4, 2, c.fur);
    if (view === 'side') box(ctx, 3, -4 + (2 - eyeH), 2, eyeH, c.eye);
    if (phase === 'nibble') box(ctx, 12, 0, 7, 3, night ? '#5E8468' : '#76A956');
  }
  ctx.restore();
  if (phase === 'nibble') {
    // Leaves flutter down from the nibbling mouth.
    const mouth = { x: 11 + Math.sin(neck) * length + 10, y: -50 - Math.cos(neck) * length };
    for (let i = 0; i < 4; i++) {
      const q = (elapsed / 2 + i / 4) % 1;
      ctx.globalAlpha = 1 - q;
      box(
        ctx,
        round(mouth.x + Math.sin(q * 9 + i) * 10),
        round(mouth.y + q * 60),
        4,
        3,
        night ? '#5E8468' : '#7DA758',
      );
    }
    ctx.globalAlpha = 1;
  }
}

function drawZebra(ctx: Ctx, a: ZooAnimalState, c: Palette, phase: ZooAction | undefined) {
  const run = phase === 'run';
  const g = stride(a, run ? 6 : 3, run ? 3 : 1.5);
  const b = g.bob;
  // At a gallop both forelegs reach forward while both hind legs push back, then they gather.
  const fore = run ? g.swing : -g.swing,
    hind = run ? -g.swing : g.swing;
  const skid = phase === 'skid' ? 4 : 0;
  const stripeLeg = (x: number, swing: number, lift: number) => {
    leg(ctx, x, -17, 3, swing, lift, c.coat, c.coat, c.stripe, 2);
    if (fold) return;
    box(ctx, x + round(swing * 0.35), -14, 3, 2, c.stripe);
    box(ctx, x + round(swing), -7 - round(lift), 3, 2, c.stripe);
  };
  // The far legs sit in shade, a plain grey.
  leg(ctx, -9, -17, 3, hind, run ? g.counter : g.lift, c.far, c.far, c.farStripe, 2);
  leg(
    ctx,
    11 + skid,
    -17,
    3,
    run ? fore * 0.7 : fore,
    run ? g.lift : g.counter,
    c.far,
    c.far,
    c.farStripe,
    2,
  );
  box(ctx, -14, -30 + b, 26, 14, c.coat);
  box(ctx, -11, -31 + b, 20, 1, c.coat);
  box(ctx, -16, -28 + b, 2, 10, c.coat);
  box(ctx, -10, -16 + b, 18, 2, c.coat);
  for (const [x, y, w, h] of [
    [-7, -30, 2, 12],
    [-3, -31, 2, 14],
    [1, -31, 2, 13],
    [5, -30, 2, 11],
    [-16, -26, 6, 2],
    [-15, -22, 5, 2],
  ])
    box(ctx, x, y + b, w, h, c.stripe);
  if (run) {
    box(ctx, -21, -29 + b, 5, 1, c.coat);
    box(ctx, -24, -30 + b, 3, 2, c.stripe);
  } else {
    box(ctx, -17, -28 + b, 1, 5, c.coat);
    box(ctx, -17 - round(a.tail * 2), -23 + b, 1, 5, c.coat);
    box(ctx, -18 - round(a.tail * 3), -19 + b, 2, 4, c.stripe);
  }
  stripeLeg(-12, run ? hind * 0.7 : -hind, g.counter);
  stripeLeg(8 + skid, fore, g.lift);

  // Neck and head: the neck bows right down to graze and stretches forward at a gallop.
  const length = 13 + round(a.graze * 3);
  const neck = run ? 1.05 : 0.6 + a.graze * 1.75;
  ctx.save();
  ctx.translate(9, -29 + b);
  ctx.rotate(neck);
  box(ctx, -4, -length, 8, length + 4, c.coat);
  box(ctx, -5, -length - 2, 2, length + 2, c.stripe);
  box(ctx, -5, 1 - length, 2, 1, c.coat);
  box(ctx, -5, 5 - length, 2, 1, c.coat);
  for (let y = 3 - length; y < 0; y += 4) box(ctx, -3, y, 7, 2, c.stripe);
  ctx.translate(0, -length);
  const view = headView(a.look);
  const eyeH = a.blink ? 1 : 2;
  if (view === 'front') {
    ctx.rotate(-neck);
    box(ctx, -4, -7, 8, 10, c.coat);
    box(ctx, -3, -5, 6, 1, c.stripe);
    box(ctx, -3, -2, 6, 1, c.stripe);
    box(ctx, -3, 3, 6, 4, c.muzzle);
    box(ctx, -7, -9 - round(a.ear * 2), 3, 4, c.coat);
    box(ctx, 4, -9 - round(a.ear * 2), 3, 4, c.coat);
    box(ctx, -5, -4 + (2 - eyeH), 2, eyeH, c.eye);
    box(ctx, 3, -4 + (2 - eyeH), 2, eyeH, c.eye);
  } else {
    ctx.rotate((run ? 0.35 : 0.55 + a.graze * 1) - neck);
    const long = view === 'away' ? 3 : 0;
    box(ctx, -3, -5, 10 - long, 7, c.coat);
    box(ctx, -1, -5, 7 - long, 1, c.stripe);
    box(ctx, -1, -1, 7 - long, 1, c.stripe);
    box(ctx, 7 - long, -4, 4, 6, c.muzzle);
    if (run) box(ctx, -7, -6, 5, 2, c.coat);
    else box(ctx, -3, -9 - round(a.ear * 2), 3, 4, c.coat);
    if (view === 'side') box(ctx, 2, -3 + (2 - eyeH), 2, eyeH, c.eye);
  }
  ctx.restore();
}

function drawPenguin(ctx: Ctx, a: ZooAnimalState, c: Palette, phase: ZooAction | undefined) {
  // Swimming laps always lie flat, whatever the easing in and out of the water says.
  const swim = phase === 'swim' ? 1 : a.swim;
  // The water only takes the penguin once it comes down: a diver in the air is never cut off.
  const contact = clamp(1 - a.lift / 6);
  if (contact && (a.submerged > 0 || swim > 0)) {
    // The water line: everything below the surface, `lift` under the feet point, is hidden.
    ctx.beginPath();
    ctx.rect(-40, -70, 80, 70 + round(a.lift));
    ctx.clip();
  }
  const sink = round((a.submerged * (20 - swim * 15) + swim * 10) * contact);
  if (sink) ctx.translate(0, sink);
  const squash = Math.max(0, -a.stretch) * 0.045;
  if (squash) ctx.scale(1 + squash, 1 - squash);
  const s = a.moving ? a.step : 0;
  // A waddle: the little body rocks from foot to foot.
  if (s && !swim) ctx.rotate(s * 0.1);
  if (swim) {
    ctx.translate(0, -11);
    ctx.rotate(swim * Math.PI * 0.5);
    ctx.translate(0, 11);
  }
  if (swim < 0.6) {
    box(ctx, -6, -2 - round(Math.max(0, -s) * 2), 5, 3, c.feet);
    box(ctx, 2, -2 - round(Math.max(0, s) * 2), 6, 3, c.feet);
  }
  // A pear-shaped little body: sloped shoulders, the tummy fullest low down, a rounded bottom,
  // and the white front as an oval set in from the dark edge.
  box(ctx, -5, -22, 11, 3, c.back);
  box(ctx, -6, -19, 13, 3, c.back);
  box(ctx, -7, -16, 15, 2, c.back);
  box(ctx, -8, -14, 17, 8, c.back);
  box(ctx, -7, -6, 15, 2, c.back);
  box(ctx, -5, -4, 11, 2, c.back);
  box(ctx, -3, -2, 7, 1, c.back);
  box(ctx, -8, -13, 1, 6, c.flipper);
  box(ctx, 1, -20, 3, 2, c.belly);
  box(ctx, 0, -18, 5, 3, c.belly);
  box(ctx, -1, -15, 8, 9, c.belly);
  box(ctx, 0, -6, 6, 2, c.belly);
  box(ctx, 1, -4, 3, 1, c.belly);
  // Flippers fan out with `ear`, sweep back to dive and spread wide to swim.
  const flap =
    phase === 'dive' || phase === 'crouch'
      ? 1.2
      : swim > 0.5
        ? -0.3 + a.ear * 0.6
        : phase === 'hop-out'
          ? 1.1
          : a.ear * 1;
  if (flap) {
    ctx.save();
    ctx.translate(-3, -19);
    ctx.rotate(flap);
    box(ctx, -2, 0, 3, 10, c.flipper);
    ctx.restore();
  } else box(ctx, -5, -19, 3, 10, c.flipper);
  // The head stays level while the body lies down in the water.
  ctx.translate(0, -22);
  if (swim) {
    ctx.rotate(-swim * Math.PI * 0.42);
    ctx.translate(0, -round(swim * 3));
  }
  const eyeH = a.blink ? 1 : 2;
  box(ctx, -3, -10, 7, 1, c.back);
  box(ctx, -4, -9, 9, 2, c.back);
  box(ctx, -5, -7, 10, 6, c.back);
  box(ctx, -4, -1, 9, 2, c.back);
  if (a.look > 0.45) {
    // Face on: both eyes, both white patches, the beak pointing at the viewer.
    box(ctx, -4, -7, 3, 2, c.belly);
    box(ctx, 1, -7, 3, 2, c.belly);
    box(ctx, -3, -5 + (2 - eyeH), 2, eyeH, c.eye);
    box(ctx, 1, -5 + (2 - eyeH), 2, eyeH, c.eye);
    box(ctx, -1, -3, 3, 3, c.beak);
  } else if (a.look < -0.45) {
    // Turned away: just the back of the head and the far eye patch.
    box(ctx, -4, -7, 3, 2, c.belly);
  } else {
    box(ctx, -1, -8, 3, 2, c.belly);
    box(ctx, 1, -5 + (2 - eyeH), 2, eyeH, c.eye);
    box(ctx, 5, -5, 5, 2, c.beak);
    box(ctx, 5, -3, 3, 1, c.beak);
    box(ctx, 1, -2, 4, 2, c.belly);
  }
}

// Lying poses: legs folded, head tucked or resting.
function drawLying(ctx: Ctx, a: ZooAnimalState, c: Palette) {
  ctx.save();
  ctx.scale(1, 1 + Math.sin(a.sleepPhase) * 0.025);
  if (a.species === 'penguin') {
    // Settled on its belly like a loaf, feet tucked, beak buried in the shoulder.
    box(ctx, 3, -2, 5, 2, c.feet);
    box(ctx, -6, -19, 13, 2, c.back);
    box(ctx, -8, -17, 17, 3, c.back);
    box(ctx, -9, -14, 19, 9, c.back);
    box(ctx, -7, -5, 15, 3, c.back);
    box(ctx, -4, -2, 8, 1, c.back);
    box(ctx, 2, -13, 6, 9, c.belly);
    box(ctx, 3, -15, 4, 2, c.belly);
    box(ctx, -8, -12, 6, 7, c.flipper);
    box(ctx, -4, -24, 9, 5, c.back);
    box(ctx, -3, -25, 7, 1, c.back);
    box(ctx, -1, -23, 3, 1, c.belly);
    box(ctx, 1, -21, 3, 1, c.eye);
  } else if (a.species === 'elephant') {
    box(ctx, -20, -5, 13, 5, c.far);
    box(ctx, -24, -27, 40, 22, c.skin);
    box(ctx, -19, -30, 30, 3, c.skin);
    box(ctx, -27, -24, 3, 14, c.skin);
    box(ctx, -12, -30, 14, 1, c.light);
    box(ctx, -22, -7, 36, 3, c.shade);
    box(ctx, 8, -5, 20, 5, c.skin);
    box(ctx, 23, -2, 2, 2, c.nail);
    box(ctx, 26, -2, 2, 2, c.nail);
    box(ctx, 12, -31, 18, 20, c.skin);
    box(ctx, 30, -27, 4, 11, c.skin);
    box(ctx, 31, -16, 6, 12, c.skin);
    box(ctx, 34, -6, 8, 5, c.skin);
    box(ctx, 40, -9, 3, 4, c.skin);
    box(ctx, 28, -15, 6, 2, c.tusk);
    box(ctx, 8, -31, 14, 19, c.ear);
    box(ctx, 10, -28, 9, 13, c.inner);
    box(ctx, 24, -24, 4, 1, c.eye);
    box(ctx, -30, -9, 6, 2, c.skin);
  } else if (a.species === 'giraffe') {
    box(ctx, -12, -4, 11, 4, c.far);
    box(ctx, 5, -4, 14, 4, c.fur);
    box(ctx, 17, -3, 3, 3, c.hoof);
    box(ctx, -17, -18, 31, 14, c.fur);
    box(ctx, -1, -21, 15, 3, c.fur);
    box(ctx, -19, -16, 2, 10, c.fur);
    for (const [x, y] of [
      [-14, -16],
      [-7, -17],
      [0, -18],
      [7, -16],
      [-10, -10],
      [-3, -11],
      [4, -10],
    ])
      box(ctx, x, y, 5, 4, c.patch);
    // Dozing with the neck still up and the head bowed: the tall neck is what reads as a giraffe
    // from across the town, where a neck curled onto the back looked like a spotted sack.
    box(ctx, 6, -27, 8, 8, c.fur);
    box(ctx, 7, -35, 7, 9, c.fur);
    box(ctx, 8, -43, 7, 9, c.fur);
    box(ctx, 5, -34, 2, 11, c.mane);
    box(ctx, 6, -42, 2, 8, c.mane);
    box(ctx, 9, -32, 4, 4, c.patch);
    box(ctx, 10, -40, 3, 3, c.patch);
    box(ctx, 11, -47, 9, 6, c.fur);
    box(ctx, 17, -43, 5, 5, c.muzzle);
    box(ctx, 11, -51, 2, 4, c.horn);
    box(ctx, 14, -52, 2, 5, c.horn);
    box(ctx, 7, -46, 4, 2, c.fur);
    box(ctx, 14, -44, 3, 1, c.eye);
    box(ctx, -24, -10, 5, 2, c.mane);
  } else {
    box(ctx, -12, -4, 11, 4, c.far);
    box(ctx, 3, -4, 12, 4, c.coat);
    box(ctx, 13, -3, 3, 3, c.stripe);
    box(ctx, -15, -18, 27, 14, c.coat);
    box(ctx, -17, -16, 2, 9, c.coat);
    for (const x of [-7, -3, 1, 5, 9]) box(ctx, x, -18, 2, 11, c.stripe);
    box(ctx, -17, -14, 5, 2, c.stripe);
    // Neck laid forward, muzzle resting on the grass.
    box(ctx, 10, -20, 8, 11, c.coat);
    box(ctx, 9, -22, 8, 2, c.stripe);
    box(ctx, 12, -17, 5, 2, c.stripe);
    box(ctx, 15, -10, 10, 7, c.coat);
    box(ctx, 16, -8, 8, 1, c.stripe);
    box(ctx, 24, -9, 4, 6, c.muzzle);
    box(ctx, 14, -13, 3, 3, c.coat);
    box(ctx, 18, -6, 3, 1, c.eye);
    box(ctx, -21, -6, 5, 2, c.stripe);
  }
  ctx.restore();
}

// The drifting z's: only once the animal is asleep, faded in as it drops off and out just before
// it wakes. They undo the facing flip so the letters always read the right way round.
function drawZs(ctx: Ctx, a: ZooAnimalState, night: boolean) {
  const index = a.id.charCodeAt(a.id.length - 1) - 48;
  // A huddle breathes a few z's between them rather than a column per penguin.
  if (a.species === 'penguin' && index % 3) return;
  // sleepPhase runs with the clock, so it also tells how long the animal has been asleep.
  const minute = ((((a.sleepPhase - index * 1.7) / 0.9) % 1440) + 1440) % 1440;
  // (A little slack either side absorbs rounding at the exact minute it falls asleep or wakes.)
  const fade =
    minute > ZOO_SLEEP.start - 0.5 && minute < ZOO_SLEEP.end + 0.5
      ? clamp((minute - ZOO_SLEEP.start) / 2.5) * clamp((ZOO_SLEEP.end - minute) / 1.5)
      : 1;
  if (fade <= 0) return;
  ctx.save();
  ctx.scale(a.facing, 1);
  const head =
    a.species === 'giraffe'
      ? { x: 16, y: -52 }
      : a.species === 'elephant'
        ? { x: 22, y: -34 }
        : a.species === 'zebra'
          ? { x: 18, y: -24 }
          : { x: 0, y: -27 };
  const letters = a.species === 'elephant' ? 3 : 2;
  ctx.textAlign = 'center';
  for (let i = 0; i < letters; i++) {
    const q = (((a.sleepPhase / 6 + i / letters) % 1) + 1) % 1;
    const x = head.x * a.facing + 3 + q * 16 + Math.sin(q * 7) * 2,
      y = head.y - 3 - q * 28;
    ctx.globalAlpha = fade * Math.sin(q * Math.PI);
    ctx.font = `bold ${round(8 + q * 5)}px "Space Mono", monospace`;
    ctx.fillStyle = night ? '#2A3A40' : '#F4F1E1';
    ctx.fillText('z', x + 1, y + 1);
    ctx.fillStyle = night ? '#DCE8E6' : '#4F6A5E';
    ctx.fillText('z', x, y);
  }
  ctx.restore();
}

export function drawZooAnimal(ctx: Ctx, a: ZooAnimalState, night: boolean) {
  const p = project(a.position.x, a.position.y);
  const phase = a.action?.phase;
  const elapsed = a.action?.elapsed ?? 0;
  const progress = a.action?.progress ?? 0;
  const pal = PALETTES[a.species];
  const c = night ? pal.night : pal.day;
  // Water rings and the wake start at touchdown, not under a penguin still in the air.
  const swimming =
    a.species === 'penguin' &&
    a.lift < 4 &&
    (a.swim > 0.3 || phase === 'splash' || phase === 'swim');
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(a.facing, 1);
  if (!swimming) {
    // The shadow stays on the ground (or the water), smaller and fainter the higher it leaps.
    const air = Math.min(1, a.lift / 45);
    const s = SHADOWS[a.species];
    const size = 1 - air * 0.45 + a.rest * 0.12;
    ctx.globalAlpha = 1 - air * 0.5;
    ctx.fillStyle = '#253D3026';
    ctx.beginPath();
    ctx.ellipse(s.x, 1, s.rx * size, s.ry * size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Lying down and getting up run through opaque key poses: standing with the head going down,
  // then kneeling as the legs fold and the body sinks, then lying.
  if (a.rest >= 0.7) {
    drawLying(ctx, a, c);
    if (a.sleeping) drawZs(ctx, a, night);
    ctx.restore();
    return;
  }
  let b = a;
  if (a.rest > 0) {
    const k = clamp((a.rest - 0.35) / 0.35);
    const head = a.rest < 0.35 ? a.rest / 0.35 : 1 - k;
    b = {
      ...a,
      moving: a.moving && k === 0,
      graze: Math.max(a.graze, head * 0.6),
      look: Math.min(a.look, 0.3),
      stretch: a.species === 'penguin' ? -5 * k : a.stretch,
    };
    fold = round(FOLD[a.species] * k);
    if (fold) ctx.translate(0, fold);
  }
  // Ground and water effects stay below the animal, even while it is airborne.
  if (swimming || phase === 'drink') {
    ctx.strokeStyle = night ? '#A0C4CE' : '#D4F0EE';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const q = (elapsed * 0.5 + i / 2) % 1;
      ctx.globalAlpha = 1 - q;
      ctx.beginPath();
      ctx.ellipse(
        phase === 'drink' ? 37 : 1,
        phase === 'drink' ? 14 : 1,
        10 + q * 20,
        3.5 + q * 7,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    if (swimming && (a.swim > 0.5 || phase === 'swim')) {
      // A little wake trails behind the swimmer.
      ctx.globalAlpha = 0.8;
      box(ctx, -22, -1, 9, 1, night ? '#A0C4CE' : '#E8F7F4');
      box(ctx, -19, 2, 7, 1, night ? '#A0C4CE' : '#E8F7F4');
    }
    ctx.globalAlpha = 1;
  }
  if (phase === 'splash') {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const x = Math.cos(angle) * progress * 40;
      const y =
        Math.sin(angle) * progress * 12 - Math.sin(progress * Math.PI) * (18 + (i % 3) * 10);
      ctx.globalAlpha = 1 - progress;
      box(ctx, round(x), round(y), 3, 4, i % 2 ? '#C7EBEF' : '#EAF8F5');
    }
    ctx.globalAlpha = 1;
  }
  if (phase === 'run' || phase === 'skid') {
    for (let i = 0; i < 5; i++) {
      const q = (elapsed * 1.5 + i / 5) % 1;
      ctx.globalAlpha =
        (1 - q) * 0.6 * (phase === 'skid' ? 1 - progress : Math.sin(progress * Math.PI));
      box(
        ctx,
        round((phase === 'skid' ? 14 : -20) - q * 32),
        round(-2 - q * 9 + (i % 2) * 4),
        round(5 + q * 7),
        round(3 + q * 4),
        night ? '#A7B0A6' : '#E6D9B3',
      );
    }
    ctx.globalAlpha = 1;
  }
  if (a.lift) ctx.translate(0, -a.lift);
  if (a.tilt) ctx.rotate(a.tilt);
  if (a.species === 'elephant') drawElephant(ctx, b, c, phase, elapsed, progress);
  else if (a.species === 'giraffe') drawGiraffe(ctx, b, c, phase, elapsed, night);
  else if (a.species === 'zebra') drawZebra(ctx, b, c, phase);
  else drawPenguin(ctx, b, c, phase);
  fold = 0;
  ctx.restore();
}
