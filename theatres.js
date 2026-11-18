'use strict';
/* ===================== IRON MERIDIAN · theatres of war: the fight moves, and every army scores ===================== */
// Nothing rotates on a timer any more. The fight goes where the people are: pool.js picks the focus district — the
// one with the most civilians left to save or kill — or a player calls a raid on one, and `focusOn` moves the war
// there. The district's realm (land, ocean, air, space) decides which themed warfare runs around it. Kills and
// captures score, and fighting at the focus scores double.
const WAR = { 1: 0, 2: 0, 4: 0, 5: 0 };
const trenchMid = (() => { const L = TRENCHES[0], p = L[(L.length / 2) | 0]; return { x: p[0], z: p[1] }; })();
const THEATRES = [
  { key: 'land', title: 'Land · The Trenches', sub: 'Artillery and armour on the trench lines across the island', cp: CPS.filter(c => c.realm === 'land').reduce((b, c) => Math.hypot(c.x - trenchMid.x, c.z - trenchMid.z) < Math.hypot(b.x - trenchMid.x, b.z - trenchMid.z) ? c : b), at: () => trenchMid },
  { key: 'sea', title: 'Ocean · Floating Marina', sub: 'The floating city: destroyers, torpedoes and landing craft on the causeway', cp: CPS.find(c => c.id === 'marina') },
  { key: 'air', title: 'Air · Skyport', sub: 'Flak and dogfights around the platform hanging over Apex Plaza', cp: CPS.find(c => c.id === 'skyport') },
  { key: 'space', title: 'Space · Orbital Array', sub: 'Up the elevators and across to the array between the fleets', cp: CPS.find(c => c.id === 'orbital') },
];
const THEATRE = { i: -1, cur: null, t: 0, len: 150, pts: null, hudT: 0, el: null };
const _pickObjT = pickObjective;
pickObjective = function (team, pos) { if (THEATRE.cur && THEATRE.cur.cp) return THEATRE.cur.cp; return _pickObjT(team, pos); }; /* one big battle at a time: every army marches on it */
function inTheatre(p) { const T0 = THEATRE.cur; if (!T0) return false; if (T0.key === 'space') return p.y > 1200; const a = T0.at ? T0.at() : T0.cp; return Math.hypot(p.x - a.x, p.z - a.z) < 230; }
function warScore(team, n, label) { if (WAR[team] === undefined) return; WAR[team] += n; if (THEATRE.pts && THEATRE.pts[team] !== undefined) THEATRE.pts[team] += n; if (label && team === 1 && n >= 20) awardPoints(n, label); }
{ // scoring hooks: kills (double inside the theatre) and captures
  const _killedW = Ent.prototype.killed;
  Ent.prototype.killed = function (src, type) {
    const t = src && (src.team !== undefined ? src.team : null); if (t !== null && t !== this.team && WAR[t] !== undefined && this.kind !== 'capital') warScore(t, (this.kind === 'soldier' ? 1 : 5) * (inTheatre(this.pos) ? 2 : 1));
    return _killedW.call(this, src, type);
  };
}
const WAR_OWN = {};
function focusOn(cp, why) {
  if (!cp || (THEATRE.cur && THEATRE.cur.cp === cp)) return;
  const P = THEATRE.cur;
  if (P && THEATRE.pts) { let best = 0, bs = 0; for (const t of ARMIES) if (THEATRE.pts[t] > bs) { bs = THEATRE.pts[t]; best = t; }
    if (best && !ELIM[best]) { RESERVE[best] += 10; comms('COMMAND', `${TEAM[best].name} held ${P.cp ? P.cp.name : 'the fight'}. Ten more bodies for them.`, 'cmd'); if (best === 1) addXP(100); } }
  const base = THEATRES.find(t => t.key === (cp.realm === 'land' ? 'land' : cp.realm)) || THEATRES[0];
  THEATRE.cur = { key: base.key, title: `${base.title.split(' · ')[0]} · ${cp.name}`, sub: base.sub, cp, at: null };
  THEATRE.t = 1e9; THEATRE.pts = { 1: 0, 2: 0 };
  banner(`The fight moves · ${cp.name}`, why || base.sub, 'var(--amber)'); comms('COMMAND', `${why || 'Both sides are converging on ' + cp.name + '.'}`, 'cmd'); snd('big', null, 0.4);
  for (const e of ENTS) if (e.kind === 'soldier' && e.alive && !e.cmd && !e.deck && !e.isPlayer) { e.goalT = 0; e.goalCP = null; }
  chooseFronts();
}
function updateTheatres(dt) {
  if (GAME.state === 'menu' && GAME.clock < 5) return;
  if (!THEATRE.cur) focusOn(CPS.find(c => c.realm === 'land') || CPS[0]);
  // captures score
  for (const c of CPS) { const was = WAR_OWN[c.id]; WAR_OWN[c.id] = c.owner; if (was !== undefined && c.owner && c.owner !== was) warScore(c.owner, THEATRE.cur && THEATRE.cur.cp === c ? 40 : 20, c.owner === 1 ? `Captured ${c.name}` : null); }
  battleZone(dt);
  warHud(dt);
}

