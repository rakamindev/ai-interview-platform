# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:session) { create(:session) }

  describe "defaults" do
    it "sets an expiry window on create" do
      expect(session.invite_expires_at).to be_present
      expect(session.invite_expires_at).to be > Time.current
    end

    it "generates a 64-character invite token" do
      expect(session.invite_token.length).to eq(64)
    end

    it "uses the web app base URL for the candidate link" do
      original = ENV['WEB_BASE_URL']
      ENV['WEB_BASE_URL'] = 'https://interviews.example.com'

      expect(session.invite_url).to eq(
        "https://interviews.example.com/interview/#{session.invite_token}"
      )
    ensure
      ENV['WEB_BASE_URL'] = original
    end

    it "never points candidates at the API origin" do
      expect(session.invite_url).to include('/interview/')
      expect(session.invite_url).not_to include('/api/v1')
    end
  end

  describe "#invite_usable?" do
    it "is true for a fresh pending invite" do
      expect(session.invite_usable?).to be(true)
    end

    it "is false once the link expired" do
      session.update!(invite_expires_at: 1.minute.ago)
      expect(session.invite_usable?).to be(false)
    end

    it "is false once the link was revoked" do
      session.update!(invite_revoked_at: Time.current)
      expect(session.invite_usable?).to be(false)
    end

    it "is false while an interview is live" do
      session.update!(status: 'active')
      expect(session.invite_usable?).to be(false)
    end

    it "is false after the interview ended" do
      session.update!(status: 'ended', end_reason: 'manual_candidate', ended_at: Time.current)
      expect(session.invite_usable?).to be(false)
    end
  end

  describe "#invite_status" do
    it "reports pending for a fresh link" do
      expect(session.invite_status).to eq('pending')
    end

    it "reports active while live" do
      session.update!(status: 'active')
      expect(session.invite_status).to eq('active')
    end

    it "reports expired, revoked and completed distinctly" do
      expect(create(:session, invite_expires_at: 1.minute.ago).invite_status).to eq('expired')
      expect(create(:session, invite_revoked_at: Time.current).invite_status).to eq('revoked')
      expect(create(:session, status: 'ended', end_reason: 'manual_candidate').invite_status).to eq('completed')
    end

    it "treats a failed session as consumed" do
      expect(create(:session, status: 'failed').invite_status).to eq('completed')
    end

    it "reports revocation before expiry" do
      session.update!(invite_expires_at: 1.minute.ago, invite_revoked_at: Time.current)
      expect(session.invite_status).to eq('revoked')
    end
  end

  describe "#revoke_invite!" do
    it "stamps the revocation time" do
      expect { session.revoke_invite! }.to change { session.invite_revoked_at }.from(nil)
      expect(session.invite_usable?).to be(false)
    end
  end

  describe "#reissue_invite!" do
    it "rotates the token, clears revocation and starts a fresh expiry window" do
      old_token = session.invite_token
      session.update!(invite_revoked_at: Time.current, invite_expires_at: 1.minute.ago)

      session.reissue_invite!

      expect(session.invite_token).not_to eq(old_token)
      expect(session.invite_revoked_at).to be_nil
      expect(session.invite_expires_at).to be > Time.current
      expect(session.invite_reissued_count).to eq(1)
      expect(session.invite_usable?).to be(true)
    end

    it "invalidates the previously shared URL permanently" do
      old_url = session.invite_url
      session.reissue_invite!
      expect(session.invite_url).not_to eq(old_url)
    end
  end

  describe "#record_consent!" do
    it "records consent once and stays idempotent" do
      session.record_consent!
      first = session.consent_given_at
      expect(first).to be_present

      session.record_consent!
      expect(session.consent_given_at).to eq(first)
    end
  end
end
