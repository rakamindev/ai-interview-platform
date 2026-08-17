# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio tenant isolation', type: :request do
  let(:org_a) { create(:organization, scheme: 'acme') }
  let(:org_b) { create(:organization, scheme: 'victim') }

  let(:session_a) { create(:session, tenant_id: org_a.id) }
  let(:session_b) { create(:session, tenant_id: org_b.id) }

  let(:portfolio_a) { create(:portfolio, session: session_a, generation_status: 'complete') }
  let(:portfolio_b) { create(:portfolio, session: session_b, generation_status: 'complete') }

  let(:skill_a) { create(:portfolio_skill, portfolio: portfolio_a) }
  let(:skill_b) { create(:portfolio_skill, portfolio: portfolio_b) }

  before { org_a && org_b }

  let(:headers_a) { bearer_for(organization: org_a) }

  describe 'P1-5: Portfolio IDOR' do
    it "does not let tenant A export tenant B's portfolio" do
      get "/api/v1/portfolios/#{portfolio_b.id}/export",
          params: { format: 'json' }, headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it "does not let tenant A run fit/gap on tenant B's portfolio" do
      post "/api/v1/portfolios/#{portfolio_b.id}/fitgap",
           params: { vacancy_id: 1 }, headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it "lets a tenant export its own portfolio" do
      get "/api/v1/portfolios/#{portfolio_a.id}/export",
          params: { format: 'json' }, headers: headers_a

      expect(response).to have_http_status(:ok)
    end
  end

  describe 'P1-6: PortfolioSkill override IDOR' do
    it "does not let tenant A override tenant B's portfolio skill" do
      post "/api/v1/portfolio_skills/#{skill_b.id}/override",
           params: { override: { override_level: 4 } }, headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it "lets a tenant override its own portfolio skill" do
      post "/api/v1/portfolio_skills/#{skill_a.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Verified in transcript.' } }, headers: headers_a

      expect(response).to have_http_status(:created)
    end
  end
end
