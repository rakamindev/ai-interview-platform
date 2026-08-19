# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::Analyzer, type: :service do
  let(:session_double) { double('Session') }

  subject { described_class.new(session: session_double, gemini_client: nil) }

  describe '#parse_response' do
    it 'returns error flag when JSON parse fails' do
      # Call private method to simulate parse failure
      result = subject.send(:parse_response, "not a json", [])
      expect(result[:error]).to be_truthy
      expect(result[:error_message]).to be_a(String)
    end
  end
end
