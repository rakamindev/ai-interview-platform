# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::HttpClient do
  subject(:client) { described_class.new(model: 'test-model', api_key: 'test-key') }

  it 'raises ApiError when a 2xx response body is not valid JSON (P3-9)' do
    response = instance_double(Faraday::Response, success?: true, status: 200, body: '<html>not json</html>')
    allow_any_instance_of(Faraday::Connection).to receive(:post).and_return(response)

    expect { client.generate_content('hello') }
      .to raise_error(Gemini::HttpClient::ApiError, /Malformed JSON/)
  end

  it 'returns parsed content on a valid JSON 2xx' do
    body = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }.to_json
    response = instance_double(Faraday::Response, success?: true, status: 200, body: body)
    allow_any_instance_of(Faraday::Connection).to receive(:post).and_return(response)

    expect(client.generate_content('hello')).to eq('ok' => true)
  end
end
