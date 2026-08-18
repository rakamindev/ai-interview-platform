# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Sessions Pagination', type: :request do
  let!(:org) { Organization.find_or_create_by!(id: 1) { |o| o.identifier = 'org1'; o.name = 'Org 1'; o.scheme = 'org1'; o.host = 'localhost' } }
  let(:token) { JsonWebToken.encode(user_id: 1, role: 'admin', scheme: 'org1') }
  let(:headers) { { 'Authorization' => "Bearer #{token}", 'X-Tenant-Scheme' => 'org1' } }

  let(:assessment) { create(:assessment, tenant_id: 1) }

  before do
    create_list(:session, 25, assessment: assessment, tenant_id: 1)
  end

  it 'paginates sessions index with meta' do
    get "/api/v1/assessments/#{assessment.id}/sessions", params: { page: 1, per_page: 10 }, headers: headers
    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)

    expect(json['sessions'].length).to eq(10)
    expect(json['meta']['total_count']).to eq(25)
    expect(json['meta']['total_pages']).to eq(3)
    expect(json['meta']['current_page']).to eq(1)
  end
end
