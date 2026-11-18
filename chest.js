'use strict';
/* ===================== IRON MERIDIAN · THE ITEM CHEST =====================
   The goal of the war, round after round: an item chest comes down somewhere near you, both armies go for it, and
   you have to fight your way to it and get it out.
   1 GET THE CHEST   it lands 160 to 380 m from you under a gold beam. A hostile squad and a friendly squad are already
                     closing on it. Stand on it for a second and it is yours.
   2 DELIVER IT      carry it to the green extraction beam, 200 to 300 m off toward your nearest post. It is too heavy
                     to fly with: take off and you drop it. Enemy squads are thrown in your path all the way.
   3 OR STOP THEM    if a hostile soldier reaches the chest first he shoulders it and runs for his own lines. Kill him
                     and it drops where he falls. If he gets it home, the round is lost.
   Die carrying it and it drops where you fell. Deliver it and it opens: points, and one of three items (a field
   medkit, a reinforcement squad, war bonds). The next chest comes about 45 s later. A chest and an evacuation never
   run at the same time. The navigation bar and the minimap always show the next thing to do. */
const CHEST = { state: 'idle', t: 22, pos: new V3(), drop: new V3(), edrop: new V3(), carrier: null, foes: [], pals: [], take: 0, etake: 0, eby: null, think: 0, wave: 0, age: 0, won: 0, lost: 0, v: new V3(), g: null, mark: null, el: null };
function chestModels() {
  if (CHEST.g) return; const wood = std(0x6a4526, 0.8, 0.05), gold = std(0xe2b23a, 0.35, 0.85), g = new T.Group(), add = (geo, m, x, y, z) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(rbox(1.7, 0.9, 1.05, 0.1), wood, 0, 0.5, 0); add(new T.CylinderGeometry(0.525, 0.525, 1.7, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), wood, 0, 0.95, 0); /* a domed lid */
  for (const x of [-0.6, 0, 0.6]) { add(new T.TorusGeometry(0.545, 0.05, 6, 14, Math.PI).rotateY(Math.PI / 2), gold, x, 0.95, 0); add(rbox(0.12, 0.92, 1.1, 0.03), gold, x, 0.5, 0); } /* three gold straps */
  add(rbox(0.3, 0.36, 0.1, 0.04), gold, 0, 0.8, 0.56); for (const e of [-1, 1]) add(new T.TorusGeometry(0.16, 0.035, 6, 10), gold, e * 0.9, 0.6, 0).rotation.y = Math.PI / 2; /* the lock and two ring handles */
  const beam = new T.Mesh(new T.CylinderGeometry(0.35, 0.9, 70, 12, 1, true), new T.MeshBasicMaterial({ color: new T.Color(2.2, 1.6, 0.5), transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); beam.position.y = 35; g.add(beam); CHEST.beam = beam;
  scene.add(g); g.visible = false; CHEST.g = g;
  const m = new T.Group(), gm = new T.MeshBasicMaterial({ color: new T.Color(0.4, 2.4, 0.8), transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  const b2 = new T.Mesh(new T.CylinderGeometry(1.2, 2.4, 80, 14, 1, true), gm); b2.position.y = 40; m.add(b2); const ring = new T.Mesh(new T.TorusGeometry(7, 0.22, 6, 40).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: new T.Color(0.5, 2.6, 0.9) })); ring.position.y = 0.3; m.add(ring);
  scene.add(m); m.visible = false; CHEST.mark = m;
  const el = document.createElement('div'); el.id = 'chestTag'; el.style.cssText = 'position:fixed;left:50%;top:calc(46px + env(safe-area-inset-top,0px));transform:translateX(-50%);font:600 11px/1.3 system-ui,sans-serif;letter-spacing:.08em;color:#ffe9a8;background:rgba(20,16,6,.62);border:1px solid rgba(226,178,58,.6);padding:3px 10px;border-radius:3px;pointer-events:none;z-index:6;display:none;white-space:nowrap'; document.body.appendChild(el); CHEST.el = el;
}
function chestUnit(team, at, r0, r1) { /* a soldier of either side put down round a point and sent at it; over and above the armies' field strength */
  const C = typeof CHAMP !== 'undefined' ? CHAMP : null, was = C && C.spawning; if (C) C.spawning = true; const e = spawnUnit('soldier', team); if (C) C.spawning = was; if (!e || !e.alive) return null;
  const a = rand(0, 6.28), r = rand(r0, r1), p = landNear(at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, 6); e.pos.set(p.x, surfY(p.x, p.z, at.y + 3), p.z); if (e.lastPos) e.lastPos.copy(e.pos); if (e.obj) e.obj.position.copy(e.pos); if (e.goal) { e.goal.set(at.x, 0, at.z); e.goalT = 8; }
  (team === 1 ? CHEST.pals : CHEST.foes).push(e); return e;
}
function chestToward(from, to, dist, out) { /* a clear, level, dry spot about that far along the way: not in a building, not under a deck, not on a slope */
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1, k = Math.min(dist, d);
  for (let i = 0; i < 24; i++) { const r = 10 + i * 3, p = landNear(from.x + dx / d * k, from.z + dz / d * k, r), h = H(p.x, p.z); out.set(p.x, h, p.z);
    if (h > 1.5 && Math.abs(H(p.x + 4, p.z) - h) < 1.2 && Math.abs(H(p.x, p.z + 4) - h) < 1.2 && !buildingAt(CHEST.v.set(p.x, h + 1, p.z)) && !inAnyBuilding(p.x, p.z, 5) && !deckAt(p.x, p.z, h + 40)) return out; }
  return out;
}
function inAnyBuilding(x, z, m) { for (const b of BUILDINGS) if (b.alive && x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m) return true; return false; }
function chestStart() {
  const pe = PLAYER.ent; if (typeof EVAC !== 'undefined' && EVAC.state !== 'idle') return false; chestModels();
  let ok = false; for (let i = 0; i < 40 && !ok; i++) { const a = rand(0, 6.28), r = rand(160, 380), x = pe.pos.x + Math.cos(a) * r, z = pe.pos.z + Math.sin(a) * r, h = H(x, z);
    if (Math.abs(x) > BOUND - 50 || Math.abs(z) > BOUND - 50 || h < 2 || Math.abs(h - pe.pos.y) > 45 || Math.abs(H(x + 4, z) - h) > 1.2 || buildingAt(CHEST.v.set(x, h + 1, z)) || inAnyBuilding(x, z, 4) || deckAt(x, z, h + 40)) continue; CHEST.pos.set(x, h, z); ok = true; }
  if (!ok) return false;
  let fx = HQ[1].x, fz = HQ[1].z, bd = 1e9; for (const cp of CPS) if (cp.owner === 1) { const d = Math.hypot(cp.x - CHEST.pos.x, cp.z - CHEST.pos.z); if (d > 120 && d < bd) { bd = d; fx = cp.x; fz = cp.z; } } /* extraction: toward your nearest post, never more than 300 m */
  chestToward(CHEST.pos, CHEST.v.set(fx, 0, fz), rand(200, 300), CHEST.drop); chestToward(CHEST.pos, HQ[2], 260, CHEST.edrop);
  CHEST.g.position.copy(CHEST.pos); CHEST.g.scale.setScalar(1); CHEST.g.rotation.set(0, rand(0, 6.28), 0); CHEST.g.visible = CHEST.beam.visible = true; CHEST.mark.position.copy(CHEST.drop); CHEST.mark.visible = false;
  CHEST.state = 'loose'; CHEST.carrier = null; CHEST.take = CHEST.etake = 0; CHEST.eby = null; CHEST.age = 0; CHEST.wave = 14;
  for (let i = 0; i < 10; i++) chestUnit(2, CHEST.pos, 22, 48); for (let i = 0; i < 5; i++) chestUnit(1, CHEST.pos, 30, 55);
  banner('Item chest down', 'Both sides are going for it. Get there first.', 'var(--amber)'); comms('COMMAND', 'An item chest has come down near you. Hostiles are closing on it. Take it and bring it out.', 'cmd'); snd('chime', null, 0.6);
  return true;
}
function chestDropAt(p, why) { CHEST.pos.set(p.x, surfY(p.x, p.z, p.y + 2), p.z); CHEST.g.position.copy(CHEST.pos); CHEST.g.scale.setScalar(1); CHEST.g.rotation.set(0, CHEST.g.rotation.y, 0); CHEST.beam.visible = true; CHEST.mark.visible = false; CHEST.carrier = null; CHEST.state = 'loose'; CHEST.take = CHEST.etake = 0; CHEST.eby = null; if (why) banner('Chest dropped', why, 'var(--amber)'); }
function chestEnd(won) {
  const pe = PLAYER.ent; CHEST.g.visible = CHEST.mark.visible = false; CHEST.carrier = null; CHEST.state = 'idle'; CHEST.t = 45; for (const e of CHEST.foes) e.chest = false; CHEST.foes = []; CHEST.pals = [];
  if (!won) { CHEST.lost++; banner('Chest lost', 'The enemy got it home. Another is on its way.', 'var(--red)'); comms('COMMAND', 'They got the chest out. Be faster on the next one.', 'cmd'); return; }
  CHEST.won++; const item = (Math.random() * 3) | 0; awardPoints(1500, 'Chest delivered'); if (pe && pe.alive) pe.hp = Math.min(pe.maxHp, pe.hp + pe.maxHp * 0.5); snd('chime', null, 0.8);
  if (item === 0) { if (pe && pe.alive) pe.hp = pe.maxHp; banner('Chest opened · Field medkit', 'Back to full health', 'var(--green, #7be38a)'); }
  else if (item === 1) { let n = 0; if (pe) for (let i = 0; i < 6; i++) if (chestUnit(1, pe.pos, 6, 14)) n++; CHEST.pals = []; banner('Chest opened · Reinforcements', `${n} fresh troops at your side`, 'var(--green, #7be38a)'); }
  else { awardPoints(3000, 'War bonds'); banner('Chest opened · War bonds', '+3000', 'var(--green, #7be38a)'); }
}
function updateChest(dt) {
  const pe = PLAYER.ent, play = GAME.state === 'play' && pe && pe.alive;
  if (CHEST.state === 'idle') { if (CHEST.el) CHEST.el.style.display = 'none'; if (play && (CHEST.t -= dt) <= 0 && !chestStart()) CHEST.t = 8; return; }
  if (typeof EVAC !== 'undefined' && EVAC.state === 'idle' && EVAC.t < 25) EVAC.t = 25; /* no evacuation while a chest is in play */
  CHEST.age += dt; CHEST.beam.material.opacity = 0.16 + Math.sin(TIME * 3) * 0.05; const c = CHEST.carrier;
  if (CHEST.state === 'loose') {
    CHEST.g.position.y = CHEST.pos.y + 0.12 + Math.sin(TIME * 2.2) * 0.1; CHEST.g.rotation.y += dt * 0.5;
    if (play && !pe.mount && !POW.fly && Math.abs(pe.pos.y - CHEST.pos.y) < 3 && Math.hypot(pe.pos.x - CHEST.pos.x, pe.pos.z - CHEST.pos.z) < 3.4) { if ((CHEST.take += dt) >= 1) { CHEST.carrier = pe; CHEST.state = 'mine'; CHEST.mark.visible = true; CHEST.beam.visible = false; CHEST.wave = 6; banner('You have the chest', 'Carry it to the green beam. No flying with it.', 'var(--amber)'); comms('COMMAND', 'Chest secured. Bring it to the extraction beam. They will come at you all the way.', 'cmd'); snd('ui', null, 0.7); } } else CHEST.take = 0;
    if (CHEST.state === 'loose') { let by = null; for (const e of CHEST.foes) if (e.alive && !e.downed && Math.hypot(e.pos.x - CHEST.pos.x, e.pos.z - CHEST.pos.z) < 3.6) { by = e; break; }
      if (by) { if ((CHEST.etake += dt) >= 2.5) { CHEST.carrier = by; CHEST.state = 'theirs'; CHEST.beam.visible = true; banner('Enemy has the chest', 'Stop the carrier before he gets it home', 'var(--red)'); comms('COMMAND', 'A hostile has the chest and is running. Put him down.', 'r'); snd('chime', null, 0.5); } } else CHEST.etake = Math.max(0, CHEST.etake - dt); }
    if ((CHEST.wave -= dt) <= 0) { CHEST.wave = 12; CHEST.foes = CHEST.foes.filter(e => e.alive); if (CHEST.foes.length < 6) for (let i = 0; i < 4; i++) chestUnit(2, CHEST.pos, 40, 70); } /* they keep coming for it until someone has it */
    if (CHEST.age > 240 && CHEST.state === 'loose') { CHEST.g.visible = false; CHEST.state = 'idle'; CHEST.t = 5; for (const e of CHEST.foes) e.chest = false; CHEST.foes = []; CHEST.pals = []; return; } /* nobody came: it goes, another comes */
  } else if (CHEST.state === 'mine') {
    if (!pe || !pe.alive) { chestDropAt(c.pos, 'You went down. It is lying where you fell.'); }
    else if (POW.fly || pe.mount) { chestDropAt(pe.pos, POW.fly ? 'Too heavy to fly with. Pick it up again on foot.' : 'You cannot take it aboard. Pick it up again on foot.'); CHEST.take = -1.5; }
    else { CHEST.g.scale.setScalar(0.55); CHEST.g.position.set(pe.pos.x - Math.sin(pe.yaw) * 0.5, pe.pos.y + 1.15, pe.pos.z - Math.cos(pe.yaw) * 0.5); CHEST.g.rotation.set(0, pe.yaw, 0); CHEST.pos.copy(pe.pos);
      if (Math.hypot(pe.pos.x - CHEST.drop.x, pe.pos.z - CHEST.drop.z) < 7.5) { chestEnd(true); return; }
      if ((CHEST.wave -= dt) <= 0) { CHEST.wave = 16; CHEST.foes = CHEST.foes.filter(e => e.alive); if (CHEST.foes.length < 14) { const dx = CHEST.drop.x - pe.pos.x, dz = CHEST.drop.z - pe.pos.z, d = Math.hypot(dx, dz) || 1, k = Math.min(d * 0.6, 65); CHEST.v.set(pe.pos.x + dx / d * k, pe.pos.y, pe.pos.z + dz / d * k); for (let i = 0; i < 5; i++) chestUnit(2, CHEST.v, 4, 22); comms(null, 'Hostiles ahead, between you and the beam.', 'r'); } } }
  } else if (CHEST.state === 'theirs') {
    if (!c.alive || c.downed) { chestDropAt(c.pos, 'The carrier is down. Grab it.'); }
    else { CHEST.g.scale.setScalar(0.55); CHEST.g.position.set(c.pos.x - Math.sin(c.yaw) * 0.5, c.pos.y + 1.15, c.pos.z - Math.cos(c.yaw) * 0.5); CHEST.g.rotation.set(0, c.yaw, 0); CHEST.pos.copy(c.pos); c.goal.copy(CHEST.edrop); c.goalT = 3; c.target = null;
      if (Math.hypot(c.pos.x - CHEST.edrop.x, c.pos.z - CHEST.edrop.z) < 8) { chestEnd(false); return; } }
  }
  if (CHEST.state !== CHEST.was) { CHEST.was = CHEST.state; CHEST.think = 0; if (typeof NAV !== 'undefined') NAV.t = 0; } /* a change of hands shows on the bar at once */
  if ((CHEST.think -= dt) <= 0) { CHEST.think = 2; /* both squads keep going for the chest, wherever it is */
    for (const L of [CHEST.foes, CHEST.pals]) for (const e of L) { if (!e.alive || e.downed || e === CHEST.carrier || !e.goal) continue; const foe = L === CHEST.foes; /* hostiles go right onto it to take it; your side holds a ring round it */
      if (foe && CHEST.state === 'loose') { e.goal.set(CHEST.pos.x, 0, CHEST.pos.z); e.goalT = 4; } else if (e.pos.distanceTo(CHEST.pos) > 9) { e.goal.set(CHEST.pos.x + rand(-4, 4), 0, CHEST.pos.z + rand(-4, 4)); e.goalT = 4; } }
    const s = CHEST.state, d = play ? Math.round(Math.hypot(pe.pos.x - (s === 'mine' ? CHEST.drop.x : CHEST.pos.x), pe.pos.z - (s === 'mine' ? CHEST.drop.z : CHEST.pos.z))) : 0, n = CHEST.foes.filter(e => e.alive && !e.downed).length;
    CHEST.el.style.display = GAME.state === 'play' ? 'block' : 'none'; CHEST.el.style.borderColor = s === 'theirs' ? 'rgba(255,90,74,.8)' : s === 'mine' ? 'rgba(90,230,140,.8)' : 'rgba(226,178,58,.6)';
    setText(CHEST.el, s === 'loose' ? `ITEM CHEST · ${d} m · ${n} hostiles on it` : s === 'mine' ? `CARRYING THE CHEST · extraction ${d} m · no flying` : `ENEMY HAS THE CHEST · ${d} m · stop him`); }
}
{
  const _uw = updateWorld; updateWorld = function (dt) { _uw(dt); updateChest(dt); };
  const _np = navPick;
  navPick = function (pe) {
    if (CHEST.state === 'loose') return { kind: 'GET CHEST', name: 'Item chest', p: CHEST.pos, chest: 1 };
    if (CHEST.state === 'mine') return { kind: 'DELIVER', name: 'Extraction beam', p: CHEST.drop, chest: 1 };
    if (CHEST.state === 'theirs') return { kind: 'STOP HIM', name: 'Enemy chest carrier', p: CHEST.pos, chest: 1 };
    return _np(pe);
  };
  const _du = drawUnits;
  drawUnits = function (ctx, size, layer) {
    _du(ctx, size, layer); if (CHEST.state === 'idle') return; const M = x => mapXY(x, size), k = Math.min(1.6, size / 170); ctx.save();
    ctx.fillStyle = CHEST.state === 'theirs' ? '#ff5a4a' : '#ffd24a'; ctx.strokeStyle = '#1a1406'; ctx.lineWidth = 1; ctx.fillRect(M(CHEST.pos.x) - 3.5 * k, M(CHEST.pos.z) - 3 * k, 7 * k, 6 * k); ctx.strokeRect(M(CHEST.pos.x) - 3.5 * k, M(CHEST.pos.z) - 3 * k, 7 * k, 6 * k);
    if (CHEST.state === 'mine') { ctx.strokeStyle = '#5ae68c'; ctx.lineWidth = 1.6 * k; ctx.beginPath(); ctx.arc(M(CHEST.drop.x), M(CHEST.drop.z), 4.5 * k, 0, 6.283); ctx.stroke(); } ctx.restore();
  };
  const _nw = newWar; newWar = function () { _nw.apply(this, arguments); if (CHEST.g) { CHEST.g.visible = CHEST.mark.visible = false; } CHEST.state = 'idle'; CHEST.t = 22; CHEST.foes = []; CHEST.pals = []; CHEST.carrier = null; };
}
