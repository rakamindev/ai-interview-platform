# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::HttpClient do
  let(:model) { 'gemini-3.1-pro-preview' }
  let(:api_key) { 'test-api-key' }
  let(:client) { described_class.new(model: model, api_key: api_key) }

  describe 'BASE_URL' do
    it 'uses v1beta by default to support preview models' do
      expect(described_class::BASE_URL).to eq('https://generativelanguage.googleapis.com/v1beta')
    end

    it 'allows overriding via GEMINI_API_BASE_URL env var' do
      stub_const('Gemini::HttpClient::BASE_URL', 'https://custom-proxy.example.com/v1beta')
      custom_client = described_class.new(model: model, api_key: api_key)
      expect(custom_client.send(:generate_url)).to start_with('https://custom-proxy.example.com/v1beta')
    end
  end

  describe '#generate_content' do
    let(:prompt) { 'Hello world' }
    let(:mock_response) do
      instance_double(
        Faraday::Response,
        success?: true,
        body: { candidates: [{ content: { parts: [{ text: '{"status":"ok"}' }] } }] }.to_json
      )
    end
    let(:mock_conn) { instance_double(Faraday::Connection) }

    before do
      allow(Faraday).to receive(:new).and_return(mock_conn)
    end

    it 'posts to the v1beta endpoint with model and headers' do
      expected_url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent'
      expect(mock_conn).to receive(:post).with(
        expected_url,
        anything,
        hash_including('x-goog-api-key' => api_key, 'Content-Type' => 'application/json')
      ).and_return(mock_response)

      result = client.generate_content(prompt)
      expect(result).to eq({ 'status' => 'ok' })
    end
  end

  describe 'retry behavior on rate limits (429)' do
    let(:stubs) { Faraday::Adapter::Test::Stubs.new }
    let(:client) do
      described_class.new(
        model: model,
        api_key: api_key,
        adapter: :test,
        adapter_options: stubs,
        retry_options: { interval: 0, backoff_factor: 1 }
      )
    end
    let(:endpoint_path) { "/v1beta/models/#{model}:generateContent" }

    it 'retries POST requests on 429 and succeeds when a subsequent attempt succeeds' do
      attempts = 0
      stubs.post(endpoint_path) do
        attempts += 1
        if attempts == 1
          [429, { 'Content-Type' => 'application/json', 'Retry-After' => '0' }, '{"error":{"message":"Rate limited"}}']
        else
          [200, { 'Content-Type' => 'application/json' }, '{"candidates":[{"content":{"parts":[{"text":"{\"result\":\"success\"}"}]}}]}']
        end
      end

      result = client.generate_content('test prompt')

      expect(attempts).to eq(2)
      expect(result).to eq({ 'result' => 'success' })
    end

    it 'raises RateLimitError after exhausting retries' do
      attempts = 0
      stubs.post(endpoint_path) do
        attempts += 1
        [429, { 'Content-Type' => 'application/json', 'Retry-After' => '0' }, '{"error":{"message":"Rate limited"}}']
      end

      expect {
        client.generate_content('test prompt')
      }.to raise_error(Gemini::HttpClient::RateLimitError, 'Rate limited')

      expect(attempts).to eq(4) # 1 initial + 3 retries
    end
  end
end
