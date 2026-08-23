# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::PortfolioSkills', type: :request do
  let(:user) { create(:user, :admin) }
  let(:headers) { auth_headers(user) }
  let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }
  let!(:session) { create(:session, :ended, assessment: assessment) }
  let!(:portfolio) { create(:portfolio, :complete, session: session) }
  let!(:portfolio_skill) { create(:portfolio_skill, portfolio: portfolio) }

  before { with_tenant }

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    context 'when override does not exist' do
      it 'creates new override and regenerates fitgap reports' do
        expect {
          post "/api/v1/portfolio_skills/#{portfolio_skill.id}/override",
               params: { override: { override_level: 4, assessor_notes: 'Updated level' } },
               headers: headers
        }.to change(AssessorOverride, :count).by(1)

        expect_json_response(status: :created)
        expect(json_body['override']['override_level']).to eq(4)
      end
    end

    context 'when override already exists' do
      let!(:existing_override) { create(:assessor_override, portfolio_skill: portfolio_skill, override_level: 3) }

      it 'updates existing override' do
        expect {
          post "/api/v1/portfolio_skills/#{portfolio_skill.id}/override",
               params: { override: { override_level: 5, assessor_notes: 'Updated again' } },
               headers: headers
        }.not_to change(AssessorOverride, :count)

        expect_json_response
        expect(json_body['override']['override_level']).to eq(5)
      end
    end

    it 'returns 404 for non-existent portfolio skill' do
      post '/api/v1/portfolio_skills/99999/override',
           params: { override: { override_level: 4 } },
           headers: headers

      expect_error(status: :not_found)
    end
  end
end