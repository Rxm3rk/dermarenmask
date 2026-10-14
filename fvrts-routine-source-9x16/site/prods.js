// The three fvrts products as cel drawings (proportions measured from the real packshots):
//   Mae Il Cream Toner (160 ml) — milky rounded bottle, pink wrap label, mint screw cap
//   Su Boon Jo Serum (30 ml)   — squat milky bottle, pink label, mint pump
//   Mae Kkeun Cream (50 ml)    — pink tube standing on its mint cap
// Local px, origin = bottom centre, y up is negative. The caller sets the D transform.
import { D, G, line, fill, withClip, rrect, ell, arcPts, mirror, lerp, clamp, hs, TAU, drawLettering, INK, mix } from './core.js';

export const PC = {
  milk: '#FFFAF6', milkSh: '#ECDCDE', glass: '#D8C9D1',
  label: '#F9C4D1', labelSh: '#EFA5BA',
  mint: '#97DDBD', mintSh: '#5DBF9C', mintHi: '#D6F4E7',
  tube: '#F9C4D1', tubeSh: '#EEA2B8',
};

// ---------------- logo (traced client wordmark) ----------------
let LOGO = null;
export const setLogo = l => { LOGO = l; };
// draw the fvrts wordmark centred at (0,0) with height h (glyph bbox), rotation handled by caller
export function logo(h, o = {}) {
  if (!LOGO) return;
  const k = h / LOGO.h;
  D.push(); D.s(k);
  LOGO.paths.forEach((p, i) => {
    if (o.trim !== undefined) {
      const t = clamp(o.trim * 1.25 - i * 0.06);
      if (t <= 0) return;
      if (o.fillA !== undefined && o.fillA > 0) fill(p.pts, { col: o.col || INK, seed: (o.seed ?? 50) + i, amp: o.amp ?? 1.2, lam: 40, grain: 0, alpha: o.fillA, off: o.off || [0, 0] });
      line(p.pts, { w: (o.w ?? 5) / k, seed: (o.seed ?? 50) + 10 + i, closed: true, trim: [0, t], taper: [0.02, 0.02], amp: o.amp ?? 1.2, lam: 40, col: o.lc || o.col || INK });
    } else {
      fill(p.pts, { col: o.col || INK, seed: (o.seed ?? 50) + i, amp: o.amp ?? 1.2, lam: 40, grain: o.grain ?? 0, off: o.off || [0, 0] });
    }
  });
  D.pop();
}
export const logoAspect = () => LOGO ? LOGO.w / LOGO.h : 3.04;

// ---------------- label text (pre-rendered at 2x for crisp scaling) ----------------
const RES = 2;
let T = null;
export function initLabels(L) {
  // L(text, weight, size, col, opts) → lettering. Inter, left-to-right, low boil (small type)
  const lt = (s, w, size) => L(s, w, size * RES, INK, { dir: 'ltr', fam: 'Inter', amp: 1.0, lam: 26, amp2: 0.3, jit: 0 });
  T = {
    tSub: lt('moisturizing · treatment', 500, 10.5), tN1: lt('Mae Il', 700, 27), tN2: lt('Cream Toner', 700, 27),
    sSub: lt('moisturizing', 500, 10), sN1: lt('Su Boon Jo', 700, 20.5), sN2: lt('Serum', 700, 20.5),
    cSub: lt('moisturizing · firming', 500, 10.5), cN1: lt('Mae Kkeun', 700, 27), cN2: lt('Cream', 700, 27),
    tVol: lt('160ml | 5.4 fl. oz.', 500, 9), sVol: lt('30ml | 1.0 fl. oz.', 500, 9), cVol: lt('50ml | 1.6 fl. oz.', 500, 9),
  };
}
function txt(Lt, x, y) {   // left-aligned at (x, baseline y)
  D.push(); D.t(x, y).s(1 / RES);
  drawLettering(Lt, Lt.width / 2, 0, () => ({ p: 1 }));
  D.pop();
}
function greek(x, y, ws, seed, gap = 9) {   // tiny body copy suggested by short ink dashes
  ws.forEach((w, i) => line([[x, y + i * gap], [x + w, y + i * gap]], { w: 2.4, seed: seed + i, taper: [0.2, 0.2], amp: 0.5, alpha: 0.75 }));
}

