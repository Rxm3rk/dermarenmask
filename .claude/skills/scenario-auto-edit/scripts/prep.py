#!/usr/bin/env python3
"""Prepare a talking-head clip for editing: SDR, transcript, tight cut, frames, mattes, face and hand track.

usage: python prep.py <video> --project <dir> [--transcript-only] [--drop 0-6,9] [--language en]
                      [--vertical] [--pad-pre 0.04] [--pad-post 0.05] [--gap 0.10] [--max-pause 0.30]
                      [--work-long 2560] [--no-vision] [--range START END] [--retranscribe] [--force]

Two passes are normal:
  1. prep.py take.MOV --project P --transcript-only   prints every word with its index, cuts nothing
  2. prep.py take.MOV --project P [--drop 0-6]        cuts false starts and retakes (word indices from
                                                      pass 1), then every pause, and does the rest
Writes into <dir>/prep/:
  sdr.mp4            the source in SDR BT.709 at a constant frame rate (HDR is tone-mapped)
  source.json        which file the transcript belongs to (pass 2 reuses pass 1's transcript)
  words_src.json     word timings on the source clock (Whisper), refined to voiced onsets
  edl.json           kept ranges (source frames), cut times, kept words on the output clock ("onset")
  cut_audio.wav      the tightened voice track (48 kHz stereo, 6 ms joins inside silence)
  frames/NNNNN.jpg   kept source frames at working resolution (named by source frame index)
  matte/NNNNN.png    Apple Vision person matte for each kept frame
  faces.json         face box, pupils and lips per kept frame (normalised, top-left origin)
  hands.jsonl        hand pose per kept frame (wrist, MCPs, tips) when hands are visible
  project.json       sizes, fps, paths: read by fx.py and film.py
Then it re-transcribes the cut, prints any word that changed, and prints the kept words with the
indices beats.json uses. An existing edit (prep/edl.json) is only redone with --force.

Output frame: the source orientation (1080x1920 for vertical, 1920x1080 for landscape). With
--vertical, a landscape source gives a 1080x1920 edit whose camera follows the face track.

Needs ffmpeg, a local Whisper (mlx-whisper on Apple Silicon, or faster-whisper), and on macOS
swiftc (Xcode command line tools) for the Apple Vision mattes.
"""
import argparse, difflib, json, os, re, shutil, subprocess, sys, math
from concurrent.futures import ThreadPoolExecutor


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def save_json(obj, path, **kw):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, **kw)
import importlib.util
if any(importlib.util.find_spec(m) is None for m in ('numpy', 'scipy')):
    sys.exit('Missing Python packages. Run: pip install numpy scipy opencv-python-headless pillow')
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
LONG_WORD = 1.5          # a Whisper word longer than this usually hides skipped speech

def sh(cmd, **k):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **k)

