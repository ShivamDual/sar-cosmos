/* Procedural Himalayan range for SAR Cosmos.

   Honest note, also shown on the page: this terrain is generated, not a real
   elevation model. Lake order follows the real range from west to east and
   each lake sits at a height scaled from its real altitude, but spacing is
   schematic. The area values that drive the water level come from the
   pipeline data (data.js).

   One shader draws the same surface two ways: as sunlit optical imagery and
   as a SAR backscatter image, with a scanning wipe between them. */
(function () {
  "use strict";
  var SC = (window.SC = window.SC || {});

  var W = 200, D = 120, NX = 320, NZ = 192;
  var PLACE = {
    thulagi: { x: -78, z: -14 },
    tsho_rolpa: { x: -40, z: 6 },
    lumding: { x: -6, z: 10 },
    imja_tsho: { x: 26, z: -6 },
    hongu: { x: 50, z: 12 },
    lower_barun: { x: 80, z: -4 }
  };

  function smooth(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function buildLakeInfo(dataLakes) {
    return dataLakes.map(function (l, i) {
      var p = PLACE[l.id] || { x: -80 + i * 32, z: 0 };
      var areaMax = Math.max(0.3, l.latestAreaKm2 || 1);
      return {
        id: l.id, idx: i, name: l.name, x: p.x, z: p.z,
        R: 5.2 * Math.sqrt(areaMax),
        floorY: (l.altitude_m - 3600) / 160,
        s: 1.5, seed: i * 11.3 + 3, areaMax: areaMax
      };
    });
  }

  function makeHeightFn(lakes) {
    var N = SC.noise2;
    return function (x, z) {
      var nx = x / (W * 0.5), nz = z / (D * 0.5);
      var wx = x + 16 * N(x * 0.011 + 5.2, z * 0.011);
      var wz = z + 16 * N(x * 0.011, z * 0.011 + 9.7);
      var amp = 0.5, f = 0.011, sum = 0, w = 1, norm = 0, o;
      for (o = 0; o < 5; o++) {
        var a0 = N(wx * f + o * 13.7, wz * f + o * 7.3);
        var n = 1 - Math.sqrt(a0 * a0 + 0.035);
        n = Math.max(0, n) * 1.12; n *= n;
        sum += n * amp * w; norm += amp;
        w = Math.min(1, Math.max(0, n * 1.8));
        amp *= 0.42; f *= 2.05;
      }
      var r = sum / norm;
      var env = 0.5 + 0.5 * smooth(-0.8, 0.6, -nz);
      var edge = 1 - smooth(0.72, 1.0, Math.max(Math.abs(nx), Math.abs(nz)));
      var h = 1.5 + 36 * Math.pow(r, 1.7) * env * (0.25 + 0.75 * edge);
      // wide, calm valleys around every lake
      var uMin = 99;
      for (var q2 = 0; q2 < lakes.length; q2++) {
        var ddx = x - lakes[q2].x, ddz = z - lakes[q2].z;
        var dd = Math.sqrt(ddx * ddx + ddz * ddz) / lakes[q2].R;
        if (dd < uMin) uMin = dd;
      }
      h *= 0.4 + 0.6 * smooth(1.2, 5.0, uMin);

      for (var k = 0; k < lakes.length; k++) {
        var lk = lakes[k];
        var dx = x - lk.x, dz = z - lk.z;
        var ux = dx + lk.R * 0.28 * N(x * 0.09 + lk.seed, z * 0.09);
        var uz = dz + lk.R * 0.28 * N(x * 0.09, z * 0.09 + lk.seed + 40);
        var u = Math.sqrt(ux * ux * 0.85 + uz * uz * 1.15) / lk.R;
        var tgt = u < 1 ? lk.floorY + lk.s * u * u : lk.floorY + lk.s + 1.1 * (u - 1);
        var wBowl = 1 - smooth(1.8, 4.6, u);
        h = h * (1 - wBowl) + tgt * wBowl;
        // terminal moraine dam on the downstream (south) side
        var dam = 0.9 * Math.exp(-Math.pow((dz - 1.6 * lk.R) / (0.4 * lk.R), 2)) *
                  Math.exp(-Math.pow(dx / (1.3 * lk.R), 2));
        h += dam;
        // cirque headwall to the north
        var north = -dz;
        h += 5 * smooth(1.0 * lk.R, 3.6 * lk.R, north) * Math.exp(-Math.pow(dx / (2.4 * lk.R), 2));
        // glacier valley ramp feeding the lake
        var gm = smooth(0.7 * lk.R, 1.2 * lk.R, north) * (1 - smooth(2.8 * lk.R, 3.8 * lk.R, north)) *
                 (1 - smooth(0.35 * lk.R, 0.95 * lk.R, Math.abs(dx + 0.4 * lk.R * N(north * 0.08, lk.seed))));
        var ramp = lk.floorY + 1.0 + (north - lk.R) * 0.3 + 0.35 * N(x * 0.35, z * 0.35);
        h = h * (1 - 0.55 * gm) + ramp * 0.55 * gm;
      }
      return Math.max(0.4, h);
    };
  }

  function iceMask(lakes, x, z) {
    var m = 0;
    for (var k = 0; k < lakes.length; k++) {
      var lk = lakes[k], dx = x - lk.x, north = -(z - lk.z);
      var gm = smooth(0.8 * lk.R, 1.3 * lk.R, north) * (1 - smooth(2.8 * lk.R, 3.8 * lk.R, north)) *
               (1 - smooth(0.35 * lk.R, 0.95 * lk.R, Math.abs(dx + 0.4 * lk.R * SC.noise2(north * 0.08, lk.seed))));
      if (gm > m) m = gm;
    }
    return m;
  }

  /* ---------------------------------------------------------- shaders --- */
  var VERT = [
    "attribute float aShadow; attribute float aAO; attribute float aIce;",
    "varying vec3 vWorld; varying vec3 vN; varying float vShadow; varying float vAO; varying float vIce;",
    "void main(){",
    "  vWorld = position; vN = normal; vShadow = aShadow; vAO = aAO; vIce = aIce;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n");

  var NOISE_GLSL = [
    "float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
    "float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
    "  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));",
    "  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }",
    "float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }"
  ].join("\n");

  var FRAG = [
    "uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uFogCol; uniform float uFogDen;",
    "uniform float uTime; uniform float uWipeX; uniform vec3 uCamPos; uniform vec3 uSarDir;",
    "uniform vec2 uLakeC[6]; uniform float uLakeY[6]; uniform float uLakeRi[6];",
    "varying vec3 vWorld; varying vec3 vN; varying float vShadow; varying float vAO; varying float vIce;",
    NOISE_GLSL,
    "void main(){",
    "  vec3 N = normalize(vN);",
    "  vec2 p = vWorld.xz; float h = vWorld.y;",
    // fine relief from noise gradient
    "  float e = 0.3;",
    "  float n0 = fbm(p * 1.7), nx = fbm((p + vec2(e, 0.0)) * 1.7), nz = fbm((p + vec2(0.0, e)) * 1.7);",
    "  float slope0 = 1.0 - N.y;",
    "  N = normalize(N + vec3((n0 - nx) / e, 0.0, (n0 - nz) / e) * (0.12 + 0.45 * smoothstep(0.1, 0.5, slope0)));",
    "  float slope = 1.0 - N.y;",
    // water
    "  float wd = 0.0;",
    "  for(int i = 0; i < 6; i++){",
    "    if(distance(p, uLakeC[i]) < uLakeRi[i] && h < uLakeY[i]) wd = max(wd, uLakeY[i] - h);",
    "  }",
    // ---- optical
    "  float ndl = max(dot(N, uSunDir), 0.0);",
    "  float direct = ndl * vShadow;",
    "  vec3 amb = mix(vec3(0.10, 0.12, 0.20), uSkyCol * 0.85, N.y * 0.5 + 0.5);",
    "  vec3 lit = amb * vAO + uSunCol * direct * 2.0 * mix(0.75, 1.0, vAO);",
    "  float rockN = fbm(p * 0.9 + 3.0);",
    "  vec3 rock = mix(vec3(0.26, 0.25, 0.26), vec3(0.50, 0.46, 0.42), rockN);",
    "  vec3 alb = mix(vec3(0.46, 0.42, 0.38), rock, smoothstep(0.12, 0.42, slope));",
    "  alb = mix(alb, vec3(0.20, 0.23, 0.14), (1.0 - smoothstep(3.0, 8.0, h)) * (1.0 - smoothstep(0.1, 0.35, slope)) * 0.7);",
    "  float snowLine = 10.5 + 4.0 * (fbm(p * 0.3) - 0.5);",
    "  float snowAmt = smoothstep(snowLine - 1.5, snowLine + 1.5, h) * (1.0 - smoothstep(0.50, 0.85, slope));",
    "  alb = mix(alb, vec3(0.94, 0.96, 1.0), snowAmt);",
    "  float crev = smoothstep(0.55, 0.82, fbm(p * vec2(2.6, 0.8) + vec2(0.0, h * 0.3)));",
    "  vec3 ice = mix(vec3(0.74, 0.87, 0.93), vec3(0.42, 0.60, 0.72), crev * 0.85);",
    "  alb = mix(alb, ice, vIce * (1.0 - snowAmt * 0.4));",
    "  vec3 optical = alb * lit + snowAmt * uSunCol * direct * 0.10;",
    "  vec3 V = normalize(uCamPos - vWorld);",
    "  if(wd > 0.0){",
    "    vec2 w = p * 1.3 + vec2(uTime * 0.07, uTime * 0.05);",
    "    vec3 wn = normalize(vec3((vnoise(w + vec2(0.1, 0.0)) - vnoise(w)) * 0.55, 1.0, (vnoise(w + vec2(0.0, 0.1)) - vnoise(w)) * 0.55));",
    "    float fres = pow(1.0 - max(dot(V, wn), 0.0), 3.0);",
    "    float dk = 1.0 - exp(-wd * 1.5);",
    "    vec3 base = mix(vec3(0.40, 0.94, 0.86), vec3(0.02, 0.34, 0.43), dk);",
    "    vec3 col = mix(base, uSkyCol * 1.1, fres * 0.4);",
    "    col += pow(max(dot(reflect(-uSunDir, wn), V), 0.0), 80.0) * 1.8 * uSunCol;",
    "    col += smoothstep(0.0, 0.07, wd) * (1.0 - smoothstep(0.07, 0.2, wd)) * 0.28;",
    "    optical = col;",
    "  }",
    // ---- radar
    "  float inc = max(dot(N, -uSarDir), 0.0);",
    "  vec2 sp = floor(p * 9.0);",
    "  float speck = 0.35 + 1.5 * hash(sp) * hash(sp + 13.7);",
    "  float back = pow(inc, 0.85) * 0.95 + 0.04 + slope * 0.14;",
    "  back *= mix(1.0, 0.72, snowAmt);",
    "  vec3 radar = vec3(0.50, 0.90, 0.97) * back * speck * 1.1;",
    "  if(wd > 0.0) radar = vec3(0.008, 0.022, 0.03) + vec3(0.025) * hash(sp);",
    // ---- scanning wipe
    "  float rm = 1.0 - smoothstep(uWipeX - 1.6, uWipeX + 1.6, vWorld.x);",
    "  vec3 col2 = mix(optical, radar, rm);",
    "  float line = exp(-pow((vWorld.x - uWipeX) / 0.55, 2.0)) * step(-120.0, uWipeX) * step(uWipeX, 120.0);",
    "  col2 += vec3(0.25, 0.95, 1.0) * line * 1.3;",
    "  float dist = distance(uCamPos, vWorld);",
    "  float fog = 1.0 - exp(-pow(dist * uFogDen, 1.4));",
    "  fog *= mix(1.0, 0.4, rm);",
    "  col2 = mix(col2, uFogCol, fog);",
    "  col2 = 1.0 - exp(-col2 * 1.35);",
    "  gl_FragColor = vec4(col2, 1.0);",
    "}"
  ].join("\n");

  /* ------------------------------------------------------------ build --- */
  SC.buildTerrain = function (THREE, dataLakes, shared) {
    var lakes = buildLakeInfo(dataLakes);
    var H = makeHeightFn(lakes);
    var dxs = W / (NX - 1), dzs = D / (NZ - 1);
    var NV = NX * NZ, ix, iz, i;

    var hgt = new Float32Array(NV);
    for (iz = 0; iz < NZ; iz++) {
      for (ix = 0; ix < NX; ix++) {
        hgt[iz * NX + ix] = H(-W / 2 + ix * dxs, -D / 2 + iz * dzs);
      }
    }

    function sampleH(x, z) {
      var fx = (x + W / 2) / dxs, fz = (z + D / 2) / dzs;
      if (fx < 0) fx = 0; if (fz < 0) fz = 0;
      if (fx > NX - 1.001) fx = NX - 1.001; if (fz > NZ - 1.001) fz = NZ - 1.001;
      var x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
      var a = hgt[z0 * NX + x0], b = hgt[z0 * NX + x0 + 1];
      var c = hgt[(z0 + 1) * NX + x0], d = hgt[(z0 + 1) * NX + x0 + 1];
      return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
    }

    var pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3);
    var aSh = new Float32Array(NV), aAO = new Float32Array(NV), aIce = new Float32Array(NV);

    // sun used for the baked shadows (matches shared.uSunDir)
    var sd = shared.uSunDir.value;
    var hl = Math.sqrt(sd.x * sd.x + sd.z * sd.z) || 1;
    var sx = sd.x / hl, sz = sd.z / hl, tanE = sd.y / hl;

    for (iz = 0; iz < NZ; iz++) {
      for (ix = 0; ix < NX; ix++) {
        i = iz * NX + ix;
        var x = -W / 2 + ix * dxs, z = -D / 2 + iz * dzs, h = hgt[i];
        pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;

        var hl_ = hgt[iz * NX + Math.max(ix - 1, 0)], hr = hgt[iz * NX + Math.min(ix + 1, NX - 1)];
        var hu = hgt[Math.max(iz - 1, 0) * NX + ix], hd = hgt[Math.min(iz + 1, NZ - 1) * NX + ix];
        var nxv = (hl_ - hr) / (2 * dxs), nzv = (hu - hd) / (2 * dzs);
        var nl = Math.sqrt(nxv * nxv + 1 + nzv * nzv);
        nor[i * 3] = nxv / nl; nor[i * 3 + 1] = 1 / nl; nor[i * 3 + 2] = nzv / nl;

        // baked sun shadow
        var maxEx = 0, step = 0.9, kk;
        for (kk = 1; kk <= 70; kk++) {
          var px = x + sx * kk * step, pz = z + sz * kk * step;
          if (px < -W / 2 || px > W / 2 || pz < -D / 2 || pz > D / 2) break;
          var ex = sampleH(px, pz) - (h + kk * step * tanE);
          if (ex > maxEx) maxEx = ex;
        }
        aSh[i] = 1 - smooth(0.0, 1.4, maxEx);

        // cheap cavity AO
        var sum = 0, cnt = 0, ax, az;
        for (az = -3; az <= 3; az += 3) {
          for (ax = -3; ax <= 3; ax += 3) {
            var qx = Math.min(NX - 1, Math.max(0, ix + ax)), qz = Math.min(NZ - 1, Math.max(0, iz + az));
            sum += hgt[qz * NX + qx]; cnt++;
          }
        }
        var cav = Math.min(1, Math.max(0, (sum / cnt - h) * 0.22));
        aAO[i] = 1 - 0.55 * cav;
        aIce[i] = iceMask(lakes, x, z);
      }
    }

    var idx = new Uint16Array((NX - 1) * (NZ - 1) * 6), q = 0;
    for (iz = 0; iz < NZ - 1; iz++) {
      for (ix = 0; ix < NX - 1; ix++) {
        var a = iz * NX + ix, b = a + 1, c = a + NX, d = c + 1;
        idx[q++] = a; idx[q++] = c; idx[q++] = b;
        idx[q++] = b; idx[q++] = c; idx[q++] = d;
      }
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    geo.setAttribute("aShadow", new THREE.BufferAttribute(aSh, 1));
    geo.setAttribute("aAO", new THREE.BufferAttribute(aAO, 1));
    geo.setAttribute("aIce", new THREE.BufferAttribute(aIce, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();

    var lakeC = [], lakeY = [], lakeRi = [];
    for (i = 0; i < 6; i++) {
      var lk = lakes[i];
      lakeC.push(lk ? new THREE.Vector2(lk.x, lk.z) : new THREE.Vector2(9999, 9999));
      lakeY.push(lk ? lk.floorY + lk.s * 0.5 : -50);
      lakeRi.push(lk ? lk.R * 1.6 : 0);
    }

    var uniforms = {
      uSunDir: shared.uSunDir, uSunCol: shared.uSunCol, uSkyCol: shared.uSkyCol,
      uFogCol: shared.uFogCol, uFogDen: shared.uFogDen, uTime: shared.uTime,
      uWipeX: shared.uWipeX, uCamPos: shared.uCamPos,
      uSarDir: { value: new THREE.Vector3(-0.82, -0.52, 0.2).normalize() },
      uLakeC: { value: lakeC }, uLakeY: { value: lakeY }, uLakeRi: { value: lakeRi }
    };

    var mat = new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: VERT, fragmentShader: FRAG });
    var mesh = new THREE.Mesh(geo, mat);

    var stats = { min: 1e9, max: -1e9 };
    for (i = 0; i < NV; i++) { if (hgt[i] < stats.min) stats.min = hgt[i]; if (hgt[i] > stats.max) stats.max = hgt[i]; }

    return {
      mesh: mesh, lakes: lakes, uniforms: uniforms, heightAt: sampleH, stats: stats,
      width: W, depth: D, noiseGLSL: NOISE_GLSL
    };
  };
})();
