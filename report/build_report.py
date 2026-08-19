# -*- coding: utf-8 -*-
"""Builds report/index.html from submit.txt — a single self-contained,
print-to-PDF-ready HTML file with screenshots embedded as data URIs."""

import base64
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'submit.txt')
SHOTS = os.path.join(ROOT, 'report', 'screenshots')
OUT = os.path.join(ROOT, 'report', 'index.html')

SCREENSHOTS = [
    ('01-login.png', 'Gambar 1 — Halaman Login',
     'Tata letak card dengan hierarki visual yang jelas. Tautan "Lupa password?" dan "Daftar sekarang" '
     'adalah alur yang sebelumnya tidak ada sama sekali (GAP-15).'),
    ('02-assessment-list.png', 'Gambar 2 — Daftar Assessment',
     'Kartu statistik ringkas, badge status berkontras tinggi, dan search bar reaktif. '
     'Assessor melihat kondisi seluruh proses dalam sekali pandang (GAP-14).'),
    ('03-vacancy-list.png', 'Gambar 3 — Daftar Lowongan',
     'Pola visual konsisten dengan layar Assessment. Data yang belum lengkap ditampilkan secara anggun '
     '("Divisi/Departemen belum diatur", "Informasi belum tersedia") alih-alih sel kosong yang membingungkan.'),
    ('04-assessment-detail-empty.png', 'Gambar 4 — Detail Assessment: keadaan kosong',
     'Empty state yang memandu tindakan berikutnya, bukan sekadar area kosong.'),
    ('05-invite-link.png', 'Gambar 5 — Detail Assessment: undangan berhasil dibuat',
     'BUKTI GAP-09 TERTUTUP: tautan undangan kini mengarah ke http://localhost:5173/interview/... '
     '(antarmuka React), bukan lagi ke server API di port 3001. Sebelum perbaikan, setiap tautan yang '
     'dikirim ke kandidat rusak. Status "Awaiting candidate" terbaca jelas.'),
    ('06-hardware-check.png', 'Gambar 6 — Pemeriksaan Perangkat sebelum wawancara',
     'Empat pemeriksaan lolos, termasuk uji internet yang sebelumnya gagal karena blokir CORS (GAP-10). '
     'Kandidat memasuki wawancara dengan kepastian, bukan harapan.'),
    ('07-interview-ai-speaking.png', 'Gambar 7 — Wawancara berlangsung: AI sedang berbicara',
     'BUKTI GAP-04/05/06 TERTUTUP: sesi benar-benar tersambung dan AI membuka percakapan. '
     'Sebelum perbaikan, layar ini berhenti selamanya di "Connecting…". Indikator "Connected" '
     'terbaca di kiri bawah dan VoiceBars aktif mengikuti suara AI.'),
    ('08-interview-transcript.png', 'Gambar 8 — Wawancara: transkrip dua arah',
     'Percakapan dua sisi berjalan penuh: AI bertanya, kandidat menjawab, AI menindaklanjuti secara kontekstual. '
     'CATATAN JUJUR: tangkapan ini juga memperlihatkan GAP-12 yang belum saya perbaiki — "AI is listening…" '
     'dan "You are speaking…" tampil bersamaan karena keduanya diturunkan dari satu variabel state yang sama.'),
    ('09-portfolio.png', 'Gambar 9 — Hasil Portofolio kandidat',
     'BUKTI PENANGANAN EDGE CASE BUKTI TIPIS: skill ditandai L1 Foundational dengan Confidence: LOW dan '
     'peringatan eksplisit "Only briefly explored. Confidence is low — warrants a dedicated session if this '
     'skill matters." Sistem menolak menyatakan penilaian kuat di atas bukti yang tipis. Tersedia pula '
     '"Override rating" agar keputusan akhir tetap berada di tangan manusia.'),
    ('10-fitgap.png', 'Gambar 10 — Laporan Fit/Gap terhadap lowongan',
     'Perbandingan skill kandidat terhadap kebutuhan lowongan beserta narasi kesesuaian. '
     'CATATAN JUJUR: kolom "Required" tampil kosong padahal narasi di bawahnya menyebut "L1 vs. expected L3". '
     'Inilah GAP-16 yang justru saya temukan saat menyusun bukti ini.'),
]


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def inline(t):
    """Inline markdown: code, bold, italic, links.

    Code spans are swapped for sentinels first so that emphasis spanning a code
    span (e.g. **Backend (`api/`)**) still resolves — splitting on backticks up
    front would strand the ** markers in separate segments.
    """
    spans = []

    def stash(m):
        spans.append('<code>' + esc(m.group(1)) + '</code>')
        return '\x00%d\x00' % (len(spans) - 1)

    p = re.sub(r'`([^`]+)`', stash, t)
    p = esc(p)
    p = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', p)
    p = re.sub(r'(?<![\*\w])\*([^*]+?)\*(?!\*)', r'<em>\1</em>', p)
    p = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', p)
    p = re.sub(r'\[ISI:([^\]]*)\]', r'<span class="todo">[ISI:\1]</span>', p)
    return re.sub(r'\x00(\d+)\x00', lambda m: spans[int(m.group(1))], p)


