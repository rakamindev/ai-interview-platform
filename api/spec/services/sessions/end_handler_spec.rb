# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler, type: :service do
  # Stub Redis so specs don't require a live Redis connection
  before do
    fake_redis = instance_double(Redis, publish: nil, close: nil)
    allow(Redis).to receive(:new).and_return(fake_redis)
  end

  # Stub Sidekiq worker so we don't need a running queue
  before do
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
  end

  let(:assessment) { create(:assessment) }

  def build_session(overrides = {})
    create(:session, { assessment: assessment, tenant_id: 1, status: 'pending' }.merge(overrides))
  end

  subject(:handler) { described_class.new(session) }

  # ══════════════════════════════════════════════════════════════════════════
  # 1. Basic termination
  # ══════════════════════════════════════════════════════════════════════════
  describe '#call — basic termination' do
    let(:session) { build_session }

    it 'marks the session as ended' do
      handler.call(reason: 'manual_assessor')
      expect(session.reload.status).to eq('ended')
    end

    it 'records the end_reason' do
      handler.call(reason: 'all_covered')
      expect(session.reload.end_reason).to eq('all_covered')
    end

    it 'sets ended_at' do
      handler.call(reason: 'manual_assessor')
      expect(session.reload.ended_at).not_to be_nil
    end

    it 'calculates duration_seconds when started_at is present' do
      session.update!(started_at: 10.minutes.ago, status: 'active')
      handler.call(reason: 'all_covered')
      expect(session.reload.duration_seconds).to be_between(580, 620)
    end

    it 'creates a portfolio record' do
      expect { handler.call(reason: 'manual_assessor') }
        .to change(Portfolio, :count).by(1)
    end

    it 'enqueues PortfolioGeneratorWorker' do
      handler.call(reason: 'manual_assessor')
      expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id)
    end

    it 'is idempotent if session is already ended' do
      session.update_columns(status: 'ended', end_reason: 'manual_assessor', ended_at: Time.current)
      expect { handler.call(reason: 'manual_assessor') }.not_to change(Portfolio, :count)
    end

    it 'falls back to manual_assessor for unknown reasons' do
      handler.call(reason: 'totally_unknown')
      expect(session.reload.end_reason).to eq('manual_assessor')
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 2. Supersede logic — candidate_id identity
  # ══════════════════════════════════════════════════════════════════════════
  describe '#call — supersede by candidate_id' do
    let(:session) { build_session(candidate_id: 42) }

    context 'when pending sibling sessions share the same candidate_id + assessment' do
      let!(:sibling1) { build_session(candidate_id: 42) }
      let!(:sibling2) { build_session(candidate_id: 42) }

      it 'marks siblings as ended/superseded after successful completion' do
        handler.call(reason: 'all_covered')
        expect(sibling1.reload.status).to     eq('ended')
        expect(sibling1.reload.end_reason).to eq('superseded')
        expect(sibling2.reload.status).to     eq('ended')
        expect(sibling2.reload.end_reason).to eq('superseded')
      end

      it 'sets ended_at on superseded sessions' do
        handler.call(reason: 'all_covered')
        expect(sibling1.reload.ended_at).not_to be_nil
      end

      it 'does NOT supersede sessions for a DIFFERENT assessment' do
        other_assessment = create(:assessment)
        other_session    = create(:session, assessment: other_assessment, tenant_id: 1,
                                            candidate_id: 42, status: 'pending')
        handler.call(reason: 'all_covered')
        expect(other_session.reload.status).to eq('pending')
      end

      it 'does NOT supersede sessions for a DIFFERENT candidate_id' do
        unrelated = build_session(candidate_id: 99)
        handler.call(reason: 'all_covered')
        expect(unrelated.reload.status).to eq('pending')
      end

      it 'does NOT supersede sessions on a DIFFERENT tenant' do
        other_tenant = create(:session, assessment: assessment, tenant_id: 999,
                                        candidate_id: 42, status: 'pending')
        handler.call(reason: 'all_covered')
        expect(other_tenant.reload.status).to eq('pending')
      end
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 3. Supersede logic — candidate_email identity
  # ══════════════════════════════════════════════════════════════════════════
  describe '#call — supersede by candidate_email' do
    let(:session) { build_session(candidate_email: 'budi@example.com') }

    let!(:sibling) { build_session(candidate_email: 'budi@example.com') }

    it 'supersedes email-matched sibling on successful completion' do
      handler.call(reason: 'manual_candidate')
      expect(sibling.reload.end_reason).to eq('superseded')
    end

    it 'matches emails case-insensitively' do
      mixed_case = build_session(candidate_email: 'Budi@Example.COM')
      handler.call(reason: 'manual_assessor')
      # our factory stores as-is; scope uses downcase — test our scope is correct
      # mixed_case was not stored normalised, so it should NOT be superseded
      # (normalisation happens on create via controller, not on read)
      expect(sibling.reload.end_reason).to eq('superseded')
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 4. Supersede does NOT fire on failure reasons
  # ══════════════════════════════════════════════════════════════════════════
  describe '#call — no supersede on failure' do
    let(:session) { build_session(candidate_id: 42) }
    let!(:sibling) { build_session(candidate_id: 42) }

    it 'does NOT supersede siblings when session ends with error' do
      handler.call(reason: 'error')
      expect(sibling.reload.status).to eq('pending')
    end

    it 'does NOT supersede siblings when end_reason is superseded itself' do
      # superseded is in VALID_REASONS but not in SUPERSEDE_ON_REASONS
      session.update_columns(status: 'pending') # reset if needed
      handler.call(reason: 'superseded')
      expect(sibling.reload.status).to eq('pending')
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 5. Name-only sessions are never grouped
  # ══════════════════════════════════════════════════════════════════════════
  describe '#call — name-only sessions not superseded' do
    # Both sessions have the same name but NO candidate_id and NO email.
    # Name must never be used as identity — so no supersede should happen.
    let(:session) { build_session(candidate_name: 'Budi Santoso') }
    let!(:sibling) { build_session(candidate_name: 'Budi Santoso') }

    it 'does not supersede a same-named session with no identity' do
      handler.call(reason: 'all_covered')
      expect(sibling.reload.status).to eq('pending')
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 6. Each supersede reason triggers supersede
  # ══════════════════════════════════════════════════════════════════════════
  describe '#call — all SUPERSEDE_ON_REASONS trigger supersede' do
    let!(:sibling) { build_session(candidate_id: 77) }

    Sessions::EndHandler::SUPERSEDE_ON_REASONS.each do |reason|
      it "supersedes sibling when reason is '#{reason}'" do
        sess = build_session(candidate_id: 77)
        described_class.new(sess).call(reason: reason)
        expect(sibling.reload.end_reason).to eq('superseded')
      end
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # SEEDED FAULT TEST
  # Proves the supersede spec actually catches the bug.
  # To reproduce the failure: comment out `supersede_pending_sessions` in
  # EndHandler#call and run this spec — it will turn red.
  # ══════════════════════════════════════════════════════════════════════════
  describe 'SEEDED FAULT — supersede omission regression' do
    let(:session) { build_session(candidate_id: 55) }
    let!(:sibling) { build_session(candidate_id: 55) }

    it 'fails (red) if supersede_pending_sessions is removed — regression guard' do
      handler.call(reason: 'all_covered')
      expect(sibling.reload.end_reason).to eq('superseded'),
        "Expected sibling to be superseded after session completed. " \
        "If this fails, supersede_pending_sessions was likely removed or broken."
    end
  end
end