// ---------------- shared bits ----------------
const SW = 6.5;   // silhouette line weight
function highlight(pts, w, seed, a = 0.9) { line(pts, { w, seed, col: '#FFFFFF', taper: [0.35, 0.5], amp: 1.2, alpha: a }); }

// ================= TONER =================
const TONER_BODY = (() => {
  const P = [];
  P.push(...arcPts(-81, -34, 34, 34, Math.PI / 2, Math.PI, 4));          // bottom-left corner
  P.push([-115, -150], [-115, -270], [-115, -395], [-112, -418], [-100, -436], [-80, -446], [-58, -451]);
  const R = P.map(([x, y]) => [-x, y]).reverse();
  return [...P, [-58, -458], [58, -458], ...R];
})();
const TONER_LABEL = rrect(-101, -385, 113, -61, 7, 2);
const TONER_CAP = rrect(-61, -562, 61, -446, [14, 14, 6, 6], 3);
export const TONER_NECK = [0, -452];
export const TONER_H = 562;
// o: {cap: null | {x,y,r} (local offset of the cap), open, wet, seed}
export function toner(o = {}) {
  const sd = o.seed ?? 3000;
  // body
  fill(TONER_BODY, { col: PC.milk, seed: sd, off: [5, -4] });
  withClip(TONER_BODY, { seed: sd, off: [5, -4] }, () => {
    fill([[52, 40], [52, -470], [160, -470], [160, 40]], { col: PC.milkSh, seed: sd + 1, sharp: true, amp: 1.5, grain: 0.5 });
    fill([[-140, -22], [140, -22], [140, 40], [-140, 40]], { col: PC.milkSh, seed: sd + 2, sharp: true, amp: 1.2, grain: 0.4, alpha: 0.8 });
  });
  line([[-103, -60], [-104, -200], [-102, -380]], { w: 2.4, seed: sd + 3, col: PC.glass, taper: [0.3, 0.3], amp: 0.8 });   // glass wall
  // label
  fill(TONER_LABEL, { col: PC.label, seed: sd + 4, off: [4, -3] });
  withClip(TONER_LABEL, { seed: sd + 4, off: [4, -3] }, () => {
    fill([[84, -400], [140, -400], [140, -40], [84, -40]], { col: PC.labelSh, seed: sd + 5, sharp: true, amp: 1.2, grain: 0.5, alpha: 0.6 });
  });
  line(TONER_LABEL, { w: 2.6, seed: sd + 6, closed: true, taper: [0, 0], amp: 1, alpha: 0.85 });
  txt(T.tSub, -88, -356);
  txt(T.tN1, -88, -318); txt(T.tN2, -88, -288);
  line([[-88, -276], [20, -277]], { w: 2.2, seed: sd + 7, taper: [0, 0], amp: 0.5 });
  greek(-88, -262, [74, 66, 80, 58], sd + 8);
  txt(T.tVol, -88, -76);
  D.push(); D.t(76, -205).r(-Math.PI / 2); logo(52, { seed: sd + 20, amp: 0.9 }); D.pop();
  // highlight
  highlight([[-96, -70], [-98, -210], [-96, -330]], 10, sd + 9);
  highlight([[-86, -424], [-70, -436], [-48, -442]], 6, sd + 10, 0.8);
  // silhouette
  line(TONER_BODY, { w: SW, seed: sd + 11, closed: true, taper: [0, 0] });
  // neck opening when the cap is off
  if (o.cap) {
    fill(ell(0, -458, 52, 11, 12), { col: '#F3E7EA', seed: sd + 12, grain: 0 });
    line(ell(0, -458, 52, 11, 12), { w: 4.5, seed: sd + 13, closed: true, taper: [0, 0] });
    fill(ell(0, -458, 34, 6, 10), { col: PC.milk, seed: sd + 14, grain: 0 });
  }
  // cap (o.noCap: drawn separately by the caller while it flies)
  if (!o.noCap) {
    D.push();
    if (o.cap) D.t(o.cap.x, o.cap.y).t(0, -504).r(o.cap.r || 0).t(0, 504);
    cap(TONER_CAP, sd + 15, o.twist || 0);
    D.pop();
  }
}
// the toner cap alone, centred on its own middle (0,0)
export function tonerCap(twist = 0) { D.push(); D.t(0, 504); cap(TONER_CAP, 3015, twist); D.pop(); }
function cap(P, sd, twist = 0) {
  fill(P, { col: PC.mint, seed: sd, off: [4, -3] });
  const [x0, x1] = [P.reduce((a, p) => Math.min(a, p[0]), 1e9), P.reduce((a, p) => Math.max(a, p[0]), -1e9)];
  const [y0, y1] = [P.reduce((a, p) => Math.min(a, p[1]), 1e9), P.reduce((a, p) => Math.max(a, p[1]), -1e9)];
  const w = x1 - x0;
  withClip(P, { seed: sd, off: [4, -3] }, () => {
    fill([[x0 + w * 0.68, y0 - 10], [x1 + 20, y0 - 10], [x1 + 20, y1 + 10], [x0 + w * 0.68, y1 + 10]], { col: PC.mintSh, seed: sd + 1, sharp: true, amp: 1.2, grain: 0.5 });
  });
  // grip ridges that slide sideways while the cap twists (reads as rotation)
  for (let i = 0; i < 5; i++) {
    const u = ((i / 5 + twist) % 1 + 1) % 1, x = x0 + w * (0.1 + 0.8 * (0.5 - 0.5 * Math.cos(u * Math.PI)));
    if (u > 0.02 && u < 0.98) line([[x, y0 + 14], [x, y1 - 10]], { w: 2.2, seed: sd + 10 + i, alpha: 0.35 * Math.sin(u * Math.PI), taper: [0.2, 0.2], amp: 0.6 });
  }
  highlight([[x0 + w * 0.17, y1 - 14], [x0 + w * 0.15, y0 + 18]], 8, sd + 2, 0.85);
  line(P, { w: SW * 0.9, seed: sd + 3, closed: true, taper: [0, 0] });
}

