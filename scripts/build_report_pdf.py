import re
import os
import subprocess
import html
import base64

ROOT_DIR = r"d:\Data Science\Rakamin"
MD_FILE = os.path.join(ROOT_DIR, "MONOZUKURI_SUBMISSION_REPORT.md")
HTML_FILE = os.path.join(ROOT_DIR, "MONOZUKURI_SUBMISSION_REPORT_TMP.html")
PDF_FILE = os.path.join(ROOT_DIR, "MONOZUKURI_SUBMISSION_REPORT.pdf")
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

with open(MD_FILE, "r", encoding="utf-8") as f:
    md_content = f.read()

# Image replacer function
def image_replacer(match):
    alt = match.group(1)
    src = match.group(2)
    full_path = os.path.normpath(os.path.join(ROOT_DIR, src))
    if os.path.exists(full_path):
        with open(full_path, "rb") as img_f:
            encoded = base64.b64encode(img_f.read()).decode("utf-8")
        ext = os.path.splitext(full_path)[1].lower().replace(".", "")
        mime = "image/png" if ext == "png" else "image/jpeg"
        
        # Check if it is a diagram or a screenshot
        is_diagram = "diagrams" in src or "sequence" in src or "tree" in src
        box_class = "diagram-box" if is_diagram else "screenshot-box"
        img_class = "diagram-img" if is_diagram else "screenshot-img"
        
        return f'<div class="{box_class}"><img src="data:{mime};base64,{encoded}" alt="{alt}" class="{img_class}" /></div>'
    return f'<p class="error">[Image not found: {src}]</p>'

# Clean markdown parser with zero extra spacing and zero broken tags
lines = md_content.split("\n")
html_parts = []
in_code = False
in_table = False
list_stack = []

def close_all_lists():
    res = []
    while list_stack:
        tag = list_stack.pop()
        res.append(f"</{tag}>")
    return res

in_mermaid = False
mermaid_kind = ""

for line in lines:
    raw_stripped = line.strip()

    # Mermaid diagram mapping to docs/diagrams
    if raw_stripped.startswith("```mermaid"):
        in_mermaid = True
        mermaid_kind = "tree" if len(html_parts) < 160 else "sequence"
        continue
    elif in_mermaid:
        if raw_stripped.startswith("```"):
            in_mermaid = False
            img_rel = "docs/diagrams/strategy_evaluation_tree.png" if mermaid_kind == "tree" else "docs/diagrams/architectural_sequence_flow.png"
            full_img_path = os.path.normpath(os.path.join(ROOT_DIR, img_rel))
            if os.path.exists(full_img_path):
                with open(full_img_path, "rb") as f_img:
                    enc = base64.b64encode(f_img.read()).decode("utf-8")
                html_parts.append(f'<div class="diagram-box"><img src="data:image/png;base64,{enc}" alt="Diagram" class="diagram-img" /></div>')
        continue

    # Code blocks
    if raw_stripped.startswith("```"):
        if in_code:
            in_code = False
            html_parts.append("</pre>")
            continue
        else:
            in_code = True
            lang = raw_stripped[3:].strip()
            html_parts.append(f'<pre class="code-block {lang}">')
            continue
            
    if in_code:
        html_parts.append(html.escape(line))
        continue

    # Close table if left
    if in_table and not raw_stripped.startswith("|"):
        in_table = False
        html_parts.append("</tbody></table>")

    if not raw_stripped:
        continue

    # Horizontal Rule
    if raw_stripped in ["---", "***", "___"]:
        html_parts.extend(close_all_lists())
        html_parts.append("<hr />")
        continue

    # Headings
    if raw_stripped.startswith("# "):
        html_parts.extend(close_all_lists())
        html_parts.append(f"<h1>{raw_stripped[2:]}</h1>")
        continue
    elif raw_stripped.startswith("## "):
        html_parts.extend(close_all_lists())
        html_parts.append(f"<h2>{raw_stripped[3:]}</h2>")
        continue
    elif raw_stripped.startswith("### "):
        html_parts.extend(close_all_lists())
        html_parts.append(f"<h3>{raw_stripped[4:]}</h3>")
        continue
    elif raw_stripped.startswith("#### "):
        html_parts.extend(close_all_lists())
        html_parts.append(f"<h4>{raw_stripped[5:]}</h4>")
        continue

    # Blockquotes
    if raw_stripped.startswith("> "):
        html_parts.extend(close_all_lists())
        content = raw_stripped[2:]
        html_parts.append(f'<div class="callout">{content}</div>')
        continue

    # Tables
    if raw_stripped.startswith("|"):
        html_parts.extend(close_all_lists())
        cells = [c.strip() for c in raw_stripped.split("|")[1:-1]]
        if not in_table:
            in_table = True
            html_parts.append("<table><thead><tr>")
            for c in cells:
                html_parts.append(f"<th>{c}</th>")
            html_parts.append("</tr></thead><tbody>")
            continue
        elif all(set(c).issubset({"-", ":", " "}) for c in cells):
            continue
        else:
            html_parts.append("<tr>")
            for c in cells:
                html_parts.append(f"<td>{c}</td>")
            html_parts.append("</tr>")
            continue

    # Ordered list
    m_ol = re.match(r"^(\d+)\.\s+(.*)$", raw_stripped)
    if m_ol:
        if not list_stack or list_stack[-1] != "ol":
            html_parts.extend(close_all_lists())
            html_parts.append("<ol>")
            list_stack.append("ol")
        html_parts.append(f"<li>{m_ol.group(2)}</li>")
        continue

    # Unordered list (nested or root)
    if raw_stripped.startswith("- ") or raw_stripped.startswith("* "):
        if not list_stack or list_stack[-1] != "ul":
            html_parts.append("<ul>")
            list_stack.append("ul")
        html_parts.append(f"<li>{raw_stripped[2:]}</li>")
        continue

    # Plain paragraph
    html_parts.extend(close_all_lists())
    html_parts.append(f"<p>{raw_stripped}</p>")

