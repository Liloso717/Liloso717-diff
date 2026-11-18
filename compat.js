'use strict';
/* ===================== IRON MERIDIAN · three.js r187 compatibility =====================
   The game was built on three.js r128 (2021). Two things changed underneath it since then that would change how it
   looks; this file, loaded straight after three.js, keeps the old look exactly:
   · colour management (r152): colours set in code are no longer converted from sRGB, as in r128;
   · light units (r155, legacy mode removed in r165): r128 scaled every light by π and faded point lights linearly to
     their range; physically based units would leave the island several times darker. The shader code that reads the
     lights is patched back to the r128 formulas, so every light in the game keeps its intensity and range.
   Everything else that changed (texture colour spaces, the output colour space, multisampled render targets, the
   renamed colour-space shader include, WebGL 2 only) is updated where it is used. */
THREE.ColorManagement.enabled = false;
{
  const C = THREE.ShaderChunk, rep = (k, a, b) => { if (!C[k].includes(a)) { console.warn('compat: chunk changed', k, a.slice(0, 40)); return; } C[k] = C[k].replace(a, b); };
  rep('lights_pars_begin', 'vec3 irradiance = ambientLightColor;', 'vec3 irradiance = ambientLightColor * PI; /* r128 legacy units */');
  rep('lights_pars_begin', 'float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );\n\tif ( cutoffDistance > 0.0 ) {\n\t\tdistanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );\n\t}\n\treturn distanceFalloff;',
    'if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent ); /* r128: a linear fade to the light\'s range */\n\treturn 1.0;');
  rep('lights_pars_begin', 'light.color = directionalLight.color;', 'light.color = directionalLight.color * PI;');
  rep('lights_pars_begin', 'light.color = pointLight.color;', 'light.color = pointLight.color * PI;');
  rep('lights_pars_begin', 'light.color = spotLight.color * spotAttenuation;', 'light.color = spotLight.color * spotAttenuation * PI;');
  rep('lights_pars_begin', 'vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );', 'vec3 irradiance = PI * mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );');
}
