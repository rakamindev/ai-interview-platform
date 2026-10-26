# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let(:assessment) { Assessment.create!(tenant_id: 1, created_by: 1, name: 'Backend Engineer', time_limit_min: 30) }
  let(:session)    { Session.create!(assessment:, tenant_id: 1, status: 'active', started_at: 1.minute.ago) }

  # The status broadcast goes to Redis; tests should not depend on a running Redis.
  before { allow(Redis).to receive(:new).and_return(instance_double(Redis, publish: 1, close: nil)) }

  def add_turn(speaker)
    session.transcript_turns.create!(turn_number: session.transcript_turns.count + 1, speaker:, text: 'Contoh jawaban')
  end

  def end_session(reason)
    described_class.new(session).call(reason:)
  end

  context 'when the AI fails before the candidate says anything' do
    it 'ends the session without sending it for assessment' do
      end_session('error')

      expect(session.reload).to have_attributes(status: 'ended', end_reason: 'error')
      expect(session.portfolio).to be_nil
      expect(PortfolioGeneratorWorker.jobs).to be_empty
    end

    it 'does not count AI-only turns as candidate evidence' do
      add_turn('ai')

      end_session('error')

      expect(session.reload.portfolio).to be_nil
      expect(PortfolioGeneratorWorker.jobs).to be_empty
    end

    it 'stays unassessed when the end is triggered twice' do
      end_session('error')
      end_session('error')

      expect(session.reload.portfolio).to be_nil
      expect(PortfolioGeneratorWorker.jobs).to be_empty
    end
  end

  context 'when the AI fails after the candidate has answered' do
    it 'still assesses what the candidate said' do
      add_turn('candidate')

      end_session('error')

      expect(session.reload.portfolio).to have_attributes(generation_status: 'pending')
      expect(PortfolioGeneratorWorker.jobs.map { _1['args'] }).to eq([[session.id]])
    end
  end

  context 'when the candidate ends the interview' do
    it 'keeps the existing behaviour and sends it for assessment' do
      end_session('manual_candidate')

      expect(session.reload).to have_attributes(status: 'ended', end_reason: 'manual_candidate')
      expect(session.portfolio).to be_present
      expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
    end
  end
end
