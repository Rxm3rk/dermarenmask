// The skin barrier as a little brick wall: pillow-shaped cell characters ("bricks") held together by
// ceramide mortar. Dry: shrunken beige cells, dark cracks, flakes, moisture escaping.
// Hydrated: plump pink cells, white mortar, a glossy sealed top coat.
// World coords = screen coords at camera scale 1; the caller sets D (camera / lens transform).
import { D, G, line, fill, withClip, squircle, ell, arcPts, lerp, clamp, hash, hs, vn, TAU, mix, E, INK, star4 } from './core.js';

export const SK = {
  dry: '#EEDDD2', dryShade: '#DCC3B5', cell: '#F7B6C8', cellShade: '#EC97AF', cellHi: '#FCD9E2',
  crevice: '#C08F98', mortar: '#FFF9F4', mortarSh: '#F1E2E0', deep: '#EDA3B8', blush: '#F18AA7',
  water: '#BDEBDA', waterSh: '#86D3BA', flake: '#F7EEE6',
};

// gently convex skin surface
export const Y0 = 1300, K = 0.00022;
export const ytop = x => Y0 + K * (x - 540) ** 2;
export const slope = x => 2 * K * (x - 540);
export const CW = 250, CH = 136, GX = 18, RP = 150;

export const CELLS = [];
for (let r = 0; r < 6; r++) for (let i = -4; i <= 4; i++) {
  const x = 540 + (i + (r % 2 ? 0.5 : 0)) * (CW + GX);
  if (x < -200 || x > 1280) continue;
  const y = ytop(x) + r * RP + CH / 2 + 6;
  if (y > 2050) continue;
  CELLS.push({ r, i, x, y, a: Math.atan(slope(x)), id: CELLS.length, seed: 5000 + CELLS.length * 37, face: r <= 1 });
}
// vertical mortar gaps (between neighbours in a row)
export const GAPS = [];
for (let r = 0; r < 6; r++) {
  const row = CELLS.filter(c => c.r === r).sort((a, b) => a.x - b.x);
  for (let k = 0; k + 1 < row.length; k++) {
    const x = (row[k].x + row[k + 1].x) / 2;
    GAPS.push({ r, x, y: ytop(x) + r * RP + CH / 2 + 6, a: Math.atan(slope(x)), id: GAPS.length, seed: 6000 + GAPS.length * 13 });
  }
}
export const cellAt = (r, x) => CELLS.filter(c => c.r === r).reduce((b, c) => Math.abs(c.x - x) < Math.abs(b.x - x) ? c : b);

