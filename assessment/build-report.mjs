// Builds REPORT.pdf from REPORT.md. The markdown is the source of truth; this
// exists so the PDF can be regenerated rather than hand-assembled.
//
//   npm i markdown-it
//   node build-report.mjs
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
//     --headless --disable-gpu --no-pdf-header-footer \
//     --print-to-pdf=REPORT.pdf file://$PWD/REPORT.html
//
// Chrome rather than a PDF library because the report is a styled document and
// Chrome is the only renderer here that agrees with what the CSS says.

import fs from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(HERE, "REPORT.md");
const OUT = path.join(HERE, "REPORT.html");

const md = new MarkdownIt({ html: true, linkify: false, typographer: true });

let source = fs.readFileSync(SRC, "utf8");

// Screenshots are embedded rather than linked so the HTML prints identically
// from anywhere and the PDF carries no external dependencies.
const inline = (rel) => {
  const file = path.join(HERE, rel);
  const b64 = fs.readFileSync(file).toString("base64");
  return `data:image/png;base64,${b64}`;
};

// Markdown images become <figure> so the caption (the paragraph in italics
// directly after) can be tied to them and kept on the same printed page.
const defaultImage = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet("src");
  if (src && !src.startsWith("data:")) token.attrSet("src", inline(src));
  return defaultImage(tokens, idx, options, env, self);
};

const body = md.render(source);

const css = `
:root {
  --ground: #ffffff;
  --ink: #14171a;
  --muted: #5a626b;
  --rule: #dfe4e7;
  --rule-strong: #b9c2c7;
  --accent: #0e6b6b;
  --flag: #8a4f00;
  --wash: #f5f8f8;
}

* { box-sizing: border-box; }

html { font-size: 10.5pt; }

body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif;
  font-feature-settings: "kern" 1, "liga" 1, "onum" 1;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

.page { max-width: 40rem; margin: 0 auto; padding: 0 0 3rem; }

/* ── Headings ───────────────────────────────────────────────────────────── */

h1, h2, h3, h4 {
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  color: var(--ink);
  break-after: avoid;
  page-break-after: avoid;
  text-wrap: balance;
}

h1 {
  font-size: 2.05rem;
  line-height: 1.12;
  letter-spacing: -0.022em;
  font-weight: 700;
  margin: 0 0 0.35rem;
}

h2 {
  font-size: 1.22rem;
  letter-spacing: -0.012em;
  font-weight: 650;
  margin: 2.6rem 0 0.9rem;
  padding-top: 0.85rem;
  border-top: 1.5px solid var(--rule-strong);
}

h3 {
  font-size: 1.02rem;
  letter-spacing: -0.006em;
  font-weight: 650;
  margin: 1.9rem 0 0.55rem;
}

h4 {
  font-size: 0.9rem;
  font-weight: 650;
  margin: 1.4rem 0 0.4rem;
}

p { margin: 0 0 0.85rem; }

/* The subtitle block under the title. */
h1 + p {
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  font-size: 0.92rem;
  color: var(--muted);
  line-height: 1.5;
  margin-bottom: 1.6rem;
}

hr {
  border: 0;
  border-top: 1.5px solid var(--rule-strong);
  margin: 2rem 0;
}

/* h2 draws its own border-top, so an hr immediately before one would print a
   double rule. Hide the hr, not the heading. */
hr:has(+ h2) { display: none; }

strong { font-weight: 650; }
em { font-style: italic; }

a { color: var(--accent); text-decoration: none; border-bottom: 0.5px solid rgba(14,107,107,0.35); }

/* ── Lists ──────────────────────────────────────────────────────────────── */

ul, ol { margin: 0 0 0.9rem; padding-left: 1.2rem; }
li { margin-bottom: 0.3rem; }
li > ul, li > ol { margin-top: 0.3rem; }

/* ── Code ───────────────────────────────────────────────────────────────── */

code {
  font-family: "SF Mono", "JetBrains Mono", ui-monospace, Menlo, monospace;
  font-size: 0.855em;
  background: var(--wash);
  padding: 0.08em 0.32em;
  border-radius: 2px;
}

pre {
  background: var(--wash);
  border-left: 2.5px solid var(--accent);
  padding: 0.8rem 0.95rem;
  margin: 0 0 1rem;
  overflow-x: auto;
  break-inside: avoid;
  page-break-inside: avoid;
}

pre code {
  background: none;
  padding: 0;
  font-size: 0.8rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Tables ─────────────────────────────────────────────────────────────── */

table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.4rem 0 1.3rem;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  font-size: 0.855rem;
  font-variant-numeric: tabular-nums;
  break-inside: avoid;
  page-break-inside: avoid;
}

thead th {
  text-align: left;
  font-weight: 620;
  font-size: 0.73rem;
  letter-spacing: 0.045em;
  text-transform: uppercase;
  color: var(--muted);
  border-bottom: 1.5px solid var(--rule-strong);
  padding: 0 0.6rem 0.4rem 0;
  vertical-align: bottom;
}

tbody td {
  border-bottom: 0.5px solid var(--rule);
  padding: 0.45rem 0.6rem 0.45rem 0;
  vertical-align: top;
  line-height: 1.45;
}

tbody tr:last-child td { border-bottom: 1.5px solid var(--rule-strong); }

/* A markdown table with no header text still emits a thead; an empty labelled
   strip above a two-column key/value list is noise. */
thead:has(th:empty) { display: none; }
thead:has(th:empty) + tbody tr:first-child td { border-top: 1.5px solid var(--rule-strong); }
th:last-child, td:last-child { padding-right: 0; }
table code { font-size: 0.8em; }

/* ── Blockquote ─────────────────────────────────────────────────────────── */

blockquote {
  margin: 0 0 1rem;
  padding-left: 0.95rem;
  border-left: 2.5px solid var(--rule-strong);
  color: var(--muted);
}

/* ── Figures ────────────────────────────────────────────────────────────── */

/* The desktop portfolio capture is 1280x2207. Left at 100% width it would run
   to two printed pages on its own, so height is capped and width follows. */
p > img {
  display: block;
  max-width: 100%;
  max-height: 230mm;
  width: auto;
  margin: 0.2rem auto 0.35rem;
  border: 0.5px solid var(--rule-strong);
  border-radius: 2px;
}

/* An image paragraph followed by an italic paragraph is a figure + caption:
   keep them together and set the caption apart from body prose. */
p:has(> img) {
  break-inside: avoid;
  page-break-inside: avoid;
  break-after: avoid;
  page-break-after: avoid;
  margin-bottom: 0.3rem;
}

p:has(> img) + p em {
  font-style: normal;
}

p:has(> img) + p {
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  font-size: 0.79rem;
  line-height: 1.5;
  color: var(--muted);
  border-left: 2px solid var(--accent);
  padding-left: 0.7rem;
  margin-bottom: 1.9rem;
  break-inside: avoid;
  page-break-inside: avoid;
}

/* ── Print ──────────────────────────────────────────────────────────────── */

@page {
  size: A4;
  margin: 17mm 18mm 16mm;
}

@media print {
  .page { max-width: none; padding: 0; }
  a { color: var(--ink); border-bottom: none; }
  h2 { margin-top: 1.9rem; }
}
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Ratings this product cannot defend</title>
<style>${css}</style>
</head>
<body><main class="page">
${body}
</main></body>
</html>
`;

fs.writeFileSync(OUT, html);
console.log(`wrote ${OUT} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
