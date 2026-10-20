# Agent & Engineering Guidelines (`agents.md`)

This document defines the strict engineering standards, conventions, git workflows, architectural patterns, and contribution policies for all developers and AI agents working on the `ai-interview-platform` codebase.

---

## 1. Code Quality & Commenting Conventions

### 1.1 Commenting Policy
Writing clean, self-documenting code is mandatory. Comments should explain **why** something is done, not **what** the code does.

#### ❌ Prohibited Comments (Do NOT use):
- **Banners, Dividers, & Visual Separators**:
  ```ruby
  # ----------------------------------------------------
  # ==================== CONSTANTS =====================
  # ----------------------------------------------------
  ```
  ```typescript
  // ==========================================
  // Component Implementation
  // ==========================================
  ```
- **Emojis in Code or Comments**:
  ```typescript
  // 🚀 Start of audio streaming handler
  // 🔥 Bug fix for nil crash
  // ✨ Helper function
  ```
- **Trivial, Obvious, or Low-Value Inline Comments**:
  ```ruby
  # increment count by 1
  count += 1

  # constructor
  def initialize; end

  # return session
  return session
  ```
  ```typescript
  // start of function
  const handleClick = () => { ... }
  // end of class
  ```
- **Dead/Commented-Out Code**: Remove obsolete code completely; rely on Git history instead of leaving commented blocks.

#### ✅ Mandatory & Encouraged Comments (DO use):
- **Architectural & Design Decisions (The "Why")**:
  Explain non-obvious engineering choices, race condition protections, or system invariants.
  ```ruby
  # We acquire a 10-second distributed Redis lease to prevent concurrent audio turn
  # processing across multiple browser tabs or delayed chunk arrival.
  ```
- **Edge Cases & Failure Modes**:
  Document defensive guards or unexpected external API behaviors (e.g., Gemini Live API quirks).
  ```typescript
  // Web Audio Context on Chromium requires an explicit resume() call after user
  // gesture to prevent silent audio buffer playback dropouts.
  ```
- **Domain & Legal Context**:
  Reference specific compliance or domain rules when applicable (e.g., UU PDP Article 16).
  ```ruby
  # Scrub candidate contact numbers and emails prior to logging to adhere to
  # UU PDP Article 16/20 data minimization standards.
  ```
- **Concise Docstrings / YARD / JSDoc**:
  Use concise standard type annotations for complex helper methods or mathematical engines.

---

### 1.2 Naming Conventions
- **Intention-Revealing & Domain-Aligned**:
  Variable, function, and class names must clearly communicate their purpose without ambiguity. Avoid arbitrary abbreviations (e.g., use `candidate_portfolio` instead of `cp` or `cand_port`).
- **Boolean Naming**:
  Prefix booleans with auxiliary verbs: `is_assessed`, `has_completed`, `can_retry`, `should_terminate`.
- **Backend (Ruby / Rails)**:
  - Methods & variables: `snake_case` (e.g., `calculate_fit_gap_score`)
  - Classes & Modules: `PascalCase` (e.g., `FitGap::Engine`)
  - Constants: `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`)
  - Predicate methods: end with `?` (e.g., `unassessed?`, `active?`)
  - Bang methods: end with `!` only when altering state dangerously or raising errors on failure (e.g., `evaluate!`)
- **Frontend (TypeScript / React)**:
  - Variables & functions: `camelCase` (e.g., `formatTurnTimestamp`)
  - Components, Types, Interfaces: `PascalCase` (e.g., `AudioLiveIndicator`, `SessionState`)
  - Constants & Enums: `SCREAMING_SNAKE_CASE` (e.g., `DEFAULT_SAMPLE_RATE`)
  - React Hook functions: prefixed with `use` (e.g., `useAudioWebSocket`)

---

## 2. Git Branching Strategy (`feat/<feature>`)

All new features, bug fixes, and refactoring tasks must be developed on a dedicated feature branch branched off `main` (or the coordinated base branch).

### 2.1 Branch Naming Convention
Branches must adhere to the pattern:
```bash
feat/<ticket-or-feature-name>
```

#### Examples:
- `feat/CALC-01-fit-gap-safe-math`
- `feat/DATA-01-portfolio-skills-null-level`
- `feat/AUDIO-04-gemini-websocket-leak-fix`
- `feat/SEC-04-portfolio-skills-idor-fix`
- `feat/candidate-consent-gate`
- `feat/export-pdf-resilience`

---

## 3. Remote Configuration & Fork Workflow

Development is conducted against a personal/organization fork, which will subsequently be submitted via Pull Request (PR) to the upstream repository.

### 3.1 Git Remotes
- **Upstream / Original Repo**: `origin`
  `https://github.com/rakamindev/ai-interview-platform.git`
- **Fork Remote**: `fork`
  `git@github.com:Reza1290/ai-interview-platform.git`

### 3.2 Verification & Setup
Verify the configured remotes:
```bash
git remote -v
# fork    git@github.com:Reza1290/ai-interview-platform.git (fetch)
# fork    git@github.com:Reza1290/ai-interview-platform.git (push)
# origin  https://github.com/rakamindev/ai-interview-platform.git (fetch)
# origin  https://github.com/rakamindev/ai-interview-platform.git (push)
```

