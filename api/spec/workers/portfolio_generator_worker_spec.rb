# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioGeneratorWorker, type: :worker do
  let(:org) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:generator_double) { instance_double(Portfolios::Generator) }

  describe 'sidekiq configuration' do
    it 'is enqueued in the portfolio queue with 3 retries' do
      expect(described_class.sidekiq_options['queue']).to eq(:portfolio)
      expect(described_class.sidekiq_options['retry']).to eq(3)
    end
  end

  describe '#perform' do
    it 'instantiates Portfolios::Generator and calls it' do
      expect(Portfolios::Generator).to receive(:new).with(session: session).and_return(generator_double)
      expect(generator_double).to receive(:call)

      described_class.new.perform(session.id)
    end

    it 'skips execution when session is not found without raising' do
      expect(Portfolios::Generator).not_to receive(:new)

      expect {
        described_class.new.perform(-999)
      }.not_to raise_error
    end
  end

  describe 'retries exhausted' do
    it 'marks portfolio generation as permanently failed when all retries are exhausted' do
      portfolio = create(
        :portfolio,
        session: session,
        candidate_id: session.candidate_id,
        generation_status: 'generating'
      )

      msg = {
        'args' => [session.id],
        'retry_count' => 3,
        'error_message' => 'Rate limited'
      }

      described_class.sidekiq_retries_exhausted_block.call(msg, StandardError.new('Rate limited'))

      portfolio.reload
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).to eq('Failed after 3 retries: Rate limited')
    end
  end
end
