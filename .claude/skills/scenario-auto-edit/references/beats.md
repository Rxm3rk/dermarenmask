# beats.json

Every key except `captions` is optional; leave out a move and `film.py` skips it, including its sounds.
Word numbers are the edit indices prep prints last (`prep/edl.json` `words`); film.py stops with a message if
one is out of range. Times come from each word's measured onset, so moves land on the syllable, not on a guess.
Every piece of on-screen text comes from this file: nothing is written by the code. The example is the
reference build's; a clip without a number simply has no `counter`, one without a logo uses `text`.

```json
{
  "hook": {
    "text": "EDITING",
    "word": 0,
    "size": 296,
    "accent": { "text": "nowadays", "word": 1 }
  },
  "counter": {
    "start_word": 3,
    "land_word": 4,
    "land_offset": 0.16,
    "to": 100,
    "prefix": "",
    "suffix": "%"
  },
  "stack": { "text": "AUTOMATED", "word": 5, "size": 196 },
  "punches": [{ "word": 14, "amount": 0.13 }],
  "lights_down": { "word": 16, "until_word": 26 },
  "flicker": {
    "word": 24,
    "words": ["IMAGES", "VIDEO", "3D", "AUDIO", "WORLDS", "EVERYTHING"],
    "step": 0.105
  },
  "payoff": {
    "word": 26,
    "logo": "brand/logo.png",
    "hold": 2.6,
    "logo_height": 150
  },
  "world": { "from_word": 4, "flash": 0.12 },
  "captions": {
    "chunks": [
      [6, 7, 8],
      [9, 10, 11],
      [12, 13]
    ],
    "emphasis": [13],
    "size": 74
  },
  "end_card": { "logo": "brand/logo.png", "text": "", "seconds": 1.15 },
  "music": { "drop_on_word": 26, "under_voice_db": [18, 15] },
  "segment_zoom": [1.0, 1.1, 1.0, 1.1, 1.0],
  "theme": { "ink": [0.067, 0.067, 0.067], "accent": [0.067, 0.067, 0.067] }
}
```

## The moves

| key            | what happens                                                                                                                                                                                                                                                                                                                                                           | why these defaults                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `hook`         | The word rises letter by letter out of a slot behind the speaker's head (Oswald, sized to the frame); the head covers its foot. With little headroom above the head it is kept inside the frame and more of it sits behind the head: check the still. `accent` adds a small serif word tucked above its right shoulder.                                                | The subject in front of the type is what makes it read as designed, not overlaid. The serif accent is the editorial touch.                      |
| `counter`      | A rolling odometer from 0 to the integer `to` (any number of digits, leading zeros blank), with an optional `prefix` ("$") and `suffix` ("%", "x", "K"), starting on `start_word`, landing `land_offset` s after `land_word` with a camera punch, a chromatic pulse and an impact. Shrinks to fit the width.                                                           | An odometer with motion blur reads as real; easing out makes the last digits land on the beat.                                                  |
| `stack`        | A second word types itself under the counter (one key tap per letter) while the counter lifts and shrinks.                                                                                                                                                                                                                                                             | Builds a headline in two beats.                                                                                                                 |
| `punches`      | A quick push-in on a word (`amount` = zoom added).                                                                                                                                                                                                                                                                                                                     | Emphasis by camera, always forward within the shot.                                                                                             |
| `lights_down`  | From `word`, the set falls to a warm spotlight around the head (the speaker dims slightly too); at `until_word` (default: the payoff word) a light burst from behind the head turns it back on.                                                                                                                                                                        | A visible tension and release, timed to the music build and drop.                                                                               |
| `flicker`      | Words flash behind the head, one every `step` seconds, until the payoff.                                                                                                                                                                                                                                                                                               | "You can do everything": show the everything.                                                                                                   |
| `payoff`       | Light burst, music drop, and above the head either `logo` (a PNG) or `text` (a word built letter by letter, `size`), held `hold` s; with neither, just the burst and the drop. Leave the payoff word out of the captions when it gets a logo or text.                                                                                                                  | Brand on the payoff word, held long enough to register (2.5 s minimum). When the payoff is the last word, put the mark on the end card instead. |
| `world`        | From `from_word` (to `until_word`, default the end) the picture is the world edit prepared by `world.py import`, with the matte and face of that plate under the same camera; a short light `flash` (seconds, 0 for none) and the `portal` sound cover the switch. `ink` sets the type colour over the world (default white).                                          | The real room sells the claim; the world arrives on the turn or the payoff.                                                                     |
| `captions`     | Word-by-word captions, `chunks` are word index groups (2 or 3 words, never across a cut), `emphasis` words switch to the serif, larger. Trailing commas and periods are dropped (`"keep_punctuation": true` keeps them); `"space": false` joins words without spaces for scripts that do not use them. Words covered by big type are usually left out of the captions. | Chunk by breath like an editor; a group leaves before the next arrives.                                                                         |
| `end_card`     | Push-through into a light card with the `logo` (built and glinted) and/or a line of `text` under it (a handle, a call to action).                                                                                                                                                                                                                                      | Ends the hook on the brand.                                                                                                                     |
| `music`        | Offsets the bed so its measured drop lands on `drop_on_word`; `under_voice_db` = how far under the voice before/after the drop.                                                                                                                                                                                                                                        | 18 dB before, 15 dB after, set by ear on the reference build: louder fights the voice.                                                          |
| `segment_zoom` | Base zoom per segment between cuts. Default alternates 1.0 and 1.10 so jump cuts read as intentional.                                                                                                                                                                                                                                                                  | Alternating framing is the classic jump-cut cover.                                                                                              |
| `theme`        | `ink` for type on a light wall (white is used automatically while the lights are down), `accent` for the stack word.                                                                                                                                                                                                                                                   | One accent at most.                                                                                                                             |
| `fonts`        | Paths to `.ttf` or `.otf` files replacing `display`, `sans` or `serif`, for example a CJK or Arabic family when the bundled ones lack the script.                                                                                                                                                                                                                      | The bundled families cover Latin only.                                                                                                          |

Logos: a PNG with transparency keeps its colours; an opaque dark-on-light PNG gets its alpha from luminance.
Set `"ink": [r, g, b]` on `payoff` or `end_card` to recolour (for example white on a dark world).
