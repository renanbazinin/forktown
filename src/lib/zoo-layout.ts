// What stands inside each habitat, in habitat tiles: u runs along x from the habitat's left edge
// (0–6.2) and v along y from its top edge (0–5.4). On screen (0, 0) is the habitat's back corner and
// (6.2, 5.4) its front corner. Solid things are kept clear by the animals' idle wandering; flat
// things (floes, grass, dust) are walked over. The art is in src/city/zoo.ts; the motion reads the
// same footprints in src/lib/zoo.ts, so the two can never disagree.
export type ZooPropKind =
  | 'tree'
  | 'acacia'
  | 'pond'
  | 'pool'
  | 'feeder'
  | 'house'
  | 'shade'
  | 'boulders'
  | 'logs'
  | 'ledge'
  | 'island'
  | 'floe';
export type ZooLayoutProp = {
  kind: ZooPropKind;
  u: number;
  v: number;
  width: number;
  depth: number;
  solid: boolean;
};
export type ZooLayoutSpecies = 'giraffe' | 'elephant' | 'zebra' | 'penguin';

const prop = (
  kind: ZooPropKind,
  u: number,
  v: number,
  width: number,
  depth: number,
  solid = true,
): ZooLayoutProp => ({ kind, u, v, width, depth, solid });

export const ZOO_LAYOUT: Record<ZooLayoutSpecies, readonly ZooLayoutProp[]> = {
  // Row 0: the promenade runs past the front-left edge (v = 5.4), so tall things stand at the back,
  // and the water keeps a tile clear of the front fence so the name board never hides it.
  giraffe: [
    // Framed between the gate's pillars on screen, rather than growing out of the left one.
    prop('acacia', 1.9, 0.6, 0.6, 0.6),
    prop('feeder', 5.1, 0.6, 0.6, 0.6),
    prop('boulders', 0.4, 4.1, 1.1, 0.8),
    prop('pond', 4.5, 3.1, 1.2, 0.8),
  ],
  elephant: [
    prop('tree', 0.5, 0.6, 0.6, 0.6),
    prop('house', 3.8, 0.25, 2.1, 1.25),
    prop('pond', 3.9, 2.9, 1.8, 1.3),
    // By the left fence, leaving the front corner (clear of the name board) to an elephant.
    prop('logs', 0.35, 2.4, 1.3, 0.6),
  ],
  // Row 1: the promenade runs past the back edge (v = 0), so nothing tall stands close behind it.
  zebra: [
    prop('tree', 0.5, 0.6, 0.6, 0.6),
    prop('shade', 0.3, 3.75, 1.4, 1.3),
    prop('boulders', 5.2, 0.4, 0.8, 0.8),
    prop('pond', 4.5, 3.7, 1.2, 0.8),
  ],
  penguin: [
    prop('pool', 0.5, 0.6, 4, 2.3),
    prop('island', 0.9, 0.9, 0.7, 0.5),
    prop('ledge', 4.9, 0.3, 1.1, 0.9),
    // Old ice lying flat on the beach, in no particular order.
    prop('floe', 0.35, 4.35, 0.95, 0.5, false),
    prop('floe', 1.75, 3.55, 0.6, 0.36, false),
    prop('floe', 2.8, 4.6, 0.85, 0.42, false),
    prop('floe', 4.15, 3.8, 0.7, 0.48, false),
  ],
};
