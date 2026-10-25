# Backend Architecture & Code Structure Document
## AI Interview Platform API (Ruby on Rails 7 + PostgreSQL + Sidekiq + Gemini AI)

---

## 1. High-Level Architecture & System Design

The backend service is a high-performance **Ruby on Rails 7 (API mode)** application designed for multi-tenant candidate evaluation, real-time audio WebSocket coordination, asynchronous LLM processing via Sidekiq, and deterministic Fit/Gap analysis.

```mermaid
graph TD
    subgraph ClientLayer [Client & Web Layer]
        ReactWeb[React 18 SPA]
        WebSocketClient[Audio Streaming Worklet]
    end

    subgraph APILayer [Rails 7 API & Routing]
        AuthMiddleware[JWT Auth & Tenant Scoping]
        PortfoliosController[Portfolios Controller]
        PortfolioSkillsController[Portfolio Skills Controller]
        SessionsController[Sessions Controller]
        VacanciesController[Vacancies Controller]
        WSChannel[Live Audio Channel]
    end

    subgraph ServiceLayer [Business Logic & Engines]
        FitGapEngine[FitGap::Engine]
        PortfolioGenerator[Portfolios::Generator]
        PdfGenerator[Exports::PdfGenerator]
        GeminiClient[Gemini::HttpClient]
    end

    subgraph AsyncLayer [Sidekiq Background Workers]
        SidekiqRedis[(Redis Queue)]
        FitGapWorker[FitGapGeneratorWorker]
        PortfolioWorker[PortfolioGeneratorWorker]
    end

    subgraph DataLayer [PostgreSQL Relational DB]
        Postgres[(PostgreSQL 14+)]
    end

    ReactWeb --> AuthMiddleware
    AuthMiddleware --> PortfoliosController
    AuthMiddleware --> PortfolioSkillsController
    AuthMiddleware --> SessionsController
    WebSocketClient --> WSChannel

    PortfoliosController --> FitGapEngine
    PortfoliosController --> PdfGenerator
    PortfolioSkillsController --> FitGapWorker
    SessionsController --> PortfolioWorker

    PortfolioWorker --> PortfolioGenerator
    FitGapWorker --> FitGapEngine

    PortfolioGenerator --> GeminiClient
    FitGapEngine --> GeminiClient

    FitGapEngine --> Postgres
    PortfolioGenerator --> Postgres
    PortfoliosController --> Postgres
```

---

## 2. Directory & Module Structure (`api/`)

