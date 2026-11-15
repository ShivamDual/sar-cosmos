/* The 3D world: terrain + sky + monsoon clouds + satellite + lake beacons.
   Exposes SC.world with a small API used by ui.js. */
(function () {
  "use strict";
  var SC = (window.SC = window.SC || {});
  var T = window.THREE;
  var world = (SC.world = {});

  var shared = {
    uSunDir: { value: new T.Vector3(0.68, 0.30, 0.32).normalize() },
    uSunCol: { value: new T.Vector3(1.0, 0.83, 0.66) },
    uSkyCol: { value: new T.Vector3(0.40, 0.52, 0.78) },
    uFogCol: { value: new T.Vector3(0.40, 0.49, 0.64) },
    uFogDen: { value: 0.0042 },
    uTime: { value: 0 },
    uWipeX: { value: -130 },
    uCamPos: { value: new T.Vector3() }
  };

  var renderer, scene, camera, terrain, lakes = [], dataLakes;
  var camPos = new T.Vector3(-30, 60, 110), camLook = new T.Vector3(0, 8, 0);
  var tgtPos = camPos.clone(), tgtLook = camLook.clone();
  var pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  var state = { cloud: 0, cloudTarget: 0, radar: false, wipeTarget: -130, markers: 0, markersTarget: 0, selected: 0 };
  var ratios = [], ratioTargets = [];
  var sky, cloudMeshes = [], sat, beam, beamRing, pillars = [], clock = new T.Clock();
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  world.frameCallbacks = [];

  /* ----------------------------------------------------------- sky ----- */
  function makeSky() {
    var mat = new T.ShaderMaterial({
      uniforms: { uSunDir: shared.uSunDir, uTime: shared.uTime },
      side: T.BackSide, depthWrite: false,
      vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: [
        "uniform vec3 uSunDir; uniform float uTime; varying vec3 vDir;",
        "float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
        "void main(){",
        "  vec3 d = normalize(vDir); float y = d.y;",
        "  vec3 top = vec3(0.012, 0.028, 0.075), mid = vec3(0.07, 0.15, 0.33), hor = vec3(0.30, 0.37, 0.56);",
        "  vec3 col = mix(hor, mid, smoothstep(0.0, 0.30, y));",
        "  col = mix(col, top, smoothstep(0.22, 0.85, y));",
        "  float sd = max(dot(d, normalize(uSunDir)), 0.0);",
        "  col += vec3(1.0, 0.62, 0.38) * pow(sd, 4.0) * 0.7 * (1.0 - smoothstep(0.0, 0.5, y));",
        "  col += vec3(1.0, 0.88, 0.7) * pow(sd, 90.0) * 1.1;",
        "  vec2 sp = d.xz / (abs(y) + 0.9) * 210.0;",
        "  float st = step(0.9965, hash(floor(sp))) * smoothstep(0.12, 0.5, y);",
        "  st *= 0.55 + 0.45 * sin(uTime * 2.0 + hash(floor(sp)) * 40.0);",
        "  col += vec3(st);",
        "  col = mix(col, vec3(0.40, 0.49, 0.64), smoothstep(0.0, -0.25, y));",
        "  gl_FragColor = vec4(col, 1.0);",
        "}"
      ].join("\n")
    });
    sky = new T.Mesh(new T.SphereGeometry(600, 32, 20), mat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);
  }

  /* --------------------------------------------------------- clouds ---- */
  function makeClouds() {
    var frag = [
      "uniform float uTime; uniform float uCloud; uniform float uWipeX; uniform float uScale; uniform float uSeed; uniform float uSpeed;",
      "uniform vec3 uSunCol; varying vec3 vW;",
      "float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
      "float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
      "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }",
      "float fbm5(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.07 + vec2(11.3, 4.7); a *= 0.5; } return s; }",
      "void main(){",
      "  vec2 q = vW.xz * uScale + vec2(uTime * uSpeed, uTime * uSpeed * 0.35) + uSeed;",
      "  float c = fbm5(q);",
      "  float thr = mix(0.92, 0.36, uCloud);",
      "  float a = smoothstep(thr, thr + 0.2, c);",
      "  float rm = 1.0 - smoothstep(uWipeX - 1.6, uWipeX + 1.6, vW.x);",
      "  a *= mix(1.0, 0.06, rm);",
      "  float edge = 1.0 - smoothstep(0.78, 1.0, max(abs(vW.x) / 170.0, abs(vW.z) / 105.0));",
      "  vec3 col = mix(vec3(0.55, 0.62, 0.76), vec3(1.0, 0.95, 0.9), smoothstep(0.33, 0.75, c));",
      "  col += uSunCol * 0.1;",
      "  gl_FragColor = vec4(col, a * edge * 0.94);",
      "}"
    ].join("\n");
    var vert = "varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }";
    [{ y: 15.5, s: 0.030, seed: 3.0, sp: 0.010 }, { y: 19.5, s: 0.018, seed: 41.0, sp: 0.006 }].forEach(function (c) {
      var m = new T.ShaderMaterial({
        transparent: true, depthWrite: false, side: T.DoubleSide, vertexShader: vert, fragmentShader: frag,
        uniforms: {
          uTime: shared.uTime, uWipeX: shared.uWipeX, uSunCol: shared.uSunCol,
          uCloud: { value: 0 }, uScale: { value: c.s }, uSeed: { value: c.seed }, uSpeed: { value: c.sp }
        }
      });
      var mesh = new T.Mesh(new T.PlaneGeometry(360, 220, 1, 1), m);
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = c.y; mesh.renderOrder = 5;
      scene.add(mesh); cloudMeshes.push(mesh);
    });
  }

  /* ------------------------------------------------------ satellite ---- */
  function cellTexture() {
    var c = document.createElement("canvas"); c.width = 256; c.height = 128;
    var g = c.getContext("2d");
    g.fillStyle = "#0e1b3c"; g.fillRect(0, 0, 256, 128);
    for (var i = 0; i < 8; i++) for (var j = 0; j < 4; j++) {
      var gr = g.createLinearGradient(i * 32, j * 32, i * 32 + 32, j * 32 + 32);
      gr.addColorStop(0, "#1c3a78"); gr.addColorStop(1, "#0f2250");
      g.fillStyle = gr; g.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29);
    }
    g.strokeStyle = "rgba(200,220,255,.28)"; g.lineWidth = 1;
    for (i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.stroke(); }
    for (j = 0; j <= 4; j++) { g.beginPath(); g.moveTo(0, j * 32); g.lineTo(256, j * 32); g.stroke(); }
    var tex = new T.CanvasTexture(c); tex.anisotropy = 4; return tex;
  }

  function makeSatellite() {
    sat = new T.Group();
    var gold = new T.MeshStandardMaterial({ color: 0xd8a63f, metalness: 0.25, roughness: 0.45, emissive: 0x3a2808, emissiveIntensity: 0.6 });
    var steel = new T.MeshStandardMaterial({ color: 0xc9d1de, metalness: 0.2, roughness: 0.5, emissive: 0x1a2030, emissiveIntensity: 0.5 });
    var bus = new T.Mesh(new T.BoxGeometry(1.7, 1.3, 2.6), gold); sat.add(bus);
    var panelMat = new T.MeshStandardMaterial({ map: cellTexture(), metalness: 0.15, roughness: 0.5, emissive: 0x16307a, emissiveMap: cellTexture(), emissiveIntensity: 0.7 });
    [-1, 1].forEach(function (s) {
      var arm = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1.8, 8), steel);
      arm.rotation.z = Math.PI / 2; arm.position.x = s * 1.7; sat.add(arm);
      var panel = new T.Mesh(new T.BoxGeometry(5.0, 2.3, 0.05), panelMat);
      panel.position.x = s * 4.3; sat.add(panel);
    });
    var boom = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 3.0, 8), steel);
    boom.position.set(0, -2.0, 0.4); sat.add(boom);
    // mesh reflector on a boom: translucent disc, rim and spokes, facing the viewer
    var dishG = new T.Group();
    dishG.add(new T.Mesh(new T.CircleGeometry(2.7, 56), new T.MeshBasicMaterial({ color: 0xf2d98a, transparent: true, opacity: 0.38, side: T.DoubleSide })));
    var rim = new T.Mesh(new T.TorusGeometry(2.7, 0.07, 8, 64), new T.MeshStandardMaterial({ color: 0xf2d98a, metalness: 0.2, roughness: 0.5, emissive: 0x6a5420, emissiveIntensity: 0.7 }));
    dishG.add(rim);
    var sp = [], k;
    for (k = 0; k < 12; k++) { var a = k / 12 * Math.PI * 2; sp.push(0, 0, 0, Math.cos(a) * 2.7, Math.sin(a) * 2.7, 0); }
    var sg = new T.BufferGeometry(); sg.setAttribute("position", new T.Float32BufferAttribute(sp, 3));
    dishG.add(new T.LineSegments(sg, new T.LineBasicMaterial({ color: 0xf2d98a, transparent: true, opacity: 0.55 })));
    [1.0, 1.8].forEach(function (r) { dishG.add(new T.Mesh(new T.TorusGeometry(r, 0.02, 6, 48), new T.MeshBasicMaterial({ color: 0xf2d98a, transparent: true, opacity: 0.5 }))); });
    dishG.position.set(0, -4.4, 0.6);
    sat.add(dishG);
    sat.scale.setScalar(2.1);
    scene.add(sat);

    scene.add(new T.HemisphereLight(0xaac4ff, 0x20243a, 0.9));
    var dl = new T.DirectionalLight(0xffd9b0, 1.6); dl.position.copy(shared.uSunDir.value).multiplyScalar(100); scene.add(dl);
  }

  function makeBeam() {
    var g = new T.CylinderGeometry(0.15, 5.5, 1, 28, 1, true);
    g.translate(0, 0.5, 0); g.rotateX(Math.PI / 2); // apex at origin, axis along +Z
    var m = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: { uOpacity: { value: 0 }, uTime: shared.uTime },
      vertexShader: "varying float vT; void main(){ vT = position.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform float uOpacity; uniform float uTime; varying float vT; void main(){ float k = clamp(vT, 0.0, 1.0); float pulse = 0.75 + 0.25 * sin(uTime * 6.0 - k * 14.0); gl_FragColor = vec4(0.25, 0.9, 1.0, uOpacity * (0.05 + 0.2 * k) * pulse); }"
    });
    beam = new T.Mesh(g, m); beam.frustumCulled = false; beam.renderOrder = 8; scene.add(beam);
    var rg = new T.RingGeometry(0.7, 1.0, 64); rg.rotateX(-Math.PI / 2);
    beamRing = new T.Mesh(rg, new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: "void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform float uOpacity; void main(){ gl_FragColor = vec4(0.3, 0.95, 1.0, uOpacity); }"
    }));
    beamRing.renderOrder = 8; scene.add(beamRing);
  }

  /* --------------------------------------------------- lake beacons ---- */
  function makePillars() {
    lakes.forEach(function (lk, i) {
      var colr = new T.Color(dataLakes[i].riskColor);
      var g = new T.CylinderGeometry(0.09, 0.09, 15, 10, 1, true); g.translate(0, 7.5, 0);
      var m = new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        uniforms: { uCol: { value: new T.Vector3(colr.r, colr.g, colr.b) }, uOpacity: { value: 0 }, uSel: { value: 0 } },
        vertexShader: "varying float vY; void main(){ vY = position.y / 15.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "uniform vec3 uCol; uniform float uOpacity; uniform float uSel; varying float vY; void main(){ gl_FragColor = vec4(uCol * 1.4, (1.0 - vY) * (0.5 + 0.5 * uSel) * uOpacity); }"
      });
      var pil = new T.Mesh(g, m); pil.renderOrder = 9; pil.frustumCulled = false;
      var rg = new T.RingGeometry(0.85, 1.0, 48); rg.rotateX(-Math.PI / 2);
      var rm = new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        uniforms: { uCol: { value: new T.Vector3(colr.r, colr.g, colr.b) }, uOpacity: { value: 0 } },
        vertexShader: "void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "uniform vec3 uCol; uniform float uOpacity; void main(){ gl_FragColor = vec4(uCol * 1.3, uOpacity); }"
      });
      var ring = new T.Mesh(rg, rm); ring.renderOrder = 9; ring.frustumCulled = false;
      scene.add(pil); scene.add(ring);
      pillars.push({ pil: pil, ring: ring, lake: lk });
    });
  }

  /* ----------------------------------------------------------- API ----- */
  function waterY(i) { return lakes[i].floorY + lakes[i].s * ratios[i]; }

  world.init = function (canvas, data) {
    dataLakes = data.lakes;
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(42, 1, 0.5, 1400);
    var t0 = performance.now();
    terrain = SC.buildTerrain(T, dataLakes, shared);
    world.buildMs = performance.now() - t0;
    lakes = terrain.lakes;
    scene.add(terrain.mesh);
    for (var i = 0; i < lakes.length; i++) { ratios[i] = 1; ratioTargets[i] = 1; }
    makeSky(); makeClouds(); makeSatellite(); makeBeam(); makePillars();
    world.resize();
    window.addEventListener("resize", world.resize);
    renderer.setAnimationLoop ? null : null;
    loop();
  };

  world.lakes = function () { return lakes; };
  world.debug = function () { return { cam: camPos.toArray(), tgt: tgtPos.toArray(), look: tgtLook.toArray(), lake: lakes.map(function (l) { return [l.x, l.z, l.floorY]; }) }; };
  world.terrain = function () { return terrain; };
  world.resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // wider framing on tall (phone) screens
    camera.fov = w / h < 0.8 ? 58 : 42;
    camera.updateProjectionMatrix();
  };
  world.setPose = function (pos, look, snap) {
    tgtPos.set(pos[0], pos[1], pos[2]); tgtLook.set(look[0], look[1], look[2]);
    if (snap) { camPos.copy(tgtPos); camLook.copy(tgtLook); }
  };
  world.setPointer = function (x, y) { pointer.x = x; pointer.y = y; };
  world.setClouds = function (v, snap) { state.cloudTarget = v; if (snap) state.cloud = v; };
  world.setMarkers = function (v, snap) { state.markersTarget = v; if (snap) state.markers = v; };
  world.setRadar = function (on, snap) {
    state.radar = on; state.wipeTarget = on ? 130 : -130;
    if (snap) shared.uWipeX.value = state.wipeTarget;
  };
  world.setWipe = function (x) { shared.uWipeX.value = x; state.wipeTarget = x; state.radar = true; };
  world.isRadar = function () { return state.radar; };
  world.setSelected = function (i) { state.selected = i; };
  world.setRatios = function (arr, snap) {
    for (var i = 0; i < arr.length; i++) { ratioTargets[i] = arr[i]; if (snap) ratios[i] = arr[i]; }
  };
  world.groundY = function (x, z) { return terrain.heightAt(x, z); };
  world.project = function (i, lift) {
    var lk = lakes[i], v = new T.Vector3(lk.x, waterY(i) + (lift || 0), lk.z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, visible: v.z < 1 && v.z > -1 };
  };

  // adaptive resolution: if the GPU can't hold ~30fps, quietly render fewer pixels
  var perf = { n: 0, sum: 0, pr: 0, min: 0.7 };
  function adapt(dt) {
    if (perf.pr === 0) perf.pr = renderer.getPixelRatio();
    perf.n++; perf.sum += dt;
    if (perf.n >= 70) {
      var avg = perf.sum / perf.n;
      if (avg > 0.036 && perf.pr > perf.min) {
        perf.pr = Math.max(perf.min, perf.pr * 0.8);
        renderer.setPixelRatio(perf.pr); world.resize();
      }
      perf.n = 0; perf.sum = 0;
    }
  }
  var wipeSpeed = 58; // world units per second
  function loop() {
    requestAnimationFrame(loop);
    var rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.05), t = clock.elapsedTime;
    if (document.visibilityState === "visible" && rawDt < 1) adapt(rawDt);
    shared.uTime.value = reduced ? 0 : t;

    // scanning wipe
    var wx = shared.uWipeX.value, wt = state.wipeTarget;
    var wiping = Math.abs(wx - wt) > 0.5;
    if (wiping) shared.uWipeX.value += Math.sign(wt - wx) * Math.min(Math.abs(wt - wx), wipeSpeed * dt);

    // camera rig
    var k = 1 - Math.exp(-dt * 2.4);
    camPos.lerp(tgtPos, k); camLook.lerp(tgtLook, k);
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));
    camera.position.copy(camPos);
    var right = new T.Vector3().subVectors(camLook, camPos).cross(new T.Vector3(0, 1, 0)).normalize();
    camera.position.addScaledVector(right, pointer.sx * 1.6 + (reduced ? 0 : Math.sin(t * 0.13) * 1.4)).y += -pointer.sy * 0.9 + (reduced ? 0 : Math.sin(t * 0.17) * 0.5);
    camera.lookAt(camLook);
    shared.uCamPos.value.copy(camera.position);
    sky.position.copy(camera.position);

    // clouds
    state.cloud += (state.cloudTarget - state.cloud) * (1 - Math.exp(-dt * 1.6));
    cloudMeshes.forEach(function (m, i) { m.material.uniforms.uCloud.value = state.cloud * (i === 0 ? 1 : 0.85); });

    // water levels
    var uly = terrain.uniforms.uLakeY.value;
    for (var i = 0; i < lakes.length; i++) {
      ratios[i] += (ratioTargets[i] - ratios[i]) * (1 - Math.exp(-dt * 4));
      uly[i] = waterY(i);
    }

    // markers
    state.markers += (state.markersTarget - state.markers) * (1 - Math.exp(-dt * 2.5));
    pillars.forEach(function (p, i) {
      var sel = i === state.selected ? 1 : 0;
      p.pil.position.set(p.lake.x, waterY(i), p.lake.z);
      p.pil.material.uniforms.uOpacity.value = state.markers * (state.cloud > 0.3 && !state.radar ? 0.55 : 1);
      p.pil.material.uniforms.uSel.value = sel;
      p.ring.position.set(p.lake.x, waterY(i) + 0.08, p.lake.z);
      var ph = (t * 0.7 + i * 0.37) % 1;
      var sc = 1.2 + ph * (sel ? 7 : 4.2);
      p.ring.scale.set(sc, 1, sc);
      p.ring.material.uniforms.uOpacity.value = state.markers * (1 - ph) * (sel ? 0.9 : 0.45);
    });

    // satellite + beam
    var idleX = -22 + 44 * Math.sin(t * 0.07), idleZ = -12 + 6 * Math.cos(t * 0.07);
    var sx = idleX, sz = idleZ, sy = 31 + 1.6 * Math.sin(t * 0.5);
    if (wiping || (state.radar && Math.abs(wx) < 125)) { sx = Math.max(-100, Math.min(100, wx)); sz = -22; sy = 44; }
    sat.position.set(sx, sy, sz);
    var vx = 52 * 0.07 * Math.cos(t * 0.07);
    sat.rotation.y = 0.35 * Math.sin(t * 0.21) + (wiping ? 0.5 : 0);
    sat.rotation.z = 0.06 * Math.sin(t * 0.4);

    var beamOn = state.radar ? 1 : 0;
    var tgt = new T.Vector3(sx + (wiping ? 0 : 8), terrain.heightAt(sx, 0) , 2);
    beam.position.copy(sat.position).add(new T.Vector3(0, -7.2, 1.0));
    var len = beam.position.distanceTo(tgt);
    beam.lookAt(tgt); beam.scale.set(1, 1, len);
    beam.material.uniforms.uOpacity.value += (beamOn - beam.material.uniforms.uOpacity.value) * (1 - Math.exp(-dt * 3));
    beamRing.position.set(tgt.x, tgt.y + 0.15, tgt.z);
    var rp = (t * 0.9) % 1;
    beamRing.scale.set(2 + rp * 7, 1, 2 + rp * 7);
    beamRing.material.uniforms.uOpacity.value = beam.material.uniforms.uOpacity.value * (1 - rp) * 0.7;

    renderer.render(scene, camera);
    for (var f = 0; f < world.frameCallbacks.length; f++) world.frameCallbacks[f](dt, t);
  }
})();
