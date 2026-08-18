# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Organization, type: :model do
  describe '.identify' do
    let!(:org) { create(:organization, scheme: 'test-corp', host: 'test-corp.localhost') }

    it 'returns the matching organisation by scheme' do
      expect(described_class.identify('test-corp')).to eq(org)
    end

    it 'returns the matching organisation by host' do
      expect(described_class.identify('test-corp.localhost')).to eq(org)
    end

    it 'returns nil for a blank identifier' do
      expect(described_class.identify('')).to be_nil
      expect(described_class.identify(nil)).to be_nil
    end

    it 'returns nil for an unknown scheme instead of falling back to tenant 0' do
      expect(described_class.identify('nonexistent-corp')).to be_nil
    end
  end
end
