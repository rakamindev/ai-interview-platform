# frozen_string_literal: true

require 'rails_helper'

# W29 (UU PDP): the Gemini Live event log must never contain what the candidate or the AI said.
# It keeps the diagnostic signal (an event with N characters of transcription arrived) instead.
RSpec.describe Gemini::LiveClient, 'event logging (W29)' do
  let(:candidate_words) { 'My name is Rani and I live in Bandung' }
  let(:ai_words)        { 'Thanks Rani, tell me about your last project' }
  let(:log)             { StringIO.new }

  around do |example|
    original = Rails.logger
    Rails.logger = ActiveSupport::Logger.new(log)
    example.run
  ensure
    Rails.logger = original
  end

  def log_event(server_content)
    described_class.allocate.send(:log_gemini_event, { 'serverContent' => server_content })
    log.string
  end

  it 'logs the length of a candidate transcription, never the words' do
    output = log_event('inputTranscription' => { 'text' => candidate_words })
    expect(output).to include("inputTx=#{candidate_words.length}chars")
    expect(output).not_to include('Rani')
    expect(output).not_to include('Bandung')
  end

  it 'logs the length of an AI transcription, never the words' do
    output = log_event('outputTranscription' => { 'parts' => [{ 'text' => ai_words }] }, 'turnComplete' => true)
    expect(output).to include("outputTx=#{ai_words.length}chars", 'turnComplete')
    expect(output).not_to include('Rani')
  end
end