```
api/
├── .env.example                       # Documented environment template with security guidelines
├── app/
│   ├── channels/
│   │   └── audio_websocket_middleware.rb # Raw Rack WebSocket hijacking & live stream router
│   ├── clients/
│   │   └── gemini/
│   │       ├── http_client.rb         # Faraday HTTP client for Gemini REST API (v1beta + fallback chain)
│   │       ├── live_client.rb         # Real-time WebSocket bridge for Gemini Live audio
│   │       └── mock_live_client.rb    # Interactive development audio simulator with RMS VAD
│   ├── controllers/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── api_controller.rb              # Base API controller (Auth, Tenant, Responses)
│   │   │       ├── assessments_controller.rb       # Assessment template management
│   │   │       ├── authentication_controller.rb    # Login & JWT token issuance
│   │   │       ├── portfolio_skills_controller.rb  # Assessor override actions & cache sync
│   │   │       ├── portfolios_controller.rb        # Portfolio show, regenerate, fitgap & export
│   │   │       ├── sessions_controller.rb          # Session lifecycle & candidate endpoints
│   │   │       ├── skill_taxonomies_controller.rb  # Reference skill taxonomies
│   │   │       └── vacancies_controller.rb         # Job vacancy & skill requirement CRUD
│   │   └── application_controller.rb
│   ├── models/
│   │   ├── application_record.rb      # Base Active Record model
│   │   ├── assessment.rb              # Assessment template definition
│   │   ├── assessment_skill.rb        # Target skill with L1-L5 behavioral anchors
│   │   ├── assessor_override.rb       # Human assessor score adjustment & audit notes
│   │   ├── coverage_map.rb            # Real-time skill probing coverage state
│   │   ├── fit_gap_report.rb          # Calculated vacancy comparison & AI narratives
│   │   ├── portfolio.rb               # Generated candidate skill portfolio header
│   │   ├── portfolio_skill.rb         # Evaluated skill with AI level, confidence & quotes
│   │   ├── session.rb                 # Interview instance and status state machine
│   │   ├── transcript_turn.rb         # Speech turn text and audio timestamps
│   │   ├── user.rb                    # Assessor and admin accounts
│   │   ├── vacancy.rb                 # Job opening with culture & competency expectations
│   │   └── vacancy_skill.rb           # Required skill level for a vacancy
│   ├── services/
│   │   ├── exports/
│   │   │   └── pdf_generator.rb       # Prawn PDF generation engine with UTF-8 sanitization
│   │   ├── fit_gap/
│   │   │   └── engine.rb              # Core rule-based matching + narrative generator
│   │   ├── portfolios/
│   │   │   └── generator.rb           # LLM transcript evaluation & quote extraction
│   │   └── sessions/
│   │       └── end_handler.rb         # Session finalization and background job dispatcher
│   └── workers/
│       ├── coverage_analyzer_worker.rb
│       ├── fit_gap_generator_worker.rb     # Async fit/gap report generator (Current.using)
│       └── portfolio_generator_worker.rb   # Async portfolio evaluation worker
├── config/
│   ├── initializers/
│   │   ├── cors.rb                    # Cross-Origin Resource Sharing
│   │   ├── filter_parameter_logging.rb# Indonesian UU PDP candidate PII log filter
│   │   ├── gemini.rb                  # Gemini boot-time environment validation
│   │   ├── rack_attack.rb             # Rate limiting & memory store fallback
│   │   └── sidekiq.rb                 # Redis connection configuration
│   ├── application.yml.sample         # Figaro environment configuration
│   ├── database.yml                   # PostgreSQL database configuration
│   ├── routes.rb                      # RESTful route definitions
│   └── sidekiq.yml                    # Sidekiq worker concurrency & queues
├── db/
│   ├── migrate/                       # Active Record database migrations
│   │   └── 20260815000001_add_assessment_state_and_narrative_status.rb
│   ├── schema.rb                      # PostgreSQL schema definition with custom enums
│   └── seeds.rb                       # Development and staging seed data
└── spec/                              # RSpec Automated Test Suite (41 passing examples)
    ├── factories/                     # FactoryBot fixture definitions
    ├── lib/                           # Library specs (JsonWebToken fail-fast)
    ├── models/                        # Model unit tests
    ├── requests/                      # Request & controller integration tests
    ├── services/                      # Service & engine unit tests
    ├── workers/                       # Sidekiq worker tenancy isolation specs
    ├── rails_helper.rb                # Rails RSpec environment configuration
    └── spec_helper.rb                 # RSpec general configuration
```

---

## 3. Relational Schema & Entity-Relationship Model

```mermaid
erDiagram
    ASSESSMENTS ||--o{ ASSESSMENT_SKILLS : contains
    ASSESSMENTS ||--o{ SESSIONS : generates
    SESSIONS ||--o{ COVERAGE_MAPS : tracks
    SESSIONS ||--o{ TRANSCRIPT_TURNS : records
    SESSIONS ||--o| PORTFOLIOS : produces
    PORTFOLIOS ||--o{ PORTFOLIO_SKILLS : evaluates
    PORTFOLIO_SKILLS ||--o| ASSESSOR_OVERRIDES : audited_by
    VACANCIES ||--o{ VACANCY_SKILLS : requires
    PORTFOLIOS ||--o{ FIT_GAP_REPORTS : compared_against
    VACANCIES ||--o{ FIT_GAP_REPORTS : evaluated_for

    PORTFOLIOS {
        bigint id PK
        bigint session_id FK
        enum generation_status
        enum assessment_state
        timestamp created_at
        timestamp updated_at
    }

    PORTFOLIO_SKILLS {
        bigint id PK
        bigint portfolio_id FK
        string skill_label
        integer ai_level
        enum ai_confidence
        jsonb evidence
        text competency_summary
    }

    ASSESSOR_OVERRIDES {
        bigint id PK
        bigint portfolio_skill_id FK
        integer ai_level
        integer override_level
        text assessor_notes
        bigint overridden_by
        timestamp overridden_at
    }

    FIT_GAP_REPORTS {
        bigint id PK
        bigint portfolio_id FK
        bigint vacancy_id FK
        enum narrative_status
        jsonb skill_comparisons
        text culture_narrative
        text overall_narrative
        timestamp generated_at
    }
```

