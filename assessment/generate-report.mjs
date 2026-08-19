import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(dir, "remediation-report.md"), "utf8");

const plain = source
  .replace(/\r/g, "")
  .replace(/^> /gm, "Note: ")
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/\*\*/g, "")
  .replace(/`/g, "")
  .replace(/—/g, "-")
  .replace(/–/g, "-")
  .replace(/’/g, "'");

const wrapped = [];
for (const raw of plain.split("\n")) {
  const line = raw.trimEnd();
  if (!line) {
    wrapped.push("");
    continue;
  }
  let rest = line;
  while (rest.length > 92) {
    let at = rest.lastIndexOf(" ", 92);
    if (at < 1) at = 92;
    wrapped.push(rest.slice(0, at));
    rest = rest.slice(at).trimStart();
  }
  wrapped.push(rest);
}

const pages = [];
for (let i = 0; i < wrapped.length; i += 54) pages.push(wrapped.slice(i, i + 54));

const objects = [null];
const add = (value) => (objects.push(value), objects.length - 1);
const catalogId = add("");
const pagesId = add("");
const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
const pageIds = [];

const escapePdf = (text) => text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

for (const [pageIndex, lines] of pages.entries()) {
  const commands = ["BT", "/F1 9 Tf", "12 TL", "50 790 Td"];
  lines.forEach((line, index) => {
    if (index) commands.push("T*");
    commands.push(`(${escapePdf(line)}) Tj`);
  });
  commands.push("ET", "BT", "/F1 8 Tf", `270 25 Td`, `(Page ${pageIndex + 1} of ${pages.length}) Tj`, "ET");
  const stream = commands.join("\n");
  const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
}

objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

let pdf = "%PDF-1.4\n";
const offsets = [0];
for (let id = 1; id < objects.length; id += 1) {
  offsets[id] = Buffer.byteLength(pdf);
  pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

fs.writeFileSync(path.join(dir, "remediation-report.pdf"), pdf, "binary");
