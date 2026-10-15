# fvrts Su Boon Jo: "کاریگەری ڕۆژانە" (source)

The supplied "Day 1 to Day 7 with Su Boon Jo serum" video, kept as it is, with its **DAY n** labels replaced. In the Day 1–7 montage they become a badge: the real Su Boon Jo bottle, standing up out of the card, beside **کاریگەری ڕۆژانە** (daily effect). The ending is a before/after split screen, so its DAY 1 / DAY 7 labels become **پێش** (before) and **دوای** (after).

Render: `../fvrts_SuBoonJo_Daily_1080x1920.mp4`. 1080×1920 (9:16), 24 fps, 456 frames = 19.000 s, H.264 High, BT.709, AAC 320k 48 kHz, −14.0 LUFS, −1.5 dBTP.

## The brief

> ئەوە بە سادەیی ڤیدیۆکە بەکاربهێنە و بەرهەمی su boon jo دابنێ و لە جێێ ئەو بەشەی نوسراوە DAY 1 و Day 2 بنووسە کاریگەری ڕۆژانە لەگەڵ (وێنەی بەرهەمە دابنێ)

Use the video simply and feature the Su Boon Jo product. Where it says DAY 1, Day 2, write کاریگەری ڕۆژانە together with the product image.

## What changed, and what did not

- **Changed:** every DAY label is covered. DAY 1…DAY 7 in the montage are covered by the badge; DAY 1 / DAY 7 on the split screen are covered by پێش / دوای captions on the same card. Nothing else is changed.
- **Kept:** every frame of the footage, the cut, the transitions and the soundtrack. The soundtrack only got a loudness safety pass (−14.2 → −14.0 LUFS, peaks −0.5 → −1.5 dBTP).
- **Scale:** the source is 480×854. It is scaled to 1080×1920 with Lanczos and a light luma unsharp, the same on every frame, so the badge is drawn at full resolution.

## Cue sheet (source frames, 24 fps)

| frames | time | picture | badge |
|---|---|---|---|
| 0–243 | 0.00–10.17 | DAY 1…DAY 7 application montage (the labels type themselves in again at each day cut) | one badge, held at x 66 y 194, covering the label through every cut |
| 244–381 | 10.17–15.92 | eye-slit wipe, spreading, eye close-up, the packshots on the bed | none (the original has no label here) |
| 382–383 | 15.92–16.00 | flashback to the Day 1 drops | captions ease in on 383 (50 %), a frame without labels |
| 384–455 | 16.00–19.00 | crossfade into the DAY 1 / DAY 7 split screen | پێش on the top half, دوای on the bottom, fully opaque from 384, the first frame where the ghosted labels appear (crossfade 26 %) |

## Decisions

- **Cover, never erase.** Removing burned-in text means painting new pixels where the label was. Here that would mean painting new skin into a before/after comparison. A covering panel hides the label and fabricates nothing. This is also Scenario's guidance for copy edits on flattened footage (`scenario-ad-variants`). `edit.py check` proves the labels never show: under every badge, every frame matches the badge.
- **The product is never generated.** The badge uses the real bottle from frame 336, the sharpest unoccluded packshot in the video. It was cut out on Scenario (Photoroom Background Removal, 3 CU, job `job_RAZunRAexreCuMKvePRQRZ7t`). The upload is `asset_9RT7hp9uoJnGnjnNUY4fErVP` and the cutout is `asset_mQnP3NFEHgsnVWmMZjEMZnDt`. The label and the fvrts wordmark are the real pixels. `product.py` stands the bottle upright and lifts its levels, because the bed shot is underexposed against the brand colours.
- **The product is the hero of the badge.** The bottle stands 286 px tall, 1.7× the card's inner height, and rises about 100 px out of the top of the card. The card still covers the old label, and the extra height goes into the empty wall and hair above it, not over the face.
- **Type.** UniSIRWAN Somar Black, the fvrts headline face, in the brand ink `#121212` on the brand's off-white card `#FDF8F9`. The badge sets one word per line, right-aligned. It is rendered by Chromium, so the Sorani is shaped by a real text engine and not drawn glyph by glyph.
- **The ending is a before/after.** Repeating "daily effect" on both halves would not say which is which, so the two labels become پێش / دوای: the same card and face, text only (a bottle beside "before" would read wrong). The two words are almost the same width (239 and 243 px at 100 px), so the pair balances.
- **Not run from `scenario-auto-edit`.** Most of that skill is built for a talking head: Whisper cuts, the Apple Vision matte, the Seedance world edit, a generated music bed and a sound effects kit. This is a finished, music-only ad and the brief asks for it simply. Of that skill, this edit uses the Scenario connection check, the price-first loop, local frame-exact compositing, the −14 LUFS / −1 dBTP master and the check pass.

## Files

| file | what |
|---|---|
| `source/original.mp4` | the supplied video (480×854, 24 fps, 19 s) |
| `product.py` | `crop`: frame 336 → `assets/bottle_frame336_crop.png` (the file uploaded to Scenario). `finish`: Scenario cutout → `assets/bottle_upright.png` |
| `badge.py`, `shot.js` | the badge and the before/after captions as HTML/CSS, rendered by Chromium → `assets/overlay_montage.png`, `assets/overlay_split.png` |
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

To change the wording, edit `TEXT` (the badge, two words, one per line) or `BEFORE` / `AFTER` in `badge.py`, then run `badge.py` and `edit.py render`. The product's size is `BOTTLE_H`.

## On-screen copy (for native-speaker review)

| Kurdish (Sorani) | meaning | where |
|---|---|---|
| کاریگەری ڕۆژانە | daily effect | badge, Day 1–7 montage |
| پێش | before | split screen, top half |
| دوای | after | split screen, bottom half (پاش is the other common choice) |

## Credits

- Footage: client-supplied ("Day 1 to Day 7 with Su Boon Jo serum").
- Fonts: UniSIRWAN Somar by Sirwan Yassin, client-supplied (repo root), used under the author's terms.
- Product cutout: Photoroom Background Removal on Scenario, from frame 336 of the supplied footage.
