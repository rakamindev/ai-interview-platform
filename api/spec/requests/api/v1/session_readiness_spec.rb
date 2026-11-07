# frozen_string_literal: true

require 'rails_helper'

# The candidate's pre-interview readiness result, recorded so assessors can
# read a weak-connection interview in context instead of blaming the candidate.
RSpec.describe 'POST /api/v1/sessions/:token/readiness', type: :request do
  let(:interview_session) { create(:session) }

  let(:valid_readiness) do
    {
      verdict: 'warn',
      network: { download_mbps: 32.52, upload_mbps: 1.25, latency_ms: 53 },
      checks: { browser: 'passed', network: 'warn', microphone: 'passed', audio_output: 'passed' },
      client: { browser: 'Chrome 142', os: 'Windows' }
    }
  end

  def submit(token, readiness)
    post "/api/v1/sessions/#{token}/readiness", params: { readiness: readiness }, as: :json
  end

  def stored
    interview_session.reload.readiness_check
  end

  it 'stores a sanitised result without a JWT or tenant header' do
    submit(interview_session.invite_token, valid_readiness)

    expect(response).to have_http_status(:ok)
    expect(stored).to include(
      'verdict' => 'warn', 'download_mbps' => 32.52, 'upload_mbps' => 1.25,
      'latency_ms' => 53, 'browser' => 'Chrome 142', 'os' => 'Windows', 'attempts' => 1
    )
    expect(stored['checks']).to eq(
      'browser' => 'passed', 'network' => 'warn', 'microphone' => 'passed', 'audio_output' => 'passed'
    )
    expect(Time.zone.parse(stored['checked_at'])).to be_within(1.minute).of(Time.current)
    expect(response.parsed_body['readiness_check']).to eq(stored)
  end

  it 'keeps unmeasured metrics as null instead of inventing numbers' do
    submit(interview_session.invite_token,
           valid_readiness.merge(network: { download_mbps: nil, upload_mbps: nil, latency_ms: nil }))

    expect(response).to have_http_status(:ok)
    expect(stored.values_at('download_mbps', 'upload_mbps', 'latency_ms')).to eq([nil, nil, nil])
  end

  it 'counts retries and keeps the latest result' do
    submit(interview_session.invite_token, valid_readiness.merge(verdict: 'fail'))
    submit(interview_session.invite_token, valid_readiness.merge(verdict: 'pass'))

    expect(stored).to include('verdict' => 'pass', 'attempts' => 2)
  end

  it 'drops unknown fields and never stores an IP address or raw user agent' do
    leaky = valid_readiness.merge(
      email: 'kandidat@example.test',
      client: { browser: 'Chrome 142', os: 'Windows', user_agent: 'Mozilla/5.0 (Windows NT 10.0)', ip: '203.0.113.7' }
    )

    submit(interview_session.invite_token, leaky)

    expect(response).to have_http_status(:ok)
    expect(stored.keys).to match_array(
      %w[verdict download_mbps upload_mbps latency_ms checks browser os attempts checked_at]
    )
    expect(stored.to_json).not_to include('Mozilla', '203.0.113.7', 'kandidat@example.test')
  end

  it 'truncates over-long client strings' do
    submit(interview_session.invite_token, valid_readiness.merge(client: { browser: 'A' * 500, os: 'B' * 500 }))

    expect(response).to have_http_status(:ok)
    expect(stored['browser'].length).to eq(ReadinessCheck::MAX_CLIENT_STRING)
    expect(stored['os'].length).to eq(ReadinessCheck::MAX_CLIENT_STRING)
  end

  describe 'invalid input' do
    it 'rejects an unknown verdict' do
      submit(interview_session.invite_token, valid_readiness.merge(verdict: 'excellent'))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(stored).to be_nil
    end

    it 'rejects negative and absurd metrics' do
      submit(interview_session.invite_token,
             valid_readiness.merge(network: { download_mbps: 10, upload_mbps: -1, latency_ms: 10_000_000 }))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body.dig('errors', 0, 'detail')).to include(a_string_matching(/upload_mbps/),
                                                                         a_string_matching(/latency_ms/))
      expect(stored).to be_nil
    end

    it 'rejects unknown check states' do
      submit(interview_session.invite_token, valid_readiness.merge(checks: { microphone: 'maybe' }))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(stored).to be_nil
    end

    it 'rejects a missing readiness object' do
      post "/api/v1/sessions/#{interview_session.invite_token}/readiness", params: {}, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  it 'returns 404 for an unknown invite token' do
    submit('not-a-real-token', valid_readiness)

    expect(response).to have_http_status(:not_found)
  end

  it 'refuses to change a session that has already ended' do
    interview_session.update!(status: 'ended', ended_at: Time.current, end_reason: 'manual_candidate')

    submit(interview_session.invite_token, valid_readiness)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(stored).to be_nil
  end

  it 'exposes the result to assessors in the session JSON' do
    submit(interview_session.invite_token, valid_readiness)
    org = Organization.find(interview_session.tenant_id)
    token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org.scheme })

    get "/api/v1/sessions/#{interview_session.id}", headers: { 'Authorization' => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('session', 'readiness_check', 'verdict')).to eq('warn')
  end
end
