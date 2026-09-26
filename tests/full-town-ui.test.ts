import { existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import FullTownNote from '../src/components/FullTownNote';
import Toast from '../src/components/Toast';
import { EXPANDING_DOC, OPEN_PLOTS_COPY, expandingUrl } from '../src/lib/open-plots';

describe('A full town', () => {
  it('says every house plot is taken and links to how the town grows', () => {
    const note = renderToStaticMarkup(
      createElement(FullTownNote, { repositoryUrl: 'https://github.com/someone/forktown' }),
    );
    expect(note).toContain('Every house plot is taken.');
    expect(note).toContain(`href="https://github.com/someone/forktown/blob/HEAD/${EXPANDING_DOC}"`);
    expect(note).toContain(OPEN_PLOTS_COPY.grow);
    expect(existsSync(EXPANDING_DOC)).toBe(true);
  });

  it('names the guide by its path when the town has no repository address', () => {
    expect(expandingUrl(null)).toBeNull();
    const note = renderToStaticMarkup(
      createElement(FullTownNote, { repositoryUrl: null, id: 'full-town-note' }),
    );
    expect(note).toContain(`<code>${EXPANDING_DOC}</code>`);
    expect(note).toContain('id="full-town-note"');
  });

  it('keeps the search miss for a real search', () => {
    expect(OPEN_PLOTS_COPY.noMatch).toBe('No matches. Try another name.');
    expect(OPEN_PLOTS_COPY.full).not.toContain('Try another name');
  });
});

describe('A toast', () => {
  it('renders in place while no dialog is open', () => {
    const toast = renderToStaticMarkup(
      createElement(Toast, { icon: null, onDismiss: () => {}, children: 'Link copied.' }),
    );
    expect(toast).toContain('role="status"');
    expect(toast).toContain('Link copied.');
    expect(toast).toContain('aria-label="Dismiss notification"');
  });
});
