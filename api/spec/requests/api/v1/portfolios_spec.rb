# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio fit/gap history', type: :request do
  it 'includes analyzed vacancies and their comparison results' do
    organization = create_organization
    assessment = create_assessment(organization)
    session = create_interview_session(assessment, status: 'ended', end_reason: 'manual_candidate')
    portfolio = session.create_portfolio!(generation_status: 'complete', generated_at: Time.current)
    vacancy = within_tenant(organization) do
      Vacancy.create!(tenant_id: organization.id, created_by: 1, role_title: 'Senior Backend Engineer')
    end
    report = FitGapReport.create!(
      portfolio: portfolio,
      vacancy: vacancy,
      skill_comparisons: [
        { skill_label: 'Ruby', required_level: 3, candidate_level: 3, result: 'match' },
        { skill_label: 'SQL', required_level: 3, candidate_level: 2, result: 'gap' }
      ],
      culture_narrative: 'Aligned',
      overall_narrative: 'One focused gap'
    )

    get "/api/v1/sessions/#{session.id}/portfolio", headers: assessor_headers(organization)

    expect(response).to have_http_status(:ok)
    history = response_json.dig('portfolio', 'fit_gap_reports')
    expect(history.length).to eq(1)
    expect(history.first).to include(
      'id' => report.id,
      'vacancy_id' => vacancy.id,
      'vacancy_title' => 'Senior Backend Engineer'
    )
    expect(history.first.fetch('skill_comparisons').map { |comparison| comparison.fetch('result') })
      .to contain_exactly('match', 'gap')
  end
end
