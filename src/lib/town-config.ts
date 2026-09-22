// Grow these counts to add land. Existing plot IDs and coordinates stay fixed.
// See docs/EXPANDING_THE_TOWN.md before changing a published town.
export const TOWN_SIZE = { rows: 20, columns: 10 } as const;
// Six connected plots, with roads retained around the outside.
export const FOOTBALL_SITE = { row: 5, col: 2, rows: 2, columns: 3 } as const;
export const CINEMA_SITE = { row: 3, col: 5, rows: 2, columns: 2 } as const;
// O4–R9: six spacious habitats and pedestrian paths, on previously undeveloped land.
export const ZOO_SITE = { row: 14, col: 3, rows: 4, columns: 6 } as const;
// S4–T9: a continuous field with streets only around its perimeter.
export const FARM_SITE = { row: 18, col: 3, rows: 2, columns: 6 } as const;
