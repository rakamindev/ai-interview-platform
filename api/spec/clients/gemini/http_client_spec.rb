# frozen_string_literal: true

require 'rails_helper'
require 'faraday/adapter/test'

RSpec.describe Gemini::HttpClient do
  let(:api_key) { 'test-api-key' }
  let(:model) { 'gemini-test-model' }

  let(:response_body) do
    {
      candidates: [
        {
          content: {
            parts: [{ text: '{"result":"success"}' }]
          }
        }
      ]
    }.to_json
  end

  def build_client(stubs)
    client = described_class.new(
      model: model,
      api_key: api_key,
      timeout: 5
    )

    connection = Faraday.new do |f|
      f.request :retry,
                methods: [:post],
                max: 3,
                interval: 0,
                interval_randomness: 0,
                backoff_factor: 1,
                retry_statuses: [429, 500, 502, 503],
                retry_block: lambda { |env:, retry_count:, exception:, will_retry_in:, **_|
                  Rails.logger.warn(
                    "[Test] Retry ##{retry_count}: #{exception&.message}"
                  )
                }

      f.adapter :test, stubs
    end

    client.instance_variable_set(:@connection, connection)
    client
  end

  describe '#generate_content' do
    it 'retries a 503 response and succeeds on the next attempt' do
      attempts = 0

      stubs = Faraday::Adapter::Test::Stubs.new do |stub|
        stub.post('/v1/models/gemini-test-model:generateContent') do
          attempts += 1

          if attempts == 1
            [503, { 'Content-Type' => 'application/json' }, '{"error":"temporary"}']
          else
            [200, { 'Content-Type' => 'application/json' }, response_body]
          end
        end
      end

      client = build_client(stubs)

      result = client.generate_content('test prompt')

      expect(result).to eq('result' => 'success')
      expect(attempts).to eq(2)
    end

    it 'raises RateLimitError after repeated 429 responses' do
      attempts = 0

      stubs = Faraday::Adapter::Test::Stubs.new do |stub|
        stub.post('/v1/models/gemini-test-model:generateContent') do
          attempts += 1
          [429, { 'Content-Type' => 'application/json' }, '{"error":"rate limited"}']
        end
      end

      client = build_client(stubs)

      expect do
        client.generate_content('test prompt')
      end.to raise_error(Gemini::HttpClient::RateLimitError) { |error|
        expect(error.status).to eq(429)
      }

      expect(attempts).to eq(4)
    end
  end
end
