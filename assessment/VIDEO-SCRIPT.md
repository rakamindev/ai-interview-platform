# Video walkthrough — step by step

**Target 4:30. Hard limit 5:00.**

Every section below has three parts:

- **SHOW** — what is on screen
- **DO** — what you click or scroll
- **SAY** — read this out loud, word for word

Sentences are kept short on purpose. Read slowly. It is fine to pause between sentences — pauses sound confident, rushing does not.

---

## Before you record

**1. Clean up the test data.** You created an assessment called "Senior FE" while exploring. Delete it so the list looks intentional:

```bash
cd D:/Project/Testing/Rakamin/ai-interview-platform
docker compose exec api bundle exec rails runner "Current.tenant_id=1; a=Assessment.find_by(name:'Senior FE'); a&.sessions&.destroy_all; a&.destroy; puts 'removed'"
```

**2. Start everything.**

```bash
docker compose up -d
```

```bash
cd web && npm run dev
```

Wait until `curl http://localhost:3001/health` returns `{"status":"ok"}`.

**3. Open these tabs, in this order.** Pre-loading them means you never wait on a spinner during the take.

| Tab | What |
|---|---|
| 1 | `assessment/screenshots/00-BEFORE-fitgap-desktop.png` — open in an image viewer, full screen |
| 2 | http://localhost:5173/assessments/2/sessions/2/fitgap/2 |
| 3 | Your editor, open on `api/app/services/portfolios/generator.rb` |
| 4 | A terminal, cleared, in the repo root |

**4. Settings.** Browser zoom **110%**. Screen recording at 1280×800 or larger. Close Slack, WhatsApp, email — no notifications on screen.

**5. Record a 20-second test first.** Check your microphone is actually capturing before you do the whole thing.

---

## SECTION 1 — The problem (0:00 – 0:35)

**SHOW:** Tab 1, the before screenshot, full screen.

**SAY:**

> "This platform interviews a candidate with AI. It grades them against behavioural anchors. Then it gives a recruiter a fit-gap report."

> "I want to start with what that report looked like before I changed it."

**DO:** Move your mouse slowly down the empty **Required** column.

**SAY:**

> "This column is Required. It is the level the role demands. It is empty on every single row."

> "This is a gap report that cannot tell you what the gap is measured from."

**DO:** Move your mouse to the summary line at the bottom.

**SAY:**

> "And this summary says one match, two gaps, one exceeds. That is four skills. This role requires seven."

> "Three skills were never assessed. They appear in no count and no total. A recruiter reading this believes they are looking at a complete evaluation."

---

## SECTION 2 — Why it happened (0:35 – 1:35)

**SHOW:** Tab 3, your editor.

**SAY:**

> "I expected this to be a display bug. It was not. It went all the way down to the database."

**DO:** Run this in Tab 4 so the original line is on screen:

```bash
git show main:api/app/services/portfolios/generator.rb | grep -n "clamp"
```

**SAY:**

> "The column `ai_level` was NOT NULL, with a check constraint of one to five. There was no way to store *we did not assess this*."

> "So the code did this."

**DO:** Point at `to_i.clamp(1, 5)`.

**SAY (slowly — this is the most important sentence in the video):**

> "`nil.to_i` is zero. Clamp zero into the range one to five, and you get **one**."

> "And L1 in this taxonomy means: executes with explicit guidance. Cannot apply independently."

*Pause for one second.*

> "So a skill the interview simply ran out of time to reach gets written into a real person's permanent evaluation as a documented weakness."

> "The system was turning absence of evidence into evidence of incompetence. And then hiding it in a summary that did not add up."

> "The frontend had the same bug independently. `parseLevel` also returned one when it could not parse. Two separate layers had each decided that unknown means lowest."

---

## SECTION 3 — The fix (1:35 – 2:25)

**SHOW:** Tab 2, the fixed report.

**SAY:**

> "Same candidate. Same data. Same API."

**DO:** Point at the Required column.

**SAY:**

> "Required is populated on every row now."

**DO:** Point at the grey banner above the table.

**SAY:**

> "And above the table: three of seven required skills were not assessed. This is an incomplete picture of the candidate. Absence of evidence is not evidence of a gap."

**DO:** Point at the summary counts.

**SAY:**

> "The counts now total seven. And the unassessed rows are grey, never red. They are missing information, not a finding against anyone."

**DO:** Hover the mouse over the `✎ was L3` badge on the *Testing & Quality Assurance* row. Hold it there so the tooltip appears.

**SAY:**

> "Here an assessor overrode the model, from L3 down to L2. The old report showed L2 with no sign a human had touched it."

> "The flag existed in the engine. It was computed, and then dropped before it was sent. Meanwhile the interface printed a legend advertising a marker that could never appear."

**DO:** Scroll down to the narrative card.

**SAY:**

> "This narrative is live from Gemini. Read what it says: these skills were not assessed, so this should not be considered a complete evaluation."

> "I changed the prompt to require that. So the honesty holds at the AI layer too, not only in the fallback."

