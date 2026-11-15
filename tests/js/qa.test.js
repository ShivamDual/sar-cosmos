// Run:  node tests/js/qa.test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
global.window = {}; 
eval(fs.readFileSync(path.join(__dirname, "../../site/data.js"), "utf8"));
const D = window.SAR_COSMOS_DATA;
const qa = require("../../site/js/qa.js");
const text = (q) => qa.answer(q, D).html.replace(/<[^>]+>/g, " ");
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

ok("fastest lake is the one with the largest 5-year change", () => {
  const top = D.lakes.slice().sort((a, b) => b.change5yrPct - a.change5yrPct)[0];
  const t = text("Which lake grows fastest?");
  assert(t.includes("1. " + top.name.replace(/ \(.*\)/, "")), t);
  assert(t.includes(top.change5yrPct.toFixed(1)), t);
});
ok("area answer quotes the real latest area", () => {
  const l = D.lakes.find(x => x.id === "imja_tsho");
  assert(text("How big is Imja Tsho?").includes(l.latestAreaKm2.toFixed(2)));
});
ok("risk answer states tier and the rule is ours", () => {
  const l = D.lakes.find(x => x.id === "lower_barun");
  const t = text("what is the risk at lower barun");
  assert(t.includes(l.riskTier + " risk") && t.includes("our own plain rule"), t);
});
ok("downstream answer uses exposure facts only", () => {
  const t = text("What is downstream of Tsho Rolpa?");
  assert(t.includes("Upper Tamakoshi") && t.includes("not a model"), t);
  assert(!/minutes|mins|[0-9]+ ?m3/.test(t), "no invented travel times or discharges");
});
ok("flood timing questions are refused honestly", () => {
  for (const q of ["When will Imja burst?", "how many minutes until the flood arrives", "should we evacuate"]) {
    const t = text(q); assert(/can't tell|does not forecast/i.test(t), q + " -> " + t);
  }
});
ok("radar answer has the real physics, no made-up percentages", () => {
  const t = text("why radar and not optical?");
  assert(t.includes("24 cm") && t.includes("12 days") && !/[0-9]+%/.test(t), t);
});
ok("data answer reports the live data mode", () => assert(text("where does the data come from").includes(D.dataLabel)));
ok("unknown question falls back to help and never echoes input", () => {
  const t = text("<script>alert(1)</script> zzzz");
  assert(t.includes("don't have an answer") && !t.includes("alert"), t);
});
ok("no answer contains a raw number the data does not hold", () => {
  const all = ["tell me about thulagi", "growth of lumding", "size of hongu", "risk of imja"].map(text).join(" ");
  assert(!/18,000|25,000|8,500|7,000|150 ?m/.test(all));
});
console.log(n + " checks passed");
