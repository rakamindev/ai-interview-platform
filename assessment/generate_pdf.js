const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const reportMdPath = path.join(__dirname, 'REPORT.md');
const htmlOutputPath = path.join(__dirname, 'report.html');
const pdfOutputPath = path.join(__dirname, 'Fullstack_Product_Engineer_Assessment_Report.pdf');

console.log('Reading REPORT.md...');
let markdown = fs.readFileSync(reportMdPath, 'utf8');

// Replace image paths with base64 data URIs for self-contained PDF
markdown = markdown.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, imgPath) => {
  try {
    let cleanPath = imgPath.replace('file:///', '').replace(/^c:/i, 'C:');
    if (!fs.existsSync(cleanPath)) {
      cleanPath = path.join(__dirname, imgPath);
    }
    if (fs.existsSync(cleanPath)) {
      const ext = path.extname(cleanPath).replace('.', '');
      const base64 = fs.readFileSync(cleanPath).toString('base64');
      return `![${alt}](data:image/${ext};base64,${base64})`;
    }
  } catch (err) {
    console.warn('Could not embed image:', imgPath, err.message);
  }
  return match;
});

const tempMdPath = path.join(__dirname, '_temp_report.md');
fs.writeFileSync(tempMdPath, markdown);

console.log('Converting Markdown to HTML with marked...');
execSync(`npx -y marked -i "${tempMdPath}" -o "${htmlOutputPath}"`);
fs.unlinkSync(tempMdPath);

const bodyContent = fs.readFileSync(htmlOutputPath, 'utf8');

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Fullstack Product Engineer — Assessment Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  @page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-right {
      content: counter(page);
    }
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.6;
    font-size: 13px;
    margin: 0;
    padding: 0;
  }

  h1, h2, h3, h4, h5, h6 {
    color: #0f172a;
    font-weight: 700;
    line-height: 1.25;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }

  h1 {
    font-size: 24px;
    border-bottom: 2px solid #0f766e;
    padding-bottom: 8px;
    margin-top: 0;
  }

  h2 {
    font-size: 18px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 6px;
    margin-top: 2em;
    page-break-after: avoid;
  }

  h3 {
    font-size: 14.5px;
    margin-top: 1.2em;
    page-break-after: avoid;
  }

  h4 {
    font-size: 13px;
    page-break-after: avoid;
  }

  p, ul, ol {
    margin-top: 0;
    margin-bottom: 1em;
  }

  li {
    margin-bottom: 0.3em;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.2em 0;
    font-size: 12px;
    page-break-inside: avoid;
  }

  th, td {
    padding: 8px 10px;
    border: 1px solid #cbd5e1;
    text-align: left;
    vertical-align: top;
  }

  th {
    background-color: #f1f5f9;
    color: #0f172a;
    font-weight: 600;
  }

  tr:nth-child(even) td {
    background-color: #f8fafc;
  }

  code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11.5px;
    background-color: #f1f5f9;
    color: #0f766e;
    padding: 2px 4px;
    border-radius: 4px;
  }

  pre {
    background-color: #0f172a;
    color: #f8fafc;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    line-height: 1.45;
    margin: 1em 0;
    page-break-inside: avoid;
  }

  pre code {
    background-color: transparent;
    color: inherit;
    padding: 0;
  }

  blockquote {
    border-left: 4px solid #0f766e;
    background-color: #f0fdfa;
    color: #134e4a;
    margin: 1.2em 0;
    padding: 8px 14px;
    border-radius: 0 4px 4px 0;
  }

  img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    margin: 8px 0;
    display: block;
    page-break-inside: avoid;
  }

  hr {
    border: 0;
    border-top: 1px solid #e2e8f0;
    margin: 2em 0;
  }

  .page-break {
    page-break-before: always;
  }
</style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;

fs.writeFileSync(htmlOutputPath, fullHtml);
console.log('Saved styled HTML to:', htmlOutputPath);

console.log('Generating PDF via headless Chrome...');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
execSync(`"${chromePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfOutputPath}" "${htmlOutputPath}"`);

console.log('SUCCESS! PDF generated at:', pdfOutputPath);