def img_tag(fname):
    with open(os.path.join(SHOTS, fname), 'rb') as fh:
        b64 = base64.b64encode(fh.read()).decode()
    return 'data:image/png;base64,' + b64


def screenshot_gallery():
    parts = []
    for fname, title, caption in SCREENSHOTS:
        parts.append(
            '<figure class="shot">\n'
            '  <figcaption class="shot-title">%s</figcaption>\n'
            '  <img src="%s" alt="%s">\n'
            '  <figcaption class="shot-caption">%s</figcaption>\n'
            '</figure>' % (esc(title), img_tag(fname), esc(title), inline(caption))
        )
    return '\n'.join(parts)


def convert(md):
    html = []
    lines = md.split('\n')
    i = 0
    in_code = False
    code_buf = []

    def close_list(stack):
        while stack:
            html.append('</%s>' % stack.pop())

    list_stack = []

    while i < len(lines):
        line = lines[i]

        # fenced code
        if line.startswith('```'):
            if in_code:
                html.append('<pre><code>' + esc('\n'.join(code_buf)) + '</code></pre>')
                code_buf, in_code = [], False
            else:
                close_list(list_stack)
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        stripped = line.strip()

        # table
        if stripped.startswith('|') and i + 1 < len(lines) and re.match(r'^\s*\|[\s:\-|]+\|\s*$', lines[i + 1]):
            close_list(list_stack)
            header = [c.strip() for c in stripped.strip('|').split('|')]
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
                i += 1
            # The severity-ranked findings table is the only 6-column table and
            # needs hand-set widths; everything else auto-sizes fine.
            is_findings = header[0] == 'ID' and len(header) == 6
            html.append('<table class="findings">' if is_findings else '<table>')
            if is_findings:
                html.append('<colgroup>' + ''.join(
                    '<col style="width:%s">' % w
                    # Tipe needs ~69px so "Missing Spec" stays on one line;
                    # ID has slack to give since "GAP-01" is only 37px wide.
                    for w in ('8%', '6.5%', '12%', '15%', '28.5%', '30%')
                ) + '</colgroup>')
            html.append('<thead><tr>' + ''.join('<th>%s</th>' % inline(c) for c in header) + '</tr></thead>')
            html.append('<tbody>')
            for r in rows:
                html.append('<tr>' + ''.join('<td>%s</td>' % inline(c) for c in r) + '</tr>')
            html.append('</tbody></table>')
            continue

        # heading
        m = re.match(r'^(#{1,6})\s+(.*)$', stripped)
        if m:
            close_list(list_stack)
            lvl = len(m.group(1))
            cls = ' class="sec"' if lvl == 2 else ''
            html.append('<h%d%s>%s</h%d>' % (lvl, cls, inline(m.group(2)), lvl))
            i += 1
            continue

        # hr
        if stripped == '---':
            close_list(list_stack)
            html.append('<hr>')
            i += 1
            continue

        # blockquote
        if stripped.startswith('>'):
            close_list(list_stack)
            buf = []
            while i < len(lines) and lines[i].strip().startswith('>'):
                buf.append(lines[i].strip().lstrip('>').strip())
                i += 1
            html.append('<blockquote>%s</blockquote>' % inline(' '.join(buf)))
            continue

        # checkbox / bullet / numbered
        m = re.match(r'^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$', line)
        if m:
            if not list_stack:
                html.append('<ul class="checklist">')
                list_stack.append('ul')
            mark = 'done' if m.group(2).lower() == 'x' else 'todo-box'
            sym = '&#10003;' if m.group(2).lower() == 'x' else '&#9633;'
            html.append('<li class="%s"><span class="box">%s</span> %s</li>' % (mark, sym, inline(m.group(3))))
            i += 1
            continue

        m = re.match(r'^(\s*)[-*]\s+(.*)$', line)
        if m:
            if not list_stack:
                html.append('<ul>')
                list_stack.append('ul')
            html.append('<li>%s</li>' % inline(m.group(2)))
            i += 1
            continue

        m = re.match(r'^(\s*)(\d+)\.\s+(.*)$', line)
        if m:
            if not list_stack:
                html.append('<ol>')
                list_stack.append('ol')
            html.append('<li>%s</li>' % inline(m.group(3)))
            i += 1
            continue

        if not stripped:
            close_list(list_stack)
            i += 1
            continue

        close_list(list_stack)
        buf = [stripped]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(
                r'^\s*(\||#{1,6}\s|>|[-*]\s|\d+\.\s|```|---\s*$)', lines[i]):
            buf.append(lines[i].strip())
            i += 1
        html.append('<p>%s</p>' % inline(' '.join(buf)))

    close_list(list_stack)
    return '\n'.join(html)


