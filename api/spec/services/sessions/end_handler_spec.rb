# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let(:assessment) { Assessment.create!(tenant_id: 1, created_by: 1, name: 'Backend Portfolio', time_limit_min: 30) }
  let(:session)    { Session.create!(tenant_id: 1, assessment: assessment, status: 'active') }
  let(:redis)      { instance_double(Redis, publish: nil, close: nil) }

  before do
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
    allow(::Redis).to receive(:new).and_return(redis)
  end

  describe '#call' do
    context 'when the transcript is a seeded fault (STT hallucination, non-Latin garbage)' do
      before do
        body = Array.new(40) { %w[응水 水응 한국어 応] }.flatten.join(' ')
        session.transcript_turns.create!(turn_number: 1, speaker: 'candidate', text: body)
        session.transcript_turns.create!(turn_number: 2, speaker: 'ai', text: 'Can you share an example of a production incident you handled?')
      end

      it 'marks the portfolio unverifiable and skips generation instead of grading garbage' do
        described_class.new(session).call(reason: 'manual_assessor')

        portfolio = session.portfolio
        expect(portfolio).to be_present
        expect(portfolio).to be_unverifiable
        expect(portfolio.generation_error).to eq(
          TranscriptIntegrity::REASON_MESSAGES[TranscriptIntegrity.for_session(session).reason]
        )
        expect(PortfolioGeneratorWorker).not_to have_received(:perform_async)
      end
    end

    context 'when the transcript is verifiable' do
      before do
        text = ('I have designed and maintained reliable systems and I always consider edge cases carefully before shipping changes to production. ') * 3
        session.transcript_turns.create!(turn_number: 1, speaker: 'candidate', text: text)
      end

      it 'marks the session ended, enqueues generation, and leaves the portfolio pending' do
        described_class.new(session).call(reason: 'manual_assessor')

        expect(session).to be_ended
        expect(session.end_reason).to eq('manual_assessor')
        expect(session.portfolio).to be_pending
        expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id)
      end
    end
  end
end