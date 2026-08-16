# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Api::V1::PortfolioSkillsController, type: :request do
  let(:tenant_a) { create(:organization) }
  let(:tenant_b) { create(:organization) }
  let(:headers_a) { auth_header_for(organization: tenant_a) }

  let!(:skill_b) do
    create(:portfolio_skill, portfolio: create(:portfolio, session: create(:session, tenant_id: tenant_b.id)))
  end

  describe 'cross-tenant isolation' do
    it 'blocks overriding a skill on another tenant portfolio' do
      post "/api/v1/portfolio_skills/#{skill_b.id}/override",
           params: { override: { override_level: 5 } },
           headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it 'allows overriding a skill on own tenant portfolio' do
      own_skill = create(
        :portfolio_skill,
        portfolio: create(:portfolio, session: create(:session, tenant_id: tenant_a.id))
      )

      post "/api/v1/portfolio_skills/#{own_skill.id}/override",
           params: { override: { override_level: 5 } },
           headers: headers_a

      expect(response).to have_http_status(:created)
    end
  end
end
