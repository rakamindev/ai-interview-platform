# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::EmbeddingClient do
  let(:custom_org) do
    Organization.create!(
      name: 'Custom Embedding Org',
      scheme: 'custom-embed-org',
      identifier: 'custom-embed-org',
      host: 'custom-embed.test',
      config: {
        'ai' => {
          'gemini_api_key' => 'AIzaSyEmbeddingTenantKey'
        }
      }
    )
  end

  let(:default_org) do
    Organization.create!(
      name: 'Default Embedding Org',
      scheme: 'default-embed-org',
      identifier: 'default-embed-org',
      host: 'default-embed.test'
    )
  end

  describe '#initialize' do
    it 'injects tenant-specific credentials from organization' do
      client = described_class.new(organization: custom_org)

      expect(client.api_key).to eq('AIzaSyEmbeddingTenantKey')
      expect(client.model).to eq('text-embedding-004')
    end

    it 'falls back to ENV when organization has no custom config' do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with('GEMINI_API_KEY').and_return('ENV_GLOBAL_KEY_EMBED')

      client = described_class.new(organization: default_org)

      expect(client.api_key).to eq('ENV_GLOBAL_KEY_EMBED')
    end

    it 'raises ArgumentError if API key is blank' do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with('GEMINI_API_KEY').and_return(nil)

      expect {
        described_class.new(organization: default_org)
      }.to raise_error(ArgumentError, /Gemini API key is required/)
    end
  end

  describe '#embed' do
    let(:client) { described_class.new(api_key: 'test-api-key') }

    it 'returns an empty array when text is blank' do
      expect(client.embed('')).to eq([])
      expect(client.embed(nil)).to eq([])
    end

    it 'returns parsed 768-dim float vector on successful API response' do
      dummy_vector = Array.new(768) { |i| (i * 0.001).round(4) }
      mock_response = instance_double(
        Faraday::Response,
        success?: true,
        status: 200,
        body: { 'embedding' => { 'values' => dummy_vector } }.to_json
      )

      allow_any_instance_of(Faraday::Connection).to receive(:post).and_return(mock_response)

      result = client.embed('PostgreSQL indexing and performance tuning')
      expect(result.size).to eq(768)
      expect(result.first).to be_a(Float)
      expect(result).to eq(dummy_vector)
    end

    it 'raises RateLimitError on 429 response' do
      mock_response = instance_double(
        Faraday::Response,
        success?: false,
        status: 429,
        body: '{"error": {"message": "Resource exhausted"}}'
      )

      allow_any_instance_of(Faraday::Connection).to receive(:post).and_return(mock_response)

      expect {
        client.embed('PostgreSQL query optimization')
      }.to raise_error(Gemini::HttpClient::RateLimitError)
    end

    it 'raises TimeoutError on Faraday::TimeoutError' do
      allow_any_instance_of(Faraday::Connection).to receive(:post).and_raise(Faraday::TimeoutError.new('Execution expired'))

      expect {
        client.embed('PostgreSQL query optimization')
      }.to raise_error(Gemini::HttpClient::TimeoutError)
    end
  end
end
