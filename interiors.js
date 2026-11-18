'use strict';
/* ===================== IRON MERIDIAN · every building can be entered =====================
   Houses, shops, blocks, towers, hangars, the terminal, the mall: their ground floor is a room. Each has a doorway in
   the middle of every side; inside is open floor to walk, fight and take shelter in, and the storeys above (and the
   roof slab) stay solid, so a tower still stops a shell above the lobby. Walls stop bullets and blasts as before.
   Outside, every doorway shows as a dark opening (one instanced mesh for the whole island). Inside, a room shell
   appears round you: walls, floor, ceiling lights, the doorways lit by the day outside. Small structures (cranes,
   pylons, turbines, watchtowers) and the invisible collision walls of platforms and landmarks stay solid. */
const ROOM = { wall: 0.9, door: 1.7, doorH: 3.2 };
function bEnter(b) { /* enterable? decided once per building */
  if (b._ent !== undefined) return b._ent;
  const ok = !b.cover && b.maxHp < 1e6 && b.w >= 7 && b.d >= 7 && b.h >= 4.5 && b.mesh && b.mesh.visible !== false;
  b._ent = ok; if (ok) { b.fl = Math.max(b.gy + 1, H(b.x, b.z)); b.ch = b.fl + Math.min(5.2, Math.max(3.6, b.top - b.fl - 0.8)); } return ok;
}
const inRoom = (b, x, z, m) => x > b.x0 + ROOM.wall + m && x < b.x1 - ROOM.wall - m && z > b.z0 + ROOM.wall + m && z < b.z1 - ROOM.wall - m;
function inDoor(b, x, z, y) { /* standing in one of the four doorways */
  if (y > b.fl + ROOM.doorH) return false; const T = ROOM.wall + 0.6;
  if (Math.abs(x - b.x) < ROOM.door && (z < b.z0 + T || z > b.z1 - T)) return true;
  if (Math.abs(z - b.z) < ROOM.door && (x < b.x0 + T || x > b.x1 - T)) return true;
  return false;
}
/* the building a point is solid inside, if any: walls, the storeys over the ground floor, the roof slab */
buildingAt = function (p) {
  for (const b of bldCell(p.x, p.z)) {
    if (!b.alive || !(p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y < b.top && p.y > b.gy)) continue;
    if (!bEnter(b) || p.y < b.fl - 1.8 || p.y >= b.ch) return b; /* a dip in the ground at the door is not a wall */
    if (inRoom(b, p.x, p.z, 0) || inDoor(b, p.x, p.z, p.y)) continue;
    return b;
  }
  return null;
};
/* walkers: out of the walls, into the room or out to the street, whichever side they are on; through the doorways */
pushOut = function (p, r) {
  for (const b of bldCell(p.x, p.z)) {
    if (!b.alive || p.y > b.top - 0.4 || p.y < b.gy - 0.5) continue;
    if (!(p.x > b.x0 - r && p.x < b.x1 + r && p.z > b.z0 - r && p.z < b.z1 + r)) continue;
    if (bEnter(b) && p.y >= b.fl - 2 && p.y < b.ch - 1.6) {
      if (inRoom(b, p.x, p.z, r) || inDoor(b, p.x, p.z, p.y)) continue;
      const W = ROOM.wall, inside = p.x > b.x0 + W * 0.5 && p.x < b.x1 - W * 0.5 && p.z > b.z0 + W * 0.5 && p.z < b.z1 - W * 0.5;
      if (inside) { p.x = clamp(p.x, b.x0 + W + r, b.x1 - W - r); p.z = clamp(p.z, b.z0 + W + r, b.z1 - W - r); continue; } /* stay in the room */
    }
    const a = p.x - (b.x0 - r), bb = (b.x1 + r) - p.x, c = p.z - (b.z0 - r), d = (b.z1 + r) - p.z; const m = Math.min(a, bb, c, d);
    if (m === a) p.x = b.x0 - r; else if (m === bb) p.x = b.x1 + r; else if (m === c) p.z = b.z0 - r; else p.z = b.z1 + r;
  }
};

