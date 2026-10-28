# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageAnalyzerWorker do
  describe '#advance_stale_partials' do
    it 'does not mark a stale partial skill as covered without verified evidence' do
      session = double('session')
      partial_scope = double('partial_scope')
      stale_scope = double('stale_scope')
      map = double(
        'coverage_map',
        id: 123,
        skill_label: 'REST API Design',
        probe_count: 4
      )

      allow(session).to receive(:coverage_maps).and_return(partial_scope)
      allow(partial_scope).to receive(:where)
        .with(state: 'partial')
        .and_return(stale_scope)
      allow(stale_scope).to receive(:where)
        .with('probe_count >= ?', 4)
        .and_return(stale_scope)
      allow(stale_scope).to receive(:each).and_yield(map)

      expect(map).not_to receive(:update!)

      described_class.new.send(
        :advance_stale_partials,
        session,
        exclude_ids: []
      )
    end
  end
end
