# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::HttpClient do
  describe 'request URL' do
    it 'uses the configured Gemini API version' do
      client = described_class.new(
        model: 'gemini-3.1-pro-preview',
        api_key: 'test-key',
        api_version: 'v1beta'
      )

      expect(client.send(:generate_url))
        .to eq('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent')
    end
  end

  describe 'API errors' do
    it 'includes the upstream error message when present' do
      client = described_class.new(model: 'gemini-3.1-pro-preview', api_key: 'test-key')
      response = instance_double(
        Faraday::Response,
        status: 404,
        body: { error: { message: 'model is no longer available' } }.to_json
      )

      expect(client.send(:api_error_message, response))
        .to eq('API returned 404: model is no longer available')
    end
  end
end
