"""fvrts barrier-routine film — score + cartoon SFX, synthesized and locked to site/cues.json.
120 BPM, G major. Jazzy pizzicato + marimba/xylophone + glockenspiel over upright bass and brushes;
a sleepy E-minor bar for the dry skin; tuned droplets and pips for the serum and cream; a tutti hit with
daf (Kurdish frame drum) for the barrier lock and the end card.
Writes out/mix_raw.wav (48 kHz stereo); master with master.py afterwards."""
import numpy as np, scipy.signal as sg, wave, os, json

SR = 48000
CUE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'site', 'cues.json'), encoding='utf-8'))
FPS, FRAMES = CUE['FPS'], CUE['FRAMES']
C = CUE['frames']
DUR = FRAMES / FPS                      # 40.000 s
N = int(round(DUR * SR))
SPB = 60 / CUE['BPM']
T0 = CUE['beat0'] / FPS
bt = lambda k: T0 + SPB * k             # beat k in seconds
bar = lambda b, k=0: bt(4 * b + k)
ft = lambda f: f / FPS                  # frame -> seconds
on2 = lambda f: f - (f % 2)
rng = np.random.default_rng(20261007)

buses = {k: np.zeros((N, 2)) for k in ('drums', 'music', 'sfx', 'send', 'duckless')}

def pan2(sig, pan):
    a = (pan + 1) * np.pi / 4
    return np.stack([sig * np.cos(a), sig * np.sin(a)], 1)

def add(bus, sig, t, gain=1.0, pan=0.0, send=0.0):
    if sig.ndim == 1: sig = pan2(sig, pan)
    i = int(round(t * SR))
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), N - i)
    if n <= 0: return
    buses[bus][i:i + n] += sig[:n] * gain
    if send: buses['send'][i:i + n] += sig[:n] * gain * send

def tt(sec): return np.arange(int(sec * SR)) / SR
def noise(n): return rng.standard_normal(n)
def bp(x, lo, hi, order=2): return sg.sosfilt(sg.butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sg.sosfilt(sg.butter(order, f, 'high', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sg.sosfilt(sg.butter(order, min(f, SR * 0.45), 'low', fs=SR, output='sos'), x)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def sweep_filter(x, f0, f1, kind='low', curve=1.0, block=256):
    out = np.zeros_like(x); zi = None; nb = int(np.ceil(len(x) / block))
    for b in range(nb):
        p = (b / max(1, nb - 1)) ** curve
        fc = f0 * (f1 / f0) ** p
        if kind == 'band': sos = sg.butter(2, [max(30, fc / 1.6), min(SR * 0.45, fc * 1.6)], 'band', fs=SR, output='sos')
        else: sos = sg.butter(2, min(fc, SR * 0.45), kind, fs=SR, output='sos')
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        seg = x[b * block:(b + 1) * block]
        out[b * block:(b + 1) * block], zi = sg.sosfilt(sos, seg, zi=zi)
    return out
def saw(f, n, phase=0.0):
    f = np.broadcast_to(np.asarray(f, float), (n,))
    dt = f / SR
    ph = (phase + np.cumsum(dt)) % 1.0
    s = 2 * ph - 1
    m = ph < dt; t = ph[m] / dt[m]; s[m] -= t + t - t * t - 1
    m = ph > 1 - dt; t = (ph[m] - 1) / dt[m]; s[m] -= t * t + t + t + 1
    return s
def chirp(f, n):   # sine with a per-sample frequency array
    return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(np.asarray(f, float), (n,))) / SR)

# ---------------- instruments ----------------
def modal(f, ratios, amps, decays, dur, click=0.0, att=0.0015):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for r, a, d in zip(ratios, amps, decays):
        if f * r > SR * 0.45: continue
        s += a * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 0.3)) * np.exp(-t / d)
    s *= 1 - np.exp(-t / att)
    if click: s += hp(noise(n), 3000) * np.exp(-t / 0.002) * click
    return s
def glock(m, dur=1.6, bright=1.0):
    return modal(mtof(m), [1, 2.76, 5.40, 8.93], [1, 0.42 * bright, 0.22 * bright, 0.1 * bright], [1.1, 0.42, 0.2, 0.09], dur, click=0.25) * 0.42
def celesta(m, dur=1.4):
    return modal(mtof(m), [1, 2, 3.98, 6.1], [1, 0.18, 0.12, 0.04], [0.9, 0.5, 0.25, 0.1], dur, click=0.08, att=0.004) * 0.45
def marimba(m, dur=0.8):
    return modal(mtof(m), [1, 3.93, 9.2], [1, 0.32, 0.1], [0.45, 0.1, 0.035], dur, click=0.2, att=0.002) * 0.5
def xylo(m, dur=0.5):
    return modal(mtof(m), [1, 3.0, 6.1, 9.9], [1, 0.4, 0.16, 0.06], [0.22, 0.07, 0.03, 0.015], dur, click=0.35, att=0.001) * 0.45
def pizz(m, dur=0.6, bright=1.0, decay=0.32):
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m); s = np.zeros(n)
    for k in range(1, 12):
        if f * k > 12000: break
        a = abs(np.sin(k * np.pi * 0.18)) / k ** (1.15 / bright)
        s += a * np.sin(2 * np.pi * f * k * t * (1 + 0.0004 * k * k)) * np.exp(-t * (1 / decay) * (1 + 0.45 * k))
    s *= 1 - np.exp(-t / 0.0012)
    s += bp(noise(n), 200, 1800) * np.exp(-t / 0.006) * 0.25
    s = s + 0.5 * bp(s, 250, 900, 1)
    return s * 0.42
def harp(m, dur=2.2): return pizz(m, dur, bright=1.6, decay=1.1) * 0.9
def ubass(m, dur=0.45):
    n = int((dur + 0.15) * SR); t = np.arange(n) / SR; f = mtof(m); s = np.zeros(n)
    for k in range(1, 8):
        s += (1 / k ** 1.6) * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (2.2 + 1.4 * k))
    s *= 1 - np.exp(-t / 0.003)
    s += lp(noise(n), 900) * np.exp(-t / 0.012) * 0.25
    s *= np.clip(1 - (t - dur) / 0.12, 0, 1)
    return np.tanh(1.3 * s) * 0.75
