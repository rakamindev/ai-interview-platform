# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Organization, type: :model do
  describe '.identify' do
    let!(:org) { create(:organization, scheme: 'test-org', identifier: 'test-org', host: 'test.example.com', alias_hosts: ['alias.example.com']) }

    it 'finds by scheme' do
      expect(Organization.identify('test-org')).to eq(org)
    end

    it 'finds by identifier' do
      expect(Organization.identify('test-org')).to eq(org)
    end

    it 'finds by host' do
      expect(Organization.identify('test.example.com')).to eq(org)
    end

    it 'finds by alias_hosts' do
      expect(Organization.identify('alias.example.com')).to eq(org)
    end

    it 'returns default when not found' do
      default = create(:organization, :default)
      expect(Organization.identify('nonexistent')).to eq(default)
    end

    it 'returns default when identifier is blank' do
      expect(Organization.identify('')).to eq(Organization.default_organization)
    end
  end

  describe '.default_organization' do
    it 'returns organization with id 0' do
      default = create(:organization, :default)
      expect(Organization.default_organization).to eq(default)
    end
  end

  describe '#default?' do
    it 'returns true for id 0' do
      org = build(:organization, id: 0)
      expect(org.default?).to be true
    end

    it 'returns false for non-zero id' do
      org = build(:organization, id: 1)
      expect(org.default?).to be false
    end
  end
end