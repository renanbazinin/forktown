// A node stand-in for CanvasRenderingContext2D. Every method call is recorded with the fill
// colour and translation in effect, property sets are stored, and save/restore behave.
export type RecordedCall = {
  name: string;
  args: unknown[];
  fillStyle: unknown;
  /** The accumulated translate() offset, so local art can be checked in its own coordinates. */
  offset: { x: number; y: number };
};

const STATE = {
  fillStyle: '#000000',
  strokeStyle: '#000000',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  imageSmoothingEnabled: true,
  lineWidth: 1,
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
};

export function recordingContext(width = 1440, height = 900) {
  const calls: RecordedCall[] = [];
  const fills: unknown[] = [];
  let state: Record<string, unknown> = { ...STATE, offset: { x: 0, y: 0 } };
  const stack: Record<string, unknown>[] = [];
  const canvas = { width, height };
  const methods: Record<string, (...args: never[]) => unknown> = {
    save: () => stack.push({ ...state }),
    restore: () => {
      state = stack.pop() ?? state;
    },
    translate: (x: number, y: number) => {
      const offset = state.offset as RecordedCall['offset'];
      state.offset = { x: offset.x + x, y: offset.y + y };
    },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    measureText: (text: string) => ({ width: String(text).length * 6 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getLineDash: () => [],
  };
  const ctx = new Proxy(
    {},
    {
      get(_, key) {
        if (key === 'canvas') return canvas;
        if (typeof key !== 'string') return undefined;
        if (key in state) return state[key];
        return (...args: never[]) => {
          calls.push({
            name: key,
            args,
            fillStyle: state.fillStyle,
            offset: state.offset as RecordedCall['offset'],
          });
          return methods[key]?.(...args);
        };
      },
      set(_, key, value) {
        if (typeof key === 'string') state[key] = value;
        if (key === 'fillStyle') fills.push(value);
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
  return { ctx, calls, fills };
}