// ================= SERUM =================
const SERUM_BODY = (() => {
  const P = [];
  P.push(...arcPts(-64, -36, 36, 36, Math.PI / 2, Math.PI, 4));
  P.push([-100, -120], [-100, -220], [-100, -305], [-97, -322], [-86, -334], [-66, -341], [-50, -344]);
  const R = P.map(([x, y]) => [-x, y]).reverse();
  return [...P, [-50, -352], [50, -352], ...R];
})();
const SERUM_LABEL = rrect(-86, -265, 94, -45, 7, 2);
const SERUM_COLLAR = rrect(-58, -396, 58, -348, [10, 10, 5, 5], 3);
export const SERUM_H = 482;
// pump press p 0..1 → head moves down 18 px; returns nozzle tip in local coords
export function serumNozzle(p = 0) { return [-100, -461 + 18 * p]; }
export function serum(o = {}) {
  const sd = o.seed ?? 3100, p = clamp(o.press || 0), dy = 18 * p;
  fill(SERUM_BODY, { col: PC.milk, seed: sd, off: [5, -4] });
  withClip(SERUM_BODY, { seed: sd, off: [5, -4] }, () => {
    fill([[46, 40], [46, -360], [140, -360], [140, 40]], { col: PC.milkSh, seed: sd + 1, sharp: true, amp: 1.5, grain: 0.5 });
    fill([[-140, -24], [140, -24], [140, 40], [-140, 40]], { col: PC.milkSh, seed: sd + 2, sharp: true, amp: 1.2, grain: 0.4, alpha: 0.8 });
  });
  line([[-89, -58], [-90, -170], [-88, -292]], { w: 2.4, seed: sd + 3, col: PC.glass, taper: [0.3, 0.3], amp: 0.8 });
  fill(SERUM_LABEL, { col: PC.label, seed: sd + 4, off: [4, -3] });
  withClip(SERUM_LABEL, { seed: sd + 4, off: [4, -3] }, () => {
    fill([[72, -280], [130, -280], [130, -30], [72, -30]], { col: PC.labelSh, seed: sd + 5, sharp: true, amp: 1.2, grain: 0.5, alpha: 0.6 });
  });
  line(SERUM_LABEL, { w: 2.6, seed: sd + 6, closed: true, taper: [0, 0], amp: 1, alpha: 0.85 });
  txt(T.sSub, -76, -240);
  txt(T.sN1, -76, -210); txt(T.sN2, -76, -186);
  line([[-76, -175], [2, -176]], { w: 2.2, seed: sd + 7, taper: [0, 0], amp: 0.5 });
  greek(-76, -162, [58, 50, 62], sd + 8);
  txt(T.sVol, -76, -58);
  D.push(); D.t(68, -148).r(-Math.PI / 2); logo(40, { seed: sd + 20, amp: 0.9 }); D.pop();
  highlight([[-83, -64], [-85, -160], [-83, -262]], 9, sd + 9);
  highlight([[-80, -326], [-64, -336], [-44, -340]], 5.5, sd + 10, 0.8);
  line(SERUM_BODY, { w: SW, seed: sd + 11, closed: true, taper: [0, 0] });
  // pump: stem (clear), collar, head + nozzle
  const stem = rrect(-14, -420 + dy, 14, -394, 4, 2);
  fill(stem, { col: '#F4EEF0', seed: sd + 12, grain: 0 });
  line(stem, { w: 3.5, seed: sd + 13, closed: true, taper: [0, 0], amp: 1 });
  cap(SERUM_COLLAR, sd + 14);
  const head = rrect(-46, -482 + dy, 46, -418 + dy, [20, 20, 8, 8], 3);
  const noz = rrect(-100, -470 + dy, -40, -452 + dy, [7, 0, 0, 7], 2);
  fill(noz, { col: PC.mint, seed: sd + 20, off: [3, -2] });
  line(noz, { w: 4.5, seed: sd + 21, closed: true, taper: [0, 0], amp: 1 });
  fill(ell(-99, -461 + dy, 3.5, 6, 8), { col: INK, seed: sd + 22, grain: 0, amp: 0.5 });
  cap(head, sd + 23);
}