### 3.3 Push Target
**Always push to the `fork` remote**, never directly to `origin`:
```bash
git push -u fork feat/<feature>
```
Pull Requests will then be opened from `Reza1290/ai-interview-platform:<feat-branch>` into `rakamindev/ai-interview-platform:main`.

---

## 4. Commit Message Standard

Commit messages must be clean, structured, and trackable. They should clearly describe the ticket, the problem addressed, the technical solution, and the verification performed.

### 4.1 Commit Structure
```gitcommit
feat(<scope>): <short imperative summary>

Ticket: <TICKET-ID> (<Ticket Name>)

Problem:
<Brief explanation of the bug, security vulnerability, or missing capability>

Solution:
- <Key technical change 1>
- <Key technical change 2>

Verification / DoD:
- <Automated test execution, RSpec / Vitest results, manual verification steps>
```

### 4.2 Example Commit Message
```gitcommit
feat(fit-gap): prevent zero division and nil arithmetic on unassessed skills

Ticket: CALC-01 & CALC-02 (Assessment Calculation Reliability)

Problem:
- Calculating fit-gap score raised ZeroDivisionError when total weight was 0.
- Comparing skill gaps threw NoMethodError on nil candidate level when skills
  were not yet evaluated by AI.

Solution:
- Added safe denominator check returning 0.0 when weight sum is zero.
- Guarded candidate level comparisons to treat nil ai_level as unassessed.
- Added comprehensive unit tests covering zero-weight and nil-level scenarios.

Verification / DoD:
- bundle exec rspec spec/services/fit_gap/engine_spec.rb (12 examples, 0 failures)
- Verified JSON response preserves unassessed status without 500 error.
```

---

## 5. ACID Guarantees & Database Integrity

Every data persistence operation and lifecycle transition must uphold ACID guarantees at both the application and database tiers.

### 5.1 Atomicity (All-or-Nothing Execution)
- Multi-table mutations (e.g., ending an interview session, updating status, creating audit logs, upserting skill scores) must be enclosed in an `ActiveRecord::Base.transaction` block:
  ```ruby
  ActiveRecord::Base.transaction do
    candidate_session.update!(status: :completed, completed_at: Time.current)
    CandidateEvaluationJob.perform_later(candidate_session.id)
    AuditLog.create!(session: candidate_session, action: 'session_completed')
  end
  ```
- If any operation inside the block raises an unhandled exception, all database changes within that transaction must automatically roll back.

### 5.2 Consistency (Schema-Enforced Invariants)
- Never rely solely on application-level validations (`validates :...`) for invariants that protect system integrity.
- Invariants must be enforced directly by PostgreSQL:
  - **Foreign Key Constraints** with appropriate deletion rules (`on_delete: :cascade` or `on_delete: :restrict`).
  - **Check Constraints** for bounded domain values (e.g., `chk_portfolio_skills_ai_level` ensuring levels are either `NULL` or integer `1..5`).
  - **Unique Indices** to prevent duplicate records (e.g., compound index on `[portfolio_id, skill_id]`).

### 5.3 Isolation (Concurrency & Race Condition Defenses)
- Protect against concurrent modifications (e.g., multi-tab audio streaming or double-ended sessions):
  - Use **Pessimistic Locking** (`lock!` / `with_lock`) when updating critical counters or state machine transitions:
    ```ruby
    candidate_session.with_lock do
      return if candidate_session.ended?
      candidate_session.update!(status: :ended)
    end
    ```
  - Use **Distributed Redis Leases** for long-running or distributed processes (e.g., audio buffer chunk processing) to ensure only one worker processes an audio turn at any given millisecond.

### 5.4 Durability (Guaranteed Persistence)
- Candidate audio turns, transcripts, AI evaluation results, and consent gate acknowledgments must be written and committed to persistent storage before returning a 200 OK or broadcasting completion over WebSockets.
- Asynchronous Sidekiq jobs must be configured with retry policies and transactional boundaries to prevent dropped evaluation payloads during server reboots.

---

## 6. Mandatory Automated Testing (TDD & DoD)

Writing and maintaining automated tests is **strictly mandatory**. No pull request or ticket will be considered complete without accompanying automated test suites that verify the changes.

### 6.1 Test-Driven Development (TDD) Workflow
Follow the **Red-Green-Refactor** cycle for every bug fix and feature:
1. **Red**: Write a failing test in RSpec (backend) or Vitest (frontend) that reproduces the bug or asserts the missing feature specification.
2. **Green**: Implement the minimal, clean production code necessary to make the test pass.
3. **Refactor**: Clean up the implementation, ensuring adherence to naming and commenting standards, while keeping all tests passing.

### 6.2 Backend Testing Standards (RSpec)
- **Directory Structure**:
  - `spec/models/`: Unit tests for model validations, associations, scopes, and database constraints.
  - `spec/services/`: Unit tests for business logic, calculation engines (e.g., `FitGap::Engine`), and audio state processors.
  - `spec/requests/`: Request/integration tests for API endpoints, HTTP status codes, multi-tenant isolation, and IDOR guards.
