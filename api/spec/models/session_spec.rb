# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe 'validations' do
    it 'validates inclusion of status in STATUSES' do
      session = Session.new(status: 'invalid_status')
      expect(session).not_to be_valid
      expect(session.errors[:status]).to be_present
    end

    it 'validates inclusion of end_reason in END_REASONS when present' do
      session = Session.new(status: 'ended', end_reason: 'invalid_reason')
      expect(session).not_to be_valid
      expect(session.errors[:end_reason]).to be_present
    end

    it 'allows valid end_reasons' do
      Session::END_REASONS.each do |reason|
        session = Session.new(status: 'ended', end_reason: reason)
        session.valid?
        expect(session.errors[:end_reason]).to be_empty
      end
    end
  end

  describe 'UU PDP consent management (SPEC-P0-01)' do
    let(:session) { Session.new(status: 'pending') }

    it 'consented? returns false when consented_at is nil' do
      expect(session.consented?).to be false
    end

    it 'consented? returns true when consented_at is present' do
      session.consented_at = Time.current
      expect(session.consented?).to be true
    end

    it 'record_consent! updates consented_at, consent_ip, and terms_version' do
      allow(session).to receive(:update!).and_call_original
      allow(Time).to receive(:current).and_return(Time.zone.parse('2026-10-25 10:00:00'))

      expect(session).to receive(:update!).with(
        consented_at:  Time.current,
        consent_ip:    '203.0.113.42',
        terms_version: '2026.1'
      )

      session.record_consent!(ip: '203.0.113.42', version: '2026.1')
    end
  end

  describe '#remaining_seconds' do
    let(:assessment) { instance_double(Assessment, time_limit_min: 30) }
    let(:session) { Session.new(status: 'active', started_at: 10.minutes.ago) }

    before do
      allow(session).to receive(:assessment).and_return(assessment)
    end

    it 'returns 0 if session has ended' do
      session.status = 'ended'
      expect(session.remaining_seconds).to eq(0)
    end

    it 'returns full time in seconds if session has not started' do
      session.started_at = nil
      expect(session.remaining_seconds).to eq(1800)
    end

    it 'returns remaining seconds based on monotonic elapsed duration' do
      expect(session.remaining_seconds).to be_within(2).of(1200)
    end

    it 'clamps to 0 if time ceiling exceeded' do
      session.started_at = 45.minutes.ago
      expect(session.remaining_seconds).to eq(0)
    end
  end

  describe '#invite_url' do
    let(:session) { Session.new(invite_token: 'test_token_abc123') }

    it 'generates interview route url with token' do
      expect(session.invite_url).to include('/interview/test_token_abc123')
    end
  end
end
