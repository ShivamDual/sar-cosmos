/* Cosmo: the SAR Cosmos assistant. Streams answers from the proxy (worker/chat-worker.js) when an endpoint is
   configured, and otherwise (or if the service is unreachable) answers from the page's own data. */
(function () {
  "use strict";
  var SC = (window.SC = window.SC || {});
  var lib = SC.chatlib, chat = (SC.chat = {});
  var D, getState, hooks = {}, RAD = {}, lakeIds = [];
  var msgs = [], busy = false, ctrl = null, endpoint = "", online = null, viewerOK = null;
  var KEY = "sarcosmos.chat.v1", MAX_SEND = 14;

  function $(s) { return document.querySelector(s); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function cosmoHTML(size) { return '<div class="cosmo cosmo-' + size + '" aria-hidden="true"><i class="orbit-wrap"><i class="orbit"></i></i><i class="disc"></i><i class="sweep"></i><i class="ring"></i><i class="core"></i></div>'; }

  function resolveEndpoint() {
    var e = (window.SAR_CHAT && window.SAR_CHAT.endpoint) || "";
    var q = new URLSearchParams(location.search).get("chat");
    var local = location.protocol === "file:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (q && local) e = q;                                   // test override, only on your own machine
    return /^https?:\/\//.test(e) ? e : "";
  }

  function setStatus(mode) {
    var dot = $("#chat-dot"), t = $("#chat-status");
    dot.className = "dot " + mode;
    t.textContent = mode === "ai" ? "AI assistant" : mode === "thinking" ? "Thinking" : mode === "down" ? "AI unavailable, offline brain on" : "Offline brain";
    if (mode === "ai" && viewerOK === true) t.textContent = "Powered by the viewer's AI";
    if (mode === "offline" || (mode === "down")) dot.className = "dot offline";
  }

  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-20))); } catch (e) { /* private mode */ } }
  function load() { try { var v = JSON.parse(sessionStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter(function (m) { return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"; }) : []; } catch (e) { return []; } }

  function scrollDown() { var s = $("#chat-scroll"); s.scrollTop = s.scrollHeight; }

  function actionButtons(actions) {
    var wrap = el("div", "chat-actions");
    actions.forEach(function (a) {
      var name = a.id && D.lakes.filter(function (l) { return l.id === a.id; })[0];
      name = name ? name.name.replace(/ \(.*\)/, "") : "";
      var b;
      if (a.type === "doc") { var d = lib.DOCS[a.id]; b = el("a", "act doc"); b.href = d.url; b.target = "_blank"; b.rel = "noopener noreferrer"; b.innerHTML = "<span>" + (d.kind === "pdf" ? "PDF" : "Source") + "</span>" + lib.esc(d.title); }
      else {
        b = el("button", "act"); b.type = "button";
        var label = { sheet: ["PDF", "Fact sheet: " + name], brief: ["PDF", "One-page project brief"], csv: ["CSV", "Download data: " + name], lake: ["3D", "Fly to " + name] }[a.type];
        b.innerHTML = "<span>" + label[0] + "</span>" + lib.esc(label[1]);
        b.addEventListener("click", function () { if (hooks[a.type]) hooks[a.type](a.id); });
      }
      wrap.appendChild(b);
    });
    return wrap;
  }

  function addMessage(role, content, opts) {
    opts = opts || {};
    var row = el("div", "msg " + role), body = el("div", "bubble");
    if (role === "assistant") { row.appendChild(el("div", "msg-av", cosmoHTML("xs"))); }
    row.appendChild(body);
    var parts = lib.extractActions(content, lakeIds);
    body.innerHTML = role === "user" ? "<p>" + lib.esc(content).replace(/\n/g, "<br>") + "</p>" : (opts.html || lib.renderMarkdown(parts.text));
    if (role === "assistant" && !opts.streaming) finishAssistant(row, body, content);
    $("#chat-msgs").appendChild(row); scrollDown();
    return { row: row, body: body };
  }
  function finishAssistant(row, body, raw) {
    var parts = lib.extractActions(raw, lakeIds);
    if (parts.actions.length) body.appendChild(actionButtons(parts.actions));
    var copy = el("button", "copy", "Copy"); copy.type = "button";
    copy.addEventListener("click", function () { var t = parts.text || body.textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy"; }, 1400); }, function () {}); });
    body.appendChild(copy);
  }

  function thinking(on) {
    $("#chat").classList.toggle("is-thinking", on);
    var b = $("#cosmo-big"); if (b) b.firstChild.classList.toggle("thinking", on);
    $("#chat-send").classList.toggle("stop", on);
    $("#chat-send").setAttribute("aria-label", on ? "Stop" : "Send");
  }


  /* Brain 1: the AI model of the viewer this page runs in, through the platform's sample capability.
     The platform asks the viewer's consent on first use and spends their usage, not ours. */
  async function viaViewerAI(question, holder) {
    if (viewerOK === false) return null;
    var sample;
    try { sample = await window.claude.use("sample"); } catch (e) { sample = null; }
    if (!sample) { viewerOK = false; return null; }
    viewerOK = true;
    var ctx = lib.buildContext(D, getState ? getState() : {}, RAD);
    var system = window.SAR_PROMPT.rules + "\n\nKNOWLEDGE\n" + window.SAR_PROMPT.knowledge + "\n\nPAGE DATA (what the visitor's page shows right now)\n" + JSON.stringify(ctx).slice(0, 6000);
    var turns = msgs.slice(-MAX_SEND).map(function (m) { return { role: m.role, content: m.content }; });
    if (!turns.length || turns[0].role !== "user") turns.unshift({ role: "user", content: question });
    turns[0] = { role: "user", content: system + "\n\nCONVERSATION\n\n" + turns[0].content };
    ctrl = new AbortController();
    var cursor = '<span class="caret"></span>';
    try {
      var res = await sample(turns, { cache: false, signal: ctrl.signal, onText: function (o) {
        holder.body.innerHTML = lib.renderMarkdown(lib.extractActions(o.text, lakeIds).text) + cursor; scrollDown(); } });
      return { text: res.text || "" };
    } catch (e) {
      if (e && e.code === "cancelled") return { text: (e.text || holder.body.textContent || "").replace(/\s+$/, "") || "Stopped." };
      if (e && e.code === "not_granted") return { text: "You chose not to let Cosmo use the AI in this view, so I am answering from the page data instead.\n\n" + SC.qa.answer(question, D).html.replace(/<[^>]+>/g, " ") , limited: false, notGranted: true };
      if (e && e.text) return { text: e.text };
      return null;
    }
  }


  /* Deep offline model (optional, PC with WebGPU). Off by default. Turned on by the user, downloads once. */
  var DEEP_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
  var deep = { engine: null };
  function deepOn() { try { return localStorage.getItem("sarcosmos.deep") === "1"; } catch (e) { return false; } }
  async function deepLoad(onProgress) {
    if (deep.engine) return deep.engine;
    if (!navigator.gpu) throw new Error("no-webgpu");
    var webllm = await import("https://esm.run/@mlc-ai/web-llm");
    deep.engine = await webllm.CreateMLCEngine(DEEP_MODEL, { initProgressCallback: onProgress || function () {} });
    return deep.engine;
  }
  async function viaDeep(question, holder) {
    var eng = await deepLoad(function (p) {
      holder.body.innerHTML = '<span class="note">Loading the deep model, ' + Math.round((p.progress || 0) * 100) + "%. This happens once.</span>";
    });
    var hits = SC.brain && SC.brain.retrieve ? SC.brain.retrieve(question, 5) : [];
    var notes = hits.map(function (h) { return h.answer; }).join("\n\n").slice(0, 4000);
    var sys = window.SAR_PROMPT.rules + "\n\nREFERENCE NOTES (checked project and general facts)\n" + notes +
      "\n\nPAGE DATA\n" + JSON.stringify(lib.buildContext(D, getState ? getState() : {}, RAD)).slice(0, 1500);
    var messages = [{ role: "system", content: sys }].concat(msgs.slice(-8).map(function (m) { return { role: m.role, content: m.content }; }));
    var stream = await eng.chat.completions.create({ messages: messages, stream: true, max_tokens: 700, temperature: 0.6 });
    var text = "", cursor = '<span class="caret"></span>';
    for await (const chunk of stream) {
      var d = (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) || "";
      if (d) { text += d; holder.body.innerHTML = lib.renderMarkdown(lib.extractActions(text, lakeIds).text) + cursor; scrollDown(); }
    }
    if (!text.trim()) throw new Error("empty");
    return { text: text };
  }
  function openDoc(doc) {
    $("#sheet").innerHTML = '<header><div><h1>' + lib.esc(doc.title) + '</h1><div class="sub">SAR Cosmos document. Use Print or save as PDF.</div></div></header>' + lib.renderMarkdown(doc.markdown);
    var bar = document.querySelector("#sheet-modal .sheet-bar span"); if (bar) bar.textContent = "Document";
    $("#sheet-modal").hidden = false;
  }

  async function streamAnswer(question, holder) {
    var payload = { messages: msgs.slice(-MAX_SEND), context: lib.buildContext(D, getState ? getState() : {}, RAD) };
    ctrl = new AbortController();
    var res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
    if (!res.ok) {
      var err = {}; try { err = await res.json(); } catch (e) { /* not json */ }
      if (err.error === "rate_limited") return { text: err.message || "Daily limit reached. Please try again tomorrow.", limited: true };
      throw new Error("service " + res.status);
    }
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = "", text = "", cursor = '<span class="caret"></span>';
    for (;;) {
      var r = await reader.read(); if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      var i;
      while ((i = buf.indexOf("\n\n")) !== -1) {
        var block = buf.slice(0, i); buf = buf.slice(i + 2);
        block.split("\n").forEach(function (line) {
          if (line.indexOf("data:") !== 0) return;
          var d = line.slice(5).trim(); if (!d || d === "[DONE]") return;
          var o; try { o = JSON.parse(d); } catch (e) { return; }
          if (o.error) throw new Error(o.error);
          if (o.t) { text += o.t; holder.body.innerHTML = lib.renderMarkdown(lib.extractActions(text, lakeIds).text) + cursor; scrollDown(); }
        });
      }
    }
    if (!text.trim()) throw new Error("empty");
    return { text: text };
  }

  async function ask(question) {
    question = String(question || "").trim().slice(0, 1500);
    if (!question || busy) return;
    $("#chat-welcome").hidden = true;
    msgs.push({ role: "user", content: question }); addMessage("user", question);
    busy = true; thinking(true); setStatus("thinking");
    var holder = addMessage("assistant", "", { streaming: true, html: '<span class="ping"><i></i><i></i><i></i></span>' });
    var final = null, usedAI = false;
    if (!final && window.claude && viewerOK !== false) {
      try { final = await viaViewerAI(question, holder); usedAI = !!final && !final.notGranted; } catch (e) { final = null; }
    }
    if (!final && deepOn() && navigator.gpu) {
      try { final = await viaDeep(question, holder); usedAI = true; } catch (e) { final = null; }
    }
    if (!final && endpoint) {
      try { final = await streamAnswer(question, holder); usedAI = !final.limited; online = true; }
      catch (e) {
        if (e && e.name === "AbortError") { final = { text: holder.body.textContent.replace(/\s+$/, "") || "Stopped." }; }
        else { online = false; }
      }
    }
    if (!final) {                                            // no AI reachable: Cosmo's offline brain answers
      var br = SC.brain ? SC.brain.answer(question, { D: D }) : null;
      var shown = br ? lib.extractActions(br.text, lakeIds).text : SC.qa.answer(question, D).html;
      holder.body.innerHTML = br ? lib.renderMarkdown(shown) : shown;
      if (endpoint && online === false) holder.body.innerHTML += '<p class="note">The AI service could not be reached, so Cosmo answered with its offline brain.</p>';
      msgs.push({ role: "assistant", content: br ? br.text : holder.body.textContent });
      finishAssistant(holder.row, holder.body, br ? br.text : "");
      if (br && br.doc) {
        var pdf = el("button", "act doc"); pdf.type = "button";
        pdf.innerHTML = "<span>PDF</span>Open as a printable document: " + lib.esc(br.doc.title);
        pdf.addEventListener("click", function () { openDoc(br.doc); });
        holder.body.appendChild(pdf);
      }
    } else {
      msgs.push({ role: "assistant", content: final.text });
      holder.body.innerHTML = lib.renderMarkdown(lib.extractActions(final.text, lakeIds).text);
      finishAssistant(holder.row, holder.body, final.text);
    }
    busy = false; ctrl = null; thinking(false); save();
    setStatus(usedAI ? "ai" : (window.claude && viewerOK !== false) || endpoint ? (online === false ? "down" : "ai") : "offline"); scrollDown();
  }

  function suggestions() {
    var st = getState ? getState() : {}, cur = D.lakes.filter(function (l) { return l.id === st.lake; })[0] || D.lakes[0], nm = cur.name.replace(/ \(.*\)/, "");
    return ["Explain this project in 30 seconds", "Tell me about " + nm, "Why can't optical satellites see these lakes in the monsoon?",
            "Which lake is growing fastest?", "Give me the fact sheet for " + nm, "Where can I read the source papers?"];
  }
  function renderSuggest() {
    var box = $("#chat-suggest"); box.innerHTML = "";
    suggestions().forEach(function (q) { var b = el("button", "", lib.esc(q)); b.type = "button"; b.addEventListener("click", function () { ask(q); }); box.appendChild(b); });
  }

  function replay() {
    $("#chat-msgs").innerHTML = "";
    $("#chat-welcome").hidden = msgs.length > 0;
    msgs.forEach(function (m) { addMessage(m.role, m.content); });
  }

  chat.open = function () { var c = $("#chat"); c.hidden = false; renderSuggest(); requestAnimationFrame(function () { c.classList.add("open"); $("#chat-input").focus(); }); scrollDown(); };
  chat.close = function () { var c = $("#chat"); c.classList.remove("open"); setTimeout(function () { c.hidden = true; }, 220); };
  chat.toggle = function () { $("#chat").hidden ? chat.open() : chat.close(); };
  chat.ask = ask;
  chat.reset = function () { if (ctrl) ctrl.abort(); msgs = []; save(); replay(); renderSuggest(); busy = false; thinking(false); };

  chat.init = function (data, stateFn, hookFns) {
    D = data; getState = stateFn; hooks = hookFns || {}; lakeIds = D.lakes.map(function (l) { return l.id; });
    RAD = window.SAR_COSMOS_RADAR && window.SAR_COSMOS_RADAR.lakes ? window.SAR_COSMOS_RADAR.lakes : {};
    endpoint = resolveEndpoint();
    $("#cosmo-big").innerHTML = cosmoHTML("lg"); $("#chat-av").innerHTML = cosmoHTML("sm");
    setStatus(endpoint || (window.claude && typeof window.claude.use === "function") ? "ai" : "offline");
    document.querySelectorAll(".btn-orb").forEach(function (o) { o.innerHTML = cosmoHTML("xs"); });
    msgs = load(); replay();

    var form = $("#chat-form"), input = $("#chat-input");
    function grow() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 130) + "px"; }
    input.addEventListener("input", grow);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.dispatchEvent(new Event("submit", { cancelable: true })); } });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) { if (ctrl) ctrl.abort(); return; }                       // the send button is a stop button while answering
      var v = input.value; input.value = ""; grow(); ask(v);
    });
    ["#ask-btn", "#ask-fab"].forEach(function (id) { $(id).addEventListener("click", chat.toggle); });
    $("#chat-close").addEventListener("click", chat.close); $("#chat-new").addEventListener("click", chat.reset);
    var dbtn = $("#chat-deep");
    if (dbtn) {
      dbtn.textContent = deepOn() ? "Deep: on" : "Deep: off";
      dbtn.addEventListener("click", function () {
        if (!navigator.gpu) { alert("The deep model runs on PC browsers with WebGPU (recent Chrome or Edge). Cosmo keeps using its offline brain here."); return; }
        var on = !deepOn();
        if (on && !confirm("Turn on the deep offline model?\n\nThe first time, it downloads a language model of about 1 GB. It is then cached in this browser. It runs on your computer's graphics card. Cosmo keeps its offline brain as the fallback.")) return;
        try { localStorage.setItem("sarcosmos.deep", on ? "1" : "0"); } catch (e) { /* private mode */ }
        dbtn.textContent = on ? "Deep: on" : "Deep: off";
      });
    }
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#chat").hidden) chat.close(); });

    // 3D tilt of the big avatar toward the pointer
    var big = $("#cosmo-big");
    $("#chat").addEventListener("pointermove", function (e) {
      var r = big.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / 220, y = (e.clientY - r.top - r.height / 2) / 220;
      big.style.setProperty("--ry", Math.max(-1, Math.min(1, x)) * 22 + "deg"); big.style.setProperty("--rx", Math.max(-1, Math.min(1, -y)) * 18 + "deg");
    });
  };
})();
