# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio Expected Level', type: :request do
  let!(:org) { Organization.find_or_create_by!(id: 1) { |o| o.identifier = 'org1'; o.name = 'Org 1'; o.scheme = 'org1'; o.host = 'localhost' } }
  let(:token) { JsonWebToken.encode(user_id: 1, role: 'admin', scheme: 'org1') }
  let(:headers) { { 'Authorization' => "Bearer #{token}", 'X-Tenant-Scheme' => 'org1' } }

  let(:assessment) { create(:assessment, tenant_id: 1) }
  let!(:assessment_skill) { create(:assessment_skill, assessment: assessment, skill_label: 'Node.js', expected_level: 4) }
  let(:session) { create(:session, assessment: assessment, tenant_id: 1) }
  let(:portfolio) { create(:portfolio, session: session, generation_status: 'complete') }
  let!(:portfolio_skill) { create(:portfolio_skill, portfolio: portfolio, skill_label: 'Node.js', ai_level: 3) }

  it 'includes expected_level in portfolio skills JSON' do
    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    skill = json['portfolio']['skills'].first
    expect(skill['skill_label']).to eq('Node.js')
    expect(skill['expected_level']).to eq(4)
  end
end
