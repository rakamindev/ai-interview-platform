# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Organization, type: :model do
  describe '.identify (Finding F-5: Organization schema/table lookup)' do
    let!(:test_org) do
      Organization.find_by(scheme: 'corp_scheme') || Organization.create!(
        name: 'Corporate Tenant',
        scheme: 'corp_scheme',
        identifier: 'corp-ident-789',
        host: 'portal.corp.com',
        alias_hosts: ['alias.corp.com']
      )
    end

    it 'uses public.organizations table directly' do
      expect(described_class.table_name).to eq('public.organizations')
    end

    it 'identifies tenant correctly by scheme' do
      org = described_class.identify('corp_scheme')
      expect(org).to be_present
      expect(org.id).to eq(test_org.id)
    end

    it 'identifies tenant correctly by identifier' do
      org = described_class.identify('corp-ident-789')
      expect(org).to be_present
      expect(org.id).to eq(test_org.id)
    end

    it 'identifies tenant correctly by host' do
      org = described_class.identify('portal.corp.com')
      expect(org).to be_present
      expect(org.id).to eq(test_org.id)
    end

    it 'identifies tenant correctly by alias host' do
      org = described_class.identify('alias.corp.com')
      expect(org).to be_present
      expect(org.id).to eq(test_org.id)
    end
  end
end
