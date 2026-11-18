'use strict';
/* ===================== IRON MERIDIAN · mother nature at war: six elemental disasters ===================== */
// Every few minutes the planet itself joins the battle somewhere near the action:
// Earth (earthquake) · Fire (wildfire) · Water (storm surge) · Wind (tornado) · Lightning (electrical storm) · Sky (meteor shower).
// weather.js adds hurricane, tsunami, blizzard, landslide and volcanic eruption to the same rotation.
const NATURE = { t: 110, ev: null, last: null, dark: 0 };
function natureSpot() { // somewhere on dry land within sight of the Commander (or the camera)
  const c = PLAYER.ent && PLAYER.ent.alive && PLAYER.ent.pos.y < 300 ? PLAYER.ent.pos : camera.position;
  for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, r = rand(110, 360), x = clamp(c.x + Math.cos(a) * r, -BOUND + 60, BOUND - 60), z = clamp(c.z + Math.sin(a) * r, -BOUND + 60, BOUND - 60); if (H(x, z) > 1.5) return new V3(x, groundY(x, z), z); }
  return new V3(0, groundY(0, -400), -400);
}
const hurtNear = (p, r, dps, dt, push, r0 = 0) => {
  for (const e of ENTS) { if (!e.alive || !e.hitR || e.kind === 'capital' || e.kind === 'naval' || e.pos.y > 300) continue; const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz); if (d > r || d < r0) continue; e.damage(dps * dt * (e.kind === 'soldier' ? 1 : 2.4), null, 'splash'); if (push && d > 0.1) { e.pos.x += dx / d * push * dt; e.pos.z += dz / d * push * dt; } if (e.kind === 'soldier' && !e.isPlayer && !e.cmd) e.fleeT = 3; }
};
const DISASTERS = {
  quake: { el: 'Earth', name: 'Earthquake', dur: 16, msg: 'Seismic surge under the battlefield. Brace!',
    start(e) { e.p = natureSpot(); e.c = 0; },
    tick(e, dt) {
      SHAKE.v = Math.max(SHAKE.v, 1.1 * (1 - e.t / e.dur) * (e.t < 1.5 ? e.t / 1.5 : 1));
      if ((e.c -= dt) > 0) return; e.c = 0.3;
      const q = e.p.clone().add(new V3(rand(-260, 260), 0, rand(-260, 260))); q.y = groundY(q.x, q.z); fxDust(q, 8, 9, 9); snd('stomp', q, 1.6);
      if (Math.random() < 0.35) { spawnDebris(q, 4, 8, 0.6); hurtNear(q, 12, 160, 0.3); }
      const b = BUILDINGS[(Math.random() * BUILDINGS.length) | 0]; if (b.alive && !b.cover && Math.hypot(b.x - e.p.x, b.z - e.p.z) < 300 && b.hp < 1e8) b.damage(b.maxHp * 0.25, null);
    } },
  fire: { el: 'Fire', name: 'Wildfire', dur: 50, msg: 'Wildfire racing across the fields. Stay clear of the flame front!',
    start(e) { e.p = natureSpot(); e.r = 6; e.c = 0; },
    tick(e, dt) {
      e.r = Math.min(115, e.r + dt * 3); hurtNear(e.p, e.r + 2, 6, dt, 0, e.r - 10); // only the flame front burns
      if ((e.c -= dt) > 0) return; e.c = 0.45;
      const a = Math.random() * 6.283, q = new V3(e.p.x + Math.cos(a) * e.r, 0, e.p.z + Math.sin(a) * e.r); if (H(q.x, q.z) < 0.8 || Math.hypot(q.x, q.z) < 250) return;
      q.y = groundY(q.x, q.z) + 0.4; addEmitter(q, rand(2, 3.6), 40); flashLight(q, 2, 30, 0.6, 0xff7a30);
    } },
  surge: { el: 'Water', name: 'Storm surge', dur: 45, msg: 'Storm surge! The sea is coming over the coast and up the river.',
    tick(e, dt) {
      water.position.y = 2.6 * smooth(0, 9, e.t) * (1 - smooth(e.dur - 10, e.dur, e.t));
      if (Math.random() < dt * 20) { const z = rand(-BOUND, BOUND), x = coastX(z) - rand(0, 40); FXS.spawn(x, water.position.y + 0.5, z, rand(-4, -1), rand(5, 10), rand(-2, 2), rand(1.4, 2.4), 3, 9, 0.85, 0.9, 0.92, 0.6, 0.65, 0.7, 0.75, 0.5, -8); }
    },
    end() { water.position.y = 0; } },
  tornado: { el: 'Wind', name: 'Tornado', dur: 40, msg: 'Tornado on the ground. It is tearing through the lines!',
    start(e) { e.p = natureSpot(); const a = Math.random() * 6.283; e.v = new V3(Math.cos(a) * 9, 0, Math.sin(a) * 9); e.c = 0; },
    tick(e, dt) {
      { const a = rand(-0.6, 0.6) * dt, c = Math.cos(a), sn = Math.sin(a), vx = e.v.x; e.v.x = vx * c - e.v.z * sn; e.v.z = vx * sn + e.v.z * c; } e.p.addScaledVector(e.v, dt);
      if (Math.abs(e.p.x) > BOUND - 40) e.v.x *= -1; if (Math.abs(e.p.z) > BOUND - 40) e.v.z *= -1; e.p.y = groundY(e.p.x, e.p.z);
      for (let i = 0; i < 14; i++) { const h = Math.random() * 110, r = 3 + h * 0.28, a = TIME * 5 + i * 0.45 + h * 0.05; FXS.spawn(e.p.x + Math.cos(a) * r, e.p.y + h, e.p.z + Math.sin(a) * r, -Math.sin(a) * r * 2.5, 7, Math.cos(a) * r * 2.5, 1.3, 3 + h * 0.06, 7 + h * 0.12, 0.42, 0.38, 0.32, 0.5, 0.46, 0.42, 0.6, 0.2, 0); }
      fxDust(e.p, 2, 9, 12); hurtNear(e.p, 20, 65, dt, -10);
      if ((e.c -= dt) > 0) return; e.c = 0.5;
      spawnDebris(_v1.copy(e.p).setY(e.p.y + 3), 2, 16, 0.5); snd('big', e.p, 0.4);
      for (const b of BUILDINGS) if (b.alive && !b.cover && b.hp < 1e8 && Math.abs(b.x - e.p.x) < b.w / 2 + 14 && Math.abs(b.z - e.p.z) < b.d / 2 + 14) b.damage(260, null);
    } },
  storm: { el: 'Lightning', name: 'Lightning storm', dur: 40, msg: 'Electrical storm overhead. Lightning strikes across the field!',
    start(e) { e.c = 2; WX.tgt = 1; WX.end = GAME.clock + e.dur; },
    tick(e, dt) {
      if ((e.c -= dt) > 0) return; e.c = rand(0.5, 1.5);
      const near = ENTS.filter(x => x.alive && x.hitR && x.pos.y < 300 && x.pos.distanceTo(camera.position) < 450), t = near.length && Math.random() < 0.7 ? pick(near) : null;
      const p = t ? t.pos.clone().add(new V3(rand(-8, 8), 0, rand(-8, 8))) : natureSpot(); p.y = groundY(p.x, p.z);
      beam(_v1.set(p.x + rand(-30, 30), p.y + 280, p.z + rand(-30, 30)), p, 0.7, 0.22, 0xbfd8ff); flashLight(p, 7, 160, 0.25, 0xcfe0ff);
      explodeDamage(p, 6, 140, null, 0); fxSparks(p, 14, [2, 2.6, 4], 12); fxDust(p, 6, 4, 8); setTimeout(() => snd('big', p, 0.9), Math.min(2500, p.distanceTo(camera.position) / 0.343));
    } },
  meteor: { el: 'Sky', name: 'Meteor shower', dur: 30, msg: 'Meteor shower! Debris from the orbital war is raining down.',
    start(e) { e.p = natureSpot(); e.c = 1; },
    tick(e, dt) {
      if ((e.c -= dt) > 0) return; e.c = rand(0.35, 0.9);
      const q = new V3(e.p.x + rand(-280, 280), 0, e.p.z + rand(-280, 280)); q.y = groundY(q.x, q.z);
      fireProj({ from: q.clone().add(new V3(rand(-500, 500), 1900, rand(-500, 500))), to: q, speed: 520, kind: 'missile', team: 0, dmg: 280, splash: 10, w: 1.1, len: 18, color: [4, 1.7, 0.5], fx: 2.6 });
    } },
};
function updateNature(dt) {
  const e = NATURE.ev;
  NATURE.dark += ((e && (e.key === 'storm' || e.key === 'hurricane') ? 1 : e && e.key === 'blizzard' ? 0.4 : 0) - NATURE.dark) * Math.min(1, dt * 0.6);
  if (e) { e.t += dt; DISASTERS[e.key].tick(e, dt); if (e.t >= e.dur) { if (DISASTERS[e.key].end) DISASTERS[e.key].end(e); comms('Met Section', `${DISASTERS[e.key].name} has passed.`, 'cmd'); NATURE.ev = null; NATURE.t = rand(110, 190); } return; }
  if (GAME.state === 'menu' && GAME.clock < 20) return;
  if ((NATURE.t -= dt) > 0) return;
  const key = pick(Object.keys(DISASTERS).filter(k => k !== NATURE.last)), D = DISASTERS[key]; NATURE.last = key;
  const ev = { key, t: 0, dur: D.dur }; if (D.start) D.start(ev); NATURE.ev = ev;
  banner(`${D.el} · ${D.name}`, D.msg, 'var(--amber)'); comms('Met Section', D.msg, 'cmd'); snd('big', null, 0.5);
}
