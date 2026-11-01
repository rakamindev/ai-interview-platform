# frozen_string_literal: true

require 'rails_helper'
require 'support/isolated_redis'
require 'support/interview_session_helpers'

RSpec.describe SessionGraceEndWorker, :aggregate_failures do
  include InterviewSessionHelpers
  include IsolatedRedis

  let(:session) { create_interview_session }
  let(:claim) { Sessions::ClientClaim.new(session) }
  let(:browser) { 'a' * 32 }

  before do
    isolate_claim_store
    session.update!(status: 'active', started_at: Time.current)
  end

  it 'ends the session when the candidate never rejoined' do
    connection = claim.admit(browser)

    described_class.new.perform(session.id, connection)

    expect(session.reload).to have_attributes(status: 'ended', end_reason: 'error')
  end

  it 'leaves the session running when the candidate rejoined first' do
    old_connection = claim.admit(browser)
    claim.admit(browser)

    described_class.new.perform(session.id, old_connection)

    expect(session.reload.status).to eq('active')
  end

  it 'leaves a session running when access was reset and the new browser joined' do
    claim.admit(browser)
    reset_connection, = claim.reset('c' * 32)
    claim.admit('b' * 32)

    described_class.new.perform(session.id, reset_connection)

    expect(session.reload.status).to eq('active')
  end

  it 'ends the session when access was reset and nobody returned' do
    claim.admit(browser)
    reset_connection, = claim.reset('c' * 32)

    described_class.new.perform(session.id, reset_connection)

    expect(session.reload.status).to eq('ended')
  end

  it 'never ends a session that has not started' do
    session.update!(status: 'pending', started_at: nil)
    connection = claim.admit(browser)

    described_class.new.perform(session.id, connection)

    expect(session.reload.status).to eq('pending')
  end

  it 'does not overwrite the end reason of a session that already ended' do
    connection = claim.admit(browser)
    Sessions::EndHandler.new(session).call(reason: 'all_covered')

    described_class.new.perform(session.id, connection)

    expect(session.reload.end_reason).to eq('all_covered')
  end

  it 'retries through Sidekiq when Redis is unavailable, leaving the session running' do
    connection = claim.admit(browser)
    allow(Redis).to receive(:new).and_raise(Redis::CannotConnectError)

    expect { described_class.new.perform(session.id, connection) }
      .to raise_error(Sessions::ClientClaim::Unavailable)
    expect(session.reload.status).to eq('active')
  end
end