def probe(path):
    r = json.loads(sh(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', path]).stdout)
    v = next((s for s in r['streams'] if s['codec_type'] == 'video'), None)
    if v is None: sys.exit(f'{path} has no video stream.')
    rot = 0
    for sd in v.get('side_data_list', []) or []:
        if 'rotation' in sd: rot = int(sd['rotation'])
    num, den = map(int, v['r_frame_rate'].split('/'))
    an, ad = map(int, (v.get('avg_frame_rate') or v['r_frame_rate']).replace('0/0', '0/1').split('/'))
    w, h = int(v['width']), int(v['height'])
    if abs(rot) in (90, 270): w, h = h, w
    return dict(w=w, h=h, fps=num / den, avg_fps=(an / ad if ad else 0.0), transfer=v.get('color_transfer', ''),
                dur=float(r['format']['duration']), audio=any(s['codec_type'] == 'audio' for s in r['streams']))

def to_sdr(src, dst, info):
    """SDR BT.709 at a constant frame rate. Returns True when the source was HDR."""
    hdr = info['transfer'] in ('arib-std-b67', 'smpte2084')
    if hdr and shutil.which('avconvert'):
        preset = 'Preset3840x2160' if max(info['w'], info['h']) >= 3000 else 'Preset1920x1080'
        tmp = dst + '.mov'
        sh(['avconvert', '--source', src, '--preset', preset, '--output', tmp, '--replace'])
        cfr(tmp, dst); os.remove(tmp)
        return True
    if hdr:
        if ' zscale ' not in sh(['ffmpeg', '-hide_banner', '-filters']).stdout:
            sys.exit('This clip is HDR (HLG/PQ) and no tone-mapper is available. Export it as SDR first '
                     '(Photos or QuickTime export, "Most Compatible"), then run prep again.')
        vf = ('zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=mobius:desat=0,'
              'zscale=t=bt709:m=bt709:r=tv,format=yuv420p')
        sh(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', vf, '-fps_mode', 'cfr', '-r', f'{info["fps"]:.6f}',
            '-c:v', 'libx264', '-crf', '12', '-c:a', 'aac', '-b:a', '256k', dst])
        return True
    cfr(src, dst)
    return False

def cfr(src, dst):
    """Copy when the stream is already constant frame rate, else re-encode at its nominal rate.
    Frame indices and audio times must agree, which variable frame rate footage breaks."""
    i = probe(src)
    if i['avg_fps'] and abs(i['avg_fps'] - i['fps']) / i['fps'] < 0.002:
        try:
            sh(['ffmpeg', '-v', 'error', '-y', '-i', src, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', dst]); return
        except subprocess.CalledProcessError:
            pass
    sh(['ffmpeg', '-v', 'error', '-y', '-i', src, '-map', '0:v:0', '-map', '0:a:0?', '-fps_mode', 'cfr', '-r', f'{i["fps"]:.6f}',
        '-c:v', 'libx264', '-crf', '12', '-preset', 'medium', '-c:a', 'aac', '-b:a', '256k', dst])

# ---------------------------------------------------------------- transcription
def _load16(path):
    import scipy.io.wavfile as wf
    sr, x = wf.read(path); x = x.astype(np.float32)
    if np.abs(x).max() > 2: x /= 32768.0
    return x.mean(1) if x.ndim > 1 else x

def _whisper(audio, language=None, context=True):
    """audio: a 16 kHz wav path or a float32 mono array. Returns [{w, s, e}]."""
    try:
        import mlx_whisper
        r = mlx_whisper.transcribe(audio, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', word_timestamps=True,
                                   language=language, condition_on_previous_text=context)
        return [dict(w=w['word'].strip(), s=float(w['start']), e=float(w['end'])) for s in r['segments'] for w in s.get('words', [])]
    except ImportError:
        pass
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit('No local Whisper found. Install one: pip install mlx-whisper (Apple Silicon) or pip install faster-whisper.')
    global _FW
    if '_FW' not in globals():
        _FW = WhisperModel('large-v3-turbo' if os.environ.get('WHISPER_BIG') else 'small', compute_type='int8')
    segs, _ = _FW.transcribe(audio, word_timestamps=True, language=language, condition_on_previous_text=context)
    return [dict(w=w.word.strip(), s=float(w.start), e=float(w.end)) for s in segs for w in (s.words or [])]

def voiced_regions(x, sr=16000, merge=0.35, pad=0.2):
    hop = int(sr * 0.01); n = len(x) // hop
    if n == 0: return []
    db = 20 * np.log10(np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1)) + 1e-9)
    thr = max(np.percentile(db, 10) + 18, np.percentile(db, 95) - 30, -58)
    v = db > thr; reg = []; i = 0
    while i < n:
        if v[i]:
            j = i
            while j < n and v[j]: j += 1
            if reg and (i - reg[-1][1]) * 0.01 < merge: reg[-1][1] = j
            else: reg.append([i, j])
            i = j
        else:
            i += 1
    return [(max(0.0, a * 0.01 - pad), min(n * 0.01, b * 0.01 + pad)) for a, b in reg if (b - a) * 0.01 >= 0.08]

def transcribe(wav16, language=None, quiet=False):
    """Whole-clip Whisper first. Whisper sometimes swallows repeated phrases (false starts, retakes)
    into one very long word; then every voiced phrase is transcribed on its own instead."""
    words = _whisper(wav16, language)
    x = _load16(wav16); regs = voiced_regions(x)
    long = [w for w in words if w['e'] - w['s'] > LONG_WORD]
    short = [w for w in words if w['e'] - w['s'] <= LONG_WORD]
    bare = [r for r in regs if r[1] - r[0] > 0.6 and not any(w['s'] < r[1] - 0.2 and w['e'] > r[0] + 0.2 for w in short)]
    if not (long or bare): return words
    out = []
    for a, b in regs:
        out += [dict(w=w['w'], s=round(w['s'] + a, 3), e=round(w['e'] + a, 3))
                for w in _whisper(x[int(a * 16000):int(b * 16000)], language, context=False)]
    if not quiet:
        why = f'a {long[0]["e"] - long[0]["s"]:.1f} s word "{long[0]["w"]}"' if long else f'speech with no words at {bare[0][0]:.2f} s'
        print(f'transcript: the whole-clip pass skipped speech ({why}); re-transcribed phrase by phrase: {len(words)} -> {len(out)} words')
    return out if len(out) >= len(words) else words

def envelope_db(x, sr, hop):
    n = len(x) // hop
    seg = x[: n * hop].reshape(n, hop)
    return 20 * np.log10(np.sqrt((seg ** 2).mean(1)) + 1e-9)

def norm_words(ws):
    return [t for t in (re.sub(r"[^\w']", '', w['w'].lower()) for w in ws) if t]

def parse_drop(spec):
    out = set()
    for part in (spec or '').replace(' ', '').split(','):
        if not part: continue
        a, _, b = part.partition('-')
        out.update(range(int(a), int(b or a) + 1))
    return out

def print_words(words, key='i'):
    line = ''
    for w in words:
        item = f'{w[key]}:{w["w"]}@{w["onset"]:.2f} '
        if len(line) + len(item) > 110: print('  ' + line.rstrip()); line = ''
        line += item
    if line: print('  ' + line.rstrip())

# ---------------------------------------------------------------- Apple Vision
def vision_tools(P):
    if not shutil.which('swiftc'):
        sys.exit('swiftc not found, so the Apple Vision tools cannot be built. Install the Xcode command line tools '
                 '(xcode-select --install), then rerun with --force.')
    tools = {}
    for t in ('vision_matte', 'vision_hands'):
        exe = os.path.join(P, '.bin', t); os.makedirs(os.path.dirname(exe), exist_ok=True)
        if not os.path.exists(exe): sh(['swiftc', '-O', os.path.join(HERE, t + '.swift'), '-o', exe])
        tools[t] = exe
    return tools

def run_vision(P, fdir, ranges, scratch, mdir, faces_path, hands_path=None):
    """Matte + face track (and hand track when hands_path is given) for frames fdir/NNNNN.jpg in ranges."""
    tools = vision_tools(P)
    jobs = []
    for f0, f1 in ranges:                                   # contiguous ranges, spread over 4 workers
        n = f1 - f0; step = max(1, math.ceil(n / 4))
        for a0 in range(f0, f1, step): jobs.append((a0, min(f1, a0 + step) - 1))
    shutil.rmtree(scratch, ignore_errors=True)               # this script's own scratch folder
    def run(j):
        a0, a1 = j; out = os.path.join(scratch, f'{a0:05d}')
        subprocess.run([tools['vision_matte'], fdir, out, str(a0), str(a1), 'person'], capture_output=True)
        if hands_path: subprocess.run([tools['vision_hands'], fdir, str(a0), str(a1), os.path.join(out, 'hands.jsonl')], capture_output=True)
    with ThreadPoolExecutor(4) as ex: list(ex.map(run, jobs))
    shutil.rmtree(mdir, ignore_errors=True); os.makedirs(mdir)   # no matte survives from an earlier run
    faces, hands = {}, []
    for j in sorted(os.listdir(scratch)):
        d = os.path.join(scratch, j)
        for f in os.listdir(os.path.join(d, 'person')):
            i = int(f.split('.')[0]); os.replace(os.path.join(d, 'person', f), os.path.join(mdir, f'{i:05d}.png'))
        with open(os.path.join(d, 'faces.jsonl'), encoding='utf-8') as fh:
            face_lines = fh.read().splitlines()
        for l in face_lines:
            r = json.loads(l); faces[r['i']] = r
        if os.path.exists(os.path.join(d, 'hands.jsonl')):
            with open(os.path.join(d, 'hands.jsonl'), encoding='utf-8') as fh:
                hands += fh.read().splitlines()
    save_json(faces, faces_path)
    if hands_path:
        with open(hands_path, 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(hands) + '\n')
    shutil.rmtree(scratch, ignore_errors=True)
    return len(os.listdir(mdir)), sum(1 for r in faces.values() if 'box' in r), sum(1 for h in hands if '"chir"' in h)

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('video', help='the raw clip (an iPhone .MOV is fine; HDR is converted)')
    ap.add_argument('--project', required=True, help='one folder per video; prep/ is written inside it')
    ap.add_argument('--transcript-only', action='store_true', help='transcribe and print the words with their indices, cut nothing')
    ap.add_argument('--drop', help='source word indices to cut out (false starts, retakes, flubs), e.g. 0-6,12')
    ap.add_argument('--language', help='Whisper language code (default: detected), e.g. en, fr, ja')
    ap.add_argument('--vertical', action='store_true', help='landscape source: make a 1080x1920 edit that follows the face')
    ap.add_argument('--pad-pre', type=float, default=0.04, help='seconds kept before each phrase onset')
    ap.add_argument('--pad-post', type=float, default=0.05, help='seconds kept after each phrase decays; raise it if VERIFY reports a clipped word')
    ap.add_argument('--gap', type=float, default=0.10, help='silence left between kept phrases')
    ap.add_argument('--max-pause', type=float, default=0.30, help='pauses shorter than this stay inside a phrase')
    ap.add_argument('--work-long', type=int, default=2560, help='long side of the working frames (never above the source)')
    ap.add_argument('--no-vision', action='store_true', help='skip the Apple Vision matte, face and hand tracks')
    ap.add_argument('--range', nargs=2, type=float, metavar=('START', 'END'),
                    help='keep one continuous range (seconds) instead of cutting pauses, e.g. to edit on top of a world edit')
    ap.add_argument('--retranscribe', action='store_true', help='ignore the saved transcript and run Whisper again')
    ap.add_argument('--force', action='store_true', help='redo an existing <project>/prep/ edit')
    a = ap.parse_args()
    for tool in ('ffmpeg', 'ffprobe'):
        if not shutil.which(tool): sys.exit(f'{tool} not found. Install ffmpeg (for example: brew install ffmpeg).')
    if not os.path.isfile(a.video): sys.exit(f'{a.video} not found.')
    P = os.path.abspath(a.project); prep = os.path.join(P, 'prep')
    if os.path.commonpath([os.path.realpath(a.video), os.path.realpath(prep)]) == os.path.realpath(prep):
        sys.exit(f'{a.video} is inside {prep}, which prep.py writes. Move the clip out of that folder first.')
    if os.path.exists(os.path.join(prep, 'edl.json')) and not (a.force or a.transcript_only):
        sys.exit(f'{prep} already holds a prepared clip. Use a new --project folder, or pass --force to redo it.')
    os.makedirs(prep, exist_ok=True)
    import scipy.io.wavfile as wf

    # source, SDR and transcript are reused when they belong to the same file (keeps word indices stable)
    st = os.stat(a.video)
    fp = dict(path=os.path.abspath(a.video), size=st.st_size, mtime=int(st.st_mtime))
    sj = os.path.join(prep, 'source.json'); sdr = os.path.join(prep, 'sdr.mp4')
    old = load_json(sj) if os.path.exists(sj) else {}
    same = old.get('fingerprint') == fp
    src_info = probe(a.video)
    if not src_info['audio']: sys.exit(f'{a.video} has no audio track; this pipeline cuts on speech.')
    if same and os.path.exists(sdr):
        was_hdr = old.get('hdr_converted', False)
    else:
        was_hdr = to_sdr(a.video, sdr, src_info)
    same_words = same and old.get('language') == a.language
    save_json(dict(fingerprint=fp, hdr_converted=was_hdr, language=a.language), sj, indent=1)
    info = probe(sdr)
    fps = info['fps']
    print(f"source {info['w']}x{info['h']} @ {fps:.3f} fps, {info['dur']:.2f} s, HDR converted: {was_hdr}")

    wav = os.path.join(prep, 'audio48k.wav'); wav16 = os.path.join(prep, 'audio16k.wav')
    sh(['ffmpeg', '-v', 'error', '-y', '-i', sdr, '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', wav])
    sh(['ffmpeg', '-v', 'error', '-y', '-i', sdr, '-vn', '-ar', '16000', '-ac', '1', wav16])
    sr, x = wf.read(wav); xm = x.mean(1).astype(np.float32)
    hop = int(sr * 0.005); db = envelope_db(xm, sr, hop); T = lambda i: i * hop / sr
    floor = np.percentile(db, 10); thr = max(floor + 24, np.percentile(db, 95) - 30, -58)   # voiced vs. room tone
    wpath = os.path.join(prep, 'words_src.json')
    if same_words and os.path.exists(wpath) and not a.retranscribe:
        words = load_json(wpath); print(f'transcript: reusing {wpath} ({len(words)} words)')
    else:
        words = transcribe(wav16, a.language)
        if not words: sys.exit('Whisper found no words in this clip.')
        # refine onsets. Whisper starts drift by up to ~0.35 s. After silence: the first sustained voiced
        # frame (3 x 5 ms above threshold). Inside running speech: the strongest spectral-flux onset nearby.
        from scipy.signal import stft as _stft
        f_, t_, Z = _stft(xm, sr, nperseg=1024, noverlap=1024 - hop)
        flux = np.maximum(0, np.diff(np.log1p(np.abs(Z) * 50), axis=1)).sum(0)
        voiced = db > thr
        sust = np.convolve(voiced.astype(int), np.ones(3, int), 'same') >= 3
        prev_end = 0.0; prev_on = -1.0
        for w in words:
            i_s = int(w['s'] / T(1))
            quiet_before = not voiced[max(0, i_s - 12):i_s].any()
            if quiet_before:
                i0, i1 = int(max(prev_end, w['s'] - 0.15) / T(1)), int(min(w['e'], w['s'] + 0.45) / T(1))
                on = next((T(i) for i in range(max(i0, 0), min(i1, len(sust))) if sust[i]), w['s'])
            else:
                i0, i1 = int(max(prev_end - 0.05, w['s'] - 0.08) / T(1)), int(min(w['e'], w['s'] + 0.14) / T(1))
                seg = flux[max(i0, 0):max(i0 + 1, min(i1, len(flux)))]
                on = T(max(i0, 0) + int(np.argmax(seg))) if len(seg) else w['s']
            w['onset'] = round(max(on, prev_end - 0.05, prev_on + 0.08), 3); prev_on = w['onset']
            prev_end = max(w['onset'] + 0.05, min(w['e'], w['onset'] + 0.6))
        for i, w in enumerate(words): w['i'] = i
        save_json(words, wpath, indent=0)
    print('words on the source clock (index:word@seconds); cut false starts and retakes with --drop:')
    print_words(words)
    if a.transcript_only:
        return

    drop = parse_drop(a.drop)
    if drop and max(drop) >= len(words): sys.exit(f'--drop names word {max(drop)}, but the transcript has {len(words)} words (0 to {len(words) - 1}).')
    kept = [i for i in range(len(words)) if i not in drop]
    if not kept: sys.exit('--drop removes every word.')

    # phrases: consecutive kept words stay together unless a pause of max-pause or more separates them,
    # measured on Whisper's word ends and on the audio itself (Whisper often stretches a word over a pause)
    silent = db <= thr
    def longest_silence(t0, t1):
        i0, i1 = max(0, int(t0 / T(1))), min(len(silent), int(t1 / T(1)))
        best, run0 = (0.0, 0.0), None
        for i in range(i0, i1 + 1):
            if i < i1 and silent[i]:
                if run0 is None: run0 = i
            elif run0 is not None:
                if T(i) - T(run0) > best[1] - best[0]: best = (T(run0), T(i))
                run0 = None
        return best
    phrases = []
    for i in kept:
        w = words[i]
        if phrases and phrases[-1][2][-1] == i - 1:
            q0, q1 = longest_silence(words[i - 1]['onset'] + 0.10, w['onset'] + 0.25)
            if q1 - q0 >= a.max_pause and q0 < w['onset']:
                phrases[-1][1] = q0; phrases.append([min(w['onset'], q1), w['e'], [i]]); continue
            if w['onset'] - phrases[-1][1] < a.max_pause:
                phrases[-1][1] = w['e']; phrases[-1][2].append(i); continue
        phrases.append([w['onset'], w['e'], [i]])
    keep = []
    for k, (s, e, idx) in enumerate(phrases):
        nxt = words[idx[-1] + 1]['onset'] if idx[-1] + 1 < len(words) else info['dur']   # next word, kept or dropped
        if k + 1 < len(phrases) and phrases[k + 1][2][0] == idx[-1] + 1: nxt = min(nxt, phrases[k + 1][0])
        # the tail: follow the decay until it reaches the floor (Whisper ends are unreliable)
        j = int(e / T(1)); lim = int((nxt - a.gap) / T(1))
        while j < min(lim, len(db) - 1) and db[j] > thr - 3: j += 1
        s0 = max(0.0, s - a.pad_pre); e0 = min(T(j) + a.pad_post, info['dur'])
        if idx[-1] + 1 < len(words): e0 = min(e0, nxt - a.pad_pre - a.gap / 2)
        if idx[0] - 1 in drop: s0 = max(s0, min(words[idx[0] - 1]['e'], s - 0.02))       # never reach back into a dropped word
        keep.append([int(math.floor(s0 * fps)), int(math.ceil(e0 * fps))])
    merged = []
    for r in keep:
        if merged and r[0] <= merged[-1][1]: merged[-1][1] = max(merged[-1][1], r[1])
        else: merged.append(r)
    keep = merged
    if a.range:
        keep = [[int(round(a.range[0] * fps)), int(round(a.range[1] * fps))]]

    # cut audio
    segs = []; fade = int(0.006 * sr)
    for f0, f1 in keep:
        seg = x[int(f0 / fps * sr): int(f1 / fps * sr)].astype(np.float32).copy()
        rr = np.linspace(0, 1, fade)[:, None]; seg[:fade] *= rr; seg[-fade:] *= rr[::-1]; segs.append(seg)
    cut = np.concatenate(segs); wf.write(os.path.join(prep, 'cut_audio.wav'), sr, cut)

    # map words to the output clock (dropped words, and words outside --range, leave the edit)
    mp, o = [], 0.0
    for f0, f1 in keep:
        mp.append(dict(src=[f0, f1], out=[o, o + (f1 - f0) / fps])); o += (f1 - f0) / fps
    def inside(t): return any(m['src'][0] / fps <= t <= m['src'][1] / fps for m in mp)
    def s2o(t):
        for m in mp:
            a0, a1 = m['src'][0] / fps, m['src'][1] / fps
            if a0 <= t <= a1: return m['out'][0] + t - a0
        for m in mp:
            if t < m['src'][0] / fps: return m['out'][0]
        return mp[-1]['out'][1]
    out_src = [i for i in (range(len(words)) if a.range else kept) if inside(words[i]['onset'])]
    out_words = [dict(w=words[i]['w'], s=round(s2o(words[i]['s']), 3), e=round(s2o(words[i]['e']), 3),
                      onset=round(s2o(words[i]['onset']), 3), i=n, src_i=i) for n, i in enumerate(out_src)]
    edl = dict(fps=fps, keep=keep, map=mp, duration=o, cuts=[m['out'][0] for m in mp] + [o], words=out_words,
               dropped=sorted(drop))
    save_json(edl, os.path.join(prep, 'edl.json'), indent=1)
    print(f'cut {info["dur"]:.2f} s -> {o:.2f} s in {len(keep)} pieces; cuts at ' + ', '.join(f'{c:.2f}' for c in edl['cuts'][1:-1]))

    # verify: re-transcribe the cut and compare with the words that should be in it
    sh(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(prep, 'cut_audio.wav'), '-ar', '16000', '-ac', '1', os.path.join(prep, 'cut16k.wav')])
    again = transcribe(os.path.join(prep, 'cut16k.wav'), a.language, quiet=True)
    A, B = norm_words([words[i] for i in out_src]), norm_words(again)
    if ''.join(A) == ''.join(B):
        print('VERIFY cut transcript matches the source word for word.')
    else:
        diff = [f'{op} {" ".join(A[i1:i2])!r} -> {" ".join(B[j1:j2])!r}' for op, i1, i2, j1, j2 in
                difflib.SequenceMatcher(a=A, b=B, autojunk=False).get_opcodes() if op != 'equal']
        print(f'VERIFY cut transcript DIFFERS: expected {len(A)} words, heard {len(B)}. ' + '; '.join(diff[:6]) +
              '. A missing word means a clipped cut (raise --pad-post or --max-pause); an extra word means a retake '
              'or false start is still in the cut (--drop it).')

    # frames at working resolution, only the kept ones (never upscaled)
    fdir = os.path.join(prep, 'frames'); shutil.rmtree(fdir, ignore_errors=True); os.makedirs(fdir)
    scale = min(1.0, a.work_long / max(info['w'], info['h']))
    ww, hh = int(round(info['w'] * scale / 2) * 2), int(round(info['h'] * scale / 2) * 2)
    sel = '+'.join(f'between(n\\,{f0}\\,{f1 - 1})' for f0, f1 in keep)
    tmp = os.path.join(prep, 'frames_tmp'); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    sh(['ffmpeg', '-v', 'error', '-y', '-i', sdr, '-vf',
        f"select='{sel}',scale={ww}:{hh}:flags=lanczos:in_color_matrix=bt709:out_color_matrix=bt601:in_range=tv:out_range=pc,format=yuvj444p",
        '-fps_mode', 'passthrough', '-q:v', '2', os.path.join(tmp, '%06d.jpg')])
    idx = [i for f0, f1 in keep for i in range(f0, f1)]
    got = sorted(os.listdir(tmp))
    if len(got) < len(idx): print(f'warning: {len(idx)} frames expected, {len(got)} extracted (the clip ends early)')
    for name, i in zip(got, idx): os.replace(os.path.join(tmp, name), os.path.join(fdir, f'{i:05d}.jpg'))
    shutil.rmtree(tmp, ignore_errors=True)

    portrait = hh >= ww
    out_w, out_h = (1080, 1920) if (portrait or a.vertical) else (1920, 1080)
    proj = dict(src_fps=fps, src_w=ww, src_h=hh, out_w=out_w, out_h=out_h, out_fps=24, duration=o,
                hdr_converted=was_hdr, vertical_crop=bool(a.vertical and not portrait))
    save_json(proj, os.path.join(prep, 'project.json'), indent=1)
    if proj['vertical_crop']:
        print(f'output 1080x1920: a vertical crop of the {ww}x{hh} working frames that follows the face '
              f'(about {hh / 1920:.2f} source px per output px; below 1.0 the picture is upscaled and softer)')

    if a.no_vision or sys.platform != 'darwin':
        print('Skipping Apple Vision (not macOS or --no-vision). Provide prep/matte/NNNNN.png and prep/faces.json another way.')
    else:
        n_m, n_f, n_h = run_vision(P, fdir, keep, os.path.join(prep, 'vision'), os.path.join(prep, 'matte'),
                                   os.path.join(prep, 'faces.json'), os.path.join(prep, 'hands.jsonl'))
        print(f'mattes {n_m}, faces {n_f}, frames with hands {n_h}')
        if n_f < 0.8 * len(idx):
            print(f'warning: a face was found in only {n_f} of {len(idx)} frames; the camera and the type behind the '
                  'head follow the face, so check stills where it is turned away or covered.')
    print('words in the edit (index:word@seconds on the output clock), the indices beats.json uses:')
    print_words(out_words)

if __name__ == '__main__':
    main()
