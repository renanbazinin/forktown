// The turning year's colours, shared by every seasonal motif so they read as one palette.
// Each pair is [day, night]. None of them is a light: amber stays with the lanterns, windows
// and lamps (docs/BRAND.md), so autumn is ochre and russet, and fireflies are green-gold.
// Seasonal art never recolours a neighbour's own choices; it only rests on top of them.

export type Pair = readonly [day: string, night: string];
export const pick = (pair: Pair, night: boolean) => pair[night ? 1 : 0];

export const SNOW = {
  /** Upward faces: roof tops, crowns, caps. Slightly cool, never the paper-lantern cream. */
  top: ['#EEF2EC', '#A7B8B7'] as Pair,
  /** Faces turned from the light, such as the far slope of a gable. */
  shade: ['#D6DFDB', '#8A9DA1'] as Pair,
  /** Falling flakes. */
  flake: ['#F7F8F3', '#CBD7D6'] as Pair,
  /** Frost on grass tufts and meadow heads. */
  frost: ['#E3E9DF', '#7E968F'] as Pair,
  /** Ice glints on the river. */
  ice: ['#E4EEEC', '#8FB0B6'] as Pair,
};

export const BLOSSOM = {
  pink: ['#F1CFD2', '#B3A3AB'] as Pair,
  deep: ['#E2A9B2', '#9D8894'] as Pair,
  white: ['#F7EEE8', '#BFB9B4'] as Pair,
};

/** Autumn foliage, as [leaf, leafLight] targets for a turning crown. */
export const FOLIAGE = {
  ochre: { leaf: ['#B08B3C', '#6A6243'] as Pair, light: ['#CBA653', '#7F7650'] as Pair },
  russet: { leaf: ['#A4603A', '#634A3D'] as Pair, light: ['#C07D4B', '#785A48'] as Pair },
  rust: { leaf: ['#9A4E3A', '#5E443D'] as Pair, light: ['#B8684D', '#72514A'] as Pair },
  /** A larch's needles turn gold rather than russet. */
  larch: { leaf: ['#BE9D48', '#6D6645'] as Pair, light: ['#D5B862', '#837B55'] as Pair },
  /** Bare twigs, seen from a distance: late autumn to the first days of spring. */
  dormant: { leaf: ['#978B76', '#4D5550'] as Pair, light: ['#AFA48C', '#5B6560'] as Pair },
  /** New leaves in early spring, a little lighter than summer. */
  fresh: { leaf: ['#779C58', '#3C6150'] as Pair, light: ['#98B872', '#567B6A'] as Pair },
};

export const FALLEN_LEAVES: readonly Pair[] = [
  ['#C0843F', '#6E5C45'],
  ['#A9633A', '#654D40'],
  ['#CFA052', '#7A6A4C'],
];

export const FIREFLY = { core: '#EEF6B2', halo: '#C4DE7C' };

// The Millpond's own colours. None of them is a light and none repeats a signature swatch
// above, so the season tests can tell the pond's water, ice and reeds apart from snow, blossom,
// foliage and fallen leaves. The ice is winter's alone and joins the snow signature in the tests.
export const POND = {
  /** The middle of the pond; the shallows and open water use the town's own water colours. */
  deep: ['#8FBBBC', '#3E6371'] as Pair,
  /** The damp line where the water meets the bank. */
  shore: ['#93A07A', '#3C5448'] as Pair,
  /** The worn shore path and its stepping stones. */
  path: ['#D9CCA2', '#7B8672'] as Pair,
  stone: ['#C3BCA4', '#76807A'] as Pair,
  /** Light on open water: small streaks that come and go. */
  glint: ['#DCEDEA', '#86A8B0'] as Pair,
  /** A fish rising: one flat ring spreading on still water. */
  ring: ['#D4E6E4', '#8FB3B6'] as Pair,
  /** A leaping fish, silver rather than gold. */
  fish: ['#C6D3D2', '#9FB0B2'] as Pair,
  /** The fish's darker back, so it reads against the water it leaps from. */
  fishBack: ['#62777A', '#7C8F92'] as Pair,
  /** Dawn mist, lying in 2-px bands on the water. */
  mist: ['#E4ECE6', '#8FA4A3'] as Pair,
  lily: ['#7FA36A', '#3F6152'] as Pair,
  lilyLight: ['#96B77C', '#4D7060'] as Pair,
  lilyFlower: ['#F2A7C0', '#9E7F8C'] as Pair,
};

/** The pond's ice, from the first skim at the shore to the last floes of the thaw. */
export const ICE = {
  sheet: ['#D3E4E3', '#7FA3AA'] as Pair,
  /** Dark water showing through a crack, 2 px wide. */
  crack: ['#6F98A0', '#3E6270'] as Pair,
  /** The 1-px highlight on a crack's upper side. */
  crackLight: ['#F4F8F6', '#B7CDD0'] as Pair,
};

/** Reeds: green through spring and summer, straw through autumn, pale straw in winter. */
export const REED = {
  green: ['#6F9656', '#3E5F4C'] as Pair,
  greenLight: ['#89A964', '#4E6E55'] as Pair,
  straw: ['#BDA86A', '#6B684F'] as Pair,
  pale: ['#D6CDA2', '#7B7A63'] as Pair,
};

/** The farm's pumpkin colours, with a darker night stem, reused on doorsteps and in gardens. */
export const PUMPKIN = {
  body: ['#E2A15A', '#B17D4D'] as Pair,
  rib: ['#F4BD6D', '#D29C62'] as Pair,
  stem: ['#648151', '#4C6B52'] as Pair,
  leaf: ['#729454', '#4C6B52'] as Pair,
};

/** The red, green and blue of a '#RRGGBB' colour. */
export const hexChannels = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
// Two-digit hex for every channel value: seasonal colours are mixed on every frame.
const HEX2 = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0').toUpperCase());
const byte = (value: number) => HEX2[Math.max(0, Math.min(255, Math.round(value)))];
/** Upper-case hex for an RGB triple; hex fill styles keep the call-log budgets honest. */
export const toHex = ([r, g, b]: readonly number[]) => '#' + byte(r) + byte(g) + byte(b);

/** Mix two hex colours and return hex. */
export function mixHex(from: string, to: string, amount: number) {
  if (amount <= 0) return from;
  if (amount >= 1) return to;
  const a = hexChannels(from),
    b = hexChannels(to);
  return toHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount));
}
