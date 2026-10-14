# Dermaren — Kurdistan launch film (source)

1080×1080, 35.035 s, frames numbered at 29.97 fps (f0–f1049), master rendered at 59.94 fps.
Everything is drawn by `seek(f)` in `site/main.js` as a pure function of the frame number.

- `site/main.js` — the 9 shots, timing, camera moves, text (Kurdish Sorani + Iraqi Arabic)
- `site/products.js` — procedural 3D products (three.js) and their label artwork.
  `PACK_WORDMARK` sets the wordmark printed on the packaging.
- `audio.py` — synthesized score + SFX (124 BPM; gayageum-style lead over a daf groove)
- `render.js` — Playwright frame renderer

## Re-render

```bash
npm install playwright-core three @fontsource/inter
node render.js stills 30 140 290 520      # check single frames → out/stills
node render.js full 3 0.5                 # all 2100 frames → out/frames
python audio.py                           # → out/mix_raw.wav, then loudnorm to −14 LUFS / −1 dBTP
ffmpeg -framerate 60000/1001 -i out/frames/%05d.png -i out/mix_master.wav -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a aac -b:a 320k out/film.mp4
```

Uses Microsoft Edge (`channel: 'msedge'`) for headless rendering.
