'use strict';
/* ===================== IRON MERIDIAN · cinema: burning city, rams and crash set-pieces ===================== */
// Directed chaos that stays readable:
//  · BLAZE   · a building that takes heavy damage catches fire on the face that was hit: licking flames out of the
//              windows, embers, a black smoke column off the roof that can be seen across the map. Fires spread to
//              more windows as damage mounts, gut the block down to a smoking shell, then burn out (rain and snow
//              put them out faster). Fully particle-based on the shared pools, budgeted by distance.
//  · RAMS    · ground vehicles at speed that plough into a building: sparks, a dent in both, fire where they hit.
//  · SET-PIECES · every 14–24 s, in front of the Commander: a stricken aircraft dives into a tower, an artillery
//              battery walks shells up a building's face, or a wrecked vehicle cartwheels into a block.
const CHAOS = { burn: [], t: 12, ramT: 0, lightT: 0, doom: [] };
const BLAZE_MAX = LOW_END ? 8 : 14;
function firePoint(b, p) { /* a point on the building's skin: on the face nearest p (or a random face) */
  let fx, fz; if (p) { const dx = (p.x - b.x) / (b.w / 2), dz = (p.z - b.z) / (b.d / 2); if (Math.abs(dx) > Math.abs(dz)) { fx = Math.sign(dx) || 1; fz = 0; } else { fx = 0; fz = Math.sign(dz) || 1; } } else if (Math.random() < 0.5) { fx = Math.random() < 0.5 ? -1 : 1; fz = 0; } else { fx = 0; fz = Math.random() < 0.5 ? -1 : 1; }
  const along = p ? (fx ? clamp(p.z - b.z, -b.d * 0.42, b.d * 0.42) : clamp(p.x - b.x, -b.w * 0.42, b.w * 0.42)) : rand(-0.4, 0.4) * (fx ? b.d : b.w);
  const y = p ? clamp(p.y, b.gy + 2, b.top - 1.5) : b.gy + b.h * rand(0.15, 0.85);
  return { x: fx ? b.x + fx * (b.w / 2 + 0.3) : b.x + along, y, z: fz ? b.z + fz * (b.d / 2 + 0.3) : b.z + along, nx: fx, nz: fz, s: clamp(Math.min(b.w, b.d) * 0.09, 1.2, 3.2), acc: 0 };
}
function ignite(b, p, n = 1) {
  if (!b || !b.alive || b.cover || b.fort || b.h < 6 || b.hp > 1e8) return;
  let f = CHAOS.burn.find(q => q.b === b);
  if (!f) { if (CHAOS.burn.length >= BLAZE_MAX) CHAOS.burn.shift(); f = { b, pts: [], t: 0, life: rand(110, 190), sm: 0, hp: b.hp }; CHAOS.burn.push(f); }
  for (let i = 0; i < n && f.pts.length < 5; i++) { const q = i === 0 && p ? p : Math.random() < 0.7 ? _v5.set(camera.position.x, b.gy + b.h * rand(0.15, 0.85), camera.position.z) : null; f.pts.push(firePoint(b, q)); if (q === _v5) { const t = f.pts[f.pts.length - 1]; if (t.nx) t.z += rand(-0.35, 0.35) * b.d; else t.x += rand(-0.35, 0.35) * b.w; } } /* unseen faces burn too, but most fires face the camera */
  f.t = Math.min(f.t, f.life * 0.3);
}
/* heavy damage sets buildings alight; the first big hit chooses the burning face */
const _cineBDamage = Building.prototype.damage;
Building.prototype.damage = function (a, src) {
  const was = this.hp; _cineBDamage.call(this, a, src);
  if (!this.alive || this.cover || this.fort || this.hp > 1e8) return;
  const k = this.hp / this.maxHp, k0 = was / this.maxHp;
  if ((k < 0.7 && k0 >= 0.7) || (k < 0.4 && k0 >= 0.4) || a > this.maxHp * 0.12) ignite(this, src && src.pos ? src.pos : null, a > this.maxHp * 0.12 ? 2 : 1);
};
/* ---------- rams: ground vehicles into buildings ---------- */
const RAMMERS = { speeder: 1, transport: 1, tank: 1, shiftframe: 1 };
function vehicleRams() {
  const c = camera.position;
  for (const e of ENTS) {
    if (!RAMMERS[e.kind] || !e.alive || e.tumble || e.pos.y > 300 || (e.ramT || 0) > TIME || e.pos.distanceTo(c) > 700) continue;
    if ((e.kind === 'shiftframe' && e.mode === 'robot') || e.motorPool) continue; /* your own drivers know the walls */
    const sp = Math.abs(e.speed !== undefined ? e.speed : e.vel.length()); if (sp < 16) continue;
    const r = (e.radius || 3) + 1.6, dir = e.speed < 0 ? -1 : 1, p = _v1.set(e.pos.x + Math.sin(e.yaw) * r * dir, e.pos.y + 1.2, e.pos.z + Math.cos(e.yaw) * r * dir), b = buildingAt(p);
    if (!b || b.hp > 1e8) continue;
    e.ramT = TIME + 1.4; const hit = p.clone();
    fxSparks(hit, 40, [3, 2, 0.8], 18); fxDust(hit, 10, 5, 8); spawnDebris(hit, 4, 9, 0.5); shake(Math.min(1, sp / 40), hit); snd(sp > 28 ? 'big' : 'boom', hit, Math.min(1, sp / 30)); flashLight(hit, 6, 50, 0.25, 0xffa050);
    b.damage(sp * 70, e.isPlayer ? e : null); ignite(b, hit, sp > 28 ? 2 : 1);
    e.damage(sp * sp * (e.isPlayer ? 0.18 : 0.35), null, 'crash'); if (e.speed !== undefined) e.speed *= -0.3; if (e.vel) e.vel.multiplyScalar(-0.3);
    if (sp > 30) fxExplosion(hit, 1.3);
    if (e.isPlayer) comms('Alpha Lead', pick(['Through the wall! Hold on!', 'That building felt it, sir!', 'Watch the walls, Commander!']), 'b');
  }
}
/* ---------- set-pieces in front of the Commander ---------- */
function viewBuilding(from, minD, maxD, avoid) { /* a real (not cover) building, in front of the camera, away from the Commander */
  camDir(_v4); let best = null, bs = -1;
  for (const b of BUILDINGS) {
    if (!b.alive || b.cover || b.fort || b.h < 18 || b.hp > 1e8) continue; const d = Math.hypot(b.x - from.x, b.z - from.z); if (d < minD || d > maxD) continue;
    if (avoid && Math.hypot(b.x - avoid.x, b.z - avoid.z) < 60) continue;
    const vx = b.x - camera.position.x, vz = b.z - camera.position.z, vl = Math.hypot(vx, vz) || 1, dot = (vx * _v4.x + vz * _v4.z) / vl; if (dot < 0.35 || vl > 650) continue;
    const sc = dot + b.h / 200 + Math.random() * 0.4; if (sc > bs) { bs = sc; best = b; }
  }
  return best;
}
function setAirCrash(pe) {
  const A = ENTS.filter(e => e.alive && !e.isPlayer && !e.orbital && (e.kind === 'fighter' || e.kind === 'gunship' || e.kind === 'dropship') && e.pos.y < 400 && e.pos.distanceTo(camera.position) < 700 && e.pos.distanceTo(camera.position) > 120);
  for (const e of A.sort(() => Math.random() - 0.5)) {
    const b = viewBuilding(e.pos, 90, 340, pe.pos); if (!b) continue;
    const tgt = new V3(b.x, b.gy + b.h * 0.8, b.z), dir = tgt.clone().sub(e.pos).normalize();
    e.damage(e.hp + 1e5, null, 'crash'); if (e.alive) return false;
    if (e.kind === 'fighter') { e.dir.copy(dir); e.speed = Math.max(e.speed || 0, 90); } else { e.vel.copy(dir).multiplyScalar(60); }
    CHAOS.doom.push({ e, b, t: 0 }); comms(null, pick([`${e.team === 1 ? 'We have a bird' : 'Enemy craft'} going down into the blocks!`, 'Aircraft out of control! It is going into that tower!', 'Mayday, mayday! Brace for impact!']), 'cmd');
    return true;
  }
  return false;
}
function setBarrage(pe) {
  const b = viewBuilding(pe.pos, 70, 420, pe.pos); if (!b) return false;
  CHAOS.lastB = b; const f = firePoint(b, null); snd('missile', null, 0.4); comms(null, pick(['Artillery walking up that block!', 'Shells on the high-rise, get clear!', 'Barrage! They are levelling the building!']), 'cmd');
  for (let i = 0; i < 5; i++) setTimeout(() => {
    if (!b.alive) return; const p = new V3(f.x + (f.nz ? rand(-6, 6) : 0), b.gy + b.h * (0.2 + i * 0.16), f.z + (f.nx ? rand(-6, 6) : 0));
    fxExplosion(p, 2.2); spawnDebris(p, 5, 12, 0.7); fxDust(p, 10, 8, 10); flashLight(p, 10, 90, 0.35, 0xffa050); snd('big', p, 0.8); shake(0.4, p);
    b.damage(b.maxHp * 0.05, null); ignite(b, p, 1);
  }, 350 + i * 420);
  return true;
}
function setWreck(pe) {
  const V = ENTS.filter(e => e.alive && !e.isPlayer && (e.kind === 'speeder' || e.kind === 'tank' || e.kind === 'transport') && !e.motorPool && !e.riders?.some(r => r && r.cmd) && e.pos.y < 300 && e.pos.distanceTo(camera.position) > 60 && e.pos.distanceTo(camera.position) < 450 && e.pos.distanceTo(pe.pos) > 50);
  for (const e of V.sort(() => Math.random() - 0.5)) {
    const b = viewBuilding(e.pos, 25, 140, pe.pos); if (!b) continue;
    e.damage(e.hp + 1e5, null, 'crash'); if (e.alive) return false;
    CHAOS.lastWreck = e; const d = _v2.set(b.x - e.pos.x, 0, b.z - e.pos.z), l = d.length(); d.divideScalar(l || 1); startTumble(e, d, clamp(l * 0.9, 24, 60), 0.55);
    fxExplosion(e.pos.clone().setY(e.pos.y + 1.5), 1.6); comms(null, pick(['Vehicle hit! It is rolling into the buildings!', 'There goes a transport, end over end!', 'Wreck incoming, clear the street!']), 'cmd');
    return true;
  }
  return false;
}
/* ---------- per frame ---------- */
function updateCinema(dt) {
  if (GAME.state === 'end' || GAME.state === 'showcase') return; /* spectate keeps the fires, rams and crashes running; its director stages the set-pieces */
  if ((CHAOS.ramT -= dt) <= 0) { CHAOS.ramT = 0.1; vehicleRams(); }
  const pe = PLAYER.ent;
  if (GAME.state !== 'spectate' && GAME.state !== 'menu' && (CHAOS.t -= dt) <= 0) {
    CHAOS.t = rand(14, 24) * (LOW_END ? 1.4 : 1);
    if (pe && pe.alive && pe.pos.y < 300) { const r = Math.random(); if (!(r < 0.45 ? setAirCrash(pe) || setBarrage(pe) : r < 0.75 ? setBarrage(pe) : setWreck(pe) || setBarrage(pe))) CHAOS.t = 5; }
  }
  for (let i = CHAOS.doom.length - 1; i >= 0; i--) { /* doomed aircraft: fire trail, and the building they hit goes up */
    const D = CHAOS.doom[i], e = D.e; D.t += dt;
    if (e.remove || D.t > 12 || !e.obj.visible) { if (D.t < 12 && Math.hypot(e.pos.x - D.b.x, e.pos.z - D.b.z) < Math.max(D.b.w, D.b.d) / 2 + 14) { ignite(D.b, e.pos, 3); fxExplosion(e.pos, 3); spawnDebris(e.pos, 8, 16, 0.9); shake(1, e.pos); } CHAOS.doom.splice(i, 1); continue; }
    if (e.deadT !== undefined && Math.random() < 0.9) FXA.spawn(e.pos.x, e.pos.y, e.pos.z, rand(-1, 1), rand(0, 2), rand(-1, 1), rand(0.3, 0.6), 3.5, 1, 4, 2, 0.6, 1.4, 0.3, 0.05, 1, 1, 2);
    const bh = buildingAt(e.pos); if (bh) { ignite(bh, e.pos, 3); }
  }
  /* fires: flames out of the windows, embers, roof smoke; spread, gut, burn out */
  const c = camera.position, wet = WEATHER.state === 'rain' ? 2 : WEATHER.state === 'snow' ? 1.6 : 1, q = LOW_END ? 0.5 : 1; let near = null, nd = 1e9;
  for (let i = CHAOS.burn.length - 1; i >= 0; i--) {
    const f = CHAOS.burn[i], b = f.b; f.t += dt * wet;
    if (!b.alive || f.t > f.life || b.hp > f.hp + 1) { CHAOS.burn.splice(i, 1); continue; } /* collapsed, burnt out, or rebuilt */
    const k = b.hp / b.maxHp, fade = Math.min(1, (f.life - f.t) / 25);
    if (k > 0.25) b.hp -= b.maxHp * 0.0018 * dt * f.pts.length; /* gutting: down to a smoking shell, never all the way */
    f.hp = Math.min(f.hp, b.hp);
    if (f.pts.length < 5 && Math.random() < dt * 0.04) f.pts.push(firePoint(b, null));
    const d = Math.hypot(b.x - c.x, b.z - c.z); if (d > 950) continue; if (d < nd) { nd = d; near = f; }
    const lod = d < 250 ? 1 : d < 550 ? 0.55 : 0.25;
    for (const p of f.pts) {
      p.acc += dt * 20 * lod * q * fade * p.s;
      while (p.acc > 1) { p.acc -= 1; const s = p.s;
        FXA.spawn(p.x + p.nx * rand(0, 0.6) + (p.nz ? rand(-s, s) * 1.6 : 0), p.y + rand(-s, s) * 0.5, p.z + p.nz * rand(0, 0.6) + (p.nx ? rand(-s, s) * 1.6 : 0), p.nx * rand(0.5, 2) + rand(-0.4, 0.4), rand(4, 9), p.nz * rand(0.5, 2) + rand(-0.4, 0.4), rand(0.55, 1.1), s * 3.2, s * 0.6, 3.8, 1.6, 0.35, 1.3, 0.22, 0.05, 0.95, 0.5, 1.6);
        if (Math.random() < 0.4) FXS.spawn(p.x + p.nx * 1.5, p.y + s * 2, p.z + p.nz * 1.5, p.nx * 1.5 + rand(-0.5, 0.5), rand(3, 6), p.nz * 1.5 + rand(-0.5, 0.5), rand(5, 9), s * 2.4, s * 9, 0.035, 0.03, 0.028, 0.12, 0.1, 0.09, 0.92, 0.15, 0.35);
        if (Math.random() < 0.08) FXA.spawn(p.x, p.y + s, p.z, rand(-3, 3), rand(5, 11), rand(-3, 3), rand(1.2, 2.2), 0.25, 0.05, 4, 2.2, 0.6, 2, 0.6, 0.1, 1, 0.2, -2); /* embers */
      }
    }
    f.sm += dt * (lod > 0.3 ? 4 : 2) * fade; /* the roof smoke column, visible across the map */
    while (f.sm > 1) { f.sm -= 1; const s = 2 + Math.min(b.w, b.d) * 0.15; FXS.spawn(b.x + rand(-b.w, b.w) * 0.3, b.top + rand(0, 3), b.z + rand(-b.d, b.d) * 0.3, rand(1, 3), rand(5, 9), rand(0, 2), rand(9, 14), s * 1.5, s * 6, 0.04, 0.035, 0.03, 0.12, 0.11, 0.1, 0.85, 0.08, 0.25); }
  }
  if (near && nd < 300 && (CHAOS.lightT -= dt) <= 0) { CHAOS.lightT = 0.22; const p = near.pts[(Math.random() * near.pts.length) | 0]; flashLight(_v3.set(p.x + p.nx * 3, p.y, p.z + p.nz * 3), rand(3, 5.5), 40, 0.3, 0xff7a30); }
}
