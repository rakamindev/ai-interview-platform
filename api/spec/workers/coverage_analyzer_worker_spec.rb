# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageAnalyzerWorker, type: :worker do
  let(:session) { create(:session, :active) }
  let(:assessment) { session.assessment }
  let(:worker) { described_class.new }

  before do
    create_list(:assessment_skill, 2, assessment: assessment)
    create_list(:coverage_map, 2, session: session)
  end

  describe 'sidekiq options' do
    it 'uses coverage queue' do
      expect(described_class.get_sidekiq_options['queue'].to_s).to eq('coverage')
    end

    it 'has retry disabled' do
      expect(described_class.get_sidekiq_options['retry']).to eq(0)
    end
  end

  describe '#perform' do
    let(:mock_analyzer) { instance_double(Coverage::Analyzer) }

    before do
      allow(Coverage::Analyzer).to receive(:new).and_return(mock_analyzer)
      allow(mock_analyzer).to receive(:call).and_return({
        skill_updates: [],
        discovered_skills: []
      })
      allow_any_instance_of(described_class).to receive(:publish_coverage_update)
    end

    it 'analyzes coverage for the session' do
      expect(Coverage::Analyzer).to receive(:new).with(session: session)
      worker.perform(session.id, 1)
    end

    it 'skips ended sessions' do
      session.update!(status: 'ended')
      expect(Coverage::Analyzer).not_to receive(:new)
      worker.perform(session.id, 1)
    end

    it 'handles RecordNotFound gracefully' do
      expect { worker.perform(-1, 1) }.not_to raise_error
    end

    context 'with skill updates' do
      let(:coverage_map) { session.coverage_maps.first }

      before do
        allow(mock_analyzer).to receive(:call).and_return({
          skill_updates: [{ coverage_map_id: coverage_map.id, new_state: 'initiated', new_probe_count: 1, last_signal: 'Test' }],
          discovered_skills: []
        })
      end

      it 'applies skill updates' do
        worker.perform(session.id, 1)
        coverage_map.reload
        expect(coverage_map.state).to eq('initiated')
        expect(coverage_map.probe_count).to eq(1)
      end
    end

    context 'with discovered skills' do
      before do
        allow(mock_analyzer).to receive(:call).and_return({
          skill_updates: [],
          discovered_skills: [{ label: 'New Skill', first_mention: 'Mentioned in turn 3' }]
        })
      end

      it 'creates discovered coverage maps' do
        worker.perform(session.id, 1)
        discovered = session.coverage_maps.discovered
        expect(discovered.count).to eq(1)
        expect(discovered.first.skill_label).to eq('New Skill')
      end
    end
  end
end
