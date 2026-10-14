# The finish standard

Every rule here comes from a rejected cut. Hold all of them.

## Picture

- 24 fps. Average 4 sub-frame samples per frame across a 180 degree shutter; samples never cross a cut, a plate switch or the end card.
- Camera: float transforms only (never integer-rounded crops). One continuous move per shot, monotone in zoom and position: no zoom in then out, no back and forth. Emphasis comes from the cut and the sound, not from extra camera moves.
- Never decode HDR (HLG or PQ) as SDR. Convert first; keep the camera's colour; tag the output BT.709.
- Type: Oswald Bold for display, Instrument Sans Bold for captions and labels, Instrument Serif for emphasis. One accent colour at most. `scripts/get_fonts.py` fetches all three from google/fonts (SIL Open Font License 1.1, license text saved beside each font); keep that text with the fonts if you redistribute them.
- Shadows: two layers (a wide soft ambient shadow and a tight contact shadow). Type behind the subject casts a soft shadow on the wall, and the subject casts a soft shadow on the type.
- Labels are plain typeset captions or panel headers. Never dark rounded pills with a coloured dot.
- No garbled pseudo-text in any frame. No em dashes in on-screen text.
- Optics: a short chromatic pulse on big hits, a gentle bloom on highlights, fine grain, a light vignette. Subtle.
- Captions: word by word on the measured onset (ease in: opacity, a small rise, a defocus that resolves), groups of 2 or 3 words by breath, never across a cut, and a group is fully gone before the next arrives.
- A logo holds at least 2.5 s and keeps one screen position across cuts.

## Sound

- Never synthesize effects in code. Generate them (Scenario MCP, ElevenLabs Sound Effects) or use a real library.
- Always lay a music bed; measure the drop and land it on the payoff word.
- Voice chain: high-pass about 85 Hz, cut about 2.5 dB at 280 Hz, add about 2 dB at 3.6 kHz, a little air, de-ess, 3:1 compression.
- Music about 18 dB under the voice before the drop, about 15 dB after; sidechain duck it. Impacts stay under the word they land on.
- Master to -14 LUFS integrated, true peak under -1 dBTP.

## Verification (cheap, always)

- Re-transcribe the cut and the final mix: every word must survive.
- Measure loudness of the final file.
- Look at a contact sheet of the whole timeline and at full-size frames around every cut, flash and plate switch.
