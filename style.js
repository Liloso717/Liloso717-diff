'use strict';
/* ===================== IRON MERIDIAN · grey sky, wet streets =====================
   The look of a real city after rain, as in the reference footage:
   · an overcast sky: the sun softened and cooled, more light from the grey sky dome, cooler grey fog and horizon;
     the day/night cycle still runs underneath it (dusk and night keep their colours)
   · wet streets: roads glossy with standing puddles that mirror the sky, pavements and concrete damp and darker
   · rain comes more often (the weather cycle leans to rain over snow)
   · a cooler, less saturated, slightly harder colour grade (set in post.js)
   STYLE.over (0 to 1) is how overcast it is; STYLE.wet (0 to 1) how wet the ground is. Both cost almost nothing:
   one roughness texture shared by every road, and a few colour changes per frame. */
const STYLE = { over: 1, wet: 1, c: new T.Color(), mats: [] };
/* 1 · the overcast sky, on top of the day cycle */
{
  const _usm = updateSkyMood;
  updateSkyMood = function (dt) {
    _usm(dt);
    const night = skyU.night.value, o = STYLE.over * (1 - night * 0.7), c = STYLE.c;
    sun.intensity *= 1 - 0.6 * o; sun.color.lerp(c.setRGB(0.86, 0.9, 0.95), 0.7 * o);           /* a soft, cool sun behind cloud */
    hemi.intensity *= 1 + 0.25 * o; hemi.color.lerp(c.setRGB(0.6, 0.64, 0.7), 0.6 * o);           /* the grey dome does the lighting */
    FOG.lerp(c.setRGB(0.36, 0.39, 0.42), 0.7 * o); scene.fog.color.copy(FOG); if (scene.background && scene.background.isColor) scene.background.copy(FOG);
    skyU.horizon.value.lerp(c.setRGB(0.44, 0.47, 0.5), 0.7 * o);
    skyU.zenith.value.lerp(c.setRGB(0.24, 0.27, 0.31), 0.75 * o);
    POST.exposure((1 + night * 0.45) * (1 - 0.14 * o));                                              /* no glare under cloud */
    skyU.sunCol.value.lerp(c.setRGB(0.55, 0.55, 0.52), 0.6 * o);                                     /* a pale disc, no blaze */
  };
}
/* 2 · wet streets: one roughness map with puddles for every road, damp concrete */
const PUDDLE_TEX = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = 'rgb(205,205,205)'; g.fillRect(0, 0, w, h);                                           /* wet asphalt: fairly glossy everywhere */
  for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = Math.random() * h, r = 8 + Math.random() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgb(10,10,10)'); gr.addColorStop(0.65, 'rgb(40,40,40)'); gr.addColorStop(1, 'rgba(205,205,205,0)');   /* standing water: a mirror */
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * (0.6 + Math.random()), r, Math.random() * 3, 0, 6.283); g.fill(); }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } /* grit */
});
PUDDLE_TEX.colorSpace = T.NoColorSpace; PUDDLE_TEX.repeat.set(1, 1);
function styleWet() {
  const seen = new Set();
  scene.traverse(o => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) {
      if (!m || seen.has(m) || !m.isMeshStandardMaterial) continue; seen.add(m);
      if (m.map === roadTex) { /* the roads */
        m.roughnessMap = PUDDLE_TEX; m.roughness = lerp(0.85, 0.5, STYLE.wet); m.metalness = 0.0; m.envMapIntensity = 1.6; m.color.multiplyScalar(lerp(1, 0.62, STYLE.wet)); m.needsUpdate = true; STYLE.mats.push(m);
      } else if (m === MAT_CONC) { m.roughness = lerp(0.9, 0.5, STYLE.wet); m.color.multiplyScalar(lerp(1, 0.78, STYLE.wet)); m.needsUpdate = true; }
      else if (m.vertexColors && m.map && m.map.repeat.x > 200) { m.color.multiplyScalar(lerp(1, 0.8, STYLE.wet)); m.roughness = lerp(0.96, 0.8, STYLE.wet); m.needsUpdate = true; } /* the ground: damp and darker */
    }
  });
}
styleWet();
/* 3 · rain more often than snow */
{
  const _ws = weatherSet;
  weatherSet = function (s) { if (s === 'snow' && Math.random() < 0.65) s = 'rain'; return _ws(s); };
}
