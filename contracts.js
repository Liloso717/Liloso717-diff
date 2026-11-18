'use strict';
/* ===================== IRON MERIDIAN · field contracts: always three short goals worth chasing ===================== */
// Three contracts are always open. Each is a bite-size goal that pushes you somewhere new: a district, a power you
// are not using, the people you are meant to be saving. Finish one: an XP payout, a banner, and a fresh contract rolls
// in. Progress survives a reload. Every contract here has to be something a Hero can actually do — no rides, no
// starships, and no armies that are not in this war.
const CONTRACT_POOL = [
  { id: 'kills', txt: n => `Put down ${n} Villains`, n: [10, 18], xp: 300 },
  { id: 'blade', txt: n => `${n} energy strike kills`, n: [3, 6], xp: 420 },
  { id: 'throw', txt: n => `Kill ${n} Villains with a thrown car`, n: [2, 4], xp: 450 },
  { id: 'vehicle', txt: n => `Wreck ${n} Villain vehicles`, n: [2, 4], xp: 500 },
  { id: 'evac', txt: n => `Carry ${n} people out through a gate`, n: [200, 400], xp: 520 },
  { id: 'revive', txt: n => `Pick ${n} downed civilians back up`, n: [3, 6], xp: 420 },
  { id: 'cap', txt: (n, c) => `Capture ${c.name}`, n: [1, 1], xp: 550, cp: true },
  { id: 'hold', txt: (n, c) => `Hold ${c.name} for ${n} s`, n: [45, 75], xp: 450, cp: true },
  { id: 'streak', txt: n => `Reach a ${n} kill streak`, n: [4, 6], xp: 500 },
];
const CONTRACTS = { list: [], el: null, dirty: true, holdT: 0 };
function newContract(skip) {
  const used = new Set(CONTRACTS.list.map(c => c.id).concat(skip || []));
  const D = pick(CONTRACT_POOL.filter(d => !used.has(d.id))), goal = Math.round(rand(D.n[0], D.n[1] + 0.99) - 0.49);
  const cp = D.cp ? pick(CPS).id : null; return { id: D.id, goal: Math.max(1, goal), n: 0, cp };
}
function saveContracts() { try { localStorage.setItem('im-contracts', JSON.stringify(CONTRACTS.list)); } catch (err) { /* storage blocked */ } }
(function loadContracts() {
  try { const L = JSON.parse(localStorage.getItem('im-contracts') || '[]'); if (Array.isArray(L)) CONTRACTS.list = L.filter(c => CONTRACT_POOL.some(d => d.id === c.id)).slice(0, 3); } catch (err) { /* fresh */ }
  while (CONTRACTS.list.length < 3) CONTRACTS.list.push(newContract());
})();
function contractText(c) { const D = CONTRACT_POOL.find(d => d.id === c.id), cp = c.cp ? CPS.find(x => x.id === c.cp) : null; return D.txt(c.goal, cp); }
function contractProgress(id, by = 1, cpId) {
  if (GAME.state !== 'play') return;
  for (let i = 0; i < CONTRACTS.list.length; i++) {
    const c = CONTRACTS.list[i]; if (c.id !== id || (c.cp && cpId && c.cp !== cpId) || (c.cp && !cpId)) continue;
    c.n = id === 'streak' ? Math.max(c.n, by) : c.n + by; CONTRACTS.dirty = true;
    if (c.n >= c.goal) {
      const D = CONTRACT_POOL.find(d => d.id === c.id); addXP(D.xp); awardPoints(D.xp, 'Contract complete');
      banner('Contract complete', `${contractText(c)} · +${D.xp} XP`, 'var(--amber)'); snd('kill', null, 0.6);
      CONTRACTS.list[i] = newContract([c.id]); comms('COMMAND', `New contract: ${contractText(CONTRACTS.list[i])}.`, 'cmd');
    }
  }
  saveContracts();
}
// hooks: every death the Commander caused, with how and from what
{
  const _killed = Ent.prototype.killed;
  Ent.prototype.killed = function (src, type) {
    const byMe = src && (src.isPlayer || (PLAYER.hero && src === PLAYER.ent)) && src !== this && this.team !== 1;
    if (byMe) {
      if (this.kind === 'soldier') { contractProgress('kills'); if (type === 'blade') contractProgress('blade'); }
      else if (this.kind !== 'capital') { contractProgress('vehicle'); contractProgress('kills'); }
      if (typeof STK !== 'undefined') contractProgress('streak', STK.n + 1);
    }
    return _killed.call(this, src, type);
  };
}
const CT_OWN = {};
function updateContracts(dt) {
  const pe = PLAYER.ent, playing = GAME.state === 'play' && pe && pe.alive;
  if (playing) {
    for (const c of CPS) { const was = CT_OWN[c.id]; CT_OWN[c.id] = c.owner; if (was !== undefined && was !== 1 && c.owner === 1 && pe.pos.distanceTo(c.pos) < 60) contractProgress('cap', 1, c.id); }
    const h = CONTRACTS.list.find(c => c.id === 'hold'); if (h) { const c = CPS.find(x => x.id === h.cp); if (c && c.owner === 1 && pe.pos.distanceTo(c.pos) < 45 && (CONTRACTS.holdT += dt) >= 1) { CONTRACTS.holdT = 0; contractProgress('hold', 1, c.id); } }
  }
  if (!CONTRACTS.el) CONTRACTS.el = $('#contracts'); const el = CONTRACTS.el; if (!el) return;
  el.classList.toggle('hidden', GAME.state !== 'play');
  if (!CONTRACTS.dirty) return; CONTRACTS.dirty = false;
  el.innerHTML = '<div class="ch">Contracts</div>' + CONTRACTS.list.map(c => `<div class="ct"><span>${contractText(c)}</span><b>${Math.min(c.n, c.goal)}/${c.goal}</b><i style="width:${Math.round(Math.min(1, c.n / c.goal) * 100)}%"></i></div>`).join('');
}
