# Forktown FM

The town has its own music, all of it original and all of it written as code: scores of notes
that a small synthesizer plays in your browser. There are no downloaded samples, recordings,
external streams, or music service accounts. The scores and synthesis code are part of this
repository's MIT-licensed source.

## Through the day

The town plays a tune for each stretch of the day (`TOWN_ROTATION` in `src/music/score.ts`).
A town minute is a real second, so each stretch lasts a minute or two and each tune is heard
about once or twice through before the next takes over:

| From  | Tune                    | Played by                                                         |
| ----- | ----------------------- | ----------------------------------------------------------------- |
| 00:00 | Porch Lights            | Pixel bells, soft pad, slow bass (under the party until 02:30)    |
| 02:30 | Small Hours             | Music box, choir, harp, felt piano, crickets                      |
| 04:15 | Blue Before Dawn        | Glow pad, harp, wooden flute, crickets, first birds               |
| 06:00 | Kettle On               | Felt piano, nylon guitar, upright bass, birds, shaker             |
| 07:45 | Bicycle Bells           | Marimba, nylon guitar, upright bass, shaker, soft kick, music box |
| 09:45 | Little Windows, Big Sky | The day theme: pixel bells, soft pad, plucks, bass, light drums   |
| 11:10 | Lemonade Stand          | A bossa: flute, nylon guitar, upright bass, rim, shaker           |
| 13:15 | Window Seat             | Lo-fi: electric piano, kalimba, fingered bass, brushes, vinyl     |
| 15:00 | Teacups and Tulips      | A waltz: flute, strings, nylon guitar, upright bass, harp, vibes  |
| 17:00 | Sun on the Shutters     | Felt piano, strings, nylon guitar, upright bass, brushes, ride    |
| 21:00 | Lamplighter's Round     | A jazz ballad: vibraphone, electric piano, upright bass, brushes  |
| 22:15 | Porch Lights            | The night theme                                                   |

The stage's shows play over them: a rock, acoustic or jazz concert from 19:00 to 21:00, and
**One More Little Dance**, a 112 BPM midnight disco, from 23:30 to 02:30. So does a Bandstand
set, near the stand (below). When the clock reaches the next tune, the one playing finishes its
phrase of four bars first, fading over its last moment, and the next comes in where it ends:
no melody is cut off mid-line (`player.ts`). The next tune is rendered half a minute ahead, so
its turn starts on time. Keys and tempos are chosen so neighbours meet well: the waltz in B♭
hands over to the evening's tune in G, which leads home to the concert's C, and the late jazz
ballad ends on a ii–V into the night theme's C.

## The scores

`src/music/score.ts` holds the six older scores (the day and night themes and the stage's
four shows) as 16-bar phrases, and `src/music/tunes/` one file a tune for the newer ones, each
60 to 110 seconds long with sections that contrast and return. `tunes/kit.ts` keeps them short
to write: note names (`midi('C4')`), chord spellings (`chord('Cmaj7', 3)`, `chord('D/F#')`),
phrases, strums, arpeggios and drum steps, a light, repeatable human touch, and a
transposition that leaves drums and ambience alone. A tune's `TuneInfo` names it, sets its
tempo, length in beats and beats a bar, and its room; `tunes/index.ts` sets its level.

## The instruments

`render.ts` synthesizes the older scores' soft FM bells and keys, plucks, rounded harmonic
leads, bass, and percussion. The newer tunes are written for the instruments in
`src/music/instruments/`, one family a file, each rendering a whole note with state:

- **Keys**: a felt-muted upright piano (struck-string partials, two strings a note, a damper)
  and a tine electric piano with a slow stereo tremolo.
- **Plucked**: nylon guitar, harp and upright bass (Karplus–Strong, tuned with a fractional
  all-pass), and a fingered electric bass.
- **Bars**: marimba, vibraphone, music box and kalimba (modal partials).
- **Sustained**: a breathy wooden flute, a string section, a warm pad and a soft choir.
- **Drums**: a felt-beater kick, brushes and sweeps, a cross-stick, a shaker, a ride and a
  woodblock.
- **Ambience**: a record's crackle, crickets and garden birds.

Every note's noise comes from its own seed, so a tune renders the same everywhere. A tune with
a room gets a stereo hall reverb, and its whole mix settles at its level (`loudness`, an RMS),
so the tunes of the day sit at one volume whatever plays them. Releases, reflections and the
hall wrap across the loop boundary, so every loop is seamless. `synth.ts` renders in a
short-lived worker so it does not compete with the town animation; a tune takes two or three
seconds. `player.ts` caches at most three loops and crossfades between tracks. Only an explicit
click enables sound. Tab visibility and the town's pause control suspend playback; reloading
starts silent. Volume remains adjustable while paused.

## The listening room

Open `http://localhost:5173/music` while running the development server (it is
`tests/manual/music.html`, and only the development server serves it). It shows what the town
is playing now and can tune in to it, lays out the whole day as a timeline you can click or
fast-forward through to hear the handoffs, plays the day's tunes in order as an album, and
lists every record with its instruments, tempo, meter, length and hours. "Check all mixes"
renders the actual audio and measures its peak, RMS level and loop boundary. These checks
catch silence and clipping; they do not replace listening.

For future music contributions, start with a score change and audition it there. Keep a tune
a whole number of four-bar phrases long, leave space in the melody, and test the loop and mix
levels. Do not add someone else's songs or recordings without an appropriate license.
Automated checks live in `tests/music.test.ts` (notes, lengths, the day's turns),
`tests/music-render.test.ts` (rendered audio) and `tests/music-player.test.ts` (playback and
handoffs).

# The Bandstand

The Bandstand's three bands each play an arrangement of their own, in
`src/music/bandstand-tracks.ts`: the brass "Oom-pah on the Lawn", the folk "The Riverbank Reel"
and the strings "Deckchairs at Dusk". See [The Bandstand](BANDSTAND.md).
The music is local, like the cinema's: a live set plays only while the camera is near
the Bandstand, louder as it zooms in and panned by where the stand sits on screen.
It plays over the town's own tune, which eases down as the band comes up (the cinema's
curve) and comes back up, never restarted, when the set ends or the camera leaves: a band
heard faintly from afar never leaves the town near silent. A live stage show plays first. See [Town events](TOWN_EVENTS.md#bandstand-evenings).

# Football sounds

The Meadow Ground adds original synthesized kick, whistle, and crowd effects to the same opt-in Town sound control. Effects follow the match's actual pass, shot, and goal moments; they fade with zoom and camera distance and pan toward the ground. Pausing, muting, hiding the tab, or moving away stops them. Resuming skips missed cues. See [Football at the Meadow Ground](FOOTBALL.md) for the sound and match preview.
