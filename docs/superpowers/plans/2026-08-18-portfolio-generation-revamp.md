# Portfolio Generation & LLM Scoring Revamp (Stage 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Portfolio Generation & Scoring pipeline into a resilient system that cleanly handles markdown-fenced LLM outputs, prevents unassessed skills from being penalized as Level 1, maintains assessor override integrity with fit/gap auto-invalidation, and provides clear, evidence-backed UI presentation.

**Architecture:** Enhances Rails `Portfolios::Generator` with regex-based JSON extraction, refactors level parsing to preserve `nil` for unassessed competencies, Hardens `PortfolioSkillsController#override`, and updates React portfolio components to display unassessed states clearly.

**Tech Stack:** Ruby on Rails 7, PostgreSQL, Sidekiq, Gemini Pro LLM, RSpec, React 18, TypeScript, Tailwind CSS, Lucide React.

**Spec:** `docs/superpowers/specs/2026-08-18-portfolio-generation-revamp-design.md`

## Global Constraints
- Target branch is `feature/monozukuri-revamp`.
- Unassessed skills must never be forced to Level 1 (`clamp(1, 5)`); their level must remain `nil`.
- All LLM JSON responses, including those wrapped in ` ```json ... ``` ` markdown blocks or surrounded by narrative text, must parse cleanly.
- RSpec tests must achieve 100% pass rate before marking tasks complete.

---

### Task 1: Resilient JSON Parsing & Level Preservation in `Portfolios::Generator`

**Files:**
- Create: `api/spec/services/portfolios/generator_spec.rb`
- Modify: `api/app/services/portfolios/generator.rb:150-180`

**Interfaces:**
- Consumes: `Session`, `Gemini::HttpClient`, `AssessmentSkill`, `CoverageMap`, `TranscriptTurn`
- Produces: `Portfolio` with accurately scored `portfolio_skills`, preserving `nil` for unassessed skills without throwing JSON parse exceptions.

- [ ] **Step 1: Write failing service spec for `Portfolios::Generator`**

```ruby
# api/spec/services/portfolios/generator_spec.rb
require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let!(:org) do
    Organization.find_by(scheme: 'test-corp') || Organization.create!(
      name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp-id', host: 'localhost'
    )
  end
  let!(:user) { User.create!(email: "assessor3@test.com", password_digest: BCrypt::Password.create("secret123"), role: "admin") }
  let!(:assessment) do
    a = Assessment.create!(name: "Frontend Specialist", tenant_id: org.id, created_by: user.id, time_limit_min: 30)
    a.assessment_skills.create!(
      skill_id: "sk-fe-001", skill_label: "React Hooks",
      l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5"
    )
    a.assessment_skills.create!(
      skill_id: "sk-fe-002", skill_label: "State Management",
      l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5"
    )
    a
  end
  let!(:session) do
    s = Session.create!(assessment: assessment, tenant_id: org.id, started_at: 20.minutes.ago, status: 'active')
    s.transcript_turns.create!(speaker: 'ai', text: 'Tell me about React hooks.')
    s.transcript_turns.create!(speaker: 'candidate', text: 'I use useEffect and custom hooks for API calls.')
    s
  end

  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  context "when Gemini returns markdown-fenced JSON with unassessed skills" do
    let(:raw_gemini_response) do
      <<~JSON
        Here is the evaluation of the candidate:
        ```json
        {
          "configured_skills": [
            {
              "skill_id": "sk-fe-001",
              "skill_label": "React Hooks",
              "level": 3,
              "confidence": "high",
              "evidence": ["I use useEffect and custom hooks for API calls."],
              "competency_summary": "Demonstrates solid understanding of hook lifecycle."
            },
            {
              "skill_id": "sk-fe-002",
              "skill_label": "State Management",
              "level": null,
              "confidence": "low",
              "evidence": [],
              "competency_summary": "Skill was not explored in the interview."
            }
          ],
          "discovered_skills": [
            {
              "skill_label": "API Optimization",
              "level": 2,
              "confidence": "medium",
              "evidence": ["Custom hooks for API calls."],
              "competency_summary": "Understands request encapsulation."
            }
          ]
        }
        ```
        Hope this helps!
      JSON
    end

    before do
      allow(mock_gemini).to receive(:generate_content).and_return(raw_gemini_response)
    end

    it "successfully parses markdown-fenced JSON and preserves nil for unassessed skills" do
      generator = described_class.new(session: session, gemini_client: mock_gemini)
      portfolio = generator.call

      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.count).to eq(3)

      react_skill = portfolio.portfolio_skills.find_by(skill_id: "sk-fe-001")
      expect(react_skill.ai_level).to eq(3)
      expect(react_skill.ai_confidence).to eq("high")
      expect(react_skill.evidence_quotes).to include("I use useEffect and custom hooks for API calls.")

      unassessed_skill = portfolio.portfolio_skills.find_by(skill_id: "sk-fe-002")
      expect(unassessed_skill.ai_level).to be_nil
      expect(unassessed_skill.ai_confidence).to eq("low")

      discovered_skill = portfolio.portfolio_skills.find_by(is_discovered: true)
      expect(discovered_skill.skill_label).to eq("API Optimization")
      expect(discovered_skill.ai_level).to eq(2)
    end
  end
end
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement JSON extraction and nil level preservation in `Portfolios::Generator`**

```ruby
# api/app/services/portfolios/generator.rb
def save_skills(portfolio, response)
  data = parse_json_response(response)

  # Destroy existing skills (idempotent regeneration)
  portfolio.portfolio_skills.destroy_all

  (data['configured_skills'] || []).each do |skill_data|
    level = parse_skill_level(skill_data['level'])

    portfolio.portfolio_skills.create!(
      skill_id:           skill_data['skill_id'],
      skill_label:        skill_data['skill_label'],
      is_discovered:      false,
      ai_level:           level,
      ai_confidence:      skill_data['confidence']&.to_s&.downcase.presence,
      evidence:           Array(skill_data['evidence']).first(3),
      competency_summary: skill_data['competency_summary']
    )
  end

  (data['discovered_skills'] || []).each do |skill_data|
    level = parse_skill_level(skill_data['level'])

    portfolio.portfolio_skills.create!(
      skill_id:           nil,
      skill_label:        skill_data['skill_label'],
      is_discovered:      true,
      ai_level:           level,
      ai_confidence:      skill_data['confidence']&.to_s&.downcase.presence,
      evidence:           Array(skill_data['evidence']).first(3),
      competency_summary: skill_data['competency_summary']
    )
  end
