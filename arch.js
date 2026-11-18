'use strict';
/* ===================== IRON MERIDIAN · city architecture ===================== */
const glassPair = (() => {
  const seeds = []; for (let i = 0; i < 64; i++) seeds.push(Math.random());
  const mk = lit => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = lit ? '#000' : '#3d4c58'; g.fillRect(0, 0, w, h);
    for (let cy = 0; cy < 8; cy++) for (let cx = 0; cx < 8; cx++) { const r = seeds[cy * 8 + cx]; const x = cx * 32, y = cy * 32;
      if (!lit) { const gr = g.createLinearGradient(x, y, x + 32, y + 32); gr.addColorStop(0, '#5f7686'); gr.addColorStop(1, '#2a3640'); g.fillStyle = gr; g.fillRect(x + 1, y + 1, 30, 30); }
      if (r < 0.3) { g.fillStyle = lit ? (r < 0.2 ? '#ffd29a' : '#9fd6ff') : 'rgba(255,230,180,.35)'; g.fillRect(x + 3, y + 3, 26, 26); } }
    if (!lit) { g.fillStyle = '#1c2228'; for (let i = 0; i <= 8; i++) { g.fillRect(i * 32 - 1, 0, 2, h); g.fillRect(0, i * 32 - 1, w, 2); } }
  });
  return { map: mk(false), lit: mk(true) };
})();
const shopTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const cols = ['#ffb35a', '#7fd0ff', '#ff6a8a', '#b8ff7a', '#ffe08a']; for (let i = 0; i < 8; i++) { const x = i * 32 + 3; g.fillStyle = Math.random() < 0.7 ? cols[i % 5] : '#1a1a1a'; g.globalAlpha = 0.85; g.fillRect(x, 20, 26, 40); g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(x + 12, 20, 2, 40); } });
const SIGNS = ['KESSA COLA', 'MERIDIAN BANK', 'NOVA TRANSIT', 'ORBITAL TOURS', 'RAMEN 24H', 'EVAC ROUTE ▸', 'TIDEWATER FISH', 'HOLO-NET'].map((t, i) => {
  const c = ['#ff3d6a', '#5ccaff', '#ffb547', '#9b7cff', '#ff6a2a', '#3dff9a', '#5ae0ff', '#ff4ad8'][i];
  const tex = textTex(256, 64, (g) => { g.fillStyle = '#080808'; g.fillRect(0, 0, 256, 64); g.strokeStyle = c; g.lineWidth = 3; g.strokeRect(4, 4, 248, 56); g.fillStyle = c; g.font = '800 34px "Saira Extra Condensed", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = c; g.shadowBlur = 12; g.fillText(t, 128, 34); });
  return new T.MeshBasicMaterial({ map: tex, color: new T.Color(1.8, 1.8, 1.8) });
});
const ARCH_MAT = {
  stone0: bldMats[0], stone1: bldMats[1], stone2: bldMats[2],
  glass: std(0x9fb4c4, 0.06, 0.95, { map: glassPair.map, emissiveMap: glassPair.lit, emissive: 0xffffff, emissiveIntensity: 1.2 }),
  brut: std(0x7a7a76, 0.92, 0.05, { map: facadeTex, emissiveMap: facadeLit, emissive: 0xffd8a0, emissiveIntensity: 0.8, normalMap: TEX.armor.normal }),
  trim: std(0xa8a49a, 0.8, 0.08, { normalMap: TEX.armor.normal }), dark: std(0x2a2c30, 0.6, 0.5, { normalMap: TEX.armor.normal }),
  shop: new T.MeshBasicMaterial({ map: shopTex, color: new T.Color(1.6, 1.6, 1.6) }), awn: std(0x7a2a24, 0.9, 0), awn2: std(0x2a5a6a, 0.9, 0),
  tank: std(0x5a4030, 0.9, 0.1), green: std(0x3a5a2a, 0.95, 0), pad: std(0x45474a, 0.8, 0.2), red: basic(new T.Color(4, 0.3, 0.2)), white: basic(new T.Color(3, 3, 3)),
};
const ARCH_BLINK = [];
ARCH_MAT.copper = std(0x4f8a78, 0.55, 0.55); ARCH_MAT.col = std(0xcfc6b4, 0.85, 0.04, { normalMap: TEX.armor.normal });
/* structural variety: round towers, twins with skybridges, podium towers, pagoda tiers, wedge crowns, domed halls, rowhouses, workshops */
function altStyle(B) {
  const { w, d, h } = B, r = Math.random(), m = Math.min(w, d);
  if (h < 20) return r < 0.5 ? 'row' : r < 0.78 ? 'shed' : null;
  if (h < 40 && m > 15 && r < 0.2) return 'dome';
  if (h > 40 && r < 0.16) return 'round';
  if (h > 60 && w > 17 && r < 0.3) return 'twin';
  if (h > 45 && m > 15 && r < 0.44) return 'podium';
  if (h > 25 && h < 75 && r < 0.56) return 'hex';
  if (h > 50 && r < 0.66) return 'wedge';
  return null;
}
function prism(len, wid, ht) { return new T.CylinderGeometry(wid * 0.62, wid * 0.62, len, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(1, ht / (wid * 0.93), 1); }
function buildAlt(B, s) {
  const { w, d, h } = B, m = Math.min(w, d), b = bucket(), g = new T.Group();
  const face = s === 'round' || s === 'wedge' || (s === 'twin' && Math.random() < 0.6) ? 'glass' : s === 'shed' ? 'brut' : 'stone' + ((Math.random() * 3) | 0);
  const box = (bw, bh, bd, x = 0, y = 0, z = 0, k = face) => { const q = new T.BoxGeometry(bw, bh, bd).translate(x, y + bh / 2, z); boxProjUV(q, k === 'glass' ? 24 : 28, true); b.add(k, q); };
  const cyl = (r0, r1, ch, seg, y, k = face) => { const q = new T.CylinderGeometry(r1, r0, ch, seg).translate(0, y + ch / 2, 0); boxProjUV(q, 24, false); b.add(k, q); };
  const shops = (bw, bd, y = 0) => { for (const [sx, sz, ry, len] of [[0, 1, 0, bw], [0, -1, Math.PI, bw], [1, 0, Math.PI / 2, bd], [-1, 0, -Math.PI / 2, bd]]) b.add('shop', xf(new T.PlaneGeometry(len * 0.9, 3), [sx * (bw / 2 + 0.06), y + 2.1, sz * (bd / 2 + 0.06)], [0, ry, 0])); };
  if (s === 'round') {
    const r = m / 2; cyl(r, r * 0.92, h * 0.86, 22, 0); cyl(r * 0.7, r * 0.6, h * 0.14, 22, h * 0.86);
    for (let y = 12; y < h * 0.86; y += 12) b.add('dark', new T.CylinderGeometry(r * 0.95 + 0.4, r * 0.95 + 0.4, 0.6, 22).translate(0, y, 0));
    b.add('dark', new T.CylinderGeometry(0.12, 0.35, 16, 6).translate(0, h + 8, 0));
  } else if (s === 'twin') {
    const tw = w * 0.38; box(tw, h, d * 0.9, -w * 0.31, 0, 0); box(tw, h * 0.78, d * 0.9, w * 0.31, 0, 0);
    for (const f of [0.32, 0.56]) { box(w * 0.26, 4, d * 0.4, 0, h * f, 0, 'glass'); box(w * 0.26, 0.6, d * 0.44, 0, h * f - 0.3, 0, 'dark'); }
    for (const [x, hh] of [[-w * 0.31, h], [w * 0.31, h * 0.78]]) box(tw * 0.6, 3, d * 0.5, x, hh, 0, 'dark');
    shops(w, d * 0.9);
  } else if (s === 'podium') {
    const ph = Math.min(14, h * 0.25); box(w, ph, d, 0, 0, 0, 'stone1'); b.add('trim', xf(new T.BoxGeometry(w + 1, 1, d + 1), [0, ph, 0]));
    box(w * 0.55, h - ph, d * 0.55, w * 0.18, ph, -d * 0.18); box(w * 0.4, 0.6, d * 0.35, -w * 0.24, ph + 0.5, d * 0.24, 'green');
    for (let y = ph + 10; y < h - 2; y += 10) b.add('trim', xf(new T.BoxGeometry(w * 0.55 + 0.6, 0.5, d * 0.55 + 0.6), [w * 0.18, y, -d * 0.18]));
    shops(w, d);
  } else if (s === 'hex') {
    const n = Math.max(2, Math.floor(h / 13)), th = h / n; let y = 0;
    for (let i = 0; i < n; i++) { const r = (m / 2) * (1 - i * 0.45 / n); cyl(r, r * 0.95, th - 1.2, 6, y); b.add('dark', new T.CylinderGeometry(r * 1.05, r * 1.25, 1.3, 6).translate(0, y + th - 0.6, 0)); y += th; }
    b.add('copper', new T.ConeGeometry(m * 0.18, 9, 6).translate(0, h + 4.5, 0));
  } else if (s === 'wedge') {
    const q = new T.BoxGeometry(w, h, d, 1, 6, 1).translate(0, h / 2, 0); const p = q.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, y - (p.getX(i) / w + 0.5) * h * 0.3 * (y / h) ** 3); }
    boxProjUV(q, 24, true); b.add(face, q);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add('dark', xf(rbox(0.6, h * (sx < 0 ? 1 : 0.7), 0.6, 0.1, 1), [sx * w / 2, h * (sx < 0 ? 0.5 : 0.35), sz * d / 2]));
    shops(w, d);
  } else if (s === 'dome') {
    const bh = h * 0.55; box(w, bh, d, 0, 0, 0); b.add('trim', xf(new T.BoxGeometry(w + 1.2, 1.2, d + 1.2), [0, bh, 0]));
    const nc = Math.max(4, Math.floor(w / 3.2)); for (let i = 0; i < nc; i++) b.add('col', new T.CylinderGeometry(0.45, 0.55, bh - 1.2, 10).translate(-w * 0.42 + i * (w * 0.84 / (nc - 1)), (bh - 1.2) / 2, d / 2 + 2));
    box(w * 0.92, 1.6, 4, 0, bh - 1.2, d / 2 + 2, 'col'); b.add('col', prism(w * 0.92, 4.4, 3).rotateY(Math.PI / 2).translate(0, bh + 1.6, d / 2 + 2)); box(w * 0.9, 0.5, 5, 0, 0, d / 2 + 2.2, 'col');
    cyl(m * 0.36, m * 0.36, h * 0.12, 22, bh, 'col'); b.add('copper', new T.SphereGeometry(m * 0.36, 22, 10, 0, 6.283, 0, Math.PI / 2).translate(0, bh + h * 0.12, 0));
    b.add('copper', new T.CylinderGeometry(0.6, 1.2, 4, 10).translate(0, bh + h * 0.12 + m * 0.36 + 1.5, 0));
  } else if (s === 'row') {
    box(w, h, d); shops(w, d);
    for (let y = 6; y < h - 1; y += 3.4) b.add('dark', xf(new T.BoxGeometry(w * 0.7, 0.2, 1.2), [0, y, d / 2 + 0.6]));
    if (Math.random() < 0.6) b.add(Math.random() < 0.5 ? 'awn' : 'dark', prism(w + 0.6, d + 0.8, Math.min(6, d * 0.45)).translate(0, h, 0));
    else b.add('trim', xf(new T.BoxGeometry(w + 0.6, 1.2, d + 0.6), [0, h, 0]));
    b.add('dark', xf(new T.BoxGeometry(1, 2.6, 1), [w * 0.3, h + 1.3, -d * 0.2]));
  } else { // shed: sawtooth-roof workshop
    const bh = h * 0.72; box(w, bh, d); const n = Math.max(2, Math.round(w / 5));
    for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; b.add('dark', xf(new T.BoxGeometry(w / n * 1.06, 0.35, d), [x - w / n * 0.1, bh + w / n * 0.22, 0], [0, 0, 0.42])); b.add('glass', xf(new T.PlaneGeometry(d, w / n * 0.42), [x + w / n * 0.42, bh + w / n * 0.2, 0], [0, Math.PI / 2, 0])); }
    b.add('dark', xf(new T.PlaneGeometry(w * 0.5, bh * 0.6), [0, bh * 0.3, d / 2 + 0.05])); b.add('tank', new T.CylinderGeometry(0.7, 0.9, h * 0.9, 10).translate(-w * 0.35, bh + h * 0.3, -d * 0.3));
  }
  if (h > 55 && Math.random() < 0.5) { const bl = new T.Mesh(new T.SphereGeometry(0.35, 8, 6), ARCH_MAT.red); bl.position.set(0, h + (s === 'round' ? 16 : 3), 0); g.add(bl); ARCH_BLINK.push(bl); }
  bakeInto(g, b, ARCH_MAT, [face, 'stone1']); // only the main volume casts shadows
  for (const m of g.children) if (m.material === ARCH_MAT[face] || m.material === ARCH_MAT.stone1 || m.material === ARCH_MAT.copper) m.userData.keep = true;
  return g;
}
function buildTower(B) {
  { const alt = altStyle(B); if (alt) return buildAlt(B, alt); }
  const w = B.w, d = B.d, h = B.h; const r = Math.random(); const style = h > 70 && r < 0.45 ? 'glass' : h > 55 && r < 0.75 ? 'stepped' : r < 0.12 ? 'brut' : 'stone';
  const face = style === 'glass' ? 'glass' : style === 'brut' ? 'brut' : 'stone' + ((Math.random() * 3) | 0);
  const b = bucket(); const g = new T.Group();
  const tiers = style === 'stepped' ? [[1, 0.55], [0.78, 0.3], [0.55, 0.15]] : style === 'glass' && h > 100 ? [[1, 0.8], [0.8, 0.2]] : [[1, 1]];
  let y = 0, topW = w, topD = d;
  for (const [s, f] of tiers) {
    const tw = w * s, td = d * s, th = h * f; const box = new T.BoxGeometry(tw, th, td).translate(0, y + th / 2, 0); boxProjUV(box, style === 'glass' ? 24 : 28, true); b.add(face, box);
    if (style !== 'glass') {
      for (let ly = y + 14; ly < y + th - 4; ly += 14) b.add('trim', xf(rbox(tw + 0.7, 0.5, td + 0.7, 0.15, 1), [0, ly, 0]));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add('trim', xf(rbox(1.3, th, 1.3, 0.2, 1), [sx * tw / 2, y + th / 2, sz * td / 2]));
      b.add('trim', xf(rbox(tw + 1.4, 1.3, td + 1.4, 0.3, 1), [0, y + th - 0.4, 0]));
    } else {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add('dark', xf(rbox(0.6, th, 0.6, 0.1, 1), [sx * tw / 2, y + th / 2, sz * td / 2]));
      b.add('dark', xf(rbox(tw + 0.4, 0.8, td + 0.4, 0.1, 1), [0, y + th, 0]));
    }
    y += th; topW = tw; topD = td;
  }
  // street level: storefronts and awnings
  for (const [sx, sz, ry, len] of [[0, 1, 0, w], [0, -1, Math.PI, w], [1, 0, Math.PI / 2, d], [-1, 0, -Math.PI / 2, d]]) {
    b.add('shop', xf(new T.PlaneGeometry(len * 0.9, 3.2), [sx * (w / 2 + 0.06), 2.2, sz * (d / 2 + 0.06)], [0, ry, 0]));
    if (Math.random() < 0.6) b.add(Math.random() < 0.5 ? 'awn' : 'awn2', xf(rbox(len * 0.8, 0.15, 2.2, 0.06, 1), [sx * (w / 2 + 1.1), 4.1, sz * (d / 2 + 1.1)], [0.22, ry, 0]));
  }
  // roof
  const ry = y;
  for (const [px, pz, pw, pd] of [[0, topD / 2, topW, 0.4], [0, -topD / 2, topW, 0.4], [topW / 2, 0, 0.4, topD], [-topW / 2, 0, 0.4, topD]]) b.add('trim', xf(new T.BoxGeometry(pw, 1.2, pd), [px, ry + 0.6, pz]));
  const nAC = 2 + ((Math.random() * 4) | 0); for (let i = 0; i < nAC; i++) { const x = rand(-topW, topW) * 0.3, z = rand(-topD, topD) * 0.3; b.add('dark', xf(rbox(2.4, 1.4, 2.4, 0.2, 1), [x, ry + 0.7, z])); b.add('trim', xf(new T.CylinderGeometry(0.8, 0.8, 0.1, 12), [x, ry + 1.45, z])); }
  if (style !== 'glass' && Math.random() < 0.45) { const x = topW * 0.25, z = -topD * 0.2; b.add('tank', xf(new T.CylinderGeometry(2, 2, 3.4, 14), [x, ry + 4.2, z])); b.add('tank', xf(new T.ConeGeometry(2.2, 1.2, 14), [x, ry + 6.5, z])); for (const [lx, lz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) b.add('dark', xf(new T.CylinderGeometry(0.12, 0.12, 2.6, 5), [x + lx, ry + 1.3, z + lz])); }
  if (h > 85 && style === 'glass') { b.add('pad', xf(new T.CylinderGeometry(Math.min(topW, topD) * 0.42, Math.min(topW, topD) * 0.42, 0.4, 24), [0, ry + 1.2, 0])); b.add('white', xf(rbox(0.6, 0.05, 3.4, 0.02, 1), [-0.9, ry + 1.45, 0])); b.add('white', xf(rbox(0.6, 0.05, 3.4, 0.02, 1), [0.9, ry + 1.45, 0])); b.add('white', xf(rbox(1.8, 0.05, 0.5, 0.02, 1), [0, ry + 1.45, 0])); }
  else if (Math.random() < 0.3) b.add('green', xf(rbox(topW * 0.5, 0.6, topD * 0.4, 0.2, 1), [-topW * 0.15, ry + 0.3, topD * 0.15]));
  let blink = null;
  if (Math.random() < 0.6) { const mh = 6 + h * 0.12; b.add('dark', xf(new T.CylinderGeometry(0.12, 0.22, mh, 6), [topW * 0.3, ry + mh / 2, topD * 0.3])); blink = new T.Mesh(new T.SphereGeometry(0.35, 8, 6), ARCH_MAT.red); blink.position.set(topW * 0.3, ry + mh + 0.3, topD * 0.3); g.add(blink); ARCH_BLINK.push(blink); }
  if (Math.random() < 0.28) { const sm = pick(SIGNS); const sw = Math.min(topW * 0.8, 16); const sg = new T.Mesh(new T.PlaneGeometry(sw, sw / 4), sm); sg.position.set(0, ry + 2 + sw / 8, topD / 2 * 0.6); g.add(sg); b.add('dark', xf(rbox(sw, 0.3, 0.3, 0.1, 1), [0, ry + 1.6, topD / 2 * 0.6 - 0.2])); for (const sx of [-0.4, 0.4]) b.add('dark', xf(new T.CylinderGeometry(0.12, 0.12, 2, 5), [sx * sw, ry + 1, topD / 2 * 0.6 - 0.3])); }
  else if (Math.random() < 0.35 && style !== 'glass') { const sm = pick(SIGNS); const sg = new T.Mesh(new T.PlaneGeometry(9, 2.25), sm); sg.position.set(0, h * 0.35, d / 2 + 0.4); g.add(sg); }
  bakeInto(g, b, ARCH_MAT, [face]); for (const m of g.children) if (m.material === ARCH_MAT[face]) m.userData.keep = true;
  return g;
}
for (const B of BUILDINGS) {
  if (!B.generic) continue;
  scene.remove(B.mesh); B.mesh = buildTower(B); B.mesh.position.set(B.x, B.gy, B.z); B.mesh.traverse(o => { if (o.isMesh) o.receiveShadow = true; }); scene.add(B.mesh);
}
/* building LOD: beyond ~250 m only each building's main volume is drawn (trim, shops, roof clutter and signs drop out) */
const BLD_LOD = { parts: [], n: 0, t: 0 };
function updateBldLod(dt) {
  if (BLD_LOD.n !== BUILDINGS.length) {
    BLD_LOD.n = BUILDINGS.length; BLD_LOD.parts = [];
    for (const B of BUILDINGS) {
      const kids = B.mesh.children.filter(o => o.isMesh || o.isGroup); if (kids.length < 2) continue;
      // arch buildings mark their main volumes; anything else keeps its big pieces (walls, roofs) and drops the small ones
      let det = kids.filter(o => !o.userData.keep);
      if (det.length === kids.length) { const rad = o => { if (!o.isMesh) return 0; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); return o.geometry.boundingSphere.radius; }; const mr = Math.max(...kids.map(rad)); det = kids.filter(o => o.isMesh && rad(o) < mr * 0.45); }
      if (det.length) BLD_LOD.parts.push({ B, det, r: 160 + B.h * 0.6, on: true });
    }
  }
  if ((BLD_LOD.t -= dt) > 0) return; BLD_LOD.t = 0.35;
  const c = camera.position, k = POST.lod * PERF.lod;
  for (const p of BLD_LOD.parts) { const on = Math.hypot(p.B.x - c.x, p.B.z - c.z) < p.r * k && c.y < 600; if (on !== p.on) { p.on = on; for (const o of p.det) o.visible = on; } }
}
