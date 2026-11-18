'use strict';
/* ===================== IRON MERIDIAN · the war: survive, hold the posts, outlast the other three armies ===================== */
// Exactly 60 soldiers per army on the field, 240 in all: Meridian's 60 are your own company. Each army also has a finite
// reserve behind them. Every replacement comes out of that reserve, so keeping soldiers alive is everything.
//  · every army gets +1 reserve every 10 s; each post it holds sends +1 every 20 s; winning a theatre sends +15
//  · an army with nobody left on the field and an empty reserve is eliminated, and its posts fall neutral
//  · the war ends when one army is left standing, or when the war clock runs out: most posts held wins, then most soldiers
// Then a fresh war begins on the same battlefield.
const FIELD = LOW_END ? 30 : 40, RES0 = FIELD * 3, WAR_LEN = 1080; /* line soldiers a side plus the champions and their retinues: a bigger war, held to a lighter count on phones */
const RESERVE = { 1: 0, 2: 0 }, ELIM = {}, WARS = { n: 1, t: WAR_LEN, over: 0, tick: 0, trickle: 20, base: 10, hudT: 0, el: null };
FORCE.soldier = FIELD; FORCE.team1Soldiers = 0; ARMY_POP.start = FIELD - 12; ARMY_POP.lo = FIELD - 12; ARMY_POP.hi = FIELD - 10; /* the line; the champions bring the rest */
for (const ft of CMD.teams) ft.size = Math.round(FIELD / 3); // your company: three squads, whole people only
function warTake(t, n = 1) { if (RESERVE[t] === undefined) return n; if (ELIM[t] || WARS.over) return 0; const k = Math.min(n, RESERVE[t]); RESERVE[t] -= k; return k; }
function fieldCount(t) { let n = 0; for (const e of ENTS) if (e.kind === 'soldier' && e.team === t && e.alive && !e.isPlayer) n++; return n; }
const strength = t => fieldCount(t) + RESERVE[t];
// every replacement soldier, wave and marine is paid for from the reserve
// hard cap: no army ever has more than 60 soldiers alive, and Meridian's soldiers are only your company
const _addEntW = addEnt;
addEnt = function (e) {
  const champ = typeof CHAMP !== 'undefined' && CHAMP.spawning; /* a champion and their retinue are over and above the line companies */
  if (!champ && e && e.kind === 'soldier' && !e.isPlayer && ARMIES.includes(e.team) && ((e.team === 1 && !e.cmd && !e.marine) || (!e.marine && fieldCount(e.team) >= FIELD))) { e.alive = false; e.remove = true; return e; }
  return _addEntW(e);
};
const _queueW = SPAWNER.queue;
SPAWNER.queue = function (type, team, delay) { if (type === 'soldier' && RESERVE[team] !== undefined && !warTake(team)) return; _queueW.call(this, type, team, delay); };
const _deckW = deckSoldier;
deckSoldier = function (L, team, edge, deck) { if (RESERVE[team] !== undefined && GAME.clock > 3 && !warTake(team)) return { alive: false, remove: true }; return _deckW(L, team, edge, deck); };
GAME.maxTickets = FIELD * 2;
function eliminate(t) {
  ELIM[t] = true; for (const c of CPS) if (c.owner === t) { c.owner = 0; c.holder = 0; c.k = 0; }
  banner(`${TEAM[t].name} eliminated`, t === 1 ? 'Meridian has no one left to send' : 'Their last soldier has fallen', TEAM_CSS[t]); comms('COMMAND', `${TEAM[t].name} are finished. ${t === 1 ? 'We have nothing left.' : 'One less army on this rock.'}`, 'cmd'); snd('big', null, 0.6);
}
function endWar(winner, why) {
  WARS.over = 8;
  banner(winner === 1 ? 'Victory · the Heroes hold Aeris' : `${TEAM[winner].name} win`, why, TEAM_CSS[winner]);
  comms('COMMAND', winner === 1 ? `We won the war, Commander. ${why}.` : `${TEAM[winner].name} have taken it. ${why}. Regroup, a new war starts now.`, 'cmd');
  if (winner === 1) { addXP(1000); awardPoints(1000, 'War won'); } else addXP(250);
}
function newWar() {
  WARS.n++; WARS.t = WAR_LEN; WARS.over = 0; for (const t of ARMIES) { RESERVE[t] = t === 2 ? FIELD : 0; ELIM[t] = false; }
  for (const t of [2]) { let n = FIELD - fieldCount(t); while (n-- > 0 && warTake(t)) { const e = spawnUnit('soldier', t); if (e && e.alive) e.spawnAt(landNear(HQ[t].x, HQ[t].z, 70)); } } RESERVE[2] = 0; /* a fresh Vanta field each war, and no replacements behind it */
  const pe = PLAYER.ent; if (pe) for (const ft of CMD.teams) { ft.m = ft.m.filter(s => s.alive); while (ft.m.length < ft.size) cmdRecruit(ft, cmdSlot(ft, ft.m.length, new V3()).add(new V3(rand(-4, 4), 0, rand(-4, 4)))); }
  banner(`War ${WARS.n} begins`, 'Every army back to full strength · survive, hold, outlast', 'var(--amber)'); comms('COMMAND', 'Fresh armies on every side. Keep our people alive and take the posts.', 'cmd');
  for (const b of BUILDINGS) if (!b.alive && b.rubble) b.restore(); // overnight crews rebuild between wars
  newDay();
}
function updateWar(dt) {
  if (GAME.state === 'menu' || GAME.clock < 6) return;
  if (WARS.over > 0) { if ((WARS.over -= dt) <= 0) newWar(); return; }
  WARS.t -= dt;
  RESERVE[1] = 0; RESERVE[2] = 0; /* no replacements for either army, from any source (theatre wins included) */
  if ((WARS.trickle -= dt) <= 0) { WARS.trickle = 20; for (const c of CPS) if (c.owner !== 2 && RESERVE[c.owner] !== undefined && !ELIM[c.owner]) RESERVE[c.owner]++; }
  if ((WARS.base -= dt) <= 0) { WARS.base = 10; for (const t of ARMIES) if (t !== 2 && !ELIM[t]) RESERVE[t]++; } /* one big battle burns soldiers fast: every army gets a steady trickle from orbit */
  if ((WARS.tick -= dt) > 0) return; WARS.tick = 1;
  const alive = ARMIES.filter(t => !ELIM[t]);
  for (const t of alive) if (strength(t) <= 0 && !SPAWNER.q.some(q => q.team === t && q.type === 'soldier')) eliminate(t);
  GAME.tickets[1] = strength(1); GAME.tickets[2] = strength(2);
  const left = ARMIES.filter(t => !ELIM[t]);
  if (left.length === 1) return endWar(left[0], 'Last army standing');
  if (left.length === 0) return endWar(1, 'Nobody is left standing');
  if (WARS.t <= 0) {
    const posts = t => CPS.filter(c => c.owner === t).length; const best = left.slice().sort((a, b) => posts(b) - posts(a) || strength(b) - strength(a))[0];
    return endWar(best, `${posts(best)} of 5 posts held when the war clock ran out`);
  }
}
/* ---------- the war board: soldiers on the field + reserve, posts held, the war clock and the theatre ---------- */
function warHud(dt) {
  if ((WARS.hudT -= dt) > 0) return; WARS.hudT = 0.5;
  if (!WARS.el) WARS.el = $('#war'); const el = WARS.el; if (!el) return; el.classList.toggle('hidden', GAME.state !== 'play');
  const T0 = THEATRE.cur, w = Math.max(0, WARS.t) | 0;
  const army = t => ELIM[t] ? `<span class="wa out" style="--c:${TEAM_CSS[t]}">${TEAM[t].short} out</span>` : `<span class="wa" style="--c:${TEAM_CSS[t]}"><b>${fieldCount(t)}</b><i>+${RESERVE[t]}</i><u>⚑${CPS.filter(c => c.owner === t).length}</u></span>`;
  const html = `${ARMIES.map(army).join('')}<span class="wt">${T0 && T0.cp ? T0.cp.name : T0 ? T0.title.split(' · ')[0] : ''}</span><span class="wn">war ${(w / 60) | 0}:${String(w % 60).padStart(2, '0')}</span>`;
  if (el._h !== html) { el._h = html; el.innerHTML = html; }
}
