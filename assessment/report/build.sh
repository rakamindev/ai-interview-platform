#!/usr/bin/env bash
# Renders report.html to report.pdf with headless Chrome (or Edge). No other dependencies; the Mermaid
# diagrams load from a CDN, so the build needs a network connection.
# Usage: assessment/report/build.sh   (set CHROME to override the browser path)
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${CHROME:-}" ]; then
  for c in "/c/Program Files/Google/Chrome/Application/chrome.exe" \
           "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "$(command -v google-chrome || true)" "$(command -v chromium || true)"; do
    if [ -n "$c" ] && [ -x "$c" ]; then CHROME="$c"; break; fi
  done
fi
: "${CHROME:?No Chrome or Edge found; set CHROME to the browser path}"

rm -f report.pdf
dir="$(pwd -W 2>/dev/null || pwd)"
page="file:///${dir#/}/report.html"
# Virtual time lets the diagrams finish rendering before the page is dumped or printed.
flags=(--headless=new --disable-gpu --virtual-time-budget=20000 --run-all-compositor-stages-before-draw)

# Refuse to print raw diagram source if Mermaid didn't render (offline, CDN down, syntax error).
"$CHROME" "${flags[@]}" --user-data-dir="$(mktemp -d)" --dump-dom "$page" 2>/dev/null \
  | grep -q 'data-diagrams="ready"' || { echo "Diagrams did not render (offline?)" >&2; exit 1; }

"$CHROME" "${flags[@]}" --no-pdf-header-footer --user-data-dir="$(mktemp -d)" \
  --print-to-pdf="$dir/report.pdf" "$page" 2>/dev/null
[ -s report.pdf ] || { echo "PDF was not written" >&2; exit 1; }
echo "Wrote $dir/report.pdf"
