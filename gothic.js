'use strict';
/* ===================== IRON MERIDIAN · the painted look: golden days, violet nights =====================
   The look of a hand-painted fantasy world, after the two references:
   · by day (the village clip): a low warm sun that turns everything it touches gold, cool blue-teal shade, clear air
     with a warm haze far off, grass and colour pushed rich; the grey overcast is gone;
   · by night (the under-city picture): a deep violet dark, cold blue moonlight on stone, a teal glow coming up off the
     ground, violet distance, so lamps, lasers, exhausts and fires burn against it;
   · everywhere: a saturated, harder grade (post.js), like a painting rather than a photograph.
   PAINT.k (0 to 1) is how far the look is pushed; 0 gives back the grey rainy day. It costs a few colour changes a
   frame and nothing else. */
const PAINT = { k: 1, c: new T.Color() };
STYLE.over = 0; /* clear skies: the overcast belonged to the old look (the streets stay a little wet, which suits both) */
{
  const _usm = updateSkyMood;
  updateSkyMood = function (dt) {
    _usm(dt); const k = PAINT.k; if (k <= 0) return; const c = PAINT.c, n = skyU.night.value, d = (1 - n) * k, v = n * k;
    /* day: gold light, blue shade */
    sun.color.lerp(c.setRGB(1.0, 0.8, 0.52), 0.75 * d); sun.intensity *= 1 - 0.3 * d; hemi.intensity *= 1 - 0.3 * d;
    hemi.color.lerp(c.setRGB(0.5, 0.66, 0.95), 0.6 * d); if (hemi.groundColor) hemi.groundColor.lerp(c.setRGB(0.42, 0.4, 0.22), 0.6 * d);
    FOG.lerp(c.setRGB(0.6, 0.5, 0.42), 0.35 * d);
    skyU.horizon.value.lerp(c.setRGB(0.8, 0.6, 0.42), 0.45 * d); skyU.zenith.value.lerp(c.setRGB(0.16, 0.36, 0.68), 0.5 * d); skyU.sunCol.value.lerp(c.setRGB(1.0, 0.8, 0.5), 0.6 * d);
    /* night: violet dark, cold moon, teal from below */
    sun.color.lerp(c.setRGB(0.55, 0.62, 1.0), 0.85 * v); sun.intensity = lerp(sun.intensity, 0.42, 0.9 * v);
    hemi.color.lerp(c.setRGB(0.3, 0.26, 0.6), 0.9 * v); if (hemi.groundColor) hemi.groundColor.lerp(c.setRGB(0.05, 0.2, 0.22), 0.9 * v);
    hemi.intensity = lerp(hemi.intensity, 0.44, 0.9 * v);
    FOG.lerp(c.setRGB(0.05, 0.04, 0.12), 0.95 * v);
    skyU.horizon.value.lerp(c.setRGB(0.1, 0.07, 0.22), 0.95 * v); skyU.zenith.value.lerp(c.setRGB(0.015, 0.012, 0.05), 0.95 * v); skyU.sunCol.value.lerp(c.setRGB(0.7, 0.78, 1.0), 0.8 * v);
    scene.fog.color.copy(FOG); if (scene.background && scene.background.isColor) scene.background.copy(FOG);
    POST.exposure(lerp(1, lerp(0.74, 0.8, n), k));
  };
}
