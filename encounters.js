'use strict';
/* ===================== IRON MERIDIAN · on the road: nothing is ever quiet when you're running to a post ===================== */
// While the Commander is on foot and nothing has shot at him for a while, the road throws something at him:
//  AMBUSH  · a fireteam of a hostile army breaks cover ahead          ELITE    · a named enemy champion with a bounty
//  BARRAGE · enemy shells walk across your path (red rings, dodge)    STRAFE   · enemy fighters make a gun run, ours chase
//  SUPPLY  · a drop pod lands ahead: ammo, rockets, grenades, health and XP for whoever reaches it first
const ENC = { t: 14, quiet: 0, pods: [], rings: [], lastSay: 0 };
const ELITE_NAMES = { 2: ['Executor Kael', 'Blademaster Syr', 'Warlord Cinder', 'Huntmaster Thorn'] };
function aheadOf(pe, dist, spread) {
  const yaw = PLAYER.yaw + Math.PI, a = yaw + rand(-spread, spread); const p = landNear(pe.pos.x + Math.sin(a) * dist, pe.pos.z + Math.cos(a) * dist, 12); p.y = groundY(p.x, p.z); return p;
}
const hostileArmy = () => 2; /* there is one enemy on this island: the Villains */
function encAmbush(pe) {
  const t = hostileArmy(), p = aheadOf(pe, rand(65, 90), 0.5), n = warTake(t, 4 + ((Math.random() * 3) | 0));
  for (let i = 0; i < n; i++) { const s = spawnUnit('soldier', t); if (!s) continue; const c = coverNear(p.x, p.z, 25); const q = c.length ? new V3(c[i % c.length].x + rand(-3, 3), 0, c[i % c.length].z + rand(-3, 3)) : new V3(p.x + rand(-10, 10), 0, p.z + rand(-10, 10)); s.spawnAt(q); s.target = pe; s.goalT = 8; }
  if (n) comms('Alpha Lead', pick([`Contact front! ${TEAM[t].short} ambush!`, `${TEAM[t].short} fireteam in the rocks ahead!`, 'Ambush! Get down and return fire!']), 'b');
}
function encElite(pe) {
  const t = hostileArmy(); if (!warTake(t, 3)) return; const p = aheadOf(pe, rand(70, 95), 0.4);
  const boss = spawnUnit('soldier', t); if (!boss) return; boss.spawnAt(p); boss.heavy = true; boss.maxHp = boss.hp = 420; boss.bounty = 600; boss.name = pick(ELITE_NAMES[t] || ['Enemy champion']); boss.target = pe; boss.obj.scale.setScalar(1.18);
  for (let i = 0; i < 2; i++) { const s = spawnUnit('soldier', t); if (s) { s.spawnAt(new V3(p.x + rand(-6, 6), 0, p.z + rand(-6, 6))); s.target = pe; } }
  banner(`Bounty · ${boss.name}`, 'An enemy champion is hunting you · take them down for a bounty', TEAM_CSS[t]); comms('COMMAND', `${boss.name} is on the field near you. Bounty authorised.`, 'cmd');
}
function encBarrage(pe) {
  const yaw = PLAYER.yaw + Math.PI, side = Math.random() < 0.5 ? 1 : -1, ax = pe.pos.x + Math.sin(yaw) * 30, az = pe.pos.z + Math.cos(yaw) * 30, rx = Math.cos(yaw) * side, rz = -Math.sin(yaw) * side;
  for (let i = 0; i < 6; i++) { const x = ax + rx * (i - 2.5) * 11 + rand(-3, 3), z = az + rz * (i - 2.5) * 11 + rand(-3, 3); if (Math.hypot(x - pe.pos.x, z - pe.pos.z) < 6) continue; const ring = new T.Mesh(new T.RingGeometry(5, 6, 28).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false })); ring.position.set(x, groundY(x, z) + 0.3, z); scene.add(ring); ENC.rings.push({ ring, t: 1.6 + i * 0.45 }); }
  comms('Alpha Lead', 'Incoming! Shells walking across the road, watch the rings!', 'b'); snd('missile', null, 0.5);
}
function encStrafe(pe) {
  for (let i = 0; i < 2; i++) { const f = spawnUnit('fighter', 2); if (f) { f.pos.set(pe.pos.x + rand(-200, 200), 120, pe.pos.z - 500 + i * 30); f.target = pe; } }
  for (let i = 0; i < 2; i++) { const f = spawnUnit('fighter', 1); if (f) f.pos.set(pe.pos.x + rand(-200, 200), 160, pe.pos.z + 500); }
  comms('Alpha Lead', 'Enemy fighters on a gun run! Our birds are right behind them!', 'b');
}
const POD_G = mergeGeos([new T.CylinderGeometry(1.1, 1.4, 2.4, 10).translate(0, 1.2, 0), new T.ConeGeometry(1.1, 1, 10).translate(0, 2.9, 0)]), POD_M = std(0xd8c070, 0.5, 0.6, { emissive: 0x403010 });
function encSupply(pe) {
  const p = aheadOf(pe, rand(40, 60), 0.35), m = new T.Mesh(POD_G, POD_M); m.position.set(p.x, p.y + 220, p.z); m.castShadow = true; scene.add(m);
  const beam0 = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 60, 8, 1, true).translate(0, 30, 0), new T.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false })); beam0.position.copy(p); scene.add(beam0);
  ENC.pods.push({ m, beam: beam0, p, t: 0, landed: false }); comms('Quartermaster', 'Supply pod inbound just ahead of you. Grab it before anyone else does.', 'b');
}
function updateEncounters(dt) {
  const pe = PLAYER.ent, P = PLAYER;
  for (let i = ENC.rings.length - 1; i >= 0; i--) { const R = ENC.rings[i]; R.t -= dt; R.ring.material.opacity = 0.45 + 0.35 * Math.sin(TIME * 20); if (R.t <= 0) { const p = R.ring.position.clone(); fxExplosion(p, 1.7); explodeDamage(p, 6.5, 120, null, 2); fxDust(p, 10, 5, 9); shake(0.6, p); snd('boom', p, 0.9); scene.remove(R.ring); R.ring.material.dispose(); R.ring.geometry.dispose(); ENC.rings.splice(i, 1); } }
  for (let i = ENC.pods.length - 1; i >= 0; i--) {
    const D = ENC.pods[i]; D.t += dt;
    if (!D.landed) { D.m.position.y = Math.max(D.p.y, D.m.position.y - dt * 120); if (Math.random() < 0.6) FXA.spawn(D.m.position.x, D.m.position.y + 3, D.m.position.z, 0, 4, 0, 0.4, 2, 0.5, 4, 2, 0.5, 1.2, 0.3, 0.1, 1, 0.5, 0); if (D.m.position.y <= D.p.y) { D.landed = true; fxDust(D.p, 16, 6, 10); shake(0.4, D.p); snd('stomp', D.p, 0.8); } continue; }
    const taker = pe && pe.alive && pe.kind === 'soldier' && pe.pos.distanceTo(D.p) < 3.5 ? pe : null;
    if (taker) { taker.hp = taker.maxHp; P.ammo = P.mag; P.reload = 0; P.rockets = P.maxRockets; P.nades = P.maxNades; P.orbCd = 0; addXP(150); awardPoints(150, 'Supply pod'); banner('Supply pod', 'Health, ammo, rockets, grenades and the orbital lance · +150 XP', 'var(--amber)'); snd('ui', null, 0.5); }
    if (taker || D.t > 60) { scene.remove(D.m); scene.remove(D.beam); D.beam.material.dispose(); ENC.pods.splice(i, 1); }
  }
  if (!pe || !pe.alive || GAME.state !== 'play' || pe.kind !== 'soldier' || pe.mount || pe.pos.y > 300 || P.pod || P.free || P.para) { ENC.quiet = 0; return; }
  const shotAt = pe.hurtT > 0 || AGGRO.n > 0; ENC.quiet = shotAt ? 0 : ENC.quiet + dt;
  if ((ENC.t -= dt) > 0 || ENC.quiet < 6 || pe.moveSpeed < 2) return;
  ENC.t = rand(18, 30);
  const r = Math.random(); if (r < 0.32) encAmbush(pe); else if (r < 0.48) encElite(pe); else if (r < 0.66) encBarrage(pe); else if (r < 0.8) encStrafe(pe); else encSupply(pe);
}
