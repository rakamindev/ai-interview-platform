# 02 — Architecture

**Provenance: `[CODE]`.**

---

## 1. System Map

```
                    +-------------------+
                    |   PostgreSQL 18   |
                    | (ai_interview     |
                    |  schema + public) |
                    +--------+----------+
                             |
              +--------------+--------------+
              |                             |
    +---------v----------+     +-----------v-----------+
    |   Ruby 3.3.2 API   |     |     Sidekiq worker    |
    |   (Rails 7 + Puma  |     |  (same image, same    |
    |    + EventMachine)  |     |   codebase)           |
    |   Port 3001         |     |                       |
    +--------+------------+     +-----------+-----------+
              |                             |
              |  +----------+               |
              +--| Redis 8  |---------------+
                 | (queue +  |
                 |  cache)   |
                 +----------+
              |
    +---------v----------+
    |  Gemini API         |
    |  - Flash (coverage  |
    |    analysis)        |
    |  - Pro (portfolio   |
    |    generation)      |
    |  - Live (interview  |
    |    WebSocket)       |
    +--------------------+
              |
    +---------v----------+
    |  React 18 + Vite   |
    |  (Port 5173)       |
    |  TypeScript + Zod   |
    |  ParaglideJS i18n   |
    +--------------------+
```

### Services

| Service | Technology | Purpose |
|---------|-----------|---------|
| API | Rails 7.0, Puma, EventMachine WebSocket | REST + real-time interview |
| Sidekiq | Redis-backed job queue | Portfolio generation, coverage analysis |
| PostgreSQL 18 | Multi-schema (ai_interview + public) | Data store |
| Redis 8 | Job queue, Rack::Attack throttle | Background processing |
| Gemini API | Flash, Pro, Live models | AI analysis and interview |
| Web | React 18, Vite, TypeScript | Frontend SPA |

### Data Model (key entities)

```
Organization (public schema, read-only mirror of rakamin-api)
  |
  +-- User (has_many :memberships)
  |     +-- Membership (user_id + organization_id + role)
  |
  +-- Assessment (tenant-scoped)
  |     +-- AssessmentSkill (L1-L5 anchors)
  |
  +-- Vacancy (tenant-scoped)
  |     +-- VacancySkill (expected_level per skill)
  |
  +-- Session (tenant-scoped)
  |     +-- TranscriptTurn (speaker + text)
  |     +-- CoverageMap (state machine: not_yet -> initiated -> partial -> covered)
  |     +-- Portfolio
  |           +-- PortfolioSkill (ai_level, ai_confidence, rating_state, ai_presence)
  |                 +-- AssessorOverride (override_level, assessor_notes)
  |                 +-- PortfolioSkillGenerationEvent (audit trail)
  |
  +-- FitGapReport (skill_comparisons JSONB, culture_narrative, overall_narrative)
```

---

## 2. Request Lifecycle

1. Candidate opens invite URL → WebSocket connection authenticated via JWT
2. AI interviewer conducts structured interview (Gemini Live)
3. After each candidate turn: `Coverage::Analyzer` runs (Gemini Flash, async via Sidekiq)
4. Interview ends → `Portfolios::Generator` runs (Gemini Pro, Sidekiq)
5. Assessor reviews portfolio, may create `AssessorOverride` per skill
6. `FitGap::Engine` compares portfolio against vacancy, produces `FitGapReport`
7. Hiring manager views fit/gap report, exports PDF

---

## 3. Tenant Isolation

Every model with a `tenant_id` column includes `TenantScoped` (`api/app/models/concerns/tenant_scoped.rb:1-37`):

- `default_scope` filters by `Current.tenant_id` when `RequestStore` has a tenant
- `before_validation` sets `tenant_id` on create
- `validates :tenant_id, presence: true`

The tenant is resolved from the JWT `scheme` claim via `TenantResolverMiddleware`, which looks up `Organization.identify(scheme)` (`organization.rb:17-26`). If not found, the request is rejected with 404 (fail-closed, P0-4 fix).

---

## 4. AI Client Architecture

`Gemini::ClientFactory` (`api/app/clients/gemini/client_factory.rb:9-16`):

