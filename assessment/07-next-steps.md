# What's not built yet, step by step

Everything below is a plan, not code. It's the "Not yet" and "Escalated" rows of the report, put in the order I'd
build them. Each item follows the same pattern as Step 5:
- tests first, pinned as `pending` or `it.fails` and checked to fail on their assertion;
- then the fix, which flips them to passing;
- then a docs commit.

For what *is* built, see the [API](05-api-walkthrough.md) and [web](06-web-walkthrough.md) walkthroughs.

**Order: block real candidate data first, then make people accountable, then improve the rating.** Phases 1 and 2
are the floor before the product sees a real candidate's data (UU PDP); the rest can follow.

| Phase | Item | Needs a decision from | Size |
|---|---|---|---|
| 1 · Before real data | ~~1.1 Refuse the free model tier in production~~ **done** (sub-PR 9) | No | Small |
| | 1.2 Notice and recorded consent before the mic opens | Legal: wording, lawful basis | Medium |
| | 1.3 Users belong to a company (C2); mitigated in sub-PR 9 | Tech Lead: data model shared with `rakamin-api` | Medium |
| 2 · Accountability | 2.1 Roles: recruiter, hiring manager, admin | Product: who sees what | Medium |
| | 2.2 Human review on record, and the candidate's objection channel | Product: who handles objections | Medium |
| 3 · Data lifecycle | 3.1 Retention, erasure and export per candidate | Legal: the retention period | Medium |
| | 3.2 Audit log, alerts and an incident runbook | Who is on call, who notifies | Medium |
| 4 · Rating quality | 4.1 Quality and bias evaluation against human raters | Product: target numbers, after the baseline | Large |
| Upgrades | ~~Rails 7.0 → 8.1~~ **done** (sub-PR 16); puma 5 → 7 | Tech Lead: when to deploy (C3) | Small to medium |
| 5 · On screen and in the interview | 5.1–5.6 Level labels, nice-to-have tier, capped verdict, transcript warning, longer reconnect window, mixed language | Product, for 5.2 and 5.3 | Small each |

---

## Phase 1 · Before any real candidate data

### 1.1 Refuse the free model tier in production: done in sub-PR 9

Built as planned, as `ProductionGuards` (`api/app/lib/production_guards.rb`), checked by a spec that boots the app
in production. Doing it found that production didn't boot at all (an Active Job setting the app never loads),
fixed in the same sub-PR. The plan as it was:

**Why.** The Gemini free tier may use inputs to improve Google's products, and its terms say not to send personal
information. A candidate's interview is personal information.

**Steps.**
1. Add `GEMINI_TIER` (`paid` or `free`) to the config, next to the model names.
2. Add a boot check in an initializer: in production, refuse to start unless the tier is `paid`, with a message that
   says why.
3. Add the same check as a step in the deploy checklist, so it's visible before boot.

**Files.** `api/config/initializers/`, `.env.example`, README deploy notes.

**Tests.**
- With `RAILS_ENV=production` and the tier unset or `free`, boot raises.
- With `paid`, boot succeeds.
- In development, either value works.

**Decision.** None. **Size.** Small.

### 1.2 Notice and recorded consent before the mic opens

**Why.** Today the candidate sees nothing before the microphone opens, and "has been recorded" only appears after
(UU PDP Art. 20–22; Step 3, P2-4).

**Steps.**
1. Add a `consents` table: `session_id`, `notice_version`, `language`, `accepted_at`, and `declined_at`.
   - No IP address or device fingerprint: proving consent doesn't need them.
   - Use a reversible migration.
2. Store the notice text as versioned files, in both supported languages. The wording comes from legal; the mechanism
   doesn't wait for it.
3. Add `POST /sessions/:token/consent`, guarded by the invite token like the other candidate routes and filtered from
   the logs.
4. The session start handler refuses to start without a consent row. This is enforced on the API, not only hidden in
   the UI.
5. On the candidate page, show the notice **before** the hardware check:
   - what the interview is, that it's rated by AI, the purpose, and who sees the result;
   - that Google processes the audio outside Indonesia;
   - how long data is kept, and how to ask for deletion.
6. Declining shows "contact the recruiter", with no penalty and no session started.
7. Fix the broken-link message that says "has been recorded" (P1-11) in the same change.
8. Move the hardware check's speed test to our own API (P1-12), so no third party sees the candidate's IP before
   consent.