def pad(notes, dur, att=0.35, rel=0.9, cutoff=2600, vib=0.12):
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    L = np.zeros(n); R = np.zeros(n)
    for m in notes:
        for d, p in ((-9, -0.7), (-3, 0.3), (4, -0.3), (10, 0.7)):
            fm = mtof(m) * 2 ** (d / 1200) * (1 + 0.0025 * np.sin(2 * np.pi * 5.2 * t + rng.uniform(0, 6)) * vib * 8)
            v = saw(fm, n, rng.uniform())
            a = (p + 1) * np.pi / 4; L += v * np.cos(a); R += v * np.sin(a)
    env = np.clip(t / att, 0, 1) * np.clip(1 - (t - dur) / rel, 0, 1)
    L = lp(L * env, cutoff); R = lp(R * env, cutoff)
    return np.stack([L, R], 1) / (len(notes) * 4) * 0.8
def choir(notes, dur, att=0.06, rel=1.0):   # "aah" — saw stack through two vowel formants
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for j, m in enumerate(notes):
        for d, p in ((-7, -0.6), (6, 0.6)):
            v = saw(mtof(m) * 2 ** (d / 1200) * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * t + j)), n, rng.uniform())
            v = bp(v, 650, 1100) * 1.0 + bp(v, 1050, 1400) * 0.6 + lp(v, 400) * 0.4
            out += pan2(v, p)
    env = np.clip(t / att, 0, 1) * np.clip(1 - (t - dur) / rel, 0, 1)
    return out * env[:, None] / (len(notes) * 2) * 0.9

# drums
def kick(g=1.0):
    t = tt(0.4); f = 50 + 70 * np.exp(-t / 0.025)
    return np.tanh(1.4 * chirp(f, len(t)) * np.exp(-t / 0.16)) * g
def snap(g=1.0):
    t = tt(0.18)
    s = bp(noise(len(t)), 1700, 3600) * np.exp(-t / 0.012) + bp(noise(len(t)), 900, 1300) * np.exp(-t / 0.03) * 0.3
    return s * (1 - np.exp(-t / 0.0005)) * g
def brush(g=1.0, dur=0.22):
    t = tt(dur); e = np.clip(t / 0.035, 0, 1) * np.exp(-t / 0.08)
    return bp(noise(len(t)), 2500, 9000) * e * g
def btap(g=1.0):
    t = tt(0.1); return bp(noise(len(t)), 1800, 7000) * np.exp(-t / 0.015) * g
def shaker(g=1.0):
    t = tt(0.09); e = np.clip(t / 0.012, 0, 1) * np.exp(-t / 0.025)
    return hp(noise(len(t)), 6000) * e * g
def crash(g=1.0, dur=2.2):
    t = tt(dur)
    s = hp(noise(len(t)), 4000) * np.exp(-t / 0.7) * (1 - np.exp(-t / 0.002))
    s += bp(noise(len(t)), 2500, 7000) * np.exp(-t / 0.25) * 0.5
    return s * g * 0.6
def jingles(dur=0.28, amp=1.0):
    t = tt(dur); s = np.zeros_like(t)
    for f in (5230, 6810, 7940, 9160, 10420, 11800):
        s += np.sin(2 * np.pi * f * (1 + 0.004 * rng.standard_normal()) * t + rng.uniform(0, 6.28)) * np.exp(-t / rng.uniform(0.06, 0.16))
    s = s / 6 + hp(noise(len(t)), 6500) * np.exp(-t / 0.035) * 0.8
    return s * (1 - np.exp(-t / 0.002)) * amp
def daf(kind, g=1.0):
    t = tt(0.5)
    if kind == 'D':
        s = chirp(78 + 40 * np.exp(-t / 0.02), len(t)) * np.exp(-t / 0.22) * 0.9 + bp(noise(len(t)), 120, 700) * np.exp(-t / 0.05) * 0.45
        j = jingles(0.3, 0.4)
    else:
        s = bp(noise(len(t)), 1500, 5200) * np.exp(-t / 0.018) * 0.9 + np.sin(2 * np.pi * 420 * t) * np.exp(-t / 0.03) * 0.25
        j = jingles(0.26, 0.6)
    out = s.copy(); out[:len(j)] += j
    return out * g

# ---------------- SFX ----------------
def whoosh(peak_t, rise=0.3, fall=0.25, lo=300, hi=6000, gain=1.0, pan_from=0.0, pan_to=0.0, bus='sfx'):
    n = int((rise + fall) * SR); t = np.arange(n) / SR
    x = noise(n)
    p = np.where(t < rise, (t / rise) ** 2, 1 - (t - rise) / fall)
    fc = lo * (hi / lo) ** p
    out = np.zeros(n); zi = None
    for b in range(0, n, 256):
        c = fc[b]; sos = sg.butter(2, [max(40, c * 0.55), min(SR * 0.45, c * 1.6)], 'band', fs=SR, output='sos')
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        out[b:b + 256], zi = sg.sosfilt(sos, x[b:b + 256], zi=zi)
    env = np.where(t < rise, (t / rise) ** 2.2, np.exp(-(t - rise) / (fall * 0.35)))
    s = out * env
    pn = np.clip(t / (rise + fall), 0, 1); pan = pan_from + (pan_to - pan_from) * pn
    a = (pan + 1) * np.pi / 4
    add(bus, np.stack([s * np.cos(a), s * np.sin(a)], 1), peak_t - rise, gain * 1.5, send=0.25)
def plip(t0, f0=520, f1=1500, gain=1.0, pan=0.0, dur=0.07):
    t = tt(0.3); f = f0 + (f1 - f0) * np.clip(t / dur, 0, 1) ** 0.6
    s = chirp(f, len(t)) * np.exp(-t / 0.045) * (1 - np.exp(-t / 0.002))
    add('sfx', s, t0, gain * 0.5, pan, send=0.35)
def bloop(t0, m, gain=1.0, pan=0.0):   # tuned water-drop plop
    t = tt(0.45); f0 = mtof(m)
    f = f0 * (0.55 + 0.45 * np.clip(t / 0.05, 0, 1) ** 0.5)
    s = chirp(f, len(t)) * np.exp(-t / 0.1) * (1 - np.exp(-t / 0.002))
    s += chirp(f * 2.01, len(t)) * np.exp(-t / 0.04) * 0.2
    add('sfx', s, t0, gain * 0.5, pan, send=0.45)
