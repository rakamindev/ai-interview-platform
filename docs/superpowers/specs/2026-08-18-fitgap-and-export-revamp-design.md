# Design Specification: AI Interview Platform Revamp — Stage 3 (Fit/Gap Analysis & PDF Export)

- **Date:** 2026-08-18
- **Author:** Product Engineering Team
- **Status:** Approved
- **Target Branch:** `feature/monozukuri-revamp`
- **Scope:** Stage 3 of 3 (Fit/Gap Matching Engine Hardening, Culture Narrative Resilience, Executive PDF Generation & Interactive Reports)

---

## 1. Executive Summary & Product Context

### 1.1 The Mission
The **Fit/Gap Analysis & PDF Export Engine** allows hiring managers, recruiters, and assessors to evaluate how closely a candidate's demonstrated competency profile matches the specific requirements of any open vacancy.

In modern talent acquisition:
1. **Accurate Delta Analytics:** Missing or unassessed candidate skills must be clearly classified as `not_assessed` without crashing arithmetic delta calculations (`nil - expected_level`).
2. **Culture Narrative Synthesis:** The system must generate concise, meaningful narratives comparing candidate workstyle against vacancy culture expectations using LLMs with fallback guards.
3. **Executive PDF Deliverables:** Hiring decisions often happen in leadership review meetings where recruiters present offline PDF dossiers. The PDF must render cleanly, professionally, and comprehensively.

---

## 2. Architecture & Data Flow

```
+-------------------------------------------------------------------------------+
|                        FIT/GAP & EXPORT PIPELINE                              |
|                                                                               |
|  [Candidate Portfolio (Skills + Overrides)]                                   |
|                        │                                                      |
|                        ▼                                                      |
|     [Vacancy Requirements (Skills + Culture Dimensions)]                      |
|                        │                                                      |
|                        ▼                                                      |
|             [FitGap::Engine Comparator]                                       |
|    - Null-Safe Level Matching (Match / Gap / Exceed / Not Assessed)           |
|    - Culture & Overall Narrative Synthesis via Gemini Flash                   |
|                        │                                                      |
|                        ▼                                                      |
|              [FitGapReport Storage]                                           |
|                        │                                                      |
|            +-----------+-----------+                                          |
|            │                       │                                          |
|            ▼                       ▼                                          |
|   [Executive PDF Generator]   [Interactive Web Report]                        |
|   (Prawn Table & Dossier)     (KPI HUD & Comparison Table)                    |
+-------------------------------------------------------------------------------+
```

---

## 3. Detailed Component Specifications

### 3.1 Backend Module (`api/`)

#### A. Null-Safe Comparison & Fallback Narrative (`FitGap::Engine`)
- **Requirement:** Prevent `NoMethodError` during comparison when `portfolio_skill[:effective_level]` is `nil`.
- **Implementation:**
  - Verify `candidate_level.present?` before arithmetic operations.
  - Calculate delta only when level is present; classify as `not_assessed` otherwise.
  - Sanitize Gemini narrative JSON responses with regex extraction and provide clean fallback summaries.

#### B. Executive PDF Generator (`Exports::PdfGenerator`)
- **Requirement:** Generate clean, print-ready A4 PDF document containing candidate identity, assessment duration, skill portfolio, fit/gap table, and narrative synthesis.
- **Implementation:**
  - Handle `Unassessed` label for skills with `nil` levels.
  - Format status badges and deltas with clear tabular alignment.

---

### 3.2 Frontend Module (`web/`)

#### A. Interactive Fit/Gap Report Page (`FitGapReportPage.tsx`, `ComparisonTable.tsx`)
- **Metric Cards:** Display summary counts for Match (✅), Exceed (⭐), Gap (⚠️), and Not Assessed (—).
- **Comparison Table:** Display required level vs candidate level with human override indicators (✏).
- **Culture & Overall Narrative:** Dedicated cards displaying Gemini synthesis with clean typography.
- **Instant PDF/JSON Export:** Download options with spinner loaders.

---

## 4. Testing & Verification Strategy

### 4.1 Automated Backend Suite (RSpec)
- `spec/services/fit_gap/engine_spec.rb`:
  - Test comparisons with match, exceed, gap, and unassessed skills.
  - Test narrative parsing with markdown code fences and fallback narrative when LLM fails.
- `spec/services/exports/pdf_generator_spec.rb`:
  - Test PDF binary generation with and without vacancy fit/gap report.
- `spec/requests/api/v1/fitgap_spec.rb`:
  - Test `POST /api/v1/portfolios/:id/fitgap` and `GET /api/v1/portfolios/:id/export?format=pdf`.

### 4.2 Seeded Fault Test (Monozukuri Proof)
- Introduce a portfolio with `nil` (unassessed) level to verify `FitGap::Engine` does not crash with `NoMethodError`.

---

## 5. Definition of Done
1. All RSpec test suites pass with 100% success rate across all 3 stages.
2. Frontend builds cleanly with zero TypeScript errors.
3. Clean git history on `feature/monozukuri-revamp`.
