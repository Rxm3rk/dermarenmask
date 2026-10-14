"""The product image for the badge: the real Su Boon Jo bottle, cut out of the supplied footage.

  python product.py crop     source/original.mp4 frame 336 -> assets/bottle_frame336_crop.png  (upload this to Scenario)
  python product.py finish   assets/bottle_cutout_photoroom.png (Scenario output) -> assets/bottle_upright.png

The cutout itself runs on Scenario (Photoroom Background Removal, 3 CU): the product is never generated,
so the label and the fvrts wordmark are the real pixels. `finish` stands the bottle upright along its
principal axis and lifts the levels a little (the bed shot is underexposed against the brand colours)."""
import subprocess, sys
import cv2, numpy as np

SRC, FRAME, CROP = 'source/original.mp4', 336, (40, 330, 480, 800)   # sharpest unoccluded packshot; x0, y0, x1, y1


def crop():
    w, h = 480, 854
    vf = f"select=eq(n\\,{FRAME}),scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=bgr24"
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', SRC, '-vf', vf,
                          '-frames:v', '1', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    im = np.frombuffer(raw, np.uint8).reshape(h, w, 3)
    x0, y0, x1, y1 = CROP
    cv2.imwrite('assets/bottle_frame336_crop.png', im[y0:y1, x0:x1])
    print('wrote assets/bottle_frame336_crop.png')


def finish(path):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED).astype(np.float32)
    ys, xs = np.nonzero(im[..., 3] > 127)
    c = np.array([xs.mean(), ys.mean()])
    ev, evec = np.linalg.eigh(np.cov(np.stack([xs - c[0], ys - c[1]])))
    v = evec[:, np.argmax(ev)]
    if v[0] < 0: v = -v                                   # point at the cap (upper right in the shot)
    rot = np.degrees(np.arctan2(v[1], v[0])) + 90         # cap direction -> straight up
    pad = 200
    big = cv2.copyMakeBorder(im, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    big[..., :3] *= big[..., 3:4] / 255                   # rotate premultiplied: no dark fringe
    M = cv2.getRotationMatrix2D((c[0] + pad, c[1] + pad), rot, 1.0)
    r = cv2.warpAffine(big, M, big.shape[1::-1], flags=cv2.INTER_LANCZOS4, borderValue=0)
    r = np.clip(r, 0, 255); a = r[..., 3:4]
    r[..., :3] = np.where(a > 0.5, r[..., :3] * 255 / np.maximum(a, 1e-3), 0)
    ys, xs = np.nonzero(r[..., 3] > 8)
    r = r[ys.min() - 2:ys.max() + 3, xs.min() - 2:xs.max() + 3]
    r[..., :3] = np.clip((r[..., :3] / 255 - 0.03) / (0.89 - 0.03), 0, 1) ** (1 / 1.12) * 255   # levels: black 3 %, white 89 %, gamma 1.12
    cv2.imwrite('assets/bottle_upright.png', np.clip(r, 0, 255).astype(np.uint8))
    print(f'rotated {rot:.1f} deg, wrote assets/bottle_upright.png {r.shape[1]}x{r.shape[0]}')


if __name__ == '__main__':
    {'crop': crop, 'finish': lambda: finish(sys.argv[2])}[sys.argv[1]]()
