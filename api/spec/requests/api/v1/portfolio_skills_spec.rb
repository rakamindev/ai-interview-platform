# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::PortfolioSkills', type: :request do
  let!(:org_a) do
    Organization.create!(
      name: 'Tenant Alpha',
      scheme: 'tenant-alpha',
      identifier: 'tenant-alpha',
      host: 'tenant-alpha.test',
      config: {}
    )
  end

  let!(:org_b) do
    Organization.create!(
      name: 'Tenant Beta',
      scheme: 'tenant-beta',
      identifier: 'tenant-beta',
      host: 'tenant-beta.test',
      config: {}
    )
  end

  let!(:assessment_a) do
    Assessment.create!(
      tenant_id: org_a.id,
      created_by: 1,
      name: 'Alpha Engineering Assessment',
      time_limit_min: 30
    )
  end

  let!(:session_a) do
    Session.create!(
      tenant_id: org_a.id,
      assessment: assessment_a,
      status: 'ended',
      candidate_name: 'Jane Doe'
    )
  end

  let!(:portfolio_a) do
    Portfolio.create!(
      session: session_a,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end

  let!(:portfolio_skill_a) do
    PortfolioSkill.create!(
      portfolio: portfolio_a,
      skill_label: 'Ruby on Rails',
      ai_level: 3,
      ai_confidence: 'high',
      evidence: ['Demonstrated solid understanding of Rails conventions.'],
      competency_summary: 'Competent Rails engineer.'
    )
  end

  let(:token_a) do
    JsonWebToken.encode({ user_id: 10, role: 'assessor', scheme: org_a.scheme })
  end

  let(:token_b) do
    JsonWebToken.encode({ user_id: 20, role: 'assessor', scheme: org_b.scheme })
  end

  describe 'POST /api/v1/portfolio-skills/:id/override' do
    it 'returns 404 when an assessor from Tenant B attempts to override a skill belonging to Tenant A' do
      post "/api/v1/portfolio_skills/#{portfolio_skill_a.id}/override",
           params: { override: { override_level: 5, assessor_notes: 'Malicious cross-tenant override' } },
           headers: { 'Authorization' => "Bearer #{token_b}" }

      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json['errors'].first['message']).to match(/portfolio skill not found/i)
      expect(portfolio_skill_a.reload.assessor_override).to be_nil
    end

    it 'allows an assessor from Tenant A to override skills within their own organization' do
      post "/api/v1/portfolio_skills/#{portfolio_skill_a.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Legitimate assessor upgrade' } },
           headers: { 'Authorization' => "Bearer #{token_a}" }

      expect(response).to have_http_status(:created)
      expect(portfolio_skill_a.reload.assessor_override).to be_present
      expect(portfolio_skill_a.assessor_override.override_level).to eq(4)
    end
  end
end
