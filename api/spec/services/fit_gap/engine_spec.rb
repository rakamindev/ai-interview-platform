# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let(:org) { create_organization }
  let(:user) { create_user(org) }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      name: "Senior Frontend Engineer",
      time_limit_min: 45,
      created_by: user.id
    )
  end
  let(:session) do
    Session.create!(
      tenant_id: org.id,
      assessment: assessment,
      status: 'ended'
    )
  end
  let(:portfolio) do
    Portfolio.create!(
      session: session,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end
  let(:vacancy) do
    Vacancy.create!(
      tenant_id: org.id,
      role_title: "Tech Lead",
      culture_dimensions: "High ownership, asynchronous clarity",
      competency_expectations: "Architecture scaling and team mentorship",
      created_by: user.id
    )
  end

  let!(:v_skill_react) do
    vacancy.vacancy_skills.create!(
      skill_id: "sk-react",
      skill_label: "React",
      expected_level: 3
    )
  end
  let!(:v_skill_ruby) do
    vacancy.vacancy_skills.create!(
      skill_id: "sk-ruby",
      skill_label: "Ruby on Rails",
      expected_level: 4
    )
  end
  let!(:v_skill_sql) do
    vacancy.vacancy_skills.create!(
      skill_id: "sk-sql",
      skill_label: "PostgreSQL",
      expected_level: 3
    )
  end

  let!(:p_skill_react) do
    portfolio.portfolio_skills.create!(
      skill_id: "sk-react",
      skill_label: "React",
      ai_level: 3,
      ai_confidence: "high",
      competency_summary: "Strong react component patterns",
      evidence: ["Built design system components"]
    )
  end
  let!(:p_skill_ruby) do
    portfolio.portfolio_skills.create!(
      skill_id: "sk-ruby",
      skill_label: "Ruby on Rails",
      ai_level: 2,
      ai_confidence: "medium",
      competency_summary: "Basic Rails MVC experience",
      evidence: ["Worked on API controllers"]
    )
  end

  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  before do
    allow(mock_gemini).to receive(:generate_content).and_return({
      "culture_narrative" => "Candidate demonstrates strong alignment with team autonomy.",
      "overall_narrative" => "Recommended for frontend-heavy scope with backend pair programming."
    }.to_json)
  end

  describe "#call" do
    it "computes correct comparisons and satisfies frontend contract (both required_level and expected_level)" do
      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      expect(report).to be_persisted
      comparisons = report.skill_comparisons.index_by { |c| c['skill_label'] }

      # React: candidate 3 vs expected 3 => match
      react_comp = comparisons['React']
      expect(react_comp['result']).to eq('match')
      expect(react_comp['delta']).to eq(0)
      expect(react_comp['expected_level']).to eq(3)
      expect(react_comp['required_level']).to eq(3)
      expect(react_comp['candidate_level']).to eq(3)
      expect(react_comp['is_override']).to be(false)

      # Ruby: candidate 2 vs expected 4 => gap (-2)
      ruby_comp = comparisons['Ruby on Rails']
      expect(ruby_comp['result']).to eq('gap')
      expect(ruby_comp['delta']).to eq(-2)
      expect(ruby_comp['expected_level']).to eq(4)
      expect(ruby_comp['required_level']).to eq(4)
      expect(ruby_comp['candidate_level']).to eq(2)

      # PostgreSQL: not in portfolio => not_assessed
      sql_comp = comparisons['PostgreSQL']
      expect(sql_comp['result']).to eq('not_assessed')
      expect(sql_comp['candidate_level']).to be_nil
      expect(sql_comp['expected_level']).to eq(3)
      expect(sql_comp['required_level']).to eq(3)
    end

    it "accurately incorporates human assessor overrides into comparison results" do
      # Human assessor overrides Ruby from L2 to L4
      p_skill_ruby.create_assessor_override!(
        ai_level: 2,
        override_level: 4,
        assessor_notes: "Candidate demonstrated deep Metaprogramming knowledge in follow-up probe",
        overridden_by: user.id
      )

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      comparisons = report.skill_comparisons.index_by { |c| c['skill_label'] }
      ruby_comp = comparisons['Ruby on Rails']

      expect(ruby_comp['is_override']).to be(true)
      expect(ruby_comp['candidate_level']).to eq(4)
      expect(ruby_comp['ai_level']).to eq(2)
      expect(ruby_comp['override_level']).to eq(4)
      expect(ruby_comp['assessor_notes']).to include("Metaprogramming")
      expect(ruby_comp['result']).to eq('match')
      expect(ruby_comp['delta']).to eq(0)
    end

    it "handles Gemini AI client failures gracefully with a reliable fallback narrative" do
      allow(mock_gemini).to receive(:generate_content).and_raise(StandardError.new("Gemini API timeout"))

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to include("Candidate shows")
      expect(report.overall_narrative).to include("gaps")
    end
  end
end