---

## SECTION 4 — The security finding (2:25 – 3:05)

**SHOW:** Tab 4, terminal.

**DO:** Run this so the old code is on screen:

```bash
git show main:api/app/controllers/api/v1/portfolios_controller.rb | grep -n "Portfolio.find"
```

**SAY:**

> "While I was in the controllers I found something more serious."

> "Assessment, Session and Vacancy are all tenant scoped. Portfolio has no tenant id, and no scoping at all."

> "Every lookup was a global find, on a sequential integer."

> "So any logged-in assessor could read another company's candidate. Including the PDF export, which contains verbatim interview quotes."

**DO:** Run:

```bash
git show main:api/app/controllers/api/v1/portfolio_skills_controller.rb | grep -n "joins"
```

**SAY:**

> "And this one looked defended. It is not. `joins` adds no tenant filter when the joined model is not scoped."

> "That was a cross-tenant **write**. You could change another company's hiring evaluation, recorded under your own user id."

> "Under Indonesia's personal data law, UU PDP, that is a purpose limitation breach, not just an authorization bug."

> "I added a concern that derives tenancy from the session. I made it an explicit scope, not a default scope, because background workers legitimately run with no tenant. I would rather the requirement be visible at every call site than hidden."

---

## SECTION 5 — Proof (3:05 – 4:00)

**SHOW:** Tab 4, terminal.

**DO:** Run:

```bash
docker compose exec -e RAILS_ENV=test api bundle exec rspec
```

**SAY:**

> "Fifty-four examples. There was no spec directory when I started. The `.rspec` file existed and pointed at nothing."

**DO:** Run:

```bash
cd web && npm test
```

**SAY:**

> "Eighteen on the frontend. There was no test runner there either."

*Pause.*

> "But passing tests only prove the code does what it does. So I broke it on purpose."

**DO:** Run:

```bash
git show 075e96e --stat
```

**SAY:**

> "I put both bugs back on a scratch branch, to watch the tests fail."

> "Restoring the clamp produces seven failures. Nil, empty string, the word three, zero and nine all come back as levels instead of nil."

> "Restoring the old field name produces three."

> "My favourite is this one: *found multiple elements with the text em-dash*. With the bug present, the Required cell falls back to a dash as well. So an unassessed row renders two dashes."

> "That is the original bug's exact fingerprint. And you can see it in the before screenshot I opened at the start."

> "The fault and the revert are both in the git history."

---

## SECTION 6 — What I did not finish (4:00 – 4:30)

**SHOW:** Anything. Your face, or the report. This part is spoken.

**SAY:**

> "Two things I deliberately did not close."

> "First. I fixed the four models I found unscoped. The next model somebody adds brings the hole back. That needs an architectural guard, not four patches. I would not call the tenancy work done until that exists."

> "Second. The users table has no tenant id. It is a flat global table shared with the upstream API. I could not tell from this repository whether user to organisation membership is enforced upstream. If it is not, my fix is necessary but not sufficient. That is the question I would want answered before this ships."

> "One last thing. The migrations refuse to roll back while unrated rows exist. They do not backfill them to L1. Because that would quietly re-harm those candidates during what an operator thinks is a neutral rollback."

> "Thank you."

---

## Rules

**Do not skip Section 6.** Saying what you did not finish, and why, reads as judgement. It is also the honest answer, and they explicitly ask for a constraint signal.

**If you run long,** cut nothing from Sections 2, 4 or 5. Trim Section 3 instead — the screenshots already carry it.

**If you fluff a line,** stop, pause two seconds, and say it again. You can cut the pause later. Do not restart the whole recording.

---

## Questions they will probably ask

Have these ready. They are the three weakest-looking decisions, and the answers are good.

**"Why did you change the frontend instead of the API for `required_level`?"**

> `skill_comparisons` is stored as JSONB. Every report already saved holds `expected_level`. Changing the client repairs all of them with no backfill. It also keeps one name from the database column, through the service, to the PDF export — which already reads the correct key. Renaming the API would have broken the PDF export.

**"Why not a `default_scope` for tenancy?"**

> Sidekiq workers run outside a request, with no tenant in RequestStore. With a default scope they would silently see nothing, or I would need `unscoped` scattered through them. An explicit scope keeps the requirement visible where it matters.

**"Why nullable instead of an `evidence_state` enum?"**

> One nullable column, versus a new enum plus a backfill plus a write path through the generator. The distinction between *never covered* and *insufficient evidence* is derived at the report layer, which is where a human actually reads it. If querying that in SQL becomes a product need, the enum is the migration to write — and the derivation logic already defines its meaning.

**"How much of this did AI write?"**

Answer honestly. The brief encourages AI and asks you to verify it. Have a real example ready — the strongest one is in the report: a stale code comment claimed the fit/gap endpoint checked for overrides. It does not. The finding looked solid, and it was wrong — `regenerate_stale_fitgap_reports` handles it from the override endpoint instead. Checking the write path before writing it up is what caught it.
