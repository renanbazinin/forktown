import { draftSchema, type Place } from './schema';
import { availableId, pickDraftNames } from './draft-names';
import { restoreDraftDesign, restoreDraftPlot } from './builder-nudges';

/**
 * A draft saved on this device, brought up to date with the town, or null when it can't be read.
 * Its plot moves first: a draft on a plot that was taken or reserved since (a new venue, a tube
 * halt) keeps its design, names and story on the nearest open plot instead of being dropped.
 */
export function restoreSavedDraft(
  saved: unknown,
  plot: string | undefined,
  places: readonly Place[],
  available: readonly { id: string }[],
): Place | null {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
  const savedPlot = (saved as { plot?: unknown }).plot;
  const moved = restoreDraftPlot(
    plot ?? (typeof savedPlot === 'string' ? savedPlot : ''),
    available,
  );
  const result = draftSchema.safeParse({ ...saved, plot: moved });
  if (!result.success) return null;
  const restored = result.data;
  if (restored.name === 'My Little Place' || restored.resident.name === 'New neighbor') {
    const { placeName, residentName } = pickDraftNames(places);
    if (restored.name === 'My Little Place') {
      if (/^my-little-place(?:-\d+)?$/.test(restored.id))
        restored.id = availableId(placeName, places);
      restored.name = placeName;
    }
    if (restored.resident.name === 'New neighbor')
      restored.resident = { ...restored.resident, name: residentName };
  }
  return { ...restored, design: restoreDraftDesign(restored.design) };
}
