# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:assessment) do
    Current.tenant_id = 1
    Assessment.create!(
      name: 'Frontend Engineer Assessment',
      time_limit_min: 30,
      language: 'en',
      created_by: 1
    )
  end

  before do
    Current.tenant_id = 1
  end

  after do
    Current.tenant_id = nil
  end

  describe 'creation and token generation' do
    it 'automatically generates a unique invite token on create' do
      session = Session.create!(
        assessment: assessment,
        candidate_name: 'John Doe',
        status: 'pending'
      )

      expect(session.invite_token).to be_present
      expect(session.invite_token.length).to eq(64) # 32 bytes in hex
    end

    it 'generates a valid interview invite_url' do
      session = Session.create!(
        assessment: assessment,
        candidate_name: 'Jane Doe',
        status: 'pending'
      )

      expect(session.invite_url).to include("/interview/#{session.invite_token}")
    end
  end

  describe 'status transitions and helpers' do
    it 'reports correct boolean status via helpers' do
      pending_session = Session.create!(assessment: assessment, status: 'pending')
      expect(pending_session.pending?).to be(true)
      expect(pending_session.active?).to be(false)
      expect(pending_session.ended?).to be(false)

      pending_session.update!(status: 'active')
      expect(pending_session.active?).to be(true)

      pending_session.update!(status: 'ended')
      expect(pending_session.ended?).to be(true)
    end

    it 'rejects invalid statuses' do
      session = Session.new(assessment: assessment, status: 'unknown_status')
      expect(session).not_to be_valid
      expect(session.errors[:status]).to include('is not included in the list')
    end
  end

  describe 'candidate consent' do
    it 'defaults to not consented' do
      session = Session.create!(assessment: assessment, status: 'pending')
      expect(session.consent_given?).to be(false)
      expect(session.consent_given_at).to be_nil
    end

    it 'records timestamp and marks consent as given when grant_consent! is called' do
      session = Session.create!(assessment: assessment, status: 'pending')
      freeze_time = Time.zone.parse('2026-09-05 10:00:00')

      allow(Time).to receive(:current).and_return(freeze_time)
      session.grant_consent!

      expect(session.reload.consent_given?).to be(true)
      expect(session.consent_given_at).to eq(freeze_time)
    end
  end
end
