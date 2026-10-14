#!/usr/bin/env python3
"""The world edit: export the plain cut for Seedance on Scenario MCP, then bring its result back as a
second plate that film.py can switch to (beats.json "world").

usage: python world.py export --project <dir> [--short-side 1080] [--force]
       python world.py import <world_edit.mp4> --project <dir> [--rate R] [--force]

export   writes <dir>/upload/cut.mp4: the cut exactly as prep.py made it (kept frames + cut_audio.wav),
         no type, short side 1080 px, H.264 tagged BT.709, ready for upload_asset. Prints its length,
         size and frame shape; the model's schema says which lengths and sizes it accepts.
import   reads the edit Seedance returned and writes into <dir>/prep/:
           plate/NNNNN.jpg        every frame of the edit, scaled to the working size of prep/frames
           plate_matte/NNNNN.png  Apple Vision person matte for each frame
           plate_faces.json       face track of the edit
           plate.json             fps, frame count, rate (edit length / cut length), alignment
         The edit follows the cut's clock but can run slightly short or long; film.py maps output
         time t to edit frame round(t * rate * fps). If the speaker sits at a different scale or place
         in the edit than in the cut, a scale and offset measured on both face tracks puts them back,
         so the camera and the type behind the head stay locked when film.py switches plates.
"""
import argparse, json, os, shutil, subprocess, sys
try:
    import numpy as np
except ImportError:
    sys.exit('Missing Python packages. Run: pip install numpy scipy opencv-python-headless pillow')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prep as _prep


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def save_json(obj, path, **kw):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, **kw)

def need(path, hint):
    if not os.path.exists(path): sys.exit(f'{path} not found. {hint}')
    return path

def export(P, short, force):
    prep = os.path.join(P, 'prep')
    proj = load_json(need(os.path.join(prep, 'project.json'), 'Run prep.py first.'))
    edl = load_json(os.path.join(prep, 'edl.json'))
    out = os.path.join(P, 'upload', 'cut.mp4')
    if os.path.exists(out) and not force: sys.exit(f'{out} exists. Pass --force to replace it.')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    frames = os.path.join(prep, 'frames')
    names = sorted(f for f in os.listdir(frames) if f.endswith('.jpg'))
    seq = os.path.join(P, 'upload', 'seq'); shutil.rmtree(seq, ignore_errors=True); os.makedirs(seq)
    for k, n in enumerate(names): os.symlink(os.path.join(frames, n), os.path.join(seq, f'{k:06d}.jpg'))
    portrait = proj['src_h'] >= proj['src_w']
    scale = f'{short}:-2' if portrait else f'-2:{short}'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', f'{proj["src_fps"]:.6f}', '-i', os.path.join(seq, '%06d.jpg'),
                    '-i', os.path.join(prep, 'cut_audio.wav'),
                    '-vf', f'scale={scale}:flags=lanczos:in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p',
                    '-c:v', 'libx264', '-preset', 'slow', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k',
                    '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0',
                    '-c:a', 'aac', '-b:a', '128k', '-t', f'{edl["duration"]:.3f}', '-movflags', '+faststart', out], check=True)
    shutil.rmtree(seq, ignore_errors=True)
    i = _prep.probe(out)
    print(f'{out}\n  {i["w"]}x{i["h"]}, {i["dur"]:.2f} s, {os.path.getsize(out)} bytes '
          f'(upload_asset file_size). Check the length against the model schema before pricing.')

def eyes(rec, w, h):
    if not rec or 'box' not in rec or not rec.get('leye') or not rec.get('reye'): return None
    le = np.array(rec['leye'][0]) * [w, h]; re_ = np.array(rec['reye'][0]) * [w, h]
    return (le + re_) / 2, float(np.linalg.norm(re_ - le))