- **Coverage Requirements**:
  - Every calculation engine must test boundary values: zero denominators, nil inputs, unassessed skills, empty skill sets, and maximum values.
  - Every controller endpoint must test authorization failure paths: cross-tenant access attempts (expecting 404 or 403) and expired/invalid tokens (401).
- **Isolation & Mocking**:
  - Third-party network calls (e.g., Google Cloud Gemini Live API, external webhooks) must be deterministically mocked using doubles or stubs.
  - Database interactions in request specs should use transactional fixtures for clean test state isolation.

### 6.3 Frontend Testing Standards (Vitest & React Testing Library)
- **Directory Structure**:
  - `src/__tests__/`: Integration tests for pages and user workflows.
  - `src/components/**/__tests__/`: Component unit tests co-located with their components.
- **User-Centric Testing**:
  - Avoid testing component internal implementation details (e.g., internal state variables). Test visible DOM behavior using accessible queries: `getByRole`, `getByLabelText`, `getByText`.
- **Edge Cases & Failure States**:
  - Test UI error states: microphone permission denied, network/WebSocket dropouts, nil level badge rendering (`Not Assessed` fallback), and form validation failures.

### 6.4 Definition of Done (DoD) Verification
Before submitting or merging any ticket, run and verify:
```bash
# Backend verification: 0 failures, 0 errors
bundle exec rspec

# Frontend verification: 0 failures
npm run test
```

---

## 7. Architecture & Stack Conventions

### 7.1 Multi-Tenant Isolation by Design (Security Standard)
- **Strict Tenant Scoping**: Never query data globally without tenant context. Avoid `Model.find(params[:id])` on any tenant-owned entity (`PortfolioSkill`, `CandidateSession`, `Portfolio`, `Skill`).
- Always scope queries through `Current.tenant` or verified parent relationships:
  ```ruby
  # ❌ Vulnerable to IDOR
  @skill = PortfolioSkill.find(params[:id])

  # ✅ Secure Multi-Tenant Scoping
  @skill = Current.tenant.portfolio_skills.find(params[:id])
  # or
  @skill = @portfolio.portfolio_skills.find(params[:id])
  ```

### 7.2 Service Object Pattern (Backend Architecture)
- Controllers must remain skinny: limited to parameter permitting, authentication, authorization, service delegation, and JSON rendering.
- Business logic lives in `app/services/` with a uniform `.call(...)` entry point returning a structured Result object:
  ```ruby
  result = FitGap::Engine.call(portfolio: portfolio, rubric: rubric)
  if result.success?
    render json: result.data
  else
    render json: { error: result.error_message }, status: :unprocessable_entity
  end
  ```

### 7.3 Frontend Type Safety & State Machine Conventions
- **Zero `any` Policy**: TypeScript code must never use `any`. Use `unknown` with type narrowing or define explicit interfaces.
- **Discriminated Unions**: Model asynchronous workflows and connection states with explicit discriminated unions:
  ```typescript
  type AudioSessionState =
    | { status: 'idle' }
    | { status: 'connecting' }
    | { status: 'recording'; stream: MediaStream; durationMs: number }
    | { status: 'error'; errorMessage: string };
  ```
- **Lifecycle Cleanup in Hooks**: Every `useEffect` managing WebSockets, `AudioContext`, intervals, or DOM event listeners **must** return a cleanup function to prevent memory leaks and dangling connections.

### 7.4 Audio & Real-Time WebSocket Lifecycles
- `AudioContext` must only be initialized or resumed following an explicit user gesture (e.g., clicking "Mulai Interview").
- When a session concludes, all `MediaStreamTrack`s must be explicitly `.stop()`ped and the `AudioContext` closed to release system hardware.
- WebSocket disconnects must clean up all pending timers (e.g., disconnect grace period timers) upon reconnect to prevent premature session terminations.

### 7.5 Compliance & Privacy (UU PDP Protection)
- **Parameter Filtering**: Register sensitive keys (`password`, `token`, `access_token`, `authorization`, `email`, `phone_number`, `nik`) in `config/initializers/filter_parameter_logging.rb`.
- **Data Minimization**: Mask candidate contact info in logs and non-essential views (`+62 812-****-**78`, `a***@domain.com`).

---

## 8. Temporary Exclusion Guard (`assessment/` & `docs/`)

> [!IMPORTANT]
> **Do NOT commit or push `assessment/` or `docs/` directories at this stage.**
> These directories contain detailed internal audit logs, problem analyses, and working blueprints that will be consolidated into the final submission package later.
>
> **Rules for staging & committing**:
> - Never execute broad `git add .` or `git add -A`.
> - Explicitly stage only feature code, migrations, tests, and configuration files (e.g. `git add api/app/... api/spec/... web/src/... agents.md`).
> - Keep `assessment/` and `docs/` untracked / unstaged until explicit user authorization.
