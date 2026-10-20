# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapReport, type: :model do
  let(:org) { create_organization }
  let(:user) { create_user }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: user.id,
      name: 'Software Engineer Assessment',
      time_limit_min: 10
    )
  end

  let(:session) do
    Session.create!(
      tenant_id: org.id,
      assessment_id: assessment.id,
      candidate_name: 'cand-fp-1',
      invite_token: SecureRandom.hex(16),
      status: 'ended',
      duration_seconds: 300
    )
  end

  let(:portfolio) do
    Portfolio.create!(
      session_id: session.id,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end

  let!(:portfolio_skill) do
    portfolio.portfolio_skills.create!(
      skill_id: 'sk-1',
      skill_label: 'Backend Development',
      assessment_status: 'assessed',
      ai_level: 3,
      ai_confidence: 'medium',
      competency_summary: 'Solid backend skills.'
    )
  end

  let(:vacancy) do
    v = Vacancy.create!(
      tenant_id: org.id,
      created_by: user.id,
      role_title: 'Backend Engineer',
      culture_dimensions: 'Collaborative',
      competency_expectations: 'Design clean APIs'
    )
    v.vacancy_skills.create!(skill_label: 'Backend Development', expected_level: 3)
    v
  end

  describe 'AC-D6 & AC-F6: source_fingerprint and stale detection' do
    it 'calculates consistent source_fingerprint and reports stale: false when matching' do
      fp = described_class.calculate_source_fingerprint(portfolio: portfolio, vacancy: vacancy)
      expect(fp).to be_present

      report = described_class.create!(
        portfolio_id: portfolio.id,
        vacancy_id: vacancy.id,
        skill_comparisons: [{ 'skill_label' => 'Backend Development', 'result' => 'match' }],
        source_fingerprint: fp,
        narrative_status: 'generated'
      )

      expect(report.stale?).to be(false)
    end

    it 'detects report as stale when an assessor override is added or updated' do
      fp = described_class.calculate_source_fingerprint(portfolio: portfolio, vacancy: vacancy)
      report = described_class.create!(
        portfolio_id: portfolio.id,
        vacancy_id: vacancy.id,
        skill_comparisons: [{ 'skill_label' => 'Backend Development', 'result' => 'match' }],
        source_fingerprint: fp
      )

      expect(report.stale?).to be(false)

      # Assessor adds override
      portfolio_skill.create_assessor_override!(
        override_level: 4,
        overridden_by: user.id,
        assessor_notes: 'Demonstrated superior depth in external review.'
      )

      portfolio.reload
      expect(report.stale?).to be(true)
    end

    it 'detects report as stale when portfolio is regenerated with a new timestamp' do
      fp = described_class.calculate_source_fingerprint(portfolio: portfolio, vacancy: vacancy)
      report = described_class.create!(
        portfolio_id: portfolio.id,
        vacancy_id: vacancy.id,
        skill_comparisons: [{ 'skill_label' => 'Backend Development', 'result' => 'match' }],
        source_fingerprint: fp
      )

      portfolio.update!(generated_at: Time.current + 1.minute)
      expect(report.stale?).to be(true)
    end

    it 'detects report as stale when vacancy or vacancy skills are updated' do
      fp = described_class.calculate_source_fingerprint(portfolio: portfolio, vacancy: vacancy)
      report = described_class.create!(
        portfolio_id: portfolio.id,
        vacancy_id: vacancy.id,
        skill_comparisons: [{ 'skill_label' => 'Backend Development', 'result' => 'match' }],
        source_fingerprint: fp
      )

      vacancy.vacancy_skills.first.update!(expected_level: 4)
      expect(report.stale?).to be(true)
    end

    it 'treats reports with blank source_fingerprint as stale' do
      report = described_class.create!(
        portfolio_id: portfolio.id,
        vacancy_id: vacancy.id,
        skill_comparisons: [{ 'skill_label' => 'Backend Development', 'result' => 'match' }],
        source_fingerprint: nil
      )

      expect(report.stale?).to be(true)
    end
  end
end
