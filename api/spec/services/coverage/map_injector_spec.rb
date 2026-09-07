# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::MapInjector do
  let(:assessment) { create(:assessment, :with_prd02_skills, time_limit_min: 45) }
  let(:session)    { create(:session, :active, assessment: assessment) }

  subject(:injector) { described_class.new(session) }

  def configured(label, state:, probe_count: 0)
    create(:coverage_map, session: session, skill_label: label, state: state, probe_count: probe_count)
  end

  def discovered(label, state: 'initiated', probe_count: 1)
    create(:coverage_map, :discovered, session: session, skill_label: label,
                                       state: state, probe_count: probe_count)
  end

  describe '#all_covered?' do
    it 'is false while any configured skill is unfinished' do
      configured('React',         state: 'covered', probe_count: 3)
      configured('Communication', state: 'partial', probe_count: 2)

      expect(injector.all_covered?).to be false
    end

    it 'is false when the session has no skills at all' do
      expect(injector.all_covered?).to be false
    end

    it 'is true once every configured skill is covered' do
      configured('React',         state: 'covered', probe_count: 3)
      configured('Communication', state: 'covered', probe_count: 3)
      configured('System Design', state: 'covered', probe_count: 3)

      expect(injector.all_covered?).to be true
    end

    # A discovered skill is a courtesy probe, not part of the agenda the
    # assessor configured. PRD 01 asks the AI to explore one briefly and return
    # to the agenda — it is explicitly not something the interview is *for*.
    #
    # But a discovered skill is born `initiated` with probe_count 1, and
    # StateEngine will not let anything leave `initiated` below probe_count 2.
    # So a skill the candidate mentions in passing on their last answer can
    # never advance, and `all_covered?` never returns true again.
    #
    # The session then runs to its time ceiling: the agenda finished at minute
    # 20, and the candidate is held to minute 45 because they said a word.
    context 'when the candidate mentions a new skill on their final answer' do
      before do
        configured('React',         state: 'covered', probe_count: 3)
        configured('Communication', state: 'covered', probe_count: 3)
        configured('System Design', state: 'covered', probe_count: 3)
        discovered('Design Systems', state: 'initiated', probe_count: 1)
      end

      it 'still lets the session finish' do
        expect(injector.all_covered?).to be true
      end
    end
  end

  describe '#coverage_fingerprint' do
    it 'changes when a skill advances' do
      map = configured('React', state: 'initiated', probe_count: 1)
      before = injector.coverage_fingerprint

      map.update!(state: 'partial', probe_count: 2)

      expect(described_class.new(session.reload).coverage_fingerprint).not_to eq(before)
    end

    # Deliberate: the clock ticks every second, and re-injecting an unchanged
    # map on every tick would burn context for nothing.
    it 'ignores the passage of time' do
      configured('React', state: 'initiated', probe_count: 1)
      before = injector.coverage_fingerprint

      travel_to(10.minutes.from_now) do
        expect(described_class.new(session.reload).coverage_fingerprint).to eq(before)
      end
    end
  end

  describe '#injection_text' do
    before do
      configured('React',         state: 'covered', probe_count: 3)
      configured('Communication', state: 'not_yet')
      configured('System Design', state: 'partial', probe_count: 2)
    end

    it 'wraps the payload in the sentinel the system prompt is told to expect' do
      expect(injector.injection_text).to start_with('[COVERAGE_MAP]').and end_with('[/COVERAGE_MAP]')
    end

    it 'points the interviewer at the least-explored skill first' do
      payload = JSON.parse(injector.injection_text[/\{.*\}/m])

      expect(payload['priority_next']).to eq('communication')
      expect(payload['skills_remaining']).to eq(2)
    end

    it 'never proposes a skill that is already covered' do
      payload = JSON.parse(injector.injection_text[/\{.*\}/m])

      covered = payload['skills'].select { |s| s['state'] == 'covered' }.map { |s| s['id'] }
      expect(covered).not_to include(payload['priority_next'])
    end
  end
end
