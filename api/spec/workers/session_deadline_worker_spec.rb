# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SessionDeadlineWorker do
  before do
    @organization = Organization.create!(
      name: 'Test Org', scheme: 'test-org', identifier: 'test-org', host: 'test-org.test'
    )
    within_organization do
      @assessment = Assessment.new(name: 'Jr. Backend Engineer', time_limit_min: 10, created_by: 1)
      @assessment.save!
    end
  end

  def create_session(status:, started_at: nil)
    within_organization do
      session = Session.new(assessment: @assessment, candidate_name: 'Test Candidate A',
                            status: status, started_at: started_at)
      session.save!
      session
    end
  end

  def add_turn(session, speaker)
    session.transcript_turns.create!(turn_number: session.transcript_turns.count + 1, speaker: speaker, text: 'Hello')
  end

  describe 'when an active session is past its deadline' do
    it 'ends it as disconnected when the candidate never answered' do
      session = create_session(status: 'active', started_at: 2.days.ago)
      add_turn(session, 'ai')

      described_class.new.perform(session.id)

      session.reload
      expect(session.status).to eq('ended')
      expect(session.end_reason).to eq('error')
      expect(session.failure_code).to eq('candidate_disconnected')
    end

    it 'ends it as a normal time-limit end when the candidate answered' do
      session = create_session(status: 'active', started_at: 20.minutes.ago)
      add_turn(session, 'ai')
      add_turn(session, 'candidate')

      described_class.new.perform(session.id)

      session.reload
      expect(session.status).to eq('ended')
      expect(session.end_reason).to eq('time_ceiling')
      expect(session.failure_code).to be_nil
    end
  end

  describe 'when there is nothing to end' do
    it 'leaves an active session alone before its deadline' do
      session = create_session(status: 'active', started_at: 5.minutes.ago)

      described_class.new.perform(session.id)

      expect(session.reload.status).to eq('active')
    end

    it 'leaves pending and ended sessions alone' do
      pending_session = create_session(status: 'pending')
      ended_session = create_session(status: 'ended', started_at: 2.days.ago)

      described_class.new.perform(pending_session.id)
      described_class.new.perform(ended_session.id)

      expect(pending_session.reload.status).to eq('pending')
      expect(ended_session.reload.end_reason).to be_nil
    end
  end

  describe '.end_overdue_sessions' do
    it 'ends every overdue active session and nothing else' do
      overdue = create_session(status: 'active', started_at: 2.days.ago)
      running = create_session(status: 'active', started_at: 2.minutes.ago)

      expect(described_class.end_overdue_sessions).to eq([overdue.id])
      expect(overdue.reload.status).to eq('ended')
      expect(running.reload.status).to eq('active')
    end
  end
end