**Files.** A new migration and model; `sessions_controller.rb` (candidate routes); `sessions/start_handler.rb`;
`web/src/pages/interview/InterviewPage.tsx`; `HardwareCheck.tsx`; `utils/hardwareUtils.ts`.

**Tests.**
- **API:** start without consent is refused; consent is stored with its version; a decline records no session start;
  the token is filtered from the log.
- **Web:** the notice comes before the mic; Start is disabled until accepted; decline shows the recruiter path.
- **Known defects flip to passing:** P2-4 and P1-11 (candidate page), and P1-12 (speed test).

**Decision.**
- Legal: the wording.
- Legal: the lawful basis, consent or legitimate interest. It decides whether declining must be possible with no
  consequence; the flow above supports it either way.

**Size.** Medium.

### 1.3 Users belong to a company (C2)

**Mitigated in sub-PR 9:** production must set `LOGIN_TENANT_SCHEME`, and login refuses any other company, so one
deployment serves one company. The steps below are still the fix.

**Why.** Login takes the company from the `X-Tenant-Scheme` header, and users belong to no company, so any admin can
sign in to any company. Sub-PR 8 pinned this as `pending`.

**Steps.**
1. **Decide with the Tech Lead** where membership lives. The database is shared with `rakamin-api` (C3), which may
   already model it.
2. Add a membership: a `user_id` and `organization_id` join, so one person can work for two companies.
3. Login:
   - The company named in the header must be one of the user's.
   - With one membership, the header isn't needed.
   - A company the user doesn't belong to gets 401, with the same message as a wrong password.
4. Every request: check that the token's `user_id` is still a member of the token's company. This also closes C2's
   other half: claims are trusted without a user lookup.

**Files.** A migration; `user.rb`; `authentication_controller.rb`; `auth/authorize_api_request.rb`.

**Tests.**
- The pending "does not let a user pick the company they sign in to" (`tenant_routes_spec.rb:171`) flips to passing.
- New cases: removed membership means the next request is refused; a token for company B used by a member of A only
  is refused.

**Decision.** Tech Lead: the data model. **Size.** Medium.

## Phase 2 · Accountability

### 2.1 Roles: recruiter, hiring manager, admin

**Why.** One `admin` role does everything. A recruiter doesn't need the configuration, and an engineer shouldn't read
production transcripts by default.

**Steps.**
1. **Agree the matrix with product** first:

   | Role | Can do |
   |---|---|
   | Recruiter | Invite candidates, see status, read reports |
   | Hiring manager | Read portfolio, evidence and fit/gap; add ratings |
   | Admin | Configure assessments and vacancies |

2. Put the role on the membership from 1.3, not on the user: one person can have different roles in two companies.
3. `authorize_auth_token!` already takes roles. Give each controller action the roles it allows.
4. Hide the actions a role can't use in the web, but treat the API as the real check.

**Files.** Controllers (`authorize_auth_token!` lines), `authorize_api_request.rb`, `web/src/components/layout/AssessorLayout.tsx` and the pages.

**Tests.** Extend `tenant_routes_spec.rb`'s route table into a route × role matrix: every route has an expected
answer for every role, so a new route without one fails the suite.

**Decision.** Product: the matrix. **Size.** Medium.

### 2.2 Human review on record, and an objection channel

**Why.** UU PDP Art. 10 gives a right to object to decisions based on automated profiling.
- **Today:** an override records who and when, and keeps only the latest change. A reason is required only when the
  AI gave no rating.
- **What's needed:** a reason for every change, the full history, and a visible review.

**Steps.**
1. Keep every rating change: an `assessor_override_events` table, append-only (who, when, from, to, reason).
   `assessor_overrides` stays as the current value.
2. Require a reason for every change, not only for skills the AI didn't rate. This flips the P3 `it.fails` test.
3. Add a "Reviewed by … on …" record, even when nothing changed, shown at the top of the portfolio.
4. Fit/gap and the PDF show who reviewed the result, so it's clear a person stands behind it.
5. **Objection channel:** a contact the candidate gets in the notice (1.2), routed to a named owner per company, and a
   log of objections and their outcome.
6. No auto-reject, ever: there's none today, and a test pins it so it stays that way.

**Files.** Migrations; `assessor_override.rb`; `portfolio_skills_controller.rb`; `OverridePanel.tsx`; `PortfolioPage.tsx`; `pdf_generator.rb`.

**Tests.**
- **API:** history keeps every change; a change without a reason is refused; the review record shows in the payload.
- **Web:** the reason is required; history is shown; "Reviewed by" is shown.

**Decision.** Product: who handles objections, and the target response time. **Size.** Medium.

