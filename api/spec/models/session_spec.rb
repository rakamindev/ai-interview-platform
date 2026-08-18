# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:tenant_id) { 9_001 }
  let(:assessment) do
    Assessment.create!(
      tenant_id: tenant_id,
      created_by: 1,
      name: 'Invite reuse assessment',
      time_limit_min: 30
    )
  end

  def create_session!(attrs = {})
    assessment.sessions.create!(
      {
        tenant_id: tenant_id,
        status: 'pending',
        candidate_name: 'Ada Lovelace'
      }.merge(attrs)
    )
  end

  describe '.pending_invite_for' do
    it 'returns the pending invite matched by candidate_id' do
      pending_by_id = create_session!(candidate_id: 42, candidate_name: 'Ada')
      create_session!(candidate_id: 99, candidate_name: 'Other')

      found = described_class.pending_invite_for(
        assessment,
        candidate_id: 42,
        candidate_name: 'Ada'
      )

      expect(found).to eq(pending_by_id)
    end

    it 'falls back to case-insensitive trimmed name when id is blank' do
      pending_by_name = create_session!(candidate_name: '  Ada Lovelace ')

      found = described_class.pending_invite_for(
        assessment,
        candidate_id: nil,
        candidate_name: 'ada lovelace'
      )

      expect(found).to eq(pending_by_name)
    end

    it 'does not reuse an ended session for the same person' do
      create_session!(
        candidate_id: 42,
        candidate_name: 'Ada',
        status: 'ended',
        end_reason: 'manual_assessor',
        ended_at: Time.current
      )

      expect(
        described_class.pending_invite_for(
          assessment,
          candidate_id: 42,
          candidate_name: 'Ada'
        )
      ).to be_nil
    end

    it 'never reuses unnamed pending invites' do
      create_session!(candidate_id: nil, candidate_name: nil)
      create_session!(candidate_id: nil, candidate_name: '  ')

      expect(
        described_class.pending_invite_for(
          assessment,
          candidate_id: nil,
          candidate_name: nil
        )
      ).to be_nil

      expect(
        described_class.pending_invite_for(
          assessment,
          candidate_id: nil,
          candidate_name: '   '
        )
      ).to be_nil
    end

    it 'prefers the newest pending invite when multiple name matches exist' do
      older = create_session!(candidate_name: 'Ada', created_at: 2.days.ago)
      newer = create_session!(candidate_name: 'Ada', created_at: 1.hour.ago)
      expect(older.id).not_to eq(newer.id)

      found = described_class.pending_invite_for(
        assessment,
        candidate_name: 'Ada'
      )

      expect(found).to eq(newer)
    end
  end

  describe '#pending?' do
    it 'is the gate for invite revocation' do
      pending_invite = create_session!
      active_invite = create_session!(status: 'active', started_at: Time.current)

      expect(pending_invite).to be_pending
      expect(active_invite).not_to be_pending
    end
  end
end
