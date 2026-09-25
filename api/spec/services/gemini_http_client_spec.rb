require 'rails_helper'

RSpec.describe Gemini::HttpClient do
  it 'sends portfolio generation to v1beta with server-side API key authentication' do
    client = described_class.new(model: 'gemini-3.1-pro-preview', api_key: 'synthetic-key')
    connection = double('HTTP connection')
    response = double(success?: true, body: {
      candidates: [{ content: { parts: [{ text: '{"configured_skills":[],"discovered_skills":[]}' }] } }]
    }.to_json)
    client.instance_variable_set(:@connection, connection)
    expect(connection).to receive(:post).with(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent',
      anything,
      hash_including('x-goog-api-key' => 'synthetic-key')
    ).and_return(response)
    expect(client.generate_content('Synthetic test')).to eq('configured_skills' => [], 'discovered_skills' => [])
  end
end
