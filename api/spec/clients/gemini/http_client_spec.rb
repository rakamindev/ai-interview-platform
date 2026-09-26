# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::HttpClient do
  let(:client) { described_class.new(model: 'test-model', api_key: 'test-key', timeout: 5) }
  let(:url) { 'https://generativelanguage.googleapis.com/v1/models/test-model:generateContent' }
  let(:answer) { { candidates: [{ content: { parts: [{ text: '{"answer":"ok"}' }] } }] }.to_json }

  # No real waiting between retries in tests.
  before { allow_any_instance_of(Faraday::Retry::Middleware).to receive(:sleep) }

  it 'retries when Gemini is briefly busy (503), then returns the answer' do
    stub_request(:post, url).to_return({ status: 503, body: '{}' }, { status: 200, body: answer })

    expect(client.generate_content('hi')).to eq('answer' => 'ok')
    expect(a_request(:post, url)).to have_been_made.twice
  end

  it 'retries a rate limit (429) the same way' do
    stub_request(:post, url).to_return({ status: 429, body: '{}' }, { status: 200, body: answer })

    expect(client.generate_content('hi')).to eq('answer' => 'ok')
  end

  it 'gives up after 3 retries with a clear error' do
    stub_request(:post, url).to_return(status: 503, body: '{}')

    expect { client.generate_content('hi') }.to raise_error(Gemini::HttpClient::ApiError, 'API returned 503')
    expect(a_request(:post, url)).to have_been_made.times(4)
  end

  it 'does not retry an error that will not go away, like a missing model (404)' do
    stub_request(:post, url).to_return(status: 404, body: '{}')

    expect { client.generate_content('hi') }.to raise_error(Gemini::HttpClient::ApiError, 'API returned 404')
    expect(a_request(:post, url)).to have_been_made.once
  end

  it 'raises a separate error when the answer has no text, so it is not taken for an outage' do
    stub_request(:post, url).to_return(status: 200, body: { candidates: [] }.to_json)

    expect { client.generate_content('hi') }.to raise_error(Gemini::HttpClient::EmptyResponseError)
  end

  it 'retries when it cannot connect, then returns the answer' do
    stub_request(:post, url).to_raise(Net::OpenTimeout).then.to_return(status: 200, body: answer)

    expect(client.generate_content('hi')).to eq('answer' => 'ok')
    expect(a_request(:post, url)).to have_been_made.twice
  end

  it 'does not retry a slow answer (read timeout); the job queue handles that' do
    stub_request(:post, url).to_raise(Net::ReadTimeout)

    expect { client.generate_content('hi') }.to raise_error(Gemini::HttpClient::TimeoutError)
    expect(a_request(:post, url)).to have_been_made.once
  end
end
