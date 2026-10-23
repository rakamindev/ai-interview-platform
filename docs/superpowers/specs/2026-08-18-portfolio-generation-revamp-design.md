# Design Specification: AI Interview Platform Revamp — Stage 2 (Portfolio Generation & LLM Scoring Pipeline)

- **Date:** 2026-08-18
- **Author:** Product Engineering Team
- **Status:** Approved
- **Target Branch:** `feature/monozukuri-revamp`
- **Scope:** Stage 2 of 3 (LLM Output Sanitization, Unassessed Competency Preservation, Assessor Override Integrity & Modern Portfolio UI)

---

## 1. Executive Summary & Product Context

### 1.1 The Mission
The **Portfolio Generation & Scoring Pipeline** transforms raw interview audio transcripts and coverage records into structured candidate competency profiles. 

In real-world talent assessment, scoring distortions cause major fairness failures:
1. **Unassessed vs Level 1 Confusion:** When a candidate is not questioned on a specific skill, clamping their level to `Level 1` incorrectly labels them as "unskilled" or "needing close supervision" rather than "unassessed / needs further exploration".
2. **LLM Output Formatting Fragility:** LLMs (such as Gemini Pro) regularly return JSON encased in markdown code fences (` ```json ... ``` `) or surrounding explanatory text. Directly executing `JSON.parse` causes silent crashes and failed portfolio generation jobs.
3. **Assessor Trust & Evidence Traceability:** Assessors require exact candidate quotes as evidence and the autonomy to override scores with justifications while keeping downstream fit/gap analytics in sync.

---

## 2. Architecture & Data Flow

```
+-------------------------------------------------------------------------------+
|                      PORTFOLIO GENERATOR PIPELINE                             |
|                                                                               |
|  [Transcript Turns + Coverage Maps]                                           |
|                   │                                                           |
|                   ▼                                                           |
|      [Gemini Pro Evaluation Prompt]                                           |
|                   │                                                           |
|                   ▼ (Raw text with markdown backticks or preamble)            |
|       [Robust JSON Extractor & Sanitizer]                                     |
|                   │                                                           |
|                   ▼                                                           |
|     [Level Validation & Unassessed Guard]                                     |
|     - If level is present & >= 1: clamp(1, 5)                                 |
|     - If level is nil / 0 / missing: keep nil (Unassessed)                    |
|                   │                                                           |
|                   ▼                                                           |
|         [PostgreSQL: Portfolio & PortfolioSkills]                             |
|                   │                                                           |
|                   ▼                                                           |
|        [Assessor Override & Auto FitGap Sync]                                 |
+-------------------------------------------------------------------------------+
```

---

## 3. Detailed Component Specifications

### 3.1 Backend Hardening (`api/`)

#### A. Resilient JSON Parsing & Extraction (`Portfolios::Generator#save_skills`)
- **Requirement:** Parse LLM output safely, regardless of whether the model outputs markdown code blocks (` ```json ... ``` `) or leading text.
- **Implementation:**
  - Introduce `extract_json(response)` helper using regex to isolate the outermost valid JSON object.
  - Parse JSON and handle missing keys gracefully with fallback arrays.

#### B. Accurate Level Mapping & Unassessed Skill Preservation
- **Requirement:** Prevent unassessed skills from being penalized as Level 1.
- **Implementation:**
  - Check `skill_data['level']`.
  - If `level.to_i.between?(1, 5)`: assign integer level.
  - Else: assign `nil`, preserving unassessed status.

#### C. Assessor Override & Fit/Gap Invalidation (`PortfolioSkillsController#override`)
- **Requirement:** Allow assessors to adjust levels, record notes, and immediately invalidate/regenerate cached fit/gap reports.

---

### 3.2 Frontend UI & UX Revitalization (`web/`)

#### A. Competency Display & Level Badges (`SkillPortfolioCard.tsx`, `LevelBadge.tsx`)
- **Handling Unassessed Skills:** Display an "Unassessed / Belum Dievaluasi" neutral pill badge instead of forcing L1.
- **Confidence Indicators:** Visual confidence chips with color coding (Green: High, Amber: Medium, Slate: Low).
- **Evidence Quotes:** Clean blockquote cards highlighting verbatim candidate quotes from the transcript.

#### B. Portfolio Overview Header & Actions (`PortfolioPage.tsx`)
- Display candidate metadata, assessment title, generation status, and quick export to PDF/JSON.
- Seamless polling with skeleton loaders during generation.

---

## 4. Testing & Verification Strategy

### 4.1 Automated Backend Suite (RSpec)
- `spec/services/portfolios/generator_spec.rb`:
  - Test parsing markdown-fenced JSON responses (` ```json { ... } ``` `).
  - Test preservation of `nil` levels for unassessed competencies.
  - Test failure rescue and status updates.
- `spec/requests/api/v1/portfolios_spec.rb`:
  - Test `GET /api/v1/sessions/:id/portfolio` across status states (`generating`, `complete`, `failed`).
  - Test `POST /api/v1/portfolio-skills/:id/override` updating level and triggering fit/gap regeneration.

### 4.2 Seeded Fault Test (Monozukuri Proof)
- Provide raw un-sanitized markdown JSON response into `Portfolios::Generator`.
- Prove that the hardened parser extracts and saves skills without `JSON::ParserError`.

---

## 5. Definition of Done
1. All RSpec generator, portfolio, and override specs pass (0 failures).
2. Frontend builds cleanly without TypeScript or styling regressions.
3. Clean git commit history on `feature/monozukuri-revamp`.
