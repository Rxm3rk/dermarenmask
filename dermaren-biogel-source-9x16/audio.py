"""Dermaren Bio-Gel film — score + cartoon SFX, synthesized and locked to site/cues.json.
120 BPM. Act 1 (the ordinary mask): sneaky jazzy pizzicato in D minor with upright bass, brushes and snaps.
From the reveal: bright F major — glockenspiel/celesta hook, pizzicato arps, soft kick, shaker, a touch of daf.
Writes out/mix_raw.wav (48 kHz stereo); master with ffmpeg loudnorm afterwards."""
import numpy as np, scipy.signal as sg, wave, os, json

SR = 48000
CUE = json.load(open(os.path.join(os.path.dirname(__file__), 'site', 'cues.json')))
FPS, FRAMES = CUE['FPS'], CUE['FRAMES']
C = CUE['frames']
DUR = FRAMES / FPS                      # 35.000 s
N = int(round(DUR * SR))
SPB = 60 / CUE['BPM']
T0 = CUE['beat0'] / FPS
bt = lambda k: T0 + SPB * k             # beat k in seconds
bar = lambda b, k=0: bt(4 * b + k)
ft = lambda f: f / FPS                  # frame → seconds
rng = np.random.default_rng(20261002)

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
def env_ar(n, a, r):
    t = np.arange(n) / SR
    return np.clip(t / max(a, 1e-4), 0, 1) * np.exp(-np.clip(t - a, 0, None) / r)

def sweep_filter(x, f0, f1, kind='low', curve=1.0, block=256, q=None):
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
    f = mtof(m)
    return modal(f, [1, 2.76, 5.40, 8.93], [1, 0.42 * bright, 0.22 * bright, 0.1 * bright], [1.1, 0.42, 0.2, 0.09], dur, click=0.25) * 0.42

def celesta(m, dur=1.4):
    f = mtof(m)
    return modal(f, [1, 2, 3.98, 6.1], [1, 0.18, 0.12, 0.04], [0.9, 0.5, 0.25, 0.1], dur, click=0.08, att=0.004) * 0.45

def marimba(m, dur=0.8):
    f = mtof(m)
    s = modal(f, [1, 3.93, 9.2], [1, 0.32, 0.1], [0.45, 0.1, 0.035], dur, click=0.2, att=0.002)
    return s * 0.5

def pizz(m, dur=0.6, bright=1.0, decay=0.32):
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m); s = np.zeros(n)
    for k in range(1, 12):
        if f * k > 12000: break
        a = abs(np.sin(k * np.pi * 0.18)) / k ** (1.15 / bright)
        s += a * np.sin(2 * np.pi * f * k * t * (1 + 0.0004 * k * k)) * np.exp(-t * (1 / decay) * (1 + 0.45 * k))
    s *= 1 - np.exp(-t / 0.0012)
    s += bp(noise(n), 200, 1800) * np.exp(-t / 0.006) * 0.25          # finger thump
    s = s + 0.5 * bp(s, 250, 900, 1)                                   # wooden body
    return s * 0.42

def harp(m, dur=2.2):
    return pizz(m, dur, bright=1.6, decay=1.1) * 0.9

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

# drums
def kick(g=1.0):
    t = tt(0.4); f = 50 + 70 * np.exp(-t / 0.025)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    return np.tanh(1.4 * s) * g
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
def jingles(dur=0.28, amp=1.0):
    t = tt(dur); s = np.zeros_like(t)
    for f in (5230, 6810, 7940, 9160, 10420, 11800):
        s += np.sin(2 * np.pi * f * (1 + 0.004 * rng.standard_normal()) * t + rng.uniform(0, 6.28)) * np.exp(-t / rng.uniform(0.06, 0.16))
    s = s / 6 + hp(noise(len(t)), 6500) * np.exp(-t / 0.035) * 0.8
    return s * (1 - np.exp(-t / 0.002)) * amp
def daf(kind, g=1.0):
    t = tt(0.5)
    if kind == 'D':
        f = 78 + 40 * np.exp(-t / 0.02)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22) * 0.9 + bp(noise(len(t)), 120, 700) * np.exp(-t / 0.05) * 0.45
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
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045) * (1 - np.exp(-t / 0.002))
    add('sfx', s, t0, gain * 0.5, pan, send=0.35)

