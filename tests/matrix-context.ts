import { recordingContext } from './recording-context';

// A recording context that also tracks the full canvas transform, so a test can ask where every
// primitive actually lands in world pixels: under scale, rotate, skews and the ground cache's
// setTransform. It wraps recordingContext(), so `calls` is exactly what that recorder logs and
// call budgets are unchanged. Paths and clips are not evaluated: a clipped-away pixel still
// counts, which is the conservative side for the sightline and containment tests.

export type Matrix = [a: number, b: number, c: number, d: number, e: number, f: number];
export type MatrixPoint = { x: number; y: number; call: string; index: number };

const DRAWS = new Set([
  'fillRect',
  'strokeRect',
  'rect',
  'moveTo',
  'lineTo',
  'quadraticCurveTo',
  'bezierCurveTo',
  'arc',
  'ellipse',
  'fillText',
  'strokeText',
  'drawImage',
]);
// Calls that change no pixel by themselves, or only paint what the draws above already built.
const IGNORED = new Set([
  'save',
  'restore',
  'translate',
  'scale',
  'rotate',
  'transform',
  'setTransform',
  'resetTransform',
  'beginPath',
  'closePath',
  'fill',
  'stroke',
  'clip',
  'measureText',
  'setLineDash',
  'getLineDash',
  'createLinearGradient',
  'createRadialGradient',
  'createPattern',
  'getTransform',
]);

export function matrixContext(width = 1440, height = 900) {
  const base = recordingContext(width, height);
  const target = base.ctx as unknown as Record<string, unknown> & CanvasRenderingContext2D;
  let m: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const points: MatrixPoint[] = [];
  const unknown: string[] = [];
  const multiply = ([a2, b2, c2, d2, e2, f2]: readonly number[]) => {
    const [a, b, c, d, e, f] = m;
    m = [
      a * a2 + c * b2,
      b * a2 + d * b2,
      a * c2 + c * d2,
      b * c2 + d * d2,
      a * e2 + c * f2 + e,
      b * e2 + d * f2 + f,
    ];
  };
  const at = (x: number, y: number, call: string) =>
    points.push({
      x: m[0] * x + m[2] * y + m[4],
      y: m[1] * x + m[3] * y + m[5],
      call,
      index: base.calls.length,
    });
  const box = (x: number, y: number, w: number, h: number, call: string) => {
    at(x, y, call);
    at(x + w, y, call);
    at(x, y + h, call);
    at(x + w, y + h, call);
  };
  const track = (key: string, args: unknown[]) => {
    const n = args as number[];
    const lineWidth = Number(target.lineWidth ?? 1);
    const half = lineWidth / 2;
    switch (key) {
      case 'save':
        stack.push([...m]);
        break;
      case 'restore':
        m = stack.pop() ?? m;
        break;
      case 'translate':
        multiply([1, 0, 0, 1, n[0], n[1]]);
        break;
      case 'scale':
        multiply([n[0], 0, 0, n[1], 0, 0]);
        break;
      case 'rotate': {
        const cos = Math.cos(n[0]),
          sin = Math.sin(n[0]);
        multiply([cos, sin, -sin, cos, 0, 0]);
        break;
      }
      case 'transform':
        multiply(n);
        break;
      case 'setTransform': {
        const o = args[0] as DOMMatrix2DInit | number;
        m =
          typeof o === 'object'
            ? [o.a ?? 1, o.b ?? 0, o.c ?? 0, o.d ?? 1, o.e ?? 0, o.f ?? 0]
            : (n.slice(0, 6) as Matrix);
        break;
      }
      case 'resetTransform':
        m = [1, 0, 0, 1, 0, 0];
        break;
      case 'fillRect':
      case 'rect':
        box(n[0], n[1], n[2], n[3], key);
        break;
      case 'strokeRect':
        box(n[0] - half, n[1] - half, n[2] + lineWidth, n[3] + lineWidth, key);
        break;
      case 'moveTo':
      case 'lineTo':
        box(n[0] - half, n[1] - half, lineWidth, lineWidth, key);
        break;
      case 'quadraticCurveTo':
        at(n[0], n[1], key);
        at(n[2], n[3], key);
        break;
      case 'bezierCurveTo':
        for (let i = 0; i < 6; i += 2) at(n[i], n[i + 1], key);
        break;
      case 'arc':
      case 'ellipse': {
        // The arc actually swept, sampled at 16 steps, each sample padded by half the line
        // width and by the chord's sagitta, so the samples cover the curve between them.
        const [x, y, rx, ry, rotation, start, end, ccw] =
          key === 'arc'
            ? [n[0], n[1], n[2], n[2], 0, n[3], n[4], Boolean(args[5])]
            : [n[0], n[1], n[2], n[3], n[4], n[5], n[6], Boolean(args[7])];
        const turn = Math.PI * 2;
        const sweep = ccw
          ? start - end >= turn
            ? -turn
            : -(((start - end) % turn) + turn) % turn
          : end - start >= turn
            ? turn
            : (((end - start) % turn) + turn) % turn;
        const steps = 16,
          cos = Math.cos(rotation),
          sin = Math.sin(rotation);
        const pad = half + Math.max(rx, ry) * (1 - Math.cos(Math.abs(sweep) / steps / 2));
        for (let i = 0; i <= steps; i++) {
          const t = start + (sweep * i) / steps;
          const u = rx * Math.cos(t),
            v = ry * Math.sin(t);
          box(x + cos * u - sin * v - pad, y + sin * u + cos * v - pad, 2 * pad, 2 * pad, key);
        }
        break;
      }
      case 'fillText':
      case 'strokeText': {
        const text = String(args[0]);
        const px = Number(/(\d+(?:\.\d+)?)px/.exec(String(target.font))?.[1] ?? 10);
        // recordingContext measures 6 px a character; asking it would log an extra call.
        const width = Math.max(text.length * 6, text.length * px * 0.7);
        const align = String(target.textAlign),
          baseline = String(target.textBaseline);
        const left =
          align === 'center' ? -width / 2 : align === 'right' || align === 'end' ? -width : 0;
        const top =
          baseline === 'top' || baseline === 'hanging'
            ? 0
            : baseline === 'middle'
              ? -px / 2
              : baseline === 'bottom' || baseline === 'ideographic'
                ? -px
                : -px * 0.8;
        box(n[1] + left, n[2] + top, width, px * 1.2, key);
        break;
      }
      case 'drawImage': {
        const image = args[0] as { width?: number; height?: number };
        if (args.length >= 9) box(n[5], n[6], n[7], n[8], key);
        else box(n[1], n[2], n[3] ?? image.width ?? 0, n[4] ?? image.height ?? 0, key);
        break;
      }
      default:
        if (!IGNORED.has(key) && !DRAWS.has(key) && key !== 'clearRect') unknown.push(key);
    }
  };
  const ctx = new Proxy(target, {
    get(object, key) {
      const value = object[key as never] as unknown;
      if (typeof key !== 'string' || typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        track(key, args);
        return (value as (...args: unknown[]) => unknown)(...args);
      };
    },
    set(object, key, value) {
      (object as Record<string | symbol, unknown>)[key] = value;
      return true;
    },
  }) as CanvasRenderingContext2D;
  return {
    ctx,
    calls: base.calls,
    fills: base.fills,
    points,
    unknown,
    /** The current transform, for tests that paint from a known camera. */
    matrix: () => [...m] as Matrix,
  };
}
