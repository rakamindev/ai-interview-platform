# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioGeneratorWorker do
  # AC-10 / AC-80: once retries are exhausted the portfolio is marked failed
  # with a code; the raw exception message is not stored or shown.
  it 'marks the portfolio failed with a code and no raw message when retries are exhausted' do
    portfolio = create(:portfolio, generation_status: 'failed', generation_error_code: 'timeout')
    msg = { 'args' => [portfolio.session_id], 'retry_count' => 3,
            'error_message' => 'Gemini API timeout after 180s: transcript fragment' }

    described_class.sidekiq_retries_exhausted_block.call(msg, StandardError.new('x'))

    expect(portfolio.reload).to have_attributes(generation_status: 'failed', generation_error_code: 'timeout')
    expect(portfolio.generation_error.to_s).not_to include('transcript fragment')
  end
end
