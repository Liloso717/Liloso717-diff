'use strict';
/* ===================== IRON MERIDIAN · no orbital platforms =====================
   The orbital platform rings and the rideable Kestrel starships are gone. These empty stand-ins keep the
   systems that used to look them up (realms, skyfall) running with nothing in orbit. */
const SHIPS = [], ORBITAL_RINGS = [], SHIP_SLOTS = [];
function setupStarships() {}
function updateStarships() {}

/* defined here as well as in orbit.js: the game loop in main.js starts before orbit.js (near the end of the page) has loaded, and on a slow connection every frame until then threw "updateFlagship is not defined" */
function updateFlagship() {}
