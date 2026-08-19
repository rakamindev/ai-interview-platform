# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Organization, type: :model do
  describe '.identify' do
    it 'returns default_organization when identifier is blank' do
      org = Organization.identify(nil)
      expect(org).to eq(Organization.default_organization)
    end

    it 'finds organization by scheme' do
      # Use an existing org from the seed data
      existing = Organization.where('id != 0').first
      if existing
        found = Organization.identify(existing.scheme)
        expect(found).to eq(existing)
      else
        skip 'No non-default organizations in the database'
      end
    end
  end

  describe '#default?' do
    it 'returns true for default org (id=0)' do
      org = Organization.new(id: 0)
      expect(org.default?).to be true
    end

    it 'returns false for non-default org' do
      org = Organization.new(id: 1)
      expect(org.default?).to be false
    end
  end
end
