// The character (a face in a towel turban and bathrobe) and the two masks.
// All geometry is in local px around the face centre; the caller sets D transforms.
import { D, G, line, fill, ell, arcPts, mirror, lerpPts, mix, lerp, clamp, hs, TAU } from './core.js';

export const PAL = {
  ink: '#241B35', violet: '#4B2BB4', violetInk: '#3A1F9A', pink: '#F2A0B4', pinkDeep: '#E27795',
  cream: '#F6EEE0', cyan: '#4BB8D1', ice: '#BFEAF3',
  skin: '#F9DFCD', skinShade: '#EFBFA8', skinDrab: '#F1DCCC', skinShadeDrab: '#DDC3B2',
  towel: '#F4A5B8', towelShade: '#E07A97', towelDrab: '#CBBFC1', towelShadeDrab: '#AFA2A6',
  robe: '#F6EEE0', robeShade: '#E3D3C8', robeDrab: '#E4E1DA', robeShadeDrab: '#C9C5BD',
  collar: '#F4A5B8', collarDrab: '#C9BDBB',
  sheet: '#EEEBE4', sheetDry: '#F8F6F1', sheetLine: '#8F887C', sheetEdge: '#6B655B',
  gel: '#9C82F5', gelLine: '#4B2BB4',
};

// ---------- geometry ----------
const FACE_OUT = [[-246, -176], [-258, -70], [-250, 40], [-224, 144], [-170, 232], [-92, 292], [0, 312], [92, 292], [170, 232], [224, 144], [250, 40], [258, -70], [246, -176]];
const FACE_FILL = [...FACE_OUT, [190, -262], [0, -292], [-190, -262]];
const EAR_L = [[-250, -40], [-280, -58], [-294, -16], [-284, 34], [-246, 50]];
const EAR_IN_L = [[-262, -28], [-276, -4], [-266, 26]];
const NECK_L = [[-92, 270], [-96, 340], [-100, 404]];
const NECK_FILL = [[-94, 240], [94, 240], [104, 430], [-104, 430]];
const CHIN_SH = [[-94, 276], [-50, 302], [0, 316], [50, 302], [94, 276], [96, 326], [50, 350], [0, 356], [-50, 350], [-96, 326]];
const SHOULDER_L = [[-100, 404], [-180, 424], [-320, 462], [-460, 520], [-580, 600]];
const ROBE_FILL = [[-660, 560], [-470, 512], [-320, 466], [-170, 420], [170, 420], [320, 466], [470, 512], [660, 560], [660, 1200], [-660, 1200]];
const SKIN_V = [[-112, 400], [112, 400], [80, 480], [36, 566], [4, 620], [-40, 560], [-80, 480]];
// shawl collar: two thick fluffy bands crossing at the chest
const COL_R_IN = [[112, 402], [78, 480], [36, 568], [0, 632], [-30, 700], [-60, 800]];
const COL_R_OUT = [[214, 430], [176, 520], [130, 620], [88, 712], [56, 790], [30, 860]];
const COL_L_IN = [[-112, 402], [-80, 480], [-42, 552], [-8, 606]];
const COL_L_OUT = [[-214, 430], [-182, 520], [-138, 610], [-96, 690]];
// turban
const TOWEL = [[-266, -150], [-300, -250], [-290, -362], [-226, -450], [-120, -500], [10, -512], [140, -494], [244, -432], [300, -334], [300, -230], [270, -150], [206, -194], [104, -220], [0, -228], [-104, -220], [-206, -194]];
const TBAND = [[-268, -166], [-250, -250], [-180, -330], [-70, -398], [60, -446], [170, -470], [232, -442], [150, -406], [30, -356], [-90, -292], [-180, -226], [-232, -170]];   // the diagonal wrap band
const TFOLD = [
  [[-284, -300], [-246, -380], [-180, -440]],
  [[-60, -470], [40, -492], [150, -480]],
  [[262, -380], [286, -300], [282, -220]],
  [[-206, -212], [-150, -270], [-60, -330], [40, -380]],
];
const TSHADE = [[-266, -150], [-206, -194], [-104, -220], [0, -228], [104, -222], [206, -194], [270, -150], [266, -176], [204, -224], [100, -250], [0, -258], [-100, -250], [-204, -224], [-262, -178]];
const TUCK = [[150, -430], [200, -470], [240, -486], [252, -456], [222, -430]];