// ---------------- pieces ----------------
// cell outline in local coords: squircle with a per-cell wobble; `sag` dents the top (deflated)
function cellShape(c, sag = 0) {
  const n = 30, P = squircle(0, 0, CW / 2, CH / 2, 2.9, n);
  return P.map(([x, y], k) => {
    const j = 1 + 0.018 * hs(c.id * 31 + k, 7);
    let yy = y * j;
    if (y < 0) yy += sag * Math.max(0, 1 - Math.abs(x) / (CW * 0.42)) ** 2;
    return [x * j, yy];
  });
}
// face: s = {eyes, mouth, blush, look:[x,y], sweat}
export function face(s, sd, k = 1) {
  const ex = 44 * k, ey = -6, lx = (s.look?.[0] || 0) * 6, ly = (s.look?.[1] || 0) * 5;
  const eye = (side) => {
    const x = side * ex + lx, y = ey + ly, e = s.eyes;
    if (e === 'open' || e === 'wow' || e === 'sparkle') {
      const big = e === 'wow' ? 1.25 : 1;
      fill(ell(x, y, 8.6 * big, 10.8 * big, 12), { col: INK, seed: sd + 10 + side, grain: 0, amp: 0.8 });
      if (e === 'sparkle') { D.push(); D.t(x - 2, y - 3); fill(star4(7.5, 0.32), { col: '#FFFFFF', seed: sd + 14 + side, sharp: true, grain: 0, amp: 0.4 }); D.pop(); }
      else { fill(ell(x - 2.6, y - 4, 3.2, 3.6, 6), { col: '#FFFFFF', seed: sd + 12 + side, grain: 0, amp: 0.4 }); fill(ell(x + 2.8, y + 4, 1.6, 1.6, 5), { col: '#FFFFFF', seed: sd + 18 + side, grain: 0, amp: 0.3 }); }
    } else if (e === 'happy') {
      line([[x - 10, y + 4], [x, y - 6], [x + 10, y + 4]], { w: 5, seed: sd + 10 + side, taper: [0.25, 0.25], amp: 0.8 });
    } else if (e === 'oof') {
      line([[x - 9 * side, y - 8], [x + 8 * side, y], [x - 9 * side, y + 8]], { w: 5, seed: sd + 10 + side, sharp: true, taper: [0.2, 0.2], amp: 0.6 });
    } else if (e === 'sleepy') {
      line([[x - 10, y], [x, y + 4], [x + 10, y]], { w: 5, seed: sd + 10 + side, taper: [0.2, 0.2], amp: 0.6 });
      line([[x - 9, y - 7], [x + 9, y - 8]], { w: 3, seed: sd + 16 + side, taper: [0.3, 0.3], amp: 0.6, alpha: 0.5 });
    } else {   // blink / closed
      line([[x - 9, y + 1], [x + 9, y + 1]], { w: 5, seed: sd + 10 + side, taper: [0.2, 0.2], amp: 0.6 });
    }
  };
  eye(-1); eye(1);
  if (s.blush > 0.02) [-1, 1].forEach(side => fill(ell(side * (ex + 12) + lx, ey + 20 + ly, 14, 7.5, 10), { col: SK.blush, seed: sd + 20 + side, alpha: 0.75 * s.blush, grain: 0, amp: 0.8 }));
  const my = 24 + ly, mx = lx;
  switch (s.mouth) {
    case 'smile': line([[mx - 13, my - 4], [mx, my + 5], [mx + 13, my - 4]], { w: 5, seed: sd + 30, taper: [0.25, 0.25], amp: 0.7 }); break;
    case 'o': fill(ell(mx, my + 1, 6.5, 8, 8), { col: INK, seed: sd + 30, grain: 0, amp: 0.5 }); break;
    case 'open': {
      const P = [[mx - 16, my - 4], [mx + 16, my - 4], [mx + 12, my + 8], [mx, my + 13], [mx - 12, my + 8]];
      fill(P, { col: INK, seed: sd + 30, grain: 0, amp: 0.6 });
      fill(ell(mx, my + 8, 8, 4, 8), { col: '#F27D9C', seed: sd + 31, grain: 0, amp: 0.4 });
      break;
    }
    case 'wavy': line([[mx - 12, my], [mx - 6, my - 4], [mx, my], [mx + 6, my - 4], [mx + 12, my]], { w: 4.4, seed: sd + 30, taper: [0.2, 0.2], amp: 0.5 }); break;
    case 'gulp': fill(ell(mx, my, 5, 6, 8), { col: INK, seed: sd + 30, grain: 0, amp: 0.4 });
      [-1, 1].forEach(side => line(arcPts(mx + side * 21, my - 1, 9, 10, side > 0 ? -1.1 : Math.PI - 1.1, side > 0 ? 1.1 : Math.PI + 1.1, 5), { w: 3.6, seed: sd + 32 + side, amp: 0.5, alpha: 0.8 }));
      break;
    case 'frown': line([[mx - 12, my + 4], [mx, my - 4], [mx + 12, my + 4]], { w: 4.6, seed: sd + 30, taper: [0.25, 0.25], amp: 0.6 }); break;
    default: line([[mx - 9, my], [mx + 9, my + 1]], { w: 4.6, seed: sd + 30, taper: [0.2, 0.2], amp: 0.6 });
  }
  if (s.sweat > 0.02) {
    const x = ex + 40, y = -36;
    D.push(); D.t(x, y).s(s.sweat);
    const P = [[0, -12], [5, -2], [6, 4], [0, 9], [-6, 4], [-5, -2]];
    fill(P, { col: SK.water, seed: sd + 40, grain: 0, amp: 0.5 }); line(P, { w: 3, seed: sd + 41, closed: true, amp: 0.5, taper: [0, 0] });
    D.pop();
  }
}

