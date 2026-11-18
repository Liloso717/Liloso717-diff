'use strict';
/* ===================== IRON MERIDIAN · detailed character models ===================== */

/* ---------- environment reflections (makes leather, chrome, bronze and glass read properly) ---------- */
(function envSetup() {
  try {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#161c27'); gr.addColorStop(0.38, '#5c5058'); gr.addColorStop(0.49, '#a8876a'); gr.addColorStop(0.52, '#4a3d33'); gr.addColorStop(0.6, '#241d18'); gr.addColorStop(1, '#0d0b0a');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    const u = (Math.atan2(SUN_DIR.z, SUN_DIR.x) / (Math.PI * 2) + 0.5) * 512, v = (0.5 - Math.asin(SUN_DIR.y) / Math.PI) * 256;
    const sg = g.createRadialGradient(u, v, 2, u, v, 90); sg.addColorStop(0, 'rgba(255,236,200,1)'); sg.addColorStop(0.15, 'rgba(255,170,90,.8)'); sg.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = sg; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${200 + Math.random() * 55},${150 + Math.random() * 60},${110 + Math.random() * 50},${Math.random() * 0.12})`; g.beginPath(); g.ellipse(Math.random() * 512, 60 + Math.random() * 60, 30 + Math.random() * 70, 6 + Math.random() * 12, 0, 0, 7); g.fill(); }
    for (let i = 0; i < 5; i++) { const x = Math.random() * 512; const fg = g.createRadialGradient(x, 132, 1, x, 132, 20); fg.addColorStop(0, 'rgba(255,150,60,.7)'); fg.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = fg; g.fillRect(x - 20, 112, 40, 40); }
    g.fillStyle = 'rgba(92,170,255,.9)'; g.fillRect(150, 30, 60, 8); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(380, 20, 40, 10);
    const t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; t.colorSpace = T.SRGBColorSpace;
    const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(t).texture; pm.dispose();
    hemi.intensity = 0.5;
  } catch (e) { /* reflections are optional */ }
})();

/* ---------- procedural surface textures: colour + normal maps ---------- */
function bakeTex(S, fill, strength, rep) {
  const col = new Float32Array(S * S * 3), hgt = new Float32Array(S * S);
  fill(S, col, hgt);
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const cm = mk(), nm = mk(); const cg = cm.getContext('2d'), ng = nm.getContext('2d'); const ci = cg.createImageData(S, S), ni = ng.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = y * S + x, k4 = k * 4;
    ci.data[k4] = clamp(col[k * 3] * 255, 0, 255); ci.data[k4 + 1] = clamp(col[k * 3 + 1] * 255, 0, 255); ci.data[k4 + 2] = clamp(col[k * 3 + 2] * 255, 0, 255); ci.data[k4 + 3] = 255;
    const xl = y * S + ((x - 1 + S) % S), xr = y * S + ((x + 1) % S), yu = ((y - 1 + S) % S) * S + x, yd = ((y + 1) % S) * S + x;
    const nx = (hgt[xl] - hgt[xr]) * strength, ny = (hgt[yd] - hgt[yu]) * strength, l = Math.hypot(nx, ny, 1);
    ni.data[k4] = (nx / l * 0.5 + 0.5) * 255; ni.data[k4 + 1] = (ny / l * 0.5 + 0.5) * 255; ni.data[k4 + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[k4 + 3] = 255;
  }
  cg.putImageData(ci, 0, 0); ng.putImageData(ni, 0, 0);
  const map = new T.CanvasTexture(cm), normal = new T.CanvasTexture(nm);
  for (const t of [map, normal]) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4; }
  map.colorSpace = T.SRGBColorSpace; normal.colorSpace = T.NoColorSpace;
  return { map, normal };
}
function groove(S, col, hgt, x0, y0, x1, y1, depth, c, trim) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i++) {
    const x = ((Math.round(x0 + (x1 - x0) * i / n) % S) + S) % S, y = ((Math.round(y0 + (y1 - y0) * i / n) % S) + S) % S, k = y * S + x;
    hgt[k] -= depth; col[k * 3] *= c; col[k * 3 + 1] *= c; col[k * 3 + 2] *= c;
    if (trim) { const k2 = (((y + 1) % S) * S + ((x + 1) % S)); hgt[k2] += depth * 0.5; col[k2 * 3] = trim[0]; col[k2 * 3 + 1] = trim[1]; col[k2 * 3 + 2] = trim[2]; }
  }
}
function rectOutline(S, col, hgt, x, y, w, h, d, c, trim) { groove(S, col, hgt, x, y, x + w, y, d, c, trim); groove(S, col, hgt, x + w, y, x + w, y + h, d, c, trim); groove(S, col, hgt, x + w, y + h, x, y + h, d, c, trim); groove(S, col, hgt, x, y + h, x, y, d, c, trim); }
const TEX = {
  leather: bakeTex(512, (S, col, hgt) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const k = y * S + x; const n = vnoise(x * 0.09, y * 0.09) * 0.6 + vnoise(x * 0.33, y * 0.33) * 0.3 + Math.random() * 0.1;
      const cr = Math.abs(vnoise(x * 0.045 + 7, y * 0.045) * 2 - 1); const crease = cr < 0.06 ? -(1 - cr / 0.06) * 0.7 : 0;
      hgt[k] = n * 0.5 + crease; const b = 0.78 + n * 0.35 + crease * 0.15;
      col[k * 3] = 0.98 * b; col[k * 3 + 1] = 0.9 * b; col[k * 3 + 2] = 0.84 * b;
    }
    const tr = [1.6, 1.15, 0.65];
    for (let i = 0; i < 26; i++) { const x = Math.random() * S, y = Math.random() * S; rectOutline(S, col, hgt, x, y, 20 + Math.random() * 110, 20 + Math.random() * 140, 1.4, 0.45, Math.random() < 0.45 ? tr : null); }
    for (let i = 0; i < 30; i++) { const x = Math.random() * S, y = Math.random() * S, L = 20 + Math.random() * 120; if (Math.random() < 0.5) groove(S, col, hgt, x, y, x + L, y, 1.2, 0.5, tr); else groove(S, col, hgt, x, y, x, y + L, 1.2, 0.5, tr); }
  }, 2.2, 2),
  bronze: bakeTex(256, (S, col, hgt) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = y * S + x; const n = vnoise(x * 0.2, y * 0.2) * 0.5 + Math.random() * 0.2; hgt[k] = n * 0.2; const b = 0.85 + n * 0.25; col[k * 3] = b; col[k * 3 + 1] = b * 0.92; col[k * 3 + 2] = b * 0.85; }
    for (let i = 0; i < 18; i++) rectOutline(S, col, hgt, Math.random() * S, Math.random() * S, 10 + Math.random() * 60, 10 + Math.random() * 60, 1.5, 0.35, null);
  }, 3, 2),
  armor: bakeTex(256, (S, col, hgt) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = y * S + x; const n = vnoise(x * 0.05, y * 0.05) * 0.6 + vnoise(x * 0.5, y * 0.5) * 0.15; hgt[k] = n * 0.15; const grime = smooth(0.55, 0.85, vnoise(x * 0.03 + 4, y * 0.03)); const b = 0.92 - grime * 0.35 + n * 0.1; col[k * 3] = b; col[k * 3 + 1] = b; col[k * 3 + 2] = b * 0.98; }
    for (let i = 0; i < 9; i++) { const y = Math.random() * S; groove(S, col, hgt, 0, y, S, y, 1.6, 0.5); }
    for (let i = 0; i < 9; i++) { const x = Math.random() * S, y = Math.random() * S; groove(S, col, hgt, x, y, x, y + 40 + Math.random() * 90, 1.6, 0.5); }
    for (let i = 0; i < 70; i++) { const x = Math.random() * S, y = Math.random() * S, k = ((y | 0) * S + (x | 0)); hgt[k] += 1.2; col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = 0.6; }
    for (let i = 0; i < 60; i++) { const x = Math.random() * S, y = Math.random() * S, a = Math.random() * 6, L = 4 + Math.random() * 14; groove(S, col, hgt, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 0.4, 1.25); }
  }, 2.5, 1),
  cloth: bakeTex(128, (S, col, hgt) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = y * S + x; const w = Math.sin(x * Math.PI / 2) * 0.5 + Math.sin(y * Math.PI / 2 + Math.PI / 2) * 0.5; const n = vnoise(x * 0.1, y * 0.1); hgt[k] = w * 0.4 + n * 0.3; const b = 0.8 + n * 0.25 + w * 0.05; col[k * 3] = b; col[k * 3 + 1] = b; col[k * 3 + 2] = b; }
  }, 1.5, 3),
  skin: bakeTex(128, (S, col, hgt) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = y * S + x; const n = vnoise(x * 0.4, y * 0.4) * 0.5 + Math.random() * 0.25; hgt[k] = n * 0.25; const b = 0.9 + vnoise(x * 0.05, y * 0.05) * 0.2; col[k * 3] = b; col[k * 3 + 1] = b * 0.97; col[k * 3 + 2] = b * 0.95; }
  }, 1.2, 2),
};

/* ---------- geometry helpers ---------- */
const _eu = new T.Euler();
function xf(g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const c = g.index ? g.toNonIndexed() : g.clone();
  _eu.set(r[0], r[1], r[2]); _m.compose(_v1.set(p[0], p[1], p[2]), _q.setFromEuler(_eu), _s.set(s[0], s[1], s[2])); c.applyMatrix4(_m); return c;
}
function xfq(g, p, q, s = [1, 1, 1]) { const c = g.index ? g.toNonIndexed() : g.clone(); _m.compose(p, q, _s.set(s[0], s[1], s[2])); c.applyMatrix4(_m); return c; }
function mergeGeos(list) {
  list = list.map(g => g.index ? g.toNonIndexed() : g); // indexed parts would otherwise merge into garbage triangles
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
  for (const g of list) { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); if (g.attributes.normal) N.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2); o += c; }
  const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(P, 3)); m.setAttribute('normal', new T.BufferAttribute(N, 3)); m.setAttribute('uv', new T.BufferAttribute(U, 2)); m.computeBoundingSphere(); return m;
}
function rbox(w, h, d, r, seg = 3) {
  const g = new T.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2); const p = g.attributes.position; const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const ix = clamp(x, -hx, hx), iy = clamp(y, -hy, hy), iz = clamp(z, -hz, hz); _v1.set(x - ix, y - iy, z - iz); const l = _v1.length(); if (l > 1e-6) { _v1.multiplyScalar(r / l); p.setXYZ(i, ix + _v1.x, iy + _v1.y, iz + _v1.z); } }
  g.computeVertexNormals(); return g;
}
const lathe = (pts, seg = 16, ps = 0, pl = Math.PI * 2) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), seg, ps, pl);
function limb(a, b, r0, r1, seg = 10) { _v2.subVectors(b, a); const L = _v2.length(); const g = new T.CylinderGeometry(r1, r0, L, seg); _q.setFromUnitVectors(UP, _v2.normalize()); return xfq(g, _v3.addVectors(a, b).multiplyScalar(0.5), _q); }
function tube(pts, r, segs = 12, rad = 5) { return new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new V3(p[0], p[1], p[2]))), segs, r, rad, false); }
const V = (x, y, z) => new V3(x, y, z);
function bucket() { const b = {}; b.add = (k, g) => { (b[k] = b[k] || []).push(g); }; return b; }
function bakeInto(group, b, mats, shadowKeys) { for (const k of Object.keys(b)) { if (k === 'add' || !b[k].length) continue; const mesh = new T.Mesh(mergeGeos(b[k]), mats[k]); mesh.castShadow = !shadowKeys || shadowKeys.includes(k); mesh.receiveShadow = true; group.add(mesh); } }

/* ---------- rim / sheen: a fresnel lift baked into the material so silhouettes separate from the ground ---------- */
function rimLight(mat, col, k, pw = 3) {
  const c = `vec3(${col.map(v => v.toFixed(3)).join(',')})`, key = 'rim' + c + k + pw;
  mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { float rimF = pow( 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 ), ${pw.toFixed(1)} ); totalEmissiveRadiance += ${c} * rimF * ${k.toFixed(3)}; }`); };
  mat.customProgramCacheKey = () => key; return mat;
}
/* ---------- the Commander's cape: oxblood wool, bronze-embroidered hem and the Meridian sigil ---------- */
const CAPE_TEX = (() => {
  const W = 256, Hh = 512, band = 30, y0 = Hh - band;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = Hh; return c; };
  const shapes = (g, metal, lining) => { // the bronze parts, drawn identically into colour and pbr maps
    const br = (y, h) => { if (metal) { g.fillStyle = metal; g.fillRect(0, y, W, h); return; } const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#e8b872'); gr.addColorStop(0.5, '#b07a3c'); gr.addColorStop(1, '#6a4420'); g.fillStyle = gr; g.fillRect(0, y, W, h); };
    br(y0, band); br(y0 - 11, 4);
    if (!metal) { g.fillStyle = '#4a2a10'; g.fillRect(0, y0 + 3, W, 2); g.fillRect(0, Hh - 6, W, 2); for (let x = 0; x < W; x += 16) { g.beginPath(); g.moveTo(x, y0 + 17); g.lineTo(x + 8, y0 + 9); g.lineTo(x + 16, y0 + 17); g.lineTo(x + 8, y0 + 25); g.closePath(); g.fill(); } g.fillStyle = '#f0c888'; for (let x = 8; x < W; x += 16) g.fillRect(x - 1, y0 + 16, 2, 2); }
    if (lining) return;
    const cx = W / 2, cy = Hh * 0.34; g.strokeStyle = metal || '#c08a48'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, 44, 0, 7); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy, 16, 44, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(cx - 44, cy); g.lineTo(cx + 44, cy); g.stroke();
    g.fillStyle = metal || '#d8a060'; g.beginPath(); g.moveTo(cx, cy - 70); g.lineTo(cx + 9, cy - 54); g.lineTo(cx, cy - 50); g.lineTo(cx - 9, cy - 54); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx - 30, cy + 62); g.lineTo(cx, cy + 80); g.lineTo(cx + 30, cy + 62); g.lineTo(cx + 30, cy + 70); g.lineTo(cx, cy + 88); g.lineTo(cx - 30, cy + 70); g.closePath(); g.fill();
  };
  const colour = lining => { const c = mk(), g = c.getContext('2d'); const id = g.createImageData(W, Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; const n = vnoise(x * 0.05, y * 0.012) * 0.5 + vnoise(x * 0.3, y * 0.3) * 0.25 + ((x + y) % 3 === 0 ? 0.06 : 0); const top = 0.72 + 0.28 * smooth(0, 120, y);
      const b = (0.7 + n * 0.45) * top; id.data[k] = (lining ? 120 : 88) * b; id.data[k + 1] = (lining ? 26 : 22) * b; id.data[k + 2] = (lining ? 22 : 20) * b; id.data[k + 3] = 255; }
    g.putImageData(id, 0, 0); shapes(g, null, lining); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
  const pbr = lining => { const c = mk(), g = c.getContext('2d'); g.fillStyle = lining ? 'rgb(0,150,20)' : 'rgb(0,225,6)'; g.fillRect(0, 0, W, Hh); shapes(g, 'rgb(0,90,240)', lining); const t = new T.CanvasTexture(c); t.anisotropy = 4; return t; };
  return { out: colour(false), outPbr: pbr(false), lin: colour(true), linPbr: pbr(true) };
})();
/* ---------- commander (player hero) materials ---------- */
const RIM_WARM = [0.95, 0.62, 0.38];
const HMAT = {
  leather: rimLight(std(0x4e2f1f, 0.5, 0.04, { map: TEX.leather.map, normalMap: TEX.leather.normal, normalScale: new T.Vector2(1.2, 1.2) }), RIM_WARM, 0.2),
  leatherDS: rimLight(std(0x44281a, 0.54, 0.04, { map: TEX.leather.map, normalMap: TEX.leather.normal, side: T.DoubleSide }), RIM_WARM, 0.2),
  leatherDark: rimLight(std(0x26170f, 0.44, 0.06, { map: TEX.leather.map, normalMap: TEX.leather.normal }), RIM_WARM, 0.16),
  bronze: std(0xb98446, 0.3, 0.92, { map: TEX.bronze.map, normalMap: TEX.bronze.normal }),
  black: rimLight(std(0x0f0d0c, 0.34, 0.25, { normalMap: TEX.leather.normal }), RIM_WARM, 0.14),
  trousers: rimLight(std(0x2e2c29, 0.86, 0.0, { map: TEX.cloth.map, normalMap: TEX.cloth.normal }), RIM_WARM, 0.16),
  skin: std(0x5b3424, 0.48, 0.02, { map: TEX.skin.map, normalMap: TEX.skin.normal }),
  teeth: std(0xf7f4ee, 0.14, 0.05),
  hair: std(0x100c0a, 0.7, 0.05, { normalMap: TEX.cloth.normal }),
  ice: std(0xf4f1ea, 0.08, 1.0),
  gold: std(0xd0a258, 0.28, 0.95),
  glass: std(0x030304, 0.03, 1.0),
  steel: std(0xc9ccd0, 0.18, 1.0),
  capeOut: rimLight(std(0xffffff, 1, 1, { map: CAPE_TEX.out, roughnessMap: CAPE_TEX.outPbr, metalnessMap: CAPE_TEX.outPbr, normalMap: TEX.cloth.normal, normalScale: new T.Vector2(0.6, 0.6) }), [0.85, 0.3, 0.2], 0.3, 2.5),
  capeIn: std(0xffffff, 1, 1, { side: T.BackSide, map: CAPE_TEX.lin, roughnessMap: CAPE_TEX.linPbr, metalnessMap: CAPE_TEX.linPbr, normalMap: TEX.cloth.normal, normalScale: new T.Vector2(0.4, 0.4) }),
  blade: basic(new T.Color(2.4, 3.2, 4.6)),
  bladeGlow: addMat(0x2f7bff, 0.55), bladeGlow2: addMat(0x1846ff, 0.2),
  baseMetal: std(0x1a1715, 0.4, 0.8, { map: TEX.bronze.map, normalMap: TEX.bronze.normal }),
};