def bloop(t0, m, gain=1.0, pan=0.0):   # pitched water-drop plop (tuned)
    t = tt(0.4); f0 = mtof(m)
    f = f0 * (0.55 + 0.45 * np.clip(t / 0.05, 0, 1) ** 0.5)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.09) * (1 - np.exp(-t / 0.002))
    s += np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR) * np.exp(-t / 0.04) * 0.2
    add('sfx', s, t0, gain * 0.5, pan, send=0.45)

def wet_splat(t0, gain=1.0, pan=0.0, size=1.0):
    t = tt(0.6)
    s = bp(noise(len(t)), 350, 3500) * np.exp(-t / (0.05 * size)) * (1 - np.exp(-t / 0.002))
    s += sweep_filter(noise(len(t)), 3000, 600, 'band', 0.6) * np.exp(-t / 0.09) * 0.5
    s += np.sin(2 * np.pi * np.cumsum(90 + 80 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.08) * 0.7 * size
    add('sfx', np.tanh(1.5 * s), t0, gain * 0.7, pan, send=0.3)

def slide_whistle(t0, f0, f1, dur, gain=1.0, pan=0.0):
    t = tt(dur + 0.08); p = np.clip(t / dur, 0, 1)
    f = f0 * (f1 / f0) ** (p ** 0.8) * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.08 * bp(noise(len(t)), 800, 4000)
    s *= np.clip(t / 0.02, 0, 1) * np.clip(1 - (t - dur) / 0.08, 0, 1)
    add('sfx', s, t0, gain * 0.22, pan, send=0.35)

def velcro(t0, dur=0.35, gain=1.0, pan=0.0):
    n = int(dur * SR); t = np.arange(n) / SR
    imp = (rng.random(n) < 0.012).astype(float) * rng.uniform(0.3, 1, n)
    s = bp(imp, 1500, 7000) * 3 + bp(noise(n), 2000, 6000) * 0.25
    s *= np.clip(t / 0.03, 0, 1) * np.clip(1 - (t - dur + 0.08) / 0.08, 0, 1)
    add('sfx', s, t0, gain * 0.45, pan, send=0.2)

def puff_sfx(t0, gain=1.0, pan=0.0):
    t = tt(0.3); e = np.clip(t / 0.02, 0, 1) * np.exp(-t / 0.07)
    add('sfx', lp(noise(len(t)), 1800) * e, t0, gain * 0.5, pan, send=0.3)

def sizzle(t0, dur, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    imp = (rng.random(n) < 0.004).astype(float) * rng.uniform(0.2, 1, n)
    s = hp(imp, 3000) * 2.5 + hp(noise(n), 5000) * 0.08 * (0.6 + 0.4 * np.sin(2 * np.pi * 3 * t))
    s *= np.clip(t / 0.15, 0, 1) * np.clip((dur - t) / 0.2, 0, 1)
    add('sfx', np.stack([s, np.roll(s, 300)], 1), t0, gain * 0.5, send=0.2)

def crinkle(t0, dur=0.4, gain=1.0):
    n = int(dur * SR); s = np.zeros(n)
    k = 0
    while k < n:
        L = int(rng.uniform(0.004, 0.02) * SR)
        if k + L > n: break
        if rng.random() < 0.7:
            lo = rng.uniform(1200, 4000)
            s[k:k + L] += bp(noise(L), lo, lo * 2.4) * np.hanning(L) * rng.uniform(0.3, 1)
        k += int(L * rng.uniform(0.6, 1.6))
    add('sfx', s, t0, gain * 0.55, send=0.2)

def rip(t0, gain=1.0):
    t = tt(0.32)
    s = sweep_filter(noise(len(t)), 900, 6000, 'band', 0.5) * np.exp(-t / 0.12) * (1 - np.exp(-t / 0.004))
    imp = (rng.random(len(t)) < 0.02).astype(float)
    s += bp(imp, 2000, 8000) * 1.5 * np.exp(-t / 0.1)
    add('sfx', s, t0, gain * 0.8, send=0.25)

def poof(t0, gain=1.0):
    t = tt(1.0)
    s = lp(noise(len(t)), 900) * np.exp(-t / 0.18) * (1 - np.exp(-t / 0.01))
    s += sweep_filter(noise(len(t)), 4000, 400, 'band', 0.5) * np.exp(-t / 0.25) * 0.5
    s += np.sin(2 * np.pi * np.cumsum(70 + 50 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.2) * 0.6
    add('sfx', np.tanh(1.2 * s), t0, gain * 0.9, send=0.5)

def thump(t0, gain=1.0, f0=60):
    t = tt(0.8); f = f0 + 60 * np.exp(-t / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)
    s += bp(noise(len(t)), 400, 2500) * np.exp(-t / 0.012) * 0.6
    add('sfx', np.tanh(1.8 * s), t0, gain * 0.9, send=0.25)

def slam(t0, gain=1.0):
    thump(t0, gain, 52)
    t = tt(0.12); add('sfx', hp(noise(len(t)), 2500) * np.exp(-t / 0.01), t0, gain * 0.35, send=0.3)
    t = tt(1.6); add('sfx', np.sin(2 * np.pi * np.cumsum(38 + 30 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.5) * 0.7, t0, gain * 0.8)

def boing(t0, f0=180, gain=1.0, dur=0.6, pan=0.0):
    t = tt(dur); f = f0 * (1 + 0.35 * np.exp(-t / 0.15) * np.sin(2 * np.pi * 9 * t))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (dur * 0.35)) * (1 - np.exp(-t / 0.003))
    add('sfx', s, t0, gain * 0.35, pan, send=0.35)

def jelly(t0, gain=1.0, dur=0.7, f0=140, pan=0.0):   # wobbly gel
    t = tt(dur); wob = np.sin(2 * np.pi * 11 * t) * np.exp(-t / (dur * 0.4))
    f = f0 * (1 + 0.25 * wob)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * wob) * np.exp(-t / (dur * 0.45)) * (1 - np.exp(-t / 0.004))
    s += bp(noise(len(t)), 500, 2000) * np.exp(-t / 0.03) * 0.3
    add('sfx', s, t0, gain * 0.45, pan, send=0.3)

def cork(t0, gain=1.0):
    t = tt(0.25); f = 900 * np.exp(-t / 0.05) + 300
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.04) + bp(noise(len(t)), 1000, 5000) * np.exp(-t / 0.006) * 0.8
    add('sfx', s, t0, gain * 0.5, send=0.3)

def pop(t0, gain=1.0, pan=0.0, f1=1200):
    t = tt(0.15); f = 280 + f1 * np.clip(t / 0.03, 0, 1)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03) * (1 - np.exp(-t / 0.001))
    add('sfx', s, t0, gain * 0.3, pan, send=0.25)

