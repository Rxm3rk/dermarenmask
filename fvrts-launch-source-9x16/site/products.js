// Procedural 3D products (Su Boon Jo Serum, Mae Il Cream Toner, Mae Kkeun Cream)
// rendered with three.js into one shared transparent canvas. Pure: every frame
// the active shot re-poses everything, nothing animates on its own.
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

export const PACK_WORDMARK = 'fvrts';           // wordmark printed on the real packaging
const PINK = '#F6BCD0', MINT = '#7FD9C1', INK = '#151515';

const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

// ---------- geometry helpers ----------
function bottleProfile({ A, B, H, rb, rs, rn, hn, n, steps = 16 }) {
  const L = [], rbB = Math.min(rb, B * 0.9);
  for (let k = 0; k <= steps; k++) {
    const p = k / steps * Math.PI / 2;
    L.push({ y: rb * (1 - Math.cos(p)), a: A - rb * (1 - Math.sin(p)), b: B - rbB * (1 - Math.sin(p)), n });
  }
  for (let k = 0; k <= steps * 2; k++) {
    const p = k / (steps * 2) * Math.PI / 2, q = p / (Math.PI / 2);
    L.push({ y: H - rs + rs * Math.sin(p), a: rn + (A - rn) * Math.cos(p), b: rn + (B - rn) * Math.cos(p), n: n + (2 - n) * Math.pow(q, 1.4) });
  }
  L.push({ y: H + hn, a: rn, b: rn, n: 2 });
  return L;
}
function profileAt(L, y) {
  if (y <= L[0].y) return L[0];
  for (let i = 1; i < L.length; i++) if (y <= L[i].y) {
    const a = L[i - 1], b = L[i], t = (y - a.y) / Math.max(1e-6, b.y - a.y);
    return { y, a: a.a + (b.a - a.a) * t, b: a.b + (b.b - a.b) * t, n: a.n + (b.n - a.n) * t };
  }
  return L[L.length - 1];
}
function insetProfile(L, t, yTop) {
  const out = [];
  const lift = y => y + t * 0.6 * (1 - y / yTop);
  for (const l of L) { if (l.y >= yTop) break; out.push({ y: lift(l.y), a: Math.max(0.05, l.a - t), b: Math.max(0.05, l.b - t), n: l.n }); }
  const e = profileAt(L, yTop); out.push({ y: yTop, a: Math.max(0.05, e.a - t), b: Math.max(0.05, e.b - t), n: e.n });
  return out;
}
function loftGeometry(L, seg = 144, capBottom = true, capTop = true) {
  const pos = [], uv = [], idx = [], H = L[L.length - 1].y - L[0].y || 1;
  const rows = L.length, cols = seg + 1;
  for (let i = 0; i < rows; i++) {
    const { y, a, b, n } = L[i], e = 2 / n;
    for (let j = 0; j <= seg; j++) {
      const th = -Math.PI / 2 + j / seg * Math.PI * 2;
      pos.push(a * sp(Math.cos(th), e), y, b * sp(Math.sin(th), e));
      uv.push(j / seg, (y - L[0].y) / H);
    }
  }
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < seg; j++) {
    const p = i * cols + j, q = (i + 1) * cols + j;
    idx.push(p, q, p + 1, q, q + 1, p + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  for (let i = 0; i < rows; i++) {           // weld seam normals
    const a = i * cols, b = i * cols + seg, v = new THREE.Vector3(
      nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize();
    nr.setXYZ(a, v.x, v.y, v.z); nr.setXYZ(b, v.x, v.y, v.z);
  }
  const parts = [g];
  const cap = (row, up) => {
    const { y, a, b, n } = L[row], e = 2 / n, cp = [0, y, 0], cn = [0, up ? 1 : -1, 0], ci = [];
    for (let j = 0; j <= seg; j++) { const th = -Math.PI / 2 + j / seg * Math.PI * 2; cp.push(a * sp(Math.cos(th), e), y, b * sp(Math.sin(th), e)); cn.push(0, up ? 1 : -1, 0); }
    for (let j = 1; j <= seg; j++) up ? ci.push(0, j + 1, j) : ci.push(0, j, j + 1);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    cg.setAttribute('normal', new THREE.Float32BufferAttribute(cn, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((seg + 2) * 2).fill(0.5), 2));
    cg.setIndex(ci); parts.push(cg);
  };
  if (capBottom) cap(0, false);
  if (capTop) cap(rows - 1, true);
  return parts.length === 1 ? g : mergeGeoms(parts);
}
function mergeGeoms(gs) {
  const pos = [], nor = [], uv = [], idx = []; let off = 0;
  for (const g of gs) {
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
    for (const i of g.index.array) idx.push(i + off);
    off += g.attributes.position.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  m.setIndex(idx); return m;
}
// front label patch following the superellipse surface (undistorted UVs)
function labelPatch(L, { w, frac, y0, y1, off = 0.012, nx = 64, ny = 48 }) {
  const pos = [], uv = [], idx = [];
  for (let iy = 0; iy <= ny; iy++) {
    const y = y0 + (y1 - y0) * iy / ny, { a, b, n } = profileAt(L, y);
    for (let ix = 0; ix <= nx; ix++) {
      const s = ix / nx * 2 - 1, x = frac ? s * frac * a : s * w / 2;
      const r = Math.min(0.9995, Math.abs(x) / a);
      pos.push(x, y, b * Math.pow(1 - Math.pow(r, n), 1 / n) + off); uv.push(ix / nx, iy / ny);
    }
  }
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const p = iy * (nx + 1) + ix, q = p + nx + 1;
    idx.push(p, p + 1, q, p + 1, q + 1, q);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
// rounded cylinder via lathe
function roundCyl(R, h, e, seg = 96, top = true) {
  const pts = [new THREE.Vector2(0.0001, 0)];
  for (let k = 0; k <= 8; k++) { const p = k / 8 * Math.PI / 2; pts.push(new THREE.Vector2(R - e + e * Math.sin(p), e - e * Math.cos(p))); }
  if (top) for (let k = 0; k <= 8; k++) { const p = k / 8 * Math.PI / 2; pts.push(new THREE.Vector2(R - e + e * Math.cos(p), h - e + e * Math.sin(p))); }
  else pts.push(new THREE.Vector2(R, h));
  pts.push(new THREE.Vector2(0.0001, h));
  return new THREE.LatheGeometry(pts, seg);
}

// ---------- label artwork ----------
function labelCanvas(wu, hu, draw, ppu = 300, transparent = false) {
  const c = document.createElement('canvas');
  c.width = Math.round(wu * ppu); c.height = Math.round(hu * ppu);
  const g = c.getContext('2d');
  if (!transparent) { g.fillStyle = PINK; g.fillRect(0, 0, c.width, c.height); }
  g.fillStyle = INK; g.textBaseline = 'alphabetic';
  draw(g, ppu, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function txt(g, s, x, y, size, weight = 400, track = 0) {
  g.font = `${weight} ${size}px Inter`;
  if ('letterSpacing' in g) g.letterSpacing = `${track}px`;
  g.fillText(s, x, y);
}
function vertMark(g, W, H, u, size, rightPad, bottomPad) {
  g.save();
  g.font = `600 ${size}px Inter`;
  if ('letterSpacing' in g) g.letterSpacing = `${-0.03 * size}px`;
  g.translate(W - rightPad, H - bottomPad); g.rotate(-Math.PI / 2);
  g.fillText(PACK_WORDMARK, 0, 0);
  g.restore();
}
const rule = (g, x, y, w, u) => g.fillRect(x, y, w, Math.max(2, 0.012 * u));

function serumLabel() {
  return labelCanvas(3.7, 3.7, (g, u, W, H) => {
    const x = 0.28 * u;
    txt(g, 'moisturizing', x, 0.42 * u, 0.15 * u);
    txt(g, 'Su Boon Jo', x, 0.95 * u, 0.36 * u, 600, -0.01 * u);
    txt(g, 'Serum', x, 1.36 * u, 0.36 * u, 600, -0.01 * u);
    rule(g, x, 1.55 * u, 1.85 * u, u);
    txt(g, 'hydration-lock', x, 1.82 * u, 0.13 * u);
    txt(g, 'ceramide + hyaluronic acid', x, 2.0 * u, 0.13 * u);
    txt(g, 'soin barrière hydratant', x, 2.26 * u, 0.13 * u);
    txt(g, 'céramide + acide', x, 2.44 * u, 0.13 * u);
    txt(g, 'hyaluronique', x, 2.62 * u, 0.13 * u);
    txt(g, '30ml | 1.0 fl. oz.', x, H - 0.3 * u, 0.12 * u);
    vertMark(g, W, H, u, 1.32 * u, 0.22 * u, 0.22 * u);
  });
}
function tonerLabel() {
  return labelCanvas(4.7, 5.3, (g, u, W, H) => {
    const x = 0.34 * u;
    txt(g, 'moisturizing · treatment', x, 0.5 * u, 0.17 * u);
    txt(g, 'Mae Il', x, 1.2 * u, 0.44 * u, 600, -0.012 * u);
    txt(g, 'Cream Toner', x, 1.72 * u, 0.44 * u, 600, -0.012 * u);
    rule(g, x, 1.98 * u, 2.9 * u, u);
    txt(g, 'deep hydration', x, 2.3 * u, 0.16 * u);
    txt(g, 'ceramides + panthenol', x, 2.52 * u, 0.16 * u);
    txt(g, 'hydratation intense aux', x, 2.84 * u, 0.16 * u);
    txt(g, 'céramides + panthénol', x, 3.06 * u, 0.16 * u);
    txt(g, '150ml | 5.07 fl. oz.', x, H - 0.34 * u, 0.14 * u);
    vertMark(g, W, H, u, 1.5 * u, 0.26 * u, 0.3 * u);
  }, 260);
}
function tubePrint() {
  return labelCanvas(4.0, 7.8, (g, u, W, H) => {
    const x = 0.3 * u;
    g.fillStyle = INK;
    txt(g, 'moisturizing · firming', x, 0.72 * u, 0.17 * u);
    txt(g, 'Mae Kkeun', x, 1.5 * u, 0.5 * u, 600, -0.012 * u);
    txt(g, 'Cream', x, 2.06 * u, 0.5 * u, 600, -0.012 * u);
    rule(g, x, 2.32 * u, 2.4 * u, u);
    txt(g, 'moisture-binding', x, 2.66 * u, 0.16 * u);
    txt(g, 'ceramides + niacinamide', x, 2.88 * u, 0.16 * u);
    txt(g, 'céramides', x, 3.2 * u, 0.16 * u);
    txt(g, 'hydratants + niacinamide', x, 3.42 * u, 0.16 * u);
    txt(g, '50ml | 1.69 fl. oz.', x, H - 0.4 * u, 0.14 * u);
    vertMark(g, W, H, u, 1.5 * u, 0.2 * u, 0.75 * u);
  }, 240, true);
}
function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(30,40,50,0.55)'); gr.addColorStop(0.35, 'rgba(30,40,50,0.28)');
  gr.addColorStop(0.7, 'rgba(30,40,50,0.07)'); gr.addColorStop(1, 'rgba(30,40,50,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}


// ---------- flags (drawn from their official constructions) ----------
function flagKorea(W = 1500, H = 1000) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
  const R = H / 4, th = Math.atan2(H, W);
  g.save(); g.translate(W / 2, H / 2); g.rotate(th);
  const disc = (x, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, 0, r, 0, Math.PI * 2); g.fill(); };
  disc(0, R, '#0047A0');
  g.fillStyle = '#CD2E3A'; g.beginPath(); g.arc(0, 0, R, Math.PI, 0, false); g.closePath(); g.fill();
  disc(-R / 2, R / 2, '#CD2E3A'); disc(R / 2, R / 2, '#0047A0');
  g.restore();
  // trigrams: bar length H/4, bar H/24, spacing H/48, inner edge H/8 from the circle
  const L = H / 4, b = H / 24, sp = H / 48, T = 3 * b + 2 * sp, gap = H / 24, d = R + H / 8 + T / 2;
  const tri = (sx, sy, broken) => {
    const ang = Math.atan2(sy * H / 2, sx * W / 2);
    g.save(); g.translate(W / 2 + Math.cos(ang) * d, H / 2 + Math.sin(ang) * d); g.rotate(ang);
    g.fillStyle = '#000000';
    broken.forEach((br, k) => {
      const x = -T / 2 + k * (b + sp);
      if (br) { g.fillRect(x, -L / 2, b, L / 2 - gap / 2); g.fillRect(x, gap / 2, b, L / 2 - gap / 2); }
      else g.fillRect(x, -L / 2, b, L);
    });
    g.restore();
  };
  tri(-1, -1, [0, 0, 0]);   // geon ☰ top-left
  tri(1, 1, [1, 1, 1]);     // gon ☷ bottom-right
  tri(1, -1, [1, 0, 1]);    // gam ☵ top-right
  tri(-1, 1, [0, 1, 0]);    // ri ☲ bottom-left
  return c;
}
function flagKurdistan(W = 1500, H = 1000) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ED2024'; g.fillRect(0, 0, W, H / 3 + 1);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, H / 3, W, H / 3 + 1);
  g.fillStyle = '#278E43'; g.fillRect(0, 2 * H / 3, W, H / 3);
  const cx = W / 2, cy = H / 2, ro = H * 0.245, ri = H * 0.13, n = 21;
  g.fillStyle = '#FEBD11'; g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n, da = Math.PI / n;
    g.moveTo(cx + Math.cos(a - da) * ri, cy + Math.sin(a - da) * ri);
    g.lineTo(cx + Math.cos(a) * ro, cy + Math.sin(a) * ro);
    g.lineTo(cx + Math.cos(a + da) * ri, cy + Math.sin(a + da) * ri);
  }
  g.fill();
  g.beginPath(); g.arc(cx, cy, ri * 1.02, 0, Math.PI * 2); g.fill();
  return c;
}
function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

// ---------- scene ----------
export const P = {};
export async function initProducts(canvas) {
  await Promise.all(['400', '600'].map(w => document.fonts.load(`${w} 40px Inter`)));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(2);
  renderer.setSize(1080, 1920, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  scene.environmentIntensity = 0.95;

  const hemi = new THREE.HemisphereLight(0xffffff, 0xf3e6ea, 0.55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff7f0, 2.1);
  key.position.set(-7, 13, 9); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 16; key.shadow.blurSamples = 24;
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight(0xe8f6ff, 1.5); rim.position.set(8, 7, -10); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(9, 3, 8); scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: 0x1b2a33, opacity: 0.07 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // materials
  const M = {
    milk: new THREE.MeshPhysicalMaterial({ color: '#F1EFEA', roughness: 0.42, emissive: '#ffffff', emissiveIntensity: 0.06, sheen: 0.4, sheenColor: '#ffffff', sheenRoughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.06, metalness: 0, transmission: 1, thickness: 0.35, ior: 1.45, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6, transparent: true }),
    mint: new THREE.MeshPhysicalMaterial({ color: MINT, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.18, sheen: 0.2, sheenColor: '#dffcf3' }),
    pinkTube: new THREE.MeshPhysicalMaterial({ color: PINK, roughness: 0.5, clearcoat: 0.22, clearcoatRoughness: 0.45, envMapIntensity: 0.85 }),
    stem: new THREE.MeshPhysicalMaterial({ color: '#f4f7f6', roughness: 0.2, transmission: 0.6, thickness: 0.2, transparent: true }),
    dark: new THREE.MeshStandardMaterial({ color: '#244a43', roughness: 0.6 }),
    drop: new THREE.MeshPhysicalMaterial({ color: '#A6EBD6', roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.55, iridescenceIOR: 1.35, envMapIntensity: 2.1, emissive: '#3FBF9C', emissiveIntensity: 0.14, transparent: true, opacity: 0.88, sheen: 0.6, sheenColor: '#effff9' }),
    pearl: new THREE.MeshPhysicalMaterial({ color: '#fbf7f4', roughness: 0.18, clearcoat: 1, sheen: 1, sheenColor: '#ffe4ee', iridescence: 0.4, envMapIntensity: 1.4 }),
    pole: new THREE.MeshPhysicalMaterial({ color: '#fbf8f7', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.6, sheenColor: '#ffe8ef', iridescence: 0.25 }),
  };
  const labelMat = tex => new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4 });

  const cast = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; } }); return o; };

  // ---- Su Boon Jo Serum (30ml pump) ----
  function makeSerum() {
    const G = new THREE.Group();
    const L = bottleProfile({ A: 2.2, B: 1.45, H: 5.5, rb: 0.45, rs: 0.8, rn: 0.95, hn: 0.3, n: 5.5 });
    const shell = new THREE.Mesh(loftGeometry(L), M.glass); shell.renderOrder = 2; G.add(shell);
    const milk = new THREE.Mesh(loftGeometry(insetProfile(L, 0.16, 5.25)), M.milk); G.add(milk);
    const lab = new THREE.Mesh(labelPatch(L, { w: 3.7, y0: 0.62, y1: 4.32, off: 0.01 }), labelMat(serumLabel())); G.add(lab);
    const collar = new THREE.Mesh(roundCyl(1.08, 0.95, 0.16), M.mint); collar.position.y = 5.55; G.add(collar);
    const stem = new THREE.Mesh(roundCyl(0.34, 0.5, 0.05), M.stem); stem.position.y = 6.45; G.add(stem);
    const head = new THREE.Mesh(roundCyl(0.82, 1.35, 0.32), M.mint); head.position.y = 6.9; G.add(head);
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 1.4, 48), M.mint);
    noz.rotation.z = Math.PI / 2; noz.position.set(-1.05, 7.95, 0); G.add(noz);
    const tip = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), M.dark); tip.rotation.y = -Math.PI / 2; tip.position.set(-1.755, 7.95, 0); G.add(tip);
    return { group: cast(G), h: 8.25, w: 4.4 };
  }
  // ---- Mae Il Cream Toner ----
  function makeToner() {
    const G = new THREE.Group();
    const L = bottleProfile({ A: 2.85, B: 1.72, H: 9.4, rb: 0.75, rs: 1.7, rn: 1.2, hn: 0.45, n: 3.4 });
    const shell = new THREE.Mesh(loftGeometry(L), M.glass); shell.renderOrder = 2; G.add(shell);
    const milk = new THREE.Mesh(loftGeometry(insetProfile(L, 0.16, 8.35)), M.milk); G.add(milk);
    const lab = new THREE.Mesh(labelPatch(L, { w: 4.7, y0: 1.25, y1: 6.55, off: 0.01 }), labelMat(tonerLabel())); G.add(lab);
    const cap = new THREE.Mesh(roundCyl(1.62, 2.75, 0.22), M.mint); cap.position.y = 9.5; G.add(cap);
    return { group: cast(G), h: 12.25, w: 5.7 };
  }
  // ---- Mae Kkeun Cream (tube standing on its cap) ----
  function makeTube() {
    const G = new THREE.Group(), L = [], len = 9.6, y0 = 1.6;
    const sh = 10;
    for (let k = 0; k <= sh; k++) { const p = k / sh * Math.PI / 2; L.push({ y: y0 + 0.7 * (1 - Math.cos(p)), a: 1.42 + 0.66 * Math.sin(p), b: 1.42 + 0.66 * Math.sin(p), n: 2 }); }
    const N = 40;
    for (let k = 1; k <= N; k++) {
      const t = k / N, y = y0 + 0.7 + t * (len - 0.7);
      const s = t * t * (3 - 2 * t);
      L.push({ y, a: 2.08 + 0.62 * s, b: Math.max(0.07, 2.08 * Math.pow(1 - Math.pow(t, 1.35), 0.85)), n: 2 + 0.6 * t });
    }
    const body = new THREE.Mesh(loftGeometry(L, 144, false, true), M.pinkTube); G.add(body);
    const printMat = new THREE.MeshPhysicalMaterial({ map: tubePrint(), transparent: true, roughness: 0.75, specularIntensity: 0.15, envMapIntensity: 0.4, depthWrite: false });
    const print = new THREE.Mesh(labelPatch(L, { frac: 0.9, y0: y0 + 1.25, y1: y0 + len - 0.55, off: 0.012, ny: 96 }), printMat);
    G.add(print);
    const crimp = new THREE.Mesh(new THREE.BoxGeometry(2 * 2.7 + 0.12, 0.8, 0.16, 1, 1, 1), M.pinkTube);
    crimp.position.y = y0 + len + 0.35; G.add(crimp);
    for (let i = 0; i < 26; i++) {           // crimp ridges
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.7, 0.18), M.pinkTube);
      r.position.set(-2.6 + i * 0.208, y0 + len + 0.35, 0); G.add(r);
    }
    const cap = new THREE.Mesh(roundCyl(1.42, 1.62, 0.18), M.mint); G.add(cap);
    return { group: cast(G), h: y0 + len + 0.75, w: 5.5 };
  }
  // ---- droplet ----
  function dropGeom() {
    const pts = [];
    for (let k = 64; k >= 0; k--) { const t = k / 64 * Math.PI; pts.push(new THREE.Vector2(Math.max(0.0001, Math.sin(t) * Math.pow(Math.sin(t / 2), 1.25)) * 0.78, Math.cos(t))); }
    return new THREE.LatheGeometry(pts, 96);
  }

  const blobTex = blobTexture();
  const makeBlob = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = -1; scene.add(m); return m; };

  const items = { serum: makeSerum(), toner: makeToner(), tube: makeTube() };
  for (const k in items) { scene.add(items[k].group); items[k].blob = makeBlob(); }
  const dropG = dropGeom(), sphereG = new THREE.SphereGeometry(1, 64, 48);
  const drops = [];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(dropG, M.drop); m.castShadow = false; scene.add(m); drops.push(m); }
  const pearls = [];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(sphereG, M.pearl); scene.add(m); pearls.push(m); }

  // waving silk flags on slim pearl poles (flag cloth is 3 x 2 units, pole on the left edge)
  const flagCanvas = { ko: flagKorea(), ku: flagKurdistan() };
  const flags = {};
  for (const k in flagCanvas) {
    const G = new THREE.Group();
    const geo = new THREE.PlaneGeometry(3, 2, 84, 56);
    const mat = new THREE.MeshPhysicalMaterial({ map: canvasTex(flagCanvas[k]), color: '#a9a9a9', side: THREE.DoubleSide, roughness: 0.62, sheen: 0.22, sheenRoughness: 0.45, sheenColor: '#ffffff', clearcoat: 0.12, clearcoatRoughness: 0.4, envMapIntensity: 0.55, specularIntensity: 0.5 });
    const cloth = new THREE.Mesh(geo, mat); cloth.position.x = 1.5 + 0.05; G.add(cloth);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.9, 32), M.pole); pole.position.y = -0.85; G.add(pole);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 24), M.pole); knob.position.y = 1.12; G.add(knob);
    G.visible = false; scene.add(G);
    flags[k] = { group: G, cloth, base: geo.attributes.position.array.slice() };
  }
  const flagURL = { ko: flagCanvas.ko.toDataURL('image/png'), ku: flagCanvas.ku.toDataURL('image/png') };

  const camera = new THREE.PerspectiveCamera(26, 1080 / 1920, 0.5, 400);

  Object.assign(P, {
    THREE, renderer, scene, camera, items, M, drops, pearls, floor, key, flags, flagURL,
    reset() {
      for (const k in items) { items[k].group.visible = false; items[k].blob.visible = false; }
      drops.forEach(d => d.visible = false); pearls.forEach(d => d.visible = false);
      for (const k in flags) flags[k].group.visible = false;
      floor.visible = true; floor.material.opacity = 0.07;
      M.drop.color.set('#A6EBD6'); M.drop.emissive.set('#3FBF9C');
      renderer.toneMappingExposure = 1.02;
    },
    // place a product: bottom-centre at (x,y,z), rotations in degrees
    show(name, { x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1, shadow = 1 } = {}) {
      const it = items[name], g = it.group;
      g.visible = true; g.position.set(x, y, z); g.scale.setScalar(s);
      g.rotation.set(rx * Math.PI / 180, ry * Math.PI / 180, rz * Math.PI / 180, 'YXZ');
      const lift = Math.max(0, y);
      const b = it.blob; b.visible = shadow > 0.001;
      const sz = it.w * s * (1.45 + lift * 0.12);
      b.scale.set(sz, sz * 0.62, 1); b.position.set(x, 0.01, z);
      b.material.opacity = shadow * (y >= 0 ? Math.max(0, 1 - y / 9) : Math.max(0, 1 + y / 2.5));
    },
    drop(i, { x, y, z, s = 1, rx = 0, ry = 0, rz = 0, pearl = false }) {
      const m = (pearl ? pearls : drops)[i]; m.visible = true;
      m.position.set(x, y, z); m.scale.setScalar(s);
      m.rotation.set(rx * Math.PI / 180, ry * Math.PI / 180, rz * Math.PI / 180);
    },
    // flag: (x,y,z) = pole position at the cloth's vertical centre; t = frame, amp = wave strength
    flag(k, { x = 0, y = 0, z = 0, s = 1, ry = 0, rz = 0, t = 0, amp = 1 }) {
      const f = flags[k], G = f.group, pos = f.cloth.geometry.attributes.position, b = f.base;
      G.visible = true; G.position.set(x, y, z); G.scale.setScalar(s);
      G.rotation.set(0, ry * Math.PI / 180, rz * Math.PI / 180);
      for (let i = 0; i < pos.count; i++) {
        const X = b[3 * i], Y = b[3 * i + 1], u = (X + 1.5) / 3, v = (Y + 1) / 2;
        const w1 = Math.sin(u * 5.4 - t * 0.17 + v * 0.7) * (0.12 + 0.88 * u);
        const w2 = Math.sin(u * 9.5 - t * 0.26 - v * 1.9) * 0.3 * u;
        const z0 = 0.11 * amp * (w1 + w2);
        pos.setXYZ(i, X - 0.05 * amp * u * u, Y + 0.035 * amp * u * Math.sin(u * 4 - t * 0.12), z0);
      }
      pos.needsUpdate = true; f.cloth.geometry.computeVertexNormals();
    },
    // camera orbiting a target; shift = lens shift in screen px (+x right, +y down)
    cam({ tx = 0, ty = 4, tz = 0, az = 0, el = 6, dist = 60, fov = 26, roll = 0, shiftX = 0, shiftY = 0 }) {
      const a = az * Math.PI / 180, e = el * Math.PI / 180;
      camera.fov = fov;
      camera.position.set(tx + dist * Math.sin(a) * Math.cos(e), ty + dist * Math.sin(e), tz + dist * Math.cos(a) * Math.cos(e));
      camera.up.set(Math.sin(roll * Math.PI / 180), Math.cos(roll * Math.PI / 180), 0);
      camera.lookAt(tx, ty, tz);
      camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[8] = -shiftX / 540;
      camera.projectionMatrix.elements[9] = shiftY / 960;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    },
    // world units per screen px at the camera target distance
    upp(dist, fov) { return 2 * dist * Math.tan(fov * Math.PI / 360) / 1920; },
    render() { renderer.render(scene, camera); },
  });
  P.reset();
  return P;
}
