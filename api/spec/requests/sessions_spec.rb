# frozen_string_literal: true

require 'rails_helper'
require 'ostruct'

RSpec.describe 'Sessions API', type: :request do
  let(:org) { create(:organization) }

  before do
    # TenantResolverMiddleware equivalent for request specs
    RequestStore.store[:organization] = org
    RequestStore.store[:tenant_id] = org.id
    Current.organization = org
    Current.tenant_id = org.id
    Current.user = OpenStruct.new(id: 1, role: 'admin', scheme: org.scheme)
  end

  after do
    RequestStore.clear!
  end

  describe 'POST /api/v1/sessions/:id/end_session' do
    it 'is idempotent: ending an already-ended session returns 200, not 422' do
      assessment = create(:assessment, :with_skill, tenant: org)
      session = create(:session, :ended, assessment: assessment, tenant: org)

      post "/api/v1/sessions/#{session.id}/end_session",
           params: { session: { reason: 'manual_assessor' } },
           headers: { 'Authorization' => "Bearer #{jwt_for(org)}" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('session', 'status')).to eq('ended')
    end

    it 'ends an active session with the requested reason' do
      assessment = create(:assessment, :with_skill, tenant: org)
      session = create(:session, :active, assessment: assessment, tenant: org)

      post "/api/v1/sessions/#{session.id}/end_session",
           params: { session: { reason: 'manual_assessor' } },
           headers: { 'Authorization' => "Bearer #{jwt_for(org)}" }

      expect(response).to have_http_status(:ok)
      expect(session.reload).to be_ended
      expect(session.end_reason).to eq('manual_assessor')
      expect(session.duration_seconds).to be_present
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it 'rejects overrides on unassessed skills' do
      assessment = create(:assessment, :with_skill, tenant: org)
      session = create(:session, :ended, assessment: assessment, tenant: org)
      portfolio = create(:portfolio, session: session)
      skill = create(:portfolio_skill, :unassessed, portfolio: portfolio)

      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: 4 } },
           headers: { 'Authorization' => "Bearer #{jwt_for(org)}" }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).dig('errors', 0, 'message')).to match(/was not assessed/)
    end
  end

  private

  def jwt_for(org)
    JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org.scheme })
  end
end
