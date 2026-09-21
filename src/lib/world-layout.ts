export type Point = { x: number; y: number };
export type Plot = { id: string; col: number; row: number; x: number; y: number };
export type TownSize = { rows: number; columns: number };
export type PublicSite = TownSize & { row: number; col: number };
export const BLOCK_SIZE = 4;
export const ROAD_MIN = 1;

function rowLabel(row: number) {
  let label = '';
  for (let value = row + 1; value > 0; value = Math.floor((value - 1) / 26))
    label = String.fromCharCode(65 + ((value - 1) % 26)) + label;
  return label;
}

export function createWorldLayout({ rows, columns }: TownSize, sites: readonly PublicSite[] = []) {
  if (![rows, columns].every((n) => Number.isSafeInteger(n) && n > 0))
    throw new Error('Town rows and columns must be positive whole numbers.');
  const roadMaxX = ROAD_MIN + columns * BLOCK_SIZE;
  const roadMaxY = ROAD_MIN + rows * BLOCK_SIZE;
  const plots: Plot[] = Array.from({ length: rows * columns }, (_, i) => {
    const col = i % columns,
      row = Math.floor(i / columns);
    return {
      id: `${rowLabel(row)}${col + 1}`,
      col,
      row,
      x: 3 + col * BLOCK_SIZE,
      y: 3 + row * BLOCK_SIZE,
    };
  });
  const byId = new Map(plots.map((plot) => [plot.id, plot]));
  for (const site of sites)
    if (
      ![site.row, site.col, site.rows, site.columns].every(Number.isSafeInteger) ||
      site.row < 0 ||
      site.col < 0 ||
      site.rows < 1 ||
      site.columns < 1 ||
      site.row + site.rows > rows ||
      site.col + site.columns > columns
    )
      throw new Error('Public sites must fit inside the town.');
  const insideSite = (x: number, y: number) =>
    sites.some(
      (site) =>
        x >= 2 + site.col * BLOCK_SIZE &&
        x < 1 + (site.col + site.columns) * BLOCK_SIZE &&
        y >= 2 + site.row * BLOCK_SIZE &&
        y < 1 + (site.row + site.rows) * BLOCK_SIZE,
    );
  // Repeat the original four-lamp pattern as more blocks are added.
  const lampPattern = new Set(['1,2', '3,1', '0,3', '2,0']);
  const streetlights = plots
    .filter(
      (plot) => plot.col > 0 && plot.row > 0 && lampPattern.has(`${plot.col % 4},${plot.row % 4}`),
    )
    .map((plot) => ({ x: ROAD_MIN + plot.col * BLOCK_SIZE, y: ROAD_MIN + plot.row * BLOCK_SIZE }))
    .filter((point) => !insideSite(point.x, point.y));
  const isRoad = (x: number, y: number) =>
    x >= ROAD_MIN &&
    x <= roadMaxX &&
    y >= ROAD_MIN &&
    y <= roadMaxY &&
    !insideSite(x, y) &&
    (x % BLOCK_SIZE === ROAD_MIN || y % BLOCK_SIZE === ROAD_MIN);
  return {
    rows,
    columns,
    plots,
    streetlights,
    roadMaxX,
    roadMaxY,
    width: roadMaxX + 3,
    height: roadMaxY + 3,
    getPlot: (id: string) => byId.get(id),
    isRoad,
    findPlotAt: (x: number, y: number) => {
      const col = Math.floor((x - 2) / BLOCK_SIZE),
        row = Math.floor((y - 2) / BLOCK_SIZE);
      if (col < 0 || col >= columns || row < 0 || row >= rows) return undefined;
      const plot = plots[row * columns + col];
      return x < plot.x + 2 && y < plot.y + 2 ? plot : undefined;
    },
  };
}
