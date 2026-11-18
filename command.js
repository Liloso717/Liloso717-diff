'use strict';
/* ===================== IRON MERIDIAN · the Commander's own company: Alpha, Bravo, Charlie ===================== */
// 60 soldiers in three squads of 20 that move as one unit around the Commander and act on his orders.
// Keys: 4 / 5 / 6 select Alpha / Bravo / Charlie, 7 selects all · Z follow me · B hold here · N advance to aim point · M take point.
// Alpha guards the Commander and splits fire onto his target and his attackers; Bravo and Charlie clear threats in their own sector.
const CMD = {
  sel: 'all', focus: null, focusT: 0, threat: null, threatT: 0, load: new Map(), reinfT: 20,
  teams: [
    { id: 'Alpha', size: 11, off: [-7, 5], col: new T.Color(0.4, 2.2, 4), m: [], mode: 'follow', anchor: new V3(), yaw: 0 },
    { id: 'Bravo', size: 11, off: [7, 5], col: new T.Color(4, 3, 0.6), m: [], mode: 'follow', anchor: new V3(), yaw: 0 },
    { id: 'Charlie', size: 10, off: [0, -8], col: new T.Color(0.6, 3.6, 1.2), m: [], mode: 'follow', anchor: new V3(), yaw: 0 },
  ],
};
const CMD_MARK = new T.ConeGeometry(0.22, 0.42, 4).rotateX(Math.PI);
CMD.teams.forEach(ft => { ft.mat = basic(ft.col, { transparent: true, opacity: 0.9, depthWrite: false }); });