def gulp(t0, gain=1.0, pan=0.0, m=50):   # a cute swallow: low bloop with a throat click
    t = tt(0.3); f = mtof(m) * (1.6 - 0.6 * np.clip(t / 0.08, 0, 1))
    s = chirp(f, len(t)) * np.exp(-t / 0.07) * (1 - np.exp(-t / 0.003))
    s += bp(noise(len(t)), 300, 1200) * np.exp(-t / 0.01) * 0.4
    add('sfx', s, t0, gain * 0.6, pan, send=0.2)
def wet_splat(t0, gain=1.0, pan=0.0, size=1.0):
    t = tt(0.6)
    s = bp(noise(len(t)), 350, 3500) * np.exp(-t / (0.05 * size)) * (1 - np.exp(-t / 0.002))
    s += sweep_filter(noise(len(t)), 3000, 600, 'band', 0.6) * np.exp(-t / 0.09) * 0.5
    s += chirp(90 + 80 * np.exp(-t / 0.02), len(t)) * np.exp(-t / 0.08) * 0.7 * size
    add('sfx', np.tanh(1.5 * s), t0, gain * 0.7, pan, send=0.3)
def slide_whistle(t0, f0, f1, dur, gain=1.0, pan=0.0):
    t = tt(dur + 0.08); p = np.clip(t / dur, 0, 1)
    f = f0 * (f1 / f0) ** (p ** 0.8) * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    s = chirp(f, len(t)) + 0.08 * bp(noise(len(t)), 800, 4000)
    s *= np.clip(t / 0.02, 0, 1) * np.clip(1 - (t - dur) / 0.08, 0, 1)
    add('sfx', s, t0, gain * 0.2, pan, send=0.35)
def puff_sfx(t0, gain=1.0, pan=0.0):
    t = tt(0.35); e = np.clip(t / 0.015, 0, 1) * np.exp(-t / 0.08)
    add('sfx', lp(noise(len(t)), 1600) * e, t0, gain * 0.5, pan, send=0.3)
def thump(t0, gain=1.0, f0=60, pan=0.0):
    t = tt(0.8); f = f0 + 60 * np.exp(-t / 0.03)
    s = chirp(f, len(t)) * np.exp(-t / 0.18)
    s += bp(noise(len(t)), 400, 2500) * np.exp(-t / 0.012) * 0.6
    add('sfx', np.tanh(1.8 * s), t0, gain * 0.9, pan, send=0.25)
def boing(t0, f0=180, gain=1.0, dur=0.6, pan=0.0, up=False):
    t = tt(dur); f = f0 * (1 + 0.35 * np.exp(-t / 0.15) * np.sin(2 * np.pi * 9 * t)) * ((1 + t * 1.2) if up else 1)
    s = chirp(f, len(t)) * np.exp(-t / (dur * 0.35)) * (1 - np.exp(-t / 0.003))
    add('sfx', s, t0, gain * 0.35, pan, send=0.35)
def cork(t0, gain=1.0, pan=0.0):
    t = tt(0.25); f = 900 * np.exp(-t / 0.05) + 300
    s = chirp(f, len(t)) * np.exp(-t / 0.04) + bp(noise(len(t)), 1000, 5000) * np.exp(-t / 0.006) * 0.8
    add('sfx', s, t0, gain * 0.5, pan, send=0.3)
def pop(t0, gain=1.0, pan=0.0, f1=1200):
    t = tt(0.15); f = 280 + f1 * np.clip(t / 0.03, 0, 1)
    s = chirp(f, len(t)) * np.exp(-t / 0.03) * (1 - np.exp(-t / 0.001))
    add('sfx', s, t0, gain * 0.3, pan, send=0.25)
def scratch(t0, strokes=((0, 0.09), (0.11, 0.16)), gain=1.0, pan=0.0):   # pencil / marker on paper
    n = int((max(a + d for a, d in strokes) + 0.1) * SR); t = np.arange(n) / SR; e = np.zeros(n)
    for a, d in strokes:
        e += np.clip((t - a) / 0.01, 0, 1) * np.clip((a + d - t) / 0.02, 0, 1) * (t >= a)
    s = bp(noise(n), 2500, 7500) * e * (0.7 + 0.3 * np.sin(2 * np.pi * 90 * t))
    add('sfx', s, t0, gain * 0.35, pan, send=0.15)
def ding(t0, m, gain=1.0, pan=0.0):
    add('sfx', glock(m, 1.4), t0, gain * 0.9, pan, send=0.5)
    add('sfx', glock(m + 12, 0.9, 0.6), t0 + 0.004, gain * 0.25, -pan, send=0.5)
def sparkle_sfx(t0, notes, gain=1.0, spread=0.045):
    for i, m in enumerate(notes):
        add('sfx', glock(m, 1.0, 0.7), t0 + i * spread, gain * 0.45, pan=np.sin(i * 1.7) * 0.6, send=0.6)
def squeak(t0, gain=1.0, pan=0.0, f0=1400, f1=2100, dur=0.07):   # rubbery cap twist
    t = tt(dur + 0.03); p = np.clip(t / dur, 0, 1)
    f = f0 + (f1 - f0) * np.sin(p * np.pi) + 60 * np.sin(2 * np.pi * 70 * t)
    s = (chirp(f, len(t)) + 0.3 * chirp(f * 2.02, len(t))) * np.sin(np.clip(t / (dur + 0.03), 0, 1) * np.pi) ** 0.7
    add('sfx', s, t0, gain * 0.12, pan, send=0.2)
def glug_pour(t0, dur, gain=1.0, pan=0.0):   # thick milky pour: low-passed rush + bubble blips
    n = int(dur * SR); t = np.arange(n) / SR
    s = lp(noise(n), 900) * 0.5 + bp(noise(n), 300, 1500) * 0.25 * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
    for k in range(int(dur * 9)):
        tb = rng.uniform(0, dur - 0.1); i = int(tb * SR); m = int(0.08 * SR)
        tb2 = np.arange(m) / SR; f = rng.uniform(220, 480) * (1 + 1.5 * tb2 / 0.08)
        s[i:i + m] += chirp(f, m) * np.exp(-tb2 / 0.025) * 0.5
    s *= np.clip(t / 0.06, 0, 1) * np.clip((dur - t) / 0.12, 0, 1)
    add('sfx', s, t0, gain * 0.6, pan, send=0.3)
def spray(t0, gain=1.0, pan=0.0):   # pump "pssht"
    t = tt(0.28); e = np.clip(t / 0.008, 0, 1) * np.exp(-t / 0.07)
    s = bp(noise(len(t)), 2500, 9000) * e + chirp(700 + 500 * np.exp(-t / 0.02), len(t)) * np.exp(-t / 0.02) * 0.4
    add('sfx', s, t0, gain * 0.55, pan, send=0.25)
