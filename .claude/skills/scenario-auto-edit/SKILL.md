---
name: scenario-auto-edit
description: 'Use when a raw talking-head or selfie clip (a hook, an intro, a reel, a short) has to become a finished edit the way a senior After Effects editor would cut it, through the Scenario MCP server: false starts and every pause cut with every word kept whole (Whisper word timing, onset refinement, a re-transcription check), kinetic type behind the speaker from an Apple Vision person matte, float-precise camera moves, word-by-word captions, a sound effects kit and a sectioned music bed generated with ElevenLabs on Scenario with the drop placed on the key word, and a Seedance 2.5 edit on Scenario that rebuilds the world around the speaker while keeping the lip sync, switched in on a chosen word. Checks the Scenario MCP connection first. Mixed, mastered and encoded locally; vertical or landscape. Runs on macOS with Apple Silicon. Keywords: talking head, jump cuts, auto edit, captions, kinetic typography, text behind subject, sound design, music drop, ducking, iPhone HDR, Seedance edit mode, video to video.'
license: MIT
---

# Auto-edit a talking-head video with Scenario MCP

## Overview

Raw clip in, finished edit out. The default route has five steps, and the Scenario MCP runs three of them:

1. **Check the Scenario MCP (first, always).** Call `teams_list` (a free read). If the Scenario tools are missing or the call fails to authenticate, stop and tell the user how to connect: add the MCP server `https://mcp.scenario.com` to the agent (in Claude Code: `claude mcp add --transport http scenario https://mcp.scenario.com`), sign in with a Scenario account, and install the companion skills with `npx skills add scenario-labs/skills`. Do not start a local-only edit instead. If several teams or projects come back, ask the user which to use.
2. **Prep (local, free).** `scripts/prep.py` converts HDR to SDR, transcribes with word timings, cuts false starts you name and every pause while keeping each word whole, re-transcribes the cut to prove nothing was clipped, and extracts a person matte, a face track and a hand track for every kept frame.
3. **Sound (Scenario MCP).** A sound effects kit with ElevenLabs Sound Effects and a sectioned music bed with ElevenLabs Music Advanced, so the drop can land on the key word.
4. **World edit (Scenario MCP).** One Seedance 2.5 edit of the whole cut rebuilds the world around the speaker while keeping face and lip sync; `scripts/world.py` brings it back as a second plate and `film.py` switches to it on a word. Priced with a dry run first; skipped only if the user declines the price.
5. **Edit and mix (local).** Write `beats.json` (which word triggers which move), then `scripts/film.py` renders at 24 fps with motion blur: type behind the speaker with their shadow cast on it, a rolling counter, lights down and a light burst back on, words flickering behind the head, the world switch, a logo or a word on the payoff, captions, an end card. Then the mix (voice chain, music ducked under the voice, effects on their measured attacks, -14 LUFS) and an H.264 BT.709 encode, and `film.py check`.

B-roll is optional and sits beside step 4 ([references/scenario-mcp.md](references/scenario-mcp.md)).

**What it runs on.** macOS on Apple Silicon: the matte, face and hand tracks use Apple Vision through two small Swift tools that `prep.py` compiles on first run (Xcode command line tools), HDR is converted with `avconvert`, and transcription uses `mlx-whisper` (the code falls back to `faster-whisper`, slower and not yet tested). Also Python 3.10+ with numpy, scipy, opencv-python-headless and pillow; ffmpeg; and the Scenario MCP connected. Blender only for the optional 3D turntables.

**What it expects.** One speaker on camera (with two people the matte covers both and the camera follows the largest face). Vertical or landscape footage: the edit keeps the source shape (1080x1920 or 1920x1080); `prep.py --vertical` turns a landscape source into a 1080x1920 edit that follows the face, softer because it is a crop. Whisper transcribes many languages, but complete edits have only been run on English speech; for scripts the bundled fonts lack, set `fonts` in `beats.json`. Every move is optional, so a clip without a number or a product name still gets a full edit.