## Phase 3 · Data lifecycle

### 3.1 Retention, erasure and export per candidate

**Why.** There is no retention period and no way to erase or export one candidate's data (UU PDP Art. 7, 8, 44).

**Steps.**
1. Add `retention_days` per company, with no default until legal gives a number. The purge job doesn't run without
   it.
2. Add a scheduled purge (Sidekiq cron). It removes the transcript, coverage, portfolio, overrides and history, and
   fit/gap for sessions ended more than `retention_days` ago. Use one transaction per session.
3. Add **erase one candidate** on request: the same cascade, by session.
4. Add **export one candidate**: everything held about them as JSON, for an access request.
5. Write every purge, erasure and export to the audit log (3.2), with IDs and counts only, never the content.
6. The notice (1.2) states the period. PDFs already downloaded can't be recalled, and the notice says so.

**Files.** A migration; a new purge worker and an erasure service; an admin-only controller; `config/schedule` or the
Sidekiq cron config.

**Tests.**
- Purge removes exactly what's past the period and nothing else.
- Erasure leaves no row for the session in any table. The spec walks `ActiveRecord` associations, so a new table
  can't be forgotten.
- Export contains every table.
- Purge doesn't run without a period.

**Decision.** Legal: the retention period. **Size.** Medium.

### 3.2 Audit log, alerts and an incident runbook

**Why.** Without a log of who opened which candidate's data, a breach can't be detected, let alone reported within 3 ×
24 hours (UU PDP Art. 46).

**Steps.**
1. Add an `audit_events` table, append-only: actor, company, action, record type and ID, time.
   - No content: no transcript text, no names.
2. Log reads of portfolios, transcripts and exports, every rating change, and every purge or erasure.
3. **Alerts:**
   - Any 404 from a cross-company ID (the pattern `tenant_routes_spec` tests) above a threshold.
   - Exports in bulk.
   - Logins to an unexpected company.
   - Each alert goes to the on-call engineer.
4. **Runbook** (`docs/runbooks/data-incident.md`):
   - Detect and contain.
   - Escalate to the controller's privacy contact within hours.
   - The 3 × 24-hour notice clock starts at discovery.
   - Includes a template for the notice.
5. Tighten the one remaining `e.message` log on this path (`fit_gap_generator_worker.rb:16`) and check the audio
   WebSocket middleware's logs for personal data.

**Tests.**
- Each audited action writes one event without content.
- A cross-company probe raises the alert.
- A spec fails if transcript text reaches the log (like `parameter_logging_spec`).

**Decision.** Who is on call; who sends the notice (the controller). **Size.** Medium.

## Phase 4 · Rating quality and bias

### 4.1 Evaluate ratings against human raters, across languages

**Why.** The tests prove states and quotes, not that a level is right, or equally right in Indonesian, English and a
mix of both.

**Steps.**
1. Build a set of answers per skill and level:
   - In Indonesian, English, and mixed within one answer.
   - Including short but relevant answers.
   - **Synthetic or consented data only.**
2. Two or more people rate each answer against the rubric. Where they disagree, that's measured too: the model can't be
   held to a standard people don't meet.
3. A script runs the real generator over the set and reports:
   - agreement with the human raters (exact and within one level);
   - the share of quotes dropped as unverifiable;
   - the difference in agreement between languages;
   - the share of "not assessed".
4. It runs **on a schedule and before a prompt or model change**, not in CI, because it calls the paid model.
5. **Set targets after the first baseline**, with product. Not before: a number picked in advance is a guess.

