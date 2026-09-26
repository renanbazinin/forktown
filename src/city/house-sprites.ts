import {
  drawHouse,
  drawHouseSmoke,
  houseBounds,
  houseLook,
  type HouseAppearance,
  type HouseLife,
} from './houses';

type Ctx = CanvasRenderingContext2D;
export type HousePainter = (
  place: HouseAppearance,
  x: number,
  y: number,
  night: boolean,
  scale: number,
  life: HouseLife,
) => void;

// A full town paints well over a hundred homes on every frame, each a few hundred vector calls,
// though a home looks the same from one frame to the next. So each keeps a sprite: its still
// picture painted once at the device scale and sub-pixel position the map draws it at, then
// copied pixel for pixel onto whole device pixels. The chimney smoke is painted live on top.

type Sprite = {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
  /** What the picture shows: houseLook(), the device scale, the sub-pixel origin and strokes. */
  look: number;
  a: number;
  d: number;
  fx: number;
  fy: number;
  join: CanvasLineJoin;
  cap: CanvasLineCap;
  /** The whole device pixel under the house origin, from the sprite's top left corner. */
  ox: number;
  oy: number;
  /** The frame this sprite was last drawn in. */
  used: number;
};
type Store = {
  sprites: Map<HouseAppearance, Sprite>;
  pixels: number;
  frame: number;
  camera: number[];
};

// One store per map canvas, released with its context.
const stores = new WeakMap<Ctx, Store>();
/** Transparent margin round houseBounds, in house px, for the antialiased edges. */
export const SPRITE_MARGIN = 2;
/** Sprite memory, in device pixels: twice the canvas, at least 4M (16 MB) and at most 24M. */
const MIN_PIXELS = 4 * 1024 * 1024;
const MAX_PIXELS = 24 * 1024 * 1024;
export const MAX_SPRITES = 512;
/** New pictures painted per frame, so a night falling on a full town spreads over a few frames. */
export const PAINTS_PER_FRAME = 32;
/** Device pixels a frame from which a pan counts as quick. */
export const QUICK_PAN = 4;
/** A sprite not drawn for this many frames, about ten seconds, gives its memory back. */
const IDLE_FRAMES = 300;

export function spriteBudget(width: number, height: number) {
  return Math.min(MAX_PIXELS, Math.max(MIN_PIXELS, 2 * width * height));
}
/** How many sprites a map canvas holds, and how many device pixels they use. */
export function houseSpriteStats(ctx: Ctx) {
  const store = stores.get(ctx);
  return { sprites: store?.sprites.size ?? 0, pixels: store?.pixels ?? 0 };
}

function release(store: Store, place: HouseAppearance, sprite: Sprite) {
  store.pixels -= sprite.canvas.width * sprite.canvas.height;
  // A zero-sized canvas hands its backing store back straight away.
  sprite.canvas.width = sprite.canvas.height = 0;
  store.sprites.delete(place);
}
/**
 * Frees the sprites drawn least recently until `need` fits. Sprites drawn this frame or the last
 * are on screen and never freed: when those alone fill the budget, the rest are drawn directly
 * rather than taking turns at being repainted every frame.
 */
function makeRoom(store: Store, need: number, budget: number, keep: HouseAppearance) {
  const slots = store.sprites.has(keep) ? 0 : 1;
  const fits = () => store.pixels + need <= budget && store.sprites.size + slots <= MAX_SPRITES;
  if (fits()) return true;
  const idle = [...store.sprites]
    .filter(([place, sprite]) => place !== keep && sprite.used < store.frame - 1)
    .sort((a, b) => a[1].used - b[1].used);
  for (const [place, sprite] of idle) {
    release(store, place, sprite);
    if (fits()) return true;
  }
  return false;
}

/**
 * The house painter for one frame of `ctx`, made once the camera transform is set; every object
 * paints inside save() and restore(), so the transform holds for the whole frame. A house with a
 * sprite painted for this exact scale and sub-pixel position is copied, pixel for pixel, and a
 * few more houses a frame get one while the camera rests. A quick pan, moving everything several
 * pixels a frame, copies a sprite painted for another sub-pixel to the nearest whole pixel, as the
 * football pitch always is; the camera coming to rest repaints it exactly. A slow glide, where
 * half a pixel could show, a zoom, and anything unusual about the canvas draw houses directly.
 */
