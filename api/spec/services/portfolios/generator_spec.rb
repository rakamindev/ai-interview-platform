# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) do
    Assessment.create!(
      tenant_id:      1,
      created_by:     1,
      name:           'Staff Frontend Engineer',
      time_limit_min: 45
    )
  end

  let(:session) do
    Session.create!(tenant_id: 1, assessment: assessment)
  end

  let(:fake_response) do
    {
      'configured_skills'  => [],
      'discovered_skills'  => []
    }
  end

  let(:successful_client) { instance_double(Gemini::HttpClient, generate_content: fake_response) }

  describe '#call' do
    context 'when generation succeeds' do
      it 'marks the portfolio complete' do
        generator = described_class.new(session: session, gemini_client: successful_client)

        portfolio = generator.call

        expect(portfolio.generation_status).to eq('complete')
        expect(portfolio.generated_at).to be_present
      end

      # Regression test for a real bug found in review: a portfolio that had
      # previously failed (generation_error set) and was then regenerated
      # successfully still showed the stale error message, because the
      # success path never cleared generation_error. Delete the
      # `generation_error: nil` argument in generator.rb's success `update!`
      # call to see this test fail.
      it 'clears a stale generation_error left over from a previous failed attempt' do
        portfolio = session.create_portfolio!(
          generation_status: 'failed',
          generation_error:  'API returned 404'
        )

        generator = described_class.new(session: session, gemini_client: successful_client)
        generator.call

        expect(portfolio.reload.generation_status).to eq('complete')
        expect(portfolio.reload.generation_error).to be_nil
      end
    end

    context 'when the Gemini client raises' do
      let(:failing_client) do
        instance_double(Gemini::HttpClient).tap do |client|
          allow(client).to receive(:generate_content)
            .and_raise(Gemini::HttpClient::ApiError.new('API returned 404', status: 404))
        end
      end

      it 'marks the portfolio failed and records the error message' do
        generator = described_class.new(session: session, gemini_client: failing_client)

        expect { generator.call }.to raise_error(Gemini::HttpClient::ApiError)

        portfolio = session.reload.portfolio
        expect(portfolio.generation_status).to eq('failed')
        expect(portfolio.generation_error).to eq('API returned 404')
      end
    end
  end
end