**Files.** `api/spec/evals/` or `api/lib/evals/`, a dataset folder (gitignored if it's ever consented real data), a
rake task.

**Decision.** Product: the targets, and what happens when a language falls behind. **Size.** Large, mostly the
dataset.

## Upgrade Rails and puma (found by the security scans, sub-PR 13)

**Why.** Rails 7.0 left support on 2025-04-01, and puma 5 has two advisories fixed only in 7 and 8. The security scans
of sub-PR 13 left fourteen gem advisories skipped, each with its reason in `api/.bundler-audit.yml`: twelve in Rails,
two in puma.

### ~~Rails 7.0 → 8.1~~ done (sub-PR 16)

- One minor version at a time, 7.0 → 7.1 → 7.2 → 8.0 → 8.1 (8.1.4), with the suite green before each commit.
  `load_defaults` moved last, in commits of its own. It went past 8.0 because Brakeman fails on it: 8.0's support
  ends 2026-11-07.
- The twelve Rails advisories and Brakeman's end-of-life ignore are gone; `config/brakeman.ignore` is empty.
- **Found on the way:** `schema.rb` couldn't record that `organizations` is in `public` and every other table in
  `ai_interview`, so a database built from it (CI's) had the wrong layout, and since the 8.0 dump `e2e:seed`
  couldn't find the seeded company. Rails 8.1 dumps schema-qualified names; `schema.rb` now matches the migrated
  layout. Worth a look from the Tech Lead because the database is shared with `rakamin-api` (C3): this app's
  `schema.rb` describes a `public` table it doesn't own.

### Puma 5 → 7

**Steps.**
1. Upgrade puma to 7. Puma 6+ allows Rack 3, which Rails 8.1 supports, so take Rack 3 in the same or the next step.
2. Check `config/puma.rb`, and the two WebSocket middlewares, which take over the connection through Rack's hijack
   API (`faye-websocket`).
3. Remove the two puma entries from `.bundler-audit.yml` in the commit that fixes them.

**Tests.** The full API suite, including the audio proxy specs (sub-PR 15), the E2E job, and the production boot
spec; then a live interview in the dev stack, since the specs fake both sockets.

**Decision.** Tech Lead: when to deploy it, given the database shared with `rakamin-api` (C3). **Size.** Small to
medium.

## Phase 5 · On screen and in the interview

Small changes, each with its own tests first.

### 5.1 Plain-language level labels

**Today.** `LEVEL_LABELS` maps 1–5 to "L1"–"L5" (`web/src/utils/constants.ts:32`).

**Steps.**
1. Show a word next to the level ("L3 · Capable"), using names agreed with product.
2. Show the role's rubric anchor for that level on hover and on tap, so it works on a phone.
3. Use the same labels in the PDF.

### 5.2 A nice-to-have tier

**Today.** Every vacancy skill has a required level (`vacancy_skills.expected_level`, `NOT NULL`).

**Steps.**
1. Add `importance` (`required` or `nice_to_have`, defaulting to `required`) in a reversible migration. Existing
   rows don't change.
2. Fit/gap counts only required skills in the verdict; nice-to-have skills are shown apart.
3. Add a toggle on the vacancy form.

**Decision.** Product.

### 5.3 Cap the overall verdict by evidence

**Today.** The overall narrative is the model's own (`fit_gap/engine.rb`), and the per-skill results are honest.

**Steps.**
1. Compute a verdict in code before the narrative: `incomplete` if any required skill is not assessed; otherwise from
   matches and gaps.
2. Pass that verdict to the model as a fact it must not contradict. The fallback narrative uses it too.
3. Show the verdict above the table, with "incomplete" explained ("2 required skills weren't assessed").

This is Option C from Step 4. **Decision.** Product sign-off.

### 5.4 Warn when the transcript may be poor

**Today.** No quality signal from speech recognition is kept.

**Steps.**
1. Store per-turn signals we already have or can get cheaply: reconnects during the session, very short candidate
   turns, and the share of quotes dropped as unverifiable.
2. Above a threshold, show "Audio or transcript quality may be limited: check the quotes before relying on these
   ratings" on the portfolio.
3. Never change a level because of it.

### 5.5 A longer reconnect window

**Today.** The interview page reconnects three times (1, 2, 4 s) and shows the connection state; Gemini resumes the
conversation (`useAudioWebSocket.ts:15`). After about seven seconds the page moves to the end screen.

**Steps.**
1. Keep retrying for longer (for example up to 60 seconds, with backoff) while the session is still active on the
   server.
2. On the end screen after a drop, say that the connection was lost, not that the interview finished.
3. Let the invite link rejoin an active session within its time limit.
4. The end reason records the drop, so the portfolio's summary line can say so ("the connection was lost after 6
   minutes").

**Tests.** The existing interview component tests, with a fake socket that drops for 10 and 90 seconds.

### 5.6 Let the interviewer follow a mix of languages

**Today.** The system prompt says "Do not switch languages even if the candidate uses another language"
(`api/app/services/assessments/system_prompt_compiler.rb:34`), while mixing Indonesian and English is normal at work.

**Steps.**
1. Keep the assessment's language as the default.
2. Allow answers in either language, and allow the interviewer to follow a candidate who mixes them.
3. Show the candidate page in the interview's language (today it's English only).
4. Check the effect with 4.1's mixed-language set before and after.

**Tests.** The prompt compiler spec asserts the new rule; the eval (4.1) checks the rating didn't get worse.
