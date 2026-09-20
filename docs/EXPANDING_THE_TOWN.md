# Expanding the town

The town has **50 plots: five rows (A–E) and ten columns (1–10)**. This doubles the original 25-plot capacity. Every original plot keeps its ID, coordinates, grass, and entrance; existing place JSON and share links need no migration.

## One size setting

Edit `src/lib/town-config.ts`:

```ts
export const TOWN_SIZE = { rows: 5, columns: 10 } as const;
```

For example, change this to `{ rows: 10, columns: 10 }` for 100 plots, or `{ rows: 8, columns: 14 }` for 112. Increase either count or both. The next build derives the plot list, allowed contribution addresses, road graph, terrain edges, and map framing from those counts. The builder and directory discover the new plots automatically. Restart the development server after changing the configuration so browser and local-save validation use the same layout.

## Compatibility rules

- Grow by adding rows and columns. Do not reduce either count in a published town: that could remove someone's plot or invalidate a saved draft.
- Keep the block spacing, coordinate origin, and address convention fixed. They define existing home positions. Changing them would require an explicit migration.
- Row letters and column numbers are independent of the current town size. Row Z is followed by AA, AB, and so on; A10 follows A9. Existing IDs are never renumbered.
- Place links use the place ID, not an array index or map coordinate. Leave existing place IDs intact.
- Walking destinations may change when roads grow, but resident data and simple routines remain compatible. Shoreline and border scenery move to the new edge.

## Before publishing an expansion

Run `npm run check` and `npm run format:check`. The tests protect the original 25 plots, later growth along either axis, row labels beyond Z, road connectivity, new edge contributions, and shared schema validation.

Inspect the full map and select the furthest new plot on desktop and mobile. Reset fits the whole map; selecting a plot or following a neighbor zooms in so the town remains usable as it grows.

This configuration supports future expansion without scattering size constants across the app. It is not a promise of unlimited rendering capacity: before adding hundreds of occupied homes, profile the canvas and resident simulation and consider terrain caching or districts.