def squelch(t0, gain=1.0, pan=0.0, m=74):   # cream pip: squishy noise + tuned blip
    t = tt(0.22)
    s = bp(noise(len(t)), 400, 2400) * np.exp(-t / 0.035) * (1 - np.exp(-t / 0.004)) * 0.8
    s += chirp(mtof(m) * (1.25 - 0.25 * np.clip(t / 0.05, 0, 1)), len(t)) * np.exp(-t / 0.06) * 0.6
    add('sfx', s, t0, gain * 0.5, pan, send=0.3)
def crack(t0, gain=1.0, pan=0.0):
    t = tt(0.22)
    imp = (rng.random(len(t)) < 0.03).astype(float) * rng.uniform(0.3, 1, len(t)) * np.exp(-t / 0.05)
    s = bp(imp, 1500, 7000) * 2.4 + bp(noise(len(t)), 800, 3000) * np.exp(-t / 0.01) * 0.6
    add('sfx', s, t0, gain * 0.5, pan, send=0.2)
def rustle(t0, dur=0.5, gain=1.0, pan=0.0):
    n = int(dur * SR); t = np.arange(n) / SR
    imp = (rng.random(n) < 0.006).astype(float) * rng.uniform(0.2, 1, n)
    s = bp(imp, 2000, 8000) * 1.6 + bp(noise(n), 3000, 8000) * 0.05
    s *= np.sin(np.clip(t / dur, 0, 1) * np.pi)
    add('sfx', s, t0, gain * 0.35, pan, send=0.2)
def sad_wah(t0, m=55, dur=0.9, gain=1.0):   # sleepy "wah-wahh" (muted brass-ish)
    t = tt(dur); f = mtof(m) * (1 - 0.06 * np.clip((t - 0.3) / 0.5, 0, 1))
    v = saw(f * (1 + 0.006 * np.sin(2 * np.pi * 5 * t)), len(t))
    cut = 400 + 1400 * (0.5 - 0.5 * np.cos(2 * np.pi * 2.2 * t))
    out = np.zeros(len(t)); zi = None
    for b in range(0, len(t), 256):
        sos = sg.butter(2, cut[b], 'low', fs=SR, output='sos')
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        out[b:b + 256], zi = sg.sosfilt(sos, v[b:b + 256], zi=zi)
    out *= np.clip(t / 0.05, 0, 1) * np.clip((dur - t) / 0.2, 0, 1)
    add('sfx', out, t0, gain * 0.16, -0.2, send=0.3)
def click(t0, gain=1.0, pan=0.0):
    t = tt(0.05); s = bp(noise(len(t)), 2000, 9000) * np.exp(-t / 0.004) + np.sin(2 * np.pi * 3200 * t) * np.exp(-t / 0.006) * 0.5
    add('sfx', s, t0, gain * 0.5, pan, send=0.2)
def tok(t0, m=79, gain=1.0, pan=0.0):   # wood block
    add('sfx', modal(mtof(m), [1, 2.4, 4.1], [1, 0.4, 0.2], [0.05, 0.02, 0.01], 0.15, click=0.4, att=0.0008), t0, gain * 0.6, pan, send=0.25)
def poof(t0, gain=1.0):
    t = tt(1.0)
    s = lp(noise(len(t)), 900) * np.exp(-t / 0.18) * (1 - np.exp(-t / 0.01))
    s += sweep_filter(noise(len(t)), 4000, 400, 'band', 0.5) * np.exp(-t / 0.25) * 0.5
    s += chirp(70 + 50 * np.exp(-t / 0.05), len(t)) * np.exp(-t / 0.2) * 0.6
    add('sfx', np.tanh(1.2 * s), t0, gain * 0.9, send=0.5)
def riser(end_t, dur=1.4, gain=1.0):
    t = tt(dur); p = t / dur
    s = sweep_filter(noise(len(t)) * p ** 2, 400, 9000, 'low', 1.2) * 0.6
    s += chirp(330 * 2 ** (p * 2.0), len(t)) * p ** 3 * 0.1
    add('sfx', s, end_t - dur, gain, send=0.4)
def shimmer(t0, dur, gain=1.0):   # glossy seal: high noise sweep + celesta sprinkles
    n = int(dur * SR); t = np.arange(n) / SR
    br = sweep_filter(noise(n), 3000, 11000, 'band', 0.8) * np.sin(np.clip(t / dur, 0, 1) * np.pi)
    add('sfx', np.stack([br, np.roll(br, 500)], 1), t0, gain * 0.12, send=0.6)
    for i in range(int(dur * 8)):
        add('sfx', celesta(int(rng.choice([86, 91, 93, 95, 98])), 0.8), t0 + rng.uniform(0, dur - 0.2), gain * 0.12, pan=rng.uniform(-0.7, 0.7), send=0.7)
def drumroll(t0, dur, gain=1.0):
    k = 0
    while k * 0.045 < dur:
        p = k * 0.045 / dur
        add('drums', snap(0.6) * (0.3 + 0.7 * p), t0 + k * 0.045, gain * 0.4, pan=0.2 * (-1) ** k)
        k += 1

# ---------------- harmony ----------------
CH = {
    'G': (43, [67, 71, 74, 79]), 'Gadd9': (43, [67, 71, 74, 81]), 'Em7': (40, [64, 67, 71, 74]), 'C': (48, [64, 67, 72, 76]),
    'Cmaj7': (48, [64, 67, 71, 76]), 'D': (50, [66, 69, 74, 78]), 'D7': (50, [66, 69, 72, 74]), 'Am7': (45, [64, 67, 69, 72]),
    'Dsus': (50, [67, 69, 74, 79]), 'Em': (40, [64, 67, 71, 76]),
}
PROG = {
    0: [(0, 'G')], 1: [(0, 'G')], 2: [(0, 'C'), (2, 'D')], 3: [(0, 'Em')],
    4: [(0, 'G')], 5: [(0, 'Cmaj7')], 6: [(0, 'Am7'), (2, 'D')],
    7: [(0, 'Em7')], 8: [(0, 'Cmaj7')], 9: [(0, 'Am7'), (2, 'D')],
    10: [(0, 'C')], 11: [(0, 'Am7')], 12: [(0, 'Dsus'), (2, 'D7')],
    13: [(0, 'Gadd9')], 14: [(0, 'G')], 15: [(0, 'C'), (2, 'D')],
    16: [(0, 'G')], 17: [(0, 'Em7')], 18: [(0, 'C'), (2, 'D')], 19: [(0, 'G')],
}
def chord_at(b, k):
    ch = PROG[b][0][1]
    for off, c in PROG[b]:
        if k >= off: ch = c
    return ch