export const SHEET_OUT = [[-232, -198], [-120, -212], [0, -216], [120, -212], [232, -198], [248, -76], [242, 36], [218, 140], [166, 226], [92, 284], [0, 302], [-92, 284], [-166, 226], [-218, 140], [-242, 36], [-248, -76]];
export const SHEET_HOLES = [ell(-108, 8, 62, 34, 12), ell(108, 8, 62, 34, 12), ell(0, 168, 74, 34, 12)];
export const GEL_FIT = [[-236, -194], [-120, -210], [0, -214], [120, -210], [236, -194], [250, -76], [246, 36], [220, 142], [168, 228], [94, 288], [0, 306], [-94, 288], [-168, 228], [-220, 142], [-246, 36], [-250, -76]];
export const GEL_FLOAT = [[-246, -212], [-124, -236], [0, -244], [124, -236], [246, -212], [272, -82], [268, 36], [240, 148], [184, 234], [102, 292], [0, 314], [-102, 292], [-184, 234], [-240, 148], [-268, 36], [-272, -82]];
export const GEL_HOLES = [ell(-108, 8, 56, 31, 12), ell(108, 8, 56, 31, 12), ell(0, 168, 64, 29, 12), ell(-16, 88, 8, 6, 8), ell(16, 88, 8, 6, 8)];

// ---------- body ----------
export function drawBody(p) {
  const d = p.drab ?? 0, sd = 300;
  fill(ROBE_FILL, { col: mix(PAL.robe, PAL.robeDrab, d), seed: sd + 1, off: [5, -3] });
  // terry texture on the robe
  for (let i = 0; i < 26; i++) {
    const x = -520 + (i % 9) * 125 + hs(i, 11) * 30, y = 520 + Math.floor(i / 9) * 140 + hs(i, 12) * 30;
    if (Math.abs(x) < 240 && y < 700) continue;
    line([[x, y], [x + 12, y + 6], [x + 22, y]], { w: 3, seed: sd + 40 + i, alpha: 0.3, col: mix('#B9A99D', '#A7A39B', d) });
  }
  fill(SKIN_V, { col: mix(PAL.skin, PAL.skinDrab, d), seed: sd + 2, off: [4, -3] });
  const band = (A, B, s) => fill([...A, ...B.slice().reverse()], { col: mix(PAL.collar, PAL.collarDrab, d), seed: s, off: [5, -3] });
  band(COL_L_IN, COL_L_OUT, sd + 3);
  band(COL_R_IN, COL_R_OUT, sd + 4);
  [COL_L_IN, COL_L_OUT, COL_R_IN, COL_R_OUT].forEach((l, i) => line(l, { w: 5.5, seed: sd + 10 + i, taper: [0.15, 0.35] }));
  line([[-214, 430], [-160, 418], [-112, 402]], { w: 5, seed: sd + 16 });
  line([[214, 430], [160, 418], [112, 402]], { w: 5, seed: sd + 17 });
  line(SHOULDER_L.slice(1), { w: 6, seed: sd + 20, taper: [0.1, 0.4] });
  line(mirror(SHOULDER_L).slice(1), { w: 6, seed: sd + 21, taper: [0.1, 0.4] });
  // neck
  fill(NECK_FILL, { col: mix(PAL.skin, PAL.skinDrab, d), seed: sd + 5, off: [4, -3] });
  fill(CHIN_SH, { col: mix(PAL.skinShade, PAL.skinShadeDrab, d), seed: sd + 6, off: [3, -2], alpha: 0.95 });
  line(NECK_L, { w: 5.5, seed: sd + 22 });
  line(mirror(NECK_L), { w: 5.5, seed: sd + 23 });
}

