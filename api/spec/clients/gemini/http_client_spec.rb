# frozen_string_literal: true

require 'rails_helper'

# Every non-live model call goes through this client. These specs run its real
# Faraday stack (retry middleware included) with only the network adapter swapped
# for Faraday's test adapter, so no request leaves the machine.
RSpec.describe Gemini::HttpClient do
  let(:url)    { 'https://generativelanguage.googleapis.com/v1/models/gemini-test:generateContent' }
  let(:client) { described_class.new(model: 'gemini-test', api_key: 'test-key', timeout: 5) }
  let(:stubs)  { Faraday::Adapter::Test::Stubs.new }

  before do
    test_stubs = stubs
    allow(Faraday).to receive(:default_adapter).and_return(:test)
    allow(Faraday::Adapter::Test::Stubs).to receive(:new).and_return(test_stubs)
  end

  def gemini_reply(text)
    [200, { 'Content-Type' => 'application/json' },
     { candidates: [{ content: { parts: [{ text: }] } }] }.to_json]
  end

  it 'posts the prompt and temperature, with the key in a header rather than the URL' do
    sent = nil
    stubs.post(url) do |env|
      sent = env
      gemini_reply('{"ok": true}')
    end

    client.generate_content('Rate this transcript', temperature: 0.4)

    expect(sent.url.query).to be_nil
    expect(sent.request_headers['x-goog-api-key']).to eq('test-key')
    body = JSON.parse(sent.request_body)
    expect(body.dig('contents', 0, 'parts', 0, 'text')).to eq('Rate this transcript')
    expect(body.dig('generationConfig', 'temperature')).to eq(0.4)
  end

  it 'returns the model text parsed as JSON' do
    stubs.post(url) { gemini_reply('{"configured_skills": []}') }

    expect(client.generate_content('p')).to eq('configured_skills' => [])
  end

  it 'strips a markdown code fence around the JSON' do
    stubs.post(url) { gemini_reply("```json\n{\"level\": 3}\n```") }

    expect(client.generate_content('p')).to eq('level' => 3)
  end

  it 'returns the raw text when the model answers in prose' do
    stubs.post(url) { gemini_reply('I cannot rate this candidate.') }

    expect(client.generate_content('p')).to eq('I cannot rate this candidate.')
  end

  it 'raises when the response has no text, e.g. a blocked prompt' do
    stubs.post(url) { [200, {}, { candidates: [], promptFeedback: { blockReason: 'SAFETY' } }.to_json] }

    expect { client.generate_content('p') }.to raise_error(described_class::ApiError, 'No content in Gemini response')
  end

  it 'raises a rate-limit error on 429' do
    stubs.post(url) { [429, {}, '{"error": {"status": "RESOURCE_EXHAUSTED"}}'] }

    expect { client.generate_content('p') }
      .to raise_error(described_class::RateLimitError) { |e| expect(e.status).to eq(429) }
  end

  it 'raises an API error carrying the status on a server error' do
    stubs.post(url) { [500, {}, '{"error": {}}'] }

    expect { client.generate_content('p') }
      .to raise_error(described_class::ApiError, 'API returned 500') { |e| expect(e.status).to eq(500) }
  end

  it 'raises a timeout error when the model takes too long' do
    stubs.post(url) { raise Faraday::TimeoutError, 'execution expired' }

    expect { client.generate_content('p') }.to raise_error(described_class::TimeoutError, /timeout after 5s/)
  end

  it 'raises an API error when the connection fails' do
    stubs.post(url) { raise Faraday::ConnectionFailed, 'connection refused' }

    expect { client.generate_content('p') }.to raise_error(described_class::ApiError, /connection refused/)
  end

  describe 'known defect (P2-3)' do
    it 'retries a temporary 503 instead of failing the whole step' do
      pending "P2-3: Faraday's retry middleware skips POST, and every Gemini call is a POST"

      attempts = 0
      stubs.post(url) do
        attempts += 1
        attempts == 1 ? [503, {}, '{"error": {"status": "UNAVAILABLE"}}'] : gemini_reply('{"ok": true}')
      end

      expect(client.generate_content('p')).to eq('ok' => true)
    end
  end
end
