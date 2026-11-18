'use strict';
/* ===================== IRON MERIDIAN · world: sky bodies, far lands, civilisation ===================== */

/* ---------- sun, moons, station ---------- */
const glowTex = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.12, 'rgba(255,240,210,.9)'); r.addColorStop(0.35, 'rgba(255,170,90,.28)'); r.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
glowTex.wrapS = glowTex.wrapT = T.ClampToEdgeWrapping;
const SKYOBJ = new T.Group(); scene.add(SKYOBJ);
{
  const sm = (c, o) => new T.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: o, blending: T.AdditiveBlending, depthWrite: false, fog: false });
  const sunCore = new T.Sprite(sm(new T.Color(2.4, 2.1, 1.7), 1)); sunCore.scale.set(520, 520, 1);
  const sunHalo = new T.Sprite(sm(new T.Color(1.2, 0.6, 0.3), 0.55)); sunHalo.scale.set(2600, 2600, 1);
  for (const s of [sunCore, sunHalo]) { s.position.copy(SUN_DIR).multiplyScalar(7400); s.renderOrder = -5; SKYOBJ.add(s); }
  const moonTex = canvasTex(512, 256, (g, w, h) => {
    const id = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = vnoise(x * 0.03, y * 0.03) * 0.5 + vnoise(x * 0.12, y * 0.12) * 0.3 + Math.random() * 0.1; const mare = smooth(0.55, 0.65, vnoise(x * 0.008 + 3, y * 0.012)); const v = (150 + n * 70) * (1 - mare * 0.35); const k = (y * w + x) * 4; id.data[k] = v; id.data[k + 1] = v * 0.98; id.data[k + 2] = v * 0.95; id.data[k + 3] = 255; }
    g.putImageData(id, 0, 0);
    for (let i = 0; i < 160; i++) { const x = Math.random() * w, y = Math.random() * h, r = Math.pow(Math.random(), 3) * 26 + 2; g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = Math.max(1, r * 0.18); g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(x + r * 0.15, y + r * 0.15, r * 0.8, 0, 7); g.fill(); }
  });
  const moon = new T.Mesh(new T.SphereGeometry(430, 48, 32), new T.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0, emissive: 0x2a2c33, emissiveIntensity: 0.6, fog: false, envMapIntensity: 0 }));
  moon.position.set(0.32, 0.4, -0.86).normalize().multiplyScalar(7700); moon.rotation.set(0.3, 1.2, 0.2); SKYOBJ.add(moon);
  const moonGlow = new T.Sprite(sm(new T.Color(0.35, 0.4, 0.55), 0.35)); moonGlow.scale.set(2200, 2200, 1); moonGlow.position.copy(moon.position); SKYOBJ.add(moonGlow);
  const moon2 = new T.Mesh(new T.SphereGeometry(150, 32, 20), new T.MeshStandardMaterial({ map: moonTex, color: 0xd08a64, roughness: 1, metalness: 0, emissive: 0x2a120a, emissiveIntensity: 0.6, fog: false, envMapIntensity: 0 }));
  moon2.position.set(-0.62, 0.52, -0.58).normalize().multiplyScalar(7500); SKYOBJ.add(moon2);
  // orbital civilian station: ring, spokes, hub, docking lights
  const st = new T.Group(); st.position.set(2250, 5600, -320); st.rotation.set(Math.PI / 2, 0, 0);
  const stM = std(0x8f969c, 0.45, 0.6, { map: facadeTex, emissiveMap: facadeLit, emissive: 0xffe2b0, emissiveIntensity: 1.4, fog: false });
  st.add(new T.Mesh(new T.TorusGeometry(260, 16, 12, 72), stM)); st.add(new T.Mesh(new T.SphereGeometry(45, 24, 16), stM));
  for (let i = 0; i < 4; i++) { const sp = new T.Mesh(new T.CylinderGeometry(5, 5, 250, 8), stM); sp.rotation.z = i * Math.PI / 2; sp.position.set(Math.sin(i * Math.PI / 2) * -125, Math.cos(i * Math.PI / 2) * 125, 0); st.add(sp); }
  const beacon = new T.Mesh(new T.SphereGeometry(8, 8, 6), basic(new T.Color(3, 0.6, 0.4), { fog: false })); beacon.position.set(0, 0, 60); st.add(beacon);
  scene.add(st); SKYOBJ.userData = { st, moon, moon2, beacon, sun: [sunCore, sunHalo] };
}

