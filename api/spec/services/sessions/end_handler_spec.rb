# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler, type: :model do
  let(:session) { create(:session, :active, started_at: 30.minutes.ago) }
  let(:handler) { described_class.new(session) }

  before do
    allow_any_instance_of(described_class).to receive(:publish_status_update)
    allow_any_instance_of(described_class).to receive(:enqueue_portfolio_generation)
  end

  describe '#call' do
    context 'when session is active' do
      it 'ends the session' do
        handler.call(reason: 'manual_assessor')
        expect(session.reload.status).to eq('ended')
      end

      it 'sets end_reason' do
        handler.call(reason: 'manual_assessor')
        expect(session.reload.end_reason).to eq('manual_assessor')
      end

      it 'sets ended_at' do
        handler.call(reason: 'manual_assessor')
        expect(session.reload.ended_at).to be_present
      end

      it 'calculates duration_seconds' do
        handler.call(reason: 'manual_assessor')
        expect(session.reload.duration_seconds).to be >= 0
      end

      it 'creates a portfolio' do
        handler.call(reason: 'manual_assessor')
        expect(session.reload.portfolio).to be_present
      end

      it 'returns the session' do
        result = handler.call(reason: 'manual_assessor')
        expect(result).to eq(session)
      end
    end

    context 'when session is already ended' do
      before do
        session.update!(status: 'ended', end_reason: 'error')
        create(:portfolio, session: session)
      end

      it 'upgrades end_reason from error to manual reason' do
        handler.call(reason: 'manual_candidate')
        expect(session.reload.end_reason).to eq('manual_candidate')
      end

      it 'does not create duplicate portfolio' do
        existing_portfolio = session.portfolio
        handler.call(reason: 'manual_assessor')
        expect(session.reload.portfolio.id).to eq(existing_portfolio.id)
      end
    end

    context 'with invalid reason' do
      it 'defaults to manual_assessor' do
        handler.call(reason: 'invalid_reason')
        expect(session.reload.end_reason).to eq('manual_assessor')
      end
    end

    context 'with different end reasons' do
      %w[manual_candidate manual_assessor all_covered time_ceiling error].each do |reason|
        it "handles #{reason} reason" do
          handler.call(reason: reason)
          expect(session.reload.end_reason).to eq(reason)
        end
      end
    end
  end
end