Work on footage the user owns, of a speaker who agreed to it; the world edit keeps a real face and voice.

Connection and the core loop: the `scenario` skill. Sound effects and music: `scenario-elevenlabs` or `scenario-audio`. World edit: `scenario-seedance`. If a sibling skill named here is missing, ask the user to install it (`npx skills add scenario-labs/skills --skill <name>`); unattended, work from the tool schemas and say so.

## Quick reference

```bash
python scripts/get_fonts.py                              # once: Oswald, Instrument Sans, Instrument Serif
P=~/edits/my-hook                                        # one folder per video
python scripts/prep.py raw.MOV --project $P --transcript-only   # read every word with its index
python scripts/prep.py raw.MOV --project $P --drop 0-5   # cut retakes (optional), pauses, VERIFY, mattes
# Scenario MCP: sound kit -> $P/audio/sfx/<name>.mp3, music -> $P/audio/music.mp3
python scripts/audio_prep.py --project $P                # attack and peak per sound, the music's drop and tempo
python scripts/world.py export --project $P              # -> $P/upload/cut.mp4 for the Seedance edit
# Scenario MCP: upload, Seedance 2.5 edit, download -> $P/world/edit.mp4
python scripts/world.py import $P/world/edit.mp4 --project $P   # retime, matte, align -> second plate
# write $P/beats.json (references/beats.md)
python scripts/film.py stills 0.5 1.5 4 8 --project $P   # look before rendering everything
python scripts/film.py frames --project $P
python scripts/film.py audio --project $P
python scripts/film.py encode --project $P               # -> $P/out/edit.mp4
python scripts/film.py check --project $P                # words survive the mix, loudness, out/sheet.jpg
```

| Scenario MCP step     | Find the model with                                                                                 | Inputs (check `model_schema_get`)                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Connection check      | `teams_list`, then `projects_list`                                                                  | none                                                                                                                          |
| Sound kit, 12 effects | `search` `{"target": "models", "public": true, "query": "ElevenLabs Sound Effects"}`                | `text`, `durationSeconds`, `promptInfluence`, `outputFormat`                                                                  |
| Music bed, 2 takes    | `search` "ElevenLabs Music Advanced" (the entry not tagged Deprecated; its schema takes `sections`) | `sections[]`: `text`, `durationSeconds`, `positiveStyles` (required), `negativeStyles`, `contextAdherence`; `seed`            |
| World edit            | `search` "Seedance 2.5"                                                                             | `prompt` (refer to the cut as `@video1`), `referenceVideos: [asset id]`, `duration: -1`, `resolution`, `generateAudio: false` |
| B-roll (optional)     | `recommend` with `txt2img`, `img2img`, `img23d`, `img2video`                                        | one reference sheet behind every medium                                                                                       |

Find these models by name: `recommend` ranks other models first for sound effects and video editing, and their inputs differ from what this skill and its measurements expect. Skip entries tagged Deprecated. Every paid step: `model_schema_get`, then `model_run` with `dry_run: true`; tell the user the price of each step and the total, then run. Local files go up with `upload_asset` first. Fonts: SIL Open Font License 1.1, fetched from google/fonts by `get_fonts.py`, which saves each license next to its font.

## Workflow

