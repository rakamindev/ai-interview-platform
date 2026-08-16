# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let!(:org) do
    Organization.create!(
      name: 'Tenant A',
      scheme: 'tenant-a',
      identifier: 'tenant-a',
      host: 'tenant-a.com'
    )
  end

  let!(:assessment) { Assessment.create!(tenant_id: org.id, name: 'Assess A', time_limit_min: 30, created_by: 101) }
  let!(:vacancy) { Vacancy.create!(tenant_id: org.id, role_title: 'Developer', created_by: 101) }
  let!(:vacancy_skill) do
    VacancySkill.create!(
      vacancy: vacancy,
      skill_id: 'sys-design',
      skill_label: 'System Design',
      expected_level: 3
    )
  end

  let(:gemini_client) { double('GeminiClient') }

  before do
    allow(gemini_client).to receive(:generate_content).and_return(
      {
        'culture_narrative' => 'Good alignment.',
        'overall_narrative' => 'Qualified candidate.'
      }.to_json
    )
  end

  context 'when session completed normally but a skill has no evaluation' do
    let!(:session) do
      Session.create!(
        tenant_id: org.id,
        assessment: assessment,
        invite_token: 'token-completed',
        status: 'ended',
        end_reason: 'manual_candidate'
      )
    end
    let!(:portfolio) { Portfolio.create!(session: session, generation_status: 'complete') }

    it 'marks the missing skill comparison as not_assessed' do
      engine = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client)
      report = engine.call

      comparison = report.skill_comparisons.find { |c| c['skill_id'] == 'sys-design' }
      expect(comparison).not_to be_nil
      expect(comparison['result']).to eq('not_assessed')
      expect(comparison['candidate_level']).to be_nil
    end
  end

  context 'when session failed due to technical error' do
    let!(:session) do
      Session.create!(
        tenant_id: org.id,
        assessment: assessment,
        invite_token: 'token-error',
        status: 'ended',
        end_reason: 'error'
      )
    end
    let!(:portfolio) { Portfolio.create!(session: session, generation_status: 'complete') }

    it 'marks the missing skill comparison as system_error dynamically' do
      engine = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client)
      report = engine.call

      comparison = report.skill_comparisons.find { |c| c['skill_id'] == 'sys-design' }
      expect(comparison).not_to be_nil
      expect(comparison['result']).to eq('system_error')
      expect(comparison['candidate_level']).to be_nil
    end
  end
end
