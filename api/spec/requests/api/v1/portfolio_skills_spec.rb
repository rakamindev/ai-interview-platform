# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::PortfolioSkills', type: :request do
  let(:org_a) { create(:organization) }
  let(:org_b) { create(:organization) }

  let(:user_a) { create(:user, role: 'admin') }
  let(:headers_a) { authenticated_header(user_a, organization: org_a) }

  let(:assessment_a) { create(:assessment, tenant_id: org_a.id) }
  let(:session_a) { create(:session, assessment: assessment_a, tenant_id: org_a.id) }
  let(:portfolio_a) { create(:portfolio, session: session_a) }
  let(:skill_a) { create(:portfolio_skill, portfolio: portfolio_a, skill_label: 'System Design', ai_level: 3) }

  let(:assessment_b) { create(:assessment, tenant_id: org_b.id) }
  let(:session_b) { create(:session, assessment: assessment_b, tenant_id: org_b.id) }
  let(:portfolio_b) { create(:portfolio, session: session_b) }
  let(:skill_b) { create(:portfolio_skill, portfolio: portfolio_b, skill_label: 'System Design', ai_level: 3) }

  describe 'POST /api/v1/portfolio-skills/:id/override' do
    it 'creates an override for a portfolio skill belonging to the tenant' do
      post "/api/v1/portfolio_skills/#{skill_a.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Stronger leadership shown' } }.to_json,
           headers: headers_a

      expect(response).to have_http_status(:created)
      expect(json_response['override']['override_level']).to eq(4)
      expect(skill_a.reload.assessor_override).to be_present
    end

    it 'rejects overriding a skill belonging to a different tenant (IDOR prevention)' do
      post "/api/v1/portfolio_skills/#{skill_b.id}/override",
           params: { override: { override_level: 5 } }.to_json,
           headers: headers_a

      expect(response).to have_http_status(:not_found)
    end
  end
end