const cmdLocal = (x, z, yaw, rx, fz, out) => out.set(x + rx * Math.cos(yaw) - fz * Math.sin(yaw), 0, z - rx * Math.sin(yaw) - fz * Math.cos(yaw)); // right/forward → world, Commander yaw convention
function cmdSlot(ft, i, out) { // tight block formation: four abreast, 2.4 m apart
  const c = i % 4, r = (i / 4) | 0; return cmdLocal(ft.anchor.x, ft.anchor.z, ft.yaw, (c - 1.5) * 2.4, -r * 2.4, out);
}
function cmdRecruit(ft, p) {
  const s = new Soldier(1); s.cmd = ft; s.spawnAt(p); s.name = `${ft.id} ${ft.m.length + 1}`; if ((CMD.rec = (CMD.rec || 0) + 1) % 5 === 0) s.wpn = 'laser'; /* weapons by class: eight rifles to two lasers */
  const mk = new T.Mesh(CMD_MARK, ft.mat); mk.position.y = 2.35; s.obj.add(mk); ft.m.push(s); addEnt(s); return s;
}
function cmdSetup() {
  for (const ft of CMD.teams) { ft.m = []; ft.mode = 'follow'; const h = HQ[1]; ft.anchor.set(h.x + ft.off[0] * 2, 0, h.z - 30 - ft.off[1]); ft.yaw = 0; for (let i = 0; i < ft.size; i++) cmdRecruit(ft, cmdSlot(ft, i, new V3())); }
}
const cmdYaw = pe => PLAYER.role === 'trooper' ? PLAYER.yaw : (pe.yaw !== undefined ? pe.yaw : pe.heading || 0) + Math.PI;
function cmdSelected() { return CMD.sel === 'all' ? CMD.teams : CMD.teams.filter(t => t.id === CMD.sel); }
function cmdOrder(mode) {
  const pe = PLAYER.ent; if (!pe || !pe.alive) return;
  let pt = pe.pos;
  if (mode === 'move') { const r = rayCast(camera.position, camDir(_v5), 900, pe, 1); if (r.t >= 899) return; pt = r.point; }
  const yaw = cmdYaw(pe);
  for (const ft of cmdSelected()) { ft.mode = mode; ft.leadT = 0; if (mode !== 'lead') { ft.yaw = yaw; cmdLocal(pt.x, pt.z, yaw, ft.off[0], ft.off[1], ft.anchor); } }
  if (mode === 'move') { flashLight(_v1.copy(pt).setY(pt.y + 1), 3, 25, 0.4, 0x5ca8ff); shockRing(pt, 10, 0.6, 0x5ca8ff); }
  const who = CMD.sel === 'all' ? 'All squads' : CMD.sel;
  const line = { follow: [`${who}, form on me!`, 'Copy, Commander. On you.'], hold: [`${who}, hold this position!`, 'Holding. Nobody gets through.'], move: [`${who}, push to that point!`, 'Moving up! Covering fire!'], lead: [`${who}, take point. Your fight!`, 'We have the lead! On us, push, push!'] }[mode];
  comms('You', line[0], 'b'); setTimeout(() => comms(`${cmdSelected()[0].id} Lead`, line[1], 'b'), 700); snd('ui', null, 0.3);
}
/* squad selection and orders are not on the keys any more: the squads follow on their own */
// spread fire: nearest threat, penalised by how many of the company already shoot at it (vehicles soak more shooters)
function cmdPickTarget(s, center, range) {
  let best = null, bs = 1e9;
  for (const e of ENTS) {
    if (!e.alive || !isHostile(e.team) || !e.hitR || e.downed || !(e.kind === 'soldier' || e.kind === 'gunship' || isGroundVeh(e))) continue;
    if (Math.hypot(e.pos.x - center.x, e.pos.z - center.z) > range) continue;
    const n = (CMD.load.get(e) || 0) - (s.target === e ? 1 : 0);
    const sc = e.pos.distanceTo(s.pos) + n * (e.kind === 'soldier' ? 40 : 14) - (s.target === e ? 15 : 0);
    if (sc < bs) { bs = sc; best = e; }
  }
  return best;
}
const cmdLive = (e, s, r) => e && e.alive && !e.downed && e.pos.distanceTo(s.pos) < r;
// called from Soldier.update's think step: hold the slot, pick targets by role, follow the Commander's lead
function cmdThink(s) {
  if (convoyBoard(s)) return; // running to a seat in the convoy
  const ft = s.cmd, idx = Math.max(0, ft.m.indexOf(s)), pe = PLAYER.ent; cmdSlot(ft, idx, s.goal);
  s.goal.x += s.pers.jit.x * 0.25; s.goal.z += s.pers.jit.z * 0.25; s.follow = true; s.chaseT = 0; s.assist = null; s.goalT = 5;
  s.cmdMove = Math.hypot(s.goal.x - s.pos.x, s.goal.z - s.pos.z) > 7;
  if (ft.id === 'Alpha') { // wingmen: half on the Commander's target, the rest on whoever is hitting him, then threats around him
    if (idx % 2 === 0 && cmdLive(CMD.focus, s, 200)) s.target = CMD.focus;
    else if (cmdLive(CMD.threat, s, 200)) s.target = CMD.threat;
    else s.target = cmdPickTarget(s, pe && pe.alive ? pe.pos : ft.anchor, 110);
  } else s.target = cmdPickTarget(s, ft.anchor, ft.mode === 'lead' ? 150 : 95); // Bravo and Charlie clear their own sector
  if (s.target && !s.cmdMove) { const c = pickCover(s, s.target, s.goal, 10); if (c) s.goal.copy(c); } // take cover near the slot
  if (s.revTgt && s.revTgt.pos.distanceTo(ft.anchor) > 35) { if (s.revTgt.reviver === s) s.revTgt.reviver = null; s.revTgt = null; }
}
function updateCommand(dt) {
  const pe = PLAYER.ent, ground = pe && pe.alive && GAME.state === 'play' && pe.kind !== 'fighter';
  CMD.load.clear(); for (const ft of CMD.teams) for (const m of ft.m) if (m.target) CMD.load.set(m.target, (CMD.load.get(m.target) || 0) + 1);
  const hurt = ground && pe.hp < pe.maxHp * 0.5;
  for (const ft of CMD.teams) {
    ft.m = ft.m.filter(s => s.alive && !s.remove);
    if (ft.mode === 'follow' && ground) {
      const k = (pe.kind === 'soldier' ? 1 : 2.5) * (hurt && ft.id === 'Alpha' ? 0.45 : 1); ft.yaw = angLerp(ft.yaw, cmdYaw(pe), Math.min(1, dt * 2));
      cmdLocal(pe.pos.x, pe.pos.z, ft.yaw, ft.off[0] * k, ft.off[1] * k, _v6);
      if (ft.id !== 'Alpha') { if ((ft.flT = (ft.flT || 0) - dt) <= 0) { ft.flT = 0.3; ft.flank = findTarget({ pos: _v6, team: 1 }, 70, isSoldierE); } if (ft.flank && ft.flank.alive) _v6.lerp(ft.flank.pos, 0.18); } // drift toward nearby contact to cover the flank
      ft.anchor.lerp(_v6, Math.min(1, dt * 3));
    } else if (ft.mode === 'lead') { // the squad takes point: hunts the nearest contact or pushes the objective on its own
      if ((ft.leadT = (ft.leadT || 0) - dt) <= 0) {
        ft.leadT = 5; const t = findTarget({ pos: ft.anchor, team: 1 }, 320, e => e.kind === 'soldier' || isGroundVeh(e)); const cp = pickObjective(1, ft.anchor);
        ft.dest = t ? t.pos.clone() : new V3(cp.x, 0, cp.z); const dx = ft.dest.x - ft.anchor.x, dz = ft.dest.z - ft.anchor.z, d = Math.hypot(dx, dz) || 1;
        ft.yaw = Math.atan2(-dx, -dz); if (t) ft.dest.set(t.pos.x - dx / d * 22, 0, t.pos.z - dz / d * 22);
      }
      if (ft.dest) { const dx = ft.dest.x - ft.anchor.x, dz = ft.dest.z - ft.anchor.z, d = Math.hypot(dx, dz); if (d > 1) { const st = Math.min(d, 4.6 * dt); ft.anchor.x += dx / d * st; ft.anchor.z += dz / d * st; } }
    }
  }
  // Alpha's medic patches the Commander up when he's hurt
  if (hurt && pe.kind === 'soldier') { const md = CMD.teams[0].m.find(s => s.medic && !s.downed && s.pos.distanceTo(pe.pos) < 4); if (md) { pe.hp = Math.min(pe.maxHp, pe.hp + 16 * dt); if (Math.random() < dt * 10) FXA.spawn(pe.pos.x + rand(-0.5, 0.5), pe.pos.y + rand(0.3, 1.6), pe.pos.z + rand(-0.5, 0.5), 0, 1.5, 0, 0.7, 0.3, 0.1, 0.4, 2.6, 1, 0.1, 0.8, 0.3, 1, 0, 0); if (!CMD.patched) { CMD.patched = true; comms(md.name, 'Hold still, Commander. Patching you up.', 'b'); } } } else if (!hurt) CMD.patched = false;
  if ((CMD.focusT -= dt) <= 0) CMD.focus = null;
  if ((CMD.threatT -= dt) <= 0) CMD.threat = null;
  if ((CMD.hudT = (CMD.hudT || 0) - dt) <= 0) { CMD.hudT = 0.25; const el = $('#squads'); el.classList.toggle('hidden', GAME.state !== 'play'); const h = cmdHud(); if (el._h !== h) { el._h = h; el.innerHTML = h; } }
  if ((CMD.reinfT -= dt) <= 0) { // reinforcements walk up from behind the squad
    CMD.reinfT = 6; for (const t of CMD.teams) t.m = t.m.filter(s => s.alive && !s.remove); const ft = CMD.teams.find(t => t.m.length < t.size);
    if (ft && GAME.state !== 'menu' && warTake(1)) { const a = ft.anchor; const p = cmdLocal(a.x, a.z, ft.yaw, rand(-6, 6), -45, new V3()); if (H(p.x, p.z) > -2) { cmdRecruit(ft, p); if (Math.random() < 0.4) comms(`${ft.id} Lead`, 'Replacement joining the line, Commander.', 'b'); } }
  }
}
const isSoldierE = e => e.kind === 'soldier';
function cmdThreat(src) { if (src && isHostile(src.team) && src.alive && src.pos) { CMD.threat = src; CMD.threatT = 5; } }
function cmdOnSpawn(p) { // the company drops in with the Commander if it is far away
  for (const ft of CMD.teams) {
    ft.mode = 'follow'; ft.yaw = PLAYER.yaw; cmdLocal(p.x, p.z, ft.yaw, ft.off[0], ft.off[1], ft.anchor);
    ft.m.forEach((s, i) => { if (s.pos.distanceTo(p) < 160) return; if (s.mount) s.mount.dismount(s); cmdSlot(ft, i, s.pos); pushOut(s.pos, 0.6); s.pos.y = p.y; deckClamp(s.pos); s.pos.y = surfY(s.pos.x, s.pos.z, p.y); s.target = null; fxDust(s.pos, 3, 3, 5); });
  }
  comms('Alpha Lead', 'Company is down and with you, Commander. Alpha, Bravo, Charlie on your call.', 'b');
}
function cmdFocus(ent) { if (ent && isHostile(ent.team) && ent.alive) { CMD.focus = ent; CMD.focusT = 4; } }
function cmdHud() {
  return CMD.teams.map(ft => `<div class="sqd${CMD.sel === 'all' || CMD.sel === ft.id ? ' on' : ''}"><b>${ft.id}</b><span>${ft.m.length}/${ft.size}</span><i>${{ move: 'ADVANCE', lead: 'ON POINT', follow: 'ON YOU', hold: 'HOLD' }[ft.mode]}</i></div>`).join('');
}
