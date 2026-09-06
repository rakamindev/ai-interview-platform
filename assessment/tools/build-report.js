const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = '/mnt/d_drive/linuxstorage/Projects/ai-interview-platform';
const A = path.join(ROOT, 'assessment');
const SHOTS = path.join(A, 'screenshots');

const SECTIONS = [
  ['02-context-and-domain.md',   'Step 2 — Product Context & Domain Immersion'],
  ['03-problem-and-gap.md',      'Step 3 — Problem & Gap to Ideal Condition'],
  ['04-strategy-and-tradeoffs.md','Step 4 — Revamp Strategy, Acceptance Criteria & Trade-offs'],
  ['05-execution-proof.md',      'Step 5 — Monozukuri Execution Proof'],
  ['ai-verification-log.md',     'Appendix A — AI Verification Log'],
  ['assumptions.md',             'Appendix B — Assumptions & Ambiguities'],
  ['pull-request-body.md',       'Appendix C — Pull Request Description'],
];

const SHOT_GROUPS = [
  ['The fit/gap report — the screen a hire is decided on', [
    ['01-before-fitgap.png', 'before',
     'One capture, five defects. The <b>Required</b> column is empty on all six rows, so the table cannot support the comparison it exists to make. The legend promises a ✏ for a human override, and none appears — although an assessor really had corrected Communication from L2 to L3. The narrative reads <i>“Candidate shows 3 skill matches, 1 exceeds, and 1 gaps”</i>: a rule-based fallback shown under a heading that claims a culture assessment, with a grammar defect. And the panel below announces Micro-frontend Architecture as <i>“not in vacancy requirements”</i> at level <b>2</b> — a bare integer where a level label belongs, about a skill the table above lists as a matched requirement.'],
    ['10-after-fitgap-desktop.png', 'after',
     'Required is populated. Communication carries <s>L2</s> → L3 with the ✏, so the assessor’s correction survives to the deciding screen. The new <b>Evidence</b> column separates two verdicts that previously rendered identically — React at <b>High · 3 quotes</b> against Micro-frontend at <b>Low · 1 quote</b>. Testing &amp; Quality Assurance reads “Never probed” on a dashed row rather than a bare dash, the summary counts it, and a note flags how many rows rest on low confidence.'],
    ['14-after-degraded-banner.png', 'after',
     'The same page, lower. A failed model call is announced instead of hidden, and the fallback appears under <i>“Rule-based Summary”</i> rather than masquerading as a culture assessment. The sentence is grammatical in every branch.'],
    ['12-after-empty-state.png', 'after',
     'A vacancy with no skills defined. This previously raised <code>RecordInvalid</code>, exhausted the worker’s retries, and left the UI polling a report that would never arrive — with no error anywhere. It now names the cause. The panel below also shows confidence rendered verbatim as “Medium confidence”, where the previous code printed “confirmed”.'],
  ]],
  ['Responsive — the same screens on a phone', [
    ['02-ui-before-portofolio(can\'t choose vacancy when mobile view).png', 'before',
     'The portfolio page at phone width. Content is squeezed into a narrow column beside empty space, body text wraps to one or two words per line, and the override control truncates to “Edit ov…”. The two things the screen exists for — reading the evidence and reaching the override — are both unreachable.'],
    ['13-mobile-shell-before-header-fix.png', 'before',
     'The application shell, which turned out to be the actual cause. A non-wrapping flex header whose contents exceed a phone viewport, inherited by every page — so no component-level patch could have fixed it. Found only after opening a real browser, not from the test suite (VER-04).'],
    ['11-after-fitgap-mobile.png', 'after',
     'The comparison table below the <code>sm</code> breakpoint. Rows become labelled cards using the same <code>data-label</code> attributes the desktop table uses, so there is one DOM rather than a duplicated mobile tree.'],
  ]],
];

const b64 = f => fs.readFileSync(path.join(SHOTS, f)).toString('base64');

// Portrait phone captures and wide desktop captures need different treatment:
// forcing a 432px-wide screenshot to full page width upscales it into a blurry
// full-page block, while a 1440px desktop capture constrained to a column is
// unreadable. Size by aspect ratio, read from the PNG header.
function pngSize(file) {
  const d = fs.readFileSync(path.join(SHOTS, file));
  return { w: d.readUInt32BE(16), h: d.readUInt32BE(20) };
}
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');

marked.setOptions({ mangle: false, headerIds: true });

