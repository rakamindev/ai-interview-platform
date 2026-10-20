# Step 3: Problem and gap to the ideal condition

## The core problem

The product exists to produce one thing: **a skill rating an assessor can trust and defend**. The rating changes a
real person's year. Everything else (the live interview, the coverage map, the fit/gap report) exists to produce
that rating or to act on it.

Today the pipeline that turns an interview into a rating **fabricates certainty it doesn't have**:

- A skill that was never discussed is stored as **L1**. Fit/gap then reports it as a **gap**, the same as a skill
  where the candidate was probed and fell short.
- Evidence quotes shown under "Evidence from interview" are not checked against the transcript.
- A skill the model leaves out simply disappears from the results.

The assessor can't tell any of these apart from a real, well-evidenced result. The candidate never finds out
either way. On top of that, **any admin from any other company can read and rewrite these ratings**.

The gap, in one line: the system doesn't separate "we measured this and it's low" from "we never measured this".
It also doesn't protect the result once it's produced.

## How I checked

- Read the product spec (wiki PRD 01 and PRD 02) and traced each node (N1–N14) to the code.
- Ran the stack locally (see [00-work-log.md](00-work-log.md)). No Gemini key was provided, so a live voice
  interview couldn't run (see constraint C1). Instead I reproduced the post-interview pipeline against the **real
  services and database**, with the model response stubbed:
  [evidence/repro_findings.rb](evidence/repro_findings.rb).
- Hit the API over HTTP with tokens for two separate organizations, and read the Sidekiq and Rails logs.
- Walked the assessor's entry screen (`/assessments`) in the browser at desktop and 375px width, including while
  the API was still booting, and compared what it renders with the `GET /assessments` payload.
- Called the candidate endpoints (`/sessions/:token/candidate`, `/sessions/:token/audio_complete`) without any
  credentials, against a session created 400 days earlier and never started.
- Rendered the web app's pages under functional tests with only the network faked (see the work log, "Functional
  tests"). Any request a page makes without the test expecting it fails the test, which is how P1-12 surfaced.
- Ran unit and integration tests against the PDF export, the real Postgres, Redis and Rack stack, and the live
  monitor's REST and WebSocket channels (see the work log), which surfaced P1-13, P2-12, P2-13 and C7.

Scenario used: *Senior Frontend Engineer* with three skills (React L3, Communication L3, System Design L2). The
candidate's connection drops at minute 6, after only React was discussed. The model answers honestly with
`"level": null` for the two skills it has no evidence for.

```
== unassessed skills are stored as real ratings ==
  React / Frontend Development Core    coverage=partial  probes=2  -> stored ai_level=L3 (medium)
  Communication                        coverage=not_yet  probes=0  -> stored ai_level=L1 (low)
  System Design & Architecture         coverage=not_yet  probes=0  -> stored ai_level=L1 (low)

== fit/gap reports those fake ratings as skill gaps ==
  Communication                        expected=L3 candidate=L1 -> gap
  System Design & Architecture         expected=L2 candidate=L1 -> gap
  narrative fallback: Candidate shows 1 skill matches, 0 exceeds, and 2 gaps against role requirements.
```

## Findings

**Type** separates *missing specification* (never defined anywhere) from *defective implementation* (defined, but
broken). **Seam** marks findings that sit between the data computation and the frontend presentation.

### P0: wrong outcomes for candidates, or a breach

| # | Finding | Impact | Type | Where | Evidence |
|---|---|---|---|---|---|
| P0-1 | **Unassessed skills are stored as L1.** The prompt forces a level for every skill, `level.to_i.clamp(1, 5)` turns `null`/`"N/A"` into 1, the DB column is `NOT NULL 1..5`, and the web's `parseLevel` also falls back to 1. | A candidate whose interview ended early is rated at the lowest level for skills nobody asked about. | Missing spec (no "not assessed" state in the PRD output or the data model) + defect (clamp) | `api` generator, schema; `web` `parseLevel` (**seam**) | repro output above |
| P0-2 | **Cross-tenant read and write of portfolios.** `Portfolio`, `PortfolioSkill` and `FitGapReport` aren't tenant-scoped, and the controllers use `Portfolio.find(params[:id])`. | An admin at Company B can export Company A's candidate evidence and change their rating. That's a breach of personal data under UU PDP. | Defect | `api` portfolios and portfolio_skills controllers | Other Corp token: `GET sessions/1` → 404, but `GET portfolios/1/export` → 200 with the full portfolio, and `POST portfolio_skills/1/override` → **201, level set to L5**. Found while fixing: `POST fitgap` and `POST regenerate_fitgap` too (202). **Fixed** in Step 5, sub-PR 1 |