// ---------- head ----------
// p: {drab, eyes:'closed'|'squeeze'|'open'|'happy', lid, look:[x,y], brow -1..1, sad 0..1, mouth, blush, glow, sweat, sparkle}
// layers: onMask() is drawn over the face features (under brows + towel)
export function drawHead(p, onMask) {
  const d = p.drab ?? 0, sd = 400;
  const skin = mix(PAL.skin, PAL.skinDrab, d);
  [1, -1].forEach((sx, i) => {
    const E = sx > 0 ? EAR_L : mirror(EAR_L);
    fill([...E, [sx * -240, 10]], { col: skin, seed: sd + i, off: [4, -3] });
    line(E, { w: 5.5, seed: sd + 2 + i });
    line(sx > 0 ? EAR_IN_L : mirror(EAR_IN_L), { w: 3.5, seed: sd + 4 + i });
  });
  fill(FACE_FILL, { col: skin, seed: sd + 6, off: [6, -4] });
  // jaw shade (cel)
  fill([[-250, 40], [-224, 144], [-170, 232], [-92, 292], [-60, 300], [-140, 240], [-196, 150], [-226, 50]], { col: mix(PAL.skinShade, PAL.skinShadeDrab, d), seed: sd + 8, alpha: 0.55, off: [2, 0] });
  if (p.glow) {
    const a = p.glow;
    fill(ell(-150, -110, 54 * a, 20 * a, 10, -0.35), { col: '#FFF8F1', seed: sd + 60, alpha: 0.95, grain: 0.3 });
    fill(ell(178, 40, 18 * a, 44 * a, 10, 0.15), { col: '#FFF8F1', seed: sd + 61, alpha: 0.95, grain: 0.3 });
    fill(ell(0, 52, 9 * a, 18 * a, 8), { col: '#FFF8F1', seed: sd + 62, alpha: 0.9, grain: 0.3 });
  }
  line(FACE_OUT, { w: 6.5, seed: sd + 7, taper: [0.06, 0.06] });
  features(p);
  if (onMask) onMask();
  brows(p);
  if ((p.sweat ?? 0) > 0.02) sweatDrop(p.sweat);
  towel(p);
}

