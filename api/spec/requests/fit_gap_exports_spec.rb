# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Fit-gap exports', type: :request do
  let(:org) do
    Organization.create!(
      name: 'Export Corp', scheme: 'fit-gap-export', identifier: 'fit-gap-export', host: 'fit-gap-export.test'
    )
  end
  let!(:user) do
    User.create!(
      organization: org,
      email: 'fit-gap-export@example.test',
      role: 'admin',
      password: 'password123',
      password_confirmation: 'password123'
    )
  end
  let(:token) { JsonWebToken.encode(user_id: user.id, role: user.role, scheme: org.scheme) }
  let(:headers) { { 'Authorization' => "Bearer #{token}" } }

  let!(:context) do
    Current.using(tenant_id: org.id) do
      assessment = Assessment.create!(name: 'Export Assessment', created_by: user.id, time_limit_min: 30)
      session = Session.create!(assessment:, candidate_name: 'Candidate', status: 'ended', duration_seconds: 600)
      portfolio = Portfolio.create!(session:, generation_status: 'complete')
      skill = portfolio.portfolio_skills.create!(
        skill_id: 'react', skill_label: 'React', ai_level: 2, ai_confidence: 'high',
        evidence: [{
          'turn_id' => 42,
          'turn_number' => 6,
          'quote' => 'Canonical candidate evidence',
          'verification_status' => 'verified'
        }], competency_summary: 'Summary'
      )
      skill.create_assessor_override!(
        ai_level: 2, override_level: 3, overridden_by: user.id, overridden_at: Time.current
      )
      vacancy = Vacancy.create!(
        role_title: 'Frontend Engineer', created_by: user.id,
        vacancy_skills_attributes: [{ skill_id: 'react', skill_label: 'React', expected_level: 4 }]
      )
      fingerprint = FitGap::SourceFingerprint.call(portfolio:, vacancy:).fingerprint
      report = FitGapReport.create!(
        portfolio:, vacancy:, generated_at: Time.current,
        source_fingerprint: fingerprint, requested_fingerprint: fingerprint,
        generation_status: 'complete', overall_narrative: 'Result',
        skill_comparisons: [{
          skill_id: 'react', skill_label: 'React', expected_level: 4, candidate_level: 3,
          ai_level: 2, rating_source: 'assessor_override', result: 'gap', delta: -1, confidence: 'high'
        }]
      )
      { portfolio:, vacancy:, report: }
    end
  end

  def export_json(params = {})
    get "/api/v1/portfolios/#{context[:portfolio].id}/export",
        params: { format: 'json', vacancy_id: context[:vacancy].id }.merge(params),
        headers: headers
  end

  it 'exports current provenance and freshness' do
    export_json

    expect(response).to have_http_status(:ok), response.body
    json = JSON.parse(response.body)
    expect(json['stale_export']).to be(false)
    expect(json.dig('fit_gap_report', 'freshness')).to eq('current')
    expect(json.dig('fit_gap_report', 'skill_comparisons', 0, 'rating_source')).to eq('assessor_override')
    expect(json.dig('portfolio', 'skills', 0, 'evidence', 0, 'verification_status')).to eq('verified')
    expect(json.dig('portfolio', 'skills', 0, 'evidence', 0, 'turn_number')).to eq(6)
    expect(json.dig('portfolio', 'skills', 0, 'evidence_status')).to eq('verified')
  end

  it 'blocks updating and outdated reports' do
    context[:report].update!(generation_status: 'generating')
    export_json
    expect(response).to have_http_status(:conflict)

    context[:report].update!(generation_status: 'complete', source_fingerprint: nil)
    export_json
    expect(response).to have_http_status(:conflict)
  end

  it 'requires acknowledgement for failed stale exports and discloses them in JSON' do
    context[:report].update!(generation_status: 'failed', generation_error: 'Safe failure')

    export_json
    expect(response).to have_http_status(:conflict)

    export_json(allow_stale: true)
    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['stale_export']).to be(true)
    expect(json.dig('fit_gap_report', 'freshness')).to eq('failed')
    expect(json.dig('fit_gap_report', 'stale_export')).to be(true)
  end

  it 'watermarks an acknowledged failed PDF export' do
    context[:report].update!(generation_status: 'failed', generation_error: 'Safe failure')

    get "/api/v1/portfolios/#{context[:portfolio].id}/export",
        params: { format: 'pdf', vacancy_id: context[:vacancy].id, allow_stale: true },
        headers: headers

    expect(response).to have_http_status(:ok), response.body
    expect(response.media_type).to eq('application/pdf')
    # Prawn's core font emits this watermark as split hexadecimal PDF text.
    expect(response.body).to include('<5354>')
    expect(response.body).to include('414c45204649542f474150205245504f52')
  end
end
