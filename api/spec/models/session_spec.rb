# frozen_string_literal: true

require "rails_helper"

RSpec.describe Session, type: :model do
  describe "#expired?" do
    it "is false for a pending session invited within the expiry window" do
      session = create(:session, status: "pending", created_at: 1.day.ago)
      expect(session.expired?).to be false
    end

    it "is true for a pending session invited past the expiry window" do
      session = create(:session, status: "pending", created_at: 8.days.ago)
      expect(session.expired?).to be true
    end

    it "is false for an active session past the window — expiry only applies before it's started" do
      session = create(:session, status: "active", created_at: 8.days.ago)
      expect(session.expired?).to be false
    end

    it "is false for an ended session past the window" do
      session = create(:session, status: "ended", created_at: 8.days.ago)
      expect(session.expired?).to be false
    end
  end

  describe "#invite_expires_at" do
    it "falls back to 7 days after creation when nothing was set explicitly" do
      created = Time.zone.parse("2026-08-01 10:00:00")
      session = create(:session, created_at: created, invite_expires_at: nil)
      expect(session.invite_expires_at).to eq(created + 7.days)
    end

    it "uses the explicit deadline when one was set" do
      deadline = Time.zone.parse("2026-09-01 10:00:00")
      session = create(:session, invite_expires_at: deadline)
      expect(session.invite_expires_at).to eq(deadline)
    end
  end

  describe "#extend_invite!" do
    it "pushes the deadline N days from now" do
      session = create(:session, status: "pending", invite_expires_at: 1.day.ago)
      session.extend_invite!(7)
      expect(session.invite_expires_at).to be_within(1.second).of(Time.current + 7.days)
    end

    it "is no longer expired after extending" do
      session = create(:session, status: "pending", invite_expires_at: 1.day.ago)
      session.extend_invite!(7)
      expect(session.expired?).to be false
    end
  end
end