function features(p) {
  const sd = 500, d = p.drab ?? 0;
  const bl = p.blush ?? 0.6;
  if (bl > 0.01) [1, -1].forEach((sx, i) => {
    fill(ell(sx * 156, 96, 56, 28, 12), { col: mix(PAL.pink, '#D9BDBA', d), seed: sd + i, off: [5, 3], alpha: 0.8 * bl, grain: 0.5 });
    for (let k = 0; k < 3; k++) line([[sx * 156 + (k - 1) * 22 - 7, 108], [sx * 156 + (k - 1) * 22 + 7, 84]], { w: 3.2, seed: sd + 10 + i * 3 + k, alpha: 0.6 * bl, col: mix(PAL.pinkDeep, '#B79C9C', d), taper: [0.4, 0.4] });
  });
  [1, -1].forEach((sx, i) => {
    const X = q => q.map(v => [v[0] * sx, v[1]]);
    const s = sd + 20 + i * 10;
    if (p.eyes === 'open') {
      const lid = clamp(p.lid ?? 0), lx = (p.look?.[0] ?? 0) * 12, ly = (p.look?.[1] ?? 0) * 10;
      const ex = -108 * sx, ey = 6, rx = 38, ry = 44;
      fill(ell(ex, ey, rx, ry, 14), { col: '#FFFDF8', seed: s, grain: 0.25 });
      fill(ell(ex + lx, ey + 8 + ly, 24, 27, 10), { col: PAL.ink, seed: s + 1, grain: 0, amp: 1.2 });
      fill(ell(ex + lx + 8, ey - 1 + ly, 9, 9, 8), { col: '#FFFFFF', seed: s + 2, grain: 0, amp: 0.6 });
      if (p.sparkle) fill(ell(ex + lx - 7, ey + 17 + ly, 4, 4, 6), { col: '#FFFFFF', seed: s + 6, grain: 0, amp: 0.5 });
      line(arcPts(ex, ey, rx, ry, 0.15 * Math.PI, 0.85 * Math.PI, 8), { w: 3.6, seed: s + 3 });
      if (lid > 0.02) {
        const yl = ey - ry + lid * ry * 1.5;
        fill([[ex - rx - 8, ey - ry - 12], [ex + rx + 8, ey - ry - 12], [ex + rx + 8, yl], [ex, yl + 5], [ex - rx - 8, yl]], { col: mix(PAL.skin, PAL.skinDrab, d), seed: s + 4, sharp: true, amp: 1.2 });
      }
      const yl = lid > 0.02 ? ey - ry + lid * ry * 1.5 : null;
      // thick upper lash line + flick
      const top = yl == null ? arcPts(ex, ey, rx + 2, ry + 2, 1.08 * Math.PI, 1.92 * Math.PI, 10) : [[ex - rx - 3, yl + 1], [ex, yl + 6], [ex + rx + 3, yl + 1]];
      if (sx < 0) top.reverse();
      line(top, { w: 7.5, seed: s + 5, taper: [0.15, 0.05] });
      const tip = top[top.length - 1];
      line([tip, [tip[0] - sx * 18, tip[1] - 14]], { w: 5, seed: s + 7, taper: [0.1, 0.8] });
    } else if (p.eyes === 'blink') {
      line(X([[-150, 4], [-108, 12], [-64, 4]]), { w: 7, seed: s, taper: [0.2, 0.2] });
      line(X([[-150, 4], [-166, -6]]), { w: 4, seed: s + 1, taper: [0.1, 0.7] });
    } else if (p.eyes === 'squeeze') {
      line(X([[-156, -18], [-100, 4], [-156, 26]]), { w: 6.5, seed: s, taper: [0.3, 0.3] });
    } else if (p.eyes === 'happy') {
      line(X([[-156, 16], [-108, -16], [-60, 16]]), { w: 6.5, seed: s, taper: [0.25, 0.25] });
      line(X([[-150, 8], [-170, -2]]), { w: 3.6, seed: s + 1, taper: [0.2, 0.7] });
    } else {
      line(X([[-158, -2], [-108, 22], [-58, -2]]), { w: 6.5, seed: s, taper: [0.25, 0.25] });
      line(X([[-148, 10], [-168, 26]]), { w: 3.8, seed: s + 1, taper: [0.2, 0.7] });
      line(X([[-130, 18], [-140, 38]]), { w: 3.8, seed: s + 2, taper: [0.2, 0.7] });
    }
  });
  // nose
  line([[-2, 40], [12, 70], [6, 88], [-10, 92]], { w: 4.8, seed: sd + 50, taper: [0.5, 0.3] });
  // mouth
  const m = p.mouth || 'smile', s = sd + 60;
  if (m === 'smile') line([[-56, 152], [-28, 172], [0, 178], [28, 172], [56, 152]], { w: 6, seed: s, taper: [0.25, 0.25] });
  else if (m === 'flat') line([[-36, 168], [0, 171], [36, 167]], { w: 5.5, seed: s });
  else if (m === 'frown') line([[-44, 182], [-20, 167], [0, 164], [20, 167], [44, 182]], { w: 5.5, seed: s });
  else if (m === 'wavy') line([[-48, 172], [-24, 161], [0, 172], [24, 161], [48, 172]], { w: 5.2, seed: s });
  else if (m === 'grit') {
    fill([[-50, 154], [50, 154], [44, 184], [-44, 184]], { col: '#FFFDF8', seed: s, grain: 0.2 });
    line([[-50, 154], [50, 154], [44, 184], [-44, 184]], { w: 5, seed: s + 1, closed: true });
    line([[-48, 169], [48, 169]], { w: 3.2, seed: s + 2 });
  } else if (m === 'o') {
    fill(ell(0, 170, 17, 21, 10), { col: '#7A2E45', seed: s, grain: 0.3 });
    line(ell(0, 170, 17, 21, 10), { w: 5, seed: s + 1, closed: true });
  } else if (m === 'open') {
    const top = [[-62, 148], [-30, 157], [0, 159], [30, 157], [62, 148]], bot = [[46, 186], [0, 210], [-46, 186]];
    fill([...top, ...bot], { col: '#7A2E45', seed: s, grain: 0.3 });
    fill([[-32, 194], [0, 183], [32, 194], [0, 209]], { col: PAL.pinkDeep, seed: s + 2, grain: 0.3 });
    line([...top, ...bot], { w: 5.5, seed: s + 1, closed: true });
  }
}

