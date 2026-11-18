'use strict';
/* ===================== IRON MERIDIAN · the Force on real machines: seize a vehicle, even one in the air, and throw it =====================
   The Force (F, the FORCE pad) already lifts the cars parked on the streets. Get close enough to a tank, a walker, a
   carrier, a bike, a gunship, a dropship or a fighter and it takes that instead: the machine stops dead wherever it
   was, flying or not, and is hauled round in front of you. Its engines and guns go quiet while you hold it, though
   anyone aboard keeps shooting. Press again and it goes where you are looking. Whatever it hits takes the blow: a
   building is smashed, another vehicle is wrecked with it, troops around the impact are thrown down. The thrown
   machine is destroyed.
   Your own side's machines are left alone, and so are the big ones (capital ships, starships, Titans). */
const FG = { e: null, thrown: [], hintT: 0, cand: null };
const FG_KINDS = new Set(['tank', 'walker', 'speeder', 'transport', 'gunship', 'dropship', 'fighter', 'shiftframe']);
const FG_REACH = 32; /* metres from you to its hull */
const FG_NAME = { tank: 'tank', walker: 'walker', speeder: 'bike', transport: 'carrier', gunship: 'gunship', dropship: 'dropship', fighter: 'fighter', shiftframe: 'Shiftframe' };
const _fg1 = new V3(), _fg2 = new V3(), _fgN = [];
const fgNoop = function () {};
const fgR = e => Math.min(14, e.radius || 3);
const fgOk = e => e && e.alive && !e.remove && FG_KINDS.has(e.kind) && !e.isPlayer && e !== PLAYER.ent && e.obj && e.pos && (e.radius || 3) <= 16 && !e.fgHeld && !e.fgThrown && e.team !== 1 && !(e.riders && e.riders.some(r => r && r.isPlayer));
function fgFind(pe) {
  let best = null, bd = FG_REACH;
  for (const e of ENTS) { if (!fgOk(e)) continue; const d = e.pos.distanceTo(pe.pos) - fgR(e); if (d < bd) { bd = d; best = e; } }
  return best ? { e: best, d: Math.max(0, bd) } : null;
}
function fgRestore(e) { if (Object.prototype.hasOwnProperty.call(e, 'update')) delete e.update; e.fgHeld = false; e.fgThrown = null; }
function fgGrab(e) {
  FG.e = e; e.fgHeld = true; e.update = fgNoop; e.fgT = 0; e.fgSpin = 0; e.fgYaw = e.yaw !== undefined ? e.yaw : e.heading || 0;
  if (e.speed !== undefined) e.speed = 0; if (e.vel) e.vel.set(0, 0, 0); if (e.vy !== undefined) e.vy = 0; e.target = null;
  const p = e.pos; shockRing(p, 6 + fgR(e), 0.5, 0x7fd0ff); fxSparks(_fg1.copy(p).setY(p.y + 1), nfx(14), [1.4, 2.4, 4], 10);
  if (p.y - groundY(p.x, p.z) < 3) { fxDust(_fg1.copy(p), nfx(12), 4, 8); debrisBurst(_fg1.set(p.x, groundY(p.x, p.z), p.z), 6, 6, 0.4, 'concrete'); }
  snd('heavy', p, 0.7); shake(0.25, p);
  if (Math.random() < 0.5) comms('You', pick([`Got the ${FG_NAME[e.kind]}.`, 'Come here.', 'Not so fast.']), 'b');
}
function fgRelease() { const e = FG.e; FG.e = null; if (e) fgRestore(e); }
function fgHold(dt) {
  const e = FG.e, pe = PLAYER.ent;
  if (!e.alive || e.remove || !pe || !pe.alive || pe.mount || GAME.state !== 'play') return fgRelease(); /* shot out of your grip, or you went down: it carries on as it was */
  e.fgT += dt; e.fgSpin += dt * 0.8;
  const r = fgR(e), dir = camDir(_fg2), t = _fg1.copy(pe.pos).addScaledVector(dir, 8 + r * 1.3); t.y = pe.pos.y + 2.5 + r * 0.45 + dir.y * 5;
  e.pos.lerp(t, Math.min(1, dt * (e.fgT < 0.7 ? 2.6 : 6)));
  const yaw = e.fgYaw + e.fgSpin; if (e.yaw !== undefined) e.yaw = yaw;
  e.obj.position.copy(e.pos); e.obj.rotation.set(Math.sin(TIME * 2) * 0.15, yaw, Math.sin(TIME * 1.3) * 0.22, 'YXZ');
  /* the current from your hands to the hull */
  const hx = pe.pos.x, hy = pe.pos.y + 1.3, hz = pe.pos.z;
  for (let i = 0; i < nfx(4); i++) { const u = Math.random(); FXA.spawn(lerp(hx, e.pos.x, u) + rand(-0.4, 0.4), lerp(hy, e.pos.y + 0.8, u) + rand(-0.4, 0.4), lerp(hz, e.pos.z, u) + rand(-0.4, 0.4), (e.pos.x - hx) * 0.6, (e.pos.y - hy) * 0.6, (e.pos.z - hz) * 0.6, 0.3, 0.5, 0.15, 0.6, 1.6, 3, 0.3, 0.8, 2, 1, 0, 0); }
  if (Math.random() < dt * 14) FXA.spawn(e.pos.x + rand(-r, r), e.pos.y + rand(-1, 1.5), e.pos.z + rand(-r, r), 0, 0.5, 0, 0.5, 0.4, 0.9, 0.5, 1.6, 2.4, 0.3, 0.5, 1, 1, 0, 0);
}
function fgThrow() {
  const e = FG.e; if (!e) return; FG.e = null; e.fgHeld = false;
  const r = fgR(e), dir = camDir(_fg2), sp = TK_SPEED * (r > 6 ? 0.8 : 1);
  e.fgThrown = { vel: new V3().copy(dir).multiplyScalar(sp).add(_fg1.set(0, 5, 0)), spin: rand(2, 5), roll: rand(-3, 3), t: 0 }; FG.thrown.push(e);
  const pe = PLAYER.ent; if (pe) shockRing(pe.pos, 11, 0.4, 0x7fd0ff);
  snd('missile', e.pos, 0.8); shake(0.25);
}
/* does the thrown machine hit something this frame? */
function fgHit(e) {
  const p = e.pos, r = fgR(e), g = groundY(p.x, p.z);
  if (p.y - r * 0.3 <= g) return { ground: true };
  if (buildingAt(p) || buildingAt(_fg1.copy(e.fgThrown.vel).normalize().multiplyScalar(r * 0.7).add(p))) return { bld: true };
  for (const o of ENTS) {
    if (o === e || !o.alive || o.isPlayer || o === PLAYER.ent || !o.hitR || o.kind === 'capital' || o.fgThrown || !o.pos) continue;
    const rr = r + (o.kind === 'soldier' ? 0.8 : Math.min(14, o.radius || 2)) + 0.5;
    if (o.pos.distanceToSquared(p) < rr * rr) return { ent: o };
  }
  return null;
}
function fgImpact(e, h) {
  const p = _fg2.copy(e.pos), r = fgR(e), R = 8 + r, src = PLAYER.ent;
  explodeDamage(p, R, 450 + r * 60, src, 1);
  for (const b of bldNear(p.x, p.z, R, _fgN)) if (b.alive && p.y < b.top + 4 && Math.max(b.x0 - p.x, 0, p.x - b.x1) < R * 0.7 && Math.max(b.z0 - p.z, 0, p.z - b.z1) < R * 0.7) b.damage(1500 + r * 450, src);
  if (h && h.ent && h.ent.kind !== 'soldier') h.ent.damage(900 + r * 90, src, 'ram');
  fxExplosion(p, 1.2 + r * 0.12, { smoke: 1 }); debrisBurst(p, 16 + r * 2, 12 + r, 0.5 + r * 0.04, 'metal', { hot: true, up: 0.3 });
  if (h && h.bld) debrisBurst(p, 14, 12, 0.7, 'concrete');
  shockRing(_fg1.set(p.x, groundY(p.x, p.z), p.z), R * 1.2, 0.5, 0xffc890); fxDust(_fg1, nfx(14), 5, 10); shake(0.85, p); snd('boom', p, 0.9);
  /* and the machine itself is finished */
  fgRestore(e); e.spawnGuard = 0; e.damage(e.hp + 1e5, src, 'crash');
  awardPoints(200, h && h.ent && h.ent.kind !== 'soldier' ? 'Force throw · two for one' : h && h.bld ? 'Force throw · through the wall' : 'Force throw');
}
function fgThrownTick(dt) {
  for (let i = FG.thrown.length - 1; i >= 0; i--) {
    const e = FG.thrown[i], T0 = e.fgThrown;
    if (!T0 || !e.alive || e.remove) { fgRestore(e); FG.thrown.splice(i, 1); continue; }
    T0.t += dt; T0.vel.y -= 22 * dt; e.pos.addScaledVector(T0.vel, dt);
    e.pos.x = clamp(e.pos.x, -BOUND, BOUND); e.pos.z = clamp(e.pos.z, -BOUND, BOUND);
    if (e.yaw !== undefined) e.yaw += T0.spin * dt;
    e.obj.position.copy(e.pos); e.obj.rotation.x += T0.spin * 0.7 * dt; e.obj.rotation.y += T0.spin * dt; e.obj.rotation.z += T0.roll * dt;
    if (Math.random() < dt * 30) FXS.spawn(e.pos.x, e.pos.y, e.pos.z, 0, 0.4, 0, 1.4, 0.5, 2, 0.5, 0.48, 0.45, 0.4, 0.38, 0.35, 0.6, 1, 0.2);
    const h = T0.t > 0.08 ? fgHit(e) : null;
    if (h || T0.t > 6) { FG.thrown.splice(i, 1); fgImpact(e, h); }
  }
}
/* ---------- wiring: the Force button decides between a parked car and a machine ---------- */
{
  const _tk = tkTick;
  tkTick = function (dt) {
    const pe = PLAYER.ent;
    fgThrownTick(dt);
    if (FG.e) {
      POW.tkCd -= dt; fgHold(dt);
      if (FG.e && keys.KeyF && POW.tkCd <= 0 && GAME.state === 'play') { keys.KeyF = false; POW.tkCd = 0.25; fgThrow(); }
      return;
    }
    if ((FG.hintT -= dt) <= 0) { FG.hintT = 0.25; FG.cand = !POW.tk && pe && pe.alive && !pe.mount && GAME.state === 'play' ? fgFind(pe) : null; }
    if (keys.KeyF && !POW.tk && POW.tkCd <= 0 && GAME.state === 'play' && pe && pe.alive && !pe.mount) {
      const f = fgFind(pe); if (f) { const c = tkFind(pe); if (!c || f.d < c.d + 6) { keys.KeyF = false; POW.tkCd = 0.25; fgGrab(f.e); return; } }
    }
    return _tk(dt);
  };
  mountHint = (prev => function (pe) {
    if (FG.e) return `F / FORCE · throw the ${FG_NAME[FG.e.kind]} where you are looking`;
    const h = prev(pe); if (POW.tk) return h;
    if (FG.cand && FG.cand.e.alive) return `F / FORCE · seize that ${FG_NAME[FG.cand.e.kind]}`;
    return h;
  })(mountHint);
  /* the Force is used up if the game leaves play while you hold something */
  const _end = typeof unstick === 'function' ? unstick : null;
  if (_end) unstick = function (...a) { fgRelease(); return _end.apply(this, a); };
}
