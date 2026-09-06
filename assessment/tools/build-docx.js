const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const HTMLtoDOCX = require('html-to-docx');

const ROOT = '/mnt/d_drive/linuxstorage/Projects/ai-interview-platform';
const A = path.join(ROOT, 'assessment');
const SHOTS = path.join(A, 'screenshots');

const SECTIONS = [
  ['02-context-and-domain.md',    'Step 2 — Product Context & Domain Immersion'],
  ['03-problem-and-gap.md',       'Step 3 — Problem & Gap to Ideal Condition'],
  ['04-strategy-and-tradeoffs.md','Step 4 — Revamp Strategy, Acceptance Criteria & Trade-offs'],
  ['05-execution-proof.md',       'Step 5 — Monozukuri Execution Proof'],
  ['ai-verification-log.md',      'Appendix A — AI Verification Log'],
  ['assumptions.md',              'Appendix B — Assumptions & Ambiguities'],
  ['pull-request-body.md',        'Appendix C — Pull Request Description'],
];

const SHOT_GROUPS = [
  ['Before', [
    ['01-ui-before-fitgap.png',
     'The fit/gap report as shipped. The <b>Required</b> column is empty on all six rows, and no pencil marker appears anywhere &mdash; despite a real assessor override on Communication and a legend that promises one.'],
    ["02-ui-before-portofolio(can't choose vacancy when mobile view).png",
     'The portfolio page at phone width. Content is squeezed into a narrow column beside empty space, body text wraps to one or two words per line, and the override control truncates to &ldquo;Edit ov&hellip;&rdquo;.'],
    ['13-mobile-shell-before-header-fix.png',
     'The application shell at phone width &mdash; the actual cause, found only after opening a real browser. Every page inherited it, so patching individual components could not have fixed it (VER-04).'],
  ]],
  ['After', [
    ['10-after-fitgap-desktop.png',
     'Required is populated on every row. Communication shows L2 struck through, then L3, with the pencil marker &mdash; the assessor&rsquo;s correction is visible on the deciding screen. The new <b>Evidence</b> column separates the two &ldquo;Match&rdquo; verdicts that previously looked identical: React at <b>High, 3 quotes</b> against Micro-frontend at <b>Low, 1 quote</b>. Testing &amp; Quality Assurance reads &ldquo;Never probed&rdquo; on a dashed row rather than a bare dash, and the summary counts it explicitly.'],
    ['14-after-degraded-banner.png',
     'The same page, lower. A failed model call is now announced rather than hidden, and the fallback text appears under &ldquo;Rule-based Summary&rdquo; instead of masquerading as a culture assessment. The sentence is also grammatical &mdash; it previously read &ldquo;1 gaps&rdquo;.'],
    ['11-after-fitgap-mobile.png',
     'The comparison table below the sm breakpoint. Rows become labelled cards using the same data-label attributes the desktop table uses, so there is one DOM rather than a duplicated mobile tree.'],
    ['12-after-empty-state.png',
     'A vacancy with no skills defined. This previously raised RecordInvalid, exhausted the worker&rsquo;s retries and left the UI polling a report that would never arrive. It now renders an empty state naming the cause. The panel below also shows confidence rendered verbatim &mdash; &ldquo;Medium confidence&rdquo;, where the old code printed &ldquo;confirmed&rdquo;.'],
  ]],
];

const b64 = f => fs.readFileSync(path.join(SHOTS, f)).toString('base64');
const BREAK = '<p style="page-break-before:always">&nbsp;</p>';

marked.setOptions({ mangle: false, headerIds: false });

let body = '';
SECTIONS.forEach(([file, title], i) => {
  let md = fs.readFileSync(path.join(A, file), 'utf8').replace(/^#\s+.*\n/, '');
  body += (i ? BREAK : '') + `<h1>${title}</h1>` + marked(md);
});

body += BREAK + '<h1>Appendix D — Screenshots</h1>';
SHOT_GROUPS.forEach(([group, items]) => {
  body += `<h2>${group}</h2>`;
  items.forEach(([f, cap]) => {
    if (!fs.existsSync(path.join(SHOTS, f))) return;
    body += `<p><img src="data:image/png;base64,${b64(f)}" width="620" /></p>`
          + `<p><i>${cap}</i></p>`;
  });
});

const VIDEO = process.env.VIDEO_LINK || '__PASTE_VIDEO_LINK_HERE__';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { font-family: Calibri, sans-serif; font-size: 11pt; }
  h1 { font-size: 18pt; }
  h2 { font-size: 14pt; }
  h3 { font-size: 12pt; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 4px 6px; font-size: 9.5pt; vertical-align: top; }
  th { background: #eee; }
  pre { background: #f5f5f5; border: 1px solid #ddd; padding: 6px; font-family: Consolas, monospace; font-size: 9pt; }
  code { font-family: Consolas, monospace; font-size: 9.5pt; }
  blockquote { border-left: 3px solid #888; margin-left: 0; padding-left: 12px; font-style: italic; }
</style></head><body>

<h1>Evidence-Aware Fit/Gap</h1>
<p><b>Rakamin Case Study &middot; Fullstack Product Engineer</b></p>
<blockquote>This system measures how much evidence stands behind each judgement,
and then discards that measurement at the exact moment a human uses it to decide.</blockquote>
<table>
  <tr><th width="22%">Candidate</th><td>Zindu Pratama</td></tr>
  <tr><th>Submitted</th><td>7 September 2026</td></tr>
  <tr><th>Pull request</th><td>https://github.com/rakamindev/ai-interview-platform/pull/116 (open, not merged)</td></tr>
  <tr><th>Video</th><td>${VIDEO}</td></tr>
  <tr><th>Result</th><td>13 findings documented, 11 fixed, 3 P0 closed &middot; 0 to 52 automated tests &middot; CI from nothing</td></tr>
</table>
${body}
</body></html>`;

HTMLtoDOCX(html, null, {
  orientation: 'portrait',
  margins: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
  table: { row: { cantSplit: true } },
  footer: true,
  pageNumber: true,
}).then(buf => {
  const out = path.join(ROOT, 'Rakamin-CaseStudy-ZinduPratama.docx');
  fs.writeFileSync(out, buf);
  console.log('written:', out, (buf.length/1048576).toFixed(2) + ' MB');
});
