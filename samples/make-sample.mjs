// Generates a minimal, valid, text-based multi-page PDF (no deps) for demos/tests.
// Run: node samples/make-sample.mjs
import { writeFileSync } from "node:fs";

const PAGES = [
  {
    title: "Photosynthesis: An Introduction",
    lines: [
      "Photosynthesis is the process by which green plants, algae, and some",
      "bacteria convert light energy into chemical energy stored in glucose.",
      "It takes place mainly in the leaves, inside organelles called chloroplasts.",
      "",
      "The overall reaction combines carbon dioxide and water, using light, to",
      "produce glucose and oxygen. In words: carbon dioxide plus water, in the",
      "presence of light energy, yields glucose plus oxygen.",
      "",
      "Chlorophyll is the green pigment inside chloroplasts. Its key role is to",
      "absorb light, most strongly in the blue and red parts of the spectrum,",
      "and it reflects green light, which is why leaves appear green.",
    ],
  },
  {
    title: "The Two Stages of Photosynthesis",
    lines: [
      "Photosynthesis happens in two connected stages.",
      "",
      "1. The light-dependent reactions occur in the thylakoid membranes.",
      "   They capture light energy and use it to split water molecules, a",
      "   process called photolysis. This releases oxygen as a by-product and",
      "   produces energy carriers known as ATP and NADPH.",
      "",
      "2. The light-independent reactions, also called the Calvin cycle, occur",
      "   in the stroma. They do not need light directly. Instead they use the",
      "   ATP and NADPH from the first stage to fix carbon dioxide into glucose.",
      "",
      "A common misconception is that the Calvin cycle happens at night. In fact",
      "it depends on the products of the light reactions, so it typically runs",
      "during the day, just without using light itself.",
    ],
  },
  {
    title: "Why Photosynthesis Matters",
    lines: [
      "Photosynthesis is the foundation of most food chains on Earth. Plants are",
      "primary producers: they make their own food and become the energy source",
      "for the organisms that eat them.",
      "",
      "The process also releases the oxygen that most living things need to",
      "breathe, and it removes carbon dioxide from the atmosphere, playing an",
      "important role in regulating the global carbon cycle.",
      "",
      "Several factors affect the rate of photosynthesis, including light",
      "intensity, carbon dioxide concentration, and temperature. Increasing a",
      "limiting factor speeds up the rate until another factor becomes limiting.",
    ],
  },
];

// ---- Minimal PDF builder with a correct xref table ----
function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildContentStream(page) {
  let y = 760;
  const parts = ["BT", "/F1 18 Tf", `1 0 0 1 72 ${y} Tm`, `(${esc(page.title)}) Tj`, "ET"];
  y -= 30;
  parts.push("BT", "/F2 12 Tf", `1 0 0 1 72 ${y} Tm`, "14 TL");
  parts.push(`(${esc(page.lines[0] ?? "")}) Tj`);
  for (let i = 1; i < page.lines.length; i++) parts.push("T*", `(${esc(page.lines[i])}) Tj`);
  parts.push("ET");
  return parts.join("\n");
}

const objects = [];
objects.push("<< /Type /Catalog /Pages 2 0 R >>"); // 1: catalog

const pageObjNums = PAGES.map((_, i) => 3 + i * 2);
objects.push(`<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${PAGES.length} >>`); // 2

for (let i = 0; i < PAGES.length; i++) {
  const pageNum = 3 + i * 2;
  const contentNum = pageNum + 1;
  objects[pageNum - 1] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
    `/Resources << /Font << /F1 ${3 + PAGES.length * 2} 0 R /F2 ${4 + PAGES.length * 2} 0 R >> >> ` +
    `/Contents ${contentNum} 0 R >>`;
  const stream = buildContentStream(PAGES[i]);
  objects[contentNum - 1] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
}

objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

// Serialize with xref
let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, idx) => {
  offsets[idx] = Buffer.byteLength(pdf, "latin1");
  pdf += `${idx + 1} 0 obj\n${body}\nendobj\n`;
});
const xrefStart = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
offsets.forEach((off) => {
  pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
});
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

const out = new URL("./photosynthesis.pdf", import.meta.url);
writeFileSync(out, Buffer.from(pdf, "latin1"));
console.log("Wrote", out.pathname, `(${PAGES.length} pages)`);
