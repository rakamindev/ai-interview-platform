# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::LiveClient do
  let(:input_turns) { [] }
  let(:output_turns) { [] }
  let(:socket) { instance_double(Faye::WebSocket::Client, send: true, close: true) }
  let(:client) do
    described_class.new(
      system_prompt: 'prompt',
      api_key: 'synthetic-key',
      on_input_transcription: ->(text) { input_turns << text },
      on_output_transcription: ->(text) { output_turns << text }
    )
  end

  before do
    client.instance_variable_set(:@ws, socket)
    client.instance_variable_set(:@connected, true)
  end

  def receive_input(text)
    client.send(:handle_message, { serverContent: { inputTranscription: { text: text } } }.to_json)
  end

  def receive_output(text)
    client.send(:handle_message, { serverContent: { outputTranscription: { text: text } } }.to_json)
  end

  describe 'buffered transcription when the connection is replaced' do
    it 'flushes the words still in the buffer on supersede!' do
      receive_input('candidate words before the refresh')
      receive_output('ai words before the refresh')

      client.supersede!

      expect(input_turns).to eq(['candidate words before the refresh'])
      expect(output_turns).to eq(['ai words before the refresh'])
    end

    it 'flushes when Gemini drops the connection' do
      receive_input('candidate words before the drop')

      client.send(:handle_ws_close, Struct.new(:code, :reason).new(1011, 'gone'))

      expect(input_turns).to eq(['candidate words before the drop'])
    end

    it 'flushes on an intentional close' do
      receive_input('last words before ending')

      client.close

      expect(input_turns).to eq(['last words before ending'])
    end

    it 'does not emit the same words twice' do
      receive_input('only once')

      client.supersede!
      client.close

      expect(input_turns).to eq(['only once'])
    end
  end

  describe '#inject_context' do
    it 'reports non-delivery once superseded so callers do not mark the signal as sent' do
      client.supersede!

      expect(client.inject_context('signal')).to be(false)
      expect(socket).not_to have_received(:send)
    end
  end
end
