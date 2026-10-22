# frozen_string_literal: true

require 'spec_helper'

RSpec.describe CoverageAnalyzerWorker do
  describe '#create_discovered_skills' do
    let(:worker) { described_class.new }
    let(:session) { double('Session', coverage_maps: coverage_maps) }
    let(:coverage_maps) { double('CoverageMaps') }
    let(:discovered_relation) { double('DiscoveredRelation') }

    before do
      allow(coverage_maps).to receive(:discovered)
        .and_return(discovered_relation)
      allow(discovered_relation).to receive(:count).and_return(0)
      allow(coverage_maps).to receive(:exists?).and_return(false)
    end

    it 'skips invalid labels and still creates subsequent valid skills' do
      expect(coverage_maps).to receive(:create!).once.with(
        hash_including(
          skill_label: 'Ruby',
          is_discovered: true,
          state: 'initiated'
        )
      )

      worker.send(
        :create_discovered_skills,
        session,
        [
          { label: '', first_mention: 'Empty label' },
          { label: 'x' * 256, first_mention: 'Label too long' },
          { label: '  Ruby  ', first_mention: 'Used Ruby at work' }
        ]
      )
    end
  end
end