### P1: wrong or misleading results; data integrity

| # | Finding | Impact | Type | Where | Evidence |
|---|---|---|---|---|---|
| P1-1 | **Fit/gap treats fabricated and low-confidence levels as real.** Only a missing row becomes `not_assessed`; confidence is stored but never used in the verdict. | A hiring manager sees "Gap −2" for a skill never discussed, and may reject on it. | Missing spec | `api` `FitGap::Engine` | repro: Communication → `gap` |
| P1-2 | **The "Required" column is always blank, and the override marker never shows.** The API sends `expected_level`; the web reads `required_level`. The API never sends `is_override`, yet the legend says "✏ = human override applied". | The core table of the report can't be read as a comparison. | Defect | **seam** `ComparisonTable.tsx` / `FitGap::Engine` | payload keys: `delta, result, skill_id, confidence, skill_label, expected_level, candidate_level` |
| P1-3 | **Skills the model leaves out disappear.** The output isn't reconciled against the configured skills. | The portfolio shows 1 skill for a 3-skill assessment, with no sign that anything is missing. | Defect | `api` generator; `web` portfolio page | repro: configured 3, portfolio 1 |
| P1-4 | **Portfolio writes aren't atomic.** `destroy_all`, then `create!` per skill, outside a transaction. Regenerating also deletes assessor overrides (`dependent: :destroy`). | Bad model output (e.g. `"Low"`) leaves a half-written portfolio. A retry erases the assessor's judgement. | Defect | `api` generator | repro: `RecordInvalid`, status `failed`, 1 skill already written |
| P1-5 | **Evidence quotes aren't verified against the transcript.** | A made-up quote is shown as "Evidence from interview" and backs the rating. | Missing spec | `api` generator; `web` skill card | repro: invented quote stored, found in transcript = `false` |
| P1-6 | **Duplicate fit/gap jobs race.** No dedupe; the web re-triggers generation on every 404 while polling. | Concurrent jobs crash on `UniqueViolation`; wasted model calls and noisy retries. | Defect | `api` controller and worker; `web` `FitGapReportPage` | 3 POSTs → 3 jobs, 2 failed with `PG::UniqueViolation` |
| P1-7 | **Secrets and personal data in logs.** No `filter_parameters`. | Login passwords and assessor notes are written in plain text to the request log. | Defect | `api` config | `development.log` contains `"password"=>"password123"` 3×, and the override notes |
| P1-8 | **The assessment list only ever loads page 1.** `assessmentsApi.list()` is always called without a page, and the `meta` the API returns (`total_pages`, `total_count`, `per_page: 20`) is ignored. There's no pager. | From the 21st assessment on, older assessments and their candidates can't be reached from the list, and nothing says so. The assessor may assume they're gone and recreate them. | Defect | **seam** `web` `AssessmentListPage`; `api` `assessments#index` | payload: `meta: {current_page: 1, total_pages, total_count, per_page: 20}`; page never requests `page=2` |
| P1-9 | **Every ended session reads "Last: completed".** `manual_candidate`, `manual_assessor`, `time_ceiling` and `all_covered` all render the same label; only `error` differs. | A candidate who left at minute 2 looks the same as one who covered every skill. It hides the early-ended interviews that P0-1 turns into L1 ratings. | Missing spec | `web` `AssessmentListPage` `SessionSummary` | seeded session: `status: ended, end_reason: manual_candidate` → "Last: completed" |
| P1-10 | **Anyone with the invite link can end the interview as "all skills covered"** (fixed in sub-PR 28). `POST /sessions/:token/audio_complete` needs no auth and calls `EndHandler` with `all_covered` without checking coverage (the check was removed on purpose; see the comment in `sessions#audio_complete`). | A forwarded or leaked link can end a candidate's interview, live or not yet started. The session is then recorded as fully covered, which falsifies the one signal that says an interview was cut short. It also triggers a paid model call over an empty transcript. | Defect | `api` `SessionsController#audio_complete` | a never-started session: `POST …/audio_complete` with no token → `status: ended, end_reason: all_covered, started_at: nil`; Sidekiq then spent 43 s on a Gemini call and stored a `complete` portfolio with **0 skills** |
| P1-11 | **A broken or mistyped invite link says the interview is done** (fixed in sub-PR 26, as part of P2-27). `InterviewPage` treats *any* error loading the link as "complete" and shows "Interview Complete. Thank you. The interview has been recorded." | A candidate who never interviewed is told they did. They wait for a reply that never comes and don't contact the recruiter, so they silently drop out of the process. | Defect | `web` `InterviewPage` | web functional test: `GET /sessions/not-a-token/candidate` → 404 → "has been recorded" |
| P1-12 | **The hardware check depends on third-party hosts, so it either leaks or blocks.** The ping and upload tests go to google.com, cdn.jsdelivr.net, unpkg.com, httpbin.org and postman-echo.com unless `VITE_SPEED_TEST_*` is set (blank by default). The **download** test has no override at all: it always goes to the CDNs. The API already has `/api/v1/speed_test`. **Without a CSP** (dev), the requests go out, with no notice. **Under the repo's own production CSP** (`web/vercel.json`, `connect-src 'self'` + the API), the browser blocks them all: download reads 0 Mbps against a minimum of 8, the check fails, the microphone check never runs, and **Start stays disabled**. Retry gives the same result. Setting `VITE_SPEED_TEST_*` doesn't help, because download has no override. | Without a CSP: the candidate's IP address and device details go to five undisclosed services before any notice (UU PDP Art. 5, 21). Deployed as configured: **no candidate can start an interview**. Whether production really serves this CSP isn't verified (C8); if it does, this is a P0. | Defect (privacy, availability) | `web` `utils/internetSpeedTest.ts`, `HardwareCheck`, `vercel.json` | web functional test: 12 third-party requests in the first 1.5 s. Real module in headless Chrome with the `vercel.json` CSP: 30 requests blocked, `download 0, ping 999, passed false`; with ping and upload pointed at our own origin: 12 blocked, `download 0, passed false`. Unit test pins it. |
| P1-13 | **The PDF export crashes for any portfolio the assessor has overridden.** The generator's own line `AI: L2 → Override: L4` uses `→`, which Prawn's built-in fonts (Windows-1252 only) can't encode. Evidence quotes with emoji or non-Latin script crash it too. | The assessor gets an error instead of the document they share with the hiring manager, and it hits exactly the portfolios a human reviewed most closely. | Defect | `api` `Exports::PdfGenerator` | unit spec: `Prawn::Errors::IncompatibleStringEncoding` at the override line, and at an evidence line with 🚀 |
| P1-14 | **Removing a skill on an edit form doesn't remove it.** The assessment and vacancy edit pages leave the removed skill out of `*_skills_attributes`; nested attributes only delete a row sent with `_destroy`, so the API keeps it and returns 200. Found while filling test gaps. | The assessor deletes a skill, saves, and the interviewer still asks about it; on a vacancy it keeps counting in every fit/gap report. Nothing on screen says it's still there until the page is reloaded. | Defect | **seam** `web` `AssessmentEditPage`, `VacancyEditPage` | web functional tests: PUT body has no `_destroy`; API request spec: a left-out skill stays, `_destroy: true` deletes it |
| P1-15 | **Invite links point at the API, not the web app** (found in Step 5 when an invite link copied from the Invite page gave a 404; fixed in sub-PR 17). `Session#invite_url` builds the link from `APP_BASE_URL` and fell back to `http://localhost:3001`, the API, which has no `/interview` route; `api/README.md` called the variable the backend URL. Production booted without it. | On a setup that follows the README, every link an assessor sends is a 404 and no candidate can start. In production, an unset value would send every candidate to localhost, and nothing would say so until candidates complained. | Defect | `api` `Session#invite_url`, `ProductionGuards`, `api/README.md` | model spec: default → `localhost:3001`, trailing slash → `//interview/`; guard spec: boots without it |
| P1-16 | **The production headers block the camera a proctored interview needs** (found building P2-28 in Step 5; fixed in sub-PR 27). `web/vercel.json` sends `Permissions-Policy: camera=()`, which turns the camera off for every origin. | Wherever that file is used, no candidate gets past "Turn on camera": Chrome refuses before any prompt, and the page tells them to allow the camera in the address bar, which can't help. Whether production serves this file is C8's open question. | Defect | `web` `vercel.json` | unit test reading `vercel.json`: camera not allowed for the page; Chromium, permission granted: `NotAllowedError` |

