# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::MapInjector do
  let(:assessment) { create(:assessment, time_limit_min: 30) }
  let(:session) { create(:session, assessment: assessment, started_at: 10.minutes.ago) }
  subject(:injector) { described_class.new(session) }

  describe '#all_covered?' do
    it 'returns false when configured skills are empty' do
      expect(injector.all_covered?).to be false
    end

    it 'returns false when any configured skill is not covered' do
      create(:coverage_map, session: session, state: 'partial')
      expect(injector.all_covered?).to be false
    end

    it 'returns true when all configured skills are covered and no discovered skills are initiated' do
      create(:coverage_map, session: session, state: 'covered')
      expect(injector.all_covered?).to be true
    end

    it 'returns false when a discovered skill is initiated' do
      create(:coverage_map, session: session, state: 'covered', is_discovered: false)
      create(:coverage_map, session: session, state: 'initiated', is_discovered: true)
      expect(injector.all_covered?).to be false
    end
  end

  describe '#injection_text' do
    before do
      create(:coverage_map, session: session, skill_label: 'Ruby', state: 'not_yet')
    end

    it 'returns formatted [COVERAGE_MAP] string' do
      text = injector.injection_text
      expect(text).to start_with('[COVERAGE_MAP]')
      expect(text).to end_with('[/COVERAGE_MAP]')
      expect(text).to include('Ruby')
    end
  end

  describe '#coverage_fingerprint' do
    it 'returns MD5 hash of coverage state' do
      create(:coverage_map, session: session, state: 'not_yet', probe_count: 0)
      fp1 = injector.coverage_fingerprint
      expect(fp1).to be_a(String)
      expect(fp1.length).to eq(32)
    end
  end
end
