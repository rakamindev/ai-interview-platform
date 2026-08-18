# frozen_string_literal: true

require 'rails_helper'

# List endpoints must support server-side search/filter/sort so pagination and
# filtering stay consistent (the frontend wires them together).
RSpec.describe 'Assessments list filtering', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp', identifier: 'test-corp', name: 'Test Corp', host: 'localhost') }
  let(:token) { JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' }) }
  let(:auth) { { 'Authorization' => "Bearer #{token}" } }

  let!(:frontend_en) { create(:assessment, tenant_id: org.id, name: 'Frontend Developer', language: 'en') }
  let!(:backend_id)  { create(:assessment, tenant_id: org.id, name: 'Backend Engineer', language: 'id') }

  # Sessions drive the status filter: awaiting / live / completed / failed.
  let!(:live)      { create(:assessment, tenant_id: org.id, name: 'Live One') }
  let!(:completed) { create(:assessment, tenant_id: org.id, name: 'Done One') }
  let!(:failed)    { create(:assessment, tenant_id: org.id, name: 'Broke One') }
  let!(:live_session)      { create(:session, tenant_id: org.id, assessment: live, status: 'active') }
  let!(:completed_session) { create(:session, tenant_id: org.id, assessment: completed, status: 'ended', end_reason: 'all_covered') }
  let!(:failed_session)    { create(:session, tenant_id: org.id, assessment: failed, status: 'ended', end_reason: 'error') }

  it 'searches by name (case-insensitive)' do
    get '/api/v1/assessments', params: { q: 'frontend' }, headers: auth

    names = JSON.parse(response.body)['assessments'].map { |a| a['name'] }
    expect(names).to eq(['Frontend Developer'])
  end

  it 'filters by language' do
    get '/api/v1/assessments', params: { language: 'id' }, headers: auth

    names = JSON.parse(response.body)['assessments'].map { |a| a['name'] }
    expect(names).to eq(['Backend Engineer'])
  end

  it 'filters by latest session status: live' do
    get '/api/v1/assessments', params: { status: 'live' }, headers: auth

    names = JSON.parse(response.body)['assessments'].map { |a| a['name'] }
    expect(names).to eq(['Live One'])
  end

  it 'filters by latest session status: failed' do
    get '/api/v1/assessments', params: { status: 'failed' }, headers: auth

    names = JSON.parse(response.body)['assessments'].map { |a| a['name'] }
    expect(names).to eq(['Broke One'])
  end

  it 'filters by latest session status: completed (ended without error)' do
    get '/api/v1/assessments', params: { status: 'completed' }, headers: auth

    names = JSON.parse(response.body)['assessments'].map { |a| a['name'] }
    expect(names).to eq(['Done One'])
  end

  it 'sorts by name ascending' do
    get '/api/v1/assessments', params: { sort: 'name' }, headers: auth

    names = JSON.parse(response.body)['assessments'].map { |a| a['name'] }
    expect(names.first).to eq('Backend Engineer')
    expect(names.last).to eq('Live One')
  end

  it 'returns pagination meta' do
    get '/api/v1/assessments', params: { per_page: 2, page: 1 }, headers: auth

    body = JSON.parse(response.body)
    expect(body['assessments'].length).to eq(2)
    expect(body['meta']['total_count']).to eq(5)
    expect(body['meta']['total_pages']).to eq(3)
  end
end
