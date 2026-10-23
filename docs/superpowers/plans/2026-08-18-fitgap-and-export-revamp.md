# Fit/Gap Analysis & PDF Export Revamp (Stage 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the full-stack AI interview platform by hardening the Fit/Gap comparison engine with null-safe delta handling, resilient LLM narrative parsing, print-ready executive PDF generation, and an interactive, modern Fit/Gap report UI.

**Architecture:** Enhances Rails `FitGap::Engine` with null-safe skill comparison, refactors `Exports::PdfGenerator` for executive dossier formatting, adds comprehensive RSpec service/request specs, and upgrades React Fit/Gap report components with modern visual styling.

**Tech Stack:** Ruby on Rails 7, PostgreSQL, Sidekiq, Prawn PDF, Gemini Flash LLM, RSpec, React 18, TypeScript, Tailwind CSS, Lucide React.

**Spec:** `docs/superpowers/specs/2026-08-18-fitgap-and-export-revamp-design.md`

## Global Constraints
- Target branch is `feature/monozukuri-revamp`.
- Unassessed skills with `nil` levels must never crash `FitGap::Engine` or `Exports::PdfGenerator`.
- All RSpec test suites across Stage 1, 2, and 3 must pass with 100% success rate.
- Frontend must build cleanly with zero TypeScript errors.

---

### Task 1: Null-Safe Skill Comparison & Resilient Narrative in `FitGap::Engine`

**Files:**
- Create: `api/spec/services/fit_gap/engine_spec.rb`
- Modify: `api/app/services/fit_gap/engine.rb`

**Interfaces:**
- Consumes: `Portfolio`, `Vacancy`, `Gemini::HttpClient`
- Produces: `FitGapReport` with calculated `skill_comparisons` and synthesized `culture_narrative` and `overall_narrative`.

- [ ] **Step 1: Write failing service spec for `FitGap::Engine`**

```ruby
# api/spec/services/fit_gap/engine_spec.rb
require 'rails_helper'

RSpec.describe FitGap::Engine do
  let!(:org) do
    Organization.find_by(scheme: 'test-corp') || Organization.create!(
      name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp-id', host: 'localhost'
    )
  end
  let!(:user) { User.create!(email: "assessor_fitgap@test.com", password_digest: BCrypt::Password.create("secret123"), role: "admin") }
  let!(:assessment) do
    a = Assessment.create!(name: "Lead Fullstack Engineer", tenant_id: org.id, created_by: user.id, time_limit_min: 45)
    a.assessment_skills.create!(skill_id: "sk-01", skill_label: "Ruby on Rails", l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5")
    a.assessment_skills.create!(skill_id: "sk-02", skill_label: "React Architecture", l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5")
    a.assessment_skills.create!(skill_id: "sk-03", skill_label: "Kubernetes", l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5")
    a
  end
  let!(:session) { Session.create!(assessment: assessment, tenant_id: org.id, status: 'ended') }
  let!(:portfolio) do
    p = session.create_portfolio!(generation_status: 'complete')
    p.portfolio_skills.create!(skill_id: "sk-01", skill_label: "Ruby on Rails", ai_level: 4, ai_confidence: "high", competency_summary: "Expert Rails dev.")
    p.portfolio_skills.create!(skill_id: "sk-02", skill_label: "React Architecture", ai_level: 3, ai_confidence: "high", competency_summary: "Solid frontend skills.")
    p.portfolio_skills.create!(skill_id: "sk-03", skill_label: "Kubernetes", ai_level: nil, ai_confidence: "low", competency_summary: "Unassessed during interview.")
    p
  end
  let!(:vacancy) do
    v = Vacancy.create!(
      role_title: "Senior Fullstack Lead",
      culture_dimensions: "High autonomy, collaborative design.",
      competency_expectations: "Strong backend and infra understanding.",
      created_by: user.id
    )
    v.vacancy_skills.create!(skill_id: "sk-01", skill_label: "Ruby on Rails", expected_level: 3) # Exceeds (4 vs 3, +1)
    v.vacancy_skills.create!(skill_id: "sk-02", skill_label: "React Architecture", expected_level: 3) # Match (3 vs 3, 0)
    v.vacancy_skills.create!(skill_id: "sk-03", skill_label: "Kubernetes", expected_level: 3) # Not Assessed (nil vs 3)
    v.vacancy_skills.create!(skill_id: "sk-04", skill_label: "System Design", expected_level: 4) # Not Assessed (missing vs 4)
    v
  end

  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  context "when Gemini returns narrative JSON" do
    let(:narrative_response) do
      <<~JSON
        ```json
        {
          "culture_narrative": "Candidate demonstrates high autonomy and proactive collaboration.",
          "overall_narrative": "Strong recommendation for Senior Fullstack Lead based on backend mastery."
        }
        ```
      JSON
    end

    before do
      allow(mock_gemini).to receive(:generate_content).and_return(narrative_response)
    end

    it "safely evaluates delta without crashing on unassessed skills and records report" do
      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      expect(report).to be_persisted
      expect(report.skill_comparisons.length).to eq(4)

      rails_comp = report.skill_comparisons.find { |c| c['skill_label'] == 'Ruby on Rails' }
      expect(rails_comp['result']).to eq('exceed')
      expect(rails_comp['delta']).to eq(1)

      react_comp = report.skill_comparisons.find { |c| c['skill_label'] == 'React Architecture' }
      expect(react_comp['result']).to eq('match')
      expect(react_comp['delta']).to eq(0)

      k8s_comp = report.skill_comparisons.find { |c| c['skill_label'] == 'Kubernetes' }
      expect(k8s_comp['result']).to eq('not_assessed')
      expect(k8s_comp['candidate_level']).to be_nil
      expect(k8s_comp['delta']).to be_nil

      expect(report.culture_narrative).to include("high autonomy")
      expect(report.overall_narrative).to include("Senior Fullstack Lead")
    end
  end
end
```