### P2: failure paths and trust signals

| # | Finding | Impact | Type | Where |
|---|---|---|---|---|
| P2-1 | **Failure states are dead ends.** Fit/gap has no `failed` status, so a failed job means an endless spinner. A portfolio load error is swallowed (`.catch(() => {})`), leaving a blank page. `generation_error` is never shown. | The assessor waits forever, or reloads, with no explanation. | Missing spec | `web` portfolio and fit/gap pages; `api` fit/gap |
| P2-2 | **Retry while Sidekiq is still retrying** (fixed in sub-PR 25, logged again there as P2-26). The generator marks `failed`, then re-raises (`retry: 3`), so the UI offers "Retry" while a retry is already scheduled. | Two generations run for one session. | Defect | `api` worker, generator |
| P2-3 | **Gemini HTTP retries never fire.** Faraday's retry middleware only retries idempotent methods (`delete, get, head, options, put`), and every Gemini call is a `POST`. | One 429 or 503 fails the step outright; the retry config is dead code. | Defect | `api` `Gemini::HttpClient` |
| P2-4 | **No notice or consent for the candidate.** The interview page tells the candidate "has been recorded" only *after* the interview; nothing before it explains AI assessment, purpose or retention. | Processing without informed consent; the candidate can't make a choice. | Missing spec (UU PDP) | `web` interview page |
| P2-5 | **Fit/gap discovered-skills list** shows a raw `3` instead of `L3`, labels anything not low as "confirmed", and the summary counts leave out `not_assessed`. | Inconsistent, overconfident wording. | Defect | `web` fit/gap page |
| P2-6 | **The assessment list shows an error and an empty state at once.** When the request fails, "Failed to load assessments" renders *and* "No assessments yet. Create your first assessment", because `error` and `loading`/`length === 0` are checked separately. | Two contradicting messages, and the page pushes the assessor to create an assessment that already exists. Seen live while the API was booting (`ERR_EMPTY_RESPONSE`). | Defect | `web` `AssessmentListPage` |
| P2-7 | **List load failures are a dead end.** The only message is "Please refresh the page": no retry, and no difference between a network error, a 403 `Tenant not found` (needs a new sign-in, not a refresh) and a 500. | The assessor refreshes and gets the same result, with no idea what to do next. | Missing spec | `web` `AssessmentListPage` |
| P2-8 | **Assessment cards can't be reached with a keyboard.** Each card is a `<div onClick>` with no role and `tabIndex = -1`, so it isn't focusable, isn't announced as a link, and can't be opened in a new tab. | Keyboard and screen-reader users can't open any assessment, so they can't invite candidates or reach results. | Defect (accessibility) | `web` `AssessmentListPage` |
| P2-9 | **The list doesn't say what needs attention.** A row shows the name, time limit and only the latest session. There's no candidate count, nothing awaiting review, no failed portfolio generation, no language or created date, and no search or sort. | To find the work waiting for them, the assessor has to open every assessment one by one. | Missing spec | **seam** `api` `assessments#index` serializer; `web` `AssessmentListPage` |
| P2-10 | **Invite links never expire.** The token is a 64-character random hex with no expiry and no single use; the API's error says "Invalid or expired invite token", but nothing expires. | A link forwarded in email or WhatsApp stays usable forever: it shows the role and can start or end the session (P1-10). | Missing spec | `api` `Session`, `SessionsController` | a pending session created 400 days ago: `GET /sessions/:token/candidate` → 200 with the role title |
| P2-11 | **A missing level crashes the whole portfolio page.** `parseLevel(null)` calls `.replace` on `null`; the page is replaced by "Something went wrong." The API can't send `null` today (the column is `NOT NULL`), so it's latent. | Fixing P0-1 in the API alone would take the assessor's review screen down. The API and web halves of that fix must ship together. | Defect | **seam** `web` `parseLevel`, `SkillPortfolioCard`, `OverridePanel` | web functional test: portfolio with `ai_level: null` → error boundary |
| P2-12 | **The live monitor never shows a session that ended while it was reconnecting.** The end then only arrives in the initial `coverage_update` (`status: "ended"`), and `useCoverageWebSocket` only reacts to `session_status`. | The assessor keeps watching an interview that's over, and isn't pointed to the portfolio. | Defect | **seam** `api` `CoverageWebSocketMiddleware`; `web` `useCoverageWebSocket` | web integration test: initial message with `status: "ended"` → no "Session ended" |
| P2-13 | **The live monitor gives up reconnecting silently.** After three failed attempts (1, 2 and 4 s) it stops, and the header says "Reconnecting..." forever, with no retry. | The assessor waits on a dead screen with no hint to reload. | Defect | `web` `useCoverageWebSocket`, `LiveMonitorPage` | web integration test: 4 connections closed → still "Reconnecting..." |
| P2-14 | **A level label on the second skill sets the first skill.** Every `LevelRadio` renders the ids `level-1`…`level-5`, so on a form with two or more skills each label points at the first group. Clicking the radio circle works; clicking the "L4" text doesn't. | The assessor sets L4 on Communication and React changes instead, with no sign of it. The duplicate ids also break the labels for screen readers. | Defect (accessibility) | `web` `LevelRadio` (assessment, vacancy and override forms) | unit test: two groups, click "L5" in the second → first changes |
| P2-15 | **The skill picker drops the taxonomy skill id.** `SkillPicker` hands back `skill_id: undefined`, so assessment and vacancy skills are saved without it. | Fit/gap can only match skills by label, so a renamed or reworded skill becomes a gap. The vacancy API looks up level anchors by `skill_id`, so a vacancy's anchors are always null. | Defect | **seam** `web` `SkillPicker`; `api` fit/gap engine, vacancies serializer | unit test: picked React → `skill_id` missing |
| P2-16 | **Required fields fail silently.** The custom skill fields and the vacancy role title are `required: true` with no message, so Save does nothing and says nothing. Saving a new invite link or a vacancy edit also has no `catch`: a failed request shows no error. | The assessor clicks Save repeatedly, doesn't know why nothing happens, and may lose the form. | Defect | `web` `CustomSkillForm`, `VacancyNewPage`, `AssessmentInvitePage`, `VacancyEditPage` | web functional tests: empty custom skill / role title → no message, no request |
| P2-17 | **The edit and invite pages hide a load failure.** Both swallow the error (`.catch(() => {})`): the edit page shows an empty form that can be saved over the assessment, and the invite page shows "—" and "No candidates yet". | The assessor believes nobody was invited, or overwrites a real assessment with a blank one. | Defect | `web` `AssessmentEditPage`, `AssessmentInvitePage` (same pattern as P2-1) | web functional tests: 500 on load → no error shown |
| P2-18 | **Text below 4.5:1 contrast** (found by axe in Step 5, sub-PR 12; fixed there). White on the primary teal 3.55:1, the active top-bar link 3.28, level labels ("Proficient") 2.82-3.47, 12px green, amber and red status text 3.18-3.78. | Low-vision assessors, and anyone on a phone in daylight, misread levels and statuses. | Defect (accessibility) | `web` `index.css` tokens, `LevelBadge`, status text | E2E axe: `color-contrast` |
| P2-19 | **Controls with no accessible name** (found by axe in Step 5, sub-PR 12; fixed there). The vacancy picker and the icon-only back arrows on nine pages. | A screen reader announces "button" or "link" with nothing to say where it goes. | Defect (accessibility) | `web` `PortfolioPage`, page headers | E2E axe: `button-name`, `link-name` |
| P2-20 | **Microphone frames that start with `{` are dropped** (found while writing the audio proxy specs in Step 5, sub-PR 15; fixed there). The proxy told audio from control messages by the first byte, so a binary frame starting with 0x7B was parsed as JSON, failed, and was silently discarded: about one frame in 256. | Short gaps in what Gemini hears, a few times a minute; a word can be lost or misheard, and nothing in the logs says so. | Defect | `api` `AudioWebSocketMiddleware#handle_browser_frame` | Audio proxy spec |
| P2-21 | **A failed check hides the ones after it** (found in Step 5 when the hardware check failed on upload speed in the dev stack; fixed in sub-PR 19). The candidate page's hardware check ran as a chain: microphone only after Internet passed, audio output only after the microphone passed. | A candidate whose connection fails the (third-party, P1-12) speed test can't tell whether their mic and speakers work, so they fix the network, retry, and only then discover the next problem. | Defect | `web` `HardwareCheck` | component test: Internet failed → Microphone and Audio output stay "Waiting"; mic blocked → Audio output stays "Waiting" |
| P2-22 | **The portfolio page waits forever for a stalled generation** (found in Step 5 when the Sidekiq container had stopped; fixed in sub-PR 21). While the portfolio is "generating" the page polled every 5 s with no limit and promised "about 2 minutes". | When the worker is down or a job is lost, the assessor watches a spinner indefinitely with no explanation or next step; on 2026-10-19 one portfolio sat like that for five hours. The fit/gap page already stops after two minutes (AC-26). | Defect | `web` `PortfolioPage` | functional test: "generating" past three minutes → no alert, still spinning |
| P2-23 | **Retry on the hardware check gets stuck** (found reviewing `HardwareCheck.tsx` in Step 5; fixed in sub-PR 24). Retry reset the rows, but the first step ran only once, on mount. | A candidate whose check failed pressed Retry and watched "OS & browser: Checking..." forever; the only way on was reloading the page, which nothing told them. | Defect | `web` `HardwareCheck` | component test: Internet failed → Retry → speed test called once, row never "Passed" |
| P2-24 | **The hardware check leaves the microphone on** (found in the same review; fixed in sub-PR 24). The mic check's stream and its level-meter loop were never stopped. | Chrome showed the microphone as in use after "Interview complete", until the tab closed, and the meter ran 60 times a second all interview. For a product holding candidate data, a mic that looks on after the end is a trust problem. | Defect | `web` `HardwareCheck` | component test: unmount → track never stopped, frame never cancelled; Chrome: the check's stream still live after Start |
| P2-25 | **The timer stops while reconnecting** (found in the same review; fixed in sub-PR 24). It ran only in the "active" state, while the server's time ceiling keeps counting. | Every reconnect (about 20 in one dev interview) added its length to the time shown, so the server could end the interview with minutes still on the candidate's screen. | Defect | `web` `InterviewPage` (`timerRuns`) | unit test: reconnecting → not counting |
| P2-27 | **The candidate page says "Interview Complete" when it isn't, and can leave the microphone on** (found reviewing `InterviewPage` in Step 5; fixed in sub-PR 26). The broken link is P1-11, found in Step 3 and missed when this was logged; the rest is new. The closing screen was shown for a link that doesn't exist (404), any failed load, an error the server can't recover from, and every reconnect failing. When the server ended the interview, only the End button's path stopped the mic. | A candidate with a mistyped link, or whose interview broke halfway, was thanked and told the hiring team would follow up, with nothing to do and no reason to tell anyone. In Chrome the capture track stayed "live" under "Interview Complete" after the server ended the interview. | Defect | `web` `InterviewPage`, `useAudioWebSocket` | functional test: 404 → "Interview Complete"; session_ended → track still live; hook test: reconnects exhausted → "complete" |
| P2-28 | **A proctored interview doesn't notice a second screen** (asked by the product owner in Step 5; fixed in sub-PR 27). The setup requires sharing the entire screen, but nothing checked how many screens there are. | With two monitors a candidate shares one and keeps notes or another AI on the other: the interview passes as proctored and the assessor's line says the screen share stayed on. | Missing spec | `web` `InterviewPage`, `ProctoringSetup`; `api` `Session#proctoring_summary` | functional test: second screen connected → Start enabled, no pause; model spec: `second_screen_connected` ignored |
| P2-26 | **A portfolio job still being retried shows "failed", and Retry queues a second one** (found in Step 5 when Gemini answered 503 to session 18; fixed in sub-PR 25). The same defect as P2-2, found in Step 3 and missed when this was logged. The generator marked the portfolio failed on the first error, though Sidekiq still had three retries scheduled; `regenerate` accepted any "failed" portfolio. | The assessor is told generation failed while it is still being tried. Pressing Retry, as the page invites, starts a second job beside the first: on 2026-10-19 two jobs for one portfolio retried against a model that was already overloaded, and the status flipped between "generating" and "failed". | Defect | `api` `Portfolios::Generator`, `PortfoliosController#regenerate` | functional spec: one 503 → status "failed", Retry → 200 and a second job |

