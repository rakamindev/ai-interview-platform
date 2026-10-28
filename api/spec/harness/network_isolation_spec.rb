# frozen_string_literal: true

require 'rails_helper'

# Guards the harness itself: specs must never reach Gemini or use a real key.
RSpec.describe 'Test harness isolation' do
  it 'blocks real HTTP calls to Gemini' do
    client = Gemini::HttpClient.new(model: 'contoh-model', timeout: 5)

    expect { client.generate_content('Contoh prompt') }.to raise_error(WebMock::NetConnectNotAllowedError)
  end

  it 'replaces the Gemini API key with a dummy value' do
    expect(ENV.fetch('GEMINI_API_KEY')).to eq('test-dummy-gemini-key')
  end

  it 'queues Sidekiq jobs in memory instead of Redis' do
    FitGapGeneratorWorker.perform_async(1, 2)

    expect(FitGapGeneratorWorker.jobs.size).to eq(1)
  end
end
