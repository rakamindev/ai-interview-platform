# frozen_string_literal: true

require 'rails_helper'

# The assessor override is the one place a human overrules the model, so it is
# also the one place where reaching across a tenant boundary would let one
# customer rewrite another customer's judgement of a candidate.
#
# PortfolioSkill and Portfolio carry no tenant_id — only Session does, through
# TenantScoped. A `joins(:portfolio)` therefore constrains nothing: Rails does
# not apply a joined model's default_scope, so the lookup was reachable by id
# alone from any authenticated tenant.
RSpec.describe 'POST /api/v1/portfolio_skills/:id/override', type: :request do
  let(:own_org) { TenantContext.organization }

  let(:other_org) do
    Organization.find_by(scheme: 'other-corp') || Organization.create!(
      name: 'Other Corp', scheme: 'other-corp', identifier: 'other-corp', host: 'other.test'
    )
  end

  def portfolio_skill_in(org)
    Current.using(organization: org, tenant_id: org.id, user: OpenStruct.new(id: 1, role: 'admin')) do
      assessment = create(:assessment, :with_prd02_skills)
      session    = create(:session, :ended, assessment: assessment)
      create(:portfolio_skill, portfolio: create(:portfolio, session: session), ai_level: 4)
    end
  end

  def headers_for(org)
    {
      'Authorization'   => "Bearer #{JsonWebToken.encode(user_id: 1, role: 'admin', scheme: org.scheme)}",
      'X-Tenant-Scheme' => org.scheme,
      'CONTENT_TYPE'    => 'application/json'
    }
  end

  let(:body) { { override: { override_level: 2, assessor_notes: 'Downgraded.' } }.to_json }

  context 'for a portfolio skill in the caller’s own tenant' do
    it 'records the override' do
      skill = portfolio_skill_in(own_org)

      post "/api/v1/portfolio_skills/#{skill.id}/override", params: body, headers: headers_for(own_org)

      expect(response).to have_http_status(:created)
      expect(skill.reload.assessor_override.override_level).to eq(2)
    end
  end

  context 'for a portfolio skill belonging to another tenant' do
    it 'does not find it' do
      skill = portfolio_skill_in(other_org)

      post "/api/v1/portfolio_skills/#{skill.id}/override", params: body, headers: headers_for(own_org)

      expect(response).to have_http_status(:not_found)
    end

    it 'leaves the other tenant’s rating untouched' do
      skill = portfolio_skill_in(other_org)

      post "/api/v1/portfolio_skills/#{skill.id}/override", params: body, headers: headers_for(own_org)

      expect(skill.reload.assessor_override).to be_nil
    end
  end

  context 'without a token' do
    it 'refuses' do
      skill = portfolio_skill_in(own_org)

      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: body, headers: { 'X-Tenant-Scheme' => own_org.scheme, 'CONTENT_TYPE' => 'application/json' }

      expect(response.status).to be_in([401, 403])
    end
  end
end
