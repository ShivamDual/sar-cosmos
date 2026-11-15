/* Cosmo's offline brain. No network, no API key.
   It understands a question, keeps the thread of the conversation, and answers from:
   - the live numbers on the page (the six lakes, their tiers, growth, downstream facts),
   - the project knowledge (generated from the same data files as the site),
   - a glossary and FAQ (brain-data.js), ranked with BM25 retrieval,
   - a safe calculator and small talk.
   Document buttons are returned as markers that the chat renders as real actions. */
(function (root) {
  "use strict";
  var SC = (root.SC = root.SC || {});
  var B = (SC.brain = {});

  var STOP = {};
  ("a an the is are was were be been being am do does did doing of to in on at for with by from and or but if then so than that this these those it its i me my we our us you your they them their he she his her what which who whom whose when where why how can could would should will shall may might must please tell give show explain about just really very also there here some any all more most much many such as into over under up down out off again once both each few other own same too only not").split(" ")
    .forEach(function (w) { STOP[w] = 1; });

  /* ------------------------------------------------ text utilities --- */
  function clean(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/['’]s\b/g, "")
      .replace(/[^a-z0-9%²\u0900-\u097f.\-\s]+/g, " ").replace(/\.(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
  }
  function stem(w) {
    if (w.length > 4) {
      var m = /^(.*?)(ations|ation|ings|ing|ies|ied|ed|es|ly|s)$/.exec(w);
      if (m && m[1].length >= 3) return m[1] + (m[2] === "ies" || m[2] === "ied" ? "y" : "");
    }
    return w;
  }
  function terms(s) {
    return clean(s).split(" ").filter(function (w) { return w.length > 1 && !STOP[w]; }).map(stem);
  }
  function has(c, re) { return re.test(c); }
  function pick(list, seed) { var h = 0; for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0; return list[h % list.length]; }
  function fmtKm(v) { return v == null ? "n/a" : v.toFixed(2) + " km²"; }
  function pct(v) { return v == null ? "n/a" : (v > 0 ? "+" : "") + v.toFixed(1) + "%"; }
  function yr(d) { return String(d || "").slice(0, 4); }
  function short(l) { return l.name.replace(/ \(.*\)/, ""); }

  /* ------------------------------------------------ BM25 search ------ */
  function buildIndex(docs) {
    var N = docs.length, df = {}, tfs = [], total = 0;
    docs.forEach(function (d) {
      var ts = terms(d.title + " " + d.text), m = {};
      ts.forEach(function (t) { m[t] = (m[t] || 0) + 1; });
      Object.keys(m).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
      tfs.push({ m: m, n: ts.length }); total += ts.length;
    });
    var avg = total / Math.max(1, N);
    return function search(q) {
      var qt = terms(q), out = [];
      docs.forEach(function (d, i) {
        var s = 0;
        qt.forEach(function (t) {
          var f = tfs[i].m[t];
          if (!f) return;
          var idf = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
          s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * tfs[i].n / avg));
        });
        if (s > 0) out.push({ doc: d, score: s });
      });
      return out.sort(function (a, b) { return b.score - a.score; });
    };
  }
  var INDEX = null, DOCS = [];
  function ensureIndex() {
    if (INDEX) return;
    var P = root.SAR_PROMPT || { chunks: [] }, BD = root.SAR_BRAIN_DATA || { glossary: [], faq: [] };
    (P.chunks || []).forEach(function (c, i) { DOCS.push({ kind: "project", title: c.t, text: c.x, id: "p" + i }); });
    BD.glossary.forEach(function (g, i) { DOCS.push({ kind: "glossary", title: g.t[0], text: g.t.join(" ") + " " + g.a, a: g.a, id: "g" + i }); });
    BD.faq.forEach(function (f, i) { DOCS.push({ kind: "faq", title: f.q, text: f.q + " " + (f.k || []).join(" "), a: f.a, id: "f" + i }); });
    INDEX = buildIndex(DOCS);
  }

  /* ------------------------------------------------ lakes ------------ */
  var ALIAS = {
    imja_tsho: ["imja tsho", "imja", "imja lake"],
    tsho_rolpa: ["tsho rolpa", "rolpa", "rolwaling"],
    thulagi: ["thulagi", "dona tal", "dona"],
    lower_barun: ["lower barun", "barun"],
    lumding: ["lumding tsho", "lumding"],
    hongu: ["hongu", "chamlang south", "chamlang"]
  };
  function findLakes(c, D) {
    var s = " " + c + " ", out = [];
    D.lakes.forEach(function (l) {
      var al = ALIAS[l.id] || [short(l).toLowerCase()];
      for (var i = 0; i < al.length; i++) {
        if (s.indexOf(" " + al[i] + " ") !== -1) { out.push(l); break; }
      }
    });
    return out;
  }
  function lakeById(D, id) { for (var i = 0; i < D.lakes.length; i++) if (D.lakes[i].id === id) return D.lakes[i]; return null; }
  function basis(l) { return l.opticalIsPipeline ? "from this project's Landsat pipeline" : "from published measurements (Rounce et al. 2016, about 10% error)"; }
  function series(l) { return l.optical && l.optical.length ? l.optical : l.published || []; }

  function sizeLine(l) {
    return "**" + short(l) + "** covered about **" + fmtKm(l.latestAreaKm2) + "** in " + yr(l.latestDate) + " (" + basis(l) + ").";
  }
  function growthLine(l) {
    var s = series(l), a = s[0], b = s[s.length - 1];
    if (!a || !b) return "I don't have a long enough record for " + short(l) + " yet.";
    var overall = 100 * (b.area - a.area) / a.area;
    return "**" + short(l) + "** went from " + a.area.toFixed(2) + " km² in " + yr(a.date) + " to " + b.area.toFixed(2) +
      " km² in " + yr(b.date) + ", a change of **" + pct(overall) + "** over the record. Over the last five years it changed by " +
      pct(l.change5yrPct) + " and over the last three by " + pct(l.change3yrPct) + " (" + basis(l) + ").";
  }
  function riskLine(l) {
    return "**" + short(l) + "** is rated **" + l.riskTier + " risk** on our growth rule: a five-year change of " + pct(l.change5yrPct) +
      ". The tiers are under 10% Low, under 25% Moderate, under 40% High, and 40% or more Critical.\n\nThis describes how fast the lake is growing. It is **not** the chance of a flood.";
  }
  function downstreamLine(l) {
    var e = l.exposure || {}, parts = ["**Downstream of " + short(l) + "** (public facts, not a model):"];
    if (e.places && e.places.length) parts.push("- **Places:** " + e.places.join(", ") + ".");
    else parts.push("- **Places:** " + (e.places_note || "not yet mapped by the team") + ".");
    if (e.infrastructure && e.infrastructure.length) parts.push("- **Infrastructure:** " + e.infrastructure.join("; ") + ".");
    if (e.households) parts.push("- **People:** " + e.households);
    parts.push("- **Mitigation:** " + (e.mitigation || "none recorded in the sources we used."));
    parts.push("\nTravel times and flood depths need flood modelling, run with the responsible authorities. This project does not provide them.");
    return parts.join("\n");
  }
  function mitigationLine(l) {
    var e = l.exposure || {};
    return "**Mitigation at " + short(l) + ":** " + (e.mitigation || "none recorded in the sources we used.") +
      (l.monitored ? "\n\nIt is one of the two lakes in the study with mitigation work, which is why it is useful as a comparison." : "");
  }
  function whereLine(l) {
    return "**" + short(l) + "** is in " + l.district + " district, in the " + l.basin + " basin, at about " + l.altitude_m.toLocaleString("en-US") + " m.";
  }
  function aboutLine(l) {
    return "**" + short(l) + "**. " + l.context + "\n\n- **Size:** " + fmtKm(l.latestAreaKm2) + " in " + yr(l.latestDate) + " (" + basis(l) + ")\n- **Growth:** " +
      pct(l.change5yrPct) + " over five years, so " + l.riskTier + " risk on our rule\n- **Key figure:** " + l.keyStat;
  }
  function lakeAnswer(c, l) {
    if (has(c, /downstream|village|household|people|population|hydro|dam\b|infrastructure|who lives|affected|exposed|settlement/)) return downstreamLine(l);
    if (has(c, /mitigat|drain|outlet|lowered|safeguard|protect|early warning|monitor/)) return mitigationLine(l);
    if (has(c, /risk|danger|tier|hazard|safe\b|severity|dangerous/)) return riskLine(l);
    if (has(c, /grow|growth|expand|change|trend|shrink|faster|rate\b|increas|decreas|over time|history|since|record/)) return growthLine(l);
    if (has(c, /how big|size|area|km|large|how much|square|cover/)) return sizeLine(l);
    if (has(c, /where|location|altitude|elevation|district|basin|height/)) return whereLine(l);
    return aboutLine(l);
  }
  function compareLines(a, b) {
    var row = function (l) { return "- **" + short(l) + ":** " + fmtKm(l.latestAreaKm2) + " in " + yr(l.latestDate) + ", " + pct(l.change5yrPct) + " over five years, " + l.riskTier + " risk"; };
    return "Here is how they compare:\n\n" + row(a) + "\n" + row(b) + "\n\n" +
      (a.change5yrPct === b.change5yrPct ? "They are growing at the same rate over five years." :
        short(a.change5yrPct > b.change5yrPct ? a : b) + " is growing faster over the last five years.");
  }
  function rankAnswer(c, D) {
    var L = D.lakes.slice();
    if (has(c, /largest|biggest|most area|big/)) { L.sort(function (a, b) { return b.latestAreaKm2 - a.latestAreaKm2; }); return "**Largest lakes** by latest area:\n\n" + L.map(function (l, i) { return (i + 1) + ". " + short(l) + ", " + fmtKm(l.latestAreaKm2); }).join("\n"); }
    if (has(c, /smallest/)) { L.sort(function (a, b) { return a.latestAreaKm2 - b.latestAreaKm2; }); return "**Smallest lakes** by latest area:\n\n" + L.map(function (l, i) { return (i + 1) + ". " + short(l) + ", " + fmtKm(l.latestAreaKm2); }).join("\n"); }
    if (has(c, /risk|danger|hazard|worst/)) {
      var order = ["Critical", "High", "Moderate", "Low"];
      L.sort(function (a, b) { return order.indexOf(a.riskTier) - order.indexOf(b.riskTier) || b.change5yrPct - a.change5yrPct; });
      return "**By risk tier** (our growth rule):\n\n" + L.map(function (l, i) { return (i + 1) + ". " + short(l) + ", " + l.riskTier + " (" + pct(l.change5yrPct) + ")"; }).join("\n");
    }
    if (has(c, /slow|least|shrink|declin/)) { L.sort(function (a, b) { return a.change5yrPct - b.change5yrPct; }); return "**Slowest growing** over five years:\n\n" + L.map(function (l, i) { return (i + 1) + ". " + short(l) + ", " + pct(l.change5yrPct); }).join("\n"); }
    L.sort(function (a, b) { return b.change5yrPct - a.change5yrPct; });
    return "**Fastest growing** over five years:\n\n" + L.map(function (l, i) { return (i + 1) + ". " + short(l) + ", " + pct(l.change5yrPct) + " (to " + yr(l.latestDate) + ")"; }).join("\n") +
      "\n\nThe fastest-growing lake is a growth fact, not a flood forecast.";
  }

  /* ------------------------------------------------ calculator ------- */
  function evalMath(src) {
    var s = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
    if (!/^[0-9.+\-*/^()]+$/.test(s) || !/[0-9]/.test(s) || !/[+\-*/^]/.test(s)) return null;
    var i = 0;
    function num() { var m = /^\d+(\.\d+)?/.exec(s.slice(i)); if (!m) throw new Error("num"); i += m[0].length; return parseFloat(m[0]); }
    function atom() {
      if (s[i] === "(") { i++; var v = expr(); if (s[i] !== ")") throw new Error(")"); i++; return v; }
      if (s[i] === "-") { i++; return -atom(); }
      return num();
    }
    function pow() { var b = atom(); if (s[i] === "^") { i++; return Math.pow(b, pow()); } return b; }
    function term() {
      var v = pow();
      for (;;) {
        if (s[i] === "*") { i++; v *= pow(); }
        else if (s[i] === "/") { i++; var d = pow(); if (d === 0) throw new Error("div0"); v /= d; }
        else return v;
      }
    }
    function expr() {
      var v = term();
      for (;;) {
        if (s[i] === "+") { i++; v += term(); }
        else if (s[i] === "-") { i++; v -= term(); }
        else return v;
      }
    }
    try { var r = expr(); return i === s.length && isFinite(r) ? r : null; } catch (e) { return null; }
  }
  function mathAnswer(raw) {
    var p = /(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/i.exec(raw);
    if (p) { var r1 = parseFloat(p[1]) * parseFloat(p[2]) / 100; return p[1] + "% of " + p[2] + " is **" + (+r1.toFixed(6)) + "**."; }
    var cand = raw.replace(/^(what is|what's|whats|calculate|compute|evaluate|solve|work out|=)\s*/i, "").replace(/[?=]+\s*$/, "").trim();
    if (!/[0-9]/.test(cand) || !/[+\-*/^×÷]/.test(cand)) return null;
    var v = evalMath(cand);
    return v == null ? null : cand + " = **" + (+v.toFixed(6)) + "**.";
  }

  /* ------------------------------------------------ small talk ------- */
  var GREET = ["Hey! I'm Cosmo. What would you like to explore: the lakes, the radar, or something else?",
    "Hi there! Ask me about the six lakes, how radar sees through cloud, or anything you're curious about.",
    "Hello! Good to see you. What shall we dig into?"];
  var THANKS = ["You're welcome! Anything else you'd like to know?", "Glad that helped. What's next?", "Happy to help. Want to go deeper on any of this?"];
  var JOKES = ["Why did the radar break up with the cloud? It could always see right through it.",
    "What do you call a lake that's always on the move? A glacier-in-denial. Okay, that one needs a glacier.",
    "Why don't satellites ever get lonely? They always have a whole constellation of friends."];
  function clockText() { return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }
  function dateText() { return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
  function smallTalk(c, raw) {
    if (has(c, /who (are|r) (you|u)|what are you|your name|what is your name|introduce yourself|are you (a )?(bot|ai|real|human|robot)|who made you|who built you|who created you/)) {
      if (has(c, /who (made|built|created)/)) return { text: "I was built by **Shivam, Aarambh and Saurav** for SAR Cosmos, our NASA Space Apps 2026 project. I'm the assistant inside the site." };
      return { text: "I'm **Cosmo**, the assistant inside SAR Cosmos. I'm an AI assistant, not a person. Right now I'm running on my offline brain, so I'm strongest on the project, radar and glacial floods, and on a set of general topics. Connect the AI service and I can take on almost any question." };
    }
    if (has(c, /^(hi|hello|hey|hii+|yo|hola|namaste|namaskar|sup|good (morning|afternoon|evening)|greetings)\b/) && c.split(" ").length <= 4) return { text: pick(GREET, c) };
    if (has(c, /how are you|how r u|how's it going|how is it going|how do you do|you ok|you okay/)) return { text: "Doing well, thanks for asking! Ready when you are. What would you like to look at?" };
    if (has(c, /thank|thanks|thx|\bty\b|cheers|appreciate/)) return { text: pick(THANKS, c) };
    if (has(c, /^(bye|goodbye|see you|cya|good night|gn|later)\b/)) return { text: "Good luck, and good night! Come back any time." };
    if (has(c, /^(ok|okay|cool|nice|great|awesome|wow|perfect|sweet|got it|understood)\b/) && c.split(" ").length <= 3) return { text: "Glad that helps. Want to go deeper on anything?" };
    if (has(c, /what time|current time|time now|time is it/)) return { text: "It's **" + clockText() + "** on your device." };
    if (has(c, /what date|today'?s date|what day|what is today|which day/)) return { text: "Today is **" + dateText() + "** on your device." };
    if (has(c, /joke|make me laugh|something funny|be funny/)) return { text: pick(JOKES, c) };
    return null;
  }

  /* ------------------------------------------------ documents -------- */
  var DOC_WORDS = /(where does the data|data come|where is the data|where.*data.*from|fact ?sheet|pdf|printable|print|csv|download|data file|spreadsheet|raw data|source|paper|citation|reference|read more|journal|brief|one.?page|project summary|fly|zoom|show me the lake|take me to|3d view)/;
  function docs(c, D, lake) {
    var m = [], txt = [];
    var L = lake || null;
    if (has(c, /brief|one.?page|project summary|overview document|summary document/)) { m.push("[[brief]]"); txt.push("Here is the one-page project brief, ready to print or save as PDF."); }
    if (has(c, /fact ?sheet|pdf|printable|print/) && L) { m.push("[[sheet:" + L.id + "]]"); txt.push("Here is the printable fact sheet for **" + short(L) + "**."); }
    else if (has(c, /fact ?sheet|pdf|printable|print/)) txt.push("Tell me which lake you need the fact sheet for, or use the brief above for the whole project.");
    if (has(c, /csv|download|data file|spreadsheet|raw data|numbers/) && L) { m.push("[[csv:" + L.id + "]]"); txt.push("You can download the measurements for **" + short(L) + "** as a CSV file."); }
    if (has(c, /fly|zoom|show me the lake|take me to|3d view/) && L) { m.push("[[lake:" + L.id + "]]"); txt.push("Flying the 3D view to **" + short(L) + "**."); }
    if (has(c, /source|paper|citation|reference|read more|journal|study|where does the data|data come|where is the data|where.*data.*from/)) {
      m.push("[[doc:rounce-paper]]", "[[doc:rounce-supplement]]", "[[doc:asf-nisar]]", "[[doc:icimod-rolpa]]");
      txt.push("The data comes from these sources:\n\n- **Published lake areas:** Rounce et al. (2016), Hydrology and Earth System Sciences, with its supplement table.\n- **Dangerous-lake counts and mitigation:** ICIMOD (2011, cited in its 2019 Tsho Rolpa reassessment) and ICIMOD and UNDP Nepal (2020).\n- **Radar:** NASA-ISRO NISAR calibrated public data, via ASF, from 17 June 2026.\n- **Optical:** Landsat 5, 7, 8 and 9 via Google Earth Engine (once the pipeline has run).\n\nStatus of this page: *" + D.dataLabel + "*. " + D.dataNote);
    }
    if (!txt.length) return null;
    return txt.join("\n\n") + (m.length ? "\n\n" + m.join("\n") : "");
  }

  /* ------------------------------------------------ refusals --------- */
  var FORECAST = /(when will|how soon|arrival|arrive|arriving|minutes until|how long until|hours until|evacuat|will it (burst|flood|break)|forecast|predict|flood (time|depth|speed|wave)|how deep|how fast (would|will) the (water|flood)|warning time|emergency)/;
  var FORECAST_TEXT = "I can't tell you that, and this project can't either. SAR Cosmos measures how big each lake is and how fast it grows.\n\nFlood timing, depth and evacuation advice need flood modelling built on terrain data, run with the responsible authorities (in Nepal, the Department of Hydrology and Meteorology). If you are near one of these lakes, follow local authorities and official warnings.";

  /* ------------------------------------------------ knowledge -------- */
  function knowledge(c, D) {
    ensureIndex();
    var hits = INDEX(c).slice(0, 4);
    if (!hits.length) return null;
    var top = hits[0];
    if (top.score < 4.2) return null;
    var out = [], used = {};
    hits.forEach(function (h, i) {
      if (i > 1 || h.score < top.score * 0.55) return;
      if (h.doc.kind === "project") out.push("**" + h.doc.title + ":** " + h.doc.text);
      else out.push(h.doc.a);
      used[h.doc.id] = 1;
    });
    return out.join("\n\n");
  }

  /* ------------------------------------------------ memory ----------- */
  var mem = { lake: null, turns: 0 };
  B.reset = function () { mem.lake = null; mem.turns = 0; };
  B.search = function (q, k) {
    ensureIndex();
    return INDEX(q).slice(0, k || 4).map(function (h) {
      return { answer: h.doc.kind === "project" ? "**" + h.doc.title + ":** " + h.doc.text : h.doc.a, kind: h.doc.kind, score: h.score };
    });
  };

  var LAKE_CUES = /\b(it|its|this|that|there|the lake|this lake|that lake|one|them|those)\b/;
  var LAKE_WORDS = /risk|grow|growth|big|size|area|downstream|mitigat|danger|safe|how|what|tell|where|compare|history|change|record|dam|people|village/;

  /* ------------------------------------------------ the answer ------- */
  B.answer = function (question, ctx) {
    ensureIndex();
    var D = ctx.D, raw = String(question || "").trim();
    var c = clean(raw);
    mem.turns++;
    if (!c) return { text: "Go on, I'm listening. You can ask about the lakes, radar, glacial floods, or anything else." };

    var reply = null, st = smallTalk(c, raw);
    if (st && has(c, /^(hi|hello|hey|hii+|yo|hola|namaste|sup|good (morning|afternoon|evening)|greetings)\b/) && c.split(" ").length > 4) st = null;
    if (st) return { text: st.text };

    var calc = mathAnswer(raw);
    if (calc) return { text: calc };

    if (has(c, FORECAST)) return { text: FORECAST_TEXT };

    var found = findLakes(c, D);
    if (!found.length && mem.lake && LAKE_CUES.test(c) && LAKE_WORDS.test(c)) found = [lakeById(D, mem.lake)].filter(Boolean);

    var docText = has(c, DOC_WORDS) ? docs(c, D, found.length === 1 ? found[0] : (mem.lake ? lakeById(D, mem.lake) : null)) : null;

    if (has(c, /data status|is this real|real data|published or|pipeline|are the numbers|is it real|measured/) && !found.length) {
      reply = "Right now the page shows **" + D.dataLabel + "**. " + D.dataNote + " Radar shows only once the NISAR pipeline has produced scenes.";
    }
    else if (found.length >= 2 && has(c, /compare|versus|vs\.?|or|better|difference|which is/)) reply = compareLines(found[0], found[1]);
    else if (found.length === 1) reply = lakeAnswer(c, found[0]);
    else if (has(c, /fastest|quickest|largest|biggest|smallest|riskiest|highest risk|most dangerous|worst|slowest|least|which lake|rank|most growth|most area/) && has(c, /lake|grow|risk|big|small|fast|slow|dangerous|worst/)) reply = rankAnswer(c, D);

    if (docText && !reply) return { text: docText };
    if (docText && reply) reply = reply + "\n\n" + docText;

    if (!reply) {
      var k = knowledge(c, D);
      if (k) reply = k;
    }
    if (!reply && has(c, /radar|optical|monsoon|cloud|nisar|sar|ndwi|method|how do you|how does it|measure|validate|accurate|false|shadow|risk tier/)) {
      reply = "That's one of the core questions. Could you tell me a little more? For example, *why radar works through cloud*, *how the lake areas are measured*, or *how the risk tiers are worked out*.";
    }
    if (!reply) reply = fallback(c);

    if (found.length === 1) mem.lake = found[0].id;
    return { text: reply };
  };

  function fallback(c) {
    var opts = ["How big is Imja Tsho?", "Why is radar better than optical in the monsoon?", "What does NDWI mean?", "How do I write a good project pitch?"];
    return "I don't have a solid answer to that offline, and I'd rather say so than guess.\n\nHere is what I'm strong on:\n\n- **The six lakes:** size, growth, risk tier, downstream facts and mitigation\n- **The method:** radar, optical, NDWI, Otsu, validation\n- **Glacial floods and glaciers**, the monsoon and Nepal\n- **Coding and study help:** Python, HDF5, git, exams, essays and pitching\n\nTry something like: *" + pick(opts, c) + "*\n\nFor open questions on any subject, connect the AI service and I'll switch to the full model.";
  }
})(typeof window !== "undefined" ? window : globalThis);