/* ---------- the Commander belongs where the battle is ---------- */
// Out of the active theatre for more than a few seconds (after a travel window when the theatre shifts) the
// Hero bleeds points, and the war score bleeds with him. Flying toward the fight, riding a lift down from a deck,
// theatre, a lift or escalator up to orbit, or a drop pod counts as on the way.
const OOB = { out: 0, t: 0, el: null, warned: 0, lost: 0 };
function battleTarget() { const T0 = THEATRE.cur; if (!T0) return null; if (T0.key === 'space') return T0.cp ? { x: T0.cp.x, z: T0.cp.z, name: T0.cp.name + ' (fly up, Space)' } : null; if (T0.key === 'sea') return { x: RLM.head.x, z: RLM.head.z, name: 'the Floating Marina (causeway from the east beach)' }; const a = T0.at ? T0.at() : T0.cp; return { x: a.x, z: a.z, name: T0.key === 'air' ? 'the Skyport (ziplines up from Apex Plaza)' : T0.cp ? T0.cp.name : T0.title }; }
function inBattle(pe) {
  const T0 = THEATRE.cur, p = pe.mount && pe.mount.pos ? pe.mount.pos : pe.pos; if (!T0) return true;
  if (T0.key === 'space') return p.y > 1200;
  const a = T0.at ? T0.at() : T0.cp, d = Math.hypot(p.x - a.x, p.z - a.z);
  if (T0.key === 'air') return d < 520 || (p.y > 60 && d < 900);
  if (T0.key === 'sea') return d < 320 || (H(p.x, p.z) < 0 && d < 700);
  return d < 260;
}
function enRoute(pe) { /* heading for the fight: dropping in, riding a lift, escalator, plane or zipline, or driving toward it */
  const m = pe.mount, tg = battleTarget(); if (PLAYER.pod || PLAYER.para || PLAYER.free || (m && (m.kind === 'escalator' || m.kind === 'lift' || m.kind === 'plane' || m.kind === 'zip'))) return true;
  if (m && tg && m.vel && Math.abs(m.speed || m.vel.length()) > 10) { const dx = tg.x - m.pos.x, dz = tg.z - m.pos.z, l = Math.hypot(dx, dz) || 1; return (m.vel.x * dx + m.vel.z * dz) / l > 6; }
  return false;
}
function penaltyPoints(n, label) {
  PLAYER.points = Math.max(0, (PLAYER.points || 0) - n); OOB.lost += n; const box = $('#pts'); if (!box) return;
  const d = document.createElement('div'); d.className = 'neg'; d.innerHTML = `<b>-${n}</b>${label}`; box.insertBefore(d, box.firstChild); while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => { d.style.opacity = '0'; d.style.transform = 'translateY(-10px)'; }, 1400); setTimeout(() => d.remove(), 2200);
}
function battleZone(dt) {
  if (!OOB.el) { OOB.el = document.createElement('div'); OOB.el.id = 'oob'; document.body.appendChild(OOB.el); }
  const pe = PLAYER.ent, grace = THEATRE.cur ? THEATRE.len - THEATRE.t < 45 : true;
  if (GAME.state !== 'play' || !pe || !pe.alive || grace || inBattle(pe) || enRoute(pe)) { if (OOB.out > 0 && GAME.state === 'play' && pe && pe.alive && inBattle(pe) && OOB.out > 8) comms('COMMAND', 'Good, Commander. You are back in the fight.', 'cmd'); OOB.out = 0; OOB.el.style.display = 'none'; return; }
  OOB.out += dt; const tg = battleTarget(); const dist = tg ? Math.round(Math.hypot(pe.pos.x - tg.x, pe.pos.z - tg.z)) : 0, rate = OOB.out > 30 ? 4 : 2;
  if (OOB.out < 6) { OOB.el.style.display = 'none'; return; }
  OOB.el.style.display = ''; OOB.el.innerHTML = `<b>Out of the battle</b>Return to ${tg ? tg.name : 'the theatre'} · ${dist} m · <i>-${rate} pts/s</i> · J to call a car`;
  if (TIME - OOB.warned > 40) { OOB.warned = TIME; comms('COMMAND', `Commander, the battle is at ${tg ? tg.name : 'the active theatre'}. You are costing us points out here. Get back in the fight!`, 'cmd'); snd('tick', null, 0.6); }
  if ((OOB.t -= dt) <= 0) { OOB.t = 1; penaltyPoints(rate, 'Out of the battle'); if (OOB.out > 15 && (OOB.n = (OOB.n || 0) + 1) % 3 === 0) WAR[1] = Math.max(0, WAR[1] - 1); }
}