// draw one cell. st = {dry, h (hydrated), glow, dew, sx, sy, dy, rot, sag, crack, face:{...}, alpha}
export function cell(c, st) {
  const sd = c.seed, dry = clamp(st.dry ?? 0), dk = clamp((c.r - 1) * 0.22, 0, 0.6);
  const crev = mix(SK.crevice, SK.mortar, clamp(st.mortar ?? 0));
  const col = mix(mix(SK.cell, SK.dry, dry), crev, dk), sh = mix(mix(SK.cellShade, SK.dryShade, dry), crev, dk);
  D.push();
  D.t(c.x + (st.dx || 0), c.y + (st.dy || 0)).r(c.a + (st.rot || 0));
  // squash pivots on the cell's bottom edge
  D.t(0, CH / 2).s(st.sx ?? 1, st.sy ?? 1).t(0, -CH / 2);
  const P = cellShape(c, st.sag || 0);
  fill(P, { col, seed: sd, off: [4, -3] });
  withClip(P, { seed: sd, off: [4, -3] }, () => {
    fill([[-CW, CH * 0.22], [CW, CH * 0.12], [CW, CH], [-CW, CH]], { col: sh, seed: sd + 1, sharp: true, amp: 1.5, grain: 0.5, alpha: 0.85 });
    if ((st.glow || 0) > 0.01) fill(ell(-CW * 0.08, -CH * 0.08, CW * 0.36, CH * 0.3, 14), { col: SK.cellHi, seed: sd + 2, alpha: st.glow, grain: 0.3 });
  });
  // plush highlight (dull when dry) + dew after the serum
  const hl = (0.45 + 0.55 * (1 - dry)) * (1 - dk);
  line(arcPts(0, 6, CW * 0.38, CH * 0.36, Math.PI * 1.13, Math.PI * 1.38, 6), { w: 5 + 4 * (st.dew || 0), seed: sd + 3, col: '#FFFFFF', taper: [0.4, 0.4], amp: 0.8, alpha: hl });
  if ((st.dew || 0) > 0.01) fill(ell(-CW * 0.25, -CH * 0.06, 5.5 * st.dew, 5.5 * st.dew, 6), { col: '#FFFFFF', seed: sd + 4, grain: 0, amp: 0.3 });
  // cracks heal (write-off) as the cell hydrates
  if ((st.crack || 0) > 0.01 && hash(c.id, 3) < 0.55) {
    const s = hash(c.id, 4) < 0.5 ? -1 : 1, x1 = s * CW * (0.3 + 0.1 * hash(c.id, 5));
    const P2 = [[x1, -CH / 2 + 2], [x1 + s * 12, -CH * 0.26], [x1 - s * 4, -CH * 0.12], [x1 + s * 16, CH * 0.04]];
    line(P2, { w: 4, seed: sd + 5, sharp: true, trim: [0, st.crack], taper: [0.05, 0.6], amp: 0.8 });
    if (hash(c.id, 6) < 0.5) line([[x1 + s * 12, -CH * 0.26], [x1 + s * 30, -CH * 0.3]], { w: 3, seed: sd + 6, sharp: true, trim: [0, st.crack], taper: [0.1, 0.7], amp: 0.6 });
  }
  line(P, { w: 5.6 - dk * 3, seed: sd + 7, closed: true, taper: [0, 0], alpha: 1 - dk * 0.7 });
  if (c.face && st.face) { D.push(); D.t(0, 4); face(st.face, sd + 100); D.pop(); }
  D.pop();
}