let toc = '', body = '';
SECTIONS.forEach(([file, title], i) => {
  const id = 's' + i;
  toc += `<li><a href="#${id}">${title}</a></li>`;
  let md = fs.readFileSync(path.join(A, file), 'utf8');
  md = md.replace(/^#\s+.*\n/, '');               // drop the file's own H1
  body += `<section id="${id}"><h1>${title}</h1>${marked(md)}</section>`;
});

let shots = '<section id="shots"><h1>Appendix D — Screenshots</h1>';
SHOT_GROUPS.forEach(([group, items]) => {
  shots += `<h2>${group}</h2>`;
  const present = items.filter(([f]) => fs.existsSync(path.join(SHOTS, f)));

  const fig = ([f, kind, cap], cls) =>
    `<figure class="${cls}">`
    + `<span class="tag ${kind}">${kind}</span>`
    + `<img src="data:image/png;base64,${b64(f)}">`
    + `<figcaption>${cap}</figcaption></figure>`;

  // Phone captures are narrow; one per page wastes most of the page and makes
  // them hard to compare. Laid out as a row they read the way phone screens
  // actually get compared — side by side.
  const tall = present.filter(([f]) => { const {w,h} = pngSize(f); return w / h < 1.0; });
  const wide = present.filter(([f]) => { const {w,h} = pngSize(f); return w / h >= 1.0; });

  wide.forEach(it => { shots += fig(it, 'wide'); });
  if (tall.length) {
    shots += `<div class="row">${tall.map(it => fig(it, 'tall')).join('')}</div>`;
  }
});
shots += '</section>';
toc += '<li><a href="#shots">Appendix D — Screenshots</a></li>';

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rakamin Case Study — Fullstack Product Engineer</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.55 "Inter","Helvetica Neue",Arial,sans-serif; color:#18181b; margin:0; }
  h1 { font-size:19pt; line-height:1.25; margin:0 0 .8em; letter-spacing:-.01em; }
  h2 { font-size:14pt; margin:1.6em 0 .5em; letter-spacing:-.01em; border-bottom:1px solid #e4e4e7; padding-bottom:.25em; }
  h3 { font-size:11.5pt; margin:1.3em 0 .4em; }
  p, li { orphans:3; widows:3; }
  code { font:9.5pt "JetBrains Mono",Consolas,monospace; background:#f4f4f5; padding:.1em .3em; border-radius:3px; }
  pre { background:#fafafa; border:1px solid #e4e4e7; border-radius:6px; padding:.7em .9em; overflow:hidden;
        white-space:pre-wrap; word-break:break-word; page-break-inside:avoid; }
  pre code { background:none; padding:0; font-size:8.6pt; line-height:1.45; }
  table { border-collapse:collapse; width:100%; margin:.9em 0; font-size:9pt; page-break-inside:avoid; }
  th,td { border:1px solid #e4e4e7; padding:.42em .6em; text-align:left; vertical-align:top; }
  th { background:#f4f4f5; font-weight:600; }
  blockquote { margin:1em 0; padding:.6em 1em; border-left:3px solid #a1a1aa; background:#fafafa;
               font-style:italic; page-break-inside:avoid; }
  section { page-break-before:always; }
  section:first-of-type { page-break-before:avoid; }
  figure { margin:0 0 12mm; page-break-inside:avoid; text-align:center; }
  figure img { border:1px solid #d4d4d8; border-radius:6px; display:block; margin:0 auto; }
  figure.wide img { width:100%; max-height:140mm; object-fit:contain; }
  figure.tall { flex:1 1 0; min-width:0; margin-bottom:0; }
  figure.tall img { width:auto; max-width:100%; max-height:118mm; }
  .row { display:flex; gap:7mm; align-items:flex-start; page-break-inside:avoid;
         margin-bottom:10mm; }
  .row figcaption { font-size:8pt; max-width:none; }
  figcaption { font-size:8.6pt; color:#52525b; margin:.6em auto 0; line-height:1.5;
               text-align:left; max-width:150mm; }
  .tag { display:inline-block; font-size:7.6pt; font-weight:700; letter-spacing:.09em;
         text-transform:uppercase; padding:.18em .6em; border-radius:3px; margin-bottom:.5em; }
  .tag.before { color:#9f1239; background:#ffe4e6; }
  .tag.after  { color:#065f46; background:#d1fae5; }
  #shots h2 { margin-top:0; page-break-after:avoid; }
  .cover { page-break-after:always; padding-top:52mm; }
  .cover h1 { font-size:27pt; margin-bottom:.15em; }
  .cover .sub { font-size:13pt; color:#52525b; margin-bottom:2.6em; }
  .cover .thesis { border-left:3px solid #18181b; padding:.8em 1.2em; font-size:11.5pt; background:#fafafa; margin-bottom:2.2em; }
  .cover dl { display:grid; grid-template-columns:34mm 1fr; gap:.45em 1em; font-size:10pt; }
  .cover dt { color:#71717a; }
  .cover dd { margin:0; }
  nav { page-break-after:always; }
  nav ol { padding-left:1.2em; line-height:2; }
  a { color:#18181b; }
</style></head><body>

<div class="cover">
  <h1>Evidence-Aware Fit/Gap</h1>
  <div class="sub">Rakamin Case Study &middot; Fullstack Product Engineer</div>
  <div class="thesis">This system measures how much evidence stands behind each judgement, and then discards that measurement at the exact moment a human uses it to decide.</div>
  <dl>
    <dt>Candidate</dt><dd>Zindu Pratama</dd>
    <dt>Submitted</dt><dd>7 September 2026</dd>
    <dt>Pull request</dt><dd>github.com/rakamindev/ai-interview-platform/pull/116<br><span style="color:#71717a">open, not merged</span></dd>
    <dt>Video</dt><dd>${process.env.VIDEO_LINK || '__PASTE_VIDEO_LINK_HERE__'}</dd>
    <dt>Result</dt><dd>13 findings documented, 11 fixed, 3 P0 closed &middot; 0 &rarr; 52 automated tests &middot; CI from nothing</dd>
  </dl>
</div>

<nav><h1>Contents</h1><ol>${toc}</ol></nav>
${body}${shots}
</body></html>`;

const out = path.join(SHOTS, '..', '..', 'report.html');
fs.writeFileSync(out, html);
console.log('written:', out, (html.length/1024/1024).toFixed(1)+' MB');