/* ---------- the look of it: doorways outside, a room round you inside ---------- */
const ROOMV = { doors: null, n: -1, t: 0, shell: null, cur: null };
{
  const dg = new T.PlaneGeometry(ROOM.door * 2 - 0.4, ROOM.doorH).translate(0, ROOM.doorH / 2, 0);
  ROOMV.doors = new T.InstancedMesh(dg, new T.MeshBasicMaterial({ color: 0x0a0b0d, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 3200);
  ROOMV.doors.count = 0; ROOMV.doors.frustumCulled = false; scene.add(ROOMV.doors);
  /* the room: walls and ceiling seen from inside, a floor, strip lights, the doorways glowing with daylight */
  const g = new T.Group(); g.visible = false; scene.add(g);
  const wallM = new T.MeshStandardMaterial({ color: 0x6a645c, roughness: 0.95, metalness: 0, side: T.BackSide, emissive: 0x15130f, emissiveIntensity: 0.5 });
  const box = new T.Mesh(new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), wallM); box.receiveShadow = true; g.add(box);
  const floor = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.85, metalness: 0.05 })); floor.position.y = 0.04; g.add(floor);
  const lightM = basic(new T.Color(1.15, 1.1, 0.95)), lights = []; for (let i = 0; i < 4; i++) { const l = new T.Mesh(new T.PlaneGeometry(1, 0.4).rotateX(Math.PI / 2), lightM); g.add(l); lights.push(l); }
  const dayM = basic(new T.Color(0.85, 0.85, 0.8), { side: T.DoubleSide }), /* kept under the bloom threshold: a doorway, not a floodlight */ days = []; for (let i = 0; i < 4; i++) { const d = new T.Mesh(dg, dayM); g.add(d); days.push(d); }
  const crateM = std(0x5a4a30, 0.85, 0.1), crates = []; for (let i = 0; i < 3; i++) { const c = new T.Mesh(new T.BoxGeometry(1.4, 1, 1.4).translate(0, 0.5, 0), crateM); g.add(c); crates.push(c); }
  ROOMV.shell = { g, box, floor, lights, days, crates };
}
function fitRoom(b) {
  const S = ROOMV.shell, W = ROOM.wall, iw = b.w - W * 2, id = b.d - W * 2, ih = b.ch - b.fl;
  S.g.position.set(b.x, b.fl, b.z); S.box.scale.set(iw, ih, id); S.floor.scale.set(iw, 1, id);
  S.lights.forEach((l, i) => { l.position.set((i % 2 ? 0.25 : -0.25) * iw, ih - 0.05, (i < 2 ? 0.25 : -0.25) * id); l.scale.set(Math.min(4, iw * 0.3), 1, 1); });
  S.days.forEach((d, i) => { const o = [[0, id / 2 - 0.02, 0], [0, -id / 2 + 0.02, Math.PI], [iw / 2 - 0.02, 0, Math.PI / 2], [-iw / 2 + 0.02, 0, -Math.PI / 2]][i]; d.position.set(o[0], 0, o[1]); d.rotation.y = o[2]; });
  S.crates.forEach((c, i) => { const sx = i === 1 ? -1 : 1; c.position.set(sx * (iw / 2 - 1.2), 0, (i - 1) * Math.min(3, id * 0.25)); });
}
function updateRooms(dt) {
  /* doorways: rebuilt when buildings come and go, hidden on the fallen */
  if ((ROOMV.t -= dt) <= 0) { ROOMV.t = 1.5;
    const D = ROOMV.doors; let k = 0;
    for (const b of BUILDINGS) { if (!b.alive || !bEnter(b) || k > 3196) continue; const y = b.fl;
      for (const [x, z, ry] of [[b.x, b.z1 + 0.06, 0], [b.x, b.z0 - 0.06, Math.PI], [b.x1 + 0.06, b.z, Math.PI / 2], [b.x0 - 0.06, b.z, -Math.PI / 2]]) { _m.compose(_v1.set(x, y, z), _q.setFromAxisAngle(UP, ry), _s.set(1, 1, 1)); D.setMatrixAt(k++, _m); } }
    D.count = k; D.instanceMatrix.needsUpdate = true; }
  /* the room round the camera: checked as the frame is drawn, against the camera as it finally stands */
  if (!ROOMV.hooked && typeof POST !== 'undefined') { ROOMV.hooked = true; const _r = POST.render; POST.render = function (...a) { roomCam(); return _r.apply(this, a); }; }
}
function roomCam() {
  const c = camera.position; let in_ = null;
  for (const b of bldCell(c.x, c.z)) if (b.alive && bEnter(b) && inRoom(b, c.x, c.z, -0.4) && c.y > b.fl - 0.5 && c.y < b.ch) { in_ = b; break; }
  if (in_ !== ROOMV.cur) { ROOMV.cur = in_; ROOMV.shell.g.visible = !!in_; if (in_) fitRoom(in_); }
}
{ const _uw = updateWorld; updateWorld = function (dt) { _uw(dt); updateRooms(dt); }; }
