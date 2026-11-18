'use strict';
/* ===================== IRON MERIDIAN · weather and the rest of mother nature ===================== */
// WEATHER: the sky cycles sunny → rain → sunny → snow → sunny … (rain and snow fall field-wide, dim the light and thicken
// the air). On top of the six original disasters, five more join the rotation:
//  Hurricane (wind + sea)  · Tsunami (a wall of water off the east sea)  · Blizzard (whiteout)
//  Landslide (boulders rolling down a slope near you)  · Volcano (the island volcano off the west coast erupts lava bombs)
// Thunder and lightning, meteor showers, comets and asteroids were already in (nature.js, skyfall.js).
const WEATHER = { state: 'sunny', k: 0, next: 120, fogMul: 1, force: null };
const WXP = (() => {
  const N = 1800, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = rand(-50, 50); pos[i * 3 + 1] = rand(-10, 40); pos[i * 3 + 2] = rand(-50, 50); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
  const m = new T.PointsMaterial({ size: 0.16, map: puffTex, color: 0xb8ccff, transparent: true, opacity: 0, depthWrite: false });
  const p = new T.Points(g, m); p.frustumCulled = false; p.visible = false; scene.add(p); return { N, pos, g, m, p };
})();
function weatherSet(s) { if (s === WEATHER.state) return; WEATHER.state = s; comms('Met Section', s === 'rain' ? 'Rain moving in over the battlefield.' : s === 'snow' ? 'Temperature crashing. Snow incoming.' : 'Skies clearing. Sun is coming back out.', 'cmd'); }
function updateWeather(dt) {
  if (GAME.state === 'menu' && GAME.clock < 10) return;
  const ev = NATURE.ev, forced = ev && (ev.key === 'hurricane' ? 'rain' : ev.key === 'blizzard' ? 'snow' : null);
  if (!forced && (WEATHER.next -= dt) <= 0) { WEATHER.next = rand(90, 160); weatherSet(WEATHER.state !== 'sunny' ? 'sunny' : pick(['rain', 'rain', 'snow'])); }
  const want = forced || WEATHER.state, on = want !== 'sunny' ? (ev && forced ? 1 : 0.7) : 0;
  WEATHER.k += (on - WEATHER.k) * Math.min(1, dt * 0.3); const k = WEATHER.k, snow = want === 'snow' || (WEATHER.lastP === 'snow' && on === 0);
  if (on > 0) WEATHER.lastP = want;
  WEATHER.fogMul = 1 + k * (snow ? 2.4 : 1.1) + (ev && ev.key === 'blizzard' ? 2 * k : 0);
  sun.intensity *= 1 - k * (snow ? 0.25 : 0.45); FOG.lerp(_dc.setHex(snow ? 0xdfe6ee : 0x46505c), k * 0.5); scene.fog.color.copy(FOG); skyU.horizon.value.lerp(_dc, k * 0.5);
  WXP.p.visible = k > 0.02 && camera.position.y < 500; if (!WXP.p.visible) return;
  const wind = ev && ev.key === 'hurricane' ? 22 : snow ? 1.5 : 3;
  WXP.m.color.setHex(snow ? 0xffffff : 0xa8bcff); WXP.m.size = snow ? 0.28 : 0.13; WXP.m.opacity = k * (snow ? 0.9 : 0.75); WXP.p.position.copy(camera.position);
  const P = WXP.pos; for (let i = 0; i < WXP.N; i++) { const j = i * 3; P[j] += (wind + Math.sin(TIME + i) * (snow ? 1 : 0.3)) * dt; P[j + 1] -= (snow ? 2.2 + (i % 4) * 0.4 : 30 + (i % 5) * 3) * dt; P[j + 2] += Math.cos(TIME * 0.7 + i) * (snow ? 0.9 : 0.2) * dt; if (P[j + 1] < -10) P[j + 1] += 50; if (P[j] > 50) P[j] -= 100; if (P[j] < -50) P[j] += 100; if (P[j + 2] > 50) P[j + 2] -= 100; if (P[j + 2] < -50) P[j + 2] += 100; }
  WXP.g.attributes.position.needsUpdate = true;
}
/* ---------- the island volcano off the west coast ---------- */
const VOLC = (() => {
  /* the island's own volcano (core.js VOLCANO): lava glowing in the crater, and flows that pour down the real slopes
     when it erupts. The cone is the terrain itself. */
  const x = VOLCANO.x, z = VOLCANO.z, cy = H(x, z), g = new T.Group(); scene.add(g);
  const lavaM = basic(new T.Color(3.4, 1.0, 0.2)), lavaDim = basic(new T.Color(1.6, 0.45, 0.1));
  const crater = new T.Mesh(new T.CircleGeometry(15, 20).rotateX(-Math.PI / 2), lavaM); crater.position.set(x, cy + 1.2, z); g.add(crater);
  const ribbon = (a, len, w, m) => { /* a strip draped over the ground from the rim downhill */
    const pos = [], idx = [], N = 24;
    for (let i = 0; i <= N; i++) { const r = 20 + i / N * len, wob = Math.sin(i * 0.7 + a * 3) * 0.12, aa = a + wob, cx = x + Math.cos(aa) * r, cz = z + Math.sin(aa) * r, nx = -Math.sin(aa), nz = Math.cos(aa), ww = w * (1 - i / N * 0.4);
      for (const s2 of [-1, 1]) { const px = cx + nx * ww * s2, pz = cz + nz * ww * s2; pos.push(px, H(px, pz) + 0.6, pz); }
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); return new T.Mesh(gg, m);
  };
  for (const a of [0.5, 1.6, 2.6]) g.add(ribbon(a, 120, 2.2, lavaDim)); /* old flows, always faintly alight */
  const flows = []; for (let i = 0; i < 5; i++) { const f = ribbon(i * 1.26 + 0.2, 175, 4.5, lavaM); f.visible = false; g.add(f); flows.push(f); }
  const light = new T.PointLight(0xff5a1a, 0, 700, 2); light.position.set(x, cy + 40, z); g.add(light);
  return { x, z, top: new V3(x, cy + 8, z), g, crater, light, flows };
})();
/* ---------- the new disasters ---------- */
Object.assign(DISASTERS, {
  hurricane: { el: 'Wind & Sea', name: 'Hurricane', dur: 45, msg: 'Hurricane making landfall! Hold on to something.',
    start(e) { e.c = 0; },
    tick(e, dt) {
      water.position.y = 1.8 * smooth(0, 8, e.t) * (1 - smooth(e.dur - 8, e.dur, e.t)); SHAKE.v = Math.max(SHAKE.v, 0.12);
      for (const s of ENTS) if (s.alive && s.kind === 'soldier' && !s.mount && s.pos.y < 300) { s.pos.x += 1.6 * dt; pushOut(s.pos, 0.5); } // the wind leans everyone east
      if ((e.c -= dt) > 0) return; e.c = 0.25; const pe = PLAYER.ent, c = pe ? pe.pos : camera.position;
      const q = new V3(c.x + rand(-120, 120), 0, c.z + rand(-120, 120)); q.y = groundY(q.x, q.z) + rand(2, 12); spawnDebris(q, 2, 18, 0.6);
      if (Math.random() < 0.15) { const p = q.clone(); p.y = groundY(p.x, p.z); beam(_v1.set(p.x, p.y + 300, p.z), p, 0.6, 0.2, 0xcfe0ff); flashLight(p, 6, 160, 0.25, 0xcfe0ff); hurtNear(p, 5, 120, 1); snd('big', p, 0.8); }
    },
    end() { water.position.y = 0; } },
  tsunami: { el: 'Sea', name: 'Tsunami', dur: 32, msg: 'TSUNAMI! A wall of water is coming off the east sea. Get to high ground!',
    start(e) {
      const g = new T.PlaneGeometry(1800, 24, 90, 4); g.rotateY(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const zz = p.getZ(i); p.setX(i, coastX(zz) - coastX(0) + Math.max(0, p.getY(i)) * 0.6); p.setY(i, p.getY(i) + 12); } g.computeVertexNormals();
      e.m = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x2a6a80, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.86, side: T.DoubleSide })); e.x = coastX(0) + 420; e.m.position.set(e.x, -4, 0); scene.add(e.m);
    },
    tick(e, dt) {
      const back = e.t > 20; e.x += (back ? 30 : -38) * dt; const reach = coastX(0) - 170; if (e.x < reach) e.x = reach; e.m.position.x = e.x; e.m.position.y = back ? -4 - (e.t - 20) * 2.5 : -4;
      water.position.y = back ? 3 * (1 - smooth(20, 30, e.t)) : 3 * smooth(4, 14, e.t);
      for (let i = 0; i < 10; i++) { const z = rand(-BOUND, BOUND), x = e.x + coastX(z) - coastX(0); FXS.spawn(x, 22 + rand(-2, 4), z, rand(-8, -3), rand(2, 6), 0, rand(1.5, 3), 4, 12, 0.9, 0.95, 0.97, 0.7, 0.75, 0.8, 0.8, 0.4, -4); }
      if (!back) for (const s of ENTS) { if (!s.alive || s.pos.y > 40 || s.kind === 'naval' || s.kind === 'capital') continue; const wx = e.x + coastX(s.pos.z) - coastX(0); if (Math.abs(s.pos.x - wx) < 12) { s.damage(90 * dt, null, 'splash'); s.pos.x -= 14 * dt; if (s.speed !== undefined && s.kind !== 'walker' && Math.random() < dt) s.speed *= 0.5; } }
      if (PLAYER.ent && Math.abs(PLAYER.ent.pos.x - e.x) < 220) SHAKE.v = Math.max(SHAKE.v, 0.4);
    },
    end(e) { scene.remove(e.m); e.m.geometry.dispose(); e.m.material.dispose(); water.position.y = 0; } },
  blizzard: { el: 'Ice', name: 'Blizzard', dur: 40, msg: 'Blizzard! Whiteout across the field, visibility near zero.',
    tick(e, dt) { for (const s of ENTS) if (s.alive && s.kind === 'soldier' && !s.mount && s.pos.y < 300 && Math.random() < dt * 0.05) s.damage(3, null, 'splash'); } },
  landslide: { el: 'Earth', name: 'Landslide', dur: 16, msg: 'Landslide! Boulders coming down the slope!',
    start(e) {
      let best = natureSpot(), bs = 0; for (let i = 0; i < 40; i++) { const q = natureSpot(), s = Math.hypot(H(q.x + 6, q.z) - H(q.x - 6, q.z), H(q.x, q.z + 6) - H(q.x, q.z - 6)); if (s > bs) { bs = s; best = q; } }
      e.rocks = []; for (let i = 0; i < 12; i++) { const m = new T.Mesh(ROCK_G, ROCK_M); const sz = rand(1.4, 3.2); m.scale.setScalar(sz); m.position.set(best.x + rand(-20, 20), 0, best.z + rand(-20, 20)); m.position.y = groundY(m.position.x, m.position.z) + sz; m.castShadow = true; scene.add(m); e.rocks.push({ m, sz, v: new V3(rand(-2, 2), 0, rand(-2, 2)) }); }
      fxDust(best, 30, 14, 12); snd('big', best, 1.2);
    },
    tick(e, dt) {
      for (const R of e.rocks) {
        const p = R.m.position, gx = H(p.x + 2, p.z) - H(p.x - 2, p.z), gz = H(p.x, p.z + 2) - H(p.x, p.z - 2); R.v.x -= gx * 9 * dt; R.v.z -= gz * 9 * dt; R.v.multiplyScalar(e.t > 12 ? 0.9 : 0.995);
        p.x += R.v.x * dt; p.z += R.v.z * dt; p.y = groundY(p.x, p.z) + R.sz * 0.8; const sp = Math.hypot(R.v.x, R.v.z); R.m.rotation.x += sp * dt / R.sz; R.m.rotation.z += R.v.x * dt * 0.3;
        if (sp > 3 && Math.random() < dt * 8) fxDust(_v1.set(p.x, p.y - R.sz * 0.6, p.z), 2, R.sz * 1.4, 4);
        if (sp > 4) for (const s of ENTS) if (s.alive && s.hitR && s.pos.y < 300 && Math.abs(s.pos.x - p.x) < R.sz + 1.5 && Math.abs(s.pos.z - p.z) < R.sz + 1.5) { s.damage(sp * 12 * dt * 10, null, 'crash'); if (s.kind === 'soldier') { s.pos.x += R.v.x * 0.05; s.pos.z += R.v.z * 0.05; } }
      }
    },
    end(e) { const R = e.rocks; setTimeout(() => R.forEach(r => scene.remove(r.m)), 60000); } },
  volcano: { el: 'Fire', name: 'Volcanic eruption', dur: 42, msg: 'The island volcano is erupting! Lava bombs incoming on the west side!',
    start(e) { e.c = 1; VOLC.flows.forEach(f => { f.visible = true; }); snd('big', null, 1); SHAKE.v = Math.max(SHAKE.v, 0.8); },
    tick(e, dt) {
      const k = Math.min(1, e.t / 3) * (1 - smooth(e.dur - 6, e.dur, e.t)); VOLC.light.intensity = 6 * k; NATURE.dark = Math.max(NATURE.dark, 0.35 * k);
      for (let i = 0; i < 4; i++) FXS.spawn(VOLC.x + rand(-15, 15), VOLC.top.y + 4, VOLC.z + rand(-15, 15), rand(-6, 6), rand(25, 45), rand(-6, 6), rand(8, 14), 30, 120, 0.12, 0.1, 0.09, 0.06, 0.05, 0.05, 0.8, 0.05, -2);
      if (Math.random() < dt * 8) FXA.spawn(VOLC.x + rand(-10, 10), VOLC.top.y + 12, VOLC.z + rand(-10, 10), rand(-20, 20), rand(40, 70), rand(-20, 20), rand(1, 2), 8, 2, 4, 1.4, 0.3, 1.5, 0.3, 0.05, 1, 0.1, 20);
      if ((e.c -= dt) > 0) return; e.c = rand(0.5, 1.2);
      const q = new V3(rand(-BOUND + 40, 100), 0, rand(-BOUND + 40, BOUND - 40)); if (H(q.x, q.z) < 0.5) return; q.y = groundY(q.x, q.z);
      const T0 = rand(7, 9), g = 9.8 * 2.5, o = VOLC.top; /* ballistic lava bomb: lands on q after T0 seconds */
      fireProj({ from: o.clone(), to: q, vel: new V3((q.x - o.x) / T0, (q.y - o.y + 0.5 * g * T0 * T0) / T0, (q.z - o.z) / T0), kind: 'missile', team: 0, dmg: 220, splash: 9, w: 1.6, len: 14, color: [4, 1.5, 0.3], fx: 2.2, grav: 2.5, maxDist: 6000, life: 14 });
    },
    end() { VOLC.light.intensity = 0; VOLC.flows.forEach(f => { f.visible = false; }); } },
});
DISASTERS.storm.name = 'Thunder & lightning';
