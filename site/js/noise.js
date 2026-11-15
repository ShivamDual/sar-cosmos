/* 2D simplex noise (after Stefan Gustavson), seeded. Returns values in [-1, 1]. */
(function () {
  "use strict";
  var SC = (window.SC = window.SC || {});

  var F2 = 0.5 * (Math.sqrt(3) - 1);
  var G2 = (3 - Math.sqrt(3)) / 6;
  var grad3 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  var perm = new Uint8Array(512);
  var permMod8 = new Uint8Array(512);

  (function seed() {
    var s = 20261114; // Nov 14 2026, event day
    function rnd() {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var p = [], i;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (i = 0; i < 512; i++) { perm[i] = p[i & 255]; permMod8[i] = perm[i] % 8; }
  })();

  SC.noise2 = function (xin, yin) {
    var n0, n1, n2;
    var s = (xin + yin) * F2;
    var i = Math.floor(xin + s), j = Math.floor(yin + s);
    var t = (i + j) * G2;
    var x0 = xin - (i - t), y0 = yin - (j - t);
    var i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    var x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    var ii = i & 255, jj = j & 255;
    var g0 = grad3[permMod8[ii + perm[jj]]];
    var g1 = grad3[permMod8[ii + i1 + perm[jj + j1]]];
    var g2 = grad3[permMod8[ii + 1 + perm[jj + 1]]];
    var t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0; else { t0 *= t0; n0 = t0 * t0 * (g0[0] * x0 + g0[1] * y0); }
    var t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0; else { t1 *= t1; n1 = t1 * t1 * (g1[0] * x1 + g1[1] * y1); }
    var t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0; else { t2 *= t2; n2 = t2 * t2 * (g2[0] * x2 + g2[1] * y2); }
    return 70 * (n0 + n1 + n2);
  };
})();
