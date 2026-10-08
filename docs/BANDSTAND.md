# The Bandstand

A low bandstand stands on the north half of **K15**, by the river at the Riverside, with eight deckchairs on the lawn in front of it. Every day of the year a band plays two sets there: a **teatime set** 16:00–17:30 and a **sundown set** 18:15–20:00. The day's band is `bandOf(day)` (`hash('bandstand:' + day) % 3`), the same for both sets: brass, folk or a string trio. Who comes, when and where they sit is the planner's (see [Town events](TOWN_EVENTS.md#bandstand-evenings)); this page is about what you see and hear. Open `#venue=bandstand`, or click the stand or its lawn.

## The stand

An octagonal stone plinth about 1.4 tiles across (0.72-tile corners) with a timber deck 4 px up and two stone steps down to the lawn. Six slender white posts hold the cap round the back and the sides, and the front three edges stay open to the chairs and to us. Low railings run round the back behind the players and down the two front sides in front of them. The cap is shallow: a cream valance with darker scallops along its hem at 32–34 px, eight wedges in sage green and cream that meet at the peak at 36.5 px, and the peak lamp on top under its own small green hood. **Nothing rises more than 40 px** over the stand's centre (`BANDSTAND_HEIGHT`), the stage's rule for the front row.

The stand sits in a ring of pale gravel on its own tended lawn, with a few tufts that turn with the year like the town's grass. In spring the blossom's petals settle on the cap a few at a time, and in autumn a few leaves; both are part of the cap's cached art and change once a day. In winter snow settles on the cap with the roofs round it, lit on the left and shaded on the right, and leaves a rim of the stripes and the valance showing.

## The players

The players are scenery. They are never neighbors, never named and never counted.

| Band    | Left                       | Middle             | Right                   |
| ------- | -------------------------- | ------------------ | ----------------------- |
| brass   | tuba, bell beside the head | cornet, held level | bass drum on a strap    |
| folk    | squeezebox                 | fiddle             | guitar                  |
| strings | violin, on a chair         | viola, on a chair  | cello between the knees |

The brass band wears navy with peaked caps; the squeezebox player a flat cap. Everyone faces the lawn (`sw`) along the front of the deck, where the cap's valance falls just above their heads. In winter each wears a scarf.

- **15:45** they fade in at their places and tune up: instruments in hand, nothing played.
- **16:00–17:30** the teatime set. They play in time with their own arrangement's tempo (`BAND_BPM`: brass 96, folk 104, strings 84): the tuba's bell sways, the cornet tips up at the end of the beat, the beater swings in on it, bows draw and the squeezebox breathes. Small pixel notes rise from the cap, three in the air at a time, fading in and out over two minutes. They are olive by day and pale at night, never amber, and so are the notes over the listeners when they cheer (`BANDSTAND_NOTE` in `src/city/residents.ts`).
- **17:30–18:15** tea on the steps. Each player walks down to the front edge in half a minute and sits there with a cup, lifting it now and then; a teapot stands on the lower step between the first two. Their instruments wait where the players on the front edge leave them in sight: at the deck's two ends between the side posts, and flat on the boards at the back. They come into view as the players reach the front edge, and go as the players take them up again.
- **18:15–20:00** the sundown set.
- **20:00–20:15** they pack up, and fade out by 20:15.

## The deckchairs

Eight striped deckchairs, sage, rose and sky with cream, stand on the lawn's eight spots facing the stand. They are out from 15:35 to 20:20 (`BANDSTAND_FURNITURE.chairs`), every day: one at a time from 15:26, each over most of a minute, and gathered in one at a time from 20:20. The rest of the day they lie folded in a stack by the stand's east side. Every listener of the year arrives after 15:35 and has gone by 20:20, so a guest never sits in a chair that is not fully there (tested over the full town's year).

Each chair is drawn in two parts: its seat, front legs and shadow just under its guest (depth − 0.01), and its striped back just over them (depth + 0.01). From behind, as we see them, a row of deckchairs shows the canvas with each guest's head and shoulders over it. The back's top meets a perched guest's shoulders (20 px up); for a guest sunk low in the canvas (`sip`, or the waiting `sit`) it is let down 5 px, and 2 px while they are halfway down (`crouch`), so their head still shows. It reads the frame's residents for that, and adds no draw calls.

## The listeners

Guests are seated (the deckchairs), so the planner crouches them sitting down and getting up. Their poses come from `src/lib/outings/bandstand.ts`, existing poses only:

- **Teatime:** `perch` and `tea` (perched, with a cup). **Sundown:** `perch` and `sip` (a cool drink, sunk low in the canvas).
- Settled, each guest starts with two calm minutes perched, then takes runs of one pose, 4 to 8 minutes long by their own hash. Between `perch` and the low `sip` they pass through `crouch`, so nobody drops into the canvas in a single frame.
- Waiting before a set they `sit` (the planner's waiting pose); when the band strikes up they sit up through a `crouch`.
- **Applause:** in each set's last five minutes, a guest gets up (a `crouch`, then `cheer`) at a moment of their own, 2.5 to 5 minutes before the end, and cheers to the end. A guest who stays on afterwards sits back down for a last listen; one who leaves soon after stands until they go.
- Every pose is held a minute at least, and the applause comes only in a set's last five minutes (`tests/bandstand.test.ts`).

## The peak lamp

The lamp at the peak lights in the streetlamp wave, at its distance from the Fork (`PEAK_LAMP_LIGHTS`, between 20:20 and 20:30), warms up over a minute, and stays lit until 06:00. It is lit light, so it is amber, and it is a lamp, never a lantern. It sends a soft glow round the cap and a fainter pool onto the deck under it, as if from within. **On star nights it is not lit at all** (`starNight` of its evening), so the sky stays dark for the stargazers on the lawn. Only the night look of the dusk fade lights it.

## Sound

Each band has its own original 16-bar arrangement in `src/music/bandstand-tracks.ts`, on the town's own synth voices, in the town's form (a question, an answer, a contrasting bridge and a return):

- **Oom-pah on the Lawn** (brass, B-flat, 96 BPM): the cornet's march tune with a second cornet a third under it, the tuba's oom on the beat, the horns' pah off it, a bass drum, a light snare and a roll into each phrase.
- **The Riverbank Reel** (folk, D, 104 BPM): the fiddle's reel, the squeezebox's bass and chords, a strummed guitar and a foot tapping on the boards.
- **Deckchairs at Dusk** (strings, G, 84 BPM): the violin's slow air over the viola's held chords and the cello's roots; the bridge goes pizzicato, and a soft bell answers where each phrase turns.

The music is local, like the cinema's: `bandstandListening` gives a gain by the camera's zoom and its distance from the stand, and a pan by where it sits on screen; a live set plays only while that gain is at least 0.005, over the town's own tune, which eases down as the band comes up and back when it ends, and a live stage show plays first. The panel adds "Zoom in close to hear the band." while a set plays, and the sound popover names the Bandstand beside the cinema and the football. Sound stays opt-in. See [Forktown FM](MUSIC.md).

## The panel

`BandstandInfo`: `PUBLIC SPACE · K15`, the status eyebrow (`LATER TODAY`, `HAPPENING NOW`, `FINISHED TODAY`, uppercase like every eyebrow), "The Bandstand.", tonight's band and its line, what the band is doing now ("The band is tuning up. The teatime set starts at 16:00.", "The teatime set is playing.", "Tea on the steps. The sundown set starts at 18:15.", "The sundown set is playing.", "The band is packing up. The chairs come in at 20:20."), while a set plays "Zoom in close to hear the band.", then "Teatime set 16:00. Sundown set 18:15." and "Eight deckchairs face the music." Off a star night it adds when the next one is ("The next new moon brings stargazing to the lawn on Autumn 27, from 22:15.", or "tonight", "tomorrow night", counted from the reader's own calendar day). Below it, `IN THE DECKCHAIRS NOW` and the neighbors there, only while they are. On new-moon nights it holds the stargazing note: under the band until the players are gone (20:15), then first, with the band's block marked `FINISHED TODAY`; first at any hour when the visitor chose the stars from their card.

Every district panel lists the people there the same way (`district/NeighborList.tsx`): an eyebrow, then a row each with the neighbor's figure, name and what they are doing, a link that follows them, sorted by name in English collation whatever the viewer's language, then by id. Two neighbors who share a name stay two rows, told apart by their figures.

## Drawing it

- `src/city/district/bandstand.ts` is the painter. Its ground (in the town's cached ground layer) is the lawn, its tufts and the gravel ring. Its floor lights the lawn when K15 is hovered or selected. Its objects are the stand (one depth object at the stand's centre), each chair's two parts and the stack. Its hit test answers a click on the stand, which rises over the road and the Landing's lawn, with K15.
- The stand's own art is static, so it is painted once per look into two offscreen layers at the device scale, `bandstand:back` (plinth, deck, steps, back railings, posts) and `bandstand:front` (front railings, the cap, the unlit lamp, the petals or leaves). They are kept by the night and, for the cap, the season's day; a new zoom paints straight onto the map until it has held for three frames. The players, the notes, the snow and the lit lamp are drawn between and over them every frame.
- Its scenery figures (`drawFigure`) are drawn the way `residents.ts` draws a neighbor, at the same 1.25 scale, with the scene's own arms for each instrument. The Landing's boatwright and boatman use them too.
- Render cap: 500 calls with the players, measured at most 437 (Winter 3, 16:00) at full detail (node paints straight on, with no offscreen layers).

## Checking it

`tests/manual/district.html?venue=bandstand` with the Bandstand's moments: the chairs going out, each band at teatime, the applause, tea on the steps, the sundown set, packing up, the chairs gathered in, the peak lamp lit, a star night with the lamp dark, and the seasons. `tests/district-render-bandstand.test.ts` holds the cache, the 40 px height, the caps for every band and hour, the chairs' depths and times, the lamp's wave and star nights, the amber budget and the fades; `tests/bandstand.test.ts` the poses, the players' evening, the panel and the arrangements.
