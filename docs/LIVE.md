# Forktown Live

Open `/live/` (or `/forktown/live/` on a repository Pages site) for a clean browser source for OBS or screen recording. `/live` also works on the development server; static hosts may redirect to the trailing slash. The production build includes a real `live/index.html`, so a direct visit or refresh does not need a server rewrite.

The town appears with a small Forktown symbol and a compact glass card in the top-right showing the resident population and latest contributor to join. During a resident follow, a name label travels above that neighbor and a small marker highlights their feet. There are no buttons, zoom controls, tooltips, or cursor. The route supplies the picture and town sound; use your recording software to capture or stream it. It does not save a recording or broadcast to a service itself.

Population counts one resident per occupied home, including the founding neighbors. Latest arrival uses the most recent addition of a current community home in the repository's mainline history, not its latest edit; starter homes are excluded. Builds embed that history locally, without browser API calls. CI fetches full history. Source archives or shallow clones without reliable history show a welcome message instead of guessing an arrival.

## A day in the director's notebook

One town day lasts 24 real minutes. The broadcast uses the same UTC town clock, residents, events, and football as the interactive town. Reloading or joining midway picks up the current scene. This dedicated moving broadcast plays immediately, including when the regular town would initially pause for reduced motion.

- **One minute of neighborhood scenery:** only 05:00–06:00 town time, exactly 60 real seconds per 24-minute cycle. Frame the cat's home street with Miso outside, keeping activity visible even in this wider view. Reloading does not restart the scenery budget.
- **Live gatherings first:** show the Lunch Green's 13:00–16:00 gathering when guests are present, the Little Stage's 19:00–21:00 concert, and the 23:30–02:30 disco. The midnight show stays with the same party across the day boundary.
- **People throughout the day:** between events, follow a resident who is actually outdoors in 45-second clips. Rotate through available neighbors, favoring those cast less recently, with a different starting order each day. Include neighbors watching football so a lone walker does not monopolize the camera; favor walkers when neighbors are equally due a turn. Switch away when a resident goes indoors, using the same rotation for replacements. If only one neighbor is outside, stay with that neighbor until another is available. Keep the name label and foot highlight visible.
- **Football:** cover the full 10:40–13:00 match, including its break and final score. Other live matches fill daytime gaps when no one is walking.
- **Quiet hours:** follow Miso, the small town cat, when everyone is indoors and events are finished. Miso walks a continuous route along the street in front of a home near the Little Stage, and appears in both the interactive town and the live view. The cat does not count toward the resident population or alter residents' chosen routines. Even a town with no homes has Miso outside the stage.
- **Transitions:** ease nearby pans and zooms. Cut directly to distant subjects to avoid traveling over empty land. Keep people and the cat near the center; frame full event venues on both landscape and portrait screens.
- **During a held shot:** gently drift from side to side over 90 seconds and ease up to 4% closer and back over two minutes. Motion stays inside the subject's framing margin and never pulls farther out than the original view. People and cat shots use tracking movement. The motion stays continuous across midnight.

Lunch features can be a picnic, books and lemonade, or lawn games. Concerts can be rock, acoustic, or jazz. The director films the actual town simulation: it does not invent interactions or force residents into new routines.

## Sound for recording

Town music starts automatically when the browser permits audible autoplay. Football kicks, whistles, and cheers use the camera's distance from the ground. Browsers can block sound on a fresh visit: allow sound/autoplay for the site or click anywhere on the page (a key press also retries). No sound button or prompt appears in the recording. Background tabs suspend sound and catch up with the live town when visible again. Ensure the capture browser is active and its audio output is included in your recording setup.