export function housePainter(ctx: Ctx): HousePainter {
  const direct: HousePainter = (place, x, y, night, scale, life) =>
    drawHouse(ctx, place, x, y, night, scale, life);
  if (typeof document === 'undefined' || typeof ctx.getTransform !== 'function') return direct;
  const t = ctx.getTransform();
  if (t.b || t.c || !(t.a > 0 && t.d > 0)) return direct;
  let store = stores.get(ctx);
  if (!store) stores.set(ctx, (store = { sprites: new Map(), pixels: 0, frame: 0, camera: [] }));
  const { sprites } = store;
  const frame = ++store.frame;
  if (frame % 60 === 0)
    for (const [place, sprite] of sprites)
      if (frame - sprite.used > IDLE_FRAMES) release(store, place, sprite);
  const [a0, d0, e0, f0] = store.camera;
  const steady = t.a === a0 && t.d === d0,
    shift = Math.abs(t.e - e0) + Math.abs(t.f - f0),
    still = steady && shift === 0,
    quick = steady && shift >= QUICK_PAN;
  store.camera = [t.a, t.d, t.e, t.f];
  const budget = spriteBudget(ctx.canvas.width, ctx.canvas.height);
  let paints = still || quick ? PAINTS_PER_FRAME : 0;
  return (place, x, y, night, scale, life) => {
    const look = houseLook(place, night, life);
    if (
      look === undefined ||
      ctx.globalAlpha !== 1 ||
      ctx.globalCompositeOperation !== 'source-over'
    )
      return direct(place, x, y, night, scale, life);
    // Where the canvas puts the house origin: its translate(x, y), then scale(scale).
    const X = t.e + x * t.a,
      Y = t.f + y * t.d,
      a = t.a * scale,
      d = t.d * scale;
    const px = Math.floor(X),
      py = Math.floor(Y);
    const fx = X - px,
      fy = Y - py;
    const join = ctx.lineJoin,
      cap = ctx.lineCap;
    let sprite = sprites.get(place);
    const fits =
      !!sprite &&
      sprite.look === look &&
      sprite.a === a &&
      sprite.d === d &&
      sprite.join === join &&
      sprite.cap === cap;
    let exact = fits && sprite!.fx === fx && sprite!.fy === fy;
    // A pan only paints the pictures it lacks; the sub-pixel is made exact once it rests.
    if (!exact && paints > 0 && (still || !fits)) {
      const bounds = houseBounds(place);
      const ox = Math.ceil((bounds.left + SPRITE_MARGIN) * a),
        oy = Math.ceil((bounds.top + SPRITE_MARGIN) * d);
      const w = ox + Math.ceil((bounds.right + SPRITE_MARGIN) * a) + 1,
        h = oy + Math.ceil((bounds.bottom + SPRITE_MARGIN) * d) + 1;
      const old = sprite ? sprite.canvas.width * sprite.canvas.height : 0;
      // A home filling much of the screen is one of very few in view: drawn directly, it costs
      // little and keeps its memory.
      if (w * h <= budget / 4 && makeRoom(store, w * h - old, budget, place)) {
        if (!sprite) {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (context) sprites.set(place, (sprite = { canvas, ctx: context } as Sprite));
        }
        if (sprite) {
          paints--;
          const { canvas, ctx: art } = sprite;
          if (!old || canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            store.pixels += w * h - old;
          } else {
            art.setTransform(1, 0, 0, 1, 0, 0);
            art.clearRect(0, 0, w, h);
          }
          art.setTransform(a, 0, 0, d, ox + fx, oy + fy);
          art.lineJoin = join;
          art.lineCap = cap;
          drawHouse(art, place, 0, 0, night, 1, life, false);
          Object.assign(sprite, { look, a, d, fx, fy, join, cap, ox, oy });
          exact = true;
        }
      }
    }
    if (!exact && !(fits && quick)) return direct(place, x, y, night, scale, life);
    const s = sprite!;
    s.used = frame;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(
      s.canvas,
      (exact ? px : Math.round(X - s.fx)) - s.ox,
      (exact ? py : Math.round(Y - s.fy)) - s.oy,
    );
    ctx.restore();
    drawHouseSmoke(ctx, place, x, y, night, scale, life);
  };
}
