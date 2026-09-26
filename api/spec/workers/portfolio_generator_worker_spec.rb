# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioGeneratorWorker do
  let(:session) { create(:session) }
  let(:last_try_failed) { described_class.sidekiq_retries_exhausted_block }
  let(:job) { { 'args' => [session.id], 'retry_count' => 3, 'error_message' => 'API returned 503' } }

  it 'is retried by the job queue' do
    expect(described_class.get_sidekiq_options['retry']).to eq(3)
  end

  it 'marks the report failed after the last try, keeping the kind of the last failure' do
    portfolio = create(:portfolio, session: session, generation_status: 'pending', failure_kind: 'model_unavailable')

    last_try_failed.call(job, StandardError.new)

    expect(portfolio.reload).to have_attributes(generation_status: 'failed', failure_kind: 'model_unavailable')
    expect(portfolio.generation_error).to include('API returned 503')
  end

  it 'leaves the report alone when another run finished it in the meantime' do
    portfolio = create(:portfolio, session: session, generation_status: 'complete')

    last_try_failed.call(job, StandardError.new)

    expect(portfolio.reload.generation_status).to eq('complete')
  end

  it 'skips a session that no longer exists' do
    expect { described_class.new.perform(0) }.not_to raise_error
  end
end
