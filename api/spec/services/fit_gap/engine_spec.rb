# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:assessment) do
    Assessment.create!(name: 'Product Assessment', time_limit_min: 30, language: 'en', created_by: 1)
  end

  let(:session) do
    Session.create!(assessment: assessment, status: 'ended')
  end

  let(:portfolio) do
    Portfolio.create!(session: session, generation_status: 'complete')
  end

  let(:vacancy) do
    Vacancy.create!(role_title: 'Fullstack Engineer', created_by: 1)
  end

  let(:mock_gemini_client) do
    instance_double(
      Gemini::HttpClient,
      generate_content: {
        'culture_narrative' => 'Good cultural alignment.',
        'overall_narrative' => 'Recommended candidate.'
      }
    )
  end

  before do
    Current.tenant_id = 1
  end

  after do
    Current.tenant_id = nil
  end

  describe '#call' do
    it 'correctly classifies match, exceed, gap, and not_assessed skill comparisons' do
      # 1. Match: expected 3, candidate 3
      vacancy.vacancy_skills.create!(skill_label: 'Ruby on Rails', expected_level: 3)
      portfolio.portfolio_skills.create!(
        skill_label: 'Ruby on Rails',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Strong Rails experience'
      )

      # 2. Exceed: expected 2, candidate 4
      vacancy.vacancy_skills.create!(skill_label: 'PostgreSQL', expected_level: 2)
      portfolio.portfolio_skills.create!(
        skill_label: 'PostgreSQL',
        ai_level: 4,
        ai_confidence: 'high',
        competency_summary: 'Advanced query tuning'
      )

      # 3. Gap: expected 4, candidate 2
      vacancy.vacancy_skills.create!(skill_label: 'System Design', expected_level: 4)
      portfolio.portfolio_skills.create!(
        skill_label: 'System Design',
        ai_level: 2,
        ai_confidence: 'medium',
        competency_summary: 'Basic architectural knowledge'
      )

      # 4. Not Assessed: expected 3, candidate was not tested on this skill
      vacancy.vacancy_skills.create!(skill_label: 'DevOps & Docker', expected_level: 3)

      engine = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: mock_gemini_client
      )

      report = engine.call
      comparisons = report.skill_comparisons.index_by { |c| c['skill_label'] }

      expect(comparisons['Ruby on Rails']['result']).to eq('match')
      expect(comparisons['Ruby on Rails']['delta']).to eq(0)

      expect(comparisons['PostgreSQL']['result']).to eq('exceed')
      expect(comparisons['PostgreSQL']['delta']).to eq(2)

      expect(comparisons['System Design']['result']).to eq('gap')
      expect(comparisons['System Design']['delta']).to eq(-2)

      expect(comparisons['DevOps & Docker']['result']).to eq('not_assessed')
      expect(comparisons['DevOps & Docker']['candidate_level']).to be_nil
    end

    it 'applies assessor overrides over AI level when calculating fit/gap' do
      vacancy.vacancy_skills.create!(skill_label: 'React', expected_level: 4)
      skill = portfolio.portfolio_skills.create!(
        skill_label: 'React',
        ai_level: 2, # AI gave 2 (gap)
        ai_confidence: 'medium',
        competency_summary: 'Decent React skills'
      )

      # Human Assessor overrides to 4 (match)
      AssessorOverride.create!(
        portfolio_skill: skill,
        ai_level: 2,
        override_level: 4,
        overridden_by: 1,
        assessor_notes: 'Candidate showed strong React architecture in portfolio project'
      )

      engine = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: mock_gemini_client
      )

      report = engine.call
      comparisons = report.skill_comparisons.index_by { |c| c['skill_label'] }

      expect(comparisons['React']['candidate_level']).to eq(4)
      expect(comparisons['React']['result']).to eq('match')
      expect(comparisons['React']['delta']).to eq(0)
      expect(comparisons['React']['expected_level']).to eq(4)
      expect(comparisons['React']['required_level']).to eq(4)
    end

    it 'handles vacancy with no skills gracefully without validation errors' do
      empty_vacancy = Vacancy.create!(role_title: 'General Specialist', created_by: 1)

      engine = described_class.new(
        portfolio: portfolio,
        vacancy: empty_vacancy,
        gemini_client: mock_gemini_client
      )

      report = engine.call
      expect(report).to be_persisted
      expect(report.skill_comparisons).to eq([])
      expect(report.overall_narrative).to include('no required skills configured')
    end
  end
end
