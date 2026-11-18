'use strict';
/* ===================== IRON MERIDIAN · detailed destroyers ===================== */
function textTex(w, h, draw) { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; return t; }
const foamTex = canvasTex(128, 128, (g, w, h) => { const id = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = vnoise(x * 0.12, y * 0.12) * 0.6 + vnoise(x * 0.4, y * 0.4) * 0.3 + Math.random() * 0.1; const k = (y * w + x) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = 255; id.data[k + 3] = clamp((n - 0.35) * 2.2, 0, 1) * 255; } g.putImageData(id, 0, 0); });
foamTex.colorSpace = T.NoColorSpace;
const helideckTex = textTex(256, 256, (g) => { g.fillStyle = '#3a3c3e'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#e8e2c8'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 96, 0, 7); g.stroke(); g.fillStyle = '#e8e2c8'; g.font = '700 120px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 128, 134); g.strokeStyle = '#d8b030'; g.lineWidth = 4; g.strokeRect(10, 10, 236, 236); });
const deckTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#3d4044'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.strokeStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.fillStyle = 'rgba(220,200,90,.6)'; g.fillRect(w / 2 - 2, 0, 4, h); });
function hullNumberTex(text) { return textTex(256, 96, (g) => { g.clearRect(0, 0, 256, 96); g.fillStyle = '#e8e6df'; g.font = '800 64px "Saira Extra Condensed", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 52); }); }
function flagTex(team) { return textTex(128, 80, (g) => { g.fillStyle = team === 1 ? '#1d4f80' : '#7a1a10'; g.fillRect(0, 0, 128, 80); g.fillStyle = team === 1 ? '#5ccaff' : '#ff7a3d'; if (team === 1) { g.beginPath(); g.arc(64, 40, 22, 0, 7); g.fill(); g.fillStyle = '#1d4f80'; g.beginPath(); g.arc(70, 40, 18, 0, 7); g.fill(); } else { g.beginPath(); g.moveTo(64, 10); g.lineTo(90, 66); g.lineTo(38, 66); g.closePath(); g.fill(); } g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, 0, 128, 6); }); }
const FLAGS = [];
function makeFlag(team, w = 3.2, h = 2) {
  const g = new T.PlaneGeometry(w, h, 10, 5).translate(w / 2, -h / 2, 0); const base = g.attributes.position.array.slice();
  const m = new T.Mesh(g, new T.MeshStandardMaterial({ map: flagTex(team), side: T.DoubleSide, roughness: 0.85 })); m.castShadow = true; FLAGS.push({ m, base, w, ph: Math.random() * 6 }); return m;
}
let FLAG_F = 0;
function updateFlags(dt) {
  /* phones: only flags within ~220 m wave, half of them each frame, and the lighting is not recomputed (on a flag that
     size it is invisible, and it was four full normal rebuilds a frame) */
  const low = typeof LOW_END !== 'undefined' && LOW_END, R2 = low ? 48400 : 250000; FLAG_F++;
  for (let fi = 0; fi < FLAGS.length; fi++) {
    const f = FLAGS[fi];
    if (low && ((fi + FLAG_F) & 1)) continue;
    if (!f.m.parent || f.m.parent.visible === false) continue; f.m.getWorldPosition(_v1); if (_v1.distanceToSquared(camera.position) > R2) continue;
    const p = f.m.geometry.attributes.position, b = f.base;
    for (let i = 0; i < p.count; i++) { const x = b[i * 3], k = x / f.w; p.setZ(i, Math.sin(TIME * 6 + f.ph - x * 2.2) * 0.35 * k + Math.sin(TIME * 2.3 + b[i * 3 + 1]) * 0.08 * k); }
    p.needsUpdate = true; if (!low) f.m.geometry.computeVertexNormals();
  }
}

function hullGeometry(team) {
  const NS = 30, NP = 9; const pos = [], col = [], idx = [], uv = [];
  const W = t => { if (t < 0.6) return 7.0 + Math.sin(t / 0.6 * Math.PI / 2) * 0.7; const k = (t - 0.6) / 0.4; return 7.7 * Math.sqrt(Math.max(0, 1 - Math.pow(k, 1.7))); };
  const deckY = t => 4 + Math.max(0, t - 0.5) * 6;
  const keelY = t => -3.6 + (t > 0.82 ? Math.pow((t - 0.82) / 0.18, 1.5) * 4.5 : 0) + (t < 0.06 ? (0.06 - t) * 30 : 0);
  const base = team === 1 ? [0.36, 0.39, 0.42] : [0.25, 0.21, 0.21];
  const ring = (t) => { const w = Math.max(0.02, W(t)), dy = deckY(t), ky = keelY(t); const ctrl = [[0, ky], [w * 0.55, ky + 0.25], [w * 0.82, ky + 1.3], [w * 0.92, Math.min(0, dy - 1)], [w, dy]]; const out = []; for (let i = 0; i < NP; i++) { const s = i / (NP - 1) * 4, a = Math.floor(Math.min(3, s)), f = s - a; const p0 = ctrl[a], p1 = ctrl[a + 1]; out.push([lerp(p0[0], p1[0], f), lerp(p0[1], p1[1], f)]); } return out; };
  const L = 90, z0 = -44;
  for (let si = 0; si <= NS; si++) {
    const t = si / NS, z = z0 + t * L, r = ring(t);
    for (const side of [-1, 1]) for (let i = 0; i < NP; i++) {
      const [x, y] = r[i]; pos.push(x * side, y, z); uv.push(z / 12, y / 6);
      const n = vnoise(z * 0.6, y * 1.4 + side * 20); const rust = smooth(0.7, 0.9, n) * (y > 0.5 ? 1 : 0);
      let c = y < -0.35 ? [0.3, 0.07, 0.05] : y < 0.45 ? [0.05, 0.05, 0.05] : base.map(v => v * (0.92 + n * 0.12));
      c = c.map((v, k) => lerp(v, [0.32, 0.17, 0.08][k], rust * 0.6)); col.push(c[0], c[1], c[2]);
    }
  }
  const row = NP * 2;
  for (let si = 0; si < NS; si++) for (const side of [0, 1]) for (let i = 0; i < NP - 1; i++) {
    const a = si * row + side * NP + i, b = a + 1, c = a + row, d = c + 1;
    if (side === 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  // transom
  for (let i = 0; i < NP - 1; i++) { const a = i, b = i + 1, c = NP + i, d = NP + i + 1; idx.push(a, b, c, b, d, c); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // deck outline
  const shape = new T.Shape(); const pts = []; for (let si = 0; si <= NS; si++) { const t = si / NS; pts.push([W(t) * 0.98, z0 + t * L]); }
  shape.moveTo(-pts[0][0], -pts[0][1]); for (const p of pts) shape.lineTo(-p[0], -p[1]); for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(pts[i][0], -pts[i][1]); shape.closePath();
  const dg = new T.ShapeGeometry(shape); dg.rotateX(-Math.PI / 2); const dp = dg.attributes.position; for (let i = 0; i < dp.count; i++) { const z = dp.getZ(i), t = (z - z0) / L; dp.setY(i, deckY(t) + 0.05); } dg.computeVertexNormals();
  const duv = dg.attributes.uv; for (let i = 0; i < dp.count; i++) duv.setXY(i, dp.getX(i) / 16 + 0.5, dp.getZ(i) / 16);
  return { hull: g, deck: dg, W, deckY, L, z0 };
}
const NAVY_MAT = {
  hull: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35, normalMap: TEX.armor.normal, side: T.DoubleSide }),
  deck: new T.MeshStandardMaterial({ map: deckTex, roughness: 0.9, metalness: 0.1 }),
};
function buildNavalModel(team, hullNo) {
  const r = new T.Group(); const H_ = hullGeometry(team); const M = MAT[team];
  const sup = std(team === 1 ? 0x7d8890 : 0x4a3c3a, 0.55, 0.4, { map: TEX.armor.map, normalMap: TEX.armor.normal });
  const mats = { sup, dark: SMAT[team].dark, gun: SMAT[team].gun, glow: M.glow, win: basic(new T.Color(2.2, 1.9, 1.3)), white: std(0xe8e4dc, 0.6, 0.1), orange: std(0xe0761f, 0.6, 0.1), red: basic(new T.Color(4, 0.2, 0.15)), green: basic(new T.Color(0.2, 4, 0.6)), lamp: basic(new T.Color(4, 4, 3.6)), rail: std(0x9aa0a4, 0.4, 0.8) };
  const hull = new T.Mesh(H_.hull, NAVY_MAT.hull); hull.castShadow = true; hull.receiveShadow = true; r.add(hull);
  const deck = new T.Mesh(H_.deck, NAVY_MAT.deck); deck.receiveShadow = true; r.add(deck);
  const dY = z => H_.deckY((z - H_.z0) / H_.L);
  const b = bucket();
  // forward superstructure + bridge
  const bz = 4, by = dY(bz);
  b.add('sup', xf(rbox(11, 5, 13, 0.6), [0, by + 2.5, bz])); b.add('sup', xf(rbox(9.5, 3.6, 8, 0.5), [0, by + 6.8, bz + 1.5]));
  b.add('win', xf(rbox(9.6, 0.9, 0.2, 0.1, 1), [0, by + 7.4, bz + 5.55], [-0.25, 0, 0])); for (const sx of [-1, 1]) b.add('win', xf(rbox(0.2, 0.9, 6.5, 0.1, 1), [sx * 4.8, by + 7.4, bz + 1.5]));
  for (const sx of [-1, 1]) { b.add('sup', xf(rbox(3, 0.4, 3, 0.15, 1), [sx * 6.2, by + 5.5, bz + 3.8])); b.add(sx < 0 ? 'red' : 'green', xf(new T.SphereGeometry(0.25, 8, 6), [sx * 7.6, by + 6, bz + 3.8])); }
  b.add('sup', xf(rbox(7, 1.6, 6, 0.4), [0, by + 9.4, bz + 0.5]));
  // lattice mast + radars
  const mz = bz - 1, my = by + 10.2;
  for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) b.add('dark', limb(V(x * 1.3, my, mz + z * 1.3), V(x * 0.3, my + 14, mz + z * 0.3), 0.14, 0.1, 6));
  for (let i = 1; i < 5; i++) { const y = my + i * 3, s = 1.3 - i * 0.22; b.add('dark', xf(rbox(2.8 * s + 0.4, 0.15, 2.8 * s + 0.4, 0.05, 1), [0, y, mz])); }
  b.add('dark', xf(new T.CylinderGeometry(0.1, 0.1, 6, 6), [0, my + 17, mz])); b.add('lamp', xf(new T.SphereGeometry(0.22, 8, 6), [0, my + 20, mz]));
  for (const sx of [-1, 1]) b.add('dark', xf(rbox(0.3, 0.3, 4, 0.08, 1), [sx * 1.8, my + 12, mz], [0, 0, sx * 0.3]));
  // VLS missile hatches
  for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) b.add('dark', xf(rbox(0.9, 0.12, 0.9, 0.05, 1), [-1.6 + i * 1.07, dY(14) + 0.12, 13 + j * 1.07]));
  // aft superstructure, hangar, funnel
  const az = -17, ay = dY(az);
  b.add('sup', xf(rbox(10.5, 5.5, 15, 0.5), [0, ay + 2.75, az])); b.add('dark', xf(rbox(7, 4, 0.2, 0.1, 1), [0, ay + 2.2, az - 7.55]));
  b.add('sup', xf(rbox(5, 5, 6, 0.6), [0, ay + 7.5, az + 3], [0.12, 0, 0])); b.add('dark', xf(rbox(4.2, 0.6, 5.2, 0.2, 1), [0, ay + 10.2, az + 2.7], [0.12, 0, 0]));
  for (const sx of [-1, 1]) for (const z of [-4, 2]) { b.add('orange', xf(new T.CylinderGeometry(0.8, 0.8, 3.4, 12), [sx * 5.9, ay + 3.8, az + z], [Math.PI / 2, 0, 0])); b.add('orange', xf(new T.SphereGeometry(0.8, 10, 8), [sx * 5.9, ay + 3.8, az + z + 1.7])); b.add('orange', xf(new T.SphereGeometry(0.8, 10, 8), [sx * 5.9, ay + 3.8, az + z - 1.7])); }
  // CIWS domes
  for (const [x, y, z] of [[3, ay + 5.9, az - 3], [-3, by + 5.3, bz - 5]]) { b.add('white', xf(new T.SphereGeometry(0.9, 12, 10), [x, y + 1.2, z], [0, 0, 0], [1, 1.25, 1])); b.add('dark', xf(new T.CylinderGeometry(0.8, 0.9, 0.8, 12), [x, y + 0.2, z])); b.add('gun', xf(new T.CylinderGeometry(0.1, 0.1, 1.6, 6), [x, y + 0.8, z + 1.3], [Math.PI / 2, 0, 0])); }
  // helideck
  const hz = -36; const hd = new T.Mesh(new T.PlaneGeometry(11, 11).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: helideckTex, roughness: 0.8 })); hd.position.set(0, dY(hz) + 0.08, hz); r.add(hd);
  // railings
  for (const side of [-1, 1]) { const pts = []; for (let z = -42; z <= 38; z += 4) { const t = (z - H_.z0) / H_.L; const x = side * H_.W(t) * 0.97, y = H_.deckY(t); pts.push([x, y + 1.1, z]); if (z % 8 === 0) b.add('rail', xf(new T.CylinderGeometry(0.05, 0.05, 1.1, 4), [x, y + 0.55, z])); } b.add('rail', tube(pts, 0.05, 40, 4)); }
  b.add('lamp', xf(new T.SphereGeometry(0.2, 8, 6), [0, dY(-44) + 1.5, -43.5]));
  bakeInto(r, b, mats, ['sup']);
  // hull numbers
  const numT = hullNumberTex(hullNo);
  for (const side of [-1, 1]) { const p = new T.Mesh(new T.PlaneGeometry(5.5, 2.1), new T.MeshBasicMaterial({ map: numT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); const t = (30 - H_.z0) / H_.L; p.position.set(side * (H_.W(t) * 0.99 + 0.05), 2.2, 30); p.rotation.y = side * Math.PI / 2 + (side > 0 ? -0.13 : 0.13); r.add(p); }
  // turrets: superfiring pair forward
  const turrets = [];
  for (const [tz, lift] of [[27, 0], [17.5, 2.6]]) {
    const t = new T.Group(); t.position.set(0, dY(tz) + lift, tz); r.add(t); const tb = bucket();
    if (lift) tb.add('sup', xf(new T.CylinderGeometry(3.2, 3.4, 2.6, 16), [0, -1.3, 0]));
    tb.add('dark', new T.CylinderGeometry(2.8, 3.0, 0.8, 18).translate(0, 0.4, 0));
    const hous = rbox(4.6, 2.1, 5.6, 0.7); const hp = hous.attributes.position; for (let i = 0; i < hp.count; i++) { if (hp.getZ(i) > 1.2) hp.setY(i, hp.getY(i) * (1 - (hp.getZ(i) - 1.2) * 0.18)); } hous.computeVertexNormals(); tb.add('sup', xf(hous, [0, 1.75, 0.2]));
    for (const sx of [-0.75, 0.75]) { tb.add('gun', xf(new T.CylinderGeometry(0.24, 0.3, 8, 10), [sx, 1.85, 6.6], [Math.PI / 2, 0, 0])); tb.add('dark', xf(new T.CylinderGeometry(0.4, 0.4, 0.9, 10), [sx, 1.85, 10.7], [Math.PI / 2, 0, 0])); }
    tb.add('dark', xf(rbox(1.2, 0.8, 1.2, 0.2, 1), [1.6, 3.1, -1])); tb.add('glow', xf(new T.CircleGeometry(0.25, 10), [1.6, 3.1, -0.38]));
    bakeInto(t, tb, mats, ['sup', 'dark']); turrets.push(t);
  }
  // radars that spin
  const radars = [];
  const rd1 = new T.Mesh(rbox(5.5, 1.1, 0.35, 0.15, 1), mats.dark); rd1.position.set(0, my + 15.2, mz); r.add(rd1); radars.push(rd1);
  const rd2 = new T.Mesh(rbox(3, 0.7, 0.3, 0.1, 1), mats.dark); rd2.position.set(0, ay + 11.4, az + 2.4); r.add(rd2); radars.push(rd2);
  // flags
  const f1 = makeFlag(team, 3.4, 2.1); f1.position.set(0.15, my + 19.5, mz); f1.rotation.y = Math.PI / 2; r.add(f1);
  const staff = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 5, 6), mats.rail); staff.position.set(0, dY(-43) + 2.5, -43); r.add(staff);
  const f2 = makeFlag(team, 2.6, 1.6); f2.position.set(0.1, dY(-43) + 4.9, -43); f2.rotation.y = Math.PI / 2; r.add(f2);
  // crew
  const crew = []; const cm = std(team === 1 ? 0x2c4a6a : 0x5a2a1c, 0.8, 0), hm = std(team === 1 ? 0xd8dcd8 : 0x3a3a3a, 0.5, 0.3);
  const crewG = mergeGeos([xf(rbox(0.5, 0.9, 0.35, 0.12, 1), [0, 1.15, 0]), xf(new T.CylinderGeometry(0.1, 0.1, 0.7, 6), [0.12, 0.35, 0]), xf(new T.CylinderGeometry(0.1, 0.1, 0.7, 6), [-0.12, 0.35, 0])]);
  const headG = new T.SphereGeometry(0.17, 10, 8).translate(0, 1.8, 0);
  for (let i = 0; i < 12; i++) { const c = new T.Group(); c.add(new T.Mesh(crewG, cm), new T.Mesh(headG, hm)); const z = rand(-40, 36); if (Math.abs(z - 4) < 7 || Math.abs(z + 17) < 8 || Math.abs(z - 22) < 8) continue; const t = (z - H_.z0) / H_.L; c.position.set(rand(-1, 1) * H_.W(t) * 0.7, H_.deckY(t), z); c.userData = { z, a: -H_.W(t) * 0.75, b: H_.W(t) * 0.75, s: rand(0.3, 1), ph: Math.random() * 6, dy: H_.deckY(t) }; r.add(c); crew.push(c); }
  return { obj: r, turrets, radars, crew, funnel: new V3(0, ay + 10.6, az + 2.4), H: H_ };
}

/* ---------- foam wake ribbons ---------- */
const wakeMat = new T.ShaderMaterial({
  uniforms: { tex: { value: foamTex }, time: { value: 0 }, fogColor: { value: FOG }, fogD: { value: FOG_D } }, transparent: true, depthWrite: false, fog: false,
  vertexShader: `attribute float aA; varying float vA; varying vec2 vUv; varying float vF; uniform float fogD; void main(){ vA=aA; vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); float d=-mv.z; vF=1.-exp(-fogD*fogD*d*d); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D tex; uniform float time; uniform vec3 fogColor; varying float vA; varying vec2 vUv; varying float vF; void main(){ float f=texture2D(tex,vUv*vec2(1.,.25)+vec2(0.,time*.02)).a; float e=1.-pow(abs(vUv.x*2.-1.),1.5); float a=f*vA*e; gl_FragColor=vec4(mix(vec3(.85,.9,.92),fogColor,vF),a*.85); ${OUT} }`
});
class Wake {
  constructor() { this.N = 70; this.pts = []; const g = new T.BufferGeometry(); this.pos = new Float32Array(this.N * 2 * 3); this.a = new Float32Array(this.N * 2); const uv = new Float32Array(this.N * 2 * 2); const idx = [];
    for (let i = 0; i < this.N; i++) { uv[i * 4] = 0; uv[i * 4 + 1] = i; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i; if (i < this.N - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    g.setAttribute('position', new T.BufferAttribute(this.pos, 3)); g.setAttribute('aA', new T.BufferAttribute(this.a, 1)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mesh = new T.Mesh(g, wakeMat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; scene.add(this.mesh); this.g = g; }
  update(p, yaw, speed, fade) {
    const last = this.pts[0]; if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 3) { this.pts.unshift({ x: p.x, z: p.z, yaw, t: TIME }); if (this.pts.length > this.N) this.pts.pop(); }
    for (let i = 0; i < this.N; i++) { const q = this.pts[Math.min(i, this.pts.length - 1)] || { x: p.x, z: p.z, yaw }; const age = i / this.N; const w = 5 + age * 30; const cx = Math.cos(q.yaw), sx = -Math.sin(q.yaw);
      this.pos.set([q.x - cx * w, 0.12, q.z - sx * w, q.x + cx * w, 0.12, q.z + sx * w], i * 6); const a = (1 - age) * Math.min(1, speed / 5) * fade * (i < this.pts.length ? 1 : 0); this.a[i * 2] = this.a[i * 2 + 1] = a; }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.aA.needsUpdate = true;
  }
  dispose() { scene.remove(this.mesh); }
}
