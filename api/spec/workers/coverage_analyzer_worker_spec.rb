require 'rails_helper'

# Covers the P2 fix: CoverageAnalyzerWorker#perform used to call
# Coverage::Analyzer.new(session: session).call WITHOUT the required
# `turn_number:` keyword. Every single run raised ArgumentError, silently
# swallowed by this worker's own `rescue => e` — so Flash's coverage analysis
# never actually ran, and the AI kept re-probing skills the candidate had
# already answered ("Flash bleed"). The first example below is the direct
# regression guard for that bug: if `turn_number:` is ever dropped from the
# Coverage::Analyzer.new call again, this test fails the same way the real
# bug did — see "Seeded Fault Test" in the PDF report for a live run of this.
RSpec.describe CoverageAnalyzerWorker do
  let(:session) { create(:session, status: 'active') }
  let(:analyzer_double) { instance_double(Coverage::Analyzer, call: { skill_updates: [], discovered_skills: [] }) }

  before do
    create(:transcript_turn, session: session, turn_number: 1, speaker: 'candidate')
  end

  it 'constructs Coverage::Analyzer with the turn_number it was given' do
    expect(Coverage::Analyzer).to receive(:new)
      .with(session: session, turn_number: 3)
      .and_return(analyzer_double)

    described_class.new.perform(session.id, 3)
  end

  it 'swallows an ArgumentError from a bad Analyzer.new call instead of crashing the worker (the historical symptom)' do
    # Simulates exactly what the old `Coverage::Analyzer.new(session:).call`
    # (missing turn_number:) actually raised.
    allow(Coverage::Analyzer).to receive(:new).and_raise(ArgumentError, 'missing keyword: :turn_number')

    expect { described_class.new.perform(session.id, 1) }.not_to raise_error
    # The bug's real symptom wasn't a raised error reaching Sidekiq — it was
    # silence. Prove analysis never actually completed for this turn:
    last_turn = Sidekiq.redis { |c| c.get("coverage_last_turn:#{session.id}") }
    expect(last_turn).to be_nil
  end

  it 'serializes concurrent runs for the same session via a Redis NX lock, re-enqueueing on contention' do
    Sidekiq.redis { |c| c.set("coverage_lock:#{session.id}", 1, nx: true, px: 20_000) }

    expect(Coverage::Analyzer).not_to receive(:new)
    described_class.new.perform(session.id, 1)

    expect(described_class.jobs.last['args']).to eq([session.id, 1])
  end

  it 'skips a stale run whose turn_number does not exceed the last analyzed turn' do
    Sidekiq.redis { |c| c.set("coverage_last_turn:#{session.id}", 5) }

    expect(Coverage::Analyzer).not_to receive(:new)
    described_class.new.perform(session.id, 3)
  end

  it 'releases the lock even when the analyzer raises' do
    allow(Coverage::Analyzer).to receive(:new).and_raise(StandardError, 'gemini timeout')

    expect { described_class.new.perform(session.id, 1) }.not_to raise_error
    expect(Sidekiq.redis { |c| c.get("coverage_lock:#{session.id}") }).to be_nil
  end
end