end

def parse_json_response(response)
  return response if response.is_a?(Hash)

  clean_text = response.to_s.strip
  # Extract content inside markdown code fence if present
  if clean_text =~ /```(?:json)?\s*([\s\S]*?)\s*```/m
    clean_text = $1.strip
  elsif clean_text =~ /\{[\s\S]*\}/m
    clean_text = clean_text[/\{[\s\S]*\}/m]
  end

  JSON.parse(clean_text)
end

def parse_skill_level(level_value)
  return nil if level_value.nil? || level_value == 0 || level_value == "0" || level_value.to_s.strip.empty?

  level_int = level_value.to_i
  level_int.between?(1, 5) ? level_int : nil
end
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add api/app/services/portfolios/generator.rb api/spec/services/portfolios/generator_spec.rb
git commit -m "feat(api): harden Gemini JSON extraction and preserve nil for unassessed skills"
```

---

### Task 2: Request Specs for Portfolios & Assessor Overrides

**Files:**
- Create: `api/spec/requests/api/v1/portfolios_spec.rb`

**Interfaces:**
- Consumes: `GET /api/v1/sessions/:id/portfolio`, `POST /api/v1/portfolio_skills/:id/override`
- Produces: Correct JSON responses and status codes.

- [ ] **Step 1: Write request spec for Portfolios & Overrides**
- [ ] **Step 2: Run RSpec suite**
- [ ] **Step 3: Commit**

---

### Task 3: Revitalize Frontend Competency Display & Level Badges

**Files:**
- Modify: `web/src/utils/constants.ts`
- Modify: `web/src/components/portfolio/LevelBadge.tsx`
- Modify: `web/src/components/portfolio/SkillPortfolioCard.tsx`
- Modify: `web/src/pages/portfolio/PortfolioPage.tsx`

**Interfaces:**
- Consumes: `PortfolioSkill` with `ai_level: number | null`
- Produces: Accessible level badges distinguishing L1..L5 from unassessed/nil skills.

- [ ] **Step 1: Update `parseLevel` and `LevelBadge` to handle `null` unassessed skills**
- [ ] **Step 2: Update `SkillPortfolioCard` and `PortfolioPage` with modern styling**
- [ ] **Step 3: Run `npm run build` to verify clean compilation**
- [ ] **Step 4: Commit**

---

### Task 4: Seeded Fault Test & Monozukuri Verification

- [ ] **Step 1: Inject dirty response and verify generator parses without error**
- [ ] **Step 2: Verify full test suite passes with 0 failures**
- [ ] **Step 3: Update progress ledger**