// ================= CREAM TUBE =================
// stands on its cap. sq 0..1 squeeze (waist + shorter + crumpled end)
export const TUBE_H = 515;
function tubeBody(sq) {
  const top = -515 + 110 * sq, P = [];
  const waist = (y) => { const u = clamp((y + 102) / (top + 102)); return 1 - 0.13 * sq * Math.sin(u * Math.PI) ** 2; };
  const half = y => { const u = clamp((y + 102) / (top - 10 + 102)); return lerp(96, 125, Math.pow(u, 0.8)) * waist(y); };
  // left side, from the shoulder up to the crimp
  P.push([-76, -100], [-86, -112]);
  for (let k = 0; k <= 8; k++) { const y = lerp(-130, top + 18, k / 8); P.push([-half(y), y]); }
  // crimped top edge (slightly wavy when squeezed)
  const n = 8;
  for (let k = 0; k <= n; k++) {
    const x = lerp(-128, 128, k / n) * (1 - 0.04 * sq);
    P.push([x, top - 2 + sq * 9 * Math.sin(k * 2.1) + (k % 2 ? 1.5 : -1.5) * sq]);
  }
  for (let k = 8; k >= 0; k--) { const y = lerp(-130, top + 18, k / 8); P.push([half(y), y]); }
  P.push([86, -112], [76, -100]);
  return { P, top, half };
}
export function tubeNozzle() { return [0, 12]; }
// o: {sq, capOff: null|{x,y,r}, seed}
export function tube(o = {}) {
  const sd = o.seed ?? 3200, sq = clamp(o.sq || 0);
  const { P, top, half } = tubeBody(sq);
  fill(P, { col: PC.tube, seed: sd, off: [5, -4] });
  withClip(P, { seed: sd, off: [5, -4] }, () => {
    fill([[62, -90], [150, -90], [150, top - 30], [62, top - 30]], { col: PC.tubeSh, seed: sd + 1, sharp: true, amp: 1.4, grain: 0.5 });
    fill([[-150, top + 26], [150, top + 26], [150, top - 30], [-150, top - 30]], { col: PC.tubeSh, seed: sd + 2, sharp: true, amp: 1.2, grain: 0.5, alpha: 0.7 });
  });
  // crimp ridges
  for (let i = 0; i < 14; i++) { const x = -118 + i * 18.2; line([[x, top + 4], [x, top + 22]], { w: 2, seed: sd + 30 + i, alpha: 0.4, taper: [0.2, 0.2], amp: 0.5 }); }
  line([[-122, top + 26], [122, top + 26]], { w: 2.6, seed: sd + 3, taper: [0, 0], amp: 0.8, alpha: 0.7 });
  // print (slides down with the squeeze)
  const py = 110 * sq * 0.55;
  D.push(); D.t(0, py * 0.6);
  txt(T.cSub, -100, -446);
  txt(T.cN1, -100, -408); txt(T.cN2, -100, -378);
  line([[-100, -366], [10, -367]], { w: 2.2, seed: sd + 4, taper: [0, 0], amp: 0.5 });
  greek(-100, -351, [80, 70, 84, 60], sd + 5);
  txt(T.cVol, -100, -142);
  D.push(); D.t(62, -236).r(-Math.PI / 2); logo(58, { seed: sd + 20, amp: 0.9 }); D.pop();
  D.pop();
  // fold creases while squeezed
  if (sq > 0.05) {
    [[[-90, top + 60], [-40, top + 80], [10, top + 66]], [[30, top + 90], [80, top + 74]], [[-70, top + 120], [-20, top + 110]]]
      .forEach((l, i) => line(l, { w: 3, seed: sd + 40 + i, alpha: clamp(sq * 1.6), taper: [0.3, 0.3] }));
  }
  highlight([[-half(-150) + 16, -150], [-half(-300) + 14, -300], [-half(top + 60) + 14, top + 60]], 10, sd + 6);
  line(P, { w: SW, seed: sd + 7, closed: true, taper: [0, 0] });
  // nozzle (visible when the cap is off)
  if (o.capOff) {   // short threaded neck + nozzle tip
    const nk = rrect(-34, -104, 34, -74, [3, 3, 6, 6], 2), tip = rrect(-15, -76, 15, -50, [3, 3, 6, 6], 2);
    fill(nk, { col: PC.tube, seed: sd + 8, off: [2, -2] }); line(nk, { w: 4.5, seed: sd + 9, closed: true, taper: [0, 0], amp: 1 });
    for (let i = 0; i < 3; i++) line([[-30, -96 + i * 8], [30, -98 + i * 8]], { w: 2, seed: sd + 50 + i, alpha: 0.45, taper: [0.2, 0.2], amp: 0.4 });
    fill(tip, { col: PC.tube, seed: sd + 12, off: [2, -2] }); line(tip, { w: 4.5, seed: sd + 13, closed: true, taper: [0, 0], amp: 1 });
  }
  // cap (stays on unless o.capOff; once off the caller draws it with tubeCap())
  if (!o.capOff) cap(TUBE_CAP, sd + 10);
}
const TUBE_CAP = rrect(-82, -102, 82, 0, [6, 6, 16, 16], 3);
// the tube cap alone, centred on its own middle (0,0)
export function tubeCap() { D.push(); D.t(0, 51); cap(TUBE_CAP, 3210); D.pop(); }
