"""Dermaren launch — score + SFX, synthesized. 124 BPM, D major pentatonic.
Korea → Kurdistan: a gayageum-style plucked lead over a Kurdish daf groove.
Writes out/mix_raw.wav (48 kHz stereo float); master with ffmpeg loudnorm afterwards."""
import numpy as np, scipy.signal as sg, wave, os

SR = 48000
FRAMES, FPS = 1050, 29.97
DUR = FRAMES / FPS                      # 35.035 s
N = int(round(DUR * SR))
SPB = 60 / 124
bt = lambda k: 0.048 + SPB * k          # beat k in seconds
ft = lambda f: f / FPS                  # frame → seconds
rng = np.random.default_rng(20260929)   # seeded

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
def bp(x, lo, hi, order=2): return sg.sosfilt(sg.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sg.sosfilt(sg.butter(order, f, 'high', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sg.sosfilt(sg.butter(order, min(f, SR * 0.45), 'low', fs=SR, output='sos'), x)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)

def lp_sweep(x, f0, f1, curve=1.0, block=512):
    """low-pass whose cutoff glides f0→f1 (exponential), coefficients per block, state carried."""
    out = np.zeros_like(x); zi = None; nb = int(np.ceil(len(x) / block))
    for b in range(nb):
        p = (b / max(1, nb - 1)) ** curve
        fc = f0 * (f1 / f0) ** p
        sos = sg.butter(2, min(fc, SR * 0.45), 'low', fs=SR, output='sos')
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        seg = x[b * block:(b + 1) * block]
        out[b * block:(b + 1) * block], zi = sg.sosfilt(sos, seg, zi=zi)
    return out

def saw(f, n, phase=0.0):
    """polyBLEP saw, f may be an array"""
    f = np.broadcast_to(np.asarray(f, float), (n,))
    dt = f / SR
    ph = (phase + np.cumsum(dt)) % 1.0
    s = 2 * ph - 1
    m = ph < dt; t = ph[m] / dt[m]; s[m] -= t + t - t * t - 1
    m = ph > 1 - dt; t = (ph[m] - 1) / dt[m]; s[m] -= t * t + t + t + 1
    return s

# ---------------- instruments ----------------
def kick(g=1.0):
    t = tt(0.5)
    f = 46 + 110 * np.exp(-t / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
    s = np.tanh(1.6 * s)
    c = hp(noise(len(t)), 2500) * np.exp(-t / 0.003) * 0.35
    return (s + c) * g

def clap():
    t = tt(0.45); e = np.zeros_like(t)
    for d in (0, 0.011, 0.022): e += (t >= d) * np.exp(-np.clip(t - d, 0, None) / 0.006)
    e += (t >= 0.03) * np.exp(-np.clip(t - 0.03, 0, None) / 0.11) * 0.55
    return bp(noise(len(t)), 900, 3200) * e

def hat(open_=False):
    t = tt(0.3 if open_ else 0.08)
    return hp(noise(len(t)), 7500, 4) * np.exp(-t / (0.09 if open_ else 0.018))

def jingles(dur=0.28, amp=1.0):
    t = tt(dur); s = np.zeros_like(t)
    for f in (5230, 6810, 7940, 9160, 10420, 11800):
        s += np.sin(2 * np.pi * f * (1 + 0.004 * rng.standard_normal()) * t + rng.uniform(0, 6.28)) * np.exp(-t / rng.uniform(0.06, 0.16))
    s = s / 6 + hp(noise(len(t)), 6500) * np.exp(-t / 0.035) * 0.8
    tr = np.exp(-t / 0.004) * 0.0 + (1 - np.exp(-t / 0.002))
    return s * tr * amp

def daf(kind, g=1.0):
    t = tt(0.5)
    if kind == 'D':   # low boom of the frame drum
        f = 78 + 40 * np.exp(-t / 0.02)
        b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
        b += bp(noise(len(t)), 120, 700) * np.exp(-t / 0.05) * 0.5
        s = b * 0.9
        j = jingles(0.3, 0.45)
    else:             # tak — sharp rim slap
        s = bp(noise(len(t)), 1500, 5200) * np.exp(-t / 0.018) * 0.9
        s += np.sin(2 * np.pi * 420 * t) * np.exp(-t / 0.03) * 0.25
        j = jingles(0.26, 0.7)
    out = s.copy(); out[:len(j)] += j
    return out * g

def gayageum(m, dur, bend=0.0, t_bend=0.12, vib=0.28, bright=1.0):
    n = int((dur + 1.6) * SR); t = np.arange(n) / SR
    semis = vib * np.clip((t - 0.2) / 0.35, 0, 1) * np.sin(2 * np.pi * 5.0 * t) * (t < dur + 0.8)
    if bend:
        x = np.clip((t - t_bend) / 0.14, 0, 1); semis = semis + bend * x * x * (3 - 2 * x)
    f = mtof(m) * 2 ** (semis / 12)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.zeros(n)
    for k in range(1, 15):
        if mtof(m) * k > 15000: break
        s += (1 / k ** 1.05) * np.sin(k * ph + 0.3 * k) * np.exp(-t * (1.1 + 0.5 * k ** 1.25 / bright))
    s *= 1 - np.exp(-t / 0.0015)
    s += bp(noise(n), 1800, 6500) * np.exp(-t / 0.008) * 0.25
    rel = np.clip(1 - (t - dur) / 0.35, 0, 1); s *= rel
    s = s + 0.6 * bp(s, 250, 1300, 1)          # woody body
    return s * 0.5

def bell(m, dur):
    n = int((dur + 1.8) * SR); t = np.arange(n) / SR; f = mtof(m)
    s = np.sin(2 * np.pi * f * t + 1.6 * np.exp(-t / 0.35) * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t / 0.9)
    s += 0.25 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.4)
    return s * (1 - np.exp(-t / 0.002)) * np.clip(1 - (t - dur - 1.2) / 0.6, 0, 1) * 0.35

def pluck(m, dur=0.22):
    n = int((dur + 0.3) * SR); t = np.arange(n) / SR; f = mtof(m)
    s = saw(f, n) + 0.5 * saw(f * 1.006, n)
    s = lp_sweep(s * np.exp(-t / 0.16), 5200, 700, 0.5, 256)
    return s * (1 - np.exp(-t / 0.001)) * 0.35

def pad(notes, dur, f0, f1, att=0.25, rel=0.8, curve=1.0):
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    L = np.zeros(n); R = np.zeros(n)
    for m in notes:
        for d, p in ((-13, -0.7), (-6, 0.4), (0, 0), (6, -0.4), (13, 0.7)):
            v = saw(mtof(m) * 2 ** (d / 1200), n, rng.uniform())
            a = (p + 1) * np.pi / 4; L += v * np.cos(a); R += v * np.sin(a)
    env = np.clip(t / att, 0, 1) * np.clip(1 - (t - dur) / rel, 0, 1)
    L = lp_sweep(L * env, f0, f1, curve); R = lp_sweep(R * env, f0, f1, curve)
    return np.stack([L, R], 1) / (len(notes) * 5) * 0.9

def bass(m, dur=0.2):
    n = int((dur + 0.08) * SR); t = np.arange(n) / SR; f = mtof(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * lp(saw(f, n), 900)
    return s * np.clip(t / 0.004, 0, 1) * np.clip(1 - (t - dur) / 0.08, 0, 1) * np.exp(-t / 0.35)

def sub(m, dur):
    n = int((dur + 0.1) * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * mtof(m) * t) * np.clip(t / 0.02, 0, 1) * np.clip(1 - (t - dur) / 0.1, 0, 1)

# ---------------- SFX ----------------
def whoosh(peak_t, rise=0.32, fall=0.24, lo=300, hi=6000, gain=1.0, pan_from=0.0, pan_to=0.0, bus='sfx'):
    n = int((rise + fall) * SR); t = np.arange(n) / SR
    x = noise(n)
    # band centre climbs to the peak then falls
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
    st = np.stack([s * np.cos(a), s * np.sin(a)], 1)
    add(bus, st, peak_t - rise, gain * 1.6, send=0.25)

def impact(t0, gain=1.0):
    t = tt(2.2)
    f = 34 + 40 * np.exp(-t / 0.06)
    b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    b = np.tanh(2 * b) * 0.9 + lp(noise(len(t)), 900) * np.exp(-t / 0.08) * 0.6
    add('sfx', b, t0, gain, send=0.35)

def rev_cymbal(end_t, dur=1.6, gain=1.0):
    t = tt(dur); s = hp(noise(len(t)), 4500) * (t / dur) ** 3.2
    add('sfx', np.stack([s, hp(noise(len(t)), 4500) * (t / dur) ** 3.2], 1), end_t - dur, gain * 0.45, send=0.3)

def riser(end_t, dur=1.9, gain=1.0):
    t = tt(dur); p = t / dur
    s = lp_sweep(noise(len(t)) * p ** 2, 400, 9000, 1.2) * 0.6
    s += np.sin(2 * np.pi * np.cumsum(220 * 2 ** (p * 2.2)) / SR) * p ** 3 * 0.12
    add('sfx', s, end_t - dur, gain, send=0.4)

def plip(t0, f0=520, f1=1500, gain=1.0, pan=0.0, dur=0.09):
    t = tt(0.35); f = f0 + (f1 - f0) * np.clip(t / dur, 0, 1) ** 0.6
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05) * (1 - np.exp(-t / 0.002))
    add('sfx', s, t0, gain * 0.5, pan, send=0.4)

def splash(t0, gain=1.0):
    t = tt(0.6); s = bp(noise(len(t)), 800, 7000) * np.exp(-t / 0.09) * (1 - np.exp(-t / 0.004)) * 0.4
    add('sfx', s, t0, gain, send=0.5)
    for i, (dt, f0) in enumerate(((0.0, 380), (0.07, 700), (0.13, 980), (0.2, 1250))):
        plip(t0 + dt, f0, f0 * 2.3, gain * (0.9 - i * 0.15), pan=(-0.3 + 0.2 * i))

def pop(t0, gain=1.0, pan=0.0):
    t = tt(0.25); f = 300 + 900 * np.clip(t / 0.035, 0, 1)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.04) * (1 - np.exp(-t / 0.001))
    s += hp(noise(len(t)), 3000) * np.exp(-t / 0.004) * 0.3
    add('sfx', s, t0, gain * 0.55, pan, send=0.3)

def shimmer(t0, notes, gain=1.0, spread=0.05):
    for i, m in enumerate(notes):
        add('sfx', bell(m, 0.3), t0 + i * spread, gain * 0.55, pan=np.sin(i * 1.7) * 0.6, send=0.6)

def tick(t0, gain=1.0):
    t = tt(0.12); s = np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.012) + hp(noise(len(t)), 5000) * np.exp(-t / 0.002) * 0.5
    add('sfx', s, t0, gain * 0.35, send=0.3)

