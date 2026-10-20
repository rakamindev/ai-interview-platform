# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::PortfolioSkillsController', type: :request do
  let(:org_a) { create_organization(name: 'Tenant Alpha') }
  let(:user_a) { create_user(role: 'admin') }
  let(:headers_a) { auth_headers_for(user: user_a, organization: org_a) }

  let(:org_b) { create_organization(name: 'Tenant Beta') }
  let(:user_b) { create_user(role: 'admin') }
  let(:headers_b) { auth_headers_for(user: user_b, organization: org_b) }

  let(:assessment_a) do
    Assessment.create!(
      tenant_id: org_a.id,
      created_by: user_a.id,
      name: 'Alpha Assessment',
      time_limit_min: 30
    )
  end
  let(:session_a) do
    Session.create!(
      tenant_id: org_a.id,
      assessment_id: assessment_a.id,
      invite_token: SecureRandom.hex(16),
      status: 'ended'
    )
  end
  let(:portfolio_a) do
    Portfolio.create!(
      session_id: session_a.id,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end
  let(:skill_a) do
    PortfolioSkill.create!(
      portfolio: portfolio_a,
      skill_label: 'PostgreSQL',
      assessment_status: 'assessed',
      ai_level: 2,
      ai_confidence: 'medium',
      competency_summary: 'Familiar with basic queries.'
    )
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    describe 'AC-S1: Multi-tenant protection' do
      it 'returns 404 when Tenant B tries to override a skill from Tenant A' do
        post "/api/v1/portfolio_skills/#{skill_a.id}/override",
             params: { override: { override_level: 4, assessor_notes: 'Valid notes' } },
             headers: headers_b

        expect(response).to have_http_status(:not_found)
      end
    end

    describe 'AC-S2: Input validation' do
      it 'returns 422 if override_level is missing or not between 1 and 5' do
        post "/api/v1/portfolio_skills/#{skill_a.id}/override",
             params: { override: { override_level: 6, assessor_notes: 'Valid notes' } },
             headers: headers_a

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'returns 422 if assessor_notes is blank or whitespace' do
        post "/api/v1/portfolio_skills/#{skill_a.id}/override",
             params: { override: { override_level: 3, assessor_notes: '   ' } },
             headers: headers_a

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'returns 422 if assessor_notes exceeds 2000 characters' do
        post "/api/v1/portfolio_skills/#{skill_a.id}/override",
             params: { override: { override_level: 3, assessor_notes: 'a' * 2001 } },
             headers: headers_a

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    describe 'Successful override creation' do
      it 'creates override and returns 201' do
        post "/api/v1/portfolio_skills/#{skill_a.id}/override",
             params: { override: { override_level: 4, assessor_notes: 'Verified production incident handling.' } },
             headers: headers_a

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)
        expect(json.dig('override', 'override_level')).to eq(4)
        expect(json.dig('override', 'assessor_notes')).to eq('Verified production incident handling.')
      end
    end
  end
end