# ---------------- MUSIC ----------------
# hook (bar 0): falling whistles + tuned landing thumps outline G (G-B-D); pizz pickup run on beat 0
for i, m in enumerate([55, 59, 62, 67]):
    add('music', pizz(m + 12, 0.25), bar(0) + i * SPB / 8, 0.25, pan=-0.3 + 0.2 * i, send=0.2)
for k, (fl, m) in enumerate(((C['land1'], 43), (C['land2'], 47), (C['land3'], 50))):
    add('music', ubass(m, 0.4), ft(fl), 0.9)
    add('music', marimba(m + 24, 0.6), ft(fl), 0.4, pan=(0.4, 0, -0.4)[k], send=0.3)

# theme A (title + question), reprised for the result and the end card
MEL_A = {
    1: [(0, 74, .5), (.5, 71, .5), (1, 67, .5), (1.5, 71, .5), (2, 74, 1), (3, 76, .5), (3.5, 74, .5)],
    2: [(0, 72, .5), (.5, 76, .5), (1, 79, 1), (2, 78, .5), (2.5, 76, .5), (3, 74, 1)],
}
def theme(b0, inst_main=marimba, gain=0.7, oct=0, double=True):
    for k2, (b, notes) in enumerate(MEL_A.items()):
        for k, m, d in notes:
            add('music', inst_main(m + oct, 0.9 if inst_main is marimba else 1.2), bar(b0 + k2, k), gain, pan=-0.15, send=0.35)
            if double: add('music', pizz(m - 12 + oct, 0.4), bar(b0 + k2, k), gain * 0.35, pan=0.25, send=0.2)
def groove(bars, bass=True, drums=True, comp=True, shaker_on=False, kick_on=False, gain=1.0):
    for b in bars:
        for k in range(4):
            ch = CH[chord_at(b, k)]
            if bass:
                nm = chord_at(b, k); minor = nm[1:].startswith('m') and not nm[1:].startswith('maj')
                walk = [ch[0], ch[0] + (3 if minor else 4), ch[0] + 7, ch[0] + (12 if k == 3 else 7)]
                add('music', ubass(walk[k], 0.36), bar(b, k), 0.8 * gain)
            if comp and k in (1, 3):
                for j, m in enumerate(ch[1][:3]):
                    add('music', pizz(m - 12, 0.3, decay=0.2), bar(b, k + 0.5) + j * 0.008, 0.12 * gain, pan=0.35, send=0.2)
            if drums:
                add('drums', brush(0.5 if k % 2 else 0.35), bar(b, k), 0.5 * gain, pan=0.15, send=0.1)
                add('drums', btap(0.35), bar(b, k + 0.5), 0.4 * gain, pan=0.2)
                if k % 2: add('drums', snap(1.0), bar(b, k), 0.42 * gain, pan=-0.25, send=0.25)
                if kick_on and k % 2 == 0: add('drums', kick(), bar(b, k), 0.5 * gain)
            if shaker_on:
                for h in range(2): add('drums', shaker(0.9 if h else 0.6), bar(b, k + h / 2), 0.3 * gain, pan=0.3)

theme(1)
groove([1, 2])
# bar 2 ends in a curious "hmm?" (pizz rising question)
for i, m in enumerate([62, 66, 69, 74]): add('music', pizz(m, 0.3), bar(2, 3) + i * SPB / 4, 0.3, pan=0.3, send=0.3)

# bar 3: dry — sleepy, sparse E minor: detuned celesta + low bass + tick
for k, m in ((0, 76), (1.5, 74), (2.5, 71), (3.5, 67)):
    add('music', celesta(m, 1.4) * 0.8, bar(3, k), 0.35, pan=-0.2, send=0.5)
    add('music', celesta(m + 0.3, 1.4) * 0.5, bar(3, k) + 0.012, 0.25, pan=0.3, send=0.5)
add('music', ubass(40, 1.6), bar(3), 0.6)
for k in range(8): tok(bar(3, k / 2), 84 if k % 2 == 0 else 79, 0.35, pan=0.4)

# bars 4–6: toner — marimba ostinato groove; bars 7–9: serum — lighter, glock motif; bars 10–12: cream — build
def ostinato(bars, inst=marimba, gain=0.18, pat=(0, 2, 1, 3)):
    for b in bars:
        for q in range(8):
            ch = CH[chord_at(b, q / 2)][1]
            add('music', inst(ch[pat[q % 4]], 0.5), bar(b, q / 2), gain, pan=0.35 * np.sin(q * 1.3), send=0.25)
ostinato([4, 5, 6]); groove([4, 5, 6], kick_on=True)
ostinato([7, 8, 9], inst=xylo, gain=0.2, pat=(0, 3, 2, 1)); groove([7, 8, 9], shaker_on=True)
for b in (7, 8, 9):
    for off, c in PROG[b]:
        dur = (PROG[b][1][0] if len(PROG[b]) > 1 and off == 0 else 4 - off) * SPB
        add('music', pad(CH[c][1], dur, att=0.3, rel=0.4, cutoff=2200), bar(b, off), 0.22, send=0.45)
ostinato([10, 11, 12], gain=0.2); groove([10, 11], kick_on=True, shaker_on=True)
groove([12], drums=False)
drumroll(bar(12, 2), SPB * 2, 1.0)
riser(bar(13), 1.0, 0.7)

# bar 13: the barrier locks — tutti hit, choir "aah", daf
add('duckless', pad(CH['Gadd9'][1] + [83], 2.0, att=0.02, rel=1.0, cutoff=4200), bar(13), 0.6, send=0.6)
add('duckless', choir([67, 71, 74, 79], 1.6, att=0.04, rel=0.9), bar(13), 0.75, send=0.6)
add('duckless', ubass(31, 1.8), bar(13), 0.9)
for i, m in enumerate([79, 83, 86, 91, 95, 98]): add('duckless', glock(m, 1.6), bar(13) + i * 0.045, 0.45, pan=np.sin(i * 1.4) * 0.5, send=0.6)
add('drums', kick(1.3), bar(13), 0.9); add('drums', crash(1.0), bar(13), 0.8, send=0.3); add('drums', daf('D'), bar(13), 0.5, send=0.3)
for i, m in enumerate([55, 59, 62, 67, 71, 74, 79, 83]): add('music', harp(m, 1.6), bar(13, 2) + i * 0.035, 0.3, pan=-0.6 + i * 0.16, send=0.5)