html_parts.extend(close_all_lists())
if in_table:
    html_parts.append("</tbody></table>")
if in_code:
    html_parts.append("</pre>")

body_html = "\n".join(html_parts)

# Inline formatting without creating empty boxes
body_html = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', image_replacer, body_html)
body_html = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', body_html)
body_html = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', body_html)

# Only match non-empty code strings to prevent rogue bubbles
body_html = re.sub(r'`([^`\n]+)`', lambda m: f'<code>{html.escape(m.group(1))}</code>' if m.group(1).strip() else '', body_html)
body_html = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', body_html)

# Add badges for P0-P3
body_html = body_html.replace('<td>P0</td>', '<td><span class="badge badge-p0">P0</span></td>')
body_html = body_html.replace('<td>P1</td>', '<td><span class="badge badge-p1">P1</span></td>')
body_html = body_html.replace('<td>P2</td>', '<td><span class="badge badge-p2">P2</span></td>')
body_html = body_html.replace('<td>P3</td>', '<td><span class="badge badge-p3">P3</span></td>')

full_html = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>MONOZUKURI PRODUCT & ENGINEERING SUBMISSION REPORT</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    @page {{
      size: A4;
      margin: 15mm 13mm 15mm 13mm;
    }}
    * {{
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }}
    body {{
      font-family: 'Inter', sans-serif;
      font-size: 8.5pt;
      line-height: 1.5;
      color: #1e293b;
      margin: 0;
      padding: 0;
    }}
    h1, h2, h3, h4 {{
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: #0f172a;
      page-break-after: avoid;
    }}
    h1 {{
      font-size: 15pt;
      font-weight: 800;
      color: #007E88;
      border-bottom: 2px solid #01959F;
      padding-bottom: 4px;
      margin-top: 0;
      margin-bottom: 6px;
    }}
    h2 {{
      font-size: 11.5pt;
      color: #01959F;
      border-left: 4px solid #01959F;
      padding-left: 8px;
      margin-top: 1.1em;
      margin-bottom: 0.35em;
    }}
    h3 {{
      font-size: 9.5pt;
      font-weight: 700;
      margin-top: 0.85em;
      margin-bottom: 0.25em;
    }}
    p {{
      color: #334155;
      text-align: justify;
      margin-top: 0.15em;
      margin-bottom: 0.3em;
    }}
    ul, ol {{
      margin-top: 0.15em;
      margin-bottom: 0.35em;
      padding-left: 18px;
    }}
    li {{
      color: #334155;
      margin-bottom: 0.15em;
      line-height: 1.45;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 7.5pt;
      page-break-inside: avoid;
    }}
    th, td {{
      border: 1px solid #cbd5e1;
      padding: 5px 7px;
      text-align: left;
      vertical-align: top;
    }}
    th {{
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }}
    tr:nth-child(even) {{
      background-color: #f8fafc;
    }}
    code {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      background-color: #f8fafc;
      color: #0f172a;
      padding: 1px 3px;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
      display: inline;
    }}
    pre.code-block {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      background-color: #0D141F;
      color: #f8fafc;
      padding: 8px 10px;
      border-radius: 6px;
      overflow-x: auto;
      line-height: 1.35;
      page-break-inside: avoid;
      margin: 6px 0;
    }}
    .callout {{
      border-left: 4px solid #01959F;
      background-color: #f0fdfa;
      padding: 7px 11px;
      border-radius: 0 6px 6px 0;
      margin: 7px 0;
      font-size: 8pt;
    }}
    .diagram-box {{
      margin: 8px 0 12px 0;
      text-align: center;
      page-break-inside: avoid;
      background-color: #0D141F;
      border-radius: 8px;
      padding: 6px;
    }}
    .diagram-img {{
      max-width: 100%;
      max-height: 380px;
      object-fit: contain;
      border-radius: 6px;
    }}
    .screenshot-box {{
      margin: 8px 0 12px 0;
      text-align: center;
      page-break-inside: avoid;
    }}
    .screenshot-img {{
      max-width: 100%;
      max-height: 240px;
      object-fit: contain;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 2px 5px rgba(0,0,0,0.06);
    }}
    .badge {{
      display: inline-block;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 700;
    }}
    .badge-p0 {{ background-color: #fee2e2; color: #b91c1c; }}
    .badge-p1 {{ background-color: #ffedd5; color: #c2410c; }}
    .badge-p2 {{ background-color: #fef9c3; color: #a16207; }}
    .badge-p3 {{ background-color: #e0f2fe; color: #0369a1; }}
    hr {{
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 9px 0;
    }}
    a {{
      color: #01959F;
      text-decoration: none;
      font-weight: 600;
    }}
  </style>
</head>
<body>
{body_html}
</body>
</html>
"""

with open(HTML_FILE, "w", encoding="utf-8") as f:
    f.write(full_html)

print("Generated HTML from Markdown successfully.")

cmd = [
    EDGE_PATH,
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={PDF_FILE}",
    HTML_FILE
]

res = subprocess.run(cmd, capture_output=True, text=True)
if os.path.exists(PDF_FILE):
    size_kb = os.path.getsize(PDF_FILE) / 1024
    print(f"Generated PDF successfully: {PDF_FILE} ({size_kb:.1f} KB)")
    if os.path.exists(HTML_FILE):
        os.remove(HTML_FILE)
else:
    print(f"Failed to generate PDF. Stderr: {res.stderr}")
