// Browser-only: vite.config.ts loads schema.ts -> events.ts -> lanterns.ts before the define
// exists, so the build constant is read here rather than in lanterns.ts.

/** The build's arrival order, newest first. One shared instance so memos keyed on it can hit. */
export const townArrivals: readonly string[] = __TOWN_ARRIVALS__;
