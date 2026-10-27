# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::HttpClient, type: :client do
  let(:api_key) { 'test_api_key' }
  let(:model) { 'gemini-2.0-flash-001' }
  let(:client) { described_class.new(model: model, api_key: api_key) }

  describe '#request_body' do
    it 'enforces responseMimeType as application/json' do
      body_json = client.send(:request_body, 'Test prompt', 0.2)
      parsed = JSON.parse(body_json)

      expect(parsed['generationConfig']['responseMimeType']).to eq('application/json')
      expect(parsed['generationConfig']['temperature']).to eq(0.2)
    end
  end

  describe '#parse_response' do
    let(:fake_response) { instance_double(Faraday::Response) }

    it 'parses pure JSON correctly' do
      payload = { 'candidates' => [{ 'content' => { 'parts' => [{ 'text' => '{"status":"ok","score":5}' }] } }] }
      allow(fake_response).to receive(:success?).and_return(true)
      allow(fake_response).to receive(:body).and_return(payload.to_json)

      result = client.send(:parse_response, fake_response)
      expect(result).to eq({ 'status' => 'ok', 'score' => 5 })
    end

    it 'strips markdown code fences when present' do
      payload = { 'candidates' => [{ 'content' => { 'parts' => [{ 'text' => "```json\n{\"status\":\"ok\"}\n```" }] } }] }
      allow(fake_response).to receive(:success?).and_return(true)
      allow(fake_response).to receive(:body).and_return(payload.to_json)

      result = client.send(:parse_response, fake_response)
      expect(result).to eq({ 'status' => 'ok' })
    end

    it 'extracts JSON even when wrapped in conversational preamble' do
      wrapped_text = "Here is the evaluation result:\n{\"level\": 4, \"confidence\": \"high\"}\nHope this helps!"
      payload = { 'candidates' => [{ 'content' => { 'parts' => [{ 'text' => wrapped_text }] } }] }
      allow(fake_response).to receive(:success?).and_return(true)
      allow(fake_response).to receive(:body).and_return(payload.to_json)

      result = client.send(:parse_response, fake_response)
      expect(result).to eq({ 'level' => 4, 'confidence' => 'high' })
    end

    it 'raises ApiError when JSON is unrecoverably malformed' do
      payload = { 'candidates' => [{ 'content' => { 'parts' => [{ 'text' => 'Not a json string at all' }] } }] }
      allow(fake_response).to receive(:success?).and_return(true)
      allow(fake_response).to receive(:body).and_return(payload.to_json)

      expect {
        client.send(:parse_response, fake_response)
      }.to raise_error(Gemini::HttpClient::ApiError, /Malformed JSON response/)
    end
  end
end
