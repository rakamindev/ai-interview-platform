# frozen_string_literal: true

RSpec.describe Gemini::HttpClient do
  it 'logs only the status when a provider error body contains candidate data' do
    response = instance_double(Faraday::Response, success?: false, status: 500,
                                                  body: 'Synthetic candidate answer: private detail')
    expect(Rails.logger).to receive(:error).with('[Gemini::HttpClient] API error status=500')

    expect do
      described_class.allocate.send(:parse_response, response)
    end.to raise_error(Gemini::HttpClient::ApiError, 'API returned 500')
  end

  it 'does not include malformed provider content in the raised error' do
    response = instance_double(Faraday::Response, success?: true,
                                                  body: '{"private":"Synthetic candidate answer"')

    expect do
      described_class.allocate.send(:parse_response, response)
    end.to raise_error(Gemini::HttpClient::ApiError, 'Invalid Gemini response JSON')
  end
end
