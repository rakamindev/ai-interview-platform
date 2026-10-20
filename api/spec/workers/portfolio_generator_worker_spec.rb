# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioGeneratorWorker do
  it 'skips quietly when the session no longer exists' do
    expect { described_class.new.perform(-1) }.not_to raise_error
  end

  it 'runs the generator for the session, leaving the failed status to the retries-exhausted hook' do
    session   = create(:session, :ended)
    generator = instance_double(Portfolios::Generator, call: nil)
    allow(Portfolios::Generator).to receive(:new).with(session:, mark_failed: false).and_return(generator)

    described_class.new.perform(session.id)

    expect(generator).to have_received(:call)
  end

  it 'P2-26: leaves the portfolio generating when an attempt fails, so Sidekiq can retry it' do
    session = create(:session, :ended)
    allow(Gemini::HttpClient).to receive(:new)
      .and_return(FakeGemini.new(Gemini::HttpClient::ApiError.new('API returned 503', status: 503)))

    expect { described_class.new.perform(session.id) }.to raise_error(Gemini::HttpClient::ApiError)

    expect(session.reload.portfolio).to have_attributes(
      generation_status: 'generating', generation_error: nil, generation_error_category: 'model_unavailable'
    )
  end

  it 'marks the portfolio failed once Sidekiq gives up retrying, without the raw error text' do
    portfolio = create(:portfolio, generation_status: 'generating', generation_error_category: 'model_invalid_response')
    message   = { 'args' => [portfolio.session_id], 'retry_count' => 3,
                  'error_message' => "unexpected token at 'Sure! Here is the portfolio'" }

    described_class.sidekiq_retries_exhausted_block.call(message, StandardError.new)

    expect(portfolio.reload).to have_attributes(
      generation_status: 'failed', generation_error_category: 'model_invalid_response',
      generation_error: "The AI's answer couldn't be read as a portfolio. Gave up after 3 retries."
    )
  end
end
