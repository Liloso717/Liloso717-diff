'use strict';
/* ===================== IRON MERIDIAN · hopping off ===================== */
// Nothing on the ground and nothing in the air is rideable any more: you have powers, so you do not need a seat. The
// one machine you take command of is a warship — the helm console on the Marina pier (realmrules.js) hands you a
// destroyer, and hopping off puts you back on the pier. This is what both sides of that swap have in common.
const rideName = v => v.kind === 'monster' ? 'Titan' : v.kind === 'fighter' ? 'starfighter' : v.kind === 'shiftframe' ? 'Shiftframe' : v.kind === 'starship' ? `starship ${v.name}` : v.kind;
