# fvrts Su Boon Jo: "کاریگەری ڕۆژانە" (source)

The supplied "Day 1 to Day 7 with Su Boon Jo serum" video, kept as it is, with every **DAY n** label replaced by a badge: the real Su Boon Jo bottle and **کاریگەری ڕۆژانە** (daily effect).

Render: `../fvrts_SuBoonJo_Daily_1080x1920.mp4`. 1080×1920 (9:16), 24 fps, 456 frames = 19.000 s, H.264 High, BT.709, AAC 320k 48 kHz, −14.0 LUFS, −1.5 dBTP.

## The brief

> ئەوە بە سادەیی ڤیدیۆکە بەکاربهێنە و بەرهەمی su boon jo دابنێ و لە جێێ ئەو بەشەی نوسراوە DAY 1 و Day 2 بنووسە کاریگەری ڕۆژانە لەگەڵ (وێنەی بەرهەمە دابنێ)

Use the video simply and feature the Su Boon Jo product. Where it says DAY 1, Day 2, write کاریگەری ڕۆژانە together with the product image.

## What changed, and what did not

- **Changed:** every DAY label (DAY 1…DAY 7 in the montage, DAY 1 / DAY 7 on the split screen) is covered by the badge. Nothing else is changed.
- **Kept:** every frame of the footage, the cut, the transitions and the soundtrack. The soundtrack only got a loudness safety pass (−14.2 → −14.0 LUFS, peaks −0.5 → −1.5 dBTP).
- **Scale:** the source is 480×854. It is scaled to 1080×1920 with Lanczos and a light luma unsharp, the same on every frame, so the badge is drawn at full resolution.

## Cue sheet (source frames, 24 fps)

| frames | time | picture | badge |
|---|---|---|---|
| 0–243 | 0.00–10.17 | DAY 1…DAY 7 application montage (the labels type themselves in again at each day cut) | one badge, held at x 66 y 194, covering the label through every cut |
| 244–381 | 10.17–15.92 | eye-slit wipe, spreading, eye close-up, the packshots on the bed | none (the original has no label here) |
| 382–383 | 15.92–16.00 | flashback to the Day 1 drops | eases in on 383 (50 %), a frame without labels |
| 384–455 | 16.00–19.00 | crossfade into the DAY 1 / DAY 7 split screen | one badge per half, fully opaque from 384, the first frame where the ghosted labels appear (crossfade 26 %) |

## Decisions

- **Cover, never erase.** Removing burned-in text means painting new pixels where the label was. Here that would mean painting new skin into a before/after comparison. A covering panel hides the label and fabricates nothing. This is also Scenario's guidance for copy edits on flattened footage (`scenario-ad-variants`). `edit.py check` proves the labels never show: under every badge, every frame matches the badge.
- **The product is never generated.** The badge uses the real bottle from frame 336, the sharpest unoccluded packshot in the video. It was cut out on Scenario (Photoroom Background Removal, 3 CU, job `job_RAZunRAexreCuMKvePRQRZ7t`). The upload is `asset_9RT7hp9uoJnGnjnNUY4fErVP` and the cutout is `asset_mQnP3NFEHgsnVWmMZjEMZnDt`. The label and the fvrts wordmark are the real pixels. `product.py` stands the bottle upright and lifts its levels, because the bed shot is underexposed against the brand colours.
- **Type.** UniSIRWAN Somar Black, the fvrts headline face, in the brand ink `#121212` on the brand's off-white card `#FDF8F9`. One word per line, right-aligned. It is rendered by Chromium, so the Sorani is shaped by a real text engine and not drawn glyph by glyph.
- **Split screen.** It carries two labels, DAY 1 and DAY 7, and both are replaced like every other DAY label, as the brief says. A single badge there would need the second label erased, which is the one thing this edit avoids.
- **Not run from `scenario-auto-edit`.** Most of that skill is built for a talking head: Whisper cuts, the Apple Vision matte, the Seedance world edit, a generated music bed and a sound effects kit. This is a finished, music-only ad and the brief asks for it simply. Of that skill, this edit uses the Scenario connection check, the price-first loop, local frame-exact compositing, the −14 LUFS / −1 dBTP master and the check pass.

## Files

| file | what |
|---|---|
| `source/original.mp4` | the supplied video (480×854, 24 fps, 19 s) |
| `product.py` | `crop`: frame 336 → `assets/bottle_frame336_crop.png` (the file uploaded to Scenario). `finish`: Scenario cutout → `assets/bottle_upright.png` |
| `badge.py`, `shot.js` | the badge as HTML/CSS, rendered by Chromium → `assets/overlay_montage.png`, `assets/overlay_split.png` |
| `master.py` | the original soundtrack to −14 LUFS with a 4×-oversampled true-peak limiter, trimmed to 19.000 s (same chain as `fvrts-routine-source-9x16`) |
| `edit.py` | the cue sheet. `stills` / `render` / `check` |

## Re-render

```bash
pip install numpy scipy opencv-python-headless pillow    # plus ffmpeg on PATH
npm install                                              # playwright-core (uses Microsoft Edge, falls back to Chromium)
python product.py finish assets/bottle_cutout_photoroom.png   # only if the cutout changes
python badge.py                                          # only if the badge changes
python master.py                                         # -> work/audio_master.wav
python edit.py stills 0 243 244 383 384 455              # -> out/stills
python edit.py render                                    # -> ../fvrts_SuBoonJo_Daily_1080x1920.mp4
python edit.py check                                     # labels never show, loudness, out/sheet.jpg, out/cuts.jpg
```

To change the wording, edit `TEXT` in `badge.py` (two words, one per line), then run `badge.py` and `edit.py render`.

## On-screen copy (for native-speaker review)

| Kurdish (Sorani) | meaning |
|---|---|
| کاریگەری ڕۆژانە | daily effect |

## Credits

- Footage: client-supplied ("Day 1 to Day 7 with Su Boon Jo serum").
- Fonts: UniSIRWAN Somar by Sirwan Yassin, client-supplied (repo root), used under the author's terms.
- Product cutout: Photoroom Background Removal on Scenario, from frame 336 of the supplied footage.
