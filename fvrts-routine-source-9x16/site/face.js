// The hero reveal: a girl with two braids and freckles (a nod to the brand's campaign look), glowing skin.
// Local px around the face centre; the caller sets D. LENS = the cheek point the macro wall zooms out to.
import { D, G, line, fill, withClip, ell, arcPts, mirror, lerp, clamp, hash, hs, TAU, mix, INK, star4 } from './core.js';

export const FC = {
  skin: '#FBE0D2', skinSh: '#F0BFAE', blush: '#F494AC', freckle: '#D28C78',
  hair: '#2E2226', hairSh: '#4B3A41', hairHi: '#6F5864',
  shirt: '#97DDBD', shirtSh: '#5DBF9C', mouth: '#5B1F33', tongue: '#F27D9C',
};
export const LENS = [150, 52];

const HAIR_BACK = [[0, -356], [150, -338], [262, -266], [320, -152], [334, -20], [324, 104], [300, 196], [250, 246], [-250, 246], [-300, 196], [-324, 104], [-334, -20], [-320, -152], [-262, -266], [-150, -338]];
const FACE = [[0, -272], [118, -262], [204, -220], [246, -144], [260, -52], [255, 40], [235, 120], [199, 190], [143, 244], [73, 277], [0, 287], [-73, 277], [-143, 244], [-199, 190], [-235, 120], [-255, 40], [-260, -52], [-246, -144], [-204, -220], [-118, -262]];
const CHIN_SH = [[-80, 238], [0, 262], [80, 238], [86, 300], [0, 318], [-86, 300]];
const NECK = [[-76, 220], [76, 220], [86, 440], [-86, 440]];
const SHIRT = [[-600, 600], [-460, 488], [-280, 436], [-120, 418], [120, 418], [280, 436], [460, 488], [600, 600], [600, 1400], [-600, 1400]];
const NECKLINE = [[-122, 416], [-82, 480], [0, 506], [82, 480], [122, 416]];
// hair curtains from the centre part (screen-left one; the right is mirrored with a variation)
const CURTAIN_L = [[-4, -322], [-70, -330], [-158, -306], [-236, -248], [-286, -160], [-306, -52], [-300, 64], [-274, 150], [-262, 96], [-254, 10], [-240, -78], [-212, -150], [-160, -212], [-92, -252], [-30, -276]];
const CURTAIN_R = mirror(CURTAIN_L).map(([x, y], i) => [x + hs(i, 91) * 4, y + hs(i, 92) * 4]);

function braid(side, swing, sd) {
  // a chain of tapering loops hanging from behind the ear; swing bends it more toward the tip
  const segs = 6, seg = 80, P = [[side * 262, 150]];
  for (let i = 0; i < segs; i++) {
    const th = swing * Math.pow((i + 1) / segs, 1.3) + side * 0.06;
    const [x, y] = P[i];
    P.push([x + Math.sin(th) * seg, y + Math.cos(th) * seg]);
  }
  for (let i = 0; i < segs; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[i + 1], cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const k = 1 - i * 0.07, rx = 50 * k, ry = 52 * k, rot = (i % 2 ? 0.32 : -0.32) * side + Math.atan2(x1 - x0, y1 - y0) * -1;
    D.push(); D.t(cx, cy).r(rot);
    const E2 = ell(0, 0, rx, ry, 12);
    fill(E2, { col: FC.hair, seed: sd + i * 3, off: [3, -2], grain: 0.4 });
    withClip(E2, { seed: sd + i * 3, off: [3, -2] }, () => fill(ell(rx * 0.35 * side, ry * 0.25, rx * 0.8, ry * 0.75, 10), { col: FC.hairSh, seed: sd + i * 3 + 1, alpha: 0.8, grain: 0.3 }));
    line(arcPts(0, 0, rx * 0.62, ry * 0.6, Math.PI * 1.1, Math.PI * 1.7, 5), { w: 3.4, seed: sd + i * 3 + 2, col: FC.hairHi, taper: [0.3, 0.3] });
    line(E2, { w: 5, seed: sd + 40 + i, closed: true, taper: [0, 0] });
    D.pop();
  }
  // scrunchie + tuft
  const [ex, ey] = P[segs];
  D.push(); D.t(ex, ey + 10).r(-swing * 0.8);
  const tuft = [[-26, 4], [26, 4], [18, 60], [6, 92], [0, 70], [-8, 96], [-20, 58]];
  fill(tuft, { col: FC.hair, seed: sd + 60, off: [3, -2] });
  line(tuft, { w: 5, seed: sd + 61, closed: true, taper: [0, 0] });
  const scr = ell(0, 0, 36, 20, 12);
  fill(scr, { col: FC.shirt, seed: sd + 62, off: [3, -2] });
  withClip(scr, { seed: sd + 62, off: [3, -2] }, () => fill(ell(12, 8, 30, 16, 10), { col: FC.shirtSh, seed: sd + 63, alpha: 0.9 }));
  line(scr, { w: 5, seed: sd + 64, closed: true, taper: [0, 0] });
  line([[-14, -8], [-4, -12]], { w: 3, seed: sd + 65, col: '#FFFFFF', amp: 0.5 });
  D.pop();
}

