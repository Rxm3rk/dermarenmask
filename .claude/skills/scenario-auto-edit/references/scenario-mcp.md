# What Scenario MCP does in this skill

## 0. The connection check (first, always)

Call `teams_list`. If the Scenario tools are not there or the call fails to authenticate, stop and give the
user the setup: add the MCP server `https://mcp.scenario.com` (in Claude Code:
`claude mcp add --transport http scenario https://mcp.scenario.com`), sign in with a Scenario account, and
install the companion skills with `npx skills add scenario-labs/skills`. If the tools ask for a team and
project, ask the user which to use; do not pick one for them.

The loop for every paid step:

1. Find the model by name with `search` (`target: "models"`, `public: true`, the name below) and take the
   entry not tagged Deprecated. `recommend` ranks other models first for these tasks, with other inputs.
   Take the id from the search result, never from memory.
2. Read its inputs with `model_schema_get`. The schema is the contract: the field names below were read from
   the live schemas, and the schema wins wherever they differ later.
3. Price it with `model_run` and `dry_run: true`. Tell the user the price of each step (for the sound kit,
   all twelve runs) and the total, and wait for their go before the first real run.
4. Upload any local file first with `upload_asset` (pass `file_size`, PUT each part to the returned URLs with
   curl, then `upload_asset_complete`) and pass the returned asset id. `model_run` never takes a local path.
5. Run it. Launch batches with `wait: false`, then one `jobs_wait` with all the job ids (32 at most per call).
   Do not poll `job_get`.
6. Download each output with `asset_download` and save it with `curl -L -o <file> "<url>"` (follow redirects).

## 1. The sound kit (required)

ElevenLabs Sound Effects on Scenario (`search` for "ElevenLabs Sound Effects"). One short effect per run:
`text` is the prompt, `durationSeconds` as listed, `promptInfluence` around 0.55 (the schema default is lower,
which varies more), MP3 output (`outputFormat`). Save each as `audio/sfx/<name>.mp3` with exactly these names
(film.py places them by name and skips any that are missing):

| name       | seconds | prompt                                                                                                                                                                |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| whoosh_air | 0.9     | Fast clean airy whoosh pass-by for a modern cinematic video transition, smooth and expensive sounding, short tail, no music                                           |
| whoosh_sub | 1.0     | Deep low whoosh with sub rumble for a fast camera zoom-in transition, punchy and modern, no music                                                                     |
| boom       | 2.5     | Huge cinematic trailer impact, a single massive boom with a deep sub bass drop and a short dark metallic tail, no music                                               |
| punch      | 0.8     | Tight punchy modern impact hit for big text slamming onto screen, snappy transient, short, clean low end, no music                                                    |
| odometer   | 0.7     | Rapid mechanical odometer counter rolling numbers, crisp fast clicks accelerating then slowing down and stopping on a final solid click                               |
| riser      | 3.0     | Cinematic tension riser building up steadily, white noise swell with a rising synth tone and reverse cymbal, intense at the end, stops abruptly at the peak, no drums |
| shimmer    | 2.0     | Elegant bright shimmer sparkle chime for a premium logo reveal, airy and clean with a soft reverb tail, no music                                                      |
| lights_off | 1.3     | Heavy stage light switching off in a large studio, a deep mechanical thunk followed by a low electrical hum fading out, dramatic                                      |
| key_tap    | 0.5     | Single soft crisp mechanical keyboard key tap, modern clean UI click, very short                                                                                      |
| glitch     | 0.5     | Short digital glitch stutter burst, data corruption transition, crunchy and modern, very short                                                                        |
| swipe      | 0.6     | Fast cinematic swipe whoosh, quick whip pan air movement, bright and crisp, short                                                                                     |
| portal     | 2.6     | Ethereal portal opening, bright airy rising whoosh with shimmering harmonics swelling up, magical and cinematic, no music                                             |

Then run `audio_prep.py`: it measures each sound's attack and peak so cues land on the frame.

## 2. The music bed (required)

ElevenLabs Music Advanced, the sectioned model (`search` for "ElevenLabs Music Advanced", not the Deprecated
entry). Four sections, each with `text`, `durationSeconds` (whole seconds), `positiveStyles` (required on every
section) and `negativeStyles`; `contextAdherence` is optional. In `text`, a name in square brackets marks the
section, text in curly braces is a performance direction, and plain text is sung as lyrics. Write names and
directions only. Set the drop section so it starts a little before where the payoff word falls in the cut
(section boundaries drift from the requested lengths, which is why the drop is measured, not trusted), and make the sections
add up to at least the length of the edit plus its end card. A template that worked:

