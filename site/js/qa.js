/* "Ask the data": a small rule-based question answerer.
   It is NOT an AI model and says so on screen. Every number in an answer is computed
   from window.SAR_COSMOS_DATA at the moment you ask, so it can never drift from the charts.
   Pure functions, so it also runs in Node for testing. */
(function (root) {
  "use strict";
  var SC = (root.SC = root.SC || {});

  var KEYS = { imja_tsho: ["imja"], tsho_rolpa: ["rolpa"], thulagi: ["thulagi", "dona"],
               lower_barun: ["barun"], lumding: ["lumding"], hongu: ["hongu", "chamlang"] };

  function norm(s) { return (" " + String(s).toLowerCase().replace(/[^a-z0-9.%\s-]/g, " ") + " ").replace(/\s+/g, " "); }
  function has(q, words) { for (var i = 0; i < words.length; i++) if (q.indexOf(words[i]) !== -1) return true; return false; }
  function f2(v) { return v == null ? "n/a" : v.toFixed(2); }
  function pct(v) { return v == null ? "n/a" : (v > 0 ? "+" : "") + v.toFixed(1) + "%"; }
  function year(d) { return String(d || "").slice(0, 4); }
  function short(l) { return l.name.replace(/ \(.*\)/, ""); }

  function findLake(q, D) {
    for (var i = 0; i < D.lakes.length; i++) {
      var ks = KEYS[D.lakes[i].id] || [D.lakes[i].name.toLowerCase()];
      if (has(q, ks)) return D.lakes[i];
    }
    return null;
  }

  function overall(l) {
    var s = l.optical;
    if (!s || s.length < 2) return null;
    var a = s[0], b = s[s.length - 1];
    return { from: a, to: b, pct: 100 * (b.area - a.area) / a.area };
  }
  function srcWord(l) { return l.opticalIsPipeline ? "from the project's Landsat pipeline" : "from published measurements (Rounce et al. 2016, about 10% error)"; }

  function lakeAnswer(q, l) {
    var ov = overall(l), t = [];
    if (has(q, ["downstream", "village", "hydro", "people", "household", "exposure", "mitigat", "who lives", "dam"])) {
      var e = l.exposure || {};
      t.push("<strong>" + short(l) + ": what lies downstream</strong> (public facts, not a model)");
      if (e.places && e.places.length) t.push("Places: " + e.places.join(", ") + ".");
      if (e.infrastructure && e.infrastructure.length) t.push("Infrastructure: " + e.infrastructure.join("; ") + ".");
      if (e.households) t.push(e.households);
      if (e.mitigation) t.push("Mitigation: " + e.mitigation);
      if (e.places_note && (!e.places || !e.places.length)) t.push(e.places_note);
      return t.join("<br>");
    }
    if (has(q, ["risk", "tier", "danger", "safe", "hazard"])) {
      return "<strong>" + short(l) + ": " + l.riskTier + " risk.</strong> " + l.riskBasis + ": " + pct(l.change5yrPct) +
             ". The tiers are our own plain rule (under 10% Low, under 25% Moderate, under 40% High, above that Critical). They describe growth, not the chance of a flood.";
    }
    if (has(q, ["grow", "change", "expand", "trend", "bigger", "shrink", "faster", "rate"])) {
      return "<strong>" + short(l) + " growth</strong> " + srcWord(l) + ":<br>" +
             (ov ? f2(ov.from.area) + " km² in " + year(ov.from.date) + " to " + f2(ov.to.area) + " km² in " + year(ov.to.date) + " (" + pct(ov.pct) + " overall).<br>" : "") +
             "Last 5 years of the record: " + pct(l.change5yrPct) + ". Last 3 years: " + pct(l.change3yrPct) + ".";
    }
    if (has(q, ["area", "size", "big", "large", "km"])) {
      return "<strong>" + short(l) + "</strong> covered " + f2(l.latestAreaKm2) + " km² in " + year(l.latestDate) + " " + srcWord(l) + ".";
    }
    t.push("<strong>" + short(l) + "</strong> (" + l.district + ", about " + l.altitude_m.toLocaleString() + " m). " + l.context);
    t.push("Area " + f2(l.latestAreaKm2) + " km² in " + year(l.latestDate) + "; " + l.riskTier + " risk by our growth rule (" + pct(l.change5yrPct) + " over 5 years).");
    t.push(l.keyStat);
    return t.join("<br>");
  }

  function rank(q, D) {
    var L = D.lakes.slice();
    if (has(q, ["large", "big"])) {
      L.sort(function (a, b) { return b.latestAreaKm2 - a.latestAreaKm2; });
      return "<strong>Largest lakes</strong> (latest area):<br>" + L.map(function (l, i) { return (i + 1) + ". " + short(l) + ": " + f2(l.latestAreaKm2) + " km² (" + year(l.latestDate) + ")"; }).join("<br>");
    }
    if (has(q, ["risk", "danger"])) {
      var order = ["Critical", "High", "Moderate", "Low"];
      L.sort(function (a, b) { return order.indexOf(a.riskTier) - order.indexOf(b.riskTier) || (b.change5yrPct || 0) - (a.change5yrPct || 0); });
      return "<strong>Risk tiers</strong> (our growth rule):<br>" + L.map(function (l) { return short(l) + ": " + l.riskTier + " (" + pct(l.change5yrPct) + ")"; }).join("<br>");
    }
    L.sort(function (a, b) { return (b.change5yrPct || -99) - (a.change5yrPct || -99); });
    return "<strong>Fastest growing</strong> (5-year change at the end of each record):<br>" +
           L.map(function (l, i) { return (i + 1) + ". " + short(l) + ": " + pct(l.change5yrPct) + " (to " + year(l.latestDate) + ")"; }).join("<br>");
  }

  var FORECAST = ["forecast", "predict", "evacuat", "arriv", "when will", "burst", "warning", "minutes", "how soon", "how long until", "will it flood", "flood time"];
  var LIMITS = "<strong>I can't tell you that, and neither can this site.</strong> SAR Cosmos measures how big each lake is and how fast it is growing from satellites. " +
               "Flood arrival times and evacuation advice need a flood model built on terrain data and breach scenarios, run with the authorities responsible (in Nepal, the Department of Hydrology and Meteorology).";

  var HELP = "I can answer from the data on this page. Try:<br>• <em>Which lake grows fastest?</em><br>• <em>How big is Imja Tsho?</em><br>• <em>What is Tsho Rolpa's risk?</em><br>" +
             "• <em>What is downstream of Thulagi?</em><br>• <em>Why radar and not optical?</em><br>• <em>How do you avoid false water?</em><br>• <em>Where does the data come from?</em>";

  function answer(question, D) {
    var q = norm(question);
    if (q.trim().length < 2) return { html: HELP };
    if (has(q, [" hi ", "hello", " hey ", "help", "what can you", "what can i ask"])) return { html: HELP };

    if (has(q, FORECAST)) return { html: LIMITS };
    var lake = findLake(q, D);
    if (!lake && has(q, ["fastest", "most", "which lake", "rank", "compare", "largest", "biggest", "highest risk", "riskiest", "all lakes", "six lakes"])) return { html: rank(q, D) };
    if (lake) return { html: lakeAnswer(q, lake) };

    if (has(q, ["shadow", "false", "mistake", "wrong", "accur", "valid", "trust", "uncertain", "error", "reliable"])) {
      return { html: "<strong>Two guards against false water.</strong> Radar shadow behind steep slopes is also dark, so only the dark patch that contains the lake's own coordinates counts; anything else is logged, not used. " +
        "And the areas are checked against published measurements of the same lakes (about 10% error in the source), and radar against optical from within 14 days.<br>Right now: <em>" + D.dataLabel + "</em>." };
    }
    if (has(q, ["radar", "nisar", "l-band", "c-band", "wavelength", "cloud", "monsoon", "optical", "sar", "why"])) {
      return { html: "<strong>Why radar.</strong> Cloud droplets are micrometres across, radar wavelengths are centimetres, so cloud is nearly transparent to radar. NISAR's L-band is about 24 cm and it carries its own illumination, so it works day and night. " +
        "Calm water bounces the pulse away from the sensor and shows up dark. NISAR repeats every 12 days. Optical satellites need clear sky, and the monsoon (June to September) takes that away. Heavy rain affects shorter wavelengths more than L-band." };
    }
    if (has(q, ["21", "mitigat", "safeguard", "dangerous", "monitor", "icimod", "glof"])) {
      return { html: "<strong>The problem.</strong> A 2011 ICIMOD study counted 21 critically dangerous glacial lakes in Nepal and found proper mitigation at only two. A 2020 ICIMOD and UNDP report counted 26 glacial lake outburst floods in Nepal since 1977, 14 of them starting inside Nepal." };
    }
    if (has(q, ["data", "source", "where", "from", "nasa", "landsat", "earth engine", "asf"])) {
      return { html: "<strong>Data.</strong> Optical: Landsat 5, 7, 8 and 9 via Google Earth Engine. Radar: NASA-ISRO NISAR L-band GCOV via ASF DAAC (calibrated public data from 17 June 2026). Reference areas: Rounce et al. (2016), ICIMOD, Watanabe et al. (2009).<br>Status of this page: <em>" + D.dataLabel + "</em>. " + D.dataNote };
    }
    if (has(q, ["method", "how", "ndwi", "otsu", "threshold", "formula", "calculate"])) {
      return { html: "<strong>Method.</strong> Optical: NDWI = (green − NIR) / (green + NIR) in a small window around the lake, with the threshold chosen per image (Otsu), keeping the water patch that contains the lake. Radar: backscatter in dB, Otsu again, same patch rule. " +
        "Risk tier: growth in area over the last five years. Under 10% Low, under 25% Moderate, under 40% High, above that Critical." };
    }
    return { html: "I don't have an answer to that from the data on this page.<br><br>" + HELP };
  }

  SC.qa = { answer: answer, help: HELP };
  if (typeof module !== "undefined" && module.exports) module.exports = SC.qa;
})(typeof window !== "undefined" ? window : globalThis);
