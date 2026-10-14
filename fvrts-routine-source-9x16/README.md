# fvrts — "بەرهەمەکانی fvrts بۆ تۆ! بۆ چی بەکاردێن؟" — cel-animation film (source)

1080×1920 (9:16), 24 fps, 960 frames = 40.000 s. Kurdish (Sorani) with Arabic beneath, UniSIRWAN Somar + Inter.
Style: frame-by-frame cel animation with line boil.
- **Timing:** drawings change on 2s (12 drawings/s); fast actions (falls, pops, leaps, the zoom-out) are on 1s; the end hold is on 3s.
- **Line boil:** 4 jitter variants cycled every 2 frames, every 3 frames on the hold.
- **Smears:** 1–2 smear frames on the fastest moves only.
- **Cel FX:** dust puffs, milk stream and wave, splashes, droplets, sparkles, speed and impact lines, starbursts, confetti.
- **Finish:** off-register gouache fills, a paper multiply over everything, and the boiling hand-lettered title.

Every frame is drawn by `seek(f)` in `site/main.js` as a pure function of the frame number. It uses seeded noise and closed-form motion only, with no clocks or state.

## Story (cue sheet: `site/cues.json`, shared by picture and sound)

| time | beat |
|---|---|
| 0.0–2.0 | Hook: the three products tumble in and land on the beats (1-2-3) on a dry, cracked "skin wall" of sleepy cell characters |
| 2.0–4.0 | **بەرهەمەکانی fvrts بۆ تۆ!** (the real wordmark sits inline in the lettering) |
| 4.0–5.5 | **بۆ چی بەکاردێن؟** The products tilt, "?" marks appear, then they leap away |
| 5.5–8.0 | Push-in on the dry skin: cracks, flakes, moisture droplets escaping |
| 8.0–14 | **١ تۆنەر** The cap twists and pops, the toner pours, a milk wave spreads and the cells drink and turn pink. *Balances and preps the skin; after cleansing.* |
| 14–20 | **٢ سیرەم** Three pump presses fire 8 hyaluronic droplets into the cells (8 tuned "bloops"), then a shine sweep. *Deep hydration and glow.* |
| 20–25.5 | **٣ کرێم** Squeeze, the cap pops, the tube pipes ceramide "mortar" into every crack, back-flips and the ribbon becomes a glossy seal. *Locks in moisture, smooths.* |
| 25.5–26.5 | **Hero:** all three land together on the healed wall; the barrier "locks" with a sunburst, shockwave and confetti |
| 26.5–27.1 | Lens iris and zoom-out on 1s: the wall was the cheek of a smiling girl |
| 27.5–31.5 | She winks. **پێستێکی بەهێز و پڕ لە شێ** |
| 31.5–32 | A star wipe from the sparkle on her cheek |
| 32–40 | End card: the logo draws itself on, the products land as the routine 1→2→3 (right to left), then **سێ هەنگاو بۆ پێستێکی تەندروست**; the hold boils on 3s |

## Files

| file | what |
|---|---|
| `site/main.js` | the timeline, camera, cell states, all choreography; **all on-screen copy (`COPY` at the top)** |
| `site/core.js` | brush renderer: centreline → variable-width outline, boil, off-register fills, cel-shade clips, boiling lettering |
| `site/prods.js` | the three products drawn from the real packshots (labels, vertical wordmark) |
| `site/skin.js` | the skin-barrier wall: cell characters + faces, cracks, mortar, glossy seal, droplet characters |
| `site/face.js` | the hero girl (braids, freckles, glass-skin highlights, wink) |
| `site/fx.js` | cel FX library |
| `site/logo.json` | the client's fvrts wordmark traced to vector outlines (`trace_logo.py`) |
| `audio.py` | synthesized score + SFX locked to `cues.json` (120 BPM, G major, daf on the big moments) |
| `master.py` | BS.1770 loudness to −14 LUFS with a 4×-oversampled true-peak limiter |
| `make_textures.py` | procedural paper + gouache grain |
| `render.js` | Playwright frame renderer (Microsoft Edge, `channel: 'msedge'`) |
| `analyze_audio.py`, `strip.py` | QA helpers: onset-vs-cue sync report; consecutive-frame contact sheets |

## Re-render

```bash
npm install
python trace_logo.py              # only if the logo changes
python make_textures.py
node render.js stills 80 300 626 940      # check single frames → out/stills
node render.js full 6                     # all 960 frames → out/frames
python audio.py                           # → out/mix_raw.wav
python master.py                          # → out/mix_master.wav (−14 LUFS)
ffmpeg -framerate 24 -i out/frames/%05d.png -i out/mix_master.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -c:a aac -b:a 320k -ar 48000 -movflags +faststart -t 40 out/final.mp4
```

To change wording, edit `COPY` in `site/main.js` and re-render; long lines auto-shrink to a 940 px measure.

## On-screen copy (for native-speaker review)

| Kurdish (Sorani) | Arabic | meaning |
|---|---|---|
| بەرهەمەکانی fvrts بۆ تۆ! | منتجات fvrts لكِ! | fvrts products for you! |
| بۆ چی بەکاردێن؟ | شنو فايدتها؟ | What are they used for? |
| ١ تۆنەر — پێستت هاوسەنگ و ئامادە دەکات | يوازن بشرتك ويجهّزها | balances and preps your skin |
| دوای شوشتن | بعد الغسل | after cleansing |
| ٢ سیرەم — شێداریی قووڵ و درەوشانەوە | ترطيب عميق وبشرة تلمع | deep hydration and glow |
| ٣ کرێم — شێ دەپارێزێت و پێست لووس دەکات | يحبس الرطوبة وينعّم البشرة | locks in moisture, smooths the skin |
| پێستێکی بەهێز و پڕ لە شێ | بشرة قوية ومرطّبة | strong skin, full of moisture |
| سێ هەنگاو بۆ پێستێکی تەندروست | ثلاث خطوات لبشرة صحية | three steps to healthy skin |
