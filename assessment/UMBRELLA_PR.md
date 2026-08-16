# Draft body for the umbrella PR to `rakamindev:main`

Head: `husenEF:feat/trustworthy-assessment` · Base: `rakamindev:main`

Title: **Stop the platform producing ratings it cannot defend**

---

An AI interview platform exists to produce one thing: a rating a human being can defend in a hiring conversation. This one produced ratings it could not defend, in three independent ways, and showed them to recruiters with no mark to distinguish them from real ones.

```ruby
skill_data['level'].to_i.clamp(1, 5)
```

`nil.to_i` is `0`. `0.clamp(1, 5)` is `1`. The expression reads like defensive input validation. It is a rating generator.

| The model returned | It was stored as |
|---|---|
| `null`, `"abc"`, a missing key, `0` | **Level 1** — the bottom of the scale |
| `99` | **Level 5** |
| a skill the interview never probed | **Level 2** |

None of these were visible as errors. They rendered as ordinary badges next to genuine assessments, and a recruiter had no way to tell them apart.

Separately, any assessor with valid credentials could read every other organisation's candidates by adding one header to their login request.

## The four changes

**[Dev harness](https://github.com/husenEF/ai-interview-platform/pull/4)** — RSpec had no specs, `web` had no test runner, and there was no CI. None of what follows would have been provable without building that first. Includes a Docker Compose stack and a spec file that guards the harness's own assumptions.

**[Tenant isolation](https://github.com/husenEF/ai-interview-platform/pull/5)** — `GET /portfolios/:id/export` returned 200 across tenants, `POST /portfolio_skills/:id/override` returned 201 — a cross-tenant *write*, and `POST /portfolios/:id/fitgap` returned 202. All three now 404.

**[Rating integrity](https://github.com/husenEF/ai-interview-platform/pull/6)** — `portfolio_skills.ai_level` was `NOT NULL` with a `1..5` check, so the schema had no value meaning "no rating". Every fabrication downstream follows from that. `ai_level` becomes nullable, `not_assessed_reason` records which of three things happened, and a check constraint makes a row that claims both or neither impossible to store regardless of which code path writes it.

**[Portfolio states](https://github.com/husenEF/ai-interview-platform/pull/7)** — the frontend carried its own independent copy of the same bug (`isNaN(n) ? 1 : n`), so fixing the API alone would have left the fabricated Level 1 on screen — and crashed the page, since `parseLevel(null)` throws. "Not assessed" is now a distinct visual state with its reason in plain language, coverage is stated up front (*"3 of 7 skills were not assessed"*), and every interaction state the page was missing — empty, partial, generation error, 375px — is handled.

**[User tenancy](https://github.com/husenEF/ai-interview-platform/pull/8)** — login minted the JWT's tenant claim from the caller's own `X-Tenant-Scheme` header, so an assessor could be issued a correctly signed token for any organisation they named. The underlying cause is that `users` had no organisation column: the controller had nothing to answer the question with and asked the client instead.

## Verification

66 RSpec examples, 48 Vitest tests, `tsc` clean — from zero on all three.

Every fix was written as a failing test first. To show that is not just a claim, [`spike/seeded-fault`](https://github.com/husenEF/ai-interview-platform/tree/spike/seeded-fault) puts the original defect back, both halves verbatim, and is kept red on purpose: **14 RSpec failures and 19 Vitest failures**, plus the two uncaught exceptions that show what would have shipped had the API change merged without the frontend one.

## What I deliberately did not fix

`TenantScoped` fails open outside a request — `RequestStore` is empty in a Sidekiq worker, so every tenant-scoped model returns all rows across all organisations inside every background job.

Making it fail closed is one line, and it would turn every worker, rake task, and seed script into a silent no-op. The exposed surface today is HTTP, and it is closed. The full write-up is in the report.

---

Full reasoning, severity-ranked findings, trade-off matrices, acceptance criteria, screenshots of every state, and the AI verification moment: **`assessment/REPORT.md`** in this PR.