function brows(p) {
  const sd = 560;
  const b = p.brow ?? 0, sad = p.sad ?? 0;
  [1, -1].forEach((sx, i) => {
    const X = q => q.map(v => [v[0] * sx, v[1]]);
    const yo = p.eyes === 'open' ? -14 : 0;
    const inner = -88 + yo + (b < 0 ? -b * 26 : -b * 24) - sad * 22, mid = -102 + yo - b * 22, outer = -90 + yo - (b > 0 ? b * 12 : 0) + sad * 8 + (b < 0 ? b * 8 : 0);
    line(X([[-160, outer], [-112, mid], [-64, inner]]), { w: 7, seed: sd + i, taper: [0.35, 0.4] });
  });
}

function sweatDrop(t) {
  const x = 214, y = -150 + t * 50, sd = 590;
  const dp = [[x, y - 34], [x + 15, y - 4], [x + 13, y + 12], [x, y + 19], [x - 13, y + 12], [x - 15, y - 4]];
  fill(dp, { col: PAL.ice, seed: sd, off: [3, -2] });
  line(dp, { w: 4, seed: sd + 1, closed: true });
  line([[x - 5, y - 2], [x - 6, y + 8]], { w: 3, seed: sd + 2, col: '#FFFFFF' });
}

function towel(p) {
  const d = p.drab ?? 0, sd = 600;
  const col = mix(PAL.towel, PAL.towelDrab, d), sh = mix(PAL.towelShade, PAL.towelShadeDrab, d);
  fill(TOWEL, { col, seed: sd + 1, off: [6, -4] });
  fill(TSHADE, { col: sh, seed: sd + 2, off: [4, -2], alpha: 0.9 });
  fill(TBAND, { col: mix('#F7BACA', '#D8CDCB', d), seed: sd + 3, off: [5, -3] });
  fill(TUCK, { col: sh, seed: sd + 4, off: [3, -2] });
  line(TOWEL, { w: 6.5, seed: sd + 5, closed: true });
  line(TBAND.slice(0, 7), { w: 5.5, seed: sd + 6, taper: [0.2, 0.2] });
  line(TBAND.slice(6), { w: 5, seed: sd + 7, taper: [0.2, 0.3] });
  line(TUCK, { w: 4.5, seed: sd + 8, closed: true });
  TFOLD.forEach((f, i) => line(f, { w: 4.2, seed: sd + 10 + i, taper: [0.35, 0.45] }));
  for (let i = 0; i < 14; i++) {
    const x = -230 + (i % 7) * 72 + hs(i, 62) * 16, y = -390 + Math.floor(i / 7) * 120 + hs(i, 63) * 20 + Math.abs(x) * 0.25;
    line([[x, y], [x + 9, y - 6], [x + 16, y]], { w: 2.8, seed: sd + 20 + i, alpha: 0.38 });
  }
}

