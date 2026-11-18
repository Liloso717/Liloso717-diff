'use strict';
/* ===================== IRON MERIDIAN · battle fronts, aggro limits and the Commander's dominance ===================== */
// One battle at a time: the active theatre's post is the front; every army feeds it in waves that arrive the way that
// realm allows (on land, at the causeway head for the ocean, in Apex Plaza under the Skyport; orbit by boarding pod).
// Only a few enemies may hunt the Commander at a time, and a Commander on a streak can break enemy nerve.
const AGGRO = { n: 0, max: 3 };
const FRONT = { t: 6, waveT: 35, hudT: 0, domT: 0, list: [] };
function chooseFronts() { /* one big battle at a time: the active theatre's post is the only front */
  for (const c of CPS) c.front = false; const T0 = THEATRE.cur;
  FRONT.list = T0 && T0.cp ? [{ cp: T0.cp, attacker: 0, kind: T0.key.toUpperCase(), wave: 1 }] : []; if (T0 && T0.cp) T0.cp.front = true;
}
function frontLanding(cp, t) { /* where a wave can actually arrive for each realm */
  if (cp.realm === 'sea') return new V3(RLM.head.x + rand(-20, 0), 0, RLM.head.z + rand(-30, 30));
  if (cp.realm === 'air') { const a = rand(0, 6.28); return new V3(Math.cos(a) * 70, 0, Math.sin(a) * 70); } /* the plaza under the sky base, by the ziplines */
  if (cp.realm === 'space') return null; /* boarding pods handle orbit (realms.js) */
  return new V3(cp.x + rand(-30, 30), 0, cp.z + (t === 1 ? 90 : -90));
}
function frontWaves() { // reinforcements for every army land near the battle
  for (const f of FRONT.list) {
    for (const t of [1, rivalFor(f.cp)]) {
      if (t > 3) { armyWave(t, f.cp); continue; } // the Ashen Pact and the Verdant Host march straight in (capped, on dry land)
      const to = frontLanding(f.cp, t), n = Math.min(ARRIVAL.pool[t], 8); if (!to || n < 3) continue; ARRIVAL.pool[t] -= n; ARRIVAL.wait[t] = 0;
      launchArrival(t, f.cp.realm === 'land' ? pick(['bus', 'air', 'air', 'orbit']) : f.cp.realm === 'sea' ? 'bus' : pick(['bus', 'air']), n, to);
    }
    f.wave++;
  }
}
function dominate(v) { // a Commander on a tear breaks nearby enemy nerve
  const pe = PLAYER.ent; if (!pe || STK.n < 2) return; let n = 0;
  for (const e of ENTS) if (e.alive && isHostile(e.team) && e.kind === 'soldier' && !e.deck && !e.downed && e.pos.distanceTo(pe.pos) < 50 && Math.random() < 0.25 + STK.n * 0.07) { e.fleeT = rand(5, 9); n++; }
  if (n >= 2 && FRONT.domT < TIME) { FRONT.domT = TIME + 20; comms('Alpha Lead', pick(["They're breaking! Push them!", 'Enemy is falling back, Commander!', 'Look at them run!']), 'b'); }
}
function updateFronts(dt) {
  const pe = PLAYER.ent; let n = 0;
  if (pe && pe.alive) for (const e of ENTS) if (e.target === pe && e.alive && e.team !== 1) n++;
  AGGRO.n = n; AGGRO.max = pe && pe.hp < pe.maxHp * 0.4 ? 2 : 3;
  if (GAME.clock < 3) return;
  if ((FRONT.t -= dt) <= 0) { FRONT.t = 85; chooseFronts(); }
  if ((FRONT.waveT -= dt) <= 0) { FRONT.waveT = 40; frontWaves(); }
  if ((FRONT.hudT -= dt) > 0) return; FRONT.hudT = 0.5;
  const el = $('#fronts'); if (!el) return; /* the fronts list is off the HUD now; the waves above still run */
  el.classList.toggle('hidden', GAME.state !== 'play');
  const html = '<div class="fh">Battle fronts</div>' + FRONT.list.map(f => {
    const c = f.cp, d = pe ? Math.round(pe.pos.distanceTo(c.pos)) : 0;
    return `<div class="fr ${c.owner === 1 ? 'b' : c.owner === 2 ? 'r' : 'n'}"${c.owner > 3 ? ` style="border-color:${TEAM_CSS[c.owner]}"` : ''}><b>${c.tag}</b><span>${c.name}<i>${f.kind} · wave ${f.wave}</i></span><em>${c.nb || 0}<small>v</small>${c.nr || 0}</em><u>${d} m</u></div>`;
  }).join(''); if (el._h !== html) { el._h = html; el.innerHTML = html; }
}
