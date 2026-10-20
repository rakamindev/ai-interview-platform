# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::MapInjector do
  let(:assessment) { create(:assessment, time_limit_min: 30) }
  let(:session)    { create(:session, assessment:, status: 'active', started_at: Time.current) }

  subject(:injector) { described_class.new(session) }

  describe '#all_covered?' do
    it 'is false when there are no configured skills' do
      expect(injector.all_covered?).to be(false)
    end

    it 'is false while any configured skill is not covered' do
      create(:coverage_map, session:, state: 'covered', probe_count: 3)
      create(:coverage_map, session:, state: 'partial', probe_count: 2)

      expect(injector.all_covered?).to be(false)
    end

    it 'is false while a discovered skill is still only initiated' do
      create(:coverage_map, session:, state: 'covered', probe_count: 3)
      create(:coverage_map, session:, is_discovered: true, state: 'initiated', probe_count: 1)

      expect(injector.all_covered?).to be(false)
    end

    it 'is true once every configured skill is covered' do
      create(:coverage_map, session:, state: 'covered', probe_count: 3)
      create(:coverage_map, session:, is_discovered: true, state: 'partial', probe_count: 2)

      expect(injector.all_covered?).to be(true)
    end
  end

  describe '#injection_text' do
    def payload
      JSON.parse(injector.injection_text[/\[COVERAGE_MAP\]\n(.*)\n\[\/COVERAGE_MAP\]/m, 1])
    end

    it 'points the AI at the least-covered skill' do
      create(:coverage_map, session:, skill_id: 'a', state: 'partial', probe_count: 2)
      create(:coverage_map, session:, skill_id: 'b', state: 'not_yet')

      expect(payload['priority_next']).to eq('b')
    end

    it 'reports pacing from the time left per uncovered skill' do
      3.times { create(:coverage_map, session:) }

      Timecop.travel(session.started_at + 24.minutes) do
        # 6 minutes left for 3 skills = 2 min each
        expect(payload).to include('time_remaining_minutes' => 6, 'skills_remaining' => 3, 'pacing' => 'behind')
      end
    end

    it 'never reports negative time after the limit has passed' do
      create(:coverage_map, session:)

      Timecop.travel(session.started_at + 45.minutes) do
        expect(payload['time_remaining_minutes']).to eq(0)
        expect(payload['pacing']).to eq('critical')
      end
    end
  end

  describe '#coverage_fingerprint' do
    it 'changes when a state changes, so the map is re-injected' do
      map = create(:coverage_map, session:)
      before = injector.coverage_fingerprint

      map.update!(state: 'initiated', probe_count: 1)

      expect(injector.coverage_fingerprint).not_to eq(before)
    end
  end
end
