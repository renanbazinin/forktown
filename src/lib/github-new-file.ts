import { HOUSE_PLOTS } from './events';
import { availableId, pickDraftNames } from './draft-names';
import { BUILDER_DEFAULT_STORY } from './lanterns';
import { DEFAULT_DESIGN, DEFAULT_RESIDENT, DEFAULT_SIGN, type Place } from './schema';
import { hash } from './world';

// The published town saves nothing. For an open plot it builds a complete house file and hands it
// to GitHub's own editor, which forks the town for a newcomer who needs a fork and ends in their
// pull request. Nothing leaves the page except inside the link it builds.

/** The branch a new house is proposed to. */
export const HOUSE_BRANCH = 'main';
/** What `creator` says until a newcomer types a username, as in the examples. */
export const CREATOR_PLACEHOLDER = 'your-github-username';
/** Where CONTRIBUTING.md explains every field of a house file. */
export const FIELD_GUIDE = 'CONTRIBUTING.md#or-write-one-file-yourself';
// GitHub's rules: letters, digits and single hyphens, no hyphen at either end, at most 39.
const USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** A typed username without spaces or a leading @, and what stops it being a creator. */
export function readUsername(input: string): { username: string; problem?: string } {
  const username = input.trim().replace(/^@/, '');
  // Empty is fine: the file keeps the placeholder, and the panel asks for a username.
  if (!username) return { username };
  if (username.length > 39)
    return { username, problem: 'A GitHub username has at most 39 characters.' };
  if (!USERNAME.test(username))
    return {
      username,
      problem: 'Use your GitHub username: letters, numbers and single hyphens, without spaces.',
    };
  if (username.toLowerCase() === 'forktown')
    return {
      username,
      problem: 'The forktown credit is reserved for starter places. Use your own username.',
    };
  return { username };
}

/** A house plot that nobody lives on. Public venues and taken plots never qualify. */
export const isOpenPlot = (plot: string, places: readonly Pick<Place, 'plot'>[]) =>
  HOUSE_PLOTS.some((candidate) => candidate.id === plot) &&
  !places.some((place) => place.plot === plot);

/** The same plot suggests the same names, until someone in town takes them. */
export function starterNames(plot: string, places: readonly Place[]) {
  let draw = 0;
  return pickDraftNames(places, () => (hash(`start-house:${plot}:${draw++}`) % 10_000) / 10_000);
}

/**
 * A complete house for an open plot, the way the builder starts one, credited to `username`.
 * Null when the plot is not open or the username cannot be a creator.
 */
export function starterHouse(
  plot: string,
  places: readonly Place[],
  username = '',
  names = starterNames(plot, places),
): Place | null {
  const creator = readUsername(username);
  if (creator.problem || !isOpenPlot(plot, places)) return null;
  return {
    id: availableId(names.placeName, places),
    name: names.placeName,
    creator: creator.username || CREATOR_PLACEHOLDER,
    plot,
    building: 'cottage',
    color: '#789B76',
    decoration: 'flowers',
    // The examples' story, which the Fork never tells as a tale: a newcomer writes their own.
    story: BUILDER_DEFAULT_STORY,
    design: { ...DEFAULT_DESIGN },
    resident: {
      ...DEFAULT_RESIDENT,
      name: names.residentName,
      routine: { ...DEFAULT_RESIDENT.routine },
    },
    sign: { ...DEFAULT_SIGN },
  };
}

/** Written like the examples: two-space indents and a final newline. */
export const houseFile = (place: Place) => JSON.stringify(place, null, 2) + '\n';

/** GitHub's editor for a new, empty file in places/. */
export const blankHouseFileUrl = (repositoryUrl: string) =>
  `${repositoryUrl}/new/${HOUSE_BRANCH}/places`;

/** The same editor with the file already named after the house and filled in. */
export const newHouseFileUrl = (repositoryUrl: string, place: Place) =>
  `${blankHouseFileUrl(repositoryUrl)}?filename=${encodeURIComponent(`${place.id}.json`)}&value=${encodeURIComponent(houseFile(place))}`;

/**
 * The longest filled-in link we hand GitHub. Signed in, GitHub turns away links past about 8,190
 * characters; signed out, it sends the link on through its sign-in page, encoded once more, and
 * that fails from about 7,000. Houses in town make links of 2,000–2,500; only long sign artwork
 * gets near this.
 */
export const HOUSE_LINK_LIMIT = 6_000;

/** The filled-in link, or null when it is too long for GitHub and the house goes by copy. */
export function houseFileLink(repositoryUrl: string, place: Place) {
  const url = newHouseFileUrl(repositoryUrl, place);
  return url.length <= HOUSE_LINK_LIMIT ? url : null;
}
