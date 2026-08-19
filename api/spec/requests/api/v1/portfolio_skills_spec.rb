# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::PortfolioSkills', type: :request do
  let(:admin) { create(:admin) }
  let(:headers) { auth_json_headers(admin) }

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    let(:portfolio) { create(:portfolio, :with_skills) }
    let(:portfolio_skill) { portfolio.portfolio_skills.first }

    context 'when no existing override' do
      it 'creates an override' do
        expect {
          post "/api/v1/portfolio_skills/#{portfolio_skill.id}/override",
               params: { override: { override_level: 4, assessor_notes: 'Stronger than AI' } }.to_json,
               headers: headers
        }.to change(AssessorOverride, :count).by(1)

        expect(response).to have_http_status(:created)
        body = JSON.parse(response.body)
        expect(body['override']['override_level']).to eq(4)
      end
    end

    context 'when existing override' do
      let!(:existing_override) { create(:assessor_override, portfolio_skill: portfolio_skill, override_level: 3) }

      it 'updates the override' do
        post "/api/v1/portfolio_skills/#{portfolio_skill.id}/override",
             params: { override: { override_level: 5 } }.to_json,
             headers: headers

        expect(response).to have_http_status(:ok)
        expect(existing_override.reload.override_level).to eq(5)
      end
    end
  end
end
