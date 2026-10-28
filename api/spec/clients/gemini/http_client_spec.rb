# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::HttpClient do
  let(:api_key) { 'test-key-123' }
  let(:model) { 'gemini-3.5-flash' }
  let(:client) { described_class.new(model: model, api_key: api_key) }

  describe '#initialize' do
    it 'sets the model and api_key properly' do
      expect(client.instance_variable_get(:@model)).to eq(model)
      expect(client.instance_variable_get(:@api_key)).to eq(api_key)
    end
  end

  describe '#generate_url' do
    it 'targets the v1beta endpoint with the specified model' do
      url = client.send(:generate_url)
      expect(url).to eq("https://generativelanguage.googleapis.com/v1beta/models/#{model}:generateContent")
    end
  end

  describe '#generate_content' do
    let(:prompt) { 'Hello Gemini' }
    let(:connection) { client.instance_variable_get(:@connection) }

    context 'when API returns successful response' do
      let(:mock_response) do
        instance_double(
          Faraday::Response,
          status: 200,
          success?: true,
          body: {
            'candidates' => [
              {
                'content' => {
                  'parts' => [{ 'text' => '{"skills":[]}' }]
                }
              }
            ]
          }.to_json
        )
      end

      it 'parses and returns the inner JSON response' do
        allow(connection).to receive(:post).and_return(mock_response)

        result = client.generate_content(prompt)
        expect(result).to eq({ 'skills' => [] })
      end
    end

    context 'when API returns 429' do
      let(:rate_limit_response) do
        instance_double(
          Faraday::Response,
          status: 429,
          success?: false,
          body: { error: { message: 'Quota exceeded' } }.to_json
        )
      end

      it 'raises Gemini::HttpClient::RateLimitError' do
        allow(connection).to receive(:post).and_return(rate_limit_response)

        expect {
          client.generate_content(prompt)
        }.to raise_error(Gemini::HttpClient::RateLimitError, /Rate limited/)
      end
    end

    context 'when API returns 400 or 404' do
      let(:error_response) do
        instance_double(
          Faraday::Response,
          status: 400,
          success?: false,
          body: { error: { message: 'Invalid model' } }.to_json
        )
      end

      it 'raises Gemini::HttpClient::ApiError with status code' do
        allow(connection).to receive(:post).and_return(error_response)

        expect {
          client.generate_content(prompt)
        }.to raise_error(Gemini::HttpClient::ApiError, /API returned 400/)
      end
    end

    context 'when Faraday raises timeout error' do
      it 'raises Gemini::HttpClient::TimeoutError' do
        allow(connection).to receive(:post).and_raise(Faraday::TimeoutError.new('Request timed out'))

        expect {
          client.generate_content(prompt)
        }.to raise_error(Gemini::HttpClient::TimeoutError, /timeout/)
      end
    end

    context 'when Faraday raises general API error' do
      it 'raises Gemini::HttpClient::ApiError' do
        allow(connection).to receive(:post).and_raise(Faraday::Error.new('Connection failed'))

        expect {
          client.generate_content(prompt)
        }.to raise_error(Gemini::HttpClient::ApiError, /Gemini API error/)
      end
    end
  end
end
