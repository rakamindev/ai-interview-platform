# frozen_string_literal: true

require 'rails_helper'

# Behavior contract for Step 5 (see wiki 04-step4-revamp.md, AC-2/3/4/5/7).
# A failed interview must never look like a success or generate a portfolio; a failure
# before the first answer resets for self-service retry, a mid-interview failure is terminal.
RSpec.describe Sessions::FailureHandler do
  let(:assessment) { create(:assessment) }

  def build_session(**attrs)
    create(:session, assessment: assessment, tenant_id: assessment.tenant_id, **attrs)
  end

  context 'failure before the first answer (no transcript) — AC-2/AC-3' do
    let(:session) { build_session(status: 'active', started_at: 1.minute.ago) }

    it 'resets the session to pending so the same link can retry' do
      expect(described_class.new(session).call(reason: 'error')).to eq(:reset)

      session.reload
      expect(session.status).to eq('pending')
      expect(session.started_at).to be_nil
      expect(session.end_reason).to be_nil
    end

    it 'does not create or leave a portfolio behind' do
      expect { described_class.new(session).call(reason: 'error') }.not_to(change { Portfolio.count })
      expect(session.reload.portfolio).to be_nil
    end
  end

  context 'failure mid-interview (has transcript) — AC-4/AC-5' do
    let(:session) { build_session(status: 'active', started_at: 5.minutes.ago) }

    before { create(:transcript_turn, session: session, turn_number: 1) }

    it 'marks the session failed, keeps the transcript, and records the reason' do
      expect(described_class.new(session).call(reason: 'error')).to eq(:failed)

      session.reload
      expect(session.status).to eq('failed')
      expect(session.end_reason).to eq('error')
      expect(session.ended_at).to be_present
      expect(session.transcript_turns.count).to eq(1)
    end

    it 'does not auto-generate a portfolio for a failed interview' do
      expect { described_class.new(session).call(reason: 'error') }.not_to(change { Portfolio.count })
    end
  end

  context 'idempotency — AC-7' do
    it 'leaves an already-ended session untouched' do
      session = build_session(status: 'ended', end_reason: 'all_covered', ended_at: Time.current)
      expect(described_class.new(session).call(reason: 'error')).to eq(:noop)
      expect(session.reload.status).to eq('ended')
    end

    it 'leaves an already-failed session untouched' do
      session = build_session(status: 'failed', end_reason: 'error', ended_at: Time.current)
      expect(described_class.new(session).call(reason: 'error')).to eq(:noop)
      expect(session.reload.status).to eq('failed')
    end
  end

  describe 'Session#failed?' do
    it 'is true only for a failed session' do
      expect(build_session(status: 'failed').failed?).to be(true)
      expect(build_session(status: 'ended').failed?).to be(false)
    end
  end
end
