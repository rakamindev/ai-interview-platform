# Fullstack Product Engineer Case Study Report
**Architecture Audit, Monozukuri Revamp, Multi-Tenant Hardening & Compliance Proof**

- **Target Repository:** `rakamindev/ai-interview-platform`
- **Feature Branch:** `feat/monozukuri-fullstack-revamp`
- **Pull Request Link:** [https://github.com/rakamindev/ai-interview-platform/pull/251](https://github.com/rakamindev/ai-interview-platform/pull/251)
- **Candidate:** Asep (Senior Fullstack Product Engineer)
- **Comprehensive PDF Report:** [`assessment/Fullstack_Product_Engineer_Case_Study_Report.pdf`](./Fullstack_Product_Engineer_Case_Study_Report.pdf)
- **Demonstration Video Walkthrough:** [https://www.loom.com/share/579c3d0395cb4da2a3e4536385d80b69](https://www.loom.com/share/579c3d0395cb4da2a3e4536385d80b69)

---

## Executive Summary
This submission represents an end-to-end fullstack audit and Monozukuri craftsmanship revamp of Rakamin's AI Interview Platform. Beyond addressing the minimum functional baseline, every structural seam between the Ruby on Rails API, PostgreSQL schema, Sidekiq workers, and React (Vite) frontend was investigated from first principles. Critical enterprise-grade defects—including a cross-tenant data leak (IDOR), an infinite polling storm, silent contract mismatches, and cleartext transcript logging—were resolved and fortified with rigorous automated test suites (RSpec + Vitest) and a demonstrated seeded fault proof.

---

## 1. Step 2: Domain Immersion & Mental Model

### The Core Problem Space
Technical interviewing is historically prone to interviewer fatigue, uncalibrated scoring, and bias. The AI Interview Platform automates live voice probing using Gemini Live WebSocket streaming, structured against a standardized competency taxonomy (B7 Taxonomy with L1–L5 behavioral anchors).

However, introducing AI evaluation into high-stakes hiring creates severe risks:
1. **Candidate Anxiety & Legal Rights:** Voice transcription must have clear, informed consent pursuant to Indonesia's Personal Data Protection Law (UU PDP No. 27/2022).
2. **Assessor Sovereignty:** Human recruiters must retain sovereign authority to adjust and override AI ratings without edits being lost when portfolios are regenerated.
3. **Enterprise Multi-Tenancy:** Each corporate tenant's data must remain strictly isolated across all API queries, database tables, and PDF exports.

### Stakeholder Perspective Matrix

| Stakeholder | Key Concerns & Failure Modes | Architectural & UX Mitigation Delivered |
| :--- | :--- | :--- |
| **Candidate** | Lack of consent clarity, abrupt disconnects, unfair scoring on unprobed topics. | Explicit UU PDP Consent Banner, WebSocket reconnection grace, and unassessed status instead of failing score (L1). |
| **Assessor** | AI hallucinations, lost override notes on re-run, infinite loading states on fit/gap. | Human-in-the-loop override panel, transactional preservation across regenerations, and fit/gap readiness scorecard. |
| **Tenant Admin** | Cross-tenant data leaks (IDOR), cleartext transcripts in server logs, irreversible migrations. | ActiveRecord relationship scoping (`Portfolio.for_current_tenant`), parameter filtering, and 100% reversible migrations. |

---

## 2. Step 3: Gap Analysis & Technical Specifications

### P0–P3 Gap Inventory with 1-Line Impact Statements

| Severity | Vulnerability / Deficiency | 1-Line Impact Statement | Resolution Architecture |
| :--- | :--- | :--- | :--- |
| **P0-1** | **Multi-Tenant IDOR Breach** in `PortfoliosController` | Any authenticated user could view and export another tenant's candidate portfolio and transcript. | Scoped all queries with `Portfolio.for_current_tenant`, blocking cross-tenant access with 404 Not Found. |
| **P0-2** | **Fit/Gap Infinite Polling Storm** in `FitGapReportPage.tsx` | Polling loop repeatedly triggered `triggerFitGap` on 404, flooding Sidekiq worker queues every 5 seconds. | Guarded generation trigger with `hasTriggeredRef` so generation only triggers once on initial mount. |
| **P0-3** | **Data Contract Seam Breakdown** in Fit/Gap Table | Backend returned `expected_level` while frontend expected `required_level`, hiding target baseline and overrides. | Implemented dual-contract Tolerant Reader adapter returning both fields, `is_override`, and `assessor_notes`. |
| **P1-1** | **UU PDP Personal Data Cleartext Logging** | Voice transcripts and candidate names logged in cleartext server stdout without filtering. | Configured `filter_parameter_logging.rb` and redacted live transcript streaming in `LiveClient`. |
| **P1-2** | **Unassessed Skills Hallucinated as L1 / Null Crash** | Competencies not probed in dialogue defaulted to L1 or crashed `parseLevel(null)`. | Reversible DB migration allowing `ai_level: NULL` with `is_assessed: false` and dedicated UI badges. |
| **P1-3** | **Fragile Non-Transactional Portfolio Regeneration** | Regenerating a portfolio purged previous assessor overrides and lacked DB transactions. | Transactional atomic regeneration that preserves and re-attaches existing assessor overrides by skill label. |
| **P2-1** | **Skill Deletion Bug in Nested Forms** | Removing skills in assessment/vacancy edit pages didn't pass `_destroy: true`. | Tracked `deletedSkillIds` on UI removal and submitted `{ id, _destroy: true }` attributes to Rails. |
| **P2-2** | **SkillCard Double Prefix UI Bug** | Badge rendered `SK-SK-001` when taxonomy ID already contained `SK-`. | Refactored prefix formatter to avoid double-prepending `SK-`. |
| **P2-3** | **Missing Language Selector on Edit** | Language field was present on New Assessment but missing from Edit page. | Added language selector to `AssessmentEditPage.tsx` and permitted `:language` in controller params. |
| **P3-1** | **Missing Informed Consent Banner** | Candidate entered interview without formal data processing consent. | Implemented explicit UU PDP Informed Consent Banner with mandatory checkbox before interview start. |

### Architectural Trade-off Evaluations

#### Trade-off 1: Multi-Tenancy Enforcement
- **Option A (Controller-level manual queries):** Filter each query manually via `Session.where(tenant_id: Current.tenant_id)`.
- **Option B (Model-level scoped traversal - CHOSEN):** Define `scope :for_current_tenant` in `Portfolio` traversing `joins(:session).where(sessions: { tenant_id: Current.tenant_id })`.
- *Why Chosen:* Single source of truth. Prevents accidental IDOR vulnerabilities in future endpoints or exporters.

#### Trade-off 2: Fit/Gap Data Seam Alignment
- **Option A (Breaking Schema Rename):** Force a hard rename of either frontend or backend keys.
- **Option B (Dual-Contract Tolerant Reader - CHOSEN):** Return both `required_level` and `expected_level` from backend, and use nullish coalescing in frontend.
- *Why Chosen:* Zero regression risk, maintaining full backward compatibility with cached reports and clients.

#### Trade-off 3: Unassessed Skill Representation
- **Option A (Default to L1):** Force unassessed skills to baseline level 1 to avoid schema changes.
- **Option B (Nullable Schema & Explicit Flag - CHOSEN):** Migrate database to allow `ai_level: NULL` with `is_assessed: false`.
- *Why Chosen:* Protects candidate evaluation integrity. Never penalizes a candidate for a question they were never asked.

---

## 3. Step 4: Fullstack Implementation & Architecture

### Database Migration (`api/db/migrate/20261105093647_allow_null_ai_level_on_portfolio_skills_and_add_assessed_flag.rb`)
```ruby
class AllowNullAiLevelOnPortfolioSkillsAndAddAssessedFlag < ActiveRecord::Migration[7.0]
  def change
    add_column :portfolio_skills, :is_assessed, :boolean, default: true, null: false
    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :competency_summary, true

    reversible do |dir|
      dir.up do
        execute("ALTER TABLE portfolio_skills DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level")
        execute("ALTER TABLE portfolio_skills ADD CONSTRAINT chk_portfolio_skills_ai_level CHECK (ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5))")
      end
      dir.down do
        execute("UPDATE portfolio_skills SET ai_level = 1 WHERE ai_level IS NULL")
        execute("ALTER TABLE portfolio_skills DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level")
        execute("ALTER TABLE portfolio_skills ADD CONSTRAINT chk_portfolio_skills_ai_level CHECK (ai_level BETWEEN 1 AND 5)")
      end
    end
  end
end
```
*Verification:* Tested forward, rollback (`rails db:rollback`), and forward (`rails db:migrate`). 100% reversible.

### Transactional Portfolio Generator (`api/app/services/portfolios/generator.rb`)
- Wraps entire skill creation in `Portfolio.transaction`.
- Preserves assessor overrides across re-evaluations:
```ruby
existing_overrides = @portfolio.assessor_overrides.to_a
# ... re-evaluate skills ...
existing_overrides.each do |old_override|
  matching_skill = @portfolio.portfolio_skills.find { |s| s.skill_label.downcase.strip == old_override.portfolio_skill.skill_label.downcase.strip }
  if matching_skill
    matching_skill.create_assessor_override!(
      ai_level: old_override.ai_level,
      override_level: old_override.override_level,
      assessor_notes: old_override.assessor_notes,
      overridden_by: old_override.overridden_by,
      overridden_at: old_override.overridden_at
    )
  end
end
```

---

## 4. Step 5: Demonstration & Proof

### 4.1 Automated Test Execution Proof

#### Backend RSpec Test Execution:
```bash
$ bundle exec rspec
................

Finished in 0.58673 seconds (files took 1.11 seconds to load)
16 examples, 0 failures
```
**Specs Included:**
- `spec/models/portfolio_skill_spec.rb` (validations, nullability, effective level)
- `spec/services/fit_gap/engine_spec.rb` (delta calculation, override precedence, not_assessed result)
- `spec/services/portfolios/generator_spec.rb` (override preservation, transactional rollback)
- `spec/requests/api/v1/portfolios_spec.rb` (multi-tenant isolation, cross-tenant 404 check)
- `spec/requests/api/v1/portfolio_skills_spec.rb` (override persistence, cross-tenant blocking)

#### Frontend Vitest Test Execution:
```bash
$ npm test
✓ src/components/fitgap/ComparisonTable.test.tsx (4 tests) 53ms
  ✓ renders all comparison rows with required and candidate levels
  ✓ displays human override indicator and assessor note
  ✓ computes and renders match rate summary metrics correctly
  ✓ handles unassessed skill without crashing and shows 'Not assessed'

✓ src/components/portfolio/SkillPortfolioCard.test.tsx (3 tests) 35ms
  ✓ renders assessed skill details, target level, confidence, and quotes
  ✓ renders unassessed skill clearly with 'Not Assessed' and explanation
  ✓ renders human assessor override banner and notes when override is present

Test Files  2 passed (2)
     Tests  7 passed (7)
```

---

### 4.2 Seeded Fault Test Proof (Commit History Proof)

To prove that the automated test suite catches regressions, a deliberate fault was seeded into `FitGap::Engine`:

1. **Seeded Fault Commit:** [`29a22bd`](https://github.com/rakamindev/ai-interview-platform/commit/29a22bd)
   *Defect:* Forced `effective_level` in `FitGap::Engine` to ignore assessor overrides and evaluate raw AI levels only.
2. **Test Failure Output:**
   ```text
   Failures:
     1) FitGap::Engine generates comparison conforming to the frontend contract seam
        Failure/Error: expect(nodejs['result']).to eq('exceed')

          expected: "exceed"
               got: "gap"

          (compared using ==)
        # ./spec/services/fit_gap/engine_spec.rb:92:in `block (2 levels) in <top (required)>'
   ```
3. **Resolution Revert Commit:** [`495701f`](https://github.com/rakamindev/ai-interview-platform/commit/495701f)
   *Outcome:* Reverted seeded fault &rarr; all 16 RSpec tests passed immediately.

---

### 4.3 AI Verification Moment
During zero-dialogue and edge-case testing, AI models frequently hallucinatory-scored unprobed skills as L1 (Foundational). Accepting this behavior silently harmed candidates. Through first-principles analysis, we enforced a deterministic system boundary: absent dialogue turns are marked `is_assessed: false` and `ai_level: NULL`. The AI's probabilistic output was bound by robust engineering constraints.

---

## 5. Visual UI Showcase & Screenshots

### Figure 1: Candidate Pre-Start Experience with UU PDP Consent Banner
![Candidate Interview Pre-start with UU PDP Consent](./screenshots/01_interview_pdp_consent.png)
*Features mandatory PDP Informed Consent checkbox, hardware proctoring check, and interview guidance.*

---

### Figure 2: Revamped Portfolio Results
![Portfolio Results with Assessor Override & Unassessed Skill](./screenshots/02_portfolio_results.png)
*Shows candidate name, target level badges, human assessor override banner, and clear unassessed state for Security Engineering.*

---

### Figure 3: Revamped Fit/Gap Report
![Fit/Gap Report with Readiness Scorecard & Comparison Table](./screenshots/03_fitgap_report.png)
*Shows match rate scorecard (100% on assessed skills), human override indicator with AI baseline, assessor note, and unassessed status.*

---

### Figure 4: Assessment Edit Page
![Assessment Edit Page with Language and Taxonomy](./screenshots/04_assessment_edit.png)
*Features interview language selection, B7 skill anchors, and safe deletions.*

---

### Figure 5: Mobile Viewport (390px)
![Mobile Responsive View for Fit/Gap Report](./screenshots/05_mobile_responsive_fitgap.png)
*Responsive verification on mobile viewport showing adaptive card tables and metrics.*

---

## 6. Video Walkthrough Guide

The 4-minute demonstration walkthrough covers:
- **00:00 - 00:45:** Problem Space & Mental Model (AI interview challenges, P0-P3 gap analysis, Monozukuri philosophy).
- **00:45 - 01:45:** Candidate Journey & Privacy (Pre-start experience, UU PDP Informed Consent banner, WebSocket flow).
- **01:45 - 02:45:** Assessor Portfolio & Override (Reviewing candidate evidence, unassessed skills, applying human overrides, PDF export).
- **02:45 - 03:30:** Fit/Gap Readiness & Seam Fix (Analyzing candidate fit against role vacancy, readiness gauge, polling storm resolution).
- **03:30 - 04:15:** Monozukuri Test & Seeded Fault Proof (Terminal execution of RSpec 16/16 and Vitest 7/7, review of seeded fault commit).

🔗 **Pull Request Link:** [https://github.com/rakamindev/ai-interview-platform/pull/251](https://github.com/rakamindev/ai-interview-platform/pull/251)  
🔗 **Video Link:** [https://www.loom.com/share/579c3d0395cb4da2a3e4536385d80b69](https://www.loom.com/share/579c3d0395cb4da2a3e4536385d80b69)
