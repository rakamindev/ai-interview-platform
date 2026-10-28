# Step 3: Problem and gap analysis (runtime-verified)

Every finding below was reproduced on a local run (2026-10-23) with fake data, unless its
**Evidence** column says otherwise. Labels: **verified** = reproduced at runtime;
**verified (sim)** = reproduced by forcing the state the failure would leave behind;
**code** = read in code, not reproduced.

Test data (all invented, see `assessment/evidence/`):
- Tenant A `test-corp`: assessment "Frontend Engineer Intern (pilot)" with 4 skills, vacancy
  "Frontend Engineer Intern" with the same 4 skills plus Security (not in the assessment).
  - Session 1, "Rina Pratama (fake)": 15-turn transcript. Coverage: React covered/3 probes,
    TypeScript partial/2, Testing initiated/1, Communication not_yet/0, discovered
    "Web Accessibility" initiated/1.
  - Session 2, "Budi Santoso (fake)": one candidate turn ("my audio is breaking up, can you
    repeat?"), all coverage not_yet/0.
- Tenant B `other-corp`: one session and portfolio, used only for isolation checks.
- The live audio interview was not run. Transcripts and coverage maps were seeded. Session end,
  portfolio generation, fit/gap and export went through the real API, Sidekiq and Gemini.
- Local model override: the sample model ids return 404 (see N2), so local runs used
  `gemini-2.5-flash` for both `GEMINI_PRO_MODEL` and `GEMINI_FLASH_MODEL`.

## Core problem

The product turns an interview into a level per skill and then into a hiring recommendation.
Today it cannot tell **"we did not measure this"** apart from **"the candidate is weak at this"**.
A skill that was never discussed is stored as L1, shown as "L1 Foundational / Only briefly
explored", becomes a "Gap" against the vacancy, and is written into the hiring narrative as a
fact. In the worst case seen, a candidate whose audio broke after one sentence got "Gap" on
every skill and a narrative saying they are "not yet at the level to independently contribute".
The assessor sees no signal that anything is off: the Required column is blank, confidence is
not shown, and correcting the rating breaks the PDF export. On top of that, any assessor can
read and change other companies' candidate portfolios by guessing an integer id.

## Findings

| # | Sev | Type | Area | Finding | Impact (one line) | Evidence |
|---|---|---|---|---|---|---|
| F1 | P0 | defective impl | api | `Portfolio`, `PortfolioSkill`, `AssessorOverride`, `FitGapReport` are not tenant scoped. `PortfoliosController` (export, fitgap, show_fitgap, regenerate_fitgap) uses `Portfolio.find`, `PortfolioSkillsController` uses `PortfolioSkill.joins(:portfolio).find`. Endpoints that go through `Session` are scoped correctly. | An assessor at company A can download, rescore and run fit/gap on company B's candidates (cross-tenant personal data leak plus integrity loss). | verified: tenant A token on tenant B ids: JSON export 200, override to L5 201, fit/gap generate 202 then 200; `/sessions/3/portfolio` 404 (control). PDF export 500 because `portfolio.session` is nil under tenant A. |
| F2 | P0 | missing spec + defective impl | api -> web | Coverage state never gates a rating. The generator asks the model to rate every coverage-map skill, then stores `level.to_i.clamp(1,5)`, so missing levels become L1. Fit/gap treats a stored L1 as a measured L1. | Candidates are scored and described as weak on skills nobody asked them about; that text reaches the hiring recommendation. | verified: session 2 all 4 skills L1 with summaries "No evidence was gathered"; fit/gap "Gap -1" x4 and a negative narrative. Session 1 Communication (not_yet, 0 probes, 0 quotes) L1, "Gap", and the narrative says "async communication skills are currently below expectations". `level: nil` stored as 1 (injected). |
| F3 | P1 | defective impl (seam) | api <-> web | Fit/gap contract drift. API sends `expected_level`, `confidence`; web reads `required_level`, `is_override`. The engine computes `overridden` but never serializes it. Summary row ignores `not_assessed`. | Assessors compare a candidate against a requirement they cannot see, and cannot tell human-corrected rows from AI rows. | verified: payload has `expected_level` on every row; "Required" column blank on every row; ✏ marker impossible. |
| F4 | P1 | defective impl | api -> web | Confidence is the model's own label, not computed from coverage state and probe count as the PRD defines. Fit/gap ignores confidence entirely. | A one-question skill shows as a plain "Match" or "Gap" with the same weight as a well-probed one. | verified (seam): Testing (1 probe, `low`) shown as plain "Match". code: confidence taken from model output. In this run the model's labels happened to match the PRD rule, so a wrong label was not observed. |
| F5 | P1 | defective impl | api | `save_skills` runs `destroy_all` then `create!` per skill with no transaction. One invalid field fails the whole portfolio after deleting the old skills, and `destroy_all` also deletes assessor overrides. | One capitalised word from the model wipes the assessor's corrections and leaves a half-written portfolio. | verified (injected client, rolled back): 5 skills + 1 override -> 1 skill + 0 overrides, status failed, `"Validation failed: Ai confidence is not included in the list"`. |
| F6 | P1 | defective impl + missing spec | api + web | Job lifecycle. (a) During Sidekiq retries the portfolio is `failed`, so the UI Retry button enqueues a second job. (b) `generating`/`pending` that never finishes has no timeout; the UI spins "about 2 minutes" forever and the API refuses regenerate (422). (c) Each failed run is retried by Faraday (3) and Sidekiq (3). | Duplicate model spend and racing writes; a stuck candidate result needs a developer to fix. | verified: two `PortfolioGeneratorWorker [1]` jobs in the retry set after one Retry click. verified (sim): forced `generating`: spinner forever, regenerate 422. |
| F7 | P1 | defective impl | web + api | Fit/gap page calls `POST /fitgap` on every 404 while polling every 5 s; the endpoint enqueues without checking for a running job. | Every report view costs at least two model calls, and the narrative changes under the reader. | verified: one page view -> 2 POSTs, 2 jobs, "report generated" logged twice; the text on screen differed from the stored text afterwards. |
| N1 | P1 | defective impl | api | No `filter_parameter_logging` initializer. Request params are logged at `info` (the production default). | Login passwords, candidate names and assessor notes land in production logs in plain text (UU PDP: personal data in logs). | verified (dev log): `"password"=>` followed by the plain-text value that was typed on `POST /auth/login`; assessor notes on override. Production: code (log level `info`, no filter). |
| F10 | P1 | defective impl | api + web | PDF uses Prawn built-in fonts (Windows-1252 only). The override line always contains `→`, so any portfolio with an override fails to export. The UI has no catch: unhandled promise rejection, nothing on screen. | Exactly the portfolios an assessor reviewed and corrected cannot be sent to the hiring manager, silently. | verified: portfolio with override PDF 500 "not compatible with the Windows-1252 character set"; without override 200; UI shows nothing, console `Uncaught (in promise) AxiosError`. |
| N2 | P1 | defective impl (config) | api | Model ids shipped in `application.yml.sample` (`gemini-2.0-pro-001`, `gemini-2.0-flash-001`) and the README (`gemini-2.5-pro`) return 404 on a new key. The stored error is only "API returned 404"; the real reason ("model no longer available, use ...") is only in the log. | Out of the box every portfolio fails, and the assessor sees "Portfolio generation failed." with no reason. | verified: `generateContent` 404 for all three; portfolio `generation_error` "API returned 404". |
| N3 | P1 | defective impl (conditional) | api | Tenant is taken from the JWT `scheme` claim (read without verification, though the same token is verified later), else from `X-Tenant-Scheme`, else from the Referer host. A validly signed token without `scheme` can therefore pick any tenant. | If rakamin-api ever issues a token without `scheme`, its holder can act inside any tenant. | verified locally: scheme-less token + header or Referer `other-corp` -> 200 with tenant B data; a token with `scheme` cannot be redirected. Whether such tokens exist is unknown (constraint signal). |
| F9 | P1 | missing spec + defective impl | product + api | No consent notice, retention rule or deletion path for candidate audio and transcripts sent to a third-party model (missing spec). The "culture" and "overall" narratives are generated from skill counts only, although PRD-02 Phase 5 specifies "vacancy culture_dimensions + portfolio competency summaries" as the input (defective impl). | Candidates are profiled by an automated system they cannot see or contest; a narrative states culture fit with no evidence. | code + verified (narrative): culture narrative claims a "gap in clear async communication" that was never measured. Legal articles to be checked against the UU PDP text before citing. |
| F8 | P2 | defective impl | api + web | Override deletes the fit/gap report, then regenerates asynchronously (new id). The engine falls back to a count-only narrative on model errors, so the report is lost only if the job itself never runs. No audit trail in the UI (notes, who, when are not shown). | The report disappears for several seconds after each override; reviewers cannot see why a rating changed. | verified: report id 1 deleted, id 5 created ~7 s later; card shows only "AI L1 → L2 You Overridden ✓". |
| F11 | P2 | defective impl | web | Error and partial states: failed portfolio hides `generation_error`, still shows PDF/JSON buttons (export then 422); fetch errors are swallowed; fit/gap shows `culture_narrative \|\| overall_narrative`, so the hiring recommendation is never shown (but is in the JSON export). | Assessors cannot tell what went wrong or see the exact text being exported about the candidate. | verified (screenshots B01, B03). |
| F12 | P2 | defective impl (UI) | web | Mobile: page header buttons overflow and the page scrolls sideways (550 px content on a 375 px viewport); on fit/gap the Result column is off-screen. Override panel opens inside the card header row. Copy "You Overridden ✓". Discovered skills on fit/gap print `2` instead of `L2` (code). | The key column of the report is unreadable on a phone; the product looks unfinished. | verified (B05, B06, B07); `L2` label: code. |
| N4 | P3 | defective impl | api | The generator prompt's example uses `"sk-eng-001"`; one run returned lowercase ids, the other uppercase. Fit/gap matches `skill_id` case-sensitively, then falls back to the label. | Matching silently depends on the model copying labels exactly. | verified: portfolio 2 stored `sk-eng-001`; no wrong match observed thanks to the label fallback. |

Setup defects S1 to S7 are listed in `01-setup-notes.md`.

## Missing specification vs defective implementation

- **Missing specification** (never defined anywhere): what a skill without evidence is called
  and how it counts in fit/gap (F2); recovery and timeouts for stuck generation (F6b); consent,
  retention, deletion and the candidate's right to see or contest an automated result (F9);
  where "culture fit" evidence comes from (F9); how an override is audited (F8).
- **Defective implementation** (defined, but broken): tenant isolation (F1, N3), the PRD's
  confidence rule (F4), the fit/gap contract (F3), atomic regeneration (F5), single job per
  request (F6a, F7), PDF export (F10), parameter logging (N1), shipped model ids (N2).

## Constraint signal (would escalate to the Tech Lead)

1. **Token contract with rakamin-api.** Does every token carry `scheme`? If not, N3 is a P0.
   Should this service verify that the user belongs to the tenant, instead of trusting claims?
2. **Model ids and API version.** The client hardcodes `v1`; current Pro models are not
   available on `v1` for new keys. Which models are contracted for production, on which API
   version, and who owns updating them?
3. **UU PDP.** Lawful basis, consent text, retention period and deletion for audio, transcripts
   and generated profiles; whether automated hiring recommendations need human review by policy.
4. **No test harness, no CI.** Nothing guards any of the above from regressing.
5. **Tenant scoping by default scope.** Isolation relies on remembering `include TenantScoped`
   on every model. Child tables have no `tenant_id`, so there is no second line of defence.
6. **Local macOS dev needs `WEB_CONCURRENCY=0`** (S1), which skips `on_worker_boot`; the live
   audio path was not exercised locally.
