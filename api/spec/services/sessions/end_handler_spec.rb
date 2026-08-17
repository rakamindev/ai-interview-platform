# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler, type: :service do
  let!(:org) { create(:organization) }

  def create_session!(**attrs)
    in_tenant(org) do
      assessment = create(:assessment)
      create(:session, assessment: assessment, **attrs)
    end
  end

  describe 'idempotency' do
    it 'ends a session and creates exactly one portfolio' do
      session = create_session!

      result = in_tenant(org) { Sessions::EndHandler.new(session).call(reason: 'all_covered') }

      expect(result.status).to eq('ended')
      expect(session.reload.portfolio).to be_present
      expect(session.reload.portfolio.generation_status).to eq('pending')
    end

    it 'is a no-op when called a second time (no duplicate portfolio, no error)' do
      session = create_session!

      in_tenant(org) { Sessions::EndHandler.new(session).call(reason: 'all_covered') }
      portfolio_count = in_tenant(org) { Portfolio.count }

      expect do
        in_tenant(org) { Sessions::EndHandler.new(session).call(reason: 'all_covered') }
      end.not_to change { Portfolio.count }

      expect(session.reload.status).to eq('ended')
    end

    it 'handles concurrent end calls without raising', :concurrency do
      session = create_session!

      errors = Queue.new
      barrier = Queue.new
      threads = 4.times.map do
        Thread.new do
          barrier.pop
          with_tenant(org) { Sessions::EndHandler.new(session).call(reason: 'all_covered') }
        rescue StandardError => e
          errors << e
        end
      end

      4.times { barrier << true }
      threads.each(&:join)

      expect(errors.size).to eq(0), "expected no errors, got #{errors.size}"
      expect(Portfolio.where(session_id: session.id).count).to eq(1)
      expect(session.reload.status).to eq('ended')
    end
  end

  describe 'reason handling' do
    it 'upgrades end_reason from error to a manual reason' do
      session = create_session!(status: 'ended', end_reason: 'error')

      in_tenant(org) { Sessions::EndHandler.new(session).call(reason: 'manual_assessor') }

      expect(session.reload.end_reason).to eq('manual_assessor')
    end

    it 'falls back to manual_assessor for an invalid reason' do
      session = create_session!

      in_tenant(org) { Sessions::EndHandler.new(session).call(reason: 'not-a-real-reason') }

      expect(session.reload.end_reason).to eq('manual_assessor')
    end
  end
end