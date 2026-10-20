# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio skill overrides', type: :request do
  let(:org)       { create(:organization) }
  let(:headers)   { auth_headers(org) }
  let(:portfolio) { create(:portfolio, session: create(:session, assessment: create(:assessment, organization: org))) }

  it 'rejects an override on a skill that was not assessed' do
    skill = create(:portfolio_skill, :not_assessed, portfolio: portfolio)

    post "/api/v1/portfolio_skills/#{skill.id}/override", params: { override: { override_level: 3 } }, headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    expect(JSON.parse(response.body).dig('errors', 0, 'message')).to eq('Only assessed skills can be overridden')
    expect(skill.reload.assessor_override).to be_nil
  end

  it 'rejects an override level outside 1 to 5' do
    skill = create(:portfolio_skill, portfolio: portfolio)

    post "/api/v1/portfolio_skills/#{skill.id}/override", params: { override: { override_level: 9 } }, headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'requires an assessor token' do
    skill = create(:portfolio_skill, portfolio: portfolio)

    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: 4 } }, headers: auth_headers(org, role: 'student')

    expect(response).to have_http_status(:forbidden)
  end
end