```ruby
def self.build(model:, timeout: 60)
  if ENV["GEMINI_STUB"] == "true"
    StubClient.new(model: model, timeout: timeout)
  else
    HttpClient.new(model: model, timeout: timeout)
  end
end
```

Three models used:
- **Gemini Flash** — coverage analysis (`Coverage::Analyzer`), fit/gap narratives
- **Gemini Pro** — portfolio generation (`Portfolios::Generator`)
- **Gemini Live** — real-time interview WebSocket

---

## 5. WebSocket Architecture

Two middleware layers:

- `AudioWebsocketMiddleware` — streams audio to/from Gemini Live for the interview
- `CoverageWebsocketMiddleware` — triggers coverage analysis after candidate turns

The WebSocket is the most complex code in the repo: 803 lines in `audio_websocket_middleware.rb`. It remains untested (P0-16).

---

## 6. The Computation Seam — Where It Breaks

The hand-off from computation to presentation is where four distinct failure types concentrate. All four are in the path from `FitGap::Engine` output to `ComparisonTable` rendering.

### Finding 9: Key Mismatch (P0)

`FitGap::Engine` stores `skill_label` in the comparison payload (`engine.rb:62`). `ComparisonTable.tsx` reads `c.expected_level` (`ComparisonTable.tsx:99`). The backend emits `expected_level`; the frontend reads it — but the field name in the JSONB payload is `expected_level` and it works. The **actual** mismatch: the frontend type `SkillComparison` in `types/index.ts:132` *declares* the field rather than validating the payload. The type system was asserting a contract nobody checked.

### Finding 10: Dropped Field (P0)

`FitGap::Engine` computes `confidence` per comparison (`engine.rb:112`). The frontend receives it but `ConfidenceIndicator.tsx` reads `confidence` directly — if absent, `getLabel(undefined)` renders "Confidence: LOW" in red. An absent confidence looks identical to explicit low confidence.

### Finding 11: Unused Field (P0)

`FitGap::Engine` computes `is_override` (`engine.rb:99`). The frontend `ComparisonTable.tsx:105` uses it to show override provenance — but only if `is_override` is present in the payload. The field is always present, but the UI treats `false` the same as absent.

### Finding 27: Dropped Collection (P0)

`FitGap::Engine` computes `additional_strengths` (`engine.rb:138-157`) — portfolio skills not in the vacancy. These are stored in `fit_gap_reports.additional_strengths` (added in migration `20260821000001`). The frontend does not render this collection at all.

### Diagram

```
FitGap::Engine                    ComparisonTable.tsx
+------------------+              +------------------+
| skill_label      |              | c.skill_label    |  <- works
| expected_level   |              | c.required_level |  <- KEY MISMATCH (P0-9)
| candidate_level  |              | c.candidate_level|  <- works
| confidence       |              | c.confidence     |  <- unused if nil (P0-10)
| is_override      |              | c.is_override    |  <- treated same as nil (P0-11)
| delta            |              | c.delta          |  <- works
| result           |              | c.result         |  <- works
+------------------+              +------------------+
        |                                  |
        v                                  v
  additional_strengths              [NOT RENDERED] (P0-27)
```

### The Core Problem

Five mechanisms fail downstream of the interview, and every one fails **against the candidate**:

| Mechanism | Behaviour today | Location |
|-----------|----------------|----------|
| Model omits a level | `nil.to_i.clamp(1,5)` recorded as **L1** | `generator.rb:161,173` (original) |
| Confidence absent | `getLabel(undefined)` renders red **"Confidence: LOW"** | `ConfidenceIndicator.tsx:5-10` |
| Confidence is `low` | ignored — one probe still yields a hard **"Gap -2"** | `engine.rb:50` (original) |
| Assessor overrides | provenance computed, then **discarded** | `engine.rb:83` vs `:58-66` (original) |
| Required level | key mismatch renders column **empty** | `engine.rb:63` / `ComparisonTable.tsx:50` (original) |

A system that silently converts *absence of evidence* into *evidence of absence* is not merely buggy. It is unfair in one direction, and unfair most often to candidates who had the shortest interviews.
