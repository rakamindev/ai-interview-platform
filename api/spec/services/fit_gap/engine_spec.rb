# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:org) { create_organization }
  let(:user) { create_user }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: user.id,
      name: 'Fullstack Engineer',
      time_limit_min: 30
    )
  end
  let(:session) do
    Session.create!(
      tenant_id: org.id,
      assessment_id: assessment.id,
      invite_token: SecureRandom.hex(16),
      status: 'ended'
    )
  end
  let(:portfolio) do
    Portfolio.create!(
      session_id: session.id,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end
  let(:vacancy) do
    Vacancy.create!(
      tenant_id: org.id,
      created_by: user.id,
      role_title: 'Senior Backend Engineer',
      culture_dimensions: 'Ownership and autonomy',
      competency_expectations: 'Strong API and DB skills'
    )
  end

  let!(:v_skill_ruby) do
    VacancySkill.create!(
      vacancy: vacancy,
      skill_id: 'sk-ruby',
      skill_label: 'Ruby on Rails',
      expected_level: 3
    )
  end
  let!(:v_skill_sys) do
    VacancySkill.create!(
      vacancy: vacancy,
      skill_id: 'sk-sys',
      skill_label: 'System Design',
      expected_level: 4
    )
  end
  let!(:v_skill_aws) do
    VacancySkill.create!(
      vacancy: vacancy,
      skill_id: 'sk-aws',
      skill_label: 'AWS Cloud',
      expected_level: 3
    )
  end

  let(:fake_gemini) { instance_double(Gemini::HttpClient) }

  describe 'AC-F1 & AC-F2 & AC-F4: Skill comparisons and backward compatibility' do
    it 'correctly classifies assessed, not_assessed, and not_in_interview skills without falsely marking gaps' do
      # Ruby is assessed at level 3 -> match
      PortfolioSkill.create!(
        portfolio: portfolio,
        skill_id: 'sk-ruby',
        skill_label: 'Ruby on Rails',
        assessment_status: 'assessed',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Proficient Rails dev.'
      )
      # System design was not covered in session -> not_assessed
      PortfolioSkill.create!(
        portfolio: portfolio,
        skill_id: 'sk-sys',
        skill_label: 'System Design',
        assessment_status: 'not_assessed',
        status_reason: 'not_covered',
        ai_level: nil,
        ai_confidence: nil,
        competency_summary: 'Not evaluated.'
      )
      # AWS Cloud is not in portfolio at all -> not_in_interview

      allow(fake_gemini).to receive(:generate_content).and_return({
        'overall_narrative' => 'Strong match for Rails role.',
        'culture_narrative' => 'Good alignment.'
      })

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini)
      report = engine.call

      comparisons = report.skill_comparisons.index_by { |c| c['skill_label'] }

      # Ruby: match (L3 vs required L3)
      ruby_c = comparisons['Ruby on Rails']
      expect(ruby_c['result']).to eq('match')
      expect(ruby_c['candidate_level']).to eq(3)
      expect(ruby_c['delta']).to eq(0)
      expect(ruby_c['required_level']).to eq(3)
      # Backward compatibility: expected_level alias present
      expect(ruby_c['expected_level']).to eq(3)
      expect(ruby_c['level_source']).to eq('ai')
      expect(ruby_c['is_override']).to be(false)

      # System Design: not_assessed (NOT a gap! F-01 fix)
      sys_c = comparisons['System Design']
      expect(sys_c['result']).to eq('not_assessed')
      expect(sys_c['candidate_level']).to be_nil
      expect(sys_c['delta']).to be_nil
      expect(sys_c['reason']).to eq('not_covered')
      expect(sys_c['required_level']).to eq(4)
      expect(sys_c['expected_level']).to eq(4)

      # AWS Cloud: not_in_interview
      aws_c = comparisons['AWS Cloud']
      expect(aws_c['result']).to eq('not_assessed')
      expect(aws_c['reason']).to eq('not_in_interview')
      expect(aws_c['candidate_level']).to be_nil
      expect(aws_c['delta']).to be_nil
    end

    it 'applies assessor override on a not_assessed skill so that it becomes evaluated (AC-F2)' do
      sys_ps = PortfolioSkill.create!(
        portfolio: portfolio,
        skill_id: 'sk-sys',
        skill_label: 'System Design',
        assessment_status: 'not_assessed',
        status_reason: 'not_covered',
        ai_level: nil,
        ai_confidence: nil,
        competency_summary: 'Not evaluated.'
      )

      # Assessor gives manual level 4
      sys_ps.create_assessor_override!(
        ai_level: nil,
        override_level: 4,
        assessor_notes: 'Demonstrated L4 capability in discussion.',
        overridden_by: user.id
      )

      allow(fake_gemini).to receive(:generate_content).and_return({
        'overall_narrative' => 'Good candidate.',
        'culture_narrative' => 'Good fit.'
      })

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini)
      report = engine.call

      comparisons = report.skill_comparisons.index_by { |c| c['skill_label'] }
      sys_c = comparisons['System Design']

      expect(sys_c['result']).to eq('match') # L4 vs req L4
      expect(sys_c['candidate_level']).to eq(4)
      expect(sys_c['is_override']).to be(true)
      expect(sys_c['level_source']).to eq('assessor')
    end

    it 'marks tentative: true for insufficient_evidence skills without override (AC-F3)' do
      PortfolioSkill.create!(
        portfolio: portfolio,
        skill_id: 'sk-ruby',
        skill_label: 'Ruby on Rails',
        assessment_status: 'insufficient_evidence',
        ai_level: 2,
        ai_confidence: 'low',
        competency_summary: 'Limited evidence.'
      )

      allow(fake_gemini).to receive(:generate_content).and_return({
        'overall_narrative' => 'Tentative match.',
        'culture_narrative' => 'Fit.'
      })

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini)
      report = engine.call

      ruby_c = report.skill_comparisons.find { |c| c['skill_label'] == 'Ruby on Rails' }
      expect(ruby_c['tentative']).to be(true)
    end
  end

  describe 'AC-F5: Narrative skipping and failure handling' do
    it 'skips narrative generation if no skills were evaluated (overall_narrative: nil, narrative_status: skipped)' do
      # All vacancy skills are not_assessed
      PortfolioSkill.create!(
        portfolio: portfolio,
        skill_id: 'sk-sys',
        skill_label: 'System Design',
        assessment_status: 'not_assessed',
        status_reason: 'not_covered',
        ai_level: nil,
        ai_confidence: nil,
        competency_summary: 'Not evaluated.'
      )

      # Gemini should never be called to generate a narrative for unassessed candidate!
      expect(fake_gemini).not_to receive(:generate_content)

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini)
      report = engine.call

      expect(report.overall_narrative).to be_nil
      expect(report.culture_narrative).to be_nil
      expect(report.narrative_status).to eq('skipped')
    end

    it 'sets narrative_status: failed and preserves comparisons if model fails' do
      PortfolioSkill.create!(
        portfolio: portfolio,
        skill_id: 'sk-ruby',
        skill_label: 'Ruby on Rails',
        assessment_status: 'assessed',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Strong Rails dev.'
      )

      allow(fake_gemini).to receive(:generate_content).and_raise(Faraday::TimeoutError.new('timeout'))

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini)
      report = engine.call

      expect(report.overall_narrative).to be_nil
      expect(report.narrative_status).to eq('failed')
      expect(report.skill_comparisons.size).to eq(3)
    end
  end
end