### P3: polish and hygiene

- The override can be saved without a reason. The label reads "You Overridden ✓".
- The hardware check reports an offline connection as 4 Mbps upload (a "conservative fallback" of 0.5 MB/s, exactly
  the minimum), so the upload line shows green. Ping still fails the check overall.
- The hardware check shows Edge as Chrome and Android as Linux (the more general match is checked first). Display
  only.
- On the assessment list, clicking a card goes straight to `/assessments/:id/invite`. There's no summary or detail
  view, and no Edit action from the list.
- `GET /assessments` returns the full `system_prompt` for every row, which the list never uses. It inflates the
  payload and sends the internal interviewer prompt to every page load.
- At 375px the header doesn't fit: the brand wraps onto three lines and the "Tenant: Demo Tenant" pill collapses
  into a three-line circle.
- No path to delete a candidate's data (transcripts, portfolio). That's needed for the right to erasure under
  UU PDP; it's tracked as constraint C4.
- **Roles are half-built (found while filling test gaps).** `User::ROLES` is `admin` and `user`, and login refuses
  anyone but `admin`, so a `user` account can never sign in. The API's role check accepts `assessor`, which `User`
  doesn't allow ("planned as a future role"). The seeds print a sample `student` token no code recognises. The web
  has a `SignupPage` with an Admin/User choice, but no route renders it and the API has no `/signup`.
