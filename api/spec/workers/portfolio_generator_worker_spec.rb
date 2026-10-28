# frozen_string_literal: true

require 'rails_helper'

# AC7.4: a portfolio only becomes failed when Sidekiq gives up, and keeps the readable reason.
RSpec.describe PortfolioGeneratorWorker do
  let(:portfolio) do
    create(:portfolio, generation_status: 'generating', generation_attempts: 4,
                       generation_error: 'The AI model is overloaded (HTTP 503).')
  end

  it 'marks the portfolio failed when retries are exhausted, keeping the last reason' do
    described_class.sidekiq_retries_exhausted_block.call({ 'args' => [portfolio.session_id], 'retry_count' => 3 },
                                                         StandardError.new('raw'))

    expect(portfolio.reload).to have_attributes(generation_status: 'failed',
                                                generation_error: 'The AI model is overloaded (HTTP 503).')
  end
end
