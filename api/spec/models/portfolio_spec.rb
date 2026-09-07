# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio do
  describe '#generation_stale?' do
    it 'is false for a portfolio that is not generating' do
      portfolio = build(:portfolio, generation_status: 'complete')

      expect(portfolio.generation_stale?).to be(false)
    end

    it 'is false while a fresh attempt is still running' do
      portfolio = build(:portfolio, generation_status: 'generating', generation_started_at: 1.minute.ago)

      expect(portfolio.generation_stale?).to be(false)
    end

    it 'is true once the attempt has outlived the timeout window' do
      portfolio = build(
        :portfolio,
        generation_status:     'generating',
        generation_started_at: (Portfolio::STALE_GENERATION_AFTER + 1.minute).ago
      )

      expect(portfolio.generation_stale?).to be(true)
    end

    # Rows written before the generation-tracking migration have no start time.
    # They must read as stale so the portfolios already stuck on "generating"
    # in production become reclaimable rather than staying stuck forever.
    it 'is true for a pre-migration row with no start time' do
      portfolio = build(:portfolio, generation_status: 'generating', generation_started_at: nil)

      expect(portfolio.generation_stale?).to be(true)
    end
  end

  describe '.stuck_generating' do
    it 'returns only the generating rows nothing is working on' do
      fresh = create(:portfolio, generation_status: 'generating', generation_started_at: 1.minute.ago)
      stuck = create(:portfolio, generation_status: 'generating', generation_started_at: 1.hour.ago)
      never_started = create(:portfolio, generation_status: 'generating', generation_started_at: nil)
      create(:portfolio, generation_status: 'complete')

      expect(described_class.stuck_generating).to contain_exactly(stuck, never_started)
      expect(described_class.stuck_generating).not_to include(fresh)
    end
  end

  it 'defaults generation_attempts to zero on a new row' do
    expect(create(:portfolio).generation_attempts).to eq(0)
  end
end
