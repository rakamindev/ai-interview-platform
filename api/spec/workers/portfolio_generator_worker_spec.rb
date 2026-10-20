# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioGeneratorWorker do
  it 'does not copy the raw error message into the portfolio when retries are exhausted' do
    portfolio = create(:portfolio, generation_status: 'failed')
    job = { 'args' => [portfolio.session_id], 'retry_count' => 3,
            'error_message' => "unexpected token at 'Candidate answer: my NIK is 3171...'" }

    described_class.sidekiq_retries_exhausted_block.call(job, StandardError.new)

    expect(portfolio.reload.generation_error).to eq('Failed after 3 retries')
  end
end