// p = {eyes:'open'|'wink'|'happy', mouth:'open'|'smile', blush, glow (0..1 dewy shine), look:[x,y], tilt, swing, sparkle(t)}
export function girl(p) {
  const sd = 9000;
  D.push();
  // body (does not tilt)
  fill(SHIRT, { col: FC.shirt, seed: sd + 1, off: [6, -4] });
  withClip(SHIRT, { seed: sd + 1, off: [6, -4] }, () => {
    fill([[160, 380], [700, 380], [700, 1500], [160, 1500]], { col: FC.shirtSh, seed: sd + 2, sharp: true, alpha: 0.8 });
  });
  fill(NECK, { col: FC.skin, seed: sd + 3, off: [4, -3] });
  fill(NECKLINE, { col: FC.skin, seed: sd + 4, off: [4, -3] });
  withClip(NECK, { seed: sd + 3, off: [4, -3] }, () => fill(ell(0, 236, 110, 70, 16), { col: FC.skinSh, seed: sd + 5, alpha: 0.85 }));
  line(NECKLINE, { w: 6, seed: sd + 6 });
  line([[-600, 600], [-460, 488], [-280, 436], [-122, 416]], { w: 6.5, seed: sd + 7, taper: [0.1, 0.1] });
  line([[600, 600], [460, 488], [280, 436], [122, 416]], { w: 6.5, seed: sd + 8, taper: [0.1, 0.1] });
  line([[-76, 236], [-82, 330], [-86, 418]], { w: 6, seed: sd + 9 });
  line([[76, 236], [82, 330], [86, 418]], { w: 6, seed: sd + 10 });
  // head group pivots at the neck base
  D.t(0, 420).r(p.tilt || 0).t(0, -420);
  fill(HAIR_BACK, { col: FC.hair, seed: sd + 11, off: [5, -4] });
  line(HAIR_BACK, { w: 6.5, seed: sd + 12, closed: true, taper: [0, 0] });
  // face
  fill(FACE, { col: FC.skin, seed: sd + 13, off: [5, -4] });
  withClip(FACE, { seed: sd + 13, off: [5, -4] }, () => {
    fill(ell(330, 40, 120, 320, 18), { col: FC.skinSh, seed: sd + 14, alpha: 0.6 });
    fill(ell(0, -300, 250, 64, 18), { col: FC.skinSh, seed: sd + 18, alpha: 0.4 });
    fill(CHIN_SH, { col: FC.skinSh, seed: sd + 15, alpha: 0.6 });
    // blush + freckles
    [-1, 1].forEach(s => fill(ell(s * 156, 112, 58, 32, 14), { col: FC.blush, seed: sd + 16 + s, alpha: 0.55 + 0.3 * (p.blush ?? 1), grain: 0.3 }));
    [[-1, 0], [1, 0]].forEach(([s]) => {
      [[118, 70], [140, 86], [164, 72], [186, 90], [150, 102], [128, 98], [176, 104]].forEach(([x, y], i) => fill(ell(s * x, y, 3.6, 3.2, 6), { col: FC.freckle, seed: sd + 20 + i + (s > 0 ? 10 : 0), grain: 0, amp: 0.5, alpha: 0.85 }));
    });
  });
  line(FACE, { w: 6.5, seed: sd + 17, closed: true, taper: [0, 0] });
  // eyes
  const L = p.look || [0, 0];
  const eye = (s, kind) => {
    const x = s * 100 + L[0] * 6, y = 6 + L[1] * 4;
    if (kind === 'open') {
      fill(ell(x, y, 25, 31, 14), { col: INK, seed: sd + 30 + s, grain: 0, amp: 1 });
      fill(ell(x - 7, y - 11, 8.5, 9.5, 10), { col: '#FFFFFF', seed: sd + 32 + s, grain: 0, amp: 0.5 });
      fill(ell(x + 8, y + 10, 4, 4, 8), { col: '#FFFFFF', seed: sd + 34 + s, grain: 0, amp: 0.4 });
      line(arcPts(x, y + 2, 32, 34, Math.PI * 1.1, Math.PI * 1.9, 8), { w: 7, seed: sd + 36 + s, taper: [0.3, 0.1] });
      const ox = x + s * 30, oy = y - 16;
      line([[ox, oy], [ox + s * 14, oy - 10]], { w: 4.5, seed: sd + 38 + s, taper: [0.1, 0.6] });
      line([[ox - s * 4, oy - 8], [ox + s * 6, oy - 20]], { w: 4, seed: sd + 40 + s, taper: [0.1, 0.6] });
    } else {
      // closed: happy arch (^) — the wink and the smile-closed eyes
      line([[x - 28, y + 6], [x - 10, y - 12], [x + 10, y - 12], [x + 28, y + 6]], { w: 7, seed: sd + 36 + s, taper: [0.25, 0.25] });
      line([[x + s * 26, y + 2], [x + s * 40, y - 6]], { w: 4.5, seed: sd + 38 + s, taper: [0.1, 0.6] });
    }
  };
  eye(-1, p.eyes === 'happy' ? 'closed' : 'open');
  eye(1, p.eyes === 'open' ? 'open' : 'closed');
  // brows
  const by = p.eyes === 'wink' ? 4 : 0;
  line([[-140, -58], [-104, -74], [-64, -66]], { w: 7, seed: sd + 44, taper: [0.3, 0.3] });
  line([[140, -58 + by], [104, -74 + by * 2], [64, -66 + by]], { w: 7, seed: sd + 45, taper: [0.3, 0.3] });
  // nose
  line([[-2, 60], [-12, 84], [4, 92]], { w: 5, seed: sd + 46, taper: [0.2, 0.3] });
  // mouth
  if (p.mouth === 'open') {
    const M = [[-62, 140], [-30, 146], [30, 146], [62, 140], [48, 172], [22, 194], [0, 198], [-22, 194], [-48, 172]];
    fill(M, { col: FC.mouth, seed: sd + 50, grain: 0, off: [2, -1] });
    withClip(M, { seed: sd + 50, off: [2, -1] }, () => {
      fill(ell(0, 196, 40, 22, 12), { col: FC.tongue, seed: sd + 51, grain: 0 });
      fill([[-70, 130], [70, 130], [64, 156], [-64, 156]], { col: '#FFFFFF', seed: sd + 52, grain: 0, sharp: true });
    });
    line(M, { w: 6, seed: sd + 53, closed: true, taper: [0, 0] });
  } else {
    line([[-56, 148], [-28, 166], [0, 172], [28, 166], [56, 148]], { w: 6.5, seed: sd + 50, taper: [0.25, 0.25] });
  }
  // dewy glass-skin highlights
  const g = clamp(p.glow ?? 0);
  if (g > 0.01) {
    [-1, 1].forEach(s => {
      line(arcPts(s * 150, 84, 58, 30, Math.PI * (s > 0 ? 1.18 : 1.18), Math.PI * (s > 0 ? 1.62 : 1.62), 6).map(([x, y]) => [s > 0 ? x : x, y]), { w: 11 * g, seed: sd + 60 + s, col: '#FFFFFF', taper: [0.45, 0.45] });
      fill(ell(s * 120 - 4, 60, 6 * g, 6 * g, 8), { col: '#FFFFFF', seed: sd + 62 + s, grain: 0, amp: 0.4 });
    });
    line([[-30, -170], [0, -182], [30, -176]], { w: 9 * g, seed: sd + 64, col: '#FFFFFF', taper: [0.45, 0.45], alpha: 0.9 });
    fill(ell(-6, 78, 6 * g, 5 * g, 8), { col: '#FFFFFF', seed: sd + 65, grain: 0, amp: 0.3 });
  }
  // hair curtains over the face edge
  [CURTAIN_L, CURTAIN_R].forEach((C, i) => {
    fill(C, { col: FC.hair, seed: sd + 70 + i * 4, off: [4, -3] });
    withClip(C, { seed: sd + 70 + i * 4, off: [4, -3] }, () => {
      const s = i ? 1 : -1;
      line([[s * 40, -300], [s * 150, -270], [s * 230, -200], [s * 270, -110]], { w: 6, seed: sd + 71 + i * 4, col: FC.hairHi, taper: [0.4, 0.4] });
      line([[s * 90, -300], [s * 190, -246], [s * 250, -160]], { w: 4, seed: sd + 72 + i * 4, col: FC.hairSh, taper: [0.4, 0.4] });
    });
    line(C, { w: 6.5, seed: sd + 73 + i * 4, closed: true, taper: [0, 0] });
  });
  // braids (follow-through swing)
  braid(-1, p.swingL ?? 0, sd + 100);
  braid(1, p.swingR ?? 0, sd + 200);
  D.pop();
}
