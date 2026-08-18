# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioGeneratorWorker do
  let(:session)   { create(:session, :ended) }
  let(:portfolio) { create(:portfolio, session: session) }

  describe 'when Sidekiq gives up on the job' do
    subject(:give_up) do
      described_class.sidekiq_retries_exhausted_block.call(
        { 'args' => [session.id], 'retry_count' => 3, 'error_message' => 'API returned 503' },
        nil
      )
    end

    context 'and no portfolio was ever produced' do
      before { portfolio.update!(generation_status: 'generating') }

      it 'records the failure' do
        give_up

        expect(portfolio.reload).to be_failed
      end

      it 'keeps the reason, so the screen can name it' do
        give_up

        expect(portfolio.reload.generation_error).to eq('Failed after 3 retries: API returned 503')
      end
    end

    # Exhausted retries describe the job, not the portfolio. Another run had
    # written a complete one; stamping 'failed' over it hid seven usable skills.
    context 'and another run already completed the portfolio' do
      before { portfolio.update!(generation_status: 'complete', generated_at: Time.current) }

      it 'leaves it complete' do
        give_up

        expect(portfolio.reload).to be_complete
      end

      it 'does not write an error over a portfolio that has none' do
        give_up

        expect(portfolio.reload.generation_error).to be_nil
      end
    end

    context 'and the session is gone' do
      it 'does not raise' do
        session_id = session.id
        session.destroy!

        expect do
          described_class.sidekiq_retries_exhausted_block.call(
            { 'args' => [session_id], 'retry_count' => 3, 'error_message' => 'boom' }, nil
          )
        end.not_to raise_error
      end
    end
  end

  describe '#perform' do
    it 'ignores a session that no longer exists' do
      expect { described_class.new.perform(-1) }.not_to raise_error
    end
  end
end
