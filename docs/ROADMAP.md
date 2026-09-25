# A little room to grow

## The founding edition

- [x] A complete static city with original isometric art
- [x] Six building families and four decorations
- [x] Individual JSON contributions with fixed plots
- [x] Local builder, preview, export, and contribution guide
- [x] Day/night view, search, sharing, and mobile layout
- [x] Contribution validation, meaningful tests, and opt-in publishing
- [x] Connect the repository URL (currently private)
- [x] Publish the founding town on GitHub Pages
- [ ] Verify an external beginner contribution from a fork before public launch
- [ ] Welcome the first real neighbors

## The living edition

- [x] Custom floors, roofs, windows, gardens, and house details
- [x] One resident per contribution with a personal look and greeting
- [x] Three simple routine choices, road strolls, and incidental greetings
- [x] Shared UTC-based 24-minute day, pause/resume-live, and follow-a-neighbor view
- [x] Exterior signs using text or restricted HTML/CSS artwork
- [x] Builder, local saves, examples, validation, and security tests
- [x] Owner review and deployment of the living edition (PR #2, September 20, 2026)
- [ ] Open the repository to public contributors when the owner is ready

## Good early community contributions

- Try the contribution instructions with someone new to GitHub and improve confusing steps.
- Test the directory, builder, and dialogs with assistive technology.
- Add a new decoration or building family with an example and tests for any new data rules.
- Add a translation framework and a first translated guide.
- Add a respectful neighborhood or walking route guided by place stories.

## When the first neighborhood fills up

Increase the row and column counts in `src/lib/town-config.ts`; see [Expanding the town](EXPANDING_THE_TOWN.md). The town currently supports 200 plots while preserving the previous 100 addresses and coordinates. Separate districts remain a future design choice for much larger towns.

## Later experiments

Original pixel sprites, community landmarks, a shared garden, or reviewed interiors. Seasonal scenery has arrived: see [The turning year](THE_TURNING_YEAR.md). Independent projects could connect to the town through a portal directory. Keep the first contribution small and the community credit visible as the world grows.
