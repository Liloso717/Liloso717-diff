'use strict';
/* ===================== IRON MERIDIAN · designer details: craters, casings, flags, street life ===================== */
const craterTex = canvasTex(128, 128, (g, w, h) => {
  const id = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (x - 64) / 64, dy = (y - 64) / 64, d0 = Math.hypot(dx, dy), d = d0 * (0.9 + vnoise(Math.atan2(dy, dx) * 3 + 5, d0 * 2) * 0.25); const k = (y * w + x) * 4;
    const inner = smooth(0.55, 0.0, d), rim = Math.exp(-Math.pow((d - 0.62) / 0.08, 2)), outer = smooth(1.0, 0.5, d) * (0.5 + vnoise(x * 0.15, y * 0.15) * 0.5);
    const v = 20 + rim * 70; id.data[k] = v; id.data[k + 1] = v * 0.92; id.data[k + 2] = v * 0.85; id.data[k + 3] = clamp(inner * 0.95 + rim * 0.8 + outer * 0.55, 0, 1) * 255; }
  g.putImageData(id, 0, 0);
});
craterTex.wrapS = craterTex.wrapT = T.ClampToEdgeWrapping;
const CRATER_MAX = 220;
const craters = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: craterTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), CRATER_MAX);
craters.frustumCulled = false; craters.receiveShadow = true; craters.renderOrder = 1; scene.add(craters);
for (let i = 0; i < CRATER_MAX; i++) { _m.makeScale(0, 0, 0); craters.setMatrixAt(i, _m); }
let craterI = 0;
function addCrater(x, z, size) {
  const y = H(x, z); if (y < 0.3) return; _v1.set(H(x - 2, z) - H(x + 2, z), 4, H(x, z - 2) - H(x, z + 2)).normalize(); _q.setFromUnitVectors(UP, _v1); _q2.setFromAxisAngle(UP, Math.random() * 6.28); _q.multiply(_q2);
  _m.compose(_v2.set(x, y + 0.12, z), _q, _s.set(size, 1, size)); craters.setMatrixAt(craterI, _m); craters.instanceMatrix.needsUpdate = true; craterI = (craterI + 1) % CRATER_MAX;
}
for (let i = 0; i < 90; i++) { const c = pick(CPDEF); addCrater(c.x + rand(-140, 140), c.z + rand(-140, 140), rand(4, 12)); }
{
  const _fx = fxExplosion;
  fxExplosion = function (p, scale = 1, opts) { _fx(p, scale, opts); if (scale >= 1.3 && p.y - groundY(p.x, p.z) < 3 + scale * 1.5) addCrater(p.x, p.z, scale * 2.8 + rand(0, 2)); };
}
/* ---------- brass casings from rifles near the camera ---------- */
const CAS_MAX = 200;
const casings = new T.InstancedMesh(new T.CylinderGeometry(0.012, 0.012, 0.05, 6), std(0xc89a40, 0.3, 0.9), CAS_MAX); casings.frustumCulled = false; scene.add(casings);
const CAS = []; for (let i = 0; i < CAS_MAX; i++) { CAS.push({ p: new V3(), v: new V3(), r: new T.Euler(), life: 0 }); _m.makeScale(0, 0, 0); casings.setMatrixAt(i, _m); }
let casI = 0;
function ejectCasing(p, yaw) { if (camera.position.distanceToSquared(p) > 2500) return; const c = CAS[casI]; casI = (casI + 1) % CAS_MAX; c.p.copy(p); c.v.set(Math.cos(yaw) * rand(1.5, 2.5), rand(2, 3.5), -Math.sin(yaw) * rand(1.5, 2.5)); c.life = 6; c.r.set(rand(0, 6), rand(0, 6), 0); }
function updateCasings(dt) {
  for (let i = 0; i < CAS_MAX; i++) { const c = CAS[i]; if (c.life <= 0) continue; c.life -= dt; const g = groundY(c.p.x, c.p.z); if (c.p.y > g + 0.01) { c.v.y -= 15 * dt; c.p.addScaledVector(c.v, dt); c.r.x += dt * 20; if (c.p.y < g) { c.p.y = g + 0.01; c.v.multiplyScalar(0.25); c.v.y = Math.abs(c.v.y) * 0.4; } }
    _q.setFromEuler(c.r); _m.compose(c.p, _q, _s.setScalar(c.life > 0 ? 1 : 0)); casings.setMatrixAt(i, _m); }
  casings.instanceMatrix.needsUpdate = true;
}
{
  const _sb = shootBullet;
  shootBullet = function (src, from, tgt, acc, dmg) { _sb(src, from, tgt, acc, dmg); if (src && src.kind === 'soldier') ejectCasing(from, src.yaw || 0); };
}
/* ---------- command post flags become real cloth ---------- */
for (const cp of CPS) { const g = new T.PlaneGeometry(6, 3.4, 12, 6).translate(3, 0, 0); cp.flag.geometry = g; cp.flag.position.x = 0.25; FLAGS.push({ m: cp.flag, base: g.attributes.position.array.slice(), w: 6, ph: Math.random() * 6 }); }
/* ---------- street furniture: lamps, parked and burned-out cars, barriers ---------- */
(function streetLife() {
  const lamps = [], cars = [];
  for (let gx = -7; gx <= 6; gx++) for (let z = -240; z <= 240; z += 26) {
    for (const [x, zz, ax] of [[gx * 34 + 17, z, 1], [z, gx * 34 + 17, 0]]) {
      if (Math.hypot(x, zz) > 245 || Math.hypot(x, zz) < 30) continue; if (buildingAt(_v1.set(x, H(x, zz) + 2, zz))) continue;
      if (Math.random() < 0.55) lamps.push([x + (ax ? 5.5 : 0), zz + (ax ? 0 : 5.5), ax]);
      if (Math.random() < 0.35) { const o = rand(-3, 3); cars.push([x + (ax ? o : rand(-10, 10)), zz + (ax ? rand(-10, 10) : o), ax ? 0 : Math.PI / 2, Math.random() < 0.35]); }
    }
  }
  const poleG = mergeGeos([xf(new T.CylinderGeometry(0.12, 0.18, 7, 6), [0, 3.5, 0]), xf(rbox(0.12, 0.12, 2.2, 0.04, 1), [0, 6.9, 1.0])]);
  const poles = new T.InstancedMesh(poleG, MAT_GUN, lamps.length), heads = new T.InstancedMesh(rbox(0.5, 0.18, 0.8, 0.06, 1), basic(new T.Color(3, 2.5, 1.6)), lamps.length);
  lamps.forEach((l, i) => { const y = H(l[0], l[1]); _q.setFromAxisAngle(UP, l[2] ? -Math.PI / 2 : Math.PI); _m.compose(_v1.set(l[0], y, l[1]), _q, _s.set(1, 1, 1)); poles.setMatrixAt(i, _m); _v2.set(0, 6.8, 1.9).applyQuaternion(_q).add(_v1); _m.compose(_v2, _q, _s.set(1, 1, 1)); heads.setMatrixAt(i, _m); });
  poles.castShadow = true; scene.add(poles, heads);
  const carG = mergeGeos([xf(rbox(1.9, 0.75, 4.4, 0.25), [0, 0.65, 0]), xf(rbox(1.7, 0.6, 2.2, 0.25), [0, 1.25, -0.2]), xf(new T.CylinderGeometry(0.34, 0.34, 2.0, 10), [0, 0.34, 1.35], [0, 0, Math.PI / 2]), xf(new T.CylinderGeometry(0.34, 0.34, 2.0, 10), [0, 0.34, -1.35], [0, 0, Math.PI / 2])]);
  const carsM = new T.InstancedMesh(carG, std(0xffffff, 0.35, 0.55), cars.length); const palette = [0xb8bcc0, 0x2a4a6a, 0x8a2a20, 0x2e2e30, 0xd8d0b8, 0x3a5a3a, 0xc08a2a];
  cars.forEach((c, i) => { const y = H(c[0], c[1]); _q.setFromEuler(new T.Euler(c[3] ? rand(-0.1, 0.1) : 0, c[2] + rand(-0.2, 0.2), c[3] ? rand(-0.15, 0.15) : 0)); _m.compose(_v1.set(c[0], y + (c[3] ? -0.1 : 0), c[1]), _q, _s.set(1, 1, 1)); carsM.setMatrixAt(i, _m); carsM.setColorAt(i, _c.setHex(c[3] ? 0x161210 : pick(palette))); if (c[3] && Math.random() < 0.25) addEmitter(new V3(c[0], y + 1, c[1]), 0.8, 1e9); });
  carsM.castShadow = true; carsM.receiveShadow = true; scene.add(carsM);
  const barG = mergeGeos([xf(new T.BoxGeometry(0.6, 0.35, 3), [0, 0.18, 0]), xf(new T.BoxGeometry(0.25, 0.6, 3), [0, 0.65, 0])]);
  const bars = []; for (const c of CPDEF) for (let i = 0; i < 6; i++) { const a = rand(0, 6.28), r = rand(30, 50); bars.push([c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, a]); }
  const barM = new T.InstancedMesh(barG, std(0xb8b2a4, 0.9, 0.05, { normalMap: TEX.armor.normal }), bars.length);
  bars.forEach((b, i) => { _q.setFromAxisAngle(UP, b[2]); _m.compose(_v1.set(b[0], H(b[0], b[1]), b[1]), _q, _s.set(1, 1, 1)); barM.setMatrixAt(i, _m); });
  barM.castShadow = true; scene.add(barM);
})();
const AIM_N = 140, aimPos = new Float32Array(AIM_N * 6), aimCol = new Float32Array(AIM_N * 6);
const aimGeo = new T.BufferGeometry(); aimGeo.setAttribute('position', new T.BufferAttribute(aimPos, 3)); aimGeo.setAttribute('color', new T.BufferAttribute(aimCol, 3));
const aimLines = new T.LineSegments(aimGeo, new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); aimLines.frustumCulled = false; scene.add(aimLines);
function updateAimLines() {
  let n = 0; const cp = camera.position;
  for (const e of ENTS) {
    if (n >= AIM_N) break; if (e.kind !== 'soldier' || !e.alive || e.downed || !e.target || e.isPlayer) continue; if (e.pos.distanceToSquared(cp) > 22500) continue;
    e.muzzle(_v1); e.target.aim(_v2); const L = Math.min(_v1.distanceTo(_v2), 28); _v2.sub(_v1).normalize().multiplyScalar(L).add(_v1);
    const c = TEAM[e.team].laser, k = e.cool < 0.15 ? 0.5 : 0.18; aimPos.set([_v1.x, _v1.y, _v1.z, _v2.x, _v2.y, _v2.z], n * 6); aimCol.set([c[0] * k, c[1] * k, c[2] * k, 0, 0, 0], n * 6); n++;
  }
  aimGeo.setDrawRange(0, n * 2); aimGeo.attributes.position.needsUpdate = true; aimGeo.attributes.color.needsUpdate = true;
}
function updateDetails(dt) { updateCasings(dt); updateFlags(dt); updateAimLines(); const on = Math.sin(TIME * 2.2) > 0.3; for (const b of ARCH_BLINK) b.visible = on; }
