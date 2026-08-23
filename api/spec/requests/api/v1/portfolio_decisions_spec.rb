# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio decisions', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: organization.id) }
  let(:session) { create(:session, assessment:, tenant_id: organization.id) }
  let!(:portfolio) { create(:portfolio, session:) }
  let(:headers) do
    token = JsonWebToken.encode(user_id: 99, role: 'admin', scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}" }
  end

  it 'returns the AI recommendation and finalizes an override with an audit event' do
    create(:portfolio_decision, portfolio:, ai_outcome: 'fail', ai_rationale: 'Evidence did not meet the expected level.')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('portfolio', 'decision')).to include(
      'status' => 'ai_recommended', 'effective_outcome' => 'fail', 'source' => 'ai'
    )

    post "/api/v1/sessions/#{session.id}/decision/finalize",
         params: { decision: { outcome: 'pass', note: 'Admin review found sufficient transcript evidence.' } },
         headers: headers

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('decision', 'effective_outcome')).to eq('pass')
    expect(response.parsed_body.dig('decision', 'history').last).to include('event_type' => 'admin_finalized', 'actor_id' => 99)
  end

  it 'requires a note for an AI override, locks skill overrides, and reopens to the original AI result' do
    create(:portfolio_decision, portfolio:, ai_outcome: 'fail')
    portfolio_skill = create(:portfolio_skill, portfolio:)

    post "/api/v1/sessions/#{session.id}/decision/finalize",
         params: { decision: { outcome: 'pass' } }, headers: headers
    expect(response).to have_http_status(:unprocessable_entity)

    post "/api/v1/sessions/#{session.id}/decision/finalize",
         params: { decision: { outcome: 'pass', note: 'Evidence supports a pass.' } }, headers: headers
    expect(response).to have_http_status(:ok)

    post "/api/v1/portfolio_skills/#{portfolio_skill.id}/override",
         params: { override: { override_level: 5, assessor_notes: 'Later review' } }, headers: headers
    expect(response).to have_http_status(:conflict)

    post "/api/v1/sessions/#{session.id}/decision/reopen",
         params: { decision: { note: 'Rechecking skill evidence.' } }, headers: headers
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('decision', 'status')).to eq('ai_recommended')
    expect(response.parsed_body.dig('decision', 'effective_outcome')).to eq('fail')
  end

  it 'allows a legacy portfolio to be manually finalized only with a note' do
    post "/api/v1/sessions/#{session.id}/decision/finalize",
         params: { decision: { outcome: 'pass' } }, headers: headers
    expect(response).to have_http_status(:unprocessable_entity)

    post "/api/v1/sessions/#{session.id}/decision/finalize",
         params: { decision: { outcome: 'pass', note: 'Manual decision for a legacy portfolio.' } }, headers: headers
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('decision', 'status')).to eq('finalized')
    expect(response.parsed_body.dig('decision', 'ai_recommendation')).to be_nil
  end

  it 'does not allow another tenant to finalize the decision' do
    other_organization = create(:organization)
    other_token = JsonWebToken.encode(user_id: 100, role: 'admin', scheme: other_organization.scheme)

    post "/api/v1/sessions/#{session.id}/decision/finalize",
         params: { decision: { outcome: 'pass', note: 'Attempted cross-tenant decision.' } },
         headers: { 'Authorization' => "Bearer #{other_token}" }

    expect(response).to have_http_status(:not_found)
  end

  it 'includes the effective decision and source in JSON exports' do
    decision = create(:portfolio_decision, portfolio:, ai_outcome: 'fail')
    decision.update!(
      final_outcome: 'pass',
      finalization_note: 'Admin approved based on the cited evidence.',
      finalized_by_id: 99,
      finalized_at: Time.current
    )

    get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: headers

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('portfolio', 'decision')).to include(
      'status' => 'finalized', 'effective_outcome' => 'pass', 'source' => 'admin'
    )
  end
end
