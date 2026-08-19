# frozen_string_literal: true

require 'rails_helper'

# Regression coverage for F-01 (codebase-audit.md:363), portfolio_skills#override leg.
# PortfolioSkill has no tenant_id of its own; before the fix, `set_portfolio_skill` did
# a plain `PortfolioSkill.joins(:portfolio).find(params[:id])` with no tenant filter —
# any authenticated assessor from ANY tenant could WRITE an override rating onto another
# tenant's candidate assessment.
#
# Fix under test: `set_portfolio_skill` (portfolio_skills_controller.rb) now joins
# portfolio -> session and filters `sessions: { tenant_id: Current.tenant_id }`.
#
# Pre-fix failure condition established by seeded-fault run (see EXPLORATION_LOG.md
# STEP 10): with `api/app/controllers/api/v1/portfolio_skills_controller.rb` reverted to
# its pre-fix HEAD content, the "denies" example below turns RED (a cross-tenant override
# is written and returns 201) while the "allows" example stays GREEN.
RSpec.describe 'Api::V1::PortfolioSkills tenant isolation (F-01)', type: :request do
  let(:own_org)   { create(:organization) }
  let(:other_org) { create(:organization) }

  let(:own_session) { create(:session, organization: own_org) }
  let(:portfolio)   { create(:portfolio, session: own_session) }
  let(:skill)       { create(:portfolio_skill, portfolio: portfolio) }

  let(:own_headers)   { auth_headers(organization: own_org) }
  let(:other_headers) { auth_headers(organization: other_org) }

  let(:override_params) do
    { override: { override_level: 4, assessor_notes: 'Adjusted after reviewing the transcript.' } }
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it 'allows a tenant to override a rating on its own portfolio skill' do
      post "/api/v1/portfolio_skills/#{skill.id}/override", params: override_params, headers: own_headers

      expect(response).to have_http_status(:created)
      expect(json.dig('override', 'override_level')).to eq(4)
      expect(skill.reload.assessor_override).to be_present
    end

    it "denies another tenant from writing an override onto a portfolio skill it doesn't own" do
      post "/api/v1/portfolio_skills/#{skill.id}/override", params: override_params, headers: other_headers

      expect(response).to have_http_status(:not_found)
      expect(skill.reload.assessor_override).to be_nil
    end
  end
end
