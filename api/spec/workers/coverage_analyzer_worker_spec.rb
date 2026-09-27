# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageAnalyzerWorker, type: :worker do
  let(:org) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: org.id, status: 'active') }
  let(:analyzer_double) { instance_double(Coverage::Analyzer) }

  before do
    allow(Coverage::Analyzer).to receive(:new).with(session: session).and_return(analyzer_double)
    allow(Sidekiq).to receive(:redis).and_yield(instance_double(Redis, publish: true))
  end

  it 'does not define advance_stale_partials' do
    expect(described_class.new.respond_to?(:advance_stale_partials, true)).to be false
  end

  describe '#perform' do
    it 'keeps a partial skill with >= 4 probes outside the context window as partial without explicit evidence' do
      coverage_map = create(
        :coverage_map,
        session: session,
        skill_id: 'sk-system-design',
        skill_label: 'System Design',
        state: 'partial',
        probe_count: 4,
        last_signal: 'Initial probe feedback'
      )

      # Analyzer returns no updates for this skill (e.g. it fell outside the sliding context window)
      allow(analyzer_double).to receive(:call).and_return(
        skill_updates: [],
        discovered_skills: []
      )

      described_class.new.perform(session.id, 7)

      expect(coverage_map.reload.state).to eq('partial')
      expect(coverage_map.reload.last_signal).to eq('Initial probe feedback')
    end

    it 'transitions a skill to covered when the analyzer explicitly returns a covered update' do
      coverage_map = create(
        :coverage_map,
        session: session,
        skill_id: 'sk-system-design',
        skill_label: 'System Design',
        state: 'partial',
        probe_count: 3,
        last_signal: 'Initial probe feedback'
      )

      allow(analyzer_double).to receive(:call).and_return(
        skill_updates: [
          {
            coverage_map_id: coverage_map.id,
            skill_id: coverage_map.skill_id,
            skill_label: coverage_map.skill_label,
            new_state: 'covered',
            new_probe_count: 4,
            last_signal: 'Candidate clearly demonstrated distributed caching strategies'
          }
        ],
        discovered_skills: []
      )

      described_class.new.perform(session.id, 4)

      coverage_map.reload
      expect(coverage_map.state).to eq('covered')
      expect(coverage_map.probe_count).to eq(4)
      expect(coverage_map.last_signal).to eq('Candidate clearly demonstrated distributed caching strategies')
    end

    it 'creates discovered skills returned by analyzer' do
      allow(analyzer_double).to receive(:call).and_return(
        skill_updates: [],
        discovered_skills: [
          { label: 'GraphQL', first_mention: 'Candidate discussed GraphQL mutations' }
        ]
      )

      expect do
        described_class.new.perform(session.id, 2)
      end.to change { session.coverage_maps.discovered.count }.by(1)

      discovered = session.coverage_maps.discovered.last
      expect(discovered.skill_label).to eq('GraphQL')
      expect(discovered.state).to eq('initiated')
      expect(discovered.probe_count).to eq(1)
      expect(discovered.last_signal).to eq('Candidate discussed GraphQL mutations')
    end

    it 'skips execution if session has ended' do
      session.update!(status: 'ended')

      expect(Coverage::Analyzer).not_to receive(:new)
      described_class.new.perform(session.id, 5)
    end

    it 'catches and logs errors without raising' do
      allow(analyzer_double).to receive(:call).and_raise(StandardError, 'LLM timeout')

      expect do
        described_class.new.perform(session.id, 3)
      end.not_to raise_error
    end
  end
end
