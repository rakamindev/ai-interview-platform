# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageMap, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:session) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:skill_label) }
    it { is_expected.to validate_inclusion_of(:state).in_array(%w[not_yet initiated partial covered]) }
    it { is_expected.to validate_numericality_of(:probe_count).only_integer.is_greater_than_or_equal_to(0) }
  end

  describe 'scopes' do
    let!(:session) { create(:session, :active) }
    let!(:configured_map) { create(:coverage_map, :configured, session: session) }
    let!(:discovered_map) { create(:coverage_map, :discovered, session: session) }

    describe '.configured' do
      it 'returns configured coverage maps' do
        expect(session.coverage_maps.configured).to include(configured_map)
        expect(session.coverage_maps.configured).not_to include(discovered_map)
      end
    end

    describe '.discovered' do
      it 'returns discovered coverage maps' do
        expect(session.coverage_maps.discovered).to include(discovered_map)
        expect(session.coverage_maps.discovered).not_to include(configured_map)
      end
    end
  end

  describe 'constants' do
    it 'defines STATES' do
      expect(CoverageMap::STATES).to eq(%w[not_yet initiated partial covered])
    end
  end
end
