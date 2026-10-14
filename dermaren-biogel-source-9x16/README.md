# Dermaren Bio-Gel vs an ordinary mask — cel-animation film (source)

1080×1920 (9:16), 24 fps, 840 frames = 35.000 s. Kurdish (Sorani) + Arabic, UniSIRWAN Somar.
Style: frame-by-frame cel / line boil. The drawing is animated on 2s, fast actions on 1s, and the end hold on 3s.
Line boil uses 4 jitter variants cycled every 2 frames. The film also has smear frames, hand-drawn cel FX and a paper multiply.
Every frame is drawn by `seek(f)` in `site/main.js` as a pure function of the frame number (seeded noise only).

| file | what |
|---|---|
| `site/main.js` | the 10 scenes, timing, camera, **all on-screen copy (`COPY` at the top)** |
| `site/core.js` | brush renderer: centreline → variable-width outline, boil, off-register fills, boiling lettering |
| `site/char.js` | the character, the ordinary sheet mask and the Bio-Gel mask |
| `site/fx.js` | cel FX: smoke puffs, splashes, sparkles, speed lines, heat, snowflakes, ✓/✕ |
| `site/cues.json` | the cue sheet (frame numbers) shared by picture **and** sound |
| `audio.py` | synthesized score + SFX locked to `cues.json` (120 BPM) |
| `master.py` | BS.1770 loudness to −14 LUFS with a true-peak limiter |
| `make_textures.py` | procedural paper + gouache grain textures |
| `render.js` | Playwright frame renderer (uses Microsoft Edge, `channel: 'msedge'`) |

## Re-render

```bash
npm install
python make_textures.py
node render.js stills 2 300 500 800        # check single frames → out/stills
node render.js full 4                      # all 840 frames → out/frames
python audio.py                            # → out/mix_raw.wav
python master.py                           # → out/mix_master.wav (−14 LUFS, ≤ −1.5 dBTP)
ffmpeg -framerate 24 -i out/frames/%05d.png -i out/mix_master.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -c:a aac -b:a 320k -ar 48000 -movflags +faststart -t 35 out/final.mp4
```

To change wording, edit `COPY` in `site/main.js` and re-render. Long lines auto-shrink to fit a 920 px measure.
