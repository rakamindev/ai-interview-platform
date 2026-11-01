# frozen_string_literal: true

require 'rails_helper'
require 'support/isolated_redis'
require 'support/interview_session_helpers'

RSpec.describe 'GET /api/v1/sessions/:token/candidate', :aggregate_failures do
  include InterviewSessionHelpers
  include IsolatedRedis

  let(:session) { create_interview_session }
  let(:first_browser) { 'a' * 32 }

  before { isolate_claim_store }

  def candidate_info(client_id)
    get "/api/v1/sessions/#{session.invite_token}/candidate", params: { client_id: client_id }
    response.parsed_body
  end

  it 'reports the interview as free before anyone starts it' do
    expect(candidate_info(first_browser)['in_use_elsewhere']).to be(false)
    expect(response).to have_http_status(:ok)
  end

  it 'tells the page why an ended interview ended' do
    session.update!(status: 'ended', end_reason: 'error')

    expect(candidate_info(first_browser)).to include('session_status' => 'ended', 'end_reason' => 'error')
  end

  it 'gives a running interview its remaining time from the server clock' do
    session.update!(status: 'active', started_at: 10.minutes.ago)

    expect(candidate_info(first_browser)['remaining_seconds']).to be_within(2).of(20.minutes.to_i)
  end

  it 'never reports negative time once the limit has passed' do
    session.update!(status: 'active', started_at: 2.hours.ago)

    expect(candidate_info(first_browser)['remaining_seconds']).to eq(0)
  end

  it 'reports no remaining time before the interview starts or after it ends' do
    expect(candidate_info(first_browser)['remaining_seconds']).to be_nil

    session.update!(status: 'ended', end_reason: 'all_covered', started_at: 1.minute.ago)

    expect(candidate_info(first_browser)['remaining_seconds']).to be_nil
  end

  it 'reports the interview in use to every browser except the one that started it' do
    Sessions::ClientClaim.new(session).admit(first_browser)

    expect(candidate_info('b' * 32)['in_use_elsewhere']).to be(true)
    expect(candidate_info(first_browser)['in_use_elsewhere']).to be(false)
  end
end
