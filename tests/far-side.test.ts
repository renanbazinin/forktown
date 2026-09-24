import { describe, expect, it } from 'vitest';
import {
  drawCommitStone,
  drawFarFields,
  drawGoldenHour,
  goldenHour,
  horizonY,
  sisterForkLit,
  sisterForkSites,
  SISTER_FORKS,
} from '../src/city/horizon';
import { drawSky } from '../src/city/sky';
import { CALENDAR_EPOCH_DAY } from '../src/lib/town-calendar';

// Records every method call and style change; gradients answer with inert stops.
// Path building is logged too, but budgets count only the calls that do the work.
function recorder() {
  const log: string[] = [];
  const state: Record<string, unknown> = { globalAlpha: 1, fillStyle: '#000', lineWidth: 1 };
  const gradient = {
    addColorStop: (offset: number, color: string) => log.push(`stop ${offset} ${color}`),
  };
  const ctx = new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        log.push(`${key}(${args.join(',')})`);
        if (key.startsWith('create')) return gradient;
      };
    },
    set(target, key: string, value) {
      target[key] = value;
      log.push(`${key}=${String(value)}`);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const calls = () => log.filter((entry) => entry.includes('(') && !entry.startsWith('stop'));
  const vertices = () => calls().filter((call) => /^(moveTo|lineTo)\(/.test(call));
  const drawCalls = () => calls().filter((call) => !/^(beginPath|moveTo|lineTo)\(/.test(call));
  return { ctx, log, calls, vertices, drawCalls };
}

describe('Golden hour', () => {
  it('warms only the edges of the day and is continuous across midnight', () => {
    expect(goldenHour(720)).toBe(0);
    expect(goldenHour(120)).toBe(0);
    expect(goldenHour(1165)).toBe(1);
    expect(goldenHour(375)).toBe(1);
    expect(goldenHour(1110)).toBe(0);
    expect(goldenHour(1220)).toBe(0);
    expect(goldenHour(330)).toBe(0);
    expect(goldenHour(420)).toBe(0);
    expect(goldenHour(1200)).toBeCloseTo(0.3, 2);
    expect(goldenHour(1239)).toBe(0);
    expect(goldenHour(1439.999)).toBe(goldenHour(-0.001));
    expect(goldenHour(0)).toBe(0);
    expect(goldenHour(1165 + 1440 * 3)).toBe(1);
    for (let t = 1100; t < 1230; t += 0.5)
      expect(Math.abs(goldenHour(t + 0.5) - goldenHour(t))).toBeLessThan(0.03);
  });
});

describe('The horizon', () => {
  const screens = [
    [390, 844],
    [800, 600],
    [1440, 900],
    [2560, 1440],
    [3840, 2160],
  ];

  it('keeps both ridges on even rows inside their bands, identically every call', () => {
    for (const [width, height] of screens)
      for (let x = 0; x <= width; x += 4) {
        const far = horizonY(x / width, height, 0),
          near = horizonY(x / width, height, 1);
        expect(far % 2).toBe(0);
        expect(near % 2).toBe(0);
        expect(far).toBeGreaterThanOrEqual(0.22 * height);
        expect(far).toBeLessThanOrEqual(0.3 * height);
        expect(near).toBeGreaterThanOrEqual(0.28 * height);
        expect(near).toBeLessThanOrEqual(0.35 * height);
        expect(near).toBeGreaterThan(far);
        expect(horizonY(x / width, height, 0)).toBe(far);
      }
  });

  it('seats three sister forks on the far ridge near the screen sides', () => {
    expect(SISTER_FORKS.map((fork) => fork.u)).toEqual([0.11, 0.79, 0.91]);
    for (const [width, height] of screens)
      sisterForkSites(width, height).forEach((site, i) => {
        expect(site.x).toBe(Math.round(SISTER_FORKS[i].u * width));
        expect(site.y).toBe(horizonY((Math.floor(site.x / 4) * 4) / width, height, 0));
      });
  });

  it('lights the sister forks with the town at nightfall and puts them out at six', () => {
    expect(sisterForkLit(1199.999)).toBe(false);
    expect(sisterForkLit(1200)).toBe(true);
    expect(sisterForkLit(359.999)).toBe(true);
    expect(sisterForkLit(360)).toBe(false);
    expect(sisterForkLit(1200 - 1440)).toBe(true);
  });

  it('paints the sky within budget and identically for identical inputs', () => {
    for (const minutes of [720, 1165, 1205, 180]) {
      const first = recorder(),
        second = recorder();
      drawSky(first.ctx, 1440, 900, CALENDAR_EPOCH_DAY + 14, minutes);
      drawSky(second.ctx, 1440, 900, CALENDAR_EPOCH_DAY + 14, minutes);
      expect(first.drawCalls().length).toBeLessThanOrEqual(400);
      // Only the steps where a ridge changes height become path vertices.
      expect(first.vertices().length).toBeLessThanOrEqual(800);
      expect(first.log).toEqual(second.log);
    }
  });

  it('adds a warm rim and warm lower sky only in golden hour', () => {
    const noon = recorder(),
      evening = recorder();
    drawSky(noon.ctx, 1440, 900, CALENDAR_EPOCH_DAY, 720);
    drawSky(evening.ctx, 1440, 900, CALENDAR_EPOCH_DAY, 1165);
    expect(noon.log).not.toContain('fillStyle=#F2D8A8');
    expect(evening.log).toContain('fillStyle=#F2D8A8');
    expect(noon.log).toContain('stop 0.44 rgb(222 226 205)');
    expect(evening.log.find((entry) => entry.startsWith('stop 0.44'))).not.toBe(
      'stop 0.44 rgb(222 226 205)',
    );
  });

  it('shows lanterns and windows on the sister forks only after nightfall', () => {
    const dusk = recorder(),
      night = recorder();
    drawSky(dusk.ctx, 1440, 900, CALENDAR_EPOCH_DAY, 1199);
    drawSky(night.ctx, 1440, 900, CALENDAR_EPOCH_DAY, 1201);
    expect(dusk.log).not.toContain('fillStyle=#FFE0A0');
    expect(dusk.log.filter((entry) => entry === 'fillStyle=#E9DDB8')).toHaveLength(3);
    expect(night.log.filter((entry) => entry === 'fillStyle=#FFE0A0')).toHaveLength(3);
  });

  it('paints the hills and sister forks opaque whatever alpha the sky left behind', () => {
    for (const minutes of [720, 1165, 1225, 180]) {
      // Keeps a save/restore stack like a real canvas and notes the alpha of every draw.
      const draws: { call: string; style: string; alpha: number }[] = [];
      const stack: { globalAlpha: number; fillStyle: string }[] = [];
      let state = { globalAlpha: 1, fillStyle: '#000' };
      const gradient = { addColorStop() {} };
      const ctx = new Proxy(
        {},
        {
          get(_, key: string) {
            if (key in state) return state[key as keyof typeof state];
            return () => {
              if (key === 'save') stack.push({ ...state });
              if (key === 'restore') state = stack.pop() ?? state;
              if (key === 'fill' || key === 'fillRect')
                draws.push({ call: key, style: state.fillStyle, alpha: state.globalAlpha });
              if (key.startsWith('create')) return gradient;
            };
          },
          set(_, key: string, value) {
            (state as Record<string, unknown>)[key] = value;
            return true;
          },
        },
      ) as unknown as CanvasRenderingContext2D;
      drawSky(ctx, 1440, 900, CALENDAR_EPOCH_DAY + 14, minutes);
      const fills = draws.filter((draw) => draw.call === 'fill');
      // The far and near ridges are the last two path fills.
      expect(fills.slice(-2).map((fill) => fill.alpha)).toEqual([1, 1]);
      const farRidge = draws.lastIndexOf(fills.at(-2)!);
      const forks = draws.slice(farRidge + 1);
      const body = forks[0].style;
      expect(forks.filter((draw) => draw.style === body).length).toBeGreaterThan(0);
      for (const draw of forks.filter((draw) => draw.style === body)) expect(draw.alpha).toBe(1);
    }
  });
});

describe('Far fields and commit stones', () => {
  it('paints the far fields cheaply and deterministically, restoring alpha', () => {
    for (const night of [false, true]) {
      const first = recorder(),
        second = recorder();
      drawFarFields(first.ctx, night);
      drawFarFields(second.ctx, night);
      expect(first.calls().length).toBeLessThanOrEqual(60);
      expect(first.log).toEqual(second.log);
      expect(first.calls().filter((call) => call.startsWith('save'))).toHaveLength(
        first.calls().filter((call) => call.startsWith('restore')).length,
      );
      expect(first.log).toContain(`fillStyle=${night ? '#45605A' : '#B3C697'}`);
      expect(first.log.filter((entry) => entry.startsWith('globalAlpha='))).toEqual(
        expect.arrayContaining(['globalAlpha=0.55', 'globalAlpha=0.32', 'globalAlpha=0.14']),
      );
    }
  });

  it('uses brass only for the stones around the Fork', () => {
    const styles = (night: boolean, brass: boolean) => {
      const { ctx, log } = recorder();
      drawCommitStone(ctx, 10, 20, night, brass);
      return log.filter((entry) => entry.startsWith('fillStyle='));
    };
    expect(styles(false, false)).toEqual(['fillStyle=#EEE6CC', 'fillStyle=#CFC6A3']);
    expect(styles(true, false)).toEqual(['fillStyle=#8E9A89', 'fillStyle=#6C7C6F']);
    expect(styles(false, true)).toEqual(['fillStyle=#E4C98A', 'fillStyle=#B89A5E']);
    expect(styles(true, true)).toEqual(['fillStyle=#A2946B', 'fillStyle=#7A6E50']);
  });

  it('washes the frame gold only in golden hour, never above 0.05', () => {
    const noon = recorder();
    drawGoldenHour(noon.ctx, 1440, 900, 720);
    expect(noon.log).toEqual([]);
    const evening = recorder();
    drawGoldenHour(evening.ctx, 1440, 900, 1165);
    expect(evening.calls().filter((call) => call.startsWith('fillRect'))).toEqual([
      'fillRect(0,0,1440,900)',
    ]);
    const alpha = evening.log.find((entry) => entry.startsWith('globalAlpha='))!;
    expect(Number(alpha.split('=')[1])).toBeLessThanOrEqual(0.05);
  });
});
