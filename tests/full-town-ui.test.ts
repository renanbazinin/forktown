import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Toast from '../src/components/Toast';

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
