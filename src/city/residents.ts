import type { Resident } from '../lib/schema';
import type { ResidentState } from '../lib/simulation';
import { tint } from './houses';

export function drawResident(
  ctx: CanvasRenderingContext2D,
  resident: Resident,
  x: number,
  y: number,
  scale = 1,
  state?: Pick<ResidentState, 'moving' | 'facing' | 'walkPhase' | 'greeting' | 'pose'>,
) {
  const facing = state?.facing ?? 'se';
  const back = facing === 'ne' || facing === 'nw';
  const left = facing === 'sw' || facing === 'nw';
  const seated = !!state?.pose && ['sit', 'read', 'sip', 'chat'].includes(state.pose);
  const cheering = state?.pose === 'cheer';
  const disco = state?.pose === 'dance';
  const dancing = cheering || disco || state?.pose === 'sway';
  const stepping = state?.moving || disco;
  const stride = state?.moving || dancing ? Math.sin((state.walkPhase ?? 0) * Math.PI * 2) : 0;
  const swing = Math.round(stride * 2);
  const bob = seated ? 5 : state?.moving || dancing ? -Math.round(Math.abs(stride) * 0.8) : 0;
  const nearLift = stepping ? Math.max(0, Math.round(stride * 2)) : 0;
  const farLift = stepping ? Math.max(0, Math.round(-stride * 2)) : 0;
  const footSwing = stepping ? swing : 0;
  const outfitShadow = tint(resident.outfit, -24);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#23341B30';
  ctx.beginPath();
  ctx.ellipse(0, 1, seated ? 7 : 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  if (left) ctx.scale(-1, 1);
  // The far arm and foot sit behind the body; feet lift rather than stretch.
  ctx.fillStyle = outfitShadow;
  if (cheering || (disco && stride > 0)) {
    ctx.fillRect(-6, -15 + bob, 4, 4);
    ctx.fillRect(-7, -22 + bob - Math.max(0, swing), 3, 10);
    ctx.fillStyle = resident.skin;
    ctx.fillRect(-7, -25 + bob - Math.max(0, swing), 3, 3);
  } else {
    ctx.fillRect(-4, -11 + bob - swing, 2, 6);
    ctx.fillStyle = resident.skin;
    ctx.fillRect(-4, -6 + bob - swing, 2, 2);
  }
  if (seated) {
    // Folded legs, with shoes tucked to the sides instead of standing feet.
    ctx.fillStyle = '#53605A';
    ctx.fillRect(-6, -2, 13, 4);
    ctx.fillStyle = '#35413D';
    ctx.fillRect(-7, 0, 4, 2);
    ctx.fillRect(4, 0, 4, 2);
  } else {
    ctx.fillStyle = '#3C4744';
    ctx.fillRect(-2 - footSwing, -6, 2, 6 - farLift);
    ctx.fillRect(-2 - footSwing, -1 - farLift, 4, 2);
    ctx.fillStyle = '#53605A';
    ctx.fillRect(1 + footSwing, -6, 2, 6 - nearLift);
    ctx.fillStyle = '#35413D';
    ctx.fillRect(1 + footSwing, -1 - nearLift, 4, 2);
  }

  ctx.fillStyle = resident.outfit;
  ctx.fillRect(-3, -13 + bob, 7, 9);
  ctx.fillStyle = outfitShadow;
  ctx.fillRect(-3, -12 + bob, 2, 8);
  ctx.fillStyle = tint(resident.outfit, 16);
  ctx.fillRect(-1, -13 + bob, 4, 1);
  if (back) {
    ctx.fillStyle = outfitShadow;
    ctx.fillRect(0, -11 + bob, 1, 6);
  } else {
    ctx.fillStyle = resident.skin;
    ctx.fillRect(1, -14 + bob, 2, 2);
  }
  ctx.fillStyle = resident.outfit;
  if (cheering || (disco && stride <= 0)) {
    ctx.fillRect(3, -15 + bob, 4, 4);
    ctx.fillRect(5, -21 + bob + Math.min(0, swing), 3, 10);
    ctx.fillStyle = resident.skin;
    ctx.fillRect(5, -24 + bob + Math.min(0, swing), 3, 3);
  } else {
    ctx.fillRect(3, -11 + bob + swing, 2, 6);
    ctx.fillStyle = resident.skin;
    ctx.fillRect(3, -6 + bob + swing, 2, 2);
  }

  ctx.fillStyle = resident.skin;
  ctx.fillRect(-3, -21 + bob, 7, 8);
  ctx.fillRect(4, -18 + bob, 1, 2);
  ctx.fillStyle = resident.hair;
  ctx.fillRect(-4, -22 + bob, 8, 3);
  ctx.fillRect(-4, -20 + bob, back ? 7 : 3, back ? 6 : 4);
  ctx.fillStyle = tint(resident.hair, 18);
  ctx.fillRect(-3, -22 + bob, 4, 1);
  if (back) {
    ctx.fillStyle = resident.hair;
    ctx.fillRect(-2, -16 + bob, 5, 2);
    ctx.fillStyle = resident.skin;
    ctx.fillRect(3, -17 + bob, 2, 2);
  } else {
    ctx.fillStyle = '#35453D';
    ctx.fillRect(1, -18 + bob, 1, 1);
    ctx.fillRect(3, -18 + bob, 1, 1);
    ctx.fillStyle = tint(resident.skin, -28);
    ctx.fillRect(3, -15 + bob, 1, 1);
  }
  if (resident.accessory === 'hat') {
    ctx.fillStyle = outfitShadow;
    ctx.fillRect(-4, -25 + bob, 8, 5);
    ctx.fillStyle = resident.outfit;
    ctx.fillRect(-3, -25 + bob, 6, 4);
    ctx.fillRect(back ? -5 : -4, -21 + bob, back ? 10 : 11, 2);
    ctx.fillStyle = outfitShadow;
    ctx.fillRect(-4, -22 + bob, 8, 1);
  }
  if (resident.accessory === 'glasses') {
    ctx.fillStyle = '#394B46';
    if (back) ctx.fillRect(3, -18 + bob, 2, 1);
    else {
      ctx.fillRect(-1, -19 + bob, 6, 1);
      ctx.fillRect(0, -18 + bob, 1, 2);
      ctx.fillRect(2, -18 + bob, 1, 2);
      ctx.fillRect(4, -18 + bob, 1, 2);
      ctx.fillRect(0, -16 + bob, 5, 1);
    }
  }
  if (state?.pose === 'read') {
    ctx.fillStyle = '#567F79';
    ctx.fillRect(-5, -9 + bob, 11, 7);
    ctx.fillStyle = '#F3E7C5';
    ctx.fillRect(-4, -8 + bob, 4, 5);
    ctx.fillRect(1, -8 + bob, 4, 5);
    ctx.fillStyle = resident.skin;
    ctx.fillRect(-6, -6 + bob, 2, 2);
    ctx.fillRect(5, -6 + bob, 2, 2);
  }
  if (state?.pose === 'sip') {
    const lift = (state.walkPhase ?? 0) < 0.45 ? 4 : 0;
    ctx.fillStyle = resident.skin;
    ctx.fillRect(3, -8 + bob - lift, 4, 2);
    ctx.fillStyle = '#F2DC8F';
    ctx.fillRect(5, -10 + bob - lift, 4, 5);
    ctx.fillStyle = '#FAF2D6';
    ctx.fillRect(5, -11 + bob - lift, 4, 1);
    ctx.fillStyle = '#81956E';
    ctx.fillRect(7, -14 + bob - lift, 1, 4);
  }
  ctx.restore();
  if (state?.pose === 'play') {
    const bounce = Math.abs(Math.sin((state.walkPhase ?? 0) * Math.PI * 2));
    ctx.fillStyle = '#D7AA63';
    ctx.fillRect(7, -3 - Math.round(bounce * 10), 4, 4);
    ctx.fillStyle = '#F5DFA4';
    ctx.fillRect(7, -3 - Math.round(bounce * 10), 2, 1);
  }
  if (state?.pose === 'chat' && (state.walkPhase ?? 0) < 0.4) {
    ctx.fillStyle = '#FCFAEF';
    ctx.fillRect(-7, -31, 15, 9);
    ctx.fillRect(0, -22, 2, 3);
    ctx.fillStyle = '#7B8A69';
    for (const x of [-4, 0, 4]) ctx.fillRect(x, -27, 2, 2);
  }
  if (dancing && (state?.walkPhase ?? 0) < 0.3) {
    // A small pixel music note, only occasionally, so a full crowd stays readable.
    const rise = Math.round((state?.walkPhase ?? 0) * 12);
    ctx.fillStyle = '#E0B768';
    ctx.fillRect(10, -34 - rise, 2, 9);
    ctx.fillRect(7, -27 - rise, 4, 3);
    ctx.fillRect(12, -34 - rise, 4, 2);
  }
  // Speech stays readable when the sprite is mirrored.
  if (state?.greeting) {
    ctx.font = '10px "Space Mono", monospace';
    const width = ctx.measureText(resident.greeting).width + 12;
    ctx.fillStyle = '#FCFAEF';
    ctx.fillRect(-width / 2, -46, width, 16);
    ctx.fillRect(-1, -30, 3, 3);
    ctx.fillStyle = '#4D664E';
    ctx.textAlign = 'center';
    ctx.fillText(resident.greeting, 0, -35);
  }
  ctx.restore();
}
