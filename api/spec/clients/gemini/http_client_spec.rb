# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::HttpClient do
  let(:stubs) { Faraday::Adapter::Test::Stubs.new }
  let(:connection) { Faraday.new { |f| f.adapter :test, stubs } }

  def client(api:)
    described_class.new(model: 'gemini-test', api_key: 'k', api:, connection:)
  end

  def interaction(status: 'completed', text: '{"ok": true}')
    {
      'status' => status,
      'steps' => [
        { 'type' => 'thought', 'signature' => 'abc' },
        { 'type' => 'model_output', 'content' => [{ 'type' => 'text', 'text' => text }] }
      ]
    }.to_json
  end

  describe 'generate_content API (default)' do
    it 'posts to models/:model:generateContent and parses the JSON answer' do
      stubs.post('https://generativelanguage.googleapis.com/v1/models/gemini-test:generateContent') do |env|
        expect(env.request_headers['x-goog-api-key']).to eq('k')
        [200, {}, { candidates: [{ content: { parts: [{ text: "```json\n{\"ok\": true}\n```" }] } }] }.to_json]
      end

      expect(client(api: 'generate_content').generate_content('hi')).to eq('ok' => true)
    end
  end

  describe 'interactions API' do
    it 'sends the model, prompt and temperature without storing the interaction' do
      stubs.post('https://generativelanguage.googleapis.com/v1beta/interactions') do |env|
        body = JSON.parse(env.body)
        expect(body).to include('model' => 'gemini-test', 'input' => 'hi', 'store' => false)
        expect(body.dig('generation_config', 'temperature')).to eq(0.4)
        [200, {}, interaction]
      end

      expect(client(api: 'interactions').generate_content('hi', temperature: 0.4)).to eq('ok' => true)
    end

    it 'rejects a truncated (incomplete) interaction instead of parsing half a document' do
      stubs.post('https://generativelanguage.googleapis.com/v1beta/interactions') { [200, {}, interaction(status: 'incomplete', text: '{"ok": ')] }

      expect { client(api: 'interactions').generate_content('hi') }
        .to raise_error(described_class::ApiError, /incomplete/)
    end

    it 'raises a rate limit error on 429' do
      stubs.post('https://generativelanguage.googleapis.com/v1beta/interactions') { [429, {}, '{}'] }

      expect { client(api: 'interactions').generate_content('hi') }.to raise_error(described_class::RateLimitError)
    end
  end

  it 'does not log the response body, which can echo transcript text' do
    stubs.post('https://generativelanguage.googleapis.com/v1/models/gemini-test:generateContent') do
      [400, {}, '{"error": "prompt was: candidate said something private"}']
    end
    allow(Rails.logger).to receive(:error)

    expect { client(api: 'generate_content').generate_content('hi') }.to raise_error(described_class::ApiError)
    expect(Rails.logger).to have_received(:error).with(satisfy { |msg| !msg.include?('private') })
  end

  it 'refuses an unknown API setting' do
    expect { client(api: 'grpc') }.to raise_error(ArgumentError)
  end
end
