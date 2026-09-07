# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageAnalyzerWorker do
  let(:assessment) { create(:assessment, :with_prd02_skills) }
  let(:session)    { create(:session, :active, assessment: assessment) }
  let!(:react)     { create(:coverage_map, session: session, skill_label: 'React', state: 'initiated', probe_count: 1) }

  def analyzer_returns(result)
    allow(Coverage::Analyzer).to receive(:new).and_return(instance_double(Coverage::Analyzer, call: result))
  end

  def analyzer_raises(error)
    allow(Coverage::Analyzer).to receive(:new).and_return(
      instance_double(Coverage::Analyzer).tap { |d| allow(d).to receive(:call).and_raise(error) }
    )
  end

  before { allow(Sidekiq).to receive(:redis) }

  describe 'applying an analysis' do
    it 'advances the skill it names' do
      analyzer_returns(
        skill_updates: [{ coverage_map_id: react.id, skill_label: 'React',
                          new_state: 'partial', new_probe_count: 2, last_signal: 'probed twice' }],
        discovered_skills: []
      )

      described_class.new.perform(session.id, 4)

      expect(react.reload).to have_attributes(state: 'partial', probe_count: 2, last_signal: 'probed twice')
    end

    it 'records a skill the candidate raised unprompted' do
      analyzer_returns(skill_updates: [],
                       discovered_skills: [{ label: 'Micro-frontends', first_mention: 'Module Federation' }])

      described_class.new.perform(session.id, 4)

      discovered = session.coverage_maps.discovered.find_by(skill_label: 'Micro-frontends')
      expect(discovered).to have_attributes(state: 'initiated', probe_count: 1)
    end

    it 'does not record the same discovery twice' do
      analyzer_returns(skill_updates: [],
                       discovered_skills: [{ label: 'Micro-frontends', first_mention: 'again' }])

      2.times { described_class.new.perform(session.id, 4) }

      expect(session.coverage_maps.discovered.where(skill_label: 'Micro-frontends').count).to eq(1)
    end

    it 'stops recording discoveries once ten are on the board' do
      10.times { |i| create(:coverage_map, :discovered, session: session, skill_label: "Extra #{i}") }
      analyzer_returns(skill_updates: [], discovered_skills: [{ label: 'One more', first_mention: 'x' }])

      described_class.new.perform(session.id, 4)

      expect(session.coverage_maps.discovered.count).to eq(10)
    end
  end

  describe 'when the analysis fails' do
    # This used to be swallowed with the comment "non-critical — no retry", so
    # the interview carried on against a coverage map that had quietly stopped
    # advancing. A lost analysis is a lost probe: it under-states the confidence
    # the portfolio may later claim and mis-directs the next question. Measured
    # against the live API, five of eleven calls returned 503 in one session.
    it 'raises so Sidekiq can retry rather than losing the probe silently' do
      analyzer_raises(Gemini::HttpClient::ApiError.new('API returned 503'))

      expect { described_class.new.perform(session.id, 4) }
        .to raise_error(Gemini::HttpClient::ApiError)
    end

    it 'leaves the coverage map exactly as it was' do
      analyzer_raises(Gemini::HttpClient::ApiError.new('API returned 503'))

      expect { described_class.new.perform(session.id, 4) }.to raise_error(Gemini::HttpClient::ApiError)
      expect(react.reload).to have_attributes(state: 'initiated', probe_count: 1)
    end

    # A missing session cannot be fixed by trying again.
    it 'gives up quietly when the session no longer exists' do
      expect { described_class.new.perform(-1, 4) }.not_to raise_error
    end

    it 'does nothing once the session has ended' do
      session.update!(status: 'ended', ended_at: Time.current, end_reason: 'all_covered')
      expect(Coverage::Analyzer).not_to receive(:new)

      described_class.new.perform(session.id, 4)
    end
  end

  describe 'retry policy' do
    it 'retries a couple of times and then stops' do
      expect(described_class.sidekiq_options['retry']).to eq(2)
    end

    # The result is only useful while the conversation is still near those
    # turns. A map arriving four exchanges later is worse than no map.
    it 'backs off in seconds, not minutes' do
      expect(described_class.sidekiq_retry_in_block.call(0, nil)).to be <= 10
      expect(described_class.sidekiq_retry_in_block.call(1, nil)).to be <= 10
    end
  end
end
