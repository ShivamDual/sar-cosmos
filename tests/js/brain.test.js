// Run: node tests/js/brain.test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
global.window = {};
for (const f of ["../../site/data.js", "../../site/js/knowledge.js", "../../site/js/brain-data.js"]) eval(fs.readFileSync(path.join(__dirname, f), "utf8"));
const D = window.SAR_COSMOS_DATA;
const SC = (global.SC = {}); // brain.js writes to window.SC
window.SC = SC;
require("../../site/js/brain.js");
const B = SC.brain;
let n = 0, fails = [];
function ask(q, expect, { fresh = false } = {}) {
  if (fresh) B.reset();
  const r = B.answer(q, { D }).text;
  const plain = r.toLowerCase();
  const pass = expect.every(e => (e instanceof RegExp ? e.test(r) : plain.includes(String(e).toLowerCase())));
  n++;
  if (!pass) fails.push({ q, got: r.slice(0, 220), want: expect });
  console.log((pass ? "  ok  " : "  FAIL ") + q);
  return r;
}
// ---- conversation basics
ask("Hi who are you", ["cosmo", "assistant"], { fresh: true });
ask("what are you", ["cosmo"]);
ask("hello", ["hi"]);
ask("how are you?", ["doing well"]);
ask("thanks a lot", ["welcome"]);
ask("bye", ["good luck"]);
ask("tell me a joke", [/./]);
ask("what time is it", [/\d{2}:\d{2}/]);
ask("who made you", ["shivam", "aarambh", "saurav"]);
// ---- maths
ask("what is 15% of 240", ["36"]);
ask("what is 12 * (3 + 4) ^ 2", ["588"]);
ask("calculate 7 / 2", ["3.5"]);
ask("what is 10 / 0", [/./]); // must not crash
// ---- lakes, live numbers
ask("How big is Imja Tsho?", ["imja tsho", "km²", "2015"], { fresh: true });
ask("What is Lower Barun's risk?", ["lower barun", "moderate risk", "growth rule"]);
ask("Which lake grows fastest?", ["fastest growing", "lower barun"]);
ask("which lake has the highest risk", ["by risk tier"]);
ask("Largest lake?", ["largest lakes"]);
ask("What is downstream of Tsho Rolpa?", ["downstream of tsho rolpa", "upper tamakoshi", "6,000"]);
ask("What is downstream of Thulagi?", ["marsyangdi"]);
ask("Is there mitigation at Imja?", ["mitigation at imja", "2016"]);
ask("Compare Imja Tsho and Lower Barun", ["here is how they compare", "imja tsho", "lower barun"]);
ask("when will Imja Tsho burst", ["can't tell you", "flood modelling"]);
ask("how soon would the flood arrive", ["can't tell you"]);
ask("should we evacuate", ["follow local authorities"]);
// ---- follow-ups remember the lake
ask("Tell me about Hongu", ["hongu", "chamlang"], { fresh: true });
ask("what about its growth?", ["hongu", "over the record"]);
ask("and its risk?", ["hongu", "risk"]);
// ---- method, radar, science
ask("Why does radar see through cloud?", ["cloud"]);
ask("What is NDWI?", ["ndwi", "green", "nir"]);
ask("what is L-band", ["24 cm"]);
ask("what is a GLOF", ["glof", "outburst"]);
ask("what is speckle", ["speckle", "median"]);
ask("what is radar shadow", ["shadow", "coordinates"]);
ask("how is the risk tier calculated", ["five-year", "growth"]);
ask("Why is optical blind in the monsoon", [/cloud|monsoon/]);
ask("what is the capital of nepal", ["kathmandu"]);
ask("why is the sky blue", ["scatter"]);
// ---- coding + study
ask("how do i compute ndwi in python", ["```python", "numpy"]);
ask("how do i open an hdf5 file", ["h5py"]);
ask("how do i study effectively", ["active recall"]);
ask("how do i win nasa space apps", ["honest"]);
// ---- documents and actions
ask("send me the fact sheet for Imja Tsho", ["[[sheet:imja_tsho]]"], { fresh: true });
ask("give me the data as a csv for Thulagi", ["[[csv:thulagi]]"]);
ask("I want the one-page brief pdf", ["[[brief]]"]);
ask("where does the data come from", ["rounce", "[[doc:rounce-paper]]"]);
ask("fly me to Lumding", ["[[lake:lumding]]"]);
ask("is this real data or published", ["published"]);
// ---- honesty fallback, never a dead end
const fb = ask("explain quantum chromodynamics in detail", ["don't have a solid answer", "connect the ai"]);
assert(!/only.*page/i.test(fb), "fallback must not say it can only talk about the page");
// no leaked markers, no raw html
for (const q of ["hi", "fact sheet imja", "where is the data", "tell me about Lumding", "what is an api key"]) {
  const t = B.answer(q, { D }).text; assert(!/<script|onerror/i.test(t), q);
}
console.log(`${n - fails.length} of ${n} checks passed`);
if (fails.length) { console.log("\nFAILURES:"); fails.forEach(f => console.log(JSON.stringify(f, null, 1))); process.exitCode = 1; }
