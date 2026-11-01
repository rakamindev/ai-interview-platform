# frozen_string_literal: true

require 'rails_helper'
require 'support/isolated_redis'

RSpec.describe 'POST /api/v1/sessions/:id/reset_access', :aggregate_failures do
  include IsolatedRedis

  let!(:organization) do
    Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'test.example.com')
  end
  let!(:session) do
    assessment = Assessment.create!(tenant_id: organization.id, created_by: 7, name: 'Backend', time_limit_min: 30)
    Session.create!(tenant_id: organization.id, assessment: assessment, status: 'active', started_at: Time.current)
  end
  let(:claim) { Sessions::ClientClaim.new(session) }

  before do
    isolate_claim_store
    claim.admit('a' * 32)
  end

  def headers_for(org, role: 'assessor')
    { 'Authorization' => "Bearer #{JsonWebToken.encode(user_id: 7, role: role, scheme: org.scheme)}" }
  end

  def reset_access(reset_id: 'c' * 32, headers: headers_for(organization))
    post "/api/v1/sessions/#{session.id}/reset_access", params: { reset_id: }, headers: headers
  end

  def other_organization
    Organization.create!(name: 'Other Corp', scheme: 'other-corp', identifier: 'other-corp', host: 'other.example.com')
  end

  it 'moves the interview to a new browser and queues the end at the deadline' do
    reset_access

    expect(response).to have_http_status(:ok)
    expect(claim.admit('a' * 32)).to eq(:taken)
    expect(claim.admit('b' * 32)).to match(/\A\h{32}\z/)
    expect(SessionGraceEndWorker.jobs.size).to eq(1)
  end

  it 'does not disconnect a candidate who rejoined when the same request is retried' do
    reset_access
    rejoined = claim.admit('b' * 32)

    reset_access

    expect(response).to have_http_status(:ok)
    expect(claim.replaced?(rejoined)).to be(false)
  end

  it 'requires authentication' do
    reset_access(headers: {})

    expect(response).to have_http_status(:unauthorized).or have_http_status(:forbidden)
    expect(claim.admit('a' * 32)).to match(/\A\h{32}\z/)
  end

  it 'refuses a role without assessor access' do
    reset_access(headers: headers_for(organization, role: 'candidate'))

    expect(response).to have_http_status(:forbidden)
    expect(claim.admit('a' * 32)).to match(/\A\h{32}\z/)
  end

  it 'does not reset a session that belongs to another tenant' do
    reset_access(headers: headers_for(other_organization))

    expect(response).to have_http_status(:not_found)
    expect(claim.admit('a' * 32)).to match(/\A\h{32}\z/)
  end

  it 'refuses an ended session' do
    session.update!(status: 'ended')

    reset_access

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'refuses a malformed reset id' do
    [nil, 'short', 'C' * 32].each do |reset_id|
      reset_access(reset_id:)

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  it 'reports a retryable error when Redis is unavailable' do
    allow(Redis).to receive(:new).with(url: ENV.fetch('REDIS_URL')).and_raise(Redis::CannotConnectError)

    reset_access

    expect(response).to have_http_status(:service_unavailable)
    expect(response.parsed_body.dig('errors', 0, 'message')).to include('Please try again')
  end
end