# bars 14–15: result — theme A full band, daf groove
theme(14, gain=0.75); groove([14, 15], kick_on=True, shaker_on=True)
for b in (14, 15):
    for k, kind in ((0, 'D'), (1.5, 't'), (2, 'D'), (3, 't'), (3.5, 't')):
        add('drums', daf(kind), bar(b, k), 0.22 if kind == 'D' else 0.15, pan=0.15, send=0.2)
    for off, c in PROG[b]:
        dur = (PROG[b][1][0] if len(PROG[b]) > 1 and off == 0 else 4 - off) * SPB
        add('music', pad(CH[c][1], dur, att=0.2, rel=0.5, cutoff=2600), bar(b, off), 0.36, send=0.45)

# bars 16–18: end card — theme in glockenspiel + pizz, groove; bar 19 final hit + button
theme(16, inst_main=glock, gain=0.55, oct=12)
groove([16, 17, 18], kick_on=True)
for b in (16, 17, 18):
    for k, kind in ((0, 'D'), (2, 'D'), (3, 't'), (3.5, 't')):
        add('drums', daf(kind), bar(b, k), 0.2 if kind == 'D' else 0.14, pan=0.15, send=0.2)
# end: landings outline G-B-D again (bookend), the final chord, the button
for k, (fl, m) in enumerate(((C['e1'], 43), (C['e2'], 47), (C['e3'], 50))):
    add('music', marimba(m + 24, 0.6), ft(fl), 0.35, pan=(0.4, 0, -0.4)[k], send=0.3)
add('duckless', pad(CH['Gadd9'][1], 1.4, att=0.02, rel=0.6, cutoff=3800), bar(19), 0.55, send=0.6)
add('duckless', ubass(31, 1.4), bar(19), 0.85)
add('drums', kick(1.2), bar(19), 0.8); add('drums', daf('D'), bar(19), 0.4, send=0.3); add('drums', crash(0.7, 1.4), bar(19), 0.5, send=0.3)
for i, m in enumerate([79, 83, 86, 91]): add('duckless', glock(m, 1.4), bar(19) + i * 0.05, 0.42, pan=np.sin(i * 1.4) * 0.5, send=0.6)
add('duckless', pizz(55, 0.8), ft(C['button']), 0.8); add('duckless', pizz(67, 0.8), ft(C['button']) + 0.01, 0.5)
add('duckless', glock(91, 1.2), ft(C['button']), 0.55, send=0.6)
add('drums', snap(1.0), ft(C['button']), 0.5, send=0.3); add('drums', daf('t'), ft(C['button']), 0.3)

# ---------------- SFX timeline ----------------
# hook: three products tumble in (whistles) and land (thumps, dust poofs)
slide_whistle(0.0, 1500, 600, ft(C['land1']) - 0.02, 0.8, pan=0.4)
slide_whistle(ft(C['land1']) - 0.1, 1700, 700, ft(C['land2'] - C['land1']) + 0.06, 0.7, pan=0.0)
slide_whistle(ft(C['land2']) - 0.1, 1900, 800, ft(C['land3'] - C['land2']) + 0.06, 0.7, pan=-0.4)
for k, fl in enumerate((C['land1'], C['land2'], C['land3'])):
    thump(ft(fl), 1.0, (62, 58, 66)[k], pan=(0.4, 0, -0.4)[k]); puff_sfx(ft(fl) + 0.02, 0.8, pan=(0.4, 0, -0.4)[k])
    pop(ft(fl) + 0.06, 0.35, pan=(0.4, 0, -0.4)[k], f1=500)   # the cell under it: "oof"
# title words pop (stagger 4 frames), arabic line
for i in range(4): pop(ft(C['title'] + 4 * i), 0.55, pan=0.3 - 0.2 * i, f1=900 + 120 * i)
for i in range(3): pop(ft(C['title'] + 8 + 4 * i), 0.35, pan=0.2 - 0.2 * i, f1=1300 + 100 * i)
for f in (C['title'] + 12, C['title'] + 24, C['title'] + 36): tok(ft(f), 86, 0.25)   # products bob on the beat
# question
for i in range(3): pop(ft(C['question'] + 2 + 4 * i), 0.55, pan=0.3 - 0.3 * i, f1=1000 + 150 * i)
for j in range(3): boing(ft(C['tilt'] + 4 + 4 * j), 300 + 60 * j, 0.5, 0.35, pan=(0.4, 0, -0.4)[j], up=True)
# crouch + leaps
slide_whistle(ft(C['crouch']), 500, 900, 0.22, 0.6)
for j in range(3):
    whoosh(ft(C['leap'] + 2 * j) + 0.05, 0.06, 0.25, 600, 7000, 0.75, pan_from=(0.4, 0, -0.4)[j], pan_to=(0.4, 0, -0.4)[j])
    boing(ft(C['leap'] + 2 * j), 260 + 40 * j, 0.45, 0.4, up=True)
# dry
crack(ft(C['crack']), 1.0, pan=-0.3); crack(ft(C['crack'] + 10), 0.6, pan=0.3)
rustle(ft(C['dry']), 1.6, 1.0)
for k, f in enumerate((C['dry'] + 4, C['dry'] + 12, C['dry'] + 20, C['dry'] + 28)): plip(ft(f), 500 + k * 80, 1500 + k * 120, 0.5, pan=(-0.2, 0.3, -0.6, 0.6)[k])
sad_wah(ft(C['yawn']), 55, 0.9, 1.0)
# toner
slide_whistle(ft(C['tonerIn'] - 6), 1600, 700, 0.25, 0.7)
puff_sfx(ft(C['tonerIn']), 0.7); boing(ft(C['tonerIn']), 140, 0.5, 0.35); thump(ft(C['tonerIn']), 0.55, 84)
pop(ft(C['tonerIn'] + 4), 0.5)   # header badge
for i in range(5): pop(ft(C['tonerLine'] + 3 * i), 0.3, pan=0.3 - 0.15 * i, f1=900 + 80 * i)
for k in range(5): squeak(ft(C['twist']) + k * 0.09, 1.0, pan=0.1, f0=1300 + 120 * (k % 2), f1=2000)
cork(ft(C['capPop']), 1.1); whoosh(ft(C['capPop']) + 0.08, 0.04, 0.35, 900, 7000, 0.6, 0.0, 0.6)
slide_whistle(ft(C['capPop']), 900, 2200, 0.35, 0.5, pan=0.5)
whoosh(ft(C['pour']) - 0.05, 0.25, 0.2, 300, 2500, 0.4)
glug_pour(ft(C['pour']), ft(C['pourEnd'] - C['pour']) + 0.15, 1.0)
wet_splat(ft(C['splash']), 0.9, size=1.0)
WV = CUE['wave']
def reach(x, r):
    d = abs(x - WV['x0']) / WV['reach']
    return (C['splash'] + 60 if d >= 0.985 else C['splash'] - WV['tau'] * np.log(1 - d)) + r * 5