- **Dead code:** `AuthTokenMiddleware` is never mounted (auth runs through `ApplicationController.authorize_auth_token!`);
  `skillTaxonomiesApi.get` expects a `skill_taxonomy` key the API sends as `skill`, and nothing calls it.
- `SkillTaxonomy::CATEGORIES` isn't validated: a skill with any other category saves, and the picker doesn't group
  by category anyway.
- Dev setup issues are in [00-work-log.md](00-work-log.md): the Puma pid directory, no seeded user, CRLF line
  endings, the `.env.example` port, no lockfile.

## Constraint signal (what I'd escalate to a Tech Lead)

- **C1: No model access, and model IDs are probably outdated.** No Gemini key came with the repo, and the default
  model IDs are the `gemini-2.0-*` family. The live interview can't be tested end to end without a key and current
  model names. I'm proceeding with stubbed model clients, and tests won't call the network.
- **C2: Auth trusts JWT claims without a user lookup.** Any token signed with the shared `SECRET_KEY_BASE` (also
  used by `rakamin-api`), with `role: admin` and any `scheme`, is accepted. Tenant isolation therefore rests
  entirely on scoping each model, which is exactly what failed in P0-2.
- **C3: Shared database with `rakamin-api`.** Migrations run against a database another service owns
  (`public.organizations`). Schema changes need to be coordinated and reversible.
