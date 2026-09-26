import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Two fixes node can't watch happen, pinned in the source the way other wiring tests are: a
// closing dialog hands focus back, and town sound turned off lets the audio device sleep.

/** The text of the block that starts at `start`, up to the line that closes it. */
function block(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  expect(from, start).toBeGreaterThan(-1);
  return source.slice(from, source.indexOf(end, from));
}

describe('A dialog closing', () => {
  const modal = readFileSync('src/components/Modal.tsx', 'utf8');

  it('closes in a layout effect, while the dialog is still in the page', () => {
    const effect = block(modal, 'useLayoutEffect(() => {', '\n  }, []);');
    expect(effect).toContain('const opener = document.activeElement');
    expect(effect).toContain('dialog.showModal()');
    const cleanup = block(effect, 'return () => {', '\n    };');
    expect(cleanup).toContain('dialog.close()');
  });

  it('gives focus back to whatever opened it', () => {
    const cleanup = block(
      block(modal, 'useLayoutEffect(() => {', '\n  }, []);'),
      'return () => {',
      '\n    };',
    );
    expect(cleanup).toMatch(/if \(opener\?\.isConnected\) opener\.focus\(/);
  });
});

describe('Town sound turned off', () => {
  const sound = readFileSync('src/components/Soundtrack.tsx', 'utf8');

  it('lets the audio device sleep once the fade is over, and cancels that if sound comes back', () => {
    const off = block(sound, 'if (!enabled) {', '\n    }\n');
    expect(off).toContain('player.current.stop()');
    expect(off).toMatch(/setTimeout\(\(\) => void quiet\.suspend\(\)/);
    expect(off).toContain('return () => clearTimeout(sleep)');
  });
});
