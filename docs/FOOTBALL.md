# Football at the Meadow Ground

The town now has 100 plots. Six new, unoccupied plots — F3, F4, F5, G3, G4, G5 — form one public ground beside the original neighborhood. The pitch has striped grass, white markings, two netted goals, corner flags, benches, a refreshment cart, and an elevated scoreboard. Its internal roads, streetlights, trees, and plot outlines are removed; roads around its perimeter remain connected. All six plots are excluded from the builder and shared contribution validation.

## A match worth stopping for

Meadow FC wear green; Sunset United wear amber. Each side has three outfield players and a goalkeeper in a contrasting shirt. Games repeat from 06:00 until 20:00 town time. Each cycle takes 140 real seconds: a 60-second first half, eight-second half-time, a 60-second second half, then 12 seconds to enjoy the result before the next kickoff. The scoreboard presents this as a ten-minute mini-match. Six matches fit into daylight exactly.

Possessions include a dribble, a wing pass, a switch across the pitch, a ball into the middle, and a shot. The seeded match varies attacking side, wing, and goals, saves, or near misses. Players and the ball interpolate continuously between these moments, then return to their starting positions for the next possession. A goal is recorded when the ball reaches the goal line; shots, keeper saves, the on-field scoreboard, commentary, and sound all use the same timeline. Both teams celebrate goals with their supporters.

This is a deterministic animated match, not a physics engine or user-controlled sports game. It has no tackles, fouls, offside decisions, injuries, extra time, persistent league, or multiplayer. Day number and match number determine the sequence, so viewers with agreeing clocks see the same score and play. Pause freezes the view; resuming rejoins the live match. Reduced-motion preferences start the town paused.

Eight public supporters make the touchline feel alive. Like the stage performers, these are town scenery, not contributed residents. Up to six eligible morning or afternoon strollers can also watch, selected from half of the available walkers. Scheduled lunch guests take priority; work, home, and sleep routines are respected. Visitors enter from the south perimeter road, stay outside the touchline, and return to their own doorsteps before their next routine period. Their directory status says they are watching football.

## Watch and listen

Choose **Town events → football**, click the ground or its scoreboard, or open `#venue=football`. The camera fits the ground beside the desktop panel or above the mobile panel. The panel shows team colors, the score, match clock, commentary, shots, saves, and crowd count. Zoom buttons keep the selected pitch centered as you get closer.

Use **Town sound → Turn sound on** to enable sound. Kicks, whistles, and cheers are short original synthesized effects sharing the town volume control. They fade with zoom and distance from the center of the view, pan toward the pitch, and fall silent when the ground is off screen. No audio starts without a click. Muting, pausing, or hiding the page stops effects; reconnecting or seeking skips missed sounds instead of replaying them in a burst. The ground is quiet at night while the Little Stage keeps its own program.

## Implementation and checks

- `src/lib/football.ts`: the reserved site, pure match state, goals, statistics, sound cues, and camera audibility.
- `src/city/football.ts`: pitch, scoreboard, goals, players, ball, crowd, and furnishings. Objects share the town's depth sorting.
- `src/lib/simulation.ts`: contributor spectator trips on the existing road graph.
- `src/components/FootballMatch.tsx`: accessible live match detail; `TownEvents.tsx` provides keyboard entry.
- `src/music/football-sound.ts`, `player.ts`, and `Soundtrack.tsx`: effect synthesis, playback lifecycle, and proximity gating.

Run `npm run check` and `npm run format:check`. Tests cover doubled capacity with stable old coordinates, reservations, perimeter routes, continuous movement, daylight boundaries, score/ball agreement, crowd routines, sound envelopes, proximity, and pause/mute cleanup.

With the development server running, `/tests/manual/football.html` provides a daylight match preview with pause, time, zoom, next match, night view, and explicit sound controls. It exercises the real renderer and simulation without changing the live town clock or house files.
