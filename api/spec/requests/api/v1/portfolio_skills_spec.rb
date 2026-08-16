# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::PortfolioSkills', type: :request do
  let!(:org_a) do
    Organization.create!(
      name: 'Tenant A',
      scheme: 'tenant-a',
      identifier: 'tenant-a',
      host: 'tenant-a.com'
    )
  end

  let!(:org_b) do
    Organization.create!(
      name: 'Tenant B',
      scheme: 'tenant-b',
      identifier: 'tenant-b',
      host: 'tenant-b.com'
    )
  end

  let(:token_a) { JsonWebToken.encode({ user_id: 101, role: 'admin', scheme: 'tenant-a' }) }
  let(:token_b) { JsonWebToken.encode({ user_id: 102, role: 'admin', scheme: 'tenant-b' }) }

  let(:headers_a) { { 'Authorization' => "Bearer #{token_a}" } }
  let(:headers_b) { { 'Authorization' => "Bearer #{token_b}" } }

  let!(:assessment_a) { Assessment.create!(tenant_id: org_a.id, name: 'Assess A', time_limit_min: 30, created_by: 101) }
  let!(:assessment_b) { Assessment.create!(tenant_id: org_b.id, name: 'Assess B', time_limit_min: 30, created_by: 102) }

  let!(:session_a) do
    Session.create!(
      tenant_id: org_a.id,
      assessment: assessment_a,
      invite_token: 'token-a-session',
      status: 'ended'
    )
  end

  let!(:session_b) do
    Session.create!(
      tenant_id: org_b.id,
      assessment: assessment_b,
      invite_token: 'token-b-session',
      status: 'ended'
    )
  end

  let!(:portfolio_a) { Portfolio.create!(session: session_a, generation_status: 'complete') }
  let!(:portfolio_b) { Portfolio.create!(session: session_b, generation_status: 'complete') }

  let!(:skill_a) do
    PortfolioSkill.create!(
      portfolio: portfolio_a,
      skill_id: 'sys-design',
      skill_label: 'System Design',
      ai_level: 3,
      ai_confidence: 'high',
      competency_summary: 'Good performance'
    )
  end

  let!(:skill_b) do
    PortfolioSkill.create!(
      portfolio: portfolio_b,
      skill_id: 'sys-design',
      skill_label: 'System Design',
      ai_level: 3,
      ai_confidence: 'high',
      competency_summary: 'Good performance'
    )
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    context 'when authenticated as Tenant A' do
      it 'allows overriding its own portfolio skills' do
        post "/api/v1/portfolio_skills/#{skill_a.id}/override",
             params: { override: { override_level: 4, assessor_notes: 'Valid override' } },
             headers: headers_a
        expect(response).to have_http_status(:created).or(have_http_status(:ok))
      end

      it 'blocks overriding Tenant B portfolio skills' do
        post "/api/v1/portfolio_skills/#{skill_b.id}/override",
             params: { override: { override_level: 4, assessor_notes: 'Bypassed override' } },
             headers: headers_a
        expect(response).to have_http_status(:not_found).or(have_http_status(:forbidden))
      end
    end
  end
end
