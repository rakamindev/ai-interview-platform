# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::HttpClient do
  let(:api_key) { 'test_api_key' }
  let(:model) { 'gemini-1.5-pro' }
  let(:client) { described_class.new(model: model, api_key: api_key, timeout: 5) }
  
  let(:prompt) { 'Hello, world!' }
  let(:temperature) { 0.2 }

  let(:stubs) { Faraday::Adapter::Test::Stubs.new }
  let(:test_connection) do
    Faraday.new do |builder|
      builder.adapter :test, stubs
    end
  end

  before do
    allow(client).to receive(:build_connection).and_return(test_connection)
    client.instance_variable_set(:@connection, test_connection)
  end

  describe '#generate_content' do
    context 'when the API call is successful' do
      let(:response_body) do
        {
          candidates: [
            {
              content: {
                parts: [
                  { text: '{"status": "success", "message": "Hello back!"}' }
                ]
              }
            }
          ]
        }.to_json
      end

      before do
        stubs.post("/v1/models/#{model}:generateContent") do |env|
          [200, { 'Content-Type' => 'application/json' }, response_body]
        end
      end

      it 'returns parsed JSON when response is valid JSON' do
        result = client.generate_content(prompt, temperature: temperature)
        expect(result).to eq({ 'status' => 'success', 'message' => 'Hello back!' })
      end
    end

    context 'when the response text has markdown code fences' do
      let(:response_body) do
        {
          candidates: [
            {
              content: {
                parts: [
                  { text: "```json\n{\"status\": \"success\"}\n```" }
                ]
              }
            }
          ]
        }.to_json
      end

      before do
        stubs.post("/v1/models/#{model}:generateContent") do |env|
          [200, { 'Content-Type' => 'application/json' }, response_body]
        end
      end

      it 'strips markdown and parses JSON' do
        result = client.generate_content(prompt)
        expect(result).to eq({ 'status' => 'success' })
      end
    end

    context 'when the response is not valid JSON' do
      let(:response_body) do
        {
          candidates: [
            {
              content: {
                parts: [
                  { text: 'Just some plain text response.' }
                ]
              }
            }
          ]
        }.to_json
      end

      before do
        stubs.post("/v1/models/#{model}:generateContent") do |env|
          [200, { 'Content-Type' => 'application/json' }, response_body]
        end
      end

      it 'returns the raw text' do
        result = client.generate_content(prompt)
        expect(result).to eq('Just some plain text response.')
      end
    end

    context 'when the API rate limits (429)' do
      before do
        stubs.post("/v1/models/#{model}:generateContent") do |env|
          [429, {}, 'Rate limit exceeded']
        end
      end

      it 'raises a RateLimitError' do
        expect { client.generate_content(prompt) }.to raise_error(Gemini::HttpClient::RateLimitError, 'Rate limited')
      end
    end

    context 'when the API returns a 500 error' do
      before do
        stubs.post("/v1/models/#{model}:generateContent") do |env|
          [500, {}, 'Internal Server Error']
        end
      end

      it 'raises an ApiError' do
        expect { client.generate_content(prompt) }.to raise_error(Gemini::HttpClient::ApiError, /API returned 500/)
      end
    end

    context 'when the API returns an empty response without content' do
      let(:response_body) do
        { candidates: [] }.to_json
      end

      before do
        stubs.post("/v1/models/#{model}:generateContent") do |env|
          [200, { 'Content-Type' => 'application/json' }, response_body]
        end
      end

      it 'raises an ApiError' do
        expect { client.generate_content(prompt) }.to raise_error(Gemini::HttpClient::ApiError, 'No content in Gemini response')
      end
    end

    context 'when a timeout occurs' do
      before do
        stubs.post("/v1/models/#{model}:generateContent") do |env|
          raise Faraday::TimeoutError.new('timeout')
        end
      end

      it 'raises a TimeoutError' do
        expect { client.generate_content(prompt) }.to raise_error(Gemini::HttpClient::TimeoutError, /timeout after/)
      end
    end
  end
end