- `[Intro] {low pulsing synth bass, ticking percussion, airy pad, sparse, leaves room for a voice}`, 5 s. Styles: cinematic electronic, tech trailer, instrumental, 120 bpm. Negative: vocals, lyrics, singing, acoustic, lo-fi.
- `[Build] {quick tension build, rising pitch, snare roll, stops dead for half a beat before the drop}`, 3 s.
- `[Drop] {huge cinematic drop: big boom, heavy sub, driving drums, bright wide synths, euphoric and premium}`, 6 s.
- `[Outro] {ring out, reverb tail}`, 3 s.

Copy the styles onto every section. Run each take through the local Whisper; a take that transcribes to words
has vocals and is discarded. Generate two takes with different seeds (each priced on its own) and keep the one
whose drop `audio_prep.py` finds cleanly. Save it as `audio/music.mp3`.

## 3. B-roll (optional, for "show, don't tell" moments)

Design before generating. One original character or product, one palette, one shape language, then every
medium from that one reference, so a montage reads as one idea becoming everything:

1. A turnaround sheet (`recommend` with `capability: "txt2img"`, quality first; the reference build used GPT Image 2.5, high quality, plain background, "no text"). This is the style anchor; pass it as the reference image of every later generation.
2. From the sheet (`capability: "img2img"`): a clean front view (input for 3D), a graphite concept sketch, painted key art, an anime frame, pixel art, an in-game screenshot (icon-only HUD, "no text, no numbers"), a poster (the only text: the title).
3. Image to 3D (`capability: "img23d"`, textured, PBR; the reference build used a Meshy model), then `scripts/turntable.py` renders clay and textured turntables in Blender with a transparent background.
4. Image to video from the key art (`capability: "img2video"`; the reference build used Seedance 2.5, 5 s, 720p): one slow push-in, natural weighty motion.
   Never use stock-AI cliches (lone rider on a cliff, orange and teal, sparks everywhere) and never recycle assets
   from another project.

## 4. The world edit with Seedance 2.5 (default; skipped only if the user declines the price)

`python scripts/world.py export --project <dir>` writes `upload/cut.mp4`: the cut exactly as prep made it, no
type, short side 1080 px (edit mode rejects references under 480p), tagged BT.709, and prints its byte size for
`upload_asset`. The edit's length follows the input, so the cut must sit inside the schema's `duration` range;
trim or split a longer one.

Upload it (`upload_asset`, `kind: "video"`), then run Seedance 2.5 (`search` for "Seedance 2.5") in edit mode:
`referenceVideos: [<asset id>]` (an array, even for one), `duration: -1` (edit mode requires it: the output
follows the input), `resolution` (`"1080p"` matches the export; lower is cheaper), `generateAudio: false` (the
default is true; the mix is built locally from the original voice). `aspectRatio` is ignored in edit mode.
Price it with `dry_run: true` and tell the user before the real run. The prompt refers to the upload as
`@video1` and has five blocks: what the clip is ("Edit @video1, a talking-head selfie"); LOCKED (the speaker's
face, identity, every mouth shape and gesture, wardrobe, framing: frame for frame); NO TEXT anywhere; the visual
language (one idea per beat, restrained palette, real light); then beat by beat with timestamps from the cut
(the words prep printed), one transformation per spoken phrase.

Download it to `world/edit.mp4` and run `python scripts/world.py import world/edit.mp4 --project <dir>`. It
measures the edit's length against the cut (film.py retimes by that rate), mattes every frame with Apple
Vision, and aligns the plate to the cut by the two face tracks. Then add `"world": {"from_word": N}` to
`beats.json`: the real room plays until word N, a short light flash covers the switch, and the world edit plays
from there with the type, captions and camera running on top of it (`until_word` switches back).

Traps seen in production:

- A 422 means Scenario's content filter flagged the input, in the reference build because of third-party logos on a cap and a shirt. Whether that filter applies is a per-team setting. Stop and ask the user how to proceed (another team, or footage without the logos); never reword the prompt or alter the footage to get past a filter.
- Edit mode keeps the input's camera; it ignores camera moves in the prompt. Do camera work in `film.py`.
- It can come back slightly short (0.3 % on the reference take). `world.py import` prints the rate; a rate far from 1 means the wrong file.
- Fast montages can sprout pseudo-letters on signs and look-alikes of famous game worlds. Review every frame of a montage at full size; cover offenders with a flash frame or replace the section.

The edit can also be delivered as its own version, untouched.
