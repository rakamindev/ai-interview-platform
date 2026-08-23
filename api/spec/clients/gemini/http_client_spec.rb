# frozen_string_literal: true

require "rails_helper"

RSpec.describe Gemini::HttpClient do
  let(:client) { described_class.new(model: "gemini-2.0-flash-001", api_key: "test-key") }

  describe "an error response from Gemini" do
    it "never logs the raw response body" do
      candidate_transcript_snippet = "candidate said something sensitive here"
      response = instance_double(
        Faraday::Response,
        success?: false,
        status: 400,
        body: { error: { message: candidate_transcript_snippet } }.to_json
      )
      allow_any_instance_of(Faraday::Connection).to receive(:post).and_return(response)

      logged_messages = []
      allow(Rails.logger).to receive(:error) { |msg| logged_messages << msg }

      expect { client.generate_content("prompt") }.to raise_error(Gemini::HttpClient::ApiError)
      expect(logged_messages.join).not_to include(candidate_transcript_snippet)
    end
  end
end
