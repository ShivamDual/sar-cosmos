const pptxgen = require("pptxgenjs");
const { applyTheme } = require("/mnt/skills/public/pptx/scripts/apply_theme.js");

const C = { bg: "0B1B33", panel: "142A4D", line: "243A5E", ice: "F4F1EA", muted: "8FA3C4", cyan: "4FE3D0", amber: "FFB94D", dark: "060D1C" };
const THEME = { name: "SAR Cosmos Radar", headFontFace: "Georgia", bodyFontFace: "Calibri",
  colors: { dk1: "060D1C", lt1: "F4F1EA", dk2: "0B1B33", lt2: "142A4D", accent1: "4FE3D0", accent2: "FFB94D", accent3: "8FA3C4", accent4: "2F5F9E", accent5: "C7D7EE", accent6: "E0664A", hlink: "4FE3D0", folHlink: "8FA3C4" } };

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "SAR Cosmos: NASA Space Apps 2026 project deck";
pres.author = "Shivam (SAR Cosmos)";

function base(slide, n) {
  slide.background = { color: C.bg };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.32, w: 10, h: 0.305, fill: { color: C.dark }, line: { color: C.dark } });
  slide.addText("SAR Cosmos  |  NASA Space Apps 2026  |  Dancing with the SARs", { x: 0.45, y: 5.36, w: 8, h: 0.22, fontFace: "Calibri", fontSize: 8, color: C.muted, margin: 0, isTextBox: true });
  slide.addText(String(n) + " / 7", { x: 8.9, y: 5.36, w: 0.7, h: 0.22, fontFace: "Calibri", fontSize: 8, color: C.muted, align: "right", margin: 0, isTextBox: true });
}
function title(slide, kicker, headline) {
  slide.addText(kicker.toUpperCase(), { x: 0.5, y: 0.32, w: 9, h: 0.25, fontFace: "Calibri", fontSize: 10, color: C.cyan, bold: true, charSpacing: 2, margin: 0, isTextBox: true });
  slide.addText(headline, { x: 0.5, y: 0.6, w: 9, h: 0.9, fontFace: "Georgia", fontSize: 26, color: C.ice, margin: 0, valign: "top", isTextBox: true });
}
function card(slide, x, y, w, h, big, label, color) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.panel }, line: { color: C.line, width: 0.75 } });
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.05, fill: { color: color || C.cyan }, line: { color: color || C.cyan } });
  slide.addText(big, { x: x + 0.2, y: y + 0.2, w: w - 0.4, h: 0.7, fontFace: "Georgia", fontSize: 34, color: color || C.cyan, margin: 0, isTextBox: true });
  slide.addText(label, { x: x + 0.2, y: y + 0.9, w: w - 0.4, h: h - 1.0, fontFace: "Calibri", fontSize: 12, color: C.ice, margin: 0, valign: "top", isTextBox: true });
}

/* 1 ---- title */
let s = pres.addSlide();
s.background = { color: C.dark };
s.addShape(pres.shapes.OVAL, { x: 7.4, y: -1.9, w: 4.8, h: 4.8, fill: { color: "0E2A52", transparency: 35 }, line: { color: C.line, width: 0.75 } });
s.addShape(pres.shapes.OVAL, { x: 8.2, y: -1.1, w: 3.2, h: 3.2, fill: { color: "0B1B33", transparency: 0 }, line: { color: C.cyan, width: 0.75, transparency: 40 } });
s.addShape(pres.shapes.OVAL, { x: 9.0, y: -0.4, w: 0.18, h: 0.18, fill: { color: C.amber }, line: { color: C.amber } });
s.addText("NASA SPACE APPS CHALLENGE 2026  ·  BHAKTAPUR (VIRTUAL)", { x: 0.6, y: 0.9, w: 8.5, h: 0.3, fontFace: "Calibri", fontSize: 11, color: C.cyan, bold: true, charSpacing: 2, margin: 0, isTextBox: true });
s.addText("SAR Cosmos", { x: 0.6, y: 1.25, w: 8.5, h: 1.0, fontFace: "Georgia", fontSize: 54, color: C.ice, margin: 0, isTextBox: true });
s.addText("Watching Nepal's glacial lakes from orbit, through the monsoon.", { x: 0.6, y: 2.3, w: 7.6, h: 0.7, fontFace: "Georgia", fontSize: 22, color: C.muted, margin: 0, isTextBox: true });
s.addText("Challenge: Dancing with the SARs  ·  Solo entry by Shivam", { x: 0.6, y: 3.6, w: 8.5, h: 0.3, fontFace: "Calibri", fontSize: 13, color: C.ice, margin: 0, isTextBox: true });
s.addText("Uses NISAR (NASA-ISRO) radar and Landsat (NASA/USGS) data", { x: 0.6, y: 3.92, w: 8.5, h: 0.3, fontFace: "Calibri", fontSize: 13, color: C.muted, margin: 0, isTextBox: true });
s.addNotes("Opening: name the project, the challenge, and the one-line promise: we can watch the lakes the clouds hide. This is a solo entry; say so plainly.");