// ---------------- mortar, backing, coat ----------------
// dark crevices behind the cells
export function backing(x0 = -220, x1 = 1300) {
  const P = [];
  for (let x = x0; x <= x1; x += 60) P.push([x, ytop(x) + 26]);
  P.push([x1, 2200], [x0, 2200]);
  fill(P, { col: SK.crevice, seed: 7001, sharp: true, amp: 1, grain: 0.6 });
}
// vertical gap mortar: m = fill amount (0..1, grows from the top), blob = dollop on top (0..1)
export function gapMortar(g, m, blob = 0) {
  if (m <= 0.01 && blob <= 0.01) return;
  D.push(); D.t(g.x, g.y).r(g.a);
  if (m > 0.01) {
    const top = -CH / 2 - 8, h = (CH + 22) * m;
    fill([[-22, top], [22, top], [22, top + h], [-22, top + h]], { col: SK.mortar, seed: g.seed, sharp: true, amp: 1.2, grain: 0.35 });
  }
  if (blob > 0.01 && g.r === 0) {
    const P = ell(0, -CH / 2 - 2, 26 * blob, 17 * blob, 12);
    fill(P, { col: SK.mortar, seed: g.seed + 1, off: [3, -2], grain: 0.3 });
    line(arcPts(0, -CH / 2 - 2, 26 * blob, 17 * blob, Math.PI * 1.08, Math.PI * 1.92, 8), { w: 4.5, seed: g.seed + 2, taper: [0.2, 0.2] });
    line(arcPts(-4, -CH / 2 - 6, 12 * blob, 8 * blob, Math.PI * 1.15, Math.PI * 1.5, 4), { w: 4, seed: g.seed + 3, col: '#FFFFFF', taper: [0.3, 0.3], amp: 0.5 });
  }
  D.pop();
}
// horizontal seam mortar between row r and r+1 (filled from x1 down to xEnd: right → left)
export function seamMortar(r, xEnd, x1 = 1300) {
  if (xEnd >= x1) return;
  const P = [], Q = [];
  for (let x = x1; x >= xEnd; x -= 40) { const y = ytop(x) + (r + 1) * RP + 6; P.push([x, y - 16]); Q.push([x, y + 14]); }
  const y = ytop(xEnd) + (r + 1) * RP + 6; P.push([xEnd, y - 16]); Q.push([xEnd, y + 14]);
  fill([...P, ...Q.reverse()], { col: SK.mortar, seed: 7100 + r, sharp: true, amp: 1, grain: 0.35 });
}
// glossy sealed top coat from x1 (right) to xEnd; th thickness
export function topCoat(xEnd, x1 = 1300, o = {}) {
  if (xEnd >= x1 - 2) return;
  const th = o.th ?? 22;
  const P = [], Q = [];
  for (let x = x1; x >= xEnd; x -= 30) { P.push([x, ytop(x) - 4 + 2 * Math.sin(x * 0.02)]); Q.push([x, ytop(x) + th]); }
  P.push([xEnd, ytop(xEnd) + th * 0.3]);
  fill([...P, ...Q.reverse()], { col: SK.mortar, seed: 7200, alpha: o.alpha ?? 0.92, grain: 0.25, amp: 1.2 });
  const top = P.slice(0, -1);
  line(top, { w: 5, seed: 7201, taper: [0.02, 0.1] });
  // travelling shine on the coat
  if (o.shine !== undefined) {
    const sx = o.shine, pts = [];
    for (let x = sx + 120; x >= sx - 120; x -= 30) if (x <= x1 && x >= xEnd) pts.push([x, ytop(x) + 5]);
    if (pts.length > 1) line(pts, { w: 7, seed: 7202, col: '#FFFFFF', taper: [0.5, 0.5], amp: 0.8 });
  }
}
// a flake of dry skin peeling off the surface
export function flake(x, y, s, rot, sd, a = 1) {
  D.push(); D.t(x, y).r(rot).s(s);
  const P = [[-16, -4], [-4, -9], [14, -6], [18, 3], [2, 7], [-12, 5]];
  fill(P, { col: SK.flake, seed: sd, sharp: true, amp: 0.6, grain: 0.4, alpha: a });
  line(P, { w: 3, seed: sd + 1, closed: true, sharp: true, amp: 0.6, taper: [0, 0], alpha: a });
  D.pop();
}
// a little moisture droplet character (escaping water / hyaluronic drop)
export function droplet(x, y, r, o = {}) {
  D.push(); D.t(x, y).r(o.rot || 0);
  if (o.sx || o.sy) D.s(o.sx || 1, o.sy || 1);
  const P = [[0, -r * 1.55], [r * 0.6, -r * 0.62], [r, r * 0.12], [r * 0.72, r * 0.76], [0, r], [-r * 0.72, r * 0.76], [-r, r * 0.12], [-r * 0.6, -r * 0.62]];
  fill(P, { col: o.col || SK.water, seed: o.seed ?? 7300, off: [2, -2], grain: 0.3, amp: 0.8, alpha: o.alpha ?? 1 });
  withClip(P, { seed: o.seed ?? 7300, off: [2, -2], amp: 0.8 }, () => {
    fill(ell(r * 0.5, r * 0.55, r * 0.8, r * 0.6, 10), { col: o.sh || SK.waterSh, seed: (o.seed ?? 7300) + 1, alpha: 0.7 * (o.alpha ?? 1), grain: 0.3 });
  });
  line(P, { w: o.w ?? 4, seed: (o.seed ?? 7300) + 2, closed: true, taper: [0, 0], amp: 0.8, alpha: o.alpha ?? 1 });
  line([[-r * 0.42, -r * 0.2], [-r * 0.46, r * 0.25]], { w: Math.max(2, r * 0.2), seed: (o.seed ?? 7300) + 3, col: '#FFFFFF', amp: 0.4, alpha: o.alpha ?? 1 });
  if (o.face) {
    D.push(); D.t(r * 0.08, r * 0.28).s(r / 26);
    face(o.face, (o.seed ?? 7300) + 10, 0.42);
    D.pop();
  }
  D.pop();
}
