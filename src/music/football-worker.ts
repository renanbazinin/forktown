import { FOOTBALL_SOUND_KINDS, FOOTBALL_SOUND_TAKES, renderFootballSound } from './football-sound';
// Every take of every touchline effect, rendered off the main thread at the context's rate.
self.onmessage = (event: MessageEvent<number>) => {
  try {
    const takes = FOOTBALL_SOUND_KINDS.flatMap((kind) =>
      Array.from(
        { length: FOOTBALL_SOUND_TAKES[kind] },
        (_, take) => [`${kind}:${take}`, renderFootballSound(kind, event.data, take)] as const,
      ),
    );
    self.postMessage(takes, { transfer: takes.map(([, data]) => data.buffer) });
  } catch {
    self.postMessage({ error: 'Could not prepare the football sounds.' });
  }
};
