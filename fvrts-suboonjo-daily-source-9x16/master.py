"""The original soundtrack, kept as it is: BS.1770-4 integrated loudness to -14 LUFS with a 4x-oversampled
true-peak limiter (ceiling -1.6 dBTP so the AAC encode stays under -1 dBTP), trimmed to the picture.
source/original.mp4 -> work/audio_master.wav (48 kHz, 24-bit). Same chain as fvrts-routine-source-9x16/master.py.
The source measures -14.2 LUFS with a -0.5 dBTP peak, so this is a safety pass, not a remix."""
import subprocess, wave, pathlib
import numpy as np, scipy.signal as sg

DUR = 456 / 24        # the picture: 456 frames at 24 fps; the music has already faded out by then


def read(path):
    w = wave.open(path); sr = w.getframerate(); n = w.getnframes()
    x = np.frombuffer(w.readframes(n), np.int16).reshape(-1, 2).astype(np.float64) / 32768
    return x, sr


def lufs(x, sr):
    # K-weighting (48 kHz coefficients from ITU-R BS.1770)
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    y = sg.lfilter(b2, a2, sg.lfilter(b1, a1, x, axis=0), axis=0)
    blk, hop = int(0.4 * sr), int(0.1 * sr)
    z = np.array([(y[i:i + blk] ** 2).mean(0).sum() for i in range(0, len(y) - blk + 1, hop)])
    l = -0.691 + 10 * np.log10(z + 1e-12)
    z1 = z[l > -70]
    rel = -0.691 + 10 * np.log10(z1.mean()) - 10
    z2 = z[l > rel]
    return -0.691 + 10 * np.log10(z2.mean())


def true_peak(x):
    up = sg.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max())


def limit(x, sr, ceiling_db=-1.5, look_ms=1.5, rel_ms=60):
    c = 10 ** (ceiling_db / 20)
    up = sg.resample_poly(x, 4, 1, axis=0)
    pk = np.abs(up).max(1).reshape(-1, 4).max(1)[:len(x)]
    if len(pk) < len(x): pk = np.pad(pk, (0, len(x) - len(pk)))
    g = np.minimum(1, c / np.maximum(pk, 1e-9))
    la = int(look_ms / 1000 * sr)
    # look-ahead: min over the window, then smooth release
    gmin = np.array(g)
    for k in range(1, la + 1): gmin[:-k] = np.minimum(gmin[:-k], g[k:])
    out = np.empty_like(gmin); r = np.exp(-1 / (rel_ms / 1000 * sr)); cur = 1.0
    for i in range(len(gmin)):
        cur = gmin[i] if gmin[i] < cur else gmin[i] + (cur - gmin[i]) * r
        out[i] = cur
    k = max(1, int(0.0005 * sr)); out = np.minimum(out, np.convolve(out, np.ones(k) / k, 'same'))
    return x * out[:, None]


if __name__ == '__main__':
    pathlib.Path('work').mkdir(exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'source/original.mp4', '-map', '0:a', '-ac', '2', '-ar', '48000',
                    '-c:a', 'pcm_s16le', 'work/audio_src.wav'], check=True)
    x, sr = read('work/audio_src.wav')
    print(f'source: {lufs(x, sr):.2f} LUFS, TP {true_peak(x):.2f} dBTP, {len(x) / sr:.3f} s')
    n = int(round(DUR * sr))
    x = np.pad(x, ((0, max(0, n - len(x))), (0, 0)))[:n]
    f = int(0.02 * sr); x[-f:] *= np.linspace(1, 0, f)[:, None]      # 20 ms guard against a click at the cut
    target = -14.0
    for it in range(4):
        L = lufs(x, sr)
        x = x * 10 ** ((target - L) / 20)
        x = limit(x, sr, -1.6)
        print(f'iter {it}: in {L:.2f} LUFS -> {lufs(x, sr):.2f} LUFS, TP {true_peak(x):.2f} dBTP')
    data = (np.clip(x, -1, 1) * 8388607).astype(np.int32)
    b = np.zeros((len(data), 2, 3), np.uint8)
    for i in range(3): b[..., i] = (data >> (8 * i)) & 0xFF
    with wave.open('work/audio_master.wav', 'wb') as w:
        w.setnchannels(2); w.setsampwidth(3); w.setframerate(sr); w.writeframes(b.tobytes())
    print(f'wrote work/audio_master.wav ({n / sr:.3f} s)')
