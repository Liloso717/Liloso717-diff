'use strict';
/* ===================== IRON MERIDIAN · no Orbital Array =====================
   The Orbital Array is gone: its capture post (off the map, the capture count, navigation and the minimap), the
   station hanging in orbit with its deck, colliders and repair station, and the space battle around it (the space
   theatre, the turbolasers and boarding pods). Anyone standing up there is brought back down to the island. */
{
  const cp = CPS.find(c => c.id === 'orbital');
  if (cp) {
    scene.remove(cp.g); cp.g.visible = false;
    const i = CPS.indexOf(cp); CPS.splice(i, 1); CP_TALLY.splice(i, 1);
    const t = THEATRES.findIndex(x => x.key === 'space'); if (t >= 0) THEATRES.splice(t, 1);
    if (THEATRE.cur && (THEATRE.cur.cp === cp || THEATRE.cur.key === 'space')) THEATRE.cur = null;
    const si = STATIONS.findIndex(x => x.cp === cp); if (si >= 0) { const g = STATIONS[si].ring.parent; if (g) scene.remove(g); STATIONS.splice(si, 1); }
  }
  /* the station itself: everything built up there, its colliders and its deck */
  const P = typeof D_POS !== 'undefined' ? D_POS : null;
  if (P) {
    const ents = new Set(ENTS.map(e => e.obj));
    for (const o of scene.children.slice()) if (!ents.has(o) && o.position.y > 1500 && Math.hypot(o.position.x - P.x, o.position.z - P.z) < 150 && Math.abs(o.position.y - P.y) < 150) scene.remove(o);
    for (let k = BUILDINGS.length - 1; k >= 0; k--) { const b = BUILDINGS[k]; if (b.gy > 1500 && Math.hypot(b.x - P.x, b.z - P.z) < 200) { if (b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh); BUILDINGS.splice(k, 1); } }
    if (typeof RDECK !== 'undefined' && RDECK.D) { const d = DECKS.indexOf(RDECK.D); if (d >= 0) DECKS.splice(d, 1); RDECK.D.y = -9999; RDECK.D.x = RDECK.D.z = 1e5; RDECK.D.r = 1; }
  }
  /* anyone up there comes home */
  const home = e => { const land = CPS.filter(c => c.realm === 'land'), own = land.filter(c => c.owner === e.team), c = (own.length ? own : land)[Math.floor(Math.random() * Math.max(1, (own.length ? own : land).length))] || { x: 0, z: 0 };
    const p = landNear(c.x, c.z, 30); e.pos.set(p.x, surfY(p.x, p.z, p.y + 2), p.z); if (e.obj) e.obj.position.copy(e.pos); e.deck = null; e.goalCP = null; e.goalT = 0; };
  const sweep = () => { for (const e of ENTS) if (e.alive && !e.isPlayer && e.kind === 'soldier' && e.pos.y > 1500) home(e); };
  sweep();
  { const _uw = updateWorld; let t = 0; updateWorld = function (dt) { _uw(dt); if ((t -= dt) <= 0) { t = 2; sweep(); } }; } /* and nobody is sent back up */
}
