# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  class SuccessfulNarrativeClient
    def generate_content(*)
      {
        'culture_narrative' => 'Kandidat menunjukkan pola kolaborasi yang relevan.',
        'overall_narrative' => 'Kandidat layak dipertimbangkan untuk tahap berikutnya.'
      }
    end
  end

  class FailingNarrativeClient
    def generate_content(*)
      raise Faraday::TimeoutError, 'simulated timeout'
    end
  end

  let!(:organization) do
    Organization.create!(
      name: 'Acme Indonesia',
      scheme: 'fitgap-test',
      identifier: 'fitgap-test',
      host: 'fitgap-test.local'
    )
  end
  let!(:user) do
    User.create!(email: 'fitgap@example.test', password: 'password123', role: 'admin')
  end
  let!(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: user.id,
      name: 'Fullstack Engineer',
      time_limit_min: 30,
      language: 'id'
    )
  end
  let!(:session) do
    Session.create!(tenant_id: organization.id, assessment: assessment, status: 'ended')
  end
  let!(:portfolio) do
    Portfolio.create!(session: session, generation_status: 'complete')
  end
  let!(:vacancy) do
    Vacancy.create!(
      tenant_id: organization.id,
      created_by: user.id,
      role_title: 'Fullstack Product Engineer'
    )
  end

  before do
    Current.organization = organization
    Current.tenant_id = organization.id

    PortfolioSkill.create!(
      portfolio: portfolio,
      skill_id: 'react',
      skill_label: 'React',
      ai_level: 3,
      ai_confidence: 'high',
      evidence: ['Menjelaskan trade-off state management.'],
      competency_summary: 'Mampu menjelaskan keputusan implementasi.'
    )
    VacancySkill.create!(
      vacancy: vacancy,
      skill_id: 'react',
      skill_label: 'React',
      expected_level: 3
    )
  end

  it 'menandai narasi yang berhasil dibuat model sebagai AI' do
    report = described_class.new(
      portfolio: portfolio,
      vacancy: vacancy,
      gemini_client: SuccessfulNarrativeClient.new
    ).call

    expect(report.narrative_source).to eq('ai')
    expect(report.culture_narrative).to be_present
    expect(report.overall_narrative).to include('tahap berikutnya')
  end

  it 'menandai ringkasan deterministik sebagai fallback ketika model timeout' do
    report = described_class.new(
      portfolio: portfolio,
      vacancy: vacancy,
      gemini_client: FailingNarrativeClient.new
    ).call

    expect(report.narrative_source).to eq('rule_based_fallback')
    expect(report.culture_narrative).to be_nil
    expect(report.overall_narrative).to eq(
      'Candidate shows 1 skill matches, 0 exceeds, and 0 gaps against role requirements.'
    )
  end
end
