'use strict';
/* ===================== IRON MERIDIAN · the battle director: spectate mode as a live war film ===================== */
// While you watch (P in battle, or "Watch the battle" from the menu) a director cuts between the biggest moments:
//  · it keeps a heat map of what just happened: explosions, kills, vehicles and aircraft going down, buildings
//    collapsing, fortresses finished or razed, disasters, posts changing hands, theatre shifts
//  · it cuts to the hottest moment (interrupting a quiet shot when something big goes off), frames firefights as
//    duels over a soldier's shoulder, and stages its own set-pieces in front of the lens: aircraft into towers,
//    barrages walking up buildings, wrecks cartwheeling into blocks
//  · the biggest impacts play in slow motion, the camera shakes with nearby blasts, and a ticker logs the war
//  · number keys while watching: 1 follow the action · 2 duels · 3 air war · 4 space war · 0 director's choice
const DIR = { heat: [], shot: null, slow: 0, setT: 6, ticker: [], lastP: new V3(1e9, 0, 0), lastEv: null, cutT: 0, mode: 0, shake: 0, focus: { pos: new V3() }, tickT: 0, el: null };
const spectating = () => GAME.state === 'spectate' || GAME.state === 'menu';
function heat(p, w, kind, label, sub, subj) {
  if (!spectating() || !p || !isFinite(p.x)) return;
  DIR.heat.push({ p: p.clone(), w, kind, label, sub, subj: subj || null, t: TIME }); if (DIR.heat.length > 48) DIR.heat.shift();
  if (label && w >= 3) dirTick(sub, label);
  const d = camera.position.distanceTo(p); if (d < 260 && w >= 2) DIR.shake = Math.max(DIR.shake, Math.min(1, w / 10) * (1 - d / 260));
}
function dirTick(sub, label) {
  DIR.ticker.unshift(`<b>${sub || 'Live'}</b> ${label}`); DIR.ticker.length = Math.min(DIR.ticker.length, 4);
  if (!DIR.el) { DIR.el = document.createElement('div'); DIR.el.id = 'dirTicker'; document.body.appendChild(DIR.el); }
  DIR.el.innerHTML = DIR.ticker.map((t, i) => `<div style="opacity:${1 - i * 0.22}">${t}</div>`).join('') + '<i>Camera: 0 director · 1 action · 2 duels · 3 air · 4 space · P back to battle</i>';
}
const nameOf = e => e ? (e.name || { soldier: 'a trooper', fighter: 'a starfighter', gunship: 'a gunship', tank: 'a hover tank', walker: 'an assault walker', speeder: 'a speeder', naval: 'a destroyer', capital: 'a capital ship', shiftframe: 'a Shiftframe', dropship: 'a dropship', transport: 'a transport', starship: 'a starship', monster: 'the bio-titan' }[e.kind] || e.kind) : 'something';
/* ---------- hooks: everything big reports in ---------- */
const _dirBoom = fxExplosion;
fxExplosion = function (p, scale = 1, opts) { _dirBoom(p, scale, opts); if (scale >= 1.4 && spectating()) heat(p, scale * 0.8, 'boom'); };
const _dirCollapse = Building.prototype.collapse;
Building.prototype.collapse = function (src) {
  _dirCollapse.call(this, src); if (this.cover || this.fort) return;
  const p = new V3(this.x, this.gy + this.h * 0.5, this.z); heat(p, 9 + this.h / 20, 'collapse', `${this.landmark || 'A city block'} is coming down`, 'Collapse');
  if (spectating() && camera.position.distanceTo(p) < 500) slowMo(1.8); DIR.lastB = this;
};
const _dirKilled = Ent.prototype.killed;
Ent.prototype.killed = function (src, type) {
  _dirKilled.call(this, src, type);
  if (!spectating()) return; const big = this.kind !== 'soldier';
  if (big) heat(this.pos, { capital: 14, naval: 10, walker: 8, monster: 12, starship: 7, tank: 5, gunship: 5, dropship: 5, fighter: 4, shiftframe: 5 }[this.kind] || 3, 'kill', src && src !== this ? `${nameOf(src)} takes down ${nameOf(this)}` : `${nameOf(this)} is destroyed`, `${TEAM[this.team] ? TEAM[this.team].short : ''} loss`, src && src.alive ? src : null);
  else heat(this.pos, type === 'melee' ? 3 : 0.7, 'kill', type === 'melee' && src && src !== this ? `${nameOf(src)} cuts down ${nameOf(this)}` : null, type === 'melee' ? 'Blade kill' : null, src && src.alive ? src : null);
};
const _dirFort = completeFort;
completeFort = function (s) { _dirFort(s); heat(new V3(s.x, s.gy + 6, s.z), 10, 'fort', `The Builder Guild finishes the ${s.name} fortress`, 'Fortress'); };
const _dirRaze = razeSite;
razeSite = function (s, src) { _dirRaze(s, src); heat(new V3(s.x, s.gy + 3, s.z), 11, 'raze', `${s.name} construction razed`, 'Razed'); if (spectating()) slowMo(1.4); };
/* the cinema set-pieces get filmed */
const _dirAir = setAirCrash, _dirBar = setBarrage, _dirWreck = setWreck;
setAirCrash = function (pe) { const ok = _dirAir(pe); if (ok) { const D = CHAOS.doom[CHAOS.doom.length - 1]; heat(new V3(D.b.x, D.b.gy + D.b.h * 0.7, D.b.z), 14, 'aircrash', `${nameOf(D.e)} dives into ${D.b.landmark || 'a tower'}`, 'Air crash', D.e); DIR.slowAt = D; } return ok; };
setBarrage = function (pe) { const ok = _dirBar(pe), b = CHAOS.lastB; if (ok && b) heat(new V3(b.x, b.gy + b.h * 0.5, b.z), 9, 'barrage', `Artillery walks up ${b.landmark || 'a high-rise'}`, 'Barrage'); return ok; };
setWreck = function (pe) { const ok = _dirWreck(pe), e = CHAOS.lastWreck; if (ok && e) heat(e.pos, 9, 'wreck', `${nameOf(e)} cartwheels into the buildings`, 'Wreck', e); return ok; };
/* ---------- shots ---------- */
function eventShot(ev, dur) {
  const big = ev.kind === 'collapse' || ev.kind === 'aircrash' || ev.kind === 'nature' || ev.kind === 'fort', D = big ? rand(90, 140) : ev.kind === 'barrage' ? rand(70, 110) : rand(28, 50);
  const a = Math.atan2(camera.position.z - ev.p.z, camera.position.x - ev.p.x) + rand(-0.6, 0.6), ax = ev.p.x + Math.cos(a) * D, az = ev.p.z + Math.sin(a) * D;
  DIR.shot = { type: 'event', ev, p: ev.p.clone(), a, D, h: Math.max(groundY(ax, az) + 3, ev.p.y + D * (big ? 0.18 : 0.3)) - ev.p.y, t: 0, dur: dur || (big ? rand(7, 9) : rand(5, 7)), snap: true, subj: ev.subj && ev.subj.alive ? ev.subj : null, spin: rand(-0.06, 0.06) };
  setCap(ev.sub || ev.kind.toUpperCase(), ev.label || 'Live from the front');
  DIR.lastP.copy(ev.p); DIR.lastEv = ev;
}
function duelShot() { /* a soldier trading fire with a target: over the shoulder, both in frame */
  const L = []; for (const e of ENTS) if (e.kind === 'soldier' && e.alive && !e.downed && !e.isPlayer && e.target && e.target.alive && !e.imp && e.pos.y < 300 && e.target.pos.distanceTo(e.pos) < 70 && e.target.pos.distanceTo(e.pos) > 6) L.push(e);
  if (!L.length) return false; L.sort((a, b) => (b.hurtT || 0) - (a.hurtT || 0) + Math.random() - 0.5);
  const s = L[0], t = s.target; DIR.shot = { type: 'duel', s, tgt: t, t: 0, dur: rand(5.5, 8), snap: true, side: Math.random() < 0.5 ? 1 : -1, endT: 0 };
  setCap(`${TEAM[s.team].short} vs ${TEAM[t.team] ? TEAM[t.team].short : 'wild'}`, `${nameOf(s)} trading fire with ${nameOf(t)}`); return true;
}
function airShot() { /* chase a fighter that is hunting another */
  const F = ENTS.filter(e => e.alive && !e.isPlayer && (e.kind === 'fighter' || e.kind === 'gunship') && e.target && e.target.alive && (DIR.mode === 4 ? e.orbital : !e.orbital || DIR.mode === 3)); if (!F.length) return false;
  const s = pick(F); DIR.shot = { type: 'hunt', s, tgt: s.target, t: 0, dur: rand(6, 9), snap: true }; setCap('Dogfight', `${nameOf(s)} on the tail of ${nameOf(s.target)}`); return true;
}
function setCap(sub, name) { const a = $('#cineSub'), b = $('#cineName'); if (a) a.textContent = sub; if (b) b.textContent = name; }
function hottest(minW, raw) {
  let best = null, bs = 0;
  for (const h of DIR.heat) { const age = TIME - h.t; if (age > 5 || h === DIR.lastEv) continue; let w = 0; for (const o of DIR.heat) if (TIME - o.t < 5 && Math.abs(o.p.x - h.p.x) < 40 && Math.abs(o.p.z - h.p.z) < 40) w += o.w; /* clustered action counts */
    const sc = (h.w + w * 0.35) * (1 - age / 6) * (h.p.distanceTo(DIR.lastP) < 50 ? 0.5 : 1); if (sc > bs && (raw ? h.w : h.w + w * 0.35) >= minW) { bs = sc; best = h; } }
  return best;
}
/* called by cinePick (main.js): the director gets first say on every cut */
function directorPick() {
  if (!spectating()) return false; DIR.shot = null; DIR.cutT = 0;
  const ev = DIR.mode === 0 || DIR.mode === 1 ? (DIR.mode === 1 ? hottest(2) : DIR.streak >= 2 ? hottest(10, true) : hottest(4)) : null; if (ev) { DIR.streak = (DIR.streak || 0) + 1; eventShot(ev); return true; }
  DIR.streak = 0; /* after a couple of event cuts the director mixes in duels, dogfights and the classic shots */
  const r = Math.random();
  if (DIR.mode === 2 || (DIR.mode === 0 && r < 0.35)) { if (duelShot()) return true; }
  if (DIR.mode === 3 || DIR.mode === 4 || (DIR.mode === 0 && r < 0.5)) { if (airShot()) return true; }
  return false; /* the classic shot list (vehicles, vistas, capital ships) */
}
/* called at the top of cineUpdate (main.js); returns true when the director is driving the camera */
function spectateShot(dt) {
  if (!spectating()) { DIR.shot = null; return false; }
  DIR.cutT += dt;
  if (!DIR.shot) { /* a big moment interrupts whatever the classic camera is showing */
    if (DIR.cutT > 2.5 && DIR.mode <= 1) { const ev = hottest(9, true); if (ev && ev !== DIR.lastEv && (DIR.mode === 1 || (DIR.streak || 0) < 2)) { eventShot(ev); CINE.subj = null; CINE.shot = 'orbit'; } }
    if (!DIR.shot) return false;
  }
  const S = DIR.shot; S.t += dt; const want = _v3, look = _v4; let fov = 60, k = 1 - Math.exp(-dt * 2.5);
  if (S.type === 'event') {
    if (S.subj && S.subj.alive && S.t < 2.5) { S.subj.aim(_v5); S.p.lerp(_v5, 1 - Math.exp(-dt * 3)); } /* track the subject in, then hold on the scene */
    S.a += S.spin * dt; want.set(S.p.x + Math.cos(S.a) * S.D, S.p.y + S.h, S.p.z + Math.sin(S.a) * S.D); look.copy(S.p); fov = S.D > 80 ? 52 : 64;
    if (S.t > S.dur) { DIR.shot = null; cinePick(); return spectateShot(dt); }
  } else if (S.type === 'duel') {
    const s = S.s, t = S.tgt; if (!s.alive || !t.alive) S.endT += dt; if (S.endT > 1.6 || S.t > S.dur) { DIR.shot = null; cinePick(); return spectateShot(dt); }
    const dx = t.pos.x - s.pos.x, dz = t.pos.z - s.pos.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
    want.set(s.pos.x - ux * 4.2 - uz * 1.6 * S.side, s.pos.y + 2.3, s.pos.z - uz * 4.2 + ux * 1.6 * S.side); look.set(lerp(s.pos.x, t.pos.x, 0.55), lerp(s.pos.y, t.pos.y, 0.55) + 1.2, lerp(s.pos.z, t.pos.z, 0.55)); fov = 58; k = 1 - Math.exp(-dt * 6);
  } else if (S.type === 'hunt') {
    const s = S.s; if (!s.alive && S.t > 2) { DIR.shot = null; cinePick(); return spectateShot(dt); } if (S.t > S.dur) { DIR.shot = null; cinePick(); return spectateShot(dt); }
    const f = s.dir || _v5.set(0, 0, 1); s.aim(_v6); want.copy(_v6).addScaledVector(f, -26).add(_v5.set(0, 7, 0)); look.copy(S.tgt && S.tgt.alive ? S.tgt.pos : _v6.clone().addScaledVector(f, 60)); fov = 66; k = 1 - Math.exp(-dt * 5);
  }
  want.y = Math.max(want.y, groundY(want.x, want.z) + 1.5, surfY(want.x, want.z, want.y) + 1.5);
  if (S.snap) { CINE.pos.copy(want); CINE.look.copy(look); S.snap = false; }
  CINE.pos.lerp(want, k); CINE.look.lerp(look, 1 - Math.exp(-dt * 5));
  camera.position.copy(CINE.pos);
  if (DIR.shake > 0.01) { const a = DIR.shake * 0.9; camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a; camera.position.z += (Math.random() - 0.5) * a; }
  camera.up.set(0, 1, 0); camera.lookAt(CINE.look); camera.fov = lerp(camera.fov, fov, dt * 2); camera.updateProjectionMatrix();
  return true;
}
/* slow motion for the biggest impacts */
function slowMo(t) { if (TIME - (DIR.slowLast || -99) < 25) return; DIR.slowLast = TIME; DIR.slow = Math.max(DIR.slow, t); } /* at most one slow-motion beat every 25 s */
function directorScale(rdt) { if (!spectating() || DIR.slow <= 0) return 1; DIR.slow -= rdt; return 0.28 + 0.72 * smooth(0, 0.6, Math.max(0, 0.6 - DIR.slow)); }
function updateDirector(dt) {
  DIR.shake = Math.max(0, DIR.shake - dt * 2);
  if (GAME.state === 'spectate' && !DIR.el) dirTick('Live', 'The battle director is on the feed');
  if (DIR.el) DIR.el.style.display = GAME.state === 'spectate' ? '' : 'none';
  if (!spectating()) return;
  if (GAME.state === 'spectate' && PLAYER.ent && PLAYER.ent.alive) PLAYER.ent.spawnGuard = TIME + 1; /* the Commander is off the feed: safe while you watch */
  if (DIR.slowAt) { const D = DIR.slowAt; if (!D.e.alive && (!D.e.obj.visible || D.e.remove)) { if (camera.position.distanceTo(D.e.pos) < 600) slowMo(1.5); DIR.slowAt = null; } else if (TIME - (D.t0 || (D.t0 = TIME)) > 12) DIR.slowAt = null; }
  const ev = NATURE.ev; /* a disaster starting is always worth a cut */
  if (ev && ev !== DIR.natEv) { DIR.natEv = ev; const p = ev.p ? ev.p.clone().setY(groundY(ev.p.x, ev.p.z) + 20) : camera.position.clone().add(camDir(_v1).multiplyScalar(150)); heat(p, 16, 'nature', DISASTERS[ev.key].msg, DISASTERS[ev.key].name); }
  for (const c of CPS) { if (c.dirOwner === undefined) c.dirOwner = c.owner; if (c.owner !== c.dirOwner) { c.dirOwner = c.owner; heat(new V3(c.x, groundY(c.x, c.z) + 4, c.z), c.owner ? 8 : 5, 'cap', c.owner ? `${TEAM[c.owner].name} take ${c.name}` : `${c.name} is neutral again`, 'Objective'); } }
  if ((DIR.setT -= dt) <= 0) { /* stage a set-piece in front of the lens */
    DIR.setT = rand(9, 15); DIR.focus.pos.copy(CINE.look); DIR.focus.pos.y = groundY(DIR.focus.pos.x, DIR.focus.pos.z);
    if (CINE.look.y < 400) { const r = Math.random(); if (!(r < 0.45 ? setAirCrash(DIR.focus) || setBarrage(DIR.focus) : r < 0.75 ? setBarrage(DIR.focus) : setWreck(DIR.focus) || setBarrage(DIR.focus))) DIR.setT = 4; }
  }
}
addEventListener('keydown', e => {
  if (!spectating()) return; const m = { Digit0: 0, Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 }[e.code]; if (m === undefined) return;
  DIR.mode = m; DIR.shot = null; CINE.subj = null; cinePick(); dirTick('Director', ["Director's choice", 'Following the action', 'Duels', 'Air war', 'Space war'][m]);
});
