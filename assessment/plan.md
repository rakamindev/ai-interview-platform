# Executive Execution Plan & Roadmap
**Project:** AI Interview Platform (Rakamin Fullstack Product Engineer Assessment)
**Candidate:** Krisnanto

This document contains the complete sequence of all bug fixes, features, and architectural decisions that we have executed from start to finish. All of these changes were delivered using the **"Umbrella PR" strategy** (Option B) under a single main PR (#96, `feature/fitgap-monozukuri`), which consolidates 11 smaller, focused sub-PRs.

The order below is arranged based on **Priority/Impact Level**, starting from the most critical for the system to aesthetic improvements.

---

## PRIORITY 1: Critical Bug Fixes & Data Contract (P1)
*Focus: Ensuring the core application functions (AI Interview and Assessment) run without errors.*

1. **Fixing WebSocket & Gemini Model Integration**
   - **Problem:** The default `gemini-2.5-pro` model is deprecated and `gemini-3.5-flash-lite` does not support *WebSocket/BidiGenerateContent*, causing the connection to be rejected (HTTP 1008) and failing to generate the portfolio (HTTP 404).
   - **Solution:** Updated `application.yml` to use `gemini-3.1-flash-live-preview` (for WebSocket) and `gemini-3.5-flash` (for standard text).
2. **Fixing Contract Mismatch (Frontend vs Backend)**
   - **Problem:** The backend sends the target *skill* as `expected_level`, but the UI expects `required_level`. `ai_level` is generated as an *integer* (1-5), but the UI expects a *string* ("L3"). This causes `undefined` data in the Fit/Gap table.
   - **Solution:** Refactored the `SkillComparison` interface in the Frontend to follow the *Database (Single Source of Truth)* standard. Changed the type to `number` and the key to `expected_level`.
3. **Fixing Environment Variable Routing Schema**
   - **Problem:** `APP_BASE_URL` (port 3001) is used for both the *API endpoint* and the *Invite Link*, making candidates redirected to the backend port (HTTP 404) instead of the React UI.
   - **Solution:** Separated the environment variables into `API_BASE_URL` for backend fetching and `WEB_BASE_URL` purely for generating the *Invite Link* via the `Session` model.

---

## PRIORITY 2: Architecture, Infrastructure & Security (P2)
*Focus: Stability, deployment reliability, and Test-Driven Engineering.*

4. **Resolving Zeitwerk Conflict (Eager Load Bug)**
   - **Problem:** The application fails to boot (*NameError*) in the CI/Testing environment because `config.eager_load = true` conflicts with manual `require_relative` in the `AudioWebsocketMiddleware` file.
   - **Solution:** Implemented a surgical fix by injecting `Rails.autoloaders.main.ignore` in the `websocket.rb` initializer to prevent Zeitwerk from tracking the file, allowing manual loading to run safely.
5. **Local Development Environment & Docker (Developer Experience)**
   - Provided `docker-compose.yml` to make it easier for the developer team (onboarding) to run the app locally without needing a complex environment setup (Ruby/Postgres/Redis).
   - Optimized local Docker using the `alpine` image for Postgres 16 and Redis 7 with ARM64 architecture.
   - Added `shm_size: 256mb` in `docker-compose.yml` specifically for *local development* to prevent *Out-of-Memory* in the database when developers run heavy test suites or data seeds locally.
   - **Admin Seeder:** Inject standard development credentials (`admin@rakamin.com` / `password123`) via database seeds to streamline local testing and bypass the need for manual JWT token generation.
6. **Building Test Harness & CI/CD Pipeline**
   - Configured `RSpec` + `DatabaseCleaner` + `FactoryBot` for the backend.
   - Configured `Vitest` + `@testing-library/react` + `MSW` for the frontend.
   - Created *GitHub Actions* to run backend and frontend tests in parallel on every Push/PR.
7. **Resilience Testing (Seeded Faults) & Data Privacy Compliance**
   - **Resilience & Seeded Fault Proof:** Executed on a separate scratch branch (`seeded-fault-proof`) by intentionally breaking the logic, verifying that RSpec caught the failure, and then reverting it back to normal. We proved the *Fit/Gap Engine* does not crash on timeout, but instead gracefully shows a *Fallback Narrative*.
   - **Data Privacy (UU PDP):** Intervened in the *Rails Logger* in the test suite to ensure API Keys and candidate *Personally Identifiable Information (PII)* never leak into the server logs.

---

## PRIORITY 3: Monozukuri & User Experience (P3)
*Focus: Visual perfection, smooth interaction, and a premium feel for users.*

8. **Total Revamp of the Interview Page**
   - Changed the interview UI into a dark/elegant immersive fullscreen format.
   - Added a glassmorphism-based *Floating Control Bar* at the bottom of the screen.
   - Added an *AI Orb Visualizer* that scales and glows when the AI speaks.
9. **Fit/Gap Report Redesign (Graceful Degradation)**
   - Implemented *Skeleton Loaders* (Table & Paragraphs) during the `generating` status.
   - Added an elegant *Error Retry Banner* with an interactive button if generation fails.
   - Added dynamic labels for *Discovered Skills* (extra skills outside requirements) and *Not Assessed*.
   - Prevented AI narrative text from overflowing its container.
10. **Burger Menu Navigation (Assessor Layout)**
    - Removed standard text navigation and replaced it with a clean *Dropdown Burger Menu* in the top right corner.
    - Applied a transparent floating *Header* design (*backdrop-blur*).
11. **Login Page & Hardware Check Improvements**
    - Changed the *Login Page* into a modern design with a *Split-Screen Layout*.
    - Added an `AbortController` (5-second timeout) to the internet speed check component to prevent *Infinite Loading* if the public API is slow.
12. **Assessment & Candidate Invite Page Styling**
    - Replaced the *Empty State* (*No assessments/candidates*) with a dashed border design, elegant iOS-style icons (FolderOpen/UserRound), and interactive CTA buttons.
    - Revamped the candidate list (*Session Row*) with rounded *Card* styles (`rounded-2xl`), group hover interactions, dynamic status badges (*Live/Awaiting/Completed*), and a responsive flexbox layout for mobile screens.
    - Applied premium *Skeleton Loading* that exactly mimics the original page structure, plus a *Fade-In* transition to prevent annoying layout shifts.

---

## PRIORITY 4: Documentation & Presentation (P4)
*Focus: Project administration completeness and technical documentation guarantee.*

13. **Test-Driven API Documentation (Rswag)**
    - Configured `Rswag` (Swagger) to render the API documentation interface at `/api-docs`.
    - All *Request/Response* schemas (including Auth & Fit/Gap) are automatically generated from integration tests, ensuring the documentation is never out of sync with production code.