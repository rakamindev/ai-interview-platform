# Report builder

Assembles the written deliverables plus the screenshots into a single
self-contained HTML file, which Chrome then prints to A4 PDF. Images are
inlined as base64 so the HTML can be opened or archived on its own.

```bash
cd assessment/tools && npm i marked && node build-report.js
google-chrome-stable --headless=new --no-pdf-header-footer \
  --print-to-pdf=Rakamin-CaseStudy.pdf file://$PWD/../../report.html
```

`build-docx.js` produces the same content as an editable `.docx` for manual
tidying before submission:

```bash
cd assessment/tools && npm i marked html-to-docx
VIDEO_LINK="https://..." node build-docx.js
```

The generated `report.html`, the PDF and the `.docx` are intentionally not committed — they
are derived artifacts, and a 1.4 MB binary in the diff would obscure the change
this pull request is actually about.
