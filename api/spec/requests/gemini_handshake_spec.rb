# frozen_string_literal: true
require 'rails_helper'
RSpec.describe 'Gemini handshake', type: :request do
  if ENV['GEMINI_API_KEY'].present?
    it 'receives a response from Gemini Flash' do
      client = Gemini::HttpClient.new(
        model: 'gemini-3.5-flash',
        timeout: 15
      )
      response = client.generate_content('Reply with the single word: ok', temperature: 0)
      expect(response).to be_present
    end
  else
    it 'is skipped — set GEMINI_API_KEY to run' do
      skip 'GEMINI_API_KEY not set'
    end
  end
end