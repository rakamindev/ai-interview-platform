# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Ai::InterviewEvaluatorService, type: :service do
  let(:gemini) { instance_double(Gemini::HttpClient) }
  subject(:service) { described_class.new(gemini_client: gemini) }

  describe '#analyze' do
    it 'scrubs PII from the prompt before calling the model' do
      expect(gemini).to receive(:generate_content) do |prompt, **|
        expect(prompt).not_to include('budiman@example.com')
        expect(prompt).to include('[redacted]')
        '{ "skills": [] }'
      end

      service.analyze('candidate budiman@example.com answered well')
    end

    it 'returns structured, scrubbed skills data' do
      expect(gemini).to receive(:generate_content)
        .and_return({ 'skills' => [{ 'name' => 'React', 'evidence' => ['quote'] }] })

      result = service.analyze('prompt')

      expect(result[:skills]).to eq([{ name: 'React', evidence: ['quote'] }])
    end

    it 'raises EvaluationTimeoutError on a model timeout' do
      expect(gemini).to receive(:generate_content).and_raise(Gemini::HttpClient::TimeoutError.new('slow'))

      expect { service.analyze('prompt') }
        .to raise_error(Ai::InterviewEvaluatorService::EvaluationTimeoutError)
    end

    it 'raises EvaluationFailureError on a generic API error' do
      expect(gemini).to receive(:generate_content).and_raise(Gemini::HttpClient::ApiError.new('boom'))

      expect { service.analyze('prompt') }
        .to raise_error(Ai::InterviewEvaluatorService::EvaluationFailureError)
    end

    it 'raises MalformedEvaluationError when output lacks a skills array' do
      expect(gemini).to receive(:generate_content).and_return('{ "nope": true }')

      expect { service.analyze('prompt') }
        .to raise_error(Ai::InterviewEvaluatorService::MalformedEvaluationError)
    end

    it 'raises MalformedEvaluationError on invalid JSON' do
      expect(gemini).to receive(:generate_content).and_return('not json at all')

      expect { service.analyze('prompt') }
        .to raise_error(Ai::InterviewEvaluatorService::MalformedEvaluationError)
    end
  end
end
