# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio tenant isolation (P0-2)', type: :request do
  let(:password) { 'correct-horse-battery-staple' }

  let(:own_org)    { create(:organization) }
  let(:victim_org) { create(:organization) }

  let(:own_user)   { create(:user, password:, organization: own_org) }

  let(:victim_session)   { create(:session, organization: victim_org, tenant_id: victim_org.id) }
  let(:victim_portfolio) { create(:portfolio_with_skill, session: victim_session) }

  def auth_headers_for(user)
    token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: user.organization.scheme })
    { 'Authorization' => "Bearer #{token}" }
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it "returns 404 for a portfolio belonging to a different organization" do
      get "/api/v1/portfolios/#{victim_portfolio.id}/export",
          params: { format: 'json' },
          headers: auth_headers_for(own_user)

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it "returns 404 and does not modify a skill belonging to a different organization" do
      skill = victim_portfolio.portfolio_skills.first

      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override_level: 5, assessor_notes: 'tampered' },
           headers: auth_headers_for(own_user)

      expect(response).to have_http_status(:not_found)
      expect(skill.reload.assessor_override).to be_nil
    end
  end

    describe 'GET /api/v1/sessions/:id/portfolio (baseline: same-org access still works)' do
    it "returns 200 when the portfolio belongs to the requester's own org" do
      own_session   = create(:session, organization: own_org, tenant_id: own_org.id)
      create(:portfolio_with_skill, session: own_session)

      get "/api/v1/sessions/#{own_session.id}/portfolio",
          headers: auth_headers_for(own_user)

      expect(response).to have_http_status(:ok)
    end
  end
end