function buildHeroModel() {
  const root = new T.Group(), body = new T.Group(); root.add(body);
  const M = HMAT; const zs = 0.68;
  /* --- torso, coat, belt, chain (static) --- */
  const b = bucket();
  b.add('leather', xf(lathe([[0.158, 0.95], [0.172, 1.03], [0.19, 1.15], [0.222, 1.32], [0.232, 1.44], [0.205, 1.54], [0.12, 1.62], [0.065, 1.66]], 24), [0, 0, 0], [0, 0, 0], [1, 1, zs]));
  // back yoke: a stitched leather panel across the shoulder blades with bronze piping
  b.add('leatherDark', xf(lathe([[0.226, 1.36], [0.234, 1.44], [0.21, 1.53]], 18, Math.PI * 0.62, Math.PI * 0.76), [0, 0, -0.004], [0, 0, 0], [1.02, 1, zs + 0.03]));
  b.add('bronze', tube([-0.6, -0.3, 0, 0.3, 0.6].map(a => [Math.sin(Math.PI + a) * 0.232, 1.36 + Math.abs(a) * 0.06, Math.cos(Math.PI + a) * 0.232 * (zs + 0.035)]), 0.005, 16, 4));
  for (const sx of [-1, 1]) { // lapels with bronze piping
    b.add('leatherDark', xf(rbox(0.09, 0.34, 0.025, 0.01, 2), [sx * 0.07, 1.42, 0.135], [0.12, sx * 0.25, sx * 0.32]));
    b.add('bronze', tube([[sx * 0.025, 1.6, 0.13], [sx * 0.07, 1.48, 0.15], [sx * 0.11, 1.3, 0.145], [sx * 0.105, 1.05, 0.13]], 0.006, 14, 4));
    b.add('bronze', tube([[sx * 0.04, 1.2, 0.143], [sx * 0.06, 1.12, 0.14], [sx * 0.06, 1.0, 0.13]], 0.005, 8, 4));
  }
  b.add('black', xf(new T.CylinderGeometry(0.188, 0.185, 0.075, 28, 1, true), [0, 1.0, 0], [0, 0, 0], [1, 1, zs + 0.03]));
  b.add('bronze', xf(rbox(0.07, 0.06, 0.02, 0.008, 2), [0, 1.0, 0.13]));
  for (const sx of [-1, 1]) b.add('leatherDark', xf(rbox(0.07, 0.09, 0.05, 0.01, 2), [sx * 0.15, 0.99, 0.08], [0, sx * 0.5, 0]));
  for (const sx of [-1, 1]) { // layered bronze pauldrons over leather: the broad shoulders that carry the silhouette
    const P = [sx * 0.268, 1.552, -0.008], rz = -sx * 0.34, S = [1, 0.7, 1.12];
    b.add('leatherDark', xf(new T.SphereGeometry(0.152, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), [P[0], P[1] - 0.03, P[2]], [0, 0, rz], [1.04, 0.64, 1.14]));
    b.add('bronze', xf(new T.SphereGeometry(0.142, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), P, [0, 0, rz], S));
    b.add('gold', xf(xf(new T.TorusGeometry(0.137, 0.0075, 5, 32), [0, 0.034, 0], [Math.PI / 2, 0, 0]), P, [0, 0, rz], S));
    b.add('bronze', xf(xf(rbox(0.02, 0.026, 0.25, 0.009, 1), [0, 0.138, 0]), P, [0, 0, rz], S));
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3; b.add('gold', xf(xf(new T.SphereGeometry(0.0085, 6, 4), [Math.cos(a) * 0.129, 0.05, Math.sin(a) * 0.129]), P, [0, 0, rz], S)); }
    for (let i = 1; i <= 2; i++) { // lames stepping down the upper arm
      b.add('bronze', xf(new T.CylinderGeometry(0.124 + i * 0.012, 0.14 + i * 0.013, 0.052, 22, 1, true), [P[0] + sx * (0.022 + i * 0.026), P[1] - 0.032 - i * 0.044, P[2]], [0, 0, rz - sx * 0.1 * i], [1, 1, 1.1]));
      b.add('gold', xf(new T.TorusGeometry(0.14 + i * 0.013, 0.0045, 4, 26), [P[0] + sx * (0.022 + i * 0.026), P[1] - 0.058 - i * 0.044, P[2]], [Math.PI / 2, 0, rz - sx * 0.1 * i], [1, 1.1, 1]));
    }
    // cape clasp at the collarbone
    b.add('gold', xf(new T.CylinderGeometry(0.03, 0.03, 0.012, 16), [sx * 0.15, 1.585, 0.085], [Math.PI / 2 - 0.5, 0, 0]));
    b.add('bronze', xf(new T.TorusGeometry(0.031, 0.006, 5, 16), [sx * 0.15, 1.585, 0.09], [-0.5, 0, 0]));
  }
  b.add('gold', tube([[-0.15, 1.585, 0.1], [0, 1.555, 0.135], [0.15, 1.585, 0.1]], 0.004, 10, 4));
  b.add('leatherDS', lathe([[0.1, 1.6], [0.125, 1.68], [0.16, 1.76], [0.19, 1.8]], 22, 0.55, Math.PI * 2 - 1.1));
  b.add('bronze', tube([[0.19 * Math.sin(0.55), 1.8, 0.19 * Math.cos(0.55)], [0.19 * Math.sin(Math.PI), 1.8, -0.19], [-0.19 * Math.sin(0.55), 1.8, 0.19 * Math.cos(0.55)]], 0.006, 18, 4));
  // chain of iced links
  { const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, th = lerp(-1.35, 1.35, t); const f = 1 - Math.abs(th) / 1.35; pts.push(V(Math.sin(th) * 0.17, 1.62 - Math.pow(f, 1.3) * 0.25, Math.cos(th) * 0.12 + 0.04 + f * 0.03)); }
    const curve = new T.CatmullRomCurve3(pts); const link = new T.TorusGeometry(0.022, 0.0085, 6, 12);
    for (let i = 0; i < 30; i++) { const t = i / 29; const p = curve.getPoint(t), tg = curve.getTangent(t); _q.setFromUnitVectors(V(1, 0, 0), tg); if (i % 2) _q2.setFromAxisAngle(V(1, 0, 0), Math.PI / 2); else _q2.identity(); _q.multiply(_q2); b.add('ice', xfq(link, p, _q)); } }
  b.add('ice', xf(new T.TorusGeometry(0.02, 0.008, 6, 12), [0, 1.36, 0.19], [0, 0, 0]));
  b.add('ice', xf(rbox(0.13, 0.17, 0.028, 0.012, 2), [0, 1.24, 0.2]));
  b.add('ice', xf(new T.SphereGeometry(0.045, 14, 12), [0, 1.25, 0.21], [0, 0, 0], [0.85, 1.15, 0.5]));
  b.add('black', xf(rbox(0.06, 0.014, 0.01, 0.004, 1), [0, 1.27, 0.232]));
  b.add('teeth', xf(rbox(0.04, 0.008, 0.008, 0.003, 1), [0, 1.23, 0.235]));
  for (let i = 0; i < 16; i++) { const x = -0.07 + i * 0.0093; const len = 0.12 + Math.sin(i * 1.7) * 0.03 + 0.05 * (1 - Math.abs(x) / 0.07); b.add('gold', tube([[x * 0.8, 1.33, 0.205], [x, 1.25, 0.215], [x * 1.05, 1.33 - len, 0.21]], 0.0055, 6, 4)); }
  bakeInto(body, b, M, ['leather', 'leatherDark', 'leatherDS', 'black']);
  /* --- coat skirt, open at the front, swings while walking --- */
  const skirt = new T.Group(); skirt.position.y = 0.99; body.add(skirt);
  { // four tails: hip slits so the legs read in profile, a rear vent so they read from behind
    const sb = bucket(), zk = 0.8;
    for (const [a0, a1, L] of [[0.3, 1.42, 0.46], [1.64, 3.06, 0.53], [3.22, 4.64, 0.53], [4.86, 5.98, 0.46]]) {
      const prof = [[0.19, 0], [0.213, -0.12], [0.245, -0.27], [0.28, -L + 0.07], [0.293, -L]];
      sb.add('leatherDS', xf(lathe(prof, 10, a0, a1 - a0), [0, 0, 0], [0, 0, 0], [1, 1, zk]));
      const edge = phi => prof.map(([r, y]) => [Math.sin(phi) * r * 1.008, y, Math.cos(phi) * r * zk * 1.008]);
      sb.add('bronze', tube(edge(a0), 0.0055, 8, 4)); sb.add('bronze', tube(edge(a1), 0.0055, 8, 4));
      const hem = []; for (let i = 0; i <= 8; i++) { const ph = lerp(a0, a1, i / 8); hem.push([Math.sin(ph) * 0.295, -L + 0.004, Math.cos(ph) * 0.295 * zk]); } sb.add('bronze', tube(hem, 0.0075, 16, 4));
      const mid = (a0 + a1) / 2; sb.add('bronze', tube(prof.slice(1, 4).map(([r, y]) => [Math.sin(mid) * r * 1.01, y, Math.cos(mid) * r * zk * 1.01]), 0.003, 6, 3));
    }
    bakeInto(skirt, sb, M, ['leatherDS']); }
  /* --- head --- */
  const head = new T.Group(); head.position.set(0, 1.68, 0.01); body.add(head);
  { const hb = bucket();
    const face = new T.SphereGeometry(0.112, 30, 22); const p = face.attributes.position;
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); y *= 1.2; if (y < 0) { const k = -y / 0.134; x *= 1 - k * 0.32; z *= 1 - k * 0.1; if (z > 0) z += k * 0.012; } if (z < 0) z *= 1.1; if (z > 0.05 && Math.abs(y) < 0.03) z += 0.006 * (1 - Math.abs(y) / 0.03); if (z > 0.06 && y > 0.02 && y < 0.05) z += 0.008; p.setXYZ(i, x, y, z); }
    face.computeVertexNormals(); hb.add('skin', xf(face, [0, 0.16, 0]));
    hb.add('skin', xf(new T.CylinderGeometry(0.06, 0.068, 0.12, 14), [0, 0.03, -0.01]));
    hb.add('skin', xf(new T.ConeGeometry(0.02, 0.048, 10), [0, 0.165, 0.118], [Math.PI / 2 - 0.35, 0, 0], [1.25, 1, 1]));
    hb.add('skin', xf(new T.SphereGeometry(0.017, 10, 8), [0, 0.15, 0.123], [0, 0, 0], [1.6, 0.85, 1]));
    for (const sx of [-1, 1]) hb.add('skin', xf(new T.SphereGeometry(0.024, 10, 8), [sx * 0.104, 0.165, -0.005], [0, 0, 0], [0.45, 1, 0.75]));
    hb.add('skin', xf(new T.TorusGeometry(0.036, 0.0085, 6, 18, Math.PI), [0, 0.117, 0.098], [Math.PI + 0.25, 0, 0], [1.15, 0.75, 1]));
    hb.add('teeth', xf(new T.CylinderGeometry(0.052, 0.052, 0.018, 18, 1, false, -0.62, 1.24), [0, 0.112, 0.055]));
    hb.add('hair', xf(rbox(0.05, 0.024, 0.03, 0.01, 2), [0, 0.072, 0.105]));
    hb.add('hair', xf(rbox(0.065, 0.008, 0.012, 0.004, 1), [0, 0.137, 0.118], [0, 0, 0]));
    for (const sx of [-1, 1]) { hb.add('glass', xf(new T.CylinderGeometry(0.035, 0.032, 0.008, 22), [sx * 0.044, 0.188, 0.117], [Math.PI / 2, 0, sx * -0.05], [1.3, 1, 1])); hb.add('steel', xf(rbox(0.009, 0.008, 0.11, 0.003, 1), [sx * 0.098, 0.192, 0.065], [0, sx * -0.08, 0])); }
    hb.add('steel', xf(rbox(0.03, 0.006, 0.006, 0.002, 1), [0, 0.2, 0.123]));
    hb.add('steel', xf(rbox(0.165, 0.006, 0.006, 0.002, 1), [0, 0.215, 0.118]));
    // fedora: pinched crown, side-curled brim, band
    const hat = lathe([[0.315, 0], [0.31, 0.008], [0.2, 0.012], [0.165, 0.016], [0.168, 0.1], [0.155, 0.155], [0.1, 0.175], [0.03, 0.172], [0, 0.165]], 32); const hp = hat.attributes.position;
    for (let i = 0; i < hp.count; i++) { let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i) * 1.12; const r = Math.hypot(x, z); if (r > 0.2) y += Math.pow(Math.abs(x) / 0.315, 3) * 0.05 - (z > 0 ? 0.012 : 0); if (y > 0.09 && z > 0.05) x *= 0.86; if (y > 0.15) y -= Math.abs(x) * 0.1; hp.setXYZ(i, x, y, z); }
    hat.computeVertexNormals(); hb.add('black', xf(hat, [0, 0.265, -0.005], [-0.06, 0, 0]));
    hb.add('leatherDark', xf(new T.CylinderGeometry(0.17, 0.17, 0.035, 30, 1, true), [0, 0.3, -0.005], [-0.06, 0, 0], [1, 1, 1.12]));
    bakeInto(head, hb, M, ['skin', 'black']); }
  // locs: three swaying bundles of rope-twisted dreads
  const locs = [];
  for (const side of ['L', 'R', 'B']) {
    const g = new T.Group(); g.position.set(0, 0.26, 0); head.add(g); const lb = bucket();
    for (let i = 0; i < 46; i++) {
      const a = Math.PI * 0.2 + (i / 45) * Math.PI * 1.6; const s = Math.sin(a), c = Math.cos(a);
      const grp = s > 0.35 ? 'L' : s < -0.35 ? 'R' : 'B'; if (grp !== side) continue;
      const front = c > 0.1; const len = front ? rand(0.36, 0.5) : rand(0.42, 0.62); const j = () => rand(-0.012, 0.012);
      const pts = [[s * 0.118, -0.04, c * 0.11 - 0.01], [s * 0.15 + j(), -0.12, c * 0.13 + j()], [s * (0.175 + (front ? 0.02 : 0)) + j(), -0.24, c * (front ? 0.17 : 0.15) + j()], [s * (0.19 + (front ? 0.01 : 0.02)) + j(), -0.04 - len, c * (front ? 0.2 : 0.17) + j()]];
      lb.add('hair', tube(pts, rand(0.011, 0.015), 12, 5));
      if (i % 5 === 0) { const p = pts[3]; lb.add('gold', xf(new T.CylinderGeometry(0.016, 0.016, 0.02, 10), [p[0], p[1] + 0.06, p[2]])); }
    }
    bakeInto(g, lb, M, []); g.userData.ph = side === 'L' ? 0 : side === 'R' ? 2 : 4; locs.push(g);
  }
  /* --- legs: flared trousers, knee panels, boots --- */
  const legs = [];
  for (const sx of [-1, 1]) {
    const thigh = new T.Group(); thigh.position.set(sx * 0.105, 0.98, 0); body.add(thigh);
    const tb = bucket(); tb.add('trousers', xf(lathe([[0.1, 0.03], [0.106, -0.08], [0.098, -0.28], [0.087, -0.44], [0.082, -0.5]], 16), [0, 0, 0], [0, 0, 0], [1, 1, 0.92]));
    tb.add('bronze', tube([[sx * 0.098, -0.03, 0.0], [sx * 0.102, -0.25, 0.0], [sx * 0.088, -0.46, 0.0]], 0.0035, 8, 3)); bakeInto(thigh, tb, M, ['trousers']);
    const shin = new T.Group(); shin.position.y = -0.47; thigh.add(shin);
    const sb = bucket(); // knee-high riding boot with a bronze knee cop and buckled straps
    sb.add('black', lathe([[0.097, 0.04], [0.1, 0.0], [0.093, -0.09], [0.086, -0.2], [0.076, -0.34], [0.071, -0.42], [0.074, -0.45]], 18));
    sb.add('black', xf(new T.CylinderGeometry(0.104, 0.098, 0.03, 18, 1, true), [0, 0.035, 0]));
    sb.add('leatherDark', xf(rbox(0.13, 0.13, 0.03, 0.012, 2), [0, 0.0, 0.08], [-0.12, 0, 0]));
    sb.add('bronze', xf(new T.SphereGeometry(0.066, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), [0, 0.0, 0.085], [Math.PI / 2 - 0.12, 0, 0], [1, 1.12, 0.55]));
    sb.add('bronze', xf(new T.TorusGeometry(0.064, 0.005, 4, 20), [0, 0.0, 0.088], [-0.12, 0, 0], [1, 1.12, 1]));
    for (const y of [-0.17, -0.31]) { const r = y < -0.2 ? 0.08 : 0.089; sb.add('leatherDark', xf(new T.TorusGeometry(r, 0.0085, 4, 22), [0, y, 0], [Math.PI / 2, 0, 0])); sb.add('bronze', xf(rbox(0.026, 0.03, 0.012, 0.004, 1), [sx * r * 0.82, y, r * 0.55], [0, sx * 0.95, 0])); }
    sb.add('black', xf(rbox(0.105, 0.08, 0.26, 0.035, 2), [0, -0.452, 0.04]));
    sb.add('leatherDark', xf(rbox(0.116, 0.024, 0.278, 0.01, 1), [0, -0.49, 0.042])); sb.add('leatherDark', xf(rbox(0.1, 0.045, 0.07, 0.01, 1), [0, -0.468, -0.055]));
    sb.add('bronze', xf(rbox(0.09, 0.012, 0.04, 0.005, 1), [0, -0.432, 0.16], [0.35, 0, 0]));
    bakeInto(shin, sb, M, ['black']); legs.push({ thigh, shin });
  }
  /* --- arms: right arm grips the energy blade, left has the wrist blaster --- */
  const arms = [];
  const gloveFingers = (hb, grip) => {
    hb.add('black', xf(rbox(0.075, 0.085, 0.034, 0.012, 2), [0, -0.05, 0]));
    for (let f = 0; f < 4; f++) { const x = -0.027 + f * 0.018; if (grip) hb.add('black', xf(new T.TorusGeometry(0.02, 0.0085, 6, 10, Math.PI * 1.3), [x, -0.1, 0.008], [0, Math.PI / 2, Math.PI * 0.85])); else { hb.add('black', xf(new T.CylinderGeometry(0.0085, 0.0085, 0.05, 6), [x, -0.115, 0.004], [0.12, 0, 0])); hb.add('black', xf(new T.CylinderGeometry(0.008, 0.0078, 0.035, 6), [x, -0.155, 0.016], [0.45, 0, 0])); } }
    hb.add('black', xf(new T.CylinderGeometry(0.01, 0.009, 0.05, 6), [0.04, -0.06, 0.02], [0.4, 0, 0.6]));
  };
  for (const sx of [1, -1]) {
    const sh = new T.Group(); sh.position.set(sx * 0.255, 1.52, 0); body.add(sh);
    const ub = bucket(); ub.add('leather', lathe([[0.072, 0.02], [0.078, -0.08], [0.07, -0.2], [0.062, -0.29]], 14)); bakeInto(sh, ub, M, ['leather']);
    const el = new T.Group(); el.position.y = -0.29; sh.add(el);
    const fb = bucket();
    fb.add('leatherDark', lathe([[0.06, 0.01], [0.072, -0.05], [0.074, -0.12], [0.07, -0.2], [0.058, -0.26]], 16));
    for (const y of [-0.04, -0.12, -0.2]) fb.add('bronze', xf(new T.TorusGeometry(0.073, 0.006, 5, 22), [0, y, 0], [Math.PI / 2, 0, 0]));
    fb.add('bronze', xf(rbox(0.07, 0.14, 0.02, 0.008, 2), [0, -0.12, 0.068]));
    fb.add('black', xf(rbox(0.04, 0.05, 0.012, 0.004, 1), [0, -0.12, 0.08]));
    if (sx < 0) { fb.add('steel', xf(new T.CylinderGeometry(0.014, 0.016, 0.1, 10), [0, -0.17, 0.09], [Math.PI / 2, 0, 0])); fb.add('blade', xf(new T.CylinderGeometry(0.008, 0.008, 0.012, 8), [0, -0.17, 0.142], [Math.PI / 2, 0, 0])); }
    const hand = new T.Group(); hand.position.y = -0.27; el.add(hand); const hb2 = bucket(); gloveFingers(hb2, sx > 0); bakeInto(hand, hb2, M, []);
    bakeInto(el, fb, M, ['leatherDark']);
    arms.push({ sh, el, hand });
  }
  // energy blade
  const hilt = new T.Group(); hilt.position.set(0, -0.1, 0.012); hilt.rotation.x = 1.75; arms[0].hand.add(hilt);
  { const kb = bucket();
    kb.add('steel', new T.CylinderGeometry(0.022, 0.024, 0.26, 16));
    for (let i = 0; i < 7; i++) kb.add('black', xf(new T.TorusGeometry(0.024, 0.004, 5, 16), [0, -0.09 + i * 0.022, 0], [Math.PI / 2, 0, 0]));
    kb.add('bronze', xf(new T.CylinderGeometry(0.032, 0.026, 0.06, 16), [0, 0.15, 0])); kb.add('steel', xf(new T.CylinderGeometry(0.026, 0.032, 0.02, 16), [0, 0.19, 0]));
    kb.add('bronze', xf(new T.CylinderGeometry(0.02, 0.028, 0.035, 12), [0, -0.145, 0])); kb.add('black', xf(rbox(0.012, 0.03, 0.01, 0.003, 1), [0.025, 0.06, 0]));
    kb.add('blade', xf(rbox(0.008, 0.012, 0.004, 0.002, 1), [0.03, 0.06, 0])); bakeInto(hilt, kb, M, ['steel']); }
  const blade = new T.Group(); blade.position.y = 0.2; hilt.add(blade);
  blade.add(new T.Mesh(xf(new T.CylinderGeometry(0.016, 0.019, 1.0, 10), [0, 0.5, 0]), M.blade));
  blade.add(new T.Mesh(xf(new T.SphereGeometry(0.016, 10, 8), [0, 1.0, 0]), M.blade));
  blade.add(new T.Mesh(xf(new T.CylinderGeometry(0.05, 0.06, 1.06, 12, 1, true), [0, 0.52, 0]), M.bladeGlow));
  blade.add(new T.Mesh(xf(new T.CylinderGeometry(0.12, 0.13, 1.12, 12, 1, true), [0, 0.54, 0]), M.bladeGlow2));
  /* --- cloth cape --- */
  const cape = new T.Group(); cape.position.set(0, 1.6, -0.07); body.add(cape);
  const cw = 20, ch = 14; const capeGeo = new T.PlaneGeometry(1, 1, cw, ch);
  const cm1 = new T.Mesh(capeGeo, M.capeOut), cm2 = new T.Mesh(capeGeo, M.capeIn); cm1.castShadow = true; cape.add(cm1, cm2); cm1.frustumCulled = cm2.frustumCulled = false;
  const capeUV = []; for (let j = 0; j <= ch; j++) for (let i = 0; i <= cw; i++) capeUV.push([i / cw, j / ch]);
  const parts = { root, body, skirt, head, locs, legs, arms, hilt, blade, cape, capeGeo, capeUV, breath: 0, phase: 0 };
  updateCape(parts, 0, 0); return parts;
}
function updateCape(H, speed, dt) {
  // hangs from under the pauldrons to just above the knee: hugs the back, gathers into folds, flares at the hem
  /* everything that depends only on the vertex is worked out once into flat arrays; the per-frame loop reads those and
     writes straight into the position buffer, so it makes no garbage (it used to make ~90 KB a frame) */
  let C = H.capeC;
  if (!C) { const n = H.capeUV.length; C = H.capeC = { n, u: new Float32Array(n), v: new Float32Array(n), sph: new Float32Array(n), cph: new Float32Array(n), r: new Float32Array(n), zk: new Float32Array(n), y0: new Float32Array(n), vv: new Float32Array(n) };
    for (let k = 0; k < n; k++) { const u = H.capeUV[k][0], v = H.capeUV[k][1], vv = v * v, cu = u * 2 - 1, ph = lerp(1.25, -1.25, u) * (1 - v * 0.17); /* this direction keeps the wool facing out */
      const fold = Math.sin(u * 18.85 + 0.6) * (0.004 + 0.026 * v) + Math.sin(u * 7.3 + 1.1) * 0.01 * v, r = lerp(0.2, 0.31, Math.pow(v, 0.8)) + fold;
      C.u[k] = u; C.v[k] = v; C.vv[k] = vv; C.sph[k] = Math.sin(ph) * r * 1.22; C.cph[k] = -Math.cos(ph) * r * lerp(0.42, 0.74, v) - v * 0.07; C.y0[k] = -v * 1.02 - vv * vv * 0.05 * (1 - cu * cu); } }
  const a = H.capeGeo.attributes.position.array, sp = Math.min(1, speed / 7), n = C.n, U = C.u, V = C.v, VV = C.vv, SP = C.sph, CP = C.cph, Y0 = C.y0;
  const w1 = TIME * (2.2 + sp * 5), w2 = TIME * 1.3, w3 = TIME * 1.7, amp = 0.018 + sp * 0.05, lift = sp * 0.34, drag = sp * 0.72;
  for (let k = 0, o = 0; k < n; k++, o += 3) {
    const u = U[k], v = V[k], vv = VV[k];
    const wave = Math.sin(w1 + v * 4.5 + u * 6) * amp * v + Math.sin(w2 + u * 3) * 0.01 * v;
    a[o] = SP[k] + Math.sin(w3 + v * 3) * 0.012 * v; a[o + 1] = Y0[k] + vv * lift; a[o + 2] = CP[k] - vv * drag - wave;
  }
  H.capeGeo.attributes.position.needsUpdate = true;
  if (!(typeof LOW_END !== 'undefined' && LOW_END) || (H.nf = (H.nf || 0) + 1) % 2 === 0) capeNormals(H.capeGeo); /* phones: the cape's lighting every other frame */
}
function capeNormals(g) { /* the same smooth normals three.js would compute, on the raw arrays: no garbage */
  const p = g.attributes.position.array, nA = g.attributes.normal, n = nA.array, ix = g.index.array; n.fill(0);
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
    const cbx = p[c] - p[b], cby = p[c + 1] - p[b + 1], cbz = p[c + 2] - p[b + 2], abx = p[a] - p[b], aby = p[a + 1] - p[b + 1], abz = p[a + 2] - p[b + 2];
    const nx = cby * abz - cbz * aby, ny = cbz * abx - cbx * abz, nz = cbx * aby - cby * abx;
    n[a] += nx; n[a + 1] += ny; n[a + 2] += nz; n[b] += nx; n[b + 1] += ny; n[b + 2] += nz; n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  nA.needsUpdate = true;
}
function animateHero(H, dt, speed, st) {
  H.phase += dt * speed * 1.75; const amp = Math.min(1, speed / 3); const s = Math.sin(H.phase);
  H.legs[0].thigh.rotation.z = H.legs[1].thigh.rotation.z = 0; H.legs[0].thigh.rotation.x = s * 0.55 * amp; H.legs[1].thigh.rotation.x = -s * 0.55 * amp;
  H.legs[0].shin.rotation.x = Math.max(0, -Math.cos(H.phase)) * 0.9 * amp + 0.04; H.legs[1].shin.rotation.x = Math.max(0, Math.cos(H.phase)) * 0.9 * amp + 0.04;
  H.body.position.y = Math.abs(Math.cos(H.phase)) * 0.045 * amp + (st.crouch ? -0.32 : 0);
  H.body.rotation.x = st.crouch ? 0.22 : speed > 7 ? 0.14 : 0.02;
  H.breath += dt; const br = Math.sin(H.breath * 1.6) * 0.008; H.head.position.y = 1.68 + br; H.head.rotation.y = Math.sin(H.breath * 0.4) * 0.12 * (1 - amp);
  H.skirt.rotation.x = -s * 0.04 * amp - amp * 0.05; H.skirt.rotation.z = Math.sin(H.phase * 0.5) * 0.03 * amp;
  const sw = st.slashT > 0 ? Math.sin((1 - st.slashT / 0.38) * Math.PI) : 0; const dir = st.slashDir || 1;
  const R = H.arms[0], L = H.arms[1];
  R.sh.rotation.set(-0.32 - sw * 1.7 - s * 0.15 * amp, sw * 1.1 * dir, 0.1 + sw * 0.35); R.el.rotation.x = -0.35 - sw * 0.4; R.hand.rotation.set(0, 0, 0);
  if (st.aimBlast > 0) { L.sh.rotation.set(-1.45, -0.15, -0.05); L.el.rotation.x = -0.1; } else { L.sh.rotation.set(s * 0.35 * amp - 0.05, 0, -0.08); L.el.rotation.x = -0.25 - amp * 0.3; }
  for (const g of H.locs) { g.rotation.x = amp * 0.25 + Math.sin(TIME * 2.2 + g.userData.ph) * 0.04 + Math.sin(H.phase) * 0.05 * amp; g.rotation.z = Math.sin(TIME * 1.7 + g.userData.ph) * 0.03; }
  H.blade.scale.set(1, 0.96 + Math.random() * 0.06, 1);
  updateCape(H, speed, dt);
}

