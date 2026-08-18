# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::HttpClient do
  let(:stubs) { Faraday::Adapter::Test::Stubs.new }
  let(:endpoint) { 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent' }
  let(:client) { described_class.new(model: 'gemini-3.6-flash', api_key: 'test-key', adapter: [:test, stubs]) }

  after { stubs.verify_stubbed_calls }

  describe '#generate_content' do
    context 'when the API returns 429 rate limit' do
      it 'raises RateLimitError with a human message and does NOT retry (healthy quota usage)' do
        stubs.post(endpoint) { [429, { 'retry-after' => '30' }, '{"error":{"code":429}}'] }

        expect { client.generate_content('prompt') }
          .to raise_error(Gemini::HttpClient::RateLimitError) { |e|
            expect(e.status).to eq(429)
            expect(e.message).to include('30')
            expect(e.message.downcase).to include('rate limit')
          }
      end
    end

    context 'when the API returns a non-retryable error' do
      it 'raises ApiError immediately' do
        stubs.post(endpoint) { [400, {}, '{"error":{"code":400}}'] }

        expect { client.generate_content('prompt') }
          .to raise_error(Gemini::HttpClient::ApiError) { |e| expect(e.status).to eq(400) }
      end
    end

    context 'when the API succeeds' do
      it 'parses the candidate text as JSON' do
        payload = { 'candidates' => [{ 'content' => { 'parts' => [{ 'text' => '{"configured_skills":[]}' }] } }] }.to_json
        stubs.post(endpoint) { [200, { 'content-type' => 'application/json' }, payload] }

        result = client.generate_content('prompt')
        expect(result).to eq('configured_skills' => [])
      end
    end
  end
end