def trans_hit(t0, gain=1.0):
    t = tt(0.9); f = 110 + 60 * np.exp(-t / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18) * 0.8
    s += bp(noise(len(t)), 600, 4000) * np.exp(-t / 0.05) * 0.5
    add('sfx', s, t0, gain, send=0.45)

# ---------------- arrangement ----------------
CH = {  # (bass midi, pad voicing)
    'Bm9': (35, [57, 62, 66, 73]), 'G': (43, [59, 62, 66, 69]), 'A': (45, [61, 64, 66, 71]),
    'F#m': (42, [57, 61, 64, 69]), 'D': (38, [54, 57, 61, 64, 69]),
}
bars = ['Bm9', 'G'] + ['G', 'A', 'F#m', 'Bm9'] * 3 + ['G', 'A']      # bars 0..15
BAR = 4 * SPB

# pads
for b, c in enumerate(bars):
    t0 = bt(4 * b)
    if b < 2: f0, f1, cv = (500 + 700 * b, 1200 + 900 * b, 1.0)
    else: f0 = f1 = 2600 if b < 13 else 3000; cv = 1
    p = pad(CH[c][1], BAR, f0, f1, 0.18 if b >= 2 else 0.6, 0.5)
    add('music', p, t0, 0.55 if b >= 2 else 0.5, send=0.35)
