# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'PortfolioSkills API - Multi-Tenant Security (KEAMANAN-01)', type: :request do
  let!(:org_a) { Organization.create!(name: 'Company A', scheme: 'comp_a', identifier: 'comp_a', host: 'compa.test') }
  let!(:org_b) { Organization.create!(name: 'Company B', scheme: 'comp_b', identifier: 'comp_b', host: 'compb.test') }

  let!(:assessment_a) do
    Assessment.create!(
      tenant_id: org_a.id,
      created_by: 1,
      name: 'Frontend Test',
      language: 'id',
      time_limit_min: 10
    )
  end

  let!(:session_a) do
    Session.create!(
      tenant_id: org_a.id,
      assessment: assessment_a,
      status: 'ended'
    )
  end

  let!(:portfolio_a) do
    Portfolio.create!(
      session: session_a,
      generation_status: 'complete'
    )
  end

  let!(:skill_a) do
    PortfolioSkill.create!(
      portfolio: portfolio_a,
      skill_label: 'React',
      ai_level: 2,
      ai_confidence: 'high',
      competency_summary: 'Demonstrates good React understanding.'
    )
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    context 'when assessor belongs to the same organization (Company A)' do
      it 'allows the override and saves the notes' do
        headers = auth_headers_for(org_a, role: 'assessor', user_id: 101)
        payload = {
          override: {
            override_level: 3,
            assessor_notes: 'Promoted to L3 based on project portfolio.'
          }
        }.to_json

        post "/api/v1/portfolio_skills/#{skill_a.id}/override", params: payload, headers: headers

        expect(response).to have_http_status(:created).or have_http_status(:ok)
        expect(skill_a.reload.assessor_override.override_level).to eq(3)
        expect(skill_a.reload.assessor_override.assessor_notes).to eq('Promoted to L3 based on project portfolio.')
      end
    end

    context 'when assessor belongs to a different organization (Company B - IDOR attempt)' do
      it 'rejects the request with 404 and does NOT modify the override' do
        headers = auth_headers_for(org_b, role: 'assessor', user_id: 202)
        payload = {
          override: {
            override_level: 5,
            assessor_notes: 'Unauthorized change attempt by Company B'
          }
        }.to_json

        post "/api/v1/portfolio_skills/#{skill_a.id}/override", params: payload, headers: headers

        # Security assertion: Cross-tenant override MUST NOT succeed!
        expect(response).to have_http_status(:not_found)
        expect(skill_a.reload.assessor_override).to be_nil
      end
    end
  end
end