def scratch(t0, strokes=((0, 0.09), (0.11, 0.16)), gain=1.0, pan=0.0):   # pencil
    n = int(0.35 * SR); t = np.arange(n) / SR; e = np.zeros(n)
    for a, d in strokes:
        e += np.clip((t - a) / 0.01, 0, 1) * np.clip((a + d - t) / 0.02, 0, 1) * (t >= a)
    s = bp(noise(n), 2500, 7500) * e * (0.7 + 0.3 * np.sin(2 * np.pi * 90 * t))
    add('sfx', s, t0, gain * 0.35, pan, send=0.15)

def bonk(t0, gain=1.0, pan=0.0):   # the dull "nope" for the ordinary mask
    t = tt(0.3); f = 200 * (1 - 0.25 * np.clip(t / 0.15, 0, 1))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.08) + 0.3 * np.sin(2 * np.pi * np.cumsum(f * 2.7) / SR) * np.exp(-t / 0.03)
    add('sfx', s * (1 - np.exp(-t / 0.002)), t0, gain * 0.45, pan, send=0.2)

def ding(t0, m, gain=1.0, pan=0.0):
    add('sfx', glock(m, 1.4), t0, gain * 0.9, pan, send=0.5)
    add('sfx', glock(m + 12, 0.9, 0.6), t0 + 0.004, gain * 0.25, -pan, send=0.5)

def sparkle_sfx(t0, notes, gain=1.0, spread=0.045):
    for i, m in enumerate(notes):
        add('sfx', glock(m, 1.0, 0.7), t0 + i * spread, gain * 0.45, pan=np.sin(i * 1.7) * 0.6, send=0.6)

def shimmer_bed(t0, dur, gain=1.0):   # icy cooling bed
    n = int(dur * SR); t = np.arange(n) / SR
    br = bp(noise(n), 3500, 9000) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.7 * t)) * np.clip(t / 0.3, 0, 1) * np.clip((dur - t) / 0.4, 0, 1)
    add('sfx', np.stack([br, np.roll(br, 700)], 1), t0, gain * 0.12, send=0.6)
    for i in range(int(dur * 7)):
        m = int(rng.choice([88, 91, 93, 96, 98, 100]))
        add('sfx', celesta(m, 0.9), t0 + rng.uniform(0, dur - 0.3), gain * 0.16, pan=rng.uniform(-0.8, 0.8), send=0.7)

