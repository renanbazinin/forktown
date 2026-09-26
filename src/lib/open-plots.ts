// What the guide and the directory say about room in town, including when there is none.

export const EXPANDING_DOC = 'docs/EXPANDING_THE_TOWN.md';

export const OPEN_PLOTS_COPY = {
  full: 'Every house plot is taken. The town needs to grow before the next house can move in.',
  grow: 'How the town grows',
  noMatch: 'No matches. Try another name.',
};

/** The expansion guide on GitHub, when the town knows its repository. */
export const expandingUrl = (repositoryUrl: string | null) =>
  repositoryUrl ? `${repositoryUrl}/blob/HEAD/${EXPANDING_DOC}` : null;
