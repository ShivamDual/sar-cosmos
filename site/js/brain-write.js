/* Cosmo's writing layer. Wraps the offline brain with:
   - essays, summaries, outlines, speeches, emails, captions, paragraphs (about a lake, or any topic Cosmo knows),
     with an approximate word target such as "300 words",
   - documents: any writing can be opened as a printable document (Save as PDF from the browser's print dialog),
   - "make a PDF of that" for the last answer.
   It only takes over when a request is clearly a writing task; everything else goes to the brain as before. */
(function (root) {
  "use strict";
  var SC = (root.SC = root.SC || {});
  var B = SC.brain;
  if (!B) return;
  var base = B.answer;
  var lastText = "";

  var WRITE_NOUN = /\b(essay|article|summary|summari[sz]e|outline|speech|email|letter|caption|blog|paragraph|report|poem|story|script|draft|introduction|conclusion|abstract|bio|cover letter)\b/;
  var WRITE_VERB = /\b(write|draft|compose|make|create|generate|give me|produce|prepare|can you write|could you write|i need|please write)\b/;
  var QUESTION_START = /^(how|what|why|tips|explain|is|are|should|can i|do i|does|where|when|who)\b/;
  var PDF_ASK = /\b(pdf|document|print|save (it|this|that)|as a file|make a file)\b/;
  var TARGET = /(\d{2,4})\s*(-)?\s*words?/;

  var ALIAS = {
    imja_tsho: ["imja tsho", "imja"], tsho_rolpa: ["tsho rolpa", "rolpa", "rolwaling"], thulagi: ["thulagi", "dona tal", "dona"],
    lower_barun: ["lower barun", "barun"], lumding: ["lumding tsho", "lumding"], hongu: ["hongu", "chamlang south", "chamlang"]
  };
  function clean(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9%²\s.\-]/g, " ").replace(/\s+/g, " ").trim(); }
  function words(t) { return (String(t).replace(/[*#>\-`]/g, " ").match(/\S+/g) || []).length; }
  function short(l) { return l.name.replace(/ \(.*\)/, ""); }
  function yr(d) { return String(d || "").slice(0, 4); }
  function pct(v) { return v == null ? "n/a" : (v > 0 ? "+" : "") + v.toFixed(1) + "%"; }
  function plain(md) { return String(md).replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "").replace(/^#+\s*/gm, "").replace(/^\s*[-•]\s+/gm, "").trim(); }

  function findLake(c, D) {
    var s = " " + c + " ";
    for (var i = 0; i < D.lakes.length; i++) {
      var l = D.lakes[i], al = ALIAS[l.id] || [short(l).toLowerCase()];
      for (var j = 0; j < al.length; j++) if (s.indexOf(" " + al[j] + " ") !== -1) return l;
    }
    return null;
  }

  /* ---------- paragraphs about a lake (every fact comes from the page's data) ---------- */
  function lakeParagraphs(l, D) {
    var e = l.exposure || {}, basisTxt = l.opticalIsPipeline ? "from this project's Landsat pipeline" : "from published measurements (Rounce et al. 2016, with about 10% error)";
    var p = [];
    p.push("**" + short(l) + "** is a glacial lake in " + l.district + " district, in the " + l.basin + " basin, at about " + l.altitude_m.toLocaleString("en-US") + " metres above sea level. " + l.context);
    p.push("The measurements show that it covered about " + l.latestAreaKm2.toFixed(2) + " square kilometres in " + yr(l.latestDate) + ", " + basisTxt + ". Over the last five years its area changed by " + pct(l.change5yrPct) + ", which places it in the " + l.riskTier + " tier of our growth-based rule.");
    if (e.places && e.places.length) p.push("Downstream, the valleys include " + e.places.join(", ") + ". " + (e.infrastructure && e.infrastructure.length ? "The same river system carries " + e.infrastructure.join("; ") + "." : ""));
    else p.push("Downstream settlements for this lake have not been mapped by the team yet, so the project cannot yet describe who lives in its path.");
    p.push("Mitigation: " + (e.mitigation || "no mitigation work is recorded in the sources the project used.") + (e.households ? " " + e.households : ""));
    p.push("A key point is what the numbers do and do not mean. The growth tier describes how fast the lake is changing, not the chance of a flood. Forecasting an outburst, or the time and depth of a flood, needs flood modelling and the responsible authorities, such as Nepal's Department of Hydrology and Meteorology.");
    p.push("The key figure from the record is: " + l.keyStat);
    return p;
  }

  /* extra paragraphs, used when a longer piece is requested */
  function lakeExtras(l, D) {
    return [
      "**" + short(l) + "** is one of six lakes that SAR Cosmos studies. The other five are " + D.lakes.filter(function (x) { return x.id !== l.id; }).map(short).join(", ") + ". The project compares growth across the set, so readers can see which lakes are changing fastest.",
      "Radar and optical satellites see the same lake in different ways. Optical images need clear skies, which the monsoon rarely gives over the Himalaya. Radar pulses pass through cloud, and calm water shows up dark, so the NISAR mission can keep watching the lake through the wet season.",
      "The data status matters for any claim about this lake. The page currently shows " + D.dataLabel.toLowerCase() + ". " + D.dataNote,
      "Two honest limits apply. Published areas carry about ten percent error of their own, and the terrain used for illustration on the website is generated rather than a real elevation model. Both limits are stated on the project's website, so readers can judge the figures for themselves."
    ];
  }

  /* ---------- paragraphs about any topic Cosmo knows ---------- */
  function topicParagraphs(topic, D) {
    var hits = B.retrieve ? B.retrieve(topic, 6) : [];
    var out = [];
    if (!hits.length) return null;
    out.push("This piece is about " + topic + ". Here is what the project's knowledge says, in order of relevance.");
    hits.forEach(function (h) { out.push(plain(h.answer)); });
    return out;
  }

  /* ---------- fit the piece to a target word count, approximately ---------- */
  function fit(paras, target) {
    if (!target) return paras;
    var out = [], total = 0;
    for (var i = 0; i < paras.length; i++) {
      var w = words(paras[i]);
      if (total + w <= target * 1.08 || !out.length) { out.push(paras[i]); total += w; }
      else {
        var sents = paras[i].split(/(?<=[.!?])\s+/), part = [];
        for (var k = 0; k < sents.length; k++) {
          if (total + words(sents[k]) > target * 1.02) break;
          part.push(sents[k]); total += words(sents[k]);
        }
        if (part.length) out.push(part.join(" "));
        break;
      }
      if (total >= target * 0.96) break;
    }
    return out;
  }

  function writeTask(c, raw, D) {
    if (QUESTION_START.test(c) && !/^(write|draft|compose|create|generate|give me|make)/.test(c)) return null;
    var verb = WRITE_VERB.exec(c);
    var noun = WRITE_NOUN.exec(c.replace(WRITE_VERB, " "));
    if (!noun || !verb) return null;
    var tgt = TARGET.exec(c), target = tgt ? parseInt(tgt[1], 10) : 0;
    var l = findLake(c, D);
    var kind = noun[1];
    var paras, title;
    if (l) {
      paras = lakeParagraphs(l, D);
      if (target && words(paras.join(" ")) < target * 0.9) paras = paras.concat(lakeExtras(l, D));
      title = (kind === "essay" || kind === "article" || kind === "report" ? "Essay: " : kind === "summary" || kind === "summarise" || kind === "summarize" ? "Summary: " : kind === "speech" ? "Speech: " : kind === "email" ? "Email about " : "") + short(l);
      if (kind === "speech") paras = ["Good morning everyone. Let me tell you about " + short(l) + "."].concat(paras);
      if (kind === "email") paras = ["Dear reader,", "I am writing about " + short(l) + "."].concat(paras).concat(["Kind regards,"]);
    } else {
      var topic = c.replace(WRITE_NOUN, " ").replace(WRITE_VERB, " ").replace(TARGET, " ").replace(/\b(a|an|the|on|about|for|me|of|into|me|some|short|long|good|simple|please|can|you|could|i|need|my|to)\b/g, " ").replace(/\s+/g, " ").trim();
      if (!topic) return null;
      paras = topicParagraphs(topic, D);
      if (!paras) return null;
      title = (kind === "essay" ? "Essay: " : kind === "summary" || kind === "summarise" ? "Summary: " : "") + topic.replace(/\b\w/g, function (m) { return m.toUpperCase(); });
    }
    var body = fit(paras, target);
    var md = "# " + title + "\n\n" + body.join("\n\n");
    var note = target ? " (about " + words(md) + " words, target " + target + ")" : "";
    return { title: title, markdown: md, intro: "Here is your " + kind + note + ". You can open it as a printable document below." };
  }

  B.answer = function (question, ctx) {
    var raw = String(question || "").trim(), c = clean(raw), D = ctx.D;
    if (PDF_ASK.test(c) && !WRITE_NOUN.test(c) && lastText) {
      return { text: "Here it is as a document you can print or save as a PDF.", doc: { title: "SAR Cosmos answer", markdown: lastText } };
    }
    var w = writeTask(c, raw, D);
    if (w) {
      lastText = w.markdown;
      return { text: w.intro + "\n\n" + w.markdown, doc: { title: w.title, markdown: w.markdown } };
    }
    var out = base(question, ctx);
    lastText = out.text;
    return out;
  };
  B.retrieve = function (q, k) {
    B.retrieve.ensure && B.retrieve.ensure();
    return (B.search ? B.search(q, k || 4) : []);
  };
})(typeof window !== "undefined" ? window : globalThis);
