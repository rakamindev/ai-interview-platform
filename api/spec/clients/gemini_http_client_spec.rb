# frozen_string_literal: true

require 'faraday'
require 'faraday/retry'
require_relative '../../app/clients/gemini/http_client'

RSpec.describe Gemini::HttpClient do
  let(:logger) { instance_double('Logger', warn: nil, error: nil) }

  before do
    stub_const('Rails', double('Rails', logger: logger))
  end

  it 'falls back to the next model after a retryable provider failure' do
    client = described_class.new(model: 'primary-model,fallback-model', api_key: 'test-key')
    failure = Gemini::HttpClient::ApiError.new('API returned 503', status: 503)

    allow(client).to receive(:request_response).with(anything, anything, 'primary-model').and_raise(failure)
    allow(client).to receive(:request_response).with(anything, anything, 'fallback-model').and_return(double)
    allow(client).to receive(:parse_response).and_return({ 'ok' => true })

    expect(client.generate_content('prompt')).to eq('ok' => true)
    expect(client).to have_received(:request_response).with(anything, anything, 'primary-model')
    expect(client).to have_received(:request_response).with(anything, anything, 'fallback-model')
  end

  it 'does not fall back for non-retryable API errors' do
    client = described_class.new(model: 'primary-model,fallback-model', api_key: 'test-key')
    failure = Gemini::HttpClient::ApiError.new('API returned 400', status: 400)

    allow(client).to receive(:request_response).and_raise(failure)

    expect { client.generate_content('prompt') }.to raise_error(Gemini::HttpClient::ApiError)
    expect(client).to have_received(:request_response).once
  end

  it 'falls back after a transport timeout' do
    client = described_class.new(model: 'primary-model,fallback-model', api_key: 'test-key')
    timeout = Gemini::HttpClient::TimeoutError.new('Gemini API timeout')

    allow(client).to receive(:request_response).with(anything, anything, 'primary-model').and_raise(timeout)
    allow(client).to receive(:request_response).with(anything, anything, 'fallback-model').and_return(double)
    allow(client).to receive(:parse_response).and_return({ 'ok' => true })

    expect(client.generate_content('prompt')).to eq('ok' => true)
    expect(client).to have_received(:request_response).with(anything, anything, 'fallback-model')
  end

  it 'falls back after a rate limit response' do
    client = described_class.new(model: 'primary-model,fallback-model', api_key: 'test-key')
    failure = Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429)

    allow(client).to receive(:request_response).with(anything, anything, 'primary-model').and_raise(failure)
    allow(client).to receive(:request_response).with(anything, anything, 'fallback-model').and_return(double)
    allow(client).to receive(:parse_response).and_return({ 'ok' => true })

    expect(client.generate_content('prompt')).to eq('ok' => true)
  end

  it 'does not fall back for invalid credentials or unavailable models' do
    [401, 403, 404].each do |status|
      client = described_class.new(model: 'primary-model,fallback-model', api_key: 'test-key')
      failure = Gemini::HttpClient::ApiError.new("API returned #{status}", status: status)
      allow(client).to receive(:request_response).and_raise(failure)

      expect { client.generate_content('prompt') }.to raise_error(Gemini::HttpClient::ApiError)
      expect(client).to have_received(:request_response).once
    end
  end

  it 'raises the final failure when all configured models are exhausted' do
    client = described_class.new(model: 'primary-model,secondary-model', api_key: 'test-key')
    failure = Gemini::HttpClient::ApiError.new('API returned 503', status: 503)
    allow(client).to receive(:request_response).and_raise(failure)

    expect { client.generate_content('prompt') }.to raise_error(failure)
    expect(client).to have_received(:request_response).twice
  end
end
