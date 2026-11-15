/* SAR Cosmos UI. Wires the page to the 3D world.
   Scroll drives the camera story; the lakes section hands control to the selected lake,
   a drag-to-orbit zone, and a global timeline. Every number on screen comes from
   window.SAR_COSMOS_DATA (real or published measurements only; see scripts/export_static_data.py). */
(function () {
  "use strict";
  var SC = (window.SC = window.SC || {});
  var D = window.SAR_COSMOS_DATA;
  var L = D.lakes;
  var RAD = window.SAR_COSMOS_RADAR && window.SAR_COSMOS_RADAR.lakes ? window.SAR_COSMOS_RADAR.lakes : {};
  var world = SC.world;
  var ui = (SC.ui = {});
  var fine = window.matchMedia && window.matchMedia("(pointer:fine)").matches;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function pct(v) { return v == null ? "n/a" : (v > 0 ? "+" : "") + v.toFixed(1) + "%"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function sname(l) { return l.name.replace(/ \(.*\)/, ""); }

  /* ---------------------------------------------------- series --------- */
  function decYear(s) {
    var d = new Date(s + "T00:00:00Z"), y = d.getUTCFullYear();
    return y + (d - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1));
  }
  var tMin = 1e9, tMax = -1e9;
  L.forEach(function (l) {
    var raw = l.optical.map(function (p) { return { t: decYear(p.date), a: p.area, d: p.date }; }).sort(function (a, b) { return a.t - b.t; });
    var k = l.opticalIsPipeline ? 5 : 0;       // only the dense pipeline series is smoothed; published points are shown as measured
    l._sm = raw.map(function (p, i) {
      if (!k) return p;
      var s = 0, n = 0;
      for (var j = -k; j <= k; j++) { var q = raw[i + j]; if (q) { s += q.a; n++; } }
      return { t: p.t, a: s / n, d: p.d };
    });
    l._sar = l.sar.map(function (p) { return { t: decYear(p.date), a: p.area }; });
    l._pub = l.published.map(function (p) { return { t: decYear(p.date), a: p.area }; });
    tMin = Math.min(tMin, l._sm[0].t); tMax = Math.max(tMax, l._sm[l._sm.length - 1].t);
  });
  function areaAt(l, t) {
    var s = l._sm;
    if (t <= s[0].t) return s[0].a;
    if (t >= s[s.length - 1].t) return s[s.length - 1].a;
    var lo = 0, hi = s.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (s[m].t <= t) lo = m; else hi = m; }
    return lerp(s[lo].a, s[hi].a, (t - s[lo].t) / (s[hi].t - s[lo].t));
  }
  function lastYear(l) { return Math.floor(l._sm[l._sm.length - 1].t); }

  /* ---------------------------------------------------- state --------- */
  var sel = 0, year = tMax, yaw = 0.3, pitch = 0.35;
  var playing = false, dispArea = 0, zone = -1, p = 0, userMode = null, tab = "trend", tabPrevRadar = false;
  var tops = [], radIdx = 0, radPlaying = 0, radTimer = null;

  var POSES = [
    { pos: [-62, 36, 96], look: [-34, 10, -6] },
    { pos: [8, 80, 122], look: [0, 5, -4] },
    { pos: [40, 50, 84], look: [16, 8, 0] },
    { pos: [0, 62, 98], look: [0, 6, -4] },
    null,
    { pos: [-30, 66, 108], look: [0, 6, -6] },
    { pos: [74, 46, 80], look: [44, 8, 0] }
  ];
  function lakePose() {
    var lk = world.lakes()[sel], gy = lk.floorY + lk.s;
    var r = 17 + lk.R * 1.7, h = 7 + lk.R * 0.8 + pitch * 14;
    var wide = window.innerWidth > 900, off = wide ? r * 0.36 : 0;
    var rx = Math.cos(yaw) * off, rz = -Math.sin(yaw) * off;
    var fx = wide ? 0 : Math.sin(yaw) * r * 0.42, fz = wide ? 0 : Math.cos(yaw) * r * 0.42;
    return { pos: [lk.x + Math.sin(yaw) * r + rx + fx, gy + h, lk.z + Math.cos(yaw) * r + rz + fz],
             look: [lk.x + rx + fx, gy + (wide ? 0.6 : -1.0), lk.z - 1.5 + rz + fz] };
  }
  function poseAt(i) { return i === 4 ? lakePose() : POSES[i]; }
  function mixPose(a, b, f) {
    return { pos: [lerp(a.pos[0], b.pos[0], f), lerp(a.pos[1], b.pos[1], f), lerp(a.pos[2], b.pos[2], f)],
             look: [lerp(a.look[0], b.look[0], f), lerp(a.look[1], b.look[1], f), lerp(a.look[2], b.look[2], f)] };
  }
  function cloudFor(pp) {
    if (pp < 2) return 0;
    if (pp < 3) return smooth(2.05, 2.8, pp);
    if (pp < 3.75) return 1;
    if (pp < 4) return 1 - smooth(3.75, 4.0, pp);
    return 0;
  }

  /* ----------------------------------------------- data status ---------- */
  function setupDataStatus() {
    var partial = D.dataLabel.indexOf("Partial") === 0;
    var f = $("#data-flag"); f.classList.toggle("partial", partial);
    $("#data-flag-text").textContent = D.dataLabel;
    $("#data-tip").textContent = D.dataNote;
    f.addEventListener("click", function () { var t = $("#data-tip"); t.hidden = !t.hidden; });
    $("#data-status").textContent = "Data status: " + D.dataLabel + ". " + D.dataNote;
  }

  /* ------------------------------------------ observation calendar ----- */
  var obsMonth = 8;
  function buildObs() {
    var cov = D.coverage, pub = cov.publishedPerMonth, nis = cov.nisarPerMonth || null;
    var mx = Math.max.apply(null, pub.concat(nis || []).concat([1]));
    var total = cov.publishedTotal, early = 0, i;
    for (i = 0; i < 8; i++) early += pub[i];
    $("#obs-intro").innerHTML = (early === 0
      ? "All <strong>" + total + "</strong> published measurements of these six lakes were made between September and December. <strong>Not one</strong> was made between January and August."
      : "Of <strong>" + total + "</strong> published measurements of these six lakes, <strong>" + (total - early) + "</strong> were made between September and December and " + early + " between January and August.") +
      " Optical satellites need clear sky, so the record has a hole exactly where the monsoon sits.";
    var host = $("#obs-bars"); host.innerHTML = "";
    for (i = 0; i < 12; i++) {
      var col = document.createElement("button");
      col.className = "obs-col" + (i >= 5 && i <= 8 ? " monsoon" : ""); col.dataset.m = i;
      col.setAttribute("aria-label", MONTH_FULL[i] + ": " + pub[i] + " published measurements");
      var h1 = pub[i] ? Math.max(6, pub[i] / mx * 100) : 0;
      var bars = '<div class="bars"><div class="bar' + (pub[i] ? "" : " zero") + '" style="height:' + (pub[i] ? h1 : 2) + '%;animation-delay:' + (i * 45) + 'ms"></div>';
      if (nis) bars += '<div class="bar sar' + (nis[i] ? "" : " zero") + '" style="height:' + (nis[i] ? Math.max(6, nis[i] / mx * 100) : 2) + '%;animation-delay:' + (i * 45 + 120) + 'ms"></div>';
      col.innerHTML = bars + "</div><span>" + MONTHS[i] + "</span>";
      col.addEventListener("click", function () { selectMonth(+this.dataset.m); });
      host.appendChild(col);
    }
    $("#obs-legend").innerHTML = '<span class="lg"><b class="dot fill"></b>Published optical measurements (Rounce et al. 2016)</span>' +
      (nis ? '<span class="lg"><b class="dia"></b>NISAR scenes processed by this project</span>'
           : '<span class="lg"><b class="dia"></b>NISAR observes every 12 days in every month (pipeline counts appear after the radar run)</span>') +
      '<span class="lg"><b style="border-color:#ffb94d"></b>Monsoon months</span>';
    selectMonth(8);
  }
  var SKY = [
    "Clear and cold, with deep snow. High lakes can be frozen, and the low sun throws long shadows over them.",
    "Clear and cold, with deep snow. High lakes can be frozen, and the low sun throws long shadows over them.",
    "Pre-monsoon. Snow still lies deep, and afternoon cloud starts to build over the high valleys.",
    "Pre-monsoon. Snow still lies deep, and afternoon cloud starts to build over the high valleys.",
    "Pre-monsoon. Cloud builds most afternoons, and the monsoon is close.",
    "The monsoon arrives. Cloud covers the high Himalaya on most days, so optical satellites mostly see white.",
    "Deep monsoon. This is when optical satellites are blindest and the glaciers are melting.",
    "Deep monsoon. This is when optical satellites are blindest and the glaciers are melting.",
    "The monsoon fades, but cloud still lingers early in the month.",
    "The post-monsoon window. Skies clear, which is why most published measurements fall in these weeks.",
    "The post-monsoon window. Skies are mostly clear, but days are getting short.",
    "Clear, but the days are short and high lakes begin to freeze."
  ];
  function selectMonth(m) {
    obsMonth = m;
    $$(".obs-col").forEach(function (c) { c.classList.toggle("active", +c.dataset.m === m); });
    var cov = D.coverage, n = cov.publishedPerMonth[m], mon = m >= 5 && m <= 8;
    var html = "<strong>" + MONTH_FULL[m] + "</strong>" + SKY[m] + "<br>" +
      '<span class="hl">Published optical measurements this month: ' + n + " of " + cov.publishedTotal + ".</span>";
    if (cov.nisarPerMonth) html += '<br><span class="hl amber">NISAR scenes processed this month: ' + cov.nisarPerMonth[m] + ".</span>";
    else html += '<br><span class="hl amber">NISAR: observes every 12 days, day or night, through cloud' + (mon ? ". Its best months are exactly these." : ".") + "</span>";
    $("#obs-card").innerHTML = html;
  }

  /* ----------------------------------------------------- chart --------- */
  var CW = 380, CH = 140, ML = 30, MR = 6, MT = 10, MB = 20, cursorG, ysFn;
  function xs(t) { return ML + (t - tMin) / (tMax - tMin) * (CW - ML - MR); }
  function drawChart() {
    var l = L[sel], sm = l._sm, i, amin = Infinity, amax = -Infinity;
    function ext(a) { amin = Math.min(amin, a); amax = Math.max(amax, a); }
    sm.forEach(function (q) { ext(q.a * 0.9); ext(q.a * 1.1); });
    amin = Math.max(0, amin * 0.97); amax = amax * 1.03;
    function ys(a) { return MT + (1 - (a - amin) / (amax - amin)) * (CH - MT - MB); }
    ysFn = ys;
    var step = Math.max(1, Math.floor(sm.length / 120)), pts = [], d = "";
    for (i = 0; i < sm.length; i += step) pts.push(sm[i]);
    if (pts[pts.length - 1] !== sm[sm.length - 1]) pts.push(sm[sm.length - 1]);
    pts.forEach(function (q, k) { d += (k ? "L" : "M") + xs(q.t).toFixed(1) + " " + ys(q.a).toFixed(1); });
    var area = d + "L" + xs(pts[pts.length - 1].t).toFixed(1) + " " + (CH - MB) + "L" + xs(pts[0].t).toFixed(1) + " " + (CH - MB) + "Z";
    var grid = "", labels = "";
    for (var yv = Math.ceil(tMin / 5) * 5; yv <= tMax; yv += 5) {
      grid += '<line x1="' + xs(yv) + '" x2="' + xs(yv) + '" y1="' + MT + '" y2="' + (CH - MB) + '" stroke="rgba(238,241,246,.07)"/>';
      labels += '<text x="' + xs(yv) + '" y="' + (CH - 5) + '" text-anchor="middle" fill="#6f84a3" font-family="JetBrains Mono" font-size="9">' + yv + "</text>";
    }
    labels += '<text x="2" y="' + (MT + 8) + '" fill="#6f84a3" font-family="JetBrains Mono" font-size="9">' + amax.toFixed(1) + "</text>";
    labels += '<text x="2" y="' + (CH - MB) + '" fill="#6f84a3" font-family="JetBrains Mono" font-size="9">' + amin.toFixed(1) + "</text>";

    // published points with their own ~10% error bars: the line itself when published, a reference overlay when the pipeline has run
    var pubSet = l.opticalIsPipeline ? l._pub : sm, pub = "";
    pubSet.forEach(function (q) {
      if (q.t < tMin || q.t > tMax) return;
      var x = xs(q.t), y = ys(q.a);
      pub += '<line x1="' + x + '" x2="' + x + '" y1="' + ys(q.a * 1.1) + '" y2="' + ys(q.a * 0.9) + '" stroke="rgba(238,241,246,.4)" stroke-width="1"/>' +
             '<circle cx="' + x + '" cy="' + y + '" r="2.6" fill="' + (l.opticalIsPipeline ? "#06101f" : "#4fe3d0") + '" stroke="#4fe3d0" stroke-width="1.4"/>';
    });
    var sar = l._sar.map(function (q) {
      var x = xs(q.t), y = ys(q.a);
      return '<path d="M' + x + " " + (y - 4.5) + "l4.5 4.5l-4.5 4.5l-4.5 -4.5z" + '" fill="#ffb94d"/>';
    }).join("");
    chart.innerHTML = '<svg viewBox="0 0 ' + CW + " " + CH + '" preserveAspectRatio="none" role="img" aria-label="Lake area over time">' +
      '<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fe3d0" stop-opacity=".3"/><stop offset="1" stop-color="#4fe3d0" stop-opacity="0"/></linearGradient></defs>' +
      grid + '<path id="c-area" d="' + area + '" fill="url(#ag)" style="opacity:0;transition:opacity 1s .4s"/>' +
      '<path id="c-line" d="' + d + '" pathLength="1" fill="none" stroke="#4fe3d0" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" style="stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1.3s cubic-bezier(.2,.7,.1,1)"/>' +
      pub + sar + labels +
      '<g id="c-cur"><line y1="' + MT + '" y2="' + (CH - MB) + '" stroke="#eef1f6" stroke-opacity=".5" stroke-dasharray="2 3"/><circle r="4.5" fill="#06101f" stroke="#eef1f6" stroke-width="2"/></g></svg>';
    cursorG = $("#c-cur", chart);
    requestAnimationFrame(function () { var ln = $("#c-line", chart), ar = $("#c-area", chart); if (ln) ln.style.strokeDashoffset = 0; if (ar) ar.style.opacity = 1; });
    $("#chart-legend").innerHTML = l.opticalIsPipeline
      ? '<span class="lg"><b></b>Landsat (this project)</span><span class="lg"><b class="dot"></b>Published, with ~10% error</span>' + (l._sar.length ? '<span class="lg"><b class="dia"></b>NISAR</span>' : "")
      : '<span class="lg"><b class="dot fill"></b>Published measurements</span><span class="lg"><b class="err"></b>~10% error</span><span class="lg">Rounce et al. 2016</span>';
    moveCursor();
  }
  function moveCursor() {
    if (!cursorG || !ysFn) return;
    var x = xs(clamp(year, tMin, tMax)), y = ysFn(areaAt(L[sel], year));
    cursorG.setAttribute("transform", "translate(" + x.toFixed(1) + " 0)");
    $("circle", cursorG).setAttribute("cy", y.toFixed(1));
  }

  /* -------------------------------------------------------- HUD -------- */
  var hud = $("#hud"), chart = $("#chart"), yearEl = $("#year"), tagsEl = $("#tags"), chipsEl = $("#chips"), tagEls = [];
  function buildChipsAndTags() {
    L.forEach(function (l, i) {
      var c = document.createElement("button");
      c.className = "chip"; c.setAttribute("role", "tab"); c.style.setProperty("--c", l.riskColor);
      c.innerHTML = "<i></i>" + esc(sname(l)) + "<small>" + String(i + 1).padStart(2, "0") + "</small>";
      c.addEventListener("click", function () { selectLake(i); });
      chipsEl.appendChild(c);
      var t = document.createElement("div");
      t.className = "tag"; t.style.setProperty("--c", l.riskColor); t.innerHTML = "<i></i>" + esc(sname(l));
      t.addEventListener("click", function () { selectLake(i); $("#lakes").scrollIntoView({ behavior: "smooth" }); });
      tagsEl.appendChild(t); tagEls.push(t);
    });
  }

  function fillExposure() {
    var l = L[sel], e = l.exposure || {}, h = "";
    if (e.places && e.places.length) h += '<div class="expo-block"><h4>Places downstream</h4><div class="pills">' + e.places.map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + "</div>" + (e.places_note ? "<p style='margin-top:6px'>" + esc(e.places_note) + "</p>" : "") + "</div>";
    else h += '<div class="expo-block"><h4>Places downstream</h4><p>' + esc(e.places_note || "Not yet mapped by us.") + "</p></div>";
    if (e.infrastructure && e.infrastructure.length) h += '<div class="expo-block"><h4>Infrastructure on the same river system</h4><ul>' + e.infrastructure.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
    if (e.households) h += '<div class="expo-block"><h4>People</h4><p>' + esc(e.households) + "</p></div>";
    h += '<div class="expo-block"><h4>Mitigation record</h4><p>' + esc(e.mitigation || "None recorded in the sources we used.") + "</p></div>";
    h += '<div class="next-box"><strong>Not a flood forecast.</strong> This tab lists public facts only. Travel times and flood depths need a flood model built on terrain data and breach scenarios, run with the authorities responsible. That is the logical next step, and nothing here claims to be it.</div>';
    $("#hud-panel-exposure").innerHTML = h;
  }

  function fillHud() {
    var l = L[sel], ly = lastYear(l);
    $("#hud-idx").textContent = String(sel + 1).padStart(2, "0") + " / " + String(L.length).padStart(2, "0");
    $("#hud-name").textContent = sname(l);
    var b = $("#hud-badge"); b.style.setProperty("--c", l.riskColor); $("b", b).textContent = l.riskTier + " risk";
    $("#hud-loc").textContent = l.district + ", " + l.altitude_m.toLocaleString() + " m";
    $("#hud-basis").textContent = l.riskBasis;
    $("#hud-ctx").textContent = l.context; $("#hud-key").textContent = l.keyStat;
    $("#lab-3").textContent = "3 yr to " + ly; $("#lab-5").textContent = "5 yr to " + ly;
    $("#ro-3").textContent = pct(l.change3yrPct); $("#ro-5").textContent = pct(l.change5yrPct);
    $$(".chip").forEach(function (c, i) { c.classList.toggle("on", i === sel); c.style.setProperty("--c", L[i].riskColor); c.setAttribute("aria-selected", i === sel); });
    tagEls.forEach(function (t, i) { t.classList.toggle("sel", i === sel); });
    drawChart(); fillExposure(); loadRadar();
  }
  function selectLake(i, instant) {
    if (i === sel && !instant) return;
    sel = i; world.setSelected(i); yaw = 0.3; pitch = 0.35;
    if (instant) { fillHud(); return; }
    hud.classList.add("swap");
    setTimeout(function () { fillHud(); hud.classList.remove("swap"); }, 190);
  }
  function applyYear() {
    world.setRatios(world.lakes().map(function (lk, i) { return clamp(areaAt(L[i], year) / lk.areaMax, 0.12, 1.04); }));
    $("#ro-year").textContent = Math.floor(year);
    yearEl.style.setProperty("--p", ((year - tMin) / (tMax - tMin) * 100).toFixed(1) + "%");
    moveCursor();
  }

  /* ------------------------------------------------------- tabs -------- */
  function setTab(name) {
    if (name === tab) return;
    var leavingRadar = tab === "radar";
    tab = name;
    $$(".hud-tab").forEach(function (b) { var on = b.dataset.tab === name; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
    ["trend", "radar", "exposure"].forEach(function (n) { $("#hud-panel-" + n).hidden = n !== name; });
    if (name === "radar") { tabPrevRadar = world.isRadar(); world.setRadar(true); userMode = true; syncSeg(); }
    else if (leavingRadar && !tabPrevRadar) { world.setRadar(false); userMode = false; syncSeg(); }
    if (name !== "radar") stopRadar();
  }
  $$(".hud-tab").forEach(function (b) { b.addEventListener("click", function () { setTab(b.dataset.tab); }); });

  /* ------------------------------------------------ radar viewer ------- */
  function scenes() { return RAD[L[sel].id] || []; }
  function loadRadar() {
    stopRadar(); radIdx = Math.max(0, scenes().length - 1);
    var sc = scenes(), has = sc.length > 0;
    $("#radar-empty").style.display = has ? "none" : "grid";
    $("#radar-img").hidden = !has; $("#radar-mask").hidden = !has;
    $("#radar-range").max = Math.max(0, sc.length - 1); $("#radar-range").disabled = !has; $("#radar-play").disabled = !has;
    if (!has) {
      $("#radar-empty").innerHTML = "<span>No radar scenes for this lake yet.<br>NISAR has published dozens of calibrated scenes over these lakes since June 2026. They appear here as soon as the radar pipeline has processed them.</span>";
      $("#radar-date").textContent = "No scene"; $("#radar-area").textContent = "";
      $("#radar-note").textContent = "Dark pixels mean low radar backscatter, which is how calm water looks to NISAR."; return;
    }
    showRadar(radIdx);
  }
  function showRadar(i) {
    var s = scenes()[i]; if (!s) return; radIdx = i;
    $("#radar-range").value = i;
    $("#radar-img").src = s.i || (s.f + ".png"); $("#radar-mask").src = s.m || (s.f + "_mask.png");
    $("#radar-date").textContent = s.d + "   (" + (i + 1) + " of " + scenes().length + ")";
    $("#radar-area").textContent = s.ok ? s.a.toFixed(2) + " km²" : s.a.toFixed(2) + " km² (excluded: " + (s.flag || "quality check") + ")";
    $("#radar-note").textContent = "Dark pixels mean low backscatter: calm water. The cyan outline is the single water patch our method measured. Scenes that failed a quality check are shown but left out of the growth chart.";
  }
  function stopRadar() { if (radTimer) { clearInterval(radTimer); radTimer = null; } $("#radar-play").classList.remove("on"); }
  $("#radar-range").addEventListener("input", function () { stopRadar(); showRadar(+this.value); });
  $("#radar-play").addEventListener("click", function () {
    if (radTimer) { stopRadar(); return; }
    var n = scenes().length; if (!n) return;
    if (radIdx >= n - 1) radIdx = -1;
    this.classList.add("on");
    radTimer = setInterval(function () { radIdx++; if (radIdx >= n) { stopRadar(); radIdx = n - 1; return; } showRadar(radIdx); }, 520);
  });
  $("#radar-img").addEventListener("error", function () { $("#radar-note").textContent = "This scene image is not in this build. Open the site folder version (or rebuild with --inline-radar) to see radar images."; });
  $("#sw-outline").addEventListener("change", function () { $("#radar-stage").classList.toggle("no-outline", !this.checked); });

  /* ------------------------------------------------ mode + clouds ------ */
  var seg = $("#mode-seg"), swMonsoon = $("#sw-monsoon");
  function syncSeg() {
    var r = world.isRadar(); seg.dataset.mode = r ? "radar" : "optical";
    $$("button", seg).forEach(function (b) { b.classList.toggle("on", (b.dataset.mode === "radar") === r); });
  }
  seg.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; userMode = b.dataset.mode === "radar"; world.setRadar(userMode); syncSeg(); });
  $("#scan-btn").addEventListener("click", function () { world.setRadar(false, true); setTimeout(function () { world.setRadar(true); syncSeg(); }, 60); });

  /* --------------------------------------------------- frame loop ------ */
  function measure() {
    tops = ["hero", "stakes", "monsoon", "radar", "lakes", "method", "footer"].map(function (id) { return document.getElementById(id).getBoundingClientRect().top + window.scrollY; });
  }
  function onFrame(dt) {
    var y = window.scrollY + window.innerHeight * 0.5, i = 0;
    while (i < tops.length - 1 && y >= tops[i + 1]) i++;
    var span = i < tops.length - 1 ? tops[i + 1] - tops[i] : 1;
    var frac = i < tops.length - 1 ? clamp((y - tops[i]) / span, 0, 1) : 0;
    p = i + frac;
    var a = poseAt(i), pose = i < tops.length - 1 ? mixPose(a, poseAt(i + 1), smooth(0.4, 0.97, frac)) : a;
    world.setPose(pose.pos, pose.look);

    var cl = cloudFor(p); if (p >= 3.9 && swMonsoon.checked) cl = 1;
    world.setClouds(cl);
    world.setMarkers(smooth(0.5, 1.2, p) * (1 - 0.6 * smooth(5.3, 6.0, p)));

    var z = p < 2.8 ? 0 : p < 3.9 ? 1 : 2;
    if (z !== zone) {
      zone = z;
      if (z === 1) { world.setRadar(true); userMode = null; }
      else if (z === 0) { world.setRadar(false); userMode = null; }
      else if (userMode === null) { world.setRadar(false); }
      syncSeg();
    }

    var showTags = p > 2.95 && p < 5.3;   // not over the monsoon calendar
    for (var k = 0; k < tagEls.length; k++) {
      var pr = world.project(k, 2.2), el = tagEls[k];
      var ok = showTags && pr.visible && pr.x > 20 && pr.x < window.innerWidth - 20 && pr.y > 70 && pr.y < (window.innerWidth < 900 && p > 3.6 ? window.innerHeight * 0.36 : window.innerHeight - 20);
      el.classList.toggle("show", ok);
      if (ok) el.style.transform = "translate(" + pr.x.toFixed(1) + "px," + pr.y.toFixed(1) + "px) translate(-50%,-135%)";
    }
    if (playing) {
      year += dt * ((tMax - tMin) / 9);
      if (year >= tMax) { year = tMax; playing = false; $("#play").classList.remove("on"); }
      yearEl.value = year; applyYear();
    }
    dispArea += (areaAt(L[sel], year) - dispArea) * (1 - Math.exp(-dt * 9));
    $("#ro-area").textContent = dispArea.toFixed(2);
    $("#nav").classList.toggle("scrolled", window.scrollY > 40);
    var ri = Math.round(clamp(p, 0, 5));
    $$("#rail a").forEach(function (e, n) { e.classList.toggle("on", n === ri); });
    $("#drag-hint").style.opacity = ui._dragged ? 0 : 1;
    var note = $("#sense");
    note.textContent = swMonsoon.checked && p >= 3.9 ? (world.isRadar() ? "Radar view: NISAR still measures this lake through the cloud." : "Optical view: the monsoon hides this lake from the satellite.") : "";
  }

  /* ------------------------------------------------------ chat --------- */
  function setupChat() {
    SC.chat.init(D, function () { return { lake: L[sel].id, tab: tab, year: Math.floor(year) }; }, {
      sheet: function (id) { buildSheet(indexOf(id)); $("#sheet-modal").hidden = false; },
      brief: function () { buildBrief(); $("#sheet-modal").hidden = false; },
      csv: function (id) { downloadCsv(indexOf(id)); },
      lake: function (id) { selectLake(indexOf(id)); $("#lakes").scrollIntoView({ behavior: "smooth" }); if (window.innerWidth < 900) SC.chat.close(); }
    });
  }
  function indexOf(id) { for (var i = 0; i < L.length; i++) if (L[i].id === id) return i; return 0; }
  function downloadCsv(i) {
    var l = L[i], rows = ["date,area_km2,source"];
    l.optical.forEach(function (p) { rows.push(p.date + "," + p.area + "," + (l.opticalIsPipeline ? "Landsat (SAR Cosmos pipeline)" : "Published (Rounce et al. 2016)")); });
    l.sar.forEach(function (p) { rows.push(p.date + "," + p.area + ",NISAR L-band (SAR Cosmos pipeline)"); });
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.join("\n") + "\n"], { type: "text/csv" }));
    a.download = "sar-cosmos-" + l.id + ".csv"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ------------------------------------------------- fact sheet ------- */
  function buildSheet(idx) {
    var l = L[idx == null ? sel : idx], ly = lastYear(l), first = l._sm[0], last = l._sm[l._sm.length - 1];
    var overall = (last.a - first.a) / first.a * 100, e = l.exposure || {};
    var rows = (l.opticalIsPipeline ? l.optical.filter(function (_, i, a) { return i % Math.ceil(a.length / 20) === 0; }) : l.optical)
      .map(function (p) { return "<tr><td>" + esc(p.date) + "</td><td>" + p.area.toFixed(3) + "</td><td>" + (l.opticalIsPipeline ? "Landsat (this project)" : "Rounce et al. 2016") + "</td></tr>"; }).join("");
    var srows = l.sar.length ? l.sar.map(function (p) { return "<tr><td>" + esc(p.date) + "</td><td>" + p.area.toFixed(3) + "</td><td>NISAR L-band (this project)</td></tr>"; }).join("") : "";
    var refs = D.references.map(function (r) { return "<li>" + esc(r.text) + "</li>"; }).join("");
    $("#sheet").innerHTML =
      '<header><img src="assets/logo-256.webp" alt=""><div><h1>' + esc(sname(l)) + '</h1><div class="sub">SAR Cosmos lake fact sheet, generated ' + esc(D.generatedAt) + "</div></div></header>" +
      "<h2>Summary</h2><p>" + esc(l.district) + " district, " + esc(l.basin) + ", about " + l.altitude_m.toLocaleString() + " m. " + esc(l.context) + "</p>" +
      "<table><tr><th>First measurement</th><td>" + first.a.toFixed(2) + " km² (" + esc(first.d) + ")</td></tr>" +
      "<tr><th>Latest measurement</th><td>" + last.a.toFixed(2) + " km² (" + esc(last.d) + ")</td></tr>" +
      "<tr><th>Change over the record</th><td>" + pct(overall) + "</td></tr>" +
      "<tr><th>Last 5 years of record</th><td>" + pct(l.change5yrPct) + " (to " + ly + ")</td></tr>" +
      '<tr><th>Growth tier</th><td><span class="tier" style="background:' + esc(l.riskColor) + '">' + esc(l.riskTier) + "</span> " + esc(l.riskBasis) + "</td></tr></table>" +
      '<div class="box">The tier is a plain rule on five-year growth in area (under 10% Low, under 25% Moderate, under 40% High, above that Critical). It describes how fast the lake is growing. It is not the probability of a flood.</div>' +
      "<h2>Downstream (public facts only)</h2><p>" + esc((e.places && e.places.length ? "Places: " + e.places.join(", ") + ". " : e.places_note + " ")) + esc(e.infrastructure && e.infrastructure.length ? "Infrastructure: " + e.infrastructure.join("; ") + ". " : "") + esc(e.households || "") + "</p><p>Mitigation: " + esc(e.mitigation || "none recorded in the sources used.") + "</p>" +
      "<h2>Measurements used</h2><table><tr><th>Date</th><th>Area (km²)</th><th>Source</th></tr>" + rows + srows + "</table>" +
      "<h2>Data provenance</h2><p>" + esc(D.dataLabel) + ". " + esc(D.dataNote) + " Published areas carry about 10% error of their own.</p>" +
      '<div class="box"><strong>Limits.</strong> This sheet measures lake size and growth. It does not forecast outbursts, flood arrival times, flood depths or evacuation needs; those require flood modelling and the authorities responsible (in Nepal, the Department of Hydrology and Meteorology).</div>' +
      "<h2>Sources</h2><ol>" + refs + "</ol>";
  }
  function buildBrief() {
    var rows = L.map(function (l) {
      var last = l._sm[l._sm.length - 1];
      return "<tr><td>" + esc(sname(l)) + '</td><td><span class="tier" style="background:' + esc(l.riskColor) + '">' + esc(l.riskTier) + "</span></td><td>" + last.a.toFixed(2) + " km² (" + esc(last.d.slice(0, 4)) + ")</td><td>" + pct(l.change5yrPct) + "</td><td>" + (l.opticalIsPipeline ? "Landsat pipeline" : "Published") + (l._sar.length ? " + NISAR" : "") + "</td></tr>";
    }).join("");
    $("#sheet").innerHTML =
      '<header><img src="assets/logo-256.webp" alt=""><div><h1>SAR Cosmos</h1><div class="sub">One-page project brief, generated ' + esc(D.generatedAt) + "</div></div></header>" +
      "<h2>What it is</h2><p>A 3D, interactive look at six dangerous Himalayan glacial lakes: how big each has been, how fast it is growing, and why NISAR radar can keep measuring lakes through the monsoon when optical satellites cannot. Built by Shivam, Aarambh and Saurav for NASA Space Apps 2026 (challenge: Dancing with the SARs), Bhaktapur.</p>" +
      "<h2>The problem</h2><p>A 2011 ICIMOD study counted 21 critically dangerous glacial lakes in Nepal and found proper mitigation at only two. A 2020 ICIMOD and UNDP report counted 26 glacial lake outburst floods since 1977, 14 starting inside Nepal.</p>" +
      "<h2>The six lakes</h2><table><tr><th>Lake</th><th>Growth tier</th><th>Latest area</th><th>5-year change</th><th>Data</th></tr>" + rows + "</table>" +
      '<div class="box">Tiers are the team\'s own rule on five-year growth (under 10% Low, under 25% Moderate, under 40% High, above that Critical). They describe growth, not the probability of a flood.</div>' +
      "<h2>Method</h2><p>Optical: NDWI from Landsat, threshold chosen per image, only the water patch containing the lake. Radar: NISAR L-band backscatter, same patch rule, because radar shadow is dark too. Validation chains optical vs published areas and radar vs optical within 14 days.</p>" +
      "<h2>Data status</h2><p>" + esc(D.dataLabel) + ". " + esc(D.dataNote) + "</p>" +
      '<div class="box"><strong>Limits.</strong> This project measures lake size and growth. It does not forecast outbursts, flood arrival times or evacuation needs. Published areas carry about 10% error; NISAR calibrated data covers one season so far.</div>' +
      "<h2>Sources</h2><ol>" + D.references.map(function (r) { return "<li>" + esc(r.text) + "</li>"; }).join("") + "</ol>";
  }
  function setupSheet() {
    var m = $("#sheet-modal");
    $("#sheet-btn").addEventListener("click", function () { buildSheet(); m.hidden = false; });
    $("#sheet-close").addEventListener("click", function () { m.hidden = true; });
    $("#sheet-print").addEventListener("click", function () { window.print(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !m.hidden) m.hidden = true; });
    ui.openSheet = function () { buildSheet(); m.hidden = false; };
  }

  /* ----------------------------------------------- reveals + fx -------- */
  function splitWords() {
    $$(".split").forEach(function (h) {
      var words = h.textContent.trim().split(/\s+/); h.setAttribute("aria-label", h.textContent.trim());
      h.innerHTML = words.map(function (w, n) { return '<span class="w" aria-hidden="true"><span style="transition-delay:' + (n * 55) + 'ms">' + w + "</span></span>"; }).join(" ");
    });
  }
  function countUp(el) {
    var to = +el.dataset.to, t0 = performance.now(), dur = 1500;
    (function tick(now) { var k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e).toLocaleString("en-US"); if (k < 1) requestAnimationFrame(tick); })(t0);
  }
  function setupReveals() {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, sibs = el.parentElement ? $$(".reveal", el.parentElement) : [];
        el.style.transitionDelay = (Math.max(0, sibs.indexOf(el)) * 90) + "ms"; el.classList.add("in");
        $$(".count", el).forEach(function (c) { if (!c._done) { c._done = 1; setTimeout(function () { countUp(c); }, 250); } });
        io.unobserve(el);
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    $$(".reveal, .split").forEach(function (el) { io.observe(el); });
  }
  function setupTilt() {
    if (!fine) return;
    $$(".tilt").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty("--ry", ((x - 0.5) * 9).toFixed(2) + "deg"); el.style.setProperty("--rx", ((0.5 - y) * 7).toFixed(2) + "deg");
        el.style.setProperty("--mx", (x * 100) + "%"); el.style.setProperty("--my", (y * 100) + "%");
      });
      el.addEventListener("pointerleave", function () { el.style.setProperty("--ry", "0deg"); el.style.setProperty("--rx", "0deg"); });
    });
    $$(".btn-solid").forEach(function (b) {
      b.addEventListener("pointermove", function (e) { var r = b.getBoundingClientRect(); b.style.transform = "translate(" + ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + "px," + ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + "px)"; });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }
  function setupCursor() {
    if (!fine) return;
    var c = $("#cursor");
    window.addEventListener("pointermove", function (e) {
      c.classList.add("on"); c.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)";
      world.setPointer((e.clientX / window.innerWidth - 0.5) * 2, (e.clientY / window.innerHeight - 0.5) * 2);
      c.classList.toggle("big", !!e.target.closest("a,button,.chip,.tag,#orbit-zone,input,.tilt,.obs-col"));
    });
    document.addEventListener("pointerleave", function () { c.classList.remove("on"); });
  }
  function setupOrbit() {
    var z = $("#orbit-zone"), drag = null;
    z.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY }; z.classList.add("drag"); z.setPointerCapture(e.pointerId); });
    z.addEventListener("pointermove", function (e) { if (!drag) return; yaw -= (e.clientX - drag.x) * 0.0065; pitch = clamp(pitch + (e.clientY - drag.y) * 0.004, -0.15, 1.1); drag.x = e.clientX; drag.y = e.clientY; ui._dragged = true; });
    function end() { drag = null; z.classList.remove("drag"); }
    z.addEventListener("pointerup", end); z.addEventListener("pointercancel", end);
  }
  function setupLightbox() {
    var lb = $("#lightbox"), img = $("img", lb);
    function open() { lb.hidden = false; requestAnimationFrame(function () { lb.classList.add("open"); }); }
    function close() { lb.classList.remove("open"); setTimeout(function () { lb.hidden = true; }, 400); }
    ["#logo-btn", "#logo-btn-2"].forEach(function (s) { $(s).addEventListener("click", open); });
    lb.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !lb.hidden) close(); });
    lb.addEventListener("pointermove", function (e) { img.style.setProperty("--ry", ((e.clientX / window.innerWidth - 0.5) * 24).toFixed(1) + "deg"); img.style.setProperty("--rx", ((0.5 - e.clientY / window.innerHeight) * 18).toFixed(1) + "deg"); });
  }

  /* ------------------------------------------------------ boot --------- */
  function boot() {
    var bar = $("#pre-bar"); bar.style.width = "35%";
    splitWords(); buildChipsAndTags(); setupDataStatus(); buildObs();
    var ok = true;
    try { world.init($("#gl"), D); } catch (e) { ok = false; console.error(e); document.body.classList.add("no-gl"); }
    bar.style.width = "100%"; measure();
    window.addEventListener("resize", measure); window.addEventListener("load", measure);
    yearEl.min = tMin.toFixed(2); yearEl.max = tMax.toFixed(2); yearEl.value = tMax;
    yearEl.addEventListener("input", function () { year = +yearEl.value; playing = false; $("#play").classList.remove("on"); applyYear(); });
    $("#play").addEventListener("click", function () { if (playing) { playing = false; this.classList.remove("on"); return; } if (year >= tMax - 0.05) year = tMin; playing = true; this.classList.add("on"); });
    selectLake(0, true); dispArea = areaAt(L[0], year); applyYear();
    if (ok) { world.setRatios(world.lakes().map(function () { return 1; }), true); applyYear(); world.frameCallbacks.push(onFrame); }
    setupReveals(); setupTilt(); setupCursor(); setupOrbit(); setupLightbox(); setupChat(); setupSheet();

    // deep-link / test hooks:  ?s=lakes&lake=3&tab=radar&month=7&year=2005&radar=1&cloud=1&ask=1&sheet=1
    var q = new URLSearchParams(location.search);
    if (q.get("lake")) selectLake(+q.get("lake"), true);
    if (q.get("year")) { year = +q.get("year"); yearEl.value = year; applyYear(); }
    if (q.get("yaw")) yaw = +q.get("yaw");
    if (q.get("pitch")) pitch = +q.get("pitch");
    if (q.get("cloud")) swMonsoon.checked = true;
    if (q.get("month")) selectMonth(+q.get("month"));
    var sid = q.get("s");
    setTimeout(function () {
      document.body.classList.remove("is-loading");
      if (sid) {
        measure();
        var el = document.getElementById(sid);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + (+q.get("off") || 0), behavior: "instant" });
        if (ok) { onFrame(0.016, 0); var pose = snapPose(); world.setPose(pose.pos, pose.look, true); }
        if (q.get("wipe")) world.setWipe(+q.get("wipe"));
        if (q.get("radar")) { world.setRadar(true, true); userMode = true; syncSeg(); }
        if (q.get("snap")) { world.setClouds(swMonsoon.checked ? 1 : cloudFor(p), true); world.setMarkers(smooth(0.5, 1.2, p), true); }
      }
      if (q.get("tab")) setTab(q.get("tab"));
      if (q.get("ask")) { SC.chat.open(); if (q.get("q")) SC.chat.ask(q.get("q")); }
      if (q.get("sheet")) ui.openSheet();
      window.__ready = true;
    }, q.get("fast") ? 50 : 1500);
  }
  function snapPose() {
    var y = window.scrollY + window.innerHeight * 0.5, i = 0;
    while (i < tops.length - 1 && y >= tops[i + 1]) i++;
    var span = i < tops.length - 1 ? tops[i + 1] - tops[i] : 1, frac = i < tops.length - 1 ? clamp((y - tops[i]) / span, 0, 1) : 0;
    var a = poseAt(i); return i < tops.length - 1 ? mixPose(a, poseAt(i + 1), smooth(0.4, 0.97, frac)) : a;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 60); });
  else setTimeout(boot, 60);
})();
