'use strict';
/* ===================== IRON MERIDIAN · skyfall: shooting stars, comets, asteroids in orbit, meteors to the ground ===================== */
// Shooting stars streak across the sky all the time (far more visible at night). Every few minutes a comet hangs over the
// battle with its tail pointed away from the sun. In orbit, asteroids drift in and smash into cruisers, the dreadnought
// platform rings and anything flying. And now and then a real meteor punches down through the atmosphere: a warning ring
// marks the impact point a few seconds early, then a fireball, a crater and a burning rock.
const SKYFALL = { streakT: 2, cometT: 140, rockT: 35, meteorT: 75, streaks: [], rocks: [], meteors: [], comet: null };
/* ---------- shooting stars: a pooled set of fading lines plus a head glow, fixed to the sky around the camera ---------- */
for (let i = 0; i < 8; i++) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array([1.6, 1.5, 1.3, 0, 0, 0]), 3));
  const line = new T.Line(g, new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false })); line.frustumCulled = false; line.renderOrder = -4; line.visible = false; SKYOBJ.add(line);
  const head = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: new T.Color(2, 1.8, 1.5), transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false })); head.scale.set(70, 70, 1); head.visible = false; head.renderOrder = -4; SKYOBJ.add(head);
  SKYFALL.streaks.push({ line, head, p: new V3(), v: new V3(), t: 0, life: 0, len: 0 });
}
function launchStreak(bright) {
  const s = SKYFALL.streaks.find(x => x.t >= x.life); if (!s) return;
  const a = rand(0, 6.283), el = rand(0.25, 0.85); s.p.set(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).multiplyScalar(5200);
  s.v.set(rand(-1, 1), rand(-0.9, -0.3), rand(-1, 1)).normalize().multiplyScalar(rand(1800, 3200)); s.t = 0; s.life = rand(0.6, 1.4); s.len = rand(0.08, 0.16) * (bright ? 1.6 : 1); s.k = bright ? 1.8 : 1;
}
function updateStreaks(dt, nightK) {
  const vis = 0.18 + nightK * 0.9;
  for (const s of SKYFALL.streaks) {
    const on = s.t < s.life; s.line.visible = s.head.visible = on && vis > 0.2; if (!on) continue;
    s.t += dt; s.p.addScaledVector(s.v, dt); const fade = Math.sin(Math.PI * clamp(s.t / s.life, 0, 1)) * vis * s.k;
    const P = s.line.geometry.attributes.position.array; P[0] = s.p.x; P[1] = s.p.y; P[2] = s.p.z; P[3] = s.p.x - s.v.x * s.len; P[4] = s.p.y - s.v.y * s.len; P[5] = s.p.z - s.v.z * s.len; s.line.geometry.attributes.position.needsUpdate = true;
    s.line.material.opacity = fade; s.head.position.copy(s.p); s.head.material.opacity = fade;
  }
}
/* ---------- comets: a glowing head and a long tail pointed away from the sun, drifting for about a minute ---------- */
function makeComet() {
  const g = new T.Group(); const head = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: new T.Color(1.4, 1.9, 2.4), transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false })); head.scale.set(260, 260, 1); g.add(head);
  for (const [w, l, o, c] of [[60, 2600, 0.5, 0x7fb8ff], [130, 1700, 0.28, 0xcfe4ff], [24, 3400, 0.35, 0xffffff]]) { const m = new T.Mesh(new T.ConeGeometry(w, l, 16, 1, true).translate(0, -l / 2, 0), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide })); m.userData.o = o; g.add(m); }
  g.renderOrder = -4; g.traverse(o => { o.renderOrder = -4; o.frustumCulled = false; }); SKYOBJ.add(g); return g;
}
function updateComet(dt) {
  const C = SKYFALL.comet;
  if (!C) { if ((SKYFALL.cometT -= dt) > 0) return; SKYFALL.cometT = rand(260, 420);
    const a = rand(0, 6.283); SKYFALL.comet = { g: makeComet(), t: 0, life: 70, a, el: rand(0.35, 0.7), da: rand(-0.004, 0.004) * 2 };
    comms('Orbital Survey', 'Comet sighted, high in the sky. Something to tell your grandkids about.', 'cmd'); return; }
  C.t += dt; C.a += C.da * dt * 10; const k = clamp(Math.min(C.t / 8, (C.life - C.t) / 8), 0, 1);
  C.g.position.set(Math.cos(C.a) * Math.cos(C.el), Math.sin(C.el), Math.sin(C.a) * Math.cos(C.el)).multiplyScalar(6500);
  C.g.quaternion.setFromUnitVectors(UP, SUN_DIR); /* the tail (local -Y) streams away from the sun */
  for (const o of C.g.children) o.material.opacity = (o.isSprite ? 1 : o.userData.o) * k;
  if (C.t > C.life) { SKYOBJ.remove(C.g); C.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); SKYFALL.comet = null; }
}
/* ---------- asteroids in orbit: they home on cruisers, the dreadnought rings and anything flying up there ---------- */
const ROCK_G = (() => { const g = new T.DodecahedronGeometry(1, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.75 + vnoise(p.getX(i) * 3 + 5, p.getY(i) * 3 + p.getZ(i) * 2) * 0.5; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
const ROCK_M = std(0x4a423a, 0.95, 0.05, { normalMap: TEX.armor.normal, fog: false }), HOT_M = std(0x3a2a20, 0.9, 0.05, { emissive: 0xff5a1a, emissiveIntensity: 0.9 });
function spaceTargets() {
  const L = []; for (const s of ORBIT.ships) if (!s.dying) L.push({ p: s.g.position, r: 110 * s.sc, ship: s, name: `a ${s.team === 1 ? 'Meridian' : 'Vanta'} cruiser` });
  for (const R of ORBITAL_RINGS) for (const d of R.plats) L.push({ p: new V3(d.x, d.y, d.z), r: d.r + 6, deck: d, name: `the ${R.team === 1 ? 'Meridian' : 'Vanta'} orbital ring` });
  for (const t of [1, 2]) L.push({ p: DREADS[t].position, r: 260, dread: t, name: `the ${t === 1 ? 'Meridian' : 'Vanta'} dreadnought` });
  return L;
}
function launchAsteroid(tgt) {
  const T0 = tgt || pick(spaceTargets()); if (!T0) return; const sz = rand(14, 38), m = new T.Mesh(ROCK_G, ROCK_M); m.scale.set(sz * rand(0.8, 1.3), sz, sz * rand(0.8, 1.2)); m.castShadow = false; scene.add(m);
  const from = randDir(new V3()).setY(rand(-0.15, 0.35)).normalize().multiplyScalar(2600).add(T0.p); m.position.copy(from);
  const v = new V3().subVectors(T0.p, from).normalize().multiplyScalar(rand(110, 170));
  SKYFALL.rocks.push({ m, v, sz, tgt: T0, av: new V3(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6)), t: 0 });
  if (camera.position.y > 600) comms('Orbital Survey', `Asteroid on collision course with ${T0.name}!`, 'cmd');
}
function rockImpact(R, p) {
  plasmaBurst(p, R.sz / 14); fxExplosion(p, R.sz / 7); spawnDebris(p, 8, 30, R.sz * 0.12); snd('big', p, 1.2); shake(1.2, p);
  explodeDamage(p, R.sz * 1.6, 600, null, 0);
  const T0 = R.tgt;
  if (T0.ship && ORBIT.ships.includes(T0.ship) && !T0.ship.dying && Math.random() < 0.45) { T0.ship.dying = 0.001; comms(null, `Asteroid strike! ${T0.name} is breaking up!`, 'cmd'); }
  else if (T0.deck) comms(T0.deck && ORBITAL_RINGS.find(r => r.plats.includes(T0.deck)).team === 1 ? 'Ring Control' : null, `Asteroid impact on ${T0.name}!`, 'cmd');
}
function updateRocks(dt) {
  for (let i = SKYFALL.rocks.length - 1; i >= 0; i--) {
    const R = SKYFALL.rocks[i]; R.t += dt; R.m.position.addScaledVector(R.v, dt); R.m.rotation.x += R.av.x * dt; R.m.rotation.y += R.av.y * dt; R.m.rotation.z += R.av.z * dt;
    const p = R.m.position;
    if (Math.random() < dt * 12) FXS.spawn(p.x, p.y, p.z, rand(-2, 2), rand(-2, 2), rand(-2, 2), rand(3, 6), R.sz * 0.6, R.sz * 2, 0.15, 0.13, 0.12, 0.06, 0.06, 0.06, 0.5, 0.02, 0);
    let hit = p.distanceTo(R.tgt.p) < R.tgt.r + R.sz * 0.6;
    if (!hit) for (const e of ENTS) if (e.alive && e.pos.y > 600 && e.hitR && e.kind !== 'capital' && e.pos.distanceTo(p) < R.sz + (e.radius || 2)) { e.damage(900, null, 'crash'); hit = true; break; }
    if (hit || R.t > 40) { if (hit) rockImpact(R, p.clone()); scene.remove(R.m); SKYFALL.rocks.splice(i, 1); }
  }
}
/* ---------- meteors to the ground: telegraphed, then a fireball out of the sky ---------- */
const RING_M = new T.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false });
function launchMeteor() {
  const q = natureSpot(); q.y = groundY(q.x, q.z);
  const ring = new T.Mesh(new T.RingGeometry(14, 16, 48).rotateX(-Math.PI / 2), RING_M.clone()); ring.position.copy(q).setY(q.y + 0.4); scene.add(ring);
  const from = new V3(q.x + rand(-900, 900), 2600, q.z + rand(-900, 900)), rock = new T.Mesh(ROCK_G, HOT_M); rock.scale.setScalar(rand(3.5, 6)); rock.position.copy(from); scene.add(rock);
  SKYFALL.meteors.push({ q, from, rock, ring, t: 0, dur: 6.5 });
  comms('Met Section', 'Meteor inbound! Impact marked on the ground, clear the ring!', 'cmd'); snd('ui', null, 0.3);
}
function updateMeteors(dt) {
  for (let i = SKYFALL.meteors.length - 1; i >= 0; i--) {
    const M = SKYFALL.meteors[i]; M.t += dt; const k = Math.min(1, M.t / M.dur), e = k * k;
    M.ring.material.opacity = 0.35 + 0.35 * Math.sin(M.t * (6 + k * 18)); M.ring.scale.setScalar(1 + (1 - k) * 0.4);
    M.rock.position.lerpVectors(M.from, M.q, e); M.rock.rotation.x += dt * 3; M.rock.rotation.z += dt * 2;
    const p = M.rock.position;
    for (let n = 0; n < 4; n++) { FXA.spawn(p.x + rand(-2, 2), p.y + rand(-2, 2), p.z + rand(-2, 2), rand(-3, 3), rand(-3, 3), rand(-3, 3), rand(0.4, 0.9), rand(9, 16), rand(2, 5), 4, 2, 0.6, 1.6, 0.4, 0.1, 1, 0.6, 0); }
    if (Math.random() < 0.7) FXS.spawn(p.x, p.y, p.z, rand(-2, 2), rand(-1, 2), rand(-2, 2), rand(5, 9), 12, 40, 0.2, 0.18, 0.16, 0.12, 0.11, 0.1, 0.7, 0.05, -0.1);
    if (k >= 1) {
      fxExplosion(M.q.clone().setY(M.q.y + 2), 4.5); explodeDamage(M.q, 18, 420, null, 0); fxDust(M.q, 30, 14, 16); spawnDebris(M.q, 14, 26, 1.6); shake(1.6, M.q); flashLight(M.q, 16, 260, 0.6, 0xff8040);
      snd('big', M.q, 2); addEmitter(M.q.clone().setY(M.q.y + 1.5), 2.6, 40);
      const crater = new T.Mesh(ROCK_G, HOT_M); crater.scale.set(4.5, 2.4, 4.2); crater.position.copy(M.q).setY(M.q.y + 0.6); scene.add(crater); setTimeout(() => { crater.material = ROCK_M; }, 25000);
      scene.remove(M.rock); scene.remove(M.ring); M.ring.material.dispose(); SKYFALL.meteors.splice(i, 1);
    }
  }
}
function updateSkyfall(dt) {
  if (GAME.state === 'menu' && GAME.clock < 10) return;
  const nightK = skyU.night.value;
  if ((SKYFALL.streakT -= dt) <= 0) { SKYFALL.streakT = rand(0.8, 3) * (1.3 - nightK); launchStreak(Math.random() < 0.15); }
  updateStreaks(dt, nightK); updateComet(dt);
  if ((SKYFALL.rockT -= dt) <= 0) { SKYFALL.rockT = rand(28, 55); const n = Math.random() < 0.25 ? 4 : 1; for (let i = 0; i < n; i++) setTimeout(() => launchAsteroid(), i * 2500); }
  updateRocks(dt);
  if ((SKYFALL.meteorT -= dt) <= 0) { SKYFALL.meteorT = rand(70, 130); if (GAME.state === 'play') launchMeteor(); }
  updateMeteors(dt);
}
