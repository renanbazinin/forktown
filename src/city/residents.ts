import type { Resident } from '../lib/schema';
import type { ResidentState } from '../lib/simulation';
import { tint } from './houses';
import { drawErrandItem, errandItemPose } from './errand-items';

const GREETING_FONT = '10px "Space Mono", monospace';
/** How much lower, in a figure's own px, a neighbour perches on the porch chair than the bench. */
const PORCH_SINK = 2;
/** How much a figure's colours darken at night: as much as the roofs of the houses around it. */
export const NIGHT_DIM = -35;

/**
 * How far a figure, its props and its speech reach from its feet, in its own px before scaling,
 * with 2px to spare: sideways either way, above and below. A greeting may be any 40 characters,
 * some many times wider or taller than a letter, so it is measured on `ctx` as drawResident will
 * draw it: the bubble round its words, and the ink, which may reach past the bubble.
 */
export function residentReach(
  ctx: CanvasRenderingContext2D,
  resident: Resident,
  state?: Pick<ResidentState, 'greeting' | 'duckLove'>,
) {
  const figure = { x: 18, above: 48, below: 5 };
  if (!state?.greeting || state.duckLove) return figure;
  ctx.save();
  ctx.font = GREETING_FONT;
  ctx.textAlign = 'center';
  const words = ctx.measureText(resident.greeting);
  ctx.restore();
  // The bubble is 6px wider than the words on each side; they sit on a line 35px above the feet.
  const half = Math.max(
    words.width / 2 + 6,
    words.actualBoundingBoxLeft ?? 0,
    words.actualBoundingBoxRight ?? 0,
  );
  return {
    x: Math.max(figure.x, Math.ceil(half) + 2),
    above: Math.max(figure.above, Math.ceil(35 + (words.actualBoundingBoxAscent ?? 0)) + 2),
    below: Math.max(figure.below, Math.ceil((words.actualBoundingBoxDescent ?? 0) - 35) + 2),
  };
}

