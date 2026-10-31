# frozen_string_literal: true

require_relative '../rails_helper'
require_relative '../support/assessment_records'

RSpec.describe 'Fit/Gap API', type: :request do
  include AssessmentRecords
  let!(:own) { create_records }
  let!(:foreign) { create_records(scheme: 'foreign-fixture') }
  let(:headers) { headers_for(own[:organization]) }
  let(:base) { "/api/v1/portfolios/#{own[:portfolio].id}" }

  it 'returns a fresh, typed comparison on initial read and explicit recompute' do
    get "#{base}/fitgap/#{own[:vacancy].id}", headers: headers
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig('report', 'skill_comparisons', 0)).to include('expected_level' => 3, 'candidate_level' => 2)
    post "#{base}/regenerate_fitgap", params: { vacancy_id: own[:vacancy].id }, headers: headers
    expect(response).to have_http_status(:ok)
    expect(FitGapReport.count).to eq(1)
  end

  it 'requires authentication and an assessor role' do
    get "#{base}/fitgap/#{own[:vacancy].id}", headers: { 'X-Tenant-Scheme' => own[:organization].scheme }
    expect(response).to have_http_status(:unauthorized)
    get "#{base}/fitgap/#{own[:vacancy].id}", headers: headers_for(own[:organization], role: 'user')
    expect(response).to have_http_status(:forbidden)
  end

  it 'prevents access to foreign portfolios through read, generation, regeneration, and exports' do
    other = "/api/v1/portfolios/#{foreign[:portfolio].id}"
    [[:get, "#{other}/fitgap/#{own[:vacancy].id}"], [:get, "#{other}/export"], [:post, "#{other}/fitgap"], [:post, "#{other}/regenerate_fitgap"]].each do |method, path|
      public_send(method, path, params: { vacancy_id: own[:vacancy].id }, headers: headers)
      expect(response).to have_http_status(:not_found), path
    end
  end

  it 'rejects a signed token with no tenant claim even if a header selects a tenant' do
    token = JsonWebToken.encode(user_id: 1, role: 'assessor')
    get "#{base}/fitgap/#{own[:vacancy].id}", headers: { 'Authorization' => "Bearer #{token}", 'X-Tenant-Scheme' => own[:organization].scheme }
    expect(response).to have_http_status(:forbidden)
  end

  it 'prevents a foreign vacancy from being compared or exported' do
    get "#{base}/fitgap/#{foreign[:vacancy].id}", headers: headers
    expect(response).to have_http_status(:not_found)
    get "#{base}/export", params: { vacancy_id: foreign[:vacancy].id, format: 'json' }, headers: headers
    expect(response).to have_http_status(:not_found)
  end

  it 'prevents foreign overrides and keeps the original rating' do
    post "/api/v1/portfolio_skills/#{foreign[:skill].id}/override", params: { override: { override_level: 5 } }, headers: headers
    expect(response).to have_http_status(:not_found)
    expect(foreign[:skill].reload.assessor_override).to be_nil
  end

  it 'refreshes reports atomically after an authorized override' do
    FitGap::Engine.new(portfolio: own[:portfolio], vacancy: own[:vacancy]).call
    post "/api/v1/portfolio_skills/#{own[:skill].id}/override", params: { override: { override_level: 4, assessor_notes: 'Synthetic review note.' } }, headers: headers
    expect(response).to have_http_status(:created)
    expect(FitGapReport.first.skill_comparisons.first).to include('candidate_level' => 4, 'is_override' => true)
  end

  it 'validates overrides without deleting reports or changing ratings' do
    FitGap::Engine.new(portfolio: own[:portfolio], vacancy: own[:vacancy]).call
    post "/api/v1/portfolio_skills/#{own[:skill].id}/override", params: { override: { override_level: 0 } }, headers: headers
    expect(response).to have_http_status(:unprocessable_entity)
    expect(FitGapReport.count).to eq(1)
    expect(own[:skill].reload.assessor_override).to be_nil
  end

  it 'does not let an inaccessible legacy cache block an authorized override' do
    report = FitGap::Engine.new(portfolio: own[:portfolio], vacancy: own[:vacancy]).call
    legacy = FitGapReport.create!(portfolio: own[:portfolio], vacancy: foreign[:vacancy], skill_comparisons: [])
    post "/api/v1/portfolio_skills/#{own[:skill].id}/override", params: { override: { override_level: 4 } }, headers: headers
    expect(response).to have_http_status(:created)
    expect(report.reload.skill_comparisons.first['candidate_level']).to eq(4)
    expect(legacy.reload.skill_comparisons).to eq([])
  end

  it 'rolls back the override if refreshing a report fails partway through the operation' do
    report = FitGap::Engine.new(portfolio: own[:portfolio], vacancy: own[:vacancy]).call
    previous = report.skill_comparisons
    allow(FitGap::Engine).to receive(:new).and_return(double(call: nil))
    allow(FitGap::Engine.new).to receive(:call).and_raise('Synthetic refresh failure')
    post "/api/v1/portfolio_skills/#{own[:skill].id}/override", params: { override: { override_level: 4 } }, headers: headers
    expect(response).to have_http_status(:internal_server_error)
    expect(own[:skill].reload.assessor_override).to be_nil
    expect(report.reload.skill_comparisons).to eq(previous)
  end

  it 'rejects incomplete portfolios and missing vacancy parameters' do
    own[:portfolio].update!(generation_status: 'failed')
    get "#{base}/fitgap/#{own[:vacancy].id}", headers: headers
    expect(response).to have_http_status(:unprocessable_entity)
    post "#{base}/fitgap", headers: headers
    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'exports the current comparison as JSON and a real PDF' do
    get "#{base}/export", params: { vacancy_id: own[:vacancy].id, format: 'json' }, headers: headers
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig('fit_gap_report', 'comparison_method')).to eq('deterministic_v1')
    get "#{base}/export", params: { vacancy_id: own[:vacancy].id, format: 'pdf' }, headers: headers
    expect(response).to have_http_status(:ok)
    expect(response.body).to start_with('%PDF-')
  end

  it 'exports an unconfigured vacancy without implying a match or crashing' do
    own[:vacancy].vacancy_skills.destroy_all
    get "#{base}/export", params: { vacancy_id: own[:vacancy].id, format: 'pdf' }, headers: headers
    expect(response).to have_http_status(:ok)
    expect(response.body).to start_with('%PDF-')
    expect(FitGapReport.first.skill_comparisons).to eq([])
  end
end
