# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let(:assessment) { create(:assessment) }
  let(:session) { create(:session, :active, assessment: assessment) }

  subject { described_class.new(session) }

  describe '#call' do
    it 'ends the session, calculates duration, creates a pending portfolio, and enqueues worker' do
      expect(PortfolioGeneratorWorker).to receive(:perform_async).with(session.id)

      ended_session = subject.call(reason: 'all_covered')

      expect(ended_session.status).to eq('ended')
      expect(ended_session.end_reason).to eq('all_covered')
      expect(ended_session.ended_at).to be_present
      expect(ended_session.duration_seconds).to be >= 0
      expect(ended_session.portfolio).to be_present
      expect(ended_session.portfolio.generation_status).to eq('pending')
    end

    it 'is idempotent and does not recreate portfolio or duplicate jobs for ended sessions' do
      subject.call(reason: 'all_covered')

      expect(PortfolioGeneratorWorker).not_to receive(:perform_async)
      second_call = subject.call(reason: 'manual_candidate')

      expect(second_call.status).to eq('ended')
      expect(second_call.end_reason).to eq('all_covered')
    end

    it 'allows upgrading an error termination to clean manual reason' do
      session.update!(status: 'ended', end_reason: 'error', ended_at: Time.current)

      upgraded = subject.call(reason: 'manual_candidate')
      expect(upgraded.end_reason).to eq('manual_candidate')
    end
  end
end