/* ---------- infantry: two distinct armies, built once per team and shared ---------- */
const SMAT = {
  1: { armor: std(0x9aa6b2, 0.42, 0.5, { map: TEX.armor.map, normalMap: TEX.armor.normal }), cloth: std(0x3a4148, 0.9, 0, { map: TEX.cloth.map, normalMap: TEX.cloth.normal }), dark: std(0x23282e, 0.5, 0.5, { map: TEX.armor.map, normalMap: TEX.armor.normal }), glow: basic(new T.Color(0.6, 1.8, 3.0)), gun: std(0x1b1d21, 0.38, 0.7, { normalMap: TEX.armor.normal }), glass: std(0x050a10, 0.05, 1.0), accent: std(0xd8dcde, 0.35, 0.6) },
  2: { armor: std(0x6a2a24, 0.42, 0.5, { map: TEX.armor.map, normalMap: TEX.armor.normal }), cloth: std(0x2a2120, 0.9, 0, { map: TEX.cloth.map, normalMap: TEX.cloth.normal }), dark: std(0x1c1716, 0.5, 0.5, { map: TEX.armor.map, normalMap: TEX.armor.normal }), glow: basic(new T.Color(3.0, 1.0, 0.3)), gun: std(0x1a1716, 0.38, 0.7, { normalMap: TEX.armor.normal }), glass: std(0x0d0505, 0.05, 1.0), accent: std(0x9a7a4a, 0.35, 0.7) },
};
const TROOP_CACHE = {};
function bakeGeos(b) { const o = {}; for (const k of Object.keys(b)) { if (k === 'add' || !b[k].length) continue; o[k] = mergeGeos(b[k]); } return o; }
function troopGeos(team, heavy) {
  const key = team + (heavy ? 'h' : ''); if (TROOP_CACHE[key]) return TROOP_CACHE[key];
  const blue = team === 1; const t = bucket();
  // torso & pelvis
  t.add('cloth', xf(lathe([[0.15, 0.9], [0.16, 1.0], [0.17, 1.12], [0.19, 1.25], [0.2, 1.42], [0.16, 1.55], [0.07, 1.6]], 16), [0, 0, 0], [0, 0, 0], [1, 1, 0.7]));
  t.add('armor', xf(rbox(0.4, 0.3, 0.12, 0.05), [0, 1.38, 0.09], [-0.08, 0, 0]));
  t.add('armor', xf(rbox(0.36, 0.3, 0.1, 0.04), [0, 1.37, -0.11]));
  for (let i = 0; i < 3; i++) t.add('dark', xf(rbox(0.26 - i * 0.02, 0.05, 0.06, 0.018, 2), [0, 1.18 - i * 0.055, 0.12 - i * 0.004]));
  t.add('dark', xf(new T.CylinderGeometry(0.175, 0.17, 0.06, 20, 1, true), [0, 0.98, 0], [0, 0, 0], [1, 1, 0.75]));
  for (const x of [-0.12, -0.04, 0.04, 0.12]) t.add('dark', xf(rbox(0.06, 0.07, 0.05, 0.012, 2), [x, 0.98, 0.13]));
  t.add('armor', xf(rbox(0.14, 0.12, 0.05, 0.02, 2), [0, 0.86, 0.11], [0.1, 0, 0]));
  // backpack
  t.add('dark', xf(rbox(0.32, 0.36, 0.14, 0.035), [0, 1.33, -0.22]));
  t.add('glow', xf(rbox(0.05, 0.16, 0.01, 0.004, 1), [0.08, 1.33, -0.293])); t.add('glow', xf(rbox(0.05, 0.16, 0.01, 0.004, 1), [-0.08, 1.33, -0.293]));
  t.add('gun', xf(new T.CylinderGeometry(0.006, 0.006, 0.42, 5), [0.12, 1.66, -0.22]));
  // pauldrons
  for (const sx of [-1, 1]) {
    if (blue) { t.add('armor', xf(new T.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), [sx * 0.25, 1.5, 0], [0, 0, -sx * 0.45], [1.05, 0.85, 1.1])); t.add('accent', xf(new T.TorusGeometry(0.1, 0.007, 4, 18), [sx * 0.25, 1.47, 0], [Math.PI / 2, 0, -sx * 0.45], [1.05, 1.1, 1])); }
    else { t.add('armor', xf(rbox(0.16, 0.06, 0.2, 0.02, 2), [sx * 0.26, 1.52, 0], [0, 0, -sx * 0.5])); t.add('accent', xf(new T.ConeGeometry(0.025, 0.12, 6), [sx * 0.32, 1.6, 0], [0, 0, -sx * 0.6])); }
  }
  // head & helmet
  t.add('cloth', xf(new T.CylinderGeometry(0.06, 0.07, 0.1, 12), [0, 1.6, 0]));
  if (blue) {
    t.add('armor', xf(new T.SphereGeometry(0.142, 22, 16), [0, 1.73, 0], [0, 0, 0], [1, 1.05, 1.12]));
    t.add('glass', xf(rbox(0.2, 0.07, 0.05, 0.02, 2), [0, 1.74, 0.13], [0.15, 0, 0]));
    t.add('glow', xf(rbox(0.16, 0.012, 0.01, 0.004, 1), [0, 1.745, 0.158], [0.15, 0, 0])); t.add('glow', xf(rbox(0.012, 0.05, 0.01, 0.004, 1), [0, 1.71, 0.158]));
    t.add('dark', xf(rbox(0.12, 0.06, 0.05, 0.02, 2), [0, 1.645, 0.12], [0.25, 0, 0]));
    for (const sx of [-1, 1]) t.add('dark', xf(new T.CylinderGeometry(0.045, 0.045, 0.03, 14), [sx * 0.14, 1.72, 0], [0, 0, Math.PI / 2]));
    t.add('gun', xf(new T.CylinderGeometry(0.004, 0.004, 0.18, 5), [-0.15, 1.82, -0.02]));
    t.add('accent', xf(rbox(0.03, 0.1, 0.22, 0.012, 2), [0, 1.85, -0.01]));
  } else {
    t.add('armor', xf(rbox(0.25, 0.22, 0.28, 0.06), [0, 1.74, 0]));
    t.add('dark', xf(rbox(0.23, 0.05, 0.05, 0.015, 2), [0, 1.75, 0.135])); t.add('glow', xf(rbox(0.19, 0.012, 0.01, 0.004, 1), [0, 1.75, 0.161]));
    t.add('dark', xf(new T.CylinderGeometry(0.05, 0.06, 0.07, 12), [0, 1.66, 0.13], [Math.PI / 2, 0, 0]));
    for (const sx of [-1, 1]) { t.add('gun', xf(new T.CylinderGeometry(0.025, 0.025, 0.06, 10), [sx * 0.07, 1.65, 0.13], [Math.PI / 2, 0, 0])); t.add('cloth', tube([[sx * 0.07, 1.64, 0.1], [sx * 0.15, 1.58, 0.0], [sx * 0.12, 1.45, -0.18]], 0.012, 10, 5)); }
    t.add('accent', xf(rbox(0.025, 0.12, 0.3, 0.01, 2), [0, 1.87, -0.02])); for (const sx of [-1, 1]) t.add('accent', xf(new T.ConeGeometry(0.025, 0.14, 6), [sx * 0.12, 1.86, -0.02], [0, 0, -sx * 0.5]));
    t.add('cloth', xf(rbox(0.22, 0.42, 0.015, 0.006, 1), [0, 0.74, 0.14], [0.05, 0, 0])); t.add('accent', xf(rbox(0.06, 0.06, 0.01, 0.005, 1), [0, 0.9, 0.152]));
  }
  // arms posed holding the rifle
  const rS = V(0.24, 1.5, 0), rE = V(0.26, 1.24, 0.06), rH = V(0.11, 1.28, 0.3), lS = V(-0.24, 1.5, 0), lE = V(-0.24, 1.29, 0.22), lH = V(-0.05, 1.32, 0.52);
  for (const [s, e, h] of [[rS, rE, rH], [lS, lE, lH]]) {
    t.add('cloth', limb(s, e, 0.058, 0.05)); t.add('cloth', limb(e, h, 0.048, 0.042));
    t.add('armor', limb(_v4.lerpVectors(e, h, 0.2).clone(), _v5.lerpVectors(e, h, 0.75).clone(), 0.056, 0.05));
    t.add('dark', xf(new T.SphereGeometry(0.045, 10, 8), [e.x, e.y, e.z]));
    t.add('dark', xf(rbox(0.07, 0.07, 0.09, 0.02, 2), [h.x, h.y - 0.02, h.z]));
  }
  // rifle
  const rx = 0.07, ry = 1.33;
  t.add('gun', xf(rbox(0.06, 0.11, 0.48, 0.015), [rx, ry, 0.33]));
  t.add('gun', xf(new T.CylinderGeometry(0.017, 0.017, 0.38, 10), [rx, ry + 0.015, 0.74], [Math.PI / 2, 0, 0]));
  t.add('dark', xf(new T.CylinderGeometry(0.028, 0.026, 0.08, 10), [rx, ry + 0.015, 0.92], [Math.PI / 2, 0, 0]));
  t.add('dark', xf(rbox(0.05, 0.05, 0.2, 0.012, 2), [rx, ry + 0.01, 0.62]));
  t.add('gun', xf(rbox(0.04, 0.16, 0.06, 0.01, 2), [rx, ry - 0.12, 0.4], [0.25, 0, 0]));
  t.add('gun', xf(rbox(0.035, 0.1, 0.045, 0.01, 2), [rx, ry - 0.1, 0.24], [-0.3, 0, 0]));
  t.add('gun', xf(rbox(0.045, 0.1, 0.22, 0.015, 2), [rx, ry - 0.02, 0.0], [0.1, 0, 0]));
  t.add('dark', xf(new T.CylinderGeometry(0.026, 0.026, 0.16, 12), [rx, ry + 0.09, 0.33], [Math.PI / 2, 0, 0]));
  t.add('glow', xf(new T.CircleGeometry(0.02, 10), [rx, ry + 0.09, 0.412]));
  t.add('glow', xf(rbox(0.008, 0.02, 0.08, 0.003, 1), [rx + 0.032, ry, 0.36]));
  if (heavy) { t.add('dark', xf(new T.CylinderGeometry(0.075, 0.075, 1.1, 14), [0.2, 1.55, -0.2], [Math.PI / 2 - 0.2, 0, 0])); t.add('accent', xf(new T.TorusGeometry(0.078, 0.01, 5, 16), [0.2, 1.6, 0.3], [-0.2, 0, 0])); t.add('glow', xf(new T.CircleGeometry(0.06, 12), [0.2, 1.67, 0.34], [-0.2, 0, 0])); }
  // legs
  const th = bucket(); th.add('cloth', lathe([[0.085, 0], [0.09, -0.1], [0.082, -0.3], [0.07, -0.45]], 14)); th.add('armor', xf(rbox(0.13, 0.22, 0.07, 0.025, 2), [0, -0.2, 0.06]));
  const sh = bucket(); sh.add('cloth', lathe([[0.068, 0], [0.072, -0.15], [0.06, -0.38]], 14)); sh.add('armor', xf(rbox(0.12, 0.11, 0.08, 0.03, 2), [0, 0, 0.06])); sh.add('armor', xf(rbox(0.1, 0.24, 0.05, 0.02, 2), [0, -0.2, 0.06]));
  sh.add('dark', xf(rbox(0.11, 0.1, 0.24, 0.03, 2), [0, -0.42, 0.035])); sh.add('dark', xf(rbox(0.12, 0.025, 0.26, 0.008, 1), [0, -0.47, 0.035]));
  return (TROOP_CACHE[key] = { torso: bakeGeos(t), thigh: bakeGeos(th), shin: bakeGeos(sh) });
}
function buildTrooperModel(team, heavy) {
  const G2 = troopGeos(team, heavy), M = SMAT[team];
  const root = new T.Group(), body = new T.Group(); root.add(body);
  const put = (grp, geos, shadow) => { for (const k in geos) { const m = new T.Mesh(geos[k], M[k]); m.castShadow = shadow.includes(k); grp.add(m); } };
  put(body, G2.torso, ['armor', 'cloth', 'dark']);
  const legs = [];
  for (const sx of [-1, 1]) { const th = new T.Group(); th.position.set(sx * 0.1, 0.94, 0); body.add(th); put(th, G2.thigh, ['cloth']); const sh = new T.Group(); sh.position.y = -0.45; th.add(sh); put(sh, G2.shin, []); legs.push({ th, sh }); }
  return { root, body, legs };
}

