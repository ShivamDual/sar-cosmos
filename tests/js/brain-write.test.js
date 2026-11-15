// Run: node tests/js/brain-write.test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
global.window = {};
for (const f of ["../../site/data.js", "../../site/js/knowledge.js", "../../site/js/brain-data.js"]) eval(fs.readFileSync(path.join(__dirname, f), "utf8"));
const D = window.SAR_COSMOS_DATA;
window.SC = {};
require("../../site/js/brain.js");
require("../../site/js/brain-write.js");
const B = window.SC.brain;
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("  ok  " + name); };
const ask = (q, ctx = {}) => B.answer(q, { D, ...ctx });
const wc = (t) => (t.replace(/[*#>\-`]/g, " ").match(/\S+/g) || []).length;

ok("300-word essay about a lake lands near the target", () => {
  const r = ask("Write a 300 word essay on imja tosho");
  assert(r.doc && /Essay: Imja Tsho/.test(r.doc.markdown), r.text.slice(0, 120));
  const w = wc(r.doc.markdown); assert(w >= 230 && w <= 340, "word count " + w);
});
ok("essay about a lake mentions its real numbers and never forecasts a flood", () => {
  const md = ask("write an essay about lower barun").doc.markdown;
  assert(md.includes("Lower Barun") && md.includes("1.67"), md.slice(0, 200));
  assert(/not the chance of a flood/.test(md) && !/evacuate|arrive in \d+ minutes/i.test(md));
});
ok("a topic essay is built from Cosmo's own knowledge", () => {
  const r = ask("write a short essay on glaciers");
  assert(r.doc && /glacier/i.test(r.doc.markdown), r.text.slice(0, 120));
});
ok("a how-to question is NOT treated as a writing task", () => {
  const r = ask("how do i write a good university personal essay");
  assert(!r.doc, "should be a normal answer");
});
ok("a how-to pitch question is not a writing task", () => {
  assert(!ask("how do i write a good project pitch").doc);
});
ok("make a PDF of the previous answer", () => {
  ask("tell me about tsho rolpa");
  const r = ask("make a pdf of that");
  assert(r.doc && /Tsho Rolpa|Rolpa/.test(r.doc.markdown));
});
ok("speech and email formats produce their own structure", () => {
  assert(/Speech:/.test(ask("write a speech about thulagi").doc.markdown));
  assert(/Dear reader/.test(ask("draft an email about hongu").doc.markdown));
});
ok("normal questions still get normal answers", () => {
  assert(/Cosmo/.test(ask("who are you").text) && !ask("who are you").doc);
  assert(/15% of 240 is \*\*36\*\*|36/.test(ask("what is 15% of 240").text));
});
console.log(n + " writing checks passed");