# breakdown pad (beats 64-66) and final chord (beat 66 →)
add('music', pad(CH['G'][1], 2 * SPB, 700, 1100, 0.08, 0.4), bt(64), 0.5, send=0.5)
add('duckless', pad(CH['D'][1] + [76], 3.4, 3600, 1600, 0.01, 0.6, 0.7), bt(66), 0.7, send=0.55)
add('duckless', sub(CH['D'][0], 3.2), bt(66), 0.5)
add('duckless', pad([81, 85, 88], 3.0, 5000, 3000, 1.2, 0.4), bt(66) + 0.2, 0.3, send=0.7)

# drums + bass: beats 8..63
DAF = {0: 'D', 3: 't', 6: 'D', 8: 't', 10: 'D', 12: 't', 14: 't', 15: 't'}
kicks = []
for k in range(8, 64):
    b = k // 4; c = CH[bars[b]]
    t = bt(k)
    fill = (26 <= k < 28) or (38 <= k < 40 and k % 2) or (50 <= k < 52 and k % 2) or (62 <= k < 64)
    if not (k in (27, 63)):
        add('drums', kick(), t, 0.95); kicks.append(t)
    if k % 2 == 1 and not (k in (27, 63)): add('drums', clap(), t, 0.55, send=0.3)
    add('drums', hat(True), t + SPB / 2, 0.16, pan=0.25)
    for q in range(4): add('drums', hat(False), t + q * SPB / 4, 0.07 + 0.04 * (q == 2), pan=-0.3)
    add('music', bass(c[0] + 12, 0.17), t + SPB / 2, 0.55)
    if k % 4 == 0: add('music', sub(c[0] + 12, BAR - 0.05), t, 0.28)
    # daf groove (16th grid within the bar)
    for q in range(4):
        step = (k % 4) * 4 + q
        if step in DAF and not fill: add('drums', daf(DAF[step]), t + q * SPB / 4, 0.42 if DAF[step] == 'D' else 0.34, pan=0.15, send=0.2)
    if fill:
        for q in range(4):
            g = 0.22 + 0.2 * ((k % 2) * 4 + q) / 8
            add('drums', daf('t'), t + q * SPB / 4, g, pan=0.15 * (-1) ** q, send=0.25)
        add('drums', daf('D'), t, 0.45, pan=0.1)
