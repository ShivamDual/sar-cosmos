/* Pure helpers for the Cosmo chat: safe markdown, whitelisted document actions, and the compact page
   context sent with each question. No DOM, no network, so it is testable in Node.
   SECURITY: model output is untrusted. Everything is HTML-escaped first, links must be http(s), and
   actions can only point at the whitelist below, never at URLs the model invents. */
(function (root) {
  "use strict";
  var SC = (root.SC = root.SC || {});

  var DOCS = {
    "rounce-paper": { title: "Rounce et al. 2016: glacial lake change and hazard assessment (HESS)", url: "https://hess.copernicus.org/articles/20/3455/2016/", kind: "paper" },
    "rounce-supplement": { title: "Rounce et al. 2016 supplement PDF (Table S.7, lake areas)", url: "https://hess.copernicus.org/articles/20/3455/2016/hess-20-3455-2016-supplement.pdf", kind: "pdf" },
    "icimod-rolpa": { title: "ICIMOD: Reassessing Tsho Rolpa glacial lake (2019)", url: "https://icimod.org/reassessing-tsho-rolpa-glacial-lake/?p=1618", kind: "report" },
    "undp-icimod-2020": { title: "ICIMOD and UNDP Nepal (2020): potentially dangerous glacial lakes", url: "https://www.undp.org/nepal/press-releases/report-icimod-and-undp-identifies-potentially-dangerous-glacial-lakes-koshi-gandaki-and-karnali-river-basins", kind: "report" },
    "asf-nisar": { title: "ASF: NISAR L-band data now publicly available", url: "https://asf.alaska.edu/notices/nisar-l-band-data-now-publicly-available/", kind: "notice" },
    "nisar-docs": { title: "NISAR data documentation (ASF)", url: "https://nisar-docs.asf.alaska.edu/", kind: "docs" },
    "challenge": { title: "NASA Space Apps 2026 challenges", url: "https://www.spaceappschallenge.org/2026/challenges/", kind: "page" }
  };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function inline(s) {                                   // s is already escaped
    s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, function (m, t, u) { return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + "</a>"; });
    return s;
  }

  function renderMarkdown(src) {
    src = String(src == null ? "" : src).replace(/\r/g, "").replace(/\[\[[^\]]*$/, "");      // hide a half-streamed [[marker
    var lines = src.split("\n"), out = [], i = 0, list = null, para = [];
    function flushPara() { if (para.length) { out.push("<p>" + inline(esc(para.join(" "))) + "</p>"); para = []; } }
    function closeList() { if (list) { out.push("</" + list + ">"); list = null; } }
    while (i < lines.length) {
      var line = lines[i];
      if (/^```/.test(line)) {                            // fenced code block
        flushPara(); closeList(); var code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
        out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>"); i++; continue;
      }
      var h = /^#{1,4}\s+(.*)$/.exec(line), ul = /^\s*[-*•]\s+(.*)$/.exec(line), ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (h) { flushPara(); closeList(); out.push('<p class="md-h"><strong>' + inline(esc(h[1])) + "</strong></p>"); }
      else if (ul || ol) {
        flushPara(); var tag = ul ? "ul" : "ol";
        if (list !== tag) { closeList(); out.push("<" + tag + ">"); list = tag; }
        out.push("<li>" + inline(esc((ul || ol)[1])) + "</li>");
      }
      else if (/^\s*$/.test(line)) { flushPara(); closeList(); }
      else { closeList(); para.push(line.trim()); }
      i++;
    }
    flushPara(); closeList();
    return out.join("");
  }

  /* [[sheet:id]] [[csv:id]] [[lake:id]] [[doc:id]] [[brief]]  ->  actions the UI may render as buttons */
  function extractActions(text, lakeIds) {
    var actions = [], seen = {};
    var clean = String(text == null ? "" : text).replace(/\[\[(doc|sheet|csv|lake|brief)(?::([a-z0-9_\-]+))?\]\]/g, function (m, type, id) {
      var ok = type === "brief" || (type === "doc" && Object.prototype.hasOwnProperty.call(DOCS, id)) ||
               ((type === "sheet" || type === "csv" || type === "lake") && (lakeIds || []).indexOf(id) !== -1);
      var key = type + ":" + (id || "");
      if (ok && !seen[key]) { seen[key] = 1; actions.push({ type: type, id: id || null }); }
      return "";
    }).replace(/\n{3,}/g, "\n\n").trim();
    return { text: clean, actions: actions };
  }

  /* What the model is told about the page right now (kept small; the Worker caps it again). */
  function buildContext(D, state, RAD) {
    RAD = RAD || {};
    var lakes = D.lakes.map(function (l) {
      var last = l.optical[l.optical.length - 1] || {};
      return { id: l.id, name: l.name, tier: l.riskTier, areaKm2: last.area, areaDate: last.date,
               change5yrPct: l.change5yrPct, optical: l.opticalIsPipeline ? "pipeline" : "published",
               radarScenes: (RAD[l.id] || []).length, nisarSeriesPoints: l.sar.length };
    });
    return { dataLabel: D.dataLabel, dataNote: D.dataNote, demoData: D.demoData, generatedAt: D.generatedAt,
             viewing: state || {}, lakes: lakes,
             coverage: { publishedPerMonth: D.coverage.publishedPerMonth, nisarPerMonth: D.coverage.nisarPerMonth || null } };
  }

  SC.chatlib = { DOCS: DOCS, esc: esc, renderMarkdown: renderMarkdown, extractActions: extractActions, buildContext: buildContext };
  if (typeof module !== "undefined" && module.exports) module.exports = SC.chatlib;
})(typeof window !== "undefined" ? window : globalThis);
