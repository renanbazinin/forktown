# Forktown FM

Six original instrumental scores live in `src/music/score.ts`: a daytime theme,
a sparse nighttime variation, rock, acoustic, and jazz concert arrangements,
and **One More Little Dance**, a 112 BPM midnight disco with offbeat keys,
plucked melody, octave bass, and a soft four-on-the-floor beat.
They use 16-bar phrases with a contrasting bridge and a returning melody.
There are no downloaded samples, external streams, or music service accounts.
The scores and synthesis code are part of this repository's MIT-licensed source.

Open `http://localhost:5173/tests/manual/music.html` while running the development
server to audition every track without changing the town clock. “Check all mixes”
renders the actual audio and measures its peak, RMS level, and loop boundary.
These checks catch silence and clipping; they do not replace listening.

`render.ts` synthesizes soft FM bells and keys, plucks, rounded harmonic leads,
bass, and percussion into stereo loops with short room reflections and delay.
Releases and reflections wrap across the loop boundary. `synth.ts` runs this work
in a short-lived worker so it does not compete with the town animation.
`player.ts` caches at most three loops and crossfades between tracks.
Only an explicit click enables sound. Tab visibility and the town's pause control
suspend playback; reloading starts silent. Volume remains adjustable while paused.

For future music contributions, start with a score change and audition it here.
Keep the 64-beat form, leave space in the melody, and test the loop and mix levels.
Do not add someone else's songs or recordings without an appropriate license.
An automated note validation test lives in `tests/music.test.ts`.

# Football sounds

The Meadow Ground adds original synthesized kick, whistle, and crowd effects to the same opt-in Town sound control. Effects follow the match's actual pass, shot, and goal moments; they fade with zoom and camera distance and pan toward the ground. Pausing, muting, hiding the tab, or moving away stops them. Resuming skips missed cues. See [Football at the Meadow Ground](FOOTBALL.md) for the sound and match preview.