/* 2 ---- the problem */
s = pres.addSlide(); base(s, 2);
title(s, "The problem", "21 lakes in Nepal are critically dangerous. Only 2 have proper mitigation.");
card(s, 0.5, 1.75, 2.9, 2.6, "21", "glacial lakes classed as critically dangerous in Nepal", C.amber);
card(s, 3.55, 1.75, 2.9, 2.6, "2", "of those lakes have had proper mitigation work", C.cyan);
card(s, 6.6, 1.75, 2.9, 2.6, "26", "glacial lake outburst floods (GLOFs) recorded since 1977, 14 starting inside Nepal", C.amber);
s.addText("Sources: ICIMOD (2011), cited in its 2019 Tsho Rolpa reassessment; ICIMOD and UNDP Nepal (2020). Counts are as published, not re-measured by us.", { x: 0.5, y: 4.55, w: 9, h: 0.5, fontFace: "Calibri", fontSize: 10, color: C.muted, margin: 0, isTextBox: true });
s.addNotes("Make the stakes human: a GLOF travels down a valley where people live. The numbers come from ICIMOD and UNDP; say they are published counts. Do not claim monitoring coverage beyond what the sources state.");

/* 3 ---- the monsoon gap (native chart from published measurement dates) */
s = pres.addSlide(); base(s, 3);
title(s, "Why optical satellites fail here", "Not one published optical measurement of these lakes falls between January and August.");
s.addChart(pres.charts.BAR, [{ name: "Published measurements", labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], values: [0,0,0,0,0,0,0,0,21,43,17,2] }], {
  x: 0.4, y: 1.7, w: 6.1, h: 3.4, barDir: "col", chartColors: [C.cyan], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.ice, dataLabelFontSize: 10,
  showLegend: false, showTitle: false, catAxisLabelColor: C.muted, valAxisLabelColor: C.muted, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9,
  valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: "none" }, valAxisMaxVal: 50, catAxisLineShow: false, valAxisLineShow: false });
s.addShape(pres.shapes.RECTANGLE, { x: 6.85, y: 1.8, w: 2.65, h: 3.2, fill: { color: C.panel }, line: { color: C.line, width: 0.75 } });
s.addText([
  { text: "The monsoon", options: { bold: true, color: C.amber, breakLine: true } },
  { text: "June to September: cloud covers the Himalaya on most days. Optical satellites need a clear sky, so they see almost nothing in the months when glaciers melt fastest.", options: { color: C.ice, breakLine: true } },
  { text: " ", options: { breakLine: true, fontSize: 6 } },
  { text: "Our count", options: { bold: true, color: C.cyan, breakLine: true } },
  { text: "83 published measurements of the six lakes, 2000 to 2015. All 83 are from September to December.", options: { color: C.ice } }
], { x: 7.05, y: 1.95, w: 2.3, h: 2.9, fontFace: "Calibri", fontSize: 12, margin: 0, valign: "top", isTextBox: true });
s.addText("Source: publication dates in Rounce et al. (2016), HESS 20, 3455-3475, supplement Table S.7.", { x: 0.5, y: 5.05, w: 9, h: 0.25, fontFace: "Calibri", fontSize: 9, color: C.muted, margin: 0, isTextBox: true });
s.addNotes("This is the gap the whole project answers. Be exact: the chart shows measurement dates in the published record, not the number of satellite passes. The claim is that the record has a hole exactly where the monsoon sits.");

