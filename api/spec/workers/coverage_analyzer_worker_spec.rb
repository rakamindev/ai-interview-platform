# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageAnalyzerWorker do
  describe '#perform' do
    let(:session) { create(:session, :active) }

    before do
      allow_any_instance_of(Coverage::Analyzer).to receive(:call).and_return(
        { skill_updates: [], discovered_skills: [] }
      )
      allow(Sidekiq).to receive(:redis).and_yield(double(publish: nil))
    end

    it 'calls Coverage::Analyzer' do
      expect_any_instance_of(Coverage::Analyzer).to receive(:call)
      described_class.new.perform(session.id, 1)
    end

    it 'skips ended sessions' do
      session.update!(status: 'ended')
      expect_any_instance_of(Coverage::Analyzer).not_to receive(:call)
      described_class.new.perform(session.id, 1)
    end

    it 'handles missing session gracefully' do
      expect(Rails.logger).to receive(:warn).with(/not found/)
      described_class.new.perform(-1, 1)
    end
  end
end