1. **Connect.** `teams_list`; stop with the setup steps above if it fails.
2. **Prep, pass 1.** `prep.py --transcript-only` prints every word as `index:word@seconds`. Read it like an editor: false starts, repeated lines, "wait, let me redo that" are cut with `--drop` (source indices, ranges allowed). If Whisper swallowed repeated speech into one long word, prep says so and transcribes phrase by phrase instead.
3. **Prep, pass 2.** `prep.py --drop ...` (or no `--drop`). Read the cut length and `VERIFY`. A missing word means a clipped cut: raise `--pad-post` or `--max-pause`. An extra word means a retake is still in: drop it. A word heard differently in both passes (a mumble) is the speech, not the cut. Prep ends by printing the kept words with the indices `beats.json` uses. It warns when the face is missing in many frames (a hand over the face, a turned head): check stills there.
4. **Find the beats.** Most hooks have a claim (hook word), a number or proof, a turn ("and the best part is"), a payoff (the product or the promise), a call to action; many have only some of these. Map what is there to moves: [references/beats.md](references/beats.md) has the moves and their defaults, and [references/concepts.md](references/concepts.md) bigger set pieces.
5. **Price the Scenario steps together.** One dry run per paid call: each of the twelve sound effects (their lengths differ), one music take (times two), and the world edit on the uploaded cut. Tell the user each price and the total and wait for a go. If the world edit is declined, skip it and leave `world` out of `beats.json`.
6. **Sound kit and music** ([references/scenario-mcp.md](references/scenario-mcp.md) has the prompts and the traps). Launch with `"wait": false`, one `jobs_wait` with all job ids, `asset_download`, save under the names the table lists. Never synthesize effects in code. Run `audio_prep.py`; keep the music take whose drop it finds cleanly and whose transcript is empty.
7. **World edit.** `world.py export`, upload, run Seedance 2.5 in edit mode with the five-block prompt, download, `world.py import`. Then set `"world": {"from_word": N}` in `beats.json`, usually the turn or the payoff.
8. **Beats, stills, render, mix, encode, check.** Look at stills at every beat and both sides of every cut and the world switch before the full render. `film.py check` re-transcribes the final mix, measures loudness and writes a contact sheet; look at the sheet.

## Worked example: a 16-second selfie hook

The reference take was a vertical iPhone selfie: a claim, a number ("100%"), a turn ("and the best part is"), a payoff on the product name, and a call to action.

1. **Connect, fonts, prep.** `teams_list` and `projects_list` returned the user's team and project. Then:

   ```bash
   python scripts/get_fonts.py
   P=~/edits/hook
   python scripts/prep.py take.MOV --project $P
   ```

   The take was HLG, so prep reported `HDR converted: True`. There was no retake, so no `--drop`. The cut went from 16.03 s to 11.50 s in five pieces and `VERIFY` matched word for word. The payoff word was index 26, with its onset at 8.36 s in the cut.

2. **Find the models and read their schemas.** `search` with `{"target": "models", "public": true, "query": "ElevenLabs Sound Effects"}`, then "ElevenLabs Music Advanced" and "Seedance 2.5", each time taking the entry not tagged Deprecated. `model_schema_get` with `{"model_id": "<id from the result>"}` on each.

3. **Price before spending.** One dry run per model:

   ```json
   {
     "model_id": "<sound effects id>",
     "dry_run": true,
     "parameters": {
       "text": "Huge cinematic trailer impact, a single massive boom with a deep sub bass drop and a short dark metallic tail, no music",
       "durationSeconds": 2.5,
       "promptInfluence": 0.55
     }
   }
   ```

   The same for one music take and for the world edit (step 6). Tell the user each price and the total and wait for a go.

4. **Sound kit.** The twelve prompts from [references/scenario-mcp.md](references/scenario-mcp.md), each with `"wait": false`, then one `jobs_wait` with `{"job_ids": ["<job 1>", "<job 2>", "..."]}`.