/* 4 ---- radar answer */
s = pres.addSlide(); base(s, 4);
title(s, "Why radar", "Radar sends its own signal, so it sees through cloud, day or night.");
const pts = [
  ["1", "Its wavelength passes cloud", "NISAR's L-band wavelength is about 24 cm. Cloud droplets are micrometres across, so cloud is almost transparent to it."],
  ["2", "Calm water shows up dark", "Water reflects the pulse away from the sensor, so a lake appears as a dark, clear shape in the radar image."],
  ["3", "It comes back every 12 days", "NISAR revisits the same ground about every 12 days. Calibrated public data starts from 17 June 2026."]
];
pts.forEach((p, i) => {
  const y = 1.75 + i * 1.02;
  s.addShape(pres.shapes.OVAL, { x: 0.55, y: y + 0.05, w: 0.5, h: 0.5, fill: { color: C.cyan }, line: { color: C.cyan } });
  s.addText(p[0], { x: 0.55, y: y + 0.05, w: 0.5, h: 0.5, fontFace: "Georgia", fontSize: 16, color: C.dark, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText(p[1], { x: 1.25, y: y, w: 8.2, h: 0.3, fontFace: "Calibri", fontSize: 15, bold: true, color: C.ice, margin: 0, isTextBox: true });
  s.addText(p[2], { x: 1.25, y: y + 0.32, w: 8.2, h: 0.55, fontFace: "Calibri", fontSize: 12, color: C.muted, margin: 0, valign: "top", isTextBox: true });
});
s.addText("Availability: our team's search of the ASF archive found 28 to 36 calibrated NISAR GCOV scenes over each of the six lakes, 20 June to 15 October 2026.", { x: 0.5, y: 4.8, w: 9, h: 0.35, fontFace: "Calibri", fontSize: 11, color: C.amber, margin: 0, isTextBox: true });
s.addNotes("Explain the physics in one breath: radar makes its own light, cloud is too small to block it, and water is smooth so it looks dark. Scene counts come from our search of the ASF archive, not from a finished measurement.");

/* 5 ---- method */
s = pres.addSlide(); base(s, 5);
title(s, "How the numbers are made", "One plain method for two sensors, with a check that every lake must pass.");
const steps = [
  ["Optical history", "Landsat 5, 7, 8 and 9 (2000 onward) via Google Earth Engine. Water is found with NDWI, and the threshold is chosen for each image (Otsu's method)."],
  ["Radar scenes", "NISAR GCOV backscatter in decibels. A 3x3 median filter calms speckle. The threshold is chosen per scene."],
  ["One water patch only", "Only the dark patch that contains the lake's coordinates is counted. Radar shadow is dark too, so any other patch is logged and excluded."],
  ["Validation", "Optical areas are compared with published areas for the same lakes and dates. Radar is compared with optical from within 14 days."]
];
steps.forEach((st, i) => {
  const x = 0.5 + i * 2.28;
  s.addShape(pres.shapes.RECTANGLE, { x, y: 1.75, w: 2.1, h: 3.05, fill: { color: C.panel }, line: { color: C.line, width: 0.75 } });
  s.addText(String(i + 1).padStart(2, "0"), { x: x + 0.18, y: 1.9, w: 1.7, h: 0.4, fontFace: "Georgia", fontSize: 20, color: C.amber, margin: 0, isTextBox: true });
  s.addText(st[0], { x: x + 0.18, y: 2.35, w: 1.8, h: 0.5, fontFace: "Calibri", fontSize: 13, bold: true, color: C.ice, margin: 0, valign: "top", isTextBox: true });
  s.addText(st[1], { x: x + 0.18, y: 2.9, w: 1.8, h: 1.8, fontFace: "Calibri", fontSize: 10.5, color: C.muted, margin: 0, valign: "top", isTextBox: true });
});
s.addNotes("Keep this slide to the four steps. Judges may ask about any step; the answers are in the project's README and docs/DESIGN.md. Do not show the pipeline numbers on this slide unless the real run has produced them.");

/* 6 ---- published record: 2010 to 2015 change, our growth tiers */
s = pres.addSlide(); base(s, 6);
title(s, "What the published record shows", "Between 2010 and 2015, Lower Barun grew fastest. Thulagi and Hongu barely changed.");
s.addChart(pres.charts.BAR, [{ name: "Change 2010 to 2015 (%)", labels: ["Lower Barun","Imja Tsho","Lumding Tsho","Tsho Rolpa","Hongu","Thulagi"], values: [20.2,14.9,12.7,2.8,0.1,-0.4] }], {
  x: 0.4, y: 1.7, w: 6.0, h: 3.35, barDir: "bar", chartColors: [C.cyan], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.ice, dataLabelFontSize: 10, dataLabelFormatCode: "+0.0;-0.0",
  showLegend: false, showTitle: false, catAxisLabelColor: C.ice, valAxisLabelColor: C.muted, catAxisLabelFontSize: 11, valAxisLabelFontSize: 9,
  valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: "none" }, valAxisMinVal: -5, valAxisMaxVal: 25, catAxisLabelPos: "low", catAxisLineShow: false, valAxisLineShow: false });
s.addShape(pres.shapes.RECTANGLE, { x: 6.7, y: 1.8, w: 2.8, h: 3.2, fill: { color: C.panel }, line: { color: C.line, width: 0.75 } });
s.addText([
  { text: "Growth tiers (our rule)", options: { bold: true, color: C.amber, breakLine: true } },
  { text: "Under 10%: Low.  Under 25%: Moderate.  Under 40%: High.  40% or more: Critical.", options: { color: C.ice, breakLine: true } },
  { text: " ", options: { breakLine: true, fontSize: 6 } },
  { text: "Important", options: { bold: true, color: C.cyan, breakLine: true } },
  { text: "The tiers describe how fast a lake is growing. They are not the chance of a flood.", options: { color: C.ice } }
], { x: 6.9, y: 1.95, w: 2.45, h: 2.9, fontFace: "Calibri", fontSize: 11.5, margin: 0, valign: "top", isTextBox: true });
s.addText("Source: Rounce et al. (2016), published areas, about 10% error each. Figures are two-point changes, 2010 to 2015.", { x: 0.5, y: 5.05, w: 9, h: 0.25, fontFace: "Calibri", fontSize: 9, color: C.muted, margin: 0, isTextBox: true });
s.addNotes("Say clearly that these are published numbers. Our own radar and optical runs will replace and extend this record once they are finished. Do not present any figure here as a satellite result from this project.");

/* 7 ---- limits, next, sources */
s = pres.addSlide(); base(s, 7);
title(s, "Limits, next steps and sources", "We state what this project does not do, and what comes next.");
s.addText([
  { text: "What it does not do", options: { bold: true, color: C.amber, breakLine: true } },
  { text: "Forecast outbursts, flood timing or depth. That needs flood modelling by the responsible authorities.", options: { bullet: true, color: C.ice, breakLine: true, paraSpaceAfter: 4 } },
  { text: "Claim certainty: published areas carry about 10% error.", options: { bullet: true, color: C.ice, breakLine: true, paraSpaceAfter: 4 } },
  { text: "Include a radar history yet: calibrated public NISAR data starts June 2026, so the long record is optical.", options: { bullet: true, color: C.ice, breakLine: true, paraSpaceAfter: 4 } },
  { text: "The 3D terrain on the website is generated for illustration.", options: { bullet: true, color: C.ice } }
], { x: 0.5, y: 1.7, w: 4.6, h: 2.6, fontFace: "Calibri", fontSize: 12, margin: 0, valign: "top", isTextBox: true });
s.addText([
  { text: "Next", options: { bold: true, color: C.cyan, breakLine: true } },
  { text: "Run the Landsat and NISAR pipelines for every lake, validate against published values, and publish the results on the project site.", options: { color: C.ice, breakLine: true } },
  { text: " ", options: { breakLine: true, fontSize: 6 } },
  { text: "Sources", options: { bold: true, color: C.cyan, breakLine: true } },
  { text: "Rounce et al. (2016), HESS 20, 3455-3475.  ICIMOD (2011, 2019).  ICIMOD and UNDP Nepal (2020).  Watanabe et al. (2009), Norsk Geografisk Tidsskrift 63(4).  NISAR GCOV, via ASF DAAC.  Landsat 5-9 via Google Earth Engine.", options: { color: C.muted, breakLine: true } },
  { text: " ", options: { breakLine: true, fontSize: 6 } },
  { text: "AI assistance: this project was built with substantial AI coding assistance. The team directed the approach and checked every figure against its source.", options: { color: C.muted, italic: true } }
], { x: 5.4, y: 1.7, w: 4.1, h: 3.4, fontFace: "Calibri", fontSize: 11, margin: 0, valign: "top", isTextBox: true });
s.addNotes("End with the limits, which judges will respect, then the next step. Keep the AI disclosure on the slide; do not remove it.");

pres.writeFile({ fileName: "/home/claude/deck/SAR-Cosmos-7-slides.pptx" }).then(async () => {
  await applyTheme("/home/claude/deck/SAR-Cosmos-7-slides.pptx", THEME);
  console.log("written");
});