### Key PostgreSQL Custom Enums & Constraints
* **`confidence_level`**: `high`, `medium`, `low`
* **`fit_result`**: `match`, `gap`, `exceed`, `not_assessed`
* **`generation_status`**: `pending`, `generating`, `complete`, `failed`
* **`session_status`**: `pending`, `active`, `ended`, `failed`
* **`portfolio_assessment_state`**: `draft`, `submitted`, `reviewed`
* **`fit_gap_narrative_status`**: `pending`, `synthesizing`, `complete`, `fallback`
* **Level Constraints**: Database check constraints ensure `expected_level`, `ai_level`, and `override_level` are strictly between $1$ and $5$.

---

## 4. Core Business Engines & Service Logic

### 4.1 `FitGap::Engine` (`app/services/fit_gap/engine.rb`)
The `FitGap::Engine` bridges candidate competency with role requirements through a 2-stage evaluation:

1. **Deterministic Rule-Based Level Comparison**:
   * Resolves effective skill levels by checking for `AssessorOverride` first; falls back to `ai_level`.
   * Maps vacancy skills to candidate skills by `skill_id` (primary) or case-insensitive `skill_label` (secondary).
   * Computes $\Delta = \text{effective\_level} - \text{expected\_level}$:
     $$\text{Result} = \begin{cases} \text{match} & \text{if } \Delta = 0 \\ \text{exceed} & \text{if } \Delta > 0 \\ \text{gap} & \text{if } \Delta < 0 \\ \text{not\_assessed} & \text{if candidate skill is absent} \end{cases}$$
2. **LLM-Synthesized Narrative Generation**:
   * Formulates structured prompt to Gemini Flash summarizing matches, exceeds, gaps, and unassessed skills against vacancy culture dimensions.
   * Extracts `culture_narrative` and `overall_narrative`.
   * **Designed Failure Path**: If Gemini call times out or throws an error, generates a deterministic mathematical fallback narrative without crashing.

### 4.2 Multi-Entity Cache Invalidation & Eventual Consistency
* **Assessor Overrides**: When an override is submitted via `PortfolioSkillsController#override`, it:
  1. Preserves the immutable `ai_level` for UU PDP auditing while updating `override_level`.
  2. Invalidates dependent `FitGapReport` rows and enqueues `FitGapGeneratorWorker.perform_async` (with safe in-memory fallback if Redis is offline).
* **Vacancy Rubric Changes**: When recruiters update role requirements via `VacanciesController#update`, all associated `FitGapReport` snapshots are immediately destroyed (`@vacancy.fit_gap_reports.destroy_all`), triggering read-through re-synthesis on subsequent views.
* **Portfolio Cascades**: `Portfolio` declares `has_many :fit_gap_reports, dependent: :destroy` to guarantee zero orphaned comparisons.

### 4.3 Live Audio Streaming & Multimodal Turn Detection
* **`AudioWebSocketMiddleware` (`app/channels/audio_websocket_middleware.rb`)**:
  - Hijacks raw Rack WebSocket connections for binary 16kHz PCM audio streaming.
  - Automatically hot-swaps to interactive `Gemini::MockLiveClient` on quota limits or code 1008 rejection, preventing candidate session disconnects.
  - Receives `ai_speech_finished` and `candidate_audio_done` control signals to coordinate speaker turns and eliminate echo loops.
* **`MockLiveClient` (`app/clients/gemini/mock_live_client.rb`)**:
  - Implements an asynchronous 1.7s silence timer that resets on voiced frames (Int16 RMS $\ge 160$).
  - Wraps buffered candidate PCM frames in standard 44-byte WAV headers and calls `Gemini::HttpClient#generate_content_with_audio`.
  - Performs multimodal transcription via Gemini `v1beta` with automatic 404 model fallback (`gemini-2.5-flash` → `gemini-3-flash-preview` → `gemini-flash-latest`).

