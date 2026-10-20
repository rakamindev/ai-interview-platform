# frozen_string_literal: true

require 'spec_helper'

RSpec.describe FitGap::Engine do
  let!(:tenant) { create_tenant(scheme: 'fit-gap-a') }
  let!(:assessment) { create_assessment(tenant, name: 'Engineer') }
  let!(:session) { Session.create!(assessment: assessment, tenant_id: tenant.id) }
  let!(:portfolio) { Portfolio.create!(session: session, generation_status: 'complete', generated_at: Time.current) }
  let!(:vacancy) do
    Vacancy.create!(tenant_id: tenant.id, created_by: 1, role_title: 'Engineer', status: 'active')
  end
  let(:client) do
    instance_double(Gemini::HttpClient, generate_content: {
      'culture_narrative' => 'Relevant experience.',
      'overall_narrative' => 'Review with the full interview.'
    })
  end

  it 'compares expected, overridden, and unassessed levels and stores report freshness' do
    skill = portfolio.portfolio_skills.create!(
      skill_id: 'ruby', skill_label: 'Ruby', ai_level: 3, ai_confidence: 'high',
      competency_summary: 'Uses Ruby in production.'
    )
    skill.create_assessor_override!(ai_level: 3, override_level: 4, overridden_by: 1)
    vacancy.vacancy_skills.create!(skill_id: 'ruby', skill_label: 'Ruby', expected_level: 3)
    vacancy.vacancy_skills.create!(skill_id: 'sql', skill_label: 'SQL', expected_level: 2)

    report = described_class.new(portfolio:, vacancy:, gemini_client: client).call

    expect(report.skill_comparisons).to contain_exactly(
      include('skill_label' => 'Ruby', 'candidate_level' => 4, 'expected_level' => 3, 'result' => 'exceed', 'is_override' => true),
      include('skill_label' => 'SQL', 'candidate_level' => nil, 'expected_level' => 2, 'result' => 'not_assessed')
    )
    expect(report).to have_attributes(narrative_status: 'generated', vacancy_updated_at: vacancy.updated_at)
  end

  it 'marks a timed-out model narrative as fallback instead of presenting it as generated' do
    vacancy.vacancy_skills.create!(skill_label: 'Ruby', expected_level: 3)
    allow(client).to receive(:generate_content).and_raise(Timeout::Error)

    report = described_class.new(portfolio:, vacancy:, gemini_client: client).call

    expect(report).to have_attributes(narrative_status: 'fallback', culture_narrative: nil)
    expect(report.overall_narrative).to include('0 skill matches, 0 exceeds, and 0 gaps')
  end

  it 'marks malformed model JSON as fallback' do
    vacancy.vacancy_skills.create!(skill_label: 'Ruby', expected_level: 3)
    allow(client).to receive(:generate_content).and_return('{"culture_narrative":')

    report = described_class.new(portfolio:, vacancy:, gemini_client: client).call

    expect(report).to have_attributes(narrative_status: 'fallback', culture_narrative: nil)
    expect(report.overall_narrative).to include('0 skill matches, 0 exceeds, and 0 gaps')
  end
end