CSS = """
:root{
  --ink:#16181d; --muted:#5b6472; --line:#dfe3ea; --bg:#ffffff;
  --accent:#0d7a76; --accent-soft:#e8f4f3; --warn:#a15c00; --warn-soft:#fdf6e7;
  --code-bg:#f5f7fa;
}
*{box-sizing:border-box}
body{
  margin:0; background:#eceff3; color:var(--ink);
  font-family:"Segoe UI",-apple-system,Roboto,Helvetica,Arial,sans-serif;
  font-size:10.5pt; line-height:1.62;
}
.page{
  max-width:210mm; margin:0 auto; background:var(--bg);
  padding:22mm 18mm; box-shadow:0 2px 24px rgba(0,0,0,.10);
}
h1{font-size:21pt; line-height:1.25; margin:0 0 4px; letter-spacing:-.3px}
h2{font-size:14.5pt; margin:26px 0 10px; padding-bottom:6px; border-bottom:2px solid var(--accent); color:var(--accent)}
h3{font-size:11.8pt; margin:20px 0 8px; color:#22303a}
h4{font-size:10.6pt; margin:16px 0 6px; color:#22303a}
p{margin:0 0 9px; text-align:justify}
hr{border:0; border-top:1px solid var(--line); margin:18px 0}
a{color:var(--accent); text-decoration:none}
code{
  background:var(--code-bg); border:1px solid var(--line); border-radius:3px;
  padding:.5px 4px; font-family:Consolas,"Courier New",monospace; font-size:9pt;
}
pre{
  background:var(--code-bg); border:1px solid var(--line); border-left:3px solid var(--accent);
  border-radius:4px; padding:9px 11px; overflow-x:auto; margin:0 0 11px;
}
pre code{background:none; border:0; padding:0; font-size:8.6pt; line-height:1.5; white-space:pre-wrap; word-break:break-word}
table{width:100%; max-width:100%; border-collapse:collapse; margin:0 0 13px; font-size:8.8pt}
th,td{border:1px solid var(--line); padding:5px 7px; text-align:left; vertical-align:top}
/* Only code spans get to break mid-token: long file paths would otherwise push
   a table past the printable area. Prose keeps normal word wrapping so short
   labels like "Defective" are never split across lines. */
th code,td code{overflow-wrap:anywhere; white-space:normal}

/* Findings table: 6 columns, three of them very narrow. Fixed layout with
   explicit widths stops the browser from starving the ID/Sev/Tipe columns. */
table.findings{table-layout:fixed; font-size:8.2pt}
table.findings th,table.findings td{padding:4px 5px}
table.findings td:nth-child(1),
table.findings td:nth-child(2){white-space:nowrap; font-weight:600}
table.findings td:nth-child(3){hyphens:none}
th{background:var(--accent-soft); font-weight:600; color:#0b5b58}
tbody tr:nth-child(even){background:#fafbfc}
ul,ol{margin:0 0 10px; padding-left:20px}
li{margin:0 0 4px}
ul.checklist{list-style:none; padding-left:2px}
ul.checklist .box{display:inline-block; width:14px; font-weight:700}
ul.checklist li.done .box{color:var(--accent)}
ul.checklist li.todo-box{color:var(--muted)}
ul.checklist li.todo-box .box{color:#b9c0cb}
blockquote{
  margin:0 0 12px; padding:9px 13px; background:var(--warn-soft);
  border-left:3px solid var(--warn); border-radius:0 4px 4px 0; color:#5d4200;
}
blockquote strong{color:#7a4d00}
.todo{background:#fff2c9; border:1px dashed #d9a400; border-radius:3px; padding:0 4px; color:#7a4d00; font-weight:600}
.cover{border-bottom:3px solid var(--accent); padding-bottom:14px; margin-bottom:6px}
.cover .sub{color:var(--muted); font-size:12pt; margin:2px 0 0}
.meta{font-size:9pt; color:var(--muted); margin-top:8px}
figure.shot{margin:0 0 20px; page-break-inside:avoid; break-inside:avoid}
figure.shot img{
  display:block; width:100%; height:auto; border:1px solid var(--line);
  border-radius:5px; box-shadow:0 1px 5px rgba(0,0,0,.08);
}
.shot-title{font-weight:700; font-size:10pt; margin:0 0 5px; color:#22303a}
.shot-caption{font-size:8.6pt; color:var(--muted); margin-top:6px; line-height:1.5; text-align:justify}
.toc{background:#f7f9fb; border:1px solid var(--line); border-radius:5px; padding:12px 16px; margin:16px 0 6px}
.toc h3{margin:0 0 6px; font-size:10pt}
.toc ol{margin:0; padding-left:18px; font-size:9.4pt; columns:2; column-gap:26px}
.toc li{margin:0 0 2px}
.printhint{
  background:var(--accent-soft); border:1px solid #b9dedb; border-radius:5px;
  padding:10px 14px; margin:0 0 18px; font-size:9pt; color:#0b5b58;
}
@media print{
  body{background:#fff; font-size:9.6pt}
  .page{box-shadow:none; max-width:none; padding:0; margin:0}
  .printhint{display:none}
  h2{page-break-after:avoid; break-after:avoid}
  h3,h4{page-break-after:avoid; break-after:avoid}
  table,pre,blockquote{page-break-inside:avoid; break-inside:avoid}
  tr{page-break-inside:avoid; break-inside:avoid}
  a{color:var(--ink)}
  @page{size:A4; margin:15mm 14mm}
}
"""