gulps = {}
for r, xs in ((0, [4, 272, 540, 808, 1076]), (1, [138, 406, 674, 942])):
    for x in xs:
        fr = reach(x, r); fr = fr if fr % 2 == 0 else fr + (2 - fr % 2)
        fr = int(np.ceil(fr / 2) * 2)
        gulps.setdefault(fr, []).append((x, r))
for fr, lst in sorted(gulps.items()):
    for x, r in lst:
        gulp(ft(fr), 0.9 if r == 0 else 0.5, pan=(x - 540) / 600, m=50 + (3 if r else 0) + int(abs(x - 540) / 90))
    add('music', pizz(int(np.clip(71 + (fr - C['splash']) // 4, 71, 86)), 0.4), ft(fr), 0.25, send=0.3)
sparkle_sfx(ft(C['splash'] + 20), [79, 83, 86, 91], 0.45)
pop(ft(C['tonerChip']), 0.45)
slide_whistle(ft(C['capBack'] - 6), 2200, 900, 0.25, 0.5, pan=0.4)
tok(ft(C['capBack']), 72, 0.8)
for k in range(4): squeak(ft(C['capBack'] + 2) + k * 0.09, 0.8, pan=0.1, f0=1500, f1=2200)
click(ft(C['capClick']), 1.0); ding(ft(C['capClick']) + 0.02, 91, 0.5, 0.3)
slide_whistle(ft(C['tonerOut']), 500, 1000, 0.18, 0.5)
whoosh(ft(C['tonerOut'] + 4) + 0.05, 0.05, 0.25, 600, 7000, 0.7, 0.0, 0.7)
# serum
slide_whistle(ft(C['serumIn'] - 6), 1600, 700, 0.25, 0.6, pan=0.4)
puff_sfx(ft(C['serumIn']), 0.6, pan=0.4); boing(ft(C['serumIn']), 160, 0.45, 0.35, pan=0.4)
pop(ft(C['serumIn'] + 4), 0.5)
for i in range(4): pop(ft(C['serumLine'] + 3 * i), 0.3, pan=0.3 - 0.15 * i, f1=900 + 80 * i)
for k, f in enumerate((C['pump1'], C['pump2'], C['pump3'])): spray(ft(f), 1.0, pan=0.45 - 0.1 * k); tok(ft(f), 74 + 2 * k, 0.35, pan=0.45)
DROP_NOTES = [67, 69, 71, 72, 74, 76, 78, 79]   # the 8 hyaluronic droplets: a G major scale
for (fl, fd, x, sz), m in zip(CUE['drops'], DROP_NOTES):
    plip(ft(fl), 900, 1700, 0.25, pan=(x - 540) / 600)
    bloop(ft(fd), m, 1.0, pan=(x - 540) / 600)
    add('sfx', glock(m + 12, 0.9, 0.6), ft(fd) + 0.02, 0.18, pan=(x - 540) / 600, send=0.6)
pop(ft(C['serumChips']), 0.45); pop(ft(C['serumChips'] + 6), 0.4)
for i, m in enumerate([79, 81, 83, 86, 88, 91, 93, 95, 98]): add('sfx', glock(m, 0.9, 0.6), ft(C['shine']) + i * 0.1, 0.3, pan=0.7 - i * 0.17, send=0.6)
slide_whistle(ft(C['serumOut']), 500, 1000, 0.18, 0.5)
whoosh(ft(C['serumOut'] + 4) + 0.05, 0.05, 0.25, 600, 7000, 0.7, 0.0, -0.7)
# cream
slide_whistle(ft(C['creamIn'] - 6), 1600, 700, 0.25, 0.6)
puff_sfx(ft(C['creamIn']), 0.6); boing(ft(C['creamIn']), 150, 0.45, 0.35)
pop(ft(C['creamIn'] + 4), 0.5)
for i in range(6): pop(ft(C['creamLine'] + 3 * i), 0.28, pan=0.3 - 0.12 * i, f1=900 + 70 * i)
# squeeze: rubbery strain rising, tremble
t_a, t_b = ft(C['squeeze']), ft(C['squirt'])
n = int((t_b - t_a) * SR); tq = np.arange(n) / SR; p = tq / (t_b - t_a)
strain = chirp(300 * 2 ** (p * 1.3) * (1 + 0.03 * np.sin(2 * np.pi * 24 * tq)), n) * p ** 1.5 * 0.35 + bp(noise(n), 800, 3000) * p ** 2 * 0.25
add('sfx', strain, t_a, 0.45, send=0.2)
cork(ft(C['squirt']), 1.2); wet_splat(ft(C['squirt'] + 3), 0.6, size=0.7)
tok(ft(C['squirt'] + 4), 76, 0.9, pan=-0.1); tok(ft(C['squirt'] + 11), 79, 0.5, pan=-0.5); tok(ft(C['squirt'] + 15), 81, 0.3, pan=-0.8)   # the cap bonks and bounces away
boing(ft(C['squirt'] + 1), 220, 0.5, 0.4, up=True)
for k, (x, f) in enumerate(CUE['gaps']): squelch(ft(f), 1.0, pan=(x - 540) / 600, m=(74, 76, 78, 79)[k])
add('sfx', bp(noise(int(0.5 * SR)), 1500, 5000) * np.linspace(0.2, 1, int(0.5 * SR)) * 0.12, ft(CUE['gaps'][0][1]), 1.0, send=0.2)   # ribbon zip
whoosh(ft(C['flip']) + 0.2, 0.2, 0.2, 400, 5000, 0.7, -0.6, 0.0)
thump(ft(C['tada']), 0.6, 80)
for j, m in enumerate([67, 71, 74, 79]): add('music', pizz(m, 0.5), ft(C['tada']) + j * 0.03, 0.4, pan=-0.3 + 0.2 * j, send=0.3)
ding(ft(C['tada']) + 0.06, 91, 0.6)
shimmer(ft(C['seal']), 1.4, 1.0)
slide_whistle(ft(C['inflate'] - 8), 900, 1600, 0.3, 0.4, pan=-0.5)
cork(ft(C['inflate']), 0.9); click(ft(C['inflate']) + 0.02, 0.8)
for i, m in enumerate([98, 95, 91, 86, 83, 79]): add('sfx', glock(m, 0.8, 0.6), ft(C['deep']) + i * 0.09, 0.25, pan=np.sin(i) * 0.5, send=0.6)
pop(ft(C['creamChips']), 0.45); pop(ft(C['creamChips'] + 6), 0.4)
slide_whistle(ft(C['creamOut']), 500, 1000, 0.18, 0.5)
whoosh(ft(C['creamOut'] + 4) + 0.05, 0.05, 0.25, 600, 7000, 0.7, 0.0, 0.7)
# the family drops back in for the lock (whistles land on the hit)
for j in range(3): slide_whistle(ft(C['heroIn'] + 2 * j), 1800 - 150 * j, 700, ft(C['lock'] - C['heroIn'] - 2 * j), 0.6, pan=(0.5, 0, -0.5)[j])
for j in range(3): thump(ft(C['lock']), 0.6, (62, 58, 66)[j], pan=(0.5, 0, -0.5)[j])
# lock + zoom out + lens pop + wink
slide_whistle(ft(C['lock'] - 6), 600, 300, 0.24, 0.6)
poof(ft(C['lock']), 0.8); sparkle_sfx(ft(C['lock']) + 0.05, [91, 95, 98, 103], 0.7)
whoosh(ft(C['iris']) + 0.15, 0.15, 0.05, 2000, 300, 0.6)
whoosh(ft(C['lensPop']) - 0.02, 0.4, 0.15, 200, 4000, 1.0)
pop(ft(C['lensPop']), 0.9, f1=1600); sparkle_sfx(ft(C['lensPop']) + 0.03, [93, 98, 101], 0.6)
ding(ft(C['wink']), 98, 0.9, 0.4); add('sfx', glock(103, 0.9, 0.5), ft(C['wink']) + 0.08, 0.3, pan=0.5, send=0.6)
for i in range(5): pop(ft(C['result'] + 4 * i), 0.3, pan=0.3 - 0.15 * i, f1=900 + 100 * i)
# star wipe
riser(ft(C['end']), 0.55, 0.5); sparkle_sfx(ft(C['starWipe']) + 0.1, [91, 95, 98, 101, 103], 0.5, 0.06)
# end card
for k, f in enumerate((C['e1'], C['e2'], C['e3'])):
    slide_whistle(ft(f) - 0.25, 1700, 800, 0.23, 0.5, pan=(0.5, 0, -0.5)[k])
    thump(ft(f), 0.85, (62, 58, 66)[k], pan=(0.5, 0, -0.5)[k]); puff_sfx(ft(f) + 0.02, 0.6, pan=(0.5, 0, -0.5)[k])
for k in range(3):
    ding(ft(C['badges'] + 6 * k), (79, 83, 86)[k], 0.45, pan=(0.5, 0, -0.5)[k])
scratch(ft(C['arrows']), ((0, 0.28),), 0.7, pan=0.3); scratch(ft(C['arrows'] + 8), ((0, 0.28),), 0.7, pan=-0.3)
scratch(ft(C['logo']), ((0, 0.12), (0.14, 0.12), (0.28, 0.14), (0.44, 0.12)), 0.9)
pop(ft(C['logo'] + 14), 0.8, f1=1400); sparkle_sfx(ft(C['logo'] + 14) + 0.03, [91, 95, 98], 0.6)
for i in range(5): pop(ft(C['tag'] + 4 * i), 0.3, pan=0.3 - 0.15 * i, f1=900 + 100 * i)
for i in range(4): pop(ft(C['tag'] + 16 + 4 * i), 0.22, pan=0.2 - 0.15 * i, f1=1200 + 80 * i)
slide_whistle(ft(C['final'] - 4), 500, 1100, 0.2, 0.5)
for j in range(3): boing(ft(C['final'] - j), 300 + 50 * j, 0.4, 0.35, pan=(0.5, 0, -0.5)[j], up=True)
sparkle_sfx(ft(C['final']) + 0.05, [91, 95, 98, 103, 107], 0.6, 0.05)

# ---------------- mix ----------------
duck = np.ones(N)
def duck_at(t, depth=0.45, rel=0.12):
    i = int(t * SR); x = np.arange(int(0.5 * SR)) / SR
    g = 1 - depth * np.exp(-x / rel)
    n = min(len(g), N - i)
    if n > 0: duck[i:i + n] = np.minimum(duck[i:i + n], g[:n])
for f in (C['land1'], C['capPop'], C['splash'], C['squirt'], C['lock'], C['lensPop']):
    duck_at(ft(f), 0.45, 0.15)
music = buses['music'] * duck[:, None]
irn = int(2.0 * SR); t = np.arange(irn) / SR
ir = np.stack([lp(noise(irn), 7500) * np.exp(-t * 6.9 / 1.4), lp(noise(irn), 7500) * np.exp(-t * 6.9 / 1.4)], 1)
ir[:int(0.016 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum(0))
verb = np.stack([sg.fftconvolve(buses['send'][:, c], ir[:, c])[:N] for c in range(2)], 1) * 0.42
mix = buses['drums'] * 0.8 + music * 0.72 + buses['duckless'] * 0.85 + buses['sfx'] * 1.0 + verb
mix = hp(mix.T, 28).T
for nm, bb in (('drums', buses['drums']), ('music', music), ('duckless', buses['duckless']), ('sfx', buses['sfx']), ('verb', verb)):
    print(nm, 'peak %.2f rms %.3f' % (np.abs(bb).max(), np.sqrt((bb ** 2).mean())))
mix /= np.percentile(np.abs(mix), 99.97) / 0.85
mix = np.tanh(mix)
fade = int(0.08 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix /= np.abs(mix).max() / 0.89
os.makedirs('out', exist_ok=True)
pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
with wave.open('out/mix_raw.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote out/mix_raw.wav', N / SR, 's')
