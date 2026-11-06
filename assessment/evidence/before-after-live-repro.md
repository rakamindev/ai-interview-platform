# Before/after, re-run live — 7 Nov 2026, about 06:25–06:35 WIB

**Assurance level: ran.** The original code was executed today, not recovered from old logs.
- **Before:** original `main` at `b836d02`, in a separate detached worktree.
- **After:** the frozen implementation `3042704` (repository HEAD `9862151`, docs-only on top).
- **Run by:** Claude (an AI agent), not by Farros personally.
- **Data:** synthetic only; every database write was rolled back (local test database).
- Script: `before-after-live-repro.rb` (this folder).

**Limit:** the local test database carries the frozen schema, so the original code ran against newer tables. None of the reproduced paths reads the added columns.

| Finding | What was run | Before (`b836d02`) | After (`3042704`) |
|---|---|---|---|
| **W25** invite link | `Session.new(invite_token: 'SYNTHETIC-TOKEN').invite_url`, with `APP_BASE_URL` unset | `http://localhost:3001/interview/SYNTHETIC-TOKEN`: the API's port; `/interview/:token` is a route of the React web app, not the API | `http://localhost:5173/interview/SYNTHETIC-TOKEN` (the web app) |
| **W29** speech in logs | `Gemini::LiveClient#log_gemini_event` with a synthetic input transcription | `[Gemini::LiveClient] Event: inputTx=SYNTHETIC candidate sentence: my name is Test P...` | `[Gemini::LiveClient] Event: inputTx=52chars` |
| **W20** PDF export | `Exports::PdfGenerator#call` on a portfolio whose summary contains `→ ≥ ✓` | `Prawn::Errors::IncompatibleStringEncoding: Your document includes text that's not compatible with the Windows-1252 character set.` | A PDF is generated: `spec/requests/portfolio_pdf_export_spec.rb`, plus real downloads in `w20-pdf-export.txt` (not re-run here) |
| **W15** Required column | The **original web app** (`b836d02`, served on port 5174) and the current one (port 5173) opened the same fit/gap report (`/assessments/1/sessions/5/fitgap/1`) against the same running API | Row text: `React / Frontend Development Core \| (empty) \| L4✏ \| ⚠ Gap -1`: the Required cell is blank | Row text: `React / Frontend Development Core \| L5 \| L4✏ \| ⚠ Gap -1` |

**Incidental, seen in the same original screen:** W19, a discovered skill shown as `3 (confirmed)`. The current page shows it as an AI suggestion.

**Not reproduced live here:** W17 (the narrative fallback), because it needs a failing Gemini call. Its failing spec run from development (4 examples, 4 failures, with W15) remains only in the development session log.

This file shows the original behaviour and the current behaviour side by side. It is not a red-then-green test run: the regression specs live in `api/spec/requests/`.