export function drawResident(
  ctx: CanvasRenderingContext2D,
  resident: Resident,
  x: number,
  y: number,
  scale = 1,
  state?: Pick<
    ResidentState,
    'moving' | 'facing' | 'walkPhase' | 'greeting' | 'pose' | 'duckLove' | 'event'
  > &
    Partial<Pick<ResidentState, 'lot' | 'errand'>>,
  /**
   * `shadow: false` leaves out the ground shadow, for a figure lifted off the ground.
   * `speech: false` leaves out the greeting or heart, for drawResidentSpeech to add on top.
   * `night: true` darkens the figure and what it holds like the dimmed houses beside it; its
   * words, a tea's steam, a chat's bubble, music notes and the shadow keep their colours.
   */
  options: { shadow?: boolean; speech?: boolean; night?: boolean } = {},
) {
  const facing = state?.facing ?? 'se';
  const back = facing === 'ne' || facing === 'nw';
  const left = facing === 'sw' || facing === 'nw';
  const errand = errandItemPose(state?.errand, facing, state?.walkPhase, state?.moving);
  const errandBehind = back || !!errand?.grounded;
  const female = resident.figure === 'female';
  const seated = !!state?.pose && ['sit', 'read', 'sip', 'chat'].includes(state.pose);
  // Skating on the Millpond: a forward lean, arms out for balance, one foot pushing back on a blade.
  const skating = state?.pose === 'skate';
  const cheering = state?.pose === 'cheer';
  const disco = state?.pose === 'dance';
  const dancing = cheering || disco || state?.pose === 'sway';
  // At home. Perched on a garden bench or a porch chair: the feet stand at the anchor, the lap
  // runs back to hips on the seat, 7px up and 3px behind them, the body about standing height.
  const perched = state?.pose === 'perch' || state?.pose === 'tea';
  // The porch chair is lower than the bench, so its sitter's head stays under the porch roof.
  const sink = perched && state?.lot?.spot === 'porch' ? PORCH_SINK : 0;
  const crouching = state?.pose === 'crouch' || (errand?.bend ?? 0) >= 2;
  const stretching = state?.pose === 'stretch';
  const watering = state?.pose === 'water';
  const sweeping = state?.pose === 'sweep';
  const stepping = state?.moving || disco || skating;
  const stride =
    state?.moving || dancing || skating ? Math.sin((state.walkPhase ?? 0) * Math.PI * 2) : 0;
  const swing = Math.round(stride * 2);
  const bob =
    errand?.bodyBob ??
    (seated
      ? 5
      : skating
        ? 1
        : state?.moving || dancing
          ? -Math.round(Math.abs(stride) * 0.8)
          : perched
            ? -2 + sink
            : crouching
              ? 2
              : 0);
  // A walker lifts the foot swinging forward; a skater lifts the one pushing back.
  const push = skating ? -1 : 1;
  const nearLift = stepping ? Math.max(0, Math.round(push * stride * 2)) : 0;
  const farLift = stepping ? Math.max(0, Math.round(-push * stride * 2)) : 0;
  const footSwing = stepping ? swing : 0;
  const dim = options.night ? NIGHT_DIM : 0;
  /** One of the figure's own colours, darkened at night (unchanged by day). */
  const ink = (color: string) => (dim ? tint(color, dim) : color);
  const skin = ink(resident.skin),
    outfit = ink(resident.outfit),
    hair = ink(resident.hair);
  const outfitShadow = ink(tint(resident.outfit, -24));
  // The object and its hands use one geometry. Elbows flex around a held load instead of
  // swinging through it; only the feet keep the walking stride.
  const grip = (near: boolean) => {
    const at = near ? errand!.nearGrip : errand!.farGrip;
    const rest = { x: near ? 4 : -4, y: -5 + bob };
    return {
      x: Math.round(rest.x + (at.x - rest.x) * errand!.armReach),
      y: Math.round(rest.y + (at.y - rest.y) * errand!.armReach),
    };
  };
  const carryingArm = (near: boolean) => {
    const hand = grip(near);
    const shoulder = { x: near ? 3 : -4, y: -11 + bob };
    const elbow = { x: Math.round((shoulder.x + hand.x) / 2), y: -8 + bob };
    ctx.fillStyle = near ? outfit : outfitShadow;
    for (const [a, b] of [
      [shoulder, elbow],
      [elbow, hand],
    ]) {
      const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
      for (let i = 0; i <= steps; i++)
        ctx.fillRect(
          Math.round(a.x + ((b.x - a.x) * i) / steps) - 1,
          Math.round(a.y + ((b.y - a.y) * i) / steps),
          2,
          2,
        );
    }
  };
  const carryingHand = (near: boolean) => {
    const hand = grip(near);
    ctx.fillStyle = skin;
    ctx.fillRect(hand.x - 1, hand.y - 1, 2, 2);
  };
  const errandItem = () => {
    if (!errand || !state?.errand) return;
    ctx.save();
    ctx.translate(errand.anchor.x, errand.anchor.y);
    // A grounded item does not turn when the resident turns toward or away from it.
    if (errand.grounded && left) ctx.scale(-1, 1);
    drawErrandItem(ctx, state.errand.kind, 0, 0, !!options.night);
    ctx.restore();
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (options.shadow !== false) {
    ctx.fillStyle = '#23341B30';
    ctx.beginPath();
    ctx.ellipse(0, 1, seated ? 7 : 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  if (left) ctx.scale(-1, 1);
  if (skating) ctx.transform(1, 0, -0.16, 1, 0, 0);
  // A sitter's body sits back over the seat, behind the feet at the anchor.
  if (perched) ctx.translate(-3, 0);
  if (errandBehind) errandItem();
  // The far arm and foot sit behind the body; feet lift rather than stretch.
  ctx.fillStyle = outfitShadow;
  if (errand && errand.armReach > 0) {
    carryingArm(false);
    if (back) carryingHand(false);
  } else if (cheering || (disco && stride > 0)) {
    ctx.fillRect(-6, -15 + bob, 4, 4);
    ctx.fillRect(-7, -22 + bob - Math.max(0, swing), 3, 10);
    ctx.fillStyle = skin;
    ctx.fillRect(-7, -25 + bob - Math.max(0, swing), 3, 3);
  } else if (skating) {
    ctx.fillRect(-9, -12 + bob, 6, 2);
    ctx.fillStyle = skin;
    ctx.fillRect(-11, -12 + bob, 2, 2);
  } else if (stretching) {
    // Both arms straight up past the head, hands open above it.
    ctx.fillRect(-6, -24 + bob, 2, 12);
    ctx.fillStyle = skin;
    ctx.fillRect(-6, -26 + bob, 2, 2);
  } else {
    ctx.fillRect(-4, -11 + bob - swing, 2, 6);
    ctx.fillStyle = skin;
    ctx.fillRect(-4, -6 + bob - swing, 2, 2);
  }
  if (seated) {
    // Folded legs, with shoes tucked to the sides instead of standing feet.
    ctx.fillStyle = ink('#53605A');
    ctx.fillRect(-6, -2, 13, 4);
    ctx.fillStyle = ink('#35413D');
    ctx.fillRect(-7, 0, 4, 2);
    ctx.fillRect(4, 0, 4, 2);
  } else if (perched) {
    // Shins straight down from the seat's front edge to the feet; the lap is laid over the body.
    ctx.fillStyle = ink('#3C4744');
    ctx.fillRect(2, -7 + sink, 2, 7 - sink);
    ctx.fillRect(2, -1, 4, 2);
    ctx.fillStyle = ink('#53605A');
    ctx.fillRect(4, -6 + sink, 2, 6 - sink);
    ctx.fillStyle = ink('#35413D');
    ctx.fillRect(4, -1, 4, 2);
  } else if (crouching) {
    // Halfway down or up: the knees push forward over the feet, with no legs folded.
    ctx.fillStyle = ink('#3C4744');
    ctx.fillRect(-2, -4, 2, 4);
    ctx.fillRect(-2, -1, 4, 2);
    ctx.fillStyle = ink('#53605A');
    ctx.fillRect(1, -5, 5, 2);
    ctx.fillRect(4, -4, 2, 3);
    ctx.fillStyle = ink('#35413D');
    ctx.fillRect(3, -1, 4, 2);
  } else {
    ctx.fillStyle = ink('#3C4744');
    ctx.fillRect(-2 - footSwing, -6, 2, 6 - farLift);
    ctx.fillRect(-2 - footSwing, -1 - farLift, 4, 2);
    ctx.fillStyle = ink('#53605A');
    ctx.fillRect(1 + footSwing, -6, 2, 6 - nearLift);
    ctx.fillStyle = ink('#35413D');
    ctx.fillRect(1 + footSwing, -1 - nearLift, 4, 2);
    if (skating) {
      // Pale 1-px blades under both boots.
      ctx.fillStyle = ink('#DCE4E2');
      ctx.fillRect(-3 - footSwing, 1 - farLift, 6, 1);
      ctx.fillRect(footSwing, 1 - nearLift, 6, 1);
    }
  }

  // Longer hair sits behind the shoulders; the same limbs and poses serve both figures.
  if (female) {
    ctx.fillStyle = ink(tint(resident.hair, -18));
    ctx.fillRect(-5, -20 + bob, 9, 9);
    ctx.fillRect(-4, -12 + bob, 8, 2);
  }
  ctx.fillStyle = outfit;
  if (female) {
    ctx.fillRect(-3, -13 + bob, 7, 3);
    ctx.fillRect(-2, -10 + bob, 5, 3);
    ctx.fillRect(-3, -7 + bob, 7, 3);
  } else ctx.fillRect(-3, -13 + bob, 7, 9);
  ctx.fillStyle = outfitShadow;
  if (female) {
    ctx.fillRect(-3, -12 + bob, 1, 2);
    ctx.fillRect(-2, -10 + bob, 1, 3);
    ctx.fillRect(-3, -7 + bob, 1, 3);
  } else ctx.fillRect(-3, -12 + bob, 2, 8);
  ctx.fillStyle = ink(tint(resident.outfit, 16));
  ctx.fillRect(-1, -13 + bob, 4, 1);
  if (back) {
    ctx.fillStyle = outfitShadow;
    ctx.fillRect(0, -11 + bob, 1, 6);
  } else {
    ctx.fillStyle = skin;
    ctx.fillRect(1, -14 + bob, 2, 2);
  }
  if (perched) {
    // The lap, toward the viewer over the body's lower edge, out to the knees.
    ctx.fillStyle = ink('#53605A');
    ctx.fillRect(-2, -8 + sink, 8, 2);
  }
  ctx.fillStyle = outfit;
  if (errand && errand.armReach > 0) {
    carryingArm(true);
  } else if (cheering || (disco && stride <= 0)) {
    ctx.fillRect(3, -15 + bob, 4, 4);
    ctx.fillRect(5, -21 + bob + Math.min(0, swing), 3, 10);
    ctx.fillStyle = skin;
    ctx.fillRect(5, -24 + bob + Math.min(0, swing), 3, 3);
  } else if (skating) {
    ctx.fillRect(3, -12 + bob, 6, 2);
    ctx.fillStyle = skin;
    ctx.fillRect(9, -11 + bob, 2, 2);
  } else if (stretching) {
    ctx.fillRect(4, -24 + bob, 2, 12);
    ctx.fillStyle = skin;
    ctx.fillRect(4, -26 + bob, 2, 2);
  } else if (watering || sweeping) {
    // Reaching forward to the can's handle, or down the broom handle.
    ctx.fillRect(3, -11 + bob, 2, 3);
    ctx.fillRect(3, -9 + bob, watering ? 2 : 3, 2);
  } else {
    ctx.fillRect(3, -11 + bob + swing, 2, 6);
    ctx.fillStyle = skin;
    ctx.fillRect(3, -6 + bob + swing, 2, 2);
  }

  ctx.fillStyle = skin;
  ctx.fillRect(-3, -21 + bob, 7, 8);
  ctx.fillRect(4, -18 + bob, 1, 2);
  ctx.fillStyle = hair;
  ctx.fillRect(-4, -22 + bob, 8, 3);
  ctx.fillRect(-4, -20 + bob, back ? 7 : 3, back ? 6 : 4);
  ctx.fillStyle = ink(tint(resident.hair, 18));
  ctx.fillRect(-3, -22 + bob, 4, 1);
  if (back) {
    ctx.fillStyle = hair;
    ctx.fillRect(-2, -16 + bob, 5, 2);
    ctx.fillStyle = skin;
    ctx.fillRect(3, -17 + bob, 2, 2);
  } else {
    ctx.fillStyle = ink('#35453D');
    ctx.fillRect(1, -18 + bob, 1, 1);
    ctx.fillRect(3, -18 + bob, 1, 1);
    ctx.fillStyle = ink(tint(resident.skin, -28));
    ctx.fillRect(3, -15 + bob, 1, 1);
  }
  if (female) {
    ctx.fillStyle = hair;
    if (back) {
      ctx.fillRect(-4, -20 + bob, 8, 8);
      ctx.fillRect(-3, -12 + bob, 6, 1);
      ctx.fillStyle = ink(tint(resident.hair, 18));
      ctx.fillRect(-3, -20 + bob, 1, 7);
    } else {
      ctx.fillRect(-4, -20 + bob, 2, 9);
      ctx.fillRect(-2, -20 + bob, 3, 1);
      ctx.fillRect(1, -21 + bob, 3, 1);
      ctx.fillStyle = ink(tint(resident.hair, 18));
      ctx.fillRect(-4, -19 + bob, 1, 6);
    }
  }
  if (resident.accessory === 'hat') {
    ctx.fillStyle = outfitShadow;
    ctx.fillRect(-4, -25 + bob, 8, 5);
    ctx.fillStyle = outfit;
    ctx.fillRect(-3, -25 + bob, 6, 4);
    ctx.fillRect(back ? -5 : -4, -21 + bob, back ? 10 : 11, 2);
    ctx.fillStyle = outfitShadow;
    ctx.fillRect(-4, -22 + bob, 8, 1);
  }
  if (resident.accessory === 'glasses') {
    ctx.fillStyle = ink('#394B46');
    if (back) ctx.fillRect(3, -18 + bob, 2, 1);
    else {
      ctx.fillRect(-1, -19 + bob, 6, 1);
      ctx.fillRect(0, -18 + bob, 1, 2);
      ctx.fillRect(2, -18 + bob, 1, 2);
      ctx.fillRect(4, -18 + bob, 1, 2);
      ctx.fillRect(0, -16 + bob, 5, 1);
    }
  }
  if (!errandBehind) errandItem();
  if (errand && errand.armReach > 0) {
    if (!back) carryingHand(false);
    carryingHand(true);
  }
  if (state?.pose === 'read') {
    ctx.fillStyle = ink('#567F79');
    ctx.fillRect(-5, -9 + bob, 11, 7);
    ctx.fillStyle = ink('#F3E7C5');
    ctx.fillRect(-4, -8 + bob, 4, 5);
    ctx.fillRect(1, -8 + bob, 4, 5);
    ctx.fillStyle = skin;
    ctx.fillRect(-6, -6 + bob, 2, 2);
    ctx.fillRect(5, -6 + bob, 2, 2);
  }
  if (state?.pose === 'sip') {
    const lift = (state.walkPhase ?? 0) < 0.45 ? 4 : 0;
    ctx.fillStyle = skin;
    ctx.fillRect(3, -8 + bob - lift, 4, 2);
    ctx.fillStyle = ink('#F2DC8F');
    ctx.fillRect(5, -10 + bob - lift, 4, 5);
    ctx.fillStyle = ink('#FAF2D6');
    ctx.fillRect(5, -11 + bob - lift, 4, 1);
    ctx.fillStyle = ink('#81956E');
    ctx.fillRect(7, -14 + bob - lift, 1, 4);
  }
  if (state?.pose === 'tea') {
    // A mug of tea on the porch, lifted to sip now and then like a glass. Lowered, it steams.
    const phase = state.walkPhase ?? 0;
    const lift = phase < 0.45 ? 4 : 0;
    ctx.fillStyle = skin;
    ctx.fillRect(3, -8 + bob - lift, 4, 2);
    ctx.fillStyle = ink('#E9E2CF');
    ctx.fillRect(5, -11 + bob - lift, 3, 3);
    ctx.fillStyle = ink('#FBF8EE');
    ctx.fillRect(5, -12 + bob - lift, 3, 1);
    ctx.fillStyle = ink('#C7BEA6');
    ctx.fillRect(8, -11 + bob - lift, 1, 2);
    if (!lift) {
      const rise = Math.min(3, Math.floor(((phase - 0.45) / 0.55) * 4));
      ctx.fillStyle = '#FFFFFF80';
      ctx.fillRect(5, -14 + bob - rise, 1, 1);
      ctx.fillRect(7, -15 + bob - rise, 1, 1);
    }
  }
  if (watering) {
    // A watering can held out by its handle, the rose tipped down, drops falling from it onto
    // the bed or the flowers a quarter tile off (home-life's watering spots stand that far away).
    ctx.fillStyle = ink('#6F9C8C');
    ctx.fillRect(7, -9 + bob, 5, 4);
    ctx.fillRect(12, -8 + bob, 1, 1);
    ctx.fillRect(13, -7 + bob, 1, 1);
    ctx.fillStyle = ink('#557D70');
    ctx.fillRect(7, -10 + bob, 4, 1);
    ctx.fillRect(7, -6 + bob, 5, 1);
    ctx.fillRect(13, -6 + bob, 2, 1);
    ctx.fillStyle = skin;
    ctx.fillRect(5, -9 + bob, 2, 2);
    ctx.fillStyle = ink('#BFE0E6');
    for (let drop = 0; drop < 3; drop++) {
      const fall = Math.floor(((state?.walkPhase ?? 0) * 6 + drop * 2) % 6);
      ctx.fillRect(13 + (drop % 2), -5 + bob + fall, 1, 1);
    }
  }
  if (sweeping) {
    // A broom angled down in front, its head swept from side to side along the path.
    const head = 8 + Math.round(Math.sin((state?.walkPhase ?? 0) * Math.PI * 2) * 2);
    ctx.fillStyle = ink('#8F6E4E');
    for (let row = 0; row < 10; row++)
      ctx.fillRect(Math.round(1 + ((head - 1) * row) / 10), -13 + bob + row, 1, 1);
    ctx.fillStyle = ink('#D9B872');
    ctx.fillRect(head - 2, -2 + bob, 5, 2);
    ctx.fillStyle = ink('#A5824E');
    ctx.fillRect(head - 1, -3 + bob, 3, 1);
    ctx.fillStyle = skin;
    ctx.fillRect(Math.round(1 + (head - 1) * 0.5) - 1, -9 + bob, 2, 2);
  }
  ctx.restore();
  if (state?.pose === 'play') {
    const bounce = Math.abs(Math.sin((state.walkPhase ?? 0) * Math.PI * 2));
    ctx.fillStyle = ink('#D7AA63');
    ctx.fillRect(7, -3 - Math.round(bounce * 10), 4, 4);
    ctx.fillStyle = ink('#F5DFA4');
    ctx.fillRect(7, -3 - Math.round(bounce * 10), 2, 1);
  }
  if (state?.pose === 'chat' && (state.walkPhase ?? 0) < 0.4) {
    ctx.fillStyle = '#FCFAEF';
    ctx.fillRect(-7, -31, 15, 9);
    ctx.fillRect(0, -22, 2, 3);
    ctx.fillStyle = '#7B8A69';
    for (const x of [-4, 0, 4]) ctx.fillRect(x, -27, 2, 2);
  }
  // Music notes belong to the stage and the disco; football fans and zoo visitors cheer without.
  const quiet = state?.event?.id === 'football' || state?.event?.id === 'zoo';
  if (dancing && !quiet && (state?.walkPhase ?? 0) < 0.3) {
    // A small pixel music note, only occasionally, so a full crowd stays readable.
    const rise = Math.round((state?.walkPhase ?? 0) * 12);
    ctx.fillStyle = '#E0B768';
    ctx.fillRect(10, -34 - rise, 2, 9);
    ctx.fillRect(7, -27 - rise, 4, 3);
    ctx.fillRect(12, -34 - rise, 4, 2);
  }
  if (options.speech !== false) speak(ctx, resident, state);
  ctx.restore();
}

/**
 * A figure's greeting bubble or duck heart on its own, exactly where drawResident puts it: for a
 * figure drawn with `speech: false` under something painted over it, so its words stay on top.
 */
export function drawResidentSpeech(
  ctx: CanvasRenderingContext2D,
  resident: Resident,
  x: number,
  y: number,
  scale: number,
  state: Pick<ResidentState, 'greeting' | 'duckLove'>,
) {
  if (!state.greeting && !state.duckLove) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  speak(ctx, resident, state);
  ctx.restore();
}

/** The speech over a figure whose feet are at the origin, in its own px. */
function speak(
  ctx: CanvasRenderingContext2D,
  resident: Resident,
  state?: Pick<ResidentState, 'greeting' | 'duckLove'>,
) {
  // Speech stays readable when the sprite is mirrored.
  if (state?.duckLove) {
    // A pixel heart stays crisp at town zoom and does not depend on an emoji font.
    ctx.fillStyle = '#FCFAEF';
    ctx.fillRect(-10, -45, 20, 15);
    ctx.fillRect(-12, -43, 24, 11);
    ctx.fillRect(-1, -30, 3, 3);
    ctx.fillStyle = '#D77683';
    ctx.fillRect(-6, -42, 4, 2);
    ctx.fillRect(2, -42, 4, 2);
    ctx.fillRect(-7, -40, 14, 3);
    ctx.fillRect(-5, -37, 10, 2);
    ctx.fillRect(-3, -35, 6, 2);
    ctx.fillRect(-1, -33, 2, 1);
  } else if (state?.greeting) {
    ctx.font = GREETING_FONT;
    const width = ctx.measureText(resident.greeting).width + 12;
    ctx.fillStyle = '#FCFAEF';
    ctx.fillRect(-width / 2, -46, width, 16);
    ctx.fillRect(-1, -30, 3, 3);
    ctx.fillStyle = '#4D664E';
    ctx.textAlign = 'center';
    ctx.fillText(resident.greeting, 0, -35);
  }
}
