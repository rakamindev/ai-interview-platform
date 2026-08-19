# frozen_string_literal: true

require 'rails_helper'

# Detail contract for portfolios (there is no index route): the only shape a
# client can receive, plus the 202 generating state.
RSpec.describe 'Api::V1::Portfolios (detail contract)', type: :request do
  let(:org) { create(:organization, scheme: 'test-corp') }
  let(:admin) { create(:admin_user) }
  let(:headers) { auth_headers(scheme: org.scheme, user: admin) }

  PORTFOLIO_KEYS = %w[
    id session_id candidate_id generation_status
    generated_at generation_error skills overrides
  ].freeze
  PORTFOLIO_SKILL_KEYS = %w[
    id skill_id skill_label is_discovered ai_level
    ai_confidence evidence competency_summary
  ].freeze
  OVERRIDE_KEYS = %w[
    id portfolio_skill_id ai_level override_level
    assessor_notes overridden_by overridden_at
  ].freeze

  def completed_portfolio
    session = create(:session, tenant_id: org.id)
    portfolio = create(:portfolio, session: session, generation_status: 'complete')
    skill = create(:portfolio_skill, portfolio: portfolio)
    skill.create_assessor_override(
      ai_level: 3,
      override_level: 4,
      assessor_notes: 'Stronger evidence in probe 3',
      overridden_by: admin.id
    )
    portfolio
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'returns the full portfolio detail shape when generation is complete' do
      portfolio = completed_portfolio

      get "/api/v1/sessions/#{portfolio.session_id}/portfolio", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect_json_keys(body['portfolio'], PORTFOLIO_KEYS)
      expect_json_keys(body['portfolio']['skills'].first, PORTFOLIO_SKILL_KEYS)
      expect_json_keys(body['portfolio']['overrides'].first, OVERRIDE_KEYS)
    end

    it 'returns 202 with a generating status while generation is pending' do
      session = create(:session, tenant_id: org.id)
      create(:portfolio, session: session, generation_status: 'generating')

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:accepted)
      expect(JSON.parse(response.body)).to eq('status' => 'generating')
    end
  end
end
