'use strict';
/* ===================== IRON MERIDIAN · a clear sky =====================
   The giant warships in orbit are gone: no dreadnoughts, no cruisers trading beams overhead, no boardable Leviathan.
   The orbital platform rings and their starships stay. */
function updateFlagship() {}
for (const t of [1, 2]) if (DREADS[t]) { DREADS[t].visible = false; DREADS[t].traverse(o => { o.visible = false; }); }
dreadDuelT = 1e9;
for (const s of ORBIT.ships) if (s.g && s.g.parent) s.g.parent.remove(s.g);
ORBIT.ships.length = 0;
spawnCruiser = function () {};
{ const _st = spaceTargets; spaceTargets = function () { return _st().filter(t => t.dread === undefined); }; }