def swell(t0, dur, notes, gain=1.0):
    add('music', pad(notes, dur, att=dur * 0.7, rel=0.6, cutoff=3200), t0, gain, send=0.5)

def riser(end_t, dur=1.4, gain=1.0):
    t = tt(dur); p = t / dur
    s = sweep_filter(noise(len(t)) * p ** 2, 400, 9000, 'low', 1.2) * 0.6
    s += np.sin(2 * np.pi * np.cumsum(330 * 2 ** (p * 2.0)) / SR) * p ** 3 * 0.1
    add('sfx', s, end_t - dur, gain, send=0.4)

def tremble(t0, dur, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = bp(noise(n), 1500, 5000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 24 * t))) * (t / dur) ** 1.5
    add('sfx', s, t0, gain * 0.3, send=0.2)

def thermo_whistle(t0, dur, up=True, gain=1.0):
    t = tt(dur); p = np.clip(t / dur, 0, 1)
    f = (500 * 2 ** (p * 1.5)) if up else (1400 * 2 ** (-p * 1.5))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.clip(t / 0.05, 0, 1) * np.clip((dur - t) / 0.08, 0, 1)
    add('sfx', s, t0, gain * 0.1, pan=0.6, send=0.4)

# ---------------- harmony ----------------
CH = {
    'Dm7': (38, [62, 65, 69, 72]), 'Gm7': (43, [62, 65, 67, 70]), 'A7': (45, [61, 64, 67, 69]),
    'Bbmaj7': (46, [62, 65, 69, 70]), 'Fmaj7': (41, [64, 65, 69, 72]), 'C7sus': (48, [65, 67, 70, 72]),
    'C7': (48, [64, 67, 70, 72]), 'Am7': (45, [64, 67, 69, 72]), 'Fmaj9': (41, [64, 67, 69, 72, 76]), 'F': (41, [65, 69, 72, 77]),
}
# per bar: list of (beat offset, chord)
PROG = {
    0: [(0, 'Dm7')], 1: [(0, 'Gm7')], 2: [(0, 'Dm7')], 3: [(0, 'A7')], 4: [(0, 'Dm7')], 5: [(0, 'Bbmaj7'), (2, 'A7')],
    6: [(0, 'Fmaj7')], 7: [(0, 'Dm7')], 8: [(0, 'Bbmaj7')], 9: [(0, 'C7sus'), (2, 'C7')],
    10: [(0, 'Fmaj7')], 11: [(0, 'Am7')], 12: [(0, 'Bbmaj7'), (2, 'C7')],
    13: [(0, 'Fmaj7')], 14: [(0, 'Dm7'), (2, 'Bbmaj7')], 15: [(0, 'Gm7'), (2, 'C7')], 16: [(0, 'Fmaj9')], 17: [(0, 'F')],
}
def chord_at(b, k):
    ch = PROG[b][0][1]
    for off, c in PROG[b]:
        if k >= off: ch = c
    return ch

# ---------------- ACT 1: sneaky pizzicato (bars 0–5) ----------------
MEL1 = {
    0: [(0, 74), (0.5, 69), (1, 74), (1.5, 77), (2, 76), (2.5, 74), (3, 73), (3.5, 74)],
    1: [(0, 70), (0.5, 74), (1, 79), (1.5, 77), (2, 74), (3, 70), (3.5, 69)],
    2: [(0, 74), (0.5, 69), (1, 74), (1.5, 77), (2, 81), (2.5, 79), (3, 77), (3.5, 76)],
    3: [(0, 73), (0.5, 76), (1, 79), (1.5, 82), (2, 81), (3, 79), (3.5, 76)],
    4: [(0, 77), (0.5, 74), (1, 69), (2, 74), (2.5, 77), (3, 76), (3.5, 73)],
    5: [(0, 74), (0.5, 77), (1, 82)],
}
for b, notes in MEL1.items():
    for k, m in notes:
        add('music', pizz(m, 0.5), bar(b, k), 0.62, pan=-0.2, send=0.25)
        add('music', marimba(m - 12, 0.5), bar(b, k), 0.16, pan=0.25, send=0.2)
BASS1 = {0: [38, 41, 45, 48], 1: [43, 46, 50, 41], 2: [38, 33, 38, 41], 3: [33, 37, 40, 43], 4: [38, 41, 45, 47], 5: [46, 50, 45, 49]}
for b, ns in BASS1.items():
    for k, m in enumerate(ns):
        if b == 5 and k >= 2: continue      # space for the rip / crumple
        add('music', ubass(m, 0.36), bar(b, k), 0.8)
