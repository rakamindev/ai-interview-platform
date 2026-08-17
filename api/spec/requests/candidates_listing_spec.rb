# frozen_string_literal: true

require 'rails_helper'

# Candidate-centric view: list candidates across all assessments (each
# session is a candidate appearance), with search, status filter and
# pagination — consistent with the other list endpoints.
RSpec.describe 'Candidates list', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp', identifier: 'test-corp', name: 'Test Corp', host: 'localhost') }
  let(:token) { JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' }) }
  let(:auth) { { 'Authorization' => "Bearer #{token}" } }

  let!(:assessment) { create(:assessment, tenant_id: org.id, name: 'Frontend Developer') }
  let!(:suyono) do
    create(:session, tenant_id: org.id, assessment: assessment, candidate_name: 'Suyono',
                     status: 'active', started_at: Time.current)
  end
  let!(:budi) do
    create(:session, tenant_id: org.id, assessment: assessment, candidate_name: 'Budi',
                     status: 'ended', end_reason: 'all_covered')
  end
  let!(:siti) do
    create(:session, tenant_id: org.id, assessment: assessment, candidate_name: 'Siti',
                     status: 'ended', end_reason: 'error')
  end

  it 'lists candidates with assessment and status' do
    get '/api/v1/candidates', headers: auth

    expect(response).to have_http_status(:ok)
    names = JSON.parse(response.body)['candidates'].map { |c| c['candidate_name'] }
    expect(names).to include('Suyono', 'Budi', 'Siti')
    body = JSON.parse(response.body)['candidates'].first
    expect(body['assessment_name']).to eq('Frontend Developer')
  end

  it 'searches by candidate name (case-insensitive)' do
    get '/api/v1/candidates', params: { q: 'SUY' }, headers: auth

    names = JSON.parse(response.body)['candidates'].map { |c| c['candidate_name'] }
    expect(names).to eq(['Suyono'])
  end

  it 'filters by session status: live' do
    get '/api/v1/candidates', params: { status: 'live' }, headers: auth

    names = JSON.parse(response.body)['candidates'].map { |c| c['candidate_name'] }
    expect(names).to eq(['Suyono'])
  end

  it 'filters by session status: failed' do
    get '/api/v1/candidates', params: { status: 'failed' }, headers: auth

    names = JSON.parse(response.body)['candidates'].map { |c| c['candidate_name'] }
    expect(names).to eq(['Siti'])
  end

  it 'paginates with meta' do
    get '/api/v1/candidates', params: { per_page: 2, page: 1 }, headers: auth

    body = JSON.parse(response.body)
    expect(body['candidates'].length).to eq(2)
    expect(body['meta']['total_count']).to eq(3)
  end
end
