# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageMap, type: :model do
  describe 'validations' do
    it { should validate_presence_of(:skill_label) }
    it { should validate_inclusion_of(:state).in_array(CoverageMap::STATES) }
  end

  describe 'associations' do
    it { should belong_to(:session) }
  end

  describe 'scopes' do
    let!(:session) { create(:session, :active) }
    let!(:configured) { create(:coverage_map, session: session, is_discovered: false) }
    let!(:discovered) { create(:coverage_map, :discovered, session: session) }

    it '.configured returns non-discovered maps' do
      expect(CoverageMap.configured).to include(configured)
      expect(CoverageMap.configured).not_to include(discovered)
    end

    it '.discovered returns discovered maps' do
      expect(CoverageMap.discovered).to include(discovered)
      expect(CoverageMap.discovered).not_to include(configured)
    end
  end

  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:coverage_map)).to be_valid
    end

    it 'has valid traits' do
      expect(build(:coverage_map, :initiated)).to be_valid
      expect(build(:coverage_map, :partial)).to be_valid
      expect(build(:coverage_map, :covered)).to be_valid
      expect(build(:coverage_map, :discovered)).to be_valid
    end
  end
end
