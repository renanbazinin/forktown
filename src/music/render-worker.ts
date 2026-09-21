import { renderPCM } from './render';
import type { TrackId } from './score';
self.onmessage = (event: MessageEvent<TrackId>) => {
  try {
    const mix = renderPCM(event.data);
    self.postMessage(mix, { transfer: [mix.left.buffer, mix.right.buffer] });
  } catch {
    self.postMessage({ error: 'Could not render this tune.' });
  }
};
