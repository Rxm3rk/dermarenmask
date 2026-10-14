"""Sync + loudness check: spectral-flux onsets vs the picture's hit frames (cues.json), plus a
spectrogram / short-term loudness strip with the hits marked. python analyze_audio.py [wav]"""
import sys, json, wave, numpy as np, scipy.signal as sg
from PIL import Image, ImageDraw

path = sys.argv[1] if len(sys.argv) > 1 else 'out/mix_raw.wav'
w = wave.open(path); sr = w.getframerate(); n = w.getnframes(); sw = w.getsampwidth()
raw = w.readframes(n)
if sw == 2: x = np.frombuffer(raw, np.int16).reshape(-1, 2).astype(float) / 32768
else:
    b = np.frombuffer(raw, np.uint8).reshape(-1, 2, 3).astype(np.int32)
    v = b[..., 0] | (b[..., 1] << 8) | (b[..., 2] << 16); v[v >= 1 << 23] -= 1 << 24
    x = v.astype(float) / (1 << 23)
m = x.mean(1)
C = json.load(open('site/cues.json', encoding='utf-8'))
F = C['frames']; FPS = C['FPS']
hop = 256
f_, t_, Z = sg.stft(m, sr, nperseg=1024, noverlap=1024 - hop)
S = np.abs(Z)
flux = np.maximum(0, np.diff(np.log1p(S * 50), axis=1)).sum(0)
flux = (flux - np.median(flux)) / (flux.std() + 1e-9)
tt = t_[1:]
pk, _ = sg.find_peaks(flux, height=1.5, distance=int(0.05 * sr / hop))
on = tt[pk]
hits = ['land1', 'land2', 'land3', 'title', 'question', 'leap', 'crack', 'tonerIn', 'capPop', 'pour', 'splash', 'capBack', 'capClick',
        'serumIn', 'pump1', 'pump2', 'pump3', 'creamIn', 'squirt', 'tada', 'inflate', 'seal', 'lock', 'lensPop', 'wink', 'e1', 'e2', 'e3', 'final', 'button']
errs = []
print('hit        frame   t(s)   nearest onset   err(ms)')
for h in hits:
    if h not in F: continue
    t0 = F[h] / FPS
    j = np.argmin(np.abs(on - t0)) if len(on) else None
    e = (on[j] - t0) * 1000 if j is not None else 999
    errs.append(abs(e))
    print(f'{h:10s} {F[h]:5d}  {t0:6.3f}   {on[j]:7.3f}     {e:+6.0f}')
print('median |err| %.0f ms, max %.0f ms' % (np.median(errs), np.max(errs)))
# drops / gaps
for k, (fl, fd, x0, sz) in enumerate(C['drops']):
    t0 = fd / FPS; j = np.argmin(np.abs(on - t0)); print(f'drop{k} land {fd} err {(on[j]-t0)*1000:+.0f} ms')
for k, (gx, gf) in enumerate(C['gaps']):
    t0 = gf / FPS; j = np.argmin(np.abs(on - t0)); print(f'gap{k} {gf} err {(on[j]-t0)*1000:+.0f} ms')
# picture: spectrogram (log) + short-term loudness, hits as red ticks
W, H = 2000, 420
spec = 20 * np.log10(S[:400] + 1e-6)
spec = np.clip((spec + 90) / 90, 0, 1)
img = Image.fromarray((255 * (1 - spec[::-1])).astype(np.uint8)).resize((W, 300))
canvas = Image.new('RGB', (W, H), 'white'); canvas.paste(img.convert('RGB'), (0, 0))
d = ImageDraw.Draw(canvas)
blk = int(0.4 * sr); hp2 = int(0.05 * sr)
st = [10 * np.log10((m[i:i + blk] ** 2).mean() + 1e-12) for i in range(0, len(m) - blk, hp2)]
st = np.array(st); xs = np.linspace(0, W, len(st))
for i in range(1, len(st)):
    d.line([(xs[i - 1], 410 - (st[i - 1] + 40) * 2.5), (xs[i], 410 - (st[i] + 40) * 2.5)], fill='black')
for h in hits:
    if h in F:
        xx = F[h] / FPS / (len(m) / sr) * W
        d.line([(xx, 0), (xx, H)], fill=(220, 30, 60)); d.text((xx + 2, 302), h, fill=(220, 30, 60))
canvas.save('out/audio_check.png')
print('peak %.3f' % np.abs(x).max())
