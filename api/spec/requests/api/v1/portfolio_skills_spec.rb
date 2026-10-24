# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::PortfolioSkills', type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:assessment) { create(:assessment, tenant_id: organization.id) }
  let(:session) { create(:session, :ended, assessment: assessment, tenant_id: organization.id) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:portfolio_skill) { create(:portfolio_skill, portfolio: portfolio) }
  let(:headers) { auth_headers(user_id: user.id, scheme: organization.scheme) }

  let(:other_organization) { create(:organization) }
  let(:other_assessment) { create(:assessment, tenant_id: other_organization.id) }
  let(:other_session) { create(:session, :ended, assessment: other_assessment, tenant_id: other_organization.id) }
  let(:other_portfolio) { create(:portfolio, session: other_session) }
  let(:other_skill) { create(:portfolio_skill, portfolio: other_portfolio) }

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it 'creates an override for a skill in the current tenant' do
      portfolio_skill

      post "/api/v1/portfolio_skills/#{portfolio_skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Confirmed in interview' } },
           headers: headers

      expect(response).to have_http_status(:created)
      expect(portfolio_skill.reload.assessor_override.override_level).to eq(4)
    end

    it "does not allow overriding another tenant's skill" do
      other_skill

      post "/api/v1/portfolio_skills/#{other_skill.id}/override",
           params: { override: { override_level: 4 } }, headers: headers

      expect(response).to have_http_status(:not_found)
      expect(other_skill.reload.assessor_override).to be_nil
    end
  end
end
