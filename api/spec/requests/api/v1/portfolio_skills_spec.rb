# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::PortfolioSkills', type: :request do
  let!(:org1) { Organization.find_or_create_by!(id: 1, name: 'Org One', scheme: 'org-one', identifier: 'org-one', host: 'localhost') }
  let!(:org2) { Organization.find_or_create_by!(id: 2, name: 'Org Two', scheme: 'org-two', identifier: 'org-two', host: 'org2.local') }

  let(:token1) { JsonWebToken.encode({ user_id: 10, role: 'assessor', scheme: 'org-one' }) }
  let(:token2) { JsonWebToken.encode({ user_id: 20, role: 'assessor', scheme: 'org-two' }) }

  let(:session1) do
    Current.organization = org1
    Current.tenant_id = org1.id
    assessment = Assessment.create!(name: 'Backend Dev', time_limit_min: 45, created_by: 10)
    Session.create!(assessment: assessment, tenant_id: org1.id, candidate_name: 'Dewi Lestari')
  end

  let(:portfolio1) do
    Current.organization = org1
    Current.tenant_id = org1.id
    Portfolio.create!(session: session1, generation_status: 'complete')
  end

  let!(:skill1) do
    portfolio1.portfolio_skills.create!(
      skill_label: 'PostgreSQL',
      is_assessed: true,
      ai_level: 2,
      ai_confidence: 'medium',
      competency_summary: 'Basic indexing knowledge'
    )
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it 'creates an assessor override successfully' do
      post "/api/v1/portfolio_skills/#{skill1.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Demonstrated deep WAL understanding in portfolio.' } },
           headers: { 'Authorization' => "Bearer #{token1}" }

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['override']['override_level']).to eq(4)
      expect(json['override']['assessor_notes']).to include('WAL understanding')

      skill1.reload
      expect(skill1.assessor_override).to be_present
      expect(skill1.effective_level).to eq(4)
      expect(skill1.overridden?).to be true
    end

    it 'updates existing assessor override on subsequent call' do
      skill1.create_assessor_override!(ai_level: 2, override_level: 3, overridden_by: 10, assessor_notes: 'First review')

      post "/api/v1/portfolio_skills/#{skill1.id}/override",
           params: { override: { override_level: 5, assessor_notes: 'Updated to staff level' } },
           headers: { 'Authorization' => "Bearer #{token1}" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['override']['override_level']).to eq(5)
      expect(json['override']['assessor_notes']).to eq('Updated to staff level')
    end

    it 'blocks cross-tenant overrides' do
      post "/api/v1/portfolio_skills/#{skill1.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Hacked' } },
           headers: { 'Authorization' => "Bearer #{token2}" }

      expect(response).to have_http_status(:not_found)
    end
  end
end