- [ ] **Step 2: Run test to verify it fails on `nil` candidate level**
- [ ] **Step 3: Implement null-safe comparison in `FitGap::Engine`**

```ruby
# api/app/services/fit_gap/engine.rb
def build_skill_comparisons
  vacancy_skills = @vacancy.vacancy_skills.index_by(&:skill_label)
  portfolio_skills = effective_portfolio_skills

  vacancy_skills.map do |label, vacancy_skill|
    portfolio_skill = find_portfolio_skill(portfolio_skills, label, vacancy_skill.skill_id)
    candidate_level = portfolio_skill&.dig(:effective_level)
    expected_level  = vacancy_skill.expected_level

    if candidate_level.present?
      delta  = candidate_level - expected_level
      result = delta == 0 ? 'match' : (delta > 0 ? 'exceed' : 'gap')
    else
      delta  = nil
      result = 'not_assessed'
    end

    {
      skill_label:     label,
      skill_id:        vacancy_skill.skill_id,
      candidate_level: candidate_level,
      expected_level:  expected_level,
      result:          result,
      delta:           delta,
      confidence:      portfolio_skill&.dig(:confidence),
      is_override:     portfolio_skill&.dig(:overridden) || false
    }
  end
end
```

- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 2: Robust Executive PDF Generator (`Exports::PdfGenerator`)

**Files:**
- Create: `api/spec/services/exports/pdf_generator_spec.rb`
- Modify: `api/app/services/exports/pdf_generator.rb`

**Interfaces:**
- Consumes: `Portfolio`, `Vacancy`
- Produces: Binary PDF string starting with `%PDF-`.

- [ ] **Step 1: Write service spec for `Exports::PdfGenerator`**
- [ ] **Step 2: Implement unassessed level fallback in `PdfGenerator`**
- [ ] **Step 3: Run RSpec to verify clean PDF compilation**
- [ ] **Step 4: Commit**

---

### Task 3: Fit/Gap & PDF Export Request Specs

**Files:**
- Create: `api/spec/requests/api/v1/fitgap_spec.rb`

**Interfaces:**
- Consumes: `POST /api/v1/portfolios/:id/fitgap`, `GET /api/v1/portfolios/:id/export?format=pdf`
- Produces: Proper HTTP responses and application/pdf headers.

- [ ] **Step 1: Write and run request spec**
- [ ] **Step 2: Commit**

---

### Task 4: Revitalize Interactive Fit/Gap UI

**Files:**
- Modify: `web/src/components/fitgap/ComparisonTable.tsx`
- Modify: `web/src/pages/fitgap/FitGapReportPage.tsx`

**Interfaces:**
- Consumes: `FitGapReport`, `SkillComparison`
- Produces: Modern metric cards, styled comparison table with pill badges, and direct PDF/JSON download buttons.

- [ ] **Step 1: Update `ComparisonTable.tsx` and `FitGapReportPage.tsx`**
- [ ] **Step 2: Run `npm run build` to verify clean compilation**
- [ ] **Step 3: Commit**

---

### Task 5: Monozukuri Verification & Full Suite Validation

- [ ] **Step 1: Run complete RSpec suite**
- [ ] **Step 2: Update SDD progress ledger**