# arpeggiated plucks from beat 16
for k in range(16, 64):
    c = CH[bars[k // 4]][1]
    seq = [c[0] + 12, c[2] + 12, c[1] + 12, c[3] + 12]
    for q in range(4):
        add('music', pluck(seq[(k * 4 + q) % 4]), bt(k) + q * SPB / 4, 0.19, pan=0.35 * np.sin((k * 4 + q) * 0.9), send=0.25)

# gayageum: intro motif (beats 0-7) — pentatonic, bent and trembling notes
intro = [(0, 78, 0.9), (1, 76, 0.45), (1.5, 74, 0.45), (2, 71, 1.4, 0), (3.5, 74, 0.45),
         (4, 69, 0.45), (4.5, 71, 0.45), (5, 74, 0.45), (5.5, 76, 0.45), (6, 76, 1.6, 2), (7.5, 81, 0.4)]
for n in intro:
    b, m, d = n[:3]; bend = n[3] if len(n) > 3 else 0
    add('music', gayageum(m, d * SPB, bend=bend, t_bend=0.18), bt(b), 0.7, pan=-0.15, send=0.45)
# main phrase (4 bars) over G A F#m Bm
phrase = [(0, 71, .5), (.5, 74, .5), (1, 78, 1), (2.5, 76, .5), (3, 74, 1),
          (4, 76, 1.5), (5.5, 78, .5), (6, 79, 1.5, 2), (7.5, 78, .5),
          (8, 76, 1), (9, 73, .5), (9.5, 76, .5), (10, 78, 1.5), (11.5, 76, .5),
          (12, 74, 1.5), (13.5, 71, .5), (14, 69, 1), (15, 71, 1)]
for start in (16, 32, 48):
    for n in phrase:
        b, m, d = n[:3]; bend = n[3] if len(n) > 3 else 0
        if start + b >= 64: continue
        add('music', gayageum(m, d * SPB, bend=bend), bt(start + b), 0.62, pan=-0.12, send=0.4)
        if start >= 32: add('music', bell(m + 12, d * SPB), bt(start + b), 0.16, pan=0.3, send=0.5)
# breakdown + final flourish
add('music', gayageum(74, 1.4 * SPB), bt(64), 0.6, send=0.6)
add('music', gayageum(71, 0.9 * SPB, bend=2, t_bend=0.2), bt(65), 0.55, send=0.6)
for i, (b, m, d) in enumerate([(66, 78, .5), (66.5, 81, .5), (67, 86, 3.5), (69.5, 81, .5), (70, 83, .5), (70.5, 85, 2)]):
    add('duckless', gayageum(m, d * SPB, vib=0.35), bt(b), 0.62, send=0.6)
    add('duckless', bell(m, d * SPB), bt(b), 0.22, send=0.6)

# ---------------- SFX timeline ----------------
impact(0.10, 0.35)                                          # soft opening impact
plip(0.12, 420, 1300, 1.0)                                  # droplet rises
whoosh(ft(60), 0.9, 0.4, 250, 2500, 0.35, 0.4, -0.4)        # launch
riser(bt(8), 1.9, 0.55); rev_cymbal(bt(8), 1.5, 0.8)
whoosh(ft(115), 0.35, 0.3, 300, 7000, 0.9, -0.7, 0.7)       # cut → Erbil
impact(bt(8), 1.0)                                          # the drop
splash(ft(127), 1.0)                                        # droplet lands
whoosh(ft(173), 0.4, 0.25, 200, 5000, 0.8)                  # zoom into the pin
tick(ft(189), 1.0); shimmer(ft(190), [81, 86, 88, 90, 93], 0.7)   # mark locks
whoosh(ft(210), 0.28, 0.2, 800, 6000, 0.35, -0.3, 0.3)      # wordmark slides out
whoosh(ft(231), 0.3, 0.3, 200, 5000, 0.8)                   # lockup → lineup
trans_hit(bt(16), 0.8)
for i, f in enumerate((233, 238, 243)): whoosh(ft(f), 0.12, 0.25, 400, 3500, 0.35, pan_from=(-0.5, 0, 0.5)[i], pan_to=(-0.5, 0, 0.5)[i])
whoosh(ft(318), 0.25, 0.3, 300, 4000, 0.45, 0.6, -0.2)
whoosh(ft(405), 0.55, 0.3, 250, 8000, 1.0, -0.8, 0.8)       # whip pan
riser(bt(28), 1.9, 0.45)
trans_hit(bt(28), 1.0)
for f, p in ((479.5, 0.3), (494, 0.5), (653.5, -0.4), (668, -0.2), (827.5, 0.3), (842, 0.5)): pop(ft(f), 1.0, p)
whoosh(ft(579), 0.5, 0.3, 250, 7000, 0.9)                   # whip-tilt up
trans_hit(bt(40), 0.6)
whoosh(ft(753), 0.5, 0.3, 200, 6000, 0.9)                   # push in
trans_hit(bt(52), 0.6)
whoosh(ft(927), 0.5, 0.35, 200, 5000, 0.9)                  # pull back
plip(ft(930), 700, 1600, 0.7)
tick(ft(940), 0.7)                                          # the hold
whoosh(ft(956), 0.35, 0.3, 300, 9000, 1.0)                  # into the end card
impact(bt(66), 1.2); rev_cymbal(bt(66), 1.2, 1.0)
shimmer(bt(66) + 0.02, [86, 88, 90, 93, 95, 98], 0.9, 0.06)
whoosh(DUR + 0.02, 0.5, 0.1, 300, 7000, 0.9)              # collapse into the cut

# ---------------- mix ----------------
duck = np.ones(N)
for k in kicks:
    i = int(k * SR); t = np.arange(int(0.45 * SR)) / SR
    g = 1 - 0.55 * np.exp(-t / 0.11)
    n = min(len(g), N - i); duck[i:i + n] = np.minimum(duck[i:i + n], g[:n])
music = buses['music'] * duck[:, None]

# reverb: synthetic stereo IR (RT60 ≈ 1.9 s)
irn = int(2.4 * SR); t = np.arange(irn) / SR
ir = np.stack([lp(noise(irn), 7000) * np.exp(-t * 6.9 / 1.9), lp(noise(irn), 7000) * np.exp(-t * 6.9 / 1.9)], 1)
ir[:int(0.02 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum(0))
send = buses['send']
verb = np.stack([sg.fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], 1) * 0.55

mix = buses['drums'] * 0.9 + music * 0.8 + buses['duckless'] * 0.8 + buses['sfx'] * 0.85 + verb
mix = hp(mix.T, 25).T
np.save('out/premix_stats.npy', np.array([np.abs(mix).max(), np.percentile(np.abs(mix), 99.9)]))
for nm, bb in (('drums', buses['drums']), ('music', music), ('duckless', buses['duckless']), ('sfx', buses['sfx']), ('verb', verb)):
    print(nm, 'peak %.2f rms %.3f' % (np.abs(bb).max(), np.sqrt((bb ** 2).mean())))
mix /= np.percentile(np.abs(mix), 99.95) / 0.8
mix = np.tanh(mix)
# only the last 60 ms fade
fade = int(0.06 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix /= np.abs(mix).max() / 0.89

os.makedirs('out', exist_ok=True)
pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
with wave.open('out/mix_raw.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote out/mix_raw.wav', N / SR, 's')