/* ---------- the island ends at the battlefield: open sea beyond the bounds, no unreachable land ---------- */
const CURV_R = 60000;
/* ---------- distant lights (cities, roads, villages) ---------- */
const LIGHTPTS = []; const addLight = (x, y, z, r, g, b, s) => LIGHTPTS.push([x, y, z, r, g, b, s]);
/* ---------- roads ---------- */
const roadTex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#2b2927'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.fillStyle = '#c9b46a'; g.fillRect(30, 0, 4, 120); g.fillStyle = '#9a958c'; g.fillRect(3, 0, 3, h); g.fillRect(w - 6, 0, 3, h); });
const ROADS = [];
const bridgeWP = (i, dir) => { const b = BRIDGES[i]; return [{ x: b.x, z: b.z + 44 * dir }, { x: b.x, z: b.z + 20 * dir }, { x: b.x, z: b.z - 20 * dir }, { x: b.x, z: b.z - 44 * dir }]; };
/* the red-roofed hill towns: under the volcano, the east slopes by the border, the south shore by the archipelago */
const VILLAGES = [new V3(-120, 0, -270), new V3(405, 0, 175), new V3(-150, 0, 395)];
// outskirts: farmsteads with room to breathe (valley farm, eastern pastures, southern steppe, western hills)
for (const [x, z] of [[-410, 230], [380, -90]]) { const v = new V3(x, 0, z); v.farm = true; VILLAGES.push(v); }
(function buildRoads() {
  const RING = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; const r = i % 24 === 0 ? 155 : 176; /* bends in round the top of the Hive */ RING.push({ x: CITYC.x + Math.cos(a) * r, z: CITYC.z + Math.sin(a) * r }); }
  const UNDER = [HQ[1], { x: 0, z: 345 }, { x: 30, z: 318 }, { x: 30, z: 292 }, { x: 30, z: 250 }, { x: 30, z: 150 }, { x: 30, z: 30 }, { x: 30, z: -90 }, { x: 31, z: -180 }, { x: 36, z: -222 }, { x: 40, z: -240 }, { x: 40, z: -272 }, { x: 40, z: -296 }, { x: 40, z: -330 }, { x: 120, z: -372 }, HQ[2]]; UNDER.under = true;
  const routes = [
    UNDER, /* the southern highway: in at the bunker gate, under downtown, out of the north portal and over the bridge to the airport */
    [{ x: -300, z: -40 }, { x: -240, z: -95 }, ...rampPts(RAMPS[0]).reverse(), { x: -60, z: 170 }, CPDEF[0]], /* up the west cliff road */
    [CPDEF[0], { x: 120, z: -60 }, ...rampPts(RAMPS[1]), { x: 250, z: -110 }, { x: 160, z: -200 }, { x: 40, z: -205 }, ...bridgeWP(1, 1), { x: 40, z: -290 }, { x: 120, z: -370 }, HQ[2]], /* down the north-east cliff road to the bridges and the airport */
    RING, /* the Aeris Orbital Highway: the downtown loop */
    [HQ[1], VILLAGES[2], { x: -250, z: 300 }, { x: -300, z: 190 }, CPDEF[1], CPDEF[6], { x: -330, z: -80 }, ...bridgeWP(0, -1).reverse()], /* ends over the river: no road up the volcano's cone */
    [{ x: 250, z: -110 }, { x: 330, z: 60 }, { x: 330, z: 200 }, CPDEF[5], { x: 400, z: 210 }, { x: 430, z: 60 }, { x: 410, z: -110 }, CPDEF[3], ...bridgeWP(2, 1).reverse(), { x: 250, z: -110 }],
  ];
  const mat = new T.MeshStandardMaterial({ map: roadTex, roughness: 0.85, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const r of routes) {
    const curve = new T.CatmullRomCurve3(r.map(p => new V3(p.x, 0, p.z)), r === RING); const L = curve.getLength(); const n = Math.ceil(L / 7);
    const pos = [], uv = [], idx = [], pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curve.getPointAt(t), tg = curve.getTangentAt(t); const nx = -tg.z, nz = tg.x; const nl = Math.hypot(nx, nz) || 1;
      for (const s of [-1, 1]) { const x = p.x + nx / nl * 4 * s, z = p.z + nz / nl * 4 * s, rf = r.under ? null : roofY(p.x, p.z); pos.push(x, (rf !== null ? rf : Math.max(H(x, z), H(p.x, p.z), 0.3)) + 0.12, z); /* over the underpass the road runs on its roof */ uv.push(s < 0 ? 0 : 1, t * L / 24); }
      if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      pts.push(new V3(p.x, groundY(p.x, p.z), p.z));
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, mat); m.receiveShadow = true; scene.add(m); ROADS.push({ curve, L, pts });
  }
  // power pylons with sagging cables along the long coast road
  const R = ROADS[1]; const pyG = mergeGeos([xf(new T.CylinderGeometry(0.25, 0.6, 22, 4), [0, 11, 0]), xf(new T.BoxGeometry(9, 0.4, 0.4), [0, 20, 0]), xf(new T.BoxGeometry(6, 0.4, 0.4), [0, 16, 0])]);
  const py = new T.InstancedMesh(pyG, MAT_GUN, 60); let k = 0; const tops = [];
  for (let d = 30; d < R.L && k < 60; d += 70) { const t = d / R.L, p = R.curve.getPointAt(t), tg = R.curve.getTangentAt(t); const x = p.x - tg.z * 9, z = p.z + tg.x * 9; const gy = H(x, z); if (gy < 0.5 || buildingAt(_v1.set(x, gy + 2, z))) continue; _m.compose(_v1.set(x, gy, z), _q.setFromAxisAngle(UP, Math.atan2(tg.x, tg.z) + Math.PI / 2), _s.set(1, 1, 1)); py.setMatrixAt(k++, _m); tops.push(new V3(x, gy + 20, z)); }
  py.count = k; py.castShadow = true; scene.add(py);
  const lp = []; for (let i = 0; i < tops.length - 1; i++) { const a = tops[i], b = tops[i + 1]; if (a.distanceTo(b) > 120) continue; for (let j = 0; j < 10; j++) { const t0 = j / 10, t1 = (j + 1) / 10; for (const tt of [t0, t1]) { _v1.lerpVectors(a, b, tt); lp.push(_v1.x, _v1.y - Math.sin(tt * Math.PI) * 2.5, _v1.z); } } }
  const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3)); scene.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x151515 })));
  for (const R2 of ROADS) for (let d = 0; d < R2.L; d += 60) { const p = R2.curve.getPointAt(d / R2.L); if (H(p.x, p.z) > 0.5 && Math.hypot(p.x - CITYC.x, p.z - CITYC.z) > 120) addLight(p.x, H(p.x, p.z) + 7, p.z, 2.6, 1.8, 0.9, 3); }
})();