- **C4: No retention or erasure policy** for transcripts, audio-derived text or portfolios. That's a product and
  legal decision, not an engineering default.
- **C5: No tests, no web test runner, no CI.** Every change above is currently unprotected against regression.
- **C6: The candidate is whoever holds the link.** There's no login and no check that the person talking is the person
  who was invited. That may be acceptable for a first screening round, but it's a product and trust decision, and
  it should be stated to clients rather than assumed.
- **C7: CORS allows any origin.** `ALLOWED_ORIGINS` is `"*"` in the sample config. Production needs the web app's
  origin only, set per environment, and it should be a deploy-time check.
- **C8: The production web config isn't verifiable from the repo.** `web/vercel.json` sets a CSP under which the
  hardware check can never pass (P1-12), so either production doesn't serve that CSP, or no candidate can start an
  interview. I'd ask which it is before anything else: if it's the second, it outranks every other finding. Either
  way, the speed test belongs on our own API, which fixes both the leak and the block.

## What this points to for Step 4

The highest-leverage change is the **post-interview result pipeline**: generation, storage, fit/gap and
presentation. It's where the candidate is harmed (P0-1, P1-1, P1-5), where the assessor's trust is decided
(P1-2, P1-3, P2-1), and where the breach sits (P0-2). The live interview layer (coverage, prompts, audio) is
comparatively well hardened, and it can't be verified without model access (C1).
