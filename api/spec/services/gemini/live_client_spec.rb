# frozen_string_literal: true

RSpec.describe Gemini::LiveClient do
  it 'keeps transcript text and resumption handles out of event logs' do
    messages = []
    allow(Rails.logger).to receive(:info) { |message| messages << message }
    allow(Rails.logger).to receive(:debug) { |message| messages << message }
    client = described_class.allocate
    payload = {
      'serverContent' => {
        'inputTranscription' => { 'text' => 'Synthetic candidate private detail' },
        'outputTranscription' => { 'text' => 'Synthetic model private detail' }
      },
      'sessionResumption' => { 'token' => 'synthetic-secret-handle' }
    }

    client.send(:log_gemini_event, payload)
    client.send(:handle_resumption_update, payload)

    expect(messages.join(' ')).to include('inputTx=present', 'outputTx=present', 'Resumption data received')
    expect(messages.join(' ')).not_to include('private detail', 'synthetic-secret-handle')
  end
end