// ---------- ordinary sheet mask ----------
// p: {wet 0..1, lift 0..1 (edges peel), slide px, curl 0..1, crack 0..1, sag 0..1}
export function sheetOutline(p) {
  const lift = p.lift ?? 0, curl = p.curl ?? 0, slide = p.slide ?? 0;
  return SHEET_OUT.map(([x, y], i) => {
    const top = y < -150 ? 1 : 0, side = Math.abs(x) > 200 && y > -150 && y < 160 ? 1 : 0;
    const k = lift * (top * (30 + 14 * Math.sin(i * 2.1)) + side * 24) + curl * (top * 14 + side * 12);
    const r = Math.hypot(x, y) || 1;
    return [x + x / r * k, y + y / r * k + slide * (0.6 + 0.4 * (y + 220) / 520)];
  });
}
export function drawSheet(p) {
  const sd = 700, dry = 1 - (p.wet ?? 1), slide = p.slide ?? 0;
  const lift = p.lift ?? 0, curl = p.curl ?? 0;
  const O = sheetOutline(p);
  const sy = y => y + slide * (0.6 + 0.4 * (y + 220) / 520);
  const holes = SHEET_HOLES.map(h => h.map(([x, y]) => [x, sy(y)]));
  const col = mix(PAL.sheet, PAL.sheetDry, dry);
  if (lift + curl > 0.05) fill(O.map(([x, y]) => [x + 10, y + 14]), { col: '#5E574D', seed: sd + 35, holes, alpha: 0.28 * clamp(lift + curl), grain: 0 });
  fill(O, { col, seed: sd, holes, off: [5, -3], alpha: 0.96, grain: 0.9 });
  // fabric weave hatch
  for (let i = 0; i < 34; i++) {
    const a = 0.7, x = hs(i, 72) * 200, y = -180 + ((hs(i, 73) + 1) / 2) * 450;
    if (inHole(x, y)) continue;
    if (Math.abs(x) > 205 - Math.max(0, y - 90) * 0.7) continue;
    line([[x - 8, sy(y) - 8 * a], [x + 8, sy(y) + 8 * a]], { w: 2.4, seed: sd + 40 + i, col: PAL.sheetLine, alpha: 0.45, taper: [0.4, 0.4] });
  }
  // nose relief drawn on the sheet
  line([[-2, 40], [12, 70], [6, 88], [-10, 92]].map(([x, y]) => [x, sy(y)]), { w: 4, seed: sd + 60, col: PAL.sheetEdge, alpha: 0.75, taper: [0.5, 0.3] });
  if (dry < 0.95) {
    const a = 1 - dry;
    line([[-180, -150], [-118, -178], [-36, -188]].map(([x, y]) => [x, sy(y)]), { w: 8, seed: sd + 80, col: '#FFFFFF', alpha: 0.85 * a, taper: [0.4, 0.4] });
    line([[186, 40], [192, 92], [178, 140]].map(([x, y]) => [x, sy(y)]), { w: 7, seed: sd + 81, col: '#FFFFFF', alpha: 0.8 * a, taper: [0.4, 0.4] });
    fill(ell(-176, 60, 6, 9, 8).map(([x, y]) => [x, sy(y)]), { col: '#FFFFFF', seed: sd + 82, alpha: 0.8 * a, grain: 0 });
  }
  if ((p.crack ?? 0) > 0) {
    const C = [[[-160, -130], [-136, -104], [-150, -76], [-126, -54]], [[150, -160], [128, -132], [144, -104], [124, -80]], [[-64, 226], [-42, 246], [-56, 268]], [[160, 120], [138, 152], [150, 180]], [[60, -120], [44, -96], [58, -74]], [[-190, 90], [-168, 112], [-180, 140]], [[30, 230], [52, 252], [40, 276]], [[-40, -160], [-20, -140], [-34, -118]]];
    C.forEach((c, i) => line(c.map(([x, y]) => [x, sy(y)]), { w: 4.4, seed: sd + 90 + i, sharp: true, trim: [0, clamp(p.crack * 1.6 - i * 0.15)], col: PAL.sheetEdge, alpha: 0.95 }));
  }
  line(O, { w: 5, seed: sd + 1, closed: true, col: PAL.sheetEdge });
  holes.forEach((h, i) => line(h, { w: 4, seed: sd + 2 + i, closed: true, col: PAL.sheetEdge }));
  // peeling flaps: the cheek edge and a forehead corner come unstuck and flap
  const k = p.flap ?? 0, w = p.flapW ?? 0;
  if (k > 0.02) {
    const flaps = [
      [[244, -30], [266 + 54 * k, -24 + 6 * w], [262 + 96 * k + 18 * w, 52 + 14 * w], [246 + 60 * k, 128], [216, 144]],
      [[-214, 146], [-246 - 40 * k, 160 + 10 * w], [-236 - 70 * k + 14 * w, 236 + 30 * k], [-190 - 26 * k, 250 + 20 * k], [-160, 222]],
    ];
    flaps.forEach((P0, i) => {
      const P = P0.map(([x, y]) => [x, sy(y)]);
      fill(P, { col: mix('#D6CFC1', '#E9E5DC', dry), seed: sd + 120 + i * 3, off: [3, -2] });
      line(P, { w: 4.6, seed: sd + 121 + i * 3, col: PAL.sheetEdge, closed: true });
      line([P[0], P[P.length - 1]], { w: 3, seed: sd + 122 + i * 3, col: PAL.sheetEdge, alpha: 0.55 });
    });
  }
  if (lift + curl > 0.08) {
    const k = clamp(lift + curl);
    line(O.slice(0, 5).map(([x, y]) => [x, y + 7 + 12 * k]), { w: 3.6, seed: sd + 20, col: PAL.sheetEdge, alpha: 0.85 });
    line(O.slice(4, 7).map(([x, y]) => [x - 8 - 10 * k, y]), { w: 3.2, seed: sd + 21, col: PAL.sheetEdge, alpha: 0.7 });
    line(O.slice(13, 16).concat([O[0]]).map(([x, y]) => [x + 8 + 10 * k, y]), { w: 3.2, seed: sd + 22, col: PAL.sheetEdge, alpha: 0.7 });
  }
}
function inHole(x, y) {
  const e = (cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1.3;
  return e(-108, 8, 62, 34) || e(108, 8, 62, 34) || e(0, 168, 74, 34) || (Math.abs(x) < 26 && y > 30 && y < 100);
}

// ---------- bio-gel mask ----------
// p: {fit 0..1, jig wobble amount, t time, melt 0..1, alpha}
export function gelShape(p) {
  const fit = p.fit ?? 0, jig = p.jig ?? 0, t = p.t ?? 0;
  return lerpPts(GEL_FLOAT, GEL_FIT, fit).map(([x, y], i) => {
    const a = Math.atan2(y, x), r = Math.hypot(x, y) || 1;
    const k = jig * (Math.sin(a * 3 + t * 0.9) * 12 + Math.sin(a * 5 - t * 1.3) * 6);
    return [x + x / r * k, y + y / r * k];
  });
}
export function drawGel(p) {
  const sd = 800, melt = p.melt ?? 0, A = p.alpha ?? 1;
  const O = gelShape(p);
  const sq = 1 + (p.jig ?? 0) * 0.04 * Math.sin((p.t ?? 0) * 0.9);
  const holes = GEL_HOLES.map(h => h.map(([x, y]) => [x * sq, y / sq]));
  const a = A * (1 - melt * 0.8), dk = !!p.dark;
  fill(O, { col: dk ? '#B7A2FF' : PAL.gel, seed: sd, holes, alpha: (dk ? 0.55 : 0.2) * a, grain: 0.35 });
  const I = O.map(([x, y]) => [x * 0.9, y * 0.9 - 6]);
  fill(I, { col: dk ? '#E2D8FF' : '#D8CCFF', seed: sd + 1, holes, alpha: (dk ? 0.35 : 0.16) * a, grain: 0.2 });
  const hl = 0.95 * a;
  line([[-186, -150], [-126, -184], [-44, -196], [26, -194]], { w: 12, seed: sd + 2, col: '#FFFFFF', alpha: hl, taper: [0.35, 0.5] });
  line([[196, -24], [204, 40], [190, 104]], { w: 10, seed: sd + 3, col: '#FFFFFF', alpha: hl * 0.9, taper: [0.4, 0.4] });
  line([[-204, 40], [-198, 96]], { w: 7, seed: sd + 4, col: '#FFFFFF', alpha: hl * 0.8, taper: [0.4, 0.4] });
  line([[-60, 262], [0, 280], [56, 266]], { w: 6, seed: sd + 10, col: '#FFFFFF', alpha: hl * 0.7, taper: [0.4, 0.4] });
  fill(ell(-62, -152, 9, 7, 8), { col: '#FFFFFF', seed: sd + 5, alpha: hl, grain: 0 });
  fill(ell(118, -140, 6, 5, 8), { col: '#FFFFFF', seed: sd + 6, alpha: hl * 0.8, grain: 0 });
  fill(ell(-136, 206, 6, 5, 8), { col: '#FFFFFF', seed: sd + 7, alpha: hl * 0.7, grain: 0 });
  const la = A * (1 - melt * 0.9);
  const lc = p.dark ? '#F6EEE0' : PAL.gelLine;
  line(O, { w: 5.5, seed: sd + 8, closed: true, col: lc, alpha: la });
  holes.forEach((h, i) => line(h, { w: i > 2 ? 3 : 4, seed: sd + 9 + i, closed: true, col: lc, alpha: la }));
}
