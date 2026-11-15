const fs = require("fs"), path = require("path"), assert = require("assert");
global.window = {}; eval(fs.readFileSync(path.join(__dirname, "../../site/data.js"), "utf8"));
const D = window.SAR_COSMOS_DATA, lib = require("../../site/js/chatlib.js");
const ids = D.lakes.map(l => l.id); let n = 0; const ok = (m, f) => { f(); n++; console.log("  ok  " + m); };

ok("script tags and event handlers are escaped, never executed", () => {
  const h = lib.renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)> **bold**');
  assert(!/<script|<img/i.test(h) && h.includes("&lt;script&gt;") && h.includes("<strong>bold</strong>"), h);
});
ok("only http(s) links are rendered as links", () => {
  assert(!/href="javascript/i.test(lib.renderMarkdown("[x](javascript:alert(1))")));
  assert(lib.renderMarkdown("[ok](https://example.org/a?b=1&c=2)").includes('href="https://example.org/a?b=1&amp;c=2"'));
  assert(lib.renderMarkdown("[ok](https://a.org)").includes('rel="noopener noreferrer"'));
});
ok("quote characters cannot break out of an attribute", () => {
  const h = lib.renderMarkdown('[x](https://a.org/" onmouseover="alert(1))');
  assert(!/onmouseover=/.test(h.replace(/&quot;/g, "")) || !/" onmouseover/.test(h), h);
});
ok("lists, headings, code and paragraphs", () => {
  const h = lib.renderMarkdown("# Title\n\nHello `x` world\n\n- one\n- two\n\n1. a\n2. b\n\n```\ncode <b>\n```");
  assert(h.includes("<ul><li>one</li><li>two</li></ul>") && h.includes("<ol><li>a</li><li>b</li></ol>") && h.includes("<pre><code>code &lt;b&gt;"), h);
});
ok("a half-streamed marker is hidden", () => assert(!lib.renderMarkdown("See this [[she").includes("[[")));
ok("actions: whitelisted ids pass, invented ones are dropped, markers are stripped", () => {
  const r = lib.extractActions("Here.\n[[sheet:imja_tsho]]\n[[doc:rounce-supplement]]\n[[doc:evil]]\n[[sheet:atlantis]]\n[[brief]]\n[[sheet:imja_tsho]]", ids);
  assert.deepStrictEqual(r.actions.map(a => a.type + ":" + (a.id || "")), ["sheet:imja_tsho", "doc:rounce-supplement", "brief:"]);
  assert(!r.text.includes("[[") && r.text === "Here.", r.text);
});
ok("every document URL is https and on a known host", () => {
  for (const d of Object.values(lib.DOCS)) assert(/^https:\/\/(hess\.copernicus\.org|icimod\.org|www\.undp\.org|asf\.alaska\.edu|nisar-docs\.asf\.alaska\.edu|www\.spaceappschallenge\.org)\//.test(d.url), d.url);
});
ok("context is small, complete and carries the data status", () => {
  const c = lib.buildContext(D, { lake: "imja_tsho", tab: "trend", year: 2010 }, null), j = JSON.stringify(c);
  assert(j.length < 3500, "size " + j.length); assert(c.lakes.length === 6 && c.dataLabel === D.dataLabel && c.viewing.year === 2010);
});
console.log(n + " checks passed");
