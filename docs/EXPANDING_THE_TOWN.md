# Expanding the town

The town has **200 plots: twenty rows (A–T) and ten columns (1–10)**, twice the previous 100-plot capacity. B5 and C5 hold the stage and green; D3 holds the Lantern Fork; F3–F5 and G3–G5 form the six-plot Meadow Ground; D6, D7, E6, and E7 hold the Starlight Cinema; O4–R9 hold the 24-plot Willow Grove Zoo; S4–T9 hold the 12-plot Moon Harvest Farm, leaving 151 house plots. Every existing house keeps its ID, coordinates, grass, and entrance; existing place JSON and share links need no migration.

## One size setting

Edit `src/lib/town-config.ts`:

```ts
export const TOWN_SIZE = { rows: 20, columns: 10 } as const;
```

For example, change this to `{ rows: 20, columns: 14 }` for 280 plots, or `{ rows: 22, columns: 14 }` for 308. Increase either count or both. The next build derives the plot list, allowed contribution addresses, road graph, terrain edges, and map framing from those counts. The builder and directory discover the new plots automatically. Restart the development server after changing the configuration so browser and local-save validation use the same layout.

## Compatibility rules

- Grow by adding rows and columns. Do not reduce either count in a published town: that could remove someone's plot or invalidate a saved draft.
- Scheduled public venues are configured in `src/lib/events.ts`; multi-plot sites are configured in `town-config.ts` and their site modules (`football.ts`, `cinema.ts`, `zoo.ts`, and `farm.ts`). Their plots must exist and remain reserved; the shared schema, builder, and directory exclude them from house contributions. Public sites remove their internal roads and lamps while preserving perimeter routes. Never reserve an occupied house plot without explicitly relocating its contribution.
- Keep the block spacing, coordinate origin, and address convention fixed. They define existing home positions. Changing them would require an explicit migration.
- Row letters and column numbers are independent of the current town size. Row Z is followed by AA, AB, and so on; A10 follows A9. Existing IDs are never renumbered.
- Place links use the place ID, not an array index or map coordinate. Leave existing place IDs intact.
- Walking destinations may change when roads grow, but resident data and simple routines remain compatible. Shoreline and border scenery move to the new edge.

## Before publishing an expansion

Run `npm run check` and `npm run format:check`. The tests protect the original 25 plots, later growth along either axis, row labels beyond Z, road connectivity, new edge contributions, and shared schema validation.

Inspect the full map and select the furthest new plot on desktop and mobile. Reset fits the whole map; selecting a plot or following a neighbor zooms in so the town remains usable as it grows.

This configuration supports future expansion without scattering size constants across the app. It is not a promise of unlimited rendering capacity: before adding hundreds of occupied homes, profile the canvas and resident simulation and consider terrain caching or districts.

## Long-distance visits

Event trips use 0.32 tiles per town minute. The planner measures the road and venue path, aims to arrive five minutes early, and starts earlier when the resident has free time. Work, home, and sleep routines limit the available window. If a previous outing or work delays departure, residents may arrive late; trips that cannot reach the event before it ends and return before the next commitment are skipped. When necessary they leave the event early to get home on time. Return journeys use the same speed. A trip is planned for the whole day, so crossing noon, evening, or midnight never changes its destination or teleports its resident.

The zoo adds a second afternoon destination for some neighbors outside the green-s audience. Six habitats contain giraffes, elephants, zebras, penguins, and two planted but empty future enclosures. All 24 site plots are reserved, and visitors use the side path and central promenade, outside the animal fences. See `tests/manual/zoo.html` for the interactive zoo and far-away visitor preview.

### Occasional animal moments

Zoo habitats take turns at their own pace: penguins every 113 real seconds, elephants every 137, zebras every 157, and giraffes every 173. Each turn lasts 30 seconds including approach and return, with the main trick lasting about 6-14 seconds. Animals rotate fairly within each habitat. Elephants drink and spray, penguins dive and swim, zebras run two laps and skid, and giraffes stretch for a leafy snack. The shared town clock drives all movement and effects, including across midnight, so pausing and reloading cannot start a different performance. Use the four animal buttons in the zoo preview to jump to a close view of each sequence.
