require 'faraday'
require_relative '../../../app/clients/gemini/http_client'

RSpec.describe Gemini::HttpClient do
  it 'sends preview model generation to the documented beta endpoint' do
    requests = []
    connection = double('HTTP transport')
    response = double('HTTP response', success?: true, body: {
      candidates: [{ content: { parts: [{ text: '{"configured_skills":[]}' }] } }]
    }.to_json)
    allow(connection).to receive(:post) { |url, *_args| requests << url; response }
    allow(Faraday).to receive(:new).and_return(connection)
    client = described_class.new(model: 'gemini-3.1-pro-preview', api_key: 'synthetic-placeholder')
    expect(client.generate_content('Synthetic portfolio')).to eq('configured_skills' => [])
    expect(requests).to eq([
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent'
    ])
  end
end