/* ---------- commander statue / showcase pedestal at Meridian HQ ---------- */
const SHOWCASE = { parts: null, pos: new V3(), ang: 0.4, pitch: 0.12, dist: 4.2, drag: false, lx: 0, ly: 0 };
(function buildShowcase() {
  const x = HQ[1].x, z = HQ[1].z - 105, y = groundY(x, z);
  SHOWCASE.pos.set(x, y + 0.9, z);
  const ped = new T.Group(); ped.position.set(x, y, z); scene.add(ped);
  const pb = bucket(); pb.add('baseMetal', new T.CylinderGeometry(1.25, 1.35, 0.6, 40).translate(0, 0.3, 0));
  pb.add('baseMetal', new T.CylinderGeometry(1.1, 1.18, 0.3, 40).translate(0, 0.75, 0));
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; pb.add('black', xf(rbox(0.16, 0.18 + (i % 3) * 0.06, 0.08, 0.01, 1), [Math.sin(a) * 1.33, 0.3, Math.cos(a) * 1.33], [0, a, 0])); }
  pb.add('bronze', xf(new T.TorusGeometry(1.18, 0.012, 4, 64), [0, 0.9, 0], [Math.PI / 2, 0, 0]));
  for (const p of [ped]) bakeInto(p, pb, HMAT, ['baseMetal']);
  const glowRing = new T.Mesh(new T.TorusGeometry(1.36, 0.01, 4, 64).rotateX(Math.PI / 2), basic(new T.Color(0.4, 1.0, 2.2))); glowRing.position.y = 0.12; ped.add(glowRing);
  const H = buildHeroModel(); H.root.position.copy(SHOWCASE.pos); H.root.rotation.y = 0; scene.add(H.root); SHOWCASE.parts = H;
  BUILDINGS.push(new Building(x, z, 2.6, 2.6, 3, { mesh: new T.Group(), hp: 1e9 }));
})();
