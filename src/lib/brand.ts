// The Lantern Fork identity as plain data: one tagline, one palette, one mark.
// Tests read it in node, so nothing here touches the DOM.

export const TAGLINE = 'A little town, built one pull request at a time.';
export const TITLE = 'Forktown — a little town, built one pull request at a time';

// Mirrors the tokens in styles.css; tests/brand.test.ts keeps the two in step.
export const BRAND = {
  paper: '#F8F7F2',
  surface: '#FDFCF8',
  ink: '#343E35',
  muted: '#5F6B57',
  line: '#E4E5DA',
  green: '#516B42',
  greenDeep: '#405934',
  greenPale: '#EEF1E6',
  leaf: '#769267',
  lantern: '#F2C06B',
  lanternInk: '#8A5A1C',
  lanternPale: '#FFF6DF',
  glow: '#FFE0A0',
  timber: '#AD9069',
  timberInk: '#6F5A3C',
  dusk: '#263C3C',
  duskSurface: '#2B4242',
  duskRaised: '#30494A',
  duskLine: '#45605C',
  duskInk: '#F1EEDC',
  duskMuted: '#C3D4C2',
  duskLink: '#BFD8A6',
} as const;

export type BrandColor = keyof typeof BRAND;

export const CSS_TOKENS = Object.fromEntries(
  Object.keys(BRAND).map((key) => [
    key,
    `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
  ]),
) as Record<BrandColor, string>;

// The night focus ring; the day ring (#739b76) is too faint on dusk panels.
export const NIGHT_FOCUS = '#A9CFA0';

type MarkColor = 'road' | 'moss' | 'leaf' | 'leafLight' | 'timber' | 'lantern' | 'glow';

// A trunk forks in two: a sage canopy on the left limb, a paper lantern on the right.
// The single source for the header mark, the favicon and the /live watermark.
export const MARK_PIXELS: readonly (readonly [number, number, number, number, MarkColor])[] = [
  [6, 27, 20, 2, 'road'],
  [14, 18, 4, 9, 'moss'],
  [11, 15, 4, 4, 'moss'],
  [8, 12, 4, 4, 'moss'],
  [17, 15, 4, 4, 'moss'],
  [20, 13, 4, 3, 'moss'],
  [6, 4, 5, 1, 'leaf'],
  [5, 5, 7, 1, 'leaf'],
  [4, 6, 9, 5, 'leaf'],
  [5, 11, 7, 1, 'leaf'],
  [7, 12, 4, 1, 'leaf'],
  [5, 6, 3, 2, 'leafLight'],
  [23, 2, 1, 1, 'timber'],
  [21, 3, 5, 1, 'timber'],
  [21, 4, 5, 7, 'lantern'],
  [20, 5, 7, 5, 'lantern'],
  [22, 6, 3, 3, 'glow'],
  [21, 11, 5, 1, 'timber'],
  [23, 12, 1, 1, 'timber'],
];

// The lantern keeps its colours at night: it is the light.
export const MARK_COLORS: Record<'day' | 'night', Record<MarkColor | 'tile', string>> = {
  day: {
    tile: '#EEF1E6',
    road: '#C9B48B',
    moss: '#516B42',
    leaf: '#769267',
    leafLight: '#95B478',
    timber: '#6F5A3C',
    lantern: '#F2C06B',
    glow: '#FFE0A0',
  },
  night: {
    tile: '#263C3C',
    road: '#8C7F62',
    moss: '#9DB88A',
    leaf: '#6F9A6A',
    leafLight: '#B5CFA0',
    timber: '#3E3A30',
    lantern: '#F2C06B',
    glow: '#FFE0A0',
  },
};

export function markSvg({ tile = false, night = false }: { tile?: boolean; night?: boolean } = {}) {
  const colors = MARK_COLORS[night ? 'night' : 'day'];
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">',
    tile ? `<rect width="32" height="32" rx="7" fill="${colors.tile}"/>` : '',
    ...MARK_PIXELS.map(
      ([x, y, w, h, color]) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${colors[color]}"/>`,
    ),
    '</svg>',
  ].join('');
}

// Relative luminance contrast, as WCAG defines it.
export function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const WELCOME_KEY = 'forktown-welcomed-v1';

// Deep links win over the welcome; a broken storage greets once per session instead of never.
export function shouldWelcome(hash: string, storage: Pick<Storage, 'getItem'> | null) {
  if (/(?:^|[#&])(?:place|venue)=/.test(hash)) return false;
  if (!storage) return true;
  try {
    return storage.getItem(WELCOME_KEY) === null;
  } catch {
    return true;
  }
}

export const WELCOME_COPY = {
  eyebrow: 'WELCOME TO FORKTOWN',
  title: 'Every house here started as a fork.',
  body: (neighbors: number, newest?: string) =>
    `${neighbors} neighbors so far, and each one has a lantern on the Lantern Fork.${newest ? ` The newest belongs to ${newest}.` : ''}`,
  note: 'At nightfall the lanterns come on, oldest first. Nightfall comes every 24 minutes.',
  findWayIn: 'Find your way in',
  visitFork: 'Visit the Fork',
  close: 'Close welcome',
};

export const GUIDE_COPY = {
  eyebrow: 'A LANTERN OF YOUR OWN',
  intro: 'Every house here started as a fork. Yours can too.',
  steps: [
    ['Fork the town', 'Make your own copy on GitHub and run it on your computer.'],
    ['Build your house', 'Pick an empty plot, design your place, and write its story.'],
    [
      'Open a pull request',
      "Send your house back to the town. Once it's merged, you move in and your lantern joins the Fork.",
    ],
  ],
} as const;

export const PLOT_COPY = {
  title: 'Room for one more lantern.',
  hint: 'Build a house here and your lantern joins the Fork.',
  row: 'Room for a lantern',
  tooltip: (plot: string) => `Plot ${plot} · Room for one more lantern`,
  map: 'Interactive map of Forktown. The Lantern Fork stands at the heart of town, with a lantern for every neighbor. Drag to pan, scroll or use plus and minus to zoom. Arrow keys move the map; Home shows the whole town. Use Explore places to select a house with a keyboard.',
};
