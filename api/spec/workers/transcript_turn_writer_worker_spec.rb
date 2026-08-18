require 'rails_helper'

# Covers the P0 fix: transcript writes used to run inline on the audio
# WebSocket's EventMachine thread via Thread.new + connection_pool.with_connection,
# and a duplicate delivery was silently swallowed by `rescue RecordNotUnique`
# (the transcript vanished with no trace). This worker is what replaced both:
# it runs off-thread on Sidekiq, and upserts instead of create!+rescue.
RSpec.describe TranscriptTurnWriterWorker do
  let(:session) { create(:session, status: 'active') }

  it 'persists a new transcript turn' do
    expect {
      described_class.new.perform(session.id, 1, 'candidate', 'Hello there')
    }.to change(TranscriptTurn, :count).by(1)

    turn = session.transcript_turns.find_by(turn_number: 1)
    expect(turn.speaker).to eq('candidate')
    expect(turn.text).to eq('Hello there')
  end

  it 'overwrites in place on a duplicate (session_id, turn_number) delivery instead of dropping it' do
    described_class.new.perform(session.id, 1, 'candidate', 'first draft')

    expect {
      described_class.new.perform(session.id, 1, 'candidate', 'corrected text')
    }.not_to change(TranscriptTurn, :count)

    turn = session.transcript_turns.find_by(turn_number: 1)
    expect(turn.text).to eq('corrected text')
  end

  it 'chains CoverageAnalyzerWorker only for candidate turns, not AI turns' do
    described_class.new.perform(session.id, 1, 'candidate', 'candidate turn')
    expect(CoverageAnalyzerWorker.jobs.size).to eq(1)
    expect(CoverageAnalyzerWorker.jobs.last['args']).to eq([session.id, 1])

    CoverageAnalyzerWorker.clear

    described_class.new.perform(session.id, 2, 'ai', 'ai turn')
    expect(CoverageAnalyzerWorker.jobs).to be_empty
  end

  it 'skips writing once the session has already ended' do
    ended_session = create(:session, :ended)

    expect {
      described_class.new.perform(ended_session.id, 1, 'candidate', 'too late')
    }.not_to change(TranscriptTurn, :count)
  end

  it 'does not raise when the session no longer exists (deleted mid-flight)' do
    expect {
      described_class.new.perform(0, 1, 'candidate', 'orphaned')
    }.not_to raise_error
  end
end