# comping: soft pizz chord stabs on the & of 2 and 4
for b in range(0, 5):
    for k in (1.5, 3.5):
        for j, m in enumerate(CH[chord_at(b, k)][1][:3]):
            add('music', pizz(m - 12, 0.3, decay=0.2), bar(b, k) + j * 0.008, 0.18, pan=0.35, send=0.2)
for b in range(0, 5):
    for k in range(4):
        add('drums', brush(0.5 if k % 2 else 0.35), bar(b, k), 0.5, pan=0.15, send=0.1)
        add('drums', btap(0.35), bar(b, k + 0.5), 0.4, pan=0.2)
        if k % 2: add('drums', snap(1.0), bar(b, k), 0.42, pan=-0.25, send=0.25)
add('drums', snap(1.0), bar(5, 1), 0.42, pan=-0.25, send=0.25)

# ---------------- ACT 2+: bright F major ----------------
MEL2 = {   # glockenspiel hook
    6: [(0.5, 81, .5), (1, 84, .5), (1.5, 89, 1), (2.5, 88, .5), (3, 84, .5), (3.5, 81, .5)],
    7: [(0, 86, .5), (0.5, 84, .5), (1, 81, .5), (1.5, 77, .5), (2, 81, 1)],
    10: [(0.5, 84, .5), (1, 81, .5), (1.5, 84, .5), (2, 89, 1.5), (3.5, 88, .5)],
    11: [(0, 88, 1), (1, 84, .5), (1.5, 81, .5), (2, 79, 1), (3, 81, .5), (3.5, 84, .5)],
    12: [(0, 86, 1), (1, 89, .5), (1.5, 88, .5), (2, 88, .5), (2.5, 91, .5), (3, 94, 1)],
    13: [(0, 93, 1.5)],
    15: [(1, 86, .5), (1.5, 89, .5), (2, 88, .5), (2.5, 91, .5), (3, 94, .5), (3.5, 96, .5)],
}
for b, notes in MEL2.items():
    for k, m, d in notes:
        inst = celesta if b in (10, 11, 12) else glock
        add('music', inst(m, 1.2), bar(b, k), 0.7, pan=-0.15, send=0.45)
        add('music', pizz(m - 12, 0.4), bar(b, k), 0.3, pan=0.2, send=0.25)
# pizz arpeggios (8ths) and bass for groove bars
GROOVE = [6, 7, 8, 10, 11, 12, 13, 14, 15]
for b in GROOVE:
    for q in range(8):
        k = q / 2
        ch = CH[chord_at(b, k)]
        seq = [ch[1][0], ch[1][2], ch[1][1], ch[1][3]]
        add('music', pizz(seq[q % 4], 0.35, decay=0.22), bar(b, k), 0.24 if b != 8 else 0.18, pan=0.4 * np.sin(q * 1.3), send=0.25)
    for k in range(4):
        ch = CH[chord_at(b, k)]
        m = ch[0] + (0 if k % 2 == 0 else 7)
        add('music', ubass(m, 0.38), bar(b, k), 0.8)
    for k in range(4):
        if k % 2 == 0: add('drums', kick(), bar(b, k), 0.55)
        else: add('drums', snap(1.0), bar(b, k), 0.45, pan=-0.25, send=0.25)
        for h in range(2): add('drums', shaker(0.9 if h else 0.6), bar(b, k + h / 2), 0.32, pan=0.3)
    if b in (6, 7, 14, 15):   # a touch of daf (Kurdish frame drum) for flavour
        for k, kind in ((0, 'D'), (1.5, 't'), (2, 'D'), (3, 't'), (3.5, 't')):
            add('drums', daf(kind), bar(b, k), 0.22 if kind == 'D' else 0.16, pan=0.15, send=0.2)
# warm strings under the hero + end
for b in (10, 11, 12, 13, 14, 15):
    for off, c in PROG[b]:
        dur = (PROG[b][1][0] if len(PROG[b]) > 1 and off == 0 else 4 - off) * SPB
        add('music', pad(CH[c][1], dur, att=0.25, rel=0.5, cutoff=2400), bar(b, off), 0.42, send=0.45)
