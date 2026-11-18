'use strict';
/* ===================== IRON MERIDIAN · no Skyport post =====================
   The Skyport capture post is gone: off the map, out of the capture count, the HUD navigation, the minimap and the
   orders list. If the battle was focused on it, the fight moves to another post. */
{
  const i = CPS.findIndex(c => c.id === 'skyport');
  if (i >= 0) {
    const cp = CPS[i]; scene.remove(cp.g); cp.g.visible = false;
    CPS.splice(i, 1); CP_TALLY.splice(i, 1);
    const k = ORDERS.list.findIndex(o => o.reach === 'skyport'); if (k >= 0) { ORDERS.list.splice(k, 1); ORDERS.i = ORDERS.i % ORDERS.list.length; }
    const t = THEATRES.findIndex(x => x.key === 'air'); if (t >= 0) THEATRES.splice(t, 1);
    if (THEATRE.cur && THEATRE.cur.cp === cp) { THEATRE.cur = null; }
    const si = STATIONS.findIndex(x => x.cp === cp); if (si >= 0) { const g = STATIONS[si].ring.parent; if (g) scene.remove(g); STATIONS.splice(si, 1); } /* its repair station too */
    for (const e of ENTS) if (e.goalCP === cp) { e.goalCP = null; e.goalT = 0; }
  }
}