5. **Music bed.** Two takes, each a `model_run` with its own seed. In `sections[].text`, a name in square brackets marks the section, text in curly braces is a direction, and plain text is sung as lyrics, so the bed is written as names and directions only:

   ```json
   {
     "model_id": "<music id>",
     "wait": false,
     "parameters": {
       "seed": 1,
       "sections": [
         {
           "text": "[Intro] {low pulsing synth bass, ticking percussion, airy pad, sparse}",
           "durationSeconds": 5,
           "positiveStyles": [
             "cinematic electronic",
             "tech trailer",
             "instrumental",
             "120 bpm"
           ],
           "negativeStyles": [
             "vocals",
             "lyrics",
             "singing",
             "acoustic",
             "lo-fi"
           ]
         },
         {
           "text": "[Build] {quick tension build, rising pitch, snare roll, stops dead for half a beat}",
           "durationSeconds": 3,
           "positiveStyles": [
             "cinematic electronic",
             "tension build",
             "instrumental"
           ],
           "negativeStyles": ["vocals", "singing"]
         },
         {
           "text": "[Drop] {huge drop: big boom, heavy sub, driving drums, bright wide synths}",
           "durationSeconds": 6,
           "positiveStyles": [
             "cinematic electronic",
             "trailer drop",
             "instrumental"
           ],
           "negativeStyles": ["vocals", "singing"]
         },
         {
           "text": "[Outro] {ring out, reverb tail}",
           "durationSeconds": 3,
           "positiveStyles": ["cinematic electronic", "instrumental"],
           "negativeStyles": ["vocals", "singing"]
         }
       ]
     }
   }
   ```

   `positiveStyles` is required on every section and durations are whole seconds. `jobs_wait` on both.

6. **Download and measure.** `asset_download` with `{"asset_id": "<asset id>"}` for each output, then `curl -L -o "$P/audio/sfx/boom.mp3" "<url>"` (each effect under its name from the table) and the better music take to `$P/audio/music.mp3`. `audio_prep.py` reported `music: drop at 8.030 s, about 120 BPM`, so `film.py` starts the track 0.33 s into the edit and the drop lands on the payoff word.

7. **World edit.** `world.py export --project $P` wrote an 11.5 s, 1080x1920, 3.6 MB `upload/cut.mp4` and printed its size. Upload it:

   ```json
   {
     "file_name": "cut.mp4",
     "content_type": "video/mp4",
     "kind": "video",
     "file_size": 3592279
   }
   ```

   PUT the part to the returned URL with curl, then `upload_asset_complete` with `{"upload_id": "<upload id>"}`. Price it:

   ```json
   {
     "model_id": "<seedance id>",
     "dry_run": true,
     "parameters": {
       "prompt": "Edit @video1. <the five-block prompt>",
       "referenceVideos": ["<cut asset id>"],
       "duration": -1,
       "resolution": "1080p",
       "generateAudio": false
     }
   }
   ```

   After the user's go, run it with `"wait": false`, `jobs_wait` (minutes), `asset_download`, save as `$P/world/edit.mp4`, then `world.py import $P/world/edit.mp4 --project $P`. In the reference build the first attempt was rejected with a 422 because of logos on the cap and shirt; the agent stopped, and the user decided how to proceed. The edit came back about 0.3 % short of the cut; `world.py import` measures that and film.py retimes the plate.

8. **Beats, stills, render, check.** The reference `beats.json` put the hook on word 0, the counter on words 3 and 4 (`"to": 100, "suffix": "%"`), the stack word on 5, lights down from 16 to 26, the flicker on 24, the payoff and the music drop on 26, captions in two- and three-word chunks, and a 1.15 s end card. The result was 12.65 s, 1080x1920, 24 fps, BT.709, about -14 LUFS. The delivered hybrid switched to the world edit from the counter landing onward; with `world.py` that is `"world": {"from_word": 4}`.

## The finish (what separates this from slop)

The full checklist is [references/finish-standard.md](references/finish-standard.md). The short version:

- 24 fps with motion blur from sub-frame samples that never cross a cut. Camera moves are float-precise and go one way within a shot.
- Display type in Oswald, captions in Instrument Sans, emphasis in Instrument Serif. One accent colour at most. Two-layer shadows. Type behind the speaker gets the speaker's shadow on it.
- Captions arrive word by word on the spoken onset; a group is gone before the next one arrives. No pills, no chips, no karaoke colours.
- Music sits about 18 dB under the voice before the drop and about 15 dB after; effects stay under the word they land on. Master to -14 LUFS.
- A logo stays on screen at least 2.5 s and never jumps across a cut.

## Common mistakes

