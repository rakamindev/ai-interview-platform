
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  describe '#call' do
    it 'marks the portfolio as failed when Gemini raises an error' do
      error = Gemini::HttpClient::RateLimitError.new('Rate limited')

      portfolio = instance_double(Portfolio)
      session = instance_double(Session, portfolio: portfolio, id: 123)
      gemini_client = instance_double(Gemini::HttpClient)

      allow(portfolio).to receive(:update!)
      allow(gemini_client).to receive(:generate_content).and_raise(error)

      generator = described_class.new(
        session: session,
        gemini_client: gemini_client
      )

      allow(generator).to receive(:build_prompt).and_return('Test prompt')

      expect {
        generator.call
      }.to raise_error(Gemini::HttpClient::RateLimitError, 'Rate limited')

      expect(portfolio).to have_received(:update!).with(
        generation_status: 'generating'
      )
      expect(portfolio).to have_received(:update!).with(
        generation_status: 'failed',
        generation_error: 'Rate limited'
      )
    end
  end
end
