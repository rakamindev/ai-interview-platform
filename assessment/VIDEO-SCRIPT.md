# Video walkthrough — shot list & script

**Target: 4:30.** Hard ceiling 5:00. Read it, don't improvise — every sentence below is one you can defend.

**Before you hit record**

```bash
cd D:/Project/Testing/Rakamin/ai-interview-platform
docker compose up -d && sleep 20
cd web && npm run dev
```

Open these five tabs in order, so you never wait on a page during the take:

1. `http://localhost:5173/assessments/2/sessions/2/fitgap/2` — the fixed report
2. `http://localhost:5174/assessments/2/sessions/2/fitgap/2` — **optional**, the `main` worktree, if you re-create it for a live before/after. Otherwise use `assessment/screenshots/00-BEFORE-fitgap-desktop.png` full-screen.
3. `assessment/screenshots/00-BEFORE-fitgap-desktop.png`
4. Editor on `api/app/services/portfolios/generator.rb`, scrolled to `coerce_level`
5. Terminal, cleared, ready to run the suites

Screen at 1280×800 or larger. Zoom the browser to 110% — the table text is small on a compressed recording.

---

## 0:00–0:35 · The problem, not the feature

> "This platform interviews a candidate with AI, grades them against behavioural anchors, and gives a recruiter a fit/gap report. I want to start with what that report looked like before I touched it."

**[Tab 3 — the before screenshot, full screen]**

> "Two things. The Required column — the level the role actually demands — is empty on every single row. This is a gap report that can't tell you what the gap is measured *from*."

*Point at the blank column. Pause a beat.*

> "And the summary at the bottom says one match, two gaps, one exceeds. That's four skills. This role requires seven. Three of them were never assessed at all, and they appear in no count, no total, and no sentence. A recruiter reading this at a glance believes they're looking at a complete evaluation."

---

## 0:35–1:35 · The root cause

> "I expected the second problem to be a display bug. It wasn't. It went all the way to the schema."

**[Tab 4 — `generator.rb`, on the old line if you can show it in `git show main:...`, otherwise say it]**

> "`portfolio_skills.ai_level` was NOT NULL with a check constraint of 1 to 5. There was no way to store *we didn't assess this*. So the generator did this:"

```ruby
ai_level: skill_data['level'].to_i.clamp(1, 5)
```

> "`nil.to_i` is zero. Clamp zero to the range one-to-five and you get **one**. And L1 in this taxonomy reads: *executes with explicit guidance, cannot apply independently*."

*Slow down here. This is the sentence the whole submission rests on.*

> "So a skill the interview simply ran out of time to reach gets written into a real person's permanent evaluation as a documented weakness. The system was converting absence of evidence into evidence of incompetence — and then hiding the arithmetic in a summary that didn't add up."

> "The frontend had the same fallback independently — `parseLevel` returned 1 on anything it couldn't parse. Two layers had each decided that unknown means lowest."

---

## 1:35–2:25 · The fix, on screen

**[Tab 1 — the fixed report]**

> "Same candidate, same data."

> "Required is populated on every row. Above the table: *three of seven required skills were not assessed — this is an incomplete picture of the candidate; absence of evidence is not evidence of a gap.*"

> "The counts now total seven. Unassessed rows are neutral grey, never red — they're missing information, not a finding against anyone."

*Hover the ✎ badge on Testing & Quality Assurance.*

> "And here — the assessor overrode the model from L3 down to L2. The old report showed L2 with no indication a human had touched it. The `is_override` flag was computed in the engine and then dropped before serialisation, while the UI printed a legend advertising a marker that could never appear."

*Scroll to the narrative.*

> "That narrative is live from Gemini. Note what it says: *these skills were not assessed, so this should not be considered a complete evaluation.* I changed the prompt to require that. The honesty holds at the AI layer too, not just in the deterministic fallback."

---

## 2:25–3:05 · The one they'll care about most

> "While I was in the controllers I found something more serious."

```ruby
portfolio = Portfolio.find(params[:id])
```

> "`Assessment`, `Session` and `Vacancy` are all tenant-scoped. `Portfolio` has no `tenant_id` and no scoping at all. Every lookup was a global find on a sequential integer. Any authenticated assessor could read another organisation's candidate — including the PDF export with verbatim interview quotes."

> "And the override endpoint looked defended:"

```ruby
PortfolioSkill.joins(:portfolio).find(params[:id])
```

> "`joins` adds no tenant predicate when the joined model isn't scoped. So that was a cross-tenant *write* — you could alter another company's hiring evaluation, recorded against your own user id."

> "Under UU PDP that's not just an authorization bug, it's a purpose-limitation breach on personal data. I added a `TenantScopedThrough` concern that derives tenancy from `sessions.tenant_id`. I made it an explicit scope rather than a default scope, because Sidekiq workers legitimately run with no tenant and I'd rather the requirement be visible at every call site than hidden."

---

## 3:05–4:00 · Proof

**[Tab 5 — terminal]**

```bash
docker compose exec -e RAILS_ENV=test api bundle exec rspec
```

> "Fifty-four examples. There was no `spec` directory when I started — `.rspec` existed and pointed at nothing."

```bash
cd web && npm test
```

> "Eighteen on the frontend. No test runner existed there either."

> "But passing tests only prove the code does what it does. So I broke it on purpose."

```bash
git show 075e96e --stat
```

> "I put both defects back on a scratch branch. Restoring the `to_i.clamp` produces seven failures — nil, empty string, `three`, zero and nine all come back as levels instead of nil. Restoring `required_level` on the client produces three."

> "My favourite is this one: *found multiple elements with the text em-dash*. With the bug present, the Required cell falls back to a dash too — so an unassessed row renders two of them. That's the original defect's exact fingerprint, and it's in the before screenshot."

> "The fault and the revert are both in the history."

---

## 4:00–4:30 · What I'd escalate

> "Two things I deliberately didn't close."

> "First — I fixed the four models I found unscoped. The next one someone adds reintroduces the hole. That needs an architectural guard, not four patches, and I wouldn't call the tenancy work done until it exists."

> "Second — `users` has no `tenant_id`; it's a flat global table shared with the upstream API. I couldn't determine from this repo whether user-to-organisation membership is enforced upstream. If it isn't, my fix is necessary but not sufficient. That's the question I'd want answered before this ships."

> "The migrations refuse to roll back while unrated rows exist, rather than backfilling them to L1 — because that would silently re-harm those candidates during what an operator thinks is a neutral rollback."

> "Thanks."

---

## Notes

**Do not skip the escalations.** Saying what you didn't finish, and why, reads as judgement rather than as a gap. It's also the honest answer.

**If you overrun**, cut the fully-assessed and empty states — don't cut the tenancy section or the seeded fault.

**Likely questions, so have the answer ready:**

- *Why fix the client instead of the API for `required_level`?* — `skill_comparisons` is persisted JSONB. Renaming the client repairs every historical report with no backfill, and keeps one name from column through service to PDF export. Renaming the API would have broken `Exports::PdfGenerator`, which reads the correct key today.
- *Why not a `default_scope` for tenancy?* — workers run outside a request with no tenant set; they'd silently see nothing, or need `unscoped` scattered through them.
- *Why nullable rather than an `evidence_state` enum?* — one nullable column instead of a new enum plus backfill plus a generator write path. The report layer derives `not_covered` vs `insufficient_evidence` from whether a portfolio row exists at all, which is where a human actually reads it. Cheap to walk back if SQL-level querying becomes a product need.