/* ---------- villages: homes, market stalls, lights; destructible ---------- */
(function buildVillages() {
  const roofMats = [std(0x6a3a2a, 0.8, 0.1), std(0x3e4a52, 0.7, 0.2), std(0x5a5446, 0.85, 0.05)];
  const wallMats = [std(0xb8ab94, 0.9, 0), std(0x8f8676, 0.9, 0), std(0xa39a8a, 0.9, 0, { map: facadeTex, emissiveMap: facadeLit, emissive: 0xffffff, emissiveIntensity: 0.8 })];
  for (const v of VILLAGES) {
    let placed = 0;
    for (let i = 0; i < 160 && placed < (v.farm ? 13 : 22); i++) {
      const a = Math.random() * 6.283, r = rand(12, v.farm ? 125 : 75); const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r; const gy = H(x, z); if (gy < 1) continue;
      const w = rand(7, 12) * (v.farm ? 1.25 : 1), d = rand(7, 11) * (v.farm ? 1.2 : 1), h = rand(4.5, 8), gap = v.farm ? 10 : 2;
      if (riverD(x, z) < 28 || buildingAt(_v1.set(x, gy + 2, z)) || BUILDINGS.some(b => Math.abs(b.x - x) < (b.w + w) / 2 + gap && Math.abs(b.z - z) < (b.d + d) / 2 + gap)) continue;
      if (CPDEF.some(c => Math.hypot(c.x - x, c.z - z) < 45)) continue;
      const grp = new T.Group(); const wall = new T.Mesh(new T.BoxGeometry(w, h, d).translate(0, h / 2, 0), pick(wallMats));
      const roof = new T.Mesh(new T.CylinderGeometry(0.01, w * 0.62, h * 0.55, 4, 1).rotateY(Math.PI / 4).translate(0, h + h * 0.27, 0), pick(roofMats)); roof.scale.set(1, 1, d / w);
      const door = new T.Mesh(new T.BoxGeometry(1.4, 2.4, 0.1), MAT_GUN); door.position.set(0, 1.2, d / 2 + 0.05); const win = new T.Mesh(new T.BoxGeometry(1.3, 1.1, 0.1), basic(new T.Color(2.2, 1.5, 0.7))); win.position.set(w * 0.28, h * 0.6, d / 2 + 0.05);
      grp.add(wall, roof, door, win); grp.rotation.y = rand(0, 6.28) * 0;
      BUILDINGS.push(new Building(x, z, w, d, h * 1.5, { mesh: grp, hp: 1800 })); placed++;
      addLight(x, gy + h * 0.6, z + d / 2 + 0.5, 2.2, 1.5, 0.7, 3.5);
    }
    // market stalls & a water tower
    for (let i = 0; i < 5; i++) { const x = v.x + rand(-10, 10), z = v.z + rand(-10, 10), gy = H(x, z); const st = new T.Mesh(new T.ConeGeometry(2.5, 1.6, 4), pick([std(0xa0402a, 0.9, 0), std(0x2a6a7a, 0.9, 0), std(0xc9a040, 0.9, 0)])); st.position.set(x, gy + 3, z); st.castShadow = true; scene.add(st); }
    const tx = v.x + 30, tz = v.z - 30, tg = H(tx, tz); const tower = new T.Group(); tower.add(new T.Mesh(new T.CylinderGeometry(4, 4, 5, 14).translate(0, 16, 0), MAT_RUST)); for (const [lx, lz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) { const l = new T.Mesh(new T.BoxGeometry(0.4, 14, 0.4).translate(0, 7, 0), MAT_GUN); l.position.set(lx, 0, lz); tower.add(l); }
    if (tg > 1) BUILDINGS.push(new Building(tx, tz, 8, 8, 19, { mesh: tower, mode: 'topple', hp: 1500 }));
  }
})();
/* ---------- river bridges, farms, fields and wind turbines ---------- */
const TURBINES = [];
(function buildCountry() {
  const M = { stone: std(0x8a8072, 0.9, 0.03, { normalMap: TEX.armor.normal }), iron: MAT_GUN, barn: std(0x7a3226, 0.85, 0.05), roof: std(0x3c3f44, 0.6, 0.4), white: std(0xd8d6d0, 0.5, 0.2), silo: std(0x9a9a96, 0.4, 0.7), hay: std(0xb89a4a, 1, 0) };
  // bridges: stone causeways with parapets, buttresses and lamps
  const bb = bucket();
  for (const br of BRIDGES) {
    const L = 92, y = 2.8;
    bb.add('stone', xf(new T.BoxGeometry(11, 0.9, L), [br.x, y - 0.45, br.z]));
    for (const s of [-1, 1]) {
      bb.add('stone', xf(new T.BoxGeometry(0.7, 1.1, L), [br.x + s * 5.3, y + 0.55, br.z])); bb.add('stone', xf(new T.BoxGeometry(0.9, 5.6, 64), [br.x + s * 5.7, -2.6, br.z]));
      for (let k = -30; k <= 30; k += 10) { bb.add('stone', xf(new T.BoxGeometry(1.6, 6.8, 1.8), [br.x + s * 6.2, -2.6, br.z + k])); bb.add('iron', xf(new T.CylinderGeometry(0.12, 0.16, 5, 6), [br.x + s * 5.3, y + 3.6, br.z + k])); addLight(br.x + s * 5.3, y + 6.2, br.z + k, 2.8, 2, 1, 4); }
    }
  }
  const bg = new T.Group(); bakeInto(bg, bb, M); scene.add(bg);
  // farm structures on the outskirts: barns, silos, hay
  const fb = bucket(), fieldPos = [], fieldCol = [];
  for (const v of VILLAGES.filter(q => q.farm)) {
    for (let i = 0, n = 0; i < 40 && n < 3; i++) { // barns and silo pairs, big and spaced out
      const a = Math.random() * 6.283, r = rand(40, 140), x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r, gy = H(x, z), w = rand(20, 28), d = rand(13, 17), h = rand(8, 11);
      if (gy < 1.5 || riverD(x, z) < 35 || BUILDINGS.some(b => Math.abs(b.x - x) < (b.w + w) / 2 + 14 && Math.abs(b.z - z) < (b.d + d) / 2 + 14)) continue;
      const g = new T.Group(), k = bucket();
      k.add('barn', new T.BoxGeometry(w, h, d).translate(0, h / 2, 0)); k.add('roof', prism(w + 1, d + 1.2, h * 0.55).translate(0, h, 0));
      k.add('white', xf(new T.BoxGeometry(5, 6, 0.3), [0, 3, d / 2 + 0.1])); k.add('white', xf(new T.BoxGeometry(0.4, 6, 0.35), [0, 3, d / 2 + 0.2], [0, 0, 0.7])); k.add('white', xf(new T.BoxGeometry(w + 0.2, 0.4, d + 0.2), [0, h, 0]));
      bakeInto(g, k, M); BUILDINGS.push(new Building(x, z, w, d, h * 1.5, { mesh: g, hp: 5200 })); n++;
      for (let j = 0; j < 2; j++) { const sx = x + w / 2 + 6 + j * 8, sz = z - d / 4, sh = rand(14, 19); if (H(sx, sz) < 1.5) continue; const sg = new T.Group(), sk = bucket(); sk.add('silo', new T.CylinderGeometry(3.4, 3.4, sh, 18).translate(0, sh / 2, 0)); sk.add('silo', new T.SphereGeometry(3.5, 18, 8, 0, 6.283, 0, Math.PI / 2).translate(0, sh, 0)); for (let y = 3; y < sh; y += 3) sk.add('iron', new T.CylinderGeometry(3.5, 3.5, 0.25, 18).translate(0, y, 0)); bakeInto(sg, sk, M); BUILDINGS.push(new Building(sx, sz, 7, 7, sh + 3, { mesh: sg, mode: 'topple', hp: 2600 })); }
      for (let j = 0; j < 6; j++) { const hx = x + rand(-w, w), hz = z + d / 2 + rand(6, 16), hy = H(hx, hz); if (hy > 1) fb.add('hay', new T.CylinderGeometry(0.9, 0.9, 1.4, 12).rotateX(Math.PI / 2).rotateY(rand(0, 3)).translate(hx, hy + 0.9, hz)); }
    }
    // crop fields draped over the ground, striped by row
    for (let f = 0; f < 6; f++) {
      const a = f * 1.05 + rand(-0.3, 0.3), r = rand(110, 190), cx = v.x + Math.cos(a) * r, cz = v.z + Math.sin(a) * r, fw = rand(60, 95), fd = rand(45, 75), rot = rand(0, 3), ca = Math.cos(rot), sa = Math.sin(rot);
      const pal = pick([[[0.62, 0.5, 0.22], [0.5, 0.39, 0.16]], [[0.3, 0.42, 0.16], [0.22, 0.32, 0.12]], [[0.45, 0.36, 0.24], [0.35, 0.27, 0.18]]]);
      const N = 24, pts = []; let ok = true;
      for (let j = 0; j <= N && ok; j++) for (let i = 0; i <= 8; i++) { const lx = (i / 8 - 0.5) * fw, lz = (j / N - 0.5) * fd, x = cx + lx * ca - lz * sa, z = cz + lx * sa + lz * ca, y = H(x, z); if (y < 1 || riverD(x, z) < 26 || Math.abs(x) > BOUND || Math.abs(z) > BOUND || buildingAt(_v1.set(x, y + 1, z))) { ok = false; break; } pts.push([x, y + 0.18, z, pal[j % 2]]); }
      if (!ok) continue;
      for (let j = 0; j < N; j++) for (let i = 0; i < 8; i++) { const q = j * 9 + i; for (const t of [q, q + 9, q + 1, q + 1, q + 9, q + 10]) { const p = pts[t]; fieldPos.push(p[0], p[1], p[2]); const c = pts[j * 9][3]; fieldCol.push(c[0], c[1], c[2]); } }
    }
  }
  const fg = new T.Group(); bakeInto(fg, fb, M); scene.add(fg);
  if (fieldPos.length) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(fieldPos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(fieldCol, 3)); g.computeVertexNormals(); const m = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); m.receiveShadow = true; scene.add(m); }
  // wind turbines along the southern valley ridge and the western hills (destructible, they topple)
  const spots = [[-548, -40], [-560, 40], [-540, 120], [-520, -120], [-470, -200], [430, -170], [455, -60]]; /* a wind farm out at sea off the west coast, two on the east ridge */
  for (const [x, z] of spots) {
    if (CPDEF.some(c => Math.hypot(c.x - x, c.z - z) < 70)) continue; const sea = H(x, z) < 1;
    const g = new T.Group(), k = bucket(); k.add('white', new T.CylinderGeometry(0.7, 1.4, 48, 12).translate(0, 24, 0)); if (sea) k.add('stone', new T.CylinderGeometry(3, 3.6, 34, 10).translate(0, -15, 0)); /* a monopile out of the water */ k.add('white', xf(rbox(2.2, 2.2, 6, 0.6, 2), [0, 49, -0.8])); bakeInto(g, k, M);
    const rotor = new T.Group(); rotor.position.set(0, 49, 2.4); const rk = bucket(); rk.add('white', new T.SphereGeometry(0.9, 10, 8)); for (let i = 0; i < 3; i++) rk.add('white', xf(new T.BoxGeometry(0.5, 21, 1.4), [0, 11, 0]).rotateZ(i * 2.094)); bakeInto(rotor, rk, M); g.add(rotor);
    g.rotation.y = rand(-0.4, 0.4); TURBINES.push({ rotor, s: rand(0.7, 1.2) }); addLight(x, H(x, z) + 51, z, 3.5, 0.4, 0.3, 6);
    BUILDINGS.push(new Building(x, z, 4, 4, 50, { mesh: g, mode: 'topple', hp: 2200 }));
  }
})();
// fold all small lights into one glow layer
(function buildLights() {
  const pos = new Float32Array(LIGHTPTS.length * 3), col = new Float32Array(LIGHTPTS.length * 3), size = new Float32Array(LIGHTPTS.length);
  LIGHTPTS.forEach((l, i) => { pos.set([l[0], l[1], l[2]], i * 3); col.set([l[3], l[4], l[5]], i * 3); size[i] = l[6]; });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('pcolor', new T.BufferAttribute(col, 3)); g.setAttribute('size', new T.BufferAttribute(size, 1));
  const m = new T.ShaderMaterial({ uniforms: { tex: { value: glowTex }, scale: FXA.mat.uniforms.scale, t: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
    vertexShader: `attribute float size; attribute vec3 pcolor; uniform float scale,t; varying vec3 vC; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; float d=-mv.z; gl_PointSize=clamp(size*scale/max(d,1.)*(1.+d*.0009),1.5,60.); float fl=.85+.15*sin(t*3.+position.x*.7+position.z); vC=pcolor*fl*(.55+.45*smoothstep(150.,900.,d)); }`,
    fragmentShader: `uniform sampler2D tex; varying vec3 vC; void main(){ vec4 c=texture2D(tex,gl_PointCoord); gl_FragColor=vec4(vC*c.a,1.); ${OUT} }` });
  const pts = new T.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 8; scene.add(pts); SKYOBJ.userData.lights = m;
})();

/* ---------- hover traffic on the roads (the idle walking civilians were removed) ---------- */
const CIV = [];
{
  const carG = mergeGeos([xf(rbox(2.4, 1.2, 5.2, 0.4), [0, 1.3, 0]), xf(rbox(2.2, 0.9, 2.2, 0.35), [0, 2.2, 0.8])]);
  const carMats = [std(0xd8d4cc, 0.35, 0.5), std(0x2a5a8a, 0.35, 0.5), std(0xa83a2a, 0.35, 0.5), std(0x3a3a3a, 0.35, 0.5)];
  const lightG = new T.BoxGeometry(2, 0.2, 0.1), hl = basic(new T.Color(3, 2.8, 2.2)), tl = basic(new T.Color(3, 0.3, 0.2));
  for (let i = 0; i < 16; i++) {
    const g = new T.Group(); const b = new T.Mesh(carG, pick(carMats)); b.castShadow = true; g.add(b);
    const f = new T.Mesh(lightG, hl); f.position.set(0, 1.4, 2.62); const r = new T.Mesh(lightG, tl); r.position.set(0, 1.4, -2.62); const under = new T.Mesh(new T.PlaneGeometry(2, 4.6).rotateX(Math.PI / 2), addMat(0x6ab8ff, 0.5)); under.position.y = 0.55; g.add(f, r, under); scene.add(g);
    const road = ROADS[i % ROADS.length]; CIV.push({ m: g, road, t: Math.random(), dir: Math.random() < 0.5 ? 1 : -1, off: 2, sp: rand(9, 16), ph: 0, kind: 'car' });
  }
}
function updateCivilians(dt) {
  for (const c of CIV) {
    const R = c.road; c.t += c.dir * c.sp * dt / R.L;
    if (c.t > 1 || c.t < 0) { c.dir *= -1; c.t = clamp(c.t, 0, 1); }
    const uu = clamp(c.t, 0, 1), p = R.curve.getPointAt(uu, _v3), tg = R.curve.getTangentAt(uu, _v4);
    const side = c.kind === 'car' ? (c.dir > 0 ? 2 : -2) : c.off;
    const x = p.x - tg.z * side, z = p.z + tg.x * side;
    c.ph += dt * c.sp * 5;
    const y = Math.max(H(x, z), 0.3) + (c.kind === 'car' ? 0.4 + Math.sin(TIME * 3 + c.t * 50) * 0.08 : Math.abs(Math.sin(c.ph)) * 0.05);
    c.m.position.set(x, y, z); c.m.rotation.y = Math.atan2(tg.x * c.dir, tg.z * c.dir);
    if (c.kind === 'car' && Math.random() < 0.08) fxDust(_v1.set(x, y - 0.4, z), 1, 1.5, 2);
  }
}

function updateWorld(dt) {
  const u = SKYOBJ.userData; SKYOBJ.position.copy(camera.position);
  u.st.rotation.z += dt * 0.02; u.beacon.visible = Math.sin(TIME * 2.5) > 0.2; u.lights.uniforms.t.value = TIME;
  updateCivilians(dt); updateOrbit(dt); updateAsh(dt);
  const cy = camera.position.y;
  PLANET.visible = cy > 420; PLANET.userData.clouds.rotation.y += dt * 0.0006; cloudU.fade.value = 1 - smooth(900, 1600, cy) * 0.85;
  // near plane rises with altitude: keeps depth precision (no water/terrain z-fighting from the air or orbit)
  const pd = PLAYER.ent && PLAYER.ent.alive ? camera.position.distanceTo(PLAYER.ent.pos) : 1e9, agl = cy - surfY(camera.position.x, camera.position.z, cy), near = clamp(Math.round(Math.min((agl - 20) * 0.015, pd * 0.3) * 4) / 4, 0.3, 30), far = cy > 600 ? 75000 : 14000; if (camera.near !== near || camera.far !== far) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
}

/* ---------- cinematic vistas: space, ocean, land, city, spaceport ---------- */
const VISTAS = [
  { name: 'Low orbit over Aeris', sub: 'Fleets trading fire above the clouds', pos: () => new V3(-300, 2700, 1700), look: () => DREADS[2].position.clone().lerp(new V3(0, 0, 0), 0.45), fov: 60, drift: new V3(22, 2, -14) },
  { name: 'The volcano', sub: 'Ash over the north-west', pos: () => new V3(-120, 70, -120), look: () => new V3(VOLCANO.x, 120, VOLCANO.z), fov: 55, drift: new V3(-5, 0.5, 3) },
  { name: 'Above the clouds', sub: 'Moonrise over the war', pos: () => new V3(120, 760, 420), look: () => new V3(0.32, 0.4, -0.86).multiplyScalar(5000).add(new V3(120, 760, 420)), fov: 50, drift: new V3(10, 1, -6) },
  { name: 'The Tidewater Sea', sub: 'Fleets at sunset', pos: () => new V3(coastX(150) + 110, 7, 260), look: () => new V3(coastX(-200) + 60, 15, -200), fov: 55, drift: new V3(0, 0.4, -6) },
  { name: 'Downtown Core', sub: 'The city burns', pos: () => new V3(-190, MESA.top + 60, 250), look: () => new V3(CITYC.x, MESA.top + 70, CITYC.z), fov: 55, drift: new V3(8, 0, -4) },
  { name: 'Hollow Creek village', sub: 'Civilians heading for the evac point', pos: () => VILLAGES[0].clone().add(new V3(50, H(VILLAGES[0].x + 50, VILLAGES[0].z + 40) + 9, 40)), look: () => VILLAGES[0].clone().setY(H(VILLAGES[0].x, VILLAGES[0].z) + 3), fov: 55, drift: new V3(-3, 0.3, 2) },
];

/* ---------- the planet seen from orbit: curved surface, cloud shell, atmosphere limb ---------- */
const PLANET = new T.Group(); scene.add(PLANET); PLANET.visible = false;
(function buildPlanet() {
  const R = CURV_R, S = 1024, SPAN = 72000;
  const surf = canvasTex(S, S, (g) => {
    const id = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const wx = (x / S - 0.5) * SPAN, wz = (y / S - 0.5) * SPAN; const n = fbm(wx * 0.00032 + 11, wz * 0.00032 - 4, 4); const h = (n - 0.47) * 700; const k = (y * S + x) * 4; let c;
      if (h < -60) c = [8, 26, 44]; else if (h < 0) c = [18, 60, 72]; else if (h < 8) c = [150, 135, 100]; else { const m = vnoise(wx * 0.0008, wz * 0.0008); const dz = smooth(0.5, 0.75, vnoise(wx * 0.0002 + 4, wz * 0.0002)); c = [lerp(52 + m * 30, 170, dz), lerp(70 + m * 20, 140, dz), lerp(36, 90, dz)]; if (h > 160) c = [190, 190, 195]; }
      id.data[k] = c[0]; id.data[k + 1] = c[1]; id.data[k + 2] = c[2]; id.data[k + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  });
  surf.wrapS = surf.wrapT = T.ClampToEdgeWrapping;
  const cloudsT = canvasTex(512, 512, (g) => { const id = g.createImageData(512, 512); for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) { const n = fbm(x * 0.012, y * 0.012, 5); const a = smooth(0.5, 0.72, n); const k = (y * 512 + x) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = 240; id.data[k + 3] = a * 235; } g.putImageData(id, 0, 0); });
  const cap = (rad, th) => { const gg = new T.SphereGeometry(rad, 160, 40, 0, Math.PI * 2, 0, th); const p = gg.attributes.position, uv = gg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / SPAN + 0.5, -p.getZ(i) / SPAN + 0.5); gg.translate(0, -rad, 0); return gg; };
  const ground = new T.Mesh(cap(R, 0.62), new T.MeshStandardMaterial({ map: surf, roughness: 0.9, metalness: 0, fog: false, envMapIntensity: 0.3 })); ground.position.y = -30; ground.renderOrder = -2; PLANET.add(ground);
  const cl = new T.Mesh(cap(R + 900, 0.62), new T.MeshStandardMaterial({ map: cloudsT, transparent: true, depthWrite: false, roughness: 1, metalness: 0, fog: false, emissive: 0x30302c })); cl.position.y = 900 - 30; cl.material.map.repeat.set(1, 1); PLANET.add(cl); PLANET.userData.clouds = cl;
  const atm = new T.Mesh(cap(R + 2600, 0.7), new T.ShaderMaterial({ uniforms: { sunDir: { value: SUN_DIR } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.FrontSide, fog: false,
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 w=modelMatrix*vec4(position,1.); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sunDir; varying vec3 vN; varying vec3 vV; void main(){ float f=1.-abs(dot(vN,vV)); float a=pow(f,5.)*1.4+pow(f,1.6)*.12; vec3 c=mix(vec3(.35,.6,1.2),vec3(1.2,.6,.3),pow(max(dot(vV,-sunDir),0.),4.)*.6); gl_FragColor=vec4(c*a,1.); ${OUT} }` }));
  atm.position.y = 2600 - 30; PLANET.add(atm);
})();

/* ---------- orbital fleets: escort cruisers that trade fire and break apart ---------- */
renderer.localClippingEnabled = true;
const ORBIT = { ships: [], chunks: [], beamT: 2, killT: 35 };
const orbDebris = new T.InstancedMesh(new T.BoxGeometry(1, 0.3, 1.6), std(0x3a3a3c, 0.6, 0.7, { fog: false, normalMap: TEX.armor.normal }), 260); orbDebris.frustumCulled = false; scene.add(orbDebris);
const ORB_DEB = []; for (let i = 0; i < 260; i++) { const permanent = i < 120; ORB_DEB.push({ p: new V3(rand(-1600, 1600), rand(1700, 2600), rand(-1600, 1600)), v: randDir(new V3()).multiplyScalar(permanent ? rand(0.5, 2) : 0), r: new T.Euler(rand(0, 6), rand(0, 6), rand(0, 6)), rv: new V3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3)), s: rand(2, 14), life: permanent ? 1e9 : 0 }); }
function spawnCruiser(team, idx, warp) {
  const sc = rand(1.1, 1.6); const g = buildCapital(team, true, sc); const base = DREADS[team].position;
  const off = new V3((idx - 1) * 520 + rand(-80, 80), rand(-260, 260), (team === 1 ? -1 : 1) * rand(250, 600)); g.position.copy(base).add(off); g.rotation.y = team === 1 ? Math.PI + rand(-0.3, 0.3) : rand(-0.3, 0.3); scene.add(g);
  const s = { g, team, idx, sc, ph: Math.random() * 10, home: g.position.clone(), dying: 0 };
  ORBIT.ships.push(s);
  if (warp) { FXA.spawn(g.position.x, g.position.y, g.position.z, 0, 0, 0, 0.9, 300, 900, 3, 3.4, 4, 0.4, 0.7, 2, 1, 0, 0); flashLight(g.position, 20, 2000, 1, 0xbfe0ff); }
  return s;
}
for (const t of [1, 2]) for (let i = 0; i < 3; i++) spawnCruiser(t, i, false);
function plasmaBurst(p, s) {
  FXA.spawn(p.x, p.y, p.z, 0, 0, 0, 0.5, 30 * s, 110 * s, 3, 3.6, 4.5, 0.4, 0.8, 2.4, 1, 0, 0);
  for (let i = 0; i < 18; i++) { randDir(_v5); FXA.spawn(p.x, p.y, p.z, _v5.x * 60 * s, _v5.y * 60 * s, _v5.z * 60 * s, rand(0.6, 1.4), 6 * s, 2 * s, 1.5, 2.5, 4, 0.2, 0.5, 2, 1, 0.4, 0); }
  for (let i = 0; i < 6; i++) { randDir(_v5); FXS.spawn(p.x, p.y, p.z, _v5.x * 10 * s, _v5.y * 10 * s, _v5.z * 10 * s, rand(4, 8), 20 * s, 70 * s, 0.1, 0.1, 0.12, 0.05, 0.05, 0.06, 0.6, 0.05, 0); }
  flashLight(p, 14, 900, 0.5, 0x9fd0ff);
}
function breakShip(s) {
  const g = s.g; scene.remove(g); g.updateMatrixWorld(true);
  for (const half of [1, -1]) {
    const c = g.clone(); const plane = new T.Plane(); const mats = [];
    c.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.clippingPlanes = [plane]; o.material.clipShadows = true; o.material.side = T.DoubleSide; mats.push(o.material); } });
    scene.add(c);
    const ch = { c, plane, half, v: new V3(rand(-4, 4), rand(-3, 1), half * rand(6, 12)).applyEuler(new T.Euler(0, g.rotation.y, 0)), av: new V3(rand(-0.06, 0.06), rand(-0.04, 0.04), rand(-0.08, 0.08)), t: 0, sc: s.sc };
    ORBIT.chunks.push(ch);
  }
  for (const d of ORB_DEB) if (d.life < 1e8 && d.life <= 0) { d.p.copy(g.position).add(randDir(_v1).multiplyScalar(rand(5, 80))); d.v.copy(randDir(_v1)).multiplyScalar(rand(10, 45)); d.life = rand(20, 40); d.s = rand(2, 10); if (Math.random() < 0.5) continue; }
  for (let i = 0; i < 4; i++) plasmaBurst(_v1.copy(g.position).add(randDir(_v2).multiplyScalar(60)), 1.6);
  snd('big', g.position, 1.5);
  comms(null, s.team === 1 ? 'We lost an escort cruiser in orbit! She just broke in half!' : 'Vanta cruiser destroyed in high orbit! Look at her split!', 'cmd');
  ORBIT.ships.splice(ORBIT.ships.indexOf(s), 1);
  setTimeout(() => { spawnCruiser(s.team, s.idx, true); comms(null, s.team === 1 ? 'Replacement cruiser has jumped in.' : 'Another Vanta cruiser just dropped out of hyperspace.', s.team === 1 ? 'b' : 'r'); }, rand(40, 70) * 1000);
}
function updateOrbit(dt) {
  for (let si = ORBIT.ships.length - 1; si >= 0; si--) { const s = ORBIT.ships[si];
    s.ph += dt; s.g.position.set(s.home.x + Math.sin(s.ph * 0.05) * 60, s.home.y + Math.sin(s.ph * 0.07) * 15, s.home.z + Math.cos(s.ph * 0.04) * 40);
    if (s.dying > 0) { s.dying += dt; s.g.rotation.z += dt * 0.02; if (Math.random() < dt * 6) plasmaBurst(_v1.set(rand(-25, 25), rand(-8, 14), rand(-100, 80)).multiplyScalar(s.sc).applyMatrix4(s.g.matrixWorld), rand(0.4, 0.9)); if (s.dying > 6) breakShip(s); }
  }
  ORBIT.beamT -= dt;
  if (ORBIT.beamT <= 0 && ORBIT.ships.length) {
    ORBIT.beamT = rand(1.2, 3); const a = pick(ORBIT.ships); const foes = ORBIT.ships.filter(o => o.team !== a.team); const b = foes.length ? pick(foes) : null;
    if (b) { for (let k = 0; k < 3; k++) setTimeout(() => { if (!a.g.parent || !b.g.parent) return; _v1.copy(a.g.position).add(randDir(_v2).multiplyScalar(40)); _v3.copy(b.g.position).add(randDir(_v2).multiplyScalar(70)); fireProj({ from: _v1, to: _v3, speed: 900, kind: 'heavy', team: 0, dmg: 0, splash: 0, w: 3, len: 90, color: TEAM[a.team].laser, fx: 0.5, checkEnts: false, life: 6 }); }, k * 220); }
  }
  ORBIT.killT -= dt;
  if (ORBIT.killT <= 0) { ORBIT.killT = rand(55, 85); const alive = ORBIT.ships.filter(s => !s.dying); if (alive.length > 2) { const s = pick(alive); s.dying = 0.001; comms(null, `Reactor breach on a ${s.team === 1 ? 'Meridian' : 'Vanta'} cruiser in high orbit!`, 'cmd'); } }
  for (let i = ORBIT.chunks.length - 1; i >= 0; i--) {
    const ch = ORBIT.chunks[i]; ch.t += dt; ch.v.y -= dt * (ch.t > 20 ? 3 : 0.4);
    ch.c.position.addScaledVector(ch.v, dt); ch.c.rotation.x += ch.av.x * dt; ch.c.rotation.y += ch.av.y * dt; ch.c.rotation.z += ch.av.z * dt; ch.c.updateMatrixWorld(true);
    _v1.set(0, 0, 1).applyQuaternion(ch.c.quaternion).multiplyScalar(-ch.half); _v2.set(0, 0, 0).applyMatrix4(ch.c.matrixWorld); ch.plane.setFromNormalAndCoplanarPoint(_v1, _v2);
    if (Math.random() < 0.5) { _v3.copy(_v1).multiplyScalar(-1); FXS.spawn(_v2.x, _v2.y, _v2.z, _v3.x * 4 + rand(-2, 2), rand(-2, 2), _v3.z * 4 + rand(-2, 2), rand(4, 8), 14 * ch.sc, 50 * ch.sc, 0.08, 0.07, 0.07, 0.05, 0.05, 0.05, 0.7, 0.02, 0); FXA.spawn(_v2.x + rand(-15, 15), _v2.y + rand(-8, 8), _v2.z + rand(-15, 15), 0, 0, 0, 0.4, 14, 4, 4, 2, 0.8, 1, 0.3, 0.1, 1, 0, 0); }
    if (ch.t > 26 && ch.t < 26.05) plasmaBurst(_v2, 1.2);
    if (ch.t > 70 || ch.c.position.y < 700) { scene.remove(ch.c); ch.c.traverse(o => { if (o.isMesh && o.material) o.material.dispose(); }); ORBIT.chunks.splice(i, 1); }
  }
  for (let i = 0; i < ORB_DEB.length; i++) {
    const d = ORB_DEB[i]; if (d.life < 1e8) d.life -= dt; const on = d.life > 0;
    d.p.addScaledVector(d.v, dt); d.r.x += d.rv.x * dt; d.r.y += d.rv.y * dt;
    if (d.life > 1e8 && (Math.abs(d.p.x) > 1800 || Math.abs(d.p.z) > 1800)) d.v.multiplyScalar(-1);
    const sc = on ? d.s : 0; _m.compose(d.p, _q.setFromEuler(d.r), _s.set(sc, sc, sc)); orbDebris.setMatrixAt(i, _m);
  }
  orbDebris.instanceMatrix.needsUpdate = true;
}


/* ---------- drifting ash and embers around the camera ---------- */
const ASH = (() => {
  const N = 1400, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = rand(-60, 60); pos[i * 3 + 1] = rand(-20, 40); pos[i * 3 + 2] = rand(-60, 60); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
  const p = new T.Points(g, new T.PointsMaterial({ size: 0.22, map: puffTex, color: 0xd8cfc4, transparent: true, opacity: 0.75, depthWrite: false })); p.frustumCulled = false; scene.add(p);
  const em = new Float32Array(120 * 3); for (let i = 0; i < 120; i++) { em[i * 3] = rand(-50, 50); em[i * 3 + 1] = rand(-10, 30); em[i * 3 + 2] = rand(-50, 50); }
  const g2 = new T.BufferGeometry(); g2.setAttribute('position', new T.BufferAttribute(em, 3));
  const p2 = new T.Points(g2, new T.PointsMaterial({ size: 0.18, map: puffTex, color: new T.Color(3, 1.3, 0.4), transparent: true, blending: T.AdditiveBlending, depthWrite: false })); p2.frustumCulled = false; scene.add(p2);
  return { p, g, pos, N, p2, g2, em };
})();
function updateAsh(dt) {
  const c = camera.position, on = c.y < 500; ASH.p.visible = ASH.p2.visible = on; if (!on) return;
  ASH.p.position.copy(c); ASH.p2.position.copy(c);
  const P = ASH.pos; for (let i = 0; i < ASH.N; i++) { P[i * 3] += (1.2 + Math.sin(TIME + i) * 0.5) * dt; P[i * 3 + 1] -= (0.6 + (i % 7) * 0.12) * dt; P[i * 3 + 2] += Math.cos(TIME * 0.7 + i) * 0.4 * dt; if (P[i * 3 + 1] < -20) P[i * 3 + 1] += 60; if (P[i * 3] > 60) P[i * 3] -= 120; }
  const E = ASH.em; for (let i = 0; i < 120; i++) { E[i * 3] += Math.sin(TIME * 2 + i) * 1.5 * dt; E[i * 3 + 1] += (1 + (i % 5) * 0.3) * dt; if (E[i * 3 + 1] > 30) E[i * 3 + 1] -= 40; }
  ASH.g.attributes.position.needsUpdate = true; ASH.g2.attributes.position.needsUpdate = true;
}
/* ---------- tiered pine crowns: three stacked, twisted cones instead of a single paper cone ---------- */
if (TREE_CROWNS) { const old = TREE_CROWNS.geometry; TREE_CROWNS.geometry = mergeGeos([xf(new T.ConeGeometry(2.5, 4.6, 8), [0, 5.2, 0]), xf(new T.ConeGeometry(2.0, 4.0, 8), [0, 7.3, 0], [0, 0.4, 0]), xf(new T.ConeGeometry(1.35, 3.4, 7), [0, 9.4, 0], [0, 0.8, 0])]); old.dispose(); }
