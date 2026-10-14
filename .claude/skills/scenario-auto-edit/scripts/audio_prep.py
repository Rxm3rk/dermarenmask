#!/usr/bin/env python3
"""Measure the sound kit and the music bed generated on Scenario MCP.

usage: python audio_prep.py --project <dir>

Reads <dir>/audio/sfx/*.mp3|wav and <dir>/audio/music.mp3|wav (download them there from Scenario MCP).
Writes:
  audio/sfx/<name>.wav       48 kHz stereo
  audio/sfx_info.json        per sound: duration, attack_s (first sample above 25 % of peak level), peak_s
  audio/music.wav            48 kHz stereo
  audio/music_info.json      drop_s (where the low end slams in), bpm, beats (kick onsets after the drop)
Place a cue by its attack (whooshes, ticks, punches) or its peak (booms, risers that end on a hit).
Offset the music so drop_s lands on the payoff word: offset = word_onset - drop_s.
A .wav made from an .mp3 is only rewritten when the .mp3 is newer; the two JSON files are
measurements and are rewritten on every run. Each file written is printed.
"""
import argparse, glob, json, os, subprocess, sys


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def save_json(obj, path, **kw):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, **kw)
try:
    import numpy as np, scipy.io.wavfile as wf
    from scipy.signal import stft
except ImportError:
    sys.exit('Missing Python packages. Run: pip install numpy scipy opencv-python-headless pillow')

def to_wav(src, dst):
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        print(f'kept      {dst} (newer than {os.path.basename(src)})'); return
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ar', '48000', '-ac', '2', dst], check=True)
    print(f'converted {dst}')

def load(p):
    sr, x = wf.read(p); x = x.astype(np.float32)
    if np.abs(x).max() > 2: x /= 32768.0
    return sr, x.mean(1) if x.ndim > 1 else x

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--project', required=True, help='the same folder given to prep.py')
    a = ap.parse_args()
    A = os.path.join(os.path.abspath(a.project), 'audio'); S = os.path.join(A, 'sfx')
    if not os.path.isdir(A):
        sys.exit(f'{A} not found. Download the Scenario sound kit into {S} and the music bed to {os.path.join(A, "music.mp3")} first.')
    for f in glob.glob(os.path.join(S, '*.mp3')) + glob.glob(os.path.join(S, '*.ogg')) + glob.glob(os.path.join(S, '*.opus')):
        to_wav(f, os.path.splitext(f)[0] + '.wav')
    info = {}
    for p in sorted(glob.glob(os.path.join(S, '*.wav'))):
        sr, x = load(p); x = x / (np.abs(x).max() + 1e-9)
        env = np.sqrt(np.convolve(x ** 2, np.ones(240) / 240, 'same'))
        info[os.path.basename(p)] = dict(dur=round(len(x) / sr, 3), attack_s=round(int(np.argmax(env > 0.25 * env.max())) / sr, 3),
                                         peak_s=round(int(np.argmax(env)) / sr, 3))
    save_json(info, os.path.join(A, 'sfx_info.json'), indent=1)
    print(f'{len(info)} sounds measured -> {os.path.join(A, "sfx_info.json")}')
    src = next((f for f in [os.path.join(A, 'music.mp3'), os.path.join(A, 'music.wav')] if os.path.exists(f)), None)
    if not src: print('no music bed found (audio/music.mp3)'); return
    if src.endswith('.mp3'): to_wav(src, os.path.join(A, 'music.wav'))
    sr, x = load(os.path.join(A, 'music.wav'))
    f, t, Z = stft(x, sr, nperseg=1024, noverlap=1024 - 96); M = np.abs(Z)
    low = 20 * np.log10(M[f < 150].sum(0) + 1e-6)
    sm = np.convolve(low, np.ones(25) / 25, 'same')
    w = int(0.5 / (t[1] - t[0]))
    rise = np.array([sm[i + w] - sm[max(0, i - w)] if i + w < len(sm) else 0 for i in range(len(sm))])
    sel = (t > 0.25 * t[-1]) & (t < 0.85 * t[-1])
    i_d = int(np.argmax(rise * sel))
    thr = np.percentile(low[sel], 80)
    j = next((k for k in range(max(0, i_d - w), len(low)) if low[k] > thr), i_d)
    drop = float(t[j])
    flux = np.maximum(0, np.diff(M[f < 150].sum(0))); tt = t[1:]; hop_s = tt[1] - tt[0]
    after = flux[tt >= drop - 0.02]; fl = after - after.mean()
    ac = np.correlate(fl, fl, 'full')[len(fl) - 1:]; lags = np.arange(len(ac)) * hop_s
    sel_l = (lags > 0.30) & (lags < 1.0)
    period = float(lags[sel_l][np.argmax(ac[sel_l])]) if sel_l.any() else 0.5
    beats = [round(drop + k * period, 3) for k in range(24) if drop + k * period < t[-1]]
    save_json(dict(drop_s=round(drop, 3), bpm=round(60 / period, 1), beat_period=round(period, 3), beats=beats[:24]), os.path.join(A, 'music_info.json'), indent=1)
    print(f'music: drop at {drop:.3f} s, about {60 / period:.0f} BPM -> {os.path.join(A, "music_info.json")}')

if __name__ == '__main__':
    main()
