# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Organization do
  describe '.identify' do
    it 'finds an organization by scheme' do
      organization = create(:organization, scheme: 'acme')

      expect(described_class.identify('acme')).to eq(organization)
    end

    it 'finds an organization by host' do
      organization = create(:organization, host: 'acme.example.com')

      expect(described_class.identify('acme.example.com')).to eq(organization)
    end

    it 'finds an organization by name or identifier' do
      organization = create(:organization, name: 'Acme Corp', identifier: 'acme-corp')

      expect(described_class.identify('Acme Corp')).to eq(organization)
      expect(described_class.identify('acme-corp')).to eq(organization)
    end

    it 'finds an organization by alias host' do
      organization = create(:organization, alias_hosts: ['jobs.acme.example.com'])

      expect(described_class.identify('jobs.acme.example.com')).to eq(organization)
    end

    it 'returns nil when nothing matches' do
      expect(described_class.identify('no-such-scheme')).to be_nil
    end

    it 'returns nil for a blank identifier' do
      expect(described_class.identify(nil)).to be_nil
    end
  end
end