### 4.4 Competency Portfolio Synthesis & Fallback Guardrails
* **`Portfolios::Generator` (`app/services/portfolios/generator.rb`)**:
  - Synthesizes candidate skills from transcript turns with verbatim quote evidence.
  - Wraps skill destruction and recreation inside `ActiveRecord::Base.transaction` to prevent partial state corruption.
  - Implements substance-aware rubric evaluation: low-effort or gibberish answers (`total_words < 15`) receive Level 2 baseline with Low Confidence, preventing unearned high ratings.
  - Includes inline thread background execution in `Sessions::EndHandler` when Redis is unreachable in development.

---

## 5. Security, Multi-Tenancy & Indonesian UU PDP Compliance

1. **Data Minimization & Safe Logging**:
   * Sensitive attributes (`candidate_name`, `email`, `invite_token`, `passw`, `secret`, `token`, `_key`, `crypt`, `salt`) are filtered in `config/initializers/filter_parameter_logging.rb`.
   * Background worker arguments pass only database IDs (`portfolio.id`, `vacancy.id`), never raw payload blobs or candidate PII.
2. **Fail-Fast JWT Cryptographic Verification**:
   * `JsonWebToken.hmac_secret` strictly requires a configured, non-blank `ENV.fetch('SECRET_KEY_BASE')` and raises `KeyError` on missing or whitespace values. **Zero hardcoded fallback secrets** exist, eliminating the risk of token forgery (`HS256`).
3. **End-to-End Multi-Tenant Isolation (`TenantScoped`)**:
   * All tenant-owned queries enforce `Current.tenant_id` via `TenantScoped` (`Vacancy.find_by`, `Session.find`, `Assessment.find`), with `Portfolio.joins(:session)` and `PortfolioSkill.joins(portfolio: :session)` enforcing tenant boundaries across child associations.
   * `Vacancy.unscoped` has been **completely eliminated** from all controllers and workers.
   * Asynchronous Sidekiq jobs (`FitGapGeneratorWorker`) explicitly bind tenant context via `Current.using(tenant_id: session.tenant_id)` before querying `Vacancy`, guaranteeing background jobs strictly respect tenant boundaries.
4. **Role-Based API Authorization**:
   * Assessor endpoints are protected with `authorize_auth_token! :assessor`.
   * Candidate endpoints (`/sessions/:token/candidate`, `/sessions/:token/audio_complete`) are strictly scoped by one-time unguessable `invite_token`.

---

## 6. Backend Testing Strategy (`api/spec/`)

The backend test harness uses **RSpec 6**, **FactoryBot**, and **DatabaseCleaner**: **41 examples, 0 failures** (`0.78s`).

* **Security & Auth Specs (`spec/lib/json_web_token_spec.rb`)**: Verifies HMAC-SHA256 encoding/decoding, expiration claims, signature tampering rejection, and fail-fast `KeyError` when `SECRET_KEY_BASE` is unset or blank.
* **Worker & Multi-Tenancy Specs (`spec/workers/fit_gap_generator_worker_spec.rb`)**: Verifies report generation within tenant bounds and raises `ActiveRecord::RecordNotFound` when attempting to access a cross-tenant vacancy.
* **Unit Specs**: Models (`PortfolioSkill`, `AssessorOverride`, `FitGapReport`) validating numericality, relations, enums, and cascades.
* **Service Specs (`spec/services/fit_gap/engine_spec.rb`)**: `FitGap::Engine` testing all 4 comparison results (`match`, `exceed`, `gap`, `not_assessed`), override precedence, unassessed skill safety, and deterministic fallback narratives.
* **Request Specs (`spec/requests/api/v1/`)**: `PortfoliosController` and `PortfolioSkillsController` verifying JSON payloads, 404/422 responses, Prawn PDF exports, and strict multi-tenant isolation across vacancies and portfolios.
* **Seeded Fault Validation**: Proves test failure on intentional logic inversion.