def do_import(P, video, rate, force):
    prep = os.path.join(P, 'prep')
    proj = load_json(need(os.path.join(prep, 'project.json'), 'Run prep.py first.'))
    edl = load_json(os.path.join(prep, 'edl.json'))
    need(video, 'Download the world edit first (asset_download, then curl -L -o).')
    if os.path.exists(os.path.join(prep, 'plate.json')) and not force:
        sys.exit(f'{os.path.join(prep, "plate.json")} exists. Pass --force to replace the plate.')
    SW, SH = proj['src_w'], proj['src_h']
    info = _prep.probe(video)
    if abs(info['w'] / info['h'] - SW / SH) > 0.01 * SW / SH:
        print(f'warning: the edit is {info["w"]}x{info["h"]} and the cut is {SW}x{SH}; the shapes differ, so the plate is stretched to fit.')
    pdir = os.path.join(prep, 'plate'); shutil.rmtree(pdir, ignore_errors=True); os.makedirs(pdir)
    tmp = os.path.join(prep, 'plate_tmp'); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf',
                    f'scale={SW}:{SH}:flags=lanczos:in_color_matrix=bt709:out_color_matrix=bt601:in_range=tv:out_range=pc,format=yuvj444p',
                    '-fps_mode', 'passthrough', '-q:v', '2', os.path.join(tmp, '%06d.jpg')], check=True)
    got = sorted(os.listdir(tmp))
    for k, n in enumerate(got): os.replace(os.path.join(tmp, n), os.path.join(pdir, f'{k:05d}.jpg'))
    shutil.rmtree(tmp, ignore_errors=True)
    n = len(got); fps = info['fps']
    measured = (n / fps) / edl['duration']
    r = rate or measured
    print(f'edit: {n} frames at {fps:.3f} fps = {n / fps:.3f} s; cut: {edl["duration"]:.3f} s; rate {r:.4f}'
          + ('' if rate is None else f' (given; measured {measured:.4f})'))
    if abs(measured - 1) > 0.05:
        print('warning: the edit and the cut differ by more than 5 % in length; check that this is the edit of this cut.')
    if sys.platform != 'darwin':
        sys.exit('The plate matte needs Apple Vision (macOS). Provide prep/plate_matte/NNNNN.png another way.')
    nm, nf, _ = _prep.run_vision(P, pdir, [(0, n)], os.path.join(prep, 'vision_plate'), os.path.join(prep, 'plate_matte'),
                                 os.path.join(prep, 'plate_faces.json'))
    print(f'plate mattes {nm}, faces {nf}')

    # alignment: the same moments in the cut and in the edit, compared by their face tracks
    faces = {int(k): v for k, v in load_json(os.path.join(prep, 'faces.json')).items()} \
        if os.path.exists(os.path.join(prep, 'faces.json')) else {}
    pfaces = {int(k): v for k, v in load_json(os.path.join(prep, 'plate_faces.json')).items()}
    pairs = []
    for t in np.arange(0, edl['duration'], 1 / 24):
        i = next((min(m['src'][1] - 1, m['src'][0] + int((t - m['out'][0]) * edl['fps'] + 1e-6))
                  for m in edl['map'] if m['out'][0] <= t < m['out'][1]), None)
        k = min(n - 1, int(round(t * r * fps)))
        a, b = eyes(faces.get(i), SW, SH), eyes(pfaces.get(k), SW, SH)
        if a and b: pairs.append((a, b))
    align = dict(scale=1.0, dx=0.0, dy=0.0)
    if len(pairs) >= 8:
        sc = float(np.median([a[1] / b[1] for a, b in pairs]))
        d = np.median([a[0] - sc * b[0] for a, b in pairs], axis=0)
        iod = float(np.median([a[1] for a, b in pairs]))
        off = float(np.hypot(*(np.median([a[0] - b[0] for a, b in pairs], axis=0))))
        print(f'face match on {len(pairs)} moments: the edit is scaled {sc:.3f} and offset {off:.1f} px ({off / iod:.2f} eye spacings)')
        if abs(sc - 1) > 0.01 or off > 0.05 * iod:
            align = dict(scale=round(sc, 4), dx=round(float(d[0]), 2), dy=round(float(d[1]), 2))
            print(f'  aligning the plate to the cut: scale {align["scale"]}, offset ({align["dx"]}, {align["dy"]}) px')
    else:
        print(f'warning: only {len(pairs)} moments with a face in both; the plate is not aligned.')
    save_json(dict(video=os.path.abspath(video), fps=fps, frames=n, w=SW, h=SH, rate=round(r, 6), align=align), os.path.join(prep, 'plate.json'), indent=1)
    print(os.path.join(prep, 'plate.json'))

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('command', choices=['export', 'import'])
    ap.add_argument('video', nargs='?', help='import only: the world edit downloaded from Scenario')
    ap.add_argument('--project', required=True, help='the folder prep.py wrote')
    ap.add_argument('--short-side', type=int, default=1080, help='export only: short side in px (edit mode rejects small inputs)')
    ap.add_argument('--rate', type=float, help='import only: edit length / cut length, if you measured it another way')
    ap.add_argument('--force', action='store_true', help='replace an earlier export or plate')
    a = ap.parse_args()
    P = os.path.abspath(os.path.expanduser(a.project))
    if a.command == 'export': export(P, a.short_side, a.force)
    else:
        if not a.video: ap.error('import needs the world edit video')
        do_import(P, a.video, a.rate, a.force)

if __name__ == '__main__':
    main()