- **The Scenario MCP is not connected.** Stop at step 1 with the setup steps; do not fall back to synthesized sound or a local-only edit.
- **A false start stays in the cut, or one word lasts several seconds.** Whisper can swallow a repeated line into one long word. Prep detects it and transcribes phrase by phrase; then `--drop` the false start by index.
- **iPhone footage looks washed out and the skin clips.** It is HDR (HLG). Decoding it as SDR blows out the skin. `prep.py` converts it with `avconvert`; never feed the raw HDR file to anything else.
- **A cut swallows the end of a word.** Whisper word ends are unreliable; `prep.py` follows the audio decay instead. A cut must never clip a word: check the `VERIFY` line, which re-transcribes the cut, and re-transcribe the final mix too.
- **The camera judders or pumps.** Zooms on integer-pixel crops step visibly, and a zoom in then out inside one shot reads as a mistake. Use float transforms only and one monotone move per shot; emphasis comes from the cut and the sound.
- **Sound effects sound cheap.** They were synthesized in code. Generate them on Scenario MCP.
- **The drop lands somewhere else.** Section boundaries drift from the lengths you asked for. Measure the drop with `audio_prep.py` and let `film.py` put it on the key word; never trust the section lengths.
- **Music fights the voice.** Keep the bed about 18 dB under the voice before the drop and about 15 dB after, and duck it.
- **Seedance edit rejected for a small or out-of-range input.** Edit mode rejects references under 480p, and the output follows the input's length, which must sit inside the schema's duration range. `world.py export` writes a 1080 px short side; trim or split a cut that is too long.
- **The music sings.** Plain text in a section is sung as lyrics. Write section names in `[brackets]` and directions in `{braces}`, keep "vocals" in the negative styles, and discard a take that transcribes to words.
- **The world edit has its own soundtrack.** `generateAudio` defaults to true; set it to false, the mix is built locally from the original voice.
- **Seedance edit rejected with a 422.** Clothing logos in the input (a cap, a shirt) can trigger the content filter, which is a per-team setting. Stop and ask the user; never reword the prompt or alter the footage to get around a filter.
- **The world edit drifts out of lip sync.** Edit mode can come back slightly short (0.3 % on the reference take). `world.py import` measures the length and film.py retimes the plate; it also aligns the plate to the cut by the face tracks.
- **Busy B-roll reads as AI slop.** One IP, one palette, real deliverables (sketch, turnaround, 3D, key art, gameplay), never random worlds.
- **Hardcoded model ids or prices.** Discover by name with `search`, read `model_schema_get`, price with `dry_run`. Pass asset ids, never local paths, to `model_run`; pass at most 32 ids to `jobs_wait`, and do not poll `job_get`.

## Files

| File                                                       | Role                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `scripts/get_fonts.py`                                     | Fetches the three type families from google/fonts (pinned commit, checksums, OFL texts)          |
| `scripts/prep.py`                                          | SDR, transcript, cut, verification, frames, mattes, face and hand tracking                       |
| `scripts/audio_prep.py`                                    | Measures the Scenario sound kit and the music drop                                               |
| `scripts/world.py`                                         | Exports the cut for the Seedance edit and imports the result as a retimed, matted, aligned plate |
| `scripts/film.py`                                          | The edit, driven by `beats.json`, plus `check`                                                   |
| `scripts/fx.py`, `scripts/pro.py`                          | The engine (camera, compositing, type, captions, optics, mix)                                    |
| `scripts/vision_matte.swift`, `scripts/vision_hands.swift` | Apple Vision tools, compiled by `prep.py` on first run                                           |
| `scripts/turntable.py`                                     | Blender turntables for 3D B-roll                                                                 |
| `references/beats.md`                                      | The `beats.json` schema and why each default                                                     |
| `references/scenario-mcp.md`                               | Connection check, sound kit prompts, music template, world edit prompt and traps, B-roll route   |
| `references/finish-standard.md`                            | The finish checklist                                                                             |
| `references/concepts.md`                                   | Set pieces for the big moment                                                                    |
