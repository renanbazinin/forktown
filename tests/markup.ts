// Rendered panels as a reader sees them. React escapes & < > " and ' in whatever it renders, so a
// neighbor named "D'Arcy & Bea" reaches the markup as "D&#x27;Arcy &amp; Bea": tests that look for
// a neighbor's name decode the markup first, and read the names out of the rows rather than
// searching the whole page, where a name like "Mark" or "Eve" is part of the panel's own copy.

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#x27': "'",
  '#39': "'",
};

/** Markup with React's escapes undone, in one pass so "&amp;lt;" stays "&lt;". */
export const unescapeHtml = (html: string) =>
  html.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (_, entity: string) => ENTITIES[entity]);

/** The words a reader sees: tags dropped, entities decoded. */
export const readerText = (html: string) => unescapeHtml(html.replace(/<[^>]+>/g, ' '));

/** The names in a panel's neighbor rows (NeighborRow in BrowseRows.tsx), decoded, in drawn order. */
export const rowNames = (html: string) =>
  [
    ...html.matchAll(/<button class="resident-link"[^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>/g),
  ].map((match) => unescapeHtml(match[1]));

/** Names in code-unit order, to compare a panel's rows with who should be in them. */
export const sortedNames = (names: readonly string[]) =>
  [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