# bar 9: break — sus pad only
add('music', pad(CH['C7sus'][1], 2 * SPB, att=0.2, rel=0.4, cutoff=1800), bar(9, 0), 0.35, send=0.5)
add('music', pad(CH['C7'][1], 2 * SPB, att=0.1, rel=0.4, cutoff=2400), bar(9, 2), 0.38, send=0.5)
add('music', ubass(48, 1.6), bar(9, 0), 0.7); add('music', ubass(48, 0.9), bar(9, 2), 0.7)
# launch run into the hero (16ths, bar 9 beats 3–4)
for i, m in enumerate([60, 64, 67, 70, 72, 76, 79, 82]):
    add('music', pizz(m, 0.3), bar(9, 3) + i * SPB / 8, 0.35, pan=-0.5 + i * 0.14, send=0.3)

# final: big F chord on bar 16, button on bar 17
add('duckless', pad(CH['Fmaj9'][1] + [81], 2.6, att=0.02, rel=1.2, cutoff=3600), bar(16), 0.65, send=0.6)
add('duckless', ubass(29, 2.2), bar(16), 0.8)
for i, m in enumerate([77, 81, 84, 88, 91, 93]):
    add('duckless', glock(m, 1.6), bar(16) + i * 0.05, 0.5, pan=np.sin(i * 1.4) * 0.5, send=0.6)
add('duckless', harp(53, 2.4), bar(16), 0.5, send=0.4); add('duckless', harp(60, 2.4), bar(16) + 0.02, 0.4, send=0.4)
add('drums', kick(1.2), bar(16), 0.8); add('drums', daf('D'), bar(16), 0.35, send=0.3)
# button
add('duckless', pizz(53, 0.8), bar(17), 0.8); add('duckless', pizz(65, 0.8), bar(17) + 0.01, 0.5)
add('duckless', glock(89, 1.6), bar(17), 0.55, send=0.6)
add('drums', snap(1.0), bar(17), 0.5, send=0.3)

# ---------------- SFX timeline ----------------
whoosh(ft(C['splat']), 0.12, 0.1, 500, 3500, 0.5)
slide_whistle(0.0, 1500, 700, 0.08, 0.6)
wet_splat(ft(C['splat']), 1.3, size=1.3)
for i, d in enumerate((0.04, 0.09, 0.15, 0.22)): plip(ft(C['splat']) + d, 400 + i * 150, 1200 + i * 200, 0.7, pan=(-0.6, 0.6, -0.3, 0.4)[i])
for f, g in ((C['splat'] + 8, 0.8), (C['splat'] + 12, 0.6)): pop(ft(f), g)
# P1 drips (same physics as the picture)
DRIPS = [(0, 304, 50, 560), (-168, 232, 58, 450), (166, 232, 66, 450), (-92, 292, 74, 520),
         (0, 304, 84, 560), (-168, 232, 92, 450), (166, 232, 100, 450), (92, 292, 106, 520)]
for i, (x, y, t0, fy) in enumerate(DRIPS):
    th = t0 + 10 + np.sqrt(2 * (fy - y) / 2.6)
    th = th - (th % 2) + 2      # the picture samples motion on 2s
    plip(ft(t0 + 10), 700 + i * 40, 1400, 0.35, pan=x / 300)
    plip(ft(th), 300 + (i % 4) * 90, 900, 0.8, pan=x / 300)
    add('sfx', bp(noise(int(0.08 * SR)), 1500, 6000) * np.exp(-np.arange(int(0.08 * SR)) / SR / 0.02), ft(th), 0.12, pan=x / 300)
pop(ft(C['p1']), 0.7); pop(ft(C['p1'] + 2), 0.6, f1=900)
# P2 peel / slide / air
pop(ft(C['p2']), 0.7)
velcro(ft(C['p2'] + 4), 0.35, 1.0, pan=0.4)
slide_whistle(ft(C['p2'] + 18), 900, 600, 0.12, 0.9); slide_whistle(ft(C['p2'] + 44), 800, 480, 0.14, 1.0)
boing(ft(C['p2'] + 18), 240, 0.5, 0.35); boing(ft(C['p2'] + 44), 200, 0.5, 0.35)
for k in (10, 34, 58): puff_sfx(ft(C['p2'] + k), 0.8, pan=-0.4)
velcro(ft(C['p2'] + 30), 0.25, 0.6, pan=-0.4)
# P3 dries
pop(ft(C['p3']), 0.7)
sizzle(ft(C['p3']), 2.0, 1.0)
thermo_whistle(ft(C['p3'] + 2), 1.2, True, 1.0)
plip(ft(C['p3'] + 20), 1200, 2400, 0.4, pan=0.5)
for k in (12, 22, 32): crinkle(ft(C['p3'] + k), 0.12, 0.35)
# rip, crumple, poof
tremble(ft(C['rip'] - 8), 0.33, 0.8)
rip(ft(C['rip']), 1.2); whoosh(ft(C['rip']) + 0.05, 0.08, 0.2, 800, 6000, 0.7)
crinkle(ft(C['rip'] + 2), 0.5, 1.0)
tremble(ft(C['poof'] - 8), 0.33, 1.0)
# tension under the crumple: pizz tremolo on the dominant + brush roll, crescendo into the poof
t_a, t_b = ft(C['rip'] + 6), ft(C['poof'])
k = 0
while t_a + k * 0.0625 < t_b:
    p = (k * 0.0625) / (t_b - t_a)
    add('music', pizz(45 if k % 2 else 57, 0.18, decay=0.12), t_a + k * 0.0625, 0.25 + 0.5 * p, pan=0.3 * (-1) ** k, send=0.2)
    add('drums', btap(1.0), t_a + k * 0.0625 + 0.03, 0.2 + 0.4 * p, pan=0.2)
    k += 1
