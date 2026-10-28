# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::HttpClient do
  let(:client) { described_class.new(model: 'contoh-model', timeout: 5) }
  let(:url)    { 'https://generativelanguage.googleapis.com/v1/models/contoh-model:generateContent' }

  # AC-10: error bodies from the provider can echo prompt content, so they are
  # kept on the exception for debugging but never written to the log.
  it 'raises with the status and logs no response body on an API error' do
    body = { error: { code: 403, message: 'denied for Kandidat Contoh Rahasia' } }.to_json
    stub_request(:post, url).to_return(status: 403, body: body)
    logged = []
    allow(Rails.logger).to receive(:error) { |message| logged << message.to_s }

    expect { client.generate_content('Contoh prompt') }
      .to raise_error(Gemini::HttpClient::ApiError) { |error| expect(error.status).to eq(403) }
    expect(logged.join("\n")).not_to include('Kandidat Contoh Rahasia')
    expect(logged.join("\n")).to include('403')
  end
end
