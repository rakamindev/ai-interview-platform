# frozen_string_literal: true

require 'spec_helper'

RSpec.describe 'Portfolio export', type: :request do
  let!(:tenant) { create_tenant(scheme: 'export-a') }
  let!(:assessment) { create_assessment(tenant, name: 'Frontend Developer') }
  let!(:session) do
    Session.create!(
      assessment:     assessment,
      tenant_id:      tenant.id,
      candidate_name: 'Budi Santoso',
      started_at:     1.hour.ago,
      duration_seconds: 754
    )
  end
  let!(:portfolio) do
    Portfolio.create!(session: session, generation_status: 'complete', generated_at: Time.current)
  end
  let!(:skill) do
    portfolio.portfolio_skills.create!(
      skill_label:        'React / Frontend Core',
      ai_level:           3,
      ai_confidence:      'high',
      evidence:           ['Saya pakai React dan Next.js 🙂 untuk dashboard internal'],
      competency_summary: 'Ships features independently, reviews peers => solid L3.'
    )
  end
  let!(:override) do
    skill.create_assessor_override!(
      ai_level:       3,
      override_level: 4,
      assessor_notes: 'Naikkan ke L4 — memimpin migrasi 🙂',
      overridden_by:  1
    )
  end
  let!(:vacancy) do
    Vacancy.create!(
      tenant_id:  tenant.id,
      created_by: 1,
      role_title: 'Senior Frontend 🙂',
      status:     'active'
    )
  end
  let!(:report) do
    FitGapReport.create!(
      portfolio:          portfolio,
      vacancy:            vacancy,
      skill_comparisons:  [{
        'skill_label' => 'React / Frontend Core', 'expected_level' => 4,
        'candidate_level' => 4, 'result' => 'match', 'delta' => 0
      }],
      culture_narrative:  'Cocok dengan budaya tim 🙂',
      overall_narrative:  'Rekomendasi: lanjut ke tahap berikutnya.',
      generated_at:       Time.current,
      vacancy_updated_at: vacancy.updated_at
    )
  end

  let(:headers) { auth_headers(scheme: tenant.scheme) }

  it 'renders a PDF with non-WinAnsi characters instead of failing' do
    get "/api/v1/portfolios/#{portfolio.id}/export",
        params: { format: 'pdf', vacancy_id: vacancy.id }, headers: headers

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq('application/pdf')
    expect(response.body).to start_with('%PDF')
    expect(response.headers['Content-Disposition']).to include("portfolio-budi-santoso-#{portfolio.id}.pdf")
  end

  it 'includes the candidate name in the JSON export' do
    get "/api/v1/portfolios/#{portfolio.id}/export",
        params: { format: 'json' }, headers: headers

    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body['candidate_name']).to eq('Budi Santoso')
    expect(body['portfolio']['skills'].first['skill_label']).to eq('React / Frontend Core')
    expect(response.headers['Content-Disposition']).to include("portfolio-budi-santoso-#{portfolio.id}.json")
  end

  it 'refuses to export a Fit/Gap report after vacancy requirements change' do
    vacancy.update!(role_title: 'Updated Frontend role')

    get "/api/v1/portfolios/#{portfolio.id}/export",
        params: { format: 'json', vacancy_id: vacancy.id }, headers: headers

    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('errors', 0, 'message')).to include('stale')
  end
end