add('music', ubass(33, t_b - t_a), t_a, 0.5)
riser(ft(C['reveal']), 0.75, 0.6)
poof(ft(C['poof']), 1.0); sparkle_sfx(ft(C['poof']) + 0.05, [84, 88, 91, 96], 0.6)
# reveal
whoosh(ft(C['reveal']), 0.15, 0.3, 300, 7000, 0.9)
slam(ft(C['reveal'] + 2), 1.0)
sparkle_sfx(ft(C['reveal'] + 4), [89, 93, 96, 101], 0.7)
for i, f in enumerate((C['reveal'] + 8, C['reveal'] + 14, C['reveal'] + 16)): pop(ft(f), 0.6, pan=(-0.3, 0.3, 0)[i])
boing(ft(C['gelOut'] - 8), 120, 0.4, 0.3)
cork(ft(C['gelOut']), 1.0); whoosh(ft(C['gelOut']) + 0.02, 0.06, 0.2, 800, 5000, 0.6)
whoosh(ft(C['gelOut'] + 6), 0.2, 0.25, 300, 2500, 0.5, 0.0, 0.0)
jelly(ft(C['gelOut'] + 18), 1.1, 0.8, 150)
# ingredients: whoosh in, tuned plop on each beat (D, F, A, C over Bbmaj7)
for i, m in enumerate((86, 89, 93, 96)):
    land = C['d1'] + i * 12
    whoosh(ft(land), 0.3, 0.06, 500, 4000, 0.4, pan_from=(-0.8, 0.8, -0.8, 0.8)[i], pan_to=0)
    bloop(ft(land), m - 12, 1.0, pan=(-0.2, 0.2, -0.2, 0.2)[i])
    jelly(ft(land) + 0.02, 0.35, 0.4, 170 + i * 10)
    add('sfx', glock(m, 1.0, 0.6), ft(land) + 0.05, 0.22, send=0.6)