def main():
    md = io.open(SRC, encoding='utf-8').read()

    # Split the cover block off so it can be styled separately.
    body_md = md

    html_body = convert(body_md)

    # Inject the screenshot gallery right after the 7.1 heading paragraph block.
    anchor = '<h3>7.1 Tangkapan Layar</h3>'
    if anchor in html_body:
        idx = html_body.index(anchor)
        tbl_end = html_body.index('</tbody></table>', idx) + len('</tbody></table>')
        html_body = html_body[:tbl_end] + '\n' + screenshot_gallery() + html_body[tbl_end:]
    else:
        html_body += screenshot_gallery()

    hint = ('<div class="printhint"><strong>Cara membuat PDF:</strong> buka berkas ini di Chrome atau Edge, '
            'tekan <strong>Ctrl+P</strong>, pilih <em>Save as PDF</em>, ukuran <strong>A4</strong>, '
            'Margins <em>Default</em>, dan centang <strong>Background graphics</strong> agar warna tabel dan '
            'kotak catatan ikut tercetak. Kotak petunjuk ini tidak akan ikut tercetak.</div>')

    out = (
        '<!doctype html>\n<html lang="id">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<title>Laporan Case Study — Fullstack Product Engineer</title>\n'
        '<style>%s</style>\n</head>\n<body>\n<div class="page">\n%s\n%s\n</div>\n</body>\n</html>\n'
        % (CSS, hint, html_body)
    )

    io.open(OUT, 'w', encoding='utf-8').write(out)
    print('written: %s (%.1f KB)' % (OUT, os.path.getsize(OUT) / 1024.0))


if __name__ == '__main__':
    main()
