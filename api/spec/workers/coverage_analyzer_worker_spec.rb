# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageAnalyzerWorker do
  subject(:run) { described_class.new.perform(session.id, 7) }

  let(:session) { create(:session, :active) }

  let(:analyzer_result) { { skill_updates: [], discovered_skills: [] } }

  before do
    allow(Coverage::Analyzer).to receive(:new).and_return(instance_double(Coverage::Analyzer, call: analyzer_result))
    allow(Sidekiq).to receive(:redis).and_yield(instance_double(Redis, publish: 1))
  end

  describe 'promotion by the analyzer' do
    let!(:map) { create(:coverage_map, session: session, state: 'partial', probe_count: 2) }

    let(:analyzer_result) do
      {
        skill_updates: [
          { coverage_map_id: map.id, new_state: 'covered', new_probe_count: 3,
            last_signal: 'Candidate described profiling methodology and test strategy' }
        ],
        discovered_skills: []
      }
    end

    it 'records the analyzer as the source of the promotion' do
      run

      expect(map.reload).to have_attributes(state: 'covered', covered_by: 'analyzer')
    end
  end

  describe 'promotion by the stale partial sweep' do
    let!(:map) { create(:coverage_map, :stale_partial, session: session) }

    it 'promotes a partial skill that has enough probes' do
      run

      expect(map.reload.state).to eq('covered')
    end

    # The sweep solves a real problem, but it is a probe count heuristic.
    # Downstream has to be able to tell it apart from a judged promotion.
    it 'records the sweep, not the analyzer, as the source' do
      run

      expect(map.reload.covered_by).to eq('window_timeout')
    end

    it 'leaves a skill with too few probes alone' do
      thin = create(:coverage_map, :partial, session: session)

      run

      expect(thin.reload).to have_attributes(state: 'partial', covered_by: nil)
    end
  end

  describe 'skills touched in the same run' do
    let!(:map) { create(:coverage_map, :stale_partial, session: session) }

    let(:analyzer_result) do
      {
        skill_updates: [
          { coverage_map_id: map.id, new_state: 'partial', new_probe_count: 5,
            last_signal: 'Still thin on edge cases' }
        ],
        discovered_skills: []
      }
    end

    it 'does not sweep a skill the analyzer just looked at' do
      run

      expect(map.reload).to have_attributes(state: 'partial', covered_by: nil)
    end
  end

  describe 'an ended session' do
    let(:session) { create(:session, :ended) }
    let!(:map) { create(:coverage_map, :stale_partial, session: session) }

    it 'does no work' do
      run

      expect(map.reload).to have_attributes(state: 'partial', covered_by: nil)
    end
  end
end
