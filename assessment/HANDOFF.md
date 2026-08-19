# Handoff — Continue This in a New Chat

Written 2026-08-18, mid-session, at the user's request to switch chats. If you're a fresh
Claude session picking this up: read this whole file first, then [EXPLORATION_LOG.md](EXPLORATION_LOG.md)
(the full detailed trace of everything below — this file is just the fast-resume summary).

## ⏰ Deadline — read this first

**Wednesday 19 August 2026, 13:00 WIB.** Per [ROADMAP.md](ROADMAP.md), that's the case-study
submission deadline. Check the actual current time before doing anything else — this file was
written the evening before, so the remaining runway may already be short. There's a mandatory
sleep block in the user's own timeline (`ROADMAP.md` §Langkah 5) — don't let debugging rabbit
holes eat into it.

## What mode we're in

The user is running **PRODUCT EXPLORATION**, not implementation, per their own protocol (full
rules in the user's original instructions — not saved verbatim anywhere, but
[EXPLORATION_LOG.md](EXPLORATION_LOG.md)'s structure reflects it exactly). Short version:

- Run the app as a user, find real bugs, trace root cause, judge blocker vs non-blocker.
- Blockers get a **minimal** fix just to unblock testing — no scope creep, no polish.
- Non-blockers go in the Bug Parking Lot table in EXPLORATION_LOG.md, not fixed inline.
- Every step gets logged in EXPLORATION_LOG.md in a specific format (STEP N: role/page/
  action/expected/actual/status, then TRACE/USER POV/TECHNICAL POV/KONSEKUENSI sections).
- **Don't jump to "let's implement F-04/F-01/whatever" before the user has finished the
  journey and explicitly made a scope decision.** That decision (§4.1 in ROADMAP.md) is
  still open — it's the user's call, not something to infer or push toward.
- The user reads/writes in Indonesian; match that unless they switch.

## Background reading, in priority order

1. [MY-TASK.md](MY-TASK.md) — the user's own pre-coding notes. Says the codebase already
   implements most of the PRD well; the real task is picking 1-2 findings from
   `codebase-audit.md` §6 and fixing them properly with tests — not building from scratch,
   not spreading thin across many things.
2. [codebase-audit.md](codebase-audit.md) — a prior audit (grounded in the real PRD wiki,
   not guesswork) with a P0-P3 severity findings table (§6) and scoping options (§7).
3. [ROADMAP.md](ROADMAP.md) — timeline, decision gates (§4.1-§4.5, mostly still unfilled —
   that's intentional, they're the user's calls), submission checklist (§Langkah 6).
4. [EXPLORATION_LOG.md](EXPLORATION_LOG.md) — everything done this session, step by step.

## What's already fixed and committed this session

All on branch `revamp/case-study-prep`, **not pushed to origin** (origin is the real company
repo `github.com/rakamindev/ai-interview-platform` — don't push without asking first).

| Commit | What |
|---|---|
| `51032fd` | Ignore `api/dump.rdb` (was about to get committed by accident — never commit this or `api/config/application.yml`, both gitignored on purpose, the latter holds a real Gemini key) |
| `8cc6792` | Fixed false-negative internet speed check in Hardware Check (upload measurement was polluted by third-party echo-server latency) |
| `074e498` | Added missing `web/package-lock.json` |
| `fab1562` | Committed the assessment docs themselves |
| `6723545`, `a2470f7` | Vacancy empty-state on Portfolio Results: was a dead dropdown with a permanently-disabled button and zero explanation; now shows a proper empty state + "Create your first vacancy" CTA that round-trips back to where the assessor started. Added a "Fit/Gap Analysis" section heading that was missing. |
| `1c345bf` | **Real bug, not just exploration cleanup**: PDF export was 500ing because Prawn's default fonts don't support UTF-8 (smart quotes/em-dashes from transcripts crash it) — vendored DejaVu Sans, registered as default font. Separately, the frontend's export handler had no `catch`, so any export failure (PDF or JSON) was completely silent — assessor clicks, nothing happens, no error. Fixed both. Confirmed via PRD wiki that PDF export is an explicit requirement (N14, Phase 5) and JSON export is not mentioned anywhere in the PRD — it's a dev convenience. |
| `f0d70fc` | **WIP, see below** — descriptive export filenames instead of `portfolio-1.pdf` |

**Important, separate from all of the above**: while testing, an accidental automated click
landed on the "Override rating" panel for Budi's "Micro-frontend Architecture" skill and
saved a bogus L2 rating with garbage notes ("sds"). It was caught and corrected back to L3
(matching the AI's original rating) via the same UI — but the audit trail will still show
"Overridden by You" on that skill. If Budi's session ever ends up in a report/screenshot,
that override wasn't a real assessor decision.

## Currently in progress — pick this up first

**Task**: export filenames should read like `Budi-Flutter-Engineer-Portfolio-2026-08-18.pdf`
instead of `portfolio-1.pdf`. Backend side (`portfolios_controller.rb`) is done and safe —
no async involved, reads straight from `portfolio.session`. Frontend side hit a genuinely
strange bug:

- `PortfolioPage.tsx` and `FitGapReportPage.tsx` both fetch `sessionsApi.get(sessionId)` to
  get `candidate_name` and `assessment.name` for the filename.
- `candidateName` state populates correctly, every time, verified repeatedly.
- `roleTitle` state (from `sRes.data.assessment.name`) intermittently stays `null` — and
  when traced with debug logging, `sRes.data.assessment.name` threw `TypeError: Cannot read
  properties of undefined (reading 'name')`, **despite `JSON.stringify(sRes.data)` one line
  earlier in the same callback showing `assessment: {name: "Flutter Engineer", ...}` fully
  present.**
- Ruled out: Vite HMR/module cache staleness (killed the dev server, cleared
  `node_modules/.vite`, retested in brand-new browser tabs — same result every time).
- **Not yet confirmed, but the leading suspect**: `web/src/services/api.ts`'s response
  interceptor mutates `response.data` in place (`response.data = response.data.data`) to
  unwrap the backend's envelope. Combined with React 18 Strict Mode double-invoking the
  effect in dev (observed the fetch firing both 1x and 2x across different test runs,
  inconsistently) — some interaction between concurrent/duplicate requests and that
  in-place mutation is the most likely explanation. **Not proven yet.**
- **Current state of the code**: mitigated defensively, not root-caused. Both files now use
  optional chaining (`sRes.data?.assessment?.name`) so a failure degrades to a generic
  "Assessment" label in the filename instead of crashing. Candidate name is unaffected
  either way.

**Next step**: open a fresh browser tab, log in as assessor
(`assessor@test-corp.local` / `Password123!`), go to a Portfolio Results page, click PDF/JSON,
and check whether the filename now has the real role title or falls back to "Assessment".
If it's still falling back inconsistently, decide: is it worth root-causing the interceptor
race (real fix), or is the defensive fallback good enough given the deadline (ship it, note
it as a known minor cosmetic issue)? Given this is a cosmetic filename detail and not a
blocker, leaning toward the latter unless it's quick to nail down.

## Known open items — not started

- **F-01 (P0, security)**: `Portfolio`/`PortfolioSkill`/`FitGapReport`/`AssessorOverride`
  have zero tenant scoping — any assessor from any org can read/write another org's
  candidate data by guessing numeric IDs. Directly affects the `export` endpoint I just
  fixed (fixing the crash didn't touch this — if anything it makes the hole more reachable
  now that export actually works). This is one of the two findings `MY-TASK.md` suggested
  as case-study scope candidates. **Completely untouched.**
- **Coverage / Live Monitor real-time behavior**: unverified. Budi's interview ran while the
  Gemini API key was still broken (fixed later in `1c345bf`'s predecessor work), so Coverage
  analysis failed during that actual session. Portfolio generation works fine off the saved
  transcript regardless, but Coverage/Live Monitor's real-time path has never been proven
  working end-to-end with the current (working) key. **Needs a brand-new interview run** to
  verify properly — re-testing against Budi's already-broken session won't prove anything.
- **Confidence page**: unclear if there's a standalone page for this beyond the confidence
  badges already visible on Portfolio Results / Fit-Gap Report. Not checked.
- **PR structure**: user already decided **Option B** (umbrella PR + focused sub-PRs, not
  one comprehensive PR) — see the chat where this was decided. Explicit instruction: don't
  base sub-PR boundaries on the exploration bugs found so far — those boundaries should come
  from the *final* feature scope once §4.1 is decided, not from this cleanup work.
- **Nothing has been pushed to GitHub.** All 8 commits above are local only.

## Operating notes for whoever picks this up

- Git: commit atomically (one logical change per commit), match this repo's existing
  message style (imperative, no conventional-commit prefixes), always end commits with
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Never push without asking —
  `origin` is the real company repo.
- Never commit `api/dump.rdb` or `api/config/application.yml` (both gitignored; the latter
  has a live Gemini API key in it).
- Dev servers: Puma (`:3001`) and Sidekiq both need a restart after changing
  `api/config/application.yml` (env vars load at boot). Vite (`:5173`) picks up file changes
  live except when it doesn't — if something inexplicable happens with React state, a full
  `kill + rm -rf node_modules/.vite + npm run dev` restart is a legitimate troubleshooting
  step, not overkill (see the filename bug above).
- The user is a frontend/mobile engineer, comfortable with React/TS, less fluent in Rails
  backend jargon (Redis, Sidekiq, WebSocket internals) — lead with plain-language analogies
  before diving into backend-specific terms when explaining anything server-side.