pop(ft(C['d1'] + 2), 0.5)
# flip gag
whoosh(ft(C['flip'] + 3), 0.1, 0.2, 500, 5000, 0.7, -0.5, 0.5)
jelly(ft(C['flip'] + 6), 0.6, 0.5, 130)
for k in range(8): jelly(ft(C['shake']) + k * 0.075, 0.9, 0.2, 150 + (k % 2) * 40, pan=0.5 * (-1) ** k)
for k in range(8): add('drums', shaker(1.0), ft(C['shake']) + k * 0.075, 0.5, pan=0.5 * (-1) ** k)
for k in range(4): add('drums', snap(1.0), bar(9, k + 0.5) if k else bar(9, 1), 0.3 if k else 0, pan=-0.25)
scratch(ft(C['check']), gain=1.0, pan=0.5); ding(ft(C['check']) + 0.04, 91, 0.9, 0.4)
whoosh(ft(C['flipBack'] + 3), 0.1, 0.18, 500, 4000, 0.5, 0.5, -0.5)
boing(ft(C['launch'] - 4), 110, 0.6, 0.35)
whoosh(ft(C['launch']) + 0.04, 0.06, 0.3, 600, 8000, 1.0, 0, 0)
whoosh(ft(C['iris'] + 10), 0.42, 0.12, 200, 3000, 0.6)
slide_whistle(ft(C['slap'] - 6), 1800, 700, 0.22, 0.7)
# hero
wet_splat(ft(C['slap']), 0.75, size=0.7); jelly(ft(C['slap']), 1.2, 0.9, 120)
for i, m in enumerate([53, 57, 60, 65, 69, 72, 77, 81]): add('music', harp(m, 1.8), ft(C['slap']) - 0.2 + i * 0.03, 0.35, pan=-0.5 + i * 0.13, send=0.5)
for i in range(8): add('sfx', glock(84 + (0, 4, 7, 12, 16, 19, 24, 28)[i] - 12, 0.8, 0.5), ft(C['hug']) + i * 2.5 / FPS, 0.28, pan=np.sin(i) * 0.6, send=0.6)
swell(ft(C['hug']), 0.9, [77, 81, 84], 0.25)
shimmer_bed(ft(C['cool']), 2.0, 1.0)
whoosh(ft(C['cool'] + 10), 0.6, 0.6, 300, 2500, 0.35, -0.7, 0.7); whoosh(ft(C['cool'] + 34), 0.6, 0.5, 300, 2500, 0.3, 0.7, -0.7)
thermo_whistle(ft(C['cool'] + 2), 1.0, False, 1.0)
swell(ft(C['melt']), 1.3, [70, 74, 77, 81], 0.3)
for i in range(10): plip(ft(C['melt'] + 6) + i * 0.06, 1500 - i * 70, 700 - i * 30, 0.22, pan=np.sin(i * 1.9) * 0.6)
sparkle_sfx(ft(C['glowEyes']), [84, 89, 93, 96, 101], 0.6, 0.06)
# recap
whoosh(ft(C['card']) - 0.02, 0.16, 0.12, 300, 5000, 0.8)
thump(ft(C['card']), 0.7, 70)
for f, g in ((C['card'] + 2, 0.6), (C['card'] + 6, 0.6), (C['card'] + 8, 0.7)): pop(ft(f), g)
for i in range(3):
    t0 = C['row1'] + i * 24
    pop(ft(t0), 0.5, f1=1000)
    bonk(ft(t0 + 6), 0.9, pan=0.5); scratch(ft(t0 + 6), ((0, 0.06), (0.08, 0.06)), 0.6, 0.5)
    scratch(ft(t0 + 12), ((0, 0.04), (0.05, 0.1)), 0.8, -0.5); ding(ft(t0 + 12) + 0.03, (89, 93, 96)[i], 0.85, -0.4)
# end
wet_splat(ft(C['splatEnd']), 1.1, size=1.4); whoosh(ft(C['splatEnd'] + 8), 0.3, 0.1, 200, 3000, 0.7)
whoosh(ft(C['end']), 0.1, 0.2, 300, 7000, 0.8)
slam(ft(C['end']), 1.05)
sparkle_sfx(ft(C['end'] + 4), [89, 93, 96, 101], 0.55)
sparkle_sfx(ft(C['logo']), [96, 101, 105], 0.6, 0.05); pop(ft(C['logo']), 0.6)
for k in range(5): pop(ft(C['tag'] + k * 3), 0.45, f1=900 + k * 80)
for k in range(2): pop(ft(C['tag'] + 10 + k * 3), 0.4, f1=1100)
scratch(ft(C['tag'] + 14), ((0, 0.3),), 0.6)
thump(ft(C['final']), 0.6, 60); sparkle_sfx(ft(C['final']) + 0.03, [89, 93, 96, 100, 101, 105], 0.6, 0.05)
pop(ft(C['button']), 0.4)

# ---------------- mix ----------------
duck = np.ones(N)
def duck_at(t, depth=0.45, rel=0.12):
    i = int(t * SR); x = np.arange(int(0.5 * SR)) / SR
    g = 1 - depth * np.exp(-x / rel)
    n = min(len(g), N - i)
    if n > 0: duck[i:i + n] = np.minimum(duck[i:i + n], g[:n])
for f in (C['splat'], C['rip'], C['poof'], C['reveal'] + 2, C['gelOut'], C['slap'], C['card'], C['splatEnd'], C['end']):
    duck_at(ft(f), 0.5, 0.15)
music = buses['music'] * duck[:, None]

irn = int(2.2 * SR); t = np.arange(irn) / SR
ir = np.stack([lp(noise(irn), 7500) * np.exp(-t * 6.9 / 1.6), lp(noise(irn), 7500) * np.exp(-t * 6.9 / 1.6)], 1)
ir[:int(0.018 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum(0))
verb = np.stack([sg.fftconvolve(buses['send'][:, c], ir[:, c])[:N] for c in range(2)], 1) * 0.45

mix = buses['drums'] * 0.85 + music * 0.85 + buses['duckless'] * 0.85 + buses['sfx'] * 0.95 + verb
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
