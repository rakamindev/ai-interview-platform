# frozen_string_literal: true

require 'spec_helper'
require_relative '../../../app/lib/configuration/web_base_url'

# rubocop:disable Metrics/BlockLength
RSpec.describe Configuration::WebBaseUrl do
  describe '.parse!' do
    it 'accepts an absolute HTTP origin for non-production environments' do
      result = described_class.parse!('http://localhost:5173', production: false)

      expect(result).to eq('http://localhost:5173')
    end

    it 'normalizes whitespace and a trailing slash' do
      result = described_class.parse!('  https://web.example.com/  ', production: true)

      expect(result).to eq('https://web.example.com')
    end

    it 'preserves an explicit non-default port' do
      result = described_class.parse!('https://web.example.com:8443', production: true)

      expect(result).to eq('https://web.example.com:8443')
    end

    it 'rejects a missing value' do
      expect do
        described_class.parse!(nil, production: false)
      end.to raise_error(described_class::Invalid, 'WEB_BASE_URL is required')
    end

    it 'rejects a value without an HTTP(S) scheme' do
      expect do
        described_class.parse!('localhost:5173', production: false)
      end.to raise_error(described_class::Invalid, /http or https scheme/)
    end

    it 'rejects credentials in the origin' do
      expect do
        described_class.parse!('https://user:password@web.example.com', production: true)
      end.to raise_error(described_class::Invalid, /must not include credentials/)
    end

    it 'rejects a base URL with an application path' do
      expect do
        described_class.parse!('https://web.example.com/app', production: true)
      end.to raise_error(described_class::Invalid, /must not include a path/)
    end

    it 'rejects a base URL with a query or fragment' do
      aggregate_failures do
        expect do
          described_class.parse!('https://web.example.com?tenant=one', production: true)
        end.to raise_error(described_class::Invalid, /must not include a query/)

        expect do
          described_class.parse!('https://web.example.com#candidate', production: true)
        end.to raise_error(described_class::Invalid, /must not include a fragment/)
      end
    end

    it 'requires HTTPS in production' do
      expect do
        described_class.parse!('http://web.example.com', production: true)
      end.to raise_error(described_class::Invalid, /must use https in production/)
    end
  end
end
# rubocop:enable Metrics/BlockLength
