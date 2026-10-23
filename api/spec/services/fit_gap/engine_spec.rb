# frozen_string_literal: true

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
      tenant_id: org.id,
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

      sys_comp = report.skill_comparisons.find { |c| c['skill_label'] == 'System Design' }
      expect(sys_comp['result']).to eq('not_assessed')

      expect(report.culture_narrative).to include("high autonomy")
      expect(report.overall_narrative).to include("Senior Fullstack Lead")
    end
  end

  context "when Gemini fails" do
    before do
      allow(mock_gemini).to receive(:generate_content).and_raise(StandardError.new("Service timeout"))
    end

    it "falls back gracefully to rule-based summary without crashing" do
      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      expect(report).to be_persisted
      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to include("Candidate shows")
    end

    it "reports unassessed skills separately instead of counting them as gaps" do
      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini).call

      expect(report.overall_narrative).to include("1 skill matches")
      expect(report.overall_narrative).to include("0 gaps")
      expect(report.overall_narrative).to include("2 required skill(s) were not assessed")
    end
  end

  context "when an assessor overrides an AI level" do
    before do
      allow(mock_gemini).to receive(:generate_content).and_raise(StandardError.new("Service timeout"))
      rails_skill = portfolio.portfolio_skills.find_by(skill_id: "sk-01")
      AssessorOverride.create!(portfolio_skill: rails_skill, ai_level: 4, override_level: 2, overridden_by: user.id, assessor_notes: "Answers were memorised, not applied.")
    end

    it "uses the override level for the delta and flags the comparison" do
      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini).call

      rails_comp = report.skill_comparisons.find { |c| c['skill_label'] == 'Ruby on Rails' }
      expect(rails_comp['candidate_level']).to eq(2)
      expect(rails_comp['result']).to eq('gap')
      expect(rails_comp['delta']).to eq(-1)
      expect(rails_comp['is_override']).to be(true)
    end
  end
end
