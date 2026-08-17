# frozen_string_literal: true

require 'rails_helper'

# Migration to the Gemini Interactions API (generateContent returns 404 for
# current models). Verifies the request shape and the steps[] parsing.
RSpec.describe Gemini::HttpClient do
  describe '#generate_content' do
    it 'posts to the Interactions endpoint and parses the model_output step' do
      conn = instance_double(Faraday::Connection)
      body = {
        steps: [
          { 'type' => 'thought', 'content' => [] },
          { 'type' => 'model_output', 'content' => [{ 'type' => 'text', 'text' => '{"ok":true}' }] }
        ]
      }.to_json
      response = double(success?: true, status: 200, body: body)

      expect(conn).to receive(:post).with(
        'https://generativelanguage.googleapis.com/v1beta/interactions',
        { model: 'gemini-flash-latest', input: 'prompt', generation_config: { temperature: 0.2 } }.to_json,
        { 'Content-Type' => 'application/json', 'x-goog-api-key' => 'key' }
      ).and_return(response)

      client = described_class.new(model: 'gemini-flash-latest', api_key: 'key')
      client.instance_variable_set(:@connection, conn)

      expect(client.generate_content('prompt')).to eq('ok' => true)
    end

    it 'returns plain text when the output is not JSON' do
      client = described_class.new(model: 'gemini-flash-latest', api_key: 'key')
      text = client.send(:extract_text, 'steps' => [
        { 'type' => 'model_output', 'content' => [{ 'type' => 'text', 'text' => '```json\n{"a":1}\n```' }] }
      ])
      expect(text).to eq('```json\n{"a":1}\n```')
    end

    it 'returns nil when there is no model_output step' do
      client = described_class.new(model: 'gemini-flash-latest', api_key: 'key')
      expect(client.send(:extract_text, { 'steps' => [] })).to be_nil
    end
  end
end